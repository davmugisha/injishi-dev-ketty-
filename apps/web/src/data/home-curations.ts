import type { AccommodationClass } from "@injishi/contracts";
import { FEATURED_STAYS } from "@/data/featured-stays";
import { LISTINGS, type Listing } from "@/data/listings";
import type { GalleryImage } from "@/data/properties";
import type { DistrictSlug } from "@/data/search-options";

/**
 * The landing page's curated bands, in one place — ADR-022.
 *
 * Everything here is fixture curation, the same standing as `FEATURED_STAYS`:
 * hand-picked from the properties the app already carries, never invented.
 * When the API grows a server-side answer for any of these (booking counts
 * per city, saved explore filters), the band swaps its import and this file
 * shrinks. Where the corpus records the open decision, the entry cites it.
 */

/* --------------------------------------------------------- stays this week */

/**
 * Band 02's four stays: the same curation the coverflow featured, laid flat.
 * One curated set, two renderings — this band replaced the deck (ADR-022), so
 * it derives from the deck's own picks rather than starting a second list
 * that would drift.
 */
export const STAYS_THIS_WEEK: Listing[] = FEATURED_STAYS.map((stay) =>
  LISTINGS.find((listing) => listing.slug === stay.slug),
)
  .filter((listing): listing is Listing => listing !== undefined)
  .slice(0, 4);

/* ------------------------------------------------------ browse by category */

export interface StayCategory {
  kind: AccommodationClass;
  label: string;
  /** The photograph is honest about what it shows; the label names the filter. */
  image: GalleryImage;
}

/**
 * Six fixed types (ADR-022 AC-5). Motel and guest house hold zero fixture
 * properties today; their tiles land on explore's empty state, which is the
 * honest answer — the filter is real, the inventory is not there yet.
 */
export const STAY_CATEGORIES: StayCategory[] = [
  {
    kind: "hotel",
    label: "Hotel",
    image: { stem: "mille-collines-02", alt: "Hotel grounds and pool in Kigali" },
  },
  {
    kind: "motel",
    label: "Motel",
    image: { stem: "kigali-city-street-01", alt: "A street in central Kigali" },
  },
  {
    kind: "tented_camp",
    label: "Tented camp",
    image: { stem: "akagera-np-01", alt: "Savannah in Akagera National Park" },
  },
  {
    kind: "guest_house",
    label: "Guest house",
    image: { stem: "karongi-01", alt: "Karongi hillside above Lake Kivu" },
  },
  {
    kind: "apartment",
    label: "Apartment",
    image: {
      stem: "rwanda-apartment-interior",
      alt: "Serviced apartment interior in Rwanda",
    },
  },
  {
    kind: "villa",
    label: "Villa",
    image: { stem: "rwanda-district-rubavu", alt: "Homes on the Rubavu shoreline" },
  },
];

/* ------------------------------------------------------- most booked cities */

export interface CityTab {
  id: string;
  label: string;
  /** Absent where the city is not a district the search knows (Huye). */
  district: DistrictSlug | null;
  stays: Listing[];
}

function cityStays(district: DistrictSlug): Listing[] {
  return LISTINGS.filter((listing) => listing.district === district).slice(0, 4);
}

/**
 * Band 06's tabs. CURATED, not measured — nothing counts bookings yet
 * (ADR-022 owed decision 3). The five cities are the engineer's list; a city
 * with no fixture stays keeps its tab and shows the empty state rather than
 * borrowed cards. Swap `cityStays` for the booking-count query when one
 * exists, and retitle nothing: the heading's claim is ratification's problem.
 */
export const MOST_BOOKED_CITIES: CityTab[] = [
  { id: "kigali", label: "Kigali", district: "kigali", stays: cityStays("kigali") },
  { id: "musanze", label: "Musanze", district: "musanze", stays: cityStays("musanze") },
  { id: "rubavu", label: "Rubavu", district: "rubavu", stays: cityStays("rubavu") },
  { id: "karongi", label: "Karongi", district: "karongi", stays: cityStays("karongi") },
  { id: "huye", label: "Huye", district: null, stays: [] },
];

/* -------------------------------------------------- stays for every trip */

export interface TripDestination {
  name: string;
  /** One geographic fact, not marketing. */
  note: string;
  /**
   * The short character label on the photograph, or null for no badge.
   *
   * Null on three of the twenty on purpose. A badge on every tile is
   * wallpaper: the eye stops reading them and the row loses the emphasis the
   * badge was for. Each one restates its own `note` in two words, so nothing
   * here claims anything the note does not already claim.
   */
  tag: string | null;
  image: GalleryImage;
  /** Absent where no district slug matches; the card then links to /explore. */
  district: DistrictSlug | null;
}

export interface TripStyle {
  id: string;
  label: string;
  destinations: TripDestination[];
}

/**
 * Band 07's tabs (ADR-022 AC-7). Each destination is a real place, its note a
 * geographic fact, its photograph from the app's own sourced library. Tabs
 * become saved explore filters when explore grows them; until then each card
 * links at the district where one exists.
 */
export const TRIP_STYLES: TripStyle[] = [
  {
    id: "lakeside",
    label: "Lakeside",
    destinations: [
      {
        name: "Rubavu",
        note: "Lake Kivu's northern shore",
        tag: "Lake town",
        image: { stem: "lake-kivu-01", alt: "Lake Kivu shoreline at Rubavu" },
        district: "rubavu",
      },
      {
        name: "Karongi",
        note: "Bays and island views at Kibuye",
        tag: "Island bays",
        image: { stem: "karongi-02", alt: "A bay at Karongi on Lake Kivu" },
        district: "karongi",
      },
      {
        name: "Rusizi",
        note: "The quiet southern lakeshore",
        tag: "Quiet shore",
        image: { stem: "lake-kivu-02", alt: "Boats on Lake Kivu" },
        district: "rusizi",
      },
      {
        name: "Lake Kivu shore",
        note: "Green hills meeting the water",
        tag: null,
        image: { stem: "lake-kivu-03", alt: "Hills meeting Lake Kivu" },
        district: null,
      },
    ],
  },
  {
    id: "gorilla-trekking",
    label: "Gorilla trekking",
    destinations: [
      {
        name: "Kinigi",
        note: "The trailhead village for the gorillas",
        tag: "Trailhead",
        image: { stem: "mountain-gorilla-01", alt: "A mountain gorilla in the forest" },
        district: "musanze",
      },
      {
        name: "Musanze",
        note: "The base town under the volcanoes",
        tag: "Volcano base",
        image: { stem: "volcanoes-np-02", alt: "Volcanoes National Park peaks" },
        district: "musanze",
      },
      {
        name: "Volcanoes National Park",
        note: "Five volcanoes on the northern border",
        tag: "Park gate",
        image: { stem: "volcanoes-np-03", alt: "A volcano above the farmland" },
        district: "musanze",
      },
      {
        name: "Musanze foothills",
        note: "Farmland under the massif",
        tag: null,
        image: { stem: "rwanda-tea-02", alt: "Tea fields in the Rwandan hills" },
        district: "musanze",
      },
    ],
  },
  {
    id: "city-break",
    label: "City break",
    destinations: [
      {
        name: "Kiyovu",
        note: "The old leafy centre of Kigali",
        tag: "Old centre",
        image: { stem: "mille-collines-02", alt: "Hotel grounds in Kiyovu, Kigali" },
        district: "kigali",
      },
      {
        name: "Kigali CBD",
        note: "The business district on the hilltop",
        tag: "Hilltop city",
        image: { stem: "kigali-skyline-01", alt: "The Kigali skyline" },
        district: "kigali",
      },
      {
        name: "Kimihurura",
        note: "Restaurants and nightlife on the ridge",
        tag: "Nightlife ridge",
        image: { stem: "kigali-night-panorama-02", alt: "Kigali at night" },
        district: "kigali",
      },
      {
        name: "Nyarutarama",
        note: "Green residential hills by the golf course",
        tag: "Green suburb",
        image: { stem: "kigali-hills-view-01", alt: "View over Kigali's hills" },
        district: "kigali",
      },
    ],
  },
  {
    id: "safari",
    label: "Safari",
    destinations: [
      {
        name: "Akagera south",
        note: "Savannah plains at the southern gate",
        tag: "Savannah gate",
        image: { stem: "akagera-np-01", alt: "Savannah in Akagera National Park" },
        district: "nyagatare",
      },
      {
        name: "Akagera lakes",
        note: "Lakes and wetland along the eastern edge",
        tag: "Wetland edge",
        image: { stem: "akagera-np-02", alt: "A lake in Akagera National Park" },
        district: "nyagatare",
      },
      {
        name: "Nyagatare",
        note: "The northern gateway to Akagera",
        tag: null,
        image: { stem: "akagera-np-03", alt: "Grassland in Akagera National Park" },
        district: "nyagatare",
      },
      {
        name: "Nyungwe Forest",
        note: "Canopy walks in the southwest rainforest",
        tag: "Rainforest",
        image: { stem: "nyungwe-forest-02", alt: "Rainforest canopy at Nyungwe" },
        district: "rusizi",
      },
    ],
  },
  {
    id: "business",
    label: "Business",
    destinations: [
      {
        name: "Kigali CBD",
        note: "Banks and offices on the central hill",
        tag: "Banking hill",
        image: { stem: "kigali-cbd-buildings-01", alt: "Office towers in central Kigali" },
        district: "kigali",
      },
      {
        name: "Kimihurura",
        note: "The convention centre district",
        tag: "Convention district",
        image: {
          stem: "kigali-convention-centre-02",
          alt: "The Amberhill convention wing dome",
        },
        district: "kigali",
      },
      {
        name: "Kacyiru",
        note: "The government and embassy quarter",
        tag: "Embassy quarter",
        image: { stem: "kigali-parliament-aerial-01", alt: "Aerial view over Kacyiru, Kigali" },
        district: "kigali",
      },
      {
        name: "Remera",
        note: "Close to the airport road",
        tag: "Airport road",
        image: { stem: "kigali-hills-view-01", alt: "View over Kigali's hills" },
        district: "kigali",
      },
    ],
  },
];

/** An averaged rate, carrying the basis it was averaged over. */
export interface DestinationRate {
  amountRwf: number;
  /** The words under the figure. Never dropped; see below. */
  basis: string;
}

/**
 * What a night in this destination actually costs, averaged over the stays the
 * app carries there.
 *
 * DERIVED, not invented — unlike `data/demo-commerce.ts`, which fabricates the
 * numbers a listing card prints. Every figure here is the mean of real
 * published nightly rates, so a tile cannot quote a price no property charges.
 * The catch is coverage: the mean is over the fixture catalogue, not over the
 * market, so a district holding two stays reports those two.
 *
 * THE BASIS IS RETURNED WITH THE NUMBER, and that is the whole reason this
 * returns an object rather than an integer. A gorilla-trekking lodge quotes per
 * person and bundles meals, drinks and the permit; a lakeside guesthouse quotes
 * per room, room only. Mixing the two produced "4,423,500 RWF avg per night"
 * over Rusizi, which is true of no stay anyone can book there and reads as a
 * typo. Seen on the rendered band, not reasoned about in the abstract.
 *
 * The first fix was to drop per-person stays from the mean. That was worse:
 * every district behind the Safari tab quotes per person, so the whole tab
 * printed no price at all and looked broken. So the two bases are averaged
 * SEPARATELY and the per-room mean wins where one exists, because that is the
 * number most readers are comparing. Where a district only ever quotes per
 * person, the tile says so under the figure.
 *
 * Returns null only where nothing can be averaged: no district slug, or a
 * district whose stays all quote per itinerary rather than per night.
 */
export function destinationAvgNightly(
  destination: TripDestination,
): DestinationRate | null {
  if (!destination.district) return null;

  const inDistrict = LISTINGS.filter(
    (listing) =>
      listing.district === destination.district && listing.nightlyRateRwf !== null,
  );

  const perPerson = inDistrict.filter((listing) => /person/i.test(listing.priceBasis));
  const perRoom = inDistrict.filter((listing) => !/person/i.test(listing.priceBasis));

  const chosen = perRoom.length ? perRoom : perPerson;
  if (!chosen.length) return null;

  const rates = chosen.map((listing) => listing.nightlyRateRwf as number);
  const mean = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;

  return {
    amountRwf: Math.round(mean / 500) * 500,
    basis: perRoom.length ? "avg per night" : "avg per person / night",
  };
}
