import type {
  AttendancePendingReason,
  AttendanceRequest,
  ChangeMyKioskPinRequest,
  CreateMyAttendanceRequestRequest,
  CreateMyShiftRequestRequest,
  KioskPinState,
  MyAttendance,
  MyAttendanceRequestList,
  MyMonthlySummary,
  MyRoster,
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
import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { resolveReportedTime, type ResolvedTime } from '../../../shared/time/reported-time';
import { isCalendarDate } from '../../pms/domain/pricing';
import { addDays, firstOfMonth, kigaliToday, lastOfMonth, monthOf } from '../domain/hr-calendar';
import { phonePunchVerdict, punchPendingReasons, takesLateClockOut } from '../domain/time-rules';
import { EmployeesRepository, type EmployeeRow } from '../infrastructure/employees.repository';
import { writeHrEvent } from '../infrastructure/hr-events';
import { MyWorkRepository } from '../infrastructure/my-work.repository';
import { TimeRequestsRepository } from '../infrastructure/time-requests.repository';
import {
  TimeRepository,
  type PunchArrival,
  type PunchLocation,
  type RosterEntryRow,
} from '../infrastructure/time.repository';
import { DEFAULT_RADIUS_M, TimeSettingsRepository } from '../infrastructure/time-settings.repository';
import { AttendanceInsightsService } from './attendance-insights.service';
import { displayNameOf, rosterCard } from './employee-presenter';
import { KioskService } from './kiosk.service';
import { MyLeaveService } from './my-leave.service';
import { presentAttendance, presentShift, TimeRequestsService, type RequestActor } from './time-requests.service';
import { presentEntry, presentRecord, TimeService, type RecordReader } from './time.service';

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
   * A phone clock in at the tap time (mobile spec 0003, cross child contract
   * 1): the reported time corrected for the phone's clock, flagged `late_sync`
   * when it arrived more than 30 minutes after the tap. A second clock in is
   * `409 already_open` carrying the open record, which an offline phone reads
   * as "already clocked in".
   */
  async clockIn(userId: string, employeeId: string, body: PhoneClockRequest, receivedAt: Date): Promise<PhoneClockResult> {
    const employee = await this.mineActive(userId, employeeId);
    const time = resolveReportedTime(body, receivedAt);
    const fix = await this.fix(employee, body);
    const reasons = punchPendingReasons({ location: fix.verdict.code, lateSync: time.lateSync });
    const validated = reasons.length === 0;
    const id = await this.timeService.punchIn({
      employee,
      at: time.at,
      source: 'phone',
      userId,
      validated,
      location: fix.location,
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
      pendingReason: reasonWords(fix.verdict.reason, reasons),
      distanceM: fix.verdict.distanceM,
    };
  }

  /**
   * A phone clock out at the tap time. With nothing open it is `409
   * not_clocked_in`, except a tap made before the sweep closed the record on
   * its own, which replaces the sweep's end time (D-ap, AC-7).
   */
  async clockOut(userId: string, employeeId: string, body: PhoneClockRequest, receivedAt: Date): Promise<PhoneClockResult> {
    const employee = await this.mineActive(userId, employeeId);
    const time = resolveReportedTime(body, receivedAt);
    const open = await this.time.findOpenRecord(employee.id);
    if (!open) return this.lateClockOut(userId, employee, body, time);
    const fix = await this.fix(employee, body);
    const reasons = punchPendingReasons({ location: fix.verdict.code, lateSync: time.lateSync });
    const flagged = reasons.length > 0;
    const workspaceId = flagged ? await this.work.workspaceOf(employee.orgId) : null;
    await this.timeService.punchOut({
      record: open,
      at: time.at,
      userId,
      location: fix.location,
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
    return {
      record,
      validated: record.validated,
      pendingReason: record.validated
        ? null
        : (reasonWords(fix.verdict.reason, reasons) ?? 'Your clock in is waiting to be validated.'),
      distanceM: fix.verdict.distanceM,
    };
  }

  /** Nothing open: the sweep's record takes the tap when the tap came first, else `409 not_clocked_in`. */
  private async lateClockOut(
    userId: string,
    employee: EmployeeRow,
    body: PhoneClockRequest,
    time: ResolvedTime,
  ): Promise<PhoneClockResult> {
    const last = await this.time.latestRecord(employee.id);
    if (!last || !takesLateClockOut(last, time.at)) {
      throw new ConflictException({ code: 'not_clocked_in', message: 'You are not clocked in.' });
    }
    const fix = await this.fix(employee, body);
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
    const { mine, askedOfMe } = await this.requests.shiftsOf(employee.id);
    return {
      mine: mine.map((r) => presentShift(r, employee.id)),
      askedOfMe: askedOfMe.map((r) => presentShift(r, employee.id)),
    };
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
    const kindOk = (k: 'change' | 'swap'): boolean =>
      !query.kind || query.kind === 'attendance' || (query.kind === 'swap' ? k === 'swap' : k === 'change');
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

  /** Where the phone says it is, measured against the branch (AC-TM9). Never a refusal. */
  private async fix(
    employee: EmployeeRow,
    body: PhoneClockRequest,
  ): Promise<{ verdict: ReturnType<typeof phonePunchVerdict>; location: PunchLocation }> {
    const point =
      body.lat !== undefined && body.lng !== undefined ? { lat: body.lat, lng: body.lng, accuracyM: body.accuracyM ?? null } : null;
    const fence = employee.workPropertyId ? await this.settings.geofenceFor(employee.workPropertyId) : null;
    const verdict = phonePunchVerdict({ point, branch: fence?.centre ?? null, radiusM: fence?.radiusM ?? DEFAULT_RADIUS_M });
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
