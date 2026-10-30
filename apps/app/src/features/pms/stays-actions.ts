"use server";

import { revalidatePath } from "next/cache";
import { requirePersona } from "@/lib/session";
import { ApiError, ApiUnreachableError } from "@/server/api";
import { requestContext } from "@/server/data";
import { type ClaimInvite, sendClaimInvite } from "@/server/mutations/frontdesk";
import {
  type CheckedOut,
  checkOutStay,
  type PostChargeInput,
  type Posted,
  postFolioCharge,
  sendGuestMessage,
  takeCashPayment,
  voidFolioCharge,
} from "@/server/mutations/stays";

/**
 * The stay screens' commands. Each names its screen (`requirePersona`), calls the API through a plain
 * mutation and refreshes what the change shows on. A refusal comes back as words for the screen's toast
 * rather than as a thrown error, because Next hides a thrown error's message in production.
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

/** Everywhere a stay's bill or its departure shows. */
const refresh = () => {
  revalidatePath("/stays/[id]", "page");
  for (const path of ["/check-out", "/front-desk", "/reservations", "/check-in", "/messages"]) revalidatePath(path);
};

/**
 * Messages → Send: the reply goes onto the guest's conversation through the API, so the guest app
 * and every desk see it. A refusal (an archived conversation, a missing permission) comes back as
 * words for the screen's toast.
 */
export async function replyToGuest(threadId: string, body: string): Promise<ActionResult> {
  await requirePersona("Messages");
  const result = await attempt(async () => {
    await sendGuestMessage(await requestContext(), threadId, body);
    return null;
  });
  if (result.ok) revalidatePath("/messages");
  return result;
}

/** Stay and folio → Post charge: a desk charge, typed before tax, under the key of this press. */
export async function postCharge(input: PostChargeInput): Promise<ActionResult<Posted>> {
  await requirePersona("StayFolio");
  const result = await attempt(async () => postFolioCharge(await requestContext(), input));
  if (result.ok) refresh();
  return result;
}

/** Stay and folio → Void with reversal. */
export async function voidCharge(input: {
  stayRef: string;
  chargeId: string;
  reason: string;
  idempotencyKey: string;
}): Promise<ActionResult<{ balanceRwf: number }>> {
  await requirePersona("StayFolio");
  const result = await attempt(async () => voidFolioCharge(await requestContext(), input));
  if (result.ok) refresh();
  return result;
}

/** Stay and folio → Take payment → Record cash: the amount the person typed, once per press. */
export async function recordCash(input: {
  stayRef: string;
  amountRwf: number;
  idempotencyKey: string;
}): Promise<ActionResult<{ balanceRwf: number }>> {
  await requirePersona("StayFolio");
  const result = await attempt(async () => takeCashPayment(await requestContext(), input));
  if (result.ok) refresh();
  return result;
}

/** Stay and folio → Resend claim code (email; the API refuses a guest who booked with an account). */
export async function resendClaimCode(stayRef: string): Promise<ActionResult<ClaimInvite>> {
  await requirePersona("StayFolio");
  const result = await attempt(async () => sendClaimInvite(await requestContext(), stayRef));
  if (result.ok) refresh();
  return result;
}

/** Checkout → Complete checkout, and Stay and folio → Check out. */
export async function checkOutGuest(
  stayRef: string,
  screen: "Checkout" | "StayFolio",
  note?: string,
): Promise<ActionResult<CheckedOut>> {
  await requirePersona(screen);
  const result = await attempt(async () => checkOutStay(await requestContext(), stayRef, note));
  if (result.ok) refresh();
  return result;
}
