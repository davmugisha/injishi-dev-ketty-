#!/usr/bin/env node
/**
 * The point of sale, end to end over HTTP (POS spec §21, workflow tests).
 *
 * Signs in as the seeded Ikirezi staff (`seed-demo-pos.mjs`) and walks:
 *
 *   1. seat a table, draft an order with modifiers, send it: a kitchen and a
 *      bar ticket, nothing for the bottled water, and a second send changes
 *      nothing
 *   2. the kitchen and the bar move their tickets, the waiter serves; a
 *      reprint makes a copy and nothing else
 *   3. discounts: within the limit applies, over it waits, the manager approves
 *   4. a split payment, cash and simulated MoMo (pending, then confirmed); the
 *      same key again makes no second payment; a failed payment counts for
 *      nothing and a retry succeeds
 *   5. voids and cancellations need the override and leave an audit row
 *   6. a refund needs `pos.refund`, corrects a settled bill without reopening
 *      it, and a retried refund refunds once
 *   7. a shift: open, cash in, a paid out, close with a variance, nobody
 *      reviews their own
 *   8. branch and tenant isolation: Rubavu staff cannot read Kimihurura, a
 *      kitchen account cannot sell, another business cannot reach this one
 *
 * MUTATES the demo trade. Run `node scripts/seed-demo-pos.mjs --reset` after.
 *
 *   DATABASE_URL=... VERIFY_OTP_CODE=123456 node scripts/verify-pos.mjs
 */
import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import pg from 'pg';

import { assertSampleDatabase } from './sample-database.mjs';

const API = process.env.VERIFY_API_URL || 'http://localhost:8000';
const CODE = process.env.VERIFY_OTP_CODE || '123456';
const BLOCK = 'de300000-0000-4000-8000-0b05';
const sid = (key) => `${BLOCK}${createHash('sha256').update(key).digest('hex').slice(0, 8)}`;
const OUTLET = { kgl: sid('outlet:kimihurura'), rbv: sid('outlet:rubavu') };

let failures = 0;
function check(label, ok, detail) {
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok || detail === undefined ? '' : `   ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`);
}
const section = (t) => console.log(`\n${t}`);

function jar(res) {
  return (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
}

async function sessionFor(email) {
  const sent = await fetch(`${API}/api/auth/email-otp/send-verification-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, type: 'sign-in' }),
  });
  if (!sent.ok) throw new Error(`${email}: code send ${sent.status} ${await sent.text()}`);
  const res = await fetch(`${API}/api/auth/sign-in/email-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp: CODE }),
  });
  if (!res.ok) throw new Error(`${email}: sign-in ${res.status} ${await res.text()}`);
  const cookie = jar(res);
  const stepSent = await fetch(`${API}/api/v1/me/two-factor/send`, { method: 'POST', headers: { cookie } });
  if (stepSent.ok) {
    const verified = await fetch(`${API}/api/v1/me/two-factor/verify`, {
      method: 'POST',
      headers: { cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: CODE }),
    });
    if (!verified.ok) throw new Error(`${email}: step-up ${verified.status} ${await verified.text()}`);
  }
  const { workspaces = [] } = await (await fetch(`${API}/api/v1/me/workspaces`, { headers: { cookie } })).json();
  const workspaceId = workspaces.find((w) => w.kind === 'business' && w.domain === 'hospitality')?.workspaceId ?? null;
  return { email, cookie, workspaceId };
}

async function call(who, method, path, body, { workspaceId, key } = {}) {
  const headers = { cookie: who.cookie };
  const ws = workspaceId ?? who.workspaceId;
  if (ws) headers['x-workspace-id'] = ws;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (key) headers['Idempotency-Key'] = key;
  const res = await fetch(`${API}/api/v1/ops/pos${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, body: json };
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
await assertSampleDatabase(db, 'verify-pos.mjs');
const one = async (sql, params) => (await db.query(sql, params)).rows[0];

try {
  console.log(`verify-pos against ${API}`);
  const S = {};
  for (const [k, email] of Object.entries({
    waiter: 'waiter1@pos.demo.injishi.com',
    cashier: 'cashier1@pos.demo.injishi.com',
    kitchen: 'kitchen1@pos.demo.injishi.com',
    bartender: 'bartender@pos.demo.injishi.com',
    manager: 'manager@pos.demo.injishi.com',
    owner: 'owner@pos.demo.injishi.com',
    waiterRbv: 'waiter2@pos.demo.injishi.com',
    hotelOwner: 'didier@app.demo.injishi.com',
  })) {
    try {
      S[k] = await sessionFor(email);
    } catch (error) {
      if (k === 'hotelOwner') S[k] = null;
      else throw error;
    }
  }

  // ---------------------------------------------------------------- 1
  section('1. Seat, draft, send');
  const floor = await call(S.waiter, 'GET', `/outlets/${OUTLET.kgl}/floor`);
  check('the waiter reads the floor', floor.status === 200, floor.status);
  const free = floor.body.tables.find((t) => t.status === 'available');
  check('a free table exists', !!free);
  const seated = await call(S.waiter, 'POST', `/tables/${free.id}/seat`, { guestCount: 2 });
  const table = seated.body.tables?.find((t) => t.id === free.id);
  check('seating makes the table occupied with a session', seated.status === 201 && table?.status === 'occupied' && !!table.sessionId, seated.body);

  const menu = await call(S.waiter, 'GET', `/outlets/${OUTLET.kgl}/menu`);
  const pick = (name) => menu.body.items.find((i) => i.name === name);
  const goat = pick('Goat brochettes');
  const primus = pick('Primus, 72 cl');
  const water = pick('Bottled water, 50 cl');
  check('the menu prices inclusive and routes items', menu.body.taxMode === 'inclusive' && goat.stationId && primus.stationId && !water.stationId);

  const key = `verify-${randomUUID()}`;
  const draft = await call(
    S.waiter,
    'POST',
    '/orders',
    {
      outletId: OUTLET.kgl,
      orderType: 'dine_in',
      tableSessionId: table.sessionId,
      lines: [
        { serviceItemId: goat.id, quantity: 2, selectedOptions: [{ name: 'Side', choices: ['Fried plantain'] }, { name: 'Extras', choices: ['Extra chips'] }], note: 'No onion' },
        { serviceItemId: primus.id, quantity: 2 },
        { serviceItemId: water.id, quantity: 1 },
      ],
    },
    { key },
  );
  const order = draft.body;
  check('a draft order is created', draft.status === 201 && order.status === 'draft', draft.body);
  // Goat 3,500 + plantain 500 + extra chips 1,000 = 5,000 x 2; Primus 1,500 x 2; water 800.
  check('lines are priced with their modifiers', order.lines[0].unitPriceRwf === 5000 && order.totalRwf === 13800, order.totalRwf);
  // Per line, half up: 10,000 x 18/118 = 1,525.4 -> 1,525; 3,000 x 18/118 = 457.6 -> 458; water exempt.
  check('inclusive tax: VAT inside, per line, water exempt', order.taxRwf === 1525 + 458, order.taxRwf);
  const replay = await call(S.waiter, 'POST', '/orders', { outletId: OUTLET.kgl, orderType: 'dine_in', tableSessionId: table.sessionId, lines: [] }, { key });
  check('the same Idempotency-Key returns the same order', replay.body.id === order.id);

  const sent = await call(S.waiter, 'POST', `/orders/${order.id}/send`);
  check('sending moves every line to sent', sent.status === 200 && sent.body.lines.every((l) => l.status === 'sent'), sent.body.status);
  const tickets = await one(`SELECT count(*)::int AS n FROM kitchen_tickets WHERE order_id = $1`, [order.id]);
  check('one ticket per station: kitchen and bar, none for the water', tickets.n === 2, tickets.n);
  await call(S.waiter, 'POST', `/orders/${order.id}/send`);
  const again = await one(`SELECT count(*)::int AS n FROM kitchen_tickets WHERE order_id = $1`, [order.id]);
  check('sending again makes no second ticket', again.n === 2, again.n);
  const kitchenSell = await call(S.kitchen, 'POST', `/orders/${order.id}/lines`, { lines: [{ serviceItemId: primus.id, quantity: 1 }] });
  check('a kitchen account cannot sell', kitchenSell.status === 403, kitchenSell.status);

  // ---------------------------------------------------------------- 2
  section('2. Kitchen, bar, pass');
  const board = await call(S.kitchen, 'GET', `/outlets/${OUTLET.kgl}/tickets?kind=kitchen`);
  const kt = board.body.find((t) => t.orderId === order.id);
  check('the kitchen board shows the ticket with its modifiers and note', !!kt && kt.items[0].options.length === 2 && kt.items[0].note === 'No onion', kt);
  const bars = await call(S.bartender, 'GET', `/outlets/${OUTLET.kgl}/tickets?kind=bar`);
  const bt = bars.body.find((t) => t.orderId === order.id);
  check('the bar board shows only the beer', !!bt && bt.items.length === 1);
  const badMove = await call(S.kitchen, 'POST', `/tickets/${kt.id}/advance`, { to: 'served' });
  check('a queued ticket cannot jump to served', badMove.status === 409, badMove.status);
  await call(S.kitchen, 'POST', `/tickets/${kt.id}/advance`, { to: 'preparing' });
  let o = (await call(S.waiter, 'GET', `/orders/${order.id}`)).body;
  check('the order is preparing once the kitchen starts', o.status === 'in_progress', o.status);
  await call(S.kitchen, 'POST', `/tickets/${kt.id}/advance`, { to: 'ready' });
  await call(S.bartender, 'POST', `/tickets/${bt.id}/advance`, { to: 'ready' });
  o = (await call(S.waiter, 'GET', `/orders/${order.id}`)).body;
  check('both stations ready: the order is ready', o.status === 'ready', o.status);
  const reprint = await call(S.kitchen, 'POST', `/tickets/${kt.id}/reprint`);
  const tickets2 = await one(`SELECT count(*)::int AS n FROM kitchen_tickets WHERE order_id = $1`, [order.id]);
  check('a reprint is a second copy and no new ticket', reprint.body.printCount === 2 && tickets2.n === 2, { printCount: reprint.body.printCount, tickets: tickets2.n });
  await call(S.waiter, 'POST', `/tickets/${kt.id}/advance`, { to: 'served' });
  await call(S.waiter, 'POST', `/tickets/${bt.id}/advance`, { to: 'served' });
  o = (await call(S.waiter, 'GET', `/orders/${order.id}`)).body;
  check('served and unpaid: delivered, not completed', o.status === 'delivered' && o.settlement.state === 'unpaid', o.status);
  const history = await one(`SELECT count(*)::int AS n FROM kitchen_ticket_events WHERE ticket_id = $1`, [kt.id]);
  check('the item status history is kept', history.n >= 4, history.n);

  // ---------------------------------------------------------------- 3
  section('3. Discounts');
  const small = await call(S.cashier, 'POST', `/orders/${order.id}/discounts`, { kind: 'amount', value: 500, reason: 'Slow service' });
  check('within the 10% limit a cashier discount applies', small.body.discounts?.at(-1)?.status === 'approved' && small.body.totalRwf === 13300, small.body.totalRwf);
  const big = await call(S.cashier, 'POST', `/orders/${order.id}/discounts`, { kind: 'percent', value: 2000, reason: 'Friend of the owner' });
  const pending = big.body.discounts?.find((d) => d.status === 'pending_approval');
  check('over the limit it waits, and the total does not move', !!pending && big.body.totalRwf === 13300, big.body.totalRwf);
  const cashierDecides = await call(S.cashier, 'POST', `/orders/${order.id}/discounts/${pending.id}/decide`, { approve: true });
  check('a cashier cannot approve it', cashierDecides.status === 403, cashierDecides.status);
  const rejected = await call(S.manager, 'POST', `/orders/${order.id}/discounts/${pending.id}/decide`, { approve: false, note: 'Too much' });
  check('the manager rejects it and the total stands', rejected.body.totalRwf === 13300 && rejected.body.discounts.find((d) => d.id === pending.id).status === 'rejected');

  // ---------------------------------------------------------------- 4
  section('4. Split payment, retries, failures');
  const myShift = await call(S.cashier, 'GET', `/outlets/${OUTLET.kgl}/my-shift`);
  check("the cashier's shift is open", myShift.body?.status === 'open', myShift.body);
  const cashKey = `verify-cash-${randomUUID()}`;
  const cash = await call(S.cashier, 'POST', `/orders/${order.id}/payments`, { method: 'cash', amountRwf: 5000, tenderedRwf: 10000, idempotencyKey: cashKey });
  check('cash with change', cash.body.payments?.at(-1)?.changeRwf === 5000 && cash.body.settlement.state === 'partially_paid', cash.body.settlement);
  const cashAgain = await call(S.cashier, 'POST', `/orders/${order.id}/payments`, { method: 'cash', amountRwf: 5000, tenderedRwf: 10000, idempotencyKey: cashKey });
  check('the same key again makes no second payment', cashAgain.body.payments.length === 1, cashAgain.body.payments.length);
  const failed = await call(S.cashier, 'POST', `/orders/${order.id}/payments`, { method: 'airtel_money', amountRwf: 8300, simulate: 'failure', payerPhone: '+250788000199', idempotencyKey: `verify-${randomUUID()}` });
  check('a simulated failure counts for nothing', failed.body.payments.at(-1).status === 'failed' && failed.body.settlement.outstandingRwf === 8300, failed.body.settlement);
  const momo = await call(S.cashier, 'POST', `/orders/${order.id}/payments`, { method: 'mtn_momo', amountRwf: 8300, payerPhone: '+250788000198', idempotencyKey: `verify-${randomUUID()}` });
  const momoPay = momo.body.payments.at(-1);
  check('mobile money waits in pending, with a DEMO reference', momoPay.status === 'pending' && momoPay.demoReference.startsWith('DEMO-MOMO-') && momoPay.simulated);
  const blocked = await call(S.cashier, 'POST', `/orders/${order.id}/payments`, { method: 'cash', amountRwf: 1000, idempotencyKey: `verify-${randomUUID()}` });
  check('nothing more is payable while it waits', blocked.status === 409, blocked.status);
  const resolved = await call(S.cashier, 'POST', `/payments/${momoPay.id}/resolve`, { outcome: 'success' });
  check('confirmed: paid and completed', resolved.body.settlement.settled && resolved.body.status === 'completed', { s: resolved.body.settlement, status: resolved.body.status });
  const resolvedAgain = await call(S.cashier, 'POST', `/payments/${momoPay.id}/resolve`, { outcome: 'success' });
  check('the same callback again changes nothing', resolvedAgain.status === 200 && resolvedAgain.body.payments.length === 3);
  const late = await call(S.cashier, 'POST', `/payments/${momoPay.id}/resolve`, { outcome: 'failure' });
  check('a contrary late answer is refused', late.status === 409, late.status);

  // ---------------------------------------------------------------- 5
  section('5. Voids and cancellations');
  const free2 = (await call(S.waiter, 'GET', `/outlets/${OUTLET.kgl}/floor`)).body.tables.find((t) => t.status === 'available');
  const s2 = (await call(S.waiter, 'POST', `/tables/${free2.id}/seat`, { guestCount: 2 })).body.tables.find((t) => t.id === free2.id);
  const o2 = (await call(S.waiter, 'POST', '/orders', { outletId: OUTLET.kgl, orderType: 'dine_in', tableSessionId: s2.sessionId, lines: [{ serviceItemId: goat.id, quantity: 1, selectedOptions: [{ name: 'Side', choices: ['Chips'] }] }, { serviceItemId: primus.id, quantity: 1 }] })).body;
  await call(S.waiter, 'POST', `/orders/${o2.id}/send`);
  const waiterVoid = await call(S.waiter, 'POST', `/orders/${o2.id}/lines/${o2.lines[1].id}/void`, { reason: 'Wrong beer' });
  check('a waiter cannot void a sent line', waiterVoid.status === 403, waiterVoid.status);
  const voided = await call(S.manager, 'POST', `/orders/${o2.id}/lines/${o2.lines[1].id}/void`, { reason: 'Wrong beer' });
  check('the manager voids it; the bill drops', voided.body.lines[1].status === 'voided' && voided.body.totalRwf === 3500, voided.body.totalRwf);
  const voidAudit = await one(`SELECT count(*)::int AS n FROM pos_audit_events WHERE action = 'line.voided' AND entity_id = $1 AND reason = 'Wrong beer'`, [o2.lines[1].id]);
  check('the void is audited with its reason', voidAudit.n === 1);
  const waiterCancel = await call(S.waiter, 'POST', `/orders/${o2.id}/cancel`, { reason: 'Guest left' });
  check('a waiter cannot cancel a sent order', waiterCancel.status === 403, waiterCancel.status);
  const cancelled = await call(S.manager, 'POST', `/orders/${o2.id}/cancel`, { reason: 'Guest left' });
  check('the manager cancels it; its tickets cancel', cancelled.body.status === 'cancelled', cancelled.body.status);
  const open = await one(`SELECT count(*)::int AS n FROM kitchen_tickets WHERE order_id = $1 AND status NOT IN ('cancelled', 'served')`, [o2.id]);
  check('no ticket of a cancelled order is left to cook', open.n === 0, open.n);
  const noReason = await call(S.manager, 'POST', `/orders/${order.id}/cancel`, { reason: '' });
  check('a cancellation without a reason is refused', noReason.status === 400, noReason.status);
  const released = await call(S.waiter, 'POST', `/sessions/${s2.sessionId}/release`);
  check('the table of a cancelled order can be released', released.status === 200);

  // ---------------------------------------------------------------- 6
  section('6. Refunds');
  const cashPayment = resolved.body.payments.find((p) => p.method === 'cash');
  const cashierRefund = await call(S.cashier, 'POST', `/payments/${cashPayment.id}/refund`, { amountRwf: 1000, reason: 'Cold chips', idempotencyKey: `verify-${randomUUID()}` });
  check('a cashier cannot refund', cashierRefund.status === 403, cashierRefund.status);
  const momoPaid = resolved.body.payments.find((p) => p.id === momoPay.id);
  const refundKey = `verify-refund-${randomUUID()}`;
  const refund = await call(S.manager, 'POST', `/payments/${momoPaid.id}/refund`, { amountRwf: 1500, reason: 'One beer was flat', idempotencyKey: refundKey });
  check('the manager refunds part of the MoMo payment; the bill stays settled', refund.status === 200 && refund.body.settlement.refundedRwf === 1500 && refund.body.settlement.outstandingRwf === 0, refund.body?.settlement ?? refund.body);
  await call(S.manager, 'POST', `/payments/${momoPaid.id}/refund`, { amountRwf: 1500, reason: 'One beer was flat', idempotencyKey: refundKey });
  const refunds = await one(`SELECT count(*)::int AS n FROM pos_refunds WHERE payment_id = $1`, [momoPaid.id]);
  check('the same refund key refunds once', refunds.n === 1, refunds.n);
  const tooMuch = await call(S.manager, 'POST', `/payments/${momoPaid.id}/refund`, { amountRwf: 99999, reason: 'Testing the limit', idempotencyKey: `verify-${randomUUID()}` });
  check('a refund above what is left is refused', tooMuch.status === 422, tooMuch.status);

  // ---------------------------------------------------------------- 7
  section('7. A shift, its variance and its review');
  const regs = (await call(S.manager, 'GET', `/outlets/${OUTLET.kgl}/registers`)).body;
  const freeReg = regs.find((r) => !r.openShiftId);
  check('a free register exists', !!freeReg, regs);
  const shift = (await call(S.manager, 'POST', '/shifts', { registerId: freeReg.id, openingFloatRwf: 20000 })).body;
  check('the manager opens a shift with a float', shift.status === 'open' && shift.expectedCashRwf === 20000, shift);
  const takeaway = (await call(S.manager, 'POST', '/orders', { outletId: OUTLET.kgl, orderType: 'takeaway', lines: [{ serviceItemId: primus.id, quantity: 2 }] })).body;
  await call(S.manager, 'POST', `/orders/${takeaway.id}/payments`, { method: 'cash', amountRwf: 3000, tenderedRwf: 3500, tipRwf: 500, idempotencyKey: `verify-${randomUUID()}` });
  await call(S.manager, 'POST', `/shifts/${shift.id}/movements`, { kind: 'paid_in', amountRwf: 5000, reason: 'Change from the safe' });
  const out = (await call(S.manager, 'POST', `/shifts/${shift.id}/movements`, { kind: 'paid_out', amountRwf: 2000, reason: 'Lemons from the market' })).body;
  // 20,000 float + 3,000 sale + 500 cash tip + 5,000 in - 2,000 out
  check('expected cash: float, sales, cash tip, paid in, paid out', out.expectedCashRwf === 26500, out.expectedCashRwf);
  const closed = (await call(S.manager, 'POST', `/shifts/${shift.id}/close`, { countedCashRwf: 26000, closeNote: 'Five hundred short' })).body;
  check('closing freezes a short variance', closed.status === 'closed' && closed.varianceRwf === -500 && closed.expectedCashRwf === 26500, closed);
  const selfReview = await call(S.manager, 'POST', `/shifts/${shift.id}/review`, {});
  check('nobody reviews their own shift', selfReview.status === 403, selfReview.status);
  const reviewed = await call(S.owner, 'POST', `/shifts/${shift.id}/review`, { note: 'Accepted' });
  check('the owner reviews it', reviewed.body.status === 'reviewed', reviewed.body);
  const closeAudit = await one(`SELECT count(*)::int AS n FROM pos_audit_events WHERE entity_id = $1 AND action IN ('shift.closed', 'shift.reviewed')`, [shift.id]);
  check('close and review are audited', closeAudit.n === 2, closeAudit.n);

  // ---------------------------------------------------------------- 8
  section('8. Isolation');
  const crossBranch = await call(S.waiterRbv, 'GET', `/outlets/${OUTLET.kgl}/floor`);
  check('Rubavu staff cannot read the Kimihurura floor', crossBranch.status === 404, crossBranch.status);
  const crossOrder = await call(S.waiterRbv, 'GET', `/orders/${order.id}`);
  check('nor a Kimihurura order', crossOrder.status === 404, crossOrder.status);
  const ownList = await call(S.waiterRbv, 'GET', `/orders?outletId=${OUTLET.rbv}`);
  check('but reads its own branch', ownList.status === 200 && ownList.body.every((x) => x.outletId === OUTLET.rbv));
  if (S.hotelOwner) {
    const foreign = await call(S.hotelOwner, 'GET', `/outlets/${OUTLET.kgl}/floor`, undefined, { workspaceId: S.cashier.workspaceId });
    check('another business cannot open this workspace', foreign.status === 403 || foreign.status === 404, foreign.status);
    const ownWorkspace = await call(S.hotelOwner, 'GET', `/outlets/${OUTLET.kgl}/floor`);
    check('nor reach its outlet from its own workspace', ownWorkspace.status === 404, ownWorkspace.status);
  } else {
    console.log('  SKIP  the hotel owner persona is not seeded; tenant isolation not exercised');
  }
} catch (error) {
  failures += 1;
  console.error(`\nverify-pos: ${error instanceof Error ? error.stack : error}`);
} finally {
  await db.end();
}

console.log(failures === 0 ? '\nverify-pos: every check passed.' : `\nverify-pos: ${failures} check(s) failed.`);
process.exitCode = failures === 0 ? 0 : 1;
