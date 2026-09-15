/**
 * Mock Residence data. Pure client fixtures standing in for the /api/v1
 * responses the app will consume once wired to the backend (apps/mobile is a
 * pure client per the architecture). Values mirror the design-system rentals
 * screens. Hospitality-demand fixtures live alongside in `./stays`.
 */
import type { Domain } from '@/components/domain-badge';
import { ME } from './personas';

export type RentState = 'paid' | 'due' | 'overdue';
export type LeaseState = 'active' | 'ending' | 'pending_signature' | 'draft' | 'ended';

/**
 * How a rent period settled. MTN MoMo leads because it is the rail that
 * answers first in Rwanda; card is last because it is the one that carries a
 * fee (frame R12's sheet draws them in this order).
 */
export type PayMethod = 'mtn_momo' | 'airtel_money' | 'card';

export interface RentPeriod {
  month: string;
  amount: number;
  status: RentState;
  /**
   * `YYYY-MM-DD`. The day the charge falls due. Optional because the landlord
   * rent roll never draws it — frame R12's "Due Aug 01, 2026 - 4 weeks" is the
   * only place it is read, and only the tenant seat carries one.
   */
  dueOn?: string;
  /** `YYYY-MM-DD`. Set on a settled period, and only on one. */
  paidOn?: string;
  /** Which rail settled it. Present whenever `paidOn` is. */
  method?: PayMethod;
  /**
   * Settled by the mock adapter rather than by a rail (FL28 §6, "mocked
   * settlements labelled"). The label is not decoration: a period stamped
   * `mock` is money that did not move, and every screen that draws one says so.
   */
  mock?: boolean;
}

export interface Lease {
  id: string;
  tenant: string;
  property: string;
  rent: number;
  caution: number;
  rentStatus: RentState;
  leaseState: LeaseState;
  startDate: string;
  endDate: string;
  collectedToDate: number;
  schedule: RentPeriod[];
  filing: 'filed' | 'pending' | 'failed';
  tax: 'compliant' | 'due' | 'overdue';
  /** One stem: a rent-roll row draws a thumbnail, never a gallery. */
  photo: string;
}

export const LEASES: Lease[] = [
  {
    id: 'grace-mukamana',
    tenant: 'Grace Mukamana',
    property: 'Nyamirambo Flat 1',
    rent: 450000,
    caution: 900000,
    rentStatus: 'paid',
    leaseState: 'active',
    startDate: '1 Feb 2025',
    endDate: '1 Feb 2027',
    collectedToDate: 2700000,
    filing: 'filed',
    tax: 'compliant',
    photo: 'kigali-city-street-01',
    schedule: [
      { month: 'July 2026', amount: 450000, status: 'paid' },
      { month: 'August 2026', amount: 450000, status: 'due' },
      { month: 'September 2026', amount: 450000, status: 'due' },
    ],
  },
  {
    id: 'patrick-habiyaremye',
    tenant: 'Patrick Habiyaremye',
    property: 'Remera Apartment',
    rent: 380000,
    caution: 760000,
    rentStatus: 'due',
    leaseState: 'active',
    startDate: '15 Mar 2025',
    endDate: '15 Mar 2027',
    collectedToDate: 5320000,
    filing: 'filed',
    tax: 'compliant',
    photo: 'kigali-cbd-buildings-01',
    schedule: [
      { month: 'July 2026', amount: 380000, status: 'due' },
      { month: 'August 2026', amount: 380000, status: 'due' },
    ],
  },
  {
    id: 'claudine-ingabire',
    tenant: 'Claudine Ingabire',
    property: 'Gisozi Townhouse',
    rent: 620000,
    caution: 1240000,
    rentStatus: 'overdue',
    leaseState: 'active',
    startDate: '1 Jun 2025',
    endDate: '1 Jun 2027',
    collectedToDate: 4340000,
    filing: 'filed',
    tax: 'due',
    photo: 'kigali-hills-view-01',
    schedule: [
      { month: 'June 2026', amount: 620000, status: 'overdue' },
      { month: 'July 2026', amount: 620000, status: 'due' },
    ],
  },
  {
    id: 'yves-manzi',
    tenant: 'Yves Manzi',
    property: 'Kacyiru Studio',
    rent: 300000,
    caution: 600000,
    rentStatus: 'paid',
    leaseState: 'ending',
    startDate: '1 Aug 2024',
    endDate: '31 Aug 2026',
    collectedToDate: 7200000,
    filing: 'filed',
    tax: 'compliant',
    photo: 'kigali-skyline-01',
    schedule: [
      { month: 'July 2026', amount: 300000, status: 'paid' },
      { month: 'August 2026', amount: 300000, status: 'due' },
    ],
  },
  {
    id: 'diane-uwera',
    tenant: 'Diane Uwera',
    property: 'Kimironko Flat 3',
    rent: 410000,
    caution: 820000,
    rentStatus: 'paid',
    leaseState: 'pending_signature',
    startDate: '1 Aug 2026',
    endDate: '1 Aug 2028',
    collectedToDate: 0,
    filing: 'pending',
    tax: 'compliant',
    photo: 'kigali-parliament-aerial-01',
    schedule: [{ month: 'August 2026', amount: 410000, status: 'due' }],
  },
];

export function getLease(id: string): Lease | undefined {
  return LEASES.find((l) => l.id === id);
}

/**
 * The photographs one unit or stay draws, as file stems into `./photos`.
 *
 * Stems rather than resolved assets, so a fixture stays plain data and the
 * `require()` graph lives in one generated file. Every stem here has a licence
 * row in `./photo-credits` — the importer walks the manifest, so a stem with no
 * row cannot exist — and 22 of the 25 are stand-ins that owe a VISIBLE credit
 * wherever they are drawn (ADR-015 call 5). `PhotoCredit` draws it; a screen
 * that renders one of these without it is a defect, not a style choice.
 */
export interface PhotoSet {
  /** The hero, and the tile image. */
  cover: string;
  /** Four more, in the order the gallery pages them. */
  gallery: [string, string, string, string];
  /** The small image a list row draws. Often the cover; not always. */
  thumbnail: string;
}

/**
 * A listing tile, either domain — Residence units in the Broker Directory and
 * Hospitality stays in Explore share this shape so `listing/[id]` renders both.
 * `agent` is the broker (Residence) or the host (Hospitality).
 */
export interface DirectoryListing {
  id: string;
  title: string;
  location: string;
  domain?: Domain;
  price: number;
  per: string;
  rating: number;
  reviews: number;
  meta: string[];
  agent: string;
  description: string;
  photos: PhotoSet;
}

export const DIRECTORY: DirectoryListing[] = [
  {
    id: 'nyarutarama-villa',
    title: 'Nyarutarama Villa',
    location: 'Nyarutarama, Kigali',
    price: 850000,
    per: 'month',
    rating: 4.9,
    reviews: 34,
    meta: ['4 bed', '3 bath', 'Garden'],
    agent: 'Habimana Realty',
    description:
      'Serviced four-bedroom villa with a walled garden and standby power. 24-month lease, caution held in escrow, contract auto-filed with the tax administration.',
    photos: {
      cover: 'kigali-hills-view-01',
      gallery: ['kigali-cbd-buildings-01', 'kigali-skyline-01', 'kigali-city-street-01', 'kigali-parliament-aerial-01'],
      thumbnail: 'kigali-hills-view-01',
    },
  },
  {
    id: 'kimihurura-duplex',
    title: 'Kimihurura Duplex',
    location: 'Kimihurura, Kigali',
    price: 620000,
    per: 'month',
    rating: 4.8,
    reviews: 21,
    meta: ['3 bed', '2 bath', 'Parking'],
    agent: 'Kigali Living',
    description:
      'Modern duplex minutes from the CBD with covered parking and fibre internet. Broker-placed lease with a full placement fee disbursed on signing.',
    photos: {
      cover: 'kigali-cbd-buildings-01',
      gallery: ['kigali-skyline-01', 'kigali-night-panorama-02', 'kigali-hills-view-01', 'kigali-city-street-01'],
      thumbnail: 'kigali-cbd-buildings-01',
    },
  },
  {
    id: 'gikondo-flat',
    title: 'Gikondo Garden Flat',
    location: 'Gikondo, Kigali',
    price: 390000,
    per: 'month',
    rating: 4.6,
    reviews: 48,
    meta: ['2 bed', 'Balcony'],
    agent: 'Umuryango Homes',
    description:
      'Bright two-bedroom flat on a quiet street with a shared garden and on-site caretaker. Ideal for a 12-month tenancy.',
    photos: {
      cover: 'kigali-city-street-01',
      gallery: ['kigali-cbd-buildings-01', 'kigali-parliament-aerial-01', 'kigali-skyline-01', 'kigali-hills-view-01'],
      thumbnail: 'kigali-city-street-01',
    },
  },
];

export function getListing(id: string): DirectoryListing | undefined {
  return DIRECTORY.find((l) => l.id === id);
}

/**
 * The Landlord seat's display strings. The person is `ME` in `./personas`
 * (decision D7 — one identity holds every seat); this is the seat's framing of
 * them, which is what a header renders.
 */
export const WORKSPACE = {
  name: 'Kayitare Court',
  role: 'Landlord',
  user: ME.name,
  email: ME.email,
};

/* ── Tenant side ─────────────────────────────────────────────────────────── */

/**
 * The Personal workspace, as the Tenant wears it. FL25 §9: Guest and Tenant are
 * one Personal workspace, not two contexts — so this is the same identity
 * `stays.GUEST` carries, and only the role label moves with the active domain.
 * `WORKSPACE` above is the same person's *Business* workspace.
 */
export const TENANT = {
  name: 'Personal',
  role: 'Tenant',
  user: ME.name,
  email: ME.email,
};

export type CautionState = 'held' | 'refunded' | 'forfeited';

export interface TenancyDocument {
  label: string;
  meta: string;
}

/**
 * The chip frames R11 and R15 draw beside the unit name. Residence leases in
 * this build are all long-term; the short-term row exists because the same
 * aggregate carries a furnished monthly let, and a chip with one possible
 * value is a chip that will be wrong the first time a second one appears.
 */
export type Tenure = 'long_term' | 'short_term';

/**
 * One entry in the tenant's visitor log (F-R14, frame R19).
 *
 * The log belongs to the LEASE and to the tenant on it. F-R14 §6 is explicit
 * that the landlord has no standing read access and must request it, and that
 * the request is recorded; oversight reads it through the management console.
 * That is why this hangs off `Tenancy` rather than off the person: an ended
 * lease's log becomes read-only history rather than following the tenant to
 * their next unit.
 */
export interface VisitorEntry {
  id: string;
  name: string;
  relation: 'family' | 'guest' | 'work' | 'other';
  /** Frame R19's "overnight" / "day visit". */
  stay: 'overnight' | 'day';
  /** `YYYY-MM-DD`. */
  arrivedOn: string;
  /**
   * `YYYY-MM-DD`, absent while the visitor is still in the unit. F-R14 §8
   * flags exactly that case, and the list draws it rather than guessing a
   * departure that was never recorded.
   */
  leftOn?: string;
}

/** A filed move-out notice (FL23). Its presence is what puts a Lease in `ending`. */
export interface MoveOutNotice {
  /** `YYYY-MM-DD`. */
  filedOn: string;
  /** `YYYY-MM-DD`. The last day of the tenancy. */
  moveOutOn: string;
  message: string;
}

export type RenewalState = 'pending' | 'approved' | 'rejected';

/**
 * A renewal request (FL26). The rent is carried so the request is legible, and
 * it is NOT editable: FL26 §6 and F-R13 §6 both say a rent change needs a new
 * Lease, so a renewal that quietly re-priced the tenancy would be the one thing
 * this flow may not do.
 */
export interface RenewalRequest {
  /** `YYYY-MM-DD`. */
  requestedOn: string;
  termMonths: number;
  /** `YYYY-MM-DD`. */
  startOn: string;
  /** `YYYY-MM-DD`. */
  endOn: string;
  rent: number;
  note: string;
  state: RenewalState;
}

/**
 * A Lease read from the tenant's side of it.
 *
 * `Lease` above is the landlord's rent roll — one row per tenant. This is the
 * inverse: one row per unit *I* rent, so the counterparty is the landlord and
 * the money is an obligation rather than a receivable. Same aggregate, opposite
 * seat; keeping them as two shapes is what stops a tenant screen from rendering
 * a landlord's name in the tenant slot.
 */
export interface Tenancy {
  id: string;
  /**
   * The reference both parties quote, and frame R15's eyebrow. Separate from
   * `id` on purpose: `id` is the app's handle and is allowed to be a slug, this
   * is what a tenant reads down a phone line to a landlord.
   */
  ref: string;
  unit: string;
  address: string;
  landlord: string;
  landlordOrg: string;
  rent: number;
  caution: number;
  cautionState: CautionState;
  leaseState: LeaseState;
  startDate: string;
  endDate: string;
  /** Rent ledger, newest period first. Empty until the contract is signed. */
  history: RentPeriod[];
  documents: TenancyDocument[];
  filing: 'filed' | 'pending' | 'failed';
  tax: 'compliant' | 'due' | 'overdue';
  /** The clause body of the contract (FL21: term fields are locked, this is not). */
  terms: string[];
  /**
   * The same clauses in Kinyarwanda. Both texts are on the lease record rather
   * than in the message catalogue, because a contract clause is DATA the
   * contract carries and not UI chrome: the catalogue holds what the app says,
   * this holds what the parties signed. The closing clause of every contract
   * here says the two texts are equally authoritative, which is only true if
   * both travel with the record.
   */
  termsRw: string[];
  photos: PhotoSet;

  /* ── Added by Session 7, for frames R11 and R15 to R20 ─────────────────── */

  /** Frames R11 and R15 draw this as a chip beside the state. */
  tenure: Tenure;
  /**
   * The notice this contract asks for, in days. Read off clause 5 of `terms`,
   * which is where a tenant would read it. Frame R17 computes its banner and
   * its earliest selectable date from this, per lease — the 14 days that used
   * to be a module constant were right for one of these four leases and wrong
   * for the other three.
   *
   * FL23 Path A: shown, never enforced. The earliest date is what the calendar
   * offers; a tenant who has to leave sooner still has to be able to say so,
   * so the screen keeps a way past it rather than a hard gate.
   */
  noticeDays: number;
  /** `YYYY-MM-DD`. The machine-readable twin of `startDate`. */
  startOn: string;
  /** `YYYY-MM-DD`. The machine-readable twin of `endDate`. */
  endOn: string;
  /** The visitor log (F-R14). Read-only once the lease has ended. */
  visitors: VisitorEntry[];
  /** `YYYY-MM-DD`, set when the tenant signs (FL21 step 3). */
  signedOn?: string;
  /** Present once a move-out notice is filed (FL23). */
  notice?: MoveOutNotice;
  /** The outstanding or decided renewal request (FL26). */
  renewal?: RenewalRequest;
}

/* ------------------------------------------------ dates relative to today */

/**
 * The running tenancies' dates, relative to the day the module loads.
 *
 * They used to be literals shifted onto one fixed "today" (2026-09-06). The
 * screens compare them with the REAL today — the Rent hero's "due in 4 weeks",
 * Lease detail's due caption, the visitor log's "This month" — so each literal
 * went stale the day after it was written: the log's this-month group emptied,
 * the next charge slid into the past, and a lease drawn as ending in December
 * eventually read as ended. `trips.ts` solved the same problem with
 * `offsetDays`; this is the same idea for a calendar of months.
 *
 * The story each tenancy tells is fixed, only the calendar moves:
 *
 *   - Ingoro A2 is paid up to this month, the next charge falls on the first
 *     of next month, it ends on the last day of the month three months out,
 *     and it has two visitors this month and one last month.
 *   - Nyamirambo Flat 1 owes this month and has ONE overdue charge, last month.
 *   - Kimironko Flat 3 starts on the first of next month, a 24 month term.
 *
 * Local calendar day, as `todayIso()` in `@/components` reads it. Not
 * imported from there: this module is data and must not pull in the kit.
 */
const MONTH_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_SHORT = MONTH_LONG.map((m) => m.slice(0, 3));

const NOW = new Date();

/** `YYYY-MM-DD` for a UTC date built from parts. */
function isoOf(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Day `day` of the month `offset` months from this one. `0` is its last day. */
function monthDay(offset: number, day: number): string {
  // `Date.UTC` rolls day 0 back to the last day of the previous month, which
  // is why the last day is asked for as day 0 of the month after.
  return day === 0
    ? isoOf(new Date(Date.UTC(NOW.getFullYear(), NOW.getMonth() + offset + 1, 0, 12)))
    : isoOf(new Date(Date.UTC(NOW.getFullYear(), NOW.getMonth() + offset, day, 12)));
}

/** Today shifted by `n` days. */
function todayPlus(n: number): string {
  return isoOf(new Date(Date.UTC(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + n, 12)));
}

/** `2026-09-01` → `September 2026`: the ledger's month key. */
function monthLabel(iso: string): string {
  return `${MONTH_LONG[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
}

/** `2026-09-01` → `1 Sep 2026`: the display twin of an `...On` field. */
function shortDay(iso: string): string {
  return `${Number(iso.slice(8, 10))} ${MONTH_SHORT[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
}

/** A ledger period for the month `offset` months from this one. */
function period(
  offset: number,
  amount: number,
  status: RentState,
  paid?: { day: number; method: PayMethod },
): RentPeriod {
  const dueOn = monthDay(offset, 1);
  return {
    month: monthLabel(dueOn),
    amount,
    status,
    dueOn,
    ...(paid ? { paidOn: monthDay(offset, paid.day), method: paid.method } : null),
  };
}

/**
 * A day inside THIS month, `back` days before today where that is still this
 * month, otherwise the first. Keeps a this-month visitor in this month on the
 * 1st and never in the future.
 */
function earlierThisMonth(back: number): string {
  const candidate = todayPlus(-back);
  const first = monthDay(0, 1);
  return candidate < first ? first : candidate;
}

const A2_START = monthDay(-8, 1);
const A2_END = monthDay(3, 0);
const A2_SIGNED = isoOf(new Date(Date.UTC(+A2_START.slice(0, 4), +A2_START.slice(5, 7) - 1, 1 - 14, 12)));
const NYAM_START = monthDay(-19, 1);
const NYAM_END = monthDay(5, 1);
const KIMI_START = monthDay(1, 1);
const KIMI_END = monthDay(25, 1);

export const TENANCIES: Tenancy[] = [
  /**
   * **The lease frames R11, R12 and R15 all draw**: Ingoro Apartments, Unit A2,
   * Kimihurura, RWF 310,000 a month, ending December 2026, thirty days notice.
   * It is first in this array because array order is the fixture's statement
   * about which tenancy is this person's home, and My leases leads with it.
   *
   * It is `active` rather than awaiting signature, which is a change from how
   * Session 1 left it. The frames disagree about this lease: X3 and R16 draw it
   * before signature, R11, R12 and R15 draw it after. Three frames beat one, and
   * the invite has somewhere better to point — see `kimironko-flat-3` below and
   * `src/screens/auth/invite.ts`.
   *
   * The ledger is frame R12's own HISTORY, laid onto today's calendar (see the
   * helpers above TENANCIES) so the hero card reads as the frame draws it: this
   * month is paid and the next charge is the first of next month.
   */
  {
    id: 'ingoro-apartments-a2',
    ref: 'L-0142',
    tenure: 'long_term',
    // Clause 5 of this contract says thirty days, not fourteen. Frame R17's
    // banner reads this number, which is why it is per lease.
    noticeDays: 30,
    startOn: A2_START,
    endOn: A2_END,
    unit: 'Unit A2',
    address: 'KG 9 Ave, Kimihurura, Kigali',
    landlord: 'Jean Bosco Habimana',
    landlordOrg: 'Ingoro Apartments',
    rent: 310000,
    caution: 310000,
    cautionState: 'held',
    leaseState: 'active',
    startDate: shortDay(A2_START),
    endDate: shortDay(A2_END),
    signedOn: A2_SIGNED,
    filing: 'filed',
    tax: 'compliant',
    history: [
      period(1, 310000, 'due'),
      period(0, 310000, 'paid', { day: 1, method: 'mtn_momo' }),
      period(-1, 310000, 'paid', { day: 1, method: 'mtn_momo' }),
      period(-2, 310000, 'paid', { day: 1, method: 'mtn_momo' }),
      period(-3, 310000, 'paid', { day: 2, method: 'mtn_momo' }),
      period(-4, 310000, 'paid', { day: 1, method: 'airtel_money' }),
    ],
    documents: [
      { label: 'Lease contract', meta: `PDF · 229 KB · signed ${shortDay(A2_SIGNED)}` },
      { label: 'Caution receipt', meta: 'PDF · 84 KB' },
    ],
    terms: [
      'The Landlord lets and the Tenant takes the Room described above for the term stated, at the monthly Rent stated, payable in advance on the first day of each month.',
      'The Caution is held in escrow for the duration of the tenancy. It is not rent and may not be set off against rent. It settles at the close of the Lease, less any agreed deduction.',
      'Rent begins on the commencement date and is not prorated for a part month at the start of the term.',
      'The Tenant shall keep the Room in good repair, fair wear and tear excepted, and shall report any defect to the Landlord without delay.',
      'The Tenant shall not sublet the Room, in whole or in part, without the written consent of the Landlord.',
      'Either party may end this Lease by written notice of not less than thirty (30) days. Notice filed in the Injishi tenant portal satisfies this clause.',
      'This Lease is filed with the tax administration within fifteen (15) days of signature. No EBM invoice is emitted for rent.',
      'This Lease is governed by the laws of the Republic of Rwanda. The English and Kinyarwanda texts are equally authoritative.',
    ],
    termsRw: [
      'Nyir’inzu atanga kandi Ukodesha akakira Icyumba cyavuzwe haruguru mu gihe cyavuzwe, ku bukode bw’ukwezi bwavuzwe, bwishyurwa mbere ku munsi wa mbere wa buri kwezi.',
      'Ingwate ibikwa mu bubiko mu gihe cyose cy’ubukode. Si ubukode kandi ntishobora gukurwa ku bukode. Itangwa amasezerano arangiye, hakurwaho ibyumvikanyweho.',
      'Ubukode butangira ku munsi wo gutangira kandi ntibugabanywa ku kwezi kutuzuye mu ntangiriro y’igihe.',
      'Ukodesha agomba kubungabunga Icyumba neza, uretse gusaza gusanzwe, kandi akamenyesha Nyir’inzu ikibazo cyose nta gutinda.',
      'Ukodesha ntashobora gukodesha undi Icyumba, cyose cyangwa igice cyacyo, atabanje guhabwa uruhushya rwanditse na Nyir’inzu.',
      'Buri ruhande rushobora kurangiza aya masezerano rubimenyesheje mu nyandiko nibura mu minsi mirongo itatu (30). Ubutumwa butanzwe muri porogaramu ya Injishi buhagije kuri iyi ngingo.',
      'Aya masezerano yohererezwa ubuyobozi bw’imisoro mu minsi cumi n’itanu (15) nyuma yo gusinya. Nta fagitire ya EBM isohorwa ku bukode.',
      'Aya masezerano ayoborwa n’amategeko ya Repubulika y’u Rwanda. Inyandiko y’Icyongereza n’iy’Ikinyarwanda zifite agaciro kangana.',
    ],
    visitors: [
      {
        id: 'v-a2-3',
        name: 'Marie Keza',
        relation: 'family',
        stay: 'overnight',
        arrivedOn: todayPlus(0),
      },
      {
        id: 'v-a2-2',
        name: 'Patrick Nsengiyumva',
        relation: 'guest',
        stay: 'day',
        arrivedOn: earlierThisMonth(2),
        leftOn: earlierThisMonth(2),
      },
      {
        id: 'v-a2-1',
        name: 'Josiane Mukamana',
        relation: 'family',
        stay: 'overnight',
        arrivedOn: monthDay(-1, 26),
        leftOn: monthDay(-1, 28),
      },
    ],
    photos: {
      cover: 'kigali-hills-view-01',
      gallery: ['kigali-cbd-buildings-01', 'kigali-city-street-01', 'kigali-skyline-01', 'kigali-night-panorama-02'],
      thumbnail: 'kigali-hills-view-01',
    },
  },
  {
    id: 'nyamirambo-flat-1',
    ref: 'L-0118',
    tenure: 'long_term',
    // Clause 5 of `terms` below says fourteen days, and this is that number.
    noticeDays: 14,
    startOn: NYAM_START,
    endOn: NYAM_END,
    unit: 'Nyamirambo Flat 1',
    address: 'KN 8 Ave, Nyamirambo, Kigali',
    landlord: 'Alice Uwase',
    landlordOrg: 'Umuryango Homes',
    rent: 450000,
    caution: 900000,
    cautionState: 'held',
    leaseState: 'active',
    startDate: shortDay(NYAM_START),
    endDate: shortDay(NYAM_END),
    filing: 'filed',
    tax: 'compliant',
    history: [
      period(0, 450000, 'due'),
      // The one overdue charge in the tenant fixtures: last month.
      period(-1, 450000, 'overdue'),
      period(-2, 450000, 'paid', { day: 1, method: 'mtn_momo' }),
      period(-3, 450000, 'paid', { day: 2, method: 'mtn_momo' }),
      period(-4, 450000, 'paid', { day: 1, method: 'airtel_money' }),
      period(-5, 450000, 'paid', { day: 3, method: 'mtn_momo' }),
    ],
    documents: [
      { label: 'Lease contract', meta: `PDF · 244 KB · signed ${shortDay(NYAM_START)}` },
      { label: 'Caution receipt', meta: 'PDF · 88 KB' },
    ],
    terms: [
      'The Landlord lets and the Tenant takes the Room described above for the term stated, at the monthly Rent stated, payable in advance on the first day of each month.',
      'The Caution is held in escrow for the duration of the tenancy. It is not rent and may not be set off against rent. It settles at the close of the Lease, less any agreed deduction.',
      'The Tenant shall keep the Room in good repair, fair wear and tear excepted, and shall report any defect to the Landlord without delay.',
      'The Tenant shall not sublet the Room, in whole or in part, without the written consent of the Landlord.',
      'Either party may end this Lease by written notice of not less than fourteen (14) days. Notice filed in the Injishi tenant portal satisfies this clause.',
      'This Lease is filed with the tax administration within fifteen (15) days of signature. No EBM invoice is emitted for rent.',
      'This Lease is governed by the laws of the Republic of Rwanda. The English and Kinyarwanda texts are equally authoritative.',
    ],
    termsRw: [
      'Nyir’inzu atanga kandi Ukodesha akakira Icyumba cyavuzwe haruguru mu gihe cyavuzwe, ku bukode bw’ukwezi bwavuzwe, bwishyurwa mbere ku munsi wa mbere wa buri kwezi.',
      'Ingwate ibikwa mu bubiko mu gihe cyose cy’ubukode. Si ubukode kandi ntishobora gukurwa ku bukode. Itangwa amasezerano arangiye, hakurwaho ibyumvikanyweho.',
      'Ukodesha agomba kubungabunga Icyumba neza, uretse gusaza gusanzwe, kandi akamenyesha Nyir’inzu ikibazo cyose nta gutinda.',
      'Ukodesha ntashobora gukodesha undi Icyumba, cyose cyangwa igice cyacyo, atabanje guhabwa uruhushya rwanditse na Nyir’inzu.',
      'Buri ruhande rushobora kurangiza aya masezerano rubimenyesheje mu nyandiko nibura mu minsi cumi n’ine (14). Ubutumwa butanzwe muri porogaramu ya Injishi buhagije kuri iyi ngingo.',
      'Aya masezerano yohererezwa ubuyobozi bw’imisoro mu minsi cumi n’itanu (15) nyuma yo gusinya. Nta fagitire ya EBM isohorwa ku bukode.',
      'Aya masezerano ayoborwa n’amategeko ya Repubulika y’u Rwanda. Inyandiko y’Icyongereza n’iy’Ikinyarwanda zifite agaciro kangana.',
    ],
    visitors: [
      {
        id: 'v-nyam-1',
        name: 'Alphonse Rwigema',
        relation: 'work',
        stay: 'day',
        arrivedOn: monthDay(-1, 19),
        leftOn: monthDay(-1, 19),
      },
    ],
    photos: {
      cover: 'kigali-city-street-01',
      gallery: ['kigali-hills-view-01', 'kigali-skyline-01', 'kigali-cbd-buildings-01', 'kigali-parliament-aerial-01'],
      thumbnail: 'kigali-city-street-01',
    },
  },
  /**
   * The lease behind the invite on `(auth)/activate` (frame X3) and the one
   * frame R16 signs.
   *
   * Session 1 pointed the invite at `ingoro-apartments-a2` and its own header
   * flagged the problem with that: decision D7 makes the signed-in person a
   * landlord AT Ingoro Apartments, so the invite had them being offered a
   * tenancy by their own business, and it noted that "it is worth a human
   * deciding whether the invite should come from a fourth org instead". This is
   * that decision, taken the cheaper way — a third org already in the fixtures
   * rather than a fourth invented for it — and it frees A2 to be the active
   * lease frames R11, R12 and R15 draw.
   *
   * `invite.ts` resolves the unit, the org, the rent and the photograph out of
   * this record, so frame X3's card is correct by construction; only the figures
   * differ from the ones drawn on the canvas.
   */
  {
    id: 'kimironko-flat-3',
    ref: 'L-0163',
    tenure: 'long_term',
    noticeDays: 14,
    startOn: KIMI_START,
    endOn: KIMI_END,
    unit: 'Kimironko Flat 3',
    address: 'KG 11 Ave, Kimironko, Kigali',
    landlord: 'Jean Bosco Niyonzima',
    landlordOrg: 'Kigali Living',
    rent: 410000,
    caution: 820000,
    cautionState: 'held',
    leaseState: 'pending_signature',
    startDate: shortDay(KIMI_START),
    endDate: shortDay(KIMI_END),
    filing: 'pending',
    tax: 'compliant',
    history: [],
    documents: [{ label: 'Draft contract', meta: 'PDF · 231 KB · awaiting your signature' }],
    terms: [
      'The Landlord lets and the Tenant takes the Room described above for the term stated, at the monthly Rent stated, payable in advance on the first day of each month.',
      'The Caution is held in escrow for the duration of the tenancy. It is not rent and may not be set off against rent. It settles at the close of the Lease, less any agreed deduction.',
      'Rent begins on the commencement date and is not prorated for a part month at the start of the term.',
      'The Tenant shall keep the Room in good repair, fair wear and tear excepted, and shall report any defect to the Landlord without delay.',
      'The Tenant shall not sublet the Room, in whole or in part, without the written consent of the Landlord.',
      'Either party may end this Lease by written notice of not less than fourteen (14) days. Notice filed in the Injishi tenant portal satisfies this clause.',
      'This Lease is filed with the tax administration within fifteen (15) days of signature. No EBM invoice is emitted for rent.',
      'This Lease is governed by the laws of the Republic of Rwanda. The English and Kinyarwanda texts are equally authoritative.',
    ],
    termsRw: [
      'Nyir’inzu atanga kandi Ukodesha akakira Icyumba cyavuzwe haruguru mu gihe cyavuzwe, ku bukode bw’ukwezi bwavuzwe, bwishyurwa mbere ku munsi wa mbere wa buri kwezi.',
      'Ingwate ibikwa mu bubiko mu gihe cyose cy’ubukode. Si ubukode kandi ntishobora gukurwa ku bukode. Itangwa amasezerano arangiye, hakurwaho ibyumvikanyweho.',
      'Ubukode butangira ku munsi wo gutangira kandi ntibugabanywa ku kwezi kutuzuye mu ntangiriro y’igihe.',
      'Ukodesha agomba kubungabunga Icyumba neza, uretse gusaza gusanzwe, kandi akamenyesha Nyir’inzu ikibazo cyose nta gutinda.',
      'Ukodesha ntashobora gukodesha undi Icyumba, cyose cyangwa igice cyacyo, atabanje guhabwa uruhushya rwanditse na Nyir’inzu.',
      'Buri ruhande rushobora kurangiza aya masezerano rubimenyesheje mu nyandiko nibura mu minsi cumi n’ine (14). Ubutumwa butanzwe muri porogaramu ya Injishi buhagije kuri iyi ngingo.',
      'Aya masezerano yohererezwa ubuyobozi bw’imisoro mu minsi cumi n’itanu (15) nyuma yo gusinya. Nta fagitire ya EBM isohorwa ku bukode.',
      'Aya masezerano ayoborwa n’amategeko ya Repubulika y’u Rwanda. Inyandiko y’Icyongereza n’iy’Ikinyarwanda zifite agaciro kangana.',
    ],
    visitors: [],
    photos: {
      cover: 'kigali-cbd-buildings-01',
      gallery: ['kigali-city-street-01', 'kigali-skyline-01', 'kigali-hills-view-01', 'kigali-night-panorama-02'],
      thumbnail: 'kigali-cbd-buildings-01',
    },
  },
  {
    id: 'gikondo-garden-flat',
    ref: 'L-0074',
    tenure: 'long_term',
    noticeDays: 14,
    startOn: '2023-03-01',
    endOn: '2025-02-28',
    unit: 'Gikondo Garden Flat',
    address: 'KK 15 Rd, Gikondo, Kigali',
    landlord: 'Alice Uwase',
    landlordOrg: 'Umuryango Homes',
    rent: 390000,
    caution: 780000,
    cautionState: 'refunded',
    leaseState: 'ended',
    startDate: '1 Mar 2023',
    endDate: '28 Feb 2025',
    filing: 'filed',
    tax: 'compliant',
    history: [
      {
        month: 'February 2025',
        amount: 390000,
        status: 'paid',
        dueOn: '2025-02-01',
        paidOn: '2025-02-01',
        method: 'mtn_momo',
      },
      {
        month: 'January 2025',
        amount: 390000,
        status: 'paid',
        dueOn: '2025-01-01',
        paidOn: '2025-01-04',
        method: 'mtn_momo',
      },
      {
        month: 'December 2024',
        amount: 390000,
        status: 'paid',
        dueOn: '2024-12-01',
        paidOn: '2024-12-01',
        method: 'airtel_money',
      },
    ],
    documents: [
      { label: 'Lease contract', meta: 'PDF · 238 KB · signed 1 Mar 2023' },
      { label: 'Caution settlement', meta: 'PDF · 76 KB · refunded 7 Mar 2025' },
    ],
    terms: [],
    termsRw: [],
    visitors: [
      {
        id: 'v-gik-1',
        name: 'Emmanuel Rukundo',
        relation: 'work',
        stay: 'day',
        arrivedOn: '2025-01-18',
        leftOn: '2025-01-18',
      },
    ],
    photos: {
      cover: 'kigali-hills-view-01',
      gallery: ['kigali-city-street-01', 'kigali-cbd-buildings-01', 'kigali-skyline-01', 'kigali-parliament-aerial-01'],
      thumbnail: 'kigali-hills-view-01',
    },
  },
  /**
   * The PAST row frame R11 draws: "Kivu Breeze Studios · Unit 4 · ended Dec 2025".
   *
   * A second settled tenancy, and the only one whose Caution was not refunded
   * in full — `forfeited` is a real `CautionState` and a list that never shows
   * one is a list whose worst outcome has never been drawn. Rubavu rather than
   * Kigali, so the past section is not four addresses on the same hill.
   */
  {
    id: 'kivu-breeze-studios-4',
    ref: 'L-0091',
    tenure: 'short_term',
    noticeDays: 14,
    startOn: '2025-04-01',
    endOn: '2025-12-31',
    unit: 'Unit 4',
    address: 'Kivu Breeze Studios, Rubavu',
    landlord: 'Beatha Mukandayisenga',
    landlordOrg: 'Kivu Breeze Studios',
    rent: 240000,
    caution: 240000,
    cautionState: 'forfeited',
    leaseState: 'ended',
    startDate: '1 Apr 2025',
    endDate: '31 Dec 2025',
    filing: 'filed',
    tax: 'compliant',
    history: [
      {
        month: 'December 2025',
        amount: 240000,
        status: 'paid',
        dueOn: '2025-12-01',
        paidOn: '2025-12-01',
        method: 'mtn_momo',
      },
      {
        month: 'November 2025',
        amount: 240000,
        status: 'paid',
        dueOn: '2025-11-01',
        paidOn: '2025-11-02',
        method: 'mtn_momo',
      },
      {
        month: 'October 2025',
        amount: 240000,
        status: 'paid',
        dueOn: '2025-10-01',
        paidOn: '2025-10-01',
        method: 'card',
      },
    ],
    documents: [
      { label: 'Lease contract', meta: 'PDF · 216 KB · signed 1 Apr 2025' },
      { label: 'Caution settlement', meta: 'PDF · 71 KB · settled 14 Jan 2026' },
    ],
    terms: [],
    termsRw: [],
    visitors: [],
    photos: {
      cover: 'lake-kivu-02',
      gallery: ['lake-kivu-01', 'lake-kivu-03', 'karongi-01', 'kigali-hills-view-01'],
      thumbnail: 'lake-kivu-02',
    },
  },
];

export function getTenancy(id: string): Tenancy | undefined {
  return TENANCIES.find((t) => t.id === id);
}

/** FL25 step 1 lists active and past separately; `ended` is the only past state. */
export function isLiveTenancy(t: Tenancy): boolean {
  return t.leaseState !== 'ended';
}

/**
 * The earliest period still owed. `history` is newest first, so the oldest
 * unpaid row is the one the tenant pays next — an overdue August settles before
 * a merely due September.
 */
export function nextDuePeriod(t: Tenancy, settled: readonly string[] = []): RentPeriod | undefined {
  for (let i = t.history.length - 1; i >= 0; i -= 1) {
    const p = t.history[i];
    if (p.status !== 'paid' && !settled.includes(p.month)) return p;
  }
  return undefined;
}

export function paidToDate(t: Tenancy, settled: readonly string[] = []): number {
  return t.history.reduce(
    (sum, p) => (p.status === 'paid' || settled.includes(p.month) ? sum + p.amount : sum),
    0,
  );
}

/**
 * The workspaces this identity can act in (FL16). One login, several seats: a
 * payout as Host, rent as Tenant and a placement fee as Broker never mix.
 *
 * Personal carries no `domain` — it is the one workspace that spans both, so
 * the domain segment in the switcher governs which surface it opens on.
 *
 * `kind` and `surface` were added in Session 0. `type` is the BILLING shape the
 * platform already knew about (personal / business / broker) and is what FL16
 * groups the switcher by; `kind` is the SEAT, which is finer — two `business`
 * rows can be a Landlord and a Housekeeping staff seat, and they open entirely
 * different tab sets. `surface` is that tab set. Keeping both means the
 * switcher's grouping and the shell's tab set stop being the same fact.
 *
 * The rows themselves live in `./personas`, because the person and their seats
 * are one decision (decision D7).
 */
export type WorkspaceKind = 'personal' | 'landlord' | 'broker' | 'staff' | 'host';
export type Surface = 'guest' | 'tenant' | 'landlord' | 'broker' | 'work' | 'host';

export interface WorkspaceEntry {
  id: string;
  type: 'personal' | 'business' | 'broker';
  kind: WorkspaceKind;
  /** The tab set this seat opens. Personal derives it from the domain instead. */
  surface: Surface;
  name: string;
  role: string;
  domain?: Domain;
  note?: string;
  /** The owning group, where the seat is held inside a larger business. */
  org?: string;
  /** Work surface only: the eyebrow every Work screen carries (frames W1-W8). */
  property?: string;
  town?: string;
  /** Registered and reachable, but not offered in the switcher. */
  parked?: boolean;
}
