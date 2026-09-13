// Verify `GET /api/v1/me/trips` end to end — the guest's own stays.
//
// The fifth verify script. Like `verify-walk-in.mjs` it WRITES, and for the same
// reason: the thing being proved is that a booking a guest makes comes back to
// that guest, so it has to make one. A booking is never deleted afterwards —
// the money and the receipt behind it have to stay readable — so this leaves one
// confirmed stay behind and says so at the end.
//
// WHAT IT PROVES, in order:
//   1. The route exists and answers a signed-in guest with a list. Before this
//      endpoint, `/trips` in `apps/web` was a hardcoded empty state, so a guest
//      who had just paid was shown "No trips yet".
//   2. A booking made through the real `POST /bookings` appears in it, with the
//      reference the guest was shown and the price that was LOCKED at sale —
//      not a number this endpoint recomputed (D8, ui-rules.md § Money & Dates).
//   3. The property and room type come back NAMED, from the database, which is
//      what lets a trip card render without a fixture.
//   4. The stage is derived server-side against the property's calendar day:
//      a stay three weeks out reads `upcoming`.
//   5. **A second guest cannot see it.** The query is scoped by the session's
//      user id, and this is the check that would fail loudest if that ever
//      stopped being true.
//   6. A signed-out caller is refused 401 rather than shown an empty list, which
//      would read as "you have no trips" to somebody whose session had lapsed.
//
// Run against a database you control, never the shared one:
//   VERIFY_API_URL=http://localhost:8000 node scripts/verify-my-trips.mjs
const API = process.env.VERIFY_API_URL || 'http://localhost:8000';
const OTP = process.env.VERIFY_OTP_CODE || '123456';

/** The guest who books. */
const GUEST = process.env.VERIFY_GUEST_EMAIL || 'guest@injishi.com';
/** Somebody else entirely, who must never see the booking above. */
const OTHER = process.env.VERIFY_OTHER_EMAIL || 'broker@injishi.com';
/** An operator, used only to find a room that is actually on sale. */
const OPERATOR = process.env.VERIFY_OPERATOR_EMAIL || 'host@injishi.com';

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
  if (!res.ok) {
    // A 400 here is usually the OTP send cap: 5 codes an hour per identifier
    // (ADR-039), and each run of this script spends one per identity. That is
    // the cap working; say so rather than reading as a broken endpoint.
    const hint =
      res.status === 400
        ? ' — likely the OTP send cap (5 per identifier per hour, ADR-039).' +
          ' Wait for the window, or point the script at another seeded identity.'
        : '';
    throw new Error(`${email}: sign-in ${res.status}${hint}`);
  }
  const cookie = jar(res);

  // Harmless for a plain guest (no step-up is required of one) and necessary for
  // the operator, whose grants put the emailed code in front of the workspace.
  await fetch(`${API}/api/v1/me/two-factor/send`, { method: 'POST', headers: { cookie } });
  await fetch(`${API}/api/v1/me/two-factor/verify`, {
    method: 'POST',
    headers: { cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: OTP }),
  });

  const me = await fetch(`${API}/api/v1/me/workspaces`, { headers: { cookie } });
  const body = await me.json().catch(() => ({}));
  const ws = (body.workspaces ?? []).find((w) => w.kind === 'business');
  return { cookie, workspaceId: ws?.workspaceId ?? null };
}

const get = (s, path) =>
  fetch(`${API}/api/v1${path}`, {
    headers: { cookie: s.cookie, ...(s.workspaceId ? { 'x-workspace-id': s.workspaceId } : {}) },
  });

const post = (s, path, body) =>
  fetch(`${API}/api/v1${path}`, {
    method: 'POST',
    headers: {
      cookie: s.cookie,
      'Content-Type': 'application/json',
      ...(s.workspaceId ? { 'x-workspace-id': s.workspaceId } : {}),
    },
    body: JSON.stringify(body),
  });

/** yyyy-mm-dd, `days` from today in Kigali — the zone the booking rules use. */
function day(days) {
  const at = new Date(Date.now() + days * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kigali' }).format(at);
}

const trips = async (s) => {
  const res = await get(s, '/me/trips');
  const body = await res.json().catch(() => ({}));
  return { status: res.status, list: body.trips ?? [] };
};

console.log(`Verifying GET /api/v1/me/trips against ${API}\n`);

// --- A room that is actually on sale ----------------------------------------

console.log(`Finding a bookable room (as ${OPERATOR})`);
const operator = await sessionFor(OPERATOR);
check('the operator holds a business workspace', Boolean(operator.workspaceId));

// `PropertyQuery` is `WorkspaceScoped`, so the id goes in the query string as
// well as in the header — the guard reads the header, the contract reads the query.
const propsRes = await get(
  operator,
  `/inventory/properties?workspaceId=${operator.workspaceId}`,
);
const propsBody = await propsRes.json().catch(() => ({}));
const property = (propsBody.properties ?? [])[0];
check('GET /inventory/properties answers with a property', Boolean(property), `got ${propsRes.status}`);
if (!property) {
  console.log('\nNo inventory to book. Seed a property with a priced room type first.');
  process.exit(1);
}

const detailRes = await get(
  operator,
  `/inventory/properties/${property.id}?workspaceId=${operator.workspaceId}`,
);
const detail = await detailRes.json().catch(() => ({}));
const room = (detail.roomTypes ?? []).find((rt) => rt.basePriceRwf || rt.nightlyRateRwf);
check('the property has a priced room type', Boolean(room), `got ${detailRes.status}`);
if (!room) {
  console.log('\nNo priced room type. A room with no price is not bookable by design.');
  process.exit(1);
}

// --- The guest's own list ----------------------------------------------------

console.log(`\n${GUEST} — the list answers before anything is booked`);
const guest = await sessionFor(GUEST);
const before = await trips(guest);
check('GET /me/trips answers 200', before.status === 200, `got ${before.status}`);
check('it answers with a list', Array.isArray(before.list));

console.log('\nThe guest books the room, through the real booking route');
/*
 * The first free three-night window from three weeks out. A room type may have
 * a single unit, and an earlier run of this script (which never deletes its
 * booking) holds it, so a 409 moves the stay along rather than failing.
 *
 * And the answer is a PAYMENT, not yet a booking (ADR-047 D-j): a mobile money
 * capture comes back `awaiting_payment` and the reservation is written when the
 * money settles. So the attempt is polled, as the checkout polls it, until it
 * is confirmed and carries the booking.
 */
let checkIn;
let checkOut;
let created;
let outcome = {};
for (let offset = 21; offset < 21 + 3 * 12; offset += 3) {
  checkIn = day(offset);
  checkOut = day(offset + 3);
  created = await post(guest, '/bookings', {
    roomTypeId: room.id,
    checkIn,
    checkOut,
    guests: 2,
    nonRefundable: false,
    attemptToken: crypto.randomUUID(),
    instrument: { kind: 'mobile_money', network: 'mtn_momo', msisdn: '788123456' },
  });
  outcome = await created.json().catch(() => ({}));
  if (created.status !== 409) break;
}
check('POST /bookings answers 201', created.status === 201, `got ${created.status} ${JSON.stringify(outcome).slice(0, 200)}`);
if (created.status !== 201) {
  console.log(`\n${failures} check(s) failed.`);
  process.exit(1);
}
let booking = outcome.status === 'confirmed' ? outcome.booking : null;
if (outcome.status === 'awaiting_payment') {
  const deadline = Date.now() + 60_000;
  while (!booking && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2_000));
    const polled = await get(guest, `/bookings/attempts/${outcome.attempt.attemptToken}`);
    const attempt = await polled.json().catch(() => ({}));
    if (attempt.state === 'confirmed') booking = attempt.booking;
    else if (attempt.state === 'refused' || attempt.state === 'expired') break;
  }
}
check('the payment settles into a booking', Boolean(booking?.reference), `outcome ${outcome.status}`);
if (!booking?.reference) {
  console.log(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log(`  booked ${booking.reference} — ${checkIn} to ${checkOut}`);

console.log('\nIt comes back to the guest who made it');
const after = await trips(guest);
const mine = after.list.find((t) => t.reference === booking.reference);
check('the new booking is in GET /me/trips', Boolean(mine));
check(
  'the price is the one locked at sale, not a recomputed one',
  mine?.grossRwf === booking.breakdown?.grossRwf,
  `trip ${mine?.grossRwf} vs booking ${booking.breakdown?.grossRwf}`,
);
check('the property is named, from the database', Boolean(mine?.propertyName), `got ${mine?.propertyName}`);
check('the room type is named', Boolean(mine?.roomTypeName), `got ${mine?.roomTypeName}`);
check('the dates are the ones booked', mine?.checkIn === checkIn && mine?.checkOut === checkOut);
check('three nights', mine?.nights === 3, `got ${mine?.nights}`);
check(
  'a stay three weeks out reads as upcoming',
  mine?.stage === 'upcoming',
  `got ${mine?.stage}`,
);
check('it carries its own timezone for formatting', Boolean(mine?.timezone), `got ${mine?.timezone}`);

// --- The property the whole endpoint rests on --------------------------------

console.log(`\n${OTHER} — somebody else's list does NOT contain it`);
const other = await sessionFor(OTHER);
const theirs = await trips(other);
check('their list answers 200', theirs.status === 200, `got ${theirs.status}`);
check(
  "the other guest cannot see this booking",
  !theirs.list.some((t) => t.reference === booking.reference),
  'a booking leaked across guests — the query scope is broken',
);

console.log('\nSigned out, it is refused rather than emptied');
const anon = await fetch(`${API}/api/v1/me/trips`);
check('an anonymous read is 401', anon.status === 401, `got ${anon.status}`);

console.log(
  `\nLeft behind on purpose: booking ${booking.reference} for ${GUEST}, confirmed, ` +
    'with its escrow. A booking is never deleted — the money and the receipt ' +
    'behind it have to stay readable.',
);

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
