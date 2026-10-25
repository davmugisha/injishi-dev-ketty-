import {
  RecordLeasePaymentRequest,
  RentChargesQuery,
  RentMonthQuery,
  RentPaymentsQuery,
  RentRemindersQuery,
  ReverseRentPaymentRequest,
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
import { BadRequestException, Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';

import { RentPaymentsService } from '../../../../modules/rentals/application/rent-payments.service';
import { RentReadsService } from '../../../../modules/rentals/application/rent-reads.service';
import { RentRemindersService } from '../../../../modules/rentals/application/rent-reminders.service';
import type { ScopedWorkspace } from '../../../../shared/auth/branch-scope';
import { CurrentUser, SessionGuard, type SessionUser } from '../../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequireAnyPermission,
  RequirePermission,
  WorkspaceGuard,
} from '../../../../shared/auth/workspace.guard';
import { IdempotencyKey } from '../../../../shared/http/idempotency-key';
import { ZodValidationPipe } from '../../../../shared/validation/zod-validation.pipe';
import { UploadThrottlerGuard } from '../../uploads/upload-throttler.guard';

/** The slice of the Fastify request the slip upload touches (see `uploads.controller.ts`). */
interface MultipartRequest {
  isMultipart?: () => boolean;
  file?: (options?: { limits?: { fileSize?: number } }) => Promise<{ filename?: string; mimetype?: string; file?: { truncated?: boolean }; toBuffer: () => Promise<Buffer> } | undefined>;
}

const SLIP_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Rent → /api/v1/ops/rent (blueprint 2.3 "Rent"; WP 1.6a). Residence
 * businesses only.
 *
 * The reads (the roll, charges, payments, reminders, the month's figures)
 * admit whoever records rent or reads the money. Recording a payment, a slip
 * on it, reversing it and reminding tenants are `rent.record`; a payment
 * takes an `Idempotency-Key`, so a retried press records it once. Waiving a
 * charge forgives money and is `lease.manage`.
 */
@Controller({ path: 'ops/rent', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
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

  /** Record money received outside Injishi. It pays the open charges oldest due first, or the charges named. */
  @Post('payments')
  @RequirePermission('rent.record')
  record(
    @Body(new ZodValidationPipe(RecordLeasePaymentRequest)) body: RecordLeasePaymentRequest,
    @IdempotencyKey() key: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<LeasePaymentView> {
    return this.payments.record(workspace, user.id, key, body);
  }

  @Get('payments/:id')
  @RequireAnyPermission('rent.record', 'money.view')
  payment(@Param('id', ParseUUIDPipe) id: string, @CurrentWorkspace() workspace: ScopedWorkspace): Promise<LeasePaymentView> {
    return this.reads.payment(workspace, id);
  }

  /** Undo a recorded payment. Its charges reopen; the row stays, reversed, with the reason. */
  @Post('payments/:id/reverse')
  @HttpCode(200)
  @RequirePermission('rent.record')
  reverse(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ReverseRentPaymentRequest)) body: ReverseRentPaymentRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<LeasePaymentView> {
    return this.payments.reverse(workspace, user.id, id, body);
  }

  /** Attach a photo or scan of the slip (one multipart file, `file`, at most 10 MB). */
  @Post('payments/:id/receipt')
  @HttpCode(200)
  @RequirePermission('rent.record')
  @UseGuards(UploadThrottlerGuard)
  async slip(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: MultipartRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<LeasePaymentView> {
    if (typeof request.isMultipart !== 'function' || !request.isMultipart() || typeof request.file !== 'function') {
      throw new BadRequestException('Send the slip as multipart/form-data.');
    }
    const part = await request.file({ limits: { fileSize: SLIP_MAX_BYTES } });
    if (!part) throw new BadRequestException('Attach the slip as the file.');
    const body = await part.toBuffer();
    if (part.file?.truncated) throw new BadRequestException('A slip must be 10 MB or smaller.');
    return this.payments.attachSlip(workspace, user.id, id, { body, mime: part.mimetype ?? 'application/octet-stream', filename: part.filename ?? 'slip' });
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
