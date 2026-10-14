// Verify self check-in before arrival over real HTTP (F-B09, ADR-060): the ID
// photo a guest sends from the phone reaches the booking, and the desk's
// check-in carries it onto the stay.
//
// The guest calls the API the way the mobile client does: a BEARER token from
// sign-in's `set-auth-token` header, the photo through `POST /api/v1/uploads`
// as `kind=id_photo` in multipart, then the JSON check-in naming its key.
//
// WHAT IT PROVES:
//   A. A fresh guest holds a confirmed Standard Room booking nobody else is
//      using (written directly; see section A for why).
//   B. The photo uploads as an id_photo, over bearer auth.
//   C. The guest's check-in is accepted and stored against the booking, the
//      photo linked by its stored object.
//   D. Another guest is told the booking does not exist; a photo someone else
//      uploaded is refused at its field.
//   E. The desk checks the guest in, and the stay's identity carries the
//      document number and the photo the guest sent.
//   F. The desk checks the guest out again, so the room is free for next run.
//
// WRITES: a guest, a booking, a stay (checked out), one photo. SAMPLE only.
//   node --env-file=.env scripts/verify-self-check-in.mjs
import { randomBytes, randomUUID } from 'node:crypto';

import pg from 'pg';

const API = process.env.VERIFY_API_URL || 'http://127.0.0.1:8000';
const OTP = process.env.VERIFY_OTP_CODE || '123456';
const OPERATOR = process.env.VERIFY_OPERATOR_EMAIL || 'host@injishi.com';
const ROOM_TYPE = process.env.VERIFY_REQUEST_ROOM_TYPE || '0f9a1b00-0000-4000-8000-000000000101';
const RUN = Date.now().toString(36);

let failures = 0;
function check(label, ok, detail) {
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : `   ${detail}`}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function signIn(email) {
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
  if (!res.ok) throw new Error(`${email}: sign-in ${res.status}`);
  return {
    token: res.headers.get('set-auth-token'),
    cookie: (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; '),
  };
}

/** The mobile client's identity: the bearer token alone. */
const bearer = (s) => ({ Authorization: `Bearer ${s.token}` });

async function operatorSession() {
  const s = await signIn(OPERATOR);
  await fetch(`${API}/api/v1/me/two-factor/send`, { method: 'POST', headers: { cookie: s.cookie } });
  await fetch(`${API}/api/v1/me/two-factor/verify`, {
    method: 'POST',
    headers: { cookie: s.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: OTP }),
  });
  const me = await (await fetch(`${API}/api/v1/me/workspaces`, { headers: { cookie: s.cookie } })).json();
  const ws = (me.workspaces ?? []).find((w) => w.kind === 'business');
  return { cookie: s.cookie, workspaceId: ws?.workspaceId };
}

async function call(headers, method, path, body) {
  const res = await fetch(`${API}/api/v1${path}`, {
    method,
    headers: { ...headers, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}

async function upload(headers, bytes) {
  const form = new FormData();
  form.append('kind', 'id_photo');
  form.append('attemptToken', randomUUID());
  form.append('file', new Blob([bytes], { type: 'image/jpeg' }), 'id.jpg');
  const res = await fetch(`${API}/api/v1/uploads`, { method: 'POST', headers, body: form });
  return { status: res.status, json: await res.json().catch(() => null) };
}

const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kigali' }).format(new Date());

async function freeWindow() {
  for (let offset = 200 + Math.floor(Math.random() * 200); offset < 900; offset += 60) {
    const from = addDays(today, offset);
    const res = await fetch(`${API}/api/v1/room-types/${ROOM_TYPE}/availability?from=${from}&to=${addDays(from, 40)}`);
    const nights = (await res.json()).nights ?? [];
    for (let i = 0; i + 1 < nights.length; i += 3) {
      if (nights[i].freeUnits >= 1 && nights[i + 1].freeUnits >= 1) return [nights[i].night, addDays(nights[i].night, 2)];
    }
  }
  throw new Error('No free two-night window for the Standard Room.');
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const q = async (text, params = []) => (await db.query(text, params)).rows;

try {
  const guest = await signIn(`checkin-guest-${RUN}@verify.injishi.rw`);
  const stranger = await signIn(`checkin-stranger-${RUN}@verify.injishi.rw`);
  const desk = await operatorSession();
  const deskHeaders = { cookie: desk.cookie, 'x-workspace-id': desk.workspaceId };

  console.log('A. a confirmed booking of our own');
  // Written directly rather than booked and paid: the paid path settles
  // through the queue worker, which needs Redis, and this proof is about what
  // happens AFTER a booking is confirmed. The row is marked as this proof's own
  // (reference VERIFY-SCI-…), dated far ahead, and belongs to a fresh guest.
  const [checkIn, checkOut] = await freeWindow();
  const [guestRow] = await q('select id from users where email = $1', [`checkin-guest-${RUN}@verify.injishi.rw`]);
  const [booking] = await q(
    `insert into bookings (reference, room_type_id, guest_user_id, workspace_id, check_in, check_out, guest_count,
                           status, booking_mode, locked_nightly_rate_rwf, gross_rwf, payment_status, confirmed_at)
     select $1, rt.id, $2, p.workspace_id, $3, $4, 1, 'confirmed', 'request_to_book', 50000, 100000, 'captured', now()
       from room_types rt join properties p on p.id = rt.property_id where rt.id = $5
     returning id`,
    [`VERIFY-SCI-${RUN}`.toUpperCase(), guestRow?.id, checkIn, checkOut, ROOM_TYPE],
  );
  check('a confirmed booking belonging to the guest', Boolean(booking?.id));

  console.log('B. the photo, over bearer auth');
  const photo = await upload(bearer(guest), randomBytes(10_000));
  check('uploaded as an id_photo', photo.status === 201 && photo.json?.objectKey?.startsWith('id_photo/'), JSON.stringify(photo.json));

  console.log('C. the check-in');
  const documentNumber = `119928${String(2_000_000 + Math.floor(Math.random() * 7_000_000))}551`;
  const request = {
    document: { documentType: 'national_id', documentNumber, issuingCountry: 'RW' },
    idPhotoObjectKey: photo.json.objectKey,
    addressText: 'KG 11 Ave, Kigali',
  };
  const sent = await call(bearer(guest), 'POST', `/me/bookings/${booking.id}/check-in`, request);
  check('accepted, photo stored', sent.status === 200 && sent.json?.idPhotoStored === true && sent.json?.bookingId === booking.id, sent.text);
  const [held] = await q(
    `select p.document_number, s.object_key from pre_arrival_identities p join stored_objects s on s.id = p.id_photo_object_id where p.booking_id = $1`,
    [booking.id],
  );
  check('kept against the booking, the photo linked', held?.document_number === documentNumber && held?.object_key === photo.json.objectKey, JSON.stringify(held));

  console.log('D. nobody else');
  const foreign = await call(bearer(stranger), 'POST', `/me/bookings/${booking.id}/check-in`, request);
  check("another guest is told the booking does not exist", foreign.status === 404, `${foreign.status}`);
  const theirs = await upload(bearer(stranger), randomBytes(9_000));
  const borrowed = await call(bearer(guest), 'POST', `/me/bookings/${booking.id}/check-in`, { ...request, idPhotoObjectKey: theirs.json?.objectKey });
  check('a photo someone else uploaded is refused at its field', borrowed.status === 400 && /idPhotoObjectKey/.test(borrowed.text), borrowed.text);

  console.log('E. the desk checks the guest in');
  const [room] = await q(`select id from rooms where room_type_id = $1 and status = 'available' order by label limit 1`, [ROOM_TYPE]);
  const stay = await call(deskHeaders, 'POST', `/ops/stays/${booking.id}/checkin`, { roomId: room?.id });
  check('checked in', stay.status < 300 && stay.json?.id, `${stay.status} ${stay.text.slice(0, 200)}`);
  const [carried] = await q(
    `select i.id_number, s.object_key from stay_identities i join guest_stays g on g.id = i.guest_stay_id
       left join stored_objects s on s.id = i.id_photo_object_id where g.booking_id = $1`,
    [booking.id],
  );
  check('the stay carries the document and the photo the guest sent', carried?.id_number === documentNumber && carried?.object_key === photo.json.objectKey, JSON.stringify(carried));

  console.log('F. and out again');
  const out = await call(deskHeaders, 'POST', `/ops/stays/${stay.json?.id}/checkout`, {});
  check('checked out, the room free for the next run', out.status < 300, `${out.status} ${out.text.slice(0, 200)}`);
} finally {
  await db.end();
}

console.log(failures === 0 ? '\nCHECKIN PHOTO VERIFIED' : `\n${failures} FAILED`);
process.exitCode = failures === 0 ? 0 : 1;
