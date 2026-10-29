import { PropertyCard, type AccommodationClass } from "@injishi/contracts";
import { formatPrice } from "@injishi/utils";
import { byNightlyRate, listingFor, type Listing } from "@/data/listings";
import type { GalleryImage, PropertyDetail } from "@/data/properties";
import { DISTRICT_SLUGS, type DistrictSlug } from "@/data/search-options";
import { API_URL } from "@/lib/api";

/**
 * DISCOVERY FROM THE DATABASE (booking audit, 2026-09-13).
 *
 * The one source of the stays a guest can find. This module reads the API's
 * published properties ON THE SERVER and turns each one into the shape the
 * cards and filters use. A catalogue of fifty-two fictional stays kept in this
 * app used to be listed beside them; it was removed on 2026-10-08, so
 * everything Explore, search and the home page show is in the database. The
 * property PAGE does not come through here: `lib/property-route.ts` resolves it
 * (ADR-053) and renders it from its own fields.
 *
 * WHAT A DATABASE PROPERTY DOES NOT HAVE, and how it is shown rather than
 * invented: no star class, no rating, no rack rate beyond its own room prices,
 * no curated amenities or highlights, and no photograph until one is uploaded.
 * Each is null or empty, which the components render as "not stated".
 *
 * Revalidated every minute and bounded by a timeout. An API that is down makes
 * discovery list nothing, never an error page. So does an answer
 * that does not match the contract: it is PARSED against `PropertyCard`, not
 * cast, because a card built from a drifted body prints a price it cannot back.
 */

const REVALIDATE_SECONDS = 60;
const TIMEOUT_MS = 6_000;

async function readApi<T>(
  schema: { safeParse(input: unknown): { success: true; data: T } | { success: false } },
  path: string,
): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const parsed = schema.safeParse(await res.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

const PropertyCards = PropertyCard.array();

/** Every published database property, as cards, cheapest first. */
export async function databaseListings(): Promise<Listing[]> {
  const cards = (await readApi(PropertyCards, "/api/v1/properties")) ?? [];
  return cards.map((card) => listingFor(cardToProperty(card))).sort(byNightlyRate);
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

/** The property's own photographs, and none in their place when it has uploaded none. */
function imagesFor(card: PropertyCard): GalleryImage[] {
  return card.photos.map((src, index) => ({
    // A stem only keys the React list and the gallery's anchors; `src` is what renders.
    stem: `${card.slug}-${index + 1}`,
    src,
    alt: `${card.name}, photo ${index + 1}`,
  }));
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
    // Unknown: `PropertyCard` carries no bedroom count. This was a literal 1, so
    // every card on the site said "1 bedroom", hotels included, and the
    // Explore rail offered a bedrooms filter every stay matched.
    bedrooms: null,
    maxGuests: guests,
    capacity: [
      `${card.roomTypeCount} room type${card.roomTypeCount === 1 ? "" : "s"}`,
      `Sleeps up to ${guests}`,
    ],
    heroImage: images[0] ?? null,
    gallery: images,
    photoCount: card.photos.length,
    // Per person: every Injishi booking is charged rate × guests × nights
    // (owner decision 2026-09-15, `computeBreakdown`). This said "per room",
    // so a couple read half of what checkout then charged them.
    // A villa or apartment is let whole (per night); a bar or coffee shop lists
    // menu prices and is not booked (each).
    price: {
      fromUsd: null,
      fromRwf: rate,
      basis:
        card.fromPriceBasis === "per_unit"
          ? "per night"
          : card.fromPriceBasis === "per_item"
            ? "each"
            : "per person, per night",
      includes: card.fromPriceBasis === "per_item" ? "Menu" : card.fromPriceBasis === "per_unit" ? "Whole place" : "Room only",
    },
    nightlyRateRwf: rate,
    rating: null,
    operator: null,
    // No leading space on `rest`: the cards add the gap themselves, and search
    // joins lead and rest with one. A space here
    // doubled it, so "Kivu Crest" never matched a database property.
    cardName: { lead: lead ?? card.name, rest: rest.join(" ") },
    summary: about[0] ?? `${card.name} in ${district}.`,
    cardImage: images[0] ?? null,
    about: about.length > 0 ? about : [`${card.name} is on Injishi. Choose your dates to see what is available.`],
    highlights: [],
    specs: [
      { label: "District", value: district },
      { label: "Room types", value: String(card.roomTypeCount) },
      { label: "From", value: rate === null ? "Rate on request" : `${formatPrice(rate)} a night` },
    ],
    amenities: [],
    place: { addressLines: [card.name, district], latitude: card.latitude, longitude: card.longitude, blurb: "" },
    thingsToKnow: [],
    // A database record, not a sourced directory entry.
    sources: [],
  };
}
