/**
 * What Pay's payments and reconciliation screens draw.
 *
 * Declared here since ADR-074 stage 6: the product owns the shapes its views draw, copied verbatim from
 * `@injishi/data/fixtures/finance.ts` with every type they reference. The demo fixtures keep matching
 * declarations for their rows until stage 9, and every page that passes those rows into a view is where the
 * compiler checks the two still agree.
 */
import type { BoardId, IconName, Tone } from "./shared.ts";

/** Outcome of one evidence check (icon + colour in the view). */
export type CheckTone = "success" | "warning" | "danger" | "idle";

/** Timeline marker status. */
export type EventStatus = "success" | "warning" | "danger" | "default" | "current";

export interface FinanceEvent {
  title: string;
  meta: string;
  status: EventStatus;
}

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
