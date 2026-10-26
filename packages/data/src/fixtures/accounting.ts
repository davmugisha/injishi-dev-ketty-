import type { BoardId, FixtureSet, IconName } from "../types.ts";

/**
 * Embedded-database fixtures for the "accounting" area: Fiscal receipts (EBM / VSDC), Accounts
 * receivable (city ledger), Commissions and payouts, General ledger and Tax summaries.
 * Collection names are "accounting.<thing>"; every document has a stable string `id`.
 * Values are lifted verbatim from the artifact boards (node tools/artifact/extract.mjs <Board>).
 * Amounts are numbers in RWF; the views format them with formatRwf().
 */

export type Tone = "accent" | "success" | "warning" | "danger" | "default" | "info";
/** KPI icon tint (HeroUI KPI.Icon status; "default" = no tint). */
export type KpiStatus = "success" | "warning" | "danger" | "default";
/** Timeline marker status. */
export type MarkerStatus = "default" | "current" | "success" | "warning" | "danger" | "muted";

export interface LogEntry {
  status: MarkerStatus;
  title: string;
  detail: string;
}

/** Headline figure of a finance screen. */
export interface AccountingKpi {
  id: string;
  board: BoardId;
  label: string;
  /** Number formatted per `format`; ignored when `text` is set. */
  value: number;
  format: "rwf" | "count";
  /** Text after the number, e.g. " of 10 checks". */
  suffix?: string;
  /** A non-numeric headline, e.g. a batch id. */
  text?: string;
  foot: string;
  icon: IconName;
  status: KpiStatus;
}

// ── Fiscal receipts (EBM / VSDC) ─────────────────────────────────────────────

/** A legal merchant with its own fiscal profile, counters and devices. */
export interface FiscalProfile {
  id: string;
  name: string;
  tin: string;
  scope: string;
  series: string;
  access: string;
  lastZ: string;
  credentials: string;
  /** The other merchant whose counters are kept apart. */
  other: string;
  issuedToday: number;
  refundsThisMonth: number;
  xReport: string;
  device: string;
  branch: string;
  numberingNote: string;
  invoiceNote: string;
}

export type FiscalStatus = "pending" | "unknown" | "rejected" | "issued" | "draft" | "notFiscal" | "billing";

/** A document the VSDC has not signed yet. */
export interface FiscalQueueItem {
  id: string;
  merchant: string;
  status: "pending" | "unknown" | "rejected";
  type: string;
  source: string;
  /** Screen that holds the source record. */
  board: BoardId;
  trigger: string;
  amount: number;
  requestId: string;
  attempts: number;
  age: string;
  /** Original fiscal number a refund receipt credits. */
  credits?: string;
  /** Catalog item that blocks the document (rejected: missing item class). */
  itemId?: string;
  reason?: string;
  fix?: string;
  log: LogEntry[];
}

export interface FiscalDocumentKind {
  id: string;
  icon: IconName;
  title: string;
  chip: string;
  tone: Tone;
  description: string;
}

export interface FiscalInvoice {
  id: string;
  merchant: string;
  kind: "proforma" | "fiscal" | "commercial";
  source: string;
  created: string;
  amount: number;
  status: FiscalStatus;
  reference: string;
}

export interface FiscalReceipt {
  id: string;
  merchant: string;
  kind: "sale" | "refund";
  customer: string;
  signedAt: string;
  lines: { description: string; amount: number }[];
  total: number;
  vat: number;
  net: number;
  counter: string;
  signature: string;
  reference: string | null;
  payment: string;
  board: BoardId;
}

export interface VsdcDevice {
  id: string;
  merchant: string;
  usedBy: string;
  sale: number;
  refund: number;
  copy: number;
  total: number;
  lastSigned: string;
}

export interface FiscalJournalEvent {
  id: string;
  merchant: string;
  time: string;
  event: string;
  detail: string;
  sequence: number;
}

export interface ZReport {
  id: string;
  merchant: string;
  day: string;
  receipts: number;
  sales: number;
  vat: number;
  refunds: number;
}

export interface ItemCode {
  id: string;
  merchant: string;
  name: string;
  soldAt: string;
  code: string | null;
  status: "mapped" | "unmapped" | "review";
  /** Suggested RRA item class, from similar items already mapped. */
  suggestion?: string;
  hint?: string;
}

// ── Accounts receivable (city ledger) ───────────────────────────────────────

export interface ArInvoice {
  id: string;
  source: string;
  fiscal: string;
  due: string;
  amount: number;
  state: string;
  tone: Tone;
}

export interface ArDispute {
  invoice: string;
  amount: number;
  what: string;
  opened: string;
  evidence: string;
  /** Fiscal receipt a credit note would credit. */
  fiscal: string;
}

export interface ArAccount {
  id: string;
  initials: string;
  name: string;
  kind: "company" | "agent";
  type: string;
  tin: string;
  terms: string;
  termsDetail: string;
  /** Credit limit in RWF; null when the account holds deposits only. */
  limit: number | null;
  balance: number;
  oldest: string;
  severity: Tone;
  contact: string;
  bookers: string;
  /** Shown instead of credit use and balance when there is no credit line. */
  noCreditLine?: { usage: string; balance: string };
  contract: { version: string; terms: string; state: "Current" | "Superseded" }[];
  foot: string;
  invoices: ArInvoice[];
  collections: LogEntry[];
  collectionsNote: string;
  /** Shown instead of the collection history when there is none. */
  quiet: string;
  dispute: ArDispute | null;
}

export interface AgingBucket {
  id: string;
  label: string;
  name: string;
  amount: number;
  severity: "none" | "low" | "medium" | "high";
}

export interface AllocationProposal {
  account: string;
  detail: string;
  rows: { invoice: string; status: string; open: number; proposed: number }[];
  alertTitle: string;
  alertText: string;
}

export interface BankTransfer {
  id: string;
  line: string;
  at: string;
  reference: string;
  sender: string;
  amount: number;
  status: "unmatched" | "pending" | "verified";
  note: string;
  /** Deposits are liabilities: allocated in Reconciliation, never matched here. */
  toReconciliation: boolean;
  /** Detail once you propose the allocation. */
  proposedNote?: string;
  allocation?: AllocationProposal;
}

// ── Commissions and payouts ─────────────────────────────────────────────────

export interface CommissionLine {
  id: string;
  payee: string;
  kind: "agent" | "broker";
  role: string;
  source: string;
  guest: string;
  stay: string;
  basis: number;
  rate: number;
  contract: string;
  payer: string;
  taxDocument: string;
  hasTaxDocument: boolean;
  sourceRecord: string;
  status: "await" | "hold" | "approved";
  holdReason?: string;
  /** Short reason under the status chip while on hold. */
  holdHint?: string;
  settlement: string;
  /** Who is asked again for a missing commission invoice. */
  invoiceContact?: string;
  log: LogEntry[];
}

export interface Payout {
  id: string;
  type: string;
  payee: string;
  account: string;
  payer: string;
  amount: number;
  status: "scheduled" | "sent" | "confirmed" | "failed";
  when: string;
  note: string;
}

// ── General ledger ──────────────────────────────────────────────────────────

export interface JournalEntry {
  id: string;
  at: string;
  source: "payment" | "folio" | "bank" | "procurement" | "reversal" | "cityLedger";
  reference: string;
  description: string;
  status: "posted" | "pending" | "reversal";
  lines: { account: string; department: string; debit: number; credit: number }[];
  evidence: string;
  postingKey: string;
  actor: string;
}

export interface LedgerAccount {
  id: string;
  code: string;
  name: string;
  type: string;
  department: string;
  mapping: "approved" | "proposed" | "unmapped";
  /** USALI schedule proposed for an unmapped account. */
  proposal?: string;
}

export interface ClosePeriod {
  id: string;
  name: string;
  detail: string;
  state: string;
  stateTone: Tone;
  status: "open" | "closed";
  checks: { status: "ok" | "warn" | "wait"; title: string; detail: string }[];
}

export interface ExportBatch {
  id: string;
  when: string;
  range: string;
  format: string;
  entries: number;
  ledgerDebits: number;
  exportDebits: number;
  status: "reconciled" | "blocked";
  note: string;
}

// ── Tax summaries ───────────────────────────────────────────────────────────

export interface VatSummary {
  id: string;
  merchant: string;
  period: "sep" | "oct";
  periodLabel: string;
  periodState: string;
  periodTone: Tone;
  rows: { category: string; rule: string; lines: number; net: number }[];
  input: { invoices: number; amount: number };
  inputNote: string;
  documents: string;
  dailyReports: string;
  computed: string;
  excluded: string;
  fiscalStatus: string;
}

export interface VatDeclaration {
  id: string;
  merchant: string;
  period: "sep" | "oct";
  stage: "draft" | "reviewed" | "exported";
  preparedBy: string;
  prepared: string;
  reviewer: string;
  reviewed: string;
  reviewNote: string;
  file: string;
  checksum: string;
  documents: number;
  supplierInvoices: number;
}

export interface Levy {
  id: string;
  name: string;
  why: string;
}

// ── Data ────────────────────────────────────────────────────────────────────

const AHL = "Amahoro Hospitality Ltd";
const ARL = "Amahoro Residences Ltd";

const fiscalProfiles: FiscalProfile[] = [
  {
    id: "ahl",
    name: AHL,
    tin: "TIN 102 345 678",
    scope: "Isangano Lakeside Hotel, Ishyamba Forest Lodge, Isangano Terrace, Lake Bar",
    series: "EBM-0041 · last issued 88,331",
    access: "Full finance access",
    lastZ: "Z-0287 · 11 Oct 23:59",
    credentials: "SDC0100-4512 and SDC0100-4513 answered the 06:00 check",
    other: "Ikawa Corner Ltd",
    issuedToday: 39,
    refundsThisMonth: 9,
    xReport: "Sales RWF 1,987,400 · VAT included RWF 303,163 · refunds RWF 0 · 39 receipts",
    device: "SDC0100-4512",
    branch: "Isangano Lakeside Hotel",
    numberingNote: "Series EBM-0041 has issued 88,331 numbers across both devices.",
    invoiceNote:
      "Proformas are produced at booking and the fiscal sale at folio close. A city-ledger invoice reuses the fiscal invoice issued at checkout; it never creates a second one.",
  },
  {
    id: "ikawa",
    name: "Ikawa Corner Ltd",
    tin: "TIN 108 221 457",
    scope: "Ikawa Corner coffee outlet, a tenant at Isangano",
    series: "EBM-0057 · last issued 20,827",
    access: "Delegated by Ikawa Corner Ltd · fiscal support only",
    lastZ: "Z-0119 · 11 Oct 21:05",
    credentials: "SDC0100-7781 answered the 06:00 check",
    other: AHL,
    issuedToday: 57,
    refundsThisMonth: 2,
    xReport: "Sales RWF 162,840 · VAT included RWF 24,840 · refunds RWF 4,720 · 57 receipts",
    device: "SDC0100-7781",
    branch: "Ikawa Corner · Rubavu",
    numberingNote: "Series EBM-0057 has issued 20,827 numbers.",
    invoiceNote: "Ikawa Corner sells over the counter, so it issues fiscal receipts at payment and no proformas.",
  },
];

const fiscalQueue: FiscalQueueItem[] = [
  {
    id: "q1",
    merchant: "ahl",
    status: "pending",
    type: "Sale receipt",
    source: "F-5518 · Marie Claire Uwimana",
    board: "Folios",
    trigger: "folio closed 07:30",
    amount: 410000,
    requestId: "VSDC-REQ-1012-0418",
    attempts: 4,
    age: "2 h 35 min",
    log: [
      { status: "warning", title: "07:30 · Submitted at folio close", detail: "VSDC timed out after 30 s" },
      { status: "warning", title: "07:31 to 08:30 · Retries 1 and 2", detail: "Same request ID · timed out" },
      { status: "current", title: "09:30 · Retry 3", detail: "Same request ID · accepted, no signature yet" },
    ],
  },
  {
    id: "q2",
    merchant: "ahl",
    status: "pending",
    type: "Sale receipt",
    source: "F-5522 · Akagera Horizon Travel group lunch",
    board: "Folios",
    trigger: "folio closed 07:45",
    amount: 186000,
    requestId: "VSDC-REQ-1012-0422",
    attempts: 3,
    age: "2 h 20 min",
    log: [
      { status: "warning", title: "07:45 · Submitted at folio close", detail: "VSDC timed out after 30 s" },
      { status: "current", title: "07:46 to 09:15 · Retries 1 and 2", detail: "Same request ID · no answer yet" },
    ],
  },
  {
    id: "q3",
    merchant: "ahl",
    status: "pending",
    type: "Refund receipt",
    source: "BK-20402 · Ishyamba deposit refund RF-3101",
    board: "Payments",
    trigger: "prepared 08:00",
    amount: 60000,
    requestId: "VSDC-REQ-1012-0431",
    attempts: 2,
    age: "2 h 05 min",
    credits: "EBM-0041-88217",
    log: [
      {
        status: "success",
        title: "08:00 · Credit note prepared",
        detail: "From refund RF-3101 · credits EBM-0041-88217",
      },
      {
        status: "current",
        title: "08:01 to 08:40 · Submitted, retried once",
        detail: "Same request ID · VSDC timed out",
      },
    ],
  },
  {
    id: "q4",
    merchant: "ahl",
    status: "unknown",
    type: "Sale receipt",
    source: "Lake Bar check LB-2290 · walk-in",
    board: "OutletOrders",
    trigger: "paid 09:52",
    amount: 35400,
    requestId: "VSDC-REQ-1012-0446",
    attempts: 1,
    age: "since 09:52",
    log: [
      { status: "warning", title: "09:52 · Attempt 1", detail: "Connection dropped after sending" },
      { status: "current", title: "09:58 · Status query 1", detail: "Provider has no answer yet" },
    ],
  },
  {
    id: "q5",
    merchant: "ahl",
    status: "rejected",
    type: "Sale receipt",
    source: "Isangano Terrace order TER-4475",
    board: "OutletOrders",
    trigger: "paid 08:46",
    amount: 64900,
    requestId: "VSDC-REQ-1012-0425",
    attempts: 1,
    age: "at 08:47",
    itemId: "i4",
    reason: "Rejected: “Tilapia platter” has no RRA item class",
    fix: "Map the item in Item codes, then resubmit. A rejected document has no fiscal number, so a new request duplicates nothing.",
    log: [{ status: "danger", title: "08:47 · Attempt 1", detail: "Rejected: missing item classification" }],
  },
  {
    id: "q6",
    merchant: "ikawa",
    status: "rejected",
    type: "Sale receipt",
    source: "Ikawa Corner order IK-1182",
    board: "OutletOrders",
    trigger: "paid 09:10",
    amount: 9440,
    requestId: "VSDC-REQ-IK-1012-0117",
    attempts: 1,
    age: "at 09:12",
    reason: "Rejected: buyer TIN failed the check digit",
    fix: "Confirm the TIN with the customer, or resubmit without a buyer TIN if they do not need a VAT invoice.",
    log: [{ status: "danger", title: "09:12 · Attempt 1", detail: "Rejected: invalid buyer TIN" }],
  },
];

const documentKinds: FiscalDocumentKind[] = [
  {
    id: "proforma",
    icon: "FileText",
    title: "Proforma invoice",
    chip: "Not a fiscal document",
    tone: "default",
    description: "Estimate or deposit request sent at booking. Never goes to the VSDC and has no fiscal number.",
  },
  {
    id: "fiscal",
    icon: "FileCheck",
    title: "Fiscal sale invoice",
    chip: "Signed by the VSDC",
    tone: "accent",
    description: "Created at folio close or outlet payment. Counts for tax only once Issued.",
  },
  {
    id: "commercial",
    icon: "Briefcase",
    title: "Commercial invoice",
    chip: "Billing document",
    tone: "default",
    description: "Bills a company on the city ledger. Points to the fiscal invoice; never replaces it.",
  },
  {
    id: "payment",
    icon: "CreditCard",
    title: "Payment receipt",
    chip: "Proof of money",
    tone: "default",
    description: "Confirms a verified payment. Kept in Payments, separate from tax documents.",
  },
];

const fiscalInvoices: FiscalInvoice[] = [
  {
    id: "PF-26-0931",
    merchant: "ahl",
    kind: "proforma",
    source: "BK-20431 · Sarah Kimani",
    created: "At booking · 2 Oct",
    amount: 280000,
    status: "notFiscal",
    reference: "Estimate only",
  },
  {
    id: "PF-26-0944",
    merchant: "ahl",
    kind: "proforma",
    source: "F-5540 · EAC Health Forum",
    created: "Deposit request · due 15 Oct",
    amount: 1000000,
    status: "notFiscal",
    reference: "Deposit, not a sale",
  },
  {
    id: "F-5531",
    merchant: "ahl",
    kind: "fiscal",
    source: "ST-8815 · Daniel Okafor",
    created: "Folio open · in house",
    amount: 295000,
    status: "draft",
    reference: "",
  },
  {
    id: "F-5518",
    merchant: "ahl",
    kind: "fiscal",
    source: "ST-8810 · Marie Claire Uwimana",
    created: "Folio closed 12 Oct 07:30",
    amount: 410000,
    status: "pending",
    reference: "VSDC-REQ-1012-0418",
  },
  {
    id: "F-5490",
    merchant: "ahl",
    kind: "fiscal",
    source: "ST-8796 · Sarah Kimani",
    created: "Folio closed 11 Oct 11:02",
    amount: 315000,
    status: "issued",
    reference: "EBM-0041-88290",
  },
  {
    id: "INV-26-0436",
    merchant: "ahl",
    kind: "commercial",
    source: "Akagera Horizon Travel · city ledger",
    created: "At checkout · 7 Oct",
    amount: 380000,
    status: "billing",
    reference: "Fiscal: EBM-0041-88011",
  },
  {
    id: "IK-1185",
    merchant: "ikawa",
    kind: "fiscal",
    source: "Counter sale",
    created: "Paid 12 Oct 09:30",
    amount: 7080,
    status: "issued",
    reference: "EBM-0057-20827",
  },
  {
    id: "IK-1182",
    merchant: "ikawa",
    kind: "fiscal",
    source: "Counter sale · buyer TIN given",
    created: "Paid 12 Oct 09:10",
    amount: 9440,
    status: "rejected",
    reference: "VSDC-REQ-IK-1012-0117",
  },
];

const fiscalReceipts: FiscalReceipt[] = [
  {
    id: "EBM-0041-88331",
    merchant: "ahl",
    kind: "sale",
    customer: "Lake Bar check LB-2288 · walk-in",
    signedAt: "12 Oct 09:47",
    lines: [
      { description: "Primus beer 72 cl × 2", amount: 9600 },
      { description: "Goat brochettes", amount: 14000 },
    ],
    total: 23600,
    vat: 3600,
    net: 20000,
    counter: "Sale 80,214 · series 88,331",
    signature: "7F3A-C21D-9B0E-44A1",
    reference: null,
    payment: "Paid by MTN MoMo · PI-77145 · MTN 8841209915 verified 09:46. Its payment receipt is a separate document.",
    board: "OutletOrders",
  },
  {
    id: "EBM-0041-88275",
    merchant: "ahl",
    kind: "refund",
    customer: "F-5486 · Fatuma Hassan",
    signedAt: "11 Oct 09:20",
    lines: [{ description: "Laundry charged twice, reversed", amount: -11800 }],
    total: -11800,
    vat: -1800,
    net: -10000,
    counter: "Refund 1,207 · series 88,275",
    signature: "C90B-11E4-7A2F-0D63",
    reference: "Credits original EBM-0041-88241 · reason DUPLICATE-CHARGE",
    payment: "Refunded to MTN MoMo · PI-77118 · provider confirmed 11 Oct 09:31.",
    board: "Folios",
  },
  {
    id: "EBM-0041-88290",
    merchant: "ahl",
    kind: "sale",
    customer: "F-5490 · Sarah Kimani",
    signedAt: "11 Oct 11:02",
    lines: [
      { description: "Room 204 · 2 nights Deluxe Lake View", amount: 280000 },
      { description: "Isangano Terrace · dinner", amount: 35000 },
    ],
    total: 315000,
    vat: 48051,
    net: 266949,
    counter: "Sale 80,190 · series 88,290",
    signature: "2B7E-90AC-5F14-E8D2",
    reference:
      "A RWF 40,000 service-recovery refund (RF-3104) is blocked in Payments. If it goes ahead, a refund receipt will credit this one.",
    payment: "Paid by card Visa ••5512 · PI-77071 · GT Bank auth 603988, verified.",
    board: "Folios",
  },
  {
    id: "EBM-0041-88011",
    merchant: "ahl",
    kind: "sale",
    customer: "F-5521 · Akagera Horizon Travel",
    signedAt: "7 Oct 12:30",
    lines: [{ description: "Agent group · 2 rooms · 5 to 7 Oct", amount: 380000 }],
    total: 380000,
    vat: 57966,
    net: 322034,
    counter: "Sale 79,950 · series 88,011",
    signature: "5D21-AF09-3C7B-91E0",
    reference: null,
    payment:
      "Not paid at checkout · billed on the city ledger as INV-26-0436, a commercial invoice and not a second fiscal document.",
    board: "AccountsReceivable",
  },
  {
    id: "EBM-0057-20827",
    merchant: "ikawa",
    kind: "sale",
    customer: "IK-1185 · counter sale",
    signedAt: "12 Oct 09:30",
    lines: [
      { description: "Cappuccino × 2", amount: 4720 },
      { description: "Croissant", amount: 2360 },
    ],
    total: 7080,
    vat: 1080,
    net: 6000,
    counter: "Sale 20,419 · series 20,827",
    signature: "E4C8-0B37-6D92-1FA5",
    reference: null,
    payment: "Paid by MTN MoMo · PI-77147 verified 09:29.",
    board: "OutletOrders",
  },
  {
    id: "EBM-0057-20822",
    merchant: "ikawa",
    kind: "refund",
    customer: "IK-1171 · counter sale",
    signedAt: "12 Oct 08:12",
    lines: [{ description: "Iced latte returned", amount: -4720 }],
    total: -4720,
    vat: -720,
    net: -4000,
    counter: "Refund 96 · series 20,822",
    signature: "0A6F-D251-B84E-7C39",
    reference: "Credits original EBM-0057-20401 · reason WRONG-ORDER",
    payment: "Cash refund from drawer Ikawa 1.",
    board: "OutletOrders",
  },
];

const vsdcDevices: VsdcDevice[] = [
  {
    id: "SDC0100-4512",
    merchant: "ahl",
    usedBy: "Isangano Lakeside Hotel · front office, Terrace, Lake Bar",
    sale: 80214,
    refund: 1207,
    copy: 2940,
    total: 84361,
    lastSigned: "09:47",
  },
  {
    id: "SDC0100-4513",
    merchant: "ahl",
    usedBy: "Ishyamba Forest Lodge",
    sale: 3702,
    refund: 211,
    copy: 57,
    total: 3970,
    lastSigned: "09:05",
  },
  {
    id: "SDC0100-7781",
    merchant: "ikawa",
    usedBy: "Ikawa Corner",
    sale: 20419,
    refund: 96,
    copy: 312,
    total: 20827,
    lastSigned: "09:30",
  },
];

const fiscalJournal: FiscalJournalEvent[] = (
  [
    ["ahl", "09:58", "Status query", "VSDC-REQ-1012-0446 · no answer yet", 884117],
    ["ahl", "09:52", "Connection dropped", "VSDC-REQ-1012-0446 · outcome unknown", 884114],
    ["ahl", "09:47", "Receipt signed", "EBM-0041-88331 · sale · RWF 23,600", 884112],
    ["ahl", "09:30", "Request retried", "VSDC-REQ-1012-0418 · retry 3, same ID", 884104],
    ["ahl", "08:47", "Request rejected", "VSDC-REQ-1012-0425 · item class missing", 884071],
    ["ahl", "00:00", "Z report closed", "Z-0287 · fiscal day 11 Oct", 884040],
    ["ikawa", "09:30", "Receipt signed", "EBM-0057-20827 · sale · RWF 7,080", 201388],
    ["ikawa", "09:12", "Request rejected", "VSDC-REQ-IK-1012-0117 · invalid buyer TIN", 201385],
    ["ikawa", "08:12", "Refund receipt signed", "EBM-0057-20822 · credits EBM-0057-20401", 201360],
    ["ikawa", "00:00", "Z report closed", "Z-0119 · fiscal day 11 Oct", 201322],
  ] as const
).map(([merchant, time, event, detail, sequence]) => ({
  id: `${merchant}-${sequence}`,
  merchant,
  time,
  event,
  detail,
  sequence,
}));

const zReports: ZReport[] = [
  { id: "Z-0287", merchant: "ahl", day: "11 Oct", receipts: 214, sales: 7411580, vat: 1130580, refunds: 11800 },
  { id: "Z-0286", merchant: "ahl", day: "10 Oct", receipts: 198, sales: 7009200, vat: 1069200, refunds: 0 },
  { id: "Z-0285", merchant: "ahl", day: "9 Oct", receipts: 171, sales: 5746600, vat: 876600, refunds: 0 },
  { id: "Z-0119", merchant: "ikawa", day: "11 Oct", receipts: 163, sales: 401200, vat: 61200, refunds: 0 },
  { id: "Z-0118", merchant: "ikawa", day: "10 Oct", receipts: 149, sales: 368160, vat: 56160, refunds: 0 },
];

const itemCodes: ItemCode[] = [
  {
    id: "i1",
    merchant: "ahl",
    name: "Deluxe Lake View · room night",
    soldAt: "Rooms",
    code: "90111501 · Hotel accommodation",
    status: "mapped",
  },
  {
    id: "i2",
    merchant: "ahl",
    name: "Standard Queen · room night",
    soldAt: "Rooms",
    code: "90111501 · Hotel accommodation",
    status: "mapped",
  },
  {
    id: "i3",
    merchant: "ahl",
    name: "Breakfast buffet",
    soldAt: "Isangano Terrace",
    code: "90101501 · Restaurant meals",
    status: "mapped",
  },
  {
    id: "i4",
    merchant: "ahl",
    name: "Tilapia platter",
    soldAt: "Isangano Terrace",
    code: null,
    status: "unmapped",
    suggestion: "90101501 · Restaurant meals",
    hint: "Blocking order TER-4475",
  },
  {
    id: "i5",
    merchant: "ahl",
    name: "Primus beer 72 cl",
    soldAt: "Lake Bar",
    code: "50202203 · Beer",
    status: "mapped",
  },
  {
    id: "i6",
    merchant: "ahl",
    name: "Airport transfer",
    soldAt: "Front office",
    code: null,
    status: "unmapped",
    suggestion: "78111800 · Passenger road transport",
    hint: "Will be rejected when sold",
  },
  {
    id: "i7",
    merchant: "ahl",
    name: "Kivu Hall day hire",
    soldAt: "Events",
    code: "90111600 · Conference facilities",
    status: "review",
    hint: "Suggested · needs a reviewer",
  },
  {
    id: "i8",
    merchant: "ikawa",
    name: "Cappuccino",
    soldAt: "Ikawa Corner",
    code: "50201706 · Coffee drinks",
    status: "mapped",
  },
  {
    id: "i9",
    merchant: "ikawa",
    name: "Croissant",
    soldAt: "Ikawa Corner",
    code: "50181900 · Bakery",
    status: "mapped",
  },
  {
    id: "i10",
    merchant: "ikawa",
    name: "Roasted beans 250 g",
    soldAt: "Ikawa Corner",
    code: null,
    status: "unmapped",
    suggestion: "50201708 · Coffee beans",
    hint: "Will be rejected when sold",
  },
];

const kpis: AccountingKpi[] = [
  {
    id: "ar-open",
    board: "AccountsReceivable",
    label: "Open receivables",
    value: 4850000,
    format: "rwf",
    foot: "4 accounts · 7 open invoices",
    icon: "Briefcase",
    status: "default",
  },
  {
    id: "ar-past-due",
    board: "AccountsReceivable",
    label: "Past due",
    value: 2808200,
    format: "rwf",
    foot: "58% of the open balance",
    icon: "Clock",
    status: "warning",
  },
  {
    id: "ar-over-60",
    board: "AccountsReceivable",
    label: "Over 60 days",
    value: 1239000,
    format: "rwf",
    foot: "Umurage Consulting Ltd · INV-26-0388",
    icon: "TriangleExclamation",
    status: "danger",
  },
  {
    id: "ar-unmatched",
    board: "AccountsReceivable",
    label: "Unmatched transfers",
    value: 2200000,
    format: "rwf",
    foot: "2 statement lines not yet linked",
    icon: "ArrowRightArrowLeft",
    status: "warning",
  },
  {
    id: "ar-dispute",
    board: "AccountsReceivable",
    label: "In dispute",
    value: 118000,
    format: "rwf",
    foot: "1 dispute · excluded from reminders",
    icon: "ScalesUnbalanced",
    status: "default",
  },
  {
    id: "gl-trial-balance",
    board: "GeneralLedger",
    label: "Trial balance · October to date",
    value: 71944400,
    format: "rwf",
    foot: "Debits equal credits · difference RWF 0",
    icon: "ScalesBalanced",
    status: "success",
  },
  {
    id: "gl-awaiting",
    board: "GeneralLedger",
    label: "Awaiting approval",
    value: 719800,
    format: "rwf",
    foot: "1 supplier invoice entry",
    icon: "Clock",
    status: "warning",
  },
  {
    id: "gl-close",
    board: "GeneralLedger",
    label: "October close",
    value: 4,
    format: "count",
    suffix: " of 10 checks",
    foot: "Blocked by payments, fiscal and folio exceptions",
    icon: "ListCheck",
    status: "warning",
  },
  {
    id: "gl-last-export",
    board: "GeneralLedger",
    label: "Last export",
    value: 0,
    format: "count",
    text: "EXP-26-10-W2",
    foot: "Reconciled · 12 Oct 06:15",
    icon: "ArrowDownToLine",
    status: "default",
  },
];

const arAccounts: ArAccount[] = [
  {
    id: "umu",
    initials: "UC",
    name: "Umurage Consulting Ltd",
    kind: "company",
    type: "Company · city ledger CL-014",
    tin: "TIN 107 554 213",
    terms: "Net 30",
    termsDetail: "Corporate rate BAR −12%",
    limit: 2500000,
    balance: 2100400,
    oldest: "62 days past due",
    severity: "danger",
    contact: "Esther Mutesi · finance lead",
    bookers: "2 authorised bookers",
    contract: [
      {
        version: "v2 · from 1 Jul 2026",
        terms: "Net 30 · limit RWF 2,500,000 · BAR −12% on all room types",
        state: "Current",
      },
      { version: "v1 · 1 Jan to 30 Jun 2026", terms: "Net 45 · limit RWF 1,500,000 · BAR −10%", state: "Superseded" },
    ],
    foot: "Terms apply by stay date. Changing terms creates a new version; past invoices keep the terms they were issued under.",
    invoices: [
      {
        id: "INV-26-0388",
        source: "F-5431 · Jean Bosco Nkurunziza · 4 nights",
        fiscal: "Fiscal EBM-0041-86120",
        due: "due 11 Aug",
        amount: 1239000,
        state: "62 days past due",
        tone: "danger",
      },
      {
        id: "INV-26-0401",
        source: "F-5466 · Jean Bosco Nkurunziza · 2 nights",
        fiscal: "Fiscal EBM-0041-86904",
        due: "due 8 Sep",
        amount: 519200,
        state: "34 days · RWF 118,000 disputed",
        tone: "warning",
      },
      {
        id: "INV-26-0412",
        source: "F-5501 · Jean Bosco Nkurunziza · 3 nights",
        fiscal: "Fiscal EBM-0041-87988",
        due: "due 9 Nov",
        amount: 342200,
        state: "Not due",
        tone: "default",
      },
    ],
    collections: [
      { status: "default", title: "18 Aug · Reminder 1", detail: "Email to Esther Mutesi with statement" },
      { status: "default", title: "1 Sep · Reminder 2", detail: "Email and SMS" },
      {
        status: "default",
        title: "15 Sep · Call by Grace Uwera",
        detail: "Payment delayed by Umurage internal approvals",
      },
      { status: "warning", title: "22 Sep · Promise to pay", detail: "RWF 1,239,000 by 10 Oct · met in part" },
      {
        status: "current",
        title: "Sun 11 Oct · Transfer received",
        detail: "RWF 1,200,000 via GT Bank on statement line 187 · not yet allocated, see below",
      },
    ],
    collectionsNote: "Reminders, calls and promises, oldest first",
    quiet: "Nothing is past due. Reminders start three days after a due date.",
    dispute: {
      invoice: "INV-26-0401",
      amount: 118000,
      what: "Minibar charges for room 207 fall outside company policy",
      opened: "Opened 2 Oct by Esther Mutesi",
      evidence: "folio F-5466 lines 12 to 14, signed minibar slips",
      fiscal: "EBM-0041-86904",
    },
  },
  {
    id: "aht",
    initials: "AH",
    name: "Akagera Horizon Travel",
    kind: "agent",
    type: "Travel agent · city ledger CL-009",
    tin: "TIN 106 870 334",
    terms: "Net 15",
    termsDetail: "10% commission contract",
    limit: 1500000,
    balance: 970000,
    oldest: "Not due",
    severity: "default",
    contact: "Patience Uwamahoro · accounts",
    bookers: "4 agents may book on account",
    contract: [
      {
        version: "v3 · from 1 Jul 2026",
        terms: "Net 15 · billed gross · 10% commission on invoiced room revenue",
        state: "Current",
      },
      { version: "v2 · 1 Jan to 30 Jun 2026", terms: "Net 15 · 8% commission", state: "Superseded" },
    ],
    foot: "Commission on these invoices (RWF 38,000 and RWF 42,000) is a payable in Commissions & payouts. It is never netted here.",
    invoices: [
      {
        id: "INV-26-0436",
        source: "F-5521 · agent group · 2 rooms",
        fiscal: "Fiscal EBM-0041-88011",
        due: "due Thu 22 Oct",
        amount: 380000,
        state: "Not due",
        tone: "default",
      },
      {
        id: "INV-26-0409",
        source: "F-5502 · BK-20422 · room 309, 3 nights, half board",
        fiscal: "Fiscal EBM-0041-88102",
        due: "due Fri 23 Oct",
        amount: 590000,
        state: "Not due",
        tone: "default",
      },
    ],
    collections: [],
    collectionsNote: "Within terms",
    quiet: "Nothing is past due. Reminders start three days after a due date.",
    dispute: null,
  },
  {
    id: "kbc",
    initials: "KB",
    name: "Kivu Belt Coffee Cooperative",
    kind: "company",
    type: "Company",
    tin: "TIN 103 902 641",
    terms: "Net 30",
    termsDetail: "Events and rooms",
    limit: 2000000,
    balance: 1050000,
    oldest: "9 days past due",
    severity: "warning",
    contact: "Treasurer · cooperative office",
    bookers: "1 authorised booker",
    contract: [
      { version: "v1 · from 1 Mar 2026", terms: "Net 30 · limit RWF 2,000,000 · events and rooms", state: "Current" },
    ],
    foot: "A matching transfer is waiting for a second approver below.",
    invoices: [
      {
        id: "INV-26-0398",
        source: "F-5478 · board retreat · rooms and Garden Terrace",
        fiscal: "Fiscal EBM-0041-86990",
        due: "due 3 Oct",
        amount: 1050000,
        state: "Payment pending approval",
        tone: "warning",
      },
    ],
    collections: [],
    collectionsNote: "Paused while a matched transfer is approved",
    quiet: "Reminders paused: a matching transfer of RWF 1,050,000 is waiting for a second approver.",
    dispute: null,
  },
  {
    id: "rle",
    initials: "RL",
    name: "Rwanda Lakes Expeditions",
    kind: "agent",
    type: "Travel agent",
    tin: "TIN 105 117 802",
    terms: "Net 30",
    termsDetail: "8% commission contract",
    limit: 1500000,
    balance: 729600,
    oldest: "Not due",
    severity: "default",
    contact: "Reservations manager",
    bookers: "2 agents may book on account",
    contract: [
      {
        version: "v1 · from 1 Feb 2026",
        terms: "Net 30 · billed gross · 8% commission on invoiced room revenue",
        state: "Current",
      },
    ],
    foot: "Commissions are handled in Commissions & payouts.",
    invoices: [
      {
        id: "INV-26-0440",
        source: "BK-20411 · agent group · 2 rooms · 8 to 11 Oct",
        fiscal: "Fiscal EBM-0041-88262",
        due: "due 10 Nov",
        amount: 729600,
        state: "Not due",
        tone: "default",
      },
      {
        id: "INV-26-0384",
        source: "BK-20377 · agent group · 18 to 21 Sep",
        fiscal: "Fiscal EBM-0041-85512",
        due: "paid 10 Oct",
        amount: 552000,
        state: "Paid · verified",
        tone: "success",
      },
    ],
    collections: [],
    collectionsNote: "Within terms",
    quiet: "Nothing is past due. Reminders start three days after a due date.",
    dispute: null,
  },
  {
    id: "eac",
    initials: "EH",
    name: "EAC Health Forum Secretariat",
    kind: "company",
    type: "Company · group master bill F-5540",
    tin: "TIN 109 330 118",
    terms: "Deposits",
    termsDetail: "Contract SE-0031",
    limit: null,
    balance: 0,
    oldest: "No receivable",
    severity: "default",
    contact: "Forum coordinator · events desk",
    bookers: "Block of 25 rooms, Fri 23 to Mon 26 Oct",
    noCreditLine: {
      usage: "Deposits held · no credit line",
      balance: "RWF 0 receivable · RWF 2,000,000 deposit held",
    },
    contract: [
      {
        version: "v1 · from 2 Oct 2026",
        terms:
          "Deposit RWF 2,000,000 paid 2 Oct · second deposit RWF 1,000,000 due 15 Oct · balance billed at departure",
        state: "Current",
      },
    ],
    foot: "Deposits are liabilities on the master bill until the event is billed. Guests settle their own extras.",
    invoices: [
      {
        id: "PF-26-0944",
        source: "Second deposit request · F-5540",
        fiscal: "Proforma, not a fiscal document",
        due: "due 15 Oct",
        amount: 1000000,
        state: "Deposit · not aged",
        tone: "default",
      },
    ],
    collections: [],
    collectionsNote: "No receivable yet",
    quiet:
      "Deposits are not receivables. The second deposit (statement line 201) is matched to F-5540 in Reconciliation.",
    dispute: null,
  },
];

const arAging: AgingBucket[] = [
  { id: "current", label: "Current", name: "Not yet due · 3 accounts", amount: 2041800, severity: "none" },
  { id: "1-30", label: "1–30", name: "1–30 days · 1 account", amount: 1050000, severity: "low" },
  { id: "31-60", label: "31–60", name: "31–60 days · 1 account", amount: 519200, severity: "medium" },
  { id: "61-90", label: "61–90", name: "61–90 days · 1 account", amount: 1239000, severity: "high" },
  { id: "90-plus", label: "90+", name: "Over 90 days", amount: 0, severity: "high" },
];

const bankTransfers: BankTransfer[] = [
  {
    id: "line-201",
    line: "Line 201",
    at: "12 Oct · TRF",
    reference: "TRF EAC FORUM DEP 2",
    sender: "EAC Health Forum Secretariat",
    amount: 1000000,
    status: "unmatched",
    note: "Second deposit for master bill F-5540. A deposit is a liability, not a receivable, so it is allocated in Reconciliation.",
    toReconciliation: true,
  },
  {
    id: "line-187",
    line: "Line 187",
    at: "Sun 11 Oct · FT26285QW7L2",
    reference: "UMURAGE CONS LTD OCT",
    sender: "Umurage Consulting Ltd · credit to GT Bank ••4471",
    amount: 1200000,
    status: "unmatched",
    note: "Suggested: INV-26-0388 oldest first, part payment. INV-26-0401 is not suggested while RWF 118,000 is disputed.",
    toReconciliation: false,
    proposedNote:
      "Proposed by you 10:19: INV-26-0388, part payment, oldest first · waiting for Aline Uwase or Didier Mugenzi.",
    allocation: {
      account: "Umurage Consulting Ltd",
      detail:
        "RWF 1,200,000 via GT Bank · reference “UMURAGE CONS LTD OCT” · FT26285QW7L2 · value date Sun 11 Oct · city ledger CL-014",
      rows: [
        {
          invoice: "INV-26-0388",
          status: "62 days past due · RWF 39,000 stays open",
          open: 1239000,
          proposed: 1200000,
        },
        {
          invoice: "INV-26-0401",
          status: "34 days · RWF 118,000 disputed · at most RWF 401,200",
          open: 519200,
          proposed: 0,
        },
        { invoice: "INV-26-0412", status: "Not due", open: 342200, proposed: 0 },
      ],
      alertTitle: "Oldest first · stays Pending until approved",
      alertText:
        "Aline Uwase or Didier Mugenzi approves before the balance moves. After approval Umurage owes RWF 900,400: RWF 39,000 on INV-26-0388, INV-26-0401 with its RWF 118,000 dispute, and INV-26-0412.",
    },
  },
  {
    id: "line-179",
    line: "Line 179",
    at: "Sun 11 Oct · FT26284KB3N8",
    reference: "KBC INV-26-0398",
    sender: "Kivu Belt Coffee Cooperative · credit to GT Bank ••4471",
    amount: 1050000,
    status: "pending",
    note: "Matched to INV-26-0398 by Grace Uwera 11 Oct 16:10 · waiting for a second approver.",
    toReconciliation: false,
  },
  {
    id: "line-96",
    line: "Line 96",
    at: "Fri 9 Oct · FT26282RL4C7",
    reference: "RLE INV 0384",
    sender: "Rwanda Lakes Expeditions · credit to GT Bank ••4471",
    amount: 552000,
    status: "verified",
    note: "Allocated to INV-26-0384 · approved by Aline Uwase 10 Oct 09:05.",
    toReconciliation: false,
  },
];

const AHT_CONTRACT = "Contract v3 · 10% · effective 1 Jul 2026";
const RLE_CONTRACT = "Contract v1 · 8% · effective 1 Feb 2026";
const BROKER_TERMS = "Broker terms v2 · 50% of first month’s rent";

const commissions: CommissionLine[] = [
  {
    id: "c1",
    payee: "Akagera Horizon Travel",
    kind: "agent",
    role: "Travel agent",
    source: "F-5521",
    guest: "Agent group · 2 rooms",
    stay: "5 to 7 Oct · invoiced on INV-26-0436",
    basis: 380000,
    rate: 10,
    contract: AHT_CONTRACT,
    payer: AHL,
    taxDocument: "Agent invoice AHT-CI-1187 · received 10 Oct",
    hasTaxDocument: true,
    sourceRecord: "Sale EBM-0041-88011 · billed gross on INV-26-0436",
    status: "await",
    settlement: "Not started",
    log: [
      { status: "success", title: "7 Oct · Accrued at checkout", detail: "Contracted rate on invoiced room revenue" },
      { status: "success", title: "10 Oct · Agent invoice received", detail: "AHT-CI-1187 matches RWF 38,000" },
    ],
  },
  {
    id: "c2",
    payee: "Akagera Horizon Travel",
    kind: "agent",
    role: "Travel agent",
    source: "BK-20422",
    guest: "F-5502 · room 309",
    stay: "3 nights · 5 to 8 Oct · invoiced on INV-26-0409",
    basis: 420000,
    rate: 10,
    contract: AHT_CONTRACT,
    payer: AHL,
    taxDocument: "Agent invoice not received",
    hasTaxDocument: false,
    sourceRecord: "Sale EBM-0041-88102 · billed gross on INV-26-0409",
    status: "await",
    settlement: "Not started",
    invoiceContact: "Patience Uwamahoro",
    log: [
      { status: "success", title: "8 Oct · Accrued at checkout", detail: "Contracted rate on invoiced room revenue" },
      { status: "warning", title: "9 Oct · Agent invoice requested", detail: "Sent to Patience Uwamahoro, accounts" },
    ],
  },
  {
    id: "c3",
    payee: "Akagera Horizon Travel",
    kind: "agent",
    role: "Travel agent",
    source: "BK-20418",
    guest: "Volcano view group",
    stay: "F-5536 · 6 Twin rooms · part cancelled",
    basis: 960000,
    rate: 10,
    contract: AHT_CONTRACT,
    payer: AHL,
    taxDocument: "Agent invoice AHT-CI-1179 · received 6 Oct",
    hasTaxDocument: true,
    sourceRecord: "Master bill F-5536 · group refund RF-3105 open",
    status: "hold",
    holdReason:
      "Released once Didier Mugenzi decides the RWF 480,000 group refund (RF-3105); the basis is recalculated if it changes.",
    holdHint: "Refund decision pending",
    settlement: "Not started",
    log: [
      { status: "success", title: "11 Oct · Accrued at checkout", detail: "Basis after the partial cancellation" },
      { status: "warning", title: "11 Oct · Put on hold", detail: "Group refund RF-3105 is waiting for the owner" },
    ],
  },
  {
    id: "c4",
    payee: "Rwanda Lakes Expeditions",
    kind: "agent",
    role: "Travel agent",
    source: "BK-20377",
    guest: "Agent group · 2 Twin rooms",
    stay: "18 to 21 Sep · invoiced and paid",
    basis: 552000,
    rate: 8,
    contract: RLE_CONTRACT,
    payer: AHL,
    taxDocument: "Agent invoice RLE-0442 · received 7 Oct",
    hasTaxDocument: true,
    sourceRecord: "Sale EBM-0041-85512 · INV-26-0384 paid 10 Oct",
    status: "approved",
    settlement: "Scheduled by Payments · PY-3107 · Wed 14 Oct",
    log: [
      { status: "success", title: "21 Sep · Accrued at checkout", detail: "Contracted rate on invoiced room revenue" },
      { status: "success", title: "10 Oct · Approved by Grace Uwera", detail: "Payable created in the ledger" },
      { status: "current", title: "11 Oct · Scheduled by Payments", detail: "PY-3107 · bank transfer on Wed 14 Oct" },
    ],
  },
  {
    id: "c5",
    payee: "Emmanuel Twagira",
    kind: "broker",
    role: "Residence broker",
    source: "L-KC-020",
    guest: "Unit B-11",
    stay: "First month’s rent RWF 650,000",
    basis: 650000,
    rate: 50,
    contract: BROKER_TERMS,
    payer: ARL,
    taxDocument: "Broker invoice ET-2026-019 · received 8 Oct",
    hasTaxDocument: true,
    sourceRecord: "Lease L-KC-020 · first rent verified 1 Oct",
    status: "hold",
    holdReason:
      "Held while dispute DSP-0042 is open: the landlord says the tenant found the unit directly. Evidence is due Thu 15 Oct.",
    holdHint: "Dispute DSP-0042",
    settlement: "Held · not started",
    log: [
      {
        status: "success",
        title: "1 Oct · Accrued on first verified rent",
        detail: "Placement fee per broker terms v2",
      },
      {
        status: "warning",
        title: "9 Oct · Held for dispute DSP-0042",
        detail: "Handled by Injishi support · evidence due Thu 15 Oct",
      },
    ],
  },
  {
    id: "c6",
    payee: "Emmanuel Twagira",
    kind: "broker",
    role: "Residence broker",
    source: "L-KC-019",
    guest: "Unit C-02",
    stay: "First month’s rent RWF 700,000",
    basis: 700000,
    rate: 50,
    contract: BROKER_TERMS,
    payer: ARL,
    taxDocument: "Broker invoice ET-2026-017 · received 20 Sep",
    hasTaxDocument: true,
    sourceRecord: "Lease L-KC-019 · first rent verified 15 Sep",
    status: "approved",
    settlement: "Sent by Payments · PY-3106 · awaiting MTN MoMo confirmation",
    log: [
      { status: "success", title: "6 Oct · Approved by Grace Uwera", detail: "Over RWF 150,000" },
      { status: "success", title: "7 Oct · Second approval by Didier Mugenzi", detail: "Payable created" },
      { status: "current", title: "11 Oct 16:40 · Sent by Payments", detail: "PY-3106 · no provider confirmation yet" },
    ],
  },
  {
    id: "c7",
    payee: "Rwanda Lakes Expeditions",
    kind: "agent",
    role: "Travel agent",
    source: "BK-20411",
    guest: "Agent group · 2 rooms",
    stay: "8 to 11 Oct · invoiced on INV-26-0440",
    basis: 690000,
    rate: 8,
    contract: RLE_CONTRACT,
    payer: AHL,
    taxDocument: "Agent invoice RLE-0451 · received 11 Oct",
    hasTaxDocument: true,
    sourceRecord: "Sale EBM-0041-88262 · billed gross on INV-26-0440",
    status: "await",
    settlement: "Not started",
    log: [
      { status: "success", title: "11 Oct · Accrued at checkout", detail: "Contracted rate on invoiced room revenue" },
      { status: "success", title: "11 Oct · Agent invoice received", detail: "RLE-0451 matches RWF 55,200" },
    ],
  },
];

const payouts: Payout[] = [
  {
    id: "PY-3108",
    type: "Host payout · incoming",
    payee: AHL,
    account: "GT Bank ••4471",
    payer: "Injishi marketplace collections",
    amount: 3920000,
    status: "confirmed",
    when: "12 Oct 08:14",
    note: "Marketplace bookings 5 to 11 Oct, 14 stays · paid in full, no commission deducted · GT Bank statement FT26285M2D1",
  },
  {
    id: "PY-3107",
    type: "Agent commission",
    payee: "Rwanda Lakes Expeditions",
    account: "Bank of Kigali ••6620",
    payer: AHL,
    amount: 44160,
    status: "scheduled",
    when: "for Wed 14 Oct",
    note: "Approved 10 Oct · BK-20377",
  },
  {
    id: "PY-3106",
    type: "Broker placement fee",
    payee: "Emmanuel Twagira",
    account: "MTN MoMo 078•••412",
    payer: ARL,
    amount: 350000,
    status: "sent",
    when: "11 Oct 16:40",
    note: "L-KC-019 · no provider reference yet · counts as unpaid until MTN confirms",
  },
  {
    id: "PY-3105",
    type: "Landlord rent payout · incoming",
    payee: ARL,
    account: "GT Bank ••5530",
    payer: "Injishi rent collections",
    amount: 6850000,
    status: "scheduled",
    when: "for Thu 15 Oct",
    note: "October rent paid through Injishi by 9 tenants, each verified · paid in full",
  },
  {
    id: "PY-3099",
    type: "Landlord rent payout · incoming",
    payee: ARL,
    account: "BPR ••3391 · closed",
    payer: "Injishi rent collections",
    amount: 980000,
    status: "failed",
    when: "11 Oct 10:02",
    note: "Bank returned it: the account is closed. Nothing was debited. Payments resends to GT Bank ••5530 once the new beneficiary is verified.",
  },
  {
    id: "PY-3098",
    type: "Agent commission",
    payee: "Akagera Horizon Travel",
    account: "I&M Bank ••8812",
    payer: AHL,
    amount: 214500,
    status: "confirmed",
    when: "3 Oct 10:21",
    note: "August statement · debit confirmed on GT Bank statement line FT26276A9K4",
  },
];

const journalEntries: JournalEntry[] = [
  {
    id: "JE-26-10-0442",
    at: "12 Oct 07:22",
    source: "payment",
    reference: "PI-77126 · F-5518",
    description: "MTN MoMo payment, Marie Claire Uwimana",
    status: "posted",
    lines: [
      { account: "1120 Mobile money clearing · MTN", department: "Balance sheet", debit: 312000, credit: 0 },
      { account: "1200 Guest ledger", department: "Balance sheet", debit: 0, credit: 312000 },
    ],
    evidence: "MTN 8841190021 · webhook signature verified 07:22 · attempt 2",
    postingKey: "payment-verified:PI-77126",
    actor: "System, on provider verification",
  },
  {
    id: "JE-26-10-0436",
    at: "11 Oct 11:02",
    source: "folio",
    reference: "F-5490 · EBM-0041-88290",
    description: "Folio close, Sarah Kimani, room 204, 2 nights and dinner",
    status: "posted",
    lines: [
      { account: "1200 Guest ledger", department: "Balance sheet", debit: 315000, credit: 0 },
      { account: "4010 Room revenue", department: "Rooms", debit: 0, credit: 237288 },
      { account: "4110 Food revenue", department: "Food and beverage", debit: 0, credit: 29661 },
      { account: "2310 VAT output payable", department: "Balance sheet · VAT rule v3", debit: 0, credit: 48051 },
    ],
    evidence:
      "Folio F-5490 closed by Eric Habimana · fiscal receipt EBM-0041-88290 issued · VAT included, rounded per receipt",
    postingKey: "folio-close:F-5490:v1",
    actor: "System, on folio close",
  },
  {
    id: "JE-26-10-0434",
    at: "11 Oct 08:15",
    source: "procurement",
    reference: "SINV-0932 · PO-26-0144",
    description: "Kivu Fresh Produce, vegetables and fish for Isangano Terrace",
    status: "pending",
    lines: [
      { account: "5110 Food cost", department: "Food and beverage", debit: 610000, credit: 0 },
      { account: "1410 VAT input recoverable", department: "Balance sheet", debit: 109800, credit: 0 },
      { account: "2100 Accounts payable · Kivu Fresh Produce", department: "Balance sheet", debit: 0, credit: 719800 },
    ],
    evidence: "Goods receipt GR-0388 by Patrick Nshimiyimana · supplier fiscal invoice EBM 0218-11402 checked",
    postingKey: "supplier-invoice:SINV-0932",
    actor: "Prepared by Grace Uwera · approval pending",
  },
  {
    id: "JE-26-10-0421",
    at: "10 Oct 09:05",
    source: "bank",
    reference: "Statement line 96",
    description: "Rwanda Lakes Expeditions pays INV-26-0384",
    status: "posted",
    lines: [
      { account: "1100 GT Bank operating ••4471", department: "Balance sheet", debit: 552000, credit: 0 },
      {
        account: "1210 City ledger · Rwanda Lakes Expeditions",
        department: "Balance sheet",
        debit: 0,
        credit: 552000,
      },
    ],
    evidence: "GT Bank statement of Fri 9 Oct, line 96, FT26282RL4C7 · allocation approved by Aline Uwase",
    postingKey: "bank-alloc:GTB-20261009-96",
    actor: "Grace Uwera proposed · Aline Uwase approved",
  },
  {
    id: "JE-26-10-0412",
    at: "7 Oct 12:30",
    source: "cityLedger",
    reference: "F-5521 → INV-26-0436",
    description: "Checkout to city ledger, Akagera Horizon Travel",
    status: "posted",
    lines: [
      { account: "1210 City ledger · Akagera Horizon Travel", department: "Balance sheet", debit: 380000, credit: 0 },
      { account: "1200 Guest ledger", department: "Balance sheet", debit: 0, credit: 380000 },
    ],
    evidence: "Fiscal receipt EBM-0041-88011 issued at checkout · the transfer creates no second fiscal document",
    postingKey: "city-ledger:F-5521:INV-26-0436",
    actor: "System, on checkout",
  },
  {
    id: "JE-26-10-0405",
    at: "6 Oct 09:00",
    source: "reversal",
    reference: "Reverses JE-26-10-0402",
    description: "Duplicate supplier invoice SINV-0921, Lake Bar beverages",
    status: "reversal",
    lines: [
      { account: "2100 Accounts payable · Inyange Beverages", department: "Balance sheet", debit: 236000, credit: 0 },
      { account: "5120 Beverage cost", department: "Food and beverage", debit: 0, credit: 200000 },
      { account: "1410 VAT input recoverable", department: "Balance sheet", debit: 0, credit: 36000 },
    ],
    evidence: "Reason code DUPLICATE · original stays in the ledger, marked reversed",
    postingKey: "reversal:JE-26-10-0402",
    actor: "Grace Uwera · approved by Didier Mugenzi",
  },
];

const ledgerAccounts: LedgerAccount[] = (
  [
    ["1100", "GT Bank operating ••4471", "Asset", "Balance sheet", "approved"],
    ["1120", "Mobile money clearing · MTN and Airtel", "Asset", "Balance sheet", "approved"],
    ["1200", "Guest ledger", "Asset", "Balance sheet", "approved"],
    ["1210", "City ledger", "Asset", "Balance sheet", "approved"],
    ["1410", "VAT input recoverable", "Asset", "Balance sheet", "approved"],
    ["2100", "Accounts payable", "Liability", "Balance sheet", "approved"],
    ["2310", "VAT output payable", "Liability", "Balance sheet", "approved"],
    ["2400", "Guest and group deposits", "Liability", "Balance sheet", "approved"],
    ["2450", "Commissions payable", "Liability", "Balance sheet", "approved"],
    ["4010", "Room revenue", "Revenue", "Rooms", "approved"],
    ["4110", "Food revenue", "Revenue", "Food and beverage", "approved"],
    ["4120", "Beverage revenue", "Revenue", "Food and beverage", "approved"],
    ["4150", "Kivu Hall and Garden Terrace hire", "Revenue", "Food and beverage · venue rental", "proposed"],
    ["4510", "Laundry, transfers and activities", "Revenue", "Other operated departments", "approved"],
    ["4910", "Rent from Ikawa Corner Ltd", "Revenue", "Miscellaneous income", "approved"],
    ["5110", "Food cost", "Expense", "Food and beverage", "approved"],
    ["5120", "Beverage cost", "Expense", "Food and beverage", "approved"],
    ["6210", "Travel agent commissions", "Expense", "Rooms", "approved"],
    ["7210", "Electricity", "Expense", "", "unmapped"],
  ] as const
).map(([code, name, type, department, mapping]) => ({
  id: code,
  code,
  name,
  type,
  department,
  mapping,
  ...(mapping === "unmapped" ? { proposal: "Utilities" } : {}),
}));

const closePeriods: ClosePeriod[] = [
  {
    id: "2026-10",
    name: "October 2026",
    detail: "Day 12 of 31 · close target 5 November",
    state: "Open",
    stateTone: "accent",
    status: "open",
    checks: [
      {
        status: "warn",
        title: "Folios closed or moved to the city ledger",
        detail: "2 open past checkout: F-5509 and F-5497",
      },
      { status: "warn", title: "No Unknown or unverified payments", detail: "2 Unknown: PI-77142 and PI-77139" },
      { status: "warn", title: "Fiscal documents all Issued", detail: "3 Pending, 1 Unknown, 1 Rejected at the VSDC" },
      { status: "ok", title: "Night audits complete", detail: "1 to 11 October" },
      { status: "ok", title: "Bank statements imported", detail: "GTB-STMT-20261011 · checksum matched" },
      { status: "warn", title: "Supplier invoices approved", detail: "JE-26-10-0434 waiting for an approver" },
      { status: "ok", title: "Commissions accrued", detail: "From contracted rates at checkout" },
      { status: "ok", title: "Trial balance balanced", detail: "Debits equal credits by entity and currency" },
      { status: "wait", title: "Export reconciled to ledger", detail: "Runs after the checks above pass" },
      { status: "wait", title: "Period locked", detail: "Owner approves the lock" },
    ],
  },
  {
    id: "2026-09",
    name: "September 2026",
    detail: "Prepared by Grace Uwera · approved by Didier Mugenzi",
    state: "Closed 5 Oct",
    stateTone: "default",
    status: "closed",
    checks: [
      { status: "ok", title: "Folios closed or moved to the city ledger", detail: "512 folios · 0 open" },
      { status: "ok", title: "No Unknown or unverified payments", detail: "Last Unknown resolved 2 Oct" },
      { status: "ok", title: "Fiscal documents all Issued", detail: "5,700 issued · 0 pending" },
      { status: "ok", title: "Night audits complete", detail: "1 to 30 September" },
      { status: "ok", title: "Bank statements reconciled", detail: "30 statements · 0 unmatched lines" },
      { status: "ok", title: "Supplier invoices approved", detail: "412 invoices · matched to POs" },
      { status: "ok", title: "Commissions accrued", detail: "RWF 520,000 to agents" },
      { status: "ok", title: "Trial balance balanced", detail: "Debits equal credits" },
      { status: "ok", title: "Export reconciled to ledger", detail: "EXP-26-09 · difference RWF 0" },
      { status: "ok", title: "Period locked", detail: "5 Oct 17:40 · Didier Mugenzi" },
    ],
  },
];

const exportBatches: ExportBatch[] = [
  {
    id: "EXP-26-10-W3",
    when: "Draft · not exported",
    range: "12 Oct to date",
    format: "Journal CSV",
    entries: 18,
    ledgerDebits: 2416600,
    exportDebits: 1696800,
    status: "blocked",
    note: "Differs by RWF 719,800: JE-26-10-0434 is pending approval and excluded",
  },
  {
    id: "EXP-26-10-W2",
    when: "Exported 12 Oct 06:15",
    range: "6 to 11 Oct",
    format: "Journal CSV",
    entries: 214,
    ledgerDebits: 38420600,
    exportDebits: 38420600,
    status: "reconciled",
    note: "Matches ledger, folios and payment ledger",
  },
  {
    id: "EXP-26-10-W1",
    when: "Exported 6 Oct 06:12",
    range: "1 to 5 Oct",
    format: "Journal CSV",
    entries: 188,
    ledgerDebits: 31107200,
    exportDebits: 31107200,
    status: "reconciled",
    note: "Re-run 8 Oct · same batch ID · 0 new rows, 0 duplicates",
  },
  {
    id: "EXP-26-09",
    when: "Exported 5 Oct 17:52",
    range: "September 2026",
    format: "Journal CSV",
    entries: 1642,
    ledgerDebits: 412880400,
    exportDebits: 412880400,
    status: "reconciled",
    note: "Closed period · locked with the period",
  },
];

const VAT = "VAT standard 18% · v3";
const NONE = "As mapped · none this period";

const vatSummaries: VatSummary[] = [
  {
    id: "ahl-sep",
    merchant: "ahl",
    period: "sep",
    periodLabel: "September 2026",
    periodState: "Period closed 5 Oct",
    periodTone: "default",
    rows: [
      { category: "Rooms", rule: VAT, lines: 2104, net: 139600000 },
      { category: "Food and beverage", rule: VAT, lines: 6918, net: 41200000 },
      { category: "Other operated services", rule: VAT, lines: 1211, net: 6400000 },
      { category: "Rent to Ikawa Corner Ltd", rule: VAT, lines: 1, net: 1200000 },
      { category: "Exempt or zero-rated", rule: NONE, lines: 0, net: 0 },
      { category: "Refund receipts (credit notes)", rule: VAT, lines: 23, net: -1180000 },
    ],
    input: { invoices: 412, amount: 9414000 },
    inputNote: "6 supplier invoices without a fiscal number are left out (RWF 1,840,000)",
    documents: "EBM-0041-80341 to EBM-0041-86040 · 5,700 Issued",
    dailyReports: "Z-0247 to Z-0276 · one per fiscal day",
    computed: "6 Oct 06:00, after the period closed",
    excluded: "Nothing · every September document is Issued",
    fiscalStatus: "5,700 Issued · none open",
  },
  {
    id: "ahl-oct",
    merchant: "ahl",
    period: "oct",
    periodLabel: "October to date",
    periodState: "Period open · figures still move",
    periodTone: "accent",
    rows: [
      { category: "Rooms", rule: VAT, lines: 812, net: 35800000 },
      { category: "Food and beverage", rule: VAT, lines: 2630, net: 10600000 },
      { category: "Other operated services", rule: VAT, lines: 421, net: 2200000 },
      { category: "Rent to Ikawa Corner Ltd", rule: VAT, lines: 1, net: 1200000 },
      { category: "Exempt or zero-rated", rule: NONE, lines: 0, net: 0 },
      { category: "Refund receipts (credit notes)", rule: VAT, lines: 9, net: -300000 },
    ],
    input: { invoices: 138, amount: 3348000 },
    inputNote: "2 supplier invoices still waiting for a fiscal number are left out (RWF 412,000)",
    documents: "EBM-0041-86041 to EBM-0041-88331 · 2,291 Issued",
    dailyReports: "Z-0277 to Z-0287, plus today’s X report",
    computed: "Today 10:00 · recomputed hourly while open",
    excluded:
      "5 documents until they are Issued: 3 Pending, 1 Unknown, 1 Rejected (sales RWF 696,300, refund RWF 60,000)",
    fiscalStatus: "2,291 Issued · 5 not issued",
  },
  {
    id: "ikawa-sep",
    merchant: "ikawa",
    period: "sep",
    periodLabel: "September 2026",
    periodState: "Period closed 5 Oct",
    periodTone: "default",
    rows: [
      { category: "Coffee, food and retail", rule: VAT, lines: 4810, net: 3180000 },
      { category: "Exempt or zero-rated", rule: NONE, lines: 0, net: 0 },
      { category: "Refund receipts (credit notes)", rule: VAT, lines: 7, net: -24000 },
    ],
    input: { invoices: 31, amount: 190800 },
    inputNote: "All supplier invoices carry a fiscal number",
    documents: "EBM-0057-14205 to EBM-0057-19021 · 4,817 Issued",
    dailyReports: "Z-0079 to Z-0108",
    computed: "4 Oct 06:00, after Ikawa Corner closed September",
    excluded: "Nothing",
    fiscalStatus: "4,817 Issued · none open",
  },
  {
    id: "ikawa-oct",
    merchant: "ikawa",
    period: "oct",
    periodLabel: "October to date",
    periodState: "Period open · figures still move",
    periodTone: "accent",
    rows: [
      { category: "Coffee, food and retail", rule: VAT, lines: 1795, net: 1210000 },
      { category: "Exempt or zero-rated", rule: NONE, lines: 0, net: 0 },
      { category: "Refund receipts (credit notes)", rule: VAT, lines: 2, net: -4000 },
    ],
    input: { invoices: 12, amount: 73800 },
    inputNote: "All supplier invoices carry a fiscal number",
    documents: "EBM-0057-19022 to EBM-0057-20827 · 1,806 Issued",
    dailyReports: "Z-0109 to Z-0119, plus today’s X report",
    computed: "Today 10:00 · recomputed hourly while open",
    excluded: "1 Rejected document (RWF 9,440) until it is Issued",
    fiscalStatus: "1,806 Issued · 1 rejected",
  },
];

const vatDeclarations: VatDeclaration[] = [
  {
    id: "VAT-2026-09-AHL",
    merchant: "ahl",
    period: "sep",
    stage: "reviewed",
    preparedBy: "Grace Uwera",
    prepared: "6 Oct 09:10",
    reviewer: "Didier Mugenzi",
    reviewed: "9 Oct 15:40",
    reviewNote: "Matches the Z reports and supplier invoices. OK to export.",
    file: "VAT-2026-09-AHL.xlsx",
    checksum: "3f9a…c21e",
    documents: 5700,
    supplierInvoices: 412,
  },
];

const levies: Levy[] = [
  {
    id: "tourism",
    name: "Tourism or accommodation levy",
    why: "Whether it applies to Isangano and Ishyamba has not been confirmed with RRA or tax counsel.",
  },
  {
    id: "withholding",
    name: "Withholding tax on commissions and services",
    why: "Rate and scope for agent commissions need a tax specialist before anything is withheld.",
  },
  { id: "district", name: "District fees and local levies", why: "Not confirmed for Rubavu or Nyamagabe districts." },
];

export const fixtures = {
  "accounting.kpis": kpis,
  "accounting.fiscalProfiles": fiscalProfiles,
  "accounting.fiscalQueue": fiscalQueue,
  "accounting.documentKinds": documentKinds,
  "accounting.fiscalInvoices": fiscalInvoices,
  "accounting.fiscalReceipts": fiscalReceipts,
  "accounting.vsdcDevices": vsdcDevices,
  "accounting.fiscalJournal": fiscalJournal,
  "accounting.zReports": zReports,
  "accounting.itemCodes": itemCodes,
  "accounting.arAccounts": arAccounts,
  "accounting.arAging": arAging,
  "accounting.bankTransfers": bankTransfers,
  "accounting.commissions": commissions,
  "accounting.payouts": payouts,
  "accounting.journalEntries": journalEntries,
  "accounting.ledgerAccounts": ledgerAccounts,
  "accounting.closePeriods": closePeriods,
  "accounting.exportBatches": exportBatches,
  "accounting.vatSummaries": vatSummaries,
  "accounting.vatDeclarations": vatDeclarations,
  "accounting.levies": levies,
} satisfies FixtureSet;
