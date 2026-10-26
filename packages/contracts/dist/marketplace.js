"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MyBusinesses = exports.MyBusinessPlace = exports.MyTripFacts = exports.GuestTripFacts = exports.TripPayment = exports.GuestContactInput = exports.GuestContact = exports.GuestLocale = exports.ConsentInput = exports.MyConsents = exports.ConsentChoice = exports.REQUIRED_CONSENTS = exports.CONSENT_POLICY_VERSION = exports.ConsentPurpose = exports.CollectionItemInput = exports.CollectionInput = exports.MyCollections = exports.GuestCollection = exports.CollectionVisibility = exports.MySaved = exports.SavedPlace = exports.MarketPropertyPage = exports.MarketGalleryPhoto = exports.MarketRuleItem = exports.MarketNearby = exports.MarketHighlight = exports.MarketQuote = exports.MarketQuoteQuery = exports.MarketRooms = exports.MarketRoomCard = exports.MarketCatalogue = exports.MarketListingCard = exports.MarketStockPhoto = exports.MarketPropertyKind = void 0;
const zod_1 = require("zod");
const booking_1 = require("./booking");
const primitives_1 = require("./primitives");
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
exports.MarketPropertyKind = zod_1.z.enum(["hotel", "lodge", "tented", "guest", "apartment", "villa", "house", "studio"]);
/** A key into the interface's licensed stock picture library, the only pictures it renders today. */
exports.MarketStockPhoto = zod_1.z.string().min(1).max(80);
// ---------------------------------------------------------------------------
// The catalogue (public)
// ---------------------------------------------------------------------------
exports.MarketListingCard = zod_1.z.object({
    /** The property's id. */
    id: primitives_1.Uuid,
    slug: zod_1.z.string().min(1),
    name: zod_1.z.string().min(1),
    domain: primitives_1.Domain,
    kind: exports.MarketPropertyKind,
    /** "Gisenyi, Rubavu": the sector and district, as the property is filed. */
    where: zod_1.z.string(),
    districtName: zod_1.z.string().nullable(),
    /** The business the guest contracts with. */
    legalName: zod_1.z.string(),
    /** Stays: the cheapest active room's nightly rate. Homes: the cheapest unit's monthly rent. */
    priceRwf: zod_1.z.number().int().nonnegative().nullable(),
    /** Mean of the visible guest reviews, one decimal. Null when there are none. */
    rating: zod_1.z.number().nullable(),
    reviewCount: zod_1.z.number().int().nonnegative(),
    /** How the cheapest room is booked. Null for homes, which are let, not booked. */
    bookingMode: booking_1.BookingMode.nullable(),
    /** How long a host has to answer a request, from the booking domain's own window. */
    approvalWindowHours: zod_1.z.number().int().positive().nullable(),
    stockPhoto: exports.MarketStockPhoto,
    caption: zod_1.z.string(),
    /** Amenity codes (the platform's `amenities` catalogue). */
    amenities: zod_1.z.array(zod_1.z.string()),
    latitude: zod_1.z.number().nullable(),
    longitude: zod_1.z.number().nullable(),
    bedrooms: zod_1.z.number().int().nonnegative().nullable(),
    floorAreaSqm: zod_1.z.number().int().positive().nullable(),
    /** Homes: the first day a tenant may move in. Null means now. */
    availableFrom: booking_1.IsoDate.nullable(),
    /** The card carries a page's own copy (highlights or a gallery), so a property page can be drawn. */
    hasPage: zod_1.z.boolean(),
});
exports.MarketCatalogue = zod_1.z.object({ listings: zod_1.z.array(exports.MarketListingCard) });
exports.MarketRoomCard = zod_1.z.object({
    /** The room type's id: what a booking is made against. */
    id: primitives_1.Uuid,
    propertySlug: zod_1.z.string().min(1),
    name: zod_1.z.string().min(1),
    /** Nightly rate per guest, from the default rate plan or the room type. */
    priceRwf: zod_1.z.number().int().nonnegative().nullable(),
    bed: zod_1.z.string(),
    sizeSqm: zod_1.z.number().int().positive().nullable(),
    highlight: zod_1.z.string(),
    sleeps: zod_1.z.number().int().positive().nullable(),
    /** Bookable units of this room type. */
    roomCount: zod_1.z.number().int().nonnegative(),
    bookingMode: booking_1.BookingMode.nullable(),
    /** A request room: how long the host has to answer, from the booking domain's own window. */
    approvalWindowHours: zod_1.z.number().int().positive().nullable(),
    cancellationTier: booking_1.CancellationTier.nullable(),
    /** Whether the non-refundable (saver) rate is offered on this room. */
    nonrefundableEligible: zod_1.z.boolean(),
    maxAdults: zod_1.z.number().int().nonnegative().nullable(),
    maxChildren: zod_1.z.number().int().nonnegative().nullable(),
    stockPhoto: exports.MarketStockPhoto,
});
exports.MarketRooms = zod_1.z.object({ rooms: zod_1.z.array(exports.MarketRoomCard) });
/** `GET /marketplace/quote`: what a stay would cost, before anyone signs in. */
exports.MarketQuoteQuery = zod_1.z.object({
    roomTypeId: primitives_1.Uuid,
    checkIn: booking_1.IsoDate,
    checkOut: booking_1.IsoDate,
    guests: zod_1.z.coerce.number().int().positive().max(50),
});
/**
 * A priced stay, computed by the same `computeBreakdown` the booking service charges with, so the
 * checkout never shows a total the charge disagrees with. The refund schedule is the room's
 * cancellation tier laid over this check-in (`CANCELLATION_TIERS`).
 */
exports.MarketQuote = zod_1.z.object({
    roomTypeId: primitives_1.Uuid,
    roomName: zod_1.z.string(),
    propertySlug: zod_1.z.string().nullable(),
    /** The business the guest pays and contracts with. */
    legalName: zod_1.z.string(),
    checkIn: booking_1.IsoDate,
    checkOut: booking_1.IsoDate,
    guests: zod_1.z.number().int().positive(),
    breakdown: booking_1.MoneyBreakdown,
    bookingMode: booking_1.BookingMode.nullable(),
    approvalWindowHours: zod_1.z.number().int().positive().nullable(),
    cancellationTier: booking_1.CancellationTier,
    /** In order: each step's refund percent and the instant it ends (null: until check-in and after). */
    refunds: zod_1.z.array(zod_1.z.object({ percent: zod_1.z.number().int().min(0).max(100), until: zod_1.z.string().nullable() })),
    /** VAT included in the price, percent (the EBM receipt's rate). */
    vatRatePercent: zod_1.z.number().int().nonnegative(),
    checkInTime: zod_1.z.string().nullable(),
    checkOutTime: zod_1.z.string().nullable(),
});
exports.MarketHighlight = zod_1.z.object({ icon: zod_1.z.string().min(1), title: zod_1.z.string().min(1), desc: zod_1.z.string() });
exports.MarketNearby = zod_1.z.object({ place: zod_1.z.string().min(1), distance: zod_1.z.string().min(1) });
exports.MarketRuleItem = zod_1.z.object({ label: zod_1.z.string().min(1), value: zod_1.z.string().min(1) });
exports.MarketGalleryPhoto = zod_1.z.object({ photo: exports.MarketStockPhoto, caption: zod_1.z.string() });
/** The property page: the card, the page's own copy, the business behind it and the room cards. */
exports.MarketPropertyPage = zod_1.z.object({
    card: exports.MarketListingCard,
    description: zod_1.z.string().nullable(),
    checkInTime: zod_1.z.string().nullable(),
    checkOutTime: zod_1.z.string().nullable(),
    /** The house rules as the property wrote them (the prose every other route serves). */
    houseRules: zod_1.z.string().nullable(),
    houseRuleItems: zod_1.z.array(exports.MarketRuleItem),
    highlights: zod_1.z.array(exports.MarketHighlight),
    nearby: zod_1.z.array(exports.MarketNearby),
    mapLabel: zod_1.z.string().nullable(),
    gallery: zod_1.z.array(exports.MarketGalleryPhoto),
    /** The amenities the property lists, labelled. */
    facilities: zod_1.z.array(zod_1.z.object({ code: zod_1.z.string(), label: zod_1.z.string() })),
    /** Rooms (units) at the property, for "Hotel · 42 rooms". */
    roomCount: zod_1.z.number().int().nonnegative(),
    /** The non-refundable (saver) rate's discount, a fraction (`NON_REFUNDABLE_DISCOUNT`). */
    nonRefundableDiscount: zod_1.z.number().min(0).max(1),
    business: zod_1.z.object({
        legalName: zod_1.z.string(),
        tin: zod_1.z.string().nullable(),
        upi: zod_1.z.string().nullable(),
        /** When the business's registration was approved. */
        verifiedAt: zod_1.z.string().nullable(),
        /** The latest active operating licence's expiry. */
        licenceValidTo: booking_1.IsoDate.nullable(),
        /** The business's other published properties, by name. */
        otherProperties: zod_1.z.array(zod_1.z.string()),
    }),
    rooms: zod_1.z.array(exports.MarketRoomCard),
});
// ---------------------------------------------------------------------------
// Saved places and collections (ADR-032, F-B16)
// ---------------------------------------------------------------------------
exports.SavedPlace = zod_1.z.object({
    propertyId: primitives_1.Uuid,
    slug: zod_1.z.string().nullable(),
    name: zod_1.z.string(),
    where: zod_1.z.string(),
    domain: primitives_1.Domain,
    kind: exports.MarketPropertyKind.nullable(),
    stockPhoto: exports.MarketStockPhoto.nullable(),
    /** The price today, as the card states it. */
    priceRwf: zod_1.z.number().int().nonnegative().nullable(),
    /** The price when it was saved. */
    savedPriceRwf: zod_1.z.number().int().nonnegative().nullable(),
    /** False when the listing is no longer public: rendered as unavailable, never dropped (F-B16 §9). */
    available: zod_1.z.boolean(),
    bookingMode: booking_1.BookingMode.nullable(),
    availableFrom: booking_1.IsoDate.nullable(),
    savedAt: zod_1.z.string(),
});
/** `GET /me/saved`: everything the person saved, newest first, across every list. */
exports.MySaved = zod_1.z.object({ saved: zod_1.z.array(exports.SavedPlace) });
exports.CollectionVisibility = zod_1.z.enum(["private", "shared"]);
exports.GuestCollection = zod_1.z.object({
    id: primitives_1.Uuid,
    name: zod_1.z.string(),
    visibility: exports.CollectionVisibility,
    /** The list the heart writes into. */
    isDefault: zod_1.z.boolean(),
    createdAt: zod_1.z.string(),
    items: zod_1.z.array(exports.SavedPlace),
});
exports.MyCollections = zod_1.z.object({ collections: zod_1.z.array(exports.GuestCollection) });
/** Duplicate names are allowed (F-B16 §9): a name is for display, never an identity. */
exports.CollectionInput = zod_1.z.object({ name: zod_1.z.string().trim().min(1).max(80) }).strict();
exports.CollectionItemInput = zod_1.z.object({ propertyId: primitives_1.Uuid }).strict();
// ---------------------------------------------------------------------------
// Consent (append-only)
// ---------------------------------------------------------------------------
exports.ConsentPurpose = zod_1.z.enum([
    "booking_messages",
    "share_phone_with_hosts",
    "review_reminders",
    "marketing_offers",
    "personalisation",
]);
/** The privacy notice a choice is recorded under. */
exports.CONSENT_POLICY_VERSION = "privacy-2.1";
/** Booking messages carry the booking itself; they are never optional. */
exports.REQUIRED_CONSENTS = ["booking_messages"];
exports.ConsentChoice = zod_1.z.object({
    purpose: exports.ConsentPurpose,
    granted: zod_1.z.boolean(),
    required: zod_1.z.boolean(),
    /** When the person last chose. Null when they never have (the default applies: off, unless required). */
    recordedAt: zod_1.z.string().nullable(),
});
exports.MyConsents = zod_1.z.object({ policyVersion: zod_1.z.string(), consents: zod_1.z.array(exports.ConsentChoice) });
exports.ConsentInput = zod_1.z.object({ purpose: exports.ConsentPurpose, granted: zod_1.z.boolean() }).strict();
// ---------------------------------------------------------------------------
// The guest's contact details (account page)
// ---------------------------------------------------------------------------
exports.GuestLocale = zod_1.z.enum(["en", "rw", "fr"]);
exports.GuestContact = zod_1.z.object({
    name: zod_1.z.string(),
    email: zod_1.z.string(),
    phone: zod_1.z.string().nullable(),
    country: zod_1.z.string().length(2),
    countryName: zod_1.z.string(),
    locale: exports.GuestLocale,
    /** A non-Rwandan address is one free line (D24). */
    address: zod_1.z.string().nullable(),
    joinedAt: zod_1.z.string(),
    /** How the person signs in: "email_code", "google". */
    signInMethods: zod_1.z.array(zod_1.z.string()),
});
exports.GuestContactInput = zod_1.z
    .object({
    name: zod_1.z.string().trim().min(1).max(120),
    /** Digits and the punctuation people type around them. Empty clears it. */
    phone: zod_1.z
        .string()
        .trim()
        .max(32)
        .regex(/^[+0-9 ()-]*$/, "expected a phone number"),
    /** A country code (KE) or its English name (Kenya); the API resolves either, and refuses anything else. */
    country: zod_1.z.string().trim().min(2).max(60),
    locale: exports.GuestLocale,
})
    .strict();
// ---------------------------------------------------------------------------
// Trip facts: what the account's trip cards say beside `/me/trips`
// ---------------------------------------------------------------------------
exports.TripPayment = zod_1.z.object({
    instrumentKind: zod_1.z.enum(["mobile_money", "card"]).nullable(),
    network: booking_1.MobileMoneyNetwork.nullable(),
    payerMasked: zod_1.z.string().nullable(),
    /** The provider's reference for the capture. */
    providerRef: zod_1.z.string().nullable(),
    amountRwf: zod_1.z.number().int().nonnegative().nullable(),
    settledAt: zod_1.z.string().nullable(),
});
exports.GuestTripFacts = zod_1.z.object({
    reference: zod_1.z.string().min(1),
    /** The business the stay is contracted with. */
    legalName: zod_1.z.string(),
    /** The property's marketplace picture, when it has a card (published or not). */
    stockPhoto: exports.MarketStockPhoto.nullable(),
    /** A request: when it lapses if the host has not answered. */
    approvalExpiresAt: zod_1.z.string().nullable(),
    payment: exports.TripPayment.nullable(),
    refundRwf: zod_1.z.number().int().nonnegative().nullable(),
    cancelledAt: zod_1.z.string().nullable(),
    /** When the guest sent their pre-arrival details, if they have. */
    preArrivalSubmittedAt: zod_1.z.string().nullable(),
});
exports.MyTripFacts = zod_1.z.object({ trips: zod_1.z.array(exports.GuestTripFacts) });
// ---------------------------------------------------------------------------
// The businesses a person works at (the help centre's contact form)
// ---------------------------------------------------------------------------
/** One branch the person works at: every branch of their org, or only those their membership is limited to. */
exports.MyBusinessPlace = zod_1.z.object({
    propertyId: primitives_1.Uuid,
    propertyName: zod_1.z.string(),
    legalName: zod_1.z.string(),
    orgId: primitives_1.Uuid,
    role: zod_1.z.string(),
});
exports.MyBusinesses = zod_1.z.object({ businesses: zod_1.z.array(exports.MyBusinessPlace) });
//# sourceMappingURL=marketplace.js.map