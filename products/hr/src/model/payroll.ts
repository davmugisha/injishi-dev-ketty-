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
  /** A live line: whose payslip it is. */
  employeeId?: string;
  /**
   * A live line: the figures the API computed, which the board shows instead of
   * working them out from `PayRates` (the sample board has none and does).
   */
  /** The owner's own pay, read by someone who is not the owner: counted in the totals, figures hidden. */
  confidential?: boolean;
  figures?: {
    gross: number;
    paye: number;
    /** Employee RSSB contributions. */
    rssb: number;
    /** Everything else withheld: loans, advances, deductions. */
    otherDeductions: number;
    /** Paid with the net and not income: a claim paid back, a loan paid out. */
    nonIncome: number;
    /** What that money is, in words. */
    nonIncomeLabel: string | null;
    net: number;
    /** Employer contributions. */
    employer: number;
  };
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
  /**
   * A live exception: something that stops the month (a blocker), as opposed to
   * a line worth a look. A blocker is fixed on the person's file, or the person
   * is paid next month (`canHold`).
   */
  blocker?: boolean;
  employeeId?: string | null;
  canHold?: boolean;
  /** The API's blocker code (`missing_rssb_number`, `missing_id`, `open_attendance`...): what fixes it. */
  code?: string;
  /** The person's name, for a blocker about one person. */
  who?: string;
  /** A clock record that stops the month: its id, day and clock-in time (ISO). */
  record?: { id: string; workDate: string; clockInAt: string };
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
  /** What the person is paid beyond the wage and allowances, line by line: unused leave, overtime, a correction. */
  parts: { label: string; amount: number; kind: "leave" | "other" }[];
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
  /** A live file: the export it builds (`POST /ops/pay-runs/:id/exports`). */
  kind?: "bank" | "momo" | null;
}

export interface PayRunOutput {
  id: string;
  icon: IconName;
  title: string;
  meta: string;
  /** "release": waits for payment file release; "confirmation": ready once the run is confirmed. */
  readyAfter: "release" | "confirmation";
  /** A live output: the declaration it builds (`POST /ops/pay-runs/:id/declarations`). */
  kind?: "paye" | "rssb" | null;
}

export interface PayRunHistory {
  id: string;
  period: string;
  staff: number;
  net: number;
  /** A live month's other totals, for the change on this month's figures. */
  gross?: number;
  paye?: number;
  /** The employee RSSB share. */
  rssb?: number;
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

/**
 * Where the run on the board stands, and what the person looking may do. One
 * document. On the sample board the stage comes from the address (?stage=);
 * a live board reads it from the run.
 */
export interface PayRunState {
  id: string;
  live: boolean;
  /** The run on the board, or null when the business has none yet. */
  runId: string | null;
  /** "2026-10". */
  period: string;
  stage: PayRunStage;
  eyebrow: string;
  title: string;
  description: string;
  /** Who prepared it, and who confirms it (the owner, `payroll.run`). */
  preparerName: string;
  confirmerName: string;
  /** "Thu 8 Oct 09:40", when it was submitted. */
  submittedLabel: string | null;
  submitNote: string | null;
  /** "Didier Mugenzi · Mon 12 Oct 11:20". */
  confirmedLabel: string | null;
  /** The person may draft (`payroll.draft`) and may confirm (`payroll.run`). */
  canPrepare: boolean;
  canConfirm: boolean;
  /** A month with no run yet that may be prepared next ("2026-11"), and its name. */
  nextPeriod: string | null;
  nextPeriodLabel: string | null;
  /** Things that stop the month: fixed on a file, or paid next month. */
  blockerCount: number;
}

/** A run of an earlier month, read whole: its totals and each payslip. */
export interface PastRun {
  id: string;
  period: string;
  status: "draft" | "confirmed";
  headcount: number;
  grossRwf: number;
  netRwf: number;
  payeRwf: number;
  employeeContributionsRwf: number;
  employerContributionsRwf: number;
  submittedByName: string | null;
  submittedAt: string | null;
  confirmedByName: string | null;
  confirmedAt: string | null;
  payslips: {
    id: string;
    employeeId: string;
    name: string;
    days: number;
    gross: number;
    paye: number;
    rssb: number;
    other: number;
    net: number;
    /** The owner's own payslip, read by someone who is not the owner: there, with its figures hidden. */
    confidential?: boolean;
  }[];
}

/** The business's RSSB employer number, and whether this person may change it (`payroll.run`). */
export interface PayrollSettingsView {
  rssbEmployerNumber: string | null;
  canEdit: boolean;
}

/** A loan or salary advance as whoever runs pay sees it. */
export interface PayLoanView {
  id: string;
  employeeId: string;
  name: string;
  title: string | null;
  kind: "loan" | "advance";
  amountRwf: number;
  remainingRwf: number;
  givenOn: string;
  installments: number;
  /** The next month an installment is taken ("2026-11") and how much; null once repaid. */
  nextPeriod: string | null;
  nextAmountRwf: number | null;
  /** Paid with the month's pay, or handed over outside Injishi. */
  paidOut: "payslip" | "outside";
  reason: string | null;
  settled: boolean;
}

/** The loans of the business, and who can be given one. */
export interface PayLoansData {
  loans: PayLoanView[];
  people: { id: string; name: string; title: string | null }[];
}

/** Money a person asked back, or leave they asked paid out, as HR and the owner see it. */
export interface PayClaimView {
  id: string;
  employeeId: string;
  name: string;
  title: string | null;
  kind: "reimbursement" | "leave_encashment";
  amountRwf: number | null;
  leaveType: string | null;
  days: number | null;
  /** The month it is paid in, "2026-11". */
  period: string;
  hasReceipt: boolean;
  reason: string;
  status: "requested" | "approved" | "rejected" | "cancelled";
  decidedAt: string | null;
  decidedByName: string | null;
  decisionNote: string | null;
  /** Paid with a confirmed payslip. */
  paid: boolean;
  createdAt: string;
}

export interface PayrollContribution {
  code: string;
  label: string;
  base: "gross" | "basic" | "contributable" | "net";
  /** Decimal shares, 0.06 for 6%. */
  employeeRate: number;
  employerRate: number;
  capRwf: number | null;
  optional: boolean;
  /** Whether it applies to this business's pay now. */
  enabled: boolean;
  /** An optional one the business has not chosen on or off. */
  byDefault: boolean;
}

export interface PayrollContributionList {
  ruleVersion: number | null;
  effectiveFrom: string | null;
  note: string | null;
  contributions: PayrollContribution[];
  paye: { taxableBase: string; bands: { fromRwf: number; toRwf: number | null; rate: number }[] } | null;
  privateHealth: { enabled: boolean; provider: string | null; employeeAmountRwf: number; employerAmountRwf: number };
  canChoose: boolean;
}

/** An amount added to, or taken off, one person's pay for a month, with why (`POST /ops/pay-adjustments`). */
export interface PayAmountInput {
  employeeId: string;
  side: "earning" | "deduction";
  amountRwf: number;
  /** An addition PAYE and RSSB apply to; a deduction is taken after both. */
  taxed: boolean;
  reason: string;
  /** "2026-11". */
  period: string;
}
