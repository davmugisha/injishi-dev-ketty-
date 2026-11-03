import { z } from "zod";
import { BookingMode, CancellationTier, IsoDate, type RoomPriceBasis } from "./booking";
import { RwfAmount, Uuid } from "./primitives";
import { AccommodationClass, RetiredAccommodationClass, type StoredAccommodationClass } from "./rdb";

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
export const ExploreMode = z.enum(["stays", "homes"]);
export type ExploreMode = z.infer<typeof ExploreMode>;

/** Top rated (weighted by review count), or by the price the card shows. */
export const ExploreSort = z.enum(["top_rated", "price_asc", "price_desc"]);
export type ExploreSort = z.infer<typeof ExploreSort>;

/**
 * What a price covers (mobile spec 0005, D-j): the party a night ("a night for 2"); with no party
 * yet, a room or a whole place a night ("a night", a room priced `per_unit`) or one person a night
 * ("a person, a night", `per_person`); or a home a month.
 */
export const ExplorePriceBasis = z.enum(["party_night", "unit_night", "person_night", "month"]);
export type ExplorePriceBasis = z.infer<typeof ExplorePriceBasis>;

/**
 * The basis a stay's price is shown on before a party is set, from how its room is counted
 * (`chargedGuests`): a room priced per room or a whole place is its own price a night, a room priced
 * per person is one person's. A menu item (`per_item`) is never a stay and never reaches explore.
 */
export function noPartyPriceBasis(roomBasis: RoomPriceBasis | null | undefined): "unit_night" | "person_night" {
  return roomBasis === "per_unit" ? "unit_night" : "person_night";
}

/** The chips a guest filters stays by, drawn from the business's registered class (D-i). */
export const ExploreType = z.enum(["hotel", "lodge", "guest_house", "tented_camp", "apartment", "villa", "stay", "home"]);
export type ExploreType = z.infer<typeof ExploreType>;

export const EXPLORE_TYPE_LABEL: Readonly<Record<ExploreType, string>> = {
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
export const EXPLORE_TYPES: Readonly<Record<StoredAccommodationClass, ExploreType>> = {
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
export const STORED_ACCOMMODATION_CLASSES: readonly StoredAccommodationClass[] = [
  ...AccommodationClass.options,
  ...RetiredAccommodationClass.options,
];

/** The chip of a stay's class; a null or unknown class is a plain "Stay". Every home is a "Home". */
export function exploreTypeOf(mode: ExploreMode, accommodationClass: string | null): ExploreType {
  if (mode === "homes") return "home";
  if (accommodationClass && Object.prototype.hasOwnProperty.call(EXPLORE_TYPES, accommodationClass)) {
    return EXPLORE_TYPES[accommodationClass as StoredAccommodationClass];
  }
  return "stay";
}

/**
 * The amenities a property page leads with, in this order, then the rest by label (D-m's facts).
 * Codes from the platform catalogue (`server/api/scripts/reference-data.mjs`).
 */
export const EXPLORE_FACT_ORDER: readonly string[] = [
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
export const EXPLORE_MAX_FACTS = 4;

/** Results a page of search carries by default, and at most. */
export const EXPLORE_PAGE_SIZE = 20;
export const EXPLORE_MAX_PAGE_SIZE = 50;

/** Where a shared property link points: the web's own property page (D-aa). */
export const EXPLORE_SHARE_ORIGIN = "https://www.injishi.com";

/** A chosen suggestion: `district:12`, `sector:345` or `property:<slug>`. */
export const ExplorePlaceRef = z
  .string()
  .max(160)
  .regex(/^(district:\d{1,9}|sector:\d{1,9}|property:[^\s:]{1,140})$/, "expected district:<id>, sector:<id> or property:<slug>");
export type ExplorePlaceRef = z.infer<typeof ExplorePlaceRef>;

/** `GET /explore/search` (milestone 1: place or text, mode, sort and paging). */
export const ExploreSearchQuery = z.object({
  mode: ExploreMode.default("stays"),
  /** Free text over the property's name, its sector and its district, ignoring case. */
  q: z.string().trim().max(80).optional(),
  /** A suggestion the guest picked; wins over `q` for the area. */
  place: ExplorePlaceRef.optional(),
  sort: ExploreSort.default("top_rated"),
  /** Opaque: the last row's sort key, the frozen platform mean and the filters it was made for. */
  cursor: z.string().max(600).optional(),
  limit: z.coerce.number().int().min(1).max(EXPLORE_MAX_PAGE_SIZE).default(EXPLORE_PAGE_SIZE),
});
export type ExploreSearchQuery = z.infer<typeof ExploreSearchQuery>;

/**
 * One photograph on the wire. The phone builds its URL from the id and the kind (`photoUrl`), in one
 * place; an object key never leaves the API. Width and height are null for an original.
 */
export const ExplorePhoto = z.object({
  id: Uuid,
  kind: z.enum(["property", "unit"]),
  caption: z.string().nullable(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
});
export type ExplorePhoto = z.infer<typeof ExplorePhoto>;

export const ExploreCard = z.object({
  /** The property's id. */
  id: Uuid,
  slug: z.string().min(1),
  name: z.string().min(1),
  mode: ExploreMode,
  type: ExploreType,
  typeLabel: z.string(),
  /** "Gisenyi, Rubavu": the sector, then the district. Empty when the property is not placed. */
  where: z.string(),
  districtName: z.string().nullable(),
  /** Mean of the public guest reviews, one decimal. Null when there are none ("New"). */
  rating: z.number().min(0).max(5).nullable(),
  reviewCount: z.number().int().nonnegative(),
  /** The figure the card shows, on `priceBasis`. Null when nothing is priced ("Price on request"). */
  priceRwf: RwfAmount.nullable(),
  priceBasis: ExplorePriceBasis,
  /** Stays: how the room the price comes from is booked. Null for homes. */
  bookingMode: BookingMode.nullable(),
  /** A request room: how long the host has to answer, from the booking domain's own window. */
  approvalWindowHours: z.number().int().positive().nullable(),
  /** "N left" when 3 or fewer of the priced room remain for the chosen dates; null without dates. */
  roomsLeft: z.number().int().min(0).max(3).nullable(),
  /** Up to five, the cover first. */
  photos: z.array(ExplorePhoto).max(5),
  /** The centre of a 0.01 degree cell when the property asked for location privacy (D-o). */
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  locationApproximate: z.boolean(),
  /** Homes: the first day a listed unit can be moved into; null means now. */
  availableFrom: IsoDate.nullable(),
  /** Homes: how many units are listed. */
  unitCount: z.number().int().nonnegative().nullable(),
});
export type ExploreCard = z.infer<typeof ExploreCard>;

export const ExploreSearchResult = z.object({
  results: z.array(ExploreCard),
  /** Null at the end. */
  nextCursor: z.string().nullable(),
  /** Every match for this search, counted with the same filters. */
  total: z.number().int().nonnegative(),
});
export type ExploreSearchResult = z.infer<typeof ExploreSearchResult>;

/** `GET /explore/places`: suggestions for two letters or more. */
export const ExplorePlacesQuery = z.object({
  q: z.string().trim().min(2).max(40),
  mode: ExploreMode.default("stays"),
});
export type ExplorePlacesQuery = z.infer<typeof ExplorePlacesQuery>;

export const ExplorePlace = z.object({
  kind: z.enum(["district", "sector", "property"]),
  /** The district's or sector's id, or the property's id. */
  id: z.string().min(1),
  label: z.string().min(1),
  /** "12 stays" for an area; "Gisenyi, Rubavu" for a property. */
  sub: z.string(),
  /** A property's public slug; null for an area. */
  slug: z.string().nullable(),
  /** What `place` takes to filter by this suggestion. */
  ref: ExplorePlaceRef,
});
export type ExplorePlace = z.infer<typeof ExplorePlace>;

export const ExplorePlaces = z.object({ places: z.array(ExplorePlace).max(8) });
export type ExplorePlaces = z.infer<typeof ExplorePlaces>;

/**
 * A room type on a stay's page, priced by the card's rule for that one room (D-j): its own basis,
 * so a hotel room reads "a night" and a room priced per person "a person, a night".
 */
export const ExploreRoom = z.object({
  id: Uuid,
  name: z.string().min(1),
  /**
   * How many people it sleeps: `DEFAULT_CAPACITY` (4) when the host has not said, the figure the
   * booking refuses a larger party by. Nullable only for older answers.
   */
  sleeps: z.number().int().positive().nullable(),
  roomCount: z.number().int().nonnegative(),
  /** Null, with a null basis, when the room has no price yet ("Price on request"). */
  priceRwf: RwfAmount.nullable(),
  priceBasis: ExplorePriceBasis.nullable(),
  bookingMode: BookingMode.nullable(),
  approvalWindowHours: z.number().int().positive().nullable(),
  cancellationTier: CancellationTier.nullable(),
  /** The saver (non refundable) rate is offered on this room. */
  nonrefundableEligible: z.boolean(),
  minStay: z.number().int().positive().nullable(),
  /** The fewest free units over the chosen nights; null without dates, 0 is sold out. */
  freeUnits: z.number().int().nonnegative().nullable(),
});
export type ExploreRoom = z.infer<typeof ExploreRoom>;

/** A listed unit on a home's page. */
export const ExploreUnit = z.object({
  id: Uuid,
  label: z.string().min(1),
  bedrooms: z.number().int().nonnegative().nullable(),
  bathrooms: z.number().int().nonnegative().nullable(),
  sizeSqm: z.number().int().positive().nullable(),
  furnished: z.boolean(),
  /** The asking rent a month. */
  rentRwf: RwfAmount,
  /** Null means now. */
  availableFrom: IsoDate.nullable(),
  photos: z.array(ExplorePhoto),
});
export type ExploreUnit = z.infer<typeof ExploreUnit>;

/** `GET /explore/properties/:slug`: the property page, from real data only. */
export const ExplorePage = z.object({
  card: ExploreCard,
  description: z.string().nullable(),
  /** "14:00", in the property's own clock. */
  checkInTime: z.string().nullable(),
  checkOutTime: z.string().nullable(),
  houseRules: z.string().nullable(),
  timezone: z.string(),
  /** Every property photograph, the cover first. */
  photos: z.array(ExplorePhoto),
  /** Up to `EXPLORE_MAX_FACTS` of its amenities, in `EXPLORE_FACT_ORDER`. */
  facts: z.array(z.object({ code: z.string(), label: z.string() })).max(EXPLORE_MAX_FACTS),
  /** Every amenity it lists, labelled. */
  facilities: z.array(z.object({ code: z.string(), label: z.string() })),
  /** Stays: every active room type a guest can book (never a `per_item` menu item), cheapest first, ties by id. Null for homes. */
  rooms: z.array(ExploreRoom).nullable(),
  /** Homes: every listed unit, cheapest first. Null for stays. */
  units: z.array(ExploreUnit).nullable(),
  /** Stays: rooms over every active room type a guest can book, for "Hotel · 42 rooms". */
  roomCount: z.number().int().nonnegative(),
  business: z.object({
    legalName: z.string(),
    /** Stays only: a home's landlord may be a private person (D-o). */
    tin: z.string().nullable(),
    /** True for every visible business: activation requires the field verified pass. */
    verified: z.boolean(),
    /** When the latest registration review passed. */
    verifiedAt: z.string().nullable(),
  }),
  shareUrl: z.string().url(),
});
export type ExplorePage = z.infer<typeof ExplorePage>;
