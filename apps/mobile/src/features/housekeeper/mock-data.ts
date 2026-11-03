// The staff phones' sample data, copied from the prototype (`c-staff.mjs`): Jeanne's floor at Isangano
// Lakeside on Mon 12 Oct 2026, and the Me, schedule, leave, PIN and hours of Jeanne, Beatrice and
// Jean-Paul. Imported only by `data.ts`. The writes below change this module's state and every read
// returns new objects, so a clicked-through flow (clock in, tick, mark clean, report) shows its change.

import { rwf } from "@/lib/money";
import type {
  Approver,
  CheckGroup,
  ClaimLine,
  FoundView,
  HoursView,
  LeaveInput,
  LeaveView,
  MeRow,
  MeView,
  MinibarItem,
  NextRoom,
  PinView,
  ProblemCategory,
  ReportInput,
  ReportSavedView,
  ReportView,
  RoomLine,
  RoomsView,
  ScheduleShift,
  ScheduleView,
  StaffApp,
  StaffPerson,
  SyncState,
  TaskDoneView,
  TaskView,
  TodayRooms,
  TodayView,
  Urgency,
  WeekDay,
} from "./types";

// ---------- people

const PEOPLE: Record<StaffApp, StaffPerson> = {
  housekeeper: {
    name: "Jeanne N.",
    fullName: "Jeanne Nyiraneza",
    role: "Housekeeper · Isangano Lakeside",
    employer: "Amahoro Hospitality Ltd",
    place: "Floor 2 · Isangano",
    portrait: "staff-portrait",
    tone: "accent",
  },
  supervisor: {
    name: "Beatrice M.",
    fullName: "Beatrice Mukandori",
    role: "Floor supervisor · Isangano Lakeside",
    employer: "Amahoro Hospitality Ltd",
    place: "Floor 2 · Isangano",
    portrait: null,
    tone: "success",
  },
  technician: {
    name: "Jean-Paul",
    fullName: "Jean-Paul",
    role: "Maintenance technician · Isangano Lakeside",
    employer: "Amahoro Hospitality Ltd",
    place: "All buildings · Isangano",
    portrait: null,
    tone: "info",
  },
};

// ---------- the floor's state

type RoomKind = "Checkout" | "Stayover" | "Deep clean";
type RoomPhase = "todo" | "cleaning" | "clean" | "ready";

interface MockRoom {
  room: string;
  kind: RoomKind;
  type: string;
  arrival: string | null;
  guests: string;
  /** The rooms list's second line while it is to do. */
  listNote: string;
  /** Today's second line, a little longer. */
  todayNote: string;
  returning: boolean;
  dnd: string | null;
  later: boolean;
  phase: RoomPhase;
  cleanedAt: string | null;
  inspectedAt: string | null;
  /** Time in the room: seconds banked, and since when it runs (null: paused or not started). */
  timer: { banked: number; since: number | null };
  groups: CheckGroup[];
  minibar: MinibarItem[];
  /** Kept when it is marked clean, for the done screen. */
  finished: { minutes: number; at: string; done: number; total: number } | null;
}

const USUAL: Record<RoomKind, number> = { Checkout: 25, Stayover: 12, "Deep clean": 60 };

function items(prefix: string, labels: string[], done: boolean | boolean[]) {
  return labels.map((label, i) => ({
    id: `${prefix}-${i + 1}`,
    label,
    done: Array.isArray(done) ? (done[i] ?? false) : done,
  }));
}

/** The checkout list, ticked or not; 204's own adds the VIP extras from the briefing. */
function checkoutGroups(room: string, done: boolean): CheckGroup[] {
  return [
    {
      key: "bathroom",
      title: "Bathroom",
      items: items(
        `${room}-bath`,
        [
          "Toilet cleaned and disinfected",
          "Shower, glass and drain cleaned",
          "Sink, mirror and taps polished",
          "Floor mopped, bin emptied",
        ],
        done,
      ),
    },
    {
      key: "bedroom",
      title: "Bedroom",
      items: items(
        `${room}-bed`,
        [
          "Desk, bedside and wardrobe dusted",
          "Balcony door and glass wiped",
          "Floor vacuumed, also under the bed",
          "Lights, AC and TV remote work",
        ],
        done,
      ),
    },
    {
      key: "linen",
      title: "Linen",
      items: items(
        `${room}-linen`,
        ["Bed remade with fresh sheets", "Towels: 2 bath, 2 hand, 1 mat", "Used linen bagged for laundry"],
        done,
      ),
    },
  ];
}

function stayoverGroups(room: string): CheckGroup[] {
  return [
    {
      key: "tidy",
      title: "Tidy",
      items: items(
        `${room}-tidy`,
        ["Bed made, guest's things left where they are", "Bins emptied", "Surfaces wiped, cups washed"],
        false,
      ),
    },
    {
      key: "bathroom",
      title: "Bathroom",
      items: items(`${room}-bath`, ["Toilet and sink cleaned", "Towels on the floor changed"], false),
    },
  ];
}

function deepCleanGroups(room: string): CheckGroup[] {
  return [
    {
      key: "deep",
      title: "Deep clean",
      items: items(
        `${room}-deep`,
        [
          "Curtains taken down for laundry",
          "Mattress turned and protector changed",
          "Behind the bed and wardrobe vacuumed",
          "Skirting and vents wiped",
        ],
        false,
      ),
    },
    ...checkoutGroups(room, false),
  ];
}

const EMPTY_MINIBAR = (): MinibarItem[] => [
  { key: "water", label: "Water", count: 0 },
  { key: "soft", label: "Soft drink", count: 0 },
  { key: "beer", label: "Beer", count: 0 },
  { key: "snack", label: "Snacks", count: 0 },
];

function room(
  r: Partial<MockRoom> & Pick<MockRoom, "room" | "kind" | "type" | "listNote" | "todayNote">,
): MockRoom {
  const groups =
    r.groups ??
    (r.kind === "Checkout"
      ? checkoutGroups(r.room, false)
      : r.kind === "Stayover"
        ? stayoverGroups(r.room)
        : deepCleanGroups(r.room));
  return {
    arrival: null,
    guests: "2 adults",
    returning: false,
    dnd: null,
    later: false,
    phase: "todo",
    cleanedAt: null,
    inspectedAt: null,
    timer: { banked: 0, since: null },
    minibar: EMPTY_MINIBAR(),
    finished: null,
    ...r,
    groups,
  };
}

/** 204: 18:42 in the room, 12 of 15 checks (the VIP extras included), three minibar items. */
function room204(): MockRoom {
  const base = checkoutGroups("204", true);
  const [bathroom, bedroom, linen] = base;
  return room({
    room: "204",
    kind: "Checkout",
    type: "Deluxe Lake View",
    arrival: "14:00",
    listNote: "Deluxe Lake View · VIP",
    todayNote: "Deluxe Lake View · VIP",
    returning: true,
    phase: "cleaning",
    timer: { banked: 18 * 60 + 42, since: Date.now() },
    groups: [
      bathroom,
      { ...bedroom, items: bedroom.items.map((item, i) => ({ ...item, done: i < 3 })) },
      { ...linen, items: linen.items.map((item, i) => ({ ...item, done: i < 1 })) },
      {
        key: "vip",
        title: "Guest extras · VIP",
        items: items(
          "204-vip",
          [
            "Lake-view pillows on the bed",
            "Welcome note on the desk",
            "2 bottles of water by the bed",
            "Robe and slippers laid out",
          ],
          true,
        ),
      },
    ],
    minibar: [
      { key: "water", label: "Water", count: 2 },
      { key: "soft", label: "Soft drink", count: 1 },
      { key: "beer", label: "Beer", count: 0 },
      { key: "snack", label: "Snacks", count: 0 },
    ],
  });
}

function startRooms(): MockRoom[] {
  return [
    room204(),
    room({
      room: "211",
      kind: "Checkout",
      type: "Garden Double",
      guests: "2 adults, extra bed",
      listNote: "Extra bed to remove",
      todayNote: "Guest left 09:40 · extra bed to remove",
    }),
    room({
      room: "206",
      kind: "Stayover",
      type: "Deluxe Lake View",
      dnd: "11:00",
      listNote: "Towels only · after 11:00",
      todayNote: "Do not disturb until 11:00 · towels only",
    }),
    room({
      room: "207",
      kind: "Checkout",
      type: "Garden Twin",
      arrival: "16:00",
      listNote: "Twin",
      todayNote: "Arrival 16:00",
    }),
    room({
      room: "202",
      kind: "Stayover",
      type: "Garden Double",
      listNote: "Guest out until 15:00",
      todayNote: "Guest out until 15:00",
    }),
    room({
      room: "209",
      kind: "Deep clean",
      type: "Junior Suite",
      later: true,
      listNote: "Curtains, mattress turn",
      todayNote: "Monthly · curtains and mattress turn",
    }),
    room({
      room: "212",
      kind: "Stayover",
      type: "Deluxe Lake View",
      listNote: "Late breakfast, after 12:00",
      todayNote: "Late breakfast, after 12:00",
    }),
    room({
      room: "201",
      kind: "Checkout",
      type: "Deluxe Lake View",
      arrival: "13:00",
      listNote: "",
      todayNote: "",
      phase: "clean",
      cleanedAt: "10:20",
      groups: checkoutGroups("201", true),
    }),
    room({
      room: "205",
      kind: "Checkout",
      type: "Garden Double",
      arrival: "15:30",
      listNote: "",
      todayNote: "",
      phase: "clean",
      cleanedAt: "09:40",
      groups: checkoutGroups("205", true),
    }),
    room({
      room: "208",
      kind: "Stayover",
      type: "Garden Twin",
      listNote: "",
      todayNote: "",
      phase: "clean",
      cleanedAt: "10:02",
    }),
    room({
      room: "203",
      kind: "Checkout",
      type: "Deluxe Lake View",
      listNote: "",
      todayNote: "",
      phase: "ready",
      cleanedAt: "08:55",
      inspectedAt: "09:30",
      groups: checkoutGroups("203", true),
    }),
    room({
      room: "210",
      kind: "Checkout",
      type: "Garden Double",
      listNote: "",
      todayNote: "",
      phase: "ready",
      cleanedAt: "09:35",
      inspectedAt: "10:05",
      groups: checkoutGroups("210", true),
    }),
  ];
}

interface FoundItem {
  room: string;
  what: string;
  place: string;
}

interface SavedReport {
  problem: string;
  urgency: string;
  photo: string;
  savedAt: string;
}

interface LeaveAsked {
  from: string;
  to: string;
  days: number;
}

const state = {
  rooms: startRooms(),
  /** Clocked in since (on shift), or null. Today opens on shift; `phase=before-shift` shows the clock in. */
  since: "07:02" as string | null,
  clockedOutAt: null as string | null,
  breakSince: null as string | null,
  /** Writes saved on the phone and not yet sent: the header's "2 waiting". */
  waiting: 2,
  /** The prototype's clock, moved on by each write that needs a time. */
  clock: 10 * 60 + 58,
  found: [] as FoundItem[],
  report: null as SavedReport | null,
  scheduleSeen: false,
  swaps: new Set<string>(),
  leave: { housekeeper: null, supervisor: null, technician: null } as Record<StaffApp, LeaveAsked | null>,
  fixAsked: { housekeeper: false, supervisor: false, technician: false } as Record<StaffApp, boolean>,
  payslipSaved: { housekeeper: false, supervisor: false, technician: false } as Record<StaffApp, boolean>,
  claims: { housekeeper: 0, supervisor: 0, technician: 0 } as Record<StaffApp, number>,
};

function hhmm(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** The time for a write: the prototype's clock, moved on a few minutes each time. */
function tick(minutes: number): string {
  const at = hhmm(state.clock);
  state.clock += minutes;
  return at;
}

function seconds(timer: MockRoom["timer"], now: number): number {
  return Math.floor(timer.banked + (timer.since === null ? 0 : (now - timer.since) / 1000));
}

function findRoom(number: string): MockRoom | undefined {
  return state.rooms.find((r) => r.room === number);
}

function todo(): MockRoom[] {
  return state.rooms.filter((r) => r.phase === "todo" || r.phase === "cleaning");
}

function sync(waiting: number): SyncState {
  return waiting > 0
    ? { label: `${waiting} waiting`, tone: "warning", waiting }
    : { label: "All sent", tone: "success", waiting: 0 };
}

// ---------- room lines

function statusOf(r: MockRoom): Pick<RoomLine, "status" | "statusLabel"> {
  if (r.phase === "cleaning") return { status: "cleaning" };
  if (r.phase === "clean") return { status: "clean" };
  if (r.phase === "ready") return { status: "ready" };
  if (r.dnd) return { status: "dnd", statusLabel: `DND ${r.dnd}` };
  return { status: "dirty" };
}

function todoLine(r: MockRoom): RoomLine {
  return {
    room: r.room,
    title: r.arrival ? `${r.kind} · arrival ${r.arrival}` : r.kind,
    detail: r.listNote,
    ...statusOf(r),
  };
}

function todayLine(r: MockRoom): RoomLine {
  return { room: r.room, title: r.kind, detail: r.todayNote, ...statusOf(r), later: r.later && r.phase === "todo" };
}

/** Rooms waiting for Beatrice: the earliest arrival is inspected first. */
function waitingLines(): RoomLine[] {
  const waiting = state.rooms
    .filter((r) => r.phase === "clean")
    .sort((a, b) => (b.cleanedAt ?? "").localeCompare(a.cleanedAt ?? ""));
  const firstArrival = waiting
    .map((r) => r.arrival)
    .filter((a): a is string => a !== null)
    .sort()[0];
  return waiting.map((r) => ({
    room: r.room,
    title: `Cleaned ${r.cleanedAt ?? ""}`,
    detail: r.arrival
      ? `Arrival ${r.arrival}${r.arrival === firstArrival ? " · inspection first" : ""}`
      : "No arrival today",
    status: "clean",
  }));
}

function readyLines(): RoomLine[] {
  return state.rooms
    .filter((r) => r.phase === "ready")
    .map((r) => ({ room: r.room, title: `Inspected ${r.inspectedAt ?? ""}`, detail: "By Beatrice", status: "ready" }));
}

function nextRoom(r: MockRoom): NextRoom {
  const chips: NextRoom["chips"] =
    r.kind === "Checkout"
      ? [
          { label: "Checkout clean", tone: "default" },
          { label: "Minibar count", tone: "default" },
        ]
      : r.kind === "Stayover"
        ? [{ label: r.dnd ? `After ${r.dnd}` : "Stayover tidy", tone: "default" }]
        : [{ label: "Deep clean", tone: "default" }];
  if (r.returning) chips.push({ label: "Returning guest", tone: "accent", icon: "Star" });
  return {
    room: r.room,
    detail: `${r.kind} · ${r.type} · ${r.guests}`,
    arrival: r.arrival,
    chips,
    started: r.phase === "cleaning",
  };
}

function roomMix(): string {
  const count = (kind: RoomKind) => state.rooms.filter((r) => r.kind === kind).length;
  const checkouts = count("Checkout");
  const stayovers = count("Stayover");
  const deep = count("Deep clean");
  return [
    `${checkouts} checkout${checkouts === 1 ? "" : "s"}`,
    `${stayovers} stayover${stayovers === 1 ? "" : "s"}`,
    deep ? `${deep} deep clean` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function todayRooms(): TodayRooms {
  const left = todo();
  const [first, ...rest] = left;
  const done = state.rooms.filter((r) => r.phase === "clean" || r.phase === "ready");
  return {
    done: done.length,
    total: state.rooms.length,
    mix: roomMix(),
    next: first ? nextRoom(first) : null,
    upcoming: rest.slice(0, 4).map(todayLine),
    more: rest.length,
    doneRooms: done.map((r) => r.room).sort(),
  };
}

const BRIEFING = {
  from: "Beatrice",
  at: "06:45",
  body: "VIP returning guest in 204 at 14:00, lake-view pillows. Lift B is out of order, take linen up the back stairs.",
  short: "VIP in 204 at 14:00. Lift B out of order, use the back stairs.",
};

// ---------- Today (hk-clockin, hk-today)

/** Today as the prototype draws it: the clock in before the shift (`phase=before-shift`), else on it. */
export function mockToday(phase: string | undefined): TodayView {
  const before = phase === "before-shift" || state.since === null;
  const base = {
    person: PEOPLE.housekeeper,
    day: "Monday 12 October",
    greeting: "Good morning",
    firstName: "Jeanne",
    employeeId: "emp-jeanne",
    briefing: BRIEFING,
    rooms: todayRooms(),
    canReport: true,
    hasInbox: true,
    asOf: null,
  };
  if (before) {
    const clockedOut = phase !== "before-shift" && state.clockedOutAt !== null;
    return {
      ...base,
      sync: sync(clockedOut ? state.waiting : 0),
      onShift: null,
      shift: clockedOut
        ? { kind: "clocked-out", at: state.clockedOutAt ?? "", saved: true }
        : {
            kind: "before",
            span: "07:00 – 15:00",
            detail: "Housekeeping · Floor 2 · break at 11:30",
            chip: "Starts in 2 min",
            location: { title: "You are at the staff entrance", detail: "Isangano Lakeside · checked by location" },
          },
      clockInAt: clockedOut ? null : "06:58",
    };
  }
  return {
    ...base,
    sync: sync(state.waiting),
    onShift: {
      since: state.since ?? "07:02",
      detail: "Ends 15:00 · break at 11:30",
      saved: false,
      confirmLater: false,
      breakSince: state.breakSince,
      canBreak: true,
    },
    shift: null,
    clockInAt: null,
  };
}

/** Clock in: on shift from the button's time. */
export function mockClockIn(at: string | null): void {
  state.since = at ?? tick(2);
  state.clockedOutAt = null;
  state.breakSince = null;
}

/** Clock out: the shift card says when; the punch waits on the phone like any other write. */
export function mockClockOut(): void {
  state.clockedOutAt = tick(2);
  state.since = null;
  state.breakSince = null;
  state.waiting += 1;
}

export function mockToggleBreak(): void {
  state.breakSince = state.breakSince ? null : tick(1);
}

// ---------- My rooms (hk-rooms)

export function mockRooms(): RoomsView {
  return { eyebrow: "Floor 2 · Mon 12 Oct", todo: todo().map(todoLine), waiting: waitingLines(), ready: readyLines() };
}

export function mockRoomsEmpty(): RoomsView {
  return { eyebrow: "Floor 2 · Mon 12 Oct", todo: [], waiting: [], ready: [] };
}

// ---------- Room task (hk-task), done (hk-task-done), found (hk-found)

export function mockTask(number: string): TaskView | null {
  const r = findRoom(number);
  if (!r) return null;
  return {
    room: r.room,
    subtitle: `${r.kind} · ${r.type}`,
    offline: "No signal. Keep working, ticks are saved on this phone.",
    timer: { seconds: seconds(r.timer, Date.now()), running: r.timer.since !== null, readAt: Date.now() },
    usual: `Usual for ${r.kind === "Deep clean" ? "a deep clean" : `a ${r.kind.toLowerCase()}`}: ${USUAL[r.kind]} min`,
    arrival: r.arrival ? `Arrival ${r.arrival}` : null,
    groups: r.groups.map((g) => ({ ...g, items: g.items.map((item) => ({ ...item })) })),
    minibar: r.minibar.map((m) => ({ ...m })),
    cleaned: r.phase === "clean" || r.phase === "ready",
  };
}

/** Opening a room to clean starts its clock (once). */
export function mockStartRoom(number: string): void {
  const r = findRoom(number);
  if (r?.phase !== "todo") return;
  r.phase = "cleaning";
  r.timer = { banked: r.timer.banked, since: Date.now() };
}

export function mockToggleTimer(number: string): void {
  const r = findRoom(number);
  if (!r) return;
  const now = Date.now();
  r.timer =
    r.timer.since === null ? { banked: r.timer.banked, since: now } : { banked: seconds(r.timer, now), since: null };
  // Starting the clock on a room still to do starts cleaning it.
  if (r.phase === "todo") r.phase = "cleaning";
}

export function mockSetCheck(number: string, id: string, done: boolean): void {
  const r = findRoom(number);
  if (!r) return;
  r.groups = r.groups.map((g) => ({ ...g, items: g.items.map((item) => (item.id === id ? { ...item, done } : item)) }));
  // A tick with no signal waits on the phone, with the others.
  state.waiting += 1;
}

export function mockSetMinibar(number: string, key: string, count: number): void {
  const r = findRoom(number);
  if (!r) return;
  r.minibar = r.minibar.map((m) => (m.key === key ? { ...m, count: Math.max(0, count) } : m));
}

/** Mark clean: Clean, not Ready, until Beatrice inspects. */
export function mockFinishRoom(number: string): void {
  const r = findRoom(number);
  if (!r) return;
  const now = Date.now();
  const all = r.groups.flatMap((g) => g.items);
  const at = tick(USUAL[r.kind]);
  r.finished = {
    minutes: Math.max(1, Math.round(seconds(r.timer, now) / 60)),
    at,
    done: all.filter((item) => item.done).length,
    total: all.length,
  };
  r.timer = { banked: seconds(r.timer, now), since: null };
  r.phase = "clean";
  r.cleanedAt = at;
  r.dnd = null;
  state.waiting += 1;
}

export function mockTaskDone(number: string): TaskDoneView | null {
  const r = findRoom(number);
  if (!r) return null;
  const all = r.groups.flatMap((g) => g.items);
  const finished = r.finished ?? {
    minutes: 24,
    at: "10:58",
    done: all.length,
    total: all.length,
  };
  const left = todo().filter((x) => x.room !== r.room);
  const next = left[0];
  return {
    room: r.room,
    minutes: finished.minutes,
    at: finished.at,
    checks: { done: finished.done, total: finished.total },
    minibarSent: r.minibar.some((m) => m.count > 0) || r.kind === "Checkout",
    next: next ? todayLine(next) : null,
    left: left.length,
  };
}

export function mockFound(number: string): FoundView {
  return {
    room: number,
    onList: findRoom(number) !== undefined,
    photo: "found-phone-charger",
    photoNote: "Photo · small file, sends on weak signal",
    what: "Black phone charger, USB-C",
    places: ["Bedside", "Bathroom", "Wardrobe", "Under the bed", "Desk"],
    place: "Bedside",
  };
}

export function mockLogFound(item: FoundItem): void {
  state.found.push(item);
  state.waiting += 1;
}

// ---------- Report a problem (hk-report, hk-report-saved)

const CATEGORIES: ReportView["categories"] = [
  { value: "plumbing", label: "Plumbing", icon: "Droplet" },
  { value: "electrical", label: "Electrical", icon: "Thunderbolt" },
  { value: "ac", label: "AC", icon: "Snowflake" },
  { value: "furniture", label: "Furniture", icon: "Hammer" },
  { value: "safety", label: "Safety", icon: "ShieldExclamation" },
  { value: "other", label: "Other", icon: "Ellipsis" },
];

const URGENCY_WORDS: Record<Urgency, string> = { wait: "Can wait", today: "Today", urgent: "Urgent" };

export function mockReport(): ReportView {
  return {
    offline: "No connection. Your report is saved here and sends later.",
    places: ["204", "211", "206", "209", "Corridor F2"],
    place: "Corridor F2",
    categories: CATEGORIES,
    category: "electrical",
    urgency: "today",
    photo: { image: "dark-stairwell", note: "Made smaller: 180 KB", size: "180 KB" },
    note: "Two ceiling lights out near lift B. Dark at night.",
  };
}

function categoryLabel(category: ProblemCategory): string {
  return CATEGORIES.find((c) => c.value === category)?.label ?? "Other";
}

export function mockSaveReport(input: ReportInput): void {
  const where = /^\d+$/.test(input.place) ? `room ${input.place}` : input.place.toLowerCase().replace(/ f(\d)/, " F$1");
  state.report = {
    problem: `${categoryLabel(input.category)} · ${where}`,
    urgency: URGENCY_WORDS[input.urgency],
    photo: input.photo ? "1 · 180 KB" : "None",
    savedAt: "10:09",
  };
  state.waiting += 1;
}

export function mockReportSaved(): ReportSavedView {
  const saved = state.report ?? { problem: "Electrical · corridor F2", urgency: "Today", photo: "1 · 180 KB", savedAt: "10:09" };
  return { ...saved, ticket: null };
}

// ---------- Schedule and leave (hk-schedule, hk-leave)

const DAY_MS = 86_400_000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
/** Monday 12 October 2026: the prototype's today. */
const TODAY = Date.UTC(2026, 9, 12);

function dayAt(ms: number) {
  const d = new Date(ms);
  return { weekday: WEEKDAYS[d.getUTCDay()] ?? "", date: d.getUTCDate(), month: MONTHS[d.getUTCMonth()] ?? "" };
}

interface DayPlan {
  mark: WeekDay["mark"];
  hours: string | null;
  where: string;
  note?: string;
  chip?: ScheduleShift["chip"];
}

/** Each person's usual week, Monday first. */
const WEEK_PLAN: Record<StaffApp, DayPlan[]> = {
  housekeeper: [
    { mark: "work", hours: "07:00 – 15:00", where: "Floor 2" },
    { mark: "work", hours: "07:00 – 15:00", where: "Floor 2" },
    { mark: "work", hours: "07:00 – 15:00", where: "Floor 2" },
    { mark: "off", hours: null, where: "" },
    { mark: "work", hours: "07:00 – 15:00", where: "Floor 2" },
    { mark: "work", hours: "07:00 – 15:00", where: "Floor 2" },
    { mark: "off", hours: null, where: "" },
  ],
  supervisor: [
    { mark: "work", hours: "06:30 – 15:00", where: "Floors 1 to 3" },
    { mark: "work", hours: "06:30 – 15:00", where: "Floors 1 to 3" },
    { mark: "work", hours: "06:30 – 15:00", where: "Floors 1 to 3" },
    { mark: "work", hours: "06:30 – 15:00", where: "Floors 1 to 3" },
    { mark: "work", hours: "06:30 – 15:00", where: "Floors 1 to 3" },
    { mark: "off", hours: null, where: "" },
    { mark: "off", hours: null, where: "" },
  ],
  technician: [
    { mark: "work", hours: "07:00 – 16:00", where: "All buildings" },
    { mark: "work", hours: "07:00 – 16:00", where: "All buildings" },
    { mark: "work", hours: "07:00 – 16:00", where: "Plant room checks" },
    { mark: "work", hours: "07:00 – 16:00", where: "All buildings" },
    { mark: "work", hours: "07:00 – 16:00", where: "All buildings" },
    {
      mark: "warn",
      hours: "18:00 – 07:00",
      where: "On call",
      chip: { label: "On call", tone: "info", icon: "Handset" },
    },
    { mark: "off", hours: null, where: "" },
  ],
};

/** This week's own changes: Fri 16 is a swap with Chantal, waiting. */
function plannedDay(app: StaffApp, offset: number, index: number): DayPlan {
  const plan = WEEK_PLAN[app][index] ?? { mark: "off", hours: null, where: "" };
  if (app === "housekeeper" && offset === 0 && index === 4) {
    return {
      mark: "warn",
      hours: "14:00 – 22:00",
      where: "Floor 2",
      note: "swap with Chantal",
      chip: { label: "Swap pending", tone: "warning", icon: "Hourglass" },
    };
  }
  return plan;
}

const LEAVE_LEFT: Record<StaffApp, number> = { housekeeper: 9, supervisor: 12, technician: 7 };

export function mockSchedule(app: StaffApp, offset: number): ScheduleView {
  const monday = TODAY + offset * 7 * DAY_MS;
  const first = dayAt(monday);
  const last = dayAt(monday + 6 * DAY_MS);
  const range =
    first.month === last.month
      ? `${first.date} – ${last.date} ${last.month}`
      : `${first.date} ${first.month} – ${last.date} ${last.month}`;
  const week: WeekDay[] = Array.from({ length: 7 }, (_, i) => {
    const d = dayAt(monday + i * DAY_MS);
    return {
      key: `${offset}-${i}`,
      day: d.weekday,
      date: String(d.date),
      mark: plannedDay(app, offset, i).mark,
      today: offset === 0 && i === 0,
    };
  });
  const shifts: ScheduleShift[] = [];
  for (let i = 0; i < 7; i++) {
    // Tomorrow has its own card above the list.
    if (offset === 0 && i === 1) continue;
    const plan = plannedDay(app, offset, i);
    const d = dayAt(monday + i * DAY_MS);
    const key = `${offset}-${i}`;
    const title = `${d.weekday} ${d.date}${offset === 0 && i === 0 ? " · today" : ""}`;
    if (!plan.hours) {
      if (offset === 0 && i === 6) continue;
      shifts.push({ key, title, detail: "Rest day", chip: { label: "Off", tone: "default" }, swappable: false });
      continue;
    }
    const swapAsked = state.swaps.has(key);
    const chip =
      offset === 0 && i === 0
        ? { label: "On shift", tone: "success" as const }
        : swapAsked
          ? { label: "Swap asked", tone: "warning" as const, icon: "Hourglass" as const }
          : (plan.chip ?? null);
    shifts.push({
      key,
      title,
      detail: [plan.hours, plan.note ?? plan.where].join(" · "),
      chip,
      swappable: !(offset === 0 && i === 0) && !plan.chip && !swapAsked && offset >= 0,
    });
  }
  const tomorrow = plannedDay(app, 0, 1);
  const asked = state.leave[app];
  const booked: ScheduleView["leave"]["booked"] = asked
    ? {
        value: shortRange(asked.from, asked.to),
        unit: "",
        status: `Waiting · ${asked.days} day${asked.days === 1 ? "" : "s"}`,
        tone: "warning",
      }
    : app === "housekeeper"
      ? { value: "3–4", unit: "Nov", status: "Approved", tone: "success" }
      : null;
  return {
    range,
    week,
    next: tomorrow.hours
      ? {
          title: "Tomorrow · Tue 13 Oct",
          detail: `${tomorrow.hours} · ${tomorrow.where}`,
        }
      : null,
    listTitle: offset === 0 ? "This week" : offset === 1 ? "Next week" : offset === -1 ? "Last week" : range,
    shifts,
    leave: { left: LEAVE_LEFT[app], total: 18, resets: "Resets 1 Jan", booked },
    holiday: "Next public holiday: Christmas, Fri 25 Dec",
  };
}

/** "14–18 Dec". */
function shortRange(from: string, to: string): string {
  const a = dayAt(Date.parse(`${from}T00:00:00Z`));
  const b = dayAt(Date.parse(`${to}T00:00:00Z`));
  if (from === to) return `${a.date} ${a.month.slice(0, 3)}`;
  return a.month === b.month
    ? `${a.date}–${b.date} ${b.month.slice(0, 3)}`
    : `${a.date} ${a.month.slice(0, 3)}–${b.date} ${b.month.slice(0, 3)}`;
}

export function mockAskSwap(key: string): void {
  state.swaps.add(key);
}

export function mockScheduleSeen(): void {
  state.scheduleSeen = true;
}

/** The tab bar's dot on Schedule: a swap is waiting and she has not looked yet. */
export function mockTabBadges(): { schedule?: true } {
  return state.scheduleSeen ? {} : { schedule: true };
}

const APPROVERS: Record<StaffApp, Approver[]> = {
  housekeeper: [
    { initials: "BM", name: "Beatrice Mukandori", role: "1 · your line manager", tone: "success" },
    { initials: "DI", name: "Diane Ingabire", role: "2 · HR checks your balance", tone: "accent" },
  ],
  supervisor: [
    { initials: "AU", name: "Aline Uwase", role: "1 · your line manager", tone: "success" },
    { initials: "DI", name: "Diane Ingabire", role: "2 · HR checks your balance", tone: "accent" },
  ],
  technician: [
    { initials: "AU", name: "Aline Uwase", role: "1 · your line manager", tone: "success" },
    { initials: "DI", name: "Diane Ingabire", role: "2 · HR checks your balance", tone: "accent" },
  ],
};

export function mockLeave(app: StaffApp): LeaveView {
  const approvers = APPROVERS[app];
  return {
    balance: LEAVE_LEFT[app],
    earliest: "2026-10-13",
    from: "2026-12-14",
    to: "2026-12-18",
    notePlaceholder: "Family visit in Huye",
    approvers,
    firstApprover: approvers[0]?.name.split(" ")[0] ?? "your manager",
  };
}

export function mockAskLeave(app: StaffApp, input: LeaveInput): void {
  state.leave[app] = { from: input.from, to: input.to, days: input.days };
}

// ---------- Me (hk-me)

const DETAILS: Record<StaffApp, { documents: string[]; assets: string[]; hours: string }> = {
  housekeeper: {
    documents: ["Contract", "ID copy", "RSSB", "food hygiene"],
    assets: ["Floor 2 master key card", "2 uniforms", "Samsung A15"],
    hours: "148 h this month",
  },
  supervisor: {
    documents: ["Contract", "ID copy", "RSSB", "first aid"],
    assets: ["Floors 1 to 3 master key card", "supervisor tablet", "2 uniforms"],
    hours: "162 h this month",
  },
  technician: {
    documents: ["Contract", "ID copy", "RSSB", "electrical licence"],
    assets: ["Tool kit B", "multimeter", "plant room keys", "Tecno Spark 20"],
    hours: "171 h this month",
  },
};

const DOCUMENT_LINES: Record<string, string> = {
  Contract: "Contract · signed 2 Feb 2024",
  "ID copy": "ID copy · on file",
  RSSB: "RSSB card · number on file",
  "food hygiene": "Food hygiene certificate · valid to Mar 2027",
  "first aid": "First aid certificate · valid to Jun 2027",
  "electrical licence": "Electrical licence · valid to Aug 2027",
};

export function mockMe(app: StaffApp): MeView {
  const details = DETAILS[app];
  const missed = MISSED[app];
  const toFix = missed && !state.fixAsked[app] ? 1 : 0;
  const waiting = state.waiting;
  const leaveLeft = LEAVE_LEFT[app];
  const work: MeRow[] = [
    {
      key: "payslips",
      icon: "FileText",
      tone: "accent",
      title: "Payslips",
      subtitle: "September is ready · locked with your PIN",
      locked: true,
    },
    {
      key: "hours",
      icon: "Clock",
      tone: "accent",
      title: "My hours, claims and loans",
      subtitle: `${details.hours} · ${
        missed ? (state.fixAsked[app] ? "fix asked" : "1 punch to fix") : "every punch in"
      }`,
      count: toFix || undefined,
    },
    { key: "leave", icon: "Suitcase", tone: "accent", title: "Leave", subtitle: `${leaveLeft} days left` },
  ];
  const files: MeRow[] = [
    {
      key: "documents",
      icon: "Files",
      tone: "default",
      title: "My documents",
      subtitle: details.documents.join(", "),
      details: details.documents.map((d) => DOCUMENT_LINES[d] ?? d),
    },
    {
      key: "assets",
      icon: "Box",
      tone: "default",
      title: "Assets on loan",
      subtitle: details.assets.join(", "),
      details: details.assets.map((a) => `${a.charAt(0).toUpperCase()}${a.slice(1)} · hand back when you leave`),
    },
    {
      key: "help",
      icon: "LifeRing",
      tone: "default",
      title: "Ask HR or IT",
      subtitle: "Diane answers here and by SMS, usually within a day",
    },
  ];
  const phone: MeRow[] = [
    {
      key: "outbox",
      icon: "CloudCheck",
      tone: "default",
      title: "On this phone",
      subtitle: waiting > 0 ? `${waiting} waiting to send` : "Everything is sent",
    },
    { key: "switch", icon: "ArrowRightArrowLeft", tone: "default", title: "Switch place", subtitle: "Isangano Lakeside" },
    { key: "language", icon: "Globe", tone: "default", title: "Language", subtitle: "English" },
    { key: "signout", icon: "ArrowRightFromSquare", tone: "default", title: "Sign out", subtitle: "" },
  ];
  return { person: PEOPLE[app], work, files, phone };
}

// ---------- PIN (hk-pin)

/** The sample PIN. The fingerprint key opens too. */
const SAMPLE_PIN = "1234";

export function mockPin(): PinView {
  return {
    length: SAMPLE_PIN.length,
    reason: "Payslips show your salary, so we check it is you.",
    forgot: "Forgot it? Ask Diane in HR.",
    canFingerprint: true,
  };
}

export function mockCheckPin(pin: string | null): boolean {
  return pin === null || pin === SAMPLE_PIN;
}

// ---------- Hours, pay, claims and loans (hk-hours)

const MISSED: Record<StaffApp, HoursView["missed"]> = {
  housekeeper: {
    title: "Thu 8 Oct · no clock-out",
    body: "You left at about 15:05. Ask Beatrice to fix it so the hours count.",
    time: "15:05",
    asked: false,
  },
  supervisor: null,
  technician: {
    title: "Sat 10 Oct · no clock-out",
    body: "The call-out ended at about 22:40. Ask Aline to fix it so the hours count.",
    time: "22:40",
    asked: false,
  },
};

/** Gross pay, then Rwanda's deductions as the prototype lists them, and the net. */
const PAY: Record<StaffApp, { gross: number; paye: number; rssb: number; cbhi: number }> = {
  housekeeper: { gross: 230_000, paye: 33_000, rssb: 14_490, cbhi: 913 },
  supervisor: { gross: 380_000, paye: 78_000, rssb: 23_940, cbhi: 1_390 },
  technician: { gross: 300_000, paye: 54_000, rssb: 18_900, cbhi: 1_136 },
};

const HOURS: Record<StaffApp, { hours: number; status: string; detail: string }> = {
  housekeeper: { hours: 148, status: "On track this month", detail: "6 h overtime · 1 late arrival" },
  supervisor: { hours: 162, status: "On track this month", detail: "2 h overtime · no late arrivals" },
  technician: { hours: 171, status: "Ahead this month", detail: "9 h overtime · 2 call-outs" },
};

const CLAIMS: Record<StaffApp, ClaimLine[]> = {
  housekeeper: [
    {
      key: "transport",
      icon: "Car",
      tone: "warning",
      title: "Transport · late shift Fri 9 Oct",
      subtitle: "Moto home after 22:00",
      amount: rwf(3_000),
      chip: { label: "Pending", tone: "warning" },
      repaid: null,
    },
    {
      key: "advance",
      icon: "Wallet",
      tone: "info",
      title: "Salary advance",
      subtitle: "RWF 20,000 left · RWF 10,000 a month",
      amount: null,
      chip: null,
      repaid: 60,
    },
  ],
  supervisor: [
    {
      key: "phone",
      icon: "Smartphone",
      tone: "info",
      title: "Phone airtime · October",
      subtitle: "Calls to the team on days off",
      amount: rwf(5_000),
      chip: { label: "Approved", tone: "success" },
      repaid: null,
    },
  ],
  technician: [
    {
      key: "callout",
      icon: "Car",
      tone: "warning",
      title: "Call-out · Sat 10 Oct, 21:40",
      subtitle: "Boiler fault, Lakeside wing · moto both ways",
      amount: rwf(6_000),
      chip: { label: "Pending", tone: "warning" },
      repaid: null,
    },
    {
      key: "tools",
      icon: "Wallet",
      tone: "info",
      title: "Tool loan · cordless drill",
      subtitle: "RWF 15,000 left · RWF 5,000 a month",
      amount: null,
      chip: null,
      repaid: 40,
    },
  ],
};

export function mockHours(app: StaffApp): HoursView {
  const pay = PAY[app];
  const net = pay.gross - pay.paye - pay.rssb - pay.cbhi;
  const hours = HOURS[app];
  const missed = MISSED[app];
  const drafts: ClaimLine[] = Array.from({ length: state.claims[app] }, (_, i) => ({
    key: `draft-${i + 1}`,
    icon: "FileText",
    tone: "default",
    title: "New claim · Mon 12 Oct",
    subtitle: "Draft · add what it was for and a photo of the receipt",
    amount: null,
    chip: { label: "Draft", tone: "default" },
    repaid: null,
  }));
  return {
    month: "October",
    hours: hours.hours,
    target: 176,
    status: hours.status,
    detail: hours.detail,
    paid: "Paid on 30 Oct",
    missed: missed ? { ...missed, asked: state.fixAsked[app] } : null,
    payslip: {
      title: "September payslip",
      rows: [
        { label: "Gross pay", value: rwf(pay.gross) },
        { label: "PAYE income tax", value: `− ${rwf(pay.paye)}` },
        { label: "RSSB pension and maternity", value: `− ${rwf(pay.rssb)}` },
        { label: "Community health (CBHI)", value: `− ${rwf(pay.cbhi)}` },
      ],
      net: rwf(net),
      saved: state.payslipSaved[app],
    },
    claims: [...CLAIMS[app], ...drafts],
  };
}

export function mockAskFix(app: StaffApp): void {
  state.fixAsked[app] = true;
  state.waiting += 1;
}

export function mockSavePayslip(app: StaffApp): void {
  state.payslipSaved[app] = true;
}

export function mockNewClaim(app: StaffApp): void {
  state.claims[app] += 1;
}
