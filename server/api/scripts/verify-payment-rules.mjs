#!/usr/bin/env node
/**
 * The bank's rules, refused before any hold, attempt or prompt
 * (073-gtbank-payments AC-14a, AC-23, AC-24).
 *
 * Needs an API on a SAMPLE database, mock payments, started with the rules this
 * script checks against: `GTBANK_RTP_NETWORKS=mtn_momo` and
 * `GTBANK_MAX_COLLECTION_RWF=1000`, so an Airtel number is refused for its
 * network and any MTN booking for the limit. It reads `/platform` first and
 * stops if the API was started otherwise.
 *
 *   API_BASE=http://127.0.0.1:8102 node scripts/verify-payment-rules.mjs
 *
 * WHAT IT WRITES: nothing it means to keep. Every refusal it checks writes no
 * row; the disbursement limit is proven on one probe row of a provider no
 * process dispatches, deleted again at the end.
 *
 * DATABASE_URL defaults to the one in ../.env. Prints `payment rules
 * verification passed` only when every check holds.
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import pg from 'pg';

const API = process.env.API_BASE || 'http://127.0.0.1:8000';
const OTP = process.env.VERIFY_OTP_CODE || '123456';
const GUEST = process.env.VERIFY_GUEST_EMAIL || 'guest@injishi.com';
const SUITE = process.env.VERIFY_SUITE_ROOM_TYPE || '0f9a1b00-0000-4000-8000-000000000103';

let pass = 0;
const failed = [];
function check(id, label, ok, detail = '') {
  if (ok) pass += 1;
  else failed.push(id);
  console.log(`  ${ok ? 'PASS' : 'FAIL'} [${id}] ${label}${!ok && detail ? `   -> ${detail}` : ''}`);
}

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const line = readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .find((l) => l.startsWith('DATABASE_URL='));
  if (!line) throw new Error('DATABASE_URL is not set and ../.env has none');
  return line.slice('DATABASE_URL='.length).trim();
}
const pool = new pg.Pool({ connectionString: databaseUrl(), max: 2 });
const one = async (text, params = []) => (await pool.query(text, params)).rows[0] ?? null;
const counts = async () =>
  one(`SELECT (SELECT count(*)::int FROM payment_attempts) AS attempts,
              (SELECT count(*)::int FROM payment_transactions) AS transactions`);

const jar = (res) => (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
async function sessionFor(email) {
  await fetch(`${API}/api/auth/email-otp/send-verification-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, type: 'sign-in' }),
  });
  const res = await fetch(`${API}/api/auth/sign-in/email-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp: OTP }),
  });
  if (!res.ok) {
    console.error(`${email}: sign-in answered ${res.status}.`);
    process.exit(2);
  }
  return { cookie: jar(res) };
}
async function book(s, instrument) {
  const kigali = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kigali' }).format(new Date());
  const checkIn = new Date(Date.parse(`${kigali}T00:00:00Z`) + 200 * 86_400_000).toISOString().slice(0, 10);
  const checkOut = new Date(Date.parse(`${checkIn}T00:00:00Z`) + 2 * 86_400_000).toISOString().slice(0, 10);
  const res = await fetch(`${API}/api/v1/bookings`, {
    method: 'POST',
    headers: { cookie: s.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomTypeId: SUITE, checkIn, checkOut, guests: 1, nonRefundable: false, attemptToken: randomUUID(), instrument }),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  return { status: res.status, message: json?.message ?? text };
}

console.log(`Payment rules against ${API} (${new Date().toISOString()})\n`);
const platform = await (await fetch(`${API}/api/v1/platform`)).json().catch(() => null);
const rules = platform?.paymentRules;
if (platform?.integrations?.payments !== 'mock' || rules?.maxCollectionRwf !== 1000 || rules?.networks?.join(',') !== 'mtn_momo') {
  console.error(
    'Start the API with GTBANK_RTP_NETWORKS=mtn_momo and GTBANK_MAX_COLLECTION_RWF=1000 on mock payments; ' +
      `/platform says ${JSON.stringify({ integrations: platform?.integrations, rules })}.`,
  );
  process.exit(2);
}

console.log('1. What a client is told before paying');
check('platform-card-off', '/platform says card payments are off', platform.integrations.card_payments === 'off');
check('platform-rules', '/platform publishes the networks and the collection limit', rules.networks.length === 1 && rules.maxCollectionRwf === 1000);

console.log('\n2. Refused before any hold, attempt or prompt');
const guest = await sessionFor(GUEST);
const before = await counts();
const airtel = await book(guest, { kind: 'mobile_money', network: 'airtel_money', msisdn: '738123456' });
check('network-refused', 'an Airtel number is refused with a sentence naming the network (422)', airtel.status === 422 && /Airtel Money payments are not taken yet\. Pay with MTN MoMo\./.test(airtel.message), `${airtel.status} ${airtel.message}`);
const card = await book(guest, { kind: 'card', token: 'tok_test' });
check('card-refused', 'a card is refused while card payments are off (422)', card.status === 422 && /Card payments are not taken yet/.test(card.message), `${card.status} ${card.message}`);
const over = await book(guest, { kind: 'mobile_money', network: 'mtn_momo', msisdn: '788123456' });
check('limit-refused', 'a booking above the collection limit is refused with a sentence naming the limit (422)', over.status === 422 && /at most RWF 1,000/.test(over.message), `${over.status} ${over.message}`);
const after = await counts();
check('nothing-written', 'no attempt and no bank record row was written for any of them', after.attempts === before.attempts && after.transactions === before.transactions, `${JSON.stringify(before)} -> ${JSON.stringify(after)}`);

console.log('\n3. A disbursement above its limit is set aside for a person (AC-14a)');
const require = createRequire(import.meta.url);
const probeKey = `verify-limit-probe:${randomUUID()}`;
try {
  const { drizzle } = require('drizzle-orm/node-postgres');
  const schema = require('../dist/database/drizzle/schema.js');
  const { PaymentTransactionsRepository } = require('../dist/modules/pay/infrastructure/payment-transactions.repository.js');
  const repo = new PaymentTransactionsRepository(drizzle(pool, { schema }));
  const workspace = await one('SELECT id FROM workspaces LIMIT 1');
  // A provider no process dispatches, so nothing races this probe.
  await pool.query(
    `INSERT INTO payment_transactions (workspace_id, provider, adapter_mode, direction, operation, idempotency_key, reference,
       amount_rwf, status, queue_reason, payee_full_name, payee_id_type, payee_id_number, payee_destination,
       payee_network_or_bank, payee_account, payee_phone)
     VALUES ($1, 'verify-probe', 'mock', 'disbursement', 'refund', $2, $3, 5000, 'queued', 'awaiting_dispatch',
       'Probe Payee', 'national_id', '1199880055555555', 'momo', 'mtn_momo', '788123456', '+250788123456')`,
    [workspace.id, probeKey, `INJPROBE${Date.now()}`],
  );
  const claim = await repo.claimForDispatch({
    provider: 'verify-probe',
    adapterMode: 'mock',
    lagMinutes: 0,
    maxDisbursementRwf: 1000,
    now: new Date(),
  });
  const probe = await one('SELECT status::text AS status, queue_reason FROM payment_transactions WHERE idempotency_key = $1', [probeKey]);
  check(
    'over-limit',
    'a disbursement above the limit stays queued as over_limit and is not sent',
    claim.overLimit.length === 1 && claim.sending.length === 0 && probe?.status === 'queued' && probe?.queue_reason === 'over_limit',
    JSON.stringify({ probe, overLimit: claim.overLimit.length, sending: claim.sending.length }),
  );
} catch (error) {
  check('over-limit', 'the disbursement limit probe ran against the built repository', false, error?.message ?? String(error));
} finally {
  await pool.query('DELETE FROM payment_transactions WHERE idempotency_key = $1', [probeKey]);
}

await pool.end();
console.log(`\nRESULT pass=${pass} fail=${failed.length} failed=[${failed.join(',')}]`);
if (failed.length > 0) process.exit(1);
console.log('payment rules verification passed');
