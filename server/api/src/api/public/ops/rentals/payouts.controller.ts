import { PayoutsQuery, type PayoutList, type PayoutView } from '@injishi/contracts';
import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';

import { PayoutsService } from '../../../../modules/rentals/application/payouts.service';
import type { ScopedWorkspace } from '../../../../shared/auth/branch-scope';
import { CurrentUser, SessionGuard, type SessionUser } from '../../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequireAnyPermission,
  RequirePermission,
  RequireProduct,
  WorkspaceGuard,
} from '../../../../shared/auth/workspace.guard';
import { ZodValidationPipe } from '../../../../shared/validation/zod-validation.pipe';

/**
 * Payouts → /api/v1/ops/payouts (blueprint 2.3 "Payouts"; WP 1.6b): the rent
 * paid out to the business, by month and status, and sending a failed or
 * held one again. Read by whoever reads the money or decides where it goes;
 * retried with `payout.manage`. Pay's, which owns payouts and where they go
 * (ADR-074; ADR-076 slice G).
 */
@Controller({ path: 'ops/payouts', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
@RequireProduct('pay')
export class OpsPayoutsController {
  constructor(private readonly payouts: PayoutsService) {}

  @Get()
  @RequireAnyPermission('money.view', 'payout.manage')
  list(@Query(new ZodValidationPipe(PayoutsQuery)) query: PayoutsQuery, @CurrentWorkspace() workspace: ScopedWorkspace): Promise<PayoutList> {
    return this.payouts.list(workspace, query);
  }

  /** Send a failed or held payout again, to the primary account as it stands now. */
  @Post(':id/retry')
  @HttpCode(200)
  @RequirePermission('payout.manage')
  retry(@Param('id', ParseUUIDPipe) id: string, @CurrentWorkspace() workspace: ScopedWorkspace, @CurrentUser() user: SessionUser): Promise<PayoutView> {
    return this.payouts.retry(workspace, user.id, id);
  }
}
