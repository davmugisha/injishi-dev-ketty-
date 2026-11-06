import {
  AssignFaultRequest,
  EXPENSE_RECEIPT_MAX_BYTES,
  FAULT_PHOTO_MAX_BYTES,
  FAULT_PHOTOS_PER_PHASE,
  FaultListQuery,
  FaultMessageRequest,
  FaultPhotoFields,
  MoveFaultRequest,
  PayFixerRequest,
  RaiseFaultRequest,
  RecordFaultPaymentRequest,
  type FaultDetail,
  type FaultListPage,
} from '@injishi/contracts';
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { FaultPaymentsService } from '../../../../modules/rentals/application/fault-payments.service';
import { FaultsService } from '../../../../modules/rentals/application/faults.service';
import type { ScopedWorkspace } from '../../../../shared/auth/branch-scope';
import { CurrentUser, SessionGuard, type SessionUser } from '../../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequirePermission,
  RequireProduct,
  WorkspaceGuard,
} from '../../../../shared/auth/workspace.guard';
import { IdempotencyKey } from '../../../../shared/http/idempotency-key';
import { UserThrottlerGuard } from '../../../../shared/http/user-throttler.guard';
import { ZodValidationPipe } from '../../../../shared/validation/zod-validation.pipe';
import { UploadThrottlerGuard } from '../../uploads/upload-throttler.guard';
import { normaliseFormFields, parseFields, readForm, type FormRequest } from './multipart-form';

const PHOTO_LIMITS = { maxFiles: FAULT_PHOTOS_PER_PHASE, maxBytes: FAULT_PHOTO_MAX_BYTES, what: 'A photo' } as const;
const RECEIPT_LIMITS = { maxFiles: 1, maxBytes: EXPENSE_RECEIPT_MAX_BYTES, what: 'A receipt' } as const;

/**
 * Faults → /api/v1/ops/faults (blueprint 2.3 "Faults", WP 4.1). Residence
 * businesses only, and every route is `ticket.advance`: whoever works the
 * faults reads them, moves them, hands them over, adds photos and writes on
 * them. A reply the tenant sees also needs `message.send` (the service
 * checks). Paying the fixer, through Injishi or recorded, is
 * `expense.manage` (WP 4.3), and the payments show on a fault only to a
 * reader of money. Moves the chain refuses are 409; "won't fix" needs the
 * reason.
 *
 * Raising a fault and adding photos take multipart/form-data (the fields
 * beside up to four photos, `photos`), or JSON when there is no photo.
 */
@Controller({ path: 'ops/faults', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
@RequireProduct('residence')
export class OpsFaultsController {
  constructor(
    private readonly faults: FaultsService,
    private readonly payments: FaultPaymentsService,
  ) {}

  @Get()
  @RequirePermission('ticket.advance')
  list(@Query(new ZodValidationPipe(FaultListQuery)) query: FaultListQuery, @CurrentWorkspace() workspace: ScopedWorkspace): Promise<FaultListPage> {
    return this.faults.list(workspace, query);
  }

  @Get(':id')
  @RequirePermission('ticket.advance')
  detail(@Param('id', ParseUUIDPipe) id: string, @CurrentWorkspace() workspace: ScopedWorkspace): Promise<FaultDetail> {
    return this.faults.detail(workspace, id);
  }

  /** The landlord writes down a fault on a unit, with photos. */
  @Post()
  @RequirePermission('ticket.advance')
  @UseGuards(UploadThrottlerGuard)
  async raise(@Req() request: FormRequest, @CurrentWorkspace() workspace: ScopedWorkspace, @CurrentUser() user: SessionUser): Promise<FaultDetail> {
    const form = await readForm(request, PHOTO_LIMITS);
    const body = parseFields(RaiseFaultRequest, normaliseFormFields(form.fields));
    return this.faults.raise(workspace, user.id, body, form.files.map((f) => ({ filename: f.filename, body: f.body })));
  }

  @Post(':id/move')
  @HttpCode(200)
  @RequirePermission('ticket.advance')
  move(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(MoveFaultRequest)) body: MoveFaultRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<FaultDetail> {
    return this.faults.move(workspace, user.id, id, body);
  }

  @Post(':id/assign')
  @HttpCode(200)
  @RequirePermission('ticket.advance')
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AssignFaultRequest)) body: AssignFaultRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<FaultDetail> {
    return this.faults.assign(workspace, user.id, id, body);
  }

  /** Photos of the report, the work or the fix (`phase`), at most four in each. */
  @Post(':id/photos')
  @HttpCode(200)
  @RequirePermission('ticket.advance')
  @UseGuards(UploadThrottlerGuard)
  async photos(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: FormRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<FaultDetail> {
    const form = await readForm(request, PHOTO_LIMITS);
    const { phase } = parseFields(FaultPhotoFields, normaliseFormFields(form.fields));
    return this.faults.addPhotos(workspace, user.id, id, phase, form.files.map((f) => ({ filename: f.filename, body: f.body })));
  }

  @Post(':id/messages')
  @HttpCode(200)
  @RequirePermission('ticket.advance')
  message(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(FaultMessageRequest)) body: FaultMessageRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<FaultDetail> {
    return this.faults.message(workspace, user.id, id, body);
  }

  /**
   * Pay the fixer through Injishi (WP 4.3): a prompt goes to the landlord's
   * own phone, then the money to the fixer's MoMo, Airtel Money or bank. The
   * answer shows the payment waiting; PaymentSettlement makes it a repairs
   * expense once it lands. Takes an `Idempotency-Key`; throttled per person.
   */
  @Post(':id/pay')
  @HttpCode(200)
  @RequirePermission('expense.manage')
  @UseGuards(UserThrottlerGuard)
  @Throttle({ money: { limit: 6, ttl: 60_000 } })
  async pay(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(PayFixerRequest)) body: PayFixerRequest,
    @IdempotencyKey() key: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<FaultDetail> {
    await this.payments.pay(workspace, user.id, id, body, key);
    return this.faults.detail(workspace, id);
  }

  /** Write down a payment to the fixer made outside Injishi, with a receipt (`receipt`, multipart) if there is one. */
  @Post(':id/payments/recorded')
  @HttpCode(200)
  @RequirePermission('expense.manage')
  @UseGuards(UploadThrottlerGuard)
  async recordPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: FormRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<FaultDetail> {
    const form = await readForm(request, RECEIPT_LIMITS);
    const body = parseFields(RecordFaultPaymentRequest, normaliseFormFields(form.fields, ['amountRwf']));
    const file = form.files[0];
    await this.payments.record(workspace, user.id, id, body, file ? { filename: file.filename, mime: file.mime, body: file.body } : null);
    return this.faults.detail(workspace, id);
  }
}
