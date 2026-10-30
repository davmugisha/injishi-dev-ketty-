import {
  CloseFolioRequest,
  type CloseFolioResult,
  type OperatorFolioDetail,
  type OperatorFolioList,
  PostChargeRequest,
  type PostChargeResult,
  TakePaymentRequest,
  VoidChargeRequest,
} from '@injishi/contracts';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';

import { FolioService } from '../../../modules/pms/application/folio.service';
import {
  CurrentUser,
  SessionGuard,
  type SessionUser,
} from '../../../shared/auth/session.guard';
import { IdempotencyKey } from '../../../shared/http/idempotency-key';
import {
  CurrentWorkspace,
  RequireAnyPermission,
  RequirePermission,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * The guest bill -> /api/v1/ops/folios (ADR-016 slice 3).
 *
 * TWO GATING CHOICES HERE READ ODDLY AND ARE DELIBERATE, and both were made
 * against the shipped role map rather than against the name of the permission:
 *
 * - **The reads are gated on `folio.charge`, not `money.view`.** A receptionist
 *   holds the first and not the second. Gating the bill on `money.view` would
 *   hide the bill from the person writing it, which is nobody's idea of a front
 *   desk.
 * - **There is no `POST /ops/folios`.** The system opens a folio: a pre-arrival
 *   one when a booking is confirmed, bound to the stay at check in. A bill with
 *   no subject is not a thing an operator should be able to make.
 *
 * Every command carries an `Idempotency-Key`. A front desk on a property
 * network retries, and a retried payment charges the guest twice. The void
 * joins them for the same reason: a repeated void is exactly as damaging as a
 * repeated payment.
 */
@Controller({ path: 'ops/folios', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsFoliosController {
  constructor(private readonly folios: FolioService) {}

  /**
   * The Bills list. The desk works it (`folio.charge`); Finance reads the
   * same bills under `money.view`.
   */
  @Get()
  @RequireAnyPermission('folio.charge', 'money.view')
  async list(
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<OperatorFolioList> {
    return { folios: await this.folios.list(workspace) };
  }

  /** One bill, with its lines. The desk's bill, and Finance's bill lens. */
  @Get(':id')
  @RequireAnyPermission('folio.charge', 'money.view')
  detail(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<OperatorFolioDetail> {
    return this.folios.detail(workspace, id);
  }

  /**
   * Post a charge.
   *
   * `amountRwf` is tax exclusive. The tax is read from the rate effective right
   * now and posted as its own line, so an invoice never has to pull the two
   * apart again. A charge aimed at a signed bill lands on the stay's next one,
   * and `openedFolioId` says so (ADR-050 D-c).
   */
  @Post(':id/charges')
  @RequirePermission('folio.charge')
  postCharge(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(PostChargeRequest)) body: PostChargeRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
    @IdempotencyKey() key: string,
  ): Promise<PostChargeResult> {
    return this.folios.postCharge(workspace, id, body, user.id, key);
  }

  /**
   * Take a payment. Posts cash only; the revenue was posted when the charge was.
   */
  @Post(':id/payments')
  @RequirePermission('folio.payment')
  takePayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(TakePaymentRequest)) body: TakePaymentRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
    @IdempotencyKey() key: string,
  ): Promise<OperatorFolioDetail> {
    return this.folios.takePayment(workspace, id, body, user.id, key);
  }

  /**
   * Void a charge.
   *
   * Same permission as posting one, because they are one job with two answers:
   * anyone trusted to put a charge on a bill is trusted to take a mistake off.
   */
  @Post(':id/charges/:chargeId/void')
  @RequirePermission('folio.charge')
  voidCharge(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('chargeId', ParseUUIDPipe) chargeId: string,
    @Body(new ZodValidationPipe(VoidChargeRequest)) body: VoidChargeRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
    @IdempotencyKey() key: string,
  ): Promise<OperatorFolioDetail> {
    return this.folios.voidCharge(workspace, id, chargeId, body, user.id, key);
  }

  /**
   * Close a bill, which SIGNS ITS SALE with RRA (ADR-050 D-a). Refuses a non
   * zero balance.
   *
   * `folio.close`, not `folio.payment` as it was: closing now declares
   * turnover, and a fiscal act must be nameable in an audit rather than ride on
   * a permission granted for taking money (ADR-050 D-t, AC-8). The body is
   * optional; most guests are not businesses.
   */
  @Post(':id/close')
  @RequirePermission('folio.close')
  close(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @Body(new ZodValidationPipe(CloseFolioRequest.optional()))
    body: CloseFolioRequest | undefined,
  ): Promise<CloseFolioResult> {
    return this.folios.close(workspace, id, body ?? {});
  }
}
