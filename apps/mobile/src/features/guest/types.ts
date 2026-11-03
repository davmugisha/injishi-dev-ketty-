// What the guest's browse, book and home screens read (proto-ui, PLAN.md "Data seam"): view models
// built by `data.ts`, from the sample data in mock mode or from the public API's contracts in api
// mode (Explore and the property page). Screens import these types and the hooks, nothing else.

import type { ImageProps } from "expo-image";
import type { IconName, TimelineStep } from "@/components/ui";
import type { TabBadges } from "@/proto/screens";

/** A photograph: a bundled sample photo, or the API's photo route as a URI. */
export type GuestPhoto = ImageProps["source"];

/** The guest tab bar's badges (the prototype's `tabbar(app, active, badges)`). */
export type GuestBadges = TabBadges<"guest">;

// ---------- Home

export type HomePhase = "before" | "stay" | "after";

/** Where a Home card leads: the extras, ordering, or a stay's page. */
export type HomeCardLink = "extras" | "order" | "property" | null;

/** `.gx-ex`: a photo card in a sideways row ("Boat trip on Lake Kivu"). */
export interface HomeCard {
  key: string;
  title: string;
  detail: string;
  photo: GuestPhoto;
  link: HomeCardLink;
  /** The stay a `property` card opens. */
  slug?: string;
}

/** The trip Home follows. */
export interface HomeTrip {
  reference: string;
  slug: string;
  hotel: string;
  /** "Isangano Lakeside · Rubavu", the pill over the photo. */
  place: string;
  photo: GuestPhoto;
}

export interface HomeBefore {
  phase: "before";
  trip: HomeTrip;
  /** "In 2 days". */
  countdown: string;
  title: string;
  /** "Wed 14 – Fri 16 Oct · 2 nights · BK-20431". */
  line: string;
  checkIn: { done: number; total: number; steps: TimelineStep[] };
  /** The shortcut tiles' second lines: "3 h 30 drive", "replies 15 min", "boat trip". */
  shortcuts: { drive: string; replies: string; extra: string };
  arrival: { title: string; body: string };
  extras: HomeCard[];
}

export interface HomeStay {
  phase: "stay";
  trip: HomeTrip;
  photo: GuestPhoto;
  title: string;
  /** "Night 2 of 2 · Deluxe Lake View". */
  line: string;
  newInInbox: boolean;
  key: { room: string; status: string };
  wifi: { network: string; password: string };
  /** "47,500 due", and whether a charge is new since the guest last looked. */
  bill: { due: string; unseen: boolean };
  /** "desk · 24 h". */
  desk: string;
  request: { title: string; detail: string; status: string } | null;
  checkout: { weekday: string; day: string; title: string; detail: string };
  tonightTitle: string;
  tonight: HomeCard[];
}

export interface HomeAfter {
  phase: "after";
  trip: HomeTrip;
  /** "Saturday 17 October". */
  date: string;
  title: string;
  /** "Wed 14 – Fri 16 Oct · room 204". */
  stayLine: string;
  review: { until: string; note: string };
  receipt: { detail: string };
  points: { title: string; detail: string };
  lostFound: { detail: string };
  bookAgain: HomeCard[];
}

export type GuestHome = HomeBefore | HomeStay | HomeAfter;

// ---------- Explore and the map

export interface StayCard {
  slug: string;
  name: string;
  /** "Gisenyi lakeshore · Hotel". */
  where: string;
  /** The kind of stay, for the filter chips: `hotel`, `lodge`, `tented_camp`... */
  type: string;
  /** What else the filters know: `lakeView`, `breakfast`. */
  tags: readonly string[];
  rating: number | null;
  reviewCount: number;
  priceRwf: number | null;
  /** What the price covers: "night", "a person, a night". */
  priceNote: string;
  photos: GuestPhoto[];
  booking: { instant: boolean; label: string } | null;
  /** "1 lake room left". */
  scarcity: string | null;
  saved: boolean;
  /** Where its pin sits on the map, in percent; null when it is not placed. */
  pin: { x: number; y: number } | null;
  /** The map card's second line: "Rubona · 4 km from Gisenyi". */
  near: string;
}

export interface ExploreData {
  search: { title: string; subtitle: string };
  /** Every match for the search, across pages. */
  total: number;
  stays: StayCard[];
  /** The stay the map's card shows first. */
  focus: string | null;
  /** The cursor of the page after these stays; null on the last page (always, with the sample data). */
  next: string | null;
}

/** A suggestion under the dates sheet's "Where": a district, a sector or one stay (`GET /explore/places`). */
export interface PlaceSuggestion {
  key: string;
  kind: "district" | "sector" | "property";
  label: string;
  /** "12 stays" for an area, "Gisenyi, Rubavu" for a stay. */
  sub: string;
  /** What the search's `place` takes: `district:33`, `sector:3305`, `property:<slug>`. */
  ref: string;
}

// ---------- The property page

export interface StayFact {
  icon: IconName;
  title: string;
  detail: string | null;
}

export interface StayRoom {
  id: string;
  name: string;
  detail: string;
  priceRwf: number | null;
  priceNote: string;
  /** "1 left": shown at 4 or fewer. */
  left: number | null;
  photo: GuestPhoto | null;
}

export interface StayDetail {
  slug: string;
  name: string;
  /** "Verified business · Hotel · 42 rooms". */
  eyebrow: string;
  verified: boolean;
  rating: number | null;
  reviewCount: number;
  /** "Gisenyi lakeshore, Rubavu". */
  where: string;
  photos: { source: GuestPhoto; caption: string | null }[];
  facts: StayFact[];
  /** "Rooms for 14–16 Oct", or "Rooms" with no dates. */
  roomsTitle: string;
  rooms: StayRoom[];
  /** The room the dock prices. */
  roomId: string | null;
  review: { stars: number; author: string; text: string } | null;
  /** The host's own words, when the API has them. */
  about: string | null;
  saved: boolean;
  shareUrl: string;
  /** The dock: "RWF 280,000" over "2 nights · 14–16 Oct · free cancel to 7 Oct". */
  dock: { price: string; note: string };
}

// ---------- Dates and guests

export interface DatesRoom {
  id: string;
  name: string;
  detail: string;
  priceRwf: number;
  /** Nights it cannot be booked (`yyyy-mm-dd`). */
  soldOut: readonly string[];
}

export interface DatesData {
  /** Null when the sheet sets the search on Explore rather than a stay's dates. */
  slug: string | null;
  stayName: string | null;
  /** The first day that can be picked. */
  today: string;
  checkIn: string | null;
  checkOut: string | null;
  adults: number;
  children: number;
  maxAdults: number;
  rooms: DatesRoom[];
  roomId: string | null;
}

/** What the sheet hands back. */
export interface DatesChoice {
  slug: string | null;
  roomId: string | null;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
}

// ---------- Checkout, payment, booked

export type PayMethodId = "mtn" | "airtel" | "card";

export interface PayMethod {
  id: PayMethodId;
  name: string;
  /** "078 ••• 2097", "Add a number", why it is not offered. */
  detail: string;
  /** Can pay now: a number is on file and the app takes it. */
  ready: boolean;
  /** Offered in the app at all (card is not, yet). */
  offered: boolean;
}

export interface CheckoutData {
  slug: string;
  stayName: string;
  roomName: string;
  photo: GuestPhoto;
  /** "Deluxe Lake View · 2 adults". */
  roomLine: string;
  /** "Wed 14 – Fri 16 Oct · 2 nights". */
  datesLine: string;
  /** "Instant confirmation", or the host's reply time. */
  confirmNote: string;
  lines: { label: string; value: string }[];
  total: number;
  deposit: number;
  depositNote: string;
  methods: PayMethod[];
  /** The cancellation tiers, in order: free, deposit kept, full stay. */
  tiers: { key: string; tone: "success" | "warning" | "danger"; weight: number; title: string; when: string }[];
}

export interface PaymentData {
  id: string;
  provider: string;
  /** "MoMo", "Airtel Money". */
  wallet: string;
  phone: string;
  amount: number;
  sentAt: string;
  checkedAt: string;
  heldUntil: string;
  roomName: string;
  /** How many prompts went out. */
  prompts: number;
}

export interface BookedData {
  reference: string;
  instant: boolean;
  stayName: string;
  /** "Wed 14 – Fri 16 Oct · Deluxe Lake View". */
  line: string;
  rows: { label: string; value: string }[];
  email: string;
  calendarAdded: boolean;
}

// ---------- Trips, saved, me

export interface UpcomingTrip {
  reference: string;
  /** Null when the property has no public page yet. */
  slug: string | null;
  hotel: string;
  /** "Wed 14 – Fri 16 Oct · BK-20431". */
  line: string;
  /** Null where the API sends none (`GET /me/trips` carries no photo): the stay's initials instead. */
  photo: GuestPhoto | null;
  /** "In 2 days", "Tomorrow", "Staying now". */
  countdown: string;
  confirmed: boolean;
  /** "Check-in is 1 of 3 done" over "Send your ID before Wednesday."; null once done. */
  checkIn: { title: string; detail: string } | null;
}

export interface PastTrip {
  reference: string;
  /** Null when the property has no public page yet: no Book again then. */
  slug: string | null;
  hotel: string;
  /** "Nyamagabe · 2–4 Aug 2026 · 540 points", or "· Cancelled" for a stay that did not happen. */
  detail: string;
  photo: GuestPhoto | null;
  reviewed: boolean;
}

export interface TripsData {
  upcoming: UpcomingTrip[];
  past: PastTrip[];
}

export interface SavedStay {
  slug: string;
  name: string;
  photo: GuestPhoto;
  rating: number | null;
  reviewCount: number;
  /** The cheapest room, for "RWF 85,000 from"; null for an idea. */
  fromRwf: number | null;
  /** An idea's line: "Tented camp · 4.5". */
  note: string | null;
  saved: boolean;
}

export interface SavedData {
  list: { title: string; stays: SavedStay[] };
  ideas: SavedStay[];
}

export interface MeData {
  name: string;
  /** "Guest since Aug 2026 · 3 stays"; null where nothing says so yet (api mode). */
  since: string | null;
  /** The account's email: the line under the name when there is no `since`. */
  email: string | null;
  /** Null where there is no rewards read yet (api mode): the card is left out. */
  rewards: { name: string; points: number; progress: number; note: string } | null;
  /** The rows' second lines; null leaves the row with its title only. */
  saved: string | null;
  payment: string | null;
  savedId: string | null;
  reach: string | null;
  /** Sign out is a row here: a real account (api mode). The sample data signs out on the account screen. */
  signOut: boolean;
}
