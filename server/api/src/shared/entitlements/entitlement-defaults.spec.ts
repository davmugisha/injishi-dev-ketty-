import { describe, expect, it } from 'vitest';

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { escalations, orgProductEntitlements } from '../../database/drizzle/schema';
import { EntitlementDefaults } from './entitlement-defaults';

/**
 * The products a business gets without anyone choosing them (ADR-076 G2, G4).
 *
 * The fake transaction answers the two reads `applyTx` makes (the org, then the
 * rows it already holds) and records what it inserts.
 */
describe('EntitlementDefaults', () => {
  interface FakeTx {
    tx: Parameters<typeof EntitlementDefaults.applyTx>[0];
    inserted: { table: unknown; rows: unknown }[];
    productsInserted: () => string[];
  }

  function fakeTx(org: Record<string, unknown> | undefined, heldProducts: string[] = []): FakeTx {
    const inserted: { table: unknown; rows: unknown }[] = [];
    let reads = 0;
    const tx = {
      select: () => ({
        from: () => ({
          where: () => {
            reads += 1;
            // First read: the org (it ends in `.limit`). Second: the held rows.
            if (reads === 1) return { limit: () => Promise.resolve(org ? [org] : []) };
            return Promise.resolve(heldProducts.map((productId) => ({ productId })));
          },
        }),
      }),
      insert: (table: unknown) => ({
        values: (rows: unknown) => {
          inserted.push({ table, rows });
          const done = Promise.resolve();
          return Object.assign(done, { onConflictDoNothing: () => Promise.resolve() });
        },
      }),
    } as unknown as Parameters<typeof EntitlementDefaults.applyTx>[0];
    const productsInserted = (): string[] =>
      inserted
        .filter((i) => i.table === orgProductEntitlements)
        .flatMap((i) => (i.rows as { productId: string }[]).map((r) => r.productId));
    return { tx, inserted, productsInserted };
  }

  const STAY = { businessKind: 'hotel', districtId: 101 };

  it('gives a stay its kind set, every branch, source registration, leaving account alone', async () => {
    const { tx, inserted, productsInserted } = fakeTx(STAY, ['account']);
    const result = await EntitlementDefaults.applyTx(tx, 'org-1');
    expect(result.kind).toBe('stay');
    expect(productsInserted()).toEqual(['marketplace', 'pms', 'outlets', 'pos', 'hr', 'finance', 'pay']);
    expect(inserted[0].rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ orgId: 'org-1', productId: 'pms', propertyId: null, source: 'registration' }),
      ]),
    );
  });

  it('gives a venue no PMS, and a residence Residence and no PMS (ADR-074 D-k)', async () => {
    // Read from business_kind, not from the domain: both venues are hospitality orgs.
    for (const businessKind of ['bar_restaurant', 'coffee_shop']) {
      const venue = fakeTx({ businessKind, districtId: 1 }, ['account']);
      const result = await EntitlementDefaults.applyTx(venue.tx, 'org-2');
      expect(result.kind).toBe('venue');
      expect(venue.productsInserted()).toEqual(['marketplace', 'outlets', 'pos', 'hr', 'finance', 'pay']);
    }

    const residence = fakeTx({ businessKind: 'residence', districtId: 1 }, ['account']);
    await EntitlementDefaults.applyTx(residence.tx, 'org-3');
    expect(residence.productsInserted()).toEqual(['marketplace', 'residence', 'hr', 'finance', 'pay']);
  });

  it('writes nothing for a reinstatement: the rows persisted through the suspension', async () => {
    const all = ['account', 'marketplace', 'pms', 'outlets', 'pos', 'hr', 'finance', 'pay'];
    const { tx, inserted } = fakeTx(STAY, all);
    const result = await EntitlementDefaults.applyTx(tx, 'org-1');
    expect(result.written).toEqual([]);
    expect(inserted).toEqual([]);
  });

  it('never switches back on a product staff switched off: any row, open or closed, counts as held', async () => {
    // `pos` has only closed rows; the read returns every row of the org.
    const { tx, productsInserted } = fakeTx(STAY, ['account', 'marketplace', 'pms', 'outlets', 'pos', 'hr', 'finance']);
    await EntitlementDefaults.applyTx(tx, 'org-1');
    expect(productsInserted()).toEqual(['pay']);
  });

  it('gives an org whose kind cannot be resolved account only, an escalation, and guesses nothing (G4)', async () => {
    // A value the database gained before the code mapped it.
    const { tx, inserted, productsInserted } = fakeTx({ businessKind: 'unmapped_check', districtId: 7 });
    const result = await EntitlementDefaults.applyTx(tx, 'org-9');
    expect(result).toEqual({ kind: null, written: ['account'] });
    expect(productsInserted()).toEqual(['account']);
    expect(inserted.find((i) => i.table === escalations)?.rows).toEqual({
      subjectType: 'org',
      subjectId: 'org-9',
      type: 'business_kind_unresolved',
      districtId: 7,
    });
  });

  it('writes account with the org, once', async () => {
    const created = fakeTx(undefined, []);
    // `writeAccountTx` makes one read (the held rows), so answer it first.
    const tx = {
      select: () => ({ from: () => ({ where: () => Promise.resolve([]) }) }),
      insert: created.tx.insert,
    } as unknown as Parameters<typeof EntitlementDefaults.writeAccountTx>[0];
    await EntitlementDefaults.writeAccountTx(tx, 'org-new');
    expect(created.productsInserted()).toEqual(['account']);
  });

  /**
   * Every write of `registration_status` that can reach `active` runs the rule
   * in its transaction (G2). A new path into `active` that forgets it fails
   * here, by name, before it can activate a business with no products.
   */
  // Reads every source file: slow on a laptop under a full parallel run, so it gets 30 seconds.
  it('runs on every path into active', () => {
    const src = join(__dirname, '..', '..');
    const writers: Record<string, boolean> = {};
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== 'testing') walk(path);
          continue;
        }
        if (!entry.name.endsWith('.ts') || entry.name.endsWith('.spec.ts')) continue;
        const text = readFileSync(path, 'utf8');
        const sets = [...text.matchAll(/\.set\(\{\s*registrationStatus:\s*([^,}]+)/g)].map((m) => m[1].trim());
        const raw = /update\s+orgs\s+set\s+registration_status/i.test(text);
        if (sets.length === 0 && !raw) continue;
        // Only a literal status other than `active` cannot reach it.
        const canReachActive = raw || sets.some((value) => !/^'(?!active')[a-z_]+'$/.test(value));
        writers[relative(src, path).replace(/\\/g, '/')] =
          !canReachActive || text.includes('EntitlementDefaults.applyTx(');
      }
    };
    walk(src);
    expect(writers).toEqual({
      'api/admin/orgs/org-actions.service.ts': true,
      'modules/organization/infrastructure/organization.repository.ts': true,
      'modules/organization/infrastructure/owner-claim.repository.ts': true,
    });
  }, 30_000);
});
