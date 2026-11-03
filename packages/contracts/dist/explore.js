"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExplorePage = exports.ExploreUnit = exports.ExploreRoom = exports.ExplorePlaces = exports.ExplorePlace = exports.ExplorePlacesQuery = exports.ExploreSearchResult = exports.ExploreCard = exports.ExplorePhoto = exports.ExploreSearchQuery = exports.ExplorePlaceRef = exports.EXPLORE_SHARE_ORIGIN = exports.EXPLORE_MAX_PAGE_SIZE = exports.EXPLORE_PAGE_SIZE = exports.EXPLORE_MAX_FACTS = exports.EXPLORE_FACT_ORDER = exports.STORED_ACCOMMODATION_CLASSES = exports.EXPLORE_TYPES = exports.EXPLORE_TYPE_LABEL = exports.ExploreType = exports.ExplorePriceBasis = exports.ExploreSort = exports.ExploreMode = void 0;
exports.exploreTypeOf = exploreTypeOf;
const zod_1 = require("zod");
const booking_1 = require("./booking");
const primitives_1 = require("./primitives");
const rdb_1 = require("./rdb");
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
exports.ExploreMode = zod_1.z.enum(["stays", "homes"]);
/** Top rated (weighted by review count), or by the price the card shows. */
exports.ExploreSort = zod_1.z.enum(["top_rated", "price_asc", "price_desc"]);
/** What a price covers: the whole party a night, one person a night (no party yet), or a home a month. */
exports.ExplorePriceBasis = zod_1.z.enum(["party_night", "person_night", "month"]);
/** The chips a guest filters stays by, drawn from the business's registered class (D-i). */
exports.ExploreType = zod_1.z.enum(["hotel", "lodge", "guest_house", "tented_camp", "apartment", "villa", "stay", "home"]);
exports.EXPLORE_TYPE_LABEL = {
    hotel: "Hotel",
    lodge: "Lodge",
    guest_house: "Guest house",
    tented_camp: "Tented camp",
    apartment: "Apartment",
    villa: "Villa",
    stay: "Stay",
    home: "Home",
};
/**
 * Every class `orgs.accommodation_class` may hold, current or retired, mapped to its chip. Typed over
 * the whole stored vocabulary, so a class added to the contract without a chip fails to compile.
 */
exports.EXPLORE_TYPES = {
    hotel: "hotel",
    motel: "hotel",
    town_hotel: "hotel",
    vacation_hotel_resort: "hotel",
    lodge: "lodge",
    cottage: "lodge",
    guest_house: "guest_house",
    tented_camp: "tented_camp",
    apartment: "apartment",
    serviced_apartment: "apartment",
    villa: "villa",
    other: "stay",
};
/** Every stored accommodation class, current and retired, for the mapping's own test. */
exports.STORED_ACCOMMODATION_CLASSES = [
    ...rdb_1.AccommodationClass.options,
    ...rdb_1.RetiredAccommodationClass.options,
];
/** The chip of a stay's class; a null or unknown class is a plain "Stay". Every home is a "Home". */
function exploreTypeOf(mode, accommodationClass) {
    if (mode === "homes")
        return "home";
    if (accommodationClass && Object.prototype.hasOwnProperty.call(exports.EXPLORE_TYPES, accommodationClass)) {
        return exports.EXPLORE_TYPES[accommodationClass];
    }
    return "stay";
}
/**
 * The amenities a property page leads with, in this order, then the rest by label (D-m's facts).
 * Codes from the platform catalogue (`server/api/scripts/reference-data.mjs`).
 */
exports.EXPLORE_FACT_ORDER = [
    "view",
    "breakfast",
    "pool",
    "momo",
    "shuttle",
    "restaurant",
    "parking",
    "front24",
    "wifi",
];
/** How many facts a page shows. No fact is invented: a property with two amenities shows two. */
exports.EXPLORE_MAX_FACTS = 4;
/** Results a page of search carries by default, and at most. */
exports.EXPLORE_PAGE_SIZE = 20;
exports.EXPLORE_MAX_PAGE_SIZE = 50;
/** Where a shared property link points: the web's own property page (D-aa). */
exports.EXPLORE_SHARE_ORIGIN = "https://www.injishi.com";
/** A chosen suggestion: `district:12`, `sector:345` or `property:<slug>`. */
exports.ExplorePlaceRef = zod_1.z
    .string()
    .max(160)
    .regex(/^(district:\d{1,9}|sector:\d{1,9}|property:[^\s:]{1,140})$/, "expected district:<id>, sector:<id> or property:<slug>");
/** `GET /explore/search` (milestone 1: place or text, mode, sort and paging). */
exports.ExploreSearchQuery = zod_1.z.object({
    mode: exports.ExploreMode.default("stays"),
    /** Free text over the property's name, its sector and its district, ignoring case. */
    q: zod_1.z.string().trim().max(80).optional(),
    /** A suggestion the guest picked; wins over `q` for the area. */
    place: exports.ExplorePlaceRef.optional(),
    sort: exports.ExploreSort.default("top_rated"),
    /** Opaque: the last row's sort key, the frozen platform mean and the filters it was made for. */
    cursor: zod_1.z.string().max(600).optional(),
    limit: zod_1.z.coerce.number().int().min(1).max(exports.EXPLORE_MAX_PAGE_SIZE).default(exports.EXPLORE_PAGE_SIZE),
});
/**
 * One photograph on the wire. The phone builds its URL from the id and the kind (`photoUrl`), in one
 * place; an object key never leaves the API. Width and height are null for an original.
 */
exports.ExplorePhoto = zod_1.z.object({
    id: primitives_1.Uuid,
    kind: zod_1.z.enum(["property", "unit"]),
    caption: zod_1.z.string().nullable(),
    width: zod_1.z.number().int().positive().nullable(),
    height: zod_1.z.number().int().positive().nullable(),
});
exports.ExploreCard = zod_1.z.object({
    /** The property's id. */
    id: primitives_1.Uuid,
    slug: zod_1.z.string().min(1),
    name: zod_1.z.string().min(1),
    mode: exports.ExploreMode,
    type: exports.ExploreType,
    typeLabel: zod_1.z.string(),
    /** "Gisenyi, Rubavu": the sector, then the district. Empty when the property is not placed. */
    where: zod_1.z.string(),
    districtName: zod_1.z.string().nullable(),
    /** Mean of the public guest reviews, one decimal. Null when there are none ("New"). */
    rating: zod_1.z.number().min(0).max(5).nullable(),
    reviewCount: zod_1.z.number().int().nonnegative(),
    /** The figure the card shows, on `priceBasis`. Null when nothing is priced ("Price on request"). */
    priceRwf: primitives_1.RwfAmount.nullable(),
    priceBasis: exports.ExplorePriceBasis,
    /** Stays: how the room the price comes from is booked. Null for homes. */
    bookingMode: booking_1.BookingMode.nullable(),
    /** A request room: how long the host has to answer, from the booking domain's own window. */
    approvalWindowHours: zod_1.z.number().int().positive().nullable(),
    /** "N left" when 3 or fewer of the priced room remain for the chosen dates; null without dates. */
    roomsLeft: zod_1.z.number().int().min(0).max(3).nullable(),
    /** Up to five, the cover first. */
    photos: zod_1.z.array(exports.ExplorePhoto).max(5),
    /** The centre of a 0.01 degree cell when the property asked for location privacy (D-o). */
    latitude: zod_1.z.number().nullable(),
    longitude: zod_1.z.number().nullable(),
    locationApproximate: zod_1.z.boolean(),
    /** Homes: the first day a listed unit can be moved into; null means now. */
    availableFrom: booking_1.IsoDate.nullable(),
    /** Homes: how many units are listed. */
    unitCount: zod_1.z.number().int().nonnegative().nullable(),
});
exports.ExploreSearchResult = zod_1.z.object({
    results: zod_1.z.array(exports.ExploreCard),
    /** Null at the end. */
    nextCursor: zod_1.z.string().nullable(),
    /** Every match for this search, counted with the same filters. */
    total: zod_1.z.number().int().nonnegative(),
});
/** `GET /explore/places`: suggestions for two letters or more. */
exports.ExplorePlacesQuery = zod_1.z.object({
    q: zod_1.z.string().trim().min(2).max(40),
    mode: exports.ExploreMode.default("stays"),
});
exports.ExplorePlace = zod_1.z.object({
    kind: zod_1.z.enum(["district", "sector", "property"]),
    /** The district's or sector's id, or the property's id. */
    id: zod_1.z.string().min(1),
    label: zod_1.z.string().min(1),
    /** "12 stays" for an area; "Gisenyi, Rubavu" for a property. */
    sub: zod_1.z.string(),
    /** A property's public slug; null for an area. */
    slug: zod_1.z.string().nullable(),
    /** What `place` takes to filter by this suggestion. */
    ref: exports.ExplorePlaceRef,
});
exports.ExplorePlaces = zod_1.z.object({ places: zod_1.z.array(exports.ExplorePlace).max(8) });
/** A room type on a stay's page, priced on the same basis as the card. */
exports.ExploreRoom = zod_1.z.object({
    id: primitives_1.Uuid,
    name: zod_1.z.string().min(1),
    /** How many people it sleeps; null when the host has not said. */
    sleeps: zod_1.z.number().int().positive().nullable(),
    roomCount: zod_1.z.number().int().nonnegative(),
    priceRwf: primitives_1.RwfAmount.nullable(),
    priceBasis: exports.ExplorePriceBasis,
    bookingMode: booking_1.BookingMode.nullable(),
    approvalWindowHours: zod_1.z.number().int().positive().nullable(),
    cancellationTier: booking_1.CancellationTier.nullable(),
    /** The saver (non refundable) rate is offered on this room. */
    nonrefundableEligible: zod_1.z.boolean(),
    minStay: zod_1.z.number().int().positive().nullable(),
    /** The fewest free units over the chosen nights; null without dates, 0 is sold out. */
    freeUnits: zod_1.z.number().int().nonnegative().nullable(),
});
/** A listed unit on a home's page. */
exports.ExploreUnit = zod_1.z.object({
    id: primitives_1.Uuid,
    label: zod_1.z.string().min(1),
    bedrooms: zod_1.z.number().int().nonnegative().nullable(),
    bathrooms: zod_1.z.number().int().nonnegative().nullable(),
    sizeSqm: zod_1.z.number().int().positive().nullable(),
    furnished: zod_1.z.boolean(),
    /** The asking rent a month. */
    rentRwf: primitives_1.RwfAmount,
    /** Null means now. */
    availableFrom: booking_1.IsoDate.nullable(),
    photos: zod_1.z.array(exports.ExplorePhoto),
});
/** `GET /explore/properties/:slug`: the property page, from real data only. */
exports.ExplorePage = zod_1.z.object({
    card: exports.ExploreCard,
    description: zod_1.z.string().nullable(),
    /** "14:00", in the property's own clock. */
    checkInTime: zod_1.z.string().nullable(),
    checkOutTime: zod_1.z.string().nullable(),
    houseRules: zod_1.z.string().nullable(),
    timezone: zod_1.z.string(),
    /** Every property photograph, the cover first. */
    photos: zod_1.z.array(exports.ExplorePhoto),
    /** Up to `EXPLORE_MAX_FACTS` of its amenities, in `EXPLORE_FACT_ORDER`. */
    facts: zod_1.z.array(zod_1.z.object({ code: zod_1.z.string(), label: zod_1.z.string() })).max(exports.EXPLORE_MAX_FACTS),
    /** Every amenity it lists, labelled. */
    facilities: zod_1.z.array(zod_1.z.object({ code: zod_1.z.string(), label: zod_1.z.string() })),
    /** Stays: every active room type, cheapest first. Null for homes. */
    rooms: zod_1.z.array(exports.ExploreRoom).nullable(),
    /** Homes: every listed unit, cheapest first. Null for stays. */
    units: zod_1.z.array(exports.ExploreUnit).nullable(),
    /** Stays: rooms over every active room type, for "Hotel · 42 rooms". */
    roomCount: zod_1.z.number().int().nonnegative(),
    business: zod_1.z.object({
        legalName: zod_1.z.string(),
        /** Stays only: a home's landlord may be a private person (D-o). */
        tin: zod_1.z.string().nullable(),
        /** True for every visible business: activation requires the field verified pass. */
        verified: zod_1.z.boolean(),
        /** When the latest registration review passed. */
        verifiedAt: zod_1.z.string().nullable(),
    }),
    shareUrl: zod_1.z.string().url(),
});
//# sourceMappingURL=explore.js.map