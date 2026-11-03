// The guest's money and rule words (mobile spec 0005, cross child contract "Money display"). Pure: no
// React Native import, so `node --test` runs it. The phone never computes a price: it words the
// figure and the basis the API returned.

import {
  type BookingStatus,
  CANCELLATION_TIERS,
  type CancellationTier,
  type ExplorePriceBasis,
} from "@injishi/contracts";

/** "RWF 140,000": whole francs, grouped by thousands. */
export function rwf(amount: number): string {
  const digits = String(Math.round(Math.abs(amount))).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${amount < 0 ? "-" : ""}RWF ${digits}`;
}

/**
 * What a price covers, after the figure (D-j): "a night for 2" with a party; with none, "a night" for
 * a room priced per room or a whole place and "a person, a night" for a room priced per person; "a
 * month" for a home.
 */
export function basisWords(basis: ExplorePriceBasis, billableGuests?: number): string {
  switch (basis) {
    case "person_night":
      return "a person, a night";
    case "unit_night":
      return "a night";
    case "party_night":
      return billableGuests ? `a night for ${billableGuests}` : "a night";
    case "month":
      return "a month";
  }
}

/** A price line, or "Price on request" when nothing is priced (no figure, or a room with no basis). */
export function priceWords(priceRwf: number | null, basis: ExplorePriceBasis | null, billableGuests?: number): string {
  return priceRwf === null || basis === null
    ? "Price on request"
    : `${rwf(priceRwf)} ${basisWords(basis, billableGuests)}`;
}

/** How a stay is booked, as the card's badge says it (AC-6, AC-15). */
export function bookingWords(
  bookingMode: "instant_book" | "request_to_book" | null,
  approvalWindowHours: number | null,
): string | null {
  if (bookingMode === "instant_book") return "Instant booking";
  if (bookingMode === "request_to_book") {
    return approvalWindowHours ? `Replies in about ${approvalWindowHours} h` : "Request to book";
  }
  return null;
}

/** "24 hours" or "5 days", the way the refund rule names a window. */
function windowWords(hours: number): string {
  return hours % 24 === 0 && hours >= 48 ? `${hours / 24} days` : `${hours} hours`;
}

/**
 * A room's refund rule before dates are chosen, from its cancellation tier (the same table the quote
 * and the cancellation use; a room with no tier is quoted as flexible).
 */
export function tierRefundWords(tier: CancellationTier | null): string {
  const rule = CANCELLATION_TIERS[tier ?? "flexible"];
  const window = windowWords(rule.windowHours);
  if (rule.beforePercent === 100 && rule.afterPercent === 0) return `Free cancellation until ${window} before check in`;
  if (rule.beforePercent === 100) {
    return `Free cancellation until ${window} before check in, then ${rule.afterPercent}% back`;
  }
  return `${rule.beforePercent}% back if you cancel ${window} or more before check in`;
}

/** "4.6 (128)", or "New" for a property nobody has reviewed yet. */
export function ratingWords(rating: number | null, reviewCount: number): string {
  if (rating === null || reviewCount === 0) return "New";
  return `${rating.toFixed(1)} (${reviewCount})`;
}

/** "24 stays", "1 home". */
export function countWords(count: number, mode: "stays" | "homes"): string {
  const noun = mode === "homes" ? "home" : "stay";
  return `${count} ${count === 1 ? noun : `${noun}s`}`;
}

/** The first one or two letters of a name, for a property with no photograph. */
export function initials(name: string): string {
  const words = name.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w));
  const letters = (words[0]?.[0] ?? "") + (words.length > 1 ? (words[1]?.[0] ?? "") : "");
  return letters.toUpperCase() || "?";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "14 Oct" from a calendar day (`yyyy-mm-dd`): a day, never an instant, so no time zone applies. */
export function dayWords(isoDate: string): string {
  const [, month, day] = isoDate.split("-").map(Number);
  return `${day} ${MONTHS[(month ?? 1) - 1]}`;
}

/** "14 to 16 Oct", or "30 Oct to 2 Nov" across a month. */
export function stayWords(checkIn: string, checkOut: string): string {
  const sameMonth = checkIn.slice(0, 7) === checkOut.slice(0, 7);
  return sameMonth
    ? `${Number(checkIn.slice(8, 10))} to ${dayWords(checkOut)}`
    : `${dayWords(checkIn)} to ${dayWords(checkOut)}`;
}

/** Every booking status, worded for the guest (the guest shell child: read the enum at build time). */
export const BOOKING_STATUS_WORDS: Readonly<Record<BookingStatus, string>> = {
  pending_approval: "Waiting for the host",
  confirmed: "Confirmed",
  declined: "Declined",
  cancelled: "Cancelled",
  no_show: "No show",
};
