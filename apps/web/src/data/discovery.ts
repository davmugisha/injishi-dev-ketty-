import type {
  AccommodationClass,
  PropertyCard,
  PropertyDetail as ApiPropertyDetail,
} from "@injishi/contracts";
import { formatPrice } from "@injishi/utils";
import { findCatalogueProperty } from "@/data/catalogue";
import { listingFor, type Listing } from "@/data/listings";
import type { GalleryImage, PropertyDetail } from "@/data/properties";
import { DISTRICT_SLUGS, type DistrictSlug } from "@/data/search-options";
import { API_URL } from "@/lib/api";

/**
 * DISCOVERY FROM THE DATABASE (booking audit, 2026-09-13).
 *
 * Explore and `/property/[slug]` were built only from the catalogue kept in
 * this app (`data/catalogue.ts`). A property created in the operator app and
 * published was bookable by a guest who already held its checkout link, and
 * findable by nobody: it had no card and its page 404ed.
 *
 * This module reads the API's published properties ON THE SERVER, and turns
 * each one into the same two shapes the catalogue produces, so every existing
 * card, filter and page renders it unchanged. The catalogue still wins for a
 * slug it holds: those records carry sourced facts (ratings, rack rates,
 * photographs) the database does not.
 *
 * WHAT A DATABASE PROPERTY DOES NOT HAVE, and how it is shown rather than
 * invented: no star class, no rating, no sourced rack rate beyond its own room
 * prices, no curated amenities or highlights. Each is null or empty, which the
 * components already render as "not stated".
 *
 * Revalidated every minute and bounded by a timeout. An API that is down makes
 * discovery show the catalogue alone, never an error page.
 */

const REVALIDATE_SECONDS = 60;
const TIMEOUT_MS = 6_000;

async function readApi<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Published database properties the catalogue does not already describe, as Explore cards. */
export async function databaseListings(): Promise<Listing[]> {
  const cards = (await readApi<PropertyCard[]>("/api/v1/properties")) ?? [];
  return cards
    .filter((card) => !findCatalogueProperty(card.slug))
    .map((card) => listingFor(cardToProperty(card)));
}

/** One published database property, as the property page renders it. Null when there is none. */
export async function databaseProperty(slug: string): Promise<PropertyDetail | null> {
  const detail = await readApi<ApiPropertyDetail>(
    `/api/v1/properties/slug/${encodeURIComponent(slug)}`,
  );
  if (!detail?.slug) return null;
  const sellable = detail.roomTypes.filter(
    (room) => room.domain === "hospitality" && room.nightlyRateRwf !== null,
  );
  return cardToProperty({
    id: detail.id,
    slug: detail.slug,
    name: detail.name,
    description: detail.description,
    districtName: detail.districtName,
    photos: detail.photos,
    fromNightlyRateRwf: sellable.length > 0 ? Math.min(...sellable.map((r) => r.nightlyRateRwf!)) : null,
    maxGuests: Math.max(0, ...detail.roomTypes.map((r) => r.capacity ?? 0)) || null,
    roomTypeCount: detail.roomTypes.length,
  });
}

/** The page's lookup: the catalogue first, then the database. */
export async function findDiscoverableProperty(slug: string): Promise<PropertyDetail | null> {
  return findCatalogueProperty(slug) ?? (await databaseProperty(slug));
}

/** The three Kigali districts all file under the city, as the catalogue files them. */
const KIGALI_DISTRICTS = new Set(["gasabo", "kicukiro", "nyarugenge", "kigali"]);

function districtSlug(name: string | null): DistrictSlug {
  const key = (name ?? "").trim().toLowerCase();
  if (KIGALI_DISTRICTS.has(key)) return "kigali";
  const match = DISTRICT_SLUGS.find((slug) => slug === key);
  // A district the rail has no filter for yet files under Kigali, the only
  // default that can be wrong without hiding the property: its page and card
  // still print the real district name.
  return match ?? "kigali";
}

/** The class a business trades as, read from its name where it says; `other` where it does not. */
function kindOf(name: string): AccommodationClass {
  if (/guest\s*house/i.test(name)) return "guest_house";
  if (/lodge/i.test(name)) return "lodge";
  if (/apartment/i.test(name)) return "apartment";
  if (/villa/i.test(name)) return "villa";
  if (/motel/i.test(name)) return "motel";
  if (/hotel/i.test(name)) return "hotel";
  if (/camp/i.test(name)) return "tented_camp";
  return "other";
}

function imagesFor(card: PropertyCard): GalleryImage[] {
  const photos = card.photos.map((src, index) => ({
    // A stem only keys the React list and the gallery's anchors; `src` is what renders.
    stem: `${card.slug}-${index + 1}`,
    src,
    alt: `${card.name}, photo ${index + 1}`,
  }));
  return photos.length > 0
    ? photos
    : // Scenery, labelled as such, until the property uploads its own.
      [{ stem: "kigali-hills-view-01", alt: `${card.name} has not added photos yet` }];
}

function cardToProperty(card: PropertyCard): PropertyDetail {
  const images = imagesFor(card);
  const district = card.districtName ?? "Rwanda";
  const [lead, ...rest] = card.name.split(" ");
  const rate = card.fromNightlyRateRwf;
  const guests = card.maxGuests ?? 2;
  const about = (card.description ?? "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return {
    slug: card.slug,
    name: card.name,
    location: district,
    district: districtSlug(card.districtName),
    kind: kindOf(card.name),
    propertyType: `${card.name.match(/guest\s*house|lodge|hotel|apartment|villa/i)?.[0] ?? "Stay"} in ${district}`,
    starClass: null,
    rooms: null,
    bedrooms: 1,
    maxGuests: guests,
    capacity: [
      `${card.roomTypeCount} room type${card.roomTypeCount === 1 ? "" : "s"}`,
      `Sleeps up to ${guests}`,
    ],
    heroImage: images[0]!,
    gallery: images,
    photoCount: card.photos.length,
    price: { fromUsd: null, fromRwf: rate, basis: "per room, per night", includes: "Room only" },
    nightlyRateRwf: rate,
    rating: null,
    operator: null,
    cardName: { lead: lead ?? card.name, rest: rest.length > 0 ? ` ${rest.join(" ")}` : "" },
    summary: about[0] ?? `${card.name} in ${district}.`,
    cardImage: images[0]!,
    about: about.length > 0 ? about : [`${card.name} is on Injishi. Choose your dates to see what is available.`],
    highlights: [],
    specs: [
      { label: "District", value: district },
      { label: "Room types", value: String(card.roomTypeCount) },
      { label: "From", value: rate === null ? "Rate on request" : `${formatPrice(rate)} a night` },
    ],
    amenities: [],
    place: { addressLines: [card.name, district], latitude: null, longitude: null, blurb: "" },
    thingsToKnow: [],
    // A database record, not a sourced directory entry.
    sources: [],
  };
}
