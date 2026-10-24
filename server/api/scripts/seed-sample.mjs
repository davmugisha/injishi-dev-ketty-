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
 *   seed-demo-psf.mjs, seed-broker.mjs
 *                             PSF membership, and the brokers' credits, reveals,
 *                             placements and fees
 *   seed-demo-documents.mjs   the registration documents the field verifier and
 *                             the approver read, as real PDFs in object storage
 *   seed-hr-files.mjs         a staff file per account
 *   seed-ui2.mjs              LAST: Amahoro's finance and hr personas and what
 *                             the role homes show, from seed-ui2/NN-*.mjs
 *
 * On a database past the rentals rebuild (migrations 0073-0080) every step
 * skips its leases, rent, deposits, notices and placements and says so: those
 * rows only come through the app now. The residence businesses, buildings and
 * units are still written, and each residence room gets its rental unit below.
 *
 * then gives every property the seeds wrote the USALI department set (ADR-016
 * AC-14), which they skip by INSERTing properties directly, and records the
 * finish in `database_identity.seeded_at`, which
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
import {
  propertiesWithoutDepartments,
  seedMissingDepartments,
} from './property-departments.mjs';
import { rentalsRebuilt, syncRentalUnits } from './rentals-rebuilt.mjs';
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
  // Invented placeholder PAYE, RSSB, leave and holiday rows, marked DEMO SAMPLE
  // DATA, so pay and leave compute on a sample database (ADR-058 slice 1).
  { script: 'seed-hr-rules.mjs', what: 'HR rules: placeholder PAYE, RSSB, leave and holidays (ADR-058)' },
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
  // Reads two pipeline businesses seed-demo-portfolio.mjs writes.
  { script: 'seed-demo-psf.mjs', what: 'PSF membership: tiers, an officer, an application (ADR-056)' },
  // It places tenants on leases the two residence seeds above write.
  { script: 'seed-broker.mjs', what: 'brokers: credits, reveals, placements and fees (ADR-038 child 6)' },
  // The documents the two government officers review, with real files behind
  // them. It reads the pipeline `seed-demo-portfolio.mjs` wrote, so it runs
  // after it, and it writes objects into whichever store the API is configured
  // for (F-S03 §5).
  { script: 'seed-demo-documents.mjs', what: 'registration documents for the businesses in the officer queues' },
  // After every step that creates a membership: migration 0053 backfilled files
  // only for memberships that existed when it ran, which on a migrate-then-seed
  // database is none (ADR-058 AC-P5).
  { script: 'seed-hr-files.mjs', what: 'HR: a staff file for every seeded staff account (ADR-058)' },
  // LAST: every seed-ui2/NN-*.mjs reads the rows the steps above write, and
  // 00-personas.mjs gives its two new staff their own files, because the step
  // above ran before their memberships existed. Before the head office and
  // department passes below, so a property a ui2 file adds is covered by both.
  { script: 'seed-ui2.mjs', what: 'ui2: the finance and hr personas, and what the six role homes show (ADR-069)' },
  { script: 'seed-interface.mjs', what: 'the new interface: its world and screens, from the packages/data fixtures (ADR-072)' },
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

// ADR-016 AC-14, for the same reason: a seed INSERTs its properties, so it
// misses both migration 0011's backfill and the department set listing-setup
// writes inside the transaction that creates a property. A property with no
// departments offers a guest an EMPTY list of desks to write to — which is what
// the demo showed for every property except Amahoro Boutique Hotel, the only
// one any seed in this recipe gives departments to.
const filled = await withClient(async (client) => {
  const written = await seedMissingDepartments(client);
  const missing = await propertiesWithoutDepartments(client);
  return { ...written, missing };
});
console.log(
  `USALI departments: ${filled.departments} row(s) written, ${filled.roomTypes} room type(s) pointed at Rooms.`,
);
if (filled.missing > 0) {
  fail(
    `${filled.missing} propert(ies) still hold no department, so a guest there has nobody to message.`,
  );
}

// The rentals rebuild (migrations 0073-0080): the seeds above still write the
// residence businesses, buildings and rooms, but no longer their leases, rent,
// deposits or notices (scripts/rentals-rebuilt.mjs). Each residence room gets
// its `rental_units` row here, the unit record the rentals screens read.
const units = await withClient(async (client) =>
  (await rentalsRebuilt(client)) ? await syncRentalUnits(client) : null,
);
if (units !== null) {
  console.log(`Rental units: ${units} written for residence rooms that had none (no leases are seeded).`);
}

// Only a complete run is a reset. The update trigger allows `seeded_at` alone.
const seededAt = await withClient(async (client) => {
  const { rows } = await client.query(
    'update database_identity set seeded_at = now() returning seeded_at',
  );
  return rows[0]?.seeded_at;
});

console.log(`\nSample data seeded; seeded_at is ${seededAt?.toISOString?.() ?? seededAt}.`);
