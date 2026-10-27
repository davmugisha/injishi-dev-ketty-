#!/usr/bin/env node
/**
 * The guest booking journey, end to end, against a RUNNING local stack.
 *
 * Written by the booking-flow production-readiness audit of 2026-09-13. It
 * drives the real HTTP API over the real Postgres, Redis worker and Mailpit,
 * with the MOCK payment adapter (mobile money settles after
 * MOCK_MOMO_APPROVAL_MS, a payer number ending 0000 is declined).
 *
 *   VERIFY_API_URL=http://localhost:8000 node scripts/verify-booking-journey.mjs
 *   SKIP_UNPOLLED=1 node scripts/verify-booking-journey.mjs   # skip the 5-minute test
 *
 * Every check prints `PASS [id]` or `FAIL [id]`, and the last line is
 * `RESULT pass=N fail=M failed=[...]`. Exit code 1 when any check fails.
 *
 * EVERY CHECK IS EXPECTED TO PASS. When the audit first ran it on 2026-09-13
 * these failed; ADR-051 fixed each one, and each is kept as its regression:
 *   repoll-keeps-booking     a second poll of a confirmed payment returned booking: null
 *   race-no-double-prompt    two guests were both charged for the last unit (no hold)
 *   race-loser-told-refund   the loser's poll answered a raw 409 and the attempt stuck
 *   poll-not-throttled       the 2-second payment poll hit the 5/min money throttle
 *   mail-host-told           nothing told the host a request arrived
 *   refund-outbox-drains     void/refund jobs never ran (BullMQ refused their ids)
 *   late-settled-becomes-booking  (long test) a payment approved in time but polled
 *                            late was voided and the guest told nothing was charged
 * Added with the fixes: the closed tab and the lapsed hold (long test), and the
 * cancellation checks in section 9b. Since 073-gtbank-payments AC-13 a cancel
 * or a decline reads `refund_pending` at once, with its refund OWED; the
 * dispatcher paying it, and the booking then reading refunded, is proven by
 * `verify-refunds-owed.mjs`. A payer number ending 9999 approves after
 * the prompt window, which is what the lapsed hold uses.
 *
 * WHAT IT WRITES: a handful of bookings on far-future nights, on the seeded
 * Umurage Guesthouse rooms, left in place like verify-my-trips.mjs leaves its
 * own. Run it only against a local SAMPLE database, never a shared one.
 *
 * OTP budget: one sign-in per identity per run, and the cap is 5 codes an hour
 * per identity (ADR-039). Move to other seeded identities with
 * VERIFY_GUEST_EMAIL, VERIFY_OTHER_EMAIL and VERIFY_OPERATOR_EMAIL.
 */
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const API = process.env.VERIFY_API_URL || 'http://localhost:8000';
const MAILPIT = process.env.MAILPIT_URL || 'http://localhost:8025';
const OTP = process.env.VERIFY_OTP_CODE || '123456';
const GUEST = process.env.VERIFY_GUEST_EMAIL || 'guest@injishi.com';
const OTHER = process.env.VERIFY_OTHER_EMAIL || 'broker@injishi.com';
const OPERATOR = process.env.VERIFY_OPERATOR_EMAIL || 'host@injishi.com';
/** The guest who books and cancels in section 9b. Defaults to GUEST, which then waits out the throttle. */
const CANCELLER = process.env.VERIFY_CANCEL_EMAIL || GUEST;
/** Every address that manages the test property, any of which may be told about a request. */
const HOST_MAILBOXES = (process.env.VERIFY_HOST_MAILBOXES || 'host@injishi.com,manager@injishi.com').split(',');
/** An instant_book room type with exactly one unit, in the operator's workspace. */
const SUITE = process.env.VERIFY_SUITE_ROOM_TYPE || '0f9a1b00-0000-4000-8000-000000000103';
/** A request_to_book room type in the operator's workspace. */
const REQUEST = process.env.VERIFY_REQUEST_ROOM_TYPE || '0f9a1b00-0000-4000-8000-000000000101';
const DB_CONTAINER = process.env.VERIFY_DB_CONTAINER || 'docker-db-1';
const DB_USER = process.env.VERIFY_DB_USER || 'injishi';
const DB_NAME = process.env.VERIFY_DB_NAME || 'injishi';
const LONG = !process.env.SKIP_UNPOLLED;

const passed = [];
const failed = [];
function check(id, label, ok, detail = '') {
  (ok ? passed : failed).push(id);
  console.log(`  ${ok ? 'PASS' : 'FAIL'} [${id}] ${label}${!ok && detail ? `   -> ${detail}` : ''}`);
}
const note = (s) => console.log(`       ${s}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sql = (q) =>
  execFileSync('docker', ['exec', DB_CONTAINER, 'psql', '-U', DB_USER, '-d', DB_NAME, '-Atc', q]).toString().trim();
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
    console.error(
      `${email}: sign-in answered ${res.status}. A 400 is usually the OTP cap (5 codes an hour per identity); ` +
        'wait, or point VERIFY_*_EMAIL at another seeded identity.',
    );
    process.exit(2);
  }
  const cookie = jar(res);
  // Harmless for a guest; the operator's grants put the emailed step-up first.
  await fetch(`${API}/api/v1/me/two-factor/send`, { method: 'POST', headers: { cookie } });
  await fetch(`${API}/api/v1/me/two-factor/verify`, {
    method: 'POST',
    headers: { cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: OTP }),
  });
  const me = await (await fetch(`${API}/api/v1/me/workspaces`, { headers: { cookie } })).json().catch(() => ({}));
  const ws = (me.workspaces ?? []).find((w) => w.kind === 'business');
  return { cookie, workspaceId: ws?.workspaceId ?? null };
}

async function call(s, method, path, body) {
  const res = await fetch(`${API}/api/v1${path}`, {
    method,
    headers: {
      cookie: s.cookie,
      // Fastify refuses an empty body under a JSON content type, so the header
      // is sent only with a body.
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
  return { status: res.status, json, text: text.slice(0, 240) };
}

const momo = (msisdn) => ({ kind: 'mobile_money', network: 'mtn_momo', msisdn });
const book = (s, roomTypeId, [checkIn, checkOut], guests, msisdn, attemptToken = randomUUID(), nonRefundable = false) =>
  call(s, 'POST', '/bookings', {
    roomTypeId,
    checkIn,
    checkOut,
    guests,
    nonRefundable,
    attemptToken,
    instrument: momo(msisdn),
  }).then((r) => ({ ...r, attemptToken }));
const poll = (s, token) => call(s, 'GET', `/bookings/attempts/${token}`);
const attemptRows = () => Number(sql('select count(*) from payment_attempts'));
/**
 * Bookings HOLDING the unit on those nights. Only holding statuses count: an
 * earlier run's cancellation frees its nights, availability then offers them
 * again, and a cancelled row there is not a second booking.
 */
const bookingsOn = (roomTypeId, [checkIn]) =>
  Number(
    sql(
      `select count(*) from bookings where room_type_id='${roomTypeId}' and check_in='${checkIn}' and status in ('pending_approval','confirmed')`,
    ),
  );
async function mailsTo(address, needle) {
  const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${address}`)}&limit=100`);
  const body = await res.json();
  return (body.messages ?? []).filter((m) => m.Subject.includes(needle)).map((m) => m.Subject);
}

const kigaliToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kigali' }).format(new Date());
const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** Two-night windows whose nights all have at least `minFree` units, spaced apart. */
async function freeWindows(roomTypeId, count, minFree) {
  const today = kigaliToday();
  let offset = 120 + Math.floor(Math.random() * 130);
  const found = [];
  for (let block = 0; block < 3 && found.length < count; block++, offset += 81) {
    const from = addDays(today, offset);
    const to = addDays(today, offset + 80);
    const res = await fetch(`${API}/api/v1/room-types/${roomTypeId}/availability?from=${from}&to=${to}`);
    const nights = (await res.json()).nights ?? [];
    for (let i = 0; i + 1 < nights.length && found.length < count; i += 3) {
      if (nights[i].freeUnits >= minFree && nights[i + 1].freeUnits >= minFree) {
        found.push([nights[i].night, addDays(nights[i].night, 2)]);
      }
    }
  }
  if (found.length < count) {
    console.error(`Could not find ${count} free two-night windows for room type ${roomTypeId}.`);
    process.exit(2);
  }
  return found;
}

console.log(`Guest booking journey against ${API} (${new Date().toISOString()})\n`);

const suite = await (await fetch(`${API}/api/v1/bookable/${SUITE}`)).json().catch(() => null);
const request = await (await fetch(`${API}/api/v1/bookable/${REQUEST}`)).json().catch(() => null);
if (suite?.roomType?.bookingMode !== 'instant_book' || suite?.roomType?.roomCount !== 1) {
  console.error('VERIFY_SUITE_ROOM_TYPE must be an instant_book room type with exactly one unit.');
  process.exit(2);
}
if (request?.roomType?.bookingMode !== 'request_to_book') {
  console.error('VERIFY_REQUEST_ROOM_TYPE must be a request_to_book room type.');
  process.exit(2);
}
const [HAPPY, DECLINED, RACE, LATE, CLOSED, LAPSE, CXL_FLEX, CXL_NR, CXL_HOST] = await freeWindows(SUITE, 9, 1);
const [ASK] = await freeWindows(REQUEST, 1, 1);
note(`test nights: happy ${HAPPY[0]}, declined ${DECLINED[0]}, race ${RACE[0]}, late ${LATE[0]}, closed ${CLOSED[0]}, lapse ${LAPSE[0]}, request ${ASK[0]}`);

const guest = await sessionFor(GUEST);
const other = await sessionFor(OTHER);
const operator = await sessionFor(OPERATOR);

console.log('\n1. What a guest can read before paying');
check('public-bookable', 'GET /bookable/:roomTypeId answers without a session', !!suite?.property?.name);
const window2 = await (await fetch(`${API}/api/v1/room-types/${SUITE}/availability?from=${HAPPY[0]}&to=${HAPPY[1]}`)).json();
check('public-availability', 'availability answers one row per night', window2.nights?.length === 2, JSON.stringify(window2));
const uncapped = await fetch(`${API}/api/v1/room-types/${SUITE}/availability?from=${kigaliToday()}&to=${addDays(kigaliToday(), 1100)}`);
check('availability-window-capped', 'an uncapped availability window is refused 400', uncapped.status === 400, uncapped.status);
const anonymous = await fetch(`${API}/api/v1/bookings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
check('anon-post-refused', 'an anonymous POST /bookings is refused 401', anonymous.status === 401, anonymous.status);

console.log('\n2. Instant book, mobile money, happy path');
const rowsBefore = attemptRows();
const happy = await book(guest, SUITE, HAPPY, 2, '788123456');
check('happy-prompt', 'POST /bookings answers 201 awaiting_payment', happy.status === 201 && happy.json?.status === 'awaiting_payment', `${happy.status} ${happy.text}`);
check('happy-one-attempt-row', 'exactly one payment_attempts row is written', attemptRows() === rowsBefore + 1);
await sleep(7_000);
const settled = await poll(guest, happy.attemptToken);
const reference = settled.json?.booking?.reference;
check('happy-poll-confirms', 'the poll turns the settled payment into a confirmed booking', settled.json?.state === 'confirmed' && !!reference, `${settled.status} ${settled.text}`);
if (reference) {
  const row = sql(
    `select b.status||'|'||b.payment_status||'|'||(select count(*) from escrows e where e.booking_id=b.id) from bookings b where b.reference='${reference}'`,
  );
  check('happy-db-escrow', `DB: ${reference} is confirmed, captured, with one escrow row`, row === 'confirmed|captured|1', row);
  const trips = await call(guest, 'GET', '/me/trips');
  check('trips-lists-booking', 'GET /me/trips lists it', trips.status === 200 && trips.text.length > 0 && JSON.stringify(trips.json).includes(reference), trips.status);
  check('receipt-owner-200', 'the guest opens the receipt', (await call(guest, 'GET', `/bookings/${reference}/receipt`)).status === 200);
  check('receipt-foreign-404', 'another guest gets 404 on that receipt', (await call(other, 'GET', `/bookings/${reference}/receipt`)).status === 404);
  check('poll-foreign-404', 'another guest gets 404 polling that payment', (await poll(other, happy.attemptToken)).status === 404);
  const again = await poll(guest, happy.attemptToken);
  check(
    'repoll-keeps-booking',
    'polling a confirmed payment again still returns the booking (the contract says it must)',
    again.json?.state === 'confirmed' && again.json?.booking?.reference === reference,
    `state=${again.json?.state} booking=${JSON.stringify(again.json?.booking)}`,
  );

  console.log('\n3. The same press sent twice');
  const replay = await book(guest, SUITE, HAPPY, 2, '788123456', happy.attemptToken);
  check('replay-same-booking', 're-sending the attempt token answers the same booking', replay.status === 201 && replay.json?.booking?.reference === reference, `${replay.status} ${replay.text}`);
  check('replay-one-booking', 'DB: still one booking for those nights', bookingsOn(SUITE, HAPPY) === 1);

  console.log('\n4. The last unit is already sold');
  const rowsBeforeSold = attemptRows();
  const sold = await book(guest, SUITE, HAPPY, 2, '788123456');
  check('soldout-409', 'a new press for sold-out nights is refused 409', sold.status === 409, `${sold.status} ${sold.text}`);
  check('soldout-no-charge', 'and no payment is attempted', attemptRows() === rowsBeforeSold);
}

console.log('\n5. The payer declines');
const declined = await book(guest, SUITE, DECLINED, 2, '788120000');
check('declined-no-booking', 'a declined payment answers 400 and writes no booking', declined.status === 400 && bookingsOn(SUITE, DECLINED) === 0, `${declined.status} ${declined.text}`);

console.log('\n6. Two guests race for the last unit');
const [first, second] = await Promise.all([book(guest, SUITE, RACE, 2, '788123456'), book(other, SUITE, RACE, 2, '788654321')]);
const prompted = [first, second].filter((r) => r.json?.status === 'awaiting_payment');
check(
  'race-no-double-prompt',
  'only one guest is sent a payment prompt for the last unit (F-B05: inventory held on submission)',
  prompted.length === 1,
  `POSTs answered ${first.status} and ${second.status}; ${prompted.length} prompts sent`,
);
await sleep(7_000);
const racePolls = await Promise.all([
  first.json?.status === 'awaiting_payment' ? poll(guest, first.attemptToken) : null,
  second.json?.status === 'awaiting_payment' ? poll(other, second.attemptToken) : null,
]);
note(`race polls answered: ${racePolls.map((p) => (p ? `${p.status} ${p.json?.state ?? p.json?.message}` : 'no prompt')).join(' | ')}`);
check('race-one-booking', 'DB: exactly one booking for the raced nights', bookingsOn(SUITE, RACE) === 1);
const loser = racePolls.filter(Boolean).find((p) => p.json?.state !== 'confirmed');
check(
  'race-loser-told-refund',
  'a charged loser is answered 200 refused with the refund sentence, not a raw error',
  !loser || (loser.status === 200 && loser.json?.state === 'refused' && /refunded in full/.test(loser.json?.failureReason ?? '')),
  loser ? `${loser.status} ${loser.text}` : '',
);

console.log('\n7. Request to book, and the host declines');
const ask = await book(other, REQUEST, ASK, 1, '788654321');
await sleep(7_000);
const asked = await poll(other, ask.attemptToken);
const pending = asked.json?.booking;
check('rtb-pending-approval', 'a request settles into pending_approval', pending?.status === 'pending_approval', `${asked.status} ${asked.text}`);
// A host answers a request after being told about it, so the "tell the host"
// mail is awaited BEFORE the decline. Declining first would make the worker
// rightly skip it ("that sentence is no longer true") and fail this check on
// timing rather than on behaviour.
const hostTold = [];
if (pending?.reference) {
  const until = Date.now() + 45_000;
  while (hostTold.length === 0 && Date.now() < until) {
    for (const address of HOST_MAILBOXES) hostTold.push(...(await mailsTo(address, pending.reference)));
    if (hostTold.length === 0) await sleep(2_000);
  }
}
if (pending?.id) {
  const decline = await call(operator, 'POST', `/bookings/${pending.id}/decline`, {});
  check('host-decline', 'the host declines it', decline.status < 300, `${decline.status} ${decline.text}`);
  const after = sql(`select status||'|'||payment_status from bookings where id='${pending.id}'`);
  // Decline now, refund owed (073-gtbank-payments AC-13): the money reads
  // refund_pending until the dispatcher's payment lands, and a refund is owed
  // back to the collection that paid, written with the decline.
  check('host-decline-refunded', 'DB: declined and refund_pending', after === 'declined|refund_pending', after);
  const owed = sql(`select count(*) from payment_transactions where booking_id='${pending.id}' and direction='disbursement'`);
  check('host-decline-refund-owed', 'DB: the decline wrote one refund owed', owed === '1', owed);
}

console.log('\n8. The payment poll at the rate the checkout uses');
const codes = [];
for (let i = 0; i < 7; i++) codes.push((await poll(other, ask.attemptToken)).status);
check('poll-not-throttled', 'seven quick polls are never answered 429', !codes.includes(429), codes.join(' '));

console.log('\n9. Mail (worker + Mailpit)');
await sleep(15_000);
if (reference) check('mail-guest-confirmed', `the guest got the confirmation for ${reference}`, (await mailsTo(GUEST, reference)).length > 0);
if (pending?.reference) {
  const subjects = await mailsTo(OTHER, pending.reference);
  check('mail-request-and-refund', 'the requester got "request sent" and the refund mail', subjects.length >= 2, subjects.join(' || '));
  // Whoever manages the property is told; the operator this run signed in as
  // may be either of its two managers.
  check('mail-host-told', 'the host was told a request arrived, before they answered it', hostTold.length > 0);
}

/*
 * A third guest, for 9b and the slow paths. The first guest has spent the five
 * POST /bookings a minute the money throttle allows by now, and a 429 in
 * either section would say nothing about what it tests.
 */
const canceller = CANCELLER === GUEST ? guest : await sessionFor(CANCELLER);

console.log('\n9b. Cancellation and refund tiers (F-B11, ADR-051)');
{
  // Three confirmed bookings of the flexible Garden Suite, far enough ahead
  // that its 24-hour window is open: one flexible, one on the non-refundable
  // rate, one the host will cancel.
  //
  // The guest here is a third identity. The first guest has already spent the
  // five POST /bookings a minute the money throttle allows, and a 429 here
  // would say nothing about cancellation.
  if (canceller === guest) await sleep(61_000);
  const [flex, nr, hosted] = await Promise.all([
    book(canceller, SUITE, CXL_FLEX, 2, '788123456'),
    book(canceller, SUITE, CXL_NR, 2, '788123456', randomUUID(), true),
    book(other, SUITE, CXL_HOST, 2, '788654321'),
  ]);
  note(`cancellation bookings answered ${flex.status}/${nr.status}/${hosted.status}`);
  await sleep(7_000);
  const [flexB, nrB, hostB] = (
    await Promise.all([poll(canceller, flex.attemptToken), poll(canceller, nr.attemptToken), poll(other, hosted.attemptToken)])
  ).map((p) => p.json?.booking ?? null);
  const row = (id) =>
    id
      ? sql(
          `select b.status||'|'||coalesce(b.payment_status::text,'')||'|'||coalesce(e.status::text,'')||'|'||coalesce(b.cancelled_by,'')||'|'||coalesce(b.refund_rwf::text,'') from bookings b left join escrows e on e.booking_id=b.id where b.id='${id}'`,
        )
      : 'no booking';

  if (flexB) {
    const gross = flexB.breakdown.grossRwf;
    const quote = await call(canceller, 'GET', `/bookings/${flexB.reference}/cancellation`);
    check(
      'guest-cancel-refund-quote',
      'the guest is quoted the refund before cancelling (flexible, far ahead: 100%)',
      quote.status === 200 && quote.json?.cancellable === true && quote.json?.percent === 100 && quote.json?.refundRwf === gross,
      `${quote.status} ${quote.text}`,
    );
    const foreign = await call(other, 'POST', `/bookings/${flexB.reference}/cancel`);
    check(
      'cancel-foreign-404',
      "another guest trying to cancel it gets 404, and it stands",
      foreign.status === 404 && row(flexB.id).startsWith('confirmed|'),
      `${foreign.status} ${row(flexB.id)}`,
    );
    const cancelled = await call(canceller, 'POST', `/bookings/${flexB.reference}/cancel`);
    check(
      'guest-cancel-flexible-full',
      'the guest cancels a flexible booking and the full refund is owed (DB: cancelled, refund_pending, escrow refund_pending)',
      cancelled.status < 300 && cancelled.json?.refundRwf === gross && row(flexB.id) === `cancelled|refund_pending|refund_pending|guest|${gross}`,
      `${cancelled.status} ${cancelled.text} DB=${row(flexB.id)}`,
    );
    const twice = await call(canceller, 'POST', `/bookings/${flexB.reference}/cancel`);
    check('cancel-twice-409', 'cancelling it again is refused 409', twice.status === 409, `${twice.status} ${twice.text}`);
  } else {
    check('guest-cancel-flexible-full', 'the flexible booking to cancel was created', false, `no booking settled (POST ${flex.status} ${flex.text.slice(0, 120)})`);
  }

  if (nrB) {
    const cancelled = await call(canceller, 'POST', `/bookings/${nrB.reference}/cancel`);
    check(
      'guest-cancel-nonrefundable-forfeit',
      'a non-refundable booking cancelled by the guest refunds nothing (DB: cancelled, forfeited)',
      nrB.nonRefundable === true && cancelled.status < 300 && cancelled.json?.refundRwf === 0 && row(nrB.id) === 'cancelled|forfeited|forfeited|guest|0',
      `nonRefundable=${nrB.nonRefundable} ${cancelled.status} ${cancelled.text} DB=${row(nrB.id)}`,
    );
  } else {
    check('guest-cancel-nonrefundable-forfeit', 'the non-refundable booking to cancel was created', false, `no booking settled (POST ${nr.status} ${nr.text.slice(0, 120)})`);
  }

  if (hostB) {
    const gross = hostB.breakdown.grossRwf;
    const cancelled = await call(operator, 'POST', `/bookings/${hostB.id}/host-cancel`);
    check(
      'host-cancel-full-refund',
      'the host cancels a booking and the full refund is owed to the guest (DB: cancelled by host, refund_pending)',
      cancelled.status < 300 && cancelled.json?.refundRwf === gross && row(hostB.id) === `cancelled|refund_pending|refund_pending|host|${gross}`,
      `${cancelled.status} ${cancelled.text} DB=${row(hostB.id)}`,
    );
  } else {
    check('host-cancel-full-refund', 'the booking for the host to cancel was created', false, `no booking settled (POST ${hosted.status} ${hosted.text.slice(0, 120)})`);
  }
}

if (LONG) {
  console.log('\n10. The slow paths: a late poll, a closed tab, a lapsed hold');
  // Three prompts at once, so the waits overlap. The mock settles after 6s,
  // except a payer number ending 9999, which approves 200s after the capture:
  // after the 180s prompt window has closed.
  const late = await book(other, SUITE, LATE, 2, '788654321');
  const closed = await book(canceller, SUITE, CLOSED, 2, '788123456');
  const lapse = await book(canceller, SUITE, LAPSE, 2, '788129999');
  const t0 = Date.now();
  note(`prompts ${late.status}/${closed.status}/${lapse.status}; nothing is polled for 130s`);

  await sleep(130_000);
  const closedRow = sql(
    `select a.state||'|'||coalesce(b.status::text,'none') from payment_attempts a left join bookings b on b.id=a.booking_id where a.attempt_token='${closed.attemptToken}'`,
  );
  check(
    'closed-tab-sweep-completes',
    'a payment approved with nobody polling becomes its booking from the worker sweep',
    closedRow === 'confirmed|confirmed',
    closedRow,
  );

  const lapseExpires = Date.parse(lapse.json?.attempt?.expiresAt ?? '') || t0 + 180_000;
  await sleep(Math.max(0, lapseExpires + 3_000 - Date.now()));
  const taker = await book(other, SUITE, LAPSE, 2, '788654321');
  check(
    'lapsed-hold-releases',
    'once an unanswered hold lapses, another guest can take the unit',
    taker.status === 201 && taker.json?.status === 'awaiting_payment',
    `${taker.status} ${taker.text}`,
  );

  await sleep(8_000);
  const takerPoll = await poll(other, taker.attemptToken);
  const latePoll = await poll(other, late.attemptToken);
  check(
    'late-settled-becomes-booking',
    'a payment that settled inside the window but is polled after it still becomes a booking',
    latePoll.json?.state === 'confirmed' && !!latePoll.json?.booking?.reference,
    `state=${latePoll.json?.state} reason="${latePoll.json?.failureReason}"`,
  );

  await sleep(Math.max(0, t0 + 212_000 - Date.now()));
  const loserPoll = await poll(canceller, lapse.attemptToken);
  check(
    'lapsed-hold-loser-refunded',
    'a guest whose hold lapsed and whose room was taken is answered 200 refused and told they were refunded',
    takerPoll.json?.state === 'confirmed' &&
      loserPoll.status === 200 &&
      loserPoll.json?.state === 'refused' &&
      /refunded in full/.test(loserPoll.json?.failureReason ?? ''),
    `taker=${takerPoll.json?.state} loser=${loserPoll.status} ${loserPoll.json?.state} "${loserPoll.json?.failureReason}"`,
  );
  check('lapsed-one-booking', 'DB: exactly one booking for the lapsed-hold nights', bookingsOn(SUITE, LAPSE) === 1);
}

console.log('\n11. The refund and void outbox');
const stuck = sql(
  "select count(*) from payment_compensations where done_at is null and next_at < now() - interval '90 seconds'",
);
check('refund-outbox-drains', 'no void or refund sits unprocessed past its due time', stuck === '0', `${stuck} row(s) stuck`);

console.log(`\nRESULT pass=${passed.length} fail=${failed.length} failed=[${failed.join(',')}]`);
process.exit(failed.length > 0 ? 1 : 0);
