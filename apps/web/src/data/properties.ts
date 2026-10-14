// The shape a stay is drawn in on the marketplace's cards and pages.
//
// TYPES ONLY. This file held fifty-two fictional stays (with
// `data/filler-properties.ts`) that Explore, search and the home page listed
// beside the real ones. They were removed on 2026-10-08: every stay shown is
// now a property the database holds (`data/discovery.ts`).
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
  /** Null until the property uploads a photograph. */
  heroImage: GalleryImage | null;
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
  cardImage: GalleryImage | null;
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
