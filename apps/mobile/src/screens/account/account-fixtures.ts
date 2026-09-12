/**
 * What Account reads, per seat.
 *
 * The frames give the row sets (R5 Landlord, R14 Tenant, B25 Broker, W7 Work,
 * Guest artboard 12) but they name a different person on each surface. Under
 * decision D7 one account holds every seat, so the identity is `ME` from
 * `data/personas.ts` everywhere and **only the role line and the verification
 * badge move**. That is not a simplification of the frames, it is the product
 * rule they were drawn before: a Workspace is the context a User acts within,
 * so a landlord seat's TIN and a broker seat's licence belong to the SEAT, and
 * the person is the same person in both.
 *
 * Everything here is typed and seeded rather than inlined into a screen, per
 * decision D9, so the swap to a real read later is a hook change per screen and
 * not a rewrite of the surface.
 *
 * ## The verification badge is per seat and it is the frames' own
 *
 * R5 draws "⊙ TIN verified" on the landlord, B25 draws "⊙ Licensed ·
 * RW-BK-0221" on the broker, R14 draws a plain "Personal workspace" chip on the
 * tenant, and the Guest artboard draws "Verified". Four different claims about
 * four different things, and collapsing them into one "Verified" badge would
 * say the platform had checked something it had not. `tone` carries whether the
 * claim is a check the platform performed (`success`) or a statement of which
 * workspace you are in (`neutral`), because the two must not read alike.
 */
import type { Surface } from '@/data/rentals';
import type { MessageKey } from '@/i18n/i18n';

/* ------------------------------------------------------------- the identity */

export interface SeatIdentity {
  /** The line under the name: "Landlord · Kayitare Court". */
  roleKey: MessageKey;
  /** What the seat has proved, or which workspace it is. Never both. */
  badgeKey: MessageKey;
  /** `success` is a check the platform ran; `neutral` is a statement of fact. */
  badgeTone: 'success' | 'neutral';
}

export const SEAT_IDENTITY: Record<Surface, SeatIdentity> = {
  guest: { roleKey: 'account.roleGuest', badgeKey: 'account.badgeIdVerified', badgeTone: 'success' },
  tenant: { roleKey: 'account.roleTenant', badgeKey: 'account.badgePersonal', badgeTone: 'neutral' },
  landlord: {
    roleKey: 'account.roleLandlord',
    badgeKey: 'account.badgeTinVerified',
    badgeTone: 'success',
  },
  broker: {
    roleKey: 'account.roleBroker',
    badgeKey: 'account.badgeLicensed',
    badgeTone: 'success',
  },
  work: { roleKey: 'account.roleWork', badgeKey: 'account.badgeStaffSeat', badgeTone: 'neutral' },
  host: { roleKey: 'account.roleHost', badgeKey: 'account.badgeTinVerified', badgeTone: 'success' },
};

/** B25's "Licensed · RW-BK-0221". The number is the frame's own. */
export const BROKER_LICENCE = 'RW-BK-0221';

/* --------------------------------------------------------------- the payout */

/**
 * The payout account, mocked.
 *
 * `ui-rules.md` § Adapter Awareness: every screen showing money renders its
 * adapter mode inline, because a mocked success must never look like a real
 * one. A payout destination is the strongest case for that rule in the app —
 * this is the row a landlord would check before believing rent had arrived.
 */
export interface PayoutAccount {
  provider: 'mtn_momo' | 'airtel_money' | 'bank';
  /** The last four digits, which is all a payout row may ever print. */
  tail: string;
  holder: string;
  /** ISO day the destination was last changed. */
  verifiedOn: string;
  /** Every payout in this build is stamped rather than settled. */
  adapter: 'mock' | 'live';
  /** What is waiting, in RWF, and when it is released. */
  pendingRwf: number;
  releasesOn: string;
  /** F-B12's dispute buffer, in days. */
  bufferDays: number;
}

export const PAYOUT_ACCOUNT: PayoutAccount = {
  provider: 'mtn_momo',
  tail: '0822',
  holder: 'Samuel Kayitare',
  verifiedOn: '2026-07-14',
  adapter: 'mock',
  pendingRwf: 486000,
  releasesOn: '2026-09-12',
  bufferDays: 3,
};

/* --------------------------------------------------------- the organisation */

export interface Organisation {
  legalName: string;
  tradingName: string;
  /** Rwanda Revenue Authority taxpayer number. Nine digits. */
  tin: string;
  tinVerifiedOn: string;
  district: string;
  sector: string;
  contactPhone: string;
  contactEmail: string;
  /** Which RRA regime the org files under; drives the filing screen's copy. */
  regime: 'real' | 'flat';
}

/**
 * Read off the active workspace where the name is concerned — a seat moved to a
 * second building has to show that building — so `useOrganisation()` overlays
 * `workspace.name` onto this rather than this hardcoding it.
 */
export const ORGANISATION: Organisation = {
  legalName: 'Kayitare Court Ltd',
  tradingName: 'Kayitare Court',
  tin: '104 738 291',
  tinVerifiedOn: '2026-05-02',
  district: 'Kicukiro',
  sector: 'Niboye',
  contactPhone: '+250 788 431 209',
  contactEmail: 'office@kayitarecourt.rw',
  regime: 'real',
};

/* ----------------------------------------------------------------- the team */

export type StaffState = 'active' | 'invited' | 'suspended';

export interface StaffMember {
  id: string;
  name: string;
  /** The org role, which is what decides permissions (ADR-012). */
  roleKey: MessageKey;
  state: StaffState;
  /** ISO day: joined, or invited. */
  since: string;
  /** Only an invited row has one, and it is what "Resend" resends. */
  phone?: string;
}

/**
 * Four rows so the list has every state on it at once: two working, one waiting
 * on an invitation, one revoked. A list that only ever shows its happy state is
 * a list whose other states nobody has looked at.
 */
export const STAFF: StaffMember[] = [
  { id: 'st-1', name: 'Solange Uwimana', roleKey: 'staff.roleManager', state: 'active', since: '2025-11-03' },
  { id: 'st-2', name: 'Jean Bosco Habimana', roleKey: 'staff.roleCaretaker', state: 'active', since: '2026-02-17' },
  {
    id: 'st-3',
    name: 'Claudine Uwase',
    roleKey: 'staff.roleAccounts',
    state: 'invited',
    since: '2026-09-01',
    phone: '+250 788 512 447',
  },
  { id: 'st-4', name: 'Patrick Nsengiyumva', roleKey: 'staff.roleCaretaker', state: 'suspended', since: '2025-08-21' },
];

export const STAFF_KEY = 'account.staff';

/* --------------------------------------------------------- the subscription */

export type PlanId = 'starter' | 'growth' | 'pro';

export interface Subscription {
  plan: PlanId;
  /** RWF per month, mocked like every other amount in the prototype. */
  priceRwf: number;
  renewsOn: string;
  /** What the plan actually allows, as keys — every printed string owes an RW twin. */
  includes: MessageKey[];
  /** The next plan up, so the screen can say what changing would buy. */
  nextPlan?: PlanId;
}

/**
 * R5 draws the landlord on "Growth" and B25 draws the broker on "Pro", so the
 * plan is per seat rather than per account — which is also the product rule:
 * a subscription belongs to a workspace, and one person may hold two.
 */
export const SUBSCRIPTION: Record<'landlord' | 'broker' | 'host', Subscription> = {
  landlord: {
    plan: 'growth',
    priceRwf: 45000,
    renewsOn: '2026-10-01',
    includes: ['plan.units50', 'plan.eSign', 'plan.rraFiling', 'plan.twoStaff'],
    nextPlan: 'pro',
  },
  broker: {
    plan: 'pro',
    priceRwf: 60000,
    renewsOn: '2026-09-28',
    includes: ['plan.unlimitedReveals', 'plan.placementLedger', 'plan.payoutWeekly', 'plan.priority'],
  },
  host: {
    plan: 'starter',
    priceRwf: 25000,
    renewsOn: '2026-10-11',
    includes: ['plan.rooms10', 'plan.selfCheckIn', 'plan.ebm', 'plan.oneStaff'],
    nextPlan: 'growth',
  },
};

/* ------------------------------------------------------------- the security */

export interface DeviceSession {
  id: string;
  label: string;
  place: string;
  /** ISO day of the last activity on it. */
  lastSeen: string;
  /** The one this app is running on. It cannot be revoked from here. */
  current: boolean;
}

/**
 * F-S12 §6 asks for an active-sessions list and "sign out everywhere", and §9
 * names the case it exists for: a stolen token. So the list is not decoration —
 * it is the only place a person can see a device they do not recognise, which
 * is why the second row is deliberately one they might not.
 */
export const SESSIONS: DeviceSession[] = [
  {
    id: 'dev-1',
    label: 'iPhone 13 · Injishi',
    place: 'Kigali, RW',
    lastSeen: '2026-09-07',
    current: true,
  },
  { id: 'dev-2', label: 'Chrome · Windows', place: 'Kigali, RW', lastSeen: '2026-09-05', current: false },
  { id: 'dev-3', label: 'Chrome · Android', place: 'Rubavu, RW', lastSeen: '2026-08-22', current: false },
];

export const SESSIONS_KEY = 'account.sessions';
export const TWO_FACTOR_KEY = 'account.twoFactor';

/** F-S12 §8: 2FA is off or on, and the frames all draw it on. */
export const TWO_FACTOR_SEED = true;

/* ------------------------------------------------------ the personal details */

export interface PersonalDetails {
  displayName: string;
  phone: string;
  email: string;
  /**
   * F-S01: the system is passwordless, so a "linked method" is a way in rather
   * than a credential. The Account page lists them because F-S12 §6 says to.
   */
  methods: { id: 'phone' | 'google'; linked: boolean }[];
  /**
   * F-S12 §6: "Email never on public profile; reviews show first name + last
   * initial only." The screen prints what a stranger would see, because a rule
   * nobody can check is a rule nobody believes.
   */
  publicName: string;
}

export const PERSONAL_KEY = 'account.personal';
