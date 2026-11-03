/**
 * What the front desk's screens draw: arrivals, departures, reservations, check in, walk ins and the room rack.
 *
 * Declared here since ADR-074 stage 4: the product owns the shapes its views draw, copied verbatim from
 * `@injishi/data/fixtures/frontdesk.ts` with every type they reference. The demo fixtures keep matching
 * declarations for their rows until stage 9, and every page that passes those rows into a view is where the
 * compiler checks the two still agree.
 */
import type { BoardId, IconName, Tone } from "./shared.ts";

/** The name the API gives a booking that names nobody; the desk asks for the name on the ID instead. */
export const UNNAMED_GUEST = "Unnamed guest";

/** Housekeeping status of a room. */
export type RoomStatus = "dirty" | "clean" | "inspected" | "occupied" | "ooo";

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

// The room rack on the property's own records (2026-10-30): the app reads it from the desk's day
// (`GET /ops/front-desk`) and hands the view these shapes.

export type RackBarKind = "inhouse" | "booked" | "tentative" | "departed";
export type RackRoomState = "clean" | "dirty" | "inspected" | "occupied" | "ooo";

export interface RackBar {
  id: string;
  /** Arrival, in days from the rack's first day (an afternoon: n + 0.5). */
  from: number;
  /** Departure, in days from the rack's first day (a morning: n + 0.5). */
  to: number;
  kind: RackBarKind;
  guest: string;
  reference: string | null;
  /** Where pressing the bar goes: the booking in Reservations, or the desk for a walk-in. */
  href: string;
  /** "1 → 3 Nov". */
  dates: string;
}

export interface RackLane {
  id: string;
  kind: "group" | "room" | "unassigned";
  roomTypeId: string;
  /** A room's label; a group's room type; an unassigned lane's guest. */
  label: string;
  /** A group's summary ("4 rooms · sleeps 2"); a room's status in words. */
  meta: string;
  state: RackRoomState | null;
  bars: RackBar[];
  /** Two bars on this room overlap on some night. */
  overlap: boolean;
}

export interface RackDay {
  date: string;
  dow: string;
  day: number;
  month: string;
  /** Rooms of every type with nothing in them that night. */
  free: number;
}

export interface RoomRack {
  property: string;
  today: string;
  days: RackDay[];
  /** Now, in days from the first day (Kigali time). */
  now: number;
  types: { id: string; name: string; rooms: number }[];
  lanes: RackLane[];
  unassigned: number;
  overlaps: number;
  totalRooms: number;
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
  /**
   * Arrival day as a day number the date filters compare: October 2026 in these fixtures, days since
   * 1970-01-01 (Kigali) from the live source, which also sends the day it was read on (`today` below).
   */
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
  /**
   * Real data only: what cancelling at the guest's request would refund now, decided by the server on the
   * booking's own tier. Absent in these fixtures, where the view works it out from `tiers`.
   */
  cancelQuote?: RefundQuote | null;
  /** Real data only: what recording a no-show would refund now, on the booking's tier. */
  noShowQuote?: RefundQuote | null;
  /** Real data only: the day number of today, when the list was read (see `arrivalDay`). */
  today?: number;
}

/** A refund decided by the platform's rule, in whole francs. */
export interface RefundQuote {
  refund: number;
  kept: number;
  rule: string;
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
