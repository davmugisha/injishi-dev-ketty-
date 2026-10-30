/**
 * What Finance's tax, tax invoices, receivables, commissions and ledger screens draw.
 *
 * Declared here since ADR-074 stage 6: the product owns the shapes its views draw, copied verbatim from
 * `@injishi/data/fixtures/accounting.ts` with every type they reference. The demo fixtures keep matching
 * declarations for their rows until stage 9, and every page that passes those rows into a view is where the
 * compiler checks the two still agree.
 */
import type { BoardId, IconName, Tone } from "./shared.ts";

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
