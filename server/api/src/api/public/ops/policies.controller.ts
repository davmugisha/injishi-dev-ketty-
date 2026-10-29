import {
  CreateStaffPolicyRequest,
  HR_PERMISSIONS,
  UpdateStaffPolicyRequest,
  type FileLink,
  type StaffPolicy,
  type StaffPolicyList,
} from '@injishi/contracts';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { HrContentService } from '../../../modules/hr/application/hr-content.service';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
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
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * House rules -> /api/v1/ops/policies (058-people-file AC-PF7).
 *
 * Read by any HR permission, because a policy is the business's, not a
 * person's; written by `people.manage`. A policy is archived, never deleted.
 * Who it is for is a set of departments, positions and people, replaced whole
 * on each change.
 */
@Controller({ path: 'ops/policies', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsPoliciesController {
  constructor(private readonly content: HrContentService) {}

  @Get()
  @RequireAnyPermission(...HR_PERMISSIONS)
  list(@CurrentWorkspace() workspace: ScopedWorkspace): Promise<StaffPolicyList> {
    return this.content.policies(workspace);
  }

  @Post()
  @RequirePermission('people.manage')
  create(
    @Body(new ZodValidationPipe(CreateStaffPolicyRequest)) body: CreateStaffPolicyRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<StaffPolicy> {
    return this.content.createPolicy(workspace, user.id, body);
  }

  @Patch(':id')
  @RequirePermission('people.manage')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateStaffPolicyRequest)) body: UpdateStaffPolicyRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<StaffPolicy> {
    return this.content.updatePolicy(workspace, user.id, id, body);
  }

  @Get(':id/files/:index')
  @RequireAnyPermission(...HR_PERMISSIONS)
  file(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('index', ParseIntPipe) index: number,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<FileLink> {
    return this.content.policyFileLink(workspace, id, index);
  }
}
