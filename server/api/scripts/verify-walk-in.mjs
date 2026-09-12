// Verify the walk in command end to end (ADR-035).
//
// The fourth verify script, and the first that WRITES. The others read, because
// a read proves the whole path without leaving rows behind. This one cannot:
// the thing being proved is that a stay comes into existence for somebody with
// no booking, so it makes one, checks it back out, and says what it left.
//
// WHAT IT PROVES, in order:
//   1. A receptionist can walk somebody in. `stay.checkin` is the permission,
//      the same one an ordinary check in carries, because a walk in is not a
//      lesser act — it puts a stranger in a room and opens a bill.
//   2. The stay comes back from `GET /ops/stays` with the NAME, which is the
//      whole reason migration 0023 exists: the name used to come only from a
//      `users` row and a walk in has none.
//   3. `bookingId` is null. A walk in is a stay with no booking, not a stay
//      with a flag, and every reader in the app tells them apart that way.
//   4. A bill opened against it. A walk in that got no folio would be a guest
//      nobody could charge, which is most of what a walk in is.
//   5. The room is refused to a SECOND walk in while the first is in it. This
//      is the race a busy desk creates, and a walk in is more exposed to it
//      than a reservation: nothing held the room in advance.
//
// Run against a database you control, never the shared one:
//   VERIFY_API_URL=http://localhost:8000 node scripts/verify-walk-in.mjs
const API = process.env.VERIFY_API_URL || 'http://localhost:8000';
const OTP = process.env.VERIFY_OTP_CODE || '123456';

let failures = 0;
function check(label, ok, detail) {
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : `   ${detail}`}`);
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
  if (!res.ok) throw new Error(`${email}: sign-in ${res.status}`);
  const cookie = jar(res);

  await fetch(`${API}/api/v1/me/two-factor/send`, { method: 'POST', headers: { cookie } });
  await fetch(`${API}/api/v1/me/two-factor/verify`, {
    method: 'POST',
    headers: { cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: OTP }),
  });

  const me = await fetch(`${API}/api/v1/me/workspaces`, { headers: { cookie } });
  const body = await me.json();
  const ws = (body.workspaces ?? []).find((w) => w.kind === 'business');
  return { cookie, workspaceId: ws?.workspaceId ?? null };
}

function get(s, path) {
  return fetch(`${API}/api/v1${path}`, {
    headers: { cookie: s.cookie, 'x-workspace-id': s.workspaceId },
  });
}

function post(s, path, body) {
  return fetch(`${API}/api/v1${path}`, {
    method: 'POST',
    headers: {
      cookie: s.cookie,
      'x-workspace-id': s.workspaceId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

console.log(`Verifying the walk in command against ${API}\n`);

// The receptionist, deliberately, rather than the owner. `stay.checkin` is a
// front desk permission and the desk is who does this.
const desk = await sessionFor('reception@injishi.rw');
if (!desk.workspaceId) throw new Error('the receptionist holds no business workspace');

const roomsRes = await get(desk, '/ops/rooms');
const { rooms } = await roomsRes.json();
const free = rooms.find((r) => r.status === 'available' && r.occupiedBy === null);
if (!free) throw new Error('no free room to walk somebody into');

const name = `Walk-in Verify ${Date.now()}`;

console.log('A guest with no booking is checked in');
const walkRes = await post(desk, '/ops/stays/walk-in', {
  roomId: free.id,
  guestName: name,
});
const walk = await walkRes.json();
check('POST /ops/stays/walk-in answers 201', walkRes.status === 201, `got ${walkRes.status}`);
check('the stay carries the name', walk.guestName === name, JSON.stringify(walk.guestName));
check('bookingId is null — a walk in has no booking', walk.bookingId === null);
check('it is open', walk.lifecycle === 'open');
check('it is in the room the desk named', walk.roomId === free.id);

console.log('\nThe stay reads back from the list');
const listRes = await get(desk, '/ops/stays');
const { stays } = await listRes.json();
const found = stays.find((s) => s.id === walk.id);
check('GET /ops/stays returns it', Boolean(found));
check('with the name, from the stay rather than an account', found?.guestName === name);

console.log('\nA bill opened against it');
const foliosRes = await get(desk, '/ops/folios');
const { folios } = await foliosRes.json();
const bill = folios.find((f) => f.guestStayId === walk.id);
check('GET /ops/folios carries a folio for this stay', Boolean(bill));

console.log('\nThe room is refused to a second walk in');
const clashRes = await post(desk, '/ops/stays/walk-in', {
  roomId: free.id,
  guestName: 'Should Not Happen',
});
check('the second is refused', clashRes.status === 409, `got ${clashRes.status}`);

console.log('\nA name is required — there is no account to read one from');
const namelessRes = await post(desk, '/ops/stays/walk-in', { roomId: free.id });
check('an empty request is refused', namelessRes.status === 400, `got ${namelessRes.status}`);

console.log('\nCleaning up: the guest checks out');
const outRes = await post(desk, `/ops/stays/${walk.id}/checkout`, {});
check('checkout answers', outRes.status === 201, `got ${outRes.status}`);

console.log(
  `\nLeft behind on purpose: stay ${walk.id} (closed) and its folio. ` +
    'A stay is never deleted — the bill against it has to stay readable.',
);

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
