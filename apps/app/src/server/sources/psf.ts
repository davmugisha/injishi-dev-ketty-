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
  byCluster: PsfCount[];
  byStanding: PsfCount[];
  byGroup: PsfCount[];
  byDistrict: PsfCount[];
}

export type PsfStanding = "waiting" | "member" | "lapsed" | "declined";

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
  openApplicationId: string | null;
  paidRwf: number;
  branchCount: number;
  headOfficeInScope: boolean;
}

export interface PsfBusinessesPage {
  items: PsfBusinessRow[];
  nextCursor: string | null;
  total: number;
}

export const PSF_STANDING_LABEL: Readonly<Record<PsfStanding, string>> = {
  waiting: "Waiting on PSF",
  member: "Member",
  lapsed: "Lapsed",
  declined: "Declined",
};

/** The register of businesses in the officer's region. */
export function readPsfBusinesses(
  ctx: SourceContext,
  query: { q?: string; standing?: PsfStanding } = {},
): Promise<PsfBusinessesPage> {
  const params = new URLSearchParams();
  if (query.q?.trim()) params.set("q", query.q.trim());
  if (query.standing) params.set("standing", query.standing);
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

/** GET /api/v1/oversight/psf/report */
export interface PsfReport {
  regionLabel: string;
  from: string;
  to: string;
  kpis: {
    registered: PsfKpi;
    applied: PsfKpi;
    approved: PsfKpi;
    declined: PsfKpi;
    newMembers: PsfKpi;
    membershipFeesRwf: PsfKpi;
    medianDecisionDays: { value: number | null; previous: number | null };
  };
  now: {
    members: number;
    waiting: number;
    overdue: number;
    awaitingPayment: number;
    expiringIn30Days: number;
  };
  months: {
    month: string;
    registered: number;
    applied: number;
    approved: number;
    members: number;
    feesRwf: number;
  }[];
  funnel: { registered: number; approved: number; paid: number; declined: number };
  bySector: { key: string; label: string; count: number; amountRwf: number }[];
  byFamily: { key: string; label: string; count: number; amountRwf: number }[];
  byGroup: { key: string; label: string; count: number; amountRwf: number }[];
  districts: {
    districtId: number;
    name: string;
    letters: string;
    provinceName: string;
    registered: number;
    waiting: number;
    overdue: number;
    approved: number;
    declined: number;
    members: number;
    membershipFeesRwf: number;
    medianDecisionDays: number | null;
    officers: string[];
  }[];
}

/** The officer's region over a period (defaults to the API's last 90 days when omitted). */
export function readPsfReport(ctx: SourceContext, query: { from?: string; to?: string } = {}): Promise<PsfReport> {
  const params = new URLSearchParams();
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  const qs = params.toString();
  return ctx.api.get<PsfReport>(`/api/v1/oversight/psf/report${qs ? `?${qs}` : ""}`);
}
