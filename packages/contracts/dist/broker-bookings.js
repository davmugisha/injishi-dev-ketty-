"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrokerBookingList = exports.BrokerBookingGroup = exports.BrokerGroupRoom = exports.BrokerCommissionEstimate = exports.CreateBrokerBookingRequest = exports.BrokerBookingRoom = exports.BrokerRoomOffer = exports.BrokerRoomType = exports.BrokerRoomsQuery = exports.BrokerGroupStatus = exports.BrokerBookingPayment = exports.BROKER_GROUP_MAX_ROOMS = void 0;
exports.brokerCommissionFor = brokerCommissionFor;
const zod_1 = require("zod");
const booking_1 = require("./booking");
const broker_deals_1 = require("./broker-deals");
const primitives_1 = require("./primitives");
/**
 * A broker's bookings at a hotel (2026-11-02, phase 2): under a running deal,
 * a broker books one room or many at once for their clients, with a guest's
 * name on every room. The rooms are confirmed straight away when they are free,
 * because the hotel agreed to the deal.
 *
 * Two ways to pay:
 * - `at_hotel`: nothing is taken now. The guests pay at the desk, and the
 *   commission is taken off the hotel's next payout once they check out.
 * - `momo`: one Mobile Money payment for the whole group, held in escrow like
 *   a guest's own booking. The rooms are written only once it lands; if any of
 *   them sold out meanwhile, the whole payment is refunded and nothing is booked.
 *
 * Every room becomes its own booking (one room, one booking, as everywhere
 * else), and the group ties them together under one reference.
 */
exports.BROKER_GROUP_MAX_ROOMS = 50;
exports.BrokerBookingPayment = zod_1.z.enum(["at_hotel", "momo"]);
/**
 * - `awaiting_payment`: a MoMo prompt is out; nothing is booked yet;
 * - `booked`: every room is a confirmed booking;
 * - `failed`: the payment was refused or never answered, or the rooms sold out
 *   before it landed (refunded in full). Nothing is booked.
 */
exports.BrokerGroupStatus = zod_1.z.enum(["awaiting_payment", "booked", "failed"]);
/** `GET /ops/broker/hotels/:orgId/rooms?checkIn&checkOut`: what can be booked, and at what rate. */
exports.BrokerRoomsQuery = zod_1.z.object({ checkIn: booking_1.IsoDate, checkOut: booking_1.IsoDate });
exports.BrokerRoomType = zod_1.z.object({
    id: primitives_1.Uuid,
    name: zod_1.z.string(),
    /** Most guests a room sleeps (infants not counted). */
    capacity: zod_1.z.number().int(),
    maxAdults: zod_1.z.number().int().nullable(),
    maxChildren: zod_1.z.number().int().nullable(),
    /** `per_person`: the rate is per guest per night; `per_unit`: per room per night. */
    priceBasis: zod_1.z.string().nullable(),
    nightlyRateRwf: zod_1.z.number().int(),
    singleGuestPriceRwf: zod_1.z.number().int().nullable(),
    minStay: zod_1.z.number().int().nullable(),
    /** Rooms free on every night of the stay. */
    freeRooms: zod_1.z.number().int(),
});
exports.BrokerRoomOffer = zod_1.z.object({
    hotel: zod_1.z.object({ orgId: primitives_1.Uuid, name: zod_1.z.string() }),
    deal: broker_deals_1.BrokerDeal,
    checkIn: booking_1.IsoDate,
    checkOut: booking_1.IsoDate,
    nights: zod_1.z.number().int(),
    roomTypes: zod_1.z.array(exports.BrokerRoomType),
});
const GuestName = zod_1.z
    .string()
    .trim()
    .min(2, "Give the guest's name.")
    .max(120, "Keep the name under 120 characters.");
exports.BrokerBookingRoom = zod_1.z.object({
    roomTypeId: primitives_1.Uuid,
    /** Who sleeps in this room: the desk checks them in by this name. */
    guestName: GuestName,
    guestPhone: primitives_1.ContactPhone.nullable().optional(),
    adults: zod_1.z.number().int().min(1, "At least one adult.").max(20),
    children: zod_1.z.number().int().min(0).max(20),
});
/** `POST /ops/broker/hotels/:orgId/bookings`. */
exports.CreateBrokerBookingRequest = zod_1.z
    .object({
    checkIn: booking_1.IsoDate,
    checkOut: booking_1.IsoDate,
    rooms: zod_1.z
        .array(exports.BrokerBookingRoom)
        .min(1, "Add at least one room.")
        .max(exports.BROKER_GROUP_MAX_ROOMS, `At most ${exports.BROKER_GROUP_MAX_ROOMS} rooms in one booking.`),
    /** The number the hotel calls about the whole booking: usually the broker's own. */
    contactPhone: primitives_1.ContactPhone,
    note: zod_1.z.string().trim().max(1000, "Keep the note under 1,000 characters.").nullable().optional(),
    payment: zod_1.z.discriminatedUnion("method", [
        zod_1.z.object({ method: zod_1.z.literal("at_hotel") }),
        zod_1.z.object({
            method: zod_1.z.literal("momo"),
            instrument: booking_1.PaymentInstrument,
            /** One per press of Pay, reused on every retry of that press. */
            attemptToken: zod_1.z.string().uuid(),
        }),
    ]),
})
    .refine((v) => v.checkOut > v.checkIn, { message: "Check-out comes after check-in.", path: ["checkOut"] });
/** What the deal earns on a group, as it stands when it is booked; paid out after the stays (phase 3). */
exports.BrokerCommissionEstimate = zod_1.z.object({
    commissionRwf: zod_1.z.number().int(),
    brokerRwf: zod_1.z.number().int(),
    injishiRwf: zod_1.z.number().int(),
    /** Why it is zero, when it is: a bulk deal needs more rooms than this booking has. */
    note: zod_1.z.string().nullable(),
});
exports.BrokerGroupRoom = zod_1.z.object({
    roomTypeId: primitives_1.Uuid,
    roomTypeName: zod_1.z.string(),
    guestName: zod_1.z.string(),
    guestPhone: zod_1.z.string().nullable(),
    adults: zod_1.z.number().int(),
    children: zod_1.z.number().int(),
    grossRwf: zod_1.z.number().int(),
    /** The booking once written; null while the group waits for its payment or after it failed. */
    booking: zod_1.z.object({ id: primitives_1.Uuid, reference: zod_1.z.string(), status: zod_1.z.string() }).nullable(),
});
exports.BrokerBookingGroup = zod_1.z.object({
    id: primitives_1.Uuid,
    /** `BG-7Q2M-4XKD`, what the broker and the hotel say on the phone. */
    reference: zod_1.z.string(),
    hotel: zod_1.z.object({ orgId: primitives_1.Uuid, name: zod_1.z.string() }),
    dealId: primitives_1.Uuid,
    checkIn: booking_1.IsoDate,
    checkOut: booking_1.IsoDate,
    nights: zod_1.z.number().int(),
    payment: exports.BrokerBookingPayment,
    status: exports.BrokerGroupStatus,
    totalRwf: zod_1.z.number().int(),
    commission: exports.BrokerCommissionEstimate,
    contactPhone: zod_1.z.string(),
    note: zod_1.z.string().nullable(),
    rooms: zod_1.z.array(exports.BrokerGroupRoom),
    failureReason: zod_1.z.string().nullable(),
    createdAt: zod_1.z.string(),
    /** The MoMo prompt behind a `momo` group, while there is one to show. */
    attempt: zod_1.z
        .object({
        attemptToken: zod_1.z.string(),
        state: booking_1.PaymentAttemptState,
        payerMasked: zod_1.z.string().nullable(),
        expiresAt: zod_1.z.string(),
        failureReason: zod_1.z.string().nullable(),
    })
        .nullable(),
});
exports.BrokerBookingList = zod_1.z.object({ groups: zod_1.z.array(exports.BrokerBookingGroup) });
/**
 * What a deal earns on a booking: a percent of what the guests pay for the rooms, or the fixed sum when
 * the booking has at least the deal's fewest rooms. Split 85 / 15 between the broker and Injishi.
 */
function brokerCommissionFor(terms, totalRwf, rooms) {
    if (terms.kind === "percent") {
        const commissionRwf = Math.round((totalRwf * terms.percent) / 100);
        return { commissionRwf, ...(0, broker_deals_1.brokerCommissionSplit)(commissionRwf), note: null };
    }
    if (rooms < terms.minRooms) {
        return {
            commissionRwf: 0,
            brokerRwf: 0,
            injishiRwf: 0,
            note: `This deal pays on bookings of ${terms.minRooms} rooms or more.`,
        };
    }
    return { commissionRwf: terms.amountRwf, ...(0, broker_deals_1.brokerCommissionSplit)(terms.amountRwf), note: null };
}
//# sourceMappingURL=broker-bookings.js.map