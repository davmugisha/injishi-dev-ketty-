/**
 * The Landlord seat's fixtures — frames R1 to R10.
 *
 * A NEW file rather than more rows in `./rentals`, for the reason Session 0
 * split the message catalogue: `rentals.ts` is read by the tenant screens
 * (session 7) and the broker Directory (session 9), and three parallel branches
 * appending to the bottom of one fixture file is three conflicts in the same
 * hunk. It is also the honest shape — `Lease` in `rentals.ts` is the OLD
 * landlord row from before the prototype canvas existed, and the frames ask for
 * a different one: a lease reference, a tenure, a caution record, a filing
 * acknowledgement and a broker placement, none of which that type carries.
 *
 * ## Where the numbers come from, and the one place they disagree
 *
 * Frames R1 and R2 and `interactive-state-machine.js` (`SEED_RENT`) are the
 * source. They disagree by one lease and it is worth knowing which way this
 * file went:
 *
 *   - **R1** prints three tiles — collected 1.24M across 4 leases, due 380K
 *     across 2, overdue 120K at 9 days — and a "7 LEASES" line. Those tiles sum
 *     to SEVEN billed leases.
 *   - **R3** prints its chips as All 7 · Active 5 · Ending 1 · Draft 1. A draft
 *     lease bills no rent (FL21: the rent schedule begins when both parties
 *     sign), so R3's seven leases can only bill six.
 *
 * One of the two drawings is off by one. This file keeps **R1's tiles exactly**
 * — they are the figures a reader checks against the money — and pays for it in
 * R3's total: eight leases, of which seven bill. `Active · 5` survives
 * unchanged; `All` reads 8 and `Ending` reads 2. The second ending lease is
 * where the state machine's "Send renewal offer" action goes, which R3 could
 * not place: its own ending lease has a move-out notice filed against it, and
 * offering a renewal to somebody who has given notice is the wrong sentence.
 *
 * Three smaller reconciliations, each deliberate:
 *
 *   - **The month is August 2026**, from `SEED_RENT`'s own dates (Aug 01 to Aug
 *     05, 9 days overdue), not R1's "July 2026" chip. R11 and R12 draw the
 *     tenant's side of the same month as "NEXT DUE Aug 01", so August is the
 *     date the two seats agree on.
 *   - **"Diane I."**, from `SEED_RENT`, not R1/R9's "Diane L.". Same person,
 *     two drawings; the state machine is the later source and the prompt names
 *     it as the behaviour spec.
 *   - **`SEED_RENT`'s overdue row is renamed** from "Samuel K." to "Solange
 *     K.". Decision D7 makes Samuel Kayitare the person holding the phone, and
 *     a rent roll that lists the viewer as nine days late on his own building —
 *     directly under his own workspace chip — is a frame convention leaking
 *     into the product. The initials stay SK so the row draws as it does on the
 *     canvas.
 *
 * ## The building, and the two fees that used to be paid to ourselves
 *
 * This seat's building was `Ingoro Apartments` and is now `Kayitare Court`.
 * `src/data/personas.ts` carries the full reasoning; the short version is that
 * three other files already treated Ingoro as somebody else's business, with a
 * named contact and a phone number, so Ingoro stayed a counterparty and the
 * seat moved. Unit A2's two tenants — Samuel in `rentals.ts`, Eric T. here —
 * were one symptom of that, and they are now two units in two buildings.
 *
 * The same root produced a second problem this file owned outright. A placement
 * fee is money moving between two parties (F-R08), and both placements below
 * named `Aline K.` — which `personas.ts` makes THIS account's broker seat. A
 * broker placing a tenant into a building the same account owns is not earning
 * a fee, it is moving money from one of its own pockets to another, and a
 * reviewer reading frame R6's banner would be reading self-dealing. Both now
 * name a genuine third party.
 *
 * What that costs is worth recording, because it looked like a feature.
 * Sessions 8 and 9 had independently converged: session 9 seeded a live
 * placement of `Claudine U.` into `ingoro-apartments-b2` at a fee of 140,000,
 * and this file's R6 form prefilled `Claudine Uwase` into Unit B2 at a fee of
 * 140,000 — FL19 handing off to FL20, wired end to end by two sessions that
 * never spoke. It was a lovely seam and it was also exactly the loop described
 * above, so it is gone: session 9's Claudine goes to Ingoro through our broker
 * seat, and this form registers a different tenant into our own building
 * through a broker we do not own. R6's figures are unchanged; two names moved.
 */
import { useFixture, type FixtureStatus } from './use-fixture';
import { readFixture, useFixtureValue } from './use-fixture-mutation';
import type { LeaseState, RentState } from './rentals';

/* ─────────────────────────────────────────────────────────── the seat ──── */

/**
 * The eyebrow every landlord list screen carries, as frames R1, R3 and R4 draw
 * it, plus the town the interactive twin adds ("Ingoro Apartments · Kicukiro").
 *
 * The NAME is not duplicated here: it comes off the active workspace row in
 * `./personas`, so a switch cannot leave a screen labelled with the seat the
 * reader just left. Only the town, which no workspace row carries, lives here.
 */
export const LANDLORD_TOWN = 'Kicukiro';

/**
 * The brokerage on the placements below. **Not `Aline K. Brokerage`**, which
 * `personas.ts` makes this account's own broker seat — see the header. A
 * placement fee is money between two parties, so the broker who placed a tenant
 * into our building has to be somebody else.
 */
export const THIRD_PARTY_BROKER = 'Nsengimana Lettings';

/** The month the roll is about. One string, because seven rows quote it. */
export const RENT_PERIOD = 'August 2026';

/* ──────────────────────────────────────────────────────────── the rows ──── */

/** How long a tenancy runs. R6's segmented control, R3's row line. */
export type Tenure = 'long_term' | 'short_term';

/** What a row needs from its landlord, if anything. R3's row actions. */
export type LeaseAction = 'sign' | 'nudge' | 'renew';

export interface CautionRecord {
  amount: number;
  state: 'held' | 'refunded' | 'forfeited';
  /** When it was taken. R9's "collected Jan 12". */
  collectedOn: string;
  /** Set once it settles, so the timeline has a third date to print. */
  settledOn?: string;
  /** What came off it, each with the reason the tenant reads (F-R06 §9). */
  deductions?: { label: string; amount: number }[];
}

export interface FilingRecord {
  state: 'pending' | 'filed' | 'failed';
  /** The RRA acknowledgement. Present only once `filed`. R10's hero. */
  reference?: string;
  /** When both parties signed — the day the 15-day clock starts (FL27). */
  signedOn?: string;
  /** When the job picked it up. */
  queuedOn?: string;
  /** When RRA acknowledged it. */
  filedOn?: string;
  /** Days between signing and filing. The 15-day window, in one number. */
  daysToFile?: number;
  /** Why it failed, printed rather than swallowed (FL27 §6, never-silent). */
  failure?: string;
}

/** A broker placement recorded against a lease. F-R08, FL19, frame R6. */
export interface Placement {
  broker: string;
  fee: number;
}

export interface LandlordLease {
  id: string;
  /** The reference the frames print as an eyebrow: L-0142. */
  ref: string;
  tenant: string;
  initials: string;
  unit: string;
  /** "2-bedroom", "Studio" — what the unit selector and R7 print beside it. */
  unitType: string;
  state: LeaseState;
  tenure: Tenure;
  rent: number;
  /** The term line R3 prints under the name. */
  term: string;
  startDate: string;
  endDate: string;
  /** What this row is waiting on its landlord for, if anything. */
  action?: LeaseAction;
  caution: CautionRecord;
  filing: FilingRecord;
  placement?: Placement;
  /** Periods settled so far. R7's "Rent history · 6 paid". */
  periodsPaid: number;
  /** Set on the lease that has given notice. R9's move-out banner. */
  moveOutNotice?: string;
  /** The landlord's signature timestamp (FL21 `landlordSignedAt`). */
  landlordSignedOn?: string;
  /** The tenant's (FL21 `tenantSignedAt`). */
  tenantSignedOn?: string;
  /**
   * How many clauses the landlord added on top of the bilingual template. R8
   * prints the four template sections itself — they are the same on every
   * lease, so they are copy and belong in the catalogue — and this is the
   * count it prints under them.
   */
  extraClauses: number;
}

/** Eight leases. Five active, two ending, one draft — see the header for why
 *  the counts are not R3's. */
export const LANDLORD_LEASES: LandlordLease[] = [
  {
    id: 'l-0142',
    ref: 'L-0142',
    tenant: 'Eric T.',
    initials: 'ET',
    unit: 'Unit A2',
    unitType: '2-bedroom',
    state: 'active',
    tenure: 'long_term',
    rent: 310000,
    term: 'Jan 2026 – Dec 2026 · signed & filed',
    startDate: 'Jan 2026',
    endDate: 'Dec 2026',
    caution: { amount: 310000, state: 'held', collectedOn: '12 Jan 2026' },
    filing: {
      state: 'filed',
      reference: 'RRA-2026-04412',
      signedOn: '12 Jan 2026',
      queuedOn: '12 Jan 2026',
      filedOn: '14 Jan 2026',
      daysToFile: 2,
    },
    periodsPaid: 6,
    landlordSignedOn: '12 Jan 2026',
    tenantSignedOn: '12 Jan 2026',
    extraClauses: 3,
  },
  {
    id: 'l-0158',
    ref: 'L-0158',
    tenant: 'Grace M.',
    initials: 'GM',
    unit: 'Unit B1',
    unitType: '2-bedroom',
    state: 'active',
    tenure: 'long_term',
    rent: 250000,
    term: 'Mar 2026 – Feb 2027 · signed & filed',
    startDate: 'Mar 2026',
    endDate: 'Feb 2027',
    caution: { amount: 250000, state: 'held', collectedOn: '2 Mar 2026' },
    filing: {
      state: 'filed',
      reference: 'RRA-2026-05188',
      signedOn: '2 Mar 2026',
      queuedOn: '2 Mar 2026',
      filedOn: '5 Mar 2026',
      daysToFile: 3,
    },
    periodsPaid: 5,
    landlordSignedOn: '2 Mar 2026',
    tenantSignedOn: '2 Mar 2026',
    extraClauses: 3,
  },
  {
    id: 'l-0163',
    ref: 'L-0163',
    tenant: 'Chantal M.',
    initials: 'CM',
    unit: 'Unit C2',
    unitType: '3-bedroom',
    state: 'active',
    tenure: 'long_term',
    rent: 380000,
    term: 'Feb 2026 – Jan 2027 · signed & filed',
    startDate: 'Feb 2026',
    endDate: 'Jan 2027',
    caution: { amount: 380000, state: 'held', collectedOn: '1 Feb 2026' },
    filing: {
      state: 'filed',
      reference: 'RRA-2026-04771',
      signedOn: '1 Feb 2026',
      queuedOn: '1 Feb 2026',
      filedOn: '3 Feb 2026',
      daysToFile: 2,
    },
    periodsPaid: 6,
    landlordSignedOn: '1 Feb 2026',
    tenantSignedOn: '1 Feb 2026',
    extraClauses: 3,
  },
  {
    id: 'l-0171',
    ref: 'L-0171',
    tenant: 'Innocent R.',
    initials: 'IR',
    unit: 'Unit A3',
    unitType: '1-bedroom',
    state: 'active',
    tenure: 'short_term',
    rent: 300000,
    term: 'Jun 2026 – Nov 2026 · short-term · signed & filed',
    startDate: 'Jun 2026',
    endDate: 'Nov 2026',
    caution: { amount: 300000, state: 'held', collectedOn: '1 Jun 2026' },
    filing: {
      state: 'filed',
      reference: 'RRA-2026-06904',
      signedOn: '1 Jun 2026',
      queuedOn: '1 Jun 2026',
      filedOn: '4 Jun 2026',
      daysToFile: 3,
    },
    periodsPaid: 2,
    landlordSignedOn: '1 Jun 2026',
    tenantSignedOn: '1 Jun 2026',
    extraClauses: 3,
  },
  {
    id: 'l-0166',
    ref: 'L-0166',
    tenant: 'Solange K.',
    initials: 'SK',
    unit: 'Unit A1',
    unitType: 'Studio',
    state: 'active',
    tenure: 'long_term',
    rent: 120000,
    term: 'May 2026 – Apr 2027 · signed & filed',
    startDate: 'May 2026',
    endDate: 'Apr 2027',
    caution: { amount: 120000, state: 'held', collectedOn: '1 May 2026' },
    filing: {
      state: 'filed',
      reference: 'RRA-2026-06215',
      signedOn: '1 May 2026',
      queuedOn: '1 May 2026',
      filedOn: '6 May 2026',
      daysToFile: 5,
    },
    periodsPaid: 2,
    landlordSignedOn: '1 May 2026',
    tenantSignedOn: '1 May 2026',
    extraClauses: 3,
  },
  {
    id: 'l-0155',
    ref: 'L-0155',
    tenant: 'Yves R.',
    initials: 'YR',
    unit: 'Unit B3',
    unitType: '1-bedroom',
    state: 'ending',
    tenure: 'long_term',
    rent: 190000,
    term: 'Ends in 38 days · renewal not sent',
    startDate: 'Apr 2026',
    endDate: '13 Sep 2026',
    action: 'renew',
    caution: { amount: 190000, state: 'held', collectedOn: '1 Apr 2026' },
    filing: {
      state: 'filed',
      reference: 'RRA-2026-05602',
      signedOn: '1 Apr 2026',
      queuedOn: '1 Apr 2026',
      filedOn: '2 Apr 2026',
      daysToFile: 1,
    },
    periodsPaid: 4,
    landlordSignedOn: '1 Apr 2026',
    tenantSignedOn: '1 Apr 2026',
    extraClauses: 3,
  },
  {
    id: 'l-0129',
    ref: 'L-0129',
    tenant: 'Diane I.',
    initials: 'DI',
    unit: 'Unit C1',
    unitType: '2-bedroom',
    state: 'ending',
    tenure: 'long_term',
    rent: 190000,
    term: 'Move-out notice filed · ends Aug 31',
    startDate: 'Jan 2026',
    endDate: '31 Aug 2026',
    // R9's hero is this lease, and its caution is 280,000 rather than one
    // month's rent. A caution is negotiated, not derived — printing it as a
    // multiple of the rent would be inventing a rule the product does not have.
    caution: { amount: 280000, state: 'held', collectedOn: '12 Jan 2026' },
    filing: {
      state: 'filed',
      reference: 'RRA-2026-04380',
      signedOn: '12 Jan 2026',
      queuedOn: '12 Jan 2026',
      filedOn: '14 Jan 2026',
      daysToFile: 2,
    },
    periodsPaid: 7,
    moveOutNotice: '31 Aug 2026',
    landlordSignedOn: '12 Jan 2026',
    tenantSignedOn: '12 Jan 2026',
    extraClauses: 3,
  },
  {
    id: 'l-0176',
    ref: 'L-0176',
    tenant: 'Josiane N.',
    initials: 'JN',
    unit: 'Unit C3',
    unitType: '2-bedroom',
    state: 'draft',
    tenure: 'long_term',
    rent: 260000,
    term: 'Awaiting your signature · placed by broker',
    startDate: '1 Sep 2026',
    endDate: '31 Aug 2027',
    action: 'sign',
    caution: { amount: 260000, state: 'held', collectedOn: '—' },
    // Nothing files until both parties sign (FL27 step 1), so a draft's filing
    // is `pending` with no clock started rather than a missing record.
    filing: { state: 'pending' },
    placement: { broker: THIRD_PARTY_BROKER, fee: 130000 },
    periodsPaid: 0,
    extraClauses: 3,
  },
];

/* ────────────────────────────────────────────────────── the rent roll ──── */

export interface RentRow {
  /** The lease this line is about, so a row can open its record. */
  leaseId: string;
  initials: string;
  name: string;
  unit: string;
  amount: number;
  state: RentState;
  /** The date the chip prints: "Paid Aug 01", "Due · Aug 05". */
  on?: string;
  /** How late, for an overdue row. */
  days?: number;
  /**
   * Recorded through the mock adapter in this session rather than settled.
   * The row prints "Paid · mock" and the toast says the same, because a mocked
   * success must never look like a real one (design brief §4.3).
   */
  mock?: boolean;
  /**
   * `YYYY-MM-DD`, the first of the month this charge covers. Set only on a row
   * read from the API, because `POST /ops/leases/:id/rent` has to name the
   * month it settles; the fixture rows all belong to `RENT_PERIOD`.
   */
  periodMonth?: string;
  /** What has already been recorded against this month, in RWF. API rows only. */
  paidAmount?: number;
}

/**
 * One line per BILLING lease — the five active ones plus the two ending. A
 * draft bills nothing, so `l-0176` is absent and the roll's count line reads
 * seven where the Leases tab reads eight. That gap is the product being honest
 * about what a draft is, not a bug.
 */
export const RENT_ROLL: RentRow[] = [
  { leaseId: 'l-0142', initials: 'ET', name: 'Eric T.', unit: 'A2', amount: 310000, state: 'paid', on: 'Aug 01' },
  { leaseId: 'l-0158', initials: 'GM', name: 'Grace M.', unit: 'B1', amount: 250000, state: 'paid', on: 'Aug 02' },
  { leaseId: 'l-0163', initials: 'CM', name: 'Chantal M.', unit: 'C2', amount: 380000, state: 'paid', on: 'Aug 01' },
  { leaseId: 'l-0171', initials: 'IR', name: 'Innocent R.', unit: 'A3', amount: 300000, state: 'paid', on: 'Aug 03' },
  { leaseId: 'l-0155', initials: 'YR', name: 'Yves R.', unit: 'B3', amount: 190000, state: 'due', on: 'Aug 05' },
  { leaseId: 'l-0129', initials: 'DI', name: 'Diane I.', unit: 'C1', amount: 190000, state: 'due', on: 'Aug 05' },
  { leaseId: 'l-0166', initials: 'SK', name: 'Solange K.', unit: 'A1', amount: 120000, state: 'overdue', days: 9 },
];

export interface RentTotals {
  collected: number;
  collectedCount: number;
  due: number;
  dueCount: number;
  overdue: number;
  overdueCount: number;
  /** The worst lateness on the roll — R1's "OVERDUE 120K · 9 days". */
  worstDays: number;
  billed: number;
  /** Whole per cent, as R2 prints it. 0 when nothing is billed. */
  percent: number;
}

export function rentTotals(rows: readonly RentRow[]): RentTotals {
  const sum = (s: RentState) =>
    rows.filter((r) => r.state === s).reduce((a, r) => a + r.amount, 0);
  const count = (s: RentState) => rows.filter((r) => r.state === s).length;

  const collected = sum('paid');
  const billed = rows.reduce((a, r) => a + r.amount, 0);

  return {
    collected,
    collectedCount: count('paid'),
    due: sum('due'),
    dueCount: count('due'),
    overdue: sum('overdue'),
    overdueCount: count('overdue'),
    worstDays: rows.reduce((a, r) => Math.max(a, r.days ?? 0), 0),
    billed,
    percent: billed === 0 ? 0 : Math.round((collected / billed) * 100),
  };
}

/**
 * A short money label for a stat tile: 1.24M, 380K, 0. Tiles are narrow and a
 * seven-digit figure wraps in Kinyarwanda, so the tile abbreviates and the
 * collection line under them prints the exact figure through `MoneyAmount`.
 * Both are on the screen, so nothing is only ever seen rounded.
 */
export function shortMoney(value: number): string {
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    return `${m % 1 === 0 ? m.toFixed(0) : m.toFixed(2).replace(/0$/, '')}M`;
  }
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(value);
}

/* ───────────────────────────────────────────────────────────── repairs ──── */

export type RepairSeverity = 'urgent' | 'normal' | 'low';
export type RepairState = 'open' | 'assigned' | 'resolved';

export interface RepairTicket {
  ref: string;
  title: string;
  severity: RepairSeverity;
  /** "Unit C1" or "Common area". */
  unit: string;
  /** Who raised it. A tenant, or the caretaker. */
  reporter: string;
  /** "2 days ago". Relative, because the fixture has no clock. */
  raised: string;
  state: RepairState;
  /**
   * Local `file://` uris, when the ticket was filed on this device through
   * `PhotoPicker` — which is what session 7's frame R20 produces.
   */
  photos?: string[];
  /**
   * How many photographs the reporter attached, for a SEEDED ticket whose
   * pictures are not on this phone. The card draws that many evidence tiles and
   * says where they are, rather than borrowing an unrelated stock photograph:
   * a Rwandan landscape captioned as a leaking tap would be a false statement
   * on the screen, and ADR-015's visible-credit rule does not make it true.
   */
  photoCount?: number;
  /** Who it went to, once assigned. */
  assignee?: string;
  /** The line under an assigned ticket: "Electrician booked · Aug 05". */
  note?: string;
}

export const REPAIRS: RepairTicket[] = [
  {
    ref: 'T-204',
    title: 'Leaking kitchen tap',
    severity: 'urgent',
    unit: 'Unit C1',
    reporter: 'Diane I.',
    raised: '2 days ago',
    state: 'open',
    photoCount: 2,
  },
  {
    ref: 'T-206',
    title: 'Bedroom socket not working',
    severity: 'normal',
    unit: 'Unit A2',
    reporter: 'Eric T.',
    raised: '4 days ago',
    state: 'assigned',
    assignee: 'Innocent M.',
    note: 'Electrician booked · Aug 05',
    photoCount: 1,
  },
  {
    ref: 'T-201',
    title: 'Corridor light out',
    severity: 'normal',
    unit: 'Common area',
    reporter: 'Yves R.',
    raised: '5 days ago',
    state: 'open',
  },
  {
    ref: 'T-207',
    title: 'Repaint hallway',
    severity: 'low',
    unit: 'Common area',
    reporter: 'Caretaker',
    raised: '1 week ago',
    state: 'open',
  },
  {
    ref: 'T-198',
    title: 'Gate motor jammed',
    severity: 'normal',
    unit: 'Common area',
    reporter: 'Caretaker',
    raised: '12 days ago',
    state: 'resolved',
  },
];

/** Who an unassigned ticket goes to. The twin's own name. */
export const TECHNICIAN = 'Innocent M.';

/* ────────────────────────────────────────────── the broker placement ──── */

/**
 * The placement waiting to become a lease — frame R6's banner, and the reason
 * `lease/new` opens prefilled rather than blank. A landlord who has been sent a
 * tenant by a broker should not retype the tenant.
 *
 * FL19 hands this over from the Broker surface (session 9). Until that wiring
 * exists it is a fixture, and it is deliberately ONE: R6 draws the banner only
 * when a placement is attached, and the screen has to render both ways.
 */
export interface PendingPlacement {
  broker: string;
  fee: number;
  tenantName: string;
  tenantPhone: string;
  tenantNationalId: string;
  unit: string;
  unitType: string;
  rent: number;
  caution: number;
}

const PLACEMENT_FIXTURE: PendingPlacement = {
  broker: THIRD_PARTY_BROKER,
  fee: 140000,
  // Not `Claudine Uwase`: session 9 seeds a live placement of `Claudine U.`
  // into Ingoro B2 through our own broker seat, and two Claudines going into
  // two different B2s is the collision this whole note is about, recreated.
  tenantName: 'Liliane Mukamurenzi',
  tenantPhone: '788 402 116',
  tenantNationalId: '1199480123456078',
  unit: 'Unit B2',
  unitType: '2-bedroom',
  rent: 280000,
  caution: 280000,
};

/**
 * The placement `lease/new` opens against, or `null` when the landlord came to
 * the form on their own (FL20 path C — "landlord registers a known tenant
 * directly, no broker").
 *
 * A FUNCTION rather than the constant, so the no-broker path is real code that
 * renders rather than a branch nobody can reach: R6 draws the banner only when
 * a placement is attached, and a form that has never been seen blank is a form
 * with an unproven empty state. Session 9 replaces the body with FL19's
 * hand-off; today it always answers with the fixture, and flipping it to `null`
 * is the one-line way to walk the other path.
 */
export function readPendingPlacement(): PendingPlacement | null {
  return PLACEMENT_FIXTURE;
}

/** Units with no live lease on them. R6's unit selector, and F-R03's rule that
 *  a Room holds at most one active Lease — so the selector cannot offer one. */
export const VACANT_UNITS: { unit: string; unitType: string }[] = [
  { unit: 'Unit B2', unitType: '2-bedroom' },
  { unit: 'Unit C4', unitType: '1-bedroom' },
  { unit: 'Unit A4', unitType: 'Studio' },
];

/* ─────────────────────────────────────────────── keys, writes, reads ──── */

/**
 * The three fixture keys. Exported because a write from ANOTHER surface lands
 * on one of them: session 7's frame R20 files a maintenance ticket from the
 * tenant seat, and frame R4 says it appears here. Two screens writing the same
 * list through two different keys is two lists.
 */
export const RENT_ROLL_KEY = 'landlord.rent-roll';
export const LEASES_KEY = 'landlord.leases';
export const REPAIRS_KEY = 'landlord.repairs';

export const seedRentRoll = (): RentRow[] => RENT_ROLL.map((r) => ({ ...r }));
export const seedLeases = (): LandlordLease[] => LANDLORD_LEASES.map((l) => ({ ...l }));
export const seedRepairs = (): RepairTicket[] => REPAIRS.map((r) => ({ ...r }));

/** Marking a month collected through the mock adapter. Frame R1's sheet. */
export function applyRecordPayment(
  rows: RentRow[],
  input: { leaseId: string; on: string },
): RentRow[] {
  return rows.map((r) =>
    r.leaseId === input.leaseId
      ? { ...r, state: 'paid' as const, on: input.on, days: undefined, mock: true }
      : r,
  );
}

/** Assigning a ticket to a technician. Frame R4. */
export function applyAssign(
  tickets: RepairTicket[],
  input: { ref: string; assignee: string },
): RepairTicket[] {
  return tickets.map((k) =>
    k.ref === input.ref
      ? { ...k, state: 'assigned' as const, assignee: input.assignee }
      : k,
  );
}

/** The landlord's signature. Frame R8: draft → pending_signature (FL21 step 2). */
export function applyLandlordSignature(
  leases: LandlordLease[],
  input: { id: string; on: string },
): LandlordLease[] {
  return leases.map((l) =>
    l.id === input.id
      ? {
          ...l,
          state: 'pending_signature' as const,
          landlordSignedOn: input.on,
          action: 'nudge' as const,
          term: 'You signed today · the tenant has not',
        }
      : l,
  );
}

/** Settling the caution. Frame R9, FL24: `held → refunded | forfeited`. */
export function applyCautionSettlement(
  leases: LandlordLease[],
  input: { id: string; on: string; deduction?: { label: string; amount: number } },
): LandlordLease[] {
  return leases.map((l) => {
    if (l.id !== input.id) return l;
    const deduction = input.deduction;
    return {
      ...l,
      caution: {
        ...l.caution,
        // A partial deduction is a forfeiture of that part; a clean return is a
        // refund. FL24 has no third word for "mostly refunded".
        state: deduction && deduction.amount > 0 ? ('forfeited' as const) : ('refunded' as const),
        settledOn: input.on,
        deductions: deduction ? [deduction] : undefined,
      },
    };
  });
}

/** Registering a tenant. Frame R6, FL20: a new lease enters as a `draft`. */
export interface NewLeaseInput {
  tenant: string;
  unit: string;
  unitType: string;
  rent: number;
  caution: number;
  tenure: Tenure;
  placement?: Placement;
}

/** The id and reference a newly created lease takes. Deterministic on the list
 *  length so the route that follows the create can address it. */
export function nextLeaseRef(leases: readonly LandlordLease[]): { id: string; ref: string } {
  const n = 181 + leases.length;
  return { id: `l-0${n}`, ref: `L-0${n}` };
}

export function applyCreateLease(
  leases: LandlordLease[],
  input: NewLeaseInput,
): LandlordLease[] {
  const { id, ref } = nextLeaseRef(leases);
  const parts = input.tenant.trim().split(/\s+/);
  const initials = ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();

  return [
    {
      id,
      ref,
      tenant: input.tenant.trim(),
      initials,
      unit: input.unit,
      unitType: input.unitType,
      state: 'draft',
      tenure: input.tenure,
      rent: input.rent,
      term: 'Awaiting your signature',
      startDate: '1 Sep 2026',
      endDate: input.tenure === 'long_term' ? '31 Aug 2027' : '28 Feb 2027',
      action: 'sign',
      caution: { amount: input.caution, state: 'held', collectedOn: '—' },
      filing: { state: 'pending' },
      placement: input.placement,
      periodsPaid: 0,
      extraClauses: 0,
    },
    ...leases,
  ];
}

/**
 * Filing a maintenance ticket. **Session 7 calls this**, from frame R20, so a
 * fault the tenant reports lands on the landlord's Repairs tab:
 *
 * ```ts
 * const file = useFixtureMutation(REPAIRS_KEY, applyFileRepair, seedRepairs);
 * void file.mutate({ title, unit, reporter, severity, photos });
 * ```
 *
 * The reference is generated here rather than by the caller, so two surfaces
 * cannot mint the same one.
 */
export interface NewRepairInput {
  title: string;
  unit: string;
  reporter: string;
  severity: RepairSeverity;
  photos?: string[];
}

export function applyFileRepair(
  tickets: RepairTicket[],
  input: NewRepairInput,
): RepairTicket[] {
  const highest = tickets.reduce((a, k) => {
    const n = Number.parseInt(k.ref.replace(/\D/g, ''), 10);
    return Number.isNaN(n) ? a : Math.max(a, n);
  }, 207);

  return [
    {
      ref: `T-${highest + 1}`,
      title: input.title,
      severity: input.severity,
      unit: input.unit,
      reporter: input.reporter,
      raised: 'just now',
      state: 'open',
      photos: input.photos,
    },
    ...tickets,
  ];
}

/* ────────────────────────────────────────────────────────── the reads ──── */

export interface LandlordRead<T> {
  status: FixtureStatus;
  data: T | undefined;
  error: Error | undefined;
  retry: () => void;
}

/**
 * The read every landlord list does, and the reason it is one helper rather
 * than four copies.
 *
 * `useFixture` owns the loading, error and retry a list owes its reader, but it
 * calls `read()` once and never hears about a later write. `useFixtureValue`
 * hears every write but has no loading state, because an override is already in
 * memory. A screen needs both halves: a skeleton on the cold read, and a
 * re-render when a sheet on top of it records a payment.
 *
 * Composing them here means a screen still branches on one `status`, and the
 * swap to `useQuery` in Phase 3 is a change in this function rather than in
 * four screens.
 */
export function useLandlordRead<T>(key: string, seed: () => T): LandlordRead<T> {
  const read = useFixture(key, () => readFixture(key, seed()));
  const live = useFixtureValue(key, seed);
  return {
    status: read.status,
    // Only once the read has settled: handing back the live value while the
    // skeleton is up would draw rows underneath it.
    data: read.status === 'ready' ? live : undefined,
    error: read.error,
    retry: read.retry,
  };
}

export function findLease(leases: readonly LandlordLease[], id: string): LandlordLease | undefined {
  return leases.find((l) => l.id === id || l.ref.toLowerCase() === id.toLowerCase());
}
