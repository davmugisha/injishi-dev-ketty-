import type { BoardId, FixtureSet, IconName } from "../types.ts";

/**
 * Embedded-database fixtures for the "commercial" area (general manager): ManagerToday, RatesInventory,
 * AvailabilityCalendar, Listing, Packages, Groups, SalesEvents and Revenue.
 * Collection names are "commercial.<thing>"; every document has a stable string `id`.
 * Values are lifted verbatim from the artifact boards (node tools/artifact/extract.mjs <Board>).
 * Each board owns one region below; the `fixtures` object at the end merges them.
 */

/** Semantic tone of a chip, dot or marker (mapped to HeroUI colors with toneColor()). */
export type Tone = "accent" | "success" | "warning" | "danger" | "default" | "info";

/** Intl.NumberFormat options stored with a numeric value. */
export interface NumberFormatSpec {
  style?: "decimal" | "currency" | "percent";
  currency?: string;
  notation?: "standard" | "compact";
  maximumFractionDigits?: number;
  minimumFractionDigits?: number;
}

// #region ManagerToday
/** "Today at a glance" figure on the manager's home. `total` renders "value / total". */
export interface ManagerTodayKpi {
  id: string;
  label: string;
  icon: IconName;
  /** Tint of the KPI icon (artifact kpi__icon data-status). */
  iconStatus: "default" | "warning" | "danger";
  value: number;
  total?: number;
  chip: string;
  chipTone: Tone;
  foot: string;
  board: BoardId;
}

export interface ManagerTodayException {
  id: string;
  category: "rooms" | "guests" | "money";
  icon: IconName;
  title: string;
  desc: string;
  chip: string;
  chipTone: Tone;
  meta: string;
  board: BoardId;
  linkLabel: string;
  actionLabel: string;
  /** Shown once the manager has acted on it. */
  doneLabel: string;
  /** The action opens the no-show confirmation dialog instead of resolving at once. */
  opensDialog?: boolean;
}

/** A column of the housekeeping bottleneck; rooms with `arrival` are needed for an arrival. */
export interface ManagerTodayRoomStatus {
  id: string;
  label: string;
  tone: Tone;
  rooms: { room: string; arrival?: string }[];
}

export interface ManagerTodayOutOfOrder {
  id: string;
  room: string;
  issue: string;
  detail: string;
  chip: string;
  chipTone: Tone;
}

export interface ManagerTodayStaffLine {
  id: string;
  dept: string;
  note: string;
  on: number;
  rostered: number;
}

export interface ManagerTodayOutlet {
  id: string;
  name: string;
  detail: string;
  dotTone: Tone | null;
  chip: string;
  chipTone: Tone;
}

export interface ManagerTodayEvent {
  id: string;
  time: string;
  title: string;
  detail: string;
  status: "current" | "default";
}

/** Last night's no-shows waiting for the manager's confirmation. */
export interface ManagerTodayNoShow {
  id: string;
  initials: string;
  guest: string;
  booking: string;
  detail: string;
  outcome: string;
}

const managerTodayKpis: ManagerTodayKpi[] = [
  {
    id: "arrivals",
    label: "Arrivals",
    icon: "ArrowRightToSquare",
    iconStatus: "default",
    value: 14,
    chip: "3 in",
    chipTone: "default",
    foot: "11 still to arrive · 3 without a room",
    board: "FrontDeskToday",
  },
  {
    id: "departures",
    label: "Departures",
    icon: "ArrowRightFromSquare",
    iconStatus: "default",
    value: 11,
    chip: "7 out",
    chipTone: "default",
    foot: "4 due by 11:00 · 1 payment unknown",
    board: "FrontDeskToday",
  },
  {
    id: "inhouse",
    label: "In-house now",
    icon: "House",
    iconStatus: "default",
    value: 25,
    chip: "80% tonight",
    chipTone: "default",
    foot: "32 of 40 sellable rooms tonight · 2 out of order",
    board: "RoomRack",
  },
  {
    id: "ready",
    label: "Ready before 14:00",
    icon: "BroomMotion",
    iconStatus: "warning",
    value: 6,
    total: 11,
    chip: "5 short",
    chipTone: "danger",
    foot: "3 being cleaned · 4 awaiting inspection",
    board: "HousekeepingBoard",
  },
  {
    id: "overdue",
    label: "Overdue requests",
    icon: "CommentDot",
    iconStatus: "danger",
    value: 4,
    chip: "2 escalated",
    chipTone: "warning",
    foot: "Past response time · oldest 52 min",
    board: "Messages",
  },
];

const managerTodayExceptions: ManagerTodayException[] = [
  {
    id: "e204",
    category: "rooms",
    icon: "BroomMotion",
    title: "Room 204 is dirty and Sarah Kimani arrives at 11:30",
    desc: "Deluxe Lake View · BK-20431 · Jeanne has 2 rooms ahead · 208 is inspected and the same type",
    chip: "In 45 min",
    chipTone: "danger",
    meta: "Housekeeping · raised 10:41",
    board: "HousekeepingBoard",
    linkLabel: "Board",
    actionLabel: "Rush clean",
    doneLabel: "Top of Jeanne’s list · 10:46",
  },
  {
    id: "eUn",
    category: "rooms",
    icon: "LayoutCells",
    title: "3 arrivals have no room assigned",
    desc: "Thomas Weber, Twin, 13:00 · Aisha Mohammed, Deluxe, 14:00 · Daniel Okafor, Family Suite, 15:30",
    chip: "First at 13:00",
    chipTone: "warning",
    meta: "Front desk · Eric Habimana",
    board: "FrontDeskToday",
    linkLabel: "Arrivals",
    actionLabel: "Suggest rooms",
    doneLabel: "Suggested 301, 212, 401 · desk confirms",
  },
  {
    id: "ePay",
    category: "money",
    icon: "CreditCard",
    title: "Payment unknown on a departure, room 310",
    desc: "Marie Claire Uwimana · MTN MoMo RWF 310,000 · PI-77142 · ref MP261012.1031.C77142 · do not charge again",
    chip: "Unknown — checking with provider",
    chipTone: "warning",
    meta: "Since 10:31 · 2 status checks",
    board: "StayFolio",
    linkLabel: "Folio",
    actionLabel: "Hold checkout",
    doneLabel: "Checkout held · Finance notified",
  },
  {
    id: "eEsc",
    category: "guests",
    icon: "PersonMagnifier",
    title: "Minibar dispute escalated, room 309",
    desc: "Guest disputes RWF 18,000 for two items · Eric Habimana paused the charge and asked for you",
    chip: "Since 10:22",
    chipTone: "warning",
    meta: "Escalated by front desk",
    board: "Messages",
    linkLabel: "Thread",
    actionLabel: "Take over",
    doneLabel: "You took this · 10:46",
  },
  {
    id: "eReq",
    category: "guests",
    icon: "CommentDot",
    title: "4 guest requests past response time",
    desc: "306 towels, 52 min · 210 airport transfer, 41 min · 402 baby cot, 35 min · 311 AC, 28 min (WO-322)",
    chip: "2 escalated",
    chipTone: "danger",
    meta: "Target 20 min",
    board: "Messages",
    linkLabel: "Messages",
    actionLabel: "Reassign",
    doneLabel: "Reassigned to duty team",
  },
  {
    id: "eNs",
    category: "guests",
    icon: "PersonXmark",
    title: "2 no-shows from last night to confirm",
    desc: "Pierre Laurent, BK-20402, deposit Verified · Fatuma Hassan, BK-20409, not guaranteed",
    chip: "Held since 03:12",
    chipTone: "default",
    meta: "Night audit · rooms held until you confirm",
    board: "Reservations",
    linkLabel: "Bookings",
    actionLabel: "Review",
    doneLabel: "2 no-shows confirmed · rooms released",
    opensDialog: true,
  },
  {
    id: "eCr",
    category: "money",
    icon: "Briefcase",
    title: "Umurage Consulting is near its credit limit",
    desc: "Jean Bosco Nkurunziza leaves 305 today · posting takes the account to RWF 2.46M of 2.5M",
    chip: "Before 12:00",
    chipTone: "default",
    meta: "Credit control · 62 days past due",
    board: "StayFolio",
    linkLabel: "Folio",
    actionLabel: "Ask Finance",
    doneLabel: "Sent to Grace Uwera · 10:46",
  },
];

const managerTodayRoomStatus: ManagerTodayRoomStatus[] = [
  {
    id: "dirty",
    label: "Dirty",
    tone: "warning",
    rooms: [
      { room: "204", arrival: "11:30" },
      { room: "211", arrival: "13:00" },
      { room: "302", arrival: "13:30" },
      { room: "108" },
      { room: "110" },
      { room: "205" },
      { room: "304" },
      { room: "403" },
    ],
  },
  {
    id: "cleaning",
    label: "Cleaning",
    tone: "info",
    rooms: [{ room: "303", arrival: "12:30" }, { room: "206" }, { room: "209" }],
  },
  {
    id: "inspect",
    label: "To inspect",
    tone: "accent",
    rooms: [{ room: "207", arrival: "12:00" }, { room: "201" }, { room: "301" }, { room: "107" }],
  },
  {
    id: "ready",
    label: "Ready",
    tone: "success",
    rooms: [{ room: "202" }, { room: "208" }, { room: "212" }, { room: "101" }, { room: "103" }, { room: "401" }],
  },
];

const managerTodayOutOfOrder: ManagerTodayOutOfOrder[] = [
  {
    id: "112",
    room: "112",
    issue: "AC compressor failed",
    detail: "Standard Queen · WO-318 · Jean-Paul Niyonsaba · part on PO-26-0142",
    chip: "Out of order to 14 Oct",
    chipTone: "warning",
  },
  {
    id: "406",
    room: "406",
    issue: "Ceiling water damage",
    detail: "Family Suite · WO-311 · external contractor · moisture reading tomorrow",
    chip: "Out of order to 20 Oct",
    chipTone: "warning",
  },
  {
    id: "104",
    room: "104",
    issue: "Slow shower drain",
    detail: "Standard Queen · WO-321 · still sellable, not assignable until fixed",
    chip: "Out of service · 13:00",
    chipTone: "default",
  },
];

const managerTodayStaff: ManagerTodayStaffLine[] = [
  { id: "frontoffice", dept: "Front office", note: "Eric Habimana and 2 others", on: 3, rostered: 3 },
  { id: "housekeeping", dept: "Housekeeping", note: "Beatrice Mukandori · 1 called in sick", on: 6, rostered: 7 },
  { id: "maintenance", dept: "Maintenance", note: "Jean-Paul Niyonsaba · 1 on leave", on: 1, rostered: 2 },
  {
    id: "terrace",
    dept: "Isangano Terrace",
    note: "Joseph Habimana, Claudine Mukamana and 3 others",
    on: 5,
    rostered: 5,
  },
  { id: "kitchen", dept: "Kitchen", note: "Lunch prep for Kivu Hall from 11:00", on: 4, rostered: 4 },
  { id: "lakebar", dept: "Lake Bar", note: "Shift starts 16:00", on: 0, rostered: 2 },
  { id: "security", dept: "Security", note: "Gate and lobby", on: 2, rostered: 2 },
];

const managerTodayOutlets: ManagerTodayOutlet[] = [
  {
    id: "terrace",
    name: "Isangano Terrace",
    detail: "Breakfast closed 10:30 · lunch 12:00–15:00 · 3 open tickets · kitchen display online",
    dotTone: "success",
    chip: "Open",
    chipTone: "success",
  },
  {
    id: "roomservice",
    name: "Room service",
    detail: "2 orders in progress · average 24 min to room",
    dotTone: "success",
    chip: "Open",
    chipTone: "success",
  },
  {
    id: "lakebar",
    name: "Lake Bar",
    detail: "Opens 16:00 · stock count due before opening",
    dotTone: null,
    chip: "Closed",
    chipTone: "default",
  },
  {
    id: "ikawa",
    name: "Ikawa Corner",
    detail: "Tenant outlet run by Ikawa Corner Ltd · only opening status is shared",
    dotTone: "success",
    chip: "Tenant",
    chipTone: "default",
  },
];

const managerTodayEvents: ManagerTodayEvent[] = [
  {
    id: "agm",
    time: "09:00–16:00",
    title: "Rubavu Coffee Growers AGM",
    detail: "Kivu Hall · 85 seated, theatre · event order v3 confirmed",
    status: "current",
  },
  {
    id: "lunch",
    time: "12:30",
    title: "Buffet lunch for 85",
    detail: "Isangano Terrace kitchen · charged to the event master account",
    status: "default",
  },
  {
    id: "turnover",
    time: "16:00–18:00",
    title: "Kivu Hall turnover",
    detail: "Reset to classroom for Tuesday training · 2 porters",
    status: "default",
  },
  {
    id: "weber",
    time: "19:00",
    title: "Weber family dinner",
    detail: "Garden Terrace · 12 guests · set menu · weather check at 16:00",
    status: "default",
  },
];

const managerTodayNoShows: ManagerTodayNoShow[] = [
  {
    id: "BK-20402",
    initials: "PL",
    guest: "Pierre Laurent",
    booking: "BK-20402",
    detail: "Standard Queen · 2 nights · deposit RWF 85,000 Verified, MTN MoMo ref MP261009.1422.B40211",
    outcome: "First night retained",
  },
  {
    id: "BK-20409",
    initials: "FH",
    guest: "Fatuma Hassan",
    booking: "BK-20409",
    detail: "Twin · 3 nights · not guaranteed · called 22:10, no answer",
    outcome: "No fee",
  },
];

const managerTodayFixtures = {
  "commercial.managerKpis": managerTodayKpis,
  "commercial.managerExceptions": managerTodayExceptions,
  "commercial.managerRoomStatus": managerTodayRoomStatus,
  "commercial.managerOutOfOrder": managerTodayOutOfOrder,
  "commercial.managerStaff": managerTodayStaff,
  "commercial.managerOutlets": managerTodayOutlets,
  "commercial.managerEvents": managerTodayEvents,
  "commercial.managerNoShows": managerTodayNoShows,
} satisfies FixtureSet;
// #endregion ManagerToday

// #region RatesInventory
/** Unit domain: hotel rooms sold by the night, or residence units leased by the month. */
export type RatesInventoryDomain = "hospitality" | "residence";

/** State of one physical room on the room-type tiles (artifact codes i, c, d, o, v, x, s). */
export type RatesInventoryRoomStatus =
  | "inspected"
  | "toInspect"
  | "dirty"
  | "occupied"
  | "stayoverDue"
  | "outOfOrder"
  | "outOfService";

export interface RatesInventoryRoom {
  number: string;
  status: RatesInventoryRoomStatus;
}

/** A sellable room type (Room types tab). The room count is `rooms.length`. */
export interface RatesInventoryRoomType {
  id: string;
  name: string;
  domain: RatesInventoryDomain;
  beds: string;
  bedsLong: string;
  capacity: string;
  size: string;
  range: string;
  /** Best available rate, RWF per room per night. */
  barFrom: number;
  amenities: string;
  rooms: RatesInventoryRoom[];
  history: string;
}

/** One line of a scheduled rate change: current value and value from the draft's effective date. */
export interface RatesInventoryRateLine {
  label: string;
  current: string;
  next: string;
}

export interface RatesInventoryPlanVersion {
  title: string;
  detail: string;
  status: "success" | "default";
}

/** A rate change that was scheduled (or sent to the owner) with its audit note. */
export interface RatesInventoryPendingChange {
  note: string;
  from: string;
  to: string | null;
  by: string;
  at: string;
}

/** A rate plan (Rate plans tab) with its draft change. Dates of the draft are ISO yyyy-mm-dd; `null` = open-ended. */
export interface RatesInventoryRatePlan {
  id: string;
  name: string;
  code: string;
  version: string;
  basis: string;
  effective: string;
  stay: string;
  mealPlan: string;
  status: string;
  statusTone: Tone;
  closedDays: string;
  cancellation: string;
  taxClassification: string;
  channels: string[];
  draftVersion: string;
  draftFrom: string;
  draftTo: string | null;
  lineHead: string;
  lines: RatesInventoryRateLine[];
  /** Negotiated rates: the owner approves changes before they take effect. */
  needsOwnerApproval: boolean;
  draftNote: string;
  pendingChange: RatesInventoryPendingChange | null;
  history: RatesInventoryPlanVersion[];
}

export type RatesInventorySpaceDayState = "booked" | "free" | "hold" | "clash";

export interface RatesInventorySpaceDay {
  date: string;
  state: RatesInventorySpaceDayState;
}

/** An event space (Spaces tab). Never counts toward room occupancy. */
export interface RatesInventorySpace {
  id: string;
  name: string;
  kind: string;
  photo: import("../media.ts").StockKey;
  layouts: string;
  prices: string;
  catering: string;
  soldBy: string;
  week: RatesInventorySpaceDay[];
  warning: { title: string; description: string } | null;
}

/** An amenity and the room types (ids) that include it (Amenities tab). */
export interface RatesInventoryAmenity {
  id: string;
  name: string;
  group: string;
  roomTypeIds: string[];
  onListing: boolean;
}

/** A meal plan (Meal plans tab). `null` fields render as "—". */
export interface RatesInventoryMealPlan {
  id: string;
  name: string;
  code: string;
  includes: string;
  supplementPerGuest: number | null;
  servedBy: string | null;
  taxClassification: string | null;
  usedBy: string;
}

const ratesInventoryRoomCodes: Record<string, RatesInventoryRoomStatus> = {
  i: "inspected",
  c: "toInspect",
  d: "dirty",
  o: "occupied",
  v: "stayoverDue",
  x: "outOfOrder",
  s: "outOfService",
};

/** "101:i 102:o" (the artifact's room codes) → rooms. */
const ratesInventoryRooms = (spec: string): RatesInventoryRoom[] =>
  spec.split(" ").map((entry) => {
    const [number = "", code = "o"] = entry.split(":");
    return { number, status: ratesInventoryRoomCodes[code] ?? "occupied" };
  });

const ratesInventoryDayStates: Record<string, RatesInventorySpaceDayState> = {
  b: "booked",
  f: "free",
  h: "hold",
  c: "clash",
};

/** "bbfhbfb" → the next 7 days from Monday 12 Oct 2026. */
const ratesInventoryWeek = (spec: string): RatesInventorySpaceDay[] =>
  [...spec].map((code, i) => ({ date: `2026-10-${12 + i}`, state: ratesInventoryDayStates[code] ?? "free" }));

const ratesInventoryRoomTypes: RatesInventoryRoomType[] = [
  {
    id: "sq",
    name: "Standard Queen",
    domain: "hospitality",
    beds: "1 queen",
    bedsLong: "1 queen bed · cot on request",
    capacity: "2 adults",
    size: "24 m²",
    range: "101–112",
    barFrom: 85000,
    amenities: "Garden view, shower, desk, smart TV",
    rooms: ratesInventoryRooms("101:i 102:o 103:i 104:s 105:o 106:o 107:c 108:v 109:o 110:v 111:o 112:x"),
    history: "101 and 102 are step-free accessible rooms. Room 112 is out of order until 14 Oct (WO-318).",
  },
  {
    id: "tw",
    name: "Twin",
    domain: "hospitality",
    beds: "2 singles",
    bedsLong: "2 single beds · can join on request",
    capacity: "2 adults",
    size: "26 m²",
    range: "301–310",
    barFrom: 92000,
    amenities: "Garden view, shower, desk, smart TV",
    rooms: ratesInventoryRooms("301:c 302:d 303:d 304:v 305:o 306:o 307:o 308:o 309:o 310:o"),
    history:
      "Room 311 moved from Twin to Deluxe Lake View on 1 Jun 2026. Its 214 earlier stays keep their original room type.",
  },
  {
    id: "dlv",
    name: "Deluxe Lake View",
    domain: "hospitality",
    beds: "1 king",
    bedsLong: "1 king bed · sofa bed for 1 child",
    capacity: "2 adults + 1 child",
    size: "32 m²",
    range: "201–212, 311–312",
    barFrom: 140000,
    amenities: "Lake view, balcony, bathtub, minibar, safe",
    rooms: ratesInventoryRooms("201:c 202:i 203:o 204:d 205:v 206:v 207:c 208:i 209:v 210:o 211:d 212:i 311:o 312:o"),
    history:
      "Rooms 311 and 312 joined this type on 1 Jun 2026 after the balcony works. Earlier stays keep their original room type.",
  },
  {
    id: "fs",
    name: "Family Suite",
    domain: "hospitality",
    beds: "1 king + 2 singles",
    bedsLong: "1 king bed and 2 single beds in a second room",
    capacity: "4 guests",
    size: "48 m²",
    range: "401–406",
    barFrom: 220000,
    amenities: "Lake view, lounge, kitchenette, bathtub",
    rooms: ratesInventoryRooms("401:i 402:o 403:v 404:o 405:o 406:x"),
    history: "Room 406 is out of order until 20 Oct (WO-311) and is excluded from availability.",
  },
];

const ratesInventoryRatePlans: RatesInventoryRatePlan[] = [
  {
    id: "bar",
    name: "Best available rate",
    code: "BAR",
    version: "v6",
    basis: "Base · per room type",
    effective: "1 Jul 2026 – open",
    stay: "Min 1 · max 14",
    mealPlan: "Room only",
    status: "Active",
    statusTone: "success",
    closedDays: "None",
    cancellation: "Flexible v3 · free until 48 h before arrival",
    taxClassification: "TX-ACC-01 Accommodation",
    channels: ["Direct web", "Front desk", "Marketplace", "Booking.com"],
    draftVersion: "v7",
    draftFrom: "2027-01-01",
    draftTo: null,
    lineHead: "Room type",
    lines: [
      { label: "Standard Queen", current: "85,000", next: "88,000" },
      { label: "Twin", current: "92,000", next: "95,000" },
      { label: "Deluxe Lake View", current: "140,000", next: "145,000" },
      { label: "Family Suite", current: "220,000", next: "228,000" },
    ],
    needsOwnerApproval: false,
    draftNote: "",
    pendingChange: null,
    history: [
      { title: "v6 · from 1 Jul 2026", detail: "Aline Uwase · dry season prices · 24 Jun 2026", status: "success" },
      { title: "v5 · 1 Jan – 30 Jun 2026", detail: "Aline Uwase · annual review", status: "default" },
    ],
  },
  {
    id: "nrf",
    name: "Non-refundable",
    code: "NRF",
    version: "v2",
    basis: "Derived · BAR −12%",
    effective: "1 Aug 2026 – open",
    stay: "Min 2 · max 7",
    mealPlan: "Room only",
    status: "Active",
    statusTone: "success",
    closedDays: "24 Dec – 2 Jan",
    cancellation: "Non-refundable v2 · no refund after booking",
    taxClassification: "TX-ACC-01 Accommodation",
    channels: ["Direct web", "Marketplace", "Booking.com"],
    draftVersion: "v3",
    draftFrom: "2026-11-01",
    draftTo: null,
    lineHead: "Rule",
    lines: [
      { label: "Discount against BAR", current: "12%", next: "10%" },
      { label: "Minimum stay", current: "2 nights", next: "2 nights" },
    ],
    needsOwnerApproval: false,
    draftNote: "",
    pendingChange: null,
    history: [
      { title: "v2 · from 1 Aug 2026", detail: "Aline Uwase · closed over the holidays", status: "success" },
      { title: "v1 · 1 May – 31 Jul 2026", detail: "Didier Mugenzi · plan created", status: "default" },
    ],
  },
  {
    id: "corp",
    name: "Corporate Umurage",
    code: "CORP-UMU",
    version: "v3",
    basis: "Negotiated · fixed per type",
    effective: "1 Jan – 31 Dec 2026",
    stay: "Min 1 · max 30",
    mealPlan: "Bed & breakfast",
    status: "Active",
    statusTone: "success",
    closedDays: "23–26 Oct (EAC Health Forum)",
    cancellation: "Corporate v1 · free until 18:00 on arrival day",
    taxClassification: "TX-ACC-01 Accommodation · TX-FB-01 Breakfast",
    channels: ["Front desk", "Corporate booking link"],
    draftVersion: "v4",
    draftFrom: "2026-11-01",
    draftTo: "2027-12-31",
    lineHead: "Room type",
    lines: [
      { label: "Standard Queen", current: "76,000", next: "80,000" },
      { label: "Twin", current: "82,000", next: "86,000" },
      { label: "Deluxe Lake View", current: "118,000", next: "124,000" },
      { label: "Family Suite", current: "Not offered", next: "Not offered" },
    ],
    needsOwnerApproval: true,
    draftNote:
      "Contract renewal signed 8 Oct 2026 with Umurage Consulting Ltd (ref UC-2026-11). Room rates up about 5% from 1 Nov; breakfast stays included.",
    pendingChange: null,
    history: [
      { title: "v3 · from 1 Jan 2026", detail: "Aline Uwase · annual renewal, contract UC-2025-14", status: "success" },
      {
        title: "v2 · 1 Jun – 31 Dec 2025",
        detail: "Didier Mugenzi · Family Suite removed from contract",
        status: "default",
      },
      { title: "v1 · 1 Jan – 31 May 2025", detail: "Didier Mugenzi · plan created", status: "default" },
    ],
  },
  {
    id: "bb",
    name: "Bed & Breakfast",
    code: "BB",
    version: "v4",
    basis: "Derived · BAR + RWF 15,000 per guest",
    effective: "1 Jul 2026 – open",
    stay: "Min 1 · max 14",
    mealPlan: "Bed & breakfast",
    status: "Active",
    statusTone: "success",
    closedDays: "None",
    cancellation: "Flexible v3 · free until 48 h before arrival",
    taxClassification: "TX-ACC-01 Accommodation · TX-FB-01 Breakfast",
    channels: ["Direct web", "Front desk", "Marketplace"],
    draftVersion: "v5",
    draftFrom: "2027-01-01",
    draftTo: null,
    lineHead: "Rule",
    lines: [{ label: "Breakfast supplement per guest", current: "15,000", next: "16,000" }],
    needsOwnerApproval: false,
    draftNote: "",
    pendingChange: null,
    history: [
      { title: "v4 · from 1 Jul 2026", detail: "Aline Uwase · follows BAR v6", status: "success" },
      { title: "v3 · 1 Jan – 30 Jun 2026", detail: "Aline Uwase", status: "default" },
    ],
  },
];

const ratesInventorySpaces: RatesInventorySpace[] = [
  {
    id: "kivu-hall",
    name: "Kivu Hall",
    kind: "Indoor function room · 180 m² · ground floor",
    photo: "kivuHallBanquet",
    layouts: "Theatre 120 · banquet 96 · classroom 70 · U-shape 40",
    prices: "Half day 450,000 · full day 750,000 · evening 500,000",
    catering: "Isangano Terrace kitchen",
    soldBy: "Amahoro Hospitality Ltd",
    week: ratesInventoryWeek("bbfhbfb"),
    warning: null,
  },
  {
    id: "garden-terrace",
    name: "Garden Terrace",
    kind: "Outdoor lakeside lawn · weather dependent",
    photo: "gardenTerraceEventLawn",
    layouts: "Standing 80 · banquet 40",
    prices: "Evening 300,000 · day 220,000",
    catering: "Isangano Terrace and Lake Bar",
    soldBy: "Amahoro Hospitality Ltd",
    week: ratesInventoryWeek("bfffhbc"),
    warning: {
      title: "Sunday 18 Oct has two holds at 18:00",
      description:
        "A confirmed wedding toast (17:00–19:00) overlaps a dinner hold from 18:00. Sales must release or move one before either is confirmed.",
    },
  },
];

const ratesInventoryAmenities: RatesInventoryAmenity[] = [
  { id: "lake-view", name: "Lake view", group: "View", roomTypeIds: ["dlv", "fs"], onListing: true },
  { id: "private-balcony", name: "Private balcony", group: "Room", roomTypeIds: ["dlv", "fs"], onListing: true },
  {
    id: "air-conditioning",
    name: "Air conditioning",
    group: "Comfort",
    roomTypeIds: ["sq", "tw", "dlv", "fs"],
    onListing: true,
  },
  { id: "bathtub", name: "Bathtub", group: "Bathroom", roomTypeIds: ["dlv", "fs"], onListing: true },
  { id: "rain-shower", name: "Rain shower", group: "Bathroom", roomTypeIds: ["sq", "tw", "dlv"], onListing: true },
  { id: "minibar", name: "Minibar", group: "Food and drink", roomTypeIds: ["dlv", "fs"], onListing: true },
  {
    id: "tea-coffee-tray",
    name: "Tea and coffee tray",
    group: "Food and drink",
    roomTypeIds: ["sq", "tw", "dlv", "fs"],
    onListing: true,
  },
  { id: "in-room-safe", name: "In-room safe", group: "Security", roomTypeIds: ["tw", "dlv", "fs"], onListing: true },
  { id: "kitchenette", name: "Kitchenette", group: "Food and drink", roomTypeIds: ["fs"], onListing: true },
  { id: "step-free-access", name: "Step-free access", group: "Accessibility", roomTypeIds: ["sq"], onListing: false },
];

const ratesInventoryMealPlans: RatesInventoryMealPlan[] = [
  {
    id: "ro",
    name: "Room only",
    code: "RO",
    includes: "No meals",
    supplementPerGuest: null,
    servedBy: null,
    taxClassification: null,
    usedBy: "BAR, Non-refundable",
  },
  {
    id: "bb",
    name: "Bed & breakfast",
    code: "BB",
    includes: "Buffet breakfast 06:30–10:30",
    supplementPerGuest: 15000,
    servedBy: "Isangano Terrace · in-house",
    taxClassification: "TX-FB-01 Food",
    usedBy: "Bed & Breakfast, Corporate Umurage",
  },
  {
    id: "hb",
    name: "Half board",
    code: "HB",
    includes: "Breakfast and set dinner",
    supplementPerGuest: 35000,
    servedBy: "Isangano Terrace · in-house",
    taxClassification: "TX-FB-01 Food",
    usedBy: "Group contracts",
  },
  {
    id: "fb",
    name: "Full board",
    code: "FB",
    includes: "Breakfast, lunch and dinner",
    supplementPerGuest: 55000,
    servedBy: "Isangano Terrace · in-house",
    taxClassification: "TX-FB-01 Food",
    usedBy: "Not in use",
  },
];

const ratesInventoryFixtures = {
  "commercial.ratesInventoryRoomTypes": ratesInventoryRoomTypes,
  "commercial.ratesInventoryRatePlans": ratesInventoryRatePlans,
  "commercial.ratesInventorySpaces": ratesInventorySpaces,
  "commercial.ratesInventoryAmenities": ratesInventoryAmenities,
  "commercial.ratesInventoryMealPlans": ratesInventoryMealPlans,
} satisfies FixtureSet;
// #endregion RatesInventory

// #region AvailabilityCalendar
/** One night of the 14-night availability window (index 0 is today, Sun 12 Oct 2026). */
export interface AvailabilityCalendarNight {
  id: string;
  /** Position in the window, 0–13. */
  index: number;
  weekday: string;
  day: number;
  month: string;
  year: number;
  isWeekend: boolean;
  isToday: boolean;
  /** Channel-manager push for this night. */
  sync: "ok" | "queued" | "failed";
}

/** The window of nights the calendar shows, with its heading as the board writes it. */
export interface AvailabilityCalendarWindow {
  id: string;
  label: string;
  nights: number;
}

/** A rate plan the grid can show, and how its nightly price derives from the room type's rates. */
export interface AvailabilityCalendarRatePlan {
  id: string;
  label: string;
  /** "bar": derived from the best available rate; "corporate": the room type's negotiated rate. */
  basis: "bar" | "corporate";
  /** Multiplier on BAR, rounded to the nearest 1,000 (Non-refundable). */
  factor?: number;
  /** RWF added per night on top of BAR (Bed & Breakfast for 2 guests). */
  supplement?: number;
  /** First night index on which the plan is closed to sale. */
  closedFrom?: number;
}

/** A value that applies to one night of the window. */
export interface AvailabilityCalendarNightValue {
  night: number;
  value: number;
}

/** A room type row: inventory, rates and restrictions per night. */
export interface AvailabilityCalendarRoomType {
  id: string;
  name: string;
  rooms: number;
  /** Best available rate, RWF per room per night. */
  bar: number;
  /** Corporate Umurage rate; 0 when the room type is not sold on that plan. */
  corporate: number;
  /** Rooms sold per night, nights 0–13. */
  sold: number[];
  /** Rooms of this type held by the group block on the block's nights. */
  blockRooms: number;
  /** One room is out of order on nights before this index. */
  outOfOrderUntil: number;
  minStay: AvailabilityCalendarNightValue[];
  priceOverrides: AvailabilityCalendarNightValue[];
  /** Price changes awaiting approval. */
  pendingPrices: AvailabilityCalendarNightValue[];
  stopSell: number[];
  /** Closed to arrival. */
  noArrival: number[];
}

export interface AvailabilityCalendarGroupBlock {
  id: string;
  label: string;
  firstNight: number;
  nights: number;
  board: BoardId;
}

export interface AvailabilityCalendarIssue {
  id: string;
  tone: Tone;
  icon: IconName;
  title: string;
  description: string;
  actions: { label: string; board: BoardId; variant: "primary" | "secondary" }[];
}

export interface AvailabilityCalendarChannel {
  id: string;
  name: string;
  detail: string;
  status: string;
  tone: Tone;
  /** A failed push the manager can retry, and how the channel reads once the retry is sent. */
  retry?: { detail: string; status: string; tone: Tone };
}

export interface AvailabilityCalendarHold {
  id: string;
  icon: IconName;
  title: string;
  detail: string;
  board: BoardId;
}

/** Reasons a manager can record with a price or restriction change. */
export interface AvailabilityCalendarReason {
  id: string;
  label: string;
}

const availabilityCalendarNightRows: [string, number, "ok" | "queued" | "failed"][] = [
  ["Sun", 12, "ok"],
  ["Mon", 13, "ok"],
  ["Tue", 14, "ok"],
  ["Wed", 15, "ok"],
  ["Thu", 16, "ok"],
  ["Fri", 17, "ok"],
  ["Sat", 18, "ok"],
  ["Sun", 19, "ok"],
  ["Mon", 20, "ok"],
  ["Tue", 21, "ok"],
  ["Wed", 22, "ok"],
  ["Thu", 23, "queued"],
  ["Fri", 24, "failed"],
  ["Sat", 25, "ok"],
];

const availabilityCalendarNights: AvailabilityCalendarNight[] = availabilityCalendarNightRows.map(
  ([weekday, day, sync], index) => ({
    id: `2026-10-${day}`,
    index,
    weekday,
    day,
    month: "Oct",
    year: 2026,
    isWeekend: weekday === "Fri" || weekday === "Sat",
    isToday: index === 0,
    sync,
  }),
);

const availabilityCalendarRatePlans: AvailabilityCalendarRatePlan[] = [
  { id: "bar", label: "BAR", basis: "bar" },
  { id: "nrf", label: "Non-refundable", basis: "bar", factor: 0.88 },
  { id: "corp", label: "Corporate Umurage", basis: "corporate", closedFrom: 11 },
  { id: "bb", label: "Bed & Breakfast", basis: "bar", supplement: 30000 },
];

const availabilityCalendarWeekendMinStay: AvailabilityCalendarNightValue[] = [
  { night: 5, value: 2 },
  { night: 6, value: 2 },
  { night: 12, value: 2 },
  { night: 13, value: 2 },
];

const availabilityCalendarRoomTypes: AvailabilityCalendarRoomType[] = [
  {
    id: "sq",
    name: "Standard Queen",
    rooms: 12,
    bar: 85000,
    corporate: 76000,
    sold: [8, 7, 6, 7, 8, 10, 11, 6, 5, 6, 7, 3, 4, 3],
    blockRooms: 8,
    outOfOrderUntil: 2,
    minStay: [],
    priceOverrides: [{ night: 6, value: 95000 }],
    pendingPrices: [],
    stopSell: [],
    noArrival: [],
  },
  {
    id: "tw",
    name: "Twin",
    rooms: 10,
    bar: 92000,
    corporate: 82000,
    sold: [7, 6, 5, 6, 7, 9, 8, 5, 4, 5, 6, 3, 4, 2],
    blockRooms: 6,
    outOfOrderUntil: 0,
    minStay: [],
    priceOverrides: [],
    pendingPrices: [],
    stopSell: [6],
    noArrival: [],
  },
  {
    id: "dlv",
    name: "Deluxe Lake View",
    rooms: 14,
    bar: 140000,
    corporate: 118000,
    sold: [13, 9, 8, 9, 11, 12, 13, 8, 7, 8, 9, 5, 6, 4],
    blockRooms: 8,
    outOfOrderUntil: 0,
    minStay: availabilityCalendarWeekendMinStay,
    priceOverrides: [
      { night: 5, value: 150000 },
      { night: 6, value: 150000 },
    ],
    pendingPrices: [
      { night: 12, value: 152000 },
      { night: 13, value: 152000 },
    ],
    stopSell: [],
    noArrival: [],
  },
  {
    id: "fs",
    name: "Family Suite",
    rooms: 6,
    bar: 220000,
    corporate: 0,
    sold: [4, 3, 2, 3, 4, 5, 5, 3, 2, 2, 3, 2, 4, 2],
    blockRooms: 3,
    outOfOrderUntil: 8,
    minStay: availabilityCalendarWeekendMinStay,
    priceOverrides: [],
    pendingPrices: [],
    stopSell: [],
    noArrival: [6],
  },
];

const availabilityCalendarGroupBlocks: AvailabilityCalendarGroupBlock[] = [
  { id: "eac-health-forum", label: "EAC Health Forum · 25 rooms", firstNight: 11, nights: 3, board: "Groups" },
];

const availabilityCalendarIssues: AvailabilityCalendarIssue[] = [
  {
    id: "family-suite-overbooked",
    tone: "danger",
    icon: "TriangleExclamation",
    title: "Family Suite is overbooked by 1 on Saturday 24 October",
    description:
      "6 suites: 4 confirmed bookings plus 3 held by the EAC Health Forum block. The block grew from 2 to 3 suites on 9 Oct while BK-20466 from Booking.com was on a payment hold. Nothing has been cancelled; release one unsold suite from the block or move a guest.",
    actions: [
      { label: "Bookings on 24 Oct", board: "Reservations", variant: "secondary" },
      { label: "Open group block", board: "Groups", variant: "primary" },
    ],
  },
];

const availabilityCalendarChannels: AvailabilityCalendarChannel[] = [
  {
    id: "direct",
    name: "Direct web and front desk",
    detail: "Live from Injishi inventory · no sync needed",
    status: "Live",
    tone: "success",
  },
  {
    id: "marketplace",
    name: "Injishi marketplace",
    detail: "Same inventory · last read 10:57",
    status: "Live",
    tone: "success",
  },
  {
    id: "booking-com",
    name: "Booking.com via channel manager",
    detail: "24 Oct Family Suite rejected: availability below zero · 23 Oct update queued",
    status: "Failed 10:41",
    tone: "danger",
    retry: {
      detail: "Retry sent 10:59 with the same request ID · waiting for acknowledgement",
      status: "Waiting",
      tone: "warning",
    },
  },
  {
    id: "expedia",
    name: "Expedia",
    detail: "Mapping drafted · partner contract not signed",
    status: "Not connected",
    tone: "default",
  },
];

const availabilityCalendarHolds: AvailabilityCalendarHold[] = [
  {
    id: "eac-health-forum",
    icon: "Persons",
    title: "EAC Health Forum · 25 rooms, 23–26 Oct",
    detail: "17 picked up · unsold rooms return to general inventory at cutoff, Fri 16 Oct 18:00",
    board: "Groups",
  },
  {
    id: "dlv-pending-rate",
    icon: "Tag",
    title: "Deluxe Lake View RWF 152,000 for 24–26 Oct",
    detail: "Revenue suggestion reviewed by you · waiting for Didier Mugenzi · expires 18:00",
    board: "Revenue",
  },
  {
    id: "out-of-order",
    icon: "Wrench",
    title: "Rooms 112 and 406 out of order",
    detail: "112 back 14 Oct (WO-318) · 406 back 20 Oct (WO-311) · excluded above",
    board: "Maintenance",
  },
  {
    id: "request-to-book",
    icon: "Hourglass",
    title: "2 request-to-book holds expire today at 18:00",
    detail: "Twin 17–19 Oct and Deluxe Lake View 20–21 Oct · auto-decline releases the rooms",
    board: "Reservations",
  },
];

/** The board shows the first reason; the others make the select usable. */
const availabilityCalendarReasons: AvailabilityCalendarReason[] = [
  { id: "midweek-demand", label: "Midweek demand below forecast" },
  { id: "event-demand", label: "Event demand above forecast" },
  { id: "competitor-rates", label: "Competitor rates changed" },
  { id: "group-displacement", label: "Group block displacement" },
];

const availabilityCalendarWindows: AvailabilityCalendarWindow[] = [
  { id: "2026-10-12", label: "Sun 12 – Sun 25 Oct 2026", nights: 14 },
];

const availabilityCalendarFixtures = {
  "commercial.calendarWindows": availabilityCalendarWindows,
  "commercial.calendarNights": availabilityCalendarNights,
  "commercial.calendarRatePlans": availabilityCalendarRatePlans,
  "commercial.calendarRoomTypes": availabilityCalendarRoomTypes,
  "commercial.calendarGroupBlocks": availabilityCalendarGroupBlocks,
  "commercial.calendarIssues": availabilityCalendarIssues,
  "commercial.calendarChannels": availabilityCalendarChannels,
  "commercial.calendarHolds": availabilityCalendarHolds,
  "commercial.calendarReasons": availabilityCalendarReasons,
} satisfies FixtureSet;
// #endregion AvailabilityCalendar

// #region Listing
/** How marketplace and direct-booking guests book: straight away, or by request the hotel accepts. */
export type ListingBookingMode = "instant" | "request";

/** The marketplace listing being edited (one document): the draft fields plus the live version it replaces. */
export interface ListingDraft {
  id: string;
  property: string;
  title: string;
  titleMaxLength: number;
  description: string;
  propertyType: string;
  propertyTypes: string[];
  location: string;
  mode: ListingBookingMode;
  /** Publish check: the listing needs at least this many photos. */
  minPhotos: number;
  liveVersion: number;
  draftVersion: number;
  rating: number;
  reviews: number;
  /** Lowest nightly rate shown on the marketplace card (RWF). */
  fromRate: number;
  fromRoomType: string;
  cancellationChip: string;
  /** Request to book: how long the hotel has to reply, and what happens to the rooms meanwhile. */
  replyWithin: string;
  replyWithinOptions: string[];
  requestHold: string;
  requestHoldOptions: string[];
  /** Stamp of the history entry written when the draft is submitted for review. */
  submittedAt: string;
}

/** A listing photo. `image` is a key of `stock` in @injishi/data/media; `listed: false` is ready to upload. */
export interface ListingPhoto {
  id: string;
  caption: string;
  image: string;
  listed: boolean;
}

export interface ListingModeOption {
  id: ListingBookingMode;
  label: string;
  icon: IconName;
  desc: string;
  /** Tone of the mode chip on the marketplace card preview. */
  chipTone: Tone;
}

export interface ListingAmenity {
  id: string;
  label: string;
  shown: boolean;
}

export interface ListingPolicy {
  id: string;
  label: string;
  value: string;
}

/** A publish check. `rule: "photos"` is evaluated live against the photo count (see ListingDraft.minPhotos). */
export interface ListingCheck {
  id: string;
  title: string;
  evidence: string;
  passed: boolean;
  rule: "fixed" | "photos";
}

export interface ListingHistoryEntry {
  id: string;
  title: string;
  detail: string;
  status: "default" | "current" | "success" | "warning" | "danger" | "muted";
  icon: IconName;
}

const listingDrafts: ListingDraft[] = [
  {
    id: "isangano-listing",
    property: "Isangano Lakeside Hotel",
    title: "Isangano Lakeside Hotel — lakefront rooms in Rubavu",
    titleMaxLength: 80,
    description:
      "A 42-room hotel on the shore of Lake Kivu, ten minutes’ walk from Rubavu town. Deluxe rooms and family suites open onto the lake; breakfast and dinner are served at Isangano Terrace. Kivu Hall seats 120 for meetings and celebrations.",
    propertyType: "Hotel",
    propertyTypes: ["Hotel", "Lodge", "Guesthouse", "Serviced apartments"],
    location: "Rubavu, Western Province · Lake Kivu shore",
    mode: "instant",
    minPhotos: 8,
    liveVersion: 12,
    draftVersion: 13,
    rating: 4.6,
    reviews: 38,
    fromRate: 85000,
    fromRoomType: "Standard Queen",
    cancellationChip: "Free cancellation to 48 h",
    replyWithin: "12 hours",
    replyWithinOptions: ["6 hours", "12 hours", "24 hours"],
    requestHold: "Held until reply or decline",
    requestHoldOptions: ["Held until reply or decline", "Not held"],
    submittedAt: "12 Oct, 10:58",
  },
];

const listingPhotos: ListingPhoto[] = [
  { id: "lake", caption: "Lake view from the terrace", image: "lakeViewTerraceSunset", listed: true },
  { id: "dlv", caption: "Deluxe Lake View bedroom", image: "deluxeLakeViewRoom", listed: true },
  { id: "fs", caption: "Family Suite lounge", image: "familySuiteLounge", listed: true },
  { id: "terrace", caption: "Isangano Terrace restaurant", image: "isanganoTerrace", listed: true },
  { id: "hall", caption: "Kivu Hall, conference set-up", image: "kivuHallConference", listed: true },
  { id: "garden", caption: "Garden Terrace at dusk", image: "gardenTerraceDusk", listed: true },
  { id: "twin", caption: "Twin room", image: "twinRoom", listed: true },
  { id: "bath", caption: "Deluxe bathroom with bathtub", image: "deluxeBathroom", listed: false },
];

const listingModes: ListingModeOption[] = [
  {
    id: "instant",
    label: "Instant booking",
    icon: "Thunderbolt",
    desc: "Guests book straight away. The booking confirms only when the deposit payment is Verified.",
    chipTone: "accent",
  },
  {
    id: "request",
    label: "Request to book",
    icon: "Hand",
    desc: "You accept or decline each request. Rooms are held while you decide, then released.",
    chipTone: "default",
  },
];

const listingAmenities: ListingAmenity[] = [
  { id: "lake", label: "Lake view", shown: true },
  { id: "balcony", label: "Balconies", shown: true },
  { id: "wifi", label: "Free Wi-Fi", shown: true },
  { id: "ac", label: "Air conditioning", shown: true },
  { id: "restaurant", label: "Restaurant", shown: true },
  { id: "bar", label: "Bar", shown: true },
  { id: "parking", label: "Secure parking", shown: true },
  { id: "shuttle", label: "Airport shuttle", shown: true },
  { id: "meeting", label: "Meeting rooms", shown: true },
  { id: "access", label: "Accessible rooms", shown: false },
];

const listingPolicies: ListingPolicy[] = [
  { id: "check-in", label: "Check-in", value: "From 14:00" },
  { id: "check-out", label: "Check-out", value: "By 11:00" },
  { id: "cancellation", label: "Cancellation", value: "Flexible v3 · free until 48 h before arrival, then 1 night" },
  { id: "deposit", label: "Deposit", value: "30% when booking online" },
  { id: "children", label: "Children", value: "Under 6 stay free with parents" },
  { id: "pets", label: "Pets", value: "Not allowed" },
  { id: "smoking", label: "Smoking", value: "Garden only" },
];

const listingChecks: ListingCheck[] = [
  {
    id: "business",
    title: "Business is active",
    evidence: "Amahoro Hospitality Ltd · active since 14 Mar 2026",
    passed: true,
    rule: "fixed",
  },
  {
    id: "tin",
    title: "TIN verified",
    evidence: "TIN 102 345 678 · verified 3 Mar 2026 · certificate on file",
    passed: true,
    rule: "fixed",
  },
  {
    id: "ebm",
    title: "EBM route chosen",
    evidence: "Fiscal receipts through VSDC online · chosen 5 Mar 2026",
    passed: true,
    rule: "fixed",
  },
  {
    id: "policies",
    title: "Policies set",
    evidence: "Cancellation Flexible v3, deposit, child and house rules",
    passed: true,
    rule: "fixed",
  },
  { id: "photos", title: "At least 8 photos", evidence: "7 uploaded · add 1 more", passed: false, rule: "photos" },
];

const listingHistory: ListingHistoryEntry[] = [
  {
    id: "v12-published",
    title: "2 Oct 2026, 09:14 · v12 published",
    detail: "Aline Uwase · new cover photo, breakfast plan shown",
    status: "success",
    icon: "PaperPlane",
  },
  {
    id: "bar-deluxe",
    title: "29 Sep, 16:40 · BAR changed for Deluxe Lake View",
    detail: "Aline Uwase · RWF 135,000 to 140,000 from 1 Oct · note: dry season demand",
    status: "default",
    icon: "Tag",
  },
  {
    id: "auto-hidden",
    title: "22 Sep, 07:05 · Listing hidden automatically",
    detail: "TIN re-check got no answer · restored 23 Sep 11:20 after verification",
    status: "warning",
    icon: "EyeSlash",
  },
  {
    id: "mode-instant",
    title: "15 Sep, 12:02 · Booking mode set to Instant",
    detail: "Didier Mugenzi · deposits now required online",
    status: "default",
    icon: "Thunderbolt",
  },
];

const listingFixtures = {
  "commercial.listingDrafts": listingDrafts,
  "commercial.listingPhotos": listingPhotos,
  "commercial.listingModes": listingModes,
  "commercial.listingAmenities": listingAmenities,
  "commercial.listingPolicies": listingPolicies,
  "commercial.listingChecks": listingChecks,
  "commercial.listingHistory": listingHistory,
} satisfies FixtureSet;
// #endregion Listing

// #region Packages
/** Sale state of a package (On sale / Paused / Draft). */
export type PackagesStatus = "on-sale" | "paused" | "draft";

/** Who sells a package component: the hotel, its own outlet, a tenant outlet, a third party, or nobody yet. */
export type PackagesSellerKind = "hotel" | "outlet" | "tenant" | "third-party" | "none";

/** Notice the guest gives before arrival when cancelling a package. */
export type PackagesNoticeTierId = "over-7-days" | "2-7-days" | "under-48-h";

export interface PackagesNoticeTier {
  id: PackagesNoticeTierId;
  label: string;
}

/** One part of a package, sold by its own seller with its own tax treatment and refund terms. */
export interface PackagesComponent {
  id: string;
  name: string;
  seller: string;
  /** TIN, outlet or space under the seller name. */
  sellerDetail: string;
  sellerKind: PackagesSellerKind;
  tax: string;
  /** The tax treatment still has to be verified (agent or tenant sale, or no seller). */
  taxNeedsVerification: boolean;
  availability: string;
  availabilityTone: Tone;
  /** Price when bought on its own (RWF). */
  alone: number;
  /** Share of the package price (RWF): what this seller's fiscal receipt and revenue posting show. */
  share: number;
  /** Refund owed per notice tier (RWF); null while the component has no refund terms. */
  refunds: Record<PackagesNoticeTierId, number> | null;
  refundRule: string;
}

export interface PackagesFact {
  label: string;
  value: string;
}

export interface PackagesAlert {
  tone: "warning" | "danger";
  title: string;
  description: string;
}

export interface PackagesItem {
  id: string;
  icon: IconName;
  name: string;
  code: string;
  status: PackagesStatus;
  /** Package price (RWF). */
  price: number;
  per: string;
  summary: string;
  sold: string;
  alert: PackagesAlert | null;
  facts: PackagesFact[];
  discountFrom: string;
  components: PackagesComponent[];
}

/** A weekend of a package and the component that limits how many can still be sold. */
export interface PackagesWeekend {
  id: string;
  packageId: string;
  dates: string;
  reason: string;
  availability: string;
  tone: Tone;
}

const packagesHotel = "Amahoro Hospitality Ltd";
const packagesHotelTin = "TIN 102 345 678";

const packagesNoticeTiers: PackagesNoticeTier[] = [
  { id: "over-7-days", label: "More than 7 days" },
  { id: "2-7-days", label: "2–7 days" },
  { id: "under-48-h", label: "Under 48 h or no-show" },
];

const packagesItems: PackagesItem[] = [
  {
    id: "lkw",
    icon: "Sun",
    name: "Lake Kivu Weekend",
    code: "LKW-01",
    status: "on-sale",
    price: 420000,
    per: "per package · 2 adults",
    summary: "2 nights Deluxe Lake View, dinner, boat trip and late checkout",
    sold: "14 sold in October",
    alert: null,
    facts: [
      { label: "Sell dates", value: "1 Oct 2026 – 31 Mar 2027" },
      { label: "Stay dates", value: "Friday arrival · 2 nights" },
      { label: "Channels", value: "Direct web, Marketplace, Front desk" },
      { label: "Not on Booking.com", value: "Channel manager cannot carry multi-seller packages" },
    ],
    discountFrom: "Hotel components only; the operator price is fixed by contract",
    components: [
      {
        id: "lkw-room",
        name: "2 nights Deluxe Lake View",
        seller: packagesHotel,
        sellerDetail: packagesHotelTin,
        sellerKind: "hotel",
        tax: "TX-ACC-01 Accommodation",
        taxNeedsVerification: false,
        availability: "Live from room inventory",
        availabilityTone: "success",
        alone: 280000,
        share: 260000,
        refunds: { "over-7-days": 260000, "2-7-days": 260000, "under-48-h": 130000 },
        refundRule: "Flexible v3 · first night kept inside 48 h",
      },
      {
        id: "lkw-dinner",
        name: "Dinner for two, Saturday",
        seller: packagesHotel,
        sellerDetail: "Isangano Terrace",
        sellerKind: "outlet",
        tax: "TX-FB-01 Food",
        taxNeedsVerification: false,
        availability: "Table held at booking · 40 covers a night",
        availabilityTone: "success",
        alone: 70000,
        share: 60000,
        refunds: { "over-7-days": 60000, "2-7-days": 60000, "under-48-h": 0 },
        refundRule: "Free until 48 h before",
      },
      {
        id: "lkw-boat",
        name: "Lake Kivu boat trip, 3 h for two",
        seller: "Kivu Lakeside Boats Ltd",
        sellerDetail: "TIN 109 554 210 · issues its own receipt",
        sellerKind: "third-party",
        tax: "Agent sale · operator taxes",
        taxNeedsVerification: true,
        availability: "Operator confirms each booking · 4 boats a day",
        availabilityTone: "warning",
        alone: 90000,
        share: 90000,
        refunds: { "over-7-days": 90000, "2-7-days": 45000, "under-48-h": 0 },
        refundRule: "Operator terms · 50% inside 7 days",
      },
      {
        id: "lkw-checkout",
        name: "Late checkout to 14:00",
        seller: packagesHotel,
        sellerDetail: packagesHotelTin,
        sellerKind: "hotel",
        tax: "TX-ACC-01 Accommodation",
        taxNeedsVerification: false,
        availability: "Guaranteed for package guests",
        availabilityTone: "success",
        alone: 15000,
        share: 10000,
        refunds: { "over-7-days": 10000, "2-7-days": 10000, "under-48-h": 10000 },
        refundRule: "Refunded if the stay is cancelled",
      },
    ],
  },
  {
    id: "kcm",
    icon: "Mug",
    name: "Kivu Coffee Morning",
    code: "KCM-02",
    status: "paused",
    price: 165000,
    per: "per package · 2 adults",
    summary: "1 night Standard Queen, breakfast and a coffee tasting at Ikawa Corner",
    sold: "3 booked for October",
    alert: {
      tone: "warning",
      title: "Paused automatically on 1 Oct",
      description:
        "The Ikawa Corner Ltd merchant agreement expired on 30 Sep. The 3 packages already booked for October are honoured under the old agreement; renew it before selling again.",
    },
    facts: [
      { label: "Sell dates", value: "1 Jun – 30 Sep 2026" },
      { label: "Stay dates", value: "Any night" },
      { label: "Channels", value: "Direct web, Front desk" },
      { label: "Merchant agreement", value: "Expired 30 Sep · renewal with Ikawa Corner Ltd" },
    ],
    discountFrom: "Hotel components only",
    components: [
      {
        id: "kcm-room",
        name: "1 night Standard Queen",
        seller: packagesHotel,
        sellerDetail: packagesHotelTin,
        sellerKind: "hotel",
        tax: "TX-ACC-01 Accommodation",
        taxNeedsVerification: false,
        availability: "Live from room inventory",
        availabilityTone: "success",
        alone: 85000,
        share: 80000,
        refunds: { "over-7-days": 80000, "2-7-days": 80000, "under-48-h": 0 },
        refundRule: "Flexible v3",
      },
      {
        id: "kcm-breakfast",
        name: "Breakfast for two",
        seller: packagesHotel,
        sellerDetail: "Isangano Terrace",
        sellerKind: "outlet",
        tax: "TX-FB-01 Food",
        taxNeedsVerification: false,
        availability: "Always available",
        availabilityTone: "success",
        alone: 30000,
        share: 25000,
        refunds: { "over-7-days": 25000, "2-7-days": 25000, "under-48-h": 0 },
        refundRule: "Free until 48 h before",
      },
      {
        id: "kcm-tasting",
        name: "Coffee tasting for two",
        seller: "Ikawa Corner Ltd",
        sellerDetail: "TIN 108 221 457 · its own fiscal receipt",
        sellerKind: "tenant",
        tax: "Sold by tenant · tenant taxes",
        taxNeedsVerification: true,
        availability: "Agreement expired 30 Sep",
        availabilityTone: "danger",
        alone: 60000,
        share: 60000,
        refunds: { "over-7-days": 60000, "2-7-days": 30000, "under-48-h": 0 },
        refundRule: "Tenant terms · 50% inside 7 days",
      },
    ],
  },
  {
    id: "cdd",
    icon: "Briefcase",
    name: "Conference Day Delegate",
    code: "CDD-03",
    status: "on-sale",
    price: 38000,
    per: "per delegate · minimum 20",
    summary: "Kivu Hall day hire, lunch, two coffee breaks and AV",
    sold: "6 events booked this quarter",
    alert: null,
    facts: [
      { label: "Sell dates", value: "Open · weekdays only" },
      { label: "Capacity", value: "Up to 70 delegates, classroom" },
      { label: "Channels", value: "Front desk, Sales & events quotes" },
      { label: "Space", value: "Kivu Hall · free 14, 16, 20 Oct" },
    ],
    discountFrom: "Spread across all components",
    components: [
      {
        id: "cdd-hall",
        name: "Kivu Hall day hire share",
        seller: packagesHotel,
        sellerDetail: "Kivu Hall · event space",
        sellerKind: "hotel",
        tax: "TX-EVT-01 Venue hire",
        taxNeedsVerification: false,
        availability: "From the space calendar, not room stock",
        availabilityTone: "success",
        alone: 18000,
        share: 15000,
        refunds: { "over-7-days": 15000, "2-7-days": 7500, "under-48-h": 0 },
        refundRule: "Half kept inside 14 days",
      },
      {
        id: "cdd-lunch",
        name: "Lunch buffet",
        seller: packagesHotel,
        sellerDetail: "Isangano Terrace",
        sellerKind: "outlet",
        tax: "TX-FB-01 Food",
        taxNeedsVerification: false,
        availability: "Kitchen confirms numbers 72 h before",
        availabilityTone: "success",
        alone: 15000,
        share: 13000,
        refunds: { "over-7-days": 13000, "2-7-days": 13000, "under-48-h": 0 },
        refundRule: "Free until 72 h before",
      },
      {
        id: "cdd-breaks",
        name: "Two coffee breaks",
        seller: packagesHotel,
        sellerDetail: "Isangano Terrace",
        sellerKind: "outlet",
        tax: "TX-FB-01 Food",
        taxNeedsVerification: false,
        availability: "Always available",
        availabilityTone: "success",
        alone: 8000,
        share: 6000,
        refunds: { "over-7-days": 6000, "2-7-days": 6000, "under-48-h": 0 },
        refundRule: "Free until 72 h before",
      },
      {
        id: "cdd-av",
        name: "Projector, screen and microphones",
        seller: packagesHotel,
        sellerDetail: "Kivu Hall · event space",
        sellerKind: "hotel",
        tax: "TX-EVT-01 Venue hire",
        taxNeedsVerification: false,
        availability: "2 sets · 1 booked 16 Oct",
        availabilityTone: "success",
        alone: 5000,
        share: 4000,
        refunds: { "over-7-days": 4000, "2-7-days": 4000, "under-48-h": 0 },
        refundRule: "Free until 72 h before",
      },
    ],
  },
  {
    id: "hbl",
    icon: "Heart",
    name: "Honeymoon by the Lake",
    code: "HBL-04",
    status: "draft",
    price: 750000,
    per: "per package · 2 adults",
    summary: "3 nights Deluxe Lake View, two dinners, couples massage and flowers",
    sold: "Not on sale",
    alert: {
      tone: "danger",
      title: "Cannot go on sale yet",
      description:
        "The couples massage has no seller and no contract, so its availability, tax treatment and refund terms are unknown. Choose an operator or remove the component.",
    },
    facts: [
      { label: "Sell dates", value: "Not set" },
      { label: "Stay dates", value: "Any 3 nights" },
      { label: "Channels", value: "None until published" },
      { label: "Missing", value: "Massage seller and contract" },
    ],
    discountFrom: "Hotel components only",
    components: [
      {
        id: "hbl-room",
        name: "3 nights Deluxe Lake View",
        seller: packagesHotel,
        sellerDetail: packagesHotelTin,
        sellerKind: "hotel",
        tax: "TX-ACC-01 Accommodation",
        taxNeedsVerification: false,
        availability: "Live from room inventory",
        availabilityTone: "success",
        alone: 420000,
        share: 390000,
        refunds: { "over-7-days": 390000, "2-7-days": 390000, "under-48-h": 250000 },
        refundRule: "Flexible v3",
      },
      {
        id: "hbl-dinners",
        name: "Two dinners for two",
        seller: packagesHotel,
        sellerDetail: "Isangano Terrace",
        sellerKind: "outlet",
        tax: "TX-FB-01 Food",
        taxNeedsVerification: false,
        availability: "Table held at booking",
        availabilityTone: "success",
        alone: 140000,
        share: 120000,
        refunds: { "over-7-days": 120000, "2-7-days": 120000, "under-48-h": 0 },
        refundRule: "Free until 48 h before",
      },
      {
        id: "hbl-massage",
        name: "Couples massage, 90 min",
        seller: "No seller chosen",
        sellerDetail: "No contract",
        sellerKind: "none",
        tax: "Unknown until a seller is set",
        taxNeedsVerification: true,
        availability: "Unknown · no operator",
        availabilityTone: "danger",
        alone: 200000,
        share: 200000,
        refunds: null,
        refundRule: "No refund terms yet",
      },
      {
        id: "hbl-flowers",
        name: "Flowers and sparkling wine",
        seller: packagesHotel,
        sellerDetail: "Lake Bar",
        sellerKind: "outlet",
        tax: "TX-FB-02 Beverage",
        taxNeedsVerification: false,
        availability: "Lake Bar stock",
        availabilityTone: "success",
        alone: 45000,
        share: 40000,
        refunds: { "over-7-days": 40000, "2-7-days": 40000, "under-48-h": 0 },
        refundRule: "Free until 48 h before",
      },
    ],
  },
];

const packagesWeekends: PackagesWeekend[] = [
  {
    id: "lkw-17-oct",
    packageId: "lkw",
    dates: "17–19 Oct",
    reason: "Deluxe Lake View: 1 left on Saturday",
    availability: "1 left",
    tone: "warning",
  },
  {
    id: "lkw-24-oct",
    packageId: "lkw",
    dates: "24–26 Oct",
    reason: "Rooms held by EAC Health Forum",
    availability: "Sold out",
    tone: "default",
  },
  {
    id: "lkw-31-oct",
    packageId: "lkw",
    dates: "31 Oct – 2 Nov",
    reason: "Boat slots not yet confirmed by operator",
    availability: "On request",
    tone: "warning",
  },
  {
    id: "lkw-7-nov",
    packageId: "lkw",
    dates: "7–9 Nov",
    reason: "Limited by boat trip, 4 a day",
    availability: "4 left",
    tone: "success",
  },
  {
    id: "lkw-14-nov",
    packageId: "lkw",
    dates: "14–16 Nov",
    reason: "Limited by boat trip, 4 a day",
    availability: "4 left",
    tone: "success",
  },
];

const packagesFixtures = {
  "commercial.packagesItems": packagesItems,
  "commercial.packagesWeekends": packagesWeekends,
  "commercial.packagesNoticeTiers": packagesNoticeTiers,
} satisfies FixtureSet;
// #endregion Packages

// #region Groups
/** Alert shown for a group block: status tone, Gravity icon and copy. */
export interface GroupsBanner {
  tone: Tone;
  icon: IconName;
  title: string;
  desc: string;
}

/** A room type in a block contract: contracted nightly rate (RWF), rooms held and rooms picked up. */
export interface GroupsRoomType {
  id: string;
  name: string;
  rate: number;
  held: number;
  picked: number;
}

/** Rooms held and picked up on one night of a block. */
export interface GroupsNight {
  id: string;
  date: string;
  held: number;
  picked: number;
}

/** A rooming-list file received from the organiser or the agent. */
export interface GroupsRoomingFile {
  name: string;
  meta: string;
}

/** Rooming list of a block: due date, matching status, current file and rows that need fixing. */
export interface GroupsRooming {
  due: string;
  status: string;
  tone: Tone;
  file: GroupsRoomingFile | null;
  issues: { id: string; text: string }[];
  /** Next version, shown after "Upload new version" while its names are matched to bookings. */
  upload: (GroupsRoomingFile & { status: string; tone: Tone }) | null;
}

/** Cutoff workflow of a block still holding unsold rooms: extend the cutoff, or release unsold rooms once. */
export interface GroupsCutoffRelease {
  /** New cutoff offered by "Extend to …". */
  extendTo: string;
  extendedCutoff: string;
  extended: GroupsBanner;
  /** Banner after the release; its title counts the unsold rooms released each night. */
  released: Omit<GroupsBanner, "title"> & { nights: string; at: string };
}

/** Overbooking caused by unsold rooms held in the block, cleared by releasing one of them. */
export interface GroupsConflict {
  roomType: string;
  night: string;
  fixLabel: string;
  open: GroupsBanner;
  fixed: GroupsBanner;
}

/** A group block: rooms held for a group at a contracted rate (commercial.groupsBlocks). */
export interface GroupsBlock {
  id: string;
  name: string;
  dates: string;
  datesLong: string;
  rooms: number;
  status: string;
  tone: Tone;
  organiser: string;
  contact: string;
  phone: string;
  agent: string;
  payer: string;
  bill: { title: string; desc: string };
  deposit: string;
  depositStatus: string;
  depositTone: Tone;
  plan: string;
  cutoff: string;
  release: string;
  attrition: string;
  roomTypes: GroupsRoomType[];
  nights: GroupsNight[];
  pickupAsOf: string;
  banner: GroupsBanner;
  cutoffRelease: GroupsCutoffRelease | null;
  conflict: GroupsConflict | null;
  rooming: GroupsRooming;
}

const groupsBlocks: GroupsBlock[] = [
  {
    id: "GB-0412",
    name: "EAC Health Forum",
    dates: "23–26 Oct",
    datesLong: "23–26 Oct 2026 · 3 nights · 25 rooms a night",
    rooms: 25,
    status: "Definite",
    tone: "success",
    organiser: "EAC Health Forum Secretariat",
    contact: "Grace Achieng, event coordinator",
    phone: "+250 788 410 225",
    agent: "Akagera Horizon Travel · 10% commission on rooms",
    payer: "Rooms and breakfast to master bill · incidentals to guests",
    bill: { title: "Master bill F-5520", desc: "EAC Health Forum Secretariat · 17 linked stays · nothing posted yet" },
    deposit: "RWF 1,960,000 by bank transfer",
    depositStatus: "Pending · not yet verified by GT Bank",
    depositTone: "warning",
    plan: "Rate plan GRP-EHF · contracted, bed and breakfast",
    cutoff: "Fri 16 Oct 2026, 18:00",
    release: "Unsold rooms return at cutoff, once per night",
    attrition: "Up to 20% unsold without penalty",
    roomTypes: [
      { id: "standard-queen", name: "Standard Queen", rate: 78000, held: 8, picked: 6 },
      { id: "twin", name: "Twin", rate: 84000, held: 6, picked: 4 },
      { id: "deluxe-lake-view", name: "Deluxe Lake View", rate: 125000, held: 8, picked: 6 },
      { id: "family-suite", name: "Family Suite", rate: 195000, held: 3, picked: 1 },
    ],
    nights: [
      { id: "2026-10-23", date: "Fri 23 Oct", held: 25, picked: 17 },
      { id: "2026-10-24", date: "Sat 24 Oct", held: 25, picked: 19 },
      { id: "2026-10-25", date: "Sun 25 Oct", held: 25, picked: 16 },
    ],
    pickupAsOf: "12 Oct, 11:00",
    banner: {
      tone: "warning",
      icon: "Clock",
      title: "Up to 9 unsold rooms a night return to general inventory at cutoff: Fri 16 Oct, 18:00 (in 4 days)",
      desc: "The release runs once. If it fails it retries without releasing twice, and picked-up reservations are never cancelled.",
    },
    cutoffRelease: {
      extendTo: "Mon 19 Oct",
      extendedCutoff: "Mon 19 Oct 2026, 18:00 (extended)",
      extended: {
        tone: "warning",
        icon: "Clock",
        title: "Cutoff moved to Mon 19 Oct, 18:00 (in 7 days)",
        desc: "Extended by Aline Uwase at 11:03 at the organiser’s request. The release runs once at the new time.",
      },
      released: {
        tone: "success",
        icon: "CircleCheck",
        nights: "23, 24, 25 Oct",
        at: "11:04",
        desc: "Released once by Aline Uwase. The 16–19 picked-up bookings each night are untouched. Availability is updated; channel updates are queued.",
      },
    },
    conflict: {
      roomType: "Family Suite",
      night: "Sat 24 Oct",
      fixLabel: "Release 1 Family Suite for 24 Oct",
      open: {
        tone: "danger",
        icon: "TriangleExclamation",
        title: "Family Suite is overbooked by 1 on Sat 24 Oct",
        desc: "This block holds 3 suites but only 1 is picked up, while 4 other guests booked suites that night. Releasing one unsold suite clears it without moving anyone.",
      },
      fixed: {
        tone: "default",
        icon: "CircleCheck",
        title: "Family Suite on 24 Oct is no longer overbooked",
        desc: "One unsold suite left this block at 11:02 and BK-20466 keeps its room. Booking.com will receive the corrected availability.",
      },
    },
    rooming: {
      due: "Due at cutoff · via Akagera Horizon Travel",
      status: "2 rows need fixing",
      tone: "warning",
      file: {
        name: "EHF_rooming_list_v2.xlsx",
        meta: "v2 · imported 10 Oct, 16:20 · 19 names, 17 matched to bookings",
      },
      issues: [
        { id: "row-14", text: "Row 14: “Dr. J. Mwangi” has no nights; the agent was asked on 11 Oct" },
        { id: "row-19", text: "Row 19: Fatuma Hassan appears twice, on 23 Oct and 24 Oct arrivals" },
      ],
      upload: {
        name: "EHF_rooming_list_v3.xlsx",
        meta: "v3 · received 11:05 · 21 rows",
        status: "Checking v3",
        tone: "info",
      },
    },
  },
  {
    id: "BK-20418",
    name: "Volcano view group",
    dates: "14–16 Oct",
    datesLong: "14–16 Oct 2026 · 2 nights · 4 rooms after cancellation",
    rooms: 4,
    status: "Part cancelled",
    tone: "warning",
    organiser: "Volcano View Tours",
    contact: "Yuki Tanaka, tour leader",
    phone: "+250 783 220 914",
    agent: "Organiser directly",
    payer: "Whole stay to master bill",
    bill: { title: "Master bill F-5491", desc: "Volcano View Tours · refund of RWF 480,000 waits for Didier Mugenzi" },
    deposit: "RWF 960,000 by MTN MoMo · ref MP260921.0915.A11842",
    depositStatus: "Verified",
    depositTone: "success",
    plan: "Rate plan GRP-VVG · contracted, half board",
    cutoff: "Passed · 30 Sep 2026",
    release: "Released 0 rooms; all were picked up",
    attrition: "2 rooms cancelled on 10 Oct under tier 2",
    roomTypes: [{ id: "deluxe-lake-view", name: "Deluxe Lake View", rate: 120000, held: 4, picked: 4 }],
    nights: [
      { id: "2026-10-14", date: "Wed 14 Oct", held: 4, picked: 4 },
      { id: "2026-10-15", date: "Thu 15 Oct", held: 4, picked: 4 },
    ],
    pickupAsOf: "12 Oct, 11:00",
    banner: {
      tone: "warning",
      icon: "ArrowUturnCcwLeft",
      title: "Refund of RWF 480,000 is waiting for the owner",
      desc: "Two rooms were cancelled on 10 Oct under tier 2. The amount is above your RWF 300,000 limit, so Didier Mugenzi approves it.",
    },
    cutoffRelease: null,
    conflict: null,
    rooming: {
      due: "Complete",
      status: "Complete",
      tone: "success",
      file: { name: "VVG_rooming_final.xlsx", meta: "v3 · 8 names, all matched" },
      issues: [],
      upload: null,
    },
  },
  {
    id: "GB-0415",
    name: "Umurage Consulting retreat",
    dates: "6–8 Nov",
    datesLong: "6–8 Nov 2026 · 2 nights · 8 rooms a night",
    rooms: 8,
    status: "Tentative",
    tone: "default",
    organiser: "Umurage Consulting Ltd",
    contact: "Jean Bosco Nkurunziza",
    phone: "+250 788 302 118",
    agent: "Organiser directly",
    payer: "Company account, invoiced on the city ledger",
    bill: { title: "No master bill yet", desc: "Opens when the contract is signed" },
    deposit: "Not requested",
    depositStatus: "None",
    depositTone: "default",
    plan: "Rate plan CORP-UMU · corporate, bed and breakfast",
    cutoff: "Option expires Tue 20 Oct, 12:00",
    release: "Whole hold released if the option expires",
    attrition: "Not agreed",
    roomTypes: [
      { id: "standard-queen", name: "Standard Queen", rate: 76000, held: 4, picked: 0 },
      { id: "deluxe-lake-view", name: "Deluxe Lake View", rate: 118000, held: 4, picked: 0 },
    ],
    nights: [
      { id: "2026-11-06", date: "Fri 6 Nov", held: 8, picked: 0 },
      { id: "2026-11-07", date: "Sat 7 Nov", held: 8, picked: 0 },
    ],
    pickupAsOf: "12 Oct, 11:00",
    banner: {
      tone: "default",
      icon: "Hourglass",
      title: "Tentative hold until Tue 20 Oct, 12:00",
      desc: "If the contract is not signed by then, all 8 rooms a night are released automatically.",
    },
    cutoffRelease: null,
    conflict: null,
    rooming: { due: "Not started", status: "Not started", tone: "default", file: null, issues: [], upload: null },
  },
  {
    id: "GB-0398",
    name: "Kivu Fintech Summit",
    dates: "18–20 Sep",
    datesLong: "18–20 Sep 2026 · 2 nights · closed",
    rooms: 20,
    status: "Closed",
    tone: "default",
    organiser: "Kivu Fintech Summit organisers",
    contact: "Daniel Okafor",
    phone: "+250 785 661 007",
    agent: "Organiser directly",
    payer: "Rooms to master bill · incidentals to guests",
    bill: { title: "Master bill F-5402", desc: "Settled · balance RWF 0" },
    deposit: "RWF 1,200,000 by bank transfer",
    depositStatus: "Verified",
    depositTone: "success",
    plan: "Rate plan GRP-KFS · contracted, room only",
    cutoff: "Passed · 11 Sep 2026, 18:00",
    release: "Released 4 rooms a night at cutoff",
    attrition: "20% allowed · 20% unsold",
    roomTypes: [
      { id: "standard-queen", name: "Standard Queen", rate: 75000, held: 10, picked: 8 },
      { id: "deluxe-lake-view", name: "Deluxe Lake View", rate: 118000, held: 10, picked: 8 },
    ],
    nights: [
      { id: "2026-09-18", date: "Fri 18 Sep", held: 20, picked: 16 },
      { id: "2026-09-19", date: "Sat 19 Sep", held: 20, picked: 16 },
    ],
    pickupAsOf: "12 Oct, 11:00",
    banner: {
      tone: "default",
      icon: "CircleCheck",
      title: "Closed · 4 unsold rooms a night were released at cutoff",
      desc: "Released once on 11 Sep at 18:00. Master bill F-5402 is settled.",
    },
    cutoffRelease: null,
    conflict: null,
    rooming: {
      due: "Complete",
      status: "Complete",
      tone: "success",
      file: { name: "KFS_rooming.csv", meta: "v1 · 16 names, all matched" },
      issues: [],
      upload: null,
    },
  },
];

const groupsFixtures = { "commercial.groupsBlocks": groupsBlocks } satisfies FixtureSet;
// #endregion Groups

// #region SalesEvents
/** Pipeline stage of a sales and events lead (artifact: one kanban column). */
export type SalesEventsStageId = "new" | "qualified" | "proposal" | "contract" | "closed";

/**
 * Which state of the event plan a record belongs to: shown in both, only while the Kivu Hall
 * collision is open, or only once the set-up has been moved to 17:30.
 */
export type SalesEventsScenario = "always" | "collision" | "resolved";

export interface SalesEventsStage {
  id: SalesEventsStageId;
  /** Column title on the pipeline. */
  title: string;
  /** Column indicator colour. */
  tone: Tone;
  /** Stage chip on the lead detail. */
  label: string;
  labelTone: Tone;
  /** Stage chip for a lost lead (closed column only). */
  lostLabel?: string;
  lostTone?: Tone;
}

export interface SalesEventsLead {
  id: string;
  stage: SalesEventsStageId;
  name: string;
  org: string;
  type: string;
  date: string;
  pax: number;
  /** Quote or estimated value in RWF. */
  value: number;
  /** Win probability in percent. */
  prob: number;
  space: string;
  /** First name of the sales owner. */
  owner: string;
  source: string;
  next: string;
  chip?: string;
  tone?: Tone;
  lost?: boolean;
  /** Empty-state title and note when the lead has no live event plan. */
  planTitle?: string;
  planNote?: string;
  /** The lead has a live event plan (space holds, BEO, quote, deposits and handoff). */
  hasEventPlan?: boolean;
  /** Lead card overrides once the space collision is resolved. */
  whenResolved?: { chip: string; tone: Tone; next: string };
  /** Lead overrides once the contract is sent. */
  whenSent?: { stage: SalesEventsStageId; chip: string; tone: Tone; stageLabel: string };
}

export interface SalesEventsSpace {
  id: string;
  lead: string;
  name: string;
  cap: string;
  /** Key of the stock photo in @injishi/data/media. */
  photo: string;
  /** Hours (24h, decimals for half hours) of the double booking while the collision is open. */
  clash?: { start: number; end: number };
}

export interface SalesEventsSpaceBooking {
  id: string;
  space: string;
  kind: "contracted" | "tentative" | "turnaround";
  label: string;
  /** Start and end hour on the 08:00–24:00 day. */
  start: number;
  end: number;
  scenario: SalesEventsScenario;
  /** Lead that holds the space under contract (another event). */
  holder?: string;
}

export interface SalesEventsTiming {
  id: string;
  lead: string;
  time: string;
  what: string;
  where: string;
  scenario: SalesEventsScenario;
  /** The timing collides with another booking (shown in the danger colour). */
  collides?: boolean;
}

export interface SalesEventsBeoFigure {
  id: string;
  lead: string;
  label: string;
  value: string;
  resolvedValue?: string;
}

export interface SalesEventsBeoNote {
  id: string;
  lead: string;
  label: string;
  value: string;
}

export interface SalesEventsQuoteLine {
  id: string;
  lead: string;
  item: string;
  note: string;
  /** Id of the legal seller (commercial.salesEventsSellers). */
  seller: string;
  qty: number;
  /** Unit price in RWF. */
  price: number;
  scenario: SalesEventsScenario;
}

export interface SalesEventsSeller {
  id: string;
  /** Short seller name in the quote table. */
  short: string;
  tone: Tone;
  icon: IconName;
  name: string;
  tin: string;
  what: string;
  whatResolved?: string;
  how: string;
}

export interface SalesEventsDeposit {
  id: string;
  lead: string;
  label: string;
  /** Share of the hotel portion; omitted for the balance (the remainder). */
  share?: number;
  due: string;
  status: string;
  tone: Tone;
  /** Overrides once the contract and deposit request are sent. */
  whenSent?: { due: string; status: string; tone: Tone };
}

export interface SalesEventsHandoffStep {
  id: string;
  lead: string;
  label: string;
  sentLabel?: string;
  status: "complete" | "active" | "inactive";
}

const salesEventsStages: SalesEventsStage[] = [
  { id: "new", title: "New", tone: "default", label: "New lead", labelTone: "default" },
  { id: "qualified", title: "Qualified", tone: "info", label: "Qualified", labelTone: "default" },
  { id: "proposal", title: "Proposal sent", tone: "warning", label: "Proposal sent", labelTone: "warning" },
  { id: "contract", title: "Contract", tone: "accent", label: "Contract", labelTone: "accent" },
  {
    id: "closed",
    title: "Won / Lost",
    tone: "success",
    label: "Won",
    labelTone: "success",
    lostLabel: "Lost",
    lostTone: "default",
  },
];

const salesEventsLeads: SalesEventsLead[] = [
  {
    id: "L-0291",
    stage: "new",
    name: "Rubavu Coffee Growers AGM",
    org: "Rubavu Coffee Growers Cooperative",
    type: "Conference",
    date: "Fri 6 Nov",
    pax: 90,
    value: 4200000,
    prob: 10,
    space: "Kivu Hall",
    owner: "Aline",
    source: "Website enquiry · 11 Oct",
    next: "Call the cooperative to confirm budget and date",
    planTitle: "No quote yet",
    planNote: "Space and catering are planned once the lead is qualified. Kivu Hall is free on 6 Nov.",
  },
  {
    id: "L-0293",
    stage: "new",
    name: "Okafor family lunch",
    org: "Daniel Okafor, returning guest",
    type: "Private dining",
    date: "Sun 22 Nov",
    pax: 35,
    value: 1100000,
    prob: 10,
    space: "Garden Terrace",
    owner: "Joseph",
    source: "Phone · 12 Oct",
    next: "Send two set-menu options",
    planTitle: "No quote yet",
    planNote: "Joseph Habimana is preparing menu options from Isangano Terrace.",
  },
  {
    id: "L-0284",
    stage: "qualified",
    name: "Umurage strategy offsite",
    org: "Umurage Consulting Ltd",
    type: "Meeting + 18 rooms",
    date: "4–5 Nov",
    pax: 40,
    value: 6800000,
    prob: 40,
    space: "Kivu Hall",
    owner: "Aline",
    source: "Corporate account",
    next: "Quote due Wed 14 Oct",
    chip: "Account 62 days overdue",
    tone: "warning",
    planTitle: "Quote in preparation",
    planNote: "Umurage Consulting has RWF 2.1M overdue on the city ledger. Ask Finance before offering credit terms.",
  },
  {
    id: "L-0287",
    stage: "qualified",
    name: "Kivu Lakeside Run awards",
    org: "Lake Kivu Runners Club",
    type: "Gala dinner",
    date: "Sun 15 Nov",
    pax: 110,
    value: 5500000,
    prob: 30,
    space: "Kivu Hall",
    owner: "Aline",
    source: "Referral",
    next: "Site visit Thu 15 Oct, 10:00",
    planTitle: "Quote in preparation",
    planNote: "A tentative hold is placed on Kivu Hall when the proposal is sent.",
  },
  {
    id: "L-0276",
    stage: "proposal",
    name: "Uwimana–Nkurunziza wedding",
    org: "Marie Claire Uwimana",
    type: "Wedding",
    date: "Sun 25 Oct",
    pax: 110,
    value: 8845000,
    prob: 60,
    space: "Kivu Hall + Garden Terrace",
    owner: "Aline",
    source: "Injishi marketplace enquiry",
    next: "Resolve the Kivu Hall collision, then send the contract",
    chip: "Space collision",
    tone: "danger",
    hasEventPlan: true,
    whenResolved: { chip: "Hold to 14 Oct", tone: "warning", next: "Send the contract and deposit request" },
    whenSent: {
      stage: "contract",
      chip: "Awaiting signature",
      tone: "warning",
      stageLabel: "Contract sent · awaiting signature",
    },
  },
  {
    id: "L-0279",
    stage: "proposal",
    name: "Akagera Horizon incentive dinner",
    org: "Akagera Horizon Travel",
    type: "Dinner",
    date: "Tue 3 Nov",
    pax: 60,
    value: 2900000,
    prob: 50,
    space: "Garden Terrace",
    owner: "Aline",
    source: "Travel agent · 10% commission",
    next: "Proposal expires Fri 16 Oct",
    chip: "Hold to 16 Oct",
    tone: "warning",
    planTitle: "Proposal sent 9 Oct",
    planNote: "Garden Terrace is on a tentative hold until 16 Oct, 18:00. It releases automatically if not accepted.",
  },
  {
    id: "L-0262",
    stage: "contract",
    name: "EAC Health Forum",
    org: "EAC Health Forum secretariat",
    type: "Conference, 3 days",
    date: "23–25 Oct",
    pax: 120,
    value: 14600000,
    prob: 90,
    space: "Kivu Hall + Garden Terrace",
    owner: "Aline",
    source: "Group block · 25 rooms",
    next: "Final headcount due Fri 16 Oct",
    chip: "Deposit 1 verified",
    tone: "success",
    planTitle: "Contract signed 2 Oct · BEO-0405 v3",
    planNote:
      "Deposit 1 RWF 4,380,000 verified · MTN MoMo · ref MP261002.0915.C11873 · 2 Oct 09:15. Kivu Hall and Garden Terrace are reserved 23–25 Oct.",
  },
  {
    id: "L-0268",
    stage: "closed",
    name: "Tanaka Tours welcome dinner",
    org: "Yuki Tanaka",
    type: "Dinner",
    date: "Sun 18 Oct",
    pax: 28,
    value: 1300000,
    prob: 100,
    space: "Isangano Terrace",
    owner: "Joseph",
    source: "Email",
    next: "Event order confirmed",
    chip: "Won",
    tone: "success",
    planTitle: "Won · BEO-0409 confirmed",
    planNote:
      "Private section of Isangano Terrace reserved. Deposit verified · Airtel Money · ref AM261008.1422.88310.",
  },
  {
    id: "L-0255",
    stage: "closed",
    name: "Gisenyi bankers gala",
    org: "Lake Kivu Bankers Association",
    type: "Gala dinner",
    date: "Sat 31 Oct",
    pax: 140,
    value: 6000000,
    prob: 0,
    space: "Kivu Hall",
    owner: "Aline",
    source: "Email",
    next: "Closed",
    chip: "Lost · chose a Kigali venue",
    tone: "default",
    lost: true,
    planTitle: "Lost on 8 Oct",
    planNote:
      "Reason recorded by Aline Uwase: budget, chose a venue in Kigali. The tentative hold on Kivu Hall was released on 8 Oct.",
  },
];

const salesEventsSpaces: SalesEventsSpace[] = [
  {
    id: "kivu-hall",
    lead: "L-0276",
    name: "Kivu Hall",
    cap: "120 seated · 180 standing",
    photo: "kivuHallBanquet",
    clash: { start: 14, end: 17 },
  },
  {
    id: "garden-terrace",
    lead: "L-0276",
    name: "Garden Terrace",
    cap: "150 standing · outdoor",
    photo: "gardenTerraceEventLawn",
  },
];

const salesEventsSpaceBookings: SalesEventsSpaceBooking[] = [
  {
    id: "kivu-eac-plenary",
    space: "kivu-hall",
    kind: "contracted",
    label: "EAC Health Forum plenary · contracted",
    start: 8,
    end: 17,
    scenario: "always",
    holder: "L-0262",
  },
  {
    id: "kivu-wedding-setup-early",
    space: "kivu-hall",
    kind: "tentative",
    label: "Wedding set-up",
    start: 14,
    end: 18,
    scenario: "collision",
  },
  {
    id: "kivu-wedding-dinner-early",
    space: "kivu-hall",
    kind: "tentative",
    label: "Wedding dinner · hold",
    start: 18,
    end: 23.5,
    scenario: "collision",
  },
  {
    id: "kivu-turnaround",
    space: "kivu-hall",
    kind: "turnaround",
    label: "Turnaround",
    start: 17,
    end: 17.5,
    scenario: "resolved",
  },
  {
    id: "kivu-setup",
    space: "kivu-hall",
    kind: "tentative",
    label: "Set-up",
    start: 17.5,
    end: 19,
    scenario: "resolved",
  },
  {
    id: "kivu-wedding-dinner",
    space: "kivu-hall",
    kind: "tentative",
    label: "Wedding dinner · hold",
    start: 19,
    end: 23.5,
    scenario: "resolved",
  },
  {
    id: "garden-eac-lunch",
    space: "garden-terrace",
    kind: "contracted",
    label: "EAC lunch",
    start: 12.5,
    end: 14,
    scenario: "always",
    holder: "L-0262",
  },
  {
    id: "garden-cocktails",
    space: "garden-terrace",
    kind: "tentative",
    label: "Cocktails · hold",
    start: 17.5,
    end: 19.5,
    scenario: "always",
  },
];

const salesEventsTimings: SalesEventsTiming[] = [
  {
    id: "c-setup",
    lead: "L-0276",
    time: "14:00",
    what: "Set-up starts",
    where: "Kivu Hall · collides with EAC Health Forum",
    scenario: "collision",
    collides: true,
  },
  {
    id: "c-cocktails",
    lead: "L-0276",
    time: "17:30",
    what: "Cocktails and canapés",
    where: "Garden Terrace",
    scenario: "collision",
  },
  { id: "c-seated", lead: "L-0276", time: "18:30", what: "Guests seated", where: "Kivu Hall", scenario: "collision" },
  {
    id: "c-dinner",
    lead: "L-0276",
    time: "19:00",
    what: "Dinner service, three courses",
    where: "Isangano Terrace kitchen",
    scenario: "collision",
  },
  {
    id: "c-speeches",
    lead: "L-0276",
    time: "21:00",
    what: "Speeches and cake",
    where: "Kivu Hall",
    scenario: "collision",
  },
  {
    id: "c-close",
    lead: "L-0276",
    time: "23:30",
    what: "Music stops, venue closes",
    where: "Kivu Hall",
    scenario: "collision",
  },
  {
    id: "r-turnaround",
    lead: "L-0276",
    time: "17:00",
    what: "EAC Health Forum ends, 30-minute turnaround",
    where: "Kivu Hall · housekeeping and banquet crew",
    scenario: "resolved",
  },
  {
    id: "r-setup",
    lead: "L-0276",
    time: "17:30",
    what: "Set-up with an extra crew of 6",
    where: "Kivu Hall",
    scenario: "resolved",
  },
  {
    id: "r-cocktails",
    lead: "L-0276",
    time: "17:30",
    what: "Cocktails and canapés",
    where: "Garden Terrace",
    scenario: "resolved",
  },
  { id: "r-seated", lead: "L-0276", time: "19:00", what: "Guests seated", where: "Kivu Hall", scenario: "resolved" },
  {
    id: "r-dinner",
    lead: "L-0276",
    time: "19:30",
    what: "Dinner service, three courses",
    where: "Isangano Terrace kitchen",
    scenario: "resolved",
  },
  {
    id: "r-close",
    lead: "L-0276",
    time: "23:30",
    what: "Music stops, venue closes",
    where: "Kivu Hall",
    scenario: "resolved",
  },
];

const salesEventsBeoFigures: SalesEventsBeoFigure[] = [
  { id: "expected", lead: "L-0276", label: "Expected", value: "110" },
  { id: "guaranteed", lead: "L-0276", label: "Guaranteed", value: "Due 17 Oct" },
  { id: "seated", lead: "L-0276", label: "Seated", value: "118" },
  { id: "staff", lead: "L-0276", label: "Staff", value: "16", resolvedValue: "22" },
];

const salesEventsBeoNotes: SalesEventsBeoNote[] = [
  {
    id: "kivu-setup",
    lead: "L-0276",
    label: "Kivu Hall set-up",
    value: "11 banquet rounds of 10, head table for 8, 6 × 6 m dance floor, stage for a 4-piece band",
  },
  {
    id: "garden-setup",
    lead: "L-0276",
    label: "Garden Terrace",
    value: "12 high tables for cocktails, canapés passed by 4 waiters",
  },
  { id: "dietary", lead: "L-0276", label: "Dietary", value: "8 vegetarian · 4 halal · 6 children’s plates" },
];

const salesEventsQuoteLines: SalesEventsQuoteLine[] = [
  {
    id: "kivu-hall-hire",
    lead: "L-0276",
    item: "Kivu Hall hire, evening",
    note: "Includes tables, linen and standard lighting",
    seller: "hotel",
    qty: 1,
    price: 1200000,
    scenario: "always",
  },
  {
    id: "garden-terrace-hire",
    lead: "L-0276",
    item: "Garden Terrace cocktail hire",
    note: "17:30 to 19:30",
    seller: "hotel",
    qty: 1,
    price: 450000,
    scenario: "always",
  },
  {
    id: "dinner-menu-b",
    lead: "L-0276",
    item: "Dinner, Menu B (Isangano Terrace)",
    note: "Isangano Terrace kitchen · tilapia or beef fillet",
    seller: "hotel",
    qty: 110,
    price: 38000,
    scenario: "always",
  },
  {
    id: "open-bar",
    lead: "L-0276",
    item: "Open bar, 4 hours (Lake Bar)",
    note: "Lake Bar · soft drinks, beer, house wine",
    seller: "hotel",
    qty: 110,
    price: 15000,
    scenario: "always",
  },
  {
    id: "decor-stage-pa",
    lead: "L-0276",
    item: "Décor, stage and PA",
    note: "Band stage 4 × 3 m, 2 microphones",
    seller: "hotel",
    qty: 1,
    price: 650000,
    scenario: "always",
  },
  {
    id: "extra-crew",
    lead: "L-0276",
    item: "Extra set-up crew",
    note: "Late set-up after EAC turnaround",
    seller: "hotel",
    qty: 6,
    price: 20000,
    scenario: "resolved",
  },
  {
    id: "coffee-dessert",
    lead: "L-0276",
    item: "Coffee and dessert station",
    note: "Ikawa Corner · separate merchant",
    seller: "ikawa",
    qty: 110,
    price: 6500,
    scenario: "always",
  },
];

const salesEventsSellers: SalesEventsSeller[] = [
  {
    id: "hotel",
    short: "Hotel",
    tone: "default",
    icon: "FolderHouse",
    name: "Amahoro Hospitality Ltd",
    tin: "TIN 102 345 678",
    what: "Venue hire, dinner (Isangano Terrace), open bar (Lake Bar), décor",
    whatResolved: "Venue hire, dinner (Isangano Terrace), open bar (Lake Bar), décor, extra crew",
    how: "Event master bill on contract · fiscal receipts from the hotel’s VSDC at settlement",
  },
  {
    id: "ikawa",
    short: "Ikawa Corner",
    tone: "info",
    icon: "Mug",
    name: "Ikawa Corner Ltd",
    tin: "TIN 108 221 457",
    what: "Coffee and dessert station",
    how: "Separate merchant: Ikawa Corner invoices, takes payment and fiscalises its own sale. Not added to the hotel bill.",
  },
];

const salesEventsDeposits: SalesEventsDeposit[] = [
  {
    id: "deposit-1",
    lead: "L-0276",
    label: "Deposit 1 · 30% on contract",
    share: 0.3,
    due: "Requested together with the contract",
    status: "Not requested",
    tone: "default",
    whenSent: { due: "MTN MoMo request sent to Marie Claire Uwimana at 12:41", status: "Pending", tone: "warning" },
  },
  {
    id: "deposit-2",
    lead: "L-0276",
    label: "Deposit 2 · 50% with guaranteed headcount",
    share: 0.5,
    due: "Due Sat 17 Oct",
    status: "Scheduled",
    tone: "default",
  },
  {
    id: "balance",
    lead: "L-0276",
    label: "Balance · 20%",
    due: "Billed on the event master bill after 25 Oct",
    status: "After event",
    tone: "default",
  },
];

const salesEventsHandoffSteps: SalesEventsHandoffStep[] = [
  { id: "quote", lead: "L-0276", label: "Quote", status: "complete" },
  { id: "contract", lead: "L-0276", label: "Contract", sentLabel: "Signature", status: "active" },
  { id: "deposit-1", lead: "L-0276", label: "Deposit 1", status: "inactive" },
  { id: "event", lead: "L-0276", label: "Event", status: "inactive" },
  { id: "finance", lead: "L-0276", label: "To Finance", status: "inactive" },
];

const salesEventsFixtures = {
  "commercial.salesEventsStages": salesEventsStages,
  "commercial.salesEventsLeads": salesEventsLeads,
  "commercial.salesEventsSpaces": salesEventsSpaces,
  "commercial.salesEventsSpaceBookings": salesEventsSpaceBookings,
  "commercial.salesEventsTimings": salesEventsTimings,
  "commercial.salesEventsBeoFigures": salesEventsBeoFigures,
  "commercial.salesEventsBeoNotes": salesEventsBeoNotes,
  "commercial.salesEventsQuoteLines": salesEventsQuoteLines,
  "commercial.salesEventsSellers": salesEventsSellers,
  "commercial.salesEventsDeposits": salesEventsDeposits,
  "commercial.salesEventsHandoffSteps": salesEventsHandoffSteps,
} satisfies FixtureSet;
// #endregion SalesEvents

// #region Revenue
/** Forecast scenario of the 30-night revenue plan. */
export type RevenueScenarioId = "base" | "conference";

/** A planning scenario (header segment, scenario comparison). */
export interface RevenueScenario {
  id: RevenueScenarioId;
  label: string;
  /** Lower-case name used in captions ("scenario: base"). */
  name: string;
  /** Average daily rate the scenario assumes, RWF. */
  adr: number;
}

/** One of the next 30 nights, with what is recorded for it (forecast chart, night detail). */
export interface RevenueNight {
  id: string;
  weekday: string;
  day: number;
  month: string;
  /** Rooms available that night. */
  rooms: number;
  /** Occupancy on the books today, percent (recorded). */
  onTheBooks: number;
  /** Last year actual occupancy on the same weekday, percent. */
  lastYear: number;
}

/** Model DF-2.3 forecast occupancy for one night in one scenario, percent, with its 80% range. */
export interface RevenueForecast {
  id: string;
  night: string;
  scenario: RevenueScenarioId;
  value: number;
  low: number;
  high: number;
}

/** A group block, enquiry or event on the books for some nights. */
export interface RevenueEvent {
  id: string;
  /** Shown in the night detail. */
  label: string;
  firstNight: string;
  lastNight: string;
  /** Shading on the forecast chart (null = not shaded). */
  tone: Tone | null;
  /** Only in this scenario (null = every scenario). */
  scenario: RevenueScenarioId | null;
}

/** On the books vs the same date last year, per week (pace card). */
export interface RevenuePaceWeek {
  id: string;
  label: string;
  nights: number;
  onTheBooks: number;
  lastYear: number;
}

/** A rate recommendation with its evidence and the manager's decision. */
export interface RevenueRecommendation {
  id: string;
  dates: string;
  room: string;
  /** Current rate, RWF. */
  current: number;
  /** Recommended rate, RWF. */
  recommended: number;
  reason: string;
  confidence: string;
  confidenceTone: Tone;
  confidenceNote: string;
  /** Only shown, and never sendable, in this scenario (null = a live recommendation). */
  scenario: RevenueScenarioId | null;
  /** What the model recommends instead in the conference-week scenario. */
  conference?: { recommended: number; reason: string };
  /** "pending" = sent to the owner for approval. */
  status: "open" | "pending";
  sentNote?: string;
  override?: { rate: number; reason: string; note: string };
}

const revenueScenarios: RevenueScenario[] = [
  { id: "base", label: "Base", name: "base", adr: 118000 },
  { id: "conference", label: "Conference week", name: "conference week", adr: 123500 },
];

const revenueNights: RevenueNight[] = [
  { id: "2026-10-13", weekday: "Mon", day: 13, month: "Oct", rooms: 42, onTheBooks: 74, lastYear: 66 },
  { id: "2026-10-14", weekday: "Tue", day: 14, month: "Oct", rooms: 42, onTheBooks: 69, lastYear: 61 },
  { id: "2026-10-15", weekday: "Wed", day: 15, month: "Oct", rooms: 42, onTheBooks: 64, lastYear: 58 },
  { id: "2026-10-16", weekday: "Thu", day: 16, month: "Oct", rooms: 42, onTheBooks: 67, lastYear: 60 },
  { id: "2026-10-17", weekday: "Fri", day: 17, month: "Oct", rooms: 42, onTheBooks: 81, lastYear: 79 },
  { id: "2026-10-18", weekday: "Sat", day: 18, month: "Oct", rooms: 42, onTheBooks: 86, lastYear: 84 },
  { id: "2026-10-19", weekday: "Sun", day: 19, month: "Oct", rooms: 42, onTheBooks: 52, lastYear: 47 },
  { id: "2026-10-20", weekday: "Mon", day: 20, month: "Oct", rooms: 42, onTheBooks: 48, lastYear: 45 },
  { id: "2026-10-21", weekday: "Tue", day: 21, month: "Oct", rooms: 42, onTheBooks: 50, lastYear: 49 },
  { id: "2026-10-22", weekday: "Wed", day: 22, month: "Oct", rooms: 42, onTheBooks: 57, lastYear: 52 },
  { id: "2026-10-23", weekday: "Thu", day: 23, month: "Oct", rooms: 42, onTheBooks: 93, lastYear: 71 },
  { id: "2026-10-24", weekday: "Fri", day: 24, month: "Oct", rooms: 42, onTheBooks: 98, lastYear: 80 },
  { id: "2026-10-25", weekday: "Sat", day: 25, month: "Oct", rooms: 42, onTheBooks: 98, lastYear: 83 },
  { id: "2026-10-26", weekday: "Sun", day: 26, month: "Oct", rooms: 42, onTheBooks: 40, lastYear: 41 },
  { id: "2026-10-27", weekday: "Mon", day: 27, month: "Oct", rooms: 42, onTheBooks: 26, lastYear: 39 },
  { id: "2026-10-28", weekday: "Tue", day: 28, month: "Oct", rooms: 42, onTheBooks: 24, lastYear: 38 },
  { id: "2026-10-29", weekday: "Wed", day: 29, month: "Oct", rooms: 42, onTheBooks: 27, lastYear: 44 },
  { id: "2026-10-30", weekday: "Thu", day: 30, month: "Oct", rooms: 42, onTheBooks: 31, lastYear: 49 },
  { id: "2026-10-31", weekday: "Fri", day: 31, month: "Oct", rooms: 42, onTheBooks: 38, lastYear: 63 },
  { id: "2026-11-01", weekday: "Sat", day: 1, month: "Nov", rooms: 42, onTheBooks: 42, lastYear: 70 },
  { id: "2026-11-02", weekday: "Sun", day: 2, month: "Nov", rooms: 42, onTheBooks: 21, lastYear: 35 },
  { id: "2026-11-03", weekday: "Mon", day: 3, month: "Nov", rooms: 42, onTheBooks: 17, lastYear: 34 },
  { id: "2026-11-04", weekday: "Tue", day: 4, month: "Nov", rooms: 42, onTheBooks: 26, lastYear: 40 },
  { id: "2026-11-05", weekday: "Wed", day: 5, month: "Nov", rooms: 42, onTheBooks: 24, lastYear: 41 },
  { id: "2026-11-06", weekday: "Thu", day: 6, month: "Nov", rooms: 42, onTheBooks: 19, lastYear: 38 },
  { id: "2026-11-07", weekday: "Fri", day: 7, month: "Nov", rooms: 42, onTheBooks: 26, lastYear: 52 },
  { id: "2026-11-08", weekday: "Sat", day: 8, month: "Nov", rooms: 42, onTheBooks: 29, lastYear: 58 },
  { id: "2026-11-09", weekday: "Sun", day: 9, month: "Nov", rooms: 42, onTheBooks: 12, lastYear: 29 },
  { id: "2026-11-10", weekday: "Mon", day: 10, month: "Nov", rooms: 42, onTheBooks: 10, lastYear: 30 },
  { id: "2026-11-11", weekday: "Tue", day: 11, month: "Nov", rooms: 42, onTheBooks: 10, lastYear: 31 },
];

const revenueForecasts: RevenueForecast[] = [
  { id: "base-2026-10-13", night: "2026-10-13", scenario: "base", value: 79, low: 75, high: 83 },
  { id: "base-2026-10-14", night: "2026-10-14", scenario: "base", value: 74, low: 70, high: 78 },
  { id: "base-2026-10-15", night: "2026-10-15", scenario: "base", value: 70, low: 65, high: 75 },
  { id: "base-2026-10-16", night: "2026-10-16", scenario: "base", value: 74, low: 69, high: 79 },
  { id: "base-2026-10-17", night: "2026-10-17", scenario: "base", value: 88, low: 83, high: 93 },
  { id: "base-2026-10-18", night: "2026-10-18", scenario: "base", value: 93, low: 87, high: 99 },
  { id: "base-2026-10-19", night: "2026-10-19", scenario: "base", value: 60, low: 54, high: 66 },
  { id: "base-2026-10-20", night: "2026-10-20", scenario: "base", value: 57, low: 51, high: 63 },
  { id: "base-2026-10-21", night: "2026-10-21", scenario: "base", value: 60, low: 53, high: 67 },
  { id: "base-2026-10-22", night: "2026-10-22", scenario: "base", value: 66, low: 59, high: 73 },
  { id: "base-2026-10-23", night: "2026-10-23", scenario: "base", value: 97, low: 94, high: 100 },
  { id: "base-2026-10-24", night: "2026-10-24", scenario: "base", value: 100, low: 98, high: 100 },
  { id: "base-2026-10-25", night: "2026-10-25", scenario: "base", value: 100, low: 98, high: 100 },
  { id: "base-2026-10-26", night: "2026-10-26", scenario: "base", value: 52, low: 43, high: 61 },
  { id: "base-2026-10-27", night: "2026-10-27", scenario: "base", value: 44, low: 35, high: 53 },
  { id: "base-2026-10-28", night: "2026-10-28", scenario: "base", value: 42, low: 33, high: 51 },
  { id: "base-2026-10-29", night: "2026-10-29", scenario: "base", value: 45, low: 35, high: 55 },
  { id: "base-2026-10-30", night: "2026-10-30", scenario: "base", value: 50, low: 40, high: 60 },
  { id: "base-2026-10-31", night: "2026-10-31", scenario: "base", value: 62, low: 52, high: 72 },
  { id: "base-2026-11-01", night: "2026-11-01", scenario: "base", value: 66, low: 55, high: 77 },
  { id: "base-2026-11-02", night: "2026-11-02", scenario: "base", value: 38, low: 27, high: 49 },
  { id: "base-2026-11-03", night: "2026-11-03", scenario: "base", value: 36, low: 25, high: 47 },
  { id: "base-2026-11-04", night: "2026-11-04", scenario: "base", value: 48, low: 36, high: 60 },
  { id: "base-2026-11-05", night: "2026-11-05", scenario: "base", value: 44, low: 32, high: 56 },
  { id: "base-2026-11-06", night: "2026-11-06", scenario: "base", value: 40, low: 28, high: 52 },
  { id: "base-2026-11-07", night: "2026-11-07", scenario: "base", value: 55, low: 42, high: 68 },
  { id: "base-2026-11-08", night: "2026-11-08", scenario: "base", value: 60, low: 47, high: 73 },
  { id: "base-2026-11-09", night: "2026-11-09", scenario: "base", value: 30, low: 17, high: 43 },
  { id: "base-2026-11-10", night: "2026-11-10", scenario: "base", value: 31, low: 17, high: 45 },
  { id: "base-2026-11-11", night: "2026-11-11", scenario: "base", value: 33, low: 19, high: 47 },
  { id: "conference-2026-10-13", night: "2026-10-13", scenario: "conference", value: 79, low: 75, high: 83 },
  { id: "conference-2026-10-14", night: "2026-10-14", scenario: "conference", value: 74, low: 70, high: 78 },
  { id: "conference-2026-10-15", night: "2026-10-15", scenario: "conference", value: 70, low: 65, high: 75 },
  { id: "conference-2026-10-16", night: "2026-10-16", scenario: "conference", value: 74, low: 69, high: 79 },
  { id: "conference-2026-10-17", night: "2026-10-17", scenario: "conference", value: 88, low: 83, high: 93 },
  { id: "conference-2026-10-18", night: "2026-10-18", scenario: "conference", value: 93, low: 87, high: 99 },
  { id: "conference-2026-10-19", night: "2026-10-19", scenario: "conference", value: 60, low: 54, high: 66 },
  { id: "conference-2026-10-20", night: "2026-10-20", scenario: "conference", value: 57, low: 51, high: 63 },
  { id: "conference-2026-10-21", night: "2026-10-21", scenario: "conference", value: 60, low: 53, high: 67 },
  { id: "conference-2026-10-22", night: "2026-10-22", scenario: "conference", value: 66, low: 59, high: 73 },
  { id: "conference-2026-10-23", night: "2026-10-23", scenario: "conference", value: 97, low: 94, high: 100 },
  { id: "conference-2026-10-24", night: "2026-10-24", scenario: "conference", value: 100, low: 98, high: 100 },
  { id: "conference-2026-10-25", night: "2026-10-25", scenario: "conference", value: 100, low: 98, high: 100 },
  { id: "conference-2026-10-26", night: "2026-10-26", scenario: "conference", value: 52, low: 43, high: 61 },
  { id: "conference-2026-10-27", night: "2026-10-27", scenario: "conference", value: 54, low: 41, high: 67 },
  { id: "conference-2026-10-28", night: "2026-10-28", scenario: "conference", value: 72, low: 59, high: 85 },
  { id: "conference-2026-10-29", night: "2026-10-29", scenario: "conference", value: 78, low: 64, high: 92 },
  { id: "conference-2026-10-30", night: "2026-10-30", scenario: "conference", value: 83, low: 69, high: 97 },
  { id: "conference-2026-10-31", night: "2026-10-31", scenario: "conference", value: 82, low: 68, high: 96 },
  { id: "conference-2026-11-01", night: "2026-11-01", scenario: "conference", value: 74, low: 59, high: 89 },
  { id: "conference-2026-11-02", night: "2026-11-02", scenario: "conference", value: 38, low: 27, high: 49 },
  { id: "conference-2026-11-03", night: "2026-11-03", scenario: "conference", value: 36, low: 25, high: 47 },
  { id: "conference-2026-11-04", night: "2026-11-04", scenario: "conference", value: 48, low: 36, high: 60 },
  { id: "conference-2026-11-05", night: "2026-11-05", scenario: "conference", value: 44, low: 32, high: 56 },
  { id: "conference-2026-11-06", night: "2026-11-06", scenario: "conference", value: 40, low: 28, high: 52 },
  { id: "conference-2026-11-07", night: "2026-11-07", scenario: "conference", value: 55, low: 42, high: 68 },
  { id: "conference-2026-11-08", night: "2026-11-08", scenario: "conference", value: 60, low: 47, high: 73 },
  { id: "conference-2026-11-09", night: "2026-11-09", scenario: "conference", value: 30, low: 17, high: 43 },
  { id: "conference-2026-11-10", night: "2026-11-10", scenario: "conference", value: 31, low: 17, high: 45 },
  { id: "conference-2026-11-11", night: "2026-11-11", scenario: "conference", value: 33, low: 19, high: 47 },
];

const revenueEvents: RevenueEvent[] = [
  {
    id: "eac-health-forum",
    label: "EAC Health Forum block, 25 rooms contracted",
    firstNight: "2026-10-23",
    lastNight: "2026-10-25",
    tone: "info",
    scenario: null,
  },
  {
    id: "wedding-l0276",
    label: "wedding enquiry L-0276",
    firstNight: "2026-10-25",
    lastNight: "2026-10-25",
    tone: null,
    scenario: null,
  },
  {
    id: "lake-kivu-summit",
    label: "Scenario: Lake Kivu Business Summit",
    firstNight: "2026-10-28",
    lastNight: "2026-10-31",
    tone: "warning",
    scenario: "conference",
  },
];

const revenuePaceWeeks: RevenuePaceWeek[] = [
  { id: "w42", label: "13–19 Oct", nights: 7, onTheBooks: 70, lastYear: 61 },
  { id: "w43", label: "20–26 Oct", nights: 7, onTheBooks: 69, lastYear: 52 },
  { id: "w44", label: "27 Oct – 2 Nov", nights: 7, onTheBooks: 30, lastYear: 33 },
  { id: "w45", label: "3–9 Nov", nights: 7, onTheBooks: 22, lastYear: 24 },
  { id: "w46", label: "10–11 Nov", nights: 2, onTheBooks: 10, lastYear: 13 },
];

const revenueRecommendations: RevenueRecommendation[] = [
  {
    id: "R1",
    dates: "24–26 Oct",
    room: "Deluxe Lake View",
    current: 140000,
    recommended: 152000,
    reason:
      "Forecast 100% (range 98–100%). 11 of 12 Deluxe rooms sold; EAC Health Forum block holds 25 rooms. Last year this weekend sold out at RWF 145,000.",
    confidence: "High",
    confidenceTone: "default",
    confidenceNote: "Backtest ±3 pts",
    scenario: null,
    status: "pending",
    sentNote: "Sent 09:12 · decision by 18:00",
  },
  {
    id: "R2",
    dates: "25 Oct",
    room: "Family Suite",
    current: 220000,
    recommended: 235000,
    reason: "3 of 4 suites sold. The wedding party on L-0276 asked for 2 suites. Forecast 100%.",
    confidence: "Medium",
    confidenceTone: "default",
    confidenceNote: "Small sample: 4 suites",
    scenario: null,
    status: "open",
  },
  {
    id: "R3",
    dates: "28 Oct – 1 Nov",
    room: "Standard Queen",
    current: 85000,
    recommended: 79000,
    reason:
      "Forecast 42–66% with a wide range. Pace 3 pts behind last year for this week. Two nearby hotels list at RWF 75,000–80,000 (manual check, 11 Oct).",
    confidence: "Medium",
    confidenceTone: "default",
    confidenceNote: "Competitor data is manual",
    scenario: null,
    conference: {
      recommended: 85000,
      reason:
        "Hold the rate. If the summit is confirmed, forecast rises to 72–83% and a discount would give away revenue.",
    },
    status: "open",
  },
  {
    id: "R4",
    dates: "3–5 Nov",
    room: "Twin",
    current: 92000,
    recommended: 88000,
    reason:
      "Only 9 days of pickup for these dates. Umurage Consulting may book 18 rooms (L-0284, not contracted), which would change this.",
    confidence: "Low",
    confidenceTone: "warning",
    confidenceNote: "Limited data · review again 20 Oct",
    scenario: null,
    status: "open",
  },
  {
    id: "R5",
    dates: "28–31 Oct",
    room: "Deluxe Lake View",
    current: 140000,
    recommended: 158000,
    reason: "Scenario only: with the summit confirmed, Deluxe forecast reaches 78–83% on the busiest nights.",
    confidence: "Low",
    confidenceTone: "warning",
    confidenceNote: "Depends on an unconfirmed event",
    scenario: "conference",
    status: "open",
  },
];

const revenueFixtures = {
  "commercial.revenueScenarios": revenueScenarios,
  "commercial.revenueNights": revenueNights,
  "commercial.revenueForecasts": revenueForecasts,
  "commercial.revenueEvents": revenueEvents,
  "commercial.revenuePaceWeeks": revenuePaceWeeks,
  "commercial.revenueRecommendations": revenueRecommendations,
} satisfies FixtureSet;
// #endregion Revenue

export const fixtures = {
  ...managerTodayFixtures,
  ...ratesInventoryFixtures,
  ...availabilityCalendarFixtures,
  ...listingFixtures,
  ...packagesFixtures,
  ...groupsFixtures,
  ...salesEventsFixtures,
  ...revenueFixtures,
} satisfies FixtureSet;
