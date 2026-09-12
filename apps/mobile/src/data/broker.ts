/**
 * The Broker surface's fixtures: the private unit directory, the reveal ledger,
 * the placements it creates and the fees they earn.
 *
 * Frames B21 to B24. Session 9 owns this file; nothing outside
 * `src/screens/broker/` and `app/directory/` reads it.
 *
 * ## Three invariants the shapes here exist to hold
 *
 * **A Residence unit is private inventory.** F-R01 is unambiguous: `residence`
 * Room types never appear in public Explore, and are discoverable only in the
 * Broker Directory. That is why this catalogue is its own array rather than a
 * flag on `EXPLORABLE_STAYS` — a boolean on a shared list is one forgotten
 * filter away from leaking the whole thing, and the leak would be silent.
 *
 * **A reveal is spent and logged, and both facts are the point.** FL18 step 3
 * and F-R09 §10: the landlord's number is exposed to one broker and the event
 * is written down, because the log is what protects a landlord from having
 * their number harvested. So a reveal costs a credit (a rate limit with a
 * price) and appends to the reveal log (an audit trail). Neither is decoration.
 *
 * **A fee is earned at lease ACTIVATION, not at introduction** (F-R08). So the
 * fee lives on the Placement rather than in a second ledger: the earnings
 * screen derives its rows, its year-to-date total and its chart from this one
 * array, and a fee cannot disagree with the placement that earned it.
 *
 * ## The dates are relative to today, not to the day the frames were drawn
 *
 * B23 draws "Revealed Jun 30" and "Intent expires · 12 days" on the same card.
 * Those two only agree on one particular morning. Seeding absolute dates would
 * mean the countdown reads "expires in −341 days" by the time anyone opened the
 * prototype, so every date below is an offset from the day the module loads and
 * the copy is derived from it. `INTENT_WINDOW_DAYS` is the one number that
 * makes the pair consistent by construction.
 */
import { nightsBetween, todayIso, type IsoDay } from '@/components';
import type { DirectoryListing, PhotoSet } from './rentals';
import {
  readFixture,
  useFixtureMutation,
  useFixtureValue,
  writeFixture,
} from './use-fixture-mutation';
import { useOfflineSubmit } from './offline-submit';

/* ------------------------------------------------------------ time helpers */

/** `n` days from `from`, as an ISO day. Negative reaches backwards. */
export function inDays(n: number, from: IsoDay = todayIso()): IsoDay {
  const [y, m, d] = from.split('-').map(Number);
  const at = new Date(Date.UTC(y, m - 1, d + n));
  return `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, '0')}-${String(
    at.getUTCDate(),
  ).padStart(2, '0')}`;
}

/**
 * Whole days from `now` until `day`. Negative once the day has passed, which is
 * what lets an expiry be derived rather than stored twice.
 */
export function daysUntil(day: IsoDay, now: IsoDay = todayIso()): number {
  return day >= now ? nightsBetween(now, day) : -nightsBetween(day, now);
}

/** How long a placement intent holds a unit before it lapses. */
export const INTENT_WINDOW_DAYS = 30;

/* -------------------------------------------------------------- the unit -- */

/** When the unit can be moved into. `leased` is FL18 path B: unavailable. */
export type Vacancy = { state: 'now' } | { state: 'from'; day: IsoDay } | { state: 'leased' };

/**
 * What the broker earns if their client signs. Both shapes are real terms in
 * the Kigali market and the frames draw one of each ("50% of first month",
 * "RWF 100,000 flat"), so neither can be normalised away.
 */
export type PlacementFee =
  | { kind: 'percent'; percentOfFirstMonth: number }
  | { kind: 'flat'; amount: number };

/** What a fee comes to on a given rent. The only place that arithmetic lives. */
export function feeAmount(fee: PlacementFee, rent: number): number {
  return fee.kind === 'flat' ? fee.amount : Math.round((rent * fee.percentOfFirstMonth) / 100);
}

export interface LandlordContact {
  /** The letting entity, which is who the fee agreement is with. */
  org: string;
  /** The person who answers the phone. */
  name: string;
  phone: string;
  email: string;
}

/**
 * A unit in the private directory.
 *
 * It extends `DirectoryListing` — the tile shape `ListingCard` and `Stay`
 * already share — rather than replacing it, so a broker unit can be drawn by
 * the same card as anything else and only the broker-only facts are new.
 * `title` is `property · unit` because that is how every frame names one; the
 * two halves stay as their own fields so a screen never splits a string back
 * apart.
 */
export interface DirectoryUnit extends DirectoryListing {
  property: string;
  /** The unit label within the property: B4, C1, 7. */
  unit: string;
  /** The neighbourhood, which is what the directory filters on. */
  district: string;
  bedrooms: number;
  bathrooms: number;
  /** Monthly rent. `price` carries the same number for the shared tile shape. */
  rent: number;
  caution: number;
  tenure: 'long_term' | 'short_term';
  vacancy: Vacancy;
  fee: PlacementFee;
  landlord: LandlordContact;
}

/** The tile fields `DirectoryListing` needs that a unit can derive. */
type UnitSeed = Omit<DirectoryUnit, 'title' | 'location' | 'price' | 'per' | 'domain'>;

/**
 * One seed, widened into the tile shape the shared components expect. Derived
 * rather than typed out twice: `title`, `location` and `price` are restatements
 * of `property`/`unit`, `district` and `rent`, and a fixture that states a fact
 * twice is a fixture that will state it two different ways.
 */
function unit(seed: UnitSeed): DirectoryUnit {
  return {
    ...seed,
    domain: 'residence',
    title: `${seed.property} · ${seed.unit}`,
    location: `${seed.district}, Kigali`,
    price: seed.rent,
    per: 'month',
  };
}

const LANDLORDS: Record<string, LandlordContact> = {
  umurava: {
    org: 'Umurava Heights Ltd',
    name: 'Vincent Rutayisire',
    phone: '+250 788 512 044',
    email: 'lettings@umuravaheights.rw',
  },
  ingoro: {
    org: 'Ingoro Apartments',
    name: 'Jean Bosco Habimana',
    phone: '+250 788 640 117',
    email: 'jb@ingoroapartments.rw',
  },
  umuryango: {
    org: 'Umuryango Homes',
    name: 'Alice Uwase',
    phone: '+250 782 300 918',
    email: 'alice@umuryangohomes.rw',
  },
  kigaliLiving: {
    org: 'Kigali Living',
    name: 'Jean Bosco Niyonzima',
    phone: '+250 788 224 703',
    email: 'lettings@kigaliliving.rw',
  },
  habimana: {
    org: 'Habimana Realty',
    name: 'Esperance Habimana',
    phone: '+250 783 118 560',
    email: 'rentals@habimanarealty.rw',
  },
};

/** Cover, four gallery frames, thumbnail. Every stem has a licence row. */
function photos(cover: string, rest: [string, string, string, string]): PhotoSet {
  return { cover, gallery: rest, thumbnail: cover };
}

const CITY: [string, string, string, string] = [
  'kigali-cbd-buildings-01',
  'kigali-skyline-01',
  'kigali-city-street-01',
  'kigali-parliament-aerial-01',
];
const HILLS: [string, string, string, string] = [
  'kigali-hills-view-01',
  'kigali-night-panorama-02',
  'kigali-cbd-buildings-01',
  'kigali-skyline-01',
];
const STREET: [string, string, string, string] = [
  'kigali-city-street-01',
  'kigali-convention-centre-02',
  'kigali-hills-view-01',
  'kigali-cbd-buildings-01',
];

/**
 * Twelve units, which is what frame B21's "Vacant · 12" chip counts.
 *
 * The first two are the frame's own — Umurava Heights B4 and Ingoro Apartments
 * C1, with its rents, sizes and fee terms. The three ids that end the list are
 * the pre-prototype `DIRECTORY` listings in `./rentals` carried across, so a
 * `listing/<id>` link written before this session still lands on a unit rather
 * than on "not found".
 */
export const DIRECTORY_UNITS: DirectoryUnit[] = [
  unit({
    id: 'umurava-heights-b4',
    property: 'Umurava Heights',
    unit: 'B4',
    district: 'Kimihurura',
    bedrooms: 2,
    bathrooms: 1,
    rent: 320000,
    caution: 640000,
    tenure: 'long_term',
    vacancy: { state: 'now' },
    fee: { kind: 'percent', percentOfFirstMonth: 50 },
    landlord: LANDLORDS.umurava,
    rating: 4.7,
    reviews: 12,
    meta: ['2 bed', '1 bath', 'Balcony'],
    agent: 'Umurava Heights Ltd',
    description:
      'Second-floor two-bedroom with a covered balcony over the valley, fibre internet and a shared standby generator. A roof tank carries the block through a municipal water cut.',
    photos: photos('kigali-hills-view-01', CITY),
  }),
  unit({
    id: 'ingoro-apartments-c1',
    property: 'Ingoro Apartments',
    unit: 'C1',
    district: 'Kimihurura',
    bedrooms: 1,
    bathrooms: 1,
    rent: 190000,
    caution: 190000,
    tenure: 'long_term',
    vacancy: { state: 'from', day: inDays(24) },
    fee: { kind: 'flat', amount: 100000 },
    landlord: LANDLORDS.ingoro,
    rating: 4.5,
    reviews: 8,
    meta: ['1 bed', '1 bath', 'Parking'],
    agent: 'Ingoro Apartments',
    description:
      'Ground-floor one-bedroom in a gated eight-unit block with a caretaker on site and one parking bay per flat. The sitting tenant leaves at the end of their notice period.',
    photos: photos('kigali-cbd-buildings-01', STREET),
  }),
  unit({
    id: 'ingoro-apartments-b2',
    property: 'Ingoro Apartments',
    unit: 'B2',
    district: 'Kimihurura',
    bedrooms: 2,
    bathrooms: 2,
    rent: 280000,
    caution: 560000,
    tenure: 'long_term',
    vacancy: { state: 'leased' },
    fee: { kind: 'percent', percentOfFirstMonth: 50 },
    landlord: LANDLORDS.ingoro,
    rating: 4.6,
    reviews: 15,
    meta: ['2 bed', '2 bath', 'Parking'],
    agent: 'Ingoro Apartments',
    description:
      'Two-bedroom corner flat with its own entrance and a walled yard. Let on a two-year lease from this month.',
    photos: photos('kigali-skyline-01', HILLS),
  }),
  unit({
    id: 'kivu-court-7',
    property: 'Kivu Court',
    unit: '7',
    district: 'Nyarutarama',
    bedrooms: 3,
    bathrooms: 2,
    rent: 540000,
    caution: 1080000,
    tenure: 'long_term',
    vacancy: { state: 'now' },
    fee: { kind: 'percent', percentOfFirstMonth: 50 },
    landlord: LANDLORDS.habimana,
    rating: 4.8,
    reviews: 22,
    meta: ['3 bed', '2 bath', 'Garden'],
    agent: 'Habimana Realty',
    description:
      'Three-bedroom townhouse on a quiet close, with a small garden, staff quarters and a borehole shared across the compound.',
    photos: photos('kigali-parliament-aerial-01', HILLS),
  }),
  unit({
    id: 'gasabo-terrace-12',
    property: 'Gasabo Terrace',
    unit: '12',
    district: 'Kacyiru',
    bedrooms: 3,
    bathrooms: 2,
    rent: 610000,
    caution: 1220000,
    tenure: 'long_term',
    vacancy: { state: 'from', day: inDays(9) },
    fee: { kind: 'percent', percentOfFirstMonth: 50 },
    landlord: LANDLORDS.habimana,
    rating: 4.7,
    reviews: 18,
    meta: ['3 bed', '2 bath', 'Standby power'],
    agent: 'Habimana Realty',
    description:
      'Serviced three-bedroom a short walk from the ministries, with standby power, a lift and a residents’ car park. Popular with institutional tenants.',
    photos: photos('kigali-convention-centre-02', CITY),
  }),
  unit({
    id: 'remera-court-a3',
    property: 'Remera Court',
    unit: 'A3',
    district: 'Remera',
    bedrooms: 2,
    bathrooms: 1,
    rent: 240000,
    caution: 480000,
    tenure: 'long_term',
    vacancy: { state: 'now' },
    fee: { kind: 'flat', amount: 120000 },
    landlord: LANDLORDS.umuryango,
    rating: 4.3,
    reviews: 9,
    meta: ['2 bed', '1 bath', 'Shared yard'],
    agent: 'Umuryango Homes',
    description:
      'Two-bedroom flat five minutes from the bus park, in a block of six with a shared yard and a caretaker who lives on site.',
    photos: photos('kigali-city-street-01', STREET),
  }),
  unit({
    id: 'kibagabaga-villa-2',
    property: 'Kibagabaga Villa',
    unit: '2',
    district: 'Kibagabaga',
    bedrooms: 4,
    bathrooms: 3,
    rent: 780000,
    caution: 1560000,
    tenure: 'long_term',
    vacancy: { state: 'now' },
    fee: { kind: 'percent', percentOfFirstMonth: 50 },
    landlord: LANDLORDS.habimana,
    rating: 4.9,
    reviews: 26,
    meta: ['4 bed', '3 bath', 'Garden'],
    agent: 'Habimana Realty',
    description:
      'Four-bedroom family villa behind a walled garden, with a standby generator, staff quarters and space for three cars.',
    photos: photos('kigali-night-panorama-02', HILLS),
  }),
  unit({
    id: 'gisozi-flats-d5',
    property: 'Gisozi Flats',
    unit: 'D5',
    district: 'Gisozi',
    bedrooms: 1,
    bathrooms: 1,
    rent: 165000,
    caution: 165000,
    tenure: 'short_term',
    vacancy: { state: 'now' },
    fee: { kind: 'flat', amount: 80000 },
    landlord: LANDLORDS.umuryango,
    rating: 4.1,
    reviews: 6,
    meta: ['1 bed', '1 bath', 'Furnished'],
    agent: 'Umuryango Homes',
    description:
      'Furnished one-bedroom let on six-month terms, water and refuse included. Suits a posting rather than a family.',
    photos: photos('kigali-skyline-01', CITY),
  }),
  unit({
    id: 'nyamirambo-house-1',
    property: 'Nyamirambo House',
    unit: '1',
    district: 'Nyamirambo',
    bedrooms: 3,
    bathrooms: 1,
    rent: 350000,
    caution: 700000,
    tenure: 'long_term',
    vacancy: { state: 'from', day: inDays(38) },
    fee: { kind: 'percent', percentOfFirstMonth: 50 },
    landlord: LANDLORDS.umuryango,
    rating: 4.4,
    reviews: 11,
    meta: ['3 bed', '1 bath', 'Veranda'],
    agent: 'Umuryango Homes',
    description:
      'Three-bedroom family house on a quiet lane, with a deep veranda and a mature avocado tree. The sitting tenant has filed notice.',
    photos: photos('kigali-city-street-01', HILLS),
  }),
  unit({
    id: 'nyarutarama-villa',
    property: 'Nyarutarama Villa',
    unit: 'A',
    district: 'Nyarutarama',
    bedrooms: 4,
    bathrooms: 3,
    rent: 850000,
    caution: 1700000,
    tenure: 'long_term',
    vacancy: { state: 'now' },
    fee: { kind: 'percent', percentOfFirstMonth: 50 },
    landlord: LANDLORDS.habimana,
    rating: 4.9,
    reviews: 34,
    meta: ['4 bed', '3 bath', 'Garden'],
    agent: 'Habimana Realty',
    description:
      'Serviced four-bedroom villa with a walled garden and standby power. 24-month lease, caution held in escrow, contract auto-filed with the tax administration.',
    photos: photos('kigali-hills-view-01', CITY),
  }),
  unit({
    id: 'kimihurura-duplex',
    property: 'Kimihurura Duplex',
    unit: 'D',
    district: 'Kimihurura',
    bedrooms: 3,
    bathrooms: 2,
    rent: 620000,
    caution: 1240000,
    tenure: 'long_term',
    vacancy: { state: 'now' },
    fee: { kind: 'percent', percentOfFirstMonth: 50 },
    landlord: LANDLORDS.kigaliLiving,
    rating: 4.8,
    reviews: 21,
    meta: ['3 bed', '2 bath', 'Parking'],
    agent: 'Kigali Living',
    description:
      'Modern duplex minutes from the CBD with covered parking and fibre internet. Broker-placed lease with a full placement fee disbursed on signing.',
    photos: photos('kigali-cbd-buildings-01', HILLS),
  }),
  unit({
    id: 'gikondo-flat',
    property: 'Gikondo Garden Flat',
    unit: 'G',
    district: 'Gikondo',
    bedrooms: 2,
    bathrooms: 1,
    rent: 390000,
    caution: 780000,
    tenure: 'long_term',
    vacancy: { state: 'now' },
    fee: { kind: 'flat', amount: 150000 },
    landlord: LANDLORDS.umuryango,
    rating: 4.6,
    reviews: 48,
    meta: ['2 bed', '1 bath', 'Balcony'],
    agent: 'Umuryango Homes',
    description:
      'Bright two-bedroom flat on a quiet street with a shared garden and an on-site caretaker. Ideal for a 12-month tenancy.',
    photos: photos('kigali-city-street-01', CITY),
  }),
];

export function getUnit(id: string): DirectoryUnit | undefined {
  return DIRECTORY_UNITS.find((u) => u.id === id);
}

/** A unit already let cannot take a placement (FL18 path B, F-R02 §9). */
export function isPlaceable(u: DirectoryUnit): boolean {
  return u.vacancy.state !== 'leased';
}

/* --------------------------------------------------------- the reveal log */

/**
 * One logged reveal. F-R09 §10 makes the log the security control, so it
 * records who was exposed and when, and nothing ever deletes a row.
 */
export interface Reveal {
  unitId: string;
  /** ISO day. The frames print a day, not a timestamp. */
  day: IsoDay;
}

export const REVEALS_KEY = 'broker.reveals';
export const CREDITS_KEY = 'broker.credits';
export const PLACEMENTS_KEY = 'broker.placements';

/** Frame B22: "Reveal credits · 7 left this month". */
export const SEED_CREDITS = 7;

/* --------------------------------------------------------- the placements */

/**
 * `active` is an intent that has not become a lease yet; `expired` is derived
 * from it rather than stored — see `placementState`. `signing` and `signed` are
 * events on the lease and cannot be computed from a clock.
 */
export type PlacementState = 'active' | 'signing' | 'signed' | 'expired';

/**
 * The event line B23 prints, as a key rather than a sentence: every printed
 * string in this app owes a Kinyarwanda twin.
 */
export type PlacementEvent =
  | 'contact_revealed'
  | 'viewing_booked'
  | 'lease_drafted'
  | 'awaiting_landlord'
  | 'lease_signed'
  | 'no_response';

export interface Placement {
  id: string;
  /** `null` until the broker names the tenant they are placing (FL19 step 1). */
  client: string | null;
  /** Empty for a placement whose unit predates this directory. */
  unitId: string;
  /** Denormalised so a placement whose unit left the directory still reads. */
  unitLabel: string;
  state: Exclude<PlacementState, 'expired'>;
  revealedAt: IsoDay;
  /** The last thing that happened. */
  event: PlacementEvent;
  /** What the fee comes to. Fixed at reveal, because the rent can move after. */
  fee: number;
  feeState: 'pending' | 'paid';
  signedAt?: IsoDay;
  /** Set only once the fee has disbursed (F-R08: at lease activation). */
  paidAt?: IsoDay;
}

/** When a placement's intent lapses if no lease has been drafted by then. */
export function intentExpiresAt(p: Placement): IsoDay {
  return inDays(INTENT_WINDOW_DAYS, p.revealedAt);
}

/**
 * The state a placement is actually in.
 *
 * An `active` intent whose window has run out is `expired`, and deriving that
 * rather than storing it is what stops the chip and the countdown on the same
 * card from disagreeing. A placement that reached the lease has left the clock
 * behind and keeps the state it was given.
 */
export function placementState(p: Placement, now: IsoDay = todayIso()): PlacementState {
  if (p.state !== 'active') return p.state;
  return daysUntil(intentExpiresAt(p), now) <= 0 ? 'expired' : 'active';
}

/** B23's three chips. `active` holds both live states: an intent and a signing. */
export type PlacementBucket = 'active' | 'signed' | 'expired';

export function bucketOf(p: Placement, now: IsoDay = todayIso()): PlacementBucket {
  const state = placementState(p, now);
  if (state === 'signed') return 'signed';
  if (state === 'expired') return 'expired';
  return 'active';
}

export function countByBucket(
  placements: readonly Placement[],
  now: IsoDay = todayIso(),
): Record<PlacementBucket, number> {
  const counts: Record<PlacementBucket, number> = { active: 0, signed: 0, expired: 0 };
  for (const p of placements) counts[bucketOf(p, now)] += 1;
  return counts;
}

/** The eleven signed placements frame B24's hero counts, newest last. */
const SIGNED_FEES: { fee: number; monthsAgo: number; client: string; unit: string }[] = [
  { fee: 160000, monthsAgo: 5, client: 'P. Habimana', unit: 'Gasabo Terrace · 12' },
  { fee: 120000, monthsAgo: 4, client: 'E. Mukandayisenga', unit: 'Remera Court · A3' },
  { fee: 95000, monthsAgo: 4, client: 'A. Ndayisenga', unit: 'Kivu Court · 7' },
  { fee: 130000, monthsAgo: 3, client: 'F. Nkurunziza', unit: 'Gisozi Flats · D5' },
  { fee: 110000, monthsAgo: 3, client: 'S. Uwimana', unit: 'Nyamirambo House · 1' },
  { fee: 150000, monthsAgo: 2, client: 'D. Rwigema', unit: 'Kimihurura Duplex · D' },
  { fee: 125000, monthsAgo: 2, client: 'B. Iradukunda', unit: 'Gikondo Garden Flat · G' },
  { fee: 120000, monthsAgo: 1, client: 'M. Nyiraneza', unit: 'Remera Court · A3' },
  { fee: 175000, monthsAgo: 0, client: 'T. Bizimana', unit: 'Kibagabaga Villa · 2' },
  { fee: 165000, monthsAgo: 0, client: 'J. Uwamahoro', unit: 'Nyarutarama Villa · A' },
  { fee: 135000, monthsAgo: 0, client: 'C. Munyaneza', unit: 'Ingoro Apartments · B2' },
];

/** A day in the month `n` back, so the chart lands each fee in its own bar. */
function monthsAgo(n: number, dayOfMonth: number): IsoDay {
  const now = new Date();
  const at = new Date(Date.UTC(now.getFullYear(), now.getMonth() - n, dayOfMonth));
  return `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, '0')}-${String(
    at.getUTCDate(),
  ).padStart(2, '0')}`;
}

/**
 * Sixteen placements: three live, eleven signed and paid this year, two lapsed.
 *
 * The eleven are what frame B24's hero counts ("11 placements signed · avg fee
 * 135K") and their fees sum to exactly RWF 1,485,000, so the hero, the chart
 * and the fee list are three readings of one array rather than three numbers
 * somebody typed. B23 draws "Signed · 5" on the same canvas; the chips here
 * count what is in the data, so they read 11 — see the session report.
 */
export const SEED_PLACEMENTS: Placement[] = [
  {
    id: 'pl-claudine-ingoro-b2',
    client: 'Claudine U.',
    unitId: 'ingoro-apartments-b2',
    unitLabel: 'Ingoro Apartments · B2',
    state: 'signing',
    revealedAt: inDays(-9),
    event: 'lease_drafted',
    fee: 140000,
    feeState: 'pending',
  },
  {
    id: 'pl-mugisha-umurava-b4',
    client: 'J. Mugisha',
    unitId: 'umurava-heights-b4',
    unitLabel: 'Umurava Heights · B4',
    state: 'active',
    revealedAt: inDays(-18),
    event: 'viewing_booked',
    fee: 160000,
    feeState: 'pending',
  },
  {
    id: 'pl-keza-gasabo-12',
    client: 'L. Keza',
    unitId: 'gasabo-terrace-12',
    unitLabel: 'Gasabo Terrace · 12',
    state: 'active',
    revealedAt: inDays(-3),
    event: 'awaiting_landlord',
    fee: 305000,
    feeState: 'pending',
  },
  /* Two intents whose window ran out. Seeded `active` on purpose: the state
     they read as is derived from the clock, which is the property worth
     exercising rather than asserting. */
  {
    id: 'pl-lapsed-gikondo',
    client: 'R. Habineza',
    unitId: 'gikondo-flat',
    unitLabel: 'Gikondo Garden Flat · G',
    state: 'active',
    revealedAt: inDays(-52),
    event: 'no_response',
    fee: 150000,
    feeState: 'pending',
  },
  {
    id: 'pl-lapsed-gisozi',
    client: null,
    unitId: 'gisozi-flats-d5',
    unitLabel: 'Gisozi Flats · D5',
    state: 'active',
    revealedAt: inDays(-77),
    event: 'contact_revealed',
    fee: 80000,
    feeState: 'pending',
  },
  ...SIGNED_FEES.map<Placement>((row, i) => ({
    id: `pl-signed-${i}`,
    client: row.client,
    // These pre-date the directory this session seeds; the label is what a card
    // draws, and an id pointing at nothing would be worse than none.
    unitId: '',
    unitLabel: row.unit,
    state: 'signed' as const,
    // Revealed a few weeks before the lease was signed, which is what makes
    // "Revealed …" and "Signed …" two different dates on the same card.
    revealedAt: monthsAgo(row.monthsAgo + 1, 20),
    event: 'lease_signed' as const,
    fee: row.fee,
    feeState: 'paid' as const,
    signedAt: monthsAgo(row.monthsAgo, 12),
    paidAt: monthsAgo(row.monthsAgo, 14),
  })),
];

/** Every reveal the seeded placements imply, so the log starts consistent. */
export const SEED_REVEALS: Reveal[] = SEED_PLACEMENTS.filter((p) => p.unitId !== '').map((p) => ({
  unitId: p.unitId,
  day: p.revealedAt,
}));

/* ----------------------------------------------------------- the earnings */

export interface MonthBar {
  /** `2026-09`. */
  key: string;
  /** 1-12, for the month-name message key. */
  month: number;
  year: number;
  total: number;
  current: boolean;
}

/** How many months frame B24's chart draws. */
export const CHART_MONTHS = 6;

/**
 * The chart: the last six months of DISBURSED fees, oldest first.
 *
 * Every month in the window gets a bar, including the ones that earned nothing
 * — a chart that omits an empty month draws a line climbing when it is flat.
 */
export function monthlyFees(placements: readonly Placement[], now: Date = new Date()): MonthBar[] {
  const bars: MonthBar[] = [];
  for (let back = CHART_MONTHS - 1; back >= 0; back -= 1) {
    const at = new Date(Date.UTC(now.getFullYear(), now.getMonth() - back, 1));
    const year = at.getUTCFullYear();
    const month = at.getUTCMonth() + 1;
    const key = `${year}-${String(month).padStart(2, '0')}`;
    const total = placements.reduce(
      (sum, p) => (p.feeState === 'paid' && p.paidAt?.startsWith(key) ? sum + p.fee : sum),
      0,
    );
    bars.push({ key, month, year, total, current: back === 0 });
  }
  return bars;
}

export interface EarningsSummary {
  year: number;
  /** Disbursed this calendar year. */
  total: number;
  signed: number;
  /** Zero rather than NaN when nothing has signed yet. */
  average: number;
  /** Earned but not yet disbursed — a lease that has not activated. */
  pending: number;
}

export function summariseEarnings(
  placements: readonly Placement[],
  now: Date = new Date(),
): EarningsSummary {
  const year = now.getFullYear();
  const paid = placements.filter((p) => p.feeState === 'paid' && p.paidAt?.startsWith(String(year)));
  const total = paid.reduce((sum, p) => sum + p.fee, 0);
  const pending = placements
    .filter((p) => p.feeState === 'pending' && placementState(p) !== 'expired')
    .reduce((sum, p) => sum + p.fee, 0);
  return {
    year,
    total,
    signed: paid.length,
    average: paid.length ? Math.round(total / paid.length) : 0,
    pending,
  };
}

/** The date a fee row is filed under: paid, else signed, else revealed. */
function feeDay(p: Placement): IsoDay {
  return p.paidAt ?? p.signedAt ?? p.revealedAt;
}

/**
 * The fee ledger B24 lists, most recent first. A lapsed intent is left out: it
 * earns nothing and never will, so a row for it would be a fee that is not one.
 */
export function recentFees(placements: readonly Placement[]): Placement[] {
  return [...placements]
    .filter((p) => placementState(p) !== 'expired')
    .sort((a, b) => feeDay(b).localeCompare(feeDay(a)));
}

/* -------------------------------------------------------------- the hooks */

export interface BrokerState {
  credits: number;
  reveals: Reveal[];
  placements: Placement[];
  isRevealed: (unitId: string) => boolean;
  placementFor: (unitId: string) => Placement | undefined;
}

/** The read. One hook, so a screen never assembles three stores by hand. */
export function useBrokerState(): BrokerState {
  const credits = useFixtureValue<number>(CREDITS_KEY, () => SEED_CREDITS);
  const reveals = useFixtureValue<Reveal[]>(REVEALS_KEY, () => SEED_REVEALS);
  const placements = useFixtureValue<Placement[]>(PLACEMENTS_KEY, () => SEED_PLACEMENTS);

  return {
    credits,
    reveals,
    placements,
    isRevealed: (unitId) => reveals.some((r) => r.unitId === unitId),
    placementFor: (unitId) =>
      placements.find((p) => p.unitId === unitId && placementState(p) !== 'expired'),
  };
}

/**
 * The write: spend a credit, log the reveal, open a placement.
 *
 * Three `useFixtureMutation` calls because the store is keyed and each hook
 * writes one key, sequenced here so the caller gets one promise. When this
 * becomes a real `useMutation` the sequence collapses into one request, which
 * is the shape it is written for.
 */
export interface RevealMutation {
  reveal: (unit: DirectoryUnit) => Promise<void>;
  saving: boolean;
  /** True when any of the three writes failed. The sheet must not claim a reveal. */
  failed: boolean;
  /** The reveal is in the offline queue rather than done. Not a failure. */
  queuedOffline: boolean;
  reset: () => void;
}

export function useReveal(): RevealMutation {
  /**
   * The credit spend, made IDEMPOTENT per unit (gaps.md §5.2, P1).
   *
   * The log has always been idempotent — *"a reveal is idempotent per unit: the
   * number is already out, and charging twice for one exposure would be a
   * second credit spent on nothing"* — but the SPEND was not, and it is the
   * half that costs money. A double-fired press decremented twice and wrote one
   * log row, so the two disagreed and the broker was down a credit with nothing
   * to show for it. `gaps.md` names exactly this: *"An unconfirmed or
   * double-fired reveal costs the broker money."*
   *
   * The unit id is the idempotency key, and it is read from the log rather than
   * held in the component, so the guard survives a remount and a second sheet
   * opened on the same unit.
   */
  const spend = useFixtureMutation<number, string>(
    CREDITS_KEY,
    (current, unitId) => {
      const already = readFixture<Reveal[]>(REVEALS_KEY, SEED_REVEALS).some(
        (r) => r.unitId === unitId,
      );
      return already ? current : Math.max(0, current - 1);
    },
    () => SEED_CREDITS,
  );
  const log = useFixtureMutation<Reveal[], Reveal>(
    REVEALS_KEY,
    // A reveal is idempotent per unit: the number is already out, and charging
    // twice for one exposure would be a second credit spent on nothing.
    (current, entry) =>
      current.some((r) => r.unitId === entry.unitId) ? current : [entry, ...current],
    () => SEED_REVEALS,
  );
  const place = useFixtureMutation<Placement[], Placement>(
    PLACEMENTS_KEY,
    (current, entry) =>
      current.some((p) => p.unitId === entry.unitId) ? current : [entry, ...current],
    () => SEED_PLACEMENTS,
  );

  /**
   * The offline half (gaps.md §7's queued reveal).
   *
   * A reveal spends money, so it is the one queued action where a duplicate is
   * not noise. The unit id is the idempotency key at BOTH layers — the queue
   * dedupes on it, and `spend` reads the log before decrementing — so a broker
   * who presses twice on a bad connection is charged once whichever layer sees
   * the second press.
   */
  const queued = useOfflineSubmit<DirectoryUnit>({
    kind: 'reveal',
    handler: (u) => {
      const day = todayIso();
      const already = readFixture<Reveal[]>(REVEALS_KEY, SEED_REVEALS).some((r) => r.unitId === u.id);
      if (!already) {
        writeFixture<number>(
          CREDITS_KEY,
          Math.max(0, readFixture<number>(CREDITS_KEY, SEED_CREDITS) - 1),
        );
      }
      writeFixture<Reveal[]>(REVEALS_KEY, [
        { unitId: u.id, day },
        ...readFixture<Reveal[]>(REVEALS_KEY, SEED_REVEALS).filter((r) => r.unitId !== u.id),
      ]);
      // The fixture store cannot refuse and cannot be unreachable, so this
      // is always `ok`. The surface child that puts a real mutation here
      // (ADR-038 children 1 to 7) is where `refused` and `failed` start
      // being answered for real.
      return { status: 'ok' as const };
    },
    label: (u) => u.title,
    idFor: (u) => `reveal-${u.id}`,
  });

  return {
    saving: spend.status === 'saving' || log.status === 'saving' || place.status === 'saving',
    failed: spend.status === 'error' || log.status === 'error' || place.status === 'error',
    queuedOffline: queued.state === 'queued',
    reset: () => {
      spend.reset();
      log.reset();
      place.reset();
    },
    reveal: async (u) => {
      const day = todayIso();
      if (queued.offline) {
        await queued.submit(u);
        return;
      }
      // Order matters and is deliberate: SPEND FIRST, then log. The spend reads
      // the log to decide whether it has already been paid for, so logging
      // first would make every spend a no-op and reveals would be free.
      await spend.mutate(u.id);
      await log.mutate({ unitId: u.id, day });
      await place.mutate({
        id: `pl-${u.id}`,
        // FL19 step 1: the tenant is named when the placement is initiated, not
        // when the number is revealed. A lead with a made-up name would be a
        // fixture pretending the flow had already happened.
        client: null,
        unitId: u.id,
        unitLabel: u.title,
        state: 'active',
        revealedAt: day,
        event: 'contact_revealed',
        fee: feeAmount(u.fee, u.rent),
        feeState: 'pending',
      });
    },
  };
}
