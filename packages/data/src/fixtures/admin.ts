import type { BoardId, FixtureSet, IconName } from "../types.ts";

/**
 * Embedded-database fixtures for the "admin" area: the Injishi admin console used by platform staff
 * (Control tower, Businesses and KYB, Platform money, Platform health, Support and moderation).
 * Collection names are "admin.<thing>"; every document has a stable string `id`.
 * Values are lifted verbatim from the artifact boards (node tools/artifact/extract.mjs <Board>).
 */

export type Tone = "accent" | "success" | "warning" | "danger" | "default" | "info";

/** Marker tone of a timeline entry. */
export type EventStatus = "default" | "current" | "success" | "warning" | "danger";

export interface Fact {
  label: string;
  value: string;
}

// ── Control tower (AdminHome) ────────────────────────────────────────────────

export type TriageCategory = "incident" | "kyb" | "fiscal" | "jobs" | "support" | "recon" | "deploy";

export interface TriageEvent {
  when: string;
  who: string;
  text: string;
  status: EventStatus;
}

/** An item in the control-tower triage queue. `owner: null` = unassigned. */
export interface TriageItem {
  id: string;
  category: TriageCategory;
  /** Severity dot (default = informational). */
  severity: "danger" | "warning" | "default";
  title: string;
  scope: string;
  owner: string | null;
  age: string;
  state: string;
  stateTone: Tone;
  /** Screen the primary action opens, with its label. */
  board: BoardId;
  cta: string;
  detail: string;
  impact: string;
  facts: Fact[];
  log: TriageEvent[];
}

export interface AdminKpi {
  id: string;
  label: string;
  /** Numeric value, formatted with `format` (Intl.NumberFormat options). */
  value: number;
  format?: {
    style?: "decimal" | "currency";
    currency?: string;
    notation?: "standard" | "compact";
    maximumSignificantDigits?: number;
  };
  foot: string;
  icon: IconName;
  status: "danger" | "warning" | "default";
  board: BoardId;
}

export interface Deploy {
  id: string;
  status: EventStatus;
  icon: IconName;
  title: string;
  detail: string;
}

export interface OnCallShift {
  id: string;
  name: string;
  role: string;
  /** What the person is carrying right now (an incident, a count of items). */
  load: string;
  tone: Tone;
}

/** A recorded "view as" session of a staff member inside a tenant workspace. */
export interface ViewAsSession {
  id: string;
  businessId: string;
  business: string;
  staff: string;
  mode: string;
  ticket: string;
  /** Start time (today) or date. */
  started: string;
  status: "open" | "ended";
  events: number;
  /** Open sessions. */
  ends?: string;
  minutesLeft?: number;
  /** Ended sessions. */
  duration?: string;
  endedBy?: string;
}

// ── Businesses and KYB (AdminBusinesses) ─────────────────────────────────────

export type LifecycleStage = "draft" | "review" | "active" | "suspended";

export interface LifecycleCount {
  id: "all" | LifecycleStage;
  label: string;
  count: number;
}

export type Plan = "Starter" | "Growth" | "Group" | "Residence";

export type KybDocState = "verified" | "unchecked" | "reupload" | "missing" | "conflict" | "mismatch" | "expired";

/** A KYB document type every business submits, with the note shown once a reviewer verified it. */
export interface KybDocumentType {
  id: string;
  name: string;
  verifiedNote: string;
}

export interface BusinessDocument {
  type: string;
  state: KybDocState;
  /** Shown while the document is not verified. */
  note?: string;
  /** Overrides the state label (e.g. "Expired 30 Sep"). */
  label?: string;
}

export interface BusinessTicket {
  id: string;
  note: string;
}

export interface Business {
  id: string;
  name: string;
  kind: string;
  entity: string;
  tin: string;
  owner: string;
  stage: LifecycleStage;
  kyb: string;
  plan: Plan;
  reviewer: string;
  /** Time in the current lifecycle stage. */
  age: string;
  documents: BusinessDocument[];
  /** Open support ticket a view-as session can be linked to. */
  ticket: BusinessTicket | null;
  /** Whether the owner must consent before staff can view the workspace. */
  consent: "notify" | "consent";
  /** Pre-filled "what you need to check" for a view-as session. */
  why: string;
  /** Entitlement grant or billing note. */
  grant: string;
  history: { when: string; text: string; status: EventStatus }[];
}

export type Availability = "included" | "addon" | "none";

export interface Entitlement {
  id: string;
  name: string;
  plans: Record<Plan, Availability>;
}

// ── Platform money (AdminMoney) ──────────────────────────────────────────────

export interface LedgerAccount {
  id: string;
  label: string;
  /** Balance in RWF; null when the account is not enabled. */
  value: number | null;
  /** Shown instead of a balance when `value` is null. */
  status?: string;
  foot: string;
  icon: IconName;
  chip?: string;
  chipTone?: Tone;
  locked?: boolean;
}

export type AccountGroup = "rev" | "recv" | "pay" | "def" | "bank";

export interface LedgerPosting {
  id: string;
  at: string;
  event: string;
  source: string;
  debit: string;
  credit: string;
  amount: number;
  evidence: string;
  groups: AccountGroup[];
  reversal?: boolean;
}

export interface ReconException {
  ref: string;
  amount: number;
  memo: string;
  note: string;
  label: string;
  tone: Tone;
}

export interface ReconRun {
  id: string;
  source: string;
  date: string;
  lines: number;
  matched: number;
  state: string;
  tone: Tone;
  exceptions: ReconException[];
}

export interface OverrideStep {
  title: string;
  desc: string;
  status: "complete" | "active" | "inactive";
}

export interface MoneyOverride {
  id: string;
  short: string;
  state: string;
  tone: Tone;
  reason: string;
  amount: number;
  source: string;
  /** Waiting for the second approver. */
  awaiting: boolean;
  outcome?: string;
  steps: OverrideStep[];
  evidence: string[];
  postings: { side: "Dr" | "Cr"; account: string; amount: number }[];
}

// ── The money desk (AdminMoney's first lens, 073-gtbank-payments AC-19) ─────

export type MoneyBucket = "parked" | "reversals" | "owed" | "short" | "over_limit" | "waiting_on_payer";

export interface MoneyDeskRow {
  id: string;
  bucket: MoneyBucket;
  /** Ours (`INJ…`). */
  reference: string;
  providerReference: string | null;
  direction: string;
  operation: string;
  amount: number;
  status: string;
  reason: string | null;
  /** The wallet, masked. */
  party: string | null;
  bookingReference: string | null;
  /** How long it has waited ("3 min", "2 h"). */
  age: string;
  pendingOverride: { id: string; action: string } | null;
}

export interface MoneyDeskOverride {
  id: string;
  action: string;
  state: string;
  reason: string;
  subjectReference: string | null;
  amount: number | null;
  initiatedBy: string;
  createdAt: string;
  /** A super admin who did not request it. */
  canDecide: boolean;
}

export interface MoneyDesk {
  id: string;
  /** "none" for a staff role that cannot read finance (ops, compliance). */
  access: "full" | "none";
  provider: string;
  mode: string;
  available: number;
  inFlight: number;
  queued: number;
  parked: number;
  lastRun: string | null;
  counts: Record<MoneyBucket, number>;
  rows: MoneyDeskRow[];
  overrides: MoneyDeskOverride[];
  canRequest: boolean;
  canDecide: boolean;
}

// ── Platform health (AdminHealth) ────────────────────────────────────────────

export interface Incident {
  id: string;
  title: string;
  severity: string;
  tone: Tone;
  summary: string;
}

/** Values per time window: last 15 minutes, last hour, last 24 hours. */
export type Windowed = [string, string, string];

export interface Adapter {
  id: string;
  icon: IconName;
  name: string;
  endpoint: string;
  status: "Healthy" | "Degraded" | "Partial" | "Up" | "Not verified";
  p95: Windowed;
  errors: Windowed;
  note: string;
}

export interface DeadLetter {
  id: string;
  queue: string;
  ref: string;
  reason: string;
  attempts: number;
  since: string;
  replayable: boolean;
}

export interface QueueStat {
  id: string;
  depth: number;
  oldest: string;
  retry: string;
  deadLetters: number;
}

export interface SchedulerRun {
  id: string;
  runs: string;
  lastRun: string;
  result: string;
  tone: Tone;
  next: string;
}

export interface Sweep {
  id: string;
  name: string;
  rule: string;
  lastRun: string;
  result: string;
  tone: Tone;
  next: string;
}

/** A health panel (outbox, realtime, storage, backup): status, figures and notes. */
export interface HealthPanel {
  id: "outbox" | "realtime" | "storage" | "backup";
  state?: string;
  tone?: Tone;
  facts: Fact[];
  /** Outbox publish lag in seconds, one point every 5 minutes over the last hour. */
  series?: { at: string; lag: number }[];
  /** Storage used and capacity in TB. */
  used?: number;
  capacity?: number;
  notes?: { tone: Tone | null; text: string }[];
  /** Outlined gate notes (unverified or external conditions). */
  gates?: string[];
}

export interface ErrorGroup {
  id: string;
  title: string;
  meta: string;
  state: string;
  tone: Tone;
}

export type StageState = "success" | "accent" | "warning" | "pending";

export interface Pipeline {
  id: string;
  service: string;
  version: string;
  /** Build, Tests, Security, Staging, Canary, Production. */
  stages: StageState[];
  status: string;
  tone: Tone;
  next: string;
}

// ── Support and moderation (AdminSupport) ────────────────────────────────────

export interface SupportTicket {
  id: string;
  tenant: string;
  subject: string;
  from: string;
  owner: string | null;
  age: string;
  priority: "High" | "Normal" | "Low";
  state: string;
  tone: Tone;
  /** Handed off from the assistant with the conversation. */
  handoff: boolean;
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  author: string;
  role: string;
  when: string;
  text: string;
  kind: "staff" | "note" | "tenant";
}

export interface TranscriptMessage {
  id: string;
  ticketId: string;
  from: "user" | "assistant";
  text: string;
}

export interface ModerationReport {
  id: string;
  kind: "threads" | "reviews" | "listings";
  title: string;
  excerpt: string;
  policy: string;
  by: string;
  age: string;
  /** Label of the enforcement action. */
  action: string;
}

export interface Dispute {
  id: string;
  icon: IconName;
  title: string;
  meta: string;
  state: string;
  tone: Tone;
}

export interface Announcement {
  id: string;
  title: string;
  audience: string;
  audiences: { id: string; label: string }[];
  channels: { banner: boolean; email: boolean; sms: boolean };
  english: string;
  kinyarwanda: string;
}

// ── Data ─────────────────────────────────────────────────────────────────────

const triage: TriageItem[] = [
  {
    id: "INC-0192",
    category: "incident",
    severity: "danger",
    title: "GT Bank webhook delivery delayed",
    scope: "23 tenants · payments",
    owner: "Samuel Nkusi",
    age: "47 min",
    state: "Mitigating · Sev 2",
    stateTone: "danger",
    board: "AdminHealth",
    cta: "Open in Health",
    detail:
      "Payment callbacks from the GT Bank adapter (sandbox endpoint used by pilot tenants) are arriving 9 to 14 minutes late.",
    impact:
      "Affected payment intents stay Pending or Unknown — checking with provider. Nothing is marked Verified until the provider confirms. The 2-minute status poll is running as a fallback.",
    facts: [
      { label: "Started", value: "08:55 CAT" },
      { label: "Callback lag p95", value: "11 min 20 s" },
      { label: "Intents waiting", value: "37 · RWF 6.1M" },
      { label: "Duplicate postings", value: "0" },
    ],
    log: [
      { when: "09:40", who: "Samuel Nkusi", text: "Bank service request raised with GT Bank", status: "current" },
      {
        when: "09:02",
        who: "Samuel Nkusi",
        text: "Status polling fallback enabled for all tenants",
        status: "success",
      },
      { when: "08:55", who: "Monitor", text: "Callback lag above 5 minutes", status: "danger" },
    ],
  },
  {
    id: "INC-0193",
    category: "incident",
    severity: "warning",
    title: "VSDC provider A responding slowly",
    scope: "11 tenants · fiscal receipts",
    owner: "Fabrice Iradukunda",
    age: "1 h 12 min",
    state: "Investigating · Sev 3",
    stateTone: "warning",
    board: "AdminHealth",
    cta: "Open in Health",
    detail:
      "Fiscal receipt requests to VSDC provider A take 6.8 s at p95 against a usual 1.2 s. Some requests time out and are retried.",
    impact:
      "Receipts stay Pending and are retried with the same request ID, so no receipt is issued twice. Tenants see “Fiscal receipt pending” on folios.",
    facts: [
      { label: "p95 latency", value: "6.8 s (usual 1.2 s)" },
      { label: "Pending receipts", value: "46 across 11 tenants" },
      { label: "Rejected", value: "0" },
      { label: "Provider status page", value: "No notice posted" },
    ],
    log: [
      { when: "09:15", who: "Fabrice Iradukunda", text: "Retry interval raised to 5 minutes", status: "current" },
      { when: "08:30", who: "Monitor", text: "Latency above 4 s for 10 minutes", status: "warning" },
    ],
  },
  {
    id: "FQ-1012",
    category: "fiscal",
    severity: "warning",
    title: "Fiscal queue backlog across tenants",
    scope: "46 receipts · 11 tenants",
    owner: "Fabrice Iradukunda",
    age: "2 h 14 min",
    state: "Retrying",
    stateTone: "warning",
    board: "AdminHealth",
    cta: "Open queue",
    detail:
      "Oldest pending receipts are at Isangano Lakeside Hotel (3 over 2 hours) and Akagera Plains Camp (5 over 1 hour). Linked to INC-0193.",
    impact:
      "Folios cannot show an issued fiscal receipt until VSDC answers. Corrections, if needed, will be credit notes, never edits.",
    facts: [
      { label: "Pending", value: "46" },
      { label: "Oldest", value: "Isangano · 2 h 14 min" },
      { label: "Issued last hour", value: "118" },
      { label: "Same request ID reused", value: "Yes" },
    ],
    log: [
      { when: "09:30", who: "Fiscal worker", text: "118 issued, 46 still pending", status: "current" },
      { when: "07:28", who: "Fiscal worker", text: "First timeout from provider A", status: "warning" },
    ],
  },
  {
    id: "KYB-3318",
    category: "kyb",
    severity: "danger",
    title: "KYB review · Kivu Sunset Guesthouse",
    scope: "Karongi · guest house · 8 rooms",
    owner: "Bosco Rutayisire",
    age: "3 d 4 h",
    state: "Over 48 h target",
    stateTone: "danger",
    board: "AdminBusinesses",
    cta: "Open review",
    detail:
      "Documents submitted 9 October. TIN and RDB certificate match the registries. The tourism operating licence upload failed and the owner is re-sending it.",
    impact:
      "The workspace cannot take bookings or payments until KYB is approved. The owner has a support ticket open (SUP-4127).",
    facts: [
      { label: "TIN 109 882 341", value: "Matched RRA record" },
      { label: "RDB certificate", value: "Matched" },
      { label: "Tourism licence", value: "Re-upload pending" },
      { label: "Owner ID", value: "Verified" },
    ],
    log: [
      { when: "09:38", who: "Ange Ishimwe", text: "Read-only view-as started for SUP-4127", status: "current" },
      { when: "11 Oct", who: "Bosco Rutayisire", text: "Asked owner for a clearer licence scan", status: "default" },
      { when: "9 Oct", who: "Owner", text: "Documents submitted", status: "default" },
    ],
  },
  {
    id: "KYB-3324",
    category: "kyb",
    severity: "warning",
    title: "KYB review · Nyungwe Canopy Eco Lodge",
    scope: "Nyamasheke · lodge · 12 tents",
    owner: null,
    age: "1 d 6 h",
    state: "Licence date mismatch",
    stateTone: "warning",
    board: "AdminBusinesses",
    cta: "Open review",
    detail:
      "The licence certificate shows expiry 30 Sep 2026, but the owner entered 30 Sep 2027. A reviewer must compare against the RDB record.",
    impact: "No reviewer has picked this up. It breaches the 48-hour target tomorrow at 03:40.",
    facts: [
      { label: "Submitted", value: "11 Oct 03:40" },
      { label: "TIN", value: "Matched RRA record" },
      { label: "Licence expiry", value: "Conflicting" },
      { label: "Queue position", value: "2 of 7" },
    ],
    log: [{ when: "11 Oct", who: "Owner", text: "Documents submitted", status: "default" }],
  },
  {
    id: "KYB-3329",
    category: "kyb",
    severity: "warning",
    title: "Unblock request · Huye Campus Inn",
    scope: "Huye · guest house · draft",
    owner: null,
    age: "5 h",
    state: "Blocked at TIN gate",
    stateTone: "warning",
    board: "AdminBusinesses",
    cta: "Open business",
    detail:
      "The registered name at RRA is “Huye Campus Hospitality Ltd”; the owner typed “Huye Campus Inn”. The TIN gate blocked registration.",
    impact: "Unblocking needs evidence that both names belong to one legal entity. Staff cannot edit the RRA record.",
    facts: [
      { label: "TIN", value: "110 457 802" },
      { label: "Name match", value: "Partial" },
      { label: "Evidence uploaded", value: "RDB extract" },
      { label: "Requested by", value: "Owner via help form" },
    ],
    log: [{ when: "04:40", who: "Owner", text: "Unblock requested with RDB extract", status: "default" }],
  },
  {
    id: "DLQ-0412",
    category: "jobs",
    severity: "warning",
    title: "Dead letters waiting for replay",
    scope: "9 messages · 3 queues",
    owner: "Samuel Nkusi",
    age: "38 min",
    state: "Needs replay",
    stateTone: "warning",
    board: "AdminHealth",
    cta: "Open dead letters",
    detail:
      "payments.callback (5), notifications.sms (3) and fiscal.issue (1) messages exhausted retries during the incidents.",
    impact: "Replays reuse the original idempotency key, so a replay cannot create a second posting or receipt.",
    facts: [
      { label: "payments.callback", value: "5" },
      { label: "notifications.sms", value: "3" },
      { label: "fiscal.issue", value: "1" },
      { label: "Replayable", value: "8 of 9" },
    ],
    log: [{ when: "09:04", who: "Queue monitor", text: "Dead-letter count above threshold", status: "warning" }],
  },
  {
    id: "JOB-8841",
    category: "jobs",
    severity: "warning",
    title: "Night audit failed · Ishyamba Forest Lodge",
    scope: "Amahoro Hospitality Group",
    owner: "Fabrice Iradukunda",
    age: "7 h 42 min",
    state: "Retry at 10:00",
    stateTone: "warning",
    board: "AdminHealth",
    cta: "Open job",
    detail:
      "Business day 11 October did not close: 2 folios had fiscal receipts still Pending when the audit ran at 02:00.",
    impact:
      "The tenant can operate normally. Their finance view shows the day as not closed until the audit completes.",
    facts: [
      { label: "Attempts", value: "3" },
      { label: "Blocking", value: "2 pending receipts" },
      { label: "Next attempt", value: "10:00 CAT" },
      { label: "Tenant told", value: "In-app notice" },
    ],
    log: [{ when: "02:00", who: "Scheduler", text: "Night audit run failed on attempt 3", status: "danger" }],
  },
  {
    id: "SUP-4131",
    category: "support",
    severity: "warning",
    title: "Guest reports two MoMo debits for BK-20433",
    scope: "Amahoro · Isangano Lakeside Hotel",
    owner: "Kevin Mugisha",
    age: "2 h 5 min",
    state: "Escalated",
    stateTone: "info",
    board: "AdminSupport",
    cta: "Open ticket",
    detail:
      "Handed off from the assistant. PI-77142 has one Verified attempt and one Unknown attempt caught in the callback delay.",
    impact: "The tenant decides any refund. Injishi support explains provider status and does not move tenant money.",
    facts: [
      { label: "Payment intent", value: "PI-77142" },
      { label: "Attempt 1", value: "Unknown — checking" },
      { label: "Attempt 2", value: "Verified · MTN MoMo" },
      { label: "Linked incident", value: "INC-0192" },
    ],
    log: [
      { when: "09:20", who: "Kevin Mugisha", text: "Linked to INC-0192 and replied to tenant", status: "current" },
      { when: "07:37", who: "Assistant", text: "Handed off with transcript", status: "default" },
    ],
  },
  {
    id: "DSP-0042",
    category: "support",
    severity: "default",
    title: "Broker fee dispute · Kacyiru Court Residences",
    scope: "Emmanuel Twagira · RWF 325,000",
    owner: "Nadine Kayitesi",
    age: "3 d",
    state: "Awaiting evidence",
    stateTone: "default",
    board: "AdminSupport",
    cta: "Open dispute",
    detail: "The landlord disputes a placement fee for unit B-11, saying the tenant found the unit directly.",
    impact:
      "The fee stays unpaid while disputed. Only the fee disclosed under the effective broker terms can be charged.",
    facts: [
      { label: "Placement", value: "L-KC-031" },
      { label: "Fee terms", value: "Broker terms v2" },
      { label: "Evidence due", value: "15 Oct" },
      { label: "Reveal log", value: "Available" },
    ],
    log: [{ when: "9 Oct", who: "Landlord", text: "Dispute opened", status: "default" }],
  },
  {
    id: "RR-1011",
    category: "recon",
    severity: "warning",
    title: "GT Bank statement 11 Oct · 3 unmatched lines",
    scope: "Injishi collections account · RWF 1,360,000",
    owner: "Yvonne Mutesi",
    age: "9 h",
    state: "Override pending",
    stateTone: "warning",
    board: "AdminMoney",
    cta: "Open reconciliation",
    detail:
      "209 of 212 statement lines matched platform invoices. One split payment, one unidentified transfer and one bank charge remain.",
    impact:
      "Platform revenue is not affected until matched. The split payment needs a dual-authorised override (OVR-0031).",
    facts: [
      { label: "Matched", value: "209 of 212" },
      { label: "Unmatched value", value: "RWF 1,360,000" },
      { label: "Override", value: "OVR-0031 · awaiting approver" },
      { label: "Ledger balanced", value: "Yes" },
    ],
    log: [
      { when: "09:05", who: "Yvonne Mutesi", text: "Requested override OVR-0031", status: "current" },
      { when: "00:40", who: "Recon run", text: "Statement imported and matched", status: "default" },
    ],
  },
  {
    id: "DEP-0977",
    category: "deploy",
    severity: "default",
    title: "Web 2026.10.12.1 on canary",
    scope: "Operator web app · 25% of sessions",
    owner: "Fabrice Iradukunda",
    age: "22 min",
    state: "Canary healthy",
    stateTone: "success",
    board: "AdminHealth",
    cta: "Open pipeline",
    detail: "Fixes the folio split dialog error. Error rate on canary 0.21% against 0.24% on the current release.",
    impact: "Promotion is held only for payment services during INC-0192; this release does not touch payments.",
    facts: [
      { label: "Canary share", value: "25%" },
      { label: "Error rate", value: "0.21%" },
      { label: "Crash-free sessions", value: "99.8%" },
      { label: "Promote after", value: "10:20" },
    ],
    log: [{ when: "09:20", who: "Pipeline", text: "Canary started at 25%", status: "current" }],
  },
];

const homeKpis: AdminKpi[] = [
  {
    id: "incidents",
    label: "Open incidents",
    value: 2,
    foot: "Sev 2 payments · Sev 3 fiscal",
    icon: "TriangleExclamation",
    status: "danger",
    board: "AdminHealth",
  },
  {
    id: "kyb",
    label: "KYB waiting",
    value: 7,
    foot: "Oldest 3 d 4 h · 2 unassigned",
    icon: "FolderHouse",
    status: "warning",
    board: "AdminBusinesses",
  },
  {
    id: "fiscal",
    label: "Fiscal backlog",
    value: 46,
    foot: "Pending at VSDC · 11 tenants",
    icon: "FileExclamation",
    status: "warning",
    board: "AdminHealth",
  },
  {
    id: "jobs",
    label: "Failed jobs and dead letters",
    value: 10,
    foot: "1 failed job · 9 dead letters",
    icon: "ArrowsRotateLeft",
    status: "warning",
    board: "AdminHealth",
  },
  {
    id: "support",
    label: "Support escalations",
    value: 4,
    foot: "12 open tickets · 2 near SLA",
    icon: "LifeRing",
    status: "default",
    board: "AdminSupport",
  },
  {
    id: "recon",
    label: "Reconciliation breaks",
    value: 1360000,
    format: { style: "currency", currency: "RWF", notation: "compact", maximumSignificantDigits: 3 },
    foot: "3 lines · GT Bank 11 Oct",
    icon: "ScalesUnbalanced",
    status: "warning",
    board: "AdminMoney",
  },
];

const deploys: Deploy[] = [
  {
    id: "web-2026.10.12.1",
    status: "current",
    icon: "CirclePlay",
    title: "Web 2026.10.12.1 · canary 25%",
    detail: "09:20 today · Fabrice Iradukunda · error rate normal",
  },
  {
    id: "worker-2026.10.11.3",
    status: "success",
    icon: "Check",
    title: "Worker 2026.10.11.3 · production",
    detail: "11 Oct 18:20 · Samuel Nkusi · fiscal retry backoff",
  },
  {
    id: "api-2026.10.11.2",
    status: "success",
    icon: "Check",
    title: "API 2026.10.11.2 · production",
    detail: "11 Oct 16:05 · Fabrice Iradukunda · audit export paging",
  },
  {
    id: "staff-app-1.14.2",
    status: "default",
    icon: "Smartphone",
    title: "Staff app 1.14.2 · store rollout 50%",
    detail: "10 Oct · crash on photo upload under review",
  },
];

const onCall: OnCallShift[] = [
  { id: "samuel", name: "Samuel Nkusi", role: "Engineering · primary", load: "INC-0192", tone: "danger" },
  { id: "fabrice", name: "Fabrice Iradukunda", role: "Engineering · secondary", load: "INC-0193", tone: "warning" },
  { id: "kevin", name: "Kevin Mugisha", role: "Support lead · you", load: "3 items", tone: "default" },
  { id: "yvonne", name: "Yvonne Mutesi", role: "Platform finance", load: "RR-1011", tone: "default" },
  { id: "bosco", name: "Bosco Rutayisire", role: "Compliance · KYB", load: "7 reviews", tone: "default" },
];

const viewAsSessions: ViewAsSession[] = [
  {
    id: "VS-0384",
    businessId: "kivu",
    business: "Kivu Sunset Guesthouse",
    staff: "Ange Ishimwe",
    mode: "read-only",
    ticket: "SUP-4127",
    started: "09:38",
    status: "open",
    events: 4,
    ends: "10:08",
    minutesLeft: 26,
  },
  {
    id: "VS-0381",
    businessId: "kivu",
    business: "Kivu Sunset Guesthouse",
    staff: "Ange Ishimwe",
    mode: "read-only",
    ticket: "SUP-4127",
    started: "11 Oct",
    status: "ended",
    events: 14,
    duration: "22 min",
    endedBy: "staff",
  },
];

const lifecycleCounts: LifecycleCount[] = [
  { id: "all", label: "All", count: 211 },
  { id: "draft", label: "Draft", count: 19 },
  { id: "review", label: "In review", count: 7 },
  { id: "active", label: "Active", count: 181 },
  { id: "suspended", label: "Suspended", count: 4 },
];

const kybDocumentTypes: KybDocumentType[] = [
  { id: "rdb", name: "RDB certificate of incorporation", verifiedNote: "Matched RDB registry extract" },
  { id: "tin", name: "RRA TIN certificate", verifiedNote: "Matched RRA TIN record" },
  { id: "licence", name: "Tourism operating licence", verifiedNote: "Reviewer checked certificate and dates" },
  { id: "id", name: "Owner national ID", verifiedNote: "Reviewer matched ID to selfie" },
  { id: "bank", name: "Bank account confirmation", verifiedNote: "GT Bank letter · account name matches" },
];

const allVerified: BusinessDocument[] = [
  { type: "rdb", state: "verified" },
  { type: "tin", state: "verified" },
  { type: "licence", state: "verified" },
  { type: "id", state: "verified" },
  { type: "bank", state: "verified" },
];

const businesses: Business[] = [
  {
    id: "kivu",
    name: "Kivu Sunset Guesthouse",
    kind: "Guest house · Karongi · 8 rooms",
    entity: "Kivu Sunset Ltd",
    tin: "109 882 341",
    owner: "Theoneste Bizimana",
    stage: "review",
    kyb: "3 of 5 checked",
    plan: "Starter",
    reviewer: "Bosco Rutayisire",
    age: "3 d 4 h",
    documents: [
      { type: "rdb", state: "verified" },
      { type: "tin", state: "verified" },
      { type: "licence", state: "reupload", note: "Upload failed twice · owner re-sending (SUP-4127)" },
      { type: "id", state: "verified" },
      { type: "bank", state: "unchecked", note: "Uploaded 9 Oct · waiting for a reviewer" },
    ],
    ticket: { id: "SUP-4127", note: "Open · “Tourism licence upload rejected” · assigned to Ange Ishimwe" },
    consent: "notify",
    why: "Owner says the tourism licence upload is rejected. Check the file type and size limits on the registration documents step.",
    grant: "",
    history: [
      { when: "9 Oct 05:40", text: "Submitted for KYB review", status: "current" },
      { when: "8 Oct", text: "Draft started · field agent referral", status: "default" },
    ],
  },
  {
    id: "nyungwe",
    name: "Nyungwe Canopy Eco Lodge",
    kind: "Lodge · Nyamasheke · 12 tents",
    entity: "Canopy Ventures Ltd",
    tin: "110 203 556",
    owner: "Esperance Nyirahabimana",
    stage: "review",
    kyb: "Licence date conflict",
    plan: "Growth",
    reviewer: "Unassigned",
    age: "1 d 6 h",
    documents: [
      { type: "rdb", state: "verified" },
      { type: "tin", state: "verified" },
      { type: "licence", state: "conflict", note: "Certificate says 30 Sep 2026 · owner entered 30 Sep 2027" },
      { type: "id", state: "verified" },
      { type: "bank", state: "verified" },
    ],
    ticket: null,
    consent: "notify",
    why: "",
    grant: "",
    history: [
      { when: "11 Oct 03:40", text: "Submitted for KYB review", status: "current" },
      { when: "6 Oct", text: "Draft started · website", status: "default" },
    ],
  },
  {
    id: "huye",
    name: "Huye Campus Inn",
    kind: "Guest house · Huye · 14 rooms",
    entity: "Huye Campus Hospitality Ltd",
    tin: "110 457 802",
    owner: "Claver Ndikumana",
    stage: "draft",
    kyb: "Blocked at TIN gate",
    plan: "Starter",
    reviewer: "Unassigned",
    age: "5 h",
    documents: [
      { type: "rdb", state: "unchecked", note: "Uploaded 9 Oct · waiting for a reviewer" },
      {
        type: "tin",
        state: "mismatch",
        note: "RRA name “Huye Campus Hospitality Ltd” · entered “Huye Campus Inn”",
      },
      { type: "licence", state: "missing", note: "Not uploaded yet" },
      { type: "id", state: "unchecked", note: "Uploaded 9 Oct · waiting for a reviewer" },
      { type: "bank", state: "missing", note: "Not uploaded yet" },
    ],
    ticket: { id: "SUP-4129", note: "Open · “TIN does not match our name” · unassigned" },
    consent: "notify",
    why: "Owner cannot pass the TIN step. Check which name they entered and what the wizard shows them.",
    grant: "",
    history: [
      { when: "12 Oct 04:40", text: "Unblock requested with RDB extract", status: "current" },
      { when: "12 Oct 04:12", text: "TIN gate failed · partial name match", status: "warning" },
    ],
  },
  {
    id: "amahoro",
    name: "Amahoro Hospitality Group",
    kind: "Hotel, lodge, residence · 3 properties",
    entity: "Amahoro Hospitality Ltd and 2 more",
    tin: "102 345 678",
    owner: "Didier Mugenzi",
    stage: "active",
    kyb: "Approved 14 Mar",
    plan: "Group",
    reviewer: "Bosco Rutayisire",
    age: "7 months",
    documents: allVerified,
    ticket: { id: "SUP-4131", note: "Open · “Guest reports two MoMo debits” · assigned to you" },
    consent: "consent",
    why: "Check how PI-77142 and its two attempts appear on folio F-5531 for the front desk.",
    grant: "Marketplace listing pilot grant until 31 Dec 2026.",
    history: [
      { when: "1 Jul", text: "Plan changed Growth → Group · price book v2", status: "default" },
      { when: "14 Mar", text: "KYB approved by Bosco Rutayisire", status: "success" },
      { when: "10 Mar", text: "Registered", status: "default" },
    ],
  },
  {
    id: "akagera",
    name: "Akagera Plains Camp",
    kind: "Camp · Kayonza · 10 tents",
    entity: "Akagera Plains Ltd",
    tin: "107 663 210",
    owner: "Patrick Mugisha",
    stage: "active",
    kyb: "Approved 2 May",
    plan: "Growth",
    reviewer: "Bosco Rutayisire",
    age: "5 months",
    documents: allVerified,
    ticket: { id: "SUP-4128", note: "Open · “VSDC rejected a credit note” · assigned to Ange Ishimwe" },
    consent: "notify",
    why: "See the rejected credit note for INV-26-0142 and the rejection reason returned by VSDC.",
    grant: "Revenue recommendations beta since 1 Sep.",
    history: [
      { when: "2 May", text: "KYB approved", status: "success" },
      { when: "28 Apr", text: "Registered", status: "default" },
    ],
  },
  {
    id: "kheights",
    name: "Kigali Heights Apartments",
    kind: "Residence · Gasabo · 40 units",
    entity: "Heights Living Ltd",
    tin: "106 118 904",
    owner: "Agnes Mukarugwiza",
    stage: "active",
    kyb: "Approved 20 Jan",
    plan: "Residence",
    reviewer: "Bosco Rutayisire",
    age: "9 months",
    documents: allVerified,
    ticket: { id: "SUP-4134", note: "Open · “Resident SMS codes not arriving” · unassigned" },
    consent: "consent",
    why: "Check whether resident sign-in codes are queued or failed for units B-02 and C-14.",
    grant: "",
    history: [
      { when: "20 Jan", text: "KYB approved", status: "success" },
      { when: "15 Jan", text: "Registered", status: "default" },
    ],
  },
  {
    id: "nyamata",
    name: "Nyamata Garden Motel",
    kind: "Motel · Bugesera · 16 rooms",
    entity: "Nyamata Garden Ltd",
    tin: "108 905 377",
    owner: "Jean Damascene Habimana",
    stage: "active",
    kyb: "Approved 3 Jun",
    plan: "Starter",
    reviewer: "Bosco Rutayisire",
    age: "4 months",
    documents: allVerified,
    ticket: { id: "SUP-4133", note: "Open · “Invoice charged after downgrade” · assigned to Patience Uwamahoro" },
    consent: "notify",
    why: "Confirm which plan the workspace shows and when the downgrade took effect.",
    grant: "Invoice PINV-26-0988 overdue 18 days · grace ends 26 Oct.",
    history: [
      { when: "24 Sep", text: "Invoice overdue · grace period started", status: "warning" },
      { when: "1 Sep", text: "Plan changed Growth → Starter", status: "default" },
      { when: "3 Jun", text: "KYB approved", status: "success" },
    ],
  },
  {
    id: "musanze",
    name: "Musanze Gorilla Gate Hotel",
    kind: "Hotel · Musanze · 28 rooms",
    entity: "Gorilla Gate Hospitality Ltd",
    tin: "104 772 019",
    owner: "Innocent Hakizimana",
    stage: "suspended",
    kyb: "Licence expired",
    plan: "Growth",
    reviewer: "Bosco Rutayisire",
    age: "10 days",
    documents: [
      { type: "rdb", state: "verified" },
      { type: "tin", state: "verified" },
      {
        type: "licence",
        state: "expired",
        label: "Expired 30 Sep",
        note: "Renewal uploaded 11 Oct · not checked yet",
      },
      { type: "id", state: "verified" },
      { type: "bank", state: "verified" },
    ],
    ticket: null,
    consent: "notify",
    why: "",
    grant: "Billing paused while suspended.",
    history: [
      { when: "11 Oct", text: "Renewed licence uploaded by owner", status: "current" },
      {
        when: "2 Oct",
        text: "Suspended · licence lapsed · requested by Bosco Rutayisire, approved by Alain Ntwari",
        status: "danger",
      },
      { when: "30 Sep", text: "Tourism operating licence expired", status: "warning" },
    ],
  },
];

const entitlements: Entitlement[] = [
  {
    id: "front-office",
    name: "Reservations, front desk and room rack",
    plans: { Starter: "included", Growth: "included", Group: "included", Residence: "none" },
  },
  {
    id: "folios",
    name: "Folios, payments and fiscal receipts",
    plans: { Starter: "included", Growth: "included", Group: "included", Residence: "included" },
  },
  {
    id: "pos",
    name: "Outlets and POS",
    plans: { Starter: "addon", Growth: "included", Group: "included", Residence: "none" },
  },
  {
    id: "housekeeping",
    name: "Housekeeping and maintenance",
    plans: { Starter: "included", Growth: "included", Group: "included", Residence: "included" },
  },
  {
    id: "payroll",
    name: "People and payroll",
    plans: { Starter: "none", Growth: "addon", Group: "included", Residence: "addon" },
  },
  {
    id: "leases",
    name: "Residence leases and rent roll",
    plans: { Starter: "none", Growth: "none", Group: "included", Residence: "included" },
  },
  {
    id: "marketplace",
    name: "Marketplace listing",
    plans: { Starter: "addon", Growth: "addon", Group: "included", Residence: "addon" },
  },
  {
    id: "channels",
    name: "Channel manager",
    plans: { Starter: "none", Growth: "included", Group: "included", Residence: "none" },
  },
];

const ledgerAccounts: LedgerAccount[] = [
  {
    id: "gtb-collections",
    label: "GT Bank collections · Injishi",
    value: 21544000,
    foot: "Ledger RWF 21,544,000 · statement 11 Oct RWF 22,744,000",
    icon: "Vault",
    chip: "3 unmatched lines",
    chipTone: "warning",
  },
  {
    id: "subscription-receivable",
    label: "Subscription receivable",
    value: 4380000,
    foot: "37 open platform invoices · 11 overdue",
    icon: "FileDollar",
  },
  {
    id: "platform-revenue",
    label: "Platform revenue · October",
    value: 14598000,
    foot: "Subscriptions RWF 14.22M · registration fees RWF 260K · broker credits RWF 118K",
    icon: "ChartLineArrowUp",
  },
  {
    id: "payables",
    label: "Payables",
    value: 1852000,
    foot: "Vendors RWF 1,762,000 (SMS, VSDC provider) · tenant credits RWF 90,000",
    icon: "Receipt",
  },
  {
    id: "broker-credits",
    label: "Deferred · broker credits",
    value: 386000,
    foot: "193 unused contact-reveal credits",
    icon: "Tags",
  },
  {
    id: "caution-deposits",
    label: "Caution deposits · residence tenants",
    value: 0,
    foot: "Injishi holds none. RWF 27.6M recorded on 31 leases is held by landlord merchants",
    icon: "Wallet",
    chip: "Memo only",
    chipTone: "default",
  },
  {
    id: "escrow",
    label: "Escrow",
    value: null,
    status: "Not enabled",
    foot: "Requires legal and bank design. Bookings settle directly to merchants.",
    icon: "Lock",
    chip: "External gate",
    chipTone: "default",
    locked: true,
  },
];

const ledgerPostings: LedgerPosting[] = [
  {
    id: "LP-261012-0419",
    at: "12 Oct 09:38",
    event: "Subscription payment verified",
    source: "Akagera Plains Camp · PINV-26-1052",
    debit: "MoMo clearing",
    credit: "Subscription receivable",
    amount: 120000,
    evidence: "MTN MoMo MP261012.0936.D71204 · verified by status poll",
    groups: ["bank", "recv"],
  },
  {
    id: "LP-261012-0418",
    at: "12 Oct 09:12",
    event: "Broker credits bought",
    source: "Emmanuel Twagira · 20 credits",
    debit: "MoMo clearing",
    credit: "Deferred · broker credits",
    amount: 40000,
    evidence: "MTN MoMo MP261012.0911.C55102 · verified 09:12",
    groups: ["bank", "def"],
  },
  {
    id: "LP-261012-0417",
    at: "12 Oct 08:40",
    event: "Contact reveal used",
    source: "Emmanuel Twagira · Kacyiru Court B-11",
    debit: "Deferred · broker credits",
    credit: "Revenue · broker credits",
    amount: 2000,
    evidence: "Reveal RV-20931",
    groups: ["def", "rev"],
  },
  {
    id: "LP-261011-0410",
    at: "11 Oct 17:20",
    event: "Re-posted to the correct tenant",
    source: "Akagera Plains Camp · PINV-26-1033 · OVR-0029",
    debit: "GT Bank collections",
    credit: "Subscription receivable",
    amount: 120000,
    evidence: "Approved by Yvonne Mutesi · 17:18",
    groups: ["bank", "recv"],
  },
  {
    id: "LP-261011-0409",
    at: "11 Oct 17:20",
    event: "Reverses LP-261011-0402",
    source: "Nyamata Garden Motel · posted in error · OVR-0029",
    debit: "Subscription receivable",
    credit: "GT Bank collections",
    amount: 120000,
    evidence: "Approved by Yvonne Mutesi · 17:18",
    groups: ["recv", "bank"],
    reversal: true,
  },
  {
    id: "LP-261011-0398",
    at: "11 Oct 09:00",
    event: "Vendor bill · SMS gateway",
    source: "October usage to date",
    debit: "Messaging cost",
    credit: "Vendor payables",
    amount: 612000,
    evidence: "Vendor invoice SMS-2026-10",
    groups: ["pay"],
  },
  {
    id: "LP-261001-0001",
    at: "1 Oct 06:00",
    event: "Monthly billing run",
    source: "214 platform invoices · billed on the 1st",
    debit: "Subscription receivable",
    credit: "Revenue · subscriptions",
    amount: 14220000,
    evidence: "Billing run BR-2610 · price book v2",
    groups: ["recv", "rev"],
  },
];

const reconRuns: ReconRun[] = [
  {
    id: "RR-1011",
    source: "GT Bank statement",
    date: "11 Oct · file imported 00:40",
    lines: 212,
    matched: 209,
    state: "3 exceptions",
    tone: "warning",
    exceptions: [
      {
        ref: "GTB-TRF-88213",
        amount: 480000,
        memo: "AMAHORO HOSP OCT",
        note: "covers PINV-26-1041 and PINV-26-1057 · OVR-0031",
        label: "Override pending",
        tone: "warning",
      },
      {
        ref: "GTB-TRF-88227",
        amount: 800000,
        memo: "KIGALI HEIGHTS",
        note: "no open invoice for this amount · asked tenant on SUP-4135",
        label: "Unidentified",
        tone: "default",
      },
      {
        ref: "GTB-CHG-1011",
        amount: -80000,
        memo: "Monthly account charge",
        note: "bank charge not allocated yet · needs an override",
        label: "Unallocated",
        tone: "default",
      },
    ],
  },
  {
    id: "RR-1010",
    source: "GT Bank statement",
    date: "10 Oct · file imported 00:35",
    lines: 198,
    matched: 198,
    state: "Balanced",
    tone: "success",
    exceptions: [],
  },
  {
    id: "RR-1009",
    source: "MTN MoMo report",
    date: "11 Oct · via GT Bank adapter",
    lines: 64,
    matched: 64,
    state: "Balanced",
    tone: "success",
    exceptions: [],
  },
  {
    id: "RR-1008",
    source: "Airtel Money report",
    date: "11 Oct · via GT Bank adapter",
    lines: 12,
    matched: 11,
    state: "1 unknown",
    tone: "warning",
    exceptions: [
      {
        ref: "AM-1011-0457",
        amount: 40000,
        memo: "Report line without a transaction reference",
        note: "Unknown — checking with provider · not counted as collected",
        label: "Unknown",
        tone: "warning",
      },
    ],
  },
];

const overrides: MoneyOverride[] = [
  {
    id: "OVR-0031",
    short: "Split payment · RWF 480,000",
    state: "Awaiting approver",
    tone: "warning",
    reason: "Match one transfer to two invoices",
    amount: 480000,
    source: "GTB-TRF-88213",
    awaiting: true,
    steps: [
      { title: "Requested", desc: "Yvonne Mutesi · Platform finance · 09:05", status: "complete" },
      { title: "Evidence attached", desc: "3 files · checked by requester", status: "complete" },
      {
        title: "Second approval",
        desc: "Clarisse Umutoni · requested 09:06 · step-up required",
        status: "active",
      },
      { title: "Posted", desc: "Balanced entry written to the ledger", status: "inactive" },
    ],
    evidence: [
      "GT Bank statement line GTB-TRF-88213 · 11 Oct",
      "Remittance email from Didier Mugenzi · 10 Oct",
      "PINV-26-1041 (Group plan) and PINV-26-1057 (SMS bundle)",
    ],
    postings: [
      { side: "Dr", account: "GT Bank collections", amount: 480000 },
      { side: "Cr", account: "Subscription receivable · PINV-26-1041", amount: 350000 },
      { side: "Cr", account: "Subscription receivable · PINV-26-1057", amount: 130000 },
    ],
  },
  {
    id: "OVR-0030",
    short: "Bank charge · RWF 75,000",
    state: "Posted",
    tone: "success",
    reason: "Allocate September account charge",
    amount: 75000,
    source: "GTB-CHG-0930",
    awaiting: false,
    outcome: "Posted as LP-261010-0377 on 10 Oct 17:02. The original statement line keeps its link to the entry.",
    steps: [
      { title: "Requested", desc: "Yvonne Mutesi · 10 Oct 16:10", status: "complete" },
      { title: "Evidence attached", desc: "Bank charge advice", status: "complete" },
      { title: "Second approval", desc: "Clarisse Umutoni · 10 Oct 17:01", status: "complete" },
      { title: "Posted", desc: "LP-261010-0377", status: "complete" },
    ],
    evidence: ["GT Bank charge advice · September"],
    postings: [
      { side: "Dr", account: "Bank charges", amount: 75000 },
      { side: "Cr", account: "GT Bank collections", amount: 75000 },
    ],
  },
  {
    id: "OVR-0029",
    short: "Wrong tenant · RWF 120,000",
    state: "Posted",
    tone: "success",
    reason: "Payment posted to the wrong tenant",
    amount: 120000,
    source: "LP-261011-0402",
    awaiting: false,
    outcome: "Reversed by LP-261011-0409 and re-posted as LP-261011-0410. Nothing was edited or deleted.",
    steps: [
      { title: "Requested", desc: "Clarisse Umutoni · 11 Oct 16:40", status: "complete" },
      { title: "Evidence attached", desc: "Statement line and both invoices", status: "complete" },
      { title: "Second approval", desc: "Yvonne Mutesi · 11 Oct 17:18", status: "complete" },
      { title: "Posted", desc: "Reversal and re-post", status: "complete" },
    ],
    evidence: ["Statement line GTB-TRF-88102", "PINV-26-1033 and PINV-26-1029"],
    postings: [
      { side: "Dr", account: "Subscription receivable · Nyamata", amount: 120000 },
      { side: "Cr", account: "GT Bank collections", amount: 120000 },
      { side: "Dr", account: "GT Bank collections", amount: 120000 },
      { side: "Cr", account: "Subscription receivable · Akagera", amount: 120000 },
    ],
  },
  {
    id: "OVR-0028",
    short: "Write-off · RWF 15,000",
    state: "Rejected",
    tone: "danger",
    reason: "Write off a short payment",
    amount: 15000,
    source: "PINV-26-0988",
    awaiting: false,
    outcome:
      "Rejected by Clarisse Umutoni on 9 Oct: “The balance is still recoverable. Keep the invoice open and remind the tenant.” No entry was posted.",
    steps: [
      { title: "Requested", desc: "Yvonne Mutesi · 9 Oct 11:20", status: "complete" },
      { title: "Evidence attached", desc: "Tenant message", status: "complete" },
      { title: "Second approval", desc: "Rejected · Clarisse Umutoni · 9 Oct 14:05", status: "complete" },
      { title: "Posted", desc: "Not posted", status: "inactive" },
    ],
    evidence: ["Message from Nyamata Garden Motel · 8 Oct"],
    postings: [
      { side: "Dr", account: "Bad debt expense", amount: 15000 },
      { side: "Cr", account: "Subscription receivable · PINV-26-0988", amount: 15000 },
    ],
  },
];

const incidents: Incident[] = [
  {
    id: "INC-0192",
    title: "GT Bank callbacks delayed",
    severity: "Sev 2",
    tone: "danger",
    summary:
      "Owner Samuel Nkusi · 47 min. Callbacks 9–14 min late; status polling every 2 min is the fallback. Payments stay Pending or Unknown until confirmed; 0 duplicate postings.",
  },
  {
    id: "INC-0193",
    title: "VSDC provider A slow",
    severity: "Sev 3",
    tone: "warning",
    summary:
      "Owner Fabrice Iradukunda · 1 h 12 min. p95 6.8 s; 46 receipts pending across 11 tenants and retried with the same request ID. Nothing issued twice.",
  },
];

const adapters: Adapter[] = [
  {
    id: "gtb-sandbox",
    icon: "Vault",
    name: "GT Bank payments API",
    endpoint: "Sandbox · pilot tenants",
    status: "Degraded",
    p95: ["1.9 s", "1.6 s", "0.9 s"],
    errors: ["2.8%", "2.1%", "0.7%"],
    note: "INC-0192 · callbacks 9–14 min late · polling fallback on",
  },
  {
    id: "gtb-production",
    icon: "Vault",
    name: "GT Bank payments API",
    endpoint: "Production",
    status: "Not verified",
    p95: ["—", "—", "—"],
    errors: ["—", "—", "—"],
    note: "No traffic. Contract, certificates and VPN details are still with the bank.",
  },
  {
    id: "gtb-vpn",
    icon: "ShieldKeyhole",
    name: "GT Bank VPN tunnel",
    endpoint: "Sandbox",
    status: "Up",
    p95: ["42 ms", "44 ms", "41 ms"],
    errors: ["0%", "0%", "0.01%"],
    note: "Both tunnels up",
  },
  {
    id: "vsdc-a",
    icon: "FileCheck",
    name: "VSDC provider A",
    endpoint: "Fiscal receipts",
    status: "Degraded",
    p95: ["6.8 s", "5.1 s", "2.0 s"],
    errors: ["1.1%", "0.9%", "0.3%"],
    note: "INC-0193 · 46 pending · retries reuse request IDs",
  },
  {
    id: "vsdc-b",
    icon: "FileCheck",
    name: "VSDC provider B",
    endpoint: "Fiscal fallback",
    status: "Not verified",
    p95: ["—", "—", "—"],
    errors: ["—", "—", "—"],
    note: "Certification needs verification · failover flag off",
  },
  {
    id: "sms",
    icon: "Handset",
    name: "SMS gateway",
    endpoint: "Messaging",
    status: "Healthy",
    p95: ["620 ms", "640 ms", "600 ms"],
    errors: ["0.2%", "0.3%", "0.2%"],
    note: "Delivery receipts 97.8% · 3 dead letters at 09:11",
  },
  {
    id: "whatsapp",
    icon: "Comment",
    name: "WhatsApp Business",
    endpoint: "Messaging",
    status: "Healthy",
    p95: ["880 ms", "910 ms", "850 ms"],
    errors: ["0.6%", "0.5%", "0.4%"],
    note: "2 message templates awaiting provider approval",
  },
  {
    id: "email",
    icon: "Envelope",
    name: "Email",
    endpoint: "Messaging",
    status: "Healthy",
    p95: ["1.2 s", "1.1 s", "1.2 s"],
    errors: ["1.4%", "1.3%", "1.2%"],
    note: "Error rate is bounces · domain authentication passing",
  },
  {
    id: "channel-manager",
    icon: "Globe",
    name: "Channel manager",
    endpoint: "Distribution",
    status: "Partial",
    p95: ["2.4 s", "2.2 s", "2.0 s"],
    errors: ["4.2%", "3.9%", "2.6%"],
    note: "3 tenants with room-type mapping errors · retried hourly",
  },
];

const deadLetters: DeadLetter[] = [
  {
    id: "DL-90311",
    queue: "payments.callback",
    ref: "PI-77142 attempt 1",
    reason: "Intent locked by status poll",
    attempts: 8,
    since: "09:04",
    replayable: true,
  },
  {
    id: "DL-90312",
    queue: "payments.callback",
    ref: "PI-77150",
    reason: "Adapter timeout after 30 s",
    attempts: 8,
    since: "09:06",
    replayable: true,
  },
  {
    id: "DL-90318",
    queue: "notifications.sms",
    ref: "Kigali Heights · sign-in code",
    reason: "Gateway returned 503",
    attempts: 6,
    since: "09:11",
    replayable: true,
  },
  {
    id: "DL-90320",
    queue: "notifications.sms",
    ref: "Kigali Heights · sign-in code",
    reason: "Gateway returned 503",
    attempts: 6,
    since: "09:11",
    replayable: true,
  },
  {
    id: "DL-90327",
    queue: "fiscal.issue",
    ref: "F-5512 · Isangano",
    reason: "Provider timeout · request ID kept",
    attempts: 24,
    since: "07:28",
    replayable: true,
  },
  {
    id: "DL-90288",
    queue: "payments.callback",
    ref: "PI-77098",
    reason: "Payload schema v0 is retired",
    attempts: 8,
    since: "08:58",
    replayable: false,
  },
];

const queues: QueueStat[] = [
  { id: "payments.callback", depth: 418, oldest: "11 min", retry: "30 s → 15 min · 8 tries", deadLetters: 5 },
  { id: "fiscal.issue", depth: 46, oldest: "2 h 14 min", retry: "every 5 min · same request ID", deadLetters: 1 },
  { id: "notifications.sms", depth: 12, oldest: "40 s", retry: "30 s → 10 min · 6 tries", deadLetters: 3 },
  { id: "channel.sync", depth: 88, oldest: "3 min", retry: "1 min → 30 min · 10 tries", deadLetters: 0 },
  { id: "reports.export", depth: 4, oldest: "20 s", retry: "3 tries", deadLetters: 0 },
];

const schedulers: SchedulerRun[] = [
  {
    id: "night-audit.run",
    runs: "02:00 property time",
    lastRun: "02:00",
    result: "1 of 236 failed",
    tone: "danger",
    next: "10:00 retry",
  },
  {
    id: "subscription.billing",
    runs: "1st of month 06:00",
    lastRun: "1 Oct 06:00",
    result: "214 invoices",
    tone: "success",
    next: "1 Nov 06:00",
  },
  {
    id: "subscription.retry",
    runs: "Daily 07:00",
    lastRun: "07:00",
    result: "11 retried · 4 paid",
    tone: "success",
    next: "13 Oct 07:00",
  },
  {
    id: "payment.status.poll",
    runs: "Every 2 min",
    lastRun: "09:42",
    result: "12 resolved",
    tone: "success",
    next: "09:44",
  },
  { id: "backup.snapshot", runs: "Hourly", lastRun: "09:00", result: "OK", tone: "success", next: "10:00" },
];

const sweeps: Sweep[] = [
  {
    id: "unknown-payments",
    name: "Unknown payments",
    rule: "Unknown over 30 min → ask provider",
    lastRun: "09:40",
    result: "17 checked · 5 resolved",
    tone: "warning",
    next: "09:50",
  },
  {
    id: "expired-holds",
    name: "Expired booking holds",
    rule: "Hold past expiry → release",
    lastRun: "09:30",
    result: "8 released",
    tone: "success",
    next: "10:00",
  },
  {
    id: "registration-drafts",
    name: "Registration drafts",
    rule: "Idle 30 days → remind owner, never delete",
    lastRun: "03:00",
    result: "6 reminders",
    tone: "success",
    next: "13 Oct 03:00",
  },
  {
    id: "orphaned-uploads",
    name: "Orphaned uploads",
    rule: "Unlinked over 7 days → quarantine",
    lastRun: "03:30",
    result: "0 found",
    tone: "success",
    next: "13 Oct 03:30",
  },
];

const healthPanels: HealthPanel[] = [
  {
    id: "outbox",
    state: "Publishing",
    tone: "success",
    facts: [
      { label: "Unpublished", value: "312" },
      { label: "Oldest event", value: "14 s" },
      { label: "Publish lag p95", value: "1.8 s" },
      { label: "Published last hour", value: "48,210" },
    ],
    series: [
      { at: "08:42", lag: 0.8 },
      { at: "08:47", lag: 0.9 },
      { at: "08:52", lag: 1.1 },
      { at: "08:57", lag: 1.3 },
      { at: "09:02", lag: 3.7 },
      { at: "09:07", lag: 4.2 },
      { at: "09:12", lag: 2.9 },
      { at: "09:17", lag: 2.1 },
      { at: "09:22", lag: 1.6 },
      { at: "09:27", lag: 1.3 },
      { at: "09:32", lag: 1.2 },
      { at: "09:37", lag: 1.3 },
      { at: "09:42", lag: 1.2 },
    ],
  },
  {
    id: "realtime",
    state: "Healthy",
    tone: "success",
    facts: [
      { label: "Connected clients", value: "1,284" },
      { label: "Socket rooms", value: "412" },
      { label: "Fan-out p95", value: "210 ms" },
      { label: "Dropped messages", value: "0.03%" },
    ],
  },
  {
    id: "storage",
    facts: [],
    used: 1.82,
    capacity: 5,
    notes: [
      { tone: "success", text: "Primary site in Rwanda (Kigali) · encrypted at rest" },
      { tone: "warning", text: "Failed uploads 0.2% in 24 h · retried on device" },
      { tone: null, text: "Signed download links expire after 15 min" },
    ],
    gates: ["Second in-country replica needs verification"],
  },
  {
    id: "backup",
    facts: [
      { label: "Hourly snapshot", value: "09:00 · OK" },
      { label: "Nightly full backup", value: "02:30 · OK" },
      { label: "Last restore test", value: "28 Sep · passed · 41 min" },
      { label: "Snapshot retention", value: "35 days" },
    ],
    gates: ["7-year fiscal retention · configured, unverified"],
  },
];

const errorGroups: ErrorGroup[] = [
  {
    id: "folio-split-typeerror",
    title: "TypeError in folio split dialog",
    meta: "Operator web 2026.10.11.2 · 38 events · 12 users · fix on canary",
    state: "Fix on canary",
    tone: "success",
  },
  {
    id: "staff-app-photo-crash",
    title: "Staff app crash on photo upload",
    meta: "Android 1.14.2 · 9 crashes · 7 devices · store rollout paused at 50%",
    state: "Investigating",
    tone: "warning",
  },
  {
    id: "vsdc-504",
    title: "Unhandled 504 from VSDC provider A",
    meta: "Worker · 212 events in 1 hour · linked to INC-0193",
    state: "Linked to incident",
    tone: "default",
  },
];

const pipelines: Pipeline[] = [
  {
    id: "web",
    service: "Operator web",
    version: "2026.10.12.1",
    stages: ["success", "success", "success", "success", "accent", "pending"],
    status: "Canary 25% · healthy",
    tone: "success",
    next: "Engineering may promote after 10:20",
  },
  {
    id: "api",
    service: "API",
    version: "2026.10.12.0",
    stages: ["success", "success", "success", "accent", "pending", "pending"],
    status: "Held",
    tone: "warning",
    next: "Touches payments · frozen during INC-0192",
  },
  {
    id: "worker",
    service: "Worker",
    version: "2026.10.11.3",
    stages: ["success", "success", "success", "success", "success", "success"],
    status: "Live 100%",
    tone: "success",
    next: "Released 11 Oct 18:20",
  },
  {
    id: "staff-android",
    service: "Staff app · Android",
    version: "1.14.2",
    stages: ["success", "success", "warning", "success", "success", "warning"],
    status: "Rollout paused",
    tone: "warning",
    next: "Crash on photo upload · fix in review",
  },
];

const tickets: SupportTicket[] = [
  {
    id: "SUP-4131",
    tenant: "Amahoro · Isangano Lakeside Hotel",
    subject: "Guest reports two MoMo debits for BK-20433",
    from: "Eric Habimana, Front desk",
    owner: "Kevin Mugisha",
    age: "2 h 5 min",
    priority: "High",
    state: "Escalated",
    tone: "info",
    handoff: true,
  },
  {
    id: "SUP-4127",
    tenant: "Kivu Sunset Guesthouse",
    subject: "Tourism licence upload rejected",
    from: "Theoneste Bizimana, Owner",
    owner: "Ange Ishimwe",
    age: "3 d 2 h",
    priority: "High",
    state: "Over SLA",
    tone: "danger",
    handoff: false,
  },
  {
    id: "SUP-4128",
    tenant: "Akagera Plains Camp",
    subject: "VSDC rejected a credit note for INV-26-0142",
    from: "Finance team",
    owner: "Ange Ishimwe",
    age: "4 h",
    priority: "Normal",
    state: "Waiting on us",
    tone: "warning",
    handoff: false,
  },
  {
    id: "SUP-4129",
    tenant: "Huye Campus Inn",
    subject: "TIN does not match our business name",
    from: "Claver Ndikumana, Owner",
    owner: null,
    age: "5 h",
    priority: "Normal",
    state: "New",
    tone: "accent",
    handoff: false,
  },
  {
    id: "SUP-4133",
    tenant: "Nyamata Garden Motel",
    subject: "Invoice charged after downgrade",
    from: "Jean Damascene Habimana, Owner",
    owner: "Patience Uwamahoro",
    age: "1 h",
    priority: "Normal",
    state: "Waiting on tenant",
    tone: "default",
    handoff: false,
  },
  {
    id: "SUP-4134",
    tenant: "Kigali Heights Apartments",
    subject: "Resident sign-in codes not arriving",
    from: "Agnes Mukarugwiza, Owner",
    owner: null,
    age: "40 min",
    priority: "High",
    state: "New",
    tone: "accent",
    handoff: false,
  },
  {
    id: "SUP-4135",
    tenant: "Kigali Heights Apartments",
    subject: "Bank transfer not showing on our invoice",
    from: "Agnes Mukarugwiza, Owner",
    owner: "Yvonne Mutesi",
    age: "25 min",
    priority: "Normal",
    state: "Waiting on us",
    tone: "warning",
    handoff: false,
  },
];

const ticketMessages: TicketMessage[] = [
  {
    id: "SUP-4131-1",
    ticketId: "SUP-4131",
    author: "Kevin Mugisha",
    role: "Injishi support",
    when: "09:20",
    text: "Thanks Eric. Attempt 1 is caught in a delay on the GT Bank side (INC-0192). It stays Unknown and will not be posted as a second payment unless the provider confirms it. If it does confirm, your finance team can refund it from Payments; Injishi cannot move your money. We will update you here by 11:00.",
    kind: "staff",
  },
  {
    id: "SUP-4131-2",
    ticketId: "SUP-4131",
    author: "Kevin Mugisha",
    role: "Injishi support",
    when: "09:21",
    text: "Linked to INC-0192 and dead letter DL-90311. Asked Samuel to check PI-77142 first in the status poll.",
    kind: "note",
  },
  {
    id: "SUP-4131-3",
    ticketId: "SUP-4131",
    author: "Eric Habimana",
    role: "Front desk · Amahoro",
    when: "09:33",
    text: "Thanks. The guest checks out at 11:00. Can we give him a receipt for the one payment that is confirmed?",
    kind: "tenant",
  },
  {
    id: "SUP-4127-1",
    ticketId: "SUP-4127",
    author: "Theoneste Bizimana",
    role: "Kivu Sunset Guesthouse",
    when: "3 d 2 h ago",
    text: "The registration page says my licence file is not accepted. It is a photo from my phone. I tried twice.",
    kind: "tenant",
  },
  {
    id: "SUP-4128-1",
    ticketId: "SUP-4128",
    author: "Finance team",
    role: "Akagera Plains Camp",
    when: "4 h ago",
    text: "We issued a credit note to correct a wrong room charge and the fiscal system rejected it. What do we do now?",
    kind: "tenant",
  },
  {
    id: "SUP-4129-1",
    ticketId: "SUP-4129",
    author: "Claver Ndikumana",
    role: "Huye Campus Inn",
    when: "5 h ago",
    text: "Our company name at RRA is Huye Campus Hospitality Ltd but the hotel is called Huye Campus Inn. Registration stops at the TIN step.",
    kind: "tenant",
  },
  {
    id: "SUP-4133-1",
    ticketId: "SUP-4133",
    author: "Jean Damascene Habimana",
    role: "Nyamata Garden Motel",
    when: "1 h ago",
    text: "We moved to Starter on 1 September but the October invoice still has Growth add-ons.",
    kind: "tenant",
  },
  {
    id: "SUP-4134-1",
    ticketId: "SUP-4134",
    author: "Agnes Mukarugwiza",
    role: "Kigali Heights Apartments",
    when: "40 min ago",
    text: "Two residents say the SMS code never arrives. Units B-02 and C-14.",
    kind: "tenant",
  },
  {
    id: "SUP-4135-1",
    ticketId: "SUP-4135",
    author: "Agnes Mukarugwiza",
    role: "Kigali Heights Apartments",
    when: "25 min ago",
    text: "We paid RWF 800,000 by bank transfer on 11 October. The Injishi invoice still says unpaid.",
    kind: "tenant",
  },
];

const handoffTranscripts: TranscriptMessage[] = [
  {
    id: "SUP-4131-t1",
    ticketId: "SUP-4131",
    from: "user",
    text: "Guest in 207 says MoMo took RWF 140,000 twice for the deposit. Can you check?",
  },
  {
    id: "SUP-4131-t2",
    ticketId: "SUP-4131",
    from: "assistant",
    text: "PI-77142 has two attempts. Attempt 2 is Verified: MTN MoMo, ref MP261012.0731.B33871 at 07:31. Attempt 1 is Unknown — checking with provider. Only one payment is on folio F-5531. I cannot see the guest’s wallet. Shall I hand this to Injishi support?",
  },
  { id: "SUP-4131-t3", ticketId: "SUP-4131", from: "user", text: "Yes please, hand it over." },
];

const moderationReports: ModerationReport[] = [
  {
    id: "m1",
    kind: "threads",
    title: "Guest ↔ Kibuye Bay Lodge · message thread",
    excerpt: "Please send the deposit to my personal MoMo 07•• ••• •12 so we can hold the room",
    policy: "TS-04 Off-platform payment request",
    by: "Reported by guest · 2 h",
    age: "2 h",
    action: "Hide message",
  },
  {
    id: "m2",
    kind: "threads",
    title: "Guest ↔ Rubavu Beach Hostel · message thread",
    excerpt: "If you don’t change your review I will tell everyone …",
    policy: "TS-02 Threat or harassment",
    by: "Reported by guest · 5 h",
    age: "5 h",
    action: "Hide message",
  },
  {
    id: "m3",
    kind: "reviews",
    title: "Review of Isangano Lakeside Hotel · 2 stars",
    excerpt: "The receptionist gave me her number 07•• ••• •48 and …",
    policy: "TS-07 Personal data in content",
    by: "Auto-flagged · 1 h",
    age: "1 h",
    action: "Redact and keep",
  },
  {
    id: "m4",
    kind: "reviews",
    title: "Review of Isangano Lakeside Hotel · 1 star",
    excerpt: "Never stayed somewhere so dirty …",
    policy: "TS-09 Eligibility challenged by host",
    by: "Host says no stay · system shows verified stay ST-8812",
    age: "1 d",
    action: "Remove review",
  },
  {
    id: "m5",
    kind: "listings",
    title: "Gisenyi Hillside Villas · listing photos",
    excerpt: "4 of 9 photos match another property’s listing",
    policy: "TS-11 Misleading listing",
    by: "Image match · 3 h",
    age: "3 h",
    action: "Unpublish listing",
  },
  {
    id: "m6",
    kind: "listings",
    title: "Lake Muhazi Retreat · grading claim",
    excerpt: "Listing title says “4-star”; RDB grading on file is not verified",
    policy: "TS-12 Unverified grading claim",
    by: "Compliance check · 20 h",
    age: "20 h",
    action: "Remove claim",
  },
];

const disputes: Dispute[] = [
  {
    id: "DSP-0042",
    icon: "Briefcase",
    title: "DSP-0042 · Broker placement fee · RWF 325,000",
    meta: "Emmanuel Twagira vs Kacyiru Court Residences · fee held · landlord evidence due 15 Oct",
    state: "Awaiting evidence",
    tone: "warning",
  },
  {
    id: "DSP-0044",
    icon: "Star",
    title: "DSP-0044 · Review dispute · Isangano Lakeside Hotel",
    meta: "Double-blind review stays hidden from the host until both sides publish · Nadine Kayitesi",
    state: "In review",
    tone: "default",
  },
  {
    id: "DSP-0045",
    icon: "CreditCard",
    title: "DSP-0045 · Card payment disputed · PI-77098",
    meta: "Amahoro · Disputed with the card issuer · evidence window needs verification with GT Bank",
    state: "Disputed",
    tone: "danger",
  },
  {
    id: "ESC-0217",
    icon: "ArrowUpRight",
    title: "ESC-0217 · SUP-4131 to platform payments",
    meta: "Attempt 1 of PI-77142 · Unknown — checking with provider · Samuel Nkusi",
    state: "Escalated",
    tone: "info",
  },
];

const announcements: Announcement[] = [
  {
    id: "ANN-0019",
    title: "Payment confirmations are delayed",
    audience: "gtb",
    audiences: [
      { id: "gtb", label: "Tenants on the GT Bank adapter · 23" },
      { id: "vsdc-a", label: "Tenants on VSDC provider A · 11" },
      { id: "active", label: "All active tenants · 181" },
    ],
    channels: { banner: true, email: true, sms: false },
    english:
      "GT Bank is sending payment confirmations late. Payments may show Pending for up to 15 minutes. Do not ask guests to pay again; the status updates by itself.",
    kinyarwanda: "",
  },
];

const moneyDesk: MoneyDesk[] = [
  {
    id: "desk",
    access: "full",
    provider: "gtbank",
    mode: "live",
    available: 4_380_000,
    inFlight: 186_000,
    queued: 240_000,
    parked: 1,
    lastRun: "discrepancies_flagged · 2026-10-11",
    counts: { parked: 1, reversals: 1, owed: 1, short: 0, over_limit: 0, waiting_on_payer: 1 },
    rows: [
      {
        id: "pt-reversal-1",
        bucket: "reversals",
        reference: "INJ7Q2MZK4RT6PLX3WD5B",
        providerReference: "GTB-RTP-88201",
        direction: "collection",
        operation: "escrow_capture",
        amount: 186_000,
        status: "reversed",
        reason: "double_refund",
        party: "078••••921",
        bookingReference: "BK-7Q2M-ZK4R",
        age: "2 h",
        pendingOverride: null,
      },
      {
        id: "pt-parked-1",
        bucket: "parked",
        reference: "INJK3VW8NPQ2HD7YC4RT1",
        providerReference: null,
        direction: "collection",
        operation: "one_time_fee",
        amount: 250_000,
        status: "unknown",
        reason: "no answer within 8000ms",
        party: "073••••410",
        bookingReference: null,
        age: "41 min",
        pendingOverride: { id: "ov-confirm-1", action: "confirm_received" },
      },
      {
        id: "pt-owed-1",
        bucket: "owed",
        reference: "INJM5XC2TB8RWQ6KD3PL9",
        providerReference: "GTB-DSB-55102",
        direction: "disbursement",
        operation: "refund",
        amount: 94_000,
        status: "failed",
        reason: "the name given does not match the receiving wallet",
        party: "078••••333",
        bookingReference: "BK-M5XC-2TB8",
        age: "1 d",
        pendingOverride: null,
      },
      {
        id: "pt-waiting-1",
        bucket: "waiting_on_payer",
        reference: "INJD8RT4YK2MZQ7XC5WB3",
        providerReference: null,
        direction: "disbursement",
        operation: "escrow_release_guest",
        amount: 146_000,
        status: "queued",
        reason: "payee_details_missing",
        party: "079••••118",
        bookingReference: "BK-D8RT-4YK2",
        age: "5 h",
        pendingOverride: null,
      },
    ],
    overrides: [
      {
        id: "ov-confirm-1",
        action: "confirm_received",
        state: "initiated",
        reason: "The GT Bank portal shows this fee as paid on 11 October at 14:02.",
        subjectReference: "INJK3VW8NPQ2HD7YC4RT1",
        amount: null,
        initiatedBy: "Fabrice Ndayisaba",
        createdAt: "2026-10-12T07:10:00Z",
        canDecide: true,
      },
    ],
    canRequest: true,
    canDecide: true,
  },
];

export const fixtures = {
  "admin.triageItems": triage,
  "admin.homeKpis": homeKpis,
  "admin.deploys": deploys,
  "admin.onCall": onCall,
  "admin.viewAsSessions": viewAsSessions,
  "admin.lifecycleCounts": lifecycleCounts,
  "admin.kybDocumentTypes": kybDocumentTypes,
  "admin.businesses": businesses,
  "admin.entitlements": entitlements,
  "admin.ledgerAccounts": ledgerAccounts,
  "admin.ledgerPostings": ledgerPostings,
  "admin.reconRuns": reconRuns,
  "admin.overrides": overrides,
  "admin.moneyDesk": moneyDesk,
  "admin.incidents": incidents,
  "admin.adapters": adapters,
  "admin.deadLetters": deadLetters,
  "admin.queues": queues,
  "admin.schedulers": schedulers,
  "admin.sweeps": sweeps,
  "admin.healthPanels": healthPanels,
  "admin.errorGroups": errorGroups,
  "admin.pipelines": pipelines,
  "admin.tickets": tickets,
  "admin.ticketMessages": ticketMessages,
  "admin.handoffTranscripts": handoffTranscripts,
  "admin.moderationReports": moderationReports,
  "admin.disputes": disputes,
  "admin.announcements": announcements,
} satisfies FixtureSet;
