import { z } from "zod";
/**
 * OUTLETS, THEIR PARTIES, AND THE FACILITIES A PROPERTY PAGE LISTS
 * (ADR-050 D-h to D-l, slice 4).
 *
 * An outlet names who runs it (the operator), who owns it, and the arrangement
 * between them and the hotel. `taxEntityOrgId` is decided by the server from
 * those three and is never accepted from a client: it is whose TIN signs a sale.
 */
/** Mirrors the `outlet_relationship_type` Postgres enum exactly. */
export declare const OutletRelationshipType: z.ZodEnum<["hotel_operated", "third_party_managed", "leased_tenant", "concession", "franchise", "revenue_share"]>;
export type OutletRelationshipType = z.infer<typeof OutletRelationshipType>;
/** Mirrors `outlet_party_status`. */
export declare const OutletPartyStatus: z.ZodEnum<["active", "archived"]>;
export type OutletPartyStatus = z.infer<typeof OutletPartyStatus>;
/** Mirrors `outlet_tenancy_status`. */
export declare const OutletTenancyStatus: z.ZodEnum<["invited", "requested", "active", "ended"]>;
export type OutletTenancyStatus = z.infer<typeof OutletTenancyStatus>;
/**
 * Service windows as a host WRITES them, the shape `isOutletOpen` reads: a day
 * key (`sun` to `sat`) holding one `["HH:MM","HH:MM"]` window or a list of them.
 * A window whose end is before its start runs past midnight. A day with no key
 * is closed; null hours means always open.
 *
 * Stricter than the read shape `OutletHours`, which stays loose because rows
 * written before this schema existed must still read.
 */
export declare const OutletHoursInput: z.ZodNullable<z.ZodObject<{
    sun: z.ZodOptional<z.ZodUnion<[z.ZodTuple<[z.ZodString, z.ZodString], null>, z.ZodArray<z.ZodTuple<[z.ZodString, z.ZodString], null>, "many">]>>;
    mon: z.ZodOptional<z.ZodUnion<[z.ZodTuple<[z.ZodString, z.ZodString], null>, z.ZodArray<z.ZodTuple<[z.ZodString, z.ZodString], null>, "many">]>>;
    tue: z.ZodOptional<z.ZodUnion<[z.ZodTuple<[z.ZodString, z.ZodString], null>, z.ZodArray<z.ZodTuple<[z.ZodString, z.ZodString], null>, "many">]>>;
    wed: z.ZodOptional<z.ZodUnion<[z.ZodTuple<[z.ZodString, z.ZodString], null>, z.ZodArray<z.ZodTuple<[z.ZodString, z.ZodString], null>, "many">]>>;
    thu: z.ZodOptional<z.ZodUnion<[z.ZodTuple<[z.ZodString, z.ZodString], null>, z.ZodArray<z.ZodTuple<[z.ZodString, z.ZodString], null>, "many">]>>;
    fri: z.ZodOptional<z.ZodUnion<[z.ZodTuple<[z.ZodString, z.ZodString], null>, z.ZodArray<z.ZodTuple<[z.ZodString, z.ZodString], null>, "many">]>>;
    sat: z.ZodOptional<z.ZodUnion<[z.ZodTuple<[z.ZodString, z.ZodString], null>, z.ZodArray<z.ZodTuple<[z.ZodString, z.ZodString], null>, "many">]>>;
}, "strict", z.ZodTypeAny, {
    sun?: [string, string] | [string, string][] | undefined;
    mon?: [string, string] | [string, string][] | undefined;
    tue?: [string, string] | [string, string][] | undefined;
    wed?: [string, string] | [string, string][] | undefined;
    thu?: [string, string] | [string, string][] | undefined;
    fri?: [string, string] | [string, string][] | undefined;
    sat?: [string, string] | [string, string][] | undefined;
}, {
    sun?: [string, string] | [string, string][] | undefined;
    mon?: [string, string] | [string, string][] | undefined;
    tue?: [string, string] | [string, string][] | undefined;
    wed?: [string, string] | [string, string][] | undefined;
    thu?: [string, string] | [string, string][] | undefined;
    fri?: [string, string] | [string, string][] | undefined;
    sat?: [string, string] | [string, string][] | undefined;
}>>;
export type OutletHoursInput = z.infer<typeof OutletHoursInput>;
/**
 * Where a standalone outlet is (D-l). Required when an outlet has no property,
 * because it has no property to borrow a location or a clock from.
 */
export declare const OutletAddress: z.ZodObject<{
    street: z.ZodOptional<z.ZodString>;
    district: z.ZodOptional<z.ZodString>;
    lat: z.ZodNumber;
    lng: z.ZodNumber;
    timeZone: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    lat: number;
    lng: number;
    timeZone: string;
    district?: string | undefined;
    street?: string | undefined;
}, {
    lat: number;
    lng: number;
    district?: string | undefined;
    street?: string | undefined;
    timeZone?: string | undefined;
}>;
export type OutletAddress = z.infer<typeof OutletAddress>;
export declare const OutletParty: z.ZodObject<{
    id: z.ZodString;
    /** Set when the party is a business registered on Injishi. Only such a party may operate a non hotel outlet. */
    orgId: z.ZodNullable<z.ZodString>;
    legalName: z.ZodString;
    tin: z.ZodNullable<z.ZodString>;
    contactName: z.ZodNullable<z.ZodString>;
    contactPhone: z.ZodNullable<z.ZodString>;
    contactEmail: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<["active", "archived"]>;
    /** This workspace's own business: the party every hotel operated outlet names. */
    isOwnOrg: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    status: "active" | "archived";
    id: string;
    legalName: string;
    tin: string | null;
    orgId: string | null;
    contactEmail: string | null;
    contactName: string | null;
    contactPhone: string | null;
    isOwnOrg: boolean;
}, {
    status: "active" | "archived";
    id: string;
    legalName: string;
    tin: string | null;
    orgId: string | null;
    contactEmail: string | null;
    contactName: string | null;
    contactPhone: string | null;
    isOwnOrg: boolean;
}>;
export type OutletParty = z.infer<typeof OutletParty>;
export declare const OutletPartyList: z.ZodObject<{
    parties: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        /** Set when the party is a business registered on Injishi. Only such a party may operate a non hotel outlet. */
        orgId: z.ZodNullable<z.ZodString>;
        legalName: z.ZodString;
        tin: z.ZodNullable<z.ZodString>;
        contactName: z.ZodNullable<z.ZodString>;
        contactPhone: z.ZodNullable<z.ZodString>;
        contactEmail: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<["active", "archived"]>;
        /** This workspace's own business: the party every hotel operated outlet names. */
        isOwnOrg: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "archived";
        id: string;
        legalName: string;
        tin: string | null;
        orgId: string | null;
        contactEmail: string | null;
        contactName: string | null;
        contactPhone: string | null;
        isOwnOrg: boolean;
    }, {
        status: "active" | "archived";
        id: string;
        legalName: string;
        tin: string | null;
        orgId: string | null;
        contactEmail: string | null;
        contactName: string | null;
        contactPhone: string | null;
        isOwnOrg: boolean;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    parties: {
        status: "active" | "archived";
        id: string;
        legalName: string;
        tin: string | null;
        orgId: string | null;
        contactEmail: string | null;
        contactName: string | null;
        contactPhone: string | null;
        isOwnOrg: boolean;
    }[];
}, {
    parties: {
        status: "active" | "archived";
        id: string;
        legalName: string;
        tin: string | null;
        orgId: string | null;
        contactEmail: string | null;
        contactName: string | null;
        contactPhone: string | null;
        isOwnOrg: boolean;
    }[];
}>;
export type OutletPartyList = z.infer<typeof OutletPartyList>;
export declare const CreateOutletPartyRequest: z.ZodObject<{
    legalName: z.ZodString;
    /** When `orgId` is set too, it must be that org's TIN or the request is refused. */
    tin: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>>;
    orgId: z.ZodOptional<z.ZodString>;
    contactName: z.ZodOptional<z.ZodString>;
    contactPhone: z.ZodOptional<z.ZodString>;
    contactEmail: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    legalName: string;
    tin?: string | undefined;
    orgId?: string | undefined;
    contactEmail?: string | undefined;
    contactName?: string | undefined;
    contactPhone?: string | undefined;
}, {
    legalName: string;
    tin?: string | undefined;
    orgId?: string | undefined;
    contactEmail?: string | undefined;
    contactName?: string | undefined;
    contactPhone?: string | undefined;
}>;
export type CreateOutletPartyRequest = z.infer<typeof CreateOutletPartyRequest>;
export declare const UpdateOutletPartyRequest: z.ZodEffects<z.ZodObject<{
    legalName: z.ZodOptional<z.ZodString>;
    tin: z.ZodOptional<z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>>>;
    orgId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    contactName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    contactPhone: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    contactEmail: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    status: z.ZodOptional<z.ZodEnum<["active", "archived"]>>;
}, "strip", z.ZodTypeAny, {
    status?: "active" | "archived" | undefined;
    legalName?: string | undefined;
    tin?: string | undefined;
    orgId?: string | undefined;
    contactEmail?: string | undefined;
    contactName?: string | undefined;
    contactPhone?: string | undefined;
}, {
    status?: "active" | "archived" | undefined;
    legalName?: string | undefined;
    tin?: string | undefined;
    orgId?: string | undefined;
    contactEmail?: string | undefined;
    contactName?: string | undefined;
    contactPhone?: string | undefined;
}>, {
    status?: "active" | "archived" | undefined;
    legalName?: string | undefined;
    tin?: string | undefined;
    orgId?: string | undefined;
    contactEmail?: string | undefined;
    contactName?: string | undefined;
    contactPhone?: string | undefined;
}, {
    status?: "active" | "archived" | undefined;
    legalName?: string | undefined;
    tin?: string | undefined;
    orgId?: string | undefined;
    contactEmail?: string | undefined;
    contactName?: string | undefined;
    contactPhone?: string | undefined;
}>;
export type UpdateOutletPartyRequest = z.infer<typeof UpdateOutletPartyRequest>;
/** A party as an outlet row names it. */
export declare const OutletPartySummary: z.ZodObject<{
    id: z.ZodString;
    legalName: z.ZodString;
    orgId: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    legalName: string;
    orgId: string | null;
}, {
    id: string;
    legalName: string;
    orgId: string | null;
}>;
export type OutletPartySummary = z.infer<typeof OutletPartySummary>;
export declare const OutletTenancySummary: z.ZodObject<{
    id: z.ZodString;
    status: z.ZodEnum<["invited", "requested", "active", "ended"]>;
    hostPropertyId: z.ZodString;
    tenantOrgId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "active" | "ended" | "requested" | "invited";
    id: string;
    hostPropertyId: string;
    tenantOrgId: string;
}, {
    status: "active" | "ended" | "requested" | "invited";
    id: string;
    hostPropertyId: string;
    tenantOrgId: string;
}>;
export type OutletTenancySummary = z.infer<typeof OutletTenancySummary>;
export declare const OperatorOutlet: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    outletKind: z.ZodEnum<["restaurant", "bar", "lounge", "banquet", "room_service", "spa", "gym", "pool", "gift_shop", "parking", "laundry", "business_center", "other"]>;
    departmentId: z.ZodString;
    departmentName: z.ZodNullable<z.ZodString>;
    /** Null for a standalone outlet with no hotel (D-l). */
    propertyId: z.ZodNullable<z.ZodString>;
    propertyName: z.ZodNullable<z.ZodString>;
    relationshipType: z.ZodEnum<["hotel_operated", "third_party_managed", "leased_tenant", "concession", "franchise", "revenue_share"]>;
    operatorParty: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        legalName: z.ZodString;
        orgId: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        legalName: string;
        orgId: string | null;
    }, {
        id: string;
        legalName: string;
        orgId: string | null;
    }>>;
    ownerParty: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        legalName: z.ZodString;
        orgId: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        legalName: string;
        orgId: string | null;
    }, {
        id: string;
        legalName: string;
        orgId: string | null;
    }>>;
    /** Whose TIN signs a sale here. Decided by the server, never sent by a client. */
    taxEntityOrgId: z.ZodString;
    orderingAccess: z.ZodEnum<["in_house_only", "walk_in_only", "both"]>;
    amenityCode: z.ZodNullable<z.ZodString>;
    /** Null means the outlet declares under its branch's RRA id (ADR-054 AC-F1). */
    rraBranchId: z.ZodNullable<z.ZodString>;
    guestVisible: z.ZodBoolean;
    slug: z.ZodNullable<z.ZodString>;
    address: z.ZodNullable<z.ZodObject<{
        street: z.ZodOptional<z.ZodString>;
        district: z.ZodOptional<z.ZodString>;
        lat: z.ZodNumber;
        lng: z.ZodNumber;
        timeZone: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        lat: number;
        lng: number;
        timeZone: string;
        district?: string | undefined;
        street?: string | undefined;
    }, {
        lat: number;
        lng: number;
        district?: string | undefined;
        street?: string | undefined;
        timeZone?: string | undefined;
    }>>;
    hours: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    sortOrder: z.ZodNumber;
    status: z.ZodEnum<["active", "archived"]>;
    /** The newest tenancy that is not ended, or null. */
    tenancy: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        status: z.ZodEnum<["invited", "requested", "active", "ended"]>;
        hostPropertyId: z.ZodString;
        tenantOrgId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "ended" | "requested" | "invited";
        id: string;
        hostPropertyId: string;
        tenantOrgId: string;
    }, {
        status: "active" | "ended" | "requested" | "invited";
        id: string;
        hostPropertyId: string;
        tenantOrgId: string;
    }>>;
    /** Which arrangements this outlet's kind may carry, from `outlets.allowed_relationships`. */
    allowedRelationships: z.ZodArray<z.ZodEnum<["hotel_operated", "third_party_managed", "leased_tenant", "concession", "franchise", "revenue_share"]>, "many">;
}, "strip", z.ZodTypeAny, {
    status: "active" | "archived";
    name: string;
    id: string;
    slug: string | null;
    address: {
        lat: number;
        lng: number;
        timeZone: string;
        district?: string | undefined;
        street?: string | undefined;
    } | null;
    sortOrder: number;
    rraBranchId: string | null;
    propertyName: string | null;
    departmentName: string | null;
    propertyId: string | null;
    amenityCode: string | null;
    departmentId: string;
    guestVisible: boolean;
    outletKind: "other" | "restaurant" | "bar" | "lounge" | "banquet" | "room_service" | "spa" | "gym" | "pool" | "gift_shop" | "parking" | "laundry" | "business_center";
    orderingAccess: "both" | "in_house_only" | "walk_in_only";
    hours: Record<string, unknown> | null;
    relationshipType: "franchise" | "hotel_operated" | "third_party_managed" | "leased_tenant" | "concession" | "revenue_share";
    operatorParty: {
        id: string;
        legalName: string;
        orgId: string | null;
    } | null;
    ownerParty: {
        id: string;
        legalName: string;
        orgId: string | null;
    } | null;
    taxEntityOrgId: string;
    tenancy: {
        status: "active" | "ended" | "requested" | "invited";
        id: string;
        hostPropertyId: string;
        tenantOrgId: string;
    } | null;
    allowedRelationships: ("franchise" | "hotel_operated" | "third_party_managed" | "leased_tenant" | "concession" | "revenue_share")[];
}, {
    status: "active" | "archived";
    name: string;
    id: string;
    slug: string | null;
    address: {
        lat: number;
        lng: number;
        district?: string | undefined;
        street?: string | undefined;
        timeZone?: string | undefined;
    } | null;
    sortOrder: number;
    rraBranchId: string | null;
    propertyName: string | null;
    departmentName: string | null;
    propertyId: string | null;
    amenityCode: string | null;
    departmentId: string;
    guestVisible: boolean;
    outletKind: "other" | "restaurant" | "bar" | "lounge" | "banquet" | "room_service" | "spa" | "gym" | "pool" | "gift_shop" | "parking" | "laundry" | "business_center";
    orderingAccess: "both" | "in_house_only" | "walk_in_only";
    hours: Record<string, unknown> | null;
    relationshipType: "franchise" | "hotel_operated" | "third_party_managed" | "leased_tenant" | "concession" | "revenue_share";
    operatorParty: {
        id: string;
        legalName: string;
        orgId: string | null;
    } | null;
    ownerParty: {
        id: string;
        legalName: string;
        orgId: string | null;
    } | null;
    taxEntityOrgId: string;
    tenancy: {
        status: "active" | "ended" | "requested" | "invited";
        id: string;
        hostPropertyId: string;
        tenantOrgId: string;
    } | null;
    allowedRelationships: ("franchise" | "hotel_operated" | "third_party_managed" | "leased_tenant" | "concession" | "revenue_share")[];
}>;
export type OperatorOutlet = z.infer<typeof OperatorOutlet>;
export declare const OperatorOutletList: z.ZodObject<{
    outlets: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        outletKind: z.ZodEnum<["restaurant", "bar", "lounge", "banquet", "room_service", "spa", "gym", "pool", "gift_shop", "parking", "laundry", "business_center", "other"]>;
        departmentId: z.ZodString;
        departmentName: z.ZodNullable<z.ZodString>;
        /** Null for a standalone outlet with no hotel (D-l). */
        propertyId: z.ZodNullable<z.ZodString>;
        propertyName: z.ZodNullable<z.ZodString>;
        relationshipType: z.ZodEnum<["hotel_operated", "third_party_managed", "leased_tenant", "concession", "franchise", "revenue_share"]>;
        operatorParty: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            legalName: z.ZodString;
            orgId: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            legalName: string;
            orgId: string | null;
        }, {
            id: string;
            legalName: string;
            orgId: string | null;
        }>>;
        ownerParty: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            legalName: z.ZodString;
            orgId: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            legalName: string;
            orgId: string | null;
        }, {
            id: string;
            legalName: string;
            orgId: string | null;
        }>>;
        /** Whose TIN signs a sale here. Decided by the server, never sent by a client. */
        taxEntityOrgId: z.ZodString;
        orderingAccess: z.ZodEnum<["in_house_only", "walk_in_only", "both"]>;
        amenityCode: z.ZodNullable<z.ZodString>;
        /** Null means the outlet declares under its branch's RRA id (ADR-054 AC-F1). */
        rraBranchId: z.ZodNullable<z.ZodString>;
        guestVisible: z.ZodBoolean;
        slug: z.ZodNullable<z.ZodString>;
        address: z.ZodNullable<z.ZodObject<{
            street: z.ZodOptional<z.ZodString>;
            district: z.ZodOptional<z.ZodString>;
            lat: z.ZodNumber;
            lng: z.ZodNumber;
            timeZone: z.ZodDefault<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            lat: number;
            lng: number;
            timeZone: string;
            district?: string | undefined;
            street?: string | undefined;
        }, {
            lat: number;
            lng: number;
            district?: string | undefined;
            street?: string | undefined;
            timeZone?: string | undefined;
        }>>;
        hours: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        sortOrder: z.ZodNumber;
        status: z.ZodEnum<["active", "archived"]>;
        /** The newest tenancy that is not ended, or null. */
        tenancy: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            status: z.ZodEnum<["invited", "requested", "active", "ended"]>;
            hostPropertyId: z.ZodString;
            tenantOrgId: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            status: "active" | "ended" | "requested" | "invited";
            id: string;
            hostPropertyId: string;
            tenantOrgId: string;
        }, {
            status: "active" | "ended" | "requested" | "invited";
            id: string;
            hostPropertyId: string;
            tenantOrgId: string;
        }>>;
        /** Which arrangements this outlet's kind may carry, from `outlets.allowed_relationships`. */
        allowedRelationships: z.ZodArray<z.ZodEnum<["hotel_operated", "third_party_managed", "leased_tenant", "concession", "franchise", "revenue_share"]>, "many">;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "archived";
        name: string;
        id: string;
        slug: string | null;
        address: {
            lat: number;
            lng: number;
            timeZone: string;
            district?: string | undefined;
            street?: string | undefined;
        } | null;
        sortOrder: number;
        rraBranchId: string | null;
        propertyName: string | null;
        departmentName: string | null;
        propertyId: string | null;
        amenityCode: string | null;
        departmentId: string;
        guestVisible: boolean;
        outletKind: "other" | "restaurant" | "bar" | "lounge" | "banquet" | "room_service" | "spa" | "gym" | "pool" | "gift_shop" | "parking" | "laundry" | "business_center";
        orderingAccess: "both" | "in_house_only" | "walk_in_only";
        hours: Record<string, unknown> | null;
        relationshipType: "franchise" | "hotel_operated" | "third_party_managed" | "leased_tenant" | "concession" | "revenue_share";
        operatorParty: {
            id: string;
            legalName: string;
            orgId: string | null;
        } | null;
        ownerParty: {
            id: string;
            legalName: string;
            orgId: string | null;
        } | null;
        taxEntityOrgId: string;
        tenancy: {
            status: "active" | "ended" | "requested" | "invited";
            id: string;
            hostPropertyId: string;
            tenantOrgId: string;
        } | null;
        allowedRelationships: ("franchise" | "hotel_operated" | "third_party_managed" | "leased_tenant" | "concession" | "revenue_share")[];
    }, {
        status: "active" | "archived";
        name: string;
        id: string;
        slug: string | null;
        address: {
            lat: number;
            lng: number;
            district?: string | undefined;
            street?: string | undefined;
            timeZone?: string | undefined;
        } | null;
        sortOrder: number;
        rraBranchId: string | null;
        propertyName: string | null;
        departmentName: string | null;
        propertyId: string | null;
        amenityCode: string | null;
        departmentId: string;
        guestVisible: boolean;
        outletKind: "other" | "restaurant" | "bar" | "lounge" | "banquet" | "room_service" | "spa" | "gym" | "pool" | "gift_shop" | "parking" | "laundry" | "business_center";
        orderingAccess: "both" | "in_house_only" | "walk_in_only";
        hours: Record<string, unknown> | null;
        relationshipType: "franchise" | "hotel_operated" | "third_party_managed" | "leased_tenant" | "concession" | "revenue_share";
        operatorParty: {
            id: string;
            legalName: string;
            orgId: string | null;
        } | null;
        ownerParty: {
            id: string;
            legalName: string;
            orgId: string | null;
        } | null;
        taxEntityOrgId: string;
        tenancy: {
            status: "active" | "ended" | "requested" | "invited";
            id: string;
            hostPropertyId: string;
            tenantOrgId: string;
        } | null;
        allowedRelationships: ("franchise" | "hotel_operated" | "third_party_managed" | "leased_tenant" | "concession" | "revenue_share")[];
    }>, "many">;
    /**
     * The whole policy, keyed by outlet kind with `*` as the fallback, so a form
     * can offer only what the server will accept. The server still refuses the
     * rest; this is an affordance.
     */
    relationshipPolicy: z.ZodRecord<z.ZodString, z.ZodArray<z.ZodEnum<["hotel_operated", "third_party_managed", "leased_tenant", "concession", "franchise", "revenue_share"]>, "many">>;
}, "strip", z.ZodTypeAny, {
    outlets: {
        status: "active" | "archived";
        name: string;
        id: string;
        slug: string | null;
        address: {
            lat: number;
            lng: number;
            timeZone: string;
            district?: string | undefined;
            street?: string | undefined;
        } | null;
        sortOrder: number;
        rraBranchId: string | null;
        propertyName: string | null;
        departmentName: string | null;
        propertyId: string | null;
        amenityCode: string | null;
        departmentId: string;
        guestVisible: boolean;
        outletKind: "other" | "restaurant" | "bar" | "lounge" | "banquet" | "room_service" | "spa" | "gym" | "pool" | "gift_shop" | "parking" | "laundry" | "business_center";
        orderingAccess: "both" | "in_house_only" | "walk_in_only";
        hours: Record<string, unknown> | null;
        relationshipType: "franchise" | "hotel_operated" | "third_party_managed" | "leased_tenant" | "concession" | "revenue_share";
        operatorParty: {
            id: string;
            legalName: string;
            orgId: string | null;
        } | null;
        ownerParty: {
            id: string;
            legalName: string;
            orgId: string | null;
        } | null;
        taxEntityOrgId: string;
        tenancy: {
            status: "active" | "ended" | "requested" | "invited";
            id: string;
            hostPropertyId: string;
            tenantOrgId: string;
        } | null;
        allowedRelationships: ("franchise" | "hotel_operated" | "third_party_managed" | "leased_tenant" | "concession" | "revenue_share")[];
    }[];
    relationshipPolicy: Record<string, ("franchise" | "hotel_operated" | "third_party_managed" | "leased_tenant" | "concession" | "revenue_share")[]>;
}, {
    outlets: {
        status: "active" | "archived";
        name: string;
        id: string;
        slug: string | null;
        address: {
            lat: number;
            lng: number;
            district?: string | undefined;
            street?: string | undefined;
            timeZone?: string | undefined;
        } | null;
        sortOrder: number;
        rraBranchId: string | null;
        propertyName: string | null;
        departmentName: string | null;
        propertyId: string | null;
        amenityCode: string | null;
        departmentId: string;
        guestVisible: boolean;
        outletKind: "other" | "restaurant" | "bar" | "lounge" | "banquet" | "room_service" | "spa" | "gym" | "pool" | "gift_shop" | "parking" | "laundry" | "business_center";
        orderingAccess: "both" | "in_house_only" | "walk_in_only";
        hours: Record<string, unknown> | null;
        relationshipType: "franchise" | "hotel_operated" | "third_party_managed" | "leased_tenant" | "concession" | "revenue_share";
        operatorParty: {
            id: string;
            legalName: string;
            orgId: string | null;
        } | null;
        ownerParty: {
            id: string;
            legalName: string;
            orgId: string | null;
        } | null;
        taxEntityOrgId: string;
        tenancy: {
            status: "active" | "ended" | "requested" | "invited";
            id: string;
            hostPropertyId: string;
            tenantOrgId: string;
        } | null;
        allowedRelationships: ("franchise" | "hotel_operated" | "third_party_managed" | "leased_tenant" | "concession" | "revenue_share")[];
    }[];
    relationshipPolicy: Record<string, ("franchise" | "hotel_operated" | "third_party_managed" | "leased_tenant" | "concession" | "revenue_share")[]>;
}>;
export type OperatorOutletList = z.infer<typeof OperatorOutletList>;
export declare const CreateOutletRequest: z.ZodObject<{
    name: z.ZodString;
    departmentId: z.ZodString;
    outletKind: z.ZodEnum<["restaurant", "bar", "lounge", "banquet", "room_service", "spa", "gym", "pool", "gift_shop", "parking", "laundry", "business_center", "other"]>;
    /** Left out for a standalone outlet, which must then send `address`. */
    propertyId: z.ZodOptional<z.ZodString>;
    relationshipType: z.ZodDefault<z.ZodEnum<["hotel_operated", "third_party_managed", "leased_tenant", "concession", "franchise", "revenue_share"]>>;
    /** Required unless `hotel_operated`, where the server names the workspace's own party. */
    operatorPartyId: z.ZodOptional<z.ZodString>;
    ownerPartyId: z.ZodOptional<z.ZodString>;
    orderingAccess: z.ZodDefault<z.ZodEnum<["in_house_only", "walk_in_only", "both"]>>;
    amenityCode: z.ZodOptional<z.ZodString>;
    hours: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        sun: z.ZodOptional<z.ZodUnion<[z.ZodTuple<[z.ZodString, z.ZodString], null>, z.ZodArray<z.ZodTuple<[z.ZodString, z.ZodString], null>, "many">]>>;
        mon: z.ZodOptional<z.ZodUnion<[z.ZodTuple<[z.ZodString, z.ZodString], null>, z.ZodArray<z.ZodTuple<[z.ZodString, z.ZodString], null>, "many">]>>;
        tue: z.ZodOptional<z.ZodUnion<[z.ZodTuple<[z.ZodString, z.ZodString], null>, z.ZodArray<z.ZodTuple<[z.ZodString, z.ZodString], null>, "many">]>>;
        wed: z.ZodOptional<z.ZodUnion<[z.ZodTuple<[z.ZodString, z.ZodString], null>, z.ZodArray<z.ZodTuple<[z.ZodString, z.ZodString], null>, "many">]>>;
        thu: z.ZodOptional<z.ZodUnion<[z.ZodTuple<[z.ZodString, z.ZodString], null>, z.ZodArray<z.ZodTuple<[z.ZodString, z.ZodString], null>, "many">]>>;
        fri: z.ZodOptional<z.ZodUnion<[z.ZodTuple<[z.ZodString, z.ZodString], null>, z.ZodArray<z.ZodTuple<[z.ZodString, z.ZodString], null>, "many">]>>;
        sat: z.ZodOptional<z.ZodUnion<[z.ZodTuple<[z.ZodString, z.ZodString], null>, z.ZodArray<z.ZodTuple<[z.ZodString, z.ZodString], null>, "many">]>>;
    }, "strict", z.ZodTypeAny, {
        sun?: [string, string] | [string, string][] | undefined;
        mon?: [string, string] | [string, string][] | undefined;
        tue?: [string, string] | [string, string][] | undefined;
        wed?: [string, string] | [string, string][] | undefined;
        thu?: [string, string] | [string, string][] | undefined;
        fri?: [string, string] | [string, string][] | undefined;
        sat?: [string, string] | [string, string][] | undefined;
    }, {
        sun?: [string, string] | [string, string][] | undefined;
        mon?: [string, string] | [string, string][] | undefined;
        tue?: [string, string] | [string, string][] | undefined;
        wed?: [string, string] | [string, string][] | undefined;
        thu?: [string, string] | [string, string][] | undefined;
        fri?: [string, string] | [string, string][] | undefined;
        sat?: [string, string] | [string, string][] | undefined;
    }>>>;
    address: z.ZodOptional<z.ZodObject<{
        street: z.ZodOptional<z.ZodString>;
        district: z.ZodOptional<z.ZodString>;
        lat: z.ZodNumber;
        lng: z.ZodNumber;
        timeZone: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        lat: number;
        lng: number;
        timeZone: string;
        district?: string | undefined;
        street?: string | undefined;
    }, {
        lat: number;
        lng: number;
        district?: string | undefined;
        street?: string | undefined;
        timeZone?: string | undefined;
    }>>;
    rraBranchId: z.ZodOptional<z.ZodString>;
    guestVisible: z.ZodOptional<z.ZodBoolean>;
    sortOrder: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name: string;
    departmentId: string;
    outletKind: "other" | "restaurant" | "bar" | "lounge" | "banquet" | "room_service" | "spa" | "gym" | "pool" | "gift_shop" | "parking" | "laundry" | "business_center";
    orderingAccess: "both" | "in_house_only" | "walk_in_only";
    relationshipType: "franchise" | "hotel_operated" | "third_party_managed" | "leased_tenant" | "concession" | "revenue_share";
    address?: {
        lat: number;
        lng: number;
        timeZone: string;
        district?: string | undefined;
        street?: string | undefined;
    } | undefined;
    sortOrder?: number | undefined;
    rraBranchId?: string | undefined;
    propertyId?: string | undefined;
    amenityCode?: string | undefined;
    guestVisible?: boolean | undefined;
    hours?: {
        sun?: [string, string] | [string, string][] | undefined;
        mon?: [string, string] | [string, string][] | undefined;
        tue?: [string, string] | [string, string][] | undefined;
        wed?: [string, string] | [string, string][] | undefined;
        thu?: [string, string] | [string, string][] | undefined;
        fri?: [string, string] | [string, string][] | undefined;
        sat?: [string, string] | [string, string][] | undefined;
    } | null | undefined;
    operatorPartyId?: string | undefined;
    ownerPartyId?: string | undefined;
}, {
    name: string;
    departmentId: string;
    outletKind: "other" | "restaurant" | "bar" | "lounge" | "banquet" | "room_service" | "spa" | "gym" | "pool" | "gift_shop" | "parking" | "laundry" | "business_center";
    address?: {
        lat: number;
        lng: number;
        district?: string | undefined;
        street?: string | undefined;
        timeZone?: string | undefined;
    } | undefined;
    sortOrder?: number | undefined;
    rraBranchId?: string | undefined;
    propertyId?: string | undefined;
    amenityCode?: string | undefined;
    guestVisible?: boolean | undefined;
    orderingAccess?: "both" | "in_house_only" | "walk_in_only" | undefined;
    hours?: {
        sun?: [string, string] | [string, string][] | undefined;
        mon?: [string, string] | [string, string][] | undefined;
        tue?: [string, string] | [string, string][] | undefined;
        wed?: [string, string] | [string, string][] | undefined;
        thu?: [string, string] | [string, string][] | undefined;
        fri?: [string, string] | [string, string][] | undefined;
        sat?: [string, string] | [string, string][] | undefined;
    } | null | undefined;
    relationshipType?: "franchise" | "hotel_operated" | "third_party_managed" | "leased_tenant" | "concession" | "revenue_share" | undefined;
    operatorPartyId?: string | undefined;
    ownerPartyId?: string | undefined;
}>;
export type CreateOutletRequest = z.infer<typeof CreateOutletRequest>;
/**
 * Change an outlet. `propertyId` is absent on purpose: an outlet does not move
 * between properties, because its sales were declared where it stood. Archive
 * it and create another. `amenityCode` and `address` accept null to clear.
 */
export declare const UpdateOutletRequest: z.ZodEffects<z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    departmentId: z.ZodOptional<z.ZodString>;
    outletKind: z.ZodOptional<z.ZodEnum<["restaurant", "bar", "lounge", "banquet", "room_service", "spa", "gym", "pool", "gift_shop", "parking", "laundry", "business_center", "other"]>>;
    relationshipType: z.ZodOptional<z.ZodEnum<["hotel_operated", "third_party_managed", "leased_tenant", "concession", "franchise", "revenue_share"]>>;
    operatorPartyId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    ownerPartyId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    orderingAccess: z.ZodOptional<z.ZodEnum<["in_house_only", "walk_in_only", "both"]>>;
    amenityCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    hours: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        sun: z.ZodOptional<z.ZodUnion<[z.ZodTuple<[z.ZodString, z.ZodString], null>, z.ZodArray<z.ZodTuple<[z.ZodString, z.ZodString], null>, "many">]>>;
        mon: z.ZodOptional<z.ZodUnion<[z.ZodTuple<[z.ZodString, z.ZodString], null>, z.ZodArray<z.ZodTuple<[z.ZodString, z.ZodString], null>, "many">]>>;
        tue: z.ZodOptional<z.ZodUnion<[z.ZodTuple<[z.ZodString, z.ZodString], null>, z.ZodArray<z.ZodTuple<[z.ZodString, z.ZodString], null>, "many">]>>;
        wed: z.ZodOptional<z.ZodUnion<[z.ZodTuple<[z.ZodString, z.ZodString], null>, z.ZodArray<z.ZodTuple<[z.ZodString, z.ZodString], null>, "many">]>>;
        thu: z.ZodOptional<z.ZodUnion<[z.ZodTuple<[z.ZodString, z.ZodString], null>, z.ZodArray<z.ZodTuple<[z.ZodString, z.ZodString], null>, "many">]>>;
        fri: z.ZodOptional<z.ZodUnion<[z.ZodTuple<[z.ZodString, z.ZodString], null>, z.ZodArray<z.ZodTuple<[z.ZodString, z.ZodString], null>, "many">]>>;
        sat: z.ZodOptional<z.ZodUnion<[z.ZodTuple<[z.ZodString, z.ZodString], null>, z.ZodArray<z.ZodTuple<[z.ZodString, z.ZodString], null>, "many">]>>;
    }, "strict", z.ZodTypeAny, {
        sun?: [string, string] | [string, string][] | undefined;
        mon?: [string, string] | [string, string][] | undefined;
        tue?: [string, string] | [string, string][] | undefined;
        wed?: [string, string] | [string, string][] | undefined;
        thu?: [string, string] | [string, string][] | undefined;
        fri?: [string, string] | [string, string][] | undefined;
        sat?: [string, string] | [string, string][] | undefined;
    }, {
        sun?: [string, string] | [string, string][] | undefined;
        mon?: [string, string] | [string, string][] | undefined;
        tue?: [string, string] | [string, string][] | undefined;
        wed?: [string, string] | [string, string][] | undefined;
        thu?: [string, string] | [string, string][] | undefined;
        fri?: [string, string] | [string, string][] | undefined;
        sat?: [string, string] | [string, string][] | undefined;
    }>>>;
    address: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        street: z.ZodOptional<z.ZodString>;
        district: z.ZodOptional<z.ZodString>;
        lat: z.ZodNumber;
        lng: z.ZodNumber;
        timeZone: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        lat: number;
        lng: number;
        timeZone: string;
        district?: string | undefined;
        street?: string | undefined;
    }, {
        lat: number;
        lng: number;
        district?: string | undefined;
        street?: string | undefined;
        timeZone?: string | undefined;
    }>>>;
    rraBranchId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    guestVisible: z.ZodOptional<z.ZodBoolean>;
    sortOrder: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    address?: {
        lat: number;
        lng: number;
        timeZone: string;
        district?: string | undefined;
        street?: string | undefined;
    } | null | undefined;
    sortOrder?: number | undefined;
    rraBranchId?: string | null | undefined;
    amenityCode?: string | null | undefined;
    departmentId?: string | undefined;
    guestVisible?: boolean | undefined;
    outletKind?: "other" | "restaurant" | "bar" | "lounge" | "banquet" | "room_service" | "spa" | "gym" | "pool" | "gift_shop" | "parking" | "laundry" | "business_center" | undefined;
    orderingAccess?: "both" | "in_house_only" | "walk_in_only" | undefined;
    hours?: {
        sun?: [string, string] | [string, string][] | undefined;
        mon?: [string, string] | [string, string][] | undefined;
        tue?: [string, string] | [string, string][] | undefined;
        wed?: [string, string] | [string, string][] | undefined;
        thu?: [string, string] | [string, string][] | undefined;
        fri?: [string, string] | [string, string][] | undefined;
        sat?: [string, string] | [string, string][] | undefined;
    } | null | undefined;
    relationshipType?: "franchise" | "hotel_operated" | "third_party_managed" | "leased_tenant" | "concession" | "revenue_share" | undefined;
    operatorPartyId?: string | null | undefined;
    ownerPartyId?: string | null | undefined;
}, {
    name?: string | undefined;
    address?: {
        lat: number;
        lng: number;
        district?: string | undefined;
        street?: string | undefined;
        timeZone?: string | undefined;
    } | null | undefined;
    sortOrder?: number | undefined;
    rraBranchId?: string | null | undefined;
    amenityCode?: string | null | undefined;
    departmentId?: string | undefined;
    guestVisible?: boolean | undefined;
    outletKind?: "other" | "restaurant" | "bar" | "lounge" | "banquet" | "room_service" | "spa" | "gym" | "pool" | "gift_shop" | "parking" | "laundry" | "business_center" | undefined;
    orderingAccess?: "both" | "in_house_only" | "walk_in_only" | undefined;
    hours?: {
        sun?: [string, string] | [string, string][] | undefined;
        mon?: [string, string] | [string, string][] | undefined;
        tue?: [string, string] | [string, string][] | undefined;
        wed?: [string, string] | [string, string][] | undefined;
        thu?: [string, string] | [string, string][] | undefined;
        fri?: [string, string] | [string, string][] | undefined;
        sat?: [string, string] | [string, string][] | undefined;
    } | null | undefined;
    relationshipType?: "franchise" | "hotel_operated" | "third_party_managed" | "leased_tenant" | "concession" | "revenue_share" | undefined;
    operatorPartyId?: string | null | undefined;
    ownerPartyId?: string | null | undefined;
}>, {
    name?: string | undefined;
    address?: {
        lat: number;
        lng: number;
        timeZone: string;
        district?: string | undefined;
        street?: string | undefined;
    } | null | undefined;
    sortOrder?: number | undefined;
    rraBranchId?: string | null | undefined;
    amenityCode?: string | null | undefined;
    departmentId?: string | undefined;
    guestVisible?: boolean | undefined;
    outletKind?: "other" | "restaurant" | "bar" | "lounge" | "banquet" | "room_service" | "spa" | "gym" | "pool" | "gift_shop" | "parking" | "laundry" | "business_center" | undefined;
    orderingAccess?: "both" | "in_house_only" | "walk_in_only" | undefined;
    hours?: {
        sun?: [string, string] | [string, string][] | undefined;
        mon?: [string, string] | [string, string][] | undefined;
        tue?: [string, string] | [string, string][] | undefined;
        wed?: [string, string] | [string, string][] | undefined;
        thu?: [string, string] | [string, string][] | undefined;
        fri?: [string, string] | [string, string][] | undefined;
        sat?: [string, string] | [string, string][] | undefined;
    } | null | undefined;
    relationshipType?: "franchise" | "hotel_operated" | "third_party_managed" | "leased_tenant" | "concession" | "revenue_share" | undefined;
    operatorPartyId?: string | null | undefined;
    ownerPartyId?: string | null | undefined;
}, {
    name?: string | undefined;
    address?: {
        lat: number;
        lng: number;
        district?: string | undefined;
        street?: string | undefined;
        timeZone?: string | undefined;
    } | null | undefined;
    sortOrder?: number | undefined;
    rraBranchId?: string | null | undefined;
    amenityCode?: string | null | undefined;
    departmentId?: string | undefined;
    guestVisible?: boolean | undefined;
    outletKind?: "other" | "restaurant" | "bar" | "lounge" | "banquet" | "room_service" | "spa" | "gym" | "pool" | "gift_shop" | "parking" | "laundry" | "business_center" | undefined;
    orderingAccess?: "both" | "in_house_only" | "walk_in_only" | undefined;
    hours?: {
        sun?: [string, string] | [string, string][] | undefined;
        mon?: [string, string] | [string, string][] | undefined;
        tue?: [string, string] | [string, string][] | undefined;
        wed?: [string, string] | [string, string][] | undefined;
        thu?: [string, string] | [string, string][] | undefined;
        fri?: [string, string] | [string, string][] | undefined;
        sat?: [string, string] | [string, string][] | undefined;
    } | null | undefined;
    relationshipType?: "franchise" | "hotel_operated" | "third_party_managed" | "leased_tenant" | "concession" | "revenue_share" | undefined;
    operatorPartyId?: string | null | undefined;
    ownerPartyId?: string | null | undefined;
}>;
export type UpdateOutletRequest = z.infer<typeof UpdateOutletRequest>;
export declare const FacilityAmenity: z.ZodObject<{
    code: z.ZodString;
    label: z.ZodString;
    category: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    code: string;
    label: string;
    category: string | null;
}, {
    code: string;
    label: string;
    category: string | null;
}>;
export type FacilityAmenity = z.infer<typeof FacilityAmenity>;
export declare const FacilityOutlet: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    outletKind: z.ZodEnum<["restaurant", "bar", "lounge", "banquet", "room_service", "spa", "gym", "pool", "gift_shop", "parking", "laundry", "business_center", "other"]>;
    orderingAccess: z.ZodEnum<["in_house_only", "walk_in_only", "both"]>;
    hours: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    /** The operator's legal name, set only when someone other than the hotel runs it. */
    operatorLabel: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: string;
    outletKind: "other" | "restaurant" | "bar" | "lounge" | "banquet" | "room_service" | "spa" | "gym" | "pool" | "gift_shop" | "parking" | "laundry" | "business_center";
    orderingAccess: "both" | "in_house_only" | "walk_in_only";
    hours: Record<string, unknown> | null;
    operatorLabel: string | null;
}, {
    name: string;
    id: string;
    outletKind: "other" | "restaurant" | "bar" | "lounge" | "banquet" | "room_service" | "spa" | "gym" | "pool" | "gift_shop" | "parking" | "laundry" | "business_center";
    orderingAccess: "both" | "in_house_only" | "walk_in_only";
    hours: Record<string, unknown> | null;
    operatorLabel: string | null;
}>;
export type FacilityOutlet = z.infer<typeof FacilityOutlet>;
/**
 * One card on a property page. An amenity with an outlet pointing at it renders
 * ONCE carrying both faces; either face alone is also a card.
 */
export declare const PropertyFacility: z.ZodEffects<z.ZodObject<{
    /** Stable for list rendering: `amenity:<code>` or `outlet:<id>`. */
    key: z.ZodString;
    amenity: z.ZodNullable<z.ZodObject<{
        code: z.ZodString;
        label: z.ZodString;
        category: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        code: string;
        label: string;
        category: string | null;
    }, {
        code: string;
        label: string;
        category: string | null;
    }>>;
    outlet: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        outletKind: z.ZodEnum<["restaurant", "bar", "lounge", "banquet", "room_service", "spa", "gym", "pool", "gift_shop", "parking", "laundry", "business_center", "other"]>;
        orderingAccess: z.ZodEnum<["in_house_only", "walk_in_only", "both"]>;
        hours: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        /** The operator's legal name, set only when someone other than the hotel runs it. */
        operatorLabel: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
        outletKind: "other" | "restaurant" | "bar" | "lounge" | "banquet" | "room_service" | "spa" | "gym" | "pool" | "gift_shop" | "parking" | "laundry" | "business_center";
        orderingAccess: "both" | "in_house_only" | "walk_in_only";
        hours: Record<string, unknown> | null;
        operatorLabel: string | null;
    }, {
        name: string;
        id: string;
        outletKind: "other" | "restaurant" | "bar" | "lounge" | "banquet" | "room_service" | "spa" | "gym" | "pool" | "gift_shop" | "parking" | "laundry" | "business_center";
        orderingAccess: "both" | "in_house_only" | "walk_in_only";
        hours: Record<string, unknown> | null;
        operatorLabel: string | null;
    }>>;
}, "strip", z.ZodTypeAny, {
    key: string;
    amenity: {
        code: string;
        label: string;
        category: string | null;
    } | null;
    outlet: {
        name: string;
        id: string;
        outletKind: "other" | "restaurant" | "bar" | "lounge" | "banquet" | "room_service" | "spa" | "gym" | "pool" | "gift_shop" | "parking" | "laundry" | "business_center";
        orderingAccess: "both" | "in_house_only" | "walk_in_only";
        hours: Record<string, unknown> | null;
        operatorLabel: string | null;
    } | null;
}, {
    key: string;
    amenity: {
        code: string;
        label: string;
        category: string | null;
    } | null;
    outlet: {
        name: string;
        id: string;
        outletKind: "other" | "restaurant" | "bar" | "lounge" | "banquet" | "room_service" | "spa" | "gym" | "pool" | "gift_shop" | "parking" | "laundry" | "business_center";
        orderingAccess: "both" | "in_house_only" | "walk_in_only";
        hours: Record<string, unknown> | null;
        operatorLabel: string | null;
    } | null;
}>, {
    key: string;
    amenity: {
        code: string;
        label: string;
        category: string | null;
    } | null;
    outlet: {
        name: string;
        id: string;
        outletKind: "other" | "restaurant" | "bar" | "lounge" | "banquet" | "room_service" | "spa" | "gym" | "pool" | "gift_shop" | "parking" | "laundry" | "business_center";
        orderingAccess: "both" | "in_house_only" | "walk_in_only";
        hours: Record<string, unknown> | null;
        operatorLabel: string | null;
    } | null;
}, {
    key: string;
    amenity: {
        code: string;
        label: string;
        category: string | null;
    } | null;
    outlet: {
        name: string;
        id: string;
        outletKind: "other" | "restaurant" | "bar" | "lounge" | "banquet" | "room_service" | "spa" | "gym" | "pool" | "gift_shop" | "parking" | "laundry" | "business_center";
        orderingAccess: "both" | "in_house_only" | "walk_in_only";
        hours: Record<string, unknown> | null;
        operatorLabel: string | null;
    } | null;
}>;
export type PropertyFacility = z.infer<typeof PropertyFacility>;
//# sourceMappingURL=outlets.d.ts.map