import { z } from "zod";
/**
 * The interface marketplace and the guest's web account (real-data leaf 1.3.2).
 *
 * VISIBILITY IS NOT DECIDED HERE. Every card below is drawn over a property the canonical public read
 * already admits (a published listing of an active business, ADR-053 contract rule 1, through
 * `ListingService`); the marketplace adds what the interface draws on top of it, and a property with
 * no marketplace card is simply not drawn by this interface.
 *
 * SAVED PLACES follow ADR-032: `/me/saved` is the flat heart toggle over the person's hidden default
 * list, and `/me/collections` is F-B16's named lists beside it. Both are the caller's alone; a list
 * that is not theirs is a 404, never a 403.
 */
/** The kinds a marketplace card names. Mirrors `MARKET_PROPERTY_KINDS` in the schema. */
export declare const MarketPropertyKind: z.ZodEnum<["hotel", "lodge", "tented", "guest", "apartment", "villa", "house", "studio"]>;
export type MarketPropertyKind = z.infer<typeof MarketPropertyKind>;
/** A key into the interface's licensed stock picture library, the only pictures it renders today. */
export declare const MarketStockPhoto: z.ZodString;
export declare const MarketListingCard: z.ZodObject<{
    /** The property's id. */
    id: z.ZodString;
    slug: z.ZodString;
    name: z.ZodString;
    domain: z.ZodEnum<["hospitality", "residence"]>;
    kind: z.ZodEnum<["hotel", "lodge", "tented", "guest", "apartment", "villa", "house", "studio"]>;
    /** "Gisenyi, Rubavu": the sector and district, as the property is filed. */
    where: z.ZodString;
    districtName: z.ZodNullable<z.ZodString>;
    /** The business the guest contracts with. */
    legalName: z.ZodString;
    /** Stays: the cheapest active room's nightly rate. Homes: the cheapest unit's monthly rent. */
    priceRwf: z.ZodNullable<z.ZodNumber>;
    /** Mean of the visible guest reviews, one decimal. Null when there are none. */
    rating: z.ZodNullable<z.ZodNumber>;
    reviewCount: z.ZodNumber;
    /** How the cheapest room is booked. Null for homes, which are let, not booked. */
    bookingMode: z.ZodNullable<z.ZodEnum<["instant_book", "request_to_book"]>>;
    /** How long a host has to answer a request, from the booking domain's own window. */
    approvalWindowHours: z.ZodNullable<z.ZodNumber>;
    stockPhoto: z.ZodString;
    caption: z.ZodString;
    /** Amenity codes (the platform's `amenities` catalogue). */
    amenities: z.ZodArray<z.ZodString, "many">;
    latitude: z.ZodNullable<z.ZodNumber>;
    longitude: z.ZodNullable<z.ZodNumber>;
    bedrooms: z.ZodNullable<z.ZodNumber>;
    floorAreaSqm: z.ZodNullable<z.ZodNumber>;
    /** Homes: the first day a tenant may move in. Null means now. */
    availableFrom: z.ZodNullable<z.ZodString>;
    /** The card carries a page's own copy (highlights or a gallery), so a property page can be drawn. */
    hasPage: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    name: string;
    kind: "guest" | "hotel" | "apartment" | "lodge" | "villa" | "house" | "tented" | "studio";
    legalName: string;
    domain: "hospitality" | "residence";
    id: string;
    districtName: string | null;
    priceRwf: number | null;
    rating: number | null;
    bookingMode: "instant_book" | "request_to_book" | null;
    slug: string;
    amenities: string[];
    caption: string;
    latitude: number | null;
    longitude: number | null;
    where: string;
    reviewCount: number;
    approvalWindowHours: number | null;
    stockPhoto: string;
    bedrooms: number | null;
    floorAreaSqm: number | null;
    availableFrom: string | null;
    hasPage: boolean;
}, {
    name: string;
    kind: "guest" | "hotel" | "apartment" | "lodge" | "villa" | "house" | "tented" | "studio";
    legalName: string;
    domain: "hospitality" | "residence";
    id: string;
    districtName: string | null;
    priceRwf: number | null;
    rating: number | null;
    bookingMode: "instant_book" | "request_to_book" | null;
    slug: string;
    amenities: string[];
    caption: string;
    latitude: number | null;
    longitude: number | null;
    where: string;
    reviewCount: number;
    approvalWindowHours: number | null;
    stockPhoto: string;
    bedrooms: number | null;
    floorAreaSqm: number | null;
    availableFrom: string | null;
    hasPage: boolean;
}>;
export type MarketListingCard = z.infer<typeof MarketListingCard>;
export declare const MarketCatalogue: z.ZodObject<{
    listings: z.ZodArray<z.ZodObject<{
        /** The property's id. */
        id: z.ZodString;
        slug: z.ZodString;
        name: z.ZodString;
        domain: z.ZodEnum<["hospitality", "residence"]>;
        kind: z.ZodEnum<["hotel", "lodge", "tented", "guest", "apartment", "villa", "house", "studio"]>;
        /** "Gisenyi, Rubavu": the sector and district, as the property is filed. */
        where: z.ZodString;
        districtName: z.ZodNullable<z.ZodString>;
        /** The business the guest contracts with. */
        legalName: z.ZodString;
        /** Stays: the cheapest active room's nightly rate. Homes: the cheapest unit's monthly rent. */
        priceRwf: z.ZodNullable<z.ZodNumber>;
        /** Mean of the visible guest reviews, one decimal. Null when there are none. */
        rating: z.ZodNullable<z.ZodNumber>;
        reviewCount: z.ZodNumber;
        /** How the cheapest room is booked. Null for homes, which are let, not booked. */
        bookingMode: z.ZodNullable<z.ZodEnum<["instant_book", "request_to_book"]>>;
        /** How long a host has to answer a request, from the booking domain's own window. */
        approvalWindowHours: z.ZodNullable<z.ZodNumber>;
        stockPhoto: z.ZodString;
        caption: z.ZodString;
        /** Amenity codes (the platform's `amenities` catalogue). */
        amenities: z.ZodArray<z.ZodString, "many">;
        latitude: z.ZodNullable<z.ZodNumber>;
        longitude: z.ZodNullable<z.ZodNumber>;
        bedrooms: z.ZodNullable<z.ZodNumber>;
        floorAreaSqm: z.ZodNullable<z.ZodNumber>;
        /** Homes: the first day a tenant may move in. Null means now. */
        availableFrom: z.ZodNullable<z.ZodString>;
        /** The card carries a page's own copy (highlights or a gallery), so a property page can be drawn. */
        hasPage: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        name: string;
        kind: "guest" | "hotel" | "apartment" | "lodge" | "villa" | "house" | "tented" | "studio";
        legalName: string;
        domain: "hospitality" | "residence";
        id: string;
        districtName: string | null;
        priceRwf: number | null;
        rating: number | null;
        bookingMode: "instant_book" | "request_to_book" | null;
        slug: string;
        amenities: string[];
        caption: string;
        latitude: number | null;
        longitude: number | null;
        where: string;
        reviewCount: number;
        approvalWindowHours: number | null;
        stockPhoto: string;
        bedrooms: number | null;
        floorAreaSqm: number | null;
        availableFrom: string | null;
        hasPage: boolean;
    }, {
        name: string;
        kind: "guest" | "hotel" | "apartment" | "lodge" | "villa" | "house" | "tented" | "studio";
        legalName: string;
        domain: "hospitality" | "residence";
        id: string;
        districtName: string | null;
        priceRwf: number | null;
        rating: number | null;
        bookingMode: "instant_book" | "request_to_book" | null;
        slug: string;
        amenities: string[];
        caption: string;
        latitude: number | null;
        longitude: number | null;
        where: string;
        reviewCount: number;
        approvalWindowHours: number | null;
        stockPhoto: string;
        bedrooms: number | null;
        floorAreaSqm: number | null;
        availableFrom: string | null;
        hasPage: boolean;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    listings: {
        name: string;
        kind: "guest" | "hotel" | "apartment" | "lodge" | "villa" | "house" | "tented" | "studio";
        legalName: string;
        domain: "hospitality" | "residence";
        id: string;
        districtName: string | null;
        priceRwf: number | null;
        rating: number | null;
        bookingMode: "instant_book" | "request_to_book" | null;
        slug: string;
        amenities: string[];
        caption: string;
        latitude: number | null;
        longitude: number | null;
        where: string;
        reviewCount: number;
        approvalWindowHours: number | null;
        stockPhoto: string;
        bedrooms: number | null;
        floorAreaSqm: number | null;
        availableFrom: string | null;
        hasPage: boolean;
    }[];
}, {
    listings: {
        name: string;
        kind: "guest" | "hotel" | "apartment" | "lodge" | "villa" | "house" | "tented" | "studio";
        legalName: string;
        domain: "hospitality" | "residence";
        id: string;
        districtName: string | null;
        priceRwf: number | null;
        rating: number | null;
        bookingMode: "instant_book" | "request_to_book" | null;
        slug: string;
        amenities: string[];
        caption: string;
        latitude: number | null;
        longitude: number | null;
        where: string;
        reviewCount: number;
        approvalWindowHours: number | null;
        stockPhoto: string;
        bedrooms: number | null;
        floorAreaSqm: number | null;
        availableFrom: string | null;
        hasPage: boolean;
    }[];
}>;
export type MarketCatalogue = z.infer<typeof MarketCatalogue>;
export declare const MarketRoomCard: z.ZodObject<{
    /** The room type's id: what a booking is made against. */
    id: z.ZodString;
    propertySlug: z.ZodString;
    name: z.ZodString;
    /** Nightly rate per guest, from the default rate plan or the room type. */
    priceRwf: z.ZodNullable<z.ZodNumber>;
    bed: z.ZodString;
    sizeSqm: z.ZodNullable<z.ZodNumber>;
    highlight: z.ZodString;
    sleeps: z.ZodNullable<z.ZodNumber>;
    /** Bookable units of this room type. */
    roomCount: z.ZodNumber;
    bookingMode: z.ZodNullable<z.ZodEnum<["instant_book", "request_to_book"]>>;
    /** A request room: how long the host has to answer, from the booking domain's own window. */
    approvalWindowHours: z.ZodNullable<z.ZodNumber>;
    cancellationTier: z.ZodNullable<z.ZodEnum<["flexible", "moderate", "limited", "firm", "strict_extended_stay"]>>;
    /** Whether the non-refundable (saver) rate is offered on this room. */
    nonrefundableEligible: z.ZodBoolean;
    maxAdults: z.ZodNullable<z.ZodNumber>;
    maxChildren: z.ZodNullable<z.ZodNumber>;
    stockPhoto: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: string;
    roomCount: number;
    priceRwf: number | null;
    bookingMode: "instant_book" | "request_to_book" | null;
    cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
    nonrefundableEligible: boolean;
    propertySlug: string;
    approvalWindowHours: number | null;
    stockPhoto: string;
    bed: string;
    sizeSqm: number | null;
    highlight: string;
    sleeps: number | null;
    maxAdults: number | null;
    maxChildren: number | null;
}, {
    name: string;
    id: string;
    roomCount: number;
    priceRwf: number | null;
    bookingMode: "instant_book" | "request_to_book" | null;
    cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
    nonrefundableEligible: boolean;
    propertySlug: string;
    approvalWindowHours: number | null;
    stockPhoto: string;
    bed: string;
    sizeSqm: number | null;
    highlight: string;
    sleeps: number | null;
    maxAdults: number | null;
    maxChildren: number | null;
}>;
export type MarketRoomCard = z.infer<typeof MarketRoomCard>;
export declare const MarketRooms: z.ZodObject<{
    rooms: z.ZodArray<z.ZodObject<{
        /** The room type's id: what a booking is made against. */
        id: z.ZodString;
        propertySlug: z.ZodString;
        name: z.ZodString;
        /** Nightly rate per guest, from the default rate plan or the room type. */
        priceRwf: z.ZodNullable<z.ZodNumber>;
        bed: z.ZodString;
        sizeSqm: z.ZodNullable<z.ZodNumber>;
        highlight: z.ZodString;
        sleeps: z.ZodNullable<z.ZodNumber>;
        /** Bookable units of this room type. */
        roomCount: z.ZodNumber;
        bookingMode: z.ZodNullable<z.ZodEnum<["instant_book", "request_to_book"]>>;
        /** A request room: how long the host has to answer, from the booking domain's own window. */
        approvalWindowHours: z.ZodNullable<z.ZodNumber>;
        cancellationTier: z.ZodNullable<z.ZodEnum<["flexible", "moderate", "limited", "firm", "strict_extended_stay"]>>;
        /** Whether the non-refundable (saver) rate is offered on this room. */
        nonrefundableEligible: z.ZodBoolean;
        maxAdults: z.ZodNullable<z.ZodNumber>;
        maxChildren: z.ZodNullable<z.ZodNumber>;
        stockPhoto: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
        roomCount: number;
        priceRwf: number | null;
        bookingMode: "instant_book" | "request_to_book" | null;
        cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
        nonrefundableEligible: boolean;
        propertySlug: string;
        approvalWindowHours: number | null;
        stockPhoto: string;
        bed: string;
        sizeSqm: number | null;
        highlight: string;
        sleeps: number | null;
        maxAdults: number | null;
        maxChildren: number | null;
    }, {
        name: string;
        id: string;
        roomCount: number;
        priceRwf: number | null;
        bookingMode: "instant_book" | "request_to_book" | null;
        cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
        nonrefundableEligible: boolean;
        propertySlug: string;
        approvalWindowHours: number | null;
        stockPhoto: string;
        bed: string;
        sizeSqm: number | null;
        highlight: string;
        sleeps: number | null;
        maxAdults: number | null;
        maxChildren: number | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    rooms: {
        name: string;
        id: string;
        roomCount: number;
        priceRwf: number | null;
        bookingMode: "instant_book" | "request_to_book" | null;
        cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
        nonrefundableEligible: boolean;
        propertySlug: string;
        approvalWindowHours: number | null;
        stockPhoto: string;
        bed: string;
        sizeSqm: number | null;
        highlight: string;
        sleeps: number | null;
        maxAdults: number | null;
        maxChildren: number | null;
    }[];
}, {
    rooms: {
        name: string;
        id: string;
        roomCount: number;
        priceRwf: number | null;
        bookingMode: "instant_book" | "request_to_book" | null;
        cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
        nonrefundableEligible: boolean;
        propertySlug: string;
        approvalWindowHours: number | null;
        stockPhoto: string;
        bed: string;
        sizeSqm: number | null;
        highlight: string;
        sleeps: number | null;
        maxAdults: number | null;
        maxChildren: number | null;
    }[];
}>;
export type MarketRooms = z.infer<typeof MarketRooms>;
/** `GET /marketplace/quote`: what a stay would cost, before anyone signs in. */
export declare const MarketQuoteQuery: z.ZodObject<{
    roomTypeId: z.ZodString;
    checkIn: z.ZodString;
    checkOut: z.ZodString;
    guests: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    roomTypeId: string;
    checkIn: string;
    checkOut: string;
    guests: number;
}, {
    roomTypeId: string;
    checkIn: string;
    checkOut: string;
    guests: number;
}>;
export type MarketQuoteQuery = z.infer<typeof MarketQuoteQuery>;
/**
 * A priced stay, computed by the same `computeBreakdown` the booking service charges with, so the
 * checkout never shows a total the charge disagrees with. The refund schedule is the room's
 * cancellation tier laid over this check-in (`CANCELLATION_TIERS`).
 */
export declare const MarketQuote: z.ZodObject<{
    roomTypeId: z.ZodString;
    roomName: z.ZodString;
    propertySlug: z.ZodNullable<z.ZodString>;
    /** The business the guest pays and contracts with. */
    legalName: z.ZodString;
    checkIn: z.ZodString;
    checkOut: z.ZodString;
    guests: z.ZodNumber;
    breakdown: z.ZodObject<{
        nights: z.ZodNumber;
        guests: z.ZodOptional<z.ZodNumber>;
        nightlyRateRwf: z.ZodNumber;
        accommodationRwf: z.ZodNumber;
        nonRefundableDiscountRwf: z.ZodNumber;
        serviceFeeRwf: z.ZodNumber;
        grossRwf: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        nightlyRateRwf: number;
        nights: number;
        accommodationRwf: number;
        nonRefundableDiscountRwf: number;
        serviceFeeRwf: number;
        grossRwf: number;
        guests?: number | undefined;
    }, {
        nightlyRateRwf: number;
        nights: number;
        accommodationRwf: number;
        nonRefundableDiscountRwf: number;
        serviceFeeRwf: number;
        grossRwf: number;
        guests?: number | undefined;
    }>;
    bookingMode: z.ZodNullable<z.ZodEnum<["instant_book", "request_to_book"]>>;
    approvalWindowHours: z.ZodNullable<z.ZodNumber>;
    cancellationTier: z.ZodEnum<["flexible", "moderate", "limited", "firm", "strict_extended_stay"]>;
    /** In order: each step's refund percent and the instant it ends (null: until check-in and after). */
    refunds: z.ZodArray<z.ZodObject<{
        percent: z.ZodNumber;
        until: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        percent: number;
        until: string | null;
    }, {
        percent: number;
        until: string | null;
    }>, "many">;
    /** VAT included in the price, percent (the EBM receipt's rate). */
    vatRatePercent: z.ZodNumber;
    checkInTime: z.ZodNullable<z.ZodString>;
    checkOutTime: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    legalName: string;
    bookingMode: "instant_book" | "request_to_book" | null;
    cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay";
    checkInTime: string | null;
    checkOutTime: string | null;
    roomTypeId: string;
    checkIn: string;
    checkOut: string;
    guests: number;
    breakdown: {
        nightlyRateRwf: number;
        nights: number;
        accommodationRwf: number;
        nonRefundableDiscountRwf: number;
        serviceFeeRwf: number;
        grossRwf: number;
        guests?: number | undefined;
    };
    propertySlug: string | null;
    approvalWindowHours: number | null;
    roomName: string;
    refunds: {
        percent: number;
        until: string | null;
    }[];
    vatRatePercent: number;
}, {
    legalName: string;
    bookingMode: "instant_book" | "request_to_book" | null;
    cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay";
    checkInTime: string | null;
    checkOutTime: string | null;
    roomTypeId: string;
    checkIn: string;
    checkOut: string;
    guests: number;
    breakdown: {
        nightlyRateRwf: number;
        nights: number;
        accommodationRwf: number;
        nonRefundableDiscountRwf: number;
        serviceFeeRwf: number;
        grossRwf: number;
        guests?: number | undefined;
    };
    propertySlug: string | null;
    approvalWindowHours: number | null;
    roomName: string;
    refunds: {
        percent: number;
        until: string | null;
    }[];
    vatRatePercent: number;
}>;
export type MarketQuote = z.infer<typeof MarketQuote>;
export declare const MarketHighlight: z.ZodObject<{
    icon: z.ZodString;
    title: z.ZodString;
    desc: z.ZodString;
}, "strip", z.ZodTypeAny, {
    title: string;
    desc: string;
    icon: string;
}, {
    title: string;
    desc: string;
    icon: string;
}>;
export declare const MarketNearby: z.ZodObject<{
    place: z.ZodString;
    distance: z.ZodString;
}, "strip", z.ZodTypeAny, {
    place: string;
    distance: string;
}, {
    place: string;
    distance: string;
}>;
export declare const MarketRuleItem: z.ZodObject<{
    label: z.ZodString;
    value: z.ZodString;
}, "strip", z.ZodTypeAny, {
    value: string;
    label: string;
}, {
    value: string;
    label: string;
}>;
export declare const MarketGalleryPhoto: z.ZodObject<{
    photo: z.ZodString;
    caption: z.ZodString;
}, "strip", z.ZodTypeAny, {
    photo: string;
    caption: string;
}, {
    photo: string;
    caption: string;
}>;
/** The property page: the card, the page's own copy, the business behind it and the room cards. */
export declare const MarketPropertyPage: z.ZodObject<{
    card: z.ZodObject<{
        /** The property's id. */
        id: z.ZodString;
        slug: z.ZodString;
        name: z.ZodString;
        domain: z.ZodEnum<["hospitality", "residence"]>;
        kind: z.ZodEnum<["hotel", "lodge", "tented", "guest", "apartment", "villa", "house", "studio"]>;
        /** "Gisenyi, Rubavu": the sector and district, as the property is filed. */
        where: z.ZodString;
        districtName: z.ZodNullable<z.ZodString>;
        /** The business the guest contracts with. */
        legalName: z.ZodString;
        /** Stays: the cheapest active room's nightly rate. Homes: the cheapest unit's monthly rent. */
        priceRwf: z.ZodNullable<z.ZodNumber>;
        /** Mean of the visible guest reviews, one decimal. Null when there are none. */
        rating: z.ZodNullable<z.ZodNumber>;
        reviewCount: z.ZodNumber;
        /** How the cheapest room is booked. Null for homes, which are let, not booked. */
        bookingMode: z.ZodNullable<z.ZodEnum<["instant_book", "request_to_book"]>>;
        /** How long a host has to answer a request, from the booking domain's own window. */
        approvalWindowHours: z.ZodNullable<z.ZodNumber>;
        stockPhoto: z.ZodString;
        caption: z.ZodString;
        /** Amenity codes (the platform's `amenities` catalogue). */
        amenities: z.ZodArray<z.ZodString, "many">;
        latitude: z.ZodNullable<z.ZodNumber>;
        longitude: z.ZodNullable<z.ZodNumber>;
        bedrooms: z.ZodNullable<z.ZodNumber>;
        floorAreaSqm: z.ZodNullable<z.ZodNumber>;
        /** Homes: the first day a tenant may move in. Null means now. */
        availableFrom: z.ZodNullable<z.ZodString>;
        /** The card carries a page's own copy (highlights or a gallery), so a property page can be drawn. */
        hasPage: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        name: string;
        kind: "guest" | "hotel" | "apartment" | "lodge" | "villa" | "house" | "tented" | "studio";
        legalName: string;
        domain: "hospitality" | "residence";
        id: string;
        districtName: string | null;
        priceRwf: number | null;
        rating: number | null;
        bookingMode: "instant_book" | "request_to_book" | null;
        slug: string;
        amenities: string[];
        caption: string;
        latitude: number | null;
        longitude: number | null;
        where: string;
        reviewCount: number;
        approvalWindowHours: number | null;
        stockPhoto: string;
        bedrooms: number | null;
        floorAreaSqm: number | null;
        availableFrom: string | null;
        hasPage: boolean;
    }, {
        name: string;
        kind: "guest" | "hotel" | "apartment" | "lodge" | "villa" | "house" | "tented" | "studio";
        legalName: string;
        domain: "hospitality" | "residence";
        id: string;
        districtName: string | null;
        priceRwf: number | null;
        rating: number | null;
        bookingMode: "instant_book" | "request_to_book" | null;
        slug: string;
        amenities: string[];
        caption: string;
        latitude: number | null;
        longitude: number | null;
        where: string;
        reviewCount: number;
        approvalWindowHours: number | null;
        stockPhoto: string;
        bedrooms: number | null;
        floorAreaSqm: number | null;
        availableFrom: string | null;
        hasPage: boolean;
    }>;
    description: z.ZodNullable<z.ZodString>;
    checkInTime: z.ZodNullable<z.ZodString>;
    checkOutTime: z.ZodNullable<z.ZodString>;
    /** The house rules as the property wrote them (the prose every other route serves). */
    houseRules: z.ZodNullable<z.ZodString>;
    houseRuleItems: z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        value: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        value: string;
        label: string;
    }, {
        value: string;
        label: string;
    }>, "many">;
    highlights: z.ZodArray<z.ZodObject<{
        icon: z.ZodString;
        title: z.ZodString;
        desc: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        title: string;
        desc: string;
        icon: string;
    }, {
        title: string;
        desc: string;
        icon: string;
    }>, "many">;
    nearby: z.ZodArray<z.ZodObject<{
        place: z.ZodString;
        distance: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        place: string;
        distance: string;
    }, {
        place: string;
        distance: string;
    }>, "many">;
    mapLabel: z.ZodNullable<z.ZodString>;
    gallery: z.ZodArray<z.ZodObject<{
        photo: z.ZodString;
        caption: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        photo: string;
        caption: string;
    }, {
        photo: string;
        caption: string;
    }>, "many">;
    /** The amenities the property lists, labelled. */
    facilities: z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        label: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        code: string;
        label: string;
    }, {
        code: string;
        label: string;
    }>, "many">;
    /** Rooms (units) at the property, for "Hotel · 42 rooms". */
    roomCount: z.ZodNumber;
    /** The non-refundable (saver) rate's discount, a fraction (`NON_REFUNDABLE_DISCOUNT`). */
    nonRefundableDiscount: z.ZodNumber;
    business: z.ZodObject<{
        legalName: z.ZodString;
        tin: z.ZodNullable<z.ZodString>;
        upi: z.ZodNullable<z.ZodString>;
        /** When the business's registration was approved. */
        verifiedAt: z.ZodNullable<z.ZodString>;
        /** The latest active operating licence's expiry. */
        licenceValidTo: z.ZodNullable<z.ZodString>;
        /** The business's other published properties, by name. */
        otherProperties: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        legalName: string;
        tin: string | null;
        upi: string | null;
        verifiedAt: string | null;
        licenceValidTo: string | null;
        otherProperties: string[];
    }, {
        legalName: string;
        tin: string | null;
        upi: string | null;
        verifiedAt: string | null;
        licenceValidTo: string | null;
        otherProperties: string[];
    }>;
    rooms: z.ZodArray<z.ZodObject<{
        /** The room type's id: what a booking is made against. */
        id: z.ZodString;
        propertySlug: z.ZodString;
        name: z.ZodString;
        /** Nightly rate per guest, from the default rate plan or the room type. */
        priceRwf: z.ZodNullable<z.ZodNumber>;
        bed: z.ZodString;
        sizeSqm: z.ZodNullable<z.ZodNumber>;
        highlight: z.ZodString;
        sleeps: z.ZodNullable<z.ZodNumber>;
        /** Bookable units of this room type. */
        roomCount: z.ZodNumber;
        bookingMode: z.ZodNullable<z.ZodEnum<["instant_book", "request_to_book"]>>;
        /** A request room: how long the host has to answer, from the booking domain's own window. */
        approvalWindowHours: z.ZodNullable<z.ZodNumber>;
        cancellationTier: z.ZodNullable<z.ZodEnum<["flexible", "moderate", "limited", "firm", "strict_extended_stay"]>>;
        /** Whether the non-refundable (saver) rate is offered on this room. */
        nonrefundableEligible: z.ZodBoolean;
        maxAdults: z.ZodNullable<z.ZodNumber>;
        maxChildren: z.ZodNullable<z.ZodNumber>;
        stockPhoto: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
        roomCount: number;
        priceRwf: number | null;
        bookingMode: "instant_book" | "request_to_book" | null;
        cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
        nonrefundableEligible: boolean;
        propertySlug: string;
        approvalWindowHours: number | null;
        stockPhoto: string;
        bed: string;
        sizeSqm: number | null;
        highlight: string;
        sleeps: number | null;
        maxAdults: number | null;
        maxChildren: number | null;
    }, {
        name: string;
        id: string;
        roomCount: number;
        priceRwf: number | null;
        bookingMode: "instant_book" | "request_to_book" | null;
        cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
        nonrefundableEligible: boolean;
        propertySlug: string;
        approvalWindowHours: number | null;
        stockPhoto: string;
        bed: string;
        sizeSqm: number | null;
        highlight: string;
        sleeps: number | null;
        maxAdults: number | null;
        maxChildren: number | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    business: {
        legalName: string;
        tin: string | null;
        upi: string | null;
        verifiedAt: string | null;
        licenceValidTo: string | null;
        otherProperties: string[];
    };
    roomCount: number;
    checkInTime: string | null;
    checkOutTime: string | null;
    card: {
        name: string;
        kind: "guest" | "hotel" | "apartment" | "lodge" | "villa" | "house" | "tented" | "studio";
        legalName: string;
        domain: "hospitality" | "residence";
        id: string;
        districtName: string | null;
        priceRwf: number | null;
        rating: number | null;
        bookingMode: "instant_book" | "request_to_book" | null;
        slug: string;
        amenities: string[];
        caption: string;
        latitude: number | null;
        longitude: number | null;
        where: string;
        reviewCount: number;
        approvalWindowHours: number | null;
        stockPhoto: string;
        bedrooms: number | null;
        floorAreaSqm: number | null;
        availableFrom: string | null;
        hasPage: boolean;
    };
    rooms: {
        name: string;
        id: string;
        roomCount: number;
        priceRwf: number | null;
        bookingMode: "instant_book" | "request_to_book" | null;
        cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
        nonrefundableEligible: boolean;
        propertySlug: string;
        approvalWindowHours: number | null;
        stockPhoto: string;
        bed: string;
        sizeSqm: number | null;
        highlight: string;
        sleeps: number | null;
        maxAdults: number | null;
        maxChildren: number | null;
    }[];
    description: string | null;
    houseRules: string | null;
    facilities: {
        code: string;
        label: string;
    }[];
    houseRuleItems: {
        value: string;
        label: string;
    }[];
    highlights: {
        title: string;
        desc: string;
        icon: string;
    }[];
    nearby: {
        place: string;
        distance: string;
    }[];
    mapLabel: string | null;
    gallery: {
        photo: string;
        caption: string;
    }[];
    nonRefundableDiscount: number;
}, {
    business: {
        legalName: string;
        tin: string | null;
        upi: string | null;
        verifiedAt: string | null;
        licenceValidTo: string | null;
        otherProperties: string[];
    };
    roomCount: number;
    checkInTime: string | null;
    checkOutTime: string | null;
    card: {
        name: string;
        kind: "guest" | "hotel" | "apartment" | "lodge" | "villa" | "house" | "tented" | "studio";
        legalName: string;
        domain: "hospitality" | "residence";
        id: string;
        districtName: string | null;
        priceRwf: number | null;
        rating: number | null;
        bookingMode: "instant_book" | "request_to_book" | null;
        slug: string;
        amenities: string[];
        caption: string;
        latitude: number | null;
        longitude: number | null;
        where: string;
        reviewCount: number;
        approvalWindowHours: number | null;
        stockPhoto: string;
        bedrooms: number | null;
        floorAreaSqm: number | null;
        availableFrom: string | null;
        hasPage: boolean;
    };
    rooms: {
        name: string;
        id: string;
        roomCount: number;
        priceRwf: number | null;
        bookingMode: "instant_book" | "request_to_book" | null;
        cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
        nonrefundableEligible: boolean;
        propertySlug: string;
        approvalWindowHours: number | null;
        stockPhoto: string;
        bed: string;
        sizeSqm: number | null;
        highlight: string;
        sleeps: number | null;
        maxAdults: number | null;
        maxChildren: number | null;
    }[];
    description: string | null;
    houseRules: string | null;
    facilities: {
        code: string;
        label: string;
    }[];
    houseRuleItems: {
        value: string;
        label: string;
    }[];
    highlights: {
        title: string;
        desc: string;
        icon: string;
    }[];
    nearby: {
        place: string;
        distance: string;
    }[];
    mapLabel: string | null;
    gallery: {
        photo: string;
        caption: string;
    }[];
    nonRefundableDiscount: number;
}>;
export type MarketPropertyPage = z.infer<typeof MarketPropertyPage>;
export declare const SavedPlace: z.ZodObject<{
    propertyId: z.ZodString;
    slug: z.ZodNullable<z.ZodString>;
    name: z.ZodString;
    where: z.ZodString;
    domain: z.ZodEnum<["hospitality", "residence"]>;
    kind: z.ZodNullable<z.ZodEnum<["hotel", "lodge", "tented", "guest", "apartment", "villa", "house", "studio"]>>;
    stockPhoto: z.ZodNullable<z.ZodString>;
    /** The price today, as the card states it. */
    priceRwf: z.ZodNullable<z.ZodNumber>;
    /** The price when it was saved. */
    savedPriceRwf: z.ZodNullable<z.ZodNumber>;
    /** False when the listing is no longer public: rendered as unavailable, never dropped (F-B16 §9). */
    available: z.ZodBoolean;
    bookingMode: z.ZodNullable<z.ZodEnum<["instant_book", "request_to_book"]>>;
    availableFrom: z.ZodNullable<z.ZodString>;
    savedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    kind: "guest" | "hotel" | "apartment" | "lodge" | "villa" | "house" | "tented" | "studio" | null;
    domain: "hospitality" | "residence";
    priceRwf: number | null;
    bookingMode: "instant_book" | "request_to_book" | null;
    slug: string | null;
    available: boolean;
    propertyId: string;
    where: string;
    stockPhoto: string | null;
    availableFrom: string | null;
    savedPriceRwf: number | null;
    savedAt: string;
}, {
    name: string;
    kind: "guest" | "hotel" | "apartment" | "lodge" | "villa" | "house" | "tented" | "studio" | null;
    domain: "hospitality" | "residence";
    priceRwf: number | null;
    bookingMode: "instant_book" | "request_to_book" | null;
    slug: string | null;
    available: boolean;
    propertyId: string;
    where: string;
    stockPhoto: string | null;
    availableFrom: string | null;
    savedPriceRwf: number | null;
    savedAt: string;
}>;
export type SavedPlace = z.infer<typeof SavedPlace>;
/** `GET /me/saved`: everything the person saved, newest first, across every list. */
export declare const MySaved: z.ZodObject<{
    saved: z.ZodArray<z.ZodObject<{
        propertyId: z.ZodString;
        slug: z.ZodNullable<z.ZodString>;
        name: z.ZodString;
        where: z.ZodString;
        domain: z.ZodEnum<["hospitality", "residence"]>;
        kind: z.ZodNullable<z.ZodEnum<["hotel", "lodge", "tented", "guest", "apartment", "villa", "house", "studio"]>>;
        stockPhoto: z.ZodNullable<z.ZodString>;
        /** The price today, as the card states it. */
        priceRwf: z.ZodNullable<z.ZodNumber>;
        /** The price when it was saved. */
        savedPriceRwf: z.ZodNullable<z.ZodNumber>;
        /** False when the listing is no longer public: rendered as unavailable, never dropped (F-B16 §9). */
        available: z.ZodBoolean;
        bookingMode: z.ZodNullable<z.ZodEnum<["instant_book", "request_to_book"]>>;
        availableFrom: z.ZodNullable<z.ZodString>;
        savedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        kind: "guest" | "hotel" | "apartment" | "lodge" | "villa" | "house" | "tented" | "studio" | null;
        domain: "hospitality" | "residence";
        priceRwf: number | null;
        bookingMode: "instant_book" | "request_to_book" | null;
        slug: string | null;
        available: boolean;
        propertyId: string;
        where: string;
        stockPhoto: string | null;
        availableFrom: string | null;
        savedPriceRwf: number | null;
        savedAt: string;
    }, {
        name: string;
        kind: "guest" | "hotel" | "apartment" | "lodge" | "villa" | "house" | "tented" | "studio" | null;
        domain: "hospitality" | "residence";
        priceRwf: number | null;
        bookingMode: "instant_book" | "request_to_book" | null;
        slug: string | null;
        available: boolean;
        propertyId: string;
        where: string;
        stockPhoto: string | null;
        availableFrom: string | null;
        savedPriceRwf: number | null;
        savedAt: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    saved: {
        name: string;
        kind: "guest" | "hotel" | "apartment" | "lodge" | "villa" | "house" | "tented" | "studio" | null;
        domain: "hospitality" | "residence";
        priceRwf: number | null;
        bookingMode: "instant_book" | "request_to_book" | null;
        slug: string | null;
        available: boolean;
        propertyId: string;
        where: string;
        stockPhoto: string | null;
        availableFrom: string | null;
        savedPriceRwf: number | null;
        savedAt: string;
    }[];
}, {
    saved: {
        name: string;
        kind: "guest" | "hotel" | "apartment" | "lodge" | "villa" | "house" | "tented" | "studio" | null;
        domain: "hospitality" | "residence";
        priceRwf: number | null;
        bookingMode: "instant_book" | "request_to_book" | null;
        slug: string | null;
        available: boolean;
        propertyId: string;
        where: string;
        stockPhoto: string | null;
        availableFrom: string | null;
        savedPriceRwf: number | null;
        savedAt: string;
    }[];
}>;
export type MySaved = z.infer<typeof MySaved>;
export declare const CollectionVisibility: z.ZodEnum<["private", "shared"]>;
export declare const GuestCollection: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    visibility: z.ZodEnum<["private", "shared"]>;
    /** The list the heart writes into. */
    isDefault: z.ZodBoolean;
    createdAt: z.ZodString;
    items: z.ZodArray<z.ZodObject<{
        propertyId: z.ZodString;
        slug: z.ZodNullable<z.ZodString>;
        name: z.ZodString;
        where: z.ZodString;
        domain: z.ZodEnum<["hospitality", "residence"]>;
        kind: z.ZodNullable<z.ZodEnum<["hotel", "lodge", "tented", "guest", "apartment", "villa", "house", "studio"]>>;
        stockPhoto: z.ZodNullable<z.ZodString>;
        /** The price today, as the card states it. */
        priceRwf: z.ZodNullable<z.ZodNumber>;
        /** The price when it was saved. */
        savedPriceRwf: z.ZodNullable<z.ZodNumber>;
        /** False when the listing is no longer public: rendered as unavailable, never dropped (F-B16 §9). */
        available: z.ZodBoolean;
        bookingMode: z.ZodNullable<z.ZodEnum<["instant_book", "request_to_book"]>>;
        availableFrom: z.ZodNullable<z.ZodString>;
        savedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        kind: "guest" | "hotel" | "apartment" | "lodge" | "villa" | "house" | "tented" | "studio" | null;
        domain: "hospitality" | "residence";
        priceRwf: number | null;
        bookingMode: "instant_book" | "request_to_book" | null;
        slug: string | null;
        available: boolean;
        propertyId: string;
        where: string;
        stockPhoto: string | null;
        availableFrom: string | null;
        savedPriceRwf: number | null;
        savedAt: string;
    }, {
        name: string;
        kind: "guest" | "hotel" | "apartment" | "lodge" | "villa" | "house" | "tented" | "studio" | null;
        domain: "hospitality" | "residence";
        priceRwf: number | null;
        bookingMode: "instant_book" | "request_to_book" | null;
        slug: string | null;
        available: boolean;
        propertyId: string;
        where: string;
        stockPhoto: string | null;
        availableFrom: string | null;
        savedPriceRwf: number | null;
        savedAt: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: string;
    items: {
        name: string;
        kind: "guest" | "hotel" | "apartment" | "lodge" | "villa" | "house" | "tented" | "studio" | null;
        domain: "hospitality" | "residence";
        priceRwf: number | null;
        bookingMode: "instant_book" | "request_to_book" | null;
        slug: string | null;
        available: boolean;
        propertyId: string;
        where: string;
        stockPhoto: string | null;
        availableFrom: string | null;
        savedPriceRwf: number | null;
        savedAt: string;
    }[];
    createdAt: string;
    isDefault: boolean;
    visibility: "shared" | "private";
}, {
    name: string;
    id: string;
    items: {
        name: string;
        kind: "guest" | "hotel" | "apartment" | "lodge" | "villa" | "house" | "tented" | "studio" | null;
        domain: "hospitality" | "residence";
        priceRwf: number | null;
        bookingMode: "instant_book" | "request_to_book" | null;
        slug: string | null;
        available: boolean;
        propertyId: string;
        where: string;
        stockPhoto: string | null;
        availableFrom: string | null;
        savedPriceRwf: number | null;
        savedAt: string;
    }[];
    createdAt: string;
    isDefault: boolean;
    visibility: "shared" | "private";
}>;
export type GuestCollection = z.infer<typeof GuestCollection>;
export declare const MyCollections: z.ZodObject<{
    collections: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        visibility: z.ZodEnum<["private", "shared"]>;
        /** The list the heart writes into. */
        isDefault: z.ZodBoolean;
        createdAt: z.ZodString;
        items: z.ZodArray<z.ZodObject<{
            propertyId: z.ZodString;
            slug: z.ZodNullable<z.ZodString>;
            name: z.ZodString;
            where: z.ZodString;
            domain: z.ZodEnum<["hospitality", "residence"]>;
            kind: z.ZodNullable<z.ZodEnum<["hotel", "lodge", "tented", "guest", "apartment", "villa", "house", "studio"]>>;
            stockPhoto: z.ZodNullable<z.ZodString>;
            /** The price today, as the card states it. */
            priceRwf: z.ZodNullable<z.ZodNumber>;
            /** The price when it was saved. */
            savedPriceRwf: z.ZodNullable<z.ZodNumber>;
            /** False when the listing is no longer public: rendered as unavailable, never dropped (F-B16 §9). */
            available: z.ZodBoolean;
            bookingMode: z.ZodNullable<z.ZodEnum<["instant_book", "request_to_book"]>>;
            availableFrom: z.ZodNullable<z.ZodString>;
            savedAt: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
            kind: "guest" | "hotel" | "apartment" | "lodge" | "villa" | "house" | "tented" | "studio" | null;
            domain: "hospitality" | "residence";
            priceRwf: number | null;
            bookingMode: "instant_book" | "request_to_book" | null;
            slug: string | null;
            available: boolean;
            propertyId: string;
            where: string;
            stockPhoto: string | null;
            availableFrom: string | null;
            savedPriceRwf: number | null;
            savedAt: string;
        }, {
            name: string;
            kind: "guest" | "hotel" | "apartment" | "lodge" | "villa" | "house" | "tented" | "studio" | null;
            domain: "hospitality" | "residence";
            priceRwf: number | null;
            bookingMode: "instant_book" | "request_to_book" | null;
            slug: string | null;
            available: boolean;
            propertyId: string;
            where: string;
            stockPhoto: string | null;
            availableFrom: string | null;
            savedPriceRwf: number | null;
            savedAt: string;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
        items: {
            name: string;
            kind: "guest" | "hotel" | "apartment" | "lodge" | "villa" | "house" | "tented" | "studio" | null;
            domain: "hospitality" | "residence";
            priceRwf: number | null;
            bookingMode: "instant_book" | "request_to_book" | null;
            slug: string | null;
            available: boolean;
            propertyId: string;
            where: string;
            stockPhoto: string | null;
            availableFrom: string | null;
            savedPriceRwf: number | null;
            savedAt: string;
        }[];
        createdAt: string;
        isDefault: boolean;
        visibility: "shared" | "private";
    }, {
        name: string;
        id: string;
        items: {
            name: string;
            kind: "guest" | "hotel" | "apartment" | "lodge" | "villa" | "house" | "tented" | "studio" | null;
            domain: "hospitality" | "residence";
            priceRwf: number | null;
            bookingMode: "instant_book" | "request_to_book" | null;
            slug: string | null;
            available: boolean;
            propertyId: string;
            where: string;
            stockPhoto: string | null;
            availableFrom: string | null;
            savedPriceRwf: number | null;
            savedAt: string;
        }[];
        createdAt: string;
        isDefault: boolean;
        visibility: "shared" | "private";
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    collections: {
        name: string;
        id: string;
        items: {
            name: string;
            kind: "guest" | "hotel" | "apartment" | "lodge" | "villa" | "house" | "tented" | "studio" | null;
            domain: "hospitality" | "residence";
            priceRwf: number | null;
            bookingMode: "instant_book" | "request_to_book" | null;
            slug: string | null;
            available: boolean;
            propertyId: string;
            where: string;
            stockPhoto: string | null;
            availableFrom: string | null;
            savedPriceRwf: number | null;
            savedAt: string;
        }[];
        createdAt: string;
        isDefault: boolean;
        visibility: "shared" | "private";
    }[];
}, {
    collections: {
        name: string;
        id: string;
        items: {
            name: string;
            kind: "guest" | "hotel" | "apartment" | "lodge" | "villa" | "house" | "tented" | "studio" | null;
            domain: "hospitality" | "residence";
            priceRwf: number | null;
            bookingMode: "instant_book" | "request_to_book" | null;
            slug: string | null;
            available: boolean;
            propertyId: string;
            where: string;
            stockPhoto: string | null;
            availableFrom: string | null;
            savedPriceRwf: number | null;
            savedAt: string;
        }[];
        createdAt: string;
        isDefault: boolean;
        visibility: "shared" | "private";
    }[];
}>;
export type MyCollections = z.infer<typeof MyCollections>;
/** Duplicate names are allowed (F-B16 §9): a name is for display, never an identity. */
export declare const CollectionInput: z.ZodObject<{
    name: z.ZodString;
}, "strict", z.ZodTypeAny, {
    name: string;
}, {
    name: string;
}>;
export type CollectionInput = z.infer<typeof CollectionInput>;
export declare const CollectionItemInput: z.ZodObject<{
    propertyId: z.ZodString;
}, "strict", z.ZodTypeAny, {
    propertyId: string;
}, {
    propertyId: string;
}>;
export type CollectionItemInput = z.infer<typeof CollectionItemInput>;
export declare const ConsentPurpose: z.ZodEnum<["booking_messages", "share_phone_with_hosts", "review_reminders", "marketing_offers", "personalisation"]>;
export type ConsentPurpose = z.infer<typeof ConsentPurpose>;
/** The privacy notice a choice is recorded under. */
export declare const CONSENT_POLICY_VERSION = "privacy-2.1";
/** Booking messages carry the booking itself; they are never optional. */
export declare const REQUIRED_CONSENTS: readonly ConsentPurpose[];
export declare const ConsentChoice: z.ZodObject<{
    purpose: z.ZodEnum<["booking_messages", "share_phone_with_hosts", "review_reminders", "marketing_offers", "personalisation"]>;
    granted: z.ZodBoolean;
    required: z.ZodBoolean;
    /** When the person last chose. Null when they never have (the default applies: off, unless required). */
    recordedAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    required: boolean;
    granted: boolean;
    purpose: "booking_messages" | "share_phone_with_hosts" | "review_reminders" | "marketing_offers" | "personalisation";
    recordedAt: string | null;
}, {
    required: boolean;
    granted: boolean;
    purpose: "booking_messages" | "share_phone_with_hosts" | "review_reminders" | "marketing_offers" | "personalisation";
    recordedAt: string | null;
}>;
export type ConsentChoice = z.infer<typeof ConsentChoice>;
export declare const MyConsents: z.ZodObject<{
    policyVersion: z.ZodString;
    consents: z.ZodArray<z.ZodObject<{
        purpose: z.ZodEnum<["booking_messages", "share_phone_with_hosts", "review_reminders", "marketing_offers", "personalisation"]>;
        granted: z.ZodBoolean;
        required: z.ZodBoolean;
        /** When the person last chose. Null when they never have (the default applies: off, unless required). */
        recordedAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        required: boolean;
        granted: boolean;
        purpose: "booking_messages" | "share_phone_with_hosts" | "review_reminders" | "marketing_offers" | "personalisation";
        recordedAt: string | null;
    }, {
        required: boolean;
        granted: boolean;
        purpose: "booking_messages" | "share_phone_with_hosts" | "review_reminders" | "marketing_offers" | "personalisation";
        recordedAt: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    policyVersion: string;
    consents: {
        required: boolean;
        granted: boolean;
        purpose: "booking_messages" | "share_phone_with_hosts" | "review_reminders" | "marketing_offers" | "personalisation";
        recordedAt: string | null;
    }[];
}, {
    policyVersion: string;
    consents: {
        required: boolean;
        granted: boolean;
        purpose: "booking_messages" | "share_phone_with_hosts" | "review_reminders" | "marketing_offers" | "personalisation";
        recordedAt: string | null;
    }[];
}>;
export type MyConsents = z.infer<typeof MyConsents>;
export declare const ConsentInput: z.ZodObject<{
    purpose: z.ZodEnum<["booking_messages", "share_phone_with_hosts", "review_reminders", "marketing_offers", "personalisation"]>;
    granted: z.ZodBoolean;
}, "strict", z.ZodTypeAny, {
    granted: boolean;
    purpose: "booking_messages" | "share_phone_with_hosts" | "review_reminders" | "marketing_offers" | "personalisation";
}, {
    granted: boolean;
    purpose: "booking_messages" | "share_phone_with_hosts" | "review_reminders" | "marketing_offers" | "personalisation";
}>;
export type ConsentInput = z.infer<typeof ConsentInput>;
export declare const GuestLocale: z.ZodEnum<["en", "rw", "fr"]>;
export type GuestLocale = z.infer<typeof GuestLocale>;
export declare const GuestContact: z.ZodObject<{
    name: z.ZodString;
    email: z.ZodString;
    phone: z.ZodNullable<z.ZodString>;
    country: z.ZodString;
    countryName: z.ZodString;
    locale: z.ZodEnum<["en", "rw", "fr"]>;
    /** A non-Rwandan address is one free line (D24). */
    address: z.ZodNullable<z.ZodString>;
    joinedAt: z.ZodString;
    /** How the person signs in: "email_code", "google". */
    signInMethods: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    country: string;
    name: string;
    address: string | null;
    email: string;
    joinedAt: string;
    phone: string | null;
    countryName: string;
    locale: "en" | "rw" | "fr";
    signInMethods: string[];
}, {
    country: string;
    name: string;
    address: string | null;
    email: string;
    joinedAt: string;
    phone: string | null;
    countryName: string;
    locale: "en" | "rw" | "fr";
    signInMethods: string[];
}>;
export type GuestContact = z.infer<typeof GuestContact>;
export declare const GuestContactInput: z.ZodObject<{
    name: z.ZodString;
    /** Digits and the punctuation people type around them. Empty clears it. */
    phone: z.ZodString;
    /** A country code (KE) or its English name (Kenya); the API resolves either, and refuses anything else. */
    country: z.ZodString;
    locale: z.ZodEnum<["en", "rw", "fr"]>;
}, "strict", z.ZodTypeAny, {
    country: string;
    name: string;
    phone: string;
    locale: "en" | "rw" | "fr";
}, {
    country: string;
    name: string;
    phone: string;
    locale: "en" | "rw" | "fr";
}>;
export type GuestContactInput = z.infer<typeof GuestContactInput>;
export declare const TripPayment: z.ZodObject<{
    instrumentKind: z.ZodNullable<z.ZodEnum<["mobile_money", "card"]>>;
    network: z.ZodNullable<z.ZodEnum<["mtn_momo", "airtel_money"]>>;
    payerMasked: z.ZodNullable<z.ZodString>;
    /** The provider's reference for the capture. */
    providerRef: z.ZodNullable<z.ZodString>;
    amountRwf: z.ZodNullable<z.ZodNumber>;
    settledAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    amountRwf: number | null;
    settledAt: string | null;
    network: "mtn_momo" | "airtel_money" | null;
    payerMasked: string | null;
    instrumentKind: "mobile_money" | "card" | null;
    providerRef: string | null;
}, {
    amountRwf: number | null;
    settledAt: string | null;
    network: "mtn_momo" | "airtel_money" | null;
    payerMasked: string | null;
    instrumentKind: "mobile_money" | "card" | null;
    providerRef: string | null;
}>;
export type TripPayment = z.infer<typeof TripPayment>;
export declare const GuestTripFacts: z.ZodObject<{
    reference: z.ZodString;
    /** The business the stay is contracted with. */
    legalName: z.ZodString;
    /** The property's marketplace picture, when it has a card (published or not). */
    stockPhoto: z.ZodNullable<z.ZodString>;
    /** A request: when it lapses if the host has not answered. */
    approvalExpiresAt: z.ZodNullable<z.ZodString>;
    payment: z.ZodNullable<z.ZodObject<{
        instrumentKind: z.ZodNullable<z.ZodEnum<["mobile_money", "card"]>>;
        network: z.ZodNullable<z.ZodEnum<["mtn_momo", "airtel_money"]>>;
        payerMasked: z.ZodNullable<z.ZodString>;
        /** The provider's reference for the capture. */
        providerRef: z.ZodNullable<z.ZodString>;
        amountRwf: z.ZodNullable<z.ZodNumber>;
        settledAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        amountRwf: number | null;
        settledAt: string | null;
        network: "mtn_momo" | "airtel_money" | null;
        payerMasked: string | null;
        instrumentKind: "mobile_money" | "card" | null;
        providerRef: string | null;
    }, {
        amountRwf: number | null;
        settledAt: string | null;
        network: "mtn_momo" | "airtel_money" | null;
        payerMasked: string | null;
        instrumentKind: "mobile_money" | "card" | null;
        providerRef: string | null;
    }>>;
    refundRwf: z.ZodNullable<z.ZodNumber>;
    cancelledAt: z.ZodNullable<z.ZodString>;
    /** When the guest sent their pre-arrival details, if they have. */
    preArrivalSubmittedAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    legalName: string;
    payment: {
        amountRwf: number | null;
        settledAt: string | null;
        network: "mtn_momo" | "airtel_money" | null;
        payerMasked: string | null;
        instrumentKind: "mobile_money" | "card" | null;
        providerRef: string | null;
    } | null;
    reference: string;
    approvalExpiresAt: string | null;
    refundRwf: number | null;
    cancelledAt: string | null;
    stockPhoto: string | null;
    preArrivalSubmittedAt: string | null;
}, {
    legalName: string;
    payment: {
        amountRwf: number | null;
        settledAt: string | null;
        network: "mtn_momo" | "airtel_money" | null;
        payerMasked: string | null;
        instrumentKind: "mobile_money" | "card" | null;
        providerRef: string | null;
    } | null;
    reference: string;
    approvalExpiresAt: string | null;
    refundRwf: number | null;
    cancelledAt: string | null;
    stockPhoto: string | null;
    preArrivalSubmittedAt: string | null;
}>;
export type GuestTripFacts = z.infer<typeof GuestTripFacts>;
export declare const MyTripFacts: z.ZodObject<{
    trips: z.ZodArray<z.ZodObject<{
        reference: z.ZodString;
        /** The business the stay is contracted with. */
        legalName: z.ZodString;
        /** The property's marketplace picture, when it has a card (published or not). */
        stockPhoto: z.ZodNullable<z.ZodString>;
        /** A request: when it lapses if the host has not answered. */
        approvalExpiresAt: z.ZodNullable<z.ZodString>;
        payment: z.ZodNullable<z.ZodObject<{
            instrumentKind: z.ZodNullable<z.ZodEnum<["mobile_money", "card"]>>;
            network: z.ZodNullable<z.ZodEnum<["mtn_momo", "airtel_money"]>>;
            payerMasked: z.ZodNullable<z.ZodString>;
            /** The provider's reference for the capture. */
            providerRef: z.ZodNullable<z.ZodString>;
            amountRwf: z.ZodNullable<z.ZodNumber>;
            settledAt: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            amountRwf: number | null;
            settledAt: string | null;
            network: "mtn_momo" | "airtel_money" | null;
            payerMasked: string | null;
            instrumentKind: "mobile_money" | "card" | null;
            providerRef: string | null;
        }, {
            amountRwf: number | null;
            settledAt: string | null;
            network: "mtn_momo" | "airtel_money" | null;
            payerMasked: string | null;
            instrumentKind: "mobile_money" | "card" | null;
            providerRef: string | null;
        }>>;
        refundRwf: z.ZodNullable<z.ZodNumber>;
        cancelledAt: z.ZodNullable<z.ZodString>;
        /** When the guest sent their pre-arrival details, if they have. */
        preArrivalSubmittedAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        legalName: string;
        payment: {
            amountRwf: number | null;
            settledAt: string | null;
            network: "mtn_momo" | "airtel_money" | null;
            payerMasked: string | null;
            instrumentKind: "mobile_money" | "card" | null;
            providerRef: string | null;
        } | null;
        reference: string;
        approvalExpiresAt: string | null;
        refundRwf: number | null;
        cancelledAt: string | null;
        stockPhoto: string | null;
        preArrivalSubmittedAt: string | null;
    }, {
        legalName: string;
        payment: {
            amountRwf: number | null;
            settledAt: string | null;
            network: "mtn_momo" | "airtel_money" | null;
            payerMasked: string | null;
            instrumentKind: "mobile_money" | "card" | null;
            providerRef: string | null;
        } | null;
        reference: string;
        approvalExpiresAt: string | null;
        refundRwf: number | null;
        cancelledAt: string | null;
        stockPhoto: string | null;
        preArrivalSubmittedAt: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    trips: {
        legalName: string;
        payment: {
            amountRwf: number | null;
            settledAt: string | null;
            network: "mtn_momo" | "airtel_money" | null;
            payerMasked: string | null;
            instrumentKind: "mobile_money" | "card" | null;
            providerRef: string | null;
        } | null;
        reference: string;
        approvalExpiresAt: string | null;
        refundRwf: number | null;
        cancelledAt: string | null;
        stockPhoto: string | null;
        preArrivalSubmittedAt: string | null;
    }[];
}, {
    trips: {
        legalName: string;
        payment: {
            amountRwf: number | null;
            settledAt: string | null;
            network: "mtn_momo" | "airtel_money" | null;
            payerMasked: string | null;
            instrumentKind: "mobile_money" | "card" | null;
            providerRef: string | null;
        } | null;
        reference: string;
        approvalExpiresAt: string | null;
        refundRwf: number | null;
        cancelledAt: string | null;
        stockPhoto: string | null;
        preArrivalSubmittedAt: string | null;
    }[];
}>;
export type MyTripFacts = z.infer<typeof MyTripFacts>;
/** One branch the person works at: every branch of their org, or only those their membership is limited to. */
export declare const MyBusinessPlace: z.ZodObject<{
    propertyId: z.ZodString;
    propertyName: z.ZodString;
    legalName: z.ZodString;
    orgId: z.ZodString;
    role: z.ZodString;
}, "strip", z.ZodTypeAny, {
    legalName: string;
    role: string;
    orgId: string;
    propertyName: string;
    propertyId: string;
}, {
    legalName: string;
    role: string;
    orgId: string;
    propertyName: string;
    propertyId: string;
}>;
export type MyBusinessPlace = z.infer<typeof MyBusinessPlace>;
export declare const MyBusinesses: z.ZodObject<{
    businesses: z.ZodArray<z.ZodObject<{
        propertyId: z.ZodString;
        propertyName: z.ZodString;
        legalName: z.ZodString;
        orgId: z.ZodString;
        role: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        legalName: string;
        role: string;
        orgId: string;
        propertyName: string;
        propertyId: string;
    }, {
        legalName: string;
        role: string;
        orgId: string;
        propertyName: string;
        propertyId: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    businesses: {
        legalName: string;
        role: string;
        orgId: string;
        propertyName: string;
        propertyId: string;
    }[];
}, {
    businesses: {
        legalName: string;
        role: string;
        orgId: string;
        propertyName: string;
        propertyId: string;
    }[];
}>;
export type MyBusinesses = z.infer<typeof MyBusinesses>;
//# sourceMappingURL=marketplace.d.ts.map