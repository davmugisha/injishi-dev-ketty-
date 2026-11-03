import type {
  OversightDocumentList,
  PsfBusinessDetail,
  PsfClaimsPage,
  PsfRegistrationProfile,
} from "@injishi/contracts";
import type { SourceContext } from "./types";

/**
 * Live reads for the PSF console (ported from the old operator console, 2026-10-26): the
 * officer's region, the queue of applications waiting on PSF, and one application with its
 * branches. Every read is `GET /api/v1/oversight/psf…`, guarded by a `psf_membership_officer`
 * posting; only a District Manager of its district may decide (`decidesHere`), and a province
 * or national manager reads for reporting.
 *
 * The shapes mirror `@injishi/contracts` (PsfQueuePage, PsfOfficerApplication, PsfOfficerScope),
 * written out here because the app does not depend on the contracts package.
 */

export type PsfScopeLevel = "country" | "province" | "district";

/** GET /api/v1/oversight/psf/scope */
export interface PsfScope {
  level: PsfScopeLevel;
  /** "Kicukiro district", "Kigali City", "Rwanda". */
  label: string;
  title: string;
  provinces: { id: number; name: string; districts: { id: number; name: string; letters: string }[] }[];
}

export type PsfOwnerGroup = "women" | "youth" | "pwd";

/** One row of GET /api/v1/oversight/psf-applications */
export interface PsfQueueItem {
  applicationId: string;
  /** Where it was sent from (2026-11-02): the public PSF form, or Injishi's business registration. */
  origin: "psf_form" | "registration";
  /** New, or a card holder joining the new module (2026-11-02). */
  intake: "new" | "card_holder";
  orgId: string;
  businessName: string;
  businessCode: string | null;
  domain: "hospitality" | "residence" | "enterprise";
  districtName: string | null;
  districtId: number | null;
  associationName: string | null;
  subsectorName: string | null;
  clusterName: string | null;
  ownerGroups: PsfOwnerGroup[];
  requestedTierName: string;
  declaredFeeRwf: number | null;
  paidRwf: number | null;
  submittedAt: string;
  queuedAt: string | null;
  waitingDays: number;
  docId: string | null;
  canDecide: boolean;
  headOfficeInScope: boolean;
  branchesPending: number;
  decidesHere: boolean;
}

export interface PsfQueuePage {
  items: PsfQueueItem[];
  nextCursor: string | null;
  total: number;
}

export type PsfBranchStatus = "pending" | "admitted" | "declined";

export interface PsfApplicationBranch {
  id: string;
  districtId: number;
  districtName: string | null;
  sectorName: string | null;
  street: string;
  status: PsfBranchStatus;
  note: string | null;
  decidedAt: string | null;
  canDecide: boolean;
}

export type PsfDeclineReason = "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised" | "other";

/** GET /api/v1/oversight/psf-applications/:id */
export interface PsfOfficerApplication {
  id: string;
  /** Where it was sent from (2026-11-02): the public PSF form, or Injishi's business registration. */
  origin: "psf_form" | "registration";
  /** New, or a card holder joining the new module (2026-11-02): confirmed with a new number and its card's year. */
  intake: "new" | "card_holder";
  status: "submitted" | "approved" | "member" | "declined" | "withdrawn";
  requestedTierName: string;
  declaredFeeRwf: number | null;
  quotedPriceKind: "fixed" | "range" | "minimum" | "set_by_psf";
  quotedFeeRwf: number | null;
  submittedAt: string;
  queuedAt: string | null;
  decidedAt: string | null;
  declineReason: PsfDeclineReason | null;
  decisionNote: string | null;
  approvedMembershipNumber: string | null;
  approvedFeeRwf: number | null;
  payment: { amountRwf: number; paidAt: string; reference: string | null } | null;
  form: {
    companyName: string;
    registrationType: string;
    registrationNumber: string | null;
    website: string | null;
    streetAddress: string;
    companyType: string;
    ownership: string;
    ownershipOther: string | null;
    businessActivity: string;
    tradeDirection: "none" | "export" | "import" | "both";
    tradeGoods: string | null;
    tradeCountries: string[];
    contactRole: string;
    firstName: string;
    lastName: string;
    phoneE164: string;
    email: string;
  };
  orgId: string;
  businessName: string;
  districtName: string | null;
  profile: {
    businessCode: string | null;
    districtName: string | null;
    clusterName: string | null;
    subsectorName: string | null;
    associationName: string | null;
    ownerGroups: PsfOwnerGroup[];
  };
  canDecide: boolean;
  docId: string | null;
  waitingDays: number;
  suggestedMembershipNumber: string | null;
  paidBeforeReview: boolean;
  headOfficeInScope: boolean;
  branches: PsfApplicationBranch[];
  decidesHere: boolean;
}

export const PSF_DECLINE_REASON_LABEL: Readonly<Record<PsfDeclineReason, string>> = {
  details_incomplete: "Details incomplete",
  not_eligible_for_tier: "Not eligible for this tier",
  business_not_recognised: "Business not recognised",
  other: "Other",
};

export const PSF_BRANCH_STATUS_LABEL: Readonly<Record<PsfBranchStatus, string>> = {
  pending: "Waiting on PSF",
  admitted: "Admitted",
  declined: "Declined",
};

export const PSF_OWNER_GROUP_LABEL: Readonly<Record<PsfOwnerGroup, string>> = {
  women: "Women owned",
  youth: "Youth owned",
  pwd: "Owned by a person with a disability",
};

/** The officer's region: what they cover, and the districts inside it. */
export function readPsfScope(ctx: SourceContext): Promise<PsfScope> {
  return ctx.api.get<PsfScope>("/api/v1/oversight/psf/scope");
}

/** GET /api/v1/oversight/psf/team: the contract's own shape. */
export type PsfTeamView = import("@injishi/contracts").PsfTeamView;

/** The District Managers and BDEs in the officer's districts, and where they may appoint. */
export function readPsfTeam(ctx: SourceContext): Promise<PsfTeamView> {
  return ctx.api.get<PsfTeamView>("/api/v1/oversight/psf/team");
}

/** GET /api/v1/oversight/psf/subsectors: the contract's own shape. */
export type PsfSubsectorsView = import("@injishi/contracts").PsfSubsectorsView;

/** Each sector's subtypes and associations, and the places this officer may add subtypes for. */
export function readPsfSubsectors(ctx: SourceContext): Promise<PsfSubsectorsView> {
  return ctx.api.get<PsfSubsectorsView>("/api/v1/oversight/psf/subsectors");
}

/** GET /api/v1/oversight/psf/fees: the contract's own shape. */
export type PsfOfficerFeesView = import("@injishi/contracts").PsfOfficerFeesView;

/**
 * Each band's price for one district, or PSF's national prices. A district officer always gets their
 * district; a province or national officer gets the district they name, or the national prices.
 */
export function readPsfFees(ctx: SourceContext, district?: number): Promise<PsfOfficerFeesView> {
  return ctx.api.get<PsfOfficerFeesView>(`/api/v1/oversight/psf/fees${district ? `?district=${district}` : ""}`);
}

/** GET /api/v1/oversight/psf/decisions: the contract's own shape. */
export type PsfDecisionsPage = import("@injishi/contracts").PsfDecisionsPage;

/** Every membership the officer's region approved or declined, newest first, searched and narrowed. */
export function readPsfDecisions(
  ctx: SourceContext,
  query: { q?: string; outcome?: "approved" | "declined"; cursor?: string } = {},
): Promise<PsfDecisionsPage> {
  const params = new URLSearchParams();
  if (query.q?.trim()) params.set("q", query.q.trim());
  if (query.outcome) params.set("outcome", query.outcome);
  if (query.cursor) params.set("cursor", query.cursor);
  const qs = params.toString();
  return ctx.api.get<PsfDecisionsPage>(`/api/v1/oversight/psf/decisions${qs ? `?${qs}` : ""}`);
}

/** The queue, newest first, optionally searched (business, code or docID). */
export function readPsfQueue(ctx: SourceContext, query: { q?: string } = {}): Promise<PsfQueuePage> {
  const params = new URLSearchParams();
  if (query.q?.trim()) params.set("q", query.q.trim());
  const qs = params.toString();
  return ctx.api.get<PsfQueuePage>(`/api/v1/oversight/psf-applications${qs ? `?${qs}` : ""}`);
}

/** One application in the officer's region, decided or not; null outside it. */
export async function readPsfApplication(ctx: SourceContext, id: string): Promise<PsfOfficerApplication | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  try {
    return await ctx.api.get<PsfOfficerApplication>(`/api/v1/oversight/psf-applications/${id}`);
  } catch (error) {
    if ((error as { notFound?: boolean }).notFound) return null;
    throw error;
  }
}

/** One count under a heading on the register summary. */
export interface PsfCount {
  key: string;
  label: string;
  count: number;
  letters?: string;
}

/** GET /api/v1/oversight/psf/summary */
export interface PsfRegisterSummary {
  regionLabel: string;
  total: number;
  members: number;
  waiting: number;
  paidThisYearRwf: number;
  /** Members inside their renewal window, 60 days before the end date. */
  renewalDue: number;
  /** Renewals paid this calendar year. */
  renewedThisYear: number;
  /** Applications sent and not paid (2026-11-02). */
  awaitingPayment: number;
  byCluster: PsfCount[];
  byStanding: PsfCount[];
  byGroup: PsfCount[];
  byDistrict: PsfCount[];
}

/** Where a business stands with PSF: the API's own words (applied, awaiting_payment, member, …). */
export type PsfStanding = import("@injishi/contracts").PsfStanding;

/** One row of GET /api/v1/oversight/psf/businesses */
export interface PsfBusinessRow {
  orgId: string;
  businessCode: string | null;
  legalName: string;
  domain: "hospitality" | "residence" | "enterprise";
  districtId: number | null;
  districtName: string | null;
  sectorName: string | null;
  clusterName: string | null;
  subsectorName: string | null;
  associationName: string | null;
  ownerGroups: PsfOwnerGroup[];
  standing: PsfStanding;
  tierName: string | null;
  membershipNumber: string | null;
  /** The current membership's last valid day, yyyy-mm-dd. */
  expiresOn: string | null;
  openApplicationId: string | null;
  paidRwf: number;
  /** When it last paid through Injishi: a fee or a renewal. */
  lastPaidAt: string | null;
  /** The unpaid application, when one waits for its payment (2026-11-02). */
  paymentDue: {
    amountRwf: number | null;
    since: string;
    docId: string | null;
    contactName: string;
    phoneE164: string | null;
    email: string | null;
    lastRemindedAt: string | null;
  } | null;
  branchCount: number;
  headOfficeInScope: boolean;
}

export interface PsfBusinessesPage {
  items: PsfBusinessRow[];
  nextCursor: string | null;
  total: number;
}

export { PSF_STANDING_LABEL } from "@injishi/contracts";

/** What the Businesses screen narrows by (2026-11-02): its standing pills, and sector, tier, place, group, TIN. */
export interface PsfBusinessesFilter {
  q?: string;
  standing?: PsfStanding;
  renewal?: "due";
  payment?: "due";
  cluster?: string;
  tier?: string;
  district?: number;
  group?: PsfOwnerGroup;
  tin?: "with" | "without";
}

/** The register of businesses in the officer's region. */
export function readPsfBusinesses(
  ctx: SourceContext,
  query: PsfBusinessesFilter & { cursor?: string } = {},
): Promise<PsfBusinessesPage> {
  const params = new URLSearchParams();
  if (query.q?.trim()) params.set("q", query.q.trim());
  if (query.standing) params.set("standing", query.standing);
  if (query.renewal) params.set("renewal", query.renewal);
  if (query.payment) params.set("payment", query.payment);
  if (query.cluster) params.set("cluster", query.cluster);
  if (query.tier) params.set("tier", query.tier);
  if (query.district) params.set("district", String(query.district));
  if (query.group) params.set("group", query.group);
  if (query.tin) params.set("tin", query.tin);
  if (query.cursor) params.set("cursor", query.cursor);
  const qs = params.toString();
  return ctx.api.get<PsfBusinessesPage>(`/api/v1/oversight/psf/businesses${qs ? `?${qs}` : ""}`);
}

export function readPsfRegisterSummary(ctx: SourceContext): Promise<PsfRegisterSummary> {
  return ctx.api.get<PsfRegisterSummary>("/api/v1/oversight/psf/summary");
}

/** One KPI against the previous period of the same length. */
export interface PsfKpi {
  value: number;
  previous: number;
}

/** GET /api/v1/oversight/psf/report: the contract's own shape, so a section the API adds reaches here. */
export type PsfReport = import("@injishi/contracts").PsfReport;

/** The officer's region over a period (defaults to the API's last 90 days when omitted). */
export function readPsfReport(ctx: SourceContext, query: { from?: string; to?: string } = {}): Promise<PsfReport> {
  const params = new URLSearchParams();
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  const qs = params.toString();
  return ctx.api.get<PsfReport>(`/api/v1/oversight/psf/report${qs ? `?${qs}` : ""}`);
}

/** A business's side on Injishi (2026-10-30): its decisions, owner and listing, whatever its standing. */
export function readPsfRegistrationProfile(
  ctx: SourceContext,
  orgId: string,
): Promise<PsfRegistrationProfile> {
  return ctx.api.get<PsfRegistrationProfile>(`/api/v1/oversight/psf/registrations/${orgId}`);
}

/** Its PSF side: standing, applications, payments, branches. Null for a business PSF's register does not hold. */
export async function readPsfBusinessDetail(
  ctx: SourceContext,
  orgId: string,
): Promise<PsfBusinessDetail | null> {
  try {
    return await ctx.api.get<PsfBusinessDetail>(`/api/v1/oversight/psf/businesses/${orgId}`);
  } catch {
    return null;
  }
}

/** The documents it registered with, each with a short-lived link to open it. Null when they cannot be read. */
export async function readRegistrationDocuments(
  ctx: SourceContext,
  orgId: string,
): Promise<OversightDocumentList | null> {
  try {
    return await ctx.api.get<OversightDocumentList>(`/api/v1/oversight/registrations/${orgId}/documents`);
  } catch {
    return null;
  }
}

/** Membership numbers businesses typed, in the officer's region (0121), with PSF's list size. */
export function readPsfClaims(
  ctx: SourceContext,
  status?: "claimed" | "confirmed" | "rejected",
): Promise<PsfClaimsPage> {
  return ctx.api.get<PsfClaimsPage>(`/api/v1/oversight/psf/claims${status ? `?status=${status}` : ""}`);
}

/** PSF's tiers, for the confirm form: the active ones, in PSF's order. */
export async function readPsfTiers(ctx: SourceContext): Promise<{ code: string; nameEn: string }[]> {
  const tiers = await ctx.api.get<{ code: string; nameEn: string; active?: boolean }[]>("/api/v1/psf/tiers");
  return tiers.filter((t) => t.active !== false).map((t) => ({ code: t.code, nameEn: t.nameEn }));
}
