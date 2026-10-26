import type { StockKey } from "../media.ts";
import type { FixtureSet, IconName } from "../types.ts";

/**
 * Embedded-database fixtures for the "operations" area: Loyalty, Distribution (Channels),
 * Housekeeping board, Maintenance, Lost and found, and Outlets and services.
 * Collection names are "operations.<thing>"; every document has a stable string `id`.
 * Values are lifted verbatim from the artifact boards (node tools/artifact/extract.mjs <Board>).
 */

export type Tone = "accent" | "success" | "warning" | "danger" | "default" | "info";

/** One dated line of a history (timeline marker tone + what happened + who/when). */
export interface HistoryEvent {
  what: string;
  who: string;
  tone: Tone | "current";
}

// ── Loyalty ──────────────────────────────────────────────────────────────────

/** Programme-level figures (one document). `pointValue` is null until Finance sets one. */
export interface LoyaltyProgramme {
  id: string;
  name: string;
  operator: string;
  earnsAt: string;
  members: number;
  consented: number;
  activeTwelveMonths: number;
  pointsOutstanding: number;
  month: string;
  earnedThisMonth: number;
  redeemedThisMonth: number;
  redemptionsThisMonth: number;
  approvedAboveLimit: number;
  pointValue: number | null;
  transactionsToday: number;
}

export interface LoyaltyTier {
  id: string;
  name: string;
  /** Chart colour index (1–5) of the tier medal. */
  chart: number;
  multiplier: number;
  members: number;
  qualify: string;
  benefits: string;
}

export type LoyaltyTierName = "Gold" | "Silver" | "Circle" | "Pending";

export interface LoyaltyMember {
  id: string;
  name: string;
  initials: string;
  /** Account number, or "Not enrolled". */
  account: string;
  tier: LoyaltyTierName;
  points: number;
  lastActivity: string;
  programmeConsent: boolean;
  marketing: boolean;
  consent: string;
  marketingDetail: string;
  stay: string;
  /** Already booked in the top room category (no upgrade possible). */
  topCategory?: boolean;
}

/** A guest the desk can enrol now (shown in the enrol dialog). */
export interface LoyaltyCandidate {
  id: string;
  name: string;
  initials: string;
  booking: string;
  arrival: string;
  phone: string;
  newAccount: string;
  stay: string;
}

export type LoyaltyTxType = "Earn" | "Redeem" | "Reverse" | "Adjust";

export interface LoyaltyTransaction {
  id: string;
  when: string;
  member: string;
  type: LoyaltyTxType;
  source: string;
  /** Signed points (negative for redemptions and reversals). */
  points: number;
  by: string;
  note: string;
}

export interface LoyaltyLiability {
  id: string;
  title: string;
  description: string;
  rows: { label: string; points: number }[];
  footLabel: string;
  /** null → "Not configured". */
  footPoints: number | null;
}

// ── Distribution (Channels) ──────────────────────────────────────────────────

export interface ChannelMapping {
  /** Room type or rate plan (counted separately as "Rooms mapped" and "Rates mapped"). */
  kind: "room" | "rate";
  ours: string;
  theirs: string;
  mapped: boolean;
}

export interface Channel {
  id: string;
  name: string;
  via: string;
  connection: string;
  tone: Tone;
  roomsMapped: string;
  ratesMapped: string;
  lastOut: string;
  lastIn: string;
  fee: string;
  canStopSell: boolean;
  note: string;
  mapping: ChannelMapping[];
}

export type SyncStatus = "ok" | "failed" | "unknown" | "dup";

export interface ChannelSyncEntry {
  id: string;
  time: string;
  channel: string;
  type: string;
  detail: string;
  attempts: string;
  status: SyncStatus;
}

export interface ChannelSource {
  id: string;
  /** Booked straight with the hotel (booking page, walk-in, phone): counts toward direct share. */
  direct: boolean;
  source: string;
  bookings: number;
  revenue: number;
  conversion: string;
  cancelled: number;
  /** null when the fee terms are not approved. */
  fee: number | null;
  feeNote: string;
}

/** Channel manager connection and the direct booking page of a property (one document). */
export interface DistributionSettings {
  id: string;
  property: string;
  adapter: string;
  connectedSince: string;
  agreement: string;
  duplicates: string;
  retryPolicy: string;
  heartbeat: string;
  lastTest: string;
  bookingUrl: string;
  seller: string;
  payment: string;
  cancellation: string;
}

// ── Housekeeping ─────────────────────────────────────────────────────────────

export type RoomStatus = "inspected" | "clean" | "dirty" | "occupied" | "ooo";

export interface HousekeepingRoom {
  id: string;
  floor: number;
  type: "Standard Queen" | "Twin" | "Deluxe Lake View" | "Family Suite";
  status: RoomStatus;
  note: string;
  /** Front-desk hold shown with the room context. */
  hold?: string;
}

/** Recorded status history of one room (id = room number). */
export interface RoomHistory {
  id: string;
  events: HistoryEvent[];
}

/** Typical latest events for a room in a status, when no specific history is recorded (id = status). */
export interface RoomStatusHistory {
  id: RoomStatus;
  events: HistoryEvent[];
}

export type TaskColumn = "todo" | "doing" | "clean" | "insp";

export interface CleaningTask {
  id: string;
  room: string;
  kind: "Checkout" | "Stayover" | "Deep clean" | "Turndown" | "Re-clean";
  column: TaskColumn;
  assignee: string | null;
  due: string;
  minutes?: number;
  priority?: string;
  priorityTone?: Tone;
  /** Created by a rule (not by hand). */
  auto: boolean;
}

export interface HousekeepingStaff {
  id: string;
  /** Housekeepers take cleaning tasks; the supervisor runs inspections. */
  role: "housekeeper" | "supervisor";
  name: string;
  initials: string;
  area: string;
  shiftEnd: string;
  minutesLeft: number;
  tone: Tone;
}

export interface HousekeepingEscalation {
  id: string;
  task: string;
  action: "reassign" | "remind";
  text: string;
  cta: string;
  doneCta?: string;
}

export interface HousekeepingRule {
  id: string;
  icon: IconName;
  kind: string;
  when: string;
}

// ── Maintenance ──────────────────────────────────────────────────────────────

export type Severity = "Critical" | "High" | "Normal" | "Low";
export type BlockState = "active" | "requested" | "declined" | "na" | "none";

export interface WorkOrderPart {
  name: string;
  qty: string;
  source: string;
  state: string;
  tone: Tone;
}

export interface WorkOrderPhoto {
  caption: string;
  image: StockKey;
}

export interface BlockOutcome {
  blockText: string;
  blockEffect: string;
  event: HistoryEvent;
}

export interface WorkOrder {
  id: string;
  asset: string;
  area: string;
  title: string;
  issue: string;
  severity: Severity;
  owner: string | null;
  /** Who "Assign to …" proposes when nobody owns it yet. */
  suggestedOwner?: string;
  status: string;
  block: BlockState;
  blockText: string;
  blockEffect: string;
  reported: string;
  photos: WorkOrderPhoto[];
  parts: WorkOrderPart[];
  timeline: HistoryEvent[];
  /** Last timeline line while a decision or assignment is pending. */
  pending?: HistoryEvent;
  /** Outcomes of the manager's decision on a requested block. */
  decision?: { approved: BlockOutcome; declined: BlockOutcome };
  releaseNote: string;
}

export interface ConditionSignal {
  id: string;
  rule: string;
  asset: string;
  headline: string;
  confidence: "High" | "Medium" | "Low";
  tone: Tone;
  evidence: string[];
  dataQuality: string;
  recommendation: string;
  ruleText: string;
  /** Work order drafted when the manager acts on the signal. */
  draft?: WorkOrder;
}

export interface SignalReview {
  id: string;
  outcome: string;
  tone: Tone;
  what: string;
  note: string;
}

// ── Lost and found ───────────────────────────────────────────────────────────

export type FoundItemStatus = "claim" | "stored" | "returned" | "disposal" | "disposed";

export interface FoundItem {
  id: string;
  item: string;
  category: string;
  valuable: boolean;
  where: string;
  when: string;
  foundBy: string;
  custodian: string;
  storage: string;
  status: FoundItemStatus;
  custody: HistoryEvent[];
  retention?: string;
  closedNote?: string;
  claim?: {
    claimant: string;
    booking: string;
    /** The claimant's booking matches the room and dates where the item was found. */
    matched: boolean;
    match: string;
    statement: string;
  };
  disposal?: { note: string; rule: string };
}

export interface RegisterAccess {
  id: string;
  name: string;
  role: string;
}

// ── Outlets and services ─────────────────────────────────────────────────────

export interface Outlet {
  id: string;
  name: string;
  kind: string;
  relation: string;
  tone: Tone;
  /** Charge to room is possible only for the hotel's own outlets. */
  chargeAllowed: boolean;
  chargeToRoom: boolean;
  facts: { label: string; value: string }[];
}

export interface DepartmentGroup {
  id: string;
  group: string;
  items: { name: string; detail: string; tone: Tone | null }[];
}

export interface MenuItem {
  name: string;
  modifiers: string;
  price: number;
  tax: string;
  stock: string;
  status: string;
  tone: Tone;
  /** Changes waiting in the draft version. */
  draft?: { price?: number; status?: string; tone?: Tone };
}

export interface OutletMenu {
  id: string;
  outlet: string;
  name: string;
  sub: string;
  version: string;
  readOnly: boolean;
  draft?: {
    title: string;
    description: string;
    action: string;
    sub: string;
    version: string;
  };
  items: MenuItem[];
}

export interface OutletOrder {
  id: string;
  icon: IconName;
  source: string;
  outlet: string;
  place: string;
  items: string;
  status: string;
  tone: Tone;
  age: string;
  settlement: string;
  settleTone: Tone | null;
}

export interface OutletOrderLoad {
  id: string;
  label: string;
  value: number;
  unit: string;
  foot: string;
}

export interface OutletOffer {
  id: string;
  name: string;
  outlet: string;
  valid: string;
  eligibility: string;
  redeemed: number;
  status: string;
  tone: Tone;
  note: string;
  redemptions: { id: string; who: string; meta: string; value: number; status: string; tone: Tone }[];
  empty?: string;
}

// ═════════════════════════════════════════════════════════════════════════════
// Data
// ═════════════════════════════════════════════════════════════════════════════

const loyaltyProgramme: LoyaltyProgramme[] = [
  {
    id: "amahoro-circle",
    name: "Amahoro Circle",
    operator: "Amahoro Hospitality Ltd",
    earnsAt: "Isangano and Ishyamba",
    members: 1284,
    consented: 1190,
    activeTwelveMonths: 642,
    pointsOutstanding: 3912400,
    month: "October",
    earnedThisMonth: 286500,
    redeemedThisMonth: 74000,
    redemptionsThisMonth: 31,
    approvedAboveLimit: 2,
    pointValue: null,
    transactionsToday: 7,
  },
];

const loyaltyTiers: LoyaltyTier[] = [
  {
    id: "circle",
    name: "Circle",
    chart: 5,
    multiplier: 1,
    members: 1046,
    qualify: "On enrolment",
    benefits: "Earn and redeem points · member rate on the direct booking page",
  },
  {
    id: "silver",
    name: "Silver",
    chart: 3,
    multiplier: 1.25,
    members: 186,
    qualify: "5 stays or 10,000 points in 12 months",
    benefits: "Late checkout to 13:00 · welcome drink at Lake Bar",
  },
  {
    id: "gold",
    name: "Gold",
    chart: 1,
    multiplier: 1.5,
    members: 52,
    qualify: "12 stays or 30,000 points in 12 months",
    benefits: "Late checkout to 14:00 · upgrade on arrival when free · welcome drink",
  },
];

const loyaltyMembers: LoyaltyMember[] = [
  {
    id: "sk",
    name: "Sarah Kimani",
    initials: "SK",
    account: "AC-10021",
    tier: "Gold",
    points: 34250,
    lastActivity: "Arrives today · BK-20431",
    programmeConsent: true,
    marketing: false,
    consent: "Accepted v2 on 3 Mar 2025 in the guest app",
    marketingDetail: "Off · opted out 2 Jun 2026",
    stay: "BK-20431 · Deluxe Lake View · 12–14 Oct",
  },
  {
    id: "do",
    name: "Daniel Okafor",
    initials: "DO",
    account: "AC-10087",
    tier: "Gold",
    points: 41900,
    lastActivity: "Redeemed 9 Oct",
    programmeConsent: true,
    marketing: true,
    consent: "Accepted v2 on 11 Jan 2026 at the desk",
    marketingDetail: "On · SMS and email",
    stay: "Arrives today · BK-20440 · Family Suite",
    topCategory: true,
  },
  {
    id: "tw",
    name: "Thomas Weber",
    initials: "TW",
    account: "AC-10112",
    tier: "Silver",
    points: 12480,
    lastActivity: "Earned 10 Oct",
    programmeConsent: true,
    marketing: true,
    consent: "Accepted v2 on 20 Aug 2025 online",
    marketingDetail: "On · email only",
    stay: "Arrives today · BK-20433 · Twin",
  },
  {
    id: "jb",
    name: "Jean Bosco Nkurunziza",
    initials: "JN",
    account: "AC-10140",
    tier: "Silver",
    points: 9870,
    lastActivity: "Earned 11 Oct",
    programmeConsent: true,
    marketing: false,
    consent: "Accepted v1 on 2 Feb 2025 at the desk",
    marketingDetail: "Off",
    stay: "In-house · room 305 · corporate rate, room not eligible",
  },
  {
    id: "yt",
    name: "Yuki Tanaka",
    initials: "YT",
    account: "AC-10233",
    tier: "Circle",
    points: 2140,
    lastActivity: "Reversal 12 Oct",
    programmeConsent: true,
    marketing: false,
    consent: "Accepted v2 on 9 Sep 2026 at the desk",
    marketingDetail: "Off",
    stay: "BK-20418 · Volcano view group · 14–16 Oct",
  },
  {
    id: "mc",
    name: "Marie Claire Uwimana",
    initials: "MU",
    account: "AC-10301",
    tier: "Circle",
    points: 1320,
    lastActivity: "Adjusted 10 Oct",
    programmeConsent: true,
    marketing: false,
    consent: "Accepted v2 on 1 Oct 2026 at the desk",
    marketingDetail: "Off",
    stay: "In-house · room 310 · departs today",
  },
  {
    id: "ga",
    name: "Grace Achieng",
    initials: "GA",
    account: "Not enrolled",
    tier: "Pending",
    points: 0,
    lastActivity: "Invited 11 Oct",
    programmeConsent: false,
    marketing: false,
    consent: "Not given · invitation sent 11 Oct",
    marketingDetail: "Off",
    stay: "EAC Health Forum · arrives 23 Oct",
  },
];

const loyaltyCandidates: LoyaltyCandidate[] = [
  {
    id: "am",
    name: "Aisha Mohammed",
    initials: "AM",
    booking: "BK-20437",
    arrival: "arriving today",
    phone: "+250 788 ••• 412",
    newAccount: "AC-10342",
    stay: "Arrives today · BK-20437 · Deluxe Lake View",
  },
];

const loyaltyTransactions: LoyaltyTransaction[] = [
  {
    id: "T-88231",
    when: "12 Oct, 08:10",
    member: "Daniel Okafor",
    type: "Earn",
    source: "F-5512 settled",
    points: 1240,
    by: "System",
    note: "RWF 1,240,000 eligible spend · payment Verified, GT Bank ref GTB26101207",
  },
  {
    id: "T-88230",
    when: "12 Oct, 07:55",
    member: "Yuki Tanaka",
    type: "Reverse",
    source: "BK-20418",
    points: -1120,
    by: "System",
    note: "Two rooms cancelled · reverses T-88213 of 10 Oct, which is kept",
  },
  {
    id: "T-88224",
    when: "11 Oct, 21:30",
    member: "Sarah Kimani",
    type: "Redeem",
    source: "Isangano Terrace 4471",
    points: -6000,
    by: "Eric Habimana",
    note: "Dinner for two · member confirmed by SMS code",
  },
  {
    id: "T-88219",
    when: "11 Oct, 18:02",
    member: "Jean Bosco Nkurunziza",
    type: "Earn",
    source: "F-5508 settled",
    points: 86,
    by: "System",
    note: "Personal bar and restaurant charges only · corporate room rate excluded",
  },
  {
    id: "T-88214",
    when: "10 Oct, 14:15",
    member: "Marie Claire Uwimana",
    type: "Adjust",
    source: "Goodwill",
    points: 500,
    by: "Aline Uwase",
    note: "Noise from works on floor 3 · within manager limit of 2,000",
  },
  {
    id: "T-88213",
    when: "10 Oct, 09:40",
    member: "Yuki Tanaka",
    type: "Earn",
    source: "BK-20418 deposit",
    points: 1120,
    by: "System",
    note: "Deposit Verified, MTN MoMo ref MP260921.0915.A11842",
  },
  {
    id: "T-88205",
    when: "9 Oct, 16:20",
    member: "Daniel Okafor",
    type: "Redeem",
    source: "BK-20460",
    points: -30000,
    by: "Aline Uwase",
    note: "Free night 2 Nov · above 20,000, approved by Aline Uwase",
  },
];

const loyaltyLiability: LoyaltyLiability[] = [
  {
    id: "tier",
    title: "By Tier",
    description: "Points outstanding per tier",
    rows: [
      { label: "Circle · 1,046 members", points: 1402600 },
      { label: "Silver · 186 members", points: 1284300 },
      { label: "Gold · 52 members", points: 1225500 },
    ],
    footLabel: "Total points",
    footPoints: 3912400,
  },
  {
    id: "age",
    title: "By Age",
    description: "When the points were earned",
    rows: [
      { label: "0–6 months", points: 1860200 },
      { label: "6–12 months", points: 1124900 },
      { label: "12–24 months", points: 927300 },
    ],
    footLabel: "Expiring in the next 90 days",
    footPoints: 214600,
  },
  {
    id: "where",
    title: "By Where Earned",
    description: "Both run by Amahoro Hospitality Ltd",
    rows: [
      { label: "Isangano Lakeside Hotel", points: 2948100 },
      { label: "Ishyamba Forest Lodge", points: 964300 },
    ],
    footLabel: "Monetary valuation",
    footPoints: null,
  },
];

const RATE_PLANS = new Set(["Flexible rate", "Bed and breakfast", "Non-refundable"]);
const kindOf = (ours: string): ChannelMapping["kind"] => (RATE_PLANS.has(ours) ? "rate" : "room");
const mapped = (ours: string, theirs: string): ChannelMapping => ({ kind: kindOf(ours), ours, theirs, mapped: true });
const unmapped = (ours: string, why: string): ChannelMapping => ({
  kind: kindOf(ours),
  ours,
  theirs: why,
  mapped: false,
});

const channels: Channel[] = [
  {
    id: "bdc",
    name: "Booking.com",
    via: "Via channel manager",
    connection: "Reservations failing",
    tone: "danger",
    roomsMapped: "4 of 4",
    ratesMapped: "2 of 3",
    lastOut: "09:38",
    lastIn: "05:12",
    fee: "15%",
    canStopSell: true,
    note: "Rates, availability and restrictions go out normally. Reservations in have failed since 05:12, and the Non-refundable plan is not mapped, so its rate pushes are rejected.",
    mapping: [
      mapped("Standard Queen", "Queen Room"),
      mapped("Twin", "Twin Room"),
      mapped("Deluxe Lake View", "Deluxe Double Room with Lake View"),
      mapped("Family Suite", "Family Suite"),
      mapped("Flexible rate", "Standard Rate"),
      mapped("Bed and breakfast", "Breakfast Included"),
      unmapped("Non-refundable", "No matching rate plan on the channel"),
    ],
  },
  {
    id: "exp",
    name: "Expedia",
    via: "Via channel manager",
    connection: "Mapping incomplete",
    tone: "warning",
    roomsMapped: "3 of 4",
    ratesMapped: "3 of 3",
    lastOut: "09:36",
    lastIn: "09:36",
    fee: "18%",
    canStopSell: true,
    note: "Family Suite is not mapped, so it is not offered on Expedia. One availability push is unconfirmed.",
    mapping: [
      mapped("Standard Queen", "Standard Queen Room"),
      mapped("Twin", "Standard Twin Room"),
      mapped("Deluxe Lake View", "Deluxe Room, Lake View"),
      unmapped("Family Suite", "Room type not created on the channel"),
      mapped("Flexible rate", "Refundable"),
      mapped("Bed and breakfast", "Breakfast for 2"),
      mapped("Non-refundable", "Non-refundable"),
    ],
  },
  {
    id: "mkt",
    name: "Injishi Marketplace",
    via: "Native · same inventory",
    connection: "Connected",
    tone: "success",
    roomsMapped: "4 of 4",
    ratesMapped: "3 of 3",
    lastOut: "09:41",
    lastIn: "09:41",
    fee: "Not set",
    canStopSell: true,
    note: "Marketplace bookings are created as normal Injishi reservations, never as a parallel booking. Listing approved 2 Sep; fee terms for the marketplace are not approved yet.",
    mapping: [],
  },
  {
    id: "aht",
    name: "Akagera Horizon Travel",
    via: "Agent allotment · no API",
    connection: "Manual",
    tone: "default",
    roomsMapped: "6-room allotment",
    ratesMapped: "Contract rate",
    lastOut: "n/a",
    lastIn: "email 11 Oct",
    fee: "10%",
    canStopSell: false,
    note: "The agent books by email against a 6-room allotment that releases 14 days before arrival. The front desk enters each booking; commission is payable through Finance.",
    mapping: [],
  },
  {
    id: "abb",
    name: "Airbnb",
    via: "Via channel manager",
    connection: "Not connected",
    tone: "default",
    roomsMapped: "—",
    ratesMapped: "—",
    lastOut: "—",
    lastIn: "—",
    fee: "Per agreement",
    canStopSell: false,
    note: "Not connected. Connecting needs a signed channel agreement and the owner’s approval of the commission.",
    mapping: [],
  },
];

const channelSyncLog: ChannelSyncEntry[] = [
  {
    id: "g1",
    time: "09:43",
    channel: "bdc",
    type: "Reservations in",
    detail: "Pull rejected by the channel manager: access token expired. Last success 05:12.",
    attempts: "6 of 12",
    status: "failed",
  },
  {
    id: "g2",
    time: "09:41",
    channel: "mkt",
    type: "Availability out",
    detail: "Deluxe Lake View, 24–26 Oct → 1 room left",
    attempts: "1",
    status: "ok",
  },
  {
    id: "g3",
    time: "09:40",
    channel: "bdc",
    type: "Rate out",
    detail: "Non-refundable, 13 Oct – 11 Nov: rate plan not mapped on the channel",
    attempts: "3 of 12",
    status: "failed",
  },
  {
    id: "g4",
    time: "09:38",
    channel: "bdc",
    type: "Availability out",
    detail: "All room types, 13 Oct – 11 Nov",
    attempts: "1",
    status: "ok",
  },
  {
    id: "g5",
    time: "09:36",
    channel: "exp",
    type: "Reservation in",
    detail: "Grace Achieng · Twin · 18–20 Oct → created BK-20457",
    attempts: "1",
    status: "ok",
  },
  {
    id: "g6",
    time: "09:12",
    channel: "exp",
    type: "Availability out",
    detail: "Standard Queen, 17 Oct: no reply within 30 seconds",
    attempts: "2 of 12",
    status: "unknown",
  },
  {
    id: "g7",
    time: "08:55",
    channel: "mkt",
    type: "Cancellation in",
    detail: "Pierre Laurent cancelled BK-20439 → 1 room released; any refund follows Flexible v3 in Payments",
    attempts: "1",
    status: "ok",
  },
  {
    id: "g8",
    time: "05:12",
    channel: "bdc",
    type: "Reservation in",
    detail: "Second notice for BK-20452 with the same channel reference → ignored, no duplicate created",
    attempts: "1",
    status: "dup",
  },
];

const channelSources: ChannelSource[] = [
  {
    id: "direct",
    direct: true,
    source: "Direct booking page",
    bookings: 46,
    revenue: 14200000,
    conversion: "3.8% of 1,212 visits",
    cancelled: 4,
    fee: 142000,
    feeNote: "MoMo collection fees",
  },
  {
    id: "mkt",
    direct: false,
    source: "Injishi Marketplace",
    bookings: 21,
    revenue: 6100000,
    conversion: "2.1% of 1,004 views",
    cancelled: 2,
    fee: null,
    feeNote: "Fee terms not approved",
  },
  {
    id: "bdc",
    direct: false,
    source: "Booking.com",
    bookings: 58,
    revenue: 16900000,
    conversion: "Not shared by channel",
    cancelled: 9,
    fee: 2535000,
    feeNote: "15% commission",
  },
  {
    id: "exp",
    direct: false,
    source: "Expedia",
    bookings: 17,
    revenue: 5600000,
    conversion: "Not shared by channel",
    cancelled: 3,
    fee: 1008000,
    feeNote: "18% commission",
  },
  {
    id: "aht",
    direct: false,
    source: "Akagera Horizon Travel",
    bookings: 9,
    revenue: 3400000,
    conversion: "n/a",
    cancelled: 0,
    fee: 340000,
    feeNote: "10% commission",
  },
  {
    id: "walkin",
    direct: true,
    source: "Walk-in and phone",
    bookings: 17,
    revenue: 3100000,
    conversion: "n/a",
    cancelled: 1,
    fee: 0,
    feeNote: "none",
  },
];

const distributionSettings: DistributionSettings[] = [
  {
    id: "isangano",
    property: "Isangano Lakeside Hotel",
    adapter: "Distribution adapter v2.1 · two-way",
    connectedSince: "2 Sep 2026 · pilot",
    agreement: "Needs verification",
    duplicates: "Ignored by channel reference",
    retryPolicy: "Every 5 min, 12 attempts, then a manager task",
    heartbeat: "09:41",
    lastTest: "Last test 2 Sep, passed",
    bookingUrl: "book.injishi.rw/isangano-lakeside",
    seller: "Amahoro Hospitality Ltd · TIN 102 345 678",
    payment: "30% deposit by MTN MoMo or Airtel Money · card in sandbox only",
    cancellation: "Flexible v3 · free until 48 h before arrival",
  },
];

// Room types follow the floor plan: floors 1–3 are Standard Queen (01–06), Twin (07–10) and
// Deluxe Lake View (11–12); floor 4 has Family Suites at 401 and 404 and Deluxe Lake View elsewhere.
const roomType = (n: number): HousekeepingRoom["type"] => {
  const floor = Math.floor(n / 100);
  const unit = n % 100;
  if (floor === 4) return unit === 1 || unit === 4 ? "Family Suite" : "Deluxe Lake View";
  return unit <= 6 ? "Standard Queen" : unit <= 10 ? "Twin" : "Deluxe Lake View";
};
const room = (n: number, status: RoomStatus, note: string, hold?: string): HousekeepingRoom => ({
  id: String(n),
  floor: Math.floor(n / 100),
  type: roomType(n),
  status,
  note,
  ...(hold ? { hold } : {}),
});

const housekeepingRooms: HousekeepingRoom[] = [
  room(101, "occupied", "In house"),
  room(102, "clean", "Wait insp."),
  room(103, "inspected", "Ready"),
  room(104, "inspected", "Ready"),
  room(105, "dirty", "Cleaning"),
  room(106, "occupied", "In house"),
  room(107, "occupied", "Dep 14 Oct"),
  room(108, "dirty", "Checkout"),
  room(109, "occupied", "In house"),
  room(110, "occupied", "DND"),
  room(111, "occupied", "In house"),
  room(112, "ooo", "WO-318"),
  room(201, "inspected", "Ready"),
  room(202, "occupied", "In house"),
  room(203, "occupied", "Serviced"),
  room(204, "dirty", "Arr 14:00", "Sarah Kimani arrives at 14:00; the front desk is holding this room for her."),
  room(205, "occupied", "In house"),
  room(206, "occupied", "Stayover"),
  room(207, "clean", "Wait 2h30"),
  room(208, "inspected", "Arr 15:30"),
  room(209, "dirty", "Deep clean"),
  room(210, "occupied", "In house"),
  room(211, "dirty", "Checkout"),
  room(212, "inspected", "Ready"),
  room(301, "occupied", "In house"),
  room(302, "dirty", "Unassigned"),
  room(303, "occupied", "In house"),
  room(304, "inspected", "Ready"),
  room(305, "occupied", "In house"),
  room(306, "occupied", "In house"),
  room(307, "occupied", "Cleaning"),
  room(308, "occupied", "In house"),
  room(309, "clean", "Wait insp."),
  room(310, "dirty", "Checkout"),
  room(311, "inspected", "Ready"),
  room(312, "inspected", "Ready"),
  room(401, "occupied", "VIP"),
  room(402, "ooo", "WO-321"),
  room(403, "clean", "Wait insp."),
  room(404, "occupied", "In house"),
  room(405, "dirty", "Arr 16:00"),
  room(406, "inspected", "Arr 16:00"),
];

const ev = (what: string, who: string, tone: HistoryEvent["tone"] = "default"): HistoryEvent => ({ what, who, tone });

const roomHistory: RoomHistory[] = [
  {
    id: "204",
    events: [
      ev("Escalated to Aline Uwase", "System · 12:15 · overdue 15 min", "danger"),
      ev("Escalated to Beatrice Mukandori", "System · 12:05 · not started", "warning"),
      ev("Checkout task assigned to Jeanne Nyiraneza", "Rule “Floor 2” · 09:42"),
      ev("Occupied → Dirty", "Eric Habimana checked the guest out · 09:41"),
    ],
  },
  {
    id: "207",
    events: [
      ev("Waiting for inspection 2 h 30 min", "System · 12:20 · escalated to you", "danger"),
      ev("Inspection task for Beatrice Mukandori", "Rule “Inspect after checkout” · 09:51"),
      ev("Dirty → Clean", "Jeanne Nyiraneza, staff app · 09:50", "success"),
      ev("Occupied → Dirty", "Eric Habimana checked the guest out · 08:12"),
    ],
  },
  {
    id: "112",
    events: [
      ev("Out of order until 14 Oct, 12:00", "Aline Uwase approved block WO-318 · 11 Oct 10:31", "danger"),
      ev("Fault reported with 2 photos", "Jeanne Nyiraneza · leak under the basin · 11 Oct 10:12", "warning"),
      ev("Clean → Inspected", "Beatrice Mukandori · 11 Oct 08:30", "success"),
    ],
  },
];

const roomStatusHistory: RoomStatusHistory[] = [
  {
    id: "inspected",
    events: [
      ev("Clean → Inspected", "Beatrice Mukandori · 11:05", "success"),
      ev("Dirty → Clean", "Housekeeper, staff app · 10:30"),
    ],
  },
  {
    id: "clean",
    events: [
      ev("Dirty → Clean", "Housekeeper, staff app · 11:40", "success"),
      ev("Occupied → Dirty", "Front desk checkout · 09:20"),
    ],
  },
  {
    id: "dirty",
    events: [
      ev("Occupied → Dirty", "Front desk checkout · 10:05", "warning"),
      ev("Checked in", "Front desk · 10 Oct 15:12"),
    ],
  },
  {
    id: "occupied",
    events: [
      ev("Stayover service done", "Housekeeper, staff app · 10:15", "success"),
      ev("Inspected → Occupied", "Front desk check-in · 10 Oct"),
    ],
  },
  {
    id: "ooo",
    events: [
      ev("Out of order until 16 Oct", "Aline Uwase approved block WO-321 · 10 Oct", "danger"),
      ev("Repaint after damp patch", "Jean-Paul Niyonsaba · 9 Oct", "warning"),
    ],
  },
];

const cleaningTasks: CleaningTask[] = [
  {
    id: "t204",
    room: "204",
    kind: "Checkout",
    column: "todo",
    assignee: "jn",
    due: "Due 12:00 · arrival 14:00",
    minutes: 45,
    priority: "Overdue",
    priorityTone: "danger",
    auto: true,
  },
  {
    id: "t211",
    room: "211",
    kind: "Checkout",
    column: "todo",
    assignee: "jn",
    due: "Due 13:00 · remove extra bed",
    minutes: 45,
    priority: "High",
    priorityTone: "warning",
    auto: true,
  },
  {
    id: "t302",
    room: "302",
    kind: "Checkout",
    column: "todo",
    assignee: null,
    due: "Due 14:00 · window latch, WO-324",
    minutes: 45,
    auto: true,
  },
  {
    id: "t108",
    room: "108",
    kind: "Checkout",
    column: "todo",
    assignee: "vm",
    due: "Due 13:30",
    minutes: 40,
    auto: true,
  },
  {
    id: "t310",
    room: "310",
    kind: "Checkout",
    column: "todo",
    assignee: "en",
    due: "Due 14:00",
    minutes: 40,
    auto: true,
  },
  {
    id: "t405",
    room: "405",
    kind: "Checkout",
    column: "todo",
    assignee: "ou",
    due: "Due 14:00 · arrival 16:00",
    minutes: 60,
    auto: true,
  },
  {
    id: "t206",
    room: "206",
    kind: "Stayover",
    column: "todo",
    assignee: "jn",
    due: "Do not disturb lifted 11:00",
    minutes: 20,
    auto: true,
  },
  {
    id: "t209",
    room: "209",
    kind: "Deep clean",
    column: "todo",
    assignee: "jn",
    due: "By 15:00 · curtains, mattress turn",
    minutes: 90,
    auto: false,
  },
  {
    id: "t401",
    room: "401",
    kind: "Turndown",
    column: "todo",
    assignee: "ou",
    due: "17:00 – 19:00 · suite, VIP",
    minutes: 15,
    auto: true,
  },
  {
    id: "t105",
    room: "105",
    kind: "Checkout",
    column: "doing",
    assignee: "vm",
    due: "Started 11:52 · due 12:30",
    minutes: 20,
    auto: true,
  },
  {
    id: "t307",
    room: "307",
    kind: "Stayover",
    column: "doing",
    assignee: "en",
    due: "Started 12:05",
    minutes: 10,
    auto: true,
  },
  {
    id: "t207",
    room: "207",
    kind: "Checkout",
    column: "clean",
    assignee: "jn",
    due: "Cleaned 09:50 · waiting 2 h 30",
    priority: "Overdue",
    priorityTone: "danger",
    auto: true,
  },
  { id: "t102", room: "102", kind: "Checkout", column: "clean", assignee: "vm", due: "Cleaned 11:15", auto: true },
  { id: "t309", room: "309", kind: "Checkout", column: "clean", assignee: "en", due: "Cleaned 11:40", auto: true },
  { id: "t403", room: "403", kind: "Checkout", column: "clean", assignee: "ou", due: "Cleaned 12:02", auto: true },
  {
    id: "t201",
    room: "201",
    kind: "Checkout",
    column: "insp",
    assignee: "jn",
    due: "Passed 08:40 · Beatrice Mukandori",
    auto: true,
  },
  {
    id: "t304",
    room: "304",
    kind: "Checkout",
    column: "insp",
    assignee: "en",
    due: "Passed 10:20 · Beatrice Mukandori",
    auto: true,
  },
  {
    id: "t406",
    room: "406",
    kind: "Checkout",
    column: "insp",
    assignee: "ou",
    due: "Passed 11:05 · Beatrice Mukandori",
    auto: true,
  },
];

const housekeepingStaff: HousekeepingStaff[] = [
  {
    id: "jn",
    role: "housekeeper",
    name: "Jeanne Nyiraneza",
    initials: "JN",
    area: "Floor 2",
    shiftEnd: "15:00",
    minutesLeft: 160,
    tone: "accent",
  },
  {
    id: "vm",
    role: "housekeeper",
    name: "Vestine Mukarugwiza",
    initials: "VM",
    area: "Floor 1",
    shiftEnd: "15:00",
    minutesLeft: 160,
    tone: "success",
  },
  {
    id: "en",
    role: "housekeeper",
    name: "Emmanuel Nsengimana",
    initials: "EN",
    area: "Floor 3",
    shiftEnd: "15:00",
    minutesLeft: 160,
    tone: "warning",
  },
  {
    id: "ou",
    role: "housekeeper",
    name: "Odette Uwamahoro",
    initials: "OU",
    area: "Floor 4, public areas",
    shiftEnd: "19:00",
    minutesLeft: 400,
    tone: "default",
  },
  {
    id: "bm",
    role: "supervisor",
    name: "Beatrice Mukandori",
    initials: "BM",
    area: "Floors 1–4",
    shiftEnd: "15:00",
    minutesLeft: 160,
    tone: "accent",
  },
];

const housekeepingEscalations: HousekeepingEscalation[] = [
  {
    id: "esc-204",
    task: "t204",
    action: "reassign",
    text: "Room 204 checkout was due at 12:00 and has not started. Jeanne Nyiraneza has 200 minutes of work left and 160 minutes of shift. Sarah Kimani arrives at 14:00.",
    cta: "Reassign 204",
  },
  {
    id: "esc-207",
    task: "t207",
    action: "remind",
    text: "Room 207 has waited 2 h 30 min for inspection after Jeanne cleaned it at 09:50.",
    cta: "Remind Beatrice to inspect 207",
    doneCta: "Beatrice reminded",
  },
];

const housekeepingRules: HousekeepingRule[] = [
  {
    id: "checkout",
    icon: "ArrowRightFromSquare",
    kind: "Checkout clean",
    when: "When the front desk checks a guest out",
  },
  {
    id: "stayover",
    icon: "Sun",
    kind: "Stayover service",
    when: "Daily at 07:00 for occupied rooms, after do-not-disturb lifts",
  },
  {
    id: "inspection",
    icon: "CheckDouble",
    kind: "Inspection",
    when: "After every checkout clean, for the floor supervisor",
  },
  { id: "turndown", icon: "Moon", kind: "Turndown", when: "At 17:00 for suites and guests flagged VIP" },
  { id: "deep", icon: "Bucket", kind: "Deep clean", when: "Every 30 days per room, or added by hand" },
];

const JP = "Jean-Paul Niyonsaba";
const part = (name: string, qty: string, source: string, state: string, tone: Tone = "default"): WorkOrderPart => ({
  name,
  qty,
  source,
  state,
  tone,
});

const workOrders: WorkOrder[] = [
  {
    id: "WO-318",
    asset: "Room 112",
    area: "Deluxe Lake View · Floor 1",
    title: "Basin leak",
    issue: "Leak under the bathroom basin, water on the floor",
    severity: "Critical",
    owner: JP,
    status: "In progress",
    block: "active",
    blockText: "11 Oct 14:00 → 14 Oct 12:00 · 3 room-nights",
    blockEffect:
      "Removed from sale at 10:32 on 11 Oct: front desk, booking page and every channel (Booking.com confirmed 10:33). No reservations were affected.",
    reported: "Jeanne Nyiraneza · staff app · 11 Oct 10:12",
    photos: [
      { caption: "Basin trap leaking", image: "leakUnderBasin" },
      { caption: "Water on the floor", image: "wetFloorSign" },
      { caption: "Cabinet base swollen", image: "cabinetHinge" },
    ],
    parts: [
      part("Basin waste trap, 32 mm", "1", "Store · issued by Patrick Nshimiyimana", "Issued"),
      part("Flexible connector, ½ inch", "2", "Store · issued by Patrick Nshimiyimana", "Issued"),
      part("Cabinet base board", "1", "PO-26-0147 · due 13 Oct", "Ordered", "warning"),
    ],
    timeline: [
      ev("Reported with 3 photos", "Jeanne Nyiraneza · 11 Oct 10:12", "warning"),
      ev(`Assigned to ${JP}`, "Beatrice Mukandori · 10:20"),
      ev("Block approved, room off sale", "Aline Uwase · 10:31", "danger"),
      ev("Parts issued from store", "Patrick Nshimiyimana · 14:05"),
      ev("Work started", `${JP} · 12 Oct 08:30`, "current"),
      ev("Next: 24-hour leak test, then housekeeping inspection", "Release only after both"),
    ],
    releaseNote: "Release needs the repair closed and a passed housekeeping inspection.",
  },
  {
    id: "WO-324",
    asset: "Room 302",
    area: "Standard Queen · Floor 3",
    title: "Window latch",
    issue: "Window latch broken, the window cannot be locked",
    severity: "High",
    owner: JP,
    status: "Waiting for parts",
    block: "requested",
    blockText: "Requested for 12–13 Oct",
    blockEffect:
      "Room 302 is still on sale. Approving removes it from sale for 12–13 Oct on every channel. No reservations would be moved.",
    reported: "Eric Habimana, front desk · guest complaint · 12 Oct 07:55",
    photos: [{ caption: "Broken latch", image: "windowLatch" }],
    parts: [
      part(
        "Window latch, aluminium frame",
        "1",
        "Not in store · purchase request sent to Patrick Nshimiyimana",
        "Requested",
        "warning",
      ),
    ],
    timeline: [
      ev("Reported by the front desk", "Eric Habimana · 07:55", "warning"),
      ev(`Assigned to ${JP}`, "Beatrice Mukandori · 08:05"),
      ev("Block requested for 12–13 Oct", `${JP} · 09:10`, "current"),
    ],
    pending: ev("Waiting for your decision", "Blocks need a manager’s approval"),
    decision: {
      approved: {
        blockText: "12 Oct 12:20 → 14 Oct 12:00 · 2 room-nights",
        blockEffect:
          "Removed from sale on every channel at 12:20. The checkout clean continues; the room is not offered until the latch is fixed.",
        event: ev("Block approved, room off sale", "Aline Uwase · 12:20", "danger"),
      },
      declined: {
        blockText: "Declined · room stays on sale",
        blockEffect: "Declined by Aline Uwase at 12:20: sell only with the latch fixed before check-in.",
        event: ev("Block declined", "Aline Uwase · 12:20"),
      },
    },
    releaseNote: "Nothing to release: the room is not blocked.",
  },
  {
    id: "WO-326",
    asset: "Lake Bar",
    area: "Ice machine",
    title: "Ice machine leak",
    issue: "Ice machine leaking onto the bar floor",
    severity: "High",
    owner: null,
    suggestedOwner: JP,
    status: "Open",
    block: "na",
    blockText: "Not a room",
    blockEffect: "Outlet equipment. Lake Bar keeps trading; Joseph Habimana has put a wet-floor sign out.",
    reported: "Joseph Habimana · Lake Bar · 12 Oct 11:30",
    photos: [
      { caption: "Base of the machine", image: "wetFloorSign" },
      { caption: "Water on bar floor", image: "wetFloorSign" },
    ],
    parts: [],
    timeline: [ev("Reported with 2 photos", "Joseph Habimana · 11:30", "warning")],
    pending: ev("Not assigned yet", "High severity: due within 4 hours", "danger"),
    releaseNote: "",
  },
  {
    id: "WO-325",
    asset: "Kivu Hall",
    area: "Projector",
    title: "Projector flicker",
    issue: "Projector image flickers after 20 minutes of use",
    severity: "Normal",
    owner: JP,
    status: "Waiting for parts",
    block: "na",
    blockText: "Event space · needed 23 Oct",
    blockEffect: "Kivu Hall stays bookable. Needed for the EAC Health Forum from 23 Oct.",
    reported: "Aline Uwase · from a condition signal · 9 Oct",
    photos: [{ caption: "Lamp hours on menu", image: "ceilingProjector" }],
    parts: [part("Projector lamp", "1", "PO-26-0144 · due 20 Oct", "Ordered", "warning")],
    timeline: [
      ev("Created from signal “Lamp near end of life”", "Aline Uwase · 9 Oct", "current"),
      ev("Lamp ordered", "Patrick Nshimiyimana · 10 Oct"),
    ],
    releaseNote: "",
  },
  {
    id: "WO-321",
    asset: "Room 402",
    area: "Deluxe Lake View · Floor 4",
    title: "Repaint",
    issue: "Repaint ceiling after a damp patch",
    severity: "Normal",
    owner: "Kivu Paint Works",
    status: "Scheduled",
    block: "active",
    blockText: "10 Oct → 16 Oct 12:00 · 6 room-nights",
    blockEffect: "Off sale on every channel since 10 Oct, 09:00.",
    reported: `${JP} · 9 Oct`,
    photos: [{ caption: "Ceiling damp patch", image: "ceilingDampPatch" }],
    parts: [part("Paint and sealant", "1 lot", "Supplied by the contractor", "Contractor")],
    timeline: [
      ev("Reported", `${JP} · 9 Oct`, "warning"),
      ev("Block approved", "Aline Uwase · 9 Oct", "danger"),
      ev("Contractor booked for 14–15 Oct", "Aline Uwase · 10 Oct", "current"),
    ],
    releaseNote: "Release after the contractor signs off and housekeeping inspects.",
  },
  {
    id: "WO-327",
    asset: "Generator",
    area: "Plant room",
    title: "Monthly service",
    issue: "Monthly generator service",
    severity: "Low",
    owner: "Rubavu Power Services",
    status: "Scheduled 15 Oct",
    block: "none",
    blockText: "None",
    blockEffect: "Planned maintenance. Power cut-over test 10:00–10:20; front desk informed.",
    reported: "Planned schedule",
    photos: [{ caption: "Service sheet", image: "standbyGenerator" }],
    parts: [],
    timeline: [ev("Created from the maintenance plan", "Every 30 days", "current")],
    releaseNote: "",
  },
  {
    id: "WO-319",
    asset: "Room 209",
    area: "Twin · Floor 2",
    title: "Wardrobe hinge",
    issue: "Wardrobe door hinge loose",
    severity: "Low",
    owner: JP,
    status: "Done · verified",
    block: "none",
    blockText: "None",
    blockEffect: "No block was needed.",
    reported: "Jeanne Nyiraneza · 10 Oct",
    photos: [{ caption: "Hinge after repair", image: "cabinetHinge" }],
    parts: [part("Hinge screws", "4", "Store", "Issued")],
    timeline: [
      ev("Reported", "Jeanne Nyiraneza · 10 Oct", "warning"),
      ev("Fixed", `${JP} · 11 Oct 09:15`, "success"),
      ev("Verified", "Beatrice Mukandori · 11 Oct 10:00", "success"),
    ],
    releaseNote: "",
  },
];

const conditionSignals: ConditionSignal[] = [
  {
    id: "s1",
    rule: "AC-02",
    asset: "Room 305 · air conditioner",
    headline: "Runtime up 40% over 30 days",
    confidence: "Medium",
    tone: "default",
    evidence: [
      "Daily compressor runtime rose from 6.1 h to 8.5 h (room energy meter, 12 Sep – 11 Oct)",
      "3 tickets in 60 days: WO-288 (12 Aug), WO-301 (9 Sep), WO-316 (4 Oct), each “not cooling”, filter cleaned each time",
      "Other Floor 3 rooms changed by less than 5% over the same period",
    ],
    dataQuality: "Meter offline 2–4 Oct; those 3 days are interpolated and marked in the source data.",
    recommendation: "Inspect the compressor and refrigerant charge within 7 days. The room is occupied until 15 Oct.",
    ruleText: "Rule AC-02 v1: runtime +30% in 30 days and 2+ tickets in 60 days",
    draft: {
      id: "WO-328",
      asset: "Room 305",
      area: "Standard Queen · Floor 3",
      title: "AC compressor check",
      issue: "Inspect compressor and refrigerant charge (from condition signal)",
      severity: "Normal",
      owner: null,
      suggestedOwner: JP,
      status: "Draft",
      block: "none",
      blockText: "None · room occupied to 15 Oct",
      blockEffect: "No block. A block can be requested if the inspection finds a fault.",
      reported: "Aline Uwase · from signal AC-02 · 12 Oct 12:20",
      photos: [],
      parts: [],
      timeline: [ev("Draft created from a condition signal", "Aline Uwase · 12:20 · evidence attached", "current")],
      releaseNote: "",
    },
  },
  {
    id: "s2",
    rule: "WH-01",
    asset: "Floor 3 water heater B",
    headline: "Reheat time up 25% in 14 days",
    confidence: "Low",
    tone: "warning",
    evidence: [
      "Time to reheat after the 07:00 peak went from 48 to 60 minutes",
      "2 “lukewarm shower” requests this week, rooms 307 and 311",
    ],
    dataQuality: "Only 14 days of sensor history since installation; too short for a reliable trend.",
    recommendation: "Check the heating element and thermostat at the next routine visit.",
    ruleText: "Rule WH-01 v1: reheat time +20% in 14 days",
    draft: {
      id: "WO-329",
      asset: "Water heater B",
      area: "Floor 3 · plant cupboard",
      title: "Heating element check",
      issue: "Check the heating element and thermostat (from condition signal)",
      severity: "Low",
      owner: null,
      suggestedOwner: JP,
      status: "Draft",
      block: "na",
      blockText: "Not a room",
      blockEffect: "Hot water stays on. The check is planned for the next routine visit; no room is affected.",
      reported: "Aline Uwase · from signal WH-01 · 12 Oct 12:20",
      photos: [],
      parts: [],
      timeline: [ev("Draft created from a condition signal", "Aline Uwase · 12:20 · evidence attached", "current")],
      releaseNote: "",
    },
  },
];

const signalReviews: SignalReview[] = [
  {
    id: "r1",
    outcome: "Work order",
    tone: "accent",
    what: "Kivu Hall projector lamp at 2,860 of 3,000 hours",
    note: "WO-325 created by Aline Uwase, 9 Oct",
  },
  {
    id: "r2",
    outcome: "Dismissed",
    tone: "default",
    what: "Lift motor vibration above threshold",
    note: "Jean-Paul Niyonsaba, 8 Oct: sensor fault, recalibrated after service",
  },
];

const BM = "Beatrice Mukandori";

const foundItems: FoundItem[] = [
  {
    id: "LF-26-041",
    item: "Black phone, blue case, cracked corner",
    category: "Electronics",
    valuable: true,
    where: "Room 204 · bedside drawer",
    when: "12 Oct 10:05",
    foundBy: "Jeanne Nyiraneza",
    custodian: BM,
    storage: "Safe A · shelf 1 · bag B-2291",
    status: "claim",
    custody: [
      ev("Found in Room 204, bedside drawer", "Jeanne Nyiraneza · 10:05 · 2 photos"),
      ev(`Handed to ${BM}, sealed in bag B-2291`, "Both confirmed in the staff app · 10:12"),
      ev("Stored in Safe A, shelf 1", `${BM} · 10:30`),
      ev("Claim opened: guest called from Kigali", "Eric Habimana · 11:48", "current"),
    ],
    claim: {
      claimant: "Daniel Okafor",
      booking: "BK-20437",
      matched: true,
      match:
        "Daniel Okafor · BK-20437 · stay ST-8812 · Room 204, 9–12 Oct. Room and dates match where the item was found.",
      statement: "Claimant: “black phone, blue case, cracked top-left corner, beach photo on the lock screen”",
    },
  },
  {
    id: "LF-26-040",
    item: "Gold-coloured ring",
    category: "Jewellery",
    valuable: true,
    where: "Isangano Terrace · table 7",
    when: "11 Oct 21:40",
    foundBy: "Claudine Mukamana",
    custodian: "Eric Habimana",
    storage: "Safe A · shelf 1 · bag B-2288",
    status: "stored",
    custody: [
      ev("Found at Isangano Terrace, table 7", "Claudine Mukamana · 11 Oct 21:40"),
      ev("Handed to the night desk, sealed in bag B-2288", "Eric Habimana · 21:55"),
      ev("Stored in Safe A, shelf 1", "Eric Habimana · 22:05", "current"),
    ],
    retention:
      "Valuable: held in Safe A until 9 Jan 2027. The Terrace bookings for 11 Oct are being checked for a match.",
  },
  {
    id: "LF-26-039",
    item: "Child’s blue rain jacket",
    category: "Clothing",
    valuable: false,
    where: "Lake Bar · terrace",
    when: "10 Oct 18:10",
    foundBy: "Joseph Habimana",
    custodian: BM,
    storage: "Store room L-2 · bin 4",
    status: "stored",
    custody: [
      ev("Found on the Lake Bar terrace", "Joseph Habimana · 10 Oct 18:10"),
      ev("Stored in store room L-2, bin 4", `${BM} · 11 Oct 08:00`, "current"),
    ],
    retention: "Held until 8 Jan 2027, then donated with two-person sign-off.",
  },
  {
    id: "LF-26-037",
    item: "Laptop charger, 65 W",
    category: "Electronics",
    valuable: false,
    where: "Kivu Hall · row C",
    when: "7 Oct 17:30",
    foundBy: "Jean-Paul Niyonsaba",
    custodian: BM,
    storage: "Store room L-2 · bin 1",
    status: "stored",
    custody: [
      ev("Found in Kivu Hall after a workshop", "Jean-Paul Niyonsaba · 7 Oct 17:30"),
      ev("Stored in store room L-2, bin 1", `${BM} · 8 Oct 08:10`, "current"),
    ],
    retention: "Held until 5 Jan 2027. The workshop organiser has been emailed.",
  },
  {
    id: "LF-26-033",
    item: "Sunglasses in a brown case",
    category: "Accessories",
    valuable: false,
    where: "Room 311 · balcony",
    when: "5 Oct 11:20",
    foundBy: "Emmanuel Nsengimana",
    custodian: "None",
    storage: "Returned 9 Oct",
    status: "returned",
    custody: [
      ev("Found on the Room 311 balcony", "Emmanuel Nsengimana · 5 Oct 11:20"),
      ev("Stored in store room L-2, bin 2", `${BM} · 5 Oct 12:00`),
      ev("Returned to Yuki Tanaka in person", "Passport checked by Eric Habimana · 9 Oct 16:40", "success"),
    ],
    closedNote:
      "Returned to Yuki Tanaka (BK-20391, Room 311, 2–5 Oct) in person on 9 Oct. Passport checked by Eric Habimana; signature captured.",
  },
  {
    id: "LF-26-021",
    item: "Umbrella and paperback book",
    category: "Other",
    valuable: false,
    where: "Lobby · seating area",
    when: "13 Jul 09:00",
    foundBy: "Eric Habimana",
    custodian: BM,
    storage: "Store room L-2 · bin 7",
    status: "disposal",
    custody: [
      ev("Found in the lobby seating area", "Eric Habimana · 13 Jul 09:00"),
      ev("Stored in store room L-2, bin 7", `${BM} · 13 Jul 10:00`),
      ev("Disposal proposed: donate to a local charity", `${BM} · 11 Oct 15:20`, "warning"),
    ],
    disposal: {
      note: "Held 91 days. Beatrice Mukandori proposed donating both items to a local charity on 11 Oct. Disposal is final, so a second person must approve.",
      rule: "90-day rule configured · unverified",
    },
  },
];

const lostFoundAccess: RegisterAccess[] = [
  { id: "au", name: "Aline Uwase", role: "manager, approvals" },
  { id: "bm", name: "Beatrice Mukandori", role: "supervisor, custodian" },
  { id: "eh", name: "Eric Habimana", role: "front desk, intake and claims" },
  { id: "dm", name: "Didier Mugenzi", role: "owner, read only" },
];

const HOTEL = "Amahoro Hospitality Ltd · TIN 102 345 678";
const fact = (label: string, value: string) => ({ label, value });

const outlets: Outlet[] = [
  {
    id: "terrace",
    name: "Isangano Terrace",
    kind: "Restaurant · 64 seats · room service kitchen",
    relation: "In-house",
    tone: "accent",
    chargeAllowed: true,
    chargeToRoom: true,
    facts: [
      fact("Merchant", HOTEL),
      fact("Fiscal device", "Hotel VSDC"),
      fact("Department", "Food & beverage › Restaurant"),
      fact("Hours", "06:30 – 22:30"),
      fact("Supervisor", "Joseph Habimana"),
      fact("Takes", "MTN MoMo, Airtel Money, cash · card in sandbox only"),
    ],
  },
  {
    id: "bar",
    name: "Lake Bar",
    kind: "Bar · 30 seats · lake terrace",
    relation: "In-house",
    tone: "accent",
    chargeAllowed: true,
    chargeToRoom: true,
    facts: [
      fact("Merchant", HOTEL),
      fact("Fiscal device", "Hotel VSDC"),
      fact("Department", "Food & beverage › Beverage"),
      fact("Hours", "11:00 – 00:00"),
      fact("Supervisor", "Joseph Habimana"),
      fact("Takes", "MTN MoMo, Airtel Money, cash · card in sandbox only"),
    ],
  },
  {
    id: "ikawa",
    name: "Ikawa Corner",
    kind: "Coffee shop · lobby unit",
    relation: "Tenant outlet",
    tone: "info",
    chargeAllowed: false,
    chargeToRoom: false,
    facts: [
      fact("Merchant", "Ikawa Corner Ltd · TIN 108 221 457"),
      fact("Fiscal device", "Ikawa Corner’s own EBM"),
      fact("Department", "None · rent counted as tenant income"),
      fact("Hours", "07:00 – 19:00"),
      fact("Run by", "Ikawa Corner staff"),
      fact("Takes", "Its own MoMo merchant code and till"),
    ],
  },
];

const departments: DepartmentGroup[] = [
  {
    id: "operated",
    group: "Operated departments",
    items: [
      { name: "Rooms", detail: "42 rooms", tone: "accent" },
      { name: "Food & beverage", detail: "Isangano Terrace, Lake Bar, banquets", tone: "accent" },
      { name: "Events", detail: "Kivu Hall, Garden Terrace hire", tone: "accent" },
    ],
  },
  {
    id: "undistributed",
    group: "Undistributed",
    items: [
      { name: "Administrative & general", detail: "", tone: null },
      { name: "Sales & marketing", detail: "", tone: null },
      { name: "Property operations & maintenance", detail: "", tone: null },
      { name: "Utilities", detail: "", tone: null },
    ],
  },
  {
    id: "tenant",
    group: "Tenant and rental income",
    items: [
      {
        name: "Ikawa Corner Ltd",
        detail: "fixed monthly rent, invoiced by Finance; its sales are not hotel revenue",
        tone: "info",
      },
    ],
  },
];

const item = (
  name: string,
  modifiers: string,
  price: number,
  tax: string,
  stock: string,
  status: string,
  tone: Tone = "default",
  draft?: MenuItem["draft"],
): MenuItem => ({ name, modifiers, price, tax, stock, status, tone, ...(draft ? { draft } : {}) });

const outletMenus: OutletMenu[] = [
  {
    id: "terrace",
    outlet: "Isangano Terrace",
    name: "Isangano Terrace · All-day menu",
    sub: "All-day · v7 live, v8 draft",
    version: "Version 7 · live since 1 Oct 2026 · published by Aline Uwase",
    readOnly: false,
    draft: {
      title: "Version 8 draft · 2 changes by Joseph Habimana",
      description:
        "Tilapia RWF 13,500 → 14,500 (fish cost up 9% on PO-26-0139). New item: vegetable curry. Version 7 stays live until you publish.",
      action: "Publish version 8",
      sub: "All-day · v8 live",
      version: "Version 8 · live since 12 Oct 12:20 · published by Aline Uwase",
    },
    items: [
      item(
        "Grilled Kivu tilapia, chips and kachumbari",
        "Side: chips, plantain or rice · spice level",
        13500,
        "Food · VAT standard",
        "Recipe R-112 · 6 portions of tilapia left",
        "Low stock",
        "warning",
        { price: 14500 },
      ),
      item(
        "Goat brochettes with fries",
        "Sauce: pili-pili or garlic",
        9000,
        "Food · VAT standard",
        "Recipe R-118",
        "Available",
      ),
      item("Isombe with rice", "None", 7500, "Food · VAT standard", "Recipe R-121", "Available"),
      item("Vegetable curry", "Spice level", 8000, "Food · VAT standard", "Recipe R-130", "In draft", "accent", {
        status: "Available",
        tone: "default",
      }),
      item(
        "Fresh passion juice",
        "Ice · no sugar",
        3000,
        "Beverage · VAT standard",
        "Stock: passion pulp, 4 L",
        "Available",
      ),
      item(
        "Local lager, 500 ml",
        "None",
        2500,
        "Beverage · VAT and excise",
        "Stock SKU-BR-500 · 46 bottles",
        "Available",
      ),
      item("Room service delivery", "Room service only", 2000, "Service charge", "n/a", "Available"),
    ],
  },
  {
    id: "bar",
    outlet: "Lake Bar",
    name: "Lake Bar · Drinks and bites",
    sub: "Drinks and bites · v4",
    version: "Version 4 · live since 15 Sep 2026",
    readOnly: false,
    items: [
      item("Cocktail of the day", "Spirit choice", 6000, "Beverage · VAT and excise", "Recipe R-201", "Available"),
      item(
        "Local lager, 500 ml",
        "None",
        2500,
        "Beverage · VAT and excise",
        "Stock SKU-BR-500 · 46 bottles",
        "Available",
      ),
      item("Soft drink, 330 ml", "Ice", 1500, "Beverage · VAT standard", "Stock SKU-SD-330 · 120 cans", "Available"),
      item("Brochette plate", "Sauce", 7000, "Food · VAT standard", "Recipe R-118 · from Terrace kitchen", "Available"),
    ],
  },
  {
    id: "room",
    outlet: "Room service",
    name: "Room service · 24 hours",
    sub: "24 hours · v3",
    version: "Version 3 · live since 1 Oct 2026 · items from Isangano Terrace",
    readOnly: false,
    items: [
      item(
        "Club sandwich and fries",
        "Bread: white or brown",
        9500,
        "Food · VAT standard",
        "Recipe R-140",
        "Available",
      ),
      item("Grilled Kivu tilapia", "Side", 13500, "Food · VAT standard", "Recipe R-112 · low", "Low stock", "warning"),
      item("Room service delivery", "Per order", 2000, "Service charge", "n/a", "Available"),
    ],
  },
  {
    id: "ikawa",
    outlet: "Ikawa Corner",
    name: "Ikawa Corner · Coffee",
    sub: "Tenant menu · read only",
    version: "Published by Ikawa Corner Ltd · read only",
    readOnly: true,
    items: [
      item("Espresso", "Single or double", 2000, "Set by Ikawa Corner", "Ikawa Corner stock", "Available"),
      item("Cappuccino", "Milk: dairy or oat", 3000, "Set by Ikawa Corner", "Ikawa Corner stock", "Available"),
      item("Banana bread", "None", 2500, "Set by Ikawa Corner", "Ikawa Corner stock", "Sold out"),
    ],
  },
];

const outletOrders: OutletOrder[] = [
  {
    id: "OR-7781",
    icon: "QrCode",
    source: "Guest app",
    outlet: "Isangano Terrace",
    place: "Room 305 · stay ST-8820",
    items: "2 × tilapia, 1 × passion juice",
    status: "Preparing",
    tone: "accent",
    age: "12 min",
    settlement: "Charge to room · folio F-5521 · authorised on active stay",
    settleTone: "accent",
  },
  {
    id: "OR-7782",
    icon: "QrCode",
    source: "Guest app",
    outlet: "Isangano Terrace",
    place: "Room 305",
    items: "Same as OR-7781, sent 4 s later",
    status: "Duplicate held",
    tone: "default",
    age: "12 min",
    settlement: "Not charged · guest confirmed one order only",
    settleTone: "info",
  },
  {
    id: "OR-7779",
    icon: "Display",
    source: "POS · Claudine Mukamana",
    outlet: "Isangano Terrace",
    place: "Table 4",
    items: "Isombe, 2 × brochettes, 3 × lager",
    status: "Ready",
    tone: "success",
    age: "18 min",
    settlement: "Open bill · not paid yet",
    settleTone: null,
  },
  {
    id: "OR-7784",
    icon: "Display",
    source: "POS · Lake Bar",
    outlet: "Lake Bar",
    place: "Bar seat 2",
    items: "2 × local lager",
    status: "Served",
    tone: "default",
    age: "6 min",
    settlement: "Verified · MTN MoMo · ref MP261012.1205.K22781 · 12:05",
    settleTone: "success",
  },
  {
    id: "OR-7770",
    icon: "Display",
    source: "POS · Lake Bar",
    outlet: "Lake Bar",
    place: "Table 9",
    items: "Cocktail of the day",
    status: "Served",
    tone: "default",
    age: "24 min",
    settlement: "Unknown · Airtel Money timed out, checking with provider",
    settleTone: "warning",
  },
  {
    id: "OR-7776",
    icon: "Bell",
    source: "Room service",
    outlet: "Isangano Terrace kitchen",
    place: "Room 401",
    items: "Club sandwich, soft drink",
    status: "Delivered 11:58",
    tone: "default",
    age: "41 min",
    settlement: "Posted once to folio F-5517 · fiscal receipt at checkout",
    settleTone: "accent",
  },
  {
    id: "OR-7785",
    icon: "QrCode",
    source: "Guest app",
    outlet: "Ikawa Corner",
    place: "Room 210 · pick up",
    items: "Cappuccino",
    status: "Accepted",
    tone: "accent",
    age: "3 min",
    settlement: "Pay at Ikawa Corner · charge to room not allowed",
    settleTone: null,
  },
  {
    id: "OR-7772",
    icon: "Display",
    source: "POS · Isangano Terrace",
    outlet: "Isangano Terrace",
    place: "Table 2",
    items: "1 × tilapia, voided",
    status: "Voided",
    tone: "danger",
    age: "52 min",
    settlement: "Void by Joseph Habimana · out of tilapia · stock returned",
    settleTone: "danger",
  },
];

const outletOrderLoad: OutletOrderLoad[] = [
  {
    id: "terrace",
    label: "Isangano Terrace",
    value: 7,
    unit: "open",
    foot: "Median ticket 14 min · 1 over 20 min",
  },
  { id: "bar", label: "Lake Bar", value: 3, unit: "open", foot: "1 payment unknown, being checked" },
  { id: "room", label: "Room service", value: 2, unit: "open", foot: "Median delivery 22 min" },
  {
    id: "ikawa",
    label: "Ikawa Corner",
    value: 1,
    unit: "guest-app order",
    foot: "You see guest-app orders only; Ikawa runs its own till",
  },
];

const outletOffers: OutletOffer[] = [
  {
    id: "O-14",
    name: "Sunset 2-for-1 cocktails",
    outlet: "Lake Bar",
    valid: "daily 17:00–19:00 to 31 Dec",
    eligibility: "In-house guests with an active stay",
    redeemed: 42,
    status: "Active",
    tone: "accent",
    note: "This month · checked against the active stay at the till",
    redemptions: [
      {
        id: "OR-7702",
        who: "Thomas Weber",
        meta: "ST-8807 · OR-7702 · 11 Oct 18:22 · Claudine Mukamana",
        value: 6000,
        status: "Redeemed",
        tone: "default",
      },
      {
        id: "OR-7698",
        who: "Fatuma Hassan",
        meta: "ST-8811 · OR-7698 · 11 Oct 17:48 · Claudine Mukamana",
        value: 6000,
        status: "Redeemed",
        tone: "default",
      },
      {
        id: "OR-7651",
        who: "Aisha Mohammed",
        meta: "ST-8803 · OR-7651 · 10 Oct 18:05 · 2 rounds",
        value: 12000,
        status: "Redeemed",
        tone: "default",
      },
      {
        id: "OR-7649",
        who: "Walk-in, no stay",
        meta: "OR-7649 · 10 Oct 17:40 · offer refused at the till",
        value: 0,
        status: "Not eligible",
        tone: "warning",
      },
    ],
  },
  {
    id: "O-12",
    name: "10% off dinner",
    outlet: "Isangano Terrace",
    valid: "Monday to Thursday",
    eligibility: "Loyalty members, Silver tier and above",
    redeemed: 18,
    status: "Active",
    tone: "accent",
    note: "Linked to the Loyalty programme; the discount is funded by the hotel",
    redemptions: [
      {
        id: "OR-7590",
        who: "Jean Bosco Nkurunziza · Gold",
        meta: "ST-8798 · OR-7590 · 9 Oct 20:10",
        value: 4200,
        status: "Redeemed",
        tone: "default",
      },
      {
        id: "OR-7611",
        who: "Daniel Okafor · Silver",
        meta: "ST-8812 · OR-7611 · 9 Oct 19:35",
        value: 3100,
        status: "Redeemed",
        tone: "default",
      },
    ],
  },
  {
    id: "O-09",
    name: "Birthday dessert",
    outlet: "Isangano Terrace",
    valid: "all year",
    eligibility: "Guests with a birthday during the stay, date of birth stored with consent",
    redeemed: 6,
    status: "Paused",
    tone: "warning",
    note: "Paused 2 Oct while the consent wording is reviewed",
    redemptions: [],
    empty: "No redemptions while paused. 6 earlier redemptions are kept in the audit log.",
  },
  {
    id: "O-15",
    name: "Welcome coffee",
    outlet: "Ikawa Corner",
    valid: "proposed",
    eligibility: "Guests arriving today",
    redeemed: 0,
    status: "Needs agreement",
    tone: "default",
    note: "The hotel cannot fund a sale by Ikawa Corner Ltd without a written cost-sharing agreement",
    redemptions: [],
    empty: "Cannot go live until Ikawa Corner Ltd and the owner sign a cost-sharing agreement.",
  },
];

export const fixtures = {
  "operations.loyaltyProgramme": loyaltyProgramme,
  "operations.loyaltyTiers": loyaltyTiers,
  "operations.loyaltyMembers": loyaltyMembers,
  "operations.loyaltyCandidates": loyaltyCandidates,
  "operations.loyaltyTransactions": loyaltyTransactions,
  "operations.loyaltyLiability": loyaltyLiability,
  "operations.channels": channels,
  "operations.channelSyncLog": channelSyncLog,
  "operations.channelSources": channelSources,
  "operations.distributionSettings": distributionSettings,
  "operations.rooms": housekeepingRooms,
  "operations.roomHistory": roomHistory,
  "operations.roomStatusHistory": roomStatusHistory,
  "operations.cleaningTasks": cleaningTasks,
  "operations.housekeepingStaff": housekeepingStaff,
  "operations.housekeepingEscalations": housekeepingEscalations,
  "operations.housekeepingRules": housekeepingRules,
  "operations.workOrders": workOrders,
  "operations.conditionSignals": conditionSignals,
  "operations.signalReviews": signalReviews,
  "operations.foundItems": foundItems,
  "operations.lostFoundAccess": lostFoundAccess,
  "operations.outlets": outlets,
  "operations.departments": departments,
  "operations.outletMenus": outletMenus,
  "operations.outletOrders": outletOrders,
  "operations.outletOrderLoad": outletOrderLoad,
  "operations.outletOffers": outletOffers,
} satisfies FixtureSet;
