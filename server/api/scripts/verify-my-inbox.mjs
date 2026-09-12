// Verify the guest messaging surface end to end (ADR-032).
//
// The sixth verify script, and the second to write. What it proves cannot be
// read: that a guest and a property can actually talk to each other through two
// different surfaces over one thread, and that the thread is invisible to
// anybody else.
//
// WHAT IT PROVES, in order:
//   1. A booking comes with a conversation. `BookingRepository.create` writes the
//      thread in the same transaction, so a guest can ask about a booking the
//      moment it exists — including while a request is still pending, which is
//      the window a confirmation-gated thread would silence.
//   2. `GET /me/threads` names the PROPERTY, because that is who a guest thinks
//      they are talking to, not a workspace id.
//   3. A guest can send, and the DESK sees it on `GET /ops/threads/:id/messages`
//      — one thread, two surfaces, one definition of a message.
//   4. The desk's reply comes back to the guest as NOT `fromUs`, and lands as
//      `unreadCount: 1`.
//   5. `POST /me/threads/:id/read` clears it, and a message the guest sent
//      themselves never counted toward it.
//   6. Paging returns a cursor and the cursor returns older messages.
//   7. **Another guest asking for the same thread id gets 404, not 403**, so a
//      probe cannot learn that the id exists.
//   8. A signed-out caller is refused.
//
// Run against a database you control, never the shared one:
//   VERIFY_API_URL=http://localhost:8000 node scripts/verify-my-inbox.mjs
const API = process.env.VERIFY_API_URL || 'http://localhost:8000';
const OTP = process.env.VERIFY_OTP_CODE || '123456';

const GUEST = process.env.VERIFY_GUEST_EMAIL || 'guest@injishi.rw';
const OTHER = process.env.VERIFY_OTHER_EMAIL || 'broker@injishi.rw';
const OPERATOR = process.env.VERIFY_OPERATOR_EMAIL || 'host@injishi.rw';

let failures = 0;
function check(label, ok, detail) {
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : `   ${detail}`}`);
}

const jar = (res) =>
  (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');

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
    // The send cap is 5 codes an hour per identifier (ADR-039), and every run of
    // this script spends one for each identity it uses. Running it four or five
    // times in an hour therefore stops it — which is the cap working, not a
    // break. Say so, rather than exiting on an unhandled stack trace that reads
    // like the endpoint is broken.
    const hint =
      res.status === 400
        ? ' — if you have run this a few times in the last hour, that is the OTP' +
          ' send cap (5 per identifier per hour, ADR-039). Wait for the window or' +
          ' use another seeded identity.'
        : '';
    throw new Error(`${email}: sign-in ${res.status}${hint}`);
  }
  const cookie = jar(res);

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

const headers = (s) => ({
  cookie: s.cookie,
  ...(s.workspaceId ? { 'x-workspace-id': s.workspaceId } : {}),
});

const get = (s, path) => fetch(`${API}/api/v1${path}`, { headers: headers(s) });
const post = (s, path, body) =>
  fetch(`${API}/api/v1${path}`, {
    method: 'POST',
    headers: { ...headers(s), 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });

const day = (days) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kigali' }).format(
    new Date(Date.now() + days * 86_400_000),
  );

console.log(`Verifying the guest inbox against ${API}\n`);

// --- A booking, which is what creates a conversation ------------------------

/*
 * The GUEST signs in first, and the operator only when there is a reason to.
 *
 * Every sign-in spends one of that identity's five codes an hour (ADR-039), so
 * an order that signs in three identities to check one endpoint runs out three
 * times faster. The operator is needed for two things only — finding a room to
 * book when the guest has no conversation yet, and replying from the desk — so
 * that session is opened where it is first used.
 */
console.log(`${GUEST} — a booking brings a conversation`);
const guest = await sessionFor(GUEST);

const listRes = await get(guest, '/me/threads');
const list = await listRes.json().catch(() => ({}));
check('GET /me/threads answers 200', listRes.status === 200, `got ${listRes.status}`);

/*
 * Book only if this guest has no conversation yet.
 *
 * The thread is written inside `BookingRepository.create`, so a booking is what
 * creates one — but this script deliberately does NOT depend on that write path
 * being healthy. Its subject is the inbox, and a verify script that fails
 * because a different module is mid-refactor reports the wrong thing. If a
 * thread already exists, the inbox is exercised on that one.
 */
let mine = (list.threads ?? [])[0];
if (!mine) {
  console.log(`  no conversation yet — booking one (finding a room as ${OPERATOR})`);
  const finder = await sessionFor(OPERATOR);
  const propsRes = await get(
    finder,
    `/inventory/properties?workspaceId=${finder.workspaceId}`,
  );
  const property = ((await propsRes.json().catch(() => ({}))).properties ?? [])[0];
  check('a property answers', Boolean(property), `got ${propsRes.status}`);
  if (!property) process.exit(1);

  const detail = await (
    await get(finder, `/inventory/properties/${property.id}?workspaceId=${finder.workspaceId}`)
  ).json();
  const room = (detail.roomTypes ?? []).find((rt) => rt.basePriceRwf || rt.nightlyRateRwf);
  check('a priced room type answers', Boolean(room));
  if (!room) process.exit(1);

  const created = await post(guest, '/bookings', {
    roomTypeId: room.id,
    checkIn: day(30),
    checkOut: day(32),
    guests: 2,
    nonRefundable: false,
    attemptToken: crypto.randomUUID(),
    instrument: { kind: 'mobile_money', network: 'mtn_momo', msisdn: '788123456' },
  });
  check('POST /bookings answers 201', created.status === 201, `got ${created.status}`);
  if (created.status !== 201) {
    console.log(
      '\nNo conversation to test and no way to make one: the booking write is ' +
        'refusing. That is what creates a thread, so this script cannot proceed. ' +
        'Fix the booking path, or run this where a guest already holds a booking.',
    );
    process.exit(1);
  }
  const booking = await created.json();
  mine = ((await (await get(guest, '/me/threads')).json()).threads ?? []).find(
    (t) => t.subjectId === booking.id,
  );
  check('the new booking has a thread', Boolean(mine));
}
if (!mine) process.exit(1);
console.log(`  using thread ${mine.id} (${mine.scope})`);
check('it is scoped to a record', ['booking', 'stay', 'lease'].includes(mine.scope), `got ${mine.scope}`);
check('it names the property, not a workspace id', Boolean(mine.propertyName), `got ${mine.propertyName}`);
check('it reports an unread count', typeof mine.unreadCount === 'number', `got ${mine.unreadCount}`);

// --- Two surfaces, one thread ----------------------------------------------

console.log('\nThe guest says something, and the desk sees it');
const sent = await post(guest, `/me/threads/${mine.id}/messages`, {
  body: 'Hello — could we have a cot in the room please?',
});
const guestMessage = await sent.json().catch(() => ({}));
check('POST /me/threads/:id/messages answers 201', sent.status === 201, `got ${sent.status}`);
check('it comes back as ours', guestMessage.fromUs === true);

// The desk's own session, opened here because this is where it is first needed.
const operator = await sessionFor(OPERATOR);
check('the desk holds a business workspace', Boolean(operator.workspaceId));

const deskRead = await get(operator, `/ops/threads/${mine.id}/messages`);
const deskBody = await deskRead.json().catch(() => ({}));
const onDesk = (deskBody.messages ?? []).find((m) => m.id === guestMessage.id);
check('the desk reads the same message', Boolean(onDesk), `got ${deskRead.status}`);
check('the desk sees it as NOT theirs', onDesk?.fromUs === false);

console.log('\nThe desk replies, and it lands as unread for the guest');
const reply = await post(operator, `/ops/threads/${mine.id}/messages`, {
  body: 'Of course — a cot will be in room 12 before you arrive.',
});
check('the desk can send', reply.status === 201, `got ${reply.status}`);

const afterReply = await (await get(guest, '/me/threads')).json();
const withUnread = (afterReply.threads ?? []).find((t) => t.id === mine.id);
check('the guest has 1 unread', withUnread?.unreadCount === 1, `got ${withUnread?.unreadCount}`);
// Run-independent on purpose: `messages` is append only, so a second run of
// this script finds the thread longer than it left it. What must hold every
// time is that the guest's OWN messages are not news to them — the unread count
// stays 1 (the desk's reply) however many lines the conversation now has.
check(
  "the guest's own messages do not count toward unread",
  (withUnread?.messageCount ?? 0) > withUnread?.unreadCount,
  `messageCount ${withUnread?.messageCount}, unread ${withUnread?.unreadCount}`,
);

const page = await (await get(guest, `/me/threads/${mine.id}/messages`)).json();
const theirs = (page.messages ?? []).find((m) => m.id !== guestMessage.id);
check('the reply reads as not ours', theirs?.fromUs === false);
check('newest first', page.messages?.[0]?.id === theirs?.id);

console.log('\nReading it clears the unread count');
const readRes = await post(guest, `/me/threads/${mine.id}/read`, {});
check('POST /me/threads/:id/read answers 204', readRes.status === 204, `got ${readRes.status}`);
const afterRead = await (await get(guest, '/me/threads')).json();
const cleared = (afterRead.threads ?? []).find((t) => t.id === mine.id);
check('nothing unread now', cleared?.unreadCount === 0, `got ${cleared?.unreadCount}`);

console.log('\nPaging');
const small = await (
  await get(guest, `/me/threads/${mine.id}/messages?limit=1`)
).json();
check('a limit of 1 returns 1', small.messages?.length === 1, `got ${small.messages?.length}`);
check('and a cursor for the older page', typeof small.nextCursor === 'string');
if (typeof small.nextCursor === 'string') {
  const older = await (
    await get(guest, `/me/threads/${mine.id}/messages?limit=1&cursor=${encodeURIComponent(small.nextCursor)}`)
  ).json();
  check(
    'the cursor returns a DIFFERENT, older message',
    older.messages?.[0]?.id && older.messages[0].id !== small.messages[0].id,
  );
}

// --- The property the whole surface rests on -------------------------------

console.log(`\n${OTHER} — the thread is invisible, and invisible means 404`);
const other = await sessionFor(OTHER);
const theirList = await (await get(other, '/me/threads')).json();
check(
  'it is not in their list',
  !(theirList.threads ?? []).some((t) => t.id === mine.id),
  'a thread leaked across guests',
);
const probe = await get(other, `/me/threads/${mine.id}/messages`);
check(
  'reading it by id is 404, not 403',
  probe.status === 404,
  `got ${probe.status} — a 403 would confirm the id exists`,
);
const intrude = await post(other, `/me/threads/${mine.id}/messages`, { body: 'hello?' });
check('writing into it is 404 too', intrude.status === 404, `got ${intrude.status}`);

console.log('\nSigned out, it is refused rather than emptied');
const anon = await fetch(`${API}/api/v1/me/threads`);
check('an anonymous read is 401', anon.status === 401, `got ${anon.status}`);

console.log(
  `\nLeft behind on purpose: two messages in thread ${mine.id}. A message that ` +
    'was sent was sent — `messages` is append only by the schema\'s own rule.',
);

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
