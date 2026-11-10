/**
 * What the staff phone's own screens draw: the person's schedule, requests, leave and payslips.
 *
 * Declared here since ADR-074 stage 3: the product owns the shapes its views draw, and the app's sources
 * build them. `@injishi/data/fixtures/staff.ts` keeps matching declarations for its demo rows until stage 9,
 * and every page that passes those rows into a view is where the compiler checks the two still agree.
 */
import type { IconName, StockKey } from "./shared.ts";

export type StaffTone = "accent" | "success" | "warning" | "danger" | "default" | "info";

// ── People ───────────────────────────────────────────────────────────────────

/** Employment details of a staff persona (keyed by persona id). */
export interface StaffProfile {
  id: string;
  staffNo: string;
  since: string;
  workplace: string;
  /** Short property name used in phone headers ("Isangano"). */
  site: string;
  department: string;
  /** Where the person works today ("Floor 2"). */
  area: string;
  shift: string;
  clockedInAt: string;
  /** Kiosk photo (stock key) shown on "Is this you?". */
  photo: StockKey | null;
}

// ── Schedule and leave (StaffSchedule) ───────────────────────────────────────

export interface Shift {
  id: string;
  week: number;
  dow: string;
  date: string;
  long: string;
  time: string | null;
  area: string | null;
  isToday: boolean;
  isOff: boolean;
  /** A different shift was asked for that day, and is waiting. */
  changePending?: boolean;
  /** First name of the colleague a swap is pending with. */
  swapPendingWith: string | null;
}

export interface SwapColleague {
  id: string;
  initials: string;
  name: string;
  first: string;
  note: string;
  busy: boolean;
}

/** What a person may ask for on their schedule, and what came of swaps they answered. */
export interface ShiftChoices {
  shifts: { id: string; name: string; hours: string }[];
  rotations: { id: string; name: string; steps: string[] }[];
  current: { name: string; since: string } | null;
  answered: { id: string; from: string; when: string; status: "waiting" | "approved" | "declined"; note: string }[];
}

/** A swap a colleague asked of this person, waiting for their yes or no (058-time AC-TM5). */
export interface SwapAsk {
  id: string;
  /** Who asks, their first name and initials. */
  from: string;
  first: string;
  initials: string;
  /** "Sat 17 Oct", or "Sat 17 Oct – Sun 18 Oct". */
  when: string;
  /** What they said. */
  note: string;
}

/** A loan or salary advance of the person's, as their phone lists it: read only, HR records them. */
export interface StaffLoan {
  id: string;
  /** "RWF 100,000 · Salary advance". */
  title: string;
  meta: string;
  chip: string;
  tone: StaffTone;
}

/** Money a person asked back for, as their phone lists it. */
export interface StaffClaim {
  id: string;
  /** "RWF 12,000 · Taxi to the supplier". */
  title: string;
  meta: string;
  chip: string;
  tone: StaffTone;
  /** Still waiting: the person may take it back. */
  canCancel: boolean;
}

export type RequestStatus = "colleague" | "manager" | "approved" | "declined" | "cancelled";

export interface StaffRequest {
  id: string;
  /** Shift id for swap requests. */
  shift: string | null;
  type: string;
  icon: IconName;
  title: string;
  sub: string;
  status: RequestStatus;
  steps: string;
  /** Leave days the request uses. */
  days: number;
}

export interface LeaveType {
  id: string;
  label: string;
  hint: string;
  usesBalance: boolean;
}

export interface LeaveBalance {
  id: string;
  left: number;
  used: number;
  entitlement: number;
  accrual: number;
  carryOver: number;
  carryYear: number;
  sickUsed: number;
  nextHoliday: string;
  rules: string;
  waitingFor: string;
}

export interface LeaveApprover {
  id: string;
  order: number;
  initials: string;
  name: string;
  role: string;
  tone: StaffTone;
}

// ── Me (StaffMe) ─────────────────────────────────────────────────────────────

export interface PayslipLine {
  label: string;
  amount: number;
  kind: "earning" | "deduction" | "subtotal" | "total";
}

export interface Payslip {
  id: string;
  month: string;
  status: "pending" | "available";
  note: string | null;
  net: number | null;
  paid: string | null;
  ref: string | null;
  confirmed: string | null;
  confirmedBy: string | null;
  employer: string;
  rules: string;
  payTo: string;
  lines: PayslipLine[];
  /** The payslip as a PDF the person downloads, when it comes from their own file. */
  pdfHref?: string;
}

export interface StaffDocument {
  id: string;
  icon: IconName;
  name: string;
  meta: string;
  chip: string;
  tone: StaffTone;
  /** HR asked for it, or sent it back: the person sends a photo of it from the phone. */
  canSend?: boolean;
}

export interface LoanedAsset {
  id: string;
  icon: IconName;
  name: string;
  meta: string;
  chip: string;
  tone: StaffTone;
}

export interface HelpTicket {
  id: string;
  title: string;
  meta: string;
  chip: string;
  tone: StaffTone;
  /** HR's last answer, when there is one. */
  answer?: string | null;
}

/** Something HR posted that is for this person. */
export interface StaffAnnouncement {
  id: string;
  title: string;
  body: string;
  /** "6 Nov · until 20 Nov". */
  meta: string;
}

/** The person's own review: where it stands, and whether their part can still be written. */
export interface StaffOwnReview {
  id: string;
  title: string;
  /** "1 Nov – 30 Nov". */
  meta: string;
  chip: string;
  tone: StaffTone;
  /** What they wrote. */
  note: string | null;
  canWrite: boolean;
}

export interface HelpTopic {
  id: string;
  label: string;
  draft: string;
}
