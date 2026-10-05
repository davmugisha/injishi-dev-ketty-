// server/api/src/api/public/ops/payroll.controller.ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
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
 * NO REAL MONEY MOVES HERE YET. `markPaid` flips a status, matching the
 * mock payment and EBM adapters elsewhere in this codebase — see
 * `payroll.service.ts` for the mock PAYE/RSSB calculation this all rests on.
 */
@Controller({ path: 'ops/payroll', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsPayrollController {
  constructor(private readonly payroll: PayrollService) {}

  @Get('compensation')
  @RequirePermission('team.manage')
  listCompensation(@CurrentWorkspace() workspace: ScopedWorkspace) {
    return this.payroll.listCompensation(workspace.workspaceId);
  }

  @Post('compensation')
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

  @Get('runs')
  @RequirePermission('team.manage')
  listRuns(@CurrentWorkspace() workspace: ScopedWorkspace) {
    return this.payroll.listRuns(workspace.workspaceId);
  }

  @Post('runs')
  @RequirePermission('team.manage')
  createRun(
    @Body() body: { periodStart: string; periodEnd: string },
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ) {
    return this.payroll.createRun(
      workspace.workspaceId,
      new Date(body.periodStart),
      new Date(body.periodEnd),
    );
  }

  @Get('runs/:id/payslips')
  @RequirePermission('team.manage')
  listPayslips(@Param('id', ParseUUIDPipe) id: string) {
    return this.payroll.listPayslips(id);
  }

  @Post('runs/:id/approve')
  @HttpCode(204)
  @RequirePermission('team.manage')
  async approveRun(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: SessionUser,
  ): Promise<void> {
    await this.payroll.approveRun(id, user.id);
  }

  @Post('runs/:id/pay')
  @HttpCode(204)
  @RequirePermission('team.manage')
  async markPaid(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.payroll.markRunPaid(id);
  }
}