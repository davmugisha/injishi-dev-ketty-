/**
 * What the payroll, talent and staff services screens draw. Every one of them is fixture data today.
 *
 * Declared here since ADR-074 stage 3: the product owns the shapes its views draw, and the app's sources
 * build them. `@injishi/data/fixtures/payroll.ts` keeps matching declarations for its demo rows until stage 9,
 * and every page that passes those rows into a view is where the compiler checks the two still agree.
 */
import type { BoardId, IconName, Tone } from "./shared.ts";

// ── Pay run ─────────────────────────────────────────────────────────────────

/** Stage of the October pay run (artifact prop `stage`). */
export type PayRunStage = "review" | "submitted" | "confirmed";

/** Configured statutory rates of a rule snapshot, used to calculate every pay line. */
export interface PayRates {
  id: string;
  /** PAYE bands on monthly taxable pay; `upTo: null` is the open top band. */
  payeBands: { upTo: number | null; rate: number }[];
  /** RSSB pension, employee share (the employer pays the same). */
  pension: number;
  /** RSSB maternity leave, employee share (the employer pays the same). */
  maternity: number;
  /** Occupational hazards, employer only. */
  occupationalHazards: number;
}

export interface PayLine {
  id: string;
  name: string;
  role: string;
  /** Payment rail ("MTN MoMo", "Bank of Kigali"). */
  payBy: string;
  base: number;
  allowances: number;
  /** Overtime, retroactive pay or leave payout, with its label. */
  other: number;
  otherLabel: string | null;
  loan: number;
  loanLabel: string | null;
  flag: string;
  flagTone: Tone;
  /** Shown under "Exceptions only". */
  isException: boolean;
  /** How the line was calculated (shown in the Pay Line card). */
  note: string | null;
}

export interface PayRunStep {
  id: string;
  title: string;
  desc: string;
  /** Description once the run is confirmed (owner confirmation step). */
  confirmedDesc: string | null;
}

export interface PayRunException {
  id: string;
  icon: IconName;
  title: string;
  detail: string;
  reviewed: boolean;
  /** Pay line the exception explains (selected when it is reviewed). */
  lineId: string | null;
}

export interface PayRunRule {
  id: string;
  label: string;
  status: "awaiting" | "approved";
}

export interface PayRunTotal {
  id: string;
  label: string;
  value: number;
  format: "count" | "rwf";
  foot: string;
  /** Amount appended to the foot ("Employer share RWF 2,227,720"). */
  footAmount: number | null;
}

export interface FinalSettlement {
  id: string;
  /** Pay line the settlement is calculated from. */
  lineId: string;
  name: string;
  desc: string;
  payLabel: string;
  leaveLabel: string;
  advanceLabel: string;
  board: BoardId;
}

export interface PaymentFile {
  id: string;
  rail: string;
  how: string;
  staff: number;
  amount: number;
  /** Gate once the owner confirmed the run (before that: "After confirmation"). */
  confirmedGate: string;
  confirmedIcon: IconName;
}

export interface PayRunOutput {
  id: string;
  icon: IconName;
  title: string;
  meta: string;
  /** "release": waits for payment file release; "confirmation": ready once the run is confirmed. */
  readyAfter: "release" | "confirmation";
}

export interface PayRunHistory {
  id: string;
  period: string;
  staff: number;
  net: number;
  preparedBy: string;
  preparedAt: string;
  confirmedBy: string;
  confirmedAt: string;
  releasedBy: string;
  releasedAt: string;
  outcome: string;
  /** Prepared, confirmed and released by one person (before permissions were split). */
  combinedPermission: boolean;
}

// ── Payroll rules ───────────────────────────────────────────────────────────

/** awaiting: statutory set awaiting expert sign-off · approved: business policy approved by the owner · draft: proposal. */
export type RuleSetStatus = "awaiting" | "approved" | "draft";

export interface RuleSet {
  id: string;
  name: string;
  icon: IconName;
  version: string;
  /** Version it replaces (compared against). */
  prev: string;
  eff: string;
  effRange: string;
  status: RuleSetStatus;
  statusLabel: string;
  kind: string;
  source: string;
  by: string;
  owner: string;
  expert: string;
  /** Configured values, as entered from the source. */
  cols: string[];
  rows: string[][];
  /** Line-by-line comparison with `prev`. */
  diff: { line: string; old: string; now: string; change: "unchanged" | "changed" | "added" }[];
  note: string;
  history: { title: string; detail: string; status: "current" | "success" | "default" }[];
  used: { title: string; detail: string; board: BoardId }[];
}

export interface RuleGovernanceStep {
  id: string;
  icon: IconName;
  title: string;
  detail: string;
}

// ── Talent ──────────────────────────────────────────────────────────────────

export type PipelineStage = "applied" | "screening" | "interview" | "offer" | "hired";

export interface Vacancy {
  id: string;
  icon: IconName;
  title: string;
  where: string;
  state: string;
  stateTone: Tone;
  approved: string;
  band: string;
  funnel: string;
}

export interface Candidate {
  id: string;
  name: string;
  /** Vacancy id; "commis" is already filled and has no open vacancy card. */
  vacancy: string;
  role: string;
  stage: PipelineStage;
  source: string;
  applied: string;
  /** Data kept until this date (or "became employee data" once hired). */
  consentUntil: string;
  /** Consented to the talent pool as well as this vacancy. */
  talentPool: boolean;
  next: string;
  nextShort: string | null;
  scores: { what: string; score: string; who: string }[];
}

export interface Interview {
  id: string;
  when: string;
  who: string;
  what: string;
  status: "current" | "default";
}

export interface OnboardingTask {
  id: string;
  title: string;
  detail: string;
  done: boolean;
}

export interface ReviewCycleMetric {
  id: string;
  label: string;
  /** null when the step has not started. */
  done: number | null;
  total: number | null;
  note: string;
}

export interface ReviewDepartment {
  id: string;
  name: string;
  objectives: string;
  selfReviews: string;
  feedback360: string;
  managerReviews: string;
  status: string;
  statusTone: Tone;
}

// ── Staff services ──────────────────────────────────────────────────────────

export interface TicketMessage {
  /** them: the employee · system: a linked Injishi record · me: HR (Diane Ingabire). */
  from: "them" | "system" | "me";
  text: string;
  meta: string;
}

export interface HelpdeskTicket {
  id: string;
  icon: IconName;
  title: string;
  who: string;
  topic: string;
  age: string;
  state: string;
  stateTone: Tone;
  /** Pay, health and personal questions are visible to HR only. */
  hrOnly: boolean;
  resolved: boolean;
  link: { label: string; board: BoardId } | null;
  thread: TicketMessage[];
}

export interface StaffAsset {
  id: string;
  icon: IconName;
  name: string;
  tag: string;
  holder: string;
  dept: string;
  custody: string;
  condition: string;
  status: string;
  statusTone: Tone;
  highRisk: boolean;
  /** out: on loan · leaver: held by someone leaving · due: swap or return requested. */
  kind: "out" | "leaver" | "due";
  /** A return can be recorded now. */
  returnDue: boolean;
  note: string | null;
}

export interface HrReport {
  id: string;
  icon: IconName;
  title: string;
  detail: string;
  ownerOnly: boolean;
}

export interface HrAutomation {
  id: string;
  title: string;
  detail: string;
  privacy: string;
  /** Last run line while switched on (null: never ran, "On · runs daily at 06:00" once enabled). */
  lastRun: string | null;
  enabled: boolean;
}
