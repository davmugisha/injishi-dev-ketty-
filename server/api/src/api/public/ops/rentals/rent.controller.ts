import {
  RentChargesQuery,
  RentMonthQuery,
  RentPaymentsQuery,
  RentRemindersQuery,
  RemindRentRequest,
  WaiveChargeRequest,
  type LeaseChargeList,
  type LeaseChargeView,
  type LeasePaymentList,
  type LeasePaymentView,
  type LeaseReminderList,
  type RemindersSent,
  type RentRoll,
  type RentSummary,
} from '@injishi/contracts';
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';

import { RentPaymentsService } from '../../../../modules/rentals/application/rent-payments.service';
import { RentReadsService } from '../../../../modules/rentals/application/rent-reads.service';
import { RentRemindersService } from '../../../../modules/rentals/application/rent-reminders.service';
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
 * Rent → /api/v1/ops/rent (blueprint 2.3 "Rent"; WP 1.6a). Residence
 * businesses only.
 *
 * The reads (the roll, charges, payments, reminders, the month's figures)
 * admit whoever works rent or reads the money; reminding tenants is
 * `rent.record`. Rent is paid only through the payment integration
 * (2026-10-25): there is no route to record, reverse or slip a payment made
 * outside Injishi, and those recorded before are read as "Recorded". Waiving
 * a charge forgives money and is `lease.manage`.
 */
@Controller({ path: 'ops/rent', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
@RequireProduct('residence')
export class OpsRentController {
  constructor(
    private readonly reads: RentReadsService,
    private readonly payments: RentPaymentsService,
    private readonly reminders: RentRemindersService,
  ) {}

  @Get('roll')
  @RequireAnyPermission('rent.record', 'money.view')
  roll(@Query(new ZodValidationPipe(RentMonthQuery)) query: RentMonthQuery, @CurrentWorkspace() workspace: ScopedWorkspace): Promise<RentRoll> {
    return this.reads.rentRoll(workspace, query);
  }

  @Get('summary')
  @RequireAnyPermission('rent.record', 'money.view')
  summary(@Query(new ZodValidationPipe(RentMonthQuery)) query: RentMonthQuery, @CurrentWorkspace() workspace: ScopedWorkspace): Promise<RentSummary> {
    return this.reads.summary(workspace, query);
  }

  @Get('charges')
  @RequireAnyPermission('rent.record', 'money.view')
  charges(@Query(new ZodValidationPipe(RentChargesQuery)) query: RentChargesQuery, @CurrentWorkspace() workspace: ScopedWorkspace): Promise<LeaseChargeList> {
    return this.reads.charges(workspace, query);
  }

  @Post('charges/:id/waive')
  @HttpCode(200)
  @RequirePermission('lease.manage')
  waive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(WaiveChargeRequest)) body: WaiveChargeRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<LeaseChargeView> {
    return this.payments.waive(workspace, user.id, id, body);
  }

  @Get('payments')
  @RequireAnyPermission('rent.record', 'money.view')
  payments_(@Query(new ZodValidationPipe(RentPaymentsQuery)) query: RentPaymentsQuery, @CurrentWorkspace() workspace: ScopedWorkspace): Promise<LeasePaymentList> {
    return this.reads.payments(workspace, query);
  }

  @Get('payments/:id')
  @RequireAnyPermission('rent.record', 'money.view')
  payment(@Param('id', ParseUUIDPipe) id: string, @CurrentWorkspace() workspace: ScopedWorkspace): Promise<LeasePaymentView> {
    return this.reads.payment(workspace, id);
  }

  @Get('reminders')
  @RequireAnyPermission('rent.record', 'money.view')
  reminders_(@Query(new ZodValidationPipe(RentRemindersQuery)) query: RentRemindersQuery, @CurrentWorkspace() workspace: ScopedWorkspace): Promise<LeaseReminderList> {
    return this.reads.reminders(workspace, query);
  }

  /** Remind the tenants of these charges now, by email. At most once per charge per day. */
  @Post('reminders')
  @RequirePermission('rent.record')
  remind(
    @Body(new ZodValidationPipe(RemindRentRequest)) body: RemindRentRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<RemindersSent> {
    return this.reminders.sendManual(workspace, user.id, body);
  }
}
