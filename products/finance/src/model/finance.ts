/**
 * What Finance's overview and shift close screens draw.
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
