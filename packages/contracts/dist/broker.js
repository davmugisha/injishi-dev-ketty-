"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrokerSummary = exports.BrokerReviews = exports.BrokerReview = exports.BrokerEarnings = exports.BrokerFeeLine = exports.BrokerPlacementList = exports.BrokerPlacement = exports.StartPlacementRequest = exports.BrokerReveal = exports.BrokerHomes = exports.BrokerHomesQuery = exports.BrokerHomesSort = exports.BrokerHome = exports.BrokerHomePlacement = exports.BrokerContact = void 0;
const zod_1 = require("zod");
const broker_plans_1 = require("./broker-plans");
const primitives_1 = require("./primitives");
const registration_1 = require("./registration");
const brokers_1 = require("./rentals/brokers");
const dates_1 = require("./rentals/dates");
/**
 * The broker's own surface (`/api/v1/ops/broker/*`).
 *
 * A broker sees only the units a landlord switched on for brokers, inside the
 * area their plan covers (District, Province or Country). A unit outside that
 * is not there at all: every read and command answers 404. Revealing a
 * landlord's contact is free and logged; a placement says "I have a tenant for
 * this unit" and becomes the lease's broker record when the landlord names the
 * broker on the lease. Fees are recorded, never collected by Injishi.
 */
/** The landlord contact a broker revealed, as it stood when they revealed it. */
exports.BrokerContact = zod_1.z.object({
    name: zod_1.z.string().nullable(),
    phone: zod_1.z.string().nullable(),
    email: zod_1.z.string().nullable(),
    revealedAt: zod_1.z.string(),
});
/** The broker's placement on a unit, when they started one. */
exports.BrokerHomePlacement = zod_1.z.object({ id: primitives_1.Uuid, status: brokers_1.PlacementStatus });
/** One opted-in vacant unit a broker may offer. */
exports.BrokerHome = zod_1.z.object({
    unitId: primitives_1.Uuid,
    unitLabel: zod_1.z.string(),
    propertyName: zod_1.z.string(),
    landlordName: zod_1.z.string(),
    districtId: zod_1.z.number().int().nullable(),
    district: zod_1.z.string().nullable(),
    sector: zod_1.z.string().nullable(),
    bedrooms: zod_1.z.number().int().nullable(),
    bathrooms: zod_1.z.number().int().nullable(),
    kitchen: zod_1.z.enum(["own", "shared", "none"]).nullable(),
    furnished: zod_1.z.boolean(),
    sizeSqm: zod_1.z.number().int().nullable(),
    rentRwf: zod_1.z.number().int(),
    depositRwf: zod_1.z.number().int().nullable(),
    /** What the landlord pays the broker who brings the tenant. */
    fee: brokers_1.BrokerFeeTerms,
    /** The fee in francs on this unit's asking rent. */
    feeRwf: zod_1.z.number().int(),
    /** Signed, short-lived photo URLs, cover first. */
    photos: zod_1.z.array(zod_1.z.string()),
    video: zod_1.z.object({ url: zod_1.z.string(), posterUrl: zod_1.z.string().nullable(), durationS: zod_1.z.number().int() }).nullable(),
    /** Null when it is free now. */
    availableFrom: dates_1.CalendarDay.nullable(),
    latitude: zod_1.z.number().nullable(),
    longitude: zod_1.z.number().nullable(),
    /** Null until this broker reveals the landlord. */
    contact: exports.BrokerContact.nullable(),
    placement: exports.BrokerHomePlacement.nullable(),
});
exports.BrokerHomesSort = zod_1.z.enum(["newest", "price_asc", "price_desc", "fee_desc"]);
/** `GET /ops/broker/homes`. A district outside the plan shows nothing. */
exports.BrokerHomesQuery = zod_1.z.object({
    district: zod_1.z.coerce.number().int().positive().optional(),
    minRent: zod_1.z.coerce.number().int().nonnegative().optional(),
    maxRent: zod_1.z.coerce.number().int().positive().optional(),
    /** At least this many bedrooms. */
    bedrooms: zod_1.z.coerce.number().int().min(0).max(20).optional(),
    q: zod_1.z.string().trim().max(80).optional(),
    sort: exports.BrokerHomesSort.optional(),
});
exports.BrokerHomes = zod_1.z.object({
    brokerStatus: registration_1.BrokerStatus,
    /** The district filter applied, or null for the whole plan area. */
    districtId: zod_1.z.number().int().nullable(),
    /** Every district inside the plan with a home on offer, with how many. */
    districts: zod_1.z.array(zod_1.z.object({ id: zod_1.z.number().int(), name: zod_1.z.string(), count: zod_1.z.number().int() })),
    homes: zod_1.z.array(exports.BrokerHome),
    scope: broker_plans_1.BrokerScope,
});
/** `POST /ops/broker/homes/:unitId/reveal`. `first` is false when it was revealed before. */
exports.BrokerReveal = zod_1.z.object({ unitId: primitives_1.Uuid, contact: exports.BrokerContact, first: zod_1.z.boolean() });
/** `POST /ops/broker/homes/:unitId/placements`: "I have a tenant for this unit". */
exports.StartPlacementRequest = zod_1.z.object({
    tenantName: zod_1.z.string().trim().max(120, "Keep the name under 120 characters.").nullable().optional(),
    note: zod_1.z.string().trim().max(500, "Keep the note under 500 characters.").nullable().optional(),
});
exports.BrokerPlacement = zod_1.z.object({
    id: primitives_1.Uuid,
    status: brokers_1.PlacementStatus,
    startedAt: zod_1.z.string(),
    unit: zod_1.z.object({ id: primitives_1.Uuid, label: zod_1.z.string(), propertyName: zod_1.z.string(), district: zod_1.z.string().nullable() }).nullable(),
    landlordName: zod_1.z.string().nullable(),
    tenantName: zod_1.z.string().nullable(),
    note: zod_1.z.string().nullable(),
    /** The unit's fee when the placement started. */
    terms: brokers_1.BrokerFeeTerms.nullable(),
    /** The lease the landlord wrote naming this broker. */
    lease: zod_1.z
        .object({ id: primitives_1.Uuid, reference: zod_1.z.string(), tenantName: zod_1.z.string(), status: zod_1.z.string(), startDate: dates_1.CalendarDay })
        .nullable(),
    fee: brokers_1.BrokerFeeRecord.nullable(),
});
exports.BrokerPlacementList = zod_1.z.object({ placements: zod_1.z.array(exports.BrokerPlacement) });
/** One fee a lease records for this broker. */
exports.BrokerFeeLine = zod_1.z.object({
    leaseId: primitives_1.Uuid,
    reference: zod_1.z.string(),
    tenantName: zod_1.z.string(),
    unitLabel: zod_1.z.string(),
    propertyName: zod_1.z.string(),
    landlordName: zod_1.z.string(),
    startDate: dates_1.CalendarDay,
    fee: brokers_1.BrokerFeeRecord,
});
/** `GET /ops/broker/earnings`: what landlords recorded as owed and paid. Injishi moves none of it. */
exports.BrokerEarnings = zod_1.z.object({
    owedRwf: zod_1.z.number().int(),
    paidRwf: zod_1.z.number().int(),
    paidThisYearRwf: zod_1.z.number().int(),
    /** Recorded by the month the lease starts, the last 12 months, oldest first (`yyyy-mm`). */
    byMonth: zod_1.z.array(zod_1.z.object({ month: zod_1.z.string(), paidRwf: zod_1.z.number().int(), owedRwf: zod_1.z.number().int() })),
    fees: zod_1.z.array(exports.BrokerFeeLine),
});
exports.BrokerReview = zod_1.z.object({
    stars: zod_1.z.number().int(),
    comment: zod_1.z.string().nullable(),
    from: zod_1.z.enum(["tenant", "landlord"]),
    /** A tenant by first name; a landlord by their business. */
    raterName: zod_1.z.string().nullable(),
    propertyName: zod_1.z.string().nullable(),
    ratedAt: zod_1.z.string(),
});
/** `GET /ops/broker/reviews`. */
exports.BrokerReviews = zod_1.z.object({
    average: zod_1.z.number().nullable(),
    count: zod_1.z.number().int(),
    /** How many ratings gave 5, 4, 3, 2 and 1 stars, in that order. */
    breakdown: zod_1.z.array(zod_1.z.number().int()).length(5),
    /** Leases they brought a tenant to that started. */
    placedCount: zod_1.z.number().int(),
    reviews: zod_1.z.array(exports.BrokerReview),
});
/** `GET /ops/broker/summary`: the figures the broker home opens on. */
exports.BrokerSummary = zod_1.z.object({
    name: zod_1.z.string().nullable(),
    status: registration_1.BrokerStatus,
    scope: broker_plans_1.BrokerScope,
    homesInScope: zod_1.z.number().int(),
    openPlacements: zod_1.z.number().int(),
    owedRwf: zod_1.z.number().int(),
    paidRwf: zod_1.z.number().int(),
    ratingAverage: zod_1.z.number().nullable(),
    ratingCount: zod_1.z.number().int(),
});
//# sourceMappingURL=broker.js.map