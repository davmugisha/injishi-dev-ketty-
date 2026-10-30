"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeskReservationResult = exports.DeskReservationRequest = exports.DeskReservationQuote = exports.DeskReservationAsk = exports.DeskReservationChannel = exports.DeskMessageTemplateList = exports.DeskMessageTemplate = exports.MarkNoShowRequest = exports.CancelReservationRequest = exports.FrontDeskBoardQuery = exports.FrontDeskBoard = exports.FrontDeskRoomType = exports.FrontDeskRoom = exports.FrontDeskStay = exports.FrontDeskBooking = exports.FrontDeskRefundQuote = exports.FrontDeskFolio = exports.FrontDeskHold = exports.BookingChannel = void 0;
const zod_1 = require("zod");
const booking_1 = require("./booking");
const ops_1 = require("./ops");
const primitives_1 = require("./primitives");
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
exports.BookingChannel = zod_1.z.enum([
    "marketplace",
    "direct",
    "phone",
    "travel_agent",
    "corporate",
    "channel_manager",
    "walk_in",
]);
/** `YYYY-MM-DD`, a calendar day in Kigali. */
const IsoDate = zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
/** A room held for the booking over `[from, to)`. Released holds are not listed. */
exports.FrontDeskHold = zod_1.z.object({
    roomId: primitives_1.Uuid,
    roomLabel: zod_1.z.string().nullable(),
    from: IsoDate,
    to: IsoDate,
});
/** A bill, as the desk needs to see it on a row. */
exports.FrontDeskFolio = zod_1.z.object({
    id: primitives_1.Uuid,
    folioNumber: zod_1.z.string(),
    status: ops_1.FolioStatus,
    /** Null when the caller may not read bills. */
    balanceRwf: zod_1.z.number().int().nullable(),
    lockedAt: zod_1.z.string().nullable(),
});
/**
 * What a cancellation or a no-show would do to the money now, computed by
 * `cancellationRefund` on the booking's locked tier, so the desk sees the
 * number the command will move before it presses.
 */
exports.FrontDeskRefundQuote = zod_1.z.object({
    refundRwf: zod_1.z.number().int(),
    keptRwf: zod_1.z.number().int(),
    /** The rule that decided it, in a sentence. */
    rule: zod_1.z.string(),
});
exports.FrontDeskBooking = zod_1.z.object({
    id: primitives_1.Uuid,
    reference: zod_1.z.string(),
    guestName: zod_1.z.string().nullable(),
    /** The guest's display phone, when their profile has one. */
    guestPhone: zod_1.z.string().nullable(),
    checkIn: IsoDate,
    checkOut: IsoDate,
    nights: zod_1.z.number().int().positive(),
    guestCount: zod_1.z.number().int().positive(),
    /** Null on a booking that did not record the split; read `guestCount`. */
    adults: zod_1.z.number().int().nullable(),
    children: zod_1.z.number().int().nullable(),
    roomTypeId: primitives_1.Uuid,
    roomTypeName: zod_1.z.string(),
    status: booking_1.BookingStatus,
    state: ops_1.OperatorReservationState,
    bookingMode: booking_1.BookingMode,
    cancellationTier: booking_1.CancellationTier.nullable(),
    channel: exports.BookingChannel.nullable(),
    /** `HH:MM`, the guest's expected arrival in Kigali time. */
    eta: zod_1.z.string().nullable(),
    deskNote: zod_1.z.string().nullable(),
    totalRwf: zod_1.z.number().int(),
    /** What one night costs the party, as locked at booking. */
    lockedNightlyRateRwf: zod_1.z.number().int(),
    /** Money already taken and still held or paid out (the escrow). Zero when none. */
    paidRwf: zod_1.z.number().int(),
    paymentStatus: booking_1.PaymentStatus.nullable(),
    approvalExpiresAt: zod_1.z.string().nullable(),
    createdAt: zod_1.z.string(),
    confirmedAt: zod_1.z.string().nullable(),
    cancelledAt: zod_1.z.string().nullable(),
    cancelledBy: zod_1.z.string().nullable(),
    refundRwf: zod_1.z.number().int().nullable(),
    noShowAt: zod_1.z.string().nullable(),
    noShowReason: zod_1.z.string().nullable(),
    holds: zod_1.z.array(exports.FrontDeskHold),
    /** The guest sent their ID from their phone before arriving (ADR-060). */
    preArrivalIdentity: zod_1.z.boolean(),
    /** The stay this booking opened, if anyone checked in. */
    stay: zod_1.z
        .object({
        id: primitives_1.Uuid,
        reference: zod_1.z.string().nullable(),
        lifecycle: zod_1.z.enum(["open", "closed"]),
        roomLabel: zod_1.z.string().nullable(),
    })
        .nullable(),
    folio: exports.FrontDeskFolio.nullable(),
    /** The guest's first message on the booking's conversation, if they wrote one. */
    guestMessage: zod_1.z.string().nullable(),
    /** Cancelling now at the guest's request, while it can still be cancelled. */
    cancellation: exports.FrontDeskRefundQuote.nullable(),
    /** Recording a no-show now, once the arrival day has come and nobody checked in. */
    noShow: exports.FrontDeskRefundQuote.nullable(),
});
exports.FrontDeskStay = zod_1.z.object({
    id: primitives_1.Uuid,
    /** The human handle, `ST-…`. Null on a stay opened before references existed. */
    reference: zod_1.z.string().nullable(),
    bookingId: primitives_1.Uuid.nullable(),
    bookingReference: zod_1.z.string().nullable(),
    guestName: zod_1.z.string().nullable(),
    roomId: primitives_1.Uuid,
    roomLabel: zod_1.z.string().nullable(),
    roomTypeName: zod_1.z.string(),
    lifecycle: zod_1.z.enum(["open", "closed"]),
    entryAt: zod_1.z.string(),
    plannedExitAt: zod_1.z.string().nullable(),
    actualExitAt: zod_1.z.string().nullable(),
    channel: exports.BookingChannel.nullable(),
    /** The booking's dates, or null for a walk in. */
    checkIn: IsoDate.nullable(),
    checkOut: IsoDate.nullable(),
    deskNote: zod_1.z.string().nullable(),
    departureNote: zod_1.z.string().nullable(),
    priceRwf: zod_1.z.number().int().nullable(),
    folio: exports.FrontDeskFolio.nullable(),
});
exports.FrontDeskRoom = zod_1.z.object({
    id: primitives_1.Uuid,
    label: zod_1.z.string().nullable(),
    roomTypeId: primitives_1.Uuid,
    roomTypeName: zod_1.z.string(),
    status: ops_1.RoomStatus,
    housekeeping: ops_1.HousekeepingStatus,
    housekeepingUpdatedAt: zod_1.z.string().nullable(),
    /** The open stay in the room now. */
    occupant: zod_1.z
        .object({
        stayId: primitives_1.Uuid,
        guestName: zod_1.z.string().nullable(),
        plannedExitAt: zod_1.z.string().nullable(),
    })
        .nullable(),
    /** The booking holding this room tonight, if any. */
    heldTonightBy: zod_1.z
        .object({ bookingId: primitives_1.Uuid, reference: zod_1.z.string(), guestName: zod_1.z.string().nullable() })
        .nullable(),
});
exports.FrontDeskRoomType = zod_1.z.object({
    id: primitives_1.Uuid,
    name: zod_1.z.string(),
    sleeps: zod_1.z.number().int(),
    /** The default rate plan's nightly price, or the type's base price. */
    rateRwf: zod_1.z.number().int().nullable(),
    /** "1 queen bed", from the type's bed rows; null when none are recorded. */
    beds: zod_1.z.string().nullable(),
    active: zod_1.z.boolean(),
    /** Rooms of this type the property has, on sale. */
    roomCount: zod_1.z.number().int(),
    /**
     * Rooms of this type nobody sleeps in tonight and nobody holds for tonight,
     * that are not out of order: what the desk can still sell for tonight.
     */
    freeTonight: zod_1.z.number().int(),
});
exports.FrontDeskBoard = zod_1.z.object({
    property: zod_1.z.object({
        id: primitives_1.Uuid,
        name: zod_1.z.string(),
        /** `HH:MM`. */
        checkInTime: zod_1.z.string().nullable(),
        checkOutTime: zod_1.z.string().nullable(),
    }),
    /** Today in Kigali, as the server decided it. */
    today: IsoDate,
    generatedAt: zod_1.z.string(),
    /** Whether the balances below were readable by the caller. */
    canReadBills: zod_1.z.boolean(),
    bookings: zod_1.z.array(exports.FrontDeskBooking),
    stays: zod_1.z.array(exports.FrontDeskStay),
    rooms: zod_1.z.array(exports.FrontDeskRoom),
    roomTypes: zod_1.z.array(exports.FrontDeskRoomType),
});
/** Which property the desk is looking at; the caller's own when absent. */
exports.FrontDeskBoardQuery = zod_1.z.object({
    workspaceId: primitives_1.Uuid.optional(),
    propertyId: primitives_1.Uuid.optional(),
});
/**
 * Cancel at the guest's request (`POST /ops/reservations/:id/cancel`). The
 * refund is the booking's locked tier; the reason is the desk's own words.
 */
exports.CancelReservationRequest = zod_1.z.object({
    reason: zod_1.z.string().trim().min(1).max(200).optional(),
});
/**
 * Record that a confirmed guest never arrived (`POST /ops/reservations/:id/no-show`).
 *
 * The reason is the desk's own words, kept on the booking. What happens to the
 * money is not the desk's to say: it is the tier the booking locked, applied as
 * a cancellation after check-in time, exactly as a guest cancelling that late
 * would be refunded.
 */
exports.MarkNoShowRequest = zod_1.z.object({
    reason: zod_1.z.string().trim().min(1).max(200).optional(),
});
/**
 * A reply the business keeps ready for its desk (`GET /api/v1/ops/message-templates`), in the
 * languages its guests write in. Only ever inserted into a draft the desk then sends.
 */
exports.DeskMessageTemplate = zod_1.z.object({
    id: primitives_1.Uuid,
    key: zod_1.z.string(),
    label: zod_1.z.string(),
    bodies: zod_1.z.object({
        en: zod_1.z.string(),
        rw: zod_1.z.string().nullable(),
        fr: zod_1.z.string().nullable(),
    }),
});
exports.DeskMessageTemplateList = zod_1.z.object({ templates: zod_1.z.array(exports.DeskMessageTemplate) });
/**
 * THE DESK BOOKS A GUEST (`POST /api/v1/ops/reservations`, 0124): a phone call, a WhatsApp, an email or a
 * walk in for a later day. One room type, one party, any nights from today. The guest needs no account:
 * their name and phone are the booking's. A room may be held at once (`roomId`), or later ("No room yet").
 * The price is the room type's for those nights unless the desk sets another, with a reason. A deposit the
 * desk took (cash, or a MoMo payment the guest already made, by its reference) goes on the guest's bill.
 */
exports.DeskReservationChannel = zod_1.z.enum(["phone", "direct", "walk_in", "travel_agent", "corporate"]);
const HHMM = zod_1.z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 14:30.");
exports.DeskReservationAsk = zod_1.z
    .object({
    checkIn: IsoDate,
    checkOut: IsoDate,
    roomTypeId: primitives_1.Uuid,
    adults: zod_1.z.number().int().min(1).max(20),
    children: zod_1.z.number().int().min(0).max(20).default(0),
    /** A nightly price other than the room type's, for the whole party. */
    nightlyRateRwf: primitives_1.RwfAmount.optional(),
})
    .refine((a) => a.checkOut > a.checkIn, { message: "Departure must be after arrival.", path: ["checkOut"] });
/** What the desk's booking would cost and whether the room type is free, before anything is written. */
exports.DeskReservationQuote = zod_1.z.object({
    nights: zod_1.z.number().int(),
    /** The room type's own nightly price for this party and these nights. */
    nightlyRateRwf: primitives_1.RwfAmount,
    /** What will be charged a night: the desk's price when it set one. */
    chargedNightlyRwf: primitives_1.RwfAmount,
    totalRwf: primitives_1.RwfAmount,
    freeRooms: zod_1.z.array(zod_1.z.object({ id: primitives_1.Uuid, label: zod_1.z.string() })),
    available: zod_1.z.boolean(),
    problems: zod_1.z.array(zod_1.z.string()),
});
exports.DeskReservationRequest = zod_1.z
    .object({
    checkIn: IsoDate,
    checkOut: IsoDate,
    roomTypeId: primitives_1.Uuid,
    /** Hold this room for the stay now; without it the booking waits for a room. */
    roomId: primitives_1.Uuid.optional(),
    adults: zod_1.z.number().int().min(1).max(20),
    children: zod_1.z.number().int().min(0).max(20).default(0),
    guest: zod_1.z.object({
        fullName: zod_1.z.string().trim().min(1, "Type the guest's name.").max(200),
        phone: zod_1.z.string().trim().min(8).max(20).optional(),
        email: zod_1.z.string().trim().email().max(200).optional(),
        nationality: zod_1.z.string().length(2).toUpperCase().optional(),
        documentType: primitives_1.DocumentType.optional(),
        idNumber: zod_1.z.string().trim().min(1).max(40).optional(),
    }),
    channel: exports.DeskReservationChannel,
    eta: HHMM.optional(),
    note: zod_1.z.string().trim().max(500).optional(),
    /** Held for the guest until then; past it, the nights are released. */
    holdUntil: zod_1.z.string().datetime({ offset: true }).optional(),
    nightlyRateRwf: primitives_1.RwfAmount.optional(),
    rateOverrideReason: zod_1.z.string().trim().min(3, "Say why the price changed.").max(300).optional(),
    deposit: zod_1.z
        .object({
        method: zod_1.z.enum(["cash", "mobile_money"]),
        amountRwf: zod_1.z.number().int().positive(),
        reference: zod_1.z.string().trim().max(120).optional(),
    })
        .optional(),
})
    .refine((r) => r.checkOut > r.checkIn, { message: "Departure must be after arrival.", path: ["checkOut"] })
    .refine((r) => r.nightlyRateRwf === undefined || !!r.rateOverrideReason, {
    message: "Say why the price changed.",
    path: ["rateOverrideReason"],
})
    .refine((r) => r.deposit?.method !== "mobile_money" || !!r.deposit.reference, {
    message: "Type the MoMo transaction reference.",
    path: ["deposit", "reference"],
});
exports.DeskReservationResult = zod_1.z.object({
    id: primitives_1.Uuid,
    reference: zod_1.z.string(),
    checkIn: IsoDate,
    checkOut: IsoDate,
    totalRwf: primitives_1.RwfAmount,
    /** The room held, when one was asked for and was free. */
    roomLabel: zod_1.z.string().nullable(),
    /** Why the room asked for could not be held; the booking waits for a room. */
    roomProblem: zod_1.z.string().nullable(),
    /** The folio the deposit went on, when one was taken. */
    folioId: primitives_1.Uuid.nullable(),
});
//# sourceMappingURL=front-desk.js.map