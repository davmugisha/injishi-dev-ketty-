#!/usr/bin/env node
/**
 * The interface demo seed: the new interface's fixtures (`packages/data`), written into Postgres as the
 * rows the API serves, so apps/app shows real records instead of hard-coded documents.
 *
 *   node scripts/seed-interface.mjs            seed (idempotent: a re run converges, never duplicates)
 *
 * Refuses any database without the `sample` marker (`assertSampleDatabase`), like every seed: this is
 * sample data and must never reach a database that holds real accounts. `seed-sample.mjs` runs it last.
 * Production gets reference data only, from `seed-reference.mjs`.
 *
 * Reads `seed-interface/fixtures.generated.json` (regenerate with `export-interface-fixtures.mjs`). Ids
 * live under `1e000000-` and dates are shifted onto today in Kigali (see `seed-interface/lib.mjs`).
 * Everything runs in one transaction, so a failure leaves the database as it was.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

import { markHeadOffices } from './head-offices.mjs';
import { seedMissingDepartments } from './property-departments.mjs';
import { assertSampleDatabase, describeDatabase } from './sample-database.mjs';
import { AREAS } from './seed-interface/index.mjs';
import { loadFixtures, TODAY } from './seed-interface/lib.mjs';
import { seedWorld, WORKSPACE } from './seed-interface/world.mjs';

/** The business workspaces of the interface world: convergence never reaches past them. */
const INTERFACE_WORKSPACES = [WORKSPACE.hotel, WORKSPACE.residences];

const here = path.dirname(fileURLToPath(import.meta.url));

function loadDotEnv() {
  const file = path.join(here, '..', '.env');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

loadDotEnv();
const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error('seed-interface: DATABASE_URL is not set.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await assertSampleDatabase(client, 'seed-interface.mjs');
  const { fx, personas } = loadFixtures();
  const log = (line) => console.log(`  ${line}`);
  console.log(`Seeding the interface world into ${describeDatabase(url)} (today in Kigali: ${TODAY}).`);
  await client.query('BEGIN');
  const kept = new Map();
  const ctx = {
    c: client,
    fx,
    personas,
    log,
    /**
     * Declare the rows a module wrote to a table it owns inside the interface world. After every module has
     * run, rows of that table in the interface scope that NO module kept are removed, so a re run converges on
     * the fixture day instead of accumulating what a demo day or a verify flow created. Declare parents before
     * children (bookings before stays): removal runs in reverse order of first declaration.
     * `scope` names the column that places a row in the interface world and its values (default: the
     * interface's business workspaces).
     */
    keep(table, ids, scope = { column: 'workspace_id', values: INTERFACE_WORKSPACES }) {
      const entry = kept.get(table) ?? { ids: new Set(), scope };
      for (const id of ids) entry.ids.add(id);
      kept.set(table, entry);
    },
  };
  await seedWorld(ctx);
  // Departments and the head office before any area: tasks, staff and charges point at departments.
  const departments = await seedMissingDepartments(client);
  const headOffices = await markHeadOffices(client);
  log(`departments: ${departments.departments} written, ${departments.roomTypes} room types pointed at Rooms; head offices marked: ${headOffices}`);
  for (const { area, module } of AREAS) {
    try {
      await module.seed(ctx);
    } catch (error) {
      throw new Error(`${area}: ${error?.message ?? error}`, { cause: error });
    }
  }
  for (const [table, { ids, scope }] of [...kept.entries()].reverse()) {
    if (!/^[a-z_]+$/.test(table) || !/^[a-z_]+$/.test(scope.column)) throw new Error(`bad table or column: ${table}.${scope.column}`);
    const { rowCount } = await client.query(
      `DELETE FROM ${table} WHERE ${scope.column} = ANY($1::uuid[]) AND NOT (id = ANY($2::uuid[]))`,
      [scope.values, [...ids]],
    );
    if (rowCount) log(`converged ${table}: ${rowCount} row(s) made since the last seed removed`);
  }
  await client.query('COMMIT');
  console.log('INTERFACE SEED DONE');
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(`seed-interface: ${error?.message ?? error}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
