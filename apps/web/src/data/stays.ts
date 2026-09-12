import { PROPERTIES } from "@/data/properties";

/**
 * The stay catalogue behind the header's search overlay.
 *
 * Derived from `PROPERTIES` so a search result always has somewhere to go —
 * it carries the slug for exactly that reason. The old catalogue was a
 * standalone array with no slug at all, and its prices bore no relation to
 * what Rwandan accommodation actually costs: a three-bedroom lodge was listed
 * at 8,050 RWF, roughly six US dollars a night.
 */

export interface CatalogStay {
  slug: string;
  name: string;
  area: string;
  district: string;
  bedrooms: number;
  /** Nightly rate in RWF, or null where the property publishes none. */
  price: number | null;
}

export interface DistrictCard {
  slug: string;
  name: string;
  listings: number;
  alt: string;
}

/**
 * The home page's three district tiles.
 *
 * The counts are derived, not written down. They used to read 27, 34 and 128
 * against a catalogue that held 23 stays in total, so every tile promised a
 * grid that did not exist behind it.
 */
export const DISTRICT_CARDS: DistrictCard[] = (
  [
    ["kigali", "Kigali", "Terrace overlooking the hills and rooftops of Kigali at sunset"],
    ["musanze", "Musanze", "Mist over the Virunga volcanoes above the green valleys of Musanze"],
    ["rubavu", "Rubavu", "Lakeside lodges among trees on the green shore of Lake Kivu at Rubavu"],
  ] as const
).map(([slug, name, alt]) => ({
  slug,
  name,
  alt,
  listings: PROPERTIES.filter((property) => property.district === slug).length,
}));

export const STAY_CATALOG: CatalogStay[] = PROPERTIES.map((property) => {
  const [area = property.location, region] = property.location
    .split(",")
    .map((part) => part.trim());
  return {
    slug: property.slug,
    name: property.name,
    area,
    district: region ?? area,
    bedrooms: property.bedrooms,
    price: property.nightlyRateRwf,
  };
});
