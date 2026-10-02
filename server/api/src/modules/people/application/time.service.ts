import type {
  AttendanceList,
  AttendanceQuery,
  AttendanceRecord,
  CancelRosterEntryRequest,
  ClockInRequest,
  ClockOutRequest,
  CorrectAttendanceRequest,
  CreateRosterEntryRequest,
  CreateShiftTemplateRequest,
  RosterEntry,
  RosterList,
  RosterQuery,
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
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { isCalendarDate } from '../../booking/domain/pricing';
import {
  crossesMidnight,
  daysBetween,
  hhmm,
  kigaliDateOf,
  lastOfMonth,
  monthOf,
  shiftInstants,
} from '../domain/hr-calendar';
import {
  EmployeesRepository,
  violatedConstraint,
  type EmployeeRow,
} from '../infrastructure/employees.repository';
import { writeHrAudit } from '../infrastructure/hr-audit';
import { LeaveRepository } from '../infrastructure/leave.repository';
import {
  TimeRepository,
  type AttendanceRow,
  type RosterEntryRow,
  type ShiftTemplateRow,
} from '../infrastructure/time.repository';
import { rosterCard } from './employee-presenter';
import { assertBranchInReach, assertPersonInReach, orgOf } from './hr-access';

/** How far a clock time may sit from the server's own (AC-T4). */
const AHEAD_MS = 5 * 60_000;
const BEHIND_MS = 7 * 86_400_000;

/**
 * Shift templates, the roster and attendance (ADR-058, first thread).
 *
 * What a roster or attendance read carries of a person is the roster card and
 * nothing more, because `attendance.record` is held by the front desk.
 */
@Injectable()
export class TimeService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly employees: EmployeesRepository,
    private readonly time: TimeRepository,
    private readonly leave: LeaveRepository,
  ) {}

  // --- Shift templates -----------------------------------------------------

  async listTemplates(ws: ScopedWorkspace, query: ShiftTemplateQuery): Promise<ShiftTemplateList> {
    const rows = await this.time.listTemplates(orgOf(ws), ws.branchScope, query.propertyId);
    return { templates: rows.map(presentTemplate) };
  }

  /** `POST /ops/shift-templates` (AC-T1). */
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

  /** `GET /ops/roster`, at most 31 days. */
  async listRoster(ws: ScopedWorkspace, query: RosterQuery): Promise<RosterList> {
    if (!isCalendarDate(query.from) || !isCalendarDate(query.to)) {
      throw new UnprocessableEntityException('Those are not real dates.');
    }
    const span = daysBetween(query.from, query.to);
    if (span < 0 || span > 30) {
      throw new UnprocessableEntityException('A roster read covers 1 to 31 days.');
    }
    const rows = await this.time.listRoster({
      orgId: orgOf(ws),
      scope: ws.branchScope,
      from: query.from,
      to: query.to,
      propertyId: query.propertyId,
    });
    return { entries: rows.map(presentEntry) };
  }

  /** `POST /ops/roster` (AC-T1 to AC-T3). */
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
        });
        await writeHrAudit(tx, {
          actorUserId: userId,
          subjectType: 'employee',
          subjectId: employee.id,
          eventType: 'hr.rostered',
          orgId,
          diff: { rosterEntryId: created, shiftTemplateId: template.id, workDate: body.workDate },
        });
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

  /** `POST /ops/roster/:id/cancel`. */
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
    });
    const updated = await this.time.findEntry(id);
    if (!updated) throw new NotFoundException();
    return presentEntry(updated);
  }

  // --- Attendance ----------------------------------------------------------

  /** `GET /ops/attendance`: a day's sheet, plus anything still open. */
  async listAttendance(ws: ScopedWorkspace, query: AttendanceQuery): Promise<AttendanceList> {
    if (!isCalendarDate(query.date)) throw new UnprocessableEntityException('That is not a real date.');
    const rows = await this.time.listAttendance({
      orgId: orgOf(ws),
      scope: ws.branchScope,
      date: query.date,
      propertyId: query.propertyId,
    });
    return { records: rows.map(presentRecord) };
  }

  /** `POST /ops/attendance/clock-in` (AC-T4). */
  async clockIn(ws: ScopedWorkspace, userId: string, body: ClockInRequest): Promise<AttendanceRecord> {
    const orgId = orgOf(ws);
    const employee = assertOwnedByOrg(await this.employees.find(body.employeeId), ws);
    assertPersonInReach(ws, employee.workPropertyId);
    const at = clockTime(body.at);

    let entry: RosterEntryRow | null = null;
    if (body.rosterEntryId) {
      entry = await this.time.findEntry(body.rosterEntryId);
      if (!entry || entry.orgId !== orgId || entry.employeeId !== employee.id) {
        throw new UnprocessableEntityException('That shift is not this person\'s.');
      }
      if (entry.status !== 'scheduled') {
        throw new UnprocessableEntityException('That shift was cancelled.');
      }
    }
    const workDate = entry ? entry.workDate : kigaliDateOf(at);
    assertWorking(employee, workDate);

    const open = await this.time.findOpenRecord(employee.id);
    if (open) throw this.alreadyOpen(open);
    const leave = await this.leave.approvedOn(employee.id, workDate);
    if (leave) {
      throw new ConflictException(
        `${employee.legalName} is on approved ${leave.leaveTypeName.toLowerCase()} on ${workDate}.`,
      );
    }

    let id: string;
    try {
      id = await this.db.transaction(async (tx) => {
        const created = await this.time.insertRecord(tx, {
          orgId,
          employeeId: employee.id,
          rosterEntryId: entry?.id ?? null,
          workDate,
          clockInAt: at,
          clockOutAt: null,
          source: 'supervisor',
          recordedByUserId: userId,
          // A supervisor's record is validated as it is written (AC-T4).
          validated: true,
          validatedByUserId: userId,
          status: 'open',
          supersedesId: null,
          note: null,
        });
        await writeHrAudit(tx, {
          actorUserId: userId,
          subjectType: 'employee',
          subjectId: employee.id,
          eventType: 'hr.clocked_in',
          orgId,
          diff: { attendanceRecordId: created, workDate, at: at.toISOString() },
        });
        return created;
      });
    } catch (error) {
      if (violatedConstraint(error) === 'attendance_records_one_open_uk') {
        const raced = await this.time.findOpenRecord(employee.id);
        if (raced) throw this.alreadyOpen(raced);
      }
      throw error;
    }
    return this.presentRecordById(id);
  }

  /** `POST /ops/attendance/:id/clock-out`. */
  async clockOut(ws: ScopedWorkspace, userId: string, id: string, body: ClockOutRequest): Promise<AttendanceRecord> {
    const orgId = orgOf(ws);
    const record = assertOwnedByOrg(await this.time.findRecord(id), ws);
    assertPersonInReach(ws, record.workPropertyId);
    if (record.status !== 'open') throw new ConflictException('That record is not open.');
    const at = clockTime(body.at);
    if (at.getTime() <= record.clockInAt.getTime()) {
      throw new UnprocessableEntityException('The clock out must come after the clock in.');
    }
    await this.db.transaction(async (tx) => {
      const moved = await this.time.closeRecord(tx, record.id, at);
      if (!moved) throw new ConflictException('That record was closed a moment ago.');
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'employee',
        subjectId: record.employeeId,
        eventType: 'hr.clocked_out',
        orgId,
        diff: { attendanceRecordId: record.id, at: at.toISOString() },
      });
    });
    return this.presentRecordById(record.id);
  }

  /**
   * `POST /ops/attendance/:id/correct` (AC-T5). A new closed record points at
   * the original, which becomes `superseded`; the original's times never
   * change.
   */
  async correct(ws: ScopedWorkspace, userId: string, id: string, body: CorrectAttendanceRequest): Promise<AttendanceRecord> {
    const orgId = orgOf(ws);
    const original = assertOwnedByOrg(await this.time.findRecord(id), ws);
    assertPersonInReach(ws, original.workPropertyId);
    if (original.status === 'superseded') {
      throw new ConflictException('That record was already corrected. Correct the newer one.');
    }
    const clockInAt = new Date(body.clockInAt);
    const clockOutAt = new Date(body.clockOutAt);
    if (clockOutAt.getTime() <= clockInAt.getTime()) {
      throw new UnprocessableEntityException('The clock out must come after the clock in.');
    }
    const workDate = original.rosterEntryId ? original.workDate : kigaliDateOf(clockInAt);
    const frozen = await this.employees.latestConfirmedPeriod(orgId);
    if (frozen) {
      const frozenThrough = lastOfMonth(monthOf(frozen));
      if (original.workDate <= frozenThrough || workDate <= frozenThrough) {
        throw new ConflictException(
          `Pay for ${monthOf(frozen)} is confirmed, so attendance up to then can no longer change.`,
        );
      }
    }
    let newId: string;
    try {
      newId = await this.db.transaction(async (tx) => {
        const moved = await this.time.supersede(tx, original.id);
        if (!moved) throw new ConflictException('That record was corrected a moment ago.');
        const created = await this.time.insertRecord(tx, {
          orgId,
          employeeId: original.employeeId,
          rosterEntryId: original.rosterEntryId,
          workDate,
          clockInAt,
          clockOutAt,
          source: 'supervisor',
          recordedByUserId: userId,
          validated: true,
          validatedByUserId: userId,
          status: 'closed',
          supersedesId: original.id,
          note: body.note.trim(),
        });
        await writeHrAudit(tx, {
          actorUserId: userId,
          subjectType: 'employee',
          subjectId: original.employeeId,
          eventType: 'hr.attendance_corrected',
          orgId,
          diff: { attendanceRecordId: created, supersedes: original.id },
          reason: body.note.trim(),
        });
        return created;
      });
    } catch (error) {
      if (violatedConstraint(error) === 'attendance_records_supersedes_uk') {
        throw new ConflictException('That record was corrected a moment ago.');
      }
      throw error;
    }
    return this.presentRecordById(newId);
  }

  /** `POST /ops/attendance/:id/validate`: approve a self clock in. */
  async validate(ws: ScopedWorkspace, userId: string, id: string): Promise<AttendanceRecord> {
    const orgId = orgOf(ws);
    const record = assertOwnedByOrg(await this.time.findRecord(id), ws);
    assertPersonInReach(ws, record.workPropertyId);
    await this.db.transaction(async (tx) => {
      const moved = await this.time.validate(tx, record.id, userId);
      if (!moved) {
        throw new ConflictException('Only a self clock in that nobody has validated yet can be validated.');
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
    return this.presentRecordById(record.id);
  }

  // --- Helpers -------------------------------------------------------------

  /** A second clock in answers 409 carrying the record that is open (AC-T4). */
  private alreadyOpen(open: AttendanceRow): ConflictException {
    return new ConflictException({
      code: 'already_open',
      message: `${open.preferredName?.trim() || open.legalName} is already clocked in since ${open.clockInAt.toISOString()}.`,
      record: presentRecord(open),
    });
  }

  private async presentRecordById(id: string): Promise<AttendanceRecord> {
    const row = await this.time.findRecord(id);
    if (!row) throw new NotFoundException();
    return presentRecord(row);
  }
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
function assertWorking(employee: EmployeeRow, workDate: string): void {
  if (employee.status === 'offboarded' && employee.offboardedOn && workDate > employee.offboardedOn) {
    throw new UnprocessableEntityException(
      `${employee.legalName} left on ${employee.offboardedOn}, so they cannot work on ${workDate}.`,
    );
  }
  if (employee.status === 'offboarded' && !employee.offboardedOn) {
    throw new UnprocessableEntityException(`${employee.legalName} has left.`);
  }
}

function presentTemplate(row: ShiftTemplateRow): ShiftTemplate {
  return {
    id: row.id,
    propertyId: row.propertyId,
    departmentId: row.departmentId,
    name: row.name,
    startsAt: hhmm(row.startsAt),
    endsAt: hhmm(row.endsAt),
    breakMinutes: row.breakMinutes,
    crossesMidnight: crossesMidnight(row.startsAt, row.endsAt),
    status: row.status,
  };
}

function presentEntry(row: RosterEntryRow): RosterEntry {
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
  };
}

function presentRecord(row: AttendanceRow): AttendanceRecord {
  return {
    id: row.id,
    employee: rosterCard({
      id: row.employeeId,
      preferredName: row.preferredName,
      legalName: row.legalName,
      jobPositionTitle: row.jobPositionTitle,
    }),
    rosterEntryId: row.rosterEntryId,
    workDate: row.workDate,
    clockInAt: row.clockInAt.toISOString(),
    clockOutAt: row.clockOutAt ? row.clockOutAt.toISOString() : null,
    source: row.source,
    validated: row.validated,
    status: row.status,
    supersedesId: row.supersedesId,
    note: row.note,
  };
}

