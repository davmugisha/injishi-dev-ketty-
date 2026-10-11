#!/usr/bin/env node
// Seed the demo's non-hotel stakeholders a living dataset.
//
//   node scripts/seed-demo-portfolio.mjs            seed (idempotent, a re-run is a no-op)
//   node scripts/seed-demo-portfolio.mjs --purge    delete only the rows this script owns
//   node scripts/seed-demo-portfolio.mjs --reset    purge, then seed again with fresh dates
//
// Three stories, one per kind of persona that is not a hotel:
//
//   LANDLORD   Josephine Uwimana, Green Hills Properties, Ingoro Apartments.
//              Five more units and leases beside the five seed-demo.mjs writes,
//              last month's rent for everybody, a tenant two months behind, one
//              who has paid half, one moving out at the end of the month, a
//              deposit on every lease and one already settled after a move-out,
//              and a maintenance board with work in five different states.
//              Behind those two months, THE REST OF THE HISTORY: every month
//              every tenancy has actually run, back two years, settled
//              (rent-history.mjs). Without it the rent ledger on Finance showed
//              a lease that started eighteen months ago with two rows against
//              it. And a contract filing per lease (contract-filings.mjs),
//              which is what the Filings lens on Finance reads.
//
//   OVERSIGHT  The Gasabo and Kicukiro registration pipeline. Businesses waiting
//              on a field visit (Jean-Bosco, Gasabo; Alice, Kicukiro), waiting on
//              approval (Claudine, Gasabo), and the decision history behind the
//              ones already decided: two approved and trading, one refused at the
//              field visit and one refused at approval. Every status is reached
//              through the same event trail the API writes (registrant creates,
//              accepts the contract and pays, RRA answers, officers decide), with
//              a TIN from the 999 demo block and an address inside the district.
//
//   ADMIN      Past stays at Kivu Crest Hotel and Umurage Guesthouse Musanze with
//              guest reviews (one of them reported for touting business off the
//              platform, with its escalation), and support tickets in every state
//              the moderation desk colours differently.
//
// It runs AFTER seed-demo.mjs (and seed-demo-catalogue.mjs) against the same
// database: it hangs rows off the Green Hills workspace, Ingoro Apartments, the
// oversight officers and the Kivu Crest / Umurage properties that seed-demo.mjs
// creates, and it refuses to start when they are missing. It never touches
// Amahoro.
//
// IDS. Every row id is deterministic. Rows carry `de300000-0000-4000-8000-003…`
// (families 0030 landlord, 0031 pipeline, 0032 stays and reviews, 0033 support),
// so seed-demo.mjs's `de300000-` rules and `--refresh` still recognise them.
// People this story needs who are NOT personas (the registrants who own the
// pipeline businesses, and past hotel guests; tenants are names on the lease)
// are users under `de300000-0000-4000-8001-0030…` with
// `@guests.demo.injishi.com` addresses, OUTSIDE the persona prefix, so the sign
// in picker (`GET /api/v1/demo/personas`) still lists exactly its fifteen.
//
// ORDER WITH seed-demo.mjs --reset. That reset deletes the Green Hills
// workspace and the personas these rows point at, so run `--purge` here first
// (the harness's reset cycle does exactly that).
//
// SAFETY. Refuses, before writing anything, a database without the sample
// marker (ADR-043, `sample-database.mjs`). Every name, business and address is
// fictional.
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

import {
  GREEN_HILLS_FILING_PLAN,
  contractFilings,
  filingEntries,
} from './contract-filings.mjs';
import { rentHistory } from './rent-history.mjs';
import { assertSampleDatabase } from './sample-database.mjs';

function loadDotEnv() {
  const file = path.join(process.cwd(), '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^([A-Za-z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) process.env[match[1]] ??= match[2];
  }
}
loadDotEnv();

const PURGE = process.argv.includes('--purge');
const RESET = process.argv.includes('--reset');

// --- Ids ---------------------------------------------------------------------

const pad = (n, w) => String(n).padStart(w, '0');
/** A row id: family (4) + kind (2) + serial (6) in the last group. */
const id = (family, kind, n) => `de300000-0000-4000-8000-${family}${kind}${pad(n, 6)}`;
/** A non-persona user this script owns. */
const userId = (kind, n) => `de300000-0000-4000-8001-0030${kind}${pad(n, 6)}`;

const MY_ROWS = 'de300000-0000-4000-8000-003%';
const MY_USERS = 'de300000-0000-4000-8001-0030%';

// seed-demo.mjs rows this script hangs off (its deterministic constants).
const DEMO = {
  josephine: 'de300000-0000-4000-8000-000000000005',
  jeanbosco: 'de300000-0000-4000-8000-000000000007',
  claudine: 'de300000-0000-4000-8000-000000000008',
  alice: 'de300000-0000-4000-8000-000000000010',
  rayan: 'de300000-0000-4000-8000-000000000011',
  grace: 'de300000-0000-4000-8000-000000000012',
  greenHillsOrg: 'de300000-0000-4000-8000-000000000102',
  greenHillsWorkspace: 'de300000-0000-4000-8000-000000000202',
  ingoro: 'de300000-0000-4000-8000-000000001401',
  // Ingoro's existing units and leases (seed-demo.mjs RR family).
  unitA1: 'de300000-0000-4000-8000-000000001420',
  unitA2: 'de300000-0000-4000-8000-000000001421',
  unitB1: 'de300000-0000-4000-8000-000000001422',
  leaseA1: 'de300000-0000-4000-8000-000000001430',
  leaseA2: 'de300000-0000-4000-8000-000000001431',
  leaseB1: 'de300000-0000-4000-8000-000000001432',
  leaseB2: 'de300000-0000-4000-8000-000000001433',
  leaseC1: 'de300000-0000-4000-8000-000000001434',
};

// --- Time --------------------------------------------------------------------

// Two kinds of time, kept apart on purpose.
//
// INSTANTS (`NOW`, `ago()`, timestamps) are real moments.
//
// CALENDAR DAYS (rent due dates, lease starts, move-out, check-in) are the
// property's day, and every demo property keeps Africa/Kigali time (UTC+2, no
// daylight saving), as the API and verify-demo-story.mjs do. They are carried
// as a `Date` at UTC midnight OF THE KIGALI DAY, so `iso()` on one prints that
// Kigali day and Date.UTC arithmetic walks days and months on that calendar.
// Reading today from the UTC calendar instead put the seed a day behind the
// rent roll between 22:00 and 24:00 UTC.
//
// `DEMO_SEED_NOW` (an ISO instant) stands in for the clock, for testing a
// boundary such as that window.

const NOW = (() => {
  const pinned = process.env.DEMO_SEED_NOW?.trim();
  if (!pinned) return Date.now();
  const ms = Date.parse(pinned);
  if (Number.isNaN(ms)) throw new Error(`DEMO_SEED_NOW is not an ISO instant: ${pinned}`);
  return ms;
})();
/** A moment `days` (and `hours`) before now. Negative looks forward. */
const ago = (days, hours = 0) => new Date(NOW - days * 864e5 - hours * 36e5);
/** The Kigali calendar day an instant falls on, YYYY-MM-DD. */
const kigaliDate = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kigali' }).format(new Date(ms));
/** A calendar-day Date (UTC midnight of a Kigali day) as YYYY-MM-DD. Never pass an instant. */
const iso = (d) => d.toISOString().slice(0, 10);
const [TODAY_YEAR, TODAY_MONTH0, TODAY_DAY] = (() => {
  const [y, m, d] = kigaliDate(NOW).split('-').map(Number);
  return [y, m - 1, d];
})();
/** Today in Kigali, as a calendar-day Date. */
const TODAY = new Date(Date.UTC(TODAY_YEAR, TODAY_MONTH0, TODAY_DAY));
/** First day of the month `offset` months from this one, as a calendar-day Date. */
const monthStart = (offset) => new Date(Date.UTC(TODAY_YEAR, TODAY_MONTH0 + offset, 1));
/** Day `d` of the month `offset` months from this one. */
const dayOfMonth = (offset, d) => new Date(Date.UTC(TODAY_YEAR, TODAY_MONTH0 + offset, d));
const lastDayOfMonth = (offset) => new Date(Date.UTC(TODAY_YEAR, TODAY_MONTH0 + offset + 1, 0));
const addDays = (d, n) => new Date(d.getTime() + n * 864e5);
const addMinutes = (d, n) => new Date(d.getTime() + n * 6e4);
/** The instant `hh:mm` Kigali time on a calendar day. */
const kigaliAt = (day, hh, mm = 0) => new Date(day.getTime() + (hh - 2) * 36e5 + mm * 6e4);
/** A settlement moment on a calendar day, never later than now. */
const notAfterNow = (d) => new Date(Math.min(d.getTime(), NOW - 60e3));

// --- A tiny insert helper ------------------------------------------------------

/**
 * INSERT one row, ON CONFLICT DO NOTHING. Untargeted on purpose: a row that
 * collides on any unique key (its id, or a lease + month that another run
 * already charged) is left exactly as it is, which is what makes a re-run a
 * no-op.
 */
async function insert(c, table, row) {
  const cols = Object.keys(row);
  const values = cols.map((k) => {
    const v = row[k];
    return v !== null && typeof v === 'object' && !(v instanceof Date) ? JSON.stringify(v) : v;
  });
  const { rowCount } = await c.query(
    `INSERT INTO "${table}" (${cols.map((k) => `"${k}"`).join(', ')})
     VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')})
     ON CONFLICT DO NOTHING`,
    values,
  );
  written[table] = (written[table] ?? 0) + (rowCount ?? 0);
  return rowCount ?? 0;
}
const written = {};

/** One mock escrow reference, in the shape `MockPaymentAdapter` mints. */
const mockRef = (rowId) => ({
  adapter_ref: `mock_escrow_capture_seed-demo-portfolio:${rowId}`,
  adapter_mode: 'mock',
  idempotency_key: `seed-demo-portfolio:${rowId}`,
});

// =============================================================================
// People who are not personas
// =============================================================================

/**
 * `kind` 01 = registrant business owners, 02 = past hotel guests.
 * National ID numbers sit in a block no persona uses (119NN800300…).
 */
function person(kind, n, name, extra = {}) {
  const local = name.toLowerCase().normalize('NFD').replace(/[^a-z ]/g, '').trim().replace(/\s+/g, '.');
  return {
    id: userId(kind, n),
    email: `${local}@guests.demo.injishi.com`,
    name,
    nid: `119${80 + (n % 10)}800300${kind}${pad(n, 3)}`.slice(0, 16),
    phone: `+2507880${kind}${pad(n, 3)}`,
    ...extra,
  };
}

async function seedPerson(c, p) {
  await insert(c, 'users', {
    id: p.id, email: p.email, email_verified: true, name: p.name,
    created_at: p.since ?? ago(60), updated_at: p.since ?? ago(60),
  });
  await insert(c, 'user_profiles', {
    user_id: p.id, display_name: p.name, national_id: p.nid, phone_e164: p.phone,
    dob: p.dob ?? '1988-04-12', gender: p.gender ?? null,
    district_id: p.districtId ?? null, sector_id: p.sectorId ?? null,
    address_text: p.street ?? null,
  });
  await insert(c, 'verified_identities', {
    user_id: p.id, kyc_status: 'verified', legal_full_name: p.name,
    verified_method: 'manual', verified_at: p.since ?? ago(60),
  });
  await insert(c, 'identity_documents', {
    identity_id: p.id, document_type: 'national_id', document_number: p.nid,
    issuing_country: 'RW', status: 'active', is_primary: true, verified_at: p.since ?? ago(60),
  });
  const { rows } = await c.query(
    `SELECT 1 FROM user_roles WHERE user_id = $1 AND global_role = 'guest' AND revoked_at IS NULL`,
    [p.id],
  );
  if (rows.length === 0) {
    await c.query(`INSERT INTO user_roles (user_id, global_role, granted_at) VALUES ($1, 'guest', $2)`, [
      p.id, p.since ?? ago(60),
    ]);
  }
}

// =============================================================================
// LANDLORD — Ingoro Apartments
// =============================================================================

const L = (kind, n) => id('0030', kind, n);

const ROOM_TYPES = [
  { id: L('01', 1), name: 'One bedroom apartment', capacity: 2, rent: 300_000, units: 4 },
  { id: L('01', 2), name: 'Three bedroom penthouse', capacity: 6, rent: 750_000, units: 1 },
];

const UNITS = [
  { id: L('02', 1), label: 'A3', type: L('01', 1) },
  { id: L('02', 2), label: 'B3', type: L('01', 1) },
  { id: L('02', 3), label: 'C2', type: L('01', 1) },
  { id: L('02', 4), label: 'C3', type: L('01', 1) },
  { id: L('02', 5), label: 'D1', type: L('01', 2) },
];

/** The move-out date for D1: the end of this month, or next month if that is under a week away. */
const MOVE_OUT = (() => {
  const end = lastDayOfMonth(0);
  return end.getTime() - TODAY.getTime() >= 7 * 864e5 ? end : lastDayOfMonth(1);
})();

/**
 * The new leases. `startMonth` is months from now. A caution deposit of two
 * months' rent is what every lease in this block asks.
 */
const LEASES = [
  { id: L('03', 1), unit: L('02', 1), tenant: 'Didier Nshimiyimana', phone: '+250788030411', rent: 300_000, startMonth: -18, status: 'active' },
  { id: L('03', 2), unit: L('02', 2), tenant: 'Aline Mutoni', phone: '+250788030412', rent: 320_000, startMonth: -8, status: 'active' },
  { id: L('03', 3), unit: L('02', 3), tenant: 'Patrick Mugisha', phone: '+250788030413', rent: 300_000, startMonth: -14, status: 'active' },
  { id: L('03', 4), unit: L('02', 4), tenant: 'Olive Ingabire', phone: '+250788030414', rent: 310_000, startMonth: -2, status: 'active' },
  // Gave notice: moving out at MOVE_OUT. Still owes rent until then.
  { id: L('03', 5), unit: L('02', 5), tenant: 'Jean-Paul Habineza', phone: '+250788030415', rent: 750_000, startMonth: -23, status: 'ending', endDate: MOVE_OUT },
  // C3's previous tenant. Moved out the day before Olive moved in.
  { id: L('03', 6), unit: L('02', 4), tenant: 'Esther Uwamahoro', phone: '+250788030416', rent: 290_000, startMonth: -26, status: 'ended', endDate: addDays(monthStart(-2), -1) },
];

/** The five leases seed-demo.mjs writes, for last month's rent and their deposits. */
const DEMO_LEASES = [
  { id: DEMO.leaseA1, rent: 450_000 },
  { id: DEMO.leaseA2, rent: 450_000 },
  { id: DEMO.leaseB1, rent: 380_000 },
  { id: DEMO.leaseB2, rent: 520_000 },
  { id: DEMO.leaseC1, rent: 410_000 },
];

/** Paid at 10:00 Kigali on day `d` of the month `offset` away, never later than now. */
const paidOn = (offset, d) => notAfterNow(kigaliAt(dayOfMonth(offset, d), 10));
/** A charge paid on day `d` of this month, never later than today. */
const paidThisMonth = (d) => paidOn(0, Math.min(d, TODAY_DAY));
/** An unpaid charge is overdue once its Kigali due day is behind Kigali's today. */
const unpaidStatus = (due) => (due.getTime() < TODAY.getTime() ? 'overdue' : 'due');

function rentCharges() {
  const prev = iso(monthStart(-1));
  const cur = iso(monthStart(0));
  const due5 = dayOfMonth(0, 5);
  const prevDue = (d) => iso(dayOfMonth(-1, d));
  const rows = [
    // Last month, for the five seed-demo tenants: all settled, two of them late.
    { lease: DEMO.leaseA1, period: prev, amount: 450_000, paid: 450_000, status: 'paid', due: prevDue(5), paidAt: paidOn(-1, 3) },
    { lease: DEMO.leaseA2, period: prev, amount: 450_000, paid: 450_000, status: 'paid', due: prevDue(5), paidAt: paidOn(-1, 5) },
    { lease: DEMO.leaseB1, period: prev, amount: 380_000, paid: 380_000, status: 'paid', due: prevDue(28), paidAt: paidOn(-1, 26) },
    { lease: DEMO.leaseB2, period: prev, amount: 520_000, paid: 520_000, status: 'paid', due: prevDue(1), paidAt: paidOn(-1, 12) },
    { lease: DEMO.leaseC1, period: prev, amount: 410_000, paid: 410_000, status: 'paid', due: prevDue(2), paidAt: paidOn(-1, 9) },
    // Last month, for the new tenants. Patrick did not pay.
    { lease: L('03', 1), period: prev, amount: 300_000, paid: 300_000, status: 'paid', due: prevDue(5), paidAt: paidOn(-1, 2) },
    { lease: L('03', 2), period: prev, amount: 320_000, paid: 320_000, status: 'paid', due: prevDue(5), paidAt: paidOn(-1, 4) },
    { lease: L('03', 3), period: prev, amount: 300_000, paid: 0, status: 'overdue', due: prevDue(5), paidAt: null },
    { lease: L('03', 4), period: prev, amount: 310_000, paid: 310_000, status: 'paid', due: prevDue(5), paidAt: paidOn(-1, 1) },
    { lease: L('03', 5), period: prev, amount: 750_000, paid: 750_000, status: 'paid', due: prevDue(5), paidAt: paidOn(-1, 5) },
    // This month, due on the 5th.
    { lease: L('03', 1), period: cur, amount: 300_000, paid: 300_000, status: 'paid', due: iso(due5), paidAt: paidThisMonth(3) },
    // Paid half. A part payment leaves the month open (ResidenceService.recordRent).
    { lease: L('03', 2), period: cur, amount: 320_000, paid: 160_000, status: unpaidStatus(due5), due: iso(due5), paidAt: null },
    // Two months behind now.
    { lease: L('03', 3), period: cur, amount: 300_000, paid: 0, status: unpaidStatus(due5), due: iso(due5), paidAt: null },
    { lease: L('03', 4), period: cur, amount: 310_000, paid: 310_000, status: 'paid', due: iso(due5), paidAt: paidThisMonth(4) },
    { lease: L('03', 5), period: cur, amount: 750_000, paid: 750_000, status: 'paid', due: iso(due5), paidAt: paidThisMonth(2) },
  ];
  return rows.map((r, i) => ({ ...r, id: L('04', i + 1) }));
}

/** Whole months from the month `from` falls in to the month `to` does. */
const monthsBetween = (from, to) =>
  (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());

/**
 * How many months ago the five seed-demo.mjs tenancies began.
 *
 * That script starts all five on 1 February of last year, so this offset walks
 * with the calendar exactly as every other date in this file does.
 */
const DEMO_LEASE_START_MONTH = () => monthsBetween(monthStart(0), new Date(Date.UTC(TODAY_YEAR - 1, 1, 1)));

/**
 * Every settled month of rent behind the two `rentCharges()` writes by hand.
 *
 * The two it writes are the story — Patrick two months behind, Aline half paid.
 * These are the eighteen months of ordinary settled rent underneath, which is
 * what makes the rent ledger a ledger and gives the Filings lens a year of
 * rental income to declare.
 */
function rentHistoryRows() {
  const leases = [
    ...DEMO_LEASES.map((l) => ({ id: l.id, rent: l.rent, startMonth: DEMO_LEASE_START_MONTH() })),
    ...LEASES.map((l) => ({
      id: l.id,
      rent: l.rent,
      startMonth: l.startMonth,
      // An ended tenancy stops owing rent the month it handed the keys back.
      endMonth: l.status === 'ended' && l.endDate ? monthsBetween(monthStart(0), l.endDate) : null,
    })),
  ];
  return rentHistory(leases, { year: TODAY_YEAR, month0: TODAY_MONTH0 }, { idFor: (n) => L('11', n) });
}

/**
 * The filing plan's symbolic keys against the leases they name.
 *
 * Eleven leases, five of them seed-demo.mjs's. `contract-filings.mjs` refuses a
 * lease listed here that the plan does not name, so a tenancy can never end up
 * with no contract filed and nothing saying so.
 */
const FILING_LEASE_KEYS = {
  a1: DEMO.leaseA1, a2: DEMO.leaseA2, b1: DEMO.leaseB1, b2: DEMO.leaseB2, c1: DEMO.leaseC1,
  didier: L('03', 1), aline: L('03', 2), patrick: L('03', 3),
  olive: L('03', 4), jeanpaul: L('03', 5), esther: L('03', 6),
};

/** A deposit on every lease; C3's previous tenant's is settled. */
function deposits() {
  const demoStart = new Date(Date.UTC(TODAY_YEAR - 1, 1, 1)); // seed-demo.mjs: Feb 1 last year
  const rows = [
    ...DEMO_LEASES.map((l) => ({ lease: l.id, amount: l.rent * 2, heldAt: demoStart })),
    ...LEASES.map((l) => ({ lease: l.id, amount: l.rent * 2, heldAt: addDays(monthStart(l.startMonth), -3) })),
  ];
  return rows.map((r, i) => ({ ...r, id: L('05', i + 1), escrowId: L('06', i + 1) }));
}

const SETTLED = {
  id: L('07', 1),
  lease: L('03', 6),
  refunded: 520_000,
  forfeited: 60_000,
  reason: 'Repainting the bedroom wall and replacing a broken kitchen cupboard hinge. Photos from the move-out inspection are on file.',
  settledAt: addDays(monthStart(-2), 4),
};

const TICKETS = [
  {
    id: L('08', 1), lease: DEMO.leaseA1, room: DEMO.unitA1, raisedBy: DEMO.rayan, role: 'tenant',
    title: 'Kitchen tap keeps dripping', category: 'plumbing', priority: 'normal', status: 'in_progress',
    description: 'The kitchen mixer tap drips all night even when fully closed.',
    createdAt: ago(4, 3),
    events: [
      { at: ago(3, 20), note: 'Plumber booked for Thursday morning. Tenant will leave a key with the guard.' },
      { at: ago(1, 5), note: 'Washer replaced but it still drips a little. Plumber coming back with a new cartridge.' },
    ],
  },
  {
    id: L('08', 2), lease: L('03', 3), room: L('02', 3), raisedBy: DEMO.josephine, role: 'staff',
    title: 'No hot water in C2', category: 'appliance', priority: 'high', status: 'open',
    description: 'Patrick called: the water heater stopped heating last night. The breaker is on.',
    createdAt: ago(0, 20),
    events: [],
  },
  {
    id: L('08', 3), lease: DEMO.leaseB1, room: DEMO.unitB1, raisedBy: DEMO.josephine, role: 'staff',
    title: 'Landing light out on the second floor', category: 'electrical', priority: 'normal', status: 'resolved',
    description: 'Ange (B1) reported the stairwell light outside her door has been off for two nights.',
    createdAt: ago(9, 2), resolvedAt: ago(6, 4),
    events: [{ at: ago(6, 4), note: 'Electrician replaced the bulb and the motion sensor on the landing.' }],
  },
  {
    id: L('08', 4), lease: L('03', 5), room: L('02', 5), raisedBy: DEMO.josephine, role: 'staff',
    title: 'Balcony door lock sticks', category: 'furniture', priority: 'low', status: 'assigned',
    description: 'Fix before the move-out inspection in D1.',
    createdAt: ago(5, 6),
    events: [{ at: ago(5, 1), note: 'Given to the handyman. New lock cylinder ordered.' }],
  },
  {
    id: L('08', 5), lease: DEMO.leaseA2, room: DEMO.unitA2, raisedBy: DEMO.grace, role: 'tenant',
    title: 'Wi-Fi router keeps restarting', category: 'it_tech', priority: 'normal', status: 'closed',
    description: 'The building router in A2 restarts every few minutes in the evening.',
    createdAt: ago(30, 2), resolvedAt: ago(26, 0),
    events: [
      { at: ago(27, 3), note: 'Internet provider replaced the router.' },
      { at: ago(26, 0), note: 'Tenant confirmed it has been stable for three days. Closed.' },
    ],
  },
];

/**
 * One contract filing per Ingoro lease — F-R10's fifteen day clock, as rows.
 *
 * `contract_filings` has existed since the first migration and has never been
 * written by anything, so the Filings lens on Finance had nothing to read and
 * was a placeholder.
 *
 * The clock starts AT SIGNING, and it is read back off the lease rather than
 * recomputed here, so a filing can never be dated before the contract it files.
 * seed-demo.mjs writes its five Ingoro leases with no signature at all — a
 * lease cannot go active unsigned, so that is a gap in that script rather than
 * a fact about those tenancies — and this backfills them, only where they are
 * still null, and the purge puts them back.
 */
async function seedContractFilings(c) {
  const ids = Object.values(FILING_LEASE_KEYS);
  await c.query(
    `UPDATE leases
        SET landlord_signed_at = ((start_date - 6)::timestamp AT TIME ZONE 'UTC') + interval '8 hours',
            tenant_signed_at   = ((start_date - 5)::timestamp AT TIME ZONE 'UTC') + interval '8 hours'
      WHERE id = ANY($1::uuid[]) AND tenant_signed_at IS NULL AND start_date IS NOT NULL`,
    [ids],
  );

  const { rows } = await c.query(
    `SELECT id, tenant_signed_at FROM leases WHERE id = ANY($1::uuid[])`,
    [ids],
  );
  const signedAt = new Map(rows.map((r) => [r.id, r.tenant_signed_at]));
  const leases = Object.fromEntries(
    Object.entries(FILING_LEASE_KEYS).map(([key, id]) => [key, { id, signedAt: signedAt.get(id) }]),
  );

  const entries = filingEntries(GREEN_HILLS_FILING_PLAN, leases, new Date(NOW));
  for (const row of contractFilings(entries, { idFor: (n) => L('12', n) })) {
    await insert(c, 'contract_filings', row);
  }
}

async function seedLandlord(c) {
  const { rows: ingoro } = await c.query(
    `SELECT p.id, p.workspace_id, p.org_id FROM properties p WHERE p.id = $1`,
    [DEMO.ingoro],
  );
  if (ingoro.length === 0) {
    throw new Error('Ingoro Apartments is missing. Run seed-demo.mjs against this database first.');
  }

  for (const rt of ROOM_TYPES) {
    await insert(c, 'room_types', {
      id: rt.id, property_id: DEMO.ingoro, workspace_id: DEMO.greenHillsWorkspace, name: rt.name,
      domain: 'residence', capacity: rt.capacity, room_count: rt.units,
      base_price_rwf: rt.rent, caution_rwf: rt.rent * 2,
    });
  }
  for (const u of UNITS) {
    await insert(c, 'rooms', {
      id: u.id, room_type_id: u.type, property_id: DEMO.ingoro, workspace_id: DEMO.greenHillsWorkspace,
      label: u.label, status: 'available', housekeeping_status: 'clean',
    });
  }

  for (const l of LEASES) {
    const start = monthStart(l.startMonth);
    await insert(c, 'leases', {
      id: l.id, room_id: l.unit, org_id: DEMO.greenHillsOrg, workspace_id: DEMO.greenHillsWorkspace,
      tenant_name: l.tenant, tenant_phone: l.phone,
      monthly_rent_rwf: l.rent, caution_rwf: l.rent * 2, currency: 'RWF',
      start_date: iso(start), end_date: l.endDate ? iso(l.endDate) : null, status: l.status,
      landlord_signed_at: addDays(start, -6), tenant_signed_at: addDays(start, -5),
      created_at: addDays(start, -7), updated_at: l.status === 'active' ? addDays(start, -5) : l.status === 'ending' ? ago(20) : l.endDate,
    });
  }

  await insert(c, 'move_out_notices', {
    id: L('10', 1), lease_id: L('03', 5), filed_by_user_id: null, move_out_date: iso(MOVE_OUT),
    message: 'Jean-Paul is relocating to Musanze for work and will hand back the keys on the last day of the month.',
    notice_given_days: 40, is_short_notice: false, filed_at: addDays(MOVE_OUT, -40),
  });

  // The two months that carry the narrative, and then everything behind them.
  // Order matters only for reading: both go in ON CONFLICT DO NOTHING, and
  // `rentHistory` never reaches those two months, so neither can overwrite the
  // other on `rent_charges_lease_period_uk`.
  for (const r of [...rentCharges(), ...rentHistoryRows()]) {
    await insert(c, 'rent_charges', {
      id: r.id, lease_id: r.lease, period_month: r.period, amount_rwf: r.amount,
      paid_amount_rwf: r.paid, status: r.status, due_date: r.due, paid_at: r.paidAt,
    });
  }

  await seedContractFilings(c);

  for (const d of deposits()) {
    const settled = d.lease === SETTLED.lease;
    await insert(c, 'caution_holds', {
      id: d.id, lease_id: d.lease, amount_rwf: d.amount, currency: 'RWF',
      status: settled ? 'forfeited' : 'held', held_at: d.heldAt, created_at: d.heldAt,
      updated_at: settled ? SETTLED.settledAt : d.heldAt,
    });
    await insert(c, 'escrows', {
      id: d.escrowId, workspace_id: DEMO.greenHillsWorkspace, source: 'caution', caution_hold_id: d.id,
      amount_rwf: d.amount, status: settled ? 'refunded_partial' : 'held', ...mockRef(d.escrowId),
      created_at: d.heldAt, updated_at: settled ? SETTLED.settledAt : d.heldAt,
    });
    await c.query('UPDATE caution_holds SET escrow_id = $1 WHERE id = $2 AND escrow_id IS NULL', [d.escrowId, d.id]);
    if (settled) {
      await insert(c, 'caution_settlements', {
        id: SETTLED.id, lease_id: d.lease, caution_hold_id: d.id,
        refunded_rwf: SETTLED.refunded, forfeited_rwf: SETTLED.forfeited, currency: 'RWF',
        reason: SETTLED.reason, settled_at: SETTLED.settledAt,
        idempotency_key: `seed-demo-portfolio:${SETTLED.id}`,
      });
    }
  }

  let e = 0;
  for (const t of TICKETS) {
    await insert(c, 'maintenance_tickets', {
      id: t.id, lease_id: t.lease, room_id: t.room, property_id: DEMO.ingoro, org_id: DEMO.greenHillsOrg,
      workspace_id: DEMO.greenHillsWorkspace, raised_by_user_id: t.raisedBy, raised_by_role: t.role,
      title: t.title, description: t.description, category: t.category, priority: t.priority,
      status: t.status, resolved_at: t.resolvedAt ?? null, created_at: t.createdAt,
      updated_at: t.events.at(-1)?.at ?? t.createdAt,
    });
    for (const ev of t.events) {
      e += 1;
      await insert(c, 'maintenance_events', {
        id: L('09', e), ticket_id: t.id, author_user_id: DEMO.josephine, note: ev.note, created_at: ev.at,
      });
    }
  }
}

// =============================================================================
// OVERSIGHT — the Gasabo and Kicukiro registration pipeline
// =============================================================================

const R = (kind, n) => id('0031', kind, n);

/** The operator contract version a registrant accepts (OPERATOR_CONTRACT_VERSION in @injishi/contracts). */
const CONTRACT_VERSION = '2026-09-12';

// The officers, as their assignments in seed-demo.mjs describe them. The body
// and title are copied onto each decision, exactly as the API does.
const OFFICERS = {
  jeanbosco: { userId: DEMO.jeanbosco, role: 'business_field_verifier', body: 'PSF', title: 'Business Registration Officer' },
  claudine: { userId: DEMO.claudine, role: 'business_approver', body: 'MINALOC', title: 'BDO' },
};

/**
 * The businesses. `createdDaysAgo` is when the registrant filled in the form;
 * the fee and the RRA check follow within the hour. `steps` are the officer
 * decisions that came after, in order.
 */
const PIPELINE = [
  // --- Waiting on Jean-Bosco's field visit (Gasabo) --------------------------
  {
    n: 1, name: 'Umucyo Garden Guest House', cls: 'guest_house', district: 'Gasabo', sector: 'Kimironko',
    street: 'KG 192 St, Kibagabaga', tin: '999031001', createdDaysAgo: 4.2,
    owner: { n: 1, name: 'Innocent Niyonsaba', gender: 'male', dob: '1984-03-09' },
    certificates: [{ kind: 'tourism_license', number: 'TL-2026-GSB-0412', issuedBy: 'Rwanda Development Board', issuedDaysAgo: 40, validYears: 3 }],
    steps: [],
    // Answered No to PSF, so seed-demo-psf.mjs can give it an application
    // waiting in the PSF membership queue (ADR-056 AC-21).
    psfMember: false,
  },
  {
    n: 2, name: 'Kacyiru Jacaranda Suites', cls: 'serviced_apartment', district: 'Gasabo', sector: 'Kacyiru',
    street: 'KG 7 Ave, Kamatamu', tin: '999031002', createdDaysAgo: 1.8,
    owner: { n: 2, name: 'Diane Umutoni', gender: 'female', dob: '1990-11-21' },
    certificates: [{ kind: 'fire_safety', number: 'FS-KCY-2026-118', issuedBy: 'Fire and Rescue Brigade, Kigali', issuedDaysAgo: 75, validYears: 1 }],
    steps: [],
  },
  // --- Waiting on Alice's field visit (Kicukiro) -----------------------------
  {
    n: 3, name: 'Kagarama Courtyard Guest House', cls: 'guest_house', district: 'Kicukiro', sector: 'Kagarama',
    street: 'KK 31 Ave, Muyange', tin: '999031003', createdDaysAgo: 3.1,
    owner: { n: 3, name: 'Fabrice Ishimwe', gender: 'male', dob: '1987-06-02' },
    certificates: [{ kind: 'tourism_license', number: 'TL-2026-KCK-0207', issuedBy: 'Rwanda Development Board', issuedDaysAgo: 22, validYears: 3 }],
    steps: [],
  },
  {
    n: 4, name: 'Kanombe Stopover Motel', cls: 'motel', district: 'Kicukiro', sector: 'Kanombe',
    street: 'KK 3 Rd, Kabeza', tin: '999031004', createdDaysAgo: 6.4,
    owner: { n: 4, name: 'Josiane Mukandayisenga', gender: 'female', dob: '1979-01-30' },
    certificates: [],
    steps: [],
  },
  // --- Field-verified, waiting on Claudine's approval (Gasabo) ---------------
  {
    n: 5, name: 'Amizero Boutique Hotel', cls: 'hotel', district: 'Gasabo', sector: 'Kimihurura',
    street: 'KG 5 Ave, Rugando', tin: '999031005', createdDaysAgo: 8.3,
    owner: { n: 5, name: 'Gilbert Rukundo', gender: 'male', dob: '1981-08-14' },
    certificates: [
      { kind: 'tourism_license', number: 'TL-2026-GSB-0377', issuedBy: 'Rwanda Development Board', issuedDaysAgo: 60, validYears: 3 },
      { kind: 'fire_safety', number: 'FS-KMH-2026-064', issuedBy: 'Fire and Rescue Brigade, Kigali', issuedDaysAgo: 50, validYears: 1 },
    ],
    steps: [
      { to: 'field_verified', by: 'jeanbosco', daysAgo: 3.1, notes: 'Visited on site. Twelve rooms as declared, reception staffed, fire extinguishers on every floor. Licence number matches the certificate.' },
    ],
  },
  {
    n: 6, name: 'Isange Rooms Gisozi', cls: 'guest_house', district: 'Gasabo', sector: 'Gisozi',
    street: 'KG 14 Ave, Musezero', tin: '999031006', createdDaysAgo: 13.5,
    owner: { n: 6, name: 'Vestine Nyiraneza', gender: 'female', dob: '1976-12-05' },
    certificates: [{ kind: 'health_inspection', number: 'HI-GSZ-2026-031', issuedBy: 'Gasabo District Health Office', issuedDaysAgo: 35, validYears: 1 }],
    steps: [
      { to: 'field_verified', by: 'jeanbosco', daysAgo: 9.2, notes: 'Six rooms, owner-run, premises clean. Health inspection certificate seen in original.' },
    ],
  },
  // --- Decided: the officers' history (Gasabo) -------------------------------
  {
    n: 7, name: 'Umwezi Terrace Hotel', cls: 'hotel', district: 'Gasabo', sector: 'Remera',
    street: 'KG 17 Ave, Rukiri II', tin: '999031007', createdDaysAgo: 31.4,
    owner: { n: 7, name: 'Emmanuel Twagirayezu', gender: 'male', dob: '1972-05-18' },
    certificates: [{ kind: 'tourism_license', number: 'TL-2026-GSB-0198', issuedBy: 'Rwanda Development Board', issuedDaysAgo: 90, validYears: 3 }],
    steps: [
      { to: 'field_verified', by: 'jeanbosco', daysAgo: 26.2, notes: 'Twenty-four rooms and a rooftop restaurant, all as declared. Manager present with original documents.' },
      { to: 'approved', by: 'claudine', daysAgo: 21.1, notes: 'Documents complete and field report satisfactory. Approved.', activate: true },
    ],
  },
  {
    n: 8, name: 'Kinyinya Hillside Homestay', cls: 'guest_house', district: 'Gasabo', sector: 'Kinyinya',
    street: 'KG 380 St, Gacuriro', tin: '999031008', createdDaysAgo: 18.6,
    owner: { n: 8, name: 'Agnes Uwingabire', gender: 'female', dob: '1983-02-27' },
    certificates: [{ kind: 'health_inspection', number: 'HI-KNY-2026-012', issuedBy: 'Gasabo District Health Office', issuedDaysAgo: 30, validYears: 1 }],
    steps: [
      { to: 'field_verified', by: 'jeanbosco', daysAgo: 15.3, notes: 'Four guest rooms in the family compound, separate entrance. Matches the application.' },
      { to: 'approved', by: 'claudine', daysAgo: 12.2, notes: 'Approved.', activate: true },
    ],
  },
  {
    n: 9, name: 'Ndera Sunrise Inn', cls: 'motel', district: 'Gasabo', sector: 'Ndera',
    street: 'KG 45 Rd, Kibenga', tin: '999031009', createdDaysAgo: 16.2,
    owner: { n: 9, name: 'Theogene Hakizimana', gender: 'male', dob: '1991-09-09' },
    certificates: [],
    steps: [
      {
        to: 'rejected', by: 'jeanbosco', daysAgo: 10.1, reason: 'premises_not_found',
        notes: 'Visited twice, on a weekday afternoon and a Saturday morning. The plot at this address is a house under construction: no rooms, signage or staff. The registrant can resubmit with the correct address.',
      },
    ],
  },
  {
    n: 10, name: 'Gatsata Transit Lodge', cls: 'lodge', district: 'Gasabo', sector: 'Gatsata',
    street: 'KG 1 Rd, Nyamugari', tin: '999031010', createdDaysAgo: 22.5,
    owner: { n: 10, name: 'Janvier Bizimana', gender: 'male', dob: '1980-07-03' },
    certificates: [{ kind: 'fire_safety', number: 'FS-GTS-2025-207', issuedBy: 'Fire and Rescue Brigade, Kigali', issuedDaysAgo: 450, validYears: 1 }],
    steps: [
      { to: 'field_verified', by: 'jeanbosco', daysAgo: 14.4, notes: 'Eighteen rooms near the bus park, open and trading. Premises and owner match the application.' },
      {
        to: 'rejected', by: 'claudine', daysAgo: 8.2, reason: 'documents_expired',
        notes: 'The fire safety certificate on file expired before the application was made. Resubmit with a current certificate and this can be approved.',
      },
    ],
  },
];

async function lookupPlace(c, district, sector) {
  const { rows } = await c.query(
    `SELECT d.id AS district_id, s.id AS sector_id FROM sectors s JOIN districts d ON d.id = s.district_id
      WHERE lower(d.name) = lower($1) AND lower(s.name) = lower($2)`,
    [district, sector],
  );
  if (rows.length === 0) throw new Error(`Sector not found: ${sector} in ${district}`);
  return rows[0];
}

async function seedPipeline(c) {
  const { rows: officers } = await c.query(
    `SELECT count(*)::int AS n FROM oversight_assignments WHERE user_id = ANY($1::uuid[])`,
    [[DEMO.jeanbosco, DEMO.claudine, DEMO.alice]],
  );
  if (officers[0].n < 3) throw new Error('The oversight officers are missing. Run seed-demo.mjs first.');
  const { rows: fee } = await c.query(
    `SELECT amount_rwf FROM registration_fees WHERE business_type = 'hospitality' AND active
      ORDER BY effective_from DESC LIMIT 1`,
  );
  const feeRwf = fee[0]?.amount_rwf ?? 5000;

  for (const b of PIPELINE) {
    const place = await lookupPlace(c, b.district, b.sector);
    const orgId = R('01', b.n);
    const workspaceId = R('02', b.n);
    const created = ago(b.createdDaysAgo);
    const owner = person('01', b.owner.n, b.owner.name, {
      gender: b.owner.gender, dob: b.owner.dob, since: addMinutes(created, -30),
      districtId: place.district_id, sectorId: place.sector_id, street: b.street,
    });
    await seedPerson(c, owner);

    // The trail, built first so the org row can carry where it ended up.
    const events = [];
    const reviews = [];
    const accepted = addMinutes(created, 12);
    const paid = addMinutes(created, 25);
    const tinChecked = addMinutes(created, 26);
    events.push({ from: null, to: 'pending_payment', trigger: 'registrant', actor: owner.id, at: created });
    events.push({ from: 'pending_payment', to: 'submitted', trigger: 'registrant', actor: owner.id, at: paid });
    events.push({ from: 'submitted', to: 'tin_verified', trigger: 'system', actor: null, at: addMinutes(tinChecked, 0.1) });
    let status = 'tin_verified';
    for (const s of b.steps) {
      const officer = OFFICERS[s.by];
      const at = ago(s.daysAgo);
      const stage = status;
      events.push({ from: stage, to: s.to, trigger: 'officer', actor: officer.userId, at });
      reviews.push({
        stage, decision: s.to === 'rejected' ? 'rejected' : 'passed', officer,
        reason: s.reason ?? null, notes: s.notes, at, to: s.to,
      });
      status = s.to;
      if (s.activate) {
        events.push({ from: 'approved', to: 'active', trigger: 'officer', actor: officer.userId, at: new Date(at.getTime() + 1500) });
        status = 'active';
      }
    }
    const lastMove = events.at(-1).at;

    await insert(c, 'orgs', {
      id: orgId, legal_name: b.name, domain: 'hospitality', rdb_entity_group: 'accommodation',
      accommodation_class: b.cls, tin: b.tin, psf_member: b.psfMember ?? true,
      registration_status: status, district_id: place.district_id, sector_id: place.sector_id,
      address_text: b.street, created_at: created, updated_at: lastMove,
      contract_version: CONTRACT_VERSION, contract_accepted_at: accepted, contract_accepted_by_user_id: owner.id,
    });
    await insert(c, 'workspaces', { id: workspaceId, kind: 'business', org_id: orgId, created_at: created, updated_at: created });
    await insert(c, 'org_memberships', {
      id: R('03', b.n), org_id: orgId, user_id: owner.id, org_role: 'owner', created_at: created, updated_at: created,
    });
    let cert = 0;
    for (const k of b.certificates) {
      cert += 1;
      const issued = ago(k.issuedDaysAgo);
      await insert(c, 'org_certificates', {
        id: R('09', b.n * 10 + cert), org_id: orgId, kind: k.kind, certificate_number: k.number,
        issued_by: k.issuedBy, issued_on: kigaliDate(issued.getTime()),
        expires_on: kigaliDate(addDays(issued, Math.round(365 * k.validYears)).getTime()), created_at: created, updated_at: created,
      });
    }
    await insert(c, 'subscription_invoices', {
      id: R('07', b.n), org_id: orgId, invoice_kind: 'registration_fee', amount_rwf: feeRwf,
      status: 'paid', idempotency_key: `registration_fee:${orgId}`, created_at: created, updated_at: paid,
    });
    await insert(c, 'tin_verifications', {
      id: R('06', b.n), org_id: orgId, tin: b.tin, result: 'verified', latency_ms: 380 + b.n * 23,
      adapter_mode: 'mock', raw_response: { mock: true, tin: b.tin, status: 'VALID', source: 'seed-demo-portfolio' },
      checked_at: tinChecked,
    });
    let i = 0;
    for (const ev of events) {
      i += 1;
      await insert(c, 'org_registration_events', {
        id: R('04', b.n * 10 + i), org_id: orgId, from_status: ev.from, to_status: ev.to,
        trigger: ev.trigger, actor_user_id: ev.actor, occurred_at: ev.at,
      });
    }
    let r = 0;
    for (const rv of reviews) {
      r += 1;
      await insert(c, 'org_registration_reviews', {
        id: R('05', b.n * 10 + r), org_id: orgId, stage: rv.stage, decision: rv.decision,
        decided_by_user_id: rv.officer.userId, oversight_role: rv.officer.role,
        government_body_code: rv.officer.body, government_title: rv.officer.title,
        reason_code: rv.reason, notes: rv.notes, decided_at: rv.at,
      });
      // F-S03 §10: every gate decision carries an audit row, as the API writes it.
      await insert(c, 'audit_events', {
        id: R('08', b.n * 10 + r), actor_user_id: rv.officer.userId, subject_type: 'org', subject_id: orgId,
        event_type: `registration.${rv.stage}.${rv.decision}`,
        payload_diff: {
          from: rv.stage, to: rv.to, oversightRole: rv.officer.role,
          governmentBodyCode: rv.officer.body, governmentTitle: rv.officer.title,
        },
        reason: rv.reason, district_id: place.district_id, occurred_at: rv.at,
      });
    }
  }
}

// =============================================================================
// ADMIN — past stays, reviews, support tickets
// =============================================================================

const H = (kind, n) => id('0032', kind, n);
const S = (kind, n) => id('0033', kind, n);

const GUESTS = [
  person('02', 1, 'Nadia Kamikazi', { gender: 'female', dob: '1993-05-11', since: ago(55) }),
  person('02', 2, 'Thomas Berger', { gender: 'male', dob: '1986-10-02', since: ago(40) }),
  person('02', 3, 'Kevin Mutabazi', { gender: 'male', dob: '1995-02-17', since: ago(20) }),
  person('02', 4, 'Sofia Lindqvist', { gender: 'female', dob: '1990-07-23', since: ago(35) }),
  person('02', 5, 'Cedric Ndayisaba', { gender: 'male', dob: '1989-12-01', since: ago(15) }),
];

/** One past booking, stay and guest review each. `inDaysAgo` is the arrival. */
const STAYS = [
  {
    n: 1, slug: 'kivu-crest-hotel', room: '11', guest: 0, inDaysAgo: 41, nights: 3,
    review: {
      rating: 5, sub: [5, 5, 5, 5, 5, 4], state: 'visible',
      comment: 'Woke up to the lake every morning. The front desk arranged a boat trip for our second day and breakfast on the terrace was excellent.',
    },
  },
  {
    n: 2, slug: 'kivu-crest-hotel', room: '12', guest: 1, inDaysAgo: 27, nights: 2,
    review: {
      rating: 4, sub: [5, 4, 4, 4, 5, 4], state: 'visible',
      comment: 'Quiet rooms and a great breakfast. The hot water took a few minutes to come through in the mornings.',
    },
  },
  {
    // The one the moderation desk has to act on: it touts a rival off the platform.
    n: 3, slug: 'kivu-crest-hotel', room: '11', guest: 2, inDaysAgo: 13, nights: 1,
    review: {
      rating: 1, sub: [2, 1, 2, 1, 3, 1], state: 'flagged',
      comment: 'Overpriced. Do not book here. Call me on 0780 000 000 or WhatsApp, I rent rooms by the lake for half the price, pay cash.',
    },
    escalation: { type: 'off_platform_leakage' },
  },
  {
    n: 4, slug: 'umurage-guesthouse-musanze', room: 'G1', guest: 3, inDaysAgo: 21, nights: 3,
    review: {
      rating: 5, sub: [5, 5, 5, 5, 5, 5], state: 'visible',
      comment: 'A perfect base for trekking. Breakfast was ready at six as promised and the host packed us lunch for the park.',
    },
    hostReply: 'Sofia was a wonderful guest: on time, tidy and kind to our staff. Welcome back any time.',
  },
  {
    n: 5, slug: 'umurage-guesthouse-musanze', room: 'G2', guest: 4, inDaysAgo: 9, nights: 2,
    review: {
      rating: 3, sub: [4, 3, 4, 4, 2, 3], state: 'visible',
      comment: 'Clean room and a friendly host, but the road in is rough after rain and nobody warned us.',
    },
  },
];

async function seedStaysAndReviews(c) {
  for (const g of GUESTS) await seedPerson(c, g);

  for (const st of STAYS) {
    const { rows } = await c.query(
      `SELECT r.id AS room_id, r.room_type_id, p.workspace_id, p.name AS property, p.district_id,
              rp.id AS rate_plan_id, coalesce(rp.base_price_rwf, rt.base_price_rwf) AS base_price_rwf, rt.booking_mode, rt.cancellation_tier
         FROM rooms r
         JOIN properties p ON p.id = r.property_id
         JOIN room_types rt ON rt.id = r.room_type_id
         LEFT JOIN rate_plans rp ON rp.room_type_id = r.room_type_id AND rp.is_default
        WHERE p.slug = $1 AND r.label = $2 LIMIT 1`,
      [st.slug, st.room],
    );
    if (rows.length === 0) {
      throw new Error(`Room ${st.room} at ${st.slug} is missing. Run seed-demo.mjs first.`);
    }
    const room = rows[0];
    const guest = GUESTS[st.guest];
    const bookingId = H('01', st.n);
    const stayId = H('02', st.n);
    const nightly = Number(room.base_price_rwf);
    const gross = nightly * st.nights;
    const checkIn = addDays(TODAY, -st.inDaysAgo);
    const checkOut = addDays(checkIn, st.nights);
    const booked = addDays(checkIn, -12);
    const prefix = st.slug.startsWith('kivu') ? 'KC' : 'UM';

    await insert(c, 'bookings', {
      id: bookingId, reference: `BK-DEMO-${prefix}3${pad(st.n, 2)}`, room_type_id: room.room_type_id,
      rate_plan_id: room.rate_plan_id, guest_user_id: guest.id, workspace_id: room.workspace_id,
      check_in: iso(checkIn), check_out: iso(checkOut), guest_count: 2, status: 'confirmed',
      booking_mode: room.booking_mode, locked_nightly_rate_rwf: nightly,
      locked_cancellation_tier: room.cancellation_tier, gross_rwf: gross, payment_status: 'paid_out',
      confirmed_at: booked, created_at: booked, updated_at: checkOut,
    });
    await insert(c, 'escrows', {
      id: H('03', st.n), workspace_id: room.workspace_id, source: 'booking', booking_id: bookingId,
      amount_rwf: gross, status: 'released', ...mockRef(H('03', st.n)), created_at: booked, updated_at: addDays(checkOut, 1),
    });
    // ADR-032: a booking has exactly one thread.
    await insert(c, 'threads', {
      id: H('04', st.n), workspace_id: room.workspace_id, booking_id: bookingId, thread_kind: 'reservation',
      status: 'active', created_at: booked, updated_at: booked,
    });
    const entry = kigaliAt(checkIn, 14);
    const exit = kigaliAt(checkOut, 10);
    await insert(c, 'guest_stays', {
      id: stayId, booking_id: bookingId, guest_user_id: guest.id, room_id: room.room_id,
      workspace_id: room.workspace_id, check_in_mode: 'staffed', is_verified: true,
      entry_at: entry, planned_exit_at: exit, actual_exit_at: exit, price_rwf: gross,
      lifecycle: 'closed', guest_name: guest.name, created_at: entry, updated_at: exit,
    });

    const reviewed = new Date(exit.getTime() + 20 * 36e5);
    const [cleanliness, accuracy, checkInScore, communication, location, value] = st.review.sub;
    await insert(c, 'reviews', {
      id: H('05', st.n), stay_id: stayId, side: 'guest_to_host', workspace_id: room.workspace_id,
      overall_rating: st.review.rating, cleanliness, accuracy, check_in: checkInScore, communication, location, value,
      comment: st.review.comment, moderation_state: st.review.state,
      published_at: st.review.state === 'visible' ? reviewed : null,
      created_at: reviewed, updated_at: st.review.state === 'flagged' ? new Date(reviewed.getTime() + 2 * 36e5) : reviewed,
    });
    if (st.hostReply) {
      const replied = new Date(reviewed.getTime() + 5 * 36e5);
      await insert(c, 'reviews', {
        id: H('06', st.n), stay_id: stayId, side: 'host_to_guest', workspace_id: room.workspace_id,
        comment: st.hostReply, moderation_state: 'visible', published_at: replied,
        created_at: replied, updated_at: replied,
      });
    }
    if (st.escalation) {
      const raised = new Date(reviewed.getTime() + 2 * 36e5);
      await insert(c, 'escalations', {
        id: S('02', st.n), subject_type: 'review', subject_id: H('05', st.n), type: st.escalation.type,
        state: 'open', district_id: room.district_id, created_at: raised, updated_at: raised,
      });
    }
  }
}

async function seedSupportTickets(c) {
  const { rows: d } = await c.query(`SELECT id, name FROM districts WHERE name IN ('Gasabo', 'Kicukiro', 'Rubavu')`);
  const district = Object.fromEntries(d.map((r) => [r.name, r.id]));
  const umucyoOwner = person('01', 1, 'Innocent Niyonsaba');
  const thomas = GUESTS[1];
  const TICKETS_S = [
    {
      n: 1, requester: DEMO.grace, category: 'booking', state: 'open', domain: 'hospitality', district: null,
      createdAt: ago(0, 6), firstResponseAt: null, resolvedAt: null, csat: null,
      name: 'Grace Kwizera', email: 'grace@demo.injishi.com', phone: null,
      message: 'My request at Amahoro Boutique Hotel was declined. The app says the payment was refunded but the money has not reached my mobile money account yet. How long does it take?',
    },
    {
      n: 2, requester: umucyoOwner.id, category: 'listing', state: 'open', domain: 'hospitality', district: district.Gasabo,
      createdAt: ago(2, 3), firstResponseAt: ago(1, 20), resolvedAt: null, csat: null,
      name: umucyoOwner.name, email: umucyoOwner.email, phone: umucyoOwner.phone,
      message: 'We registered Umucyo Garden Guest House and paid the fee. The page says we are waiting for a field visit. Can we choose the day the officer comes? I am travelling on Friday.',
    },
    {
      n: 3, requester: thomas.id, category: 'payment', state: 'resolved', domain: 'hospitality', district: district.Rubavu,
      createdAt: ago(24, 5), firstResponseAt: ago(24, 3), resolvedAt: ago(23, 2), csat: 5,
      name: thomas.name, email: thomas.email, phone: null,
      message: 'My card statement shows two charges for my stay at Kivu Crest Hotel. I only booked once.',
    },
    {
      n: 4, requester: null, category: 'other', state: 'reopened', domain: 'residence', district: district.Kicukiro,
      createdAt: ago(3, 4), firstResponseAt: ago(2, 22), resolvedAt: ago(2, 20), csat: null,
      name: 'Aline Mutoni', email: 'aline.mutoni@guests.demo.injishi.com', phone: '+250788030412',
      message: 'My landlord\'s statement for Ingoro Apartments shows this month\'s rent as half paid. I paid the other half by bank transfer and I have the receipt. It was marked resolved but the statement has not changed.',
    },
  ];
  for (const t of TICKETS_S) {
    await insert(c, 'support_tickets', {
      id: S('01', t.n), requester_user_id: t.requester, category: t.category, state: t.state,
      domain: t.domain, district_id: t.district, first_response_at: t.firstResponseAt,
      resolved_at: t.resolvedAt, csat: t.csat, message: t.message, contact_email: t.email,
      contact_name: t.name, contact_phone: t.phone, created_at: t.createdAt,
      updated_at: t.state === 'reopened' ? ago(0, 9) : t.resolvedAt ?? t.firstResponseAt ?? t.createdAt,
    });
  }
}

// =============================================================================
// Purge
// =============================================================================

/**
 * Null out or delete every row, in any table, that points at one of `ids` in
 * `table` through a foreign key, and has not already gone. It catches rows the
 * API wrote on top of seeded ones during a demo (a decision on a seeded
 * business, a session of a seeded guest). Each attempt runs in a savepoint so a
 * refused one does not abort the purge; whatever is still blocked makes the
 * final delete of `table` fail loudly.
 */
async function sweepReferences(c, table, pattern) {
  const { rows: fks } = await c.query(
    `SELECT k.conrelid::regclass::text AS child, a.attname AS col, NOT a.attnotnull AS nullable
       FROM pg_constraint k
       JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = k.conkey[1]
      WHERE k.contype = 'f' AND k.confrelid = $1::regclass AND array_length(k.conkey, 1) = 1`,
    [table],
  );
  for (const fk of fks) {
    const where = `"${fk.col}"::text LIKE $1`;
    await c.query('SAVEPOINT sweep');
    try {
      if (fk.nullable) await c.query(`UPDATE ${fk.child} SET "${fk.col}" = NULL WHERE ${where}`, [pattern]);
      else await c.query(`DELETE FROM ${fk.child} WHERE ${where}`, [pattern]);
      await c.query('RELEASE SAVEPOINT sweep');
    } catch {
      await c.query('ROLLBACK TO SAVEPOINT sweep');
      await c.query('SAVEPOINT sweep');
      try {
        await c.query(`DELETE FROM ${fk.child} WHERE ${where}`, [pattern]);
        await c.query('RELEASE SAVEPOINT sweep');
      } catch {
        await c.query('ROLLBACK TO SAVEPOINT sweep');
      }
    }
  }
}

async function purge(c) {
  const q = (sql) => c.query(sql, [MY_ROWS]);
  await c.query('BEGIN');
  try {
    // Admin: tickets before the escalations they may name, reviews with their stays.
    await q(`DELETE FROM support_tickets WHERE id::text LIKE $1`);
    await c.query(`DELETE FROM support_tickets WHERE requester_user_id::text LIKE $1`, [MY_USERS]);
    await q(`UPDATE support_tickets SET escalation_id = NULL WHERE escalation_id::text LIKE $1`);
    await q(`DELETE FROM escalations WHERE id::text LIKE $1`);
    await q(`DELETE FROM reviews WHERE id::text LIKE $1 OR stay_id::text LIKE $1`);

    // Stays and bookings (anything the API hung off them first).
    await q(`DELETE FROM threads WHERE id::text LIKE $1 OR booking_id::text LIKE $1 OR guest_stay_id::text LIKE $1 OR lease_id::text LIKE $1`);
    await sweepReferences(c, 'guest_stays', MY_ROWS);
    await q(`DELETE FROM guest_stays WHERE id::text LIKE $1`);

    // Landlord: the hold/escrow cycle is broken first, then children to parents.
    await q(`UPDATE caution_holds SET escrow_id = NULL WHERE id::text LIKE $1 OR escrow_id::text LIKE $1`);
    await q(`DELETE FROM caution_settlements WHERE id::text LIKE $1 OR lease_id::text LIKE $1 OR caution_hold_id::text LIKE $1`);
    await q(`DELETE FROM escrows WHERE id::text LIKE $1 OR booking_id::text LIKE $1 OR caution_hold_id::text LIKE $1`);
    await sweepReferences(c, 'bookings', MY_ROWS);
    await q(`DELETE FROM bookings WHERE id::text LIKE $1`);
    await q(`DELETE FROM caution_holds WHERE id::text LIKE $1 OR lease_id::text LIKE $1`);
    await q(`DELETE FROM maintenance_tickets WHERE id::text LIKE $1 OR lease_id::text LIKE $1 OR room_id::text LIKE $1`);
    await q(`DELETE FROM move_out_notices WHERE id::text LIKE $1 OR lease_id::text LIKE $1`);
    await q(`DELETE FROM contract_filings WHERE id::text LIKE $1 OR lease_id::text LIKE $1`);
    // The signatures this script backfilled onto seed-demo.mjs's five leases.
    // It owns them: they were null before it ran, and nothing else writes them.
    await c.query(
      `UPDATE leases SET landlord_signed_at = NULL, tenant_signed_at = NULL WHERE id = ANY($1::uuid[])`,
      [[DEMO.leaseA1, DEMO.leaseA2, DEMO.leaseB1, DEMO.leaseB2, DEMO.leaseC1]],
    );
    await q(`DELETE FROM rent_charges WHERE id::text LIKE $1 OR lease_id::text LIKE $1`);
    await sweepReferences(c, 'leases', MY_ROWS);
    await q(`DELETE FROM leases WHERE id::text LIKE $1 OR room_id::text LIKE $1`);
    await sweepReferences(c, 'rooms', MY_ROWS);
    await q(`DELETE FROM rooms WHERE id::text LIKE $1`);
    await sweepReferences(c, 'room_types', MY_ROWS);
    await q(`DELETE FROM room_types WHERE id::text LIKE $1`);

    // Pipeline. Events, reviews, TIN checks, certificates and memberships cascade
    // from the org; the audit rows and the invoice do not.
    await q(`DELETE FROM audit_events WHERE id::text LIKE $1 OR (subject_type = 'org' AND subject_id::text LIKE $1)`);
    await q(`DELETE FROM subscription_invoices WHERE id::text LIKE $1 OR org_id::text LIKE $1`);
    await sweepReferences(c, 'workspaces', MY_ROWS);
    await q(`DELETE FROM workspaces WHERE id::text LIKE $1 OR org_id::text LIKE $1`);
    await sweepReferences(c, 'orgs', MY_ROWS);
    await q(`DELETE FROM orgs WHERE id::text LIKE $1`);

    // The people. Profiles, identities, documents, roles and sessions cascade.
    await sweepReferences(c, 'users', MY_USERS);
    const { rowCount: users } = await c.query(`DELETE FROM users WHERE id::text LIKE $1`, [MY_USERS]);
    await c.query('COMMIT');
    console.log(`purge: removed the rows seed-demo-portfolio.mjs owns (${users} non-persona users among them)`);
  } catch (err) {
    await c.query('ROLLBACK');
    throw new Error(`purge failed and was rolled back; nothing was removed.\n  ${err.message}`);
  }
}

// =============================================================================
// Main
// =============================================================================

async function summary(c) {
  const one = async (sql, params = []) => (await c.query(sql, params)).rows;
  const leases = await one(`SELECT status, count(*)::int n FROM leases WHERE workspace_id = $1 GROUP BY status ORDER BY 1`, [DEMO.greenHillsWorkspace]);
  const pipeline = await one(
    `SELECT o.registration_status s, d.name district, count(*)::int n FROM orgs o JOIN districts d ON d.id = o.district_id
      WHERE o.id::text LIKE $1 GROUP BY 1, 2 ORDER BY 2, 1`,
    [MY_ROWS],
  );
  const reviews = await one(`SELECT moderation_state s, count(*)::int n FROM reviews WHERE id::text LIKE $1 GROUP BY 1`, [MY_ROWS]);
  const rent = await one(
    `SELECT count(*)::int n, count(DISTINCT rc.period_month)::int months
       FROM rent_charges rc JOIN leases l ON l.id = rc.lease_id WHERE l.workspace_id = $1`,
    [DEMO.greenHillsWorkspace],
  );
  const filings = await one(
    `SELECT cf.status s, count(*)::int n FROM contract_filings cf
       JOIN leases l ON l.id = cf.lease_id WHERE l.workspace_id = $1 GROUP BY 1 ORDER BY 1`,
    [DEMO.greenHillsWorkspace],
  );
  console.log('\nIngoro Apartments leases:', leases.map((r) => `${r.status}=${r.n}`).join(' '));
  console.log('Registration pipeline:', pipeline.map((r) => `${r.district}/${r.s}=${r.n}`).join(' '));
  console.log('Reviews:', reviews.map((r) => `${r.s}=${r.n}`).join(' '));
  console.log(`Rent ledger: ${rent[0]?.n ?? 0} charges across ${rent[0]?.months ?? 0} months`);
  console.log('Contract filings:', filings.map((r) => `${r.s}=${r.n}`).join(' ') || 'none');
  const touched = Object.entries(written).filter(([, n]) => n > 0);
  console.log(touched.length ? `Rows written: ${touched.map(([t, n]) => `${t}=${n}`).join(' ')}` : 'Rows written: none (already seeded)');
}

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error('DATABASE_URL is not set.');
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await assertSampleDatabase(client, 'seed-demo-portfolio.mjs');
    if (PURGE || RESET) await purge(client);
    if (PURGE) return;

    await client.query('BEGIN');
    try {
      await seedLandlord(client);
      await seedPipeline(client);
      await seedStaysAndReviews(client);
      await seedSupportTickets(client);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
    await summary(client);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(`\nseed-demo-portfolio: ${err.message}`);
  process.exit(1);
});
