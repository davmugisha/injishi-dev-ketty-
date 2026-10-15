/**
 * Writes for the frontdesk area, through the API. Plain functions: server actions and verify scripts
 * both call them. Every refusal is the API's (`WorkspaceGuard`, the booking state machine, the room
 * hold exclusion); nothing here decides what a person may do.
 *
 * The screens name bookings by their reference and rooms by their label, as the desk does; both are
 * resolved against the desk's own day (`GET /ops/front-desk`) before the command is sent, so a
 * reference or a room of another branch never reaches a command.
 */
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

export interface CheckInInput {
  bookingRef: string;
  roomLabel: string;
  /** Cash taken at the desk, posted to the bill once the stay is open. One key per press of "Record cash". */
  cash?: { amountRwf: number; idempotencyKey: string } | null;
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
    const stay = await ctx.ops().post<{ id: string }>(`/api/v1/ops/stays/${booking.id}/checkin`, { roomId: room.id });
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

/** Record that a confirmed guest never came (POST /ops/reservations/:id/no-show). */
export async function markNoShow(ctx: SourceContext, bookingRef: string, reason: string): Promise<void> {
  const { booking } = await bookingOf(ctx, bookingRef);
  await command(ctx, () =>
    ctx.ops().post(`/api/v1/ops/reservations/${booking.id}/no-show`, { reason: reason || undefined }),
  );
}
