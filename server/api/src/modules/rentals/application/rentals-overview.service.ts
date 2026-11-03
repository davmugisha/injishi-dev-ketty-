import { BadRequestException, Injectable } from '@nestjs/common';
import {
  endOfMonth,
  kigaliToday,
  overviewMonths,
  percentChange,
  type RentalsMoney,
  type RentalsOverview,
  type RentalsSummary,
} from '@injishi/contracts';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { attentionItems, buildingIdsOf } from '../domain/attention';
import { assertResidence } from '../domain/residence';
import { RentalsOverviewRepository } from '../infrastructure/rentals-overview.repository';
import { RentalsProfileService } from './rentals-profile.service';

/**
 * The landlord's home (blueprint 3.5 "Overview", WP 2.2): the counts the
 * navigation shows with what needs attention, and the month's figures with
 * a year of rent collected against expected. Kigali days and months; the
 * branch scope narrows every figure to the buildings the person covers.
 */
@Injectable()
export class RentalsOverviewService {
  constructor(
    private readonly reads: RentalsOverviewRepository,
    private readonly profiles: RentalsProfileService,
  ) {}

  async summary(ws: ScopedWorkspace, now: Date = new Date()): Promise<RentalsSummary> {
    const r = assertResidence(ws);
    const buildings = buildingIdsOf(ws.branchScope);
    const today = kigaliToday(now);
    const [units, statuses, overdue, notices, filings, setup] = await Promise.all([
      this.reads.unitCounts(r.workspaceId, buildings),
      this.reads.leaseStatusCounts(r.workspaceId, buildings),
      this.reads.overdue(r.workspaceId, buildings, today),
      this.reads.noticesToAcknowledge(r.workspaceId, buildings),
      this.reads.filingsDue(r.workspaceId, buildings, today),
      this.profiles.setup(ws),
    ]);
    const counts: RentalsSummary['counts'] = {
      units: units.units,
      vacantUnits: units.vacant,
      leasesToSign: statuses.draft ?? 0,
      waitingForTenant: statuses.pending_signature ?? 0,
      readyToStart: statuses.signed ?? 0,
      liveLeases: (statuses.active ?? 0) + (statuses.ending ?? 0),
      overdueCharges: overdue.charges,
      overdueRwf: overdue.amountRwf,
      noticesToAcknowledge: notices,
      filingsDue: filings.due,
      filingsLate: filings.late,
    };
    const setupFacts: RentalsSummary['setup'] = {
      complete: setup.complete,
      done: setup.steps.filter((s) => s.done).length,
      total: setup.steps.length,
      next: setup.next,
    };
    const hasPayoutAccount = setup.steps.some((s) => s.step === 'getting_paid' && s.done);
    return {
      counts,
      setup: setupFacts,
      hasPayoutAccount,
      attention: attentionItems(counts, setupFacts, hasPayoutAccount),
    };
  }

  async overview(ws: ScopedWorkspace, now: Date = new Date()): Promise<RentalsOverview> {
    const r = assertResidence(ws);
    const buildings = buildingIdsOf(ws.branchScope);
    const today = kigaliToday(now);
    const months = overviewMonths(today);
    const from = `${months[0]}-01`;
    const to = endOfMonth(today);
    const [units, properties, tenants, overdue, expected, collected, spent] = await Promise.all([
      this.reads.unitCounts(r.workspaceId, buildings),
      this.reads.buildingCount(r.workspaceId, buildings),
      this.reads.liveTenants(r.workspaceId, buildings),
      this.reads.overdue(r.workspaceId, buildings, today),
      this.reads.expectedByMonth(r.workspaceId, buildings, from, to),
      this.reads.collectedByMonth(r.workspaceId, buildings, from, to),
      this.reads.spentByMonth(r.workspaceId, buildings, from, to),
    ]);
    const spentBy = new Map(spent.map((m) => [m.month, m.amountRwf]));
    const expectedBy = new Map(expected.map((m) => [m.month, m.amountRwf]));
    const collectedBy = new Map(collected.map((m) => [m.month, m.amountRwf]));
    const figures = months.map((month) => ({
      month,
      expectedRwf: expectedBy.get(month) ?? 0,
      collectedRwf: collectedBy.get(month) ?? 0,
      spentRwf: spentBy.get(month) ?? 0,
    }));
    const thisMonth = figures[figures.length - 1] as (typeof figures)[number];
    const lastMonth = figures[figures.length - 2] ?? { expectedRwf: 0, collectedRwf: 0 };
    const lettable = units.occupied + units.reserved + units.vacant;
    return {
      today,
      month: thisMonth.month,
      properties,
      units: units.units,
      occupiedUnits: units.occupied,
      vacantUnits: units.vacant,
      reservedUnits: units.reserved,
      offMarketUnits: units.offMarket,
      tenants,
      occupancyPercent: lettable > 0 ? Math.round((units.occupied / lettable) * 1000) / 10 : null,
      rent: {
        expectedThisMonthRwf: thisMonth.expectedRwf,
        collectedThisMonthRwf: thisMonth.collectedRwf,
        expectedLastMonthRwf: lastMonth.expectedRwf,
        collectedLastMonthRwf: lastMonth.collectedRwf,
        collectedChangePercent: percentChange(thisMonth.collectedRwf, lastMonth.collectedRwf),
      },
      overdue: { amountRwf: overdue.amountRwf, charges: overdue.charges, leases: overdue.leases },
      months: figures,
    };
  }

  /**
   * The landlord's money by the day (2026-10-28): charges, payments and expenses from `from` to `to`.
   * Left out, the range is January of last year to the end of next month, which every period of the
   * home's filter and the calendar's next month fall inside. At most 800 days.
   */
  async money(ws: ScopedWorkspace, query: { from?: string; to?: string }, now: Date = new Date()): Promise<RentalsMoney> {
    const r = assertResidence(ws);
    const buildings = buildingIdsOf(ws.branchScope);
    const today = kigaliToday(now);
    const day = /^\d{4}-\d{2}-\d{2}$/;
    const [y, m] = today.split('-').map(Number) as [number, number];
    const nextMonth = endOfMonth(`${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`);
    const from = query.from ?? `${y - 1}-01-01`;
    const to = query.to ?? nextMonth;
    if (!day.test(from) || !day.test(to) || from > to) throw new BadRequestException('from and to must be days, from first.');
    const span = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
    if (span > 800) throw new BadRequestException('Ask for at most 800 days at a time.');
    const [charges, payments, spent] = await Promise.all([
      this.reads.chargesBetween(r.workspaceId, buildings, from, to, today),
      this.reads.paymentsBetween(r.workspaceId, buildings, from, to),
      this.reads.spentByDay(r.workspaceId, buildings, from, to),
    ]);
    return { from, to, today, charges, payments, spent };
  }
}
