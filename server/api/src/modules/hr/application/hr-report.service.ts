import type {
  HrReport,
  HrReportAttendanceRow,
  HrReportEvent,
  HrReportLeave,
  HrReportPayMonth,
  HrReportPerson,
  HrReportQuery,
} from '@injishi/contracts';
import { Injectable } from '@nestjs/common';

import { coversProperty, type ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { eachDate, kigaliToday } from '../domain/hr-calendar';
import { kigaliEnd, kigaliStart, leaveDaysInPeriod, monthsTo, WEEKDAYS, weekdayOf } from '../domain/hr-report-rules';
import { kigaliClock } from '../domain/time-rules';
import { HrReportRepository, type ReportAskRow, type ReportPersonRow } from '../infrastructure/hr-report.repository';
import { orgOf } from './hr-access';

/** Pay figures go to whoever drafts or runs pay. */
const PAY_READERS = ['payroll.draft', 'payroll.run'] as const;

type Totals = Omit<HrReportAttendanceRow, keyof HrReportPerson>;
const zero = (): Totals => ({
  shifts: 0,
  present: 0,
  absent: 0,
  onLeave: 0,
  late: 0,
  lateMinutes: 0,
  leftEarly: 0,
  notCounted: 0,
  workedMinutes: 0,
  overtimeMinutes: 0,
  approvedOvertimeMinutes: 0,
});

/**
 * The HR report (058, HR reports): everything that took place at a business
 * over a period, worked out from the roster, the clock, leave, pay and the
 * requests people made. A period that runs past today is counted up to now.
 * People come in name order, never by a figure (index contract 7).
 */
@Injectable()
export class HrReportService {
  constructor(private readonly reports: HrReportRepository) {}

  async report(ws: ScopedWorkspace, query: HrReportQuery, now = new Date()): Promise<HrReport> {
    const orgId = orgOf(ws);
    const { from, to } = query;
    const today = kigaliToday(now);
    const upTo = to < today ? to : today;
    const since = kigaliStart(from);
    const until = kigaliEnd(to);
    const showPay = PAY_READERS.some((p) => ws.permissions.includes(p));
    const payMonths = monthsTo(to.slice(0, 7), 6);

    const [everyone, shifts, records, leave, leaveAsked, claims, corrections, helpDesk, payslips] = await Promise.all([
      this.reports.people(orgId),
      upTo >= from ? this.reports.shifts(orgId, from, upTo, now) : Promise.resolve([]),
      upTo >= from ? this.reports.records(orgId, from, upTo) : Promise.resolve([]),
      this.reports.leave(orgId, from, to),
      this.reports.leaveAsked(orgId, since, until),
      this.reports.claims(orgId, since, until),
      this.reports.corrections(orgId, since, until),
      this.reports.helpDesk(orgId, since, until),
      showPay ? this.reports.payslips(orgId, `${payMonths[0]}-01`, `${payMonths[payMonths.length - 1]}-01`) : Promise.resolve([]),
    ]);

    const people = everyone.filter((p) => coversProperty(ws.branchScope, p.workPropertyId));
    const byId = new Map(people.map((p) => [p.id, p]));
    const card = (p: ReportPersonRow): HrReportPerson => ({ employeeId: p.id, name: p.name, job: p.job, team: p.team, branch: p.branch });
    const mine = <T extends { employeeId: string }>(rows: T[]): T[] => rows.filter((r) => byId.has(r.employeeId));

    // --- Staff: who was on file, who joined, who left -------------------------------------------
    const onFileOn = (p: ReportPersonRow, date: string): boolean =>
      p.hiredOn !== null && p.hiredOn <= date && (p.offboardedOn === null || p.offboardedOn >= date);
    const atEnd = people.filter((p) => onFileOn(p, to));
    const tally = (names: (string | null)[], none: string): { name: string; count: number }[] => {
      const counts = new Map<string, number>();
      for (const n of names) counts.set(n ?? none, (counts.get(n ?? none) ?? 0) + 1);
      return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name));
    };

    // --- Attendance -------------------------------------------------------------------------------
    const leaveDays = new Set<string>();
    for (const l of mine(leave)) {
      if (l.status !== 'approved') continue;
      const start = l.startsOn > from ? l.startsOn : from;
      const end = l.endsOn < to ? l.endsOn : to;
      for (const d of eachDate(start, end)) leaveDays.add(`${l.employeeId}|${d}`);
    }
    const shiftById = new Map(shifts.map((s) => [s.id, s]));
    const shiftWords = (s: { startsAt: Date; endsAt: Date } | undefined): string | null =>
      s ? `${kigaliClock(s.startsAt)}–${kigaliClock(s.endsAt)}` : null;
    const clockedOn = new Set(
      mine(records)
        .filter((r) => r.status === 'open' || r.status === 'closed')
        .map((r) => `${r.employeeId}|${r.workDate}`),
    );

    const rows = new Map<string, Totals>();
    const rowOf = (employeeId: string): Totals => {
      let row = rows.get(employeeId);
      if (!row) {
        row = zero();
        rows.set(employeeId, row);
      }
      return row;
    };
    const events: HrReportEvent[] = [];

    for (const s of mine(shifts)) {
      const row = rowOf(s.employeeId);
      row.shifts += 1;
      const key = `${s.employeeId}|${s.workDate}`;
      if (clockedOn.has(key)) row.present += 1;
      else if (leaveDays.has(key)) row.onLeave += 1;
      else {
        row.absent += 1;
        events.push({ employeeId: s.employeeId, date: s.workDate, kind: 'absent', shift: shiftWords(s), clockIn: null, minutes: null, note: null });
      }
    }
    for (const r of mine(records)) {
      const row = rowOf(r.employeeId);
      const shift = shiftWords(r.rosterEntryId ? shiftById.get(r.rosterEntryId) : undefined);
      const clockIn = kigaliClock(r.clockInAt);
      if (r.status === 'rejected') {
        row.notCounted += 1;
        events.push({ employeeId: r.employeeId, date: r.workDate, kind: 'not_counted', shift, clockIn, minutes: null, note: r.note });
        continue;
      }
      if ((r.lateMinutes ?? 0) > 0) {
        row.late += 1;
        row.lateMinutes += r.lateMinutes ?? 0;
        events.push({ employeeId: r.employeeId, date: r.workDate, kind: 'late', shift, clockIn, minutes: r.lateMinutes, note: null });
      }
      if ((r.earlyMinutes ?? 0) > 0) {
        row.leftEarly += 1;
        events.push({ employeeId: r.employeeId, date: r.workDate, kind: 'left_early', shift, clockIn, minutes: r.earlyMinutes, note: null });
      }
      row.workedMinutes += r.workedMinutes ?? 0;
      row.overtimeMinutes += r.overtimeMinutes ?? 0;
      row.approvedOvertimeMinutes += r.approvedOvertimeMinutes ?? 0;
    }

    // Everyone on file at some point of the period, in name order, figures or none.
    const attendancePeople: HrReportAttendanceRow[] = people
      .filter((p) => rows.has(p.id) || (p.hiredOn !== null && p.hiredOn <= to && (p.offboardedOn === null || p.offboardedOn >= from)))
      .map((p) => ({ ...card(p), ...(rows.get(p.id) ?? zero()) }));
    const totals = zero();
    for (const row of attendancePeople) {
      for (const k of Object.keys(totals) as (keyof Totals)[]) totals[k] += row[k];
    }
    const weekdays = WEEKDAYS.map((day) => ({ day: day as string, late: 0, absent: 0 }));
    for (const e of events) {
      if (e.kind === 'late') weekdays[weekdayOf(e.date)].late += 1;
      if (e.kind === 'absent') weekdays[weekdayOf(e.date)].absent += 1;
    }
    events.sort((a, b) => a.date.localeCompare(b.date) || (byId.get(a.employeeId)?.name ?? '').localeCompare(byId.get(b.employeeId)?.name ?? ''));

    // --- Leave ------------------------------------------------------------------------------------
    const taken: HrReportLeave[] = mine(leave).map((l) => {
      const p = byId.get(l.employeeId) as ReportPersonRow;
      return {
        ...card(p),
        requestId: l.id,
        type: l.type,
        startsOn: l.startsOn,
        endsOn: l.endsOn,
        days: l.days,
        daysInPeriod: leaveDaysInPeriod(l, from, to),
        status: l.status === 'approved' ? 'approved' : 'requested',
        reason: l.reason,
      };
    });
    const types = new Map<string, { people: Set<string>; days: number }>();
    for (const l of taken) {
      if (l.status !== 'approved') continue;
      const t = types.get(l.type) ?? { people: new Set<string>(), days: 0 };
      t.people.add(l.employeeId);
      t.days += l.daysInPeriod;
      types.set(l.type, t);
    }
    const count = (asks: ReportAskRow[], status: string): number => mine(asks).filter((a) => a.status === status).length;

    // --- Pay --------------------------------------------------------------------------------------
    let pay: HrReportPayMonth[] | null = null;
    if (showPay) {
      pay = payMonths.map((month) => {
        const slips = mine(payslips).filter((s) => s.month === month);
        const sum = (k: 'grossRwf' | 'payeRwf' | 'employeeContributionsRwf' | 'employerContributionsRwf' | 'otherDeductionsRwf' | 'netRwf'): number =>
          slips.reduce((t, s) => t + s[k], 0);
        return {
          month,
          status: slips[0]?.runStatus ?? 'none',
          people: slips.length,
          grossRwf: sum('grossRwf'),
          payeRwf: sum('payeRwf'),
          employeeContributionsRwf: sum('employeeContributionsRwf'),
          employerContributionsRwf: sum('employerContributionsRwf'),
          otherDeductionsRwf: sum('otherDeductionsRwf'),
          netRwf: sum('netRwf'),
          employerCostRwf: sum('grossRwf') + sum('employerContributionsRwf'),
        };
      });
    }

    return {
      from,
      to,
      today,
      people: {
        atStart: people.filter((p) => onFileOn(p, from)).length,
        atEnd: atEnd.length,
        joined: people.filter((p) => p.hiredOn !== null && p.hiredOn >= from && p.hiredOn <= to).map((p) => ({ ...card(p), on: p.hiredOn as string })),
        left: people
          .filter((p) => p.offboardedOn !== null && p.offboardedOn >= from && p.offboardedOn <= to)
          .map((p) => ({ ...card(p), on: p.offboardedOn as string, reason: p.offboardReason })),
        byTeam: tally(atEnd.map((p) => p.team), 'No team'),
        byBranch: tally(atEnd.map((p) => p.branch), 'No branch'),
      },
      attendance: { totals, people: attendancePeople, events, byWeekday: weekdays },
      leave: {
        byType: [...types]
          .map(([type, t]) => ({ type, people: t.people.size, days: t.days }))
          .sort((a, b) => a.type.localeCompare(b.type)),
        taken,
        asked: {
          approved: count(leaveAsked, 'approved'),
          declined: count(leaveAsked, 'rejected'),
          pending: count(leaveAsked, 'requested'),
          cancelled: count(leaveAsked, 'cancelled'),
        },
      },
      pay,
      requests: {
        claims: {
          asked: mine(claims).length,
          approved: count(claims, 'approved'),
          approvedRwf: mine(claims)
            .filter((c) => c.status === 'approved')
            .reduce((t, c) => t + (c.amountRwf ?? 0), 0),
          pending: count(claims, 'requested'),
        },
        corrections: {
          asked: mine(corrections).length,
          approved: count(corrections, 'approved'),
          declined: count(corrections, 'rejected'),
          pending: count(corrections, 'requested'),
        },
        helpDesk: { opened: count(helpDesk, 'opened'), closed: count(helpDesk, 'closed') },
      },
    };
  }
}
