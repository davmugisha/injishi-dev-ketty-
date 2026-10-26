#!/usr/bin/env node
/**
 * The production seed: platform reference data, and nothing else.
 *
 *   node scripts/seed-reference.mjs
 *
 * A fresh production database gets only what migrations insert (the ledger accounts and the outlet
 * arrangement config), while every other reference seeder refuses a database without the sample marker.
 * So without this, a real database has no geography (an org's district is a foreign key), no RDB
 * classes (an org's class is a foreign key), no amenity catalogue, no government bodies for oversight
 * assignments, and no tax rate (a folio charge refuses to post without one).
 *
 * Safe on any database, marked or not: it upserts reference tables only, never a user, a business, a
 * booking or the sample marker, and running it again changes nothing. Values a business decision still
 * owes (fees, plans, PSF tiers, HR rates) are not here; `reference-data.mjs` says which and why.
 * Needs the schema first (`node scripts/migrate.mjs`).
 */
import pg from 'pg';

import {
  ensureTaxRates,
  upsertAmenities,
  upsertGovernmentBodies,
  upsertRdbClassifications,
} from './reference-data.mjs';
import { describeDatabase } from './sample-database.mjs';
import { seedGeography } from './seed-geography.mjs';

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error('seed-reference: DATABASE_URL is not set.');
  process.exit(1);
}

const NEEDED = ['provinces', 'villages', 'rdb_classifications', 'amenities', 'government_bodies', 'config_entries'];

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const { rows } = await client.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
    [NEEDED],
  );
  const missing = NEEDED.filter((t) => !rows.some((r) => r.table_name === t));
  if (missing.length) throw new Error(`the schema is missing ${missing.join(', ')}: run scripts/migrate.mjs first`);

  console.log(`Seeding platform reference data into ${describeDatabase(url)}.`);
  await client.query('BEGIN');
  await seedGeography(client, (line) => console.log(`  ${line}`));
  const rdb = await upsertRdbClassifications(client);
  const amenities = await upsertAmenities(client);
  const bodies = await upsertGovernmentBodies(client);
  const taxRows = await ensureTaxRates(client);
  await client.query('COMMIT');
  console.log(
    `  rdb_classifications ${rdb} · amenities ${amenities} · government_bodies ${bodies} · tax_rates ${taxRows ? 'written' : 'already set'}`,
  );
  console.log('REFERENCE SEED DONE');
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(`seed-reference: ${error?.message ?? error}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
