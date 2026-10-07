import {
  CreateLoanRequest,
  CreatePayAdjustmentRequest,
  CreatePayClaimRequest,
  CreatePayComponentRequest,
  CreatePayStructureRequest,
  MarkPaidParams,
  PayClaimBulkRequest,
  PayDecisionRequest,
  PayPeriod,
  PayslipBulkRequest,
  SettleLoanRequest,
  UnmarkPaidRequest,
  UpdateContractPayTermsRequest,
  UpdatePayComponentRequest,
  UpdatePayStructureRequest,
  WaivePayAdjustmentRequest,
  type BulkResponse,
  type ContractPage,
  type ContractRow,
  type ListIds,
  type ListQuery,
  type Loan,
  type LoanPage,
  type PayAdjustment,
  type PayAdjustmentPage,
  type PayClaim,
  type PayClaimPage,
  type PayComponent,
  type PayComponentList,
  type PayrollDashboard,
  type PayrollRules,
  type PayslipPage,
  type PayslipRow,
  type PayStructure,
  type PayStructureList,
} from '@injishi/contracts';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';

import { LoansService } from '../../../modules/people/application/loans.service';
import { PayAdjustmentsService } from '../../../modules/people/application/pay-adjustments.service';
import { PayClaimsService } from '../../../modules/people/application/pay-claims.service';
import { PayComponentsService } from '../../../modules/people/application/pay-components.service';
import { PayFilesService } from '../../../modules/people/application/pay-files.service';
import { PayrollViewsService } from '../../../modules/people/application/payroll-views.service';
import { PayslipsService } from '../../../modules/people/application/payslips.service';
import {
  CurrentUser,
  SessionGuard,
  type SessionUser,
} from '../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequireAnyPermission,
  RequirePermission,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { IdempotencyKey } from '../../../shared/http/idempotency-key';
import { ListQueryPipe } from '../../../shared/lists/list-query';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';
import type { FileReply } from './pay-runs.controller';

/**
 * Payroll beyond the run itself (ADR-058, 058-payroll). Every route needs
 * `payroll.run`, reads included, except the contracts list and its pay terms,
 * which `people.manage` reaches too because a contract is written there.
 *
 * Three commands that create money take an `Idempotency-Key`: a loan, a claim
 * and an adjustment, each answered with the first record on a retry. Marking a
 * payslip paid takes none: the bank's reference IS the key, so a retry with the
 * same reference answers the payslip as it is and another reference is a 409.
 */

/** Payslips across runs -> /api/v1/ops/payslips (AC-PY10, AC-PY11). */
@Controller({ path: 'ops/payslips', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsPayslipsController {
  constructor(private readonly payslips: PayslipsService) {}

  @Get()
  @RequirePermission('payroll.run')
  list(
    @Query(ListQueryPipe) query: ListQuery,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<PayslipPage> {
    return this.payslips.list(workspace, query);
  }

  @Get('ids')
  @RequirePermission('payroll.run')
  ids(
    @Query(ListQueryPipe) query: ListQuery,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<ListIds> {
    return this.payslips.ids(workspace, query);
  }

  /** Mark several paid, each as the single command would; a result per id. */
  @Post('bulk')
  @HttpCode(200)
  @RequirePermission('payroll.run')
  bulk(
    @Body(new ZodValidationPipe(PayslipBulkRequest)) body: PayslipBulkRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<BulkResponse> {
    return this.payslips.bulk(workspace, user.id, body);
  }

  @Post(':id/mark-paid')
  @HttpCode(200)
  @RequirePermission('payroll.run')
  markPaid(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(MarkPaidParams)) body: MarkPaidParams,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PayslipRow> {
    return this.payslips.markPaid(workspace, user.id, id, body);
  }

  /** To correct a wrong reference: the reason lands on the trail. */
  @Post(':id/unmark-paid')
  @HttpCode(200)
  @RequirePermission('payroll.run')
  unmarkPaid(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UnmarkPaidRequest)) body: UnmarkPaidRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PayslipRow> {
    return this.payslips.unmarkPaid(workspace, user.id, id, body.reason.trim());
  }

  /** One confirmed payslip as a PDF, drawn from what was frozen. */
  @Get(':id/pdf')
  @RequirePermission('payroll.run')
  async pdf(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @Res({ passthrough: true }) reply: FileReply,
  ): Promise<void> {
    const file = await this.payslips.pdfOf(workspace, id);
    reply
      .header('content-type', 'application/pdf')
      .header('content-disposition', `attachment; filename="${file.filename}"`)
      .header('cache-control', 'no-store')
      .send(file.body);
  }
}

/** Pay adjustments -> /api/v1/ops/pay-adjustments (AC-PY16). */
@Controller({ path: 'ops/pay-adjustments', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsPayAdjustmentsController {
  constructor(private readonly adjustments: PayAdjustmentsService) {}

  @Get()
  @RequirePermission('payroll.run')
  list(
    @Query(ListQueryPipe) query: ListQuery,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<PayAdjustmentPage> {
    return this.adjustments.list(workspace, query);
  }

  /** Paid on the person's next unconfirmed month; a retry with the same key answers the first. */
  @Post()
  @RequirePermission('payroll.run')
  create(
    @Body(new ZodValidationPipe(CreatePayAdjustmentRequest)) body: CreatePayAdjustmentRequest,
    @IdempotencyKey() key: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PayAdjustment> {
    return this.adjustments.create(workspace, user.id, key, body);
  }

  @Post(':id/waive')
  @HttpCode(200)
  @RequirePermission('payroll.run')
  waive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(WaivePayAdjustmentRequest)) body: WaivePayAdjustmentRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PayAdjustment> {
    return this.adjustments.waive(workspace, user.id, id, body.reason.trim());
  }
}

/** Loans and advances -> /api/v1/ops/loans (AC-PY8). */
@Controller({ path: 'ops/loans', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsLoansController {
  constructor(private readonly loans: LoansService) {}

  @Get()
  @RequirePermission('payroll.run')
  list(
    @Query(ListQueryPipe) query: ListQuery,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<LoanPage> {
    return this.loans.list(workspace, query);
  }

  @Get(':id')
  @RequirePermission('payroll.run')
  get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<Loan> {
    return this.loans.get(workspace, id);
  }

  /** Records the loan and writes its whole schedule; a retry with the same key answers the first. */
  @Post()
  @RequirePermission('payroll.run')
  create(
    @Body(new ZodValidationPipe(CreateLoanRequest)) body: CreateLoanRequest,
    @IdempotencyKey() key: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<Loan> {
    return this.loans.create(workspace, user.id, key, body);
  }

  /** Everything still owed, deducted in one month. */
  @Post(':id/settle')
  @HttpCode(200)
  @RequirePermission('payroll.run')
  settle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(SettleLoanRequest)) body: SettleLoanRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<Loan> {
    return this.loans.settle(workspace, user.id, id, body.period);
  }

  /** The installment and every later unpaid one move a month on. */
  @Post(':id/installments/:period/defer')
  @HttpCode(200)
  @RequirePermission('payroll.run')
  defer(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('period', new ZodValidationPipe(PayPeriod)) period: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<Loan> {
    return this.loans.defer(workspace, user.id, id, period);
  }
}

/** Claims -> /api/v1/ops/pay-claims (AC-PY9). */
@Controller({ path: 'ops/pay-claims', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsPayClaimsController {
  constructor(private readonly claims: PayClaimsService) {}

  @Get()
  @RequirePermission('payroll.run')
  list(
    @Query(ListQueryPipe) query: ListQuery,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<PayClaimPage> {
    return this.claims.list(workspace, query);
  }

  @Get('ids')
  @RequirePermission('payroll.run')
  ids(
    @Query(ListQueryPipe) query: ListQuery,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<ListIds> {
    return this.claims.ids(workspace, query);
  }

  @Post('bulk')
  @HttpCode(200)
  @RequirePermission('payroll.run')
  bulk(
    @Body(new ZodValidationPipe(PayClaimBulkRequest)) body: PayClaimBulkRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<BulkResponse> {
    return this.claims.bulk(workspace, user.id, body);
  }

  /** Raised for someone; a retry with the same key answers the first claim. */
  @Post()
  @RequirePermission('payroll.run')
  create(
    @Body(new ZodValidationPipe(CreatePayClaimRequest)) body: CreatePayClaimRequest,
    @IdempotencyKey() key: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PayClaim> {
    return this.claims.create(workspace, user.id, key, body);
  }

  @Post(':id/approve')
  @HttpCode(200)
  @RequirePermission('payroll.run')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(PayDecisionRequest)) body: PayDecisionRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PayClaim> {
    return this.claims.approve(workspace, user.id, id, body.note?.trim() || null);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @RequirePermission('payroll.run')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(PayDecisionRequest)) body: PayDecisionRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PayClaim> {
    return this.claims.reject(workspace, user.id, id, body.note?.trim() || null);
  }

  /** The receipt, as a five minute link. */
  @Get(':id/receipt')
  @RequirePermission('payroll.run')
  receipt(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<{ url: string; expiresInSeconds: number }> {
    return this.claims.receiptLink(workspace, id);
  }
}

/** Pay components -> /api/v1/ops/pay-components (AC-PY5). */
@Controller({ path: 'ops/pay-components', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsPayComponentsController {
  constructor(private readonly components: PayComponentsService) {}

  @Get()
  @RequirePermission('payroll.run')
  list(@CurrentWorkspace() workspace: ScopedWorkspace): Promise<PayComponentList> {
    return this.components.list(workspace);
  }

  @Post()
  @RequirePermission('payroll.run')
  create(
    @Body(new ZodValidationPipe(CreatePayComponentRequest)) body: CreatePayComponentRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PayComponent> {
    return this.components.create(workspace, user.id, body);
  }

  /** Applies to runs not yet confirmed; a confirmed payslip keeps the lines it froze. */
  @Patch(':id')
  @RequirePermission('payroll.run')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdatePayComponentRequest)) body: UpdatePayComponentRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PayComponent> {
    return this.components.update(workspace, user.id, id, body);
  }
}

/** Pay structures -> /api/v1/ops/pay-structures (AC-PY5). */
@Controller({ path: 'ops/pay-structures', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsPayStructuresController {
  constructor(private readonly components: PayComponentsService) {}

  @Get()
  @RequirePermission('payroll.run')
  list(@CurrentWorkspace() workspace: ScopedWorkspace): Promise<PayStructureList> {
    return this.components.structures(workspace);
  }

  @Post()
  @RequirePermission('payroll.run')
  create(
    @Body(new ZodValidationPipe(CreatePayStructureRequest)) body: CreatePayStructureRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PayStructure> {
    return this.components.createStructure(workspace, user.id, body);
  }

  @Patch(':id')
  @RequirePermission('payroll.run')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdatePayStructureRequest)) body: UpdatePayStructureRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PayStructure> {
    return this.components.updateStructure(workspace, user.id, id, body);
  }
}

/**
 * Every contract of the business -> /api/v1/ops/contracts (AC-PY15). Read and
 * given its pay terms by whoever writes contracts or runs pay; the wage and the
 * dates change only by a new contract, on the person's file.
 */
@Controller({ path: 'ops/contracts', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsContractsController {
  constructor(private readonly views: PayrollViewsService) {}

  @Get()
  @RequireAnyPermission('people.manage', 'payroll.run')
  list(
    @Query(ListQueryPipe) query: ListQuery,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<ContractPage> {
    return this.views.contracts(workspace, query);
  }

  @Patch(':id')
  @RequireAnyPermission('people.manage', 'payroll.run')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateContractPayTermsRequest)) body: UpdateContractPayTermsRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<ContractRow> {
    return this.views.updateContract(workspace, user.id, id, body);
  }
}

/** The dashboard and the national rules in force -> /api/v1/ops/payroll (AC-PY15). */
@Controller({ path: 'ops/payroll', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsPayrollController {
  constructor(private readonly views: PayrollViewsService) {}

  @Get('dashboard')
  @RequirePermission('payroll.run')
  dashboard(@CurrentWorkspace() workspace: ScopedWorkspace): Promise<PayrollDashboard> {
    return this.views.dashboard(workspace);
  }

  /** Read only: a rule changes by a new config version, never from this screen. */
  @Get('rules')
  @RequirePermission('payroll.run')
  rules(): Promise<PayrollRules> {
    return this.views.rules();
  }
}

/** A file a run produced, fetched again -> /api/v1/ops/pay-files/:id. */
@Controller({ path: 'ops/pay-files', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsPayFilesController {
  constructor(private readonly files: PayFilesService) {}

  @Get(':id')
  @RequirePermission('payroll.run')
  link(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<{ url: string; expiresInSeconds: number }> {
    return this.files.link(workspace, id);
  }
}
