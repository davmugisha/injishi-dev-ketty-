/**
 * Writes for the frontdesk area, through the API. Plain functions: server actions and verify scripts
 * both call them. Every refusal is the API's (`WorkspaceGuard`, the booking state machine, the room
 * hold exclusion); nothing here decides what a person may do.
 *
 * The screens name bookings by their reference and rooms by their label, as the desk does; both are
 * resolved against the desk's own day (`GET /ops/front-desk`) before the command is sent, so a
 * reference or a room of another branch never reaches a command.
 */
import type {
  ReservationChangeAsk,
  ReservationChangeForm,
  ReservationChangeQuote,
  ReservationChangeRequest,
  ReservationChangeResult,
} from "@injishi/contracts";
import { ApiError } from "../api";
import { type ApiBoard, deskBoard, forgetDeskBoard } from "../sources/frontdesk";
import type { SourceContext } from "../sources/types";

/** A booking of the desk's day, by reference ("BK-20431") or id. */
async function bookingOf(ctx: SourceContext, ref: string) {
  const board = await deskBoard(ctx);
  const booking = board.bookings.find((b) => b.reference === ref || b.id === ref);
  if (!booking) throw new ApiError(404, "not_found", `Booking ${ref} is not on this desk.`, null);
  return { board, booking };
}

function roomOf(board: ApiBoard, label: string) {
  const room = board.rooms.find((r) => r.label === label || r.id === label);
  if (!room) throw new ApiError(404, "not_found", `Room ${label} is not at ${board.property.name}.`, null);
  return room;
}

/** Run one command; whatever it did, the next read through this context reads the day again. */
async function command<T>(ctx: SourceContext, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } finally {
    forgetDeskBoard(ctx);
  }
}

/** Hold a room for a booking over its whole stay (POST /ops/reservations/:id/assign). */
export async function assignRoom(ctx: SourceContext, bookingRef: string, roomLabel: string): Promise<void> {
  const { board, booking } = await bookingOf(ctx, bookingRef);
  const room = roomOf(board, roomLabel);
  await command(ctx, () => ctx.ops().post(`/api/v1/ops/reservations/${booking.id}/assign`, { roomId: room.id }));
}

interface CheckInInput {
  bookingRef: string;
  roomLabel: string;
  /** Cash taken at the desk, posted to the bill once the stay is open. One key per press of "Record cash". */
  cash?: { amountRwf: number; idempotencyKey: string } | null;
  /** The registration card: nationality and the document, which decide who the stay is reported to. */
  guest?: GuestCard;
}

/** The name, nationality and document, as the desk read them from the guest's ID (`StayRegistrationDetails`). */
export interface GuestCard {
  /** Only for a booking that names nobody; the API's limit is 200 characters. */
  fullName?: string;
  nationality?: string;
  documentType?: "national_id" | "passport" | "other";
  idNumber?: string;
}

function guestCard(card: GuestCard | undefined): GuestCard {
  if (!card) return {};
  const fullName = card.fullName?.trim().slice(0, 200);
  const nationality = card.nationality?.trim().toUpperCase();
  const idNumber = card.idNumber?.trim();
  return {
    ...(fullName ? { fullName } : {}),
    ...(nationality && /^[A-Z]{2}$/.test(nationality) ? { nationality } : {}),
    ...(card.documentType ? { documentType: card.documentType } : {}),
    ...(idNumber ? { idNumber } : {}),
  };
}

export interface CheckedIn {
  stayId: string;
  stayReference: string | null;
  folioNumber: string | null;
}

/**
 * Check a booked guest in (POST /ops/stays/:bookingId/checkin), into the room the desk chose. The API
 * opens the stay and its bill and credits what the guest paid online; cash taken at the desk is then
 * recorded on that bill (POST /ops/folios/:id/payments) under the key minted when it was counted.
 */
export async function checkIn(ctx: SourceContext, input: CheckInInput): Promise<CheckedIn> {
  const { board, booking } = await bookingOf(ctx, input.bookingRef);
  const room = roomOf(board, input.roomLabel);
  return command(ctx, async () => {
    const card = guestCard(input.guest);
    const stay = await ctx.ops().post<{ id: string }>(`/api/v1/ops/stays/${booking.id}/checkin`, {
      roomId: room.id,
      ...(Object.keys(card).length ? { guest: card } : {}),
    });
    // The stay's bill, read back from the desk's day as it now stands.
    const after = await ctx.ops().get<ApiBoard>("/api/v1/ops/front-desk");
    const opened = after.stays.find((s) => s.id === stay.id);
    if (input.cash && input.cash.amountRwf > 0) {
      if (!opened?.folio)
        throw new ApiError(409, "no_folio", "The guest is checked in, but the bill did not open.", null);
      try {
        await ctx
          .ops()
          .post(
            `/api/v1/ops/folios/${opened.folio.id}/payments`,
            { amountRwf: input.cash.amountRwf, method: "cash", reference: `Check-in ${booking.reference}` },
            { idempotencyKey: input.cash.idempotencyKey },
          );
      } catch (error) {
        if (error instanceof ApiError) {
          throw new ApiError(
            error.status,
            error.code,
            `The guest is checked in, but the cash payment was not confirmed: ${error.message} Retry completion to check the same payment.`,
            error.body,
          );
        }
        throw error;
      }
    }
    return {
      stayId: stay.id,
      stayReference: opened?.reference ?? null,
      folioNumber: opened?.folio?.folioNumber ?? null,
    };
  });
}

/** Confirm a request to book (POST /ops/reservations/:id/approve). */
export async function approveRequest(ctx: SourceContext, bookingRef: string): Promise<void> {
  const { booking } = await bookingOf(ctx, bookingRef);
  await command(ctx, () => ctx.ops().post(`/api/v1/ops/reservations/${booking.id}/approve`));
}

/** Turn a request down; the guest is refunded in full (POST /ops/reservations/:id/decline). */
export async function declineRequest(ctx: SourceContext, bookingRef: string): Promise<void> {
  const { booking } = await bookingOf(ctx, bookingRef);
  await command(ctx, () => ctx.ops().post(`/api/v1/ops/reservations/${booking.id}/decline`));
}

export interface RefundOutcome {
  refundRwf: number;
  keptRwf: number;
  rule: string;
}

/**
 * Cancel at the guest's request (POST /ops/reservations/:id/cancel): refunded on the tier the booking
 * locked, the same a guest gets cancelling in their own app.
 */
export async function cancelReservation(
  ctx: SourceContext,
  bookingRef: string,
  reason: string,
): Promise<RefundOutcome> {
  const { booking } = await bookingOf(ctx, bookingRef);
  const result = await command(ctx, () =>
    ctx
      .ops()
      .post<{ refundRwf: number; forfeitRwf: number; rule: string }>(`/api/v1/ops/reservations/${booking.id}/cancel`, {
        reason: reason || undefined,
      }),
  );
  return { refundRwf: result.refundRwf, keptRwf: result.forfeitRwf, rule: result.rule };
}

export interface WalkInInput {
  /** The room type's id, as the walk-in screen lists it (frontdesk.roomTypes). */
  roomTypeId: string;
  /** A room chosen on the calendar; without it the desk takes the first ready room of the type. */
  roomId?: string;
  nights: number;
  guestName: string;
  phone?: string;
  /** Where the claim code goes, so the guest can carry on in the app. */
  email?: string;
  /** The registration card (0114). */
  guest?: GuestCard;
}

export interface WalkedIn {
  stayId: string;
  stayReference: string | null;
  room: string;
  folioNumber: string | null;
  /** True when the claim code was mailed to the address given. */
  invited: boolean;
}

const READY = new Set(["clean", "inspected"]);

/**
 * A room of this type a walk-in can have now: on sale, ready, nobody in it, and held for no booking
 * on any night of the stay. The API refuses the same things (and a race for the room); choosing here
 * only spares the desk a refusal it could have seen coming.
 */
function roomForWalkIn(board: ApiBoard, roomTypeId: string, from: string, to: string) {
  const held = new Set(
    board.bookings
      .filter((b) => b.state !== "cancelled" && b.state !== "declined" && b.state !== "checked_out")
      .flatMap((b) => b.holds.filter((h) => h.from < to && from < h.to).map((h) => h.roomId)),
  );
  return board.rooms
    .filter(
      (r) =>
        r.roomTypeId === roomTypeId &&
        r.status === "available" &&
        READY.has(r.housekeeping) &&
        !r.occupant &&
        !r.heldTonightBy &&
        !held.has(r.id),
    )
    .sort((a, b) => (a.label ?? "").localeCompare(b.label ?? "", undefined, { numeric: true }))[0];
}

/** "2026-10-19" plus n days. */
function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Check a walk-in in (POST /ops/stays/walk-in): somebody at the counter with no booking. The stay
 * opens at once with its bill, at the room type's standard rate (the rate the walk-in screen shows),
 * due out after the nights asked for at the property's checkout hour. What the desk typed about the
 * guest goes on the registration card, and an email address gets the claim code.
 */
export async function walkIn(ctx: SourceContext, input: WalkInInput): Promise<WalkedIn> {
  const name = input.guestName.trim();
  if (!name) throw new ApiError(400, "name_required", "Type the guest's name as it is on their ID.", null);
  const nights = Math.trunc(input.nights);
  if (!(nights >= 1 && nights <= 365)) throw new ApiError(400, "nights", "A walk-in stays 1 to 365 nights.", null);
  const board = await deskBoard(ctx);
  const type = board.roomTypes.find((t) => t.id === input.roomTypeId && t.active);
  if (!type) throw new ApiError(404, "not_found", "That room type is not sold at this property.", null);
  const leaves = addDays(board.today, nights);
  const chosen = input.roomId ? board.rooms.find((r) => r.id === input.roomId && r.roomTypeId === type.id) : undefined;
  if (input.roomId && !chosen) throw new ApiError(404, "not_found", "That room is not one of this type.", null);
  const room = chosen ?? roomForWalkIn(board, type.id, board.today, leaves);
  if (!room) {
    throw new ApiError(
      409,
      "no_room",
      `No ${type.name} room is ready and free for ${nights === 1 ? "tonight" : `${nights} nights`}. Choose another type.`,
      null,
    );
  }
  const checkOutTime = /^\d{2}:\d{2}/.test(board.property.checkOutTime ?? "")
    ? (board.property.checkOutTime as string).slice(0, 5)
    : "11:00";
  const phone = input.phone?.trim() || undefined;
  const email = input.email?.trim() || undefined;
  return command(ctx, async () => {
    const stay = await ctx.ops().post<{ id: string }>("/api/v1/ops/stays/walk-in", {
      roomId: room.id,
      guestName: name,
      plannedExitAt: new Date(`${leaves}T${checkOutTime}:00+02:00`).toISOString(),
      guest: { fullName: name, ...guestCard(input.guest), ...(phone ? { phone } : {}), ...(email ? { email } : {}) },
    });
    const after = await ctx.ops().get<ApiBoard>("/api/v1/ops/front-desk");
    const opened = after.stays.find((s) => s.id === stay.id);
    let invited = false;
    if (email) {
      try {
        const invite = await ctx.ops().get<{ invitationSent: boolean }>(`/api/v1/ops/stays/${stay.id}/claim-invite`);
        invited = invite.invitationSent;
      } catch {
        invited = false;
      }
    }
    return {
      stayId: stay.id,
      stayReference: opened?.reference ?? null,
      room: room.label ?? "",
      folioNumber: opened?.folio?.folioNumber ?? null,
      invited,
    };
  });
}

export interface ClaimInvite {
  claimCode: string | null;
  email: string | null;
  invitationSent: boolean;
}

/**
 * Send a stay's claim code by email, or send it again (POST /ops/stays/:id/claim-invite). The API
 * refuses a stay whose guest already has it on their account (a booked guest), and answers
 * `invitationSent: false` when the stay has no address; neither is reported as sent.
 */
export async function sendClaimInvite(ctx: SourceContext, stayRef: string, email?: string): Promise<ClaimInvite> {
  const board = await deskBoard(ctx);
  const stay = board.stays.find((s) => s.reference === stayRef || s.id === stayRef);
  if (!stay) throw new ApiError(404, "not_found", `Stay ${stayRef} is not on this desk.`, null);
  const address = email?.trim() || undefined;
  return command(ctx, () =>
    ctx.ops().post<ClaimInvite>(`/api/v1/ops/stays/${stay.id}/claim-invite`, address ? { email: address } : {}),
  );
}

/** Record that a confirmed guest never came (POST /ops/reservations/:id/no-show). */
export async function markNoShow(ctx: SourceContext, bookingRef: string, reason: string): Promise<void> {
  const { booking } = await bookingOf(ctx, bookingRef);
  await command(ctx, () =>
    ctx.ops().post(`/api/v1/ops/reservations/${booking.id}/no-show`, { reason: reason || undefined }),
  );
}

// ── Changing a reservation (0120): its dates, room type or party ────────────────────────────────────

/** The stay as it stands and the room types it may move to, for the change form. */
export async function reservationChangeForm(ctx: SourceContext, bookingRef: string): Promise<ReservationChangeForm> {
  const { booking } = await bookingOf(ctx, bookingRef);
  return ctx.ops().get<ReservationChangeForm>(`/api/v1/ops/reservations/${booking.id}/change`);
}

/** What the change would cost: the new price, the difference against what was paid, and the choices. */
export async function quoteReservationChange(
  ctx: SourceContext,
  bookingRef: string,
  ask: ReservationChangeAsk,
): Promise<ReservationChangeQuote> {
  const { booking } = await bookingOf(ctx, bookingRef);
  return ctx.ops().post<ReservationChangeQuote>(`/api/v1/ops/reservations/${booking.id}/change/quote`, ask);
}

/** Make the change: at once, or once the guest pays the difference by MoMo. */
export async function changeReservation(
  ctx: SourceContext,
  bookingRef: string,
  body: ReservationChangeRequest,
): Promise<ReservationChangeResult> {
  const { booking } = await bookingOf(ctx, bookingRef);
  return command(ctx, () =>
    ctx.ops().post<ReservationChangeResult>(`/api/v1/ops/reservations/${booking.id}/change`, body),
  );
}

/** Where the guest's MoMo payment of a change got to. */
export async function pollReservationChange(
  ctx: SourceContext,
  bookingRef: string,
  attemptToken: string,
): Promise<ReservationChangeResult> {
  const { booking } = await bookingOf(ctx, bookingRef);
  return command(ctx, () =>
    ctx
      .ops()
      .get<ReservationChangeResult>(
        `/api/v1/ops/reservations/${booking.id}/change/attempts/${encodeURIComponent(attemptToken)}`,
      ),
  );
}

// ── Moving a booking on the calendar: other nights, another room ───────────────────────────────────────

export interface BookingMove {
  /** The room it moves into, by id; null keeps it in its room type with no room held yet. */
  roomId: string | null;
  /** The first night and the morning they leave. */
  checkIn: string;
  checkOut: string;
}

/** What moving a booking would cost, before anything moves (the change quote, 0122). */
export async function quoteBookingMove(
  ctx: SourceContext,
  bookingRef: string,
  move: BookingMove,
): Promise<{ quote: ReservationChangeQuote | null; problems: string[] }> {
  const { board, booking } = await bookingOf(ctx, bookingRef);
  const roomTypeId = move.roomId ? roomOf(board, move.roomId).roomTypeId : booking.roomTypeId;
  const sameStay =
    move.checkIn === booking.checkIn && move.checkOut === booking.checkOut && roomTypeId === booking.roomTypeId;
  if (sameStay) return { quote: null, problems: [] };
  const form = await ctx.ops().get<ReservationChangeForm>(`/api/v1/ops/reservations/${booking.id}/change`);
  if (form.problems.length > 0) return { quote: null, problems: form.problems };
  const quote = await ctx.ops().post<ReservationChangeQuote>(`/api/v1/ops/reservations/${booking.id}/change/quote`, {
    ...form.current,
    checkIn: move.checkIn,
    checkOut: move.checkOut,
    roomTypeId,
  });
  return { quote, problems: quote.problems };
}

/**
 * Move a booking: new nights or another room type go through the change (a higher price on the guest's
 * bill), which lets its held room go; then the chosen room is held for the new stay. A move to another
 * room of the same type on the same nights only swaps the held room.
 */
export async function moveBooking(ctx: SourceContext, bookingRef: string, move: BookingMove): Promise<void> {
  const { board, booking } = await bookingOf(ctx, bookingRef);
  const room = move.roomId ? roomOf(board, move.roomId) : null;
  const roomTypeId = room?.roomTypeId ?? booking.roomTypeId;
  const sameStay =
    move.checkIn === booking.checkIn && move.checkOut === booking.checkOut && roomTypeId === booking.roomTypeId;
  await command(ctx, async () => {
    if (!sameStay) {
      const form = await ctx.ops().get<ReservationChangeForm>(`/api/v1/ops/reservations/${booking.id}/change`);
      const ask = { ...form.current, checkIn: move.checkIn, checkOut: move.checkOut, roomTypeId };
      const quote = await ctx
        .ops()
        .post<ReservationChangeQuote>(`/api/v1/ops/reservations/${booking.id}/change/quote`, ask);
      if (quote.problems.length > 0) throw new ApiError(409, "change_refused", quote.problems.join(" "), null);
      const result = await ctx.ops().post<ReservationChangeResult>(`/api/v1/ops/reservations/${booking.id}/change`, {
        ...ask,
        ...(quote.differenceRwf > 0 ? { settlement: "bill" } : {}),
      });
      if (result.status !== "applied") {
        throw new ApiError(409, "change_pending", "The change did not apply. Open the booking to finish it.", null);
      }
    } else {
      // The same nights in another room: let the held rooms go first, so the new hold does not overlap.
      const { assignments } = await ctx
        .ops()
        .get<{ assignments: { id: string; status: string }[] }>(`/api/v1/ops/reservations/${booking.id}/assignments`);
      for (const h of assignments.filter((x) => x.status === "assigned")) {
        await ctx.ops().delete(`/api/v1/ops/reservations/${booking.id}/assign/${h.id}`);
      }
    }
    // No room chosen: the booking keeps its type and waits for a room ("No room yet").
    if (room) await ctx.ops().post(`/api/v1/ops/reservations/${booking.id}/assign`, { roomId: room.id });
  });
}
