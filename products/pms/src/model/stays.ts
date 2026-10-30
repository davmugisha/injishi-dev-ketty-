/**
 * What the screens of a stay draw: its folio, check out, the guest directory, messages and the offline desk.
 *
 * Declared here since ADR-074 stage 4: the product owns the shapes its views draw, copied verbatim from
 * `@injishi/data/fixtures/stays.ts` with every type they reference. The demo fixtures keep matching
 * declarations for their rows until stage 9, and every page that passes those rows into a view is where the
 * compiler checks the two still agree.
 */
import type { BoardId, IconName, Tone } from "./shared.ts";

/** Chip emphasis: "soft" for states, "tertiary" for quiet empty states ("None", "Not allowed"). */
export type ChipEmphasis = "soft" | "tertiary";

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
