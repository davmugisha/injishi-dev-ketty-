/**
 * What the folio and night audit screens draw.
 *
 * Declared here since ADR-074 stage 4: the product owns the shapes its views draw, copied verbatim from
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
