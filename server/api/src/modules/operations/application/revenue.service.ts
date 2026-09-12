import type {
  OperatorRevenue,
  OperatorRevenueQuery,
  WorkspaceAccess,
} from '@injishi/contracts';
import { Injectable } from '@nestjs/common';

import { RevenueRepository } from '../infrastructure/revenue.repository';

/**
 * Revenue by department for one month (USALI, F-P01).
 *
 * This is where the department tag on every revenue charge rolls up. It says
 * what each revenue centre EARNED and nothing more: there is no expense ledger
 * yet, so direct costs, undistributed expenses and GOP have no source, and the
 * shape leaves them out rather than carrying a number somebody made up.
 */
@Injectable()
export class RevenueService {
  constructor(private readonly revenue: RevenueRepository) {}

  async forMonth(
    ws: WorkspaceAccess,
    query: OperatorRevenueQuery,
  ): Promise<OperatorRevenue> {
    const month = query.month ?? currentKigaliMonth();
    const { from, to } = monthBounds(month);

    const [earned, departments] = await Promise.all([
      this.revenue.revenueByDepartment(ws.workspaceId, from, to),
      this.revenue.listDepartments(ws.workspaceId),
    ]);

    /*
     * Every ACTIVE revenue centre is listed, at zero when it earned nothing:
     * a restaurant with no takings this month is a fact the owner needs to see,
     * not a row to hide. A department that has since been retired, or is not a
     * revenue centre, appears only when money actually landed on it, because
     * that money was earned and dropping the row would make the total disagree
     * with the sum of the rows.
     */
    const rows = departments
      .filter(
        (d) =>
          (d.isRevenueCenter && d.status === 'active') ||
          (earned.get(d.id) ?? 0) !== 0,
      )
      .map((d) => ({
        departmentId: d.id,
        name: d.name,
        departmentCategory: d.departmentCategory,
        status: d.status,
        revenueRwf: earned.get(d.id) ?? 0,
      }));

    return {
      month,
      from,
      to,
      departments: rows,
      totalRwf: rows.reduce((sum, r) => sum + r.revenueRwf, 0),
    };
  }
}

/** `YYYY-MM` for today in the property's zone. Rwanda keeps no daylight saving. */
function currentKigaliMonth(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kigali' })
    .format(now)
    .slice(0, 7);
}

/** `[first of the month, first of the next)`, both `YYYY-MM-DD`. */
function monthBounds(month: string): { from: string; to: string } {
  const [year, mon] = month.split('-').map(Number) as [number, number];
  const next = mon === 12 ? `${year + 1}-01` : `${year}-${String(mon + 1).padStart(2, '0')}`;
  return { from: `${month}-01`, to: `${next}-01` };
}
