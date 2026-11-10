import {
  MoveOutListQuery,
  RecordMoveOutRequest,
  RecordedNoticeRequest,
  SettleDepositRequest,
  type DepositList,
  type DepositView,
  type LeaseDetail,
  type MoveOutList,
} from '@injishi/contracts';
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { DepositsService } from '../../../../modules/rentals/application/deposits.service';
import { MoveOutsService } from '../../../../modules/rentals/application/move-outs.service';
import type { ScopedWorkspace } from '../../../../shared/auth/branch-scope';
import { CurrentUser, SessionGuard, type SessionUser } from '../../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequireAnyPermission,
  RequirePermission,
  RequireProduct,
  WorkspaceGuard,
} from '../../../../shared/auth/workspace.guard';
import { IdempotencyKey } from '../../../../shared/http/idempotency-key';
import { UserThrottlerGuard } from '../../../../shared/http/user-throttler.guard';
import { ZodValidationPipe } from '../../../../shared/validation/zod-validation.pipe';

/**
 * Moving out → /api/v1/ops (blueprint 2.3 "Deposits and move-outs", WP 1.7).
 *
 * A notice that reached the landlord outside Injishi, acknowledging a notice
 * and recording the move out are `lease.manage`. Settling a deposit moves the
 * landlord's money back to the tenant: `deposit.return`, with an
 * `Idempotency-Key` and throttled per person. The move-outs page reads with
 * `lease.manage` or `deposit.return`; the deposits list and one deposit with
 * any of `deposit.return`, `lease.manage`, `money.view`.
 */
@Controller({ path: 'ops', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
@RequireProduct('residence')
export class OpsMoveOutsController {
  constructor(
    private readonly moveOuts: MoveOutsService,
    private readonly deposits: DepositsService,
  ) {}

  @Get('move-outs')
  @RequireAnyPermission('lease.manage', 'deposit.return')
  list(
    @Query(new ZodValidationPipe(MoveOutListQuery)) query: MoveOutListQuery,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<MoveOutList> {
    return this.moveOuts.list(workspace, query);
  }

  /** A notice received by letter, email or in person, or one the landlord gives. */
  @Post('leases/:id/notice')
  @HttpCode(200)
  @RequirePermission('lease.manage')
  recordNotice(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(RecordedNoticeRequest)) body: RecordedNoticeRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<LeaseDetail> {
    return this.moveOuts.recordNotice(workspace, user.id, id, body);
  }

  /** Acknowledge the notice: the lease is ending and the tenant is emailed. */
  @Post('leases/:id/notice/acknowledge')
  @HttpCode(200)
  @RequirePermission('lease.manage')
  acknowledge(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<LeaseDetail> {
    return this.moveOuts.acknowledge(workspace, user.id, id);
  }

  /** The day the tenant moved out: the lease ends and later rent is waived. */
  @Post('leases/:id/move-out')
  @HttpCode(200)
  @RequirePermission('lease.manage')
  moveOut(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(RecordMoveOutRequest)) body: RecordMoveOutRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<LeaseDetail> {
    return this.moveOuts.recordMoveOut(workspace, user.id, id, body);
  }

  @Get('deposits')
  @RequireAnyPermission('deposit.return', 'lease.manage', 'money.view')
  depositList(@CurrentWorkspace() workspace: ScopedWorkspace): Promise<DepositList> {
    return this.deposits.list(workspace);
  }

  /** One deposit; a refund waiting on the landlord's phone is looked at first. */
  @Get('deposits/:id')
  @RequireAnyPermission('deposit.return', 'lease.manage', 'money.view')
  deposit(@Param('id', ParseUUIDPipe) id: string, @CurrentWorkspace() workspace: ScopedWorkspace): Promise<DepositView> {
    return this.deposits.detail(workspace, id);
  }

  /** Settle the deposit: deductions kept, the rest refunded through Injishi, recorded, or none. */
  @Post('deposits/:id/settle')
  @HttpCode(200)
  @RequirePermission('deposit.return')
  @UseGuards(UserThrottlerGuard)
  @Throttle({ money: { limit: 6, ttl: 60_000 } })
  settle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(SettleDepositRequest)) body: SettleDepositRequest,
    @IdempotencyKey() key: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<DepositView> {
    return this.deposits.settle(workspace, user.id, id, body, key);
  }
}
