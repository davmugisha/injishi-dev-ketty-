import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { HttpException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Domain, WorkspaceAccess } from '@injishi/contracts';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from '../../database/drizzle/schema';
import type { OtpMailer } from '../../modules/auth/infrastructure/otp-mailer';
import type { Platform } from '../config/platform';
import type { Database } from '../database/database.module';
import { DELIBERATE_LOSSES } from './testing/deliberate-losses';
import { guardedRoutes, permitted, type GuardedRoute } from './testing/guarded-routes';
import { TwoFactorService } from './two-factor.service';
import { WorkspaceGuard } from './workspace.guard';
import { PreSliceWorkspaceResolver } from './workspace-resolution.reference';
import { WorkspaceService } from './workspace.service';

/**
 * The guard over a real sample database (ADR-076 G17, G19 second half).
 *
 * G17: a guarded request resolves the caller's access once, within three
 * queries, on three representative routes (a PMS read, an HR write, a property
 * capability route). Counted at the connection pool, so nothing the guard does
 * can hide from it.
 *
 * G19: every membership reaches exactly the routes it reached before the
 * slice. "Before" is the frozen resolver with the permission check alone;
 * "after" is the real guard, with the operational and entitlement layers in
 * front of it, over what the real resolver reads. The only difference allowed
 * is the one A-13 decided: a route of a product a business never ran (a
 * hotel's rentals, a landlord's PMS, Outlets and POS) is now refused by
 * entitlement, and only for the controllers the reviewed list in
 * `testing/deliberate-losses.ts` names. Every other difference fails, by
 * membership and route.
 *
 * Skipped without a migrated, seeded sample database:
 *   ACCESS_IT_DATABASE_URL=postgres://... pnpm --filter @injishi/api exec vitest run access-reach
 */
const DATABASE_URL = process.env.ACCESS_IT_DATABASE_URL?.trim();
const describeWithDatabase = DATABASE_URL ? describe : describe.skip;

describeWithDatabase('the guard over a real roster', () => {
  // The reach test walks every membership over every route, about ten seconds on a laptop.
  vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

  let pool: Pool;
  let queries = 0;
  let service: WorkspaceService;
  let twoFactor: TwoFactorService;
  let reference: PreSliceWorkspaceResolver;
  let routes: GuardedRoute[];

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 4 });
    // Count every statement the pool runs, whichever client it hands out.
    const original = pool.query.bind(pool) as (...args: unknown[]) => unknown;
    (pool as unknown as { query: (...args: unknown[]) => unknown }).query = (...args: unknown[]) => {
      queries += 1;
      return original(...args);
    };
    const db = drizzle(pool, { schema }) as unknown as Database;
    service = new WorkspaceService(db);
    twoFactor = new TwoFactorService(
      db,
      { environment: 'demo' } as Platform,
      {} as OtpMailer,
    );
    reference = new PreSliceWorkspaceResolver(db);
    routes = await guardedRoutes();
  });

  afterAll(async () => {
    await pool?.end();
  });

  function contextFor(route: GuardedRoute, request: Record<string, unknown>): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => route.handler,
      getClass: () => route.controller,
    } as unknown as ExecutionContext;
  }

  it('resolves a guarded request in at most three queries (A-17, G17)', async () => {
    const [owner] = (
      await pool.query<{ user_id: string; workspace_id: string; session_id: string | null }>(`
        SELECT m.user_id, w.id AS workspace_id,
               (SELECT s.id FROM sessions s WHERE s.user_id = m.user_id ORDER BY s.created_at DESC LIMIT 1) AS session_id
          FROM org_memberships m
          JOIN orgs o ON o.id = m.org_id AND o.registration_status = 'active' AND o.domain = 'hospitality'
          JOIN workspaces w ON w.org_id = o.id
         WHERE m.org_role = 'owner' AND m.status = 'active'
         ORDER BY (SELECT count(*) FROM sessions s WHERE s.user_id = m.user_id) DESC
         LIMIT 1`)
    ).rows;
    expect(owner).toBeDefined();
    const guard = new WorkspaceGuard(service, twoFactor, new Reflector());
    const representative = ['OpsReservationsController.list', 'OpsPayRunsController.create', 'InventoryController.listProperties'];
    for (const key of representative) {
      const route = routes.find((r) => r.key === key) ?? routes.find((r) => r.key.startsWith(key.split('.')[0]));
      expect(route).toBeDefined();
      const request = {
        headers: { 'x-workspace-id': owner.workspace_id },
        user: { id: owner.user_id },
        // With a session, so the step-up state is read as well.
        ...(owner.session_id ? { session: { id: owner.session_id } } : {}),
      };
      queries = 0;
      try {
        await guard.canActivate(contextFor(route!, request));
      } catch (error) {
        // A refusal still had to resolve the access; the budget holds either way.
        if (!(error instanceof HttpException)) throw error;
      }
      expect({ route: route!.key, queries }).toEqual({ route: route!.key, queries: expect.any(Number) });
      expect(queries).toBeLessThanOrEqual(3);
    }
  });

  it('gives every membership the routes it had, but for the products its business never ran (G19, A-13)', async () => {
    const { rows: holders } = await pool.query<{ user_id: string }>(`
      SELECT user_id FROM org_memberships WHERE status = 'active'
      UNION
      SELECT user_id FROM workspaces WHERE user_id IS NOT NULL
      ORDER BY 1`);
    const unexpected: string[] = [];
    let deliberate = 0;
    let decisions = 0;

    for (const { user_id: userId } of holders) {
      const before = await reference.listForUser(userId);
      for (const old of before) {
        const resolved = await service.accessFor(userId, old.workspaceId);
        expect(resolved).not.toBeNull();
        const guard = new WorkspaceGuard(
          { accessFor: () => Promise.resolve(resolved) } as unknown as WorkspaceService,
          twoFactor,
          new Reflector(),
        );
        for (const route of routes) {
          // The old guard: the permission check, then an org wide write refused
          // to a member limited to some branches (ADR-054 AC-M6).
          const declaresPermission = route.required.length > 0 || route.anyOf.length > 0;
          const reachedBefore =
            (!declaresPermission || permitted(route, old.permissions)) &&
            !(route.everyBranch && old.branchCoverage === 'limited');
          let reachedAfter = true;
          let refusedWith: string | null = null;
          try {
            await guard.canActivate(
              contextFor(route, { headers: { 'x-workspace-id': old.workspaceId }, user: { id: userId } }),
            );
          } catch (error) {
            if (!(error instanceof HttpException)) throw error;
            reachedAfter = false;
            refusedWith = (error.getResponse() as { code?: string }).code ?? null;
          }
          decisions += 1;
          if (reachedBefore === reachedAfter) continue;
          if (isDeliberate(route, old, reachedBefore, reachedAfter, refusedWith)) {
            deliberate += 1;
            continue;
          }
          unexpected.push(`${old.workspaceId} ${old.orgRole ?? old.kind} ${route.key}: ${reachedBefore} -> ${reachedAfter}`);
        }
      }
    }
    expect(decisions).toBeGreaterThan(10_000);
    expect(unexpected).toEqual([]);
    // Recorded, not asserted: how many reaches A-13 removed on purpose.
    process.stdout.write(`\n  G19: ${decisions} decisions, ${deliberate} deliberate cross domain refusals, ${unexpected.length} unexpected\n`);
  });
});

/**
 * A-13, as reviewed: a route the business reached before and is refused now,
 * by entitlement, on a controller `DELIBERATE_LOSSES` lists for its domain.
 * That is the one difference the snapshot accepts.
 */
function isDeliberate(
  route: GuardedRoute,
  access: WorkspaceAccess,
  reachedBefore: boolean,
  reachedAfter: boolean,
  refusedWith: string | null,
): boolean {
  if (!reachedBefore || reachedAfter || access.kind !== 'business' || refusedWith !== 'product_off') return false;
  const listed = DELIBERATE_LOSSES[access.domain as Domain];
  return listed?.has(route.controller.name) ?? false;
}
