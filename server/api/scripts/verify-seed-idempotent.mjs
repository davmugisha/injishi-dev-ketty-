#!/usr/bin/env node
/**
 * Seeding the interface world twice must leave every table exactly as the first run left it.
 *
 *   node scripts/verify-seed-idempotent.mjs
 *
 * Runs seed-interface.mjs once (to converge whatever a demo day or a flow left behind), counts the rows of
 * every public table, runs it again, counts again, and requires the two counts to be equal table by table.
 * Prints "SEED IDEMPOTENT <n> tables" only when they are.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error('verify-seed-idempotent: DATABASE_URL is not set.');
  process.exit(1);
}

function seed() {
  const r = spawnSync(process.execPath, [path.join(here, 'seed-interface.mjs')], {
    cwd: path.join(here, '..'),
    env: process.env,
    encoding: 'utf8',
  });
  if (r.status !== 0 || !r.stdout.includes('INTERFACE SEED DONE')) {
    console.error(r.stdout, r.stderr);
    console.error('verify-seed-idempotent: seed-interface.mjs failed');
    process.exit(1);
  }
}

async function counts(c) {
  const { rows: tables } = await c.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY 1`,
  );
  const out = {};
  for (const { table_name: t } of tables) {
    out[t] = (await c.query(`SELECT count(*)::int AS n FROM "${t}"`)).rows[0].n;
  }
  return out;
}

const c = new pg.Client({ connectionString: url });
await c.connect();
try {
  seed();
  const first = await counts(c);
  seed();
  const second = await counts(c);
  const changed = Object.keys(second).filter((t) => first[t] !== second[t]);
  if (changed.length) {
    for (const t of changed) console.error(`PROBLEM a second seed changed ${t}: ${first[t]} → ${second[t]}`);
    process.exitCode = 1;
  } else {
    console.log(`SEED IDEMPOTENT ${Object.keys(second).length} tables`);
  }
} finally {
  await c.end().catch(() => {});
}
