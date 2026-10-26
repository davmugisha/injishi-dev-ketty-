import type { BoardId, FixtureSet, IconName, StatusTone } from "../types.ts";

/**
 * Embedded-database fixtures for the "platformops" area: rules and catalogs, platform staff
 * and brokers, audit, platform insights, the manager assistant, and assistant usage.
 * Collection names are "platformops.<thing>"; every document has a stable string `id`.
 * Values are lifted verbatim from the artifact boards (node tools/artifact/extract.mjs <Board>).
 */

export type Tone = StatusTone;

export interface CatalogRow {
  code: string;
  name: string;
  note: string;
  status: string;
  tone: Tone;
}

export interface Catalog {
  id: string;
  label: string;
  meta: string;
  /** Empty when the catalog has no verification gate. */
  gate: string;
  rows: CatalogRow[];
}

export interface FeatureFlag {
  id: string;
  key: string;
  workstream: string;
  scope: string;
  on: boolean;
  approver: string;
  locked: boolean;
}

export interface PricePlan {
  id: string;
  name: string;
  includes: string;
  /** Active v2 monthly price, whole francs. */
  v2: number;
  /** v3 draft monthly price, whole francs. */
  v3: number;
}

export interface LocaleString {
  id: string;
  key: string;
  en: string;
  /** Empty when Kinyarwanda is missing. */
  rw: string;
  status: string;
  tone: Tone;
}

export interface MessageTemplate {
  id: string;
  name: string;
  channel: string;
  icon: IconName;
  version: string;
  subject: string;
  body: string;
  rwMissing: boolean;
}

export interface PlatformSetting {
  id: string;
  label: string;
  value: string;
  meta: string;
  unverified: boolean;
}

export interface RoleFamily {
  id: string;
  tone: Tone;
  can: string[];
  cannot: string[];
}

export interface StaffMember {
  id: string;
  name: string;
  role: string;
  family: string;
  mfa: string;
  mfaTone: Tone;
  viewAs: string;
  lastActive: string;
  review: string;
  reviewTone: Tone;
  /** Access-review row this person is tied to, when the signed-in lead decides it. */
  reviewId?: string;
}

export interface AccessReview {
  id: string;
  who: string;
  grant: string;
  evidence: string;
  /** The signed-in support lead decides these. */
  mine: boolean;
  reviewer: string;
}

export type CheckState = "ok" | "bad" | "optional";

export interface BrokerCheck {
  text: string;
  state: CheckState;
}

export interface Broker {
  id: string;
  name: string;
  area: string;
  state: string;
  tone: Tone;
  credits: string;
  placements: string;
  disputes: string;
  checks: BrokerCheck[];
  note: string;
}

export interface AuditKpi {
  id: string;
  label: string;
  value: string;
  foot: string;
}

export type AuditCategory = "personal" | "viewas" | "priv" | "denied";

export interface AuditEvent {
  id: string;
  time: string;
  actor: string;
  universe: string;
  category: AuditCategory;
  action: string;
  context: string;
  purpose: string;
  result: string;
  tone: Tone;
  device: string;
  prev: string;
  hash: string;
  staff: boolean;
}

export interface InsightKpi {
  id: string;
  label: string;
  value: string;
  foot: string;
}

export interface ChartPoint {
  label: string;
  value: number;
}

export interface BreakdownItem {
  id: string;
  label: string;
  value: string;
  pct: number;
}

export interface InsightArea {
  id: string;
  label: string;
  icon: IconName;
  kpis: InsightKpi[];
  chartTitle: string;
  unit: string;
  points: ChartPoint[];
  max: number;
  /** The last bar is a partial period. */
  muteLast: boolean;
  caption: string;
  breakTitle: string;
  breakdown: BreakdownItem[];
  note: string;
}

export interface NorthStarStep {
  id: string;
  label: string;
  value: string;
  pct: number;
}

export interface FunnelStep {
  id: string;
  label: string;
  count: number;
  /** Empty on the cohort row; otherwise the conversion of the previous step, e.g. "77%". */
  conversion: string;
}

export interface CaptureEvent {
  id: string;
  name: string;
  when: string;
  props: string;
  status: string;
  tone: Tone;
}

export interface AssistantSource {
  n: number;
  icon: IconName;
  title: string;
  detail: string;
  board: BoardId;
}

export interface AssistantConversation {
  id: string;
  title: string;
  time: string;
  snippet: string;
  group: "Today" | "Earlier";
  meta: string;
  question: string;
  questionTime: string;
  answer: string[];
  sources: AssistantSource[];
  permissions: string[];
  proposal?: boolean;
  chip?: string;
}

export interface UsageKpi {
  id: string;
  label: string;
  value: string;
  foot: string;
}

export interface UsageTenant {
  id: string;
  name: string;
  sub: string;
  conversations: number;
  cost: number;
  /** 0 when each tenant has their own default and this row is the remainder. */
  limit: number;
}

export interface UsageMonth {
  id: string;
  label: string;
  longLabel: string;
  kpis: UsageKpi[];
  tenants: UsageTenant[];
  /** Helpful, wrong, missing source, not helpful, should not see — percents. */
  feedback: number[];
  ratedText: string;
  refused: string;
  budgetUsed: string;
  budgetPct: number;
}

export interface FlaggedAnswer {
  id: string;
  tenant: string;
  by: string;
  reason: string;
  age: string;
  question: string;
  excerpt: string;
  sources: string;
  note: string;
  closedOutcome?: string;
}

export interface FindingOption {
  id: string;
  label: string;
}

export interface UsageAlert {
  id: string;
  label: string;
  on: boolean;
}

export interface RetentionSetting {
  id: string;
  label: string;
  options: string[];
  /** Index of the option in force. */
  index: number;
}

export interface TenantLimitOption {
  id: string;
  label: string;
}

const row = (code: string, name: string, note: string, status: string, tone: Tone): CatalogRow => ({
  code,
  name,
  note,
  status,
  tone,
});

const kpi = (id: string, label: string, value: string, foot: string): InsightKpi => ({ id, label, value, foot });

const point = (label: string, value: number): ChartPoint => ({ label, value });

const breakItem = (id: string, label: string, value: string, pct: number): BreakdownItem => ({
  id,
  label,
  value,
  pct,
});

const WEEKS = ["21 Jul", "", "", "11 Aug", "", "", "1 Sep", "", "", "22 Sep", "", "6 Oct"];

const weekPoints = (values: number[]): ChartPoint[] => values.map((value, i) => point(WEEKS[i] ?? "", value));

const catalogs = [
  {
    id: "amen",
    label: "Amenities",
    meta: "v14 · effective 1 Oct 2026 · 86 items · v15 draft open",
    gate: "",
    rows: [
      row("wifi", "Wi-Fi", "Free or paid flag per property", "Active", "success"),
      row("lake_view", "Lake view", "Room-type level", "Active", "success"),
      row("airport_shuttle", "Airport shuttle", "Needs a bookable service", "Active", "success"),
      row("ev_charging", "EV charging", "Added in v15", "Draft", "default"),
    ],
  },
  {
    id: "rdb",
    label: "RDB classes",
    meta: "v3 · effective 1 Jul 2026 · accommodation groups and grades",
    gate: "Source classification needs verification with RDB",
    rows: [
      row("hotel_1_5", "Hotel", "Grades 1 to 5 stars", "Configured", "default"),
      row("lodge", "Lodge", "Ungraded or graded", "Configured", "default"),
      row("guest_house", "Guest house", "Ungraded", "Configured", "default"),
      row("serviced_apt", "Serviced apartment", "Not a residence lease", "Configured", "default"),
    ],
  },
  {
    id: "fees",
    label: "Fees",
    meta: "v4 active since 1 Jul 2026 · v5 draft effective 1 Nov 2026",
    gate: "Fee amounts are unsigned commercial terms",
    rows: [
      row("reg_hotel", "Registration fee · hotel", "RWF 50,000 once", "v4 active", "success"),
      row("reg_guesthouse", "Registration fee · guest house", "RWF 20,000 once", "v4 active", "success"),
      row("reg_residence", "Registration fee · residence", "RWF 30,000 → 35,000 in v5", "Awaiting sign-off", "warning"),
      row("broker_credit", "Broker contact-reveal credit", "RWF 2,000 per credit", "v4 active", "success"),
    ],
  },
  {
    id: "tax",
    label: "Tax codes",
    meta: "v7 · effective 1 Jul 2026 · used on platform invoices and as tenant defaults",
    gate: "Rates are configured, not verified Rwanda law · tax adviser and RRA sign-off pending",
    rows: [
      row("VAT_STD", "VAT standard", "18% · Configured · unverified", "Awaiting sign-off", "warning"),
      row("VAT_EXEMPT", "VAT exempt", "Residential rent treatment · unverified", "Awaiting sign-off", "warning"),
      row("VAT_ZERO", "VAT zero-rated", "Export services · unverified", "Awaiting sign-off", "warning"),
      row("WHT_SERV", "Withholding on services", "15% · Configured · unverified", "Awaiting sign-off", "warning"),
    ],
  },
  {
    id: "gov",
    label: "Government bodies",
    meta: "v4 · effective 2 Sep 2026 · who may receive what, under which mandate",
    gate: "No body receives data automatically without a verified mandate",
    rows: [
      row(
        "RDB",
        "Rwanda Development Board",
        "Licensing and grading · mandate needs verification",
        "Needs verification",
        "warning",
      ),
      row(
        "RRA",
        "Rwanda Revenue Authority",
        "EBM and VSDC through an approved provider",
        "Provider path pending",
        "warning",
      ),
      row("RUBAVU", "Rubavu District", "Business verification · scoped officer access", "Mandate on file", "success"),
      row(
        "PSF_TOUR",
        "PSF · Chamber of Tourism",
        "Membership applications · no API, tracked manually",
        "Manual",
        "default",
      ),
    ],
  },
] satisfies Catalog[];

const flags = [
  {
    id: "payments.polling_fallback",
    key: "payments.polling_fallback",
    workstream: "Payments",
    scope: "All tenants · on since 09:02 for INC-0192",
    on: true,
    approver: "Engineering",
    locked: false,
  },
  {
    id: "marketplace.public_search",
    key: "marketplace.public_search",
    workstream: "Marketplace",
    scope: "12 pilot tenants incl. Amahoro",
    on: true,
    approver: "Product",
    locked: false,
  },
  {
    id: "residence.broker_reveals",
    key: "residence.broker_reveals",
    workstream: "Brokers",
    scope: "5 Kigali residences",
    on: true,
    approver: "Product",
    locked: false,
  },
  {
    id: "revenue.recommendations",
    key: "revenue.recommendations",
    workstream: "Revenue management",
    scope: "3 tenants · beta",
    on: true,
    approver: "Product",
    locked: false,
  },
  {
    id: "assistant.action_proposals",
    key: "assistant.action_proposals",
    workstream: "Assistant",
    scope: "Off for all · privacy review open",
    on: false,
    approver: "Product and compliance",
    locked: false,
  },
  {
    id: "fiscal.vsdc_provider_b_failover",
    key: "fiscal.vsdc_provider_b_failover",
    workstream: "Fiscal",
    scope: "Locked · provider B certification not verified",
    on: false,
    approver: "Engineering",
    locked: true,
  },
] satisfies FeatureFlag[];

const pricePlans = [
  { id: "starter", name: "Starter", includes: "1 property · up to 15 rooms", v2: 45000, v3: 45000 },
  { id: "growth", name: "Growth", includes: "Up to 3 properties · 60 rooms", v2: 120000, v3: 135000 },
  { id: "group", name: "Group", includes: "Unlimited properties · legal entities", v2: 350000, v3: 350000 },
  { id: "residence", name: "Residence", includes: "Per leased unit · minimum RWF 30,000", v2: 2500, v3: 3000 },
] satisfies PricePlan[];

const strings = [
  { id: "auth.sign_in", key: "auth.sign_in", en: "Sign in", rw: "Injira", status: "Reviewed", tone: "success" },
  {
    id: "common.welcome",
    key: "common.welcome",
    en: "Welcome",
    rw: "Murakaza neza",
    status: "Reviewed",
    tone: "success",
  },
  { id: "nav.rooms", key: "nav.rooms", en: "Rooms", rw: "Ibyumba", status: "Reviewed", tone: "success" },
  { id: "nav.guests", key: "nav.guests", en: "Guests", rw: "Abashyitsi", status: "Reviewed", tone: "success" },
  {
    id: "payment.pay_now",
    key: "payment.pay_now",
    en: "Pay now",
    rw: "Ishyura ubu",
    status: "Machine draft",
    tone: "warning",
  },
  {
    id: "payment.status_unknown",
    key: "payment.status_unknown",
    en: "Unknown — checking with provider",
    rw: "",
    status: "Missing",
    tone: "danger",
  },
  {
    id: "fiscal.receipt_pending",
    key: "fiscal.receipt_pending",
    en: "Fiscal receipt pending",
    rw: "",
    status: "Missing",
    tone: "danger",
  },
  {
    id: "viewas.banner",
    key: "viewas.banner",
    en: "Injishi support is viewing this workspace",
    rw: "",
    status: "Missing",
    tone: "danger",
  },
] satisfies LocaleString[];

const templates = [
  {
    id: "booking_confirmation",
    name: "Booking confirmation",
    channel: "Email",
    icon: "Envelope",
    version: "v6",
    subject: "Your stay at [property_name] is confirmed",
    body: "Hello [guest_first_name], your booking [booking_ref] for [arrival_date] to [departure_date] is confirmed. Payment status: [payment_status]. Your fiscal receipt is sent separately once issued.",
    rwMissing: false,
  },
  {
    id: "payment_pending",
    name: "Payment being confirmed",
    channel: "SMS",
    icon: "Handset",
    version: "v3",
    subject: "",
    body: "[property_name]: we are confirming your payment of [amount] with the provider. Please do not pay again. Ref [payment_ref].",
    rwMissing: false,
  },
  {
    id: "fiscal_receipt_ready",
    name: "Fiscal receipt issued",
    channel: "Email",
    icon: "Envelope",
    version: "v2",
    subject: "Your fiscal receipt from [merchant_name]",
    body: "Fiscal receipt [fiscal_doc_number] for [amount] has been issued by [merchant_name], TIN [merchant_tin]. This is separate from your payment receipt.",
    rwMissing: true,
  },
  {
    id: "kyb_changes",
    name: "KYB changes requested",
    channel: "Email",
    icon: "Envelope",
    version: "v4",
    subject: "One more step to activate [business_name]",
    body: "Our reviewer needs: [requested_items]. Upload them from Registration › Documents. Nothing is billed until your business is approved.",
    rwMissing: false,
  },
  {
    id: "view_as_started",
    name: "Support session started",
    channel: "Email",
    icon: "Envelope",
    version: "v1",
    subject: "Injishi support opened your workspace",
    body: "[staff_name] from Injishi support started a [access_mode] session in [business_name] at [start_time] for ticket [ticket_id]. It ends at [end_time]. You can end it any time from the banner.",
    rwMissing: false,
  },
  {
    id: "otp_code",
    name: "Sign-in code",
    channel: "SMS",
    icon: "Handset",
    version: "v9",
    subject: "",
    body: "Your Injishi code is [code]. It expires in 10 minutes. Injishi staff will never ask for it.",
    rwMissing: false,
  },
] satisfies MessageTemplate[];

const config = [
  {
    id: "idle",
    label: "Admin session idle timeout",
    value: "15 min",
    meta: "v3 · since 1 Aug 2026",
    unverified: false,
  },
  {
    id: "stepup",
    label: "Step-up window",
    value: "30 min",
    meta: "Exports and money actions always ask again",
    unverified: false,
  },
  {
    id: "viewas",
    label: "View-as limits",
    value: "30 min · max 60",
    meta: "Over 30 min or assisted changes need approval",
    unverified: false,
  },
  {
    id: "sweep",
    label: "Unknown payment sweep",
    value: "After 30 min",
    meta: "Asks the provider; never marks paid on its own",
    unverified: false,
  },
  {
    id: "fiscal",
    label: "Fiscal retry",
    value: "Every 5 min",
    meta: "Same request ID · alert after 2 hours",
    unverified: false,
  },
  {
    id: "retention",
    label: "Audit and fiscal record retention",
    value: "7 years",
    meta: "v2 · legal basis not confirmed",
    unverified: true,
  },
  {
    id: "notice",
    label: "Price change notice",
    value: "60 days",
    meta: "Linked to price book approvals",
    unverified: true,
  },
] satisfies PlatformSetting[];

const roleFamilies = [
  {
    id: "Support",
    tone: "info",
    can: [
      "Read tenant status, tickets and health",
      "Reply to and resolve tickets",
      "Read-only view-as on an open ticket, up to 30 min",
      "Moderate content under a cited policy",
      "Draft rule and flag changes",
    ],
    cannot: ["Approve money overrides or KYB", "Export tenant guest data", "Promote deploys"],
  },
  {
    id: "Finance",
    tone: "success",
    can: [
      "Platform ledger and reconciliation",
      "Request or approve overrides, never both on one",
      "Platform invoices and service credits",
    ],
    cannot: ["View-as into tenant workspaces", "Tenant guest or payroll data", "Feature flags"],
  },
  {
    id: "Compliance",
    tone: "warning",
    can: [
      "Approve KYB and TIN-gate unblocks",
      "Approve view-as over 30 min or assisted",
      "Approve suspensions and reinstatements",
      "Audit export with step-up",
    ],
    cannot: ["Platform ledger changes", "Deploys"],
  },
  {
    id: "Engineering",
    tone: "default",
    can: [
      "Health, queues and dead-letter replays",
      "Approve feature flag changes",
      "Promote deploys with a second reviewer",
      "Break-glass production access, 60 min, logged",
    ],
    cannot: ["Tenant business data by default", "Money overrides", "KYB decisions"],
  },
  {
    id: "Operations",
    tone: "accent",
    can: ["Approve role changes and access reviews", "Approve suspensions", "Approve plan price books with Finance"],
    cannot: ["Approve their own access", "Money overrides"],
  },
] satisfies RoleFamily[];

const staff = [
  {
    id: "kevin",
    name: "Kevin Mugisha",
    role: "Support lead",
    family: "Support",
    mfa: "Passkey and authenticator",
    mfaTone: "success",
    viewAs: "6",
    lastActive: "now",
    review: "Reviewed",
    reviewTone: "success",
  },
  {
    id: "ange",
    name: "Ange Ishimwe",
    role: "Support agent",
    family: "Support",
    mfa: "Authenticator",
    mfaTone: "success",
    viewAs: "9",
    lastActive: "4 min ago",
    review: "Yours to decide",
    reviewTone: "warning",
    reviewId: "r1",
  },
  {
    id: "patience",
    name: "Patience Uwamahoro",
    role: "Support agent",
    family: "Support",
    mfa: "SMS code only",
    mfaTone: "warning",
    viewAs: "2",
    lastActive: "20 min ago",
    review: "Yours to decide",
    reviewTone: "warning",
    reviewId: "r2",
  },
  {
    id: "nadine",
    name: "Nadine Kayitesi",
    role: "Trust and safety",
    family: "Support",
    mfa: "Authenticator",
    mfaTone: "success",
    viewAs: "0",
    lastActive: "1 h ago",
    review: "Yours to decide",
    reviewTone: "warning",
    reviewId: "r3",
  },
  {
    id: "yvonne",
    name: "Yvonne Mutesi",
    role: "Platform finance",
    family: "Finance",
    mfa: "Passkey",
    mfaTone: "success",
    viewAs: "0",
    lastActive: "37 min ago",
    review: "Reviewed",
    reviewTone: "success",
  },
  {
    id: "clarisse",
    name: "Clarisse Umutoni",
    role: "Finance approver",
    family: "Finance",
    mfa: "Authenticator",
    mfaTone: "success",
    viewAs: "0",
    lastActive: "yesterday",
    review: "Reviewed",
    reviewTone: "success",
  },
  {
    id: "bosco",
    name: "Bosco Rutayisire",
    role: "Compliance reviewer",
    family: "Compliance",
    mfa: "Passkey",
    mfaTone: "success",
    viewAs: "3",
    lastActive: "1 h ago",
    review: "Reviewed",
    reviewTone: "success",
  },
  {
    id: "samuel",
    name: "Samuel Nkusi",
    role: "Engineering on-call",
    family: "Engineering",
    mfa: "Passkey",
    mfaTone: "success",
    viewAs: "1 break-glass",
    lastActive: "now",
    review: "With Alain",
    reviewTone: "default",
  },
  {
    id: "fabrice",
    name: "Fabrice Iradukunda",
    role: "Engineering",
    family: "Engineering",
    mfa: "Passkey",
    mfaTone: "success",
    viewAs: "0",
    lastActive: "now",
    review: "Reviewed",
    reviewTone: "success",
  },
  {
    id: "joel",
    name: "Joel Hakizimana",
    role: "Engineering contractor",
    family: "Engineering",
    mfa: "Not enrolled",
    mfaTone: "danger",
    viewAs: "0",
    lastActive: "41 days ago",
    review: "With Alain",
    reviewTone: "default",
  },
  {
    id: "alain",
    name: "Alain Ntwari",
    role: "Head of platform operations",
    family: "Operations",
    mfa: "Passkey",
    mfaTone: "success",
    viewAs: "0",
    lastActive: "2 h ago",
    review: "Reviewed",
    reviewTone: "success",
  },
] satisfies StaffMember[];

const accessReviews = [
  {
    id: "r1",
    who: "Ange Ishimwe",
    grant: "Read-only view-as",
    evidence: "9 sessions in 90 days, all on open tickets, none over 30 min",
    mine: true,
    reviewer: "",
  },
  {
    id: "r2",
    who: "Patience Uwamahoro",
    grant: "Support agent",
    evidence: "Uses SMS codes only; policy asks for an authenticator by 31 Oct",
    mine: true,
    reviewer: "",
  },
  {
    id: "r3",
    who: "Nadine Kayitesi",
    grant: "Moderation",
    evidence: "41 moderation decisions in 90 days, 2 overturned on appeal",
    mine: true,
    reviewer: "",
  },
  {
    id: "r4",
    who: "Samuel Nkusi",
    grant: "Break-glass production",
    evidence: "Used once, 2 Oct, during INC-0188 · 38 min",
    mine: false,
    reviewer: "Alain Ntwari",
  },
  {
    id: "r5",
    who: "Joel Hakizimana",
    grant: "Production read",
    evidence: "Not used for 41 days · contract ends 31 Oct",
    mine: false,
    reviewer: "Alain Ntwari",
  },
] satisfies AccessReview[];

const brokers = [
  {
    id: "twagira",
    name: "Emmanuel Twagira",
    area: "Gasabo and Kicukiro",
    state: "Verified",
    tone: "success",
    credits: "34",
    placements: "6",
    disputes: "DSP-0042 open",
    note: "One open dispute (DSP-0042, RWF 325,000). The fee is held until it is decided; it does not by itself justify suspension.",
    checks: [
      { text: "ID checked against selfie", state: "ok" },
      { text: "Phone verified", state: "ok" },
      { text: "Broker terms v2 accepted", state: "ok" },
      { text: "Business registration uploaded", state: "ok" },
    ],
  },
  {
    id: "nshuti",
    name: "Aimable Nshuti",
    area: "Nyarugenge",
    state: "Pending verification",
    tone: "warning",
    credits: "0",
    placements: "0",
    disputes: "None",
    note: "Cannot buy credits or see the directory until verified.",
    checks: [
      { text: "Selfie did not match ID on first try", state: "bad" },
      { text: "Phone verified", state: "ok" },
      { text: "Broker terms v2 accepted", state: "ok" },
      { text: "Business registration optional", state: "optional" },
    ],
  },
  {
    id: "murekatete",
    name: "Josiane Murekatete",
    area: "Kicukiro",
    state: "Suspended",
    tone: "danger",
    credits: "12 frozen",
    placements: "2",
    disputes: "3 upheld",
    note: "Suspended for charging fees above the disclosed terms in 3 upheld disputes. Credits are frozen, not removed.",
    checks: [
      { text: "ID checked against selfie", state: "ok" },
      { text: "Phone verified", state: "ok" },
      { text: "Broker terms v2 accepted", state: "ok" },
      { text: "Suspended 2 Oct · approved by Bosco Rutayisire", state: "bad" },
    ],
  },
  {
    id: "habyalimana",
    name: "Gilbert Habyalimana",
    area: "Gasabo",
    state: "Verified",
    tone: "success",
    credits: "5",
    placements: "1",
    disputes: "None",
    note: "No issues.",
    checks: [
      { text: "ID checked against selfie", state: "ok" },
      { text: "Phone verified", state: "ok" },
      { text: "Broker terms v2 accepted", state: "ok" },
      { text: "Business registration optional", state: "optional" },
    ],
  },
  {
    id: "uwamariya",
    name: "Clementine Uwamariya",
    area: "Remera",
    state: "Verified · inactive",
    tone: "default",
    credits: "0",
    placements: "0",
    disputes: "None",
    note: "Must accept broker terms v2 before the next reveal.",
    checks: [
      { text: "ID checked against selfie", state: "ok" },
      { text: "Phone verified", state: "ok" },
      { text: "Broker terms v1 accepted · v2 pending", state: "bad" },
      { text: "Business registration optional", state: "optional" },
    ],
  },
] satisfies Broker[];

const auditKpis = [
  { id: "events", label: "Events today", value: "1,284", foot: "Since 00:00 CAT, all tenants" },
  { id: "personal", label: "Personal-data reads", value: "312", foot: "296 by business users · 16 by Injishi staff" },
  { id: "viewas", label: "View-as sessions", value: "1 open", foot: "4 ended in 24 h · all read-only" },
  { id: "priv", label: "Privileged actions", value: "23", foot: "Flags, overrides, role changes, step-ups" },
  { id: "denied", label: "Denied attempts", value: "3", foot: "Each reviewed by the actor’s lead" },
] satisfies AuditKpi[];

const auditEvents = [
  {
    id: "AUD-7781204",
    time: "09:41:52",
    actor: "Ange Ishimwe",
    universe: "Injishi staff · Support agent",
    category: "viewas",
    action: "Opened Registration › Documents",
    context: "Kivu Sunset Guesthouse",
    purpose: "VS-0384 · SUP-4127",
    result: "Allowed",
    tone: "success",
    device: "41.186.•.• · Kigali · Chrome 129",
    prev: "7c1e…90ab",
    hash: "e4d2…11f7",
    staff: true,
  },
  {
    id: "AUD-7781199",
    time: "09:38:10",
    actor: "Ange Ishimwe",
    universe: "Injishi staff · Support agent",
    category: "viewas",
    action: "Started read-only view-as · 30 min",
    context: "Kivu Sunset Guesthouse",
    purpose: "VS-0384 · SUP-4127 · owner notified",
    result: "Allowed",
    tone: "success",
    device: "41.186.•.• · Kigali · Chrome 129",
    prev: "3b80…c2d4",
    hash: "7c1e…90ab",
    staff: true,
  },
  {
    id: "AUD-7781187",
    time: "09:31:02",
    actor: "Kevin Mugisha",
    universe: "Injishi staff · Support lead",
    category: "priv",
    action: "Step-up verified with authenticator",
    context: "Admin console",
    purpose: "Session start · valid 30 min",
    result: "Allowed",
    tone: "success",
    device: "41.186.•.• · Kigali · Firefox 131",
    prev: "f019…6a3e",
    hash: "3b80…c2d4",
    staff: true,
  },
  {
    id: "AUD-7781163",
    time: "09:22:47",
    actor: "Eric Habimana",
    universe: "Business user · Front desk",
    category: "personal",
    action: "Viewed guest ID document",
    context: "Amahoro · Isangano Lakeside Hotel",
    purpose: "Thomas Weber · check-in BK-20433",
    result: "Allowed",
    tone: "success",
    device: "Front desk PC 2 · Rubavu",
    prev: "0d5a…b771",
    hash: "f019…6a3e",
    staff: false,
  },
  {
    id: "AUD-7781150",
    time: "09:05:31",
    actor: "Yvonne Mutesi",
    universe: "Injishi staff · Platform finance",
    category: "priv",
    action: "Requested money override OVR-0031",
    context: "Platform ledger",
    purpose: "RR-1011 · RWF 480,000 · split payment",
    result: "Pending approval",
    tone: "warning",
    device: "41.186.•.• · Kigali · Edge 129",
    prev: "91c4…2e08",
    hash: "0d5a…b771",
    staff: true,
  },
  {
    id: "AUD-7781131",
    time: "09:02:14",
    actor: "Samuel Nkusi",
    universe: "Injishi staff · Engineering",
    category: "priv",
    action: "Turned on payments.polling_fallback",
    context: "Feature flags · all tenants",
    purpose: "INC-0192",
    result: "Allowed",
    tone: "success",
    device: "VPN · Kigali · CLI 2.4",
    prev: "5e77…a913",
    hash: "91c4…2e08",
    staff: true,
  },
  {
    id: "AUD-7781122",
    time: "08:52:09",
    actor: "Patience Uwamahoro",
    universe: "Injishi staff · Support agent",
    category: "denied",
    action: "Tried to export a guest list",
    context: "Amahoro Hospitality Group",
    purpose: "No view-as session · SUP-4131",
    result: "Denied",
    tone: "danger",
    device: "41.186.•.• · Kigali · Chrome 129",
    prev: "aa02…7b5c",
    hash: "5e77…a913",
    staff: true,
  },
  {
    id: "AUD-7781088",
    time: "08:12:15",
    actor: "Bosco Rutayisire",
    universe: "Injishi staff · Compliance",
    category: "personal",
    action: "Viewed owner national ID",
    context: "Kivu Sunset Guesthouse",
    purpose: "KYB-3318 review",
    result: "Allowed",
    tone: "success",
    device: "41.186.•.• · Kigali · Safari 18",
    prev: "6f3d…0c41",
    hash: "aa02…7b5c",
    staff: true,
  },
  {
    id: "AUD-7781050",
    time: "07:58:03",
    actor: "Grace Uwera",
    universe: "Business user · Finance",
    category: "personal",
    action: "Exported folio list, guest names masked",
    context: "Amahoro · Isangano Lakeside Hotel",
    purpose: "Step-up · 214 rows",
    result: "Allowed",
    tone: "success",
    device: "Office laptop · Rubavu",
    prev: "c8b9…d2e6",
    hash: "6f3d…0c41",
    staff: false,
  },
  {
    id: "AUD-7780991",
    time: "11 Oct 15:24",
    actor: "Ange Ishimwe",
    universe: "Injishi staff · Support agent",
    category: "viewas",
    action: "Ended view-as VS-0381 · 22 min",
    context: "Kivu Sunset Guesthouse",
    purpose: "SUP-4127 · 14 events",
    result: "Allowed",
    tone: "success",
    device: "41.186.•.• · Kigali · Chrome 129",
    prev: "22e1…4f90",
    hash: "c8b9…d2e6",
    staff: true,
  },
] satisfies AuditEvent[];

const insightAreas = [
  {
    id: "exec",
    label: "Executive",
    icon: "CrownDiamond",
    kpis: [
      kpi("biz", "Active businesses", "181", "+9 this month · 7 in KYB review"),
      kpi("props", "Properties live", "236", "Hotels, lodges, guest houses, residences"),
      kpi("rev", "Platform revenue", "RWF 14.6M", "October to date · from the platform ledger"),
      kpi("churn", "Business churn", "1.1%", "September · 2 businesses closed"),
    ],
    chartTitle: "Active Businesses by Month",
    unit: "businesses, end of month",
    points: ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"].map((label, i) =>
      point(label, [38, 52, 64, 79, 95, 108, 121, 134, 148, 160, 172, 181][i] ?? 0),
    ),
    max: 200,
    muteLast: true,
    caption: "Businesses in the Active lifecycle state on the last day of each month. October is to date.",
    breakTitle: "By business type",
    breakdown: [
      breakItem("hotels", "Hotels", "64", 35),
      breakItem("gh", "Guest houses and motels", "58", 32),
      breakItem("lodges", "Lodges and camps", "33", 18),
      breakItem("res", "Residences", "26", 14),
    ],
    note: "A group with several properties counts once.",
  },
  {
    id: "market",
    label: "Marketplace",
    icon: "Globe",
    kpis: [
      kpi("searches", "Searches", "48,210", "September · public marketplace"),
      kpi("conv", "Search to booking", "0.85%", "Sessions with a search that booked"),
      kpi("book", "Marketplace bookings", "412", "September · 12 pilot tenants"),
      kpi("cancel", "Cancellation rate", "7.8%", "Of September marketplace bookings"),
    ],
    chartTitle: "Marketplace Bookings per Week",
    unit: "bookings",
    points: weekPoints([61, 70, 68, 74, 82, 79, 88, 96, 92, 101, 108, 64]),
    max: 120,
    muteLast: true,
    caption:
      "Each marketplace booking is a normal reservation in the tenant’s own records, not a parallel booking. The last week is partial.",
    breakTitle: "Where bookings came from",
    breakdown: [
      breakItem("explore", "Explore search", "58%", 58),
      breakItem("direct", "Direct property link", "27%", 27),
      breakItem("saved", "Saved collections", "9%", 9),
      breakItem("broker", "Broker referral", "6%", 6),
    ],
    note: "Reviews: 34% of eligible stays left one. Moderation queue is in Support.",
  },
  {
    id: "growth",
    label: "Growth",
    icon: "ChartLineArrowUp",
    kpis: [
      kpi("reg", "Registrations", "21", "October to date · 52 in September"),
      kpi("kyb", "KYB decision time", "2.6 days", "Median from submission · target 2 days"),
      kpi("act", "Activated in 30 days", "41%", "First reservation, stay and close"),
      kpi("field", "Field-agent share", "38%", "Of registrations since July"),
    ],
    chartTitle: "Registrations per Week",
    unit: "businesses",
    points: weekPoints([9, 11, 8, 12, 14, 10, 13, 15, 12, 11, 14, 7]),
    max: 16,
    muteLast: true,
    caption: "Every registration records its acquisition source. The last week is partial.",
    breakTitle: "Acquisition source",
    breakdown: [
      breakItem("field", "Field agents", "38%", 38),
      breakItem("web", "Website and search", "25%", 25),
      breakItem("ref", "Referrals from tenants", "22%", 22),
      breakItem("psf", "PSF and trade events", "15%", 15),
    ],
    note: "Field-agent registrations reach KYB approval 1.4 days faster on median.",
  },
  {
    id: "finance",
    label: "Finance",
    icon: "Vault",
    kpis: [
      kpi("inv", "Platform invoices", "214", "Billing run on 1 Oct"),
      kpi("col", "Collected and verified", "71%", "By value · provider or bank evidence"),
      kpi("over", "Overdue over 15 days", "11", "RWF 1.3M · retries daily at 07:00"),
      kpi("days", "Days to collect", "9.4", "Median, September invoices"),
    ],
    chartTitle: "Verified Collections per Week",
    unit: "RWF millions",
    points: weekPoints([2.1, 3.4, 2.8, 2.2, 3.9, 3.1, 4.6, 3.3, 2.6, 2.4, 5.2, 3.8]),
    max: 6,
    muteLast: true,
    caption:
      "Platform ledger only (subscriptions, fees, broker credits). Tenant guest and rent money is never included.",
    breakTitle: "October revenue mix",
    breakdown: [
      breakItem("sub", "Subscriptions", "RWF 14.22M", 97),
      breakItem("reg", "Registration fees", "RWF 260K", 2),
      breakItem("brk", "Broker credits", "RWF 118K", 1),
    ],
    note: "Reconciliation exceptions are tracked in Money.",
  },
  {
    id: "supply",
    label: "Supply",
    icon: "FolderHouse",
    kpis: [
      kpi("rooms", "Rooms and tents live", "4,912", "Bookable inventory today"),
      kpi("units", "Residence units", "612", "26 residences · 94% leased"),
      kpi("dist", "Districts covered", "22 of 30", "At least one live property"),
      kpi("lic", "Licences expiring", "14", "Next 60 days · owners reminded"),
    ],
    chartTitle: "Rooms Live by Province",
    unit: "rooms and tents",
    points: [
      point("Kigali", 1980),
      point("Western", 1240),
      point("Northern", 760),
      point("Southern", 512),
      point("Eastern", 420),
    ],
    max: 2200,
    muteLast: false,
    caption: "Rooms and tents in properties that are Active and listed. Residence units are counted separately.",
    breakTitle: "Listing status",
    breakdown: [
      breakItem("pub", "Published", "198", 84),
      breakItem("draft", "Draft", "24", 10),
      breakItem("mod", "Pending moderation", "6", 3),
      breakItem("hid", "Hidden by suspension", "8", 3),
    ],
    note: "4 suspended businesses have their listings hidden.",
  },
  {
    id: "support",
    label: "Support",
    icon: "LifeRing",
    kpis: [
      kpi("open", "Tickets opened", "96", "Last 7 days · 12 open now"),
      kpi("first", "First response", "38 min", "Median · target 1 hour"),
      kpi("res", "Resolution", "6 h 20 min", "Median, last 7 days"),
      kpi("sat", "Satisfaction", "4.4 / 5", "61 responses · English and Kinyarwanda"),
    ],
    chartTitle: "Tickets Opened per Day",
    unit: "tickets",
    points: [11, 14, 9, 13, 12, 8, 6, 15, 16, 12, 18, 21, 14, 9].map((value, i) =>
      point(["29 Sep", "", "", "", "", "", "5 Oct", "", "", "", "", "", "", "Today"][i] ?? "", value),
    ),
    max: 24,
    muteLast: true,
    caption: "The 10 and 11 October rise follows INC-0188 and the VSDC slowdown. Today is partial.",
    breakTitle: "Where tickets come from",
    breakdown: [
      breakItem("help", "Help form", "44%", 44),
      breakItem("asst", "Assistant hand-off", "23%", 23),
      breakItem("email", "Email", "21%", 21),
      breakItem("field", "Field agents", "12%", 12),
    ],
    note: "23% of assistant conversations end in a hand-off to a person.",
  },
] satisfies InsightArea[];

const northStarSteps = [
  { id: "res", label: "Took at least one reservation", value: "164", pct: 91 },
  { id: "stay", label: "Checked out at least one stay", value: "142", pct: 78 },
  { id: "close", label: "Closed a business day with no exceptions", value: "63", pct: 35 },
] satisfies NorthStarStep[];

const funnel = [
  { id: "reg", label: "Registered", count: 312, conversion: "" },
  { id: "kyb", label: "Submitted KYB", count: 241, conversion: "77%" },
  { id: "appr", label: "KYB approved", count: 214, conversion: "89%" },
  { id: "prov", label: "Workspace provisioned", count: 203, conversion: "95%" },
  { id: "first", label: "First reservation", count: 176, conversion: "87%" },
  { id: "stay", label: "First stay checked out", count: 151, conversion: "86%" },
  { id: "close", label: "First financial close (proxy)", count: 98, conversion: "65%" },
] satisfies FunnelStep[];

const captureEvents = [
  {
    id: "business.registered",
    name: "business.registered",
    when: "Owner finishes step 1 of registration",
    props: "business_type, district, acquisition_source",
    status: "Live",
    tone: "success",
  },
  {
    id: "kyb.submitted",
    name: "kyb.submitted",
    when: "Owner submits documents for review",
    props: "doc_count, tin_check_result",
    status: "Live",
    tone: "success",
  },
  {
    id: "kyb.decided",
    name: "kyb.decided",
    when: "Compliance approves or declines",
    props: "decision, hours_in_review",
    status: "Live",
    tone: "success",
  },
  {
    id: "workspace.provisioned",
    name: "workspace.provisioned",
    when: "Plan entitlements are granted",
    props: "plan, price_book_version",
    status: "Live",
    tone: "success",
  },
  {
    id: "reservation.created",
    name: "reservation.created",
    when: "Any channel creates a reservation",
    props: "channel, property_type",
    status: "Live",
    tone: "success",
  },
  {
    id: "stay.checked_out",
    name: "stay.checked_out",
    when: "Front desk completes checkout",
    props: "nights, property_type",
    status: "Live",
    tone: "success",
  },
  {
    id: "folio.closed",
    name: "folio.closed",
    when: "Folio balance is zero and closed",
    props: "payment_state, fiscal_state",
    status: "Live",
    tone: "success",
  },
  {
    id: "financial_close.completed",
    name: "financial_close.completed",
    when: "Business day closes with no open exceptions",
    props: "business_date, exception_count",
    status: "Not instrumented",
    tone: "danger",
  },
  {
    id: "activation.reached",
    name: "activation.reached",
    when: "First reservation, stay and close all done",
    props: "days_since_registration",
    status: "Derived",
    tone: "default",
  },
] satisfies CaptureEvent[];

const conversations = [
  {
    id: "c305",
    title: "Room 305 out of order",
    time: "09:12",
    snippet: "Extend out-of-order block to 14 Oct?",
    group: "Today",
    meta: "Started today 09:12 · 2 sources cited",
    question: "Why is room 305 out of order, and when will it be back?",
    questionTime: "09:12",
    answer: [
      "Room 305 has been out of order since Saturday 10 Oct at 16:40 because the bathroom water heater is leaking [1]. Jean-Paul Niyonsaba opened WO-312; the replacement heater is ordered and due on Tuesday 13 Oct.",
      "Housekeeping set the room to “Out of order · do not clean” on 10 Oct at 17:05 (Beatrice Mukandori) [2]. The current block ends Tuesday 13 Oct at 12:00, so the room would go back on sale for Tuesday night before the repair is finished.",
      "WO-312 estimates installation plus a 24-hour leak check, so the earliest realistic return is Wednesday 14 Oct.",
    ],
    sources: [
      {
        n: 1,
        icon: "Wrench",
        title: "WO-312 · Water heater leak",
        detail: "Maintenance · Waiting for parts · updated 11 Oct 18:20",
        board: "Maintenance",
      },
      {
        n: 2,
        icon: "BroomMotion",
        title: "Room 305 housekeeping record",
        detail: "Out of order since 10 Oct 17:05 · block ends 13 Oct 12:00",
        board: "HousekeepingBoard",
      },
    ],
    permissions: ["Maintenance · view", "Housekeeping · view"],
    proposal: true,
  },
  {
    id: "cArr",
    title: "Arrivals asking for early check-in",
    time: "07:40",
    snippet: "3 arrivals asked for rooms before 12:00",
    group: "Today",
    meta: "Started today 07:40 · 1 source cited",
    question: "Which of today’s arrivals asked for early check-in?",
    questionTime: "07:40",
    answer: [
      "Three of today’s 14 arrivals asked for early check-in: Sarah Kimani (BK-20431, Deluxe Lake View), Thomas Weber (BK-20433) and Yuki Tanaka (BK-20440). Room 204 is inspected and could take Sarah Kimani now.",
    ],
    sources: [
      {
        n: 1,
        icon: "Calendar",
        title: "Today’s arrivals list",
        detail: "Front desk · 14 arrivals · updated 07:35",
        board: "FrontDeskToday",
      },
    ],
    permissions: ["Reservations · view"],
  },
  {
    id: "cGrp",
    title: "EAC Health Forum pickup",
    time: "Sat",
    snippet: "23 of 25 rooms picked up",
    group: "Earlier",
    meta: "Sunday 11 Oct · 1 source cited",
    question: "How many rooms has the EAC Health Forum block picked up?",
    questionTime: "Sat 16:05",
    answer: [
      "23 of the 25 rooms in the EAC Health Forum block (23–26 Oct) are picked up. The cut-off is 16 Oct; the 2 unpicked rooms return to general inventory then unless you extend it.",
    ],
    sources: [
      {
        n: 1,
        icon: "Persons",
        title: "EAC Health Forum block",
        detail: "Group blocks · 23 of 25 picked up",
        board: "Groups",
      },
    ],
    permissions: ["Group blocks · view"],
  },
  {
    id: "cHelp",
    title: "How to add a child rate",
    time: "9 Oct",
    snippet: "Help article · Rates and inventory",
    group: "Earlier",
    meta: "9 Oct · help article",
    question: "How do I add a child rate for the Family Suite?",
    questionTime: "9 Oct 14:22",
    answer: [
      "Open Rates and inventory, choose the Family Suite rate plan and add an occupancy rule for children by age band. Changes to published rates still need the owner’s approval before they go live.",
    ],
    sources: [
      {
        n: 1,
        icon: "BookOpen",
        title: "Help: occupancy and child rates",
        detail: "Injishi help centre",
        board: "PublicHelp",
      },
    ],
    permissions: ["Help centre"],
  },
  {
    id: "cFis",
    title: "Fiscal receipt F-5512 pending",
    time: "3 Oct",
    snippet: "Handed to support",
    group: "Earlier",
    meta: "3 Oct · handed to support as SUP-4098",
    question: "Why is the fiscal receipt for folio F-5512 still pending?",
    questionTime: "3 Oct 11:02",
    answer: [
      "The receipt for F-5512 is Pending at the VSDC: the request was sent at 10:41 and is being retried with the same request ID, so no duplicate can be issued. I can’t see the VSDC’s side, so I handed this to support.",
    ],
    sources: [
      {
        n: 1,
        icon: "FileCheck",
        title: "F-5512 fiscal document",
        detail: "Fiscal receipts · Pending · retry 3",
        board: "FiscalReceipts",
      },
    ],
    permissions: ["Fiscal receipts · view"],
    chip: "With support · SUP-4098",
  },
] satisfies AssistantConversation[];

const usageMonths = [
  {
    id: "oct",
    label: "October to date",
    longLabel: "October 2026 to date",
    kpis: [
      { id: "conv", label: "Conversations", value: "3,482", foot: "1 to 12 October · 52 tenants" },
      { id: "cost", label: "Cost", value: "RWF 1.92M", foot: "38% of the RWF 5M platform budget" },
      { id: "help", label: "Rated helpful", value: "84%", foot: "Of 1,106 rated answers" },
      { id: "hand", label: "Handoff rate", value: "6.1%", foot: "212 tickets created from the assistant" },
      { id: "src", label: "Source coverage", value: "91%", foot: "Cite a record · 6% refused, no accessible record" },
    ],
    tenants: [
      {
        id: "amahoro",
        name: "Amahoro Hospitality Group",
        sub: "3 properties",
        conversations: 642,
        cost: 386400,
        limit: 1000000,
      },
      {
        id: "heights",
        name: "Kigali Heights Suites",
        sub: "1 property",
        conversations: 518,
        cost: 301200,
        limit: 800000,
      },
      {
        id: "rubona",
        name: "Rubona Bay Cottages",
        sub: "1 property",
        conversations: 412,
        cost: 248000,
        limit: 300000,
      },
      {
        id: "musanze",
        name: "Musanze Gorilla Lodge",
        sub: "1 property",
        conversations: 233,
        cost: 128900,
        limit: 500000,
      },
      { id: "huye", name: "Huye Heritage Inn", sub: "1 property", conversations: 174, cost: 96000, limit: 500000 },
      { id: "kivu", name: "Lake Kivu Waterfront", sub: "1 property", conversations: 151, cost: 88200, limit: 300000 },
      { id: "rest", name: "46 other tenants", sub: "Default limits", conversations: 1352, cost: 671300, limit: 0 },
    ],
    feedback: [84, 5, 4, 5, 2],
    ratedText: "October to date · 1,106 rated answers out of 9,840",
    refused: "14",
    budgetUsed: "October platform budget RWF 5,000,000 · RWF 1,920,000 used (38%)",
    budgetPct: 38,
  },
  {
    id: "sep",
    label: "September",
    longLabel: "September 2026",
    kpis: [
      { id: "conv", label: "Conversations", value: "7,915", foot: "September · 51 tenants" },
      { id: "cost", label: "Cost", value: "RWF 4.27M", foot: "85% of the RWF 5M platform budget" },
      { id: "help", label: "Rated helpful", value: "81%", foot: "Of 2,430 rated answers" },
      { id: "hand", label: "Handoff rate", value: "6.8%", foot: "538 tickets created from the assistant" },
      { id: "src", label: "Source coverage", value: "89%", foot: "Cite a record · 7% refused, no accessible record" },
    ],
    tenants: [
      {
        id: "amahoro",
        name: "Amahoro Hospitality Group",
        sub: "3 properties",
        conversations: 1512,
        cost: 874000,
        limit: 1000000,
      },
      {
        id: "heights",
        name: "Kigali Heights Suites",
        sub: "1 property",
        conversations: 1240,
        cost: 702500,
        limit: 800000,
      },
      {
        id: "rubona",
        name: "Rubona Bay Cottages",
        sub: "1 property",
        conversations: 980,
        cost: 300000,
        limit: 300000,
      },
      {
        id: "musanze",
        name: "Musanze Gorilla Lodge",
        sub: "1 property",
        conversations: 560,
        cost: 311000,
        limit: 500000,
      },
      { id: "huye", name: "Huye Heritage Inn", sub: "1 property", conversations: 402, cost: 228400, limit: 500000 },
      {
        id: "kivu",
        name: "Lake Kivu Waterfront",
        sub: "1 property",
        conversations: 361,
        cost: 205100,
        limit: 300000,
      },
      { id: "rest", name: "45 other tenants", sub: "Default limits", conversations: 2860, cost: 1648000, limit: 0 },
    ],
    feedback: [81, 6, 5, 6, 2],
    ratedText: "September · 2,430 rated answers out of 22,310",
    refused: "37",
    budgetUsed: "September closed at RWF 4,269,000 of RWF 5,000,000 (85%)",
    budgetPct: 85,
  },
] satisfies UsageMonth[];

const flaggedAnswers = [
  {
    id: "FL-0232",
    tenant: "Amahoro Hospitality Group",
    by: "Aline Uwase",
    reason: "Wrong information",
    age: "today 09:20",
    question: "Why is room 305 out of order, and when will it be back?",
    excerpt: "“…the earliest realistic return is Wednesday 14 Oct.”",
    sources: "WO-312 · Room 305 housekeeping record",
    note: "Supplier may deliver Wednesday, so 14 Oct could be too early.",
  },
  {
    id: "FL-0229",
    tenant: "Kigali Heights Suites",
    by: "Front desk user",
    reason: "Missing a source",
    age: "yesterday",
    question: "Is the Umubano conference block paid?",
    excerpt: "“The deposit for the block is verified…”",
    sources: "None cited",
    note: "It said verified but showed no payment reference.",
  },
  {
    id: "FL-0226",
    tenant: "Rubona Bay Cottages",
    by: "Owner",
    reason: "Should not see this",
    age: "10 Oct",
    question: "Show me the payroll total for September",
    excerpt: "“I can’t see payroll for your role. Your HR officer or owner can.”",
    sources: "Refused · permission check",
    note: "I am the owner, why was this refused?",
  },
  {
    id: "FL-0221",
    tenant: "Huye Heritage Inn",
    by: "General manager",
    reason: "Not helpful",
    age: "8 Oct",
    question: "How do I issue a credit note?",
    excerpt: "“Open the fiscal document and choose Credit note…”",
    sources: "Help: corrections and credit notes",
    note: "Steps did not match my screen.",
    closedOutcome: "Help article updated 9 Oct · user notified",
  },
] satisfies FlaggedAnswer[];

const findings = [
  { id: "correct", label: "Answer was correct for the data at the time" },
  { id: "stale", label: "Source record changed after the answer" },
  { id: "retrieval", label: "Missed or misread a record it could access" },
  { id: "policy", label: "Permission or scope issue · escalate" },
] satisfies FindingOption[];

const usageAlerts = [
  { id: "a80", label: "Alert tenant owner at 80%", on: true },
  { id: "a100", label: "Pause answers at 100%, keep handoff", on: true },
  { id: "owner", label: "Copy the support lead on alerts", on: true },
] satisfies UsageAlert[];

const retention = [
  { id: "conv", label: "Conversations", options: ["30 days", "90 days"], index: 1 },
  { id: "flag", label: "Flagged answers", options: ["1 year, for review", "6 months"], index: 0 },
  { id: "ho", label: "Handoff transcripts", options: ["With the support ticket", "1 year"], index: 0 },
  { id: "meta", label: "Usage metadata, no text", options: ["24 months", "12 months"], index: 0 },
] satisfies RetentionSetting[];

const tenantLimits = [
  { id: "200", label: "RWF 200,000" },
  { id: "300", label: "RWF 300,000" },
  { id: "400", label: "RWF 400,000" },
] satisfies TenantLimitOption[];

export const fixtures = {
  "platformops.catalogs": catalogs,
  "platformops.flags": flags,
  "platformops.pricePlans": pricePlans,
  "platformops.strings": strings,
  "platformops.templates": templates,
  "platformops.config": config,
  "platformops.roleFamilies": roleFamilies,
  "platformops.staff": staff,
  "platformops.accessReviews": accessReviews,
  "platformops.brokers": brokers,
  "platformops.auditKpis": auditKpis,
  "platformops.auditEvents": auditEvents,
  "platformops.insightAreas": insightAreas,
  "platformops.northStarSteps": northStarSteps,
  "platformops.funnel": funnel,
  "platformops.captureEvents": captureEvents,
  "platformops.conversations": conversations,
  "platformops.usageMonths": usageMonths,
  "platformops.flaggedAnswers": flaggedAnswers,
  "platformops.findings": findings,
  "platformops.usageAlerts": usageAlerts,
  "platformops.retention": retention,
  "platformops.tenantLimits": tenantLimits,
} satisfies FixtureSet;
