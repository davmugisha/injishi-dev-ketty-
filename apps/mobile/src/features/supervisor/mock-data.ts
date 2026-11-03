// Sample data for the supervisor app (proto-ui): Beatrice, Isangano Lakeside, Mon 12 Oct 2026 around
// 10:30, copied from the prototype (`c-staff.mjs`). Imported only by `data.ts`. The actions below
// change this module's state and every read returns fresh objects, so the screens follow a rush, a
// release or a return as they would with the API.

import type { IconName, RoomStatus } from "@/components/ui";
import { type ProtoImage, protoImages } from "@/proto/images";
import type {
  CheckResult,
  CountStatus,
  FloorBoard,
  FloorCell,
  FloorId,
  Inspection,
  InspectionCheck,
  InspectionQueue,
  Notice,
  Person,
  QueueRoom,
  ReturnedRoom,
  RoomSheet,
  RushInput,
  TeamRequest,
  TeamToday,
} from "./types";

/** The board's clock: the prototype's 10:41, when Beatrice inspects. */
const NOW = "10:41";
const DAY = "Mon 12 Oct";

// ---------- people

type Staff = { id: string; name: string; first: string; initials: string; photo?: true; line: string };

const STAFF: Record<string, Staff> = {
  jeanne: {
    id: "jeanne",
    name: "Jeanne N.",
    first: "Jeanne",
    initials: "JN",
    photo: true,
    line: "In 204 · 5 of 12 done",
  },
  grace: { id: "grace", name: "Grace M.", first: "Grace", initials: "GM", line: "In 202 · 6 of 11 done" },
  chantal: { id: "chantal", name: "Chantal U.", first: "Chantal", initials: "CU", line: "Floor 3 · 4 of 10 done" },
  divine: { id: "divine", name: "Divine I.", first: "Divine", initials: "DI", line: "Floor 1 · 4 of 12 done" },
};

/** Who can take a room on each floor, the floor's own people first. */
const CREW: Record<FloorId, readonly string[]> = {
  "1": ["divine", "grace", "jeanne"],
  "2": ["jeanne", "grace", "chantal"],
  "3": ["chantal", "jeanne", "grace"],
};

function person(id: string): Person {
  const s = STAFF[id] ?? STAFF.jeanne;
  return {
    id: s.id,
    name: s.name,
    initials: s.initials,
    line: s.line,
    photo: s.photo ? protoImages["staff-portrait"] : undefined,
  };
}

// ---------- rooms

/** Housekeeping's own stages; `waiting` and `returned` both show as Clean (not yet sellable). */
type Stage = "dirty" | "cleaning" | "waiting" | "returned" | "ready" | "blocked";

type Room = {
  room: string;
  floor: FloorId;
  stage: Stage;
  arrival: string | null;
  housekeeper: string | null;
  kind: string;
  type: string;
  /** Do not disturb until this time. */
  dnd?: string;
  /** Replaces the computed note ("Deep clean"). */
  label?: string;
  blockReason?: string;
  flag?: IconName;
  flagLabel?: string;
  arrivalMoved?: string;
  cleaned?: { by: string; at: string; waited: number };
  inspected?: string;
  next?: boolean;
  rushed?: boolean;
};

const ROOMS: Room[] = [
  // Floor 2, the prototype's board
  {
    room: "206",
    floor: "2",
    stage: "dirty",
    arrival: "12:00",
    housekeeper: "jeanne",
    kind: "Stayover · towels only",
    type: "Deluxe Lake View",
    dnd: "11:00",
    flag: "Clock",
    flagLabel: "arrival moved to 12:00",
    arrivalMoved: "10:12",
  },
  {
    room: "201",
    floor: "2",
    stage: "waiting",
    arrival: "13:00",
    housekeeper: "grace",
    kind: "Checkout",
    type: "Standard Queen",
    flag: "Clock",
    flagLabel: "arrival at 13:00",
    cleaned: { by: "grace", at: "10:20", waited: 13 },
  },
  {
    room: "204",
    floor: "2",
    stage: "cleaning",
    arrival: "14:00",
    housekeeper: "jeanne",
    kind: "Checkout · VIP returning guest",
    type: "Deluxe Lake View",
    flag: "Star",
    flagLabel: "VIP arrival",
  },
  {
    room: "205",
    floor: "2",
    stage: "waiting",
    arrival: "15:30",
    housekeeper: "jeanne",
    kind: "Checkout",
    type: "Twin Room",
    flag: "Clock",
    flagLabel: "arrival at 15:30",
    cleaned: { by: "jeanne", at: "09:40", waited: 53 },
  },
  {
    room: "207",
    floor: "2",
    stage: "blocked",
    arrival: "17:00",
    housekeeper: "grace",
    kind: "Checkout",
    type: "Deluxe Lake View",
    blockReason: "Shower leak",
  },
  {
    room: "203",
    floor: "2",
    stage: "ready",
    arrival: "16:00",
    housekeeper: "jeanne",
    kind: "Checkout",
    type: "Standard Queen",
    inspected: "09:30",
  },
  {
    room: "202",
    floor: "2",
    stage: "cleaning",
    arrival: null,
    housekeeper: "grace",
    kind: "Stayover",
    type: "Twin Room",
  },
  {
    room: "208",
    floor: "2",
    stage: "waiting",
    arrival: null,
    housekeeper: "jeanne",
    kind: "Checkout",
    type: "Standard Queen",
    cleaned: { by: "jeanne", at: "10:02", waited: 31 },
  },
  {
    room: "209",
    floor: "2",
    stage: "dirty",
    arrival: null,
    housekeeper: "jeanne",
    kind: "Deep clean",
    type: "Deluxe Lake View",
    label: "Deep clean",
  },
  {
    room: "210",
    floor: "2",
    stage: "ready",
    arrival: null,
    housekeeper: "jeanne",
    kind: "Checkout",
    type: "Twin Room",
    inspected: "10:05",
  },
  {
    room: "211",
    floor: "2",
    stage: "dirty",
    arrival: null,
    housekeeper: "jeanne",
    kind: "Stayover",
    type: "Standard Queen",
  },
  { room: "212", floor: "2", stage: "dirty", arrival: null, housekeeper: "grace", kind: "Stayover", type: "Twin Room" },
  // Floor 1, Divine's
  {
    room: "101",
    floor: "1",
    stage: "ready",
    arrival: "13:30",
    housekeeper: "divine",
    kind: "Checkout",
    type: "Garden Room",
    inspected: "09:10",
  },
  {
    room: "102",
    floor: "1",
    stage: "cleaning",
    arrival: "15:00",
    housekeeper: "divine",
    kind: "Checkout",
    type: "Garden Room",
  },
  {
    room: "103",
    floor: "1",
    stage: "dirty",
    arrival: null,
    housekeeper: "divine",
    kind: "Stayover",
    type: "Standard Queen",
  },
  {
    room: "104",
    floor: "1",
    stage: "dirty",
    arrival: null,
    housekeeper: "divine",
    kind: "Stayover",
    type: "Garden Room",
  },
  {
    room: "105",
    floor: "1",
    stage: "ready",
    arrival: null,
    housekeeper: "divine",
    kind: "Checkout",
    type: "Twin Room",
    inspected: "08:50",
  },
  {
    room: "106",
    floor: "1",
    stage: "dirty",
    arrival: null,
    housekeeper: "divine",
    kind: "Stayover",
    type: "Garden Room",
    dnd: "12:00",
  },
  // Floor 3, Chantal's
  {
    room: "305",
    floor: "3",
    stage: "dirty",
    arrival: "14:30",
    housekeeper: "chantal",
    kind: "Checkout",
    type: "Deluxe Lake View",
    flag: "Wrench",
    flagLabel: "AC fault reported",
  },
  {
    room: "301",
    floor: "3",
    stage: "cleaning",
    arrival: "16:00",
    housekeeper: "chantal",
    kind: "Checkout",
    type: "Twin Room",
  },
  {
    room: "302",
    floor: "3",
    stage: "blocked",
    arrival: null,
    housekeeper: "chantal",
    kind: "Stayover",
    type: "Standard Queen",
    blockReason: "Window latch",
  },
  {
    room: "303",
    floor: "3",
    stage: "dirty",
    arrival: null,
    housekeeper: "chantal",
    kind: "Stayover",
    type: "Twin Room",
  },
  {
    room: "304",
    floor: "3",
    stage: "ready",
    arrival: null,
    housekeeper: "chantal",
    kind: "Checkout",
    type: "Standard Queen",
    inspected: "09:55",
  },
  {
    room: "306",
    floor: "3",
    stage: "dirty",
    arrival: null,
    housekeeper: "chantal",
    kind: "Stayover",
    type: "Deluxe Lake View",
  },
];

function findRoom(no: string): Room | undefined {
  return ROOMS.find((r) => r.room === no);
}

function statusOf(stage: Stage): CountStatus {
  if (stage === "waiting" || stage === "returned") return "clean";
  return stage;
}

/** The prototype's cell lines: "12:00 · DND", "13:00 · check", "Grace", "Ready". */
function noteOf(r: Room): string {
  if (r.stage === "blocked") return r.blockReason ?? "Blocked";
  if (r.label && r.stage === "dirty") return r.label;
  const who = r.housekeeper ? (STAFF[r.housekeeper]?.first ?? "") : "";
  const word =
    r.stage === "waiting"
      ? "check"
      : r.stage === "returned"
        ? "returned"
        : r.stage === "ready"
          ? "ready"
          : r.stage === "dirty" && r.dnd
            ? "DND"
            : who;
  if (r.arrival) return `${r.arrival} · ${word}`;
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function cellOf(r: Room): FloorCell {
  const flag: { flag?: IconName; flagLabel?: string } = r.rushed
    ? { flag: "Thunderbolt", flagLabel: "rushed, cleaned next" }
    : r.stage === "returned"
      ? { flag: "ArrowUturnCcwLeft", flagLabel: "returned to the housekeeper" }
      : { flag: r.flag, flagLabel: r.flagLabel };
  return {
    room: r.room,
    status: statusOf(r.stage),
    note: noteOf(r),
    ...flag,
    opens: r.stage === "waiting" ? "queue" : "room",
  };
}

const COUNT_LABELS: readonly { status: CountStatus; label: string }[] = [
  { status: "dirty", label: "Dirty" },
  { status: "cleaning", label: "Cleaning" },
  { status: "clean", label: "Clean" },
  { status: "ready", label: "Ready" },
  { status: "blocked", label: "Blocked" },
];

const FLOORS = [
  { value: "1", label: "Floor 1" },
  { value: "2", label: "Floor 2" },
  { value: "3", label: "Floor 3" },
] as const;

function byArrival(a: Room, b: Room): number {
  return (a.arrival ?? "99").localeCompare(b.arrival ?? "99");
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function floorBoard(floor: FloorId): FloorBoard {
  const rooms = ROOMS.filter((r) => r.floor === floor);
  // The prototype's order: arrivals by the time the guest comes, then the rest as listed.
  const arrivals = rooms.filter((r) => r.arrival && r.stage !== "blocked").sort(byArrival);
  const blockedArrivals = rooms.filter((r) => r.arrival && r.stage === "blocked");
  const ready = arrivals.filter((r) => r.stage === "ready");
  const withArrival = [...arrivals.filter((r) => r.stage !== "ready"), ...blockedArrivals, ...ready];
  const others = rooms.filter((r) => !r.arrival);
  const moved = rooms.find((r) => r.arrivalMoved && !r.rushed && r.stage !== "ready");
  const mover = moved?.housekeeper ? STAFF[moved.housekeeper] : undefined;
  return {
    floor,
    title: `Floor ${floor}`,
    eyebrow: `${DAY} · live`,
    floors: FLOORS,
    counts: COUNT_LABELS.map((c) => ({ ...c, count: rooms.filter((r) => statusOf(r.stage) === c.status).length })),
    alert: moved
      ? {
          room: moved.room,
          title: `${moved.room} arrival moved to ${moved.arrival}`,
          body: `${moved.dnd ? `Still DND until ${moved.dnd}` : "Not clean yet"} · ${mover?.first ?? "Nobody"} has it`,
        }
      : null,
    arrivals: withArrival.map(cellOf),
    arrivalsNote: `${plural(withArrival.length, "arrival", "arrivals")} today`,
    others: others.map(cellOf),
    othersNote: plural(others.length, "room", "rooms"),
    waiting: rooms.filter((r) => r.stage === "waiting").length,
  };
}

function noticeOf(r: Room): Notice | null {
  if (r.stage === "blocked")
    return {
      tone: "danger",
      icon: "Wrench",
      title: `Blocked · ${(r.blockReason ?? "fault").toLowerCase()}`,
      body: r.arrival
        ? `Maintenance has it. Front desk moves the ${r.arrival} arrival if it is not released in time.`
        : "Maintenance has it. It stays off sale until Aline releases the block.",
    };
  if (r.arrivalMoved && r.arrival)
    return {
      tone: "danger",
      icon: "Clock",
      title: `Arrival moved to ${r.arrival}`,
      body: `Front desk changed it at ${r.arrivalMoved}.${r.dnd ? ` The guest is still in until ${r.dnd}.` : ""}`,
    };
  if (r.stage === "ready")
    return {
      tone: "success",
      icon: "CheckDouble",
      title: "Ready for front desk",
      body: `You inspected it at ${r.inspected ?? NOW}. Nothing more to do here.`,
    };
  if (r.stage === "waiting")
    return {
      tone: "accent",
      icon: "CircleInfo",
      title: "Waiting for your inspection",
      body: "It stays Clean, not Ready, until you inspect it.",
    };
  if (r.stage === "returned")
    return {
      tone: "warning",
      icon: "ArrowUturnCcwLeft",
      title: "Returned for a second clean",
      body: "It is at the top of her list. Inspect it again once she marks it clean.",
    };
  if (r.arrival)
    return {
      tone: "info",
      icon: "Clock",
      title: `Arrival at ${r.arrival}`,
      body: "Front desk gives the room out once you have inspected it.",
    };
  return null;
}

export function roomSheet(no: string): RoomSheet {
  const r = findRoom(no) ?? findRoom("206");
  if (!r) throw new Error(`no room ${no}`);
  const status: RoomStatus = r.stage === "dirty" && r.dnd ? "dnd" : statusOf(r.stage);
  return {
    room: r.room,
    status,
    statusLabel: status === "dnd" ? `DND ${r.dnd}` : undefined,
    subtitle: `${r.kind} · ${r.type}`,
    notice: noticeOf(r),
    mode: r.stage === "ready" ? "done" : r.stage === "waiting" ? "inspect" : "assign",
    arrival: r.arrival,
    assignee: r.housekeeper,
    people: CREW[r.floor].map(person),
    next: Boolean(r.next),
  };
}

export function rush({ room, to, next }: RushInput): { message: string } {
  const r = findRoom(room);
  if (!r) throw new Error(`no room ${room}`);
  const handedOver = r.housekeeper !== to;
  r.housekeeper = to;
  r.next = next;
  r.rushed = next;
  const who = STAFF[to]?.first ?? "She";
  if (handedOver) return { message: `${room} handed to ${who} · she got a push` };
  return { message: `${room} rushed · ${who} cleans it next` };
}

// ---------- inspection

const CHECKS: readonly { id: string; label: string }[] = [
  { id: "bathroom", label: "Bathroom clean, no hair or marks" },
  { id: "towels", label: "Towels and bath mat complete" },
  { id: "bed", label: "Bed made, linen without stains" },
  { id: "floor", label: "Floor clean, also under the bed" },
  { id: "dust", label: "Surfaces free of dust" },
  { id: "balcony", label: "Balcony door and glass clear" },
  { id: "amenities", label: "Amenities complete" },
  { id: "minibar", label: "Minibar matches the count" },
  { id: "power", label: "Lights, AC and TV work" },
  { id: "air", label: "Fresh smell, windows closed" },
];

/** The photo Beatrice "takes" of a failed check: the camera's stand-in in this build. */
const FAIL_PHOTOS: Record<string, ProtoImage> = {
  bathroom: "deluxe-bathroom",
  towels: "deluxe-bathroom",
  bed: "standard-queen-room",
  floor: "living-room-floor",
  dust: "twin-room",
  balcony: "balcony-glass-door",
  amenities: "deluxe-bathroom",
  minibar: "deluxe-lake-view-room",
  power: "bedroom-window",
  air: "bedroom-window",
};

type Results = Record<string, { result: CheckResult | null; photo: boolean; note: string | null }>;

const RESULTS: Record<string, Results> = {
  "201": Object.fromEntries(
    CHECKS.map((c) =>
      c.id === "balcony"
        ? [c.id, { result: "fail", photo: true, note: "Streaks on the outside glass" }]
        : [c.id, { result: "pass", photo: false, note: null }],
    ),
  ),
};

function resultsOf(room: string): Results {
  RESULTS[room] ??= Object.fromEntries(CHECKS.map((c) => [c.id, { result: null, photo: false, note: null }]));
  return RESULTS[room];
}

/** Rooms Beatrice released or returned this session, newest last. */
const RELEASED: { room: string; at: string; by: string }[] = [
  { room: "203", at: "09:30", by: "jeanne" },
  { room: "210", at: "10:05", by: "jeanne" },
];
/** Rooms returned this session, and when each one's undo runs out (ms since the epoch). */
const RETURNS = new Map<string, number>();

/** How long the undo stays after a return. */
const UNDO_MS = 60_000;

export function inspection(no: string): Inspection {
  const r = findRoom(no) ?? findRoom("201");
  if (!r) throw new Error(`no room ${no}`);
  const results = resultsOf(r.room);
  const cleaner = STAFF[r.cleaned?.by ?? r.housekeeper ?? "jeanne"];
  const checks: InspectionCheck[] = CHECKS.map((c) => {
    const own = results[c.id];
    return {
      id: c.id,
      label: c.label,
      result: own?.result ?? null,
      photo: own?.photo ? protoImages[FAIL_PHOTOS[c.id] ?? "balcony-glass-door"] : null,
      note: own?.note ?? null,
    };
  });
  const when = r.cleaned ? `Cleaned by ${cleaner?.first} ${r.cleaned.at}` : `${cleaner?.first ?? "Her"} is on it`;
  return {
    room: r.room,
    cleanedBy: cleaner?.first ?? "her",
    subtitle: `${when} · ${r.arrival ? `arrival ${r.arrival}` : "no arrival today"}`,
    checks,
    state: r.stage === "ready" ? "released" : r.stage === "returned" ? "returned" : "open",
  };
}

export function markCheck({ room, id, result }: { room: string; id: string; result: CheckResult }): void {
  const own = resultsOf(room)[id];
  if (!own) return;
  // Pressing the chosen answer again clears it.
  own.result = own.result === result ? null : result;
  if (own.result !== "fail") {
    own.photo = false;
    own.note = null;
  }
}

export function addFailPhoto({ room, id }: { room: string; id: string }): void {
  const own = resultsOf(room)[id];
  if (own?.result === "fail") own.photo = true;
}

export function release(room: string): { message: string } {
  const r = findRoom(room);
  if (!r) throw new Error(`no room ${room}`);
  r.stage = "ready";
  r.inspected = NOW;
  r.next = false;
  r.rushed = false;
  RELEASED.push({ room, at: NOW, by: r.cleaned?.by ?? r.housekeeper ?? "jeanne" });
  return { message: `${room} released · Ready for front desk` };
}

export function returnRoom(room: string): void {
  const r = findRoom(room);
  if (!r) throw new Error(`no room ${room}`);
  r.stage = "returned";
  r.next = true;
  RETURNS.set(room, Date.now() + UNDO_MS);
}

export function undoReturn(room: string): void {
  const r = findRoom(room);
  if (r?.stage !== "returned") return;
  r.stage = "waiting";
  r.next = false;
  RETURNS.delete(room);
}

function queueRows(): QueueRoom[] {
  const waiting = ROOMS.filter((r) => r.floor === "2" && r.stage === "waiting").sort(byArrival);
  const firstTimed = waiting.find((r) => r.arrival);
  return waiting.map((r) => ({
    room: r.room,
    title: r.arrival ? `Arrival ${r.arrival}` : "No arrival today",
    detail: `Cleaned by ${STAFF[r.cleaned?.by ?? "jeanne"]?.first} ${r.cleaned?.at ?? ""} · waiting ${r.cleaned?.waited ?? 0} min`,
    chip:
      r === firstTimed
        ? { label: "Next", tone: "danger", icon: "Clock" }
        : { label: r.arrival ?? "Any time", tone: "default" },
  }));
}

export function inspectionQueue(): InspectionQueue {
  const returned = RETURNS.size;
  return {
    eyebrow: "Floor 2 · by next arrival",
    waiting: queueRows(),
    done: RELEASED.filter((d) => findRoom(d.room)?.floor === "2").map((d) => ({
      room: d.room,
      title: `Inspected ${d.at}`,
      detail: `Ready · ${STAFF[d.by]?.first ?? ""}`,
    })),
    doneNote: `${RELEASED.length} passed · ${returned} returned`,
  };
}

/** The queue with nothing in it (`?proto=empty`). */
export function emptyQueue(): InspectionQueue {
  return { eyebrow: "Floor 2 · by next arrival", waiting: [], done: [], doneNote: "0 passed · 0 returned" };
}

export function waitingCount(): number {
  return queueRows().length;
}

export function returned(no: string): ReturnedRoom {
  const view = inspection(no);
  const r = findRoom(view.room);
  const failed = view.checks.filter((c) => c.result === "fail");
  const next = queueRows().filter((q) => q.room !== view.room);
  return {
    room: view.room,
    to: view.cleanedBy,
    title: `${view.room} returned to ${view.cleanedBy}`,
    body: "It is at the top of her list now. The room stays Clean, not Ready, until you inspect it again.",
    seen: failed.map((c) => ({
      id: c.id,
      title: c.label.replace(/ clear$/, ""),
      quote: `"${c.note ?? "Needs another look"}.${r?.arrival ? ` Arrival at ${r.arrival}.` : ""}"`,
      photo: c.photo,
    })),
    next: next[0] ? { ...next[0], detail: next[0].detail.replace(/ · waiting.*$/, "") } : null,
    left: next.length,
    undoUntil: RETURNS.get(view.room) ?? 0,
  };
}

// ---------- team

const REQUESTS: TeamRequest[] = [
  {
    id: "swap-jeanne-chantal",
    icon: "ArrowRightArrowLeft",
    kind: "Shift swap",
    title: "Jeanne ↔ Chantal · Fri 16 Oct",
    body: "14:00 – 22:00. Chantal accepted. Same training, no overtime.",
    decision: null,
    outcome: null,
  },
  {
    id: "leave-grace",
    icon: "Suitcase",
    kind: "Annual leave",
    title: "Grace M. · Tue 20 – Wed 21 Oct",
    body: "2 days. Diane (HR) checks her balance after you approve.",
    decision: null,
    outcome: null,
  },
];

const OUTCOMES: Record<string, { approved: string; declined: string }> = {
  "swap-jeanne-chantal": {
    approved: "Approved · the rota changes and both get a message",
    declined: "Declined · Jeanne and Chantal keep their shifts",
  },
  "leave-grace": {
    approved: "Approved by you · Diane (HR) checks her balance next",
    declined: "Declined · Grace gets a message with your answer",
  },
};

export function team(): TeamToday {
  const members = [
    { ...person("jeanne"), line: "In 204 · since 07:02 · Floor 2", progress: { done: 5, of: 12 } },
    { ...person("grace"), line: "In 202 · since 07:00 · Floor 2", progress: { done: 6, of: 11 } },
    { ...person("chantal"), line: "Floor 3 · since 07:15, 15 min late", progress: { done: 4, of: 10 } },
    { ...person("divine"), line: "Floor 1 · since 06:58", progress: { done: 4, of: 12 } },
    {
      id: "claudine",
      name: "Claudine M.",
      initials: "CM",
      line: "Not clocked in · shift started 07:00",
      progress: null,
    },
  ];
  const working = members.filter((m) => m.progress);
  const done = working.reduce((sum, m) => sum + (m.progress?.done ?? 0), 0);
  const of = working.reduce((sum, m) => sum + (m.progress?.of ?? 0), 0);
  return {
    eyebrow: `${DAY} · housekeeping`,
    stats: [
      { label: "In", value: String(working.length), unit: `/${members.length}` },
      { label: "Rooms done", value: String(done), unit: `/${of}` },
      { label: "Waiting you", value: String(waitingCount()), tone: "accent" },
    ],
    members,
    requests: REQUESTS.map((r) => ({ ...r })),
  };
}

export function decide({ id, decision }: { id: string; decision: "approved" | "declined" }): void {
  const r = REQUESTS.find((x) => x.id === id);
  if (!r) return;
  r.decision = decision;
  r.outcome = OUTCOMES[id]?.[decision] ?? null;
}
