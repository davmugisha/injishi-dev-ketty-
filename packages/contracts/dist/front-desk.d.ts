import { z } from "zod";
/**
 * The front desk's day, in one read (`GET /api/v1/ops/front-desk`).
 *
 * The desk's screens (Today, Check-in, Reservations, the request queue) all
 * look at the same property on the same day: who arrives, who is in, who
 * leaves, which rooms are ready and what is left to sell tonight. Read one row
 * at a time, that is a dozen requests that can each disagree with the last
 * about what "today" is. This answers all of it from one snapshot, with today
 * decided once, in Kigali, by the server.
 *
 * Every field is a column or derived from columns; nothing is invented here.
 * Money is whole francs. A folio balance is present only to a caller who may
 * read a bill (`folio.charge` or `money.view`); anyone else gets null.
 */
/**
 * Where a booking came from. Nullable on the row, because every booking made
 * before the column existed came through the marketplace and a null reads as
 * that. `walk_in` is reserved for a walk in that becomes a booking later; a
 * walk in today is a stay with no booking at all.
 */
export declare const BookingChannel: z.ZodEnum<["marketplace", "direct", "phone", "travel_agent", "corporate", "channel_manager", "walk_in"]>;
export type BookingChannel = z.infer<typeof BookingChannel>;
/** A room held for the booking over `[from, to)`. Released holds are not listed. */
export declare const FrontDeskHold: z.ZodObject<{
    roomId: z.ZodString;
    roomLabel: z.ZodNullable<z.ZodString>;
    from: z.ZodString;
    to: z.ZodString;
}, "strip", z.ZodTypeAny, {
    from: string;
    to: string;
    roomId: string;
    roomLabel: string | null;
}, {
    from: string;
    to: string;
    roomId: string;
    roomLabel: string | null;
}>;
export type FrontDeskHold = z.infer<typeof FrontDeskHold>;
/** A bill, as the desk needs to see it on a row. */
export declare const FrontDeskFolio: z.ZodObject<{
    id: z.ZodString;
    folioNumber: z.ZodString;
    status: z.ZodEnum<["open", "settled", "closed", "disputed"]>;
    /** Null when the caller may not read bills. */
    balanceRwf: z.ZodNullable<z.ZodNumber>;
    lockedAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "open" | "closed" | "settled" | "disputed";
    id: string;
    folioNumber: string;
    balanceRwf: number | null;
    lockedAt: string | null;
}, {
    status: "open" | "closed" | "settled" | "disputed";
    id: string;
    folioNumber: string;
    balanceRwf: number | null;
    lockedAt: string | null;
}>;
export type FrontDeskFolio = z.infer<typeof FrontDeskFolio>;
/**
 * What a cancellation or a no-show would do to the money now, computed by
 * `cancellationRefund` on the booking's locked tier, so the desk sees the
 * number the command will move before it presses.
 */
export declare const FrontDeskRefundQuote: z.ZodObject<{
    refundRwf: z.ZodNumber;
    keptRwf: z.ZodNumber;
    /** The rule that decided it, in a sentence. */
    rule: z.ZodString;
}, "strip", z.ZodTypeAny, {
    refundRwf: number;
    rule: string;
    keptRwf: number;
}, {
    refundRwf: number;
    rule: string;
    keptRwf: number;
}>;
export type FrontDeskRefundQuote = z.infer<typeof FrontDeskRefundQuote>;
export declare const FrontDeskBooking: z.ZodObject<{
    id: z.ZodString;
    reference: z.ZodString;
    guestName: z.ZodNullable<z.ZodString>;
    /** The guest's display phone, when their profile has one. */
    guestPhone: z.ZodNullable<z.ZodString>;
    checkIn: z.ZodString;
    checkOut: z.ZodString;
    nights: z.ZodNumber;
    guestCount: z.ZodNumber;
    /** Null on a booking that did not record the split; read `guestCount`. */
    adults: z.ZodNullable<z.ZodNumber>;
    children: z.ZodNullable<z.ZodNumber>;
    roomTypeId: z.ZodString;
    roomTypeName: z.ZodString;
    status: z.ZodEnum<["pending_approval", "confirmed", "declined", "cancelled", "no_show"]>;
    state: z.ZodEnum<["pending", "confirmed", "inhouse", "checked_out", "declined", "cancelled", "no_show"]>;
    bookingMode: z.ZodEnum<["instant_book", "request_to_book"]>;
    cancellationTier: z.ZodNullable<z.ZodEnum<["flexible", "moderate", "limited", "firm", "strict_extended_stay"]>>;
    channel: z.ZodNullable<z.ZodEnum<["marketplace", "direct", "phone", "travel_agent", "corporate", "channel_manager", "walk_in"]>>;
    /** `HH:MM`, the guest's expected arrival in Kigali time. */
    eta: z.ZodNullable<z.ZodString>;
    deskNote: z.ZodNullable<z.ZodString>;
    totalRwf: z.ZodNumber;
    /** What one night costs the party, as locked at booking. */
    lockedNightlyRateRwf: z.ZodNumber;
    /** Money already taken and still held or paid out (the escrow). Zero when none. */
    paidRwf: z.ZodNumber;
    paymentStatus: z.ZodNullable<z.ZodEnum<["captured", "refunded_full", "refunded_partial", "forfeited", "paid_out"]>>;
    approvalExpiresAt: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    confirmedAt: z.ZodNullable<z.ZodString>;
    cancelledAt: z.ZodNullable<z.ZodString>;
    cancelledBy: z.ZodNullable<z.ZodString>;
    refundRwf: z.ZodNullable<z.ZodNumber>;
    noShowAt: z.ZodNullable<z.ZodString>;
    noShowReason: z.ZodNullable<z.ZodString>;
    holds: z.ZodArray<z.ZodObject<{
        roomId: z.ZodString;
        roomLabel: z.ZodNullable<z.ZodString>;
        from: z.ZodString;
        to: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        from: string;
        to: string;
        roomId: string;
        roomLabel: string | null;
    }, {
        from: string;
        to: string;
        roomId: string;
        roomLabel: string | null;
    }>, "many">;
    /** The guest sent their ID from their phone before arriving (ADR-060). */
    preArrivalIdentity: z.ZodBoolean;
    /** The stay this booking opened, if anyone checked in. */
    stay: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        reference: z.ZodNullable<z.ZodString>;
        lifecycle: z.ZodEnum<["open", "closed"]>;
        roomLabel: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        reference: string | null;
        roomLabel: string | null;
        lifecycle: "open" | "closed";
    }, {
        id: string;
        reference: string | null;
        roomLabel: string | null;
        lifecycle: "open" | "closed";
    }>>;
    folio: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        folioNumber: z.ZodString;
        status: z.ZodEnum<["open", "settled", "closed", "disputed"]>;
        /** Null when the caller may not read bills. */
        balanceRwf: z.ZodNullable<z.ZodNumber>;
        lockedAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "open" | "closed" | "settled" | "disputed";
        id: string;
        folioNumber: string;
        balanceRwf: number | null;
        lockedAt: string | null;
    }, {
        status: "open" | "closed" | "settled" | "disputed";
        id: string;
        folioNumber: string;
        balanceRwf: number | null;
        lockedAt: string | null;
    }>>;
    /** The guest's first message on the booking's conversation, if they wrote one. */
    guestMessage: z.ZodNullable<z.ZodString>;
    /** Cancelling now at the guest's request, while it can still be cancelled. */
    cancellation: z.ZodNullable<z.ZodObject<{
        refundRwf: z.ZodNumber;
        keptRwf: z.ZodNumber;
        /** The rule that decided it, in a sentence. */
        rule: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        refundRwf: number;
        rule: string;
        keptRwf: number;
    }, {
        refundRwf: number;
        rule: string;
        keptRwf: number;
    }>>;
    /** Recording a no-show now, once the arrival day has come and nobody checked in. */
    noShow: z.ZodNullable<z.ZodObject<{
        refundRwf: z.ZodNumber;
        keptRwf: z.ZodNumber;
        /** The rule that decided it, in a sentence. */
        rule: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        refundRwf: number;
        rule: string;
        keptRwf: number;
    }, {
        refundRwf: number;
        rule: string;
        keptRwf: number;
    }>>;
}, "strip", z.ZodTypeAny, {
    status: "declined" | "pending_approval" | "confirmed" | "cancelled" | "no_show";
    id: string;
    createdAt: string;
    reference: string;
    guestName: string | null;
    paidRwf: number;
    state: "pending" | "declined" | "confirmed" | "cancelled" | "no_show" | "inhouse" | "checked_out";
    bookingMode: "instant_book" | "request_to_book";
    cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
    roomTypeId: string;
    nights: number;
    checkIn: string;
    checkOut: string;
    paymentStatus: "captured" | "refunded_full" | "refunded_partial" | "forfeited" | "paid_out" | null;
    approvalExpiresAt: string | null;
    confirmedAt: string | null;
    refundRwf: number | null;
    cancelledBy: string | null;
    guestCount: number;
    roomTypeName: string;
    totalRwf: number;
    stay: {
        id: string;
        reference: string | null;
        roomLabel: string | null;
        lifecycle: "open" | "closed";
    } | null;
    channel: "phone" | "direct" | "marketplace" | "travel_agent" | "corporate" | "channel_manager" | "walk_in" | null;
    guestPhone: string | null;
    adults: number | null;
    children: number | null;
    eta: string | null;
    deskNote: string | null;
    lockedNightlyRateRwf: number;
    cancelledAt: string | null;
    noShowAt: string | null;
    noShowReason: string | null;
    holds: {
        from: string;
        to: string;
        roomId: string;
        roomLabel: string | null;
    }[];
    preArrivalIdentity: boolean;
    folio: {
        status: "open" | "closed" | "settled" | "disputed";
        id: string;
        folioNumber: string;
        balanceRwf: number | null;
        lockedAt: string | null;
    } | null;
    guestMessage: string | null;
    cancellation: {
        refundRwf: number;
        rule: string;
        keptRwf: number;
    } | null;
    noShow: {
        refundRwf: number;
        rule: string;
        keptRwf: number;
    } | null;
}, {
    status: "declined" | "pending_approval" | "confirmed" | "cancelled" | "no_show";
    id: string;
    createdAt: string;
    reference: string;
    guestName: string | null;
    paidRwf: number;
    state: "pending" | "declined" | "confirmed" | "cancelled" | "no_show" | "inhouse" | "checked_out";
    bookingMode: "instant_book" | "request_to_book";
    cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
    roomTypeId: string;
    nights: number;
    checkIn: string;
    checkOut: string;
    paymentStatus: "captured" | "refunded_full" | "refunded_partial" | "forfeited" | "paid_out" | null;
    approvalExpiresAt: string | null;
    confirmedAt: string | null;
    refundRwf: number | null;
    cancelledBy: string | null;
    guestCount: number;
    roomTypeName: string;
    totalRwf: number;
    stay: {
        id: string;
        reference: string | null;
        roomLabel: string | null;
        lifecycle: "open" | "closed";
    } | null;
    channel: "phone" | "direct" | "marketplace" | "travel_agent" | "corporate" | "channel_manager" | "walk_in" | null;
    guestPhone: string | null;
    adults: number | null;
    children: number | null;
    eta: string | null;
    deskNote: string | null;
    lockedNightlyRateRwf: number;
    cancelledAt: string | null;
    noShowAt: string | null;
    noShowReason: string | null;
    holds: {
        from: string;
        to: string;
        roomId: string;
        roomLabel: string | null;
    }[];
    preArrivalIdentity: boolean;
    folio: {
        status: "open" | "closed" | "settled" | "disputed";
        id: string;
        folioNumber: string;
        balanceRwf: number | null;
        lockedAt: string | null;
    } | null;
    guestMessage: string | null;
    cancellation: {
        refundRwf: number;
        rule: string;
        keptRwf: number;
    } | null;
    noShow: {
        refundRwf: number;
        rule: string;
        keptRwf: number;
    } | null;
}>;
export type FrontDeskBooking = z.infer<typeof FrontDeskBooking>;
export declare const FrontDeskStay: z.ZodObject<{
    id: z.ZodString;
    /** The human handle, `ST-…`. Null on a stay opened before references existed. */
    reference: z.ZodNullable<z.ZodString>;
    bookingId: z.ZodNullable<z.ZodString>;
    bookingReference: z.ZodNullable<z.ZodString>;
    guestName: z.ZodNullable<z.ZodString>;
    roomId: z.ZodString;
    roomLabel: z.ZodNullable<z.ZodString>;
    roomTypeName: z.ZodString;
    lifecycle: z.ZodEnum<["open", "closed"]>;
    entryAt: z.ZodString;
    plannedExitAt: z.ZodNullable<z.ZodString>;
    actualExitAt: z.ZodNullable<z.ZodString>;
    channel: z.ZodNullable<z.ZodEnum<["marketplace", "direct", "phone", "travel_agent", "corporate", "channel_manager", "walk_in"]>>;
    /** The booking's dates, or null for a walk in. */
    checkIn: z.ZodNullable<z.ZodString>;
    checkOut: z.ZodNullable<z.ZodString>;
    deskNote: z.ZodNullable<z.ZodString>;
    departureNote: z.ZodNullable<z.ZodString>;
    priceRwf: z.ZodNullable<z.ZodNumber>;
    folio: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        folioNumber: z.ZodString;
        status: z.ZodEnum<["open", "settled", "closed", "disputed"]>;
        /** Null when the caller may not read bills. */
        balanceRwf: z.ZodNullable<z.ZodNumber>;
        lockedAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "open" | "closed" | "settled" | "disputed";
        id: string;
        folioNumber: string;
        balanceRwf: number | null;
        lockedAt: string | null;
    }, {
        status: "open" | "closed" | "settled" | "disputed";
        id: string;
        folioNumber: string;
        balanceRwf: number | null;
        lockedAt: string | null;
    }>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    reference: string | null;
    guestName: string | null;
    priceRwf: number | null;
    checkIn: string | null;
    checkOut: string | null;
    roomTypeName: string;
    bookingId: string | null;
    roomId: string;
    roomLabel: string | null;
    lifecycle: "open" | "closed";
    entryAt: string;
    plannedExitAt: string | null;
    actualExitAt: string | null;
    channel: "phone" | "direct" | "marketplace" | "travel_agent" | "corporate" | "channel_manager" | "walk_in" | null;
    bookingReference: string | null;
    deskNote: string | null;
    folio: {
        status: "open" | "closed" | "settled" | "disputed";
        id: string;
        folioNumber: string;
        balanceRwf: number | null;
        lockedAt: string | null;
    } | null;
    departureNote: string | null;
}, {
    id: string;
    reference: string | null;
    guestName: string | null;
    priceRwf: number | null;
    checkIn: string | null;
    checkOut: string | null;
    roomTypeName: string;
    bookingId: string | null;
    roomId: string;
    roomLabel: string | null;
    lifecycle: "open" | "closed";
    entryAt: string;
    plannedExitAt: string | null;
    actualExitAt: string | null;
    channel: "phone" | "direct" | "marketplace" | "travel_agent" | "corporate" | "channel_manager" | "walk_in" | null;
    bookingReference: string | null;
    deskNote: string | null;
    folio: {
        status: "open" | "closed" | "settled" | "disputed";
        id: string;
        folioNumber: string;
        balanceRwf: number | null;
        lockedAt: string | null;
    } | null;
    departureNote: string | null;
}>;
export type FrontDeskStay = z.infer<typeof FrontDeskStay>;
export declare const FrontDeskRoom: z.ZodObject<{
    id: z.ZodString;
    label: z.ZodNullable<z.ZodString>;
    roomTypeId: z.ZodString;
    roomTypeName: z.ZodString;
    status: z.ZodEnum<["available", "maintenance", "out_of_service"]>;
    housekeeping: z.ZodEnum<["clean", "dirty", "inspected", "out_of_order"]>;
    housekeepingUpdatedAt: z.ZodNullable<z.ZodString>;
    /** The open stay in the room now. */
    occupant: z.ZodNullable<z.ZodObject<{
        stayId: z.ZodString;
        guestName: z.ZodNullable<z.ZodString>;
        plannedExitAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        stayId: string;
        guestName: string | null;
        plannedExitAt: string | null;
    }, {
        stayId: string;
        guestName: string | null;
        plannedExitAt: string | null;
    }>>;
    /** The booking holding this room tonight, if any. */
    heldTonightBy: z.ZodNullable<z.ZodObject<{
        bookingId: z.ZodString;
        reference: z.ZodString;
        guestName: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        reference: string;
        guestName: string | null;
        bookingId: string;
    }, {
        reference: string;
        guestName: string | null;
        bookingId: string;
    }>>;
}, "strip", z.ZodTypeAny, {
    status: "available" | "maintenance" | "out_of_service";
    id: string;
    label: string | null;
    roomTypeId: string;
    roomTypeName: string;
    housekeeping: "dirty" | "clean" | "inspected" | "out_of_order";
    housekeepingUpdatedAt: string | null;
    occupant: {
        stayId: string;
        guestName: string | null;
        plannedExitAt: string | null;
    } | null;
    heldTonightBy: {
        reference: string;
        guestName: string | null;
        bookingId: string;
    } | null;
}, {
    status: "available" | "maintenance" | "out_of_service";
    id: string;
    label: string | null;
    roomTypeId: string;
    roomTypeName: string;
    housekeeping: "dirty" | "clean" | "inspected" | "out_of_order";
    housekeepingUpdatedAt: string | null;
    occupant: {
        stayId: string;
        guestName: string | null;
        plannedExitAt: string | null;
    } | null;
    heldTonightBy: {
        reference: string;
        guestName: string | null;
        bookingId: string;
    } | null;
}>;
export type FrontDeskRoom = z.infer<typeof FrontDeskRoom>;
export declare const FrontDeskRoomType: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    sleeps: z.ZodNumber;
    /** The default rate plan's nightly price, or the type's base price. */
    rateRwf: z.ZodNullable<z.ZodNumber>;
    /** "1 queen bed", from the type's bed rows; null when none are recorded. */
    beds: z.ZodNullable<z.ZodString>;
    active: z.ZodBoolean;
    /** Rooms of this type the property has, on sale. */
    roomCount: z.ZodNumber;
    /**
     * Rooms of this type nobody sleeps in tonight and nobody holds for tonight,
     * that are not out of order: what the desk can still sell for tonight.
     */
    freeTonight: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    active: boolean;
    name: string;
    id: string;
    roomCount: number;
    sleeps: number;
    rateRwf: number | null;
    beds: string | null;
    freeTonight: number;
}, {
    active: boolean;
    name: string;
    id: string;
    roomCount: number;
    sleeps: number;
    rateRwf: number | null;
    beds: string | null;
    freeTonight: number;
}>;
export type FrontDeskRoomType = z.infer<typeof FrontDeskRoomType>;
export declare const FrontDeskBoard: z.ZodObject<{
    property: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        /** `HH:MM`. */
        checkInTime: z.ZodNullable<z.ZodString>;
        checkOutTime: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
        checkInTime: string | null;
        checkOutTime: string | null;
    }, {
        name: string;
        id: string;
        checkInTime: string | null;
        checkOutTime: string | null;
    }>;
    /** Today in Kigali, as the server decided it. */
    today: z.ZodString;
    generatedAt: z.ZodString;
    /** Whether the balances below were readable by the caller. */
    canReadBills: z.ZodBoolean;
    bookings: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        reference: z.ZodString;
        guestName: z.ZodNullable<z.ZodString>;
        /** The guest's display phone, when their profile has one. */
        guestPhone: z.ZodNullable<z.ZodString>;
        checkIn: z.ZodString;
        checkOut: z.ZodString;
        nights: z.ZodNumber;
        guestCount: z.ZodNumber;
        /** Null on a booking that did not record the split; read `guestCount`. */
        adults: z.ZodNullable<z.ZodNumber>;
        children: z.ZodNullable<z.ZodNumber>;
        roomTypeId: z.ZodString;
        roomTypeName: z.ZodString;
        status: z.ZodEnum<["pending_approval", "confirmed", "declined", "cancelled", "no_show"]>;
        state: z.ZodEnum<["pending", "confirmed", "inhouse", "checked_out", "declined", "cancelled", "no_show"]>;
        bookingMode: z.ZodEnum<["instant_book", "request_to_book"]>;
        cancellationTier: z.ZodNullable<z.ZodEnum<["flexible", "moderate", "limited", "firm", "strict_extended_stay"]>>;
        channel: z.ZodNullable<z.ZodEnum<["marketplace", "direct", "phone", "travel_agent", "corporate", "channel_manager", "walk_in"]>>;
        /** `HH:MM`, the guest's expected arrival in Kigali time. */
        eta: z.ZodNullable<z.ZodString>;
        deskNote: z.ZodNullable<z.ZodString>;
        totalRwf: z.ZodNumber;
        /** What one night costs the party, as locked at booking. */
        lockedNightlyRateRwf: z.ZodNumber;
        /** Money already taken and still held or paid out (the escrow). Zero when none. */
        paidRwf: z.ZodNumber;
        paymentStatus: z.ZodNullable<z.ZodEnum<["captured", "refunded_full", "refunded_partial", "forfeited", "paid_out"]>>;
        approvalExpiresAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        confirmedAt: z.ZodNullable<z.ZodString>;
        cancelledAt: z.ZodNullable<z.ZodString>;
        cancelledBy: z.ZodNullable<z.ZodString>;
        refundRwf: z.ZodNullable<z.ZodNumber>;
        noShowAt: z.ZodNullable<z.ZodString>;
        noShowReason: z.ZodNullable<z.ZodString>;
        holds: z.ZodArray<z.ZodObject<{
            roomId: z.ZodString;
            roomLabel: z.ZodNullable<z.ZodString>;
            from: z.ZodString;
            to: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            from: string;
            to: string;
            roomId: string;
            roomLabel: string | null;
        }, {
            from: string;
            to: string;
            roomId: string;
            roomLabel: string | null;
        }>, "many">;
        /** The guest sent their ID from their phone before arriving (ADR-060). */
        preArrivalIdentity: z.ZodBoolean;
        /** The stay this booking opened, if anyone checked in. */
        stay: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            reference: z.ZodNullable<z.ZodString>;
            lifecycle: z.ZodEnum<["open", "closed"]>;
            roomLabel: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            reference: string | null;
            roomLabel: string | null;
            lifecycle: "open" | "closed";
        }, {
            id: string;
            reference: string | null;
            roomLabel: string | null;
            lifecycle: "open" | "closed";
        }>>;
        folio: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            folioNumber: z.ZodString;
            status: z.ZodEnum<["open", "settled", "closed", "disputed"]>;
            /** Null when the caller may not read bills. */
            balanceRwf: z.ZodNullable<z.ZodNumber>;
            lockedAt: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            status: "open" | "closed" | "settled" | "disputed";
            id: string;
            folioNumber: string;
            balanceRwf: number | null;
            lockedAt: string | null;
        }, {
            status: "open" | "closed" | "settled" | "disputed";
            id: string;
            folioNumber: string;
            balanceRwf: number | null;
            lockedAt: string | null;
        }>>;
        /** The guest's first message on the booking's conversation, if they wrote one. */
        guestMessage: z.ZodNullable<z.ZodString>;
        /** Cancelling now at the guest's request, while it can still be cancelled. */
        cancellation: z.ZodNullable<z.ZodObject<{
            refundRwf: z.ZodNumber;
            keptRwf: z.ZodNumber;
            /** The rule that decided it, in a sentence. */
            rule: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            refundRwf: number;
            rule: string;
            keptRwf: number;
        }, {
            refundRwf: number;
            rule: string;
            keptRwf: number;
        }>>;
        /** Recording a no-show now, once the arrival day has come and nobody checked in. */
        noShow: z.ZodNullable<z.ZodObject<{
            refundRwf: z.ZodNumber;
            keptRwf: z.ZodNumber;
            /** The rule that decided it, in a sentence. */
            rule: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            refundRwf: number;
            rule: string;
            keptRwf: number;
        }, {
            refundRwf: number;
            rule: string;
            keptRwf: number;
        }>>;
    }, "strip", z.ZodTypeAny, {
        status: "declined" | "pending_approval" | "confirmed" | "cancelled" | "no_show";
        id: string;
        createdAt: string;
        reference: string;
        guestName: string | null;
        paidRwf: number;
        state: "pending" | "declined" | "confirmed" | "cancelled" | "no_show" | "inhouse" | "checked_out";
        bookingMode: "instant_book" | "request_to_book";
        cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
        roomTypeId: string;
        nights: number;
        checkIn: string;
        checkOut: string;
        paymentStatus: "captured" | "refunded_full" | "refunded_partial" | "forfeited" | "paid_out" | null;
        approvalExpiresAt: string | null;
        confirmedAt: string | null;
        refundRwf: number | null;
        cancelledBy: string | null;
        guestCount: number;
        roomTypeName: string;
        totalRwf: number;
        stay: {
            id: string;
            reference: string | null;
            roomLabel: string | null;
            lifecycle: "open" | "closed";
        } | null;
        channel: "phone" | "direct" | "marketplace" | "travel_agent" | "corporate" | "channel_manager" | "walk_in" | null;
        guestPhone: string | null;
        adults: number | null;
        children: number | null;
        eta: string | null;
        deskNote: string | null;
        lockedNightlyRateRwf: number;
        cancelledAt: string | null;
        noShowAt: string | null;
        noShowReason: string | null;
        holds: {
            from: string;
            to: string;
            roomId: string;
            roomLabel: string | null;
        }[];
        preArrivalIdentity: boolean;
        folio: {
            status: "open" | "closed" | "settled" | "disputed";
            id: string;
            folioNumber: string;
            balanceRwf: number | null;
            lockedAt: string | null;
        } | null;
        guestMessage: string | null;
        cancellation: {
            refundRwf: number;
            rule: string;
            keptRwf: number;
        } | null;
        noShow: {
            refundRwf: number;
            rule: string;
            keptRwf: number;
        } | null;
    }, {
        status: "declined" | "pending_approval" | "confirmed" | "cancelled" | "no_show";
        id: string;
        createdAt: string;
        reference: string;
        guestName: string | null;
        paidRwf: number;
        state: "pending" | "declined" | "confirmed" | "cancelled" | "no_show" | "inhouse" | "checked_out";
        bookingMode: "instant_book" | "request_to_book";
        cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
        roomTypeId: string;
        nights: number;
        checkIn: string;
        checkOut: string;
        paymentStatus: "captured" | "refunded_full" | "refunded_partial" | "forfeited" | "paid_out" | null;
        approvalExpiresAt: string | null;
        confirmedAt: string | null;
        refundRwf: number | null;
        cancelledBy: string | null;
        guestCount: number;
        roomTypeName: string;
        totalRwf: number;
        stay: {
            id: string;
            reference: string | null;
            roomLabel: string | null;
            lifecycle: "open" | "closed";
        } | null;
        channel: "phone" | "direct" | "marketplace" | "travel_agent" | "corporate" | "channel_manager" | "walk_in" | null;
        guestPhone: string | null;
        adults: number | null;
        children: number | null;
        eta: string | null;
        deskNote: string | null;
        lockedNightlyRateRwf: number;
        cancelledAt: string | null;
        noShowAt: string | null;
        noShowReason: string | null;
        holds: {
            from: string;
            to: string;
            roomId: string;
            roomLabel: string | null;
        }[];
        preArrivalIdentity: boolean;
        folio: {
            status: "open" | "closed" | "settled" | "disputed";
            id: string;
            folioNumber: string;
            balanceRwf: number | null;
            lockedAt: string | null;
        } | null;
        guestMessage: string | null;
        cancellation: {
            refundRwf: number;
            rule: string;
            keptRwf: number;
        } | null;
        noShow: {
            refundRwf: number;
            rule: string;
            keptRwf: number;
        } | null;
    }>, "many">;
    stays: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        /** The human handle, `ST-…`. Null on a stay opened before references existed. */
        reference: z.ZodNullable<z.ZodString>;
        bookingId: z.ZodNullable<z.ZodString>;
        bookingReference: z.ZodNullable<z.ZodString>;
        guestName: z.ZodNullable<z.ZodString>;
        roomId: z.ZodString;
        roomLabel: z.ZodNullable<z.ZodString>;
        roomTypeName: z.ZodString;
        lifecycle: z.ZodEnum<["open", "closed"]>;
        entryAt: z.ZodString;
        plannedExitAt: z.ZodNullable<z.ZodString>;
        actualExitAt: z.ZodNullable<z.ZodString>;
        channel: z.ZodNullable<z.ZodEnum<["marketplace", "direct", "phone", "travel_agent", "corporate", "channel_manager", "walk_in"]>>;
        /** The booking's dates, or null for a walk in. */
        checkIn: z.ZodNullable<z.ZodString>;
        checkOut: z.ZodNullable<z.ZodString>;
        deskNote: z.ZodNullable<z.ZodString>;
        departureNote: z.ZodNullable<z.ZodString>;
        priceRwf: z.ZodNullable<z.ZodNumber>;
        folio: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            folioNumber: z.ZodString;
            status: z.ZodEnum<["open", "settled", "closed", "disputed"]>;
            /** Null when the caller may not read bills. */
            balanceRwf: z.ZodNullable<z.ZodNumber>;
            lockedAt: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            status: "open" | "closed" | "settled" | "disputed";
            id: string;
            folioNumber: string;
            balanceRwf: number | null;
            lockedAt: string | null;
        }, {
            status: "open" | "closed" | "settled" | "disputed";
            id: string;
            folioNumber: string;
            balanceRwf: number | null;
            lockedAt: string | null;
        }>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        reference: string | null;
        guestName: string | null;
        priceRwf: number | null;
        checkIn: string | null;
        checkOut: string | null;
        roomTypeName: string;
        bookingId: string | null;
        roomId: string;
        roomLabel: string | null;
        lifecycle: "open" | "closed";
        entryAt: string;
        plannedExitAt: string | null;
        actualExitAt: string | null;
        channel: "phone" | "direct" | "marketplace" | "travel_agent" | "corporate" | "channel_manager" | "walk_in" | null;
        bookingReference: string | null;
        deskNote: string | null;
        folio: {
            status: "open" | "closed" | "settled" | "disputed";
            id: string;
            folioNumber: string;
            balanceRwf: number | null;
            lockedAt: string | null;
        } | null;
        departureNote: string | null;
    }, {
        id: string;
        reference: string | null;
        guestName: string | null;
        priceRwf: number | null;
        checkIn: string | null;
        checkOut: string | null;
        roomTypeName: string;
        bookingId: string | null;
        roomId: string;
        roomLabel: string | null;
        lifecycle: "open" | "closed";
        entryAt: string;
        plannedExitAt: string | null;
        actualExitAt: string | null;
        channel: "phone" | "direct" | "marketplace" | "travel_agent" | "corporate" | "channel_manager" | "walk_in" | null;
        bookingReference: string | null;
        deskNote: string | null;
        folio: {
            status: "open" | "closed" | "settled" | "disputed";
            id: string;
            folioNumber: string;
            balanceRwf: number | null;
            lockedAt: string | null;
        } | null;
        departureNote: string | null;
    }>, "many">;
    rooms: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodNullable<z.ZodString>;
        roomTypeId: z.ZodString;
        roomTypeName: z.ZodString;
        status: z.ZodEnum<["available", "maintenance", "out_of_service"]>;
        housekeeping: z.ZodEnum<["clean", "dirty", "inspected", "out_of_order"]>;
        housekeepingUpdatedAt: z.ZodNullable<z.ZodString>;
        /** The open stay in the room now. */
        occupant: z.ZodNullable<z.ZodObject<{
            stayId: z.ZodString;
            guestName: z.ZodNullable<z.ZodString>;
            plannedExitAt: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            stayId: string;
            guestName: string | null;
            plannedExitAt: string | null;
        }, {
            stayId: string;
            guestName: string | null;
            plannedExitAt: string | null;
        }>>;
        /** The booking holding this room tonight, if any. */
        heldTonightBy: z.ZodNullable<z.ZodObject<{
            bookingId: z.ZodString;
            reference: z.ZodString;
            guestName: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            reference: string;
            guestName: string | null;
            bookingId: string;
        }, {
            reference: string;
            guestName: string | null;
            bookingId: string;
        }>>;
    }, "strip", z.ZodTypeAny, {
        status: "available" | "maintenance" | "out_of_service";
        id: string;
        label: string | null;
        roomTypeId: string;
        roomTypeName: string;
        housekeeping: "dirty" | "clean" | "inspected" | "out_of_order";
        housekeepingUpdatedAt: string | null;
        occupant: {
            stayId: string;
            guestName: string | null;
            plannedExitAt: string | null;
        } | null;
        heldTonightBy: {
            reference: string;
            guestName: string | null;
            bookingId: string;
        } | null;
    }, {
        status: "available" | "maintenance" | "out_of_service";
        id: string;
        label: string | null;
        roomTypeId: string;
        roomTypeName: string;
        housekeeping: "dirty" | "clean" | "inspected" | "out_of_order";
        housekeepingUpdatedAt: string | null;
        occupant: {
            stayId: string;
            guestName: string | null;
            plannedExitAt: string | null;
        } | null;
        heldTonightBy: {
            reference: string;
            guestName: string | null;
            bookingId: string;
        } | null;
    }>, "many">;
    roomTypes: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        sleeps: z.ZodNumber;
        /** The default rate plan's nightly price, or the type's base price. */
        rateRwf: z.ZodNullable<z.ZodNumber>;
        /** "1 queen bed", from the type's bed rows; null when none are recorded. */
        beds: z.ZodNullable<z.ZodString>;
        active: z.ZodBoolean;
        /** Rooms of this type the property has, on sale. */
        roomCount: z.ZodNumber;
        /**
         * Rooms of this type nobody sleeps in tonight and nobody holds for tonight,
         * that are not out of order: what the desk can still sell for tonight.
         */
        freeTonight: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        active: boolean;
        name: string;
        id: string;
        roomCount: number;
        sleeps: number;
        rateRwf: number | null;
        beds: string | null;
        freeTonight: number;
    }, {
        active: boolean;
        name: string;
        id: string;
        roomCount: number;
        sleeps: number;
        rateRwf: number | null;
        beds: string | null;
        freeTonight: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    property: {
        name: string;
        id: string;
        checkInTime: string | null;
        checkOutTime: string | null;
    };
    roomTypes: {
        active: boolean;
        name: string;
        id: string;
        roomCount: number;
        sleeps: number;
        rateRwf: number | null;
        beds: string | null;
        freeTonight: number;
    }[];
    rooms: {
        status: "available" | "maintenance" | "out_of_service";
        id: string;
        label: string | null;
        roomTypeId: string;
        roomTypeName: string;
        housekeeping: "dirty" | "clean" | "inspected" | "out_of_order";
        housekeepingUpdatedAt: string | null;
        occupant: {
            stayId: string;
            guestName: string | null;
            plannedExitAt: string | null;
        } | null;
        heldTonightBy: {
            reference: string;
            guestName: string | null;
            bookingId: string;
        } | null;
    }[];
    stays: {
        id: string;
        reference: string | null;
        guestName: string | null;
        priceRwf: number | null;
        checkIn: string | null;
        checkOut: string | null;
        roomTypeName: string;
        bookingId: string | null;
        roomId: string;
        roomLabel: string | null;
        lifecycle: "open" | "closed";
        entryAt: string;
        plannedExitAt: string | null;
        actualExitAt: string | null;
        channel: "phone" | "direct" | "marketplace" | "travel_agent" | "corporate" | "channel_manager" | "walk_in" | null;
        bookingReference: string | null;
        deskNote: string | null;
        folio: {
            status: "open" | "closed" | "settled" | "disputed";
            id: string;
            folioNumber: string;
            balanceRwf: number | null;
            lockedAt: string | null;
        } | null;
        departureNote: string | null;
    }[];
    today: string;
    generatedAt: string;
    canReadBills: boolean;
    bookings: {
        status: "declined" | "pending_approval" | "confirmed" | "cancelled" | "no_show";
        id: string;
        createdAt: string;
        reference: string;
        guestName: string | null;
        paidRwf: number;
        state: "pending" | "declined" | "confirmed" | "cancelled" | "no_show" | "inhouse" | "checked_out";
        bookingMode: "instant_book" | "request_to_book";
        cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
        roomTypeId: string;
        nights: number;
        checkIn: string;
        checkOut: string;
        paymentStatus: "captured" | "refunded_full" | "refunded_partial" | "forfeited" | "paid_out" | null;
        approvalExpiresAt: string | null;
        confirmedAt: string | null;
        refundRwf: number | null;
        cancelledBy: string | null;
        guestCount: number;
        roomTypeName: string;
        totalRwf: number;
        stay: {
            id: string;
            reference: string | null;
            roomLabel: string | null;
            lifecycle: "open" | "closed";
        } | null;
        channel: "phone" | "direct" | "marketplace" | "travel_agent" | "corporate" | "channel_manager" | "walk_in" | null;
        guestPhone: string | null;
        adults: number | null;
        children: number | null;
        eta: string | null;
        deskNote: string | null;
        lockedNightlyRateRwf: number;
        cancelledAt: string | null;
        noShowAt: string | null;
        noShowReason: string | null;
        holds: {
            from: string;
            to: string;
            roomId: string;
            roomLabel: string | null;
        }[];
        preArrivalIdentity: boolean;
        folio: {
            status: "open" | "closed" | "settled" | "disputed";
            id: string;
            folioNumber: string;
            balanceRwf: number | null;
            lockedAt: string | null;
        } | null;
        guestMessage: string | null;
        cancellation: {
            refundRwf: number;
            rule: string;
            keptRwf: number;
        } | null;
        noShow: {
            refundRwf: number;
            rule: string;
            keptRwf: number;
        } | null;
    }[];
}, {
    property: {
        name: string;
        id: string;
        checkInTime: string | null;
        checkOutTime: string | null;
    };
    roomTypes: {
        active: boolean;
        name: string;
        id: string;
        roomCount: number;
        sleeps: number;
        rateRwf: number | null;
        beds: string | null;
        freeTonight: number;
    }[];
    rooms: {
        status: "available" | "maintenance" | "out_of_service";
        id: string;
        label: string | null;
        roomTypeId: string;
        roomTypeName: string;
        housekeeping: "dirty" | "clean" | "inspected" | "out_of_order";
        housekeepingUpdatedAt: string | null;
        occupant: {
            stayId: string;
            guestName: string | null;
            plannedExitAt: string | null;
        } | null;
        heldTonightBy: {
            reference: string;
            guestName: string | null;
            bookingId: string;
        } | null;
    }[];
    stays: {
        id: string;
        reference: string | null;
        guestName: string | null;
        priceRwf: number | null;
        checkIn: string | null;
        checkOut: string | null;
        roomTypeName: string;
        bookingId: string | null;
        roomId: string;
        roomLabel: string | null;
        lifecycle: "open" | "closed";
        entryAt: string;
        plannedExitAt: string | null;
        actualExitAt: string | null;
        channel: "phone" | "direct" | "marketplace" | "travel_agent" | "corporate" | "channel_manager" | "walk_in" | null;
        bookingReference: string | null;
        deskNote: string | null;
        folio: {
            status: "open" | "closed" | "settled" | "disputed";
            id: string;
            folioNumber: string;
            balanceRwf: number | null;
            lockedAt: string | null;
        } | null;
        departureNote: string | null;
    }[];
    today: string;
    generatedAt: string;
    canReadBills: boolean;
    bookings: {
        status: "declined" | "pending_approval" | "confirmed" | "cancelled" | "no_show";
        id: string;
        createdAt: string;
        reference: string;
        guestName: string | null;
        paidRwf: number;
        state: "pending" | "declined" | "confirmed" | "cancelled" | "no_show" | "inhouse" | "checked_out";
        bookingMode: "instant_book" | "request_to_book";
        cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
        roomTypeId: string;
        nights: number;
        checkIn: string;
        checkOut: string;
        paymentStatus: "captured" | "refunded_full" | "refunded_partial" | "forfeited" | "paid_out" | null;
        approvalExpiresAt: string | null;
        confirmedAt: string | null;
        refundRwf: number | null;
        cancelledBy: string | null;
        guestCount: number;
        roomTypeName: string;
        totalRwf: number;
        stay: {
            id: string;
            reference: string | null;
            roomLabel: string | null;
            lifecycle: "open" | "closed";
        } | null;
        channel: "phone" | "direct" | "marketplace" | "travel_agent" | "corporate" | "channel_manager" | "walk_in" | null;
        guestPhone: string | null;
        adults: number | null;
        children: number | null;
        eta: string | null;
        deskNote: string | null;
        lockedNightlyRateRwf: number;
        cancelledAt: string | null;
        noShowAt: string | null;
        noShowReason: string | null;
        holds: {
            from: string;
            to: string;
            roomId: string;
            roomLabel: string | null;
        }[];
        preArrivalIdentity: boolean;
        folio: {
            status: "open" | "closed" | "settled" | "disputed";
            id: string;
            folioNumber: string;
            balanceRwf: number | null;
            lockedAt: string | null;
        } | null;
        guestMessage: string | null;
        cancellation: {
            refundRwf: number;
            rule: string;
            keptRwf: number;
        } | null;
        noShow: {
            refundRwf: number;
            rule: string;
            keptRwf: number;
        } | null;
    }[];
}>;
export type FrontDeskBoard = z.infer<typeof FrontDeskBoard>;
/** Which property the desk is looking at; the caller's own when absent. */
export declare const FrontDeskBoardQuery: z.ZodObject<{
    workspaceId: z.ZodOptional<z.ZodString>;
    propertyId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    workspaceId?: string | undefined;
    propertyId?: string | undefined;
}, {
    workspaceId?: string | undefined;
    propertyId?: string | undefined;
}>;
export type FrontDeskBoardQuery = z.infer<typeof FrontDeskBoardQuery>;
/**
 * Cancel at the guest's request (`POST /ops/reservations/:id/cancel`). The
 * refund is the booking's locked tier; the reason is the desk's own words.
 */
export declare const CancelReservationRequest: z.ZodObject<{
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    reason?: string | undefined;
}, {
    reason?: string | undefined;
}>;
export type CancelReservationRequest = z.infer<typeof CancelReservationRequest>;
/**
 * Record that a confirmed guest never arrived (`POST /ops/reservations/:id/no-show`).
 *
 * The reason is the desk's own words, kept on the booking. What happens to the
 * money is not the desk's to say: it is the tier the booking locked, applied as
 * a cancellation after check-in time, exactly as a guest cancelling that late
 * would be refunded.
 */
export declare const MarkNoShowRequest: z.ZodObject<{
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    reason?: string | undefined;
}, {
    reason?: string | undefined;
}>;
export type MarkNoShowRequest = z.infer<typeof MarkNoShowRequest>;
/**
 * A reply the business keeps ready for its desk (`GET /api/v1/ops/message-templates`), in the
 * languages its guests write in. Only ever inserted into a draft the desk then sends.
 */
export declare const DeskMessageTemplate: z.ZodObject<{
    id: z.ZodString;
    key: z.ZodString;
    label: z.ZodString;
    bodies: z.ZodObject<{
        en: z.ZodString;
        rw: z.ZodNullable<z.ZodString>;
        fr: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        en: string;
        rw: string | null;
        fr: string | null;
    }, {
        en: string;
        rw: string | null;
        fr: string | null;
    }>;
}, "strip", z.ZodTypeAny, {
    id: string;
    key: string;
    label: string;
    bodies: {
        en: string;
        rw: string | null;
        fr: string | null;
    };
}, {
    id: string;
    key: string;
    label: string;
    bodies: {
        en: string;
        rw: string | null;
        fr: string | null;
    };
}>;
export type DeskMessageTemplate = z.infer<typeof DeskMessageTemplate>;
export declare const DeskMessageTemplateList: z.ZodObject<{
    templates: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        key: z.ZodString;
        label: z.ZodString;
        bodies: z.ZodObject<{
            en: z.ZodString;
            rw: z.ZodNullable<z.ZodString>;
            fr: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            en: string;
            rw: string | null;
            fr: string | null;
        }, {
            en: string;
            rw: string | null;
            fr: string | null;
        }>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        key: string;
        label: string;
        bodies: {
            en: string;
            rw: string | null;
            fr: string | null;
        };
    }, {
        id: string;
        key: string;
        label: string;
        bodies: {
            en: string;
            rw: string | null;
            fr: string | null;
        };
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    templates: {
        id: string;
        key: string;
        label: string;
        bodies: {
            en: string;
            rw: string | null;
            fr: string | null;
        };
    }[];
}, {
    templates: {
        id: string;
        key: string;
        label: string;
        bodies: {
            en: string;
            rw: string | null;
            fr: string | null;
        };
    }[];
}>;
export type DeskMessageTemplateList = z.infer<typeof DeskMessageTemplateList>;
//# sourceMappingURL=front-desk.d.ts.map