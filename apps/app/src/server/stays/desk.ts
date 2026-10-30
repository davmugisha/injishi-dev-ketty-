/**
 * The desk's day for a stay business, as rows for the Today and Bookings tables (2026-10-30). One read of
 * `GET /ops/front-desk` per request (the same board every desk screen shares). Server side only.
 */

import { requestContext } from "../data";
import { kigaliDate } from "../format";
import {
  type ApiBoard,
  type ApiBooking,
  type ApiStay,
  channelOf,
  continuing,
  deskBoard,
  nameOf,
} from "../sources/frontdesk";

/** Where a guest stands today at the desk. */
export type DeskRowKind = "request" | "arriving" | "in_house" | "leaving" | "left";

export interface DeskRow {
  id: string;
  kind: DeskRowKind;
  guest: string;
  phone: string | null;
  room: string | null;
  roomType: string;
  /** First night and the morning they leave. */
  from: string | null;
  to: string | null;
  /** Still to pay, when the bill or booking says so. */
  balanceRwf: number | null;
  eta: string | null;
  bookingRef: string | null;
  stayRef: string | null;
}

export type BookingState = ApiBooking["state"];

export interface BookingRow {
  id: string;
  reference: string;
  guest: string;
  phone: string | null;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  roomType: string;
  room: string | null;
  state: BookingState;
  channel: string;
  totalRwf: number;
  paidRwf: number;
  eta: string | null;
  note: string | null;
  guestMessage: string | null;
  approvalExpiresAt: string | null;
  /** What cancelling now would refund and keep. */
  cancellation: { refundRwf: number; keptRwf: number; rule: string } | null;
  noShow: { refundRwf: number; keptRwf: number; rule: string } | null;
  stayRef: string | null;
  /** The room held for the whole stay, when exactly one is. */
  roomId: string | null;
}

/** A room the desk can put a guest in, for the panel's room choice. */
export interface DeskRoom {
  id: string;
  label: string;
  typeId: string;
  type: string;
}

/** Every room that can take a guest (not out of service), by type then number. */
export function deskRooms(board: ApiBoard): DeskRoom[] {
  const types = new Map(board.roomTypes.filter((t) => t.active).map((t) => [t.id, t.name]));
  return board.rooms
    .filter((r) => r.status === "available" && types.has(r.roomTypeId))
    .map((r) => ({ id: r.id, label: r.label ?? "Room", typeId: r.roomTypeId, type: types.get(r.roomTypeId) ?? "" }))
    .sort((a, b) => a.type.localeCompare(b.type) || a.label.localeCompare(b.label, undefined, { numeric: true }));
}

const owed = (s: ApiStay): number | null => s.folio?.balanceRwf ?? null;

function stayRow(s: ApiStay, kind: DeskRowKind, board: ApiBoard): DeskRow {
  const booking = s.bookingId ? board.bookings.find((b) => b.id === s.bookingId) : undefined;
  return {
    id: `s-${s.id}`,
    kind,
    guest: nameOf(s.guestName),
    phone: booking?.guestPhone ?? null,
    room: s.roomLabel,
    roomType: s.roomTypeName,
    from: s.checkIn ?? kigaliDate(s.entryAt),
    to: s.checkOut ?? (s.plannedExitAt ? kigaliDate(s.plannedExitAt) : null),
    balanceRwf: owed(s),
    eta: null,
    bookingRef: s.bookingReference,
    stayRef: s.reference ?? s.id,
  };
}

/** Today at the desk: requests and arrivals for today, who is in, who leaves today and who already left. */
export function deskRows(board: ApiBoard): DeskRow[] {
  const today = board.today;
  const arrivals: DeskRow[] = board.bookings
    .filter((b) => b.checkIn === today && (b.state === "confirmed" || b.state === "pending"))
    .map((b) => ({
      id: `b-${b.id}`,
      kind: b.state === "pending" ? "request" : "arriving",
      guest: nameOf(b.guestName),
      phone: b.guestPhone,
      room: b.holds[0]?.roomLabel ?? null,
      roomType: b.roomTypeName,
      from: b.checkIn,
      to: b.checkOut,
      balanceRwf: Math.max(0, b.totalRwf - b.paidRwf),
      eta: b.eta,
      bookingRef: b.reference,
      stayRef: null,
    }));
  const stays = board.stays.flatMap((s): DeskRow[] => {
    if (continuing(s, today)) return [stayRow(s, "in_house", board)];
    if (s.lifecycle === "open") return [stayRow(s, "leaving", board)];
    if (s.actualExitAt && kigaliDate(s.actualExitAt) === today) return [stayRow(s, "left", board)];
    return [];
  });
  return [...arrivals, ...stays];
}

/** Bookings still to come or under way, and the ones cancelled or missed, newest arrival last. */
export function bookingRows(board: ApiBoard): BookingRow[] {
  return board.bookings
    .filter((b) => b.state !== "checked_out" && b.checkOut >= board.today)
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn) || a.reference.localeCompare(b.reference))
    .map((b) => ({
      id: b.id,
      reference: b.reference,
      guest: nameOf(b.guestName),
      phone: b.guestPhone,
      checkIn: b.checkIn,
      checkOut: b.checkOut,
      nights: b.nights,
      guests: b.guestCount,
      roomType: b.roomTypeName,
      room: b.stay?.roomLabel ?? b.holds[0]?.roomLabel ?? null,
      state: b.state,
      channel: channelOf(b.channel),
      totalRwf: b.totalRwf,
      paidRwf: b.paidRwf,
      eta: b.eta,
      note: b.deskNote,
      guestMessage: b.guestMessage,
      approvalExpiresAt: b.approvalExpiresAt,
      cancellation: b.cancellation,
      noShow: b.noShow,
      stayRef: b.stay?.reference ?? b.stay?.id ?? null,
      roomId: b.holds.length === 1 ? (b.holds[0]?.roomId ?? null) : null,
    }));
}

/** The board for this request, with its day and property. */
export async function readDesk(): Promise<ApiBoard> {
  return deskBoard(await requestContext());
}

// ── The booking calendar: rooms by type, stays and bookings across the nights ───────────────────────

export type CalendarKind = "requested" | "confirmed" | "in_house" | "checked_out";

export interface CalendarStay {
  id: string;
  roomId: string;
  kind: CalendarKind;
  guest: string;
  phone: string | null;
  /** The first night, the last night, and the morning they leave. */
  start: string;
  end: string;
  checkOut: string;
  room: string;
  roomType: string;
  guests: number | null;
  totalRwf: number | null;
  paidRwf: number | null;
  balanceRwf: number | null;
  bookingRef: string | null;
  stayRef: string | null;
  /** A confirmed booking nobody has checked in yet: it may move to other nights or rooms. */
  movable: boolean;
  cancellation: { refundRwf: number; keptRwf: number; rule: string } | null;
  /** When the guest said they arrive (`HH:mm`), for a booking not yet checked in. */
  eta: string | null;
  /** The room type, by id: the calendar's type filter. */
  roomTypeId: string | null;
}

export interface CalendarRoomType {
  id: string;
  name: string;
  rooms: { id: string; label: string; bookable: boolean }[];
}

export interface CalendarBoard {
  today: string;
  /** The property's check-in and check-out times (`HH:mm`): where arrivals and departures sit on the clock. */
  checkInTime: string;
  checkOutTime: string;
  roomTypes: CalendarRoomType[];
  stays: CalendarStay[];
}

const dayBefore = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

const addOne = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

/** Where a booking with no room yet sits: a row of its own under its type. */
const waitingRow = (roomTypeId: string) => `waiting:${roomTypeId}`;

/**
 * The calendar's rows and cards from the desk's day: every room by type, who is in it or left it lately,
 * and the bookings to come in their held rooms (or a "No room yet" row of the type). Stays that left
 * earlier come from the period activity, placed by their room's label.
 */
export function calendarBoard(
  board: ApiBoard,
  history: readonly {
    id: string;
    reference: string | null;
    guestName: string;
    roomLabel: string | null;
    roomTypeName: string;
    checkIn: string;
    checkOut: string;
    status: string;
    totalRwf: number;
  }[] = [],
): CalendarBoard {
  const today = board.today;
  const stays: CalendarStay[] = [];
  const seen = new Set<string>();

  for (const s of board.stays) {
    const booking = s.bookingId ? board.bookings.find((b) => b.id === s.bookingId) : undefined;
    const from = (s.checkIn ?? kigaliDate(s.entryAt)) as string;
    const leaves =
      s.checkOut ??
      (s.actualExitAt ? kigaliDate(s.actualExitAt) : s.plannedExitAt ? kigaliDate(s.plannedExitAt) : null) ??
      today;
    const out = leaves > from ? leaves : addOne(from);
    if (s.reference) seen.add(s.reference);
    if (s.bookingReference) seen.add(s.bookingReference);
    stays.push({
      id: `s-${s.id}`,
      roomId: s.roomId,
      kind: s.lifecycle === "open" ? "in_house" : "checked_out",
      guest: nameOf(s.guestName),
      phone: booking?.guestPhone ?? null,
      start: from,
      end: dayBefore(out),
      checkOut: out,
      room: s.roomLabel ?? "",
      roomType: s.roomTypeName,
      guests: booking?.guestCount ?? null,
      totalRwf: booking?.totalRwf ?? null,
      paidRwf: booking?.paidRwf ?? null,
      balanceRwf: s.folio?.balanceRwf ?? null,
      bookingRef: s.bookingReference,
      stayRef: s.reference ?? s.id,
      movable: false,
      cancellation: null,
      eta: null,
      roomTypeId: board.rooms.find((r) => r.id === s.roomId)?.roomTypeId ?? null,
    });
  }

  for (const b of board.bookings) {
    if (b.stay || (b.status !== "confirmed" && b.status !== "pending_approval")) continue;
    seen.add(b.reference);
    const base = {
      kind: (b.status === "confirmed" ? "confirmed" : "requested") as CalendarKind,
      guest: nameOf(b.guestName),
      phone: b.guestPhone,
      roomType: b.roomTypeName,
      guests: b.guestCount,
      totalRwf: b.totalRwf,
      paidRwf: b.paidRwf,
      balanceRwf: Math.max(0, b.totalRwf - b.paidRwf),
      bookingRef: b.reference,
      stayRef: null,
      movable: b.status === "confirmed",
      cancellation: b.cancellation,
      eta: b.eta,
      roomTypeId: b.roomTypeId,
    };
    if (b.holds.length === 0) {
      stays.push({
        ...base,
        id: `b-${b.id}`,
        roomId: waitingRow(b.roomTypeId),
        start: b.checkIn,
        end: dayBefore(b.checkOut),
        checkOut: b.checkOut,
        room: "",
      });
      continue;
    }
    b.holds.forEach((h, i) => {
      stays.push({
        ...base,
        id: `b-${b.id}-${i}`,
        roomId: h.roomId,
        start: h.from,
        end: dayBefore(h.to),
        checkOut: h.to,
        room: h.roomLabel ?? "",
        // A split stay moves leg by leg at the desk, not by dragging.
        movable: base.movable && b.holds.length === 1,
      });
    });
  }

  // Earlier stays, from the period's activity, in the room of the same label.
  for (const h of history) {
    if (h.status !== "checked_out" || (h.reference && seen.has(h.reference))) continue;
    const room = board.rooms.find((r) => r.label === h.roomLabel);
    if (!room) continue;
    stays.push({
      id: `h-${h.id}`,
      roomId: room.id,
      kind: "checked_out",
      guest: nameOf(h.guestName),
      phone: null,
      start: h.checkIn,
      end: dayBefore(h.checkOut),
      checkOut: h.checkOut,
      room: h.roomLabel ?? "",
      roomType: h.roomTypeName,
      guests: null,
      totalRwf: h.totalRwf,
      paidRwf: null,
      balanceRwf: null,
      bookingRef: null,
      stayRef: h.reference,
      movable: false,
      cancellation: null,
      eta: null,
      roomTypeId: room.roomTypeId,
    });
  }

  const roomTypes = board.roomTypes
    .filter((t) => t.active)
    .map((t) => {
      const rooms = board.rooms
        .filter((r) => r.roomTypeId === t.id)
        .sort((a, b) => (a.label ?? "").localeCompare(b.label ?? "", undefined, { numeric: true }))
        .map((r) => ({ id: r.id, label: r.label ?? "Room", bookable: r.status === "available" }));
      if (stays.some((s) => s.roomId === waitingRow(t.id))) {
        rooms.push({ id: waitingRow(t.id), label: "No room yet", bookable: false });
      }
      return { id: t.id, name: t.name, rooms };
    })
    .filter((t) => t.rooms.length > 0);

  return {
    today,
    checkInTime: board.property.checkInTime ?? "14:00",
    checkOutTime: board.property.checkOutTime ?? "11:00",
    roomTypes,
    stays,
  };
}
