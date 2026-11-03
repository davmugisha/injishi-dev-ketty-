// Api mode: the API's answers as the screens' view models (`types.ts`): Explore, its place suggestions
// and a property's page, the account's trips, and the signed in account itself. The phone never
// computes a price: it words the figure and the basis the API returned (cross child contract "Money
// display"). What the API does not carry yet (dates, a quote, reviews, saved stays, a trip's photo,
// rewards) is left out, never filled in.

import type {
  ExploreCard,
  ExplorePage,
  ExplorePlaces,
  ExploreSearchResult,
  GuestTrip,
  MyTrips,
} from "@injishi/contracts";
import type { IconName } from "@/components/ui";
import type { Account } from "@/lib/auth";
import { rwf } from "@/lib/money";
import { countdownWords, rangeWords, shortRange } from "./dates";
import type { ExploreIntent } from "./intent";
import { photoSource } from "./photo";
import type {
  ExploreData,
  MeData,
  PastTrip,
  PlaceSuggestion,
  StayCard,
  StayDetail,
  StayRoom,
  TripsData,
  UpcomingTrip,
} from "./types";
import { BOOKING_STATUS_WORDS, basisWords, bookingWords } from "./words";

/** Each lead amenity's glyph; any other draws a tick. */
const FACT_ICON: Readonly<Record<string, IconName>> = {
  view: "Sun",
  breakfast: "Cup",
  pool: "Droplet",
  momo: "Smartphone",
  shuttle: "Car",
  restaurant: "Cup",
  parking: "Car",
  front24: "Clock",
  wifi: "AntennaSignal",
};

/** Where pins may sit on the map, in percent: clear of the search bar above and the card below. */
const PIN_BOX = { left: 14, right: 86, top: 24, bottom: 68 } as const;

type Pin = { x: number; y: number };

/** The cards' places, spread over the map's box by their latitude and longitude. */
function pinsFor(cards: readonly ExploreCard[]): Map<string, Pin> {
  const placed = cards.filter((c) => c.latitude !== null && c.longitude !== null);
  const pins = new Map<string, Pin>();
  if (placed.length === 0) return pins;
  const lats = placed.map((c) => c.latitude ?? 0);
  const lons = placed.map((c) => c.longitude ?? 0);
  const [minLat, maxLat, minLon, maxLon] = [Math.min(...lats), Math.max(...lats), Math.min(...lons), Math.max(...lons)];
  const across = PIN_BOX.right - PIN_BOX.left;
  const down = PIN_BOX.bottom - PIN_BOX.top;
  for (const c of placed) {
    const x = maxLon > minLon ? ((c.longitude ?? 0) - minLon) / (maxLon - minLon) : 0.5;
    const y = maxLat > minLat ? (maxLat - (c.latitude ?? 0)) / (maxLat - minLat) : 0.5;
    pins.set(c.id, { x: PIN_BOX.left + x * across, y: PIN_BOX.top + y * down });
  }
  return pins;
}

function whereWords(card: ExploreCard): string {
  return card.where ? `${card.where} · ${card.typeLabel}` : card.typeLabel;
}

export function toStayCard(card: ExploreCard, pin: Pin | null): StayCard {
  const booking = bookingWords(card.bookingMode, card.approvalWindowHours);
  return {
    slug: card.slug,
    name: card.name,
    where: whereWords(card),
    type: card.type,
    tags: [],
    rating: card.reviewCount > 0 ? card.rating : null,
    reviewCount: card.reviewCount,
    priceRwf: card.priceRwf,
    priceNote: basisWords(card.priceBasis),
    photos: card.photos.map((p) => photoSource(p, "thumb")),
    booking: booking ? { instant: card.bookingMode === "instant_book", label: booking } : null,
    scarcity: card.roomsLeft ? `${card.roomsLeft} left` : null,
    saved: false,
    pin,
    near: card.where || card.typeLabel,
  };
}

/** A search's first page. The pill says what was searched; dates and guests join in milestone 3. */
export function toExploreData(result: ExploreSearchResult, intent: ExploreIntent): ExploreData {
  const pins = pinsFor(result.results);
  const stays = result.results.map((card) => toStayCard(card, pins.get(card.id) ?? null));
  return {
    search: {
      title: intent.placeLabel ?? (intent.q.trim() || "Anywhere in Rwanda"),
      subtitle: intent.mode === "homes" ? "Homes to rent" : "Add dates and guests",
    },
    total: result.total,
    stays,
    focus: stays.find((s) => s.pin)?.slug ?? null,
    next: result.nextCursor,
  };
}

/**
 * A later page's stays, for the list. No pins: the map spreads the first page's places over its box,
 * and a later page's would sit on another scale.
 */
export function toMoreStays(result: ExploreSearchResult): StayCard[] {
  return result.results.map((card) => toStayCard(card, null));
}

/** The suggestions as the API ranked them, at most eight. */
export function toPlaceSuggestions(result: ExplorePlaces): PlaceSuggestion[] {
  return result.places.map((p) => ({ key: `${p.kind}:${p.id}`, kind: p.kind, label: p.label, sub: p.sub, ref: p.ref }));
}

/** Booked stays still to come or under way: the API's stage, the countdown from today in Kigali. */
function upcomingOf(trip: GuestTrip, today: string): UpcomingTrip {
  return {
    reference: trip.reference,
    slug: trip.propertySlug,
    hotel: trip.propertyName,
    line: `${rangeWords(trip.checkIn, trip.checkOut)} · ${trip.reference}`,
    photo: null,
    countdown: trip.stage === "in_progress" ? "Staying now" : countdownWords(today, trip.checkIn),
    confirmed: trip.status === "confirmed",
    checkIn: null,
  };
}

/** "Rubavu · 9–10 May 2026", and how it ended when the stay did not happen ("· Cancelled"). */
function pastOf(trip: GuestTrip): PastTrip {
  const ended =
    trip.status === "confirmed" || trip.status === "pending_approval" ? null : BOOKING_STATUS_WORDS[trip.status];
  return {
    reference: trip.reference,
    slug: trip.propertySlug,
    hotel: trip.propertyName,
    detail: [trip.districtName, `${shortRange(trip.checkIn, trip.checkOut)} ${trip.checkOut.slice(0, 4)}`, ended]
      .filter(Boolean)
      .join(" · "),
    photo: null,
    reviewed: false,
  };
}

/**
 * `GET /me/trips` as Trips groups it: what is coming, soonest first, then what is over or cancelled,
 * newest first as the API sends it. The stage is the API's answer (in the property's day), not the
 * phone's.
 */
export function toTripsData(mine: MyTrips, today: string): TripsData {
  return {
    upcoming: mine.trips
      .filter((t) => t.stage === "upcoming" || t.stage === "in_progress")
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
      .map((t) => upcomingOf(t, today)),
    past: mine.trips.filter((t) => t.stage === "past" || t.stage === "cancelled").map(pastOf),
  };
}

/** Me for the signed in account: its name and email, and Sign out. Nothing else has a read yet. */
export function toMeData(account: Pick<Account, "name" | "email">): MeData {
  return {
    name: account.name,
    since: null,
    email: account.email,
    rewards: null,
    saved: null,
    payment: null,
    savedId: null,
    reach: null,
    signOut: true,
  };
}

/**
 * A property's rooms or homes. Each stay room is priced on its own basis (D-j): a room priced per room
 * reads "a night", one priced per person "a person, a night"; a room with no basis has no price yet
 * and reads "Price on request".
 */
function roomsOf(page: ExplorePage): StayRoom[] {
  if (page.card.mode === "stays") {
    return (page.rooms ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      detail: [
        r.sleeps ? `Sleeps ${r.sleeps}` : null,
        r.minStay && r.minStay > 1 ? `${r.minStay} nights minimum` : null,
        bookingWords(r.bookingMode, r.approvalWindowHours),
      ]
        .filter(Boolean)
        .join(" · "),
      priceRwf: r.priceBasis === null ? null : r.priceRwf,
      priceNote: r.priceBasis === null ? "" : basisWords(r.priceBasis),
      left: r.freeUnits !== null && r.freeUnits <= 4 ? r.freeUnits : null,
      photo: null,
    }));
  }
  return (page.units ?? []).map((u) => ({
    id: u.id,
    name: u.label,
    detail: [
      u.bedrooms !== null ? `${u.bedrooms} ${u.bedrooms === 1 ? "bedroom" : "bedrooms"}` : null,
      u.sizeSqm ? `${u.sizeSqm} m²` : null,
      u.furnished ? "Furnished" : "Unfurnished",
    ]
      .filter(Boolean)
      .join(" · "),
    priceRwf: u.rentRwf,
    priceNote: "a month",
    left: null,
    photo: u.photos[0] ? photoSource(u.photos[0], "thumb") : null,
  }));
}

/** A property's page from real data only: no invented review, quote or saved state. */
export function toStayDetail(page: ExplorePage): StayDetail {
  const { card } = page;
  const stays = card.mode === "stays";
  const rooms = roomsOf(page);
  const count = stays ? page.roomCount : rooms.length;
  const noun = stays ? (count === 1 ? "room" : "rooms") : count === 1 ? "home" : "homes";
  return {
    slug: card.slug,
    name: card.name,
    eyebrow: [page.business.verified ? "Verified business" : null, card.typeLabel, count > 0 ? `${count} ${noun}` : null]
      .filter(Boolean)
      .join(" · "),
    verified: page.business.verified,
    rating: card.reviewCount > 0 ? card.rating : null,
    reviewCount: card.reviewCount,
    where: card.where,
    photos: page.photos.map((p) => ({ source: photoSource(p, "medium"), caption: p.caption })),
    facts: page.facts.map((f) => ({ icon: FACT_ICON[f.code] ?? "CircleCheck", title: f.label, detail: null })),
    roomsTitle: stays ? "Rooms" : "Homes to rent",
    rooms,
    roomId: rooms[0]?.id ?? null,
    review: null,
    about: page.description,
    saved: false,
    shareUrl: page.shareUrl,
    dock: {
      price: card.priceRwf === null ? "Price on request" : rwf(card.priceRwf),
      note: stays ? `From, ${basisWords(card.priceBasis)}` : basisWords(card.priceBasis),
    },
  };
}
