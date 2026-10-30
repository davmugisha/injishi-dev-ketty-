import type {
  InsightsQuery,
  LateEarlyReport,
  LateEarlyRow,
  MonthlyQuery,
  MonthlySummary,
  MonthlySummaryRow,
  RosterCard,
} from '@injishi/contracts';
import { Injectable, UnprocessableEntityException } from '@nestjs/common';

import { assertInBranchScope, type ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { isCalendarDate } from '../../pms/domain/pricing';
import { firstOfMonth, lastOfMonth } from '../domain/hr-calendar';
import { TimeRepository, type AttendanceRow } from '../infrastructure/time.repository';
import { rosterCard } from './employee-presenter';
import { orgOf } from './hr-access';

type Summary = Omit<MonthlySummaryRow, 'employee'>;

const EMPTY: Summary = {
  daysWorked: 0,
  workedMinutes: 0,
  expectedMinutes: 0,
  overtimeMinutes: 0,
  approvedOvertimeMinutes: 0,
  lateCount: 0,
  earlyCount: 0,
};

/**
 * One person's figures from their closed records and their rostered minutes
 * (058-time AC-TM13). Days worked counts distinct work dates, so a split shift
 * is one day.
 */
export function summarize(records: readonly AttendanceRow[], expectedMinutes: number): Summary {
  const days = new Set<string>();
  const out = { ...EMPTY, expectedMinutes };
  for (const r of records) {
    if (r.status !== 'closed') continue;
    days.add(r.workDate);
    out.workedMinutes += r.workedMinutes ?? 0;
    out.overtimeMinutes += r.overtimeMinutes ?? 0;
    out.approvedOvertimeMinutes += r.approvedOvertimeMinutes ?? 0;
    if ((r.lateMinutes ?? 0) > 0) out.lateCount += 1;
    if ((r.earlyMinutes ?? 0) > 0) out.earlyCount += 1;
  }
  out.daysWorked = days.size;
  return out;
}

/** People in name order, never by a figure (index contract 7). */
function byName(a: RosterCard, b: RosterCard): number {
  return a.displayName.localeCompare(b.displayName, 'en', { sensitivity: 'base' }) || a.employeeId.localeCompare(b.employeeId);
}

/**
 * Lateness, early leaving and the monthly summary (ADR-058, 058-time AC-TM13).
 *
 * Three readers only, under index contract 7: the person (self service), their
 * reporting manager for their direct reports (`me/work/:id/team`), and holders
 * of `people.manage` (the `ops` routes here). Rows come in name order and a
 * figure is never a sort key, a threshold or a colour.
 */
@Injectable()
export class AttendanceInsightsService {
  constructor(private readonly time: TimeRepository) {}

  /** `GET /ops/attendance/insights/late-early`. */
  async lateEarly(ws: ScopedWorkspace, query: InsightsQuery): Promise<LateEarlyReport> {
    const orgId = orgOf(ws);
    if (!isCalendarDate(query.from) || !isCalendarDate(query.to)) throw new UnprocessableEntityException('That is not a real date.');
    if (query.propertyId) assertInBranchScope(ws, query.propertyId);
    const records = await this.time.closedRecordsInScope({
      orgId,
      scope: ws.branchScope,
      from: query.from,
      to: query.to,
      propertyId: query.propertyId,
    });
    return { from: query.from, to: query.to, rows: await this.lateEarlyRows(records) };
  }

  /** `GET /ops/attendance/insights/monthly`. */
  async monthly(ws: ScopedWorkspace, query: MonthlyQuery): Promise<MonthlySummary> {
    const orgId = orgOf(ws);
    if (query.propertyId) assertInBranchScope(ws, query.propertyId);
    const from = firstOfMonth(query.month);
    const to = lastOfMonth(query.month);
    const [records, expected] = await Promise.all([
      this.time.closedRecordsInScope({ orgId, scope: ws.branchScope, from, to, propertyId: query.propertyId }),
      this.time.scheduledMinutes({ orgId, from, to, scope: ws.branchScope, propertyId: query.propertyId }),
    ]);
    return { month: query.month, rows: this.summaryRows(records, expected) };
  }

  /** One person's month, for self service. */
  async monthOf(orgId: string, employeeId: string, month: string): Promise<Summary> {
    const from = firstOfMonth(month);
    const to = lastOfMonth(month);
    const [records, expected] = await Promise.all([
      this.time.personRecords({ employeeIds: [employeeId], from, to }),
      this.time.scheduledMinutes({ orgId, from, to, employeeIds: [employeeId] }),
    ]);
    return summarize(records, expected[0]?.minutes ?? 0);
  }

  /** Several people's month, for a reporting manager's team. */
  async monthsOf(orgId: string, employeeIds: readonly string[], month: string, cards: readonly RosterCard[]): Promise<MonthlySummaryRow[]> {
    const from = firstOfMonth(month);
    const to = lastOfMonth(month);
    const [records, expected] = await Promise.all([
      this.time.personRecords({ employeeIds, from, to }),
      this.time.scheduledMinutes({ orgId, from, to, employeeIds }),
    ]);
    const minutes = new Map(expected.map((e) => [e.employeeId, e.minutes]));
    return [...cards]
      .sort(byName)
      .map((employee) => ({
        employee,
        ...summarize(
          records.filter((r) => r.employeeId === employee.employeeId),
          minutes.get(employee.employeeId) ?? 0,
        ),
      }));
  }

  /** Records with lateness or early leaving, by name then date. */
  async lateEarlyRows(records: readonly AttendanceRow[]): Promise<LateEarlyRow[]> {
    const flagged = records.filter((r) => r.status === 'closed' && ((r.lateMinutes ?? 0) > 0 || (r.earlyMinutes ?? 0) > 0));
    const names = await this.time.shiftNamesOf(flagged.map((r) => r.rosterEntryId).filter((id): id is string => id !== null));
    return flagged
      .map(
        (r): LateEarlyRow => ({
          recordId: r.id,
          employee: rosterCard({ id: r.employeeId, preferredName: r.preferredName, legalName: r.legalName, jobPositionTitle: r.jobPositionTitle }),
          workDate: r.workDate,
          shiftName: r.rosterEntryId ? names.get(r.rosterEntryId) ?? null : null,
          lateMinutes: r.lateMinutes ?? 0,
          earlyMinutes: r.earlyMinutes ?? 0,
        }),
      )
      .sort((a, b) => byName(a.employee, b.employee) || a.workDate.localeCompare(b.workDate));
  }

  private summaryRows(
    records: readonly AttendanceRow[],
    expected: readonly { employeeId: string; preferredName: string | null; legalName: string; jobPositionTitle: string | null; minutes: number }[],
  ): MonthlySummaryRow[] {
    const cards = new Map<string, RosterCard>();
    for (const r of records) {
      cards.set(r.employeeId, rosterCard({ id: r.employeeId, preferredName: r.preferredName, legalName: r.legalName, jobPositionTitle: r.jobPositionTitle }));
    }
    for (const e of expected) {
      if (!cards.has(e.employeeId)) {
        cards.set(e.employeeId, rosterCard({ id: e.employeeId, preferredName: e.preferredName, legalName: e.legalName, jobPositionTitle: e.jobPositionTitle }));
      }
    }
    const minutes = new Map(expected.map((e) => [e.employeeId, e.minutes]));
    return [...cards.values()].sort(byName).map((employee) => ({
      employee,
      ...summarize(
        records.filter((r) => r.employeeId === employee.employeeId),
        minutes.get(employee.employeeId) ?? 0,
      ),
    }));
  }
}
