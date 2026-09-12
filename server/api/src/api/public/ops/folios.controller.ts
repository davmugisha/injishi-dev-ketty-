import {
  type OperatorFolioDetail,
  type OperatorFolioList,
  PostChargeRequest,
  TakePaymentRequest,
  VoidChargeRequest,
  type WorkspaceAccess,
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

import { FolioService } from '../../../modules/operations/application/folio.service';
import {
  CurrentUser,
  SessionGuard,
  type SessionUser,
} from '../../../shared/auth/session.guard';
import { IdempotencyKey } from '../../../shared/http/idempotency-key';
import {
  CurrentWorkspace,
  RequirePermission,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';
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

  /** The Bills list. */
  @Get()
  @RequirePermission('folio.charge')
  async list(
    @CurrentWorkspace() workspace: WorkspaceAccess,
  ): Promise<OperatorFolioList> {
    return { folios: await this.folios.list(workspace) };
  }

  /** One bill, with its lines. */
  @Get(':id')
  @RequirePermission('folio.charge')
  detail(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: WorkspaceAccess,
  ): Promise<OperatorFolioDetail> {
    return this.folios.detail(workspace, id);
  }

  /**
   * Post a charge.
   *
   * `amountRwf` is tax exclusive. The tax is read from the rate effective right
   * now and posted as its own line, so an invoice never has to pull the two
   * apart again.
   */
  @Post(':id/charges')
  @RequirePermission('folio.charge')
  postCharge(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(PostChargeRequest)) body: PostChargeRequest,
    @CurrentWorkspace() workspace: WorkspaceAccess,
    @CurrentUser() user: SessionUser,
    @IdempotencyKey() key: string,
  ): Promise<OperatorFolioDetail> {
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
    @CurrentWorkspace() workspace: WorkspaceAccess,
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
    @CurrentWorkspace() workspace: WorkspaceAccess,
    @CurrentUser() user: SessionUser,
    @IdempotencyKey() key: string,
  ): Promise<OperatorFolioDetail> {
    return this.folios.voidCharge(workspace, id, chargeId, body, user.id, key);
  }

  /**
   * Close a bill. Refuses a non zero balance.
   *
   * `folio.payment` rather than `folio.charge`: closing is the last act of
   * settling, and the person who takes the money is the person who says the
   * bill is finished.
   */
  @Post(':id/close')
  @RequirePermission('folio.payment')
  close(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: WorkspaceAccess,
  ): Promise<OperatorFolioDetail> {
    return this.folios.close(workspace, id);
  }
}
