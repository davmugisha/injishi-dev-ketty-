#!/usr/bin/env node
/**
 * ADR-050 SLICE 1, END TO END: a guest orders a coffee, the desk delivers it,
 * the guest checks out, and the bill is signed.
 *
 * What this proves against a RUNNING API and a real Postgres, and not in a unit
 * test: the guest surface is filtered on the server (AC-19, AC-22); the order
 * posts to the bill with the outlet's taxpayer (AC-21, contract 1); check out
 * needs `folio.close` and closes the settled bill (AC-4, AC-8); closing raises
 * exactly ONE `NS` over the host's own lines, its lines describe what was sold,
 * it carries a minted receipt number and every host charge names it (AC-2,
 * AC-9, AC-10); a missing EBM connection writes the declaration `failed` with
 * `no_connection` and never blocks the desk (D-b); a late charge on a signed
 * bill opens the stay's next bill rather than touching it (AC-6, task 14); and
 * each change wrote its outbox row (AC-32).
 *
 * What it CANNOT prove, and does not pretend to: that the VSDC certifies the
 * sale. The EBM provider API can only certify a booking's normal sale, so a
 * folio `NS` is parked by the worker until ADR-050 settles whether Injishi is
 * the certified system. That is `.unlazy/ebm-live-invoice` G12 and G13's job.
 *
 * RUN IT against a PRODUCTION process over a sample database, because a demo
 * process declares nothing at all (ADR-041 D-p):
 *
 *   INJISHI_ENVIRONMENT=production INJISHI_DATABASE_KIND=sample PORT=8010 \
 *     BETTER_AUTH_URL=http://localhost:8010 node dist/main.js
 *   VERIFY_API_URL=http://localhost:8010 DATABASE_URL=... node scripts/verify-guest-order.mjs
 *
 * Codes are random on a production process, so this reads each one from
 * Mailpit. Set VERIFY_OTP_CODE to skip that on a process with a fixed code.
 *
 * FIXTURES. Nothing in slice 1 creates an outlet (that is slice 4's `/outlets`
 * page) or ties a walk in to a guest account (that is the claim flow), so this
 * writes both directly, marked `(verify)`, and ONLY into a database carrying the
 * sample marker. Everything after the fixtures goes through HTTP.
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import pg from 'pg';

import { assertSampleDatabase } from './sample-database.mjs';

const API = process.env.VERIFY_API_URL || 'http://localhost:8000';
const MAILPIT = process.env.VERIFY_MAILPIT_URL || 'http://localhost:8025';
const FIXED_CODE = process.env.VERIFY_OTP_CODE || null;

let failures = 0;
function check(label, ok, detail) {
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok || detail === undefined ? '' : `   ${detail}`}`);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Codes already used, per address, so a log read never reuses a spent one. */
const seenCodes = new Map();
if (process.env.VERIFY_API_LOG) {
  // Everything already in the log was sent before this run and is spent.
  for (const m of readFileSync(process.env.VERIFY_API_LOG, 'utf8').matchAll(/OTP for (\S+?) [^:]*: (\d{6})/g)) {
    const seen = seenCodes.get(m[1]) ?? new Set();
    seen.add(m[2]);
    seenCodes.set(m[1], seen);
  }
}

/**
 * The newest six digit code for `email`, sent after `since`.
 *
 * From Mailpit, or, when `VERIFY_API_LOG` names the API's log file, from the
 * `[OTP_DEBUG_LOG]` line the API writes when SMTP delivery fails. Whichever
 * answers first.
 */
async function codeFor(email, since) {
  if (FIXED_CODE) return FIXED_CODE;
  const logFile = process.env.VERIFY_API_LOG;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (logFile) {
      const text = readFileSync(logFile, 'utf8');
      const pattern = new RegExp(`OTP for ${email.replace(/[.@]/g, '\\$&')}[^:]*: (\\d{6})`, 'g');
      const found = [...text.matchAll(pattern)].map((m) => m[1]);
      const seen = seenCodes.get(email) ?? new Set();
      const next = found.find((code) => !seen.has(code));
      if (next) {
        seen.add(next);
        seenCodes.set(email, seen);
        return next;
      }
    }
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}&limit=5`);
    const { messages = [] } = await res.json();
    const fresh = messages.find((m) => Date.parse(m.Created) >= since - 1000);
    if (fresh) {
      const full = await (await fetch(`${MAILPIT}/api/v1/message/${fresh.ID}`)).json();
      const match = /\b(\d{6})\b/.exec(`${fresh.Subject} ${full.Text ?? ''}`);
      if (match) return match[1];
    }
    await sleep(250);
  }
  throw new Error(`no code reached Mailpit for ${email}`);
}

function jar(res) {
  return (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
}

async function sessionFor(email, { staff }) {
  const sentAt = Date.now();
  const sent = await fetch(`${API}/api/auth/email-otp/send-verification-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, type: 'sign-in' }),
  });
  // A 429 is the per address send cap (ADR-039), usually spent by an earlier
  // run within the hour. Say so, rather than waiting on a code never sent.
  if (!sent.ok) throw new Error(`${email}: code send ${sent.status} ${await sent.text()}`);
  const res = await fetch(`${API}/api/auth/sign-in/email-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp: await codeFor(email, sentAt) }),
  });
  if (!res.ok) throw new Error(`${email}: sign-in ${res.status} ${await res.text()}`);
  const cookie = jar(res);

  let workspaceId = null;
  if (staff) {
    // Every operator route demands the second factor first (F-S02).
    const stepAt = Date.now();
    const stepSent = await fetch(`${API}/api/v1/me/two-factor/send`, { method: 'POST', headers: { cookie } });
    if (!stepSent.ok) throw new Error(`${email}: step-up send ${stepSent.status} ${await stepSent.text()}`);
    const verified = await fetch(`${API}/api/v1/me/two-factor/verify`, {
      method: 'POST',
      headers: { cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: await codeFor(email, stepAt) }),
    });
    if (!verified.ok) throw new Error(`${email}: step-up ${verified.status} ${await verified.text()}`);
    const { workspaces = [] } = await (await fetch(`${API}/api/v1/me/workspaces`, { headers: { cookie } })).json();
    workspaceId = workspaces.find((w) => w.kind === 'business' && w.domain === 'hospitality')?.workspaceId ?? null;
    if (!workspaceId) throw new Error(`${email}: holds no hospitality workspace`);
  }
  return { email, cookie, workspaceId };
}

function call(who, method, path, { body, key } = {}) {
  const headers = { cookie: who.cookie };
  if (who.workspaceId) headers['x-workspace-id'] = who.workspaceId;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (key) headers['Idempotency-Key'] = key;
  return fetch(`${API}/api/v1${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
await assertSampleDatabase(db, 'verify-guest-order.mjs');
const one = async (sql, params) => (await db.query(sql, params)).rows[0];
const all = async (sql, params) => (await db.query(sql, params)).rows;

console.log(`ADR-050 slice 1 against ${API}\n`);

const desk = await sessionFor('reception@injishi.com', { staff: true });
const cleaner = await sessionFor('housekeeper@injishi.com', { staff: true });
const guest = await sessionFor('guest@injishi.com', { staff: false });
const guestUser = await one(`select id from users where email = 'guest@injishi.com'`);

// --- Fixtures -----------------------------------------------------------------
const run = new Date().toISOString().slice(0, 19);
const property = await one(
  `select p.id, p.org_id from properties p where p.workspace_id = $1 order by p.created_at limit 1`,
  [desk.workspaceId],
);
const fnb = await one(
  `select id from departments where property_id = $1 and department_category = 'fnb' and is_revenue_center limit 1`,
  [property.id],
);
async function fixtureOutlet(name, access) {
  const outlet = await one(
    `insert into outlets (department_id, property_id, workspace_id, tax_entity_org_id, name, outlet_kind, ordering_access)
     values ($1, $2, $3, $4, $5, 'restaurant', $6) returning id`,
    [fnb.id, property.id, desk.workspaceId, property.org_id, `(verify ${run}) ${name}`, access],
  );
  const category = await one(
    `insert into service_categories (department_id, outlet_id, property_id, workspace_id, name)
     values ($1, $2, $3, $4, 'Drinks') returning id`,
    [fnb.id, outlet.id, property.id, desk.workspaceId],
  );
  // Classified, because since ADR-050 slice 3 an item without its RRA codes is
  // neither listed nor sold (D-m). The code is minted here the way the service
  // mints it: §4.17's shape, and the org's next serial.
  const { next } = await one(
    `select coalesce(max(substring(si.rra_item_cd from '(\\d{7})$')::int), 0) + 1 as next
       from service_items si join workspaces w on w.id = si.workspace_id
      where w.org_id = $1 and si.rra_item_cd is not null`,
    [property.org_id],
  );
  const item = await one(
    `insert into service_items (service_category_id, department_id, outlet_id, property_id, workspace_id, name, price_rwf, tax_code, guest_orderable,
                                rra_item_cls_cd, rra_item_ty_cd, rra_pkg_unit_cd, rra_qty_unit_cd, rra_item_cd)
     values ($1, $2, $3, $4, $5, 'Coffee', 2000, 'TAX_B', true, '1110170400', '2', 'NT', 'U', $6) returning id`,
    [category.id, fnb.id, outlet.id, property.id, desk.workspaceId, `RW2NTU${String(next).padStart(7, '0')}`],
  );
  return { id: outlet.id, itemId: item.id };
}
const cafe = await fixtureOutlet('Lobby cafe', 'in_house_only');
const bar = await fixtureOutlet('Street bar', 'walk_in_only');

console.log('=== The stay ===');
const { rooms = [] } = await (await call(desk, 'GET', '/ops/rooms')).json();
const free = rooms.find((r) => r.status === 'available' && r.occupiedBy === null);
check('a free room exists to check the guest into', Boolean(free));
const walkIn = await call(desk, 'POST', '/ops/stays/walk-in', {
  body: { roomId: free.id, guestName: '(verify) Guest' },
});
check('the desk checks a walk in guest in', walkIn.status === 201, `got ${walkIn.status}`);
const stay = await walkIn.json();
// Stands in for the claim flow: tie the stay and its bill to the guest account.
await db.query(`update guest_stays set guest_user_id = $1 where id = $2`, [guestUser.id, stay.id]);
await db.query(`update folios set guest_user_id = $1 where guest_stay_id = $2`, [guestUser.id, stay.id]);
const folio = await one(`select id from folios where guest_stay_id = $1`, [stay.id]);

console.log('\n=== The guest surface is filtered on the server (AC-19, AC-22) ===');
const listRes = await call(guest, 'GET', '/me/orderable');
check('GET /me/orderable answers 200', listRes.status === 200, `got ${listRes.status}`);
const { outlets = [] } = await listRes.json();
const listedCafe = outlets.find((o) => o.id === cafe.id);
check('the in house cafe is listed, charge to room', listedCafe?.chargeToRoom === true);
check('its coffee is on the menu', listedCafe?.categories?.[0]?.items?.[0]?.id === cafe.itemId);
// Since slice 3 a guest may also pay now as a walk in (D-o), so the bar IS
// listed at their own hotel, but never as something to charge to the room.
const listedBar = outlets.find((o) => o.id === bar.id);
check('the walk in only bar is offered pay now only, never charge to room', !listedBar || (listedBar.chargeToRoom === false && listedBar.payNow === true), JSON.stringify(listedBar)?.slice(0, 200));

const noKey = await call(guest, 'POST', '/me/orders', {
  body: { outletId: cafe.id, items: [{ serviceItemId: cafe.itemId, quantity: 1 }] },
});
check('an order with no Idempotency-Key is refused', noKey.status === 400, `got ${noKey.status}`);

const toBar = await call(guest, 'POST', '/me/orders', {
  key: randomUUID(),
  body: { outletId: bar.id, items: [{ serviceItemId: bar.itemId, quantity: 1 }] },
});
const barBody = await toBar.json();
check('ordering from the walk in only bar is refused 403, even with the button hidden', toBar.status === 403, `got ${toBar.status}`);
check('and the refusal is a sentence a guest can act on', /counter/.test(barBody.message ?? ''), barBody.message);

console.log('\n=== The order (AC-21, AC-23) ===');
const key = randomUUID();
const placed = await call(guest, 'POST', '/me/orders', {
  key,
  body: { outletId: cafe.id, items: [{ serviceItemId: cafe.itemId, quantity: 2 }] },
});
const order = await placed.json();
check('POST /me/orders answers 201', placed.status === 201, `got ${placed.status} ${JSON.stringify(order)}`);
check('the order is submitted, two coffees at 2,000', order.status === 'submitted' && order.subtotalRwf === 4000);
const replay = await call(guest, 'POST', '/me/orders', {
  key,
  body: { outletId: cafe.id, items: [{ serviceItemId: cafe.itemId, quantity: 2 }] },
});
check('a retry with the same key answers the same order, not a second one', (await replay.json()).id === order.id);
const orderRow = await one(`select channel, outlet_id, ordered_by_user_id, folio_id from service_orders where id = $1`, [order.id]);
check('it was placed through the guest app, from the cafe, by the guest, on the stay bill',
  orderRow.channel === 'guest_app' && orderRow.outlet_id === cafe.id && orderRow.ordered_by_user_id === guestUser.id && orderRow.folio_id === folio.id);

// The menu changes after the order: the order must not.
await db.query(`update service_items set price_rwf = 9999 where id = $1`, [cafe.itemId]);

for (const to of ['acknowledged', 'in_progress', 'ready', 'delivered']) {
  const moved = await call(desk, 'POST', `/ops/service-orders/${order.id}/advance`, { body: { to } });
  check(`the desk moves it to ${to}`, moved.status === 201 || moved.status === 200, `got ${moved.status}`);
}

const charges = await all(
  `select charge_type, amount_rwf, tax_entity_org_id, outlet_id from folio_charges where folio_id = $1 order by posted_at`,
  [folio.id],
);
const orderCharge = charges.find((c) => c.charge_type === 'service_order');
check('delivery posted the order to the bill at its locked price', Number(orderCharge?.amount_rwf) === 4000, JSON.stringify(orderCharge));
check("the line carries the cafe and the cafe's taxpayer (contract 1)",
  orderCharge?.outlet_id === cafe.id && orderCharge?.tax_entity_org_id === property.org_id);
check('its tax line belongs to the same taxpayer',
  charges.filter((c) => c.charge_type === 'tax').every((c) => c.tax_entity_org_id === property.org_id));

console.log('\n=== Settling, and who may check out (AC-8) ===');
const { balance_rwf: owed } = await one(`select balance_rwf from folios where id = $1`, [folio.id]);
const paid = await call(desk, 'POST', `/ops/folios/${folio.id}/payments`, {
  key: randomUUID(),
  body: { amountRwf: Number(owed), method: 'cash' },
});
check('the desk takes the balance in cash', paid.status === 201 || paid.status === 200, `got ${paid.status}`);
const payment = await one(`select payment_method_code from folio_charges where folio_id = $1 and charge_type = 'payment'`, [folio.id]);
check('the payment line carries RRA means of payment 01', payment?.payment_method_code === '01', JSON.stringify(payment));

const cleanerOut = await call(cleaner, 'POST', `/ops/stays/${stay.id}/checkout`);
check('a housekeeper is refused check out', cleanerOut.status === 403, `got ${cleanerOut.status}`);

const out = await call(desk, 'POST', `/ops/stays/${stay.id}/checkout`);
check('a receptionist checks the guest out, with no EBM connection behind the business', out.status === 201 || out.status === 200, `got ${out.status}`);

console.log('\n=== The bill is signed once (AC-2, AC-4, AC-9, AC-10, D-b) ===');
const signed = await one(`select status, locked_at from folios where id = $1`, [folio.id]);
const stayRow = await one(`select lifecycle from guest_stays where id = $1`, [stay.id]);
check('the stay is closed', stayRow.lifecycle === 'closed');
check('the bill is closed and LOCKED', signed.status === 'closed' && signed.locked_at !== null, JSON.stringify(signed));

const sales = await all(
  `select id, source, receipt_label, status, last_error, cis_receipt_no, org_id, adapter_mode from ebm_invoices where folio_id = $1`,
  [folio.id],
);
check('closing raised exactly ONE fiscal document for the bill', sales.length === 1, `got ${sales.length}`);
const sale = sales[0] ?? {};
check('it is an NS sourced from the folio, under the host', sale.source === 'folio' && sale.receipt_label === 'NS' && sale.org_id === property.org_id, JSON.stringify(sale));
check('with no connection it is written failed / no_connection, and the desk was not blocked', sale.status === 'failed' && sale.last_error === 'no_connection', JSON.stringify(sale));
check('it carries a minted receipt number', Number.isInteger(sale.cis_receipt_no) && sale.cis_receipt_no > 0, String(sale.cis_receipt_no));

const lines = await all(
  `select description, quantity, unit_price_rwf, line_total_rwf, tax_code, service_order_item_id from ebm_invoice_lines where ebm_invoice_id = $1`,
  [sale.id],
);
const coffee = lines.find((l) => l.description === 'Coffee');
check('the receipt describes the coffee from its order snapshot', Boolean(coffee?.service_order_item_id), JSON.stringify(lines));
// One line on the order, so its whole tax is this line's tax.
check('priced tax inclusive at the LOCKED price, not the edited menu', Number(coffee?.line_total_rwf) === 4000 + order.taxRwf && Number(coffee?.quantity) === 2, `${JSON.stringify(coffee)} tax ${order.taxRwf}`);
check('no tax line is itself a receipt line', !lines.some((l) => /^Tax on/.test(l.description ?? '')));

const undeclared = await all(
  `select id, charge_type from folio_charges where folio_id = $1 and ebm_invoice_id is distinct from $2`,
  [folio.id, sale.id],
);
check('every line on the bill now names that document, so none can be declared twice', undeclared.length === 0, JSON.stringify(undeclared));

console.log('\n=== After signing: a late charge opens the next bill (AC-6, task 14) ===');
const lateKey = randomUUID();
const lateBody = { chargeType: 'pos', departmentId: fnb.id, description: '(verify) minibar', amountRwf: 1500, quantity: 1 };
const late = await call(desk, 'POST', `/ops/folios/${folio.id}/charges`, { key: lateKey, body: lateBody });
const lateResult = await late.json();
check('a late charge on the signed bill is accepted, not refused', late.status === 201 || late.status === 200, `got ${late.status} ${JSON.stringify(lateResult)}`);
const nextBill = await one(
  `select id, folio_number, folio_sequence, locked_at, status from folios where guest_stay_id = $1 and folio_sequence = 2`,
  [stay.id],
);
const firstBill = await one(`select folio_number from folios where id = $1`, [folio.id]);
check('it opened folio sequence 2 for the same stay', Boolean(nextBill) && lateResult.openedFolioId === nextBill.id && lateResult.id === nextBill.id, JSON.stringify({ nextBill, openedFolioId: lateResult.openedFolioId }));
check("numbered the original's number with -2 appended", nextBill?.folio_number === `${firstBill.folio_number}-2`, nextBill?.folio_number);
check('the new bill is open and unlocked', nextBill?.status === 'open' && nextBill?.locked_at === null, JSON.stringify(nextBill));
const onSigned = await one(`select count(*)::int as n from folio_charges where folio_id = $1 and description = '(verify) minibar'`, [folio.id]);
check('nothing was added to the signed bill', onSigned.n === 0, String(onSigned.n));
const lateLines = await all(`select charge_type, amount_rwf, ebm_invoice_id from folio_charges where folio_id = $1 order by posted_at`, [nextBill?.id]);
check('the charge and its tax sit on the new bill, undeclared', lateLines.length === 2 && lateLines.every((l) => l.ebm_invoice_id === null), JSON.stringify(lateLines));
const lateReplay = await call(desk, 'POST', `/ops/folios/${folio.id}/charges`, { key: lateKey, body: lateBody });
const lateReplayBody = await lateReplay.json();
check('a retry of the late charge answers the same bill, not a third', lateReplayBody.id === nextBill?.id && (await one(`select count(*)::int as n from folios where guest_stay_id = $1`, [stay.id])).n === 2, JSON.stringify({ status: lateReplay.status, id: lateReplayBody.id }));
const latePayment = await call(desk, 'POST', `/ops/folios/${folio.id}/payments`, { key: randomUUID(), body: { amountRwf: 100, method: 'cash' } });
check('a payment aimed at the signed bill is still refused 409', latePayment.status === 409, `got ${latePayment.status}`);

const again = await call(desk, 'POST', `/ops/folios/${folio.id}/close`);
const againBody = await again.json();
check('closing it again replays the same declaration rather than raising a second', againBody.declaration?.emissionId === sale.id, JSON.stringify(againBody.declaration));

const afterList = await (await call(guest, 'GET', '/me/orderable')).json();
check('the guest who left can no longer order from the cafe', !afterList.outlets.some((o) => o.id === cafe.id));

console.log('\n=== The outbox (AC-32) ===');
const events = await all(
  `select event_type, dedupe_key from outbox_events where aggregate_id = any($1::uuid[]) order by created_at`,
  [[order.id, folio.id, sale.id]],
);
const types = events.map((e) => e.event_type);
check('the order wrote order.status for submitted and delivered', types.filter((t) => t === 'order.status').length >= 5, types.join(', '));
check('each charge wrote folio.balance', types.includes('folio.balance'));
check('the signing wrote ebm.sale', types.includes('ebm.sale'));
check('no event payload carries an amount or a name', (await all(
  `select payload from outbox_events where aggregate_id = any($1::uuid[])`, [[order.id, folio.id, sale.id]],
)).every(({ payload }) => !/amount|Rwf|name|phone/i.test(Object.keys(payload ?? {}).join(' '))));

await db.end();
console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
