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
    }));
}

/** The board for this request, with its day and property. */
export async function readDesk(): Promise<ApiBoard> {
  return deskBoard(await requestContext());
}
