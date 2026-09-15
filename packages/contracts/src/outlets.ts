import { z } from "zod";
import { DepartmentStatus } from "./ops";
import { OrderingAccess, OutletHours, OutletKind } from "./ordering";
import { Uuid } from "./primitives";
import { Tin } from "./registration";
/**
 * OUTLETS, THEIR PARTIES, AND THE FACILITIES A PROPERTY PAGE LISTS
 * (ADR-050 D-h to D-l, slice 4).
 *
 * An outlet names who runs it (the operator), who owns it, and the arrangement
 * between them and the hotel. `taxEntityOrgId` is decided by the server from
 * those three and is never accepted from a client: it is whose TIN signs a sale.
 */
/** Mirrors the `outlet_relationship_type` Postgres enum exactly. */
export const OutletRelationshipType = z.enum([
    "hotel_operated",
    "third_party_managed",
    "leased_tenant",
    "concession",
    "franchise",
    "revenue_share",
]);
export type OutletRelationshipType = z.infer<typeof OutletRelationshipType>;
/** Mirrors `outlet_party_status`. */
export const OutletPartyStatus = z.enum(["active", "archived"]);
export type OutletPartyStatus = z.infer<typeof OutletPartyStatus>;
/** Mirrors `outlet_tenancy_status`. */
export const OutletTenancyStatus = z.enum(["invited", "requested", "active", "ended"]);
export type OutletTenancyStatus = z.infer<typeof OutletTenancyStatus>;
const ClockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "A time is HH:MM, 24 hour.");
const HoursWindow = z.tuple([ClockTime, ClockTime]);
/** One window, or a list of them for a kitchen that closes between services. */
const DayHours = z.union([HoursWindow, z.array(HoursWindow).min(1).max(4)]);
/**
 * Service windows as a host WRITES them, the shape `isOutletOpen` reads: a day
 * key (`sun` to `sat`) holding one `["HH:MM","HH:MM"]` window or a list of them.
 * A window whose end is before its start runs past midnight. A day with no key
 * is closed; null hours means always open.
 *
 * Stricter than the read shape `OutletHours`, which stays loose because rows
 * written before this schema existed must still read.
 */
export const OutletHoursInput = z
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
export type OutletHoursInput = z.infer<typeof OutletHoursInput>;
/**
 * Where a standalone outlet is (D-l). Required when an outlet has no property,
 * because it has no property to borrow a location or a clock from.
 */
export const OutletAddress = z.object({
    street: z.string().trim().min(1).max(200).optional(),
    district: z.string().trim().min(1).max(120).optional(),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    timeZone: z.string().trim().min(1).max(64).default("Africa/Kigali"),
});
export type OutletAddress = z.infer<typeof OutletAddress>;
// --- Parties -----------------------------------------------------------------
export const OutletParty = z.object({
    id: Uuid,
    /** Set when the party is a business registered on Injishi. Only such a party may operate a non hotel outlet. */
    orgId: Uuid.nullable(),
    legalName: z.string(),
    tin: z.string().nullable(),
    contactName: z.string().nullable(),
    contactPhone: z.string().nullable(),
    contactEmail: z.string().nullable(),
    status: OutletPartyStatus,
    /** This workspace's own business: the party every hotel operated outlet names. */
    isOwnOrg: z.boolean(),
});
export type OutletParty = z.infer<typeof OutletParty>;
export const OutletPartyList = z.object({ parties: z.array(OutletParty) });
export type OutletPartyList = z.infer<typeof OutletPartyList>;
export const CreateOutletPartyRequest = z.object({
    legalName: z.string().trim().min(1).max(200),
    /** When `orgId` is set too, it must be that org's TIN or the request is refused. */
    tin: Tin.optional(),
    orgId: Uuid.optional(),
    contactName: z.string().trim().min(1).max(120).optional(),
    contactPhone: z.string().trim().min(6).max(32).optional(),
    contactEmail: z.string().trim().email().max(254).optional(),
});
export type CreateOutletPartyRequest = z.infer<typeof CreateOutletPartyRequest>;
export const UpdateOutletPartyRequest = CreateOutletPartyRequest.extend({
    status: OutletPartyStatus,
})
    .partial()
    .refine((v) => Object.keys(v).length > 0, { message: "Say what to change." });
export type UpdateOutletPartyRequest = z.infer<typeof UpdateOutletPartyRequest>;
// --- Outlets -----------------------------------------------------------------
/** A party as an outlet row names it. */
export const OutletPartySummary = z.object({
    id: Uuid,
    legalName: z.string(),
    orgId: Uuid.nullable(),
});
export type OutletPartySummary = z.infer<typeof OutletPartySummary>;
export const OutletTenancySummary = z.object({
    id: Uuid,
    status: OutletTenancyStatus,
    hostPropertyId: Uuid,
    tenantOrgId: Uuid,
});
export type OutletTenancySummary = z.infer<typeof OutletTenancySummary>;
export const OperatorOutlet = z.object({
    id: Uuid,
    name: z.string(),
    outletKind: OutletKind,
    departmentId: Uuid,
    departmentName: z.string().nullable(),
    /** Null for a standalone outlet with no hotel (D-l). */
    propertyId: Uuid.nullable(),
    propertyName: z.string().nullable(),
    relationshipType: OutletRelationshipType,
    operatorParty: OutletPartySummary.nullable(),
    ownerParty: OutletPartySummary.nullable(),
    /** Whose TIN signs a sale here. Decided by the server, never sent by a client. */
    taxEntityOrgId: Uuid,
    orderingAccess: OrderingAccess,
    amenityCode: z.string().nullable(),
    /** Null means the outlet declares under its branch's RRA id (ADR-054 AC-F1). */
    rraBranchId: z.string().nullable(),
    guestVisible: z.boolean(),
    slug: z.string().nullable(),
    address: OutletAddress.nullable(),
    hours: OutletHours,
    sortOrder: z.number().int(),
    status: DepartmentStatus,
    /** The newest tenancy that is not ended, or null. */
    tenancy: OutletTenancySummary.nullable(),
    /** Which arrangements this outlet's kind may carry, from `outlets.allowed_relationships`. */
    allowedRelationships: z.array(OutletRelationshipType),
});
export type OperatorOutlet = z.infer<typeof OperatorOutlet>;
export const OperatorOutletList = z.object({
    outlets: z.array(OperatorOutlet),
    /**
     * The whole policy, keyed by outlet kind with `*` as the fallback, so a form
     * can offer only what the server will accept. The server still refuses the
     * rest; this is an affordance.
     */
    relationshipPolicy: z.record(z.string(), z.array(OutletRelationshipType)),
});
export type OperatorOutletList = z.infer<typeof OperatorOutletList>;
const RraBranchId = z.string().regex(/^\d{2}$/, "An RRA branch id is two digits.");
export const CreateOutletRequest = z.object({
    name: z.string().trim().min(1).max(120),
    departmentId: Uuid,
    outletKind: OutletKind,
    /** Left out for a standalone outlet, which must then send `address`. */
    propertyId: Uuid.optional(),
    relationshipType: OutletRelationshipType.default("hotel_operated"),
    /** Required unless `hotel_operated`, where the server names the workspace's own party. */
    operatorPartyId: Uuid.optional(),
    ownerPartyId: Uuid.optional(),
    orderingAccess: OrderingAccess.default("in_house_only"),
    amenityCode: z.string().trim().min(1).max(64).optional(),
    hours: OutletHoursInput.optional(),
    address: OutletAddress.optional(),
    rraBranchId: RraBranchId.optional(),
    guestVisible: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(9999).optional(),
});
export type CreateOutletRequest = z.infer<typeof CreateOutletRequest>;
/**
 * Change an outlet. `propertyId` is absent on purpose: an outlet does not move
 * between properties, because its sales were declared where it stood. Archive
 * it and create another. `amenityCode` and `address` accept null to clear.
 */
export const UpdateOutletRequest = z
    .object({
    name: z.string().trim().min(1).max(120),
    departmentId: Uuid,
    outletKind: OutletKind,
    relationshipType: OutletRelationshipType,
    operatorPartyId: Uuid.nullable(),
    ownerPartyId: Uuid.nullable(),
    orderingAccess: OrderingAccess,
    amenityCode: z.string().trim().min(1).max(64).nullable(),
    hours: OutletHoursInput,
    address: OutletAddress.nullable(),
    /** Null clears it, so the outlet declares under its branch again. */
    rraBranchId: RraBranchId.nullable(),
    guestVisible: z.boolean(),
    sortOrder: z.number().int().min(0).max(9999),
})
    .partial()
    .refine((v) => Object.keys(v).length > 0, { message: "Say what to change." });
export type UpdateOutletRequest = z.infer<typeof UpdateOutletRequest>;
// --- Property page facilities (D-k, AC-16) -----------------------------------
export const FacilityAmenity = z.object({
    code: z.string(),
    label: z.string(),
    category: z.string().nullable(),
});
export type FacilityAmenity = z.infer<typeof FacilityAmenity>;
export const FacilityOutlet = z.object({
    id: Uuid,
    name: z.string(),
    outletKind: OutletKind,
    orderingAccess: OrderingAccess,
    hours: OutletHours,
    /** The operator's legal name, set only when someone other than the hotel runs it. */
    operatorLabel: z.string().nullable(),
});
export type FacilityOutlet = z.infer<typeof FacilityOutlet>;
/**
 * One card on a property page. An amenity with an outlet pointing at it renders
 * ONCE carrying both faces; either face alone is also a card.
 */
export const PropertyFacility = z
    .object({
    /** Stable for list rendering: `amenity:<code>` or `outlet:<id>`. */
    key: z.string(),
    amenity: FacilityAmenity.nullable(),
    outlet: FacilityOutlet.nullable(),
})
    .refine((v) => v.amenity !== null || v.outlet !== null, {
    message: "A facility is an amenity, an outlet, or both.",
});
export type PropertyFacility = z.infer<typeof PropertyFacility>;
