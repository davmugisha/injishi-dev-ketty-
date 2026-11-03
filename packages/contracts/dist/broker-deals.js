"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrokerHotels = exports.BrokerHotel = exports.BrokerDealList = exports.BrokerDeal = exports.EndBrokerDealRequest = exports.DecideBrokerDealRequest = exports.ProposeBrokerDealRequest = exports.BrokerDealTerms = exports.BROKER_DEAL_PERCENT_MAX = exports.BROKER_DEAL_PERCENT_MIN = exports.BROKER_DEAL_LIVE_STATUSES = exports.BrokerDealStatus = exports.BrokerDealKind = exports.BROKER_COMMISSION_INJISHI_SHARE = void 0;
exports.brokerDealTermsLine = brokerDealTermsLine;
exports.brokerCommissionSplit = brokerCommissionSplit;
const zod_1 = require("zod");
const broker_plans_1 = require("./broker-plans");
const primitives_1 = require("./primitives");
const registration_1 = require("./registration");
const dates_1 = require("./rentals/dates");
/**
 * A broker's deal with a hotel (2026-11-02, the owner's call): the broker brings
 * the hotel bookings, and the hotel pays the broker a commission on the stays
 * those bookings become.
 *
 * Two kinds of commission:
 * - `percent`: a share of what the guest paid for the room, on every booking
 *   the broker makes there ("10% of each booking");
 * - `bulk_fixed`: one sum for a booking of at least so many rooms at once
 *   ("RWF 200,000 for a booking of 10 rooms or more").
 *
 * The broker proposes, the hotel's owner accepts or declines, and either side
 * may end a deal that is running. A broker and a hotel have at most one deal
 * that is proposed or running at a time.
 *
 * Injishi takes `BROKER_COMMISSION_INJISHI_SHARE` of every commission and the
 * broker gets the rest. The money itself (the commission taken off the hotel's
 * payout at check-out, or billed when there is no payout) is the next phase;
 * a deal says the terms both sides agreed.
 */
/** Injishi's share of a commission: 15% of what the hotel pays the broker. */
exports.BROKER_COMMISSION_INJISHI_SHARE = 0.15;
exports.BrokerDealKind = zod_1.z.enum(["percent", "bulk_fixed"]);
/**
 * - `proposed`: the broker asked, the hotel has not answered;
 * - `active`: the hotel accepted, and it runs until it ends;
 * - `declined`: the hotel said no;
 * - `withdrawn`: the broker took a proposal back before the hotel answered;
 * - `ended`: one side ended a running deal, or its end date passed.
 */
exports.BrokerDealStatus = zod_1.z.enum(["proposed", "active", "declined", "withdrawn", "ended"]);
/** The deal statuses that still bind a pair: a second deal waits until this one is over. */
exports.BROKER_DEAL_LIVE_STATUSES = ["proposed", "active"];
/** The lowest and highest commission a percent deal may carry, in percent. */
exports.BROKER_DEAL_PERCENT_MIN = 1;
exports.BROKER_DEAL_PERCENT_MAX = 30;
exports.BrokerDealTerms = zod_1.z.discriminatedUnion("kind", [
    zod_1.z.object({
        kind: zod_1.z.literal("percent"),
        /** Of what the guest paid for the room. Steps of half a percent: 7.5 is fine, 7.25 is not. */
        percent: zod_1.z
            .number({ invalid_type_error: "Give the commission as a number." })
            .min(exports.BROKER_DEAL_PERCENT_MIN, `A commission is at least ${exports.BROKER_DEAL_PERCENT_MIN}%.`)
            .max(exports.BROKER_DEAL_PERCENT_MAX, `A commission is at most ${exports.BROKER_DEAL_PERCENT_MAX}%.`)
            .refine((v) => Number.isInteger(v * 2), "Use whole or half percents, like 10 or 7.5."),
    }),
    zod_1.z.object({
        kind: zod_1.z.literal("bulk_fixed"),
        /** One sum for the whole booking, whole francs. */
        amountRwf: zod_1.z
            .number({ invalid_type_error: "Give the amount in francs." })
            .int("Give the amount in whole francs.")
            .min(1000, "The amount is at least RWF 1,000.")
            .max(50000000, "The amount is at most RWF 50,000,000."),
        /** The fewest rooms booked together that count as a bulk booking. */
        minRooms: zod_1.z
            .number({ invalid_type_error: "Give the number of rooms." })
            .int("Give a whole number of rooms.")
            .min(2, "A bulk booking is at least 2 rooms.")
            .max(500, "A bulk booking is at most 500 rooms."),
    }),
]);
const DealNote = zod_1.z.string().trim().max(1000, "Keep the note under 1,000 characters.");
/** `POST /ops/broker/hotels/:orgId/deals`: the broker proposes a deal to a hotel. */
exports.ProposeBrokerDealRequest = zod_1.z
    .object({
    terms: exports.BrokerDealTerms,
    /** Null: from the day the hotel accepts. */
    startsOn: dates_1.CalendarDay.nullable().optional(),
    /** Null: until one side ends it. */
    endsOn: dates_1.CalendarDay.nullable().optional(),
    /** What the broker wants the hotel to know: who they bring, how many, when. */
    note: DealNote.nullable().optional(),
})
    .refine((v) => !v.startsOn || !v.endsOn || v.endsOn > v.startsOn, {
    message: "The end date comes after the start date.",
    path: ["endsOn"],
});
/** `POST /ops/broker-deals/:id/decision`: the hotel accepts or declines a proposal. */
exports.DecideBrokerDealRequest = zod_1.z.object({
    decision: zod_1.z.enum(["accept", "decline"]),
    /** Said to the broker; most useful with a decline. */
    note: DealNote.nullable().optional(),
});
/** `POST …/deals/:id/end` (either side) and `…/withdraw` (the broker): why, said to the other side. */
exports.EndBrokerDealRequest = zod_1.z.object({ note: DealNote.nullable().optional() });
/** One deal, as either side reads it. */
exports.BrokerDeal = zod_1.z.object({
    id: primitives_1.Uuid,
    status: exports.BrokerDealStatus,
    terms: exports.BrokerDealTerms,
    startsOn: dates_1.CalendarDay.nullable(),
    endsOn: dates_1.CalendarDay.nullable(),
    /** The broker's note with the proposal. */
    note: zod_1.z.string().nullable(),
    broker: zod_1.z.object({
        id: primitives_1.Uuid,
        name: zod_1.z.string().nullable(),
        /** Shown to the hotel, so it can call the broker before answering. */
        phone: zod_1.z.string().nullable(),
        email: zod_1.z.string().nullable(),
    }),
    hotel: zod_1.z.object({
        orgId: primitives_1.Uuid,
        name: zod_1.z.string(),
        district: zod_1.z.string().nullable(),
    }),
    proposedAt: zod_1.z.string(),
    /** When the hotel accepted or declined, and what it said. */
    decidedAt: zod_1.z.string().nullable(),
    decisionNote: zod_1.z.string().nullable(),
    /** When it was withdrawn or ended, by which side, and why. */
    closedAt: zod_1.z.string().nullable(),
    closedBy: zod_1.z.enum(["broker", "hotel"]).nullable(),
    closeNote: zod_1.z.string().nullable(),
});
exports.BrokerDealList = zod_1.z.object({ deals: zod_1.z.array(exports.BrokerDeal) });
/** One hotel a broker may propose a deal to: running, listed, inside the plan's area. */
exports.BrokerHotel = zod_1.z.object({
    orgId: primitives_1.Uuid,
    name: zod_1.z.string(),
    /** "Hotel", "Lodge", "Guest house"… */
    kindLabel: zod_1.z.string().nullable(),
    /** Confirmed by Injishi staff; null until then. */
    stars: zod_1.z.number().int().min(1).max(5).nullable(),
    district: zod_1.z.string().nullable(),
    sector: zod_1.z.string().nullable(),
    /** The room types on offer. */
    roomTypes: zod_1.z.number().int(),
    /** The lowest nightly price, whole francs; null when none is set. */
    fromRwf: zod_1.z.number().int().nullable(),
    /** This broker's proposed or running deal with the hotel, if any. */
    deal: exports.BrokerDeal.nullable(),
});
/** `GET /ops/broker/hotels`. */
exports.BrokerHotels = zod_1.z.object({
    brokerStatus: registration_1.BrokerStatus,
    hotels: zod_1.z.array(exports.BrokerHotel),
    scope: broker_plans_1.BrokerScope,
});
const rwf = (n) => `RWF ${Math.round(n).toLocaleString("en-US")}`;
/** The terms in one line: "10% of each booking", "RWF 200,000 for a booking of 10 rooms or more". */
function brokerDealTermsLine(terms) {
    return terms.kind === "percent"
        ? `${terms.percent}% of each booking`
        : `${rwf(terms.amountRwf)} for a booking of ${terms.minRooms} rooms or more`;
}
/** How a commission divides: Injishi's 15%, rounded to the franc, and the broker's rest. */
function brokerCommissionSplit(commissionRwf) {
    const injishiRwf = Math.round(commissionRwf * exports.BROKER_COMMISSION_INJISHI_SHARE);
    return { injishiRwf, brokerRwf: commissionRwf - injishiRwf };
}
//# sourceMappingURL=broker-deals.js.map