#!/usr/bin/env node
/**
 * ADR-050 D-q and D-s, END TO END over HTTP: a guest messages a department,
 * the department answers, and the guest orders from inside the conversation.
 *
 * What this proves against a RUNNING API, not a unit test:
 *
 *  - `GET /me/stays/:id/departments` lists the stay's desks, and
 *    `POST /me/stays/:id/requests` opens a desk conversation and joins it again
 *    on a second open (upstream, 6718d11), named for the department;
 *  - the property's inbox (`GET /ops/threads`) lists it with the department;
 *  - a staff reply reaches the guest, sided as theirs;
 *  - an order placed with `threadId` writes a `system` line carrying the order,
 *    every status change writes another, a guest cancel writes one, and no order
 *    ever becomes a thread of its own;
 *  - a person with no booking there is refused (403), and another person's
 *    conversation is a 404 for reading and for ordering into.
 *
 * NO DATABASE ACCESS. Everything goes through HTTP as the demo personas, so the
 * same script runs against a laptop and against the live demo:
 *
 *   node scripts/verify-guest-department-chat.mjs --api http://127.0.0.1:8060
 *   node scripts/verify-guest-department-chat.mjs --api https://api-demo.injishi.com --live
 *
 * It needs a DEMO process (the fixed sign in code) over the seeded demo hotel:
 * `samuel@demo.injishi.com` in house at Amahoro Boutique Hotel with an open
 * bill (as `seed-demo-hotel.mjs` writes him; `VERIFY_GUEST` picks another),
 * `solange@demo.injishi.com` managing it, and `rayan@demo.injishi.com` holding
 * no stay there. `--live` sends the Origin header the deployed
 * API's CORS and CSRF checks expect. On the live demo it leaves one delivered
 * and one cancelled order on the guest's bill, which the nightly reset removes.
 */
import { randomUUID } from 'node:crypto';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : (args[i + 1] ?? null);
};
const API = (flag('--api') || process.env.VERIFY_API_URL || 'http://127.0.0.1:8060').replace(/\/$/, '');
const LIVE = args.includes('--live');
const ORIGIN = flag('--origin') || (LIVE ? 'https://www-demo.injishi.com' : null);
const CODE = process.env.VERIFY_OTP_CODE || '123456';
const GUEST = process.env.VERIFY_GUEST || 'samuel@demo.injishi.com';
const STAFF = process.env.VERIFY_STAFF || 'solange@demo.injishi.com';
const OUTSIDER = process.env.VERIFY_OUTSIDER || 'rayan@demo.injishi.com';
const RUN = new Date().toISOString().slice(11, 19);

let failures = 0;
/** Set only when `main` reaches its last check, so an early return can never read as a pass. */
let finished = false;
function check(label, ok, detail) {
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok || detail === undefined ? '' : `   ${typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 400)}`}`);
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
      if (verified.status >= 300) throw new Error(`${email}: step-up ${verified.status} ${JSON.stringify(verified.body)}`);
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

async function main() {
  console.log(`guest department chat verify against ${API}${LIVE ? ' (live)' : ''}, run ${RUN}`);
  const platform = await (await fetch(`${API}/api/v1/platform`, { headers: baseHeaders() })).json();
  check('the API is a demo process (fixed sign in code)', platform.environment === 'demo', platform);

  const guest = await signIn(GUEST);
  const staff = await signIn(STAFF, { staff: true });
  const outsider = await signIn(OUTSIDER);

  // 1. The stay, and its desks (the stay surface of 6718d11).
  const stays = await call(guest, 'GET', '/me/stays');
  const open = (stays.body?.stays ?? []).filter((x) => x.lifecycle === 'open');
  const stay = open.sort((a, b) => b.entryAt.localeCompare(a.entryAt))[0];
  check('the guest holds an open stay', Boolean(stay), stays.body);
  if (!stay) return;
  const desks = await call(guest, 'GET', `/me/stays/${stay.id}/departments`);
  const deskList = desks.body?.departments ?? [];
  check('the stay lists desks the guest may message', deskList.length > 0, desks);
  if (deskList.length === 0) return;
  const department = deskList.find((d) => d.departmentCategory === 'fnb') ?? deskList[0];
  const place = { propertyId: stay.propertyId, propertyName: stay.propertyName };
  console.log(`  ..    ${stay.propertyName}: ${deskList.map((d) => d.name).join(', ')}`);

  // 2. Open, then resume.
  const threadsBefore = (await call(guest, 'GET', '/me/threads')).body?.threads ?? [];
  const opened = await call(guest, 'POST', `/me/stays/${stay.id}/requests`, {
    departmentId: department.id,
    body: `Hello ${department.name}, a verification message (${RUN}).`,
  });
  check('a desk conversation opens (201)', opened.status === 201, opened);
  const threadId = opened.body?.threadId;
  if (!threadId) return;
  const again = await call(guest, 'POST', `/me/stays/${stay.id}/requests`, {
    departmentId: department.id,
    body: `A second note to ${department.name} (${RUN}).`,
  });
  check('a second open joins the same conversation', again.body?.threadId === threadId && again.body?.created === false, again.body);

  const listed = (await call(guest, 'GET', '/me/threads')).body?.threads ?? [];
  const thread = listed.find((t) => t.id === threadId);
  check('the guest inbox lists it once, with the department', listed.filter((t) => t.id === threadId).length === 1 && thread?.departmentName === department.name, thread);
  if (!thread) return;

  // 3. The department sees it and answers.
  const opsList = await call(staff, 'GET', '/ops/threads');
  const opsRow = (opsList.body?.threads ?? []).find((t) => t.id === thread.id);
  check('the property inbox lists the conversation with the department name', opsRow?.departmentName === department.name, opsRow ?? opsList.status);
  const reply = await call(staff, 'POST', `/ops/threads/${thread.id}/messages`, {
    body: `Hello from ${department.name}, we are on it (${RUN}).`,
  });
  check('staff reply is accepted', reply.status === 201, reply);
  const afterReply = await guestLines(guest, thread.id);
  const seenReply = afterReply.find((m) => m.id === reply.body?.id);
  check('the guest reads the reply, sided as the property\'s', Boolean(seenReply) && seenReply.fromUs === false && seenReply.bodyType === 'text', seenReply);
  check('the reply is signed by the department, never the staffer (D-r)', seenReply?.senderName === department.name, seenReply?.senderName);

  // 4. Order from inside the conversation.
  const orderable = await call(guest, 'GET', '/me/orderable');
  const outlet = (orderable.body?.outlets ?? []).find((o) => o.propertyId === place.propertyId && o.chargeToRoom);
  check('the guest can charge an outlet at this property to the room', Boolean(outlet), orderable.body);
  if (!outlet) return;
  const item = outlet.categories.flatMap((c) => c.items).find((i) => (i.options ?? []).every((o) => !o.required)) ??
    outlet.categories[0]?.items[0];
  const place1 = await call(
    guest,
    'POST',
    '/me/orders',
    { outletId: outlet.id, context: 'in_house_folio', threadId: thread.id, items: [{ serviceItemId: item.id, quantity: 1 }], guestNote: `verification ${RUN}` },
    { 'Idempotency-Key': randomUUID() },
  );
  check('an order placed with threadId is accepted', place1.status === 201, place1);
  // `PlaceOrderResult` is the order itself, plus the payment attempt (none here).
  const order = place1.body?.id ? place1.body : null;
  if (!order) return;

  let lines = await guestLines(guest, thread.id);
  const placedLine = lines.find((m) => m.serviceOrderId === order.id);
  check('the conversation gains a system line carrying the order', placedLine?.bodyType === 'system' && placedLine.senderUserId === null && placedLine.body.includes(order.orderNumber), placedLine);

  const threadsAfterOrder = (await call(guest, 'GET', '/me/threads')).body?.threads ?? [];
  check('the order is a card in the conversation, never a thread of its own', threadsAfterOrder.length === Math.max(threadsBefore.length, listed.length), { before: threadsBefore.length, after: threadsAfterOrder.length });

  for (const to of ['acknowledged', 'in_progress', 'ready', 'delivered']) {
    const moved = await call(staff, 'POST', `/ops/service-orders/${order.id}/advance`, { to });
    check(`staff moves the order to ${to}`, moved.status < 300, moved);
  }
  lines = await guestLines(guest, thread.id);
  const orderLines = lines.filter((m) => m.serviceOrderId === order.id);
  check('every status change wrote a line (placed + 4)', orderLines.length === 5, orderLines.map((m) => m.body));
  check('the newest line says it was delivered', /delivered/i.test(orderLines[0]?.body ?? ''), orderLines[0]);
  const row = ((await call(guest, 'GET', '/me/threads')).body?.threads ?? []).find((t) => t.id === thread.id);
  check('the inbox preview reads the order line, not a placeholder', /delivered/i.test(row?.lastMessagePreview ?? ''), row?.lastMessagePreview);
  const detail = await call(guest, 'GET', `/me/orders/${order.id}`);
  check('the order card source reads delivered', detail.body?.status === 'delivered', detail.body?.status);
  const opsMessages = await call(staff, 'GET', `/ops/threads/${thread.id}/messages`);
  check('staff see the same order lines, carrying the order id', (opsMessages.body?.messages ?? []).filter((m) => m.serviceOrderId === order.id && m.bodyType === 'system').length === 5);

  const place2 = await call(
    guest,
    'POST',
    '/me/orders',
    { outletId: outlet.id, context: 'in_house_folio', threadId: thread.id, items: [{ serviceItemId: item.id, quantity: 1 }], guestNote: `verification cancel ${RUN}` },
    { 'Idempotency-Key': randomUUID() },
  );
  const cancelled = place2.body?.id ? await call(guest, 'POST', `/me/orders/${place2.body.id}/cancel`) : place2;
  check('the guest cancels a second order', cancelled.body?.status === 'cancelled', cancelled);
  lines = await guestLines(guest, thread.id);
  check('the cancel wrote its line too', lines.some((m) => m.serviceOrderId === place2.body?.id && /cancelled/i.test(m.body)), lines.slice(0, 3));

  // 5. Refusals.
  const outsiderOpen = await call(outsider, 'POST', `/me/stays/${stay.id}/requests`, { departmentId: department.id, body: 'hello' });
  check("another person cannot open a desk conversation on this stay", outsiderOpen.status === 404 || outsiderOpen.status === 403, outsiderOpen);
  const outsiderRead = await call(outsider, 'GET', `/me/threads/${thread.id}/messages`);
  check("another person's conversation is 404 to read", outsiderRead.status === 404, outsiderRead.status);
  const outsiderOrder = await call(
    outsider,
    'POST',
    '/me/orders',
    { outletId: outlet.id, context: 'pay_now', threadId: thread.id, items: [{ serviceItemId: item.id, quantity: 1 }] },
    { 'Idempotency-Key': randomUUID() },
  );
  check("ordering into another person's conversation is refused", outsiderOrder.status === 404 || outsiderOrder.status === 403, outsiderOrder);
  const bogus = await call(guest, 'POST', `/me/stays/${stay.id}/requests`, { departmentId: randomUUID(), body: 'hello' });
  check('an unknown department is refused', bogus.status === 404 || bogus.status === 422, bogus.status);
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
    if (failures === 0) {
      console.log('GUEST DEPARTMENT CHAT: ALL CHECKS PASSED');
    } else {
      console.log(`guest department chat: ${failures} check(s) failed`);
      process.exitCode = 1;
    }
  });
