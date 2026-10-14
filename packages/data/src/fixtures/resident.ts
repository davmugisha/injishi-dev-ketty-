import type { StockKey } from "../media.ts";
import type { FixtureSet, IconName, PersonaId } from "../types.ts";

/**
 * Embedded-database fixtures for the "resident" area: the resident portal phone app of Olivier Habineza,
 * tenant of unit B-07 at Kacyiru Court Residences (TenantHome, TenantPay, TenantRequests, TenantLease).
 * Values are lifted verbatim from the artifact boards. Plain data only (semantic tones, Gravity icon names,
 * stock image keys) so the Expo app can read the same collections.
 */

export type ResidentTone = "accent" | "success" | "warning" | "danger" | "default" | "info";

// ── Tenancy ──────────────────────────────────────────────────────────────────

/** A move-out notice the resident gave in the app. */
export interface MoveOutNotice {
  moveOut: string;
  reason: string;
  note: string;
  /** When it was sent ("Today 10:42"). */
  sentAt: string;
}

/** The resident's tenancy: unit, lease terms and the caution deposit (keyed by lease reference). */
export interface Tenancy {
  id: string;
  /** Persona who holds the lease. */
  persona: PersonaId;
  unit: string;
  property: string;
  landlord: string;
  landlordTin: string;
  /** Lease status chip in the default state ("Active"). */
  status: string;
  statusTone: ResidentTone;
  term: string;
  /** Last day of the current term ("14 Nov 2026"). */
  endsOn: string;
  endsShort: string;
  rent: number;
  rentDue: string;
  noticePeriod: string;
  deposit: number;
  depositSince: string;
  occupants: string;
  /** Move-out date suggested in the notice form (the last day of the term). */
  moveOutDefault: string;
  /** Earliest move-out date with the required notice, counted from today. */
  earliestMoveOut: string;
  notice: MoveOutNotice | null;
}

/** The month's rent the resident owes (the current charge). */
export interface RentCharge {
  id: string;
  lease: string;
  month: string;
  amount: number;
  due: string;
  dueShort: string;
  dueIn: string;
  status: string;
  statusTone: ResidentTone;
}

/** A verified rent payment, newest first; home shows the latest as "Last payment". */
export interface RentReceipt {
  id: string;
  month: string;
  amount: number;
  verifiedAt: string;
  network: string;
  providerRef: string;
}

/** The mobile money payment of the current charge (artifact: TenantPay status and receipt). */
export interface PaymentIntent {
  id: string;
  charge: string;
  /** Phone the prompt goes to; the confirm sheet shows it masked. */
  phone: string;
  requestedAt: string;
  expiresAt: string;
  verifiedAt: string;
  /** Amount pre-filled when the resident picks a part payment, and the smallest allowed. */
  partDefault: number;
  minPart: number;
  /** How often an unknown result is re-checked with the provider. */
  recheckMinutes: number;
}

/** A mobile money network, with the provider reference it returns for this payment. */
export interface PayNetwork {
  id: string;
  name: string;
  providerRef: string;
}

// ── Home ─────────────────────────────────────────────────────────────────────

export interface ResidentNotice {
  id: string;
  icon: IconName;
  title: string;
  desc: string;
  isNew: boolean;
}

/** A conversation with management (home · Messages). */
export interface MessageThread {
  id: string;
  icon: IconName;
  title: string;
  subtitle: string;
  preview: string;
  unread: number;
}

export interface ThreadMessage {
  id: string;
  thread: string;
  from: "resident" | "management";
  text: string;
  meta: string;
}

// ── Requests and visitors ────────────────────────────────────────────────────

export interface RepairCategory {
  id: string;
  label: string;
}

/** The repair request the resident is writing: chosen category, attached photo, entry permission. */
export interface RepairDraft {
  id: string;
  category: string;
  photo: StockKey;
  staffMayEnter: boolean;
}

export interface RepairRequest {
  id: string;
  title: string;
  desc: string;
  state: string;
  tone: ResidentTone;
  /** Set on requests sent from the app (listed first, newest first). */
  sentAt?: string;
  category?: string;
  staffMayEnter?: boolean;
  photos?: number;
}

/** Defaults of the visitor form and the next code the gate issues. */
export interface VisitorDraft {
  id: string;
  name: string;
  date: string;
  /** The date as the code card spells it ("Saturday 17 Oct"). */
  dateLong: string;
  time: string;
  code: string;
  /** Overnight stays longer than this need management approval. */
  maxNights: number;
}

export interface VisitorPass {
  id: string;
  name: string;
  desc: string;
  state: string;
  tone: ResidentTone;
  code: string;
  /** Set on visitors registered from the app (listed first, newest first). */
  sentAt?: string;
  overnight?: boolean;
}

// ── Lease ────────────────────────────────────────────────────────────────────

export interface RenewalOffer {
  id: string;
  lease: string;
  status: "open" | "accepted" | "declined";
  answerBy: string;
  answerByDay: string;
  months: number;
  starts: string;
  term: string;
  rent: number;
  currentRent: number;
  depositTopUp: number;
  otherTerms: string;
}

export interface LeaseDocument {
  id: string;
  icon: IconName;
  title: string;
  desc: string;
  state: string;
  tone: ResidentTone;
}

/** What happens after a move-out notice (Give notice sheet). */
export interface MoveOutStep {
  id: string;
  icon: IconName;
  title: string;
  desc: string;
}

export interface NoticeReason {
  id: string;
  label: string;
}

// ── Data ─────────────────────────────────────────────────────────────────────

const tenancies: Tenancy[] = [
  {
    id: "L-KC-014",
    persona: "resident",
    unit: "B-07",
    property: "Kacyiru Court Residences",
    landlord: "Amahoro Residences Ltd",
    landlordTin: "TIN 102 345 990",
    status: "Active",
    statusTone: "success",
    term: "15 Nov 2025 – 14 Nov 2026",
    endsOn: "14 Nov 2026",
    endsShort: "14 Nov",
    rent: 950000,
    rentDue: "On the 15th · 5-day grace",
    noticePeriod: "30 days in writing",
    deposit: 1900000,
    depositSince: "15 Nov 2025",
    occupants: "You and Ines Habineza",
    moveOutDefault: "Saturday 14 November 2026",
    earliestMoveOut: "11 Nov",
    notice: null,
  },
];

const rentCharges: RentCharge[] = [
  {
    id: "2026-10",
    lease: "L-KC-014",
    month: "October",
    amount: 950000,
    due: "Thursday 15 October",
    dueShort: "15 Oct",
    dueIn: "in 3 days",
    status: "Not paid yet",
    statusTone: "default",
  },
];

const receipts: RentReceipt[] = [
  {
    id: "2026-09",
    month: "September",
    amount: 950000,
    verifiedAt: "14 Sep 08:12",
    network: "MTN MoMo",
    providerRef: "MP260914.0812.B55210",
  },
];

const paymentIntents: PaymentIntent[] = [
  {
    id: "PI-77162",
    charge: "2026-10",
    phone: "0788 123 412",
    requestedAt: "Today 09:41",
    expiresAt: "09:46",
    verifiedAt: "Today 09:43",
    partDefault: 500000,
    minPart: 1000,
    recheckMinutes: 15,
  },
];

const payNetworks: PayNetwork[] = [
  { id: "mtn", name: "MTN MoMo", providerRef: "MP261012.0941.B77162" },
  { id: "airtel", name: "Airtel Money", providerRef: "AM261012.0941.62218" },
];

const notices: ResidentNotice[] = [
  {
    id: "water-block-b",
    icon: "Droplet",
    title: "Water off in Block B on Wednesday",
    desc: "14 Oct, 09:00–12:00 · tank cleaning · please store water",
    isNew: true,
  },
  {
    id: "renewal-ready",
    icon: "ArrowsRotateRight",
    title: "Your renewal offer is ready",
    desc: "Sent 1 Oct · answer by 15 Oct in your lease",
    isNew: false,
  },
  {
    id: "visitor-codes",
    icon: "Key",
    title: "Visitor codes now expire automatically",
    desc: "28 Sep · register visitors in Requests",
    isNew: false,
  },
];

const threads: MessageThread[] = [
  {
    id: "WO-345",
    icon: "Wrench",
    title: "Kitchen sink leaking",
    subtitle: "With Kacyiru Court management · repair WO-345",
    preview: "Solange: A plumber will come on Tuesday at 10:00.",
    unread: 1,
  },
];

const messages: ThreadMessage[] = [
  {
    id: "WO-345-1",
    thread: "WO-345",
    from: "resident",
    text: "Water is leaking under the kitchen sink. I have put a bucket under it for now.",
    meta: "You · 11 Oct 19:12",
  },
  {
    id: "WO-345-2",
    thread: "WO-345",
    from: "management",
    text: "Thank you, Olivier. A plumber from Kigali Plumbing Co. will come on Tuesday at 10:00. Is it fine to enter if you are at work?",
    meta: "Solange Uwimana · 11 Oct 19:40",
  },
  {
    id: "WO-345-3",
    thread: "WO-345",
    from: "resident",
    text: "Yes, that is fine. Ines will be home after 12.",
    meta: "You · 11 Oct 20:02",
  },
];

const repairCategories: RepairCategory[] = [
  { id: "plumbing", label: "Plumbing" },
  { id: "electrical", label: "Electrical" },
  { id: "doors-windows", label: "Doors and windows" },
  { id: "appliances", label: "Appliances" },
  { id: "other", label: "Something else" },
];

const repairDrafts: RepairDraft[] = [
  { id: "resident", category: "plumbing", photo: "kitchenSinkPipes", staffMayEnter: true },
];

const repairs: RepairRequest[] = [
  {
    id: "WO-345",
    title: "Kitchen sink leaking",
    desc: "WO-345 · sent 11 Oct · plumber Tue 13 Oct, 10:00 · staff may enter",
    state: "Assigned",
    tone: "info",
  },
  {
    id: "WO-322",
    title: "Bedroom window latch broken",
    desc: "WO-322 · fixed 2 Sep · you confirmed it works",
    state: "Closed",
    tone: "success",
  },
  {
    id: "WO-301",
    title: "Low water pressure in shower",
    desc: "WO-301 · fixed 4 Jul",
    state: "Closed",
    tone: "success",
  },
];

const visitorDrafts: VisitorDraft[] = [
  {
    id: "resident",
    name: "Grace Mukamana",
    date: "Sat 17 Oct",
    dateLong: "Saturday 17 Oct",
    time: "10:00–16:00",
    code: "6093",
    maxNights: 7,
  },
];

const visitors: VisitorPass[] = [
  {
    id: "VP-1012-4821",
    name: "Jean Uwizeye",
    desc: "Today 14:00–20:00",
    state: "Expected",
    tone: "info",
    code: "4821",
  },
  {
    id: "VP-1013-7730",
    name: "Kigali Plumbing Co.",
    desc: "Tue 13 Oct 09:30–12:30 · arranged by management for your repair",
    state: "Approved",
    tone: "success",
    code: "7730",
  },
  {
    id: "VP-1004-JU",
    name: "Jean Uwizeye",
    desc: "4 Oct · arrived 15:10 · left 19:02",
    state: "Visited",
    tone: "default",
    code: "",
  },
];

const renewalOffers: RenewalOffer[] = [
  {
    id: "RN-L-KC-014",
    lease: "L-KC-014",
    status: "open",
    answerBy: "Thu 15 Oct",
    answerByDay: "Thursday",
    months: 12,
    starts: "15 Nov",
    term: "15 Nov 2026 – 14 Nov 2027",
    rent: 980000,
    currentRent: 950000,
    depositTopUp: 60000,
    otherTerms: "Unchanged",
  },
];

const leaseDocuments: LeaseDocument[] = [
  {
    id: "lease-v2",
    icon: "FileCheck",
    title: "Signed lease, version 2",
    desc: "Signed by you 9 Nov 2025 · by the landlord 10 Nov 2025",
    state: "Signed by both",
    tone: "success",
  },
  {
    id: "move-in-report",
    icon: "FileText",
    title: "Move-in inspection report",
    desc: "15 Nov 2025 · 24 photos · signed by you",
    state: "Signed",
    tone: "success",
  },
  {
    id: "house-rules-2026",
    icon: "BookOpen",
    title: "House rules 2026",
    desc: "Visitors, noise, parking, waste",
    state: "Acknowledged",
    tone: "default",
  },
];

const moveOutSteps: MoveOutStep[] = [
  {
    id: "acknowledge",
    icon: "Check",
    title: "Management acknowledges your notice",
    desc: "Usually within 2 working days. Rent stays due until your move-out date.",
  },
  {
    id: "inspection",
    icon: "ListCheck",
    title: "Move-out inspection with you",
    desc: "On your last day. Rooms are compared with your move-in photos.",
  },
  {
    id: "settlement",
    icon: "ScalesBalanced",
    title: "Caution deposit settlement",
    desc: "Any proposed deduction comes with evidence. You can accept or dispute each one.",
  },
  {
    id: "refund",
    icon: "Vault",
    title: "Refund of the balance",
    desc: "Paid to your mobile money or bank after approval. Shown as pending until the provider confirms.",
  },
];

const noticeReasons: NoticeReason[] = [
  { id: "kigali", label: "Moving elsewhere in Kigali" },
  { id: "leaving", label: "Leaving Kigali" },
  { id: "own-home", label: "Buying or building a home" },
  { id: "terms", label: "Rent or lease terms" },
  { id: "other", label: "Something else" },
];

export const fixtures = {
  "resident.tenancies": tenancies,
  "resident.rentCharges": rentCharges,
  "resident.receipts": receipts,
  "resident.paymentIntents": paymentIntents,
  "resident.payNetworks": payNetworks,
  "resident.notices": notices,
  "resident.threads": threads,
  "resident.messages": messages,
  "resident.repairCategories": repairCategories,
  "resident.repairDrafts": repairDrafts,
  "resident.repairs": repairs,
  "resident.visitorDrafts": visitorDrafts,
  "resident.visitors": visitors,
  "resident.renewalOffers": renewalOffers,
  "resident.leaseDocuments": leaseDocuments,
  "resident.moveOutSteps": moveOutSteps,
  "resident.noticeReasons": noticeReasons,
} satisfies FixtureSet;
