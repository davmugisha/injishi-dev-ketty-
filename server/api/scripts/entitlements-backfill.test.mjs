import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { ENTITLEMENTS_BACKFILL_SQL } from './entitlements-backfill.mjs';

/**
 * The seed's catch up and migration 0134's backfill must be the same rule
 * (ADR-076 G3). If they drift, a sample database gives its businesses
 * different products from the ones production gave the same businesses, and
 * the slice G snapshots compare a demo nobody runs.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const migration = readFileSync(
  path.join(here, '..', 'src', 'database', 'drizzle', 'migrations', '0134_account_grants_entitlements.sql'),
  'utf8',
);

/** Comments, quotes and whitespace removed: what the statement says, not how it is typed. */
function normalise(sql) {
  return sql
    .replace(/--[^\n]*/g, '')
    .replace(/"/g, '')
    .replace(/;\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

test('the seed runs migration 0134 backfill word for word', () => {
  const start = migration.indexOf('INSERT INTO "org_product_entitlements"');
  assert.ok(start !== -1, 'the backfill was not found in migration 0134');
  const statement = migration.slice(start).split('--> statement-breakpoint')[0];
  assert.equal(normalise(ENTITLEMENTS_BACKFILL_SQL), normalise(statement));
});

test('the products the backfill names are the ones the migration seeds', () => {
  const seeded = [...migration.matchAll(/\('([a-z]+)'\)/g)].map((m) => m[1]);
  const named = new Set([...ENTITLEMENTS_BACKFILL_SQL.matchAll(/'([a-z]+)'/g)].map((m) => m[1]));
  for (const status of ['active', 'suspended', 'hospitality', 'residence', 'backfill']) named.delete(status);
  for (const product of named) assert.ok(seeded.includes(product), `${product} is not seeded`);
  assert.ok(!named.has('admin') && !named.has('membership'), 'admin and membership are never entitlements');
});
