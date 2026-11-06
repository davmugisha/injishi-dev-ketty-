import {
  EXPENSE_RECEIPT_MAX_BYTES,
  ExpenseListQuery,
  RecordExpenseRequest,
  VoidExpenseRequest,
  type ExpenseList,
  type ExpenseView,
} from '@injishi/contracts';
import { BadRequestException, Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';

import { ExpensesService } from '../../../../modules/rentals/application/expenses.service';
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
import { UploadThrottlerGuard } from '../../uploads/upload-throttler.guard';
import { normaliseFormFields, parseFields, readForm, type FormRequest } from './multipart-form';

const RECEIPT_LIMITS = { maxFiles: 1, maxBytes: EXPENSE_RECEIPT_MAX_BYTES, what: 'A receipt' } as const;

/**
 * Expenses → /api/v1/ops/expenses (blueprint 2.3 "Expenses and taxes", WP
 * 4.3). Residence businesses only. The year's list, with totals by category,
 * reads under `money.view` or `expense.manage`; writing one down, voiding one
 * (with the reason) and attaching a receipt are `expense.manage`. A new
 * expense takes multipart/form-data (the fields beside one `receipt`), or
 * JSON with no receipt.
 */
@Controller({ path: 'ops/expenses', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
@RequireProduct('residence')
export class OpsExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get()
  @RequireAnyPermission('money.view', 'expense.manage')
  list(@Query(new ZodValidationPipe(ExpenseListQuery)) query: ExpenseListQuery, @CurrentWorkspace() workspace: ScopedWorkspace): Promise<ExpenseList> {
    return this.expenses.list(workspace, query);
  }

  @Post()
  @RequirePermission('expense.manage')
  @UseGuards(UploadThrottlerGuard)
  async record(@Req() request: FormRequest, @CurrentWorkspace() workspace: ScopedWorkspace, @CurrentUser() user: SessionUser): Promise<ExpenseView> {
    const form = await readForm(request, RECEIPT_LIMITS);
    const body = parseFields(RecordExpenseRequest, normaliseFormFields(form.fields, ['amountRwf']));
    const file = form.files[0];
    return this.expenses.record(workspace, user.id, body, file ? { filename: file.filename, mime: file.mime, body: file.body } : null);
  }

  @Post(':id/void')
  @HttpCode(200)
  @RequirePermission('expense.manage')
  void(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(VoidExpenseRequest)) body: VoidExpenseRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<ExpenseView> {
    return this.expenses.void(workspace, user.id, id, body);
  }

  /** Attach or replace the receipt: one multipart file, `receipt`, a PDF or a photo of at most 10 MB. */
  @Post(':id/receipt')
  @HttpCode(200)
  @RequirePermission('expense.manage')
  @UseGuards(UploadThrottlerGuard)
  async receipt(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: FormRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<ExpenseView> {
    const form = await readForm(request, RECEIPT_LIMITS);
    const file = form.files[0];
    if (!file) throw new BadRequestException('Attach the receipt as the file.');
    return this.expenses.attachReceipt(workspace, user.id, id, { filename: file.filename, mime: file.mime, body: file.body });
  }
}
