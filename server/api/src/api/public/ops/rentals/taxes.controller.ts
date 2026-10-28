import {
  FILING_PROOF_MAX_BYTES,
  LeaseFilingsQuery,
  MarkFilingFiledRequest,
  SetTaxpayerRequest,
  TAX_RECEIPT_MAX_BYTES,
  TaxYearParam,
  UpdateTaxDeclarationRequest,
  type LeaseFilingList,
  type LeaseFilingView,
  type TaxYearView,
  type TaxpayerView,
} from '@injishi/contracts';
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, Req, UseGuards } from '@nestjs/common';

import { FilingsService } from '../../../../modules/rentals/application/filings.service';
import { TaxesService } from '../../../../modules/rentals/application/taxes.service';
import type { ScopedWorkspace } from '../../../../shared/auth/branch-scope';
import { CurrentUser, SessionGuard, type SessionUser } from '../../../../shared/auth/session.guard';
import { CurrentWorkspace, RequireAnyPermission, RequirePermission, WorkspaceGuard } from '../../../../shared/auth/workspace.guard';
import { ZodValidationPipe } from '../../../../shared/validation/zod-validation.pipe';
import { UploadThrottlerGuard } from '../../uploads/upload-throttler.guard';
import { normaliseFormFields, parseFields, readForm, type FormRequest } from './multipart-form';

/**
 * Rental income tax → /api/v1/ops/taxes (blueprint 2.3 "Expenses and taxes",
 * WP 4.4). Residence businesses only. Whether the business lets as a person
 * or a company reads under `money.view` or `tax.manage` and is set with
 * `tax.manage`; a year's figures read under `money.view` or `tax.manage`;
 * marking its declaration is `tax.manage` (multipart, the fields beside one
 * `receipt`, or JSON with none). The year must be over; a company is refused.
 */
@Controller({ path: 'ops/taxes', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsTaxesController {
  constructor(private readonly taxes: TaxesService) {}

  @Get('taxpayer')
  @RequireAnyPermission('money.view', 'tax.manage')
  taxpayer(@CurrentWorkspace() workspace: ScopedWorkspace): Promise<TaxpayerView> {
    return this.taxes.taxpayer(workspace);
  }

  @Put('taxpayer')
  @RequirePermission('tax.manage')
  setTaxpayer(
    @Body(new ZodValidationPipe(SetTaxpayerRequest)) body: SetTaxpayerRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<TaxpayerView> {
    return this.taxes.setTaxpayer(workspace, user.id, body.kind);
  }

  @Get(':year')
  @RequireAnyPermission('money.view', 'tax.manage')
  year(@Param('year', new ZodValidationPipe(TaxYearParam)) year: number, @CurrentWorkspace() workspace: ScopedWorkspace): Promise<TaxYearView> {
    return this.taxes.year(workspace, year);
  }

  @Put(':year/declaration')
  @RequirePermission('tax.manage')
  @UseGuards(UploadThrottlerGuard)
  async declare(
    @Param('year', new ZodValidationPipe(TaxYearParam)) year: number,
    @Req() request: FormRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<TaxYearView> {
    const form = await readForm(request, { maxFiles: 1, maxBytes: TAX_RECEIPT_MAX_BYTES, what: 'The receipt' });
    const body = parseFields(UpdateTaxDeclarationRequest, normaliseFormFields(form.fields, ['amountPaidRwf']));
    const file = form.files[0];
    return this.taxes.declare(workspace, user.id, year, body, file ? { filename: file.filename, mime: file.mime, body: file.body } : null);
  }
}

/**
 * Lease copies owed to RRA → /api/v1/ops/filings (WP 4.4). Read by whoever
 * reads the money, the taxes or the leases; marked filed with `tax.manage`
 * (multipart, the fields beside one `proof`, or JSON with none).
 */
@Controller({ path: 'ops/filings', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsFilingsController {
  constructor(private readonly filings: FilingsService) {}

  @Get()
  @RequireAnyPermission('money.view', 'tax.manage', 'lease.manage')
  list(@Query(new ZodValidationPipe(LeaseFilingsQuery)) query: LeaseFilingsQuery, @CurrentWorkspace() workspace: ScopedWorkspace): Promise<LeaseFilingList> {
    return this.filings.list(workspace, query);
  }

  @Post(':id/filed')
  @HttpCode(200)
  @RequirePermission('tax.manage')
  @UseGuards(UploadThrottlerGuard)
  async filed(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: FormRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<LeaseFilingView> {
    const form = await readForm(request, { maxFiles: 1, maxBytes: FILING_PROOF_MAX_BYTES, what: 'The proof' });
    const body = parseFields(MarkFilingFiledRequest, normaliseFormFields(form.fields));
    const file = form.files[0];
    return this.filings.markFiled(workspace, user.id, id, body, file ? { filename: file.filename, mime: file.mime, body: file.body } : null);
  }
}
