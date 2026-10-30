/**
 * What HR's desk screens draw: people, their files, the roster, attendance and leave.
 *
 * Declared here since ADR-074 stage 3: the product owns the shapes its views draw, and the app's sources
 * build them. `@injishi/data/fixtures/people.ts` keeps matching declarations for its demo rows until stage 9,
 * and every page that passes those rows into a view is where the compiler checks the two still agree.
 */
import type { BoardId, IconName, Tone } from "./shared.ts";

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
  /**
   * Shift changes made since the week was published and not yet sent to staff. Live data
   * carries it so a reload still offers to publish them; the prototype starts every week at 0.
   */
  pendingChanges?: number;
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
