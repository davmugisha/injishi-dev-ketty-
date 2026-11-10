#!/usr/bin/env node
/**
 * The money queue, end to end, against a RUNNING API, its worker and its
 * database (073-gtbank-payments AC-15, AC-18 to AC-21, AC-27).
 *
 * Needs a stack on a SAMPLE database with the payments seam on `mock`, the
 * fixed sign in code and step-up, a worker running the disbursement
 * dispatcher, Mailpit, and the seeded opening float. The mock's script, by the
 * paying number's last four digits: `3333` a refund refused as a name
 * mismatch, `8888` a payment with no answer, `7777` a payment (and its refund)
 * the bank reverses two minutes after it settles.
 *
 *   API_BASE=http://127.0.0.1:8100 MAILPIT_URL=http://127.0.0.1:58025 \
 *     node scripts/verify-money-queue.mjs
 *
 * WHAT IT WRITES: bookings on far future nights of the seeded Umurage suite,
 * cancelled, refused or reversed, treasury adjustments of the mock provider,
 * and the overrides that decided them. Run it only against a local sample
 * database. It waits about four minutes for the mock bank's reversals.
 *
 * Every check prints PASS or FAIL; the last line is
 * `money queue verification passed` only when every check holds.
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import pg from 'pg';

const API = process.env.API_BASE || 'http://127.0.0.1:8000';
const MAILPIT = process.env.MAILPIT_URL || 'http://127.0.0.1:8025';
const OTP = process.env.VERIFY_OTP_CODE || '123456';
const FINANCE = process.env.VERIFY_FINANCE_EMAIL || 'admin-finance@injishi.com';
const SUPER = process.env.VERIFY_SUPER_EMAIL || 'admin@injishi.com';
const OPS = process.env.VERIFY_OPS_EMAIL || 'admin-ops@injishi.com';
/** Two payers with verified identities, so their refunds go out without asking. */
const PAYER_A = process.env.VERIFY_PAYER_A_EMAIL || 'emmanuel.twagirayezu@guests.demo.injishi.com';
const PAYER_B = process.env.VERIFY_PAYER_B_EMAIL || 'fabrice.ishimwe@guests.demo.injishi.com';
const HOST_MAILBOXES = (process.env.VERIFY_HOST_MAILBOXES || 'host@injishi.com,manager@injishi.com').split(',');
const SUITE = process.env.VERIFY_SUITE_ROOM_TYPE || '0f9a1b00-0000-4000-8000-000000000103';
const REVERSAL_WAIT_MS = Number(process.env.VERIFY_REVERSAL_WAIT_MS || 150_000);

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
    console.error(`${email}: sign-in answered ${res.status} (the OTP cap is 10 codes an hour per identity).`);
    process.exit(2);
  }
  const cookie = jar(res);
  // The staff console's emailed step-up; harmless for a guest.
  await fetch(`${API}/api/v1/me/two-factor/send`, { method: 'POST', headers: { cookie } });
  await fetch(`${API}/api/v1/me/two-factor/verify`, {
    method: 'POST',
    headers: { cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: OTP }),
  });
  const user = await one('SELECT id FROM users WHERE email = $1', [email]);
  return { email, cookie, userId: user?.id ?? null };
}

async function call(s, method, path, body, headers = {}) {
  const res = await fetch(`${API}/api/v1${path}`, {
    method,
    headers: {
      ...(s ? { cookie: s.cookie } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
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

const book = (s, [checkIn, checkOut], msisdn) => {
  const attemptToken = randomUUID();
  return call(s, 'POST', '/bookings', {
    roomTypeId: SUITE,
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

const kigaliToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kigali' }).format(new Date());
const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
async function freeWindows(count) {
  const today = kigaliToday();
  let offset = 150 + Math.floor(Math.random() * 250);
  const found = [];
  for (let block = 0; block < 5 && found.length < count; block++, offset += 81) {
    const res = await fetch(`${API}/api/v1/room-types/${SUITE}/availability?from=${addDays(today, offset)}&to=${addDays(today, offset + 80)}`);
    const nights = (await res.json()).nights ?? [];
    for (let i = 0; i + 1 < nights.length && found.length < count; i += 3) {
      if (nights[i].freeUnits >= 1 && nights[i + 1].freeUnits >= 1) found.push([nights[i].night, addDays(nights[i].night, 2)]);
    }
  }
  if (found.length < count) {
    console.error(`Could not find ${count} free windows.`);
    process.exit(2);
  }
  return found;
}
async function mockBalance() {
  const row = await one(`
    SELECT coalesce(sum(CASE WHEN direction = 'collection' AND status = 'successful' THEN amount_rwf - fee_rwf END), 0)
         - coalesce(sum(CASE WHEN direction = 'disbursement' AND status IN ('sending','pending','successful','unknown')
                             THEN amount_rwf + fee_rwf END), 0)
         + coalesce(sum(CASE WHEN direction = 'adjustment' AND status = 'successful' THEN amount_rwf END), 0) AS b
      FROM payment_transactions WHERE provider = 'mock' AND adapter_mode = 'mock'`);
  return Number(row.b);
}
const collectionOf = (bookingId) =>
  one(
    `SELECT c.* FROM payment_transactions c JOIN escrows e ON e.idempotency_key = c.idempotency_key WHERE e.booking_id = $1`,
    [bookingId],
  );
const refundOf = (bookingId) =>
  one(
    `SELECT * FROM payment_transactions WHERE booking_id = $1 AND direction = 'disbursement' AND idempotency_key NOT LIKE 'resend:%'
      ORDER BY created_at LIMIT 1`,
    [bookingId],
  );
const auditCount = (subjectId, eventPrefix) =>
  one(`SELECT count(*)::int AS n FROM audit_events WHERE subject_type = 'payment' AND subject_id = $1 AND event_type LIKE $2`, [
    subjectId,
    `${eventPrefix}%`,
  ]).then((r) => r.n);
async function waitFor(predicate, ms, every = 5_000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const value = await predicate();
    if (value) return value;
    await sleep(every);
  }
  return null;
}
const inQueue = async (s, id) => (await call(s, 'GET', '/admin/finance/payments')).json?.rows?.find((r) => r.id === id) ?? null;

console.log(`Money queue against ${API} (${new Date().toISOString()})\n`);
const platform = await (await fetch(`${API}/api/v1/platform`)).json().catch(() => ({}));
if (platform?.integrations?.payments !== 'mock') {
  console.error(`The payments seam must be on mock; /platform says ${JSON.stringify(platform?.integrations)}.`);
  process.exit(2);
}

const finance = await sessionFor(FINANCE);
const superAdmin = await sessionFor(SUPER);
const ops = await sessionFor(OPS);
const payerA = await sessionFor(PAYER_A);
const payerB = await sessionFor(PAYER_B);
const [R1, R2, U1, U2, V1, V2, V3] = await freeWindows(7);

console.log('1. Who may look (AC-19)');
check('queue-anon-401', 'an anonymous caller is refused', (await call(null, 'GET', '/admin/finance/payments')).status === 401);
check('queue-ops-403', 'an ops staffer, who cannot read finance, is refused', (await call(ops, 'GET', '/admin/finance/payments')).status === 403);
const firstQueue = await call(finance, 'GET', '/admin/finance/payments');
check('queue-finance-200', 'finance reads the queue with every bucket counted', firstQueue.status === 200 && typeof firstQueue.json?.counts?.owed === 'number', `${firstQueue.status}`);
const balance = await call(finance, 'GET', '/admin/finance/payments/balance');
check(
  'balance-matches',
  'the balance panel says what the bank record computes (AC-14)',
  balance.status === 200 && balance.json?.availableRwf === (await mockBalance()) && balance.json?.mode === 'mock',
  `${balance.status} ${balance.text.slice(0, 160)}`,
);

console.log('\n2. Topping up takes two people (AC-15)');
const bankRef = `VERIFY-DEPOSIT-${Date.now()}`;
const noKey = await call(finance, 'POST', '/admin/finance/treasury-adjustments', { amountRwf: 500_000, bankReference: bankRef, reason: 'Deposit for the verify run' });
check('treasury-needs-key', 'a request without an Idempotency-Key is refused', noKey.status === 400, `${noKey.status}`);
const key = randomUUID();
const requested = await call(
  finance,
  'POST',
  '/admin/finance/treasury-adjustments',
  { amountRwf: 500_000, bankReference: bankRef, reason: 'Deposit for the verify run' },
  { 'idempotency-key': key },
);
check('treasury-requested', 'finance requests a deposit; it waits, and finance cannot decide it', requested.status === 201 && requested.json?.state === 'initiated' && requested.json?.canDecide === false, `${requested.status} ${requested.text.slice(0, 160)}`);
const again = await call(
  finance,
  'POST',
  '/admin/finance/treasury-adjustments',
  { amountRwf: 500_000, bankReference: bankRef, reason: 'Deposit for the verify run' },
  { 'idempotency-key': key },
);
check('treasury-replay', 'the same press again is the same request', again.json?.id === requested.json?.id);
const financeApproves = await call(finance, 'POST', `/admin/money-overrides/${requested.json?.id}/approve`, {});
check('treasury-finance-cannot-approve', 'finance cannot approve: it lacks admin.money.override (403)', financeApproves.status === 403, `${financeApproves.status}`);
const balanceBeforeDeposit = await mockBalance();
const approved = await call(superAdmin, 'POST', `/admin/money-overrides/${requested.json?.id}/approve`, {});
const deposit = await one(`SELECT * FROM payment_transactions WHERE provider = 'mock' AND provider_reference = $1`, [bankRef]);
check(
  'treasury-applied',
  'the super admin approves; one successful adjustment row, linked to the override, raises the balance',
  approved.status === 200 && approved.json?.state === 'applied' && deposit?.direction === 'adjustment' && deposit?.status === 'successful' &&
    Number(deposit?.amount_rwf) === 500_000 && deposit?.money_override_id === requested.json?.id && (await mockBalance()) === balanceBeforeDeposit + 500_000,
  `${approved.status} ${approved.text.slice(0, 160)}`,
);
check('treasury-audited', 'the approval wrote an audit row on the adjustment it made', (await auditCount(deposit?.id, 'payment.override.approved')) === 1);
const dupe = await call(
  finance,
  'POST',
  '/admin/finance/treasury-adjustments',
  { amountRwf: 500_000, bankReference: bankRef, reason: 'The same deposit again' },
  { 'idempotency-key': randomUUID() },
);
const dupeApproved = await call(superAdmin, 'POST', `/admin/money-overrides/${dupe.json?.id}/approve`, {});
const dupeState = await one('SELECT state::text AS state FROM money_overrides WHERE id = $1', [dupe.json?.id]);
check('treasury-once', 'one deposit counts once: the same bank reference is refused (409) and nothing is applied', dupeApproved.status === 409 && dupeState?.state === 'initiated', `${dupeApproved.status} ${dupeState?.state}`);
const rejected = await call(superAdmin, 'POST', `/admin/money-overrides/${dupe.json?.id}/reject`, {});
check('treasury-rejected', 'the super admin rejects it instead', rejected.status === 200 && rejected.json?.state === 'rejected', `${rejected.status}`);
const own = await call(
  superAdmin,
  'POST',
  '/admin/finance/treasury-adjustments',
  { amountRwf: 1_000, bankReference: `VERIFY-OWN-${Date.now()}`, reason: 'Asking and approving alone' },
  { 'idempotency-key': randomUUID() },
);
const ownApproved = await call(superAdmin, 'POST', `/admin/money-overrides/${own.json?.id}/approve`, {});
check('two-people', 'nobody approves their own request (403)', ownApproved.status === 403, `${ownApproved.status}`);

console.log('\n3. Bookings the bank refuses, never answers, or reverses');
const bookedRefusals = [];
for (const window of [R1, R2]) {
  const attempt = await book(payerA, window, '788123333');
  bookedRefusals.push(attempt.status < 300 ? await settle(payerA, attempt) : null);
}
const unknownAttempts = [await book(payerA, U1, '788128888'), await book(payerA, U2, '788128888')];
check('unknown-answer', 'a payment the bank does not answer is not told it was refused', unknownAttempts.every((a) => a.status === 503), unknownAttempts.map((a) => a.status).join(','));
const reversals = [];
for (const window of [V1, V2, V3]) {
  const attempt = await book(payerB, window, '788127777');
  reversals.push(attempt.status < 300 ? await settle(payerB, attempt) : null);
}
check('booked', 'the refused and reversed bookings settle', [...bookedRefusals, ...reversals].every((b) => b?.id), JSON.stringify([...bookedRefusals, ...reversals].map((b) => b?.reference ?? null)));
const settledAt = Date.now();
for (const b of bookedRefusals) await call(payerA, 'POST', `/bookings/${b?.reference}/cancel`);
await call(payerB, 'POST', `/bookings/${reversals[1]?.reference}/cancel`);
const unknowns = await q(
  `SELECT * FROM payment_transactions WHERE direction = 'collection' AND payer_msisdn = '788128888' AND status = 'unknown'
    ORDER BY created_at DESC LIMIT 2`,
);

console.log('\n4. A payment nobody can see the outcome of (AC-20, AC-21)');
const [unknownKept, unknownFailed] = [unknowns[1], unknowns[0]];
check('parked-listed', 'both unanswered payments are parked in the queue', !!unknownKept && !!unknownFailed && (await inQueue(finance, unknownKept.id))?.bucket === 'parked');
const resolvedFailed = await call(finance, 'POST', `/admin/finance/payments/${unknownFailed?.id}/resolve`, { outcome: 'failed', note: 'Checked the portal: no such payment.' });
const afterFail = await one('SELECT status::text AS status, resolution_outcome FROM payment_transactions WHERE id = $1', [unknownFailed?.id]);
check('resolve-failed', 'one person resolves an unknown payment as failed, with a note and an audit row', resolvedFailed.status === 200 && afterFail?.status === 'failed' && afterFail?.resolution_outcome === 'failed' && (await auditCount(unknownFailed?.id, 'payment.resolved.failed')) === 1, `${resolvedFailed.status} ${JSON.stringify(afterFail)}`);
const resolvedTwice = await call(finance, 'POST', `/admin/finance/payments/${unknownFailed?.id}/resolve`, { outcome: 'failed', note: 'Again.' });
check('resolve-once', 'resolving it again is refused (409)', resolvedTwice.status === 409, `${resolvedTwice.status}`);
const standsNoFlag = await call(finance, 'POST', `/admin/finance/payments/${unknownKept?.id}/resolve`, { outcome: 'stands', note: 'Nothing to let stand.' });
check('stands-needs-flag', '"let it stand" needs a reversal flag (409)', standsNoFlag.status === 409, `${standsNoFlag.status}`);
const confirmReq = await call(finance, 'POST', `/admin/finance/payments/${unknownKept?.id}/overrides`, { action: 'confirm_received', reason: 'The portal shows this payment received.' });
const confirmApproved = await call(superAdmin, 'POST', `/admin/money-overrides/${confirmReq.json?.id}/approve`, {});
const afterConfirm = await one('SELECT status::text AS status, resolution_outcome FROM payment_transactions WHERE id = $1', [unknownKept?.id]);
check('confirm-received', 'two people confirm it received: the payment reads successful', confirmApproved.status === 200 && afterConfirm?.status === 'successful' && afterConfirm?.resolution_outcome === 'successful', `${confirmApproved.status} ${JSON.stringify(afterConfirm)}`);
const lateRefund = await waitFor(
  () => one(`SELECT * FROM payment_transactions WHERE idempotency_key = $1`, [`refund:${unknownKept?.idempotency_key}`]),
  20_000,
  2_000,
);
check(
  'confirmed-owed-back',
  'its booking never happened, so the money is owed back in full to the number that paid',
  lateRefund?.direction === 'disbursement' && Number(lateRefund?.amount_rwf) === Number(unknownKept?.amount_rwf) && lateRefund?.payee_account === '788128888',
  JSON.stringify(lateRefund && { status: lateRefund.status, amount: lateRefund.amount_rwf }),
);

console.log('\n5. Refunds the bank refused: write off, send again (AC-21)');
const [refused1, refused2] = await Promise.all(bookedRefusals.map((b) => refundOf(b.id)));
const failedBoth = await waitFor(async () => {
  const rows = await q(`SELECT status::text AS status FROM payment_transactions WHERE id = ANY($1)`, [[refused1?.id, refused2?.id]]);
  return rows.length === 2 && rows.every((r) => r.status === 'failed');
}, 150_000);
check('refused-owed', 'both refunds are refused and listed as owed, the wallet masked', !!failedBoth && (await inQueue(finance, refused1?.id))?.party === '078••••333', '');
const writeOffReq = await call(finance, 'POST', `/admin/finance/payments/${refused1?.id}/overrides`, { action: 'write_off', reason: 'The wallet is closed; the guest was paid by hand.' });
const writeOffApproved = await call(superAdmin, 'POST', `/admin/money-overrides/${writeOffReq.json?.id}/approve`, {});
const writtenOff = await one('SELECT written_off_at FROM payment_transactions WHERE id = $1', [refused1?.id]);
const settledBooking = await waitFor(
  () => one(`SELECT payment_status::text AS s FROM bookings WHERE id = $1 AND payment_status <> 'refund_pending'`, [bookedRefusals[0].id]),
  15_000,
  1_000,
);
check(
  'write-off',
  'two people write it off: it leaves the queue and the booking stops owing',
  writeOffApproved.status === 200 && !!writtenOff?.written_off_at && !(await inQueue(finance, refused1?.id)) && !!settledBooking,
  `${writeOffApproved.status} ${JSON.stringify(settledBooking)}`,
);
const resendReq = await call(finance, 'POST', `/admin/finance/payments/${refused2?.id}/overrides`, { action: 'resend_disbursement', reason: 'The guest says the wallet name is fixed now.' });
const resendApproved = await call(superAdmin, 'POST', `/admin/money-overrides/${resendReq.json?.id}/approve`, {});
const resend = await one(`SELECT * FROM payment_transactions WHERE idempotency_key = $1`, [`resend:1:${refused2?.idempotency_key}`]);
check(
  'resend-written',
  'two people send it again: a new row on its own key and reference, linked to the override, asking the payer again after a name mismatch',
  resendApproved.status === 200 && resend?.money_override_id === resendReq.json?.id && resend?.reference !== refused2?.reference &&
    resend?.status === 'queued' && resend?.queue_reason === 'payee_details_missing',
  `${resendApproved.status} ${JSON.stringify(resend && { status: resend.status, reason: resend.queue_reason })}`,
);
check('resend-supersedes', 'the original leaves the owed bucket; the resend waits on the payer', !(await inQueue(finance, refused2?.id)) && (await inQueue(finance, resend?.id))?.bucket === 'waiting_on_payer');
const resendTwice = await call(finance, 'POST', `/admin/finance/payments/${refused2?.id}/overrides`, { action: 'resend_disbursement', reason: 'Once more, please.' });
check('resend-once', 'it cannot be sent again while its resend is alive (409)', resendTwice.status === 409, `${resendTwice.status}`);

console.log(`\n6. Reversals (AC-18), waiting up to ${REVERSAL_WAIT_MS / 1000}s for the mock bank`);
await sleep(Math.max(0, settledAt + REVERSAL_WAIT_MS - Date.now()));
const [colV1, colV2, colV3] = await Promise.all(reversals.map((b) => collectionOf(b.id)));
const refundV2 = await refundOf(reversals[1].id);
const paidV2 = await waitFor(() => one(`SELECT 1 AS ok FROM payment_transactions WHERE id = $1 AND status = 'successful'`, [refundV2?.id]), 90_000);
check('double-refund-setup', 'the refund of the second reversed payment was paid before the reversal', !!paidV2);
const pulledV1 = await call(finance, 'POST', `/admin/finance/payments/${colV1?.id}/pull`, {});
check('pull-finds-reversal', 'a pull on a successful payment finds the reversal and flags it once', pulledV1.status === 200 && pulledV1.json?.after === 'reversed' && pulledV1.json?.reversalFlagged === true, `${pulledV1.status} ${pulledV1.text.slice(0, 160)}`);
const pulledV2 = await call(finance, 'POST', `/admin/finance/payments/${colV2?.id}/pull`, {});
await call(finance, 'POST', `/admin/finance/payments/${colV3?.id}/pull`, {});
const kinds = Object.fromEntries((await q(`SELECT id, reversal_kind FROM payment_transactions WHERE id = ANY($1)`, [[colV1?.id, colV2?.id]])).map((r) => [r.id, r.reversal_kind]));
check('double-refund-flag', 'a reversed payment that was already refunded is a double refund', pulledV2.status === 200 && kinds[colV2?.id] === 'double_refund' && kinds[colV1?.id] === 'reversal', JSON.stringify(kinds));
const reversalsBucket = (await call(finance, 'GET', '/admin/finance/payments')).json?.rows?.filter((r) => r.bucket === 'reversals') ?? [];
check('double-refund-first', 'double refunds sort first among reversals', reversalsBucket[0]?.reason === 'double_refund', JSON.stringify(reversalsBucket.map((r) => r.reason)));
const pullAgain = await call(finance, 'POST', `/admin/finance/payments/${colV1?.id}/pull`, {});
check('reversed-is-final', 'a reversed payment is final: pulling it again is refused (409)', pullAgain.status === 409, `${pullAgain.status}`);
const refundBack = await waitFor(async () => {
  const pulled = await call(finance, 'POST', `/admin/finance/payments/${refundV2?.id}/pull`, {});
  return pulled.json?.after === 'reversed' ? pulled : null;
}, 90_000, 10_000);
const v2Money = await one('SELECT payment_status::text AS s FROM bookings WHERE id = $1', [reversals[1].id]);
check(
  'refund-came-back',
  'the paid refund came back: it reads reversed, is owed again, and the booking owes it',
  !!refundBack && v2Money?.s === 'refund_pending' && (await inQueue(finance, refundV2?.id))?.bucket === 'owed',
  `${v2Money?.s}`,
);
const stands = await call(finance, 'POST', `/admin/finance/payments/${colV1?.id}/resolve`, { outcome: 'stands', note: 'The booking stands; Hangaa carries the loss.' });
check('reversal-stands', 'one person lets a reversal stand, with a note; it leaves the queue', stands.status === 200 && !(await inQueue(finance, colV1?.id)) && (await auditCount(colV1?.id, 'payment.resolved.stands')) === 1, `${stands.status}`);
const cancelReq = await call(finance, 'POST', `/admin/finance/payments/${colV3?.id}/overrides`, { action: 'cancel_service', reason: 'The guest reversed the payment; the stay is cancelled.' });
const cancelApproved = await call(superAdmin, 'POST', `/admin/money-overrides/${cancelReq.json?.id}/approve`, {});
const v3 = await waitFor(
  () => one(`SELECT status::text AS status, cancelled_by, refund_rwf, payment_status::text AS ps FROM bookings WHERE id = $1 AND status = 'cancelled'`, [reversals[2].id]),
  15_000,
  1_000,
);
check(
  'cancel-service',
  'two people cancel what the reversal paid for: the booking is cancelled with no refund',
  cancelApproved.status === 200 && v3?.cancelled_by === 'host' && Number(v3?.refund_rwf) === 0 && v3?.ps === 'refunded_full',
  `${cancelApproved.status} ${JSON.stringify(v3)}`,
);
const hostTold = await waitFor(async () => {
  for (const address of HOST_MAILBOXES) {
    const found = await mails(address, reversals[2].reference);
    if (found.some((m) => /reversed/i.test(m.Subject))) return true;
  }
  return null;
}, 45_000, 3_000);
check('host-told', 'the property is mailed that the payment was reversed and the booking cancelled', !!hostTold);

await pool.end();
console.log(`\nRESULT pass=${pass} fail=${failed.length} failed=[${failed.join(',')}]`);
if (failed.length > 0) process.exit(1);
console.log('money queue verification passed');
