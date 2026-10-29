/**
 * What the commercial screens draw: rates and inventory, the availability calendar, the listing, revenue, groups, packages and sales.
 *
 * Declared here since ADR-074 stage 4: the product owns the shapes its views draw, copied verbatim from
 * `@injishi/data/fixtures/commercial.ts` with every type they reference. The demo fixtures keep matching
 * declarations for their rows until stage 9, and every page that passes those rows into a view is where the
 * compiler checks the two still agree.
 */
import type { BoardId, IconName, StockKey, Tone } from "./shared.ts";

/** Semantic tone of a chip, dot or marker (mapped to HeroUI colors with toneColor()). */
/** Unit domain: hotel rooms sold by the night, or residence units leased by the month. */
export type RatesInventoryDomain = "hospitality" | "residence";

/** State of one physical room on the room-type tiles (artifact codes i, c, d, o, v, x, s). */
export type RatesInventoryRoomStatus =
  | "inspected"
  | "toInspect"
  | "dirty"
  | "occupied"
  | "stayoverDue"
  | "outOfOrder"
  | "outOfService";

export interface RatesInventoryRoom {
  number: string;
  status: RatesInventoryRoomStatus;
}

/** A sellable room type (Room types tab). The room count is `rooms.length`. */
export interface RatesInventoryRoomType {
  id: string;
  name: string;
  domain: RatesInventoryDomain;
  beds: string;
  bedsLong: string;
  capacity: string;
  size: string;
  range: string;
  /** Best available rate, RWF per room per night. */
  barFrom: number;
  amenities: string;
  rooms: RatesInventoryRoom[];
  history: string;
}

/** One line of a scheduled rate change: current value and value from the draft's effective date. */
export interface RatesInventoryRateLine {
  label: string;
  current: string;
  next: string;
}

export interface RatesInventoryPlanVersion {
  title: string;
  detail: string;
  status: "success" | "default";
}

/** A rate change that was scheduled (or sent to the owner) with its audit note. */
export interface RatesInventoryPendingChange {
  note: string;
  from: string;
  to: string | null;
  by: string;
  at: string;
}

/** A rate plan (Rate plans tab) with its draft change. Dates of the draft are ISO yyyy-mm-dd; `null` = open-ended. */
export interface RatesInventoryRatePlan {
  id: string;
  name: string;
  code: string;
  version: string;
  basis: string;
  effective: string;
  stay: string;
  mealPlan: string;
  status: string;
  statusTone: Tone;
  closedDays: string;
  cancellation: string;
  taxClassification: string;
  channels: string[];
  draftVersion: string;
  draftFrom: string;
  draftTo: string | null;
  lineHead: string;
  lines: RatesInventoryRateLine[];
  /** Negotiated rates: the owner approves changes before they take effect. */
  needsOwnerApproval: boolean;
  draftNote: string;
  pendingChange: RatesInventoryPendingChange | null;
  history: RatesInventoryPlanVersion[];
}

export type RatesInventorySpaceDayState = "booked" | "free" | "hold" | "clash";

export interface RatesInventorySpaceDay {
  date: string;
  state: RatesInventorySpaceDayState;
}

/** An event space (Spaces tab). Never counts toward room occupancy. */
export interface RatesInventorySpace {
  id: string;
  name: string;
  kind: string;
  photo: StockKey;
  layouts: string;
  prices: string;
  catering: string;
  soldBy: string;
  week: RatesInventorySpaceDay[];
  warning: { title: string; description: string } | null;
}

/** An amenity and the room types (ids) that include it (Amenities tab). */
export interface RatesInventoryAmenity {
  id: string;
  name: string;
  group: string;
  roomTypeIds: string[];
  onListing: boolean;
}

/** A meal plan (Meal plans tab). `null` fields render as "—". */
export interface RatesInventoryMealPlan {
  id: string;
  name: string;
  code: string;
  includes: string;
  supplementPerGuest: number | null;
  servedBy: string | null;
  taxClassification: string | null;
  usedBy: string;
}

/** One night of the 14-night availability window (index 0 is today, Sun 12 Oct 2026). */
export interface AvailabilityCalendarNight {
  id: string;
  /** Position in the window, 0–13. */
  index: number;
  weekday: string;
  day: number;
  month: string;
  year: number;
  isWeekend: boolean;
  isToday: boolean;
  /** Channel-manager push for this night. */
  sync: "ok" | "queued" | "failed";
}

/** The window of nights the calendar shows, with its heading as the board writes it. */
export interface AvailabilityCalendarWindow {
  id: string;
  label: string;
  nights: number;
}

/** A rate plan the grid can show, and how its nightly price derives from the room type's rates. */
export interface AvailabilityCalendarRatePlan {
  id: string;
  label: string;
  /** "bar": derived from the best available rate; "corporate": the room type's negotiated rate. */
  basis: "bar" | "corporate";
  /** Multiplier on BAR, rounded to the nearest 1,000 (Non-refundable). */
  factor?: number;
  /** RWF added per night on top of BAR (Bed & Breakfast for 2 guests). */
  supplement?: number;
  /** First night index on which the plan is closed to sale. */
  closedFrom?: number;
}

/** A value that applies to one night of the window. */
export interface AvailabilityCalendarNightValue {
  night: number;
  value: number;
}

/** A room type row: inventory, rates and restrictions per night. */
export interface AvailabilityCalendarRoomType {
  id: string;
  name: string;
  rooms: number;
  /** Best available rate, RWF per room per night. */
  bar: number;
  /** Corporate Umurage rate; 0 when the room type is not sold on that plan. */
  corporate: number;
  /** Rooms sold per night, nights 0–13. */
  sold: number[];
  /** Rooms of this type held by the group block on the block's nights. */
  blockRooms: number;
  /** One room is out of order on nights before this index. */
  outOfOrderUntil: number;
  minStay: AvailabilityCalendarNightValue[];
  priceOverrides: AvailabilityCalendarNightValue[];
  /** Price changes awaiting approval. */
  pendingPrices: AvailabilityCalendarNightValue[];
  stopSell: number[];
  /** Closed to arrival. */
  noArrival: number[];
}

export interface AvailabilityCalendarGroupBlock {
  id: string;
  label: string;
  firstNight: number;
  nights: number;
  board: BoardId;
}

export interface AvailabilityCalendarIssue {
  id: string;
  tone: Tone;
  icon: IconName;
  title: string;
  description: string;
  actions: { label: string; board: BoardId; variant: "primary" | "secondary" }[];
}

export interface AvailabilityCalendarChannel {
  id: string;
  name: string;
  detail: string;
  status: string;
  tone: Tone;
  /** A failed push the manager can retry, and how the channel reads once the retry is sent. */
  retry?: { detail: string; status: string; tone: Tone };
}

export interface AvailabilityCalendarHold {
  id: string;
  icon: IconName;
  title: string;
  detail: string;
  board: BoardId;
}

/** Reasons a manager can record with a price or restriction change. */
export interface AvailabilityCalendarReason {
  id: string;
  label: string;
}

/** How marketplace and direct-booking guests book: straight away, or by request the hotel accepts. */
export type ListingBookingMode = "instant" | "request";

/** The marketplace listing being edited (one document): the draft fields plus the live version it replaces. */
export interface ListingDraft {
  id: string;
  property: string;
  title: string;
  titleMaxLength: number;
  description: string;
  propertyType: string;
  propertyTypes: string[];
  location: string;
  mode: ListingBookingMode;
  /** Publish check: the listing needs at least this many photos. */
  minPhotos: number;
  liveVersion: number;
  draftVersion: number;
  rating: number;
  reviews: number;
  /** Lowest nightly rate shown on the marketplace card (RWF). */
  fromRate: number;
  fromRoomType: string;
  cancellationChip: string;
  /** Request to book: how long the hotel has to reply, and what happens to the rooms meanwhile. */
  replyWithin: string;
  replyWithinOptions: string[];
  requestHold: string;
  requestHoldOptions: string[];
  /** Stamp of the history entry written when the draft is submitted for review. */
  submittedAt: string;
}

/** A listing photo. `image` is a key of `stock` in @injishi/data/media; `listed: false` is ready to upload. */
export interface ListingPhoto {
  id: string;
  caption: string;
  image: string;
  listed: boolean;
}

export interface ListingModeOption {
  id: ListingBookingMode;
  label: string;
  icon: IconName;
  desc: string;
  /** Tone of the mode chip on the marketplace card preview. */
  chipTone: Tone;
}

export interface ListingAmenity {
  id: string;
  label: string;
  shown: boolean;
}

export interface ListingPolicy {
  id: string;
  label: string;
  value: string;
}

/** A publish check. `rule: "photos"` is evaluated live against the photo count (see ListingDraft.minPhotos). */
export interface ListingCheck {
  id: string;
  title: string;
  evidence: string;
  passed: boolean;
  rule: "fixed" | "photos";
}

export interface ListingHistoryEntry {
  id: string;
  title: string;
  detail: string;
  status: "default" | "current" | "success" | "warning" | "danger" | "muted";
  icon: IconName;
}

/** Sale state of a package (On sale / Paused / Draft). */
export type PackagesStatus = "on-sale" | "paused" | "draft";

/** Who sells a package component: the hotel, its own outlet, a tenant outlet, a third party, or nobody yet. */
export type PackagesSellerKind = "hotel" | "outlet" | "tenant" | "third-party" | "none";

/** Notice the guest gives before arrival when cancelling a package. */
export type PackagesNoticeTierId = "over-7-days" | "2-7-days" | "under-48-h";

export interface PackagesNoticeTier {
  id: PackagesNoticeTierId;
  label: string;
}

/** One part of a package, sold by its own seller with its own tax treatment and refund terms. */
export interface PackagesComponent {
  id: string;
  name: string;
  seller: string;
  /** TIN, outlet or space under the seller name. */
  sellerDetail: string;
  sellerKind: PackagesSellerKind;
  tax: string;
  /** The tax treatment still has to be verified (agent or tenant sale, or no seller). */
  taxNeedsVerification: boolean;
  availability: string;
  availabilityTone: Tone;
  /** Price when bought on its own (RWF). */
  alone: number;
  /** Share of the package price (RWF): what this seller's fiscal receipt and revenue posting show. */
  share: number;
  /** Refund owed per notice tier (RWF); null while the component has no refund terms. */
  refunds: Record<PackagesNoticeTierId, number> | null;
  refundRule: string;
}

export interface PackagesFact {
  label: string;
  value: string;
}

export interface PackagesAlert {
  tone: "warning" | "danger";
  title: string;
  description: string;
}

export interface PackagesItem {
  id: string;
  icon: IconName;
  name: string;
  code: string;
  status: PackagesStatus;
  /** Package price (RWF). */
  price: number;
  per: string;
  summary: string;
  sold: string;
  alert: PackagesAlert | null;
  facts: PackagesFact[];
  discountFrom: string;
  components: PackagesComponent[];
}

/** A weekend of a package and the component that limits how many can still be sold. */
export interface PackagesWeekend {
  id: string;
  packageId: string;
  dates: string;
  reason: string;
  availability: string;
  tone: Tone;
}

/** Alert shown for a group block: status tone, Gravity icon and copy. */
export interface GroupsBanner {
  tone: Tone;
  icon: IconName;
  title: string;
  desc: string;
}

/** A room type in a block contract: contracted nightly rate (RWF), rooms held and rooms picked up. */
export interface GroupsRoomType {
  id: string;
  name: string;
  rate: number;
  held: number;
  picked: number;
}

/** Rooms held and picked up on one night of a block. */
export interface GroupsNight {
  id: string;
  date: string;
  held: number;
  picked: number;
}

/** A rooming-list file received from the organiser or the agent. */
export interface GroupsRoomingFile {
  name: string;
  meta: string;
}

/** Rooming list of a block: due date, matching status, current file and rows that need fixing. */
export interface GroupsRooming {
  due: string;
  status: string;
  tone: Tone;
  file: GroupsRoomingFile | null;
  issues: { id: string; text: string }[];
  /** Next version, shown after "Upload new version" while its names are matched to bookings. */
  upload: (GroupsRoomingFile & { status: string; tone: Tone }) | null;
}

/** Cutoff workflow of a block still holding unsold rooms: extend the cutoff, or release unsold rooms once. */
export interface GroupsCutoffRelease {
  /** New cutoff offered by "Extend to …". */
  extendTo: string;
  extendedCutoff: string;
  extended: GroupsBanner;
  /** Banner after the release; its title counts the unsold rooms released each night. */
  released: Omit<GroupsBanner, "title"> & { nights: string; at: string };
}

/** Overbooking caused by unsold rooms held in the block, cleared by releasing one of them. */
export interface GroupsConflict {
  roomType: string;
  night: string;
  fixLabel: string;
  open: GroupsBanner;
  fixed: GroupsBanner;
}

/** A group block: rooms held for a group at a contracted rate (commercial.groupsBlocks). */
export interface GroupsBlock {
  id: string;
  name: string;
  dates: string;
  datesLong: string;
  rooms: number;
  status: string;
  tone: Tone;
  organiser: string;
  contact: string;
  phone: string;
  agent: string;
  payer: string;
  bill: { title: string; desc: string };
  deposit: string;
  depositStatus: string;
  depositTone: Tone;
  plan: string;
  cutoff: string;
  release: string;
  attrition: string;
  roomTypes: GroupsRoomType[];
  nights: GroupsNight[];
  pickupAsOf: string;
  banner: GroupsBanner;
  cutoffRelease: GroupsCutoffRelease | null;
  conflict: GroupsConflict | null;
  rooming: GroupsRooming;
}

/** Pipeline stage of a sales and events lead (artifact: one kanban column). */
export type SalesEventsStageId = "new" | "qualified" | "proposal" | "contract" | "closed";

/**
 * Which state of the event plan a record belongs to: shown in both, only while the Kivu Hall
 * collision is open, or only once the set-up has been moved to 17:30.
 */
export type SalesEventsScenario = "always" | "collision" | "resolved";

export interface SalesEventsStage {
  id: SalesEventsStageId;
  /** Column title on the pipeline. */
  title: string;
  /** Column indicator colour. */
  tone: Tone;
  /** Stage chip on the lead detail. */
  label: string;
  labelTone: Tone;
  /** Stage chip for a lost lead (closed column only). */
  lostLabel?: string;
  lostTone?: Tone;
}

export interface SalesEventsLead {
  id: string;
  stage: SalesEventsStageId;
  name: string;
  org: string;
  type: string;
  date: string;
  pax: number;
  /** Quote or estimated value in RWF. */
  value: number;
  /** Win probability in percent. */
  prob: number;
  space: string;
  /** First name of the sales owner. */
  owner: string;
  source: string;
  next: string;
  chip?: string;
  tone?: Tone;
  lost?: boolean;
  /** Empty-state title and note when the lead has no live event plan. */
  planTitle?: string;
  planNote?: string;
  /** The lead has a live event plan (space holds, BEO, quote, deposits and handoff). */
  hasEventPlan?: boolean;
  /** Lead card overrides once the space collision is resolved. */
  whenResolved?: { chip: string; tone: Tone; next: string };
  /** Lead overrides once the contract is sent. */
  whenSent?: { stage: SalesEventsStageId; chip: string; tone: Tone; stageLabel: string };
}

export interface SalesEventsSpace {
  id: string;
  lead: string;
  name: string;
  cap: string;
  /** Key of the stock photo in @injishi/data/media. */
  photo: string;
  /** Hours (24h, decimals for half hours) of the double booking while the collision is open. */
  clash?: { start: number; end: number };
}

export interface SalesEventsSpaceBooking {
  id: string;
  space: string;
  kind: "contracted" | "tentative" | "turnaround";
  label: string;
  /** Start and end hour on the 08:00–24:00 day. */
  start: number;
  end: number;
  scenario: SalesEventsScenario;
  /** Lead that holds the space under contract (another event). */
  holder?: string;
}

export interface SalesEventsTiming {
  id: string;
  lead: string;
  time: string;
  what: string;
  where: string;
  scenario: SalesEventsScenario;
  /** The timing collides with another booking (shown in the danger colour). */
  collides?: boolean;
}

export interface SalesEventsBeoFigure {
  id: string;
  lead: string;
  label: string;
  value: string;
  resolvedValue?: string;
}

export interface SalesEventsBeoNote {
  id: string;
  lead: string;
  label: string;
  value: string;
}

export interface SalesEventsQuoteLine {
  id: string;
  lead: string;
  item: string;
  note: string;
  /** Id of the legal seller (commercial.salesEventsSellers). */
  seller: string;
  qty: number;
  /** Unit price in RWF. */
  price: number;
  scenario: SalesEventsScenario;
}

export interface SalesEventsSeller {
  id: string;
  /** Short seller name in the quote table. */
  short: string;
  tone: Tone;
  icon: IconName;
  name: string;
  tin: string;
  what: string;
  whatResolved?: string;
  how: string;
}

export interface SalesEventsDeposit {
  id: string;
  lead: string;
  label: string;
  /** Share of the hotel portion; omitted for the balance (the remainder). */
  share?: number;
  due: string;
  status: string;
  tone: Tone;
  /** Overrides once the contract and deposit request are sent. */
  whenSent?: { due: string; status: string; tone: Tone };
}

export interface SalesEventsHandoffStep {
  id: string;
  lead: string;
  label: string;
  sentLabel?: string;
  status: "complete" | "active" | "inactive";
}

/** Forecast scenario of the 30-night revenue plan. */
export type RevenueScenarioId = "base" | "conference";

/** A planning scenario (header segment, scenario comparison). */
export interface RevenueScenario {
  id: RevenueScenarioId;
  label: string;
  /** Lower-case name used in captions ("scenario: base"). */
  name: string;
  /** Average daily rate the scenario assumes, RWF. */
  adr: number;
}

/** One of the next 30 nights, with what is recorded for it (forecast chart, night detail). */
export interface RevenueNight {
  id: string;
  weekday: string;
  day: number;
  month: string;
  /** Rooms available that night. */
  rooms: number;
  /** Occupancy on the books today, percent (recorded). */
  onTheBooks: number;
  /** Last year actual occupancy on the same weekday, percent. */
  lastYear: number;
}

/** Model DF-2.3 forecast occupancy for one night in one scenario, percent, with its 80% range. */
export interface RevenueForecast {
  id: string;
  night: string;
  scenario: RevenueScenarioId;
  value: number;
  low: number;
  high: number;
}

/** A group block, enquiry or event on the books for some nights. */
export interface RevenueEvent {
  id: string;
  /** Shown in the night detail. */
  label: string;
  firstNight: string;
  lastNight: string;
  /** Shading on the forecast chart (null = not shaded). */
  tone: Tone | null;
  /** Only in this scenario (null = every scenario). */
  scenario: RevenueScenarioId | null;
}

/** On the books vs the same date last year, per week (pace card). */
export interface RevenuePaceWeek {
  id: string;
  label: string;
  nights: number;
  onTheBooks: number;
  lastYear: number;
}

/** A rate recommendation with its evidence and the manager's decision. */
export interface RevenueRecommendation {
  id: string;
  dates: string;
  room: string;
  /** Current rate, RWF. */
  current: number;
  /** Recommended rate, RWF. */
  recommended: number;
  reason: string;
  confidence: string;
  confidenceTone: Tone;
  confidenceNote: string;
  /** Only shown, and never sendable, in this scenario (null = a live recommendation). */
  scenario: RevenueScenarioId | null;
  /** What the model recommends instead in the conference-week scenario. */
  conference?: { recommended: number; reason: string };
  /** "pending" = sent to the owner for approval. */
  status: "open" | "pending";
  sentNote?: string;
  override?: { rate: number; reason: string; note: string };
}
