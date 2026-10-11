import { z } from "zod";
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
export declare const TripStage: z.ZodEnum<["upcoming", "in_progress", "past", "cancelled"]>;
export type TripStage = z.infer<typeof TripStage>;
export declare const GuestTrip: z.ZodObject<{
    id: z.ZodString;
    /** The code the guest was shown at checkout, and the receipt's address. */
    reference: z.ZodString;
    status: z.ZodEnum<["pending_approval", "confirmed", "declined", "cancelled", "no_show"]>;
    /** Null until money has a state of its own — a request awaiting a host. */
    paymentStatus: z.ZodNullable<z.ZodEnum<["captured", "refunded_full", "refunded_partial", "forfeited", "paid_out"]>>;
    stage: z.ZodEnum<["upcoming", "in_progress", "past", "cancelled"]>;
    checkIn: z.ZodString;
    checkOut: z.ZodString;
    nights: z.ZodNumber;
    guests: z.ZodNumber;
    /**
     * Where they are going, as the DATABASE names it, never as a fixture does.
     * `propertySlug` is nullable because a property may not have one yet, and a
     * trip card must degrade to plain text rather than link nowhere.
     */
    propertyName: z.ZodString;
    propertySlug: z.ZodNullable<z.ZodString>;
    districtName: z.ZodNullable<z.ZodString>;
    roomTypeName: z.ZodString;
    /** The property's zone, so a client formats a date the way the desk reads it. */
    timezone: z.ZodString;
    /** What was actually agreed, from the booking row. Null on a legacy row. */
    grossRwf: z.ZodNullable<z.ZodNumber>;
    nonRefundable: z.ZodBoolean;
    cancellationTier: z.ZodNullable<z.ZodEnum<["flexible", "moderate", "limited", "firm", "strict_extended_stay"]>>;
    bookedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "declined" | "pending_approval" | "confirmed" | "cancelled" | "no_show";
    stage: "cancelled" | "in_progress" | "upcoming" | "past";
    districtName: string | null;
    id: string;
    reference: string;
    propertyName: string;
    cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
    nights: number;
    checkIn: string;
    checkOut: string;
    guests: number;
    nonRefundable: boolean;
    grossRwf: number | null;
    paymentStatus: "captured" | "refunded_full" | "refunded_partial" | "forfeited" | "paid_out" | null;
    roomTypeName: string;
    timezone: string;
    propertySlug: string | null;
    bookedAt: string;
}, {
    status: "declined" | "pending_approval" | "confirmed" | "cancelled" | "no_show";
    stage: "cancelled" | "in_progress" | "upcoming" | "past";
    districtName: string | null;
    id: string;
    reference: string;
    propertyName: string;
    cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
    nights: number;
    checkIn: string;
    checkOut: string;
    guests: number;
    nonRefundable: boolean;
    grossRwf: number | null;
    paymentStatus: "captured" | "refunded_full" | "refunded_partial" | "forfeited" | "paid_out" | null;
    roomTypeName: string;
    timezone: string;
    propertySlug: string | null;
    bookedAt: string;
}>;
export type GuestTrip = z.infer<typeof GuestTrip>;
/**
 * The list, newest stay first.
 *
 * An object rather than a bare array, for the reason every list endpoint here
 * is: an array cannot grow a sibling field (a count, a cursor) without becoming
 * a breaking change on every client at once.
 */
export declare const MyTrips: z.ZodObject<{
    trips: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        /** The code the guest was shown at checkout, and the receipt's address. */
        reference: z.ZodString;
        status: z.ZodEnum<["pending_approval", "confirmed", "declined", "cancelled", "no_show"]>;
        /** Null until money has a state of its own — a request awaiting a host. */
        paymentStatus: z.ZodNullable<z.ZodEnum<["captured", "refunded_full", "refunded_partial", "forfeited", "paid_out"]>>;
        stage: z.ZodEnum<["upcoming", "in_progress", "past", "cancelled"]>;
        checkIn: z.ZodString;
        checkOut: z.ZodString;
        nights: z.ZodNumber;
        guests: z.ZodNumber;
        /**
         * Where they are going, as the DATABASE names it, never as a fixture does.
         * `propertySlug` is nullable because a property may not have one yet, and a
         * trip card must degrade to plain text rather than link nowhere.
         */
        propertyName: z.ZodString;
        propertySlug: z.ZodNullable<z.ZodString>;
        districtName: z.ZodNullable<z.ZodString>;
        roomTypeName: z.ZodString;
        /** The property's zone, so a client formats a date the way the desk reads it. */
        timezone: z.ZodString;
        /** What was actually agreed, from the booking row. Null on a legacy row. */
        grossRwf: z.ZodNullable<z.ZodNumber>;
        nonRefundable: z.ZodBoolean;
        cancellationTier: z.ZodNullable<z.ZodEnum<["flexible", "moderate", "limited", "firm", "strict_extended_stay"]>>;
        bookedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "declined" | "pending_approval" | "confirmed" | "cancelled" | "no_show";
        stage: "cancelled" | "in_progress" | "upcoming" | "past";
        districtName: string | null;
        id: string;
        reference: string;
        propertyName: string;
        cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
        nights: number;
        checkIn: string;
        checkOut: string;
        guests: number;
        nonRefundable: boolean;
        grossRwf: number | null;
        paymentStatus: "captured" | "refunded_full" | "refunded_partial" | "forfeited" | "paid_out" | null;
        roomTypeName: string;
        timezone: string;
        propertySlug: string | null;
        bookedAt: string;
    }, {
        status: "declined" | "pending_approval" | "confirmed" | "cancelled" | "no_show";
        stage: "cancelled" | "in_progress" | "upcoming" | "past";
        districtName: string | null;
        id: string;
        reference: string;
        propertyName: string;
        cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
        nights: number;
        checkIn: string;
        checkOut: string;
        guests: number;
        nonRefundable: boolean;
        grossRwf: number | null;
        paymentStatus: "captured" | "refunded_full" | "refunded_partial" | "forfeited" | "paid_out" | null;
        roomTypeName: string;
        timezone: string;
        propertySlug: string | null;
        bookedAt: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    trips: {
        status: "declined" | "pending_approval" | "confirmed" | "cancelled" | "no_show";
        stage: "cancelled" | "in_progress" | "upcoming" | "past";
        districtName: string | null;
        id: string;
        reference: string;
        propertyName: string;
        cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
        nights: number;
        checkIn: string;
        checkOut: string;
        guests: number;
        nonRefundable: boolean;
        grossRwf: number | null;
        paymentStatus: "captured" | "refunded_full" | "refunded_partial" | "forfeited" | "paid_out" | null;
        roomTypeName: string;
        timezone: string;
        propertySlug: string | null;
        bookedAt: string;
    }[];
}, {
    trips: {
        status: "declined" | "pending_approval" | "confirmed" | "cancelled" | "no_show";
        stage: "cancelled" | "in_progress" | "upcoming" | "past";
        districtName: string | null;
        id: string;
        reference: string;
        propertyName: string;
        cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
        nights: number;
        checkIn: string;
        checkOut: string;
        guests: number;
        nonRefundable: boolean;
        grossRwf: number | null;
        paymentStatus: "captured" | "refunded_full" | "refunded_partial" | "forfeited" | "paid_out" | null;
        roomTypeName: string;
        timezone: string;
        propertySlug: string | null;
        bookedAt: string;
    }[];
}>;
export type MyTrips = z.infer<typeof MyTrips>;
//# sourceMappingURL=trips.d.ts.map