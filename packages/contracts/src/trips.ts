import { z } from "zod";
import {
  BookingStatus,
  CancellationTier,
  IsoDate,
  PaymentStatus,
} from "./booking";
import { RwfAmount, Uuid } from "./primitives";

/**
 * A guest's own stays — `GET /api/v1/me/trips`.
 *
 * WHY THIS EXISTS. A guest could book, pay, and be shown a reference, and then
 * had nowhere to see it again: `/trips` in `apps/web` rendered a hardcoded empty
 * state, because no endpoint served a guest their own bookings. The page had to
 * say so out loud — "we're still connecting this page" — to avoid telling
 * somebody who had just paid that they had no trips. This is the endpoint that
 * retires that sentence.
 *
 * IT IS A READ OF WHAT WAS LOCKED, NOT A RECOMPUTE. `ui-rules.md`: *"Show
 * price/refund tier as locked at booking time — never recompute."* Every money
 * and policy field below comes off the booking row, which snapshots the rate,
 * the tier and the terms at the moment of sale (D8), so a stay booked under
 * last month's price still reads at last month's price.
 *
 * THE STAGE IS THE SERVER'S ANSWER, and that is deliberate. Whether a stay is
 * upcoming, under way or over is a question about the PROPERTY's calendar day,
 * not the reader's: a guest in London opening this at 23:00 their time is
 * looking at tomorrow in Kigali. Computing it in the browser would make the
 * answer depend on where the browser is. The API derives it with the same
 * `localToday()` the booking rules already use.
 */

/**
 * Where a stay sits relative to today, in the property's timezone.
 *
 * `cancelled` is not a date at all and wins over one: a declined or cancelled
 * booking whose dates are still in the future is not "upcoming", and grouping it
 * with live stays is how somebody packs for a stay they no longer hold.
 */
export const TripStage = z.enum(["upcoming", "in_progress", "past", "cancelled"]);
export type TripStage = z.infer<typeof TripStage>;

export const GuestTrip = z.object({
  id: Uuid,
  /** The code the guest was shown at checkout, and the receipt's address. */
  reference: z.string().min(1),
  status: BookingStatus,
  /** Null until money has a state of its own — a request awaiting a host. */
  paymentStatus: PaymentStatus.nullable(),
  stage: TripStage,

  checkIn: IsoDate,
  checkOut: IsoDate,
  nights: z.number().int().positive(),
  guests: z.number().int().positive(),

  /**
   * Where they are going, as the DATABASE names it, never as a fixture does.
   * `propertySlug` is nullable because a property may not have one yet, and a
   * trip card must degrade to plain text rather than link nowhere.
   */
  propertyName: z.string().min(1),
  propertySlug: z.string().nullable(),
  districtName: z.string().nullable(),
  roomTypeName: z.string().min(1),
  /** The property's zone, so a client formats a date the way the desk reads it. */
  timezone: z.string().min(1),

  /** What was actually agreed, from the booking row. Null on a legacy row. */
  grossRwf: RwfAmount.nullable(),
  nonRefundable: z.boolean(),
  cancellationTier: CancellationTier.nullable(),

  bookedAt: z.string().datetime({ offset: true }),
});
export type GuestTrip = z.infer<typeof GuestTrip>;

/**
 * The list, newest stay first.
 *
 * An object rather than a bare array, for the reason every list endpoint here
 * is: an array cannot grow a sibling field (a count, a cursor) without becoming
 * a breaking change on every client at once.
 */
export const MyTrips = z.object({
  trips: z.array(GuestTrip),
});
export type MyTrips = z.infer<typeof MyTrips>;
