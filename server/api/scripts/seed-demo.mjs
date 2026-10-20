// Seed the Demo Environment roster (Spec 0003).
//
// Turns the cast in `injishi.context/doc/mfp-demo-users.md` into real rows:
//
//   government_bodies -> users -> user_profiles -> verified_identities
//   -> identity_documents -> user_roles -> orgs -> workspaces
//   -> org_memberships -> oversight_assignments
//
// It then seeds the OPERATIONAL rows those businesses trade on (ADR-012 build
// plan step 3), because a roster with nothing to work on cannot prove a guarded
// command:
//
//   properties -> listings -> room_types -> rate_plans -> rooms
//   -> bookings -> guest_stays -> escrows
//
// Scoped to what the first thread reads: the Reservations desk. The hotel's
// working day on top of it (departments, outlets and menu, a month of stays and
// bills, housekeeping, maintenance, orders) is `seed-demo-hotel.mjs`, which runs
// after this script and the catalogue, and whose purge `--reset` calls first.
//
// Every id is a deterministic constant (never gen_random_uuid) so re running is
// a no op and `--reset` can find exactly what this script owns.
//
// SAFETY. This writes a fixed sign in code roster and must never touch
// production. It writes into DATABASE_URL and refuses, as its first act, any
// database that does not carry the sample marker (ADR-043,
// `sample-database.mjs`). Only an empty database can be marked, so this can
// never write personas beside real accounts. There is no flag to override it.
// It normally runs as one step of `seed-sample.mjs`.
//
// Run with:
//   pnpm --filter @injishi/api exec node scripts/seed-demo.mjs
//   pnpm --filter @injishi/api exec node scripts/seed-demo.mjs --reset
//   pnpm --filter @injishi/api exec node scripts/seed-demo.mjs --refresh
//
// `--reset` removes the rows this script owns and re-seeds them. `--refresh`
// keeps every row and shifts its dates so today is today again, which is what
// you want when a demo recorded something yesterday that you still want to
// show (ADR-038 child 0, AC-S12).
//
// Preconditions: seed-geography.mjs and seed-content.mjs must have run against
// the SAME database first (districts and rdb_classifications are foreign
// key targets here). The script checks and tells you if they have not.
import { GOVERNMENT_BODIES } from './reference-data.mjs';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeBreakdown } from '@injishi/contracts';
import pg from 'pg';

import { assertSampleDatabase } from './sample-database.mjs';
import { syntheticCoordFor } from './synthetic-coords.mjs';

/**
 * Load `server/api/.env` when the variables are not already set.
 *
 * The script is run directly with `node`, which does not read a `.env`, and the
 * URL it needs carries characters a shell eats if you try to source the file
 * yourself. Existing environment values always win, so CI and Railway are
 * unaffected — this only fills in what a local run has not been given.
 */
function loadDotEnv() {
  const file = path.join(process.cwd(), '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^([A-Za-z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) process.env[match[1]] ??= match[2];
  }
}

loadDotEnv();

const RESET = process.argv.includes('--reset');
/**
 * Shift every seeded date forward so today is today again (task 15, AC-S12).
 *
 * Exclusive with the seed itself: `--refresh` moves what is already there and
 * writes nothing new, so running both in one pass would shift rows that were
 * just inserted at the right dates.
 */
const REFRESH = process.argv.includes('--refresh');

// --- Target ------------------------------------------------------------------

/**
 * The database to seed. Which databases may receive this roster is not decided
 * here but by the marker `assertSampleDatabase` checks right after connecting.
 */
function databaseUrl() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error('DATABASE_URL is not set.');
  return url;
}

// --- Deterministic ids -------------------------------------------------------

const U = (n) => `de300000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;
const O = (n) => `de300000-0000-4000-8000-0000000001${String(n).padStart(2, '0')}`;
const W = (n) => `de300000-0000-4000-8000-0000000002${String(n).padStart(2, '0')}`;
const A = (n) => `de300000-0000-4000-8000-0000000003${String(n).padStart(2, '0')}`;
// The operational half (ADR-012 build plan step 3). Same deterministic scheme,
// one family code each, so `--reset` can find exactly what this script owns.
const PR = (n) => `de300000-0000-4000-8000-0000000004${String(n).padStart(2, '0')}`; // properties
const LS = (n) => `de300000-0000-4000-8000-0000000005${String(n).padStart(2, '0')}`; // listings
const RT = (n) => `de300000-0000-4000-8000-0000000006${String(n).padStart(2, '0')}`; // room types
const RP = (n) => `de300000-0000-4000-8000-0000000007${String(n).padStart(2, '0')}`; // rate plans
const RM = (n) => `de300000-0000-4000-8000-0000000008${String(n).padStart(2, '0')}`; // rooms
const BK = (n) => `de300000-0000-4000-8000-0000000009${String(n).padStart(2, '0')}`; // bookings
const GS = (n) => `de300000-0000-4000-8000-0000000010${String(n).padStart(2, '0')}`; // guest stays
const ES = (n) => `de300000-0000-4000-8000-0000000011${String(n).padStart(2, '0')}`; // escrows
// The residence half (ADR-038 child 0, family `..14NN`): the units, leases and
// rent charges the Landlord rent roll reads. Families 12, 13 and 15 to 18 are
// reserved by the same decision and are filled by later tasks and children.
const SO = (n) => `de300000-0000-4000-8000-0000000012${String(n).padStart(2, '0')}`; // Samuel's orgs
const SW = (n) => `de300000-0000-4000-8000-0000000013${String(n).padStart(2, '0')}`; // Samuel's workspaces
const RR = (n) => `de300000-0000-4000-8000-0000000014${String(n).padStart(2, '0')}`; // rent roll
const TH = (n) => `de300000-0000-4000-8000-0000000015${String(n).padStart(2, '0')}`; // threads
const MS = (n) => `de300000-0000-4000-8000-0000000016${String(n).padStart(2, '0')}`; // messages
const RLP = (n) => `de300000-0000-4000-8000-0000000017${String(n).padStart(2, '0')}`; // role permissions
// The twenty room hotel (demo showcase, 2026-09-15). Rows added to the families
// above take the `0029` block, so the original `00000000NNNN` ids stay exactly
// as other scripts know them: `0029` + a two digit family + a six digit serial.
const XH = (family, n) => `de300000-0000-4000-8000-0029${family}${String(n).padStart(6, '0')}`;

// --- The roster --------------------------------------------------------------
// Mirrors mfp-demo-users.md. `nid` null means no identity document at all,
// which is the deliberate "cannot elevate" case.

const PEOPLE = [
  { id: U(1),  email: 'yves@demo.injishi.com',      name: 'Yves Rutayisire',       kyc: 'verified',   nid: '1198080012345601' },
  { id: U(2),  email: 'solange@demo.injishi.com',   name: 'Solange Uwera',         kyc: 'verified',   nid: '1198580012345602' },
  { id: U(3),  email: 'denise@demo.injishi.com',    name: 'Denise Iribagiza',      kyc: 'verified',   nid: '1199080012345603' },
  { id: U(4),  email: 'beatha@demo.injishi.com',    name: 'Beatha Mukeshimana',    kyc: 'verified',   nid: '1199280012345604' },
  { id: U(5),  email: 'josephine@demo.injishi.com', name: 'Josephine Uwimana',     kyc: 'verified',   nid: '1197580012345605' },
  { id: U(6),  email: 'samuel@demo.injishi.com',    name: 'Samuel Kayitare',       kyc: 'verified',   nid: '1198280012345606', roles: ['broker'] },
  { id: U(7),  email: 'jeanbosco@demo.injishi.com', name: 'Jean-Bosco Nkurunziza', kyc: 'verified',   nid: '1198080012345607', roles: ['gov_oversight'] },
  { id: U(8),  email: 'claudine@demo.injishi.com',  name: 'Claudine Mukamana',     kyc: 'verified',   nid: '1198380012345608', roles: ['gov_oversight'] },
  { id: U(9),  email: 'yvette@demo.injishi.com',    name: 'Yvette Mukamana',       kyc: 'verified',   nid: '1198480012345609', roles: ['gov_oversight'] },
  { id: U(10), email: 'alice@demo.injishi.com',     name: 'Alice Uwimana',         kyc: 'verified',   nid: '1198680012345610', roles: ['gov_oversight'] },
  { id: U(11), email: 'rayan@demo.injishi.com',     name: 'Rayan Iraguha',         kyc: 'verified',   nid: '1199080123456789' },
  // Books with no document at all: the demand side stays email OTP only.
  { id: U(12), email: 'grace@demo.injishi.com',     name: 'Grace Kwizera',         kyc: 'unverified', nid: null },
  // Tries to become a Host and is refused: no active identity document.
  { id: U(13), email: 'theoneste@demo.injishi.com', name: 'Theoneste Bimenyimana', kyc: 'unverified', nid: null },
  // Held an oversight grant; it was revoked. Signs in, gets no console.
  { id: U(14), email: 'fidele@demo.injishi.com',    name: 'Fidele Nkurikiyimana',  kyc: 'verified',   nid: '1198780012345614', roles: ['gov_oversight'] },
  // Platform staff, so a presenter can open the admin console on the demo
  // (ADR-043, AC-20). `ops`, not `super_admin`: the demo signs anyone in with a
  // published code, so its staff persona holds the narrowest lens that still
  // shows the console working.
  { id: U(15), email: 'ops@demo.injishi.com',       name: 'Olivier Habimana',      kyc: 'verified',   nid: '1198880012345615', roles: ['admin'], staffRoles: ['ops'] },
  // ADR-054 AC-D2: registered a hotel group with two branches, now waiting in
  // Jean-Bosco's verification queue, so a presenter can show the branches an
  // officer sees without typing a registration first.
  { id: U(16), email: 'aimable@demo.injishi.com',   name: 'Aimable Ntwari',        kyc: 'verified',   nid: '1198980012345616' },
  // ADR-054 AC-D2: a receptionist limited to the Musanze branch, so a presenter
  // can show that every ops screen, and every id probe, stops at her branch.
  { id: U(17), email: 'clarisse@demo.injishi.com',  name: 'Clarisse Ingabire',     kyc: 'verified',   nid: '1199180012345617' },
];

const ORGS = [
  {
    id: O(1), legalName: 'Amahoro Hospitality Group', domain: 'hospitality',
    tin: '102938001', entityGroup: 'accommodation', accommodationClass: 'hotel',
    registrationStatus: 'active', district: 'Gasabo',
  },
  {
    // D24: TIN is for businesses, UPI is for residences — `orgs_identifier_shape`
    // rejects a residence row carrying a TIN and no UPI, which this one used to.
    id: O(2), legalName: 'Green Hills Properties', domain: 'residence',
    upi: '1/03/07/02/1234', entityGroup: 'accommodation',
    residenceClass: 'residential_landlord',
    registrationStatus: 'active', district: 'Gasabo',
  },
  {
    // ADR-054 AC-D2. Paid and TIN checked, so it sits at `tin_verified` in
    // Gasabo, which is Jean-Bosco's district. Its branches are PR(7) to PR(9).
    id: O(3), legalName: 'Inzozi Hotels Ltd', domain: 'hospitality',
    tin: '102938004', entityGroup: 'accommodation', accommodationClass: 'hotel',
    registrationStatus: 'tin_verified', district: 'Gasabo',
  },
];

const MEMBERSHIPS = [
  { orgId: O(1), userId: U(1), role: 'owner' },
  { orgId: O(1), userId: U(2), role: 'manager' },
  { orgId: O(1), userId: U(3), role: 'receptionist' },
  { orgId: O(1), userId: U(4), role: 'housekeeper' },
  { orgId: O(2), userId: U(5), role: 'owner' },
  { orgId: O(3), userId: U(16), role: 'owner' },
  // Limited to Musanze (PR(4)); `MEMBERSHIP_BRANCHES` below writes the limit.
  { orgId: O(1), userId: U(17), role: 'receptionist' },
  // **Samuel's Green Hills hat was REMOVED (ADR-038 child 0, task 14).**
  //
  // It was here to give him a landlord seat before he had a building of his
  // own. Task 14 gave him Kayitare Court, and holding both left him with SIX
  // seats and two landlord surfaces, against AC-3, which says he sees five.
  //
  // Green Hills stays Josephine's org with her as owner, so the rent roll
  // behind it is untouched and her Landlord surface still has rows. Only
  // Samuel's second, duplicate landlord seat is gone.
];

/**
 * Branch limits (ADR-054 AC-T1, AC-D2). A membership with no row here covers
 * every branch, so only the limited ones are listed. Written after the
 * properties, which the rows reference.
 */
const MEMBERSHIP_BRANCHES = [
  { orgId: O(1), userId: U(17), propertyIds: [PR(4)] },
];

/**
 * What Amahoro decided its own roles mean (ADR-055).
 *
 * TWO ROWS, ONE IN EACH DIRECTION, because a demo that only ever showed a grant
 * would leave the more surprising half — that an owner can take something AWAY
 * from a manager — untold.
 *
 *  - Denise, on the front desk, can read the takings. Plenty of small hotels
 *    give reception the day's number; the platform default does not, and this is
 *    the business saying otherwise.
 *  - Solange, managing, cannot withdraw a signed RRA receipt. It reduces
 *    declared turnover, and Yves keeps that to himself.
 *
 * Both are chosen to be VISIBLE and to break nothing: `money.view` opens the
 * Money section for Denise, and `ebm.refund` is a button Solange no longer
 * has — neither is a permission any demo guide walks somebody through using.
 *
 * `de300000-0000-4000-8000-` ids like everything else this seed writes, so
 * `--reset` reaches them.
 */
const ROLE_PERMISSIONS = [
  {
    id: RLP(1), orgId: O(1), role: 'receptionist',
    permission: 'money.view', granted: true, setBy: U(1),
  },
  {
    id: RLP(2), orgId: O(1), role: 'manager',
    permission: 'ebm.refund', granted: false, setBy: U(1),
  },
];


const WORKSPACES = [
  { id: W(1), kind: 'business', orgId: O(1) },
  { id: W(2), kind: 'business', orgId: O(2) },
  // Samuel: one human, one broker workspace, one personal workspace.
  { id: W(3), kind: 'broker',   userId: U(6) },
  { id: W(4), kind: 'personal', userId: U(6) },
  { id: W(5), kind: 'personal', userId: U(11) },
  { id: W(6), kind: 'personal', userId: U(12) },
  { id: W(7), kind: 'personal', userId: U(13) },
  { id: W(8), kind: 'personal', userId: U(14) },
  // The pending registration's workspace, pending and powerless (D20).
  { id: W(9), kind: 'business', orgId: O(3) },
];

/* ── Samuel's five seats (ADR-038 child 0, task 14, AC-S11) ────────────────
 *
 * The app used to carry these in `apps/mobile/src/data/personas.ts` as a
 * constant called `WORKSPACES`. Task 8 deleted it, so the switcher shows
 * whatever `GET /api/v1/me/workspaces` returns — which means the seats a
 * presenter demonstrates have to EXIST, in the database, or the switcher is
 * empty and the whole point of the demo account is lost.
 *
 * Samuel is one human wearing five hats, which is the case the switcher exists
 * for and the one most likely to be got wrong. The five, and where each comes
 * from:
 *
 *   | Seat               | Surface  | Row                                    |
 *   |--------------------|----------|----------------------------------------|
 *   | Personal           | tenant   | `W(4)`, already in the roster above     |
 *   | Kayitare Court     | landlord | `SO(1)` + `SW(1)`, owner                |
 *   | Broker             | broker   | `W(3)`, already in the roster above     |
 *   | Kivu Crest Hotel   | work     | `SO(2)` + `SW(2)`, housekeeper          |
 *   | Umurage Guesthouse | host     | `SO(3)` + `SW(3)`, owner. Parked.       |
 *
 * **The brokerage cannot carry its name, and that is the schema's answer rather
 * than an oversight.** `personas.ts` called the broker seat "Aline K.
 * Brokerage", but `workspaces_kind_shape` requires a broker workspace to hang
 * off a USER and carry no org, and `workspaceLabel()` in `@injishi/contracts`
 * answers the literal "Broker" for one. Giving the brokerage an org row would
 * make its workspace a BUSINESS workspace, which derives to landlord or host —
 * the wrong surface entirely. So the seat reads "Broker" until somebody decides
 * whether a broker workspace may be named, which is a contract change and
 * therefore its own decision.
 *
 * **Nobody is on both sides of one lease.** Samuel manages Green Hills and owns
 * Kayitare Court; he is a tenant on neither. `assertNoSelfLease` below proves
 * it at the end of every run rather than leaving it to whoever reads this.
 */

const SAMUEL_ORGS = [
  {
    // Residence, so it carries a UPI and no TIN (D24, `orgs_identifier_shape`).
    id: SO(1), legalName: 'Kayitare Court', domain: 'residence',
    upi: '1/03/09/04/5678', entityGroup: 'accommodation',
    residenceClass: 'residential_landlord',
    registrationStatus: 'active', district: 'Kicukiro',
  },
  {
    id: SO(2), legalName: 'Kivu Crest Hotel', domain: 'hospitality',
    tin: '102938002', entityGroup: 'accommodation', accommodationClass: 'hotel',
    registrationStatus: 'active', district: 'Rubavu',
  },
  {
    // Parked (ADR-038 parent Follow-up): the Host surface is built and the
    // switcher never offers it. The seat is seeded anyway, because a parked
    // surface reachable by deep link with no workspace behind it is a screen
    // that renders nothing and looks broken.
    id: SO(3), legalName: 'Umurage Guesthouse', domain: 'hospitality',
    tin: '102938003', entityGroup: 'accommodation', accommodationClass: 'guest_house',
    registrationStatus: 'active', district: 'Musanze',
  },
];

const SAMUEL_WORKSPACES = [
  { id: SW(1), kind: 'business', orgId: SO(1) },
  { id: SW(2), kind: 'business', orgId: SO(2) },
  { id: SW(3), kind: 'business', orgId: SO(3) },
];

const SAMUEL_MEMBERSHIPS = [
  // Owner of the building named after him, which is the landlord seat.
  { orgId: SO(1), userId: U(6), role: 'owner' },
  // `housekeeper` and not `owner`: the derivation table sends a hospitality
  // business seat to `work` ONLY for a housekeeper, and the Work surface is the
  // one this seat exists to demonstrate.
  { orgId: SO(2), userId: U(6), role: 'housekeeper' },
  // Owner, which derives to `host` — the parked surface.
  { orgId: SO(3), userId: U(6), role: 'owner' },
];

const BODIES = GOVERNMENT_BODIES;

const ASSIGNMENTS = [
  { id: A(1), userId: U(7),  role: 'business_field_verifier', body: 'PSF',     title: 'Business Registration Officer', district: 'Gasabo' },
  { id: A(2), userId: U(8),  role: 'business_approver',       body: 'MINALOC', title: 'BDO',                           district: 'Gasabo' },
  { id: A(3), userId: U(9),  role: 'business_field_verifier', body: 'PSF',     title: 'Business Registration Officer', district: 'Karongi' },
  { id: A(4), userId: U(10), role: 'business_field_verifier', body: 'PSF',     title: 'Business Registration Officer', district: 'Kicukiro' },
  // Revoked on purpose: proves no active assignment means no console at all.
  { id: A(5), userId: U(14), role: 'business_field_verifier', body: 'PSF',     title: 'Business Registration Officer', district: 'Gasabo', revoked: true },
];

// --- The operational fixtures (ADR-012 step 3) --------------------------------
//
// What the first guarded command reads. The Reservations screen asks
// `GET /api/v1/ops/reservations` for the Amahoro workspace and gets this back,
// and `POST :id/approve` and `:id/decline` act on the two pending rows.
//
// DATES ARE RELATIVE TO THE MOMENT YOU SEED, so the desk looks alive: something
// arriving today, someone in a room right now, someone who left last week. That
// also means the desk goes stale after a week or so. Re running stays a no op by
// design (every insert is ON CONFLICT DO NOTHING), so `--reset` is how you make
// it current again.
//
// Every state the screen can render is present on purpose, including the two it
// hides or greys out, because "it renders" is not the same as "it renders the
// case that goes wrong".

/**
 * The seed's clock. `DEMO_SEED_NOW` (an ISO instant, e.g.
 * `2026-09-14T23:30:00Z`) stands in for "now", read ONLY by the demo seeds, so
 * the hour when the Kigali and UTC calendars disagree can be tested on purpose.
 * Unset, it is the real clock.
 */
const NOW = (() => {
  const fake = process.env.DEMO_SEED_NOW?.trim();
  if (!fake) return new Date();
  const d = new Date(fake);
  if (Number.isNaN(d.getTime())) throw new Error(`DEMO_SEED_NOW is not a date: ${fake}`);
  return d;
})();

/**
 * Days from today, as a bare YYYY-MM-DD the `date` columns take verbatim.
 *
 * TODAY IS KIGALI'S (Africa/Kigali, UTC+2, no daylight saving): every demo
 * property's desk, night audit and month run on it. The UTC calendar is a day
 * behind between 22:00 and 24:00 UTC, which put an arrival "today" on
 * yesterday's line of a Today screen.
 */
function day(offset) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kigali' }).format(NOW);
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

/** Hours from now, for the timestamp columns. */
function hoursFromNow(offset) {
  return new Date(NOW.getTime() + offset * 3600 * 1000);
}

// Every persona business that trades stays owns a PUBLISHED property with a
// slug, so each one is on the marketplace: the home page, Explore and its own
// page (2026-09-14). A property with no slug is invisible to discovery however
// published its listing is, which is how Amahoro sat off the marketplace.
const PROPERTIES = [
  {
    id: PR(1), orgId: O(1), workspaceId: W(1), slug: 'amahoro-boutique-hotel',
    // ADR-054 AC-D1: the head office, in Remera. Set here rather than left to
    // the head office pass, because the demo walks depend on which one it is.
    isHeadOffice: true,
    name: 'Amahoro Boutique Hotel',
    description: 'Twenty rooms off the Remera roundabout, run by the group that owns it.',
    district: 'Gasabo', sector: 'Remera', street: 'KG 11 Ave',
    checkIn: '14:00', checkOut: '11:00',
    houseRules: 'No smoking indoors. Quiet hours from 22:00.',
  },
  {
    // Samuel's work seat (housekeeper). The org existed with nothing to clean.
    id: PR(2), orgId: SO(2), workspaceId: SW(2), slug: 'kivu-crest-hotel', isHeadOffice: true,
    name: 'Kivu Crest Hotel',
    description: 'A fictional demo hotel: fourteen rooms on the hill above the Gisenyi shore, a short walk to Lake Kivu.',
    district: 'Rubavu', sector: 'Gisenyi', street: 'Gisenyi lakeshore',
    checkIn: '14:00', checkOut: '10:30',
    houseRules: 'No smoking indoors. Quiet hours from 22:00. Valid ID required at check-in.',
  },
  {
    // Samuel's parked host seat. Named for its town because the catalogue's own
    // Umurage Guesthouse (seed-content.mjs, Gasabo) already holds the plain slug.
    id: PR(3), orgId: SO(3), workspaceId: SW(3), slug: 'umurage-guesthouse-musanze', isHeadOffice: true,
    name: 'Umurage Guesthouse Musanze',
    description: 'A fictional demo guest house: six garden rooms in Musanze town, an hour from the Volcanoes park gate.',
    district: 'Musanze', sector: 'Muhoza', street: 'Musanze town centre',
    checkIn: '13:00', checkOut: '10:00',
    houseRules: 'Breakfast from 06:00 for trekking days. Quiet hours from 21:30.',
  },
  /* ── Amahoro's other branches (ADR-054 AC-D1) ────────────────────────────
   *
   * One TIN, one workspace, several locations. Musanze and Rubavu trade, each
   * with its own RRA branch id; Kicukiro was retired, so it is archived with
   * its listing back at draft and its slug kept, and one past stay proves its
   * history stays readable.
   */
  {
    id: PR(4), orgId: O(1), workspaceId: W(1), slug: 'amahoro-musanze', rraBranchId: '02',
    name: 'Amahoro Musanze',
    description: 'A fictional demo branch: ten rooms in Musanze town for trekkers heading to the Volcanoes park.',
    district: 'Musanze', sector: 'Muhoza', street: 'NM 14 St',
    checkIn: '13:00', checkOut: '10:00',
    houseRules: 'Breakfast from 05:30 on trekking days. Quiet hours from 21:30.',
  },
  {
    id: PR(5), orgId: O(1), workspaceId: W(1), slug: 'amahoro-rubavu', rraBranchId: '01',
    name: 'Amahoro Rubavu',
    description: 'A fictional demo branch: twelve rooms a street back from the Gisenyi lakeshore.',
    district: 'Rubavu', sector: 'Gisenyi', street: 'Avenue de la Cooperation',
    checkIn: '14:00', checkOut: '11:00',
    houseRules: 'No smoking indoors. Quiet hours from 22:00.',
  },
  {
    id: PR(6), orgId: O(1), workspaceId: W(1), slug: 'amahoro-kicukiro', archived: true,
    name: 'Amahoro Kicukiro',
    description: 'A fictional demo branch Amahoro closed. Archived, so it is off the marketplace.',
    district: 'Kicukiro', sector: 'Kagarama', street: 'KK 31 Ave',
    checkIn: '14:00', checkOut: '11:00',
    houseRules: null,
  },
  // Inzozi Hotels Ltd, still in review (AC-D2). The head office and the two
  // branches it declared, exactly as registration writes them: draft listings,
  // no room types, nothing on the marketplace until approval.
  {
    id: PR(7), orgId: O(3), workspaceId: W(9), slug: null, isHeadOffice: true,
    name: 'Inzozi Hotels Ltd', description: null,
    district: 'Gasabo', sector: 'Kimironko', street: 'KG 180 St',
    checkIn: null, checkOut: null, houseRules: null,
  },
  {
    id: PR(8), orgId: O(3), workspaceId: W(9), slug: null,
    name: 'Inzozi Huye', description: null,
    district: 'Huye', sector: 'Ngoma', street: 'Huye town centre',
    checkIn: null, checkOut: null, houseRules: null,
  },
  {
    id: PR(9), orgId: O(3), workspaceId: W(9), slug: null,
    name: 'Inzozi Karongi', description: null,
    district: 'Karongi', sector: 'Bwishyura', street: 'Kibuye lakeshore',
    checkIn: null, checkOut: null, houseRules: null,
  },
];

// Published, because a draft is what the listing wizard produces and this one is
// meant to be a business already trading.
const LISTINGS = [
  { id: LS(1), propertyId: PR(1), workspaceId: W(1), status: 'published' },
  { id: LS(2), propertyId: PR(2), workspaceId: SW(2), status: 'published' },
  { id: LS(3), propertyId: PR(3), workspaceId: SW(3), status: 'published' },
  // ADR-054. LS(4) is the residence building's, further down.
  { id: LS(5), propertyId: PR(4), workspaceId: W(1), status: 'published' },
  { id: LS(6), propertyId: PR(5), workspaceId: W(1), status: 'published' },
  // Archiving returns a listing to draft (AC-M3).
  { id: LS(7), propertyId: PR(6), workspaceId: W(1), status: 'draft' },
  { id: LS(8), propertyId: PR(7), workspaceId: W(9), status: 'draft' },
  { id: LS(9), propertyId: PR(8), workspaceId: W(9), status: 'draft' },
  { id: LS(10), propertyId: PR(9), workspaceId: W(9), status: 'draft' },
];

// Amahoro is twenty rooms: eight Standard Doubles on the first floor, four
// Executive Suites on the second, eight Deluxe Twins on the third. `roomCount`
// is the number of rooms below, and the rates sit where a Remera boutique
// hotel's do (roughly 50 to 100 US dollars a night), room only.
const ROOM_TYPES = [
  {
    id: RT(1), propertyId: PR(1), workspaceId: W(1), name: 'Standard Double',
    maxGuests: 2, capacity: 2, roomCount: 8, priceRwf: 75000,
    // Instant book carries no approval policy, and the
    // `room_types_approval_policy_shape` check enforces that rather than
    // trusting this comment.
    bookingMode: 'instant_book', approvalPolicy: null, cancellationTier: 'flexible',
  },
  {
    id: RT(2), propertyId: PR(1), workspaceId: W(1), name: 'Executive Suite',
    maxGuests: 3, capacity: 3, roomCount: 4, priceRwf: 150000,
    // Request to book is what makes the approve command mean anything: only a
    // `pending_approval` booking is there to approve.
    bookingMode: 'request_to_book', approvalPolicy: 'approve_all', cancellationTier: 'moderate',
  },
  {
    id: XH('06', 1), ratePlanId: XH('07', 1), propertyId: PR(1), workspaceId: W(1), name: 'Deluxe Twin',
    maxGuests: 2, capacity: 2, roomCount: 8, priceRwf: 90000,
    bookingMode: 'instant_book', approvalPolicy: null, cancellationTier: 'flexible',
  },
  {
    id: RT(3), propertyId: PR(2), workspaceId: SW(2), name: 'Lake View Double',
    maxGuests: 2, capacity: 2, roomCount: 2, priceRwf: 85000,
    bookingMode: 'instant_book', approvalPolicy: null, cancellationTier: 'flexible',
  },
  {
    id: RT(4), propertyId: PR(3), workspaceId: SW(3), name: 'Garden Room',
    maxGuests: 2, capacity: 2, roomCount: 2, priceRwf: 42000,
    bookingMode: 'instant_book', approvalPolicy: null, cancellationTier: 'flexible',
  },
  // Amahoro's branches (ADR-054 AC-D1).
  {
    id: RT(5), propertyId: PR(4), workspaceId: W(1), name: 'Volcano View Double',
    maxGuests: 2, capacity: 2, roomCount: 2, priceRwf: 65000,
    bookingMode: 'instant_book', approvalPolicy: null, cancellationTier: 'flexible',
  },
  {
    id: RT(6), propertyId: PR(5), workspaceId: W(1), name: 'Lakeside Double',
    maxGuests: 2, capacity: 2, roomCount: 2, priceRwf: 70000,
    bookingMode: 'instant_book', approvalPolicy: null, cancellationTier: 'flexible',
  },
  {
    id: RT(7), propertyId: PR(6), workspaceId: W(1), name: 'Standard Double',
    maxGuests: 2, capacity: 2, roomCount: 1, priceRwf: 40000,
    bookingMode: 'instant_book', approvalPolicy: null, cancellationTier: 'flexible',
  },
];

// One "Standard rate" per room type, carrying the same values verbatim (F-L03).
// The room type columns are deprecated but the booking engine still reads them,
// so both sides are written and they agree.
const RATE_PLANS = ROOM_TYPES.map((rt, i) => ({
  id: rt.ratePlanId ?? RP(i + 1), roomTypeId: rt.id, workspaceId: rt.workspaceId, name: 'Standard rate',
  priceRwf: rt.priceRwf, baseOccupancy: 2,
  bookingMode: rt.bookingMode, approvalPolicy: rt.approvalPolicy,
  cancellationTier: rt.cancellationTier,
}));

/**
 * The rooms, with the housekeeping state the board shows this morning.
 *
 * The states are not decoration: `seed-demo-hotel.mjs` seeds the day behind
 * them (who is in each room, who leaves today, which clean is on whose list),
 * and they have to agree with it. Occupied rooms waiting for their stayover are
 * dirty until their stayover is done; the rooms being made ready for today's arrivals are inspected; 307 is
 * off sale for a ceiling leak, which is the one `status` that is not
 * `available`. `hkAt` is today's clock time in Kigali, `hkBy` who set it.
 */
const ROOMS = [
  { id: RM(1),        roomTypeId: RT(1), label: '101', housekeeping: 'clean', hkAt: '08:40', hkBy: U(4) },
  { id: RM(2),        roomTypeId: RT(1), label: '102', housekeeping: 'dirty' },
  { id: XH('08', 3),  roomTypeId: RT(1), label: '103', housekeeping: 'inspected', hkAt: '-1 11:20', hkBy: U(4) },
  { id: XH('08', 4),  roomTypeId: RT(1), label: '104', housekeeping: 'dirty' },
  { id: XH('08', 5),  roomTypeId: RT(1), label: '105', housekeeping: 'clean', hkAt: '09:05', hkBy: U(4) },
  { id: XH('08', 6),  roomTypeId: RT(1), label: '106', housekeeping: 'dirty' },
  { id: XH('08', 7),  roomTypeId: RT(1), label: '107', housekeeping: 'dirty', hkAt: '06:15' },
  { id: XH('08', 8),  roomTypeId: RT(1), label: '108', housekeeping: 'inspected', hkAt: '-1 15:30', hkBy: U(2) },
  { id: RM(3),        roomTypeId: RT(2), label: '201', housekeeping: 'dirty' },
  { id: RM(4),        roomTypeId: RT(2), label: '202', housekeeping: 'clean', hkAt: '10:45', hkBy: U(4) },
  { id: XH('08', 11), roomTypeId: RT(2), label: '203', housekeeping: 'dirty' },
  { id: XH('08', 12), roomTypeId: RT(2), label: '204', housekeeping: 'inspected', hkAt: '10:40', hkBy: U(2) },
  { id: XH('08', 13), roomTypeId: XH('06', 1), label: '301', housekeeping: 'clean', hkAt: '09:50', hkBy: U(4) },
  { id: XH('08', 14), roomTypeId: XH('06', 1), label: '302', housekeeping: 'dirty' },
  { id: XH('08', 15), roomTypeId: XH('06', 1), label: '303', housekeeping: 'dirty' },
  { id: XH('08', 16), roomTypeId: XH('06', 1), label: '304', housekeeping: 'dirty' },
  { id: XH('08', 17), roomTypeId: XH('06', 1), label: '305', housekeeping: 'inspected', hkAt: '10:20', hkBy: U(2) },
  { id: XH('08', 18), roomTypeId: XH('06', 1), label: '306', housekeeping: 'dirty' },
  { id: XH('08', 19), roomTypeId: XH('06', 1), label: '307', housekeeping: 'out_of_order', status: 'maintenance', hkAt: '-1 16:20', hkBy: U(4) },
  { id: XH('08', 20), roomTypeId: XH('06', 1), label: '308', housekeeping: 'dirty' },
  { id: RM(5), roomTypeId: RT(3), label: '11', housekeeping: 'clean' },
  { id: RM(6), roomTypeId: RT(3), label: '12', housekeeping: 'clean' },
  { id: RM(7), roomTypeId: RT(4), label: 'G1', housekeeping: 'clean' },
  { id: RM(8), roomTypeId: RT(4), label: 'G2', housekeeping: 'clean' },
  { id: RM(9), roomTypeId: RT(5), label: 'M1', housekeeping: 'clean' },
  { id: RM(10), roomTypeId: RT(5), label: 'M2', housekeeping: 'clean' },
  { id: RM(11), roomTypeId: RT(6), label: 'R1', housekeeping: 'clean' },
  { id: RM(12), roomTypeId: RT(6), label: 'R2', housekeeping: 'dirty' },
  { id: RM(13), roomTypeId: RT(7), label: 'K1', housekeeping: 'clean' },
];

/**
 * What a seeded booking charged, priced by the booking engine's own function.
 *
 * `computeBreakdown` from `@injishi/contracts` is what `POST /bookings` charges
 * and what the EBM receipt re-derives its lines from, so a seeded total is the
 * total a real guest would have paid for the same room and nights: the rate
 * times the nights plus the guest service fee. This used to be a hand typed
 * `rate × nights` with the fee left off, and the receipt, which refuses a
 * charge its lines do not add back up to, answered every demo booking with a
 * 500 "could not be invoiced". A guest who opened "See receipt" in a demo got
 * an error instead of a document.
 *
 * `legacyGross` is that old flat figure. A re run repairs a row still carrying
 * it (see `seedBooking` and `seedEscrow`) and touches no other total.
 */
function priced(b) {
  const roomType = ROOM_TYPES.find((rt) => rt.id === b.roomType);
  const breakdown = computeBreakdown({
    nightlyRateRwf: roomType.priceRwf,
    nights: b.nights,
    // The seed writes no `nonrefundable`, so every row takes the column default.
    nonRefundable: false,
  });
  return { ...b, gross: breakdown.grossRwf, legacyGross: breakdown.accommodationRwf };
}

/** Eight bookings, one per state the desk can show. Priced by `priced()`. */
const BOOKINGS = [
  // The two the approve and decline commands act on.
  { id: BK(1), ref: 'BK-DEMO-001', roomType: RT(2), guest: U(11), status: 'pending_approval', in: 2,  nights: 3 },
  { id: BK(2), ref: 'BK-DEMO-002', roomType: RT(2), guest: U(12), status: 'pending_approval', in: 0,  nights: 2 },
  // Confirmed, nobody has arrived. The second arrives today, which is what turns
  // "Reserved" into a check in button.
  { id: BK(3), ref: 'BK-DEMO-003', roomType: RT(1), guest: U(13), status: 'confirmed', in: 7,  nights: 2 },
  { id: BK(4), ref: 'BK-DEMO-004', roomType: RT(1), guest: U(14), status: 'confirmed', in: 0,  nights: 3 },
  // In house right now, and checked out last week. Both carry a guest stay.
  { id: BK(5), ref: 'BK-DEMO-005', roomType: RT(1), guest: U(6),  status: 'confirmed', in: -1, nights: 3 },
  { id: BK(6), ref: 'BK-DEMO-006', roomType: RT(2), guest: U(11), status: 'confirmed', in: -5, nights: 3 },
  // Declined: the screen hides it, and proving that it hides it is the point.
  { id: BK(7), ref: 'BK-DEMO-007', roomType: RT(1), guest: U(12), status: 'declined',  in: 4,  nights: 2 },
  // Cancelled: kept visible, because somebody has to see a confirmed booking go.
  { id: BK(8), ref: 'BK-DEMO-008', roomType: RT(2), guest: U(13), status: 'cancelled', in: 10, nights: 2 },
].map(priced);

/**
 * One conversation per booking, because that is the invariant (ADR-032).
 *
 * *"A booking has exactly one thread"*, written in the same transaction as the
 * booking by `BookingRepository.create`. This seed inserts bookings directly, so
 * it was quietly breaking that: a demo persona holding four bookings opened
 * `/inbox` to "No messages yet", which is the one thing the guest inbox must
 * never say to somebody who has a conversation waiting.
 *
 * `thread_kind` stays at its `reservation` default and `department_id` stays
 * null, for the reason the ADR gives: a reservation thread is with the PROPERTY,
 * and routing to a department is the property's later move (D14), not something
 * to decide before anybody has asked anything.
 *
 * A terminal booking gets an ARCHIVED thread, which is the state transition the
 * schema already describes: read only, permanently, with no path back.
 */
const THREADS = BOOKINGS.map((b, i) => ({
  id: TH(i + 1),
  bookingId: b.id,
  status: b.status === 'declined' || b.status === 'cancelled' ? 'archived' : 'active',
}));

/**
 * Enough conversation to be worth opening, on three of the eight.
 *
 * Not on all of them, deliberately: an inbox where every row is bold is an inbox
 * nobody scans, and a thread with no messages is a real state the screen has to
 * render (it says "No messages yet" on the row and nothing in the body).
 *
 * The desk's replies come from real staff on this hotel's org — Denise on
 * reception, Solange managing — so `fromUs` resolves correctly on both surfaces
 * and the sender's NAME on a bubble is somebody who actually holds that seat.
 *
 * The last message on BK(1) is the DESK's, so that thread opens unread for its
 * guest — which is what makes the unread badge visible in a demo rather than a
 * thing you have to take on trust.
 */
const MESSAGES = [
  // Rayan's pending request: he asks, the desk answers, and the desk spoke last.
  { id: MS(1), thread: TH(1), from: U(11), minutesAgo: 180, body: 'Hello — is an early check-in possible? My flight lands at 07:00.' },
  { id: MS(2), thread: TH(1), from: U(3), minutesAgo: 150, body: 'Welcome! We can hold the room from 09:00 and keep your bags at the desk before that.' },
  { id: MS(3), thread: TH(1), from: U(3), minutesAgo: 140, body: 'Your request is with our team now — we will confirm within the day.' },
  // Samuel is in house: one exchange about the room itself.
  { id: MS(4), thread: TH(5), from: U(6), minutesAgo: 90, body: 'Could we have one more towel in room 101 please?' },
  { id: MS(5), thread: TH(5), from: U(3), minutesAgo: 80, body: 'On its way up now.' },
  // A closed conversation on an archived thread, so the read-only state is real.
  { id: MS(6), thread: TH(8), from: U(13), minutesAgo: 2880, body: 'I need to cancel this booking, I am sorry.' },
  { id: MS(7), thread: TH(8), from: U(2), minutesAgo: 2860, body: 'Cancelled and refunded in full. You are welcome back any time.' },
  // Grace's request still waits on the desk, so her question is the last line
  // and the thread reads as one the desk owes an answer to.
  { id: MS(8), thread: TH(2), from: U(12), minutesAgo: 45, body: 'Hi, is there parking at the hotel? I will be driving from Huye.' },
  // Arriving today: the guest gives a time, which is what the desk plans around.
  { id: MS(9), thread: TH(4), from: U(14), minutesAgo: 30, body: 'Good morning, I should reach you around 14:00 today.' },
  // The residence half (demo-comms, 2026-09-14). Without these the Landlord
  // inbox opened to "No conversations yet", because nothing else ever makes a
  // lease thread. Josephine (U5) owns Green Hills and answers her own tenants.
  { id: MS(10), thread: TH(9),  from: U(11), minutesAgo: 1500, body: 'Hello Josephine, the kitchen tap in C1 is dripping again.' },
  { id: MS(11), thread: TH(9),  from: U(5),  minutesAgo: 1440, body: 'Thanks Rayan, the caretaker will come tomorrow morning.' },
  { id: MS(12), thread: TH(9),  from: U(11), minutesAgo: 60,   body: 'Fixed, thank you. Rent for this month is paid.' },
  { id: MS(13), thread: TH(10), from: U(12), minutesAgo: 240,  body: 'Could I pay this month in two parts, on the 5th and the 20th?' },
];

/**
 * One thread per tenancy that has an account behind it (demo-comms,
 * 2026-09-14). A lease whose tenant has no account has nobody to write to, so
 * only RR(30) and RR(31) get one. After the leases, because each hangs off one.
 */
const LEASE_THREADS = [
  { id: TH(9),  leaseId: RR(30) },
  { id: TH(10), leaseId: RR(31) },
];

/**
 * Support tickets a moderator can open (demo-comms, 2026-09-14). The contact
 * form is the only other thing that writes one, so a fresh demo opened the
 * moderation desk to an empty list. Marked as demo in the message itself, like
 * the catalogue seed marks its rows. Family `..19NN`, clear of 17 and 18, which
 * ADR-038 reserves.
 */
const ST = (n) => `de300000-0000-4000-8000-0000000019${String(n).padStart(2, '0')}`; // support tickets
const SUPPORT_TICKETS = [
  { id: ST(1), requester: U(12), category: 'booking', minutesAgo: 95, email: 'grace@demo.injishi.com', name: 'Grace Kwizera', phone: null,
    message: 'My request to book at Amahoro has been pending since yesterday. Will I be charged if the hotel declines? (demo sample)' },
  { id: ST(2), requester: null, category: 'listing', minutesAgo: 400, email: 'claude.hakizimana@example.com', name: 'Claude Hakizimana', phone: '+250 788 000 111',
    message: 'I run a guesthouse in Rubavu and want to list it. Which documents do I need for registration? (demo sample)' },
  { id: ST(3), requester: U(11), category: 'payment', minutesAgo: 2000, email: 'rayan@demo.injishi.com', name: 'Rayan Iraguha', phone: null,
    message: 'I paid for BK-DEMO-006 with MoMo twice by mistake. Please refund the second payment. (demo sample)', resolved: true },
];

const STAYS = [
  { id: GS(1), bookingId: BK(5), roomId: RM(1), guest: U(6),  lifecycle: 'open',   entryHours: -20,  exitHours: 48 },
  { id: GS(2), bookingId: BK(6), roomId: RM(3), guest: U(11), lifecycle: 'closed', entryHours: -120, exitHours: -48 },
];

/**
 * Amahoro's branches trade too (ADR-054 AC-D1): each active branch has a guest
 * arriving today and one in house, and the archived Kicukiro branch keeps one
 * past stay, so a branch limited receptionist has a real desk to look at.
 *
 * A separate list rather than more rows in `BOOKINGS`, because that list mints
 * its threads and escrows from its index, and `TH(9)` and `TH(10)` already
 * belong to the lease conversations. These start at 21 in both families.
 */
const BRANCH_BOOKINGS = [
  { id: BK(9),  ref: 'BK-DEMO-009', roomType: RT(5), guest: U(5),  status: 'confirmed', in: 0,   nights: 2, thread: TH(21), escrow: ES(21) },
  { id: BK(10), ref: 'BK-DEMO-010', roomType: RT(5), guest: U(12), status: 'confirmed', in: -1,  nights: 3, thread: TH(22), escrow: ES(22) },
  { id: BK(11), ref: 'BK-DEMO-011', roomType: RT(6), guest: U(11), status: 'confirmed', in: 0,   nights: 2, thread: TH(23), escrow: ES(23) },
  { id: BK(12), ref: 'BK-DEMO-012', roomType: RT(6), guest: U(13), status: 'confirmed', in: -2,  nights: 4, thread: TH(24), escrow: ES(24) },
  { id: BK(13), ref: 'BK-DEMO-013', roomType: RT(7), guest: U(11), status: 'confirmed', in: -40, nights: 2, thread: TH(25), escrow: ES(25) },
].map(priced);

const BRANCH_THREADS = BRANCH_BOOKINGS.map((b) => ({ id: b.thread, bookingId: b.id, status: 'active' }));

const BRANCH_STAYS = [
  { id: GS(3), bookingId: BK(10), roomId: RM(9),  guest: U(12), lifecycle: 'open',   entryHours: -20,  exitHours: 50 },
  { id: GS(4), bookingId: BK(12), roomId: RM(11), guest: U(13), lifecycle: 'open',   entryHours: -44,  exitHours: 52 },
  { id: GS(5), bookingId: BK(13), roomId: RM(13), guest: U(11), lifecycle: 'closed', entryHours: -960, exitHours: -912 },
];

/** Money already taken. A refused or cancelled request is refunded in full. */
const ESCROWS = [
  ...BOOKINGS.map((b, i) => ({
    id: ES(i + 1), bookingId: b.id, amountRwf: b.gross, legacyAmountRwf: b.legacyGross,
    status: b.status === 'declined' || b.status === 'cancelled' ? 'refunded_full' : 'held',
  })),
  // The past Kicukiro stay's money was released long ago; the rest is held.
  ...BRANCH_BOOKINGS.map((b) => ({
    id: b.escrow, bookingId: b.id, amountRwf: b.gross, legacyAmountRwf: b.legacyGross,
    status: b.in + b.nights < 0 ? 'released' : 'held',
  })),
];

/**
 * The pending registration's one fee, paid (ADR-054 AC-D2, invariant 7). One
 * invoice whatever the branch count. Family `..20NN`, clear of 17 to 19.
 */
const IV = (n) => `de300000-0000-4000-8000-0000000020${String(n).padStart(2, '0')}`; // invoices
const PENDING_INVOICES = [
  { id: IV(1), orgId: O(3), amountRwf: 100000 },
];

// --- Preconditions -----------------------------------------------------------

async function checkPreconditions(c) {
  const { rows: d } = await c.query('SELECT count(*)::int AS n FROM districts');
  if (d[0].n === 0) {
    throw new Error(
      'No districts found. Run scripts/seed-geography.mjs against this database first (seed-sample.mjs runs it).',
    );
  }
  const { rows: r } = await c.query(
    "SELECT count(*)::int AS n FROM rdb_classifications WHERE kind <> 'entity_group'",
  );
  if (r[0].n === 0) {
    throw new Error(
      'No rdb_classifications found. Run scripts/seed-content.mjs against this database first (seed-sample.mjs runs it).',
    );
  }
  // The operational half writes tables that arrive in later migrations. Say so
  // plainly rather than failing three inserts later on a raw SQL error.
  const NEEDED = [
    'properties', 'listings', 'room_types', 'rate_plans',
    'rooms', 'bookings', 'guest_stays', 'escrows',
    // The guest inbox's tables. `thread_reads` arrived in migration 0023 and was
    // queried by nothing until the guest messaging routes landed (ADR-032).
    'threads', 'messages', 'thread_reads',
  ];
  const { rows: t } = await c.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
    [NEEDED],
  );
  const missing = NEEDED.filter((n) => !t.some((row) => row.table_name === n));
  if (missing.length > 0) {
    throw new Error(
      `This database is behind the schema. Missing: ${missing.join(', ')}.\n` +
        'Run `pnpm --filter @injishi/api drizzle:migrate` against it first.',
    );
  }
}

async function districtId(c, name) {
  const { rows } = await c.query(
    'SELECT id FROM districts WHERE lower(name) = lower($1) LIMIT 1',
    [name],
  );
  if (rows.length === 0) throw new Error(`District not found: ${name}`);
  return rows[0].id;
}

/**
 * A sector inside a named district.
 *
 * Scoped to the district on purpose: sector names repeat across Rwanda, so
 * looking one up by name alone can land a Kigali hotel in another province.
 * Throws rather than falling back to "the first sector we found", because a
 * quiet fallback is how a wrong address becomes permanent fixture data.
 */
async function sectorId(c, district, sector) {
  const { rows } = await c.query(
    `SELECT s.id FROM sectors s
       JOIN districts d ON d.id = s.district_id
      WHERE lower(s.name) = lower($1) AND lower(d.name) = lower($2) LIMIT 1`,
    [sector, district],
  );
  if (rows.length === 0) {
    throw new Error(`Sector not found: ${sector} in ${district}`);
  }
  return rows[0].id;
}

// --- Seeding -----------------------------------------------------------------

async function seedBodies(c) {
  for (const [code, en, rw, abbr] of BODIES) {
    await c.query(
      `INSERT INTO government_bodies (code, name_en, name_rw, abbreviation, active)
       VALUES ($1, $2, $3, $4, true) ON CONFLICT (code) DO NOTHING`,
      [code, en, rw, abbr],
    );
  }
}

async function seedPerson(c, p) {
  await c.query(
    `INSERT INTO users (id, email, email_verified, name)
     VALUES ($1, $2, true, $3) ON CONFLICT (id) DO NOTHING`,
    [p.id, p.email, p.name],
  );
  await c.query(
    `INSERT INTO user_profiles (user_id, display_name, national_id)
     VALUES ($1, $2, $3) ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name`,
    [p.id, p.name, p.nid],
  );
  await c.query(
    `INSERT INTO verified_identities (user_id, kyc_status, legal_full_name, verified_method, verified_at)
     VALUES ($1, $2, $3, $4, $5) ON CONFLICT (user_id) DO UPDATE SET kyc_status = EXCLUDED.kyc_status`,
    [p.id, p.kyc, p.name, p.nid ? 'manual' : null, p.nid ? new Date() : null],
  );
  if (p.nid) {
    await c.query(
      `INSERT INTO identity_documents
         (identity_id, document_type, document_number, issuing_country, status, is_primary, verified_at)
       VALUES ($1, 'national_id', $2, 'RW', 'active', true, now())
       ON CONFLICT (document_type, document_number, issuing_country) DO NOTHING`,
      [p.id, p.nid],
    );
  }
  // Everyone is a Guest (F-S01); supply, broker and oversight add roles on top.
  for (const role of ['guest', ...(p.roles ?? [])]) {
    const { rows } = await c.query(
      `SELECT 1 FROM user_roles WHERE user_id = $1 AND global_role = $2 AND revoked_at IS NULL LIMIT 1`,
      [p.id, role],
    );
    if (rows.length === 0) {
      await c.query(
        'INSERT INTO user_roles (user_id, global_role) VALUES ($1, $2)',
        [p.id, role],
      );
    }
  }
  // Staff access is its own row, the one `GET /api/v1/me/staff` and
  // `StaffGuard` read. Re-running restores the seeded roles, as seed-users does.
  if (p.staffRoles) {
    await c.query(
      `INSERT INTO admin_users (user_id, staff_roles, two_factor_enrolled)
       VALUES ($1, $2, false)
       ON CONFLICT (user_id)
       DO UPDATE SET staff_roles = EXCLUDED.staff_roles, revoked_at = NULL`,
      [p.id, p.staffRoles],
    );
  }
}

async function seedOrg(c, o) {
  await c.query(
    `INSERT INTO orgs (id, legal_name, domain, rdb_entity_group, accommodation_class,
                       residence_class, tin, upi, registration_status, district_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (id) DO NOTHING`,
    [
      o.id, o.legalName, o.domain, o.entityGroup,
      o.accommodationClass ?? null, o.residenceClass ?? null,
      o.tin ?? null, o.upi ?? null,
      o.registrationStatus, await districtId(c, o.district),
    ],
  );
}

async function seedWorkspace(c, w) {
  await c.query(
    `INSERT INTO workspaces (id, kind, org_id, user_id)
     VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
    [w.id, w.kind, w.orgId ?? null, w.userId ?? null],
  );
}

async function seedMembership(c, m) {
  const { rows } = await c.query(
    `SELECT 1 FROM org_memberships WHERE org_id = $1 AND user_id = $2 AND status = 'active' LIMIT 1`,
    [m.orgId, m.userId],
  );
  if (rows.length > 0) return;
  await c.query(
    `INSERT INTO org_memberships (org_id, user_id, org_role) VALUES ($1, $2, $3)`,
    [m.orgId, m.userId, m.role],
  );
}

// Replaces the member's limit with exactly the listed branches, so a rerun
// changes nothing and an edit to the list converges rather than accumulating.
async function seedMembershipBranches(c, mb) {
  const { rows } = await c.query(
    `SELECT id FROM org_memberships WHERE org_id = $1 AND user_id = $2 AND status = 'active' LIMIT 1`,
    [mb.orgId, mb.userId],
  );
  const membershipId = rows[0]?.id;
  if (!membershipId) throw new Error(`No active membership for ${mb.userId} to limit.`);
  await c.query(
    `DELETE FROM org_membership_branches
      WHERE org_membership_id = $1 AND NOT (property_id = ANY($2::uuid[]))`,
    [membershipId, mb.propertyIds],
  );
  for (const propertyId of mb.propertyIds) {
    await c.query(
      `INSERT INTO org_membership_branches (org_membership_id, property_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [membershipId, propertyId],
    );
  }
}

/**
 * One deliberate departure from a role's default set.
 *
 * ON CONFLICT on the natural key rather than on the id, because the unique
 * constraint an owner would trip by editing the same role in the app is
 * (org, role, permission) — so a reseed after a presenter has clicked around
 * puts the demo answer back rather than failing on a row it did not write.
 */
async function seedRolePermission(c, r) {
  await c.query(
    `INSERT INTO org_role_permissions
       (id, org_id, org_role, permission, granted, set_by_user_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (org_id, org_role, permission)
     DO UPDATE SET granted = EXCLUDED.granted, updated_at = now()`,
    [r.id, r.orgId, r.role, r.permission, r.granted, r.setBy],
  );
}

async function seedAssignment(c, a) {
  await c.query(
    `INSERT INTO oversight_assignments
       (id, user_id, oversight_role, government_body_code, government_title,
        scope_level, district_id, revoked_at)
     VALUES ($1, $2, $3, $4, $5, 'district', $6, $7) ON CONFLICT (id) DO NOTHING`,
    [
      a.id, a.userId, a.role, a.body, a.title,
      await districtId(c, a.district),
      a.revoked ? new Date() : null,
    ],
  );
}

// --- Seeding the operational half --------------------------------------------

async function seedProperty(c, pr) {
  // Synthetic dev-only coordinates (see synthetic-coords.mjs). The demo
  // roster's businesses are fictional, so no real address is being leaked; the
  // Explore map needs a point to plot per property.
  const [demoLatitude, demoLongitude] = syntheticCoordFor({ district: pr.district, seed: pr.slug });
  await c.query(
    `INSERT INTO properties
       (id, org_id, workspace_id, name, description, sector_id, district_id,
        latitude, longitude,
        address_text, check_in_time, check_out_time, house_rules, slug,
        is_head_office, rra_branch_id, archived_at, archived_by_user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
     ON CONFLICT (id) DO UPDATE
       SET slug = coalesce(properties.slug, excluded.slug),
           rra_branch_id = coalesce(properties.rra_branch_id, excluded.rra_branch_id),
           latitude = coalesce(properties.latitude, excluded.latitude),
           longitude = coalesce(properties.longitude, excluded.longitude)`,
    [
      pr.id, pr.orgId, pr.workspaceId, pr.name, pr.description,
      await sectorId(c, pr.district, pr.sector),
      await districtId(c, pr.district),
      demoLatitude, demoLongitude,
      pr.street, pr.checkIn, pr.checkOut, pr.houseRules, pr.slug,
      // ADR-054. A branch is a property: the head office flag, the RRA branch
      // id a receipt declares under, and when it was archived and by whom (the
      // owner, Yves, for Amahoro's Kicukiro).
      pr.isHeadOffice ?? false,
      pr.rraBranchId ?? null,
      pr.archived ? hoursFromNow(-24 * 20) : null,
      pr.archived ? U(1) : null,
      // No photo column: ADR-053 moved photographs into `property_photos`, so a
      // seeded property has NO photograph and therefore cannot be published
      // until one is attached through the operator app.
    ],
  );
}

/** A registration fee already settled (ADR-054 AC-D2). */
async function seedPaidRegistrationFee(c, iv) {
  await c.query(
    `INSERT INTO subscription_invoices (id, org_id, invoice_kind, amount_rwf, status, idempotency_key)
     VALUES ($1, $2, 'registration_fee', $3, 'paid', $4)
     ON CONFLICT (id) DO NOTHING`,
    [iv.id, iv.orgId, iv.amountRwf, `registration_fee:${iv.orgId}`],
  );
}

async function seedListing(c, l) {
  await c.query(
    `INSERT INTO listings (id, property_id, workspace_id, status, published_at)
     VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
    [l.id, l.propertyId, l.workspaceId, l.status, l.status === 'published' ? new Date() : null],
  );
}

async function seedRoomType(c, rt) {
  await c.query(
    `INSERT INTO room_types
       (id, property_id, workspace_id, name, domain, max_guests, capacity,
        room_count, base_price_rwf, booking_mode, approval_policy, cancellation_tier)
     VALUES ($1, $2, $3, $4, 'hospitality', $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (id) DO NOTHING`,
    [
      rt.id, rt.propertyId, rt.workspaceId, rt.name, rt.maxGuests, rt.capacity,
      rt.roomCount, rt.priceRwf, rt.bookingMode, rt.approvalPolicy, rt.cancellationTier,
    ],
  );
}

async function seedRatePlan(c, rp) {
  await c.query(
    `INSERT INTO rate_plans
       (id, room_type_id, workspace_id, name, is_default, base_price_rwf,
        base_occupancy, booking_mode, approval_policy, cancellation_tier)
     VALUES ($1, $2, $3, $4, true, $5, $6, $7, $8, $9)
     ON CONFLICT (id) DO NOTHING`,
    [
      rp.id, rp.roomTypeId, rp.workspaceId, rp.name, rp.priceRwf,
      rp.baseOccupancy, rp.bookingMode, rp.approvalPolicy, rp.cancellationTier,
    ],
  );
}

function roomTypeOf(rm) {
  const rt = ROOM_TYPES.find((t) => t.id === rm.roomTypeId);
  if (!rt) throw new Error(`room ${rm.id} names an unknown room type`);
  return rt;
}

/**
 * A clock time in Kigali (UTC+2, no daylight saving) on a day relative to
 * today: `'08:40'` is this morning, `'-1 15:30'` yesterday afternoon.
 *
 * Operational moments are pinned to the clock rather than to "hours before the
 * seed ran", because the demo is reseeded at 03:00 and read in the afternoon:
 * a room cleaned "two hours before the seed" would read as cleaned at 01:00.
 */
function kigaliAt(spec) {
  const [offset, time] = spec.includes(' ') ? spec.split(' ') : ['0', spec];
  return new Date(`${day(Number(offset))}T${time}:00+02:00`);
}

async function seedRoom(c, rm) {
  await c.query(
    `INSERT INTO rooms
       (id, room_type_id, property_id, workspace_id, label, status, housekeeping_status,
        housekeeping_updated_at, housekeeping_updated_by_user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO NOTHING`,
    // The room's property and workspace are its room type's, never assumed.
    [
      rm.id, rm.roomTypeId, roomTypeOf(rm).propertyId, roomTypeOf(rm).workspaceId, rm.label,
      rm.status ?? 'available', rm.housekeeping,
      rm.hkAt ? kigaliAt(rm.hkAt) : null, rm.hkBy ?? null,
    ],
  );
}

/**
 * One booking, priced and dated from its offsets.
 *
 * `booking_mode` is copied from the room type rather than chosen here, so a
 * `pending_approval` row can never sit on an instant book product, which is a
 * state the approve command has no answer for.
 *
 * A re run changes one thing on an existing row: a `gross_rwf` still holding
 * the flat `rate × nights` an older seed wrote (`$19`) becomes the priced total,
 * so a sample database seeded before the fix is repaired by running it again
 * and its receipts stop answering 500. The guard compares against that exact
 * legacy figure, so a total anything else wrote is never overwritten.
 */
async function seedBooking(c, b) {
  const roomType = ROOM_TYPES.find((rt) => rt.id === b.roomType);
  const resolved = b.status === 'declined' || b.status === 'cancelled';
  await c.query(
    `INSERT INTO bookings
       (id, reference, room_type_id, rate_plan_id, guest_user_id, workspace_id,
        check_in, check_out, guest_count, status, booking_mode,
        locked_nightly_rate_rwf, locked_cancellation_tier, gross_rwf,
        payment_status, decline_reason, approval_expires_at, confirmed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
     ON CONFLICT (id) DO UPDATE SET gross_rwf = EXCLUDED.gross_rwf
       WHERE bookings.gross_rwf = $19 AND bookings.gross_rwf <> EXCLUDED.gross_rwf`,
    [
      b.id, b.ref, b.roomType,
      RATE_PLANS.find((rp) => rp.roomTypeId === b.roomType).id,
      b.guest, W(1),
      day(b.in), day(b.in + b.nights), 2,
      b.status, roomType.bookingMode,
      roomType.priceRwf, roomType.cancellationTier, b.gross,
      resolved ? 'refunded_full' : 'captured',
      b.status === 'declined' ? 'host_declined' : null,
      // A pending request has a window it dies in. The auto decline sweep reads
      // exactly this column, so a demo request left alone really does expire.
      b.status === 'pending_approval' ? hoursFromNow(24) : null,
      b.status === 'confirmed' ? hoursFromNow(-1) : null,
      b.legacyGross,
    ],
  );
}

async function seedStay(c, st) {
  await c.query(
    `INSERT INTO guest_stays
       (id, booking_id, guest_user_id, room_id, workspace_id, check_in_mode,
        is_verified, entry_at, planned_exit_at, actual_exit_at, lifecycle)
     VALUES ($1, $2, $3, $4, $5, 'staffed', true, $6, $7, $8, $9)
     ON CONFLICT (id) DO NOTHING`,
    [
      st.id, st.bookingId, st.guest, st.roomId, W(1),
      hoursFromNow(st.entryHours),
      hoursFromNow(st.exitHours),
      st.lifecycle === 'closed' ? hoursFromNow(st.exitHours) : null,
      st.lifecycle,
    ],
  );
}

/**
 * The conversation a booking comes with (ADR-032).
 *
 * `updated_at` is set to the newest message in the thread, because that is the
 * column the inbox sorts on — leaving it at `now()` would order the list by when
 * the seed ran rather than by when anybody last spoke.
 */
async function seedThread(c, t) {
  const newest = MESSAGES.filter((m) => m.thread === t.id).reduce(
    (min, m) => Math.min(min, m.minutesAgo),
    Number.POSITIVE_INFINITY,
  );
  const touched = Number.isFinite(newest) ? hoursFromNow(-newest / 60) : new Date();

  await c.query(
    `INSERT INTO threads (id, workspace_id, booking_id, thread_kind, status, updated_at)
     VALUES ($1, $2, $3, 'reservation', $4, $5)
     ON CONFLICT (id) DO NOTHING`,
    [t.id, W(1), t.bookingId, t.status, touched],
  );
}

/** A tenancy's conversation, sorted by its newest line like a booking's. */
async function seedLeaseThread(c, t) {
  const newest = MESSAGES.filter((m) => m.thread === t.id).reduce(
    (min, m) => Math.min(min, m.minutesAgo),
    Number.POSITIVE_INFINITY,
  );
  const touched = Number.isFinite(newest) ? hoursFromNow(-newest / 60) : new Date();

  await c.query(
    `INSERT INTO threads (id, workspace_id, lease_id, thread_kind, status, updated_at)
     VALUES ($1, $2, $3, 'reservation', 'active', $4)
     ON CONFLICT (id) DO NOTHING`,
    [t.id, W(2), t.leaseId, touched],
  );
}

async function seedSupportTicket(c, t) {
  const at = hoursFromNow(-t.minutesAgo / 60);
  await c.query(
    `INSERT INTO support_tickets
       (id, requester_user_id, category, state, message, contact_email,
        contact_name, contact_phone, first_response_at, resolved_at,
        created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
     ON CONFLICT (id) DO NOTHING`,
    [
      t.id, t.requester, t.category, t.resolved ? 'resolved' : 'open',
      t.message, t.email, t.name, t.phone,
      t.resolved ? hoursFromNow(-(t.minutesAgo - 30) / 60) : null,
      t.resolved ? hoursFromNow(-(t.minutesAgo - 90) / 60) : null,
      at,
    ],
  );
}

async function seedMessage(c, m) {
  await c.query(
    `INSERT INTO messages (id, thread_id, sender_user_id, body_type, body, created_at)
     VALUES ($1, $2, $3, 'text', $4, $5) ON CONFLICT (id) DO NOTHING`,
    [m.id, m.thread, m.from, m.body, hoursFromNow(-m.minutesAgo / 60)],
  );
}

/**
 * The money a seeded booking already holds, as the mock adapter would have
 * recorded capturing it.
 *
 * `adapter_ref` is what every later money move names as the original: a host's
 * decline releases it, a cancellation refunds it. Seeded without one, both
 * `BK-DEMO-001` and `002` could never be declined through either door, which
 * answered 503 because there was no capture to release (ADR-053 J27). The value
 * is the one `MockPaymentAdapter` mints for a capture, `mock_escrow_capture_`
 * plus the idempotency key, so the adapter reads it as its own.
 *
 * A re run fills a reference an older seed left null, and moves an amount still
 * holding the flat `rate × nights` an older seed wrote (`$8`) to the priced
 * total its booking now carries, and changes nothing else. So a sample database
 * seeded before either fix is repaired by running it again.
 */
async function seedEscrow(c, e) {
  const idempotencyKey = `seed-demo:${e.id}`;
  await c.query(
    `INSERT INTO escrows
       (id, workspace_id, source, booking_id, amount_rwf, status, adapter_ref, adapter_mode, idempotency_key)
     VALUES ($1, $2, 'booking', $3, $4, $5, $6, 'mock', $7)
     ON CONFLICT (id) DO UPDATE SET
       adapter_ref = COALESCE(escrows.adapter_ref, EXCLUDED.adapter_ref),
       amount_rwf = CASE WHEN escrows.amount_rwf = $8 THEN EXCLUDED.amount_rwf ELSE escrows.amount_rwf END
       WHERE escrows.adapter_ref IS NULL
          OR (escrows.amount_rwf = $8 AND escrows.amount_rwf <> EXCLUDED.amount_rwf)`,
    // The key is derived from the row id rather than random, so re running
    // cannot trip the unique index with a second key for the same escrow.
    [e.id, W(1), e.bookingId, e.amountRwf, e.status, `mock_escrow_capture_${idempotencyKey}`, idempotencyKey, e.legacyAmountRwf],
  );
}

/**
 * Put back a seeded request the auto decline sweep let expire.
 *
 * `BK-DEMO-001` and `002` are the approve and decline beats, and they carry a
 * real 24 hour window, so any worker running a day after the seed declines them
 * as `expired` and refunds the escrow. Every insert above is ON CONFLICT, so a
 * re run used to leave them declined, and the only way back was `--reset`,
 * which deletes the demo roster and everything anybody booked as a persona.
 *
 * So a re run (and `--refresh`) revives exactly that case: a seeded
 * `pending_approval` booking now `declined` with reason `expired`, with nothing
 * attached to it. It goes back to pending, captured, escrow held, a fresh
 * window, and dates re-anchored to today by the seed's own offsets. A request a
 * HOST declined, or one anything hangs off, is left as it is.
 */
async function reviveExpiredRequests(c) {
  const requests = BOOKINGS.filter((b) => b.status === 'pending_approval');
  let revived = 0;
  await c.query('BEGIN');
  try {
    for (const b of requests) {
      const { rowCount } = await c.query(
        `UPDATE bookings SET
           status = 'pending_approval', payment_status = 'captured',
           decline_reason = NULL, approval_expires_at = $2,
           sweep_claimed_until = NULL, ebm_sign_at = NULL,
           check_in = $3, check_out = $4, updated_at = now()
         WHERE id = $1 AND status = 'declined' AND decline_reason = 'expired'
           AND NOT EXISTS (SELECT 1 FROM guest_stays WHERE booking_id = $1)
           AND NOT EXISTS (SELECT 1 FROM room_assignments WHERE booking_id = $1)
           AND NOT EXISTS (SELECT 1 FROM service_orders WHERE booking_id = $1)
           AND NOT EXISTS (SELECT 1 FROM folios WHERE booking_id = $1)
           AND NOT EXISTS (SELECT 1 FROM ebm_invoices WHERE booking_id = $1)
           AND NOT EXISTS (SELECT 1 FROM payment_attempts WHERE booking_id = $1)
           AND NOT EXISTS (SELECT 1 FROM payment_compensations WHERE booking_id = $1)`,
        [b.id, hoursFromNow(24), day(b.in), day(b.in + b.nights)],
      );
      if (rowCount === 0) continue;
      await c.query(
        `UPDATE escrows SET status = 'held', updated_at = now()
          WHERE booking_id = $1 AND source = 'booking' AND status = 'refunded_full'`,
        [b.id],
      );
      revived += 1;
      console.log(`revived ${b.ref}: pending again, window open for 24 hours`);
    }
    await c.query('COMMIT');
  } catch (err) {
    await c.query('ROLLBACK');
    throw err;
  }
  return revived;
}

/** Delete only what this script owns, by deterministic id. Never truncates. */
async function reset(c) {
  const users = PEOPLE.map((p) => p.id);
  // The hotel's day (`seed-demo-hotel.mjs`) hangs off the bookings, stays and
  // rooms deleted below, so it goes first. Its purge deletes only its own rows
  // and whatever a demo session wrote on top of them, and is a no-op when they
  // are already gone. Imported rather than duplicated, so the order of those
  // deletes has one owner.
  //
  // The portfolio (`seed-demo-portfolio.mjs`: caution holds, reviews, the
  // pipeline) hangs off the leases and workspaces deleted below in the same
  // way, so its own `--purge` runs before either. Run as a child process with
  // this process's environment, so it purges the same database; skipped when
  // the script is not on disk.
  const portfolio = path.join(path.dirname(fileURLToPath(import.meta.url)), 'seed-demo-portfolio.mjs');
  if (fs.existsSync(portfolio)) {
    const run = spawnSync(process.execPath, [portfolio, '--purge'], {
      cwd: process.cwd(), env: process.env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (run.status !== 0) {
      throw new Error(`seed-demo-portfolio.mjs --purge failed (exit ${run.status}):\n${run.stdout}${run.stderr}`);
    }
    console.log(run.stdout.trim());
  }
  const { purgeHotel } = await import('./seed-demo-hotel.mjs');
  await purgeHotel(c);
  // Both buildings' tenancies and everything hanging off them, before the
  // roster and orgs they point at.
  await resetLandlordRows(c);
  // Conversations before anything they hang off: a lease thread points at a
  // lease deleted just below, and a booking thread at a booking. Messages
  // before threads. Support tickets point at the roster.
  const threadIds = [...THREADS, ...LEASE_THREADS, ...BRANCH_THREADS].map((t) => t.id);
  await c.query('DELETE FROM support_tickets WHERE id = ANY($1::uuid[])', [SUPPORT_TICKETS.map((t) => t.id)]);
  await c.query('DELETE FROM messages WHERE id = ANY($1::uuid[])', [MESSAGES.map((m) => m.id)]);
  await c.query('DELETE FROM thread_reads WHERE thread_id = ANY($1::uuid[])', [threadIds]);
  await c.query('DELETE FROM threads WHERE id = ANY($1::uuid[])', [threadIds]);
  // Operational rows FIRST. `bookings` and `guest_stays` reference `workspaces`
  // with no cascade, so deleting the roster before them fails on a foreign key.
  // The residence rent roll first of all, and this was MISSING until task 15
  // went looking. `--reset` deletes the orgs and workspaces these rows point
  // at, so without this a reset either fails on a foreign key or leaves a lease
  // hanging off a workspace that no longer exists. Child-to-parent order:
  // charges, then leases, then the rooms and the type and the property.
  await c.query('DELETE FROM rent_charges WHERE lease_id = ANY($1::uuid[])', [RESIDENCE_LEASES.map((l) => l.id)]);
  await c.query('DELETE FROM leases WHERE id = ANY($1::uuid[])', [RESIDENCE_LEASES.map((l) => l.id)]);
  await c.query('DELETE FROM rooms WHERE id = ANY($1::uuid[])', [RESIDENCE_UNITS.map((u) => u.id)]);
  await c.query('DELETE FROM room_types WHERE id = $1', [RESIDENCE_ROOM_TYPE.id]);
  await c.query('DELETE FROM listings WHERE id = $1', [RESIDENCE_PROPERTY.listingId]);
  await c.query('DELETE FROM properties WHERE id = $1', [RESIDENCE_PROPERTY.id]);

  // What a demo session built on the BK-DEMO bookings: a check in opens a stay
  // and a bill, an approval opens a pre-arrival bill, checkout queues a clean.
  // Their ids are random, so they are found through the booking; without this
  // a reset after anybody has demoed the desk fails on a foreign key.
  const bookingIds = [...BOOKINGS, ...BRANCH_BOOKINGS].map((b) => b.id);
  const touched = `SELECT id FROM guest_stays WHERE booking_id = ANY($1::uuid[])`;
  const bills = `SELECT id FROM folios WHERE booking_id = ANY($1::uuid[]) OR guest_stay_id IN (${touched})`;
  const orders = `SELECT id FROM service_orders WHERE folio_id IN (${bills}) OR guest_stay_id IN (${touched}) OR booking_id = ANY($1::uuid[])`;
  for (const sql of [
    `DELETE FROM outbox_events WHERE aggregate_id IN (${bills}) OR aggregate_id IN (${orders})`,
    `DELETE FROM service_order_events WHERE service_order_id IN (${orders})`,
    `DELETE FROM service_order_items WHERE service_order_id IN (${orders})`,
    `DELETE FROM service_orders WHERE id IN (${orders})`,
    `DELETE FROM ledger_entries WHERE related_type = 'folio_charge'
       AND related_id IN (SELECT id FROM folio_charges WHERE folio_id IN (${bills}))`,
    // Migration 0045 made these RESTRICT: invoice lines before invoices,
    // charges before bills, identities before stays. Refund requests and offer
    // redemptions (0044) name a bill with no cascade at all.
    `DELETE FROM ebm_invoice_lines WHERE ebm_invoice_id IN
       (SELECT id FROM ebm_invoices WHERE folio_id IN (${bills}) OR booking_id = ANY($1::uuid[]))`,
    `DELETE FROM ebm_invoices WHERE folio_id IN (${bills}) OR booking_id = ANY($1::uuid[])`,
    `DELETE FROM stay_refund_requests WHERE folio_id IN (${bills}) OR guest_stay_id IN (${touched}) OR booking_id = ANY($1::uuid[])`,
    `DELETE FROM offer_redemptions WHERE folio_id IN (${bills}) OR guest_stay_id IN (${touched})`,
    `DELETE FROM folio_charges WHERE folio_id IN (${bills})`,
    `DELETE FROM folios WHERE id IN (${bills})`,
    `DELETE FROM stay_identities WHERE guest_stay_id IN (${touched})`,
    `DELETE FROM housekeeping_tasks WHERE guest_stay_id IN (${touched})`,
    `DELETE FROM maintenance_tickets WHERE guest_stay_id IN (${touched})`,
    `DELETE FROM threads WHERE booking_id = ANY($1::uuid[]) OR guest_stay_id IN (${touched})`,
    `DELETE FROM payment_attempts WHERE booking_id = ANY($1::uuid[])`,
    `DELETE FROM escrows WHERE booking_id = ANY($1::uuid[])`,
    `DELETE FROM guest_stays WHERE booking_id = ANY($1::uuid[])`,
  ]) {
    await c.query(sql, [bookingIds]);
  }

  // A walk in checked in during a demo has no booking, so it is found through
  // the room; its bill through the property, which RESTRICTs the property's
  // delete below (0045).
  const propertyIds = PROPERTIES.map((p) => p.id);
  const walkIns = `SELECT id FROM guest_stays WHERE booking_id IS NULL AND room_id IN (SELECT id FROM rooms WHERE property_id = ANY($1::uuid[]))`;
  const propertyBills = `SELECT id FROM folios WHERE property_id = ANY($1::uuid[]) OR guest_stay_id IN (${walkIns})`;
  for (const sql of [
    `DELETE FROM outbox_events WHERE aggregate_id IN (${propertyBills})`,
    `DELETE FROM service_order_events WHERE service_order_id IN (SELECT id FROM service_orders WHERE folio_id IN (${propertyBills}))`,
    `DELETE FROM service_order_items WHERE service_order_id IN (SELECT id FROM service_orders WHERE folio_id IN (${propertyBills}))`,
    `DELETE FROM service_orders WHERE folio_id IN (${propertyBills})`,
    `DELETE FROM ledger_entries WHERE related_type = 'folio_charge'
       AND related_id IN (SELECT id FROM folio_charges WHERE folio_id IN (${propertyBills}))`,
    `DELETE FROM ebm_invoice_lines WHERE ebm_invoice_id IN (SELECT id FROM ebm_invoices WHERE folio_id IN (${propertyBills}))`,
    `DELETE FROM ebm_invoices WHERE folio_id IN (${propertyBills})`,
    `DELETE FROM stay_refund_requests WHERE folio_id IN (${propertyBills}) OR guest_stay_id IN (${walkIns})`,
    `DELETE FROM offer_redemptions WHERE folio_id IN (${propertyBills}) OR guest_stay_id IN (${walkIns})`,
    `DELETE FROM folio_charges WHERE folio_id IN (${propertyBills})`,
    `DELETE FROM folios WHERE id IN (${propertyBills})`,
    `DELETE FROM housekeeping_tasks WHERE guest_stay_id IN (${walkIns})`,
    `DELETE FROM threads WHERE guest_stay_id IN (${walkIns})`,
    `DELETE FROM stay_identities WHERE guest_stay_id IN (${walkIns})`,
    `DELETE FROM guest_stays WHERE id IN (${walkIns})`,
  ]) {
    await c.query(sql, [propertyIds]);
  }

  await c.query('DELETE FROM escrows WHERE id = ANY($1::uuid[])', [ESCROWS.map((e) => e.id)]);
  await c.query('DELETE FROM guest_stays WHERE id = ANY($1::uuid[])', [[...STAYS, ...BRANCH_STAYS].map((g) => g.id)]);
  await c.query('DELETE FROM bookings WHERE id = ANY($1::uuid[])', [[...BOOKINGS, ...BRANCH_BOOKINGS].map((b) => b.id)]);
  await c.query('DELETE FROM rooms WHERE id = ANY($1::uuid[])', [ROOMS.map((r) => r.id)]);
  await c.query('DELETE FROM rate_plans WHERE id = ANY($1::uuid[])', [RATE_PLANS.map((r) => r.id)]);
  await c.query('DELETE FROM room_types WHERE id = ANY($1::uuid[])', [ROOM_TYPES.map((r) => r.id)]);
  await c.query('DELETE FROM listings WHERE id = ANY($1::uuid[])', [LISTINGS.map((l) => l.id)]);
  await c.query('DELETE FROM properties WHERE id = ANY($1::uuid[])', [PROPERTIES.map((r) => r.id)]);
  await c.query('DELETE FROM oversight_assignments WHERE id = ANY($1::uuid[])', [ASSIGNMENTS.map((a) => a.id)]);
  await c.query('DELETE FROM subscription_invoices WHERE id = ANY($1::uuid[])', [PENDING_INVOICES.map((i) => i.id)]);
  // Samuel's three business seats go with the rest. Listed as one array per
  // table so a seat added above and forgotten here cannot leave a row that
  // `--reset` is unable to clear.
  const allOrgs = [...ORGS, ...SAMUEL_ORGS].map((o) => o.id);
  const allWorkspaces = [...WORKSPACES, ...SAMUEL_WORKSPACES].map((w) => w.id);
  await c.query('DELETE FROM org_memberships WHERE org_id = ANY($1::uuid[])', [allOrgs]);
  // Anything the API wrote while somebody demoed (a check in, a charge) leaves
  // an outbox event and perhaps a notification naming the workspace. Seen
  // failing a reset on 2026-09-15: the events are delivery bookkeeping for rows
  // this reset has just removed, so they go with the workspace.
  await c.query('DELETE FROM outbox_events WHERE workspace_id = ANY($1::uuid[])', [allWorkspaces]);
  await c.query('DELETE FROM notifications WHERE workspace_id = ANY($1::uuid[])', [allWorkspaces]);
  await c.query('DELETE FROM workspaces WHERE id = ANY($1::uuid[])', [allWorkspaces]);
  await c.query('DELETE FROM orgs WHERE id = ANY($1::uuid[])', [allOrgs]);
  // identity_documents, verified_identities and user_profiles cascade from users.
  await c.query('DELETE FROM admin_users WHERE user_id = ANY($1::uuid[])', [users]);
  await c.query('DELETE FROM user_roles WHERE user_id = ANY($1::uuid[])', [users]);
  await c.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [users]);
  console.log('reset: removed the demo roster this script owns');
}

/* ── The residence rent roll (ADR-038 child 0, AC-S14) ──────────────────────
 *
 * The Landlord rent roll is the TRACER: the one screen that proves the whole
 * path from a phone to Postgres and back. It reads `rent_charges` joined to
 * `leases` by workspace, so with none of either it renders an empty list, which
 * proves nothing — an empty rent roll and a broken seam look identical.
 *
 * These rows sit behind the Green Hills Properties workspace, which the roster
 * above already creates as the residence org with Josephine as its owner. Task
 * 14 adds Samuel's Kayitare Court alongside it in families 12 and 13 and can
 * extend this same family; nothing here is in its way.
 *
 * The three states the screen sorts and filters on are all present, because a
 * rent roll where every row says the same thing exercises one branch of the
 * screen and hides the other two.
 */

const RESIDENCE_PROPERTY = {
  id: RR(1),
  slug: 'ingoro-apartments',
  // Published, so the landlord's building is on the marketplace with the rest
  // of the personas' properties (2026-09-14). Family 05, after the stays' 1-3.
  listingId: LS(4),
  orgId: O(2),
  workspaceId: W(2),
  name: 'Ingoro Apartments',
  district: 'Kicukiro',
  sector: 'Niboye',
  street: 'KK 15 Ave, Niboye',
};

/** One room type standing for "an apartment in this block". */
const RESIDENCE_ROOM_TYPE = {
  id: RR(10),
  name: 'Two bedroom apartment',
  capacity: 4,
  monthlyRentRwf: 450_000,
  cautionRwf: 900_000,
};

/** The units. `rooms.label` is what the rent roll prints as the unit. */
const RESIDENCE_UNITS = [
  { id: RR(20), label: 'A1' },
  { id: RR(21), label: 'A2' },
  { id: RR(22), label: 'B1' },
  { id: RR(23), label: 'B2' },
  { id: RR(24), label: 'C1' },
];

/**
 * The leases.
 *
 * `tenantName` is written on the lease rather than only linked to a user,
 * because most tenants in this demo have no Injishi account — which is the real
 * case, and the rent roll's `coalesce(users.name, leases.tenant_name)` is built
 * for exactly that. Two are linked to real accounts so the join is exercised.
 */
const RESIDENCE_LEASES = [
  { id: RR(30), roomId: RR(20), rent: 450_000, tenantUserId: U(11), tenantName: 'Rayan Iraguha' },
  { id: RR(31), roomId: RR(21), rent: 450_000, tenantUserId: U(12), tenantName: 'Grace Kwizera' },
  { id: RR(32), roomId: RR(22), rent: 380_000, tenantUserId: null, tenantName: 'Ange Uwase' },
  { id: RR(33), roomId: RR(23), rent: 520_000, tenantUserId: null, tenantName: 'Eric Habimana' },
  { id: RR(34), roomId: RR(24), rent: 410_000, tenantUserId: null, tenantName: 'Chantal Mukamana' },
];

/**
 * The charges for the current month, spread across all three states.
 *
 * Dated RELATIVE to today rather than pinned, so the roll reads as current
 * whenever this runs and nobody demoing it has to explain why the overdue row
 * is overdue by nine months. `--refresh` (task 15) is what keeps rows written
 * by an EARLIER run current; this keeps a fresh run current on its own.
 */
function residenceCharges() {
  // Kigali's month, for the same reason `day()` is Kigali's day.
  const [year, month] = day(0).split('-').map(Number);
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const iso = (d) => d.toISOString().slice(0, 10);
  const dayOfMonth = (day) =>
    iso(new Date(Date.UTC(year, month - 1, day)));

  return [
    // Settled, and settled for real: no `mock`, because these are database rows
    // and not a payment recorded through the mock adapter in a demo session.
    { id: RR(40), leaseId: RR(30), amount: 450_000, paid: 450_000, status: 'paid',    due: dayOfMonth(5),  paidAt: dayOfMonth(3) },
    { id: RR(41), leaseId: RR(31), amount: 450_000, paid: 450_000, status: 'paid',    due: dayOfMonth(5),  paidAt: dayOfMonth(4) },
    // Owing, not yet late.
    { id: RR(42), leaseId: RR(32), amount: 380_000, paid: 0,       status: 'due',     due: dayOfMonth(28), paidAt: null },
    // Late. `days` on the phone is computed from this due date, so it stays
    // honest as the month moves rather than being a number stored once.
    { id: RR(43), leaseId: RR(33), amount: 520_000, paid: 0,       status: 'overdue', due: dayOfMonth(1),  paidAt: null },
    // Part paid and still overdue, which is the row that catches a client
    // treating `paid_amount_rwf > 0` as settled.
    { id: RR(44), leaseId: RR(34), amount: 410_000, paid: 150_000, status: 'overdue', due: dayOfMonth(2),  paidAt: null },
  ].map((c) => ({ ...c, periodMonth: iso(firstOfMonth) }));
}

async function seedResidenceRentRoll(c) {
  const p = RESIDENCE_PROPERTY;
  await c.query(
    `INSERT INTO properties
       (id, org_id, workspace_id, name, sector_id, district_id, address_text, slug)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO UPDATE SET slug = coalesce(properties.slug, excluded.slug)`,
    [
      p.id, p.orgId, p.workspaceId, p.name,
      await sectorId(c, p.district, p.sector),
      await districtId(c, p.district),
      p.street, p.slug,
    ],
  );
  await seedListing(c, { id: p.listingId, propertyId: p.id, workspaceId: p.workspaceId, status: 'published' });

  const rt = RESIDENCE_ROOM_TYPE;
  await c.query(
    `INSERT INTO room_types
       (id, property_id, workspace_id, name, domain, capacity, room_count,
        base_price_rwf, caution_rwf)
     VALUES ($1, $2, $3, $4, 'residence', $5, $6, $7, $8)
     ON CONFLICT (id) DO NOTHING`,
    [
      rt.id, p.id, p.workspaceId, rt.name, rt.capacity,
      RESIDENCE_UNITS.length, rt.monthlyRentRwf, rt.cautionRwf,
    ],
  );

  for (const unit of RESIDENCE_UNITS) {
    await c.query(
      `INSERT INTO rooms
         (id, room_type_id, property_id, workspace_id, label, status,
          housekeeping_status)
       VALUES ($1, $2, $3, $4, $5, 'available', 'clean')
       ON CONFLICT (id) DO NOTHING`,
      [unit.id, rt.id, p.id, p.workspaceId, unit.label],
    );
  }

  for (const lease of RESIDENCE_LEASES) {
    await c.query(
      `INSERT INTO leases
         (id, room_id, org_id, workspace_id, tenant_user_id, tenant_name,
          monthly_rent_rwf, caution_rwf, status, start_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', $9)
       ON CONFLICT (id) DO NOTHING`,
      [
        lease.id, lease.roomId, p.orgId, p.workspaceId,
        lease.tenantUserId, lease.tenantName,
        lease.rent, lease.rent * 2,
        // Started last year, so the tenancy reads as established rather than as
        // five leases that all began this morning.
        `${Number(day(0).slice(0, 4)) - 1}-02-01`,
      ],
    );
  }

  for (const charge of residenceCharges()) {
    await c.query(
      `INSERT INTO rent_charges
         (id, lease_id, period_month, amount_rwf, paid_amount_rwf, status,
          due_date, paid_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO NOTHING`,
      [
        charge.id, charge.leaseId, charge.periodMonth, charge.amount,
        charge.paid, charge.status, charge.due, charge.paidAt,
      ],
    );
  }
}

/* ── Kayitare Court (2026-09-15) ────────────────────────────────────────────
 *
 * Samuel's landlord seat was an org and a workspace with NOTHING behind it: no
 * building, no units, no leases. Every landlord screen opened empty for the one
 * persona a presenter uses to show the switcher, so the rent roll at
 * `/w/<SW(1)>/rent-roll` looked broken on the demo.
 *
 * This building is written to put every state a landlord screen can render on
 * screen at once, because an empty column on a board reads as a missing feature:
 *
 *   | Board            | What is here                                              |
 *   |------------------|-----------------------------------------------------------|
 *   | Rent roll        | paid, due, overdue, and a part payment still overdue       |
 *   | Leases           | a draft, a SIGNED lease ready to activate, active, ending, |
 *   |                  | ended                                                      |
 *   | Move-outs        | a lease on notice, an ended lease whose deposit is waiting |
 *   |                  | to be settled, and one settled with its reason             |
 *   | Maintenance      | open, in progress and resolved work orders                 |
 *   | Inbox            | two tenants with accounts, each with a conversation        |
 *   | Units / Listing  | three unit types, ten units, four of them vacant           |
 *
 * The signed lease sits on a unit no active lease holds, so "Mark signed —
 * activate" succeeds on stage instead of tripping `leases_active_room_uk`.
 *
 * Tenants with accounts are Theoneste (U13) and Fidele (U14): neither holds a
 * seat in this org, so `assertNoSelfLease` stays true. Everyone else is a name
 * on the lease with no account, which is the common case in Kigali.
 *
 * Family `..21NN`, clear of 17 and 18 (reserved) and 19 and 20 (used).
 */

const KC = (n) => `de300000-0000-4000-8000-0000000021${String(n).padStart(2, '0')}`; // Kayitare Court

const KAYITARE_PROPERTY = {
  id: KC(1), listingId: KC(2), orgId: SO(1), workspaceId: SW(1),
  slug: 'kayitare-court', name: 'Kayitare Court',
  district: 'Kicukiro', sector: 'Kagarama', street: 'KK 31 Ave, Kagarama',
};

const KAYITARE_UNIT_TYPES = [
  { id: KC(3), name: 'Studio', capacity: 1, rent: 250_000 },
  { id: KC(4), name: 'One bedroom apartment', capacity: 2, rent: 350_000 },
  { id: KC(5), name: 'Two bedroom apartment', capacity: 4, rent: 520_000 },
];

const KAYITARE_UNITS = [
  { id: KC(10), type: KC(3), label: 'S1' },
  { id: KC(11), type: KC(3), label: 'S2' },
  { id: KC(12), type: KC(3), label: 'S3' },
  { id: KC(13), type: KC(4), label: 'A1' },
  { id: KC(14), type: KC(4), label: 'A2' },
  { id: KC(15), type: KC(4), label: 'A3' },
  { id: KC(16), type: KC(4), label: 'A4' },
  { id: KC(17), type: KC(5), label: 'B1' },
  { id: KC(18), type: KC(5), label: 'B2' },
  { id: KC(19), type: KC(5), label: 'B3' },
];

/**
 * `start` and `end` are month offsets from this month; `signed` says whether
 * both sides have signed. `current` is the state of THIS month's charge on a
 * live lease, and `paidNow` what has been paid against it.
 */
const KAYITARE_LEASES = [
  { id: KC(20), unit: KC(10), rent: 250_000, tenantUserId: U(13), tenant: 'Theoneste Bimenyimana', phone: '+250 788 210 101',
    status: 'active', start: -14, signed: true, current: 'paid' },
  { id: KC(21), unit: KC(11), rent: 250_000, tenantUserId: U(14), tenant: 'Fidele Nkurikiyimana', phone: '+250 788 210 102',
    status: 'active', start: -9, signed: true, current: 'overdue', paidNow: 100_000 },
  { id: KC(22), unit: KC(13), rent: 350_000, tenant: 'Diane Mukeshimana', phone: '+250 788 210 103',
    status: 'active', start: -20, signed: true, current: 'due' },
  { id: KC(23), unit: KC(14), rent: 350_000, tenant: 'Patrick Nshimiyimana', phone: '+250 788 210 104',
    status: 'active', start: -6, signed: true, current: 'overdue' },
  { id: KC(24), unit: KC(17), rent: 520_000, tenant: 'Olive Umutoni', phone: '+250 788 210 105',
    status: 'active', start: -26, signed: true, current: 'paid' },
  // On notice: leaves at the end of next month.
  { id: KC(25), unit: KC(18), rent: 520_000, tenant: 'Jean Paul Habiyaremye', phone: '+250 788 210 106',
    status: 'ending', start: -18, end: 1, signed: true, current: 'paid' },
  // Moved out last month. The deposit is still held: that is the Move-outs job.
  { id: KC(26), unit: KC(15), rent: 350_000, tenant: 'Aline Mutesi', phone: '+250 788 210 107',
    status: 'ended', start: -13, end: -1, signed: true },
  // Moved out in spring and settled, so the board shows what a finished one looks like.
  { id: KC(27), unit: KC(16), rent: 350_000, tenant: 'Innocent Mugisha', phone: '+250 788 210 108',
    status: 'ended', start: -30, end: -6, signed: true },
  // Both sides have signed; activating it on stage raises its first month.
  { id: KC(28), unit: KC(12), rent: 250_000, tenant: 'Sandrine Ingabire', phone: '+250 788 210 109',
    status: 'pending_signature', start: 0, signed: true },
  { id: KC(29), unit: KC(19), rent: 520_000, tenant: 'Kevin Ishimwe', phone: '+250 788 210 110',
    status: 'draft', start: 1, signed: false },
];

/** First day of the month `offset` months from this one, as YYYY-MM-DD. */
function monthStart(offset) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1)).toISOString().slice(0, 10);
}

/** Last day of the month `offset` months from this one. */
function monthEnd(offset) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset + 1, 0)).toISOString().slice(0, 10);
}

/** A YYYY-MM-DD `days` from `iso`. */
function addDays(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Three months of rent on every lease that was live in them.
 *
 * The two earlier months are settled on the 3rd. This month follows the
 * lease's `current`, and its due date is placed relative to TODAY rather than
 * pinned to a day of the month: a "due" row is due in five days and an overdue
 * one fell due nine days ago, whatever day the nightly job happens to run.
 */
function kayitareCharges() {
  const today = new Date().toISOString().slice(0, 10);
  const rows = [];
  let n = 30;
  for (const lease of KAYITARE_LEASES) {
    if (lease.status === 'draft' || lease.status === 'pending_signature') continue;
    for (const offset of [-2, -1, 0]) {
      if (offset < lease.start) continue;
      if (lease.end !== undefined && offset > lease.end) continue;
      const period = monthStart(offset);
      const settledEarlier = offset < 0 || lease.current === 'paid' || lease.current === undefined;
      if (settledEarlier) {
        rows.push({ id: KC(n++), leaseId: lease.id, period, amount: lease.rent, paid: lease.rent,
          status: 'paid', due: addDays(period, 4), paidAt: addDays(period, 2) });
        continue;
      }
      rows.push({
        id: KC(n++), leaseId: lease.id, period, amount: lease.rent, paid: lease.paidNow ?? 0,
        status: lease.current,
        due: lease.current === 'due' ? addDays(today, 5) : addDays(today, -9),
        paidAt: null,
      });
    }
  }
  if (n > 60) throw new Error('Kayitare Court charges overran their id block');
  return rows;
}

const KAYITARE_HOLDS = [
  ...KAYITARE_LEASES.filter((l) => ['active', 'ending', 'ended'].includes(l.status)).map((l, i) => ({
    id: KC(60 + i), leaseId: l.id, amount: l.rent * 2,
    status: l.id === KC(27) ? 'refunded' : 'held',
    heldDaysAgo: Math.max(30, -l.start * 30),
  })),
];

const KAYITARE_SETTLEMENTS = [
  { id: KC(70), holdId: KAYITARE_HOLDS.find((h) => h.leaseId === KC(27)).id, leaseId: KC(27),
    refunded: 700_000, forfeited: 0, daysAgo: 150,
    reason: 'Unit handed back clean with all keys. Full caution returned.' },
];

const KAYITARE_TICKETS = [
  { id: KC(75), leaseId: KC(21), title: 'Water heater not working', category: 'plumbing', priority: 'high',
    status: 'open', raisedBy: U(14), role: 'tenant', hoursAgo: 3,
    description: 'No hot water since this morning in S2.' },
  { id: KC(76), leaseId: KC(22), title: 'Corridor light flickering outside A1', category: 'electrical', priority: 'normal',
    status: 'in_progress', raisedBy: U(6), role: 'staff', hoursAgo: 30,
    description: 'The ceiling light in the first floor corridor flickers after dark.',
    notes: [{ id: KC(80), by: U(6), hoursAgo: 20, note: 'Electrician booked for tomorrow at 10:00.' }] },
  { id: KC(77), leaseId: KC(20), title: 'Fridge door seal torn', category: 'appliance', priority: 'low',
    status: 'resolved', raisedBy: U(13), role: 'tenant', hoursAgo: 120, resolvedHoursAgo: 48,
    description: 'The seal on the fridge door is torn and it will not stay cold.',
    notes: [{ id: KC(81), by: U(6), hoursAgo: 48, note: 'Seal replaced by the supplier under warranty.' }] },
  { id: KC(78), leaseId: KC(25), title: 'Repaint the living room before move-out', category: 'other', priority: 'low',
    status: 'open', raisedBy: U(6), role: 'staff', hoursAgo: 50,
    description: 'Tenant leaves next month. Scuffed walls in the living room.' },
];

const KAYITARE_THREADS = [
  { id: KC(85), leaseId: KC(20) },
  { id: KC(86), leaseId: KC(21) },
];

const KAYITARE_MESSAGES = [
  { id: KC(90), thread: KC(85), from: U(13), minutesAgo: 7300, body: 'Hello, the fridge door seal is torn and it will not stay cold.' },
  { id: KC(91), thread: KC(85), from: U(6),  minutesAgo: 7200, body: 'Thanks Theoneste, I have logged it and called the supplier.' },
  { id: KC(92), thread: KC(85), from: U(13), minutesAgo: 2800, body: 'All fixed now, thank you. This month is paid.' },
  { id: KC(93), thread: KC(86), from: U(14), minutesAgo: 190,  body: 'Good morning, there is no hot water in S2 since this morning.' },
  { id: KC(94), thread: KC(86), from: U(14), minutesAgo: 185,  body: 'Also, I paid 100,000 of this month. The rest comes on Friday.' },
];

async function seedCautionHold(c, h) {
  await c.query(
    `INSERT INTO caution_holds (id, lease_id, amount_rwf, status, held_at)
     VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
    [h.id, h.leaseId, h.amount, h.status, hoursFromNow(-24 * h.heldDaysAgo)],
  );
}

async function seedMaintenanceTicket(c, t) {
  await c.query(
    `INSERT INTO maintenance_tickets
       (id, lease_id, property_id, org_id, workspace_id, raised_by_user_id,
        raised_by_role, title, description, category, priority, status,
        resolved_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14)
     ON CONFLICT (id) DO NOTHING`,
    [
      t.id, t.leaseId, t.propertyId, t.orgId, t.workspaceId, t.raisedBy, t.role,
      t.title, t.description, t.category, t.priority, t.status,
      t.resolvedHoursAgo === undefined ? null : hoursFromNow(-t.resolvedHoursAgo),
      hoursFromNow(-t.hoursAgo),
    ],
  );
  for (const note of t.notes ?? []) {
    await c.query(
      `INSERT INTO maintenance_events (id, ticket_id, author_user_id, note, created_at)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
      [note.id, t.id, note.by, note.note, hoursFromNow(-note.hoursAgo)],
    );
  }
}

async function seedKayitareCourt(c) {
  const p = KAYITARE_PROPERTY;
  await c.query(
    `INSERT INTO properties
       (id, org_id, workspace_id, name, description, sector_id, district_id, address_text, slug)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (id) DO UPDATE SET slug = coalesce(properties.slug, excluded.slug)`,
    [
      p.id, p.orgId, p.workspaceId, p.name,
      'A fictional demo apartment block: ten studios and flats off KK 31 Ave in Kagarama.',
      await sectorId(c, p.district, p.sector),
      await districtId(c, p.district),
      p.street, p.slug,
    ],
  );
  await seedListing(c, { id: p.listingId, propertyId: p.id, workspaceId: p.workspaceId, status: 'published' });

  for (const t of KAYITARE_UNIT_TYPES) {
    await c.query(
      `INSERT INTO room_types
         (id, property_id, workspace_id, name, domain, capacity, room_count,
          base_price_rwf, caution_rwf)
       VALUES ($1, $2, $3, $4, 'residence', $5, $6, $7, $8)
       ON CONFLICT (id) DO NOTHING`,
      [t.id, p.id, p.workspaceId, t.name, t.capacity,
        KAYITARE_UNITS.filter((u) => u.type === t.id).length, t.rent, t.rent * 2],
    );
  }
  for (const u of KAYITARE_UNITS) {
    await c.query(
      `INSERT INTO rooms
         (id, room_type_id, property_id, workspace_id, label, status, housekeeping_status)
       VALUES ($1, $2, $3, $4, $5, 'available', 'clean')
       ON CONFLICT (id) DO NOTHING`,
      [u.id, u.type, p.id, p.workspaceId, u.label],
    );
  }

  for (const l of KAYITARE_LEASES) {
    const startDate = monthStart(l.start);
    // A signature a week before the tenancy began, never in the future.
    const signedAt = l.signed ? hoursFromNow(-24 * Math.max(3, 7 - l.start * 30)) : null;
    await c.query(
      `INSERT INTO leases
         (id, room_id, org_id, workspace_id, tenant_user_id, tenant_name, tenant_phone,
          monthly_rent_rwf, caution_rwf, status, start_date, end_date,
          landlord_signed_at, tenant_signed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)
       ON CONFLICT (id) DO NOTHING`,
      [
        l.id, l.unit, p.orgId, p.workspaceId, l.tenantUserId ?? null, l.tenant, l.phone,
        l.rent, l.rent * 2, l.status, startDate,
        l.end === undefined ? null : monthEnd(l.end),
        signedAt,
      ],
    );
  }

  for (const ch of kayitareCharges()) {
    await c.query(
      `INSERT INTO rent_charges
         (id, lease_id, period_month, amount_rwf, paid_amount_rwf, status, due_date, paid_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO NOTHING`,
      [ch.id, ch.leaseId, ch.period, ch.amount, ch.paid, ch.status, ch.due, ch.paidAt],
    );
  }

  for (const h of KAYITARE_HOLDS) await seedCautionHold(c, h);
  for (const s of KAYITARE_SETTLEMENTS) {
    await c.query(
      `INSERT INTO caution_settlements
         (id, lease_id, caution_hold_id, refunded_rwf, forfeited_rwf, reason, settled_at, idempotency_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO NOTHING`,
      [s.id, s.leaseId, s.holdId, s.refunded, s.forfeited, s.reason,
        hoursFromNow(-24 * s.daysAgo), `seed-demo:${s.id}`],
    );
  }

  for (const t of KAYITARE_TICKETS) {
    await seedMaintenanceTicket(c, { ...t, propertyId: p.id, orgId: p.orgId, workspaceId: p.workspaceId });
  }

  for (const t of KAYITARE_THREADS) {
    const newest = Math.min(...KAYITARE_MESSAGES.filter((m) => m.thread === t.id).map((m) => m.minutesAgo));
    await c.query(
      `INSERT INTO threads (id, workspace_id, lease_id, thread_kind, status, updated_at)
       VALUES ($1, $2, $3, 'reservation', 'active', $4) ON CONFLICT (id) DO NOTHING`,
      [t.id, p.workspaceId, t.leaseId, hoursFromNow(-newest / 60)],
    );
  }
  for (const m of KAYITARE_MESSAGES) await seedMessage(c, m);
}

/**
 * Delete the landlord rows `seed-demo` owns, child to parent.
 *
 * Keyed on the LEASES and THREADS rather than on each row's own id, so a rent
 * payment, a settlement, a work order or a message a presenter made during a
 * demo (random ids, pointing at a seeded lease) goes too instead of failing the
 * reset on a foreign key.
 */
async function resetLandlordRows(c) {
  const leaseIds = [...RESIDENCE_LEASES.map((l) => l.id), ...KAYITARE_LEASES.map((l) => l.id)];
  const threadIds = [...LEASE_THREADS, ...KAYITARE_THREADS].map((t) => t.id);
  await c.query('DELETE FROM messages WHERE thread_id = ANY($1::uuid[])', [threadIds]);
  await c.query('DELETE FROM thread_reads WHERE thread_id = ANY($1::uuid[])', [threadIds]);
  await c.query('DELETE FROM threads WHERE id = ANY($1::uuid[]) OR lease_id = ANY($2::uuid[])', [threadIds, leaseIds]);
  await c.query('DELETE FROM maintenance_tickets WHERE lease_id = ANY($1::uuid[])', [leaseIds]);
  await c.query('DELETE FROM caution_settlements WHERE lease_id = ANY($1::uuid[])', [leaseIds]);
  await c.query('DELETE FROM caution_holds WHERE lease_id = ANY($1::uuid[])', [leaseIds]);
  await c.query('DELETE FROM rent_charges WHERE lease_id = ANY($1::uuid[])', [leaseIds]);
  await c.query('DELETE FROM leases WHERE id = ANY($1::uuid[])', [leaseIds]);
  const p = KAYITARE_PROPERTY;
  await c.query('DELETE FROM rooms WHERE property_id = $1', [p.id]);
  await c.query('DELETE FROM room_types WHERE property_id = $1', [p.id]);
  await c.query('DELETE FROM listings WHERE property_id = $1', [p.id]);
  await c.query('DELETE FROM properties WHERE id = $1', [p.id]);
}

/* ── `--refresh`: make today today again (task 15, AC-S12) ─────────────────
 *
 * A demo database goes stale. The seed writes its dates relative to the moment
 * it runs — someone arriving today, someone in a room right now, rent due on
 * the 5th — and a week later the arrival is last week and the overdue row is
 * overdue by however long nobody looked. Re-seeding fixes that and throws away
 * everything the last demo did, which is the wrong trade when somebody recorded
 * a payment on stage yesterday and wants to show it again.
 *
 * So `--refresh` SHIFTS instead of rewriting. It inserts nothing, deletes
 * nothing, and touches no column that is not a date or a timestamp.
 *
 * ## How far to shift
 *
 * By however long it has been since these rows were written. The seed's own
 * `created_at` is the anchor: the newest one is the moment of the last seed or
 * refresh, so `now() - that` is exactly the drift, and adding it back puts
 * every relative date where the seed originally put it. Because `created_at` is
 * shifted along with everything else, the next refresh measures from the new
 * anchor rather than compounding.
 *
 * ## What it will not touch
 *
 * Rows no seed owns. Every row is matched by a deterministic `de300000-0000-…`
 * id (or, for the few tables keyed by something else, the owned id in that
 * column), which is the same rule `--reset` uses. A payment recorded during a
 * demo has a random id, matches no predicate, and survives untouched. That is
 * AC-S12's second half.
 *
 * Tables AND columns are discovered from the catalog (2026-09-15). The tables
 * used to be a hand list, which was safe and went stale the day the hotel's
 * folios, housekeeping and orders arrived in another script: a refreshed demo
 * then had today's bookings with last week's bills. The id predicate is what
 * keeps a sweep safe — the `de300000-0000-4000-800[01]-` namespace is reserved
 * for seeds, and the catalogue seed's own ids (`de300000-00NN-…`) do not match.
 * Date and range columns move too: a room hold is a `daterange`.
 */

/**
 * The id prefixes a seeded row carries. `8000` is every seed script's own rows
 * (this one, `seed-demo-hotel.mjs`, `seed-demo-portfolio.mjs`); `8001` is the
 * guest and tenant accounts those scripts mint outside the persona roster, so
 * `/api/v1/demo/personas` never lists them.
 */
const OWNED = 'de300000-0000-4000-8000-%';
const OWNED_PREFIXES = [OWNED, 'de300000-0000-4000-8001-%'];

/**
 * Tables whose seeded rows are NOT marked by their own `id`, each with the
 * column that marks them. A membership is inserted with a generated id, so its
 * org is what makes it this script's; a profile is keyed on its user.
 *
 * Every OTHER table is discovered: any table with an `id` column has its
 * temporal columns shifted on the rows whose id carries an owned prefix. That
 * is what keeps a table added by a later seed (the hotel's folios, the
 * portfolio's reviews) current without anybody remembering this file. The
 * predicate is still the id, so a row a demo session wrote, with a random id,
 * is never reached (AC-S12).
 */
const KEYED = [
  { table: 'user_profiles', key: 'user_id' },
  { table: 'verified_identities', key: 'user_id' },
  // Linked by `identity_id`, which is the user's id: `verified_identities` is
  // keyed on the user, and the document hangs off that.
  { table: 'identity_documents', key: 'identity_id' },
  { table: 'user_roles', key: 'user_id' },
  { table: 'org_memberships', key: 'org_id' },
  { table: 'thread_reads', key: 'thread_id' },
];

/** The column types a shift moves. Ranges move both bounds. */
const TEMPORAL_TYPES = [
  'date',
  'timestamp with time zone',
  'timestamp without time zone',
  'daterange',
  'tstzrange',
  'tsrange',
];

/**
 * Does this table have this column?
 *
 * The keyed map above is written by hand and the schema moves underneath it. A
 * refresh that dies on a renamed column is a refresh nobody runs, so a table
 * whose key column is gone is SKIPPED and named, loudly enough that somebody
 * fixes the map rather than quietly shifting nothing.
 */
async function hasColumn(c, table, column) {
  const { rows } = await c.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, column],
  );
  return rows.length > 0;
}

/**
 * Every table with temporal columns and a way to recognise its seeded rows,
 * as the database itself reports them.
 */
async function refreshPlan(c) {
  const { rows } = await c.query(
    `SELECT cl.relname AS table_name, a.attname AS column_name,
            format_type(a.atttypid, a.atttypmod) AS data_type,
            EXISTS (SELECT 1 FROM pg_attribute k
                     WHERE k.attrelid = cl.oid AND k.attname = 'id'
                       AND k.attnum > 0 AND NOT k.attisdropped) AS has_id
       FROM pg_attribute a
       JOIN pg_class cl ON cl.oid = a.attrelid
      WHERE cl.relkind = 'r'
        AND cl.relnamespace = 'public'::regnamespace
        AND a.attnum > 0 AND NOT a.attisdropped
        AND format_type(a.atttypid, a.atttypmod) = ANY($1::text[])
      ORDER BY cl.relname, a.attnum`,
    [TEMPORAL_TYPES],
  );
  const keyed = new Map(KEYED.map((k) => [k.table, k.key]));
  const plan = new Map();
  for (const r of rows) {
    const key = keyed.get(r.table_name) ?? (r.has_id ? 'id' : null);
    if (!key) continue;
    if (!plan.has(r.table_name)) plan.set(r.table_name, { key, columns: [] });
    plan.get(r.table_name).columns.push({ name: r.column_name, type: r.data_type });
  }
  const skipped = [];
  for (const { table, key } of KEYED) {
    if (plan.has(table) && !(await hasColumn(c, table, key))) {
      skipped.push(`${table}.${key}`);
      plan.delete(table);
    }
  }
  return { plan, skipped };
}

/**
 * How stale the seeded rows are, twice over.
 *
 * `users.created_at` is the anchor because every run writes people first and
 * every row the seeds own is written in the same pass, so they all share one
 * moment. Timestamps move by the exact interval since then. DATES move by the
 * number of calendar days (Kigali's, the calendar `day()` writes with) between that
 * moment and now: a seed at 23:00 refreshed at 08:00 is nine hours stale, and
 * its "arrives today" row must still move to the new today. Null means nothing
 * is seeded yet, and there is nothing to shift.
 */
async function drift(c) {
  const { rows } = await c.query(
    // Cast to text in the query rather than letting the driver hand back its
    // own interval object: that object stringifies as `[object Object]`.
    `SELECT (now() - max(created_at))::text AS gap,
            ((now() AT TIME ZONE 'Africa/Kigali')::date - (max(created_at) AT TIME ZONE 'Africa/Kigali')::date) AS days
       FROM users WHERE id::text LIKE $1`,
    [OWNED],
  );
  if (!rows[0] || rows[0].gap === null) return null;
  return { gap: rows[0].gap, days: Number(rows[0].days) };
}

/**
 * Shift every seeded date forward, all of it or none of it.
 *
 * **The transaction is not a nicety.** The shift is measured from
 * `users.created_at`, so a run that moved `users` and then failed on a later
 * table would move the anchor without moving the rows it anchors, and the next
 * run would measure a gap of nearly zero and shift nothing. That is what
 * happened the first time this ran, against a table whose key had been renamed.
 */
async function refresh(c) {
  const stale = await drift(c);
  if (stale === null) {
    console.log('refresh: nothing seeded yet. Run the seed first.');
    return;
  }

  await c.query('BEGIN');
  try {
    const shifted = await shiftAll(c, stale);
    await c.query('COMMIT');
    console.log(
      `refresh: moved ${shifted.count} rows across ${shifted.tables} tables forward by ${stale.gap}` +
        ` (dates by ${stale.days} day${stale.days === 1 ? '' : 's'}).`,
    );
    console.log('refresh: nothing was inserted and nothing was deleted.');
    if (shifted.skipped.length > 0) {
      console.log(
        `refresh: SKIPPED ${shifted.skipped.join(', ')} — no such column. The keyed` +
          ' map in this script is out of step with the schema and wants correcting.',
      );
    }
  } catch (err) {
    await c.query('ROLLBACK');
    throw new Error(
      `refresh failed and was rolled back; nothing moved.
  ${err.message}`,
    );
  }
}

/** Far enough that a row parked there can meet nothing that has not moved yet. */
const PARK_DAYS = 109_500;

/**
 * One column's value moved by `days` (a date, a date range) or by `interval`
 * (a timestamp, a timestamp range). Both are SQL expressions.
 */
function moved(col, days, interval) {
  const c = `"${col.name}"`;
  const bounds = `(CASE WHEN lower_inc(${c}) THEN '[' ELSE '(' END || CASE WHEN upper_inc(${c}) THEN ']' ELSE ')' END)`;
  switch (col.type) {
    case 'date':
      return `${c} + (${days})`;
    case 'daterange':
      return `CASE WHEN ${c} IS NULL OR isempty(${c}) THEN ${c}
                   ELSE daterange(lower(${c}) + (${days}), upper(${c}) + (${days}), ${bounds}) END`;
    case 'tstzrange':
    case 'tsrange':
      return `CASE WHEN ${c} IS NULL OR isempty(${c}) THEN ${c}
                   ELSE ${col.type}(lower(${c}) + ${interval}, upper(${c}) + ${interval}, ${bounds}) END`;
    default:
      return `${c} + ${interval}`;
  }
}

/**
 * Move each table's seeded rows in two hops: out to a parking spot centuries
 * away, then back to where they belong.
 *
 * One hop is not safe, because Postgres checks a unique index and an exclusion
 * constraint ROW BY ROW during an UPDATE. Moving a guest's room nights forward
 * a day collides with the next night's charge that has not moved yet
 * (`folio_charges_room_night_uk`), and a room hold collides with the hold after
 * it (the `room_assignments` exclusion constraint). Parked, no moved row can
 * meet an unmoved one; coming back, every row keeps its distance from the rest.
 *
 * All of a table's columns move in ONE statement, so a check that compares two
 * of them (a check out after its check in) never sees one moved and one not.
 */
async function shiftAll(c, stale) {
  const { plan, skipped } = await refreshPlan(c);
  const out = { days: `${PARK_DAYS}`, interval: `(interval '1 day' * ${PARK_DAYS})` };
  const back = {
    days: `${stale.days} - ${PARK_DAYS}`,
    interval: `($2::interval - interval '1 day' * ${PARK_DAYS})`,
  };
  const update = (table, key, columns, move) =>
    c.query(
      `UPDATE "${table}"
          SET ${columns.map((col) => `"${col.name}" = ${moved(col, move.days, move.interval)}`).join(', ')}
        WHERE "${key}"::text LIKE ANY($1::text[])`,
      move === out ? [OWNED_PREFIXES] : [OWNED_PREFIXES, stale.gap],
    );

  let count = 0;
  let tables = 0;
  for (const [table, { key, columns }] of plan) {
    const parked = await update(table, key, columns, out);
    if (!parked.rowCount) continue;
    await update(table, key, columns, back);
    count += parked.rowCount;
    tables += 1;
  }
  return { count, tables, skipped };
}

/**
 * Nobody is on both sides of one lease (task 14).
 *
 * Samuel wears five hats and two of them sit at opposite ends of a tenancy: he
 * owns Kayitare Court and he holds a Personal seat that can rent. The prototype
 * fixtures got exactly this wrong three separate ways — he rented a flat from
 * himself, earned a broker fee from himself, and appeared twice on one unit —
 * because four files each named an org and only one of them was ever checked.
 *
 * So this is an assertion rather than a comment. It asks the database the
 * question directly: is there a lease whose tenant is an active member of the
 * org that owns it? A yes is a seed bug and it stops the run, because a demo
 * showing one person on both sides of a contract is worse than no demo.
 */
async function assertNoSelfLease(c) {
  const { rows } = await c.query(
    `SELECT l.id, l.tenant_name, o.legal_name
       FROM leases l
       JOIN orgs o ON o.id = l.org_id
       JOIN org_memberships m
         ON m.org_id = l.org_id
        AND m.user_id = l.tenant_user_id
        AND m.status = 'active'
      WHERE l.tenant_user_id IS NOT NULL`,
  );
  if (rows.length === 0) return;
  const lines = rows
    .map(
      (r) =>
        `  lease ${r.id}: ${r.tenant_name} rents from ${r.legal_name}, which they also hold a seat in`,
    )
    .join('\n');
  throw new Error(
    'A seeded person is on both sides of a lease (task 14):\n' +
      lines +
      '\nGive that tenancy to somebody who holds no seat in that org.',
  );
}

async function main() {
  const client = new pg.Client({ connectionString: databaseUrl() });
  await client.connect();
  // ADR-043: sample data only ever goes into a database marked sample.
  await assertSampleDatabase(client, 'seed-demo.mjs');
  try {
    await checkPreconditions(client);

    // `--refresh` moves what is already there and returns. It must not fall
    // through into the seed: the inserts below are all ON CONFLICT DO NOTHING
    // and would be no-ops, but the summary they print would describe a seed
    // that did not happen.
    if (REFRESH) {
      await refresh(client);
      await reviveExpiredRequests(client);
      await assertNoSelfLease(client);
      return;
    }

    if (RESET) await reset(client);

    await seedBodies(client);
    for (const p of PEOPLE) await seedPerson(client, p);
    for (const o of [...ORGS, ...SAMUEL_ORGS]) await seedOrg(client, o);
    for (const w of [...WORKSPACES, ...SAMUEL_WORKSPACES]) await seedWorkspace(client, w);
    for (const m of [...MEMBERSHIPS, ...SAMUEL_MEMBERSHIPS]) await seedMembership(client, m);
    for (const r of ROLE_PERMISSIONS) await seedRolePermission(client, r);
    for (const a of ASSIGNMENTS) await seedAssignment(client, a);

    // The operational half, in foreign key order.
    for (const pr of PROPERTIES) await seedProperty(client, pr);
    for (const mb of MEMBERSHIP_BRANCHES) await seedMembershipBranches(client, mb);
    for (const l of LISTINGS) await seedListing(client, l);
    for (const rt of ROOM_TYPES) await seedRoomType(client, rt);
    for (const rp of RATE_PLANS) await seedRatePlan(client, rp);
    for (const rm of ROOMS) await seedRoom(client, rm);
    for (const b of [...BOOKINGS, ...BRANCH_BOOKINGS]) await seedBooking(client, b);
    // One thread per booking, then the lines in them. Threads before messages,
    // and both after the bookings they hang off.
    for (const t of [...THREADS, ...BRANCH_THREADS]) await seedThread(client, t);
    for (const m of MESSAGES.filter((x) => THREADS.some((t) => t.id === x.thread))) {
      await seedMessage(client, m);
    }
    for (const st of [...STAYS, ...BRANCH_STAYS]) await seedStay(client, st);
    for (const e of ESCROWS) await seedEscrow(client, e);
    await reviveExpiredRequests(client);
    for (const iv of PENDING_INVOICES) await seedPaidRegistrationFee(client, iv);

    // The residence half: the units, leases and rent charges the Landlord rent
    // roll reads. After the workspaces, because every row hangs off W(2).
    await seedResidenceRentRoll(client);
    // Tenancy conversations after the leases, then their lines. The booking
    // loop above writes only booking-thread lines, because a lease thread does
    // not exist until this point and its lines would fail the foreign key.
    for (const t of LEASE_THREADS) await seedLeaseThread(client, t);
    for (const m of MESSAGES.filter((x) => LEASE_THREADS.some((t) => t.id === x.thread))) {
      await seedMessage(client, m);
    }
    // Samuel's landlord seat, which used to be an org with no building.
    await seedKayitareCourt(client);
    for (const t of SUPPORT_TICKETS) await seedSupportTicket(client, t);

    // Before anything is reported as seeded, not after.
    await assertNoSelfLease(client);

    const { rows } = await client.query(
      `SELECT u.name,
              (SELECT count(*) FROM workspaces w WHERE w.user_id = u.id) AS own_ws,
              (SELECT count(*) FROM org_memberships m WHERE m.user_id = u.id AND m.status = 'active') AS memberships
         FROM users u WHERE u.id = ANY($1::uuid[]) ORDER BY u.name`,
      [PEOPLE.map((p) => p.id)],
    );
    console.log('\nseeded roster:');
    for (const r of rows) {
      console.log(`  ${r.name.padEnd(24)} workspaces=${r.own_ws} memberships=${r.memberships}`);
    }
    console.log(
      '\nSamuel Kayitare should read workspaces=2 memberships=3: his own broker and\n' +
        'personal rows, plus Kayitare Court, Kivu Crest and Umurage. That is FIVE\n' +
        'seats in the switcher (AC-S11, AC-3): Personal, Kayitare Court, Broker, Kivu\n' +
        'Crest and the parked Umurage. The business three come from the memberships.',
    );

    // The desk, as `GET /api/v1/ops/reservations` will read it back.
    const { rows: desk } = await client.query(
      `SELECT b.status, count(*)::int AS n
         FROM bookings b WHERE b.workspace_id = $1 GROUP BY b.status ORDER BY b.status`,
      [W(1)],
    );
    console.log('\nAmahoro reservations desk:');
    for (const d of desk) console.log(`  ${d.status.padEnd(18)} ${d.n}`);
    // ADR-054: the branches, as the operator app's grant will read them back.
    const { rows: branches } = await client.query(
      `SELECT o.legal_name, p.name, p.is_head_office, p.rra_branch_id, p.archived_at IS NOT NULL AS archived
         FROM properties p JOIN orgs o ON o.id = p.org_id
        WHERE p.org_id = ANY($1::uuid[])
        ORDER BY o.legal_name, p.is_head_office DESC, p.name`,
      [[O(1), O(3)]],
    );
    console.log('\nBranches (ADR-054):');
    for (const b of branches) {
      const marks = [b.is_head_office && 'head office', b.rra_branch_id && `RRA ${b.rra_branch_id}`, b.archived && 'archived']
        .filter(Boolean).join(', ');
      console.log(`  ${b.legal_name.padEnd(26)} ${b.name.padEnd(24)} ${marks}`);
    }

    const { rows: limited } = await client.query(
      `SELECT u.email, array_agg(p.name ORDER BY p.name) AS branches
         FROM org_membership_branches ob
         JOIN org_memberships m ON m.id = ob.org_membership_id
         JOIN users u ON u.id = m.user_id
         JOIN properties p ON p.id = ob.property_id
        WHERE m.user_id = ANY($1::uuid[])
        GROUP BY u.email ORDER BY u.email`,
      [PEOPLE.map((p) => p.id)],
    );
    console.log('\nBranch limited members (ADR-054):');
    for (const l of limited) console.log(`  ${l.email.padEnd(28)} ${l.branches.join(', ')}`);

    console.log('\nSign in as yves@demo.injishi.com (code 123456) and open /host/reservations.');
    console.log('Two requests are pending; Approve and Decline both act on real rows.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('\n' + err.message);
  process.exit(1);
});
