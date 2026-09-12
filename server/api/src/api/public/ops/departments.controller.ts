import {
  AssignDepartmentMemberRequest,
  CreateDepartmentRequest,
  type OperatorDepartment,
  type OperatorDepartmentList,
  type OperatorDepartmentMember,
  type OperatorDepartmentMemberList,
  UpdateDepartmentRequest,
  type WorkspaceAccess,
} from '@injishi/contracts';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { DepartmentsService } from '../../../modules/operations/application/departments.service';
import { SessionGuard } from '../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequirePermission,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * Departments -> /api/v1/ops/departments (ADR-016 slice 1).
 *
 * The read carries NO permission beyond holding the workspace, and that is
 * deliberate rather than an oversight. A charge screen shows the department
 * picker before anybody posts anything, so gating the list on
 * `department.manage` would hand a receptionist an empty dropdown and no way to
 * charge a minibar.
 *
 * The two commands carry `department.manage`, the twenty second permission
 * (D-p), held by owner and manager only.
 */
@Controller({ path: 'ops/departments', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsDepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  @Get()
  async list(
    @CurrentWorkspace() workspace: WorkspaceAccess,
  ): Promise<OperatorDepartmentList> {
    return { departments: await this.departments.list(workspace) };
  }

  @Post()
  @RequirePermission('department.manage')
  create(
    @Body(new ZodValidationPipe(CreateDepartmentRequest))
    body: CreateDepartmentRequest,
    @CurrentWorkspace() workspace: WorkspaceAccess,
  ): Promise<OperatorDepartment> {
    return this.departments.create(workspace, body);
  }

  /**
   * Rename, reorder, or retire.
   *
   * A PATCH rather than a named command, because unlike every other route in
   * `/ops` this really is an edit of a catalog row rather than a state
   * transition. Retiring is `status: archived` in the same body: a department
   * is never deleted, because its revenue history points at it.
   */
  @Patch(':id')
  @RequirePermission('department.manage')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateDepartmentRequest))
    body: UpdateDepartmentRequest,
    @CurrentWorkspace() workspace: WorkspaceAccess,
  ): Promise<OperatorDepartment> {
    return this.departments.update(workspace, id, body);
  }

  /**
   * Who works in this department (ADR-016 slice 8, D17).
   *
   * The roster decides whose BOARD a task lands on and nothing else. What a
   * person may DO stays on `org_memberships.org_role`, so these routes are
   * gated on `team.manage` rather than on a new permission: staffing a
   * department is the same act as staffing the business.
   */
  @Get(':id/members')
  async listMembers(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: WorkspaceAccess,
  ): Promise<OperatorDepartmentMemberList> {
    return { members: await this.departments.listMembers(workspace, id) };
  }

  @Post(':id/members')
  @RequirePermission('team.manage')
  assignMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AssignDepartmentMemberRequest))
    body: AssignDepartmentMemberRequest,
    @CurrentWorkspace() workspace: WorkspaceAccess,
  ): Promise<OperatorDepartmentMember> {
    return this.departments.assignMember(workspace, id, body);
  }

  /** Soft removal: the row stays, so who worked where survives the change. */
  @Delete(':id/members/:memberId')
  @RequirePermission('team.manage')
  removeMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @CurrentWorkspace() workspace: WorkspaceAccess,
  ): Promise<OperatorDepartmentMember> {
    return this.departments.removeMember(workspace, id, memberId);
  }
}
