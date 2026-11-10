import type { BoardId, FixtureSet, IconName } from "../types.ts";

/**
 * Embedded-database fixtures for the "payroll" area: Pay run (PayRun), Payroll rules (PayrollRules),
 * Talent (Talent) and Staff services (StaffServices), all used by Diane Ingabire, HR officer.
 * Values are lifted verbatim from the artifact boards (node tools/artifact/extract.mjs <Board>).
 */

export type Tone = "accent" | "success" | "warning" | "danger" | "default" | "info";

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

const payRates: PayRates[] = [
  {
    id: "v2026-01",
    payeBands: [
      { upTo: 60000, rate: 0 },
      { upTo: 100000, rate: 0.1 },
      { upTo: 200000, rate: 0.2 },
      { upTo: null, rate: 0.3 },
    ],
    pension: 0.06,
    maternity: 0.003,
    occupationalHazards: 0.02,
  },
];

const payLines: PayLine[] = [
  {
    id: "jn",
    name: "Jeanne Nyiraneza",
    role: "Room attendant",
    payBy: "MTN MoMo",
    base: 180000,
    allowances: 30000,
    other: 12000,
    otherLabel: "Overtime 6 h",
    loan: 20000,
    loanLabel: "Salary advance 2 of 3",
    flag: "None",
    flagTone: "default",
    isException: false,
    note: null,
  },
  {
    id: "bm",
    name: "Beatrice Mukandori",
    role: "Housekeeping supervisor",
    payBy: "Bank of Kigali",
    base: 320000,
    allowances: 50000,
    other: 0,
    otherLabel: null,
    loan: 0,
    loanLabel: null,
    flag: "None",
    flagTone: "default",
    isException: false,
    note: null,
  },
  {
    id: "eh",
    name: "Eric Habimana",
    role: "Front desk agent",
    payBy: "GT Bank",
    base: 280000,
    allowances: 40000,
    other: 0,
    otherLabel: null,
    loan: 0,
    loanLabel: null,
    flag: "None",
    flagTone: "default",
    isException: false,
    note: null,
  },
  {
    id: "jp",
    name: "Jean-Paul Niyonsaba",
    role: "Maintenance technician",
    payBy: "Equity Bank",
    base: 260000,
    allowances: 40000,
    other: 28500,
    otherLabel: "Overtime 11 h",
    loan: 50000,
    loanLabel: "Staff loan 4 of 10",
    flag: "None",
    flagTone: "default",
    isException: false,
    note: null,
  },
  {
    id: "cm",
    name: "Claudine Mukamana",
    role: "Waiter",
    payBy: "MTN MoMo",
    base: 150000,
    allowances: 25000,
    other: 9000,
    otherLabel: "Overtime 4.5 h",
    loan: 0,
    loanLabel: null,
    flag: "None",
    flagTone: "default",
    isException: false,
    note: null,
  },
  {
    id: "fn",
    name: "Fabrice Ndayisenga",
    role: "Commis chef",
    payBy: "Airtel Money",
    base: (200000 * 26) / 31,
    allowances: (25000 * 26) / 31,
    other: 0,
    otherLabel: null,
    loan: 0,
    loanLabel: null,
    flag: "New joiner",
    flagTone: "info",
    isException: true,
    note: "Joined 6 Oct. Base RWF 200,000 and allowance RWF 25,000 pro-rated for 26 of 31 calendar days, per the configured pro-rata method.",
  },
  {
    id: "an",
    name: "Aimable Nsengiyumva",
    role: "Security guard",
    payBy: "MTN MoMo",
    base: 160000 - 16000,
    allowances: 20000,
    other: 6000,
    otherLabel: "Overtime 3 h",
    loan: 0,
    loanLabel: null,
    flag: "Unpaid leave",
    flagTone: "info",
    isException: true,
    note: "Base RWF 160,000 less 3 days unpaid leave (RWF 16,000 at 1/30 a day), approved by Emmanuel Nkusi and HR.",
  },
  {
    id: "jh",
    name: "Joseph Habimana",
    role: "Outlet supervisor",
    payBy: "Bank of Kigali",
    base: 350000,
    allowances: 50000,
    other: 30000,
    otherLabel: "Retroactive, September",
    loan: 0,
    loanLabel: null,
    flag: "Retroactive",
    flagTone: "warning",
    isException: true,
    note: "Base raised from RWF 320,000 to RWF 350,000 effective 1 Sep. Didier Mugenzi approved it on 30 Sep, after September was confirmed, so September’s difference is paid here with that reason attached.",
  },
  {
    id: "pm",
    name: "Pacifique Mugabo",
    role: "Barman · leaving",
    payBy: "MTN MoMo",
    base: (170000 * 20) / 31,
    allowances: (25000 * 20) / 31,
    other: (170000 / 26) * 6,
    otherLabel: "6 untaken leave days",
    loan: 35000,
    loanLabel: "Advance recovered in full",
    flag: "Final settlement",
    flagTone: "accent",
    isException: true,
    note: "Pay to 20 Oct, untaken leave at 1/26 of base a day, outstanding advance recovered. Certificate of service on the last day.",
  },
];

const payRunState: PayRunState[] = [
  {
    id: "october-2026",
    live: false,
    runId: null,
    period: "2026-10",
    stage: "submitted",
    eyebrow: "People › Pay run · period 1–31 October 2026 · pay date Friday 23 October",
    title: "October 2026 pay run",
    description:
      "Amahoro Hospitality Ltd (44 staff) and Amahoro Residences Ltd (4 staff). Each employer files its own declarations.",
    preparerName: "Diane Ingabire",
    confirmerName: "Didier Mugenzi",
    submittedLabel: "Fri 9 Oct",
    submitNote: null,
    confirmedLabel: "Didier Mugenzi · today 11:20",
    canPrepare: true,
    canConfirm: false,
    nextPeriod: null,
    nextPeriodLabel: null,
    blockerCount: 0,
  },
];
const payRunSteps: PayRunStep[] = [
  { id: "draft", title: "Draft", desc: "Diane Ingabire · Thu 8 Oct", confirmedDesc: null },
  { id: "review", title: "Review", desc: "Checks passed · Fri 9 Oct", confirmedDesc: null },
  {
    id: "confirm",
    title: "Owner confirmation",
    desc: "Didier Mugenzi",
    confirmedDesc: "Didier Mugenzi · Mon 12 Oct 11:20",
  },
  { id: "release", title: "Payment file release", desc: "Separate permission · GT Bank gated", confirmedDesc: null },
  { id: "payslips", title: "Payslips", desc: "After release", confirmedDesc: null },
];

const payRunExceptions: PayRunException[] = [
  {
    id: "e1",
    icon: "PersonPlus",
    title: "New joiner pro-rata · Fabrice Ndayisenga",
    detail: "Joined 6 Oct · 26 of 31 days · contract signed, payment details confirmed",
    reviewed: true,
    lineId: "fn",
  },
  {
    id: "e2",
    icon: "Suitcase",
    title: "Unpaid leave · Aimable Nsengiyumva",
    detail: "3 days · − RWF 16,000 · approved by Emmanuel Nkusi and HR",
    reviewed: true,
    lineId: "an",
  },
  {
    id: "e3",
    icon: "ArrowRotateLeft",
    title: "Retroactive adjustment · Joseph Habimana",
    detail: "+ RWF 30,000 for September · reason: annual review effective 1 Sep, approved by Didier Mugenzi 30 Sep",
    reviewed: false,
    lineId: "jh",
  },
  {
    id: "e4",
    icon: "ArrowRightFromSquare",
    title: "Final settlement · Pacifique Mugabo",
    detail: "Last day 20 Oct · leave payout and advance recovery included",
    reviewed: true,
    lineId: "pm",
  },
  {
    id: "e5",
    icon: "Lock",
    title: "Your own pay line · Diane Ingabire",
    detail: "Locked to you as preparer. Didier sees it flagged when he confirms.",
    reviewed: true,
    lineId: null,
  },
];

const payRunRules: PayRunRule[] = [
  { id: "paye", label: "PAYE v2026-01 · awaiting sign-off", status: "awaiting" },
  { id: "rssb", label: "RSSB v2026-01 · awaiting sign-off", status: "awaiting" },
  { id: "allw", label: "Allowance taxability v2026-01 · awaiting sign-off", status: "awaiting" },
  { id: "ot", label: "Overtime and holiday policy v3 · owner approved", status: "approved" },
];

const payRunTotals: PayRunTotal[] = [
  { id: "staff", label: "Staff", value: 48, format: "count", foot: "44 + 4 across two employers", footAmount: null },
  {
    id: "gross",
    label: "Gross pay",
    value: 26840000,
    format: "rwf",
    foot: "Base, allowances, overtime, adjustments",
    footAmount: null,
  },
  { id: "paye", label: "PAYE", value: 4918200, format: "rwf", foot: "Configured bands, v2026-01", footAmount: null },
  { id: "rssb", label: "RSSB employee", value: 1690920, format: "rwf", foot: "Employer share", footAmount: 2227720 },
  { id: "loans", label: "Loans and advances", value: 386000, format: "rwf", foot: "9 staff", footAmount: null },
  { id: "net", label: "Net pay", value: 19844880, format: "rwf", foot: "Employer cost", footAmount: 29067720 },
];

const finalSettlements: FinalSettlement[] = [
  {
    id: "pm",
    lineId: "pm",
    name: "Pacifique Mugabo",
    desc: "Barman, Lake Bar · resigned · last day 20 Oct",
    payLabel: "Pay 1–20 Oct (20 of 31 days)",
    leaveLabel: "Untaken leave, 6 days",
    advanceLabel: "Advance recovered",
    parts: [{ label: "Unused leave", amount: (170000 / 26) * 6, kind: "leave" }],
    board: "Employees",
  },
];

const paymentFiles: PaymentFile[] = [
  {
    id: "bank",
    rail: "Bank transfer",
    how: "GT Bank bulk file · 31 staff at 6 banks",
    staff: 31,
    amount: 15624300,
    confirmedGate: "Manual upload only",
    confirmedIcon: "ShieldExclamation",
  },
  {
    id: "mtn",
    rail: "MTN MoMo",
    how: "Bulk disbursement CSV",
    staff: 14,
    amount: 3861080,
    confirmedGate: "Ready to release",
    confirmedIcon: "FileArrowDown",
  },
  {
    id: "airtel",
    rail: "Airtel Money",
    how: "Bulk disbursement CSV",
    staff: 3,
    amount: 359500,
    confirmedGate: "Ready to release",
    confirmedIcon: "FileArrowDown",
  },
];

const payRunOutputs: PayRunOutput[] = [
  {
    id: "payslips",
    icon: "Receipt",
    title: "Payslips · 48",
    meta: "Staff app and SMS link · downloads limited to the employee, HR and the owner",
    readyAfter: "release",
  },
  {
    id: "paye",
    icon: "FileText",
    title: "PAYE declaration schedule",
    meta: "Per employer · you file it on the RRA portal; Injishi does not submit",
    readyAfter: "confirmation",
  },
  {
    id: "rssb",
    icon: "FileText",
    title: "RSSB contribution schedule",
    meta: "Per employer · pension, maternity, occupational hazards",
    readyAfter: "confirmation",
  },
  {
    id: "journal",
    icon: "Book",
    title: "Payroll journal for Finance",
    meta: "Totals only, no individual salaries",
    readyAfter: "confirmation",
  },
];

const payRunHistory: PayRunHistory[] = [
  {
    id: "2026-09",
    period: "September 2026",
    staff: 47,
    net: 19412300,
    gross: 25814229,
    paye: 4956332,
    rssb: 1703739,
    preparedBy: "Diane Ingabire",
    preparedAt: "23 Sep 15:02",
    confirmedBy: "Didier Mugenzi",
    confirmedAt: "24 Sep 08:40",
    releasedBy: "Didier Mugenzi",
    releasedAt: "25 Sep 07:55",
    outcome: "Paid · 47 of 47 confirmed by bank and MoMo",
    combinedPermission: false,
  },
  {
    id: "2026-08",
    period: "August 2026",
    staff: 46,
    net: 19020750,
    gross: 25293551,
    paye: 4856362,
    rssb: 1669374,
    preparedBy: "Diane Ingabire",
    preparedAt: "24 Aug 11:20",
    confirmedBy: "Didier Mugenzi",
    confirmedAt: "24 Aug 18:05",
    releasedBy: "Didier Mugenzi",
    releasedAt: "25 Aug 08:10",
    outcome: "Paid · 46 of 46 confirmed",
    combinedPermission: false,
  },
  {
    id: "2026-07",
    period: "July 2026",
    staff: 46,
    net: 18996400,
    gross: 25261170,
    paye: 4850145,
    rssb: 1667237,
    preparedBy: "Didier Mugenzi",
    preparedAt: "24 Jul 16:45",
    confirmedBy: "Didier Mugenzi",
    confirmedAt: "24 Jul 16:52",
    releasedBy: "Didier Mugenzi",
    releasedAt: "24 Jul 17:30",
    outcome: "Paid · 46 of 46 confirmed",
    combinedPermission: true,
  },
];

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

const AWAITING = "Awaiting sign-off";
const RSSB_ROWS = [
  ["Pension", "6% of gross", "6% of gross"],
  ["Maternity leave", "0.3% of gross", "0.3% of gross"],
  ["Occupational hazards", "—", "2% of gross"],
];

const ruleSets: RuleSet[] = [
  {
    id: "paye",
    name: "PAYE bands",
    icon: "Percent",
    version: "v2026-01",
    prev: "v2025-01",
    eff: "1 Jan 2026",
    effRange: "1 January 2026 until replaced",
    status: "awaiting",
    statusLabel: AWAITING,
    kind: "Statutory · monthly taxable income",
    source: "RRA PAYE guide, PDF uploaded by Diane Ingabire on 4 Jan 2026",
    by: "Diane Ingabire · 4 Jan 2026",
    owner: "Approved for configuration by Didier Mugenzi · 6 Jan 2026",
    expert: "Not yet · no payroll expert assigned",
    cols: ["Band", "From", "To", "Rate"],
    rows: [
      ["1", "RWF 0", "RWF 60,000", "0%"],
      ["2", "RWF 60,001", "RWF 100,000", "10%"],
      ["3", "RWF 100,001", "RWF 200,000", "20%"],
      ["4", "RWF 200,001", "and above", "30%"],
    ],
    diff: [
      { line: "Band 1", old: "0% to RWF 60,000", now: "0% to RWF 60,000", change: "unchanged" },
      { line: "Band 2", old: "10% to RWF 100,000", now: "10% to RWF 100,000", change: "unchanged" },
      { line: "Band 3", old: "20% to RWF 200,000", now: "20% to RWF 200,000", change: "unchanged" },
      { line: "Band 4", old: "30% above", now: "30% above", change: "unchanged" },
    ],
    note: "Re-issued for 2026 with a new source attachment; no values changed. Applied to each month’s taxable pay after allowance taxability.",
    history: [
      { title: "v2026-01 · current", detail: "From 1 Jan 2026 · awaiting sign-off", status: "current" },
      {
        title: "v2025-01 · superseded",
        detail: "1 Jan – 31 Dec 2025 · configured at onboarding, never signed off",
        status: "default",
      },
    ],
    used: [
      { title: "October 2026 pay run", detail: "Draft with the owner · rules awaiting sign-off", board: "PayRun" },
      { title: "September 2026 pay run", detail: "Confirmed with the owner’s documented exception", board: "PayRun" },
    ],
  },
  {
    id: "rssb",
    name: "RSSB contributions",
    icon: "ShieldCheck",
    version: "v2026-01",
    prev: "v2025-01",
    eff: "1 Jan 2026",
    effRange: "1 January 2026 until replaced",
    status: "awaiting",
    statusLabel: AWAITING,
    kind: "Statutory · per employer",
    source: "RSSB employer contribution notice, PDF uploaded by Diane Ingabire on 4 Jan 2026",
    by: "Diane Ingabire · 4 Jan 2026",
    owner: "Approved for configuration by Didier Mugenzi · 6 Jan 2026",
    expert: "Not yet · no payroll expert assigned",
    cols: ["Line", "Employee", "Employer"],
    rows: RSSB_ROWS,
    diff: [
      { line: "Pension", old: "6% + 6%", now: "6% + 6%", change: "unchanged" },
      { line: "Maternity leave", old: "0.3% + 0.3%", now: "0.3% + 0.3%", change: "unchanged" },
      { line: "Occupational hazards", old: "Employer 2%", now: "Employer 2%", change: "unchanged" },
    ],
    note: "Filed separately for Amahoro Hospitality Ltd and Amahoro Residences Ltd under each employer’s own registration.",
    history: [
      { title: "v2026-01 · current", detail: "From 1 Jan 2026 · awaiting sign-off", status: "current" },
      { title: "v2025-01 · superseded", detail: "1 Jan – 31 Dec 2025 · never signed off", status: "default" },
    ],
    used: [
      { title: "October 2026 pay run", detail: "Draft with the owner", board: "PayRun" },
      { title: "September 2026 pay run", detail: "Confirmed with the owner’s documented exception", board: "PayRun" },
    ],
  },
  {
    id: "allw",
    name: "Allowance taxability",
    icon: "Wallet",
    version: "v2026-01",
    prev: "v2025-01",
    eff: "1 Jan 2026",
    effRange: "1 January 2026 until replaced",
    status: "awaiting",
    statusLabel: AWAITING,
    kind: "Statutory treatment · per allowance",
    source: "Notes from the RRA PAYE guide, same upload as PAYE v2026-01",
    by: "Diane Ingabire · 4 Jan 2026",
    owner: "Approved for configuration by Didier Mugenzi · 6 Jan 2026",
    expert: "Not yet · no payroll expert assigned",
    cols: ["Allowance", "PAYE", "RSSB base"],
    rows: [
      ["Transport", "Taxable", "Included"],
      ["Housing", "Taxable", "Included"],
      ["Responsibility", "Taxable", "Included"],
      ["Staff meals on duty", "Not taxed, in kind", "Excluded"],
      ["Uniform", "Not taxed", "Excluded"],
    ],
    diff: [
      { line: "Transport", old: "Taxable", now: "Taxable", change: "unchanged" },
      { line: "Housing", old: "Taxable", now: "Taxable", change: "unchanged" },
      { line: "Staff meals on duty", old: "Not taxed", now: "Not taxed", change: "unchanged" },
    ],
    note: "Treatments are configured, not advice. The expert confirms each one before they count as verified.",
    history: [
      { title: "v2026-01 · current", detail: "From 1 Jan 2026 · awaiting sign-off", status: "current" },
      { title: "v2025-01 · superseded", detail: "2025 · never signed off", status: "default" },
    ],
    used: [{ title: "October 2026 pay run", detail: "Draft with the owner", board: "PayRun" }],
  },
  {
    id: "ot",
    name: "Overtime and holiday premium",
    icon: "Clock",
    version: "v3",
    prev: "v2",
    eff: "1 Jul 2026",
    effRange: "1 July 2026 until replaced",
    status: "approved",
    statusLabel: "Business policy · owner approved",
    kind: "Business policy, not statutory",
    source: "Amahoro staff handbook, section 7",
    by: "Diane Ingabire · 20 Jun 2026",
    owner: "Approved by Didier Mugenzi · 24 Jun 2026",
    expert: "Not required for business policy",
    cols: ["Line", "Premium"],
    rows: [
      ["Weekday overtime", "+50% of hourly rate"],
      ["Weekly rest day", "+100%"],
      ["Public holiday shift", "+100%"],
      ["Night shift allowance", "RWF 1,000 a night"],
    ],
    diff: [
      { line: "Weekday overtime", old: "+50%", now: "+50%", change: "unchanged" },
      { line: "Night shift allowance", old: "RWF 800", now: "RWF 1,000", change: "changed" },
    ],
    note: "Holiday dates come from the configured public holiday calendar on the roster.",
    history: [
      { title: "v3 · current", detail: "From 1 Jul 2026 · owner approved", status: "success" },
      { title: "v2 · superseded", detail: "1 Jan – 30 Jun 2026", status: "default" },
    ],
    used: [
      { title: "October 2026 pay run", detail: "27 staff with overtime", board: "PayRun" },
      { title: "September 2026 pay run", detail: "Confirmed", board: "PayRun" },
    ],
  },
  {
    id: "draft",
    name: "RSSB contributions",
    icon: "PencilToSquare",
    version: "v2026-11 draft",
    prev: "v2026-01",
    eff: "1 Nov 2026",
    effRange: "Proposed from 1 November 2026",
    status: "draft",
    statusLabel: "Draft · awaiting approvals",
    kind: "Proposed change",
    source: "RSSB notice on community-based health insurance deductions, PDF uploaded 9 Oct 2026",
    by: "Proposed by Diane Ingabire · 9 Oct 2026",
    owner: "Waiting · Didier Mugenzi approves after the expert",
    expert: "Not yet · no payroll expert assigned",
    cols: ["Line", "Employee", "Employer"],
    rows: [...RSSB_ROWS, ["Community-based health insurance", "0.5% of net pay", "—"]],
    diff: [
      { line: "Pension", old: "6% + 6%", now: "6% + 6%", change: "unchanged" },
      { line: "Maternity leave", old: "0.3% + 0.3%", now: "0.3% + 0.3%", change: "unchanged" },
      { line: "Occupational hazards", old: "Employer 2%", now: "Employer 2%", change: "unchanged" },
      {
        line: "Community-based health insurance",
        old: "Not configured",
        now: "Employee 0.5% of net",
        change: "added",
      },
    ],
    note: "Adds community-based health insurance.",
    history: [
      { title: "v2026-11 · draft", detail: "Proposed 9 Oct 2026 by Diane Ingabire", status: "current" },
      { title: "v2026-01 · current", detail: "From 1 Jan 2026 · awaiting sign-off", status: "default" },
    ],
    used: [],
  },
];

const ruleGovernance: RuleGovernanceStep[] = [
  {
    id: "source",
    icon: "Paperclip",
    title: "Propose with a source",
    detail: "Attach the publication.",
  },
  {
    id: "expert",
    icon: "SealCheck",
    title: "Payroll expert signs off",
    detail: "Statutory sets only.",
  },
  {
    id: "owner",
    icon: "Person",
    title: "Owner approves",
    detail: "Not the proposer.",
  },
  {
    id: "effective",
    icon: "Calendar",
    title: "Applies from its effective date",
    detail: "Past runs keep their versions.",
  },
];

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

const vacancies: Vacancy[] = [
  {
    id: "chef",
    icon: "Cup",
    title: "Sous chef",
    where: "Isangano Terrace kitchen · Food and beverage · reports to Joseph Habimana",
    state: "Open · closes 20 Oct",
    stateTone: "success",
    approved: "Didier Mugenzi · 1 Oct · replaces a leaver",
    band: "RWF 380,000 – 450,000 base",
    funnel: "14 applied · 9 declined with reasons · 5 active",
  },
  {
    id: "audit",
    icon: "Moon",
    title: "Night auditor",
    where: "Front office · Isangano Lakeside Hotel · reports to Aline Uwase",
    state: "Open · closes 15 Oct",
    stateTone: "success",
    approved: "Didier Mugenzi · 22 Sep · new position",
    band: "RWF 300,000 – 340,000 base",
    funnel: "9 applied · 6 declined with reasons · 3 active",
  },
];

const candidates: Candidate[] = [
  {
    id: "c1",
    name: "Patience Uwamariya",
    vacancy: "chef",
    role: "Sous chef",
    stage: "applied",
    source: "Careers page",
    applied: "10 Oct",
    consentUntil: "10 Apr 2027",
    talentPool: false,
    next: "CV screen by Diane Ingabire",
    nextShort: null,
    scores: [],
  },
  {
    id: "c2",
    name: "Samuel Nkurunziza",
    vacancy: "chef",
    role: "Sous chef",
    stage: "applied",
    source: "Staff referral",
    applied: "11 Oct",
    consentUntil: "11 Apr 2027",
    talentPool: false,
    next: "CV screen by Diane Ingabire",
    nextShort: null,
    scores: [],
  },
  {
    id: "c3",
    name: "Jean de Dieu Ntwari",
    vacancy: "chef",
    role: "Sous chef",
    stage: "screening",
    source: "Careers page",
    applied: "4 Oct",
    consentUntil: "4 Apr 2027",
    talentPool: false,
    next: "Phone screen Thu 15 Oct 09:00",
    nextShort: "Thu 15 Oct",
    scores: [{ what: "CV screen", score: "3 of 5", who: "Diane Ingabire" }],
  },
  {
    id: "c4",
    name: "Esther Nyirahabimana",
    vacancy: "chef",
    role: "Sous chef",
    stage: "interview",
    source: "Careers page",
    applied: "3 Oct",
    consentUntil: "3 Apr 2027",
    talentPool: false,
    next: "Practical test Tue 13 Oct 10:00, Terrace kitchen",
    nextShort: "Tue 13 Oct",
    scores: [
      { what: "CV screen", score: "4 of 5", who: "Diane Ingabire" },
      { what: "Phone screen", score: "4 of 5", who: "Joseph Habimana" },
    ],
  },
  {
    id: "c5",
    name: "Moses Kayitare",
    vacancy: "chef",
    role: "Sous chef",
    stage: "offer",
    source: "Careers page",
    applied: "2 Oct",
    consentUntil: "2 Apr 2027",
    talentPool: false,
    next: "Waiting for his answer to the offer",
    nextShort: "Offer sent",
    scores: [
      { what: "Practical test", score: "5 of 5", who: "Joseph Habimana" },
      { what: "Panel interview", score: "4 of 5", who: "Aline Uwase and Joseph Habimana" },
    ],
  },
  {
    id: "c6",
    name: "Clarisse Umutesi",
    vacancy: "audit",
    role: "Night auditor",
    stage: "applied",
    source: "Careers page",
    applied: "9 Oct",
    consentUntil: "9 Apr 2027",
    talentPool: false,
    next: "CV screen by Diane Ingabire",
    nextShort: null,
    scores: [],
  },
  {
    id: "c7",
    name: "Yves Ndayambaje",
    vacancy: "audit",
    role: "Night auditor",
    stage: "screening",
    source: "University of Rwanda job board",
    applied: "30 Sep",
    consentUntil: "30 Mar 2027",
    talentPool: false,
    next: "Numeracy test sent, due 14 Oct",
    nextShort: "Test due 14 Oct",
    scores: [{ what: "CV screen", score: "4 of 5", who: "Diane Ingabire" }],
  },
  {
    id: "c8",
    name: "Nadine Mukarugwiza",
    vacancy: "audit",
    role: "Night auditor",
    stage: "interview",
    source: "Careers page",
    applied: "27 Sep",
    consentUntil: "27 Sep 2027",
    talentPool: true,
    next: "Interview Wed 14 Oct 14:00 with Eric Habimana",
    nextShort: "Wed 14 Oct",
    scores: [
      { what: "Numeracy test", score: "5 of 5", who: "Automatic score" },
      { what: "CV screen", score: "4 of 5", who: "Diane Ingabire" },
    ],
  },
  {
    id: "c9",
    name: "Fabrice Ndayisenga",
    vacancy: "commis",
    role: "Commis chef",
    stage: "hired",
    source: "Careers page",
    applied: "12 Sep",
    consentUntil: "became employee data",
    talentPool: false,
    next: "Onboarding in progress",
    nextShort: "EMP-0146",
    scores: [{ what: "Practical test", score: "4 of 5", who: "Joseph Habimana" }],
  },
];

const interviews: Interview[] = [
  {
    id: "i1",
    when: "Tue 13 Oct 10:00",
    who: "Esther Nyirahabimana",
    what: "Sous chef practical test · Terrace kitchen · Joseph Habimana",
    status: "current",
  },
  {
    id: "i2",
    when: "Wed 14 Oct 14:00",
    who: "Nadine Mukarugwiza",
    what: "Night auditor interview · Eric Habimana and Diane Ingabire",
    status: "default",
  },
  {
    id: "i3",
    when: "Thu 15 Oct 09:00",
    who: "Jean de Dieu Ntwari",
    what: "Sous chef phone screen · Joseph Habimana",
    status: "default",
  },
  {
    id: "i4",
    when: "Fri 16 Oct 11:00",
    who: "Yves Ndayambaje",
    what: "Night auditor interview, if the numeracy test passes",
    status: "default",
  },
];

const onboardingTasks: OnboardingTask[] = [
  { id: "ct", title: "Contract signed", detail: "Permanent, 3-month probation · signed 3 Oct", done: true },
  { id: "id", title: "ID and RSSB number recorded", detail: "Restricted documents · access logged", done: true },
  {
    id: "pay",
    title: "Payment details confirmed by Fabrice",
    detail: "Airtel Money, confirmed in the staff app",
    done: true,
  },
  {
    id: "uni",
    title: "Uniform and locker issued",
    detail: "2 chef jackets, locker 14 · recorded in Staff services",
    done: true,
  },
  {
    id: "pin",
    title: "Kiosk PIN issued",
    detail: "Until then his clock-ins are desk entries by Joseph Habimana",
    done: false,
  },
  {
    id: "med",
    title: "Food handler medical certificate",
    detail: "Required for kitchen work · due 20 Oct",
    done: false,
  },
  { id: "pol", title: "Policies acknowledged", detail: "2 of 4 in the staff app", done: false },
];

const reviewCycle: ReviewCycleMetric[] = [
  { id: "obj", label: "Objectives set", done: 44, total: 46, note: "2 new joiners exempt until probation ends" },
  { id: "self", label: "Self reviews", done: 30, total: 46, note: "Due 20 Oct in the staff app" },
  { id: "f360", label: "360 feedback", done: 86, total: 138, note: "Requests to peers and direct reports" },
  { id: "mgr", label: "Manager reviews", done: 12, total: 46, note: "Open after self reviews close" },
  { id: "owner", label: "Owner sign-off", done: null, total: null, note: "Calibration on 10 Nov" },
];

const reviewDepartments: ReviewDepartment[] = [
  {
    id: "hk",
    name: "Housekeeping",
    objectives: "9 of 9",
    selfReviews: "8 of 9",
    feedback360: "24 of 27",
    managerReviews: "5 of 9",
    status: "On track",
    statusTone: "success",
  },
  {
    id: "fb",
    name: "Food and beverage",
    objectives: "10 of 11",
    selfReviews: "5 of 11",
    feedback360: "18 of 33",
    managerReviews: "2 of 11",
    status: "Behind on self reviews",
    statusTone: "warning",
  },
  {
    id: "fo",
    name: "Front office",
    objectives: "5 of 5",
    selfReviews: "4 of 5",
    feedback360: "12 of 15",
    managerReviews: "3 of 5",
    status: "On track",
    statusTone: "success",
  },
  {
    id: "lodge",
    name: "Ishyamba Forest Lodge",
    objectives: "9 of 10",
    selfReviews: "6 of 10",
    feedback360: "15 of 30",
    managerReviews: "1 of 10",
    status: "360 responses low",
    statusTone: "warning",
  },
  {
    id: "smr",
    name: "Security, maintenance, residence",
    objectives: "11 of 11",
    selfReviews: "7 of 11",
    feedback360: "17 of 33",
    managerReviews: "1 of 11",
    status: "In progress",
    statusTone: "default",
  },
];

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

const helpdeskTickets: HelpdeskTicket[] = [
  {
    id: "HD-231",
    icon: "Receipt",
    title: "September payslip is missing overtime",
    who: "Jean-Paul Niyonsaba",
    topic: "Payroll",
    age: "2 days",
    state: "Open",
    stateTone: "warning",
    hrOnly: true,
    resolved: false,
    link: { label: "Attendance records", board: "Attendance" },
    thread: [
      {
        from: "them",
        text: "My September payslip shows no overtime, but I worked 11 extra hours on the boiler repair at the end of the month.",
        meta: "Jean-Paul · staff app · 10 Oct 19:12",
      },
      {
        from: "system",
        text: "Attendance shows 11 h overtime on 29–30 Sep, approved by Aline Uwase on 2 Oct, after September was confirmed.",
        meta: "Injishi · linked record",
      },
      {
        from: "me",
        text: "Thank you, you are right. It was approved after September closed, so it will be paid as an adjustment line in the November run with this ticket as the reason.",
        meta: "Diane Ingabire · 11 Oct 09:05",
      },
    ],
  },
  {
    id: "HD-229",
    icon: "TShirt",
    title: "Uniform size swap, medium to large",
    who: "Claudine Mukamana",
    topic: "Assets",
    age: "1 day",
    state: "Open",
    stateTone: "warning",
    hrOnly: false,
    resolved: false,
    link: null,
    thread: [
      {
        from: "them",
        text: "The new waiter shirts are too small. Can I swap the two medium shirts for large?",
        meta: "Claudine · staff app · 11 Oct 14:30",
      },
    ],
  },
  {
    id: "HD-228",
    icon: "FileText",
    title: "Employment certificate for a bank loan",
    who: "Jeanne Nyiraneza",
    topic: "Documents",
    age: "due 14 Oct",
    state: "In progress",
    stateTone: "accent",
    hrOnly: true,
    resolved: false,
    link: { label: "Employee file", board: "Employees" },
    thread: [
      {
        from: "them",
        text: "My bank needs a letter confirming my employment and salary for a loan.",
        meta: "Jeanne · staff app · 9 Oct 18:02",
      },
      {
        from: "me",
        text: "I will prepare it. Salary is included only because you asked for it; Didier Mugenzi signs it.",
        meta: "Diane Ingabire · 10 Oct 08:30",
      },
    ],
  },
  {
    id: "HD-226",
    icon: "Display",
    title: "Kiosk does not accept my PIN",
    who: "Aimable Nsengiyumva",
    topic: "Attendance",
    age: "4 days",
    state: "With Injishi support",
    stateTone: "info",
    hrOnly: false,
    resolved: false,
    link: { label: "Attendance records", board: "Attendance" },
    thread: [
      {
        from: "them",
        text: "The lobby kiosk says my PIN is wrong. I clock in with my phone for now.",
        meta: "Aimable · phone · 8 Oct 06:10",
      },
      {
        from: "system",
        text: "Escalated to Injishi support as SUP-4127. Phone clock-ins are recorded with location.",
        meta: "Injishi · 8 Oct 09:00",
      },
    ],
  },
  {
    id: "HD-224",
    icon: "Persons",
    title: "Update my emergency contact",
    who: "Rose Mukandayisenga",
    topic: "Personal data",
    age: "6 Oct",
    state: "Resolved",
    stateTone: "success",
    hrOnly: true,
    resolved: true,
    link: null,
    thread: [
      { from: "them", text: "Please change my emergency contact to my brother.", meta: "Rose · staff app · 5 Oct" },
      { from: "me", text: "Updated after checking with you by phone.", meta: "Diane Ingabire · 6 Oct" },
    ],
  },
];

const staffAssets: StaffAsset[] = [
  {
    id: "mk2",
    icon: "Key",
    name: "Master key MK-02",
    tag: "Isangano floors 1–2",
    holder: "Beatrice Mukandori",
    dept: "Housekeeping",
    custody: "Signed out today 06:55 · back daily by 15:30",
    condition: "Good",
    status: "Out today",
    statusTone: "accent",
    highRisk: true,
    kind: "out",
    returnDue: false,
    note: "Daily sign-in at 15:30",
  },
  {
    id: "bk3",
    icon: "Key",
    name: "Lake Bar keys BK-3",
    tag: "Bar store and cellar",
    holder: "Pacifique Mugabo",
    dept: "Leaving 20 Oct",
    custody: "Held since 6 Mar 2023",
    condition: "Good",
    status: "Due back 20 Oct",
    statusTone: "warning",
    highRisk: true,
    kind: "leaver",
    returnDue: true,
    note: null,
  },
  {
    id: "lk22",
    icon: "Lock",
    name: "Locker key L-22",
    tag: "Staff changing room",
    holder: "Pacifique Mugabo",
    dept: "Leaving 20 Oct",
    custody: "Held since 6 Mar 2023",
    condition: "Good",
    status: "Due back 20 Oct",
    statusTone: "warning",
    highRisk: false,
    kind: "leaver",
    returnDue: true,
    note: null,
  },
  {
    id: "pmu",
    icon: "TShirt",
    name: "Uniform set ×2",
    tag: "Bar staff",
    holder: "Pacifique Mugabo",
    dept: "Leaving 20 Oct",
    custody: "Returned 9 Oct · signed at the kiosk",
    condition: "Good",
    status: "Returned",
    statusTone: "success",
    highRisk: false,
    kind: "leaver",
    returnDue: false,
    note: "Closed",
  },
  {
    id: "ph1",
    icon: "Smartphone",
    name: "Housekeeping phone",
    tag: "Samsung A15 · IMEI ···4471",
    holder: "Beatrice Mukandori",
    dept: "Housekeeping",
    custody: "Since 3 Mar 2025 · staff app installed",
    condition: "Screen scratched",
    status: "On loan",
    statusTone: "default",
    highRisk: false,
    kind: "out",
    returnDue: false,
    note: "Annual check in March",
  },
  {
    id: "jnu",
    icon: "TShirt",
    name: "Uniform set ×2",
    tag: "Room attendant",
    holder: "Jeanne Nyiraneza",
    dept: "Housekeeping",
    custody: "Since 1 Sep 2026",
    condition: "Good",
    status: "On loan",
    statusTone: "default",
    highRisk: false,
    kind: "out",
    returnDue: false,
    note: "Replaced yearly",
  },
  {
    id: "cmu",
    icon: "TShirt",
    name: "Waiter shirts ×2, medium",
    tag: "Linked to HD-229",
    holder: "Claudine Mukamana",
    dept: "Food and beverage",
    custody: "Since 6 Oct 2026",
    condition: "Wrong size",
    status: "Swap requested",
    statusTone: "warning",
    highRisk: false,
    kind: "due",
    returnDue: true,
    note: null,
  },
  {
    id: "r07",
    icon: "AntennaSignal",
    name: "Radio R-07",
    tag: "Security channel 2",
    holder: "Aimable Nsengiyumva",
    dept: "Security",
    custody: "Since 10 Jul 2023 · battery replaced 1 Oct",
    condition: "Good",
    status: "On loan",
    statusTone: "default",
    highRisk: false,
    kind: "out",
    returnDue: false,
    note: "Returned at shift end",
  },
  {
    id: "fnj",
    icon: "TShirt",
    name: "Chef jackets ×2",
    tag: "Kitchen",
    holder: "Fabrice Ndayisenga",
    dept: "Kitchen",
    custody: "Since 6 Oct 2026 · signed at onboarding",
    condition: "New",
    status: "On loan",
    statusTone: "default",
    highRisk: false,
    kind: "out",
    returnDue: false,
    note: "Probation item",
  },
];

const hrReports: HrReport[] = [
  {
    id: "hc",
    icon: "Persons",
    title: "Headcount and turnover",
    detail: "By department and month · 48 staff, 1 leaver this quarter",
    ownerOnly: false,
  },
  {
    id: "abs",
    icon: "Clock",
    title: "Absence and lateness",
    detail: "Names: HR and own line manager only",
    ownerOnly: false,
  },
  {
    id: "liab",
    icon: "Suitcase",
    title: "Leave liability",
    detail: "Days owed by department, no salaries",
    ownerOnly: false,
  },
  {
    id: "ot",
    icon: "ChartColumn",
    title: "Overtime hours",
    detail: "Hours by department and week, not pay",
    ownerOnly: false,
  },
  {
    id: "cost",
    icon: "Sack",
    title: "Payroll cost by property",
    detail: "Totals with employer contributions",
    ownerOnly: true,
  },
];

const hrAutomations: HrAutomation[] = [
  {
    id: "exp",
    title: "Contract-expiry reminders",
    detail: "30 days before a contract ends",
    privacy: "Shares name, role and end date. Never salary.",
    lastRun: "Today 06:00 · 2 reminders",
    enabled: true,
  },
  {
    id: "prob",
    title: "Probation ending",
    detail: "14 days before probation ends",
    privacy: "Shares name and probation end date only.",
    lastRun: "Today 06:00 · 1 reminder",
    enabled: true,
  },
  {
    id: "doc",
    title: "Document expiry",
    detail: "21 days before a document expires",
    privacy: "Says which document, never its contents.",
    lastRun: "Today 06:00 · 1 reminder",
    enabled: true,
  },
  {
    id: "leaver",
    title: "Leaver access reminder",
    detail: "Last day · owner revokes access",
    privacy: "Goes to the owner only.",
    lastRun: "Next: Pacifique Mugabo, 20 Oct 09:00",
    enabled: true,
  },
  {
    id: "bday",
    title: "Birthday greetings in the staff app",
    detail: "Team channel, on the day",
    privacy: "Only for staff who opted in · 12 of 48 have.",
    lastRun: null,
    enabled: false,
  },
  {
    id: "anniv",
    title: "Work anniversaries",
    detail: "Announced to the whole team",
    privacy: "Reveals start dates to colleagues · opt-in required.",
    lastRun: null,
    enabled: false,
  },
];

export const fixtures = {
  "payroll.payRunState": payRunState,
  "payroll.payRates": payRates,
  "payroll.payLines": payLines,
  "payroll.payRunSteps": payRunSteps,
  "payroll.payRunExceptions": payRunExceptions,
  "payroll.payRunRules": payRunRules,
  "payroll.payRunTotals": payRunTotals,
  "payroll.finalSettlements": finalSettlements,
  "payroll.paymentFiles": paymentFiles,
  "payroll.payRunOutputs": payRunOutputs,
  "payroll.payRunHistory": payRunHistory,
  "payroll.ruleSets": ruleSets,
  "payroll.ruleGovernance": ruleGovernance,
  "payroll.vacancies": vacancies,
  "payroll.candidates": candidates,
  "payroll.interviews": interviews,
  "payroll.onboardingTasks": onboardingTasks,
  "payroll.reviewCycle": reviewCycle,
  "payroll.reviewDepartments": reviewDepartments,
  "payroll.helpdeskTickets": helpdeskTickets,
  "payroll.staffAssets": staffAssets,
  "payroll.hrReports": hrReports,
  "payroll.hrAutomations": hrAutomations,
} satisfies FixtureSet;
