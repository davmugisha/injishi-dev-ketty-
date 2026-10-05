import {
  CreatePayRunRequest,
  type PayRunDetail,
  type ListQuery,
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
  UseGuards,
} from '@nestjs/common';

import { PayRunsService } from '../../../modules/people/application/pay-runs.service';
import {
  CurrentUser,
  SessionGuard,
  type SessionUser,
} from '../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequirePermission,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { ListQueryPipe } from '../../../shared/lists/list-query';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * Pay runs -> /api/v1/ops/pay-runs (ADR-058, AC-Y1 to AC-Y4).
 *
 * Every route, reads included, needs `payroll.run`: a payslip is what one
 * named colleague earns. Payslip PDFs and the RRA and RSSB declaration files
 * arrive with the accountant's sheet (ADR-058 slice 5).
 */
@Controller({ path: 'ops/pay-runs', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsPayRunsController {
  constructor(private readonly payRuns: PayRunsService) {}

  @Get()
  @RequirePermission('payroll.run')
  list(
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @Query(ListQueryPipe) query: ListQuery,
  ): Promise<PayRunPage> {
    return this.payRuns.list(workspace, query);
  }

  @Post()
  @RequirePermission('payroll.run')
  create(
    @Body(new ZodValidationPipe(CreatePayRunRequest)) body: CreatePayRunRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PayRunDetail> {
    return this.payRuns.create(workspace, user.id, body.period);
  }

  @Get(':id')
  @RequirePermission('payroll.run')
  get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<PayRunDetail> {
    return this.payRuns.get(workspace, id);
  }

  @Post(':id/recompute')
  @HttpCode(200)
  @RequirePermission('payroll.run')
  recompute(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PayRunDetail> {
    return this.payRuns.recompute(workspace, user.id, id);
  }

  /** Computes once more and freezes. A second confirm answers with the same run. */
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
}
