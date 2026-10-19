/**
 * Writes for the market area, through the API. Plain functions: the server actions and the verify flows
 * both call them. Everything here acts as the signed-in person on their own rows (`/me/*`, `/bookings`):
 * the API takes the person from the session and answers 404 for anything that is not theirs.
 */
import { listingReportLabel } from "../../features/market/report-reasons";
import { ApiError } from "../api";
import { CONSENT_PURPOSE, type CollectionApi, catalogue, checkoutDrafts, myCollections } from "../sources/market";
import type { SourceContext } from "../sources/types";

// ── Saved places and collections ───────────────────────────────────────────────────────────────────

/** The heart (ADR-032): on saves into the default list, off removes the place from every list. */
export async function setSaved(ctx: SourceContext, propertyId: string, on: boolean): Promise<void> {
  const path = `/api/v1/me/saved/${encodeURIComponent(propertyId)}`;
  if (on) await ctx.api.post(path);
  else await ctx.api.delete(path);
}

/** The property page's heart: the page names its property by slug. */
export async function setSavedBySlug(ctx: SourceContext, slug: string, on: boolean): Promise<void> {
  const card = (await catalogue(ctx)).find((c) => c.slug === slug);
  if (!card) throw new ApiError(404, null, "That place is no longer listed.", null);
  await setSaved(ctx, card.id, on);
}

export async function createCollection(ctx: SourceContext, name: string): Promise<CollectionApi> {
  return ctx.api.post<CollectionApi>("/api/v1/me/collections", { name });
}

export async function renameCollection(ctx: SourceContext, id: string, name: string): Promise<CollectionApi> {
  return ctx.api.patch<CollectionApi>(`/api/v1/me/collections/${encodeURIComponent(id)}`, { name });
}

export async function deleteCollection(ctx: SourceContext, id: string): Promise<void> {
  await ctx.api.delete(`/api/v1/me/collections/${encodeURIComponent(id)}`);
}

export async function addToCollection(ctx: SourceContext, id: string, propertyId: string): Promise<CollectionApi> {
  return ctx.api.post<CollectionApi>(`/api/v1/me/collections/${encodeURIComponent(id)}/items`, { propertyId });
}

/**
 * Take a place out of one list. The account page names a saved place by its page address (slug), so it is
 * resolved against the person's own list first; a place that is not in it is the API's 404 either way.
 */
export async function removeFromCollection(ctx: SourceContext, id: string, place: string): Promise<CollectionApi> {
  const list = (await myCollections(ctx)).find((c) => c.id === id);
  const propertyId = list?.items.find((i) => i.slug === place || i.propertyId === place)?.propertyId ?? place;
  return ctx.api.delete<CollectionApi>(
    `/api/v1/me/collections/${encodeURIComponent(id)}/items/${encodeURIComponent(propertyId)}`,
  );
}

// ── Account ────────────────────────────────────────────────────────────────────────────────────────

/** Record one consent choice (append-only). `choice` is the account page's switch id ("share", "offers"). */
export async function setConsent(ctx: SourceContext, choice: string, granted: boolean): Promise<void> {
  await ctx.api.put("/api/v1/me/consents", { purpose: CONSENT_PURPOSE[choice] ?? choice, granted });
}

export interface ContactInput {
  name: string;
  phone: string;
  /** A country code or its English name; the API resolves either. */
  country: string;
  locale: string;
}

export async function saveContact(ctx: SourceContext, input: ContactInput): Promise<void> {
  await ctx.api.put("/api/v1/me/guest-contact", input);
}

/**
 * The checkout's "Your details". The booking route takes no guest details (a booking is the signed-in person's),
 * so what the person edits here is their own contact record (`PUT /me/guest-contact`), the one the account page
 * edits too. The language they chose is kept as it is.
 */
export async function saveCheckoutDetails(
  ctx: SourceContext,
  input: { firstName: string; lastName: string; mobile: string; country: string },
): Promise<void> {
  const name = `${input.firstName.trim()} ${input.lastName.trim()}`.trim();
  if (!name) throw new ApiError(400, null, "Enter your name.", null);
  const current = await ctx.api.get<{ locale: string }>("/api/v1/me/guest-contact");
  await saveContact(ctx, { name, phone: input.mobile.trim(), country: input.country, locale: current.locale });
}

// ── Reports ────────────────────────────────────────────────────────────────────────────────────────

/**
 * "Report this listing": a support ticket about the listing (`POST /support/tickets`, topic `listing`), the intake
 * Injishi support works from. It is the signed-in person's: the API attributes it from the session, and the reply
 * goes to their account's email. Answers the ticket id.
 */
export async function reportListing(
  ctx: SourceContext,
  input: { slug: string; reason: string; detail: string },
): Promise<{ id: string }> {
  const email = ctx.account?.user.email;
  if (!email) throw new ApiError(401, null, "Sign in to report a listing.", null);
  const reason = listingReportLabel(input.reason);
  if (!reason) throw new ApiError(400, null, "Choose why you are reporting this listing.", null);
  const card = (await catalogue(ctx)).find((c) => c.slug === input.slug);
  if (!card) throw new ApiError(404, null, "That place is no longer listed.", null);
  const detail = input.detail.trim().slice(0, 2000);
  const message = [`Report about a listing: ${card.name} (${card.slug})`, `Reason: ${reason}`, detail]
    .filter(Boolean)
    .join("\n");
  const name = ctx.account?.user.name?.trim();
  return ctx.api.post<{ id: string }>("/api/v1/support/tickets", {
    topic: "listing",
    message,
    email,
    ...(name ? { name: name.slice(0, 120) } : {}),
  });
}

// ── Bookings ─────────────────────────────────────────────────────────────────────────────────────

export interface MobileMoney {
  network: "mtn_momo" | "airtel_money";
  /** As typed: "078 812 4417", "+250 788 124 417". */
  number: string;
}

/** Nine national digits, the form the API takes (`NationalMsisdn`). */
export function nationalMsisdn(number: string): string {
  const digits = number.replace(/\D/g, "");
  if (digits.startsWith("250") && digits.length === 12) return digits.slice(3);
  if (digits.startsWith("0") && digits.length === 10) return digits.slice(1);
  return digits;
}

/** One booking, exactly as `POST /bookings` takes it. The server prices it; nothing here sends a price. */
export interface StayInput {
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  payment: MobileMoney;
  /** One press of confirm, minted by the browser and reused on every retry of that press (ADR-020 D-c). */
  attemptToken: string;
}

interface BookingResultApi {
  id: string;
  reference: string;
  status: "pending_approval" | "confirmed" | "declined" | "cancelled" | "no_show";
  approvalExpiresAt: string | null;
  breakdown: { grossRwf: number };
}

export interface AttemptApi {
  attemptToken: string;
  state: "prompting" | "confirmed" | "refused" | "expired";
  network: "mtn_momo" | "airtel_money" | null;
  payerMasked: string | null;
  amountRwf: number | null;
  expiresAt: string;
  booking: BookingResultApi | null;
  failureReason: string | null;
}

export type BookingOutcome =
  | { status: "confirmed"; booking: BookingResultApi }
  | { status: "awaiting_payment"; attempt: AttemptApi };

export async function bookStay(ctx: SourceContext, input: StayInput): Promise<BookingOutcome> {
  return ctx.api.post<BookingOutcome>(
    "/api/v1/bookings",
    {
      roomTypeId: input.roomTypeId,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      guests: input.guests,
      nonRefundable: false,
      attemptToken: input.attemptToken,
      instrument: {
        kind: "mobile_money",
        network: input.payment.network,
        msisdn: nationalMsisdn(input.payment.number),
      },
    },
    { idempotencyKey: input.attemptToken },
  );
}

/**
 * Book the checkout's draft (`instant` or `request`). The room, dates and party are re-read on the server
 * side of the app from the same draft the page showed, never taken from the browser.
 */
export async function bookCheckout(
  ctx: SourceContext,
  mode: "instant" | "request",
  payment: MobileMoney,
  attemptToken: string,
): Promise<BookingOutcome> {
  const draft = (await checkoutDrafts(ctx)).find((d) => d.draft.id === mode);
  if (!draft) throw new ApiError(404, null, "That room is no longer offered.", null);
  return bookStay(ctx, {
    roomTypeId: draft.roomTypeId,
    checkIn: draft.quote.checkIn,
    checkOut: draft.quote.checkOut,
    guests: draft.quote.guests,
    payment,
    attemptToken,
  });
}

/** How one of the person's own bookings was paid (`/me/trip-facts`), or null when it was not. */
export async function tripPayment(
  ctx: SourceContext,
  reference: string,
): Promise<{ providerRef: string | null; payerMasked: string | null } | null> {
  const { trips } = await ctx.api.get<{
    trips: { reference: string; payment: { providerRef: string | null; payerMasked: string | null } | null }[];
  }>("/api/v1/me/trip-facts");
  return trips.find((t) => t.reference === reference)?.payment ?? null;
}

/** Where one press of confirm got to (the guest's own attempt only). */
export async function paymentAttempt(ctx: SourceContext, attemptToken: string): Promise<AttemptApi> {
  return ctx.api.get<AttemptApi>(`/api/v1/bookings/attempts/${encodeURIComponent(attemptToken)}`);
}

/**
 * Withdraw a request (or cancel a booking): the server refunds on the tier the booking locked, and a request
 * the host has not accepted is refunded in full.
 */
export async function cancelBooking(
  ctx: SourceContext,
  reference: string,
): Promise<{ refundRwf: number; status: string }> {
  return ctx.api.post(`/api/v1/bookings/${encodeURIComponent(reference)}/cancel`);
}
