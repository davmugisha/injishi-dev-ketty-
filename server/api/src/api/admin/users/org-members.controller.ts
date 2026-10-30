import { Body, Controller, Delete, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  AdminAddMemberRequest,
  AdminChangeMemberRoleRequest,
  type AdminMemberChange,
  AdminReasonQuery,
} from '@injishi/contracts';

import { CurrentUser, SessionGuard } from '../../../shared/auth/session.guard';
import type { SessionUser } from '../../../shared/auth/session.guard';
import { RequireStaffPermission } from '../../../shared/auth/require-staff-permission.decorator';
import { StaffGuard } from '../../../shared/auth/staff.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';
import { AdminAccountsService } from './admin-accounts.service';

/**
 * Who works in a business, set by Injishi staff (2026-10-29): add a person with
 * a role, change it, take them out. A business sets its own staff from its
 * Team screen; this is for what the business cannot do itself, such as
 * correcting its owner. Every write takes a reason and leaves an audit row.
 */
@Controller({ path: 'admin/orgs/:orgId/members', version: '1' })
@UseGuards(SessionGuard, StaffGuard)
export class AdminOrgMembersController {
  constructor(private readonly accounts: AdminAccountsService) {}

  @Post()
  @HttpCode(201)
  @RequireStaffPermission('admin.business.member.manage')
  add(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body(new ZodValidationPipe(AdminAddMemberRequest)) body: AdminAddMemberRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<AdminMemberChange> {
    return this.accounts.addMember(orgId, body, user.id);
  }

  @Patch(':userId')
  @RequireStaffPermission('admin.business.member.manage')
  changeRole(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body(new ZodValidationPipe(AdminChangeMemberRoleRequest)) body: AdminChangeMemberRoleRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<AdminMemberChange> {
    return this.accounts.changeMemberRole(orgId, userId, body, user.id);
  }

  @Delete(':userId')
  @RequireStaffPermission('admin.business.member.manage')
  remove(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query(new ZodValidationPipe(AdminReasonQuery)) query: AdminReasonQuery,
    @CurrentUser() user: SessionUser,
  ): Promise<AdminMemberChange> {
    return this.accounts.removeMember(orgId, userId, query.reason, user.id);
  }
}
