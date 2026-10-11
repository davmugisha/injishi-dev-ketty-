// server/api/src/api/public/ops/payroll.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';

import { PayrollService } from '../../../modules/payroll/application/payroll.service';
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

/** The little of Fastify's reply a file download needs. */
interface FileReply {
  header(name: string, value: string): FileReply;
  send(body: Buffer): FileReply;
}

/**
 * HR / payroll (first pass — no ADR yet, pending team review).
 *
 * Gated on `team.manage`, the same permission the staff roster read uses
 * (`OpsTeamController`) and for the same reason: this is not operational
 * data, it is information about people — here, their salary, which is a
 * stronger disclosure than an email and a role. A dedicated `payroll.manage`
 * grant is the right long-term shape but requires hand-editing
 * @injishi/contracts' compiled dist; reusing `team.manage` avoids that until
 * the feature's shape is stable.
 *
 * EVERY ROUTE HANDS THE SERVICE THE WORKSPACE. A run or payslip id in the URL
 * could name any business's, so the service looks each one up inside the
 * workspace the guard proved before it reads, approves or pays anything.
 *
 * NO REAL MONEY MOVES HERE YET. `markPaid` flips a status, matching the
 * mock payment and EBM adapters elsewhere in this codebase. The figures are
 * computed in `modules/payroll/domain/pay-rules.ts`, which says where its
 * rates come from and that an accountant has not confirmed them.
 */
@Controller({ path: 'ops/payroll', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsPayrollController {
  constructor(private readonly payroll: PayrollService) {}

  @Get('compensation')
  @RequirePermission('team.manage')
  listCompensation(
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): ReturnType<PayrollService['listCompensation']> {
    return this.payroll.listCompensation(workspace.workspaceId);
  }

  @Post('compensation')
  @HttpCode(204)
  @RequirePermission('team.manage')
  async setCompensation(
    @Body() body: { departmentMemberId: string; baseSalaryRwf: number },
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<void> {
    await this.payroll.setCompensation(
      workspace.workspaceId,
      body.departmentMemberId,
      body.baseSalaryRwf,
    );
  }

  /** Staff cost per run, split by department. */
  @Get('cost')
  @RequirePermission('team.manage')
  cost(@CurrentWorkspace() workspace: ScopedWorkspace): ReturnType<PayrollService['costByDepartment']> {
    return this.payroll.costByDepartment(workspace.workspaceId);
  }

  @Get('runs')
  @RequirePermission('team.manage')
  listRuns(@CurrentWorkspace() workspace: ScopedWorkspace): ReturnType<PayrollService['listRuns']> {
    return this.payroll.listRuns(workspace.workspaceId);
  }

  @Post('runs')
  @RequirePermission('team.manage')
  createRun(
    @Body() body: { periodStart: string; periodEnd: string },
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): ReturnType<PayrollService['createRun']> {
    return this.payroll.createRun(
      workspace.workspaceId,
      new Date(body.periodStart),
      new Date(body.periodEnd),
    );
  }

  @Get('runs/:id/payslips')
  @RequirePermission('team.manage')
  listPayslips(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): ReturnType<PayrollService['listPayslips']> {
    return this.payroll.listPayslips(workspace.workspaceId, id);
  }

  /** Rebuild a DRAFT run from today's salaries and the attendance so far. */
  @Post('runs/:id/recalculate')
  @HttpCode(204)
  @RequirePermission('team.manage')
  async recalculateRun(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<void> {
    await this.payroll.recalculateRun(workspace.workspaceId, id);
  }

  /** Discard a DRAFT run. */
  @Delete('runs/:id')
  @HttpCode(204)
  @RequirePermission('team.manage')
  async discardRun(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<void> {
    await this.payroll.discardRun(workspace.workspaceId, id);
  }

  @Post('runs/:id/approve')
  @HttpCode(204)
  @RequirePermission('team.manage')
  async approveRun(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<void> {
    await this.payroll.approveRun(workspace.workspaceId, id, user.id);
  }

  @Post('runs/:id/pay')
  @HttpCode(204)
  @RequirePermission('team.manage')
  async markPaid(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<void> {
    await this.payroll.markRunPaid(workspace.workspaceId, id);
  }

  /** One payslip as a PDF, drawn from what the payslip stored. */
  @Get('payslips/:id/pdf')
  @RequirePermission('team.manage')
  async payslipPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @Res({ passthrough: true }) reply: FileReply,
  ): Promise<void> {
    const file = await this.payroll.payslipPdf(workspace.workspaceId, id);
    reply
      .header('content-type', 'application/pdf')
      .header('content-disposition', `attachment; filename="${file.filename}"`)
      .header('cache-control', 'no-store')
      .send(file.body);
  }
}
