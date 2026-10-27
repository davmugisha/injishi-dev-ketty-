import {
  CreatePayDeclarationRequest,
  CreatePayExportRequest,
  CreatePayRunRequest,
  HoldPayslipRequest,
  type ListQuery,
  type PayFileList,
  type PayFileResult,
  type PayRunDetail,
  type PayRunPage,
} from '@injishi/contracts';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';

import { PayFilesService } from '../../../modules/hr/application/pay-files.service';
import { PayRunsService } from '../../../modules/hr/application/pay-runs.service';
import { PayslipsService } from '../../../modules/hr/application/payslips.service';
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
import { ListQueryPipe } from '../../../shared/lists/list-query';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/** The slice of the Fastify reply a file route touches. */
export interface FileReply {
  header(key: string, value: string): FileReply;
  send(payload: Buffer | string): FileReply;
}

/**
 * Pay runs -> /api/v1/ops/pay-runs (ADR-058, AC-Y1 to AC-Y4; 058-payroll).
 *
 * Every route, reads included, declares a payroll permission: a payslip is what
 * one named colleague earns. A draft may hold a person's payslip to next month
 * (AC-PY7); a confirmed run prints as one PDF (AC-PY11) and builds the bank and
 * MoMo files and the declarations (AC-PY10, AC-PY12).
 *
 * ADR-069 D-e splits preparing the month from signing it. The DRAFT routes
 * (list, create, read, recompute, hold) admit `payroll.draft` OR
 * `payroll.run`, so the HR officer builds the month and a role a business
 * granted `payroll.run` before the split still prepares the month it
 * confirms. The confirm, and everything a confirmed run produces (the payslips
 * PDF, the bank and MoMo files, the declarations), stay `payroll.run`'s
 * alone. A drafter reads a confirmed run too: those are the figures they
 * computed. What a run answers carries wages and no ID number, date of birth,
 * RSSB number or pay account; those stay behind `people.manage` or
 * `payroll.run` (`fileViewFor`), and the confirmed payslip's snapshot that
 * holds them is read only through the PDF routes, which stay `payroll.run`'s.
 */
@Controller({ path: 'ops/pay-runs', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsPayRunsController {
  constructor(
    private readonly payRuns: PayRunsService,
    private readonly files: PayFilesService,
    private readonly payslips: PayslipsService,
  ) {}

  @Get()
  @RequireAnyPermission('payroll.draft', 'payroll.run')
  list(
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @Query(ListQueryPipe) query: ListQuery,
  ): Promise<PayRunPage> {
    return this.payRuns.list(workspace, query);
  }

  @Post()
  @RequireAnyPermission('payroll.draft', 'payroll.run')
  create(
    @Body(new ZodValidationPipe(CreatePayRunRequest)) body: CreatePayRunRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PayRunDetail> {
    return this.payRuns.create(workspace, user.id, body.period);
  }

  @Get(':id')
  @RequireAnyPermission('payroll.draft', 'payroll.run')
  get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<PayRunDetail> {
    return this.payRuns.get(workspace, id);
  }

  @Post(':id/recompute')
  @HttpCode(200)
  @RequireAnyPermission('payroll.draft', 'payroll.run')
  recompute(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PayRunDetail> {
    return this.payRuns.recompute(workspace, user.id, id);
  }

  /** Leave a person out of this draft: their month is carried to the next as an adjustment. */
  @Post(':id/hold')
  @HttpCode(200)
  @RequireAnyPermission('payroll.draft', 'payroll.run')
  hold(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(HoldPayslipRequest)) body: HoldPayslipRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PayRunDetail> {
    return this.payRuns.hold(workspace, user.id, id, body);
  }

  /**
   * Computes once more and freezes. A second confirm answers with the same run.
   * `payroll.run` alone (ADR-069 D-e): whoever prepares the month is not, by
   * default, whoever signs it.
   */
  @Post(':id/confirm')
  @HttpCode(200)
  @RequirePermission('payroll.run')
  confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PayRunDetail> {
    return this.payRuns.confirm(workspace, user.id, id);
  }

  /** Every payslip of a confirmed run, a page each, for printing for staff without accounts. */
  @Get(':id/payslips.pdf')
  @RequirePermission('payroll.run')
  async pdf(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @Res({ passthrough: true }) reply: FileReply,
  ): Promise<void> {
    const file = await this.payslips.runPdf(workspace, id);
    reply
      .header('content-type', 'application/pdf')
      .header('content-disposition', `attachment; filename="${file.filename}"`)
      .header('cache-control', 'no-store')
      .send(file.body);
  }

  /** The files built from this run so far. */
  @Get(':id/files')
  @RequirePermission('payroll.run')
  listFiles(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<PayFileList> {
    return this.files.list(workspace, id);
  }

  @Post(':id/exports')
  @RequirePermission('payroll.run')
  createExport(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(CreatePayExportRequest)) body: CreatePayExportRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PayFileResult> {
    return this.files.createExport(workspace, user.id, id, body.kind);
  }

  @Post(':id/declarations')
  @RequirePermission('payroll.run')
  createDeclaration(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(CreatePayDeclarationRequest)) body: CreatePayDeclarationRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PayFileResult> {
    return this.files.createDeclaration(workspace, user.id, id, body.kind);
  }
}
