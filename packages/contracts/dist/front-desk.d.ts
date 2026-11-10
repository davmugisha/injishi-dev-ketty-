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
    status: "settled" | "open" | "closed" | "disputed";
    id: string;
    folioNumber: string;
    balanceRwf: number | null;
    lockedAt: string | null;
}, {
    status: "settled" | "open" | "closed" | "disputed";
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
    paymentStatus: z.ZodNullable<z.ZodEnum<["captured", "refunded_full", "refunded_partial", "forfeited", "paid_out", "refund_pending"]>>;
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
        status: "settled" | "open" | "closed" | "disputed";
        id: string;
        folioNumber: string;
        balanceRwf: number | null;
        lockedAt: string | null;
    }, {
        status: "settled" | "open" | "closed" | "disputed";
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
    status: "pending_approval" | "confirmed" | "declined" | "cancelled" | "no_show";
    id: string;
    bookingMode: "instant_book" | "request_to_book";
    cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
    roomTypeId: string;
    nights: number;
    checkIn: string;
    checkOut: string;
    reference: string;
    paymentStatus: "captured" | "refunded_full" | "refunded_partial" | "forfeited" | "paid_out" | "refund_pending" | null;
    approvalExpiresAt: string | null;
    state: "pending" | "confirmed" | "declined" | "cancelled" | "no_show" | "inhouse" | "checked_out";
    confirmedAt: string | null;
    refundRwf: number | null;
    cancelledBy: string | null;
    paidRwf: number;
    createdAt: string;
    guestName: string | null;
    stay: {
        id: string;
        reference: string | null;
        roomLabel: string | null;
        lifecycle: "open" | "closed";
    } | null;
    guestCount: number;
    roomTypeName: string;
    totalRwf: number;
    channel: "phone" | "direct" | "marketplace" | "travel_agent" | "corporate" | "channel_manager" | "walk_in" | null;
    adults: number | null;
    children: number | null;
    guestPhone: string | null;
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
        status: "settled" | "open" | "closed" | "disputed";
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
    status: "pending_approval" | "confirmed" | "declined" | "cancelled" | "no_show";
    id: string;
    bookingMode: "instant_book" | "request_to_book";
    cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
    roomTypeId: string;
    nights: number;
    checkIn: string;
    checkOut: string;
    reference: string;
    paymentStatus: "captured" | "refunded_full" | "refunded_partial" | "forfeited" | "paid_out" | "refund_pending" | null;
    approvalExpiresAt: string | null;
    state: "pending" | "confirmed" | "declined" | "cancelled" | "no_show" | "inhouse" | "checked_out";
    confirmedAt: string | null;
    refundRwf: number | null;
    cancelledBy: string | null;
    paidRwf: number;
    createdAt: string;
    guestName: string | null;
    stay: {
        id: string;
        reference: string | null;
        roomLabel: string | null;
        lifecycle: "open" | "closed";
    } | null;
    guestCount: number;
    roomTypeName: string;
    totalRwf: number;
    channel: "phone" | "direct" | "marketplace" | "travel_agent" | "corporate" | "channel_manager" | "walk_in" | null;
    adults: number | null;
    children: number | null;
    guestPhone: string | null;
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
        status: "settled" | "open" | "closed" | "disputed";
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
        status: "settled" | "open" | "closed" | "disputed";
        id: string;
        folioNumber: string;
        balanceRwf: number | null;
        lockedAt: string | null;
    }, {
        status: "settled" | "open" | "closed" | "disputed";
        id: string;
        folioNumber: string;
        balanceRwf: number | null;
        lockedAt: string | null;
    }>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    checkIn: string | null;
    checkOut: string | null;
    reference: string | null;
    guestName: string | null;
    priceRwf: number | null;
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
        status: "settled" | "open" | "closed" | "disputed";
        id: string;
        folioNumber: string;
        balanceRwf: number | null;
        lockedAt: string | null;
    } | null;
    departureNote: string | null;
}, {
    id: string;
    checkIn: string | null;
    checkOut: string | null;
    reference: string | null;
    guestName: string | null;
    priceRwf: number | null;
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
        status: "settled" | "open" | "closed" | "disputed";
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
    roomTypeId: string;
    label: string | null;
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
    roomTypeId: string;
    label: string | null;
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
    beds: string | null;
    sleeps: number;
    rateRwf: number | null;
    freeTonight: number;
}, {
    active: boolean;
    name: string;
    id: string;
    roomCount: number;
    beds: string | null;
    sleeps: number;
    rateRwf: number | null;
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
        paymentStatus: z.ZodNullable<z.ZodEnum<["captured", "refunded_full", "refunded_partial", "forfeited", "paid_out", "refund_pending"]>>;
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
            status: "settled" | "open" | "closed" | "disputed";
            id: string;
            folioNumber: string;
            balanceRwf: number | null;
            lockedAt: string | null;
        }, {
            status: "settled" | "open" | "closed" | "disputed";
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
        status: "pending_approval" | "confirmed" | "declined" | "cancelled" | "no_show";
        id: string;
        bookingMode: "instant_book" | "request_to_book";
        cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
        roomTypeId: string;
        nights: number;
        checkIn: string;
        checkOut: string;
        reference: string;
        paymentStatus: "captured" | "refunded_full" | "refunded_partial" | "forfeited" | "paid_out" | "refund_pending" | null;
        approvalExpiresAt: string | null;
        state: "pending" | "confirmed" | "declined" | "cancelled" | "no_show" | "inhouse" | "checked_out";
        confirmedAt: string | null;
        refundRwf: number | null;
        cancelledBy: string | null;
        paidRwf: number;
        createdAt: string;
        guestName: string | null;
        stay: {
            id: string;
            reference: string | null;
            roomLabel: string | null;
            lifecycle: "open" | "closed";
        } | null;
        guestCount: number;
        roomTypeName: string;
        totalRwf: number;
        channel: "phone" | "direct" | "marketplace" | "travel_agent" | "corporate" | "channel_manager" | "walk_in" | null;
        adults: number | null;
        children: number | null;
        guestPhone: string | null;
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
            status: "settled" | "open" | "closed" | "disputed";
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
        status: "pending_approval" | "confirmed" | "declined" | "cancelled" | "no_show";
        id: string;
        bookingMode: "instant_book" | "request_to_book";
        cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
        roomTypeId: string;
        nights: number;
        checkIn: string;
        checkOut: string;
        reference: string;
        paymentStatus: "captured" | "refunded_full" | "refunded_partial" | "forfeited" | "paid_out" | "refund_pending" | null;
        approvalExpiresAt: string | null;
        state: "pending" | "confirmed" | "declined" | "cancelled" | "no_show" | "inhouse" | "checked_out";
        confirmedAt: string | null;
        refundRwf: number | null;
        cancelledBy: string | null;
        paidRwf: number;
        createdAt: string;
        guestName: string | null;
        stay: {
            id: string;
            reference: string | null;
            roomLabel: string | null;
            lifecycle: "open" | "closed";
        } | null;
        guestCount: number;
        roomTypeName: string;
        totalRwf: number;
        channel: "phone" | "direct" | "marketplace" | "travel_agent" | "corporate" | "channel_manager" | "walk_in" | null;
        adults: number | null;
        children: number | null;
        guestPhone: string | null;
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
            status: "settled" | "open" | "closed" | "disputed";
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
            status: "settled" | "open" | "closed" | "disputed";
            id: string;
            folioNumber: string;
            balanceRwf: number | null;
            lockedAt: string | null;
        }, {
            status: "settled" | "open" | "closed" | "disputed";
            id: string;
            folioNumber: string;
            balanceRwf: number | null;
            lockedAt: string | null;
        }>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        checkIn: string | null;
        checkOut: string | null;
        reference: string | null;
        guestName: string | null;
        priceRwf: number | null;
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
            status: "settled" | "open" | "closed" | "disputed";
            id: string;
            folioNumber: string;
            balanceRwf: number | null;
            lockedAt: string | null;
        } | null;
        departureNote: string | null;
    }, {
        id: string;
        checkIn: string | null;
        checkOut: string | null;
        reference: string | null;
        guestName: string | null;
        priceRwf: number | null;
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
            status: "settled" | "open" | "closed" | "disputed";
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
        roomTypeId: string;
        label: string | null;
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
        roomTypeId: string;
        label: string | null;
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
        beds: string | null;
        sleeps: number;
        rateRwf: number | null;
        freeTonight: number;
    }, {
        active: boolean;
        name: string;
        id: string;
        roomCount: number;
        beds: string | null;
        sleeps: number;
        rateRwf: number | null;
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
        beds: string | null;
        sleeps: number;
        rateRwf: number | null;
        freeTonight: number;
    }[];
    rooms: {
        status: "available" | "maintenance" | "out_of_service";
        id: string;
        roomTypeId: string;
        label: string | null;
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
        checkIn: string | null;
        checkOut: string | null;
        reference: string | null;
        guestName: string | null;
        priceRwf: number | null;
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
            status: "settled" | "open" | "closed" | "disputed";
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
        status: "pending_approval" | "confirmed" | "declined" | "cancelled" | "no_show";
        id: string;
        bookingMode: "instant_book" | "request_to_book";
        cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
        roomTypeId: string;
        nights: number;
        checkIn: string;
        checkOut: string;
        reference: string;
        paymentStatus: "captured" | "refunded_full" | "refunded_partial" | "forfeited" | "paid_out" | "refund_pending" | null;
        approvalExpiresAt: string | null;
        state: "pending" | "confirmed" | "declined" | "cancelled" | "no_show" | "inhouse" | "checked_out";
        confirmedAt: string | null;
        refundRwf: number | null;
        cancelledBy: string | null;
        paidRwf: number;
        createdAt: string;
        guestName: string | null;
        stay: {
            id: string;
            reference: string | null;
            roomLabel: string | null;
            lifecycle: "open" | "closed";
        } | null;
        guestCount: number;
        roomTypeName: string;
        totalRwf: number;
        channel: "phone" | "direct" | "marketplace" | "travel_agent" | "corporate" | "channel_manager" | "walk_in" | null;
        adults: number | null;
        children: number | null;
        guestPhone: string | null;
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
            status: "settled" | "open" | "closed" | "disputed";
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
        beds: string | null;
        sleeps: number;
        rateRwf: number | null;
        freeTonight: number;
    }[];
    rooms: {
        status: "available" | "maintenance" | "out_of_service";
        id: string;
        roomTypeId: string;
        label: string | null;
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
        checkIn: string | null;
        checkOut: string | null;
        reference: string | null;
        guestName: string | null;
        priceRwf: number | null;
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
            status: "settled" | "open" | "closed" | "disputed";
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
        status: "pending_approval" | "confirmed" | "declined" | "cancelled" | "no_show";
        id: string;
        bookingMode: "instant_book" | "request_to_book";
        cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
        roomTypeId: string;
        nights: number;
        checkIn: string;
        checkOut: string;
        reference: string;
        paymentStatus: "captured" | "refunded_full" | "refunded_partial" | "forfeited" | "paid_out" | "refund_pending" | null;
        approvalExpiresAt: string | null;
        state: "pending" | "confirmed" | "declined" | "cancelled" | "no_show" | "inhouse" | "checked_out";
        confirmedAt: string | null;
        refundRwf: number | null;
        cancelledBy: string | null;
        paidRwf: number;
        createdAt: string;
        guestName: string | null;
        stay: {
            id: string;
            reference: string | null;
            roomLabel: string | null;
            lifecycle: "open" | "closed";
        } | null;
        guestCount: number;
        roomTypeName: string;
        totalRwf: number;
        channel: "phone" | "direct" | "marketplace" | "travel_agent" | "corporate" | "channel_manager" | "walk_in" | null;
        adults: number | null;
        children: number | null;
        guestPhone: string | null;
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
            status: "settled" | "open" | "closed" | "disputed";
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
    label: string;
    key: string;
    bodies: {
        en: string;
        rw: string | null;
        fr: string | null;
    };
}, {
    id: string;
    label: string;
    key: string;
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
        label: string;
        key: string;
        bodies: {
            en: string;
            rw: string | null;
            fr: string | null;
        };
    }, {
        id: string;
        label: string;
        key: string;
        bodies: {
            en: string;
            rw: string | null;
            fr: string | null;
        };
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    templates: {
        id: string;
        label: string;
        key: string;
        bodies: {
            en: string;
            rw: string | null;
            fr: string | null;
        };
    }[];
}, {
    templates: {
        id: string;
        label: string;
        key: string;
        bodies: {
            en: string;
            rw: string | null;
            fr: string | null;
        };
    }[];
}>;
export type DeskMessageTemplateList = z.infer<typeof DeskMessageTemplateList>;
/**
 * THE DESK BOOKS A GUEST (`POST /api/v1/ops/reservations`, 0124): a phone call, a WhatsApp, an email or a
 * walk in for a later day. One room type, one party, any nights from today. The guest needs no account:
 * their name and phone are the booking's. A room may be held at once (`roomId`), or later ("No room yet").
 * The price is the room type's for those nights unless the desk sets another, with a reason. A deposit the
 * desk took (cash, or a MoMo payment the guest already made, by its reference) goes on the guest's bill.
 */
export declare const DeskReservationChannel: z.ZodEnum<["phone", "direct", "walk_in", "travel_agent", "corporate"]>;
export type DeskReservationChannel = z.infer<typeof DeskReservationChannel>;
export declare const DeskReservationAsk: z.ZodEffects<z.ZodObject<{
    checkIn: z.ZodString;
    checkOut: z.ZodString;
    roomTypeId: z.ZodString;
    adults: z.ZodNumber;
    children: z.ZodDefault<z.ZodNumber>;
    /** A nightly price other than the room type's, for the whole party. */
    nightlyRateRwf: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    roomTypeId: string;
    checkIn: string;
    checkOut: string;
    adults: number;
    children: number;
    nightlyRateRwf?: number | undefined;
}, {
    roomTypeId: string;
    checkIn: string;
    checkOut: string;
    adults: number;
    nightlyRateRwf?: number | undefined;
    children?: number | undefined;
}>, {
    roomTypeId: string;
    checkIn: string;
    checkOut: string;
    adults: number;
    children: number;
    nightlyRateRwf?: number | undefined;
}, {
    roomTypeId: string;
    checkIn: string;
    checkOut: string;
    adults: number;
    nightlyRateRwf?: number | undefined;
    children?: number | undefined;
}>;
export type DeskReservationAsk = z.infer<typeof DeskReservationAsk>;
/** What the desk's booking would cost and whether the room type is free, before anything is written. */
export declare const DeskReservationQuote: z.ZodObject<{
    nights: z.ZodNumber;
    /** The room type's own nightly price for this party and these nights. */
    nightlyRateRwf: z.ZodNumber;
    /** What will be charged a night: the desk's price when it set one. */
    chargedNightlyRwf: z.ZodNumber;
    totalRwf: z.ZodNumber;
    freeRooms: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        label: string;
    }, {
        id: string;
        label: string;
    }>, "many">;
    available: z.ZodBoolean;
    problems: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    nightlyRateRwf: number;
    nights: number;
    totalRwf: number;
    available: boolean;
    problems: string[];
    freeRooms: {
        id: string;
        label: string;
    }[];
    chargedNightlyRwf: number;
}, {
    nightlyRateRwf: number;
    nights: number;
    totalRwf: number;
    available: boolean;
    problems: string[];
    freeRooms: {
        id: string;
        label: string;
    }[];
    chargedNightlyRwf: number;
}>;
export type DeskReservationQuote = z.infer<typeof DeskReservationQuote>;
export declare const DeskReservationRequest: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodObject<{
    checkIn: z.ZodString;
    checkOut: z.ZodString;
    roomTypeId: z.ZodString;
    /** Hold this room for the stay now; without it the booking waits for a room. */
    roomId: z.ZodOptional<z.ZodString>;
    adults: z.ZodNumber;
    children: z.ZodDefault<z.ZodNumber>;
    guest: z.ZodObject<{
        fullName: z.ZodString;
        phone: z.ZodOptional<z.ZodString>;
        email: z.ZodOptional<z.ZodString>;
        nationality: z.ZodOptional<z.ZodString>;
        documentType: z.ZodOptional<z.ZodEnum<["national_id", "passport", "other"]>>;
        idNumber: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        fullName: string;
        documentType?: "national_id" | "passport" | "other" | undefined;
        email?: string | undefined;
        phone?: string | undefined;
        idNumber?: string | undefined;
        nationality?: string | undefined;
    }, {
        fullName: string;
        documentType?: "national_id" | "passport" | "other" | undefined;
        email?: string | undefined;
        phone?: string | undefined;
        idNumber?: string | undefined;
        nationality?: string | undefined;
    }>;
    channel: z.ZodEnum<["phone", "direct", "walk_in", "travel_agent", "corporate"]>;
    eta: z.ZodOptional<z.ZodString>;
    note: z.ZodOptional<z.ZodString>;
    /** Held for the guest until then; past it, the nights are released. */
    holdUntil: z.ZodOptional<z.ZodString>;
    nightlyRateRwf: z.ZodOptional<z.ZodNumber>;
    rateOverrideReason: z.ZodOptional<z.ZodString>;
    deposit: z.ZodOptional<z.ZodObject<{
        method: z.ZodEnum<["cash", "mobile_money"]>;
        amountRwf: z.ZodNumber;
        reference: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        amountRwf: number;
        method: "mobile_money" | "cash";
        reference?: string | undefined;
    }, {
        amountRwf: number;
        method: "mobile_money" | "cash";
        reference?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    guest: {
        fullName: string;
        documentType?: "national_id" | "passport" | "other" | undefined;
        email?: string | undefined;
        phone?: string | undefined;
        idNumber?: string | undefined;
        nationality?: string | undefined;
    };
    roomTypeId: string;
    checkIn: string;
    checkOut: string;
    channel: "phone" | "direct" | "travel_agent" | "corporate" | "walk_in";
    adults: number;
    children: number;
    nightlyRateRwf?: number | undefined;
    note?: string | undefined;
    deposit?: {
        amountRwf: number;
        method: "mobile_money" | "cash";
        reference?: string | undefined;
    } | undefined;
    roomId?: string | undefined;
    eta?: string | undefined;
    holdUntil?: string | undefined;
    rateOverrideReason?: string | undefined;
}, {
    guest: {
        fullName: string;
        documentType?: "national_id" | "passport" | "other" | undefined;
        email?: string | undefined;
        phone?: string | undefined;
        idNumber?: string | undefined;
        nationality?: string | undefined;
    };
    roomTypeId: string;
    checkIn: string;
    checkOut: string;
    channel: "phone" | "direct" | "travel_agent" | "corporate" | "walk_in";
    adults: number;
    nightlyRateRwf?: number | undefined;
    note?: string | undefined;
    deposit?: {
        amountRwf: number;
        method: "mobile_money" | "cash";
        reference?: string | undefined;
    } | undefined;
    roomId?: string | undefined;
    children?: number | undefined;
    eta?: string | undefined;
    holdUntil?: string | undefined;
    rateOverrideReason?: string | undefined;
}>, {
    guest: {
        fullName: string;
        documentType?: "national_id" | "passport" | "other" | undefined;
        email?: string | undefined;
        phone?: string | undefined;
        idNumber?: string | undefined;
        nationality?: string | undefined;
    };
    roomTypeId: string;
    checkIn: string;
    checkOut: string;
    channel: "phone" | "direct" | "travel_agent" | "corporate" | "walk_in";
    adults: number;
    children: number;
    nightlyRateRwf?: number | undefined;
    note?: string | undefined;
    deposit?: {
        amountRwf: number;
        method: "mobile_money" | "cash";
        reference?: string | undefined;
    } | undefined;
    roomId?: string | undefined;
    eta?: string | undefined;
    holdUntil?: string | undefined;
    rateOverrideReason?: string | undefined;
}, {
    guest: {
        fullName: string;
        documentType?: "national_id" | "passport" | "other" | undefined;
        email?: string | undefined;
        phone?: string | undefined;
        idNumber?: string | undefined;
        nationality?: string | undefined;
    };
    roomTypeId: string;
    checkIn: string;
    checkOut: string;
    channel: "phone" | "direct" | "travel_agent" | "corporate" | "walk_in";
    adults: number;
    nightlyRateRwf?: number | undefined;
    note?: string | undefined;
    deposit?: {
        amountRwf: number;
        method: "mobile_money" | "cash";
        reference?: string | undefined;
    } | undefined;
    roomId?: string | undefined;
    children?: number | undefined;
    eta?: string | undefined;
    holdUntil?: string | undefined;
    rateOverrideReason?: string | undefined;
}>, {
    guest: {
        fullName: string;
        documentType?: "national_id" | "passport" | "other" | undefined;
        email?: string | undefined;
        phone?: string | undefined;
        idNumber?: string | undefined;
        nationality?: string | undefined;
    };
    roomTypeId: string;
    checkIn: string;
    checkOut: string;
    channel: "phone" | "direct" | "travel_agent" | "corporate" | "walk_in";
    adults: number;
    children: number;
    nightlyRateRwf?: number | undefined;
    note?: string | undefined;
    deposit?: {
        amountRwf: number;
        method: "mobile_money" | "cash";
        reference?: string | undefined;
    } | undefined;
    roomId?: string | undefined;
    eta?: string | undefined;
    holdUntil?: string | undefined;
    rateOverrideReason?: string | undefined;
}, {
    guest: {
        fullName: string;
        documentType?: "national_id" | "passport" | "other" | undefined;
        email?: string | undefined;
        phone?: string | undefined;
        idNumber?: string | undefined;
        nationality?: string | undefined;
    };
    roomTypeId: string;
    checkIn: string;
    checkOut: string;
    channel: "phone" | "direct" | "travel_agent" | "corporate" | "walk_in";
    adults: number;
    nightlyRateRwf?: number | undefined;
    note?: string | undefined;
    deposit?: {
        amountRwf: number;
        method: "mobile_money" | "cash";
        reference?: string | undefined;
    } | undefined;
    roomId?: string | undefined;
    children?: number | undefined;
    eta?: string | undefined;
    holdUntil?: string | undefined;
    rateOverrideReason?: string | undefined;
}>, {
    guest: {
        fullName: string;
        documentType?: "national_id" | "passport" | "other" | undefined;
        email?: string | undefined;
        phone?: string | undefined;
        idNumber?: string | undefined;
        nationality?: string | undefined;
    };
    roomTypeId: string;
    checkIn: string;
    checkOut: string;
    channel: "phone" | "direct" | "travel_agent" | "corporate" | "walk_in";
    adults: number;
    children: number;
    nightlyRateRwf?: number | undefined;
    note?: string | undefined;
    deposit?: {
        amountRwf: number;
        method: "mobile_money" | "cash";
        reference?: string | undefined;
    } | undefined;
    roomId?: string | undefined;
    eta?: string | undefined;
    holdUntil?: string | undefined;
    rateOverrideReason?: string | undefined;
}, {
    guest: {
        fullName: string;
        documentType?: "national_id" | "passport" | "other" | undefined;
        email?: string | undefined;
        phone?: string | undefined;
        idNumber?: string | undefined;
        nationality?: string | undefined;
    };
    roomTypeId: string;
    checkIn: string;
    checkOut: string;
    channel: "phone" | "direct" | "travel_agent" | "corporate" | "walk_in";
    adults: number;
    nightlyRateRwf?: number | undefined;
    note?: string | undefined;
    deposit?: {
        amountRwf: number;
        method: "mobile_money" | "cash";
        reference?: string | undefined;
    } | undefined;
    roomId?: string | undefined;
    children?: number | undefined;
    eta?: string | undefined;
    holdUntil?: string | undefined;
    rateOverrideReason?: string | undefined;
}>;
export type DeskReservationRequest = z.infer<typeof DeskReservationRequest>;
export declare const DeskReservationResult: z.ZodObject<{
    id: z.ZodString;
    reference: z.ZodString;
    checkIn: z.ZodString;
    checkOut: z.ZodString;
    totalRwf: z.ZodNumber;
    /** The room held, when one was asked for and was free. */
    roomLabel: z.ZodNullable<z.ZodString>;
    /** Why the room asked for could not be held; the booking waits for a room. */
    roomProblem: z.ZodNullable<z.ZodString>;
    /** The folio the deposit went on, when one was taken. */
    folioId: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    checkIn: string;
    checkOut: string;
    reference: string;
    totalRwf: number;
    roomLabel: string | null;
    folioId: string | null;
    roomProblem: string | null;
}, {
    id: string;
    checkIn: string;
    checkOut: string;
    reference: string;
    totalRwf: number;
    roomLabel: string | null;
    folioId: string | null;
    roomProblem: string | null;
}>;
export type DeskReservationResult = z.infer<typeof DeskReservationResult>;
//# sourceMappingURL=front-desk.d.ts.map