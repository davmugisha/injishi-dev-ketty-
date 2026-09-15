import type { DepartmentCategory, DepartmentStatus } from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, isNotNull, sql } from 'drizzle-orm';

import { departments, folioCharges, folios } from '../../../database/drizzle/schema';
import {
  inBranchScope,
  type BranchScope,
} from '../../../shared/auth/branch-scope';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';

export interface RevenueDepartmentRow {
  id: string;
  name: string;
  departmentCategory: DepartmentCategory;
  isRevenueCenter: boolean;
  status: DepartmentStatus;
}

/**
 * The charge types that are revenue. The same three `ledger-posting.ts` makes
 * name a revenue centre, so a line counted here always carries a department.
 */
const REVENUE_CHARGE_TYPES = ['room', 'service_order', 'pos'] as const;

/**
 * The only place that touches Drizzle for the departmental revenue roll-up
 * (F-P01).
 *
 * Reads `folio_charges` rather than `ledger_entries`. Both carry the amount
 * with the same sign, but only the charge carries the department, and a join
 * from the entry back to its charge would be the same rows the long way round.
 */
@Injectable()
export class RevenueRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Revenue per department over `[from, to)`, net of voids.
   *
   * A charge belongs to the day it was EARNED: its `business_date` when it has
   * one (the night audit's room charge for a night), otherwise the Kigali day
   * it was posted. A void copies its original's business date, so reversing
   * last night's room charge this morning lands in the same night's month.
   */
  async revenueByDepartment(
    workspaceId: string,
    scope: BranchScope,
    from: string,
    to: string,
  ): Promise<Map<string, number>> {
    const earnedOn = sql`coalesce(${folioCharges.businessDate}, (${folioCharges.postedAt} at time zone 'Africa/Kigali')::date)`;
    const rows = await this.db
      .select({
        departmentId: folioCharges.departmentId,
        total: sql<string>`coalesce(sum(${folioCharges.amountRwf}), 0)::bigint`,
      })
      .from(folioCharges)
      // A charge reaches its branch through its bill (ADR-054).
      .innerJoin(folios, eq(folios.id, folioCharges.folioId))
      .where(
        and(
          eq(folioCharges.workspaceId, workspaceId),
          inBranchScope(folios.propertyId, scope),
          inArray(folioCharges.chargeType, [...REVENUE_CHARGE_TYPES]),
          isNotNull(folioCharges.departmentId),
          sql`${earnedOn} >= ${from}::date`,
          sql`${earnedOn} < ${to}::date`,
        ),
      )
      .groupBy(folioCharges.departmentId);

    const byDepartment = new Map<string, number>();
    for (const row of rows) {
      if (row.departmentId) byDepartment.set(row.departmentId, Number(row.total));
    }
    return byDepartment;
  }

  /** Every department in the workspace, in the operator's own order. */
  async listDepartments(workspaceId: string, scope: BranchScope): Promise<RevenueDepartmentRow[]> {
    return this.db
      .select({
        id: departments.id,
        name: departments.name,
        departmentCategory: departments.departmentCategory,
        isRevenueCenter: departments.isRevenueCenter,
        status: departments.status,
      })
      .from(departments)
      .where(and(eq(departments.workspaceId, workspaceId), inBranchScope(departments.propertyId, scope)))
      .orderBy(asc(departments.sortOrder), asc(departments.name));
  }
}
