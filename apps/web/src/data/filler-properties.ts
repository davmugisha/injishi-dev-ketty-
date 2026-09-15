// EVERY INVENTED PROPERTY, IN ONE FILE. Nothing here is a real business.
//
// `data/properties.ts` holds thirty more fictional stays. They were real,
// operating Rwandan businesses until 2026-09-14, when the demo renamed them;
// this file predates that and keeps its own twenty-two.
//
// The explore page was rebuilt as a dense search-results surface, and the brief
// asked for more stock where the page reads thin. Thirty listings over a
// twenty-block filter rail leaves most facets showing a count of one or zero,
// which makes a working filter look broken. So this file adds twenty-two
// FICTIONAL stays to fill the grid.
//
// THE NAMES ARE DELIBERATELY FICTIONAL. Not one of them is, or resembles, a
// trading company. Inventing a rate, a score or a review count for a named real
// hotel would be publishing a claim about someone else's business; inventing a
// whole hotel that does not exist is a fixture. The distinction is the reason
// this file exists as a separate module rather than as twenty-two more entries
// in the real one.
//
// WHEN THE SEARCH ENDPOINT LANDS (F-S05), DELETE THIS FILE. The catalogue then
// comes from the API and padding it locally stops meaning anything.
//
// Written as compact SEEDS expanded by a builder, not as twenty-two full
// records. A full `PropertyDetail` is ~90 lines and the ~70 lines of each that
// this page never reads would be ~1,500 lines of invented prose nobody will
// ever check. The seed carries only what the explore surfaces actually use;
// the builder fills the rest with honest, generic copy.
import type { AccommodationClass } from "@injishi/contracts";
import type { DistrictSlug } from "@/data/search-options";
import type { Amenity, PropertyDetail } from "@/data/properties";

interface FillerSeed {
  slug: string;
  /** Split as the card prints it: `lead` bold, `rest` regular. */
  lead: string;
  rest: string;
  /** Neighbourhood, district. */
  location: string;
  district: DistrictSlug;
  kind: AccommodationClass;
  /** Null where the class does not carry a star rating. */
  starClass: number | null;
  rooms: number | null;
  bedrooms: number;
  maxGuests: number;
  /** Null means "rate on request", which a tenth of the real catalogue also is. */
  rateRwf: number | null;
  basis: string;
  includes: string;
  /** Out of 10, or null where a stay is too new to carry one. */
  score: number | null;
  amenities: string[];
  /** Image stems from `public/assets`. First is the card image. */
  stems: string[];
}

const SEEDS: FillerSeed[] = [
  {
    slug: "umuganda-heights-suites",
    lead: "Umuganda Heights",
    rest: "Suites",
    location: "Kacyiru, Kigali",
    district: "kigali",
    kind: "apartment",
    starClass: 4,
    rooms: 48,
    bedrooms: 2,
    maxGuests: 4,
    rateRwf: 96000,
    basis: "per apartment, per night",
    includes: "Room only",
    score: 8.6,
    amenities: ["Free WiFi", "Kitchen or kitchenette", "Fitness centre", "Parking", "Washing machine", "Private balconies"],
    stems: ["rwanda-apartment-interior", "kigali-hills-view-01", "kigali-cbd-buildings-01", "kigali-skyline-01"],
  },
  {
    slug: "kivu-shoreline-lodge",
    lead: "Kivu Shoreline",
    rest: "Lodge",
    location: "Kibuye, Karongi",
    district: "karongi",
    kind: "lodge",
    starClass: 4,
    rooms: 22,
    bedrooms: 1,
    maxGuests: 2,
    rateRwf: 128000,
    basis: "per room, per night",
    includes: "Breakfast included",
    score: 9.1,
    amenities: ["Free WiFi", "Restaurant", "Bar", "Outdoor swimming pool", "Private beach exclusively for hotel guests", "Terrace"],
    stems: ["karongi-01", "lake-kivu-01", "lake-kivu-02", "karongi-02"],
  },
  {
    slug: "nyandungu-garden-rooms",
    lead: "Nyandungu",
    rest: "Garden Rooms",
    location: "Remera, Kigali",
    district: "kigali",
    kind: "guest_house",
    starClass: 3,
    rooms: 14,
    bedrooms: 1,
    maxGuests: 2,
    rateRwf: 38000,
    basis: "per room, per night",
    includes: "Breakfast included",
    score: 8.2,
    amenities: ["Free WiFi", "À la carte breakfast", "Parking", "Terrace", "24-hour front desk"],
    stems: ["stay-04", "stay-11", "kigali-city-street-01", "stay-19"],
  },
  {
    slug: "virunga-ridge-cottages",
    lead: "Virunga Ridge",
    rest: "Cottages",
    location: "Kinigi, Musanze",
    district: "musanze",
    kind: "lodge",
    starClass: 5,
    rooms: 10,
    bedrooms: 2,
    maxGuests: 4,
    rateRwf: 412000,
    basis: "per person, per night",
    includes: "All meals, drinks and laundry",
    score: 9.4,
    amenities: ["Free WiFi", "Restaurant", "Spa", "Private outdoor heated plunge pools", "Three fireplaces", "Private terrace with volcano and lake views"],
    stems: ["volcanoes-np-02", "mountain-gorilla-01", "volcanoes-np-03", "stay-07"],
  },
  {
    slug: "akagera-plains-tented-camp",
    lead: "Akagera Plains",
    rest: "Tented Camp",
    location: "Kayonza gate, Nyagatare",
    district: "nyagatare",
    kind: "tented_camp",
    starClass: null,
    rooms: 12,
    bedrooms: 1,
    maxGuests: 2,
    rateRwf: null,
    basis: "per person, per itinerary",
    includes: "All meals and two game drives daily",
    score: 9.0,
    amenities: ["Wi-Fi in each tent and in the lounge", "Restaurant", "Bar", "Walk-in mosquito nets", "Private viewing decks", "Solar power in tents and main area, 24 hours a day"],
    stems: ["akagera-np-01", "akagera-np-02", "akagera-np-03", "stay-15"],
  },
  {
    slug: "gisenyi-bay-apartments",
    lead: "Gisenyi Bay",
    rest: "Apartments",
    location: "Rubavu town, Rubavu",
    district: "rubavu",
    kind: "apartment",
    starClass: 3,
    rooms: 30,
    bedrooms: 3,
    maxGuests: 6,
    rateRwf: 72000,
    basis: "per apartment, per night",
    includes: "Room only",
    score: 8.0,
    amenities: ["Free WiFi", "Kitchen or kitchenette", "Washing machine", "Parking", "Private balcony with lake views in every room"],
    stems: ["lake-kivu-03", "rwanda-district-rubavu", "rwanda-apartment-interior", "stay-02"],
  },
  {
    slug: "nyungwe-canopy-retreat",
    lead: "Nyungwe Canopy",
    rest: "Retreat",
    location: "Gisakura, Rusizi",
    district: "rusizi",
    kind: "lodge",
    starClass: 4,
    rooms: 18,
    bedrooms: 1,
    maxGuests: 2,
    rateRwf: 245000,
    basis: "per person, per night",
    includes: "All meals and one guided forest walk",
    score: 9.2,
    amenities: ["Wi-Fi in rooms and main area", "Restaurant", "Bar", "Spa / wellness menu", "Sheltered verandas", "Signature chimpanzee discovery trek"],
    stems: ["nyungwe-forest-02", "nyungwe-forest-03", "stay-09", "rwanda-tea-01"],
  },
  {
    slug: "kimironko-market-rooms",
    lead: "Kimironko",
    rest: "Market Rooms",
    location: "Kimironko, Kigali",
    district: "kigali",
    kind: "guest_house",
    starClass: 2,
    rooms: 9,
    bedrooms: 1,
    maxGuests: 2,
    rateRwf: 24000,
    basis: "per room, per night",
    includes: "Room only",
    score: 7.4,
    amenities: ["Free WiFi", "Parking", "En-suite bathrooms"],
    stems: ["stay-12", "kigali-city-street-01", "stay-18", "stay-05"],
  },
  {
    slug: "lake-muhazi-boathouse",
    lead: "Lake Muhazi",
    rest: "Boathouse",
    location: "Rwesero, Nyagatare",
    district: "nyagatare",
    kind: "guest_house",
    starClass: 3,
    rooms: 16,
    bedrooms: 2,
    maxGuests: 4,
    rateRwf: 54000,
    basis: "per room, per night",
    includes: "Breakfast included",
    score: 8.4,
    amenities: ["Free WiFi", "Restaurant on stilts over the lake", "Bar", "Water sports on the lake including jet skiing", "Raised deck over Lake Ihema"],
    stems: ["stay-06", "stay-16", "akagera-np-03", "stay-21"],
  },
  {
    slug: "ridgeview-loft-serviced-flats",
    lead: "Lavender Hill",
    rest: "Serviced Flats",
    location: "Kimihurura, Kigali",
    district: "kigali",
    kind: "apartment",
    starClass: 5,
    rooms: 64,
    bedrooms: 2,
    maxGuests: 4,
    rateRwf: 164000,
    basis: "per apartment, per night",
    includes: "Breakfast included",
    score: 9.3,
    amenities: ["Free WiFi", "Kitchen or kitchenette", "Fitness centre", "Outdoor swimming pool", "24-hour front desk", "Room service", "Airport shuttle"],
    stems: ["kigali-convention-centre-02", "kigali-cbd-buildings-01", "rwanda-apartment-interior", "kigali-night-panorama-02"],
  },
  {
    slug: "musanze-farmstead-guesthouse",
    lead: "Musanze",
    rest: "Farmstead Guesthouse",
    location: "Musanze town, Musanze",
    district: "musanze",
    kind: "guest_house",
    starClass: 3,
    rooms: 11,
    bedrooms: 2,
    maxGuests: 5,
    rateRwf: 46000,
    basis: "per room, per night",
    includes: "Breakfast included",
    score: 8.7,
    amenities: ["Free WiFi", "Organic vegetable garden", "Restaurant", "Parking", "Timber-framed volcano-view windows"],
    stems: ["rwanda-district-musanze", "stay-03", "volcanoes-np-03", "stay-20"],
  },
  {
    slug: "rusizi-border-hotel",
    lead: "Rusizi Border",
    rest: "Hotel",
    location: "Kamembe, Rusizi",
    district: "rusizi",
    kind: "hotel",
    starClass: 4,
    rooms: 78,
    bedrooms: 1,
    maxGuests: 2,
    rateRwf: 88000,
    basis: "per room, per night",
    includes: "Breakfast included",
    score: 8.1,
    amenities: ["Free WiFi", "Restaurant", "Bar", "Outdoor swimming pool", "Business centre", "Airport shuttle", "24-hour front desk"],
    stems: ["stay-08", "lake-kivu-02", "stay-14", "stay-22"],
  },
  {
    slug: "karongi-hillside-villas",
    lead: "Karongi Hillside",
    rest: "Villas",
    location: "Bwishyura, Karongi",
    district: "karongi",
    kind: "villa",
    starClass: null,
    rooms: 6,
    bedrooms: 4,
    maxGuests: 8,
    rateRwf: 218000,
    basis: "per villa, per night",
    includes: "Room only",
    score: 9.0,
    amenities: ["Free WiFi", "Kitchen or kitchenette", "Outdoor swimming pool", "Private hot tub and balcony per suite", "Washing machine", "Parking"],
    stems: ["karongi-02", "lake-kivu-01", "stay-13", "stay-01"],
  },
  {
    slug: "nyamirambo-townhouse",
    lead: "Nyamirambo",
    rest: "Townhouse",
    location: "Nyamirambo, Kigali",
    district: "kigali",
    kind: "villa",
    starClass: null,
    rooms: 1,
    bedrooms: 3,
    maxGuests: 6,
    rateRwf: 64000,
    basis: "per house, per night",
    includes: "Room only",
    score: 8.3,
    amenities: ["Free WiFi", "Kitchen or kitchenette", "Washing machine", "Terrace", "Parking"],
    stems: ["stay-17", "kigali-city-street-01", "stay-10", "rwanda-district-kigali"],
  },
  {
    slug: "gorilla-gate-tented-lodge",
    lead: "Gorilla Gate",
    rest: "Tented Lodge",
    location: "Nyange, Musanze",
    district: "musanze",
    kind: "tented_camp",
    starClass: null,
    rooms: 8,
    bedrooms: 1,
    maxGuests: 2,
    rateRwf: null,
    basis: "per person, per itinerary",
    includes: "All meals, drinks and one gorilla trek transfer",
    score: 9.5,
    amenities: ["Wi-Fi throughout the lodge", "Restaurant", "Bar", "Wood-fired hot tubs on private decks", "Post-trek foot massage", "Three fireplaces"],
    stems: ["mountain-gorilla-02", "volcanoes-np-02", "stay-23", "mountain-gorilla-01"],
  },
  {
    slug: "rubavu-beach-hotel",
    lead: "Rubavu Beach",
    rest: "Hotel",
    location: "Gisenyi shore, Rubavu",
    district: "rubavu",
    kind: "hotel",
    starClass: 4,
    rooms: 92,
    bedrooms: 1,
    maxGuests: 3,
    rateRwf: 112000,
    basis: "per room, per night",
    includes: "Breakfast included",
    score: 8.5,
    amenities: ["Free WiFi", "Two restaurants", "Bar", "Tropical pool", "Small man-made beach with sun umbrellas", "Windsurfing", "Spa"],
    stems: ["rwanda-lake-kivu", "lake-kivu-03", "rwanda-district-rubavu", "stay-02"],
  },
  {
    slug: "kacyiru-business-inn",
    lead: "Kacyiru",
    rest: "Business Inn",
    location: "Kacyiru, Kigali",
    district: "kigali",
    kind: "hotel",
    starClass: 3,
    rooms: 54,
    bedrooms: 1,
    maxGuests: 2,
    rateRwf: 58000,
    basis: "per room, per night",
    includes: "Breakfast included",
    score: 7.8,
    amenities: ["Free WiFi", "Business centre", "Restaurant", "Parking", "24-hour front desk", "Fitness centre"],
    stems: ["kigali-parliament-aerial-01", "stay-05", "kigali-cbd-buildings-01", "stay-11"],
  },
  {
    slug: "tea-country-plantation-house",
    lead: "Tea Country",
    rest: "Plantation House",
    location: "Gisakura, Rusizi",
    district: "rusizi",
    kind: "guest_house",
    starClass: 3,
    rooms: 7,
    bedrooms: 2,
    maxGuests: 4,
    rateRwf: 78000,
    basis: "per room, per night",
    includes: "Breakfast and afternoon tea",
    score: 8.9,
    amenities: ["Free WiFi", "Working tea plantation and guided tea tasting", "Restaurant", "Shaded verandas with campaign chairs", "Parking"],
    stems: ["rwanda-tea-01", "rwanda-tea-02", "nyungwe-forest-03", "stay-09"],
  },
  {
    slug: "muhabura-view-hostel",
    lead: "Muhabura View",
    rest: "Hostel",
    location: "Musanze town, Musanze",
    district: "musanze",
    kind: "other",
    starClass: null,
    rooms: 12,
    bedrooms: 1,
    maxGuests: 2,
    rateRwf: 16000,
    basis: "per bed, per night",
    includes: "Room only",
    score: 7.2,
    amenities: ["Free WiFi", "Kitchen or kitchenette", "Bar", "Terrace"],
    stems: ["stay-20", "rwanda-district-musanze", "stay-03", "stay-12"],
  },
  {
    slug: "akagera-riverside-camp",
    lead: "Akagera Riverside",
    rest: "Camp",
    location: "Rwempasha, Nyagatare",
    district: "nyagatare",
    kind: "tented_camp",
    starClass: null,
    rooms: 15,
    bedrooms: 1,
    maxGuests: 3,
    rateRwf: 134000,
    basis: "per person, per night",
    includes: "All meals and one boat safari",
    score: 8.8,
    amenities: ["Wi-Fi in each tent and in the lounge", "Restaurant and bar", "Walk-in mosquito nets", "Private balconies on stilted decks", "The Boma for drumming and dance performances"],
    stems: ["akagera-np-02", "akagera-np-01", "stay-15", "stay-21"],
  },
  {
    slug: "gasabo-skyline-residences",
    lead: "Gasabo Skyline",
    rest: "Residences",
    location: "Gacuriro, Kigali",
    district: "kigali",
    kind: "apartment",
    starClass: 4,
    rooms: 40,
    bedrooms: 1,
    maxGuests: 2,
    rateRwf: 68000,
    basis: "per apartment, per night",
    includes: "Room only",
    score: null,
    amenities: ["Free WiFi", "Kitchen or kitchenette", "Outdoor swimming pool", "Fitness centre", "Parking", "Washing machine"],
    stems: ["kigali-skyline-01", "rwanda-apartment-interior", "kigali-hills-view-01", "stay-19"],
  },
  {
    slug: "kivu-fishermans-rest",
    lead: "Kivu Fisherman's",
    rest: "Rest",
    location: "Kinunu, Rubavu",
    district: "rubavu",
    kind: "guest_house",
    starClass: 2,
    rooms: 8,
    bedrooms: 2,
    maxGuests: 4,
    rateRwf: 32000,
    basis: "per room, per night",
    includes: "Breakfast included",
    score: null,
    amenities: ["Free WiFi", "Restaurant", "Private balcony with sunrise or sunset views", "Parking"],
    stems: ["lake-kivu-02", "stay-16", "lake-kivu-01", "stay-06"],
  },
];

/**
 * Expand one seed into the full record the rest of the app expects.
 *
 * The generic halves — `about`, `highlights`, `thingsToKnow`, `place.blurb` —
 * are written from the seed's own fields rather than invented per property. A
 * fictional stay that carries three paragraphs of fictional history reads as a
 * real one, which is the thing this file is careful not to be.
 */
function toProperty(seed: FillerSeed): PropertyDetail {
  const amenities: Amenity[] = seed.amenities.map((label) => ({
    // The `icon` field is unusable everywhere in this app — the real fixtures
    // carry Phosphor names that never matched the lucide map. The card picks
    // its mark from the LABEL through `lib/amenity-icon.ts`. Carried as an
    // empty string rather than a plausible-looking wrong name.
    icon: "",
    label,
  }));

  const [cardStem, ...restStems] = seed.stems;
  const alt = `${seed.lead} ${seed.rest}, ${seed.location}`;
  const gallery = seed.stems.map((stem, index) => ({
    stem,
    alt: `${seed.lead} ${seed.rest}, view ${index + 1}`,
  }));

  const className = seed.starClass ? `${seed.starClass}-star` : "Unrated";
  const neighbourhood = seed.location.split(",")[0]!.trim();

  return {
    slug: seed.slug,
    name: `${seed.lead} ${seed.rest}`,
    location: seed.location,
    district: seed.district,
    kind: seed.kind,
    propertyType: `${neighbourhood}, ${seed.location.split(",")[1]?.trim() ?? ""}`.trim(),
    starClass: seed.starClass,
    rooms: seed.rooms,
    bedrooms: seed.bedrooms,
    maxGuests: seed.maxGuests,
    capacity: [
      seed.rooms ? `${seed.rooms} rooms` : `${seed.bedrooms} bedrooms`,
      className,
      seed.basis,
    ],
    heroImage: { stem: cardStem!, alt },
    gallery,
    photoCount: gallery.length,
    price: {
      fromUsd: null,
      fromRwf: seed.rateRwf,
      basis: seed.basis,
      includes: seed.includes,
    },
    nightlyRateRwf: seed.rateRwf,
    rating: seed.score
      ? {
          score: seed.score,
          outOf: 10,
          // Attribution is mandatory on a score everywhere in this app, and
          // the honest attribution for an invented one is that it is invented.
          source: "Injishi sample data",
          sourceUrl: "/legal/terms",
        }
      : null,
    operator: null,
    cardName: { lead: seed.lead, rest: seed.rest },
    summary: [className, seed.includes].filter(Boolean).join(" • "),
    cardImage: { stem: cardStem!, alt },
    about: [
      `A sample listing used to fill the Injishi catalogue while the search endpoint is being built. It is not a real business.`,
      seed.rateRwf
        ? `Sample rate ${seed.rateRwf.toLocaleString("en-RW")} RWF ${seed.basis}, ${seed.includes.toLowerCase()}.`
        : `Sample stay quoted ${seed.basis}, ${seed.includes.toLowerCase()}.`,
    ],
    highlights: [
      {
        icon: "location",
        title: "Where it sits",
        body: `${neighbourhood}, in ${seed.location.split(",")[1]?.trim() ?? "Rwanda"}.`,
      },
      {
        icon: "calendar",
        title: seed.rooms ? `${seed.rooms} rooms` : `${seed.bedrooms} bedrooms`,
        body: `Sleeps up to ${seed.maxGuests}.`,
      },
      {
        icon: "sparkle",
        title: "Sample listing",
        body: "This entry is fixture data, not a real accommodation.",
      },
    ],
    specs: [
      { label: "Type", value: seed.kind },
      { label: "Class", value: className },
      { label: "Bedrooms", value: String(seed.bedrooms) },
      { label: "Neighbourhood", value: neighbourhood },
      { label: "Rate basis", value: seed.basis },
      { label: "Included", value: seed.includes },
    ],
    amenities,
    place: {
      addressLines: [neighbourhood, "Rwanda"],
      latitude: null,
      longitude: null,
      blurb: `${neighbourhood} sits in ${seed.location.split(",")[1]?.trim() ?? "Rwanda"}. This is a sample listing and has no real address.`,
    },
    thingsToKnow: [
      {
        title: "House rules",
        icon: "rules",
        items: [
          "Check-in and checkout times are set by the accommodation",
          "This is a sample listing and cannot be booked",
        ],
        learnMoreHref: "/support",
      },
      {
        title: "Paying through Injishi",
        icon: "safety",
        items: [
          "Payment is held in escrow until check-in",
          "Released to the host only once you have arrived",
        ],
        learnMoreHref: "/how-it-works#escrow",
      },
      {
        title: "Cancellation",
        icon: "cancellation",
        items: [
          "Cancellation terms are set by the accommodation, not by Injishi",
          "You will see them in full before you pay",
        ],
        learnMoreHref: "/legal/terms",
      },
    ],
    // Deliberately empty. A sourced record cites where each fact came from;
    // this one has no sources because it has no facts.
    sources: [],
  };
  // `restStems` is destructured only to document that the first stem is the
  // card image and the rest are gallery-only. It is intentionally unused.
  void restStems;
}

/** The twenty-two fictional stays, in seed order. */
export const FILLER_PROPERTIES: PropertyDetail[] = SEEDS.map(toProperty);

/** The slugs, so a surface that must exclude sample data can. */
export const FILLER_SLUGS: ReadonlySet<string> = new Set(SEEDS.map((s) => s.slug));
