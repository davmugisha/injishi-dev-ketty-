import {
  CreateContractRequest,
  CreateEmployeeRequest,
  EmployeeListQuery,
  OffboardEmployeeRequest,
  UpdateEmployeeRequest,
  type CreateContractResponse,
  type Employee,
  type EmployeeFile,
  type EmployeePage,
  type LeaveBalances,
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
  UseGuards,
} from '@nestjs/common';

import { EmployeesService } from '../../../modules/people/application/employees.service';
import { LeaveService } from '../../../modules/people/application/leave.service';
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
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * HR files -> /api/v1/ops/employees (ADR-058, first thread).
 *
 * **One route, two shapes.** A file is read by `people.view`, `people.manage`
 * or `payroll.run`, and only the last two see date of birth, ID, RSSB number
 * and wages (AC-P2). The service picks the shape from the caller's grant, so
 * the permission decides what is SENT, not only what is shown.
 *
 * Offboarding declares `people.manage`, and the service also asks for
 * `team.manage` when the file holds an account: taking someone's access away
 * is staffing the business, which cannot be granted past the owner (AC-O2).
 */
@Controller({ path: 'ops/employees', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsEmployeesController {
  constructor(
    private readonly employees: EmployeesService,
    private readonly leave: LeaveService,
  ) {}

  @Get()
  @RequireAnyPermission('people.view', 'people.manage', 'payroll.run')
  list(
    @Query(new ZodValidationPipe(EmployeeListQuery)) query: EmployeeListQuery,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<EmployeePage> {
    return this.employees.list(workspace, query);
  }

  @Post()
  @RequirePermission('people.manage')
  create(
    @Body(new ZodValidationPipe(CreateEmployeeRequest)) body: CreateEmployeeRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<Employee> {
    return this.employees.create(workspace, user.id, body);
  }

  @Get(':id')
  @RequireAnyPermission('people.view', 'people.manage', 'payroll.run')
  get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<EmployeeFile> {
    return this.employees.get(workspace, id);
  }

  @Patch(':id')
  @RequirePermission('people.manage')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateEmployeeRequest)) body: UpdateEmployeeRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<Employee> {
    return this.employees.update(workspace, user.id, id, body);
  }

  /** A wage change is a new contract; the one it replaces ends the day before. */
  @Post(':id/contracts')
  @RequirePermission('people.manage')
  createContract(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(CreateContractRequest)) body: CreateContractRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<CreateContractResponse> {
    return this.employees.createContract(workspace, user.id, id, body);
  }

  @Post(':id/offboard')
  @HttpCode(200)
  @RequirePermission('people.manage')
  offboard(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(OffboardEmployeeRequest)) body: OffboardEmployeeRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<Employee> {
    return this.employees.offboard(workspace, user.id, id, body);
  }

  /** The balance per type is the sum of the ledger, and the rows are beside it. */
  @Get(':id/leave-balances')
  @RequireAnyPermission('people.view', 'people.manage', 'leave.approve')
  leaveBalances(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<LeaveBalances> {
    return this.leave.balances(workspace, id);
  }
}
