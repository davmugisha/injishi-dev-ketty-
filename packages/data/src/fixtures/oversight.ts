import type { BoardId, FixtureSet, IconName } from "../types.ts";

/**
 * Embedded-database fixtures for the "oversight" area: the district officer's queues (OfficerHome), a
 * verification case (OfficerCase), district administration (DistrictAdmin), delegated data (DelegatedReports)
 * and the PSF · Chamber of Tourism membership console (PsfConsole).
 * Collection names are "oversight.<thing>"; every document has a stable string `id`.
 * Values are lifted verbatim from the artifact boards (node tools/artifact/extract.mjs <Board>).
 */

export type Tone = "accent" | "success" | "warning" | "danger" | "default" | "info";

/** Marker tone of a timeline entry. */
export type EventStatus = "default" | "current" | "success" | "warning" | "danger";

// ── Officer · queues ─────────────────────────────────────────────────────────

export type MandateStateId = "verified" | "expiring" | "suspended";

/** The officer's mandate in one of its states (artifact variant `mandate=verified|expiring|suspended`). */
export interface MandateState {
  id: MandateStateId;
  /** Top-bar status pill. */
  pill: string;
  tone: Tone;
  /** Chip beside "Your Mandate". */
  chip: string;
  /** Page subtitle under the greeting. */
  summary: string;
  /** Alert inside the mandate card (renewal pending, access paused). */
  alert: { icon: IconName; title: string; description: string } | null;
  /** Replaces the "Valid until" fact. */
  validUntil: string;
  validNote: string;
  /** Queues, figures and decisions are hidden while access is paused. */
  queuesOpen: boolean;
}

/** One fact of the mandate record: label, value and a muted note. */
export interface MandateFact {
  id: string;
  label: string;
  value: string;
  note: string;
}

/** Something deliberately outside the officer's mandate. */
export interface MandateExclusion {
  id: string;
  label: string;
}

/** Queue health figure. `value` is formatted with `format` (Intl.NumberFormat options). */
export interface QueueKpi {
  id: string;
  label: string;
  value: number;
  format: {
    style?: "decimal" | "percent" | "unit";
    unit?: "day";
    unitDisplay?: "long";
    maximumFractionDigits?: number;
  };
  foot: string;
  /** Due soon: shows the clock badge. */
  dueSoon: boolean;
}

export type QueueId = "verification" | "approval" | "tax";

/** A case in one of the officer's queues, with what the inspector shows when it is selected. */
export interface QueueCase {
  id: string;
  queue: QueueId;
  initials: string;
  business: string;
  place: string;
  type: string;
  typeDetail: string;
  age: string;
  sla: string;
  /** Share of the SLA used, in percent. */
  slaUsed: number;
  slaLabel: string;
  status: string;
  statusTone: Tone;
  /** Assigned to (verification), verified by (approval) or decided by (tax). */
  who: string;
  facts: { label: string; value: string }[];
  /** Separation-of-duties note for this officer and case. */
  duty: { tone: Tone; title: string; description: string };
  /** What this officer may do: open the case, nothing (they verified it), or flag it for the tax office. */
  action: "open" | "blocked" | "flag";
  cta: string | null;
  foot: string;
  board: BoardId;
  /** Reference shown beside the business (live cases: a short registration reference); `id` when absent. */
  ref?: string;
  /** Where "open" goes when the case has its own page (live cases: /officer/cases/<orgId>). */
  href?: string;
}

/** A recent decision by the officer or routed to them. */
export interface OfficerDecision {
  id: string;
  status: EventStatus;
  icon: IconName;
  title: string;
  detail: string;
}

/** A rule of the mandate, linked to the screen where it shows. */
export interface MandateRule {
  id: string;
  icon: IconName;
  title: string;
  description: string;
  board: BoardId;
}

// ── Officer · verification case ──────────────────────────────────────────────

export type CaseStage = "review" | "info" | "verified" | "rejected";

/** Outcome of comparing a document field with the declaration. */
export type FieldResult = "match" | "check" | "unreadable" | "undeclared";

export interface CaseDocument {
  id: string;
  name: string;
  issuerShort: string;
  issuer: string;
  number: string;
  file: string;
  uploaded: string;
  pages: number;
  /** A page whose scan cannot be read (shows a notice instead of the preview). */
  unreadablePage: number | null;
  status: string;
  statusTone: Tone;
  fields: { label: string; onDocument: string; declared: string; result: FieldResult }[];
  /** Live cases: a short-lived signed link to the file itself, or null when nothing was uploaded. */
  url?: string | null;
}

export interface CaseCheck {
  id: string;
  /** Short name used in "Still open: …". */
  short: string;
  label: string;
  how: string;
  /** Who recorded it and when; null while the check is open. */
  recorded: string | null;
}

export interface CaseOfficer {
  id: string;
  initials: string;
  name: string;
  role: string;
  avatarTone: Tone;
  duty: "verifier" | "approver";
}

/** Event the business is sent (or will be sent). */
export interface CaseEvent {
  id: string;
  icon: IconName;
  title: string;
  when: string;
  state: string;
  tone: Tone;
}

export interface CaseAuditEntry {
  id: string;
  status: EventStatus;
  title: string;
  detail: string;
}

/** Full file of a verification case (OfficerCase). */
export interface CaseFile {
  id: string;
  queue: string;
  stage: CaseStage;
  business: string;
  owner: string;
  summary: string;
  submitted: { date: string; by: string };
  due: string;
  slaLeft: string;
  assigned: string;
  facts: { label: string; value: string }[];
  documents: CaseDocument[];
  /** The page the officer last opened; the viewer starts there. */
  lastViewed: { document: string; page: number; by: string; at: string };
  checks: CaseCheck[];
  officers: CaseOfficer[];
  /** Events already sent, followed by the final decision event. */
  events: CaseEvent[];
  audit: CaseAuditEntry[];
  /** Information-request draft: what is needed (pre-ticked suggestions), message and due date. */
  infoNeeds: { id: string; label: string; suggested: boolean }[];
  infoMessage: string;
  infoDue: string;
  rejectionNote: string;
  /**
   * Live cases only: the gate this officer decides here. `field` is the field verifier's (verify or
   * reject), `approval` the second officer's (approve or reject). Absent on sample cases.
   */
  gate?: "field" | "approval";
  /** Live approval cases: this officer field-verified it, so separation of duties bars their approval. */
  blocked?: boolean;
}

/** Rejection reason code the business sees. */
export interface RejectionReason {
  id: string;
  label: string;
}

// ── District · bodies and officers ───────────────────────────────────────────

export interface GovernmentBody {
  id: string;
  initials: string;
  avatarTone: Tone;
  name: string;
  kind: string;
  jurisdiction: string;
  mandate: string;
  mandateTone: Tone;
  /** Shows the "Needs verification" gate. */
  needsVerification: boolean;
  basis: string;
  basisNote: string;
  officers: string;
  lastVerified: string;
}

/** A permission an officer assignment can carry. */
export interface OfficerPermission {
  id: string;
  label: string;
  short: string;
  description: string;
  /** Not assignable: no verified legal basis, fields or channel. */
  locked: boolean;
}

/** An officer and their scoped assignment. */
export interface DistrictOfficer {
  id: string;
  initials: string;
  name: string;
  body: string;
  jurisdiction: string;
  /** Permission ids, in display order. */
  permissions: string[];
  validUntil: string;
  validUntilLong: string;
  validNote: string;
  status: string;
  statusTone: Tone;
  identity: string | null;
  /** Assigned to selected sectors rather than the whole district. */
  sectorScoped: boolean;
  /** The signed-in officer: nobody edits their own scope. */
  isSelf: boolean;
  editable: boolean;
  /** Draft waiting for the signatory, when the assignment is new. */
  draft: { from: string; reason: string } | null;
}

/** A line of the quarterly access review. */
export interface AccessReviewItem {
  id: string;
  name: string;
  note: string;
  isSelf: boolean;
  decision: "keep" | "revoke" | null;
}

export interface DistrictSector {
  id: string;
  name: string;
}

// ── Officer · delegated data ─────────────────────────────────────────────────

/** A month of the occupancy dataset; `occupancy` is per sector id, in percent. */
export interface OccupancyMonth {
  id: string;
  label: string;
  name: string;
  days: number;
  occupancy: Record<string, number>;
  note: string;
}

export interface OccupancySector {
  id: string;
  name: string;
  businesses: number;
  rooms: number;
  /** Under 3 reporting businesses: figures are suppressed. */
  suppressed: boolean;
}

export interface DatasetTerm {
  id: string;
  label: string;
  value: string;
}

/** What must be verified before guest-stay reporting can start. */
export interface ReportingRequirement {
  id: string;
  title: string;
  description: string;
  state: string;
}

export interface DataExport {
  id: string;
  icon: IconName;
  title: string;
  detail: string;
  state: string;
  tone: Tone;
}

export interface AccessLogEntry {
  id: string;
  when: string;
  action: string;
  record: string;
  purpose: string;
}

export interface ExportChannel {
  id: string;
  label: string;
  description: string;
  approved: boolean;
}

// ── PSF · Chamber of Tourism ─────────────────────────────────────────────────

export type ApplicationStatus = "new" | "review" | "info" | "approved" | "rejected";
export type FeeState = "verified" | "pending" | "unknown" | "none";

export interface MembershipApplication {
  id: string;
  initials: string;
  business: string;
  tin: string;
  category: string;
  place: string;
  submitted: string;
  status: ApplicationStatus;
  /** Review started on. */
  since: string | null;
  decidedOn: string | null;
  establishments: string;
  contact: string;
  fee: FeeState;
  feeLine: string;
  memberNo: string;
  /** Licence still missing for one of the establishments. */
  missingLicence: string | null;
  /** The category needs no tourism licence. */
  licenceExempt: boolean;
}

/** An entry of the Chamber's own register, as recorded in Injishi. */
export interface ChamberMember {
  id: string;
  name: string;
  tin: string;
  detail: string;
  status: string;
  tone: Tone;
  /** Open application whose status this entry follows. */
  application: string | null;
}

// ── Data ─────────────────────────────────────────────────────────────────────

const mandateStates: MandateState[] = [
  {
    id: "verified",
    pill: "Mandate verified · until 30 Jun 2027",
    tone: "success",
    chip: "Verified mandate",
    summary:
      "Six cases are in your queues. One approval is waiting for you, and one case you verified is waiting for another officer.",
    alert: null,
    validUntil: "30 June 2027",
    validNote: "In 261 days",
    queuesOpen: true,
  },
  {
    id: "expiring",
    pill: "Mandate expires 26 Oct",
    tone: "warning",
    chip: "Expires in 14 days",
    summary: "Six cases are in your queues. Your mandate ends on 26 October unless Rubavu District renews it.",
    alert: {
      icon: "Clock",
      title: "Renewal requested on 5 Oct · waiting for the District signatory",
      description:
        "If the renewal is not signed and verified by 26 Oct, your access stops automatically and open cases return to the district queue.",
    },
    validUntil: "26 October 2026",
    validNote: "In 14 days · renewal pending",
    queuesOpen: true,
  },
  {
    id: "suspended",
    pill: "Access paused",
    tone: "danger",
    chip: "Paused by Rubavu District",
    summary: "Your access is paused. Nothing in your queues can be opened until the District confirms it.",
    alert: {
      icon: "Lock",
      title: "Paused today at 08:00 by Emmanuel Nsengiyumva",
      description:
        "Reason recorded: quarterly access review not yet confirmed for your account. Injishi does not decide this; only the District can restore access.",
    },
    validUntil: "30 June 2027",
    validNote: "Paused since 12 Oct 08:00",
    queuesOpen: false,
  },
];

const mandateFacts: MandateFact[] = [
  { id: "institution", label: "Institution", value: "Rubavu District", note: "Business Development Unit" },
  { id: "jurisdiction", label: "Jurisdiction", value: "Rubavu District", note: "All 12 sectors · no other district" },
  {
    id: "basis",
    label: "Legal basis reference",
    value: "Delegation letter RD/BDU/2026/118",
    note: "Signed copy on file",
  },
  { id: "valid", label: "Valid until", value: "30 June 2027", note: "In 261 days" },
  { id: "assigned", label: "Assigned by", value: "Emmanuel Nsengiyumva", note: "Director of Business Development" },
  {
    id: "checked",
    label: "Mandate checked",
    value: "Injishi compliance · 2 Sep 2026",
    note: "Letter and signatory identity verified",
  },
];

const mandateExclusions: MandateExclusion[] = [
  { id: "guests", label: "Guest and stay records" },
  { id: "payments", label: "Payments and folios" },
  { id: "membership", label: "Membership decisions" },
  { id: "own-cases", label: "Approving cases you verified" },
];

const queueKpis: QueueKpi[] = [
  {
    id: "open",
    label: "Open cases",
    value: 6,
    format: { style: "decimal" },
    foot: "3 verification · 2 approval · 1 tax",
    dueSoon: false,
  },
  {
    id: "due",
    label: "Due this week",
    value: 3,
    format: { style: "decimal" },
    foot: "By Saturday 17 Oct",
    dueSoon: true,
  },
  {
    id: "oldest",
    label: "Oldest open",
    value: 9,
    format: { style: "unit", unit: "day", unitDisplay: "long" },
    foot: "VC-0139 · clock paused, waiting for business",
    dueSoon: false,
  },
  {
    id: "median",
    label: "Median time to decision",
    value: 3.2,
    format: { style: "unit", unit: "day", unitDisplay: "long", maximumFractionDigits: 1 },
    foot: "Your cases, last 30 days",
    dueSoon: false,
  },
  {
    id: "returned",
    label: "Returned for information",
    value: 0.18,
    format: { style: "percent" },
    foot: "Of cases you opened since July",
    dueSoon: false,
  },
];

const cases: QueueCase[] = [
  {
    id: "VC-0142",
    queue: "verification",
    initials: "AH",
    business: "Amahoro Hospitality Ltd",
    place: "Gisenyi sector",
    type: "Establishment registration",
    typeDetail: "Isangano Lakeside Hotel · 42 rooms",
    age: "3 days",
    sla: "due 16 Oct",
    slaUsed: 60,
    slaLabel: "SLA 60 percent used",
    status: "In review",
    statusTone: "accent",
    who: "You",
    facts: [
      { label: "Submitted", value: "9 Oct 10:14 by Didier Mugenzi, owner" },
      { label: "TIN", value: "102 345 678" },
      { label: "Documents", value: "3 uploaded · 2 checked" },
      { label: "Checks", value: "4 of 6 complete" },
    ],
    duty: {
      tone: "default",
      title: "You verify, another officer approves",
      description:
        "When you record a verification, it goes to Jean-Claude Mugabo or another approving officer. The business is told at each step.",
    },
    action: "open",
    cta: "Continue verification",
    foot: "Business status stays “Pending verification” until a second officer approves. Injishi never activates a business on paperwork alone.",
    board: "OfficerCase",
  },
  {
    id: "VC-0145",
    queue: "verification",
    initials: "KS",
    business: "Kivu Sunset Guesthouse Ltd",
    place: "Nyamyumba sector",
    type: "New business registration",
    typeDetail: "Guesthouse · 9 rooms",
    age: "2 days",
    sla: "due 17 Oct",
    slaUsed: 40,
    slaLabel: "SLA 40 percent used",
    status: "New",
    statusTone: "default",
    who: "Unassigned",
    facts: [
      { label: "Submitted", value: "10 Oct 15:30 by the owner" },
      { label: "TIN", value: "112 908 334" },
      { label: "Documents", value: "3 uploaded · none checked" },
      { label: "Checks", value: "Not started" },
    ],
    duty: {
      tone: "default",
      title: "Not assigned yet",
      description: "Opening the case assigns it to you. Approval will then need a different officer.",
    },
    action: "open",
    cta: "Take and open case",
    foot: "Registered in Nyamyumba sector, inside your jurisdiction.",
    board: "OfficerCase",
  },
  {
    id: "VC-0139",
    queue: "verification",
    initials: "GB",
    business: "Gisenyi Beach Lodge Ltd",
    place: "Rugerero sector",
    type: "Registration update",
    typeDetail: "Change of owner · 14 rooms",
    age: "9 days",
    sla: "clock paused",
    slaUsed: 35,
    slaLabel: "SLA paused at 35 percent",
    status: "Information requested",
    statusTone: "warning",
    who: "You",
    facts: [
      { label: "Requested", value: "8 Oct · new director ID and RDB extract" },
      { label: "Response due", value: "22 Oct" },
      { label: "Documents", value: "2 of 4 received" },
      { label: "Business notified", value: "8 Oct 09:31 · read 8 Oct" },
    ],
    duty: {
      tone: "default",
      title: "Waiting for the business",
      description:
        "The SLA clock is paused until the business replies. Reminders go out automatically on 15 and 20 Oct.",
    },
    action: "open",
    cta: "Open case",
    foot: "If nothing arrives by 22 Oct you can reject with reason “Information not provided”.",
    board: "OfficerCase",
  },
  {
    id: "VC-0137",
    queue: "approval",
    initials: "RB",
    business: "Rubona Bay Cottages Ltd",
    place: "Rubavu sector",
    type: "New business registration",
    typeDetail: "Cottages · 6 units",
    age: "6 days",
    sla: "due 14 Oct",
    slaUsed: 80,
    slaLabel: "SLA 80 percent used",
    status: "Awaiting your approval",
    statusTone: "warning",
    who: "Verified by Jean-Claude Mugabo",
    facts: [
      { label: "Verified", value: "10 Oct 16:05 by Jean-Claude Mugabo" },
      { label: "Checks", value: "6 of 6 recorded by verifier" },
      { label: "Documents", value: "3 checked" },
      { label: "Your role", value: "Second officer (approver)" },
    ],
    duty: {
      tone: "success",
      title: "You can approve this case",
      description:
        "You did not verify it. Approving sends the decision to the business; rejecting returns it with your reason.",
    },
    action: "open",
    cta: "Review for approval",
    foot: "Approval is due by Wednesday 14 Oct.",
    board: "OfficerCase",
  },
  {
    id: "VC-0141",
    queue: "approval",
    initials: "KH",
    business: "Kivu Serenity Homes Ltd",
    place: "Gisenyi sector",
    type: "Establishment registration",
    typeDetail: "Serviced apartments · 12 units",
    age: "4 days",
    sla: "due 15 Oct",
    slaUsed: 65,
    slaLabel: "SLA 65 percent used",
    status: "Awaiting another officer",
    statusTone: "default",
    who: "Verified by you",
    facts: [
      { label: "Verified", value: "11 Oct 15:02 by you" },
      { label: "Approver pool", value: "Jean-Claude Mugabo" },
      { label: "Documents", value: "3 checked" },
      { label: "Business sees", value: "Verified · awaiting approval" },
    ],
    duty: {
      tone: "warning",
      title: "You verified this case, so you cannot approve it",
      description:
        "Separation of duties applies to every officer, including administrators. Jean-Claude Mugabo has it in his approval queue.",
    },
    action: "blocked",
    cta: null,
    foot: "If no approver is available by 15 Oct, the District can assign one from DistrictAdmin.",
    board: "OfficerCase",
  },
  {
    id: "TX-0058",
    queue: "tax",
    initials: "IC",
    business: "Ikawa Corner Ltd",
    place: "Gisenyi sector",
    type: "Trading licence registration check",
    typeDetail: "Coffee outlet inside Isangano Lakeside Hotel",
    age: "5 days",
    sla: "no SLA",
    slaUsed: 20,
    slaLabel: "No SLA for view-only items",
    status: "View and flag",
    statusTone: "info",
    who: "District tax office",
    facts: [
      { label: "TIN", value: "108 221 457 · separate merchant" },
      { label: "Opened", value: "7 Oct · new outlet in a hotel" },
      { label: "Shared fields", value: "Name, TIN, sector, start date" },
      { label: "Assessment", value: "District tax office, not you" },
    ],
    duty: {
      tone: "default",
      title: "View and flag only",
      description:
        "Your mandate lets you see registration facts and flag a record for the district tax office. Amounts, payments and assessments are outside it.",
    },
    action: "flag",
    cta: null,
    foot: "Flags are logged with your name and sent to the tax office queue, not to the business.",
    board: "OfficerCase",
  },
];

const recentDecisions: OfficerDecision[] = [
  {
    id: "vc-0141-verified",
    status: "current",
    icon: "Clock",
    title: "You verified VC-0141 · Kivu Serenity Homes Ltd",
    detail: "11 Oct 15:02 · sent to Jean-Claude Mugabo for approval · business sees “Verified, awaiting approval”",
  },
  {
    id: "vc-0137-verified",
    status: "warning",
    icon: "Persons",
    title: "Jean-Claude Mugabo verified VC-0137 · Rubona Bay Cottages Ltd",
    detail: "10 Oct 16:05 · routed to you as second officer",
  },
  {
    id: "vc-0133-approved",
    status: "success",
    icon: "Check",
    title: "You approved VC-0133 · Nyundo Hills Lodge Ltd",
    detail: "6 Oct 14:15 · verified by Vestine Uwamahoro · decision sent to the business",
  },
];

const mandateRules: MandateRule[] = [
  {
    id: "logged",
    icon: "Eye",
    title: "Every view is logged",
    description: "Opening a case, document or dataset records who, when and for what purpose.",
    board: "DelegatedReports",
  },
  {
    id: "two-officers",
    icon: "PersonsLock",
    title: "Two officers per decision",
    description: "The officer who verifies a case can never approve it.",
    board: "OfficerCase",
  },
  {
    id: "no-guest-data",
    icon: "Lock",
    title: "No guest data in this mandate",
    description: "Guest and stay records are not delegated, so nothing about guests appears in your queues.",
    board: "DelegatedReports",
  },
];

const caseFiles: CaseFile[] = [
  {
    id: "VC-0142",
    queue: "Verification",
    stage: "review",
    business: "Amahoro Hospitality Ltd",
    owner: "Didier Mugenzi",
    summary:
      "Establishment registration for Isangano Lakeside Hotel, Gisenyi sector · submitted 9 Oct 2026 by Didier Mugenzi, owner",
    submitted: { date: "9 Oct", by: "Didier Mugenzi" },
    due: "16 Oct",
    slaLeft: "4 working days left",
    assigned: "Assigned to you",
    facts: [
      { label: "Legal entity", value: "Amahoro Hospitality Ltd · TIN 102 345 678" },
      { label: "Establishment", value: "Isangano Lakeside Hotel · 42 rooms" },
      { label: "Location", value: "Gisenyi sector, Rubavu District" },
      { label: "Category declared", value: "Hotel · accommodation" },
      { label: "Registration started", value: "On behalf of the business by Injishi onboarding, 7 Oct" },
      { label: "Owner claim", value: "Confirmed by Didier Mugenzi, 8 Oct · phone and ID" },
    ],
    documents: [
      {
        id: "tin",
        name: "TIN certificate",
        issuerShort: "Rwanda Revenue Authority",
        issuer: "Rwanda Revenue Authority",
        number: "TIN 102 345 678",
        file: "TIN-certificate.pdf · 212 KB",
        uploaded: "9 Oct 10:11",
        pages: 1,
        unreadablePage: null,
        status: "Checked",
        statusTone: "success",
        fields: [
          { label: "TIN", onDocument: "102 345 678", declared: "102 345 678", result: "match" },
          {
            label: "Registered name",
            onDocument: "AMAHORO HOSPITALITY LTD",
            declared: "Amahoro Hospitality Ltd",
            result: "match",
          },
          { label: "Tax centre", onDocument: "Rubavu", declared: "—", result: "undeclared" },
        ],
      },
      {
        id: "rdb",
        name: "RDB registration",
        issuerShort: "Office of the Registrar General",
        issuer: "Rwanda Development Board · Registrar General",
        number: "Company code 102345678",
        file: "RDB-certificate.pdf · 486 KB",
        uploaded: "9 Oct 10:12",
        pages: 2,
        unreadablePage: null,
        status: "Checked",
        statusTone: "success",
        fields: [
          {
            label: "Company name",
            onDocument: "Amahoro Hospitality Ltd",
            declared: "Amahoro Hospitality Ltd",
            result: "match",
          },
          {
            label: "Registered office",
            onDocument: "Gisenyi, Rubavu",
            declared: "Gisenyi sector, Rubavu",
            result: "match",
          },
          { label: "Directors", onDocument: "D. Mugenzi; C. Mugenzi", declared: "Didier Mugenzi", result: "check" },
        ],
      },
      {
        id: "tourism",
        name: "Tourism licence",
        issuerShort: "RDB Tourism · TL-ACC-2024-0871",
        issuer: "Rwanda Development Board · Tourism",
        number: "TL-ACC-2024-0871",
        file: "Tourism-licence.pdf · 1.1 MB",
        uploaded: "9 Oct 10:13",
        pages: 2,
        unreadablePage: 2,
        status: "Not checked",
        statusTone: "warning",
        fields: [
          {
            label: "Establishment",
            onDocument: "Isangano Lakeside Hotel",
            declared: "Isangano Lakeside Hotel",
            result: "match",
          },
          { label: "Valid until", onDocument: "14 Mar 2027", declared: "14 Mar 2027", result: "match" },
          { label: "Conditions (page 2)", onDocument: "Unreadable scan", declared: "—", result: "unreadable" },
        ],
      },
    ],
    lastViewed: { document: "tourism", page: 2, by: "Alice Mukeshimana", at: "12 Oct 10:41" },
    checks: [
      {
        id: "tin",
        short: "TIN match",
        label: "TIN on the RRA certificate matches the declared TIN",
        how: "Compared field by field",
        recorded: "You · 10 Oct 08:41",
      },
      {
        id: "name",
        short: "company name",
        label: "Company name matches the RDB registration",
        how: "RDB certificate, page 1",
        recorded: "You · 10 Oct 08:44",
      },
      {
        id: "address",
        short: "jurisdiction",
        label: "Establishment is inside Rubavu District",
        how: "Gisenyi sector · within your jurisdiction",
        recorded: "You · 10 Oct 08:47",
      },
      {
        id: "dup",
        short: "duplicate search",
        label: "No other registration exists for this establishment",
        how: "Injishi duplicate search · 0 matches",
        recorded: "You · 12 Oct 09:02",
      },
      {
        id: "licence",
        short: "tourism licence coverage",
        label: "Tourism licence is valid and covers this establishment",
        how: "Page 2 with conditions is unreadable",
        recorded: null,
      },
      {
        id: "owner",
        short: "owner identity",
        label: "Owner identity matches an RDB director",
        how: "Director list shows two names; ID not yet seen",
        recorded: null,
      },
    ],
    officers: [
      {
        id: "alice",
        initials: "AM",
        name: "Alice Mukeshimana (you)",
        role: "Verifying officer",
        avatarTone: "accent",
        duty: "verifier",
      },
      {
        id: "jc",
        initials: "JM",
        name: "Jean-Claude Mugabo",
        role: "Approving officer · auto-assigned",
        avatarTone: "default",
        duty: "approver",
      },
    ],
    events: [
      {
        id: "received",
        icon: "Tray",
        title: "Registration received by Rubavu District",
        when: "9 Oct 10:15 · Injishi and SMS",
        state: "Delivered",
        tone: "success",
      },
      {
        id: "review",
        icon: "Eye",
        title: "Under review by a district officer",
        when: "10 Oct 08:32 · Injishi",
        state: "Delivered",
        tone: "success",
      },
      {
        id: "final",
        icon: "PaperPlane",
        title: "Final decision with reference number",
        when: "Sent only after approval",
        state: "Not sent",
        tone: "default",
      },
    ],
    audit: [
      {
        id: "a6",
        status: "default",
        title: "You viewed the tourism licence, page 2",
        detail: "12 Oct 10:41 · purpose: business verification",
      },
      { id: "a5", status: "default", title: "Duplicate search run · 0 matches", detail: "12 Oct 09:02 · by you" },
      { id: "a4", status: "default", title: "You recorded checks 1 to 3", detail: "10 Oct 08:47" },
      {
        id: "a3",
        status: "default",
        title: "Assigned to Alice Mukeshimana",
        detail: "10 Oct 08:32 · queue rule, Gisenyi sector",
      },
      {
        id: "a2",
        status: "default",
        title: "Routed to Rubavu District",
        detail: "9 Oct 10:15 · establishment in Gisenyi sector",
      },
      {
        id: "a1",
        status: "success",
        title: "Submitted by Didier Mugenzi",
        detail: "9 Oct 10:14 · 3 documents · owner claim confirmed 8 Oct",
      },
    ],
    infoNeeds: [
      { id: "licence", label: "Readable tourism licence, page 2 (conditions)", suggested: true },
      { id: "id", label: "Owner’s national ID to match the RDB director record", suggested: true },
      { id: "address", label: "Proof of the establishment’s address", suggested: false },
    ],
    infoMessage:
      "Hello Didier, page 2 of the tourism licence is not readable. Please upload a clear copy showing the licence conditions, and a copy of your national ID so we can match it to the RDB director record. Alice Mukeshimana, Rubavu District.",
    infoDue: "Saturday 24 October 2026",
    rejectionNote:
      "The tourism licence submitted does not show conditions for Isangano Lakeside Hotel. Please resubmit with a readable licence.",
  },
];

const rejectionReasons: RejectionReason[] = [
  { id: "mismatch", label: "Documents do not match the declared business" },
  { id: "licence", label: "Licence missing, expired or not readable" },
  { id: "outside", label: "Establishment is outside this jurisdiction" },
  { id: "noinfo", label: "Requested information not provided in time" },
];

const bodies: GovernmentBody[] = [
  {
    id: "rubavu",
    initials: "RD",
    avatarTone: "accent",
    name: "Rubavu District",
    kind: "Local government",
    jurisdiction: "Rubavu District · 12 sectors",
    mandate: "Verified mandate",
    mandateTone: "success",
    needsVerification: false,
    basis: "RD/BDU/2026/118",
    basisNote: "Delegation letter · business verification",
    officers: "2 active · 1 pending",
    lastVerified: "2 Sep 2026",
  },
  {
    id: "gisenyi",
    initials: "GS",
    avatarTone: "accent",
    name: "Gisenyi Sector Office",
    kind: "Sector office · under Rubavu District",
    jurisdiction: "Gisenyi sector only",
    mandate: "Verified mandate",
    mandateTone: "success",
    needsVerification: false,
    basis: "RD/BDU/2026/118-S04",
    basisNote: "Sub-delegation from the District",
    officers: "1 active",
    lastVerified: "2 Sep 2026",
  },
  {
    id: "nyamyumba",
    initials: "NS",
    avatarTone: "default",
    name: "Nyamyumba Sector Office",
    kind: "Sector office · under Rubavu District",
    jurisdiction: "Nyamyumba sector",
    mandate: "Unverified",
    mandateTone: "warning",
    needsVerification: true,
    basis: "Not received",
    basisNote: "Sub-delegation letter requested 30 Sep",
    officers: "0",
    lastVerified: "—",
  },
  {
    id: "dgie",
    initials: "DG",
    avatarTone: "default",
    name: "DGIE",
    kind: "Immigration and Emigration · national agency",
    jurisdiction: "National",
    mandate: "Unverified",
    mandateTone: "warning",
    needsVerification: true,
    basis: "None on file",
    basisNote: "Guest-stay reporting is not enabled",
    officers: "0",
    lastVerified: "—",
  },
  {
    id: "rra",
    initials: "RR",
    avatarTone: "default",
    name: "RRA",
    kind: "Rwanda Revenue Authority · national agency",
    jurisdiction: "National",
    mandate: "No officer mandate",
    mandateTone: "default",
    needsVerification: false,
    basis: "Not applicable",
    basisNote: "Fiscal receipts use the approved EBM path, not officer access",
    officers: "0",
    lastVerified: "—",
  },
  {
    id: "rdb",
    initials: "RB",
    avatarTone: "default",
    name: "RDB",
    kind: "Rwanda Development Board · national agency",
    jurisdiction: "National · tourism licensing",
    mandate: "Unverified",
    mandateTone: "warning",
    needsVerification: true,
    basis: "In discussion",
    basisNote: "Licence-check agreement not signed",
    officers: "0",
    lastVerified: "—",
  },
];

const permissions: OfficerPermission[] = [
  {
    id: "verify",
    label: "Verify business registrations",
    short: "Verify",
    description: "Check documents and record a verification or rejection",
    locked: false,
  },
  {
    id: "approve",
    label: "Approve verifications",
    short: "Approve",
    description: "Second officer on cases verified by someone else",
    locked: false,
  },
  {
    id: "docs",
    label: "View registration documents",
    short: "Documents",
    description: "View only · watermarked · every view logged",
    locked: false,
  },
  {
    id: "tax",
    label: "Tax queue · view and flag",
    short: "Tax · view",
    description: "Registration facts only, no amounts or payments",
    locked: false,
  },
  {
    id: "stats",
    label: "Aggregated occupancy statistics",
    short: "Occupancy stats",
    description: "Sector totals, no personal data, export by encrypted file",
    locked: false,
  },
  {
    id: "propose",
    label: "Propose officer assignments",
    short: "Propose assignments",
    description: "Drafts only · the signatory approves",
    locked: false,
  },
  {
    id: "guest",
    label: "Guest-stay reports",
    short: "Guest stays",
    description: "Not available · no verified legal basis, fields or channel",
    locked: true,
  },
];

const officers: DistrictOfficer[] = [
  {
    id: "alice",
    initials: "AM",
    name: "Alice Mukeshimana (you)",
    body: "Rubavu District",
    jurisdiction: "All 12 sectors",
    permissions: ["verify", "docs", "tax", "propose", "stats"],
    validUntil: "30 Jun 2027",
    validUntilLong: "30 June 2027",
    validNote: "Mandate end",
    status: "Active",
    statusTone: "success",
    identity: null,
    sectorScoped: false,
    isSelf: true,
    editable: false,
    draft: null,
  },
  {
    id: "jc",
    initials: "JM",
    name: "Jean-Claude Mugabo",
    body: "Rubavu District",
    jurisdiction: "All 12 sectors",
    permissions: ["approve", "docs", "tax"],
    validUntil: "30 Jun 2027",
    validUntilLong: "30 June 2027",
    validNote: "Mandate end",
    status: "Active",
    statusTone: "success",
    identity: "Identity verified 28 Aug",
    sectorScoped: false,
    isSelf: false,
    editable: true,
    draft: null,
  },
  {
    id: "vestine",
    initials: "VU",
    name: "Vestine Uwamahoro",
    body: "Gisenyi Sector Office",
    jurisdiction: "Gisenyi sector only",
    permissions: ["verify", "approve", "docs"],
    validUntil: "31 Dec 2026",
    validUntilLong: "31 December 2026",
    validNote: "In 80 days",
    status: "Active · idle 41 days",
    statusTone: "warning",
    identity: "Identity verified 30 Aug",
    sectorScoped: true,
    isSelf: false,
    editable: true,
    draft: null,
  },
  {
    id: "fabrice",
    initials: "FN",
    name: "Fabrice Ndayisaba",
    body: "Rubavu District",
    jurisdiction: "All 12 sectors",
    permissions: ["stats"],
    validUntil: "30 Jun 2027",
    validUntilLong: "30 June 2027",
    validNote: "Starts 15 Oct if approved",
    status: "Awaiting signatory",
    statusTone: "info",
    identity: "Identity verified 8 Oct",
    sectorScoped: false,
    isSelf: false,
    editable: true,
    draft: {
      from: "15 October 2026",
      reason:
        "Fabrice joins the tourism planning team and needs sector occupancy totals for the 2027 destination plan.",
    },
  },
  {
    id: "pacifique",
    initials: "PH",
    name: "Pacifique Habimana",
    body: "Rubavu District",
    jurisdiction: "—",
    permissions: [],
    validUntil: "Ended 30 Sep",
    validUntilLong: "30 September 2026",
    validNote: "Left the district office",
    status: "Revoked",
    statusTone: "default",
    identity: null,
    sectorScoped: false,
    isSelf: false,
    editable: false,
    draft: null,
  },
];

const accessReview: AccessReviewItem[] = [
  { id: "alice", name: "Alice Mukeshimana", note: "Your own access", isSelf: true, decision: null },
  { id: "jc", name: "Jean-Claude Mugabo", note: "Approved 9 cases this quarter", isSelf: false, decision: "keep" },
  {
    id: "vestine",
    name: "Vestine Uwamahoro",
    note: "Last sign-in 1 Sep · 0 cases this quarter",
    isSelf: false,
    decision: null,
  },
  { id: "fabrice", name: "Fabrice Ndayisaba", note: "New · included once approved", isSelf: false, decision: null },
];

const districtSectors: DistrictSector[] = [
  "Bugeshi",
  "Busasamana",
  "Cyanzarwe",
  "Gisenyi",
  "Kanama",
  "Kanzenze",
  "Mudende",
  "Nyakiriba",
  "Nyamyumba",
  "Nyundo",
  "Rubavu",
  "Rugerero",
].map((name) => ({ id: name.toLowerCase(), name }));

const occupancyMonths: OccupancyMonth[] = [
  {
    id: "jul",
    label: "Jul",
    name: "July 2026",
    days: 31,
    occupancy: { gisenyi: 74, rubavu: 61, nyamyumba: 66, rugerero: 60, nyundo: 60 },
    note: "July 2026 · version 1.",
  },
  {
    id: "aug",
    label: "Aug",
    name: "August 2026",
    days: 31,
    occupancy: { gisenyi: 78, rubavu: 63, nyamyumba: 69, rugerero: 60, nyundo: 60 },
    note: "August 2026 · version 2, corrected 14 Sep after 2 businesses resubmitted; version 1 is kept for audit.",
  },
  {
    id: "sep",
    label: "Sep",
    name: "September 2026",
    days: 30,
    occupancy: { gisenyi: 71, rubavu: 58, nyamyumba: 64, rugerero: 60, nyundo: 60 },
    note: "September 2026 · version 1, published 9 Oct.",
  },
];

const occupancySectors: OccupancySector[] = [
  { id: "gisenyi", name: "Gisenyi", businesses: 9, rooms: 412, suppressed: false },
  { id: "rubavu", name: "Rubavu", businesses: 4, rooms: 96, suppressed: false },
  { id: "nyamyumba", name: "Nyamyumba", businesses: 3, rooms: 61, suppressed: false },
  { id: "rugerero", name: "Rugerero", businesses: 2, rooms: 26, suppressed: true },
  { id: "nyundo", name: "Nyundo", businesses: 1, rooms: 12, suppressed: true },
];

const datasetTerms: DatasetTerm[] = [
  { id: "purpose", label: "Purpose", value: "Tourism planning only · not for tax or enforcement against a business" },
  { id: "basis", label: "Legal basis", value: "RD/BDU/2026/118 §4 · sharing terms DSA-RUB-2026-03" },
  { id: "fields", label: "Fields", value: "Sector, month, rooms, room-nights sold, occupancy" },
  { id: "frequency", label: "Frequency", value: "Monthly · published by the 10th" },
];

const reportingRequirements: ReportingRequirement[] = [
  {
    id: "authority",
    title: "Legal authority",
    description: "The rule requiring reports, confirmed by counsel",
    state: "Not provided",
  },
  {
    id: "recipient",
    title: "Recipient and officers",
    description: "Which authority receives it, and who may open it",
    state: "Not verified",
  },
  {
    id: "fields",
    title: "Exact fields",
    description: "Field-by-field list agreed with the authority",
    state: "Not agreed",
  },
  { id: "frequency", title: "Frequency", description: "How often, and the deadline each time", state: "Not agreed" },
  {
    id: "channel",
    title: "Secure channel",
    description: "API, encrypted file or approved manual export",
    state: "Not confirmed",
  },
  {
    id: "retention",
    title: "Retention and sharing",
    description: "How long it is kept, who else may see it",
    state: "Not set",
  },
];

const dataExports: DataExport[] = [
  {
    id: "EX-0019",
    icon: "Clock",
    title: "EX-0019 · September 2026 with unsuppressed sectors",
    detail: "Requested 11 Oct 16:20 by you · waiting for Jean-Claude Mugabo’s review",
    state: "Awaiting second review",
    tone: "warning",
  },
  {
    id: "EX-0018",
    icon: "FileCheck",
    title: "EX-0018 · August 2026, version 2",
    detail: "Encrypted file · exported 15 Sep 10:02 · key delivered by SMS · link expired 16 Sep",
    state: "Downloaded",
    tone: "success",
  },
];

const accessLog: AccessLogEntry[] = [
  {
    id: "log-1012-1041",
    when: "12 Oct 10:41",
    action: "Viewed document",
    record: "VC-0142 · tourism licence p.2",
    purpose: "Business verification",
  },
  {
    id: "log-1012-0902",
    when: "12 Oct 09:02",
    action: "Ran duplicate search",
    record: "VC-0142",
    purpose: "Business verification",
  },
  {
    id: "log-1012-0858",
    when: "12 Oct 08:58",
    action: "Viewed dataset",
    record: "Occupancy by sector · Sep 2026",
    purpose: "Tourism planning",
  },
  {
    id: "log-1011-1620",
    when: "11 Oct 16:20",
    action: "Requested export",
    record: "EX-0019",
    purpose: "Tourism planning",
  },
  {
    id: "log-1011-1502",
    when: "11 Oct 15:02",
    action: "Recorded verification",
    record: "VC-0141",
    purpose: "Business verification",
  },
  {
    id: "log-0915-1002",
    when: "15 Sep 10:02",
    action: "Downloaded export",
    record: "EX-0018",
    purpose: "Tourism planning",
  },
];

const exportChannels: ExportChannel[] = [
  { id: "file", label: "Encrypted file", description: "Approved for this mandate", approved: true },
  { id: "api", label: "API", description: "Not available · not set up with the District", approved: false },
  { id: "email", label: "Email attachment", description: "Not permitted for delegated data", approved: false },
];

const applications: MembershipApplication[] = [
  {
    id: "APP-0318",
    initials: "AH",
    business: "Amahoro Hospitality Ltd",
    tin: "102 345 678",
    category: "Accommodation · hotel and lodge",
    place: "Rubavu and Nyamagabe",
    submitted: "3 Oct",
    status: "review",
    since: "6 Oct",
    decidedOn: null,
    establishments: "Isangano Lakeside Hotel (42 rooms) · Ishyamba Forest Lodge (18 tents)",
    contact: "Didier Mugenzi, owner",
    fee: "verified",
    feeLine:
      "Chamber invoice CT-INV-2026-0318 · RWF 200,000 · MTN MoMo · ref MP261004.1422.C77310 · confirmed by provider 4 Oct 14:22",
    memberNo: "CT-ACC-2026-0412",
    missingLicence: "Tourism licence for Ishyamba Forest Lodge",
    licenceExempt: false,
  },
  {
    id: "APP-0322",
    initials: "AR",
    business: "Amahoro Residences Ltd",
    tin: "102 345 990",
    category: "Residence class · serviced apartments",
    place: "Gasabo, Kigali",
    submitted: "5 Oct",
    status: "new",
    since: null,
    decidedOn: null,
    establishments: "Kacyiru Court Residences (24 units)",
    contact: "Solange Uwimana, residence manager",
    fee: "none",
    feeLine: "No Chamber invoice has been issued for this application yet.",
    memberNo: "CT-RES-2026-0031",
    missingLicence: null,
    licenceExempt: true,
  },
  {
    id: "APP-0325",
    initials: "KS",
    business: "Kivu Sunset Guesthouse Ltd",
    tin: "112 908 334",
    category: "Accommodation · guesthouse",
    place: "Rubavu",
    submitted: "8 Oct",
    status: "new",
    since: null,
    decidedOn: null,
    establishments: "Kivu Sunset Guesthouse (9 rooms)",
    contact: "Owner",
    fee: "pending",
    feeLine:
      "Chamber invoice CT-INV-2026-0325 · RWF 120,000 · Airtel Money initiated 9 Oct 16:02 · waiting for provider confirmation",
    memberNo: "CT-ACC-2026-0413",
    missingLicence: null,
    licenceExempt: false,
  },
  {
    id: "APP-0327",
    initials: "KH",
    business: "Kigali Heights Suites Ltd",
    tin: "110 774 503",
    category: "Accommodation · hotel",
    place: "Gasabo, Kigali",
    submitted: "10 Oct",
    status: "new",
    since: null,
    decidedOn: null,
    establishments: "Kigali Heights Suites (64 rooms)",
    contact: "General manager",
    fee: "unknown",
    feeLine:
      "Card payment through the GT Bank adapter timed out on 10 Oct 18:40. Unknown — checking with provider; do not treat as paid or failed.",
    memberNo: "CT-ACC-2026-0414",
    missingLicence: null,
    licenceExempt: false,
  },
  {
    id: "APP-0311",
    initials: "NC",
    business: "Nyungwe Canopy Tours Ltd",
    tin: "111 352 870",
    category: "Tour operator",
    place: "Nyamasheke",
    submitted: "29 Sep",
    status: "info",
    since: null,
    decidedOn: null,
    establishments: "Tour operations · no accommodation",
    contact: "Managing director",
    fee: "pending",
    feeLine: "Chamber invoice CT-INV-2026-0311 · RWF 150,000 · bank transfer not yet confirmed by GT Bank",
    memberNo: "CT-TOP-2026-0088",
    missingLicence: null,
    licenceExempt: true,
  },
  {
    id: "APP-0309",
    initials: "MG",
    business: "Musanze Gorilla Lodge Ltd",
    tin: "107 610 245",
    category: "Accommodation · lodge",
    place: "Musanze",
    submitted: "26 Sep",
    status: "review",
    since: "30 Sep",
    decidedOn: null,
    establishments: "Musanze Gorilla Lodge (22 rooms)",
    contact: "Owner",
    fee: "verified",
    feeLine:
      "Chamber invoice CT-INV-2026-0309 · RWF 200,000 · bank transfer via GT Bank · ref FT26270X91K · confirmed 27 Sep 11:05",
    memberNo: "CT-ACC-2026-0410",
    missingLicence: null,
    licenceExempt: false,
  },
  {
    id: "APP-0314",
    initials: "HH",
    business: "Huye Heritage Inn Ltd",
    tin: "106 228 914",
    category: "Accommodation · hotel",
    place: "Huye",
    submitted: "1 Oct",
    status: "review",
    since: "3 Oct",
    decidedOn: null,
    establishments: "Huye Heritage Inn (30 rooms)",
    contact: "Owner",
    fee: "verified",
    feeLine:
      "Chamber invoice CT-INV-2026-0314 · RWF 200,000 · MTN MoMo · ref MP261001.0915.B22841 · confirmed 1 Oct 09:16",
    memberNo: "CT-ACC-2026-0411",
    missingLicence: null,
    licenceExempt: false,
  },
  {
    id: "APP-0316",
    initials: "RB",
    business: "Rubona Bay Cottages Ltd",
    tin: "113 045 662",
    category: "Accommodation · cottages",
    place: "Rubavu",
    submitted: "2 Oct",
    status: "review",
    since: "7 Oct",
    decidedOn: null,
    establishments: "Rubona Bay Cottages (6 units)",
    contact: "Owner",
    fee: "pending",
    feeLine: "Chamber invoice CT-INV-2026-0316 · RWF 120,000 · MTN MoMo initiated 2 Oct · provider has not confirmed",
    memberNo: "CT-ACC-2026-0409",
    missingLicence: null,
    licenceExempt: false,
  },
  {
    id: "APP-0301",
    initials: "LK",
    business: "Lake Kivu Waterfront Ltd",
    tin: "105 118 307",
    category: "Accommodation · hotel",
    place: "Karongi",
    submitted: "19 Sep",
    status: "approved",
    since: "22 Sep",
    decidedOn: "30 Sep",
    establishments: "Lake Kivu Waterfront (36 rooms)",
    contact: "Owner",
    fee: "verified",
    feeLine: "Chamber invoice CT-INV-2026-0301 · RWF 200,000 · confirmed 20 Sep",
    memberNo: "CT-ACC-2026-0398",
    missingLicence: null,
    licenceExempt: false,
  },
  {
    id: "APP-0298",
    initials: "NR",
    business: "Nyamata Rest House Ltd",
    tin: "104 902 551",
    category: "Accommodation · rest house",
    place: "Bugesera",
    submitted: "15 Sep",
    status: "rejected",
    since: "18 Sep",
    decidedOn: "28 Sep",
    establishments: "Nyamata Rest House (8 rooms)",
    contact: "Owner",
    fee: "none",
    feeLine: "No invoice issued.",
    memberNo: "",
    missingLicence: null,
    licenceExempt: false,
  },
];

const chamberMembers: ChamberMember[] = [
  {
    id: "gisenyi-beach",
    name: "Gisenyi Beach Lodge Ltd",
    tin: "109 554 210",
    detail: "member since 2023",
    status: "Member · until 31 Dec 2026",
    tone: "success",
    application: null,
  },
  {
    id: "gisenyi-garden",
    name: "Gisenyi Garden Hotel Ltd",
    tin: "108 003 417",
    detail: "lapsed 31 Dec 2025",
    status: "Lapsed",
    tone: "default",
    application: null,
  },
  {
    id: "amahoro",
    name: "Amahoro Hospitality Ltd",
    tin: "102 345 678",
    detail: "application APP-0318",
    status: "Under review",
    tone: "accent",
    application: "APP-0318",
  },
  {
    id: "lake-kivu",
    name: "Lake Kivu Waterfront Ltd",
    tin: "105 118 307",
    detail: "CT-ACC-2026-0398",
    status: "Member · until 31 Dec 2027",
    tone: "success",
    application: null,
  },
  {
    id: "huye",
    name: "Huye Heritage Inn Ltd",
    tin: "106 228 914",
    detail: "application APP-0314",
    status: "Under review",
    tone: "accent",
    application: "APP-0314",
  },
];

export const fixtures = {
  "oversight.mandateStates": mandateStates,
  "oversight.mandateFacts": mandateFacts,
  "oversight.mandateExclusions": mandateExclusions,
  "oversight.queueKpis": queueKpis,
  "oversight.cases": cases,
  "oversight.recentDecisions": recentDecisions,
  "oversight.mandateRules": mandateRules,
  "oversight.caseFiles": caseFiles,
  "oversight.rejectionReasons": rejectionReasons,
  "oversight.bodies": bodies,
  "oversight.permissions": permissions,
  "oversight.officers": officers,
  "oversight.accessReview": accessReview,
  "oversight.districtSectors": districtSectors,
  "oversight.occupancyMonths": occupancyMonths,
  "oversight.occupancySectors": occupancySectors,
  "oversight.datasetTerms": datasetTerms,
  "oversight.reportingRequirements": reportingRequirements,
  "oversight.dataExports": dataExports,
  "oversight.accessLog": accessLog,
  "oversight.exportChannels": exportChannels,
  "oversight.applications": applications,
  "oversight.chamberMembers": chamberMembers,
} satisfies FixtureSet;
