#!/usr/bin/env node
/**
 * The ui2 seed recipe (ADR-069 D-h, the ui2-roles plan I4): what the six role
 * homes show, merged into Amahoro Hospitality Group's rows.
 *
 *   DATABASE_URL=... node scripts/seed-ui2.mjs
 *
 * `seed-sample.mjs` runs it as its LAST step, after every other seed has
 * written the demo roster and the hotel's day, so each file here can read the
 * rows it builds on. It runs every `seed-ui2/NN-<part>.mjs` in name order:
 *
 *   00-personas.mjs   Grace Uwera (finance) and Diane Ingabire (hr) join
 *                     Amahoro, with their staff files
 *   10-owner*         the owner's dashboard        (leaf 1.4.1)
 *   20-desk*          the operations dashboard     (leaf 1.4.2)
 *   30-finance*       the accountant's Finance     (leaf 1.4.3)
 *   40-people*        the HR officer's People      (leaf 1.4.4)
 *   50-housekeeper*   the housekeeper's phone      (leaf 1.4.5)
 *
 * WHAT A FILE HERE MUST DO, so the recipe stays safe to run again:
 *
 *  - Be a standalone script, run as a child process exactly as `seed-sample.mjs`
 *    runs its steps: it connects to DATABASE_URL itself, calls
 *    `assertSampleDatabase` (`../sample-database.mjs`) as its first act, and
 *    exits non zero on any failure. The recipe stops at the first failing file.
 *  - Be idempotent: a second run writes NOTHING, so no table's row count moves
 *    (the ui2 gate `seed-idem.mjs` runs this recipe again and compares every
 *    table). ON CONFLICT DO NOTHING, or a guarded insert on the natural key.
 *  - Mark every row demo (AGENTS.md § Demo). A row with its own id takes one
 *    in the ui2 block, `de300000-0000-4000-8000-0069FFNNNNNN`: `0069` for
 *    ADR-069, `FF` a two digit family, `NNNNNN` a serial. File `NN-*` owns the
 *    families `NN` to `NN+9`, so files written in parallel never mint the same
 *    id (00-personas: 00-09, 10-owner: 10-19, ... 50-housekeeper: 50-59). A row
 *    whose id the database mints must hang off a `de300000-` org, workspace or
 *    user, and any free text it carries that a stranger could mistake for a
 *    fact says so (`DEMO SAMPLE DATA`, `(demo)`). Users take `de300000-0000-
 *    4000-8000-` ids only when they are personas the sign in picker should
 *    list (`/api/v1/demo/personas` lists every user under that prefix); guests
 *    and other extras take the `de300000-0000-4000-8001-0069…` block.
 *  - Never rename or re-date a row another seed owns: the demo story oracle
 *    (`verify-demo-story.mjs`) reads them.
 *
 * A `.mjs` file here named `_<name>.mjs` is a helper and is never run. Any other
 * `.mjs` name that is not `NN-<part>.mjs` is refused, so a misnamed step cannot
 * silently not run.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

import { assertSampleDatabase, describeDatabase } from './sample-database.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, 'seed-ui2');

/** `00-personas.mjs`, `30-finance-folios.mjs`: two digits, a dash, a kebab name. */
const STEP = /^\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*\.mjs$/;
const HELPER = /^_[a-z0-9-]+\.mjs$/;

function fail(message) {
  console.error(`\nseed-ui2: ${message}`);
  process.exit(1);
}

const url = process.env.DATABASE_URL?.trim();
if (!url) fail('DATABASE_URL is not set.');

// Refuse before a single file runs, the same refusal every seed words.
{
  const client = new pg.Client({ connectionString: url });
  try {
    await client.connect();
    await assertSampleDatabase(client, 'seed-ui2.mjs');
  } catch (error) {
    fail(error?.message ?? String(error));
  } finally {
    await client.end().catch(() => {});
  }
}

if (!existsSync(dir)) fail(`${path.relative(process.cwd(), dir)} does not exist.`);

const files = readdirSync(dir).filter((name) => name.endsWith('.mjs')).sort();
const misnamed = files.filter((name) => !STEP.test(name) && !HELPER.test(name));
if (misnamed.length > 0) {
  fail(
    `refusing ${misnamed.join(', ')}: a step is named NN-<part>.mjs (two digits, a dash, ` +
      'lower case kebab) and a helper _<name>.mjs. A misnamed step would silently not run.',
  );
}
const steps = files.filter((name) => STEP.test(name));
if (steps.length === 0) fail('no NN-<part>.mjs step found; 00-personas.mjs at least belongs here.');

console.log(`Seeding the ui2 homes into ${describeDatabase(url)}: ${steps.length} step(s).`);

for (const [i, name] of steps.entries()) {
  console.log(`\n→ ui2 ${i + 1}/${steps.length} ${name}`);
  const result = spawnSync(process.execPath, [path.join(dir, name)], {
    cwd: path.join(here, '..'),
    env: process.env,
    stdio: 'inherit',
  });
  if (result.error) fail(`${name} could not start: ${result.error.message}`);
  if (result.status !== 0) fail(`${name} failed with exit code ${result.status}; see its output above.`);
}

console.log(`\nseed-ui2: ${steps.length} step(s) done.`);
