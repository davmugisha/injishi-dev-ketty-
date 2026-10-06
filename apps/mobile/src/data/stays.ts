/**
 * Mock Hospitality-demand data — the Guest slice of the merged mobile client
 * (Explore / Trips). Pure client fixtures standing in for /api/v1, mirroring
 * the Residence fixtures in `./rentals`.
 *
 * Domain invariants honoured here: Hospitality stays ARE publicly explorable
 * (Residence units never are — those live only in the Broker Directory), a
 * booking emits an EBM invoice, and money is RWF.
 *
 * ## Session 2 widened this file, and why
 *
 * Explore's filters have to filter for real (property class, district, price
 * band, instant book) and its map has to place pins. Four stays could not carry
 * that: every filter either matched everything or emptied the list, so the
 * per-filter empty state had nothing honest to say and the map was four dots on
 * a diagonal. Twelve stays across seven districts, seven accommodation classes
 * and a 38,000 to 310,000 spread is the smallest inventory where each filter
 * both narrows and, in combination, legitimately empties.
 *
 * The four original ids are untouched, because the trip seeds in `./trips` join
 * on them; Session 5 kept that join and added three more stays to it.
 *
 * Two facts are now DERIVED rather than written, for the same reason `withMoney`
 * exists in `./trips` — a fixture that states the same thing twice is a fixture
 * that eventually disagrees with itself:
 *
 *   - **`rating` comes from `score`.** The Guest canvas rates a stay out of ten
 *     and prints the ADR-022 band word beside it ("8.5 · Excellent"); the tile
 *     `ListingCard` draws elsewhere prints stars out of five. Those were two
 *     hand-written numbers for one opinion, and they already disagreed — Lake
 *     Kivu carried 4.9/5 here and 8.5/10 on the canvas, a full band apart.
 *     `score` is the single source now and `rating` is half of it.
 *   - **The district and class facet lists** are computed from this array in
 *     `./search`, never written down beside it. `apps/web` learned that one the
 *     hard way (ADR-011 call 4): its hand-maintained option list offered three
 *     filters no property could satisfy and silently omitted three that
 *     properties were sitting behind. Five live filter bugs, all of one kind.
 */
import type { AccommodationClass, BookingMode } from '@injishi/contracts';
import type { DirectoryListing } from './rentals';

/**
 * A district as a FACET, not as the geography entity.
 *
 * `District` in `@injishi/contracts` is a row with a numeric id and there are
 * thirty of them. This is the far smaller list of places that actually have a
 * stay behind them, and `apps/web` keeps the same split under the same name for
 * the same reason (ADR-011 call 2): the two were sharing a name and meaning
 * unrelated things.
 */
export type DistrictSlug =
  | 'kigali'
  | 'rubavu'
  | 'musanze'
  | 'karongi'
  | 'rusizi'
  | 'nyagatare'
  | 'nyamasheke';

/** Where a pin sits. Decimal degrees, the form the map contract will use. */
export interface Coords {
  lat: number;
  lng: number;
}

/**
 * A publicly explorable Hospitality stay.
 *
 * `DirectoryListing` is the tile shape both surfaces share; this adds the
 * facets Explore searches on. Typed to the contract wherever one exists
 * (decision D9): `class` is `AccommodationClass` and `bookingMode` is
 * `BookingMode`, both straight from `@injishi/contracts`, so a value invented
 * here cannot survive a typecheck.
 */
export interface Stay extends DirectoryListing {
  /** `AccommodationClass` from the contract. The class filter reads this. */
  class: AccommodationClass;
  district: DistrictSlug;
  /** How the place prints. The slug is the facet; this is the copy. */
  place: string;
  /**
   * Guest score out of ten (ADR-022). `ScoreChip` derives the band word from
   * it, and `rating` is derived from it too.
   */
  score: number;
  /**
   * `instant_book` books, `request_to_book` asks. Explore's "Instant book"
   * filter and Session 3's CTA label both read this and nothing else.
   */
  bookingMode: BookingMode;
  coords: Coords;
  /** The largest room type's capacity. The party stepper caps against it. */
  maxGuests: number;
  /**
   * Whether the property still has a published listing. Saved keeps a row for
   * an inactive property and renders it as unavailable rather than dropping it
   * silently (ADR-032 child "the Saved surface"), so the fixture owes one that
   * is false. Explore never shows it.
   */
  active: boolean;
}

/** Everything except the derived `rating`. See the file header. */
type StaySeed = Omit<Stay, 'rating'>;

const STAY_SEEDS: StaySeed[] = [
  {
    id: 'umurage-guesthouse',
    title: 'Umurage Guesthouse',
    location: 'Kacyiru, Gasabo · Kigali',
    place: 'Kacyiru, Gasabo',
    district: 'kigali',
    class: 'guest_house',
    domain: 'hospitality',
    price: 155000,
    per: 'night',
    score: 9,
    reviews: 184,
    bookingMode: 'request_to_book',
    coords: { lat: -1.9403, lng: 30.0915 },
    maxGuests: 4,
    active: true,
    meta: ['Guest house', '6 rooms', 'Breakfast room'],
    agent: 'Umurage Hospitality Ltd',
    description:
      'Umurage Guesthouse, launched in 2025, redefines the high-performance guesthouse experience in Kacyiru. Its open-plan lounge features a chic sitting area, a stylish dining section, a breakfast room, and an elegant garden.',
    photos: {
      cover: 'kigali-hills-view-01',
      gallery: [
        'kigali-city-street-01',
        'kigali-cbd-buildings-01',
        'kigali-skyline-01',
        'rwanda-tea-01',
      ],
      thumbnail: 'kigali-hills-view-01',
    },
  },
  {
    id: 'kivu-sunbird-suite',
    title: 'Lake Kivu Suite',
    location: 'Rubavu, Western Province',
    place: 'Rubavu',
    district: 'rubavu',
    class: 'hotel',
    domain: 'hospitality',
    price: 145000,
    per: 'night',
    score: 8.5,
    reviews: 212,
    bookingMode: 'instant_book',
    coords: { lat: -1.6829, lng: 29.2631 },
    maxGuests: 2,
    active: true,
    meta: ['Lake view', 'Breakfast', '2 guests'],
    agent: 'Kivu Shores Hotel',
    description:
      'Lake-facing suite with a private balcony, breakfast included and late checkout on request. Self check-in opens 24h before arrival; the arrival guide unlocks once you are checked in.',
    photos: {
      cover: 'lake-kivu-01',
      gallery: ['lake-kivu-02', 'lake-kivu-03', 'karongi-01', 'karongi-02'],
      thumbnail: 'lake-kivu-01',
    },
  },
  {
    id: 'lavender-hill-apartment',
    title: 'Lavender Hill Apartment',
    location: 'Kimihurura, Kigali',
    place: 'Kimihurura, Gasabo',
    district: 'kigali',
    class: 'apartment',
    domain: 'hospitality',
    price: 92000,
    per: 'night',
    score: 8,
    reviews: 148,
    bookingMode: 'instant_book',
    coords: { lat: -1.953, lng: 30.093 },
    maxGuests: 2,
    active: true,
    meta: ['1 bed', 'Workspace', 'Fibre'],
    agent: 'Heights Serviced Stays',
    description:
      'Serviced one-bedroom minutes from the convention centre, with a dedicated desk, fibre internet and 24h reception. Popular with business travellers on short stays.',
    photos: {
      cover: 'kigali-skyline-01',
      gallery: [
        'kigali-hills-view-01',
        'kigali-city-street-01',
        'kigali-parliament-aerial-01',
        'kigali-night-panorama-02',
      ],
      thumbnail: 'kigali-skyline-01',
    },
  },
  {
    id: 'nyungwe-forest-lodge',
    title: 'Nyungwe Forest Lodge',
    location: 'Nyamasheke, Western Province',
    place: 'Nyamasheke',
    district: 'nyamasheke',
    class: 'lodge',
    domain: 'hospitality',
    price: 310000,
    per: 'night',
    score: 9.4,
    reviews: 63,
    bookingMode: 'request_to_book',
    coords: { lat: -2.46, lng: 29.15 },
    maxGuests: 4,
    active: true,
    meta: ['Full board', 'Guided treks', '4 guests'],
    agent: 'Nyungwe Collection',
    description:
      'Full-board forest lodge on the edge of the national park. Rates include guided canopy treks; park permits are booked separately at the front desk.',
    photos: {
      cover: 'nyungwe-forest-03',
      gallery: ['nyungwe-forest-02', 'rwanda-tea-01', 'rwanda-tea-02', 'akagera-np-03'],
      thumbnail: 'nyungwe-forest-03',
    },
  },
  {
    id: 'musanze-volcano-cabin',
    title: 'Musanze Volcano Cabin',
    location: 'Musanze, Northern Province',
    place: 'Musanze',
    district: 'musanze',
    class: 'villa',
    domain: 'hospitality',
    price: 128000,
    per: 'night',
    score: 7,
    reviews: 97,
    bookingMode: 'request_to_book',
    coords: { lat: -1.499, lng: 29.634 },
    maxGuests: 4,
    active: true,
    meta: ['2 bed', 'Fireplace', 'Breakfast'],
    agent: 'Virunga Cabins',
    description:
      'Timber cabin with volcano views and a working fireplace, a short drive from the gorilla trek departure point. Early breakfast served from 04:30 on trek days.',
    photos: {
      cover: 'volcanoes-np-02',
      gallery: ['volcanoes-np-03', 'mountain-gorilla-01', 'mountain-gorilla-02', 'akagera-np-01'],
      thumbnail: 'volcanoes-np-02',
    },
  },
  {
    id: 'karongi-lake-house',
    title: 'Karongi Lake House',
    location: 'Karongi, Western Province',
    place: 'Karongi',
    district: 'karongi',
    class: 'villa',
    domain: 'hospitality',
    price: 118000,
    per: 'night',
    score: 8.7,
    reviews: 74,
    bookingMode: 'instant_book',
    coords: { lat: -2.06, lng: 29.35 },
    maxGuests: 6,
    active: true,
    meta: ['3 bed', 'Private jetty', '6 guests'],
    agent: 'Karongi Shoreline Homes',
    description:
      'A whole house on the water with three bedrooms, a covered terrace and a private jetty. A cook and a boat transfer are arranged on request; the nearest shop is a ten minute walk.',
    photos: {
      cover: 'karongi-01',
      gallery: ['karongi-02', 'lake-kivu-03', 'lake-kivu-02', 'rwanda-tea-02'],
      thumbnail: 'karongi-01',
    },
  },
  {
    id: 'akagera-tented-camp',
    title: 'Akagera Tented Camp',
    location: 'Nyagatare, Eastern Province',
    place: 'Nyagatare',
    district: 'nyagatare',
    class: 'tented_camp',
    domain: 'hospitality',
    price: 265000,
    per: 'night',
    score: 8.9,
    reviews: 41,
    bookingMode: 'request_to_book',
    coords: { lat: -1.68, lng: 30.73 },
    maxGuests: 2,
    active: true,
    meta: ['Full board', 'Game drives', '2 guests'],
    agent: 'Akagera Plains Camp',
    description:
      'Canvas rooms on raised decks inside the park boundary, full board, with morning and evening game drives included. Park entry is charged separately at the gate.',
    photos: {
      cover: 'akagera-np-02',
      gallery: ['akagera-np-01', 'akagera-np-03', 'rwanda-tea-01', 'nyungwe-forest-02'],
      thumbnail: 'akagera-np-02',
    },
  },
  {
    id: 'rusizi-river-lodge',
    title: 'Rusizi River Lodge',
    location: 'Rusizi, Western Province',
    place: 'Rusizi',
    district: 'rusizi',
    class: 'lodge',
    domain: 'hospitality',
    price: 96000,
    per: 'night',
    score: 7.6,
    reviews: 58,
    bookingMode: 'instant_book',
    coords: { lat: -2.48, lng: 28.908 },
    maxGuests: 3,
    active: true,
    meta: ['Half board', 'River view', '3 guests'],
    agent: 'Rusizi Collection',
    description:
      'Half-board lodge where the Rusizi leaves Lake Kivu, twenty minutes from the Nyungwe southern gate and ten from the border post at Rusizi I.',
    photos: {
      cover: 'rwanda-tea-01',
      gallery: ['rwanda-tea-02', 'nyungwe-forest-02', 'lake-kivu-03', 'karongi-02'],
      thumbnail: 'rwanda-tea-01',
    },
  },
  {
    id: 'nyamirambo-townhouse',
    title: 'Nyamirambo Townhouse',
    location: 'Nyamirambo, Kigali',
    place: 'Nyamirambo, Nyarugenge',
    district: 'kigali',
    class: 'villa',
    domain: 'hospitality',
    price: 74000,
    per: 'night',
    score: 8.2,
    reviews: 133,
    bookingMode: 'instant_book',
    coords: { lat: -1.977, lng: 30.04 },
    maxGuests: 5,
    active: true,
    meta: ['2 bed', 'Courtyard', '5 guests'],
    agent: 'Nyamirambo Stays',
    description:
      'A whole townhouse off the main street, with a walled courtyard, a kitchen worth cooking in and the market five minutes down the hill.',
    photos: {
      cover: 'kigali-city-street-01',
      gallery: [
        'kigali-cbd-buildings-01',
        'kigali-hills-view-01',
        'kigali-night-panorama-02',
        'kigali-skyline-01',
      ],
      thumbnail: 'kigali-city-street-01',
    },
  },
  {
    id: 'gisenyi-beach-motel',
    title: 'Gisenyi Beach Motel',
    location: 'Gisenyi, Rubavu',
    place: 'Gisenyi, Rubavu',
    district: 'rubavu',
    class: 'motel',
    domain: 'hospitality',
    price: 38000,
    per: 'night',
    score: 7.2,
    reviews: 209,
    bookingMode: 'instant_book',
    coords: { lat: -1.7, lng: 29.256 },
    maxGuests: 2,
    active: true,
    meta: ['1 bed', 'Parking', 'Two minutes to the beach'],
    agent: 'Gisenyi Beach Motel',
    description:
      'Plain, clean and two minutes from the public beach. Parking inside the gate, hot water in the mornings, and a kiosk next door that opens early.',
    photos: {
      cover: 'lake-kivu-02',
      gallery: ['lake-kivu-01', 'lake-kivu-03', 'karongi-01', 'karongi-02'],
      thumbnail: 'lake-kivu-02',
    },
  },
  {
    id: 'kigali-cbd-loft',
    title: 'Kigali CBD Loft',
    location: 'Nyarugenge, Kigali',
    place: 'Nyarugenge',
    district: 'kigali',
    class: 'apartment',
    domain: 'hospitality',
    price: 61000,
    per: 'night',
    score: 7.8,
    reviews: 96,
    bookingMode: 'instant_book',
    coords: { lat: -1.9445, lng: 30.0588 },
    maxGuests: 2,
    active: true,
    meta: ['Studio', 'Lift', 'City view'],
    agent: 'Centre Lofts',
    description:
      'A studio on the ninth floor in the middle of town, with a lift that works, a desk at the window and every bus route in the country outside the door.',
    photos: {
      cover: 'kigali-cbd-buildings-01',
      gallery: [
        'kigali-night-panorama-02',
        'kigali-parliament-aerial-01',
        'kigali-skyline-01',
        'kigali-city-street-01',
      ],
      thumbnail: 'kigali-cbd-buildings-01',
    },
  },
  {
    id: 'virunga-tea-retreat',
    title: 'Virunga Tea Retreat',
    location: 'Musanze, Northern Province',
    place: 'Musanze',
    district: 'musanze',
    class: 'lodge',
    domain: 'hospitality',
    price: 182000,
    per: 'night',
    score: 8.4,
    reviews: 52,
    bookingMode: 'request_to_book',
    coords: { lat: -1.545, lng: 29.58 },
    maxGuests: 4,
    active: false,
    meta: ['Half board', 'Tea estate walk', '4 guests'],
    agent: 'Virunga Tea Estates',
    description:
      'Four rooms on a working tea estate under the Virungas, half board, with an estate walk before breakfast. Closed to new bookings while the main house is re-roofed.',
    photos: {
      cover: 'rwanda-tea-02',
      gallery: ['rwanda-tea-01', 'volcanoes-np-03', 'volcanoes-np-02', 'mountain-gorilla-01'],
      thumbnail: 'rwanda-tea-02',
    },
  },
];

/**
 * Stars out of five from the score out of ten, to one decimal.
 *
 * The two are one opinion on two scales and were being written twice. Exported
 * so a test can assert the relationship rather than re-do the arithmetic.
 */
export function ratingFromScore(score: number): number {
  return Math.round((score / 2) * 10) / 10;
}

/** Publicly explorable Hospitality stays. Same tile shape as the Directory. */
export const STAYS: Stay[] = STAY_SEEDS.map((seed) => ({
  ...seed,
  rating: ratingFromScore(seed.score),
}));

/**
 * What Explore may show. A property with no published listing is not
 * discoverable — it is only reachable from a Saved row that predates its
 * closing, which is exactly the case ADR-032 asks Saved to render as
 * unavailable rather than to drop.
 */
export const EXPLORABLE_STAYS: Stay[] = STAYS.filter((s) => s.active);

export function getStay(id: string): Stay | undefined {
  return STAYS.find((s) => s.id === id);
}

/**
 * The trip half of this file moved to `./trips` in Session 5.
 *
 * It grew a join: a trip now needs the property's check-in time, its street
 * line and whether it offers self check-in, and all three live in
 * `./property-detail` — which imports `Stay` from here. Keeping the trips
 * beside the stays would have meant a cycle between the two modules, so the
 * trips moved to the file that is allowed to import both.
 *
 * `Trip`, `TRIPS`, `getTrip`, `BookingState` and `UPCOMING_STATES` are all
 * exported from `./trips` now, unchanged in name.
 */

/*
 * There is deliberately no `GUEST` persona here any more. Its `user` was the
 * fixture person `ME`, and Explore greeted every account by that name
 * (mobile audit 2026-10-05, GB-02). The person holding the phone comes from
 * `useMyIdentity()` in `@/queries/profile`, and from nowhere in this file.
 */
