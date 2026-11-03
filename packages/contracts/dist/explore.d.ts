import { z } from "zod";
import { type RoomPriceBasis } from "./booking";
import { type StoredAccommodationClass } from "./rdb";
/**
 * Explore: the guest's public search over stays and homes (mobile spec 0005, feature 23).
 *
 * VISIBILITY IS NOT DECIDED HERE. Every card is a property the canonical public read admits (a
 * published listing of an active business, ADR-053 contract rule 1), with a public address and not
 * archived; stays also need an active room type, homes a listed unit. A property with no marketplace
 * profile row is listed all the same: the profile is the web interface's copy, not the rule.
 *
 * THE PHONE NEVER COMPUTES MONEY. Every price on a card or a page is the API's, with the basis it
 * was computed on (`priceBasis`), so the phone words it and never multiplies it.
 */
/** Stays are hospitality businesses' rooms; homes are residence businesses' listed units. */
export declare const ExploreMode: z.ZodEnum<["stays", "homes"]>;
export type ExploreMode = z.infer<typeof ExploreMode>;
/** Top rated (weighted by review count), or by the price the card shows. */
export declare const ExploreSort: z.ZodEnum<["top_rated", "price_asc", "price_desc"]>;
export type ExploreSort = z.infer<typeof ExploreSort>;
/**
 * What a price covers (mobile spec 0005, D-j): the party a night ("a night for 2"); with no party
 * yet, a room or a whole place a night ("a night", a room priced `per_unit`) or one person a night
 * ("a person, a night", `per_person`); or a home a month.
 */
export declare const ExplorePriceBasis: z.ZodEnum<["party_night", "unit_night", "person_night", "month"]>;
export type ExplorePriceBasis = z.infer<typeof ExplorePriceBasis>;
/**
 * The basis a stay's price is shown on before a party is set, from how its room is counted
 * (`chargedGuests`): a room priced per room or a whole place is its own price a night, a room priced
 * per person is one person's. A menu item (`per_item`) is never a stay and never reaches explore.
 */
export declare function noPartyPriceBasis(roomBasis: RoomPriceBasis | null | undefined): "unit_night" | "person_night";
/** The chips a guest filters stays by, drawn from the business's registered class (D-i). */
export declare const ExploreType: z.ZodEnum<["hotel", "lodge", "guest_house", "tented_camp", "apartment", "villa", "stay", "home"]>;
export type ExploreType = z.infer<typeof ExploreType>;
export declare const EXPLORE_TYPE_LABEL: Readonly<Record<ExploreType, string>>;
/**
 * Every class `orgs.accommodation_class` may hold, current or retired, mapped to its chip. Typed over
 * the whole stored vocabulary, so a class added to the contract without a chip fails to compile.
 */
export declare const EXPLORE_TYPES: Readonly<Record<StoredAccommodationClass, ExploreType>>;
/** Every stored accommodation class, current and retired, for the mapping's own test. */
export declare const STORED_ACCOMMODATION_CLASSES: readonly StoredAccommodationClass[];
/** The chip of a stay's class; a null or unknown class is a plain "Stay". Every home is a "Home". */
export declare function exploreTypeOf(mode: ExploreMode, accommodationClass: string | null): ExploreType;
/**
 * The amenities a property page leads with, in this order, then the rest by label (D-m's facts).
 * Codes from the platform catalogue (`server/api/scripts/reference-data.mjs`).
 */
export declare const EXPLORE_FACT_ORDER: readonly string[];
/** How many facts a page shows. No fact is invented: a property with two amenities shows two. */
export declare const EXPLORE_MAX_FACTS = 4;
/** Results a page of search carries by default, and at most. */
export declare const EXPLORE_PAGE_SIZE = 20;
export declare const EXPLORE_MAX_PAGE_SIZE = 50;
/** Where a shared property link points: the web's own property page (D-aa). */
export declare const EXPLORE_SHARE_ORIGIN = "https://www.injishi.com";
/** A chosen suggestion: `district:12`, `sector:345` or `property:<slug>`. */
export declare const ExplorePlaceRef: z.ZodString;
export type ExplorePlaceRef = z.infer<typeof ExplorePlaceRef>;
/** `GET /explore/search` (milestone 1: place or text, mode, sort and paging). */
export declare const ExploreSearchQuery: z.ZodObject<{
    mode: z.ZodDefault<z.ZodEnum<["stays", "homes"]>>;
    /** Free text over the property's name, its sector and its district, ignoring case. */
    q: z.ZodOptional<z.ZodString>;
    /** A suggestion the guest picked; wins over `q` for the area. */
    place: z.ZodOptional<z.ZodString>;
    sort: z.ZodDefault<z.ZodEnum<["top_rated", "price_asc", "price_desc"]>>;
    /** Opaque: the last row's sort key, the frozen platform mean and the filters it was made for. */
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    sort: "price_asc" | "price_desc" | "top_rated";
    mode: "stays" | "homes";
    limit: number;
    cursor?: string | undefined;
    q?: string | undefined;
    place?: string | undefined;
}, {
    sort?: "price_asc" | "price_desc" | "top_rated" | undefined;
    cursor?: string | undefined;
    q?: string | undefined;
    mode?: "stays" | "homes" | undefined;
    place?: string | undefined;
    limit?: number | undefined;
}>;
export type ExploreSearchQuery = z.infer<typeof ExploreSearchQuery>;
/**
 * One photograph on the wire. The phone builds its URL from the id and the kind (`photoUrl`), in one
 * place; an object key never leaves the API. Width and height are null for an original.
 */
export declare const ExplorePhoto: z.ZodObject<{
    id: z.ZodString;
    kind: z.ZodEnum<["property", "unit"]>;
    caption: z.ZodNullable<z.ZodString>;
    width: z.ZodNullable<z.ZodNumber>;
    height: z.ZodNullable<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    id: string;
    kind: "property" | "unit";
    caption: string | null;
    width: number | null;
    height: number | null;
}, {
    id: string;
    kind: "property" | "unit";
    caption: string | null;
    width: number | null;
    height: number | null;
}>;
export type ExplorePhoto = z.infer<typeof ExplorePhoto>;
export declare const ExploreCard: z.ZodObject<{
    /** The property's id. */
    id: z.ZodString;
    slug: z.ZodString;
    name: z.ZodString;
    mode: z.ZodEnum<["stays", "homes"]>;
    type: z.ZodEnum<["hotel", "lodge", "guest_house", "tented_camp", "apartment", "villa", "stay", "home"]>;
    typeLabel: z.ZodString;
    /** "Gisenyi, Rubavu": the sector, then the district. Empty when the property is not placed. */
    where: z.ZodString;
    districtName: z.ZodNullable<z.ZodString>;
    /** Mean of the public guest reviews, one decimal. Null when there are none ("New"). */
    rating: z.ZodNullable<z.ZodNumber>;
    reviewCount: z.ZodNumber;
    /** The figure the card shows, on `priceBasis`. Null when nothing is priced ("Price on request"). */
    priceRwf: z.ZodNullable<z.ZodNumber>;
    priceBasis: z.ZodEnum<["party_night", "unit_night", "person_night", "month"]>;
    /** Stays: how the room the price comes from is booked. Null for homes. */
    bookingMode: z.ZodNullable<z.ZodEnum<["instant_book", "request_to_book"]>>;
    /** A request room: how long the host has to answer, from the booking domain's own window. */
    approvalWindowHours: z.ZodNullable<z.ZodNumber>;
    /** "N left" when 3 or fewer of the priced room remain for the chosen dates; null without dates. */
    roomsLeft: z.ZodNullable<z.ZodNumber>;
    /** Up to five, the cover first. */
    photos: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodEnum<["property", "unit"]>;
        caption: z.ZodNullable<z.ZodString>;
        width: z.ZodNullable<z.ZodNumber>;
        height: z.ZodNullable<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        kind: "property" | "unit";
        caption: string | null;
        width: number | null;
        height: number | null;
    }, {
        id: string;
        kind: "property" | "unit";
        caption: string | null;
        width: number | null;
        height: number | null;
    }>, "many">;
    /** The centre of a 0.01 degree cell when the property asked for location privacy (D-o). */
    latitude: z.ZodNullable<z.ZodNumber>;
    longitude: z.ZodNullable<z.ZodNumber>;
    locationApproximate: z.ZodBoolean;
    /** Homes: the first day a listed unit can be moved into; null means now. */
    availableFrom: z.ZodNullable<z.ZodString>;
    /** Homes: how many units are listed. */
    unitCount: z.ZodNullable<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    type: "hotel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "stay" | "home";
    name: string;
    id: string;
    bookingMode: "instant_book" | "request_to_book" | null;
    priceBasis: "month" | "party_night" | "unit_night" | "person_night";
    slug: string;
    districtName: string | null;
    mode: "stays" | "homes";
    priceRwf: number | null;
    rating: number | null;
    photos: {
        id: string;
        kind: "property" | "unit";
        caption: string | null;
        width: number | null;
        height: number | null;
    }[];
    availableFrom: string | null;
    latitude: number | null;
    longitude: number | null;
    typeLabel: string;
    where: string;
    reviewCount: number;
    approvalWindowHours: number | null;
    roomsLeft: number | null;
    locationApproximate: boolean;
    unitCount: number | null;
}, {
    type: "hotel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "stay" | "home";
    name: string;
    id: string;
    bookingMode: "instant_book" | "request_to_book" | null;
    priceBasis: "month" | "party_night" | "unit_night" | "person_night";
    slug: string;
    districtName: string | null;
    mode: "stays" | "homes";
    priceRwf: number | null;
    rating: number | null;
    photos: {
        id: string;
        kind: "property" | "unit";
        caption: string | null;
        width: number | null;
        height: number | null;
    }[];
    availableFrom: string | null;
    latitude: number | null;
    longitude: number | null;
    typeLabel: string;
    where: string;
    reviewCount: number;
    approvalWindowHours: number | null;
    roomsLeft: number | null;
    locationApproximate: boolean;
    unitCount: number | null;
}>;
export type ExploreCard = z.infer<typeof ExploreCard>;
export declare const ExploreSearchResult: z.ZodObject<{
    results: z.ZodArray<z.ZodObject<{
        /** The property's id. */
        id: z.ZodString;
        slug: z.ZodString;
        name: z.ZodString;
        mode: z.ZodEnum<["stays", "homes"]>;
        type: z.ZodEnum<["hotel", "lodge", "guest_house", "tented_camp", "apartment", "villa", "stay", "home"]>;
        typeLabel: z.ZodString;
        /** "Gisenyi, Rubavu": the sector, then the district. Empty when the property is not placed. */
        where: z.ZodString;
        districtName: z.ZodNullable<z.ZodString>;
        /** Mean of the public guest reviews, one decimal. Null when there are none ("New"). */
        rating: z.ZodNullable<z.ZodNumber>;
        reviewCount: z.ZodNumber;
        /** The figure the card shows, on `priceBasis`. Null when nothing is priced ("Price on request"). */
        priceRwf: z.ZodNullable<z.ZodNumber>;
        priceBasis: z.ZodEnum<["party_night", "unit_night", "person_night", "month"]>;
        /** Stays: how the room the price comes from is booked. Null for homes. */
        bookingMode: z.ZodNullable<z.ZodEnum<["instant_book", "request_to_book"]>>;
        /** A request room: how long the host has to answer, from the booking domain's own window. */
        approvalWindowHours: z.ZodNullable<z.ZodNumber>;
        /** "N left" when 3 or fewer of the priced room remain for the chosen dates; null without dates. */
        roomsLeft: z.ZodNullable<z.ZodNumber>;
        /** Up to five, the cover first. */
        photos: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodEnum<["property", "unit"]>;
            caption: z.ZodNullable<z.ZodString>;
            width: z.ZodNullable<z.ZodNumber>;
            height: z.ZodNullable<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            kind: "property" | "unit";
            caption: string | null;
            width: number | null;
            height: number | null;
        }, {
            id: string;
            kind: "property" | "unit";
            caption: string | null;
            width: number | null;
            height: number | null;
        }>, "many">;
        /** The centre of a 0.01 degree cell when the property asked for location privacy (D-o). */
        latitude: z.ZodNullable<z.ZodNumber>;
        longitude: z.ZodNullable<z.ZodNumber>;
        locationApproximate: z.ZodBoolean;
        /** Homes: the first day a listed unit can be moved into; null means now. */
        availableFrom: z.ZodNullable<z.ZodString>;
        /** Homes: how many units are listed. */
        unitCount: z.ZodNullable<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        type: "hotel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "stay" | "home";
        name: string;
        id: string;
        bookingMode: "instant_book" | "request_to_book" | null;
        priceBasis: "month" | "party_night" | "unit_night" | "person_night";
        slug: string;
        districtName: string | null;
        mode: "stays" | "homes";
        priceRwf: number | null;
        rating: number | null;
        photos: {
            id: string;
            kind: "property" | "unit";
            caption: string | null;
            width: number | null;
            height: number | null;
        }[];
        availableFrom: string | null;
        latitude: number | null;
        longitude: number | null;
        typeLabel: string;
        where: string;
        reviewCount: number;
        approvalWindowHours: number | null;
        roomsLeft: number | null;
        locationApproximate: boolean;
        unitCount: number | null;
    }, {
        type: "hotel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "stay" | "home";
        name: string;
        id: string;
        bookingMode: "instant_book" | "request_to_book" | null;
        priceBasis: "month" | "party_night" | "unit_night" | "person_night";
        slug: string;
        districtName: string | null;
        mode: "stays" | "homes";
        priceRwf: number | null;
        rating: number | null;
        photos: {
            id: string;
            kind: "property" | "unit";
            caption: string | null;
            width: number | null;
            height: number | null;
        }[];
        availableFrom: string | null;
        latitude: number | null;
        longitude: number | null;
        typeLabel: string;
        where: string;
        reviewCount: number;
        approvalWindowHours: number | null;
        roomsLeft: number | null;
        locationApproximate: boolean;
        unitCount: number | null;
    }>, "many">;
    /** Null at the end. */
    nextCursor: z.ZodNullable<z.ZodString>;
    /** Every match for this search, counted with the same filters. */
    total: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    nextCursor: string | null;
    total: number;
    results: {
        type: "hotel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "stay" | "home";
        name: string;
        id: string;
        bookingMode: "instant_book" | "request_to_book" | null;
        priceBasis: "month" | "party_night" | "unit_night" | "person_night";
        slug: string;
        districtName: string | null;
        mode: "stays" | "homes";
        priceRwf: number | null;
        rating: number | null;
        photos: {
            id: string;
            kind: "property" | "unit";
            caption: string | null;
            width: number | null;
            height: number | null;
        }[];
        availableFrom: string | null;
        latitude: number | null;
        longitude: number | null;
        typeLabel: string;
        where: string;
        reviewCount: number;
        approvalWindowHours: number | null;
        roomsLeft: number | null;
        locationApproximate: boolean;
        unitCount: number | null;
    }[];
}, {
    nextCursor: string | null;
    total: number;
    results: {
        type: "hotel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "stay" | "home";
        name: string;
        id: string;
        bookingMode: "instant_book" | "request_to_book" | null;
        priceBasis: "month" | "party_night" | "unit_night" | "person_night";
        slug: string;
        districtName: string | null;
        mode: "stays" | "homes";
        priceRwf: number | null;
        rating: number | null;
        photos: {
            id: string;
            kind: "property" | "unit";
            caption: string | null;
            width: number | null;
            height: number | null;
        }[];
        availableFrom: string | null;
        latitude: number | null;
        longitude: number | null;
        typeLabel: string;
        where: string;
        reviewCount: number;
        approvalWindowHours: number | null;
        roomsLeft: number | null;
        locationApproximate: boolean;
        unitCount: number | null;
    }[];
}>;
export type ExploreSearchResult = z.infer<typeof ExploreSearchResult>;
/** `GET /explore/places`: suggestions for two letters or more. */
export declare const ExplorePlacesQuery: z.ZodObject<{
    q: z.ZodString;
    mode: z.ZodDefault<z.ZodEnum<["stays", "homes"]>>;
}, "strip", z.ZodTypeAny, {
    q: string;
    mode: "stays" | "homes";
}, {
    q: string;
    mode?: "stays" | "homes" | undefined;
}>;
export type ExplorePlacesQuery = z.infer<typeof ExplorePlacesQuery>;
export declare const ExplorePlace: z.ZodObject<{
    kind: z.ZodEnum<["district", "sector", "property"]>;
    /** The district's or sector's id, or the property's id. */
    id: z.ZodString;
    label: z.ZodString;
    /** "12 stays" for an area; "Gisenyi, Rubavu" for a property. */
    sub: z.ZodString;
    /** A property's public slug; null for an area. */
    slug: z.ZodNullable<z.ZodString>;
    /** What `place` takes to filter by this suggestion. */
    ref: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    slug: string | null;
    kind: "district" | "sector" | "property";
    label: string;
    sub: string;
    ref: string;
}, {
    id: string;
    slug: string | null;
    kind: "district" | "sector" | "property";
    label: string;
    sub: string;
    ref: string;
}>;
export type ExplorePlace = z.infer<typeof ExplorePlace>;
export declare const ExplorePlaces: z.ZodObject<{
    places: z.ZodArray<z.ZodObject<{
        kind: z.ZodEnum<["district", "sector", "property"]>;
        /** The district's or sector's id, or the property's id. */
        id: z.ZodString;
        label: z.ZodString;
        /** "12 stays" for an area; "Gisenyi, Rubavu" for a property. */
        sub: z.ZodString;
        /** A property's public slug; null for an area. */
        slug: z.ZodNullable<z.ZodString>;
        /** What `place` takes to filter by this suggestion. */
        ref: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        slug: string | null;
        kind: "district" | "sector" | "property";
        label: string;
        sub: string;
        ref: string;
    }, {
        id: string;
        slug: string | null;
        kind: "district" | "sector" | "property";
        label: string;
        sub: string;
        ref: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    places: {
        id: string;
        slug: string | null;
        kind: "district" | "sector" | "property";
        label: string;
        sub: string;
        ref: string;
    }[];
}, {
    places: {
        id: string;
        slug: string | null;
        kind: "district" | "sector" | "property";
        label: string;
        sub: string;
        ref: string;
    }[];
}>;
export type ExplorePlaces = z.infer<typeof ExplorePlaces>;
/**
 * A room type on a stay's page, priced by the card's rule for that one room (D-j): its own basis,
 * so a hotel room reads "a night" and a room priced per person "a person, a night".
 */
export declare const ExploreRoom: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    /**
     * How many people it sleeps: `DEFAULT_CAPACITY` (4) when the host has not said, the figure the
     * booking refuses a larger party by. Nullable only for older answers.
     */
    sleeps: z.ZodNullable<z.ZodNumber>;
    roomCount: z.ZodNumber;
    /** Null, with a null basis, when the room has no price yet ("Price on request"). */
    priceRwf: z.ZodNullable<z.ZodNumber>;
    priceBasis: z.ZodNullable<z.ZodEnum<["party_night", "unit_night", "person_night", "month"]>>;
    bookingMode: z.ZodNullable<z.ZodEnum<["instant_book", "request_to_book"]>>;
    approvalWindowHours: z.ZodNullable<z.ZodNumber>;
    cancellationTier: z.ZodNullable<z.ZodEnum<["flexible", "moderate", "limited", "firm", "strict_extended_stay"]>>;
    /** The saver (non refundable) rate is offered on this room. */
    nonrefundableEligible: z.ZodBoolean;
    minStay: z.ZodNullable<z.ZodNumber>;
    /** The fewest free units over the chosen nights; null without dates, 0 is sold out. */
    freeUnits: z.ZodNullable<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: string;
    roomCount: number;
    bookingMode: "instant_book" | "request_to_book" | null;
    cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
    nonrefundableEligible: boolean;
    priceBasis: "month" | "party_night" | "unit_night" | "person_night" | null;
    minStay: number | null;
    freeUnits: number | null;
    priceRwf: number | null;
    approvalWindowHours: number | null;
    sleeps: number | null;
}, {
    name: string;
    id: string;
    roomCount: number;
    bookingMode: "instant_book" | "request_to_book" | null;
    cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
    nonrefundableEligible: boolean;
    priceBasis: "month" | "party_night" | "unit_night" | "person_night" | null;
    minStay: number | null;
    freeUnits: number | null;
    priceRwf: number | null;
    approvalWindowHours: number | null;
    sleeps: number | null;
}>;
export type ExploreRoom = z.infer<typeof ExploreRoom>;
/** A listed unit on a home's page. */
export declare const ExploreUnit: z.ZodObject<{
    id: z.ZodString;
    label: z.ZodString;
    bedrooms: z.ZodNullable<z.ZodNumber>;
    bathrooms: z.ZodNullable<z.ZodNumber>;
    sizeSqm: z.ZodNullable<z.ZodNumber>;
    furnished: z.ZodBoolean;
    /** The asking rent a month. */
    rentRwf: z.ZodNumber;
    /** Null means now. */
    availableFrom: z.ZodNullable<z.ZodString>;
    photos: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodEnum<["property", "unit"]>;
        caption: z.ZodNullable<z.ZodString>;
        width: z.ZodNullable<z.ZodNumber>;
        height: z.ZodNullable<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        kind: "property" | "unit";
        caption: string | null;
        width: number | null;
        height: number | null;
    }, {
        id: string;
        kind: "property" | "unit";
        caption: string | null;
        width: number | null;
        height: number | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    id: string;
    label: string;
    bedrooms: number | null;
    bathrooms: number | null;
    furnished: boolean;
    sizeSqm: number | null;
    rentRwf: number;
    photos: {
        id: string;
        kind: "property" | "unit";
        caption: string | null;
        width: number | null;
        height: number | null;
    }[];
    availableFrom: string | null;
}, {
    id: string;
    label: string;
    bedrooms: number | null;
    bathrooms: number | null;
    furnished: boolean;
    sizeSqm: number | null;
    rentRwf: number;
    photos: {
        id: string;
        kind: "property" | "unit";
        caption: string | null;
        width: number | null;
        height: number | null;
    }[];
    availableFrom: string | null;
}>;
export type ExploreUnit = z.infer<typeof ExploreUnit>;
/** `GET /explore/properties/:slug`: the property page, from real data only. */
export declare const ExplorePage: z.ZodObject<{
    card: z.ZodObject<{
        /** The property's id. */
        id: z.ZodString;
        slug: z.ZodString;
        name: z.ZodString;
        mode: z.ZodEnum<["stays", "homes"]>;
        type: z.ZodEnum<["hotel", "lodge", "guest_house", "tented_camp", "apartment", "villa", "stay", "home"]>;
        typeLabel: z.ZodString;
        /** "Gisenyi, Rubavu": the sector, then the district. Empty when the property is not placed. */
        where: z.ZodString;
        districtName: z.ZodNullable<z.ZodString>;
        /** Mean of the public guest reviews, one decimal. Null when there are none ("New"). */
        rating: z.ZodNullable<z.ZodNumber>;
        reviewCount: z.ZodNumber;
        /** The figure the card shows, on `priceBasis`. Null when nothing is priced ("Price on request"). */
        priceRwf: z.ZodNullable<z.ZodNumber>;
        priceBasis: z.ZodEnum<["party_night", "unit_night", "person_night", "month"]>;
        /** Stays: how the room the price comes from is booked. Null for homes. */
        bookingMode: z.ZodNullable<z.ZodEnum<["instant_book", "request_to_book"]>>;
        /** A request room: how long the host has to answer, from the booking domain's own window. */
        approvalWindowHours: z.ZodNullable<z.ZodNumber>;
        /** "N left" when 3 or fewer of the priced room remain for the chosen dates; null without dates. */
        roomsLeft: z.ZodNullable<z.ZodNumber>;
        /** Up to five, the cover first. */
        photos: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodEnum<["property", "unit"]>;
            caption: z.ZodNullable<z.ZodString>;
            width: z.ZodNullable<z.ZodNumber>;
            height: z.ZodNullable<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            kind: "property" | "unit";
            caption: string | null;
            width: number | null;
            height: number | null;
        }, {
            id: string;
            kind: "property" | "unit";
            caption: string | null;
            width: number | null;
            height: number | null;
        }>, "many">;
        /** The centre of a 0.01 degree cell when the property asked for location privacy (D-o). */
        latitude: z.ZodNullable<z.ZodNumber>;
        longitude: z.ZodNullable<z.ZodNumber>;
        locationApproximate: z.ZodBoolean;
        /** Homes: the first day a listed unit can be moved into; null means now. */
        availableFrom: z.ZodNullable<z.ZodString>;
        /** Homes: how many units are listed. */
        unitCount: z.ZodNullable<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        type: "hotel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "stay" | "home";
        name: string;
        id: string;
        bookingMode: "instant_book" | "request_to_book" | null;
        priceBasis: "month" | "party_night" | "unit_night" | "person_night";
        slug: string;
        districtName: string | null;
        mode: "stays" | "homes";
        priceRwf: number | null;
        rating: number | null;
        photos: {
            id: string;
            kind: "property" | "unit";
            caption: string | null;
            width: number | null;
            height: number | null;
        }[];
        availableFrom: string | null;
        latitude: number | null;
        longitude: number | null;
        typeLabel: string;
        where: string;
        reviewCount: number;
        approvalWindowHours: number | null;
        roomsLeft: number | null;
        locationApproximate: boolean;
        unitCount: number | null;
    }, {
        type: "hotel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "stay" | "home";
        name: string;
        id: string;
        bookingMode: "instant_book" | "request_to_book" | null;
        priceBasis: "month" | "party_night" | "unit_night" | "person_night";
        slug: string;
        districtName: string | null;
        mode: "stays" | "homes";
        priceRwf: number | null;
        rating: number | null;
        photos: {
            id: string;
            kind: "property" | "unit";
            caption: string | null;
            width: number | null;
            height: number | null;
        }[];
        availableFrom: string | null;
        latitude: number | null;
        longitude: number | null;
        typeLabel: string;
        where: string;
        reviewCount: number;
        approvalWindowHours: number | null;
        roomsLeft: number | null;
        locationApproximate: boolean;
        unitCount: number | null;
    }>;
    description: z.ZodNullable<z.ZodString>;
    /** "14:00", in the property's own clock. */
    checkInTime: z.ZodNullable<z.ZodString>;
    checkOutTime: z.ZodNullable<z.ZodString>;
    houseRules: z.ZodNullable<z.ZodString>;
    timezone: z.ZodString;
    /** Every property photograph, the cover first. */
    photos: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodEnum<["property", "unit"]>;
        caption: z.ZodNullable<z.ZodString>;
        width: z.ZodNullable<z.ZodNumber>;
        height: z.ZodNullable<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        kind: "property" | "unit";
        caption: string | null;
        width: number | null;
        height: number | null;
    }, {
        id: string;
        kind: "property" | "unit";
        caption: string | null;
        width: number | null;
        height: number | null;
    }>, "many">;
    /** Up to `EXPLORE_MAX_FACTS` of its amenities, in `EXPLORE_FACT_ORDER`. */
    facts: z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        label: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        code: string;
        label: string;
    }, {
        code: string;
        label: string;
    }>, "many">;
    /** Every amenity it lists, labelled. */
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
    /** Stays: every active room type a guest can book (never a `per_item` menu item), cheapest first, ties by id. Null for homes. */
    rooms: z.ZodNullable<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        /**
         * How many people it sleeps: `DEFAULT_CAPACITY` (4) when the host has not said, the figure the
         * booking refuses a larger party by. Nullable only for older answers.
         */
        sleeps: z.ZodNullable<z.ZodNumber>;
        roomCount: z.ZodNumber;
        /** Null, with a null basis, when the room has no price yet ("Price on request"). */
        priceRwf: z.ZodNullable<z.ZodNumber>;
        priceBasis: z.ZodNullable<z.ZodEnum<["party_night", "unit_night", "person_night", "month"]>>;
        bookingMode: z.ZodNullable<z.ZodEnum<["instant_book", "request_to_book"]>>;
        approvalWindowHours: z.ZodNullable<z.ZodNumber>;
        cancellationTier: z.ZodNullable<z.ZodEnum<["flexible", "moderate", "limited", "firm", "strict_extended_stay"]>>;
        /** The saver (non refundable) rate is offered on this room. */
        nonrefundableEligible: z.ZodBoolean;
        minStay: z.ZodNullable<z.ZodNumber>;
        /** The fewest free units over the chosen nights; null without dates, 0 is sold out. */
        freeUnits: z.ZodNullable<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
        roomCount: number;
        bookingMode: "instant_book" | "request_to_book" | null;
        cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
        nonrefundableEligible: boolean;
        priceBasis: "month" | "party_night" | "unit_night" | "person_night" | null;
        minStay: number | null;
        freeUnits: number | null;
        priceRwf: number | null;
        approvalWindowHours: number | null;
        sleeps: number | null;
    }, {
        name: string;
        id: string;
        roomCount: number;
        bookingMode: "instant_book" | "request_to_book" | null;
        cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
        nonrefundableEligible: boolean;
        priceBasis: "month" | "party_night" | "unit_night" | "person_night" | null;
        minStay: number | null;
        freeUnits: number | null;
        priceRwf: number | null;
        approvalWindowHours: number | null;
        sleeps: number | null;
    }>, "many">>;
    /** Homes: every listed unit, cheapest first. Null for stays. */
    units: z.ZodNullable<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        bedrooms: z.ZodNullable<z.ZodNumber>;
        bathrooms: z.ZodNullable<z.ZodNumber>;
        sizeSqm: z.ZodNullable<z.ZodNumber>;
        furnished: z.ZodBoolean;
        /** The asking rent a month. */
        rentRwf: z.ZodNumber;
        /** Null means now. */
        availableFrom: z.ZodNullable<z.ZodString>;
        photos: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodEnum<["property", "unit"]>;
            caption: z.ZodNullable<z.ZodString>;
            width: z.ZodNullable<z.ZodNumber>;
            height: z.ZodNullable<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            kind: "property" | "unit";
            caption: string | null;
            width: number | null;
            height: number | null;
        }, {
            id: string;
            kind: "property" | "unit";
            caption: string | null;
            width: number | null;
            height: number | null;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        id: string;
        label: string;
        bedrooms: number | null;
        bathrooms: number | null;
        furnished: boolean;
        sizeSqm: number | null;
        rentRwf: number;
        photos: {
            id: string;
            kind: "property" | "unit";
            caption: string | null;
            width: number | null;
            height: number | null;
        }[];
        availableFrom: string | null;
    }, {
        id: string;
        label: string;
        bedrooms: number | null;
        bathrooms: number | null;
        furnished: boolean;
        sizeSqm: number | null;
        rentRwf: number;
        photos: {
            id: string;
            kind: "property" | "unit";
            caption: string | null;
            width: number | null;
            height: number | null;
        }[];
        availableFrom: string | null;
    }>, "many">>;
    /** Stays: rooms over every active room type a guest can book, for "Hotel · 42 rooms". */
    roomCount: z.ZodNumber;
    business: z.ZodObject<{
        legalName: z.ZodString;
        /** Stays only: a home's landlord may be a private person (D-o). */
        tin: z.ZodNullable<z.ZodString>;
        /** True for every visible business: activation requires the field verified pass. */
        verified: z.ZodBoolean;
        /** When the latest registration review passed. */
        verifiedAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        verified: boolean;
        tin: string | null;
        legalName: string;
        verifiedAt: string | null;
    }, {
        verified: boolean;
        tin: string | null;
        legalName: string;
        verifiedAt: string | null;
    }>;
    shareUrl: z.ZodString;
}, "strip", z.ZodTypeAny, {
    business: {
        verified: boolean;
        tin: string | null;
        legalName: string;
        verifiedAt: string | null;
    };
    roomCount: number;
    checkInTime: string | null;
    checkOutTime: string | null;
    card: {
        type: "hotel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "stay" | "home";
        name: string;
        id: string;
        bookingMode: "instant_book" | "request_to_book" | null;
        priceBasis: "month" | "party_night" | "unit_night" | "person_night";
        slug: string;
        districtName: string | null;
        mode: "stays" | "homes";
        priceRwf: number | null;
        rating: number | null;
        photos: {
            id: string;
            kind: "property" | "unit";
            caption: string | null;
            width: number | null;
            height: number | null;
        }[];
        availableFrom: string | null;
        latitude: number | null;
        longitude: number | null;
        typeLabel: string;
        where: string;
        reviewCount: number;
        approvalWindowHours: number | null;
        roomsLeft: number | null;
        locationApproximate: boolean;
        unitCount: number | null;
    };
    description: string | null;
    rooms: {
        name: string;
        id: string;
        roomCount: number;
        bookingMode: "instant_book" | "request_to_book" | null;
        cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
        nonrefundableEligible: boolean;
        priceBasis: "month" | "party_night" | "unit_night" | "person_night" | null;
        minStay: number | null;
        freeUnits: number | null;
        priceRwf: number | null;
        approvalWindowHours: number | null;
        sleeps: number | null;
    }[] | null;
    photos: {
        id: string;
        kind: "property" | "unit";
        caption: string | null;
        width: number | null;
        height: number | null;
    }[];
    houseRules: string | null;
    timezone: string;
    facts: {
        code: string;
        label: string;
    }[];
    facilities: {
        code: string;
        label: string;
    }[];
    units: {
        id: string;
        label: string;
        bedrooms: number | null;
        bathrooms: number | null;
        furnished: boolean;
        sizeSqm: number | null;
        rentRwf: number;
        photos: {
            id: string;
            kind: "property" | "unit";
            caption: string | null;
            width: number | null;
            height: number | null;
        }[];
        availableFrom: string | null;
    }[] | null;
    shareUrl: string;
}, {
    business: {
        verified: boolean;
        tin: string | null;
        legalName: string;
        verifiedAt: string | null;
    };
    roomCount: number;
    checkInTime: string | null;
    checkOutTime: string | null;
    card: {
        type: "hotel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "stay" | "home";
        name: string;
        id: string;
        bookingMode: "instant_book" | "request_to_book" | null;
        priceBasis: "month" | "party_night" | "unit_night" | "person_night";
        slug: string;
        districtName: string | null;
        mode: "stays" | "homes";
        priceRwf: number | null;
        rating: number | null;
        photos: {
            id: string;
            kind: "property" | "unit";
            caption: string | null;
            width: number | null;
            height: number | null;
        }[];
        availableFrom: string | null;
        latitude: number | null;
        longitude: number | null;
        typeLabel: string;
        where: string;
        reviewCount: number;
        approvalWindowHours: number | null;
        roomsLeft: number | null;
        locationApproximate: boolean;
        unitCount: number | null;
    };
    description: string | null;
    rooms: {
        name: string;
        id: string;
        roomCount: number;
        bookingMode: "instant_book" | "request_to_book" | null;
        cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
        nonrefundableEligible: boolean;
        priceBasis: "month" | "party_night" | "unit_night" | "person_night" | null;
        minStay: number | null;
        freeUnits: number | null;
        priceRwf: number | null;
        approvalWindowHours: number | null;
        sleeps: number | null;
    }[] | null;
    photos: {
        id: string;
        kind: "property" | "unit";
        caption: string | null;
        width: number | null;
        height: number | null;
    }[];
    houseRules: string | null;
    timezone: string;
    facts: {
        code: string;
        label: string;
    }[];
    facilities: {
        code: string;
        label: string;
    }[];
    units: {
        id: string;
        label: string;
        bedrooms: number | null;
        bathrooms: number | null;
        furnished: boolean;
        sizeSqm: number | null;
        rentRwf: number;
        photos: {
            id: string;
            kind: "property" | "unit";
            caption: string | null;
            width: number | null;
            height: number | null;
        }[];
        availableFrom: string | null;
    }[] | null;
    shareUrl: string;
}>;
export type ExplorePage = z.infer<typeof ExplorePage>;
//# sourceMappingURL=explore.d.ts.map