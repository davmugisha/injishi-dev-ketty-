/**
 * What the staff phone's room and repair screens draw: tasks, inspections, problem reports and work orders.
 *
 * Declared here since ADR-074 stage 4: the product owns the shapes its views draw, copied verbatim from
 * `@injishi/data/fixtures/staff.ts` with every type they reference. The demo fixtures keep matching
 * declarations for their rows until stage 9, and every page that passes those rows into a view is where the
 * compiler checks the two still agree.
 */
import type { IconName, StockKey } from "./shared.ts";

export type StaffTone = "accent" | "success" | "warning" | "danger" | "default" | "info";

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

export interface CleaningRoom {
  id: string;
  no: string;
  kind: string;
  type: string;
  due: string;
  arrival: string;
  arrivalNote: string;
  history: string;
  /** Time spent in the room so far ("18:24"). */
  timer: string;
  started: string;
  status: "cleaning" | "waiting" | "done";
  /** Checklist items already ticked (ids from staff.checklistSections). */
  ticked: string[];
  floor: string;
}

export interface FinishedRoom {
  id: string;
  no: string;
  kind: string;
  when: string;
  state: string;
  stateTone: StaffTone;
}

export interface ChecklistSection {
  id: string;
  title: string;
  icon: IconName;
  items: { id: string; label: string }[];
}

export interface MinibarItem {
  id: string;
  label: string;
  stocked: number;
  /** Used count already entered for the current room. */
  used: number;
}

export interface FoundItemSpot {
  id: string;
  label: string;
  /** How the spot reads in a sentence ("Found in the bedside drawer"). */
  phrase: string;
}

/** A found item being logged to Lost and found. */
export interface FoundItem {
  id: string;
  ref: string;
  name: string;
  description: string;
  room: string;
  spot: string;
  photo: StockKey;
  holder: string;
}

export interface ReportPlace {
  id: string;
  label: string;
  isRoom: boolean;
}

export interface ProblemCategory {
  id: string;
  label: string;
  icon: IconName;
}

export interface UrgencyLevel {
  id: string;
  label: string;
  hint: string;
  tone: StaffTone;
}

/** A problem report as drafted on the phone (becomes a work order when it reaches maintenance). */
export interface ProblemReport {
  id: string;
  ticket: string;
  place: string;
  category: string;
  urgency: string;
  photos: number;
  photo: StockKey;
  photoCaption: string;
  description: string;
  askBlock: boolean;
  takenAt: string;
  sentAt: string;
  assignee: string;
  assigneeFirst: string;
  manager: string;
  managerFirst: string;
}

export type CheckResult = "pass" | "fail";

export interface InspectionRoom {
  id: string;
  no: string;
  cleanedBy: string;
  cleanedByFirst: string;
  initials: string;
  type: string;
  cleaned: string;
  wait: string;
  arrival: string;
  /** Arrival is close: the room is late for inspection. */
  late: boolean;
  skip: string | null;
  results: Record<string, CheckResult>;
  /** Failed checks that already have a photo. */
  photos: string[];
  outcome: "release" | "return" | null;
  note: string;
}

export interface InspectionCheck {
  id: string;
  label: string;
  /** Photo of a failed check (stock key). */
  photo: StockKey | null;
}

export interface WorkOrderPart {
  name: string;
  qty: string;
  meta: string;
  chip: string;
  tone: StaffTone;
}

export interface WorkOrderBlock {
  tone: "warning" | "danger";
  title: string;
  text: string;
  chip: string;
  keep: string;
}

export interface WorkOrderRecommendation {
  title: string;
  why: string;
  confidence: string;
  reviewed: string;
  note: string;
}

export interface WorkOrder {
  id: string;
  ref: string;
  where: string;
  what: string;
  icon: IconName;
  priority: "Urgent" | "High" | "Normal" | "Planned";
  status: "new" | "progress" | "parts" | "planned";
  age: string;
  opened: string;
  from: string;
  photos: { caption: string; image: StockKey }[];
  block: WorkOrderBlock | null;
  recommendation: WorkOrderRecommendation | null;
  parts: WorkOrderPart[];
  log: { what: string; when: string; dur: string }[];
  /** Repair session running on the timer, when there is one. */
  repair: { start: string; stopped: string; dur: string } | null;
  timeTotal: string | null;
  notes: { initials: string; who: string; when: string; text: string }[];
  fix: string;
}

export interface StorePart {
  id: string;
  name: string;
  stock: string;
  available: boolean;
}
