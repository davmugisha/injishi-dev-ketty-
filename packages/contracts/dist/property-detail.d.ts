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
    /** 0117: the check-in window's end, the front desk, languages and the house rules as choices. */
    policies: z.ZodOptional<z.ZodObject<{
        checkInUntil: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        frontDesk: z.ZodDefault<z.ZodNullable<z.ZodEnum<["24h", "limited", "none"]>>>;
        frontDeskOpens: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        frontDeskCloses: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        languages: z.ZodDefault<z.ZodArray<z.ZodEnum<["rw", "en", "fr", "sw"]>, "many">>;
        whatsapp: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        directions: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        minCheckInAge: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
        childrenPolicy: z.ZodDefault<z.ZodNullable<z.ZodEnum<["welcome", "adults_only"]>>>;
        petsPolicy: z.ZodDefault<z.ZodNullable<z.ZodEnum<["no", "on_request", "yes"]>>>;
        smokingPolicy: z.ZodDefault<z.ZodNullable<z.ZodEnum<["no", "designated", "allowed"]>>>;
        partiesPolicy: z.ZodDefault<z.ZodNullable<z.ZodEnum<["no", "on_request"]>>>;
        quietFrom: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        quietUntil: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        internet: z.ZodDefault<z.ZodNullable<z.ZodEnum<["free_everywhere", "rooms_only", "public_only", "paid", "none"]>>>;
        parking: z.ZodDefault<z.ZodNullable<z.ZodEnum<["free_on_site", "paid_on_site", "street", "none"]>>>;
        cribs: z.ZodDefault<z.ZodNullable<z.ZodEnum<["free", "charged", "none"]>>>;
        cribPriceRwf: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
    }, "strip", z.ZodTypeAny, {
        checkInUntil: string | null;
        frontDesk: "limited" | "none" | "24h" | null;
        frontDeskOpens: string | null;
        frontDeskCloses: string | null;
        languages: ("en" | "rw" | "fr" | "sw")[];
        whatsapp: string | null;
        directions: string | null;
        minCheckInAge: number | null;
        childrenPolicy: "welcome" | "adults_only" | null;
        petsPolicy: "no" | "on_request" | "yes" | null;
        smokingPolicy: "no" | "designated" | "allowed" | null;
        partiesPolicy: "no" | "on_request" | null;
        quietFrom: string | null;
        quietUntil: string | null;
        internet: "none" | "paid" | "free_everywhere" | "rooms_only" | "public_only" | null;
        parking: "street" | "none" | "free_on_site" | "paid_on_site" | null;
        cribs: "none" | "free" | "charged" | null;
        cribPriceRwf: number | null;
    }, {
        checkInUntil?: string | null | undefined;
        frontDesk?: "limited" | "none" | "24h" | null | undefined;
        frontDeskOpens?: string | null | undefined;
        frontDeskCloses?: string | null | undefined;
        languages?: ("en" | "rw" | "fr" | "sw")[] | undefined;
        whatsapp?: string | null | undefined;
        directions?: string | null | undefined;
        minCheckInAge?: number | null | undefined;
        childrenPolicy?: "welcome" | "adults_only" | null | undefined;
        petsPolicy?: "no" | "on_request" | "yes" | null | undefined;
        smokingPolicy?: "no" | "designated" | "allowed" | null | undefined;
        partiesPolicy?: "no" | "on_request" | null | undefined;
        quietFrom?: string | null | undefined;
        quietUntil?: string | null | undefined;
        internet?: "none" | "paid" | "free_everywhere" | "rooms_only" | "public_only" | null | undefined;
        parking?: "street" | "none" | "free_on_site" | "paid_on_site" | null | undefined;
        cribs?: "none" | "free" | "charged" | null | undefined;
        cribPriceRwf?: number | null | undefined;
    }>>;
    /** 0118: RDB's star grade, only once an officer has confirmed it; null otherwise. */
    starGrade: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
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
        domain: z.ZodEnum<["hospitality", "residence", "enterprise"]>;
        capacity: z.ZodNullable<z.ZodNumber>;
        roomCount: z.ZodNumber;
        nightlyRateRwf: z.ZodNullable<z.ZodNumber>;
        bookingMode: z.ZodNullable<z.ZodEnum<["instant_book", "request_to_book"]>>;
        approvalPolicy: z.ZodNullable<z.ZodEnum<["approve_all", "approve_first_three"]>>;
        cancellationTier: z.ZodNullable<z.ZodEnum<["flexible", "moderate", "limited", "firm", "strict_extended_stay"]>>;
        nonrefundableEligible: z.ZodBoolean;
        priceBasis: z.ZodDefault<z.ZodEnum<["per_person", "per_unit", "per_item"]>>;
        minStay: z.ZodNullable<z.ZodNumber>;
        singleGuestPriceRwf: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        roomCategory: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        beds: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
            type: z.ZodString;
            count: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            type: string;
            count: number;
        }, {
            type: string;
            count: number;
        }>, "many">>>;
        maxAdults: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        maxChildren: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        sizeM2: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        bathroom: z.ZodOptional<z.ZodNullable<z.ZodEnum<["private", "shared"]>>>;
        extraBedsMax: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        extraBedPriceRwf: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        photo: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
        domain: "hospitality" | "residence" | "enterprise";
        capacity: number | null;
        roomCount: number;
        nightlyRateRwf: number | null;
        bookingMode: "instant_book" | "request_to_book" | null;
        approvalPolicy: "approve_all" | "approve_first_three" | null;
        cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
        nonrefundableEligible: boolean;
        priceBasis: "per_person" | "per_unit" | "per_item";
        minStay: number | null;
        singleGuestPriceRwf?: number | null | undefined;
        roomCategory?: string | null | undefined;
        beds?: {
            type: string;
            count: number;
        }[] | null | undefined;
        maxAdults?: number | null | undefined;
        maxChildren?: number | null | undefined;
        sizeM2?: number | null | undefined;
        bathroom?: "private" | "shared" | null | undefined;
        extraBedsMax?: number | null | undefined;
        extraBedPriceRwf?: number | null | undefined;
        photo?: string | null | undefined;
    }, {
        name: string;
        id: string;
        domain: "hospitality" | "residence" | "enterprise";
        capacity: number | null;
        roomCount: number;
        nightlyRateRwf: number | null;
        bookingMode: "instant_book" | "request_to_book" | null;
        approvalPolicy: "approve_all" | "approve_first_three" | null;
        cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
        nonrefundableEligible: boolean;
        minStay: number | null;
        priceBasis?: "per_person" | "per_unit" | "per_item" | undefined;
        singleGuestPriceRwf?: number | null | undefined;
        roomCategory?: string | null | undefined;
        beds?: {
            type: string;
            count: number;
        }[] | null | undefined;
        maxAdults?: number | null | undefined;
        maxChildren?: number | null | undefined;
        sizeM2?: number | null | undefined;
        bathroom?: "private" | "shared" | null | undefined;
        extraBedsMax?: number | null | undefined;
        extraBedPriceRwf?: number | null | undefined;
        photo?: string | null | undefined;
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
            outletKind: "other" | "parking" | "bar" | "restaurant" | "lounge" | "banquet" | "room_service" | "spa" | "gym" | "pool" | "gift_shop" | "laundry" | "business_center";
            orderingAccess: "both" | "in_house_only" | "walk_in_only";
            hours: Record<string, unknown> | null;
            operatorLabel: string | null;
        }, {
            name: string;
            id: string;
            outletKind: "other" | "parking" | "bar" | "restaurant" | "lounge" | "banquet" | "room_service" | "spa" | "gym" | "pool" | "gift_shop" | "laundry" | "business_center";
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
            outletKind: "other" | "parking" | "bar" | "restaurant" | "lounge" | "banquet" | "room_service" | "spa" | "gym" | "pool" | "gift_shop" | "laundry" | "business_center";
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
            outletKind: "other" | "parking" | "bar" | "restaurant" | "lounge" | "banquet" | "room_service" | "spa" | "gym" | "pool" | "gift_shop" | "laundry" | "business_center";
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
            outletKind: "other" | "parking" | "bar" | "restaurant" | "lounge" | "banquet" | "room_service" | "spa" | "gym" | "pool" | "gift_shop" | "laundry" | "business_center";
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
            outletKind: "other" | "parking" | "bar" | "restaurant" | "lounge" | "banquet" | "room_service" | "spa" | "gym" | "pool" | "gift_shop" | "laundry" | "business_center";
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
    description: string | null;
    roomTypes: {
        name: string;
        id: string;
        domain: "hospitality" | "residence" | "enterprise";
        capacity: number | null;
        roomCount: number;
        nightlyRateRwf: number | null;
        bookingMode: "instant_book" | "request_to_book" | null;
        approvalPolicy: "approve_all" | "approve_first_three" | null;
        cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
        nonrefundableEligible: boolean;
        priceBasis: "per_person" | "per_unit" | "per_item";
        minStay: number | null;
        singleGuestPriceRwf?: number | null | undefined;
        roomCategory?: string | null | undefined;
        beds?: {
            type: string;
            count: number;
        }[] | null | undefined;
        maxAdults?: number | null | undefined;
        maxChildren?: number | null | undefined;
        sizeM2?: number | null | undefined;
        bathroom?: "private" | "shared" | null | undefined;
        extraBedsMax?: number | null | undefined;
        extraBedPriceRwf?: number | null | undefined;
        photo?: string | null | undefined;
    }[];
    photos: string[];
    latitude: number | null;
    longitude: number | null;
    locationPrivacy: boolean;
    houseRules: string | null;
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
            outletKind: "other" | "parking" | "bar" | "restaurant" | "lounge" | "banquet" | "room_service" | "spa" | "gym" | "pool" | "gift_shop" | "laundry" | "business_center";
            orderingAccess: "both" | "in_house_only" | "walk_in_only";
            hours: Record<string, unknown> | null;
            operatorLabel: string | null;
        } | null;
    }[];
    policies?: {
        checkInUntil: string | null;
        frontDesk: "limited" | "none" | "24h" | null;
        frontDeskOpens: string | null;
        frontDeskCloses: string | null;
        languages: ("en" | "rw" | "fr" | "sw")[];
        whatsapp: string | null;
        directions: string | null;
        minCheckInAge: number | null;
        childrenPolicy: "welcome" | "adults_only" | null;
        petsPolicy: "no" | "on_request" | "yes" | null;
        smokingPolicy: "no" | "designated" | "allowed" | null;
        partiesPolicy: "no" | "on_request" | null;
        quietFrom: string | null;
        quietUntil: string | null;
        internet: "none" | "paid" | "free_everywhere" | "rooms_only" | "public_only" | null;
        parking: "street" | "none" | "free_on_site" | "paid_on_site" | null;
        cribs: "none" | "free" | "charged" | null;
        cribPriceRwf: number | null;
    } | undefined;
    starGrade?: number | null | undefined;
}, {
    name: string;
    id: string;
    slug: string | null;
    districtName: string | null;
    checkInTime: string | null;
    checkOutTime: string | null;
    description: string | null;
    roomTypes: {
        name: string;
        id: string;
        domain: "hospitality" | "residence" | "enterprise";
        capacity: number | null;
        roomCount: number;
        nightlyRateRwf: number | null;
        bookingMode: "instant_book" | "request_to_book" | null;
        approvalPolicy: "approve_all" | "approve_first_three" | null;
        cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
        nonrefundableEligible: boolean;
        minStay: number | null;
        priceBasis?: "per_person" | "per_unit" | "per_item" | undefined;
        singleGuestPriceRwf?: number | null | undefined;
        roomCategory?: string | null | undefined;
        beds?: {
            type: string;
            count: number;
        }[] | null | undefined;
        maxAdults?: number | null | undefined;
        maxChildren?: number | null | undefined;
        sizeM2?: number | null | undefined;
        bathroom?: "private" | "shared" | null | undefined;
        extraBedsMax?: number | null | undefined;
        extraBedPriceRwf?: number | null | undefined;
        photo?: string | null | undefined;
    }[];
    photos: string[];
    latitude: number | null;
    longitude: number | null;
    locationPrivacy: boolean;
    houseRules: string | null;
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
            outletKind: "other" | "parking" | "bar" | "restaurant" | "lounge" | "banquet" | "room_service" | "spa" | "gym" | "pool" | "gift_shop" | "laundry" | "business_center";
            orderingAccess: "both" | "in_house_only" | "walk_in_only";
            hours: Record<string, unknown> | null;
            operatorLabel: string | null;
        } | null;
    }[];
    policies?: {
        checkInUntil?: string | null | undefined;
        frontDesk?: "limited" | "none" | "24h" | null | undefined;
        frontDeskOpens?: string | null | undefined;
        frontDeskCloses?: string | null | undefined;
        languages?: ("en" | "rw" | "fr" | "sw")[] | undefined;
        whatsapp?: string | null | undefined;
        directions?: string | null | undefined;
        minCheckInAge?: number | null | undefined;
        childrenPolicy?: "welcome" | "adults_only" | null | undefined;
        petsPolicy?: "no" | "on_request" | "yes" | null | undefined;
        smokingPolicy?: "no" | "designated" | "allowed" | null | undefined;
        partiesPolicy?: "no" | "on_request" | null | undefined;
        quietFrom?: string | null | undefined;
        quietUntil?: string | null | undefined;
        internet?: "none" | "paid" | "free_everywhere" | "rooms_only" | "public_only" | null | undefined;
        parking?: "street" | "none" | "free_on_site" | "paid_on_site" | null | undefined;
        cribs?: "none" | "free" | "charged" | null | undefined;
        cribPriceRwf?: number | null | undefined;
    } | undefined;
    starGrade?: number | null | undefined;
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
    /**
     * How that price is counted: `per_unit` when every room type is let whole (a
     * villa, an apartment), `per_item` when the place sells a menu and is not
     * booked (a bar, a coffee shop), else `per_person`. Default per person, so an
     * older API's card still parses.
     */
    fromPriceBasis: z.ZodDefault<z.ZodEnum<["per_person", "per_unit", "per_item"]>>;
    /**
     * What the business registered as (`orgs.business_kind`, else its class):
     * "hotel", "villa", "coffee_shop". Default null so an older API's card
     * still parses; a card with none says "Stay", never a guess from the name.
     */
    businessKind: z.ZodDefault<z.ZodNullable<z.ZodString>>;
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
    businessKind: string | null;
    description: string | null;
    roomTypeCount: number;
    fromNightlyRateRwf: number | null;
    maxGuests: number | null;
    photos: string[];
    latitude: number | null;
    longitude: number | null;
    fromPriceBasis: "per_person" | "per_unit" | "per_item";
}, {
    name: string;
    id: string;
    slug: string;
    districtName: string | null;
    description: string | null;
    roomTypeCount: number;
    fromNightlyRateRwf: number | null;
    maxGuests: number | null;
    photos: string[];
    latitude: number | null;
    longitude: number | null;
    businessKind?: string | null | undefined;
    fromPriceBasis?: "per_person" | "per_unit" | "per_item" | undefined;
}>;
export type PropertyCard = z.infer<typeof PropertyCard>;
//# sourceMappingURL=property-detail.d.ts.map