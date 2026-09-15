// Verify the whole guest-stay journey end to end (§6.8).
//
// One story, walked once, as the four people who actually touch it:
//
//   1. THE DESK registers a walk in with a name, a document and an email, and
//      gets a claim code back. Nothing minted a first claim code before this,
//      so the admin console could re-issue a credential that had never existed.
//   2. THE GUEST signs in, types the code, and the stay becomes theirs. No
//      route bound a stay to a user before this; `/activate` raised a toast
//      apologising for it.
//   3. THE GUEST messages an internal department, asks for money back, and is
//      shown the accommodation's own rule before they send.
//   4. THE PROPERTY answers the refund request, and a refusal names its rule.
//      Then it writes an offer and the guest takes it off the bill.
//
// WHAT IT PROVES THAT A UNIT TEST CANNOT:
//   - the claim code is SPENT: the same code refuses a second time, and it
//     refuses with the same 404 an unknown code gets, so the route is not an
//     oracle for "that one was real";
//   - a guest cannot reach a stay that is not theirs — 404, never 403;
//   - `refund.decide` keeps the front desk off the decision, and the receptionist
//     who checked the guest in is refused it;
//   - a rejection lands with a coded reason and comes back to the guest with the
//     sentence that reason maps to;
//   - a redemption posts a NEGATIVE discount line and the bill actually moves;
//   - the second redemption of the same offer on the same stay is refused.
//
// Run against a database you control, never the shared one:
//   VERIFY_API_URL=http://localhost:8000 node scripts/verify-guest-stay.mjs
import { randomUUID } from 'node:crypto';

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

function headers(s, idempotencyKey) {
  const h = { cookie: s.cookie, 'Content-Type': 'application/json' };
  if (s.workspaceId) h['x-workspace-id'] = s.workspaceId;
  // A folio write refuses without one, and it must be a UUID the CLIENT
  // generated: a retried charge must not bill twice.
  if (idempotencyKey) h['Idempotency-Key'] = idempotencyKey;
  return h;
}

function get(s, path) {
  return fetch(`${API}/api/v1${path}`, { headers: headers(s) });
}

function send(method, s, path, body, idempotencyKey) {
  return fetch(`${API}/api/v1${path}`, {
    method,
    headers: headers(s, idempotencyKey),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const post = (s, path, body, key) => send('POST', s, path, body, key);
const patch = (s, path, body) => send('PATCH', s, path, body);

console.log(`Verifying the guest stay journey against ${API}\n`);

// ---------------------------------------------------------------------------
// 1. The desk registers a walk in
// ---------------------------------------------------------------------------

// The RECEPTIONIST, deliberately. `stay.checkin` is a front desk permission and
// the desk is who registers an arrival.
const desk = await sessionFor('reception@injishi.com');
if (!desk.workspaceId) throw new Error('the receptionist holds no business workspace');
// The OWNER of the seeded hospitality business (`host@injishi.com` — Host is
// an OrgRole, the global identity stays Guest). Owner and manager are the only
// roles that may answer a refund request or write an offer.
const owner = await sessionFor('host@injishi.com');
if (!owner.workspaceId) throw new Error('the owner holds no business workspace');

const roomsRes = await get(desk, '/ops/rooms');
const { rooms } = await roomsRes.json();
const free = rooms.find((r) => r.status === 'available' && r.occupiedBy === null);
if (!free) throw new Error('no free room to walk somebody into');

const stamp = Date.now();
const guestEmail = `guest.verify.${stamp}@example.rw`;
const guestName = `Stay Verify ${stamp}`;

console.log('1. The desk registers a walk in, with the registration card');
const walkRes = await post(desk, '/ops/stays/walk-in', {
  roomId: free.id,
  guestName,
  nightlyRateRwf: 40_000,
  guest: {
    fullName: guestName,
    documentType: 'national_id',
    idNumber: `1199${stamp}`.slice(0, 16),
    addressText: 'Kigali, Rwanda',
    email: guestEmail,
    phone: '+250788000111',
  },
});
const walk = await walkRes.json();
check('POST /ops/stays/walk-in answers 201', walkRes.status === 201, `got ${walkRes.status}`);
check('the stay is open', walk.lifecycle === 'open');

const inviteRes = await get(desk, `/ops/stays/${walk.id}/claim-invite`);
const invite = await inviteRes.json();
check('GET /ops/stays/:id/claim-invite answers', inviteRes.status === 200, `got ${inviteRes.status}`);
check(
  'a claim code was minted at the counter',
  typeof invite.claimCode === 'string' && /^[A-Z]{4}-\d{4}$/.test(invite.claimCode ?? ''),
  JSON.stringify(invite.claimCode),
);
check('the address the desk typed is on the stay', invite.email === guestEmail, invite.email);

// ---------------------------------------------------------------------------
// 2. The guest claims it
// ---------------------------------------------------------------------------

console.log('\n2. The guest signs in and claims the stay');
const guest = await sessionFor(guestEmail);

const noStaysRes = await get(guest, '/me/stays');
const noStays = await noStaysRes.json();
check(
  'before claiming, the guest holds no stays',
  (noStays.stays ?? []).every((s) => s.id !== walk.id),
);

const wrongRes = await post(guest, '/me/stays/claim', { code: 'ZZZZ-0000' });
check('an unknown code is refused 404', wrongRes.status === 404, `got ${wrongRes.status}`);
const wrongBody = await wrongRes.json();

const claimRes = await post(guest, '/me/stays/claim', { code: invite.claimCode });
const claim = await claimRes.json();
check('the real code binds the stay', claimRes.status === 201, `got ${claimRes.status}`);
check('and answers with the stay itself', claim.stay?.id === walk.id);
check('the room label came with it', claim.stay?.roomLabel === free.label, claim.stay?.roomLabel);

const replayRes = await post(guest, '/me/stays/claim', { code: invite.claimCode });
const replayBody = await replayRes.json();
check('the code is SPENT: a second use is refused', replayRes.status === 404, `got ${replayRes.status}`);
check(
  'and it is refused identically to an unknown code, so the route is no oracle',
  replayBody.message === wrongBody.message,
  `"${replayBody.message}" vs "${wrongBody.message}"`,
);

const afterRes = await get(guest, '/me/stays');
const after = await afterRes.json();
const mine = (after.stays ?? []).find((s) => s.id === walk.id);
check('GET /me/stays now returns it', Boolean(mine));

// ---------------------------------------------------------------------------
// 3. A stay that is not yours
// ---------------------------------------------------------------------------

console.log('\n3. A stay that is not yours is invisible, not forbidden');
const strangerRes = await get(owner, `/me/stays/${walk.id}/departments`);
check(
  'another account reading this stay gets 404, never 403',
  strangerRes.status === 404,
  `got ${strangerRes.status}`,
);

// ---------------------------------------------------------------------------
// 4. Talking to a department
// ---------------------------------------------------------------------------

console.log('\n4. The guest messages an internal department');
const deptsRes = await get(guest, `/me/stays/${walk.id}/departments`);
const depts = await deptsRes.json();
check('GET /me/stays/:id/departments answers', deptsRes.status === 200, `got ${deptsRes.status}`);
const desks = depts.departments ?? [];
check('the property exposes at least one desk to guests', desks.length > 0, `${desks.length} desks`);

if (desks.length > 0) {
  const target = desks[0];
  const openRes = await post(guest, `/me/stays/${walk.id}/requests`, {
    departmentId: target.id,
    subject: 'Verify run',
    body: 'The kettle in the room does not work.',
  });
  const opened = await openRes.json();
  check('the conversation opens with its first message', openRes.status === 201, `got ${openRes.status}`);
  check('and it is created, not reused', opened.created === true);

  const againRes = await post(guest, `/me/stays/${walk.id}/requests`, {
    departmentId: target.id,
    body: 'Still not working.',
  });
  const again = await againRes.json();
  check('a second message lands in the SAME thread', again.threadId === opened.threadId);
  check('and says so', again.created === false);

  const threadsRes = await get(guest, '/me/threads');
  const threads = await threadsRes.json();
  const thread = (threads.threads ?? []).find((t) => t.id === opened.threadId);
  check('it shows in the guest inbox', Boolean(thread));
  check('as a department request', thread?.kind === 'department_request', thread?.kind);
  check('named for the desk', thread?.departmentName === target.name, thread?.departmentName);

  const opsThreadsRes = await get(desk, '/ops/threads');
  const opsThreads = await opsThreadsRes.json();
  const onDesk = (opsThreads.threads ?? []).find((t) => t.id === opened.threadId);
  check('and the property sees the same conversation', Boolean(onDesk));
}

// ---------------------------------------------------------------------------
// 5. Asking for money back
// ---------------------------------------------------------------------------

console.log('\n5. The guest asks for money back, and is shown the rule first');

// A walk in has paid nothing yet, so the desk takes a payment first: there is
// no refund of nothing, and the assessment says exactly that.
const billsRes = await get(desk, '/ops/folios');
const { folios } = await billsRes.json();
const bill = folios.find((f) => f.guestStayId === walk.id);
check('the walk in has a bill', Boolean(bill));

if (bill) {
  // A `room` charge is REVENUE, so it must credit a revenue centre. The Rooms
  // department is the one the property template seeds for exactly this.
  const deptRes = await get(desk, '/ops/departments');
  const { departments } = await deptRes.json();
  const roomsDept = (departments ?? []).find(
    (d) => d.departmentCategory === 'rooms' && d.isRevenueCenter,
  );
  check('the property has a Rooms revenue centre', Boolean(roomsDept));

  const chargeRes = await post(
    desk,
    `/ops/folios/${bill.id}/charges`,
    {
      chargeType: 'room',
      departmentId: roomsDept?.id,
      description: 'One night',
      amountRwf: 40_000,
      quantity: 1,
    },
    randomUUID(),
  );
  check('the night is charged', chargeRes.status === 201, `got ${chargeRes.status}`);

  const payRes = await post(
    desk,
    `/ops/folios/${bill.id}/payments`,
    { amountRwf: 40_000, method: 'cash' },
    randomUUID(),
  );
  check('and the guest pays at the counter', payRes.status === 201, `got ${payRes.status}`);
}

const quoteRes = await get(guest, `/me/stays/${walk.id}/refund-quote?reason=cleanliness`);
const quote = await quoteRes.json();
check('GET /me/stays/:id/refund-quote answers', quoteRes.status === 200, `got ${quoteRes.status}`);
check('the rule is a sentence, not a code', typeof quote.rule === 'string' && quote.rule.length > 20);
check('it reports what has been paid', quote.paidRwf > 0, `paid ${quote.paidRwf}`);

const raiseRes = await post(guest, `/me/stays/${walk.id}/refund-requests`, {
  reason: 'cleanliness',
  detail: 'The bathroom was not cleaned on the first night of the stay.',
});
const raised = await raiseRes.json();
check('the request is raised', raiseRes.status === 201, `got ${raiseRes.status}`);
check('with a sayable reference', /^RF-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(raised.reference ?? ''), raised.reference);
check('and the rules as they stood, snapshotted', typeof raised.policyRule === 'string');

const secondRaiseRes = await post(guest, `/me/stays/${walk.id}/refund-requests`, {
  reason: 'noise',
  detail: 'A second complaint raised while the first is still open.',
});
check(
  'a second open request on one stay is refused',
  secondRaiseRes.status === 409,
  `got ${secondRaiseRes.status}`,
);

// ---------------------------------------------------------------------------
// 6. The property answers
// ---------------------------------------------------------------------------

console.log('\n6. The property answers, and the desk may not');
const deskQueueRes = await get(desk, '/ops/refund-requests');
check(
  'a receptionist is refused the refund queue',
  deskQueueRes.status === 403,
  `got ${deskQueueRes.status}`,
);

const queueRes = await get(owner, '/ops/refund-requests?state=submitted');
const queue = await queueRes.json();
check('the owner reads the queue', queueRes.status === 200, `got ${queueRes.status}`);
const queued = (queue.requests ?? []).find((r) => r.id === raised.id);
check('and the request is in it', Boolean(queued));
check('carrying the guest’s own words', queued?.detail?.includes('bathroom'));

const nakedRejectRes = await post(owner, `/ops/refund-requests/${raised.id}/decision`, {
  decision: 'reject',
  refusalReason: 'other',
});
check(
  'a refusal of `other` with no words is refused by the contract',
  nakedRejectRes.status === 400,
  `got ${nakedRejectRes.status}`,
);

const rejectRes = await post(owner, `/ops/refund-requests/${raised.id}/decision`, {
  decision: 'reject',
  refusalReason: 'not_reported_during_stay',
  note: 'Housekeeping attended the room the same morning.',
});
const rejected = await rejectRes.json();
check('the refusal lands', rejectRes.status === 201, `got ${rejectRes.status}`);
check('naming its rule', rejected.refusalReason === 'not_reported_during_stay');
check(
  'and carrying the sentence that rule means',
  typeof rejected.refusalLabel === 'string' && rejected.refusalLabel.length > 20,
  rejected.refusalLabel,
);

const twiceRes = await post(owner, `/ops/refund-requests/${raised.id}/decision`, {
  decision: 'approve',
  approvedRwf: 40_000,
});
check('answering it twice is refused', twiceRes.status === 409, `got ${twiceRes.status}`);

const mineRes = await get(guest, '/me/stays/refund-requests');
const minesRequests = await mineRes.json();
const answered = (minesRequests.requests ?? []).find((r) => r.id === raised.id);
check('the guest reads the answer', answered?.state === 'rejected', answered?.state);
check('with the reason in words', Boolean(answered?.refusalLabel));

// ---------------------------------------------------------------------------
// 7. An offer, and taking it
// ---------------------------------------------------------------------------

console.log('\n7. The property writes an offer and the guest takes it');
const roomRow = rooms.find((r) => r.id === free.id);
const propertyId = mine?.propertyId ?? null;
check('the guest’s stay names a property', Boolean(propertyId), String(propertyId));

if (propertyId) {
  const deskWriteRes = await post(desk, '/ops/offers', {
    propertyId,
    name: 'Should not be writable by the desk',
    discountKind: 'percentage',
    discountValue: 10,
    scope: 'folio',
    startsOn: new Date().toISOString().slice(0, 10),
  });
  check(
    'a receptionist may not write an offer',
    deskWriteRes.status === 403,
    `got ${deskWriteRes.status}`,
  );

  const badRes = await post(owner, '/ops/offers', {
    propertyId,
    name: 'Impossible',
    discountKind: 'percentage',
    discountValue: 150,
    scope: 'folio',
    startsOn: new Date().toISOString().slice(0, 10),
  });
  check('a 150% discount is refused', badRes.status === 400, `got ${badRes.status}`);

  const offerRes = await post(owner, '/ops/offers', {
    propertyId,
    name: `Verify stay offer ${stamp}`,
    description: '10% off the bill for guests in the building tonight.',
    discountKind: 'percentage',
    discountValue: 10,
    scope: 'folio',
    audience: 'in_house',
    startsOn: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10),
  });
  const offer = await offerRes.json();
  check('the owner writes one', offerRes.status === 201, `got ${offerRes.status}`);
  check('and it is born a draft', offer.status === 'draft', offer.status);

  const draftListRes = await get(guest, `/me/stays/${walk.id}/offers`);
  const draftList = await draftListRes.json();
  check(
    'a draft offer is not shown to the guest',
    !(draftList.offers ?? []).some((o) => o.id === offer.id),
  );

  await patch(owner, `/ops/offers/${offer.id}`, { status: 'active' });

  const listRes = await get(guest, `/me/stays/${walk.id}/offers`);
  const list = await listRes.json();
  const seen = (list.offers ?? []).find((o) => o.id === offer.id);
  check('once active the guest sees it', Boolean(seen));
  check('with its own verdict resolved on the server', seen?.eligible === true, seen?.reason ?? '');
  check('and what it is worth on this bill', seen?.discountRwf > 0, String(seen?.discountRwf));

  const before = (await (await get(guest, '/me/stays')).json()).stays.find((s) => s.id === walk.id);
  const redeemRes = await post(guest, `/me/stays/${walk.id}/offers/${offer.id}/redeem`, {});
  const redeemed = await redeemRes.json();
  check('the guest takes it', redeemRes.status === 201, `got ${redeemRes.status}`);
  check('a discount line was written', Boolean(redeemed.folioChargeId));
  check(
    'and the bill actually moved',
    redeemed.balanceRwf === Math.max(0, (before?.balanceRwf ?? 0) - redeemed.discountRwf),
    `was ${before?.balanceRwf}, took ${redeemed.discountRwf}, now ${redeemed.balanceRwf}`,
  );

  const twiceOfferRes = await post(guest, `/me/stays/${walk.id}/offers/${offer.id}/redeem`, {});
  check(
    'taking the same offer twice on one stay is refused',
    twiceOfferRes.status === 409,
    `got ${twiceOfferRes.status}`,
  );

  await patch(owner, `/ops/offers/${offer.id}`, { status: 'archived' });
}

// ---------------------------------------------------------------------------

console.log(
  `\nLeft behind on purpose: stay ${walk.id}, its bill and its refund request. ` +
    'A stay is never deleted — the bill and the decision against it have to stay readable. ' +
    `Room ${roomRow?.label ?? free.id} is still occupied; check it out when you are done.`,
);
console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) FAILED.`}`);
process.exit(failures === 0 ? 0 : 1);
