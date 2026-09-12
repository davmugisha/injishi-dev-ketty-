import {
  MAX_HORIZON_DAYS,
  MAX_NIGHTS,
  soldOutNights,
  type RoomAvailability,
} from "@injishi/contracts";
import { apiFetch, type ApiResult } from "@/lib/api";

/**
 * What is left to sell, for the calendar (ADR-047 wave E).
 *
 * ## Why the picker needs this
 *
 * `BookingRepository.freeUnits` was always correct and was reachable from
 * exactly one place: inside `BookingService.create`. So the calendar offered
 * sold-out nights, the widget priced them, the guest chose a payment method,
 * and the first anyone said "that room is gone" was a 409 on the last click —
 * after a charge had been attempted and compensated. The room was never
 * available; only this screen said otherwise.
 *
 * ## The window this asks for
 *
 * Today through the booking horizon, and no further, because nothing past it
 * can be sold. `MAX_HORIZON_DAYS` comes from `@injishi/contracts` — it used to
 * be a server-only constant, which is precisely why the picker could offer a
 * date three years out that the API would refuse at the last step.
 */

/** Today in the property's calendar, as `yyyy-mm-dd`. */
export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Kigali",
  }).format(new Date());
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The nights a guest must not be offered, plus the room's own minimum stay. */
export interface BookingCalendar {
  /** `yyyy-mm-dd` of every night with nothing left. */
  soldOut: Set<string>;
  /** The shortest stay this room accepts. 1 when the host set none. */
  minStay: number;
  /** The last night that can be booked at all. */
  lastBookableNight: string;
}

/**
 * Read the calendar for one room type.
 *
 * A failure is NOT treated as "everything is sold out". A calendar that greys
 * itself out because the network hiccuped tells the guest this property is
 * full, which is a lie that costs a booking — and the server re-checks
 * availability under a row lock at the moment of purchase anyway, so an
 * optimistic calendar is safe and a pessimistic one is not.
 */
export async function fetchBookingCalendar(
  roomTypeId: string,
): Promise<BookingCalendar | null> {
  const from = todayISO();
  const to = addDays(from, MAX_HORIZON_DAYS + 1);

  const result: ApiResult<RoomAvailability> = await apiFetch<RoomAvailability>(
    `/api/v1/room-types/${roomTypeId}/availability?from=${from}&to=${to}`,
  );
  if (result.status !== "ok") return null;

  return {
    soldOut: new Set(soldOutNights(result.data)),
    minStay: result.data.minStay,
    lastBookableNight: addDays(from, MAX_HORIZON_DAYS),
  };
}

/**
 * Why a chosen range cannot be booked, or null.
 *
 * These are the SERVER's rules, read from the shared contract rather than
 * guessed: `MAX_NIGHTS` and `MAX_HORIZON_DAYS` were server-only constants, so
 * the picker happily accepted a 120-night stay and the API refused it after the
 * guest had filled in everything. Saying it here, in the picker, is the whole
 * point — the API still enforces all of it, and must.
 */
export function rangeProblem(
  checkIn: string,
  checkOut: string,
  calendar: BookingCalendar | null,
): string | null {
  const nights = Math.round(
    (Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`)) /
      86_400_000,
  );

  if (nights <= 0) return "Check-out must be after check-in.";
  if (nights > MAX_NIGHTS) return `Stays are limited to ${MAX_NIGHTS} nights.`;
  if (checkIn > addDays(todayISO(), MAX_HORIZON_DAYS)) {
    return "Bookings open up to 18 months ahead.";
  }

  if (!calendar) return null;

  if (nights < calendar.minStay) {
    return `This room has a ${calendar.minStay}-night minimum stay.`;
  }

  // A sold-out night ANYWHERE inside the range blocks it, not just at the
  // edges: a guest cannot have the room for three nights when the middle one
  // belongs to somebody else.
  for (let night = checkIn; night < checkOut; night = addDays(night, 1)) {
    if (calendar.soldOut.has(night)) {
      return "Some of those nights are taken. Pick different dates.";
    }
  }

  return null;
}
