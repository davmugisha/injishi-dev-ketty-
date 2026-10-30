import type { StaysActivity, StaysSummary } from '@injishi/contracts';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { StaysOverviewService } from '../../../modules/pms/application/stays-overview.service';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { SessionGuard } from '../../../shared/auth/session.guard';
import { CurrentWorkspace, RequireAnyPermission, WorkspaceGuard } from '../../../shared/auth/workspace.guard';

/**
 * A short-stay business's home → /api/v1/ops/stays-overview (2026-10-29).
 *
 * The summary (how the business is run, today's counts) reads under any front desk or money permission:
 * it feeds the sidebar of everyone who works there. The activity carries guests' names and money, so it
 * reads under the desk's and finance's permissions.
 */
@Controller({ path: 'ops/stays-overview', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsStaysOverviewController {
  constructor(private readonly overview: StaysOverviewService) {}

  @Get('summary')
  @RequireAnyPermission('stay.checkin', 'stay.checkout', 'folio.charge', 'reservation.approve', 'money.view')
  summary(@CurrentWorkspace() workspace: ScopedWorkspace): Promise<StaysSummary> {
    return this.overview.summary(workspace);
  }

  @Get('activity')
  @RequireAnyPermission('stay.checkin', 'stay.checkout', 'folio.charge', 'money.view')
  activity(
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<StaysActivity> {
    return this.overview.activity(workspace, { from, to });
  }
}
