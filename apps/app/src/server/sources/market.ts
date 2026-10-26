/**
 * Live sources for the market area: the marketplace (explore, property page, rooms, checkout) and the
 * guest's web account (profile, trips, saved lists, consent), read from server/api and presented as the
 * market fixture document types.
 *
 * Public reads (`/marketplace/*`) need no session. Everything about a person (`/me/*`) is read only when
 * someone is signed in; a public page with nobody signed in gets no account data at all (an empty list),
 * never a stand-in person.
 *
 * A property page opens on a default stay (two adults, checking in eleven days from today for two nights: the
 * prototype's 23 to 25 October seen from its 12 October) that the visitor then changes. What they choose there
 * (room, dates, party, plan) is carried to the checkout as a stay key (`stayKey`), and the checkout prices
 * exactly that stay through `/marketplace/quote`, which uses the booking service's own arithmetic, so the total
 * on screen is the total the charge takes. With no stay chosen, the checkout shows the default stay.
 */
import type {
  GuestConsent,
  GuestProfile,
  MarketCheckout,
  MarketListing,
  MarketProperty,
  MarketRoom,
  MarketTone,
  PastTrip,
  SavedCollection,
  SavedPlace,
  TripFact,
  UpcomingTrip,
} from "@injishi/data/fixtures/market";
import { type StockKey, stock } from "@injishi/data/media";
import { clock, dayMonth, dayMonthYear, rwf } from "../format";
import { defineSources, type KigaliDay, type SourceContext } from "./types";

// ── API shapes (as @injishi/contracts marketplace.ts, booking.ts and trips.ts define them) ────────────────

type BookingModeApi = "instant_book" | "request_to_book";

interface ListingCardApi {
  id: string;
  slug: string;
  name: string;
  domain: "hospitality" | "residence";
  kind: string;
  where: string;
  districtName: string | null;
  legalName: string;
  priceRwf: number | null;
  rating: number | null;
  reviewCount: number;
  bookingMode: BookingModeApi | null;
  approvalWindowHours: number | null;
  stockPhoto: string;
  caption: string;
  amenities: string[];
  latitude: number | null;
  longitude: number | null;
  bedrooms: number | null;
  floorAreaSqm: number | null;
  availableFrom: string | null;
  hasPage: boolean;
}

interface RoomCardApi {
  id: string;
  propertySlug: string;
  name: string;
  priceRwf: number | null;
  bed: string;
  sizeSqm: number | null;
  highlight: string;
  sleeps: number | null;
  roomCount: number;
  bookingMode: BookingModeApi | null;
  approvalWindowHours: number | null;
  cancellationTier: string | null;
  nonrefundableEligible: boolean;
  maxAdults: number | null;
  maxChildren: number | null;
  stockPhoto: string;
}

interface PropertyPageApi {
  card: ListingCardApi;
  description: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  houseRules: string | null;
  houseRuleItems: { label: string; value: string }[];
  highlights: { icon: string; title: string; desc: string }[];
  nearby: { place: string; distance: string }[];
  mapLabel: string | null;
  gallery: { photo: string; caption: string }[];
  facilities: { code: string; label: string }[];
  roomCount: number;
  nonRefundableDiscount: number;
  business: {
    legalName: string;
    tin: string | null;
    upi: string | null;
    verifiedAt: string | null;
    licenceValidTo: string | null;
    otherProperties: string[];
  };
  rooms: RoomCardApi[];
}

interface QuoteApi {
  roomTypeId: string;
  roomName: string;
  propertySlug: string | null;
  legalName: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  breakdown: { nights: number; accommodationRwf: number; serviceFeeRwf: number; grossRwf: number };
  bookingMode: BookingModeApi | null;
  approvalWindowHours: number | null;
  cancellationTier: string;
  refunds: { percent: number; until: string | null }[];
  vatRatePercent: number;
  checkInTime: string | null;
  checkOutTime: string | null;
}

interface SavedPlaceApi {
  propertyId: string;
  slug: string | null;
  name: string;
  where: string;
  domain: "hospitality" | "residence";
  kind: string | null;
  stockPhoto: string | null;
  priceRwf: number | null;
  savedPriceRwf: number | null;
  available: boolean;
  bookingMode: BookingModeApi | null;
  availableFrom: string | null;
  savedAt: string;
}

export interface CollectionApi {
  id: string;
  name: string;
  visibility: "private" | "shared";
  isDefault: boolean;
  createdAt: string;
  items: SavedPlaceApi[];
}

interface ConsentsApi {
  policyVersion: string;
  consents: { purpose: string; granted: boolean; required: boolean; recordedAt: string | null }[];
}

interface GuestContactApi {
  name: string;
  email: string;
  phone: string | null;
  country: string;
  countryName: string;
  locale: string;
  address: string | null;
  joinedAt: string;
  signInMethods: string[];
}

interface GuestTripApi {
  id: string;
  reference: string;
  status: "pending_approval" | "confirmed" | "declined" | "cancelled" | "no_show";
  paymentStatus: "captured" | "refunded_full" | "refunded_partial" | "forfeited" | "paid_out" | null;
  stage: "upcoming" | "in_progress" | "past" | "cancelled";
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  propertyName: string;
  propertySlug: string | null;
  roomTypeName: string;
  grossRwf: number | null;
  bookedAt: string;
}

interface TripFactsApi {
  reference: string;
  legalName: string;
  stockPhoto: string | null;
  approvalExpiresAt: string | null;
  payment: {
    instrumentKind: "mobile_money" | "card" | null;
    network: "mtn_momo" | "airtel_money" | null;
    payerMasked: string | null;
    providerRef: string | null;
    amountRwf: number | null;
    settledAt: string | null;
  } | null;
  refundRwf: number | null;
  cancelledAt: string | null;
  preArrivalSubmittedAt: string | null;
}

// ── Shared helpers ────────────────────────────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** How far ahead a booking may be made (`MAX_HORIZON_DAYS` in @injishi/contracts). */
const HORIZON_DAYS = 540;
/** How far ahead the room calendar marks sold-out nights (`MAX_NIGHTS`, the longest stay). */
const CALENDAR_DAYS = 90;
const FALLBACK_PHOTO: StockKey = "lakeKivuShoreline";

/** A stock picture key the interface can draw, or a neutral one. */
export function photoKey(key: string | null | undefined, fallback: StockKey = FALLBACK_PHOTO): StockKey {
  return key && key in stock ? (key as StockKey) : fallback;
}

/** An ISO date `days` from a Kigali day. */
export function addDays(day: KigaliDay, days: number): string {
  return new Date(day.noon.getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

/** "Fri 23 Oct" for an ISO date. */
function weekdayDay(iso: string): string {
  return `${WEEKDAYS[new Date(`${iso}T12:00:00Z`).getUTCDay()]} ${dayMonth(iso)}`;
}

/** "Fri 23 – Sun 25 Oct" (or across months, "Fri 30 Oct – Sun 1 Nov"). */
export function stayRange(checkIn: string, checkOut: string): string {
  const sameMonth = checkIn.slice(0, 7) === checkOut.slice(0, 7);
  const first = sameMonth
    ? `${WEEKDAYS[new Date(`${checkIn}T12:00:00Z`).getUTCDay()]} ${Number(checkIn.slice(8, 10))}`
    : weekdayDay(checkIn);
  return `${first} – ${weekdayDay(checkOut)}`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const nightsBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / DAY_MS);

/** The stay a visitor looks at before they pick dates (see the file comment). */
function defaultStay(ctx: SourceContext) {
  return { checkIn: addDays(ctx.today, 11), checkOut: addDays(ctx.today, 13), adults: 2, children: 0 };
}

/** The stay a visitor chose on a property page: the room, the nights, the party and the rate plan. */
interface StayChoice {
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  /** The Non-refundable plan. The booking service grants it only on a room eligible for it. */
  nonRefundable: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The checkout document id of a chosen stay ("stay:<room>:<in>:<out>:<adults>:<children>:<flex|saver>"). */
export function stayKey(c: StayChoice): string {
  return ["stay", c.roomTypeId, c.checkIn, c.checkOut, c.adults, c.children, c.nonRefundable ? "saver" : "flex"].join(
    ":",
  );
}

/** A stay key read back, or null when it is not one (a malformed address never reaches the API). */
export function parseStayKey(key: string): StayChoice | null {
  const parts = key.split(":");
  if (parts.length !== 7) return null;
  const [tag, roomTypeId, checkIn, checkOut, adults, children, plan] = parts as [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  if (tag !== "stay" || !UUID.test(roomTypeId)) return null;
  if (!ISO_DAY.test(checkIn) || !ISO_DAY.test(checkOut) || !(checkOut > checkIn)) return null;
  const a = Number(adults);
  const c = Number(children);
  if (!Number.isInteger(a) || a < 1 || a > 50 || !Number.isInteger(c) || c < 0 || a + c > 50) return null;
  if (plan !== "flex" && plan !== "saver") return null;
  return { roomTypeId, checkIn, checkOut, adults: a, children: c, nonRefundable: plan === "saver" };
}

const KIND_LABEL: Record<string, string> = {
  hotel: "Hotel",
  lodge: "Lodge",
  tented: "Tented camp",
  guest: "Guest house",
  apartment: "Apartment",
  villa: "Villa",
  house: "House",
  studio: "Studio",
};

/** Platform amenity codes → the explore filter's ids, where they differ. */
const FILTER_ID: Record<string, string> = { view: "lake", shuttle: "transfer", guard: "security" };

/** Icons for the amenities a property page lists. */
const AMENITY_ICON: Record<string, string> = {
  wifi: "Signal",
  restaurant: "Cup",
  breakfast: "Cup",
  parking: "Car",
  laundry: "TShirt",
  front24: "Clock",
  shuttle: "Route",
  view: "Sun",
  pool: "Droplet",
  garden: "Sun",
  guard: "ShieldCheck",
  ac: "Snowflake",
  tv: "Display",
};

// ── Reads ─────────────────────────────────────────────────────────────────────────────────────────────

export async function catalogue(ctx: SourceContext): Promise<ListingCardApi[]> {
  return (await ctx.api.get<{ listings: ListingCardApi[] }>("/api/v1/marketplace/listings")).listings;
}

async function roomCards(ctx: SourceContext): Promise<RoomCardApi[]> {
  return (await ctx.api.get<{ rooms: RoomCardApi[] }>("/api/v1/marketplace/rooms")).rooms;
}

async function page(ctx: SourceContext, slug: string): Promise<PropertyPageApi | undefined> {
  try {
    return await ctx.api.get<PropertyPageApi>(`/api/v1/marketplace/properties/${encodeURIComponent(slug)}`);
  } catch (error) {
    if ((error as { notFound?: boolean }).notFound) return undefined;
    throw error;
  }
}

export async function quote(
  ctx: SourceContext,
  roomTypeId: string,
  stay: { checkIn: string; checkOut: string; guests: number },
): Promise<QuoteApi> {
  return ctx.api.get<QuoteApi>("/api/v1/marketplace/quote", { query: { roomTypeId, ...stay } });
}

/** The signed-in person's lists, or none for an anonymous visitor. */
export async function myCollections(ctx: SourceContext): Promise<CollectionApi[]> {
  if (!ctx.account) return [];
  return (await ctx.api.get<{ collections: CollectionApi[] }>("/api/v1/me/collections")).collections;
}

async function contact(ctx: SourceContext): Promise<GuestContactApi | null> {
  if (!ctx.account) return null;
  return ctx.api.get<GuestContactApi>("/api/v1/me/guest-contact");
}

async function trips(ctx: SourceContext): Promise<{ trip: GuestTripApi; facts: TripFactsApi | undefined }[]> {
  if (!ctx.account) return [];
  const [mine, facts] = await Promise.all([
    ctx.api.get<{ trips: GuestTripApi[] }>("/api/v1/me/trips"),
    ctx.api.get<{ trips: TripFactsApi[] }>("/api/v1/me/trip-facts"),
  ]);
  const byRef = new Map(facts.trips.map((f) => [f.reference, f]));
  return mine.trips.map((trip) => ({ trip, facts: byRef.get(trip.reference) }));
}

/** Free units per night of one room type, over [from, to). */
async function nightsFree(ctx: SourceContext, roomTypeId: string, from: string, to: string) {
  const { nights } = await ctx.api.get<{ nights: { night: string; freeUnits: number }[] }>(
    `/api/v1/room-types/${encodeURIComponent(roomTypeId)}/availability`,
    { query: { from, to } },
  );
  return nights;
}

// ── Presenters ────────────────────────────────────────────────────────────────────────────────────────

/** Map pins: each mode's places spread over the map box by their real coordinates. */
function pins(cards: ListingCardApi[]): Map<string, { x: number; y: number }> {
  const out = new Map<string, { x: number; y: number }>();
  for (const domain of ["hospitality", "residence"] as const) {
    const group = cards.filter((c) => c.domain === domain);
    const placed = group.filter((c) => c.latitude !== null && c.longitude !== null);
    const lats = placed.map((c) => c.latitude as number);
    const lngs = placed.map((c) => c.longitude as number);
    const [minLat, maxLat, minLng, maxLng] = [
      Math.min(...lats),
      Math.max(...lats),
      Math.min(...lngs),
      Math.max(...lngs),
    ];
    const scale = (v: number, lo: number, hi: number) => (hi > lo ? (v - lo) / (hi - lo) : 0.5);
    group.forEach((c, i) => {
      if (c.latitude === null || c.longitude === null) {
        out.set(c.id, { x: 20 + ((i * 17) % 60), y: 20 + ((i * 29) % 60) });
        return;
      }
      // North is up: a higher latitude is nearer the top of the box.
      out.set(c.id, {
        x: Math.round(14 + 72 * scale(c.longitude, minLng, maxLng)),
        y: Math.round(14 + 72 * (1 - scale(c.latitude, minLat, maxLat))),
      });
    });
  }
  return out;
}

function homesSize(c: Pick<ListingCardApi, "kind" | "bedrooms" | "floorAreaSqm">): string {
  const rooms = c.kind === "studio" || c.bedrooms === null ? "Studio" : plural(c.bedrooms, "bedroom", "bedrooms");
  return [rooms, c.floorAreaSqm ? `${c.floorAreaSqm} m²` : null].filter(Boolean).join(" · ");
}

function homesAvailable(availableFrom: string | null, today: KigaliDay): string {
  return availableFrom && availableFrom > today.iso ? `From ${dayMonth(availableFrom)}` : "Available now";
}

function toListing(
  c: ListingCardApi,
  rank: number,
  saved: boolean,
  pin: { x: number; y: number },
  today: KigaliDay,
): MarketListing {
  const homes = c.domain === "residence";
  const request = c.bookingMode === "request_to_book";
  return {
    id: c.id,
    mode: homes ? "homes" : "stays",
    name: c.name,
    type: c.kind,
    where: c.where,
    rating: c.rating ?? 0,
    reviews: c.reviewCount,
    price: c.priceRwf ?? 0,
    booking: homes ? null : request ? "request" : "instant",
    replies: !homes && request && c.approvalWindowHours ? `within ${c.approvalWindowHours} h` : null,
    size: homes ? homesSize(c) : null,
    available: homes ? homesAvailable(c.availableFrom, today) : null,
    amenities: c.amenities.map((code) => FILTER_ID[code] ?? code),
    entity: c.legalName,
    caption: c.caption,
    photo: photoKey(c.stockPhoto),
    pin,
    rank,
    saved,
    page: c.hasPage ? c.slug : null,
  };
}

function initials(name: string): string {
  const words = name.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w));
  return ((words[0]?.[0] ?? "") + (words.length > 1 ? (words.at(-1)?.[0] ?? "") : "")).toUpperCase();
}

/** "102 345 678": a TIN read in threes, as it is printed on a receipt. */
function groupDigits(tin: string): string {
  return tin.replace(/\D/g, "").replace(/(\d{3})(?=\d)/g, "$1 ");
}

function toRoom(
  r: RoomCardApi,
  nights: { night: string; freeUnits: number }[],
  stay: { checkIn: string; checkOut: string },
): MarketRoom {
  const request = r.bookingMode === "request_to_book";
  const ofStay = nights.filter((n) => n.night >= stay.checkIn && n.night < stay.checkOut);
  return {
    id: r.id,
    property: r.propertySlug,
    name: r.name,
    price: r.priceRwf ?? 0,
    bed: r.bed,
    size: r.sizeSqm ? `${r.sizeSqm} m²` : "",
    feature: r.highlight,
    sleeps: r.sleeps ?? 2,
    left: ofStay.length ? Math.min(...ofStay.map((n) => n.freeUnits)) : r.roomCount,
    booking: request ? "request" : "instant",
    reply: request && r.approvalWindowHours ? `${r.approvalWindowHours} h` : null,
    soldOut: nights.filter((n) => n.freeUnits === 0).map((n) => n.night),
    photo: photoKey(r.stockPhoto),
  };
}

/** The room a visitor looks at first: the cheapest one confirmed instantly, else the cheapest. */
export function defaultRoom<T extends { bookingMode: BookingModeApi | null; priceRwf: number | null }>(
  rooms: T[],
): T | undefined {
  const byPrice = [...rooms].sort((a, b) => (a.priceRwf ?? Infinity) - (b.priceRwf ?? Infinity));
  return byPrice.find((r) => r.bookingMode === "instant_book") ?? byPrice[0];
}

/**
 * The refund schedule as the checkout draws it: each step, how long it lasts (its bar), and until when. A
 * non-refundable stay has one step: nothing comes back once it is booked.
 */
function refundTiers(q: QuoteApi, now: Date, nonRefundable: boolean): MarketCheckout["cancellation"] {
  if (nonRefundable) {
    return [{ id: "none", label: "No refund", until: "From booking", tone: "danger", weight: 1 }];
  }
  const checkInAt = Date.parse(`${q.checkIn}T${(q.checkInTime ?? "14:00").slice(0, 5)}:00+02:00`);
  let from = now.getTime();
  return q.refunds.map((step) => {
    const end = step.until ? Date.parse(step.until) : checkInAt + DAY_MS;
    const weight = Math.min(12, Math.max(1, Math.round((end - from) / DAY_MS)));
    from = end;
    const label = step.percent === 100 ? "Full refund" : step.percent === 0 ? "No refund" : `${step.percent}% refund`;
    const tone: MarketTone = step.percent === 100 ? "success" : step.percent === 0 ? "danger" : "warning";
    const until = !step.until
      ? "After that"
      : Date.parse(step.until) === checkInAt
        ? "Until check-in"
        : `Until ${weekdayDay(kigaliIso(step.until))}, ${clock(step.until)}`;
    return { id: step.percent === 100 ? "full" : step.percent === 0 ? "none" : "partial", label, until, tone, weight };
  });
}

/** The Kigali calendar day of an instant. */
function kigaliIso(instant: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Kigali",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(instant));
}

function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

/**
 * A checkout as the screen takes it, plus the non-refundable discount of a stay booked on that plan (absent from
 * the prototype's documents, which drew no discount at checkout).
 */
export type CheckoutDocument = MarketCheckout & { nonRefundableDiscountRwf?: number };

/**
 * The guest service fee rate (`GUEST_SERVICE_FEE_RATE` in @injishi/contracts booking.ts; the app does not depend
 * on contracts). `/marketplace/quote` prices only the refundable plan, so a non-refundable stay's preview applies
 * the booking service's arithmetic here; once Pay is pressed the screen shows the amount the API prompts for.
 */
const GUEST_SERVICE_FEE_RATE = 0.05;

interface CheckoutTerms {
  adults: number;
  children: number;
  /** Booked on the Non-refundable plan (asked for AND the room is eligible). */
  nonRefundable: boolean;
  /** Asked for the Non-refundable plan on a room that has none: booked refundable, and said so. */
  saverRefused: boolean;
  /** The plan's discount, a fraction (`nonRefundableDiscount` on the property page). */
  discount: number;
}

/** A checkout draft of one stay in one room: the default stay (see the file comment) or the one the visitor chose. */
function toCheckout(
  id: "instant" | "request",
  q: QuoteApi,
  slug: string,
  who: GuestContactApi | null,
  now: Date,
  terms: CheckoutTerms = { adults: q.guests, children: 0, nonRefundable: false, saverRefused: false, discount: 0 },
): CheckoutDocument {
  const nights = q.breakdown.nights;
  const request = id === "request";
  const full = !terms.nonRefundable && q.refunds[0]?.percent === 100 && q.refunds[0].until ? q.refunds[0].until : null;
  const replyBy =
    request && q.approvalWindowHours ? new Date(now.getTime() + q.approvalWindowHours * 3_600_000).toISOString() : null;
  const accommodation = q.breakdown.accommodationRwf;
  const discountRwf = terms.nonRefundable ? Math.round(accommodation * terms.discount) : 0;
  const serviceFee = terms.nonRefundable
    ? Math.round((accommodation - discountRwf) * GUEST_SERVICE_FEE_RATE)
    : q.breakdown.serviceFeeRwf;
  const plan = terms.nonRefundable ? "Non-refundable" : full ? "Free cancellation" : "Partly refundable";
  const party =
    plural(terms.adults, "adult", "adults") +
    (terms.children ? `, ${plural(terms.children, "child", "children")}` : "");
  return {
    id,
    reference: "",
    property: slug,
    room: q.roomName,
    plan: terms.saverRefused ? `${plan} (this room has no non-refundable rate)` : plan,
    dates: `${stayRange(q.checkIn, q.checkOut)} · ${plural(nights, "night", "nights")}`,
    nights,
    // The party's nightly charge (per-guest rate × guests), the figure the booking locks.
    rate: Math.round(accommodation / nights),
    serviceFee,
    ...(discountRwf ? { nonRefundableDiscountRwf: discountRwf } : {}),
    vatRate: q.vatRatePercent,
    vatStatus: "EBM tax class B",
    guests: party,
    checkIn: { day: weekdayDay(q.checkIn), time: `From ${(q.checkInTime ?? "14:00").slice(0, 5)}` },
    checkOut: { day: weekdayDay(q.checkOut), time: `By ${(q.checkOutTime ?? "11:00").slice(0, 5)}` },
    confirmation: request ? `Host replies within ${q.approvalWindowHours ?? 24} h` : "Instant confirmation",
    replyBy: replyBy ? `${dayMonth(kigaliIso(replyBy))}, ${clock(replyBy)}` : null,
    guest: {
      ...splitName(who?.name ?? ""),
      email: who?.email ?? "",
      mobile: who?.phone ?? "",
      country: who?.country ?? "RW",
    },
    arrival: "",
    requests: [],
    note: "",
    cancellation: refundTiers(q, now, terms.nonRefundable),
    freeCancellation: terms.nonRefundable
      ? "Non-refundable: nothing is refunded if you cancel"
      : full
        ? `Free cancellation until ${weekdayDay(kigaliIso(full))}, ${clock(full)}`
        : "No free cancellation on this room",
    payee: q.legalName,
    payment: { intent: "", heldUntil: "", checks: [] },
  };
}

function toProperty(p: PropertyPageApi, ctx: SourceContext, savedTo: string): MarketProperty {
  const stay = defaultStay(ctx);
  const first = defaultRoom(p.rooms);
  const kind = KIND_LABEL[p.card.kind] ?? "Property";
  const homes = p.card.domain === "residence";
  const maxAdults = Math.max(1, ...p.rooms.map((r) => r.maxAdults ?? r.sleeps ?? 2));
  const maxChildren = Math.max(0, ...p.rooms.map((r) => r.maxChildren ?? Math.max(0, (r.sleeps ?? 2) - 1)));
  const others = p.business.otherProperties;
  return {
    id: p.card.slug,
    listing: p.card.id,
    name: p.card.name,
    area: p.card.districtName ?? "",
    rating: p.card.rating ?? 0,
    reviewCount: p.card.reviewCount,
    location: p.card.where,
    kind: `${kind} · ${plural(p.roomCount, homes ? "unit" : "room", homes ? "units" : "rooms")}`,
    savedTo,
    cover: { photo: photoKey(p.card.stockPhoto), caption: p.card.caption },
    gallery: p.gallery.map((g) => ({ photo: photoKey(g.photo), caption: g.caption })),
    photoCount: p.gallery.length + 1,
    about: p.description ?? "",
    highlights: p.highlights.map((h, i) => ({ id: `h${i + 1}`, icon: h.icon, title: h.title, desc: h.desc })),
    amenities: p.facilities.map((f) => ({ id: f.code, icon: AMENITY_ICON[f.code] ?? "CircleCheck", label: f.label })),
    stay: {
      checkIn: stay.checkIn,
      checkOut: stay.checkOut,
      adults: stay.adults,
      children: stay.children,
      room: first?.id ?? "",
    },
    bookable: { from: ctx.today.iso, to: addDays(ctx.today, HORIZON_DAYS) },
    guests: {
      adults: { min: 1, max: maxAdults, sub: "Age 13+" },
      children: { min: 0, max: maxChildren, sub: "Age 0–12" },
    },
    // Filled from the default room's quote by the caller (it needs the API). Until then nothing is promised:
    // no full-refund step (-1) and no refund.
    cancellation: {
      fullRefundDays: -1,
      cutoff: (p.checkInTime ?? "14:00").slice(0, 5),
      partialRefund: "No refund",
      nonRefundableNote: "Non-refundable rate: no refunds.",
    },
    saverDiscount: p.rooms.some((r) => r.nonrefundableEligible) ? p.nonRefundableDiscount : 0,
    // Packages are the commercial area's offers, with no public read yet: none is offered here.
    package: { label: "", name: "", price: 0, room: "", nights: 0, weekday: -1 },
    houseRules: p.houseRuleItems.length
      ? p.houseRuleItems
      : [
          { label: "Check-in", value: `From ${(p.checkInTime ?? "14:00").slice(0, 5)}` },
          { label: "Check-out", value: `By ${(p.checkOutTime ?? "11:00").slice(0, 5)}` },
          ...(p.houseRules ? [{ label: "House rules", value: p.houseRules }] : []),
        ],
    // Category scores come from guest reviews, which are not served to the marketplace yet.
    scores: [],
    reviewNote:
      "Only guests with a completed stay can review. Guest and hotel reviews of each other stay hidden until both are written or 14 days pass. Moderators remove reviews that break the rules; every decision is logged.",
    map: {
      label: p.mapLabel ?? `Map: ${p.card.name}, ${p.card.where}`,
      distances: p.nearby,
      note: "Exact address after booking.",
    },
    business: {
      initials: initials(p.business.legalName),
      name: p.business.legalName,
      runs: others.length
        ? `Runs this ${kind.toLowerCase()} and ${others.join(", ")}`
        : `Runs this ${kind.toLowerCase()}`,
      // Only what the API holds: "" when it records no verification or no licence, and the page then draws no
      // "Verified" or success chip at all (MarketPropertyView). A licence past its date is expired, never active.
      verified: p.business.verifiedAt ? `Verified ${dayMonthYear(p.business.verifiedAt)}` : "",
      licence: p.business.licenceValidTo
        ? p.business.licenceValidTo.slice(0, 10) < ctx.today.iso
          ? `Expired ${dayMonthYear(p.business.licenceValidTo)}`
          : `Active to ${dayMonthYear(p.business.licenceValidTo)}`
        : "",
      tin: p.business.tin ? groupDigits(p.business.tin) : (p.business.upi ?? ""),
      evidence: p.business.verifiedAt
        ? "Checked against documents, not a live registry"
        : "No verification on file for this business",
    },
  };
}

/** Fill a page's cancellation summary from its default room's quote. */
function withCancellation(property: MarketProperty, q: QuoteApi | undefined, nonRefundable: boolean): MarketProperty {
  if (!q) return property;
  const checkInAt = Date.parse(`${q.checkIn}T${(q.checkInTime ?? "14:00").slice(0, 5)}:00+02:00`);
  const fullUntil = q.refunds[0]?.percent === 100 ? q.refunds[0].until : null;
  const partial = q.refunds.find((s) => s.percent > 0 && s.percent < 100);
  return {
    ...property,
    cancellation: {
      // -1: the policy has no full-refund step, so the page promises no free cancellation at all.
      fullRefundDays: fullUntil ? Math.max(0, Math.round((checkInAt - Date.parse(fullUntil)) / DAY_MS)) : -1,
      cutoff: (q.checkInTime ?? "14:00").slice(0, 5),
      partialRefund: partial ? `${partial.percent}% refund` : "No refund",
      nonRefundableNote: nonRefundable ? "Non-refundable rate: no refunds." : "This room has no non-refundable rate.",
    },
  };
}

const SAVED_NOTE = (
  place: SavedPlaceApi,
  booked: GuestTripApi | undefined,
  today: KigaliDay,
): { note: string; tone: MarketTone } => {
  if (!place.available) return { note: "No longer listed", tone: "default" };
  if (booked?.status === "confirmed") return { note: `Booked for ${dayMonth(booked.checkIn)}`, tone: "success" };
  if (booked?.status === "pending_approval") return { note: "Request pending", tone: "info" };
  if (place.priceRwf !== null && place.savedPriceRwf !== null && place.priceRwf < place.savedPriceRwf) {
    return { note: `Price down ${rwf(place.savedPriceRwf - place.priceRwf)} since saved`, tone: "info" };
  }
  if (place.domain === "residence") {
    const text = homesAvailable(place.availableFrom, today);
    return { note: text, tone: text === "Available now" ? "success" : "default" };
  }
  return { note: `Saved ${dayMonth(place.savedAt)}`, tone: "default" };
};

function toSavedPlace(place: SavedPlaceApi, booked: GuestTripApi | undefined, today: KigaliDay): SavedPlace {
  const unit = place.domain === "residence" ? "a month" : "a night";
  const price =
    place.bookingMode === "request_to_book"
      ? "request to book"
      : place.priceRwf !== null
        ? `${rwf(place.priceRwf)} ${unit}`
        : "price on request";
  const { note, tone } = SAVED_NOTE(place, booked, today);
  return {
    // The slug: the place's own page address. The remove action resolves it back to the property.
    id: place.slug ?? place.propertyId,
    name: place.name,
    line: `${place.where} · ${price}`,
    note,
    tone,
    board: place.available && place.slug ? "MarketProperty" : "MarketExplore",
    photo: photoKey(place.stockPhoto),
  };
}

export async function savedCollections(ctx: SourceContext): Promise<SavedCollection[]> {
  const [lists, mine] = await Promise.all([myCollections(ctx), trips(ctx)]);
  const live = mine
    .map((t) => t.trip)
    .filter((t) => (t.status === "confirmed" || t.status === "pending_approval") && t.stage !== "past");
  return lists.map((c) => ({
    id: c.id,
    name: c.name,
    visibility: c.visibility === "shared" ? "Shared by link" : "Private",
    noun: c.items.length > 0 && c.items.every((p) => p.domain === "residence") ? "homes" : "places",
    photo: photoKey(c.items[0]?.stockPhoto),
    items: c.items.map((p) =>
      toSavedPlace(
        p,
        live.find((t) => t.propertySlug === p.slug),
        ctx.today,
      ),
    ),
  }));
}

/** Payment line for a trip card: "RWF 588,000 · MTN MoMo · mock_escrow_capture_…". */
function paidWith(facts: TripFactsApi | undefined, amount: number | null): string {
  const p = facts?.payment;
  const method =
    p?.network === "mtn_momo"
      ? "MTN MoMo"
      : p?.network === "airtel_money"
        ? "Airtel Money"
        : p?.instrumentKind === "card"
          ? "Card"
          : null;
  return [amount !== null ? rwf(amount) : null, method, p?.providerRef ?? null].filter(Boolean).join(" · ");
}

function upcomingTrip(
  { trip, facts }: { trip: GuestTripApi; facts: TripFactsApi | undefined },
  today: KigaliDay,
): UpcomingTrip {
  const request = trip.status === "pending_approval";
  const booked = request
    ? {
        label: "Booking",
        chip: "Requested",
        tone: "info" as const,
        note: facts?.approvalExpiresAt
          ? `Host decides by ${dayMonth(facts.approvalExpiresAt)}, ${clock(facts.approvalExpiresAt)}`
          : "",
      }
    : {
        label: "Booking",
        chip: "Confirmed",
        tone: "success" as const,
        note: `${dayMonth(trip.bookedAt)}, ${clock(trip.bookedAt)}`,
      };
  // A request's money is captured into escrow when it is sent (F-B06): held, and refunded in full if declined.
  const paid: TripFact = request
    ? {
        label: "Payment",
        chip: "Held",
        tone: "info",
        note: `${paidWith(facts, trip.grossRwf)} · refunded in full if declined`,
      }
    : { label: "Payment", chip: "Paid", tone: "success", note: paidWith(facts, trip.grossRwf) };
  const preArrival: TripFact[] = request
    ? []
    : facts?.preArrivalSubmittedAt
      ? [{ label: "Pre-arrival", chip: "Details sent", tone: "success", note: dayMonth(facts.preArrivalSubmittedAt) }]
      : [{ label: "Pre-arrival", chip: "ID and arrival time needed", tone: "warning", note: "Saves time at the desk" }];
  return {
    id: trip.reference,
    name: trip.propertyName,
    dates: `${stayRange(trip.checkIn, trip.checkOut)} ${trip.checkOut.slice(0, 4)}`,
    room: `${trip.roomTypeName} · ${plural(trip.guests, "guest", "guests")}`,
    ref: `${request ? "Booking request" : "Booking"} ${trip.reference} · ${facts?.legalName ?? ""}`,
    photo: photoKey(facts?.stockPhoto),
    facts: [booked, paid, ...preArrival],
    // Shown once the guest withdraws on this screen. The refund line is the API's answer to that press
    // (`refundRwf` of POST /bookings/:reference/cancel), added by the screen, never worked out here.
    withdrawnFacts: request
      ? [{ label: "Booking", chip: "Withdrawn by you", tone: "default", note: dayMonth(today.iso) }]
      : null,
    links: request
      ? []
      : [
          { label: "Open trip", board: "GuestTrip", primary: true },
          { label: "Pre-arrival check-in", board: "GuestPreArrival", primary: false },
        ],
    withdrawable: request,
  };
}

/** Reviews open for 14 days after check-out (the double-blind window). */
const REVIEW_DAYS = 14;

function pastTrip(
  { trip, facts }: { trip: GuestTripApi; facts: TripFactsApi | undefined },
  today: KigaliDay,
): PastTrip {
  const cancelled = trip.stage === "cancelled";
  const span = `${Number(trip.checkIn.slice(8, 10))}${trip.checkIn.slice(0, 7) === trip.checkOut.slice(0, 7) ? "" : ` ${dayMonth(trip.checkIn).split(" ")[1]}`} – ${dayMonthYear(trip.checkOut)}`;
  const refund = facts?.refundRwf ?? null;
  const p = facts?.payment;
  const money: PastTrip["money"] =
    trip.paymentStatus === "refunded_full" || trip.paymentStatus === "refunded_partial"
      ? {
          chip: `Refunded ${rwf(refund ?? 0)}`,
          tone: "default",
          note: [
            p?.network === "mtn_momo" ? "MTN MoMo" : p?.network === "airtel_money" ? "Airtel Money" : null,
            p?.providerRef,
            facts?.cancelledAt ? dayMonth(facts.cancelledAt) : null,
          ]
            .filter(Boolean)
            .join(" · "),
        }
      : trip.paymentStatus === "forfeited"
        ? { chip: "Not refunded", tone: "warning", note: paidWith(facts, trip.grossRwf) }
        : trip.paymentStatus === null
          ? { chip: "Nothing charged", tone: "default", note: "" }
          : { chip: "Paid", tone: "success", note: paidWith(facts, trip.grossRwf) };
  const left = REVIEW_DAYS - nightsBetween(trip.checkOut, today.iso);
  const reviewOpen = !cancelled && trip.status === "confirmed" && left > 0;
  return {
    id: trip.reference,
    name: trip.propertyName,
    business: facts?.legalName ?? "",
    dates: cancelled ? `Cancelled · was ${span}` : span,
    ref: trip.reference,
    photo: photoKey(facts?.stockPhoto),
    money,
    review: cancelled
      ? { chip: "Not applicable", tone: "default" }
      : reviewOpen
        ? { chip: `Review window · ${plural(left, "day", "days")} left`, tone: "warning" }
        : { chip: "Review window closed", tone: "default" },
    action: cancelled
      ? { label: "Book again", board: "MarketExplore", primary: false }
      : reviewOpen
        ? { label: "Write review", board: "GuestReview", primary: true }
        : { label: "Bill and receipts", board: "GuestFolio", primary: false },
  };
}

/** Consent purposes → the account page's switches. */
const CONSENT_COPY: Record<string, { id: string; label: string; desc: string }> = {
  booking_messages: {
    id: "msg",
    label: "Booking and stay messages",
    desc: "Required to deliver bookings you make · confirmations, arrival details, receipts",
  },
  share_phone_with_hosts: {
    id: "share",
    label: "Share my mobile number with hosts I book",
    desc: "So the property can reach you about arrival",
  },
  review_reminders: { id: "remind", label: "Review reminders", desc: "One reminder after check-out" },
  marketing_offers: { id: "offers", label: "Offers from Injishi", desc: "Email, at most twice a month" },
  personalisation: { id: "recs", label: "Personalised recommendations", desc: "Uses your saved places and past trips" },
};

/** The account page's switch id → the API's purpose. */
export const CONSENT_PURPOSE: Record<string, string> = Object.fromEntries(
  Object.entries(CONSENT_COPY).map(([purpose, c]) => [c.id, purpose]),
);

/** One property page, by slug: the page, where the visitor saved it, and its default room's refund terms. */
async function propertyPage(ctx: SourceContext, slug: string): Promise<MarketProperty | undefined> {
  const [p, lists] = await Promise.all([page(ctx, slug), myCollections(ctx)]);
  if (!p) return undefined;
  const savedTo = lists.find((l) => l.items.some((i) => i.propertyId === p.card.id))?.name ?? "";
  const property = toProperty(p, ctx, savedTo);
  const first = defaultRoom(p.rooms);
  if (!first) return property;
  const stay = defaultStay(ctx);
  const q = await quote(ctx, first.id, { checkIn: stay.checkIn, checkOut: stay.checkOut, guests: stay.adults });
  return withCancellation(property, q, first.nonrefundableEligible);
}

/** The checkout drafts of the featured property's default stay: one confirmed instantly, one by request. */
export async function checkoutDrafts(
  ctx: SourceContext,
): Promise<{ draft: MarketCheckout; roomTypeId: string; quote: QuoteApi }[]> {
  const featured = (await catalogue(ctx)).find((c) => c.hasPage && c.domain === "hospitality");
  if (!featured) return [];
  const [p, who] = await Promise.all([page(ctx, featured.slug), contact(ctx)]);
  if (!p) return [];
  const stay = defaultStay(ctx);
  const rooms: ["instant" | "request", RoomCardApi | undefined][] = [
    ["instant", defaultRoom(p.rooms.filter((r) => r.bookingMode === "instant_book"))],
    ["request", defaultRoom(p.rooms.filter((r) => r.bookingMode === "request_to_book"))],
  ];
  const drafts = await Promise.all(
    rooms.map(async ([id, room]) => {
      if (!room) return null;
      const q = await quote(ctx, room.id, { checkIn: stay.checkIn, checkOut: stay.checkOut, guests: stay.adults });
      return { draft: toCheckout(id, q, featured.slug, who, ctx.now), roomTypeId: room.id, quote: q };
    }),
  );
  return drafts.filter((d) => d !== null);
}

/** What the checkout books for a chosen stay: the draft the page shows, and exactly what `POST /bookings` takes. */
interface ChosenCheckout {
  draft: CheckoutDocument;
  roomTypeId: string;
  quote: QuoteApi;
  nonRefundable: boolean;
}

/**
 * The checkout of the stay a visitor chose on a property page, priced by `/marketplace/quote`. A stay the API will
 * not quote (no such room, too many guests for it, too long) is no checkout at all: undefined.
 */
export async function chosenCheckout(ctx: SourceContext, choice: StayChoice): Promise<ChosenCheckout | undefined> {
  let q: QuoteApi;
  try {
    q = await quote(ctx, choice.roomTypeId, {
      checkIn: choice.checkIn,
      checkOut: choice.checkOut,
      guests: choice.adults + choice.children,
    });
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 400 || status === 404 || status === 409) return undefined;
    throw error;
  }
  if (!q.propertySlug) return undefined;
  const [p, who] = await Promise.all([page(ctx, q.propertySlug), contact(ctx)]);
  const room = p?.rooms.find((r) => r.id === choice.roomTypeId);
  if (!p || !room) return undefined;
  const nonRefundable = choice.nonRefundable && room.nonrefundableEligible;
  const mode = q.bookingMode === "request_to_book" ? "request" : "instant";
  const draft = toCheckout(mode, q, q.propertySlug, who, ctx.now, {
    adults: choice.adults,
    children: choice.children,
    nonRefundable,
    saverRefused: choice.nonRefundable && !nonRefundable,
    discount: p.nonRefundableDiscount,
  });
  return { draft, roomTypeId: q.roomTypeId, quote: q, nonRefundable };
}

// ── Sources ───────────────────────────────────────────────────────────────────────────────────────────

export const sources = defineSources({
  "market.listings": {
    naturalKey: "name",
    async list(ctx): Promise<MarketListing[]> {
      const [cards, lists] = await Promise.all([catalogue(ctx), myCollections(ctx)]);
      const saved = new Set(lists.flatMap((l) => l.items.map((i) => i.propertyId)));
      const where = pins(cards);
      // "Recommended" order: the best reviewed first; with no reviews yet, by name.
      const ranked = (domain: ListingCardApi["domain"]) =>
        cards
          .filter((c) => c.domain === domain)
          .sort(
            (a, b) =>
              (b.rating ?? 0) - (a.rating ?? 0) || b.reviewCount - a.reviewCount || a.name.localeCompare(b.name),
          );
      return (["hospitality", "residence"] as const).flatMap((domain) =>
        ranked(domain).map((c, i) =>
          toListing(c, i + 1, saved.has(c.id), where.get(c.id) ?? { x: 50, y: 50 }, ctx.today),
        ),
      );
    },
  },

  "market.properties": {
    naturalKey: "id",
    async list(ctx): Promise<MarketProperty[]> {
      // A property has a page in the interface when its marketplace card carries the page's own copy.
      const cards = (await catalogue(ctx)).filter((c) => c.hasPage);
      const pages = await Promise.all(cards.map((c) => propertyPage(ctx, c.slug)));
      return pages.filter((p): p is MarketProperty => p !== undefined);
    },
    get: propertyPage,
  },

  "market.rooms": {
    naturalKey: "name",
    async list(ctx): Promise<MarketRoom[]> {
      const rooms = await roomCards(ctx);
      const stay = defaultStay(ctx);
      const to = addDays(ctx.today, CALENDAR_DAYS);
      return Promise.all(rooms.map(async (r) => toRoom(r, await nightsFree(ctx, r.id, ctx.today.iso, to), stay)));
    },
  },

  "market.checkouts": {
    naturalKey: "id",
    async list(ctx): Promise<MarketCheckout[]> {
      return (await checkoutDrafts(ctx)).map((d) => d.draft);
    },
    /** "instant" / "request" (the default stay's drafts), or a chosen stay's key (`stayKey`). */
    async get(ctx, id): Promise<CheckoutDocument | undefined> {
      const choice = parseStayKey(id);
      if (choice) return (await chosenCheckout(ctx, choice))?.draft;
      return (await checkoutDrafts(ctx)).find((d) => d.draft.id === id)?.draft;
    },
  },

  "market.guestProfiles": {
    naturalKey: "name",
    accountParityPersona: "guest",
    async list(ctx): Promise<GuestProfile[]> {
      const who = await contact(ctx);
      if (!who || !ctx.account) return [];
      const since = new Intl.DateTimeFormat("en-GB", {
        month: "long",
        year: "numeric",
        timeZone: "Africa/Kigali",
      }).format(new Date(who.joinedAt));
      return [
        {
          id: ctx.account.user.id,
          name: who.name,
          initials: initials(who.name),
          email: who.email,
          mobile: who.phone ?? "",
          country: who.countryName,
          since: `Guest since ${since}`,
          home: who.address ?? who.countryName,
          signIn: who.signInMethods.includes("google")
            ? "signs in with Google or an email code"
            : "signs in with an email code",
          language: who.locale,
        },
      ];
    },
  },

  "market.upcomingTrips": {
    naturalKey: "name",
    async list(ctx): Promise<UpcomingTrip[]> {
      // Upcoming means not started: a stay in progress belongs to the guest app's stay screen, not this list.
      return (await trips(ctx))
        .filter(({ trip }) => trip.stage === "upcoming")
        .sort((a, b) => a.trip.checkIn.localeCompare(b.trip.checkIn))
        .map((t) => upcomingTrip(t, ctx.today));
    },
  },

  "market.pastTrips": {
    naturalKey: "name",
    async list(ctx): Promise<PastTrip[]> {
      return (await trips(ctx))
        .filter(({ trip }) => trip.stage === "past" || trip.stage === "cancelled")
        .sort((a, b) => b.trip.checkIn.localeCompare(a.trip.checkIn))
        .map((t) => pastTrip(t, ctx.today));
    },
  },

  "market.savedCollections": { naturalKey: "name", list: savedCollections },

  "market.consents": {
    naturalKey: "id",
    async list(ctx): Promise<GuestConsent[]> {
      if (!ctx.account) return [];
      const [mine, who] = await Promise.all([ctx.api.get<ConsentsApi>("/api/v1/me/consents"), contact(ctx)]);
      const joined = who ? Date.parse(who.joinedAt) : 0;
      return mine.consents.flatMap((c) => {
        const copy = CONSENT_COPY[c.purpose];
        if (!copy) return [];
        // A choice made after the account was opened says when it changed.
        const changed = !c.required && c.recordedAt && Date.parse(c.recordedAt) > joined + DAY_MS;
        return [
          {
            id: copy.id,
            label: copy.label,
            desc: changed && c.recordedAt ? `${copy.desc} · changed ${dayMonthYear(c.recordedAt)}` : copy.desc,
            on: c.granted,
            locked: c.required,
          },
        ];
      });
    },
  },
});
