// HAND MAINTAINED SOURCE. Not generated, and not regenerable (ADR-014 AC-12).
//
// EVERY PROPERTY HERE IS FICTIONAL (2026-09-14). This file used to hold thirty
// real, operating Rwandan businesses under their own names, with their
// websites, published scores and source URLs. The demo publishes a sign in
// code, sells rooms under these names and lets anyone book them, so each record
// was renamed to an invented business and stripped of everything that
// described the real one: operator, website, score, sources, street address,
// coordinates, the about copy and any amenity only that business listed. What
// is left is structural (class, kind, district, room count, the rate figure)
// and is demo data like the rest of the catalogue.
//
// Do not put a real business back in this file. `data/filler-properties.ts`
// holds the other twenty-two fictional stays.
//
// Rates were converted at 1 USD = 1474.51 RWF (2026-08-14) when the figures were
// first written; they are demo rates now.
import type { AccommodationClass } from "@injishi/contracts";
import type { DistrictSlug } from "@/data/search-options";

// There is no local property-kind type. `kind` is `AccommodationClass` from
// @injishi/contracts, which is the same 8-code vocabulary the registration
// wizard offers and the API stores (D24). ADR-011 call 1.
//
// Six fixture values were rewritten to reach it: three `serviced_apartment`
// became `apartment` (a code the real model has soft-retired, naming
// `apartment` as its successor) and one `boutique_hotel` became `hotel`.

export interface SpecRow { label: string; value: string }
export interface Amenity { icon: string; label: string; available?: boolean; group?: string }
/**
 * A photograph. `stem` names a bundled asset under `/assets`; `src`, when set, is
 * the image itself (a property uploaded from the operator app), and wins.
 */
export interface GalleryImage { stem: string; alt: string; src?: string }

export interface Highlight {
  icon: "location" | "checkin" | "workspace" | "kitchen" | "calendar" | "sparkle";
  title: string;
  body: string;
}

/** An aggregate score, always carrying where it came from. */
export interface Rating { score: number; outOf: number; source: string; sourceUrl: string }

/**
 * What a rate actually means.
 *
 * A Kigali hotel quotes per room, room-only. A gorilla-trekking lodge quotes
 * per person and bundles meals, drinks and activities. Presenting both as
 * "from X per night" would compare two different products, so the basis and
 * what it includes travel with the number everywhere it is shown.
 */
export interface Price {
  fromUsd: number | null;
  fromRwf: number | null;
  basis: string;
  includes: string;
}

export interface Place {
  addressLines: [string, string];
  latitude: number | null;
  longitude: number | null;
  blurb: string;
}

export interface ThingsToKnowColumn {
  title: string;
  icon: "rules" | "safety" | "cancellation";
  items: string[];
  learnMoreHref: string;
}

export interface PropertyDetail {
  slug: string;
  name: string;
  location: string;
  district: DistrictSlug;
  kind: AccommodationClass;
  propertyType: string;
  starClass: number | null;
  rooms: number | null;
  bedrooms: number;
  maxGuests: number;
  capacity: string[];
  heroImage: GalleryImage;
  gallery: GalleryImage[];
  photoCount: number;
  price: Price;
  /** Mirror of price.fromRwf, kept for card rendering and sorting. */
  nightlyRateRwf: number | null;
  rating: Rating | null;
  operator: { name: string; website: string | null } | null;
  /** How the name breaks across the card's bold/regular split. */
  cardName: { lead: string; rest: string };
  summary: string;
  cardImage: GalleryImage;
  /** Position on the home page deck. Absent means not featured. */
  featuredRank?: number;
  about: string[];
  highlights: Highlight[];
  specs: SpecRow[];
  amenities: Amenity[];
  place: Place;
  thingsToKnow: ThingsToKnowColumn[];
  /** The URLs this record was read from. */
  sources: string[];
  /*
   * There is no `listing` pointer here any more, and there must not be one.
   *
   * This file is a curated DIRECTORY of fictional demo stays: their
   * neighbourhoods, their photographs and their demo rates.
   * Whether one of them has inventory on Injishi is a fact about the DATABASE,
   * and `data/property-rooms.ts` reads it from the API by slug. A pointer here
   * would be a second, staler copy of the one thing that must never be stale.
   *
   * The field was absent on all 55 records anyway, which is what
   * `data/demo-listing.ts` existed to work around: it lent Umurage Guesthouse's
   * cheapest room to every property in the catalogue whenever a build flag was
   * set, so opening checkout from one catalogue hotel reserved a room somewhere
   * else. Both are deleted (ADR-047).
   */
}

export const PROPERTIES: PropertyDetail[] = [
  {
    slug: "amberhill-convention-hotel",
    name: "Amberhill Convention Hotel",
    location: "Kimihurura, Kigali",
    district: "kigali",
    kind: "hotel",
    propertyType: "Hotel in Kimihurura, Kigali",
    starClass: 5,
    rooms: 292,
    bedrooms: 1,
    maxGuests: 2,
    capacity: [
      "292 rooms",
      "5-star",
      "per room, per night",
    ],
    heroImage: { stem: "kigali-convention-centre-02", alt: "Amberhill Convention Hotel, Kimihurura, Kigali" },
    gallery: [
      { stem: "kigali-convention-centre-02", alt: "Amberhill Convention Hotel, view 1" },
      { stem: "kigali-cbd-buildings-01", alt: "Amberhill Convention Hotel, view 2" },
      { stem: "kigali-city-street-01", alt: "Amberhill Convention Hotel, view 3" },
      { stem: "kigali-hills-view-01", alt: "Amberhill Convention Hotel, view 4" },
      { stem: "kigali-night-panorama-02", alt: "Amberhill Convention Hotel, view 5" },
    ],
    photoCount: 5,
    price: { fromUsd: 127, fromRwf: 187500, basis: "per room, per night", includes: "Room only" },
    nightlyRateRwf: 187500,
    rating: null,
    operator: null,
    cardName: { lead: "Amberhill Convention", rest: "Hotel" },
    summary: "Hotel • 5-star • Room only",
    cardImage: { stem: "kigali-convention-centre-02", alt: "Amberhill Convention Hotel, Kimihurura" },
    featuredRank: 3,
    about: [
      "Amberhill Convention Hotel is a fictional 5-star hotel in Kimihurura, Kigali, created for the Injishi demo. It is not a real business.",
      "Demo rates start at 187,500 RWF per room, per night (room only).",
    ],
    highlights: [
      { icon: "sparkle", title: "5-star accommodation", body: "Classified 5-star." },
      { icon: "calendar", title: "292 rooms", body: "The accommodation has 292 rooms in total." },
      { icon: "location", title: "Where it sits", body: "Kimihurura, in Kigali." },
    ],
    specs: [
      { label: "Type", value: "Hotel" },
      { label: "Class", value: "5-star" },
      { label: "Rooms", value: "292" },
      { label: "Neighbourhood", value: "Kimihurura" },
      { label: "Rate basis", value: "per room, per night" },
      { label: "Included", value: "Room only" },
    ],
    amenities: [
      { icon: "kayak", label: "Outdoor swimming pool" },
      { icon: "wifi-high", label: "Free WiFi" },
      { icon: "e-foil", label: "Fitness centre" },
      { icon: "shower", label: "Spa" },
      { icon: "fork-knife", label: "Restaurant" },
      { icon: "cooking-pot", label: "Bar" },
      { icon: "tender", label: "Airport shuttle" },
      { icon: "jet-ski", label: "Private balconies" },
    ],
    place: {
      addressLines: [
        "Kimihurura",
        "Kigali, Rwanda",
      ],
      latitude: null,
      longitude: null,
      blurb: "Kimihurura sits in Kigali. This is a fictional demo property and has no real address.",
    },
    thingsToKnow: [
      {
        title: "House rules",
        icon: "rules",
        items: [
          "Check-in and checkout times are set by the accommodation",
          "Confirmed in writing when your booking is accepted",
        ],
        learnMoreHref: "/support",
      },
      {
        title: "Paying through Injishi",
        icon: "safety",
        items: [
          "Payment is held in escrow until check-in",
          "Released to the host only once you have arrived",
          "Rates shown exclude taxes unless the accommodation states otherwise",
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
    sources: [],
  },
  {
    slug: "copperleaf-grand-hotel",
    name: "Copperleaf Grand Hotel",
    location: "Nyarugenge, Kigali",
    district: "kigali",
    kind: "hotel",
    propertyType: "Hotel in Nyarugenge, Kigali",
    starClass: 5,
    rooms: null,
    bedrooms: 1,
    maxGuests: 2,
    capacity: [
      "Hotel",
      "5-star",
      "per room, per night",
    ],
    heroImage: { stem: "kigali-night-panorama-02", alt: "Copperleaf Grand Hotel, Nyarugenge, Kigali" },
    gallery: [
      { stem: "kigali-night-panorama-02", alt: "Copperleaf Grand Hotel, view 1" },
      { stem: "kigali-hills-view-01", alt: "Copperleaf Grand Hotel, view 2" },
      { stem: "kigali-city-street-01", alt: "Copperleaf Grand Hotel, view 3" },
      { stem: "kigali-parliament-aerial-01", alt: "Copperleaf Grand Hotel, view 4" },
      { stem: "kigali-skyline-01", alt: "Copperleaf Grand Hotel, view 5" },
    ],
    photoCount: 5,
    price: { fromUsd: 158, fromRwf: 233000, basis: "per room, per night", includes: "Room only" },
    nightlyRateRwf: 233000,
    rating: null,
    operator: null,
    cardName: { lead: "Copperleaf Grand", rest: "Hotel" },
    summary: "Hotel • 5-star • Room only",
    cardImage: { stem: "kigali-night-panorama-02", alt: "Copperleaf Grand Hotel, Nyarugenge" },
    about: [
      "Copperleaf Grand Hotel is a fictional 5-star hotel in Nyarugenge, Kigali, created for the Injishi demo. It is not a real business.",
      "Demo rates start at 233,000 RWF per room, per night (room only).",
    ],
    highlights: [
      { icon: "sparkle", title: "5-star accommodation", body: "Classified 5-star." },
      { icon: "location", title: "Where it sits", body: "Nyarugenge, in Kigali." },
    ],
    specs: [
      { label: "Type", value: "Hotel" },
      { label: "Class", value: "5-star" },
      { label: "Neighbourhood", value: "Nyarugenge" },
      { label: "Rate basis", value: "per room, per night" },
      { label: "Included", value: "Room only" },
    ],
    amenities: [
      { icon: "kayak", label: "Outdoor swimming pool" },
      { icon: "wifi-high", label: "Free WiFi" },
      { icon: "e-foil", label: "Fitness centre" },
      { icon: "shower", label: "Spa" },
      { icon: "cooking-pot", label: "Bar" },
      { icon: "jet-ski", label: "Business centre" },
    ],
    place: {
      addressLines: [
        "Nyarugenge",
        "Kigali, Rwanda",
      ],
      latitude: null,
      longitude: null,
      blurb: "Nyarugenge sits in Kigali. This is a fictional demo property and has no real address.",
    },
    thingsToKnow: [
      {
        title: "House rules",
        icon: "rules",
        items: [
          "Check-in and checkout times are set by the accommodation",
          "Confirmed in writing when your booking is accepted",
        ],
        learnMoreHref: "/support",
      },
      {
        title: "Paying through Injishi",
        icon: "safety",
        items: [
          "Payment is held in escrow until check-in",
          "Released to the host only once you have arrived",
          "Rates shown exclude taxes unless the accommodation states otherwise",
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
    sources: [],
  },
  {
    slug: "lanternhouse-hotel-kiyovu",
    name: "Lanternhouse Hotel Kiyovu",
    location: "Kiyovu, Kigali",
    district: "kigali",
    kind: "hotel",
    propertyType: "Hotel in Kiyovu, Kigali",
    starClass: 5,
    rooms: 173,
    bedrooms: 1,
    maxGuests: 2,
    capacity: [
      "173 rooms",
      "5-star",
      "per room, per night",
    ],
    heroImage: { stem: "kigali-night-panorama-02", alt: "Lanternhouse Hotel Kiyovu, Kiyovu, Kigali" },
    gallery: [
      { stem: "kigali-night-panorama-02", alt: "Lanternhouse Hotel Kiyovu, view 1" },
      { stem: "kigali-hills-view-01", alt: "Lanternhouse Hotel Kiyovu, view 2" },
      { stem: "kigali-parliament-aerial-01", alt: "Lanternhouse Hotel Kiyovu, view 3" },
      { stem: "kigali-skyline-01", alt: "Lanternhouse Hotel Kiyovu, view 4" },
      { stem: "rwanda-lake-kivu", alt: "Lanternhouse Hotel Kiyovu, view 5" },
    ],
    photoCount: 5,
    price: { fromUsd: 133, fromRwf: 196000, basis: "per room, per night", includes: "Room only" },
    nightlyRateRwf: 196000,
    rating: null,
    operator: null,
    cardName: { lead: "Lanternhouse Hotel", rest: "Kiyovu" },
    summary: "Hotel • 5-star • Room only",
    cardImage: { stem: "kigali-night-panorama-02", alt: "Lanternhouse Hotel Kiyovu, Kiyovu" },
    featuredRank: 1,
    about: [
      "Lanternhouse Hotel Kiyovu is a fictional 5-star hotel in Kiyovu, Kigali, created for the Injishi demo. It is not a real business.",
      "Demo rates start at 196,000 RWF per room, per night (room only).",
    ],
    highlights: [
      { icon: "sparkle", title: "5-star accommodation", body: "Classified 5-star." },
      { icon: "calendar", title: "173 rooms", body: "The accommodation has 173 rooms in total." },
      { icon: "location", title: "Where it sits", body: "Kiyovu, in Kigali." },
    ],
    specs: [
      { label: "Type", value: "Hotel" },
      { label: "Class", value: "5-star" },
      { label: "Rooms", value: "173" },
      { label: "Neighbourhood", value: "Kiyovu" },
      { label: "Rate basis", value: "per room, per night" },
      { label: "Included", value: "Room only" },
    ],
    amenities: [
      { icon: "kayak", label: "Tropical pool" },
      { icon: "shower", label: "Sauna" },
      { icon: "jet-ski", label: "Business centre" },
      { icon: "tender", label: "Airport shuttle" },
      { icon: "jet-ski", label: "24-hour front desk" },
    ],
    place: {
      addressLines: [
        "Kiyovu",
        "Kigali, Rwanda",
      ],
      latitude: null,
      longitude: null,
      blurb: "Kiyovu sits in Kigali. This is a fictional demo property and has no real address.",
    },
    thingsToKnow: [
      {
        title: "House rules",
        icon: "rules",
        items: [
          "Check-in and checkout times are set by the accommodation",
          "Confirmed in writing when your booking is accepted",
        ],
        learnMoreHref: "/support",
      },
      {
        title: "Paying through Injishi",
        icon: "safety",
        items: [
          "Payment is held in escrow until check-in",
          "Released to the host only once you have arrived",
          "Rates shown exclude taxes unless the accommodation states otherwise",
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
    sources: [],
  },
  {
    slug: "hotel-des-sept-sentiers",
    name: "Hôtel des Sept Sentiers",
    location: "Kiyovu, Kigali",
    district: "kigali",
    kind: "hotel",
    propertyType: "Hotel in Kiyovu, Kigali",
    starClass: null,
    rooms: 112,
    bedrooms: 1,
    maxGuests: 2,
    capacity: [
      "112 rooms",
      "Kiyovu",
      "per room, per night",
    ],
    heroImage: { stem: "mille-collines-02", alt: "Hôtel des Sept Sentiers, Kiyovu, Kigali" },
    gallery: [
      { stem: "mille-collines-02", alt: "Hôtel des Sept Sentiers, view 1" },
      { stem: "mille-collines-01", alt: "Hôtel des Sept Sentiers, view 2" },
      { stem: "kigali-night-panorama-02", alt: "Hôtel des Sept Sentiers, view 3" },
      { stem: "kigali-parliament-aerial-01", alt: "Hôtel des Sept Sentiers, view 4" },
      { stem: "kigali-skyline-01", alt: "Hôtel des Sept Sentiers, view 5" },
    ],
    photoCount: 5,
    price: { fromUsd: 136, fromRwf: 200500, basis: "per room, per night", includes: "Room only" },
    nightlyRateRwf: 200500,
    rating: null,
    operator: null,
    cardName: { lead: "Hôtel des Sept", rest: "Sentiers" },
    summary: "Hotel • Room only",
    cardImage: { stem: "mille-collines-02", alt: "Hôtel des Sept Sentiers, Kiyovu" },
    featuredRank: 5,
    about: [
      "Hôtel des Sept Sentiers is a fictional hotel in Kiyovu, Kigali, created for the Injishi demo. It is not a real business.",
      "Demo rates start at 200,500 RWF per room, per night (room only).",
    ],
    highlights: [
      { icon: "calendar", title: "112 rooms", body: "The accommodation has 112 rooms in total." },
      { icon: "location", title: "Where it sits", body: "Kiyovu, in Kigali." },
    ],
    specs: [
      { label: "Type", value: "Hotel" },
      { label: "Rooms", value: "112" },
      { label: "Neighbourhood", value: "Kiyovu" },
      { label: "Rate basis", value: "per room, per night" },
      { label: "Included", value: "Room only" },
    ],
    amenities: [
      { icon: "kayak", label: "Outdoor swimming pool" },
      { icon: "fork-knife", label: "Restaurant" },
      { icon: "cooking-pot", label: "Bar" },
      { icon: "wifi-high", label: "Free WiFi" },
    ],
    place: {
      addressLines: [
        "Kiyovu",
        "Kigali, Rwanda",
      ],
      latitude: null,
      longitude: null,
      blurb: "Kiyovu sits in Kigali. This is a fictional demo property and has no real address.",
    },
    thingsToKnow: [
      {
        title: "House rules",
        icon: "rules",
        items: [
          "Check-in and checkout times are set by the accommodation",
          "Confirmed in writing when your booking is accepted",
        ],
        learnMoreHref: "/support",
      },
      {
        title: "Paying through Injishi",
        icon: "safety",
        items: [
          "Payment is held in escrow until check-in",
          "Released to the host only once you have arrived",
          "Rates shown exclude taxes unless the accommodation states otherwise",
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
    sources: [],
  },
  {
    slug: "juniper-yard-hotel",
    name: "Juniper Yard Hotel",
    location: "Kiyovu, Kigali",
    district: "kigali",
    kind: "hotel",
    propertyType: "Hotel in Kiyovu, Kigali",
    starClass: 4,
    rooms: null,
    bedrooms: 1,
    maxGuests: 2,
    capacity: [
      "Hotel",
      "4-star",
      "per room, per night",
    ],
    heroImage: { stem: "kigali-parliament-aerial-01", alt: "Juniper Yard Hotel, Kiyovu, Kigali" },
    gallery: [
      { stem: "kigali-parliament-aerial-01", alt: "Juniper Yard Hotel, view 1" },
      { stem: "kigali-skyline-01", alt: "Juniper Yard Hotel, view 2" },
      { stem: "rwanda-lake-kivu", alt: "Juniper Yard Hotel, view 3" },
      { stem: "rwanda-district-musanze", alt: "Juniper Yard Hotel, view 4" },
      { stem: "rwanda-district-rubavu", alt: "Juniper Yard Hotel, view 5" },
    ],
    photoCount: 5,
    price: { fromUsd: 86, fromRwf: 127000, basis: "per room, per night", includes: "Breakfast buffet" },
    nightlyRateRwf: 127000,
    rating: null,
    operator: null,
    cardName: { lead: "Juniper Yard", rest: "Hotel" },
    summary: "Hotel • 4-star • Breakfast buffet",
    cardImage: { stem: "kigali-parliament-aerial-01", alt: "Juniper Yard Hotel, Kiyovu" },
    about: [
      "Juniper Yard Hotel is a fictional 4-star hotel in Kiyovu, Kigali, created for the Injishi demo. It is not a real business.",
      "Demo rates start at 127,000 RWF per room, per night (breakfast buffet).",
    ],
    highlights: [
      { icon: "sparkle", title: "4-star accommodation", body: "Classified 4-star." },
      { icon: "kitchen", title: "Meals in the rate", body: "Breakfast buffet." },
      { icon: "location", title: "Where it sits", body: "Kiyovu, in Kigali." },
    ],
    specs: [
      { label: "Type", value: "Hotel" },
      { label: "Class", value: "4-star" },
      { label: "Neighbourhood", value: "Kiyovu" },
      { label: "Rate basis", value: "per room, per night" },
      { label: "Included", value: "Breakfast buffet" },
    ],
    amenities: [
      { icon: "wifi-high", label: "Free WiFi" },
      { icon: "fork-knife", label: "Restaurant" },
      { icon: "cooking-pot", label: "Bar" },
      { icon: "e-foil", label: "Fitness centre" },
    ],
    place: {
      addressLines: [
        "Kiyovu",
        "Kigali, Rwanda",
      ],
      latitude: null,
      longitude: null,
      blurb: "Kiyovu sits in Kigali. This is a fictional demo property and has no real address.",
    },
    thingsToKnow: [
      {
        title: "House rules",
        icon: "rules",
        items: [
          "Check-in and checkout times are set by the accommodation",
          "Confirmed in writing when your booking is accepted",
        ],
        learnMoreHref: "/support",
      },
      {
        title: "Paying through Injishi",
        icon: "safety",
        items: [
          "Payment is held in escrow until check-in",
          "Released to the host only once you have arrived",
          "Rates shown exclude taxes unless the accommodation states otherwise",
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
    sources: [],
  },
  {
    slug: "bluefinch-hotel-remera",
    name: "Bluefinch Hotel Remera",
    location: "Remera, Kigali",
    district: "kigali",
    kind: "hotel",
    propertyType: "Hotel in Remera, Kigali",
    starClass: 4,
    rooms: null,
    bedrooms: 1,
    maxGuests: 2,
    capacity: [
      "Hotel",
      "4-star",
      "per room, per night",
    ],
    heroImage: { stem: "kigali-skyline-01", alt: "Bluefinch Hotel Remera, Remera, Kigali" },
    gallery: [
      { stem: "kigali-skyline-01", alt: "Bluefinch Hotel Remera, view 1" },
      { stem: "rwanda-lake-kivu", alt: "Bluefinch Hotel Remera, view 2" },
      { stem: "rwanda-district-musanze", alt: "Bluefinch Hotel Remera, view 3" },
      { stem: "rwanda-district-rubavu", alt: "Bluefinch Hotel Remera, view 4" },
      { stem: "rwanda-district-kigali", alt: "Bluefinch Hotel Remera, view 5" },
    ],
    photoCount: 5,
    price: { fromUsd: 113, fromRwf: 166500, basis: "per room, per night", includes: "Breakfast" },
    nightlyRateRwf: 166500,
    rating: null,
    operator: null,
    cardName: { lead: "Bluefinch Hotel", rest: "Remera" },
    summary: "Hotel • 4-star • Breakfast",
    cardImage: { stem: "kigali-skyline-01", alt: "Bluefinch Hotel Remera, Remera" },
    about: [
      "Bluefinch Hotel Remera is a fictional 4-star hotel in Remera, Kigali, created for the Injishi demo. It is not a real business.",
      "Demo rates start at 166,500 RWF per room, per night (breakfast).",
    ],
    highlights: [
      { icon: "sparkle", title: "4-star accommodation", body: "Classified 4-star." },
      { icon: "kitchen", title: "Meals in the rate", body: "Breakfast." },
      { icon: "location", title: "Where it sits", body: "Remera, in Kigali." },
    ],
    specs: [
      { label: "Type", value: "Hotel" },
      { label: "Class", value: "4-star" },
      { label: "Neighbourhood", value: "Remera" },
      { label: "Rate basis", value: "per room, per night" },
      { label: "Included", value: "Breakfast" },
    ],
    amenities: [
      { icon: "shower", label: "Spa" },
      { icon: "kayak", label: "Outdoor swimming pool" },
      { icon: "shower", label: "Sauna" },
      { icon: "fork-knife", label: "Two restaurants" },
      { icon: "tender", label: "Airport shuttle" },
      { icon: "wifi-high", label: "Free WiFi" },
    ],
    place: {
      addressLines: [
        "Remera",
        "Kigali, Rwanda",
      ],
      latitude: null,
      longitude: null,
      blurb: "Remera sits in Kigali. This is a fictional demo property and has no real address.",
    },
    thingsToKnow: [
      {
        title: "House rules",
        icon: "rules",
        items: [
          "Check-in and checkout times are set by the accommodation",
          "Confirmed in writing when your booking is accepted",
        ],
        learnMoreHref: "/support",
      },
      {
        title: "Paying through Injishi",
        icon: "safety",
        items: [
          "Payment is held in escrow until check-in",
          "Released to the host only once you have arrived",
          "Rates shown exclude taxes unless the accommodation states otherwise",
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
    sources: [],
  },
  {
    slug: "fairway-crest-hotel",
    name: "Fairway Crest Hotel",
    location: "Nyarutarama, Kigali",
    district: "kigali",
    kind: "hotel",
    propertyType: "Hotel in Nyarutarama, Kigali",
    starClass: 4,
    rooms: null,
    bedrooms: 1,
    maxGuests: 2,
    capacity: [
      "Hotel",
      "4-star",
      "per room, per night",
    ],
    heroImage: { stem: "rwanda-lake-kivu", alt: "Fairway Crest Hotel, Nyarutarama, Kigali" },
    gallery: [
      { stem: "rwanda-lake-kivu", alt: "Fairway Crest Hotel, view 1" },
      { stem: "rwanda-district-musanze", alt: "Fairway Crest Hotel, view 2" },
      { stem: "rwanda-district-rubavu", alt: "Fairway Crest Hotel, view 3" },
      { stem: "rwanda-district-kigali", alt: "Fairway Crest Hotel, view 4" },
      { stem: "kigali-cbd-buildings-01", alt: "Fairway Crest Hotel, view 5" },
    ],
    photoCount: 5,
    price: { fromUsd: 90, fromRwf: 132500, basis: "per room, per night", includes: "Breakfast" },
    nightlyRateRwf: 132500,
    rating: null,
    operator: null,
    cardName: { lead: "Fairway Crest", rest: "Hotel" },
    summary: "Hotel • 4-star • Breakfast",
    cardImage: { stem: "rwanda-lake-kivu", alt: "Fairway Crest Hotel, Nyarutarama" },
    about: [
      "Fairway Crest Hotel is a fictional 4-star hotel in Nyarutarama, Kigali, created for the Injishi demo. It is not a real business.",
      "Demo rates start at 132,500 RWF per room, per night (breakfast).",
    ],
    highlights: [
      { icon: "sparkle", title: "4-star accommodation", body: "Classified 4-star." },
      { icon: "kitchen", title: "Meals in the rate", body: "Breakfast." },
      { icon: "location", title: "Where it sits", body: "Nyarutarama, in Kigali." },
    ],
    specs: [
      { label: "Type", value: "Hotel" },
      { label: "Class", value: "4-star" },
      { label: "Neighbourhood", value: "Nyarutarama" },
      { label: "Rate basis", value: "per room, per night" },
      { label: "Included", value: "Breakfast" },
    ],
    amenities: [
      { icon: "kayak", label: "Outdoor swimming pool" },
      { icon: "fork-knife", label: "Restaurant" },
      { icon: "cooking-pot", label: "Bar" },
      { icon: "wifi-high", label: "Free WiFi" },
    ],
    place: {
      addressLines: [
        "Nyarutarama",
        "Kigali, Rwanda",
      ],
      latitude: null,
      longitude: null,
      blurb: "Nyarutarama sits in Kigali. This is a fictional demo property and has no real address.",
    },
    thingsToKnow: [
      {
        title: "House rules",
        icon: "rules",
        items: [
          "Check-in and checkout times are set by the accommodation",
          "Confirmed in writing when your booking is accepted",
        ],
        learnMoreHref: "/support",
      },
      {
        title: "Paying through Injishi",
        icon: "safety",
        items: [
          "Payment is held in escrow until check-in",
          "Released to the host only once you have arrived",
          "Rates shown exclude taxes unless the accommodation states otherwise",
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
    sources: [],
  },
  {
    slug: "villa-marigold-kacyiru",
    name: "Villa Marigold Kacyiru",
    location: "Kacyiru, Kigali",
    district: "kigali",
    kind: "hotel",
    propertyType: "Hotel in Kacyiru, Kigali",
    starClass: 3,
    rooms: null,
    bedrooms: 1,
    maxGuests: 2,
    capacity: [
      "Hotel",
      "3-star",
      "per room, per night",
    ],
    heroImage: { stem: "rwanda-district-musanze", alt: "Villa Marigold Kacyiru, Kacyiru, Kigali" },
    gallery: [
      { stem: "rwanda-district-musanze", alt: "Villa Marigold Kacyiru, view 1" },
      { stem: "rwanda-district-rubavu", alt: "Villa Marigold Kacyiru, view 2" },
      { stem: "rwanda-district-kigali", alt: "Villa Marigold Kacyiru, view 3" },
      { stem: "kigali-cbd-buildings-01", alt: "Villa Marigold Kacyiru, view 4" },
      { stem: "kigali-city-street-01", alt: "Villa Marigold Kacyiru, view 5" },
    ],
    photoCount: 5,
    price: { fromUsd: 45, fromRwf: 66500, basis: "per room, per night", includes: "À la carte breakfast" },
    nightlyRateRwf: 66500,
    rating: null,
    operator: null,
    cardName: { lead: "Villa Marigold", rest: "Kacyiru" },
    summary: "Hotel • 3-star • À la carte breakfast",
    cardImage: { stem: "rwanda-district-musanze", alt: "Villa Marigold Kacyiru, Kacyiru" },
    about: [
      "Villa Marigold Kacyiru is a fictional 3-star hotel in Kacyiru, Kigali, created for the Injishi demo. It is not a real business.",
      "Demo rates start at 66,500 RWF per room, per night (à la carte breakfast).",
    ],
    highlights: [
      { icon: "sparkle", title: "3-star accommodation", body: "Classified 3-star." },
      { icon: "kitchen", title: "Meals in the rate", body: "À la carte breakfast." },
      { icon: "location", title: "Where it sits", body: "Kacyiru, in Kigali." },
    ],
    specs: [
      { label: "Type", value: "Hotel" },
      { label: "Class", value: "3-star" },
      { label: "Neighbourhood", value: "Kacyiru" },
      { label: "Rate basis", value: "per room, per night" },
      { label: "Included", value: "À la carte breakfast" },
    ],
    amenities: [
      { icon: "fork-knife", label: "À la carte breakfast" },
      { icon: "jet-ski", label: "Room service" },
      { icon: "wifi-high", label: "Free WiFi" },
      { icon: "fork-knife", label: "Restaurant" },
    ],
    place: {
      addressLines: [
        "Kacyiru",
        "Kigali, Rwanda",
      ],
      latitude: null,
      longitude: null,
      blurb: "Kacyiru sits in Kigali. This is a fictional demo property and has no real address.",
    },
    thingsToKnow: [
      {
        title: "House rules",
        icon: "rules",
        items: [
          "Check-in and checkout times are set by the accommodation",
          "Confirmed in writing when your booking is accepted",
        ],
        learnMoreHref: "/support",
      },
      {
        title: "Paying through Injishi",
        icon: "safety",
        items: [
          "Payment is held in escrow until check-in",
          "Released to the host only once you have arrived",
          "Rates shown exclude taxes unless the accommodation states otherwise",
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
    sources: [],
  },
  {
    slug: "quillstone-hotel",
    name: "Quillstone Hotel",
    location: "Remera, Kigali",
    district: "kigali",
    kind: "hotel",
    propertyType: "Hotel in Remera, Kigali",
    starClass: 3,
    rooms: null,
    bedrooms: 1,
    maxGuests: 2,
    capacity: [
      "Hotel",
      "3-star",
      "per room, per night",
    ],
    heroImage: { stem: "rwanda-district-rubavu", alt: "Quillstone Hotel, Remera, Kigali" },
    gallery: [
      { stem: "rwanda-district-rubavu", alt: "Quillstone Hotel, view 1" },
      { stem: "rwanda-district-kigali", alt: "Quillstone Hotel, view 2" },
      { stem: "kigali-cbd-buildings-01", alt: "Quillstone Hotel, view 3" },
      { stem: "kigali-city-street-01", alt: "Quillstone Hotel, view 4" },
      { stem: "kigali-hills-view-01", alt: "Quillstone Hotel, view 5" },
    ],
    photoCount: 5,
    price: { fromUsd: 96, fromRwf: 141500, basis: "per room, per night", includes: "Room only" },
    nightlyRateRwf: 141500,
    rating: null,
    operator: null,
    cardName: { lead: "Quillstone", rest: "Hotel" },
    summary: "Hotel • 3-star • Room only",
    cardImage: { stem: "rwanda-district-rubavu", alt: "Quillstone Hotel, Remera" },
    about: [
      "Quillstone Hotel is a fictional 3-star hotel in Remera, Kigali, created for the Injishi demo. It is not a real business.",
      "Demo rates start at 141,500 RWF per room, per night (room only).",
    ],
    highlights: [
      { icon: "sparkle", title: "3-star accommodation", body: "Classified 3-star." },
      { icon: "location", title: "Where it sits", body: "Remera, in Kigali." },
    ],
    specs: [
      { label: "Type", value: "Hotel" },
      { label: "Class", value: "3-star" },
      { label: "Neighbourhood", value: "Remera" },
      { label: "Rate basis", value: "per room, per night" },
      { label: "Included", value: "Room only" },
    ],
    amenities: [
      { icon: "wifi-high", label: "Free WiFi" },
      { icon: "fork-knife", label: "Restaurant" },
      { icon: "jet-ski", label: "24-hour front desk" },
    ],
    place: {
      addressLines: [
        "Remera",
        "Kigali, Rwanda",
      ],
      latitude: null,
      longitude: null,
      blurb: "Remera sits in Kigali. This is a fictional demo property and has no real address.",
    },
    thingsToKnow: [
      {
        title: "House rules",
        icon: "rules",
        items: [
          "Check-in and checkout times are set by the accommodation",
          "Confirmed in writing when your booking is accepted",
        ],
        learnMoreHref: "/support",
      },
      {
        title: "Paying through Injishi",
        icon: "safety",
        items: [
          "Payment is held in escrow until check-in",
          "Released to the host only once you have arrived",
          "Rates shown exclude taxes unless the accommodation states otherwise",
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
    sources: [],
  },
  {
    slug: "willowbank-apartments-gacuriro",
    name: "Willowbank Apartments Gacuriro",
    location: "Gacuriro, Kigali",
    district: "kigali",
    kind: "apartment",
    propertyType: "Serviced apartment in Gacuriro, Kigali",
    starClass: null,
    rooms: null,
    bedrooms: 2,
    maxGuests: 4,
    capacity: [
      "Serviced apartment",
      "Gacuriro",
      "per apartment, per night",
    ],
    heroImage: { stem: "rwanda-district-kigali", alt: "Willowbank Apartments Gacuriro, Gacuriro, Kigali" },
    gallery: [
      { stem: "rwanda-district-kigali", alt: "Willowbank Apartments Gacuriro, view 1" },
      { stem: "kigali-cbd-buildings-01", alt: "Willowbank Apartments Gacuriro, view 2" },
      { stem: "kigali-city-street-01", alt: "Willowbank Apartments Gacuriro, view 3" },
      { stem: "kigali-hills-view-01", alt: "Willowbank Apartments Gacuriro, view 4" },
      { stem: "kigali-night-panorama-02", alt: "Willowbank Apartments Gacuriro, view 5" },
    ],
    photoCount: 5,
    price: { fromUsd: 175, fromRwf: 258000, basis: "per apartment, per night", includes: "Complimentary breakfast" },
    nightlyRateRwf: 258000,
    rating: null,
    operator: null,
    cardName: { lead: "Willowbank Apartments", rest: "Gacuriro" },
    summary: "Serviced apartment • Complimentary breakfast",
    cardImage: { stem: "rwanda-district-kigali", alt: "Willowbank Apartments Gacuriro, Gacuriro" },
    about: [
      "Willowbank Apartments Gacuriro is a fictional serviced apartment block in Gacuriro, Kigali, created for the Injishi demo. It is not a real business.",
      "Demo rates start at 258,000 RWF per apartment, per night (complimentary breakfast).",
    ],
    highlights: [
      { icon: "kitchen", title: "Meals in the rate", body: "Complimentary breakfast." },
      { icon: "location", title: "Where it sits", body: "Gacuriro, in Kigali." },
    ],
    specs: [
      { label: "Type", value: "Serviced apartment block" },
      { label: "Neighbourhood", value: "Gacuriro" },
      { label: "Rate basis", value: "per apartment, per night" },
      { label: "Included", value: "Complimentary breakfast" },
    ],
    amenities: [
      { icon: "e-foil", label: "Fitness centre" },
      { icon: "wave-sine", label: "Terrace" },
      { icon: "jet-ski", label: "24-hour front desk" },
      { icon: "wifi-high", label: "Free WiFi" },
    ],
    place: {
      addressLines: [
        "Gacuriro",
        "Kigali, Rwanda",
      ],
      latitude: null,
      longitude: null,
      blurb: "Gacuriro sits in Kigali. This is a fictional demo property and has no real address.",
    },
    thingsToKnow: [
      {
        title: "House rules",
        icon: "rules",
        items: [
          "Check-in and checkout times are set by the accommodation",
          "Confirmed in writing when your booking is accepted",
        ],
        learnMoreHref: "/support",
      },
      {
        title: "Paying through Injishi",
        icon: "safety",
        items: [
          "Payment is held in escrow until check-in",
          "Released to the host only once you have arrived",
          "Rates shown exclude taxes unless the accommodation states otherwise",
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
    sources: [],
  },
  {
    slug: "orchard-row-suites",
    name: "Orchard Row Suites",
    location: "Nyarutarama, Kigali",
    district: "kigali",
    kind: "apartment",
    propertyType: "Serviced apartment in Nyarutarama, Kigali",
    starClass: null,
    rooms: null,
    bedrooms: 2,
    maxGuests: 4,
    capacity: [
      "Serviced apartment",
      "Nyarutarama",
      "per apartment, per night",
    ],
    heroImage: { stem: "kigali-cbd-buildings-01", alt: "Orchard Row Suites, Nyarutarama, Kigali" },
    gallery: [
      { stem: "kigali-cbd-buildings-01", alt: "Orchard Row Suites, view 1" },
      { stem: "kigali-city-street-01", alt: "Orchard Row Suites, view 2" },
      { stem: "kigali-hills-view-01", alt: "Orchard Row Suites, view 3" },
      { stem: "kigali-night-panorama-02", alt: "Orchard Row Suites, view 4" },
      { stem: "kigali-parliament-aerial-01", alt: "Orchard Row Suites, view 5" },
    ],
    photoCount: 5,
    price: { fromUsd: 102, fromRwf: 150500, basis: "per apartment, per night", includes: "Room only" },
    nightlyRateRwf: 150500,
    rating: null,
    operator: null,
    cardName: { lead: "Orchard Row", rest: "Suites" },
    summary: "Serviced apartment • Room only",
    cardImage: { stem: "kigali-cbd-buildings-01", alt: "Orchard Row Suites, Nyarutarama" },
    about: [
      "Orchard Row Suites is a fictional serviced apartment block in Nyarutarama, Kigali, created for the Injishi demo. It is not a real business.",
      "Demo rates start at 150,500 RWF per apartment, per night (room only).",
    ],
    highlights: [
      { icon: "location", title: "Where it sits", body: "Nyarutarama, in Kigali." },
    ],
    specs: [
      { label: "Type", value: "Serviced apartment block" },
      { label: "Neighbourhood", value: "Nyarutarama" },
      { label: "Rate basis", value: "per apartment, per night" },
      { label: "Included", value: "Room only" },
    ],
    amenities: [
      { icon: "wifi-high", label: "Free WiFi" },
      { icon: "kayak", label: "Swimming pool" },
      { icon: "tender", label: "Parking" },
    ],
    place: {
      addressLines: [
        "Nyarutarama",
        "Kigali, Rwanda",
      ],
      latitude: null,
      longitude: null,
      blurb: "Nyarutarama sits in Kigali. This is a fictional demo property and has no real address.",
    },
    thingsToKnow: [
      {
        title: "House rules",
        icon: "rules",
        items: [
          "Check-in and checkout times are set by the accommodation",
          "Confirmed in writing when your booking is accepted",
        ],
        learnMoreHref: "/support",
      },
      {
        title: "Paying through Injishi",
        icon: "safety",
        items: [
          "Payment is held in escrow until check-in",
          "Released to the host only once you have arrived",
          "Rates shown exclude taxes unless the accommodation states otherwise",
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
    sources: [],
  },
  {
    slug: "paperbark-apartments",
    name: "Paperbark Apartments",
    location: "Kacyiru, Kigali",
    district: "kigali",
    kind: "apartment",
    propertyType: "Serviced apartment in Kacyiru, Kigali",
    starClass: null,
    rooms: null,
    bedrooms: 2,
    maxGuests: 4,
    capacity: [
      "Serviced apartment",
      "Kacyiru",
      "per apartment, per night",
    ],
    heroImage: { stem: "kigali-night-panorama-02", alt: "Paperbark Apartments, Kacyiru, Kigali" },
    gallery: [
      { stem: "kigali-night-panorama-02", alt: "Paperbark Apartments, view 1" },
      { stem: "kigali-hills-view-01", alt: "Paperbark Apartments, view 2" },
      { stem: "kigali-city-street-01", alt: "Paperbark Apartments, view 3" },
      { stem: "kigali-parliament-aerial-01", alt: "Paperbark Apartments, view 4" },
      { stem: "kigali-skyline-01", alt: "Paperbark Apartments, view 5" },
    ],
    photoCount: 5,
    price: { fromUsd: 60, fromRwf: 88500, basis: "per apartment, per night", includes: "Room only" },
    nightlyRateRwf: 88500,
    rating: null,
    operator: null,
    cardName: { lead: "Paperbark", rest: "Apartments" },
    summary: "Serviced apartment • Room only",
    cardImage: { stem: "kigali-night-panorama-02", alt: "Paperbark Apartments, Kacyiru" },
    about: [
      "Paperbark Apartments is a fictional serviced apartment block in Kacyiru, Kigali, created for the Injishi demo. It is not a real business.",
      "Demo rates start at 88,500 RWF per apartment, per night (room only).",
    ],
    highlights: [
      { icon: "location", title: "Where it sits", body: "Kacyiru, in Kigali." },
    ],
    specs: [
      { label: "Type", value: "Serviced apartment block" },
      { label: "Neighbourhood", value: "Kacyiru" },
      { label: "Rate basis", value: "per apartment, per night" },
      { label: "Included", value: "Room only" },
    ],
    amenities: [
      { icon: "wifi-high", label: "Free WiFi" },
      { icon: "jet-ski", label: "Washing machine" },
      { icon: "tender", label: "Parking" },
    ],
    place: {
      addressLines: [
        "Kacyiru",
        "Kigali, Rwanda",
      ],
      latitude: null,
      longitude: null,
      blurb: "Kacyiru sits in Kigali. This is a fictional demo property and has no real address.",
    },
    thingsToKnow: [
      {
        title: "House rules",
        icon: "rules",
        items: [
          "Check-in and checkout times are set by the accommodation",
          "Confirmed in writing when your booking is accepted",
        ],
        learnMoreHref: "/support",
      },
      {
        title: "Paying through Injishi",
        icon: "safety",
        items: [
          "Payment is held in escrow until check-in",
          "Released to the host only once you have arrived",
          "Rates shown exclude taxes unless the accommodation states otherwise",
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
    sources: [],
  },
  {
    slug: "cobalt-tower-hotel",
    name: "Cobalt Tower Hotel",
    location: "Nyarugenge, Kigali",
    district: "kigali",
    kind: "hotel",
    propertyType: "Hotel in Nyarugenge, Kigali",
    starClass: 4,
    rooms: null,
    bedrooms: 1,
    maxGuests: 2,
    capacity: [
      "Hotel",
      "4-star",
      "per room, per night",
    ],
    heroImage: { stem: "kigali-night-panorama-02", alt: "Cobalt Tower Hotel, Nyarugenge, Kigali" },
    gallery: [
      { stem: "kigali-night-panorama-02", alt: "Cobalt Tower Hotel, view 1" },
      { stem: "kigali-hills-view-01", alt: "Cobalt Tower Hotel, view 2" },
      { stem: "kigali-parliament-aerial-01", alt: "Cobalt Tower Hotel, view 3" },
      { stem: "kigali-skyline-01", alt: "Cobalt Tower Hotel, view 4" },
      { stem: "rwanda-lake-kivu", alt: "Cobalt Tower Hotel, view 5" },
    ],
    photoCount: 5,
    price: { fromUsd: null, fromRwf: null, basis: "per room, per night", includes: "Room only" },
    nightlyRateRwf: null,
    rating: null,
    operator: null,
    cardName: { lead: "Cobalt Tower", rest: "Hotel" },
    summary: "Hotel • 4-star • Room only",
    cardImage: { stem: "kigali-night-panorama-02", alt: "Cobalt Tower Hotel, Nyarugenge" },
    about: [
      "Cobalt Tower Hotel is a fictional 4-star hotel in Nyarugenge, Kigali, created for the Injishi demo. It is not a real business.",
      "This demo stay is quoted on request.",
    ],
    highlights: [
      { icon: "sparkle", title: "4-star accommodation", body: "Classified 4-star." },
      { icon: "location", title: "Where it sits", body: "Nyarugenge, in Kigali." },
    ],
    specs: [
      { label: "Type", value: "Hotel" },
      { label: "Class", value: "4-star" },
      { label: "Neighbourhood", value: "Nyarugenge" },
      { label: "Rate basis", value: "per room, per night" },
      { label: "Included", value: "Room only" },
    ],
    amenities: [
      { icon: "wifi-high", label: "Free WiFi" },
      { icon: "fork-knife", label: "Restaurant" },
      { icon: "e-foil", label: "Fitness centre" },
    ],
    place: {
      addressLines: [
        "Nyarugenge",
        "Kigali, Rwanda",
      ],
      latitude: null,
      longitude: null,
      blurb: "Nyarugenge sits in Kigali. This is a fictional demo property and has no real address.",
    },
    thingsToKnow: [
      {
        title: "House rules",
        icon: "rules",
        items: [
          "Check-in and checkout times are set by the accommodation",
          "Confirmed in writing when your booking is accepted",
        ],
        learnMoreHref: "/support",
      },
      {
        title: "Paying through Injishi",
        icon: "safety",
        items: [
          "Payment is held in escrow until check-in",
          "Released to the host only once you have arrived",
          "Rates shown exclude taxes unless the accommodation states otherwise",
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
    sources: [],
  },
  {
    slug: "saffron-terrace-hotel",
    name: "Saffron Terrace Hotel",
    location: "Nyarutarama, Kigali",
    district: "kigali",
    kind: "hotel",
    propertyType: "Hotel in Nyarutarama, Kigali",
    starClass: 4,
    rooms: null,
    bedrooms: 1,
    maxGuests: 2,
    capacity: [
      "Hotel",
      "4-star",
      "per room, per night",
    ],
    heroImage: { stem: "kigali-night-panorama-02", alt: "Saffron Terrace Hotel, Nyarutarama, Kigali" },
    gallery: [
      { stem: "kigali-night-panorama-02", alt: "Saffron Terrace Hotel, view 1" },
      { stem: "kigali-parliament-aerial-01", alt: "Saffron Terrace Hotel, view 2" },
      { stem: "kigali-skyline-01", alt: "Saffron Terrace Hotel, view 3" },
      { stem: "rwanda-lake-kivu", alt: "Saffron Terrace Hotel, view 4" },
      { stem: "rwanda-district-musanze", alt: "Saffron Terrace Hotel, view 5" },
    ],
    photoCount: 5,
    price: { fromUsd: null, fromRwf: null, basis: "per room, per night", includes: "Room only" },
    nightlyRateRwf: null,
    rating: null,
    operator: null,
    cardName: { lead: "Saffron Terrace", rest: "Hotel" },
    summary: "Hotel • 4-star • Room only",
    cardImage: { stem: "kigali-night-panorama-02", alt: "Saffron Terrace Hotel, Nyarutarama" },
    about: [
      "Saffron Terrace Hotel is a fictional 4-star hotel in Nyarutarama, Kigali, created for the Injishi demo. It is not a real business.",
      "This demo stay is quoted on request.",
    ],
    highlights: [
      { icon: "sparkle", title: "4-star accommodation", body: "Classified 4-star." },
      { icon: "location", title: "Where it sits", body: "Nyarutarama, in Kigali." },
    ],
    specs: [
      { label: "Type", value: "Hotel" },
      { label: "Class", value: "4-star" },
      { label: "Neighbourhood", value: "Nyarutarama" },
      { label: "Rate basis", value: "per room, per night" },
      { label: "Included", value: "Room only" },
    ],
    amenities: [
      { icon: "kayak", label: "Outdoor swimming pool" },
      { icon: "wifi-high", label: "Free WiFi" },
      { icon: "fork-knife", label: "Restaurant" },
      { icon: "cooking-pot", label: "Bar" },
    ],
    place: {
      addressLines: [
        "Nyarutarama",
        "Kigali, Rwanda",
      ],
      latitude: null,
      longitude: null,
      blurb: "Nyarutarama sits in Kigali. This is a fictional demo property and has no real address.",
    },
    thingsToKnow: [
      {
        title: "House rules",
        icon: "rules",
        items: [
          "Check-in and checkout times are set by the accommodation",
          "Confirmed in writing when your booking is accepted",
        ],
        learnMoreHref: "/support",
      },
      {
        title: "Paying through Injishi",
        icon: "safety",
        items: [
          "Payment is held in escrow until check-in",
          "Released to the host only once you have arrived",
          "Rates shown exclude taxes unless the accommodation states otherwise",
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
    sources: [],
  },
  {
    slug: "hummingbird-house-hotel",
    name: "Hummingbird House Hotel",
    location: "Kiyovu, Kigali",
    district: "kigali",
    kind: "hotel",
    propertyType: "Boutique hotel in Kiyovu, Kigali",
    starClass: null,
    rooms: null,
    bedrooms: 1,
    maxGuests: 2,
    capacity: [
      "Boutique hotel",
      "Kiyovu",
      "per room, per night",
    ],
    heroImage: { stem: "kigali-parliament-aerial-01", alt: "Hummingbird House Hotel, Kiyovu, Kigali" },
    gallery: [
      { stem: "kigali-parliament-aerial-01", alt: "Hummingbird House Hotel, view 1" },
      { stem: "kigali-skyline-01", alt: "Hummingbird House Hotel, view 2" },
      { stem: "rwanda-lake-kivu", alt: "Hummingbird House Hotel, view 3" },
      { stem: "rwanda-district-musanze", alt: "Hummingbird House Hotel, view 4" },
      { stem: "rwanda-district-rubavu", alt: "Hummingbird House Hotel, view 5" },
    ],
    photoCount: 5,
    price: { fromUsd: null, fromRwf: null, basis: "per room, per night", includes: "Breakfast" },
    nightlyRateRwf: null,
    rating: null,
    operator: null,
    cardName: { lead: "Hummingbird House", rest: "Hotel" },
    summary: "Boutique hotel • Breakfast",
    cardImage: { stem: "kigali-parliament-aerial-01", alt: "Hummingbird House Hotel, Kiyovu" },
    about: [
      "Hummingbird House Hotel is a fictional hotel in Kiyovu, Kigali, created for the Injishi demo. It is not a real business.",
      "This demo stay is quoted on request.",
    ],
    highlights: [
      { icon: "kitchen", title: "Meals in the rate", body: "Breakfast." },
      { icon: "location", title: "Where it sits", body: "Kiyovu, in Kigali." },
    ],
    specs: [
      { label: "Type", value: "Hotel" },
      { label: "Neighbourhood", value: "Kiyovu" },
      { label: "Rate basis", value: "per room, per night" },
      { label: "Included", value: "Breakfast" },
    ],
    amenities: [
      { icon: "fork-knife", label: "Restaurant" },
      { icon: "kayak", label: "Swimming pool" },
      { icon: "wifi-high", label: "Free WiFi" },
      { icon: "wave-sine", label: "Terrace" },
    ],
    place: {
      addressLines: [
        "Kiyovu",
        "Kigali, Rwanda",
      ],
      latitude: null,
      longitude: null,
      blurb: "Kiyovu sits in Kigali. This is a fictional demo property and has no real address.",
    },
    thingsToKnow: [
      {
        title: "House rules",
        icon: "rules",
        items: [
          "Check-in and checkout times are set by the accommodation",
          "Confirmed in writing when your booking is accepted",
        ],
        learnMoreHref: "/support",
      },
      {
        title: "Paying through Injishi",
        icon: "safety",
        items: [
          "Payment is held in escrow until check-in",
          "Released to the host only once you have arrived",
          "Rates shown exclude taxes unless the accommodation states otherwise",
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
    sources: [],
  },
  {
    slug: "dawn-and-dusk-hotel",
    name: "Dawn and Dusk Hotel",
    location: "Kacyiru, Kigali",
    district: "kigali",
    kind: "hotel",
    propertyType: "Hotel in Kacyiru, Kigali",
    starClass: 3,
    rooms: null,
    bedrooms: 1,
    maxGuests: 2,
    capacity: [
      "Hotel",
      "3-star",
      "per room, per night",
    ],
    heroImage: { stem: "kigali-skyline-01", alt: "Dawn and Dusk Hotel, Kacyiru, Kigali" },
    gallery: [
      { stem: "kigali-skyline-01", alt: "Dawn and Dusk Hotel, view 1" },
      { stem: "rwanda-lake-kivu", alt: "Dawn and Dusk Hotel, view 2" },
      { stem: "rwanda-district-musanze", alt: "Dawn and Dusk Hotel, view 3" },
      { stem: "rwanda-district-rubavu", alt: "Dawn and Dusk Hotel, view 4" },
      { stem: "rwanda-district-kigali", alt: "Dawn and Dusk Hotel, view 5" },
    ],
    photoCount: 5,
    price: { fromUsd: null, fromRwf: null, basis: "per room, per night", includes: "Breakfast" },
    nightlyRateRwf: null,
    rating: null,
    operator: null,
    cardName: { lead: "Dawn and Dusk", rest: "Hotel" },
    summary: "Hotel • 3-star • Breakfast",
    cardImage: { stem: "kigali-skyline-01", alt: "Dawn and Dusk Hotel, Kacyiru" },
    about: [
      "Dawn and Dusk Hotel is a fictional 3-star hotel in Kacyiru, Kigali, created for the Injishi demo. It is not a real business.",
      "This demo stay is quoted on request.",
    ],
    highlights: [
      { icon: "sparkle", title: "3-star accommodation", body: "Classified 3-star." },
      { icon: "kitchen", title: "Meals in the rate", body: "Breakfast." },
      { icon: "location", title: "Where it sits", body: "Kacyiru, in Kigali." },
    ],
    specs: [
      { label: "Type", value: "Hotel" },
      { label: "Class", value: "3-star" },
      { label: "Neighbourhood", value: "Kacyiru" },
      { label: "Rate basis", value: "per room, per night" },
      { label: "Included", value: "Breakfast" },
    ],
    amenities: [
      { icon: "wifi-high", label: "Free WiFi" },
      { icon: "fork-knife", label: "Restaurant" },
      { icon: "cooking-pot", label: "Bar" },
      { icon: "tender", label: "Parking" },
    ],
    place: {
      addressLines: [
        "Kacyiru",
        "Kigali, Rwanda",
      ],
      latitude: null,
      longitude: null,
      blurb: "Kacyiru sits in Kigali. This is a fictional demo property and has no real address.",
    },
    thingsToKnow: [
      {
        title: "House rules",
        icon: "rules",
        items: [
          "Check-in and checkout times are set by the accommodation",
          "Confirmed in writing when your booking is accepted",
        ],
        learnMoreHref: "/support",
      },
      {
        title: "Paying through Injishi",
        icon: "safety",
        items: [
          "Payment is held in escrow until check-in",
          "Released to the host only once you have arrived",
          "Rates shown exclude taxes unless the accommodation states otherwise",
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
    sources: [],
  },
  {
    slug: "mistridge-lodge",
    name: "Mistridge Lodge",
    location: "Kinigi, Volcanoes National Park",
    district: "musanze",
    kind: "lodge",
    propertyType: "Lodge in Volcanoes National Park",
    starClass: null,
    rooms: 6,
    bedrooms: 1,
    maxGuests: 2,
    capacity: [
      "6 rooms",
      "luxury",
      "per person, per night",
    ],
    heroImage: { stem: "volcanoes-np-02", alt: "Mistridge Lodge, Volcanoes National Park" },
    gallery: [
      { stem: "volcanoes-np-02", alt: "Mistridge Lodge, view 1" },
      { stem: "volcanoes-np-03", alt: "Mistridge Lodge, view 2" },
      { stem: "mountain-gorilla-01", alt: "Mistridge Lodge, view 3" },
      { stem: "mountain-gorilla-02", alt: "Mistridge Lodge, view 4" },
      { stem: "rwanda-lake-kivu", alt: "Mistridge Lodge, view 5" },
    ],
    photoCount: 5,
    price: {
      fromUsd: 2569,
      fromRwf: 3788000,
      basis: "per person, per night",
      includes: "Accommodation, all meals, local drinks (excluding reserve wines and champagne), laundry, 3% tourism tax, and all lodge-based activities",
    },
    nightlyRateRwf: 3788000,
    rating: null,
    operator: null,
    cardName: { lead: "Mistridge", rest: "Lodge" },
    summary: "Lodge • luxury • all-inclusive",
    cardImage: { stem: "volcanoes-np-02", alt: "Mistridge Lodge, Volcanoes National Park" },
    featuredRank: 2,
    about: [
      "Mistridge Lodge is a fictional lodge in Kinigi, Volcanoes National Park, created for the Injishi demo. It is not a real business.",
      "Demo rates start at 3,788,000 RWF per person, per night (accommodation, all meals, local drinks (excluding reserve wines and champagne), laundry, 3% tourism tax, and all lodge-based activities).",
    ],
    highlights: [
      { icon: "calendar", title: "6 rooms", body: "The accommodation has 6 rooms in total." },
      {
        icon: "kitchen",
        title: "Meals in the rate",
        body: "Accommodation, all meals, local drinks (excluding reserve wines and champagne), laundry, 3% tourism tax, and all lodge-based activities.",
      },
      { icon: "location", title: "Where it sits", body: "Kinigi, in Volcanoes National Park." },
    ],
    specs: [
      { label: "Type", value: "Lodge" },
      { label: "Rooms", value: "6" },
      { label: "Neighbourhood", value: "Kinigi" },
      { label: "Rate basis", value: "per person, per night" },
      {
        label: "Included",
        value: "Accommodation, all meals, local drinks (excluding reserve wines and champagne), laundry, 3% tourism tax, and all lodge-based activities",
      },
    ],
    amenities: [
      { icon: "wifi-high", label: "Wi-Fi" },
      { icon: "wave-sine", label: "Organic vegetable garden" },
      { icon: "fork-knife", label: "Restaurant" },
    ],
    place: {
      addressLines: [
        "Kinigi",
        "Volcanoes National Park, Rwanda",
      ],
      latitude: null,
      longitude: null,
      blurb: "Kinigi sits in Volcanoes National Park. This is a fictional demo property and has no real address.",
    },
    thingsToKnow: [
      {
        title: "House rules",
        icon: "rules",
        items: [
          "Gorilla permits are booked separately, at USD 1,500 per trek",
          "Check-in and checkout times are set by the accommodation",
          "Confirmed in writing when your booking is accepted",
        ],
        learnMoreHref: "/support",
      },
      {
        title: "Paying through Injishi",
        icon: "safety",
        items: [
          "Payment is held in escrow until check-in",
          "Released to the host only once you have arrived",
          "Rates shown exclude taxes unless the accommodation states otherwise",
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
    sources: [],
  },
  {
    slug: "mistridge-reserve-villas",
    name: "Mistridge Reserve Villas",
    location: "Kinigi, Volcanoes National Park",
    district: "musanze",
    kind: "villa",
    propertyType: "Villa in Volcanoes National Park",
    starClass: null,
    rooms: 4,
    bedrooms: 1,
    maxGuests: 2,
    capacity: [
      "4 rooms",
      "luxury",
      "per person, per night",
    ],
    heroImage: { stem: "volcanoes-np-03", alt: "Mistridge Reserve Villas, Volcanoes National Park" },
    gallery: [
      { stem: "volcanoes-np-03", alt: "Mistridge Reserve Villas, view 1" },
      { stem: "mountain-gorilla-01", alt: "Mistridge Reserve Villas, view 2" },
      { stem: "mountain-gorilla-02", alt: "Mistridge Reserve Villas, view 3" },
      { stem: "rwanda-lake-kivu", alt: "Mistridge Reserve Villas, view 4" },
      { stem: "rwanda-district-musanze", alt: "Mistridge Reserve Villas, view 5" },
    ],
    photoCount: 5,
    price: {
      fromUsd: 3319,
      fromRwf: 4894000,
      basis: "per person, per night",
      includes: "Accommodation, all meals, all drinks (excluding reserve wines and champagne), laundry, 3% tourism tax, and all lodge activities",
    },
    nightlyRateRwf: 4894000,
    rating: null,
    operator: null,
    cardName: { lead: "Mistridge Reserve", rest: "Villas" },
    summary: "Villa • luxury • all-inclusive",
    cardImage: { stem: "volcanoes-np-03", alt: "Mistridge Reserve Villas, Volcanoes National Park" },
    about: [
      "Mistridge Reserve Villas is a fictional villa in Kinigi, Volcanoes National Park, created for the Injishi demo. It is not a real business.",
      "Demo rates start at 4,894,000 RWF per person, per night (accommodation, all meals, all drinks (excluding reserve wines and champagne), laundry, 3% tourism tax, and all lodge activities).",
    ],
    highlights: [
      { icon: "calendar", title: "4 rooms", body: "The accommodation has 4 rooms in total." },
      {
        icon: "kitchen",
        title: "Meals in the rate",
        body: "Accommodation, all meals, all drinks (excluding reserve wines and champagne), laundry, 3% tourism tax, and all lodge activities.",
      },
      { icon: "location", title: "Where it sits", body: "Kinigi, in Volcanoes National Park." },
    ],
    specs: [
      { label: "Type", value: "Villa" },
      { label: "Rooms", value: "4" },
      { label: "Neighbourhood", value: "Kinigi" },
      { label: "Rate basis", value: "per person, per night" },
      { label: "Included", value: "Accommodation, all meals, all drinks (excluding reserve wines and champagne), laundry, 3% tourism tax, and all lodge activities" },
    ],
    amenities: [
      { icon: "fan", label: "Wood-fired hot tubs on private decks" },
      { icon: "wifi-high", label: "Wi-Fi" },
      { icon: "fan", label: "Three fireplaces" },
      { icon: "wave-sine", label: "Private viewing decks" },
    ],
    place: {
      addressLines: [
        "Kinigi",
        "Volcanoes National Park, Rwanda",
      ],
      latitude: null,
      longitude: null,
      blurb: "Kinigi sits in Volcanoes National Park. This is a fictional demo property and has no real address.",
    },
    thingsToKnow: [
      {
        title: "House rules",
        icon: "rules",
        items: [
          "Gorilla permits are booked separately, at USD 1,500 per trek",
          "Check-in and checkout times are set by the accommodation",
          "Confirmed in writing when your booking is accepted",
        ],
        learnMoreHref: "/support",
      },
      {
        title: "Paying through Injishi",
        icon: "safety",
        items: [
          "Payment is held in escrow until check-in",
          "Released to the host only once you have arrived",
          "Rates shown exclude taxes unless the accommodation states otherwise",
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
    sources: [],
  },
  {
    slug: "bamboo-saddle-lodge",
    name: "Bamboo Saddle Lodge",
    location: "Kinigi, Volcanoes National Park",
    district: "musanze",
    kind: "lodge",
    propertyType: "Lodge in Volcanoes National Park",
    starClass: null,
    rooms: 9,
    bedrooms: 1,
    maxGuests: 2,
    capacity: [
      "9 rooms",
      "luxury",
      "per person, per night",
    ],
    heroImage: { stem: "mountain-gorilla-01", alt: "Bamboo Saddle Lodge, Volcanoes National Park" },
    gallery: [
      { stem: "mountain-gorilla-01", alt: "Bamboo Saddle Lodge, view 1" },
      { stem: "mountain-gorilla-02", alt: "Bamboo Saddle Lodge, view 2" },
      { stem: "rwanda-lake-kivu", alt: "Bamboo Saddle Lodge, view 3" },
      { stem: "rwanda-district-musanze", alt: "Bamboo Saddle Lodge, view 4" },
      { stem: "rwanda-district-rubavu", alt: "Bamboo Saddle Lodge, view 5" },
    ],
    photoCount: 5,
    price: {
      fromUsd: 1521,
      fromRwf: 2242500,
      basis: "per person, per night",
      includes: "Accommodation, all meals, local drinks (excluding reserve wines and champagne), laundry, 3% tourism tax, and all lodge-based activities",
    },
    nightlyRateRwf: 2242500,
    rating: null,
    operator: null,
    cardName: { lead: "Bamboo Saddle", rest: "Lodge" },
    summary: "Lodge • luxury • all-inclusive",
    cardImage: { stem: "mountain-gorilla-01", alt: "Bamboo Saddle Lodge, Volcanoes National Park" },
    about: [
      "Bamboo Saddle Lodge is a fictional lodge in Kinigi, Volcanoes National Park, created for the Injishi demo. It is not a real business.",
      "Demo rates start at 2,242,500 RWF per person, per night (accommodation, all meals, local drinks (excluding reserve wines and champagne), laundry, 3% tourism tax, and all lodge-based activities).",
    ],
    highlights: [
      { icon: "calendar", title: "9 rooms", body: "The accommodation has 9 rooms in total." },
      {
        icon: "kitchen",
        title: "Meals in the rate",
        body: "Accommodation, all meals, local drinks (excluding reserve wines and champagne), laundry, 3% tourism tax, and all lodge-based activities.",
      },
      { icon: "location", title: "Where it sits", body: "Kinigi, in Volcanoes National Park." },
    ],
    specs: [
      { label: "Type", value: "Lodge" },
      { label: "Rooms", value: "9" },
      { label: "Neighbourhood", value: "Kinigi" },
      { label: "Rate basis", value: "per person, per night" },
      {
        label: "Included",
        value: "Accommodation, all meals, local drinks (excluding reserve wines and champagne), laundry, 3% tourism tax, and all lodge-based activities",
      },
    ],
    amenities: [
      { icon: "jet-ski", label: "En-suite bathrooms" },
      { icon: "wave-sine", label: "Sheltered verandas" },
      { icon: "wifi-high", label: "Wi-Fi in rooms and main area" },
    ],
    place: {
      addressLines: [
        "Kinigi",
        "Volcanoes National Park, Rwanda",
      ],
      latitude: null,
      longitude: null,
      blurb: "Kinigi sits in Volcanoes National Park. This is a fictional demo property and has no real address.",
    },
    thingsToKnow: [
      {
        title: "House rules",
        icon: "rules",
        items: [
          "Gorilla permits are booked separately, at USD 1,500 per trek",
          "Check-in and checkout times are set by the accommodation",
          "Confirmed in writing when your booking is accepted",
        ],
        learnMoreHref: "/support",
      },
      {
        title: "Paying through Injishi",
        icon: "safety",
        items: [
          "Payment is held in escrow until check-in",
          "Released to the host only once you have arrived",
          "Rates shown exclude taxes unless the accommodation states otherwise",
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
    sources: [],
  },
  {
    slug: "cloudline-lodge",
    name: "Cloudline Lodge",
    location: "Musanze, Volcanoes National Park",
    district: "musanze",
    kind: "lodge",
    propertyType: "Lodge in Volcanoes National Park",
    starClass: null,
    rooms: 12,
    bedrooms: 1,
    maxGuests: 2,
    capacity: [
      "12 rooms",
      "luxury",
      "per person, per night",
    ],
    heroImage: { stem: "mountain-gorilla-02", alt: "Cloudline Lodge, Volcanoes National Park" },
    gallery: [
      { stem: "mountain-gorilla-02", alt: "Cloudline Lodge, view 1" },
      { stem: "rwanda-lake-kivu", alt: "Cloudline Lodge, view 2" },
      { stem: "rwanda-district-musanze", alt: "Cloudline Lodge, view 3" },
      { stem: "rwanda-district-rubavu", alt: "Cloudline Lodge, view 4" },
      { stem: "rwanda-district-kigali", alt: "Cloudline Lodge, view 5" },
    ],
    photoCount: 5,
    price: {
      fromUsd: 1220,
      fromRwf: 1799000,
      basis: "per person, per night",
      includes: "Accommodation and meals, soft drinks, standard and premium alcoholic drinks, signature cocktails, cellar collection wines (except French champagne), single malt whiskeys, laundry services, any activities at the lodges, and all massages",
    },
    nightlyRateRwf: 1799000,
    rating: null,
    operator: null,
    cardName: { lead: "Cloudline", rest: "Lodge" },
    summary: "Lodge • luxury • all-inclusive",
    cardImage: { stem: "mountain-gorilla-02", alt: "Cloudline Lodge, Volcanoes National Park" },
    about: [
      "Cloudline Lodge is a fictional lodge in Musanze, Volcanoes National Park, created for the Injishi demo. It is not a real business.",
      "Demo rates start at 1,799,000 RWF per person, per night (accommodation and meals, soft drinks, standard and premium alcoholic drinks, signature cocktails, cellar collection wines (except french champagne), single malt whiskeys, laundry services, any activities at the lodges, and all massages).",
    ],
    highlights: [
      { icon: "calendar", title: "12 rooms", body: "The accommodation has 12 rooms in total." },
      {
        icon: "kitchen",
        title: "Meals in the rate",
        body: "Accommodation and meals, soft drinks, standard and premium alcoholic drinks, signature cocktails, cellar collection wines (except French champagne), single malt whiskeys, laundry services, any activities at the lodges, and all massages.",
      },
      { icon: "location", title: "Where it sits", body: "Musanze, in Volcanoes National Park." },
    ],
    specs: [
      { label: "Type", value: "Lodge" },
      { label: "Rooms", value: "12" },
      { label: "Neighbourhood", value: "Musanze" },
      { label: "Rate basis", value: "per person, per night" },
      {
        label: "Included",
        value: "Accommodation and meals, soft drinks, standard and premium alcoholic drinks, signature cocktails, cellar collection wines (except French champagne), single malt whiskeys, laundry services, any activities at the lodges, and all massages",
      },
    ],
    amenities: [
      { icon: "wifi-high", label: "Wi-Fi throughout the lodge" },
      { icon: "wave-sine", label: "Private terrace with volcano and lake views" },
      { icon: "jet-ski", label: "En-suite bathrooms" },
    ],
    place: {
      addressLines: [
        "Musanze",
        "Volcanoes National Park, Rwanda",
      ],
      latitude: null,
      longitude: null,
      blurb: "Musanze sits in Volcanoes National Park. This is a fictional demo property and has no real address.",
    },
    thingsToKnow: [
      {
        title: "House rules",
        icon: "rules",
        items: [
          "Gorilla permits are booked separately, at USD 1,500 per trek",
          "Check-in and checkout times are set by the accommodation",
          "Confirmed in writing when your booking is accepted",
        ],
        learnMoreHref: "/support",
      },
      {
        title: "Paying through Injishi",
        icon: "safety",
        items: [
          "Payment is held in escrow until check-in",
          "Released to the host only once you have arrived",
          "Rates shown exclude taxes unless the accommodation states otherwise",
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
    sources: [],
  },
  {
    slug: "silverback-hollow-lodge",
    name: "Silverback Hollow Lodge",
    location: "Kinigi, Musanze, Volcanoes National Park",
    district: "musanze",
    kind: "lodge",
    propertyType: "Lodge in Volcanoes National Park",
    starClass: null,
    rooms: 11,
    bedrooms: 1,
    maxGuests: 2,
    capacity: [
      "11 rooms",
      "luxury",
      "per person, per night",
    ],
    heroImage: { stem: "rwanda-lake-kivu", alt: "Silverback Hollow Lodge, Volcanoes National Park" },
    gallery: [
      { stem: "rwanda-lake-kivu", alt: "Silverback Hollow Lodge, view 1" },
      { stem: "rwanda-district-musanze", alt: "Silverback Hollow Lodge, view 2" },
      { stem: "rwanda-district-rubavu", alt: "Silverback Hollow Lodge, view 3" },
      { stem: "rwanda-district-kigali", alt: "Silverback Hollow Lodge, view 4" },
      { stem: "volcanoes-np-02", alt: "Silverback Hollow Lodge, view 5" },
    ],
    photoCount: 5,
    price: { fromUsd: 2720, fromRwf: 4010500, basis: "per person, per night", includes: "Accommodation" },
    nightlyRateRwf: 4010500,
    rating: null,
    operator: null,
    cardName: { lead: "Silverback Hollow", rest: "Lodge" },
    summary: "Lodge • luxury • all-inclusive",
    cardImage: { stem: "rwanda-lake-kivu", alt: "Silverback Hollow Lodge, Volcanoes National Park" },
    about: [
      "Silverback Hollow Lodge is a fictional lodge in Kinigi, Musanze, Volcanoes National Park, created for the Injishi demo. It is not a real business.",
      "Demo rates start at 4,010,500 RWF per person, per night (accommodation).",
    ],
    highlights: [
      { icon: "calendar", title: "11 rooms", body: "The accommodation has 11 rooms in total." },
      { icon: "location", title: "Where it sits", body: "Kinigi, in Musanze, Volcanoes National Park." },
    ],
    specs: [
      { label: "Type", value: "Lodge" },
      { label: "Rooms", value: "11" },
      { label: "Neighbourhood", value: "Kinigi" },
      { label: "Rate basis", value: "per person, per night" },
      { label: "Included", value: "Accommodation" },
    ],
    amenities: [
      { icon: "kayak", label: "Private outdoor heated plunge pools" },
      { icon: "jet-ski", label: "Timber-framed volcano-view windows" },
    ],
    place: {
      addressLines: [
        "Kinigi",
        "Musanze, Volcanoes National Park, Rwanda",
      ],
      latitude: null,
      longitude: null,
      blurb: "Kinigi sits in Musanze, Volcanoes National Park. This is a fictional demo property and has no real address.",
    },
    thingsToKnow: [
      {
        title: "House rules",
        icon: "rules",
        items: [
          "Gorilla permits are booked separately, at USD 1,500 per trek",
          "Check-in and checkout times are set by the accommodation",
          "Confirmed in writing when your booking is accepted",
        ],
        learnMoreHref: "/support",
      },
      {
        title: "Paying through Injishi",
        icon: "safety",
        items: [
          "Payment is held in escrow until check-in",
          "Released to the host only once you have arrived",
          "Rates shown exclude taxes unless the accommodation states otherwise",
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
    sources: [],
  },
  {
    slug: "treefern-nest-lodge",
    name: "Treefern Nest Lodge",
    location: "Kinigi, Volcanoes National Park",
    district: "musanze",
    kind: "lodge",
    propertyType: "Lodge in Volcanoes National Park",
    starClass: null,
    rooms: null,
    bedrooms: 1,
    maxGuests: 2,
    capacity: [
      "Lodge",
      "luxury",
      "per person, per night",
    ],
    heroImage: { stem: "rwanda-district-musanze", alt: "Treefern Nest Lodge, Volcanoes National Park" },
    gallery: [
      { stem: "rwanda-district-musanze", alt: "Treefern Nest Lodge, view 1" },
      { stem: "rwanda-district-rubavu", alt: "Treefern Nest Lodge, view 2" },
      { stem: "rwanda-district-kigali", alt: "Treefern Nest Lodge, view 3" },
      { stem: "volcanoes-np-02", alt: "Treefern Nest Lodge, view 4" },
      { stem: "volcanoes-np-03", alt: "Treefern Nest Lodge, view 5" },
    ],
    photoCount: 5,
    price: { fromUsd: null, fromRwf: null, basis: "per person, per night", includes: "Rate on request" },
    nightlyRateRwf: null,
    rating: null,
    operator: null,
    cardName: { lead: "Treefern Nest", rest: "Lodge" },
    summary: "Lodge • luxury • all-inclusive",
    cardImage: { stem: "rwanda-district-musanze", alt: "Treefern Nest Lodge, Volcanoes National Park" },
    about: [
      "Treefern Nest Lodge is a fictional lodge in Kinigi, Volcanoes National Park, created for the Injishi demo. It is not a real business.",
      "This demo stay is quoted on request.",
    ],
    highlights: [
      { icon: "location", title: "Where it sits", body: "Kinigi, in Volcanoes National Park." },
    ],
    specs: [
      { label: "Type", value: "Lodge" },
      { label: "Neighbourhood", value: "Kinigi" },
      { label: "Rate basis", value: "per person, per night" },
      { label: "Included", value: "Rate on request" },
    ],
    amenities: [
      { icon: "jet-ski", label: "The Boma for drumming and dance performances" },
      { icon: "shower", label: "Spa" },
    ],
    place: {
      addressLines: [
        "Kinigi",
        "Volcanoes National Park, Rwanda",
      ],
      latitude: null,
      longitude: null,
      blurb: "Kinigi sits in Volcanoes National Park. This is a fictional demo property and has no real address.",
    },
    thingsToKnow: [
      {
        title: "House rules",
        icon: "rules",
        items: [
          "Gorilla permits are booked separately, at USD 1,500 per trek",
          "Check-in and checkout times are set by the accommodation",
          "Confirmed in writing when your booking is accepted",
        ],
        learnMoreHref: "/support",
      },
      {
        title: "Paying through Injishi",
        icon: "safety",
        items: [
          "Payment is held in escrow until check-in",
          "Released to the host only once you have arrived",
          "Rates shown exclude taxes unless the accommodation states otherwise",
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
    sources: [],
  },
  {
    slug: "seven-craters-boutique-hotel",
    name: "Seven Craters Boutique Hotel",
    location: "Musanze, Volcanoes National Park",
    district: "musanze",
    kind: "hotel",
    propertyType: "Hotel in Volcanoes National Park",
    starClass: null,
    rooms: 13,
    bedrooms: 1,
    maxGuests: 2,
    capacity: [
      "13 rooms",
      "mid range",
      "per room, per night",
    ],
    heroImage: { stem: "rwanda-district-rubavu", alt: "Seven Craters Boutique Hotel, Volcanoes National Park" },
    gallery: [
      { stem: "rwanda-district-rubavu", alt: "Seven Craters Boutique Hotel, view 1" },
      { stem: "rwanda-district-kigali", alt: "Seven Craters Boutique Hotel, view 2" },
      { stem: "volcanoes-np-02", alt: "Seven Craters Boutique Hotel, view 3" },
      { stem: "volcanoes-np-03", alt: "Seven Craters Boutique Hotel, view 4" },
      { stem: "mountain-gorilla-01", alt: "Seven Craters Boutique Hotel, view 5" },
    ],
    photoCount: 5,
    price: {
      fromUsd: null,
      fromRwf: null,
      basis: "per room, per night",
      includes: "Full board - breakfast, lunch and dinner - plus early trek-day breakfast and timing support",
    },
    nightlyRateRwf: null,
    rating: null,
    operator: null,
    cardName: { lead: "Seven Craters Boutique", rest: "Hotel" },
    summary: "Hotel • mid range",
    cardImage: { stem: "rwanda-district-rubavu", alt: "Seven Craters Boutique Hotel, Volcanoes National Park" },
    about: [
      "Seven Craters Boutique Hotel is a fictional hotel in Musanze, Volcanoes National Park, created for the Injishi demo. It is not a real business.",
      "This demo stay is quoted on request.",
    ],
    highlights: [
      { icon: "calendar", title: "13 rooms", body: "The accommodation has 13 rooms in total." },
      { icon: "kitchen", title: "Meals in the rate", body: "Full board - breakfast, lunch and dinner - plus early trek-day breakfast and timing support." },
      { icon: "location", title: "Where it sits", body: "Musanze, in Volcanoes National Park." },
    ],
    specs: [
      { label: "Type", value: "Hotel" },
      { label: "Rooms", value: "13" },
      { label: "Neighbourhood", value: "Musanze" },
      { label: "Rate basis", value: "per room, per night" },
      { label: "Included", value: "Full board - breakfast, lunch and dinner - plus early trek-day breakfast and timing support" },
    ],
    amenities: [
      { icon: "shower", label: "Sauna" },
      { icon: "shower", label: "Post-trek foot massage" },
      { icon: "shower", label: "Spa / wellness menu" },
      { icon: "jet-ski", label: "Walk-in mosquito nets" },
    ],
    place: {
      addressLines: [
        "Musanze",
        "Volcanoes National Park, Rwanda",
      ],
      latitude: null,
      longitude: null,
      blurb: "Musanze sits in Volcanoes National Park. This is a fictional demo property and has no real address.",
    },
    thingsToKnow: [
      {
        title: "House rules",
        icon: "rules",
        items: [
          "Gorilla permits are booked separately, at USD 1,500 per trek",
          "Check-in and checkout times are set by the accommodation",
          "Confirmed in writing when your booking is accepted",
        ],
        learnMoreHref: "/support",
      },
      {
        title: "Paying through Injishi",
        icon: "safety",
        items: [
          "Payment is held in escrow until check-in",
          "Released to the host only once you have arrived",
          "Rates shown exclude taxes unless the accommodation states otherwise",
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
    sources: [],
  },
  {
    slug: "papyrus-shore-camp",
    name: "Papyrus Shore Camp",
    location: "Nyagatare, Akagera National Park",
    district: "nyagatare",
    kind: "tented_camp",
    propertyType: "Tented camp in Akagera National Park",
    starClass: null,
    rooms: 8,
    bedrooms: 1,
    maxGuests: 2,
    capacity: [
      "8 tents",
      "luxury",
      "per person, per night",
    ],
    heroImage: { stem: "akagera-np-01", alt: "Papyrus Shore Camp, Akagera National Park" },
    gallery: [
      { stem: "akagera-np-01", alt: "Papyrus Shore Camp, view 1" },
      { stem: "akagera-np-02", alt: "Papyrus Shore Camp, view 2" },
      { stem: "akagera-np-03", alt: "Papyrus Shore Camp, view 3" },
      { stem: "rwanda-lake-kivu", alt: "Papyrus Shore Camp, view 4" },
      { stem: "rwanda-district-musanze", alt: "Papyrus Shore Camp, view 5" },
    ],
    photoCount: 5,
    price: {
      fromUsd: 964,
      fromRwf: 1421500,
      basis: "per person, per night",
      includes: "Accommodation, all meals, twice-daily scheduled activities, all local drinks (excluding premium imported brands and champagne), laundry, 3% tourism tax, and transfers between camp and Akagera National Park North Gate",
    },
    nightlyRateRwf: 1421500,
    rating: null,
    operator: null,
    cardName: { lead: "Papyrus Shore", rest: "Camp" },
    summary: "Tented camp • luxury • all-inclusive",
    cardImage: { stem: "akagera-np-01", alt: "Papyrus Shore Camp, Akagera National Park" },
    about: [
      "Papyrus Shore Camp is a fictional tented camp in Nyagatare, Akagera National Park, created for the Injishi demo. It is not a real business.",
      "Demo rates start at 1,421,500 RWF per person, per night (accommodation, all meals, twice-daily scheduled activities, all local drinks (excluding premium imported brands and champagne), laundry, 3% tourism tax, and transfers between camp and akagera national park north gate).",
    ],
    highlights: [
      { icon: "calendar", title: "8 rooms", body: "The accommodation has 8 rooms in total." },
      {
        icon: "kitchen",
        title: "Meals in the rate",
        body: "Accommodation, all meals, twice-daily scheduled activities, all local drinks (excluding premium imported brands and champagne), laundry, 3% tourism tax, and transfers between camp and Akagera National Park North Gate.",
      },
      { icon: "location", title: "Where it sits", body: "Nyagatare, in Akagera National Park." },
    ],
    specs: [
      { label: "Type", value: "Tented camp" },
      { label: "Rooms", value: "8" },
      { label: "Neighbourhood", value: "Nyagatare" },
      { label: "Rate basis", value: "per person, per night" },
      {
        label: "Included",
        value: "Accommodation, all meals, twice-daily scheduled activities, all local drinks (excluding premium imported brands and champagne), laundry, 3% tourism tax, and transfers between camp and Akagera National Park North Gate",
      },
    ],
    amenities: [
      { icon: "kayak", label: "Swimming pool" },
      { icon: "wifi-high", label: "Wi-Fi" },
      { icon: "wave-sine", label: "Private balconies on stilted decks" },
    ],
    place: {
      addressLines: [
        "Nyagatare",
        "Akagera National Park, Rwanda",
      ],
      latitude: null,
      longitude: null,
      blurb: "Nyagatare sits in Akagera National Park. This is a fictional demo property and has no real address.",
    },
    thingsToKnow: [
      {
        title: "House rules",
        icon: "rules",
        items: [
          "Check-in and checkout times are set by the accommodation",
          "Confirmed in writing when your booking is accepted",
        ],
        learnMoreHref: "/support",
      },
      {
        title: "Paying through Injishi",
        icon: "safety",
        items: [
          "Payment is held in escrow until check-in",
          "Released to the host only once you have arrived",
          "Rates shown exclude taxes unless the accommodation states otherwise",
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
    sources: [],
  },
  {
    slug: "hippo-bend-tented-lodge",
    name: "Hippo Bend Tented Lodge",
    location: "Kayonza, Akagera National Park",
    district: "nyagatare",
    kind: "tented_camp",
    propertyType: "Tented camp in Akagera National Park",
    starClass: null,
    rooms: 9,
    bedrooms: 1,
    maxGuests: 2,
    capacity: [
      "9 tents",
      "mid range",
      "per person, per night",
    ],
    heroImage: { stem: "akagera-np-02", alt: "Hippo Bend Tented Lodge, Akagera National Park" },
    gallery: [
      { stem: "akagera-np-02", alt: "Hippo Bend Tented Lodge, view 1" },
      { stem: "akagera-np-03", alt: "Hippo Bend Tented Lodge, view 2" },
      { stem: "rwanda-lake-kivu", alt: "Hippo Bend Tented Lodge, view 3" },
      { stem: "rwanda-district-musanze", alt: "Hippo Bend Tented Lodge, view 4" },
      { stem: "rwanda-district-rubavu", alt: "Hippo Bend Tented Lodge, view 5" },
    ],
    photoCount: 5,
    price: { fromUsd: null, fromRwf: null, basis: "per person, per night", includes: "Includes all meals (full board)" },
    nightlyRateRwf: null,
    rating: null,
    operator: null,
    cardName: { lead: "Hippo Bend Tented", rest: "Lodge" },
    summary: "Tented camp • mid range • all-inclusive",
    cardImage: { stem: "akagera-np-02", alt: "Hippo Bend Tented Lodge, Akagera National Park" },
    about: [
      "Hippo Bend Tented Lodge is a fictional tented camp in Kayonza, Akagera National Park, created for the Injishi demo. It is not a real business.",
      "This demo stay is quoted on request.",
    ],
    highlights: [
      { icon: "calendar", title: "9 rooms", body: "The accommodation has 9 rooms in total." },
      { icon: "kitchen", title: "Meals in the rate", body: "Includes all meals (full board)." },
      { icon: "location", title: "Where it sits", body: "Kayonza, in Akagera National Park." },
    ],
    specs: [
      { label: "Type", value: "Tented camp" },
      { label: "Rooms", value: "9" },
      { label: "Neighbourhood", value: "Kayonza" },
      { label: "Rate basis", value: "per person, per night" },
      { label: "Included", value: "Includes all meals (full board)" },
    ],
    amenities: [
      { icon: "jet-ski", label: "Solar power in tents and main area, 24 hours a day" },
      { icon: "wifi-high", label: "Wi-Fi in each tent and in the lounge" },
      { icon: "wave-sine", label: "Shaded verandas with campaign chairs" },
      { icon: "wave-sine", label: "Raised deck over Lake Ihema" },
    ],
    place: {
      addressLines: [
        "Kayonza",
        "Akagera National Park, Rwanda",
      ],
      latitude: null,
      longitude: null,
      blurb: "Kayonza sits in Akagera National Park. This is a fictional demo property and has no real address.",
    },
    thingsToKnow: [
      {
        title: "House rules",
        icon: "rules",
        items: [
          "Check-in and checkout times are set by the accommodation",
          "Confirmed in writing when your booking is accepted",
        ],
        learnMoreHref: "/support",
      },
      {
        title: "Paying through Injishi",
        icon: "safety",
        items: [
          "Payment is held in escrow until check-in",
          "Released to the host only once you have arrived",
          "Rates shown exclude taxes unless the accommodation states otherwise",
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
    sources: [],
  },
  {
    slug: "acacia-horizon-game-lodge",
    name: "Acacia Horizon Game Lodge",
    location: "Kayonza, Akagera National Park",
    district: "nyagatare",
    kind: "lodge",
    propertyType: "Lodge in Akagera National Park",
    starClass: null,
    rooms: 60,
    bedrooms: 1,
    maxGuests: 2,
    capacity: [
      "60 rooms",
      "mid range",
      "per room, per night",
    ],
    heroImage: { stem: "akagera-np-03", alt: "Acacia Horizon Game Lodge, Akagera National Park" },
    gallery: [
      { stem: "akagera-np-03", alt: "Acacia Horizon Game Lodge, view 1" },
      { stem: "rwanda-lake-kivu", alt: "Acacia Horizon Game Lodge, view 2" },
      { stem: "rwanda-district-musanze", alt: "Acacia Horizon Game Lodge, view 3" },
      { stem: "rwanda-district-rubavu", alt: "Acacia Horizon Game Lodge, view 4" },
      { stem: "rwanda-district-kigali", alt: "Acacia Horizon Game Lodge, view 5" },
    ],
    photoCount: 5,
    price: {
      fromUsd: null,
      fromRwf: null,
      basis: "per room, per night",
      includes: "Board basis is bed & breakfast plus 18% VAT, with bed-only rates on request; compulsory conservation and park fees are excluded",
    },
    nightlyRateRwf: null,
    rating: null,
    operator: null,
    cardName: { lead: "Acacia Horizon Game", rest: "Lodge" },
    summary: "Lodge • mid range",
    cardImage: { stem: "akagera-np-03", alt: "Acacia Horizon Game Lodge, Akagera National Park" },
    about: [
      "Acacia Horizon Game Lodge is a fictional lodge in Kayonza, Akagera National Park, created for the Injishi demo. It is not a real business.",
      "This demo stay is quoted on request.",
    ],
    highlights: [
      { icon: "calendar", title: "60 rooms", body: "The accommodation has 60 rooms in total." },
      {
        icon: "kitchen",
        title: "Meals in the rate",
        body: "Board basis is bed & breakfast plus 18% VAT, with bed-only rates on request; compulsory conservation and park fees are excluded.",
      },
      { icon: "location", title: "Where it sits", body: "Kayonza, in Akagera National Park." },
    ],
    specs: [
      { label: "Type", value: "Lodge" },
      { label: "Rooms", value: "60" },
      { label: "Neighbourhood", value: "Kayonza" },
      { label: "Rate basis", value: "per room, per night" },
      { label: "Included", value: "Board basis is bed & breakfast plus 18% VAT, with bed-only rates on request; compulsory conservation and park fees are excluded" },
    ],
    amenities: [
      { icon: "fork-knife", label: "Restaurant and bar" },
    ],
    place: {
      addressLines: [
        "Kayonza",
        "Akagera National Park, Rwanda",
      ],
      latitude: null,
      longitude: null,
      blurb: "Kayonza sits in Akagera National Park. This is a fictional demo property and has no real address.",
    },
    thingsToKnow: [
      {
        title: "House rules",
        icon: "rules",
        items: [
          "Check-in and checkout times are set by the accommodation",
          "Confirmed in writing when your booking is accepted",
        ],
        learnMoreHref: "/support",
      },
      {
        title: "Paying through Injishi",
        icon: "safety",
        items: [
          "Payment is held in escrow until check-in",
          "Released to the host only once you have arrived",
          "Rates shown exclude taxes unless the accommodation states otherwise",
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
    sources: [],
  },
  {
    slug: "mossgrove-forest-house",
    name: "Mossgrove Forest House",
    location: "Gisakura, Nyungwe Forest National Park",
    district: "rusizi",
    kind: "lodge",
    propertyType: "Lodge in Nyungwe Forest National Park",
    starClass: null,
    rooms: 22,
    bedrooms: 1,
    maxGuests: 2,
    capacity: [
      "22 rooms",
      "luxury",
      "per person, per night",
    ],
    heroImage: { stem: "rwanda-tea-01", alt: "Mossgrove Forest House, Nyungwe Forest National Park" },
    gallery: [
      { stem: "rwanda-tea-01", alt: "Mossgrove Forest House, view 1" },
      { stem: "rwanda-tea-02", alt: "Mossgrove Forest House, view 2" },
      { stem: "rwanda-lake-kivu", alt: "Mossgrove Forest House, view 3" },
      { stem: "rwanda-district-musanze", alt: "Mossgrove Forest House, view 4" },
      { stem: "rwanda-district-rubavu", alt: "Mossgrove Forest House, view 5" },
    ],
    photoCount: 5,
    price: {
      fromUsd: 3000,
      fromRwf: 4423500,
      basis: "per person, per night",
      includes: "All meals, alcoholic and non-alcoholic beverages, park fees and guided activities (typically two per person per day), Rwanda VAT and service charges",
    },
    nightlyRateRwf: 4423500,
    rating: null,
    operator: null,
    cardName: { lead: "Mossgrove Forest", rest: "House" },
    summary: "Lodge • luxury • all-inclusive",
    cardImage: { stem: "rwanda-tea-01", alt: "Mossgrove Forest House, Nyungwe Forest National Park" },
    featuredRank: 6,
    about: [
      "Mossgrove Forest House is a fictional lodge in Gisakura, Nyungwe Forest National Park, created for the Injishi demo. It is not a real business.",
      "Demo rates start at 4,423,500 RWF per person, per night (all meals, alcoholic and non-alcoholic beverages, park fees and guided activities (typically two per person per day), rwanda vat and service charges).",
    ],
    highlights: [
      { icon: "calendar", title: "22 rooms", body: "The accommodation has 22 rooms in total." },
      {
        icon: "kitchen",
        title: "Meals in the rate",
        body: "All meals, alcoholic and non-alcoholic beverages, park fees and guided activities (typically two per person per day), Rwanda VAT and service charges.",
      },
      { icon: "location", title: "Where it sits", body: "Gisakura, in Nyungwe Forest National Park." },
    ],
    specs: [
      { label: "Type", value: "Lodge" },
      { label: "Rooms", value: "22" },
      { label: "Neighbourhood", value: "Gisakura" },
      { label: "Rate basis", value: "per person, per night" },
      {
        label: "Included",
        value: "All meals, alcoholic and non-alcoholic beverages, park fees and guided activities (typically two per person per day), Rwanda VAT and service charges",
      },
    ],
    amenities: [
      { icon: "wave-sine", label: "Private hot tub and balcony per suite" },
      { icon: "jet-ski", label: "Signature chimpanzee discovery trek" },
      { icon: "jet-ski", label: "Working tea plantation and guided tea tasting" },
    ],
    place: {
      addressLines: [
        "Gisakura",
        "Nyungwe Forest National Park, Rwanda",
      ],
      latitude: null,
      longitude: null,
      blurb: "Gisakura sits in Nyungwe Forest National Park. This is a fictional demo property and has no real address.",
    },
    thingsToKnow: [
      {
        title: "House rules",
        icon: "rules",
        items: [
          "Check-in and checkout times are set by the accommodation",
          "Confirmed in writing when your booking is accepted",
        ],
        learnMoreHref: "/support",
      },
      {
        title: "Paying through Injishi",
        icon: "safety",
        items: [
          "Payment is held in escrow until check-in",
          "Released to the host only once you have arrived",
          "Rates shown exclude taxes unless the accommodation states otherwise",
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
    sources: [],
  },
  {
    slug: "colobus-ridge-hotel",
    name: "Colobus Ridge Hotel",
    location: "Gisakura village, Nyungwe Forest National Park",
    district: "rusizi",
    kind: "hotel",
    propertyType: "Hotel in Nyungwe Forest National Park",
    starClass: 3,
    rooms: 12,
    bedrooms: 1,
    maxGuests: 2,
    capacity: [
      "12 rooms",
      "budget",
      "per room, per night",
    ],
    heroImage: { stem: "rwanda-tea-02", alt: "Colobus Ridge Hotel, Nyungwe Forest National Park" },
    gallery: [
      { stem: "rwanda-tea-02", alt: "Colobus Ridge Hotel, view 1" },
      { stem: "rwanda-lake-kivu", alt: "Colobus Ridge Hotel, view 2" },
      { stem: "rwanda-district-musanze", alt: "Colobus Ridge Hotel, view 3" },
      { stem: "rwanda-district-rubavu", alt: "Colobus Ridge Hotel, view 4" },
      { stem: "rwanda-district-kigali", alt: "Colobus Ridge Hotel, view 5" },
    ],
    photoCount: 5,
    price: { fromUsd: null, fromRwf: null, basis: "per room, per night", includes: "Guests choose Bed & Breakfast, Half Board or Full Board" },
    nightlyRateRwf: null,
    rating: null,
    operator: null,
    cardName: { lead: "Colobus Ridge", rest: "Hotel" },
    summary: "Hotel • budget",
    cardImage: { stem: "rwanda-tea-02", alt: "Colobus Ridge Hotel, Nyungwe Forest National Park" },
    about: [
      "Colobus Ridge Hotel is a fictional 3-star hotel in Gisakura village, Nyungwe Forest National Park, created for the Injishi demo. It is not a real business.",
      "This demo stay is quoted on request.",
    ],
    highlights: [
      { icon: "sparkle", title: "3-star accommodation", body: "Classified 3-star." },
      { icon: "calendar", title: "12 rooms", body: "The accommodation has 12 rooms in total." },
      { icon: "kitchen", title: "Meals in the rate", body: "Guests choose Bed & Breakfast, Half Board or Full Board." },
      { icon: "location", title: "Where it sits", body: "Gisakura village, in Nyungwe Forest National Park." },
    ],
    specs: [
      { label: "Type", value: "Hotel" },
      { label: "Class", value: "3-star" },
      { label: "Rooms", value: "12" },
      { label: "Neighbourhood", value: "Gisakura village" },
      { label: "Rate basis", value: "per room, per night" },
      { label: "Included", value: "Guests choose Bed & Breakfast, Half Board or Full Board" },
    ],
    amenities: [
      { icon: "wave-sine", label: "Private balcony with sunrise or sunset views" },
    ],
    place: {
      addressLines: [
        "Gisakura village",
        "Nyungwe Forest National Park, Rwanda",
      ],
      latitude: null,
      longitude: null,
      blurb: "Gisakura village sits in Nyungwe Forest National Park. This is a fictional demo property and has no real address.",
    },
    thingsToKnow: [
      {
        title: "House rules",
        icon: "rules",
        items: [
          "Check-in and checkout times are set by the accommodation",
          "Confirmed in writing when your booking is accepted",
        ],
        learnMoreHref: "/support",
      },
      {
        title: "Paying through Injishi",
        icon: "safety",
        items: [
          "Payment is held in escrow until check-in",
          "Released to the host only once you have arrived",
          "Rates shown exclude taxes unless the accommodation states otherwise",
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
    sources: [],
  },
  {
    slug: "heronstone-lodge",
    name: "Heronstone Lodge",
    location: "Kibuye, Lake Kivu",
    district: "karongi",
    kind: "lodge",
    propertyType: "Lodge in Lake Kivu",
    starClass: null,
    rooms: 5,
    bedrooms: 1,
    maxGuests: 2,
    capacity: [
      "5 rooms",
      "mid range",
      "per person, per night",
    ],
    heroImage: { stem: "karongi-01", alt: "Heronstone Lodge, Lake Kivu" },
    gallery: [
      { stem: "karongi-01", alt: "Heronstone Lodge, view 1" },
      { stem: "karongi-02", alt: "Heronstone Lodge, view 2" },
      { stem: "rwanda-lake-kivu", alt: "Heronstone Lodge, view 3" },
      { stem: "rwanda-district-musanze", alt: "Heronstone Lodge, view 4" },
      { stem: "rwanda-district-rubavu", alt: "Heronstone Lodge, view 5" },
    ],
    photoCount: 5,
    price: { fromUsd: null, fromRwf: null, basis: "per person, per night", includes: "Rate on request" },
    nightlyRateRwf: null,
    rating: null,
    operator: null,
    cardName: { lead: "Heronstone", rest: "Lodge" },
    summary: "Lodge • mid range • all-inclusive",
    cardImage: { stem: "karongi-01", alt: "Heronstone Lodge, Lake Kivu" },
    about: [
      "Heronstone Lodge is a fictional lodge in Kibuye, Lake Kivu, created for the Injishi demo. It is not a real business.",
      "This demo stay is quoted on request.",
    ],
    highlights: [
      { icon: "calendar", title: "5 rooms", body: "The accommodation has 5 rooms in total." },
      { icon: "location", title: "Where it sits", body: "Kibuye, in Lake Kivu." },
    ],
    specs: [
      { label: "Type", value: "Lodge" },
      { label: "Rooms", value: "5" },
      { label: "Neighbourhood", value: "Kibuye" },
      { label: "Rate basis", value: "per person, per night" },
      { label: "Included", value: "Rate on request" },
    ],
    amenities: [
      { icon: "wave-sine", label: "Small man-made beach with sun umbrellas" },
      { icon: "jet-ski", label: "Windsurfing" },
      { icon: "fork-knife", label: "Restaurant on stilts over the lake" },
    ],
    place: {
      addressLines: [
        "Kibuye",
        "Lake Kivu, Rwanda",
      ],
      latitude: null,
      longitude: null,
      blurb: "Kibuye sits in Lake Kivu. This is a fictional demo property and has no real address.",
    },
    thingsToKnow: [
      {
        title: "House rules",
        icon: "rules",
        items: [
          "Check-in and checkout times are set by the accommodation",
          "Confirmed in writing when your booking is accepted",
        ],
        learnMoreHref: "/support",
      },
      {
        title: "Paying through Injishi",
        icon: "safety",
        items: [
          "Payment is held in escrow until check-in",
          "Released to the host only once you have arrived",
          "Rates shown exclude taxes unless the accommodation states otherwise",
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
    sources: [],
  },
  {
    slug: "sunbird-bay-hotel",
    name: "Sunbird Bay Hotel",
    location: "Gisenyi, Lake Kivu",
    district: "rubavu",
    kind: "hotel",
    propertyType: "Hotel in Lake Kivu",
    starClass: null,
    rooms: 66,
    bedrooms: 1,
    maxGuests: 2,
    capacity: [
      "66 rooms",
      "mid range",
      "per room, per night",
    ],
    heroImage: { stem: "karongi-02", alt: "Sunbird Bay Hotel, Lake Kivu" },
    gallery: [
      { stem: "karongi-02", alt: "Sunbird Bay Hotel, view 1" },
      { stem: "rwanda-lake-kivu", alt: "Sunbird Bay Hotel, view 2" },
      { stem: "rwanda-district-musanze", alt: "Sunbird Bay Hotel, view 3" },
      { stem: "rwanda-district-rubavu", alt: "Sunbird Bay Hotel, view 4" },
      { stem: "rwanda-district-kigali", alt: "Sunbird Bay Hotel, view 5" },
    ],
    photoCount: 5,
    price: { fromUsd: 190, fromRwf: 280000, basis: "per room, per night", includes: "Rate on request" },
    nightlyRateRwf: 280000,
    rating: null,
    operator: null,
    cardName: { lead: "Sunbird Bay", rest: "Hotel" },
    summary: "Hotel • mid range",
    cardImage: { stem: "karongi-02", alt: "Sunbird Bay Hotel, Lake Kivu" },
    featuredRank: 4,
    about: [
      "Sunbird Bay Hotel is a fictional hotel in Gisenyi, Lake Kivu, created for the Injishi demo. It is not a real business.",
      "Demo rates start at 280,000 RWF per room, per night (rate on request).",
    ],
    highlights: [
      { icon: "calendar", title: "66 rooms", body: "The accommodation has 66 rooms in total." },
      { icon: "location", title: "Where it sits", body: "Gisenyi, in Lake Kivu." },
    ],
    specs: [
      { label: "Type", value: "Hotel" },
      { label: "Rooms", value: "66" },
      { label: "Neighbourhood", value: "Gisenyi" },
      { label: "Rate basis", value: "per room, per night" },
      { label: "Included", value: "Rate on request" },
    ],
    amenities: [
      { icon: "kayak", label: "Outdoor swimming pool" },
      { icon: "wave-sine", label: "Private beach exclusively for hotel guests" },
      { icon: "jet-ski", label: "Water sports on the lake including jet skiing" },
      { icon: "jet-ski", label: "Room service" },
      { icon: "wave-sine", label: "Private balcony with lake views in every room" },
    ],
    place: {
      addressLines: [
        "Gisenyi",
        "Lake Kivu, Rwanda",
      ],
      latitude: null,
      longitude: null,
      blurb: "Gisenyi sits in Lake Kivu. This is a fictional demo property and has no real address.",
    },
    thingsToKnow: [
      {
        title: "House rules",
        icon: "rules",
        items: [
          "Check-in and checkout times are set by the accommodation",
          "Confirmed in writing when your booking is accepted",
        ],
        learnMoreHref: "/support",
      },
      {
        title: "Paying through Injishi",
        icon: "safety",
        items: [
          "Payment is held in escrow until check-in",
          "Released to the host only once you have arrived",
          "Rates shown exclude taxes unless the accommodation states otherwise",
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
    sources: [],
  },
];

// `findProperty` used to sit here and is deliberately gone. It searched THIS
// array, which is one half of the catalogue only, and every route that
// resolves a slug must search the whole of it or a sample listing's card links
// to a page that was never generated. `findCatalogueProperty` in
// `data/catalogue.ts` is the one lookup. It cannot live in this file: the
// catalogue imports the two halves, so a lookup here would be a cycle.
