"use server";

import { revalidatePath } from "next/cache";
import { requirePersona } from "@/lib/session";
import { ApiError, ApiUnreachableError } from "@/server/api";
import { requestContext } from "@/server/data";
import type { CheckInGuestCard } from "@/server/mutations/frontdesk";
import {
  approveRequest,
  assignRoom,
  type CheckedIn,
  cancelReservation,
  checkIn,
  declineRequest,
  markNoShow,
  type RefundOutcome,
  type WalkedIn,
  type WalkInInput,
  walkIn,
} from "@/server/mutations/frontdesk";

/**
 * The front desk's commands. Each one names its screen (`requirePersona`), calls the API through a
 * plain mutation and refreshes the desk's screens. A refusal comes back as words for the screen's
 * toast rather than as a thrown error, because Next hides a thrown error's message in production.
 */
export type ActionResult<T = null> = { ok: true; value: T } | { ok: false; error: string };

async function attempt<T>(run: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.unauthenticated) return { ok: false, error: "Your session ended. Sign in again." };
      if (error.forbidden) return { ok: false, error: `Not allowed: ${error.message}` };
      return { ok: false, error: error.message };
    }
    if (error instanceof ApiUnreachableError)
      return { ok: false, error: "The Injishi service did not answer. Try again." };
    throw error;
  }
}

const DESK = ["/front-desk", "/reservations", "/check-in", "/check-out", "/walk-in", "/room-rack", "/messages"];
const refresh = () => {
  for (const path of DESK) revalidatePath(path);
  revalidatePath("/stays/[id]", "page");
};

/** Walk-in → Check in: open the stay and its bill in a ready room of the chosen type. */
export async function checkInWalkIn(input: WalkInInput): Promise<ActionResult<WalkedIn>> {
  await requirePersona("WalkIn");
  const result = await attempt(async () => walkIn(await requestContext(), input));
  if (result.ok) refresh();
  return result;
}

/** Today → Assign room: hold the room for the arrival's whole stay. */
export async function assignArrivalRoom(bookingRef: string, roomLabel: string): Promise<ActionResult> {
  await requirePersona("FrontDeskToday");
  const result = await attempt(async () => {
    await assignRoom(await requestContext(), bookingRef, roomLabel);
    return null;
  });
  if (result.ok) refresh();
  return result;
}

/** Check-in → Done: open the stay in the chosen room; record the cash counted at the desk on its bill. */
export async function checkInGuest(input: {
  bookingRef: string;
  roomLabel: string;
  cash: { amountRwf: number; idempotencyKey: string } | null;
  /** The card the area's leaders are sent. */
  guest?: CheckInGuestCard;
}): Promise<ActionResult<CheckedIn>> {
  await requirePersona("CheckIn");
  const result = await attempt(async () => checkIn(await requestContext(), input));
  if (result.ok) refresh();
  return result;
}

/** Reservations → Requests → Approve. */
export async function approveBookingRequest(bookingRef: string): Promise<ActionResult> {
  await requirePersona("Reservations");
  const result = await attempt(async () => {
    await approveRequest(await requestContext(), bookingRef);
    return null;
  });
  if (result.ok) refresh();
  return result;
}

/** Reservations → Requests → Decline (the guest is refunded in full). */
export async function declineBookingRequest(bookingRef: string): Promise<ActionResult> {
  await requirePersona("Reservations");
  const result = await attempt(async () => {
    await declineRequest(await requestContext(), bookingRef);
    return null;
  });
  if (result.ok) refresh();
  return result;
}

/** Reservations → Cancel booking, at the guest's request, refunded on the booking's tier. */
export async function cancelBooking(bookingRef: string, reason: string): Promise<ActionResult<RefundOutcome>> {
  await requirePersona("Reservations");
  const result = await attempt(async () => cancelReservation(await requestContext(), bookingRef, reason));
  if (result.ok) refresh();
  return result;
}

/** Reservations → Mark no-show. */
export async function recordNoShow(bookingRef: string, reason: string): Promise<ActionResult> {
  await requirePersona("Reservations");
  const result = await attempt(async () => {
    await markNoShow(await requestContext(), bookingRef, reason);
    return null;
  });
  if (result.ok) refresh();
  return result;
}
