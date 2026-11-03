import { describe, expect, it, vi } from 'vitest';

import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { type StaffAccess, type StaffRole, staffPermissionsForRoles } from '@injishi/contracts';

import { REQUIRE_FRESH_STEP_UP } from '../../../shared/auth/require-fresh-step-up.decorator';
import { REQUIRE_STAFF_PERMISSION } from '../../../shared/auth/require-staff-permission.decorator';
import { SessionGuard } from '../../../shared/auth/session.guard';
import { StaffGuard } from '../../../shared/auth/staff.guard';
import type { TwoFactorService } from '../../../shared/auth/two-factor.service';
import type { WorkspaceService } from '../../../shared/auth/workspace.service';
import { AdminLocalLeadersController } from './local-leaders.controller';
import { AdminStaffRolesController } from './staff-roles.controller';
import { AdminUsersController } from './users.controller';

/**
 * Who may reach the People and Roles routes (2026-11-02): the permission each
 * declares, which ones are grants that need a recent step-up, and the guard's
 * refusal when that step-up is older than ten minutes.
 */

function access(roles: StaffRole[]): StaffAccess {
  return { isStaff: true, roles, permissions: staffPermissionsForRoles(roles) };
}

function guardFor(resolved: StaffAccess, fresh: boolean): StaffGuard {
  const workspaces = { staffAccessForUser: vi.fn().mockResolvedValue(resolved) } as unknown as WorkspaceService;
  const twoFactor = {
    assertSatisfied: vi.fn().mockResolvedValue(undefined),
    stateFor: vi.fn().mockResolvedValue({ verified: true }),
    verifiedWithin: vi.fn().mockResolvedValue(fresh),
  } as unknown as TwoFactorService;
  return new StaffGuard(workspaces, twoFactor, new Reflector());
}

function contextFor(cls: object, handler: (...args: never[]) => unknown): ExecutionContext {
  const request = { user: { id: '712dbb3c-92fe-462f-abe5-2ed507b8c3fc', email: 'admin@injishi.test' }, session: { id: 's-1' } };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => handler,
    getClass: () => cls,
  } as unknown as ExecutionContext;
}

const R = AdminStaffRolesController.prototype;
const U = AdminUsersController.prototype;
const permission = (h: unknown): unknown => Reflect.getMetadata(REQUIRE_STAFF_PERMISSION, h as object);
const fresh = (h: unknown): boolean => Reflect.getMetadata(REQUIRE_FRESH_STEP_UP, h as object) === true;

describe('staff roles routes', () => {
  it('runs SessionGuard before StaffGuard', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminStaffRolesController)).toEqual([SessionGuard, StaffGuard]);
  });

  it('reads need admin.role.view; every write needs admin.user.role.grant', () => {
    expect(permission(R.catalog)).toBe('admin.role.view');
    expect(permission(R.holders)).toBe('admin.role.view');
    expect(permission(R.get)).toBe('admin.role.view');
    for (const h of [R.create, R.update, R.archive]) expect(permission(h)).toBe('admin.user.role.grant');
  });

  it('creating and changing a role are grants; archiving only narrows', () => {
    expect(fresh(R.create)).toBe(true);
    expect(fresh(R.update)).toBe(true);
    expect(fresh(R.archive)).toBe(false);
  });

  it('ops and compliance may read the roles, never write them; finance may not read', async () => {
    for (const role of ['ops', 'compliance'] as const) {
      await expect(guardFor(access([role]), true).canActivate(contextFor(AdminStaffRolesController, R.catalog))).resolves.toBe(true);
      await expect(guardFor(access([role]), true).canActivate(contextFor(AdminStaffRolesController, R.create))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    }
    await expect(guardFor(access(['finance']), true).canActivate(contextFor(AdminStaffRolesController, R.catalog))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('a super admin whose step-up is older than ten minutes is asked for a new code', async () => {
    const refused = guardFor(access(['super_admin']), false).canActivate(contextFor(AdminStaffRolesController, R.create));
    await expect(refused).rejects.toMatchObject({ response: { code: 'step_up_stale' } });
    await expect(guardFor(access(['super_admin']), true).canActivate(contextFor(AdminStaffRolesController, R.create))).resolves.toBe(true);
    // A narrowing write does not ask.
    await expect(guardFor(access(['super_admin']), false).canActivate(contextFor(AdminStaffRolesController, R.archive))).resolves.toBe(true);
  });
});

describe('people routes', () => {
  it('every grant asks for a recent step-up', () => {
    for (const h of [U.createUser, U.setStaffRoles, U.assignCustomRole, U.grantOversight, AdminLocalLeadersController.prototype.appoint]) {
      expect(fresh(h)).toBe(true);
    }
    for (const h of [U.revokeCustomRole, U.revokeOversight, U.suspend, U.reactivate, U.resendInvitation, U.endSession]) {
      expect(fresh(h)).toBe(false);
    }
  });

  it('declares the permission each route needs', () => {
    expect(permission(U.assignCustomRole)).toBe('admin.user.role.grant');
    expect(permission(U.revokeCustomRole)).toBe('admin.user.role.grant');
    expect(permission(U.suspend)).toBe('admin.user.suspend');
    expect(permission(U.reactivate)).toBe('admin.user.suspend');
    expect(permission(U.resendInvitation)).toBe('admin.user.role.grant');
    expect(permission(U.signIns)).toBe('admin.user.view');
    expect(permission(U.activity)).toBe('admin.audit.read');
    expect(permission(U.endSession)).toBe('admin.user.session.revoke');
  });

  it('ops may suspend; compliance and finance may not', async () => {
    await expect(guardFor(access(['ops']), true).canActivate(contextFor(AdminUsersController, U.suspend))).resolves.toBe(true);
    for (const role of ['compliance', 'finance'] as const) {
      await expect(guardFor(access([role]), true).canActivate(contextFor(AdminUsersController, U.suspend))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    }
  });
});
