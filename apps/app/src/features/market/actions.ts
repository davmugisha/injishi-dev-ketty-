"use server";

import type { BoardId } from "@injishi/data";
import { revalidatePath } from "next/cache";
import { requirePersona } from "@/lib/session";
import { ApiError, ApiUnreachableError } from "@/server/api";
import { requestContext } from "@/server/data";
import * as market from "@/server/mutations/market";
import type { SourceContext } from "@/server/sources/types";

/**
 * The market screens' writes. Each asks for a signed-in person first (an anonymous visitor who hearts a
 * place is sent to sign in), then calls the API as that person. A refusal comes back as words the screen
 * shows in a toast; it is never swallowed.
 */

export type MarketActionResult<T = undefined> = { ok: true; value: T } | { ok: false; error: string };

async function run<T>(
  board: BoardId,
  act: (ctx: SourceContext) => Promise<T>,
  revalidate = true,
): Promise<MarketActionResult<T>> {
  await requirePersona(board);
  try {
    const value = await act(await requestContext());
    if (revalidate) {
      revalidatePath("/explore");
      revalidatePath("/explore/[slug]", "page");
      revalidatePath("/trips");
    }
    return { ok: true, value };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error: error.message };
    if (error instanceof ApiUnreachableError)
      return { ok: false, error: "The Injishi service did not answer. Try again." };
    throw error;
  }
}

// ── Explore and the property page ───────────────────────────────────────────────────────────────

export async function setSavedAction(propertyId: string, on: boolean) {
  return run("MarketExplore", (ctx) => market.setSaved(ctx, propertyId, on));
}

export async function setSavedBySlugAction(slug: string, on: boolean) {
  return run("MarketProperty", (ctx) => market.setSavedBySlug(ctx, slug, on));
}

/** "Report this listing" → a support ticket about it (`POST /support/tickets`, topic listing). Answers its id. */
export async function reportListingAction(slug: string, reason: string, detail: string) {
  return run("MarketProperty", async (ctx) => (await market.reportListing(ctx, { slug, reason, detail })).id, false);
}

// ── The guest account ───────────────────────────────────────────────────────────────────────────

export async function createCollectionAction(name: string) {
  return run("GuestAccount", async (ctx) => (await market.createCollection(ctx, name)).id);
}

export async function removeFromCollectionAction(collectionId: string, place: string) {
  return run("GuestAccount", async (ctx) => {
    await market.removeFromCollection(ctx, collectionId, place);
  });
}

export async function setConsentAction(choice: string, granted: boolean) {
  return run("GuestAccount", (ctx) => market.setConsent(ctx, choice, granted));
}

export async function saveContactAction(input: market.ContactInput) {
  return run("GuestAccount", (ctx) => market.saveContact(ctx, input));
}

export async function withdrawRequestAction(reference: string) {
  return run("GuestAccount", async (ctx) => {
    await market.cancelBooking(ctx, reference);
  });
}

// ── Checkout ─────────────────────────────────────────────────────────────────────────────────────

/** What the checkout screen needs back from a press of Pay or Send request. */
export interface CheckoutResult {
  state: "prompting" | "confirmed" | "refused" | "expired";
  attemptToken: string;
  expiresAt: string | null;
  reference: string | null;
  bookingStatus: string | null;
  approvalExpiresAt: string | null;
  payerMasked: string | null;
  /** The provider's reference for a settled payment, from the trip's own facts. */
  providerRef: string | null;
  failureReason: string | null;
}

function fromAttempt(a: market.AttemptApi): CheckoutResult {
  return {
    state: a.state,
    attemptToken: a.attemptToken,
    expiresAt: a.expiresAt,
    reference: a.booking?.reference ?? null,
    bookingStatus: a.booking?.status ?? null,
    approvalExpiresAt: a.booking?.approvalExpiresAt ?? null,
    payerMasked: a.payerMasked,
    providerRef: null,
    failureReason: a.failureReason,
  };
}

/** A settled press: add the provider's reference, so the receipt line names the payment. */
async function withReference(ctx: SourceContext, r: CheckoutResult): Promise<CheckoutResult> {
  if (r.state !== "confirmed" || !r.reference) return r;
  const paid = await market.tripPayment(ctx, r.reference);
  return { ...r, providerRef: paid?.providerRef ?? null, payerMasked: r.payerMasked ?? paid?.payerMasked ?? null };
}

/**
 * Pay for (or request) the checkout's draft. `attemptToken` is minted once per press in the browser, so a
 * retried request is the same intent, never a second charge. Mobile money only: a card is a provider token
 * from a hosted field, and no tokeniser is wired, so a card number is never sent anywhere.
 */
export async function payCheckoutAction(
  mode: "instant" | "request",
  payment: market.MobileMoney,
  attemptToken: string,
): Promise<MarketActionResult<CheckoutResult>> {
  return run("MarketCheckout", async (ctx) => {
    const outcome = await market.bookCheckout(ctx, mode, payment, attemptToken);
    if (outcome.status === "awaiting_payment") return withReference(ctx, fromAttempt(outcome.attempt));
    return withReference(ctx, {
      state: "confirmed",
      attemptToken,
      expiresAt: null,
      reference: outcome.booking.reference,
      bookingStatus: outcome.booking.status,
      approvalExpiresAt: outcome.booking.approvalExpiresAt,
      payerMasked: null,
      providerRef: null,
      failureReason: null,
    });
  });
}

/** "Your details" → the person's own contact record (`PUT /me/guest-contact`); a booking takes no guest details. */
export async function saveCheckoutDetailsAction(input: {
  firstName: string;
  lastName: string;
  mobile: string;
  country: string;
}) {
  return run("MarketCheckout", (ctx) => market.saveCheckoutDetails(ctx, input));
}

/**
 * "Cancel request" on a request just sent → `POST /bookings/:reference/cancel`. A request the host has not
 * accepted is refunded in full; the answer carries the refund the server decided.
 */
export async function cancelCheckoutRequestAction(reference: string) {
  return run("MarketCheckout", (ctx) => market.cancelBooking(ctx, reference));
}

/** Ask where a press of Pay got to. */
export async function checkPaymentAction(attemptToken: string): Promise<MarketActionResult<CheckoutResult>> {
  // A poll changes nothing, so it refreshes nothing; the trips page is fresh on its next read.
  return run(
    "MarketCheckout",
    async (ctx) => withReference(ctx, fromAttempt(await market.paymentAttempt(ctx, attemptToken))),
    false,
  );
}
