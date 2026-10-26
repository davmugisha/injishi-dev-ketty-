/**
 * Live sources for the frontdesk area: the desk's day (`GET /api/v1/ops/front-desk`) presented as the
 * frontdesk fixture document types. One read per request feeds every collection of the board: the
 * server decides "today" once, in Kigali, and every queue is cut from that one snapshot.
 *
 * What is not here stays on fixtures, each with its reason in the data map: the walk-in quote (quote
 * holds have no table; its room types are live), the room rack (group and out-of-order blocks), guest
 * requests (no request workflow on threads), the reservation record (booking parties, terms snapshot,
 * payment history) and the property-named cancellation policy.
 */
import type {
  Arrival,
  BookingRequest,
  CheckInFile,
  CheckInRoom,
  Departure,
  DeskKpi,
  DeskRoom,
  InHouseStay,
  QueueTab,
  ReadinessRoom,
  Reservation,
  RoomStatus,
  RoomType,
  Tone,
} from "@injishi/data/fixtures/frontdesk";
import { clock, dayMonth, dayMonthYear, kigaliDate, rwf } from "../format";
import { defineSources, type SourceContext } from "./types";

// ── The API's shapes (FrontDeskBoard in @injishi/contracts) ──────────────────

export type ApiChannel =
  | "marketplace"
  | "direct"
  | "phone"
  | "travel_agent"
  | "corporate"
  | "channel_manager"
  | "walk_in";

export interface ApiFolio {
  id: string;
  folioNumber: string;
  status: "open" | "settled" | "closed" | "disputed";
  balanceRwf: number | null;
  lockedAt: string | null;
}

export interface ApiQuote {
  refundRwf: number;
  keptRwf: number;
  rule: string;
}

export interface ApiBooking {
  id: string;
  reference: string;
  guestName: string | null;
  guestPhone: string | null;
  checkIn: string;
  checkOut: string;
  nights: number;
  guestCount: number;
  adults: number | null;
  children: number | null;
  roomTypeId: string;
  roomTypeName: string;
  status: "pending_approval" | "confirmed" | "declined" | "cancelled" | "no_show";
  state: "pending" | "confirmed" | "inhouse" | "checked_out" | "declined" | "cancelled" | "no_show";
  bookingMode: "instant_book" | "request_to_book";
  cancellationTier: string | null;
  channel: ApiChannel | null;
  eta: string | null;
  deskNote: string | null;
  totalRwf: number;
  lockedNightlyRateRwf: number;
  paidRwf: number;
  paymentStatus: "captured" | "refunded_full" | "refunded_partial" | "forfeited" | "paid_out" | null;
  approvalExpiresAt: string | null;
  createdAt: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  refundRwf: number | null;
  noShowAt: string | null;
  noShowReason: string | null;
  holds: { roomId: string; roomLabel: string | null; from: string; to: string }[];
  preArrivalIdentity: boolean;
  stay: { id: string; reference: string | null; lifecycle: "open" | "closed"; roomLabel: string | null } | null;
  folio: ApiFolio | null;
  guestMessage: string | null;
  cancellation: ApiQuote | null;
  noShow: ApiQuote | null;
}

export interface ApiStay {
  id: string;
  reference: string | null;
  bookingId: string | null;
  bookingReference: string | null;
  guestName: string | null;
  roomId: string;
  roomLabel: string | null;
  roomTypeName: string;
  lifecycle: "open" | "closed";
  entryAt: string;
  plannedExitAt: string | null;
  actualExitAt: string | null;
  channel: ApiChannel | null;
  checkIn: string | null;
  checkOut: string | null;
  deskNote: string | null;
  departureNote: string | null;
  priceRwf: number | null;
  folio: ApiFolio | null;
}

export interface ApiRoom {
  id: string;
  label: string | null;
  roomTypeId: string;
  roomTypeName: string;
  status: "available" | "maintenance" | "out_of_service";
  housekeeping: "clean" | "dirty" | "inspected" | "out_of_order";
  housekeepingUpdatedAt: string | null;
  occupant: { stayId: string; guestName: string | null; plannedExitAt: string | null } | null;
  heldTonightBy: { bookingId: string; reference: string; guestName: string | null } | null;
}

/** FrontDeskRoomType: a type of room at the property, with what is left of it tonight. */
export interface ApiRoomType {
  id: string;
  name: string;
  sleeps: number;
  rateRwf: number | null;
  beds: string | null;
  active: boolean;
  roomCount: number;
  freeTonight: number;
}

export interface ApiBoard {
  property: { id: string; name: string; checkInTime: string | null; checkOutTime: string | null };
  today: string;
  generatedAt: string;
  canReadBills: boolean;
  bookings: ApiBooking[];
  stays: ApiStay[];
  rooms: ApiRoom[];
  roomTypes: ApiRoomType[];
}

const boards = new WeakMap<SourceContext, Promise<ApiBoard>>();

/**
 * The desk's day, read once per request context (every collection of a page shares it). A write
 * through the same context forgets it (`forgetDeskBoard`), so the next read sees the change.
 */
export function deskBoard(ctx: SourceContext): Promise<ApiBoard> {
  let board = boards.get(ctx);
  if (!board) {
    board = ctx.ops().get<ApiBoard>("/api/v1/ops/front-desk");
    boards.set(ctx, board);
    // A failed read is not cached: the next caller asks again.
    board.catch(() => boards.delete(ctx));
  }
  return board;
}

/** Drop the remembered day after a write, so the next read through this context is fresh. */
export function forgetDeskBoard(ctx: SourceContext): void {
  boards.delete(ctx);
}

/**
 * The name of the property the desk's day is read for, as the API returns it: the desk screens head
 * themselves with it instead of a property named in the prototype. Read after the page's collections,
 * it is the same read (one board per request context).
 */
export async function deskPropertyName(ctx: SourceContext): Promise<string> {
  return (await deskBoard(ctx)).property.name;
}

/**
 * What the guest paid online with the booking, in the desk's words: the escrow the API reports
 * (`paidRwf`, by `paymentStatus`), never assumed. "Nothing paid online" when no payment was taken.
 */
function onlinePayment(b: Pick<ApiBooking, "paidRwf" | "totalRwf" | "paymentStatus">): string {
  if (b.paidRwf <= 0) return "nothing paid online";
  const what = b.paidRwf >= b.totalRwf ? `${rwf(b.paidRwf)} paid online in full` : `${rwf(b.paidRwf)} paid online`;
  if (b.paymentStatus === "paid_out") return `${what} · paid out to the business`;
  if (b.paymentStatus === "forfeited") return `${what} · kept under the booking's policy`;
  return `${what} · held by Injishi until the stay`;
}

// ── Words and numbers ────────────────────────────────────────────────────────

const CHANNEL: Record<ApiChannel, string> = {
  marketplace: "Marketplace",
  direct: "Direct",
  phone: "Phone",
  travel_agent: "Travel agent",
  corporate: "Corporate",
  channel_manager: "Channel manager",
  walk_in: "Walk-in",
};

export const channelOf = (c: ApiChannel | null | undefined): string => CHANNEL[c ?? "marketplace"];

export const nameOf = (n: string | null | undefined): string => n?.trim() || "Unnamed guest";

export function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase() || "?";
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "12 → 14 Oct", or "30 Oct → 2 Nov" across a month. */
export function span(from: string, to: string): string {
  const a = dayMonth(from);
  const b = dayMonth(to);
  return a.split(" ")[1] === b.split(" ")[1] ? `${a.split(" ")[0]} → ${b}` : `${a} → ${b}`;
}

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const weekday = (iso: string) => WEEKDAY[new Date(`${iso}T12:00:00Z`).getUTCDay()];

/** Whole days from `a` to `b` (YYYY-MM-DD). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
}

/** Days since 1970-01-01 of a Kigali calendar day: the day number the reservation filters compare. */
export const dayNumber = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);

function guestsLabel(b: Pick<ApiBooking, "adults" | "children" | "guestCount">): string {
  const adults = b.adults ?? b.guestCount;
  const kids = b.children ?? 0;
  return kids ? `${plural(adults, "adult")}, ${plural(kids, "child", "children")}` : plural(adults, "adult");
}

/** The room a booking holds tonight, if any. */
function holdTonight(b: ApiBooking, today: string) {
  return b.holds.find((h) => h.from <= today && today < h.to) ?? null;
}

/** "Jean Bosco Nkurunziza" → "Jean Bosco N." (a name of three words or more keeps the readiness tile short). */
export function shortName(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return parts.length >= 3 ? `${parts.slice(0, -1).join(" ")} ${parts.at(-1)?.[0]}.` : name;
}

/** Is the guest staying past today (or open-ended)? */
export function continuing(stay: ApiStay, today: string): boolean {
  return stay.lifecycle === "open" && (!stay.plannedExitAt || kigaliDate(stay.plannedExitAt) > today);
}

/** The interface's room status for the desk: out of order, someone still in it, else the housekeeping state. */
export function roomStatus(room: ApiRoom): RoomStatus {
  if (room.status !== "available" || room.housekeeping === "out_of_order") return "ooo";
  if (room.occupant) return "occupied";
  return room.housekeeping;
}

const STATUS_LABEL: Record<RoomStatus, string> = {
  dirty: "Dirty",
  clean: "Clean",
  inspected: "Inspected",
  occupied: "Occupied",
  ooo: "Out of order",
};

/** "Inspected 09:05", "Dirty · Ingrid Solberg left 08:50", "Occupied · leaves 11:00". */
function roomNote(room: ApiRoom, today: string, board: ApiBoard): string {
  const status = roomStatus(room);
  if (status === "ooo") return room.status === "out_of_service" ? "Out of service" : "Out of order";
  if (status === "occupied") {
    const exit = room.occupant?.plannedExitAt;
    const name = nameOf(room.occupant?.guestName);
    return exit && kigaliDate(exit) === today ? `${name} leaving ${clock(exit)}` : `${name} in house`;
  }
  const held = room.heldTonightBy;
  if (held) return `Held for ${nameOf(held.guestName)} · ${held.reference}`;
  const left = board.stays.find((s) => s.roomId === room.id && s.actualExitAt && kigaliDate(s.actualExitAt) === today);
  if (status === "dirty")
    return left ? `Checkout clean due · ${nameOf(left.guestName)} left ${clock(left.actualExitAt)}` : "To clean";
  if (status === "clean") return "Clean · awaiting inspection";
  return room.housekeepingUpdatedAt ? `Inspected ${clock(room.housekeepingUpdatedAt)}` : "Inspected";
}

/** Today's arrivals not yet checked in, the next expected first (no ETA last). */
function arrivalsOf(board: ApiBoard): ApiBooking[] {
  return board.bookings
    .filter((b) => b.state === "confirmed" && b.checkIn === board.today)
    .sort(
      (a, b) =>
        (a.eta ?? "99:99").localeCompare(b.eta ?? "99:99") || nameOf(a.guestName).localeCompare(nameOf(b.guestName)),
    );
}

function balanceOfArrival(b: ApiBooking): { balance: number; note: string; flag: boolean } {
  const due = Math.max(0, b.totalRwf - b.paidRwf);
  if (due === 0) return { balance: 0, note: b.paidRwf > 0 ? "Prepaid · verified" : "Nothing due", flag: false };
  if (b.paidRwf > 0) return { balance: due, note: "Deposit verified · balance due", flag: true };
  return { balance: due, note: "Pays on arrival", flag: true };
}

/** The room label an arrival row shows when the plain status is not enough: still occupied, or not cleaned. */
function roomStateLabel(room: ApiRoom | undefined): string | null {
  if (!room) return null;
  const status = roomStatus(room);
  if (status === "occupied" && room.occupant?.plannedExitAt)
    return `Occupied · leaves ${clock(room.occupant.plannedExitAt)}`;
  if (status === "dirty") return "Dirty · to clean";
  return null;
}

// ── Today ────────────────────────────────────────────────────────────────────

function presentArrival(b: ApiBooking, board: ApiBoard, atDesk: boolean): Arrival {
  const hold = holdTonight(b, board.today);
  const room = hold ? board.rooms.find((r) => r.id === hold.roomId) : undefined;
  const money = balanceOfArrival(b);
  return {
    id: b.id,
    name: nameOf(b.guestName),
    bookingId: b.reference,
    nights: b.nights,
    source: channelOf(b.channel),
    roomType: b.roomTypeName,
    room: hold?.roomLabel ?? null,
    roomStatus: room ? roomStatus(room) : null,
    roomStatusLabel: roomStateLabel(room),
    idStatus: b.preArrivalIdentity ? "received" : "missing",
    balance: money.balance,
    balanceNote: money.note,
    balanceFlag: money.flag,
    // Nobody records who is standing at the desk: the next guest expected is marked, by their own ETA.
    eta: b.eta ?? "Today",
    note: b.deskNote ?? "",
    atDesk,
  };
}

function leavingLabel(stay: ApiStay, today: string): string {
  if (!stay.plannedExitAt) return "Open-ended";
  const day = kigaliDate(stay.plannedExitAt);
  return daysBetween(today, day) === 1 ? "Leaves tomorrow" : `Leaves ${dayMonth(day)}`;
}

function inHouseOf(board: ApiBoard): ApiStay[] {
  return board.stays
    .filter((s) => continuing(s, board.today))
    .sort(
      (a, b) =>
        (a.plannedExitAt ?? "9999").localeCompare(b.plannedExitAt ?? "9999") ||
        (a.roomLabel ?? "").localeCompare(b.roomLabel ?? "", undefined, { numeric: true }),
    );
}

function presentInHouse(s: ApiStay, board: ApiBoard): InHouseStay {
  const entered = kigaliDate(s.entryAt);
  const of =
    s.checkIn && s.checkOut
      ? daysBetween(s.checkIn, s.checkOut)
      : s.plannedExitAt
        ? daysBetween(entered, kigaliDate(s.plannedExitAt))
        : 1;
  return {
    id: s.id,
    name: nameOf(s.guestName),
    bookingId: s.bookingReference ?? "Walk-in",
    night: Math.min(Math.max(1, of), daysBetween(entered, board.today) + 1),
    of: Math.max(1, of),
    source: s.bookingId ? channelOf(s.channel) : "Walk-in",
    room: s.roomLabel ?? "",
    stayId: s.reference ?? s.id.slice(0, 8),
    balance: s.folio?.balanceRwf ?? 0,
    folioId: s.folio?.folioNumber ?? "None",
    leaving: leavingLabel(s, board.today),
    note: s.deskNote ?? "",
  };
}

/**
 * The order the desk deals with guests who are leaving: whoever is due out first, and at the same
 * hour whoever still owes money first, then by stay reference so two reads never disagree. Today's
 * Departures and the Checkout screen share it, so the first open row on Today is the guest Checkout
 * opens on.
 */
function departureOrder(a: ApiStay, b: ApiStay): number {
  const owes = (s: ApiStay) => ((s.folio?.balanceRwf ?? 0) > 0 ? 0 : 1);
  return (
    (a.plannedExitAt ?? "9999").localeCompare(b.plannedExitAt ?? "9999") ||
    owes(a) - owes(b) ||
    (a.reference ?? a.id).localeCompare(b.reference ?? b.id)
  );
}

/** The guest the Checkout screen opens on: the next one due out (today's first, else the next day's). */
export function nextDeparture(board: ApiBoard): ApiStay | null {
  return board.stays.filter((s) => s.lifecycle === "open").sort(departureOrder)[0] ?? null;
}

/** Everyone leaving today: still in the building (due or late) and already out. */
function departuresOf(board: ApiBoard): ApiStay[] {
  const today = board.today;
  const leaving = board.stays.filter(
    (s) =>
      (s.lifecycle === "open" && s.plannedExitAt && kigaliDate(s.plannedExitAt) <= today) ||
      (s.lifecycle === "closed" && s.actualExitAt && kigaliDate(s.actualExitAt) === today),
  );
  return leaving.sort((a, b) =>
    a.lifecycle === b.lifecycle
      ? a.lifecycle === "open"
        ? departureOrder(a, b)
        : (a.actualExitAt ?? "").localeCompare(b.actualExitAt ?? "")
      : a.lifecycle === "open"
        ? -1
        : 1,
  );
}

/** Is the guest due out after the property's own check-out time? Never "late" when the property states none. */
function lateCheckout(s: ApiStay, board: ApiBoard): boolean {
  const checkout = board.property.checkOutTime;
  return !!checkout && !!s.plannedExitAt && clock(s.plannedExitAt) > checkout;
}

function presentDeparture(s: ApiStay, board: ApiBoard): Departure {
  const nights =
    s.checkIn && s.checkOut ? daysBetween(s.checkIn, s.checkOut) : daysBetween(kigaliDate(s.entryAt), board.today);
  const base = {
    id: s.id,
    name: nameOf(s.guestName),
    bookingId: s.bookingReference ?? "Walk-in",
    nights: Math.max(1, nights),
    source: s.bookingId ? channelOf(s.channel) : "Walk-in",
    room: s.roomLabel ?? "",
  };
  if (s.lifecycle === "closed") {
    const signed = s.folio?.status === "closed";
    return {
      ...base,
      checkout: signed ? "out" : "fiscal",
      checkoutLabel: `Out ${clock(s.actualExitAt)}`,
      balance: s.folio?.balanceRwf ?? 0,
      balanceNote: signed ? "Bill closed" : "Bill still open · close it on the folio",
      time: clock(s.actualExitAt),
      note: s.departureNote ?? s.deskNote ?? "",
    };
  }
  const time = clock(s.plannedExitAt);
  const late = lateCheckout(s, board);
  const balance = s.folio?.balanceRwf ?? 0;
  return {
    ...base,
    checkout: late ? "late" : "due",
    checkoutLabel: late ? `Late · ${time}` : `Due ${time}`,
    balance,
    // A role that may not read bills gets no balance from the API: never call that "Settled".
    balanceNote:
      s.folio && s.folio.balanceRwf === null
        ? "Bill not shown to your role"
        : balance > 0
          ? "To settle at checkout"
          : balance < 0
            ? "In credit"
            : "Settled",
    time,
    note: s.deskNote ?? "",
  };
}

function presentReadiness(board: ApiBoard): ReadinessRoom[] {
  const out: ReadinessRoom[] = [];
  for (const b of arrivalsOf(board)) {
    const hold = holdTonight(b, board.today);
    const room = hold ? board.rooms.find((r) => r.id === hold.roomId) : undefined;
    if (!hold || !room) continue;
    const status = roomStatus(room);
    out.push({
      id: hold.roomLabel ?? room.id,
      room: hold.roomLabel ?? "",
      status,
      label: roomStateLabel(room) ?? STATUS_LABEL[status],
      guest: shortName(nameOf(b.guestName)),
    });
  }
  return out;
}

const READY = new Set<RoomStatus>(["clean", "inspected"]);

function presentKpis(board: ApiBoard): DeskKpi[] {
  const today = board.today;
  const arrivals = arrivalsOf(board);
  const arrivedToday = board.stays.filter((s) => s.bookingId && kigaliDate(s.entryAt) === today);
  const inHouse = board.stays.filter((s) => s.lifecycle === "open");
  const guestsIn = inHouse.reduce((n, s) => n + (board.bookings.find((b) => b.id === s.bookingId)?.guestCount ?? 1), 0);
  const departures = departuresOf(board);
  const out = departures.filter((s) => s.lifecycle === "closed").length;
  const late = departures.filter((s) => s.lifecycle === "open" && lateCheckout(s, board)).length;
  const readiness = presentReadiness(board);
  const ready = readiness.filter((r) => READY.has(r.status)).length;
  const cleaning = readiness.filter((r) => r.status === "dirty").length;
  const unassigned = arrivals.filter((b) => !holdTonight(b, today)).length;
  const next = arrivals[0];
  return [
    {
      id: "arrivals",
      label: "Arrivals",
      value: arrivedToday.length,
      total: arrivedToday.length + arrivals.length,
      foot: next ? `Checked in · next is ${nameOf(next.guestName)}` : "Checked in · nobody left to arrive",
      icon: "ArrowRightToSquare",
      status: "default",
    },
    {
      id: "inHouse",
      label: "In house",
      value: guestsIn,
      total: null,
      foot: `Guests in ${inHouse.length} of ${board.rooms.length} rooms`,
      icon: "House",
      status: "default",
    },
    {
      id: "departures",
      label: "Departures",
      value: out,
      total: departures.length,
      foot: `Checked out · ${plural(late, "late checkout")}`,
      icon: "ArrowRightFromSquare",
      status: "default",
    },
    {
      id: "roomsReady",
      label: "Arrival rooms ready",
      value: ready,
      total: readiness.length,
      foot: `${cleaning} being cleaned · ${plural(unassigned, "arrival")} unassigned`,
      icon: "BroomMotion",
      status: ready < readiness.length || unassigned > 0 ? "warning" : "default",
    },
    {
      // Guest requests are not on the desk yet (frontdesk.guestRequests is deferred): there is no count to
      // give, so the view shows none (never the sample queue's length) and this foot says why.
      id: "requests",
      label: "Open requests",
      value: 0,
      total: null,
      foot: "Not available yet · guest requests are not connected to the desk",
      icon: "Comments",
      status: "default",
    },
  ];
}

function presentTabs(board: ApiBoard): QueueTab[] {
  const arrivals = arrivalsOf(board);
  const arrivedToday = board.stays.filter((s) => s.bookingId && kigaliDate(s.entryAt) === board.today).length;
  const inHouse = inHouseOf(board);
  const departures = departuresOf(board);
  const out = departures.filter((s) => s.lifecycle === "closed").length;
  return [
    {
      id: "arrivals",
      label: "Arrivals",
      count: arrivals.length + arrivedToday,
      tableLabel: "Arrivals today",
      foot: `${arrivals.length} still to arrive · ${arrivedToday} checked in earlier today (hidden) · balances come from the folio or the booking deposit only`,
    },
    {
      id: "inHouse",
      label: "In-house",
      count: inHouse.length,
      tableLabel: "Guests in house",
      foot: `Showing ${plural(inHouse.length, "in-house stay")} · sorted by departure date · guests leaving today are under Departures`,
    },
    {
      id: "departures",
      label: "Departures",
      count: departures.length,
      tableLabel: "Departures today",
      foot: `Showing ${plural(departures.length, "departure")} · ${out} checked out · a checkout waits for the fiscal receipt, not the other way round`,
    },
  ];
}

/** Every room nobody stays in tonight: what the desk can still give an arrival or a walk-in. */
function presentRooms(board: ApiBoard): DeskRoom[] {
  const continuingRooms = new Set(board.stays.filter((s) => continuing(s, board.today)).map((s) => s.roomId));
  return board.rooms
    .filter((r) => !continuingRooms.has(r.id))
    .map((r) => {
      // A room held for somebody tonight cannot be given to anybody else: shown, but never ready.
      const held = r.heldTonightBy && roomStatus(r) !== "ooo";
      return {
        id: r.label ?? r.id,
        room: r.label ?? "",
        roomType: r.roomTypeName,
        status: held ? "occupied" : roomStatus(r),
        note: roomNote(r, board.today, board),
      };
    });
}

/**
 * The room types the desk sells, with what is left tonight (Today's quick walk-in panel and the
 * walk-in screen). `id` is the type's own id: the walk-in names it when it opens the stay. The
 * prototype keyed types by slugs ("queen", "dlv") the database does not have; nothing reads them
 * as slugs once the quote's sample conflict is gone.
 */
function presentRoomTypes(board: ApiBoard): RoomType[] {
  return board.roomTypes
    .filter((t) => t.active)
    .map((t) => ({
      id: t.id as RoomType["id"],
      name: t.name,
      beds: t.beds ?? "",
      sleeps: t.sleeps,
      rate: t.rateRwf ?? 0,
      left: t.freeTonight,
      free: t.freeTonight,
      soldNote: t.freeTonight === 0 ? "Full tonight" : null,
    }));
}

// ── Check-in ─────────────────────────────────────────────────────────────────

/** A check-in file for one of today's arrivals (or one checked in today). */
async function presentCheckIn(ctx: SourceContext, b: ApiBooking, board: ApiBoard): Promise<CheckInFile> {
  const today = board.today;
  const name = nameOf(b.guestName);
  const first = name.split(" ")[0] ?? name;
  const hold = holdTonight(b, today);
  const stay = b.stay ? board.stays.find((s) => s.id === b.stay?.id) : undefined;
  const ofType = board.rooms.filter((r) => r.roomTypeId === b.roomTypeId);
  const continuingRooms = new Set(board.stays.filter((s) => continuing(s, today)).map((s) => s.roomId));
  const options: CheckInRoom[] = ofType
    .filter((r) => r.id === hold?.roomId || !continuingRooms.has(r.id))
    .map((r) => {
      const heldForOther = r.heldTonightBy && r.heldTonightBy.bookingId !== b.id;
      const status: RoomStatus = heldForOther ? "occupied" : roomStatus(r);
      const note = r.id === hold?.roomId ? `Pre-assigned · ${roomNote(r, today, board)}` : roomNote(r, today, board);
      return { id: r.label ?? r.id, room: r.label ?? "", status, note };
    })
    .sort((a, b2) => a.room.localeCompare(b2.room, undefined, { numeric: true }));
  const ready = options.filter((o) => READY.has(o.status));
  const preAssigned = hold?.roomLabel ?? "";
  const preReady = options.find((o) => o.room === preAssigned && READY.has(o.status));
  const due = Math.max(0, b.totalRwf - b.paidRwf);
  const phone = b.guestPhone ?? "";
  let claimCode = "";
  if (stay) {
    try {
      const invite = await ctx.ops().get<{ claimCode: string | null }>(`/api/v1/ops/stays/${stay.id}/claim-invite`);
      claimCode = invite.claimCode ?? "";
    } catch {
      claimCode = "";
    }
  }
  const booker = b.channel === "travel_agent" || b.channel === "corporate";
  return {
    id: b.reference,
    guest: name,
    firstName: first,
    initials: initialsOf(name),
    roomType: b.roomTypeName,
    dates: `${weekday(b.checkIn)} ${dayMonth(b.checkIn).split(" ")[0]} → ${weekday(b.checkOut)} ${dayMonth(b.checkOut)}`,
    nights: b.nights,
    adults: b.adults ?? b.guestCount,
    bookedBy: booker ? channelOf(b.channel) : "The guest",
    lockedSince: clock(board.generatedAt),
    bookingStatus: stay ? "Checked in" : "Booking confirmed",
    facts: [
      { label: "Dates", value: `${span(b.checkIn, b.checkOut)} · ${plural(b.nights, "night")}` },
      { label: "Room type", value: b.roomTypeName },
      { label: "Guests", value: guestsLabel(b) },
      { label: "Booked by", value: booker ? channelOf(b.channel) : `${name} · ${channelOf(b.channel)}` },
      { label: "Stay total", value: `${rwf(b.totalRwf)} · ${onlinePayment(b).split(" · ")[0]}` },
      {
        label: "Terms",
        value: `${b.bookingMode === "request_to_book" ? "Request to book" : "Instant booking"} · ${(b.cancellationTier ?? "flexible").replace(/_/g, " ")} cancellation`,
      },
    ],
    requests: b.deskNote ? [b.deskNote] : [],
    primaryRoles: ["Primary occupant", "Payer"],
    primaryDocument: b.preArrivalIdentity
      ? [
          { label: "Document", value: "Sent from the guest app before arrival" },
          { label: "Received", value: "Not yet compared in person" },
        ]
      : [{ label: "Document", value: "Not received · check it at the desk" }],
    occupant: {
      name: (b.adults ?? b.guestCount) > 1 ? "Second guest" : "No second guest",
      initials: "+",
      documentTypes: ["Passport", "National ID", "Driving licence"],
      scannedNumber: "",
      scannedAt: "",
    },
    // Guest profiles per business do not exist yet (stays.directory is deferred), so there is no match to review.
    duplicate: { existingId: "", cards: [] },
    parties: [
      {
        id: "guest",
        icon: "Person",
        name,
        desc: `Primary occupant · ${b.paidRwf > 0 ? "paid online when booking" : "pays at the desk"}`,
        role: "Occupant · Payer",
        tone: "accent",
      },
      ...(booker
        ? [
            {
              id: "booker",
              icon: "Briefcase" as const,
              name: channelOf(b.channel),
              desc: "Made the booking · not staying",
              role: "Booker",
              tone: "info" as Tone,
            },
          ]
        : []),
    ],
    // A guest already checked in is in the stay's room, which may not be the one held for the booking.
    preAssignedRoom: stay?.roomLabel ?? preAssigned,
    defaultRoom: preReady?.room ?? ready[0]?.room ?? preAssigned,
    rooms: options,
    override: {
      reasons: ["Guest insists on the booked room", "Accessibility need", "Loyalty or VIP commitment"],
      approvers: ["Duty manager", "Owner"],
      // The person writes the note; nothing is claimed for the guest.
      note: "",
      sentAt: "",
    },
    deposit: {
      amount: due,
      policy: due > 0 ? "Balance due at check-in" : b.paidRwf > 0 ? "Paid online when booked" : "Nothing due",
      voucher: b.reference,
      stayTotal: b.totalRwf,
      phone,
      phoneMasked: phone ? `${phone.slice(0, 8)} ••• ${phone.slice(-3)}` : "",
      cashReceived: due,
      till: "Desk till",
      sentAt: "",
      confirmedAt: "",
    },
    methods: [
      {
        id: "momo",
        icon: "Smartphone",
        label: "Mobile money",
        note: "A prompt from the desk to the guest's phone is not connected yet",
        disabled: true,
      },
      { id: "card", icon: "CreditCard", label: "Card", note: "No card terminal is connected", disabled: true },
      {
        id: "cash",
        icon: "Wallet",
        label: "Cash",
        note: "Recorded on the bill when the guest is checked in",
        disabled: false,
      },
      {
        id: "later",
        icon: "Clock",
        label: "Pay at checkout",
        note: "Collected from the bill at checkout",
        disabled: false,
      },
    ],
    networks: [
      { id: "MTN", label: "MTN MoMo", ref: "" },
      { id: "Airtel", label: "Airtel Money", ref: "" },
    ],
    stayId: stay?.reference ?? "",
    folioId: stay?.folio?.folioNumber ?? b.folio?.folioNumber ?? "",
    depositId: b.reference,
    claimCode,
    checkedInAt: stay ? clock(stay.entryAt) : "",
    documents: [
      {
        id: "rc",
        icon: "FileText",
        title: `Registration card · ${b.reference}`,
        // The card is printed for the guest to sign; the stay records an ID only when the guest sent one ahead.
        desc: `${name} · ${b.preArrivalIdentity ? "ID sent from the guest app before arrival" : "print it for the guest to sign"}`,
        chip: stay ? "Print to sign" : "At check-in",
        tone: "default",
        printable: !!stay,
      },
      {
        id: "pro",
        icon: "File",
        title: "Booking confirmation",
        // What the booking's own payment says, never "paid online" for a booking nobody paid.
        desc: `${rwf(b.totalRwf)} · ${onlinePayment(b).split(" · ")[0]} · not a tax invoice or receipt`,
        chip: "Confirmation",
        tone: "default",
        printable: true,
      },
      {
        id: "ebm",
        icon: "FileCheck",
        title: "EBM fiscal receipt",
        desc: "Issued when the bill is settled and closed at checkout",
        chip: "Not issued yet",
        tone: "default",
        printable: false,
      },
    ],
  };
}

/** Today's bookings a check-in can open: still to arrive, or checked in today. */
function checkInCandidates(board: ApiBoard): ApiBooking[] {
  return board.bookings.filter(
    (b) =>
      b.checkIn === board.today &&
      (b.state === "confirmed" ||
        (b.state === "inhouse" &&
          board.stays.some((s) => s.id === b.stay?.id && kigaliDate(s.entryAt) === board.today))),
  );
}

// ── Reservations ─────────────────────────────────────────────────────────────

function kindOf(b: ApiBooking, today: string): Reservation["kind"] {
  if (b.state === "pending") return "request";
  if (b.state === "cancelled" || b.state === "no_show") return "cancelled";
  if (b.state === "inhouse") return "inhouse";
  if (b.checkIn < today) return "noshow";
  return b.checkIn === today ? "today" : "future";
}

function decideBy(at: string | null, today: string): string {
  if (!at) return "Waiting for a decision";
  return kigaliDate(at) === today ? `Decide by ${clock(at)}` : `Decide by ${dayMonth(at)} ${clock(at)}`;
}

function presentReservation(b: ApiBooking, board: ApiBoard, atDesk: string | null): Reservation {
  const today = board.today;
  const name = nameOf(b.guestName);
  const kind = kindOf(b, today);
  const stay = b.stay ? board.stays.find((s) => s.id === b.stay?.id) : undefined;
  const rooms = [...new Set(b.holds.map((h) => h.roomLabel).filter(Boolean))] as string[];
  const room = rooms.length ? rooms.join(" → ") : (b.stay?.roomLabel ?? null);
  const folio = stay?.folio ?? b.folio;
  const balance = folio?.balanceRwf ?? 0;

  let status = "Confirmed";
  let statusTone: Tone = "success";
  let stayText = "";
  let payment = "";
  let paymentTone: Tone = "default";
  let paymentDetail = "";
  let info: string | null = null;

  // The booking's own payment (escrow and its status), never "paid online" for a booking nobody paid.
  const paidDetail = onlinePayment(b).replace(/^./, (c) => c.toUpperCase());
  switch (kind) {
    case "request":
      status = "Requested";
      statusTone = "warning";
      stayText = decideBy(b.approvalExpiresAt, today);
      payment = b.paidRwf > 0 ? "Payment held" : "No payment taken";
      paymentDetail =
        b.paidRwf > 0
          ? `${rwf(b.paidRwf)} held until the request is answered; declined, it goes back in full`
          : "No payment was taken with the request";
      break;
    case "cancelled":
      if (b.state === "no_show") {
        status = "No-show";
        statusTone = "danger";
        stayText = b.noShowAt ? `No-show recorded ${dayMonth(b.noShowAt)}` : "No-show";
        payment = (b.refundRwf ?? 0) > 0 ? "Part refunded" : "Kept under policy";
        paymentDetail = `${rwf(Math.max(0, b.paidRwf))} kept · ${rwf(b.refundRwf ?? 0)} refunded`;
        info = `Recorded as a no-show${b.noShowAt ? ` ${dayMonth(b.noShowAt)}` : ""}${b.noShowReason ? ` · ${b.noShowReason}` : ""}.`;
      } else {
        status = "Cancelled";
        statusTone = "default";
        stayText = b.cancelledAt ? `Cancelled ${dayMonth(b.cancelledAt)}` : "Cancelled";
        payment = (b.refundRwf ?? 0) > 0 ? "Refunded" : "Nothing refunded";
        paymentTone = (b.refundRwf ?? 0) > 0 ? "success" : "default";
        paymentDetail =
          (b.refundRwf ?? 0) > 0 ? `Refund ${rwf(b.refundRwf ?? 0)} to the wallet the guest paid from` : "No refund";
        info = `Cancelled by the ${b.cancelledBy === "host" ? "property" : "guest"}${b.cancelledAt ? ` on ${dayMonth(b.cancelledAt)}` : ""}. ${
          (b.refundRwf ?? 0) > 0
            ? `${rwf(b.refundRwf ?? 0)} went back to the guest.`
            : "Nothing went back to the guest."
        }`;
      }
      break;
    case "inhouse": {
      const leavesToday = stay?.plannedExitAt && kigaliDate(stay.plannedExitAt) === today;
      stayText = leavesToday ? `Due out ${clock(stay?.plannedExitAt)}` : `In house · ${b.stay?.reference ?? ""}`.trim();
      payment = balance > 0 ? "To settle" : balance < 0 ? "In credit" : "Settled";
      paymentTone = balance > 0 ? "warning" : balance === 0 ? "success" : "default";
      paymentDetail = folio ? `Folio ${folio.folioNumber} ${folio.status} · balance ${rwf(balance)}` : paidDetail;
      info = `${name.split(" ")[0]} is in house. Extensions, moves and early departures are made on the stay, not by cancelling the booking.`;
      break;
    }
    case "noshow":
      status = "Not arrived";
      statusTone = "danger";
      stayText = "No stay opened";
      payment = b.paidRwf <= 0 ? "Nothing paid" : b.paidRwf >= b.totalRwf ? "Prepaid · verified" : "Deposit verified";
      paymentTone = b.paidRwf > 0 ? "success" : "warning";
      paymentDetail = paidDetail;
      break;
    default: {
      stayText =
        kind === "today"
          ? b.id === atDesk
            ? `Expected ${b.eta ?? "today"} · next`
            : `Expected ${b.eta ?? "today"}`
          : `Expected ${dayMonth(b.checkIn)}`;
      const due = Math.max(0, b.totalRwf - b.paidRwf);
      payment =
        due === 0
          ? b.paidRwf > 0
            ? "Prepaid · verified"
            : "Nothing due"
          : b.paidRwf > 0
            ? "Deposit verified"
            : "Pays on arrival";
      paymentTone = due === 0 || b.paidRwf > 0 ? "success" : "warning";
      paymentDetail = due === 0 ? paidDetail : `${rwf(due)} due at check-in · ${onlinePayment(b)}`;
    }
  }

  const quote = (q: ApiQuote | null) => (q ? { refund: q.refundRwf, kept: q.keptRwf, rule: q.rule } : null);
  return {
    id: b.reference,
    guest: name,
    initials: initialsOf(name),
    dates: span(b.checkIn, b.checkOut),
    nights: b.nights,
    roomType: b.roomTypeName,
    room,
    channel: channelOf(b.channel),
    status,
    statusTone,
    stay: stayText,
    payment,
    paymentTone,
    arrivalDay: dayNumber(b.checkIn),
    kind,
    guests: guestsLabel(b),
    deposit: b.paidRwf,
    firstNight: b.lockedNightlyRateRwf,
    paymentDetail,
    info,
    phone: b.guestPhone,
    change: { arrival: dayMonthYear(b.checkIn), departure: dayMonthYear(b.checkOut) },
    cancelQuote: quote(b.cancellation),
    noShowQuote: quote(b.noShow),
    today: dayNumber(today),
  };
}

/** "1 h 12 min", "22 h", "1 day 11 h". */
function timeLeft(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return min % 60 && h < 3 ? `${h} h ${min % 60} min` : `${h} h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${plural(d, "day")} ${h % 24} h` : plural(d, "day");
}

const WINDOW_MS = 24 * 60 * 60 * 1000;

function presentRequest(b: ApiBooking, board: ApiBoard): BookingRequest {
  const name = nameOf(b.guestName);
  const now = Date.parse(board.generatedAt);
  const expires = b.approvalExpiresAt ? Date.parse(b.approvalExpiresAt) : now;
  const left = expires - now;
  const expiresDay = b.approvalExpiresAt ? kigaliDate(b.approvalExpiresAt) : board.today;
  return {
    id: b.reference,
    initials: initialsOf(name),
    name,
    channel: `${channelOf(b.channel)} · request to book`,
    dates: `${weekday(b.checkIn)} ${dayMonth(b.checkIn).split(" ")[0]} → ${weekday(b.checkOut)} ${dayMonth(b.checkOut)} · ${plural(b.nights, "night")}`,
    roomType: b.roomTypeName,
    guests: guestsLabel(b),
    total: b.totalRwf,
    message: b.guestMessage ?? "",
    left: timeLeft(left),
    autoDeclines:
      expiresDay === board.today
        ? `Auto-declines today ${clock(b.approvalExpiresAt)}`
        : `Auto-declines ${dayMonth(expiresDay)} ${clock(b.approvalExpiresAt)}`,
    windowUsed: Math.min(100, Math.max(0, Math.round(((WINDOW_MS - left) / WINDOW_MS) * 100))),
    urgent: left < 3 * 60 * 60 * 1000,
  };
}

/** The bookings the Reservations list holds: everything not declined and not yet checked out. */
function reservationsOf(board: ApiBoard): ApiBooking[] {
  return board.bookings
    .filter((b) => b.state !== "declined" && b.state !== "checked_out" && b.checkOut >= board.today)
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn) || a.reference.localeCompare(b.reference));
}

// ── Sources ──────────────────────────────────────────────────────────────────

export const sources = defineSources({
  "frontdesk.deskKpis": {
    async list(ctx): Promise<DeskKpi[]> {
      return presentKpis(await deskBoard(ctx));
    },
  },
  "frontdesk.queueTabs": {
    async list(ctx): Promise<QueueTab[]> {
      return presentTabs(await deskBoard(ctx));
    },
  },
  "frontdesk.arrivals": {
    naturalKey: "bookingId",
    async list(ctx): Promise<Arrival[]> {
      const board = await deskBoard(ctx);
      return arrivalsOf(board).map((b, i) => presentArrival(b, board, i === 0));
    },
  },
  "frontdesk.inHouse": {
    naturalKey: "stayId",
    async list(ctx): Promise<InHouseStay[]> {
      const board = await deskBoard(ctx);
      return inHouseOf(board).map((s) => presentInHouse(s, board));
    },
  },
  "frontdesk.departures": {
    naturalKey: "bookingId",
    async list(ctx): Promise<Departure[]> {
      const board = await deskBoard(ctx);
      return departuresOf(board).map((s) => presentDeparture(s, board));
    },
  },
  "frontdesk.readiness": {
    naturalKey: "room",
    async list(ctx): Promise<ReadinessRoom[]> {
      return presentReadiness(await deskBoard(ctx));
    },
  },
  "frontdesk.rooms": {
    naturalKey: "room",
    async list(ctx): Promise<DeskRoom[]> {
      return presentRooms(await deskBoard(ctx));
    },
  },
  "frontdesk.checkIns": {
    async list(ctx): Promise<CheckInFile[]> {
      // The check-in desk opens on the next guest expected: today's first arrival by ETA.
      const board = await deskBoard(ctx);
      const next = arrivalsOf(board)[0];
      return next ? [await presentCheckIn(ctx, next, board)] : [];
    },
    async get(ctx, id): Promise<CheckInFile | undefined> {
      const board = await deskBoard(ctx);
      const b = checkInCandidates(board).find((x) => x.reference === id || x.id === id);
      return b ? presentCheckIn(ctx, b, board) : undefined;
    },
  },
  "frontdesk.reservations": {
    async list(ctx): Promise<Reservation[]> {
      const board = await deskBoard(ctx);
      const atDesk = arrivalsOf(board)[0]?.id ?? null;
      return reservationsOf(board).map((b) => presentReservation(b, board, atDesk));
    },
  },
  "frontdesk.roomTypes": {
    naturalKey: "name",
    async list(ctx): Promise<RoomType[]> {
      return presentRoomTypes(await deskBoard(ctx));
    },
  },
  "frontdesk.bookingRequests": {
    async list(ctx): Promise<BookingRequest[]> {
      const board = await deskBoard(ctx);
      return board.bookings
        .filter((b) => b.state === "pending")
        .sort((a, b) => (a.approvalExpiresAt ?? "").localeCompare(b.approvalExpiresAt ?? ""))
        .map((b) => presentRequest(b, board));
    },
  },
});
