/**
 * The Property detail page's data (F-B15, FL06), and the Room types under it.
 *
 * **Typed to `@injishi/contracts`, not invented** (decision D9). `PropertyDetail`
 * and `RoomTypeSummary` already exist in `packages/contracts/dist/booking.d.ts`
 * because the API serves exactly this page, so a fixture with a shape of its own
 * would be a fixture the Phase 3 swap has to re-map field by field. Every
 * property below IS a `PropertyDetail`; every room IS a `RoomTypeSummary`.
 *
 * **Nothing here restates a fact `./stays` already holds.** The name, the
 * description, the photographs, the district line, the coordinates and the
 * guest score all come from the `Stay` the guest tapped on Explore, so the page
 * cannot contradict the tile that led to it. What this file adds is what the
 * tile does not carry: the Room types, the amenities, the house rules, the
 * check-in times and the address.
 *
 * Two extension records sit beside the contract types rather than inside them:
 *
 *   - `StayExtras` carries the amenity list, the host line, the address and
 *     whether check-in is staffed. Folding those into `PropertyDetail` would
 *     forge a wire shape the server does not send.
 *   - `RoomExtras` carries `remaining` and the bed line for the same reason.
 *     `roomCount` in the contract is the Room type's TOTAL bookable units — the
 *     atomic-hold denominator — and is not the same fact as how many are open
 *     for the guest's dates. Availability is a query against dates, so it is
 *     fixture data here and a second call later.
 *
 * ## Two booking modes, and which one wins
 *
 * `Stay.bookingMode` is Explore's FACET: one value per property, so the
 * "Instant book" filter has something to match. `RoomTypeSummary.bookingMode`
 * is the CONTRACT's: the glossary is explicit that the Room type owns booking
 * mode, price and availability, and F-B03 puts the mode on the Room type. So
 * the page's CTA follows the SELECTED room and falls back to the property only
 * while nothing is selected. The two are kept consistent below — a property's
 * facet is the mode of its cheapest room — and `property-detail.test.ts` fails
 * if a seed drifts.
 *
 * ## Coverage is deliberate
 *
 * Every branch the page can render is reachable by walking the app, not only
 * from a test:
 *
 *   - both booking modes, so the CTA reads "Book now" and "Request to book";
 *   - all five cancellation tiers F-B11 names;
 *   - a Room type with `remaining: 0` on an otherwise open property (Akagera's
 *     Deck Tent), which is F-B15's "all rooms in maintenance" case at the row
 *     level, and a property where every room is out (Virunga Tea Retreat, which
 *     is also the `active: false` one Session 2 seeded for Saved);
 *   - a Room type with `nonrefundableEligible: false`, so the policy sheet's
 *     disabled toggle is a state a reviewer can actually reach;
 *   - three properties with `locationPrivacy`, so the district-level pin is
 *     real rather than a branch nobody has seen;
 *   - two whole-property listings with a single Room type, which is the case
 *     where asking the guest to "choose a room" would be a question with one
 *     answer.
 *
 * The vocabulary — the room naming, the mode chip, the tier sentence, the
 * check-in note, the house rules — is transcribed from the Guest canvas
 * artboard 4 (`design/mobile-guest/screens-a.mjs` `listingDetail`, with
 * `PROPERTY` and `ROOMS` in `data.mjs`), whose own source is the seeded
 * property in `server/api/scripts/seed-content.mjs`. Umurage Guesthouse below
 * carries those three room types verbatim.
 */
import type { BookingMode, CancellationTier, PropertyDetail, RoomTypeSummary } from '@injishi/contracts';
import type { IconName } from '@/components';
import type { MessageKey } from '@/i18n/i18n';
import { STAYS, type Stay } from './stays';

/* ----------------------------------------------------------- amenities --- */

/**
 * An amenity is a message key and, where Feather actually has the glyph, an
 * icon. Most amenities have no honest glyph in a stroke set this size, and a
 * forced metaphor reads worse than a tick — so `icon` is optional and the row
 * falls back to `check`. Design brief §5.2: the icon vocabulary is the set we
 * have, not the set we wish we had.
 */
export interface Amenity {
  id: string;
  label: MessageKey;
  icon?: IconName;
}

export const AMENITIES = {
  wifi: { id: 'wifi', label: 'listing.amenity.wifi', icon: 'wifi' },
  fibre: { id: 'fibre', label: 'listing.amenity.fibre', icon: 'wifi' },
  breakfast: { id: 'breakfast', label: 'listing.amenity.breakfast' },
  breakfastRoom: { id: 'breakfastRoom', label: 'listing.amenity.breakfastRoom' },
  earlyBreakfast: { id: 'earlyBreakfast', label: 'listing.amenity.earlyBreakfast', icon: 'clock' },
  halfBoard: { id: 'halfBoard', label: 'listing.amenity.halfBoard' },
  fullBoard: { id: 'fullBoard', label: 'listing.amenity.fullBoard' },
  restaurant: { id: 'restaurant', label: 'listing.amenity.restaurant' },
  kitchen: { id: 'kitchen', label: 'listing.amenity.kitchen' },
  cookOnRequest: { id: 'cookOnRequest', label: 'listing.amenity.cookOnRequest' },
  garden: { id: 'garden', label: 'listing.amenity.garden' },
  courtyard: { id: 'courtyard', label: 'listing.amenity.courtyard' },
  terrace: { id: 'terrace', label: 'listing.amenity.terrace' },
  rooftopTerrace: { id: 'rooftopTerrace', label: 'listing.amenity.rooftopTerrace' },
  lakeView: { id: 'lakeView', label: 'listing.amenity.lakeView', icon: 'eye' },
  riverView: { id: 'riverView', label: 'listing.amenity.riverView', icon: 'eye' },
  cityView: { id: 'cityView', label: 'listing.amenity.cityView', icon: 'eye' },
  volcanoView: { id: 'volcanoView', label: 'listing.amenity.volcanoView', icon: 'eye' },
  privateJetty: { id: 'privateJetty', label: 'listing.amenity.privateJetty' },
  boatTransfer: { id: 'boatTransfer', label: 'listing.amenity.boatTransfer', icon: 'navigation' },
  beachNearby: { id: 'beachNearby', label: 'listing.amenity.beachNearby' },
  gameDrives: { id: 'gameDrives', label: 'listing.amenity.gameDrives', icon: 'map' },
  guidedTreks: { id: 'guidedTreks', label: 'listing.amenity.guidedTreks', icon: 'map' },
  estateWalk: { id: 'estateWalk', label: 'listing.amenity.estateWalk', icon: 'map' },
  workspace: { id: 'workspace', label: 'listing.amenity.workspace', icon: 'briefcase' },
  standbyPower: { id: 'standbyPower', label: 'listing.amenity.standbyPower', icon: 'zap' },
  reception24h: { id: 'reception24h', label: 'listing.amenity.reception24h', icon: 'clock' },
  hotWater: { id: 'hotWater', label: 'listing.amenity.hotWater', icon: 'droplet' },
  laundry: { id: 'laundry', label: 'listing.amenity.laundry', icon: 'droplet' },
  airportPickup: { id: 'airportPickup', label: 'listing.amenity.airportPickup', icon: 'navigation' },
  parking: { id: 'parking', label: 'listing.amenity.parking' },
  lift: { id: 'lift', label: 'listing.amenity.lift' },
  fireplace: { id: 'fireplace', label: 'listing.amenity.fireplace' },
  lateCheckout: { id: 'lateCheckout', label: 'listing.amenity.lateCheckout', icon: 'clock' },
  selfCheckIn: { id: 'selfCheckIn', label: 'listing.amenity.selfCheckIn', icon: 'key' },
} as const satisfies Record<string, Amenity>;

export type AmenityId = keyof typeof AMENITIES;

/**
 * One amenity, widened to `Amenity`.
 *
 * `AMENITIES` is `as const` so a typo in an id is a compile error, which means
 * indexing it yields a union where `icon` exists on some members and not on the
 * ones with no honest glyph. Reading `.icon` off that union is an error even
 * though the field is optional on `Amenity`. This is the one widening point,
 * rather than a cast at each call site — the same shape `stubSpec` uses.
 */
export function amenity(id: AmenityId): Amenity {
  return AMENITIES[id];
}

/* ------------------------------------------------------- the extensions --- */

/** Bed configuration, as one translatable phrase rather than a count and a noun. */
export type BedsKey = Extract<MessageKey, `listing.beds.${string}`>;

export interface RoomExtras {
  /** The stay this Room type belongs to. The route only carries the room id. */
  stayId: string;
  /**
   * Units still open for the dates on screen. NOT `roomCount`, which is the
   * total. Zero is the unavailable state, and it is a state rather than an
   * omission — a Room type that vanishes when it sells out is one the guest
   * cannot tell apart from one that never existed.
   */
  remaining: number;
  beds: BedsKey;
}

export interface RoomCard extends RoomExtras {
  summary: RoomTypeSummary;
}

export interface StayExtras {
  amenities: readonly AmenityId[];
  /** The street line. Withheld from the page while `locationPrivacy` is on. */
  address: string;
  /** Self check-in unlocks the arrival guide from the phone (F-B09, F-B18). */
  selfCheckIn: boolean;
}

export interface StayDetail extends StayExtras {
  stay: Stay;
  property: PropertyDetail;
  rooms: readonly RoomCard[];
}

/* ------------------------------------------------------------- the data --- */

interface RoomSeed {
  id: string;
  name: string;
  /** Sleeps. `capacity` on the contract, which allows null; a fixture never does. */
  sleeps: number;
  /** Total bookable units of this Room type. `roomCount` on the contract. */
  units: number;
  rate: number;
  mode: BookingMode;
  tier: CancellationTier;
  beds: BedsKey;
  remaining: number;
  /** Defaults to true. False is the reachable disabled-toggle case. */
  nonRefundable?: boolean;
}

interface Seed extends StayExtras {
  stayId: string;
  locationPrivacy: boolean;
  checkInTime: string;
  checkOutTime: string;
  houseRules: readonly string[];
  rooms: readonly RoomSeed[];
}

/** House rules every property in the catalogue carries, so a seed lists only its own. */
const COMMON_RULES = ['No smoking indoors.', 'Valid ID required at check-in.'];

const SEEDS: readonly Seed[] = [
  {
    // The seeded property, and the one the Guest canvas draws. Its three room
    // types are `ROOMS` in `design/mobile-guest/data.mjs`, verbatim.
    stayId: 'umurage-guesthouse',
    address: 'KG 7 Ave, Kacyiru, Kigali',
    locationPrivacy: false,
    checkInTime: '14:00',
    checkOutTime: '11:00',
    houseRules: [...COMMON_RULES, 'Quiet hours after 22:00.'],
    amenities: ['breakfastRoom', 'garden', 'rooftopTerrace', 'courtyard', 'terrace', 'wifi', 'parking', 'laundry'],
    selfCheckIn: false,
    rooms: [
      { id: 'umurage-standard-room', name: 'Standard Room', sleeps: 2, units: 6, rate: 155000, mode: 'request_to_book', tier: 'moderate', beds: 'listing.beds.oneQueen', remaining: 3 },
      { id: 'umurage-deluxe-room', name: 'Deluxe Room', sleeps: 3, units: 4, rate: 175000, mode: 'request_to_book', tier: 'moderate', beds: 'listing.beds.oneKingOneSofa', remaining: 2 },
      { id: 'umurage-garden-suite', name: 'Garden Suite', sleeps: 4, units: 2, rate: 240000, mode: 'instant_book', tier: 'flexible', beds: 'listing.beds.oneKingTwoTwin', remaining: 1 },
    ],
  },
  {
    stayId: 'kivu-serena-suite',
    address: 'KN 3 Rd, lakeside gate, Rubavu',
    locationPrivacy: false,
    checkInTime: '14:00',
    checkOutTime: '11:00',
    houseRules: [...COMMON_RULES, 'Quiet hours after 22:00.', 'Pets by prior arrangement only.'],
    amenities: ['lakeView', 'breakfast', 'wifi', 'terrace', 'lateCheckout', 'selfCheckIn', 'parking', 'laundry'],
    selfCheckIn: true,
    rooms: [
      { id: 'kivu-lake-suite', name: 'Lake Suite', sleeps: 2, units: 4, rate: 145000, mode: 'instant_book', tier: 'flexible', beds: 'listing.beds.oneKing', remaining: 2 },
      { id: 'kivu-balcony-double', name: 'Balcony Double', sleeps: 2, units: 6, rate: 165000, mode: 'instant_book', tier: 'moderate', beds: 'listing.beds.oneQueen', remaining: 4 },
    ],
  },
  {
    // A serviced apartment in a residential block: the exact door is shared on
    // confirmation and the pin sits on the district until then.
    stayId: 'kigali-heights-apartment',
    address: 'KG 7 Ave, Kimihurura, Kigali',
    locationPrivacy: true,
    checkInTime: '15:00',
    checkOutTime: '11:00',
    houseRules: [...COMMON_RULES, 'Quiet hours after 22:00.', 'No parties or events.'],
    amenities: ['workspace', 'fibre', 'reception24h', 'wifi', 'standbyPower', 'selfCheckIn', 'laundry', 'parking', 'airportPickup'],
    selfCheckIn: true,
    rooms: [
      { id: 'heights-studio', name: 'Serviced Studio', sleeps: 2, units: 8, rate: 92000, mode: 'instant_book', tier: 'flexible', beds: 'listing.beds.oneQueen', remaining: 5 },
      { id: 'heights-corner-studio', name: 'Corner Studio', sleeps: 2, units: 2, rate: 124000, mode: 'request_to_book', tier: 'limited', beds: 'listing.beds.twoTwin', remaining: 1 },
    ],
  },
  {
    stayId: 'nyungwe-forest-lodge',
    address: 'Gisakura sector, Nyamasheke',
    locationPrivacy: false,
    checkInTime: '14:00',
    checkOutTime: '10:00',
    houseRules: [
      ...COMMON_RULES,
      'Quiet hours after 21:30. The forest is the point.',
      'Park permits are booked separately at the front desk.',
    ],
    amenities: ['fullBoard', 'guidedTreks', 'restaurant', 'garden', 'wifi', 'reception24h', 'laundry'],
    selfCheckIn: false,
    rooms: [
      { id: 'nyungwe-forest-room', name: 'Forest Room', sleeps: 2, units: 10, rate: 310000, mode: 'request_to_book', tier: 'moderate', beds: 'listing.beds.oneKing', remaining: 4 },
      { id: 'nyungwe-canopy-suite', name: 'Canopy Suite', sleeps: 4, units: 3, rate: 460000, mode: 'request_to_book', tier: 'firm', beds: 'listing.beds.oneKingTwoTwin', remaining: 2 },
    ],
  },
  {
    stayId: 'musanze-volcano-cabin',
    address: 'Kinigi road, Musanze',
    locationPrivacy: false,
    checkInTime: '14:00',
    checkOutTime: '10:00',
    houseRules: [
      ...COMMON_RULES,
      'Quiet hours after 21:00. Trek departures start at 05:00.',
      'Firewood is provided; please do not bring your own.',
    ],
    amenities: ['volcanoView', 'fireplace', 'earlyBreakfast', 'guidedTreks', 'wifi', 'parking', 'selfCheckIn'],
    selfCheckIn: true,
    rooms: [
      { id: 'musanze-twin-cabin', name: 'Twin Cabin', sleeps: 2, units: 6, rate: 128000, mode: 'request_to_book', tier: 'moderate', beds: 'listing.beds.twoTwin', remaining: 3 },
      { id: 'musanze-hearth-cabin', name: 'Hearth Cabin', sleeps: 4, units: 3, rate: 186000, mode: 'request_to_book', tier: 'flexible', beds: 'listing.beds.oneKingTwoTwin', remaining: 2 },
    ],
  },
  {
    // A whole house. One Room type, because there is one thing to book — and
    // that is the case where asking a guest to choose is a question with one
    // answer, so the page answers it for them.
    stayId: 'karongi-lake-house',
    address: 'Bwishyura, Karongi',
    locationPrivacy: false,
    checkInTime: '15:00',
    checkOutTime: '10:00',
    houseRules: [...COMMON_RULES, 'Quiet hours after 22:00.', 'The jetty is unlit; no swimming after dark.'],
    amenities: ['lakeView', 'privateJetty', 'kitchen', 'cookOnRequest', 'boatTransfer', 'terrace', 'wifi', 'parking'],
    selfCheckIn: true,
    rooms: [
      { id: 'karongi-whole-house', name: 'The whole house', sleeps: 6, units: 1, rate: 118000, mode: 'instant_book', tier: 'moderate', beds: 'listing.beds.threeDouble', remaining: 1 },
    ],
  },
  {
    stayId: 'akagera-tented-camp',
    address: 'Inside the park boundary, Nyagatare',
    locationPrivacy: false,
    checkInTime: '14:00',
    checkOutTime: '10:00',
    houseRules: [
      ...COMMON_RULES,
      'Do not walk between tents after dark without an escort.',
      'Park entry is charged separately at the gate.',
    ],
    amenities: ['fullBoard', 'gameDrives', 'restaurant', 'hotWater', 'standbyPower', 'laundry'],
    selfCheckIn: false,
    rooms: [
      { id: 'akagera-tented-room', name: 'Tented Room', sleeps: 2, units: 8, rate: 265000, mode: 'request_to_book', tier: 'firm', beds: 'listing.beds.twoTwin', remaining: 2 },
      // Sold out for the dates shown, on a property that is otherwise open.
      { id: 'akagera-deck-tent', name: 'Deck Tent', sleeps: 2, units: 3, rate: 320000, mode: 'request_to_book', tier: 'firm', beds: 'listing.beds.oneKing', remaining: 0 },
    ],
  },
  {
    stayId: 'rusizi-river-lodge',
    address: 'Kamembe road, Rusizi',
    locationPrivacy: false,
    checkInTime: '14:00',
    checkOutTime: '11:00',
    houseRules: [...COMMON_RULES, 'Quiet hours after 22:00.'],
    amenities: ['halfBoard', 'riverView', 'restaurant', 'wifi', 'parking', 'laundry', 'hotWater'],
    selfCheckIn: false,
    rooms: [
      { id: 'rusizi-river-room', name: 'River Room', sleeps: 2, units: 12, rate: 96000, mode: 'instant_book', tier: 'flexible', beds: 'listing.beds.oneQueen', remaining: 4 },
      // The one Room type that does not sell a non-refundable rate, and it is
      // deliberately one you can still select, so the disabled toggle in the
      // policy sheet is reachable by walking the app.
      { id: 'rusizi-family-room', name: 'River Family Room', sleeps: 3, units: 4, rate: 138000, mode: 'instant_book', tier: 'moderate', beds: 'listing.beds.oneKingOneSofa', remaining: 2, nonRefundable: false },
    ],
  },
  {
    // A whole townhouse, and a residential address: one Room type and a
    // district-level pin.
    stayId: 'nyamirambo-townhouse',
    address: 'Off KN 2 Ave, Nyamirambo, Kigali',
    locationPrivacy: true,
    checkInTime: '14:00',
    checkOutTime: '11:00',
    houseRules: [...COMMON_RULES, 'Quiet hours after 22:00.', 'No parties or events.'],
    amenities: ['kitchen', 'courtyard', 'wifi', 'parking', 'laundry', 'selfCheckIn'],
    selfCheckIn: true,
    rooms: [
      { id: 'nyamirambo-whole-townhouse', name: 'The whole townhouse', sleeps: 5, units: 1, rate: 74000, mode: 'instant_book', tier: 'moderate', beds: 'listing.beds.twoQueenOneSofa', remaining: 1 },
    ],
  },
  {
    stayId: 'gisenyi-beach-motel',
    address: 'Avenue de la Coopération, Gisenyi',
    locationPrivacy: false,
    checkInTime: '13:00',
    checkOutTime: '10:00',
    houseRules: [...COMMON_RULES, 'Quiet hours after 22:00.', 'Gate closes at 23:00; ring the bell after that.'],
    amenities: ['beachNearby', 'parking', 'hotWater', 'wifi'],
    selfCheckIn: true,
    rooms: [
      { id: 'gisenyi-standard-double', name: 'Standard Double', sleeps: 2, units: 14, rate: 38000, mode: 'instant_book', tier: 'flexible', beds: 'listing.beds.oneDouble', remaining: 6 },
      { id: 'gisenyi-twin-room', name: 'Twin Room', sleeps: 2, units: 8, rate: 44000, mode: 'instant_book', tier: 'flexible', beds: 'listing.beds.twoTwin', remaining: 4 },
    ],
  },
  {
    stayId: 'kigali-cbd-loft',
    address: 'KN 4 Ave, Nyarugenge, Kigali',
    locationPrivacy: true,
    checkInTime: '15:00',
    checkOutTime: '11:00',
    houseRules: [...COMMON_RULES, 'Quiet hours after 22:00.', 'No parties or events.'],
    amenities: ['cityView', 'workspace', 'fibre', 'lift', 'wifi', 'standbyPower', 'selfCheckIn'],
    selfCheckIn: true,
    rooms: [
      { id: 'cbd-studio-loft', name: 'Studio Loft', sleeps: 2, units: 6, rate: 61000, mode: 'instant_book', tier: 'flexible', beds: 'listing.beds.oneQueen', remaining: 3 },
      { id: 'cbd-corner-loft', name: 'Corner Loft', sleeps: 2, units: 2, rate: 78000, mode: 'instant_book', tier: 'moderate', beds: 'listing.beds.oneKing', remaining: 2 },
    ],
  },
  {
    // Closed to new bookings while the main house is re-roofed, which is why
    // Session 2 seeded it `active: false`. Every Room type is out, so this is
    // the fully-booked page as well as the unlisted one.
    stayId: 'virunga-tea-retreat',
    address: 'Kinigi tea estate, Musanze',
    locationPrivacy: false,
    checkInTime: '14:00',
    checkOutTime: '10:00',
    houseRules: [...COMMON_RULES, 'Quiet hours after 21:00.', 'The estate paths close at dusk.'],
    amenities: ['halfBoard', 'estateWalk', 'volcanoView', 'garden', 'restaurant', 'wifi', 'parking'],
    selfCheckIn: false,
    rooms: [
      { id: 'virunga-estate-room', name: 'Estate Room', sleeps: 2, units: 3, rate: 182000, mode: 'request_to_book', tier: 'strict_extended_stay', beds: 'listing.beds.oneKing', remaining: 0 },
      { id: 'virunga-tea-house-suite', name: 'Tea House Suite', sleeps: 4, units: 1, rate: 245000, mode: 'request_to_book', tier: 'strict_extended_stay', beds: 'listing.beds.oneKingTwoTwin', remaining: 0 },
    ],
  },
];

/**
 * Builds a `PropertyDetail` from a seed and the stay it belongs to, so the
 * name, description, photographs and district have one source and cannot drift
 * from what Explore showed on the tile the guest tapped.
 */
function detailFor(seed: Seed): StayDetail | undefined {
  const stay = STAYS.find((s) => s.id === seed.stayId);
  if (!stay) return undefined;

  const roomTypes: RoomTypeSummary[] = seed.rooms.map((room) => ({
    id: room.id,
    name: room.name,
    domain: 'hospitality',
    capacity: room.sleeps,
    roomCount: room.units,
    nightlyRateRwf: room.rate,
    bookingMode: room.mode,
    // Sub-field of `request_to_book` only, never a mode of its own (F-B03),
    // so it is null on every instant-book row and the type says why.
    approvalPolicy: room.mode === 'request_to_book' ? 'approve_all' : null,
    cancellationTier: room.tier,
    nonrefundableEligible: room.nonRefundable ?? true,
    /*
     * ARI (ADR-047 wave E). The fixtures state no minimum, and null is the
     * field's honest value for that — a consumer reads an absent minimum as one
     * night, where inventing a longer one here would make a fixture refuse a
     * stay the real room would accept.
     */
    minStay: null,
  }));

  const property: PropertyDetail = {
    id: stay.id,
    /*
     * `slug` is the property's PUBLIC ADDRESS on the marketplace (ADR-047 D-e),
     * and these are fixtures: they have no page on the web, so they have no
     * address. Null is the field's honest value rather than a placeholder —
     * inventing one would produce a link that 404s the first time mobile grows
     * a "view on the web" affordance.
     */
    slug: null,
    name: stay.title,
    description: stay.description,
    districtName: stay.location,
    latitude: stay.coords.lat,
    longitude: stay.coords.lng,
    locationPrivacy: seed.locationPrivacy,
    checkInTime: seed.checkInTime,
    checkOutTime: seed.checkOutTime,
    // The contract carries house rules as ONE nullable string, which is what
    // the column is. The page splits on newlines rather than the fixture
    // shipping an array the wire does not have.
    houseRules: seed.houseRules.join('\n'),
    photos: [stay.photos.cover, ...stay.photos.gallery],
    roomTypes,
    // The fixture's amenities travel beside the property (`amenities` below),
    // in the richer shape this screen renders. The wire's deduped facility list
    // (ADR-050 AC-16) has no fixture yet, and an empty list is its honest value.
    facilities: [],
  };

  return {
    stay,
    property,
    amenities: seed.amenities,
    address: seed.address,
    selfCheckIn: seed.selfCheckIn,
    rooms: seed.rooms.map((room, i) => ({
      stayId: seed.stayId,
      summary: roomTypes[i],
      beds: room.beds,
      remaining: room.remaining,
    })),
  };
}

export const STAY_DETAILS: readonly StayDetail[] = SEEDS.map(detailFor).filter(
  (detail): detail is StayDetail => detail !== undefined,
);

export function getStayDetail(stayId: string): StayDetail | undefined {
  return STAY_DETAILS.find((detail) => detail.property.id === stayId);
}

/** Every Room type in the app, flattened. The booking stepper resolves by id. */
export const ROOM_TYPES: readonly RoomCard[] = STAY_DETAILS.flatMap((detail) => detail.rooms);

export function getRoomType(roomTypeId: string): RoomCard | undefined {
  return ROOM_TYPES.find((room) => room.summary.id === roomTypeId);
}

/* -------------------------------------------------------------- helpers --- */

/** The house rules as the page renders them: one line each, blanks dropped. */
export function houseRuleLines(property: PropertyDetail): string[] {
  return (property.houseRules ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Room types with a unit left for the dates shown, cheapest first. */
export function availableRooms(detail: StayDetail): RoomCard[] {
  return detail.rooms
    .filter((room) => room.remaining > 0)
    .sort((a, b) => (a.summary.nightlyRateRwf ?? 0) - (b.summary.nightlyRateRwf ?? 0));
}

/**
 * The room the page opens on.
 *
 * A property with exactly one Room type has nothing to choose, so the page
 * chooses it and the sticky bar is live on arrival. A property with several
 * leaves the choice open, because pre-selecting one would put a price in the
 * bar that the guest never picked.
 */
export function initialRoom(detail: StayDetail): RoomCard | undefined {
  if (detail.rooms.length !== 1) return undefined;
  const only = detail.rooms[0];
  return only.remaining > 0 ? only : undefined;
}

/** True when no Room type has a unit left for the dates shown. */
export function fullyBooked(detail: StayDetail): boolean {
  return detail.rooms.every((room) => room.remaining <= 0);
}

/** The lowest rate still bookable. What Explore's "from" price means. */
export function fromRate(detail: StayDetail): number | undefined {
  return availableRooms(detail)[0]?.summary.nightlyRateRwf ?? undefined;
}
