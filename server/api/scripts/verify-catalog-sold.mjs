#!/usr/bin/env node
/**
 * ADR-050 SLICE 3, END TO END: the catalog can be sold.
 *
 * What this proves against a RUNNING API and a real Postgres:
 *
 * - An item carries its RRA codes, prefilled from its menu, and its `itemCd` is
 *   minted once in VSDC v1.0.5 §4.17's shape (D-m, AC-20).
 * - Nothing sells without them, on ANY channel: turning an item orderable
 *   without them is a 422, and an item already flagged orderable without them
 *   is left off the guest's list and refused at the guest AND the staff order
 *   routes (D-m amended, AC-20).
 * - A walk in near an outlet sees it, pay now only (D-o, AC-22).
 * - A pay now order on mobile money waits `pending_payment`, is polled like a
 *   booking, settles to `submitted`, raises ONE `NS` sourced from the order with
 *   means of payment `06`, and never touches a bill (D-n, AC-21, AC-24).
 * - A declined prompt fails the order (D-n).
 * - A pay now order paid in cash needs `folio.payment`, the exact total, and
 *   records who took it with means of payment `01` (D-p, AC-24).
 * - Modifiers price from the item and are snapshotted (AC-23).
 * - A guest cancels an unpaid order and cannot cancel a paid one.
 * - `payment_attempts` refuses an attempt carrying both purposes' inputs.
 * - Every change wrote its `outbox_events` row (AC-32).
 *
 * What it CANNOT prove: that the VSDC certifies a sale. The EBM provider API has
 * no item for an order's lines, so the worker parks every `outlet_order` row
 * until ADR-050 settles whether Injishi is the certified system.
 *
 * RUN IT against a PRODUCTION process over a sample database, because a demo
 * process declares nothing (ADR-041 D-p). A short mock approval keeps it quick:
 *
 *   INJISHI_ENVIRONMENT=production INJISHI_DATABASE_KIND=sample PORT=8010 \
 *     BETTER_AUTH_URL=http://localhost:8010 MOCK_MOMO_APPROVAL_MS=3000 node dist/main.js
 *   VERIFY_API_URL=http://localhost:8010 DATABASE_URL=... node scripts/verify-catalog-sold.mjs
 *
 * FIXTURES. Outlets are slice 4's page, so the outlets and the coordinates of
 * the property are written directly, marked `(verify)`, and ONLY into a
 * database carrying the sample marker. The RRA classification list must hold the
 * VSDC specification's sample codes (`pnpm db:seed` loads them). The menu itself
 * is built through HTTP.
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

const seenCodes = new Map();
if (process.env.VERIFY_API_LOG) {
  for (const m of readFileSync(process.env.VERIFY_API_LOG, 'utf8').matchAll(/OTP for (\S+?) [^:]*: (\d{6})/g)) {
    const seen = seenCodes.get(m[1]) ?? new Set();
    seen.add(m[2]);
    seenCodes.set(m[1], seen);
  }
}

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

async function json(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

const ok = (res) => res.status === 200 || res.status === 201;

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
await assertSampleDatabase(db, 'verify-catalog-sold.mjs');
const one = async (sql, params) => (await db.query(sql, params)).rows[0];
const all = async (sql, params) => (await db.query(sql, params)).rows;

console.log(`ADR-050 slice 3 against ${API}\n`);

const owner = await sessionFor('host@injishi.com', { staff: true });
const desk = await sessionFor('reception@injishi.com', { staff: true });
const cleaner = await sessionFor('housekeeper@injishi.com', { staff: true });
const guest = await sessionFor('guest@injishi.com', { staff: false });
const guestUser = await one(`select id from users where email = 'guest@injishi.com'`);
const deskUser = await one(`select id from users where email = 'reception@injishi.com'`);

const classified = await one(`select count(*)::int as n from rra_item_classifications where code in ('1110160600', '1110170400') and active`);
if (classified.n !== 2) {
  console.error('The classification list lacks the VSDC sample codes. Run scripts/sync-rra-classifications.mjs with the sample file first.');
  process.exit(1);
}

// --- Fixtures -----------------------------------------------------------------
const run = new Date().toISOString().slice(0, 19);
const property = await one(
  `select p.id, p.org_id, p.latitude, p.longitude from properties p where p.workspace_id = $1 order by p.created_at limit 1`,
  [owner.workspaceId],
);
const fnb = await one(
  `select id from departments where property_id = $1 and department_category = 'fnb' and is_revenue_center limit 1`,
  [property.id],
);
// Kigali, if the seeded property has no coordinates; restored at the end.
const HERE = { lat: -1.9441, lng: 30.0619 };
const hadCoordinates = property.latitude !== null && property.longitude !== null;
if (!hadCoordinates) {
  await db.query(`update properties set latitude = $2, longitude = $3 where id = $1`, [property.id, HERE.lat, HERE.lng]);
}
const at = hadCoordinates ? { lat: Number(property.latitude), lng: Number(property.longitude) } : HERE;

async function fixtureOutlet(name, access) {
  return one(
    `insert into outlets (department_id, property_id, workspace_id, tax_entity_org_id, name, outlet_kind, ordering_access)
     values ($1, $2, $3, $4, $5, 'bar', $6) returning id`,
    [fnb.id, property.id, owner.workspaceId, property.org_id, `(verify ${run}) ${name}`, access],
  );
}
const terrace = await fixtureOutlet('Terrace bar', 'both');
const lounge = await fixtureOutlet('Residents lounge', 'in_house_only');

try {
  console.log('=== The menu carries RRA codes (D-m, AC-20) ===');
  const search = await json(await call(owner, 'GET', '/ops/rra/classifications?q=1110'));
  check('the classification picker finds the sample codes', search.classifications?.some((c) => c.code === '1110170400'), JSON.stringify(search).slice(0, 200));
  const deskSearch = await call(desk, 'GET', '/ops/rra/classifications?q=1110');
  check('the picker is behind menu.manage (a receptionist gets 403)', deskSearch.status === 403, `got ${deskSearch.status}`);

  const withDefaults = await call(owner, 'POST', '/ops/service-catalog/categories', {
    body: {
      propertyId: property.id,
      departmentId: fnb.id,
      outletId: terrace.id,
      name: `(verify ${run}) Drinks`,
      defaultRraItemClsCd: '1110170400',
      defaultRraItemTyCd: '2',
      defaultRraPkgUnitCd: 'NT',
      defaultRraQtyUnitCd: 'U',
    },
  });
  const menuAfterCategory = await json(withDefaults);
  check('the owner adds a menu pointed at the outlet, with RRA prefills', ok(withDefaults), `got ${withDefaults.status} ${JSON.stringify(menuAfterCategory).slice(0, 300)}`);
  const drinks = menuAfterCategory.categories?.find((c) => c.name === `(verify ${run}) Drinks`);
  check('the menu names its outlet and its prefills', drinks?.outletId === terrace.id && drinks?.defaultRraItemTyCd === '2', JSON.stringify(drinks));

  const bare = await json(await call(owner, 'POST', '/ops/service-catalog/categories', {
    body: { propertyId: property.id, departmentId: fnb.id, outletId: terrace.id, name: `(verify ${run}) Specials` },
  }));
  const specials = bare.categories?.find((c) => c.name === `(verify ${run}) Specials`);

  const juiceRes = await call(owner, 'POST', '/ops/service-catalog/items', {
    body: {
      serviceCategoryId: drinks.id,
      name: '(verify) Juice',
      priceRwf: 3000,
      options: [
        { name: 'Size', required: true, maxChoices: 1, choices: [{ label: 'Small', priceDeltaRwf: 0 }, { label: 'Large', priceDeltaRwf: 1000 }] },
      ],
    },
  });
  const afterJuice = await json(juiceRes);
  const juice = afterJuice.categories?.find((c) => c.id === drinks.id)?.items?.find((i) => i.name === '(verify) Juice');
  check('an item created on a prefilled menu takes its codes', ok(juiceRes) && juice?.rraItemClsCd === '1110170400' && juice?.rraPkgUnitCd === 'NT', JSON.stringify(juice));
  check("its itemCd is minted in §4.17's shape", /^RW2NTU\d{7}$/.test(juice?.rraItemCd ?? ''), juice?.rraItemCd);
  check('and, left unsaid, it is orderable because it can be sold', juice?.guestOrderable === true && juice?.missingRra?.length === 0, JSON.stringify(juice));

  const cokeRes = await call(owner, 'POST', '/ops/service-catalog/items', {
    body: { serviceCategoryId: drinks.id, name: '(verify) Soda', priceRwf: 1500 },
  });
  const coke = (await json(cokeRes)).categories?.find((c) => c.id === drinks.id)?.items?.find((i) => i.name === '(verify) Soda');
  check('a second item in the same org takes the next serial', Number(coke?.rraItemCd?.slice(-7)) === Number(juice?.rraItemCd?.slice(-7)) + 1, `${juice?.rraItemCd} then ${coke?.rraItemCd}`);

  const refused = await call(owner, 'POST', '/ops/service-catalog/items', {
    body: { serviceCategoryId: specials.id, name: '(verify) Mystery', priceRwf: 2500, guestOrderable: true },
  });
  const refusedBody = await json(refused);
  check('an item made orderable with no codes is refused 422', refused.status === 422, `got ${refused.status} ${refusedBody.message}`);
  const draftRes = await call(owner, 'POST', '/ops/service-catalog/items', {
    body: { serviceCategoryId: specials.id, name: '(verify) Mystery', priceRwf: 2500, rraItemClsCd: '1110160600', rraItemTyCd: '2', rraPkgUnitCd: 'NT' },
  });
  const mystery = (await json(draftRes)).categories?.find((c) => c.id === specials.id)?.items?.find((i) => i.name === '(verify) Mystery');
  check('left unsaid on an item missing a unit, it is created NOT orderable, with no code', mystery?.guestOrderable === false && mystery?.rraItemCd === null && mystery?.missingRra?.includes('quantityUnit'), JSON.stringify(mystery));
  const turnOn = await call(owner, 'PATCH', `/ops/service-catalog/items/${mystery.id}`, { body: { guestOrderable: true } });
  check('turning it orderable while it lacks a quantity unit is refused 422', turnOn.status === 422, `got ${turnOn.status}`);
  const fixed = await json(await call(owner, 'PATCH', `/ops/service-catalog/items/${mystery.id}`, { body: { rraQtyUnitCd: 'u', guestOrderable: true } }));
  const mysteryNow = fixed.categories?.find((c) => c.id === specials.id)?.items?.find((i) => i.id === mystery.id);
  check('adding the unit (case folded) mints its code and lets it sell', mysteryNow?.guestOrderable === true && /^RW2NTU\d{7}$/.test(mysteryNow?.rraItemCd ?? ''), JSON.stringify(mysteryNow));
  const renamed = await json(await call(owner, 'PATCH', `/ops/service-catalog/items/${mystery.id}`, { body: { name: '(verify) Mystery cocktail', rraPkgUnitCd: 'BA' } }));
  const kept = renamed.categories?.find((c) => c.id === specials.id)?.items?.find((i) => i.id === mystery.id);
  check('renaming it or changing its units never re mints the code', kept?.rraItemCd === mysteryNow?.rraItemCd, `${mysteryNow?.rraItemCd} -> ${kept?.rraItemCd}`);

  // The legacy case: flagged orderable before the codes existed.
  const legacy = await one(
    `insert into service_items (service_category_id, department_id, outlet_id, property_id, workspace_id, name, price_rwf, tax_code, guest_orderable)
     values ($1, $2, $3, $4, $5, '(verify) Old stock', 1000, 'TAX_B', true) returning id`,
    [drinks.id, fnb.id, terrace.id, property.id, owner.workspaceId],
  );

  console.log('\n=== A walk in sees the outlet, pay now only (D-o, AC-22) ===');
  const nearRes = await call(guest, 'GET', `/me/orderable?lat=${at.lat}&lng=${at.lng}`);
  const near = await json(nearRes);
  const listedTerrace = near.outlets?.find((o) => o.id === terrace.id);
  check('GET /me/orderable with coordinates answers 200', nearRes.status === 200, `got ${nearRes.status} ${JSON.stringify(near).slice(0, 200)}`);
  check('the both outlet is listed to a guest staying nowhere, pay now, not to the room', listedTerrace?.payNow === true && listedTerrace?.chargeToRoom === false, JSON.stringify(listedTerrace)?.slice(0, 300));
  check('with its distance', typeof listedTerrace?.distanceKm === 'number' && listedTerrace.distanceKm <= 5, String(listedTerrace?.distanceKm));
  check('the in house only lounge is not listed to a walk in', !near.outlets?.some((o) => o.id === lounge.id));
  const listedItems = listedTerrace?.categories?.flatMap((c) => c.items) ?? [];
  check('the classified juice is listed with its modifiers', listedItems.some((i) => i.id === juice.id && i.options?.[0]?.name === 'Size'));
  check('the item flagged orderable WITHOUT codes is left off the list (D-m amended)', !listedItems.some((i) => i.id === legacy.id));
  const far = await json(await call(guest, 'GET', `/me/orderable?lat=${at.lat + 1}&lng=${at.lng}`));
  check('111 km away, the outlet is not near', !far.outlets?.some((o) => o.id === terrace.id));

  console.log('\n=== No codes, no sale, on every channel (AC-20) ===');
  const guestLegacy = await call(guest, 'POST', '/me/orders', {
    key: randomUUID(),
    body: { outletId: terrace.id, context: 'pay_now', items: [{ serviceItemId: legacy.id, quantity: 1 }] },
  });
  check('the guest route refuses the unclassified item 422', guestLegacy.status === 422, `got ${guestLegacy.status} ${(await json(guestLegacy)).message}`);
  const staffLegacy = await call(desk, 'POST', '/ops/service-orders', {
    body: { context: 'pay_now', items: [{ serviceItemId: legacy.id, quantity: 1 }] },
  });
  check('the staff route refuses it 422 too', staffLegacy.status === 422, `got ${staffLegacy.status} ${(await json(staffLegacy)).message}`);
  const lounged = await call(guest, 'POST', '/me/orders', {
    key: randomUUID(),
    body: { outletId: lounge.id, context: 'pay_now', items: [{ serviceItemId: juice.id, quantity: 1, selectedOptions: [{ name: 'Size', choices: ['Small'] }] }] },
  });
  check('a walk in paying now at an in house only outlet is refused 403 (AC-19)', lounged.status === 403, `got ${lounged.status}`);
  const toRoom = await call(guest, 'POST', '/me/orders', {
    key: randomUUID(),
    body: { outletId: terrace.id, items: [{ serviceItemId: juice.id, quantity: 1, selectedOptions: [{ name: 'Size', choices: ['Small'] }] }] },
  });
  check('a guest staying nowhere cannot charge to a room, with a sentence', toRoom.status === 403 && /Pay now/.test((await json(toRoom)).message ?? ''), `got ${toRoom.status}`);
  const noSize = await call(guest, 'POST', '/me/orders', {
    key: randomUUID(),
    body: { outletId: terrace.id, context: 'pay_now', items: [{ serviceItemId: juice.id, quantity: 1 }] },
  });
  check('a required modifier left out is refused 422', noSize.status === 422, `got ${noSize.status}`);
  const wrongNetwork = await call(guest, 'POST', '/me/orders', {
    key: randomUUID(),
    body: { outletId: terrace.id, context: 'pay_now', instrument: { kind: 'mobile_money', network: 'mtn_momo', msisdn: '721234567' }, items: [{ serviceItemId: coke.id, quantity: 1 }] },
  });
  check('an Airtel number filed under MTN is refused 422 before anything is written', wrongNetwork.status === 422, `got ${wrongNetwork.status}`);

  console.log('\n=== Pay now, mobile money (D-n, AC-21, AC-24) ===');
  const momoKey = randomUUID();
  const momoBody = {
    outletId: terrace.id,
    context: 'pay_now',
    instrument: { kind: 'mobile_money', network: 'mtn_momo', msisdn: '781234567' },
    items: [{ serviceItemId: juice.id, quantity: 2, selectedOptions: [{ name: 'Size', choices: ['Large'] }] }],
  };
  const placed = await call(guest, 'POST', '/me/orders', { key: momoKey, body: momoBody });
  const order = await json(placed);
  check('POST /me/orders answers 201', placed.status === 201, `got ${placed.status} ${JSON.stringify(order)}`);
  check('the order waits pending_payment, pay now, with an attempt to poll', order.status === 'pending_payment' && order.context === 'pay_now' && order.attempt?.state === 'prompting', JSON.stringify({ status: order.status, attempt: order.attempt }));
  check('the modifier priced the line: 2 x (3,000 + 1,000)', order.subtotalRwf === 8000 && order.lines?.[0]?.unitPriceRwf === 4000 && order.lines?.[0]?.selectedOptions?.[0]?.choices?.[0]?.priceDeltaRwf === 1000, JSON.stringify(order.lines));
  check('the attempt shows a masked number, never the whole one', order.attempt?.payerMasked && !JSON.stringify(order).includes('781234567'));
  const replayed = await json(await call(guest, 'POST', '/me/orders', { key: momoKey, body: momoBody }));
  check('a retry of the same press is the same order and the same attempt', replayed.id === order.id && replayed.attempt?.attemptToken === order.attempt?.attemptToken);

  const beforeSettle = await one(`select folio_id, order_context, tax_entity_org_id, customer_user_id, payment_attempt_id from service_orders where id = $1`, [order.id]);
  check('it names no bill, its taxpayer is the outlet, and the walk in is its customer', beforeSettle.folio_id === null && beforeSettle.tax_entity_org_id === property.org_id && beforeSettle.customer_user_id === guestUser.id, JSON.stringify(beforeSettle));
  const attemptRow = await one(`select purpose, service_order_id, room_type_id, state from payment_attempts where id = $1`, [beforeSettle.payment_attempt_id]);
  check('the attempt is a service_order attempt carrying no stay', attemptRow?.purpose === 'service_order' && attemptRow.service_order_id === order.id && attemptRow.room_type_id === null, JSON.stringify(attemptRow));

  const kitchenEarly = await call(desk, 'POST', `/ops/service-orders/${order.id}/advance`, { body: { to: 'acknowledged' } });
  check('the board cannot move an unpaid order on (409)', kitchenEarly.status === 409, `got ${kitchenEarly.status}`);

  let polled = null;
  for (let i = 0; i < 40; i += 1) {
    polled = await json(await call(guest, 'GET', `/me/orders/attempts/${order.attempt.attemptToken}`));
    if (polled.state !== 'prompting') break;
    await sleep(500);
  }
  check('the poll reaches confirmed once the handset approves', polled?.state === 'confirmed', JSON.stringify(polled)?.slice(0, 300));
  check('and the order it answers with is submitted, paid by 06', polled?.order?.status === 'submitted' && polled?.order?.paymentMethod === '06' && polled?.order?.paidAt, JSON.stringify(polled?.order)?.slice(0, 300));
  const bookingPoll = await call(guest, 'GET', `/bookings/attempts/${order.attempt.attemptToken}`);
  check('the booking poll does not answer an order token (404)', bookingPoll.status === 404, `got ${bookingPoll.status}`);

  const sales = await all(`select id, source, receipt_label, status, last_error, cis_receipt_no, org_id, folio_id, service_order_id from ebm_invoices where service_order_id = $1`, [order.id]);
  check('settling raised exactly ONE fiscal document for the order', sales.length === 1, `got ${sales.length}`);
  const sale = sales[0] ?? {};
  check('an NS sourced from the order, under the outlet taxpayer, naming no bill', sale.source === 'outlet_order' && sale.receipt_label === 'NS' && sale.org_id === property.org_id && sale.folio_id === null, JSON.stringify(sale));
  check('with no EBM connection it is written failed / no_connection', sale.status === 'failed' && sale.last_error === 'no_connection', JSON.stringify(sale));
  check('it carries a minted receipt number', Number.isInteger(sale.cis_receipt_no) && sale.cis_receipt_no > 0, String(sale.cis_receipt_no));
  const saleLines = await all(`select description, quantity, line_total_rwf, rra_item_cls_cd, rra_item_cd, rra_pkg_unit_cd, rra_qty_unit_cd from ebm_invoice_lines where ebm_invoice_id = $1`, [sale.id]);
  check('its line describes the juice with its RRA codes, tax inclusive', saleLines.length === 1 && saleLines[0].rra_item_cd === juice.rraItemCd && saleLines[0].rra_item_cls_cd === '1110170400' && Number(saleLines[0].line_total_rwf) === 8000 + order.taxRwf, JSON.stringify(saleLines));
  const charges = await one(`select count(*)::int as n from folio_charges where source_ref_id = $1`, [order.id]);
  check('a pay now order never touches a bill', charges.n === 0, String(charges.n));
  const paidCancel = await call(guest, 'POST', `/me/orders/${order.id}/cancel`);
  check('the guest cannot cancel a paid order (409), and is sent to the outlet', paidCancel.status === 409 && /outlet/.test((await json(paidCancel)).message ?? ''), `got ${paidCancel.status}`);

  console.log('\n=== A declined prompt (D-n) ===');
  const declined = await json(await call(guest, 'POST', '/me/orders', {
    key: randomUUID(),
    body: { outletId: terrace.id, context: 'pay_now', instrument: { kind: 'mobile_money', network: 'mtn_momo', msisdn: '781230000' }, items: [{ serviceItemId: coke.id, quantity: 1 }] },
  }));
  check('the attempt answers refused, with a sentence', declined.attempt?.state === 'refused' && Boolean(declined.attempt?.failureReason), JSON.stringify(declined.attempt));
  check('and the order is payment_failed, still cancellable', declined.status === 'payment_failed' && declined.cancellable === true, declined.status);
  const noSale = await one(`select count(*)::int as n from ebm_invoices where service_order_id = $1`, [declined.id]);
  check('nothing was declared for it', noSale.n === 0);

  console.log('\n=== Pay now, cash at the counter (D-p, AC-24) ===');
  const cashOrder = await json(await call(guest, 'POST', '/me/orders', {
    key: randomUUID(),
    body: { outletId: terrace.id, context: 'pay_now', items: [{ serviceItemId: coke.id, quantity: 3 }] },
  }));
  check('with no instrument the order waits for cash, with no attempt', cashOrder.status === 'pending_payment' && cashOrder.attempt === null, JSON.stringify({ status: cashOrder.status, attempt: cashOrder.attempt }));
  const noKey = await call(desk, 'POST', `/ops/service-orders/${cashOrder.id}/paid-cash`, { body: { amountRwf: cashOrder.totalRwf } });
  check('a cash mark with no Idempotency-Key is refused 400', noKey.status === 400, `got ${noKey.status}`);
  const byCleaner = await call(cleaner, 'POST', `/ops/service-orders/${cashOrder.id}/paid-cash`, { key: randomUUID(), body: { amountRwf: cashOrder.totalRwf } });
  check('a housekeeper, holding no folio.payment, is refused 403', byCleaner.status === 403, `got ${byCleaner.status}`);
  const short = await call(desk, 'POST', `/ops/service-orders/${cashOrder.id}/paid-cash`, { key: randomUUID(), body: { amountRwf: cashOrder.totalRwf - 100 } });
  check('an amount that is not exactly the total is refused 422', short.status === 422, `got ${short.status}`);
  const cashRes = await call(desk, 'POST', `/ops/service-orders/${cashOrder.id}/paid-cash`, { key: randomUUID(), body: { amountRwf: cashOrder.totalRwf } });
  const cash = await json(cashRes);
  check('the receptionist marks it paid in cash', ok(cashRes) && cash.status === 'submitted' && cash.paymentMethod === '01', `got ${cashRes.status} ${JSON.stringify(cash).slice(0, 300)}`);
  const cashRow = await one(`select paid_marked_by_user_id, payment_method, paid_at from service_orders where id = $1`, [cashOrder.id]);
  check('the order records who took the cash, with means 01', cashRow.paid_marked_by_user_id === deskUser.id && cashRow.payment_method === '01' && cashRow.paid_at !== null, JSON.stringify(cashRow));
  const cashSale = await all(`select id from ebm_invoices where service_order_id = $1`, [cashOrder.id]);
  check('and one NS was raised, the one the mark answered with', cashSale.length === 1 && cash.emissionId === cashSale[0].id, JSON.stringify({ cashSale, emissionId: cash.emissionId }));
  const again = await json(await call(desk, 'POST', `/ops/service-orders/${cashOrder.id}/paid-cash`, { key: randomUUID(), body: { amountRwf: cashOrder.totalRwf } }));
  check('marking it again answers the same declaration, not a second', again.emissionId === cash.emissionId && (await all(`select id from ebm_invoices where service_order_id = $1`, [cashOrder.id])).length === 1);
  const cashOnMomo = await call(desk, 'POST', `/ops/service-orders/${order.id}/paid-cash`, { key: randomUUID(), body: { amountRwf: order.totalRwf } });
  check('an order already paid by mobile money cannot be marked cash (409)', cashOnMomo.status === 409, `got ${cashOnMomo.status}`);
  const advanced = await call(desk, 'POST', `/ops/service-orders/${cashOrder.id}/advance`, { body: { to: 'acknowledged' } });
  check('once paid, the board works it as any order', ok(advanced), `got ${advanced.status}`);

  console.log('\n=== The staff route takes a walk in at the counter ===');
  const counter = await call(desk, 'POST', '/ops/service-orders', {
    key: randomUUID(),
    body: { context: 'pay_now', items: [{ serviceItemId: coke.id, quantity: 1 }] },
  });
  const counterOrder = await json(counter);
  check('a pay now order from the desk needs no stay and waits for cash', ok(counter) && counterOrder.status === 'pending_payment' && counterOrder.folioId === null && counterOrder.outletId === terrace.id, `got ${counter.status} ${JSON.stringify(counterOrder).slice(0, 300)}`);
  const stayOnPayNow = await call(desk, 'POST', '/ops/service-orders', {
    body: { context: 'pay_now', guestStayId: randomUUID(), items: [{ serviceItemId: coke.id, quantity: 1 }] },
  });
  // A schema refusal, so 400 like every malformed body the Zod pipe refuses.
  check('a pay now order naming a stay is refused as a malformed body (400)', stayOnPayNow.status === 400, `got ${stayOnPayNow.status}`);

  console.log('\n=== The guest cancels an unpaid order ===');
  const toCancel = await json(await call(guest, 'POST', '/me/orders', {
    key: randomUUID(),
    body: { outletId: terrace.id, context: 'pay_now', items: [{ serviceItemId: coke.id, quantity: 1 }] },
  }));
  const cancelled = await call(guest, 'POST', `/me/orders/${toCancel.id}/cancel`);
  check('cancelling a pending_payment order answers 200, cancelled', cancelled.status === 200 && (await json(cancelled)).status === 'cancelled', `got ${cancelled.status}`);
  const lateCash = await call(desk, 'POST', `/ops/service-orders/${toCancel.id}/paid-cash`, { key: randomUUID(), body: { amountRwf: toCancel.totalRwf } });
  check('a cancelled order cannot then be marked paid (409)', lateCash.status === 409, `got ${lateCash.status}`);
  const mine = await json(await call(guest, 'GET', '/me/orders'));
  check('GET /me/orders lists the guest orders, newest first', mine.orders?.[0]?.id === toCancel.id && mine.orders.some((o) => o.id === order.id), JSON.stringify(mine.orders?.slice(0, 2)?.map((o) => o.id)));
  const detail = await json(await call(guest, 'GET', `/me/orders/${order.id}`));
  check('GET /me/orders/:id answers the trail', detail.events?.map((e) => e.status).join(',') === 'pending_payment,submitted', JSON.stringify(detail.events));
  const strangers = await call(desk, 'GET', `/me/orders/${order.id}`);
  check("somebody else's order is a 404, never a 403", strangers.status === 404, `got ${strangers.status}`);

  console.log('\n=== The database holds each purpose to its own inputs ===');
  let refusedShape = false;
  try {
    await db.query(
      `insert into payment_attempts (idempotency_key, attempt_token, guest_user_id, workspace_id, purpose, service_order_id, room_type_id, attempt_fingerprint, instrument_kind, expires_at)
       values ($1, $1, $2, $3, 'service_order', $4, $5, 'x', 'mobile_money', now())`,
      [`verify:${randomUUID()}`, guestUser.id, owner.workspaceId, order.id, randomUUID()],
    );
  } catch (error) {
    refusedShape = /payment_attempts_purpose_shape/.test(error.message);
  }
  check('an order attempt carrying a room type is refused by payment_attempts_purpose_shape', refusedShape);

  console.log('\n=== The outbox (AC-32) ===');
  const events = await all(
    `select event_type from outbox_events where aggregate_id = any($1::uuid[]) order by created_at`,
    [[order.id, cashOrder.id, sale.id]],
  );
  const types = events.map((e) => e.event_type);
  check('the orders wrote order.status for pending_payment and submitted', types.filter((t) => t === 'order.status').length >= 4, types.join(', '));
  check('the settlement wrote ebm.sale', types.includes('ebm.sale'));
} finally {
  if (!hadCoordinates) {
    await db.query(`update properties set latitude = null, longitude = null where id = $1`, [property.id]);
  }
  await db.end();
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
