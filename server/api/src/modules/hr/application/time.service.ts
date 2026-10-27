import type {
  AttendancePage,
  AttendanceRecord,
  AttendanceSource,
  CancelRosterEntryRequest,
  ClockInRequest,
  ClockOutRequest,
  CorrectAttendanceRequest,
  CreateRosterEntryRequest,
  CreateShiftTemplateRequest,
  DecideOvertimeRequest,
  ListQuery,
  PublishRosterRequest,
  RosterEntry,
  RosterPage,
  RosterPublication,
  RosterWeek,
  ShiftTemplate,
  ShiftTemplateList,
  ShiftTemplateQuery,
} from '@injishi/contracts';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { assertOwnedByOrg } from '../../../shared/auth/assert-owned';
import { assertInBranchScope, type ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { pageOf } from '../../../shared/lists/list-query';
import { isCalendarDate } from '../../booking/domain/pricing';
import {
  addDays,
  crossesMidnight,
  hhmm,
  kigaliDateOf,
  kigaliToday,
  lastOfMonth,
  mondayOf,
  monthOf,
  shiftInstants,
} from '../domain/hr-calendar';
import {
  EmployeesRepository,
  violatedConstraint,
  type EmployeeRow,
  type Tx,
} from '../infrastructure/employees.repository';
import { writeHrAudit } from '../infrastructure/hr-audit';
import { writeHrEvent } from '../infrastructure/hr-events';
import { LeaveRepository } from '../infrastructure/leave.repository';
import {
  TimeRepository,
  type AttendanceRow,
  type PublicationRow,
  type PunchLocation,
  type RosterEntryRow,
  type ShiftTemplateRow,
} from '../infrastructure/time.repository';
import { AttendanceCloser } from './attendance-closer';
import { rosterCard } from './employee-presenter';
import { assertBranchInReach, assertPersonInReach, orgOf } from './hr-access';

/** How far a clock time may sit from the server's own (AC-T4). */
const AHEAD_MS = 5 * 60_000;
const BEHIND_MS = 7 * 86_400_000;

/** Attendance filters that read across days rather than today's sheet: a day, a time, or a queue (AC-TM9). */
const ACROSS_DAYS = new Set([
  'workDate',
  'clockInAt',
  'validated',
  'autoClosed',
  'overtimePending',
  'lateMinutes',
  'earlyMinutes',
  'overtimeMinutes',
]);

/** What a reader of attendance may see of a record (058-time AC-TM9, AC-TM13). */
export interface RecordReader {
  /** The figure audience: `attendance.approve` and `people.manage`. */
  figures: boolean;
  /** How far a phone punch was: `attendance.approve`, who validates it. */
  location: boolean;
}

/** The figure audience of a grant (AC-TM13). */
export function recordReaderOf(ws: Pick<ScopedWorkspace, 'permissions'>): RecordReader {
  const approve = ws.permissions.includes('attendance.approve');
  return { figures: approve || ws.permissions.includes('people.manage'), location: approve };
}

/**
 * Shift templates, the roster and attendance (ADR-058, the first thread and
 * 058-time).
 *
 * What a roster or attendance read carries of a person is the roster card and
 * nothing more, because `attendance.record` is held by the front desk. A
 * record's work figures and how far a phone was reach only the readers
 * `recordReaderOf` names.
 *
 * `punchIn` and `punchOut` are the one way a record opens and closes, whoever
 * punches: a supervisor here, a phone through self service, a kiosk with a PIN.
 */
@Injectable()
export class TimeService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly employees: EmployeesRepository,
    private readonly time: TimeRepository,
    private readonly leave: LeaveRepository,
    private readonly closer: AttendanceCloser,
  ) {}

  // --- Shift templates -----------------------------------------------------

  async listTemplates(ws: ScopedWorkspace, query: ShiftTemplateQuery): Promise<ShiftTemplateList> {
    const rows = await this.time.listTemplates(orgOf(ws), ws.branchScope, query.propertyId);
    return { templates: rows.map(presentTemplate) };
  }

  /** `POST /ops/shift-templates` (AC-T1, 058-time AC-TM4, AC-TM7). */
  async createTemplate(ws: ScopedWorkspace, body: CreateShiftTemplateRequest): Promise<ShiftTemplate> {
    const orgId = orgOf(ws);
    const property = assertOwnedByOrg(await this.employees.findProperty(body.propertyId), ws);
    assertBranchInReach(ws, property.id);
    if (body.startsAt === body.endsAt) {
      throw new UnprocessableEntityException('A shift cannot start and end at the same time.');
    }
    if (body.departmentId) {
      const department = await this.time.findDepartment(body.departmentId);
      if (!department || department.orgId !== orgId || department.propertyId !== property.id) {
        throw new UnprocessableEntityException('That department is not at this branch.');
      }
    }
    let id: string;
    try {
      id = await this.db.transaction((tx) =>
        this.time.insertTemplate(tx, {
          orgId,
          propertyId: property.id,
          departmentId: body.departmentId ?? null,
          name: body.name.trim(),
          startsAt: body.startsAt,
          endsAt: body.endsAt,
          breakMinutes: body.breakMinutes ?? 0,
          minWorkMinutes: body.minWorkMinutes ?? null,
          autoClockOutMinutes: body.autoClockOutMinutes ?? null,
        }),
      );
    } catch (error) {
      if (violatedConstraint(error) === 'shift_templates_name_uk') {
        throw new ConflictException(`This branch already has a shift called "${body.name.trim()}".`);
      }
      throw error;
    }
    const created = await this.time.findTemplate(id);
    if (!created) throw new NotFoundException();
    return presentTemplate(created);
  }

  // --- Roster --------------------------------------------------------------

  /**
   * `GET /ops/roster`: one page through the list contract (058-list-framework).
   * With no day filter it reads this week, Monday to Sunday in Kigali, so the
   * lens opens on the week; pages bound anything wider. Drafts reach only
   * those who manage the roster (058-time AC-TM1).
   */
  async listRoster(ws: ScopedWorkspace, query: ListQuery): Promise<RosterPage> {
    const named = query.filters.some((f) => f.field === 'workDate');
    const monday = mondayOf(kigaliToday());
    const page = await this.time.listRosterPage({
      orgId: orgOf(ws),
      scope: ws.branchScope,
      query,
      window: named ? null : { from: monday, to: addDays(monday, 6) },
      publishedOnly: !ws.permissions.includes('roster.manage'),
    });
    return pageOf(page.rows.map(presentEntry), page.total, query, {
      groups: page.groups,
      statusCounts: page.statusCounts,
    });
  }

  /** `GET /ops/roster/week`: one branch, Monday to Sunday, for the week grid (AC-TM14). */
  async week(ws: ScopedWorkspace, query: { propertyId: string; from?: string }): Promise<RosterWeek> {
    const orgId = orgOf(ws);
    const property = assertOwnedByOrg(await this.employees.findProperty(query.propertyId), ws);
    assertInBranchScope(ws, property.id);
    if (query.from && !isCalendarDate(query.from)) throw new UnprocessableEntityException('That is not a real date.');
    const from = mondayOf(query.from ?? kigaliToday());
    const to = addDays(from, 6);
    const managers = ws.permissions.includes('roster.manage');
    const [entries, publications] = await Promise.all([
      this.time.weekEntries({ orgId, propertyId: property.id, from, to }),
      this.time.publications({ orgId, propertyId: property.id, from, to }),
    ]);
    return {
      propertyId: property.id,
      from,
      to,
      entries: entries.filter((e) => managers || e.publishedAt !== null).map(presentEntry),
      publications: publications.map(presentPublication),
    };
  }

  /**
   * `POST /ops/roster` (AC-T1 to AC-T3). A new shift is a draft, unless its
   * date is in a range already published for its branch (and department): then
   * it is published at once and the person is told (058-time AC-TM1).
   */
  async roster(ws: ScopedWorkspace, userId: string, body: CreateRosterEntryRequest): Promise<RosterEntry> {
    const orgId = orgOf(ws);
    if (!isCalendarDate(body.workDate)) throw new UnprocessableEntityException('That is not a real date.');
    const employee = assertOwnedByOrg(await this.employees.find(body.employeeId), ws);
    assertPersonInReach(ws, employee.workPropertyId);
    const template = assertOwnedByOrg(await this.time.findTemplate(body.shiftTemplateId), ws);
    assertBranchInReach(ws, template.propertyId);
    if (template.status !== 'active') {
      throw new UnprocessableEntityException('That shift is retired.');
    }
    assertWorking(employee, body.workDate);

    const leave = await this.leave.approvedOn(employee.id, body.workDate);
    if (leave) {
      throw new ConflictException(
        `${employee.legalName} is on approved ${leave.leaveTypeName.toLowerCase()} from ${leave.startsOn} to ${leave.endsOn}.`,
      );
    }
    const instants = shiftInstants(body.workDate, template.startsAt, template.endsAt);
    let id: string;
    try {
      id = await this.db.transaction(async (tx) => {
        const published = await this.time.isPublishedDate(
          { orgId, propertyId: template.propertyId, departmentId: template.departmentId, date: body.workDate },
          tx,
        );
        const created = await this.time.insertEntry(tx, {
          orgId,
          employeeId: employee.id,
          shiftTemplateId: template.id,
          propertyId: template.propertyId,
          departmentId: template.departmentId,
          workDate: body.workDate,
          startsAt: instants.startsAt,
          endsAt: instants.endsAt,
          createdByUserId: userId,
          publishedAt: published ? new Date() : null,
        });
        await writeHrAudit(tx, {
          actorUserId: userId,
          subjectType: 'employee',
          subjectId: employee.id,
          eventType: 'hr.rostered',
          orgId,
          diff: { rosterEntryId: created, shiftTemplateId: template.id, workDate: body.workDate, published },
        });
        if (published) {
          await writeHrEvent(tx, {
            trigger: 'roster.changed',
            aggregateType: 'employee',
            aggregateId: employee.id,
            change: `entry:${created}`,
            workspaceId: ws.workspaceId,
            payload: { employeeId: employee.id, rosterEntryId: created },
          });
        }
        return created;
      });
    } catch (error) {
      if (violatedConstraint(error, '23P01') === 'roster_entries_no_overlap') {
        throw new ConflictException(`${employee.legalName} already has a shift that overlaps this one.`);
      }
      throw error;
    }
    const entry = await this.time.findEntry(id);
    if (!entry) throw new NotFoundException();
    return presentEntry(entry);
  }

  /** `POST /ops/roster/:id/cancel`. A published shift taken off tells its person (AC-TM1). */
  async cancelEntry(ws: ScopedWorkspace, userId: string, id: string, body: CancelRosterEntryRequest): Promise<RosterEntry> {
    const orgId = orgOf(ws);
    const entry = assertOwnedByOrg(await this.time.findEntry(id), ws);
    assertPersonInReach(ws, entry.workPropertyId);
    await this.db.transaction(async (tx) => {
      const moved = await this.time.cancelEntry(tx, entry.id, body.reason.trim());
      if (!moved) throw new ConflictException('That shift is not scheduled any more.');
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'employee',
        subjectId: entry.employeeId,
        eventType: 'hr.roster_cancelled',
        orgId,
        diff: { rosterEntryId: entry.id, workDate: entry.workDate },
        reason: body.reason.trim(),
      });
      if (entry.publishedAt) {
        await writeHrEvent(tx, {
          trigger: 'roster.changed',
          aggregateType: 'employee',
          aggregateId: entry.employeeId,
          change: `cancel:${entry.id}`,
          workspaceId: ws.workspaceId,
          payload: { employeeId: entry.employeeId, rosterEntryId: entry.id },
        });
      }
    });
    const updated = await this.time.findEntry(id);
    if (!updated) throw new NotFoundException();
    return presentEntry(updated);
  }

  /**
   * `POST /ops/roster/publish` (AC-TM1): every draft of a branch (and a
   * department) in the range is published, one publication row is written, and
   * each person whose shifts were published is told once. A range with no
   * drafts is still recorded: later shifts in it are published as they are made.
   */
  async publish(ws: ScopedWorkspace, userId: string, body: PublishRosterRequest): Promise<RosterPublication> {
    const orgId = orgOf(ws);
    const property = assertOwnedByOrg(await this.employees.findProperty(body.propertyId), ws);
    assertBranchInReach(ws, property.id);
    if (!isCalendarDate(body.from) || !isCalendarDate(body.to)) throw new UnprocessableEntityException('That is not a real date.');
    const departmentId = body.departmentId ?? null;
    if (departmentId) {
      const department = await this.time.findDepartment(departmentId);
      if (!department || department.orgId !== orgId || (department.propertyId !== null && department.propertyId !== property.id)) {
        throw new UnprocessableEntityException('That department is not at this branch.');
      }
    }
    const at = new Date();
    const id = await this.db.transaction(async (tx) => {
      const stamped = await this.time.publishDrafts(tx, { orgId, propertyId: property.id, departmentId, from: body.from, to: body.to, at });
      const publicationId = await this.time.insertPublication(tx, {
        orgId,
        propertyId: property.id,
        departmentId,
        fromDate: body.from,
        toDate: body.to,
        entryCount: stamped.count,
        publishedByUserId: userId,
        publishedAt: at,
      });
      for (const employeeId of stamped.employeeIds) {
        await writeHrEvent(tx, {
          trigger: 'roster.published',
          aggregateType: 'employee',
          aggregateId: employeeId,
          change: publicationId,
          workspaceId: ws.workspaceId,
          payload: { employeeId, publicationId },
        });
      }
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'org',
        subjectId: orgId,
        eventType: 'hr.roster_published',
        orgId,
        diff: { publicationId, propertyId: property.id, departmentId, from: body.from, to: body.to, entries: stamped.count },
      });
      return publicationId;
    });
    const [row] = (await this.time.publications({ orgId, propertyId: property.id, from: body.from, to: body.to })).filter(
      (p) => p.id === id,
    );
    if (!row) throw new NotFoundException();
    return presentPublication(row);
  }

  // --- Attendance ----------------------------------------------------------

  /**
   * `GET /ops/attendance`: one page through the list contract. With no day or
   * time filter it is today's sheet: today's records and anything still open.
   * A queue filter (waiting for validation, closed by the sweep, overtime to
   * decide, a figure) reads across days instead, because what waits for a
   * supervisor is rarely from today (058-time AC-TM8, AC-TM9). Figures and
   * distances reach only their readers (AC-TM13).
   */
  async listAttendance(ws: ScopedWorkspace, query: ListQuery): Promise<AttendancePage> {
    const named = query.filters.some((f) => ACROSS_DAYS.has(f.field));
    const reader = recordReaderOf(ws);
    const page = await this.time.listAttendancePage({
      orgId: orgOf(ws),
      scope: ws.branchScope,
      query,
      sheetDay: named ? null : kigaliToday(),
      figures: reader.figures,
    });
    return pageOf(page.rows.map((r) => presentRecord(r, reader)), page.total, query, {
      groups: page.groups,
      statusCounts: page.statusCounts,
    });
  }

  /** `POST /ops/attendance/clock-in` (AC-T4): a supervisor's punch, validated as it is written. */
  async clockIn(ws: ScopedWorkspace, userId: string, body: ClockInRequest): Promise<AttendanceRecord> {
    const employee = assertOwnedByOrg(await this.employees.find(body.employeeId), ws);
    assertPersonInReach(ws, employee.workPropertyId);
    const id = await this.punchIn({
      employee,
      at: clockTime(body.at),
      source: 'supervisor',
      userId,
      validated: true,
      rosterEntryId: body.rosterEntryId ?? null,
      // The desk's reason and who confirmed the time stay on the record (real-data, people).
      note: body.note?.trim() || null,
    });
    return this.presentRecordById(id, recordReaderOf(ws));
  }

  /** `POST /ops/attendance/:id/clock-out`. */
  async clockOut(ws: ScopedWorkspace, userId: string, id: string, body: ClockOutRequest): Promise<AttendanceRecord> {
    const record = assertOwnedByOrg(await this.time.findRecord(id), ws);
    assertPersonInReach(ws, record.workPropertyId);
    await this.punchOut({ record, at: clockTime(body.at), userId });
    return this.presentRecordById(record.id, recordReaderOf(ws));
  }

  /**
   * `POST /ops/attendance/:id/correct` (AC-T5). A new closed record points at
   * the original, which becomes `superseded`; the original's times never
   * change. The new record carries its own figures (058-time AC-TM7).
   */
  async correct(ws: ScopedWorkspace, userId: string, id: string, body: CorrectAttendanceRequest): Promise<AttendanceRecord> {
    const original = assertOwnedByOrg(await this.time.findRecord(id), ws);
    assertPersonInReach(ws, original.workPropertyId);
    if (original.status === 'superseded') {
      throw new ConflictException('That record was already corrected. Correct the newer one.');
    }
    const newId = await this.writeCorrected({
      orgId: orgOf(ws),
      original,
      clockInAt: new Date(body.clockInAt),
      clockOutAt: new Date(body.clockOutAt),
      note: body.note.trim(),
      userId,
      eventType: 'hr.attendance_corrected',
    });
    return this.presentRecordById(newId, recordReaderOf(ws));
  }

  /**
   * A corrected record in place of an original, in one transaction: the shape
   * a supervisor's correction and an approved attendance request share
   * (AC-T5, 058-time AC-TM6). A month whose pay is confirmed is closed to it.
   */
  async writeCorrected(input: {
    orgId: string;
    original: AttendanceRow;
    clockInAt: Date;
    clockOutAt: Date;
    note: string;
    userId: string;
    eventType: string;
    reason?: string;
    /** A step that must commit with the record, such as the request it answers (058-time AC-TM6). */
    within?: (tx: Tx, recordId: string) => Promise<void>;
  }): Promise<string> {
    const { orgId, original } = input;
    if (input.clockOutAt.getTime() <= input.clockInAt.getTime()) {
      throw new UnprocessableEntityException('The clock out must come after the clock in.');
    }
    const workDate = original.rosterEntryId ? original.workDate : kigaliDateOf(input.clockInAt);
    await this.assertMonthOpen(orgId, [original.workDate, workDate]);
    const figures = await this.closer.figures({
      orgId,
      propertyId: original.workPropertyId,
      rosterEntryId: original.rosterEntryId,
      workDate,
      clockInAt: input.clockInAt,
      clockOutAt: input.clockOutAt,
    });
    try {
      return await this.db.transaction(async (tx) => {
        const moved = await this.time.supersede(tx, original.id);
        if (!moved) throw new ConflictException('That record was corrected a moment ago.');
        const created = await this.time.insertRecord(tx, {
          orgId,
          employeeId: original.employeeId,
          rosterEntryId: original.rosterEntryId,
          workDate,
          clockInAt: input.clockInAt,
          clockOutAt: input.clockOutAt,
          source: 'supervisor',
          recordedByUserId: input.userId,
          validated: true,
          validatedByUserId: input.userId,
          status: 'closed',
          supersedesId: original.id,
          note: input.note,
          close: figures,
        });
        await writeHrAudit(tx, {
          actorUserId: input.userId,
          subjectType: 'employee',
          subjectId: original.employeeId,
          eventType: input.eventType,
          orgId,
          diff: { attendanceRecordId: created, supersedes: original.id },
          reason: input.reason ?? input.note,
        });
        if (input.within) await input.within(tx, created);
        return created;
      });
    } catch (error) {
      if (violatedConstraint(error) === 'attendance_records_supersedes_uk') {
        throw new ConflictException('That record was corrected a moment ago.');
      }
      throw error;
    }
  }

  /**
   * A record nobody punched, written whole: what approving an attendance
   * request for a missed day writes (058-time AC-TM6). Linked by the same rule
   * as a punch, validated, and refused when it would overlap a record the
   * person already has.
   */
  async writeMissing(input: {
    employee: EmployeeRow;
    clockInAt: Date;
    clockOutAt: Date;
    userId: string;
    note: string;
    eventType: string;
    within?: (tx: Tx, recordId: string) => Promise<void>;
  }): Promise<string> {
    const { employee } = input;
    if (input.clockOutAt.getTime() <= input.clockInAt.getTime()) {
      throw new UnprocessableEntityException('The clock out must come after the clock in.');
    }
    const linked = await this.closer.link({
      orgId: employee.orgId,
      employeeId: employee.id,
      propertyId: employee.workPropertyId,
      at: input.clockInAt,
    });
    assertWorking(employee, linked.workDate);
    await this.assertMonthOpen(employee.orgId, [linked.workDate]);
    if (await this.time.overlapsRecord(employee.id, input.clockInAt, input.clockOutAt)) {
      throw new ConflictException('These times overlap a record already on file. Correct that record instead.');
    }
    const figures = await this.closer.figures({
      orgId: employee.orgId,
      propertyId: employee.workPropertyId,
      rosterEntryId: linked.entry?.id ?? null,
      workDate: linked.workDate,
      clockInAt: input.clockInAt,
      clockOutAt: input.clockOutAt,
    });
    return this.db.transaction(async (tx) => {
      const created = await this.time.insertRecord(tx, {
        orgId: employee.orgId,
        employeeId: employee.id,
        rosterEntryId: linked.entry?.id ?? null,
        workDate: linked.workDate,
        clockInAt: input.clockInAt,
        clockOutAt: input.clockOutAt,
        source: 'supervisor',
        recordedByUserId: input.userId,
        validated: true,
        validatedByUserId: input.userId,
        status: 'closed',
        supersedesId: null,
        note: input.note,
        close: figures,
      });
      await writeHrAudit(tx, {
        actorUserId: input.userId,
        subjectType: 'employee',
        subjectId: employee.id,
        eventType: input.eventType,
        orgId: employee.orgId,
        diff: { attendanceRecordId: created, workDate: linked.workDate },
        reason: input.note,
      });
      if (input.within) await input.within(tx, created);
      return created;
    });
  }

  /** `POST /ops/attendance/:id/validate`: vouch for a self or phone punch (AC-TM9). */
  async validate(ws: ScopedWorkspace, userId: string, id: string): Promise<AttendanceRecord> {
    const orgId = orgOf(ws);
    const record = assertOwnedByOrg(await this.time.findRecord(id), ws);
    assertPersonInReach(ws, record.workPropertyId);
    if (record.autoClosed) {
      throw new ConflictException('The sweep closed this record, so its times are a guess. Correct it with the real times instead.');
    }
    await this.db.transaction(async (tx) => {
      const moved = await this.time.validate(tx, record.id, userId);
      if (!moved) {
        throw new ConflictException('Only a self or phone clock in that nobody has validated yet can be validated.');
      }
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'employee',
        subjectId: record.employeeId,
        eventType: 'hr.attendance_validated',
        orgId,
        diff: { attendanceRecordId: record.id },
      });
    });
    return this.presentRecordById(record.id, recordReaderOf(ws));
  }

  /** `POST /ops/attendance/:id/overtime`: approve all of it, or less (AC-TM8). Only approved overtime reaches pay. */
  async decideOvertime(ws: ScopedWorkspace, userId: string, id: string, body: DecideOvertimeRequest): Promise<AttendanceRecord> {
    const orgId = orgOf(ws);
    const record = assertOwnedByOrg(await this.time.findRecord(id), ws);
    assertPersonInReach(ws, record.workPropertyId);
    if (record.status !== 'closed' || !record.overtimeMinutes) {
      throw new ConflictException('This record has no overtime to decide.');
    }
    if (body.approvedMinutes > record.overtimeMinutes) {
      throw new UnprocessableEntityException(`At most the ${record.overtimeMinutes} minutes worked over can be approved.`);
    }
    await this.assertMonthOpen(orgId, [record.workDate]);
    await this.db.transaction(async (tx) => {
      const moved = await this.time.decideOvertime(tx, record.id, body.approvedMinutes);
      if (!moved) throw new ConflictException('This record has no overtime to decide.');
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'employee',
        subjectId: record.employeeId,
        eventType: 'hr.overtime_decided',
        orgId,
        diff: { attendanceRecordId: record.id, overtimeMinutes: record.overtimeMinutes, approvedMinutes: body.approvedMinutes },
        reason: body.note?.trim() || null,
      });
    });
    return this.presentRecordById(record.id, recordReaderOf(ws));
  }

  // --- The one way a record opens and closes ---------------------------------------

  /**
   * Open a record (AC-T4, 058-time AC-TM9, AC-TM10, AC-TM15). A named shift
   * must be the person's and scheduled; otherwise the link rule finds it.
   * Nobody is clocked in twice, after they left, or on a day of approved leave.
   */
  async punchIn(input: {
    employee: EmployeeRow;
    at: Date;
    source: AttendanceSource;
    userId: string | null;
    validated: boolean;
    rosterEntryId?: string | null;
    kioskId?: string | null;
    location?: PunchLocation | null;
    note?: string | null;
    /** A step that must commit with the record, such as the outbox row a phone punch raises. */
    within?: (tx: Tx, recordId: string) => Promise<void>;
  }): Promise<string> {
    const { employee } = input;
    let entry: RosterEntryRow | null = null;
    let workDate: string;
    if (input.rosterEntryId) {
      entry = await this.time.findEntry(input.rosterEntryId);
      if (!entry || entry.orgId !== employee.orgId || entry.employeeId !== employee.id) {
        throw new UnprocessableEntityException('That shift is not this person\'s.');
      }
      if (entry.status !== 'scheduled') throw new UnprocessableEntityException('That shift was cancelled.');
      workDate = entry.workDate;
    } else {
      const linked = await this.closer.link({
        orgId: employee.orgId,
        employeeId: employee.id,
        propertyId: employee.workPropertyId,
        at: input.at,
      });
      entry = linked.entry;
      workDate = linked.workDate;
    }
    assertWorking(employee, workDate);

    const open = await this.time.findOpenRecord(employee.id);
    if (open) throw alreadyOpen(open);
    const leave = await this.leave.approvedOn(employee.id, workDate);
    if (leave) {
      throw new ConflictException(
        `${employee.legalName} is on approved ${leave.leaveTypeName.toLowerCase()} on ${workDate}.`,
      );
    }

    try {
      return await this.db.transaction(async (tx) => {
        const created = await this.time.insertRecord(tx, {
          orgId: employee.orgId,
          employeeId: employee.id,
          rosterEntryId: entry?.id ?? null,
          workDate,
          clockInAt: input.at,
          clockOutAt: null,
          source: input.source,
          recordedByUserId: input.userId,
          validated: input.validated,
          validatedByUserId: input.validated ? input.userId : null,
          status: 'open',
          supersedesId: null,
          note: input.note ?? null,
          kioskId: input.kioskId ?? null,
          inLocation: input.location ?? null,
        });
        await writeHrAudit(tx, {
          actorUserId: input.userId,
          subjectType: 'employee',
          subjectId: employee.id,
          eventType: 'hr.clocked_in',
          orgId: employee.orgId,
          diff: {
            attendanceRecordId: created,
            workDate,
            at: input.at.toISOString(),
            source: input.source,
            ...(input.kioskId ? { kioskId: input.kioskId } : {}),
          },
        });
        if (input.within) await input.within(tx, created);
        return created;
      });
    } catch (error) {
      if (violatedConstraint(error) === 'attendance_records_one_open_uk') {
        const raced = await this.time.findOpenRecord(employee.id);
        if (raced) throw alreadyOpen(raced);
      }
      throw error;
    }
  }

  /**
   * Close an open record with its figures (AC-TM7). A phone punch out far from
   * the branch leaves the record for someone to validate (AC-TM9).
   */
  async punchOut(input: {
    record: AttendanceRow;
    at: Date;
    userId: string | null;
    location?: PunchLocation | null;
    validated?: boolean;
    kioskId?: string | null;
    within?: (tx: Tx) => Promise<void>;
  }): Promise<void> {
    const { record } = input;
    if (record.status !== 'open') throw new ConflictException('That record is not open.');
    if (input.at.getTime() <= record.clockInAt.getTime()) {
      throw new UnprocessableEntityException('The clock out must come after the clock in.');
    }
    const figures = await this.closer.figures({
      orgId: record.orgId,
      propertyId: record.workPropertyId,
      rosterEntryId: record.rosterEntryId,
      workDate: record.workDate,
      clockInAt: record.clockInAt,
      clockOutAt: input.at,
    });
    await this.db.transaction(async (tx) => {
      const moved = await this.time.closeRecord(tx, record.id, input.at, figures, {
        outLocation: input.location ?? null,
        validated: input.validated,
      });
      if (!moved) throw new ConflictException('That record was closed a moment ago.');
      await writeHrAudit(tx, {
        actorUserId: input.userId,
        subjectType: 'employee',
        subjectId: record.employeeId,
        eventType: 'hr.clocked_out',
        orgId: record.orgId,
        diff: {
          attendanceRecordId: record.id,
          at: input.at.toISOString(),
          ...(input.kioskId ? { kioskId: input.kioskId } : {}),
        },
      });
      if (input.within) await input.within(tx);
    });
  }

  // --- Helpers -------------------------------------------------------------

  /** Attendance in a month whose pay is confirmed is history (AC-T5, index contract 17). */
  private async assertMonthOpen(orgId: string, dates: readonly string[]): Promise<void> {
    const frozen = await this.employees.latestConfirmedPeriod(orgId);
    if (!frozen) return;
    const frozenThrough = lastOfMonth(monthOf(frozen));
    if (dates.some((d) => d <= frozenThrough)) {
      throw new ConflictException(
        `Pay for ${monthOf(frozen)} is confirmed, so attendance up to then can no longer change. A pay adjustment puts it right.`,
      );
    }
  }

  async presentRecordById(id: string, reader: RecordReader): Promise<AttendanceRecord> {
    const row = await this.time.findRecord(id);
    if (!row) throw new NotFoundException();
    return presentRecord(row, reader);
  }
}

/** A second clock in answers 409 carrying the record that is open (AC-T4). */
function alreadyOpen(open: AttendanceRow): ConflictException {
  return new ConflictException({
    code: 'already_open',
    message: `${open.preferredName?.trim() || open.legalName} is already clocked in since ${open.clockInAt.toISOString()}.`,
    record: presentRecord(open, { figures: false, location: false }),
  });
}

/** A clock time from the request, within the window around now (AC-T4). */
function clockTime(raw: string | undefined): Date {
  const now = Date.now();
  if (!raw) return new Date(now);
  const at = new Date(raw);
  const t = at.getTime();
  if (Number.isNaN(t) || t > now + AHEAD_MS || t < now - BEHIND_MS) {
    throw new UnprocessableEntityException(
      'A clock time can be at most 5 minutes ahead and 7 days behind now. Older fixes are a correction.',
    );
  }
  return at;
}

/** Nobody is rostered or clocked in after they have left (AC-O1). */
export function assertWorking(employee: EmployeeRow, workDate: string): void {
  if (employee.status === 'offboarded' && employee.offboardedOn && workDate > employee.offboardedOn) {
    throw new UnprocessableEntityException(
      `${employee.legalName} left on ${employee.offboardedOn}, so they cannot work on ${workDate}.`,
    );
  }
  if (employee.status === 'offboarded' && !employee.offboardedOn) {
    throw new UnprocessableEntityException(`${employee.legalName} has left.`);
  }
}

export function presentTemplate(row: ShiftTemplateRow): ShiftTemplate {
  return {
    id: row.id,
    propertyId: row.propertyId,
    departmentId: row.departmentId,
    name: row.name,
    startsAt: hhmm(row.startsAt),
    endsAt: hhmm(row.endsAt),
    breakMinutes: row.breakMinutes,
    crossesMidnight: crossesMidnight(row.startsAt, row.endsAt),
    minWorkMinutes: row.minWorkMinutes,
    autoClockOutMinutes: row.autoClockOutMinutes,
    status: row.status,
  };
}

export function presentEntry(row: RosterEntryRow): RosterEntry {
  return {
    id: row.id,
    employee: rosterCard({
      id: row.employeeId,
      preferredName: row.preferredName,
      legalName: row.legalName,
      jobPositionTitle: row.jobPositionTitle,
    }),
    shiftTemplateId: row.shiftTemplateId,
    shiftName: row.shiftName,
    propertyId: row.propertyId,
    departmentId: row.departmentId,
    workDate: row.workDate,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    status: row.status,
    cancelReason: row.cancelReason,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    generated: row.rotationAssignmentId !== null,
    fromRequest: row.shiftRequestId !== null,
  };
}

export function presentPublication(row: PublicationRow): RosterPublication {
  return {
    id: row.id,
    propertyId: row.propertyId,
    departmentId: row.departmentId,
    fromDate: row.fromDate,
    toDate: row.toDate,
    entryCount: row.entryCount,
    publishedAt: row.publishedAt.toISOString(),
    publishedByName: row.publishedByName,
  };
}

/** A record as its reader may see it: figures for the figure audience, distances for whoever validates. */
export function presentRecord(row: AttendanceRow, reader: RecordReader): AttendanceRecord {
  const closed = row.status !== 'open' && row.workedMinutes !== null;
  return {
    id: row.id,
    employee: rosterCard({
      id: row.employeeId,
      preferredName: row.preferredName,
      legalName: row.legalName,
      jobPositionTitle: row.jobPositionTitle,
    }),
    branchId: row.workPropertyId,
    rosterEntryId: row.rosterEntryId,
    workDate: row.workDate,
    clockInAt: row.clockInAt.toISOString(),
    clockOutAt: row.clockOutAt ? row.clockOutAt.toISOString() : null,
    source: row.source,
    validated: row.validated,
    status: row.status,
    supersedesId: row.supersedesId,
    note: row.note,
    autoClosed: row.autoClosed,
    figures:
      reader.figures && closed
        ? {
            lateMinutes: row.lateMinutes,
            earlyMinutes: row.earlyMinutes,
            workedMinutes: row.workedMinutes ?? 0,
            overtimeMinutes: row.overtimeMinutes,
            approvedOvertimeMinutes: row.approvedOvertimeMinutes,
            dayKind: row.dayKind,
          }
        : null,
    location:
      reader.location && (row.inDistanceM !== null || row.outDistanceM !== null || row.source === 'phone')
        ? {
            inDistanceM: row.inDistanceM,
            inAccuracyM: row.inAccuracyM,
            outDistanceM: row.outDistanceM,
            outAccuracyM: row.outAccuracyM,
          }
        : null,
  };
}
