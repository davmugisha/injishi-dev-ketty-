import { z } from "zod";
import { BookingMode, CancellationTier, IsoDate, MobileMoneyNetwork, MoneyBreakdown } from "./booking";
import { Domain, Uuid } from "./primitives";

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
export const MarketPropertyKind = z.enum(["hotel", "lodge", "tented", "guest", "apartment", "villa", "house", "studio"]);
export type MarketPropertyKind = z.infer<typeof MarketPropertyKind>;

/** A key into the interface's licensed stock picture library, the only pictures it renders today. */
export const MarketStockPhoto = z.string().min(1).max(80);

// ---------------------------------------------------------------------------
// The catalogue (public)
// ---------------------------------------------------------------------------

export const MarketListingCard = z.object({
  /** The property's id. */
  id: Uuid,
  slug: z.string().min(1),
  name: z.string().min(1),
  domain: Domain,
  kind: MarketPropertyKind,
  /** "Gisenyi, Rubavu": the sector and district, as the property is filed. */
  where: z.string(),
  districtName: z.string().nullable(),
  /** The business the guest contracts with. */
  legalName: z.string(),
  /** Stays: the cheapest active room's nightly rate. Homes: the cheapest unit's monthly rent. */
  priceRwf: z.number().int().nonnegative().nullable(),
  /** Mean of the visible guest reviews, one decimal. Null when there are none. */
  rating: z.number().nullable(),
  reviewCount: z.number().int().nonnegative(),
  /** How the cheapest room is booked. Null for homes, which are let, not booked. */
  bookingMode: BookingMode.nullable(),
  /** How long a host has to answer a request, from the booking domain's own window. */
  approvalWindowHours: z.number().int().positive().nullable(),
  stockPhoto: MarketStockPhoto,
  caption: z.string(),
  /** Amenity codes (the platform's `amenities` catalogue). */
  amenities: z.array(z.string()),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  bedrooms: z.number().int().nonnegative().nullable(),
  floorAreaSqm: z.number().int().positive().nullable(),
  /** Homes: the first day a tenant may move in. Null means now. */
  availableFrom: IsoDate.nullable(),
  /** The card carries a page's own copy (highlights or a gallery), so a property page can be drawn. */
  hasPage: z.boolean(),
});
export type MarketListingCard = z.infer<typeof MarketListingCard>;

export const MarketCatalogue = z.object({ listings: z.array(MarketListingCard) });
export type MarketCatalogue = z.infer<typeof MarketCatalogue>;

export const MarketRoomCard = z.object({
  /** The room type's id: what a booking is made against. */
  id: Uuid,
  propertySlug: z.string().min(1),
  name: z.string().min(1),
  /** Nightly rate per guest, from the default rate plan or the room type. */
  priceRwf: z.number().int().nonnegative().nullable(),
  bed: z.string(),
  sizeSqm: z.number().int().positive().nullable(),
  highlight: z.string(),
  sleeps: z.number().int().positive().nullable(),
  /** Bookable units of this room type. */
  roomCount: z.number().int().nonnegative(),
  bookingMode: BookingMode.nullable(),
  /** A request room: how long the host has to answer, from the booking domain's own window. */
  approvalWindowHours: z.number().int().positive().nullable(),
  cancellationTier: CancellationTier.nullable(),
  /** Whether the non-refundable (saver) rate is offered on this room. */
  nonrefundableEligible: z.boolean(),
  maxAdults: z.number().int().nonnegative().nullable(),
  maxChildren: z.number().int().nonnegative().nullable(),
  stockPhoto: MarketStockPhoto,
});
export type MarketRoomCard = z.infer<typeof MarketRoomCard>;

export const MarketRooms = z.object({ rooms: z.array(MarketRoomCard) });
export type MarketRooms = z.infer<typeof MarketRooms>;

/** `GET /marketplace/quote`: what a stay would cost, before anyone signs in. */
export const MarketQuoteQuery = z.object({
  roomTypeId: Uuid,
  checkIn: IsoDate,
  checkOut: IsoDate,
  guests: z.coerce.number().int().positive().max(50),
});
export type MarketQuoteQuery = z.infer<typeof MarketQuoteQuery>;

/**
 * A priced stay, computed by the same `computeBreakdown` the booking service charges with, so the
 * checkout never shows a total the charge disagrees with. The refund schedule is the room's
 * cancellation tier laid over this check-in (`CANCELLATION_TIERS`).
 */
export const MarketQuote = z.object({
  roomTypeId: Uuid,
  roomName: z.string(),
  propertySlug: z.string().nullable(),
  /** The business the guest pays and contracts with. */
  legalName: z.string(),
  checkIn: IsoDate,
  checkOut: IsoDate,
  guests: z.number().int().positive(),
  breakdown: MoneyBreakdown,
  bookingMode: BookingMode.nullable(),
  approvalWindowHours: z.number().int().positive().nullable(),
  cancellationTier: CancellationTier,
  /** In order: each step's refund percent and the instant it ends (null: until check-in and after). */
  refunds: z.array(z.object({ percent: z.number().int().min(0).max(100), until: z.string().nullable() })),
  /** VAT included in the price, percent (the EBM receipt's rate). */
  vatRatePercent: z.number().int().nonnegative(),
  checkInTime: z.string().nullable(),
  checkOutTime: z.string().nullable(),
});
export type MarketQuote = z.infer<typeof MarketQuote>;

export const MarketHighlight = z.object({ icon: z.string().min(1), title: z.string().min(1), desc: z.string() });
export const MarketNearby = z.object({ place: z.string().min(1), distance: z.string().min(1) });
export const MarketRuleItem = z.object({ label: z.string().min(1), value: z.string().min(1) });
export const MarketGalleryPhoto = z.object({ photo: MarketStockPhoto, caption: z.string() });

/** The property page: the card, the page's own copy, the business behind it and the room cards. */
export const MarketPropertyPage = z.object({
  card: MarketListingCard,
  description: z.string().nullable(),
  checkInTime: z.string().nullable(),
  checkOutTime: z.string().nullable(),
  /** The house rules as the property wrote them (the prose every other route serves). */
  houseRules: z.string().nullable(),
  houseRuleItems: z.array(MarketRuleItem),
  highlights: z.array(MarketHighlight),
  nearby: z.array(MarketNearby),
  mapLabel: z.string().nullable(),
  gallery: z.array(MarketGalleryPhoto),
  /** The amenities the property lists, labelled. */
  facilities: z.array(z.object({ code: z.string(), label: z.string() })),
  /** Rooms (units) at the property, for "Hotel · 42 rooms". */
  roomCount: z.number().int().nonnegative(),
  /** The non-refundable (saver) rate's discount, a fraction (`NON_REFUNDABLE_DISCOUNT`). */
  nonRefundableDiscount: z.number().min(0).max(1),
  business: z.object({
    legalName: z.string(),
    tin: z.string().nullable(),
    upi: z.string().nullable(),
    /** When the business's registration was approved. */
    verifiedAt: z.string().nullable(),
    /** The latest active operating licence's expiry. */
    licenceValidTo: IsoDate.nullable(),
    /** The business's other published properties, by name. */
    otherProperties: z.array(z.string()),
  }),
  rooms: z.array(MarketRoomCard),
});
export type MarketPropertyPage = z.infer<typeof MarketPropertyPage>;

// ---------------------------------------------------------------------------
// Saved places and collections (ADR-032, F-B16)
// ---------------------------------------------------------------------------

export const SavedPlace = z.object({
  propertyId: Uuid,
  slug: z.string().nullable(),
  name: z.string(),
  where: z.string(),
  domain: Domain,
  kind: MarketPropertyKind.nullable(),
  stockPhoto: MarketStockPhoto.nullable(),
  /** The price today, as the card states it. */
  priceRwf: z.number().int().nonnegative().nullable(),
  /** The price when it was saved. */
  savedPriceRwf: z.number().int().nonnegative().nullable(),
  /** False when the listing is no longer public: rendered as unavailable, never dropped (F-B16 §9). */
  available: z.boolean(),
  bookingMode: BookingMode.nullable(),
  availableFrom: IsoDate.nullable(),
  savedAt: z.string(),
});
export type SavedPlace = z.infer<typeof SavedPlace>;

/** `GET /me/saved`: everything the person saved, newest first, across every list. */
export const MySaved = z.object({ saved: z.array(SavedPlace) });
export type MySaved = z.infer<typeof MySaved>;

export const CollectionVisibility = z.enum(["private", "shared"]);
export const GuestCollection = z.object({
  id: Uuid,
  name: z.string(),
  visibility: CollectionVisibility,
  /** The list the heart writes into. */
  isDefault: z.boolean(),
  createdAt: z.string(),
  items: z.array(SavedPlace),
});
export type GuestCollection = z.infer<typeof GuestCollection>;

export const MyCollections = z.object({ collections: z.array(GuestCollection) });
export type MyCollections = z.infer<typeof MyCollections>;

/** Duplicate names are allowed (F-B16 §9): a name is for display, never an identity. */
export const CollectionInput = z.object({ name: z.string().trim().min(1).max(80) }).strict();
export type CollectionInput = z.infer<typeof CollectionInput>;

export const CollectionItemInput = z.object({ propertyId: Uuid }).strict();
export type CollectionItemInput = z.infer<typeof CollectionItemInput>;

// ---------------------------------------------------------------------------
// Consent (append-only)
// ---------------------------------------------------------------------------

export const ConsentPurpose = z.enum([
  "booking_messages",
  "share_phone_with_hosts",
  "review_reminders",
  "marketing_offers",
  "personalisation",
]);
export type ConsentPurpose = z.infer<typeof ConsentPurpose>;

/** The privacy notice a choice is recorded under. */
export const CONSENT_POLICY_VERSION = "privacy-2.1";

/** Booking messages carry the booking itself; they are never optional. */
export const REQUIRED_CONSENTS: readonly ConsentPurpose[] = ["booking_messages"];

export const ConsentChoice = z.object({
  purpose: ConsentPurpose,
  granted: z.boolean(),
  required: z.boolean(),
  /** When the person last chose. Null when they never have (the default applies: off, unless required). */
  recordedAt: z.string().nullable(),
});
export type ConsentChoice = z.infer<typeof ConsentChoice>;

export const MyConsents = z.object({ policyVersion: z.string(), consents: z.array(ConsentChoice) });
export type MyConsents = z.infer<typeof MyConsents>;

export const ConsentInput = z.object({ purpose: ConsentPurpose, granted: z.boolean() }).strict();
export type ConsentInput = z.infer<typeof ConsentInput>;

// ---------------------------------------------------------------------------
// The guest's contact details (account page)
// ---------------------------------------------------------------------------

export const GuestLocale = z.enum(["en", "rw", "fr"]);
export type GuestLocale = z.infer<typeof GuestLocale>;

export const GuestContact = z.object({
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  country: z.string().length(2),
  countryName: z.string(),
  locale: GuestLocale,
  /** A non-Rwandan address is one free line (D24). */
  address: z.string().nullable(),
  joinedAt: z.string(),
  /** How the person signs in: "email_code", "google". */
  signInMethods: z.array(z.string()),
});
export type GuestContact = z.infer<typeof GuestContact>;

export const GuestContactInput = z
  .object({
    name: z.string().trim().min(1).max(120),
    /** Digits and the punctuation people type around them. Empty clears it. */
    phone: z
      .string()
      .trim()
      .max(32)
      .regex(/^[+0-9 ()-]*$/, "expected a phone number"),
    /** A country code (KE) or its English name (Kenya); the API resolves either, and refuses anything else. */
    country: z.string().trim().min(2).max(60),
    locale: GuestLocale,
  })
  .strict();
export type GuestContactInput = z.infer<typeof GuestContactInput>;

// ---------------------------------------------------------------------------
// Trip facts: what the account's trip cards say beside `/me/trips`
// ---------------------------------------------------------------------------

export const TripPayment = z.object({
  instrumentKind: z.enum(["mobile_money", "card"]).nullable(),
  network: MobileMoneyNetwork.nullable(),
  payerMasked: z.string().nullable(),
  /** The provider's reference for the capture. */
  providerRef: z.string().nullable(),
  amountRwf: z.number().int().nonnegative().nullable(),
  settledAt: z.string().nullable(),
});
export type TripPayment = z.infer<typeof TripPayment>;

export const GuestTripFacts = z.object({
  reference: z.string().min(1),
  /** The business the stay is contracted with. */
  legalName: z.string(),
  /** The property's marketplace picture, when it has a card (published or not). */
  stockPhoto: MarketStockPhoto.nullable(),
  /** A request: when it lapses if the host has not answered. */
  approvalExpiresAt: z.string().nullable(),
  payment: TripPayment.nullable(),
  refundRwf: z.number().int().nonnegative().nullable(),
  cancelledAt: z.string().nullable(),
  /** When the guest sent their pre-arrival details, if they have. */
  preArrivalSubmittedAt: z.string().nullable(),
});
export type GuestTripFacts = z.infer<typeof GuestTripFacts>;

export const MyTripFacts = z.object({ trips: z.array(GuestTripFacts) });
export type MyTripFacts = z.infer<typeof MyTripFacts>;

// ---------------------------------------------------------------------------
// The businesses a person works at (the help centre's contact form)
// ---------------------------------------------------------------------------

/** One branch the person works at: every branch of their org, or only those their membership is limited to. */
export const MyBusinessPlace = z.object({
  propertyId: Uuid,
  propertyName: z.string(),
  legalName: z.string(),
  orgId: Uuid,
  role: z.string(),
});
export type MyBusinessPlace = z.infer<typeof MyBusinessPlace>;

export const MyBusinesses = z.object({ businesses: z.array(MyBusinessPlace) });
export type MyBusinesses = z.infer<typeof MyBusinesses>;
