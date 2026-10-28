"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrokerPickQuery = exports.BrokerPickList = exports.BrokerPick = exports.LandlordPlacementList = exports.LandlordPlacementView = exports.PlacementStatus = exports.TenancyBrokerView = exports.LeaseBrokerView = exports.BrokerFeeStatusRequest = exports.BrokerRatingView = exports.BrokerRatingRequest = exports.BrokerStars = exports.BrokerFeeRecord = exports.BrokerFeeRecordStatus = exports.BrokerDefaultsRequest = exports.BrokerFeeTerms = exports.BROKER_FEE_PERCENT_MAX = exports.BrokerFeeKind = void 0;
exports.brokerFeeAmount = brokerFeeAmount;
exports.brokerFeeWords = brokerFeeWords;
exports.brokerFeeFrom = brokerFeeFrom;
const zod_1 = require("zod");
const primitives_1 = require("../primitives");
const dates_1 = require("./dates");
const vocab_1 = require("./vocab");
// ===========================================================================
// Brokers on the landlord's side (2026-10-25: opt in per unit, landlord-set fee)
// ===========================================================================
//
// A broker sees only the units a landlord switched on ("Brokers may offer this
// unit"), with the fee the landlord set: a percent of the first month's rent or
// a fixed amount. The fee is a RECORD on the lease (who brought the tenant and
// what was agreed); the money moves outside Injishi, and the landlord marks it
// paid.
exports.BrokerFeeKind = zod_1.z.enum(["percent", "fixed"]);
/** The highest percent of the first month a fee may be: two months' rent. */
exports.BROKER_FEE_PERCENT_MAX = 200;
/** What a landlord pays a broker who brings the tenant. */
exports.BrokerFeeTerms = zod_1.z.discriminatedUnion("kind", [
    zod_1.z.object({
        kind: zod_1.z.literal("percent"),
        percent: zod_1.z
            .number({ invalid_type_error: "Enter a percent.", required_error: "Enter a percent." })
            .int("Whole percent only.")
            .min(1, "Enter 1% or more.")
            .max(exports.BROKER_FEE_PERCENT_MAX, `Up to ${exports.BROKER_FEE_PERCENT_MAX}%.`),
    }),
    zod_1.z.object({ kind: zod_1.z.literal("fixed"), amountRwf: vocab_1.PositiveRwf }),
]);
/** The fee in francs for a first month's rent: a percent rounds down to the franc. */
function brokerFeeAmount(terms, monthlyRentRwf) {
    if (terms.kind === "fixed")
        return terms.amountRwf;
    return Math.floor((monthlyRentRwf * terms.percent) / 100);
}
/** "50% of the first month" or "RWF 100,000". */
function brokerFeeWords(terms) {
    return terms.kind === "percent" ? `${terms.percent}% of the first month` : (0, vocab_1.formatRwf)(terms.amountRwf);
}
/** The terms from the columns that hold them; null when they do not make a whole fee. */
function brokerFeeFrom(kind, percent, amountRwf) {
    if (kind === "percent" && percent !== null)
        return { kind, percent };
    if (kind === "fixed" && amountRwf !== null)
        return { kind, amountRwf };
    return null;
}
/** `PUT /ops/rentals/profile/brokers`: the fee a new unit starts with when brokers may offer it. */
exports.BrokerDefaultsRequest = zod_1.z.object({ fee: exports.BrokerFeeTerms.nullable() });
/** Owed until the landlord marks it paid; void when the lease was cancelled before it started. */
exports.BrokerFeeRecordStatus = zod_1.z.enum(["owed", "paid", "void"]);
/** The fee as the lease records it. */
exports.BrokerFeeRecord = zod_1.z.object({
    terms: exports.BrokerFeeTerms,
    amountRwf: zod_1.z.number().int(),
    status: exports.BrokerFeeRecordStatus,
    paidAt: zod_1.z.string().nullable(),
});
/** A star rating with an optional comment. */
exports.BrokerStars = zod_1.z
    .number({ invalid_type_error: "Pick 1 to 5 stars.", required_error: "Pick 1 to 5 stars." })
    .int("Pick 1 to 5 stars.")
    .min(1, "Pick 1 to 5 stars.")
    .max(5, "Pick 1 to 5 stars.");
/** `POST /ops/leases/:id/broker-rating` and `POST /me/tenancies/:leaseId/broker-rating`. */
exports.BrokerRatingRequest = zod_1.z.object({
    stars: exports.BrokerStars,
    comment: zod_1.z.string().trim().max(500, "Keep it under 500 characters.").nullable().optional(),
});
exports.BrokerRatingView = zod_1.z.object({ stars: zod_1.z.number().int(), comment: zod_1.z.string().nullable(), ratedAt: zod_1.z.string() });
/** `PUT /ops/leases/:id/broker-fee`: the landlord marks the fee paid, or owed again. */
exports.BrokerFeeStatusRequest = zod_1.z.object({ paid: zod_1.z.boolean() });
/** The broker on a lease, as the landlord sees it. */
exports.LeaseBrokerView = zod_1.z.object({
    id: primitives_1.Uuid,
    name: zod_1.z.string().nullable(),
    phone: zod_1.z.string().nullable(),
    placementId: primitives_1.Uuid.nullable(),
    fee: exports.BrokerFeeRecord.nullable(),
    /** The landlord's own rating of the broker on this lease. */
    rating: exports.BrokerRatingView.nullable(),
    /** The tenancy has started, so the broker can be rated. */
    canRate: zod_1.z.boolean(),
});
/** The broker on a tenant's lease: rated once the tenancy starts. */
exports.TenancyBrokerView = zod_1.z.object({
    name: zod_1.z.string().nullable(),
    rating: exports.BrokerRatingView.nullable(),
    canRate: zod_1.z.boolean(),
});
exports.PlacementStatus = zod_1.z.enum(["initiated", "converted", "abandoned", "unavailable"]);
/** One placement as the landlord sees it: a broker says they have a tenant for a unit. */
exports.LandlordPlacementView = zod_1.z.object({
    id: primitives_1.Uuid,
    status: exports.PlacementStatus,
    startedAt: zod_1.z.string(),
    broker: zod_1.z.object({
        id: primitives_1.Uuid,
        name: zod_1.z.string().nullable(),
        phone: zod_1.z.string().nullable(),
        ratingAverage: zod_1.z.number().nullable(),
        ratingCount: zod_1.z.number().int(),
    }),
    unit: zod_1.z.object({ id: primitives_1.Uuid, label: zod_1.z.string(), propertyName: zod_1.z.string() }).nullable(),
    /** Who the broker says they bring, when they said. */
    tenantName: zod_1.z.string().nullable(),
    note: zod_1.z.string().nullable(),
    /** The unit's fee when the broker started. */
    terms: exports.BrokerFeeTerms.nullable(),
    lease: zod_1.z
        .object({ id: primitives_1.Uuid, reference: zod_1.z.string(), tenantName: zod_1.z.string(), status: zod_1.z.string(), startDate: dates_1.CalendarDay })
        .nullable(),
    fee: exports.BrokerFeeRecord.nullable(),
    rating: exports.BrokerRatingView.nullable(),
});
/** `GET /ops/rentals/placements`. */
exports.LandlordPlacementList = zod_1.z.object({
    placements: zod_1.z.array(exports.LandlordPlacementView),
    /** Fees owed and paid, over every lease that names a broker. */
    owedRwf: zod_1.z.number().int(),
    paidRwf: zod_1.z.number().int(),
});
/** A broker the landlord can name on a lease (`GET /ops/rentals/brokers?q=`). */
exports.BrokerPick = zod_1.z.object({
    id: primitives_1.Uuid,
    name: zod_1.z.string().nullable(),
    phone: zod_1.z.string().nullable(),
    ratingAverage: zod_1.z.number().nullable(),
    ratingCount: zod_1.z.number().int(),
    /** An open placement this broker started on this landlord's units, newest first. */
    placements: zod_1.z.array(zod_1.z.object({ id: primitives_1.Uuid, unitId: primitives_1.Uuid.nullable(), unitLabel: zod_1.z.string().nullable(), tenantName: zod_1.z.string().nullable() })),
});
exports.BrokerPickList = zod_1.z.object({ brokers: zod_1.z.array(exports.BrokerPick) });
exports.BrokerPickQuery = zod_1.z.object({ q: zod_1.z.string().trim().max(80).optional() });
//# sourceMappingURL=brokers.js.map