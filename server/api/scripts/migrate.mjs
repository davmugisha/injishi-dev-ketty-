#!/usr/bin/env node
/**
 * Apply pending Drizzle migrations, then exit.
 *
 * Deliberately built on `drizzle-orm/node-postgres/migrator` and NOT on
 * `drizzle-kit migrate`. drizzle-kit is a devDependency: it is not in the
 * runtime image, so a release step that shells out to it works on a laptop and
 * fails on the platform. The migrator lives in drizzle-orm, which is a runtime
 * dependency, so this script runs anywhere the server itself runs.
 *
 * Drizzle records applied migrations in `drizzle.__drizzle_migrations`, so this
 * is idempotent: running it on every deploy is the intended use, and a deploy
 * with nothing pending is a no-op.
 *
 *   node scripts/migrate.mjs
 *
 * DATABASE_URL selects the database, the only one this stack has (ADR-043;
 * see migration-targets.mjs). MIGRATIONS_DIR overrides where the SQL lives,
 * which is what the container image sets — `nest build` compiles .ts and leaves
 * .sql behind, so the folder is copied to its own path rather than being dug out
 * of a source tree that is not in the image.
 *
 * A failure stops the release step, so the new API never takes traffic on a
 * schema it was not built for.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

import { migrationTargets } from './migration-targets.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder =
  process.env.MIGRATIONS_DIR ??
  path.join(here, '..', 'src', 'database', 'drizzle', 'migrations');

let targets;
try {
  targets = migrationTargets(process.env);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

if (!existsSync(migrationsFolder)) {
  // Failing here beats connecting, finding zero files, and reporting success on
  // a database that got none of the schema.
  console.error(`No migrations directory at ${migrationsFolder}.`);
  console.error('Set MIGRATIONS_DIR if the SQL lives somewhere else.');
  process.exit(1);
}

console.log(`Applying migrations from ${migrationsFolder}`);
for (const { label, url } of targets) {
  const pool = new pg.Pool({ connectionString: url, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder });
    console.log(`Migrations up to date (${label}).`);
  } catch (error) {
    console.error(`Migration failed (${label}):`, error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
  if (process.exitCode) break;
}
