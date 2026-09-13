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
// Scoped to what the first thread reads: the Reservations desk. Leases, folios,
// tickets and menus arrive with the steps that build their screens, so nothing
// here is fixture data for a surface nobody can open yet.
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
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

import { assertSampleDatabase } from './sample-database.mjs';

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

// --- The roster --------------------------------------------------------------
// Mirrors mfp-demo-users.md. `nid` null means no identity document at all,
// which is the deliberate "cannot elevate" case.

const PEOPLE = [
  { id: U(1),  email: 'yves@demo.injishi.rw',      name: 'Yves Rutayisire',       kyc: 'verified',   nid: '1198080012345601' },
  { id: U(2),  email: 'solange@demo.injishi.rw',   name: 'Solange Uwera',         kyc: 'verified',   nid: '1198580012345602' },
  { id: U(3),  email: 'denise@demo.injishi.rw',    name: 'Denise Iribagiza',      kyc: 'verified',   nid: '1199080012345603' },
  { id: U(4),  email: 'beatha@demo.injishi.rw',    name: 'Beatha Mukeshimana',    kyc: 'verified',   nid: '1199280012345604' },
  { id: U(5),  email: 'josephine@demo.injishi.rw', name: 'Josephine Uwimana',     kyc: 'verified',   nid: '1197580012345605' },
  { id: U(6),  email: 'samuel@demo.injishi.rw',    name: 'Samuel Kayitare',       kyc: 'verified',   nid: '1198280012345606', roles: ['broker'] },
  { id: U(7),  email: 'jeanbosco@demo.injishi.rw', name: 'Jean-Bosco Nkurunziza', kyc: 'verified',   nid: '1198080012345607', roles: ['gov_oversight'] },
  { id: U(8),  email: 'claudine@demo.injishi.rw',  name: 'Claudine Mukamana',     kyc: 'verified',   nid: '1198380012345608', roles: ['gov_oversight'] },
  { id: U(9),  email: 'yvette@demo.injishi.rw',    name: 'Yvette Mukamana',       kyc: 'verified',   nid: '1198480012345609', roles: ['gov_oversight'] },
  { id: U(10), email: 'alice@demo.injishi.rw',     name: 'Alice Uwimana',         kyc: 'verified',   nid: '1198680012345610', roles: ['gov_oversight'] },
  { id: U(11), email: 'rayan@demo.injishi.rw',     name: 'Rayan Iraguha',         kyc: 'verified',   nid: '1199080123456789' },
  // Books with no document at all: the demand side stays email OTP only.
  { id: U(12), email: 'grace@demo.injishi.rw',     name: 'Grace Kwizera',         kyc: 'unverified', nid: null },
  // Tries to become a Host and is refused: no active identity document.
  { id: U(13), email: 'theoneste@demo.injishi.rw', name: 'Theoneste Bimenyimana', kyc: 'unverified', nid: null },
  // Held an oversight grant; it was revoked. Signs in, gets no console.
  { id: U(14), email: 'fidele@demo.injishi.rw',    name: 'Fidele Nkurikiyimana',  kyc: 'verified',   nid: '1198780012345614', roles: ['gov_oversight'] },
  // Platform staff, so a presenter can open the admin console on the demo
  // (ADR-043, AC-20). `ops`, not `super_admin`: the demo signs anyone in with a
  // published code, so its staff persona holds the narrowest lens that still
  // shows the console working.
  { id: U(15), email: 'ops@demo.injishi.rw',       name: 'Olivier Habimana',      kyc: 'verified',   nid: '1198880012345615', roles: ['admin'], staffRoles: ['ops'] },
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
];

const MEMBERSHIPS = [
  { orgId: O(1), userId: U(1), role: 'owner' },
  { orgId: O(1), userId: U(2), role: 'manager' },
  { orgId: O(1), userId: U(3), role: 'receptionist' },
  { orgId: O(1), userId: U(4), role: 'housekeeper' },
  { orgId: O(2), userId: U(5), role: 'owner' },
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

const BODIES = [
  ['PSF', 'Private Sector Federation', 'Ihuriro ry’Abikorera', 'PSF'],
  ['MINALOC', 'Ministry of Local Government', 'Minisiteri y’Ubutegetsi bw’Igihugu', 'MINALOC'],
];

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

/** Days from today, as a bare YYYY-MM-DD the `date` columns take verbatim. */
function day(offset) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

/** Hours from now, for the timestamp columns. */
function hoursFromNow(offset) {
  return new Date(Date.now() + offset * 3600 * 1000);
}

const PROPERTIES = [
  {
    id: PR(1), orgId: O(1), workspaceId: W(1),
    name: 'Amahoro Boutique Hotel',
    description: 'Twenty rooms off the Remera roundabout, run by the group that owns it.',
    district: 'Gasabo', sector: 'Remera', street: 'KG 11 Ave',
    checkIn: '14:00', checkOut: '11:00',
    houseRules: 'No smoking indoors. Quiet hours from 22:00.',
  },
];

// Published, because a draft is what the listing wizard produces and this one is
// meant to be a business already trading.
const LISTINGS = [{ id: LS(1), propertyId: PR(1), workspaceId: W(1), status: 'published' }];

const ROOM_TYPES = [
  {
    id: RT(1), propertyId: PR(1), workspaceId: W(1), name: 'Standard Double',
    maxGuests: 2, capacity: 2, roomCount: 2, priceRwf: 45000,
    // Instant book carries no approval policy, and the
    // `room_types_approval_policy_shape` check enforces that rather than
    // trusting this comment.
    bookingMode: 'instant_book', approvalPolicy: null, cancellationTier: 'flexible',
  },
  {
    id: RT(2), propertyId: PR(1), workspaceId: W(1), name: 'Executive Suite',
    maxGuests: 3, capacity: 3, roomCount: 2, priceRwf: 120000,
    // Request to book is what makes the approve command mean anything: only a
    // `pending_approval` booking is there to approve.
    bookingMode: 'request_to_book', approvalPolicy: 'approve_all', cancellationTier: 'moderate',
  },
];

// One "Standard rate" per room type, carrying the same values verbatim (F-L03).
// The room type columns are deprecated but the booking engine still reads them,
// so both sides are written and they agree.
const RATE_PLANS = ROOM_TYPES.map((rt, i) => ({
  id: RP(i + 1), roomTypeId: rt.id, workspaceId: W(1), name: 'Standard rate',
  priceRwf: rt.priceRwf, baseOccupancy: 2,
  bookingMode: rt.bookingMode, approvalPolicy: rt.approvalPolicy,
  cancellationTier: rt.cancellationTier,
}));

const ROOMS = [
  { id: RM(1), roomTypeId: RT(1), label: '101', housekeeping: 'clean' },
  { id: RM(2), roomTypeId: RT(1), label: '102', housekeeping: 'dirty' },
  { id: RM(3), roomTypeId: RT(2), label: '201', housekeeping: 'clean' },
  { id: RM(4), roomTypeId: RT(2), label: '202', housekeeping: 'inspected' },
];

/**
 * Eight bookings, one per state the desk can show.
 *
 * `gross` is the nightly rate times the nights, matching how the booking engine
 * prices, so the total on screen is not a number someone made up.
 */
const BOOKINGS = [
  // The two the approve and decline commands act on.
  { id: BK(1), ref: 'BK-DEMO-001', roomType: RT(2), guest: U(11), status: 'pending_approval', in: 2,  nights: 3, gross: 360000 },
  { id: BK(2), ref: 'BK-DEMO-002', roomType: RT(2), guest: U(12), status: 'pending_approval', in: 0,  nights: 2, gross: 240000 },
  // Confirmed, nobody has arrived. The second arrives today, which is what turns
  // "Reserved" into a check in button.
  { id: BK(3), ref: 'BK-DEMO-003', roomType: RT(1), guest: U(13), status: 'confirmed', in: 7,  nights: 2, gross: 90000 },
  { id: BK(4), ref: 'BK-DEMO-004', roomType: RT(1), guest: U(14), status: 'confirmed', in: 0,  nights: 3, gross: 135000 },
  // In house right now, and checked out last week. Both carry a guest stay.
  { id: BK(5), ref: 'BK-DEMO-005', roomType: RT(1), guest: U(6),  status: 'confirmed', in: -1, nights: 3, gross: 135000 },
  { id: BK(6), ref: 'BK-DEMO-006', roomType: RT(2), guest: U(11), status: 'confirmed', in: -5, nights: 3, gross: 360000 },
  // Declined: the screen hides it, and proving that it hides it is the point.
  { id: BK(7), ref: 'BK-DEMO-007', roomType: RT(1), guest: U(12), status: 'declined',  in: 4,  nights: 2, gross: 90000 },
  // Cancelled: kept visible, because somebody has to see a confirmed booking go.
  { id: BK(8), ref: 'BK-DEMO-008', roomType: RT(2), guest: U(13), status: 'cancelled', in: 10, nights: 2, gross: 240000 },
];

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
];

const STAYS = [
  { id: GS(1), bookingId: BK(5), roomId: RM(1), guest: U(6),  lifecycle: 'open',   entryHours: -20,  exitHours: 48 },
  { id: GS(2), bookingId: BK(6), roomId: RM(3), guest: U(11), lifecycle: 'closed', entryHours: -120, exitHours: -48 },
];

/** Money already taken. A refused or cancelled request is refunded in full. */
const ESCROWS = BOOKINGS.map((b, i) => ({
  id: ES(i + 1), bookingId: b.id, amountRwf: b.gross,
  status: b.status === 'declined' || b.status === 'cancelled' ? 'refunded_full' : 'held',
}));

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
  await c.query(
    `INSERT INTO properties
       (id, org_id, workspace_id, name, description, sector_id, district_id,
        address_text, check_in_time, check_out_time, house_rules)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (id) DO NOTHING`,
    [
      pr.id, pr.orgId, pr.workspaceId, pr.name, pr.description,
      await sectorId(c, pr.district, pr.sector),
      await districtId(c, pr.district),
      pr.street, pr.checkIn, pr.checkOut, pr.houseRules,
      // No photo column: ADR-049 moved photographs into `property_photos`, so a
      // seeded property has NO photograph and therefore cannot be published
      // until one is attached through the operator app.
    ],
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

async function seedRoom(c, rm) {
  await c.query(
    `INSERT INTO rooms
       (id, room_type_id, property_id, workspace_id, label, status, housekeeping_status)
     VALUES ($1, $2, $3, $4, $5, 'available', $6) ON CONFLICT (id) DO NOTHING`,
    [rm.id, rm.roomTypeId, PR(1), W(1), rm.label, rm.housekeeping],
  );
}

/**
 * One booking, priced and dated from its offsets.
 *
 * `booking_mode` is copied from the room type rather than chosen here, so a
 * `pending_approval` row can never sit on an instant book product, which is a
 * state the approve command has no answer for.
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
     ON CONFLICT (id) DO NOTHING`,
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
 * answered 503 because there was no capture to release (ADR-049 J27). The value
 * is the one `MockPaymentAdapter` mints for a capture, `mock_escrow_capture_`
 * plus the idempotency key, so the adapter reads it as its own.
 *
 * A re run fills a reference an older seed left null and changes nothing else,
 * so a sample database seeded before this fix is repaired by running it again.
 */
async function seedEscrow(c, e) {
  const idempotencyKey = `seed-demo:${e.id}`;
  await c.query(
    `INSERT INTO escrows
       (id, workspace_id, source, booking_id, amount_rwf, status, adapter_ref, adapter_mode, idempotency_key)
     VALUES ($1, $2, 'booking', $3, $4, $5, $6, 'mock', $7)
     ON CONFLICT (id) DO UPDATE SET adapter_ref = EXCLUDED.adapter_ref
       WHERE escrows.adapter_ref IS NULL`,
    // The key is derived from the row id rather than random, so re running
    // cannot trip the unique index with a second key for the same escrow.
    [e.id, W(1), e.bookingId, e.amountRwf, e.status, `mock_escrow_capture_${idempotencyKey}`, idempotencyKey],
  );
}

/** Delete only what this script owns, by deterministic id. Never truncates. */
async function reset(c) {
  const users = PEOPLE.map((p) => p.id);
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
  await c.query('DELETE FROM properties WHERE id = $1', [RESIDENCE_PROPERTY.id]);

  // Messages before threads, threads before the bookings they point at.
  await c.query('DELETE FROM messages WHERE id = ANY($1::uuid[])', [MESSAGES.map((m) => m.id)]);
  await c.query('DELETE FROM thread_reads WHERE thread_id = ANY($1::uuid[])', [THREADS.map((t) => t.id)]);
  await c.query('DELETE FROM threads WHERE id = ANY($1::uuid[])', [THREADS.map((t) => t.id)]);
  await c.query('DELETE FROM escrows WHERE id = ANY($1::uuid[])', [ESCROWS.map((e) => e.id)]);
  await c.query('DELETE FROM guest_stays WHERE id = ANY($1::uuid[])', [STAYS.map((g) => g.id)]);
  await c.query('DELETE FROM bookings WHERE id = ANY($1::uuid[])', [BOOKINGS.map((b) => b.id)]);
  await c.query('DELETE FROM rooms WHERE id = ANY($1::uuid[])', [ROOMS.map((r) => r.id)]);
  await c.query('DELETE FROM rate_plans WHERE id = ANY($1::uuid[])', [RATE_PLANS.map((r) => r.id)]);
  await c.query('DELETE FROM room_types WHERE id = ANY($1::uuid[])', [ROOM_TYPES.map((r) => r.id)]);
  await c.query('DELETE FROM listings WHERE id = ANY($1::uuid[])', [LISTINGS.map((l) => l.id)]);
  await c.query('DELETE FROM properties WHERE id = ANY($1::uuid[])', [PROPERTIES.map((r) => r.id)]);
  await c.query('DELETE FROM oversight_assignments WHERE id = ANY($1::uuid[])', [ASSIGNMENTS.map((a) => a.id)]);
  // Samuel's three business seats go with the rest. Listed as one array per
  // table so a seat added above and forgotten here cannot leave a row that
  // `--reset` is unable to clear.
  const allOrgs = [...ORGS, ...SAMUEL_ORGS].map((o) => o.id);
  const allWorkspaces = [...WORKSPACES, ...SAMUEL_WORKSPACES].map((w) => w.id);
  await c.query('DELETE FROM org_memberships WHERE org_id = ANY($1::uuid[])', [allOrgs]);
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
  const now = new Date();
  const firstOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const iso = (d) => d.toISOString().slice(0, 10);
  const dayOfMonth = (day) =>
    iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day)));

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
       (id, org_id, workspace_id, name, sector_id, district_id, address_text)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO NOTHING`,
    [
      p.id, p.orgId, p.workspaceId, p.name,
      await sectorId(c, p.district, p.sector),
      await districtId(c, p.district),
      p.street,
    ],
  );

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
        `${new Date().getUTCFullYear() - 1}-02-01`,
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
 * Rows this script does not own. The tables below are listed with the predicate
 * that identifies the seed's rows in each — every one of them a deterministic
 * `de300000-…` id, which is the same rule `--reset` uses. A payment recorded
 * during a demo has a random id, matches no predicate, and survives untouched.
 * That is AC-S12's second half, and it is the reason this is a list rather than
 * a sweep over the schema.
 *
 * The COLUMNS are discovered rather than listed, from `information_schema`, so
 * a temporal column added by a later migration is shifted without anybody
 * having to remember this file. The TABLES are listed, so nothing outside the
 * seed can ever be reached. That split is deliberate: forgetting a column makes
 * a demo look slightly wrong, and reaching a table you do not own corrupts
 * somebody else's data.
 */

/** The id prefix every row this script writes carries. */
const OWNED = 'de300000-0000-4000-8000-%';

/**
 * The tables the seed owns, each with the column carrying the owned id.
 *
 * Order does not matter: nothing here inserts or deletes, so there are no
 * foreign keys to respect.
 */
const REFRESHABLE = [
  { table: 'users', key: 'id' },
  { table: 'user_profiles', key: 'user_id' },
  { table: 'verified_identities', key: 'user_id' },
  // Linked by `identity_id`, which is the user's id: `verified_identities` is
  // keyed on the user, and the document hangs off that. Not `user_id` — this
  // table has no such column, which is the kind of thing only running it finds.
  { table: 'identity_documents', key: 'identity_id' },
  { table: 'user_roles', key: 'user_id' },
  { table: 'orgs', key: 'id' },
  { table: 'workspaces', key: 'id' },
  // Keyed on the org rather than on its own id: a membership is inserted with a
  // generated id, so the org is what marks it as this script's.
  { table: 'org_memberships', key: 'org_id' },
  { table: 'oversight_assignments', key: 'id' },
  { table: 'properties', key: 'id' },
  { table: 'listings', key: 'id' },
  { table: 'room_types', key: 'id' },
  { table: 'rate_plans', key: 'id' },
  { table: 'rooms', key: 'id' },
  { table: 'bookings', key: 'id' },
  { table: 'guest_stays', key: 'id' },
  { table: 'escrows', key: 'id' },
  { table: 'leases', key: 'id' },
  { table: 'rent_charges', key: 'id' },
];

/**
 * Does this table have this column?
 *
 * The table map above is written by hand and the schema moves underneath it. A
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

/** Temporal columns on a table, as the database itself reports them. */
async function temporalColumns(c, table) {
  const { rows } = await c.query(
    `SELECT column_name, data_type
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND data_type IN ('date', 'timestamp without time zone', 'timestamp with time zone')`,
    [table],
  );
  return rows;
}

/**
 * How stale the seeded rows are.
 *
 * `users.created_at` is the anchor because every run writes people first and
 * every row this script owns is written in the same pass, so they all share one
 * moment. Null means nothing is seeded yet, and there is nothing to shift.
 */
async function drift(c) {
  const { rows } = await c.query(
    // Cast to text in the query rather than letting the driver hand back its
    // own interval object: that object stringifies as `[object Object]`, which
    // is useless in the log line and is not something to hand back as a
    // parameter either.
    `SELECT (now() - max(created_at))::text AS gap FROM users WHERE id::text LIKE $1`,
    [OWNED],
  );
  return rows[0]?.gap ?? null;
}

/**
 * Shift every seeded date forward, all of it or none of it.
 *
 * **The transaction is not a nicety.** The shift is measured from
 * `users.created_at`, and `users` is the first table in the list — so a run
 * that updates `users` and then fails on a later table has moved the anchor
 * without moving the rows it anchors. The next run measures a gap of nearly
 * zero and shifts nothing, and the data is stranded half-corrected with no way
 * to tell from the outside. That is not a hypothetical: it is what happened the
 * first time this ran, against a table whose key column had been renamed.
 */
async function refresh(c) {
  const gap = await drift(c);
  if (gap === null) {
    console.log('refresh: nothing seeded yet. Run the seed first.');
    return;
  }

  await c.query('BEGIN');
  try {
    const shifted = await shiftAll(c, gap);
    await c.query('COMMIT');
    console.log(`refresh: moved ${shifted.count} date and timestamp values forward by ${gap}.`);
    console.log('refresh: nothing was inserted and nothing was deleted.');
    if (shifted.skipped.length > 0) {
      console.log(
        `refresh: SKIPPED ${shifted.skipped.join(', ')} — no such column. The table` +
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

async function shiftAll(c, gap) {
  let shifted = 0;
  const skipped = [];
  for (const { table, key } of REFRESHABLE) {
    if (!(await hasColumn(c, table, key))) {
      skipped.push(`${table}.${key}`);
      continue;
    }
    const columns = await temporalColumns(c, table);
    // A table this script names but the schema does not have yet reports no
    // columns and is skipped, rather than failing a refresh over a migration
    // that has not run.
    if (columns.length === 0) continue;

    for (const col of columns) {
      // A `date` column plus an interval yields a timestamp, so it is cast back
      // rather than quietly widening what the column means by a few hours.
      const value =
        col.data_type === 'date'
          ? `("${col.column_name}" + $1::interval)::date`
          : `"${col.column_name}" + $1::interval`;

      const { rowCount } = await c.query(
        `UPDATE "${table}"
            SET "${col.column_name}" = ${value}
          WHERE "${key}"::text LIKE $2
            AND "${col.column_name}" IS NOT NULL`,
        [gap, OWNED],
      );
      shifted += rowCount ?? 0;
    }
  }

  return { count: shifted, skipped };
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
      await assertNoSelfLease(client);
      return;
    }

    if (RESET) await reset(client);

    await seedBodies(client);
    for (const p of PEOPLE) await seedPerson(client, p);
    for (const o of [...ORGS, ...SAMUEL_ORGS]) await seedOrg(client, o);
    for (const w of [...WORKSPACES, ...SAMUEL_WORKSPACES]) await seedWorkspace(client, w);
    for (const m of [...MEMBERSHIPS, ...SAMUEL_MEMBERSHIPS]) await seedMembership(client, m);
    for (const a of ASSIGNMENTS) await seedAssignment(client, a);

    // The operational half, in foreign key order.
    for (const pr of PROPERTIES) await seedProperty(client, pr);
    for (const l of LISTINGS) await seedListing(client, l);
    for (const rt of ROOM_TYPES) await seedRoomType(client, rt);
    for (const rp of RATE_PLANS) await seedRatePlan(client, rp);
    for (const rm of ROOMS) await seedRoom(client, rm);
    for (const b of BOOKINGS) await seedBooking(client, b);
    // One thread per booking, then the lines in them. Threads before messages,
    // and both after the bookings they hang off.
    for (const t of THREADS) await seedThread(client, t);
    for (const m of MESSAGES) await seedMessage(client, m);
    for (const st of STAYS) await seedStay(client, st);
    for (const e of ESCROWS) await seedEscrow(client, e);

    // The residence half: the units, leases and rent charges the Landlord rent
    // roll reads. After the workspaces, because every row hangs off W(2).
    await seedResidenceRentRoll(client);

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
    console.log('\nSign in as yves@demo.injishi.rw (code 123456) and open /host/reservations.');
    console.log('Two requests are pending; Approve and Decline both act on real rows.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('\n' + err.message);
  process.exit(1);
});
