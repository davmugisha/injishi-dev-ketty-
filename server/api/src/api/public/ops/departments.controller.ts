import {
  AssignDepartmentMemberRequest,
  CreateDepartmentRequest,
  type OperatorDepartment,
  type OperatorDepartmentList,
  type OperatorDepartmentMember,
  type OperatorDepartmentMemberList,
  UpdateDepartmentRequest,
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
  RequireAnyPermission,
  RequirePermission,
  RequireProduct,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * Departments -> /api/v1/ops/departments (ADR-016 slice 1).
 *
 * The read is open to everyone who uses a department, not only to whoever may
 * edit one. A charge screen shows the department picker before anybody posts
 * anything, so gating the list on `department.manage` alone would hand a
 * receptionist an empty dropdown and no way to charge a minibar. It is still
 * declared (audit H1): a housekeeper, and a business still in the registration
 * pipeline, hold none of the candidates and are refused.
 *
 * The two commands carry `department.manage`, the twenty second permission
 * (D-p), held by owner and manager only.
 */
@Controller({ path: 'ops/departments', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
@RequireProduct('account')
export class OpsDepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  /**
   * Consumers: the Departments lens (`department.manage`), the bill's charge
   * picker (`folio.charge`), the Services lenses a receptionist opens,
   * Outlets among them (`order.advance`, `outlet.manage`), and the HR
   * officer's read only Departments lens (`people.view`, ADR-069 D-d):
   * `department_members` is the HR roster (ADR-058 contract 5), so reading
   * it is HR's job, while deciding where revenue reports and orders route
   * (`department.manage`) is not.
   */
  @Get()
  @RequireAnyPermission(
    'department.manage',
    'folio.charge',
    'order.advance',
    'outlet.manage',
    'people.view',
  )
  async list(
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<OperatorDepartmentList> {
    return { departments: await this.departments.list(workspace) };
  }

  @Post()
  @RequirePermission('department.manage')
  create(
    @Body(new ZodValidationPipe(CreateDepartmentRequest))
    body: CreateDepartmentRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
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
    @CurrentWorkspace() workspace: ScopedWorkspace,
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
  // Names colleagues, so it belongs to whoever staffs or runs departments, and
  // to whoever reads the staff files (`people.view`, ADR-069 D-d). Staffing
  // one below stays `team.manage`'s.
  @RequireAnyPermission('team.manage', 'department.manage', 'people.view')
  async listMembers(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<OperatorDepartmentMemberList> {
    return { members: await this.departments.listMembers(workspace, id) };
  }

  @Post(':id/members')
  @RequirePermission('team.manage')
  assignMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AssignDepartmentMemberRequest))
    body: AssignDepartmentMemberRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<OperatorDepartmentMember> {
    return this.departments.assignMember(workspace, id, body);
  }

  /** Soft removal: the row stays, so who worked where survives the change. */
  @Delete(':id/members/:memberId')
  @RequirePermission('team.manage')
  removeMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<OperatorDepartmentMember> {
    return this.departments.removeMember(workspace, id, memberId);
  }
}
