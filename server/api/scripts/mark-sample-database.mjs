#!/usr/bin/env node
/**
 * Mark the database DATABASE_URL names as a SAMPLE database (ADR-043).
 *
 *   node scripts/mark-sample-database.mjs --sample
 *
 * This is the only thing that writes the `database_identity` row. No seed, no
 * migration and no API code path marks a database, so a database becomes
 * sample exactly when somebody ran this, on purpose, against it.
 *
 * Postgres refuses the row while `users` holds any row (the trigger in
 * migration 0030), so only an EMPTY database can be marked. Run it after
 * `migrate.mjs` and before any seed:
 *
 *   node scripts/migrate.mjs
 *   node scripts/mark-sample-database.mjs --sample
 *   node scripts/seed-sample.mjs
 *
 * Idempotent: against a database that is already sample it changes nothing and
 * exits 0. Against one holding users it prints the database's refusal as a
 * plain message and exits 1.
 *
 * `--sample` is required and is the only flag. There is no way to mark a
 * database real: real is the absence of the row, and deleting the row by hand
 * is the one direction the database allows freely, because it is the safe one.
 *
 * `marked_by` records `mark-sample-database@<INJISHI_COMMIT>`, the commit the
 * image was built from, or `@local` when unset.
 */
import pg from 'pg';

import { describeDatabase } from './sample-database.mjs';

/** Postgres `undefined_table`: the database predates migration 0030. */
const UNDEFINED_TABLE = '42P01';

function fail(message) {
  console.error(`mark-sample-database: ${message}`);
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length !== 1 || args[0] !== '--sample') {
  console.error(
    'Usage: node scripts/mark-sample-database.mjs --sample\n\n' +
      'Marks the EMPTY database DATABASE_URL names as a sample database, the\n' +
      'only kind a demo API process boots on and the only kind a seed writes to.',
  );
  process.exit(2);
}

const url = process.env.DATABASE_URL?.trim();
if (!url) fail('DATABASE_URL is not set.');

const where = describeDatabase(url);
const markedBy = `mark-sample-database@${process.env.INJISHI_COMMIT?.trim() || 'local'}`;

const client = new pg.Client({ connectionString: url });
try {
  await client.connect();

  const { rows: existing } = await client.query(
    'select marked_at, marked_by from database_identity limit 1',
  );
  if (existing[0]) {
    console.log(
      `${where} is already a sample database (marked ${existing[0].marked_at.toISOString()} ` +
        `by ${existing[0].marked_by}). Nothing to do.`,
    );
  } else {
    // ON CONFLICT covers a second run racing this one: the row it wrote is the
    // same fact, so losing the race is success, not an error.
    const { rowCount } = await client.query(
      "insert into database_identity (kind, marked_by) values ('sample', $1) on conflict (id) do nothing",
      [markedBy],
    );
    console.log(
      rowCount === 1
        ? `Marked ${where} as a sample database (${markedBy}).`
        : `${where} was marked by another run just now. Nothing to do.`,
    );
  }
} catch (error) {
  // A plain message, never a stack: the trigger's refusal IS the explanation.
  console.error(
    `mark-sample-database: ${
      error?.code === UNDEFINED_TABLE
        ? `${where} has no database_identity table. Run node scripts/migrate.mjs first.`
        : `${where}: ${error?.message ?? error}`
    }`,
  );
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
