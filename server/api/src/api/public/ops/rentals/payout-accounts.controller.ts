import { PayoutAccountInput, type PayoutAccountList } from '@injishi/contracts';
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';

import { PayoutAccountsService } from '../../../../modules/rentals/application/payout-accounts.service';
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
 * Getting paid → /api/v1/ops/payout-accounts (blueprint 2.3; feat/rentals'
 * controller, ported). Where the payment gateway sends the business's rent: a
 * bank account, a MoMo number or a MoMo Pay code.
 *
 * Read by whoever reads the money; changed only with `payout.manage`, the
 * owner's by default, because whoever changes it decides where every tenant's
 * rent lands. Every write answers the whole list. Pay's, which owns payout
 * destinations (ADR-074; ADR-076 slice G).
 */
@Controller({ path: 'ops/payout-accounts', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
@RequireProduct('pay')
export class OpsPayoutAccountsController {
  constructor(private readonly accounts: PayoutAccountsService) {}

  @Get()
  @RequireAnyPermission('payout.manage', 'money.view')
  list(@CurrentWorkspace() workspace: ScopedWorkspace): Promise<PayoutAccountList> {
    return this.accounts.list(workspace);
  }

  @Post()
  @RequirePermission('payout.manage')
  create(
    @Body(new ZodValidationPipe(PayoutAccountInput)) body: PayoutAccountInput,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PayoutAccountList> {
    return this.accounts.create(workspace, user.id, body);
  }

  @Patch(':id')
  @RequirePermission('payout.manage')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(PayoutAccountInput)) body: PayoutAccountInput,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PayoutAccountList> {
    return this.accounts.update(workspace, user.id, id, body);
  }

  @Post(':id/primary')
  @HttpCode(200)
  @RequirePermission('payout.manage')
  makePrimary(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PayoutAccountList> {
    return this.accounts.makePrimary(workspace, user.id, id);
  }

  @Post(':id/retire')
  @HttpCode(200)
  @RequirePermission('payout.manage')
  retire(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PayoutAccountList> {
    return this.accounts.retire(workspace, user.id, id);
  }
}
