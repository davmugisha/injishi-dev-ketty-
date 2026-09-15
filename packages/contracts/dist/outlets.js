"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PropertyFacility = exports.FacilityOutlet = exports.FacilityAmenity = exports.UpdateOutletRequest = exports.CreateOutletRequest = exports.OperatorOutletList = exports.OperatorOutlet = exports.OutletTenancySummary = exports.OutletPartySummary = exports.UpdateOutletPartyRequest = exports.CreateOutletPartyRequest = exports.OutletPartyList = exports.OutletParty = exports.OutletAddress = exports.OutletHoursInput = exports.OutletTenancyStatus = exports.OutletPartyStatus = exports.OutletRelationshipType = void 0;
const zod_1 = require("zod");
const ops_1 = require("./ops");
const ordering_1 = require("./ordering");
const primitives_1 = require("./primitives");
const registration_1 = require("./registration");
/**
 * OUTLETS, THEIR PARTIES, AND THE FACILITIES A PROPERTY PAGE LISTS
 * (ADR-050 D-h to D-l, slice 4).
 *
 * An outlet names who runs it (the operator), who owns it, and the arrangement
 * between them and the hotel. `taxEntityOrgId` is decided by the server from
 * those three and is never accepted from a client: it is whose TIN signs a sale.
 */
/** Mirrors the `outlet_relationship_type` Postgres enum exactly. */
exports.OutletRelationshipType = zod_1.z.enum([
    "hotel_operated",
    "third_party_managed",
    "leased_tenant",
    "concession",
    "franchise",
    "revenue_share",
]);
/** Mirrors `outlet_party_status`. */
exports.OutletPartyStatus = zod_1.z.enum(["active", "archived"]);
/** Mirrors `outlet_tenancy_status`. */
exports.OutletTenancyStatus = zod_1.z.enum(["invited", "requested", "active", "ended"]);
const ClockTime = zod_1.z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "A time is HH:MM, 24 hour.");
const HoursWindow = zod_1.z.tuple([ClockTime, ClockTime]);
/** One window, or a list of them for a kitchen that closes between services. */
const DayHours = zod_1.z.union([HoursWindow, zod_1.z.array(HoursWindow).min(1).max(4)]);
/**
 * Service windows as a host WRITES them, the shape `isOutletOpen` reads: a day
 * key (`sun` to `sat`) holding one `["HH:MM","HH:MM"]` window or a list of them.
 * A window whose end is before its start runs past midnight. A day with no key
 * is closed; null hours means always open.
 *
 * Stricter than the read shape `OutletHours`, which stays loose because rows
 * written before this schema existed must still read.
 */
exports.OutletHoursInput = zod_1.z
    .object({
    sun: DayHours,
    mon: DayHours,
    tue: DayHours,
    wed: DayHours,
    thu: DayHours,
    fri: DayHours,
    sat: DayHours,
})
    .partial()
    .strict()
    .nullable();
/**
 * Where a standalone outlet is (D-l). Required when an outlet has no property,
 * because it has no property to borrow a location or a clock from.
 */
exports.OutletAddress = zod_1.z.object({
    street: zod_1.z.string().trim().min(1).max(200).optional(),
    district: zod_1.z.string().trim().min(1).max(120).optional(),
    lat: zod_1.z.number().min(-90).max(90),
    lng: zod_1.z.number().min(-180).max(180),
    timeZone: zod_1.z.string().trim().min(1).max(64).default("Africa/Kigali"),
});
// --- Parties -----------------------------------------------------------------
exports.OutletParty = zod_1.z.object({
    id: primitives_1.Uuid,
    /** Set when the party is a business registered on Injishi. Only such a party may operate a non hotel outlet. */
    orgId: primitives_1.Uuid.nullable(),
    legalName: zod_1.z.string(),
    tin: zod_1.z.string().nullable(),
    contactName: zod_1.z.string().nullable(),
    contactPhone: zod_1.z.string().nullable(),
    contactEmail: zod_1.z.string().nullable(),
    status: exports.OutletPartyStatus,
    /** This workspace's own business: the party every hotel operated outlet names. */
    isOwnOrg: zod_1.z.boolean(),
});
exports.OutletPartyList = zod_1.z.object({ parties: zod_1.z.array(exports.OutletParty) });
exports.CreateOutletPartyRequest = zod_1.z.object({
    legalName: zod_1.z.string().trim().min(1).max(200),
    /** When `orgId` is set too, it must be that org's TIN or the request is refused. */
    tin: registration_1.Tin.optional(),
    orgId: primitives_1.Uuid.optional(),
    contactName: zod_1.z.string().trim().min(1).max(120).optional(),
    contactPhone: zod_1.z.string().trim().min(6).max(32).optional(),
    contactEmail: zod_1.z.string().trim().email().max(254).optional(),
});
exports.UpdateOutletPartyRequest = exports.CreateOutletPartyRequest.extend({
    status: exports.OutletPartyStatus,
})
    .partial()
    .refine((v) => Object.keys(v).length > 0, { message: "Say what to change." });
// --- Outlets -----------------------------------------------------------------
/** A party as an outlet row names it. */
exports.OutletPartySummary = zod_1.z.object({
    id: primitives_1.Uuid,
    legalName: zod_1.z.string(),
    orgId: primitives_1.Uuid.nullable(),
});
exports.OutletTenancySummary = zod_1.z.object({
    id: primitives_1.Uuid,
    status: exports.OutletTenancyStatus,
    hostPropertyId: primitives_1.Uuid,
    tenantOrgId: primitives_1.Uuid,
});
exports.OperatorOutlet = zod_1.z.object({
    id: primitives_1.Uuid,
    name: zod_1.z.string(),
    outletKind: ordering_1.OutletKind,
    departmentId: primitives_1.Uuid,
    departmentName: zod_1.z.string().nullable(),
    /** Null for a standalone outlet with no hotel (D-l). */
    propertyId: primitives_1.Uuid.nullable(),
    propertyName: zod_1.z.string().nullable(),
    relationshipType: exports.OutletRelationshipType,
    operatorParty: exports.OutletPartySummary.nullable(),
    ownerParty: exports.OutletPartySummary.nullable(),
    /** Whose TIN signs a sale here. Decided by the server, never sent by a client. */
    taxEntityOrgId: primitives_1.Uuid,
    orderingAccess: ordering_1.OrderingAccess,
    amenityCode: zod_1.z.string().nullable(),
    rraBranchId: zod_1.z.string(),
    guestVisible: zod_1.z.boolean(),
    slug: zod_1.z.string().nullable(),
    address: exports.OutletAddress.nullable(),
    hours: ordering_1.OutletHours,
    sortOrder: zod_1.z.number().int(),
    status: ops_1.DepartmentStatus,
    /** The newest tenancy that is not ended, or null. */
    tenancy: exports.OutletTenancySummary.nullable(),
    /** Which arrangements this outlet's kind may carry, from `outlets.allowed_relationships`. */
    allowedRelationships: zod_1.z.array(exports.OutletRelationshipType),
});
exports.OperatorOutletList = zod_1.z.object({
    outlets: zod_1.z.array(exports.OperatorOutlet),
    /**
     * The whole policy, keyed by outlet kind with `*` as the fallback, so a form
     * can offer only what the server will accept. The server still refuses the
     * rest; this is an affordance.
     */
    relationshipPolicy: zod_1.z.record(zod_1.z.string(), zod_1.z.array(exports.OutletRelationshipType)),
});
const RraBranchId = zod_1.z.string().regex(/^\d{2}$/, "An RRA branch id is two digits.");
exports.CreateOutletRequest = zod_1.z.object({
    name: zod_1.z.string().trim().min(1).max(120),
    departmentId: primitives_1.Uuid,
    outletKind: ordering_1.OutletKind,
    /** Left out for a standalone outlet, which must then send `address`. */
    propertyId: primitives_1.Uuid.optional(),
    relationshipType: exports.OutletRelationshipType.default("hotel_operated"),
    /** Required unless `hotel_operated`, where the server names the workspace's own party. */
    operatorPartyId: primitives_1.Uuid.optional(),
    ownerPartyId: primitives_1.Uuid.optional(),
    orderingAccess: ordering_1.OrderingAccess.default("in_house_only"),
    amenityCode: zod_1.z.string().trim().min(1).max(64).optional(),
    hours: exports.OutletHoursInput.optional(),
    address: exports.OutletAddress.optional(),
    rraBranchId: RraBranchId.optional(),
    guestVisible: zod_1.z.boolean().optional(),
    sortOrder: zod_1.z.number().int().min(0).max(9999).optional(),
});
/**
 * Change an outlet. `propertyId` is absent on purpose: an outlet does not move
 * between properties, because its sales were declared where it stood. Archive
 * it and create another. `amenityCode` and `address` accept null to clear.
 */
exports.UpdateOutletRequest = zod_1.z
    .object({
    name: zod_1.z.string().trim().min(1).max(120),
    departmentId: primitives_1.Uuid,
    outletKind: ordering_1.OutletKind,
    relationshipType: exports.OutletRelationshipType,
    operatorPartyId: primitives_1.Uuid.nullable(),
    ownerPartyId: primitives_1.Uuid.nullable(),
    orderingAccess: ordering_1.OrderingAccess,
    amenityCode: zod_1.z.string().trim().min(1).max(64).nullable(),
    hours: exports.OutletHoursInput,
    address: exports.OutletAddress.nullable(),
    rraBranchId: RraBranchId,
    guestVisible: zod_1.z.boolean(),
    sortOrder: zod_1.z.number().int().min(0).max(9999),
})
    .partial()
    .refine((v) => Object.keys(v).length > 0, { message: "Say what to change." });
// --- Property page facilities (D-k, AC-16) -----------------------------------
exports.FacilityAmenity = zod_1.z.object({
    code: zod_1.z.string(),
    label: zod_1.z.string(),
    category: zod_1.z.string().nullable(),
});
exports.FacilityOutlet = zod_1.z.object({
    id: primitives_1.Uuid,
    name: zod_1.z.string(),
    outletKind: ordering_1.OutletKind,
    orderingAccess: ordering_1.OrderingAccess,
    hours: ordering_1.OutletHours,
    /** The operator's legal name, set only when someone other than the hotel runs it. */
    operatorLabel: zod_1.z.string().nullable(),
});
/**
 * One card on a property page. An amenity with an outlet pointing at it renders
 * ONCE carrying both faces; either face alone is also a card.
 */
exports.PropertyFacility = zod_1.z
    .object({
    /** Stable for list rendering: `amenity:<code>` or `outlet:<id>`. */
    key: zod_1.z.string(),
    amenity: exports.FacilityAmenity.nullable(),
    outlet: exports.FacilityOutlet.nullable(),
})
    .refine((v) => v.amenity !== null || v.outlet !== null, {
    message: "A facility is an amenity, an outlet, or both.",
});
//# sourceMappingURL=outlets.js.map