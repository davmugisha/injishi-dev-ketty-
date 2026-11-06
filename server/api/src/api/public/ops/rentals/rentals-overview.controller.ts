import type { RentalsMoney, RentalsOverview, RentalsSummary } from '@injishi/contracts';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { RentalsOverviewService } from '../../../../modules/rentals/application/rentals-overview.service';
import type { ScopedWorkspace } from '../../../../shared/auth/branch-scope';
import { SessionGuard } from '../../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequireAnyPermission,
  RequireProduct,
  WorkspaceGuard,
} from '../../../../shared/auth/workspace.guard';

/**
 * The landlord's home → /api/v1/ops/rentals (blueprint 2.3 "Overview and
 * settings", WP 2.2). Residence businesses only: any other answers 404.
 *
 * The summary (the navigation's counts and "Needs attention") reads under any
 * rentals permission, as the profile and setup do. The overview carries money
 * (rent expected and collected, overdue), so it reads under the money reads:
 * `money.view`, `rent.record` or `lease.manage`.
 */
@Controller({ path: 'ops/rentals', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
@RequireProduct('residence')
export class OpsRentalsOverviewController {
  constructor(private readonly overview: RentalsOverviewService) {}

  @Get('summary')
  @RequireAnyPermission('lease.manage', 'unit.manage', 'listing.manage', 'money.view', 'rent.record', 'deposit.return', 'payout.manage', 'lease.sign')
  summary(@CurrentWorkspace() workspace: ScopedWorkspace): Promise<RentalsSummary> {
    return this.overview.summary(workspace);
  }

  @Get('overview')
  @RequireAnyPermission('money.view', 'rent.record', 'lease.manage')
  figures(@CurrentWorkspace() workspace: ScopedWorkspace): Promise<RentalsOverview> {
    return this.overview.overview(workspace);
  }

  /** The money by the day for the home's period filter, charts and payments calendar (2026-10-28). */
  @Get('money')
  @RequireAnyPermission('money.view', 'rent.record', 'lease.manage')
  money(
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<RentalsMoney> {
    return this.overview.money(workspace, { from, to });
  }
}
