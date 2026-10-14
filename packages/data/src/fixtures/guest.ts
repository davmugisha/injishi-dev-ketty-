import type { StockKey } from "../media.ts";
import type { BoardId, FixtureSet, IconName } from "../types.ts";

/**
 * Embedded-database fixtures for the "guest" area: the hotel guest's phone app — upcoming trip (GuestTrip),
 * pre-arrival check-in (GuestPreArrival), in-stay home (GuestStay), digital key (GuestKey), requests and
 * messages (GuestRequests), bill and receipts (GuestFolio) and review and points (GuestReview).
 * Values are lifted verbatim from the artifact boards. Plain data only (semantic tones, Gravity UI icon names,
 * board ids and stock photo keys), so the web and Expo apps read the same collections.
 */

export type GuestTone = "accent" | "success" | "warning" | "danger" | "default" | "info";

/** Marker state of a timeline step. */
export type GuestStepStatus = "success" | "current" | "default" | "warning";

// ── Trips (GuestTrip) ────────────────────────────────────────────────────────

/** A booking in the guest's trip list (the "Upcoming" and "Past" tabs). */
export interface GuestTrip {
  /** Booking reference, e.g. "BK-20431". */
  id: string;
  status: "upcoming" | "past";
  property: string;
  /** Line under the property name: place, dates and nights. */
  summary: string;
  /** Property thumbnail. */
  photo: StockKey;
  /** Past trips: where the review stands. */
  review: string | null;
  reviewTone: GuestTone | null;
  /** Past trips: loyalty points the stay earned. */
  points: number | null;
}

/** The upcoming booking in full (trip card, booking link, pre-arrival and policy). */
export interface GuestBooking {
  id: string;
  property: string;
  /** Short property name used in sentences and headers ("Isangano Lakeside"). */
  shortName: string;
  location: string;
  status: string;
  statusTone: GuestTone;
  photo: StockKey;
  photoCaption: string;
  checkIn: { day: string; time: string };
  checkOut: { day: string; time: string };
  room: string;
  guests: string;
  /** Room total for the stay, RWF. */
  roomTotal: number;
  deposit: {
    amount: number;
    icon: IconName;
    method: string;
    ref: string;
    at: string;
    status: string;
    tone: GuestTone;
  };
  /** When the booking was linked to the guest's account. */
  linkedOn: string;
  /** Example of a stay code, shown as the field placeholder. */
  stayCodeExample: string;
  policy: { version: string; agreedOn: string };
  /** When the hotel last updated its arrival guide. */
  guideUpdated: string;
  preArrival: { done: number; steps: number };
}

/** One entry of the hotel's arrival guide. */
export interface ArrivalGuideEntry {
  id: string;
  icon: IconName;
  title: string;
  text: string;
}

/** A cancellation tier of the booking's policy; `current` is the tier in force now. */
export interface CancellationTier {
  id: string;
  when: string;
  what: string;
  state: string;
  tone: GuestTone;
  current: boolean;
}

/** A hotel team the guest can message before arrival. */
export interface HotelDepartment {
  id: string;
  label: string;
  hours: string;
  open: boolean;
}

/** A message in one of the guest's conversations with the hotel. */
export interface GuestMessage {
  id: string;
  /** "booking" = before arrival (GuestTrip), "stay" = during the stay (GuestRequests). */
  thread: "booking" | "stay";
  /** "day" is a date separator. */
  kind: "day" | "guest" | "staff";
  text: string;
  /** Sender, team, time and read state; empty for date separators. */
  meta: string;
  /** Staff initials for the avatar. */
  initials: string | null;
  /** The guest attached a photo. */
  photo: boolean;
  /** A request created from this message, e.g. "Bathroom tap · Done". */
  request: string | null;
}

// ── Pre-arrival check-in (GuestPreArrival) ───────────────────────────────────

/** The guest's pre-arrival answers for a booking, as pre-filled for the form. */
export interface PreArrivalForm {
  /** Booking reference. */
  id: string;
  /** Selected ID document (guest.idDocuments id). */
  document: string;
  /** Country that issued the document. */
  issuedBy: string;
  /** Last digits of the document number. */
  documentEnding: string;
  photoSize: string;
  /** Arrival slot (guest.arrivalSlots id). */
  slot: string;
  /** Travel mode (guest.travelModes id). */
  travel: string;
  plate: string;
  /** Pillow (guest.pillows id). */
  pillow: string;
  /** Dietary needs (guest.diets ids). */
  diets: string[];
  /** Keep the preferences for future stays. */
  remember: boolean;
  fullName: string;
  phone: string;
  email: string;
  /** Country of residence (guest.countries id). */
  country: string;
  /** Other adults on the booking. */
  companions: { id: string; label: string; note: string; status: string }[];
  /** When the hotel receives the answers. */
  receivedAt: string;
}

export interface IdDocumentType {
  id: string;
  label: string;
  /** Upload prompt for this document. */
  prompt: string;
}

/** One point of "How your ID is used". */
export interface IdPrivacyPoint {
  id: string;
  icon: IconName;
  title: string;
  text: string;
}

export interface ArrivalSlot {
  id: string;
  label: string;
  hint: string;
  /** Advice shown when the slot is chosen. */
  noteTitle: string | null;
  noteText: string | null;
}

/** A plain choice in the pre-arrival form (travel mode, pillow, dietary need, country). */
export interface GuestOption {
  id: string;
  label: string;
}

/** A step of "What happens next" after sending the pre-arrival answers. */
export interface PreArrivalNextStep {
  id: string;
  status: GuestStepStatus;
  icon: IconName;
  title: string;
  detail: string;
}

// ── Stay (GuestStay, GuestKey) ───────────────────────────────────────────────

/** The guest's current stay. */
export interface GuestStayRecord {
  /** Stay reference, e.g. "ST-8812". */
  id: string;
  property: string;
  initials: string;
  booking: string;
  folio: string;
  room: string;
  roomType: string;
  floor: string;
  /** "Thursday 15 October · night 2 of 2". */
  today: string;
  checkedIn: string;
  checkoutDay: string;
  checkoutTime: string;
  /** Digital key end, as shown on the room card. */
  keyUntil: string;
  /** Digital key end, as shown under the unlock button. */
  keyValidUntil: string;
  keyRequestedAt: string;
  wifi: { network: string; password: string; where: string };
  /** An approved late checkout (the "approved" variant). */
  lateApproval: { until: string; by: string; fee: number; keyUntil: string };
  /** A room move (the key "revoked" variant). */
  move: { from: string; to: string; toType: string; at: string; cancelledAt: string };
}

/** A shortcut tile on the in-stay home. */
export interface StayShortcut {
  id: string;
  icon: IconName;
  title: string;
  desc: string;
  board: BoardId;
}

export interface LateCheckoutOption {
  id: string;
  time: string;
  /** Fee if approved, RWF. */
  fee: number;
  note: string;
}

/** A row of "At the Hotel" (Today and Info tabs). */
export interface HotelInfoRow {
  id: string;
  tab: "today" | "info";
  icon: IconName;
  title: string;
  text: string;
  chip: string | null;
  tone: GuestTone;
}

/** A timeline event of the digital key (progress while issuing, or activity). */
export interface KeyEvent {
  id: string;
  /** "issuing" = waiting for the lock system; "active" / "revoked" = key activity in that state. */
  scenario: "issuing" | "active" | "revoked";
  status: GuestStepStatus;
  icon: IconName;
  title: string;
  detail: string;
}

/** A door the digital key also opens. */
export interface KeyAccessPoint {
  id: string;
  icon: IconName;
  title: string;
  text: string;
}

/** A "Good to Know" note for a key state. */
export interface KeyHelpNote {
  id: string;
  mode: "active" | "provisioning" | "revoked" | "unavailable";
  icon: IconName;
  text: string;
}

// ── Requests and messages (GuestRequests) ────────────────────────────────────

/** A quick request the guest can send, with the form it opens. */
export interface RequestType {
  id: string;
  label: string;
  icon: IconName;
  team: string;
  /** Whether the team is working now. */
  open: boolean;
  /** Who handles it and when. */
  route: string;
  /** What the guest can expect once it is sent. */
  expect: string;
  noteLabel: string;
  placeholder: string;
  whenLabel: string | null;
  whens: string[];
}

/** A request the guest sent during this stay. */
export interface ServiceRequest {
  id: string;
  icon: IconName;
  title: string;
  team: string;
  status: "sent" | "ack" | "progress" | "done";
  detail: string;
}

/** A channel the hotel uses for stay updates. */
export interface NotifyChannel {
  id: string;
  icon: IconName;
  label: string;
  on: boolean;
  /** Always on (the app). */
  locked: boolean;
  text: string;
  /** Consent record shown while the channel is on. */
  consent: string | null;
}

/** A recent stay update and how each channel delivered it. */
export interface UpdateDelivery {
  id: string;
  title: string;
  when: string;
  channels: { label: string; tone: GuestTone }[];
  note: string | null;
}

// ── Bill and receipts (GuestFolio) ───────────────────────────────────────────

/** The stay's bill. */
export interface GuestFolioRecord {
  /** Folio number, e.g. "F-5531". */
  id: string;
  room: string;
  stay: string;
  booking: string;
  updatedAt: string;
  checkedOutOn: string;
  closedAt: string;
  /** Tonight's room night, added at night audit (RWF). */
  nextNight: number;
  momoNumber: string;
  fiscal: { number: string; issued: string; seller: string };
  proforma: { date: string; amount: number; nights: number };
}

/** A charge on the bill. */
export interface FolioCharge {
  id: string;
  icon: IconName;
  title: string;
  meta: string;
  /** RWF. */
  amount: number;
  /** When the line is on the bill: in both stages, only after checkout, or only during the stay. */
  stage: "both" | "checked-out" | "in-stay";
  /** Not posted yet (tonight's room night). */
  upcoming: boolean;
}

/** A payment toward the bill; `evidence` is the provider record for each state it can be in. */
export interface FolioPayment {
  /** Payment intent, e.g. "PI-77104". */
  id: string;
  kind: "deposit" | "balance" | "final";
  title: string;
  method: string;
  /** RWF. */
  amount: number;
  /** Receipt date. */
  date: string;
  providerRef: string;
  confirmedAt: string;
  lastCheckedAt: string | null;
  evidence: { pending: string | null; unknown: string | null; verified: string };
}

export interface PaymentMethod {
  id: string;
  icon: IconName;
  label: string;
  note: string;
  available: boolean;
}

// ── Review and points (GuestReview) ──────────────────────────────────────────

/** The guest's review of a stay (draft until submitted). */
export interface GuestReviewRecord {
  /** Booking reference. */
  id: string;
  property: string;
  shortName: string;
  stayLine: string;
  photo: StockKey;
  /** When the double-blind window closes. */
  windowCloses: string;
  windowClosesShort: string;
  overall: number;
  ratings: { id: string; label: string; value: number }[];
  text: string;
  photos: { id: string; caption: string; photo: StockKey }[];
  contact: boolean;
  offers: boolean;
}

/** A photo on the guest's phone that can be added to the review. */
export interface ReviewPhoto {
  id: string;
  caption: string;
  photo: StockKey;
}

/** Loyalty points for the stay. */
export interface GuestRewards {
  id: string;
  program: string;
  stayPoints: number;
  status: string;
  tone: GuestTone;
  note: string;
  lines: { id: string; label: string; amount: number; points: number | null }[];
  confirmed: number;
  goal: number;
  goalLabel: string;
  rule: string;
}

// ── Data ─────────────────────────────────────────────────────────────────────

const trips: GuestTrip[] = [
  {
    id: "BK-20431",
    status: "upcoming",
    property: "Isangano Lakeside Hotel",
    summary: "Rubavu · on the shore of Lake Kivu",
    photo: "isanganoHotelExterior",
    review: null,
    reviewTone: null,
    points: null,
  },
  {
    id: "BK-20188",
    status: "past",
    property: "Ishyamba Forest Lodge",
    summary: "Nyamagabe · 2–4 Aug 2026 · 2 nights",
    photo: "forestLodge",
    review: "Review published",
    reviewTone: "success",
    points: 540,
  },
  {
    id: "BK-19942",
    status: "past",
    property: "Isangano Lakeside Hotel",
    summary: "Rubavu · 9–10 May 2026 · 1 night",
    photo: "isanganoHotelExterior",
    review: "Review window closed",
    reviewTone: "default",
    points: 230,
  },
];

const bookings: GuestBooking[] = [
  {
    id: "BK-20431",
    property: "Isangano Lakeside Hotel",
    shortName: "Isangano Lakeside",
    location: "Rubavu · on the shore of Lake Kivu",
    status: "Confirmed",
    statusTone: "success",
    photo: "deluxeLakeViewBalcony",
    photoCaption: "Deluxe Lake View · balcony over Lake Kivu",
    checkIn: { day: "Wed 14 Oct", time: "from 14:00" },
    checkOut: { day: "Fri 16 Oct", time: "by 11:00" },
    room: "Deluxe Lake View · number given at check-in",
    guests: "2 adults · 2 nights",
    roomTotal: 280000,
    deposit: {
      amount: 140000,
      icon: "Smartphone",
      method: "MTN MoMo",
      ref: "MP261003.0914.K28417",
      at: "Sat 3 Oct 09:14",
      status: "Verified",
      tone: "success",
    },
    linkedOn: "Sat 3 Oct",
    stayCodeExample: "ISG-7Q4K-20431",
    policy: { version: "v2026-03", agreedOn: "3 Oct" },
    guideUpdated: "10 Oct",
    preArrival: { done: 0, steps: 4 },
  },
];

const arrivalGuide: ArrivalGuideEntry[] = [
  {
    id: "getting-here",
    icon: "Route",
    title: "Getting here",
    text: "About 3 h 30 min by road from Kigali via Musanze. We’re on the lakeshore road, 5 minutes from Rubavu town centre.",
  },
  {
    id: "check-in",
    icon: "Clock",
    title: "Check-in from 14:00",
    text: "Arriving earlier? Leave your bags at reception and we’ll message you when your room is ready.",
  },
  {
    id: "parking",
    icon: "Car",
    title: "Parking",
    text: "Free on-site parking for guests. Give your plate number at check-in.",
  },
  {
    id: "id",
    icon: "Passport",
    title: "Bring your ID",
    text: "Passport or national ID for each adult, even if you send it in advance.",
  },
  {
    id: "front-desk",
    icon: "Handset",
    title: "Front desk · 24 hours",
    text: "+250 788 300 420, or message us below.",
  },
];

const cancellationTiers: CancellationTier[] = [
  {
    id: "free",
    when: "More than 7 days before arrival",
    what: "Free cancellation, deposit refunded",
    state: "Ended 7 Oct",
    tone: "default",
    current: false,
  },
  {
    id: "deposit",
    when: "7 days to 48 hours before",
    what: "Deposit of RWF 140,000 is kept",
    state: "Now · until 14:00",
    tone: "warning",
    current: true,
  },
  {
    id: "full",
    when: "Under 48 hours, or no-show",
    what: "Full stay of RWF 280,000 is charged",
    state: "From today 14:00",
    tone: "default",
    current: false,
  },
];

const departments: HotelDepartment[] = [
  { id: "desk", label: "Front desk", hours: "Open 24 hours · usually replies within 15 min", open: true },
  {
    id: "res",
    label: "Reservations",
    hours: "Closed today for staff training · replies from Tue 08:00",
    open: false,
  },
  {
    id: "terrace",
    label: "Isangano Terrace",
    hours: "Restaurant team · 10:00–22:00 · usually within 1 hour",
    open: true,
  },
];

const messages: GuestMessage[] = [
  {
    id: "bk-1",
    thread: "booking",
    kind: "guest",
    text: "Hi! We are driving from Kigali on Wednesday. Is a lake-view room on a higher floor possible?",
    meta: "You · to Front desk · Sat 3 Oct 09:31 · Read",
    initials: null,
    photo: false,
    request: null,
  },
  {
    id: "bk-2",
    thread: "booking",
    kind: "staff",
    text: "Muraho Sarah, thank you for booking with us! I’ve noted a high floor with a lake view. Rooms are assigned on arrival day, so I can’t promise the floor yet.",
    meta: "Eric · Front desk · Sat 3 Oct 09:40",
    initials: "EH",
    photo: false,
    request: null,
  },
  {
    id: "st-day-1",
    thread: "stay",
    kind: "day",
    text: "Wednesday 14 October",
    meta: "",
    initials: null,
    photo: false,
    request: null,
  },
  {
    id: "st-1",
    thread: "stay",
    kind: "staff",
    text: "Muraho Sarah, welcome to Isangano! You’re in room 204. Message us here any time.",
    meta: "Eric · Front desk · 15:14",
    initials: "EH",
    photo: false,
    request: null,
  },
  {
    id: "st-2",
    thread: "stay",
    kind: "guest",
    text: "Thank you! Could we get a table on the Terrace for 20:00 tonight?",
    meta: "You · 15:20 · Read",
    initials: null,
    photo: false,
    request: null,
  },
  {
    id: "st-3",
    thread: "stay",
    kind: "staff",
    text: "Done: a table for two at 20:00 on Isangano Terrace, by the water.",
    meta: "Eric · Front desk · 15:26",
    initials: "EH",
    photo: false,
    request: null,
  },
  { id: "st-day-2", thread: "stay", kind: "day", text: "Today", meta: "", initials: null, photo: false, request: null },
  {
    id: "st-4",
    thread: "stay",
    kind: "guest",
    text: "The bathroom tap drips a little. Not urgent!",
    meta: "You · 08:10 · Read",
    initials: null,
    photo: true,
    request: null,
  },
  {
    id: "st-5",
    thread: "stay",
    kind: "staff",
    text: "Sorry about that, Sarah. I’ve sent it to maintenance as a request so you can follow it.",
    meta: "Aline · Duty manager · 08:16",
    initials: "AU",
    photo: false,
    request: "Bathroom tap · Done",
  },
  {
    id: "st-6",
    thread: "stay",
    kind: "staff",
    text: "Your fresh towels are on the way.",
    meta: "Jeanne · Housekeeping · 19:31",
    initials: "JN",
    photo: false,
    request: null,
  },
];

const preArrival: PreArrivalForm[] = [
  {
    id: "BK-20431",
    document: "passport",
    issuedBy: "Kenya",
    documentEnding: "4471",
    photoSize: "2.1 MB",
    slot: "16-18",
    travel: "car",
    plate: "KDA 512Q",
    pillow: "firm",
    diets: ["veg"],
    remember: false,
    fullName: "Sarah Kimani",
    phone: "+254 712 345 678",
    email: "sarah.kimani@example.com",
    country: "KE",
    companions: [
      {
        id: "guest-2",
        label: "Guest 2 · adult",
        note: "Not added. They can show their ID at the desk.",
        status: "Optional now",
      },
    ],
    receivedAt: "Mon 12 Oct, 10:24",
  },
];

const idDocuments: IdDocumentType[] = [
  { id: "passport", label: "Passport", prompt: "Photo of your passport’s photo page" },
  { id: "nid", label: "National ID card", prompt: "Photo of the front of your national ID" },
];

const idPrivacy: IdPrivacyPoint[] = [
  {
    id: "why",
    icon: "Target",
    title: "Why we ask",
    text: "Only to register your stay at Isangano Lakeside Hotel and confirm who is staying in the room.",
  },
  {
    id: "who",
    icon: "PersonsLock",
    title: "Who can see it",
    text: "Front desk and duty managers at this hotel. Not housekeeping, the restaurant or other businesses on Injishi. It never appears on your bill.",
  },
  {
    id: "how-long",
    icon: "Clock",
    title: "How long it’s kept",
    text: "Under Isangano’s guest-records policy: 12 months after checkout, then deleted.",
  },
  {
    id: "in-person",
    icon: "ShieldCheck",
    title: "Still checked in person",
    text: "Sending it here doesn’t replace the ID check at the desk.",
  },
];

const arrivalSlots: ArrivalSlot[] = [
  {
    id: "early",
    label: "Before 14:00",
    hint: "Early, if a room is ready",
    noteTitle: "Early check-in isn’t guaranteed",
    noteText:
      "If your room isn’t ready, leave your bags at reception and we’ll message you the moment it is. Early check-in may carry a fee, and we always ask first.",
  },
  { id: "14-16", label: "14:00–16:00", hint: "Afternoon", noteTitle: null, noteText: null },
  { id: "16-18", label: "16:00–18:00", hint: "Before sunset", noteTitle: null, noteText: null },
  { id: "18-21", label: "18:00–21:00", hint: "Evening", noteTitle: null, noteText: null },
  {
    id: "late",
    label: "After 21:00",
    hint: "Night team checks you in",
    noteTitle: "Arriving late is fine",
    noteText:
      "Ring the bell at the main entrance after 23:00. Your room is held all night because your deposit is verified.",
  },
];

const travelModes: GuestOption[] = [
  { id: "car", label: "Own car" },
  { id: "taxi", label: "Taxi or moto" },
  { id: "bus", label: "Bus" },
  { id: "unsure", label: "Not sure yet" },
];

const pillows: GuestOption[] = [
  { id: "soft", label: "Soft" },
  { id: "medium", label: "Medium" },
  { id: "firm", label: "Firm" },
  { id: "hypo", label: "Hypoallergenic" },
];

const diets: GuestOption[] = [
  { id: "veg", label: "Vegetarian" },
  { id: "vegan", label: "Vegan" },
  { id: "halal", label: "Halal" },
  { id: "gluten", label: "Gluten-free" },
  { id: "nuts", label: "Nut allergy" },
  { id: "lactose", label: "Lactose-free" },
];

const countries: GuestOption[] = [
  { id: "KE", label: "Kenya" },
  { id: "RW", label: "Rwanda" },
  { id: "UG", label: "Uganda" },
  { id: "TZ", label: "Tanzania" },
  { id: "BI", label: "Burundi" },
  { id: "CD", label: "DR Congo" },
  { id: "GB", label: "United Kingdom" },
  { id: "US", label: "United States" },
  { id: "OTHER", label: "Another country" },
];

const preArrivalNext: PreArrivalNextStep[] = [
  { id: "received", status: "success", icon: "Check", title: "Received by the hotel", detail: "Mon 12 Oct, 10:24" },
  {
    id: "review",
    status: "current",
    icon: "Eye",
    title: "Front desk reviews your details",
    detail: "Usually before your arrival day. We’ll message you if anything is missing.",
  },
  {
    id: "id-check",
    status: "default",
    icon: "Passport",
    title: "ID check and room number on arrival",
    detail: "Wed 14 Oct at reception, with the original document",
  },
  {
    id: "key",
    status: "default",
    icon: "Key",
    title: "Key on your phone, where the room has a digital lock",
    detail: "Otherwise the desk gives you a key card",
  },
];

const stays: GuestStayRecord[] = [
  {
    id: "ST-8812",
    property: "Isangano Lakeside Hotel",
    initials: "IL",
    booking: "BK-20431",
    folio: "F-5531",
    room: "204",
    roomType: "Deluxe Lake View",
    floor: "2nd floor",
    today: "Thursday 15 October · night 2 of 2",
    checkedIn: "Wed 14 Oct, 15:12",
    checkoutDay: "Fri 16 Oct",
    checkoutTime: "11:00",
    keyUntil: "Thu 11:00",
    keyValidUntil: "Fri 16 Oct, 11:00",
    keyRequestedAt: "15:12",
    wifi: { network: "Isangano-Guest", password: "kivu-sunset-204", where: "Free · rooms, Terrace and Lake Bar" },
    lateApproval: { until: "15:00", by: "Eric, front desk", fee: 45000, keyUntil: "Thu 15:00" },
    move: { from: "204", to: "305", toType: "Deluxe Lake View · 3rd floor", at: "16:40", cancelledAt: "16:41" },
  },
];

const stayShortcuts: StayShortcut[] = [
  {
    id: "food",
    icon: "Cup",
    title: "Order food",
    desc: "Isangano Terrace menu · to your room until 22:00",
    board: "QROrder",
  },
  {
    id: "service",
    icon: "BroomMotion",
    title: "Request service",
    desc: "Towels, cleaning, repairs, taxi",
    board: "GuestRequests",
  },
  { id: "messages", icon: "Comments", title: "Messages", desc: "1 new from the front desk", board: "GuestRequests" },
  { id: "bill", icon: "Receipt", title: "Your bill", desc: "RWF 47,500 to pay now", board: "GuestFolio" },
];

const lateCheckoutOptions: LateCheckoutOption[] = [
  { id: "13", time: "13:00", fee: 20000, note: "often possible" },
  { id: "15", time: "15:00", fee: 45000, note: "depends on arrivals" },
  { id: "18", time: "18:00", fee: 70000, note: "half the nightly rate" },
];

const hotelInfo: HotelInfoRow[] = [
  {
    id: "sunset",
    tab: "today",
    icon: "Sun",
    title: "Sunset hour at Lake Bar",
    text: "17:30–19:00 · lower prices on local drinks",
    chip: "Ended",
    tone: "default",
  },
  {
    id: "intore",
    tab: "today",
    icon: "MusicNote",
    title: "Intore dance performance",
    text: "19:30–20:30 · Garden Terrace · free for hotel guests",
    chip: "On now",
    tone: "success",
  },
  {
    id: "room-service",
    tab: "today",
    icon: "Cup",
    title: "Room service",
    text: "Isangano Terrace kitchen until 22:00 · Lake Bar snacks until 23:30",
    chip: "Open",
    tone: "success",
  },
  {
    id: "boat",
    tab: "today",
    icon: "Flag",
    title: "Boat trip on Lake Kivu",
    text: "Tomorrow 07:00 · 2 hours · RWF 25,000 per person · book at the desk",
    chip: null,
    tone: "default",
  },
  {
    id: "terrace",
    tab: "info",
    icon: "Cup",
    title: "Isangano Terrace",
    text: "Restaurant 06:30–22:30 · breakfast included with your room until 10:00",
    chip: null,
    tone: "default",
  },
  {
    id: "ikawa",
    tab: "info",
    icon: "Mug",
    title: "Ikawa Corner",
    text: "Coffee 07:00–19:00 · a separate business, so pay at the counter. It can’t go on your room bill.",
    chip: null,
    tone: "default",
  },
  {
    id: "pool",
    tab: "info",
    icon: "Droplet",
    title: "Pool",
    text: "07:00–19:00 · towels at the pool hut · no lifeguard",
    chip: null,
    tone: "default",
  },
  {
    id: "desk",
    tab: "info",
    icon: "Handset",
    title: "Front desk",
    text: "24 hours · +250 788 300 420 · dial 9 from your room phone",
    chip: null,
    tone: "default",
  },
  {
    id: "emergency",
    tab: "info",
    icon: "ShieldExclamation",
    title: "In an emergency",
    text: "Call the desk on 9. Fire assembly point: the car park by the main gate.",
    chip: null,
    tone: "default",
  },
];

const keyEvents: KeyEvent[] = [
  {
    id: "issuing-checked-in",
    scenario: "issuing",
    status: "success",
    icon: "Check",
    title: "Checked in by Eric, front desk",
    detail: "Wed 14 Oct, 15:12 · room 204",
  },
  {
    id: "issuing-requested",
    scenario: "issuing",
    status: "current",
    icon: "Hourglass",
    title: "Key requested from the lock system",
    detail: "15:12 · waiting for the lock system to confirm",
  },
  {
    id: "issuing-ready",
    scenario: "issuing",
    status: "default",
    icon: "Smartphone",
    title: "Key ready on this phone",
    detail: "You’ll get a notification",
  },
  {
    id: "active-opened-2",
    scenario: "active",
    status: "default",
    icon: "LockOpen",
    title: "Room 204 opened",
    detail: "Thu 15 Oct, 08:02",
  },
  {
    id: "active-opened-1",
    scenario: "active",
    status: "default",
    icon: "LockOpen",
    title: "Room 204 opened",
    detail: "Wed 14 Oct, 15:20",
  },
  {
    id: "active-issued",
    scenario: "active",
    status: "success",
    icon: "Key",
    title: "Key issued at check-in",
    detail: "Wed 14 Oct, 15:14 · confirmed by the lock system",
  },
  {
    id: "revoked-issued",
    scenario: "revoked",
    status: "success",
    icon: "Key",
    title: "Key for room 305 issued",
    detail: "Thu 15 Oct, 16:41 · confirmed by the lock system",
  },
  {
    id: "revoked-cancelled",
    scenario: "revoked",
    status: "default",
    icon: "Ban",
    title: "Key for room 204 cancelled",
    detail: "Thu 15 Oct, 16:41 · confirmed by the lock system",
  },
  {
    id: "revoked-move",
    scenario: "revoked",
    status: "default",
    icon: "ArrowRightArrowLeft",
    title: "Room move by the front desk",
    detail: "Thu 15 Oct, 16:40 · 204 to 305",
  },
];

const keyAccess: KeyAccessPoint[] = [
  { id: "entrance", icon: "House", title: "Main entrance", text: "After 23:00, when the front doors are locked" },
  { id: "pool", icon: "Droplet", title: "Pool gate", text: "07:00–19:00" },
];

const keyHelp: KeyHelpNote[] = [
  {
    id: "active-companion",
    mode: "active",
    icon: "Persons",
    text: "Need a key for your travel companion? The front desk adds one after checking their ID.",
  },
  {
    id: "active-offline",
    mode: "active",
    icon: "CloudSlash",
    text: "If the hotel changes your key, some locks only receive the change the next time they connect. If your key doesn’t work, the front desk gives you a key card straight away.",
  },
  {
    id: "active-checkout",
    mode: "active",
    icon: "Clock",
    text: "The key stops at checkout time. If late checkout is approved, it’s extended for you.",
  },
  {
    id: "provisioning-card",
    mode: "provisioning",
    icon: "Key",
    text: "Don’t want to wait? The front desk can give you a key card now. Your phone key still arrives when it’s ready.",
  },
  {
    id: "provisioning-confirmed",
    mode: "provisioning",
    icon: "ShieldCheck",
    text: "We only show the key once the lock system confirms it, so it won’t fail at the door.",
  },
  {
    id: "revoked-offline",
    mode: "revoked",
    icon: "CloudSlash",
    text: "If the new key doesn’t open 305 straight away, the lock may not have received the change yet. The front desk gives you a key card in the meantime.",
  },
  {
    id: "revoked-left",
    mode: "revoked",
    icon: "Box",
    text: "Left something in 204? Message the front desk and housekeeping will check the room.",
  },
  {
    id: "unavailable-return",
    mode: "unavailable",
    icon: "Clock",
    text: "Leave your card at reception or in the box by the door at checkout, by 11:00 on Fri 16 Oct.",
  },
  {
    id: "unavailable-lost",
    mode: "unavailable",
    icon: "ShieldCheck",
    text: "Lost cards are cancelled at the desk before a new one is made.",
  },
];

const requestTypes: RequestType[] = [
  {
    id: "towels",
    label: "Fresh towels",
    icon: "Droplet",
    team: "Housekeeping",
    open: true,
    route: "Housekeeping · evening team until 22:00 · usually within 20 min",
    expect: "expected by 20:05",
    noteLabel: "Anything else? (optional)",
    placeholder: "For example, leave them at the door",
    whenLabel: null,
    whens: [],
  },
  {
    id: "cleaning",
    label: "Room cleaning time",
    icon: "BroomMotion",
    team: "Housekeeping",
    open: true,
    route: "Housekeeping · day team 08:00–17:00 · turndown 19:00–22:00",
    expect: "scheduled for the time you chose",
    noteLabel: "Notes (optional)",
    placeholder: "For example, please don’t move papers on the desk",
    whenLabel: "When suits you?",
    whens: ["Turndown tonight", "Tomorrow 08:00–10:00", "Skip tomorrow"],
  },
  {
    id: "repair",
    label: "Something’s broken",
    icon: "Wrench",
    team: "Maintenance",
    open: false,
    route: "Maintenance works 07:00–19:00. Non-urgent requests are first in line at 07:00 tomorrow.",
    expect: "first in line at 07:00 tomorrow",
    noteLabel: "What’s wrong?",
    placeholder: "For example, the bedside lamp doesn’t switch on",
    whenLabel: null,
    whens: [],
  },
  {
    id: "taxi",
    label: "Book a taxi",
    icon: "Car",
    team: "Front desk",
    open: true,
    route: "Front desk · open 24 hours · confirms within 10 min",
    expect: "the desk confirms within 10 min",
    noteLabel: "Notes (optional)",
    placeholder: "For example, 2 people and 2 suitcases",
    whenLabel: "When?",
    whens: ["Now", "Tomorrow 09:00", "Tomorrow 11:15"],
  },
  {
    id: "pillow",
    label: "Extra pillow or blanket",
    icon: "Moon",
    team: "Housekeeping",
    open: true,
    route: "Housekeeping · evening team until 22:00 · usually within 20 min",
    expect: "expected by 20:05",
    noteLabel: "Anything else? (optional)",
    placeholder: "For example, a firm pillow",
    whenLabel: "What do you need?",
    whens: ["Extra pillow", "Blanket"],
  },
];

const serviceRequests: ServiceRequest[] = [
  {
    id: "towels",
    icon: "Droplet",
    title: "Fresh towels × 2",
    team: "Housekeeping",
    status: "ack",
    detail: "Acknowledged by Housekeeping (Jeanne) at 19:31 · on the way, expected by 19:55",
  },
  {
    id: "taxi",
    icon: "Car",
    title: "Taxi to Gisenyi market, tomorrow 09:00",
    team: "Front desk",
    status: "sent",
    detail: "Sent 19:36 · the desk confirms the fare within 10 min",
  },
  {
    id: "tap",
    icon: "Wrench",
    title: "Bathroom tap dripping",
    team: "Maintenance",
    status: "done",
    detail: "Fixed by Jean-Paul at 11:20 today · created from your message to the front desk",
  },
];

const notifyChannels: NotifyChannel[] = [
  {
    id: "app",
    icon: "Bell",
    label: "In the app",
    on: true,
    locked: true,
    text: "Always on during your stay, so nothing is lost if a text fails.",
    consent: null,
  },
  {
    id: "email",
    icon: "Envelope",
    label: "Email",
    on: true,
    locked: false,
    text: "sarah.kimani@example.com",
    consent: null,
  },
  {
    id: "sms",
    icon: "Smartphone",
    label: "SMS",
    on: true,
    locked: false,
    text: "+254 712 345 678 · I agree to texts about this stay from Isangano Lakeside Hotel. Reply STOP to opt out. Standard rates may apply.",
    consent: "Consent recorded at check-in, Wed 14 Oct 15:13",
  },
  {
    id: "wa",
    icon: "Comment",
    label: "WhatsApp",
    on: false,
    locked: false,
    text: "+254 712 345 678 · I agree to WhatsApp messages about this stay from Isangano Lakeside Hotel. Turn off any time here.",
    consent: "Consent recorded today at 19:40",
  },
];

const updateDeliveries: UpdateDelivery[] = [
  {
    id: "towels",
    title: "Towels acknowledged by Housekeeping",
    when: "19:31",
    channels: [
      { label: "App · delivered", tone: "success" },
      { label: "SMS · sending", tone: "warning" },
    ],
    note: null,
  },
  {
    id: "tap",
    title: "Bathroom tap fixed",
    when: "11:20",
    channels: [
      { label: "App · delivered", tone: "success" },
      { label: "Email · delivered", tone: "success" },
      { label: "SMS · not delivered", tone: "danger" },
    ],
    note: "Your network didn’t accept the text after 2 tries. The update is still saved here.",
  },
  {
    id: "key",
    title: "Your key for room 204 is ready",
    when: "Tue 15:14",
    channels: [
      { label: "App · delivered", tone: "success" },
      { label: "SMS · delivered", tone: "success" },
    ],
    note: null,
  },
];

const folios: GuestFolioRecord[] = [
  {
    id: "F-5531",
    room: "204",
    stay: "ST-8812",
    booking: "BK-20431",
    updatedAt: "Thu 15 Oct, 19:40",
    checkedOutOn: "Fri 16 Oct",
    closedAt: "Fri 16 Oct, 10:58",
    nextNight: 140000,
    momoNumber: "078 841 2097",
    fiscal: {
      number: "EBM-0104471-00937",
      issued: "Fri 16 Oct, 10:59",
      seller: "Amahoro Hospitality Ltd · TIN 102 345 678",
    },
    proforma: { date: "Sat 3 Oct", amount: 280000, nights: 2 },
  },
];

const folioCharges: FolioCharge[] = [
  {
    id: "night-1",
    icon: "House",
    title: "Room night · Deluxe Lake View",
    meta: "Wed 14 Oct · front office · tax B",
    amount: 140000,
    stage: "both",
    upcoming: false,
  },
  {
    id: "dinner",
    icon: "Cup",
    title: "Dinner for 2 · Isangano Terrace",
    meta: "Wed 14 Oct, 20:40 · order T-2291 · tax B",
    amount: 38500,
    stage: "both",
    upcoming: false,
  },
  {
    id: "laundry",
    icon: "TShirt",
    title: "Laundry · 3 items",
    meta: "Thu 15 Oct, 10:15 · housekeeping · tax B",
    amount: 9000,
    stage: "both",
    upcoming: false,
  },
  {
    id: "night-2",
    icon: "House",
    title: "Room night · Deluxe Lake View",
    meta: "Thu 15 Oct · posted at night audit · tax B",
    amount: 140000,
    stage: "checked-out",
    upcoming: false,
  },
  {
    id: "juices",
    icon: "Cup",
    title: "Lake Bar · 2 fresh juices",
    meta: "Thu 15 Oct, 21:10 · order B-1187 · tax B",
    amount: 6000,
    stage: "checked-out",
    upcoming: false,
  },
  {
    id: "night-2-upcoming",
    icon: "Moon",
    title: "Room night · Deluxe Lake View",
    meta: "Thu 15 Oct · posts at night audit, around 02:00",
    amount: 140000,
    stage: "in-stay",
    upcoming: true,
  },
];

const folioPayments: FolioPayment[] = [
  {
    id: "PI-77104",
    kind: "deposit",
    title: "Deposit",
    method: "MTN MoMo · 078 841 2097",
    amount: 140000,
    date: "Sat 3 Oct",
    providerRef: "MP261003.0914.K28417",
    confirmedAt: "09:14",
    lastCheckedAt: null,
    evidence: {
      pending: null,
      unknown: null,
      verified: "Ref MP261003.0914.K28417 · PI-77104 · confirmed by MTN, Sat 3 Oct 09:14",
    },
  },
  {
    id: "PI-77163",
    kind: "balance",
    title: "Balance",
    method: "MTN MoMo · 078 841 2097",
    amount: 47500,
    date: "Thu 15 Oct",
    providerRef: "MP261015.1946.R55120",
    confirmedAt: "19:46",
    lastCheckedAt: "19:48",
    evidence: {
      pending: "PI-77163 · request sent 19:46 · waiting for your approval",
      unknown: "PI-77163 · no answer from MTN yet · checking, last at 19:48",
      verified: "Ref MP261015.1946.R55120 · PI-77163 · confirmed by MTN, Thu 15 Oct 19:46",
    },
  },
  {
    id: "PI-77188",
    kind: "final",
    title: "Final balance",
    method: "MTN MoMo · 078 841 2097",
    amount: 146000,
    date: "Fri 16 Oct",
    providerRef: "MP261016.1052.T90418",
    confirmedAt: "10:52",
    lastCheckedAt: null,
    evidence: {
      pending: null,
      unknown: null,
      verified: "Ref MP261016.1052.T90418 · PI-77188 · confirmed by MTN, Fri 16 Oct 10:52",
    },
  },
];

const paymentMethods: PaymentMethod[] = [
  { id: "mtn", icon: "Smartphone", label: "MTN MoMo", note: "078 841 2097 · used for your deposit", available: true },
  {
    id: "airtel",
    icon: "Smartphone",
    label: "Airtel Money",
    note: "Enter your Airtel number below",
    available: true,
  },
  {
    id: "card",
    icon: "CreditCard",
    label: "Card",
    note: "Not in the app yet. Pay by card at the front desk.",
    available: false,
  },
];

const reviews: GuestReviewRecord[] = [
  {
    id: "BK-20431",
    property: "Isangano Lakeside Hotel",
    shortName: "Isangano Lakeside",
    stayLine: "Isangano Lakeside Hotel · Tue 14 – Fri 16 Oct · checked out today, 10:35",
    photo: "isanganoHotelExterior",
    windowCloses: "Fri 30 Oct",
    windowClosesShort: "30 Oct",
    overall: 4,
    ratings: [
      { id: "clean", label: "Cleanliness", value: 5 },
      { id: "staff", label: "Staff", value: 5 },
      { id: "location", label: "Location", value: 4 },
      { id: "value", label: "Value for money", value: 0 },
    ],
    text: "Lovely room right above the lake and a very kind front desk team: Eric sorted our dinner table within minutes. The dripping tap was fixed the next morning. Breakfast was good but got busy after 08:30.",
    photos: [
      { id: "lake-view", caption: "Lake view from 204", photo: "deluxeLakeViewBalcony" },
      { id: "terrace-dinner", caption: "Terrace dinner", photo: "lakeViewTerraceSunset" },
    ],
    contact: false,
    offers: false,
  },
];

const reviewPhotoRoll: ReviewPhoto[] = [
  { id: "garden-terrace", caption: "Garden Terrace", photo: "gardenTerraceDusk" },
  { id: "room-204", caption: "Room 204", photo: "deluxeLakeViewRoom" },
  { id: "lake-bar", caption: "Lake Bar", photo: "lakeBar" },
  { id: "breakfast", caption: "Breakfast", photo: "hotelBreakfast" },
];

const rewards: GuestRewards[] = [
  {
    id: "amahoro-rewards",
    program: "Amahoro Rewards",
    stayPoints: 649,
    status: "Pending",
    tone: "warning",
    note: "For this stay. Pending until the front desk closes your checkout bill (F-5531), then confirmed. Points are reversed if the stay is cancelled or refunded.",
    lines: [
      { id: "rooms", label: "Rooms", amount: 280000, points: 560 },
      { id: "dining", label: "Dining", amount: 44500, points: 89 },
      { id: "laundry", label: "Laundry", amount: 9000, points: null },
    ],
    confirmed: 1240,
    goal: 2000,
    goalLabel: "for a free late checkout",
    rule: "Earn rule v2026.2, from 1 Jul 2026: 1 point per RWF 500 on rooms and dining. Points have no cash value. Joined Sat 3 Oct with your consent.",
  },
];

export const fixtures = {
  "guest.trips": trips,
  "guest.bookings": bookings,
  "guest.arrivalGuide": arrivalGuide,
  "guest.cancellationTiers": cancellationTiers,
  "guest.departments": departments,
  "guest.messages": messages,
  "guest.preArrival": preArrival,
  "guest.idDocuments": idDocuments,
  "guest.idPrivacy": idPrivacy,
  "guest.arrivalSlots": arrivalSlots,
  "guest.travelModes": travelModes,
  "guest.pillows": pillows,
  "guest.diets": diets,
  "guest.countries": countries,
  "guest.preArrivalNext": preArrivalNext,
  "guest.stays": stays,
  "guest.stayShortcuts": stayShortcuts,
  "guest.lateCheckoutOptions": lateCheckoutOptions,
  "guest.hotelInfo": hotelInfo,
  "guest.keyEvents": keyEvents,
  "guest.keyAccess": keyAccess,
  "guest.keyHelp": keyHelp,
  "guest.requestTypes": requestTypes,
  "guest.serviceRequests": serviceRequests,
  "guest.notifyChannels": notifyChannels,
  "guest.updateDeliveries": updateDeliveries,
  "guest.folios": folios,
  "guest.folioCharges": folioCharges,
  "guest.folioPayments": folioPayments,
  "guest.paymentMethods": paymentMethods,
  "guest.reviews": reviews,
  "guest.reviewPhotoRoll": reviewPhotoRoll,
  "guest.rewards": rewards,
} satisfies FixtureSet;
