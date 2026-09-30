#!/usr/bin/env node
/**
 * ADR-050 D-q, END TO END over HTTP, for the guest who has BOOKED and NOT YET
 * ARRIVED — and for what that guest could not do before this existed.
 *
 * `verify-guest-department-chat.mjs` proves the in-house loop: a guest with an
 * open stay messages a desk, the desk answers, an order placed from the
 * conversation writes its lines. Every route it uses hangs off `guest_stays`,
 * so a person who had paid for a room and not yet walked into it could reach no
 * department of the property at all. Their inbox held one `reservation` thread
 * per booking, `departmentName: null`, and there was no call they could make to
 * start another. This script proves the three things that changed:
 *
 *  - `GET /me/departments` lists every property the caller is in house at OR
 *    holds a live booking with, each with the desks that property opened to
 *    guests, and `POST /me/threads` opens one of those conversations by naming
 *    the DEPARTMENT alone — the server resolves whether it hangs off a stay or
 *    a booking. A second identical call resumes the same thread rather than
 *    opening a second one;
 *  - ordering into a thread is decided by the server's own outlet policy and
 *    nothing else, so a RESERVATION thread — the only thread most guests have —
 *    takes an order exactly when `GET /me/orderable` says that outlet is
 *    orderable for that caller;
 *  - `GET /ops/threads?departmentId=` answers with one department's
 *    conversations, so a desk can find its own.
 *
 * NO DATABASE ACCESS. Everything goes through HTTP as the demo personas, so the
 * same script runs against a laptop and against the live demo:
 *
 *   node scripts/verify-guest-post-booking.mjs --api http://127.0.0.1:8071
 *   node scripts/verify-guest-post-booking.mjs --api https://api-demo.injishi.com --live
 *   node scripts/verify-guest-post-booking.mjs --api http://127.0.0.1:8071 --only desks
 *
 * `--only desks|order|ops-filter` runs one section and prints that section's
 * marker; with no `--only` all three run and the run prints
 * `GUEST POST BOOKING: ALL CHECKS PASSED`. A marker is printed ONLY after every
 * assertion of its section passed AND the section reached its last line, so a
 * section that returned early can never read as a pass.
 *
 * It needs a DEMO process (the fixed sign in code) over the seeded demo hotel:
 * `rayan@demo.injishi.com` holding live bookings and NO open stay,
 * `samuel@demo.injishi.com` in house at Amahoro Boutique Hotel with an open
 * bill, and `solange@demo.injishi.com` managing that property. Nothing is
 * hard-coded about which property or which desk: every id is read back from the
 * API, so a reseed that moves the storyline around does not break the script.
 * `--live` sends the Origin header the deployed API's CORS and CSRF checks
 * expect. It leaves a handful of conversations and one delivered order behind,
 * which the nightly reset removes.
 */
import { randomUUID } from 'node:crypto';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : (args[i + 1] ?? null);
};
const API = (flag('--api') || process.env.VERIFY_API_URL || 'http://127.0.0.1:8071').replace(/\/$/, '');
const LIVE = args.includes('--live');
const ORIGIN = flag('--origin') || (LIVE ? 'https://www-demo.injishi.com' : null);
const CODE = process.env.VERIFY_OTP_CODE || '123456';
/** Booked, not arrived: the person this whole slice exists for. */
const BOOKED = process.env.VERIFY_BOOKED_GUEST || 'rayan@demo.injishi.com';
/** In house, with an open bill, so `chargeToRoom` is a real answer. */
const IN_HOUSE = process.env.VERIFY_GUEST || 'samuel@demo.injishi.com';
const STAFF = process.env.VERIFY_STAFF || 'solange@demo.injishi.com';
const ONLY = flag('--only');
const RUN = new Date().toISOString().slice(11, 19);

const SECTIONS = {
  desks: 'GUEST POST BOOKING DESKS: PASSED',
  order: 'GUEST POST BOOKING ORDER: PASSED',
  'ops-filter': 'OPS DEPARTMENT FILTER: PASSED',
};

let failures = 0;
/** Set only when `main` reaches its last line, so an early return can never read as a pass. */
let finished = false;

function check(label, ok, detail) {
  if (!ok) failures += 1;
  console.log(
    `  ${ok ? 'PASS' : 'FAIL'}  ${label}${
      ok || detail === undefined
        ? ''
        : `   ${typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 400)}`
    }`,
  );
}

function baseHeaders(extra = {}) {
  return { ...(ORIGIN ? { Origin: ORIGIN } : {}), ...extra };
}

function cookiesOf(res) {
  return (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
}

async function signIn(email, { staff = false } = {}) {
  const sent = await fetch(`${API}/api/auth/email-otp/send-verification-otp`, {
    method: 'POST',
    headers: baseHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ email, type: 'sign-in' }),
  });
  if (!sent.ok) throw new Error(`${email}: code send ${sent.status} ${await sent.text()}`);
  const res = await fetch(`${API}/api/auth/sign-in/email-otp`, {
    method: 'POST',
    headers: baseHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ email, otp: CODE }),
  });
  if (!res.ok) throw new Error(`${email}: sign-in ${res.status} ${await res.text()}`);
  const who = { email, cookie: cookiesOf(res), workspaceId: null };

  if (staff) {
    const status = await call(who, 'GET', '/me/two-factor');
    if (!status.body?.verified) {
      const stepSent = await call(who, 'POST', '/me/two-factor/send');
      if (stepSent.status >= 300) throw new Error(`${email}: step-up send ${stepSent.status}`);
      const verified = await call(who, 'POST', '/me/two-factor/verify', { code: CODE });
      if (verified.status >= 300) {
        throw new Error(`${email}: step-up ${verified.status} ${JSON.stringify(verified.body)}`);
      }
    }
    const mine = await call(who, 'GET', '/me/workspaces');
    who.workspaceId =
      (mine.body?.workspaces ?? []).find((w) => w.kind === 'business' && w.domain === 'hospitality')
        ?.workspaceId ?? null;
    if (!who.workspaceId) throw new Error(`${email}: holds no hospitality workspace`);
  }
  return who;
}

async function call(who, method, path, body, extraHeaders = {}) {
  const headers = baseHeaders({ cookie: who.cookie, ...extraHeaders });
  if (who.workspaceId) headers['x-workspace-id'] = who.workspaceId;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}/api/v1${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed };
}

async function guestLines(guest, threadId) {
  const page = await call(guest, 'GET', `/me/threads/${threadId}/messages?limit=100`);
  return page.body?.messages ?? [];
}

const placesOf = async (guest) => (await call(guest, 'GET', '/me/departments')).body?.places ?? [];
const threadsOf = async (guest) => (await call(guest, 'GET', '/me/threads')).body?.threads ?? [];

/** Sign in once per persona per run, whichever sections ask for them. */
const cast = {};
async function actor(email, options) {
  cast[email] ??= await signIn(email, options);
  return cast[email];
}

/* -------------------------------------------------------------------------- */
/* 1. desks: a booked, not-yet-arrived guest reaches a department              */
/* -------------------------------------------------------------------------- */

async function desks() {
  const guest = await actor(BOOKED);
  const staff = await actor(STAFF, { staff: true });
  const inHouseGuest = await actor(IN_HOUSE);

  // The precondition IS the point of this section: check it, never assume it.
  const stays = (await call(guest, 'GET', '/me/stays')).body?.stays ?? [];
  check(
    'the guest has booked and NOT arrived (no open stay)',
    stays.every((s) => s.lifecycle !== 'open'),
    stays.map((s) => `${s.propertyName}:${s.lifecycle}`),
  );
  const trips = (await call(guest, 'GET', '/me/trips')).body?.trips ?? [];
  const liveTrips = trips.filter((t) => t.stage === 'upcoming' || t.stage === 'in_progress');
  check('the guest holds a live booking', liveTrips.length > 0, trips.map((t) => `${t.propertyName}:${t.stage}`));
  if (liveTrips.length === 0) return false;

  // The desks the property has opened to guests, at every place they may write to.
  const places = await placesOf(guest);
  const booked = places.filter((p) => p.context === 'booking');
  check('/me/departments lists a property they have only booked', booked.length > 0, places);
  check(
    'every place it lists is one the guest is in house at or holds a live booking with',
    places.every((p) => p.inHouse || liveTrips.some((t) => t.propertyName === p.propertyName)),
    places.map((p) => `${p.propertyName}:${p.context}`),
  );
  check(
    'a booked place is not reported as in house, and names its booking',
    booked.every((p) => p.inHouse === false && typeof p.subjectId === 'string' && p.bookingReference !== null),
    booked.map((p) => `${p.propertyName}:${p.bookingReference}:${p.inHouse}`),
  );

  // Work at a property this staff persona actually covers, so the desk's own
  // inbox can be checked below. Read from the API rather than named here.
  const staffDepartments = (await call(staff, 'GET', '/ops/departments')).body?.departments ?? [];
  const staffProperties = new Set(staffDepartments.map((d) => d.propertyId));
  const place = booked.find((p) => p.departments.length > 0 && staffProperties.has(p.propertyId));
  check(
    'a booked place has desks, at a property the staff persona covers',
    Boolean(place),
    booked.map((p) => `${p.propertyName}: ${p.departments.map((d) => d.name).join(', ') || '(none)'}`),
  );
  if (!place) return false;
  const department = place.departments[0];
  console.log(`  ..    ${place.propertyName} (booked, arriving ${place.checkIn}): ${place.departments.map((d) => d.name).join(', ')}`);

  // 1. Open, then resume. A rerun finds the conversation already there, which is
  //    itself the resume rule, so `created` is checked against what the desk
  //    list said rather than against a constant.
  const existedBefore = department.threadId;
  const before = (await threadsOf(guest)).find((t) => t.id === existedBefore);
  const opened = await call(guest, 'POST', '/me/threads', {
    departmentId: department.id,
    subject: `Before we arrive (${RUN})`,
    body: `Hello ${department.name}, a verification message before check-in (${RUN}).`,
  });
  check('a desk conversation opens from a booking (201)', opened.status === 201, opened);
  const threadId = opened.body?.threadId;
  if (!threadId) return false;
  check(
    'it reports creating exactly when there was no conversation yet',
    opened.body.created === (existedBefore === null) &&
      (existedBefore === null || existedBefore === threadId),
    { created: opened.body.created, existedBefore, threadId },
  );
  check('the answer names the department it opened', opened.body.departmentName === department.name, opened.body);

  const again = await call(guest, 'POST', '/me/threads', {
    departmentId: department.id,
    body: `A second note to ${department.name} (${RUN}).`,
  });
  check(
    'a second request resumes the SAME conversation rather than opening a second',
    again.body?.threadId === threadId && again.body?.created === false,
    again.body,
  );

  const listed = await threadsOf(guest);
  const thread = listed.find((t) => t.id === threadId);
  check('the guest inbox lists it once', listed.filter((t) => t.id === threadId).length === 1, listed.length);
  check('the row names the department', thread?.departmentName === department.name, thread);
  check(
    'the row carries the property as an id, so a screen can ask what is orderable there',
    thread?.propertyId === place.propertyId,
    { rowPropertyId: thread?.propertyId, place: place.propertyId },
  );
  check(
    'both messages landed in it',
    thread.messageCount === (before?.messageCount ?? 0) + 2,
    { before: before?.messageCount ?? 0, after: thread.messageCount },
  );
  const deskAfter = (await placesOf(guest))
    .find((p) => p.propertyId === place.propertyId)
    ?.departments.find((d) => d.id === department.id);
  check('the desk list now points at the conversation', deskAfter?.threadId === threadId, deskAfter);

  // 2. The department sees it and answers.
  const opsRow = ((await call(staff, 'GET', '/ops/threads')).body?.threads ?? []).find((t) => t.id === threadId);
  check("the property's own inbox lists it with the department", opsRow?.departmentName === department.name, opsRow ?? 'not listed');
  const reply = await call(staff, 'POST', `/ops/threads/${threadId}/messages`, {
    body: `Hello from ${department.name}, we have you down for ${place.checkIn} (${RUN}).`,
  });
  check('a staff reply is accepted', reply.status === 201, reply);
  const seenReply = (await guestLines(guest, threadId)).find((m) => m.id === reply.body?.id);
  check(
    "the guest reads the reply, sided as the property's",
    Boolean(seenReply) && seenReply.fromUs === false,
    seenReply,
  );
  check('it is signed by the department, never the staffer (D-r)', seenReply?.senderName === department.name, seenReply?.senderName);

  // 3. Refusals.
  //    A booking that has ENDED opens nothing. This is the live-booking rule
  //    read off the API's own two answers: a property every one of whose trips
  //    is in the past must not appear among the places.
  const bookedNames = [...new Set(trips.map((t) => t.propertyName))];
  const endedOnly = bookedNames.filter((name) => !liveTrips.some((t) => t.propertyName === name));
  check('the guest has a property they booked in the past and no longer hold', endedOnly.length > 0, bookedNames);
  check(
    'a property whose bookings have all ended is not offered any more',
    endedOnly.every((name) => !places.some((p) => p.propertyName === name && !p.inHouse)),
    { endedOnly, places: places.map((p) => p.propertyName) },
  );

  //    And the SAME desk that just took a message is refused to somebody who
  //    holds no stay and no live booking at that property. Same department, so
  //    the only difference between the two callers is the booking, which is the
  //    rule under test; 403 rather than 404, because this desk plainly exists —
  //    it is simply not theirs to write to.
  const candidates = [
    { label: 'the in-house guest', who: inHouseGuest, places: await placesOf(inHouseGuest) },
    { label: "a member of the property's own staff, as a person", who: staff, places: await placesOf(staff) },
  ];
  const stranger = candidates.find((c) => !c.places.some((p) => p.propertyId === place.propertyId));
  check(
    'somebody is available who holds nothing at that property',
    Boolean(stranger),
    candidates.map((c) => `${c.label}: ${c.places.map((p) => p.propertyName).join(', ') || '(nowhere)'}`),
  );
  if (stranger) {
    const refused = await call(stranger.who, 'POST', '/me/threads', {
      departmentId: department.id,
      body: 'hello',
    });
    check(
      `the same desk is refused 403 to ${stranger.label}, who holds no live booking there`,
      refused.status === 403,
      refused,
    );
  }

  //    A department that exists at the guest's OWN property but which the
  //    property did not open to guests: 404, not 403, so a probe cannot map the
  //    property's internal structure.
  const closed = staffDepartments.find(
    (d) => d.propertyId === place.propertyId && (d.guestRequestable === false || d.status !== 'active'),
  );
  check(
    'the property has a desk it did not open to guests, to try',
    Boolean(closed),
    staffDepartments.filter((d) => d.propertyId === place.propertyId).map((d) => `${d.name}:${d.guestRequestable}`),
  );
  if (closed) {
    const refused = await call(guest, 'POST', '/me/threads', { departmentId: closed.id, body: 'hello' });
    check(`a desk that takes no guest messages is refused 404 (${closed.name})`, refused.status === 404, refused);
    check(
      'and it was never listed as one of the guest\'s desks in the first place',
      !place.departments.some((d) => d.id === closed.id),
    );
  }
  const unknown = await call(guest, 'POST', '/me/threads', { departmentId: randomUUID(), body: 'hello' });
  check('a department id that names nothing is refused 404', unknown.status === 404, unknown.status);
  const malformed = await call(guest, 'POST', '/me/threads', { departmentId: 'housekeeping', body: 'hello' });
  check('a body that is not a department id is refused before anything is read', malformed.status === 400 || malformed.status === 422, malformed.status);

  return true;
}

/* -------------------------------------------------------------------------- */
/* 2. order: the server's outlet policy decides, in any thread                 */
/* -------------------------------------------------------------------------- */

async function order() {
  const guest = await actor(IN_HOUSE);
  const other = await actor(BOOKED);

  // The RESERVATION thread — the one every booking gets at sale, and the only
  // conversation most guests have. Ordering from it used to be refused out of
  // hand by the client, whatever the server would have said.
  const threads = await threadsOf(guest);
  const reservation = threads.find((t) => t.kind === 'reservation' && t.propertyId);
  check('the guest holds a reservation thread that names its property', Boolean(reservation), threads.map((t) => `${t.kind}:${t.propertyId}`));
  if (!reservation) return false;

  // The server's verdict IS the outlet list, asked for that property by id —
  // which is the reason a thread carries `propertyId` at all.
  const orderable = (await call(guest, 'GET', `/me/orderable?propertyId=${reservation.propertyId}`)).body?.outlets ?? [];
  const outlet = orderable.find((o) => o.chargeToRoom) ?? orderable[0];
  check('the server offers an outlet at that property', Boolean(outlet), orderable.map((o) => o.name));
  if (!outlet) return false;
  check('every outlet it offers is at that property', orderable.every((o) => o.propertyId === reservation.propertyId));

  const item =
    outlet.categories.flatMap((c) => c.items).find((i) => (i.options ?? []).every((o) => !o.required)) ??
    outlet.categories[0]?.items[0];
  check('the outlet has something orderable on it', Boolean(item), outlet.name);
  if (!item) return false;

  const beforeLines = await guestLines(guest, reservation.id);
  const placed = await call(
    guest,
    'POST',
    '/me/orders',
    {
      outletId: outlet.id,
      context: outlet.chargeToRoom ? 'in_house_folio' : 'pay_now',
      threadId: reservation.id,
      items: [{ serviceItemId: item.id, quantity: 1 }],
      guestNote: `post-booking verification ${RUN}`,
    },
    { 'Idempotency-Key': randomUUID() },
  );
  check('an order placed into the RESERVATION thread is accepted', placed.status === 201, placed);
  const order = placed.body?.id ? placed.body : null;
  if (!order) return false;
  check('the order names the outlet the server offered', order.outletId === outlet.id, order.outletId);

  const lines = await guestLines(guest, reservation.id);
  const line = lines.find((m) => m.serviceOrderId === order.id);
  check(
    'the conversation gains a system line carrying the order',
    line?.bodyType === 'system' && line.senderUserId === null && line.body.includes(order.orderNumber),
    line,
  );
  check('the order was filed against THIS thread', lines.length === beforeLines.length + 1, {
    before: beforeLines.length,
    after: lines.length,
  });
  const afterThreads = await threadsOf(guest);
  check(
    'the order is a card in the conversation, never a thread of its own',
    afterThreads.length === threads.length,
    { before: threads.length, after: afterThreads.length },
  );

  // A guest the server does not offer that outlet to cannot order it, even in
  // their own conversation at that same property. The policy is the control;
  // the thread is not a way round it.
  const theirThread = (await threadsOf(other)).find((t) => t.propertyId === reservation.propertyId);
  check('the other guest holds a conversation at the same property', Boolean(theirThread));
  if (theirThread) {
    const theirs = (await call(other, 'GET', `/me/orderable?propertyId=${reservation.propertyId}`)).body?.outlets ?? [];
    const closed = orderable.find((o) => !theirs.some((t) => t.id === o.id));
    check(
      'the server offers this guest an outlet it does not offer the other',
      Boolean(closed),
      { mine: orderable.map((o) => o.name), theirs: theirs.map((o) => o.name) },
    );
    if (closed) {
      const closedItem = closed.categories.flatMap((c) => c.items)[0];
      const refused = await call(
        other,
        'POST',
        '/me/orders',
        {
          outletId: closed.id,
          context: 'in_house_folio',
          threadId: theirThread.id,
          items: [{ serviceItemId: closedItem.id, quantity: 1 }],
        },
        { 'Idempotency-Key': randomUUID() },
      );
      check(
        `ordering an outlet the server does not offer them is refused (${closed.name})`,
        refused.status === 403 || refused.status === 409,
        refused,
      );
    }
  }

  const intoTheirs = await call(
    other,
    'POST',
    '/me/orders',
    {
      outletId: outlet.id,
      context: 'pay_now',
      threadId: reservation.id,
      items: [{ serviceItemId: item.id, quantity: 1 }],
    },
    { 'Idempotency-Key': randomUUID() },
  );
  check("ordering into another person's conversation is refused", intoTheirs.status === 404 || intoTheirs.status === 403, intoTheirs);

  return true;
}

/* -------------------------------------------------------------------------- */
/* 3. ops-filter: a department finds its own conversations                     */
/* -------------------------------------------------------------------------- */

async function opsFilter() {
  const guest = await actor(IN_HOUSE);
  const staff = await actor(STAFF, { staff: true });

  // Make sure two departments have a conversation, so "only that one" is a
  // claim with something to exclude. Opened through the guest surface, because
  // a fixture written another way would prove the filter against rows the real
  // path never produces.
  const staffDepartments = (await call(staff, 'GET', '/ops/departments')).body?.departments ?? [];
  const staffProperties = new Set(staffDepartments.map((d) => d.propertyId));
  const place = (await placesOf(guest)).find(
    (p) => p.departments.length >= 2 && staffProperties.has(p.propertyId),
  );
  check('the guest holds a place with at least two desks at this workspace', Boolean(place));
  if (!place) return false;

  const [first, second] = place.departments;
  for (const department of [first, second]) {
    const opened = await call(guest, 'POST', '/me/threads', {
      departmentId: department.id,
      body: `Filter verification for ${department.name} (${RUN}).`,
    });
    check(`a conversation exists with ${department.name}`, opened.status === 201 && Boolean(opened.body?.threadId), opened);
  }

  const all = (await call(staff, 'GET', '/ops/threads')).body?.threads ?? [];
  const named = new Set(all.filter((t) => t.departmentName).map((t) => t.departmentName));
  check('the unfiltered inbox carries more than one department', named.size >= 2, [...named]);
  check('it carries both of the conversations just opened', named.has(first.name) && named.has(second.name), [...named]);

  const only = (await call(staff, 'GET', `/ops/threads?departmentId=${first.id}`)).body?.threads ?? [];
  check(`filtering to ${first.name} returns some of its conversations`, only.length > 0, only.length);
  check(
    `filtering to ${first.name} returns ONLY its conversations`,
    only.every((t) => t.departmentName === first.name),
    [...new Set(only.map((t) => t.departmentName))],
  );
  check(
    'the filtered inbox is strictly smaller than the whole one',
    only.length < all.length,
    { filtered: only.length, all: all.length },
  );
  check(
    'every filtered row is one the unfiltered inbox also listed',
    only.every((t) => all.some((row) => row.id === t.id)),
  );

  const none = await call(staff, 'GET', `/ops/threads?departmentId=${randomUUID()}`);
  check(
    'a department id that names nothing returns an empty list, not every thread',
    none.status === 200 && (none.body?.threads ?? []).length === 0,
    none.body?.threads?.length ?? none,
  );
  const malformed = await call(staff, 'GET', '/ops/threads?departmentId=housekeeping');
  check('a malformed department id is refused rather than ignored', malformed.status === 400, malformed.status);

  return true;
}

/* -------------------------------------------------------------------------- */

async function runSection(name, run) {
  const before = failures;
  console.log(`\n${name}:`);
  let completed = false;
  try {
    completed = await run();
  } catch (error) {
    check(`${name} ran without throwing`, false, error.message);
  }
  if (!completed) check(`${name} reached its last check`, false, 'it returned early');
  const passed = failures === before;
  // The marker is the only thing a gate reads, so it is printed here and
  // nowhere else: after the section ran to its end with nothing failing.
  if (passed) console.log(SECTIONS[name]);
  return passed;
}

async function main() {
  console.log(`guest post-booking verify against ${API}${LIVE ? ' (live)' : ''}, run ${RUN}`);
  if (ONLY !== null && !(ONLY in SECTIONS)) {
    check(`--only names a section (${Object.keys(SECTIONS).join(', ')})`, false, ONLY);
    return;
  }
  const platform = await (await fetch(`${API}/api/v1/platform`, { headers: baseHeaders() })).json();
  check('the API is a demo process (fixed sign in code)', platform.environment === 'demo', platform);
  console.log(`  ..    commit ${platform.commit ?? '(unstamped)'}`);

  const wanted = ONLY === null ? Object.keys(SECTIONS) : [ONLY];
  const runners = { desks, order, 'ops-filter': opsFilter };
  let all = true;
  for (const name of wanted) {
    all = (await runSection(name, runners[name])) && all;
  }
  if (ONLY === null && all) console.log('\nGUEST POST BOOKING: ALL CHECKS PASSED');
  finished = true;
}

main()
  .catch((error) => {
    failures += 1;
    console.log(`  FAIL  ${error.message}`);
  })
  .finally(() => {
    if (!finished && failures === 0) {
      failures += 1;
      console.log('  FAIL  the run stopped before its last check');
    }
    if (failures > 0) {
      console.log(`\nguest post-booking: ${failures} check(s) failed`);
      process.exitCode = 1;
    }
  });
