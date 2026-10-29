import {
  CreateMyPayClaimRequest,
  type MyLoanList,
  type MyPayClaimList,
  type MyPayslipList,
  type PayClaim,
} from '@injishi/contracts';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';

import { MyPayService } from '../../../modules/hr/application/my-pay.service';
import {
  CurrentUser,
  SessionGuard,
  type SessionUser,
} from '../../../shared/auth/session.guard';
import { IdempotencyKey } from '../../../shared/http/idempotency-key';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';
import type { FileReply } from '../ops/pay-runs.controller';

/**
 * A person's own pay -> /api/v1/me/work/:employeeId (ADR-058,
 * 058-self-service AC-SS7, the routes marked 6; 058-payroll AC-PY9, AC-PY11).
 *
 * `SessionGuard` only, as every `me/work` route: ownership is the guard, any
 * id that is not the caller's answers 404, and a file the person has left is
 * read only (409). Only confirmed payslips are listed or printed. A claim's
 * receipt is uploaded first, to `files`, and the claim names its key.
 */
@Controller({ path: 'me/work', version: '1' })
@UseGuards(SessionGuard)
export class MeWorkPayController {
  constructor(private readonly pay: MyPayService) {}

  @Get(':employeeId/payslips')
  payslips(@Param('employeeId', ParseUUIDPipe) employeeId: string, @CurrentUser() user: SessionUser): Promise<MyPayslipList> {
    return this.pay.payslips(user.id, employeeId);
  }

  @Get(':employeeId/payslips/:id/pdf')
  async payslipPdf(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: SessionUser,
    @Res({ passthrough: true }) reply: FileReply,
  ): Promise<void> {
    const file = await this.pay.payslipPdf(user.id, employeeId, id);
    reply
      .header('content-type', 'application/pdf')
      .header('content-disposition', `attachment; filename="${file.filename}"`)
      .header('cache-control', 'no-store')
      .send(file.body);
  }

  @Get(':employeeId/loans')
  loans(@Param('employeeId', ParseUUIDPipe) employeeId: string, @CurrentUser() user: SessionUser): Promise<MyLoanList> {
    return this.pay.loans(user.id, employeeId);
  }

  @Get(':employeeId/claims')
  claims(@Param('employeeId', ParseUUIDPipe) employeeId: string, @CurrentUser() user: SessionUser): Promise<MyPayClaimList> {
    return this.pay.claims(user.id, employeeId);
  }

  /** A retry with the same key answers the first claim. */
  @Post(':employeeId/claims')
  createClaim(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body(new ZodValidationPipe(CreateMyPayClaimRequest)) body: CreateMyPayClaimRequest,
    @IdempotencyKey() key: string,
    @CurrentUser() user: SessionUser,
  ): Promise<PayClaim> {
    return this.pay.createClaim(user.id, employeeId, key, body);
  }

  @Post(':employeeId/claims/:id/cancel')
  @HttpCode(200)
  cancelClaim(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: SessionUser,
  ): Promise<PayClaim> {
    return this.pay.cancelClaim(user.id, employeeId, id);
  }
}
