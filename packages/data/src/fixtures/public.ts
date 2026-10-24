import type { StockKey } from "../media.ts";
import type { BoardId, FixtureSet, IconName, PersonaId } from "../types.ts";

/**
 * Embedded-database fixtures for the "public" area: Public · for hosts (PublicHost), Public · help and
 * support (PublicHelp), Training and certification (Training), Broker · work (BrokerWork) and
 * Broker · directory and credits (BrokerDirectory).
 * Collection names are "public.<thing>"; every document has a stable string `id`.
 * Values are lifted verbatim from the artifact boards (node tools/artifact/extract.mjs <Board>).
 */

export type Tone = "accent" | "success" | "warning" | "danger" | "default" | "info";

/** Placeholder the artifact prints wherever Injishi's prices still await approval. */
export const PRICING_PENDING = "[PRICING PENDING APPROVAL]";

// ── Public · for hosts ───────────────────────────────────────────────────────

/** "How it works": the four steps from sign-up to the first guest. */
export interface HostStep {
  id: string;
  n: number;
  title: string;
  time: string;
  desc: string;
}

export type HostKind = "hotel" | "lodge" | "residence" | "outlet";

/** "Built for how you host": what each kind of business turns on, linking to the screen that does it. */
export interface HostFeature {
  id: string;
  kind: HostKind;
  icon: IconName;
  title: string;
  desc: string;
  board: BoardId;
}

/** "Ready for Rwanda": what Injishi builds in, and the partner gate it still depends on. */
export interface ReadinessItem {
  id: string;
  icon: IconName;
  title: string;
  desc: string;
  gate: string;
  gateIcon: IconName;
}

export interface HostPlan {
  id: string;
  name: string;
  /** Who the plan is for. */
  audience: string;
  /** Billing unit after "per month · ". */
  unit: string;
  popular: boolean;
  items: string[];
}

export interface HostFee {
  id: string;
  label: string;
  value: string;
}

// ── Public · help and support ────────────────────────────────────────────────

export type HelpRole = "owner" | "desk" | "housekeeping" | "finance" | "guest";

export interface HelpGuide {
  id: string;
  role: HelpRole;
  kind: "Guide" | "Video tutorial";
  title: string;
  /** Reading or watching time, e.g. "5 min read" or "4 min". */
  length: string;
  updated: string;
  board: BoardId;
}

export interface ServiceStatus {
  id: string;
  name: string;
  state: string;
  tone: Tone;
}

export interface IncidentUpdate {
  id: string;
  title: string;
  detail: string;
  status: "current" | "warning" | "default";
}

export interface PolicyPoint {
  icon: IconName;
  title: string;
  text: string;
}

export interface PolicyDoc {
  id: "privacy" | "terms" | "cookies";
  label: string;
  version: string;
  effective: string;
  points: PolicyPoint[];
}

export interface DataProcessor {
  id: string;
  name: string;
  purpose: string;
  data: string;
  where: string;
  status: string;
  tone: Tone;
}

/** Businesses the support requester works at (contact form "Business" choice). */
export interface SupportBusiness {
  id: string;
  name: string;
  legalEntity: string;
}

// ── Training and certification ───────────────────────────────────────────────

export type CourseTeam = "front" | "finance" | "hk";

export interface Course {
  id: string;
  team: CourseTeam;
  teamLabel: string;
  title: string;
  photo: StockKey;
  /** Caption printed on the course photo. */
  caption: string;
  desc: string;
  format: string;
  modules: string;
  certificate: string;
  next: string;
  sessionNote: string;
}

export interface CourseSession {
  id: string;
  course: string;
  when: string;
  hours: string;
  venue: string;
  venueSub: string;
  trainer: string;
  trainerInitials: string;
  language: string;
  taken: number;
  capacity: number;
  /** Completed sessions: attendance line instead of seats. */
  attended: string | null;
  /** The learner on this page already holds a seat. */
  mine: boolean;
}

export interface Learner {
  id: string;
  personaId: PersonaId;
  name: string;
  initials: string;
  context: string;
  /** Where "Back to work" goes. */
  home: BoardId;
}

export interface EnrolmentStep {
  id: string;
  title: string;
  detail: string;
}

export interface Enrolment {
  id: string;
  learner: string;
  course: string;
  title: string;
  status: string;
  tone: Tone;
  detail: string;
  /** Pre-course modules done (enrolled courses). */
  progress: { label: string; done: number; total: number } | null;
  note: string | null;
  /** Attendance record (completed courses). */
  attendance: EnrolmentStep[];
}

/** The public certificate register. Only what is printed on the certificate is shown. */
export interface Certificate {
  /** The certificate code, e.g. INJ-FDE-26-0417. */
  id: string;
  status: "valid" | "revoked";
  /** Learner who holds it on this page, when any. */
  learner: string | null;
  /** Holder as printed (shown for valid certificates only). */
  holder: string | null;
  course: string;
  issuedOn: string;
  issuer: string;
  validUntil: string | null;
  revokedOn: string | null;
}

// ── Broker · work ────────────────────────────────────────────────────────────

export interface BrokerRegistration {
  id: string;
  brokerId: string;
  renews: string;
  identity: string;
  areas: string;
  terms: string;
  platformFee: string;
  listed: boolean;
}

export interface BrokerKpi {
  id: string;
  label: string;
  value: number;
  format: {
    style?: "decimal" | "currency";
    currency?: string;
    notation?: "standard" | "compact";
    maximumFractionDigits?: number;
  };
  foot: string;
}

/** A placement moving through Introduced → Viewing → Application → Lease signed (stage 0–3). */
export interface Placement {
  id: string;
  tenant: string;
  unit: string;
  /** Monthly rent in RWF. */
  rent: number;
  stage: 0 | 1 | 2 | 3;
  /** What happened at each stage ("" when the stage has no event yet). */
  when: string[];
}

export interface BrokerLead {
  id: string;
  kind: "tenant" | "landlord";
  initials: string;
  name: string;
  need: string;
  meta: string;
  status: string;
  tone: Tone;
}

export interface BrokerEarning {
  id: string;
  who: string;
  unit: string;
  basis: string;
  /** Fee in RWF. */
  fee: number;
  status: string;
  tone: Tone;
  evidence: string;
}

export interface DisputeEvent {
  id: string;
  title: string;
  detail: string;
  status: "success" | "warning" | "default";
}

export interface BrokerDispute {
  id: string;
  title: string;
  status: string;
  tone: Tone;
  summary: string;
  outcome: string | null;
  evidence: DisputeEvent[];
}

// ── Broker · directory and credits ───────────────────────────────────────────

export interface BrokerCredits {
  id: string;
  balance: number;
  usedThisMonth: number;
  revealsThisMonth: number;
  returned: string;
  priceAndExpiry: string;
}

export interface BrokerFeeTerm {
  id: string;
  label: string;
  value: string;
}

export type ListingPolicy = "open" | "mandate" | "exclusive" | "direct";

export interface DirectoryListing {
  id: string;
  type: "studio" | "house" | "apartment";
  name: string;
  area: string;
  units: string;
  /** Monthly rent in RWF; `rentTo` for a range. */
  rentFrom: number;
  rentTo: number | null;
  landlord: string;
  verified: string;
  policy: ListingPolicy;
  policyLabel: string;
  /** Credits to reveal the landlord's contact. */
  cost: number;
  available: string;
  fee: string;
  phone: string | null;
  email: string | null;
  photo: StockKey;
  caption: string;
  /** Contact already revealed by this broker. */
  revealed: boolean;
  note: string | null;
  blockReason: string | null;
}

export interface CreditLogEntry {
  id: string;
  when: string;
  what: string;
  /** Credits charged (negative) or returned (positive). */
  credits: number;
  outcome: string;
  tone: Tone;
  ref: string;
}

export interface CreditPack {
  id: string;
  credits: number;
  note: string;
}

// ── Data ─────────────────────────────────────────────────────────────────────

const hostSteps: HostStep[] = [
  {
    id: "register",
    n: 1,
    title: "Register",
    time: "About 10 minutes",
    desc: "Your legal business name, TIN, property type and district. One owner account starts the workspace.",
  },
  {
    id: "verify",
    n: 2,
    title: "Verify",
    time: "Usually 1 to 3 working days",
    desc: "Upload your registration and licence documents. Our team checks them before anything is published or paid out.",
  },
  {
    id: "setup",
    n: 3,
    title: "Set up",
    time: "A guided checklist",
    desc: "Rooms or units, rates, staff and their roles, outlets, payment and receipt settings. Import from a spreadsheet.",
  },
  {
    id: "live",
    n: 4,
    title: "Go live",
    time: "When you are ready",
    desc: "Open the front desk, take payments and publish your marketplace listing. Support stays on hand for the first weeks.",
  },
];

const hostFeatures: HostFeature[] = [
  {
    id: "hotel-desk",
    kind: "hotel",
    icon: "Persons",
    title: "Front desk and room rack",
    desc: "Arrivals, check-in, room moves and walk-ins on one screen.",
    board: "FrontDeskToday",
  },
  {
    id: "hotel-housekeeping",
    kind: "hotel",
    icon: "BroomMotion",
    title: "Housekeeping on phones",
    desc: "Rooms assigned in order, inspected and released to the desk.",
    board: "HousekeepingBoard",
  },
  {
    id: "hotel-rates",
    kind: "hotel",
    icon: "Tag",
    title: "Rates and availability",
    desc: "One source of truth for the desk, marketplace and channels.",
    board: "RatesInventory",
  },
  {
    id: "hotel-folios",
    kind: "hotel",
    icon: "Receipt",
    title: "Folios and payments",
    desc: "Charges, mobile money and cards, with every payment status shown honestly.",
    board: "StayFolio",
  },
  {
    id: "hotel-guest-app",
    kind: "hotel",
    icon: "Key",
    title: "Guest app and digital key",
    desc: "Pre-arrival check-in, requests and the live bill on the guest’s phone.",
    board: "GuestTrip",
  },
  {
    id: "hotel-reports",
    kind: "hotel",
    icon: "ChartColumn",
    title: "Owner reports",
    desc: "Occupancy, ADR, RevPAR and collections, explained.",
    board: "Reports",
  },
  {
    id: "lodge-rack",
    kind: "lodge",
    icon: "LayoutCells",
    title: "Tents and rooms in one rack",
    desc: "Mixed unit types, seasons and minimum stays.",
    board: "RoomRack",
  },
  {
    id: "lodge-packages",
    kind: "lodge",
    icon: "Gift",
    title: "Packages and activities",
    desc: "Full board, guided walks and transfers priced from live rates.",
    board: "Packages",
  },
  {
    id: "lodge-offline",
    kind: "lodge",
    icon: "ArrowsRotateLeftSlash",
    title: "Offline desk",
    desc: "Keeps checking guests in when the signal drops, then syncs.",
    board: "OfflineDesk",
  },
  {
    id: "lodge-staff",
    kind: "lodge",
    icon: "Smartphone",
    title: "Staff phones",
    desc: "Tasks, schedules and reports for camp staff.",
    board: "StaffToday",
  },
  {
    id: "lodge-maintenance",
    kind: "lodge",
    icon: "Wrench",
    title: "Maintenance",
    desc: "Work orders with photos, parts and out-of-service blocks.",
    board: "Maintenance",
  },
  {
    id: "lodge-direct",
    kind: "lodge",
    icon: "Globe",
    title: "Direct bookings",
    desc: "Your listing on the Injishi marketplace, paid to your business.",
    board: "Listing",
  },
  {
    id: "residence-units",
    kind: "residence",
    icon: "FolderHouse",
    title: "Units",
    desc: "Every unit with its photos, video tour, rent and tenant.",
    board: "Units",
  },
  {
    id: "residence-leases",
    kind: "residence",
    icon: "FileText",
    title: "Leases",
    desc: "Lease terms, signatures, renewals and notices.",
    board: "ResidenceHome",
  },
  {
    id: "residence-rent-roll",
    kind: "residence",
    icon: "Wallet",
    title: "Rent roll",
    desc: "Monthly rent, partial payments and arrears by unit.",
    board: "ResidenceHome",
  },
  {
    id: "residence-move-outs",
    kind: "residence",
    icon: "ArrowRightFromSquare",
    title: "Deposits and move-outs",
    desc: "Deposits held as liabilities and settled with evidence.",
    board: "ResidenceHome",
  },
  {
    id: "residence-app",
    kind: "residence",
    icon: "House",
    title: "Resident app",
    desc: "Pay rent, raise requests and read the lease.",
    board: "TenantHome",
  },
  {
    id: "residence-service",
    kind: "residence",
    icon: "Persons",
    title: "Service and visitors",
    desc: "Maintenance and visitor access for each unit.",
    board: "ResidenceHome",
  },
  {
    id: "outlet-pos",
    kind: "outlet",
    icon: "Display",
    title: "Point of sale",
    desc: "Tables, split bills, room charges and mobile money.",
    board: "POS",
  },
  {
    id: "outlet-kitchen",
    kind: "outlet",
    icon: "Flame",
    title: "Kitchen display",
    desc: "Tickets by station with timing.",
    board: "KitchenDisplay",
  },
  {
    id: "outlet-qr",
    kind: "outlet",
    icon: "QrCode",
    title: "QR ordering",
    desc: "Guests order from the table or the room.",
    board: "QROrder",
  },
  {
    id: "outlet-stock",
    kind: "outlet",
    icon: "Boxes3",
    title: "Stock and recipes",
    desc: "Purchases, receipts, recipes and variances.",
    board: "StoreHome",
  },
  {
    id: "outlet-merchant",
    kind: "outlet",
    icon: "Briefcase",
    title: "Your own merchant and TIN",
    desc: "Tenant outlets keep their own sales and receipts.",
    board: "OutletsMenus",
  },
  {
    id: "outlet-fiscal",
    kind: "outlet",
    icon: "FileCheck",
    title: "Fiscal receipts",
    desc: "Receipts queued, retried and never duplicated.",
    board: "FiscalReceipts",
  },
];

const readiness: ReadinessItem[] = [
  {
    id: "ebm",
    icon: "FileCheck",
    title: "Fiscal receipts (EBM)",
    desc: "Receipts go through an RRA-certified VSDC connection, queued and retried so none is issued twice.",
    gate: "Subject to certification of our VSDC connection",
    gateIcon: "ShieldExclamation",
  },
  {
    id: "payments",
    icon: "Smartphone",
    title: "MTN MoMo, Airtel Money and cards",
    desc: "One payment step, settled directly to your business account. Every payment shows the provider and reference.",
    gate: "Live payments subject to provider certification",
    gateIcon: "ShieldExclamation",
  },
  {
    id: "tax",
    icon: "Percent",
    title: "Tax rates with dates",
    desc: "VAT and other rates are configured with an effective date and checked before use, never hard-coded.",
    gate: "Rates need sign-off before go-live",
    gateIcon: "Clock",
  },
  {
    id: "data",
    icon: "ShieldCheck",
    title: "Personal data",
    desc: "Built around Rwanda’s data protection law: consent records, access requests and a published processor list.",
    gate: "Hosting location under review",
    gateIcon: "ShieldExclamation",
  },
  {
    id: "government",
    icon: "Hierarchy",
    title: "Government and PSF",
    desc: "Prepare reports and membership applications. Nothing is sent without your approval, and nothing is shared automatically.",
    gate: "Each body confirms its own channel",
    gateIcon: "Lock",
  },
];

const hostPlans: HostPlan[] = [
  {
    id: "starter",
    name: "Starter",
    audience: "Guest houses and small lodges with up to 15 rooms.",
    unit: "one property",
    popular: false,
    items: [
      "Front desk, room rack and housekeeping",
      "Payments and folios",
      "Marketplace listing",
      "Help centre and email support",
    ],
  },
  {
    id: "property",
    name: "Property",
    audience: "Hotels and lodges that run outlets and events.",
    unit: "one property",
    popular: true,
    items: [
      "Everything in Starter",
      "Outlets, POS and kitchen display",
      "Rates, packages and group blocks",
      "Staff roles, roster and attendance",
    ],
  },
  {
    id: "group",
    name: "Group",
    audience: "Several properties or legal entities, including residences.",
    unit: "priced per property",
    popular: false,
    items: [
      "Everything in Property",
      "Residence leasing and rent roll",
      "Consolidated owner reports",
      "Named onboarding lead",
    ],
  },
];

const hostFees: HostFee[] = [
  { id: "registration", label: "Registration fee, by business type", value: PRICING_PENDING },
  { id: "activation", label: "Activation month (your first, partial month)", value: PRICING_PENDING },
  { id: "billing", label: "Billing", value: "On the 1st of each month, with reminders before any retry" },
  { id: "marketplace", label: "Marketplace bookings", value: `Commission ${PRICING_PENDING}` },
];

const helpGuides: HelpGuide[] = [
  {
    id: "invite-team",
    role: "owner",
    kind: "Guide",
    title: "Invite your team and choose their roles",
    length: "5 min read",
    updated: "2 Oct",
    board: "TeamRoles",
  },
  {
    id: "business-health",
    role: "owner",
    kind: "Video tutorial",
    title: "Read your business health page",
    length: "4 min",
    updated: "28 Sep",
    board: "OwnerHome",
  },
  {
    id: "approve-refunds",
    role: "owner",
    kind: "Guide",
    title: "Approve refunds above your limit",
    length: "3 min read",
    updated: "20 Sep",
    board: "Approvals",
  },
  {
    id: "publish-listing",
    role: "owner",
    kind: "Guide",
    title: "Publish your marketplace listing",
    length: "6 min read",
    updated: "1 Oct",
    board: "Listing",
  },
  {
    id: "check-in-fast",
    role: "desk",
    kind: "Video tutorial",
    title: "Check in a guest in under two minutes",
    length: "3 min",
    updated: "5 Oct",
    board: "CheckIn",
  },
  {
    id: "momo-pending",
    role: "desk",
    kind: "Guide",
    title: "When a mobile money payment stays Pending",
    length: "4 min read",
    updated: "12 Oct",
    board: "StayFolio",
  },
  {
    id: "walk-in",
    role: "desk",
    kind: "Guide",
    title: "Take a walk-in with no booking",
    length: "3 min read",
    updated: "18 Sep",
    board: "WalkIn",
  },
  {
    id: "work-offline",
    role: "desk",
    kind: "Guide",
    title: "Work offline when the internet drops",
    length: "5 min read",
    updated: "30 Sep",
    board: "OfflineDesk",
  },
  {
    id: "room-move",
    role: "desk",
    kind: "Video tutorial",
    title: "Move a guest to another room",
    length: "2 min",
    updated: "9 Sep",
    board: "RoomRack",
  },
  {
    id: "room-list",
    role: "housekeeping",
    kind: "Video tutorial",
    title: "Your room list on the phone",
    length: "2 min",
    updated: "3 Oct",
    board: "StaffToday",
  },
  {
    id: "report-broken",
    role: "housekeeping",
    kind: "Guide",
    title: "Report a broken item with a photo",
    length: "2 min read",
    updated: "22 Sep",
    board: "StaffReport",
  },
  {
    id: "inspect-room",
    role: "housekeeping",
    kind: "Guide",
    title: "Inspect and release a room",
    length: "3 min read",
    updated: "15 Sep",
    board: "InspectRoom",
  },
  {
    id: "close-shift",
    role: "finance",
    kind: "Guide",
    title: "Close a cashier shift",
    length: "6 min read",
    updated: "7 Oct",
    board: "ShiftClose",
  },
  {
    id: "receipt-pending",
    role: "finance",
    kind: "Guide",
    title: "A fiscal receipt is stuck at Pending",
    length: "4 min read",
    updated: "10 Oct",
    board: "FiscalReceipts",
  },
  {
    id: "bank-match",
    role: "finance",
    kind: "Video tutorial",
    title: "Match payments to the bank report",
    length: "7 min",
    updated: "25 Sep",
    board: "Reconciliation",
  },
  {
    id: "pay-stay",
    role: "guest",
    kind: "Guide",
    title: "Pay for your stay with MoMo or card",
    length: "2 min read",
    updated: "1 Oct",
    board: "MarketCheckout",
  },
  {
    id: "cancel-refund",
    role: "guest",
    kind: "Guide",
    title: "Cancel a booking and get your refund",
    length: "3 min read",
    updated: "29 Sep",
    board: "GuestAccount",
  },
  {
    id: "pay-rent",
    role: "guest",
    kind: "Guide",
    title: "Pay rent from the resident app",
    length: "2 min read",
    updated: "19 Sep",
    board: "TenantHome",
  },
];

const serviceStatus: ServiceStatus[] = [
  { id: "bookings", name: "Bookings and front desk", state: "Operational", tone: "success" },
  { id: "marketplace", name: "Marketplace and search", state: "Operational", tone: "success" },
  { id: "mtn-momo", name: "MTN MoMo confirmations", state: "Delayed", tone: "warning" },
  { id: "airtel-cards", name: "Airtel Money and cards", state: "Operational", tone: "success" },
  { id: "vsdc", name: "Fiscal receipts (VSDC)", state: "Operational", tone: "success" },
  { id: "messaging", name: "SMS and email", state: "Operational", tone: "success" },
];

const incidentUpdates: IncidentUpdate[] = [
  {
    id: "monitoring",
    title: "Monitoring",
    detail: "10:30 · confirmations catching up, no duplicates",
    status: "current",
  },
  { id: "identified", title: "Identified", detail: "09:55 · provider callbacks arriving late", status: "warning" },
  {
    id: "investigating",
    title: "Investigating",
    detail: "09:20 · slow MTN MoMo confirmations reported",
    status: "default",
  },
];

const policies: PolicyDoc[] = [
  {
    id: "privacy",
    label: "Privacy",
    version: "Privacy notice v2.1",
    effective: "Effective 1 Sep 2026 · Rwanda’s Law N° 058/2021 on personal data",
    points: [
      {
        icon: "Database",
        title: "What we collect.",
        text: "Account details, bookings, payments and messages needed to run your stays or your business.",
      },
      {
        icon: "Eye",
        title: "Who sees it.",
        text: "The business you book with sees what it needs for your stay. Processors are listed below.",
      },
      {
        icon: "Clock",
        title: "How long.",
        text: "Kept for the periods set in our retention schedule; financial records longer where the law requires.",
      },
      {
        icon: "Person",
        title: "Your choices.",
        text: "Marketing and personalisation are off unless you turn them on.",
      },
    ],
  },
  {
    id: "terms",
    label: "Terms",
    version: "Terms of service v1.4",
    effective: "Effective 1 Sep 2026",
    points: [
      {
        icon: "Briefcase",
        title: "Who you contract with.",
        text: "When you book, your contract for the stay is with the property’s legal business, named at checkout.",
      },
      {
        icon: "Wallet",
        title: "Payments.",
        text: "Paid to that business through our payment step. Refunds follow the cancellation terms you accepted.",
      },
      { icon: "Star", title: "Reviews.", text: "Only after a completed stay. Moderated against published rules." },
      {
        icon: "ScalesBalanced",
        title: "Disputes.",
        text: "Raise them with support first; we keep the record of every decision.",
      },
    ],
  },
  {
    id: "cookies",
    label: "Cookies",
    version: "Cookie notice v1.1",
    effective: "Effective 1 Jun 2026",
    points: [
      { icon: "Lock", title: "Needed.", text: "Sign-in and security cookies keep your session safe." },
      { icon: "ChartColumn", title: "Measurement.", text: "Off unless you agree. Counts visits without selling data." },
      { icon: "Globe", title: "Language.", text: "Remembers English or Kinyarwanda on this device." },
    ],
  },
];

const processors: DataProcessor[] = [
  {
    id: "gt-bank",
    name: "GT Bank (Rwanda)",
    purpose: "Bank partner for card and mobile money collection and settlement",
    data: "Payer name, phone or card token, amount, reference",
    where: "Rwanda",
    status: "Agreement in negotiation · not live",
    tone: "warning",
  },
  {
    id: "mtn",
    name: "MTN Rwanda · Mobile Money",
    purpose: "Mobile money payments, through our bank partner",
    data: "Phone number, amount, reference",
    where: "Rwanda",
    status: "Via bank partner · not live",
    tone: "warning",
  },
  {
    id: "airtel",
    name: "Airtel Rwanda · Airtel Money",
    purpose: "Mobile money payments, through our bank partner",
    data: "Phone number, amount, reference",
    where: "Rwanda",
    status: "Via bank partner · not live",
    tone: "warning",
  },
  {
    id: "vsdc",
    name: "Certified VSDC provider",
    purpose: "Sends businesses’ fiscal receipts to the tax authority",
    data: "Buyer name and TIN if given, receipt lines",
    where: "Rwanda",
    status: "Provider being selected",
    tone: "warning",
  },
  {
    id: "hosting",
    name: "Hosting and file storage",
    purpose: "Runs the platform and stores documents",
    data: "All account, booking and document data",
    where: "Rwanda, planned in-country",
    status: "Under review",
    tone: "warning",
  },
  {
    id: "sms",
    name: "SMS delivery partner",
    purpose: "Booking messages and sign-in codes",
    data: "Phone number, message text",
    where: "To be confirmed",
    status: "Under review",
    tone: "warning",
  },
  {
    id: "email",
    name: "Email delivery service",
    purpose: "Confirmations and receipts by email",
    data: "Email address, message content",
    where: "Outside Rwanda · transfer safeguards needed",
    status: "Under review",
    tone: "warning",
  },
  {
    id: "google",
    name: "Google",
    purpose: "Optional sign-in with a Google account",
    data: "Name, email address",
    where: "Global",
    status: "Standard terms",
    tone: "default",
  },
];

const supportBusinesses: SupportBusiness[] = [
  {
    id: "isangano",
    name: "Isangano Lakeside Hotel",
    legalEntity: "Amahoro Hospitality Ltd",
  },
  {
    id: "ishyamba",
    name: "Ishyamba Forest Lodge",
    legalEntity: "Amahoro Hospitality Ltd",
  },
  {
    id: "kacyiru",
    name: "Kacyiru Court Residences",
    legalEntity: "Amahoro Residences Ltd",
  },
];

const courses: Course[] = [
  {
    id: "fde",
    team: "front",
    teamLabel: "Front office",
    title: "Front desk essentials",
    photo: "trainingFrontDeskRolePlay",
    caption: "Role play at the desk",
    desc: "Check-in and check-out, payments that stay pending, room moves, complaints and handover.",
    format: "In person · 2 days",
    modules: "6 modules and a practical assessment",
    certificate: "Valid 2 years",
    next: "20 Oct, Kigali",
    sessionNote: "Two-day course · practical assessment on day 2 · certificate on passing",
  },
  {
    id: "ebm",
    team: "finance",
    teamLabel: "Finance",
    title: "Fiscal receipts with EBM",
    photo: "trainingReceipts",
    caption: "Receipts and credit notes",
    desc: "Issuing, retrying and correcting fiscal receipts in Injishi, and what never to edit. Complements, not replaces, the tax authority’s own guidance.",
    format: "In person or online · half day",
    modules: "3 pre-course modules and a quiz",
    certificate: "Valid 1 year",
    next: "23 Oct, Kigali",
    sessionNote: "Half-day course · open to cashiers, accountants and managers",
  },
  {
    id: "hks",
    team: "hk",
    teamLabel: "Housekeeping",
    title: "Housekeeping standards",
    photo: "trainingRoomInspection",
    caption: "Room inspection practice",
    desc: "Cleaning sequence, inspection checklists, linen and minibar, lost property and safety.",
    format: "In person · 1 day, practical",
    modules: "4 modules and a room inspection",
    certificate: "Valid 2 years",
    next: "24 Oct, Rubavu",
    sessionNote: "Practical day in a working hotel · bring closed shoes",
  },
];

const courseSessions: CourseSession[] = [
  {
    id: "FDE-2610-K",
    course: "fde",
    when: "Tue 20 – Wed 21 Oct 2026",
    hours: "08:30 to 16:30",
    venue: "Kimihurura Training Room",
    venueSub: "Gasabo, Kigali · step-free",
    trainer: "Claudine Uwamahoro",
    trainerInitials: "CU",
    language: "Kinyarwanda and English",
    taken: 12,
    capacity: 16,
    attended: null,
    mine: false,
  },
  {
    id: "FDE-2611-R",
    course: "fde",
    when: "Mon 2 – Tue 3 Nov 2026",
    hours: "08:30 to 16:30",
    venue: "Kivu Hall, Isangano Lakeside Hotel",
    venueSub: "Rubavu · host venue",
    trainer: "Jean Claude Mutabazi",
    trainerInitials: "JM",
    language: "Kinyarwanda",
    taken: 16,
    capacity: 16,
    attended: null,
    mine: false,
  },
  {
    id: "FDE-2611-O",
    course: "fde",
    when: "Thu 5 and 12 Nov 2026",
    hours: "09:00 to 12:30",
    venue: "Online, live video",
    venueSub: "Assessment in person later",
    trainer: "Esther Mukamurenzi",
    trainerInitials: "EM",
    language: "English",
    taken: 9,
    capacity: 30,
    attended: null,
    mine: false,
  },
  {
    id: "FDE-2609-K",
    course: "fde",
    when: "15 – 16 Sep 2026",
    hours: "Completed",
    venue: "Kimihurura Training Room",
    venueSub: "Gasabo, Kigali",
    trainer: "Claudine Uwamahoro",
    trainerInitials: "CU",
    language: "Kinyarwanda and English",
    taken: 16,
    capacity: 16,
    attended: "14 of 16 attended",
    mine: false,
  },
  {
    id: "EBM-2610-K",
    course: "ebm",
    when: "Fri 23 Oct 2026",
    hours: "09:00 to 13:00",
    venue: "Kimihurura Training Room",
    venueSub: "Gasabo, Kigali",
    trainer: "Jean Claude Mutabazi",
    trainerInitials: "JM",
    language: "Kinyarwanda and English",
    taken: 8,
    capacity: 20,
    attended: null,
    mine: true,
  },
  {
    id: "EBM-2611-O",
    course: "ebm",
    when: "Wed 11 Nov 2026",
    hours: "14:00 to 17:30",
    venue: "Online, live video",
    venueSub: "Quiz online",
    trainer: "Esther Mukamurenzi",
    trainerInitials: "EM",
    language: "English",
    taken: 22,
    capacity: 40,
    attended: null,
    mine: false,
  },
  {
    id: "HKS-2610-R",
    course: "hks",
    when: "Sat 24 Oct 2026",
    hours: "08:00 to 16:00",
    venue: "Isangano Lakeside Hotel",
    venueSub: "Rubavu · working rooms",
    trainer: "Beatrice Mukandori",
    trainerInitials: "BM",
    language: "Kinyarwanda",
    taken: 6,
    capacity: 10,
    attended: null,
    mine: false,
  },
  {
    id: "HKS-2611-H",
    course: "hks",
    when: "Sat 14 Nov 2026",
    hours: "08:00 to 16:00",
    venue: "Huye training hub",
    venueSub: "Huye · partner venue",
    trainer: "Claudine Uwamahoro",
    trainerInitials: "CU",
    language: "Kinyarwanda",
    taken: 2,
    capacity: 12,
    attended: null,
    mine: false,
  },
];

const learners: Learner[] = [
  {
    id: "eric-habimana",
    personaId: "frontdesk",
    name: "Eric Habimana",
    initials: "EH",
    context: "Front desk · Isangano Lakeside Hotel",
    home: "FrontDeskToday",
  },
];

const enrolments: Enrolment[] = [
  {
    id: "eric-ebm",
    learner: "eric-habimana",
    course: "ebm",
    title: "Fiscal receipts with EBM",
    status: "Enrolled · approved by Aline Uwase",
    tone: "success",
    detail: "EBM-2610-K · Fri 23 Oct, 09:00 to 13:00 · Kimihurura Training Room, Kigali",
    progress: { label: "Pre-course modules", done: 2, total: 3 },
    note: "Attendance is recorded by the trainer when you sign in at the venue with your staff QR.",
    attendance: [],
  },
  {
    id: "eric-fde",
    learner: "eric-habimana",
    course: "fde",
    title: "Front desk essentials",
    status: "Completed · assessment 86%",
    tone: "default",
    detail: "FDE-2609-K · 15 to 16 Sep 2026 · Kimihurura Training Room · Claudine Uwamahoro",
    progress: null,
    note: null,
    attendance: [
      { id: "day-1", title: "Day 1 attended", detail: "Signed in 08:52 with staff QR · confirmed by the trainer" },
      { id: "day-2", title: "Day 2 attended", detail: "Signed in 08:47 · practical assessment passed, 86%" },
      { id: "issued", title: "Certificate issued", detail: "17 Sep 2026 · INJ-FDE-26-0417" },
    ],
  },
];

const certificates: Certificate[] = [
  {
    id: "INJ-FDE-26-0417",
    status: "valid",
    learner: "eric-habimana",
    holder: "E. Habimana",
    course: "Front desk essentials",
    issuedOn: "17 Sep 2026",
    issuer: "Injishi",
    validUntil: "17 Sep 2028",
    revokedOn: null,
  },
  {
    id: "INJ-EBM-25-0112",
    status: "revoked",
    learner: null,
    holder: null,
    course: "Fiscal receipts with EBM",
    issuedOn: "10 Mar 2025",
    issuer: "Injishi",
    validUntil: null,
    revokedOn: "2 Aug 2026",
  },
];

const brokerRegistrations: BrokerRegistration[] = [
  {
    id: "BRK-0147",
    brokerId: "BRK-0147",
    renews: "12 Mar 2027",
    identity: "National ID checked 12 Mar 2026",
    areas: "Gasabo, Kicukiro, Nyarugenge",
    terms: "v2 · accepted 1 Sep 2026",
    platformFee: PRICING_PENDING,
    listed: true,
  },
];

const brokerKpis: BrokerKpi[] = [
  { id: "leads", label: "Open leads", value: 4, format: {}, foot: "2 new since Friday" },
  { id: "placements", label: "Placements in progress", value: 5, format: {}, foot: "1 application with a landlord" },
  { id: "leases", label: "Leases signed in 2026", value: 9, format: {}, foot: "From landlords’ signed leases" },
  {
    id: "earnings",
    label: "Earnings pending",
    value: 1_600_000,
    format: { style: "currency", currency: "RWF", notation: "compact", maximumFractionDigits: 1 },
    foot: "RWF 3.2M paid out this year",
  },
];

const placements: Placement[] = [
  {
    id: "grace",
    tenant: "Grace Achieng",
    unit: "Kiyovu Studio Lofts · studio",
    rent: 420_000,
    stage: 0,
    when: ["Introduced 9 Oct", "Viewing Wed 14 Oct, 17:00", "Applied 12 Oct", ""],
  },
  {
    id: "yuki",
    tenant: "Yuki Tanaka",
    unit: "Kimihurura Garden Flats · 1 bedroom",
    rent: 650_000,
    stage: 0,
    when: ["Introduced 11 Oct", "Viewing Thu 15 Oct, 12:30", "Applied 12 Oct", ""],
  },
  {
    id: "pierre",
    tenant: "Pierre Laurent",
    unit: "Rebero View House · 3 bedrooms",
    rent: 1_100_000,
    stage: 1,
    when: ["", "Viewing Tue 13 Oct, 10:00", "Applied 12 Oct", ""],
  },
  {
    id: "fatuma",
    tenant: "Fatuma Hassan",
    unit: "Kacyiru Court · C-03",
    rent: 780_000,
    stage: 1,
    when: ["", "Viewed 10 Oct · deciding", "Applied 12 Oct", ""],
  },
  {
    id: "daniel",
    tenant: "Daniel Okafor",
    unit: "Kacyiru Court · B-11",
    rent: 850_000,
    stage: 2,
    when: ["", "", "With Amahoro Residences since 8 Oct", ""],
  },
  {
    id: "olivier",
    tenant: "Olivier Habineza",
    unit: "Kacyiru Court · B-07",
    rent: 850_000,
    stage: 3,
    when: ["", "", "", "Lease L-KC-018 signed 1 Oct"],
  },
  {
    id: "marie",
    tenant: "Marie Claire Uwimana",
    unit: "Nyarutarama Family Villa",
    rent: 2_400_000,
    stage: 3,
    when: ["", "", "", "Landlord’s lease signed 20 Sep"],
  },
];

const brokerLeads: BrokerLead[] = [
  {
    id: "thomas",
    kind: "tenant",
    initials: "TW",
    name: "Thomas Weber",
    need: "Furnished 2 bedrooms near Kacyiru, up to RWF 900,000 a month, from 1 Nov",
    meta: "From Homes to rent · 2 hours ago",
    status: "New",
    tone: "accent",
  },
  {
    id: "jean-bosco",
    kind: "landlord",
    initials: "JN",
    name: "Jean Bosco Nkurunziza",
    need: "3-bedroom house in Kicukiro to let · asks for a broker mandate",
    meta: "From the broker directory · yesterday",
    status: "New",
    tone: "accent",
  },
  {
    id: "aisha",
    kind: "tenant",
    initials: "AM",
    name: "Aisha Mohammed",
    need: "Studio in Nyarugenge, up to RWF 450,000 a month",
    meta: "Referral · 10 Oct",
    status: "Contacted",
    tone: "default",
  },
  {
    id: "amahoro",
    kind: "landlord",
    initials: "AR",
    name: "Amahoro Residences Ltd",
    need: "Kacyiru Court · 2 vacant units, B-11 and C-03",
    meta: "Mandate active since 3 Sep · contact Solange Uwimana",
    status: "Mandate active",
    tone: "success",
  },
];

const brokerEarnings: BrokerEarning[] = [
  {
    id: "olivier",
    who: "Olivier Habineza",
    unit: "Kacyiru Court B-07 · lease L-KC-018",
    basis: "Mandate: half of the first month’s rent",
    fee: 425_000,
    status: "Awaiting landlord payment",
    tone: "warning",
    evidence: "Due 15 Oct from Amahoro Residences Ltd",
  },
  {
    id: "marie",
    who: "Marie Claire Uwimana",
    unit: "Nyarutarama Family Villa",
    basis: "Mandate: half of the first month’s rent",
    fee: 1_200_000,
    status: "Landlord payment verified",
    tone: "info",
    evidence: "MP261009.1530.F20931 · payout scheduled 14 Oct",
  },
  {
    id: "esther",
    who: "Esther Iradukunda",
    unit: "Kimihurura Garden Flats, flat 4",
    basis: "Mandate: half of the first month’s rent",
    fee: 325_000,
    status: "On hold · disputed",
    tone: "danger",
    evidence: "DSP-0031 · see below",
  },
  {
    id: "umurage",
    who: "Umurage Consulting Ltd",
    unit: "Kimihurura Garden Flats · 2 staff flats",
    basis: "Mandate: fixed fee per unit",
    fee: 650_000,
    status: "Paid",
    tone: "success",
    evidence: "MTN MoMo MP260904.0931.A11872 · 4 Sep",
  },
];

const brokerDisputes: BrokerDispute[] = [
  {
    id: "DSP-0031",
    title: "Fee for Kimihurura Garden Flats, flat 4",
    status: "Under review · your reply due 15 Oct",
    tone: "warning",
    summary:
      "Garden Flats Rwanda Ltd says tenant Esther Iradukunda found the flat through a sign at the gate. RWF 325,000 is on hold until a decision.",
    outcome: null,
    evidence: [
      {
        id: "introduction",
        title: "Introduction logged",
        detail: "22 Sep, 14:10 · tenant consented to share details",
        status: "success",
      },
      {
        id: "viewing",
        title: "Viewing confirmed",
        detail: "24 Sep · confirmed in the app by the landlord’s caretaker",
        status: "success",
      },
      {
        id: "objection",
        title: "Landlord’s objection",
        detail: "Opened 8 Oct · says the tenant came through a sign at the gate",
        status: "warning",
      },
    ],
  },
  {
    id: "DSP-0027",
    title: "Contact reveal",
    status: "Resolved",
    tone: "default",
    summary: "Gikondo Duplex · the landlord’s number was out of service.",
    outcome: "Decided 30 Sep · 2 credits returned to your balance",
    evidence: [],
  },
];

const brokerCredits: BrokerCredits[] = [
  {
    id: "BRK-0147",
    balance: 12,
    usedThisMonth: 4,
    revealsThisMonth: 2,
    returned: "2 credits · 30 Sep",
    priceAndExpiry: PRICING_PENDING,
  },
];

const brokerFeeTerms: BrokerFeeTerm[] = [
  {
    id: "reveal",
    label: "Contact reveal",
    value: "1 to 3 credits, shown on each listing before you confirm. Charged once per listing.",
  },
  {
    id: "wrong-contact",
    label: "If a contact is wrong",
    value: "Open a dispute within 7 days. Credits come back if it is upheld.",
  },
  {
    id: "placement-fee",
    label: "Placement fee",
    value: "Set in each landlord’s mandate and paid by the landlord, never by the tenant.",
  },
  { id: "platform-fee", label: "Injishi platform fee on placements", value: PRICING_PENDING },
  { id: "packs", label: "Credit packs", value: PRICING_PENDING },
];

const directoryListings: DirectoryListing[] = [
  {
    id: "kiyovu",
    type: "studio",
    name: "Kiyovu Studio Lofts",
    area: "Kiyovu, Nyarugenge",
    units: "2 studios",
    rentFrom: 420_000,
    rentTo: null,
    landlord: "Kiyovu Lofts Ltd",
    verified: "14 Aug 2026",
    policy: "open",
    policyLabel: "Open to brokers",
    cost: 1,
    available: "Now",
    fee: "Half of first month’s rent",
    phone: "078 455 2210",
    email: "lettings@kiyovulofts.example",
    photo: "loftStudio",
    caption: "Loft studio",
    revealed: false,
    note: null,
    blockReason: null,
  },
  {
    id: "gikondo",
    type: "house",
    name: "Gikondo Duplex Homes",
    area: "Gikondo, Kicukiro",
    units: "3 duplexes",
    rentFrom: 550_000,
    rentTo: 700_000,
    landlord: "Verified private landlord",
    verified: "2 Sep 2026",
    policy: "open",
    policyLabel: "Open to brokers",
    cost: 2,
    available: "From 1 Nov",
    fee: "Fixed RWF 300,000",
    phone: "078 912 0043",
    email: "gikondo.duplex@example.com",
    photo: "duplexFront",
    caption: "Duplex front",
    revealed: true,
    note: "Revealed 26 Sep · contact updated by the landlord 2 Oct",
    blockReason: null,
  },
  {
    id: "kimihurura",
    type: "apartment",
    name: "Kimihurura Garden Flats",
    area: "Kimihurura, Gasabo",
    units: "1 flat",
    rentFrom: 650_000,
    rentTo: null,
    landlord: "Garden Flats Rwanda Ltd",
    verified: "20 Jul 2026",
    policy: "open",
    policyLabel: "Open to brokers",
    cost: 2,
    available: "Now",
    fee: "Half of first month’s rent",
    phone: "078 330 7781",
    email: "office@gardenflats.example",
    photo: "sharedGarden",
    caption: "Shared garden",
    revealed: true,
    note: "Revealed 11 Oct, 16:20 · 2 credits",
    blockReason: null,
  },
  {
    id: "rebero",
    type: "house",
    name: "Rebero View House",
    area: "Rebero, Kicukiro",
    units: "1 house",
    rentFrom: 1_100_000,
    rentTo: null,
    landlord: "Rebero Estates Ltd",
    verified: "5 Aug 2026",
    policy: "open",
    policyLabel: "Open to brokers",
    cost: 2,
    available: "From 1 Dec",
    fee: "Half of first month’s rent",
    phone: "078 600 4419",
    email: "rent@rebero.example",
    photo: "valleyView",
    caption: "Valley view",
    revealed: true,
    note: "Revealed 7 Oct, 09:05 · 2 credits",
    blockReason: null,
  },
  {
    id: "kacyiru",
    type: "apartment",
    name: "Kacyiru Court Residences",
    area: "Kacyiru, Gasabo",
    units: "2 units · B-11, C-03",
    rentFrom: 780_000,
    rentTo: 850_000,
    landlord: "Amahoro Residences Ltd",
    verified: "1 Jul 2026",
    policy: "mandate",
    policyLabel: "Your mandate",
    cost: 0,
    available: "From 1 Nov",
    fee: "Half of first month’s rent",
    phone: "078 220 5566",
    email: "residences@amahoro.example",
    photo: "courtyardBlockB",
    caption: "Courtyard, block B",
    revealed: false,
    note: "Shared with you under your mandate · Solange Uwimana",
    blockReason: null,
  },
  {
    id: "nyarutarama",
    type: "house",
    name: "Nyarutarama Family Villa",
    area: "Nyarutarama, Gasabo",
    units: "1 villa",
    rentFrom: 2_400_000,
    rentTo: null,
    landlord: "Umusozi Homes Ltd",
    verified: "12 Jun 2026",
    policy: "exclusive",
    policyLabel: "Exclusive with another broker",
    cost: 0,
    available: "From 15 Nov",
    fee: "Not available to you",
    phone: null,
    email: null,
    photo: "familyGarden",
    caption: "Family garden",
    revealed: false,
    note: null,
    blockReason:
      "The landlord gave another broker an exclusive mandate until 30 Nov. You can’t reveal or introduce until it ends.",
  },
  {
    id: "kimironko",
    type: "apartment",
    name: "Kimironko Family Homes",
    area: "Kimironko, Gasabo",
    units: "4 apartments",
    rentFrom: 600_000,
    rentTo: null,
    landlord: "Kimironko Homes Ltd",
    verified: "28 Aug 2026",
    policy: "direct",
    policyLabel: "Direct only",
    cost: 0,
    available: "Now",
    fee: "Not available to you",
    phone: null,
    email: null,
    photo: "familyBlock",
    caption: "Family block",
    revealed: false,
    note: null,
    blockReason: "This landlord lets directly and doesn’t accept brokers. Tenants can apply on the marketplace.",
  },
];

const creditLog: CreditLogEntry[] = [
  {
    id: "RV-1188",
    when: "11 Oct, 16:20",
    what: "Revealed Kimihurura Garden Flats",
    credits: -2,
    outcome: "Contact valid",
    tone: "success",
    ref: "RV-1188",
  },
  {
    id: "RV-1171",
    when: "7 Oct, 09:05",
    what: "Revealed Rebero View House",
    credits: -2,
    outcome: "Contact valid",
    tone: "success",
    ref: "RV-1171",
  },
  {
    id: "DSP-0027",
    when: "30 Sep, 15:12",
    what: "Dispute upheld · Gikondo Duplex Homes",
    credits: 2,
    outcome: "Credits returned",
    tone: "default",
    ref: "DSP-0027",
  },
  {
    id: "RV-1150",
    when: "26 Sep, 11:40",
    what: "Revealed Gikondo Duplex Homes",
    credits: -2,
    outcome: "Number out of service",
    tone: "warning",
    ref: "RV-1150",
  },
  {
    id: "RV-1131",
    when: "18 Sep, 10:30",
    what: "Revealed Remera Townhouses and Kanombe Flats",
    credits: -4,
    outcome: "Contacts valid",
    tone: "success",
    ref: "RV-1131, RV-1132",
  },
  {
    id: "BRK-0147",
    when: "1 Sep, 08:00",
    what: "Starter credits with your registration",
    credits: 20,
    outcome: "Granted",
    tone: "default",
    ref: "BRK-0147",
  },
];

const creditPacks: CreditPack[] = [
  { id: "p10", credits: 10, note: "About 5 to 10 reveals" },
  { id: "p25", credits: 25, note: "For an active month" },
  { id: "p50", credits: 50, note: "For a busy agency" },
];

export const fixtures = {
  "public.hostSteps": hostSteps,
  "public.hostFeatures": hostFeatures,
  "public.readiness": readiness,
  "public.hostPlans": hostPlans,
  "public.hostFees": hostFees,
  "public.helpGuides": helpGuides,
  "public.serviceStatus": serviceStatus,
  "public.incidentUpdates": incidentUpdates,
  "public.policies": policies,
  "public.processors": processors,
  "public.supportBusinesses": supportBusinesses,
  "public.courses": courses,
  "public.courseSessions": courseSessions,
  "public.learners": learners,
  "public.enrolments": enrolments,
  "public.certificates": certificates,
  "public.brokerRegistrations": brokerRegistrations,
  "public.brokerKpis": brokerKpis,
  "public.placements": placements,
  "public.brokerLeads": brokerLeads,
  "public.brokerEarnings": brokerEarnings,
  "public.brokerDisputes": brokerDisputes,
  "public.brokerCredits": brokerCredits,
  "public.brokerFeeTerms": brokerFeeTerms,
  "public.directoryListings": directoryListings,
  "public.creditLog": creditLog,
  "public.creditPacks": creditPacks,
} satisfies FixtureSet;
