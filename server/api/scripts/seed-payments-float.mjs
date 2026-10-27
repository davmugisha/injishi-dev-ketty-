#!/usr/bin/env node
/**
 * The mock payment provider's opening float, for a SAMPLE database
 * (073-gtbank-payments AC-15).
 *
 * Refunds are sent only when Hangaa's account can cover them, and the balance
 * is computed from `payment_transactions` (AC-14). A fresh sample database has
 * taken no money, so without a float every refund it owes would wait for funds
 * for ever. This writes the one treasury adjustment a person would otherwise
 * request and a second person approve: a `money_overrides` row (action
 * `treasury_adjustment`, requested by Injishi's finance desk, approved by the
 * super admin, as the two signer rule wants) and the `adjustment` row it
 * produced, for provider `mock` only.
 *
 * THE FIGURE IS INVENTED and every row says so (`DEMO SAMPLE DATA`). A real
 * float is a deposit the bank statement shows, recorded through the money
 * queue by two people. This script refuses any database without the `sample`
 * marker, like every seed, so it can never write one into production.
 *
 * Idempotent: a database that already holds the seeded float is left alone.
 *
 *   DATABASE_URL=... node scripts/seed-payments-float.mjs
 */
import { createHash } from 'node:crypto';

import pg from 'pg';

import { assertSampleDatabase } from './sample-database.mjs';

const FLOAT_RWF = 10_000_000;
const BANK_REFERENCE = 'MOCK-OPENING-FLOAT';
const OVERRIDE_KEY = 'seed:mock-opening-float';
const TRANSACTION_KEY = `treasury:${OVERRIDE_KEY}`;
const NOTE = 'DEMO SAMPLE DATA. Opening float for the mock payment provider, so a sample database can pay refunds.';
const REQUESTER = 'admin-finance@injishi.com';
const APPROVER = 'admin@injishi.com';

/** `referenceFor` in `payments/domain/reference.ts`, the same derivation. */
function referenceFor(key) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bytes = createHash('sha256').update(key, 'utf8').digest();
  let out = '';
  let bits = 0;
  let value = 0;
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += alphabet[(value << (5 - bits)) & 31];
  return `INJ${out.slice(0, 20)}`;
}

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error('seed-payments-float: DATABASE_URL is not set.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await assertSampleDatabase(client, 'seed-payments-float.mjs');

  const existing = await client.query(
    `SELECT id FROM payment_transactions WHERE provider = 'mock' AND provider_reference = $1`,
    [BANK_REFERENCE],
  );
  if (existing.rowCount > 0) {
    console.log('seed-payments-float: the mock opening float is already there; nothing to do.');
    process.exit(0);
  }

  const people = await client.query(`SELECT id, email FROM users WHERE email = ANY($1)`, [[REQUESTER, APPROVER]]);
  const idOf = (email) => people.rows.find((r) => r.email === email)?.id;
  const requester = idOf(REQUESTER);
  const approver = idOf(APPROVER);
  if (!requester || !approver) {
    throw new Error(`the float needs ${REQUESTER} and ${APPROVER}; run seed-users.mjs first`);
  }

  await client.query('BEGIN');
  const override = await client.query(
    `INSERT INTO money_overrides
       (subject_type, action, reason, initiated_by_user_id, approved_by_user_id, state, idempotency_key, details)
     VALUES ('payment_transaction', 'treasury_adjustment', $1, $2, $3, 'applied', $4, $5)
     RETURNING id`,
    [NOTE, requester, approver, OVERRIDE_KEY, { amountRwf: FLOAT_RWF, bankReference: BANK_REFERENCE, provider: 'mock' }],
  );
  const overrideId = override.rows[0].id;
  const tx = await client.query(
    `INSERT INTO payment_transactions
       (workspace_id, provider, adapter_mode, direction, operation, money_override_id,
        idempotency_key, reference, provider_reference, amount_rwf, status, final_at, failure_reason)
     VALUES (NULL, 'mock', 'mock', 'adjustment', 'adjustment', $1, $2, $3, $4, $5, 'successful', now(), NULL)
     RETURNING id`,
    [overrideId, TRANSACTION_KEY, referenceFor(TRANSACTION_KEY), BANK_REFERENCE, FLOAT_RWF],
  );
  await client.query(`UPDATE money_overrides SET subject_id = $1 WHERE id = $2`, [tx.rows[0].id, overrideId]);
  await client.query('COMMIT');
  console.log(`seed-payments-float: wrote a mock opening float of RWF ${FLOAT_RWF.toLocaleString('en-RW')}.`);
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(`seed-payments-float: ${error?.message ?? error}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
