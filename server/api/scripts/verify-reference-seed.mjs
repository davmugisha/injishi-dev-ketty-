#!/usr/bin/env node
/**
 * Proves the production seed on a database built the way production's is: fresh, migrated, UNMARKED.
 *
 *   node scripts/verify-reference-seed.mjs
 *
 * Creates a throwaway database on the server DATABASE_URL names, migrates it, and checks:
 *   - a sample-only seeder (seed-geography.mjs, run on its own) still REFUSES it, so the guard holds;
 *   - seed-reference.mjs fills geography, RDB classes, amenities, government bodies and one tax rate row;
 *   - it writes no user and no sample marker;
 *   - a second run changes no row count.
 * Drops the database afterwards. Prints "REFERENCE SEED OK" only when every check holds.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
const base = process.env.DATABASE_URL?.trim();
if (!base) {
  console.error('verify-reference-seed: DATABASE_URL is not set.');
  process.exit(1);
}
const name = `injishi_refseed_${process.pid}`;
const target = new URL(base);
target.pathname = `/${name}`;
const adminUrl = new URL(base);
adminUrl.pathname = '/postgres';

function run(script) {
  return spawnSync(process.execPath, [path.join(here, script)], {
    cwd: path.join(here, '..'),
    env: { ...process.env, DATABASE_URL: target.toString() },
    encoding: 'utf8',
  });
}

const COUNTS = {
  provinces: 'SELECT count(*)::int AS n FROM provinces',
  districts: 'SELECT count(*)::int AS n FROM districts',
  sectors: 'SELECT count(*)::int AS n FROM sectors',
  cells: 'SELECT count(*)::int AS n FROM cells',
  villages: 'SELECT count(*)::int AS n FROM villages',
  rdb_classifications: 'SELECT count(*)::int AS n FROM rdb_classifications',
  amenities: 'SELECT count(*)::int AS n FROM amenities',
  government_bodies: 'SELECT count(*)::int AS n FROM government_bodies',
  tax_rates: `SELECT count(*)::int AS n FROM config_entries WHERE config_type = 'tax_rates'`,
  users: 'SELECT count(*)::int AS n FROM users',
  sample_marker: 'SELECT count(*)::int AS n FROM database_identity',
};

async function counts() {
  const c = new pg.Client({ connectionString: target.toString() });
  await c.connect();
  try {
    const out = {};
    for (const [k, sql] of Object.entries(COUNTS)) out[k] = (await c.query(sql)).rows[0].n;
    return out;
  } finally {
    await c.end();
  }
}

const problems = [];
const expect = (ok, message) => {
  if (!ok) problems.push(message);
};

let admin = new pg.Client({ connectionString: adminUrl.toString() });
await admin.connect();
await admin.query(`CREATE DATABASE ${name}`);
await admin.end();
try {
  const migrated = run('migrate.mjs');
  if (migrated.status !== 0) throw new Error(`migrate.mjs failed:\n${migrated.stdout}\n${migrated.stderr}`);

  const guarded = run('seed-geography.mjs');
  expect(guarded.status !== 0, 'seed-geography.mjs ran on an unmarked database: the sample guard is gone');

  const first = run('seed-reference.mjs');
  if (first.status !== 0 || !first.stdout.includes('REFERENCE SEED DONE')) {
    throw new Error(`seed-reference.mjs failed:\n${first.stdout}\n${first.stderr}`);
  }
  const once = await counts();
  const second = run('seed-reference.mjs');
  expect(second.status === 0, `a second seed-reference.mjs run failed: ${second.stderr}`);
  const twice = await counts();

  for (const t of ['provinces', 'districts', 'sectors', 'cells', 'villages']) expect(once[t] > 0, `${t} is empty`);
  expect(
    once.provinces === 5 && once.districts === 30,
    `geography reads ${once.provinces} provinces and ${once.districts} districts; Rwanda has 5 and 30`,
  );
  expect(once.rdb_classifications > 0, 'no RDB classifications');
  expect(once.amenities > 0, 'no amenities');
  expect(once.government_bodies >= 2, 'government bodies missing');
  expect(once.tax_rates === 1, `${once.tax_rates} tax_rates rows, expected exactly 1`);
  expect(once.users === 0, `the reference seed wrote ${once.users} user(s)`);
  expect(once.sample_marker === 0, 'the reference seed marked the database as sample');
  for (const k of Object.keys(once)) expect(once[k] === twice[k], `a second run changed ${k}: ${once[k]} → ${twice[k]}`);
  console.log(JSON.stringify(once));
} catch (error) {
  problems.push(error?.message ?? String(error));
} finally {
  admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  await admin.end();
}
if (problems.length) {
  for (const p of problems) console.error(`PROBLEM ${p}`);
  process.exit(1);
}
console.log('REFERENCE SEED OK');
