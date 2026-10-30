import {
  type OperatorPerformance,
  type OperatorPerformanceQuery,
  type OperatorPerformanceWindow,
  type OperatorRevenueDaily,
  type OperatorRevenueDailyQuery,
  type OwnerBranchHealth,
  type OwnerDashboard,
  type OwnerDashboardQuery,
  type OwnerNight,
  REVENUE_DAY_GROUP,
  type DepartmentCategory,
} from '@injishi/contracts';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { PaymentSeam } from '../../pay/domain/payment-seam';
import {
  type NightRow,
  type OwnerBranchRow,
  OwnerDashboardRepository,
} from '../infrastructure/owner-dashboard.repository';

/**
 * The owner's figures: tonight's rooms, today's money, each branch's health,
 * revenue by day and performance by branch.
 *
 * NOTHING HERE IS STORED. Each figure is a sum over the rows the front desk, the
 * night audit and the payment seam already write, read at request time, so the
 * dashboard can never disagree with the bills it summarises. It reads
 * `money.view` data only; who may see it is the controller's declaration.
 */
@Injectable()
export class OwnerDashboardService {
  constructor(
    private readonly repo: OwnerDashboardRepository,
    /**
     * The stack's payment seam, the one reader of PAYMENT_ADAPTER_MODE
     * (073-gtbank-payments interim record), so the dashboard and the seam can
     * never disagree.
     */
    private readonly seam: PaymentSeam,
  ) {}

  async dashboard(
    ws: ScopedWorkspace,
    query: OwnerDashboardQuery,
    now: Date = new Date(),
  ): Promise<OwnerDashboard> {
    const org = await this.repo.orgOf(ws.workspaceId);
    if (!org || !ws.orgId) throw new NotFoundException('Only a business workspace has a dashboard.');
    const date = query.date ?? kigaliDay(now);
    const domain = ws.domain === 'residence' ? 'residence' : 'hospitality';

    const lastWeek = addDays(date, -7);
    const [branches, tonightRows, lastWeekRows, payments, balances, fiscal, leases] =
      await Promise.all([
        this.repo.branches(ws.workspaceId, ws.branchScope),
        this.repo.nights(ws.workspaceId, ws.branchScope, date, addDays(date, 1)),
        this.repo.nights(ws.workspaceId, ws.branchScope, lastWeek, addDays(lastWeek, 1)),
        this.repo.payments(ws.workspaceId, ws.branchScope, date, now),
        this.repo.openBalances(ws.workspaceId, ws.branchScope),
        this.repo.fiscalPendingByBranch(ws.workspaceId, now),
        domain === 'residence'
          ? this.repo.leasesByBranch(ws.workspaceId, date)
          : Promise.resolve(new Map<string, { leased: number; arrears: number }>()),
      ]);

    const branchHealth: OwnerBranchHealth[] = branches.map((b) => ({
      propertyId: b.propertyId,
      name: b.name,
      branchCode: b.branchCode,
      district: b.district,
      roomCount: b.roomCount,
      tonight: nightOf(b, tonightRows),
      openExceptions: b.roomsOutOfOrder + b.blockedTasks,
      // A receipt is counted under the RRA branch it was signed for; a branch
      // with no RRA id yet signs as the business's own "00".
      fiscalPendingOver2h: fiscal.get(b.rraBranchId ?? '00') ?? 0,
      leasedUnits: domain === 'residence' ? (leases.get(b.propertyId)?.leased ?? 0) : null,
      leasesInArrears: domain === 'residence' ? (leases.get(b.propertyId)?.arrears ?? 0) : null,
    }));

    return {
      date,
      domain,
      legalName: org.legalName,
      tin: org.tin,
      tonight: total(branches, tonightRows),
      sameNightLastWeek: total(branches, lastWeekRows),
      collectionsTodayRwf: payments.confirmedRwf,
      collectionsTodayCount: payments.confirmedCount,
      openFolioBalanceRwf: balances.balanceRwf,
      openFoliosOwing: balances.owing,
      unverifiedPaymentsRwf: payments.promptingRwf,
      unverifiedPaymentsCount: payments.promptingCount,
      // Someone covering every branch sees every held receipt of the business; someone limited to some
      // branches sees only theirs, as every other figure here.
      fiscalPendingOver2h:
        ws.branchScope.coverage === 'all' && ws.branchScope.selectedPropertyId === null
          ? [...fiscal.values()].reduce((s, n) => s + n, 0)
          : branchHealth.reduce((s, b) => s + b.fiscalPendingOver2h, 0),
      // Sandbox money is as invented as the mock's, and the badge says so.
      paymentsMode: this.seam.mode === 'sandbox' ? 'mock' : this.seam.mode,
      branches: branchHealth,
    };
  }

  /** Every day of `[from, to)`, zero filled, grouped rooms / food and beverage / other. */
  async revenueDaily(ws: ScopedWorkspace, query: OperatorRevenueDailyQuery): Promise<OperatorRevenueDaily> {
    const rows = await this.repo.revenueByDay(ws.workspaceId, ws.branchScope, query.from, query.to);
    const days = new Map<string, { roomsRwf: number; foodBeverageRwf: number; otherRwf: number }>();
    for (let d = query.from; d < query.to; d = addDays(d, 1)) {
      days.set(d, { roomsRwf: 0, foodBeverageRwf: 0, otherRwf: 0 });
    }
    for (const row of rows) {
      const day = days.get(row.day);
      if (!day) continue;
      const group = REVENUE_DAY_GROUP[row.category as DepartmentCategory] ?? 'other';
      if (group === 'rooms') day.roomsRwf += row.total;
      else if (group === 'fnb') day.foodBeverageRwf += row.total;
      else day.otherRwf += row.total;
    }
    return {
      from: query.from,
      to: query.to,
      days: [...days.entries()].map(([date, d]) => ({ date, ...d })),
    };
  }

  /** The window asked for and the same dates a year earlier, per hospitality branch. */
  async performance(ws: ScopedWorkspace, query: OperatorPerformanceQuery): Promise<OperatorPerformance> {
    if (ws.domain === 'residence') {
      throw new BadRequestException('A residence is measured by leases, not nights.');
    }
    const lastYear = { from: addYears(query.from, -1), to: addYears(query.to, -1) };
    const branches = await this.repo.branches(ws.workspaceId, ws.branchScope);
    const [current, previous] = await Promise.all([
      this.window(ws, branches, query.from, query.to),
      this.window(ws, branches, lastYear.from, lastYear.to),
    ]);
    return { ...current, lastYear: previous };
  }

  private async window(
    ws: ScopedWorkspace,
    branches: OwnerBranchRow[],
    from: string,
    to: string,
  ): Promise<OperatorPerformanceWindow> {
    const [nights, revenue] = await Promise.all([
      this.repo.nights(ws.workspaceId, ws.branchScope, from, to),
      this.repo.postedRoomRevenue(ws.workspaceId, ws.branchScope, from, to),
    ]);
    const nightCount = daysBetween(from, to);
    return {
      from,
      to,
      branches: branches.map((b) => ({
        propertyId: b.propertyId,
        name: b.name,
        branchCode: b.branchCode,
        availableNights: b.availableRooms * nightCount,
        soldNights: nights
          .filter((n) => n.propertyId === b.propertyId)
          .reduce((s, n) => s + n.soldRooms, 0),
        roomRevenueRwf: revenue.get(b.propertyId) ?? 0,
      })),
    };
  }
}

function nightOf(branch: OwnerBranchRow, rows: NightRow[]): OwnerNight {
  const held = rows.filter((r) => r.propertyId === branch.propertyId);
  return {
    availableRooms: branch.availableRooms,
    soldRooms: held.reduce((s, r) => s + r.soldRooms, 0),
    roomRevenueRwf: held.reduce((s, r) => s + r.roomRevenueRwf, 0),
  };
}

function total(branches: OwnerBranchRow[], rows: NightRow[]): OwnerNight {
  const nights = branches.map((b) => nightOf(b, rows));
  return {
    availableRooms: nights.reduce((s, n) => s + n.availableRooms, 0),
    soldRooms: nights.reduce((s, n) => s + n.soldRooms, 0),
    roomRevenueRwf: nights.reduce((s, n) => s + n.roomRevenueRwf, 0),
  };
}

/** Today in Kigali, `YYYY-MM-DD`. Rwanda keeps no daylight saving. */
function kigaliDay(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Kigali',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Calendar arithmetic at UTC noon, so no day boundary is ever crossed by accident. */
function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** The same calendar date a year away; 29 February becomes 28 February. */
function addYears(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const target = new Date(Date.UTC(y + n, m - 1, d, 12));
  if (target.getUTCMonth() !== m - 1) target.setUTCDate(0);
  return target.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
}
