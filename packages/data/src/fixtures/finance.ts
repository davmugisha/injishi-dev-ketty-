import type { BoardId, FixtureSet, IconName } from "../types.ts";

/**
 * Embedded-database fixtures for the "finance" area: reconciliation exceptions (FinanceHome), folios,
 * payments and refunds, bank reconciliation, cashier shift close and night audit.
 * Collection names are "finance.<thing>"; every document has a stable string `id`.
 * Values are lifted verbatim from the artifact boards (node tools/artifact/extract.mjs <Board>).
 * Money is stored as whole Rwandan francs and formatted in the view.
 */

export type Tone = "accent" | "success" | "warning" | "danger" | "default" | "info";

/** Outcome of one evidence check (icon + colour in the view). */
export type CheckTone = "success" | "warning" | "danger" | "idle";

/** Timeline marker status. */
export type EventStatus = "success" | "warning" | "danger" | "default" | "current";

export interface Fact {
  k: string;
  v: string;
}

export interface Check {
  tone: CheckTone;
  label: string;
  detail: string;
}

export interface FinanceEvent {
  title: string;
  meta: string;
  status: EventStatus;
}

// ── FinanceHome · reconciliation exceptions ─────────────────────────────────

export type ExceptionType = "unknown" | "bank" | "fiscal" | "folio" | "deposit" | "refund" | "shift";
export type ExceptionCategory = "pay" | "fiscal" | "folio" | "cash";

export interface ExceptionGroup {
  id: ExceptionType;
  label: string;
  icon: IconName;
  category: ExceptionCategory;
}

export interface FinanceException {
  id: string;
  type: ExceptionType;
  severity: "high" | "medium" | "low";
  property: string;
  title: string;
  sub: string;
  amount: number;
  age: string;
  /** Payment intent reference (unknown payments). */
  ref?: string;
  folio?: string;
  /** Network and GT Bank references returned when the provider confirms (unknown payments). */
  providerRef?: string;
  network?: "MTN" | "Airtel";
  /** What the polling evidence line says before a manual query (unknown payments). */
  pollNote?: string;
  /** VSDC request id (fiscal receipts). */
  requestId?: string;
  facts: Fact[];
  checks: Check[];
  events: FinanceEvent[];
  next?: string;
  cta?: string;
  board?: BoardId;
  hasRetry?: boolean;
  blocked?: string;
  blockedWhy?: string;
}

export interface FinanceKpi {
  id: "verified" | "pending" | "unknown" | "unposted" | "pastCheckout";
  label: string;
  value: number;
  /** Count behind the value (verified tenders), when the footer is computed. */
  count?: number;
  foot: string;
  icon: IconName;
  status: "success" | "warning" | "danger";
  board: BoardId;
}

export interface ResolvedException {
  id: string;
  title: string;
  evidence: string;
  when: string;
}

// ── Folios ──────────────────────────────────────────────────────────────────

export type FolioKind = "guest" | "house" | "master" | "city";

export interface FolioLine {
  date: string;
  desc: string;
  src: string;
  dept: string;
  amount: number;
  fiscal: string;
  fiscalTone: Tone;
  /** Routing note for a charge moved between folios. */
  transfer?: string;
}

export interface FolioGroup {
  label: string;
  /** Lines moved to another folio (shown, but not counted here). */
  moved?: boolean;
  lines: FolioLine[];
}

export interface FolioPayment {
  icon: IconName;
  method: string;
  amount: number;
  evidence: string;
  state: string;
  tone: Tone;
}

export interface Folio {
  id: string;
  kind: FolioKind;
  name: string;
  link: string;
  property: string;
  status: string;
  statusTone: Tone;
  closed?: boolean;
  /** Verified payments. */
  paid: number;
  /** Billed to the city ledger (authorised receivable). */
  billed?: number;
  /** Payments not yet verified (or unallocated credit for city-ledger accounts). */
  pending: number;
  groups: FolioGroup[];
  payments: FolioPayment[];
  noPaymentsText?: string;
  alert?: { tone: "danger" | "warning"; title: string; text: string };
  checks: Check[];
  routing?: Fact[];
  reopenNote?: string;
  reopenDraft?: string;
  trail: FinanceEvent[];
}

// ── Payments ────────────────────────────────────────────────────────────────

export type PaymentState =
  | "Initiated"
  | "Pending"
  | "Unknown"
  | "Verified"
  | "Failed"
  | "Disputed"
  | "Reversed"
  | "Refunded"
  | "Recorded";

export interface PaymentEvidence {
  tone: CheckTone;
  k: string;
  v: string;
}

export interface PaymentIntent {
  id: string;
  time: string;
  payer: string;
  record: string;
  method: string;
  account: string;
  icon: IconName;
  amount: number;
  state: PaymentState;
  providerRef: string;
  events: FinanceEvent[];
  evidence: PaymentEvidence[];
  note: { tone: "default" | "warning" | "success" | "danger"; title: string; text: string };
  board?: BoardId;
  cta?: string;
}

export interface RefundRequest {
  id: string;
  ref: string;
  amount: number;
  kind: string;
  rail: string;
  policy: string;
  requestedBy: string;
  approvedBy: string;
  checks: { tone: CheckTone; text: string }[];
  /** Approved and executable by Finance now. */
  executable?: boolean;
  /** Blocked by an external gate (partial card refunds). */
  gate?: boolean;
  why?: string;
  status?: string;
  statusTone?: Tone;
}

export interface DeskMethod {
  id: "mtn" | "airtel" | "card" | "bank" | "cash";
  label: string;
  fieldLabel: string;
  fieldValue: string;
  fieldHelp: string;
  outcomeTitle: string;
  outcomeText: string;
  cta: string;
  state: PaymentState;
  icon: IconName;
  account: string;
  method: string;
}

// ── Reconciliation ──────────────────────────────────────────────────────────

export interface ReconSource {
  id: string;
  icon: IconName;
  title: string;
  value: string;
  meta: string;
  tone: Tone;
}

export interface MatchSummaryItem {
  /** Match state of the statement lines (the view picks the chart colour per state). */
  id: "auto" | "suggested" | "bank" | "ledger" | "fiscal";
  label: string;
  count: number;
}

export interface ReconMatch {
  id: string;
  tab: "suggested" | "bank" | "ledger";
  confidence?: "High" | "Medium";
  title: string;
  kind: string;
  bank: number | null;
  bankText: string;
  ledger: number | null;
  ledgerText: string;
  record: string;
  fiscal: string;
  diff: number | null;
  reasons: { tone: CheckTone; text: string }[];
  postings: { side: "Dr" | "Cr"; account: string; amount: number }[];
  canAccept?: boolean;
  why?: string;
  board?: BoardId;
  cta?: string;
  manualReason?: string;
}

export interface ReconInvoice {
  id: string;
  src: string;
  due: string;
  bucket: string;
  bucketTone: Tone;
  open: number;
  /** Most that may be applied (the disputed part is excluded). */
  max: number;
  ebm: string;
  note?: string;
  /** Proposed amount (oldest invoices first). */
  suggested: number;
}

export interface SettlementBatch {
  id: string;
  name: string;
  meta: string;
  amount: number | null;
  tone: Tone;
}

// ── Shift close ─────────────────────────────────────────────────────────────

export interface CashierShift {
  id: string;
  till: string;
  cashier: string;
  initials: string;
  hours: string;
  float: number;
  expectedCash: number;
  verifiedNonCash: number;
  excludedCount: number;
  excludedTotal: number;
  /** Variance above which a recount is required (cash policy v1). */
  recountThreshold: number;
}

export interface CashDenomination {
  id: string;
  label: string;
  value: number;
  /** Count entered for this shift. */
  count: number;
}

export interface FloatRow {
  id: string;
  label: string;
  count: number;
  amount: number;
}

export interface ShiftTender {
  id: string;
  icon: IconName;
  label: string;
  records: number;
  amount: number;
  evidence: string;
}

export interface ExcludedTender {
  id: string;
  state: string;
  tone: Tone;
  text: string;
  amount: number;
}

export interface TillStatus {
  id: string;
  name: string;
  meta: string;
  state: string;
  tone: Tone;
}

// ── Night audit ─────────────────────────────────────────────────────────────

export type AuditTone = "done" | "warn" | "block" | "idle";

export interface AuditStepState {
  tone: AuditTone;
  state: string;
  time: string;
  detail: string;
  notes: string[];
}

export interface AuditStep extends AuditStepState {
  id: string;
  title: string;
  /** Shows the tax-rule sign-off gate. */
  gate?: boolean;
  /** The step once the issue it depends on is resolved. */
  resolvedBy?: string;
  resolved?: AuditStepState;
}

export interface AuditIssueState {
  icon: IconName;
  title: string;
  detail: string;
  owner: string;
}

export interface AuditIssue {
  id: string;
  open: AuditIssueState & { board: BoardId; linkLabel: string; actLabel: string };
  resolved: AuditIssueState;
}

export interface AuditRun {
  id: string;
  date: string;
  by: string;
  end: string;
  result: string;
  tone: Tone;
  /** Only listed once tonight's roll has happened. */
  tonight?: boolean;
  log: { t: string; m: string; tone?: "warning" | "danger" }[];
}

// ── Data ────────────────────────────────────────────────────────────────────

const exceptionGroups: ExceptionGroup[] = [
  { id: "unknown", label: "Unknown payments", icon: "CircleQuestion", category: "pay" },
  { id: "bank", label: "Unmatched bank transfers", icon: "Vault", category: "pay" },
  { id: "fiscal", label: "Held or pending fiscal receipts", icon: "FileExclamation", category: "fiscal" },
  { id: "folio", label: "Open folios past checkout", icon: "Receipt", category: "folio" },
  { id: "deposit", label: "Deposits held", icon: "Wallet", category: "folio" },
  { id: "refund", label: "Refunds to execute", icon: "ArrowUturnCcwLeft", category: "pay" },
  { id: "shift", label: "Shift-close variances", icon: "Calculator", category: "cash" },
];

const fiscalNext =
  "The folio cannot close until the sale receipt is Issued. Retrying reuses the same request ID, so the VSDC cannot issue twice.";

const exceptions: FinanceException[] = [
  {
    id: "ex1",
    type: "unknown",
    severity: "high",
    property: "Isangano",
    title: "PI-77142 · MTN MoMo · Daniel Okafor",
    sub: "F-5531 · Room 305 · timed out 07:48, no callback",
    amount: 120000,
    age: "2 h 17 min",
    ref: "PI-77142",
    folio: "F-5531",
    providerRef: "MTN 8841207733 · GT Bank GTB-MM-26101207",
    network: "MTN",
    pollNote: "Poll 8 of 12 · next 10:17, then manual investigation",
    facts: [
      { k: "Payer", v: "Daniel Okafor · 078•••4412" },
      { k: "Network", v: "MTN MoMo via GT Bank adapter" },
      { k: "Idempotency key", v: "pi_77142:att_1" },
      { k: "Folio", v: "F-5531 · balance RWF 120,000 open" },
    ],
    checks: [],
    events: [
      { title: "Push sent to 078•••4412", meta: "07:48:02 · attempt 1 · GT Bank accepted", status: "success" },
      { title: "No answer in 30 s — marked Unknown", meta: "07:48:32 · not failed, not paid", status: "warning" },
      { title: "8 status polls returned PENDING", meta: "07:50 – 10:02 · every 15 min", status: "default" },
    ],
  },
  {
    id: "ex2",
    type: "unknown",
    severity: "high",
    property: "Isangano",
    title: "PI-77139 · Airtel Money · Yuki Tanaka",
    sub: "Lake Bar tab to F-5525 · Room 112 · timed out 05:52",
    amount: 65000,
    age: "4 h 13 min",
    ref: "PI-77139",
    folio: "F-5525",
    providerRef: "Airtel AM261012.0552.T7731 · GT Bank GTB-AM-26101144",
    network: "Airtel",
    pollNote: "Every 2 min while Airtel callbacks are delayed",
    facts: [
      { k: "Payer", v: "Yuki Tanaka · 073•••0918" },
      { k: "Network", v: "Airtel Money via GT Bank adapter" },
      { k: "Idempotency key", v: "pi_77139:att_1" },
      { k: "Order", v: "Lake Bar LB-2287 → F-5525" },
    ],
    checks: [],
    events: [
      { title: "Push sent to 073•••0918", meta: "05:52:10 · attempt 1 · GT Bank accepted", status: "success" },
      { title: "No answer in 30 s — marked Unknown", meta: "05:52:40 · Airtel callbacks delayed", status: "warning" },
      { title: "128 polls returned PENDING", meta: "05:54 – 10:04 · every 2 min", status: "default" },
    ],
  },
  {
    id: "ex3",
    type: "bank",
    severity: "medium",
    property: "Amahoro Hospitality Ltd",
    title: "GT Bank credit · UMURAGE CONS LTD OCT",
    sub: "Statement 11 Oct · line 187 · no payment intent",
    amount: 1200000,
    age: "1 day",
    facts: [
      { k: "Bank reference", v: "FT26285QW7L2" },
      { k: "Value date", v: "11 Oct 2026" },
      { k: "Account", v: "GT Bank operating ••• 4471" },
      { k: "Likely debtor", v: "Umurage Consulting Ltd · city ledger" },
    ],
    checks: [
      {
        tone: "success",
        label: "Bank statement line",
        detail: "GTB-STMT-20261011 · imported 06:02 · checksum matched",
      },
      {
        tone: "warning",
        label: "Suggested allocation",
        detail: "INV-26-0388 · part payment of RWF 1,239,000 open · oldest first",
      },
      { tone: "idle", label: "Second approver", detail: "Required for allocation · Aline Uwase or Didier Mugenzi" },
    ],
    events: [
      { title: "Statement imported", meta: "12 Oct 06:02 · 214 lines", status: "success" },
      { title: "No intent or invoice matched automatically", meta: "Reference text only", status: "warning" },
    ],
    next: "Allocate the credit to Umurage’s receivables. The allocation is proposed by you and approved by someone else before it posts.",
    cta: "Allocate in reconciliation",
    board: "Reconciliation",
  },
  {
    id: "ex4",
    type: "fiscal",
    severity: "medium",
    property: "Isangano",
    title: "Sale receipt for F-5518 · Pending at VSDC",
    sub: "Marie Claire Uwimana · paid and verified · 3 retries",
    amount: 410000,
    age: "2 h 35 min",
    requestId: "VSDC-REQ-1012-0418",
    facts: [
      { k: "Document", v: "Fiscal sale receipt (not a payment receipt)" },
      { k: "Merchant", v: "Amahoro Hospitality Ltd · TIN 102 345 678" },
      { k: "Request ID", v: "VSDC-REQ-1012-0418" },
      { k: "Folio", v: "F-5518 · payments verified" },
    ],
    checks: [],
    events: [
      { title: "Submitted at folio close", meta: "07:30 · request VSDC-REQ-1012-0418", status: "success" },
      { title: "VSDC timeout, retried 3 times", meta: "07:31 – 09:30 · same request ID", status: "warning" },
    ],
    next: fiscalNext,
    cta: "Open fiscal queue",
    board: "FiscalReceipts",
    hasRetry: true,
  },
  {
    id: "ex5",
    type: "fiscal",
    severity: "medium",
    property: "Isangano",
    title: "Sale receipt for F-5522 · Pending at VSDC",
    sub: "Akagera Horizon Travel · group lunch, Isangano Terrace · 2 retries",
    amount: 186000,
    age: "2 h 20 min",
    requestId: "VSDC-REQ-1012-0422",
    facts: [
      { k: "Document", v: "Fiscal sale receipt (not a payment receipt)" },
      { k: "Merchant", v: "Amahoro Hospitality Ltd · TIN 102 345 678" },
      { k: "Request ID", v: "VSDC-REQ-1012-0422" },
      { k: "Folio", v: "F-5522 · payments verified" },
    ],
    checks: [],
    events: [
      { title: "Submitted at folio close", meta: "07:45 · request VSDC-REQ-1012-0422", status: "success" },
      { title: "VSDC timeout, retried twice", meta: "07:46 – 09:15 · same request ID", status: "warning" },
    ],
    next: fiscalNext,
    cta: "Open fiscal queue",
    board: "FiscalReceipts",
    hasRetry: true,
  },
  {
    id: "ex6",
    type: "fiscal",
    severity: "medium",
    property: "Ishyamba",
    title: "Refund receipt for BK-20402 · Pending at VSDC",
    sub: "Credit note for refunded deposit · original EBM-0041-88217",
    amount: 60000,
    age: "2 h 05 min",
    requestId: "VSDC-REQ-1012-0431",
    facts: [
      { k: "Document", v: "Fiscal refund receipt (credit note)" },
      { k: "Original", v: "EBM-0041-88217 · stays issued, never edited" },
      { k: "Request ID", v: "VSDC-REQ-1012-0431" },
      { k: "Refund", v: "RF-3101 · Pending at provider" },
    ],
    checks: [],
    events: [
      { title: "Credit note prepared", meta: "08:00 · from refund RF-3101", status: "success" },
      { title: "VSDC timeout, retried once", meta: "08:01 – 08:40 · same request ID", status: "warning" },
    ],
    next: fiscalNext,
    cta: "Open fiscal queue",
    board: "FiscalReceipts",
    hasRetry: true,
  },
  {
    id: "ex7",
    type: "folio",
    severity: "high",
    property: "Isangano",
    title: "F-5509 · Thomas Weber",
    sub: "Checked out 08:40 · card payment PI-77141 Pending",
    amount: 590000,
    age: "1 h 25 min",
    facts: [
      { k: "Stay", v: "ST-8807 · Room 210 · 5 nights" },
      { k: "Charges posted", v: "RWF 1,090,000" },
      { k: "Verified payments", v: "RWF 500,000 · MTN MoMo deposit" },
      { k: "Pending", v: "PI-77141 · card RWF 590,000 · 3-D Secure" },
    ],
    checks: [
      { tone: "success", label: "Deposit verified", detail: "MTN 8841180344 · 6 Oct 15:12" },
      { tone: "warning", label: "Card payment", detail: "Pending · issuer has not completed 3-D Secure" },
      { tone: "idle", label: "Fiscal receipt", detail: "Not issued · folio still open" },
    ],
    events: [
      { title: "Guest checked out with balance", meta: "08:40 · Eric Habimana", status: "warning" },
      { title: "Card payment started", meta: "08:38 · PI-77141", status: "current" },
    ],
    next: "Keep the folio open until the card payment is verified or the guest pays another way. It is shown as unpaid everywhere until then.",
    cta: "Open folio",
    board: "Folios",
    blocked: "Move to city ledger",
    blockedWhy:
      "Thomas Weber has no authorised debtor account. A receivable needs an approved account and credit limit.",
  },
  {
    id: "ex8",
    type: "folio",
    severity: "low",
    property: "Isangano",
    title: "F-5497 · Pierre Laurent",
    sub: "Checked out 10 Oct · minibar posted after checkout · card declined",
    amount: 46000,
    age: "2 days",
    facts: [
      { k: "Stay", v: "ST-8790 · Room 206" },
      { k: "Late charge", v: "Minibar · posted 10 Oct 12:20" },
      { k: "Attempt", v: "PI-77127 · Failed · issuer code 51" },
      { k: "Guest contact", v: "Front desk owns guest messages" },
    ],
    checks: [
      { tone: "danger", label: "Card payment", detail: "Failed · insufficient funds (issuer code 51)" },
      { tone: "idle", label: "Write-off", detail: "Needs reason code and GM approval" },
    ],
    events: [
      { title: "Late charge posted", meta: "10 Oct 12:20 · Lake Bar minibar", status: "warning" },
      { title: "Card charge failed", meta: "10 Oct 12:31 · PI-77127", status: "danger" },
    ],
    next: "Ask front desk to send a payment link to the guest, or propose a write-off with a reason code.",
    cta: "Open folio",
    board: "Folios",
  },
  {
    id: "ex9",
    type: "deposit",
    severity: "medium",
    property: "Isangano",
    title: "BK-20409 · Fatuma Hassan · no-show",
    sub: "Guaranteed booking · deposit is a liability until applied",
    amount: 220000,
    age: "10 h",
    facts: [
      { k: "Deposit", v: "PI-77104 · Airtel Money · verified 1 Oct" },
      { k: "Policy", v: "No-show policy v2 · charge first night" },
      { k: "First night", v: "RWF 85,000 · Standard Queen" },
      { k: "Remainder", v: "RWF 135,000 · refund per policy" },
    ],
    checks: [
      {
        tone: "success",
        label: "Deposit verified",
        detail: "Airtel AM261001.1410.F2290 · GT Bank GTB-AM-26100117",
      },
      {
        tone: "warning",
        label: "No-show processed by night audit",
        detail: "11 Oct 23:31 · forfeit not yet applied to revenue",
      },
    ],
    events: [{ title: "Marked no-show", meta: "11 Oct 23:31 · night audit", status: "warning" }],
    next: "Apply the first-night charge from the deposit and send the remainder to the refunds queue. The refund decision comes from the policy, not from Finance.",
    cta: "Open night audit",
    board: "NightAudit",
  },
  {
    id: "ex10",
    type: "refund",
    severity: "medium",
    property: "Isangano",
    title: "RF-3107 · BK-20437 · Grace Achieng",
    sub: "Cancellation tier 1 · decided by policy, approved by Aline Uwase",
    amount: 85000,
    age: "25 min",
    facts: [
      { k: "Original payment", v: "PI-77118 · MTN MoMo · verified" },
      { k: "Requested by", v: "Eric Habimana · 09:12" },
      { k: "Approved by", v: "Aline Uwase · 09:40" },
      { k: "Executes", v: "You · Finance" },
    ],
    checks: [
      {
        tone: "success",
        label: "Separation of duties",
        detail: "Requester, approver and executor are three different people",
      },
      { tone: "success", label: "Provider capability", detail: "Full MoMo refund confirmed for this account" },
    ],
    events: [
      { title: "Refund decided by cancellation policy", meta: "09:12 · tier 1, full refund", status: "success" },
      { title: "Approved", meta: "09:40 · Aline Uwase", status: "success" },
    ],
    next: "Execute the refund through GT Bank. It shows Pending until the provider confirms it.",
    cta: "Execute in Payments",
    board: "Payments",
  },
  {
    id: "ex11",
    type: "shift",
    severity: "low",
    property: "Isangano",
    title: "Till 1 · morning shift · cash short",
    sub: "Closed 14:05 on 11 Oct · reason: change given error",
    amount: -3500,
    age: "20 h",
    facts: [
      { k: "Cashier", v: "Front desk morning · Till 1" },
      { k: "Expected cash", v: "RWF 284,000" },
      { k: "Counted", v: "RWF 280,500" },
      { k: "Approved by", v: "Aline Uwase · 14:12" },
    ],
    checks: [
      { tone: "success", label: "Supervisor approval", detail: "Recorded with reason and count sheet" },
      { tone: "warning", label: "Finance review", detail: "Variance over RWF 2,000 threshold" },
    ],
    events: [{ title: "Shift closed with variance", meta: "11 Oct 14:05", status: "warning" }],
    next: "Review the count sheet and accept the variance, or ask for a recount.",
    cta: "Review shift close",
    board: "ShiftClose",
  },
];

const homeKpis: FinanceKpi[] = [
  {
    id: "verified",
    label: "Verified today",
    value: 7912400,
    count: 142,
    foot: "142 tenders · provider-confirmed only",
    icon: "CircleCheck",
    status: "success",
    board: "Payments",
  },
  {
    id: "pending",
    label: "Pending",
    value: 608000,
    foot: "2 intents · card 3-D Secure and a MoMo prompt",
    icon: "Clock",
    status: "warning",
    board: "Payments",
  },
  {
    id: "unknown",
    label: "Unknown",
    value: 185000,
    count: 2,
    foot: "2 timed out · checking with provider",
    icon: "CircleQuestion",
    status: "danger",
    board: "Payments",
  },
  {
    id: "unposted",
    label: "Unposted charges",
    value: 96500,
    foot: "4 Lake Bar tickets · offline till",
    icon: "CloudSlash",
    status: "warning",
    board: "NightAudit",
  },
  {
    id: "pastCheckout",
    label: "Open past checkout",
    value: 636000,
    foot: "2 folios · oldest 2 days",
    icon: "Receipt",
    status: "danger",
    board: "Folios",
  },
];

const resolvedToday: ResolvedException[] = [
  {
    id: "PI-77131",
    title: "PI-77131 · MTN MoMo · RWF 30,000 · Aisha Mohammed",
    evidence: "Webhook signature verified · MTN 8841199820 · GT Bank GTB-MM-26101162",
    when: "09:41",
  },
  {
    id: "PI-77126",
    title: "PI-77126 · MTN MoMo · RWF 312,000 · Marie Claire Uwimana",
    evidence: "Attempt 2 · webhook signature verified · MTN 8841190021",
    when: "07:22",
  },
  {
    id: "AB-1010",
    title: "Airtel settlement 10 Oct · RWF 511,700",
    evidence: "Statement line 96 · batch AB-1010 · 6 verified payments · fee RWF 300",
    when: "06:05",
  },
];

const onClose = "On close";
const L = (
  date: string,
  desc: string,
  src: string,
  dept: string,
  amount: number,
  fiscal: string,
  fiscalTone: Tone,
  transfer?: string,
): FolioLine =>
  transfer
    ? { date, desc, src, dept, amount, fiscal, fiscalTone, transfer }
    : { date, desc, src, dept, amount, fiscal, fiscalTone };
const P = (
  icon: IconName,
  method: string,
  amount: number,
  evidence: string,
  state: string,
  tone: Tone,
): FolioPayment => ({
  icon,
  method,
  amount,
  evidence,
  state,
  tone,
});
const C = (tone: CheckTone, label: string, detail: string): Check => ({ tone, label, detail });
const E = (title: string, meta: string, status: EventStatus): FinanceEvent => ({ title, meta, status });

const folios: Folio[] = [
  {
    id: "F-5540",
    kind: "master",
    name: "EAC Health Forum",
    link: "Master bill · Group block 23–26 Oct · organisers’ site visit 10–12 Oct",
    property: "Isangano",
    status: "Open",
    statusTone: "warning",
    paid: 2000000,
    pending: 0,
    groups: [
      {
        label: "Rooms · transferred from guest folios",
        lines: [
          L(
            "10–12 Oct",
            "Room 304 · 2 nights Deluxe Lake View · Aisha Mohammed",
            "ST-8812 · night audit posts NA-1010, NA-1011",
            "Rooms",
            280000,
            onClose,
            "default",
            "From F-5528 · TR-0091 · authorised by Aline Uwase 11 Oct 18:12",
          ),
          L(
            "10–12 Oct",
            "Room 306 · 2 nights Deluxe Lake View · Jean Bosco Nkurunziza",
            "ST-8813 · night audit posts NA-1010, NA-1011",
            "Rooms",
            280000,
            onClose,
            "default",
            "From F-5529 · TR-0092 · authorised by Aline Uwase 11 Oct 18:12",
          ),
        ],
      },
      {
        label: "Events",
        lines: [
          L(
            "11 Oct",
            "Kivu Hall · half-day hire for site inspection",
            "Event order EV-0214 · posted directly",
            "Events",
            350000,
            onClose,
            "default",
          ),
        ],
      },
      {
        label: "Food and beverage · transferred",
        lines: [
          L(
            "11 Oct",
            "Working lunch · Isangano Terrace · 8 covers",
            "POS order TER-4471 · original sale kept",
            "F&B",
            144000,
            onClose,
            "default",
            "From F-5528 · TR-0093 · authorised by Aline Uwase 11 Oct 18:15",
          ),
        ],
      },
    ],
    payments: [
      P(
        "Vault",
        "Bank transfer · GT Bank",
        2000000,
        "FT26275MB0K4 · statement 2 Oct · matched and approved by Aline Uwase · RWF 1,054,000 allocated, RWF 946,000 unapplied",
        "Verified",
        "success",
      ),
    ],
    checks: [
      C("success", "All payments verified", "1 bank transfer · GT Bank FT26275MB0K4"),
      C(
        "warning",
        "No pending charges",
        "Lake Bar LB-2291 · RWF 18,000 · room 306 · waiting for the offline till to sync",
      ),
      C("success", "Fiscal documents", "None pending or rejected · one sale receipt issues on close"),
      C(
        "warning",
        "Balance settled",
        "RWF 946,000 unapplied deposit must be applied to the block or refunded under the group contract",
      ),
      C("danger", "Block completed", "Group departs 26 Oct · the master bill stays open until then"),
    ],
    routing: [
      { k: "Room and accommodation tax", v: "This master bill" },
      { k: "Kivu Hall, coffee breaks", v: "This master bill" },
      { k: "Bar, laundry, minibar", v: "Each guest’s own folio" },
    ],
    trail: [
      E("Master bill opened", "2 Oct · Aline Uwase · contract SE-0031", "success"),
      E("Deposit verified from bank statement", "2 Oct · FT26275MB0K4", "success"),
      E("3 charge transfers authorised", "11 Oct · TR-0091 to TR-0093 · Aline Uwase", "success"),
      E("Waiting for block arrival", "23 Oct", "current"),
    ],
  },
  {
    id: "F-5536",
    kind: "master",
    name: "Volcano view group",
    link: "BK-20418 · 4 of 6 rooms · 14–16 Oct",
    property: "Isangano",
    status: "Refund pending approval",
    statusTone: "warning",
    paid: 1620000,
    pending: 0,
    groups: [
      {
        label: "Rooms",
        lines: [
          L(
            "9–11 Oct",
            "Group rooms · 6 Twin × 2 nights at group rate",
            "ST-8790 to ST-8795",
            "Rooms",
            960000,
            onClose,
            "default",
          ),
        ],
      },
      {
        label: "Food and beverage",
        lines: [L("10 Oct", "Packed trek lunches × 12", "POS order TER-4402", "F&B", 180000, onClose, "default")],
      },
    ],
    payments: [
      P(
        "Vault",
        "Bank transfer · GT Bank",
        1620000,
        "FT26270VV8D1 · statement 27 Sep · deposit for 8 rooms; 2 cancelled",
        "Verified",
        "success",
      ),
    ],
    checks: [
      C("success", "All payments verified", "GT Bank FT26270VV8D1"),
      C("success", "No pending charges", "All outlet orders posted"),
      C("success", "Fiscal documents", "None pending or rejected"),
      C("danger", "Balance settled", "Refund RF-3105 · RWF 480,000 is above the GM limit · waiting for Didier Mugenzi"),
    ],
    trail: [
      E("Group checked out", "11 Oct 10:30", "success"),
      E("Refund decided by cancellation tier 2", "11 Oct 12:05 · RF-3105", "success"),
      E("Waiting for owner approval", "Above RWF 300,000 limit", "current"),
    ],
  },
  {
    id: "F-5502",
    kind: "master",
    name: "Akagera Horizon Travel · BK-20422",
    link: "Agent booking · closed 8 Oct to the city ledger as INV-26-0409",
    property: "Isangano",
    status: "Closed · on city ledger",
    statusTone: "success",
    closed: true,
    paid: 0,
    billed: 590000,
    pending: 0,
    groups: [
      {
        label: "Rooms",
        lines: [
          L(
            "5–8 Oct",
            "Room 309 · 3 nights Deluxe Lake View at agent rate",
            "ST-8781 · night audit posts",
            "Rooms",
            420000,
            "EBM-0041-88102",
            "success",
          ),
        ],
      },
      {
        label: "Food and beverage",
        lines: [
          L(
            "5–7 Oct",
            "Isangano Terrace · half board",
            "POS orders TER-4371 to TER-4389",
            "F&B",
            170000,
            "EBM-0041-88102",
            "success",
          ),
        ],
      },
    ],
    payments: [
      P(
        "Briefcase",
        "Direct bill · city ledger CL-009",
        590000,
        "INV-26-0409 · due 23 Oct · authorised debtor account with RWF 1,500,000 limit · not a payment",
        "On account",
        "default",
      ),
    ],
    checks: [
      C("success", "Balance covered by an authorised receivable", "INV-26-0409 · Akagera Horizon Travel"),
      C("success", "Fiscal sale receipt issued", "EBM-0041-88102"),
      C("idle", "Invoice paid", "Not due until 23 Oct · tracked in Accounts receivable"),
    ],
    reopenNote: "EBM-0041-88102 stays issued. Any correction is made with a credit note, never by editing the receipt.",
    trail: [
      E("Closed to city ledger", "8 Oct · Grace Uwera · INV-26-0409", "success"),
      E("Waiting for agent payment", "Due 23 Oct", "current"),
    ],
  },
  {
    id: "F-5528",
    kind: "guest",
    name: "Aisha Mohammed",
    link: "ST-8812 · Room 304 · BK-20421 · EAC Health Forum organiser",
    property: "Isangano",
    status: "Open · departs today",
    statusTone: "warning",
    paid: 30000,
    pending: 0,
    groups: [
      {
        label: "Moved to master bill F-5540",
        moved: true,
        lines: [
          L(
            "10–12 Oct",
            "Room 304 · 2 nights Deluxe Lake View",
            "ST-8812 · NA-1010, NA-1011",
            "Rooms",
            280000,
            "On F-5540",
            "default",
            "To F-5540 · TR-0091 · counted there only",
          ),
          L(
            "11 Oct",
            "Working lunch · 8 covers",
            "POS order TER-4471",
            "F&B",
            144000,
            "On F-5540",
            "default",
            "To F-5540 · TR-0093 · counted there only",
          ),
        ],
      },
      {
        label: "Guest charges",
        lines: [
          L("11 Oct", "Lake Bar · drinks", "POS order LB-2270", "F&B", 22000, onClose, "default"),
          L("12 Oct", "Laundry · 4 items", "Service order LDY-118", "Other", 8000, onClose, "default"),
        ],
      },
    ],
    payments: [
      P(
        "Smartphone",
        "MTN MoMo · 078•••2210",
        30000,
        "PI-77131 · MTN 8841199820 · GT Bank GTB-MM-26101162 · webhook signature verified 09:41",
        "Verified",
        "success",
      ),
    ],
    checks: [
      C("success", "All payments verified", "PI-77131 · MTN 8841199820"),
      C("success", "No pending charges", "Lake Bar and laundry posted"),
      C("success", "Fiscal documents", "None pending · transferred charges are fiscalised on F-5540 only"),
      C("success", "Balance settled", "RWF 0 after transfers"),
    ],
    trail: [
      E("Folio opened at check-in", "10 Oct 14:20 · Eric Habimana", "success"),
      E("Room and lunch moved to F-5540", "11 Oct 18:12 · authorised by Aline Uwase", "success"),
    ],
  },
  {
    id: "F-5509",
    kind: "guest",
    name: "Thomas Weber",
    link: "ST-8807 · Room 210 · BK-20433",
    property: "Isangano",
    status: "Checked out · balance due",
    statusTone: "danger",
    paid: 500000,
    pending: 590000,
    groups: [
      {
        label: "Rooms",
        lines: [
          L(
            "6–11 Oct",
            "Room 210 · 5 nights Deluxe Lake View",
            "ST-8807 · night audit posts",
            "Rooms",
            700000,
            onClose,
            "default",
          ),
        ],
      },
      {
        label: "Food and beverage",
        lines: [
          L(
            "6–10 Oct",
            "Isangano Terrace · 4 dinners",
            "POS orders TER-4398 to TER-4430",
            "F&B",
            238000,
            onClose,
            "default",
          ),
          L("9 Oct", "Lake Bar · drinks", "POS order LB-2241", "F&B", 18000, "Reversed", "default"),
          L(
            "9 Oct",
            "Reversal of LB-2241 · posted to wrong room",
            "VD-0311 · reason WRONG-ROOM · Eric Habimana",
            "F&B",
            -18000,
            "Reversed",
            "default",
          ),
          L("10 Oct", "Lake Bar · drinks", "POS order LB-2262", "F&B", 96000, onClose, "default"),
        ],
      },
      {
        label: "Transport",
        lines: [L("11 Oct", "Airport transfer to Kigali", "Service order TRN-077", "Other", 56000, onClose, "default")],
      },
    ],
    payments: [
      P(
        "Smartphone",
        "MTN MoMo · deposit",
        500000,
        "PI-77049 · MTN 8841180344 · GT Bank GTB-MM-26100631 · 6 Oct 15:12",
        "Verified",
        "success",
      ),
      P(
        "CreditCard",
        "Card · Visa ••4821",
        590000,
        "PI-77141 · GT Bank · waiting for 3-D Secure · not counted",
        "Pending",
        "warning",
      ),
    ],
    alert: {
      tone: "danger",
      title: "Guest left with RWF 590,000 unpaid",
      text: "The folio stays open and shows unpaid until the card payment is verified or another payment arrives.",
    },
    checks: [
      C("danger", "All payments verified", "PI-77141 card payment is Pending"),
      C("success", "No pending charges", "All posted"),
      C("success", "Fiscal documents", "None pending"),
      C("danger", "Balance settled", "RWF 590,000 due · no authorised debtor account"),
    ],
    trail: [
      E("Checked out with balance", "12 Oct 08:40 · Eric Habimana", "warning"),
      E("Card payment started", "08:38 · PI-77141", "current"),
    ],
  },
  {
    id: "F-5531",
    kind: "guest",
    name: "Daniel Okafor",
    link: "ST-8815 · Room 305 · BK-20440",
    property: "Isangano",
    status: "In house",
    statusTone: "default",
    paid: 175000,
    pending: 120000,
    groups: [
      {
        label: "Rooms",
        lines: [
          L(
            "9–12 Oct",
            "Room 305 · 3 nights Standard Queen",
            "ST-8815 · night audit posts",
            "Rooms",
            255000,
            onClose,
            "default",
          ),
        ],
      },
      {
        label: "Food and beverage",
        lines: [L("11 Oct", "Isangano Terrace · dinner", "POS order TER-4466", "F&B", 40000, onClose, "default")],
      },
    ],
    payments: [
      P(
        "Smartphone",
        "Airtel Money · deposit",
        175000,
        "PI-77090 · Airtel AM261005.0931.D1180 · GT Bank GTB-AM-26100512",
        "Verified",
        "success",
      ),
      P(
        "Smartphone",
        "MTN MoMo · 078•••4412",
        120000,
        "PI-77142 · timed out 07:48 · not counted",
        "Unknown",
        "warning",
      ),
    ],
    alert: {
      tone: "warning",
      title: "Payment outcome unknown",
      text: "PI-77142 is being checked with the provider from the Exceptions queue. The balance stays open until it is verified.",
    },
    checks: [
      C("warning", "All payments verified", "PI-77142 is Unknown"),
      C("success", "No pending charges", "All posted"),
      C("success", "Fiscal documents", "None pending"),
      C("danger", "Guest departed", "In house until 14 Oct"),
    ],
    trail: [
      E("Folio opened at check-in", "9 Oct 15:05", "success"),
      E("MoMo payment timed out", "12 Oct 07:48 · PI-77142", "warning"),
    ],
  },
  {
    id: "F-5518",
    kind: "guest",
    name: "Marie Claire Uwimana",
    link: "ST-8810 · Room 401 · BK-20428",
    property: "Isangano",
    status: "Closed · receipt pending",
    statusTone: "warning",
    closed: true,
    paid: 410000,
    pending: 0,
    groups: [
      {
        label: "Rooms",
        lines: [
          L("11 Oct", "Room 401 · 1 night Family Suite", "ST-8810 · NA-1011", "Rooms", 220000, "Pending", "warning"),
        ],
      },
      {
        label: "Food and beverage",
        lines: [
          L("11 Oct", "Isangano Terrace · dinner for 4", "POS order TER-4463", "F&B", 128000, "Pending", "warning"),
          L("11 Oct", "Lake Bar · drinks", "POS order LB-2281", "F&B", 62000, "Pending", "warning"),
        ],
      },
    ],
    payments: [
      P("Smartphone", "MTN MoMo · deposit", 98000, "PI-77088 · MTN 8841150972 · 1 Oct", "Verified", "success"),
      P(
        "Smartphone",
        "MTN MoMo · 078•••6630",
        312000,
        "PI-77126 · attempt 2 · MTN 8841190021 · webhook signature verified 07:22",
        "Verified",
        "success",
      ),
    ],
    checks: [
      C("success", "Closed with prerequisites met", "12 Oct 07:30 · Eric Habimana"),
      C("warning", "Fiscal sale receipt", "Pending at VSDC · VSDC-REQ-1012-0418 · retried with the same ID"),
    ],
    reopenNote:
      "The sale receipt is still Pending. Reopening waits until the VSDC answers so no duplicate receipt can be issued.",
    trail: [
      E("Closed", "12 Oct 07:30 · Eric Habimana", "success"),
      E("Sale receipt submitted", "07:30 · VSDC-REQ-1012-0418 · Pending", "warning"),
    ],
  },
  {
    id: "F-5490",
    kind: "guest",
    name: "Sarah Kimani",
    link: "ST-8796 · Room 204 · BK-20431",
    property: "Isangano",
    status: "Closed",
    statusTone: "success",
    closed: true,
    paid: 315000,
    pending: 0,
    groups: [
      {
        label: "Rooms",
        lines: [
          L(
            "9–11 Oct",
            "Room 204 · 2 nights Deluxe Lake View",
            "ST-8796 · NA-0909, NA-0910",
            "Rooms",
            280000,
            "EBM-0041-88290",
            "success",
          ),
        ],
      },
      {
        label: "Food and beverage",
        lines: [
          L("10 Oct", "Isangano Terrace · dinner", "POS order TER-4441", "F&B", 35000, "EBM-0041-88290", "success"),
        ],
      },
    ],
    payments: [
      P(
        "CreditCard",
        "Card · Visa ••5512",
        315000,
        "PI-77071 · GT Bank auth 603988 · settled 12 Oct",
        "Verified",
        "success",
      ),
    ],
    checks: [
      C("success", "Closed with prerequisites met", "11 Oct 11:02 · Eric Habimana"),
      C("success", "Fiscal sale receipt issued", "EBM-0041-88290 · 11 Oct 11:02"),
    ],
    reopenNote:
      "EBM-0041-88290 stays issued. If a charge changes, the correction is a credit note linked to the original receipt.",
    reopenDraft:
      "Guest says the Terrace dinner on 10 Oct was a welcome dinner included in her package. Correct by credit note if confirmed.",
    trail: [
      E("Closed", "11 Oct 11:02 · Eric Habimana", "success"),
      E("Sale receipt issued", "EBM-0041-88290", "success"),
    ],
  },
  {
    id: "F-H012",
    kind: "house",
    name: "Complimentary and VIP amenities",
    link: "House account · cost centre ROOMS-COMP",
    property: "Isangano",
    status: "Open · month end",
    statusTone: "default",
    paid: 0,
    pending: 0,
    groups: [
      {
        label: "Complimentary",
        lines: [
          L(
            "1–12 Oct",
            "Welcome amenities · 6 VIP arrivals",
            "Comp code GM-WEL · approved by Aline Uwase",
            "Rooms",
            48000,
            "Not a sale",
            "default",
          ),
          L(
            "8 Oct",
            "Owner’s guest dinner",
            "POS order TER-4417 · comp code OWN-01",
            "F&B",
            36000,
            "Not a sale",
            "default",
          ),
        ],
      },
    ],
    payments: [],
    noPaymentsText: "House folios carry cost, not guest revenue, so they take no payments.",
    checks: [
      C("success", "Every comp has an approval code", "2 of 2"),
      C("idle", "Month-end close", "31 Oct · posts to the general ledger"),
    ],
    trail: [E("Opened for October", "1 Oct · system", "success")],
  },
  {
    id: "F-H014",
    kind: "house",
    name: "Guide and driver meals",
    link: "House account · cost centre FB-STAFF",
    property: "Ishyamba",
    status: "Open · month end",
    statusTone: "default",
    paid: 0,
    pending: 0,
    groups: [
      {
        label: "Meals",
        lines: [
          L(
            "1–12 Oct",
            "Guide and driver meals · 11 covers",
            "Ishyamba kitchen orders",
            "F&B",
            22000,
            "Not a sale",
            "default",
          ),
        ],
      },
    ],
    payments: [],
    noPaymentsText: "House folios carry cost, not guest revenue, so they take no payments.",
    checks: [C("success", "Every comp has an approval code", "1 of 1"), C("idle", "Month-end close", "31 Oct")],
    trail: [E("Opened for October", "1 Oct · system", "success")],
  },
  {
    id: "CL-014",
    kind: "city",
    name: "Umurage Consulting Ltd",
    link: "City ledger · credit limit RWF 2,500,000 · 30-day terms",
    property: "Amahoro Hospitality Ltd",
    status: "62 days oldest",
    statusTone: "danger",
    paid: 0,
    pending: 1200000,
    groups: [
      {
        label: "Open invoices (commercial, not fiscal receipts)",
        lines: [
          L(
            "Due 11 Aug",
            "INV-26-0388 · from F-5431",
            "62 days past due",
            "Rooms",
            1239000,
            "EBM-0041-86120",
            "success",
          ),
          L(
            "Due 8 Sep",
            "INV-26-0401 · from F-5466",
            "34 days · RWF 118,000 disputed",
            "Rooms",
            519200,
            "EBM-0041-86904",
            "success",
          ),
          L("Due 9 Nov", "INV-26-0412 · from F-5501", "Not due", "Rooms", 342200, "EBM-0041-87988", "success"),
        ],
      },
    ],
    payments: [
      P(
        "Vault",
        "Bank transfer · GT Bank",
        1200000,
        "FT26285QW7L2 · statement 11 Oct · allocate in Reconciliation; a second approver signs off",
        "Unmatched",
        "warning",
      ),
    ],
    checks: [
      C("warning", "Credit limit", "RWF 2,100,400 of 2,500,000 used"),
      C("danger", "Aging", "1 invoice over 60 days"),
      C("warning", "Unallocated credit", "RWF 1,200,000 from the bank · not yet applied to any invoice"),
    ],
    trail: [E("Bank credit received", "11 Oct · FT26285QW7L2", "warning")],
  },
  {
    id: "CL-009",
    kind: "city",
    name: "Akagera Horizon Travel",
    link: "City ledger · travel agent · 10% commission",
    property: "Amahoro Hospitality Ltd",
    status: "Current",
    statusTone: "success",
    paid: 0,
    pending: 0,
    groups: [
      {
        label: "Open invoices (commercial, not fiscal receipts)",
        lines: [
          L(
            "Due 23 Oct",
            "INV-26-0409 · from F-5502 · BK-20422",
            "Not due",
            "Rooms",
            590000,
            "EBM-0041-88102",
            "success",
          ),
          L("Due 22 Oct", "INV-26-0436 · from F-5521", "Not due", "Rooms", 380000, "EBM-0041-88011", "success"),
        ],
      },
    ],
    payments: [],
    noPaymentsText: "No payments due yet. Agent commission is a separate payable in Commissions, never netted here.",
    checks: [C("success", "Credit limit", "RWF 970,000 of 1,500,000 used"), C("success", "Aging", "Nothing past due")],
    trail: [E("Invoice sent", "7 Oct · INV-26-0436", "success"), E("Invoice sent", "8 Oct · INV-26-0409", "success")],
  },
];

const V = (tone: CheckTone, k: string, v: string): PaymentEvidence => ({ tone, k, v });

const payments: PaymentIntent[] = [
  {
    id: "PI-77143",
    time: "12 Oct 10:04",
    payer: "Walk-in diner",
    record: "QR order TER-4490 · Isangano Terrace",
    method: "MTN MoMo",
    account: "078•••3307",
    icon: "Smartphone",
    amount: 18000,
    state: "Initiated",
    providerRef: "Waiting for PIN",
    events: [E("Attempt 1 · prompt sent", "10:04:12 · key pi_77143:att_1 · GT Bank accepted", "current")],
    evidence: [
      V("idle", "GT Bank request", "GTB-REQ-26101231"),
      V("idle", "Webhook", "Not yet · prompt expires 10:09"),
      V("idle", "Ledger", "Nothing posted"),
    ],
    note: {
      tone: "default",
      title: "Waiting for the customer",
      text: "The prompt is on the customer’s phone. If it expires, the attempt is marked failed and a new attempt can be started with a new key.",
    },
  },
  {
    id: "PI-77142",
    time: "12 Oct 07:48",
    payer: "Daniel Okafor",
    record: "F-5531 · Room 305",
    method: "MTN MoMo",
    account: "078•••4412",
    icon: "Smartphone",
    amount: 120000,
    state: "Unknown",
    providerRef: "None yet",
    events: [
      E("Attempt 1 · prompt sent", "07:48:02 · key pi_77142:att_1", "success"),
      E("No answer in 30 s", "07:48:32 · marked Unknown, not failed", "warning"),
      E("8 polls returned PENDING", "07:50 – 10:02", "default"),
    ],
    evidence: [
      V("warning", "Provider status", "PENDING at MTN · last asked 10:02"),
      V("danger", "Webhook", "Not received"),
      V("idle", "Ledger", "Nothing posted · folio balance open"),
    ],
    note: {
      tone: "warning",
      title: "Unknown — checking with provider",
      text: "Not shown as paid or failed. Resolve it from the exception queue, where you can query GT Bank and open an investigation.",
    },
    board: "FinanceHome",
    cta: "Resolve in Exceptions",
  },
  {
    id: "PI-77141",
    time: "12 Oct 08:38",
    payer: "Thomas Weber",
    record: "F-5509 · checked out",
    method: "Card",
    account: "Visa ••4821",
    icon: "CreditCard",
    amount: 590000,
    state: "Pending",
    providerRef: "GTB-CD-26101077",
    events: [
      E("Attempt 1 · card authorisation", "08:38:10 · key pi_77141:att_1", "success"),
      E("3-D Secure challenge sent", "08:38:12 · issuer has not answered", "current"),
    ],
    evidence: [
      V("success", "GT Bank reference", "GTB-CD-26101077"),
      V("warning", "Authorisation", "Waiting for issuer 3-D Secure"),
      V("idle", "Ledger", "Nothing posted"),
    ],
    note: {
      tone: "warning",
      title: "Pending at the card issuer",
      text: "Thomas Weber’s folio shows RWF 590,000 unpaid until GT Bank confirms the authorisation.",
    },
    board: "Folios",
    cta: "Open folio F-5509",
  },
  {
    id: "PI-77139",
    time: "12 Oct 05:52",
    payer: "Yuki Tanaka",
    record: "Lake Bar LB-2287 → F-5525",
    method: "Airtel Money",
    account: "073•••0918",
    icon: "Smartphone",
    amount: 65000,
    state: "Unknown",
    providerRef: "None yet",
    events: [
      E("Attempt 1 · prompt sent", "05:52:10 · key pi_77139:att_1", "success"),
      E("No answer in 30 s", "05:52:40 · Airtel callbacks delayed", "warning"),
    ],
    evidence: [
      V("warning", "Provider status", "PENDING at Airtel · polled every 2 min"),
      V("danger", "Webhook", "Not received"),
      V("idle", "Ledger", "Nothing posted"),
    ],
    note: {
      tone: "warning",
      title: "Unknown — checking with provider",
      text: "Airtel callbacks are delayed this morning. The payment stays Unknown until the provider answers.",
    },
    board: "FinanceHome",
    cta: "Resolve in Exceptions",
  },
  {
    id: "PI-77131",
    time: "12 Oct 09:41",
    payer: "Aisha Mohammed",
    record: "F-5528 · Room 304",
    method: "MTN MoMo",
    account: "078•••2210",
    icon: "Smartphone",
    amount: 30000,
    state: "Verified",
    providerRef: "MTN 8841199820",
    events: [
      E("Attempt 1 · prompt sent", "09:40:31 · key pi_77131:att_1", "success"),
      E("Webhook received · signature verified", "09:41:02 · SUCCESSFUL", "success"),
      E("Posted once and allocated to F-5528", "09:41:03 · LE-90401", "success"),
    ],
    evidence: [
      V("success", "GT Bank reference", "GTB-MM-26101162"),
      V("success", "MTN transaction ID", "8841199820"),
      V("success", "Webhook signature", "Verified · HMAC-SHA256 · key gtb-wh-2026-09"),
      V("success", "Replay protection", "Event evt_8c21d4 seen once"),
      V("success", "Ledger", "LE-90401 · one balanced posting"),
    ],
    note: {
      tone: "success",
      title: "Verified by the provider",
      text: "MTN MoMo via GT Bank · ref 8841199820 · 12 Oct 09:41.",
    },
  },
  {
    id: "PI-77127",
    time: "10 Oct 12:31",
    payer: "Pierre Laurent",
    record: "F-5497 · late minibar charge",
    method: "Card",
    account: "Mastercard ••7730",
    icon: "CreditCard",
    amount: 46000,
    state: "Failed",
    providerRef: "GTB-CD-26100955",
    events: [
      E("Attempt 1 · card on file", "10 Oct 12:31 · key pi_77127:att_1", "success"),
      E("Declined by issuer", "Code 51 · insufficient funds", "danger"),
    ],
    evidence: [
      V("success", "GT Bank reference", "GTB-CD-26100955"),
      V("danger", "Issuer response", "51 · insufficient funds"),
      V("idle", "Ledger", "Nothing posted"),
    ],
    note: {
      tone: "danger",
      title: "Failed with a provider reason",
      text: "Front desk can send the guest a payment link. A retry uses a new attempt and key.",
    },
    board: "Folios",
    cta: "Open folio F-5497",
  },
  {
    id: "PI-77126",
    time: "12 Oct 07:15",
    payer: "Marie Claire Uwimana",
    record: "F-5518 · Room 401",
    method: "MTN MoMo",
    account: "078•••6630",
    icon: "Smartphone",
    amount: 312000,
    state: "Verified",
    providerRef: "MTN 8841190021",
    events: [
      E("Attempt 1 · prompt sent", "07:15:02 · key pi_77126:att_1", "success"),
      E("No answer in 30 s · Unknown", "07:15:32", "warning"),
      E("Poll: provider says FAILED", "07:17:00 · customer cancelled the prompt", "danger"),
      E("Attempt 2 · prompt sent", "07:21:40 · new key pi_77126:att_2", "success"),
      E("Webhook received · signature verified", "07:22:05 · SUCCESSFUL", "success"),
      E("Duplicate webhook ignored", "07:22:41 · same event ID", "default"),
      E("Posted once and allocated to F-5518", "07:22:06 · LE-90388", "success"),
    ],
    evidence: [
      V("success", "GT Bank reference", "GTB-MM-26101139"),
      V("success", "MTN transaction ID", "8841190021"),
      V("success", "Webhook", "Received 07:22:05 · event evt_7f3a19"),
      V("success", "Signature", "Verified · HMAC-SHA256 · key gtb-wh-2026-09"),
      V("success", "Replay protection", "Timestamp within 5 min · duplicate at 07:22:41 ignored"),
      V("success", "Idempotency key", "pi_77126:att_2"),
      V("success", "Ledger", "LE-90388 · one balanced posting"),
    ],
    note: {
      tone: "success",
      title: "Verified by the provider",
      text: "MTN MoMo via GT Bank · ref 8841190021 · 12 Oct 07:22. Attempt 1 failed at the provider and was never counted.",
    },
  },
  {
    id: "PI-77118",
    time: "3 Oct 16:20",
    payer: "Grace Achieng",
    record: "BK-20437 · deposit",
    method: "MTN MoMo",
    account: "079•••5521",
    icon: "Smartphone",
    amount: 85000,
    state: "Verified",
    providerRef: "MTN 8841122614",
    events: [
      E("Webhook received · signature verified", "3 Oct 16:20 · SUCCESSFUL", "success"),
      E("Refund RF-3107 approved", "12 Oct 09:40 · Aline Uwase", "current"),
    ],
    evidence: [
      V("success", "GT Bank reference", "GTB-MM-26100344"),
      V("success", "MTN transaction ID", "8841122614"),
      V("success", "Ledger", "LE-88910 · deposit liability"),
    ],
    note: {
      tone: "success",
      title: "Verified by the provider",
      text: "Deposit held as a liability for BK-20437. Its refund is in the queue on the right.",
    },
  },
  {
    id: "PI-77112",
    time: "8 Oct 11:05",
    payer: "Pierre Laurent",
    record: "F-5497 · room charges",
    method: "Card",
    account: "Mastercard ••7730",
    icon: "CreditCard",
    amount: 310000,
    state: "Disputed",
    providerRef: "GTB-CD-26100811",
    events: [
      E("Verified at checkout", "8 Oct 11:05 · auth 603551", "success"),
      E("Chargeback notice CB-2210", "11 Oct · reason: amount differs", "danger"),
      E("Response due", "25 Oct", "current"),
    ],
    evidence: [
      V("success", "GT Bank reference", "GTB-CD-26100811"),
      V("danger", "Dispute", "CB-2210 · RWF 310,000 provisionally debited"),
      V("success", "Ledger", "Dispute posting LE-90112 · reversible"),
    ],
    note: {
      tone: "danger",
      title: "Disputed by the cardholder",
      text: "Prepare evidence: signed registration card, folio F-5497 and the room-rate confirmation.",
    },
    board: "Folios",
    cta: "Open folio F-5497",
  },
  {
    id: "PI-77109",
    time: "11 Oct 18:02",
    payer: "Jean Bosco Nkurunziza",
    record: "F-5529 · Room 306",
    method: "Airtel Money",
    account: "073•••4471",
    icon: "Smartphone",
    amount: 40000,
    state: "Reversed",
    providerRef: "GTB-AM-26101120",
    events: [
      E("Duplicate debit detected", "11 Oct 18:02 · same order as PI-77108", "warning"),
      E("Provider reversed the debit", "11 Oct 19:30 · reversal GTB-RV-26101104", "success"),
    ],
    evidence: [
      V("success", "Reversal reference", "GTB-RV-26101104"),
      V("success", "Ledger", "LE-90207 and its reversal LE-90233 · net zero"),
    ],
    note: {
      tone: "default",
      title: "Reversed by the provider",
      text: "The original PI-77108 stays Verified. This duplicate was never allocated to the folio.",
    },
  },
  {
    id: "PI-77104",
    time: "1 Oct 14:10",
    payer: "Fatuma Hassan",
    record: "BK-20409 · deposit · no-show",
    method: "Airtel Money",
    account: "073•••2290",
    icon: "Smartphone",
    amount: 220000,
    state: "Verified",
    providerRef: "AM261001.1410.F2290",
    events: [
      E("Webhook received · signature verified", "1 Oct 14:10 · SUCCESSFUL", "success"),
      E("Booking marked no-show", "11 Oct 23:31 · night audit", "warning"),
    ],
    evidence: [
      V("success", "GT Bank reference", "GTB-AM-26100117"),
      V("success", "Airtel transaction ID", "AM261001.1410.F2290"),
      V("success", "Ledger", "LE-88604 · deposit liability"),
    ],
    note: {
      tone: "success",
      title: "Verified by the provider",
      text: "Deposit still held. Applying the no-show charge is an exception in your queue.",
    },
    board: "FinanceHome",
    cta: "Open exception",
  },
  {
    id: "PI-77102",
    time: "28 Sep 09:30",
    payer: "Akagera Horizon Travel",
    record: "BK-20399 · group deposit",
    method: "Bank transfer",
    account: "GT Bank · FT26271AK3P9",
    icon: "Vault",
    amount: 300000,
    state: "Refunded",
    providerRef: "FT26280RF2Q1",
    events: [
      E("Bank credit matched", "28 Sep · statement line", "success"),
      E("Refund RF-3088 executed", "7 Oct · Grace Uwera", "success"),
      E("Refund confirmed on statement", "8 Oct · FT26280RF2Q1", "success"),
    ],
    evidence: [
      V("success", "Refund reference", "FT26280RF2Q1"),
      V("success", "Refund receipt", "EBM-0041-87802 · credit note issued"),
      V("success", "Ledger", "LE-89340 · balanced reversal"),
    ],
    note: {
      tone: "default",
      title: "Refunded and confirmed",
      text: "Approved by Aline Uwase, executed by Grace Uwera, confirmed on the GT Bank statement of 8 Oct.",
    },
  },
];

const refunds: RefundRequest[] = [
  {
    id: "RF-3107",
    ref: "BK-20437 · Grace Achieng",
    amount: 85000,
    kind: "Full",
    rail: "MTN MoMo 079•••5521",
    policy: "Cancellation tier 1 · cancelled 14 days before arrival · full refund under policy v2",
    requestedBy: "Eric Habimana",
    approvedBy: "Aline Uwase",
    checks: [
      { tone: "success", text: "Separation of duties · requester, approver and executor differ" },
      { tone: "success", text: "Provider capability · full MoMo refund confirmed" },
    ],
    executable: true,
  },
  {
    id: "RF-3105",
    ref: "BK-20418 · Volcano view group",
    amount: 480000,
    kind: "Full",
    rail: "GT Bank transfer",
    policy: "Cancellation tier 2 · 2 of 6 rooms released 3 days out",
    requestedBy: "Aline Uwase",
    approvedBy: "Didier Mugenzi (pending)",
    checks: [
      { tone: "idle", text: "Above the RWF 300,000 GM limit · owner approval needed" },
      { tone: "success", text: "Provider capability · bank transfer refund confirmed" },
    ],
    why: "Waiting for Didier Mugenzi. You can execute once approved.",
    status: "Waiting for approval",
    statusTone: "default",
  },
  {
    id: "RF-3104",
    ref: "F-5490 · Sarah Kimani",
    amount: 40000,
    kind: "Partial of RWF 315,000",
    rail: "Card Visa ••5512",
    policy: "Service recovery · Terrace dinner on 10 Oct",
    requestedBy: "Aline Uwase",
    approvedBy: "Aline Uwase",
    checks: [
      { tone: "danger", text: "Separation of duties · requester and approver are the same person" },
      { tone: "danger", text: "Partial card refunds not confirmed by GT Bank for this account" },
    ],
    gate: true,
    why: "Needs a different approver. Ask Aline whether to refund by bank transfer instead while partial card refunds are unconfirmed.",
    status: "Blocked",
    statusTone: "danger",
  },
  {
    id: "RF-3101",
    ref: "BK-20402 · Ishyamba booking",
    amount: 60000,
    kind: "Full",
    rail: "MTN MoMo 078•••9014",
    policy: "Cancellation tier 1 · full refund",
    requestedBy: "Eric Habimana",
    approvedBy: "Aline Uwase",
    checks: [
      { tone: "success", text: "Separation of duties · requester, approver and executor differ" },
      { tone: "warning", text: "Refund receipt (credit note) Pending at VSDC" },
    ],
    why: "Executed by you 08:55 · GT Bank GTB-RF-26101203 · not Refunded until the provider confirms.",
    status: "Pending at provider",
    statusTone: "warning",
  },
];

const deskMethods: DeskMethod[] = [
  {
    id: "mtn",
    label: "MTN MoMo",
    fieldLabel: "Payer phone",
    fieldValue: "078 512 3306",
    fieldHelp: "Network detected: MTN · the prompt goes to this number",
    outcomeTitle: "Starts as Initiated",
    outcomeText:
      "The guest approves on their phone. It becomes Verified only after GT Bank confirms with a signed callback or status query.",
    cta: "Send payment prompt",
    state: "Initiated",
    icon: "Smartphone",
    account: "078•••3306",
    method: "MTN MoMo",
  },
  {
    id: "airtel",
    label: "Airtel Money",
    fieldLabel: "Payer phone",
    fieldValue: "073 120 4471",
    fieldHelp: "Network detected: Airtel",
    outcomeTitle: "Starts as Initiated",
    outcomeText: "Airtel callbacks are delayed this morning; Injishi polls every 2 minutes until the provider answers.",
    cta: "Send payment prompt",
    state: "Initiated",
    icon: "Smartphone",
    account: "073•••4471",
    method: "Airtel Money",
  },
  {
    id: "card",
    label: "Card",
    fieldLabel: "Terminal",
    fieldValue: "GT Bank POS · front desk T2",
    fieldHelp: "The guest taps or inserts the card on the terminal",
    outcomeTitle: "Starts as Pending",
    outcomeText: "Verified when GT Bank returns the authorisation. A terminal slip alone is not enough.",
    cta: "Start on terminal",
    state: "Pending",
    icon: "CreditCard",
    account: "Terminal T2",
    method: "Card",
  },
  {
    id: "bank",
    label: "Bank transfer",
    fieldLabel: "Payer’s bank reference",
    fieldValue: "BK/IB/26101233",
    fieldHelp: "From the payer’s transfer confirmation",
    outcomeTitle: "Stays Pending until the statement line arrives",
    outcomeText:
      "Reconciliation matches it to the GT Bank statement. A payer’s screenshot is recorded but not treated as proof.",
    cta: "Record transfer",
    state: "Pending",
    icon: "Vault",
    account: "Ref BK/IB/26101233",
    method: "Bank transfer",
  },
  {
    id: "cash",
    label: "Cash",
    fieldLabel: "Till",
    fieldValue: "Till 2 · Eric Habimana",
    fieldHelp: "Counted into the drawer now",
    outcomeTitle: "Recorded on the till",
    outcomeText: "Cash is checked at the cashier’s shift close against the counted drawer.",
    cta: "Record cash",
    state: "Recorded",
    icon: "Wallet",
    account: "Till 2",
    method: "Cash",
  },
];

const reconSources: ReconSource[] = [
  {
    id: "statement",
    icon: "Vault",
    title: "GT Bank statement",
    value: "RWF 9,842,600",
    meta: "GTB-STMT-20261011.csv · 214 lines · imported 06:02 · checksum matched",
    tone: "success",
  },
  {
    id: "settlement",
    icon: "FileArrowDown",
    title: "Settlement files",
    value: "2 of 3 received",
    meta: "MTN and Airtel 06:00 · card file for 11 Oct missing, retry 10:30",
    tone: "warning",
  },
  {
    id: "ledger",
    icon: "Book",
    title: "Payment ledger",
    value: "RWF 9,618,200",
    meta: "209 verified entries · append-only",
    tone: "success",
  },
  {
    id: "fiscal",
    icon: "FileCheck",
    title: "Folios and fiscal receipts",
    value: "188 issued",
    meta: "3 Pending at VSDC · 0 Rejected",
    tone: "warning",
  },
];

const matchSummary: MatchSummaryItem[] = [
  { id: "auto", label: "Auto-matched", count: 201 },
  { id: "suggested", label: "Suggested", count: 6 },
  { id: "bank", label: "Unmatched bank", count: 4 },
  { id: "ledger", label: "Unmatched ledger", count: 3 },
  { id: "fiscal", label: "Fiscal gaps", count: 3 },
];

const R = (tone: CheckTone, text: string) => ({ tone, text });
const D = (side: "Dr" | "Cr", account: string, amount: number) => ({ side, account, amount });

const reconMatches: ReconMatch[] = [
  {
    id: "s1",
    tab: "suggested",
    confidence: "High",
    title: "MTN MoMo settlement · batch B1",
    kind: "Suggested match · provider settlement",
    bank: 1498500,
    bankText: "Line 142 · MOMO SETTLE MTN 11OCT B1",
    ledger: 1500000,
    ledgerText: "Batch MB-1011-01 · 14 verified MoMo payments",
    record: "14 folios",
    fiscal: "12 issued · 2 pending",
    diff: -1500,
    reasons: [
      R("success", "Reference names batch MB-1011-01 and value date is T+1"),
      R("success", "All 14 payments verified individually with MTN references"),
      R("success", "Difference RWF 1,500 equals the contracted 0.1% MoMo fee"),
      R("warning", "2 folios in the batch still have Pending fiscal receipts · tracked separately"),
    ],
    postings: [
      D("Dr", "GT Bank operating ••• 4471", 1498500),
      D("Dr", "Provider fees", 1500),
      D("Cr", "MoMo settlement clearing", 1500000),
    ],
    canAccept: true,
  },
  {
    id: "s2",
    tab: "suggested",
    confidence: "Medium",
    title: "Card settlement · 10 Oct batch",
    kind: "Suggested match · provider settlement",
    bank: 2286400,
    bankText: "Line 171 · POS SETTLE GTB 10OCT",
    ledger: 2310000,
    ledgerText: "Batch CB-1010 · 9 verified card payments",
    record: "9 folios",
    fiscal: "9 issued",
    diff: -23600,
    reasons: [
      R("success", "Reference and value date match batch CB-1010"),
      R("success", "All 9 authorisations verified by GT Bank"),
      R("warning", "Expected MDR at 1.00% is RWF 23,100; bank deducted RWF 23,600"),
      R("danger", "RWF 500 unexplained · outside the RWF 0 tolerance"),
    ],
    postings: [
      D("Dr", "GT Bank operating ••• 4471", 2286400),
      D("Dr", "Card fees", 23100),
      D("Dr", "Bank fees · pending reason", 500),
      D("Cr", "Card settlement clearing", 2310000),
    ],
    why: "RWF 500 is unexplained. Match manually with a reason; a second approver signs it off.",
    manualReason:
      "Card MDR charged at 1.02% on this batch instead of 1.00%. Post RWF 500 to bank fees; GT Bank asked to confirm the rate.",
  },
  {
    id: "s3",
    tab: "suggested",
    confidence: "High",
    title: "Umurage Consulting Ltd transfer",
    kind: "Suggested match · corporate receivable",
    bank: 1200000,
    bankText: "Line 187 · UMURAGE CONS LTD OCT",
    ledger: 1200000,
    ledgerText: "INV-26-0388 · part payment, oldest first",
    record: "CL-014 · INV-26-0388",
    fiscal: "Issued",
    diff: 0,
    reasons: [
      R("success", "Payer name matches debtor account CL-014"),
      R("success", "Oldest invoice INV-26-0388 has RWF 1,239,000 open; RWF 39,000 would stay open"),
      R("warning", "INV-26-0401 carries a RWF 118,000 dispute, so it is not suggested"),
      R("idle", "Allocation to invoices is approved by a second person"),
    ],
    postings: [],
    why: "Allocations to receivables use the allocation panel below and need a second approver.",
    board: "AccountsReceivable",
    cta: "Open receivables",
  },
  {
    id: "s4",
    tab: "suggested",
    confidence: "High",
    title: "Airtel Money settlement · 11 Oct",
    kind: "Suggested match · provider settlement",
    bank: 433700,
    bankText: "Line 190 · AIRTEL SETTLE 11OCT",
    ledger: 434000,
    ledgerText: "Batch AB-1011 · 5 verified Airtel payments",
    record: "5 folios",
    fiscal: "5 issued",
    diff: -300,
    reasons: [
      R("success", "Reference names batch AB-1011"),
      R("success", "All 5 payments verified"),
      R("success", "RWF 300 equals the contracted Airtel fee"),
    ],
    postings: [
      D("Dr", "GT Bank operating ••• 4471", 433700),
      D("Dr", "Provider fees", 300),
      D("Cr", "Airtel settlement clearing", 434000),
    ],
    canAccept: true,
  },
  {
    id: "s5",
    tab: "suggested",
    confidence: "Medium",
    title: "EAC Health Forum second deposit",
    kind: "Suggested match · master bill deposit",
    bank: 1000000,
    bankText: "Line 201 · TRF EAC FORUM DEP 2",
    ledger: 1000000,
    ledgerText: "Expected deposit · contract SE-0031 · due 15 Oct",
    record: "F-5540 master bill",
    fiscal: "Proforma only",
    diff: 0,
    reasons: [
      R("success", "Amount equals the second contracted deposit"),
      R("warning", "Reference text only partly matches the contract"),
      R("idle", "Deposit is a liability on F-5540, not revenue"),
    ],
    postings: [D("Dr", "GT Bank operating ••• 4471", 1000000), D("Cr", "Guest deposits · F-5540", 1000000)],
    canAccept: true,
    board: "Folios",
    cta: "Open F-5540",
  },
  {
    id: "s6",
    tab: "suggested",
    confidence: "High",
    title: "Airtel reversal of duplicate debit",
    kind: "Suggested match · provider reversal",
    bank: -40000,
    bankText: "Line 205 · FT REVERSAL 26101104",
    ledger: -40000,
    ledgerText: "PI-77109 reversal · LE-90233",
    record: "F-5529 · not allocated",
    fiscal: "Not fiscalised",
    diff: 0,
    reasons: [
      R("success", "Reversal reference GTB-RV-26101104 matches PI-77109"),
      R("success", "The duplicate was never allocated to a folio"),
    ],
    postings: [D("Dr", "Airtel settlement clearing", 40000), D("Cr", "GT Bank operating ••• 4471", 40000)],
    canAccept: true,
  },
  {
    id: "b1",
    tab: "bank",
    title: "MTN settlement · batch B2",
    kind: "Unmatched bank line",
    bank: 118800,
    bankText: "Line 176 · MOMO SETTLE MTN 11OCT B2",
    ledger: null,
    ledgerText: "Detail names MTN 8841207733",
    record: "F-5531?",
    fiscal: "—",
    diff: null,
    reasons: [
      R("warning", "Settlement detail names MTN 8841207733, the Unknown payment PI-77142"),
      R("idle", "Resolve PI-77142 from the provider first; settlement alone does not verify it"),
    ],
    postings: [],
    why: "Resolve the Unknown payment first.",
    board: "FinanceHome",
    cta: "Open PI-77142 exception",
  },
  {
    id: "b2",
    tab: "bank",
    title: "Cheque deposit 004512",
    kind: "Unmatched bank line",
    bank: 250000,
    bankText: "Line 88 · CHQ DEP 004512",
    ledger: null,
    ledgerText: "No payment or invoice",
    record: "—",
    fiscal: "—",
    diff: null,
    reasons: [
      R("danger", "No intent, invoice or deposit expected for this amount"),
      R("idle", "Ask the bank for the depositor name"),
    ],
    postings: [],
    why: "Nothing to match yet.",
  },
  {
    id: "b3",
    tab: "bank",
    title: "Bank charges · September",
    kind: "Unmatched bank line",
    bank: -12000,
    bankText: "Line 133 · BANK CHARGES SEP",
    ledger: null,
    ledgerText: "Not a payment · general ledger item",
    record: "—",
    fiscal: "—",
    diff: null,
    reasons: [R("warning", "Post to bank charges in the general ledger")],
    postings: [],
    why: "Post through the general ledger.",
    board: "GeneralLedger",
    cta: "Open general ledger",
  },
  {
    id: "b4",
    tab: "bank",
    title: "Transfer from J. Nyiraneza",
    kind: "Unmatched bank line",
    bank: 15000,
    bankText: "Line 198 · TRF NYIRANEZA",
    ledger: null,
    ledgerText: "No matching record",
    record: "—",
    fiscal: "—",
    diff: null,
    reasons: [
      R("danger", "Payer is not a guest or debtor on record"),
      R("idle", "Could be a staff repayment · HR records are not visible to Finance"),
    ],
    postings: [],
    why: "Nothing to match yet.",
  },
  {
    id: "l1",
    tab: "ledger",
    title: "PI-77071 · card · Sarah Kimani",
    kind: "Verified, not yet settled",
    bank: null,
    bankText: "Not on statement",
    ledger: 315000,
    ledgerText: "GT Bank auth 603988 · 11 Oct",
    record: "F-5490",
    fiscal: "EBM-0041-88290",
    diff: null,
    reasons: [R("warning", "Card settlement file for 11 Oct not received yet · expected 13 Oct")],
    postings: [],
    why: "Waits for the card settlement file.",
  },
  {
    id: "l2",
    tab: "ledger",
    title: "PI-77131 · MTN MoMo · Aisha Mohammed",
    kind: "Verified, not yet settled",
    bank: null,
    bankText: "Not on statement",
    ledger: 30000,
    ledgerText: "MTN 8841199820 · today 09:41",
    record: "F-5528",
    fiscal: "On close",
    diff: null,
    reasons: [R("idle", "Paid today · expected on the 12 Oct statement")],
    postings: [],
    why: "Expected on tomorrow’s statement.",
  },
  {
    id: "l3",
    tab: "ledger",
    title: "PI-77112 · card · Pierre Laurent",
    kind: "Disputed",
    bank: null,
    bankText: "Chargeback debit not on statement",
    ledger: 310000,
    ledgerText: "Chargeback CB-2210",
    record: "F-5497",
    fiscal: "Issued",
    diff: null,
    reasons: [R("danger", "Chargeback notice received; bank debit not yet posted")],
    postings: [],
    why: "Waits for the chargeback debit.",
    board: "Payments",
    cta: "Open in Payments",
  },
];

const reconInvoices: ReconInvoice[] = [
  {
    id: "INV-26-0388",
    src: "F-5431",
    due: "11 Aug",
    bucket: "62 days past due",
    bucketTone: "danger",
    open: 1239000,
    max: 1239000,
    ebm: "EBM-0041-86120",
    suggested: 1200000,
  },
  {
    id: "INV-26-0401",
    src: "F-5466",
    due: "8 Sep",
    bucket: "34 days past due",
    bucketTone: "warning",
    open: 519200,
    max: 401200,
    ebm: "EBM-0041-86904",
    note: "RWF 118,000 disputed · at most RWF 401,200 can be applied",
    suggested: 0,
  },
  {
    id: "INV-26-0412",
    src: "F-5501",
    due: "9 Nov",
    bucket: "Not due",
    bucketTone: "default",
    open: 342200,
    max: 342200,
    ebm: "EBM-0041-87988",
    suggested: 0,
  },
];

const settlementBatches: SettlementBatch[] = [
  {
    id: "mtn-b1",
    name: "MTN MoMo · 11 Oct · B1",
    meta: "Settled 12 Oct 06:00 · line 142",
    amount: 1498500,
    tone: "success",
  },
  {
    id: "airtel-1011",
    name: "Airtel Money · 11 Oct",
    meta: "Settled 12 Oct 06:00 · line 190",
    amount: 433700,
    tone: "success",
  },
  {
    id: "card-1010",
    name: "Card · 10 Oct",
    meta: "Settled 12 Oct · RWF 500 to explain",
    amount: 2286400,
    tone: "warning",
  },
  {
    id: "card-1011",
    name: "Card · 11 Oct",
    meta: "Expected 13 Oct · file not received",
    amount: 1340000,
    tone: "info",
  },
  {
    id: "ikawa",
    name: "Ikawa Corner Ltd",
    meta: "Separate merchant · settles to its own account · not in this run",
    amount: null,
    tone: "info",
  },
];

const cashierShifts: CashierShift[] = [
  {
    id: "TS2-1012-E",
    till: "Till 2",
    cashier: "Eric Habimana",
    initials: "EH",
    hours: "14:00–22:00",
    float: 100000,
    expectedCash: 512500,
    verifiedNonCash: 2640000,
    excludedCount: 3,
    excludedTotal: 217000,
    recountThreshold: 5000,
  },
];

const cashDenominations: CashDenomination[] = [
  { id: "n5000", label: "RWF 5,000 note", value: 5000, count: 72 },
  { id: "n2000", label: "RWF 2,000 note", value: 2000, count: 48 },
  { id: "n1000", label: "RWF 1,000 note", value: 1000, count: 40 },
  { id: "n500", label: "RWF 500 note", value: 500, count: 24 },
  { id: "c100", label: "RWF 100 coin", value: 100, count: 20 },
  { id: "c50", label: "RWF 50 coin", value: 50, count: 10 },
  { id: "c20", label: "RWF 20 coin", value: 20, count: 0 },
  { id: "c10", label: "RWF 10 coin", value: 10, count: 0 },
];

const floatRows: FloatRow[] = [
  { id: "f5000", label: "RWF 5,000", count: 10, amount: 50000 },
  { id: "f2000", label: "RWF 2,000", count: 15, amount: 30000 },
  { id: "f1000", label: "RWF 1,000", count: 15, amount: 15000 },
  { id: "f500", label: "RWF 500", count: 10, amount: 5000 },
];

const shiftTenders: ShiftTender[] = [
  {
    id: "cash",
    icon: "Wallet",
    label: "Cash",
    records: 9,
    amount: 412500,
    evidence: "Till receipts TR2-1012-031 to 039 · checked by this count",
  },
  {
    id: "mtn",
    icon: "Smartphone",
    label: "MTN MoMo",
    records: 11,
    amount: 1086000,
    evidence: "Each with MTN and GT Bank references",
  },
  {
    id: "airtel",
    icon: "Smartphone",
    label: "Airtel Money",
    records: 3,
    amount: 214000,
    evidence: "Each with Airtel and GT Bank references",
  },
  {
    id: "card",
    icon: "CreditCard",
    label: "Card",
    records: 4,
    amount: 1340000,
    evidence: "GT Bank authorisations · settles 13 Oct",
  },
  { id: "bank", icon: "Vault", label: "Bank transfer", records: 0, amount: 0, evidence: "None this shift" },
];

const excludedTenders: ExcludedTender[] = [
  { id: "PI-77145", state: "Pending", tone: "warning", text: "PI-77145 · MTN MoMo · Room 207 · 21:48", amount: 32000 },
  {
    id: "PI-77147",
    state: "Pending",
    tone: "warning",
    text: "PI-77147 · Card · Room 309 · 3-D Secure · 21:55",
    amount: 120000,
  },
  {
    id: "PI-77146",
    state: "Unknown",
    tone: "warning",
    text: "PI-77146 · Airtel Money · Room 112 Lake Bar tab · 20:31",
    amount: 65000,
  },
];

const tillStatuses: TillStatus[] = [
  {
    id: "till1",
    name: "Till 1 · morning",
    meta: "Closed 14:04 · approved by Aline Uwase",
    state: "Balanced",
    tone: "success",
  },
  {
    id: "terrace",
    name: "Isangano Terrace POS",
    meta: "Closed 22:01 · Joseph Habimana",
    state: "Balanced",
    tone: "success",
  },
  {
    id: "lakebar",
    name: "Lake Bar till",
    meta: "Offline since 21:48 · 4 tickets not synced",
    state: "Open",
    tone: "warning",
  },
  {
    id: "ishyamba",
    name: "Ishyamba reception",
    meta: "Closed 21:30 · Ishyamba duty manager",
    state: "Balanced",
    tone: "success",
  },
];

const auditSteps: AuditStep[] = [
  {
    id: "post",
    title: "Post room and tax charges",
    tone: "done",
    state: "Done",
    time: "23:31",
    detail: "47 occupied rooms and tents · RWF 5,563,000 room revenue · 47 accommodation-tax lines.",
    notes: ["Run key NA-20261012 · a re-run skips anything already posted", "Ishyamba: 13 tents · Isangano: 34 rooms"],
    gate: true,
  },
  {
    id: "noshow",
    title: "Process no-shows per policy",
    tone: "done",
    state: "Done",
    time: "23:32",
    detail: "2 no-shows under no-show policy v2.",
    notes: [
      "BK-20452 · not guaranteed · released, no charge",
      "BK-20455 · guaranteed · first night RWF 92,000 charged against its verified deposit",
    ],
  },
  {
    id: "rate",
    title: "Rate check",
    tone: "warn",
    state: "1 to review",
    time: "23:33",
    detail: "2 stays posted below their rate plan. Finance cannot change rates; reviews go to the general manager.",
    notes: [
      "Room 207 · RWF 70,000 vs RWF 92,000 · Umurage corporate rate, approved",
      "Room 402 · RWF 150,000 vs RWF 220,000 · manual override without approval code · sent to Aline Uwase",
    ],
  },
  {
    id: "balance",
    title: "Folio balance check",
    tone: "block",
    state: "Blocked",
    time: "23:34",
    detail: "4 Lake Bar tickets (RWF 96,500) are not on any folio yet, so in-house balances would be wrong.",
    notes: ["2 checked-out folios with balances carry over as exceptions: F-5509, F-5497"],
    resolvedBy: "sync",
    resolved: {
      tone: "done",
      state: "Done",
      time: "23:46",
      detail: "Every balance equals posted charges minus verified payments. 4 Lake Bar tickets now posted.",
      notes: ["2 checked-out folios with balances carry over as exceptions: F-5509, F-5497"],
    },
  },
  {
    id: "fiscal",
    title: "Fiscal queue check",
    tone: "warn",
    state: "Carries over",
    time: "23:35",
    detail: "3 sale receipts Pending at the VSDC for over 2 hours · 0 Rejected.",
    notes: ["They keep their request IDs, so a later answer cannot create a duplicate"],
  },
];

const auditIssues: AuditIssue[] = [
  {
    id: "sync",
    open: {
      icon: "CloudSlash",
      title: "Lake Bar till offline since 21:48",
      detail: "4 tickets · RWF 96,500 · saved on the till, not yet posted to folios",
      owner: "Joseph Habimana notified 23:32 · the till keeps the tickets until it reconnects",
      board: "FinanceHome",
      linkLabel: "Exceptions",
      actLabel: "Retry sync",
    },
    resolved: {
      icon: "CloudCheck",
      title: "Lake Bar till synced · 4 tickets posted",
      detail:
        "LB-2296 to LB-2299 · RWF 96,500 · posted to F-5525, F-5529, F-5531 and F-5533 with their original order IDs",
      owner: "Resolved 23:46 · synced from the till, not re-keyed",
    },
  },
  {
    id: "till",
    open: {
      icon: "Wallet",
      title: "Till 2 evening shift not closed",
      detail: "Eric Habimana · 14:00–22:00 · counted cash not yet approved",
      owner: "Every till must be closed before the date rolls",
      board: "ShiftClose",
      linkLabel: "Open shift close",
      actLabel: "Check again",
    },
    resolved: {
      icon: "Wallet",
      title: "Till 2 evening shift closed",
      detail: "Eric Habimana · closed 22:14 · variance −RWF 2,000 with reason",
      owner: "Approved by Grace Uwera",
    },
  },
];

const auditRuns: AuditRun[] = [
  {
    id: "r12",
    date: "12 Oct",
    by: "Grace Uwera",
    end: "23:48",
    result: "Completed",
    tone: "success",
    tonight: true,
    log: [
      { t: "23:30:02", m: "Started · scheduled · run NA-20261012" },
      { t: "23:31:10", m: "Posted 47 room and 47 tax lines" },
      { t: "23:32:04", m: "No-shows: 2 processed under policy v2" },
      { t: "23:34:00", m: "Blocked: Lake Bar till offline, Till 2 open", tone: "danger" },
      { t: "23:46:12", m: "Lake Bar synced · 4 tickets posted" },
      { t: "23:47:30", m: "Till 2 close confirmed" },
      { t: "23:48:05", m: "Business date rolled to 13 Oct" },
    ],
  },
  {
    id: "r11",
    date: "11 Oct",
    by: "Scheduled · reviewed by Grace Uwera",
    end: "00:12",
    result: "Completed",
    tone: "success",
    log: [
      { t: "23:30:01", m: "Started · scheduled · run NA-20261011" },
      { t: "23:30:48", m: "Posted 44 room and 44 tax lines · RWF 5,108,000" },
      { t: "23:31:05", m: "No-shows: BK-20409 guaranteed · deposit held for Finance", tone: "warning" },
      { t: "23:31:20", m: "Rate check: 0 exceptions" },
      { t: "23:32:10", m: "Folio balances: 0 differences" },
      { t: "23:33:02", m: "Fiscal queue: VSDC timeout on 1 receipt, retried", tone: "warning" },
      { t: "00:11:40", m: "Fiscal receipt issued on retry 2 · same request ID" },
      { t: "00:12:03", m: "Business date rolled to 12 Oct" },
    ],
  },
  {
    id: "r10",
    date: "10 Oct",
    by: "Scheduled",
    end: "23:41",
    result: "With warnings",
    tone: "warning",
    log: [
      { t: "23:30:02", m: "Started · scheduled · run NA-20261010" },
      { t: "23:31:00", m: "Posted 41 room and 41 tax lines" },
      { t: "23:33:15", m: "Folio balances: F-5497 minibar after checkout", tone: "warning" },
      { t: "23:41:00", m: "Business date rolled to 11 Oct" },
    ],
  },
  {
    id: "r09",
    date: "9 Oct",
    by: "Aline Uwase",
    end: "00:55",
    result: "Held, then done",
    tone: "default",
    log: [
      { t: "23:30:01", m: "Started · scheduled · run NA-20261009" },
      { t: "23:34:20", m: "Blocked: Till 1 evening shift not closed", tone: "danger" },
      { t: "00:52:10", m: "Till 1 closed · approved by Aline Uwase" },
      { t: "00:55:02", m: "Business date rolled to 10 Oct" },
    ],
  },
  {
    id: "r08",
    date: "8 Oct",
    by: "Scheduled",
    end: "23:38",
    result: "Completed",
    tone: "success",
    log: [
      { t: "23:30:02", m: "Started · scheduled · run NA-20261008" },
      { t: "23:30:55", m: "Posted 38 room and 38 tax lines" },
      { t: "23:38:10", m: "Business date rolled to 9 Oct" },
    ],
  },
];

export const fixtures = {
  "finance.exceptionGroups": exceptionGroups,
  "finance.exceptions": exceptions,
  "finance.homeKpis": homeKpis,
  "finance.resolvedToday": resolvedToday,
  "finance.folios": folios,
  "finance.payments": payments,
  "finance.refunds": refunds,
  "finance.deskMethods": deskMethods,
  "finance.reconSources": reconSources,
  "finance.matchSummary": matchSummary,
  "finance.reconMatches": reconMatches,
  "finance.reconInvoices": reconInvoices,
  "finance.settlementBatches": settlementBatches,
  "finance.cashierShifts": cashierShifts,
  "finance.cashDenominations": cashDenominations,
  "finance.floatRows": floatRows,
  "finance.shiftTenders": shiftTenders,
  "finance.excludedTenders": excludedTenders,
  "finance.tillStatuses": tillStatuses,
  "finance.auditSteps": auditSteps,
  "finance.auditIssues": auditIssues,
  "finance.auditRuns": auditRuns,
} satisfies FixtureSet;
