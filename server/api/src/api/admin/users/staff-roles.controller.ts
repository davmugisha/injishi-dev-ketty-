import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import {
  AdminCreateCustomRoleRequest,
  type AdminCustomRole,
  type AdminCustomRoleChange,
  AdminReasonQuery,
  type AdminRoleHolders,
  type AdminStaffRoleCatalog,
  AdminUpdateCustomRoleRequest,
  type StaffAccess,
  StaffRole,
} from '@injishi/contracts';

import { CurrentUser, SessionGuard } from '../../../shared/auth/session.guard';
import type { SessionUser } from '../../../shared/auth/session.guard';
import { RequireFreshStepUp } from '../../../shared/auth/require-fresh-step-up.decorator';
import { RequireStaffPermission } from '../../../shared/auth/require-staff-permission.decorator';
import { CurrentStaff, StaffGuard } from '../../../shared/auth/staff.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';
import { StaffRolesService } from './staff-roles.service';

/** A built-in role key or a uuid, nothing else. */
class ParseRoleRef {
  private readonly uuid = new ParseUUIDPipe();
  async transform(value: string): Promise<string> {
    if (StaffRole.safeParse(value).success) return value;
    return this.uuid.transform(value, { type: 'param' });
  }
}

/**
 * Staff roles (2026-11-02): the built-in five, read only, and the custom roles
 * a super admin makes from the permissions the code defines.
 *
 * Reads are `admin.role.view` (super admin, ops, compliance). Every write is
 * `admin.user.role.grant`, which only super admin holds and no custom role can
 * carry. Creating a role and changing one widen what its holders may do, so
 * both ask for a fresh step-up; archiving only narrows, and needs none.
 */
@Controller({ path: 'admin/staff-roles', version: '1' })
@UseGuards(SessionGuard, StaffGuard)
export class AdminStaffRolesController {
  constructor(private readonly roles: StaffRolesService) {}

  /** Every role with its permissions and holder count: the roles list and the matrix. */
  @Get()
  @RequireStaffPermission('admin.role.view')
  catalog(): Promise<AdminStaffRoleCatalog> {
    return this.roles.catalog();
  }

  /** Who holds a role: a built-in key (`ops`) or a custom role id. */
  @Get(':role/holders')
  @RequireStaffPermission('admin.role.view')
  holders(@Param('role', new ParseRoleRef()) role: string): Promise<AdminRoleHolders> {
    return this.roles.holders(role);
  }

  @Get(':roleId')
  @RequireStaffPermission('admin.role.view')
  get(@Param('roleId', ParseUUIDPipe) roleId: string): Promise<AdminCustomRole> {
    return this.roles.get(roleId);
  }

  @Post()
  @HttpCode(201)
  @RequireStaffPermission('admin.user.role.grant')
  @RequireFreshStepUp()
  create(
    @Body(new ZodValidationPipe(AdminCreateCustomRoleRequest)) body: AdminCreateCustomRoleRequest,
    @CurrentUser() user: SessionUser,
    @CurrentStaff() staff: StaffAccess,
  ): Promise<AdminCustomRoleChange> {
    return this.roles.create(body, { userId: user.id, access: staff });
  }

  @Put(':roleId')
  @RequireStaffPermission('admin.user.role.grant')
  @RequireFreshStepUp()
  update(
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body(new ZodValidationPipe(AdminUpdateCustomRoleRequest)) body: AdminUpdateCustomRoleRequest,
    @CurrentUser() user: SessionUser,
    @CurrentStaff() staff: StaffAccess,
  ): Promise<AdminCustomRoleChange> {
    return this.roles.update(roleId, body, { userId: user.id, access: staff });
  }

  /** Archive a role nobody holds. Built-in roles are code and are never archived. */
  @Delete(':roleId')
  @RequireStaffPermission('admin.user.role.grant')
  archive(
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Query(new ZodValidationPipe(AdminReasonQuery)) query: AdminReasonQuery,
    @CurrentUser() user: SessionUser,
  ): Promise<AdminCustomRoleChange> {
    return this.roles.archive(roleId, query.reason, user.id);
  }
}

