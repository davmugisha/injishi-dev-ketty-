/**
 * What the guest's own phone screens draw: the trip, the stay, pre arrival, the key, the bill and requests.
 *
 * Declared here since ADR-074 stage 4: the product owns the shapes its views draw, copied verbatim from
 * `@injishi/data/fixtures/guest.ts` with every type they reference. The demo fixtures keep matching
 * declarations for their rows until stage 9, and every page that passes those rows into a view is where the
 * compiler checks the two still agree.
 */
import type { BoardId, IconName, StockKey } from "./shared.ts";

export type GuestTone = "accent" | "success" | "warning" | "danger" | "default" | "info";

/** Marker state of a timeline step. */
export type GuestStepStatus = "success" | "current" | "default" | "warning";

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
