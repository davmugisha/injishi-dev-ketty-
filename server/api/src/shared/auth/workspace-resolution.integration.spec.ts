import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { LEGACY_PERMISSION_KEY, type WorkspaceAccess } from '@injishi/contracts';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from '../../database/drizzle/schema';
import type { Database } from '../database/database.module';
import { PreSliceWorkspaceResolver } from './workspace-resolution.reference';
import { WorkspaceService } from './workspace.service';

/**
 * The resolution snapshot (ADR-076 G19, first half; G1).
 *
 * Slice G replaced the seven query resolver behind `/me/workspaces` and the
 * guard with one statement. This runs both over EVERY person in a real sample
 * database, the frozen copy of the old one beside the new one, and fails on any
 * difference in what a person holds: their workspaces, each workspace's
 * permissions, branches, coverage and every other field the grant returned
 * before, and the properties the guard's branch scope reads. The only thing the
 * new answer may add is `grants`, which is checked against the same facts.
 *
 * It needs a migrated, seeded sample database and is skipped without one:
 *
 *   ACCESS_IT_DATABASE_URL=postgres://... pnpm --filter @injishi/api exec vitest run workspace-resolution
 */
const DATABASE_URL = process.env.ACCESS_IT_DATABASE_URL?.trim();
const describeWithDatabase = DATABASE_URL ? describe : describe.skip;

/** Departments came back in whatever order the database chose; the set is what the grant means. */
function comparable(access: WorkspaceAccess): Omit<WorkspaceAccess, 'grants'> {
  const rest: Partial<WorkspaceAccess> = { ...access };
  delete rest.grants;
  return { ...(rest as Omit<WorkspaceAccess, 'grants'>), departments: [...access.departments].sort() };
}

describeWithDatabase('workspace resolution, before and after ADR-076 slice G', () => {
  // Each test walks the whole roster, about ten seconds on a laptop.
  vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

  let pool: Pool;
  let service: WorkspaceService;
  let reference: PreSliceWorkspaceResolver;
  let people: string[];

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 4 });
    const db = drizzle(pool, { schema }) as unknown as Database;
    service = new WorkspaceService(db);
    reference = new PreSliceWorkspaceResolver(db);
    const { rows } = await pool.query<{ user_id: string }>(`
      SELECT user_id FROM org_memberships
      UNION
      SELECT user_id FROM workspaces WHERE user_id IS NOT NULL
      ORDER BY 1
    `);
    people = rows.map((r) => r.user_id);
  });

  afterAll(async () => {
    await pool?.end();
  });

  it('reads a real roster', () => {
    expect(people.length).toBeGreaterThan(20);
  });

  it('gives every person the same workspaces, permissions, branches and coverage as before', async () => {
    let workspacesCompared = 0;
    for (const userId of people) {
      const before = await reference.listForUser(userId);
      const after = await service.listForUser(userId);
      expect(after.map((w) => w.workspaceId).sort()).toEqual(
        before.map((w) => w.workspaceId).sort(),
      );
      for (const old of before) {
        const now = after.find((w) => w.workspaceId === old.workspaceId);
        expect(now && comparable(now)).toEqual(comparable(old));

        // What the guard narrows every read by: the same properties, the same coverage.
        const resolved = await service.accessFor(userId, old.workspaceId);
        const covered = await reference.coveredProperties(userId, old);
        expect(resolved?.covered.coverage).toEqual(covered.coverage);
        expect([...(resolved?.covered.propertyIds ?? [])].sort()).toEqual(
          [...covered.propertyIds].sort(),
        );
        // And the guard's one workspace is the list's entry, field for field.
        expect(resolved?.access).toEqual(now);
        workspacesCompared += 1;
      }
    }
    expect(workspacesCompared).toBeGreaterThan(people.length);
  });

  it('adds grants that say the same thing as the flat fields (G1)', async () => {
    for (const userId of people) {
      for (const access of await service.listForUser(userId)) {
        if (access.kind !== 'business') {
          expect(access.grants).toBeUndefined();
          continue;
        }
        const grants = access.grants;
        expect(grants?.family).toBe('business');
        // Until slice R: the one role, keyed by its value, with no id.
        expect(grants?.roles).toEqual([
          expect.objectContaining({ roleId: null, key: access.orgRole, kind: 'default' }),
        ]);
        // Today's permissions under their new names, one for one.
        const limitedToNothing =
          access.branchCoverage === 'limited' && (grants?.roles[0]?.scopes.length ?? 0) === 0;
        expect(grants?.permissions.map((p) => p.key)).toEqual(
          limitedToNothing ? [] : access.permissions.map((p) => LEGACY_PERMISSION_KEY[p]),
        );
        // Every business holds account (a member covering no branch holds no
        // product, as they hold no permission), and a member limited to some
        // branches carries a branch scope on the role and on every permission.
        expect(grants?.products.some((p) => p.id === 'account')).toBe(!limitedToNothing);
        const scopes = grants?.roles[0]?.scopes ?? [];
        if (access.branchCoverage === 'all') expect(scopes).toEqual([]);
        for (const permission of grants?.permissions ?? []) expect(permission.scopes).toEqual(scopes);
        // A limited member's products name only branches they cover, never `all`.
        if (access.branchCoverage === 'limited') {
          const covered = access.branches.map((b) => b.id);
          for (const product of grants?.products ?? []) {
            expect(product.branches).not.toBe('all');
            expect(covered).toEqual(expect.arrayContaining([...product.branches]));
          }
        }
      }
    }
  });

  it('answers a workspace a person does not hold, and a malformed id, with nothing', async () => {
    const [someone] = people;
    expect(await service.accessFor(someone, '00000000-0000-4000-8000-000000000000')).toBeNull();
    expect(await service.accessFor(someone, 'not-a-uuid')).toBeNull();
  });
});
