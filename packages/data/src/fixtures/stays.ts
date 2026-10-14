import type { BoardId, FixtureSet, IconName } from "../types.ts";

/**
 * Embedded-database fixtures for the "stays" area: Stay and folio (StayFolio), Checkout,
 * Guest messages (Messages), Guest directory and profile (Guests) and Offline desk (OfflineDesk).
 * Collection names are "stays.<thing>"; every document has a stable string `id`.
 * Values are lifted verbatim from the artifact boards (node tools/artifact/extract.mjs <Board>).
 * Interactions (voids, payments, checkout, messages, merges, offline sync) stay in view state; nothing here is mutated.
 */

export type Tone = "accent" | "success" | "warning" | "danger" | "default" | "info";

/** Chip emphasis: "soft" for states, "tertiary" for quiet empty states ("None", "Not allowed"). */
export type ChipEmphasis = "soft" | "tertiary";

// ── Stay and folio ───────────────────────────────────────────────────────────

export interface Stay {
  id: string;
  guest: string;
  guestFirstName: string;
  guestId: string;
  room: string;
  roomType: string;
  bookingId: string;
  folioId: string;
  company: string;
  /** Legal entity that owns the folio and its TIN. */
  entity: string;
  entityTin: string;
  /** Arrival and departure day of month (October 2026). */
  arrivalDay: number;
  departureDay: number;
  nights: number;
  dueOut: string;
  /** Corporate nightly rate in RWF. */
  rate: number;
  /** Extra nights possible before the room is booked again. */
  freeNights: number;
  freeUntil: string;
  nextBooking: string;
  adults: number;
  inHouseSince: string;
  payerPhone: string;
}

export interface StayRecord {
  id: string;
  stayId: string;
  kind: string;
  title: string;
  icon: IconName;
  steps: string[];
  /** Index of the current state in `steps`. */
  current: number;
  desc: string;
  /** Where the card leads: another board or an anchor on this page. */
  board: BoardId | null;
  anchor: string | null;
}

export type FolioDepartment = "Rooms" | "Isangano Terrace" | "Lake Bar" | "Laundry" | "Minibar";

export interface FolioLine {
  id: string;
  stayId: string;
  date: string;
  title: string;
  /** Source record of the charge (order, ticket, night audit, void). */
  src: string;
  dept: FolioDepartment;
  by: string;
  /** Amount in RWF; reversals are negative. */
  amount: number;
  /** Room night posted by night audit. */
  night?: boolean;
  /** Room of a night line, e.g. "211 Standard Queen". */
  room?: string;
  /** Night audit reference of a night line. */
  audit?: string;
  /** Line already voided (a reversal line exists). */
  voided?: boolean;
  /** Reversal line of a void. */
  reversal?: boolean;
  /** Desk charge posted by the signed-in receptionist during this shift. */
  mine?: boolean;
}

export interface FolioPayment {
  id: string;
  stayId: string;
  tender: string;
  icon: IconName;
  amount: number;
  state: string;
  tone: Tone;
  line1: string;
  line2: string;
  /** Only verified tenders count towards the balance. */
  counted: boolean;
}

export interface StayEvent {
  id: string;
  stayId: string;
  status: "default" | "current" | "success" | "warning";
  icon: IconName;
  title: string;
  detail: string;
}

export interface StayAccess {
  id: string;
  stayId: string;
  kind: "mobileKey" | "keyCard" | "appClaim";
  icon: IconName;
  title: string;
  detail: string;
  state: string;
  tone: Tone;
}

export interface StayDocument {
  id: string;
  stayId: string;
  icon: IconName;
  title: string;
  detail: string;
  label: string;
  tone: Tone;
  emphasis: ChipEmphasis;
}

export interface LateCheckoutOption {
  id: string;
  /** Fee in RWF; 0 = no fee. */
  fee: number;
  note: string;
}

export interface ChargeDepartment {
  id: FolioDepartment;
  hint: string;
}

export interface DeskTender {
  id: "mtn" | "airtel" | "cash" | "card";
  label: string;
  icon: IconName;
  network: string;
  hint: string;
  blocked: boolean;
}

// ── Checkout ─────────────────────────────────────────────────────────────────

export interface CheckoutCase {
  id: string;
  stayId: string;
  guest: string;
  room: string;
  folioId: string;
  dueOut: string;
  /** RWF the guest still owes (bar and laundry). */
  guestShare: number;
  guestShareDetail: string;
  /** RWF moved to the company ledger. */
  companyShare: number;
  /** RWF of the unmatched bank transfer. */
  unmatched: number;
  momoPhone: string;
  bookingId: string;
  housekeeper: string;
  company: string;
  companyTin: string;
  cityLedger: string;
  /** Evidence of the documented move of the company share to the city ledger. */
  transfer: { label: string; value: string }[];
  invoice: { number: string; due: string };
}

export interface CheckoutLedgerLine {
  id: string;
  item: string;
  evidence: string;
  state: string;
  tone: Tone;
  /** RWF; credits are negative; null = not counted. */
  amount: number | null;
  /** Shown only once the guest's MoMo payment is verified. */
  afterGuestPaid: boolean;
}

export interface MomoEvent {
  id: "initiated" | "pending" | "unknown" | "verified";
  icon: IconName;
  title: string;
  detail: string;
}

export interface FiscalReceiptDraft {
  id: string;
  title: string;
  buyer: string;
  buyerWithoutTin: string | null;
  amount: number;
  /** Receipt number requested from the VSDC. */
  number: string;
  requestedAt: string;
  /** Who settles this share: the company share is settled already, the guest share waits for MoMo. */
  payer: "company" | "guest";
}

export interface CheckoutKey {
  id: string;
  icon: IconName;
  title: string;
  detail: string;
  state: string;
  revokedDetail: string;
  revokedState: string;
  revokedTone: Tone;
  /** Detail once the card is handed back at the desk. */
  returnedDetail: string | null;
}

// ── Guest messages ───────────────────────────────────────────────────────────

export type MessageChannel = "app" | "sms" | "email";

export interface DeliveryLine {
  ok: boolean;
  text: string;
}

export type ThreadMessage =
  | { t: "day"; text: string }
  | { t: "guest"; text: string; meta: string; lang?: string; file?: string; fileMeta?: string }
  | { t: "staff"; text: string; meta: string; lang?: string; delivery: DeliveryLine[]; sms?: boolean }
  | { t: "note"; text: string; meta: string }
  | {
      t: "card";
      kind: "Order" | "Service request";
      ref: string;
      at: string;
      icon: IconName;
      text: string;
      sub: string;
      /** Index of the current step on the order or service-request track. */
      step: number;
      foot: string;
    };

export interface MessageThread {
  id: string;
  name: string;
  initials: string;
  ctx: string;
  who: string;
  dept: string;
  channels: MessageChannel[];
  /** Initials of the assignee, "" = unassigned. */
  assignee: string;
  assigneeFull: string;
  unread: number;
  time: string;
  status: "Open" | "Escalated" | "Waiting on guest" | "Closed";
  sla: string;
  escalated: string | null;
  closed: boolean;
  facts: { label: string; value: string }[];
  links: { label: string; board: BoardId }[];
  consent: { icon: IconName; channel: string; detail: string; state: string; tone: Tone; emphasis: ChipEmphasis }[];
  messages: ThreadMessage[];
}

export interface MessageTemplate {
  id: string;
  label: string;
  EN: string;
  RW: string;
  FR: string;
}

// ── Guest directory and profile ──────────────────────────────────────────────

export interface DirectoryGuest {
  id: string;
  name: string;
  initials: string;
  status: string;
  tier: string;
  /** Has a booking or stay at this property (the default directory scope). */
  here: boolean;
  /** Part of the open duplicate review. */
  duplicate: boolean;
  /** The duplicate candidate that disappears once merged. */
  candidate: boolean;
}

export interface InfoItem {
  icon: IconName;
  title: string;
  detail: string;
  state: string;
  tone: Tone;
  emphasis: ChipEmphasis;
}

export interface GuestProfile {
  id: string;
  name: string;
  initials: string;
  since: string;
  nationality: string;
  pastStays: number;
  candidateId: string;
  chips: { label: string; tone: Tone }[];
  links: { label: string; board: BoardId; primary: boolean }[];
  compare: { field: string; profile: string; candidate: string; match: string; tone: Tone }[];
  contact: { label: string; value: string; muted: boolean }[];
  document: { title: string; masked: string; number: string; detail: string };
  accessLog: { icon: IconName; text: string }[];
  marketing: { optedIn: string };
  consent: { label: string; value: string }[];
  requests: InfoItem[];
  preferences: { icon: IconName; text: string; src: string }[];
  personalisation: string;
  stays: InfoItem[];
  mergedStay: InfoItem;
  rewards: { tier: string; points: number; next: string; nextAt: number };
  points: { text: string; points: string }[];
}

export interface ViewPurpose {
  id: string;
  hint: string;
}

// ── Offline desk ─────────────────────────────────────────────────────────────

export interface OfflineArrival {
  id: string;
  name: string;
  booking: string;
  roomType: string;
  room: string;
  eta: string;
  /** Room status in the cached copy (offline) and live (online). */
  statusOffline: string;
  toneOffline: Tone | null;
  statusOnline: string;
  /** Checked in offline already (queued). */
  queued: boolean;
  /** No room in the cached copy: needs the live room rack. */
  noRoom: boolean;
  /** Room was dirty in the cached copy. */
  dirty: boolean;
  /** Involved in the room 207 sync conflict. */
  conflict: boolean;
}

export interface OfflineAction {
  id: string;
  icon: IconName;
  title: string;
  detail: string;
  kind: "note" | "room" | "checkin" | "cash";
  conflict: boolean;
}

export interface PaymentRail {
  id: string;
  mode: "offline" | "online";
  icon: IconName;
  label: string;
  why: string;
  state: string;
  tone: Tone;
}

export interface CashGuest {
  id: string;
  label: string;
  name: string;
  folio: string;
}

export interface SyncConflict {
  id: string;
  room: string;
  foundAt: string;
  /** The two desks that assigned the same room while one of them was offline. */
  sides: { source: string; guest: string; detail: string }[];
  /** Outcome text for each resolution choice. */
  resolved: { keep: string; swap: string };
}

export interface ConflictChoice {
  id: "keep" | "swap";
  label: string;
  hint: string;
  suggested: boolean;
}

// ── Data ─────────────────────────────────────────────────────────────────────

const stays: Stay[] = [
  {
    id: "ST-8812",
    guest: "Thomas Weber",
    guestFirstName: "Thomas",
    guestId: "G-10871",
    room: "305",
    roomType: "Deluxe Lake View",
    bookingId: "BK-20433",
    folioId: "F-5521",
    company: "Umurage Consulting Ltd",
    entity: "Amahoro Hospitality Ltd",
    entityTin: "TIN 102 345 678",
    arrivalDay: 7,
    departureDay: 12,
    nights: 5,
    dueOut: "11:00",
    rate: 85000,
    freeNights: 3,
    freeUntil: "15 Oct",
    nextBooking: "BK-20462",
    adults: 1,
    inHouseSince: "7 Oct 14:12",
    payerPhone: "+250 788 412 960",
  },
];

const stayRecords: StayRecord[] = [
  {
    id: "ST-8812-booking",
    stayId: "ST-8812",
    kind: "Booking",
    title: "BK-20433",
    icon: "Calendar",
    steps: ["Requested", "Confirmed", "Completed"],
    current: 1,
    desc: "Made 2 Oct by Umurage Consulting · billing letter on file",
    board: "ReservationDetail",
    anchor: null,
  },
  {
    id: "ST-8812-stay",
    stayId: "ST-8812",
    kind: "Stay",
    title: "ST-8812",
    icon: "House",
    steps: ["Expected", "In-house", "Due out", "Checked out"],
    current: 2,
    desc: "In-house since 7 Oct 14:12 · 1 adult · moved once",
    board: "StayFolio",
    anchor: null,
  },
  {
    id: "ST-8812-folio",
    stayId: "ST-8812",
    kind: "Folio",
    title: "F-5521",
    icon: "Receipt",
    steps: ["Open", "Settled", "Closed"],
    current: 0,
    desc: "Balance RWF 359,000 · 2 payments not verified",
    board: null,
    anchor: "folio",
  },
  {
    id: "ST-8812-fiscal",
    stayId: "ST-8812",
    kind: "Fiscal receipt",
    title: "Not issued",
    icon: "FileCheck",
    steps: ["Draft", "Pending at VSDC", "Issued"],
    current: 0,
    desc: "Requested from the VSDC at folio close",
    board: null,
    anchor: "docs",
  },
];

const night = (id: string, date: string, room: string, audit: string, note?: string): FolioLine => ({
  id,
  stayId: "ST-8812",
  date,
  title: `Room night · ${room}`,
  src: `Night audit ${audit}${note ? ` · ${note}` : ""}`,
  dept: "Rooms",
  by: "Night audit",
  amount: 85000,
  night: true,
  room,
  audit,
});

const folioLines: FolioLine[] = [
  night("n1", "7 Oct", "211 Standard Queen", "NA-1007", "corporate rate"),
  night("n2", "8 Oct", "211 Standard Queen", "NA-1008"),
  {
    id: "l3",
    stayId: "ST-8812",
    date: "8 Oct",
    title: "Dinner, 2 covers",
    src: "Isangano Terrace order IT-4471",
    dept: "Isangano Terrace",
    by: "Claudine Mukamana",
    amount: 38500,
  },
  night("n3", "9 Oct", "305 Deluxe Lake View", "NA-1009", "rate held after move"),
  {
    id: "l5",
    stayId: "ST-8812",
    date: "9 Oct",
    title: "Lake Bar, 2 drinks",
    src: "Lake Bar order LB-2241",
    dept: "Lake Bar",
    by: "Lake Bar POS",
    amount: 9000,
    voided: true,
  },
  {
    id: "l6",
    stayId: "ST-8812",
    date: "9 Oct",
    title: "Reversal of LB-2241",
    src: "Void VD-0412 · Posted to wrong room",
    dept: "Lake Bar",
    by: "Eric Habimana",
    amount: -9000,
    reversal: true,
  },
  night("n4", "10 Oct", "305 Deluxe Lake View", "NA-1010"),
  {
    id: "l8",
    stayId: "ST-8812",
    date: "10 Oct",
    title: "Sundowner, 3 drinks",
    src: "Lake Bar order LB-2290",
    dept: "Lake Bar",
    by: "Lake Bar POS",
    amount: 21000,
  },
  night("n5", "11 Oct", "305 Deluxe Lake View", "NA-1011"),
  {
    id: "l10",
    stayId: "ST-8812",
    date: "11 Oct",
    title: "Laundry, 6 items",
    src: "Laundry ticket LN-0312",
    dept: "Laundry",
    by: "Jeanne Nyiraneza",
    amount: 12000,
  },
  {
    id: "l11",
    stayId: "ST-8812",
    date: "11 Oct",
    title: "Room service, sandwich and juice",
    src: "Isangano Terrace order IT-4502",
    dept: "Isangano Terrace",
    by: "Terrace POS",
    amount: 26500,
  },
  {
    id: "l12",
    stayId: "ST-8812",
    date: "12 Oct",
    title: "Express laundry surcharge",
    src: "Desk charge DM-7739 · Service without POS ticket",
    dept: "Laundry",
    by: "Eric Habimana",
    amount: 6000,
    mine: true,
  },
];

const folioPayments: FolioPayment[] = [
  {
    id: "PI-77104",
    stayId: "ST-8812",
    tender: "MTN MoMo · deposit",
    icon: "Smartphone",
    amount: 170000,
    state: "Verified",
    tone: "success",
    line1: "MTN Rwanda · ref MP261007.1406.C11873 · PI-77104",
    line2: "Verified by MTN MoMo 7 Oct 14:09 · allocated to F-5521 · payment receipt PR-26-3302",
    counted: true,
  },
  {
    id: "PI-77131",
    stayId: "ST-8812",
    tender: "Airtel Money",
    icon: "Smartphone",
    amount: 39000,
    state: "Pending",
    tone: "warning",
    line1: "Airtel Rwanda · PI-77131 · sent 10:31 to +250 733 ••• 418",
    line2: "No provider reference yet · last checked 10:39 · not counted",
    counted: false,
  },
  {
    id: "UMC-OCT-WEBER",
    stayId: "ST-8812",
    tender: "Bank transfer · Umurage Consulting Ltd",
    icon: "Vault",
    amount: 255000,
    state: "Unmatched — Finance is checking",
    tone: "warning",
    line1: "From Bank of Kigali · ref UMC/OCT/WEBER · received 10 Oct",
    line2: "Reference does not name this folio · not allocated until Finance matches it",
    counted: false,
  },
];

const stayHistory: StayEvent[] = [
  {
    id: "h1",
    stayId: "ST-8812",
    status: "success",
    icon: "ArrowRightToSquare",
    title: "Checked in to 211 · Standard Queen",
    detail: "7 Oct 14:12 · Eric Habimana · passport checked at desk",
  },
  {
    id: "h2",
    stayId: "ST-8812",
    status: "default",
    icon: "ArrowRightArrowLeft",
    title: "Moved 211 → 305 · Deluxe Lake View",
    detail: "9 Oct 08:35 · air conditioning fault WO-318 · upgrade approved by Aline Uwase · rate held at RWF 85,000",
  },
  {
    id: "h3",
    stayId: "ST-8812",
    status: "success",
    icon: "Key",
    title: "Keys switched to 305",
    detail: "9 Oct 08:36 · 211 keys revoked, lock provider confirmed 08:37",
  },
  {
    id: "h4",
    stayId: "ST-8812",
    status: "default",
    icon: "Comment",
    title: "Asked for late checkout",
    detail: "12 Oct 07:58 · in-app message to front desk",
  },
];

const stayAccess: StayAccess[] = [
  {
    id: "mobile-key",
    stayId: "ST-8812",
    kind: "mobileKey",
    icon: "Smartphone",
    title: "Mobile key · Room 305",
    detail: "Thomas’s phone · valid to 12 Oct 11:00",
    state: "Active",
    tone: "success",
  },
  {
    id: "key-card-2",
    stayId: "ST-8812",
    kind: "keyCard",
    icon: "Key",
    title: "Key card #2 · Room 305",
    detail: "Encoded 9 Oct 08:36 · door lock syncs offline locks overnight",
    state: "Issued",
    tone: "default",
  },
  {
    id: "app-claim",
    stayId: "ST-8812",
    kind: "appClaim",
    icon: "QrCode",
    title: "Guest app claim",
    detail: "Claimed 6 Oct 19:20 with claim code · pre-arrival form done",
    state: "Claimed",
    tone: "default",
  },
];

const stayDocuments: StayDocument[] = [
  {
    id: "PF-26-1188",
    stayId: "ST-8812",
    icon: "FileText",
    title: "Proforma PF-26-1188",
    detail: "2 Oct · sent to Umurage Consulting · estimate only",
    label: "Proforma · not a tax document",
    tone: "default",
    emphasis: "soft",
  },
  {
    id: "PR-26-3302",
    stayId: "ST-8812",
    icon: "Receipt",
    title: "Payment receipt PR-26-3302",
    detail: "MTN MoMo deposit RWF 170,000 · 7 Oct",
    label: "Payment receipt",
    tone: "default",
    emphasis: "soft",
  },
  {
    id: "fiscal",
    stayId: "ST-8812",
    icon: "FileCheck",
    title: "Fiscal receipt",
    detail: "Issued through the VSDC when the folio closes at checkout",
    label: "Not issued yet",
    tone: "warning",
    emphasis: "soft",
  },
  {
    id: "invoice",
    stayId: "ST-8812",
    icon: "Briefcase",
    title: "Commercial invoice",
    detail: "Created only if a balance moves to the Umurage Consulting ledger",
    label: "None",
    tone: "default",
    emphasis: "tertiary",
  },
];

const lateCheckoutOptions: LateCheckoutOption[] = [
  { id: "13:00", fee: 0, note: "Included for Umurage guests" },
  { id: "15:00", fee: 42500, note: "Half-day rate" },
  { id: "18:00", fee: 85000, note: "Full night rate" },
];

const chargeDepartments: ChargeDepartment[] = [
  { id: "Isangano Terrace", hint: "Restaurant" },
  { id: "Lake Bar", hint: "Bar" },
  { id: "Laundry", hint: "Housekeeping" },
  { id: "Minibar", hint: "Room 305 stock" },
];

const deskTenders: DeskTender[] = [
  {
    id: "mtn",
    label: "MTN MoMo",
    icon: "Smartphone",
    network: "MTN Rwanda",
    hint: "Guest approves on phone",
    blocked: false,
  },
  {
    id: "airtel",
    label: "Airtel Money",
    icon: "Smartphone",
    network: "Airtel Rwanda",
    hint: "Guest approves on phone",
    blocked: false,
  },
  { id: "cash", label: "Cash", icon: "Wallet", network: "", hint: "Till 1 · counted at close", blocked: false },
  { id: "card", label: "Card", icon: "CreditCard", network: "", hint: "Not available yet", blocked: true },
];

const checkouts: CheckoutCase[] = [
  {
    id: "ST-8812",
    stayId: "ST-8812",
    guest: "Thomas Weber",
    room: "305",
    folioId: "F-5521",
    dueOut: "11:00",
    guestShare: 39000,
    guestShareDetail: "Lake Bar RWF 21,000 · Laundry RWF 18,000",
    companyShare: 320000,
    unmatched: 255000,
    momoPhone: "+250 788 412 960",
    bookingId: "BK-20433",
    housekeeper: "Jeanne Nyiraneza",
    company: "Umurage Consulting Ltd",
    companyTin: "TIN 107 884 213",
    cityLedger: "CL-UMC",
    transfer: [
      { label: "Amount moved", value: "RWF 320,000 · rooms and meals not yet paid" },
      {
        label: "Authorisation",
        value: "AUTH-UMC-0611 · letter from Umurage Consulting, 2 Oct · room nights and meals up to RWF 600,000",
      },
      { label: "Reason code", value: "Company direct billing (authorised)" },
      { label: "Recorded", value: "10:48 by Eric Habimana · credit available before move RWF 400,000" },
    ],
    invoice: { number: "INV-26-0418", due: "11 Nov 2026" },
  },
];

const checkoutLedger: CheckoutLedgerLine[] = [
  {
    id: "charges",
    item: "Charges posted",
    evidence: "Rooms 425,000 · Terrace 65,000 · Lake Bar 21,000 · Laundry 18,000 · voids reversed",
    state: "Posted",
    tone: "default",
    amount: 529000,
    afterGuestPaid: false,
  },
  {
    id: "momo-deposit",
    item: "MTN MoMo deposit",
    evidence: "MTN Rwanda · ref MP261007.1406.C11873 · verified 7 Oct 14:09",
    state: "Verified",
    tone: "success",
    amount: -170000,
    afterGuestPaid: false,
  },
  {
    id: "airtel",
    item: "Airtel Money request",
    evidence: "PI-77131 · Airtel returned EXPIRED 10:46 · guest did not approve · nothing charged",
    state: "Failed",
    tone: "danger",
    amount: 0,
    afterGuestPaid: false,
  },
  {
    id: "transfer",
    item: "Bank transfer · Umurage",
    evidence: "Bank of Kigali · ref UMC/OCT/WEBER · 10 Oct · not allocated",
    state: "Unmatched — Finance is checking",
    tone: "warning",
    amount: null,
    afterGuestPaid: false,
  },
  {
    id: "company-ledger",
    item: "Moved to company ledger",
    evidence: "CL-UMC · AUTH-UMC-0611 · 10:48 Eric Habimana",
    state: "Documented exception",
    tone: "accent",
    amount: -320000,
    afterGuestPaid: false,
  },
  {
    id: "momo-guest",
    item: "MTN MoMo · guest share",
    evidence: "MTN Rwanda · ref MP261012.1056.D55120 · verified 10:56",
    state: "Verified",
    tone: "success",
    amount: -39000,
    afterGuestPaid: true,
  },
];

const momoTrail: MomoEvent[] = [
  {
    id: "initiated",
    icon: "PaperPlane",
    title: "Initiated · PI-77142",
    detail: "10:51 · RWF 39,000 to +250 788 ••• 960 · MTN Rwanda",
  },
  {
    id: "pending",
    icon: "Clock",
    title: "Pending · waiting for the guest to approve",
    detail: "10:51 · request accepted by MTN, no result yet",
  },
  {
    id: "unknown",
    icon: "CircleQuestion",
    title: "Unknown · MTN did not answer in 60 seconds",
    detail: "10:53 · status check timed out · folio left open",
  },
  {
    id: "verified",
    icon: "Check",
    title: "Verified by MTN MoMo",
    detail: "10:56 · ref MP261012.1056.D55120 · allocated to F-5521",
  },
];

const fiscalReceipts: FiscalReceiptDraft[] = [
  {
    id: "company",
    title: "Company receipt · rooms and meals",
    buyer: "Buyer Umurage Consulting Ltd · TIN 107 884 213",
    buyerWithoutTin: "No buyer TIN",
    amount: 490000,
    number: "10412",
    requestedAt: "10:48",
    payer: "company",
  },
  {
    id: "guest",
    title: "Guest receipt · bar and laundry",
    buyer: "Buyer Thomas Weber",
    buyerWithoutTin: null,
    amount: 39000,
    number: "10413",
    requestedAt: "10:57",
    payer: "guest",
  },
];

const checkoutKeys: CheckoutKey[] = [
  {
    id: "mobile",
    icon: "Smartphone",
    title: "Mobile key · Thomas’s phone",
    detail: "Active · valid to 12 Oct 11:00",
    state: "Active",
    revokedDetail: "Revoked · lock provider confirmed 10:55",
    revokedState: "Revoked",
    revokedTone: "success",
    returnedDetail: null,
  },
  {
    id: "card",
    icon: "Key",
    title: "Key card #2",
    detail: "Encoded 9 Oct 08:36",
    state: "Issued",
    revokedDetail: "Revocation queued · offline door lock confirms at overnight sync",
    revokedState: "Pending lock sync",
    revokedTone: "warning",
    returnedDetail: "Returned · offline door lock clears it at overnight sync",
  },
];

const ok: DeliveryLine = { ok: true, text: "" };
const fail: DeliveryLine = { ok: false, text: "" };

const threads: MessageThread[] = [
  {
    id: "t1",
    name: "Thomas Weber",
    initials: "TW",
    ctx: "Room 305 · Stay ST-8812",
    who: "In-house · guest of Umurage Consulting Ltd",
    dept: "Front desk",
    channels: ["app", "sms", "email"],
    assignee: "EH",
    assigneeFull: "Eric Habimana (you)",
    unread: 1,
    time: "10:20",
    status: "Open",
    sla: "first reply in 5 min",
    escalated: null,
    closed: false,
    facts: [
      { label: "Stay", value: "ST-8812 · 7 to 12 Oct" },
      { label: "Due out", value: "Today 11:00 · asked for 15:00" },
      { label: "Folio", value: "F-5521 · RWF 359,000 due" },
      { label: "Language", value: "English, German" },
    ],
    links: [
      { label: "Stay and folio", board: "StayFolio" },
      { label: "Checkout", board: "Checkout" },
      { label: "Profile", board: "Guests" },
    ],
    consent: [
      {
        icon: "Smartphone",
        channel: "Guest app",
        detail: "Stay claimed 6 Oct · notifications on",
        state: "Active",
        tone: "success",
        emphasis: "soft",
      },
      {
        icon: "Envelope",
        channel: "Email",
        detail: "t.weber@umurage.rw · service messages",
        state: "Allowed",
        tone: "default",
        emphasis: "soft",
      },
      {
        icon: "Handset",
        channel: "SMS",
        detail: "+250 788 ••• 960 · consent at check-in 7 Oct · 2 failures today",
        state: "Consented",
        tone: "default",
        emphasis: "soft",
      },
      {
        icon: "Megaphone",
        channel: "Marketing",
        detail: "Opted out at the desk 7 Oct",
        state: "Opted out",
        tone: "warning",
        emphasis: "soft",
      },
    ],
    messages: [
      { t: "day", text: "Sunday 11 October" },
      {
        t: "card",
        kind: "Order",
        ref: "IT-4502",
        at: "20:14",
        icon: "ShoppingCart",
        text: "Room service · Isangano Terrace",
        sub: "Club sandwich, passion juice · RWF 26,500 · charged to room 305",
        step: 4,
        foot: "Delivered 20:41 by Claudine Mukamana · posted to folio F-5521",
      },
      { t: "guest", text: "Please no onions in the sandwich, thank you.", meta: "20:16 · guest app · read 20:17" },
      { t: "day", text: "Today" },
      {
        t: "guest",
        text: "Good morning. Could I get two extra towels and a bath mat? Also, my flight is in the evening. Is a late checkout possible?",
        meta: "07:58 · guest app · read 08:01",
      },
      {
        t: "card",
        kind: "Service request",
        ref: "SR-2291",
        at: "08:02",
        icon: "BroomMotion",
        text: "Extra towels (2) and bath mat",
        sub: "Routed to Housekeeping · floor 3 · due by 08:30",
        step: 2,
        foot: "Acknowledged by Jeanne Nyiraneza 08:06 · in progress",
      },
      {
        t: "staff",
        text: "Good morning Mr Weber. Housekeeping is bringing the towels and a bath mat now. I will come back to you about the late checkout.",
        meta: "08:03 · Eric Habimana · guest app",
        delivery: [{ ...ok, text: "Delivered in app 08:03 · read 08:04" }],
      },
      {
        t: "note",
        text: "305 has no arrival today. 15:00 is possible. Check whether the Umurage letter covers the late fee.",
        meta: "08:05 · Eric Habimana",
      },
      {
        t: "guest",
        text: "Here is my flight confirmation for the airport transfer.",
        file: "RwandAir-WB463-confirmation.pdf",
        fileMeta: "PDF · 182 KB · scanned · kept with the stay",
        meta: "09:40 · guest app · read 09:44",
      },
      {
        t: "staff",
        text: "Thank you. Late checkout until 15:00 is possible today for RWF 42,500, or until 13:00 at no charge. Which do you prefer?",
        meta: "09:52 · Eric Habimana · guest app and SMS",
        delivery: [
          { ...ok, text: "Delivered in app 09:52 · read 10:18" },
          { ...fail, text: "SMS failed · MTN: handset unreachable · retried 09:57 and 10:07" },
        ],
        sms: true,
      },
      { t: "guest", text: "15:00 please. Can the fee go on my company bill?", meta: "10:20 · guest app · new" },
    ],
  },
  {
    id: "t2",
    name: "Sarah Kimani",
    initials: "SK",
    ctx: "Pre-arrival · BK-20431 · arrives today",
    who: "Booked through Akagera Horizon Travel",
    dept: "Front desk",
    channels: ["email"],
    assignee: "",
    assigneeFull: "nobody yet",
    unread: 2,
    time: "09:48",
    status: "Open",
    sla: "first reply due 09:58 · overdue",
    escalated: null,
    closed: false,
    facts: [
      { label: "Booking", value: "BK-20431 · 12 to 14 Oct" },
      { label: "Room", value: "204 · Deluxe Lake View" },
      { label: "Arrival", value: "Today about 13:00" },
      { label: "Loyalty", value: "Gold · 12,450 points" },
    ],
    links: [
      { label: "Booking", board: "ReservationDetail" },
      { label: "Profile", board: "Guests" },
    ],
    consent: [
      {
        icon: "Envelope",
        channel: "Email",
        detail: "s.kimani@mail.co.ke · service messages",
        state: "Allowed",
        tone: "default",
        emphasis: "soft",
      },
      {
        icon: "Handset",
        channel: "SMS",
        detail: "No consent recorded yet",
        state: "Not allowed",
        tone: "default",
        emphasis: "tertiary",
      },
      {
        icon: "Megaphone",
        channel: "Marketing",
        detail: "Opted in 2 Mar 2025 · guest app",
        state: "Opted in",
        tone: "default",
        emphasis: "soft",
      },
    ],
    messages: [
      { t: "day", text: "Today" },
      { t: "guest", text: "Hello, I land in Kigali at 08:40 and will take the bus to Gisenyi.", meta: "09:31 · email" },
      {
        t: "guest",
        text: "Can you arrange a pickup from the Gisenyi bus park at about 13:00?",
        meta: "09:48 · email · new",
      },
    ],
  },
  {
    id: "t3",
    name: "Daniel Okafor",
    initials: "DO",
    ctx: "Room 402 · Stay ST-8809",
    who: "In-house · Family Suite",
    dept: "Maintenance",
    channels: ["app"],
    assignee: "JN",
    assigneeFull: "Jean-Paul Niyonsaba",
    unread: 0,
    time: "09:35",
    status: "Escalated",
    sla: "second report",
    escalated: "Escalated to Aline Uwase 09:35",
    closed: false,
    facts: [
      { label: "Stay", value: "ST-8809 · 10 to 14 Oct" },
      { label: "Room", value: "402 · Family Suite" },
      { label: "Work order", value: "WO-321 · hot water" },
    ],
    links: [{ label: "Profile", board: "Guests" }],
    consent: [
      {
        icon: "Smartphone",
        channel: "Guest app",
        detail: "Stay claimed 10 Oct",
        state: "Active",
        tone: "success",
        emphasis: "soft",
      },
      {
        icon: "Megaphone",
        channel: "Marketing",
        detail: "Not asked",
        state: "No consent",
        tone: "default",
        emphasis: "tertiary",
      },
    ],
    messages: [
      { t: "day", text: "Today" },
      {
        t: "guest",
        text: "Still no hot water in the shower. This is the second time.",
        meta: "09:30 · guest app · read 09:31",
      },
      {
        t: "card",
        kind: "Service request",
        ref: "SR-2288",
        at: "09:31",
        icon: "Wrench",
        text: "No hot water · room 402",
        sub: "Routed to Maintenance · work order WO-321",
        step: 2,
        foot: "Escalated to duty manager Aline Uwase 09:35 · reason: second report",
      },
    ],
  },
  {
    id: "t4",
    name: "Yuki Tanaka",
    initials: "YT",
    ctx: "Pre-arrival · BK-20447 · 15 Oct",
    who: "Arrives Thursday · 3 nights",
    dept: "Front desk",
    channels: ["sms", "email"],
    assignee: "EH",
    assigneeFull: "Eric Habimana (you)",
    unread: 0,
    time: "09:21",
    status: "Waiting on guest",
    sla: "replied",
    escalated: null,
    closed: false,
    facts: [
      { label: "Booking", value: "BK-20447 · 15 to 18 Oct" },
      { label: "Room", value: "Not assigned yet" },
    ],
    links: [{ label: "Booking", board: "ReservationDetail" }],
    consent: [
      {
        icon: "Handset",
        channel: "SMS",
        detail: "+81 90 •••• 2231 · consent on booking form",
        state: "Consented",
        tone: "default",
        emphasis: "soft",
      },
      {
        icon: "Envelope",
        channel: "Email",
        detail: "service messages",
        state: "Allowed",
        tone: "default",
        emphasis: "soft",
      },
      {
        icon: "Megaphone",
        channel: "Marketing",
        detail: "Opted out 30 Sep",
        state: "Opted out",
        tone: "warning",
        emphasis: "soft",
      },
    ],
    messages: [
      { t: "day", text: "Today" },
      {
        t: "staff",
        text: "Welcome to Isangano Lakeside Hotel. Check-in opens at 14:00 on 15 October. Reply here with your arrival time.",
        meta: "09:05 · pre-arrival template · SMS, then email",
        delivery: [
          { ...fail, text: "SMS failed · international route rejected · retried 09:10 and 09:20" },
          { ...ok, text: "Email delivered 09:21 · opened 09:40" },
        ],
      },
    ],
  },
  {
    id: "t5",
    name: "Aisha Mohammed",
    initials: "AM",
    ctx: "Room 208 · Stay ST-8807",
    who: "In-house · Twin",
    dept: "Isangano Terrace",
    channels: ["app"],
    assignee: "JH",
    assigneeFull: "Joseph Habimana",
    unread: 1,
    time: "08:55",
    status: "Open",
    sla: "outlet replies",
    escalated: null,
    closed: false,
    facts: [
      { label: "Stay", value: "ST-8807 · 9 to 13 Oct" },
      { label: "Order", value: "IT-4511 · breakfast" },
    ],
    links: [{ label: "Profile", board: "Guests" }],
    consent: [
      {
        icon: "Smartphone",
        channel: "Guest app",
        detail: "Stay claimed 9 Oct",
        state: "Active",
        tone: "success",
        emphasis: "soft",
      },
    ],
    messages: [
      { t: "day", text: "Today" },
      {
        t: "card",
        kind: "Order",
        ref: "IT-4511",
        at: "08:40",
        icon: "ShoppingCart",
        text: "Breakfast in room · Isangano Terrace",
        sub: "Two continental breakfasts · RWF 24,000 · charged to room 208",
        step: 1,
        foot: "Preparing · promised 09:10",
      },
      { t: "guest", text: "Can I add a fruit plate to my breakfast order?", meta: "08:55 · guest app · new" },
    ],
  },
  {
    id: "t6",
    name: "Pierre Laurent",
    initials: "PL",
    ctx: "Pre-arrival · BK-20452 · arrives today",
    who: "Direct booking · 2 nights",
    dept: "Front desk",
    channels: ["email"],
    assignee: "",
    assigneeFull: "nobody yet",
    unread: 1,
    time: "08:40",
    status: "Open",
    sla: "first reply due 08:50 · overdue",
    escalated: null,
    closed: false,
    facts: [
      { label: "Booking", value: "BK-20452 · 12 to 14 Oct" },
      { label: "Room", value: "207 · Standard Queen" },
      { label: "Language", value: "French" },
    ],
    links: [{ label: "Booking", board: "ReservationDetail" }],
    consent: [
      {
        icon: "Envelope",
        channel: "Email",
        detail: "service messages",
        state: "Allowed",
        tone: "default",
        emphasis: "soft",
      },
    ],
    messages: [
      { t: "day", text: "Today" },
      {
        t: "guest",
        lang: "fr",
        text: "Bonjour, est-il possible d’arriver vers 10h et de déposer nos bagages ?",
        meta: "08:40 · email · new",
      },
    ],
  },
  {
    id: "t7",
    name: "Grace Achieng",
    initials: "GA",
    ctx: "Checked out 11 Oct · ST-8790",
    who: "Thread read-only after checkout",
    dept: "Front desk",
    channels: ["email"],
    assignee: "EH",
    assigneeFull: "Eric Habimana (you)",
    unread: 0,
    time: "Sat",
    status: "Closed",
    sla: "closed 11 Oct",
    escalated: null,
    closed: true,
    facts: [
      { label: "Stay", value: "ST-8790 · checked out 11 Oct" },
      { label: "Lost item", value: "Blue scarf · LF-0093" },
    ],
    links: [{ label: "Profile", board: "Guests" }],
    consent: [
      {
        icon: "Envelope",
        channel: "Email",
        detail: "service messages",
        state: "Allowed",
        tone: "default",
        emphasis: "soft",
      },
    ],
    messages: [
      { t: "day", text: "Sunday 11 October" },
      { t: "guest", text: "I think I left a blue scarf in room 109.", meta: "16:10 · email · read 16:12" },
      {
        t: "staff",
        text: "We found it and logged it as LF-0093. We will hold it for 90 days.",
        meta: "16:20 · Eric Habimana · email",
        delivery: [{ ...ok, text: "Email delivered 16:20" }],
      },
    ],
  },
];

const messageTemplates: MessageTemplate[] = [
  {
    id: "late",
    label: "Late checkout",
    EN: "Your late checkout until 15:00 today is confirmed. The fee of RWF 42,500 is added to your room bill.",
    RW: "Muraho! Gusohoka mu cyumba saa cyenda (15:00) uyu munsi byemejwe. Amafaranga RWF 42,500 yongewe kuri fagitire y’icyumba.",
    FR: "Votre départ tardif jusqu’à 15h00 aujourd’hui est confirmé. Les frais de 42 500 RWF sont ajoutés à votre note.",
  },
  {
    id: "transfer",
    label: "Airport transfer",
    EN: "Your transfer to Kigali airport leaves the hotel entrance at 15:30. The driver will meet you at reception.",
    RW: "Imodoka ibajyana ku kibuga cy’indege i Kigali izahaguruka ku muryango wa hoteli saa cyenda n’igice (15:30).",
    FR: "Votre transfert vers l’aéroport de Kigali part de l’entrée de l’hôtel à 15h30. Le chauffeur vous attend à la réception.",
  },
  {
    id: "breakfast",
    label: "Breakfast hours",
    EN: "Breakfast at Isangano Terrace is served from 06:30 to 10:30.",
    RW: "Ifunguro rya mu gitondo ritangirwa kuri Isangano Terrace kuva saa kumi n’imwe n’igice (06:30) kugeza saa yine n’igice (10:30).",
    FR: "Le petit-déjeuner est servi à Isangano Terrace de 6h30 à 10h30.",
  },
];

const directory: DirectoryGuest[] = [
  {
    id: "G-10233",
    name: "Sarah Kimani",
    initials: "SK",
    status: "Arrives today · BK-20431",
    tier: "Gold",
    here: true,
    duplicate: true,
    candidate: false,
  },
  {
    id: "G-11871",
    name: "Sara Kimani",
    initials: "SK",
    status: "Ishyamba Forest Lodge only · Aug 2025",
    tier: "",
    here: false,
    duplicate: true,
    candidate: true,
  },
  {
    id: "G-10871",
    name: "Thomas Weber",
    initials: "TW",
    status: "In-house · room 305",
    tier: "Silver",
    here: true,
    duplicate: false,
    candidate: false,
  },
  {
    id: "G-10912",
    name: "Aisha Mohammed",
    initials: "AM",
    status: "In-house · room 208",
    tier: "",
    here: true,
    duplicate: false,
    candidate: false,
  },
  {
    id: "G-10955",
    name: "Daniel Okafor",
    initials: "DO",
    status: "In-house · room 402",
    tier: "Silver",
    here: true,
    duplicate: false,
    candidate: false,
  },
  {
    id: "G-11902",
    name: "Pierre Laurent",
    initials: "PL",
    status: "Arrives today · BK-20452",
    tier: "",
    here: true,
    duplicate: false,
    candidate: false,
  },
  {
    id: "G-11014",
    name: "Fatuma Hassan",
    initials: "FH",
    status: "Arrives today · BK-20449",
    tier: "",
    here: true,
    duplicate: false,
    candidate: false,
  },
  {
    id: "G-10340",
    name: "Grace Achieng",
    initials: "GA",
    status: "Checked out 11 Oct",
    tier: "Gold",
    here: true,
    duplicate: false,
    candidate: false,
  },
  {
    id: "G-11930",
    name: "Yuki Tanaka",
    initials: "YT",
    status: "Arrives 15 Oct · BK-20447",
    tier: "",
    here: true,
    duplicate: false,
    candidate: false,
  },
  {
    id: "G-10101",
    name: "Jean Bosco Nkurunziza",
    initials: "JB",
    status: "Last stay June 2026",
    tier: "Silver",
    here: true,
    duplicate: false,
    candidate: false,
  },
  {
    id: "G-10456",
    name: "Marie Claire Uwimana",
    initials: "MU",
    status: "Ishyamba Forest Lodge · Sep 2026",
    tier: "",
    here: false,
    duplicate: false,
    candidate: false,
  },
];

const guestProfiles: GuestProfile[] = [
  {
    id: "G-10233",
    name: "Sarah Kimani",
    initials: "SK",
    since: "guest since March 2025",
    nationality: "Kenyan",
    pastStays: 2,
    candidateId: "G-11871",
    chips: [
      { label: "Gold · Amahoro Rewards", tone: "default" },
      { label: "Arrives today 13:00", tone: "accent" },
    ],
    links: [
      { label: "Booking BK-20431", board: "ReservationDetail", primary: false },
      { label: "Message", board: "Messages", primary: false },
      { label: "Check in", board: "CheckIn", primary: true },
    ],
    compare: [
      { field: "Name", profile: "Sarah Kimani", candidate: "Sara Kimani", match: "Similar", tone: "warning" },
      { field: "Phone", profile: "+254 712 445 118", candidate: "+254 712 445 118", match: "Same", tone: "success" },
      {
        field: "Email",
        profile: "s.kimani@mail.co.ke",
        candidate: "sarakimani@gmail.com",
        match: "Different",
        tone: "default",
      },
      {
        field: "ID document",
        profile: "Passport •••• 417",
        candidate: "National ID •••• 932",
        match: "Different type",
        tone: "warning",
      },
      {
        field: "Stays",
        profile: "Isangano, Mar 2025",
        candidate: "Ishyamba, Aug 2025 (walk-in)",
        match: "No overlap",
        tone: "success",
      },
    ],
    contact: [
      { label: "Phone", value: "+254 712 445 118", muted: false },
      { label: "Email", value: "s.kimani@mail.co.ke", muted: false },
      { label: "Home", value: "Nairobi, Kenya", muted: false },
      { label: "Languages", value: "English, Swahili", muted: false },
      { label: "Booked by", value: "Akagera Horizon Travel · agent, booking contact for BK-20431", muted: false },
      { label: "Pays", value: "Sarah Kimani · card or MoMo at the desk", muted: false },
      { label: "Sharing", value: "Michael Otieno · occupant on BK-20431, no profile", muted: false },
      { label: "Company", value: "None recorded", muted: true },
    ],
    document: {
      title: "Passport · Kenya",
      masked: "AK•••••417",
      number: "AK0914417",
      detail: "Expires 2031 · checked at the desk 14 Mar 2025 · used for the police guest register",
    },
    accessLog: [
      { icon: "ArrowUpFromLine", text: "2 Mar 2025 · uploaded by the guest in the app (pre-arrival)" },
      { icon: "Eye", text: "14 Mar 2025 · Eric Habimana · check-in identity check" },
    ],
    marketing: { optedIn: "Opted in 2 Mar 2025 in the guest app. Turning it off takes effect at once." },
    consent: [
      { label: "Service email", value: "Allowed for bookings and stays" },
      { label: "SMS", value: "No consent recorded" },
    ],
    requests: [
      {
        icon: "Pencil",
        title: "PR-0193 · Correct date of birth",
        detail: "Received 9 Oct by email · with the privacy lead · due 8 Nov",
        state: "In review",
        tone: "warning",
        emphasis: "soft",
      },
    ],
    preferences: [
      { icon: "House", text: "High floor with a lake view", src: "Guest app · 2 Mar 2025" },
      { icon: "Moon", text: "Firm pillows", src: "Housekeeping note on ST-8790 · Beatrice Mukandori" },
      { icon: "Cup", text: "No pork", src: "Told the desk 14 Mar 2025 · Eric Habimana" },
      {
        icon: "Lock",
        text: "Health information on file",
        src: "Shared with Isangano Terrace only, with the guest’s consent · hidden from the desk",
      },
    ],
    personalisation: "Personalisation consent · 2 Mar 2025",
    stays: [
      {
        icon: "Calendar",
        title: "BK-20431 · Isangano Lakeside Hotel",
        detail: "12 to 14 Oct 2026 · room 204 Deluxe Lake View · 2 adults",
        state: "Arrives today",
        tone: "accent",
        emphasis: "soft",
      },
      {
        icon: "House",
        title: "ST-8790 · Isangano Lakeside Hotel",
        detail: "14 to 17 Mar 2025 · room 305 · 3 nights",
        state: "Checked out",
        tone: "default",
        emphasis: "soft",
      },
      {
        icon: "House",
        title: "ST-7402 · Ishyamba Forest Lodge",
        detail: "9 to 11 Aug 2025 · details held by Ishyamba",
        state: "Checked out",
        tone: "default",
        emphasis: "soft",
      },
    ],
    mergedStay: {
      icon: "BranchesRight",
      title: "ST-7488 · Ishyamba Forest Lodge",
      detail: "14 Aug 2025 · moved from G-11871 by merge",
      state: "Checked out",
      tone: "default",
      emphasis: "soft",
    },
    rewards: { tier: "Gold", points: 12450, next: "Platinum", nextAt: 20000 },
    points: [
      { text: "Earned on ST-8790 · Mar 2025", points: "+ 1,380" },
      { text: "Reversed · BK-20117 cancelled Jul 2025", points: "− 450" },
      { text: "Welcome bonus · Gold match", points: "+ 11,520" },
    ],
  },
];

const viewPurposes: ViewPurpose[] = [
  { id: "Check-in identity check", hint: "The guest is at the desk now" },
  { id: "Police guest register", hint: "Required entry for this stay" },
  { id: "Guest asked to confirm details", hint: "At the guest’s own request" },
  { id: "Incident or dispute", hint: "A manager is told automatically" },
];

const offlineArrivals: OfflineArrival[] = [
  {
    id: "PL",
    name: "Pierre Laurent",
    booking: "BK-20452",
    roomType: "Standard Queen",
    room: "207",
    eta: "10:00",
    statusOffline: "Clean",
    toneOffline: "success",
    statusOnline: "Clean",
    queued: true,
    noRoom: false,
    dirty: false,
    conflict: true,
  },
  {
    id: "FH",
    name: "Fatuma Hassan",
    booking: "BK-20449",
    roomType: "Twin",
    room: "210",
    eta: "10:30",
    statusOffline: "Clean",
    toneOffline: "success",
    statusOnline: "Clean",
    queued: true,
    noRoom: false,
    dirty: false,
    conflict: false,
  },
  {
    id: "SK",
    name: "Sarah Kimani",
    booking: "BK-20431",
    roomType: "Deluxe Lake View",
    room: "204",
    eta: "13:00",
    statusOffline: "Inspected",
    toneOffline: "success",
    statusOnline: "Inspected",
    queued: false,
    noRoom: false,
    dirty: false,
    conflict: false,
  },
  {
    id: "JB",
    name: "Jean Bosco Nkurunziza",
    booking: "BK-20455",
    roomType: "Standard Queen",
    room: "207",
    eta: "16:00",
    statusOffline: "No room yet",
    toneOffline: null,
    statusOnline: "Clean",
    queued: false,
    noRoom: true,
    dirty: false,
    conflict: false,
  },
  {
    id: "MU",
    name: "Marie Claire Uwimana",
    booking: "BK-20457",
    roomType: "Family Suite",
    room: "401",
    eta: "18:00",
    statusOffline: "Dirty at 10:42",
    toneOffline: "warning",
    statusOnline: "Clean",
    queued: false,
    noRoom: false,
    dirty: true,
    conflict: false,
  },
];

const offlineQueue: OfflineAction[] = [
  {
    id: "n1",
    icon: "Pencil",
    title: "Note on ST-8812 · Thomas Weber",
    detail: "10:44 · “Taxi to Kigali at 15:30, confirm with the driver”",
    kind: "note",
    conflict: false,
  },
  {
    id: "r1",
    icon: "BroomMotion",
    title: "Room 209 → Clean",
    detail: "10:46 · reported by Beatrice Mukandori by phone",
    kind: "room",
    conflict: false,
  },
  {
    id: "c1",
    icon: "ArrowRightToSquare",
    title: "Check in Pierre Laurent → room 207",
    detail: "10:47 · passport checked · key card encoded on the local encoder",
    kind: "checkin",
    conflict: true,
  },
  {
    id: "c2",
    icon: "ArrowRightToSquare",
    title: "Check in Fatuma Hassan → room 210",
    detail: "10:49 · national ID checked · key card encoded",
    kind: "checkin",
    conflict: false,
  },
  {
    id: "m1",
    icon: "Wallet",
    title: "Cash RWF 20,000 · Daniel Okafor · folio F-5517",
    detail: "10:50 · laundry and drinks · Till 1",
    kind: "cash",
    conflict: false,
  },
];

const paymentRails: PaymentRail[] = [
  {
    id: "cash",
    mode: "offline",
    icon: "Wallet",
    label: "Cash",
    why: "Can be noted now. Shows as unverified until it syncs and is counted.",
    state: "Note only",
    tone: "warning",
  },
  {
    id: "momo",
    mode: "offline",
    icon: "Smartphone",
    label: "MTN MoMo and Airtel Money",
    why: "Not possible offline: no payment request can reach the provider. Ask the guest to wait or pay cash.",
    state: "Blocked",
    tone: "danger",
  },
  {
    id: "card",
    mode: "offline",
    icon: "CreditCard",
    label: "Card",
    why: "Needs the GT Bank connection.",
    state: "Blocked",
    tone: "danger",
  },
  {
    id: "fiscal",
    mode: "offline",
    icon: "FileCheck",
    label: "Fiscal receipts and checkout",
    why: "Receipts are not issued offline and checkout needs the live folio balance. Sales wait as Draft.",
    state: "Waits",
    tone: "default",
  },
  {
    id: "online-payments",
    mode: "online",
    icon: "Smartphone",
    label: "MoMo, Airtel Money and card",
    why: "Available again. Open the guest’s folio to take a payment.",
    state: "Available",
    tone: "success",
  },
  {
    id: "online-cash",
    mode: "online",
    icon: "Wallet",
    label: "Cash noted offline",
    why: "Synced to folios as unverified. Counted at shift close.",
    state: "Unverified",
    tone: "warning",
  },
  {
    id: "online-fiscal",
    mode: "online",
    icon: "FileCheck",
    label: "Fiscal receipts",
    why: "Drafts from the outage sent to the VSDC with their original request IDs.",
    state: "Sent",
    tone: "default",
  },
];

const cashGuests: CashGuest[] = [
  { id: "DO", label: "Okafor · 402", name: "Daniel Okafor", folio: "F-5517" },
  { id: "AM", label: "Mohammed · 208", name: "Aisha Mohammed", folio: "F-5514" },
  { id: "TW", label: "Weber · 305", name: "Thomas Weber", folio: "F-5521" },
];

const syncConflicts: SyncConflict[] = [
  {
    id: "room-207",
    room: "207",
    foundAt: "10:53",
    sides: [
      {
        source: "Desk 1 · this computer · offline",
        guest: "Pierre Laurent",
        detail: "Checked in 10:47 · key card encoded on the local encoder · in the room now",
      },
      {
        source: "Desk 2 · Aline Uwase · online",
        guest: "Jean Bosco Nkurunziza",
        detail: "Room assigned 10:45 · arrives about 16:00 · no key yet",
      },
    ],
    resolved: {
      keep: "Resolved 10:54 by Eric Habimana. Pierre Laurent keeps 207. Jean Bosco Nkurunziza moved to 209 (Standard Queen, clean). Aline Uwase notified.",
      swap: "Resolved 10:54 by Eric Habimana. Jean Bosco Nkurunziza keeps 207. Pierre Laurent moves to 209; his 207 key card is revoked and a new card must be encoded. Aline Uwase notified.",
    },
  },
];

const conflictChoices: ConflictChoice[] = [
  {
    id: "keep",
    label: "Pierre keeps 207 · move Jean Bosco to 209",
    hint: "209 is clean and the same room type. Jean Bosco has not arrived.",
    suggested: true,
  },
  {
    id: "swap",
    label: "Jean Bosco keeps 207 · move Pierre to 209",
    hint: "Pierre must change rooms and get a new key card.",
    suggested: false,
  },
];

export const fixtures = {
  "stays.stays": stays,
  "stays.stayRecords": stayRecords,
  "stays.folioLines": folioLines,
  "stays.folioPayments": folioPayments,
  "stays.stayHistory": stayHistory,
  "stays.stayAccess": stayAccess,
  "stays.stayDocuments": stayDocuments,
  "stays.lateCheckoutOptions": lateCheckoutOptions,
  "stays.chargeDepartments": chargeDepartments,
  "stays.deskTenders": deskTenders,
  "stays.checkouts": checkouts,
  "stays.checkoutLedger": checkoutLedger,
  "stays.momoTrail": momoTrail,
  "stays.fiscalReceipts": fiscalReceipts,
  "stays.checkoutKeys": checkoutKeys,
  "stays.threads": threads,
  "stays.messageTemplates": messageTemplates,
  "stays.directory": directory,
  "stays.guestProfiles": guestProfiles,
  "stays.viewPurposes": viewPurposes,
  "stays.offlineArrivals": offlineArrivals,
  "stays.offlineQueue": offlineQueue,
  "stays.paymentRails": paymentRails,
  "stays.cashGuests": cashGuests,
  "stays.syncConflicts": syncConflicts,
  "stays.conflictChoices": conflictChoices,
} satisfies FixtureSet;
