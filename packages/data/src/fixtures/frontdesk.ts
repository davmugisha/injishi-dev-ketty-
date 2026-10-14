import type { BoardId, FixtureSet, IconName } from "../types.ts";

/**
 * Embedded-database fixtures for the "frontdesk" area: Front desk · today (FrontDeskToday), Check-in,
 * Walk-in, Room rack, Reservations and the reservation record (ReservationDetail).
 * Collection names are "frontdesk.<thing>"; every document has a stable string `id`.
 * Values are lifted verbatim from the artifact boards (node tools/artifact/extract.mjs <Board>).
 * Amounts are numbers in RWF and are formatted by the views (formatRwf → "RWF 165,200").
 */

export type Tone = "accent" | "success" | "warning" | "danger" | "default" | "info";

/** Housekeeping status of a room. */
export type RoomStatus = "dirty" | "clean" | "inspected" | "occupied" | "ooo";

// ── Front desk · today ───────────────────────────────────────────────────────

export interface DeskKpi {
  id: "arrivals" | "inHouse" | "departures" | "roomsReady" | "requests";
  label: string;
  /** Headline number; "5 of 14" is value 5 with total 14. */
  value: number;
  total: number | null;
  foot: string;
  icon: IconName;
  status: "default" | "warning";
}

export interface QueueTab {
  id: "arrivals" | "inHouse" | "departures";
  label: string;
  count: number;
  /** Accessible name of the table while this tab is selected. */
  tableLabel: string;
  foot: string;
}

export interface Arrival {
  id: string;
  name: string;
  bookingId: string;
  nights: number;
  source: string;
  roomType: string;
  /** Pre-assigned room number, or null when the arrival has no room yet. */
  room: string | null;
  roomStatus: RoomStatus | null;
  /** Overrides the status label, e.g. "Dirty · 12:00". */
  roomStatusLabel: string | null;
  idStatus: "received" | "missing" | "review";
  balance: number;
  balanceNote: string;
  /** The balance note needs attention (shown as a warning chip). */
  balanceFlag: boolean;
  eta: string;
  note: string;
  /** The guest is standing at the desk now. */
  atDesk: boolean;
}

export interface InHouseStay {
  id: string;
  name: string;
  bookingId: string;
  night: number;
  of: number;
  source: string;
  room: string;
  stayId: string;
  balance: number;
  folioId: string;
  leaving: string;
  note: string;
}

export interface Departure {
  id: string;
  name: string;
  bookingId: string;
  nights: number;
  source: string;
  room: string;
  checkout: "due" | "late" | "out" | "fiscal";
  checkoutLabel: string;
  balance: number;
  balanceNote: string;
  time: string;
  note: string;
}

export interface GuestRequest {
  id: string;
  icon: IconName;
  title: string;
  meta: string;
  status: string;
  tone: Tone;
  age: string;
  board: BoardId;
  linkLabel: string;
  linkIcon: IconName;
  /** Maintenance requests are closed by the work order, not from the desk. */
  canComplete: boolean;
}

export interface ReadinessRoom {
  id: string;
  room: string;
  status: RoomStatus;
  label: string;
  guest: string;
}

export interface RoomType {
  id: "queen" | "twin" | "dlv" | "family";
  name: string;
  beds: string;
  sleeps: number;
  /** Published walk-in rate a night, excluding VAT. */
  rate: number;
  /** Rooms left on the desk's quick walk-in panel this morning. */
  left: number;
  /** Rooms free for the walk-in being quoted right now. */
  free: number;
  /** Set when the last room was sold on another channel while quoting. */
  soldNote: string | null;
}

export interface DeskRoom {
  id: string;
  room: string;
  roomType: string;
  status: RoomStatus;
  note: string;
}

// ── Check-in ─────────────────────────────────────────────────────────────────

export interface Fact {
  label: string;
  value: string;
}

export interface CheckInParty {
  id: string;
  icon: IconName;
  name: string;
  desc: string;
  role: string;
  tone: Tone;
}

export interface CheckInRoom {
  id: string;
  room: string;
  status: RoomStatus;
  note: string;
}

export interface PaymentMethod {
  id: "momo" | "card" | "cash" | "later";
  icon: IconName;
  label: string;
  note: string;
  disabled: boolean;
}

export interface MobileNetwork {
  id: "MTN" | "Airtel";
  label: string;
  /** Provider reference of this morning's request. */
  ref: string;
}

export interface CheckInDocument {
  id: string;
  icon: IconName;
  title: string;
  desc: string;
  chip: string;
  tone: Tone;
  printable: boolean;
}

export interface CheckInFile {
  id: string;
  guest: string;
  firstName: string;
  initials: string;
  roomType: string;
  dates: string;
  nights: number;
  adults: number;
  bookedBy: string;
  lockedSince: string;
  bookingStatus: string;
  facts: Fact[];
  requests: string[];
  primaryRoles: string[];
  primaryDocument: Fact[];
  occupant: {
    name: string;
    initials: string;
    documentTypes: string[];
    scannedNumber: string;
    scannedAt: string;
  };
  duplicate: {
    existingId: string;
    cards: { title: string; lines: string[]; note: string }[];
  };
  parties: CheckInParty[];
  preAssignedRoom: string;
  defaultRoom: string;
  rooms: CheckInRoom[];
  override: { reasons: string[]; approvers: string[]; note: string; sentAt: string };
  deposit: {
    amount: number;
    policy: string;
    voucher: string;
    stayTotal: number;
    phone: string;
    phoneMasked: string;
    cashReceived: number;
    till: string;
    sentAt: string;
    confirmedAt: string;
  };
  methods: PaymentMethod[];
  networks: MobileNetwork[];
  stayId: string;
  folioId: string;
  depositId: string;
  claimCode: string;
  checkedInAt: string;
  documents: CheckInDocument[];
}

// ── Walk-in ──────────────────────────────────────────────────────────────────

export interface GuestMatch {
  id: string;
  initials: string;
  name: string;
  desc: string;
  chip: string;
  tone: Tone;
  /** What happens to the booking's guest profile when this option is chosen. */
  note: string;
}

export interface WalkInQuote {
  id: string;
  status: string;
  /** Arrival date (ISO) and how the desk shows it. */
  arrivalDate: string;
  arrival: string;
  nights: number;
  adults: number;
  children: number;
  roomType: RoomType["id"];
  guestName: string;
  guestPhone: string;
  guestMatch: string;
  checkedAt: string;
  rechecksAt: string;
  /** Room type sold on another channel while quoting (shows the conflict alert). */
  conflictType: RoomType["id"] | null;
  conflictAt: string;
  policy: { id: string; name: string; note: string };
  tax: { rate: number; rule: string; levy: string };
  hold: {
    left: string;
    pct: number;
    releasesAt: string;
    extendedLeft: string;
    extendedPct: number;
    extendedAt: string;
  };
}

// ── Room rack ────────────────────────────────────────────────────────────────

export interface RackDay {
  id: string;
  /** Day of October 2026. */
  day: number;
  dow: string;
  free: number;
}

export type RackBarKind = "booked" | "inhouse" | "tentative" | "group" | "ooo";

export interface RackBar {
  id: string;
  /** Arrival day (October); bars run from that afternoon to the departure morning. */
  from: number;
  to: number;
  kind: RackBarKind;
  label: string;
  /** Booking behind a confirmed or requested bar (opens it). */
  bookingId?: string;
  icon?: IconName;
  /** Outline that flags the bar: an arrival without a room. */
  flag?: "warning";
  /** Part of the room conflict until the move is confirmed. */
  conflict?: boolean;
  /** Label once the split stay is confirmed. */
  movedLabel?: string;
  /** The proposed move (opens the move check). */
  proposal?: boolean;
}

export interface RackLane {
  id: string;
  kind: "group" | "room";
  /** Group lanes: room type and summary. */
  label: string;
  meta: string;
  /** Group lanes: rooms of this type in the property. */
  rooms: number;
  /** Room lanes: room number (or the guest for an unassigned arrival). */
  room: string;
  status: RoomStatus | null;
  /** Shown instead of the housekeeping status (unassigned arrivals). */
  statusLabel: string | null;
  group: string;
  bars: RackBar[];
  conflict: boolean;
  proposal: boolean;
}

export interface MoveCheck {
  id: string;
  icon: IconName;
  tone: "success" | "warning" | "default";
  title: string;
  detail: string;
}

/** A split stay proposed on the room rack, with the checks it went through. */
export interface RoomMove {
  id: string;
  guest: string;
  firstName: string;
  bookingId: string;
  stayId: string;
  fromRoom: string;
  toRoom: string;
  /** First night in the new room (October). */
  fromDay: number;
  title: string;
  detail: string;
  conflictChip: string;
  conflictLabel: string;
  reasons: string[];
  plannedAt: string;
  checks: MoveCheck[];
}

// ── Reservations ─────────────────────────────────────────────────────────────

export interface Reservation {
  id: string;
  guest: string;
  initials: string;
  dates: string;
  nights: number;
  roomType: string;
  room: string | null;
  channel: string;
  status: string;
  statusTone: Tone;
  stay: string;
  payment: string;
  paymentTone: Tone;
  /** Arrival day (October 2026). */
  arrivalDay: number;
  kind: "noshow" | "today" | "inhouse" | "request" | "future" | "cancelled";
  guests: string;
  /** Verified payments on the booking. */
  deposit: number;
  /** First night incl. VAT (kept on late cancellations). */
  firstNight: number;
  paymentDetail: string;
  info: string | null;
  /** Guest phone when the desk has it on file (searchable). */
  phone: string | null;
  /** Dates the guest asked to move to (prefills "Change dates"). */
  change: { arrival: string; departure: string } | null;
}

export interface BookingRequest {
  id: string;
  initials: string;
  name: string;
  channel: string;
  dates: string;
  roomType: string;
  guests: string;
  total: number;
  message: string;
  left: string;
  autoDeclines: string;
  /** Share of the 24 h decision window already used. */
  windowUsed: number;
  urgent: boolean;
}

export interface CancellationTier {
  id: string;
  label: string;
  rule: string;
}

export interface ReservationView {
  id: "all" | "today" | "payment" | "noRoom" | "notArrived";
  label: string;
}

export interface ReservationsSummary {
  id: string;
  totalBookings: number;
  window: string;
  /** Cancellation policy saved in the bookings' terms. */
  policy: string;
  refundId: string;
  /** Time stamped on decisions taken from this screen. */
  actedAt: string;
  dateRanges: { id: string; label: string; from: number; to: number }[];
  declineReasons: string[];
  cancelReasons: string[];
  noShowReasons: string[];
}

// ── Reservation record ───────────────────────────────────────────────────────

export type PaymentOutcome = "pending" | "verified" | "unknown";

export interface LinkedRecord {
  id: string;
  kind: string;
  recordId: string;
  state: string;
  tone: Tone;
  icon: IconName;
  note: string;
  board: BoardId | null;
  /** Follows the deposit outcome (state and note come from the outcome). */
  followsPayment?: "state" | "note";
}

export interface RecordParty {
  id: string;
  role: string;
  icon: IconName;
  name: string;
  desc: string;
  tone: Tone;
  flag: string | null;
}

export interface RateNight {
  id: string;
  night: string;
  room: string;
  note: string;
  rate: number;
  vat: number;
}

export interface PaymentAttempt {
  id: string;
  title: string;
  phone: string;
  ref: string;
  key: string;
  /** Fixed outcome; null follows the deposit outcome. */
  result: { label: string; tone: Tone; detail: string } | null;
}

export interface DepositOutcome {
  label: string;
  tone: Tone;
  status: "warning" | "success";
  icon: IconName;
  time: string;
  folio: string;
  history: string;
}

export interface HistoryEvent {
  id: string;
  status: "success" | "danger" | "default" | "warning" | "current" | "payment";
  icon: IconName;
  title: string;
  detail: string;
}

export interface ChatLine {
  id: string;
  from: "guest" | "desk";
  initials: string;
  text: string;
  meta: string;
}

export interface ReservationRecord {
  id: string;
  guest: string;
  firstName: string;
  summary: string;
  linked: LinkedRecord[];
  partiesNote: string;
  parties: RecordParty[];
  rateNote: string;
  ratePlan: string;
  nights: RateNight[];
  taxNote: string;
  levyNote: string;
  termsId: string;
  termsNote: string;
  terms: Fact[];
  messages: ChatLine[];
  deposit: {
    intent: string;
    amount: number;
    basis: string;
    provider: string;
    providerRef: string;
    folioId: string;
    confirmedAt: string;
    lastChecked: string;
    timedOutAt: string;
  };
  attempts: PaymentAttempt[];
  outcomes: Record<PaymentOutcome, DepositOutcome>;
  policyId: string;
  /** Index of the cancellation tier that applies today. */
  tierToday: number;
  cancelNote: Record<"verified" | "unpaid", string>;
  proforma: { id: string; sent: string; total: number };
  history: HistoryEvent[];
}

// ═════════════════════════════════════════════════════════════════════════════

const deskKpis: DeskKpi[] = [
  {
    id: "arrivals",
    label: "Arrivals",
    value: 5,
    total: 14,
    foot: "Checked in · next is Sarah Kimani",
    icon: "ArrowRightToSquare",
    status: "default",
  },
  {
    id: "inHouse",
    label: "In house",
    value: 33,
    total: null,
    foot: "Guests in 31 of 42 rooms",
    icon: "House",
    status: "default",
  },
  {
    id: "departures",
    label: "Departures",
    value: 4,
    total: 11,
    foot: "Checked out · 1 late checkout",
    icon: "ArrowRightFromSquare",
    status: "default",
  },
  {
    id: "roomsReady",
    label: "Arrival rooms ready",
    value: 5,
    total: 8,
    foot: "3 being cleaned · 1 arrival unassigned",
    icon: "BroomMotion",
    status: "warning",
  },
  {
    id: "requests",
    label: "Open requests",
    value: 5,
    total: null,
    foot: "Oldest: towels for 206, 18 min",
    icon: "Comments",
    status: "warning",
  },
];

const queueTabs: QueueTab[] = [
  {
    id: "arrivals",
    label: "Arrivals",
    count: 14,
    tableLabel: "Arrivals today",
    foot: "9 still to arrive · 5 checked in earlier today (hidden) · balances come from the folio or the booking deposit only",
  },
  {
    id: "inHouse",
    label: "In-house",
    count: 33,
    tableLabel: "Guests in house",
    foot: "Showing 6 of 33 in-house stays · sorted by departure date",
  },
  {
    id: "departures",
    label: "Departures",
    count: 11,
    tableLabel: "Departures today",
    foot: "Showing 6 of 11 departures · 4 checked out · a checkout waits for the fiscal receipt, not the other way round",
  },
];

const arrivals: Arrival[] = [
  {
    id: "a1",
    name: "Sarah Kimani",
    bookingId: "BK-20431",
    nights: 2,
    source: "Akagera Horizon Travel",
    roomType: "Deluxe Lake View",
    room: "204",
    roomStatus: "dirty",
    roomStatusLabel: "Dirty · 12:00",
    idStatus: "received",
    balance: 165200,
    balanceNote: "Deposit due",
    balanceFlag: true,
    eta: "At the desk",
    note: "Arrived early · late checkout asked",
    atDesk: true,
  },
  {
    id: "a2",
    name: "Thomas Weber",
    bookingId: "BK-20433",
    nights: 5,
    source: "Umurage Consulting",
    roomType: "Deluxe Lake View",
    room: "211",
    roomStatus: "dirty",
    roomStatusLabel: "Dirty · 13:00",
    idStatus: "missing",
    balance: 148680,
    balanceNote: "MoMo pending",
    balanceFlag: true,
    eta: "13:30",
    note: "Moves to 305 on 14 Oct",
    atDesk: false,
  },
  {
    id: "a3",
    name: "Daniel Okafor",
    bookingId: "BK-20436",
    nights: 3,
    source: "Website",
    roomType: "Standard Queen",
    room: "106",
    roomStatus: "inspected",
    roomStatusLabel: null,
    idStatus: "received",
    balance: 0,
    balanceNote: "Prepaid · verified",
    balanceFlag: false,
    eta: "12:30",
    note: "Airport pickup booked",
    atDesk: false,
  },
  {
    id: "a4",
    name: "Yuki Tanaka",
    bookingId: "BK-20438",
    nights: 1,
    source: "Marketplace",
    roomType: "Standard Queen",
    room: null,
    roomStatus: null,
    roomStatusLabel: null,
    idStatus: "received",
    balance: 0,
    balanceNote: "Prepaid · verified",
    balanceFlag: false,
    eta: "14:00",
    note: "Vegetarian breakfast",
    atDesk: false,
  },
  {
    id: "a5",
    name: "Aisha Mohammed",
    bookingId: "BK-20440",
    nights: 4,
    source: "Umurage Consulting",
    roomType: "Deluxe Lake View",
    room: "310",
    roomStatus: "clean",
    roomStatusLabel: null,
    idStatus: "review",
    balance: 0,
    balanceNote: "Billed to company",
    balanceFlag: false,
    eta: "15:00",
    note: "Room and tax to Umurage; extras to guest",
    atDesk: false,
  },
  {
    id: "a6",
    name: "Jean Bosco Nkurunziza",
    bookingId: "BK-20445",
    nights: 2,
    source: "Phone",
    roomType: "Standard Queen",
    room: "102",
    roomStatus: "dirty",
    roomStatusLabel: "Dirty · 13:00",
    idStatus: "missing",
    balance: 200600,
    balanceNote: "Pays on arrival",
    balanceFlag: false,
    eta: "16:00",
    note: "Will pay by MTN MoMo",
    atDesk: false,
  },
  {
    id: "a7",
    name: "Nadia Benali",
    bookingId: "BK-20444",
    nights: 1,
    source: "Direct",
    roomType: "Twin",
    room: "209",
    roomStatus: "inspected",
    roomStatusLabel: null,
    idStatus: "received",
    balance: 0,
    balanceNote: "Prepaid · verified",
    balanceFlag: false,
    eta: "17:00",
    note: "Travelling with a colleague",
    atDesk: false,
  },
  {
    id: "a8",
    name: "Pierre Laurent",
    bookingId: "BK-20443",
    nights: 3,
    source: "Request approved",
    roomType: "Deluxe Lake View",
    room: "212",
    roomStatus: "inspected",
    roomStatusLabel: null,
    idStatus: "received",
    balance: 0,
    balanceNote: "Deposit verified",
    balanceFlag: false,
    eta: "18:30",
    note: "Anniversary · flowers in room",
    atDesk: false,
  },
  {
    id: "a9",
    name: "Kwame Mensah",
    bookingId: "BK-20446",
    nights: 2,
    source: "Channel manager",
    roomType: "Standard Queen",
    room: "108",
    roomStatus: "inspected",
    roomStatusLabel: null,
    idStatus: "missing",
    balance: 200600,
    balanceNote: "Collect on arrival",
    balanceFlag: false,
    eta: "21:00",
    note: "Late arrival guaranteed",
    atDesk: false,
  },
];

const inHouse: InHouseStay[] = [
  {
    id: "h1",
    name: "Marie Claire Uwimana",
    bookingId: "BK-20419",
    night: 4,
    of: 4,
    source: "Direct",
    room: "402",
    stayId: "ST-8790",
    balance: 61500,
    folioId: "F-5498",
    leaving: "Leaves tomorrow",
    note: "Extra bed in room",
  },
  {
    id: "h2",
    name: "Lucia Romero",
    bookingId: "BK-20429",
    night: 4,
    of: 5,
    source: "Channel manager",
    room: "305",
    stayId: "ST-8801",
    balance: 23000,
    folioId: "F-5507",
    leaving: "Leaves 14 Oct",
    note: "Room needed for Thomas Weber after her",
  },
  {
    id: "h3",
    name: "Jonas Lindqvist",
    bookingId: "BK-20393",
    night: 5,
    of: 5,
    source: "Website",
    room: "110",
    stayId: "ST-8786",
    balance: 0,
    folioId: "F-5495",
    leaving: "Leaves tomorrow",
    note: "Shower reported · WO-322",
  },
  {
    id: "h4",
    name: "Kevin Otieno",
    bookingId: "BK-20427",
    night: 3,
    of: 4,
    source: "Akagera Horizon Travel",
    room: "301",
    stayId: "ST-8799",
    balance: 84200,
    folioId: "F-5505",
    leaving: "Leaves 14 Oct",
    note: "Asked for late checkout",
  },
  {
    id: "h5",
    name: "Amina Uwase",
    bookingId: "BK-20430",
    night: 2,
    of: 4,
    source: "Direct",
    room: "206",
    stayId: "ST-8808",
    balance: 12000,
    folioId: "F-5515",
    leaving: "Do not disturb",
    note: "Until 11:00 · towels requested",
  },
  {
    id: "h6",
    name: "Samuel Mugabo",
    bookingId: "BK-20432",
    night: 2,
    of: 2,
    source: "Phone",
    room: "306",
    stayId: "ST-8810",
    balance: 148680,
    folioId: "F-5518",
    leaving: "Leaves tomorrow",
    note: "Pays at checkout",
  },
];

const departures: Departure[] = [
  {
    id: "d1",
    name: "Chen Wei",
    bookingId: "BK-20420",
    nights: 3,
    source: "Website",
    room: "105",
    checkout: "due",
    checkoutLabel: "Due 11:00",
    balance: 46500,
    balanceNote: "Lake Bar and laundry",
    time: "11:00",
    note: "Taxi booked 11:15",
  },
  {
    id: "d2",
    name: "Eduardo Silva",
    bookingId: "BK-20423",
    nights: 4,
    source: "Marketplace",
    room: "207",
    checkout: "due",
    checkoutLabel: "Due 11:00",
    balance: 0,
    balanceNote: "Settled",
    time: "11:00",
    note: "Keys at desk",
  },
  {
    id: "d3",
    name: "Rania Haddad",
    bookingId: "BK-20428",
    nights: 2,
    source: "Akagera Horizon Travel",
    room: "109",
    checkout: "due",
    checkoutLabel: "Due 12:00",
    balance: 212400,
    balanceNote: "Extras · agent invoiced",
    time: "12:00",
    note: "Split bill",
  },
  {
    id: "d4",
    name: "Nkechi Eze",
    bookingId: "BK-20426",
    nights: 3,
    source: "Direct",
    room: "303",
    checkout: "late",
    checkoutLabel: "Late · 14:00 approved",
    balance: 18500,
    balanceNote: "Terrace lunch",
    time: "14:00",
    note: "Late checkout free under policy",
  },
  {
    id: "d5",
    name: "Ingrid Solberg",
    bookingId: "BK-20421",
    nights: 4,
    source: "Website",
    room: "204",
    checkout: "out",
    checkoutLabel: "Out 08:50",
    balance: 0,
    balanceNote: "EBM receipt issued",
    time: "08:50",
    note: "Left feedback in app",
  },
  {
    id: "d6",
    name: "Moses Kariuki",
    bookingId: "BK-20424",
    nights: 3,
    source: "Phone",
    room: "211",
    checkout: "fiscal",
    checkoutLabel: "Out 09:40",
    balance: 0,
    balanceNote: "EBM pending · retrying",
    time: "09:40",
    note: "Paid by MTN MoMo · verified",
  },
];

const guestRequests: GuestRequest[] = [
  {
    id: "q1",
    icon: "TShirt",
    title: "Extra towels · room 206",
    meta: "Amina Uwase",
    status: "Overdue",
    tone: "danger",
    age: "18 min",
    board: "Messages",
    linkLabel: "Open conversation with Amina Uwase",
    linkIcon: "Comment",
    canComplete: true,
  },
  {
    id: "q2",
    icon: "Car",
    title: "Airport transfer 14 Oct, 10:00",
    meta: "Sarah Kimani",
    status: "New",
    tone: "accent",
    age: "2 h",
    board: "Messages",
    linkLabel: "Open conversation with Sarah Kimani",
    linkIcon: "Comment",
    canComplete: true,
  },
  {
    id: "q3",
    icon: "Clock",
    title: "Late checkout to 14:00 · room 301",
    meta: "Free to 13:00",
    status: "Decide",
    tone: "warning",
    age: "35 min",
    board: "Messages",
    linkLabel: "Open conversation with Kevin Otieno",
    linkIcon: "Comment",
    canComplete: true,
  },
  {
    id: "q4",
    icon: "Cup",
    title: "Terrace table for two, 19:30",
    meta: "Room 402",
    status: "New",
    tone: "accent",
    age: "50 min",
    board: "OutletsMenus",
    linkLabel: "Open services",
    linkIcon: "Cup",
    canComplete: true,
  },
  {
    id: "q5",
    icon: "Wrench",
    title: "Shower drains slowly · room 110",
    meta: "WO-322",
    status: "Maintenance",
    tone: "info",
    age: "1 h",
    board: "Messages",
    linkLabel: "Open conversation with Jonas Lindqvist",
    linkIcon: "Comment",
    canComplete: false,
  },
];

const readiness: ReadinessRoom[] = [
  { id: "204", room: "204", status: "dirty", label: "Dirty · 12:00", guest: "Sarah Kimani" },
  { id: "211", room: "211", status: "dirty", label: "Dirty · 13:00", guest: "Thomas Weber" },
  { id: "102", room: "102", status: "dirty", label: "Dirty · 13:00", guest: "Jean Bosco N." },
  { id: "310", room: "310", status: "clean", label: "Clean", guest: "Aisha Mohammed" },
  { id: "106", room: "106", status: "inspected", label: "Inspected", guest: "Daniel Okafor" },
  { id: "209", room: "209", status: "inspected", label: "Inspected", guest: "Nadia Benali" },
  { id: "212", room: "212", status: "inspected", label: "Inspected", guest: "Pierre Laurent" },
  { id: "108", room: "108", status: "inspected", label: "Inspected", guest: "Kwame Mensah" },
];

const roomTypes: RoomType[] = [
  {
    id: "queen",
    name: "Standard Queen",
    beds: "1 queen bed · garden side",
    sleeps: 2,
    rate: 85000,
    left: 3,
    free: 3,
    soldNote: null,
  },
  { id: "twin", name: "Twin", beds: "2 single beds", sleeps: 2, rate: 92000, left: 1, free: 1, soldNote: null },
  {
    id: "dlv",
    name: "Deluxe Lake View",
    beds: "King bed · balcony over the lake",
    sleeps: 2,
    rate: 140000,
    left: 1,
    free: 0,
    soldNote: "Sold 10:46 · other channel",
  },
  {
    id: "family",
    name: "Family Suite",
    beds: "2 rooms · king and twin",
    sleeps: 4,
    rate: 220000,
    left: 2,
    free: 2,
    soldNote: null,
  },
];

const deskRooms: DeskRoom[] = [
  ["104", "Standard Queen", "inspected", "Inspected 09:05 · garden side"],
  ["107", "Standard Queen", "clean", "Clean · awaiting inspection"],
  ["111", "Standard Queen", "inspected", "Inspected 09:40 · quiet end"],
  ["103", "Standard Queen", "dirty", "Checkout clean due 12:30"],
  ["112", "Standard Queen", "ooo", "Air conditioning repair · WO-320"],
  ["205", "Twin", "inspected", "Inspected 08:55"],
  ["203", "Twin", "clean", "Clean · awaiting inspection"],
  ["207", "Twin", "dirty", "Guest checking out 11:00"],
  ["208", "Deluxe Lake View", "inspected", "Inspected 09:20 · lake view"],
  ["304", "Deluxe Lake View", "clean", "Clean · awaiting inspection"],
  ["308", "Deluxe Lake View", "inspected", "Inspected 09:50"],
  ["204", "Deluxe Lake View", "dirty", "Checkout clean due 12:00"],
  ["302", "Deluxe Lake View", "ooo", "Window repair · WO-321"],
  ["401", "Family Suite", "inspected", "Inspected 08:30"],
  ["404", "Family Suite", "clean", "Clean · awaiting inspection"],
].map(([room, roomType, status, note]) => ({
  id: room as string,
  room: room as string,
  roomType: roomType as string,
  status: status as RoomStatus,
  note: note as string,
}));

const checkIns: CheckInFile[] = [
  {
    id: "BK-20431",
    guest: "Sarah Kimani",
    firstName: "Sarah",
    initials: "SK",
    roomType: "Deluxe Lake View",
    dates: "Mon 12 → Wed 14 Oct",
    nights: 2,
    adults: 2,
    bookedBy: "Akagera Horizon Travel",
    lockedSince: "10:44",
    bookingStatus: "Booking confirmed",
    facts: [
      { label: "Dates", value: "Mon 12 → Wed 14 Oct · 2 nights" },
      { label: "Room type", value: "Deluxe Lake View" },
      { label: "Guests", value: "2 adults" },
      { label: "Booked by", value: "Akagera Horizon Travel" },
      { label: "Stay total", value: "RWF 330,400 incl. VAT" },
      { label: "Terms", value: "Snapshot 28 Sep · CXL-STD v3 · DEP-AGENT v2" },
    ],
    requests: ["Airport transfer 14 Oct 10:00", "Late checkout asked"],
    primaryRoles: ["Primary occupant", "Payer"],
    primaryDocument: [
      { label: "Document", value: "Passport · Kenya · AK•••••19" },
      { label: "Expires", value: "March 2031" },
      { label: "Date of birth", value: "••/••/1988" },
      { label: "Received", value: "10 Oct, 19:12 · guest app · not yet compared in person" },
    ],
    occupant: {
      name: "Grace Achieng",
      initials: "GA",
      documentTypes: ["Passport", "National ID", "Driving licence"],
      scannedNumber: "BK•••••42",
      scannedAt: "10:46",
    },
    duplicate: {
      existingId: "G-10233",
      cards: [
        {
          title: "On this booking",
          lines: ["Sarah Kimani · born ••/••/1988 · Kenya", "+254 7•• ••• 512 · s.kim•••@gmail.com"],
          note: "New profile from the guest app, 10 Oct",
        },
        {
          title: "Existing profile G-10233",
          lines: ["Sarah W. Kimani · born ••/••/1988 · Kenya", "+254 7•• ••• 340 · different email"],
          note: "1 stay · March 2025 · prefers high floor",
        },
      ],
    },
    parties: [
      {
        id: "sarah",
        icon: "Person",
        name: "Sarah Kimani",
        desc: "Primary occupant · pays room, tax and extras",
        role: "Occupant · Payer",
        tone: "accent",
      },
      {
        id: "grace",
        icon: "Person",
        name: "Grace Achieng",
        desc: "Sharing the room",
        role: "Occupant",
        tone: "default",
      },
      {
        id: "aht",
        icon: "Briefcase",
        name: "Akagera Horizon Travel",
        desc: "Made the booking · not staying · commission is handled by Finance",
        role: "Booker · Agent",
        tone: "info",
      },
    ],
    preAssignedRoom: "204",
    defaultRoom: "208",
    rooms: [
      {
        id: "204",
        room: "204",
        status: "dirty",
        note: "Pre-assigned · checkout clean in progress · Jeanne N. · due 12:00",
      },
      { id: "208", room: "208", status: "inspected", note: "Floor 2 · lake view · inspected 09:20 by Beatrice M." },
      { id: "304", room: "304", status: "clean", note: "Floor 3 · lake view · not inspected yet" },
      { id: "308", room: "308", status: "inspected", note: "Floor 3 · lake view · inspected 09:50" },
      { id: "306", room: "306", status: "occupied", note: "In house until 13 Oct" },
      { id: "302", room: "302", status: "ooo", note: "Window repair · WO-321 · until 15 Oct" },
    ],
    override: {
      reasons: ["Guest insists on the booked room", "Accessibility need", "Loyalty or VIP commitment"],
      approvers: ["Aline Uwase · General manager", "Didier Mugenzi · Owner"],
      note: "Guest asked for 204 (booked by agent). Bathroom done, only bed linen left.",
      sentAt: "10:47",
    },
    deposit: {
      amount: 165200,
      policy: "DEP-AGENT v2",
      voucher: "AHT-88213",
      stayTotal: 330400,
      phone: "+250 788 214 530",
      phoneMasked: "+250 788 ••• 530",
      cashReceived: 170000,
      till: "Desk till 1",
      sentAt: "10:47",
      confirmedAt: "10:48:12",
    },
    methods: [
      {
        id: "momo",
        icon: "Smartphone",
        label: "Mobile money",
        note: "MTN MoMo or Airtel Money · pending until the provider confirms",
        disabled: false,
      },
      {
        id: "card",
        icon: "CreditCard",
        label: "Card",
        note: "GT Bank adapter · production access not verified, so cards are off",
        disabled: true,
      },
      { id: "cash", icon: "Wallet", label: "Cash", note: "Recorded to Desk till 1", disabled: false },
      {
        id: "later",
        icon: "Clock",
        label: "Pay at checkout",
        note: "Allowed for agent-guaranteed bookings",
        disabled: false,
      },
    ],
    networks: [
      { id: "MTN", label: "MTN MoMo", ref: "MP261012.1047.S20431" },
      { id: "Airtel", label: "Airtel Money", ref: "AM261012.1047.73120" },
    ],
    stayId: "ST-8841",
    folioId: "F-5530",
    depositId: "PI-77158",
    claimCode: "7KQ4-M2XR",
    checkedInAt: "10:49",
    documents: [
      {
        id: "rc",
        icon: "FileText",
        title: "Registration card RC-20431",
        desc: "Sarah Kimani and Grace Achieng · signed on the desk tablet",
        chip: "Signed",
        tone: "success",
        printable: true,
      },
      {
        id: "pro",
        icon: "File",
        title: "Proforma PRO-26-0431",
        desc: "RWF 330,400 · a quote for the stay, not a tax invoice or receipt",
        chip: "Proforma",
        tone: "default",
        printable: true,
      },
      {
        id: "ebm",
        icon: "FileCheck",
        title: "EBM fiscal receipt",
        desc: "Issued when the folio is settled at checkout",
        chip: "Not issued yet",
        tone: "default",
        printable: false,
      },
    ],
  },
];

const guestMatches: GuestMatch[] = [
  {
    id: "g1",
    initials: "FH",
    name: "Fatuma Hassan · G-09871",
    desc: "+250 788 300 419 · 2 stays · last June 2026",
    chip: "Same phone and name",
    tone: "success",
    note: "This booking links to G-09871. Profiles are never merged from here.",
  },
  {
    id: "g2",
    initials: "FH",
    name: "Fatuma H. Hassan · G-11408",
    desc: "fatuma.h•••@•••.com · marketplace account · no stays",
    chip: "Similar name only",
    tone: "warning",
    note: "This booking links to G-11408. Check the phone number with the guest.",
  },
  {
    id: "new",
    initials: "+",
    name: "Create a new guest profile",
    desc: "Use when neither match is this guest",
    chip: "New",
    tone: "default",
    note: "A new profile is created. A manager can merge profiles later in Guests.",
  },
];

const walkInQuotes: WalkInQuote[] = [
  {
    id: "Q-20451",
    status: "draft",
    arrivalDate: "2026-10-12",
    arrival: "Today · Mon 12 Oct",
    nights: 2,
    adults: 2,
    children: 0,
    roomType: "twin",
    guestName: "Fatuma Hassan",
    guestPhone: "+250 788 300 419",
    guestMatch: "g1",
    checkedAt: "10:46",
    rechecksAt: "10:47",
    conflictType: "dlv",
    conflictAt: "10:46",
    policy: {
      id: "CXL-WALK v2",
      name: "Flexible walk-in",
      note: "Free until 18:00 today",
    },
    tax: { rate: 0.18, rule: "Tax rule VAT-RW v4 · effective 1 Jan 2026", levy: "Not configured for this property" },
    hold: {
      left: "8:41 left",
      pct: 87,
      releasesAt: "10:57",
      extendedLeft: "18:41 left",
      extendedPct: 94,
      extendedAt: "11:07",
    },
  },
];

const rackDays: RackDay[] = [
  ["Sun", 6],
  ["Mon", 9],
  ["Tue", 12],
  ["Wed", 10],
  ["Thu", 13],
  ["Fri", 15],
  ["Sat", 8],
  ["Sun", 7],
  ["Mon", 14],
  ["Tue", 18],
  ["Wed", 20],
  ["Thu", 19],
  ["Fri", 4],
  ["Sat", 3],
].map(([dow, free], i) => ({ id: `d${11 + i}`, day: 11 + i, dow: dow as string, free: free as number }));

const lane = (
  id: string,
  group: string,
  room: string,
  status: RoomStatus | null,
  bars: Omit<RackBar, "id">[],
  extra: Partial<RackLane> = {},
): RackLane => ({
  id,
  kind: "room",
  label: "",
  meta: "",
  rooms: 0,
  room,
  status,
  statusLabel: null,
  group,
  bars: bars.map((b, i) => ({ ...b, id: `${id}-${i + 1}` })),
  conflict: false,
  proposal: false,
  ...extra,
});
const groupLane = (id: string, label: string, meta: string, rooms: number): RackLane => ({
  id,
  kind: "group",
  label,
  meta,
  rooms,
  room: "",
  status: null,
  statusLabel: null,
  group: label,
  bars: [],
  conflict: false,
  proposal: false,
});

const rackLanes: RackLane[] = [
  groupLane("g-unassigned", "Unassigned", "1 arrival without a room", 0),
  lane(
    "yuki",
    "Standard Queen",
    "Yuki T.",
    null,
    [
      {
        from: 12,
        to: 13,
        kind: "booked",
        label: "Yuki Tanaka · needs a room",
        bookingId: "BK-20438",
        icon: "CircleDashed",
        flag: "warning",
      },
    ],
    { statusLabel: "Standard Queen" },
  ),
  groupLane("g-queen", "Standard Queen", "12 rooms · 4 shown", 12),
  lane("102", "Standard Queen", "102", "dirty", [
    { from: 12, to: 14, kind: "booked", label: "Jean Bosco Nkurunziza", bookingId: "BK-20445" },
  ]),
  lane("106", "Standard Queen", "106", "inspected", [
    { from: 12, to: 15, kind: "booked", label: "Daniel Okafor", bookingId: "BK-20436" },
  ]),
  lane("108", "Standard Queen", "108", "inspected", [
    { from: 12, to: 14, kind: "booked", label: "Kwame Mensah", bookingId: "BK-20446" },
    { from: 16, to: 18, kind: "tentative", label: "Request · Olivia Grant", bookingId: "BK-20450" },
  ]),
  lane("110", "Standard Queen", "110", "occupied", [{ from: 8, to: 13, kind: "inhouse", label: "Jonas Lindqvist" }]),
  groupLane("g-twin", "Twin", "8 rooms · 2 shown", 8),
  lane("209", "Twin", "209", "inspected", [
    { from: 12, to: 13, kind: "booked", label: "Nadia Benali", bookingId: "BK-20444" },
    { from: 17, to: 19, kind: "group", label: "Habimana wedding block" },
  ]),
  lane("301", "Twin", "301", "occupied", [{ from: 10, to: 14, kind: "inhouse", label: "Kevin Otieno" }]),
  groupLane("g-dlv", "Deluxe Lake View", "16 rooms · 9 shown", 16),
  lane("204", "Deluxe Lake View", "204", "dirty", [
    { from: 12, to: 14, kind: "booked", label: "Sarah Kimani · at the desk", bookingId: "BK-20431" },
  ]),
  lane("208", "Deluxe Lake View", "208", "inspected", [
    { from: 17, to: 19, kind: "group", label: "Habimana wedding block" },
    { from: 23, to: 26, kind: "group", label: "EAC Health Forum" },
  ]),
  lane(
    "211",
    "Deluxe Lake View",
    "211",
    "dirty",
    [
      {
        from: 12,
        to: 14,
        kind: "booked",
        label: "Thomas Weber · booked to 17 Oct",
        bookingId: "BK-20433",
        movedLabel: "Thomas Weber · to 305 on 14 Oct",
        conflict: true,
      },
      { from: 14, to: 16, kind: "ooo", label: "Out of order · bathroom works WO-318", conflict: true },
    ],
    { conflict: true },
  ),
  lane("212", "Deluxe Lake View", "212", "inspected", [
    { from: 12, to: 15, kind: "booked", label: "Pierre Laurent", bookingId: "BK-20443" },
  ]),
  lane("302", "Deluxe Lake View", "302", "ooo", [
    { from: 9, to: 15, kind: "ooo", label: "Out of order · window repair WO-321" },
  ]),
  lane("304", "Deluxe Lake View", "304", "clean", [
    { from: 17, to: 19, kind: "group", label: "Habimana wedding block" },
  ]),
  lane(
    "305",
    "Deluxe Lake View",
    "305",
    "occupied",
    [
      { from: 9, to: 14, kind: "inhouse", label: "Lucia Romero" },
      {
        from: 14,
        to: 17,
        kind: "tentative",
        label: "Thomas Weber · proposed move",
        bookingId: "BK-20433",
        movedLabel: "Thomas Weber · from 211",
        icon: "ArrowRightArrowLeft",
        proposal: true,
      },
    ],
    { proposal: true },
  ),
  lane("308", "Deluxe Lake View", "308", "inspected", [
    { from: 15, to: 18, kind: "tentative", label: "Request · Meera Shah · decide by 12:00", bookingId: "BK-20447" },
  ]),
  lane("310", "Deluxe Lake View", "310", "clean", [
    { from: 12, to: 16, kind: "booked", label: "Aisha Mohammed", bookingId: "BK-20440" },
  ]),
  groupLane("g-family", "Family Suite", "6 rooms · 2 shown", 6),
  lane("401", "Family Suite", "401", "inspected", [
    { from: 17, to: 20, kind: "tentative", label: "Option · Akagera Horizon Travel", bookingId: "BK-20448" },
  ]),
  lane("402", "Family Suite", "402", "occupied", [
    { from: 9, to: 13, kind: "inhouse", label: "Marie Claire Uwimana" },
    { from: 23, to: 26, kind: "group", label: "EAC Health Forum" },
  ]),
];

const moveChecks: MoveCheck[] = [
  {
    id: "status",
    icon: "BroomMotion",
    tone: "warning",
    title: "Room status: 305 frees up on 14 Oct",
    detail:
      "Lucia Romero checks out that morning. The checkout clean is booked; Thomas moves only once 305 is Inspected.",
  },
  {
    id: "rate",
    icon: "Tag",
    tone: "success",
    title: "Same room type, same rate",
    detail: "Deluxe Lake View · corporate rate RWF 126,000 a night, unchanged.",
  },
  {
    id: "folio",
    icon: "Receipt",
    tone: "success",
    title: "One folio continues",
    detail: "F-5521 stays open across both rooms. Charges already posted keep room 211 as their source.",
  },
  {
    id: "key",
    icon: "Key",
    tone: "default",
    title: "Key re-issue at the move",
    detail: "No lock provider connected: collect key 211 and issue physical key 305. No digital key is sent.",
  },
  {
    id: "conflict",
    icon: "ShieldCheck",
    tone: "success",
    title: "Clears the conflict",
    detail: "211 is out of order 14–16 Oct for bathroom works (WO-318).",
  },
];

const roomMoves: RoomMove[] = [
  {
    id: "MV-8812",
    guest: "Thomas Weber",
    firstName: "Thomas",
    bookingId: "BK-20433",
    stayId: "ST-8812",
    fromRoom: "211",
    toRoom: "305",
    fromDay: 14,
    title: "Move Thomas Weber to 305 from 14 Oct?",
    detail: "BK-20433 · stay ST-8812 · split stay: 211 for nights 12–13 Oct, 305 for 14–16 Oct",
    conflictChip: "1 conflict · room 211 from 14 Oct",
    conflictLabel: "Conflict: Thomas Weber is booked in 211 to 17 Oct, but 211 is out of order from 14 Oct",
    reasons: [
      "Room out of order (maintenance)",
      "Guest asked for another room",
      "Upgrade approved by a manager",
      "Noise or comfort complaint",
    ],
    plannedAt: "10:48",
    checks: moveChecks,
  },
];

const reservations: Reservation[] = [
  {
    id: "BK-20425",
    guest: "Ivan Petrov",
    initials: "IP",
    dates: "11 → 13 Oct",
    nights: 2,
    roomType: "Twin",
    room: "203",
    channel: "Phone",
    status: "Not arrived",
    statusTone: "danger",
    stay: "No stay opened",
    payment: "Deposit verified",
    paymentTone: "success",
    arrivalDay: 11,
    kind: "noshow",
    guests: "1 adult",
    deposit: 108560,
    firstNight: 0,
    paymentDetail: "RWF 108,560 · Airtel Money · ref AM261008.1730.P20425 · 8 Oct",
    info: null,
    phone: null,
    change: null,
  },
  {
    id: "BK-20431",
    guest: "Sarah Kimani",
    initials: "SK",
    dates: "12 → 14 Oct",
    nights: 2,
    roomType: "Deluxe Lake View",
    room: "204",
    channel: "Akagera Horizon Travel",
    status: "Confirmed",
    statusTone: "success",
    stay: "Arriving · at the desk",
    payment: "Deposit due",
    paymentTone: "warning",
    arrivalDay: 12,
    kind: "today",
    guests: "2 adults",
    deposit: 0,
    firstNight: 0,
    paymentDetail: "RWF 165,200 due at check-in · agent guarantee AHT-88213",
    info: null,
    phone: "+250 788 214 530",
    change: null,
  },
  {
    id: "BK-20433",
    guest: "Thomas Weber",
    initials: "TW",
    dates: "12 → 17 Oct",
    nights: 5,
    roomType: "Deluxe Lake View",
    room: "211 → 305",
    channel: "Direct · Umurage Consulting",
    status: "Confirmed",
    statusTone: "success",
    stay: "Expected 13:30",
    payment: "MoMo pending",
    paymentTone: "warning",
    arrivalDay: 12,
    kind: "today",
    guests: "1 adult",
    deposit: 0,
    firstNight: 148680,
    paymentDetail: "Deposit RWF 148,680 · MTN MoMo pending · 1 earlier attempt failed",
    info: null,
    phone: "+250 78• ••• 412",
    change: null,
  },
  {
    id: "BK-20436",
    guest: "Daniel Okafor",
    initials: "DO",
    dates: "12 → 15 Oct",
    nights: 3,
    roomType: "Standard Queen",
    room: "106",
    channel: "Website",
    status: "Confirmed",
    statusTone: "success",
    stay: "Expected 12:30",
    payment: "Prepaid · verified",
    paymentTone: "success",
    arrivalDay: 12,
    kind: "today",
    guests: "2 adults",
    deposit: 300900,
    firstNight: 100300,
    paymentDetail: "RWF 300,900 · MTN MoMo · ref MP261001.2010.O20436 · 1 Oct",
    info: null,
    phone: null,
    change: null,
  },
  {
    id: "BK-20438",
    guest: "Yuki Tanaka",
    initials: "YT",
    dates: "12 → 13 Oct",
    nights: 1,
    roomType: "Standard Queen",
    room: null,
    channel: "Marketplace",
    status: "Confirmed",
    statusTone: "success",
    stay: "Expected 14:00",
    payment: "Prepaid · verified",
    paymentTone: "success",
    arrivalDay: 12,
    kind: "today",
    guests: "1 adult",
    deposit: 100300,
    firstNight: 100300,
    paymentDetail: "RWF 100,300 · card via marketplace · verified 4 Oct",
    info: null,
    phone: null,
    change: null,
  },
  {
    id: "BK-20429",
    guest: "Lucia Romero",
    initials: "LR",
    dates: "9 → 14 Oct",
    nights: 5,
    roomType: "Deluxe Lake View",
    room: "305",
    channel: "Channel manager",
    status: "Confirmed",
    statusTone: "success",
    stay: "In house · ST-8801",
    payment: "Pays at checkout",
    paymentTone: "default",
    arrivalDay: 9,
    kind: "inhouse",
    guests: "2 adults",
    deposit: 0,
    firstNight: 0,
    paymentDetail: "Folio F-5507 open · balance RWF 23,000",
    info: "Lucia is in house. Extensions, moves and early departures are made on the stay, not by cancelling the booking.",
    phone: null,
    change: null,
  },
  {
    id: "BK-20447",
    guest: "Meera Shah",
    initials: "MS",
    dates: "15 → 18 Oct",
    nights: 3,
    roomType: "Deluxe Lake View",
    room: null,
    channel: "Marketplace",
    status: "Requested",
    statusTone: "warning",
    stay: "Decide by 12:00",
    payment: "Nothing taken",
    paymentTone: "default",
    arrivalDay: 15,
    kind: "request",
    guests: "2 adults",
    deposit: 0,
    firstNight: 0,
    paymentDetail: "Nothing taken until approved",
    info: null,
    phone: null,
    change: null,
  },
  {
    id: "BK-20450",
    guest: "Olivia Grant",
    initials: "OG",
    dates: "16 → 18 Oct",
    nights: 2,
    roomType: "Standard Queen",
    room: null,
    channel: "Marketplace",
    status: "Requested",
    statusTone: "warning",
    stay: "Decide by 13 Oct 22:00",
    payment: "Nothing taken",
    paymentTone: "default",
    arrivalDay: 16,
    kind: "request",
    guests: "1 adult",
    deposit: 0,
    firstNight: 0,
    paymentDetail: "Nothing taken until approved",
    info: null,
    phone: null,
    change: null,
  },
  {
    id: "BK-20448",
    guest: "Akagera Horizon Travel",
    initials: "AH",
    dates: "17 → 20 Oct",
    nights: 3,
    roomType: "Family Suite",
    room: null,
    channel: "Travel agent",
    status: "Requested",
    statusTone: "warning",
    stay: "Decide by 13 Oct 09:00",
    payment: "Nothing taken",
    paymentTone: "default",
    arrivalDay: 17,
    kind: "request",
    guests: "2 adults, 2 children",
    deposit: 0,
    firstNight: 0,
    paymentDetail: "Agent terms · invoiced by Finance",
    info: null,
    phone: null,
    change: null,
  },
  {
    id: "BK-20439",
    guest: "Hannah Becker",
    initials: "HB",
    dates: "18 → 21 Oct",
    nights: 3,
    roomType: "Twin",
    room: null,
    channel: "Direct",
    status: "Confirmed",
    statusTone: "success",
    stay: "Expected 18 Oct",
    payment: "Deposit verified",
    paymentTone: "success",
    arrivalDay: 18,
    kind: "future",
    guests: "2 adults",
    deposit: 108560,
    firstNight: 108560,
    paymentDetail: "RWF 108,560 · MTN MoMo · ref MP261003.0912.H20439 · 3 Oct",
    info: null,
    phone: null,
    change: { arrival: "19 Oct 2026", departure: "22 Oct 2026" },
  },
  {
    id: "BK-20418",
    guest: "Volcano view group",
    initials: "VV",
    dates: "14 → 16 Oct",
    nights: 2,
    roomType: "4 of 6 rooms",
    room: null,
    channel: "Akagera Horizon Travel",
    status: "Part cancelled",
    statusTone: "default",
    stay: "2 rooms cancelled 11 Oct · tier 2",
    payment: "Refund awaiting approval",
    paymentTone: "warning",
    arrivalDay: 14,
    kind: "cancelled",
    guests: "8 adults remain",
    deposit: 0,
    firstNight: 0,
    paymentDetail: "Refund RWF 480,000 · above the RWF 300,000 limit · waiting for the owner",
    info: "Two of six rooms cancelled on 11 Oct. The refund is above the property limit, so the owner decides; Payments pays it out after that.",
    phone: null,
    change: null,
  },
];

const reservationViews: ReservationView[] = [
  { id: "all", label: "All upcoming" },
  { id: "today", label: "Arriving today" },
  { id: "payment", label: "Payment action" },
  { id: "noRoom", label: "No room yet" },
  { id: "notArrived", label: "Not arrived" },
];

const reservationsSummary: ReservationsSummary[] = [
  {
    id: "isangano",
    totalBookings: 128,
    window: "9 to 31 Oct",
    policy: "CXL-STD v3",
    refundId: "RF-3312",
    actedAt: "10:49",
    dateRanges: [
      { id: "oct", label: "Arriving 9 – 31 Oct", from: 9, to: 31 },
      { id: "today", label: "Arriving 12 Oct", from: 12, to: 12 },
      { id: "week", label: "Arriving 12 – 18 Oct", from: 12, to: 18 },
    ],
    declineReasons: ["Dates no longer available", "Can’t meet the request", "Guest didn’t answer questions", "Other"],
    cancelReasons: ["Guest changed plans", "Duplicate booking", "Travel disrupted", "Booked elsewhere"],
    noShowReasons: ["Did not arrive · no contact", "Guest cancelled too late", "Card or wallet declined"],
  },
];

const bookingRequests: BookingRequest[] = [
  {
    id: "BK-20447",
    initials: "MS",
    name: "Meera Shah",
    channel: "Marketplace · request to book",
    dates: "Thu 15 → Sun 18 Oct · 3 nights",
    roomType: "Deluxe Lake View",
    guests: "2 adults",
    total: 495600,
    message: "We would like a quiet room, please. We arrive late, around 22:00, from Kigali.",
    left: "1 h 12 min",
    autoDeclines: "Auto-declines today 12:00",
    windowUsed: 95,
    urgent: true,
  },
  {
    id: "BK-20448",
    initials: "AH",
    name: "Akagera Horizon Travel · Okoro family",
    channel: "Travel agent · request to book",
    dates: "Sat 17 → Tue 20 Oct · 3 nights",
    roomType: "Family Suite",
    guests: "2 adults, 2 children",
    total: 778800,
    message: "Children are 6 and 9. Can you add an extra bed? Commission as per our agreement.",
    left: "22 h",
    autoDeclines: "Auto-declines 13 Oct 09:00",
    windowUsed: 8,
    urgent: false,
  },
  {
    id: "BK-20450",
    initials: "OG",
    name: "Olivia Grant",
    channel: "Marketplace · request to book",
    dates: "Fri 16 → Sun 18 Oct · 2 nights",
    roomType: "Standard Queen",
    guests: "1 adult",
    total: 200600,
    message: "Is there a quiet place to work? I will be on calls most afternoons.",
    left: "1 day 11 h",
    autoDeclines: "Auto-declines 13 Oct 22:00",
    windowUsed: 30,
    urgent: false,
  },
];

const cancellationTiers: CancellationTier[] = [
  { id: "t1", label: "More than 7 days before arrival", rule: "Full refund" },
  { id: "t2", label: "2 to 7 days before", rule: "Half the deposit kept" },
  { id: "t3", label: "Under 48 h or arrival day", rule: "First night kept" },
  { id: "t4", label: "No-show", rule: "First night kept" },
];

const reservationRecords: ReservationRecord[] = [
  {
    id: "BK-20433",
    guest: "Thomas Weber",
    firstName: "Thomas",
    summary: "Deluxe Lake View · Mon 12 → Sat 17 Oct · 5 nights · 1 adult · corporate rate through Umurage Consulting",
    linked: [
      {
        id: "booking",
        kind: "Booking",
        recordId: "BK-20433",
        state: "Confirmed",
        tone: "success",
        icon: "Calendar",
        note: "Instant confirmation · 2 Oct",
        board: null,
      },
      {
        id: "stay",
        kind: "Stay",
        recordId: "ST-8812",
        state: "Expected · not checked in",
        tone: "default",
        icon: "House",
        note: "ETA 13:30 · split stay proposed",
        board: "StayFolio",
      },
      {
        id: "folio",
        kind: "Folio",
        recordId: "F-5521",
        state: "Open",
        tone: "default",
        icon: "Receipt",
        note: "",
        board: "StayFolio",
        followsPayment: "note",
      },
      {
        id: "payment",
        kind: "Payment",
        recordId: "PI-77142",
        state: "",
        tone: "default",
        icon: "Wallet",
        note: "Deposit · 2 attempts",
        board: null,
        followsPayment: "state",
      },
      {
        id: "fiscal",
        kind: "Fiscal document",
        recordId: "None yet",
        state: "Not issued",
        tone: "default",
        icon: "FileCheck",
        note: "EBM receipt only at settlement",
        board: null,
      },
    ],
    partiesNote: "Four separate relationships · a billing contact is never shown as an occupant",
    parties: [
      {
        id: "booker",
        role: "Booker",
        icon: "Envelope",
        name: "Rose Uwamahoro",
        desc: "Travel coordinator, Umurage Consulting · rose.u•••@umurage.rw · booking contact, not staying",
        tone: "default",
        flag: null,
      },
      {
        id: "occupant",
        role: "Occupant",
        icon: "Person",
        name: "Thomas Weber",
        desc: "Primary and only guest · Germany · +250 78• ••• 412",
        tone: "accent",
        flag: "Pre-arrival ID not received",
      },
      {
        id: "company",
        role: "Contracting company",
        icon: "Briefcase",
        name: "Umurage Consulting Ltd",
        desc: "Corporate agreement CA-UMU-2026 v2 · sets the rate only · not billed for this stay",
        tone: "info",
        flag: null,
      },
      {
        id: "payer",
        role: "Payer",
        icon: "Wallet",
        name: "Thomas Weber",
        desc: "Pays room, VAT and extras himself · mobile money",
        tone: "success",
        flag: null,
      },
    ],
    rateNote: "Room 211 for 12–13 Oct, 305 from 14 Oct once the split stay is confirmed",
    ratePlan: "Corporate · CA-UMU-2026",
    nights: [
      { id: "n12", night: "Mon 12 Oct", room: "211", note: "", rate: 126000, vat: 22680 },
      { id: "n13", night: "Tue 13 Oct", room: "211", note: "", rate: 126000, vat: 22680 },
      { id: "n14", night: "Wed 14 Oct", room: "305", note: "after move", rate: 126000, vat: 22680 },
      { id: "n15", night: "Thu 15 Oct", room: "305", note: "after move", rate: 126000, vat: 22680 },
      { id: "n16", night: "Fri 16 Oct", room: "305", note: "after move", rate: 126000, vat: 22680 },
    ],
    taxNote: "VAT from tax rule VAT-RW v4 · effective 1 Jan 2026",
    levyNote: "Tourism levy not configured for this property",
    termsId: "TS-20433",
    termsNote:
      "Saved 2 Oct 2026, 16:02 when the booking was confirmed, together with the room commitment. The 3 Oct date change added one night at the same rate plan; policies stayed the same. Later policy changes don't apply to this booking.",
    terms: [
      { label: "Booking mode", value: "Instant confirmation" },
      { label: "Rate plan", value: "Corporate CA-UMU-2026 v2 · RWF 126,000 a night" },
      { label: "Cancellation", value: "CXL-STD v3 · effective 1 Sep 2026" },
      { label: "Deposit", value: "DEP-STD v2 · 1 night; if unpaid, collected at check-in" },
      { label: "Tax rule", value: "VAT-RW v4 · 18% · effective 1 Jan 2026 · configured, awaiting sign-off" },
      { label: "Currency", value: "RWF · Africa/Kigali time" },
    ],
    messages: [
      {
        id: "m1",
        from: "guest",
        initials: "TW",
        text: "Hello, I'll arrive around 13:30 from Kigali. Can I pay the deposit by mobile money? My other wallet didn't work.",
        meta: "Thomas · guest app · 09:12",
      },
      {
        id: "m2",
        from: "desk",
        initials: "EH",
        text: "Hi Thomas, we've sent an MTN MoMo request for RWF 148,680 to your number ending 412. Please approve it with your PIN.",
        meta: "Eric · 10:31",
      },
      { id: "m3", from: "guest", initials: "TW", text: "Got it, approving now.", meta: "Thomas · 10:33" },
    ],
    deposit: {
      intent: "PI-77142",
      amount: 148680,
      basis: "1 night incl. VAT · DEP-STD v2",
      provider: "MTN MoMo",
      providerRef: "MP261012.1031.C77120",
      folioId: "F-5521",
      confirmedAt: "10:46:08",
      lastChecked: "10:44",
      timedOutAt: "10:36",
    },
    attempts: [
      {
        id: "a2",
        title: "Attempt 2 · MTN MoMo",
        phone: "078 ••• 412",
        ref: "MP261012.1031.C77120",
        key: "pi-77142-a2",
        result: null,
      },
      {
        id: "a1",
        title: "Attempt 1 · Airtel Money",
        phone: "073 ••• 118",
        ref: "AM261002.1605.W20433",
        key: "pi-77142-a1",
        result: { label: "Failed", tone: "danger", detail: "Insufficient balance · 2 Oct 16:05" },
      },
    ],
    outcomes: {
      pending: {
        label: "Pending",
        tone: "warning",
        status: "warning",
        icon: "Clock",
        time: "Started 10:31 · last checked 10:44",
        folio: "Nothing posted yet · deposit pending, not applied",
        history: "Pending · waiting for MTN",
      },
      verified: {
        label: "Verified",
        tone: "success",
        status: "success",
        icon: "Check",
        time: "Started 10:31 · confirmed by MTN 10:46:08",
        folio: "Deposit RWF 148,680 applied · balance follows posted nights",
        history: "Verified by MTN at 10:46:08",
      },
      unknown: {
        label: "Unknown",
        tone: "warning",
        status: "warning",
        icon: "CircleQuestion",
        time: "Started 10:31 · timed out 10:36 · checking",
        folio: "Nothing posted yet · deposit outcome unknown",
        history: "Timed out · outcome unknown, checking with MTN",
      },
    },
    policyId: "CXL-STD v3",
    tierToday: 2,
    cancelNote: {
      verified:
        "Arrival is today, so a cancellation now keeps the first night (RWF 148,680), which equals the verified deposit. Refund due: RWF 0.",
      unpaid:
        "Arrival is today, so a cancellation now keeps the first night. No verified payment exists to refund; the open MoMo request would be cancelled with MTN.",
    },
    proforma: { id: "PRO-26-0433", sent: "Sent 3 Oct to Thomas Weber · copy to Rose Uwamahoro", total: 743400 },
    history: [
      {
        id: "h1",
        status: "success",
        icon: "Check",
        title: "Booking created and confirmed",
        detail: "2 Oct 16:02 · requested by Rose Uwamahoro by email, entered by Eric Habimana · terms saved",
      },
      {
        id: "h2",
        status: "danger",
        icon: "Xmark",
        title: "Deposit attempt 1 failed",
        detail: "2 Oct 16:05 · Airtel Money · insufficient balance",
      },
      {
        id: "h3",
        status: "default",
        icon: "Pencil",
        title: "Dates changed",
        detail:
          "3 Oct 09:10 · arrival moved from 13 to 12 Oct, +1 night at the same rate · policy unchanged · Eric Habimana",
      },
      {
        id: "h4",
        status: "default",
        icon: "Envelope",
        title: "Deposit reminder sent",
        detail: "10 Oct 11:30 · email and SMS to Thomas",
      },
      {
        id: "h5",
        status: "default",
        icon: "LayoutCells",
        title: "Room 211 assigned",
        detail: "12 Oct 08:15 · Eric Habimana",
      },
      {
        id: "h6",
        status: "warning",
        icon: "TriangleExclamation",
        title: "Conflict: 211 out of order from 14 Oct",
        detail: "12 Oct 09:58 · bathroom works WO-318 raised by Jean-Paul Niyonsaba",
      },
      {
        id: "h7",
        status: "current",
        icon: "ArrowRightArrowLeft",
        title: "Split stay proposed: 305 from 14 Oct",
        detail: "12 Oct 10:05 · waiting for confirmation in the room rack",
      },
      {
        id: "h8",
        status: "payment",
        icon: "Wallet",
        title: "Deposit attempt 2 · MTN MoMo",
        detail: "12 Oct 10:31",
      },
    ],
  },
];

export const fixtures = {
  "frontdesk.deskKpis": deskKpis,
  "frontdesk.queueTabs": queueTabs,
  "frontdesk.arrivals": arrivals,
  "frontdesk.inHouse": inHouse,
  "frontdesk.departures": departures,
  "frontdesk.guestRequests": guestRequests,
  "frontdesk.readiness": readiness,
  "frontdesk.roomTypes": roomTypes,
  "frontdesk.rooms": deskRooms,
  "frontdesk.checkIns": checkIns,
  "frontdesk.guestMatches": guestMatches,
  "frontdesk.walkInQuotes": walkInQuotes,
  "frontdesk.rackDays": rackDays,
  "frontdesk.rackLanes": rackLanes,
  "frontdesk.roomMoves": roomMoves,
  "frontdesk.reservations": reservations,
  "frontdesk.reservationViews": reservationViews,
  "frontdesk.reservationsSummary": reservationsSummary,
  "frontdesk.bookingRequests": bookingRequests,
  "frontdesk.cancellationTiers": cancellationTiers,
  "frontdesk.reservationRecords": reservationRecords,
} satisfies FixtureSet;
