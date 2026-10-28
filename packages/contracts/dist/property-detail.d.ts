import { z } from "zod";
/**
 * Its own file because `facilities` reaches `outlets.ts`, which reaches
 * `ordering.ts`, which imports `booking.ts`: declared there it would be a load
 * order cycle that leaves a schema undefined at require time.
 */
export declare const PropertyDetail: z.ZodObject<{
    id: z.ZodString;
    /**
     * The property's public address on the marketplace, or null.
     *
     * Null while a property is in the registration pipeline: it has no public
     * page yet, and minting an address for one would publish a business nobody
     * has approved. A consumer that needs to link to the property must handle
     * the null rather than assume one exists.
     */
    slug: z.ZodNullable<z.ZodString>;
    name: z.ZodString;
    description: z.ZodNullable<z.ZodString>;
    districtName: z.ZodNullable<z.ZodString>;
    latitude: z.ZodNullable<z.ZodNumber>;
    longitude: z.ZodNullable<z.ZodNumber>;
    locationPrivacy: z.ZodBoolean;
    checkInTime: z.ZodNullable<z.ZodString>;
    checkOutTime: z.ZodNullable<z.ZodString>;
    houseRules: z.ZodNullable<z.ZodString>;
    /**
     * One absolute URL per photograph, in the operator's order, the cover first.
     *
     * Each is the API's photo route (`/api/v1/properties/photos/:photoId`), which
     * answers 302 to a fresh signed URL while the property is public and 404 once
     * it is not (ADR-053, owner ruling of 2026-09-13). Never an object key, and
     * never a signed URL itself, so a cached page cannot hold one that expires.
     */
    photos: z.ZodArray<z.ZodString, "many">;
    roomTypes: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        domain: z.ZodEnum<["hospitality", "residence"]>;
        capacity: z.ZodNullable<z.ZodNumber>;
        roomCount: z.ZodNumber;
        nightlyRateRwf: z.ZodNullable<z.ZodNumber>;
        bookingMode: z.ZodNullable<z.ZodEnum<["instant_book", "request_to_book"]>>;
        approvalPolicy: z.ZodNullable<z.ZodEnum<["approve_all", "approve_first_three"]>>;
        cancellationTier: z.ZodNullable<z.ZodEnum<["flexible", "moderate", "limited", "firm", "strict_extended_stay"]>>;
        nonrefundableEligible: z.ZodBoolean;
        minStay: z.ZodNullable<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
        domain: "hospitality" | "residence";
        capacity: number | null;
        roomCount: number;
        nightlyRateRwf: number | null;
        bookingMode: "instant_book" | "request_to_book" | null;
        approvalPolicy: "approve_all" | "approve_first_three" | null;
        cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
        nonrefundableEligible: boolean;
        minStay: number | null;
    }, {
        name: string;
        id: string;
        domain: "hospitality" | "residence";
        capacity: number | null;
        roomCount: number;
        nightlyRateRwf: number | null;
        bookingMode: "instant_book" | "request_to_book" | null;
        approvalPolicy: "approve_all" | "approve_first_three" | null;
        cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
        nonrefundableEligible: boolean;
        minStay: number | null;
    }>, "many">;
    /**
     * What the property offers, amenities and outlets as ONE deduped list
     * (ADR-050 D-k, AC-16): an amenity with an outlet pointing at it is one
     * entry carrying both faces. Only guest visible, active outlets, and a
     * tenant outlet only while its tenancy is active (AC-18).
     */
    facilities: z.ZodArray<z.ZodEffects<z.ZodObject<{
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
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: string;
    slug: string | null;
    districtName: string | null;
    checkInTime: string | null;
    checkOutTime: string | null;
    roomTypes: {
        name: string;
        id: string;
        domain: "hospitality" | "residence";
        capacity: number | null;
        roomCount: number;
        nightlyRateRwf: number | null;
        bookingMode: "instant_book" | "request_to_book" | null;
        approvalPolicy: "approve_all" | "approve_first_three" | null;
        cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
        nonrefundableEligible: boolean;
        minStay: number | null;
    }[];
    description: string | null;
    photos: string[];
    latitude: number | null;
    longitude: number | null;
    houseRules: string | null;
    locationPrivacy: boolean;
    facilities: {
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
    }[];
}, {
    name: string;
    id: string;
    slug: string | null;
    districtName: string | null;
    checkInTime: string | null;
    checkOutTime: string | null;
    roomTypes: {
        name: string;
        id: string;
        domain: "hospitality" | "residence";
        capacity: number | null;
        roomCount: number;
        nightlyRateRwf: number | null;
        bookingMode: "instant_book" | "request_to_book" | null;
        approvalPolicy: "approve_all" | "approve_first_three" | null;
        cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
        nonrefundableEligible: boolean;
        minStay: number | null;
    }[];
    description: string | null;
    photos: string[];
    latitude: number | null;
    longitude: number | null;
    houseRules: string | null;
    locationPrivacy: boolean;
    facilities: {
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
    }[];
}>;
export type PropertyDetail = z.infer<typeof PropertyDetail>;
/**
 * One published property as a discovery list reads it (booking audit,
 * 2026-09-13): `GET /api/v1/properties`.
 *
 * Explore used to be built only from a catalogue kept in the web app, so a
 * property created in the operator app and published could be booked by a
 * guest holding its link and found by nobody. This is what a result card needs,
 * and nothing a card does not show. Only a property with a public address
 * (`slug`) is listed, because a card that links nowhere is not a result.
 */
export declare const PropertyCard: z.ZodObject<{
    id: z.ZodString;
    slug: z.ZodString;
    name: z.ZodString;
    description: z.ZodNullable<z.ZodString>;
    districtName: z.ZodNullable<z.ZodString>;
    /**
     * Up to five, in the order the property set them, the cover first. The same
     * photo route URLs `PropertyDetail.photos` carries, never an object key.
     */
    photos: z.ZodArray<z.ZodString, "many">;
    /** The cheapest priced, sellable room type; null when none is priced. */
    fromNightlyRateRwf: z.ZodNullable<z.ZodNumber>;
    /** The most guests any active room type sleeps; null when none states it. */
    maxGuests: z.ZodNullable<z.ZodNumber>;
    roomTypeCount: z.ZodNumber;
    /**
     * The property's public coordinates, for the Explore map. Null when the
     * property has never set them; a card without a point simply has no pin.
     * The exact lat/lng is the same signal the public address already carries.
     */
    latitude: z.ZodNullable<z.ZodNumber>;
    longitude: z.ZodNullable<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: string;
    slug: string;
    districtName: string | null;
    roomTypeCount: number;
    fromNightlyRateRwf: number | null;
    maxGuests: number | null;
    description: string | null;
    photos: string[];
    latitude: number | null;
    longitude: number | null;
}, {
    name: string;
    id: string;
    slug: string;
    districtName: string | null;
    roomTypeCount: number;
    fromNightlyRateRwf: number | null;
    maxGuests: number | null;
    description: string | null;
    photos: string[];
    latitude: number | null;
    longitude: number | null;
}>;
export type PropertyCard = z.infer<typeof PropertyCard>;
//# sourceMappingURL=property-detail.d.ts.map