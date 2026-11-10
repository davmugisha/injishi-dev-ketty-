import type {
  AttendancePendingReason,
  AttendanceRequest,
  ChangeMyKioskPinRequest,
  CreateMyAttendanceRequestRequest,
  CreateMyShiftRequestRequest,
  KioskPinState,
  MyAttendance,
  MyAttendanceRequestList,
  MyClock,
  MyMonthlySummary,
  MyRoster,
  MyShiftOptions,
  MyShiftRequestList,
  MyTeam,
  MyTeamAttendance,
  MyTeamRequests,
  MyTeamRoster,
  MyWorkFileList,
  MyWorkToday,
  PhoneClockRequest,
  PhoneClockResult,
  RangeQuery,
  RosterCard,
  ShiftRequest,
  TeamRequestsQuery,
} from '@injishi/contracts';
import { ConflictException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { resolveReportedTime, type ResolvedTime } from '../../../shared/time/reported-time';
import { isCalendarDate } from '../../pms/domain/pricing';
import { addDays, firstOfMonth, kigaliToday, lastOfMonth, monthOf } from '../domain/hr-calendar';
import {
  clockInOpensAt,
  kigaliClock,
  phonePunchVerdict,
  punchPendingReasons,
  selfPunchDecision,
  takesLateClockOut,
  type ClockMode,
  type PunchVerdict,
} from '../domain/time-rules';
import { EmployeesRepository, type EmployeeRow } from '../infrastructure/employees.repository';
import { writeHrAudit } from '../infrastructure/hr-audit';
import { writeHrEvent } from '../infrastructure/hr-events';
import { MyWorkRepository } from '../infrastructure/my-work.repository';
import { TimeRequestsRepository } from '../infrastructure/time-requests.repository';
import {
  TimeRepository,
  type PunchArrival,
  type PunchLocation,
  type RosterEntryRow,
} from '../infrastructure/time.repository';
import { TimeSettingsRepository } from '../infrastructure/time-settings.repository';
import { AttendanceInsightsService } from './attendance-insights.service';
import { displayNameOf, rosterCard } from './employee-presenter';
import { KioskService } from './kiosk.service';
import { MyLeaveService } from './my-leave.service';
import { RotationService } from './rotation.service';
import { presentAttendance, presentShift, TimeRequestsService, type RequestActor } from './time-requests.service';
import { presentEntry, presentRecord, presentTemplate, TimeService, type RecordReader } from './time.service';

/** A person reads their own figures; a manager their reports' (index contract 7). Distances stay with validators. */
const OWN_READER: RecordReader = { figures: true, location: false };

/** The shift card's window either side of now, so a night shift that crossed midnight stays on it (mobile spec 0003). */
const TODAY_WINDOW_MS = 2 * 3_600_000;

/** A late punch's reason in words, for `PhoneClockResult.pendingReason`. */
const LATE_SYNC_WORDS = 'It reached Injishi more than 30 minutes after the tap.';

/**
 * Self service for time (ADR-058, 058-self-service, the routes marked 4):
 * `GET /me/work`, phone clock in and out, the published roster, shift and
 * attendance requests, the person's own month, their kiosk PIN, and a
 * reporting manager's `team` reads.
 *
 * Ownership is the guard (index contract 10): every route names a file, and a
 * file that is not the caller's answers 404 before anything else is read. A
 * file the person has left stays readable and refuses every write (409).
 * Nothing here decides a request: a manager who holds the module's permission
 * decides on the operator side.
 */
@Injectable()
export class MyWorkService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly work: MyWorkRepository,
    private readonly employees: EmployeesRepository,
    private readonly time: TimeRepository,
    private readonly settings: TimeSettingsRepository,
    private readonly timeService: TimeService,
    private readonly requests: TimeRequestsRepository,
    private readonly requestsService: TimeRequestsService,
    private readonly insights: AttendanceInsightsService,
    private readonly kiosk: KioskService,
    private readonly myLeave: MyLeaveService,
    private readonly rotationService: RotationService,
  ) {}

  // --- Files (AC-SS1) --------------------------------------------------------------

  async files(userId: string): Promise<MyWorkFileList> {
    const rows = await this.work.filesOf(userId);
    const open = await this.work.openRecords(rows.map((r) => r.employeeId));
    return {
      files: rows.map((r) => {
        const record = open.get(r.employeeId);
        return {
          employeeId: r.employeeId,
          orgId: r.orgId,
          businessName: r.businessName,
          displayName: displayNameOf(r),
          employeeNumber: r.employeeNumber,
          branchName: r.branchName,
          jobPositionTitle: r.jobPositionTitle,
          status: r.status,
          hasReports: r.hasReports,
          openRecord: record ? { id: record.id, clockInAt: record.clockInAt.toISOString() } : null,
        };
      }),
    };
  }

  // --- Phone clock in and out (058-time AC-TM9, AC-SS3; mobile spec 0003) ---------------------

  /**
   * `GET /me/work/:employeeId/clock`: the clock-in card. How the person's branch
   * clocks in, whether they are in, and the shift a clock-in now would belong to.
   */
  async clock(userId: string, employeeId: string): Promise<MyClock> {
    const employee = await this.mine(userId, employeeId);
    const now = new Date();
    const [rules, open, shift] = await Promise.all([
      this.settings.clockRulesFor(employee.workPropertyId),
      this.time.findOpenRecord(employee.id),
      this.shiftAround(employee.id, now),
    ]);
    const opens = clockInOpensAt({ at: now, shiftStartsAt: shift?.startsAt ?? null, opensMinutesBefore: rules.opensMinutesBefore });
    return {
      branchName: rules.branchName,
      clockMode: rules.clockMode,
      open: open ? { id: open.id, clockInAt: open.clockInAt.toISOString(), validated: open.validated } : null,
      shift: shift ? { startsAt: shift.startsAt.toISOString(), endsAt: shift.endsAt.toISOString() } : null,
      opensAt: opens ? opens.toISOString() : null,
    };
  }

  /**
   * A clock in from the person's phone at the tap time (mobile spec 0003, cross
   * child contract 1), by the branch's clock-in rules: where the phone is, a
   * code scanned off the entrance tablet, and how early before the shift. The
   * reported time is corrected for the phone's clock and flagged `late_sync`
   * when it arrived more than 30 minutes after the tap. A refusal for being away
   * from work is kept, for HR's monthly count of who clocks in far from work. A
   * second clock in is `409 already_open` carrying the open record, which an
   * offline phone reads as "already clocked in".
   */
  async clockIn(userId: string, employeeId: string, body: PhoneClockRequest, receivedAt: Date): Promise<PhoneClockResult> {
    const employee = await this.mineActive(userId, employeeId);
    const time = resolveReportedTime(body, receivedAt);
    const rules = await this.settings.clockRulesFor(employee.workPropertyId);
    // A code is good for seconds, so it is read against when it reached us: a tap
    // reported from earlier cannot make an old code fresh.
    const scan = body.code ? await this.kiosk.scanned(body.code, employee, receivedAt.getTime()) : null;
    const fix = this.fix(rules, body);
    const decision = selfPunchDecision({ mode: rules.clockMode, direction: 'in', scanned: scan !== null, verdict: fix.verdict });
    if (!decision.allow) {
      await this.refused(userId, employee, rules.clockMode, decision.reason, decision.far, fix.verdict);
      throw new UnprocessableEntityException({ code: decision.far ? 'clock_far' : 'clock_refused', message: decision.reason });
    }
    let placed = decision.validated;
    let words = decision.reason;
    if (rules.opensMinutesBefore !== null) {
      const shift = await this.shiftAround(employee.id, time.at);
      const opens = clockInOpensAt({ at: time.at, shiftStartsAt: shift?.startsAt ?? null, opensMinutesBefore: rules.opensMinutesBefore });
      if (shift && opens) {
        throw new UnprocessableEntityException({
          code: 'clock_early',
          message: `Your shift starts at ${kigaliClock(shift.startsAt)}. You can clock in from ${kigaliClock(opens)}.`,
        });
      }
      if (!shift) {
        placed = false;
        words = words ?? 'No shift on the roster now.';
      }
    }
    // The location's reason stays when the rules left the punch for HR; a scan that vouched for it keeps none.
    const reasons = punchPendingReasons({ location: placed ? null : fix.verdict.code, lateSync: time.lateSync });
    const validated = placed && reasons.length === 0;
    const id = await this.timeService.punchIn({
      employee,
      at: time.at,
      source: 'phone',
      userId,
      validated,
      location: fix.location,
      kioskId: scan?.kioskId ?? null,
      arrival: arrivalOf(time, reasons),
      within: validated
        ? undefined
        : async (tx, recordId) => {
            await writeHrEvent(tx, {
              trigger: 'attendance.flagged',
              aggregateType: 'attendance_record',
              aggregateId: recordId,
              change: 'in',
              workspaceId: await this.work.workspaceOf(employee.orgId),
              payload: { attendanceRecordId: recordId, employeeId: employee.id, reasons },
            });
          },
    });
    const record = await this.timeService.presentRecordById(id, OWN_READER);
    return {
      record,
      validated: record.validated,
      pendingReason: validated ? null : reasonWords(words, reasons),
      distanceM: fix.verdict.distanceM,
    };
  }

  /**
   * A phone clock out at the tap time. It is never refused: a doubtful one waits
   * for HR instead (see `selfPunchDecision`). With nothing open it is `409
   * not_clocked_in`, except a tap made before the sweep closed the record on its
   * own, which replaces the sweep's end time (D-ap, AC-7).
   */
  async clockOut(userId: string, employeeId: string, body: PhoneClockRequest, receivedAt: Date): Promise<PhoneClockResult> {
    const employee = await this.mineActive(userId, employeeId);
    const time = resolveReportedTime(body, receivedAt);
    const rules = await this.settings.clockRulesFor(employee.workPropertyId);
    const open = await this.time.findOpenRecord(employee.id);
    if (!open) return this.lateClockOut(userId, employee, rules, body, time);
    const scan = body.code ? await this.kiosk.scanned(body.code, employee, receivedAt.getTime()) : null;
    const fix = this.fix(rules, body);
    const decision = selfPunchDecision({ mode: rules.clockMode, direction: 'out', scanned: scan !== null, verdict: fix.verdict });
    const placed = decision.allow && decision.validated;
    const reasons = punchPendingReasons({ location: placed ? null : fix.verdict.code, lateSync: time.lateSync });
    const flagged = !placed || reasons.length > 0;
    const workspaceId = flagged ? await this.work.workspaceOf(employee.orgId) : null;
    await this.timeService.punchOut({
      record: open,
      at: time.at,
      userId,
      location: fix.location,
      kioskId: scan?.kioskId ?? null,
      arrival: arrivalOf(time, reasons),
      // A clock out far from the branch, or late, takes the record back to the
      // queue; a good one never vouches for a clock in that was not.
      validated: flagged ? false : undefined,
      within: flagged
        ? async (tx) => {
            await writeHrEvent(tx, {
              trigger: 'attendance.flagged',
              aggregateType: 'attendance_record',
              aggregateId: open.id,
              change: 'out',
              workspaceId,
              payload: { attendanceRecordId: open.id, employeeId: employee.id, reasons },
            });
          }
        : undefined,
    });
    const record = await this.timeService.presentRecordById(open.id, OWN_READER);
    const words = placed ? null : decision.allow ? decision.reason : null;
    return {
      record,
      validated: record.validated,
      pendingReason: record.validated ? null : (reasonWords(words, reasons) ?? 'Your clock in is waiting to be validated.'),
      distanceM: fix.verdict.distanceM,
    };
  }

  /** Nothing open: the sweep's record takes the tap when the tap came first, else `409 not_clocked_in`. */
  private async lateClockOut(
    userId: string,
    employee: EmployeeRow,
    rules: { radiusM: number; centre: { lat: number; lng: number } | null },
    body: PhoneClockRequest,
    time: ResolvedTime,
  ): Promise<PhoneClockResult> {
    const last = await this.time.latestRecord(employee.id);
    if (!last || !takesLateClockOut(last, time.at)) {
      throw new ConflictException({ code: 'not_clocked_in', message: 'You are not clocked in.' });
    }
    const fix = this.fix(rules, body);
    // Late by definition: the sweep ran between the tap and its arrival.
    const reasons = punchPendingReasons({ location: fix.verdict.code, lateSync: true });
    const workspaceId = await this.work.workspaceOf(employee.orgId);
    await this.timeService.recloseAutoClosed({
      record: last,
      at: time.at,
      userId,
      location: fix.location,
      arrival: arrivalOf(time, reasons),
      within: async (tx) => {
        await writeHrEvent(tx, {
          trigger: 'attendance.flagged',
          aggregateType: 'attendance_record',
          aggregateId: last.id,
          change: 'reclosed',
          workspaceId,
          payload: { attendanceRecordId: last.id, employeeId: employee.id, reasons },
        });
      },
    });
    const record = await this.timeService.presentRecordById(last.id, OWN_READER);
    return {
      record,
      validated: false,
      pendingReason: reasonWords(fix.verdict.reason, reasons),
      distanceM: fix.verdict.distanceM,
    };
  }

  /**
   * The phone's shift card in one read (mobile spec 0003, D-u, AC-2): the
   * published shifts of today's Kigali date and any that overlap the two hours
   * either side of now, the open record's own shift, the open record, and the
   * day's last clock out.
   */
  async today(userId: string, employeeId: string): Promise<MyWorkToday> {
    const employee = await this.mine(userId, employeeId);
    const now = new Date();
    const workDate = kigaliToday(now);
    const [open, entries, records] = await Promise.all([
      this.time.findOpenRecord(employee.id),
      this.time.personEntries({
        employeeIds: [employee.id],
        from: addDays(workDate, -1),
        to: addDays(workDate, 1),
        publishedOnly: true,
      }),
      this.time.personRecords({ employeeIds: [employee.id], from: workDate, to: workDate }),
    ]);
    const from = now.getTime() - TODAY_WINDOW_MS;
    const to = now.getTime() + TODAY_WINDOW_MS;
    const shifts = entries.filter(
      (e) =>
        e.id === open?.rosterEntryId ||
        (e.status === 'scheduled' &&
          (e.workDate === workDate || (e.startsAt.getTime() < to && e.endsAt.getTime() > from))),
    );
    if (open?.rosterEntryId && !shifts.some((e) => e.id === open.rosterEntryId)) {
      const own = await this.time.findEntry(open.rosterEntryId);
      if (own) shifts.push(own);
    }
    shifts.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    let lastClockOut: Date | null = null;
    for (const r of records) {
      if (r.status === 'closed' && r.clockOutAt && (!lastClockOut || r.clockOutAt > lastClockOut)) lastClockOut = r.clockOutAt;
    }
    return {
      employeeId: employee.id,
      workDate,
      generatedAt: now.toISOString(),
      shifts: shifts.map(presentTodayShift),
      openRecord: open
        ? {
            id: open.id,
            rosterEntryId: open.rosterEntryId,
            workDate: open.workDate,
            clockInAt: open.clockInAt.toISOString(),
            validated: open.validated,
            pendingReason: open.inPendingReason,
          }
        : null,
      // Breaks are recorded from milestone 3.
      openBreak: null,
      lastClockOutAt: lastClockOut ? lastClockOut.toISOString() : null,
    };
  }

  // --- Roster and shift requests (AC-SS4) ----------------------------------------------------

  async roster(userId: string, employeeId: string, query: RangeQuery): Promise<MyRoster> {
    const employee = await this.mine(userId, employeeId);
    assertRange(query);
    const entries = await this.time.personEntries({ employeeIds: [employee.id], from: query.from, to: query.to, publishedOnly: true });
    return { from: query.from, to: query.to, entries: entries.map(presentEntry) };
  }

  async shiftRequests(userId: string, employeeId: string): Promise<MyShiftRequestList> {
    const employee = await this.mine(userId, employeeId);
    const { mine, askedOfMe, answered } = await this.requests.shiftsOf(employee.id);
    return {
      mine: mine.map((r) => presentShift(r, employee.id)),
      askedOfMe: askedOfMe.map((r) => presentShift(r, employee.id)),
      answered: answered.map((r) => presentShift(r, employee.id)),
    };
  }

  /**
   * What a request of the person's own may name (AC-TM5): the active shifts of
   * their branch and the colleagues there, which are exactly what
   * `createShift` accepts. Somebody with no branch on file has nothing to ask.
   */
  async shiftOptions(userId: string, employeeId: string): Promise<MyShiftOptions> {
    const employee = await this.mine(userId, employeeId);
    const propertyId = employee.workPropertyId;
    if (!propertyId) return { shifts: [], colleagues: [], rotations: [], currentRotation: null };
    const [shifts, colleagues, rotation] = await Promise.all([
      this.time.listTemplates(
        employee.orgId,
        { coverage: 'limited', selectedPropertyId: null, propertyIds: [propertyId], includesUnbranched: false },
        propertyId,
      ),
      this.work.colleaguesAt(employee.orgId, propertyId, employee.id),
      this.rotationService.forPerson(employee.orgId, propertyId, employee.id),
    ]);
    return { shifts: shifts.map(presentTemplate), colleagues: colleagues.map(rosterCard), ...rotation };
  }

  async createShiftRequest(userId: string, employeeId: string, body: CreateMyShiftRequestRequest): Promise<ShiftRequest> {
    const employee = await this.mineActive(userId, employeeId);
    const id = await this.requestsService.createShift(await this.actor(userId, employee), employee, body);
    return this.requestsService.shiftById(id, employee.id);
  }

  async cancelShiftRequest(userId: string, employeeId: string, id: string): Promise<ShiftRequest> {
    const employee = await this.mineActive(userId, employeeId);
    await this.requestsService.cancelShift(await this.actor(userId, employee), id, employee.id);
    return this.requestsService.shiftById(id, employee.id);
  }

  async acceptSwap(userId: string, employeeId: string, id: string): Promise<ShiftRequest> {
    const employee = await this.mineActive(userId, employeeId);
    await this.requestsService.acceptSwap(await this.actor(userId, employee), id, { colleagueId: employee.id });
    return this.requestsService.shiftById(id, employee.id);
  }

  async declineSwap(userId: string, employeeId: string, id: string): Promise<ShiftRequest> {
    const employee = await this.mineActive(userId, employeeId);
    await this.requestsService.declineSwap(await this.actor(userId, employee), id, employee.id);
    return this.requestsService.shiftById(id, employee.id);
  }

  // --- Attendance (AC-SS5) -------------------------------------------------------------

  async attendance(userId: string, employeeId: string, query: RangeQuery): Promise<MyAttendance> {
    const employee = await this.mine(userId, employeeId);
    assertRange(query);
    const [records, requests] = await Promise.all([
      this.time.personRecords({ employeeIds: [employee.id], from: query.from, to: query.to }),
      this.requests.attendanceOf(employee.id, query.from, query.to),
    ]);
    return {
      from: query.from,
      to: query.to,
      records: records.map((r) => presentRecord(r, OWN_READER)),
      requests: requests.map((r) => presentAttendance(r, employee.id)),
    };
  }

  async attendanceRequests(userId: string, employeeId: string, query: RangeQuery): Promise<MyAttendanceRequestList> {
    const employee = await this.mine(userId, employeeId);
    assertRange(query);
    const rows = await this.requests.attendanceOf(employee.id, query.from, query.to);
    return { requests: rows.map((r) => presentAttendance(r, employee.id)) };
  }

  async createAttendanceRequest(userId: string, employeeId: string, body: CreateMyAttendanceRequestRequest): Promise<AttendanceRequest> {
    const employee = await this.mineActive(userId, employeeId);
    const id = await this.requestsService.createAttendance(await this.actor(userId, employee), employee, body);
    return this.requestsService.attendanceById(id, employee.id);
  }

  async cancelAttendanceRequest(userId: string, employeeId: string, id: string): Promise<AttendanceRequest> {
    const employee = await this.mineActive(userId, employeeId);
    await this.requestsService.cancelAttendance(await this.actor(userId, employee), id, employee.id);
    return this.requestsService.attendanceById(id, employee.id);
  }

  async summary(userId: string, employeeId: string, month: string): Promise<MyMonthlySummary> {
    const employee = await this.mine(userId, employeeId);
    return { month, summary: await this.insights.monthOf(employee.orgId, employee.id, month) };
  }

  // --- Kiosk PIN (058-time AC-TM11, AC-SS10) -----------------------------------------------------

  async pinState(userId: string, employeeId: string): Promise<KioskPinState> {
    const employee = await this.mine(userId, employeeId);
    return this.kiosk.ownPinState(employee.id);
  }

  async checkPin(userId: string, employeeId: string, pin: string): Promise<{ ok: true }> {
    const employee = await this.mineActive(userId, employeeId);
    return this.kiosk.checkMyPin(employee, pin);
  }

  async changePin(userId: string, employeeId: string, body: ChangeMyKioskPinRequest): Promise<KioskPinState> {
    const employee = await this.mineActive(userId, employeeId);
    return this.kiosk.changeMyPin(employee, userId, body);
  }

  // --- A reporting manager's team (AC-SS15) ---------------------------------------------------

  async team(userId: string, employeeId: string): Promise<MyTeam> {
    const manager = await this.mine(userId, employeeId);
    return { reports: (await this.work.directReports(manager.id)).map(rosterCard) };
  }

  async teamRoster(userId: string, employeeId: string, query: RangeQuery): Promise<MyTeamRoster> {
    const manager = await this.mine(userId, employeeId);
    assertRange(query);
    const reports = await this.work.directReports(manager.id);
    const entries = await this.time.personEntries({
      employeeIds: reports.map((r) => r.id),
      from: query.from,
      to: query.to,
      publishedOnly: true,
    });
    return { from: query.from, to: query.to, entries: entries.map(presentEntry) };
  }

  /** Records of every direct report; with each report's month when the range is exactly one month. */
  async teamAttendance(userId: string, employeeId: string, query: RangeQuery): Promise<MyTeamAttendance> {
    const manager = await this.mine(userId, employeeId);
    assertRange(query);
    const reports = await this.work.directReports(manager.id);
    const ids = reports.map((r) => r.id);
    const records = await this.time.personRecords({ employeeIds: ids, from: query.from, to: query.to });
    const month = monthOf(query.from);
    const wholeMonth = query.from === firstOfMonth(month) && query.to === lastOfMonth(month);
    const cards: RosterCard[] = reports.map(rosterCard);
    return {
      from: query.from,
      to: query.to,
      records: records.map((r) => presentRecord(r, OWN_READER)),
      summaries: wholeMonth ? await this.insights.monthsOf(manager.orgId, ids, month, cards) : [],
    };
  }

  /** Requests routed to the manager's file when they were asked, whatever their state. Nothing here decides. */
  async teamRequests(userId: string, employeeId: string, query: TeamRequestsQuery): Promise<MyTeamRequests> {
    const manager = await this.mine(userId, employeeId);
    const wantShift = !query.kind || query.kind === 'shift' || query.kind === 'swap';
    const wantAttendance = !query.kind || query.kind === 'attendance';
    const wantLeave = !query.kind || query.kind === 'leave';
    const wantAllocation = !query.kind || query.kind === 'allocation';
    const [shift, attendance, leave, allocation] = await Promise.all([
      wantShift ? this.requests.shiftsRoutedTo(manager.id) : Promise.resolve([]),
      wantAttendance ? this.requests.attendanceRoutedTo(manager.id) : Promise.resolve([]),
      wantLeave ? this.myLeave.teamLeaveRows(manager.id) : Promise.resolve([]),
      wantAllocation ? this.myLeave.teamAllocationRows(manager.id) : Promise.resolve([]),
    ]);
    const kindOk = (k: ShiftRequest['kind']): boolean =>
      !query.kind || query.kind === 'attendance' || (query.kind === 'swap' ? k === 'swap' : k !== 'swap');
    const statusOk = (s: string): boolean => !query.status || s === query.status;
    return {
      shift: shift.filter((r) => kindOk(r.kind) && statusOk(r.status)).map((r) => presentShift(r, manager.id)),
      attendance: attendance.filter((r) => statusOk(r.status)).map((r) => presentAttendance(r, manager.id)),
      leave: leave.filter((r) => statusOk(r.status)),
      allocation: allocation.filter((r) => statusOk(r.status)),
    };
  }

  async teamShiftRequest(userId: string, employeeId: string, id: string): Promise<ShiftRequest> {
    const manager = await this.mine(userId, employeeId);
    const row = await this.requests.findShift(id);
    if (!row || row.routedToEmployeeId !== manager.id) throw new NotFoundException();
    return presentShift(row, manager.id);
  }

  async teamAttendanceRequest(userId: string, employeeId: string, id: string): Promise<AttendanceRequest> {
    const manager = await this.mine(userId, employeeId);
    const row = await this.requests.findAttendance(id);
    if (!row || row.routedToEmployeeId !== manager.id) throw new NotFoundException();
    return presentAttendance(row, manager.id);
  }

  // --- Ownership ----------------------------------------------------------------

  /** The caller's file, or 404: a probe for any other id learns nothing (index contract 10). */
  private async mine(userId: string, employeeId: string): Promise<EmployeeRow> {
    if (!(await this.work.owned(userId, employeeId))) throw new NotFoundException();
    const employee = await this.employees.find(employeeId);
    if (!employee) throw new NotFoundException();
    return employee;
  }

  /** A write needs the file active (AC-S1). */
  private async mineActive(userId: string, employeeId: string): Promise<EmployeeRow> {
    const employee = await this.mine(userId, employeeId);
    if (employee.status !== 'active') {
      throw new ConflictException({ code: 'employee_left', message: 'You no longer work here, so this file is read only.' });
    }
    return employee;
  }

  private async actor(userId: string, employee: EmployeeRow): Promise<RequestActor> {
    return { orgId: employee.orgId, workspaceId: await this.work.workspaceOf(employee.orgId), userId };
  }

  /** Where the phone says it is, measured against the branch (AC-TM9). The rules decide what it comes to. */
  private fix(
    rules: { radiusM: number; centre: { lat: number; lng: number } | null },
    body: PhoneClockRequest,
  ): { verdict: PunchVerdict; location: PunchLocation } {
    const point =
      body.lat !== undefined && body.lng !== undefined ? { lat: body.lat, lng: body.lng, accuracyM: body.accuracyM ?? null } : null;
    const verdict = phonePunchVerdict({ point, branch: rules.centre, radiusM: rules.radiusM });
    return {
      verdict,
      location: {
        latitude: point?.lat ?? null,
        longitude: point?.lng ?? null,
        accuracyM: point?.accuracyM === null || point?.accuracyM === undefined ? null : Math.round(point.accuracyM),
        distanceM: verdict.distanceM,
      },
    };
  }

  /** The shift a clock-in now belongs to: the one running, else the next to start within 12 hours. */
  private async shiftAround(employeeId: string, now: Date): Promise<{ startsAt: Date; endsAt: Date } | null> {
    const entries = await this.time.linkCandidates(employeeId, now);
    const running = entries.find((e) => e.startsAt <= now && e.endsAt >= now);
    if (running) return running;
    const next = entries.filter((e) => e.startsAt > now).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0];
    return next ?? null;
  }

  /** A clock-in the rules refused, kept in the audit trail; `far` ones count in HR's monthly list. */
  private async refused(
    userId: string,
    employee: EmployeeRow,
    mode: ClockMode,
    reason: string,
    far: boolean,
    verdict: PunchVerdict,
  ): Promise<void> {
    await writeHrAudit(this.db, {
      actorUserId: userId,
      subjectType: 'employee',
      subjectId: employee.id,
      eventType: 'hr.clock_in_refused',
      orgId: employee.orgId,
      diff: { mode, far, distanceM: verdict.distanceM, code: verdict.code },
      reason,
    });
  }
}

/** When a phone punch arrived and the tap it reported, with the reason it keeps (the first). */
function arrivalOf(time: ResolvedTime, reasons: readonly AttendancePendingReason[]): PunchArrival {
  return { receivedAt: time.receivedAt, deviceAt: time.deviceAt, pendingReason: reasons[0] ?? null };
}

/** The punch's wait in words: the location's reason first, else the late arrival. */
function reasonWords(locationWords: string | null, reasons: readonly AttendancePendingReason[]): string | null {
  if (locationWords) return locationWords;
  return reasons.includes('late_sync') ? LATE_SYNC_WORDS : null;
}

function presentTodayShift(entry: RosterEntryRow): MyWorkToday['shifts'][number] {
  return {
    rosterEntryId: entry.id,
    shiftName: entry.shiftName,
    startsAt: entry.startsAt.toISOString(),
    endsAt: entry.endsAt.toISOString(),
    breakMinutes: entry.breakMinutes,
    propertyId: entry.propertyId,
  };
}

function assertRange(query: RangeQuery): void {
  if (!isCalendarDate(query.from) || !isCalendarDate(query.to)) throw new UnprocessableEntityException('That is not a real date.');
}
