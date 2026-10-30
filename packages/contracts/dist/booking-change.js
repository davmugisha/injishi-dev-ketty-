"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReservationChangeForm = exports.ReservationChangeResult = exports.ReservationChangeRequest = exports.ReservationChangeQuote = exports.ChangeSettlement = exports.ReservationChangeAsk = void 0;
const zod_1 = require("zod");
const booking_1 = require("./booking");
/**
 * The desk changes a confirmed reservation (2026-10-30, the owner's decisions): its dates, its room type,
 * its number of guests. Never the guest's own details.
 *
 * A change reprices the stay. When it costs more the desk chooses each time: `bill` puts the difference on
 * the guest's bill, settled at the desk; `momo` asks the guest to pay it now by MoMo, and the change
 * applies once they have. When it costs less, the difference stays on the bill as credit, used against
 * extras, and what is left of it is refunded at check out.
 */
/** What the desk wants the reservation to become. Every field is the new value, changed or not. */
exports.ReservationChangeAsk = zod_1.z.object({
    checkIn: booking_1.IsoDate,
    checkOut: booking_1.IsoDate,
    roomTypeId: zod_1.z.string().uuid(),
    adults: zod_1.z.number().int().min(1).max(20),
    children: zod_1.z.number().int().min(0).max(20),
});
/** How a difference is settled: nothing owed, on the bill, by MoMo now, or credit on the bill. */
exports.ChangeSettlement = zod_1.z.enum(["none", "bill", "momo", "credit"]);
/** `POST /ops/reservations/:id/change/quote`: what a change would cost, before anything moves. */
exports.ReservationChangeQuote = zod_1.z.object({
    nights: zod_1.z.number().int(),
    fromNightlyRwf: zod_1.z.number().int(),
    toNightlyRwf: zod_1.z.number().int(),
    /** What the guest has paid for the room so far. */
    paidRoomRwf: zod_1.z.number().int(),
    /** What the room costs after the change. */
    newRoomRwf: zod_1.z.number().int(),
    /** More owed when positive, credit when negative. */
    differenceRwf: zod_1.z.number().int(),
    /** The settlements the desk may choose from: `bill` and `momo` when it costs more. */
    settlements: zod_1.z.array(exports.ChangeSettlement),
    /** Whether the new room type has a free unit every night of the new dates (this booking left out). */
    available: zod_1.z.boolean(),
    /** Why the change cannot be made, in the desk's words. Empty when it can. */
    problems: zod_1.z.array(zod_1.z.string()),
});
/** `POST /ops/reservations/:id/change`: the change, and how the desk settles a higher price. */
exports.ReservationChangeRequest = exports.ReservationChangeAsk.extend({
    /** Required when the change costs more; ignored otherwise. */
    settlement: zod_1.z.enum(["bill", "momo"]).optional(),
    /** The guest's MoMo number, for `momo`. */
    instrument: booking_1.PaymentInstrument.optional(),
    /** One per press of "Ask the guest to pay", so a retried press is the same request. */
    attemptToken: zod_1.z.string().min(8).max(80).optional(),
});
/** The change as the desk sees it after the press. */
exports.ReservationChangeResult = zod_1.z.object({
    changeId: zod_1.z.string().uuid(),
    /** `applied`, or `awaiting_payment` while the guest is asked by MoMo; `abandoned` if that failed. */
    status: zod_1.z.enum(["applied", "awaiting_payment", "abandoned"]),
    settlement: exports.ChangeSettlement,
    differenceRwf: zod_1.z.number().int(),
    /** The MoMo request, for `momo`: poll it until it is answered. */
    attempt: zod_1.z
        .object({
        attemptToken: zod_1.z.string(),
        state: booking_1.PaymentAttemptState,
        network: booking_1.MobileMoneyNetwork.nullable(),
        payerMasked: zod_1.z.string().nullable(),
        amountRwf: zod_1.z.number().int().nullable(),
        expiresAt: zod_1.z.string(),
        failureReason: zod_1.z.string().nullable(),
    })
        .nullable(),
});
/** `GET /ops/reservations/:id/change`: the stay as it stands, and the room types it may move to. */
exports.ReservationChangeForm = zod_1.z.object({
    reference: zod_1.z.string(),
    current: exports.ReservationChangeAsk,
    roomTypes: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string().uuid(),
        name: zod_1.z.string(),
        /** Guests it sleeps; adults and children within it. */
        capacity: zod_1.z.number().int(),
        maxAdults: zod_1.z.number().int().nullable(),
        maxChildren: zod_1.z.number().int().nullable(),
        /** Its price for the room (per room) or per guest, a night. */
        nightlyRateRwf: zod_1.z.number().int().nullable(),
        priceBasis: zod_1.z.string().nullable(),
    })),
    /** Why it cannot change at all (checked in, a request, no payment held). Empty when it can. */
    problems: zod_1.z.array(zod_1.z.string()),
});
//# sourceMappingURL=booking-change.js.map