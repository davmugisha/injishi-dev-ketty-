import type { FixtureSet, IconName } from "../types.ts";

/**
 * Embedded-database fixtures for the "outlets" area: the waiter's POS tablet (POS, POSPayment), the kitchen
 * display (KitchenDisplay), guest in-room ordering (QROrder) and the outlet supervisor's order board
 * (OutletOrders) at Isangano Terrace. Values are lifted verbatim from the artifact boards.
 * Plain data only (semantic tones, Gravity icon names, board ids) so the Expo app can read the same records.
 */

export type OutletTone = "accent" | "success" | "warning" | "danger" | "default" | "info";

/** Where an order came from: a table or bar seat, room service, or a guest's QR order. */
export type OrderSource = "table" | "room" | "qr";

// ── Menu (POS dinner menu and the room-service QR menu) ─────────────────────────

export interface MenuOption {
  id: string;
  label: string;
  /** Extra charge in RWF (0 = included). */
  price: number;
  /** How the choice reads in a line's modifiers ("pili pili sauce"). */
  short?: string;
}

export interface MenuOptionGroup {
  id: "side" | "spice" | "extras";
  label: string;
  /** Pick any number (extras) instead of exactly one. */
  multiple?: boolean;
  options: MenuOption[];
}

export interface MenuItem {
  id: string;
  name: string;
  /** Price in RWF, VAT included. */
  price: number;
  /** Portions left when stock is running low (shown as "4 left"). */
  portionsLeft?: number;
  soldOut?: boolean;
  diet?: string;
  /** One-line description on the guest QR menu. */
  guestNote?: string;
  /** Description in the POS options dialog. */
  description?: string;
  /** Long description on the guest item page. */
  guestDescription?: string;
  station?: string;
  optionGroups?: MenuOptionGroup[];
}

export interface MenuCategory {
  id: string;
  /** "dinner" = the POS dinner menu (v14), "room" = in-room dining on the QR menu. */
  menu: "dinner" | "room";
  label: string;
  /** Menu item ids, in menu order. */
  items: string[];
}

// ── POS · order entry ───────────────────────────────────────────────────────

export interface PosPlace {
  id: string;
  rail: "tables" | "rooms";
  /** Table or room number as shown on the rail ("T6", "204"). */
  no: string;
  status: string;
  meta: string;
  /** Status dot tone. */
  tone: OutletTone;
  /** Seats to split a ticket by (guests at the table, or its size when free). */
  seats: number;
  /** Open order number, when the place has one. */
  order?: string;
}

export type TicketLineStatus = "new" | "held" | "sent" | "fired" | "voidreq";

export interface TicketLine {
  id: string;
  /** PosPlace id. */
  place: string;
  /** Seat number, or "S" for shared. */
  seat: string;
  /** MenuItem id. */
  item: string;
  name: string;
  qty: number;
  /** Unit price in RWF, including chosen options. */
  price: number;
  mods: string;
  /** Allergy or kitchen note. */
  note?: string;
  status: TicketLineStatus;
  /** Time the line went to the kitchen. */
  sentAt?: string;
}

/** A dish being configured on the till (the open options dialog). */
export interface LineDraft {
  id: string;
  place: string;
  item: string;
  seat: string;
  side: string;
  spice: string;
  extras: string[];
  note: string;
  allergy: boolean;
  qty: number;
}

export interface RoomChargeCheck {
  title: string;
  detail: string;
  ok: boolean;
}

/** What the till checks before charging a bill to a room. */
export interface RoomChargeTarget {
  id: string;
  room: string;
  guest: string;
  stay: string;
  allowed: boolean;
  checks: RoomChargeCheck[];
  block?: { title: string; text: string };
  posted?: { title: string; text: string };
}

// ── POS · split bill and tender ─────────────────────────────────────────────

export interface Bill {
  id: string;
  place: string;
  table: string;
  total: number;
}

export interface BillSeat {
  id: string;
  label: string;
  items: string;
  amount: number;
}

export interface KeyFact {
  label: string;
  value: string;
}

export type FiscalStateId = "issued" | "vsdc" | "draft" | "none" | "folio" | "waiting";

/** A payment already taken on the bill. Mobile-money payments take their state from a MomoOutcome. */
export interface BillPayment {
  id: string;
  seats: string[];
  who: string;
  amount: number;
  tender: string;
  /** How the payment reads after a seat or line ("paid cash", "on room 204", "MoMo"). */
  short: string;
  /** True when the status comes from the provider (MTN MoMo). */
  momo?: boolean;
  label: string;
  tone: OutletTone;
  alertTone: OutletTone;
  icon: IconName;
  title: string;
  text: string;
  facts: KeyFact[];
  fiscal: FiscalStateId;
  settled: boolean;
  receipt?: { number: string; line: string };
}

/** MTN MoMo states of the Seat 2 payment (artifact variant `momo`). */
export interface MomoOutcome {
  id: "pending" | "verified" | "unknown" | "failed";
  label: string;
  tone: OutletTone;
  icon: IconName;
  title: string;
  text: string;
  reference: string;
  fiscal: FiscalStateId;
  settled: boolean;
  /** "Check status" is offered while the provider has not answered. */
  canCheck: boolean;
  /** Cancelling is blocked while the provider's answer is unknown. */
  noCancel: boolean;
  /** The seat is open again (payment failed). */
  retry: boolean;
}

export interface BillLine {
  id: string;
  name: string;
  meta: string;
  amount: number;
  seat: string;
  /** BillPayment id when already paid or pending (locked). */
  payment?: string;
}

export interface Tender {
  id: "cash" | "mtn" | "airtel" | "card" | "room";
  label: string;
  sub: string;
  icon: IconName;
  phone?: string;
  network?: string;
  provider?: string;
  /** Rail as recorded on a payment intent. */
  rail?: string;
  terminal?: string;
  guest?: string;
  stay?: string;
}

export interface FiscalState {
  id: FiscalStateId;
  label: string;
  tone: OutletTone;
  detail: string;
}

// ── Kitchen display ─────────────────────────────────────────────────────────

export interface KitchenStation {
  id: "grill" | "cold" | "bar";
  label: string;
  short: string;
  icon: IconName;
}

export interface KitchenItem {
  qty: number;
  name: string;
  mods: string;
  /** Set when the line was voided after it reached the kitchen. */
  voided?: string;
}

export interface KitchenTicket {
  id: string;
  station: KitchenStation["id"];
  source: OrderSource;
  label: string;
  meta: string;
  /** Minutes since the ticket came in (drives urgency). */
  minutes: number;
  timer: string;
  status: "new" | "ack" | "held" | "bumped";
  items: KitchenItem[];
  allergy?: string;
}

// ── Guest QR ordering ───────────────────────────────────────────────────────

export interface BasketLine {
  id: string;
  item: string;
  name: string;
  mods: string;
  qty: number;
  price: number;
}

export interface RoomServiceStep {
  status: "complete" | "active" | "inactive";
  title: string;
  detail: string;
}

export interface RoomServiceOrder {
  id: string;
  /** "placed" = already with the kitchen, "draft" = the basket, once placed. */
  state: "placed" | "draft";
  meta: string;
  eta: string;
  items: string;
  amount: number;
  steps: RoomServiceStep[];
  /** Short line for the "also tracking" link. */
  progress: string;
}

export interface ServiceHour {
  id: string;
  label: string;
  hours: string;
}

// ── Outlet supervisor · orders ──────────────────────────────────────────────

export interface ServiceKpi {
  id: string;
  label: string;
  value: number;
  format?: {
    style?: "decimal" | "currency";
    currency?: string;
    notation?: "standard" | "compact";
    maximumFractionDigits?: number;
  };
  /** Suffix after the number ("min"). */
  unit?: string;
  foot: string;
  /** Warning icon in the header. */
  warn?: boolean;
  /** Value follows the screen's live state. */
  live?: "voids";
}

export interface OrderStage {
  id: "new" | "kitchen" | "ready" | "served" | "payment";
  label: string;
  tone: OutletTone;
}

export interface LiveOrder {
  id: string;
  stage: OrderStage["id"];
  source: OrderSource;
  label: string;
  age: string;
  items: string;
  meta: string;
  late: boolean;
}

export interface VoidRequest {
  id: string;
  item: string;
  amount: number;
  meta: string;
  code: string;
  stock: string;
  status: "open" | "approved" | "rejected";
  approvedNote: string;
}

export interface RefundEvent {
  id: string;
  status: "success" | "warning" | "current" | "default";
  icon: IconName;
  title: string;
  detail: string;
}

export interface Refund {
  id: string;
  bill: string;
  summary: string;
  events: RefundEvent[];
}

export interface FiscalReport {
  id: "x" | "z";
  label: string;
  /** X report: read time and reader; the lead is composed from them. */
  readAt?: string;
  readBy?: string;
  lead?: string;
  rows: KeyFact[];
}

export interface StockOut {
  id: string;
  name: string;
  left: string;
  detail: string;
  icon: IconName;
  onMenus: boolean;
}

// ── Data ────────────────────────────────────────────────────────────────────

const TILAPIA_SIDES: MenuOption[] = [
  { id: "plantain", label: "Fried plantain", price: 0 },
  { id: "chips", label: "Chips", price: 0 },
  { id: "ugali", label: "Ugali", price: 0 },
  { id: "isombe", label: "Isombe", price: 2000 },
];

const menuItems: MenuItem[] = [
  { id: "samosas", name: "Vegetable samosas (3)", price: 4500 },
  { id: "avocado-salad", name: "Avocado salad", price: 5500 },
  { id: "sambaza-bites", name: "Sambaza bites", price: 6000 },
  { id: "tomato-soup", name: "Tomato and ginger soup", price: 4000 },
  {
    id: "tilapia",
    name: "Grilled tilapia",
    price: 14000,
    portionsLeft: 4,
    guestNote: "Lake Kivu tilapia with a side",
    description: "Whole Lake Kivu tilapia, charcoal grilled",
    guestDescription: "Whole Lake Kivu tilapia, charcoal grilled, with lemon and a side.",
    station: "Grill station",
    optionGroups: [
      { id: "side", label: "Side", options: TILAPIA_SIDES },
      {
        id: "spice",
        label: "Spice",
        options: [
          { id: "mild", label: "Mild", price: 0 },
          { id: "medium", label: "Medium", price: 0 },
          { id: "hot", label: "Hot", price: 0 },
        ],
      },
      {
        id: "extras",
        label: "Extras",
        multiple: true,
        options: [
          { id: "pili", label: "Pili pili sauce", price: 500, short: "pili pili sauce" },
          { id: "avo", label: "Avocado", price: 1000, short: "avocado" },
          { id: "onion", label: "No onions", price: 0, short: "no onions" },
        ],
      },
    ],
  },
  { id: "perch", name: "Nile perch fillet", price: 16000, soldOut: true, guestNote: "Pan fried, lemon butter" },
  { id: "beef", name: "Beef brochettes with chips", price: 12000, guestNote: "Two skewers, kachumbari" },
  { id: "goat", name: "Goat brochettes", price: 10500 },
  { id: "isombe-rice", name: "Isombe with rice", price: 9000, guestNote: "Cassava leaves, slow cooked" },
  { id: "curry", name: "Chicken curry", price: 11500, guestNote: "With rice" },
  { id: "pilau", name: "Vegetable pilau", price: 8500, diet: "Vegan", guestNote: "Vegan" },
  { id: "sambaza-fry", name: "Kivu sambaza fry", price: 9500, guestNote: "Crispy lake sardines" },
  { id: "mixed-grill", name: "Mixed grill for two", price: 28000 },
  { id: "plantain", name: "Fried plantain", price: 2500 },
  { id: "chips", name: "Chips", price: 2500 },
  { id: "ugali", name: "Ugali", price: 1500 },
  { id: "rice", name: "Rice", price: 1500 },
  { id: "isombe", name: "Isombe", price: 2000 },
  { id: "fruit", name: "Fruit plate", price: 4000, guestNote: "Pineapple, papaya, passion fruit" },
  { id: "fritters", name: "Banana fritters", price: 3500, guestNote: "With honey" },
  { id: "ice-cream", name: "Vanilla ice cream", price: 3000 },
  { id: "passion", name: "Passion juice", price: 3000, soldOut: true, guestNote: "Fresh pressed" },
  { id: "primus", name: "Primus 500 ml", price: 2000, guestNote: "Lake Bar" },
  { id: "mutzig", name: "Mutzig 500 ml", price: 2500 },
  { id: "water", name: "Inyange water 500 ml", price: 1000, guestNote: "Still" },
  { id: "tea", name: "Rwandan tea", price: 2000, guestNote: "Pot for one" },
  { id: "fanta", name: "Fanta 300 ml", price: 1500 },
];

const menuCategories: MenuCategory[] = [
  {
    id: "starters",
    menu: "dinner",
    label: "Starters",
    items: ["samosas", "avocado-salad", "sambaza-bites", "tomato-soup"],
  },
  {
    id: "mains",
    menu: "dinner",
    label: "Mains",
    items: ["tilapia", "perch", "beef", "goat", "isombe-rice", "curry", "pilau", "sambaza-fry"],
  },
  { id: "grill", menu: "dinner", label: "Grill", items: ["tilapia", "beef", "goat", "mixed-grill"] },
  { id: "sides", menu: "dinner", label: "Sides", items: ["plantain", "chips", "ugali", "rice", "isombe"] },
  { id: "desserts", menu: "dinner", label: "Desserts", items: ["fruit", "fritters", "ice-cream"] },
  { id: "drinks", menu: "dinner", label: "Drinks", items: ["passion", "primus", "mutzig", "water", "tea", "fanta"] },
  { id: "room-popular", menu: "room", label: "Popular", items: ["tilapia", "beef", "isombe-rice", "perch"] },
  { id: "room-mains", menu: "room", label: "Mains", items: ["tilapia", "curry", "pilau", "sambaza-fry"] },
  { id: "room-drinks", menu: "room", label: "Drinks", items: ["tea", "water", "primus", "passion"] },
  { id: "room-desserts", menu: "room", label: "Desserts", items: ["fruit", "fritters"] },
];

const places: PosPlace[] = [
  { id: "T1", rail: "tables", no: "T1", status: "Free", meta: "Lake side · 4 seats", tone: "default", seats: 4 },
  {
    id: "T2",
    rail: "tables",
    no: "T2",
    status: "Food served",
    meta: "2 guests · 48 min · Claudine",
    tone: "accent",
    seats: 2,
    order: "T2-0409",
  },
  {
    id: "T3",
    rail: "tables",
    no: "T3",
    status: "Bill printed",
    meta: "2 guests · awaiting payment",
    tone: "info",
    seats: 2,
    order: "T3-0411",
  },
  {
    id: "T4",
    rail: "tables",
    no: "T4",
    status: "Reserved 20:00",
    meta: "Daniel Okafor · 6 guests",
    tone: "default",
    seats: 6,
  },
  { id: "T5", rail: "tables", no: "T5", status: "Free", meta: "Garden side · 2 seats", tone: "default", seats: 2 },
  {
    id: "T6",
    rail: "tables",
    no: "T6",
    status: "Ordering",
    meta: "4 guests · 22 min · Claudine",
    tone: "accent",
    seats: 4,
    order: "T6-0418",
  },
  {
    id: "T7",
    rail: "tables",
    no: "T7",
    status: "Waiting for food",
    meta: "2 guests · 31 min",
    tone: "warning",
    seats: 2,
    order: "T7-0414",
  },
  { id: "T8", rail: "tables", no: "T8", status: "Free", meta: "Fire pit · 8 seats", tone: "default", seats: 8 },
  {
    id: "R204",
    rail: "rooms",
    no: "204",
    status: "Sarah Kimani",
    meta: "In house to 14 Oct · charges allowed",
    tone: "accent",
    seats: 2,
  },
  {
    id: "R211",
    rail: "rooms",
    no: "211",
    status: "Thomas Weber",
    meta: "Room charges blocked · prepaid",
    tone: "danger",
    seats: 1,
  },
  {
    id: "R305",
    rail: "rooms",
    no: "305",
    status: "Aisha Mohammed",
    meta: "Room service · tray out 19:40",
    tone: "warning",
    seats: 1,
  },
  {
    id: "R402",
    rail: "rooms",
    no: "402",
    status: "Yuki Tanaka",
    meta: "In house to 13 Oct · charges allowed",
    tone: "accent",
    seats: 1,
  },
];

const ticketLines: TicketLine[] = [
  {
    id: "T6-1",
    place: "T6",
    seat: "1",
    item: "beef",
    name: "Beef brochettes with chips",
    qty: 1,
    price: 12000,
    mods: "Medium well",
    status: "sent",
    sentAt: "19:31",
  },
  {
    id: "T6-2",
    place: "T6",
    seat: "1",
    item: "primus",
    name: "Primus 500 ml",
    qty: 1,
    price: 2000,
    mods: "",
    status: "sent",
    sentAt: "19:31",
  },
  {
    id: "T6-3",
    place: "T6",
    seat: "2",
    item: "isombe-rice",
    name: "Isombe with rice",
    qty: 1,
    price: 9000,
    mods: "",
    status: "sent",
    sentAt: "19:31",
  },
  {
    id: "T6-4",
    place: "T6",
    seat: "2",
    item: "water",
    name: "Inyange water 500 ml",
    qty: 2,
    price: 1000,
    mods: "Chilled",
    status: "sent",
    sentAt: "19:31",
  },
  {
    id: "T6-5",
    place: "T6",
    seat: "3",
    item: "samosas",
    name: "Vegetable samosas (3)",
    qty: 1,
    price: 4500,
    mods: "",
    status: "new",
  },
  {
    id: "T6-6",
    place: "T6",
    seat: "S",
    item: "avocado-salad",
    name: "Avocado salad",
    qty: 1,
    price: 5500,
    mods: "To share",
    status: "new",
  },
  {
    id: "T2-1",
    place: "T2",
    seat: "S",
    item: "mixed-grill",
    name: "Mixed grill for two",
    qty: 1,
    price: 28000,
    mods: "",
    status: "sent",
    sentAt: "19:31",
  },
  {
    id: "T2-2",
    place: "T2",
    seat: "1",
    item: "mutzig",
    name: "Mutzig 500 ml",
    qty: 2,
    price: 2500,
    mods: "",
    status: "sent",
    sentAt: "19:31",
  },
  {
    id: "T7-1",
    place: "T7",
    seat: "S",
    item: "curry",
    name: "Chicken curry",
    qty: 2,
    price: 11500,
    mods: "Rice",
    status: "sent",
    sentAt: "19:31",
  },
  {
    id: "R305-1",
    place: "R305",
    seat: "S",
    item: "curry",
    name: "Chicken curry",
    qty: 1,
    price: 11500,
    mods: "Tray out 19:40",
    status: "sent",
    sentAt: "19:31",
  },
  {
    id: "R305-2",
    place: "R305",
    seat: "S",
    item: "tea",
    name: "Rwandan tea",
    qty: 1,
    price: 2000,
    mods: "",
    status: "sent",
    sentAt: "19:31",
  },
];

const lineDrafts: LineDraft[] = [
  {
    id: "T6-tilapia",
    place: "T6",
    item: "tilapia",
    seat: "4",
    side: "plantain",
    spice: "medium",
    extras: ["pili"],
    note: "Peanuts. No groundnut sauce, use a clean grill plate",
    allergy: true,
    qty: 1,
  },
];

const roomCharges: RoomChargeTarget[] = [
  {
    id: "204",
    room: "204",
    guest: "Sarah Kimani · Room 204",
    stay: "Stay ST-8812 · in house 10 to 14 Oct · folio F-5521",
    allowed: true,
    checks: [
      { title: "Active stay verified", detail: "Checked in 10 Oct 15:12 · departs 14 Oct", ok: true },
      { title: "Stay policy allows outlet charges", detail: "Limit RWF 300,000 · RWF 64,000 used", ok: true },
      {
        title: "Same merchant as the hotel",
        detail: "Isangano Terrace is in-house. Tenant outlets like Ikawa Corner cannot charge rooms.",
        ok: true,
      },
      { title: "Your permission", detail: "Waiters may charge up to RWF 150,000 per bill", ok: true },
    ],
    posted: {
      title: "Posted to folio F-5521 · posting FP-30871 · 19:49",
      text: "Attributed to Isangano Terrace, Food. No fiscal receipt now: it is issued once, at folio close. A retry of this order cannot post twice.",
    },
  },
  {
    id: "211",
    room: "211",
    guest: "Thomas Weber · Room 211",
    stay: "Stay ST-8819 · prepaid package via Akagera Horizon Travel",
    allowed: false,
    checks: [
      { title: "Active stay verified", detail: "Checked in 11 Oct · departs 16 Oct", ok: true },
      { title: "Stay policy blocks outlet charges", detail: "Incidentals not authorised by the payer", ok: false },
    ],
    block: {
      title: "Room charges are blocked for this stay",
      text: "The travel agent prepaid room only and did not authorise extras. Ask the guest to pay here now.",
    },
  },
  {
    id: "402",
    room: "402",
    guest: "Room 402",
    stay: "Last stay ST-8790 · Yuki Tanaka",
    allowed: false,
    checks: [{ title: "No active stay", detail: "Folio F-5498 closed and fiscalised at checkout", ok: false }],
    block: {
      title: "No active stay in room 402",
      text: "Yuki Tanaka checked out today at 11:20. Charges can only go to an active stay.",
    },
  },
];

const bills: Bill[] = [{ id: "T6-0418", place: "T6", table: "Table 6", total: 49500 }];

const billSeats: BillSeat[] = [
  { id: "s1", label: "Seat 1", items: "Beef brochettes, Primus, salad share", amount: 15375 },
  { id: "s2", label: "Seat 2", items: "Isombe, 2 water, salad share", amount: 12375 },
  { id: "s3", label: "Seat 3 · Sarah Kimani", items: "Samosas, salad share", amount: 5875 },
  { id: "s4", label: "Seat 4", items: "Grilled tilapia, salad share", amount: 15875 },
];

const billPayments: BillPayment[] = [
  {
    id: "P1",
    seats: ["s1"],
    who: "Seat 1",
    amount: 15375,
    tender: "cash",
    short: "paid cash",
    label: "Paid · cash",
    tone: "success",
    alertTone: "success",
    icon: "CircleCheck",
    title: "Cash received at Till 2",
    text: "RWF 20,000 received, RWF 4,625 change given. Counted in the Till 2 drawer at shift close.",
    facts: [
      { label: "Payment", value: "PI-77139 · cash · 19:40" },
      { label: "Taken by", value: "Claudine Mukamana · Till 2" },
      { label: "Payment receipt", value: "PR-T2-1182" },
    ],
    fiscal: "issued",
    settled: true,
    receipt: { number: "EBM-ISG02-0041873", line: "Receipt NS 41873 · 19:41 · signature 7KQ2…M9XD" },
  },
  {
    id: "P2",
    seats: ["s2"],
    who: "Seat 2",
    amount: 12375,
    tender: "mtn",
    short: "MoMo",
    momo: true,
    label: "Pending",
    tone: "warning",
    alertTone: "warning",
    icon: "Hourglass",
    title: "Pending · waiting for the guest to approve",
    text: "",
    facts: [
      { label: "Payment intent", value: "PI-77142 · attempt 1" },
      { label: "Network", value: "MTN MoMo · 078 812 4471" },
    ],
    fiscal: "draft",
    settled: false,
  },
  {
    id: "P3",
    seats: ["s3"],
    who: "Seat 3",
    amount: 5875,
    tender: "room",
    short: "on room 204",
    label: "On room 204",
    tone: "info",
    alertTone: "accent",
    icon: "Key",
    title: "Posted to folio F-5521",
    text: "Charged to Sarah Kimani, room 204, with Isangano Terrace attribution. Settled at checkout.",
    facts: [
      { label: "Folio posting", value: "FP-30871 · 19:44" },
      { label: "Stay", value: "ST-8812 · departs 14 Oct" },
      { label: "Guest signature", value: "Captured" },
    ],
    fiscal: "folio",
    settled: true,
  },
];

const momoOutcomes: MomoOutcome[] = [
  {
    id: "pending",
    label: "Pending",
    tone: "warning",
    icon: "Hourglass",
    title: "Pending · waiting for the guest to approve",
    text: "MTN MoMo prompt sent to 078 812 4471 at 19:47. The bill stays open until MTN confirms. Do not hand over a receipt.",
    reference: "Not yet · recorded on confirmation",
    fiscal: "draft",
    settled: false,
    canCheck: true,
    noCancel: false,
    retry: false,
  },
  {
    id: "verified",
    label: "Verified",
    tone: "success",
    icon: "CircleCheck",
    title: "Verified by MTN MoMo",
    text: "Confirmed through the GT Bank adapter at 19:51. The evidence is attached to the payment.",
    reference: "MP261012.1951.C77310",
    fiscal: "vsdc",
    settled: true,
    canCheck: false,
    noCancel: false,
    retry: false,
  },
  {
    id: "unknown",
    label: "Unknown",
    tone: "default",
    icon: "CircleQuestion",
    title: "Unknown · checking with the provider",
    text: "No answer from MTN after 90 seconds. We keep checking PI-77142. Do not send a second prompt; the guest could pay twice.",
    reference: "Not received",
    fiscal: "draft",
    settled: false,
    canCheck: true,
    noCancel: true,
    retry: false,
  },
  {
    id: "failed",
    label: "Failed",
    tone: "danger",
    icon: "CircleXmark",
    title: "Failed · declined on the phone",
    text: "MTN reported the payment was declined (insufficient balance). Nothing was collected. Take another tender for Seat 2.",
    reference: "MP261012.1949.F11802 (declined)",
    fiscal: "none",
    settled: false,
    canCheck: false,
    noCancel: false,
    retry: true,
  },
];

const billLines: BillLine[] = [
  { id: "tilapia", name: "Grilled tilapia", meta: "Seat 4 · plantain, pili pili", amount: 14500, seat: "s4" },
  { id: "salad4", name: "Avocado salad · 1 of 4 shares", meta: "Seat 4 share", amount: 1375, seat: "s4" },
  { id: "beef", name: "Beef brochettes with chips", meta: "Seat 1", amount: 12000, seat: "s1", payment: "P1" },
  { id: "primus", name: "Primus 500 ml", meta: "Seat 1", amount: 2000, seat: "s1", payment: "P1" },
  { id: "isombe", name: "Isombe with rice", meta: "Seat 2", amount: 9000, seat: "s2", payment: "P2" },
  { id: "water", name: "Inyange water 500 ml × 2", meta: "Seat 2", amount: 2000, seat: "s2", payment: "P2" },
  { id: "samosas", name: "Vegetable samosas (3)", meta: "Seat 3", amount: 4500, seat: "s3", payment: "P3" },
];

const tenders: Tender[] = [
  { id: "cash", label: "Cash", sub: "Change due", icon: "Wallet" },
  {
    id: "mtn",
    label: "MTN MoMo",
    sub: "Phone prompt",
    icon: "Smartphone",
    phone: "078 812 4471",
    network: "MTN MoMo · detected from 078",
    provider: "MTN",
    rail: "MTN MoMo · 078 812 4471",
  },
  {
    id: "airtel",
    label: "Airtel Money",
    sub: "Phone prompt",
    icon: "Smartphone",
    phone: "073 455 2190",
    network: "Airtel Money · detected from 073",
    provider: "Airtel",
    rail: "Airtel Money · 073 455 2190",
  },
  {
    id: "card",
    label: "Card",
    sub: "GT Bank terminal",
    icon: "CreditCard",
    terminal: "GT Bank terminal ISG-T2",
    rail: "Card · GT Bank terminal ISG-T2",
  },
  {
    id: "room",
    label: "Room 204",
    sub: "Sarah Kimani",
    icon: "Key",
    guest: "Room 204 · Sarah Kimani",
    stay: "Active stay ST-8812 verified · charges allowed · RWF 230,125 left of the stay limit · folio F-5521",
  },
];

const fiscalStates: FiscalState[] = [
  { id: "issued", label: "Issued", tone: "success", detail: "Fiscal receipt signed by the VSDC." },
  {
    id: "vsdc",
    label: "Pending",
    tone: "warning",
    detail: "Sent to the VSDC with request R-ISG02-88412. Retries reuse this ID, so no duplicate is issued.",
  },
  {
    id: "draft",
    label: "Draft",
    tone: "default",
    detail: "Not requested yet. Issued only after the payment is verified.",
  },
  {
    id: "none",
    label: "Draft",
    tone: "default",
    detail: "Payment failed. Nothing to fiscalise until Seat 2 pays another way.",
  },
  {
    id: "folio",
    label: "On folio",
    tone: "info",
    detail: "Not issued here. Included in the folio F-5521 fiscal invoice at checkout, so the sale is invoiced once.",
  },
  { id: "waiting", label: "Draft", tone: "default", detail: "Waiting for payment." },
];

const kitchenStations: KitchenStation[] = [
  { id: "grill", label: "Grill and hot", short: "Grill", icon: "Flame" },
  { id: "cold", label: "Cold and pastry", short: "Cold", icon: "Snowflake" },
  { id: "bar", label: "Bar", short: "Bar", icon: "Cup" },
];

const kitchenTickets: KitchenTicket[] = [
  {
    id: "g4",
    station: "grill",
    source: "table",
    label: "Table 7",
    meta: "T7-0414 · Eric · in 19:21",
    minutes: 31,
    timer: "31:08",
    status: "new",
    items: [{ qty: 2, name: "Chicken curry", mods: "Rice · 1 mild, 1 hot" }],
  },
  {
    id: "g1",
    station: "grill",
    source: "table",
    label: "Table 6",
    meta: "T6-0418 · Claudine · in 19:31",
    minutes: 21,
    timer: "21:44",
    status: "ack",
    items: [{ qty: 1, name: "Beef brochettes with chips", mods: "Medium well" }],
  },
  {
    id: "g3",
    station: "grill",
    source: "room",
    label: "Room service 204",
    meta: "RS-0211 · Sarah Kimani · in 19:38",
    minutes: 14,
    timer: "14:20",
    status: "ack",
    items: [{ qty: 1, name: "Goat brochettes", mods: "Chips · extra pili pili" }],
    allergy: "Gluten. No flour dusting on the meat.",
  },
  {
    id: "g2",
    station: "grill",
    source: "table",
    label: "Table 6",
    meta: "T6-0418 · course 2 · in 19:49",
    minutes: 3,
    timer: "03:12",
    status: "new",
    items: [
      { qty: 1, name: "Grilled tilapia", mods: "Fried plantain · medium spice · pili pili sauce" },
      { qty: 1, name: "Vegetable samosas (3)", mods: "" },
    ],
    allergy: "Peanuts. No groundnut sauce, use a clean grill plate.",
  },
  {
    id: "c1",
    station: "cold",
    source: "qr",
    label: "QR order · Room 311",
    meta: "QR-0212 · Grace Achieng · in 19:50",
    minutes: 2,
    timer: "02:05",
    status: "new",
    items: [{ qty: 1, name: "Avocado salad", mods: "Dressing on the side" }],
  },
  {
    id: "c3",
    station: "cold",
    source: "table",
    label: "Table 6",
    meta: "T6-0418 · Claudine · in 19:49",
    minutes: 3,
    timer: "03:31",
    status: "ack",
    items: [{ qty: 1, name: "Avocado salad", mods: "To share · 4 plates" }],
  },
  {
    id: "c2",
    station: "cold",
    source: "table",
    label: "Table 2",
    meta: "T2-0409 · dessert course · in 19:30",
    minutes: 22,
    timer: "22:16",
    status: "held",
    items: [{ qty: 1, name: "Fruit plate", mods: "Fire when the waiter calls" }],
  },
  {
    id: "b2",
    station: "bar",
    source: "room",
    label: "Room service 204",
    meta: "RS-0211 · in 19:38",
    minutes: 14,
    timer: "14:02",
    status: "ack",
    items: [{ qty: 1, name: "Rwandan tea", mods: "Milk on the side" }],
  },
  {
    id: "b1",
    station: "bar",
    source: "qr",
    label: "QR order · Room 311",
    meta: "QR-0212 · in 19:50",
    minutes: 2,
    timer: "02:27",
    status: "new",
    items: [
      { qty: 2, name: "Mutzig 500 ml", mods: "Cold" },
      { qty: 1, name: "Passion juice", mods: "", voided: "Voided · sold out · approved by Joseph Habimana 19:51" },
    ],
  },
  {
    id: "b3",
    station: "bar",
    source: "table",
    label: "Bar seat 1",
    meta: "B1-0101 · in 19:44",
    minutes: 8,
    timer: "08:50",
    status: "ack",
    items: [{ qty: 1, name: "Primus 500 ml", mods: "" }],
  },
  {
    id: "b0",
    station: "bar",
    source: "table",
    label: "Table 3",
    meta: "T3-0411 · in 19:41",
    minutes: 11,
    timer: "11:39",
    status: "bumped",
    items: [{ qty: 2, name: "Fanta 300 ml", mods: "" }],
  },
];

const basketLines: BasketLine[] = [
  { id: "b-1", item: "tilapia", name: "Grilled tilapia", mods: "Fried plantain · mild", qty: 1, price: 14000 },
  { id: "b-2", item: "tea", name: "Rwandan tea", mods: "Milk on the side", qty: 2, price: 2000 },
];

const roomServiceOrders: RoomServiceOrder[] = [
  {
    id: "RS-0213",
    state: "placed",
    meta: "Placed 19:52 · from room 204",
    eta: "About 20:20",
    items: "1 × Grilled tilapia, 2 × Rwandan tea",
    amount: 18000,
    progress: "on the way",
    steps: [
      { status: "complete", title: "Received", detail: "The kitchen confirmed at 19:52" },
      { status: "complete", title: "Preparing", detail: "Grill station · started 19:53" },
      { status: "active", title: "On the way", detail: "Left the kitchen at 20:12" },
      { status: "inactive", title: "Delivered", detail: "" },
    ],
  },
  {
    id: "RS-0214",
    state: "draft",
    meta: "Placed 19:54 · from room 204",
    eta: "About 20:30",
    items: "",
    amount: 0,
    progress: "preparing",
    steps: [
      { status: "complete", title: "Received", detail: "The kitchen confirmed at 19:55" },
      { status: "active", title: "Preparing", detail: "Grill station · started 19:56" },
      { status: "inactive", title: "On the way", detail: "A team member brings it to your door" },
      { status: "inactive", title: "Delivered", detail: "" },
    ],
  },
];

const serviceHours: ServiceHour[] = [
  { id: "room-service", label: "Room service", hours: "06:30 to 22:30" },
  { id: "kitchen", label: "Kitchen last orders", hours: "22:00" },
  { id: "lake-bar", label: "Lake Bar drinks", hours: "16:00 to 23:30" },
  { id: "breakfast", label: "Breakfast, Isangano Terrace", hours: "06:30 to 10:30" },
];

const serviceKpis: ServiceKpi[] = [
  { id: "open", label: "Open orders", value: 12, foot: "8 terrace and bar · 2 room service · 2 QR" },
  { id: "ticket-time", label: "Average ticket time", value: 17, unit: "min", foot: "Target 18 min · 2 tickets late" },
  {
    id: "voids",
    label: "Voids awaiting you",
    value: 2,
    foot: "Requested by waiters tonight",
    warn: true,
    live: "voids",
  },
  {
    id: "net-sales",
    label: "Net sales today",
    value: 1840000,
    format: { style: "currency", currency: "RWF", notation: "compact", maximumFractionDigits: 2 },
    foot: "Paid and verified, plus room charges posted",
  },
  { id: "fiscal", label: "Fiscal receipts pending", value: 1, foot: "Refund receipt NR-0091 at the VSDC", warn: true },
];

const orderStages: OrderStage[] = [
  { id: "new", label: "New", tone: "accent" },
  { id: "kitchen", label: "In the kitchen", tone: "warning" },
  { id: "ready", label: "Ready to serve", tone: "success" },
  { id: "served", label: "Served · bill open", tone: "info" },
  { id: "payment", label: "Payment pending", tone: "default" },
];

const liveOrders: LiveOrder[] = [
  {
    id: "QR-0212",
    stage: "new",
    source: "qr",
    label: "QR · Room 311",
    age: "2 min",
    items: "Avocado salad, 2 Mutzig",
    meta: "QR-0212 · Grace Achieng",
    late: false,
  },
  {
    id: "T6-0418-c2",
    stage: "new",
    source: "table",
    label: "Table 6",
    age: "3 min",
    items: "Grilled tilapia, samosas, avocado salad",
    meta: "T6-0418 course 2 · Claudine",
    late: false,
  },
  {
    id: "T7-0414",
    stage: "kitchen",
    source: "table",
    label: "Table 7",
    age: "31 min",
    items: "2 Chicken curry",
    meta: "T7-0414 · Eric · late",
    late: true,
  },
  {
    id: "T6-0418-c1",
    stage: "kitchen",
    source: "table",
    label: "Table 6",
    age: "21 min",
    items: "Beef brochettes with chips",
    meta: "T6-0418 · Claudine · late",
    late: true,
  },
  {
    id: "RS-0211",
    stage: "kitchen",
    source: "room",
    label: "Room 204",
    age: "14 min",
    items: "Goat brochettes, Rwandan tea",
    meta: "RS-0211 · Sarah Kimani",
    late: false,
  },
  {
    id: "RS-0213",
    stage: "kitchen",
    source: "qr",
    label: "QR · Room 204",
    age: "2 min",
    items: "Grilled tilapia, 2 Rwandan tea",
    meta: "RS-0213 · Sarah Kimani",
    late: false,
  },
  {
    id: "T2-0409-c2",
    stage: "kitchen",
    source: "table",
    label: "Table 2",
    age: "22 min",
    items: "Fruit plate · held",
    meta: "T2-0409 · course held",
    late: false,
  },
  {
    id: "RS-0209",
    stage: "ready",
    source: "room",
    label: "Room 305",
    age: "12 min",
    items: "Chicken curry, Rwandan tea",
    meta: "RS-0209 · runner Eric",
    late: false,
  },
  {
    id: "B1-0101",
    stage: "ready",
    source: "table",
    label: "Bar seat 1",
    age: "8 min",
    items: "Primus 500 ml",
    meta: "B1-0101 · Lake Bar",
    late: false,
  },
  {
    id: "T3-0411",
    stage: "served",
    source: "table",
    label: "Table 3",
    age: "52 min",
    items: "2 Isombe with rice, 2 Fanta",
    meta: "T3-0411 · bill printed",
    late: false,
  },
  {
    id: "T2-0409",
    stage: "served",
    source: "table",
    label: "Table 2",
    age: "48 min",
    items: "Mixed grill for two, 2 Mutzig",
    meta: "T2-0409 · Claudine",
    late: false,
  },
  {
    id: "PI-77142",
    stage: "payment",
    source: "table",
    label: "Table 6",
    age: "Seat 2",
    items: "MoMo RWF 12,375 pending",
    meta: "PI-77142 · waiting for MTN",
    late: false,
  },
];

const voidRequests: VoidRequest[] = [
  {
    id: "v1",
    item: "Beef brochettes with chips",
    amount: 12000,
    meta: "T6-0418 · requested by Claudine Mukamana at 19:50 · already cooking",
    code: "VD-02 guest changed mind",
    stock: "Cooked · counts as wastage",
    status: "open",
    approvedNote:
      "Approved by you · RWF 12,000 removed from the bill · 0.25 kg beef and 0.3 kg potatoes recorded as wastage.",
  },
  {
    id: "v2",
    item: "Passion juice",
    amount: 3000,
    meta: "QR-0212 · raised automatically at 19:51 when stock reached zero",
    code: "VD-05 sold out",
    stock: "Not prepared · nothing to reverse",
    status: "approved",
    approvedNote: "Approved by you at 19:51 · guest told in the app · no charge made.",
  },
  {
    id: "v3",
    item: "Mutzig 500 ml",
    amount: 2500,
    meta: "T2-0409 · requested by Eric Habimana at 19:47 · entered twice",
    code: "VD-01 entered in error",
    stock: "Not served · bottle returns to stock",
    status: "open",
    approvedNote: "Approved by you · stock reversal posted to Lake Bar, +1 bottle.",
  },
];

const refunds: Refund[] = [
  {
    id: "RF-0091",
    bill: "T3-0407",
    summary: "Isombe with rice, RWF 9,000 · VD-03 quality complaint · approved by you at 19:22",
    events: [
      {
        id: "sale",
        status: "success",
        icon: "Receipt",
        title: "Original sale · fiscal receipt issued",
        detail: "EBM-ISG02-0041861 · 18:58 · unchanged",
      },
      {
        id: "approved",
        status: "success",
        icon: "CircleCheck",
        title: "Refund approved with reason",
        detail: "Joseph Habimana · 19:22 · VD-03 · guest Daniel Okafor",
      },
      {
        id: "receipt",
        status: "warning",
        icon: "FileExclamation",
        title: "Refund receipt pending at the VSDC",
        detail: "NR-0091 · request R-ISG02-88397 · retried twice with the same ID",
      },
      {
        id: "money",
        status: "current",
        icon: "ArrowUturnCcwLeft",
        title: "Money back to the guest: not sent yet",
        detail: "Original tender MTN MoMo MP261012.1855.B20417 · Finance executes the provider refund",
      },
      {
        id: "stock",
        status: "default",
        icon: "Boxes3",
        title: "Stock: recorded as wastage",
        detail: "The dish was served, so nothing returns to stock · MV-26-21877",
      },
    ],
  },
];

const fiscalReports: FiscalReport[] = [
  {
    id: "x",
    label: "X report · today",
    readAt: "19:55",
    readBy: "Joseph Habimana",
    rows: [
      { label: "Sales receipts issued", value: "63 · NS 41811 to NS 41873" },
      { label: "Refund receipts", value: "0 issued · 1 pending" },
      { label: "Gross fiscalised sales", value: "RWF 1,612,500" },
      { label: "VAT class B 18% (included)", value: "RWF 245,975" },
      { label: "Class A exempt", value: "RWF 0" },
      { label: "Cash · MoMo verified · card", value: "RWF 702,000 · 811,500 · 99,000" },
    ],
  },
  {
    id: "z",
    label: "Z report · 11 Oct",
    lead: "Z-0287 closed at 23:58 on 11 Oct by Joseph Habimana. Counters reset and the electronic journal was sealed.",
    rows: [
      { label: "Sales receipts", value: "214 · NS 41597 to NS 41810" },
      { label: "Refund receipts", value: "2 · NR 0089 to NR 0090" },
      { label: "Gross fiscalised sales", value: "RWF 4,903,000" },
      { label: "Refunds", value: "RWF 21,500" },
      { label: "VAT class B 18% (included, after refunds)", value: "RWF 744,636" },
      { label: "Journal", value: "Sealed · acknowledged by the VSDC 23:59" },
    ],
  },
];

const stockOuts: StockOut[] = [
  {
    id: "perch",
    name: "Nile perch fillet",
    left: "0 portions",
    detail: "Sold out since 18:40 · hidden on POS and QR automatically",
    icon: "Ban",
    onMenus: false,
  },
  {
    id: "juice",
    name: "Passion juice",
    left: "0 L",
    detail: "Ran out at 19:51 · one QR line voided",
    icon: "Ban",
    onMenus: false,
  },
  {
    id: "tilapia",
    name: "Grilled tilapia",
    left: "4 portions",
    detail: "Whole tilapia 2.6 kg left · reorder REQ-0936 sent to the store",
    icon: "TriangleExclamation",
    onMenus: true,
  },
  {
    id: "avocado",
    name: "Avocado",
    left: "9 pieces",
    detail: "About 6 salads · delivery tomorrow 10:00",
    icon: "TriangleExclamation",
    onMenus: true,
  },
];

export const fixtures = {
  "outlets.menuItems": menuItems,
  "outlets.menuCategories": menuCategories,
  "outlets.places": places,
  "outlets.ticketLines": ticketLines,
  "outlets.lineDrafts": lineDrafts,
  "outlets.roomCharges": roomCharges,
  "outlets.bills": bills,
  "outlets.billSeats": billSeats,
  "outlets.billPayments": billPayments,
  "outlets.momoOutcomes": momoOutcomes,
  "outlets.billLines": billLines,
  "outlets.tenders": tenders,
  "outlets.fiscalStates": fiscalStates,
  "outlets.kitchenStations": kitchenStations,
  "outlets.kitchenTickets": kitchenTickets,
  "outlets.basketLines": basketLines,
  "outlets.roomServiceOrders": roomServiceOrders,
  "outlets.serviceHours": serviceHours,
  "outlets.serviceKpis": serviceKpis,
  "outlets.orderStages": orderStages,
  "outlets.liveOrders": liveOrders,
  "outlets.voidRequests": voidRequests,
  "outlets.refunds": refunds,
  "outlets.fiscalReports": fiscalReports,
  "outlets.stockOuts": stockOuts,
} satisfies FixtureSet;
