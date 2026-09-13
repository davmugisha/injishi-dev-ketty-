import { z } from "zod";
/**
 * The operator write path for inventory (ADR-009).
 *
 * The public read shapes live in `property-detail.ts` (`PropertyDetail`) and
 * `booking.ts` (`RoomTypeSummary`) and answer a guest's question: what can I book? These
 * answer an operator's: what do I have, and is it live? Two different questions,
 * two different shapes, so a draft property never accidentally serialises
 * through a public contract.
 *
 * Feature 1 of the shared spine covers properties only. Room types, rates and
 * publishing extend this file when features 2 and 3 land.
 */
/** A listing is a draft until someone publishes it. */
export declare const ListingStatus: z.ZodEnum<["draft", "published"]>;
export type ListingStatus = z.infer<typeof ListingStatus>;
/**
 * Every operator route names the workspace it acts in.
 *
 * `WorkspaceGuard` reads this from the body on a write and the query on a read,
 * and refuses a request that names none. It proves the caller HOLDS that
 * workspace and nothing more; whether the target row BELONGS to it is a separate
 * check the service makes (ADR-009 AC-14).
 */
export declare const WorkspaceScoped: z.ZodObject<{
    workspaceId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    workspaceId: string;
}, {
    workspaceId: string;
}>;
export type WorkspaceScoped = z.infer<typeof WorkspaceScoped>;
export declare const CreatePropertyRequest: z.ZodObject<{
    workspaceId: z.ZodString;
} & {
    name: z.ZodString;
    sectorId: z.ZodNumber;
    /** The street line, e.g. "KG 11 Ave". Optional: not every plot has one. */
    street: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    /** `HH:MM` or `HH:MM:SS`; the column is a bare `time`. */
    checkInTime: z.ZodOptional<z.ZodString>;
    checkOutTime: z.ZodOptional<z.ZodString>;
    houseRules: z.ZodOptional<z.ZodString>;
    /**
     * Hide the exact pin from the public until a stay is confirmed. Already
     * respected by the public read path, so this is a real toggle, not a stub.
     */
    locationPrivacy: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    sectorId: number;
    name: string;
    workspaceId: string;
    checkInTime?: string | undefined;
    checkOutTime?: string | undefined;
    street?: string | undefined;
    description?: string | undefined;
    houseRules?: string | undefined;
    locationPrivacy?: boolean | undefined;
}, {
    sectorId: number;
    name: string;
    workspaceId: string;
    checkInTime?: string | undefined;
    checkOutTime?: string | undefined;
    street?: string | undefined;
    description?: string | undefined;
    houseRules?: string | undefined;
    locationPrivacy?: boolean | undefined;
}>;
export type CreatePropertyRequest = z.infer<typeof CreatePropertyRequest>;
/**
 * Editing replaces only the fields sent.
 *
 * A partial rather than a full replace because the operator screens edit one
 * card at a time, and a full replace would make an untouched section silently
 * clear itself.
 */
export declare const UpdatePropertyRequest: z.ZodObject<{
    workspaceId: z.ZodString;
} & {
    name: z.ZodOptional<z.ZodString>;
    sectorId: z.ZodOptional<z.ZodNumber>;
    street: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    checkInTime: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    checkOutTime: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    houseRules: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    locationPrivacy: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    workspaceId: string;
    sectorId?: number | undefined;
    name?: string | undefined;
    checkInTime?: string | undefined;
    checkOutTime?: string | undefined;
    street?: string | undefined;
    description?: string | undefined;
    houseRules?: string | undefined;
    locationPrivacy?: boolean | undefined;
}, {
    workspaceId: string;
    sectorId?: number | undefined;
    name?: string | undefined;
    checkInTime?: string | undefined;
    checkOutTime?: string | undefined;
    street?: string | undefined;
    description?: string | undefined;
    houseRules?: string | undefined;
    locationPrivacy?: boolean | undefined;
}>;
export type UpdatePropertyRequest = z.infer<typeof UpdatePropertyRequest>;
/** Reading is the same question, asked with a query string. */
export declare const PropertyQuery: z.ZodObject<{
    workspaceId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    workspaceId: string;
}, {
    workspaceId: string;
}>;
export type PropertyQuery = z.infer<typeof PropertyQuery>;
/**
 * The resolved address, sent with names as well as ids.
 *
 * The ids let the picker reopen on the right selection; the names let a list
 * render without three more requests. Province and district are JOINED from the
 * sector rather than stored, which is the whole reason only the sector is
 * written.
 */
export declare const PropertyAddress: z.ZodObject<{
    provinceId: z.ZodNullable<z.ZodNumber>;
    provinceName: z.ZodNullable<z.ZodString>;
    districtId: z.ZodNullable<z.ZodNumber>;
    districtName: z.ZodNullable<z.ZodString>;
    sectorId: z.ZodNullable<z.ZodNumber>;
    sectorName: z.ZodNullable<z.ZodString>;
    street: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    districtId: number | null;
    districtName: string | null;
    sectorId: number | null;
    provinceId: number | null;
    street: string | null;
    sectorName: string | null;
    provinceName: string | null;
}, {
    districtId: number | null;
    districtName: string | null;
    sectorId: number | null;
    provinceId: number | null;
    street: string | null;
    sectorName: string | null;
    provinceName: string | null;
}>;
export type PropertyAddress = z.infer<typeof PropertyAddress>;
/** One row in the operator's property list. */
export declare const OperatorPropertySummary: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    address: z.ZodObject<{
        provinceId: z.ZodNullable<z.ZodNumber>;
        provinceName: z.ZodNullable<z.ZodString>;
        districtId: z.ZodNullable<z.ZodNumber>;
        districtName: z.ZodNullable<z.ZodString>;
        sectorId: z.ZodNullable<z.ZodNumber>;
        sectorName: z.ZodNullable<z.ZodString>;
        street: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        districtId: number | null;
        districtName: string | null;
        sectorId: number | null;
        provinceId: number | null;
        street: string | null;
        sectorName: string | null;
        provinceName: string | null;
    }, {
        districtId: number | null;
        districtName: string | null;
        sectorId: number | null;
        provinceId: number | null;
        street: string | null;
        sectorName: string | null;
        provinceName: string | null;
    }>;
    listingStatus: z.ZodEnum<["draft", "published"]>;
    publishedAt: z.ZodNullable<z.ZodString>;
    roomTypeCount: z.ZodNumber;
    /** Sellable rooms across every active room type. The inventory truth. */
    sellableRoomCount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    roomTypeCount: number;
    address: {
        districtId: number | null;
        districtName: string | null;
        sectorId: number | null;
        provinceId: number | null;
        street: string | null;
        sectorName: string | null;
        provinceName: string | null;
    };
    listingStatus: "draft" | "published";
    publishedAt: string | null;
    sellableRoomCount: number;
}, {
    id: string;
    name: string;
    roomTypeCount: number;
    address: {
        districtId: number | null;
        districtName: string | null;
        sectorId: number | null;
        provinceId: number | null;
        street: string | null;
        sectorName: string | null;
        provinceName: string | null;
    };
    listingStatus: "draft" | "published";
    publishedAt: string | null;
    sellableRoomCount: number;
}>;
export type OperatorPropertySummary = z.infer<typeof OperatorPropertySummary>;
/**
 * One property in full, as its owner sees it.
 *
 * `photos` is always empty today and says so: object storage is unbuilt
 * (F-S09), so the field exists to be honest about the gap rather than to be
 * filled (ADR-009 AC-13).
 */
export declare const OperatorProperty: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    address: z.ZodObject<{
        provinceId: z.ZodNullable<z.ZodNumber>;
        provinceName: z.ZodNullable<z.ZodString>;
        districtId: z.ZodNullable<z.ZodNumber>;
        districtName: z.ZodNullable<z.ZodString>;
        sectorId: z.ZodNullable<z.ZodNumber>;
        sectorName: z.ZodNullable<z.ZodString>;
        street: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        districtId: number | null;
        districtName: string | null;
        sectorId: number | null;
        provinceId: number | null;
        street: string | null;
        sectorName: string | null;
        provinceName: string | null;
    }, {
        districtId: number | null;
        districtName: string | null;
        sectorId: number | null;
        provinceId: number | null;
        street: string | null;
        sectorName: string | null;
        provinceName: string | null;
    }>;
    listingStatus: z.ZodEnum<["draft", "published"]>;
    publishedAt: z.ZodNullable<z.ZodString>;
    roomTypeCount: z.ZodNumber;
    /** Sellable rooms across every active room type. The inventory truth. */
    sellableRoomCount: z.ZodNumber;
} & {
    description: z.ZodNullable<z.ZodString>;
    checkInTime: z.ZodNullable<z.ZodString>;
    checkOutTime: z.ZodNullable<z.ZodString>;
    houseRules: z.ZodNullable<z.ZodString>;
    locationPrivacy: z.ZodBoolean;
    timezone: z.ZodString;
    photos: z.ZodArray<z.ZodString, "many">;
    /**
     * Empty until feature 2 builds the room type write path. An empty array is a
     * real answer here: a property with no room types is exactly what a newly
     * created one is, and it is why publishing refuses.
     */
    roomTypes: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        domain: z.ZodEnum<["hospitality", "residence"]>;
        status: z.ZodEnum<["active", "archived"]>;
        basePriceRwf: z.ZodNullable<z.ZodNumber>;
        sellableRoomCount: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "archived";
        id: string;
        domain: "hospitality" | "residence";
        name: string;
        sellableRoomCount: number;
        basePriceRwf: number | null;
    }, {
        status: "active" | "archived";
        id: string;
        domain: "hospitality" | "residence";
        name: string;
        sellableRoomCount: number;
        basePriceRwf: number | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    roomTypeCount: number;
    checkInTime: string | null;
    checkOutTime: string | null;
    address: {
        districtId: number | null;
        districtName: string | null;
        sectorId: number | null;
        provinceId: number | null;
        street: string | null;
        sectorName: string | null;
        provinceName: string | null;
    };
    description: string | null;
    houseRules: string | null;
    locationPrivacy: boolean;
    listingStatus: "draft" | "published";
    publishedAt: string | null;
    sellableRoomCount: number;
    timezone: string;
    photos: string[];
    roomTypes: {
        status: "active" | "archived";
        id: string;
        domain: "hospitality" | "residence";
        name: string;
        sellableRoomCount: number;
        basePriceRwf: number | null;
    }[];
}, {
    id: string;
    name: string;
    roomTypeCount: number;
    checkInTime: string | null;
    checkOutTime: string | null;
    address: {
        districtId: number | null;
        districtName: string | null;
        sectorId: number | null;
        provinceId: number | null;
        street: string | null;
        sectorName: string | null;
        provinceName: string | null;
    };
    description: string | null;
    houseRules: string | null;
    locationPrivacy: boolean;
    listingStatus: "draft" | "published";
    publishedAt: string | null;
    sellableRoomCount: number;
    timezone: string;
    photos: string[];
    roomTypes: {
        status: "active" | "archived";
        id: string;
        domain: "hospitality" | "residence";
        name: string;
        sellableRoomCount: number;
        basePriceRwf: number | null;
    }[];
}>;
export type OperatorProperty = z.infer<typeof OperatorProperty>;
/**
 * A rate plan, as its owner sees it (ADR-035, wave 2 follow-up).
 *
 * **`rate_plans` is one of the richest tables in the schema and nothing read
 * it.** No contract, no repository, no route — so the Rate plans lens was a
 * placeholder and the Room types screen had to say out loud that it would not
 * guess at them.
 *
 * THE DISTINCTION THIS SHAPE CARRIES is the one the screen exists to teach: a
 * room type is WHAT THE GUEST GETS, a rate plan is THE TERMS IT SELLS ON. The
 * same rooms sell several ways at once — flexible, non refundable, bed and
 * breakfast — which is why a plan names its room type rather than the other
 * way round.
 *
 * `parentRatePlanId` and the derivation are on the wire because a DERIVED plan
 * is the whole point of the feature (F-L03): non refundable is flexible minus
 * ten percent, and it MOVES when the parent moves. A screen showing only the
 * computed price would hide the relationship that keeps them in step.
 *
 * `baseOccupancy` is COMMERCIAL and deliberately not the room type's physical
 * `maxGuests`: it is how many people the base price covers, and the gap between
 * the two is what extra person pricing bridges (F-L05).
 */
export declare const OperatorRatePlan: z.ZodObject<{
    id: z.ZodString;
    roomTypeId: z.ZodString;
    roomTypeName: z.ZodNullable<z.ZodString>;
    name: z.ZodString;
    status: z.ZodEnum<["active", "archived"]>;
    /** Exactly one per room type, which the database enforces. */
    isDefault: z.ZodBoolean;
    basePriceRwf: z.ZodNullable<z.ZodNumber>;
    cautionRwf: z.ZodNullable<z.ZodNumber>;
    baseOccupancy: z.ZodNullable<z.ZodNumber>;
    singleOccupancyPriceRwf: z.ZodNullable<z.ZodNumber>;
    cancellationTier: z.ZodNullable<z.ZodEnum<["flexible", "moderate", "limited", "firm", "strict_extended_stay"]>>;
    nonRefundable: z.ZodBoolean;
    bookingMode: z.ZodNullable<z.ZodEnum<["instant_book", "request_to_book"]>>;
    minStay: z.ZodNullable<z.ZodNumber>;
    maxStay: z.ZodNullable<z.ZodNumber>;
    /** Set when this plan FOLLOWS another one (F-L03). */
    parentRatePlanId: z.ZodNullable<z.ZodString>;
    parentRatePlanName: z.ZodNullable<z.ZodString>;
    derivationKind: z.ZodNullable<z.ZodEnum<["percentage", "fixed_amount"]>>;
    derivationValue: z.ZodNullable<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    status: "active" | "archived";
    id: string;
    name: string;
    bookingMode: "instant_book" | "request_to_book" | null;
    cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
    minStay: number | null;
    roomTypeId: string;
    nonRefundable: boolean;
    roomTypeName: string | null;
    cautionRwf: number | null;
    basePriceRwf: number | null;
    isDefault: boolean;
    baseOccupancy: number | null;
    singleOccupancyPriceRwf: number | null;
    maxStay: number | null;
    parentRatePlanId: string | null;
    parentRatePlanName: string | null;
    derivationKind: "percentage" | "fixed_amount" | null;
    derivationValue: number | null;
}, {
    status: "active" | "archived";
    id: string;
    name: string;
    bookingMode: "instant_book" | "request_to_book" | null;
    cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
    minStay: number | null;
    roomTypeId: string;
    nonRefundable: boolean;
    roomTypeName: string | null;
    cautionRwf: number | null;
    basePriceRwf: number | null;
    isDefault: boolean;
    baseOccupancy: number | null;
    singleOccupancyPriceRwf: number | null;
    maxStay: number | null;
    parentRatePlanId: string | null;
    parentRatePlanName: string | null;
    derivationKind: "percentage" | "fixed_amount" | null;
    derivationValue: number | null;
}>;
export type OperatorRatePlan = z.infer<typeof OperatorRatePlan>;
export declare const OperatorRatePlanList: z.ZodObject<{
    ratePlans: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        roomTypeId: z.ZodString;
        roomTypeName: z.ZodNullable<z.ZodString>;
        name: z.ZodString;
        status: z.ZodEnum<["active", "archived"]>;
        /** Exactly one per room type, which the database enforces. */
        isDefault: z.ZodBoolean;
        basePriceRwf: z.ZodNullable<z.ZodNumber>;
        cautionRwf: z.ZodNullable<z.ZodNumber>;
        baseOccupancy: z.ZodNullable<z.ZodNumber>;
        singleOccupancyPriceRwf: z.ZodNullable<z.ZodNumber>;
        cancellationTier: z.ZodNullable<z.ZodEnum<["flexible", "moderate", "limited", "firm", "strict_extended_stay"]>>;
        nonRefundable: z.ZodBoolean;
        bookingMode: z.ZodNullable<z.ZodEnum<["instant_book", "request_to_book"]>>;
        minStay: z.ZodNullable<z.ZodNumber>;
        maxStay: z.ZodNullable<z.ZodNumber>;
        /** Set when this plan FOLLOWS another one (F-L03). */
        parentRatePlanId: z.ZodNullable<z.ZodString>;
        parentRatePlanName: z.ZodNullable<z.ZodString>;
        derivationKind: z.ZodNullable<z.ZodEnum<["percentage", "fixed_amount"]>>;
        derivationValue: z.ZodNullable<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "archived";
        id: string;
        name: string;
        bookingMode: "instant_book" | "request_to_book" | null;
        cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
        minStay: number | null;
        roomTypeId: string;
        nonRefundable: boolean;
        roomTypeName: string | null;
        cautionRwf: number | null;
        basePriceRwf: number | null;
        isDefault: boolean;
        baseOccupancy: number | null;
        singleOccupancyPriceRwf: number | null;
        maxStay: number | null;
        parentRatePlanId: string | null;
        parentRatePlanName: string | null;
        derivationKind: "percentage" | "fixed_amount" | null;
        derivationValue: number | null;
    }, {
        status: "active" | "archived";
        id: string;
        name: string;
        bookingMode: "instant_book" | "request_to_book" | null;
        cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
        minStay: number | null;
        roomTypeId: string;
        nonRefundable: boolean;
        roomTypeName: string | null;
        cautionRwf: number | null;
        basePriceRwf: number | null;
        isDefault: boolean;
        baseOccupancy: number | null;
        singleOccupancyPriceRwf: number | null;
        maxStay: number | null;
        parentRatePlanId: string | null;
        parentRatePlanName: string | null;
        derivationKind: "percentage" | "fixed_amount" | null;
        derivationValue: number | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    ratePlans: {
        status: "active" | "archived";
        id: string;
        name: string;
        bookingMode: "instant_book" | "request_to_book" | null;
        cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
        minStay: number | null;
        roomTypeId: string;
        nonRefundable: boolean;
        roomTypeName: string | null;
        cautionRwf: number | null;
        basePriceRwf: number | null;
        isDefault: boolean;
        baseOccupancy: number | null;
        singleOccupancyPriceRwf: number | null;
        maxStay: number | null;
        parentRatePlanId: string | null;
        parentRatePlanName: string | null;
        derivationKind: "percentage" | "fixed_amount" | null;
        derivationValue: number | null;
    }[];
}, {
    ratePlans: {
        status: "active" | "archived";
        id: string;
        name: string;
        bookingMode: "instant_book" | "request_to_book" | null;
        cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
        minStay: number | null;
        roomTypeId: string;
        nonRefundable: boolean;
        roomTypeName: string | null;
        cautionRwf: number | null;
        basePriceRwf: number | null;
        isDefault: boolean;
        baseOccupancy: number | null;
        singleOccupancyPriceRwf: number | null;
        maxStay: number | null;
        parentRatePlanId: string | null;
        parentRatePlanName: string | null;
        derivationKind: "percentage" | "fixed_amount" | null;
        derivationValue: number | null;
    }[];
}>;
export type OperatorRatePlanList = z.infer<typeof OperatorRatePlanList>;
export declare const OperatorPropertyList: z.ZodObject<{
    properties: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        address: z.ZodObject<{
            provinceId: z.ZodNullable<z.ZodNumber>;
            provinceName: z.ZodNullable<z.ZodString>;
            districtId: z.ZodNullable<z.ZodNumber>;
            districtName: z.ZodNullable<z.ZodString>;
            sectorId: z.ZodNullable<z.ZodNumber>;
            sectorName: z.ZodNullable<z.ZodString>;
            street: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            districtId: number | null;
            districtName: string | null;
            sectorId: number | null;
            provinceId: number | null;
            street: string | null;
            sectorName: string | null;
            provinceName: string | null;
        }, {
            districtId: number | null;
            districtName: string | null;
            sectorId: number | null;
            provinceId: number | null;
            street: string | null;
            sectorName: string | null;
            provinceName: string | null;
        }>;
        listingStatus: z.ZodEnum<["draft", "published"]>;
        publishedAt: z.ZodNullable<z.ZodString>;
        roomTypeCount: z.ZodNumber;
        /** Sellable rooms across every active room type. The inventory truth. */
        sellableRoomCount: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
        roomTypeCount: number;
        address: {
            districtId: number | null;
            districtName: string | null;
            sectorId: number | null;
            provinceId: number | null;
            street: string | null;
            sectorName: string | null;
            provinceName: string | null;
        };
        listingStatus: "draft" | "published";
        publishedAt: string | null;
        sellableRoomCount: number;
    }, {
        id: string;
        name: string;
        roomTypeCount: number;
        address: {
            districtId: number | null;
            districtName: string | null;
            sectorId: number | null;
            provinceId: number | null;
            street: string | null;
            sectorName: string | null;
            provinceName: string | null;
        };
        listingStatus: "draft" | "published";
        publishedAt: string | null;
        sellableRoomCount: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    properties: {
        id: string;
        name: string;
        roomTypeCount: number;
        address: {
            districtId: number | null;
            districtName: string | null;
            sectorId: number | null;
            provinceId: number | null;
            street: string | null;
            sectorName: string | null;
            provinceName: string | null;
        };
        listingStatus: "draft" | "published";
        publishedAt: string | null;
        sellableRoomCount: number;
    }[];
}, {
    properties: {
        id: string;
        name: string;
        roomTypeCount: number;
        address: {
            districtId: number | null;
            districtName: string | null;
            sectorId: number | null;
            provinceId: number | null;
            street: string | null;
            sectorName: string | null;
            provinceName: string | null;
        };
        listingStatus: "draft" | "published";
        publishedAt: string | null;
        sellableRoomCount: number;
    }[];
}>;
export type OperatorPropertyList = z.infer<typeof OperatorPropertyList>;
/**
 * A code, not a sentence, for the reason a rejection reason is a code: the
 * operator screen has to send someone back to the part that is wrong, and it
 * cannot read prose to work out which part that is (ADR-009 AC-7).
 *
 * Defined now, with the property level reasons already usable, so feature 3 adds
 * cases to an enum that exists rather than inventing one late.
 */
export declare const PublishBlocker: z.ZodEnum<["org_not_active", "missing_name", "missing_sector", "no_active_room_type", "no_priced_room_type", "no_sellable_room"]>;
export type PublishBlocker = z.infer<typeof PublishBlocker>;
export declare const PUBLISH_BLOCKER_LABEL: Readonly<Record<PublishBlocker, string>>;
/** Which screen a blocker sends the operator back to. */
export declare function stepForPublishBlocker(blocker: PublishBlocker): "registration" | "property" | "room_types";
//# sourceMappingURL=inventory.d.ts.map