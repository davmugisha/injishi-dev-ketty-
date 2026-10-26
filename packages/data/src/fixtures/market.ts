import type { StockKey } from "../media.ts";
import type { BoardId, FixtureSet, IconName } from "../types.ts";

/**
 * Embedded-database fixtures for the "market" area: the public marketplace (MarketExplore,
 * MarketProperty, MarketCheckout) and the guest's web account (GuestAccount).
 * Collection names are "market.<thing>"; every document has a stable string `id`.
 * Values are lifted verbatim from the artifact boards (node tools/artifact/extract.mjs <Board>).
 */

export type MarketTone = "accent" | "success" | "warning" | "danger" | "default" | "info";

/** What the visitor is looking for: nights at a hotel, lodge or camp, or a home to rent by the month. */
export type MarketMode = "stays" | "homes";

export type BookingMode = "instant" | "request";

// ── Explore ──────────────────────────────────────────────────────────────────

export interface SearchField {
  id: string;
  label: string;
  value: string;
  /** Spans two grid columns (the "Where" field). */
  wide?: boolean;
}

export interface PriceBand {
  id: string;
  label: string;
  /** Price < under. */
  under?: number;
  /** from ≤ price ≤ to. */
  from?: number;
  to?: number;
  /** Price > over. */
  over?: number;
}

/** One search mode of the marketplace with the visitor's current search and its filter vocabulary. */
export interface MarketSearch {
  id: MarketMode;
  label: string;
  icon: IconName;
  fields: SearchField[];
  submit: string;
  /** Area searched, e.g. "Rubavu" (result heading "6 stays in Rubavu"). */
  area: string;
  /** Line under the result heading. */
  summary: string;
  /** Nights searched (stays), for "RWF 170,000 for 2 nights". */
  nights: number | null;
  types: { id: string; label: string }[];
  amenities: { id: string; label: string }[];
  bands: PriceBand[];
  /** Price distribution, bar heights in percent. */
  histogram: number[];
  histogramLabel: string;
  mapArea: string;
  /** Shape of the water body on the placeholder map (SVG path in a 360×640 box). */
  waterPath: string;
  /** Listing selected on the map when the mode opens. */
  selected: string;
}

export interface MarketListing {
  id: string;
  mode: MarketMode;
  name: string;
  /** Property type id (MarketSearch.types). */
  type: string;
  where: string;
  rating: number;
  reviews: number;
  /** RWF per night (stays) or per month (homes). */
  price: number;
  /** Stays: confirmed on payment, or the host accepts by a deadline. */
  booking: BookingMode | null;
  /** Stays booked by request: "about 3 h". */
  replies: string | null;
  /** Homes: "2 bedrooms · 96 m²". */
  size: string | null;
  /** Homes: "From 1 Nov". */
  available: string | null;
  amenities: string[];
  entity: string;
  caption: string;
  photo: StockKey;
  /** Map pin position in percent of the map box. */
  pin: { x: number; y: number };
  rank: number;
  saved: boolean;
  /** Slug of the listing's property page, when it has one. */
  page: string | null;
}

// ── Property page ────────────────────────────────────────────────────────────

export interface MarketProperty {
  id: string;
  listing: string;
  name: string;
  area: string;
  rating: number;
  reviewCount: number;
  location: string;
  kind: string;
  /** Collection the visitor saved this place to. */
  savedTo: string;
  cover: { photo: StockKey; caption: string };
  gallery: { photo: StockKey; caption: string }[];
  photoCount: number;
  about: string;
  highlights: { id: string; icon: IconName; title: string; desc: string }[];
  amenities: { id: string; icon: IconName; label: string }[];
  /** Visitor's search: ISO dates, guests and room. */
  stay: { checkIn: string; checkOut: string; adults: number; children: number; room: string };
  /** Demo "today" and the last night the calendar offers. */
  bookable: { from: string; to: string };
  guests: { adults: { min: number; max: number; sub: string }; children: { min: number; max: number; sub: string } };
  /** Days before check-in that a full refund is still given, and the hour it ends. */
  cancellation: { fullRefundDays: number; cutoff: string; partialRefund: string; nonRefundableNote: string };
  saverDiscount: number;
  package: { label: string; name: string; price: number; room: string; nights: number; weekday: number };
  houseRules: { label: string; value: string }[];
  scores: { label: string; value: number }[];
  reviewNote: string;
  map: { label: string; distances: { place: string; distance: string }[]; note: string };
  business: {
    initials: string;
    name: string;
    runs: string;
    verified: string;
    licence: string;
    tin: string;
    evidence: string;
  };
}

export interface MarketRoom {
  id: string;
  property: string;
  name: string;
  /** RWF per night. */
  price: number;
  bed: string;
  size: string;
  feature: string;
  sleeps: number;
  left: number;
  booking: BookingMode;
  /** Request rooms: reply time, e.g. "2 h". */
  reply: string | null;
  /** Sold-out nights (ISO dates). */
  soldOut: string[];
  photo: StockKey;
}

export interface MarketReview {
  id: string;
  property: string;
  initials: string;
  name: string;
  from: string;
  stay: string;
  score: number;
  published: string;
  helpful: number;
  text: string;
  reply: string;
  replyBy: string;
  /** Moderation reference given when the review is reported. */
  reportRef: string;
}

export interface ReportReason {
  id: string;
  label: string;
}

// ── Checkout ─────────────────────────────────────────────────────────────────

export interface CheckoutStage {
  label: string;
}

/** A booking being checked out: the instant Deluxe Lake View booking or the Family Suite request. */
export interface MarketCheckout {
  id: BookingMode;
  reference: string;
  property: string;
  room: string;
  plan: string;
  dates: string;
  nights: number;
  rate: number;
  /**
   * The guest service fee on top of the stay, RWF. The booking service charges it on every stay
   * (`GUEST_SERVICE_FEE_RATE`); the prototype drew no fee, so its documents leave it out.
   */
  serviceFee?: number;
  vatRate: number;
  vatStatus: string;
  guests: string;
  checkIn: { day: string; time: string };
  checkOut: { day: string; time: string };
  /** Summary chip: "Instant confirmation" / "Hotel replies within 2 h". */
  confirmation: string;
  /** Request: "12:43". */
  replyBy: string | null;
  guest: { firstName: string; lastName: string; email: string; mobile: string; country: string };
  arrival: string;
  requests: string[];
  note: string;
  cancellation: { id: string; label: string; until: string; tone: MarketTone; weight: number }[];
  freeCancellation: string;
  payee: string;
  payment: { intent: string; heldUntil: string; checks: string[] };
}

export interface PaymentMethod {
  id: string;
  label: string;
  icon: IconName;
  kind: "mobile" | "card";
  /** Provider name in sentences: "MTN MoMo", "Your bank". */
  provider: string;
  number: string | null;
  mask: string;
  reference: string;
}

export interface Option {
  id: string;
  label: string;
}

// ── Guest account ────────────────────────────────────────────────────────────

export interface GuestProfile {
  id: string;
  name: string;
  initials: string;
  email: string;
  mobile: string;
  country: string;
  since: string;
  home: string;
  signIn: string;
  language: string;
}

export interface TripFact {
  label: string;
  chip: string;
  tone: MarketTone;
  note: string;
}

export interface UpcomingTrip {
  id: string;
  name: string;
  dates: string;
  room: string;
  ref: string;
  photo: StockKey;
  facts: TripFact[];
  /** Facts once the guest withdraws a request. */
  withdrawnFacts: TripFact[] | null;
  links: { label: string; board: BoardId; primary: boolean }[];
  withdrawable: boolean;
}

export interface PastTrip {
  id: string;
  name: string;
  business: string;
  dates: string;
  ref: string;
  photo: StockKey;
  money: { chip: string; tone: MarketTone; note: string };
  review: { chip: string; tone: MarketTone };
  action: { label: string; board: BoardId; primary: boolean };
}

export interface SavedPlace {
  id: string;
  name: string;
  line: string;
  note: string;
  tone: MarketTone;
  board: BoardId;
  photo: StockKey;
}

export interface SavedCollection {
  id: string;
  name: string;
  visibility: string;
  noun: string;
  photo: StockKey;
  items: SavedPlace[];
}

export interface ReviewToWrite {
  id: string;
  title: string;
  desc: string;
  chip: string;
  tone: MarketTone;
  board: BoardId;
}

export interface GuestReviewItem {
  id: string;
  section: "wrote" | "about";
  who: string;
  when: string;
  state: string;
  tone: MarketTone;
  icon: IconName;
  /** Hidden reviews show their text as a locked note, without stars. */
  visible: boolean;
  score: number | null;
  text: string;
}

export interface GuestConsent {
  id: string;
  label: string;
  desc: string;
  on: boolean;
  /** Required to deliver bookings; cannot be switched off. */
  locked: boolean;
}

// ── Data ─────────────────────────────────────────────────────────────────────

const searches: MarketSearch[] = [
  {
    id: "stays",
    label: "Stays",
    icon: "Suitcase",
    fields: [
      { id: "where", label: "Where", value: "Rubavu, Lake Kivu", wide: true },
      { id: "in", label: "Check in", value: "Fri 23 Oct 2026" },
      { id: "out", label: "Check out", value: "Sun 25 Oct 2026" },
      { id: "guests", label: "Guests", value: "2 adults · 1 room" },
    ],
    submit: "Search stays",
    area: "Rubavu",
    summary: "Fri 23 – Sun 25 Oct · 2 nights · 2 adults · prices before taxes",
    nights: 2,
    types: [
      { id: "hotel", label: "Hotel" },
      { id: "lodge", label: "Lodge" },
      { id: "tented", label: "Tented camp" },
      { id: "guest", label: "Guest house" },
      { id: "apartment", label: "Apartment" },
      { id: "villa", label: "Villa" },
    ],
    amenities: [
      { id: "lake", label: "Lake view" },
      { id: "wifi", label: "Wi-Fi" },
      { id: "breakfast", label: "Breakfast" },
      { id: "pool", label: "Pool" },
      { id: "parking", label: "Parking" },
      { id: "transfer", label: "Transfers" },
      { id: "access", label: "Step-free rooms" },
    ],
    bands: [
      { id: "any", label: "Any" },
      { id: "low", label: "Under 100k", under: 100000 },
      { id: "mid", label: "100k to 200k", from: 100000, to: 200000 },
      { id: "high", label: "Over 200k", over: 200000 },
    ],
    histogram: [30, 62, 88, 74, 66, 92, 58, 44, 36, 24, 18, 12, 8, 6],
    histogramLabel: "Distribution of nightly prices in Rubavu, most between RWF 50,000 and 150,000",
    mapArea: "Rubavu · Lake Kivu shore",
    waterPath: "M0 0 L 90 0 C 110 80, 70 160, 110 240 S 150 420, 120 520 S 160 600, 150 640 L 0 640 Z",
    selected: "isangano",
  },
  {
    id: "homes",
    label: "Homes to rent",
    icon: "House",
    fields: [
      { id: "where", label: "Where", value: "Kigali", wide: true },
      { id: "in", label: "Move in from", value: "1 Nov 2026" },
      { id: "length", label: "Lease length", value: "12 months" },
      { id: "beds", label: "Bedrooms", value: "1 or more" },
    ],
    submit: "Search homes",
    area: "Kigali",
    summary: "Move in from 1 Nov 2026 · 12-month lease · rent excludes utilities",
    nights: null,
    types: [
      { id: "apartment", label: "Apartment" },
      { id: "villa", label: "Villa" },
      { id: "house", label: "House" },
      { id: "studio", label: "Studio" },
    ],
    amenities: [
      { id: "furnished", label: "Furnished" },
      { id: "parking", label: "Parking" },
      { id: "security", label: "Security guard" },
      { id: "garden", label: "Garden" },
      { id: "water", label: "Backup water" },
    ],
    bands: [
      { id: "any", label: "Any" },
      { id: "low", label: "Under 700k", under: 700000 },
      { id: "mid", label: "700k to 1.2M", from: 700000, to: 1200000 },
      { id: "high", label: "Over 1.2M", over: 1200000 },
    ],
    histogram: [20, 45, 70, 90, 76, 60, 48, 36, 28, 22, 14, 10, 6, 4],
    histogramLabel: "Distribution of monthly rents in Kigali, most between RWF 500,000 and 1,200,000",
    mapArea: "Kigali · Gasabo, Kicukiro, Nyarugenge",
    waterPath: "M0 600 C 60 560, 120 590, 200 610 S 320 600, 360 620 L 360 640 L 0 640 Z",
    selected: "kacyiru",
  },
];

const listings: MarketListing[] = [
  {
    id: "isangano",
    mode: "stays",
    name: "Isangano Lakeside Hotel",
    type: "hotel",
    where: "Gisenyi, Rubavu",
    rating: 4.6,
    reviews: 128,
    price: 85000,
    booking: "instant",
    replies: null,
    size: null,
    available: null,
    amenities: ["wifi", "lake", "breakfast", "parking", "access"],
    entity: "Amahoro Hospitality Ltd",
    caption: "Lake view terrace",
    photo: "lakeViewTerraceSunset",
    pin: { x: 34, y: 44 },
    rank: 1,
    saved: true,
    page: "isangano-lakeside-hotel",
  },
  {
    id: "rubona",
    mode: "stays",
    name: "Rubona Peninsula Lodge",
    type: "lodge",
    where: "Rubona, Rubavu",
    rating: 4.7,
    reviews: 84,
    price: 150000,
    booking: "instant",
    replies: null,
    size: null,
    available: null,
    amenities: ["wifi", "lake", "breakfast", "pool", "transfer"],
    entity: "Rubona Hills Ltd",
    caption: "Cottages above the bay",
    photo: "cottagesAboveTheBay",
    pin: { x: 46, y: 70 },
    rank: 2,
    saved: true,
    page: null,
  },
  {
    id: "sunset",
    mode: "stays",
    name: "Kivu Sunset Guest House",
    type: "guest",
    where: "Gisenyi, Rubavu",
    rating: 4.4,
    reviews: 61,
    price: 45000,
    booking: "request",
    replies: "about 3 h",
    size: null,
    available: null,
    amenities: ["wifi", "breakfast", "parking"],
    entity: "Kivu Sunset Hospitality Ltd",
    caption: "Garden rooms",
    photo: "gardenRooms",
    pin: { x: 52, y: 34 },
    rank: 3,
    saved: false,
    page: null,
  },
  {
    id: "nyamyumba",
    mode: "stays",
    name: "Nyamyumba Tented Camp",
    type: "tented",
    where: "Nyamyumba, Rubavu",
    rating: 4.5,
    reviews: 39,
    price: 120000,
    booking: "instant",
    replies: null,
    size: null,
    available: null,
    amenities: ["lake", "breakfast", "parking"],
    entity: "Kivu Canvas Ltd",
    caption: "Tents on the shore",
    photo: "tentsOnTheShore",
    pin: { x: 58, y: 86 },
    rank: 4,
    saved: false,
    page: null,
  },
  {
    id: "hills",
    mode: "stays",
    name: "Gisenyi Hills Villa",
    type: "villa",
    where: "Nengo, Rubavu",
    rating: 4.8,
    reviews: 22,
    price: 260000,
    booking: "request",
    replies: "about 6 h",
    size: null,
    available: null,
    amenities: ["wifi", "lake", "pool", "parking"],
    entity: "Nengo Villas Ltd",
    caption: "Private pool",
    photo: "privatePoolVilla",
    pin: { x: 70, y: 22 },
    rank: 5,
    saved: false,
    page: null,
  },
  {
    id: "lakeshore",
    mode: "stays",
    name: "Lakeshore Apartments",
    type: "apartment",
    where: "Gisenyi, Rubavu",
    rating: 4.3,
    reviews: 47,
    price: 70000,
    booking: "instant",
    replies: null,
    size: null,
    available: null,
    amenities: ["wifi", "parking", "access"],
    entity: "Lakeshore Homes Ltd",
    caption: "One-bedroom suite",
    photo: "oneBedroomSuite",
    pin: { x: 42, y: 52 },
    rank: 6,
    saved: false,
    page: null,
  },
  {
    id: "kacyiru",
    mode: "homes",
    name: "Kacyiru Court Residences",
    type: "apartment",
    where: "Kacyiru, Gasabo",
    rating: 4.5,
    reviews: 18,
    price: 850000,
    booking: null,
    replies: null,
    size: "2 bedrooms · 96 m²",
    available: "From 1 Nov",
    amenities: ["furnished", "parking", "security", "water"],
    entity: "Amahoro Residences Ltd",
    caption: "Courtyard, block B",
    photo: "courtyardBlockB",
    pin: { x: 52, y: 38 },
    rank: 1,
    saved: false,
    page: null,
  },
  {
    id: "kimihurura",
    mode: "homes",
    name: "Kimihurura Garden Flats",
    type: "apartment",
    where: "Kimihurura, Gasabo",
    rating: 4.6,
    reviews: 12,
    price: 650000,
    booking: null,
    replies: null,
    size: "1 bedroom · 64 m²",
    available: "Available now",
    amenities: ["furnished", "security", "garden"],
    entity: "Garden Flats Rwanda Ltd",
    caption: "Shared garden",
    photo: "sharedGarden",
    pin: { x: 60, y: 52 },
    rank: 2,
    saved: false,
    page: null,
  },
  {
    id: "kiyovu",
    mode: "homes",
    name: "Kiyovu Studio Lofts",
    type: "studio",
    where: "Kiyovu, Nyarugenge",
    rating: 4.2,
    reviews: 21,
    price: 420000,
    booking: null,
    replies: null,
    size: "Studio · 38 m²",
    available: "Available now",
    amenities: ["furnished", "water"],
    entity: "Kiyovu Lofts Ltd",
    caption: "Loft studio",
    photo: "loftStudio",
    pin: { x: 34, y: 60 },
    rank: 3,
    saved: false,
    page: null,
  },
  {
    id: "rebero",
    mode: "homes",
    name: "Rebero View House",
    type: "house",
    where: "Rebero, Kicukiro",
    rating: 4.4,
    reviews: 9,
    price: 1100000,
    booking: null,
    replies: null,
    size: "3 bedrooms · 140 m²",
    available: "From 1 Dec",
    amenities: ["parking", "security", "garden", "water"],
    entity: "Rebero Estates Ltd",
    caption: "View over the valley",
    photo: "viewOverTheValley",
    pin: { x: 46, y: 80 },
    rank: 4,
    saved: false,
    page: null,
  },
  {
    id: "nyarutarama",
    mode: "homes",
    name: "Nyarutarama Family Villa",
    type: "villa",
    where: "Nyarutarama, Gasabo",
    rating: 4.9,
    reviews: 7,
    price: 2400000,
    booking: null,
    replies: null,
    size: "4 bedrooms · garden",
    available: "From 15 Nov",
    amenities: ["parking", "security", "garden", "water"],
    entity: "Umusozi Homes Ltd",
    caption: "Family garden",
    photo: "familyGarden",
    pin: { x: 70, y: 26 },
    rank: 5,
    saved: false,
    page: null,
  },
];

const properties: MarketProperty[] = [
  {
    id: "isangano-lakeside-hotel",
    listing: "isangano",
    name: "Isangano Lakeside Hotel",
    area: "Rubavu",
    rating: 4.6,
    reviewCount: 128,
    location: "Gisenyi lakeshore, Rubavu · Western Province",
    kind: "Hotel · 42 rooms",
    savedTo: "Lake Kivu weekend",
    cover: { photo: "lakeViewTerraceSunset", caption: "Lake view terrace at sunset" },
    gallery: [
      { photo: "deluxeLakeViewRoom", caption: "Deluxe Lake View room" },
      { photo: "isanganoTerrace", caption: "Isangano Terrace" },
      { photo: "gardenTerraceDusk", caption: "Garden Terrace" },
      { photo: "lakeBar", caption: "Lake Bar" },
    ],
    photoCount: 24,
    about: "A 42-room hotel on the Gisenyi lakeshore, with a terrace restaurant, lake bar and garden.",
    highlights: [
      { id: "lakeshore", icon: "Sun", title: "On the lakeshore", desc: "Balconies over Lake Kivu" },
      { id: "breakfast", icon: "Cup", title: "Breakfast included", desc: "Every rate, from 06:30" },
      { id: "money", icon: "Smartphone", title: "Mobile money", desc: "MTN MoMo, Airtel Money or card" },
      { id: "business", icon: "Receipt", title: "Business-ready", desc: "Company invoices and EBM receipts" },
    ],
    amenities: [
      { id: "wifi", icon: "Signal", label: "Wi-Fi" },
      { id: "restaurant", icon: "Cup", label: "Restaurant" },
      { id: "bar", icon: "Mug", label: "Lake bar" },
      { id: "parking", icon: "Car", label: "Free parking" },
      { id: "hall", icon: "Persons", label: "Kivu Hall · 120 seated" },
      { id: "access", icon: "UniversalAccess", label: "Step-free rooms" },
      { id: "laundry", icon: "TShirt", label: "Laundry" },
      { id: "desk", icon: "Clock", label: "24-hour front desk" },
      { id: "pickup", icon: "Route", label: "Bus park pick-up on request" },
    ],
    stay: { checkIn: "2026-10-23", checkOut: "2026-10-25", adults: 2, children: 0, room: "deluxe" },
    bookable: { from: "2026-10-12", to: "2027-03-31" },
    guests: {
      adults: { min: 1, max: 6, sub: "Age 13+" },
      children: { min: 0, max: 4, sub: "Age 0–12" },
    },
    cancellation: {
      fullRefundDays: 3,
      cutoff: "14:00",
      partialRefund: "50% refund",
      nonRefundableNote: "Non-refundable rate: no refunds.",
    },
    saverDiscount: 0.1,
    package: {
      label: "Add boat trip + dinner for 2",
      name: "Lake Kivu Weekend",
      price: 115000,
      room: "deluxe",
      nights: 2,
      weekday: 5,
    },
    houseRules: [
      { label: "Check-in", value: "14:00 – 22:00" },
      { label: "Check-out", value: "By 11:00" },
      { label: "ID", value: "National ID or passport" },
      { label: "Children", value: "Under 6 stay free" },
      { label: "Smoking", value: "Garden area only" },
      { label: "Pets", value: "Not allowed" },
    ],
    scores: [
      { label: "Cleanliness", value: 4.7 },
      { label: "Staff", value: 4.8 },
      { label: "Location", value: 4.9 },
      { label: "Value", value: 4.3 },
    ],
    reviewNote:
      "Only guests with a completed stay can review. Guest and hotel reviews of each other stay hidden until both are written or 14 days pass. Moderators remove reviews that break the rules; every decision is logged.",
    map: {
      label: "Map: the hotel sits on the eastern shore of Lake Kivu in Gisenyi",
      distances: [
        { place: "Public beach", distance: "400 m" },
        { place: "Rubavu town centre", distance: "1.5 km" },
        { place: "Kigali", distance: "about 3 h by road" },
      ],
      note: "Exact address after booking.",
    },
    business: {
      initials: "AH",
      name: "Amahoro Hospitality Ltd",
      runs: "Runs this hotel and Ishyamba Forest Lodge",
      verified: "Verified 2 Sep 2026",
      licence: "Active to 30 Jun 2027",
      tin: "102 345 678",
      evidence: "Checked against documents, not a live registry",
    },
  },
];

const rooms: MarketRoom[] = [
  {
    id: "deluxe",
    property: "isangano-lakeside-hotel",
    name: "Deluxe Lake View",
    price: 140000,
    bed: "1 king bed",
    size: "32 m²",
    feature: "Lake balcony",
    sleeps: 2,
    left: 1,
    booking: "instant",
    reply: null,
    soldOut: ["2026-10-30", "2026-10-31"],
    photo: "deluxeLakeViewRoom",
  },
  {
    id: "queen",
    property: "isangano-lakeside-hotel",
    name: "Standard Queen",
    price: 85000,
    bed: "1 queen bed",
    size: "22 m²",
    feature: "Garden side",
    sleeps: 2,
    left: 4,
    booking: "instant",
    reply: null,
    soldOut: [],
    photo: "standardQueenRoom",
  },
  {
    id: "twin",
    property: "isangano-lakeside-hotel",
    name: "Twin",
    price: 92000,
    bed: "2 single beds",
    size: "24 m²",
    feature: "Garden side",
    sleeps: 2,
    left: 2,
    booking: "instant",
    reply: null,
    soldOut: ["2026-10-24", "2026-10-31"],
    photo: "twinRoom",
  },
  {
    id: "family",
    property: "isangano-lakeside-hotel",
    name: "Family Suite",
    price: 220000,
    bed: "1 king + 2 single beds",
    size: "48 m²",
    feature: "Lake view",
    sleeps: 4,
    left: 2,
    booking: "request",
    reply: "2 h",
    soldOut: ["2026-11-06", "2026-11-07"],
    photo: "familySuiteLounge",
  },
];

const reviews: MarketReview[] = [
  {
    id: "r1",
    property: "isangano-lakeside-hotel",
    initials: "TW",
    name: "Thomas W.",
    from: "Germany",
    stay: "Stayed Sep 2026 · Deluxe Lake View · 3 nights",
    score: 5,
    published: "Published 28 Sep 2026",
    helpful: 14,
    text: "The balcony over the lake made the trip. Breakfast on the terrace was excellent and the desk arranged a boat trip the same evening. Wi-Fi in the room was slow after 21:00.",
    reply:
      "Thank you, Thomas. We added a second access point on the third floor after your stay. Come back for the dry-season sunsets.",
    replyBy: "Aline Uwase, General manager · 30 Sep 2026",
    reportRef: "MOD-2291",
  },
  {
    id: "r2",
    property: "isangano-lakeside-hotel",
    initials: "AM",
    name: "Aisha M.",
    from: "Kenya",
    stay: "Stayed Aug 2026 · Family Suite · 2 nights",
    score: 4,
    published: "Published 19 Aug 2026",
    helpful: 9,
    text: "Spacious suite and the children loved the garden. Check-in took a while because our mobile money payment was still pending, but staff kept us informed and it was confirmed before we went up.",
    reply:
      "Thank you, Aisha. Confirmations were slow that afternoon. Guests now see their payment status on their phone while we wait.",
    replyBy: "Aline Uwase, General manager · 20 Aug 2026",
    reportRef: "MOD-2292",
  },
];

const reportReasons: ReportReason[] = [
  { id: "fake", label: "Not about a real stay" },
  { id: "abuse", label: "Offensive or discriminatory" },
  { id: "private", label: "Shares someone’s personal information" },
  { id: "conflict", label: "Written by someone with a conflict of interest" },
];

const sarah = {
  firstName: "Sarah",
  lastName: "Kimani",
  email: "sarah.kimani@example.com",
  mobile: "+254 712 448 190",
  country: "KE",
};

const cancellationTiers: MarketCheckout["cancellation"] = [
  { id: "full", label: "Full refund", until: "Until Tue 20 Oct, 14:00", tone: "success", weight: 8 },
  { id: "half", label: "50% refund", until: "Until Fri 23 Oct", tone: "warning", weight: 3 },
  { id: "none", label: "No refund", until: "After that", tone: "danger", weight: 3 },
];

const checkouts: MarketCheckout[] = [
  {
    id: "instant",
    reference: "BK-20457",
    property: "isangano-lakeside-hotel",
    room: "Deluxe Lake View",
    plan: "Free cancellation",
    dates: "Fri 23 – Sun 25 Oct · 2 nights",
    nights: 2,
    rate: 140000,
    vatRate: 18,
    vatStatus: "Awaiting sign-off",
    guests: "2 adults",
    checkIn: { day: "Fri 23 Oct", time: "From 14:00" },
    checkOut: { day: "Sun 25 Oct", time: "By 11:00" },
    confirmation: "Instant confirmation",
    replyBy: null,
    guest: sarah,
    arrival: "late",
    requests: ["late", "quiet"],
    note: "We arrive from Kigali by bus around 20:00.",
    cancellation: cancellationTiers,
    freeCancellation: "Free cancellation until Tue 20 Oct, 14:00",
    payee: "Amahoro Hospitality Ltd",
    payment: {
      intent: "PI-77142",
      heldUntil: "Until 11:30",
      checks: ["10:47 · no answer yet", "10:48 · no answer yet", "10:49 · still processing"],
    },
  },
  {
    id: "request",
    reference: "BK-20458",
    property: "isangano-lakeside-hotel",
    room: "Family Suite",
    plan: "Free cancellation",
    dates: "Fri 23 – Sun 25 Oct · 2 nights",
    nights: 2,
    rate: 220000,
    vatRate: 18,
    vatStatus: "Awaiting sign-off",
    guests: "2 adults, 2 children",
    checkIn: { day: "Fri 23 Oct", time: "From 14:00" },
    checkOut: { day: "Sun 25 Oct", time: "By 11:00" },
    confirmation: "Hotel replies within 2 h",
    replyBy: "12:43",
    guest: sarah,
    arrival: "late",
    requests: ["late", "quiet"],
    note: "We arrive from Kigali by bus around 20:00.",
    cancellation: cancellationTiers,
    freeCancellation: "Free cancellation until Tue 20 Oct, 14:00",
    payee: "Amahoro Hospitality Ltd",
    payment: {
      intent: "PI-77142",
      heldUntil: "Until 11:30",
      checks: ["10:47 · no answer yet", "10:48 · no answer yet", "10:49 · still processing"],
    },
  },
];

const paymentMethods: PaymentMethod[] = [
  {
    id: "mtn",
    label: "MTN MoMo",
    icon: "Smartphone",
    kind: "mobile",
    provider: "MTN MoMo",
    number: "078 812 4417",
    mask: "078 ••• 4417",
    reference: "MP261012.1043.C71842",
  },
  {
    id: "airtel",
    label: "Airtel Money",
    icon: "Smartphone",
    kind: "mobile",
    provider: "Airtel Money",
    number: "073 205 6618",
    mask: "073 ••• 6618",
    reference: "AM261012.1043.55190",
  },
  {
    id: "card",
    label: "Card",
    icon: "CreditCard",
    kind: "card",
    provider: "Your bank",
    number: null,
    mask: "Visa ending 4021",
    reference: "Auth 604218",
  },
];

const countries: Option[] = [
  { id: "KE", label: "Kenya" },
  { id: "RW", label: "Rwanda" },
  { id: "UG", label: "Uganda" },
  { id: "DE", label: "Germany" },
];

const arrivalWindows: Option[] = [
  { id: "early", label: "14:00–16:00" },
  { id: "mid", label: "16:00–19:00" },
  { id: "late", label: "19:00–22:00" },
  { id: "after", label: "After 22:00" },
];

const requestTags: Option[] = [
  { id: "late", label: "Late arrival" },
  { id: "quiet", label: "Quiet room" },
  { id: "high", label: "High floor" },
  { id: "pickup", label: "Bus park pick-up" },
];

const guestProfiles: GuestProfile[] = [
  {
    id: "guest",
    name: "Sarah Kimani",
    initials: "SK",
    email: "sarah.kimani@example.com",
    mobile: "+254 712 448 190",
    country: "Kenya",
    since: "Guest since March 2025",
    home: "Nairobi, Kenya",
    signIn: "signs in with an email code",
    language: "en",
  },
];

const upcomingTrips: UpcomingTrip[] = [
  {
    id: "BK-20457",
    name: "Isangano Lakeside Hotel",
    dates: "Fri 23 – Sun 25 Oct 2026",
    room: "Deluxe Lake View · 2 adults",
    ref: "Booking BK-20457 · Amahoro Hospitality Ltd",
    photo: "isanganoHotelExterior",
    facts: [
      { label: "Booking", chip: "Confirmed", tone: "success", note: "12 Oct, 10:43" },
      { label: "Payment", chip: "Verified", tone: "success", note: "RWF 280,000 · MTN MoMo · MP261012.1043.C71842" },
      { label: "Pre-arrival", chip: "ID and arrival time needed", tone: "warning", note: "Saves time at the desk" },
    ],
    withdrawnFacts: null,
    links: [
      { label: "Open trip", board: "GuestTrip", primary: true },
      { label: "Pre-arrival check-in", board: "GuestPreArrival", primary: false },
    ],
    withdrawable: false,
  },
  {
    id: "BK-20461",
    name: "Kivu Sunset Guest House",
    dates: "Fri 13 – Sun 15 Nov 2026",
    room: "Garden double · 2 adults",
    ref: "Booking request BK-20461 · Kivu Sunset Hospitality Ltd",
    photo: "gardenRooms",
    facts: [
      { label: "Booking", chip: "Requested", tone: "info", note: "Host decides by 13 Oct, 09:00" },
      { label: "Payment", chip: "Not charged", tone: "default", note: "You approve payment only if accepted" },
    ],
    withdrawnFacts: [
      { label: "Booking", chip: "Withdrawn by you", tone: "default", note: "12 Oct" },
      { label: "Payment", chip: "Nothing charged", tone: "default", note: "" },
    ],
    links: [],
    withdrawable: true,
  },
];

const pastTrips: PastTrip[] = [
  {
    id: "BK-20398",
    name: "Ishyamba Forest Lodge",
    business: "Amahoro Hospitality Ltd",
    dates: "3 – 6 Oct 2026",
    ref: "BK-20398 · stay ST-8812",
    photo: "forestLodge",
    money: { chip: "Bill settled", tone: "success", note: "F-5531 · fiscal receipt issued" },
    review: { chip: "Write review · 8 days left", tone: "warning" },
    action: { label: "Write review", board: "GuestReview", primary: true },
  },
  {
    id: "BK-19877",
    name: "Nyamyumba Tented Camp",
    business: "Kivu Canvas Ltd",
    dates: "3 – 5 Jul 2026",
    ref: "BK-19877",
    photo: "tentsOnTheShore",
    money: { chip: "Bill settled", tone: "success", note: "Receipt from Kivu Canvas Ltd" },
    review: { chip: "Published · 5 stars", tone: "default" },
    action: { label: "Bill and receipts", board: "GuestFolio", primary: false },
  },
  {
    id: "BK-19610",
    name: "Rubona Peninsula Lodge",
    business: "Rubona Hills Ltd",
    dates: "Cancelled · was 2 – 3 Jun 2026",
    ref: "BK-19610",
    photo: "cottagesAboveTheBay",
    money: { chip: "Refunded RWF 150,000", tone: "default", note: "MTN MoMo · MP260521.0915.B11873 · 21 May" },
    review: { chip: "Not applicable", tone: "default" },
    action: { label: "Book again", board: "MarketExplore", primary: false },
  },
];

const savedCollections: SavedCollection[] = [
  {
    id: "kivu",
    name: "Lake Kivu weekend",
    visibility: "Private",
    noun: "places",
    photo: "lakeKivuShoreline",
    items: [
      {
        id: "isangano",
        name: "Isangano Lakeside Hotel",
        line: "Gisenyi, Rubavu · RWF 140,000 a night for your dates",
        note: "Booked for 23 Oct",
        tone: "success",
        board: "MarketProperty",
        photo: "isanganoHotelExterior",
      },
      {
        id: "rubona",
        name: "Rubona Peninsula Lodge",
        line: "Rubona, Rubavu · RWF 150,000 a night",
        note: "Price down RWF 10,000 since saved",
        tone: "info",
        board: "MarketExplore",
        photo: "cottagesAboveTheBay",
      },
      {
        id: "hills",
        name: "Gisenyi Hills Villa",
        line: "Nengo, Rubavu · request to book",
        note: "No rooms 23 – 25 Oct",
        tone: "default",
        board: "MarketExplore",
        photo: "privatePoolVilla",
      },
    ],
  },
  {
    id: "family",
    name: "Family December",
    visibility: "Shared with 1 person",
    noun: "places",
    photo: "tentsOnTheShore",
    items: [
      {
        id: "nyamyumba",
        name: "Nyamyumba Tented Camp",
        line: "Nyamyumba, Rubavu · RWF 120,000 a night",
        note: "Available",
        tone: "success",
        board: "MarketExplore",
        photo: "tentsOnTheShore",
      },
      {
        id: "sunset",
        name: "Kivu Sunset Guest House",
        line: "Gisenyi, Rubavu · RWF 45,000 a night",
        note: "Request pending",
        tone: "info",
        board: "MarketExplore",
        photo: "gardenRooms",
      },
    ],
  },
  {
    id: "homes",
    name: "Kigali homes",
    visibility: "Private",
    noun: "homes",
    photo: "courtyardBlockB",
    items: [
      {
        id: "kacyiru",
        name: "Kacyiru Court Residences",
        line: "Kacyiru, Gasabo · RWF 850,000 a month",
        note: "From 1 Nov",
        tone: "default",
        board: "MarketExplore",
        photo: "courtyardBlockB",
      },
      {
        id: "kimihurura",
        name: "Kimihurura Garden Flats",
        line: "Kimihurura, Gasabo · RWF 650,000 a month",
        note: "Available now",
        tone: "success",
        board: "MarketExplore",
        photo: "sharedGarden",
      },
    ],
  },
];

const reviewsToWrite: ReviewToWrite[] = [
  {
    id: "BK-20398",
    title: "Ishyamba Forest Lodge · 3 to 6 Oct",
    desc: "The lodge has already reviewed you. Both reviews appear when you submit yours, or on 20 Oct if you don’t.",
    chip: "8 days left",
    tone: "warning",
    board: "GuestReview",
  },
];

const guestReviews: GuestReviewItem[] = [
  {
    id: "wrote-nyamyumba",
    section: "wrote",
    who: "Nyamyumba Tented Camp",
    when: "Stayed 3 – 5 Jul · published 12 Jul",
    state: "Published · host replied",
    tone: "success",
    icon: "Check",
    visible: true,
    score: 5,
    text: "Waking up to the lake from the tent was unforgettable. Staff organised a fishing boat at sunrise.",
  },
  {
    id: "about-ishyamba",
    section: "about",
    who: "From Ishyamba Forest Lodge",
    when: "Stay 3 – 6 Oct",
    state: "Hidden until you review or 20 Oct",
    tone: "warning",
    icon: "EyeSlash",
    visible: false,
    score: null,
    text: "Submitted by the lodge. You will see it once yours is in.",
  },
  {
    id: "about-nyamyumba",
    section: "about",
    who: "From Nyamyumba Tented Camp",
    when: "Stay 3 – 5 Jul · published 12 Jul",
    state: "Published",
    tone: "success",
    icon: "Check",
    visible: true,
    score: 5,
    text: "Sarah was considerate, kept to the camp quiet hours and left the tent spotless.",
  },
];

const consents: GuestConsent[] = [
  {
    id: "msg",
    label: "Booking and stay messages",
    desc: "Required to deliver bookings you make · confirmations, arrival details, receipts",
    on: true,
    locked: true,
  },
  {
    id: "share",
    label: "Share my mobile number with hosts I book",
    desc: "So the property can reach you about arrival · changed 3 Mar 2026",
    on: true,
    locked: false,
  },
  { id: "remind", label: "Review reminders", desc: "One reminder after check-out", on: true, locked: false },
  { id: "offers", label: "Offers from Injishi", desc: "Email, at most twice a month", on: false, locked: false },
  {
    id: "recs",
    label: "Personalised recommendations",
    desc: "Uses your saved places and past trips",
    on: false,
    locked: false,
  },
];

const languages: Option[] = [
  { id: "en", label: "English" },
  { id: "rw", label: "Kinyarwanda" },
  { id: "fr", label: "Français" },
];

export const fixtures = {
  "market.searches": searches,
  "market.listings": listings,
  "market.properties": properties,
  "market.rooms": rooms,
  "market.reviews": reviews,
  "market.reportReasons": reportReasons,
  "market.checkouts": checkouts,
  "market.paymentMethods": paymentMethods,
  "market.countries": countries,
  "market.arrivalWindows": arrivalWindows,
  "market.requestTags": requestTags,
  "market.guestProfiles": guestProfiles,
  "market.upcomingTrips": upcomingTrips,
  "market.pastTrips": pastTrips,
  "market.savedCollections": savedCollections,
  "market.reviewsToWrite": reviewsToWrite,
  "market.guestReviews": guestReviews,
  "market.consents": consents,
  "market.languages": languages,
} satisfies FixtureSet;
