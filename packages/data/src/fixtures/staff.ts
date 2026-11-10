import type { StockKey } from "../media.ts";
import type { FixtureSet, IconName } from "../types.ts";

/**
 * Embedded-database fixtures for the "staff" area: the housekeeper, supervisor and technician
 * phone apps (StaffTask, StaffReport, StaffSchedule, StaffMe, InspectRoom, TechWorkOrders) and the
 * clock-in kiosk (AttendanceKiosk). Values are lifted verbatim from the artifact boards.
 */

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

// ── Room task (StaffTask) ────────────────────────────────────────────────────

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

// ── Report a problem (StaffReport) ───────────────────────────────────────────

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

/** Money the person asked to be paid back, and the office's answer (058-payroll AC-PY9). */
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

export interface LeaveDraft {
  id: string;
  from: string;
  to: string;
  workingDays: number;
  title: string;
  note: string;
  busyDates: string;
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

export interface HelpTopic {
  id: string;
  label: string;
  draft: string;
}

// ── Inspection (InspectRoom) ─────────────────────────────────────────────────

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

// ── Work orders (TechWorkOrders) ─────────────────────────────────────────────

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

// ── Clock-in kiosk (AttendanceKiosk) ─────────────────────────────────────────

export interface Kiosk {
  id: string;
  hotel: string;
  place: string;
  time: string;
  date: string;
  /** Clock-ins kept on the kiosk while offline. */
  queued: number;
  resetSeconds: number;
  /** Persona whose card the demo PIN and staff card resolve to. */
  demoStaff: string;
}

// ── Data ─────────────────────────────────────────────────────────────────────

const profiles: StaffProfile[] = [
  {
    id: "housekeeper",
    staffNo: "AH-0142",
    since: "3 Mar 2024",
    workplace: "Isangano Lakeside Hotel",
    site: "Isangano",
    department: "Housekeeping",
    area: "Floor 2",
    shift: "07:00 – 15:00",
    clockedInAt: "07:02",
    photo: "staffPortrait",
  },
  {
    id: "supervisor",
    staffNo: "AH-0118",
    since: "14 Aug 2023",
    workplace: "Isangano Lakeside Hotel",
    site: "Isangano",
    department: "Housekeeping",
    area: "Floors 1–3",
    shift: "07:00 – 15:00",
    clockedInAt: "06:51",
    photo: null,
  },
  {
    id: "technician",
    staffNo: "AH-0127",
    since: "2 Oct 2023",
    workplace: "Isangano Lakeside Hotel",
    site: "Isangano",
    department: "Maintenance",
    area: "All floors",
    shift: "08:00 – 16:00",
    clockedInAt: "07:56",
    photo: null,
  },
];

const rooms: CleaningRoom[] = [
  {
    id: "204",
    no: "204",
    kind: "Checkout",
    type: "Deluxe Lake View",
    due: "Due 12:00",
    arrival: "Next arrival 14:00 · 2 adults",
    arrivalNote: "Late checkout not requested · extra pillows asked for",
    history: "Checked out 10:15 (front desk) · you started 10:42",
    timer: "18:24",
    started: "Started 10:42",
    status: "cleaning",
    ticked: ["b1", "b2", "b3", "b4", "r1", "r3", "l1"],
    floor: "Floor 2",
  },
  {
    id: "211",
    no: "211",
    kind: "Checkout",
    type: "Twin",
    due: "Due 13:00",
    arrival: "Next arrival 15:30 · 1 adult",
    arrivalNote: "Remove the extra bed before the next guest",
    history: "Checked out 09:40 (front desk)",
    timer: "00:00",
    started: "Just started",
    status: "waiting",
    ticked: [],
    floor: "Floor 2",
  },
  {
    id: "206",
    no: "206",
    kind: "Stayover",
    type: "Standard Queen",
    due: "After 11:00",
    arrival: "Guest staying tonight",
    arrivalNote: "Do not disturb until 11:00 · towels only",
    history: "Stayover task created 06:00",
    timer: "00:00",
    started: "Just started",
    status: "waiting",
    ticked: [],
    floor: "Floor 2",
  },
  {
    id: "209",
    no: "209",
    kind: "Deep clean",
    type: "Standard Queen",
    due: "By 15:00",
    arrival: "Empty tonight",
    arrivalNote: "Monthly · curtains and mattress turn",
    history: "Planned by Beatrice on 10 Oct",
    timer: "00:00",
    started: "Just started",
    status: "waiting",
    ticked: [],
    floor: "Floor 2",
  },
];

const finishedRooms: FinishedRoom[] = [
  {
    id: "201",
    no: "201",
    kind: "Checkout",
    when: "Cleaned 08:15 · inspected 08:40",
    state: "Inspected",
    stateTone: "success",
  },
  { id: "203", no: "203", kind: "Stayover", when: "Cleaned 09:05", state: "Clean", stateTone: "success" },
  {
    id: "207",
    no: "207",
    kind: "Checkout",
    when: "Cleaned 09:50 · waiting for inspection",
    state: "Clean",
    stateTone: "success",
  },
];

const checklistSections: ChecklistSection[] = [
  {
    id: "bathroom",
    title: "Bathroom",
    icon: "Droplet",
    items: [
      { id: "b1", label: "Toilet cleaned and disinfected" },
      { id: "b2", label: "Shower, glass and drain cleaned" },
      { id: "b3", label: "Sink, mirror and taps polished" },
      { id: "b4", label: "Floor mopped, bin emptied" },
    ],
  },
  {
    id: "bedroom",
    title: "Bedroom",
    icon: "House",
    items: [
      { id: "r1", label: "Desk, bedside and wardrobe dusted" },
      { id: "r2", label: "Balcony door and glass wiped" },
      { id: "r3", label: "Floor vacuumed, also under the bed" },
      { id: "r4", label: "Lights, AC and TV remote work" },
    ],
  },
  {
    id: "linen",
    title: "Linen",
    icon: "TShirt",
    items: [
      { id: "l1", label: "Bed remade with fresh sheets" },
      { id: "l2", label: "Towels: 2 bath, 2 hand, 1 mat" },
      { id: "l3", label: "Used linen bagged for laundry" },
    ],
  },
  {
    id: "amenities",
    title: "Amenities",
    icon: "Gift",
    items: [
      { id: "a1", label: "2 water bottles" },
      { id: "a2", label: "Coffee and tea tray refilled" },
      { id: "a3", label: "Soap, shampoo and lotion" },
      { id: "a4", label: "Robe and slippers" },
    ],
  },
];

const minibarItems: MinibarItem[] = [
  { id: "water", label: "Water 50 cl", stocked: 4, used: 2 },
  { id: "soda", label: "Soft drink", stocked: 4, used: 1 },
  { id: "beer", label: "Primus beer", stocked: 2, used: 0 },
  { id: "crisps", label: "Crisps", stocked: 2, used: 1 },
];

const foundSpots: FoundItemSpot[] = [
  { id: "bedside", label: "Bedside", phrase: "bedside drawer" },
  { id: "bathroom", label: "Bathroom", phrase: "bathroom" },
  { id: "wardrobe", label: "Wardrobe", phrase: "wardrobe" },
  { id: "bed", label: "Under the bed", phrase: "under the bed" },
  { id: "desk", label: "Desk", phrase: "desk" },
];

const foundItems: FoundItem[] = [
  {
    id: "LF-26-041",
    ref: "LF-26-041",
    name: "Black phone",
    description: "Black phone, blue case, cracked corner",
    room: "204",
    spot: "bedside",
    photo: "foundPhoneCharger",
    holder: "Beatrice",
  },
];

const reportPlaces: ReportPlace[] = [
  { id: "204", label: "204", isRoom: true },
  { id: "211", label: "211", isRoom: true },
  { id: "206", label: "206", isRoom: true },
  { id: "209", label: "209", isRoom: true },
  { id: "corridor", label: "Corridor F2", isRoom: false },
];

const problemCategories: ProblemCategory[] = [
  { id: "plumbing", label: "Plumbing", icon: "Droplet" },
  { id: "electrical", label: "Electrical", icon: "Thunderbolt" },
  { id: "ac", label: "AC", icon: "Snowflake" },
  { id: "furniture", label: "Furniture", icon: "Hammer" },
  { id: "safety", label: "Safety", icon: "ShieldExclamation" },
  { id: "other", label: "Other", icon: "Ellipsis" },
];

const urgencyLevels: UrgencyLevel[] = [
  { id: "low", label: "Can wait", hint: "Fix in the next few days", tone: "info" },
  { id: "today", label: "Today", hint: "A guest would notice it", tone: "warning" },
  { id: "urgent", label: "Urgent", hint: "Water, power or safety risk right now", tone: "danger" },
];

const problemReports: ProblemReport[] = [
  {
    id: "WO-318",
    ticket: "WO-318",
    place: "112",
    category: "plumbing",
    urgency: "today",
    photos: 1,
    photo: "leakUnderBasin",
    photoCaption: "Under the sink · taken 10:51",
    description: "Water leaking under the sink. Floor is wet. I put a towel down and closed the tap.",
    askBlock: true,
    takenAt: "10:51",
    sentAt: "10:52",
    assignee: "Jean-Paul Niyonsaba",
    assigneeFirst: "Jean-Paul",
    manager: "Aline Uwase",
    managerFirst: "Aline",
  },
];

const shifts: Shift[] = [
  {
    id: "sun",
    week: 0,
    dow: "Sun",
    date: "12",
    long: "Mon 12 Oct",
    time: "07:00 – 15:00",
    area: "Floor 2 rooms · clocked in 07:02",
    isToday: true,
    isOff: false,
    swapPendingWith: null,
  },
  {
    id: "mon",
    week: 0,
    dow: "Mon",
    date: "13",
    long: "Tue 13 Oct",
    time: "07:00 – 15:00",
    area: "Floor 2 rooms",
    isToday: false,
    isOff: false,
    swapPendingWith: null,
  },
  {
    id: "tue",
    week: 0,
    dow: "Tue",
    date: "14",
    long: "Wed 14 Oct",
    time: null,
    area: null,
    isToday: false,
    isOff: true,
    swapPendingWith: null,
  },
  {
    id: "wed",
    week: 0,
    dow: "Wed",
    date: "15",
    long: "Thu 15 Oct",
    time: "07:00 – 15:00",
    area: "Floor 3 rooms",
    isToday: false,
    isOff: false,
    swapPendingWith: null,
  },
  {
    id: "thu",
    week: 0,
    dow: "Thu",
    date: "16",
    long: "Fri 16 Oct",
    time: "14:00 – 22:00",
    area: "Turndown · floors 2 and 3",
    isToday: false,
    isOff: false,
    swapPendingWith: "Chantal",
  },
  {
    id: "fri",
    week: 0,
    dow: "Fri",
    date: "17",
    long: "Sat 17 Oct",
    time: "07:00 – 15:00",
    area: "Floor 2 rooms",
    isToday: false,
    isOff: false,
    swapPendingWith: null,
  },
  {
    id: "sat",
    week: 0,
    dow: "Sat",
    date: "18",
    long: "Sun 18 Oct",
    time: null,
    area: null,
    isToday: false,
    isOff: true,
    swapPendingWith: null,
  },
];

/** No colleague is asking the housekeeper for a swap in the prototype. */
const swapAsks: SwapAsk[] = [];

/** The housekeeper has asked for no money back in the prototype. */
const claims: StaffClaim[] = [];

const swapColleagues: SwapColleague[] = [
  { id: "grace", initials: "GM", name: "Grace Mutoni", first: "Grace", note: "Free that day", busy: false },
  {
    id: "chantal",
    initials: "CU",
    name: "Chantal Uwamahoro",
    first: "Chantal",
    note: "Free that day · 1 swap with you this month",
    busy: false,
  },
  {
    id: "divine",
    initials: "DI",
    name: "Divine Ishimwe",
    first: "Divine",
    note: "Already working 07:00 – 15:00",
    busy: true,
  },
];

const requests: StaffRequest[] = [
  {
    id: "r1",
    shift: "thu",
    type: "Shift swap",
    icon: "ArrowRightArrowLeft",
    title: "Fri 16 Oct · 14:00 – 22:00",
    sub: "With Chantal Uwamahoro",
    status: "manager",
    steps: "Chantal said yes on 11 Oct · Beatrice to approve",
    days: 0,
  },
  {
    id: "r2",
    shift: null,
    type: "Annual leave",
    icon: "Suitcase",
    title: "Mon 3 – Thu 5 Nov · 3 days",
    sub: "Family visit in Huye",
    status: "manager",
    steps: "Beatrice first, then Diane (HR)",
    days: 3,
  },
  {
    id: "r4",
    shift: null,
    type: "Annual leave",
    icon: "Suitcase",
    title: "Mon 1 – Wed 2 Sep · 2 days",
    sub: "Personal",
    status: "approved",
    steps: "Beatrice on 20 Aug · Diane (HR) on 21 Aug",
    days: 2,
  },
  {
    id: "r5",
    shift: null,
    type: "Sick leave",
    icon: "Suitcase",
    title: "Tue 17 – Wed 18 Feb · 2 days",
    sub: "Flu",
    status: "approved",
    steps: "Beatrice on 10 Feb · Diane (HR) on 12 Feb",
    days: 2,
  },
];

const leaveTypes: LeaveType[] = [
  { id: "annual", label: "Annual", hint: "Uses your annual leave balance.", usesBalance: true },
  {
    id: "sick",
    label: "Sick",
    hint: "More than 2 days needs a doctor’s note. Add it in Me › Documents.",
    usesBalance: false,
  },
  {
    id: "circumstantial",
    label: "Circumstantial",
    hint: "For a death or serious illness in the family. HR may ask for details.",
    usesBalance: false,
  },
  {
    id: "maternity",
    label: "Maternity",
    hint: "Twelve weeks around the birth. HR confirms the dates with you.",
    usesBalance: false,
  },
  {
    id: "unpaid",
    label: "Unpaid",
    hint: "Does not use your balance. Your pay for those days is reduced.",
    usesBalance: false,
  },
];

const leaveBalances: LeaveBalance[] = [
  {
    id: "housekeeper",
    left: 12.5,
    used: 5.5,
    entitlement: 18,
    accrual: 1.5,
    carryOver: 3,
    carryYear: 2027,
    sickUsed: 2,
    nextHoliday: "Fri 25 Dec",
    rules: "Leave rules v2 · from 1 Jan",
    waitingFor: "Beatrice",
  },
];

const leaveApprovers: LeaveApprover[] = [
  { id: "beatrice", order: 1, initials: "BM", name: "Beatrice Mukandori", role: "Your line manager", tone: "success" },
  { id: "diane", order: 2, initials: "DI", name: "Diane Ingabire", role: "HR · checks your balance", tone: "default" },
];

const leaveDrafts: LeaveDraft[] = [
  {
    id: "christmas",
    from: "Tue 15 Dec 2026",
    to: "Sat 19 Dec 2026",
    workingDays: 5,
    title: "Mon 15 – Sat 19 Dec · 5 days",
    note: "Christmas with family in Huye.",
    busyDates:
      "Busy dates: 23 – 26 Oct (EAC Health Forum, hotel full). Leave on those days is less likely to be approved.",
  },
];

const slipLines: PayslipLine[] = [
  { label: "Basic salary", amount: 200000, kind: "earning" },
  { label: "Transport allowance", amount: 30000, kind: "earning" },
  { label: "Gross pay", amount: 230000, kind: "subtotal" },
  { label: "PAYE income tax", amount: 33000, kind: "deduction" },
  { label: "RSSB pension (you)", amount: 13800, kind: "deduction" },
  { label: "RSSB maternity (you)", amount: 690, kind: "deduction" },
  { label: "Community health (CBHI)", amount: 913, kind: "deduction" },
  { label: "Net pay", amount: 181597, kind: "total" },
];

const payslips: Payslip[] = [
  {
    id: "oct",
    month: "October 2026",
    status: "pending",
    note: "Diane has prepared the pay run. Your payslip appears after the owner confirms it, by 22 Oct.",
    net: null,
    paid: null,
    ref: null,
    confirmed: null,
    confirmedBy: null,
    employer: "Amahoro Hospitality Ltd · TIN 102 345 678",
    rules: "Payroll rules v3 (from 1 Jan 2026)",
    payTo: "MTN MoMo 078 *** 4412",
    lines: [],
  },
  {
    id: "sep",
    month: "September 2026",
    status: "available",
    note: null,
    net: 181597,
    paid: "30 Sep",
    ref: "MP260930.1102.C55821",
    confirmed: "27 Sep",
    confirmedBy: "Didier Mugenzi",
    employer: "Amahoro Hospitality Ltd · TIN 102 345 678",
    rules: "Payroll rules v3 (from 1 Jan 2026)",
    payTo: "MTN MoMo 078 *** 4412",
    lines: slipLines,
  },
  {
    id: "aug",
    month: "August 2026",
    status: "available",
    note: null,
    net: 181597,
    paid: "29 Aug",
    ref: "MP260829.0947.A10377",
    confirmed: "26 Aug",
    confirmedBy: "Didier Mugenzi",
    employer: "Amahoro Hospitality Ltd · TIN 102 345 678",
    rules: "Payroll rules v3 (from 1 Jan 2026)",
    payTo: "MTN MoMo 078 *** 4412",
    lines: slipLines,
  },
];

const documents: StaffDocument[] = [
  {
    id: "contract",
    icon: "FileText",
    name: "Employment contract",
    meta: "Signed 3 Mar 2024 · permanent",
    chip: "Signed",
    tone: "default",
  },
  {
    id: "national-id",
    icon: "Passport",
    name: "National ID copy",
    meta: "Checked by HR · 4 Mar 2024",
    chip: "Checked",
    tone: "default",
  },
  {
    id: "rssb",
    icon: "ShieldCheck",
    name: "RSSB registration",
    meta: "Member since Mar 2024",
    chip: "On file",
    tone: "default",
  },
  {
    id: "food-hygiene",
    icon: "GraduationCap",
    name: "Food hygiene certificate",
    meta: "Expires 14 Feb 2027",
    chip: "Valid",
    tone: "success",
  },
];

const assets: LoanedAsset[] = [
  {
    id: "key-card",
    icon: "Key",
    name: "Floor 2 master key card",
    meta: "Signed out 06:55 today · return by 15:00",
    chip: "Return today",
    tone: "warning",
  },
  {
    id: "uniform",
    icon: "TShirt",
    name: "Uniform set × 2",
    meta: "Since 3 Mar 2024",
    chip: "With you",
    tone: "default",
  },
  {
    id: "phone",
    icon: "Smartphone",
    name: "Staff phone, Samsung A15",
    meta: "Since 2 Jun 2026 · ends 4471",
    chip: "With you",
    tone: "default",
  },
];

const helpTickets: HelpTicket[] = [
  {
    id: "HD-0927",
    title: "Uniform size change",
    meta: "HD-0927 · with Diane · opened 8 Oct",
    chip: "Open",
    tone: "warning",
  },
];

const helpTopics: HelpTopic[] = [
  { id: "pay", label: "Pay", draft: "" },
  { id: "uniform", label: "Uniform", draft: "" },
  { id: "leave", label: "Leave", draft: "" },
  { id: "phone", label: "Phone or app", draft: "" },
  { id: "other", label: "Other", draft: "" },
];

const inspectionRooms: InspectionRoom[] = [
  {
    id: "207",
    no: "207",
    cleanedBy: "Jeanne Nyiraneza",
    cleanedByFirst: "Jeanne",
    initials: "JN",
    type: "Deluxe Lake View",
    cleaned: "Cleaned 09:50",
    wait: "1 h 22 min",
    arrival: "Arrival 13:00",
    late: true,
    skip: "Jeanne marked it clean with 1 check skipped: balcony glass.",
    results: {
      bath: "pass",
      towels: "pass",
      bed: "pass",
      floor: "pass",
      dust: "pass",
      glass: "fail",
      amen: "pass",
      minibar: "pass",
      tech: "pass",
    },
    photos: ["glass"],
    outcome: "return",
    note: "Smudges on the balcony glass, inside and outside. Please wipe both sides.",
  },
  {
    id: "102",
    no: "102",
    cleanedBy: "Vestine Mukarugwiza",
    cleanedByFirst: "Vestine",
    initials: "VM",
    type: "Standard Queen",
    cleaned: "Cleaned 10:48",
    wait: "24 min",
    arrival: "Arrival 14:00",
    late: false,
    skip: null,
    results: {},
    photos: [],
    outcome: null,
    note: "",
  },
  {
    id: "309",
    no: "309",
    cleanedBy: "Emmanuel Nsengimana",
    cleanedByFirst: "Emmanuel",
    initials: "EN",
    type: "Twin",
    cleaned: "Cleaned 11:02",
    wait: "10 min",
    arrival: "No arrival today",
    late: false,
    skip: null,
    results: {},
    photos: [],
    outcome: null,
    note: "",
  },
  {
    id: "403",
    no: "403",
    cleanedBy: "Odette Uwamahoro",
    cleanedByFirst: "Odette",
    initials: "OU",
    type: "Family Suite",
    cleaned: "Cleaned 11:08",
    wait: "4 min",
    arrival: "Arrival 15:00",
    late: false,
    skip: null,
    results: {},
    photos: [],
    outcome: null,
    note: "",
  },
];

const inspectionChecks: InspectionCheck[] = [
  { id: "bath", label: "Bathroom clean, no hair or marks", photo: null },
  { id: "towels", label: "Towels and bath mat complete", photo: null },
  { id: "bed", label: "Bed made, linen without stains", photo: null },
  { id: "floor", label: "Floor clean, also under the bed", photo: null },
  { id: "dust", label: "Surfaces free of dust", photo: null },
  { id: "glass", label: "Balcony door and glass clear", photo: "balconyGlassDoor" },
  { id: "amen", label: "Amenities complete", photo: null },
  { id: "minibar", label: "Minibar matches the count", photo: null },
  { id: "tech", label: "Lights, AC and TV work", photo: null },
  { id: "smell", label: "Fresh smell, windows closed", photo: null },
];

const issued = (name: string, qty: string, meta: string): WorkOrderPart => ({
  name,
  qty,
  meta,
  chip: "Issued",
  tone: "default",
});

const workOrders: WorkOrder[] = [
  {
    id: "318",
    ref: "WO-318",
    where: "Room 112",
    what: "Basin leak",
    icon: "Droplet",
    priority: "Urgent",
    status: "new",
    age: "20 min",
    opened: "Opened today 10:52",
    from: "Jeanne Nyiraneza, housekeeping",
    photos: [{ caption: "Under the sink", image: "leakUnderBasin" }],
    block: {
      tone: "warning",
      title: "Out-of-order request waiting",
      text: "Jeanne asked to block room 112. It stays on sale until Aline approves. Arrival at 14:00.",
      chip: "Still on sale",
      keep: "The request stays with Aline to decide.",
    },
    recommendation: null,
    parts: [],
    log: [],
    repair: null,
    timeTotal: null,
    notes: [
      {
        initials: "JN",
        who: "Jeanne Nyiraneza",
        when: "10:52",
        text: "Water leaking under the sink. Floor is wet. I put a towel down and closed the tap.",
      },
    ],
    fix: "Replaced the sink trap washer. No leak after 10 minutes of running water.",
  },
  {
    id: "324",
    ref: "WO-324",
    where: "Room 302",
    what: "Window latch",
    icon: "Wrench",
    priority: "High",
    status: "parts",
    age: "18 h",
    opened: "Opened Wed 14 Oct 16:40",
    from: "Eric Habimana, front desk",
    photos: [],
    block: {
      tone: "warning",
      title: "Out-of-order request waiting",
      text: "The window does not lock. It stays on sale until Aline approves.",
      chip: "Still on sale",
      keep: "The request stays with Aline to decide.",
    },
    recommendation: {
      title: "Replace the latch and check the hinges on the same frame.",
      why: "Why: 2 window faults in 60 days on floor 3.",
      confidence: "Medium · rule based, 1 data source",
      reviewed: "Aline Uwase · advice only",
      note: "It does not create work or block rooms by itself.",
    },
    parts: [
      issued("Window latch, aluminium", "× 1", "Issued by Patrick · today 08:40"),
      {
        name: "Hinge set",
        qty: "× 2",
        meta: "Requested from store",
        chip: "Requested",
        tone: "warning",
      },
    ],
    log: [{ what: "Diagnosis", when: "Wed 14 Oct · 17:05 – 17:50", dur: "45 min" }],
    repair: { start: "08:30", stopped: "09:12", dur: "42 min" },
    timeTotal: "1 h 27 min total",
    notes: [
      {
        initials: "EH",
        who: "Eric Habimana",
        when: "Wed 16:40",
        text: "Guest in 302 says the window does not lock.",
      },
    ],
    fix: "Replaced the latch. The window locks and opens cleanly.",
  },
  {
    id: "325",
    ref: "WO-325",
    where: "Kivu Hall",
    what: "Projector flicker",
    icon: "Display",
    priority: "Normal",
    status: "parts",
    age: "2 days",
    opened: "Opened Sat 10 Oct 09:12",
    from: "Aline Uwase, manager",
    photos: [],
    block: null,
    recommendation: null,
    parts: [
      {
        name: "HDMI cable 10 m",
        qty: "× 1",
        meta: "Ordered by Patrick · PO-26-0142",
        chip: "On order",
        tone: "warning",
      },
    ],
    log: [{ what: "Diagnosis", when: "Sat 10 Oct · 10:00 – 10:30", dur: "30 min" }],
    repair: null,
    timeTotal: "30 min total",
    notes: [],
    fix: "Replaced HDMI cable. Tested for 30 minutes, no flicker.",
  },
  {
    id: "326",
    ref: "WO-326",
    where: "Lake Bar",
    what: "Ice machine leak",
    icon: "Wrench",
    priority: "High",
    status: "new",
    age: "1 h",
    opened: "Opened today 11:30",
    from: "Joseph Habimana, Lake Bar",
    photos: [],
    block: null,
    recommendation: null,
    parts: [],
    log: [],
    repair: null,
    timeTotal: null,
    notes: [],
    fix: "",
  },
];

const storeParts: StorePart[] = [
  { id: "fan-motor", name: "Fan motor 1/6 hp", stock: "2 in store", available: true },
  { id: "contactor", name: "Contactor 25 A", stock: "5 in store", available: true },
  { id: "insulation", name: "Pipe insulation, 1 m", stock: "14 in store", available: true },
  { id: "drain-pump", name: "Condensate drain pump", stock: "Out of stock · ask Patrick to order", available: false },
];

const kiosks: Kiosk[] = [
  {
    id: "isangano-staff-entrance",
    hotel: "Isangano Lakeside Hotel",
    place: "Staff entrance · clock-in",
    time: "07:02",
    date: "Monday 12 October 2026",
    queued: 3,
    resetSeconds: 10,
    demoStaff: "housekeeper",
  },
];

export const fixtures = {
  "staff.profiles": profiles,
  "staff.rooms": rooms,
  "staff.finishedRooms": finishedRooms,
  "staff.checklistSections": checklistSections,
  "staff.minibarItems": minibarItems,
  "staff.foundSpots": foundSpots,
  "staff.foundItems": foundItems,
  "staff.reportPlaces": reportPlaces,
  "staff.problemCategories": problemCategories,
  "staff.urgencyLevels": urgencyLevels,
  "staff.problemReports": problemReports,
  "staff.shifts": shifts,
  "staff.swapColleagues": swapColleagues,
  "staff.swapAsks": swapAsks,
  "staff.claims": claims,
  "staff.requests": requests,
  "staff.leaveTypes": leaveTypes,
  "staff.leaveBalances": leaveBalances,
  "staff.leaveApprovers": leaveApprovers,
  "staff.leaveDrafts": leaveDrafts,
  "staff.payslips": payslips,
  "staff.documents": documents,
  "staff.assets": assets,
  "staff.helpTickets": helpTickets,
  "staff.helpTopics": helpTopics,
  "staff.inspectionRooms": inspectionRooms,
  "staff.inspectionChecks": inspectionChecks,
  "staff.workOrders": workOrders,
  "staff.storeParts": storeParts,
  "staff.kiosks": kiosks,
} satisfies FixtureSet;
