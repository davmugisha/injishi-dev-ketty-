/**
 * Live sources for the oversight area: the government officer's desk, from `GET /api/v1/me/oversight` (which
 * functions this person holds, and where), `GET /api/v1/oversight/verification-queue` and `…/approval-queue`
 * (the businesses waiting on them, region and separation of duties decided by the API),
 * `GET /api/v1/oversight/registrations/:orgId/documents` (the evidence) and `GET /api/v1/oversight/decisions`
 * (their own decisions), presented as the oversight fixture documents.
 *
 * What the API does not record is not drawn: there is no SLA or deadline on a registration stage, no case
 * assignment and no information request, so a live case says how long it has waited and nothing about a due
 * date, and offers only the decisions the API can take (verify, approve, reject).
 */
import type * as O from "@injishi/data/fixtures/oversight";
import { clock, dayMonth, dayMonthYear } from "../format";
import { defineSources, type SourceContext } from "./types";

// ── API shapes (as server/api answers; the app does not depend on @injishi/contracts) ─────────────

type OversightRole =
  | "business_field_verifier"
  | "business_approver"
  | "tax_compliance_officer"
  | "psf_membership_officer";

/** One grant from GET /api/v1/me/oversight (OversightConsoleGrant). */
export interface ApiConsole {
  assignmentId: string;
  console: string;
  oversightRole: OversightRole;
  bodyCode: string;
  bodyName: string;
  title: string | null;
  scopeLevel: "country" | "province" | "district";
  provinceId: number | null;
  districtId: number | null;
  scopeLabel: string;
}

type RegistrationStatus =
  | "pending_payment"
  | "submitted"
  | "tin_verified"
  | "field_verified"
  | "approved"
  | "active"
  | "rejected"
  | "suspended";

/** One business waiting on this officer (OversightQueueItem), the fields read here. */
export interface ApiQueueItem {
  orgId: string;
  legalName: string;
  domain: "hospitality" | "residence";
  accommodationClass: string | null;
  tin: string | null;
  upi: string | null;
  districtName: string | null;
  sectorName: string | null;
  addressText: string | null;
  status: RegistrationStatus;
  waitingSince: string;
  blockedBySeparationOfDuties: boolean;
  branches: { name: string; districtName: string | null; isHeadOffice: boolean }[];
  documentCount: number;
  uncheckedDocumentCount: number;
  tourismLicenseNumber: string | null;
  onBehalfOf: boolean;
  tinCheck: { result: "pending" | "verified" | "failed"; adapterMode: "mock" | "live"; checkedAt: string } | null;
  registrantName: string | null;
  intendedOwnerName: string | null;
}

/** A document on one registration (OversightDocument). */
interface ApiDocument {
  id: string;
  kind: string;
  kindOther: string | null;
  certificateNumber: string | null;
  issuedBy: string | null;
  issuedOn: string | null;
  expiresOn: string | null;
  expired: boolean;
  mime: string | null;
  sizeBytes: number | null;
  url: string | null;
  checkedAt: string | null;
  checkedByName: string | null;
}

/** GET /api/v1/oversight/registrations/:orgId/documents (OversightDocumentList). */
export interface ApiDocumentList {
  orgId: string;
  legalName: string;
  status: RegistrationStatus;
  documents: ApiDocument[];
  uncheckedCount: number;
}

/** One decision in the officer's own log (OversightDecision). */
interface ApiDecision {
  reviewId: string;
  orgId: string;
  legalName: string;
  stage: "tin_verified" | "field_verified";
  decision: "passed" | "rejected";
  reasonCode: RejectionCode | null;
  notes: string | null;
  governmentBodyCode: string;
  governmentTitle: string | null;
  decidedAt: string;
}

// ── Labels (as @injishi/contracts words them) ──────────────────────────────────────────────────────

/** `RegistrationRejectionReason` with REJECTION_REASON_LABEL, in the order the officer picks from. */
export const REJECTION_REASONS = {
  tin_not_found: "We could not find this TIN at RRA.",
  tin_mismatch: "The TIN does not match the business name on record.",
  premises_not_found: "The verifier could not find the business at this address.",
  documents_invalid: "One or more certificates could not be accepted.",
  documents_expired: "One or more certificates have expired.",
  not_operating: "The business was not operating when the verifier visited.",
  ownership_unclear: "We could not confirm who owns this business.",
  duplicate_business: "This business is already registered on Injishi.",
  other: "See the note from the reviewing officer.",
} as const;
export type RejectionCode = keyof typeof REJECTION_REASONS;

export function isRejectionCode(value: string): value is RejectionCode {
  return value in REJECTION_REASONS;
}

/** ORG_CERTIFICATE_KIND_LABEL. */
const DOCUMENT_KIND: Record<string, string> = {
  rdb_grade: "RDB grade certificate",
  tourism_license: "Tourism license",
  tax_clearance: "Tax clearance",
  fire_safety: "Fire safety certificate",
  health_inspection: "Health inspection",
  other: "Other document",
  rdb_certificate: "RDB certificate",
  psf_certificate: "PSF certificate",
  land_title: "Land title",
};

/** ACCOMMODATION_CLASS_LABEL, plus the residence classes. */
const CLASS_LABEL: Record<string, string> = {
  hotel: "Hotel",
  motel: "Motel",
  tented_camp: "Tented camp",
  guest_house: "Guest house",
  apartment: "Apartment",
  lodge: "Lodge",
  villa: "Villa",
  other: "Other accommodation",
  town_hotel: "Town hotel",
  vacation_hotel_resort: "Resort",
  serviced_apartment: "Serviced apartment",
  cottage: "Cottage",
  residential_landlord: "Residential landlord",
  residential_property_manager: "Residential property manager",
};

const ROLE_LABEL: Record<OversightRole, string> = {
  business_field_verifier: "Field verification",
  business_approver: "Approval",
  tax_compliance_officer: "Tax compliance",
  psf_membership_officer: "PSF membership",
};

// ── The desk: what this officer holds and what waits on them, read once per request ─────────────────

export interface Desk {
  consoles: ApiConsole[];
  /** Null when this person holds no field verifier grant (the API would refuse the read). */
  verification: ApiQueueItem[] | null;
  /** Null when this person holds no approver grant. */
  approval: ApiQueueItem[] | null;
}

const desks = new WeakMap<SourceContext, Promise<Desk>>();

const holds = (consoles: ApiConsole[], role: OversightRole) => consoles.some((c) => c.oversightRole === role);

/** The signed-in officer's grants and queues, once per request. */
export function readDesk(ctx: SourceContext): Promise<Desk> {
  let read = desks.get(ctx);
  if (!read) {
    read = (async () => {
      const { consoles } = await ctx.api.get<{ consoles: ApiConsole[] }>("/api/v1/me/oversight");
      const [verification, approval] = await Promise.all([
        holds(consoles, "business_field_verifier")
          ? ctx.api.get<ApiQueueItem[]>("/api/v1/oversight/verification-queue")
          : Promise.resolve(null),
        holds(consoles, "business_approver")
          ? ctx.api.get<ApiQueueItem[]>("/api/v1/oversight/approval-queue")
          : Promise.resolve(null),
      ]);
      return { consoles, verification, approval };
    })();
    desks.set(ctx, read);
  }
  return read;
}

/** After a decision: the next read of this request asks the API again. */
export function forgetDesk(ctx: SourceContext): void {
  desks.delete(ctx);
}

// ── Formatting ─────────────────────────────────────────────────────────────────────────────────────

/** "REG-3F2A" from the org's uuid: short enough to read aloud, stable for the case. */
export const caseRef = (orgId: string) => `REG-${orgId.replace(/-/g, "").slice(-4).toUpperCase()}`;

const spaced = (digits: string) => digits.replace(/(\d{3})(?=\d)/g, "$1 ");

function initials(name: string): string {
  const words = name
    .replace(/\(.*?\)/g, "")
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w));
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "?";
}

/** Whole days between two instants, never negative. */
function daysSince(iso: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000));
}

const daysLabel = (n: number) => (n === 0 ? "Today" : n === 1 ? "1 day" : `${n} days`);

const when = (iso: string) => `${dayMonth(iso)} ${clock(iso)}`;

function placeOf(item: Pick<ApiQueueItem, "sectorName" | "districtName">): string {
  if (item.sectorName && item.districtName) return `${item.sectorName} sector, ${item.districtName}`;
  return item.sectorName ? `${item.sectorName} sector` : (item.districtName ?? "Address not given");
}

function kindOf(item: ApiQueueItem): string {
  const cls = item.accommodationClass ? (CLASS_LABEL[item.accommodationClass] ?? item.accommodationClass) : null;
  const what = cls ?? (item.domain === "residence" ? "Residence" : "Hospitality business");
  const sites = item.branches.length > 1 ? ` · ${item.branches.length} locations` : "";
  return `${what}${sites}`;
}

function documentsLine(item: Pick<ApiQueueItem, "documentCount" | "uncheckedDocumentCount">): string {
  if (item.documentCount === 0) return "None uploaded";
  const read = item.documentCount - item.uncheckedDocumentCount;
  return `${item.documentCount} uploaded · ${read === 0 ? "none read" : `${read} read`}`;
}

function registrantLine(item: ApiQueueItem): string {
  const who = item.registrantName ?? "The registrant";
  return item.onBehalfOf ? `${who}, on behalf of ${item.intendedOwnerName ?? "the owner"}` : `${who}, the owner`;
}

function idLine(item: ApiQueueItem): { label: string; value: string } {
  if (item.domain === "residence" && item.upi) return { label: "UPI", value: item.upi };
  return { label: "TIN", value: item.tin ? spaced(item.tin) : "Not given" };
}

function tinCheckLine(item: ApiQueueItem): string {
  const c = item.tinCheck;
  if (!c) return "No RRA answer on record";
  const result = c.result === "verified" ? "Verified" : c.result === "failed" ? "Failed" : "Pending";
  return `${result} ${dayMonth(c.checkedAt)}${c.adapterMode === "mock" ? " · sample register" : " · RRA"}`;
}

// ── Queue cases ────────────────────────────────────────────────────────────────────────────────────

function verificationCase(item: ApiQueueItem, now: Date): O.QueueCase {
  const waited = daysSince(item.waitingSince, now);
  return {
    id: item.orgId,
    ref: caseRef(item.orgId),
    href: `/officer/cases/${item.orgId}`,
    queue: "verification",
    initials: initials(item.legalName),
    business: item.legalName,
    place: placeOf(item),
    type: item.onBehalfOf ? "Registration on behalf of an owner" : "New business registration",
    typeDetail: kindOf(item),
    age: daysLabel(waited),
    sla: "no deadline recorded",
    slaUsed: 0,
    slaLabel: "No deadline is recorded for this stage",
    status: "Waiting for field visit",
    statusTone: "accent",
    who: "Any verifier in the district",
    facts: [
      { label: "Waiting since", value: `${when(item.waitingSince)} · ${registrantLine(item)}` },
      idLine(item),
      { label: "RRA check", value: tinCheckLine(item) },
      { label: "Documents", value: documentsLine(item) },
    ],
    duty: {
      tone: "default",
      title: "You verify, another officer approves",
      description:
        "When you record a verification it moves to an approving officer for the district. You cannot approve a case you verified.",
    },
    action: "open",
    cta: "Open case",
    foot: "The business stays in review until a second officer approves. Nothing is activated on paperwork alone.",
    board: "OfficerCase",
  };
}

function approvalCase(item: ApiQueueItem, now: Date): O.QueueCase {
  const waited = daysSince(item.waitingSince, now);
  const blocked = item.blockedBySeparationOfDuties;
  return {
    id: item.orgId,
    ref: caseRef(item.orgId),
    href: `/officer/cases/${item.orgId}`,
    queue: "approval",
    initials: initials(item.legalName),
    business: item.legalName,
    place: placeOf(item),
    type: item.onBehalfOf ? "Registration on behalf of an owner" : "New business registration",
    typeDetail: kindOf(item),
    age: daysLabel(waited),
    sla: "no deadline recorded",
    slaUsed: 0,
    slaLabel: "No deadline is recorded for this stage",
    status: blocked ? "Awaiting another officer" : "Awaiting your approval",
    statusTone: blocked ? "default" : "warning",
    who: blocked ? "Verified by you" : "Field verified",
    facts: [
      { label: "Field verified", value: when(item.waitingSince) },
      idLine(item),
      { label: "Documents", value: documentsLine(item) },
      { label: "Registered by", value: registrantLine(item) },
    ],
    duty: blocked
      ? {
          tone: "warning",
          title: "You verified this case",
          description: "Separation of duties: another approving officer in the district has to decide it.",
        }
      : {
          tone: "success",
          title: "You can approve this case",
          description:
            "You did not verify it. Approving opens the business; rejecting returns it to the owner with your reason.",
        },
    action: blocked ? "blocked" : "open",
    cta: blocked ? null : "Review for approval",
    foot: blocked
      ? "It stays in this queue, flagged, so the district can see who has to pick it up."
      : "Approving activates the business unless an owner it was registered for has yet to claim it.",
    board: "OfficerCase",
  };
}

async function cases(ctx: SourceContext): Promise<O.QueueCase[]> {
  const desk = await readDesk(ctx);
  const oldestFirst = (a: ApiQueueItem, b: ApiQueueItem) => a.waitingSince.localeCompare(b.waitingSince);
  return [
    ...(desk.verification ?? [])
      .slice()
      .sort(oldestFirst)
      .map((i) => verificationCase(i, ctx.now)),
    ...(desk.approval ?? [])
      .slice()
      .sort(oldestFirst)
      .map((i) => approvalCase(i, ctx.now)),
  ];
}

// ── One case file ──────────────────────────────────────────────────────────────────────────────────

function caseDocument(d: ApiDocument): O.CaseDocument {
  const name = d.kind === "other" ? (d.kindOther ?? DOCUMENT_KIND.other) : (DOCUMENT_KIND[d.kind] ?? d.kind);
  const status = d.expired ? "Expired" : d.checkedAt ? "Read" : "Not read yet";
  const fields: O.CaseDocument["fields"] = [
    { label: "Number", onDocument: d.certificateNumber ?? "—", declared: d.certificateNumber ?? "—", result: "match" },
    { label: "Issued", onDocument: d.issuedOn ? dayMonthYear(d.issuedOn) : "—", declared: "—", result: "undeclared" },
    {
      label: "Expires",
      onDocument: d.expiresOn ? dayMonthYear(d.expiresOn) : "No expiry given",
      declared: "—",
      result: d.expired ? "check" : "undeclared",
    },
  ];
  return {
    id: d.id,
    name,
    issuerShort: d.issuedBy ?? "Issuer not given",
    issuer: d.issuedBy ?? "Issuer not given",
    number: d.certificateNumber ?? "No number",
    file: d.url ? (d.mime === "application/pdf" ? "PDF" : (d.mime ?? "File")) : "Nothing uploaded",
    uploaded: d.issuedOn ? dayMonth(d.issuedOn) : "—",
    pages: 1,
    unreadablePage: null,
    status,
    statusTone: d.expired ? "danger" : d.checkedAt ? "success" : "warning",
    fields,
    url: d.url,
  };
}

async function caseFile(ctx: SourceContext, orgId: string): Promise<O.CaseFile | undefined> {
  const desk = await readDesk(ctx);
  const inField = desk.verification?.find((i) => i.orgId === orgId);
  const inApproval = inField ? undefined : desk.approval?.find((i) => i.orgId === orgId);
  const item = inField ?? inApproval;
  if (!item) return undefined;
  const list = await ctx.api.get<ApiDocumentList>(`/api/v1/oversight/registrations/${orgId}/documents`);
  const gate = inField ? "field" : "approval";
  const documents = list.documents.map(caseDocument);
  const checks: O.CaseCheck[] = list.documents.map((d) => ({
    id: d.id,
    short: caseDocument(d).name,
    label: `Read the ${caseDocument(d).name.toLowerCase()}`,
    how: d.certificateNumber ? `Number ${d.certificateNumber} against the file` : "Open the file and read it",
    recorded: d.checkedAt ? `${d.checkedByName ?? "An officer"} · ${when(d.checkedAt)}` : null,
  }));
  const verifiedLine = inApproval ? [{ label: "Field verified", value: when(item.waitingSince) }] : [];
  return {
    id: item.orgId,
    queue: gate === "field" ? "Verification queue" : "Approval queue",
    stage: "review",
    business: item.legalName,
    owner: item.onBehalfOf ? (item.intendedOwnerName ?? "the owner") : (item.registrantName ?? "the owner"),
    summary: `${kindOf(item)} · ${placeOf(item)}${item.addressText ? ` · ${item.addressText}` : ""}`,
    submitted: { date: when(item.waitingSince), by: item.registrantName ?? "the registrant" },
    due: "no deadline recorded",
    slaLeft: `${daysLabel(daysSince(item.waitingSince, ctx.now))} in this stage`,
    assigned:
      gate === "field" ? "Field verification" : item.blockedBySeparationOfDuties ? "Verified by you" : "Approval",
    facts: [
      { label: "Legal name", value: item.legalName },
      idLine(item),
      { label: "RRA check", value: tinCheckLine(item) },
      { label: "Registered by", value: registrantLine(item) },
      { label: "Type", value: kindOf(item) },
      { label: "Address", value: item.addressText ?? placeOf(item) },
      ...(item.tourismLicenseNumber ? [{ label: "Tourism licence", value: item.tourismLicenseNumber }] : []),
      ...verifiedLine,
    ],
    documents,
    lastViewed: { document: documents[0]?.id ?? "", page: 1, by: "you", at: "now" },
    checks,
    officers: [],
    events: [
      {
        id: "registered",
        icon: "Check",
        title: "Registered and paid · TIN checked",
        when: `${dayMonth(item.tinCheck?.checkedAt ?? item.waitingSince)} · Injishi and email`,
        state: "Delivered",
        tone: "success",
      },
    ],
    audit: [
      ...(inApproval
        ? [
            {
              id: "verified",
              status: "success" as const,
              title: "Field verification recorded",
              detail: when(item.waitingSince),
            },
          ]
        : []),
      {
        id: "waiting",
        status: "current" as const,
        title: gate === "field" ? "Waiting for field verification" : "Waiting for approval",
        detail: `Since ${when(item.waitingSince)}`,
      },
    ],
    infoNeeds: [],
    infoMessage: "",
    infoDue: "",
    rejectionNote: "",
    gate,
    blocked: item.blockedBySeparationOfDuties,
  };
}

// ── Decisions, figures and the mandate ─────────────────────────────────────────────────────────────

async function decisions(ctx: SourceContext): Promise<O.OfficerDecision[]> {
  const desk = await readDesk(ctx);
  if (!holds(desk.consoles, "business_field_verifier") && !holds(desk.consoles, "business_approver")) return [];
  const { items } = await ctx.api.get<{ items: ApiDecision[] }>("/api/v1/oversight/decisions");
  return items.slice(0, 6).map((d) => {
    const gate = d.stage === "tin_verified" ? "field verification" : "approval";
    const passed = d.decision === "passed";
    return {
      id: d.reviewId,
      status: passed ? "success" : "danger",
      icon: passed ? "Check" : "Xmark",
      title: passed
        ? `${d.legalName} · ${d.stage === "tin_verified" ? "field verified" : "approved"}`
        : `${d.legalName} · rejected at ${gate}`,
      detail: [
        when(d.decidedAt),
        d.reasonCode ? REJECTION_REASONS[d.reasonCode] : null,
        d.notes ? `“${d.notes.length > 90 ? `${d.notes.slice(0, 89)}…` : d.notes}”` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    };
  });
}

async function kpis(ctx: SourceContext): Promise<O.QueueKpi[]> {
  const desk = await readDesk(ctx);
  const all = [...(desk.verification ?? []), ...(desk.approval ?? [])];
  const mine = (desk.approval ?? []).filter((i) => !i.blockedBySeparationOfDuties).length;
  const oldest = all.reduce<ApiQueueItem | null>((o, i) => (!o || i.waitingSince < o.waitingSince ? i : o), null);
  const unread = all.reduce((n, i) => n + i.uncheckedDocumentCount, 0);
  const verification = desk.verification?.length ?? 0;
  const approval = desk.approval?.length ?? 0;
  return [
    {
      id: "open",
      label: "Open cases",
      value: all.length,
      format: { style: "decimal" },
      foot: `${verification} verification · ${approval} approval`,
      dueSoon: false,
    },
    {
      id: "yours",
      label: "Waiting on your approval",
      value: mine,
      format: { style: "decimal" },
      foot: desk.approval ? "Cases you did not verify" : "You hold no approver grant",
      dueSoon: mine > 0,
    },
    {
      id: "oldest",
      label: "Oldest open",
      value: oldest ? daysSince(oldest.waitingSince, ctx.now) : 0,
      format: { style: "unit", unit: "day", unitDisplay: "long" },
      foot: oldest ? `${caseRef(oldest.orgId)} · ${oldest.legalName}` : "Nothing waiting",
      dueSoon: false,
    },
    {
      id: "unread",
      label: "Documents not read",
      value: unread,
      format: { style: "decimal" },
      foot: "Across the cases in your queues",
      dueSoon: false,
    },
  ];
}

async function mandateFacts(ctx: SourceContext): Promise<O.MandateFact[]> {
  const { consoles } = await readDesk(ctx);
  const business = consoles.filter(
    (c) => c.oversightRole === "business_field_verifier" || c.oversightRole === "business_approver",
  );
  const first = business[0] ?? consoles[0];
  if (!first) return [];
  const scopes = [...new Set(business.map((c) => c.scopeLabel))];
  return [
    { id: "institution", label: "Institution", value: first.bodyName, note: first.title ?? "Officer" },
    {
      id: "jurisdiction",
      label: "Jurisdiction",
      value: scopes.join(", ") || first.scopeLabel,
      note:
        first.scopeLevel === "country"
          ? "Every district"
          : `${first.scopeLevel === "district" ? "District" : "Province"} scope · no other`,
    },
    {
      id: "functions",
      label: "Functions",
      value: [...new Set(consoles.map((c) => ROLE_LABEL[c.oversightRole]))].join(" · "),
      note: "As your assignment records them",
    },
  ];
}

/** The verified state, worded from the officer's own grants (the API records no expiry or pause). */
async function mandateStates(ctx: SourceContext): Promise<O.MandateState[]> {
  const desk = await readDesk(ctx);
  const scope = [...new Set(desk.consoles.map((c) => c.scopeLabel))].join(", ") || "your jurisdiction";
  const v = desk.verification?.length ?? 0;
  const a = desk.approval?.length ?? 0;
  const waiting =
    v + a === 0
      ? `Nothing waits on you in ${scope}.`
      : [v > 0 ? `${v} waiting on a field visit` : null, a > 0 ? `${a} waiting on approval` : null]
          .filter(Boolean)
          .join(" · ");
  return [
    {
      id: "verified",
      pill: `Active mandate · ${scope}`,
      tone: "success",
      chip: "Active",
      summary: desk.consoles.length ? waiting : "You hold no oversight assignment, so no queue is open to you.",
      alert: null,
      validUntil: "No end date recorded",
      validNote: "Until revoked",
      queuesOpen: desk.consoles.length > 0,
    },
  ];
}

export const sources = defineSources({
  "oversight.cases": { list: cases, naturalKey: "business" },
  "oversight.caseFiles": {
    async list(ctx) {
      const all = await cases(ctx);
      const files = await Promise.all(all.map((c) => caseFile(ctx, c.id)));
      return files.filter((f): f is O.CaseFile => !!f);
    },
    get: caseFile,
    naturalKey: "business",
  },
  "oversight.recentDecisions": { list: decisions, parity: "shape" },
  "oversight.queueKpis": { list: kpis, parity: "shape" },
  "oversight.mandateFacts": { list: mandateFacts, parity: "shape" },
  "oversight.mandateStates": { list: mandateStates, parity: "shape" },
  "oversight.rejectionReasons": {
    async list(): Promise<O.RejectionReason[]> {
      return Object.entries(REJECTION_REASONS).map(([id, label]) => ({ id, label }));
    },
    parity: "shape",
  },
});
