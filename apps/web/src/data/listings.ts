import type { AccommodationClass } from "@injishi/contracts";
import { approximateLocation } from "@/data/approximate-location";
import type { DistrictSlug } from "@/data/search-options";
import type {
  Amenity,
  GalleryImage,
  PropertyDetail,
  Rating,
} from "@/data/properties";
import { ALL_PROPERTIES } from "@/data/catalogue";
import { facetsFor, type StayFacets } from "@/data/stay-facets";

/**
 * The explore listings.
 *
 * Derived from the property records rather than kept alongside them. The two
 * used to be separate arrays, and they drifted: every one of the 23 listings
 * pointed at a `/property/<slug>` page that had never been written, so the
 * whole explore grid 404ed. A card cannot now name a property that has no
 * page, because the card is built from the page's own record.
 *
 * TWO SOURCES, and the split is a policy rather than a convenience.
 * `PROPERTIES` holds thirty fictional demo stays (renamed from real businesses on
 * 2026-09-14). `FILLER_PROPERTIES` holds twenty-two openly
 * fictional stays, added so the rebuilt search page's twenty-block filter rail
 * has enough stock to show a working count against each facet. Read
 * `data/filler-properties.ts` before treating any listing as a real business.
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
  bedrooms: number;
  /** Sleeps. The party filter compares against this rather than guessing. */
  maxGuests: number;
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
   * set. Real data, carried across rather than invented. The `icon` field on
   * each is NOT usable here — the fixtures carry Phosphor names that never
   * matched the app's lucide map and are wrong about the thing anyway
   * ("kayak" on an outdoor pool, "jet-ski" on a convention centre) — so the
   * card picks its mark from the LABEL instead. See `lib/amenity-icon.ts`.
   */
  amenities: Amenity[];
  /**
   * Every filterable attribute, real and invented, in one bag.
   *
   * Computed once here rather than in the filter, because the rail also needs
   * it to COUNT — "Pool (17)" beside a facet is the same question the filter
   * asks, and computing it twice is how the two answers drift apart.
   * `data/stay-facets.ts` says which of these are true and which are fixture.
   */
  facets: StayFacets;
  image: GalleryImage;
  /** Every photograph, so the result card can run a carousel. */
  gallery: GalleryImage[];
  /**
   * Where the Explore map pins the stay: the property's public coordinates
   * when it has set them, otherwise its neighbourhood's (or district's)
   * centre — see `data/approximate-location.ts`. Null only when neither is
   * known; a card without a point simply has no pin.
   */
  latitude: number | null;
  longitude: number | null;
  /** True when the point above is a neighbourhood centre, not an address. */
  locationApproximate: boolean;
}

/** One property as an Explore card. Exported for the database half of discovery (`data/discovery.ts`). */
export function listingFor(property: PropertyDetail): Listing {
  const { latitude, longitude } = property.place;
  const exact = latitude !== null && longitude !== null;
  const point = exact
    ? { latitude, longitude }
    : approximateLocation(
        property.slug,
        property.place.addressLines[0] ?? property.location.split(",")[0],
        property.district,
      );
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
    // De-duplicated: several real records repeat the card image as gallery
    // slide one, and a carousel whose first two frames are the same photograph
    // reads as a broken carousel rather than as a short one.
    gallery: dedupeByStem([property.cardImage, ...property.gallery]),
    latitude: point?.latitude ?? null,
    longitude: point?.longitude ?? null,
    locationApproximate: !exact && point !== null,
  };
}

function dedupeByStem(images: GalleryImage[]): GalleryImage[] {
  const seen = new Set<string>();
  return images.filter((image) => {
    if (seen.has(image.stem)) return false;
    seen.add(image.stem);
    return true;
  });
}

/**
 * Ordered cheapest first, with the rate-on-request properties last.
 *
 * A tenth of the catalogue publishes no rate — mostly the lodges that quote
 * per itinerary. Sorting them to the end keeps the list readable without
 * inventing a number for them.
 */
export const LISTINGS: Listing[] = ALL_PROPERTIES.map(listingFor).sort((a, b) => {
  if (a.nightlyRateRwf === null && b.nightlyRateRwf === null) return 0;
  if (a.nightlyRateRwf === null) return 1;
  if (b.nightlyRateRwf === null) return -1;
  return a.nightlyRateRwf - b.nightlyRateRwf;
});
