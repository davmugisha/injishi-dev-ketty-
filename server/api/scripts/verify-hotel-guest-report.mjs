#!/usr/bin/env node
/**
 * A hotel guest reaches local government (0114), end to end over HTTP.
 *
 *   node scripts/verify-hotel-guest-report.mjs
 *
 * The story: a registered guest books the demo guesthouse, pays by (mock) MTN
 * MoMo, and the desk checks them in. The check in files the guest into the
 * register, at the guesthouse's own village, and the village leader, the cell
 * executive, the DASSO and the district officer each see them in their list
 * and in their report.
 *
 * Needs the API on :8000 over a SAMPLE database (seed-sample), the demo OTP
 * 123456, and Docker's `docker-db-1` for the few reads only SQL can make.
 *
 * SETUP IT DOES BY HAND, and why. The seed puts Umurage Guesthouse in a
 * district with no village, and no route edits a property's place after
 * registration (registration's location step sets it for a real hotel), so
 * the script gives it a village in its own district. The four leaders are
 * appointed through the admin API, as admin@injishi.com; a second run
 * finds them already appointed and carries on.
 *
 * Checks:
 *   booked                 the guest's MoMo payment settles into a confirmed booking
 *   checked-in             the desk checks them in (201, a stay)
 *   filed                  one `hotel` registration for the stay, at the guesthouse's village and sector
 *   routed                 its routes reach the village leader, the cell executive and the district officer
 *   <role>-list            each leader's guest list holds the guest, named "Hotel guest"
 *   <role>-report          each leader's report counts them
 *   once                   checking in again files nothing more
 */
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const API = process.env.VERIFY_API_URL || 'http://localhost:8000';
const OTP = process.env.VERIFY_OTP_CODE || '123456';
const GUEST = process.env.VERIFY_GUEST_EMAIL || 'guest@injishi.com';
const OPERATOR = process.env.VERIFY_OPERATOR_EMAIL || 'host@injishi.com';
// Appointing a leader is `admin.user.role.grant`, a super_admin power.
const ADMIN = process.env.VERIFY_ADMIN_EMAIL || 'admin@injishi.com';
/** An instant_book room type at Umurage Guesthouse. */
const SUITE = process.env.VERIFY_SUITE_ROOM_TYPE || '0f9a1b00-0000-4000-8000-000000000103';
const PROPERTY = process.env.VERIFY_PROPERTY || '0f9a1b00-0000-4000-8000-000000000003';
const DB_CONTAINER = process.env.VERIFY_DB_CONTAINER || 'docker-db-1';
const DB_USER = process.env.VERIFY_DB_USER || 'injishi';
const DB_NAME = process.env.VERIFY_DB_NAME || 'injishi';

/** Akakaza, Kinyaga cell, Bumbogo sector, Gasabo district (province 1, Kigali). */
const PLACE = { provinceId: 1, districtId: 102, sectorId: 10201, cellId: 1020101, villageId: 102010101 };

const LEADERS = [
  { role: 'village_leader', email: 'village.akakaza@leaders.injishi.test', scopeLevel: 'village', title: 'Umukuru w’Umudugudu' },
  { role: 'cell_executive', email: 'cell.kinyaga@leaders.injishi.test', scopeLevel: 'cell', title: 'Executive Secretary, Kinyaga cell' },
  { role: 'dasso', email: 'dasso.bumbogo@leaders.injishi.test', scopeLevel: 'sector', title: 'DASSO, Bumbogo sector' },
  { role: 'district_officer', email: 'district.gasabo@leaders.injishi.test', scopeLevel: 'district', title: 'District officer, Gasabo' },
];

let failed = 0;
function check(id, label, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id.padEnd(26)} ${label}${ok || !detail ? '' : `\n        ${detail}`}`);
  if (!ok) failed += 1;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function sql(query) {
  return execFileSync('docker', ['exec', DB_CONTAINER, 'psql', '-U', DB_USER, '-d', DB_NAME, '-tA', '-c', query], {
    encoding: 'utf8',
  }).trim();
}

function kigaliToday() {
  return new Date(Date.now() + 2 * 3600_000).toISOString().slice(0, 10);
}
function addDays(day, n) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function jar(res) {
  return (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
}

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
    console.error(`${email}: sign-in answered ${res.status} (a 400 is usually the OTP cap of 10 an hour).`);
    process.exit(2);
  }
  const cookie = jar(res);
  // The emailed step-up that operator, staff and oversight grants put first. Harmless for a guest.
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
      ...(s.workspaceId ? { 'X-Workspace-Id': s.workspaceId } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  return { status: res.status, json, text: text.slice(0, 300) };
}

// --- 0. Setup ---------------------------------------------------------------------------
console.log('0. Setup');
const platform = await (await fetch(`${API}/api/v1/platform`)).json().catch(() => ({}));
if (!platform.sampleData) {
  console.error('Refusing: the API is not over a sample database, and this script writes test data.');
  process.exit(2);
}
sql(`update properties set village_id = ${PLACE.villageId}, sector_id = ${PLACE.sectorId}, district_id = ${PLACE.districtId} where id = '${PROPERTY}'`);
check('place-set', 'Umurage Guesthouse sits in Akakaza village, Bumbogo sector', sql(`select village_id from properties where id = '${PROPERTY}'`) === String(PLACE.villageId));

const admin = await sessionFor(ADMIN);
for (const l of LEADERS) {
  const r = await call(admin, 'POST', '/admin/local-leaders', {
    email: l.email,
    name: l.title,
    role: l.role,
    governmentBodyCode: 'MINALOC',
    governmentTitle: l.title,
    scopeLevel: l.scopeLevel,
    provinceId: PLACE.provinceId,
    districtId: PLACE.districtId,
    sectorId: ['sector', 'cell', 'village'].includes(l.scopeLevel) ? PLACE.sectorId : null,
    cellId: ['cell', 'village'].includes(l.scopeLevel) ? PLACE.cellId : null,
    villageId: l.scopeLevel === 'village' ? PLACE.villageId : null,
    reason: 'verify-hotel-guest-report: the leaders over the demo guesthouse',
  });
  check(`appoint-${l.role}`, `${l.role} appointed (or already in post)`, r.status === 201 || r.status === 409, `${r.status} ${r.text}`);
}

// The suite has one room: a guest an earlier run left in it is checked out, through the desk's own route.
const desk = await sessionFor(OPERATOR);
const leftIn = sql(
  `select s.id from guest_stays s join rooms r on r.id = s.room_id
    where r.room_type_id = '${SUITE}' and s.actual_exit_at is null`,
)
  .split('\n')
  .filter(Boolean);
for (const id of leftIn) await call(desk, 'POST', `/ops/stays/${id}/checkout`, { note: 'verify-hotel-guest-report: an earlier run' });
// The room is then dirty; housekeeping would make it ready before the next guest.
sql(`update rooms set housekeeping_status = 'clean' where room_type_id = '${SUITE}'`);
// A booking stays `confirmed` after its guest leaves (there is no checked-out status), so an earlier
// run's booking still holds tonight. Only those this script made are released: a closed stay whose
// note says so.
sql(
  `update bookings b set status = 'cancelled', cancelled_at = now(), cancelled_by = 'host',
          cancel_reason = 'verify-hotel-guest-report: an earlier run', refund_rwf = 0
    where b.room_type_id = '${SUITE}' and b.status = 'confirmed' and b.check_out > current_date
      and exists (select 1 from guest_stays s where s.booking_id = b.id and s.actual_exit_at is not null
                    and exists (select 1 from guest_registrations g where g.guest_stay_id = s.id))`,
);

// --- 1. The guest books and pays -----------------------------------------------------------
console.log('\n1. A registered guest books the guesthouse');
const guest = await sessionFor(GUEST);
const today = kigaliToday();
const stay = [today, addDays(today, 2)];
const token = randomUUID();
const booked = await call(guest, 'POST', '/bookings', {
  roomTypeId: SUITE,
  checkIn: stay[0],
  checkOut: stay[1],
  guests: 1,
  nonRefundable: false,
  attemptToken: token,
  instrument: { kind: 'mobile_money', network: 'mtn_momo', msisdn: '788123456' },
});
if (booked.status !== 201) {
  check('booked', 'POST /bookings accepted', false, `${booked.status} ${booked.text}`);
  process.exit(1);
}
await sleep(7_000);
const settled = await call(guest, 'GET', `/bookings/attempts/${token}`);
const reference = settled.json?.booking?.reference;
check('booked', 'the MoMo payment settles into a confirmed booking', settled.json?.state === 'confirmed' && !!reference, `${settled.status} ${settled.text}`);
const bookingId = reference ? sql(`select id from bookings where reference = '${reference}'`) : '';
const guestName = sql(`select coalesce(vi.legal_full_name, u.name) from users u left join verified_identities vi on vi.user_id = u.id where u.email = '${GUEST}'`);

// --- 2. The desk checks them in ------------------------------------------------------------
console.log('\n2. The desk checks the guest in');
const roomId = sql(
  `select r.id from rooms r where r.room_type_id = '${SUITE}' and r.status = 'available'
     and not exists (select 1 from guest_stays s where s.room_id = r.id and s.actual_exit_at is null) limit 1`,
);
const checkedIn = await call(desk, 'POST', `/ops/stays/${bookingId}/checkin`, { roomId });
const stayId = checkedIn.json?.id;
check('checked-in', 'POST /ops/stays/:id/checkin opens the stay', checkedIn.status === 201 && !!stayId, `${checkedIn.status} ${checkedIn.text}`);

// --- 3. The register --------------------------------------------------------------------
console.log('\n3. The check in files the guest for local government');
const filed = sql(
  `select host_kind || '|' || coalesce(village_id::text, '') || '|' || coalesce(sector_id::text, '') || '|' || nationality
     from guest_registrations where guest_stay_id = '${stayId}'`,
);
check('filed', 'one hotel registration at the guesthouse village and sector', filed === `hotel|${PLACE.villageId}|${PLACE.sectorId}|RW` || filed.startsWith(`hotel|${PLACE.villageId}|${PLACE.sectorId}|`), filed || '(none)');
const roles = sql(
  `select string_agg(r.recipient_role::text, ',' order by r.step) from guest_registration_routes r
     join guest_registrations g on g.id = r.registration_id where g.guest_stay_id = '${stayId}'`,
);
check('routed', 'routed to the village leader, the cell executive and the district officer', ['village_leader', 'cell_executive', 'district_officer'].every((r) => roles.includes(r)), roles);

// --- 4. Each leader sees them -----------------------------------------------------------
console.log('\n4. Each leader sees the guest');
for (const l of LEADERS) {
  const s = await sessionFor(l.email);
  const list = await call(s, 'GET', '/oversight/guests?tab=staying');
  const row = (list.json?.guests ?? []).find((g) => g.fullName === guestName);
  check(`${l.role}-list`, `${l.role}'s guest list holds ${guestName}, as a hotel guest`, !!row && row.relationshipLabel === 'Hotel guest', `${list.status} ${list.text}`);
  const report = await call(s, 'GET', `/oversight/guests/reports?from=${today}&to=${today}`);
  const hotel = (report.json?.byRelationship ?? []).find((r) => r.code === 'hotel_guest');
  check(`${l.role}-report`, `${l.role}'s report counts the hotel guest`, (report.json?.totals?.registered ?? 0) >= 1 && (hotel?.count ?? 0) >= 1, `${report.status} ${report.text}`);
}

// --- 5. Once ------------------------------------------------------------------------------
console.log('\n5. Once per stay');
await call(desk, 'POST', `/ops/stays/${bookingId}/checkin`, { roomId });
check('once', 'checking in again files nothing more', sql(`select count(*) from guest_registrations where guest_stay_id = '${stayId}'`) === '1');

console.log(failed ? `\n${failed} check(s) failed.` : '\nAll checks passed.');
process.exit(failed ? 1 : 0);
