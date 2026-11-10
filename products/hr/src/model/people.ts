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
  /** Late today. `gone`: has clocked out since, so no longer in. */
  late: (PresenceIssue & { gone?: boolean })[];
  /** `explained`: called in / certificate to follow; otherwise no clock-in and no leave recorded. */
  absent: (PresenceIssue & { explained: boolean })[];
  /** Clocked in today and out again: rostered, no longer in. */
  finished?: string[];
  /** On approved leave today: not rostered, shown so nobody looks for them. */
  onLeave?: PresenceIssue[];
}

/** One kind of request waiting on HR, as People home counts it. */
export interface HrWaiting {
  id: string;
  label: string;
  count: number;
  /** The screen where it is decided. */
  board: BoardId;
  /** Added to that screen's address: "?tab=corrections". */
  query: string;
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
  /** Whose checklist the step is on. */
  employeeId: string;
  title: string;
  detail: string;
  /** Owner-only step: HR sees it but cannot tick it. */
  ownerOnly: boolean;
  /** The person looking holds what an owner-only step asks (`team.manage`), so they can tick it. */
  canTickOwnerOnly?: boolean;
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
  /** The minimums as saved, Monday first, for editing. */
  minByWeekday?: number[];
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
  /** The real hours of each day with a shift ("08–17"), per week. */
  times?: Record<WeekId, (string | null)[]>;
  /** How long each day's shift is, in hours; 0 for no shift. */
  lengths?: Record<WeekId, number[]>;
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
  /** Each shift letter's real hours at this branch ("08–17"), as a new shift would get them. */
  shiftTimes?: Partial<Record<"M" | "E" | "N", string>>;
  /** How long each shift letter is at this branch, in hours. */
  shiftLengths?: Partial<Record<"M" | "E" | "N", number>>;
}

export interface ShiftSwap {
  id: string;
  a: string;
  b: string;
  /** The roster week the day falls in; absent means this week. */
  week?: WeekId;
  /** The day's place in that week, 0 to 6; -1 when it is not on the grid. */
  day: number;
  /** A swap, another shift, or joining a rotation. Absent means a swap. */
  kind?: "swap" | "change" | "rotation";
  /** Still waiting for the colleague to say yes. */
  waiting?: boolean;
  /** The colleague has no login, so someone who manages the roster says yes for them. */
  canAcceptFor?: boolean;
  /** The colleague's first name, for the waiting line. */
  colleague?: string;
  /** The day has passed with no decision. */
  overdue?: boolean;
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
  /** Its patterns (one, or a staggered family), each with its steps in order. */
  members?: RotationMember[];
  /** Who is on it now. */
  people?: RotationPerson[];
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
  /** The Kigali day the clock-in fell on ("2026-10-15"): a clock-out is typed against this day. */
  clockedOn?: string;
  source: ClockSource | null;
  sourceNote: string;
  clockOut: string;
  status: string;
  tone: Tone;
  /** Set on desk entries added from the Attendance screen (ISO time); newest show first. */
  addedAt?: string;
  /** The person's staff file, when HR can act on the row. */
  employeeId?: string;
  /** What HR can do from the row: clock in someone with no clock-in, or clock out someone on shift. */
  action?: "clock_in" | "clock_out" | null;
  /** A clock-in from a phone nobody has checked: HR counts it, or marks it not counted. */
  check?: { recordId: string; why: string } | null;
  /** "07:00": the shift's start, offered as the clock-in time. */
  shiftStart?: string;
  /**
   * A clock-in of an earlier day the person never clocked out of: it blocks today's until closed.
   * `since` reads "Fri 16 Oct"; `clockIn` and `clockOut` are "06:52" and the end offered, "14:52".
   */
  stale?: { recordId: string; date: string; since: string; clockIn: string; clockOut: string };
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
  /** The day the record belongs to ("2026-10-15"): a desk entry for it opens on this day. */
  workDate?: string;
  /** "07:00": the clock-in on that record, which a desk entry keeps. */
  clockIn?: string;
}

export interface DeskEmployee {
  id: string;
  label: string;
  name: string;
  dept: string;
  property: string;
  shift: string;
  /** Absent, missed a clock-out, or has no kiosk PIN this week: listed first. */
  due?: boolean;
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
  /** Why the person signed in may not decide this, in words; empty when they may. */
  blockedWhy?: string | null;
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
  /** What the ledger says is left, expired days taken off. */
  left?: number | null;
}

/** Days on top of what a kind of leave gives, asked for by a person and decided on the Leave screen. */
export interface ExtraDaysAsk {
  id: string;
  name: string;
  dept: string;
  /** "Extra days", or "Day in lieu" for a worked holiday or day off. */
  kind: string;
  /** "Annual leave". */
  leaveType: string;
  days: number;
  reason: string;
  /** "9 Oct". */
  asked: string;
  state: "pending" | "approved" | "declined";
  /** Who decided and what they said, once decided. */
  outcome: string | null;
  /** Why the person signed in may not decide this, in words; empty when they may. */
  blockedWhy: string | null;
}

/** A document a person handed in, waiting for HR to check it. */
export interface DocumentToCheck {
  id: string;
  employeeId: string;
  name: string;
  title: string;
  /** "9 Oct". */
  handedIn: string;
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

/** What a login may be given with, at one employer. */
export interface AccessOptionsView {
  /** The person may give logins at all. */
  canGrant: boolean;
  /** The person manages the team: every role goes out at once. */
  grantsEveryRole: boolean;
  roles: AccessRoleView[];
  branches: { id: string; name: string }[];
}

/** The staff roles a login may be given into; `owner` changes hands only by transfer. */
export type AccessRoleId = "manager" | "receptionist" | "finance" | "hr" | "housekeeper";

/** Where one file's login stands, as the file's Access tab shows it. */
export interface EmployeeAccessView extends AccessOptionsView {
  employeeId: string;
  state: "active" | "invited" | "awaiting_owner" | "none";
  /** "Front office / Receptionist · every branch · last active 2 h ago". */
  member: { email: string | null; role: string; branches: string; lastActive: string } | null;
  invitation: { email: string; role: string; branches: string; sent: string; expires: string } | null;
  request: {
    status: "pending" | "approved" | "declined" | "cancelled";
    email: string;
    role: string;
    branches: string;
    requested: string;
    decided: string | null;
    decisionNote: string | null;
  } | null;
}

/** Earlier views of an employee file. `{first}` is replaced with the employee's first name. */
export interface FileAccess {
  id: string;
  what: string;
  when: string;
}

/** Days of leave taken in one month of this year, for the Leave page's chart. */
export interface LeaveMonth {
  /** The month, "2026-03". */
  id: string;
  annual: number;
  sick: number;
  other: number;
}

/** One stretch of leave on the Leave page's calendar: approved or still pending, this year or later. */
export interface LeaveStretch {
  id: string;
  name: string;
  type: string;
  from: string;
  to: string;
  days: number;
  approved: boolean;
  /** Approved leave decided too long ago for the queue, whole: HR can still open and cancel it. */
  request?: LeaveRequest | null;
}

/** The new employee form's choices (People › Employees › Add employee). */
export interface NewEmployeeForm {
  id: string;
  employers: NewEmployeeEmployer[];
  /** Banks a salary may be paid to, for the payment step. */
  banks: string[];
  /** Today in Kigali, the default start date. */
  today: string;
}

export interface RotationMember {
  id: string;
  code: string;
  description: string;
  /** Each step's shift name, or "Off". */
  steps: string[];
  rule: "every_n_days" | "weekly" | "monthly";
  ruleValue: number;
}

export interface RotationPerson {
  assignmentId: string;
  employeeId: string;
  name: string;
  title: string | null;
  patternId: string;
  code: string;
  startsOn: string;
  startStep: number;
}

export interface EmployeeDocumentView {
  id: string;
  title: string;
  state: string;
  tone: "success" | "warning" | "danger" | "default";
  /** "Expires 3 Mar 2027", "Uploaded 9 Oct 2026", "Due 20 Oct 2026". */
  meta: string;
  /** A file has been uploaded, so there is something to open. */
  canOpen: boolean;
  /** Handed in and waiting: HR approves it or sends it back. */
  canDecide?: boolean;
}

/** One role as the access step offers it: what it is for and what it may do at this business. */
export interface AccessRoleView {
  id: AccessRoleId;
  label: string;
  summary: string;
  /** With HR's rights alone, a login into this role waits for the owner's approval. */
  needsOwner: boolean;
  /** Its permissions by area, in plain words. */
  areas: { label: string; permissions: string[] }[];
}

/** One employer HR keeps files for, with what its new employee form offers. */
export interface NewEmployeeEmployer {
  /** The business workspace. */
  id: string;
  name: string;
  kind: "hospitality" | "residence";
  branches: { id: string; name: string }[];
  positions: { id: string; title: string }[];
  employeeTypes: { id: string; title: string }[];
  /** Who a new person may report to: active files of this employer. */
  managers: { id: string; name: string; title: string }[];
  access: AccessOptionsView;
}

/** A login HR asked for, as the owner decides it on Team and roles. */
export interface AccessRequestView {
  id: string;
  employeeId: string;
  name: string;
  initials: string;
  /** "Night auditor · EMP-0094" */
  job: string;
  email: string;
  role: string;
  branches: string;
  /** "Asked by Diane Ingabire · 18 Oct" */
  asked: string;
  note: string | null;
  status: "pending" | "approved" | "declined" | "cancelled";
  /** "Approved by Didier Mugenzi · 18 Oct", or the decline with its reason. */
  outcome: string | null;
}

/** A file's personal details, as the Personal tab shows them. `full` is false for a reader without them. */
export interface EmployeePersonalView {
  full: boolean;
  rows: { label: string; value: string }[];
}

/** The levels of Rwanda's places, province down to village (umudugudu). */
export type PlaceLevelId = "province" | "district" | "sector" | "cell" | "village";
