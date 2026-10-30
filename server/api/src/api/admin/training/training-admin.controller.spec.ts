import { describe, expect, it, vi } from 'vitest';

import {
  staffPermissionsForRoles,
  type AdminTrainingTrainerListResponse,
  type StaffAccess,
  type StaffRole,
} from '@injishi/contracts';
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

import { TrainingSessionService } from '../../../modules/training/application/training-session.service';
import { REQUIRE_STAFF_PERMISSION } from '../../../shared/auth/require-staff-permission.decorator';
import { SessionGuard } from '../../../shared/auth/session.guard';
import { StaffGuard } from '../../../shared/auth/staff.guard';
import type { TwoFactorService } from '../../../shared/auth/two-factor.service';
import type { WorkspaceService } from '../../../shared/auth/workspace.service';
import { AdminTrainingController } from './training-admin.controller';

/**
 * `GET /api/v1/admin/training/trainers` (ADR-049 AC-7, AC-24).
 *
 * The list a session form fills its lead trainer picker from. What these tests
 * pin: who may call it (the class's `training.view`, with no override, refused
 * through the real `StaffGuard` for a staffer who lacks it), that the
 * controller hands the query straight to the service, and that the service
 * selects exactly id, name and email of live staff holding `trainer`.
 */

const TRAINER_ID = '5b7f0a52-3d0e-4d8e-9b8e-0c6f4a1d2e31';

function access(roles: StaffRole[]): StaffAccess {
  return { isStaff: true, roles, permissions: staffPermissionsForRoles(roles) };
}

function guardFor(resolved: StaffAccess): StaffGuard {
  const workspaces = {
    staffAccessForUser: vi.fn().mockResolvedValue(resolved),
  } as unknown as WorkspaceService;
  // The step-up is satisfied in every case: this spec is about the permission.
  const twoFactor = {
    assertSatisfied: vi.fn().mockResolvedValue(undefined),
    stateFor: vi.fn().mockResolvedValue({ verified: true }),
  } as unknown as TwoFactorService;
  return new StaffGuard(workspaces, twoFactor, new Reflector());
}

function contextForListTrainers(request: object): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => AdminTrainingController.prototype.listTrainers,
    getClass: () => AdminTrainingController,
  } as unknown as ExecutionContext;
}

interface SignedInRequest {
  user: { id: string; email: string };
  session: { id: string };
}

const signedIn = (): SignedInRequest => ({
  user: { id: '712dbb3c-92fe-462f-abe5-2ed507b8c3fc', email: 'staff@example.test' },
  session: { id: 'session-1' },
});

describe('AdminTrainingController · GET trainers · who may call it', () => {
  it('runs SessionGuard before StaffGuard', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminTrainingController)).toEqual([
      SessionGuard,
      StaffGuard,
    ]);
  });

  it('inherits the class permission training.view and does not override it (covers: AC-24)', () => {
    expect(Reflect.getMetadata(REQUIRE_STAFF_PERMISSION, AdminTrainingController)).toBe(
      'training.view',
    );
    const handler = AdminTrainingController.prototype.listTrainers;
    expect(Reflect.getMetadata(REQUIRE_STAFF_PERMISSION, handler)).toBeUndefined();
    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toBeUndefined();
  });

  it('refuses a staffer who does not hold training.view (covers: AC-24, AC-25)', async () => {
    const finance = access(['finance']);
    // Not vacuous: the role really lacks the power the route needs.
    expect(finance.permissions).not.toContain('training.view');
    const request = signedIn();

    const attempt = guardFor(finance).canActivate(contextForListTrainers(request));

    await expect(attempt).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      guardFor(finance).canActivate(contextForListTrainers(signedIn())),
    ).rejects.toThrow(/^Your staff role cannot /);
    expect(request).not.toHaveProperty('staff');
  });

  it('refuses somebody who is not staff at all', async () => {
    const guard = guardFor({ isStaff: false, roles: [], permissions: [] });

    await expect(guard.canActivate(contextForListTrainers(signedIn()))).rejects.toThrow(
      'This console is for platform staff.',
    );
  });

  it.each([['trainer'], ['super_admin']] as const)(
    'admits a %s, who holds training.view (covers: AC-7)',
    async (role) => {
      const request = signedIn();

      await expect(
        guardFor(access([role])).canActivate(contextForListTrainers(request)),
      ).resolves.toBe(true);
      expect((request as { staff?: StaffAccess }).staff?.roles).toEqual([role]);
    },
  );
});

describe('AdminTrainingController · GET trainers · the handler', () => {
  it('hands the validated query to the session service and returns its page unchanged', async () => {
    const page: AdminTrainingTrainerListResponse = {
      items: [{ id: TRAINER_ID, name: 'Aline Uwase', email: 'aline@example.test' }],
      meta: { total: 1, page: 2, pageSize: 10 },
    };
    const sessions = { listTrainers: vi.fn().mockResolvedValue(page) };
    const controller = new AdminTrainingController(
      {} as never,
      sessions as unknown as TrainingSessionService,
      {} as never,
      {} as never,
    );

    await expect(controller.listTrainers({ page: 2, pageSize: 10 })).resolves.toBe(page);
    expect(sessions.listTrainers).toHaveBeenCalledWith({ page: 2, pageSize: 10 });
  });
});

interface RecordedSelect {
  columns: Record<string, unknown>;
  where?: SQL;
  limit?: number;
  offset?: number;
}

/**
 * A stand-in for the Drizzle builder that records what the service asked for.
 * Each `select` returns a chain that resolves, when awaited, to the rows given
 * for that kind of select (the count, or the page).
 */
function recordingDb(
  total: number,
  rows: unknown[],
): { db: { select(columns: Record<string, unknown>): unknown }; selects: RecordedSelect[] } {
  const selects: RecordedSelect[] = [];
  const db = {
    select(columns: Record<string, unknown>) {
      const record: RecordedSelect = { columns };
      selects.push(record);
      const result = 'total' in columns ? [{ total }] : rows;
      const chain = {
        from: () => chain,
        innerJoin: () => chain,
        where: (where: SQL) => ((record.where = where), chain),
        orderBy: () => chain,
        limit: (n: number) => ((record.limit = n), chain),
        offset: (n: number) => ((record.offset = n), chain),
        then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
          Promise.resolve(result).then(resolve, reject),
      };
      return chain;
    },
  };
  return { db, selects };
}

describe('TrainingSessionService.listTrainers', () => {
  const dialect = new PgDialect();
  const render = (where?: SQL): string => (where ? dialect.sqlToQuery(where).sql : '');

  it('selects only id, name and email for the page (covers: AC-7)', async () => {
    const { db, selects } = recordingDb(1, [
      { id: TRAINER_ID, name: 'Aline Uwase', email: 'aline@example.test' },
    ]);
    const service = new TrainingSessionService(db as never, {} as never);

    await service.listTrainers({});

    const page = selects.find((s) => !('total' in s.columns));
    expect(Object.keys(page?.columns ?? {}).sort()).toEqual(['email', 'id', 'name']);
  });

  it('lists live staff holding trainer, and counts with the same filter', async () => {
    const { db, selects } = recordingDb(0, []);
    const service = new TrainingSessionService(db as never, {} as never);

    await service.listTrainers({});

    expect(selects).toHaveLength(2);
    for (const select of selects) {
      const sql = render(select.where);
      expect(sql).toContain(`'trainer' = ANY("admin_users"."staff_roles")`);
      expect(sql).toContain(`"admin_users"."revoked_at" is null`);
    }
  });

  it('pages with page and pageSize, and reports the total it counted', async () => {
    const { db, selects } = recordingDb(23, []);
    const service = new TrainingSessionService(db as never, {} as never);

    const result = await service.listTrainers({ page: 3, pageSize: 10 });

    const page = selects.find((s) => !('total' in s.columns));
    expect(page?.limit).toBe(10);
    expect(page?.offset).toBe(20);
    expect(result.meta).toEqual({ total: 23, page: 3, pageSize: 10 });
  });

  it('passes a missing name through as null and drops anything else a row carries', async () => {
    const { db } = recordingDb(1, [
      { id: TRAINER_ID, name: null, email: 'nameless@example.test', phone: '+250788000000' },
    ]);
    const service = new TrainingSessionService(db as never, {} as never);

    const result = await service.listTrainers({});

    expect(result.items).toEqual([
      { id: TRAINER_ID, name: null, email: 'nameless@example.test' },
    ]);
  });
});
