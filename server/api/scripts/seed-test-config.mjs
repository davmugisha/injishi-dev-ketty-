#!/usr/bin/env node
/**
 * The clean test database's settings (2026-10-24): the values a business has
 * not decided yet but a flow cannot run without, and NO people, businesses or
 * homes. Those are made through the real flows while testing.
 *
 *   node scripts/seed-test-config.mjs
 *
 * Today: the registration fee for each kind of business (RWF 50,000 for every
 * hospitality business, the owner's fee and the one seed-content.mjs writes;
 * 5,000 for a residence and a broker), without which a landlord, host or
 * broker cannot finish registering. Later phases add theirs here (broker plan
 * prices, for one) when they are settings rather than migrations.
 *
 * Only on a database marked sample (the test stack is), and safe to re-run.
 * Run after migrate.mjs, mark-sample-database.mjs --sample and seed-reference.mjs.
 */
import pg from 'pg';

import { loadApiEnv } from './env-file.mjs';
import { assertSampleDatabase, describeDatabase } from './sample-database.mjs';

const REGISTRATION_FEES = [
  ['hospitality', 50000],
  ['residence', 5000],
  ['broker', 5000],
];

loadApiEnv();
const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error('seed-test-config: DATABASE_URL is not set (and not in the env file).');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await assertSampleDatabase(client, 'seed-test-config.mjs');
  console.log(`Seeding test settings into ${describeDatabase(url)}.`);
  await client.query('BEGIN');
  for (const [businessType, amountRwf] of REGISTRATION_FEES) {
    await client.query(
      `insert into registration_fees (business_type, amount_rwf, effective_from, active)
       select $1::registration_business_type, $2, now(), true
       where not exists (
         select 1 from registration_fees
         where business_type = $1::registration_business_type and active = true
           and amount_rwf = $2 and effective_from <= now()
       )`,
      [businessType, amountRwf],
    );
  }
  await client.query('COMMIT');
  console.log(`  registration fees: ${REGISTRATION_FEES.map(([t, a]) => `${t} ${a}`).join(', ')}`);
  console.log('TEST CONFIG DONE');
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(`seed-test-config: ${error.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
