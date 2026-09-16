import {
  type OperatorRevenue,
  OperatorRevenueQuery,
} from '@injishi/contracts';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { RevenueService } from '../../../modules/operations/application/revenue.service';
import { SessionGuard } from '../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequirePermission,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * Revenue by department -> /api/v1/ops/revenue (F-P01).
 *
 * **Gated on `money.view`, unlike the bill.** The bill is read on
 * `folio.charge` because the receptionist writing it has to see it. This is a
 * different question — what the whole property earned this month — and it
 * belongs to the two roles that run the business, which is exactly who holds
 * `money.view`.
 */
@Controller({ path: 'ops/revenue', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsRevenueController {
  constructor(private readonly revenue: RevenueService) {}

  @Get()
  @RequirePermission('money.view')
  forMonth(
    @Query(new ZodValidationPipe(OperatorRevenueQuery))
    query: OperatorRevenueQuery,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<OperatorRevenue> {
    return this.revenue.forMonth(workspace, query);
  }
}
