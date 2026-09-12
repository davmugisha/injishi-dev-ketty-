"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MyTrips = exports.GuestTrip = exports.TripStage = void 0;
const zod_1 = require("zod");
const booking_1 = require("./booking");
const primitives_1 = require("./primitives");
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
exports.TripStage = zod_1.z.enum(["upcoming", "in_progress", "past", "cancelled"]);
exports.GuestTrip = zod_1.z.object({
    id: primitives_1.Uuid,
    /** The code the guest was shown at checkout, and the receipt's address. */
    reference: zod_1.z.string().min(1),
    status: booking_1.BookingStatus,
    /** Null until money has a state of its own — a request awaiting a host. */
    paymentStatus: booking_1.PaymentStatus.nullable(),
    stage: exports.TripStage,
    checkIn: booking_1.IsoDate,
    checkOut: booking_1.IsoDate,
    nights: zod_1.z.number().int().positive(),
    guests: zod_1.z.number().int().positive(),
    /**
     * Where they are going, as the DATABASE names it, never as a fixture does.
     * `propertySlug` is nullable because a property may not have one yet, and a
     * trip card must degrade to plain text rather than link nowhere.
     */
    propertyName: zod_1.z.string().min(1),
    propertySlug: zod_1.z.string().nullable(),
    districtName: zod_1.z.string().nullable(),
    roomTypeName: zod_1.z.string().min(1),
    /** The property's zone, so a client formats a date the way the desk reads it. */
    timezone: zod_1.z.string().min(1),
    /** What was actually agreed, from the booking row. Null on a legacy row. */
    grossRwf: primitives_1.RwfAmount.nullable(),
    nonRefundable: zod_1.z.boolean(),
    cancellationTier: booking_1.CancellationTier.nullable(),
    bookedAt: zod_1.z.string().datetime({ offset: true }),
});
/**
 * The list, newest stay first.
 *
 * An object rather than a bare array, for the reason every list endpoint here
 * is: an array cannot grow a sibling field (a count, a cursor) without becoming
 * a breaking change on every client at once.
 */
exports.MyTrips = zod_1.z.object({
    trips: zod_1.z.array(exports.GuestTrip),
});
//# sourceMappingURL=trips.js.map