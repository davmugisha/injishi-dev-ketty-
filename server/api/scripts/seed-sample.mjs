#!/usr/bin/env node
/**
 * The ONE sample data recipe (ADR-043), for local development, staging and the
 * demo alike, so all three hold exactly the same rows.
 *
 *   node scripts/seed-sample.mjs          (pnpm db:seed)
 *
 * Seeds DATABASE_URL, in dependency order:
 *
 *   seed-geography.mjs        provinces → villages (FK target for everything)
 *   seed-content.mjs          reference data, the hospitality org and its hotel
 *   seed-users.mjs            the @injishi.com sign in accounts and their grants,
 *                             and the residence org their landlord owns
 *   seed-content.mjs (again)  the residence side (building, units, leases). It
 *                             skips that block while the residence org does not
 *                             exist, and seed-users is what creates it. Every
 *                             insert is ON CONFLICT DO NOTHING, so the second
 *                             pass adds only what the first one skipped
 *   seed-demo.mjs             the demo roster (the personas the sign in picker
 *                             lists) and the rows they trade on
 *   seed-demo-catalogue.mjs   the 52 catalogue properties, every row marked demo
 *   seed-demo-hotel.mjs       Amahoro as a working hotel: 20 rooms, departments,
 *                             outlets, a month of stays and bills, today's desk,
 *                             housekeeping, repairs and orders
 *   seed-demo-portfolio.mjs   the landlord's full rent roll, the district
 *                             registration pipeline, and the admin console's
 *                             reviews and support tickets
 *
 * then records the finish in `database_identity.seeded_at`, which
 * `GET /api/v1/platform` reports as the last reset time.
 *
 * It refuses, before running anything, a database that carries no sample
 * marker, and so does every script it runs (`sample-database.mjs`). Mark an
 * EMPTY, migrated database first with `mark-sample-database.mjs --sample`.
 *
 * Stops at the first failing step and exits non zero, leaving `seeded_at`
 * untouched, so a half seeded database never claims to have been reset.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

import { markHeadOffices } from './head-offices.mjs';
import { assertSampleDatabase, describeDatabase } from './sample-database.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

/** The recipe, in dependency order. See the header. */
const STEPS = [
  { script: 'seed-geography.mjs', what: 'geography (provinces → villages)' },
  { script: 'seed-content.mjs', what: 'reference data and the seeded hotel' },
  {
    script: 'sync-rra-classifications.mjs',
    what: 'RRA item classifications: the VSDC specification sample codes (ADR-050 D-m)',
    env: { RRA_CLASSIFICATION_SOURCE: path.join(here, 'data', 'rra-item-classifications.sample.json') },
  },
  { script: 'seed-users.mjs', what: 'sign in accounts and their grants' },
  { script: 'seed-content.mjs', what: 'second pass: the residence side seed-users unlocked' },
  { script: 'seed-demo.mjs', what: 'the demo roster and the rows it trades on' },
  {
    script: 'seed-demo-catalogue.mjs',
    what: 'the catalogue inventory (marked demo data)',
    // It prints ~100 lines of paste ready listing ids after its row counts.
    // Useful when editing the web fixture, noise here; shown in full on failure.
    stopAt: 'listing ids for',
  },
  // Both read rows seed-demo.mjs writes, so they run after it.
  { script: 'seed-demo-hotel.mjs', what: 'Amahoro as a working hotel: the hotel personas\' day' },
  { script: 'seed-demo-portfolio.mjs', what: 'rent roll, registration pipeline, reviews and support' },
  // Last: it places tenants on leases the two residence seeds above write.
  { script: 'seed-broker.mjs', what: 'brokers: credits, reveals, placements and fees (ADR-038 child 6)' },
];

function fail(message) {
  console.error(`\nseed-sample: ${message}`);
  process.exit(1);
}

const url = process.env.DATABASE_URL?.trim();
if (!url) fail('DATABASE_URL is not set.');

async function withClient(fn) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end().catch(() => {});
  }
}

// Refuse before a single step runs, so an unmarked database is not left with
// geography and nothing else.
try {
  await withClient((client) => assertSampleDatabase(client, 'seed-sample.mjs'));
} catch (error) {
  fail(error?.message ?? String(error));
}

console.log(`Seeding the sample recipe into ${describeDatabase(url)}.`);

for (const [i, step] of STEPS.entries()) {
  console.log(`\n→ ${i + 1}/${STEPS.length} ${step.script}: ${step.what}`);
  const result = spawnSync(process.execPath, [path.join(here, step.script)], {
    cwd: path.join(here, '..'),
    env: { ...process.env, ...step.env },
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: step.stopAt ? ['ignore', 'pipe', 'inherit'] : 'inherit',
  });
  if (step.stopAt && typeof result.stdout === 'string') {
    const out = result.stdout;
    const cut = result.status === 0 ? out.indexOf(step.stopAt) : -1;
    process.stdout.write(
      cut === -1 ? out : `${out.slice(0, cut).trimEnd()}\n  (listing id table omitted)\n`,
    );
  }
  if (result.error) fail(`${step.script} could not start: ${result.error.message}`);
  if (result.status !== 0) {
    fail(`${step.script} failed with exit code ${result.status}; see its output above.`);
  }
}

// ADR-054: the seeds write properties after the migration that marks head
// offices, so the rule is applied once more to what they wrote.
const marked = await withClient((client) => markHeadOffices(client));
console.log(`\nHead offices marked for ${marked} hospitality org(s) that had none.`);

// Only a complete run is a reset. The update trigger allows `seeded_at` alone.
const seededAt = await withClient(async (client) => {
  const { rows } = await client.query(
    'update database_identity set seeded_at = now() returning seeded_at',
  );
  return rows[0]?.seeded_at;
});

console.log(`\nSample data seeded; seeded_at is ${seededAt?.toISOString?.() ?? seededAt}.`);
