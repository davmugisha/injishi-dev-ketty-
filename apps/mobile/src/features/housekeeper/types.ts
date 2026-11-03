// The view models the staff phone screens read (the housekeeper app, and its Me, schedule, leave, PIN and
// hours screens mounted in the supervisor and technician apps). Screens read these through `data.ts`
// only; the sample data and the real reads both answer in these shapes.

import type { IconName, RoomStatus, Tone } from "@/components/ui";
import type { ProtoImage } from "@/proto/images";
import type { AppKey } from "@/proto/screens";

/** The three staff apps that mount the shared staff screens (routes.json `alt`). */
export type StaffApp = Extract<AppKey, "housekeeper" | "supervisor" | "technician">;

/** Whose phone this is: the header's avatar and name, the Me screen's card. */
export interface StaffPerson {
  /** "Jeanne N.": the header's short name. */
  name: string;
  /** "Jeanne Nyiraneza": the Me screen's name. */
  fullName: string;
  /** "Housekeeper · Isangano Lakeside". */
  role: string;
  /** "Amahoro Hospitality Ltd". */
  employer: string | null;
  /** "Floor 2 · Isangano": the header's second line. */
  place: string;
  portrait: ProtoImage | null;
  /** The initials' tint when there is no portrait. */
  tone: Tone;
}

/** The header's outbox chip: "2 waiting" or "All sent". */
export interface SyncState {
  label: string;
  tone: "success" | "warning" | "danger";
  waiting: number;
}

/** A chip on a card ("Arrival 14:00", "Returning guest"). */
export interface ChipModel {
  label: string;
  tone: Tone;
  icon?: IconName;
}

/** One room in a list (`.sx-room`): its number, two lines, and its state as a pill (or a quiet chip). */
export interface RoomLine {
  room: string;
  title: string;
  detail: string;
  status: RoomStatus;
  /** Words for the pill when they say more than the state ("DND 11:00"). */
  statusLabel?: string;
  /** Drawn as a quiet "Later" chip instead of the pill (a deep clean saved for the afternoon). */
  later?: boolean;
}

/** Before the shift, or when there is no shift to show as running: the clock in card. */
export type ShiftCard =
  | {
      kind: "before";
      /** "07:00 – 15:00". */
      span: string;
      /** "Housekeeping · Floor 2 · break at 11:30". */
      detail: string;
      /** "Starts in 2 min". */
      chip: string;
      /** The location check under the card; null when the phone has none. */
      location: { title: string; detail: string } | null;
    }
  | { kind: "no-shift" }
  | { kind: "clocked-out"; at: string; saved: boolean }
  /** No employee file in this workspace: nothing to punch on. */
  | { kind: "not-set-up" }
  /** The copy on the phone is from an earlier day and cannot be refreshed. */
  | { kind: "stale" };

/** On shift: the deep card at the top of Today. */
export interface OnShift {
  /** "07:02". */
  since: string;
  /** "Ends 15:00 · break at 11:30". */
  detail: string;
  /** The clock in is still on this phone. */
  saved: boolean;
  /** The manager confirms this clock in (it was made away from the place). */
  confirmLater: boolean;
  /** On a break since this time, else null. */
  breakSince: string | null;
  /** Whether breaks can be started from the phone yet. */
  canBreak: boolean;
}

/** The supervisor's briefing (S2). */
export interface Briefing {
  /** "Beatrice". */
  from: string;
  /** "06:45". */
  at: string;
  /** The full words, shown before the shift. */
  body: string;
  /** The short words, shown on shift. */
  short: string;
}

/** The next room: the big card on Today. */
export interface NextRoom {
  room: string;
  /** "Checkout · Deluxe Lake View · 2 adults". */
  detail: string;
  arrival: string | null;
  chips: ChipModel[];
  /** Cleaning has started: the button says Continue. */
  started: boolean;
}

/** Today's rooms, when the phone has a room list. */
export interface TodayRooms {
  done: number;
  total: number;
  /** "7 checkouts · 4 stayovers · 1 deep clean". */
  mix: string;
  next: NextRoom | null;
  /** The rooms after the next one, a few of them. */
  upcoming: RoomLine[];
  /** How many rooms are left after the next one. */
  more: number;
  /** The rooms cleaned today, by number. */
  doneRooms: string[];
}

/** The housekeeper's Today, before the shift (clock in) and on it. */
export interface TodayView {
  person: StaffPerson;
  sync: SyncState;
  /** "Monday 12 October". */
  day: string;
  /** "Good morning". */
  greeting: string;
  firstName: string;
  /** Who the punches are for (the employee file); null when there is none. */
  employeeId: string | null;
  /** On shift; null before it (then `shift` says what is next). */
  onShift: OnShift | null;
  shift: ShiftCard | null;
  /** The clock in button's time ("06:58"), or null to say "Clock in again". */
  clockInAt: string | null;
  briefing: Briefing | null;
  rooms: TodayRooms | null;
  /** Report a problem and the bell are there (they wait for their features in api mode). */
  canReport: boolean;
  hasInbox: boolean;
  /** A kept copy on screen while the API cannot be reached: "07:40". */
  asOf: string | null;
}

/** My rooms: the whole list in cleaning order, then waiting for inspection, then ready to sell. */
export interface RoomsView {
  /** "Floor 2 · Mon 12 Oct". */
  eyebrow: string;
  todo: RoomLine[];
  waiting: RoomLine[];
  ready: RoomLine[];
}

export interface CheckItem {
  id: string;
  label: string;
  done: boolean;
}

export interface CheckGroup {
  key: string;
  title: string;
  items: CheckItem[];
}

export interface MinibarItem {
  key: string;
  label: string;
  count: number;
}

/** A room being cleaned (hk-task). */
export interface TaskView {
  room: string;
  /** "Checkout · Deluxe Lake View". */
  subtitle: string;
  /** The offline strip's words, or null with signal. */
  offline: string | null;
  /** Time in the room: seconds counted when this was read, and whether it still runs. */
  timer: { seconds: number; running: boolean; readAt: number };
  /** "Usual for a checkout: 25 min". */
  usual: string;
  /** "Arrival 14:00", or null. */
  arrival: string | null;
  groups: CheckGroup[];
  minibar: MinibarItem[];
  /** Cleaned already (opened again after Mark clean). */
  cleaned: boolean;
}

/** After Mark clean (hk-task-done). */
export interface TaskDoneView {
  room: string;
  minutes: number;
  /** "10:58". */
  at: string;
  checks: { done: number; total: number };
  minibarSent: boolean;
  next: RoomLine | null;
  /** Rooms still to clean. */
  left: number;
}

/** Found an item (hk-found). */
export interface FoundView {
  room: string;
  /** The room is on her list (closing returns to its task), or not (closing returns to Today). */
  onList: boolean;
  photo: ProtoImage;
  /** The photo's chip: "Photo · small file, sends on weak signal". */
  photoNote: string;
  /** What it most likely is, prefilled. */
  what: string;
  places: string[];
  place: string;
}

export type ProblemCategory = "plumbing" | "electrical" | "ac" | "furniture" | "safety" | "other";
export type Urgency = "wait" | "today" | "urgent";

/** Report a problem (hk-report). */
export interface ReportView {
  /** The offline strip, or null with signal. */
  offline: string | null;
  /** Where: her rooms, then the corridor. */
  places: string[];
  place: string;
  categories: { value: ProblemCategory; label: string; icon: IconName }[];
  category: ProblemCategory;
  urgency: Urgency;
  photo: { image: ProtoImage; note: string; size: string } | null;
  note: string;
}

/** What Report a problem saves. */
export interface ReportInput {
  place: string;
  category: ProblemCategory;
  urgency: Urgency;
  note: string;
  photo: boolean;
}

/** The report just saved (hk-report-saved). */
export interface ReportSavedView {
  /** "Electrical · corridor F2". */
  problem: string;
  urgency: string;
  /** "1 · 180 KB", or "None". */
  photo: string;
  /** "10:09". */
  savedAt: string;
  /** It reached maintenance: its ticket number, else null. */
  ticket: string | null;
}

/** One day of the week strip. */
export interface WeekDay {
  key: string;
  /** "Mon". */
  day: string;
  /** "12". */
  date: string;
  /** A shift, a rest day, or a day with something to look at (a swap waiting). */
  mark: "work" | "off" | "warn";
  today: boolean;
}

/** One shift in "This week". */
export interface ScheduleShift {
  key: string;
  title: string;
  detail: string;
  chip: ChipModel | null;
  /** Can be offered for a swap. */
  swappable: boolean;
}

/** Schedule and leave (hk-schedule). */
export interface ScheduleView {
  /** "12 – 18 October". */
  range: string;
  week: WeekDay[];
  next: { title: string; detail: string } | null;
  /** "This week", "Next week". */
  listTitle: string;
  shifts: ScheduleShift[];
  leave: {
    left: number;
    total: number;
    resets: string;
    booked: { value: string; unit: string; status: string; tone: "success" | "warning" } | null;
  };
  holiday: string;
}

/** Someone who approves leave, in order. */
export interface Approver {
  initials: string;
  name: string;
  /** "1 · your line manager". */
  role: string;
  tone: Tone;
}

/** Ask for leave (hk-leave). */
export interface LeaveView {
  /** Annual leave left. */
  balance: number;
  /** The first day leave can start (tomorrow), `YYYY-MM-DD`. */
  earliest: string;
  /** The suggested dates, `YYYY-MM-DD`. */
  from: string;
  to: string;
  notePlaceholder: string;
  approvers: Approver[];
  /** The first approver's first name, for "You can cancel it until Beatrice answers". */
  firstApprover: string;
}

export type LeaveType = "annual" | "sick" | "other";

export interface LeaveInput {
  type: LeaveType;
  from: string;
  to: string;
  days: number;
  note: string;
}

/** A row of the Me screen. */
export interface MeRow {
  key: string;
  icon: IconName;
  tone: Tone;
  title: string;
  subtitle: string;
  /** A count badge at the end ("1 punch to fix"). */
  count?: number;
  /** Locked behind the PIN. */
  locked?: boolean;
  /** What the row opens into, line by line (My documents, Assets on loan). */
  details?: string[];
}

/** Me (hk-me): the person, then three groups of rows. Each row is opened by its key. */
export interface MeView {
  person: StaffPerson;
  work: MeRow[];
  files: MeRow[];
  phone: MeRow[];
}

/** The payslip PIN (hk-pin). */
export interface PinView {
  length: number;
  reason: string;
  forgot: string;
  canFingerprint: boolean;
}

/** One claim or loan on the hours screen. */
export interface ClaimLine {
  key: string;
  icon: IconName;
  tone: Tone;
  title: string;
  subtitle: string;
  amount: string | null;
  chip: ChipModel | null;
  /** A loan's share repaid, 0 to 100. */
  repaid: number | null;
}

/** Hours, pay, claims and loans (hk-hours). */
export interface HoursView {
  month: string;
  hours: number;
  target: number;
  status: string;
  /** "6 h overtime · 1 late arrival". */
  detail: string;
  /** "Paid on 30 Oct". */
  paid: string;
  /** A punch to fix; null when every punch is in. */
  missed: { title: string; body: string; time: string; asked: boolean } | null;
  payslip: {
    title: string;
    rows: { label: string; value: string }[];
    net: string;
    saved: boolean;
  };
  claims: ClaimLine[];
}
