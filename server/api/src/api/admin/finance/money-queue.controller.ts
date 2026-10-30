import {
  MoneyOverrideRequest,
  MoneyResolveRequest,
  TreasuryAdjustmentRequest,
  type MoneyBalance,
  type MoneyOverrideList,
  type MoneyOverrideView,
  type MoneyPullResult,
  type MoneyQueue,
  type StaffAccess,
} from '@injishi/contracts';
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';

import { MoneyQueueService } from '../../../modules/pay/application/money-queue.service';
import { RequireStaffPermission } from '../../../shared/auth/require-staff-permission.decorator';
import { CurrentUser, SessionGuard, type SessionUser } from '../../../shared/auth/session.guard';
import { CurrentStaff, StaffGuard } from '../../../shared/auth/staff.guard';
import { IdempotencyKey } from '../../../shared/http/idempotency-key';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * The money queue — `/api/v1/admin/finance/payments` (073-gtbank-payments
 * AC-15, AC-19 to AC-21).
 *
 * `SessionGuard` then `StaffGuard`, in that order (see `AdminFinanceController`).
 * Reading the queue and pulling a row are `admin.finance.view`: neither moves
 * money. Resolving a row and requesting an override are
 * `admin.payout.release`. Approving one is `admin.money.override`, on the
 * overrides controller below, and only a different person may do it.
 */
@Controller({ path: 'admin/finance', version: '1' })
@UseGuards(SessionGuard, StaffGuard)
export class AdminMoneyQueueController {
  constructor(private readonly money: MoneyQueueService) {}

  /** Every row that needs a person, by bucket (AC-19). */
  @Get('payments')
  @RequireStaffPermission('admin.finance.view')
  queue(): Promise<MoneyQueue> {
    return this.money.list();
  }

  /** What the account can pay, what is out, and the last comparison with the bank (AC-19). */
  @Get('payments/balance')
  @RequireStaffPermission('admin.finance.view')
  balance(): Promise<MoneyBalance> {
    return this.money.balance();
  }

  /** Ask the bank about one row and apply its answer once. Moves no money (AC-20). */
  @Post('payments/:id/pull')
  @HttpCode(200)
  @RequireStaffPermission('admin.finance.view')
  pull(@Param('id', new ParseUUIDPipe()) id: string): Promise<MoneyPullResult> {
    return this.money.pull(id);
  }

  /** Close what moves no money: a parked row as failed, a reversal that stands (AC-20). */
  @Post('payments/:id/resolve')
  @HttpCode(200)
  @RequireStaffPermission('admin.payout.release')
  resolve(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(MoneyResolveRequest)) body: MoneyResolveRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<{ id: string; outcome: string }> {
    return this.money.resolve(id, body, user.id);
  }

  /** The first signature on a two person act (AC-21). */
  @Post('payments/:id/overrides')
  @RequireStaffPermission('admin.payout.release')
  requestOverride(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(MoneyOverrideRequest)) body: MoneyOverrideRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<MoneyOverrideView> {
    return this.money.requestOverride(id, body, user.id);
  }

  /** A deposit or a bank debit, recorded only once a second super admin approves it (AC-15). */
  @Post('treasury-adjustments')
  @RequireStaffPermission('admin.payout.release')
  treasuryAdjustment(
    @Body(new ZodValidationPipe(TreasuryAdjustmentRequest)) body: TreasuryAdjustmentRequest,
    @IdempotencyKey() key: string,
    @CurrentUser() user: SessionUser,
  ): Promise<MoneyOverrideView> {
    return this.money.requestTreasuryAdjustment(body, key, user.id);
  }
}

/**
 * The second signer — `/api/v1/admin/money-overrides` (AC-15, AC-21).
 *
 * Listing is `admin.finance.view`, so the requester sees their request wait.
 * Deciding is `admin.money.override`, which only a super admin holds, and the
 * service refuses the person who made the request; the table's dual
 * authorisation CHECK refuses it again underneath.
 */
@Controller({ path: 'admin/money-overrides', version: '1' })
@UseGuards(SessionGuard, StaffGuard)
export class AdminMoneyOverridesController {
  constructor(private readonly money: MoneyQueueService) {}

  @Get()
  @RequireStaffPermission('admin.finance.view')
  list(
    @CurrentStaff() staff: StaffAccess,
    @CurrentUser() user: SessionUser,
    @Query('state') state?: string,
  ): Promise<MoneyOverrideList> {
    return this.money.listOverrides(staff, user.id, state === 'all' ? 'all' : 'initiated');
  }

  @Post(':id/approve')
  @HttpCode(200)
  @RequireStaffPermission('admin.money.override')
  approve(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentStaff() staff: StaffAccess,
    @CurrentUser() user: SessionUser,
  ): Promise<MoneyOverrideView> {
    return this.money.approve(id, staff, user.id);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @RequireStaffPermission('admin.money.override')
  reject(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentStaff() staff: StaffAccess,
    @CurrentUser() user: SessionUser,
  ): Promise<MoneyOverrideView> {
    return this.money.reject(id, staff, user.id);
  }
}
