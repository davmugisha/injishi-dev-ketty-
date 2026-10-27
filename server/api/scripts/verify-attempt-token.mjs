#!/usr/bin/env node
/**
 * A booking names its press (073-gtbank-payments AC-25, ADR-020 build task 8):
 * `POST /bookings` without an `attemptToken` is refused before any hold,
 * attempt or charge, and with one it is accepted as before.
 *
 *   API_BASE=http://127.0.0.1:8100 node scripts/verify-attempt-token.mjs
 *
 * WHAT IT WRITES: one booking attempt on a far future night of the seeded
 * Umurage suite (the accepted press). Run it only against a local sample
 * database. Prints `attempt token verification passed` when every check holds.
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import pg from 'pg';

const API = process.env.API_BASE || 'http://127.0.0.1:8000';
const OTP = process.env.VERIFY_OTP_CODE || '123456';
const GUEST = process.env.VERIFY_GUEST_EMAIL || 'broker@injishi.com';
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
  return line.slice('DATABASE_URL='.length).trim();
}
const pool = new pg.Pool({ connectionString: databaseUrl(), max: 1 });
const attempts = async () => Number((await pool.query('SELECT count(*)::int AS n FROM payment_attempts')).rows[0].n);

const jar = (res) => (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
await fetch(`${API}/api/auth/email-otp/send-verification-otp`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: GUEST, type: 'sign-in' }),
});
const signIn = await fetch(`${API}/api/auth/sign-in/email-otp`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: GUEST, otp: OTP }),
});
if (!signIn.ok) {
  console.error(`${GUEST}: sign-in answered ${signIn.status}.`);
  process.exit(2);
}
const cookie = jar(signIn);

const kigali = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kigali' }).format(new Date());
const day = (n) => new Date(Date.parse(`${kigali}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
/**
 * Two free nights, asked of the availability route rather than guessed: the suite is one unit, and the
 * walks that run before this one leave confirmed bookings across these months, so a random pair is sold
 * out often enough to answer 409 and fail the accepted press for a reason that is not the token.
 */
async function freeTwoNights() {
  for (let offset = 150 + Math.floor(Math.random() * 250), block = 0; block < 4; block++, offset += 81) {
    const res = await fetch(`${API}/api/v1/room-types/${SUITE}/availability?from=${day(offset)}&to=${day(offset + 80)}`);
    const nights = (await res.json()).nights ?? [];
    for (let i = 0; i + 1 < nights.length; i++) {
      if (nights[i].freeUnits >= 1 && nights[i + 1].freeUnits >= 1) return nights[i].night;
    }
  }
  console.error(`No two free nights for room type ${SUITE}.`);
  process.exit(2);
}
const checkIn = await freeTwoNights();
const body = {
  roomTypeId: SUITE,
  checkIn,
  checkOut: new Date(Date.parse(`${checkIn}T00:00:00Z`) + 2 * 86_400_000).toISOString().slice(0, 10),
  guests: 1,
  nonRefundable: false,
  instrument: { kind: 'mobile_money', network: 'mtn_momo', msisdn: '788123456' },
};
const post = (payload) =>
  fetch(`${API}/api/v1/bookings`, { method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

console.log(`Attempt token against ${API} (${new Date().toISOString()})\n`);
const before = await attempts();
const missing = await post(body);
check('token-required', 'a booking with no attempt token is refused (400)', missing.status === 400, `${missing.status}`);
check('nothing-written', 'and nothing was held or attempted', (await attempts()) === before);
const named = await post({ ...body, attemptToken: randomUUID() });
check('token-accepted', 'the same booking with its token is accepted', named.status === 201 || named.status === 200, `${named.status}`);

await pool.end();
console.log(`\nRESULT pass=${pass} fail=${failed.length} failed=[${failed.join(',')}]`);
if (failed.length > 0) process.exit(1);
console.log('attempt token verification passed');
