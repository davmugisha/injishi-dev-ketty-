import {
  type OperatorPerformance,
  OperatorPerformanceQuery,
  type OwnerDashboard,
  OwnerDashboardQuery,
} from '@injishi/contracts';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { OwnerDashboardService } from '../../../modules/finance/application/owner-dashboard.service';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { SessionGuard } from '../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequirePermission,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * The owner's home -> `GET /api/v1/ops/dashboard/owner`.
 *
 * **Gated on `money.view`**, like `/ops/revenue` beside it: occupancy, rates,
 * the day's collections and what open bills owe are what the business earned,
 * and they belong to the roles that run it. Read only; every figure is a sum
 * over rows other routes write, scoped to the branches the caller covers.
 */
@Controller({ path: 'ops/dashboard', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsOwnerDashboardController {
  constructor(private readonly dashboard: OwnerDashboardService) {}

  @Get('owner')
  @RequirePermission('money.view')
  owner(
    @Query(new ZodValidationPipe(OwnerDashboardQuery)) query: OwnerDashboardQuery,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<OwnerDashboard> {
    return this.dashboard.dashboard(workspace, query);
  }
}

/**
 * Performance by branch -> `GET /api/v1/ops/reports/performance?from&to`.
 *
 * Nights available, nights sold and posted room revenue per hospitality
 * branch, for the window and the same dates a year earlier. The rates
 * (occupancy, ADR, RevPAR) are divisions of these, left to the screen so one
 * response serves any of them. `money.view`, for the reason the dashboard is.
 */
@Controller({ path: 'ops/reports', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsReportsController {
  constructor(private readonly dashboard: OwnerDashboardService) {}

  @Get('performance')
  @RequirePermission('money.view')
  performance(
    @Query(new ZodValidationPipe(OperatorPerformanceQuery)) query: OperatorPerformanceQuery,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<OperatorPerformance> {
    return this.dashboard.performance(workspace, query);
  }
}
