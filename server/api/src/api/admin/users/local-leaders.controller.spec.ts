import { describe, expect, it, vi } from 'vitest';

import { BadRequestException, ForbiddenException, type ExecutionContext, UnprocessableEntityException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import {
  AppointOfficerRequest,
  EndAppointmentQuery,
  type StaffAccess,
  type StaffRole,
  staffPermissionsForRoles,
} from '@injishi/contracts';

import type { GuestRoutingService } from '../../../modules/guests/application/guest-routing.service';
import type { GuestNotifier } from '../../../modules/guests/infrastructure/guest-notifier';
import { REQUIRE_STAFF_PERMISSION } from '../../../shared/auth/require-staff-permission.decorator';
import { SessionGuard } from '../../../shared/auth/session.guard';
import { StaffGuard } from '../../../shared/auth/staff.guard';
import type { TwoFactorService } from '../../../shared/auth/two-factor.service';
import type { WorkspaceService } from '../../../shared/auth/workspace.service';
import type { Database } from '../../../shared/database/database.module';
import { AdminLocalLeadersController } from './local-leaders.controller';
import type { LocalLeadersRepository } from './local-leaders.repository';
import { LocalLeadersService, appointmentArea } from './local-leaders.service';
import type { OversightGrantsService } from './oversight-grants.service';

/**
 * Local leaders and officers (P5): who may read the list, who may appoint and
 * end, the staff step-up in front of both, and the checks an appointment
 * passes before anything is written. The writes themselves run against
 * Postgres in `guests.integration.spec.ts`.
 */

function access(roles: StaffRole[]): StaffAccess {
  return { isStaff: true, roles, permissions: staffPermissionsForRoles(roles) };
}

function guardFor(resolved: StaffAccess, steppedUp = true): StaffGuard {
  const workspaces = { staffAccessForUser: vi.fn().mockResolvedValue(resolved) } as unknown as WorkspaceService;
  const twoFactor = {
    assertSatisfied: vi.fn().mockResolvedValue(undefined),
    stateFor: vi.fn().mockResolvedValue({ verified: steppedUp }),
  } as unknown as TwoFactorService;
  return new StaffGuard(workspaces, twoFactor, new Reflector());
}

function contextFor(handler: (...args: never[]) => unknown): ExecutionContext {
  const request = { user: { id: '712dbb3c-92fe-462f-abe5-2ed507b8c3fc', email: 'admin@injishi.test' }, session: { id: 's-1' } };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => handler,
    getClass: () => AdminLocalLeadersController,
  } as unknown as ExecutionContext;
}

const P = AdminLocalLeadersController.prototype;

describe('AdminLocalLeadersController · who may call it', () => {
  it('runs SessionGuard before StaffGuard', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminLocalLeadersController)).toEqual([SessionGuard, StaffGuard]);
  });

  it('reads need admin.user.view; appointing and ending need admin.user.role.grant', () => {
    expect(Reflect.getMetadata(REQUIRE_STAFF_PERMISSION, P.list)).toBe('admin.user.view');
    expect(Reflect.getMetadata(REQUIRE_STAFF_PERMISSION, P.coverage)).toBe('admin.user.view');
    expect(Reflect.getMetadata(REQUIRE_STAFF_PERMISSION, P.coverageCsv)).toBe('admin.user.view');
    expect(Reflect.getMetadata(REQUIRE_STAFF_PERMISSION, P.appoint)).toBe('admin.user.role.grant');
    expect(Reflect.getMetadata(REQUIRE_STAFF_PERMISSION, P.end)).toBe('admin.user.role.grant');
  });

  it('ops staff may read the list but not appoint or end', async () => {
    const ops = access(['ops']);
    expect(ops.permissions).toContain('admin.user.view');
    expect(ops.permissions).not.toContain('admin.user.role.grant');
    await expect(guardFor(ops).canActivate(contextFor(P.list))).resolves.toBe(true);
    await expect(guardFor(ops).canActivate(contextFor(P.appoint))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(guardFor(ops).canActivate(contextFor(P.end))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('a super admin who has not typed the emailed code is sent to the step-up, not let through', async () => {
    const attempt = guardFor(access(['super_admin']), false).canActivate(contextFor(P.appoint));
    await expect(attempt).rejects.toBeInstanceOf(ForbiddenException);
    await expect(guardFor(access(['super_admin']), false).canActivate(contextFor(P.end))).rejects.toMatchObject({
      response: { code: 'two_factor_required' },
    });
  });

  it('a super admin with the step-up may appoint and end', async () => {
    await expect(guardFor(access(['super_admin'])).canActivate(contextFor(P.appoint))).resolves.toBe(true);
    await expect(guardFor(access(['super_admin'])).canActivate(contextFor(P.end))).resolves.toBe(true);
  });
});

describe('AppointOfficerRequest · the form’s rules', () => {
  const base = {
    email: ' Mudugudu@Example.RW ',
    role: 'village_leader',
    governmentBodyCode: 'MINALOC',
    governmentTitle: 'Umukuru w’Umudugudu',
    scopeLevel: 'village',
    villageId: 1101,
    reason: 'Elected in October',
  };

  it('takes a village leader with a village, and lower cases the email', () => {
    expect(AppointOfficerRequest.parse(base)).toMatchObject({ email: 'mudugudu@example.rw', villageId: 1101 });
  });

  it('refuses a level the role does not cover, a missing place, and no reason', () => {
    const level = AppointOfficerRequest.safeParse({ ...base, scopeLevel: 'district', districtId: 1 });
    expect(level.success).toBe(false);
    expect(level.error?.issues[0]).toMatchObject({ path: ['scopeLevel'] });
    const missing = AppointOfficerRequest.safeParse({ ...base, villageId: null });
    expect(missing.error?.issues[0]).toMatchObject({ path: ['villageId'], message: 'Pick the village.' });
    const dasso = AppointOfficerRequest.safeParse({ ...base, role: 'dasso', scopeLevel: 'sector', villageId: undefined });
    expect(dasso.error?.issues[0]).toMatchObject({ path: ['sectorId'], message: 'Pick the sector.' });
    expect(AppointOfficerRequest.safeParse({ ...base, reason: '' }).success).toBe(false);
    expect(EndAppointmentQuery.safeParse({ reason: 'ok' }).success).toBe(false);
  });

  it('lets a business reviewer cover a province or the country, never a village', () => {
    expect(AppointOfficerRequest.safeParse({ ...base, role: 'business_approver', scopeLevel: 'province', provinceId: 1, villageId: undefined }).success).toBe(true);
    expect(AppointOfficerRequest.safeParse({ ...base, role: 'business_field_verifier', scopeLevel: 'country', villageId: undefined }).success).toBe(true);
    expect(AppointOfficerRequest.safeParse({ ...base, role: 'business_approver' }).success).toBe(false);
  });
});

describe('LocalLeadersService · before anything is written', () => {
  function setup(resolved: Record<string, unknown> | null): { db: Database; service: LocalLeadersService } {
    const db = { transaction: vi.fn() } as unknown as Database;
    const repo = { resolve: vi.fn(async () => resolved) } as unknown as LocalLeadersRepository;
    const service = new LocalLeadersService(db, repo, {} as OversightGrantsService, {} as GuestRoutingService, {} as GuestNotifier);
    return { db, service };
  }
  const body = AppointOfficerRequest.parse({
    email: 'cell@example.rw',
    role: 'cell_executive',
    governmentBodyCode: 'MINALOC',
    governmentTitle: 'Executive secretary',
    scopeLevel: 'cell',
    sectorId: 11,
    cellId: 110,
    reason: 'Took office',
  });

  it('refuses a place that does not exist, under its field', async () => {
    const { service, db } = setup(null);
    const e = await service.appoint('admin', body).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(BadRequestException);
    expect((e as BadRequestException).getResponse()).toMatchObject({ issues: [{ path: ['cellId'], message: 'That cell does not exist. Pick one from the list.' }] });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('refuses a cell that is not in the sector the form sent', async () => {
    const { service, db } = setup({ provinceId: 1, districtId: 1, sectorId: 12, cellId: 110, villageId: null });
    const e = await service.appoint('admin', body).catch((x: unknown) => x);
    expect((e as BadRequestException).getResponse()).toMatchObject({ issues: [{ path: ['cellId'], message: 'That cell is not in the sector you picked. Pick them again.' }] });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('keeps a PSF membership officer at PSF, for the whole country', async () => {
    const { service } = setup(null);
    const psf = AppointOfficerRequest.parse({ ...body, role: 'psf_membership_officer', governmentBodyCode: 'MINALOC', scopeLevel: 'country', sectorId: null, cellId: null });
    await expect(service.appoint('admin', psf)).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('words an appointment’s area from its own level up', () => {
    const names = { provinceName: 'Kigali', districtName: 'Gasabo', sectorName: 'Kacyiru', cellName: 'Kamatamu', villageName: 'Urugwiro' };
    expect(appointmentArea({ scopeLevel: 'village', ...names })).toBe('Urugwiro village, Kamatamu cell, Kacyiru sector, Gasabo');
    expect(appointmentArea({ scopeLevel: 'sector', ...names })).toBe('Kacyiru sector, Gasabo');
    expect(appointmentArea({ scopeLevel: 'district', ...names })).toBe('Gasabo');
    expect(appointmentArea({ scopeLevel: 'province', ...names })).toBe('Kigali City');
    expect(appointmentArea({ scopeLevel: 'country', ...names })).toBe('Rwanda');
  });
});
