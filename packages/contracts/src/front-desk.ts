import { z } from "zod";
import { BookingMode, BookingStatus, CancellationTier, PaymentStatus } from "./booking";
import { FolioStatus, HousekeepingStatus, OperatorReservationState, RoomStatus } from "./ops";
import { Uuid } from "./primitives";
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
export const BookingChannel = z.enum([
    "marketplace",
    "direct",
    "phone",
    "travel_agent",
    "corporate",
    "channel_manager",
    "walk_in",
]);
export type BookingChannel = z.infer<typeof BookingChannel>;
/** `YYYY-MM-DD`, a calendar day in Kigali. */
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
/** A room held for the booking over `[from, to)`. Released holds are not listed. */
export const FrontDeskHold = z.object({
    roomId: Uuid,
    roomLabel: z.string().nullable(),
    from: IsoDate,
    to: IsoDate,
});
export type FrontDeskHold = z.infer<typeof FrontDeskHold>;
/** A bill, as the desk needs to see it on a row. */
export const FrontDeskFolio = z.object({
    id: Uuid,
    folioNumber: z.string(),
    status: FolioStatus,
    /** Null when the caller may not read bills. */
    balanceRwf: z.number().int().nullable(),
    lockedAt: z.string().nullable(),
});
export type FrontDeskFolio = z.infer<typeof FrontDeskFolio>;
/**
 * What a cancellation or a no-show would do to the money now, computed by
 * `cancellationRefund` on the booking's locked tier, so the desk sees the
 * number the command will move before it presses.
 */
export const FrontDeskRefundQuote = z.object({
    refundRwf: z.number().int(),
    keptRwf: z.number().int(),
    /** The rule that decided it, in a sentence. */
    rule: z.string(),
});
export type FrontDeskRefundQuote = z.infer<typeof FrontDeskRefundQuote>;
export const FrontDeskBooking = z.object({
    id: Uuid,
    reference: z.string(),
    guestName: z.string().nullable(),
    /** The guest's display phone, when their profile has one. */
    guestPhone: z.string().nullable(),
    checkIn: IsoDate,
    checkOut: IsoDate,
    nights: z.number().int().positive(),
    guestCount: z.number().int().positive(),
    /** Null on a booking that did not record the split; read `guestCount`. */
    adults: z.number().int().nullable(),
    children: z.number().int().nullable(),
    roomTypeId: Uuid,
    roomTypeName: z.string(),
    status: BookingStatus,
    state: OperatorReservationState,
    bookingMode: BookingMode,
    cancellationTier: CancellationTier.nullable(),
    channel: BookingChannel.nullable(),
    /** `HH:MM`, the guest's expected arrival in Kigali time. */
    eta: z.string().nullable(),
    deskNote: z.string().nullable(),
    totalRwf: z.number().int(),
    /** What one night costs the party, as locked at booking. */
    lockedNightlyRateRwf: z.number().int(),
    /** Money already taken and still held or paid out (the escrow). Zero when none. */
    paidRwf: z.number().int(),
    paymentStatus: PaymentStatus.nullable(),
    approvalExpiresAt: z.string().nullable(),
    createdAt: z.string(),
    confirmedAt: z.string().nullable(),
    cancelledAt: z.string().nullable(),
    cancelledBy: z.string().nullable(),
    refundRwf: z.number().int().nullable(),
    noShowAt: z.string().nullable(),
    noShowReason: z.string().nullable(),
    holds: z.array(FrontDeskHold),
    /** The guest sent their ID from their phone before arriving (ADR-060). */
    preArrivalIdentity: z.boolean(),
    /** The stay this booking opened, if anyone checked in. */
    stay: z
        .object({
        id: Uuid,
        reference: z.string().nullable(),
        lifecycle: z.enum(["open", "closed"]),
        roomLabel: z.string().nullable(),
    })
        .nullable(),
    folio: FrontDeskFolio.nullable(),
    /** The guest's first message on the booking's conversation, if they wrote one. */
    guestMessage: z.string().nullable(),
    /** Cancelling now at the guest's request, while it can still be cancelled. */
    cancellation: FrontDeskRefundQuote.nullable(),
    /** Recording a no-show now, once the arrival day has come and nobody checked in. */
    noShow: FrontDeskRefundQuote.nullable(),
});
export type FrontDeskBooking = z.infer<typeof FrontDeskBooking>;
export const FrontDeskStay = z.object({
    id: Uuid,
    /** The human handle, `ST-…`. Null on a stay opened before references existed. */
    reference: z.string().nullable(),
    bookingId: Uuid.nullable(),
    bookingReference: z.string().nullable(),
    guestName: z.string().nullable(),
    roomId: Uuid,
    roomLabel: z.string().nullable(),
    roomTypeName: z.string(),
    lifecycle: z.enum(["open", "closed"]),
    entryAt: z.string(),
    plannedExitAt: z.string().nullable(),
    actualExitAt: z.string().nullable(),
    channel: BookingChannel.nullable(),
    /** The booking's dates, or null for a walk in. */
    checkIn: IsoDate.nullable(),
    checkOut: IsoDate.nullable(),
    deskNote: z.string().nullable(),
    departureNote: z.string().nullable(),
    priceRwf: z.number().int().nullable(),
    folio: FrontDeskFolio.nullable(),
});
export type FrontDeskStay = z.infer<typeof FrontDeskStay>;
export const FrontDeskRoom = z.object({
    id: Uuid,
    label: z.string().nullable(),
    roomTypeId: Uuid,
    roomTypeName: z.string(),
    status: RoomStatus,
    housekeeping: HousekeepingStatus,
    housekeepingUpdatedAt: z.string().nullable(),
    /** The open stay in the room now. */
    occupant: z
        .object({
        stayId: Uuid,
        guestName: z.string().nullable(),
        plannedExitAt: z.string().nullable(),
    })
        .nullable(),
    /** The booking holding this room tonight, if any. */
    heldTonightBy: z
        .object({ bookingId: Uuid, reference: z.string(), guestName: z.string().nullable() })
        .nullable(),
});
export type FrontDeskRoom = z.infer<typeof FrontDeskRoom>;
export const FrontDeskRoomType = z.object({
    id: Uuid,
    name: z.string(),
    sleeps: z.number().int(),
    /** The default rate plan's nightly price, or the type's base price. */
    rateRwf: z.number().int().nullable(),
    /** "1 queen bed", from the type's bed rows; null when none are recorded. */
    beds: z.string().nullable(),
    active: z.boolean(),
    /** Rooms of this type the property has, on sale. */
    roomCount: z.number().int(),
    /**
     * Rooms of this type nobody sleeps in tonight and nobody holds for tonight,
     * that are not out of order: what the desk can still sell for tonight.
     */
    freeTonight: z.number().int(),
});
export type FrontDeskRoomType = z.infer<typeof FrontDeskRoomType>;
export const FrontDeskBoard = z.object({
    property: z.object({
        id: Uuid,
        name: z.string(),
        /** `HH:MM`. */
        checkInTime: z.string().nullable(),
        checkOutTime: z.string().nullable(),
    }),
    /** Today in Kigali, as the server decided it. */
    today: IsoDate,
    generatedAt: z.string(),
    /** Whether the balances below were readable by the caller. */
    canReadBills: z.boolean(),
    bookings: z.array(FrontDeskBooking),
    stays: z.array(FrontDeskStay),
    rooms: z.array(FrontDeskRoom),
    roomTypes: z.array(FrontDeskRoomType),
});
export type FrontDeskBoard = z.infer<typeof FrontDeskBoard>;
/** Which property the desk is looking at; the caller's own when absent. */
export const FrontDeskBoardQuery = z.object({
    workspaceId: Uuid.optional(),
    propertyId: Uuid.optional(),
});
export type FrontDeskBoardQuery = z.infer<typeof FrontDeskBoardQuery>;
/**
 * Cancel at the guest's request (`POST /ops/reservations/:id/cancel`). The
 * refund is the booking's locked tier; the reason is the desk's own words.
 */
export const CancelReservationRequest = z.object({
    reason: z.string().trim().min(1).max(200).optional(),
});
export type CancelReservationRequest = z.infer<typeof CancelReservationRequest>;
/**
 * Record that a confirmed guest never arrived (`POST /ops/reservations/:id/no-show`).
 *
 * The reason is the desk's own words, kept on the booking. What happens to the
 * money is not the desk's to say: it is the tier the booking locked, applied as
 * a cancellation after check-in time, exactly as a guest cancelling that late
 * would be refunded.
 */
export const MarkNoShowRequest = z.object({
    reason: z.string().trim().min(1).max(200).optional(),
});
export type MarkNoShowRequest = z.infer<typeof MarkNoShowRequest>;
/**
 * A reply the business keeps ready for its desk (`GET /api/v1/ops/message-templates`), in the
 * languages its guests write in. Only ever inserted into a draft the desk then sends.
 */
export const DeskMessageTemplate = z.object({
    id: Uuid,
    key: z.string(),
    label: z.string(),
    bodies: z.object({
        en: z.string(),
        rw: z.string().nullable(),
        fr: z.string().nullable(),
    }),
});
export type DeskMessageTemplate = z.infer<typeof DeskMessageTemplate>;
export const DeskMessageTemplateList = z.object({ templates: z.array(DeskMessageTemplate) });
export type DeskMessageTemplateList = z.infer<typeof DeskMessageTemplateList>;
