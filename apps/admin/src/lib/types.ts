import type { LucideIcon } from "lucide-react";
import type { BadgeProps } from "@injishi/ui";
// Shared domain + identity taxonomy lives in the contracts package (single
// source of truth, mirroring the Postgres enums) — re-exported here so the
// admin never forks a role enum. See dox_context/identity-authz-corrected-spec.md.
import type {
  Domain,
  RdbEntityGroup,
  AccommodationClass,
  RetiredAccommodationClass,
  StoredAccommodationClass,
  ResidenceClass,
  EacStarGrade,
  GlobalRole,
  OrgRole,
  StaffRole,
  OversightRole,
  OversightScopeLevel,
} from "@injishi/contracts";

export type {
  Domain,
  RdbEntityGroup,
  AccommodationClass,
  RetiredAccommodationClass,
  StoredAccommodationClass,
  ResidenceClass,
  EacStarGrade,
  GlobalRole,
  OrgRole,
  StaffRole,
  OversightRole,
  OversightScopeLevel,
};

/* ---------- Staff & shell ---------- */

/**
 * Staff-role lens (admin-prd.md §3) — a way of looking, never an identity.
 *
 * The route guard it used to describe exists now: `SECTION_PERMISSION` in
 * `lib/nav.ts` names the permission each section needs and
 * `components/shell/section-boundary.tsx` refuses a typed URL without it. That
 * guard reads the permissions the SERVER resolved, not this lens.
 *
 * `StaffRole` now comes from `@injishi/contracts` (the `staff_role` Postgres
 * enum: `super_admin | ops | compliance | finance`) so the admin lens and the
 * `admin_users.staff_roles[]` it manages speak the same values.
 */

export type NavKey =
  | "overview"
  | "businesses"
  | "users"
  | "brokers"
  | "finance"
  | "compliance"
  | "audit"
  | "system-health"
  | "configuration"
  | "environments"
  | "moderation"
  | "announcements"
  // ADR-048, pre-launch only. Removed with the section at launch.
  | "waitlist"
  | "analytics"
  | "localization"
  // ADR-049. The only section a NON-platform staff role reaches: `trainer`
  // holds four `training.*` powers and no `admin.*` power at all.
  | "training";

export interface NavItem {
  key: NavKey;
  label: string;
  icon: LucideIcon;
  /** Which staff-role lenses can reach this section ("all" or a role list). */
  roles: "all" | StaffRole[];
  count?: number;
  alert?: boolean;
  chip?: string;
}

export interface NavGroup {
  group: string;
  items: NavItem[];
}

export type DistrictKey =
  | "all"
  | "gasabo"
  | "kicukiro"
  | "nyarugenge"
  | "musanze"
  | "rubavu"
  | "huye"
  | "nyagatare";

/**
 * A status word's colour, spelled in the shared Badge's own variant names
 * (ADR-040), so a presenter's output goes straight into `<Badge variant>`. The
 * console used to have its own five (`primary`, `destructive`, `neutral`),
 * which were the same colours under different names. Only the five status
 * variants are admitted: `light`, `glass` and the rest dress photography.
 */
export type BadgeIntent = Extract<
  NonNullable<BadgeProps["variant"]>,
  "default" | "accent" | "success" | "warning" | "danger"
>;

/* ---------- Overview (F-A02 / F-A09) ---------- */

export interface AdapterStatus {
  name: string;
  state: "up" | "degraded" | "dead-letter";
  mode: "mock" | "live";
  detail: string;
  /** dead-letter cells get the destructive tint + badge */
  deadCount?: number;
}

export interface DistrictDensity {
  key: Exclude<DistrictKey, "all">;
  label: string;
  /** Businesses registered here. The bar is drawn from it, by `BarList`. */
  count: number;
  momBadge?: { text: string; intent: BadgeIntent };
  note?: string;
}

export interface WorkQueueItem {
  count: number;
  countTone?: "destructive";
  title: string;
  detail: string;
  detailTone?: "warning" | "destructive";
  href: string;
}

export interface Kpi {
  label: string;
  value: string;
  note?: string;
  noteBadge?: { text: string; intent: BadgeIntent; icon?: "zap" | "check" };
  empty?: boolean;
}

export interface RevenueLine {
  line: string;
  lineNote?: string;
  amount: string;
  mom: { text: string; intent: BadgeIntent; trendingUp?: boolean };
}

/* ---------- Businesses (F-A03) ---------- */

export interface OrgReviewItem {
  initials: string;
  name: string;
  district: string;
  detail: string;
  badge: { text: string; intent: BadgeIntent; icon?: string };
  action:
    | { kind: "retry-tin" }
    | { kind: "stub"; label: string; stub: string }
    | { kind: "suspend" };
}

export interface OboRegistration {
  org: string;
  district: string;
  agent: string;
  owner: string;
  claim: { text: string; intent: BadgeIntent };
  action: { label: string; variant: "ghost" | "outline" };
}

// RdbEntityGroup, AccommodationClass, ResidenceClass now come from
// @injishi/contracts (imported and re-exported at the top of this file).

export interface OrgRow {
  name: string;
  obo?: boolean;
  type: string;
  tin: string;
  district: string;
  /** Domain from contracts, plus admin-only "mixed" for orgs running both. */
  domain: Domain | "mixed";
  /** Hospitality only — RDB tourism entity group (null-ish for Residence). */
  rdbEntityGroup?: RdbEntityGroup;
  /**
   * Hospitality only — the org's accommodation class.
   *
   * `StoredAccommodationClass`, not `AccommodationClass`: an org registered
   * before D24 still legitimately holds a retired code, and a console that
   * cannot render one is a console that cannot show you your oldest customers.
   */
  accommodationClass?: StoredAccommodationClass;
  /** Residence only — required residence class. */
  residenceClass?: ResidenceClass;
  /** Hospitality only — tourismregulation.rw operating license. */
  tourismLicenseNumber?: string;
  /** Hospitality only — Chamber of Tourism membership (D24, was RHA). */
  chamberOfTourismMember?: boolean;
  /** Hospitality only — optional PSF membership (D24). Not the PSF gov body. */
  psfMember?: boolean;
  /** Hospitality only — EAC star grading; undefined = not yet graded. */
  eacStarGrade?: EacStarGrade;
  state: { text: string; intent: BadgeIntent };
  subscription: { text: string; intent: BadgeIntent };
  action: { label: string; stub: string };
}

/* ---------- Users (F-A04) — the single identity (F-S01) ---------- */

/**
 * KYC posture for the directory. Guests browse/book on email-OTP only
 * (`none`); the moment they elevate (Host/Landlord/staff/OBO/Broker/gov), a
 * `verified_identities` row + ≥1 `identity_documents` is required — see
 * `modules/user/domain/kyc-elevation.ts` (Decision A).
 */
export type KycBadge = "none" | "pending" | "verified";

/** One business-workspace membership: which org, its domain, and the OrgRole. */
export interface OrgMembership {
  org: string;
  /** Host = hospitality owner, Landlord = residence owner — label by domain. */
  domain: Domain;
  orgRole: OrgRole;
  /** OBO-registered orgs keep payout locked until the real owner claims. */
  payoutLocked?: boolean;
}

/**
 * A government oversight grant (Decision B): the stable function, the
 * admin-managed body that assigned it, the government's own free-text title,
 * and the region scope. Drives the SEPARATE government console, never this app.
 */
export interface OversightAssignment {
  role: OversightRole;
  /** `government_bodies` catalog code, e.g. RRA / PSF / MINALOC. */
  bodyCode: string;
  /** Free-text government title, e.g. "BDO", "Business Registration Officer". */
  title: string;
  scopeLevel: OversightScopeLevel;
  /** Province/district label for province|district scope; omit for country. */
  scopeLabel?: string;
}

export interface UserRow {
  name: string;
  email: string;
  emailBadge?: { text: string; intent: BadgeIntent };
  signIn: string[];
  kyc: KycBadge;
  /** Global identity grants held (guest is the implicit default, shown too). */
  globalRoles: GlobalRole[];
  /** Business-workspace memberships (org + domain + OrgRole). */
  memberships: OrgMembership[];
  /** Platform staff roles when this user is also an `admin_users` row. */
  staffRoles?: StaffRole[];
  /** Government oversight grant when `gov_oversight` is held. */
  oversight?: OversightAssignment;
  /** Human-readable workspace summary derived from the above. */
  workspaces: string;
  joined: string;
  actions: ("roles" | "signout" | "assist-2fa")[];
}

export interface UnclaimedStay {
  ref: string;
  title: string;
  meta: string;
  detail: string;
  detailTone?: "destructive";
  action: { kind: "reissue" } | { kind: "stub"; label: string; stub: string };
}

/* ---------- Brokers (F-A05) ---------- */

export interface BrokerRow {
  name: string;
  note: string;
  noteTone?: "warning" | "destructive";
  districts: string;
  status: { text: string; intent: BadgeIntent };
  reveals: string;
  revealsTone?: "destructive";
  placements: string;
  fees: string;
  action:
    | { kind: "suspend" }
    | { kind: "stub"; label: string; stub: string };
  flagged?: boolean;
}

export interface RevealEvent {
  when: string;
  broker: string;
  unit: string;
  district: string;
  outcome: { text: string; intent: BadgeIntent };
}

/* ---------- Finance (F-A06) ---------- */

export interface LedgerEntry {
  id: string;
  primitive: string;
  counterparty: string;
  amount: string;
  state: { text: string; intent: BadgeIntent };
  when: string;
}

export interface StuckPayout {
  ref: string;
  title: string;
  detail: string;
  detailTone?: "warning";
  action:
    | { kind: "override" }
    | { kind: "status"; text: string; intent: BadgeIntent }
    | { kind: "stub"; label: string; stub: string };
}

export interface FailedCharge {
  title: string;
  detail: string;
  detailTone?: "warning";
  badge: { text: string; intent: BadgeIntent };
}

export interface ReconRun {
  id: string;
  window: string;
  entries: number;
  matched: { text: string; intent: BadgeIntent };
  discrepancies: { text: string; intent: BadgeIntent };
}

/* ---------- Secondary sections (shared read-mostly views) ---------- */

export interface SectionStat {
  label: string;
  value: string;
  intent: BadgeIntent;
  note: string;
}

export interface SectionPanel {
  title: string;
  body: string;
  cta: string;
  icon: LucideIcon;
  /** Optional real action; default is a stub toast. */
  action?: "view-as";
}

export interface SectionRow {
  ref: string;
  subject: string;
  context: string;
  state: string;
  intent: BadgeIntent;
}

export interface SectionModel {
  key: NavKey;
  title: string;
  eyebrow: string;
  intro: string;
  icon: LucideIcon;
  primary: { label: string; value: string; note: string; intent: BadgeIntent };
  secondary: SectionStat[];
  panels: SectionPanel[];
  rows: SectionRow[];
}
