import type { BoardId, FixtureSet, IconName } from "../types.ts";

/**
 * Embedded-database fixtures for the "people" area (HR workforce): People · home (PeopleHome),
 * Employees and files (Employees), Roster, Attendance and Leave.
 * Collection names are "people.<thing>"; every document has a stable string `id`.
 * Values are lifted verbatim from the artifact boards (node tools/artifact/extract.mjs <Board>).
 */

export type Tone = "accent" | "success" | "warning" | "danger" | "default" | "info";

// ── Shared ───────────────────────────────────────────────────────────────────

export type PropertyId = "isangano" | "ishyamba" | "kacyiru";

export interface PeopleProperty {
  id: PropertyId;
  /** "Isangano Lakeside Hotel" */
  name: string;
  /** "Isangano" — segment and table label */
  short: string;
}

// ── People · home ────────────────────────────────────────────────────────────

export interface PresenceIssue {
  name: string;
  why: string;
}

/** Who is in now, per department (kiosk, phone and desk clock-ins this morning). */
export interface DeptPresence {
  id: string;
  name: string;
  property: PropertyId;
  /** On shift and on time. */
  present: string[];
  late: PresenceIssue[];
  /** `explained`: called in / certificate to follow; otherwise no clock-in and no leave recorded. */
  absent: (PresenceIssue & { explained: boolean })[];
}

/** Shift below minimum cover in the next 7 days. */
export interface RosterGap {
  id: string;
  property: PropertyId;
  day: string;
  dept: string;
  detail: string;
  covered: number;
  needed: number;
}

export interface PayRunSummary {
  id: string;
  title: string;
  entities: string;
  payDate: string;
  status: string;
  statusTone: Tone;
  steps: string[];
  /** Index of the active step (earlier steps are complete). */
  currentStep: number;
  submittedTo: string;
  submittedAt: string;
  staffPaid: number;
  leavers: number;
  gross: number;
  net: number;
  ruleVersion: string;
  ruleStatus: string;
}

export interface ExpiringItem {
  id: string;
  status: "warning" | "current" | "default";
  icon: IconName;
  title: string;
  detail: string;
  board: BoardId;
  /** Employee file to open on the Employees screen, when the person has one in the directory. */
  employee: string | null;
}

export interface HelpdeskTicket {
  id: string;
  icon: IconName;
  title: string;
  who: string;
  age: string;
  state: string;
  tone: Tone;
}

// ── Employees ────────────────────────────────────────────────────────────────

export type EmployeeStatus = "active" | "leave" | "leaving" | "probation";

export interface Employee {
  id: string;
  name: string;
  /** Employee number, "EMP-0117". */
  no: string;
  position: string;
  grade: string;
  dept: string;
  property: PropertyId;
  manager: string;
  contract: string;
  contractShort: string;
  contractDates: string;
  status: EmployeeStatus;
  /** Linked Injishi user account, or null when the employee has no login. */
  login: string | null;
  base: number;
  allowance: number;
  since: string;
  payMethod: string;
  alsoRostered: string;
  employer: string;
}

export interface CompensationChange {
  id: string;
  employeeId: string;
  effective: string;
  base: number;
  allowance: number;
  reason: string;
  approvedBy: string;
}

/** A document kept on every employee file. `{since}` is replaced with the employee's start date. */
export interface FileDocument {
  id: string;
  icon: IconName;
  title: string;
  meta: string;
}

/** Earlier views of an employee file. `{first}` is replaced with the employee's first name. */
export interface FileAccess {
  id: string;
  what: string;
  when: string;
}

export interface FamilyMember {
  id: string;
  employeeId: string;
  name: string;
  relation: string;
  role: string;
}

export interface PolicyAck {
  id: string;
  title: string;
  meta: string;
  state: string;
  tone: Tone;
}

export interface OrgNode {
  id: string;
  name: string;
  role: string;
  count: string;
  /** 0 = owner, 1 = reports to the owner, 2 = team lead under a manager. */
  level: number;
}

export interface OffboardingTask {
  id: string;
  title: string;
  detail: string;
  /** Owner-only step: HR sees it but cannot tick it. */
  ownerOnly: boolean;
  done: boolean;
  board: BoardId | null;
  linkLabel: string | null;
}

// ── Roster ───────────────────────────────────────────────────────────────────

/** M morning 07–15 · E evening 15–23 · N night 23–07 · O day off · L leave. */
export type ShiftCode = "M" | "E" | "N" | "O" | "L";
export type WeekId = "this" | "next";

export interface RosterGroup {
  id: string;
  name: string;
  /** Label of the cover row ("Morning cover"). */
  rule: string;
  /** Shift codes that count toward the cover row. */
  shifts: ShiftCode[];
  /** Minimum cover Monday → Sunday. */
  min: number[];
  note: string;
}

export interface RosterStaff {
  id: string;
  group: string;
  name: string;
  role: string;
  rotation: string;
  /** Seven shift codes, Monday → Sunday, per week. */
  shifts: Record<WeekId, string>;
}

export interface RosterWeek {
  id: WeekId;
  number: number;
  /** Day of October the week starts on. */
  start: number;
  label: string;
  segment: string;
  range: string;
  status: "published" | "draft";
  publishedAt: string | null;
  /** Shifts lent to Ishyamba Forest Lodge, as "<staffId>-<dayIndex>". */
  lent: string[];
}

export interface ShiftSwap {
  id: string;
  a: string;
  b: string;
  day: number;
  title: string;
  detail: string;
}

export interface Rotation {
  id: string;
  code: string;
  name: string;
  who: string;
  staff: number;
  /** Short pattern per rotation code, shown when editing a shift ("Rotation A · Weekends off."). */
  patterns: Record<string, string>;
}

export interface PublicHoliday {
  id: string;
  name: string;
  date: string;
  rostered: string;
}

// ── Attendance ───────────────────────────────────────────────────────────────

export type ClockSource = "kiosk" | "phone" | "desk";

export interface ClockRecord {
  id: string;
  day: "today" | "yesterday";
  name: string;
  dept: string;
  property: string;
  shift: string;
  clockIn: string;
  source: ClockSource | null;
  sourceNote: string;
  clockOut: string;
  status: string;
  tone: Tone;
  /** Set on desk entries added from the Attendance screen (ISO time); newest show first. */
  addedAt?: string;
  /** Desk entries: date typed by HR, reason picked and the justification on file. */
  date?: string;
  reason?: string;
  justification?: string;
}

export interface ClockCorrection {
  id: string;
  name: string;
  when: string;
  from: string;
  to: string;
  reason: string;
  evidence: string;
  manager: string;
  state: "pending" | "approved" | "declined";
  /** Outcome note once decided. */
  outcome: string | null;
  /** HR's reason when declining, sent to the employee and the line manager. */
  hrNote?: string | null;
}

export interface AttendanceException {
  id: string;
  kind: "absent" | "late" | "missed";
  icon: IconName;
  title: string;
  detail: string;
  state: string;
  tone: Tone;
  /** Desk-entry employee this exception can be fixed for. */
  deskEmployee: string | null;
  /** Correction request that resolves this exception when approved. */
  correction: string | null;
  resolvedDetail: string | null;
}

export interface DeskEmployee {
  id: string;
  label: string;
  name: string;
  dept: string;
  property: string;
  shift: string;
}

export interface AttendanceSummary {
  id: string;
  clockedIn: number;
  rostered: number;
  lateNote: string;
  missedDay: string;
  kiosk: number;
  phone: number;
  desk: number;
  grace: string;
  yesterdayNote: string;
}

// ── Leave ────────────────────────────────────────────────────────────────────

/** Where the request sits in "line manager first, then HR". */
export type LeaveStep = "hr" | "lm" | "approved" | "declined" | "lmdeclined";

export interface LeaveRequest {
  id: string;
  name: string;
  dept: string;
  type: string;
  /** Shorter type shown on People · home ("Circumstantial leave · wedding"). */
  homeType: string;
  dates: string;
  days: number;
  /** "9 Oct · staff app" */
  sub: string;
  /** Line manager. */
  lm: string;
  lmNote: string;
  step: LeaveStep;
  /** HR decision taken in the app (overrides `step`). */
  hrDecision: "approved" | "declined" | null;
  hrReason: string | null;
  /** People · home approval chip ("Beatrice approved · now with you"). */
  homeStep: string;
  /** People · home: balance after the leave ("8.5 days"). */
  balanceAfter: string;
  /** People · home roster warning. */
  homeWarn: string;
  balance: string;
  roster: string;
  attach: string;
  warn: string;
  by: string | null;
  /** Calendar bar: [first day index from 12 Oct, number of days]. */
  cal: [number, number] | null;
}

export interface LeaveBalance {
  id: string;
  name: string;
  carried: number;
  accrued: number;
  taken: number;
  pending: number;
  sick: number;
  /** Request whose days are pending in this balance. */
  request: string | null;
}

export interface LeaveType {
  id: string;
  name: string;
  paid: string;
  accrual: string;
  carry: string;
  flow: string;
  status: string;
  /** Owner-approved business policy (true) or a statutory value still unverified (false). */
  verified: boolean;
}

/** Approved leave that shows on the calendar without a request in this list. */
export interface LeaveCalendarEntry {
  id: string;
  name: string;
  type: string;
  step: "approved";
  cal: [number, number];
}

// ── Data ─────────────────────────────────────────────────────────────────────

const properties: PeopleProperty[] = [
  { id: "isangano", name: "Isangano Lakeside Hotel", short: "Isangano" },
  { id: "ishyamba", name: "Ishyamba Forest Lodge", short: "Ishyamba" },
  { id: "kacyiru", name: "Kacyiru Court Residences", short: "Kacyiru Court" },
];

const presence: DeptPresence[] = [
  {
    id: "fo",
    name: "Front office",
    property: "isangano",
    present: ["Eric Habimana", "Ange Mutoni"],
    late: [],
    absent: [],
  },
  {
    id: "hk",
    name: "Housekeeping",
    property: "isangano",
    present: [
      "Beatrice Mukandori",
      "Jeanne Nyiraneza",
      "Vestine Uwimana",
      "Josiane Mukeshimana",
      "Eugenie Nyirahabimana",
      "Chantal Uwera",
    ],
    late: [],
    absent: [{ name: "Odette Mukamazimpaka", why: "called in sick 06:40, certificate to follow", explained: true }],
  },
  {
    id: "fb",
    name: "Food and beverage",
    property: "isangano",
    present: ["Joseph Habimana", "Fabrice Ndayisenga", "Pacifique Mugabo", "Alphonse Bizimana", "Yvonne Uwase"],
    late: [{ name: "Claudine Mukamana", why: "in 07:18 for 07:00 · kiosk" }],
    absent: [],
  },
  { id: "mt", name: "Maintenance", property: "isangano", present: ["Jean-Paul Niyonsaba"], late: [], absent: [] },
  {
    id: "sc",
    name: "Security",
    property: "isangano",
    present: ["Emmanuel Nkusi"],
    late: [{ name: "Aimable Nsengiyumva", why: "in 06:22 for 06:00 · phone" }],
    absent: [],
  },
  {
    id: "lo",
    name: "Lodge operations",
    property: "ishyamba",
    present: [
      "Theogene Habiyaremye",
      "Claudette Ingabire",
      "Felix Munyaneza",
      "Esperance Nyiramana",
      "Olivier Mugisha",
    ],
    late: [],
    absent: [{ name: "Damascene Tuyisenge", why: "no clock-in and no leave recorded", explained: false }],
  },
  {
    id: "lk",
    name: "Lodge kitchen",
    property: "ishyamba",
    present: ["Rose Mukandayisenga", "Celestin Ndagijimana"],
    late: [],
    absent: [],
  },
  {
    id: "rs",
    name: "Residence services",
    property: "kacyiru",
    present: ["Solange Uwimana", "Innocent Habimana", "Gaspard Rukundo"],
    late: [],
    absent: [],
  },
];

const rosterGaps: RosterGap[] = [
  {
    id: "g-hk-sat17",
    property: "isangano",
    day: "Sat 17 Oct",
    dept: "Housekeeping, Isangano",
    detail: "Morning 07:00–15:00 · needs 8 room attendants, 6 rostered",
    covered: 6,
    needed: 8,
  },
  {
    id: "g-sc-fri16",
    property: "isangano",
    day: "Fri 16 Oct",
    dept: "Security, Isangano",
    detail: "Night 23:00–07:00 · only one guard rostered",
    covered: 1,
    needed: 2,
  },
  {
    id: "g-lk-wed14",
    property: "ishyamba",
    day: "Wed 14 Oct",
    dept: "Lodge kitchen, Ishyamba",
    detail: "Evening 14:00–22:00 · Celestin on annual leave",
    covered: 1,
    needed: 2,
  },
];

const payRunSummary: PayRunSummary[] = [
  {
    id: "2026-10",
    title: "October 2026 Pay Run",
    entities: "Amahoro Hospitality Ltd and Amahoro Residences Ltd",
    payDate: "Fri 23 Oct",
    status: "Awaiting confirmation",
    statusTone: "warning",
    steps: ["Draft", "Review", "Owner confirmation", "Payment files", "Payslips"],
    currentStep: 2,
    submittedTo: "Didier Mugenzi",
    submittedAt: "Fri 9 Oct at 16:40",
    staffPaid: 48,
    leavers: 1,
    gross: 26840000,
    net: 19844880,
    ruleVersion: "PAYE v2026-01",
    ruleStatus: "awaiting sign-off",
  },
];

const expiring: ExpiringItem[] = [
  {
    id: "x-claudine-contract",
    status: "warning",
    icon: "FileText",
    title: "Claudine Mukamana · fixed-term contract ends 31 Oct",
    detail: "Joseph Habimana recommends renewal for 12 months",
    board: "Employees",
    employee: "cm",
  },
  {
    id: "x-yvonne-probation",
    status: "warning",
    icon: "Hourglass",
    title: "Yvonne Uwase · probation ends 20 Oct",
    detail: "Review form not returned by her line manager yet",
    board: "Talent",
    employee: null,
  },
  {
    id: "x-pacifique-leaving",
    status: "current",
    icon: "ArrowRightFromSquare",
    title: "Pacifique Mugabo · leaving 20 Oct",
    detail: "Offboarding 2 of 6 done · final settlement in October run",
    board: "Employees",
    employee: "pm",
  },
  {
    id: "x-rose-certificate",
    status: "default",
    icon: "Stethoscope",
    title: "Rose Mukandayisenga · food handler certificate expires 2 Nov",
    detail: "Required for kitchen work · renewal reminder sent",
    board: "Employees",
    employee: null,
  },
  {
    id: "x-celestin-contract",
    status: "default",
    icon: "FileText",
    title: "Celestin Ndagijimana · contract ends 15 Nov",
    detail: "No renewal decision recorded",
    board: "Employees",
    employee: null,
  },
];

const tickets: HelpdeskTicket[] = [
  {
    id: "HD-231",
    icon: "Receipt",
    title: "September payslip is missing overtime",
    who: "Jean-Paul Niyonsaba",
    age: "2 days",
    state: "Open",
    tone: "warning",
  },
  {
    id: "HD-228",
    icon: "FileText",
    title: "Employment certificate for a bank loan",
    who: "Jeanne Nyiraneza",
    age: "due 14 Oct",
    state: "In progress",
    tone: "accent",
  },
  {
    id: "HD-229",
    icon: "TShirt",
    title: "Uniform size swap, medium to large",
    who: "Claudine Mukamana",
    age: "1 day",
    state: "Open",
    tone: "warning",
  },
];

const AHL = "Amahoro Hospitality Ltd · TIN 102 345 678";

const employees: Employee[] = [
  {
    id: "jn",
    name: "Jeanne Nyiraneza",
    no: "EMP-0117",
    position: "Room attendant",
    grade: "H2",
    dept: "Housekeeping",
    property: "isangano",
    manager: "Beatrice Mukandori, housekeeping supervisor",
    contract: "Permanent",
    contractShort: "Since 4 Mar 2024",
    contractDates: "Open-ended from 4 Mar 2024 · probation ended 4 Jun 2024",
    status: "active",
    login: "jeanne.n · Housekeeper role at Isangano · last sign-in today 07:01",
    base: 180000,
    allowance: 30000,
    since: "4 Mar 2024",
    payMethod: "MTN MoMo ···412",
    alsoRostered: "Ishyamba Forest Lodge (approved cover)",
    employer: AHL,
  },
  {
    id: "bm",
    name: "Beatrice Mukandori",
    no: "EMP-0042",
    position: "Housekeeping supervisor",
    grade: "H4",
    dept: "Housekeeping",
    property: "isangano",
    manager: "Aline Uwase, general manager",
    contract: "Permanent",
    contractShort: "Since 1 Feb 2021",
    contractDates: "Open-ended from 1 Feb 2021",
    status: "active",
    login: "beatrice.m · Housekeeper role (supervisor) at Isangano",
    base: 320000,
    allowance: 50000,
    since: "1 Feb 2021",
    payMethod: "Bank of Kigali ···7781",
    alsoRostered: "None",
    employer: AHL,
  },
  {
    id: "od",
    name: "Odette Mukamazimpaka",
    no: "EMP-0131",
    position: "Room attendant",
    grade: "H2",
    dept: "Housekeeping",
    property: "isangano",
    manager: "Beatrice Mukandori, housekeeping supervisor",
    contract: "Permanent",
    contractShort: "Since 9 Sep 2024",
    contractDates: "Open-ended from 9 Sep 2024",
    status: "leave",
    login: null,
    base: 165000,
    allowance: 25000,
    since: "9 Sep 2024",
    payMethod: "MTN MoMo ···208",
    alsoRostered: "None",
    employer: AHL,
  },
  {
    id: "eh",
    name: "Eric Habimana",
    no: "EMP-0058",
    position: "Front desk agent",
    grade: "F3",
    dept: "Front office",
    property: "isangano",
    manager: "Aline Uwase, general manager",
    contract: "Permanent",
    contractShort: "Since 15 Jun 2022",
    contractDates: "Open-ended from 15 Jun 2022",
    status: "active",
    login: "eric.h · Front desk role at Isangano",
    base: 280000,
    allowance: 40000,
    since: "15 Jun 2022",
    payMethod: "GT Bank ···0193",
    alsoRostered: "None",
    employer: AHL,
  },
  {
    id: "jh",
    name: "Joseph Habimana",
    no: "EMP-0066",
    position: "Outlet supervisor",
    grade: "B4",
    dept: "Food and beverage",
    property: "isangano",
    manager: "Aline Uwase, general manager",
    contract: "Permanent",
    contractShort: "Since 3 Jan 2022",
    contractDates: "Open-ended from 3 Jan 2022",
    status: "active",
    login: "joseph.h · Outlet supervisor at Isangano Terrace",
    base: 350000,
    allowance: 50000,
    since: "3 Jan 2022",
    payMethod: "Bank of Kigali ···3320",
    alsoRostered: "Lake Bar",
    employer: AHL,
  },
  {
    id: "cm",
    name: "Claudine Mukamana",
    no: "EMP-0124",
    position: "Waiter",
    grade: "B2",
    dept: "Food and beverage",
    property: "isangano",
    manager: "Joseph Habimana, outlet supervisor",
    contract: "Fixed-term",
    contractShort: "Ends 31 Oct 2026",
    contractDates: "1 Nov 2025 to 31 Oct 2026 · renewal recommended",
    status: "active",
    login: null,
    base: 150000,
    allowance: 25000,
    since: "1 Nov 2025",
    payMethod: "MTN MoMo ···655",
    alsoRostered: "Lake Bar",
    employer: AHL,
  },
  {
    id: "pm",
    name: "Pacifique Mugabo",
    no: "EMP-0098",
    position: "Barman",
    grade: "B2",
    dept: "Food and beverage",
    property: "isangano",
    manager: "Joseph Habimana, outlet supervisor",
    contract: "Permanent",
    contractShort: "Last day 20 Oct",
    contractDates: "Open-ended from 6 Mar 2023 · resigned 20 Sep, last day 20 Oct 2026",
    status: "leaving",
    login: "pacifique.m · revocation scheduled by the owner for 20 Oct 23:59",
    base: 170000,
    allowance: 25000,
    since: "6 Mar 2023",
    payMethod: "MTN MoMo ···874",
    alsoRostered: "Isangano Terrace",
    employer: AHL,
  },
  {
    id: "fn",
    name: "Fabrice Ndayisenga",
    no: "EMP-0146",
    position: "Commis chef",
    grade: "K1",
    dept: "Kitchen",
    property: "isangano",
    manager: "Joseph Habimana, outlet supervisor",
    contract: "Permanent",
    contractShort: "Probation to 6 Jan",
    contractDates: "Open-ended from 6 Oct 2026 · probation to 6 Jan 2027",
    status: "probation",
    login: null,
    base: 200000,
    allowance: 25000,
    since: "6 Oct 2026",
    payMethod: "Airtel Money ···031",
    alsoRostered: "None",
    employer: AHL,
  },
  {
    id: "jp",
    name: "Jean-Paul Niyonsaba",
    no: "EMP-0051",
    position: "Maintenance technician",
    grade: "M3",
    dept: "Maintenance",
    property: "isangano",
    manager: "Aline Uwase, general manager",
    contract: "Permanent",
    contractShort: "Since 2 May 2022",
    contractDates: "Open-ended from 2 May 2022",
    status: "active",
    login: "jeanpaul.n · Technician at Isangano",
    base: 260000,
    allowance: 40000,
    since: "2 May 2022",
    payMethod: "Equity Bank ···5512",
    alsoRostered: "Ishyamba Forest Lodge",
    employer: AHL,
  },
  {
    id: "an",
    name: "Aimable Nsengiyumva",
    no: "EMP-0109",
    position: "Security guard",
    grade: "S1",
    dept: "Security",
    property: "isangano",
    manager: "Emmanuel Nkusi, security lead",
    contract: "Permanent",
    contractShort: "Since 10 Jul 2023",
    contractDates: "Open-ended from 10 Jul 2023",
    status: "active",
    login: null,
    base: 160000,
    allowance: 20000,
    since: "10 Jul 2023",
    payMethod: "MTN MoMo ···390",
    alsoRostered: "None",
    employer: AHL,
  },
  {
    id: "th",
    name: "Theogene Habiyaremye",
    no: "EMP-0033",
    position: "Lodge manager",
    grade: "G5",
    dept: "Lodge operations",
    property: "ishyamba",
    manager: "Didier Mugenzi, owner",
    contract: "Permanent",
    contractShort: "Since 1 Aug 2020",
    contractDates: "Open-ended from 1 Aug 2020",
    status: "active",
    login: "theogene.h · Manager role at Ishyamba",
    base: 650000,
    allowance: 120000,
    since: "1 Aug 2020",
    payMethod: "Bank of Kigali ···1047",
    alsoRostered: "None",
    employer: AHL,
  },
  {
    id: "su",
    name: "Solange Uwimana",
    no: "EMP-0201",
    position: "Residence manager",
    grade: "G4",
    dept: "Residence services",
    property: "kacyiru",
    manager: "Didier Mugenzi, owner",
    contract: "Permanent",
    contractShort: "Since 1 Apr 2024",
    contractDates: "Open-ended from 1 Apr 2024",
    status: "active",
    login: "solange.u · Residence manager at Kacyiru Court",
    base: 520000,
    allowance: 80000,
    since: "1 Apr 2024",
    payMethod: "I&M Bank ···6620",
    alsoRostered: "None",
    employer: "Amahoro Residences Ltd · TIN 102 345 990",
  },
];

/** Jeanne's full history; everyone else has an annual review on 1 Mar 2026 and their hire offer. */
const compensation: CompensationChange[] = [
  {
    id: "jn-2026-09",
    employeeId: "jn",
    effective: "1 Sep 2026",
    base: 180000,
    allowance: 30000,
    reason: "Annual review · transport allowance raised",
    approvedBy: "Approved by Didier Mugenzi, 28 Aug",
  },
  {
    id: "jn-2025-03",
    employeeId: "jn",
    effective: "1 Mar 2025",
    base: 165000,
    allowance: 25000,
    reason: "End of first year",
    approvedBy: "Approved by Didier Mugenzi, 20 Feb 2025",
  },
  {
    id: "jn-hire",
    employeeId: "jn",
    effective: "4 Mar 2024",
    base: 150000,
    allowance: 25000,
    reason: "Hire",
    approvedBy: "Offer approved by Didier Mugenzi",
  },
  ...employees
    .filter((e) => e.id !== "jn")
    .flatMap((e) => [
      {
        id: `${e.id}-2026-03`,
        employeeId: e.id,
        effective: "1 Mar 2026",
        base: e.base,
        allowance: e.allowance,
        reason: "Annual review",
        approvedBy: "Approved by Didier Mugenzi",
      },
      {
        id: `${e.id}-hire`,
        employeeId: e.id,
        effective: e.since,
        base: Math.round((e.base * 0.92) / 1000) * 1000,
        allowance: e.allowance,
        reason: "Hire",
        approvedBy: "Offer approved by Didier Mugenzi",
      },
    ]),
];

const fileDocuments: FileDocument[] = [
  { id: "id", icon: "Passport", title: "National ID copy", meta: "Uploaded at hire · identity" },
  { id: "ct", icon: "FileText", title: "Signed employment contract", meta: "Signed {since} · version on file" },
  { id: "pay", icon: "Wallet", title: "Payment details form", meta: "Confirmed by the employee in the staff app" },
  {
    id: "med",
    icon: "Stethoscope",
    title: "Medical fitness certificate",
    meta: "Health record · HR only, not the owner",
  },
  { id: "cv", icon: "GraduationCap", title: "Certificates and CV", meta: "From recruitment, kept with consent" },
];

const fileAccess: FileAccess[] = [
  {
    id: "a-2026-10-03",
    what: "Diane Ingabire viewed signed employment contract",
    when: "3 Oct 2026 · 10:12 · reason: contract renewal check",
  },
  { id: "a-2026-09-02", what: "{first} viewed own payslips and contract in the staff app", when: "2 Sep 2026 · 19:40" },
  {
    id: "a-2026-08-28",
    what: "Didier Mugenzi viewed compensation history",
    when: "28 Aug 2026 · 08:05 · reason: annual review",
  },
];

const family: FamilyMember[] = [
  {
    id: "jn-spouse",
    employeeId: "jn",
    name: "Innocent Nshuti",
    relation: "Spouse · emergency contact +250 788 ··· 903",
    role: "Beneficiary 60%",
  },
  {
    id: "jn-kevine",
    employeeId: "jn",
    name: "Kevine Ishimwe",
    relation: "Daughter · born 2017 · medical scheme dependant",
    role: "Beneficiary 40%",
  },
  {
    id: "jn-gaelle",
    employeeId: "jn",
    name: "Gaelle Uwase",
    relation: "Daughter · born 2021 · medical scheme dependant",
    role: "Dependant",
  },
];

const policies: PolicyAck[] = [
  {
    id: "conduct-v3",
    title: "Code of conduct · v3",
    meta: "Acknowledged 2 Mar 2026 in the staff app",
    state: "Acknowledged",
    tone: "success",
  },
  {
    id: "privacy-v2",
    title: "Guest privacy and data protection · v2",
    meta: "Acknowledged 2 Mar 2026",
    state: "Acknowledged",
    tone: "success",
  },
  {
    id: "safety-v4",
    title: "Health and safety · v4",
    meta: "Acknowledged 10 Jan 2026",
    state: "Acknowledged",
    tone: "success",
  },
  {
    id: "uniform-v2",
    title: "Uniform and grooming · v2",
    meta: "Sent 8 Oct 2026 · reminder goes out on 15 Oct",
    state: "Not yet",
    tone: "warning",
  },
];

const orgChart: OrgNode[] = [
  { id: "o-didier", name: "Didier Mugenzi", role: "Owner · Amahoro Hospitality Group", count: "48 staff", level: 0 },
  { id: "o-aline", name: "Aline Uwase", role: "General manager · Isangano Lakeside Hotel", count: "32", level: 1 },
  { id: "o-eric", name: "Eric Habimana", role: "Front office lead", count: "5", level: 2 },
  { id: "o-beatrice", name: "Beatrice Mukandori", role: "Housekeeping supervisor", count: "9", level: 2 },
  {
    id: "o-joseph",
    name: "Joseph Habimana",
    role: "Outlet supervisor · Terrace, Lake Bar, kitchen",
    count: "11",
    level: 2,
  },
  { id: "o-jeanpaul", name: "Jean-Paul Niyonsaba", role: "Maintenance", count: "2", level: 2 },
  { id: "o-emmanuel", name: "Emmanuel Nkusi", role: "Security lead", count: "4", level: 2 },
  {
    id: "o-theogene",
    name: "Theogene Habiyaremye",
    role: "Lodge manager · Ishyamba Forest Lodge",
    count: "10",
    level: 1,
  },
  {
    id: "o-solange",
    name: "Solange Uwimana",
    role: "Residence manager · Amahoro Residences Ltd",
    count: "4",
    level: 1,
  },
  { id: "o-diane", name: "Diane Ingabire", role: "HR officer", count: "1", level: 1 },
  { id: "o-grace", name: "Grace Uwera", role: "Finance", count: "1", level: 1 },
];

const offboarding: OffboardingTask[] = [
  {
    id: "letter",
    title: "Resignation accepted and filed",
    detail: "Letter dated 20 Sep · accepted by Joseph Habimana",
    ownerOnly: false,
    done: true,
    board: null,
    linkLabel: null,
  },
  {
    id: "interview",
    title: "Exit interview",
    detail: "Scheduled Fri 16 Oct with Diane Ingabire · answers kept anonymous in reports",
    ownerOnly: false,
    done: false,
    board: null,
    linkLabel: null,
  },
  {
    id: "settle",
    title: "Final settlement calculated",
    detail: "Pro-rata pay to 20 Oct, 6 untaken leave days, advance recovery RWF 35,000 · in the October run",
    ownerOnly: false,
    done: true,
    board: "PayRun",
    linkLabel: "Open pay run",
  },
  {
    id: "assets",
    title: "Assets returned",
    detail: "1 of 3 back · uniforms returned; Lake Bar keys and locker key outstanding",
    ownerOnly: false,
    done: false,
    board: "StaffServices",
    linkLabel: "Assets",
  },
  {
    id: "access",
    title: "Injishi access revoked",
    detail: "Owner action · scheduled by Didier Mugenzi for 20 Oct 23:59 · kiosk PIN disabled at the same time",
    ownerOnly: true,
    done: false,
    board: null,
    linkLabel: null,
  },
  {
    id: "cert",
    title: "Certificate of service issued",
    detail: "Generated from the file and signed by the owner on the last day",
    ownerOnly: false,
    done: false,
    board: null,
    linkLabel: null,
  },
];

const rosterGroups: RosterGroup[] = [
  {
    id: "hk",
    name: "Housekeeping",
    rule: "Morning cover",
    shifts: ["M"],
    min: [5, 5, 5, 5, 6, 8, 6],
    note: "minimum set by Beatrice Mukandori",
  },
  {
    id: "fo",
    name: "Front office",
    rule: "Desk cover",
    shifts: ["M", "E", "N"],
    min: [2, 2, 2, 2, 2, 2, 2],
    note: "minimum set by Aline Uwase",
  },
  {
    id: "sc",
    name: "Security",
    rule: "Night cover",
    shifts: ["N"],
    min: [1, 1, 1, 1, 2, 2, 1],
    note: "two guards on Friday and Saturday nights",
  },
];

const staff = (
  id: string,
  group: string,
  name: string,
  role: string,
  rotation: string,
  base: string,
  next = base,
): RosterStaff => ({ id, group, name, role, rotation, shifts: { this: base, next } });

const rosterStaff: RosterStaff[] = [
  staff("bm", "hk", "Beatrice Mukandori", "Supervisor", "A", "MMMMMOO"),
  staff("jn", "hk", "Jeanne Nyiraneza", "Room attendant", "B", "MMOOMMM"),
  staff("vu", "hk", "Vestine Uwimana", "Room attendant", "C", "OOMMMMM"),
  staff("jm", "hk", "Josiane Mukeshimana", "Room attendant", "A", "MMMMMOO"),
  staff("en", "hk", "Eugenie Nyirahabimana", "Room attendant", "B", "MMOOMMM"),
  staff("cu", "hk", "Chantal Uwera", "Room attendant", "D", "MMMMOOM"),
  staff("om", "hk", "Odette Mukamazimpaka", "Room attendant", "B", "LLOOMMM", "MMOOMMM"),
  staff("lu", "hk", "Liliane Umutoni", "Room attendant", "C", "OOMMMMM"),
  staff("gm", "hk", "Grace Mukansanga", "Turndown attendant", "E", "EEEOOMM"),
  staff("eh", "fo", "Eric Habimana", "Front desk agent", "A", "MMMMMOO"),
  staff("am", "fo", "Ange Mutoni", "Front desk agent", "B", "EEOOEEE"),
  staff("du", "fo", "Divine Uwamahoro", "Front desk agent", "C", "OOEEEMM"),
  staff("ek", "sc", "Emmanuel Nkusi", "Security lead", "A", "MMMMMOO"),
  staff("an", "sc", "Aimable Nsengiyumva", "Guard", "N1", "NNNOONN"),
  staff("jc", "sc", "Jean Claude Hategekimana", "Guard", "N2", "OONNNNO"),
];

const rosterWeeks: RosterWeek[] = [
  {
    id: "this",
    number: 42,
    start: 12,
    label: "Week 42 · Mon 12 – Sun 18 October 2026",
    segment: "This week · 12–18 Oct",
    range: "12–18 October",
    status: "published",
    publishedAt: "Thu 8 Oct",
    lent: ["lu-4"],
  },
  {
    id: "next",
    number: 43,
    start: 19,
    label: "Week 43 · Mon 19 – Sun 25 October 2026",
    segment: "Next week · 19–25 Oct",
    range: "19–25 October",
    status: "draft",
    publishedAt: null,
    lent: [],
  },
];

const shiftSwaps: ShiftSwap[] = [
  {
    id: "s1",
    a: "am",
    b: "du",
    day: 5,
    title: "Ange Mutoni ⇄ Divine Uwamahoro · Sat 17",
    detail: "Ange takes the morning, Divine the evening. Eric Habimana agreed.",
  },
  {
    id: "s2",
    a: "jn",
    b: "jm",
    day: 3,
    title: "Jeanne Nyiraneza ⇄ Josiane Mukeshimana · Thu 15",
    detail: "Josiane has a clinic appointment. Jeanne works her rotation day off.",
  },
];

const rotations: Rotation[] = [
  {
    id: "A",
    code: "A",
    name: "Weekends off",
    who: "Beatrice, Josiane, Eric, Emmanuel",
    staff: 4,
    patterns: { A: "Weekends off" },
  },
  {
    id: "B",
    code: "B",
    name: "Wednesday and Thursday off",
    who: "Jeanne, Eugenie, Odette, Ange",
    staff: 4,
    patterns: { B: "Wed–Thu off" },
  },
  {
    id: "C",
    code: "C",
    name: "Monday and Tuesday off",
    who: "Vestine, Liliane, Divine",
    staff: 3,
    patterns: { C: "Mon–Tue off" },
  },
  { id: "D", code: "D", name: "Friday and Saturday off", who: "Chantal", staff: 1, patterns: { D: "Fri–Sat off" } },
  {
    id: "E",
    code: "E",
    name: "Evening turndown, Thursday and Friday off",
    who: "Grace",
    staff: 1,
    patterns: { E: "Thu–Fri off, evenings" },
  },
  {
    id: "N",
    code: "N1–N2",
    name: "Night guards, staggered",
    who: "Aimable, Jean Claude",
    staff: 2,
    patterns: { N1: "Nights, Thu–Fri off", N2: "Nights, Sun–Tue off" },
  },
];

const holidays: PublicHoliday[] = [
  { id: "2026-12-25", name: "Christmas Day", date: "Friday 25 December 2026", rostered: "Week 52 · not drafted" },
  { id: "2026-12-26", name: "Boxing Day", date: "Saturday 26 December 2026", rostered: "Week 52 · not drafted" },
  { id: "2027-01-01", name: "New Year’s Day", date: "Friday 1 January 2027", rostered: "2027 list not loaded" },
];

type RecordRow = [
  ClockRecord["day"],
  string,
  string,
  string,
  string,
  string,
  ClockSource | null,
  string,
  string,
  string,
  Tone,
];

const recordRows: RecordRow[] = [
  [
    "today",
    "Emmanuel Nkusi",
    "Security",
    "Isangano",
    "06:00–18:00",
    "05:56",
    "kiosk",
    "Lobby kiosk · PIN",
    "—",
    "On shift",
    "success",
  ],
  [
    "today",
    "Aimable Nsengiyumva",
    "Security",
    "Isangano",
    "06:00–18:00",
    "06:22",
    "phone",
    "Inside the hotel geofence",
    "—",
    "Late 22 min",
    "warning",
  ],
  [
    "today",
    "Rose Mukandayisenga",
    "Lodge kitchen",
    "Ishyamba",
    "06:00–14:00",
    "06:02",
    "kiosk",
    "Lodge kiosk · PIN",
    "—",
    "On shift",
    "success",
  ],
  [
    "today",
    "Fabrice Ndayisenga",
    "Kitchen",
    "Isangano",
    "06:30–14:30",
    "06:30",
    "desk",
    "By Joseph Habimana · PIN not issued yet",
    "—",
    "On shift",
    "success",
  ],
  [
    "today",
    "Theogene Habiyaremye",
    "Lodge operations",
    "Ishyamba",
    "06:30–15:30",
    "06:41",
    "phone",
    "Inside the lodge geofence",
    "—",
    "On shift",
    "success",
  ],
  [
    "today",
    "Beatrice Mukandori",
    "Housekeeping",
    "Isangano",
    "07:00–15:00",
    "06:52",
    "phone",
    "Inside the hotel geofence",
    "—",
    "On shift",
    "success",
  ],
  [
    "today",
    "Eric Habimana",
    "Front office",
    "Isangano",
    "07:00–15:00",
    "06:55",
    "kiosk",
    "Lobby kiosk · PIN",
    "—",
    "On shift",
    "success",
  ],
  [
    "today",
    "Olivier Mugisha",
    "Lodge operations",
    "Ishyamba",
    "07:00–15:00",
    "06:58",
    "phone",
    "Saved offline, received 07:12",
    "—",
    "Synced late",
    "info",
  ],
  [
    "today",
    "Jeanne Nyiraneza",
    "Housekeeping",
    "Isangano",
    "07:00–15:00",
    "07:01",
    "kiosk",
    "Staff entrance kiosk",
    "—",
    "On shift",
    "success",
  ],
  [
    "today",
    "Jean-Paul Niyonsaba",
    "Maintenance",
    "Isangano",
    "07:00–15:00",
    "07:05",
    "phone",
    "Inside the hotel geofence",
    "—",
    "On shift",
    "success",
  ],
  [
    "today",
    "Claudine Mukamana",
    "Food and beverage",
    "Isangano",
    "07:00–15:00",
    "07:18",
    "kiosk",
    "Staff entrance kiosk",
    "—",
    "Late 18 min",
    "warning",
  ],
  [
    "today",
    "Solange Uwimana",
    "Residence services",
    "Kacyiru Court",
    "08:00–17:00",
    "07:57",
    "phone",
    "Inside the residence geofence",
    "—",
    "On shift",
    "success",
  ],
  [
    "today",
    "Damascene Tuyisenge",
    "Lodge operations",
    "Ishyamba",
    "06:00–14:00",
    "No clock-in",
    null,
    "",
    "—",
    "Absent",
    "danger",
  ],
  [
    "yesterday",
    "Jeanne Nyiraneza",
    "Housekeeping",
    "Isangano",
    "07:00–15:00",
    "06:58",
    "kiosk",
    "Staff entrance kiosk",
    "15:06 · kiosk",
    "Complete 8 h 08 min",
    "success",
  ],
  [
    "yesterday",
    "Claudine Mukamana",
    "Food and beverage",
    "Isangano",
    "07:00–15:00",
    "07:02",
    "kiosk",
    "Staff entrance kiosk",
    "15:01 · kiosk",
    "Complete 7 h 59 min",
    "success",
  ],
  [
    "yesterday",
    "Jean-Paul Niyonsaba",
    "Maintenance",
    "Isangano",
    "07:00–15:00",
    "07:02",
    "kiosk",
    "Staff entrance kiosk",
    "Missing",
    "Missed clock-out",
    "warning",
  ],
  [
    "yesterday",
    "Ange Mutoni",
    "Front office",
    "Isangano",
    "15:00–23:00",
    "14:58",
    "kiosk",
    "Lobby kiosk · PIN",
    "Missing",
    "Missed clock-out",
    "warning",
  ],
  [
    "yesterday",
    "Grace Mukansanga",
    "Housekeeping",
    "Isangano",
    "15:00–23:00",
    "15:03",
    "phone",
    "Inside the hotel geofence",
    "Missing",
    "Missed clock-out",
    "warning",
  ],
];

const clockRecords: ClockRecord[] = recordRows.map((r, i) => ({
  id: `${r[0] === "today" ? "t" : "y"}-${String(i + 1).padStart(2, "0")}`,
  day: r[0],
  name: r[1],
  dept: r[2],
  property: r[3],
  shift: r[4],
  clockIn: r[5],
  source: r[6],
  sourceNote: r[7],
  clockOut: r[8],
  status: r[9],
  tone: r[10],
}));

const corrections: ClockCorrection[] = [
  {
    id: "c1",
    name: "Jean-Paul Niyonsaba",
    when: "Sunday 11 October · requested 18:20",
    from: "Out: missing",
    to: "Out 15:20",
    reason: "The kiosk was off during the power cut from 15:00 to 15:40. I left at 15:20.",
    evidence: "Work order WO-312 closed by Jean-Paul at 15:12",
    manager: "Aline Uwase confirmed · 11 Oct 19:02",
    state: "pending",
    outcome: null,
  },
  {
    id: "c2",
    name: "Ange Mutoni",
    when: "Sunday 11 October · requested 23:30",
    from: "Out: missing",
    to: "Out 23:10",
    reason: "I forgot to clock out after the night handover.",
    evidence: "Handover note signed by Eric Habimana at 23:05",
    manager: "Eric Habimana confirmed · 12 Oct 07:10",
    state: "pending",
    outcome: null,
  },
  {
    id: "c3",
    name: "Claudine Mukamana",
    when: "Friday 9 October · requested 9 Oct",
    from: "In 07:18",
    to: "In 07:00",
    reason: "There was a queue at the kiosk.",
    evidence: "Kiosk log: first attempt 07:16",
    manager: "Joseph Habimana reviewed · 10 Oct",
    state: "declined",
    outcome: "Declined by Diane Ingabire on 10 Oct: the kiosk log shows 07:16, so 07:16 was recorded instead.",
  },
];

const attendanceExceptions: AttendanceException[] = [
  {
    id: "x-damascene",
    kind: "absent",
    icon: "PersonXmark",
    title: "Damascene Tuyisenge · no clock-in today",
    detail: "Lodge operations, Ishyamba · shift 06:00–14:00 · no leave recorded · Theogene Habiyaremye informed",
    state: "Absent",
    tone: "danger",
    deskEmployee: "dt",
    correction: null,
    resolvedDetail: null,
  },
  {
    id: "x-aimable",
    kind: "late",
    icon: "Clock",
    title: "Aimable Nsengiyumva · late 22 min today",
    detail: "Security, Isangano · phone clock-in 06:22 · second late arrival this month",
    state: "Late",
    tone: "warning",
    deskEmployee: null,
    correction: null,
    resolvedDetail: null,
  },
  {
    id: "x-claudine",
    kind: "late",
    icon: "Clock",
    title: "Claudine Mukamana · late 18 min today",
    detail: "Food and beverage, Isangano · kiosk 07:18 · first this month",
    state: "Late",
    tone: "warning",
    deskEmployee: null,
    correction: null,
    resolvedDetail: null,
  },
  {
    id: "x-jeanpaul",
    kind: "missed",
    icon: "ArrowRightFromSquare",
    title: "Jean-Paul Niyonsaba · missed clock-out Sun 11",
    detail: "Correction requested · confirmed by Aline Uwase",
    state: "Correction pending",
    tone: "info",
    deskEmployee: null,
    correction: "c1",
    resolvedDetail: "Correction approved · out 15:20",
  },
  {
    id: "x-ange",
    kind: "missed",
    icon: "ArrowRightFromSquare",
    title: "Ange Mutoni · missed clock-out Sun 11",
    detail: "Correction requested · confirmed by Eric Habimana",
    state: "Correction pending",
    tone: "info",
    deskEmployee: null,
    correction: "c2",
    resolvedDetail: "Correction approved · out 23:10",
  },
  {
    id: "x-grace",
    kind: "missed",
    icon: "ArrowRightFromSquare",
    title: "Grace Mukansanga · missed clock-out Sun 11",
    detail: "No correction requested yet · reminder sent in the staff app at 08:00",
    state: "Open",
    tone: "warning",
    deskEmployee: "gm",
    correction: null,
    resolvedDetail: null,
  },
];

const deskEmployees: DeskEmployee[] = [
  {
    id: "dt",
    label: "Damascene Tuyisenge · Lodge operations",
    name: "Damascene Tuyisenge",
    dept: "Lodge operations",
    property: "Ishyamba",
    shift: "06:00–14:00",
  },
  {
    id: "gm",
    label: "Grace Mukansanga · Housekeeping",
    name: "Grace Mukansanga",
    dept: "Housekeeping",
    property: "Isangano",
    shift: "15:00–23:00",
  },
  {
    id: "fn",
    label: "Fabrice Ndayisenga · Kitchen",
    name: "Fabrice Ndayisenga",
    dept: "Kitchen",
    property: "Isangano",
    shift: "06:30–14:30",
  },
  {
    id: "yu",
    label: "Yvonne Uwase · Food and beverage",
    name: "Yvonne Uwase",
    dept: "Food and beverage",
    property: "Isangano",
    shift: "10:00–18:00",
  },
];

const attendanceSummary: AttendanceSummary[] = [
  {
    id: "2026-10-12",
    clockedIn: 27,
    rostered: 29,
    lateNote: "Aimable 22 min · Claudine 18 min",
    missedDay: "Sunday 11 October",
    kiosk: 16,
    phone: 9,
    desk: 2,
    grace: "grace period 5 minutes (configured)",
    yesterdayNote: "Sunday 11 October · showing exceptions and a sample of complete records",
  },
];

const leaveRequests: LeaveRequest[] = [
  {
    id: "l1",
    name: "Jeanne Nyiraneza",
    dept: "Housekeeping · Isangano",
    type: "Annual leave",
    homeType: "Annual leave",
    dates: "Mon 26 – Wed 28 Oct",
    days: 3,
    sub: "9 Oct · staff app",
    lm: "Beatrice Mukandori",
    lmNote: "Approved 10 Oct · “Cover arranged with Josiane”",
    step: "hr",
    hrDecision: null,
    hrReason: null,
    homeStep: "Beatrice approved · now with you",
    balanceAfter: "8.5 days",
    homeWarn: "",
    balance: "Annual 11.5 → 8.5 days",
    roster: "Week of 26 Oct not drafted yet; it will be built around this leave",
    attach: "None needed",
    warn: "",
    by: null,
    cal: [15, 3],
  },
  {
    id: "l2",
    name: "Vestine Uwimana",
    dept: "Housekeeping · Isangano",
    type: "Annual leave",
    homeType: "Annual leave",
    dates: "Sat 17 Oct",
    days: 1,
    sub: "11 Oct · staff app",
    lm: "Beatrice Mukandori",
    lmNote: "Approved 11 Oct · “Family event, she asked early”",
    step: "hr",
    hrDecision: null,
    hrReason: null,
    homeStep: "Beatrice approved · now with you",
    balanceAfter: "6 days",
    homeWarn: "Housekeeping already short that day",
    balance: "Annual 7 → 6 days",
    roster: "Saturday morning shift released",
    attach: "None needed",
    warn: "Saturday housekeeping would drop to 5 of 8",
    by: null,
    cal: [6, 1],
  },
  {
    id: "l3",
    name: "Jean-Paul Niyonsaba",
    dept: "Maintenance · Isangano",
    type: "Sick leave",
    homeType: "Sick leave",
    dates: "Fri 9 – Sat 10 Oct",
    days: 2,
    sub: "10 Oct · staff app",
    lm: "Aline Uwase",
    lmNote: "Approved 10 Oct",
    step: "hr",
    hrDecision: null,
    hrReason: null,
    homeStep: "Aline approved · certificate attached",
    balanceAfter: "28 of 30 sick days",
    homeWarn: "",
    balance: "Sick 30 → 28 days left this year",
    roster: "Past dates · attendance marked as sick, not absent",
    attach: "Medical certificate, Gisenyi District Hospital (restricted)",
    warn: "",
    by: null,
    cal: null,
  },
  {
    id: "l4",
    name: "Felix Munyaneza",
    dept: "Lodge operations · Ishyamba",
    type: "Circumstantial leave · own wedding",
    homeType: "Circumstantial leave · wedding",
    dates: "Mon 2 – Thu 5 Nov",
    days: 4,
    sub: "11 Oct · staff app",
    lm: "Theogene Habiyaremye",
    lmNote: "",
    step: "lm",
    hrDecision: null,
    hrReason: null,
    homeStep: "With Theogene Habiyaremye",
    balanceAfter: "not accrued",
    homeWarn: "",
    balance: "Not accrued · configured days per event",
    roster: "Lodge week of 2 Nov not drafted yet",
    attach: "Civil marriage notice",
    warn: "",
    by: null,
    cal: null,
  },
  {
    id: "l5",
    name: "Celestin Ndagijimana",
    dept: "Lodge kitchen · Ishyamba",
    type: "Annual leave",
    homeType: "Annual leave",
    dates: "Wed 14 – Fri 16 Oct",
    days: 3,
    sub: "1 Oct",
    lm: "Theogene Habiyaremye",
    lmNote: "Approved 2 Oct",
    step: "approved",
    hrDecision: null,
    hrReason: null,
    homeStep: "Approved",
    balanceAfter: "6 days",
    homeWarn: "",
    balance: "Annual 9 → 6 days",
    roster: "Evening cover gap on Wed 14 flagged to the lodge",
    attach: "None needed",
    warn: "",
    by: "Approved by Diane Ingabire on 3 Oct",
    cal: [3, 3],
  },
  {
    id: "l6",
    name: "Odette Mukamazimpaka",
    dept: "Housekeeping · Isangano",
    type: "Sick leave",
    homeType: "Sick leave",
    dates: "Mon 12 – Tue 13 Oct",
    days: 2,
    sub: "12 Oct · phoned in",
    lm: "Beatrice Mukandori",
    lmNote: "Recorded 12 Oct 06:45 on her behalf",
    step: "approved",
    hrDecision: null,
    hrReason: null,
    homeStep: "Approved",
    balanceAfter: "28 of 30 sick days",
    homeWarn: "",
    balance: "Sick 30 → 28 days left this year",
    roster: "Shifts released",
    attach: "Certificate to follow within 2 days",
    warn: "",
    by: "Approved by Diane Ingabire today at 07:20",
    cal: [1, 2],
  },
  {
    id: "l7",
    name: "Claudine Mukamana",
    dept: "Food and beverage · Isangano",
    type: "Annual leave",
    homeType: "Annual leave",
    dates: "Fri 30 Oct",
    days: 1,
    sub: "6 Oct",
    lm: "Joseph Habimana",
    lmNote: "Declined 7 Oct · “Kivu Hall conference that day”",
    step: "lmdeclined",
    hrDecision: null,
    hrReason: null,
    homeStep: "Declined by manager",
    balanceAfter: "8.5 days",
    homeWarn: "",
    balance: "Unchanged · 8.5 days",
    roster: "No change",
    attach: "None needed",
    warn: "",
    by: "Declined by Joseph Habimana; it never reached HR",
    cal: null,
  },
];

const leaveBalances: LeaveBalance[] = [
  { id: "b-jn", name: "Jeanne Nyiraneza", carried: 3, accrued: 13.5, taken: 5, pending: 3, sick: 2, request: "l1" },
  { id: "b-vu", name: "Vestine Uwimana", carried: 0, accrued: 13.5, taken: 6.5, pending: 1, sick: 1, request: "l2" },
  { id: "b-bm", name: "Beatrice Mukandori", carried: 6, accrued: 13.5, taken: 10, pending: 0, sick: 0, request: null },
  { id: "b-cm", name: "Claudine Mukamana", carried: 3, accrued: 13.5, taken: 8, pending: 0, sick: 3, request: null },
  { id: "b-jp", name: "Jean-Paul Niyonsaba", carried: 2, accrued: 13.5, taken: 12, pending: 0, sick: 2, request: null },
  {
    id: "b-cn",
    name: "Celestin Ndagijimana",
    carried: 1.5,
    accrued: 13.5,
    taken: 9,
    pending: 0,
    sick: 0,
    request: null,
  },
];

const leaveTypes: LeaveType[] = [
  {
    id: "annual",
    name: "Annual leave",
    paid: "Yes",
    accrual: "1.5 days per month worked · 18 a year",
    carry: "Up to 6 days, used by 31 Mar",
    flow: "Line manager → HR",
    status: "Configured · unverified",
    verified: false,
  },
  {
    id: "sick",
    name: "Sick leave",
    paid: "Yes, certificate after 2 days",
    accrual: "30 days a year at full pay",
    carry: "None",
    flow: "Line manager → HR",
    status: "Configured · unverified",
    verified: false,
  },
  {
    id: "maternity",
    name: "Maternity leave",
    paid: "Employer and RSSB scheme split",
    accrual: "12 weeks per birth",
    carry: "Not applicable",
    flow: "HR only",
    status: "Configured · unverified",
    verified: false,
  },
  {
    id: "paternity",
    name: "Paternity leave",
    paid: "Yes",
    accrual: "4 working days per birth",
    carry: "Not applicable",
    flow: "Line manager → HR",
    status: "Configured · unverified",
    verified: false,
  },
  {
    id: "circumstantial",
    name: "Circumstantial leave",
    paid: "Yes",
    accrual: "Days per event: wedding, bereavement, birth",
    carry: "Not applicable",
    flow: "Line manager → HR",
    status: "Configured · unverified",
    verified: false,
  },
  {
    id: "unpaid",
    name: "Unpaid leave",
    paid: "No · deducted pro-rata in payroll",
    accrual: "None",
    carry: "Not applicable",
    flow: "Line manager → HR → owner over 5 days",
    status: "Business policy · owner approved",
    verified: true,
  },
];

const leaveCalendar: LeaveCalendarEntry[] = [
  { id: "cal-yvonne", name: "Yvonne Uwase", type: "Annual leave", step: "approved", cal: [9, 2] },
];

export const fixtures = {
  "people.properties": properties,
  "people.presence": presence,
  "people.rosterGaps": rosterGaps,
  "people.payRunSummary": payRunSummary,
  "people.expiring": expiring,
  "people.tickets": tickets,
  "people.employees": employees,
  "people.compensation": compensation,
  "people.fileDocuments": fileDocuments,
  "people.fileAccess": fileAccess,
  "people.family": family,
  "people.policies": policies,
  "people.orgChart": orgChart,
  "people.offboarding": offboarding,
  "people.rosterGroups": rosterGroups,
  "people.rosterStaff": rosterStaff,
  "people.rosterWeeks": rosterWeeks,
  "people.shiftSwaps": shiftSwaps,
  "people.rotations": rotations,
  "people.holidays": holidays,
  "people.clockRecords": clockRecords,
  "people.corrections": corrections,
  "people.attendanceExceptions": attendanceExceptions,
  "people.deskEmployees": deskEmployees,
  "people.attendanceSummary": attendanceSummary,
  "people.leaveRequests": leaveRequests,
  "people.leaveBalances": leaveBalances,
  "people.leaveTypes": leaveTypes,
  "people.leaveCalendar": leaveCalendar,
} satisfies FixtureSet;
