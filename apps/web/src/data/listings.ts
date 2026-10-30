import type { AccommodationClass } from "@injishi/contracts";
import type { DistrictSlug } from "@/data/search-options";
import type {
  Amenity,
  GalleryImage,
  PropertyDetail,
  Rating,
} from "@/data/properties";
import { facetsFor, type StayFacets } from "@/data/stay-facets";

/**
 * A stay as the cards draw it: Explore, the home bands, Saved and compare.
 *
 * Every listing is a property the database holds, built by `listingFor` from
 * the published card `data/discovery.ts` reads. The fifty-two fictional stays
 * this used to list beside them were removed on 2026-10-08.
 */

export interface Listing {
  slug: string;
  /** Rendered bold, ahead of `nameRest`. */
  nameLead: string;
  nameRest: string;
  location: string;
  district: DistrictSlug;
  /**
   * The accommodation class, carried so the filter rail can use it.
   *
   * It was on `PropertyDetail` all along and simply was not copied across, so
   * the rail's most prominent control - the only filled one in the bar - held
   * its choice in local component state and narrowed nothing.
   */
  kind: AccommodationClass;
  /** Null when unknown; a card then says nothing about bedrooms rather than "1". */
  bedrooms: number | null;
  /** Sleeps. The party filter compares against this rather than guessing. */
  maxGuests: number | null;
  /** 5, 4, 3, 2 or null. The rail's "Property class" group reads it. */
  starClass: number | null;
  /** Null where the property publishes no rate; the card says so. */
  nightlyRateRwf: number | null;
  /** What that rate actually buys — per room, or per person all-inclusive. */
  priceBasis: string;
  /** Room only, breakfast included, all meals. Drives the meal-plan facet. */
  priceIncludes: string;
  /**
   * Attributed, or null. Carried from `PropertyDetail` so the home bands can
   * print the same sourced score the coverflow prints; a card renders it only
   * where its surface asks for it.
   */
  rating: Rating | null;
  /**
   * The first two amenities the property lists, for the card facility row.
   *
   * Two, not all nine: the row is one line under a title, and a card that
   * lists everything ranks nothing. The property page still prints the full
   * set. The card picks its mark from the LABEL, not the `icon` field: see
   * `lib/amenity-icon.ts`.
   */
  amenities: Amenity[];
  /**
   * Every filterable attribute, in one bag.
   *
   * Computed once here rather than in the filter, because the rail also needs
   * it to COUNT — "Pool (17)" beside a facet is the same question the filter
   * asks, and computing it twice is how the two answers drift apart.
   */
  facets: StayFacets;
  /** The cover photograph, or null when the property has uploaded none. */
  image: GalleryImage | null;
  /** Every photograph, so the result card can run a carousel. Empty when there are none. */
  gallery: GalleryImage[];
  /**
   * Where the Explore map pins the stay: the coordinates the host published.
   * Null when there are none, and a card without a point simply has no pin.
   */
  latitude: number | null;
  longitude: number | null;
  /** Always false now that no point is made up; kept for the map's note. */
  locationApproximate: boolean;
}

/** One property as an Explore card. Exported for the database half of discovery (`data/discovery.ts`). */
export function listingFor(property: PropertyDetail): Listing {
  const { latitude, longitude } = property.place;
  // Only the point the host published. A stay without one has no pin: it used
  // to be placed at its neighbourhood's centre with a made-up offset, which
  // put an invented location on the map (2026-10-29).
  const point = latitude !== null && longitude !== null ? { latitude, longitude } : null;
  return {
    slug: property.slug,
    nameLead: property.cardName.lead,
    nameRest: property.cardName.rest,
    location: property.location,
    district: property.district,
    kind: property.kind,
    bedrooms: property.bedrooms,
    maxGuests: property.maxGuests,
    starClass: property.starClass,
    nightlyRateRwf: property.nightlyRateRwf,
    priceBasis: property.price.basis,
    priceIncludes: property.price.includes,
    rating: property.rating,
    amenities: property.amenities.slice(0, 2),
    facets: facetsFor(property),
    image: property.cardImage,
    gallery: property.gallery,
    latitude: point?.latitude ?? null,
    longitude: point?.longitude ?? null,
    locationApproximate: false,
  };
}

/**
 * Cheapest first, with the rate-on-request properties last: sorting them to
 * the end keeps the list readable without inventing a number for them.
 */
export function byNightlyRate(a: Listing, b: Listing): number {
  if (a.nightlyRateRwf === null && b.nightlyRateRwf === null) return 0;
  if (a.nightlyRateRwf === null) return 1;
  if (b.nightlyRateRwf === null) return -1;
  return a.nightlyRateRwf - b.nightlyRateRwf;
}
