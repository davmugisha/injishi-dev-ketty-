#!/usr/bin/env node
/**
 * The demo storyline, checked the way a stakeholder would meet it: by signing
 * in as each persona and reading what their screens read.
 *
 *   node scripts/verify-demo-story.mjs --api http://localhost:8000 [--only hotel,landlord,oversight,admin,personas] [--db]
 *   node scripts/verify-demo-story.mjs --api https://api-demo.injishi.com --origin https://www-demo.injishi.com
 *
 * Every anchor below is a promise the demo guide makes out loud ("Denise has a
 * guest arriving today with a room already assigned"). A guide that points at a
 * screen with nothing on it is worse than no guide, so the guide's copy and this
 * script are written against the same list, and the seed is what makes it true.
 *
 * `--db` adds integrity checks straight against DATABASE_URL (from the API's
 * .env unless set): seeded money must obey the rules the API's own commands
 * obey — a folio balance is the sum of its charges, every charge has exactly
 * one ledger entry of the same amount, a closed folio is at zero. A seed that
 * writes by SQL can break those silently; this is what notices.
 *
 * Only ever reads. Signs in with the demo's fixed code, so it works only
 * against a demo process.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
};
const API = (arg('--api', 'http://localhost:8000')).replace(/\/$/, '');
const ORIGIN = arg('--origin', 'http://localhost:3000');
const ONLY = new Set((arg('--only', 'hotel,landlord,oversight,admin,personas')).split(','));
const WITH_DB = process.argv.includes('--db');
const CODE = process.env.VERIFY_OTP_CODE ?? '123456';

const W_HOTEL = 'de300000-0000-4000-8000-000000000201'; // Amahoro Hospitality Group
const W_LANDLORD = 'de300000-0000-4000-8000-000000000202'; // Green Hills Properties
// Amahoro Boutique Hotel, the group's head office (ADR-054). The hotel's day is
// seeded here; the group's branches (Musanze, Rubavu) add rooms to the same
// workspace, so room counts are read through the head office's branch scope.
const HQ_BRANCH = 'de300000-0000-4000-8000-000000000401';

const failures = [];
let passed = 0;
function check(section, label, ok, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`  ok   ${label}`);
  } else {
    failures.push(`${section}: ${label}${detail ? ` (${detail})` : ''}`);
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

// Business dates are the property's calendar day, and every demo property keeps
// Africa/Kigali time (UTC+2, no daylight saving). Reading "today" in UTC would
// disagree with the desk for two hours every night.
const kigaliDate = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kigali' }).format(new Date(ms));
const today = kigaliDate(Date.now());
const dayOffset = (n) => kigaliDate(Date.now() + n * 864e5);

const sessions = new Map();
async function as(email) {
  if (sessions.has(email)) return sessions.get(email);
  const h = { origin: ORIGIN, 'content-type': 'application/json' };
  const sent = await fetch(`${API}/api/auth/email-otp/send-verification-otp`, {
    method: 'POST', headers: h, body: JSON.stringify({ email, type: 'sign-in' }),
  });
  if (!sent.ok) throw new Error(`send code for ${email}: ${sent.status} ${await sent.text()}`);
  const res = await fetch(`${API}/api/auth/sign-in/email-otp`, {
    method: 'POST', headers: h, body: JSON.stringify({ email, otp: CODE }),
  });
  if (!res.ok) throw new Error(`sign in ${email}: ${res.status} ${await res.text()}`);
  const cookie = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  const get = async (p, workspaceId, branchId) => {
    const r = await fetch(`${API}/api/v1${p}`, {
      headers: { origin: ORIGIN, cookie, ...(workspaceId ? { 'x-workspace-id': workspaceId } : {}), ...(branchId ? { 'x-branch-id': branchId } : {}) },
    });
    const text = await r.text();
    if (!r.ok) throw new Error(`GET ${p} as ${email}: ${r.status} ${text.slice(0, 200)}`);
    return JSON.parse(text);
  };
  sessions.set(email, get);
  return get;
}

const count = (xs, pred) => xs.filter(pred).length;
const distinct = (xs, key) => new Set(xs.map((x) => x[key])).size;

async function section(name, fn) {
  if (!ONLY.has(name)) return;
  console.log(`\n# ${name}`);
  try {
    await fn();
  } catch (e) {
    check(name, 'section ran to the end', false, e.message);
  }
}

// --- Amahoro Boutique Hotel: owner Yves, manager Solange, reception Denise, housekeeping Beatha
await section('hotel', async () => {
  const S = 'hotel';
  const yves = await as('yves@demo.injishi.com');

  const { rooms } = await yves('/ops/rooms', W_HOTEL, HQ_BRANCH);
  check(S, 'H1 Amahoro Boutique Hotel (head office) has 20 rooms', rooms.length === 20, `got ${rooms.length}`);
  const { rooms: groupRooms } = await yves('/ops/rooms', W_HOTEL);
  check(S, 'H1b the group\'s branches add rooms beyond the head office', groupRooms.length > rooms.length, `${groupRooms.length} across branches`);
  const occupied = count(rooms, (r) => r.occupiedBy);
  const pct = rooms.length ? occupied / rooms.length : 0;
  check(S, 'H2 occupancy tonight is between 50% and 85%', pct >= 0.5 && pct <= 0.85, `${occupied}/${rooms.length}`);
  check(S, 'H3 room board shows at least 3 housekeeping states', distinct(rooms, 'housekeeping') >= 3);

  const { reservations } = await yves('/ops/reservations', W_HOTEL);
  const arrivalsToday = reservations.filter((r) => r.checkIn === today && r.bookingStatus === 'confirmed' && r.state !== 'inhouse');
  check(S, 'H4 at least 3 confirmed arrivals today still to check in', arrivalsToday.length >= 3, `got ${arrivalsToday.length}`);
  const pending = reservations.filter((r) => r.bookingStatus === 'pending_approval');
  check(S, 'H5 at least 2 requests waiting for approval', pending.length >= 2, `got ${pending.length}`);
  check(S, 'H6 BK-DEMO-002 is a pending request', reservations.some((r) => r.reference === 'BK-DEMO-002' && r.bookingStatus === 'pending_approval'));
  const departuresToday = reservations.filter((r) => r.checkOut === today && r.state === 'inhouse');
  check(S, 'H7 at least 2 in-house guests are due out today', departuresToday.length >= 2, `got ${departuresToday.length}`);
  const upcoming = reservations.filter((r) => r.checkIn > today && r.checkIn <= dayOffset(14) && r.bookingStatus === 'confirmed');
  check(S, 'H8 at least 8 confirmed bookings in the next 14 days', upcoming.length >= 8, `got ${upcoming.length}`);

  const { assignments } = await yves(`/ops/room-assignments?from=${today}&to=${dayOffset(14)}`, W_HOTEL);
  const assignedToday = arrivalsToday.filter((r) => assignments.some((a) => a.bookingId === r.id && a.status === 'assigned'));
  check(S, 'H9 at least 1 arrival today has a room already assigned', assignedToday.length >= 1);
  check(S, 'H10 at least 1 arrival today still needs a room', assignedToday.length < arrivalsToday.length);
  check(S, 'H11 calendar holds at least 10 active assignments over 14 days', count(assignments, (a) => a.status === 'assigned') >= 10);

  const { folios } = await yves('/ops/folios', W_HOTEL);
  check(S, 'H12 at least 10 bills', folios.length >= 10, `got ${folios.length}`);
  check(S, 'H13 bills in both open and closed state', folios.some((f) => f.status === 'open') && folios.some((f) => f.status === 'closed'));
  const dueOut = departuresToday.map((r) => folios.find((f) => f.bookingId === r.id));
  check(S, 'H14 every guest due out today has an open bill with money owed', dueOut.length > 0 && dueOut.every((f) => f && f.status === 'open' && f.balanceRwf > 0));

  const { tasks } = await yves('/ops/housekeeping-tasks', W_HOTEL);
  check(S, 'H15 at least 8 housekeeping tasks', tasks.length >= 8, `got ${tasks.length}`);
  check(S, 'H16 tasks span at least 3 statuses', distinct(tasks, 'status') >= 3);
  check(S, 'H17 Beatha holds at least 4 tasks', count(tasks, (t) => t.assignedToName && t.assignedToName.startsWith('Beatha')) >= 4);

  const { orders } = await yves('/ops/service-orders', W_HOTEL);
  check(S, 'H18 at least 5 service orders', orders.length >= 5, `got ${orders.length}`);
  check(S, 'H19 orders span at least 3 statuses', distinct(orders, 'status') >= 3);
  check(S, 'H20 orders come from at least 2 outlets', distinct(orders.filter((o) => o.outletId), 'outletId') >= 2);
  check(S, 'H21 at least 1 order is billed to a room', orders.some((o) => o.orderContext === 'in_house_folio' && o.folioId));

  const { outlets } = await yves('/ops/outlets', W_HOTEL);
  check(S, 'H22 at least 2 outlets', outlets.length >= 2);
  const { categories } = await yves('/ops/service-catalog', W_HOTEL);
  const items = categories.flatMap((c) => c.items ?? []);
  check(S, 'H23 menu has at least 3 categories and 12 items', categories.length >= 3 && items.length >= 12, `${categories.length}/${items.length}`);

  const { tickets } = await yves('/ops/tickets', W_HOTEL);
  check(S, 'H24 at least 3 maintenance tickets across 2+ statuses', tickets.length >= 3 && distinct(tickets, 'status') >= 2, `got ${tickets.length}`);

  const { departments } = await yves('/ops/departments', W_HOTEL);
  check(S, 'H25 Amahoro has departments', departments.length >= 5, `got ${departments.length}`);

  const revenue = await yves('/ops/revenue', W_HOTEL);
  check(S, 'H26 revenue this month in at least 2 departments', count(revenue.departments, (d) => d.revenueRwf > 0) >= 2);

  const { threads } = await yves('/ops/threads', W_HOTEL);
  check(S, 'H27 at least 8 active conversations', count(threads, (t) => t.status === 'active') >= 8, `got ${count(threads, (t) => t.status === 'active')}`);

  // The same hotel through each staff seat: the demo guide sends people there.
  for (const email of ['solange@demo.injishi.com', 'denise@demo.injishi.com', 'beatha@demo.injishi.com']) {
    const get = await as(email);
    const ws = await get('/me/workspaces');
    check(S, `H28 ${email.split('@')[0]} opens Amahoro`, ws.workspaces.some((w) => w.workspaceId === W_HOTEL));
  }
  const beatha = await as('beatha@demo.injishi.com');
  const hk = await beatha('/ops/rooms', W_HOTEL, HQ_BRANCH);
  check(S, 'H29 the housekeeper can read the head office room board', hk.rooms.length === 20, `got ${hk.rooms.length}`);
});

// --- Green Hills Properties: owner Josephine, Ingoro Apartments
await section('landlord', async () => {
  const S = 'landlord';
  const jo = await as('josephine@demo.injishi.com');
  const { leases } = await jo('/ops/leases', W_LANDLORD);
  check(S, 'L1 at least 8 active leases', count(leases, (l) => l.status === 'active') >= 8, `got ${count(leases, (l) => l.status === 'active')}`);
  const { charges } = await jo('/ops/rent-roll', W_LANDLORD);
  const statuses = new Set(charges.map((c) => c.status));
  check(S, 'L2 rent roll shows paid, and at least one overdue charge', statuses.has('paid') && [...statuses].some((s) => s === 'overdue'), [...statuses].join(','));
  check(S, 'L3 at least one partly paid or due charge', [...statuses].some((s) => s === 'partial' || s === 'due' || s === 'pending'), [...statuses].join(','));
  const { deposits } = await jo('/ops/deposits', W_LANDLORD);
  check(S, 'L4 at least 3 deposits held, one settled', deposits.length >= 3 && deposits.some((d) => d.settlement), `got ${deposits.length}`);
  const { tickets } = await jo('/ops/tickets', W_LANDLORD);
  check(S, 'L5 at least 3 maintenance tickets across 2+ statuses', tickets.length >= 3 && distinct(tickets, 'status') >= 2, `got ${tickets.length}`);
});

// --- Government oversight: PSF verifiers, MINALOC approver
await section('oversight', async () => {
  const S = 'oversight';
  const jb = await as('jeanbosco@demo.injishi.com');
  const vq = await jb('/oversight/verification-queue');
  check(S, 'G1 Jean-Bosco (Gasabo) has at least 2 businesses to field-verify', vq.length >= 2, `got ${vq.length}`);
  const cl = await as('claudine@demo.injishi.com');
  const aq = await cl('/oversight/approval-queue');
  check(S, 'G2 Claudine (Gasabo) has at least 2 businesses to approve', aq.length >= 2, `got ${aq.length}`);
  check(S, 'G3 at least one approval is not blocked by separation of duties', aq.some((i) => !i.blockedBySeparationOfDuties));
  const jbd = await jb('/oversight/decisions');
  const cld = await cl('/oversight/decisions');
  check(S, 'G4 decision logs hold at least 3 past decisions between them', jbd.items.length + cld.items.length >= 3, `got ${jbd.items.length + cld.items.length}`);
  const al = await as('alice@demo.injishi.com');
  const alq = await al('/oversight/verification-queue');
  check(S, 'G5 Alice (Kicukiro) has at least 1 business to field-verify', alq.length >= 1, `got ${alq.length}`);
});

// --- Platform staff: Olivier, ops
await section('admin', async () => {
  const S = 'admin';
  const op = await as('ops@demo.injishi.com');
  const mod = await op('/admin/moderation');
  check(S, 'S1 moderation holds at least 3 reviews', mod.reviews.length >= 3, `got ${mod.reviews.length}`);
  check(S, 'S2 moderation holds at least 2 support tickets', mod.tickets.length >= 2, `got ${mod.tickets.length}`);
  const rq = await op('/admin/orgs/review-queue?pageSize=100');
  check(S, 'S3 review queue shows at least 4 businesses in the pipeline', rq.items.length >= 4, `got ${rq.items.length}`);
});

// --- The persona picker explains each person
await section('personas', async () => {
  const S = 'personas';
  const r = await fetch(`${API}/api/v1/demo/personas`, { headers: { origin: ORIGIN } });
  const personas = r.ok ? await r.json() : [];
  check(S, 'P1 the roster answers', r.ok && personas.length >= 10, `status ${r.status}`);
  const want = ['yves', 'solange', 'denise', 'beatha', 'josephine', 'jeanbosco', 'claudine', 'ops', 'rayan'];
  for (const who of want) {
    const p = personas.find((x) => x.email.startsWith(`${who}@`));
    const story = p?.story;
    check(
      S,
      `P2 ${who} carries a story with a headline, summary and 3+ things to try`,
      Boolean(story && story.headline && story.summary && Array.isArray(story.tryThis) && story.tryThis.length >= 3),
    );
  }
});

// --- Money integrity, straight from the database
if (WITH_DB) {
  console.log('\n# integrity');
  const envPath = path.join(HERE, '..', '.env');
  let url = process.env.DATABASE_URL;
  if (!url && existsSync(envPath)) url = readFileSync(envPath, 'utf8').match(/^DATABASE_URL=(.*)$/m)?.[1]?.trim();
  const { default: pg } = await import('pg');
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  const one = async (q) => (await c.query(q)).rows[0];
  const bal = await one(`
    select count(*)::int n from folios f
    where f.balance_rwf <> coalesce((select sum(amount_rwf) from folio_charges ch where ch.folio_id = f.id), 0)`);
  check('integrity', 'I1 every folio balance equals the sum of its charges', bal.n === 0, `${bal.n} folios disagree`);
  const led = await one(`
    select count(*)::int n from folio_charges ch
    where (select count(*) from ledger_entries e where e.related_type = 'folio_charge' and e.related_id = ch.id and e.amount_rwf = ch.amount_rwf) <> 1`);
  check('integrity', 'I2 every folio charge has exactly one matching ledger entry', led.n === 0, `${led.n} charges without one`);
  const closed = await one(`select count(*)::int n from folios where status in ('closed','settled') and balance_rwf <> 0`);
  check('integrity', 'I3 no closed or settled folio carries a balance', closed.n === 0, `${closed.n}`);
  const openZero = await one(`select count(*)::int n from folios where status = 'open' and balance_rwf = 0 and id::text like 'de300000-%'`);
  check('integrity', 'I4 no seeded open folio sits at zero (it would read settled)', openZero.n === 0, `${openZero.n}`);
  const rev = await one(`
    select count(*)::int n from folio_charges where charge_type in ('room','service_order','pos') and department_id is null`);
  check('integrity', 'I5 every revenue charge names a department', rev.n === 0, `${rev.n}`);
  const overlap = await one(`
    select count(*)::int n from room_assignments a join room_assignments b
      on a.room_id = b.room_id and a.id < b.id and a.status = 'assigned' and b.status = 'assigned' and a.occupies && b.occupies`);
  check('integrity', 'I6 no room is double-booked', overlap.n === 0, `${overlap.n}`);
  await c.end();
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`- ${f}`);
  process.exit(1);
}
console.log(`verify-demo-story: ALL PASSED [${[...ONLY].join(',')}${WITH_DB ? ',integrity' : ''}]`);
