#!/usr/bin/env node
/**
 * Refunds owed, end to end, against a RUNNING API, its worker and its database
 * (073-gtbank-payments AC-11, AC-12, AC-12a, AC-13, AC-14, AC-14a).
 *
 * Needs a stack on a SAMPLE database with the payments seam on `mock`: the
 * fixed sign in code, a mock prompt that settles after MOCK_MOMO_APPROVAL_MS, a
 * worker running the disbursement dispatcher (every minute), Mailpit, and the
 * seeded opening float (`seed-payments-float.mjs`). The mock's disbursement
 * script is keyed by the paying number's last four digits: `3333` is refused
 * as a name mismatch, `2222` is short of funds the first time it is sent.
 *
 *   API_BASE=http://127.0.0.1:8100 MAILPIT_URL=http://127.0.0.1:58025 \
 *     node scripts/verify-refunds-owed.mjs
 *
 * WHAT IT WRITES: a handful of bookings on far future nights of the seeded
 * Umurage suite and request rooms, cancelled or declined, and the refunds they
 * owe. Run it only against a local sample database.
 *
 * DATABASE_URL defaults to the one in ../.env. Every check prints PASS or FAIL;
 * the last line is `refunds owed verification passed` only when all hold.
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import pg from 'pg';

const API = process.env.API_BASE || 'http://127.0.0.1:8000';
const MAILPIT = process.env.MAILPIT_URL || 'http://127.0.0.1:8025';
const OTP = process.env.VERIFY_OTP_CODE || '123456';
/** Holds a verified identity with a primary document: refunds name her without asking. */
const VERIFIED = process.env.VERIFY_VERIFIED_EMAIL || 'agnes.uwingabire@guests.demo.injishi.com';
/** Holds no verified identity: her refunds wait for her name and ID. */
const UNVERIFIED = process.env.VERIFY_UNVERIFIED_EMAIL || 'guest@injishi.com';
const STRANGER = process.env.VERIFY_STRANGER_EMAIL || 'broker@injishi.com';
const OPERATOR = process.env.VERIFY_OPERATOR_EMAIL || 'host@injishi.com';
const SUITE = process.env.VERIFY_SUITE_ROOM_TYPE || '0f9a1b00-0000-4000-8000-000000000103';
const REQUEST = process.env.VERIFY_REQUEST_ROOM_TYPE || '0f9a1b00-0000-4000-8000-000000000101';
const OUTCOME_WAIT_MS = Number(process.env.VERIFY_OUTCOME_WAIT_MS || 240_000);

let pass = 0;
const failed = [];
function check(id, label, ok, detail = '') {
  if (ok) pass += 1;
  else failed.push(id);
  console.log(`  ${ok ? 'PASS' : 'FAIL'} [${id}] ${label}${!ok && detail ? `   -> ${detail}` : ''}`);
}
const note = (s) => console.log(`       ${s}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const line = readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .find((l) => l.startsWith('DATABASE_URL='));
  if (!line) throw new Error('DATABASE_URL is not set and ../.env has none');
  return line.slice('DATABASE_URL='.length).trim();
}
const pool = new pg.Pool({ connectionString: databaseUrl(), max: 3 });
const q = async (text, params = []) => (await pool.query(text, params)).rows;
const one = async (text, params = []) => (await q(text, params))[0] ?? null;

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
    console.error(`${email}: sign-in answered ${res.status} (the OTP cap is 5 codes an hour per identity).`);
    process.exit(2);
  }
  const cookie = jar(res);
  await fetch(`${API}/api/v1/me/two-factor/send`, { method: 'POST', headers: { cookie } });
  await fetch(`${API}/api/v1/me/two-factor/verify`, {
    method: 'POST',
    headers: { cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: OTP }),
  });
  const me = await (await fetch(`${API}/api/v1/me/workspaces`, { headers: { cookie } })).json().catch(() => ({}));
  const ws = (me.workspaces ?? []).find((w) => w.kind === 'business');
  const user = await one('SELECT id FROM users WHERE email = $1', [email]);
  return { email, cookie, workspaceId: ws?.workspaceId ?? null, userId: user?.id ?? null };
}

async function call(s, method, path, body) {
  const res = await fetch(`${API}/api/v1${path}`, {
    method,
    headers: {
      cookie: s.cookie,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(s.workspaceId ? { 'x-workspace-id': s.workspaceId } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  return { status: res.status, json, text };
}

const book = (s, roomTypeId, [checkIn, checkOut], msisdn) => {
  const attemptToken = randomUUID();
  return call(s, 'POST', '/bookings', {
    roomTypeId,
    checkIn,
    checkOut,
    guests: 1,
    nonRefundable: false,
    attemptToken,
    instrument: { kind: 'mobile_money', network: 'mtn_momo', msisdn },
  }).then((r) => ({ ...r, attemptToken }));
};
async function settle(s, attempt) {
  const until = Date.now() + 40_000;
  while (Date.now() < until) {
    const res = await call(s, 'GET', `/bookings/attempts/${attempt.attemptToken}`);
    if (res.json?.booking?.id) return res.json.booking;
    if (['failed', 'expired', 'refused', 'refunded', 'declined'].includes(res.json?.state)) return null;
    await sleep(2_000);
  }
  return null;
}

async function mails(address, needle) {
  const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${address}`)}&limit=200`);
  const body = await res.json().catch(() => ({}));
  return (body.messages ?? []).filter((m) => m.Subject.includes(needle));
}
async function mailBody(id) {
  const res = await fetch(`${MAILPIT}/api/v1/message/${id}`);
  return (await res.json().catch(() => ({}))).Text ?? '';
}
/** The mails `mails` finds whose text names `reference`: one booking's, not an earlier run's. */
async function mailsAbout(address, needle, reference) {
  const found = [];
  for (const m of await mails(address, needle)) if ((await mailBody(m.ID)).includes(reference)) found.push(m);
  return found;
}
/**
 * Waits for this booking's mail. Any mail with the subject would do too soon: the inbox keeps earlier
 * runs' mail, and the walk would then supply the payer's details before the worker sent this one, so the
 * worker would rightly skip it as moved on.
 */
async function waitForMail(address, needle, reference, ms = 45_000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const found = await mailsAbout(address, needle, reference);
    if (found.length > 0) return found;
    await sleep(2_000);
  }
  return [];
}

const kigaliToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kigali' }).format(new Date());
const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
async function freeWindows(roomTypeId, count) {
  const today = kigaliToday();
  let offset = 300 + Math.floor(Math.random() * 200);
  const found = [];
  for (let block = 0; block < 4 && found.length < count; block++, offset += 81) {
    const from = addDays(today, offset);
    const to = addDays(today, offset + 80);
    const res = await fetch(`${API}/api/v1/room-types/${roomTypeId}/availability?from=${from}&to=${to}`);
    const nights = (await res.json()).nights ?? [];
    for (let i = 0; i + 1 < nights.length && found.length < count; i += 3) {
      if (nights[i].freeUnits >= 1 && nights[i + 1].freeUnits >= 1) found.push([nights[i].night, addDays(nights[i].night, 2)]);
    }
  }
  if (found.length < count) {
    console.error(`Could not find ${count} free windows for room type ${roomTypeId}.`);
    process.exit(2);
  }
  return found;
}

/** AC-14's balance for the mock provider, computed the way the dispatcher does. */
async function mockBalance() {
  const row = await one(`
    SELECT coalesce(sum(CASE WHEN direction = 'collection' AND status = 'successful' THEN amount_rwf - fee_rwf END), 0)
         - coalesce(sum(CASE WHEN direction = 'disbursement' AND status IN ('sending','pending','successful','unknown')
                             THEN amount_rwf + fee_rwf END), 0)
         + coalesce(sum(CASE WHEN direction = 'adjustment' AND status = 'successful' THEN amount_rwf END), 0) AS b
      FROM payment_transactions WHERE provider = 'mock' AND adapter_mode = 'mock'`);
  return Number(row.b);
}
const refundOf = (bookingId) =>
  one(
    `SELECT d.*, c.payer_msisdn AS collection_msisdn
       FROM payment_transactions d JOIN payment_transactions c ON c.id = d.original_transaction_id
      WHERE d.booking_id = $1 AND d.direction = 'disbursement' ORDER BY d.created_at LIMIT 1`,
    [bookingId],
  );
const moneyOf = (bookingId) =>
  one(
    `SELECT b.status, b.payment_status, b.refund_rwf, e.status AS escrow_status, e.amount_rwf AS captured, e.idempotency_key
       FROM bookings b LEFT JOIN escrows e ON e.booking_id = b.id AND e.source = 'booking' WHERE b.id = $1`,
    [bookingId],
  );

console.log(`Refunds owed against ${API} (${new Date().toISOString()})\n`);

const platform = await (await fetch(`${API}/api/v1/platform`)).json().catch(() => ({}));
if (platform?.integrations?.payments !== 'mock') {
  console.error(`The payments seam must be on mock; /platform says ${JSON.stringify(platform?.integrations)}.`);
  process.exit(2);
}

console.log('0. The account can pay refunds');
const float = await one(`SELECT amount_rwf FROM payment_transactions WHERE provider = 'mock' AND provider_reference = 'MOCK-OPENING-FLOAT' AND status = 'successful'`);
check('float-seeded', 'the seeded opening float is an approved adjustment of the mock provider', !!float);
check('balance-positive', 'the computed balance can cover a refund', (await mockBalance()) > 0);

const [W1, W2, W3, W4, W5] = await freeWindows(SUITE, 5);
const [ASK] = await freeWindows(REQUEST, 1);
note(`suite nights ${W1[0]}, ${W2[0]}, ${W3[0]}, ${W4[0]}, ${W5[0]}; request ${ASK[0]}`);

const verified = await sessionFor(VERIFIED);
const unverified = await sessionFor(UNVERIFIED);
const stranger = await sessionFor(STRANGER);
const operator = await sessionFor(OPERATOR);

console.log('\n1. Bookings to cancel');
const attempts = {
  full: await book(verified, SUITE, W1, '788123456'),
  details: await book(unverified, SUITE, W2, '788123456'),
  refused: await book(verified, SUITE, W3, '788123333'),
  short: await book(verified, SUITE, W4, '788122222'),
  behind: await book(unverified, SUITE, W5, '788123456'),
  ask: await book(verified, REQUEST, ASK, '788123456'),
};
const owner = { full: verified, details: unverified, refused: verified, short: verified, behind: unverified, ask: verified };
const booked = {};
for (const [name, attempt] of Object.entries(attempts)) {
  booked[name] = attempt.status < 300 ? await settle(owner[name], attempt) : null;
  check(`booked-${name}`, `the ${name} booking settles`, !!booked[name]?.id, `${attempt.status} ${attempt.text.slice(0, 160)}`);
}
if (Object.values(booked).some((b) => !b)) {
  console.log(`\nRESULT pass=${pass} fail=${failed.length} failed=[${failed.join(',')}]`);
  process.exit(1);
}

const full = booked.full;
const collection = await one(
  `SELECT c.* FROM payment_transactions c JOIN escrows e ON e.idempotency_key = c.idempotency_key WHERE e.booking_id = $1`,
  [full.id],
);
check(
  'collection-recorded',
  'the capture is a successful collection row holding the paying number',
  collection?.direction === 'collection' && collection?.status === 'successful' && collection?.payer_msisdn === '788123456',
  JSON.stringify(collection && { status: collection.status, msisdn: collection.payer_msisdn }),
);

console.log('\n2. Cancel now, refund owed (AC-13), with the payer verified (AC-12)');
const balanceBefore = await mockBalance();
const cancelled = await call(verified, 'POST', `/bookings/${full.reference}/cancel`);
const gross = full.breakdown?.grossRwf;
check(
  'cancel-answers-pending',
  'the cancel answers at once: refund_pending, the full amount owed',
  cancelled.status < 300 && cancelled.json?.paymentStatus === 'refund_pending' && cancelled.json?.escrowStatus === 'refund_pending' && cancelled.json?.refundRwf === gross,
  `${cancelled.status} ${cancelled.text.slice(0, 200)}`,
);
const fullMoney = await moneyOf(full.id);
check(
  'cancel-db-pending',
  'DB: cancelled, payment and escrow refund_pending, refund_rwf set',
  fullMoney?.status === 'cancelled' && fullMoney?.payment_status === 'refund_pending' && fullMoney?.escrow_status === 'refund_pending' && Number(fullMoney?.refund_rwf) === gross,
  JSON.stringify(fullMoney),
);
const holding = await one(
  `SELECT count(*)::int AS n FROM bookings WHERE room_type_id = $1 AND check_in = $2 AND status IN ('pending_approval','confirmed')`,
  [SUITE, W1[0]],
);
check('cancel-frees-room', 'the room is free again at once', holding.n === 0, JSON.stringify(holding));
const fullRefund = await refundOf(full.id);
check(
  'refund-written-with-cancel',
  'one refund owed, back to the collection that paid, to its own number, with the verified name',
  fullRefund?.operation === 'escrow_release_guest' &&
    fullRefund?.original_transaction_id === collection?.id &&
    fullRefund?.payee_account === '788123456' &&
    Number(fullRefund?.amount_rwf) === gross &&
    !!fullRefund?.payee_full_name &&
    ['queued', 'sending', 'successful'].includes(fullRefund?.status),
  JSON.stringify(fullRefund && { op: fullRefund.operation, status: fullRefund.status, reason: fullRefund.queue_reason }),
);
const accessLog = await one(
  `SELECT count(*)::int AS n FROM record_access_logs WHERE subject_user_id = $1 AND data_class = 'national_id' AND reason LIKE $2`,
  [verified.userId, `%${full.reference}%`],
);
check('id-read-logged', 'reading the payer\'s ID for the refund wrote record_access_logs', accessLog.n >= 1, JSON.stringify(accessLog));
const refusedVerified = await call(verified, 'PUT', `/me/refunds/${fullRefund?.id}/payee`, {
  idType: 'national_id',
  idNumber: '1199880011111111',
  fullName: 'Someone Else',
});
check('payee-refused-when-verified', 'a verified account cannot override its payee (409)', refusedVerified.status === 409, `${refusedVerified.status}`);

console.log('\n3. A payer with no verified identity is asked (AC-12)');
const detailsCancel = await call(unverified, 'POST', `/bookings/${booked.details.reference}/cancel`);
check('details-cancel', 'the cancel answers refund_pending', detailsCancel.json?.paymentStatus === 'refund_pending', detailsCancel.text.slice(0, 160));
const detailsRefund = await refundOf(booked.details.id);
check(
  'details-waits',
  'the refund waits for the payer: queued, payee_details_missing, no name written',
  detailsRefund?.status === 'queued' && detailsRefund?.queue_reason === 'payee_details_missing' && detailsRefund?.payee_full_name === null,
  JSON.stringify(detailsRefund && { status: detailsRefund.status, reason: detailsRefund.queue_reason }),
);
const asked = await waitForMail(UNVERIFIED, 'We need your details to send your refund', booked.details.reference);
check('details-mail', 'the payer is mailed refund_details_needed, linking to /account/refunds', asked.length > 0 && (await mailBody(asked[0].ID)).includes('/account/refunds'), `${asked.length} mails`);
const list = await call(unverified, 'GET', '/me/refunds');
const listed = list.json?.refunds?.find((r) => r.id === detailsRefund?.id);
check(
  'details-listed',
  'GET /me/refunds says needs_details, masks the number, and offers the form',
  list.status === 200 && listed?.status === 'needs_details' && listed?.paidTo === '078••••456' && list.json?.hasVerifiedIdentity === false,
  `${list.status} ${JSON.stringify(listed)}`,
);
check('no-whole-number', 'no refund answer carries the whole paying number', !list.text.includes('788123456'));
const foreign = await call(stranger, 'PUT', `/me/refunds/${detailsRefund?.id}/payee`, {
  idType: 'national_id',
  idNumber: '1199880022222222',
  fullName: 'Not The Payer',
});
check('payee-foreign-404', 'another account cannot supply it (404)', foreign.status === 404, `${foreign.status}`);
const bad = await call(unverified, 'PUT', `/me/refunds/${detailsRefund?.id}/payee`, {
  idType: 'national_id',
  idNumber: '12345',
  fullName: 'Guest Tester',
});
check('payee-bad-id', 'a malformed ID is refused (400) and never echoed', bad.status === 400 && !bad.text.includes('12345'), `${bad.status} ${bad.text.slice(0, 160)}`);
const supplied = await call(unverified, 'PUT', `/me/refunds/${detailsRefund?.id}/payee`, {
  idType: 'national_id',
  idNumber: '1199880033333333',
  fullName: 'Guest Tester',
});
check(
  'payee-supplied',
  'the payer supplies name and ID; the refund is processing and the number is not echoed',
  supplied.status === 200 && supplied.json?.status === 'processing' && !supplied.text.includes('1199880033333333'),
  `${supplied.status} ${supplied.text.slice(0, 160)}`,
);
const twice = await call(unverified, 'PUT', `/me/refunds/${detailsRefund?.id}/payee`, {
  idType: 'national_id',
  idNumber: '1199880033333333',
  fullName: 'Guest Tester',
});
check('payee-twice-409', 'supplying again is refused: it no longer waits (409)', twice.status === 409, `${twice.status}`);

console.log('\n4. Refused, short, and a host decline');
await call(verified, 'POST', `/bookings/${booked.refused.reference}/cancel`);
await call(verified, 'POST', `/bookings/${booked.short.reference}/cancel`);
await call(unverified, 'POST', `/bookings/${booked.behind.reference}/cancel`);
// Its payer has no verified identity, so it would wait for them; supplied at
// once, it queues right behind the short one.
const behindRefund = await refundOf(booked.behind.id);
await call(unverified, 'PUT', `/me/refunds/${behindRefund?.id}/payee`, {
  idType: 'passport',
  idNumber: 'PC1234567',
  fullName: 'Guest Tester',
});
const declined = await call(operator, 'POST', `/bookings/${booked.ask.id}/decline`, {});
check(
  'decline-pending',
  'a host decline answers at once: declined, refund_pending',
  declined.status < 300 && declined.json?.status === 'declined' && declined.json?.paymentStatus === 'refund_pending',
  `${declined.status} ${declined.text.slice(0, 200)}`,
);

console.log(`\n5. The dispatcher pays them (waiting up to ${OUTCOME_WAIT_MS / 1000}s for the worker)`);
const settledIds = ['full', 'details', 'short', 'behind', 'ask'].map((k) => booked[k].id);
const until = Date.now() + OUTCOME_WAIT_MS;
let rows = [];
while (Date.now() < until) {
  rows = await q(
    `SELECT booking_id, status, provider_status, attempts, final_at, queue_reason FROM payment_transactions
      WHERE direction = 'disbursement' AND booking_id = ANY($1)`,
    [[...settledIds, booked.refused.id]],
  );
  const done = rows.filter((r) => r.status === 'successful' || r.status === 'failed').length;
  if (done >= settledIds.length + 1) break;
  await sleep(5_000);
}
const byBooking = Object.fromEntries(rows.map((r) => [r.booking_id, r]));
for (const name of ['full', 'details', 'ask']) {
  const money = await moneyOf(booked[name].id);
  check(
    `paid-${name}`,
    `the ${name} refund is paid and the booking reads refunded_full`,
    byBooking[booked[name].id]?.status === 'successful' && money?.payment_status === 'refunded_full' && money?.escrow_status === 'refunded_full',
    `${byBooking[booked[name].id]?.status} ${JSON.stringify(money)}`,
  );
}
const balanceAfter = await mockBalance();
check(
  'balance-spent',
  'the balance fell by at least the paid refund (AC-14: computed from the rows)',
  balanceAfter <= balanceBefore - gross,
  `${balanceBefore} -> ${balanceAfter}`,
);
const shortRow = byBooking[booked.short.id];
const behindRow = byBooking[booked.behind.id];
check(
  'short-then-paid',
  'the 2222 refund was refused for funds, queued, and paid on a later send',
  shortRow?.status === 'successful' && Number(shortRow?.attempts) >= 2,
  JSON.stringify(shortRow),
);
check(
  'no-overtaking',
  'the younger refund behind it was not paid before it (AC-14a)',
  behindRow?.status === 'successful' && new Date(behindRow.final_at) >= new Date(shortRow?.final_at ?? 0),
  `${shortRow?.final_at} vs ${behindRow?.final_at}`,
);
const refusedRow = byBooking[booked.refused.id];
const refusedMoney = await moneyOf(booked.refused.id);
check(
  'refused-owed',
  'a refusal fails the refund, remembers the name mismatch, and the booking still owes it',
  refusedRow?.status === 'failed' && refusedRow?.provider_status === 'name_mismatch' && refusedMoney?.payment_status === 'refund_pending',
  `${JSON.stringify(refusedRow)} ${refusedMoney?.payment_status}`,
);
const delayedMail = await waitForMail(VERIFIED, 'Your refund is delayed', booked.refused.reference);
check('delayed-mail', 'the payer is mailed that the refund is delayed', delayedMail.length > 0);
const agnesList = await call(verified, 'GET', '/me/refunds');
const words = Object.fromEntries((agnesList.json?.refunds ?? []).map((r) => [r.bookingReference, r.status]));
check(
  'plain-words',
  'GET /me/refunds reads paid and delayed in plain words',
  words[full.reference] === 'paid' && words[booked.refused.reference] === 'delayed',
  JSON.stringify(words),
);
const forThisBooking = await mailsAbout(UNVERIFIED, 'We need your details to send your refund', booked.details.reference);
check('asked-once', 'the payer was asked for their details exactly once (AC-6a)', forThisBooking.length === 1, `${forThisBooking.length}`);

console.log('\n6. Never more than was paid (AC-11)');
const require = createRequire(import.meta.url);
try {
  const { drizzle } = require('drizzle-orm/node-postgres');
  const schema = require('../dist/database/drizzle/schema.js');
  const repoModule = require('../dist/modules/pay/infrastructure/payment-transactions.repository.js');
  const repo = new repoModule.PaymentTransactionsRepository(drizzle(pool, { schema }));
  const probe = {
    collectionId: collection.id,
    idempotencyKey: `verify-room-probe:${randomUUID()}`,
    reference: `INJPROBE${Date.now()}`,
    workspaceId: collection.workspace_id,
    provider: 'mock',
    adapterMode: 'mock',
    operation: 'refund',
    amountRwf: 1,
    feeRwf: 0,
    bookingId: full.id,
    status: 'queued',
    queueReason: 'awaiting_dispatch',
    failureReason: null,
    payee: {
      payeeFullName: 'Probe',
      payeeIdType: 'national_id',
      payeeIdNumber: '1199880044444444',
      payeeDestination: 'momo',
      payeeNetworkOrBank: 'mtn_momo',
      payeeAccount: '788123456',
      payeePhone: '+250788123456',
    },
  };
  const exact = await repo.recordRefundOwed({ ...probe, fit: 'exact' }).then(
    () => 'written',
    (e) => e?.name,
  );
  check('room-exact-refused', 'a refund beyond what remains of a fully refunded payment is refused', exact === 'RefundExceedsCollectionError', exact);
  const capped = await repo.recordRefundOwed({ ...probe, fit: 'cap' });
  check('room-cap-writes-nothing', 'shrunk to what remains, it writes nothing', capped.row === null && capped.amountRwf === 0, JSON.stringify(capped));
} catch (error) {
  check('room-probe', 'the room probe ran against the built repository', false, error?.message ?? String(error));
}

await pool.end();
console.log(`\nRESULT pass=${pass} fail=${failed.length} failed=[${failed.join(',')}]`);
if (failed.length > 0) process.exit(1);
console.log('refunds owed verification passed');
