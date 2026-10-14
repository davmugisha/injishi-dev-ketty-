import type { stock } from "../media.ts";
import type { BoardId, FixtureSet, IconName, StatusTone } from "../types.ts";

/**
 * Embedded-database fixtures for the "residence" area (Kacyiru Court Residences, Amahoro Residences Ltd).
 * Collection names are "residence.<thing>"; every document has a stable string `id`.
 * Values are lifted verbatim from the artifact boards ResidenceHome, Applicants, Leases, RentRoll,
 * MoveOuts and ResidenceService (node tools/artifact/extract.mjs <Board>).
 */

export type Tone = StatusTone;
/** Key of a photo in the stock library (@injishi/data/media). */
export type StockKey = keyof typeof stock;

// ── Units, blocks and the residence home ─────────────────────────────────────

/** Rent status of a unit for the current month (artifact: ResidenceHome unit tiles). */
export type UnitStatus = "paid" | "pending" | "unknown" | "arrears" | "notice" | "vacant";

export interface ResidenceUnit {
  id: string;
  /** Block id, e.g. "A". */
  block: string;
  type: string;
  /** Resident or company name; empty when vacant. */
  resident: string;
  /** Active lease id; empty when vacant. */
  lease: string;
  /** Monthly rent (asking rent when vacant). */
  rent: number;
  status: UnitStatus;
  note: string;
}

export interface ResidenceBlock {
  id: string;
  name: string;
  /** Unit types in the block, e.g. "1 bedroom". */
  kind: string;
}

export interface HomeKpi {
  id: string;
  label: string;
  value: number;
  /** "22 of 24": the total the value is out of. */
  total?: number;
  format?: {
    style?: "decimal" | "currency" | "percent";
    currency?: string;
    notation?: "standard" | "compact";
    maximumFractionDigits?: number;
  };
  trend: string;
  /** success = up, danger = down, default = flat. */
  trendTone: Tone;
  trendIcon: IconName;
  foot: string;
  board: BoardId;
}

/** A line of the month's rent summary (October Rent widget). */
export interface RentBucket {
  id: "scheduled" | "verified" | "pending" | "unpaid";
  label: string;
  amount: number;
}

export interface ArrearsBucket {
  id: string;
  label: string;
  amount: number;
  who: string;
}

export interface Vacancy {
  id: string;
  unit: string;
  type: string;
  rent: number;
  days: number;
  note: string;
}

export interface RenewalNotice {
  id: string;
  /** Unit the item concerns (highlighted by the "Notices & renewals" filter). */
  unit: string;
  icon: IconName;
  title: string;
  desc: string;
  chip: string;
  chipTone: Tone;
  board: BoardId;
}

export interface HomeTicket {
  /** Work order id. */
  id: string;
  title: string;
  desc: string;
  chip: string;
  chipTone: Tone;
}

export interface LeaseFiling {
  id: string;
  /** awaiting = sent and waiting for the signed acknowledgement; draft = not sent yet. */
  stage: "awaiting" | "draft";
  status: "warning" | "current" | "default";
  icon: IconName;
  title: string;
  detail: string;
}

// ── Applicants ───────────────────────────────────────────────────────────────

export interface ApplicantDocument {
  name: string;
  meta: string;
  state: string;
  tone: Tone;
}

export interface BrokerAttribution {
  name: string;
  initials: string;
  detail: string;
  fee: number;
  terms: string;
  due: string;
}

export interface ApplicantProfile {
  unitLabel: string;
  contact: string;
  registered: string;
  moveIn: string;
  term: string;
  occupants: string;
  rent: number;
  deposit: number;
  status: string;
  statusTone: Tone;
  broker: BrokerAttribution | null;
  sourceLong: string;
  docs: ApplicantDocument[];
  /** Manual screening checks done, in the order of residence.screeningChecks. */
  checks: boolean[];
}

export interface Applicant {
  id: string;
  name: string;
  initials: string;
  avatarTone: Tone;
  unit: string;
  /** List subtitle after the unit. */
  source: string;
  /** List chip; "Screening" shows the checks done, e.g. "Screening 4/6". */
  stage: string;
  stageTone: Tone;
  profile: ApplicantProfile | null;
  /** Shown instead of a profile while the invitation is not accepted. */
  pendingNote?: string;
}

export interface ScreeningCheck {
  id: string;
  label: string;
  hint: string;
}

export interface RegistrationInvitation {
  id: string;
  name: string;
  contact: string;
  unit: string;
  by: string;
  sent: string;
  expires: string;
  status: string;
  statusTone: Tone;
  action: "Resend" | "View profile";
  /** Applicant whose profile the invitation created. */
  applicant?: string;
}

// ── Leases ───────────────────────────────────────────────────────────────────

/** Where the lease filing stands against the configured filing policy. */
export type FilingStage = "followup" | "ack" | "draft" | "none";

export interface RenewalOffer {
  state: string;
  tone: Tone;
  term: string;
  rent: string;
  topup: string;
  by: string;
  note: string;
  events: { title: string; when: string; status: "success" | "current" }[];
}

export interface Lease {
  id: string;
  unit: string;
  type: string;
  resident: string;
  status: string;
  statusTone: Tone;
  start: string;
  end: string;
  rent: number;
  /** Rent due day, e.g. "15th". */
  dueDay: string;
  /** Date of the last signature; empty while a draft. */
  signedOn: string;
  filing: { stage: FilingStage; deadline: string; delivery: string };
  /** Verified rent this year, as the declaration support shows it. */
  income: string;
  /** Named occupant who is not a signatory. */
  occupant?: { name: string; initials: string; sub: string };
  /** Signature evidence when it differs from the standard one-time-code record. */
  signatures?: { tenant: string; landlord: string };
  /** Rent schedule status when it differs from "Up to date". */
  rentChip?: { label: string; tone: Tone };
  /** Open maintenance on the unit. */
  maintenance?: { desc: string; chip: string; tone: Tone };
  /** Clauses edited for this lease (0-based clause index, optional note replacing the standard one). */
  edits?: { index: number; note?: string }[];
  offer?: RenewalOffer;
  /** Why there is no renewal, when it is not the standard end-date rule. */
  renewalNote?: string;
}

export interface LeaseClause {
  id: string;
  title: string;
  note: string;
  /** Clause still waiting for counsel. */
  review?: boolean;
}

export interface AcceptedRenewal {
  id: string;
  title: string;
  desc: string;
  chip: string;
  chipTone: Tone;
}

// ── Rent roll ────────────────────────────────────────────────────────────────

export type RentMonth = "paid" | "late" | "unpaid" | "pending" | "unknown" | "none";
export type RentStatus = "paid" | "arrears" | "pending" | "unknown";

export interface RentKpi {
  id: string;
  label: string;
  value: number;
  foot: string;
}

export interface RentRollRow {
  /** Unit id. */
  id: string;
  name: string;
  lease: string;
  /** Rent due day, e.g. "5th". */
  due: string;
  rent: number;
  /** July to October. */
  history: RentMonth[];
  /** Verified October payments. */
  verified: number;
  overdue: number;
  status: RentStatus;
}

export interface LedgerEntry {
  icon: IconName;
  title: string;
  desc: string;
  amount: number;
  state: string;
  tone: Tone;
}

export interface RentLedger {
  /** Unit id. */
  id: string;
  ledger: LedgerEntry[];
  reminders: { title: string; when: string; status: "success" | "current" }[];
}

export interface LandlordPayout {
  id: string;
  title: string;
  desc: string;
  amount: number;
  state: string;
  tone: Tone;
}

// ── Move-outs ────────────────────────────────────────────────────────────────

export interface DepositKpi {
  id: string;
  label: string;
  value: number;
  format: "currency" | "count";
  foot: string;
}

export interface InspectionItem {
  area: string;
  before: string;
  after: string;
  /** Photos taken at move-out. */
  photos: number;
  /** Stock photos standing in for them. */
  photoKeys: StockKey[];
  finding: string;
  tone: Tone;
}

export interface Deduction {
  id: string;
  item: string;
  reason: string;
  evidence: string;
  amount: number;
  response: string;
  tone: Tone;
  note: string;
}

export interface MoveOutCase {
  /** Unit id. */
  id: string;
  name: string;
  lease: string;
  when: string;
  status: string;
  statusTone: Tone;
  sub: string;
  /** Current step: Notice, Inspection, Deductions, Resident response, Approval, Refund (6 = done). */
  step: number;
  deposit: number;
  inspection:
    | { done: true; meta: string; checklist: InspectionItem[] }
    | { done: false; booked: boolean; title: string; text: string; hint: string };
  deductions: Deduction[];
  summary: { label: string; value: string; foot: string }[];
  /** Verified refund (closed settlements). */
  refund?: { title: string; text: string };
  /** Shown while no deduction can be proposed yet. */
  heldNote?: string;
  /** A deduction the resident disputes, waiting for the manager's decision. */
  dispute?: {
    deduction: string;
    title: string;
    text: string;
    /** Amount when the manager reduces the deduction. */
    reduceTo: number;
    /** Decision buttons, the summary shared with the resident, and the note in the deductions table. */
    options: Record<DisputeDecision, string>;
    resolutions: Record<DisputeDecision, string>;
    notes: Record<DisputeDecision, string>;
  };
  /** Who approves the settlement (never the proposer). */
  approver?: { name: string; role: string };
}

export type DisputeDecision = "keep" | "reduce" | "drop";

// ── Maintenance and visitors ─────────────────────────────────────────────────

export type TicketStatus = "new" | "assigned" | "progress" | "done";

export interface ServiceTicket {
  id: string;
  unit: string;
  title: string;
  /** Card subtitle: who is on it and when. */
  who: string;
  status: TicketStatus;
  category: string;
  resident: string;
  reported: string;
  entry: string;
  assignee: string;
  visit: string;
  cost: string;
  photos: { key: StockKey; alt: string }[];
  thread: { from: "resident" | "manager" | "note"; text: string; meta: string }[];
}

export interface AccessRequest {
  id: string;
  icon: IconName;
  title: string;
  desc: string;
  approveLabel: string;
  status: "open" | "approved" | "declined";
}

export interface PreregisteredVisitor {
  id: string;
  initials: string;
  name: string;
  unit: string;
  window: string;
  by: string;
  code: string;
  state: string;
  tone: Tone;
}

export interface VisitorLogEntry {
  id: string;
  name: string;
  phone: string;
  unit: string;
  how: string;
  arrived: string;
  left: string;
  by: string;
}

// ── Data ─────────────────────────────────────────────────────────────────────

const blocks: ResidenceBlock[] = [
  { id: "A", name: "Block A", kind: "1 bedroom" },
  { id: "B", name: "Block B", kind: "2 bedrooms" },
  { id: "C", name: "Block C", kind: "3 bedrooms and penthouses" },
];

const unit = (
  id: string,
  type: string,
  resident: string,
  lease: string,
  rent: number,
  status: UnitStatus,
  note: string,
): ResidenceUnit => ({ id, block: id.charAt(0), type, resident, lease, rent, status, note });

const units: ResidenceUnit[] = [
  unit("A-01", "1 bedroom", "Claude Nsengimana", "L-KC-001", 650000, "paid", "October rent verified on 3 Oct."),
  unit(
    "A-02",
    "1 bedroom",
    "Esperance Mukamurenzi",
    "L-KC-003",
    650000,
    "notice",
    "Notice received 1 Oct. Moves out 31 Oct; inspection booked 10:00.",
  ),
  unit(
    "A-03",
    "1 bedroom",
    "Fabrice Rugamba",
    "L-KC-012",
    700000,
    "arrears",
    "RWF 1,000,000 overdue. September was part-paid (RWF 400,000).",
  ),
  unit("A-04", "1 bedroom", "Vestine Uwamahoro", "L-KC-015", 700000, "paid", "October rent verified on 4 Oct."),
  unit(
    "A-05",
    "1 bedroom",
    "",
    "",
    700000,
    "vacant",
    "Vacant 18 days. Previous resident’s caution settlement is in progress.",
  ),
  unit("A-06", "1 bedroom", "Samuel Ndayisaba", "L-KC-017", 750000, "paid", "Water heater ticket in progress."),
  unit(
    "A-07",
    "1 bedroom",
    "Josiane Umutoni",
    "L-KC-021",
    750000,
    "paid",
    "Lease filing sent 18 Sep, acknowledgement not received.",
  ),
  unit(
    "A-08",
    "1 bedroom",
    "Thierry Kamanzi",
    "L-KC-008",
    750000,
    "paid",
    "Lease ends 31 Dec. Prepare a renewal offer by 1 Nov.",
  ),
  unit(
    "B-01",
    "2 bedrooms",
    "Ange Mutesi",
    "L-KC-009",
    850000,
    "paid",
    "Renewal accepted 8 Oct. Amendment awaiting her e-signature.",
  ),
  unit("B-02", "2 bedrooms", "David Mwiseneza", "L-KC-010", 850000, "paid", "October rent verified on 2 Oct."),
  unit("B-03", "2 bedrooms", "Nadine Kayitesi", "L-KC-016", 850000, "paid", "October rent verified on 5 Oct."),
  unit(
    "B-04",
    "2 bedrooms",
    "Umurage Consulting Ltd",
    "L-KC-013",
    900000,
    "arrears",
    "Company lease. RWF 900,000 overdue 7 days; invoice re-sent 10 Oct.",
  ),
  unit("B-05", "2 bedrooms", "Alain Mutabazi", "L-KC-018", 900000, "paid", "October rent verified on 1 Oct."),
  unit("B-06", "2 bedrooms", "Chantal Nyirahabimana", "L-KC-019", 900000, "paid", "October rent verified on 5 Oct."),
  unit(
    "B-07",
    "2 bedrooms",
    "Olivier Habineza",
    "L-KC-014",
    950000,
    "pending",
    "MTN MoMo payment of RWF 950,000 pending. Renewal answer due 15 Oct.",
  ),
  unit("B-08", "2 bedrooms", "Moses Kariuki", "L-KC-020", 950000, "paid", "October rent verified on 3 Oct."),
  unit("C-01", "3 bedrooms", "Yvonne Murekatete", "L-KC-002", 1000000, "paid", "Balcony door lock ticket assigned."),
  unit("C-02", "3 bedrooms", "Jean-Claude Habiyaremye", "L-KC-004", 1000000, "paid", "October rent verified on 1 Oct."),
  unit("C-03", "3 bedrooms", "", "", 1050000, "vacant", "Vacant 41 days. Ready to let."),
  unit(
    "C-04",
    "3 bedrooms",
    "Hassan Abdallah",
    "L-KC-005",
    1050000,
    "paid",
    "Overnight visitor request waiting for your approval.",
  ),
  unit(
    "C-05",
    "3 bedrooms",
    "Benjamin Ruzindana",
    "L-KC-007",
    1100000,
    "arrears",
    "RWF 2,500,000 overdue, oldest 68 days. Three reminders sent.",
  ),
  unit(
    "C-06",
    "3 bedrooms",
    "Liliane Gasana",
    "L-KC-022",
    1100000,
    "paid",
    "New lease signed 2 Oct. Filing still in draft.",
  ),
  unit(
    "C-07",
    "Penthouse",
    "Ruth Wanjiru",
    "L-KC-023",
    1200000,
    "unknown",
    "Airtel Money result unknown. Checking with the provider; resident told not to pay again.",
  ),
  unit("C-08", "Penthouse", "Innocent Bizimana", "L-KC-024", 1200000, "paid", "October rent verified on 4 Oct."),
];

const compactRwf = { style: "currency", currency: "RWF", notation: "compact", maximumFractionDigits: 2 } as const;

const homeKpis: HomeKpi[] = [
  {
    id: "leased",
    label: "Leased units",
    value: 22,
    total: 24,
    trend: "92%",
    trendTone: "default",
    trendIcon: "FolderHouse",
    foot: "Vacant: A-05 for 18 days, C-03 for 41 days",
    board: "Applicants",
  },
  {
    id: "due",
    label: "Rent due in October",
    value: 19750000,
    format: compactRwf,
    trend: "22 charges",
    trendTone: "default",
    trendIcon: "Calendar",
    foot: "Scheduled receivables from active leases",
    board: "RentRoll",
  },
  {
    id: "collected",
    label: "Collected, verified",
    value: 14900000,
    format: compactRwf,
    trend: "75%",
    trendTone: "success",
    trendIcon: "Check",
    foot: "Confirmed by MTN MoMo, Airtel Money or GT Bank",
    board: "RentRoll",
  },
  {
    id: "pending",
    label: "Pending verification",
    value: 2150000,
    format: compactRwf,
    trend: "2 payments",
    trendTone: "default",
    trendIcon: "Clock",
    foot: "Not counted as collected yet",
    board: "RentRoll",
  },
  {
    id: "arrears",
    label: "Arrears",
    value: 4400000,
    format: compactRwf,
    trend: "3 residents",
    trendTone: "danger",
    trendIcon: "TriangleExclamation",
    foot: "Oldest 68 days · C-05",
    board: "RentRoll",
  },
];

const rentBuckets: RentBucket[] = [
  { id: "scheduled", label: "Scheduled · 22 charges", amount: 19750000 },
  { id: "verified", label: "Verified collected · 17", amount: 14900000 },
  { id: "pending", label: "Pending verification · 2", amount: 2150000 },
  { id: "unpaid", label: "Not paid · 3", amount: 2700000 },
];

const arrearsAging: ArrearsBucket[] = [
  { id: "1-30", label: "1 to 30 days", amount: 2700000, who: "A-03, B-04, C-05 · October rent" },
  { id: "31-60", label: "31 to 60 days", amount: 1400000, who: "A-03 September balance, C-05 September" },
  { id: "61-90", label: "61 to 90 days", amount: 300000, who: "C-05 August balance after a partial payment" },
  { id: "90+", label: "Over 90 days", amount: 0, who: "None" },
];

const vacancies: Vacancy[] = [
  {
    id: "A-05",
    unit: "A-05",
    type: "1 bedroom",
    rent: 700000,
    days: 18,
    note: "Since 24 Sep · repaint booked 14 Oct · 1 applicant in screening, referred by a broker",
  },
  {
    id: "C-03",
    unit: "C-03",
    type: "3 bedrooms",
    rent: 1050000,
    days: 41,
    note: "Since 1 Sep · ready to let · 2 applicants, one screening complete",
  },
];

const renewals: RenewalNotice[] = [
  {
    id: "L-KC-014",
    unit: "B-07",
    icon: "ArrowsRotateRight",
    title: "B-07 · Olivier Habineza",
    desc: "Renewal offer sent 1 Oct at RWF 980,000 · answer due 15 Oct",
    chip: "3 days",
    chipTone: "warning",
    board: "Leases",
  },
  {
    id: "L-KC-003",
    unit: "A-02",
    icon: "ArrowRightFromSquare",
    title: "A-02 · Esperance Mukamurenzi",
    desc: "Notice received 1 Oct · moves out 31 Oct · inspection 10:00",
    chip: "Move-out",
    chipTone: "info",
    board: "MoveOuts",
  },
  {
    id: "L-KC-009",
    unit: "B-01",
    icon: "Pencil",
    title: "B-01 · Ange Mutesi",
    desc: "Renewal accepted 8 Oct · amendment waiting for her e-signature",
    chip: "Signing",
    chipTone: "default",
    board: "Leases",
  },
  {
    id: "L-KC-008",
    unit: "A-08",
    icon: "Calendar",
    title: "A-08 · Thierry Kamanzi",
    desc: "Lease ends 31 Dec · prepare an offer by 1 Nov",
    chip: "80 days",
    chipTone: "default",
    board: "Leases",
  },
];

const homeTickets: HomeTicket[] = [
  {
    id: "WO-345",
    title: "B-07 · Kitchen sink leaking",
    desc: "Kigali Plumbing Co. · Tue 13 Oct 10:00",
    chip: "Assigned",
    chipTone: "info",
  },
  {
    id: "WO-341",
    title: "A-06 · Water heater not heating",
    desc: "Fidèle Ntawukuriryayo · day 3",
    chip: "In progress",
    chipTone: "info",
  },
  {
    id: "WO-347",
    title: "Block B · Stairwell light out",
    desc: "Common area · reported by B-03",
    chip: "Not assigned",
    chipTone: "warning",
  },
  {
    id: "WO-344",
    title: "A-05 · Repaint before letting",
    desc: "Vacant unit · booked 14 Oct",
    chip: "Scheduled",
    chipTone: "default",
  },
];

const filings: LeaseFiling[] = [
  {
    id: "L-KC-014",
    stage: "awaiting",
    status: "warning",
    icon: "Clock",
    title: "L-KC-014 · B-07 · Olivier Habineza",
    detail: "Sent 21 Nov 2025 · acknowledgement never uploaded · needs follow-up",
  },
  {
    id: "L-KC-021",
    stage: "awaiting",
    status: "current",
    icon: "PaperPlane",
    title: "L-KC-021 · A-07 · Josiane Umutoni",
    detail: "Sent 18 Sep · waiting for the signed acknowledgement",
  },
  {
    id: "L-KC-022",
    stage: "draft",
    status: "default",
    icon: "FileText",
    title: "L-KC-022 · C-06 · Liliane Gasana",
    detail: "Signed 2 Oct · draft · configured deadline 17 Oct",
  },
];

const screeningChecks: ScreeningCheck[] = [
  { id: "identity", label: "Identity matches the ID document", hint: "Original seen in person" },
  { id: "income", label: "Income at least 3 times the rent", hint: "From payslips or bank statements" },
  { id: "employment", label: "Employment confirmed with the employer", hint: "Phone call logged with date and name" },
  { id: "reference", label: "Previous landlord reference received", hint: "Written reference or call note" },
  { id: "balance", label: "No unpaid balance with Amahoro Residences", hint: "Checked against past leases" },
  { id: "rules", label: "House rules and caution terms explained", hint: "Applicant confirmed in writing" },
];

const applicants: Applicant[] = [
  {
    id: "sandrine",
    name: "Sandrine Iradukunda",
    initials: "SI",
    avatarTone: "accent",
    unit: "A-05",
    source: "Referred by Emmanuel Twagira",
    stage: "Screening",
    stageTone: "info",
    profile: {
      unitLabel: "A-05 · 1 bedroom",
      contact: "+250 788 •• 31 07 · s.iradukunda@…",
      registered: "8 Oct",
      moveIn: "1 Nov 2026",
      term: "12 months",
      occupants: "2 adults",
      rent: 700000,
      deposit: 1400000,
      status: "Screening",
      statusTone: "info",
      broker: {
        name: "Emmanuel Twagira",
        initials: "ET",
        detail: "Residence broker · referral recorded 8 Oct 16:20",
        fee: 350000,
        terms: "Broker agreement v2, effective 1 Jul 2026",
        due: "Only if a lease is signed",
      },
      sourceLong: "Referred by Emmanuel Twagira.",
      docs: [
        {
          name: "National ID",
          meta: "Uploaded 8 Oct · checked against the original by Solange, 11 Oct",
          state: "Checked",
          tone: "success",
        },
        { name: "Employment letter", meta: "Bank of Kigali · uploaded 8 Oct", state: "Checked", tone: "success" },
        { name: "Bank statements, 3 months", meta: "PDF · uploaded 9 Oct", state: "Uploaded", tone: "default" },
        {
          name: "Previous landlord reference",
          meta: "Requested 9 Oct · not received",
          state: "Waiting",
          tone: "warning",
        },
      ],
      checks: [true, true, true, false, true, false],
    },
  },
  {
    id: "florence",
    name: "Florence Nyiransabimana",
    initials: "FN",
    avatarTone: "success",
    unit: "C-03",
    source: "Invitation",
    stage: "Ready",
    stageTone: "success",
    profile: {
      unitLabel: "C-03 · 3 bedrooms",
      contact: "+250 722 •• 58 90 · f.nyiransabimana@…",
      registered: "3 Oct",
      moveIn: "15 Oct 2026",
      term: "24 months",
      occupants: "2 adults, 2 children",
      rent: 1050000,
      deposit: 2100000,
      status: "Ready for lease",
      statusTone: "success",
      broker: null,
      sourceLong: "Viewed C-03 on 30 Sep and received a registration invitation from Solange on 1 Oct.",
      docs: [
        { name: "National ID", meta: "Checked against the original, 3 Oct", state: "Checked", tone: "success" },
        {
          name: "Employment contract",
          meta: "Ministry of Health · checked 4 Oct",
          state: "Checked",
          tone: "success",
        },
        { name: "Payslips, 3 months", meta: "Checked 4 Oct", state: "Checked", tone: "success" },
        {
          name: "Previous landlord reference",
          meta: "Received 6 Oct · good standing",
          state: "Checked",
          tone: "success",
        },
      ],
      checks: [true, true, true, true, true, true],
    },
  },
  {
    id: "peter",
    name: "Peter Otieno",
    initials: "PO",
    avatarTone: "default",
    unit: "C-03",
    source: "Invitation sent 10 Oct",
    stage: "Invited",
    stageTone: "default",
    profile: null,
    pendingNote:
      "Invitation sent by email on 10 Oct for C-03. It expires on 17 Oct. His profile, documents and screening appear here once he accepts.",
  },
];

const invitations: RegistrationInvitation[] = [
  {
    id: "inv-peter",
    name: "Peter Otieno",
    contact: "p.otieno@… · email",
    unit: "C-03",
    by: "Solange Uwimana",
    sent: "10 Oct",
    expires: "17 Oct",
    status: "Sent",
    statusTone: "info",
    action: "Resend",
    applicant: "peter",
  },
  {
    id: "inv-sandrine",
    name: "Sandrine Iradukunda",
    contact: "Broker link · Emmanuel Twagira",
    unit: "A-05",
    by: "Broker referral",
    sent: "8 Oct",
    expires: "15 Oct",
    status: "Accepted 8 Oct",
    statusTone: "success",
    action: "View profile",
    applicant: "sandrine",
  },
  {
    id: "inv-florence",
    name: "Florence Nyiransabimana",
    contact: "f.nyiransabimana@… · email",
    unit: "C-03",
    by: "Solange Uwimana",
    sent: "1 Oct",
    expires: "8 Oct",
    status: "Accepted 3 Oct",
    statusTone: "success",
    action: "View profile",
    applicant: "florence",
  },
  {
    id: "inv-divine",
    name: "Divine Ishimwe",
    contact: "d.ishimwe@… · email",
    unit: "A-05",
    by: "Solange Uwimana",
    sent: "26 Sep",
    expires: "3 Oct",
    status: "Expired",
    statusTone: "default",
    action: "Resend",
  },
  {
    id: "inv-jacques",
    name: "Jacques Mugabo",
    contact: "In-app link",
    unit: "C-03",
    by: "Solange Uwimana",
    sent: "23 Sep",
    expires: "30 Sep",
    status: "Expired",
    statusTone: "default",
    action: "Resend",
  },
];

const ACK_FILING = { stage: "ack", deadline: "Met", delivery: "Signed acknowledgement on file" } as const;

const leases: Lease[] = [
  {
    id: "L-KC-014",
    unit: "B-07",
    type: "2 bedrooms",
    resident: "Olivier Habineza",
    status: "Renewal offered",
    statusTone: "warning",
    start: "15 Nov 2025",
    end: "14 Nov 2026",
    rent: 950000,
    dueDay: "15th",
    signedOn: "10 Nov 2025",
    filing: {
      stage: "followup",
      deadline: "25 Nov 2025 · met (sent 21 Nov)",
      delivery: "Copy delivered in person by Solange Uwimana, 21 Nov 2025 · recipient office not recorded",
    },
    income: "RWF 8,550,000",
    occupant: { name: "Ines Habineza", initials: "IH", sub: "Named occupant · not a signatory" },
    signatures: {
      tenant: "Signed 9 Nov 2025 19:31 · one-time code to +250 78• ••• 412 · document fingerprint a41f…9c0e",
      landlord: "Signed 10 Nov 2025 08:14 · one-time code to registered phone · same fingerprint",
    },
    rentChip: { label: "Payment pending", tone: "info" },
    maintenance: { desc: "Kitchen sink leaking · plumber Tue 10:00", chip: "1 open", tone: "info" },
    edits: [
      { index: 2, note: "Due on the 15th instead of the 1st, agreed at signing" },
      { index: 0, note: "Adds Ines Habineza as a named occupant" },
    ],
    offer: {
      state: "Waiting for resident",
      tone: "warning",
      term: "15 Nov 2026 – 14 Nov 2027 · 12 months",
      rent: "RWF 980,000 a month (+3.2%)",
      topup: "RWF 60,000 to keep two months held",
      by: "Thursday 15 Oct 2026",
      note: "If Olivier declines or gives notice, the move-out flow starts and the lease ends on 14 Nov. An accepted offer becomes an amendment that both parties e-sign.",
      events: [
        { title: "Offer approved and sent", when: "1 Oct · by Solange Uwimana", status: "success" },
        { title: "Opened by Olivier in the resident app", when: "2 Oct 18:40", status: "success" },
        { title: "Reminder sent", when: "10 Oct · in-app and email", status: "current" },
      ],
    },
  },
  {
    id: "L-KC-009",
    unit: "B-01",
    type: "2 bedrooms",
    resident: "Ange Mutesi",
    status: "Renewal accepted",
    statusTone: "info",
    start: "1 Dec 2025",
    end: "30 Nov 2026",
    rent: 850000,
    dueDay: "1st",
    signedOn: "25 Nov 2025",
    filing: { ...ACK_FILING },
    income: "RWF 7,650,000",
    offer: {
      state: "Accepted · signing",
      tone: "info",
      term: "1 Dec 2026 – 30 Nov 2027 · 12 months",
      rent: "RWF 870,000 a month (+2.4%)",
      topup: "RWF 40,000",
      by: "Answered 8 Oct",
      note: "Amendment sent for e-signature on 9 Oct. Ange has not signed yet; the landlord signs after her.",
      events: [
        { title: "Offer sent", when: "25 Sep", status: "success" },
        { title: "Accepted by Ange Mutesi", when: "8 Oct 09:12", status: "success" },
        { title: "Amendment awaiting her signature", when: "Sent 9 Oct", status: "current" },
      ],
    },
  },
  {
    id: "L-KC-022",
    unit: "C-06",
    type: "3 bedrooms",
    resident: "Liliane Gasana",
    status: "Filing draft",
    statusTone: "warning",
    start: "5 Oct 2026",
    end: "4 Oct 2027",
    rent: 1100000,
    dueDay: "5th",
    signedOn: "2 Oct 2026",
    filing: { stage: "draft", deadline: "17 Oct 2026 (configured)", delivery: "Not sent yet" },
    income: "RWF 0 (lease started in October)",
  },
  {
    id: "L-KC-025",
    unit: "A-05",
    type: "1 bedroom",
    resident: "Sandrine Iradukunda",
    status: "Draft",
    statusTone: "default",
    start: "1 Nov 2026",
    end: "31 Oct 2027",
    rent: 700000,
    dueDay: "1st",
    signedOn: "",
    filing: { stage: "none", deadline: "Counts from the last signature", delivery: "Not applicable until signed" },
    income: "RWF 0 (not started)",
    edits: [{ index: 2 }],
  },
  {
    id: "L-KC-003",
    unit: "A-02",
    type: "1 bedroom",
    resident: "Esperance Mukamurenzi",
    status: "Notice given",
    statusTone: "accent",
    start: "1 Nov 2025",
    end: "31 Oct 2026",
    rent: 650000,
    dueDay: "1st",
    signedOn: "27 Oct 2025",
    filing: { ...ACK_FILING },
    income: "RWF 5,850,000",
    renewalNote: "Esperance gave notice on 1 Oct. Her move-out is tracked in Move-outs.",
  },
  {
    id: "L-KC-013",
    unit: "B-04",
    type: "2 bedrooms",
    resident: "Umurage Consulting Ltd",
    status: "Active",
    statusTone: "success",
    start: "1 Mar 2026",
    end: "28 Feb 2027",
    rent: 900000,
    dueDay: "5th",
    signedOn: "24 Feb 2026",
    filing: { ...ACK_FILING },
    income: "RWF 6,300,000",
  },
  {
    id: "L-KC-008",
    unit: "A-08",
    type: "1 bedroom",
    resident: "Thierry Kamanzi",
    status: "Active",
    statusTone: "success",
    start: "1 Jan 2026",
    end: "31 Dec 2026",
    rent: 750000,
    dueDay: "1st",
    signedOn: "22 Dec 2025",
    filing: { ...ACK_FILING },
    income: "RWF 6,750,000",
  },
];

const leaseClauses: LeaseClause[] = [
  { id: "parties", title: "Parties and premises", note: "Unit, fixtures and named occupants" },
  { id: "term", title: "Term and renewal", note: "Fixed term with renewal by written offer" },
  { id: "rent", title: "Rent, due date and late payment", note: "Due date, grace period, partial payments" },
  { id: "deposit", title: "Caution deposit", note: "Two months held; settlement after inspection" },
  { id: "use", title: "Use of premises", note: "Residential use only; no subletting or nightly letting" },
  { id: "maintenance", title: "Maintenance and repairs", note: "Requests through the resident app" },
  {
    id: "visitors",
    title: "Visitors and access",
    note: "Pre-registration; overnight visits over 7 nights need approval",
  },
  { id: "notice", title: "Notice and termination", note: "30 days in writing, either party" },
  { id: "inspection", title: "Move-out inspection", note: "Joint inspection with photos" },
  {
    id: "disputes",
    title: "Disputes",
    note: "Mediation first; governing law to be confirmed by counsel",
    review: true,
  },
];

const acceptedRenewals: AcceptedRenewal[] = [
  {
    id: "B-01",
    title: "B-01 · Ange Mutesi",
    desc: "Accepted 8 Oct · amendment awaiting her e-signature",
    chip: "Signing",
    chipTone: "info",
  },
  {
    id: "A-04",
    title: "A-04 · Vestine Uwamahoro",
    desc: "Accepted 14 Aug · amendment signed by both 20 Aug",
    chip: "Signed",
    chipTone: "success",
  },
  {
    id: "C-02",
    title: "C-02 · Jean-Claude Habiyaremye",
    desc: "Accepted 2 Jul · signed by both 9 Jul",
    chip: "Signed",
    chipTone: "success",
  },
];

const rentKpis: RentKpi[] = [
  { id: "scheduled", label: "Scheduled", value: 19750000, foot: "22 October charges" },
  { id: "collected", label: "Collected, verified", value: 14900000, foot: "17 charges closed · 75%" },
  { id: "pending", label: "Pending verification", value: 2150000, foot: "B-07 MoMo pending · C-07 unknown" },
  { id: "overdue", label: "Overdue", value: 4400000, foot: "3 residents · oldest 68 days" },
  { id: "vacancy", label: "Vacancy", value: 1750000, foot: "A-05 and C-03 · not a receivable" },
];

const MONTH: Record<string, RentMonth> = {
  p: "paid",
  l: "late",
  x: "unpaid",
  q: "pending",
  u: "unknown",
  n: "none",
};
const row = (
  id: string,
  name: string,
  lease: string,
  due: string,
  rent: number,
  history: string,
  verified: number,
  overdue: number,
  status: RentStatus,
): RentRollRow => ({
  id,
  name,
  lease,
  due,
  rent,
  history: history.split("").map((c) => MONTH[c] ?? "none"),
  verified,
  overdue,
  status,
});

const rentRoll: RentRollRow[] = [
  row("A-01", "Claude Nsengimana", "L-KC-001", "1st", 650000, "pppp", 650000, 0, "paid"),
  row("A-02", "Esperance Mukamurenzi", "L-KC-003", "1st", 650000, "pppp", 650000, 0, "paid"),
  row("A-03", "Fabrice Rugamba", "L-KC-012", "5th", 700000, "plxx", 0, 1000000, "arrears"),
  row("A-04", "Vestine Uwamahoro", "L-KC-015", "5th", 700000, "pppp", 700000, 0, "paid"),
  row("A-06", "Samuel Ndayisaba", "L-KC-017", "1st", 750000, "pppp", 750000, 0, "paid"),
  row("A-07", "Josiane Umutoni", "L-KC-021", "1st", 750000, "nnpp", 750000, 0, "paid"),
  row("A-08", "Thierry Kamanzi", "L-KC-008", "1st", 750000, "pppp", 750000, 0, "paid"),
  row("B-01", "Ange Mutesi", "L-KC-009", "1st", 850000, "pppp", 850000, 0, "paid"),
  row("B-02", "David Mwiseneza", "L-KC-010", "1st", 850000, "pppp", 850000, 0, "paid"),
  row("B-03", "Nadine Kayitesi", "L-KC-016", "5th", 850000, "pplp", 850000, 0, "paid"),
  row("B-04", "Umurage Consulting Ltd", "L-KC-013", "5th", 900000, "pppx", 0, 900000, "arrears"),
  row("B-05", "Alain Mutabazi", "L-KC-018", "1st", 900000, "pppp", 900000, 0, "paid"),
  row("B-06", "Chantal Nyirahabimana", "L-KC-019", "5th", 900000, "pppp", 900000, 0, "paid"),
  row("B-07", "Olivier Habineza", "L-KC-014", "15th", 950000, "pppq", 0, 0, "pending"),
  row("B-08", "Moses Kariuki", "L-KC-020", "1st", 950000, "pppp", 950000, 0, "paid"),
  row("C-01", "Yvonne Murekatete", "L-KC-002", "1st", 1000000, "pppp", 1000000, 0, "paid"),
  row("C-02", "Jean-Claude Habiyaremye", "L-KC-004", "1st", 1000000, "pppp", 1000000, 0, "paid"),
  row("C-04", "Hassan Abdallah", "L-KC-005", "1st", 1050000, "pppp", 1050000, 0, "paid"),
  row("C-05", "Benjamin Ruzindana", "L-KC-007", "5th", 1100000, "pxxx", 0, 2500000, "arrears"),
  row("C-06", "Liliane Gasana", "L-KC-022", "5th", 1100000, "nnnp", 1100000, 0, "paid"),
  row("C-07", "Ruth Wanjiru", "L-KC-023", "15th", 1200000, "pppu", 0, 0, "unknown"),
  row("C-08", "Innocent Bizimana", "L-KC-024", "1st", 1200000, "pppp", 1200000, 0, "paid"),
];

const rentLedgers: RentLedger[] = [
  {
    id: "A-03",
    ledger: [
      {
        icon: "FileDollar",
        title: "September rent",
        desc: "Charged 5 Sep · RWF 400,000 paid · RWF 300,000 open",
        amount: 700000,
        state: "Part-paid",
        tone: "danger",
      },
      {
        icon: "Smartphone",
        title: "MTN MoMo payment",
        desc: "PI-77094 · ref MP260909.1422.C11873 · 9 Sep 14:22 · allocated to September rent",
        amount: 400000,
        state: "Verified",
        tone: "success",
      },
      {
        icon: "FileDollar",
        title: "October rent",
        desc: "Charged 5 Oct · nothing paid",
        amount: 700000,
        state: "Open",
        tone: "danger",
      },
    ],
    reminders: [
      { title: "In-app reminder", when: "6 Sep · read 6 Sep", status: "success" },
      { title: "Call by Solange · promised end of September", when: "20 Sep · note logged", status: "success" },
      { title: "In-app and email reminder", when: "6 Oct · email delivered", status: "success" },
      { title: "In-app reminder", when: "10 Oct · not read yet", status: "current" },
    ],
  },
  {
    id: "B-04",
    ledger: [
      {
        icon: "FileDollar",
        title: "October rent",
        desc: "Invoice INV-26-0412 to Umurage Consulting Ltd · charged 5 Oct",
        amount: 900000,
        state: "Open",
        tone: "danger",
      },
    ],
    reminders: [{ title: "Invoice re-sent to accounts@…", when: "10 Oct · email delivered", status: "current" }],
  },
  {
    id: "C-05",
    ledger: [
      {
        icon: "FileDollar",
        title: "August rent",
        desc: "RWF 800,000 paid 20 Aug · RWF 300,000 open",
        amount: 1100000,
        state: "Part-paid",
        tone: "danger",
      },
      {
        icon: "Smartphone",
        title: "Airtel Money payment",
        desc: "PI-77031 · ref AM260820.0915.77310 · allocated to August rent",
        amount: 800000,
        state: "Verified",
        tone: "success",
      },
      {
        icon: "FileDollar",
        title: "September rent",
        desc: "Charged 5 Sep · nothing paid",
        amount: 1100000,
        state: "Open",
        tone: "danger",
      },
      {
        icon: "FileDollar",
        title: "October rent",
        desc: "Charged 5 Oct · nothing paid",
        amount: 1100000,
        state: "Open",
        tone: "danger",
      },
    ],
    reminders: [
      { title: "In-app and email", when: "6 Sep", status: "success" },
      { title: "Formal letter delivered", when: "22 Sep · signed for", status: "success" },
      { title: "In-app and email", when: "6 Oct · not read", status: "current" },
    ],
  },
  {
    id: "B-07",
    ledger: [
      {
        icon: "FileDollar",
        title: "October rent",
        desc: "Due 15 Oct · not yet due",
        amount: 950000,
        state: "Open",
        tone: "default",
      },
      {
        icon: "Smartphone",
        title: "MTN MoMo payment",
        desc: "PI-77162 · started 09:41 today · waiting for Olivier to approve on his phone · will be allocated to October rent once verified",
        amount: 950000,
        state: "Pending",
        tone: "info",
      },
    ],
    reminders: [],
  },
  {
    id: "C-07",
    ledger: [
      {
        icon: "FileDollar",
        title: "October rent",
        desc: "Due 15 Oct · not yet due",
        amount: 1200000,
        state: "Open",
        tone: "default",
      },
      {
        icon: "Smartphone",
        title: "Airtel Money payment",
        desc: "PI-77158 · started 08:12 · provider timed out · rechecking every 15 min, next 10:15 · resident told not to pay again",
        amount: 1200000,
        state: "Unknown",
        tone: "warning",
      },
    ],
    reminders: [],
  },
];

const payouts: LandlordPayout[] = [
  {
    id: "2026-09",
    title: "September 2026 rent",
    desc: "Settled to Amahoro Residences Ltd · GT Bank ••••2210 · matched to bank statement 3 Oct",
    amount: 18250000,
    state: "Settled",
    tone: "success",
  },
  {
    id: "2026-10",
    title: "October 2026 to date",
    desc: "Verified payments only · reconciled daily · 2 unverified payments excluded",
    amount: 14900000,
    state: "In settlement",
    tone: "info",
  },
];

const depositKpis: DepositKpi[] = [
  {
    id: "held",
    label: "Caution deposits held",
    value: 40900000,
    format: "currency",
    foot: "23 deposits · a liability, not income",
  },
  { id: "settlement", label: "In settlement", value: 1400000, format: "currency", foot: "A-05 · previous resident" },
  { id: "notices", label: "Notices running", value: 1, format: "count", foot: "A-02 moves out 31 Oct" },
  {
    id: "refunded",
    label: "Refunded this quarter",
    value: 2075000,
    format: "currency",
    foot: "C-03 · verified 18 Sep",
  },
];

const moveOuts: MoveOutCase[] = [
  {
    id: "A-05",
    name: "Gilbert Nshuti",
    lease: "L-KC-011",
    when: "Moved out 24 Sep",
    status: "Item disputed",
    statusTone: "warning",
    sub: "Notice received 22 Aug · keys returned 24 Sep · deposit RWF 1,400,000 held",
    step: 3,
    deposit: 1400000,
    inspection: {
      done: true,
      meta: "Inspected 24 Sep 10:00 with Gilbert · report signed by both at 10:52 · compared with move-in report of 25 Sep 2025",
      checklist: [
        {
          area: "Living room walls",
          before: "Light marks",
          after: "Marks and two holes above the sofa",
          photos: 3,
          photoKeys: ["wallNailHoles"],
          finding: "Damage",
          tone: "warning",
        },
        {
          area: "Living room floor",
          before: "Good",
          after: "Minor scuffs",
          photos: 1,
          photoKeys: ["livingRoomFloor"],
          finding: "Fair wear",
          tone: "default",
        },
        {
          area: "Kitchen cabinets",
          before: "Good",
          after: "Upper cabinet hinge broken",
          photos: 2,
          photoKeys: ["cabinetHinge"],
          finding: "Damage",
          tone: "warning",
        },
        {
          area: "Kitchen appliances",
          before: "Good",
          after: "Good, cleaned",
          photos: 1,
          photoKeys: ["kitchenAppliances"],
          finding: "Good",
          tone: "success",
        },
        {
          area: "Bedroom and windows",
          before: "Good",
          after: "Good",
          photos: 1,
          photoKeys: ["bedroomWindow"],
          finding: "Good",
          tone: "success",
        },
        {
          area: "Bathroom fittings",
          before: "Good",
          after: "Tap washer worn",
          photos: 1,
          photoKeys: ["drippingTap"],
          finding: "Fair wear",
          tone: "default",
        },
        {
          area: "Keys and access cards",
          before: "2 keys, 2 cards",
          after: "2 keys, 2 cards returned",
          photos: 0,
          photoKeys: [],
          finding: "Complete",
          tone: "success",
        },
        {
          area: "Water meter",
          before: "1,198 m³",
          after: "1,284 m³ · photo of meter",
          photos: 1,
          photoKeys: ["waterMeter"],
          finding: "Reading taken",
          tone: "default",
        },
      ],
    },
    deductions: [
      {
        id: "repaint",
        item: "Repaint living-room wall",
        reason: "Two holes and marks beyond the move-in report",
        evidence: "3 photos · Kigali Paint Works quote Q-118",
        amount: 120000,
        response: "Disputed",
        tone: "warning",
        note: "“Marks were there at move-in”",
      },
      {
        id: "hinge",
        item: "Replace kitchen cabinet hinge",
        reason: "Broken during tenancy",
        evidence: "2 photos · hardware receipt",
        amount: 35000,
        response: "Accepted",
        tone: "success",
        note: "26 Sep 18:20 in the resident app",
      },
      {
        id: "water",
        item: "Unpaid water, September",
        reason: "Meter 1,284 m³ · share of the WASAC bill",
        evidence: "Meter photo · bill split",
        amount: 18500,
        response: "Accepted",
        tone: "success",
        note: "26 Sep 18:21 in the resident app",
      },
    ],
    summary: [
      { label: "Caution held", value: "RWF 1,400,000", foot: "Liability since 25 Sep 2025" },
      { label: "Proposed deductions", value: "RWF 173,500", foot: "RWF 120,000 disputed" },
      { label: "Refund to resident", value: "RWF 1,226,500", foot: "Via Payments after approval" },
      { label: "Remaining liability", value: "RWF 1,400,000", foot: "Until the refund is verified" },
    ],
    dispute: {
      deduction: "repaint",
      title: "Gilbert disputes the repaint: “The marks were there when I moved in.”",
      text: "The move-in report of 25 Sep 2025 shows light marks but no holes. Decide how to treat this item before approval.",
      reduceTo: 60000,
      options: {
        keep: "Keep RWF 120,000 with my reasons",
        reduce: "Reduce to RWF 60,000 (holes only)",
        drop: "Withdraw this deduction",
      },
      resolutions: {
        keep: "Repaint kept at RWF 120,000; your reasons are shared with Gilbert.",
        reduce: "Repaint reduced to RWF 60,000 for the holes only; marks treated as fair wear.",
        drop: "Repaint deduction withdrawn.",
      },
      notes: { keep: "Kept, with reasons", reduce: "Reduced to holes only", drop: "Removed from settlement" },
    },
    approver: { name: "Didier Mugenzi", role: "Owner" },
  },
  {
    id: "A-02",
    name: "Esperance Mukamurenzi",
    lease: "L-KC-003",
    when: "Moves out 31 Oct",
    status: "Inspection booked",
    statusTone: "info",
    sub: "Notice received 1 Oct by letter and in the resident app · 30-day notice met · deposit RWF 1,300,000 held",
    step: 1,
    deposit: 1300000,
    inspection: {
      done: false,
      booked: true,
      title: "Inspection booked for Saturday 31 Oct, 10:00",
      text: "The checklist is prepared from the move-in report of 1 Nov 2025. Esperance is invited to attend and sign it on the day.",
      hint: "Start becomes available on the move-out day.",
    },
    deductions: [],
    summary: [
      { label: "Caution held", value: "RWF 1,300,000", foot: "Liability since 1 Nov 2025" },
      { label: "Proposed deductions", value: "None yet", foot: "After inspection" },
      { label: "Final rent", value: "Paid · verified", foot: "October rent, 1 Oct" },
      { label: "Remaining liability", value: "RWF 1,300,000", foot: "Held in full" },
    ],
    heldNote:
      "Deductions can be proposed only after the inspection report is signed. The full RWF 1,300,000 stays held until then.",
  },
  {
    id: "C-03",
    name: "Aimable Karangwa",
    lease: "L-KC-006",
    when: "Moved out 1 Sep",
    status: "Refund verified",
    statusTone: "success",
    sub: "Notice 31 Jul · inspection 1 Sep · settlement closed 18 Sep",
    step: 6,
    deposit: 2100000,
    inspection: {
      done: true,
      meta: "Inspected 1 Sep 09:30 · signed by both · no damage beyond fair wear",
      checklist: [
        {
          area: "All rooms",
          before: "Good",
          after: "Good, needs deep clean",
          photos: 2,
          photoKeys: ["livingRoomFloor", "kitchenAppliances"],
          finding: "Cleaning",
          tone: "default",
        },
        {
          area: "Keys and access cards",
          before: "3 keys, 3 cards",
          after: "All returned",
          photos: 0,
          photoKeys: [],
          finding: "Complete",
          tone: "success",
        },
      ],
    },
    deductions: [
      {
        id: "cleaning",
        item: "End-of-tenancy cleaning",
        reason: "Agreed at inspection",
        evidence: "2 photos · cleaner invoice",
        amount: 25000,
        response: "Accepted",
        tone: "success",
        note: "2 Sep",
      },
    ],
    summary: [
      { label: "Caution held", value: "RWF 2,100,000", foot: "Released" },
      { label: "Deductions", value: "RWF 25,000", foot: "Accepted by resident" },
      { label: "Refunded", value: "RWF 2,075,000", foot: "Verified 18 Sep" },
      { label: "Remaining liability", value: "RWF 0", foot: "Closed" },
    ],
    refund: {
      title: "Refund verified · RWF 2,075,000",
      text: "Bank transfer from Amahoro Residences Ltd · reference FT26261X7Q2 · matched to the bank statement 18 Sep 11:03 · approved by Didier Mugenzi 15 Sep. Remaining liability RWF 0.",
    },
  },
];

const tickets: ServiceTicket[] = [
  {
    id: "WO-347",
    unit: "Block B",
    title: "Stairwell light out, 2nd floor",
    who: "Not assigned · from B-03",
    status: "new",
    category: "Electrical · common area",
    resident: "Nadine Kayitesi",
    reported: "Reported by Nadine Kayitesi (B-03) in the resident app · 11 Oct 21:05",
    entry: "Not needed · common area",
    assignee: "Not assigned",
    visit: "Not booked",
    cost: "Landlord",
    photos: [{ key: "darkStairwell", alt: "Dark stairwell landing" }],
    thread: [
      {
        from: "resident",
        text: "The light on the 2nd floor stairs is out. It is very dark at night.",
        meta: "Nadine · 11 Oct 21:05",
      },
    ],
  },
  {
    id: "WO-345",
    unit: "B-07",
    title: "Kitchen sink leaking",
    who: "Kigali Plumbing Co. · Tue 10:00",
    status: "assigned",
    category: "Plumbing",
    resident: "Olivier Habineza",
    reported: "Reported by Olivier Habineza in the resident app · 11 Oct 19:12",
    entry: "Yes, if nobody is home",
    assignee: "Kigali Plumbing Co. · contractor",
    visit: "Tue 13 Oct, 10:00 · access code 7730",
    cost: "Landlord unless misuse is found",
    photos: [
      { key: "kitchenSinkPipes", alt: "Water under the kitchen sink" },
      { key: "kitchenSinkPipes", alt: "Wet cabinet base" },
    ],
    thread: [
      {
        from: "resident",
        text: "Water is leaking under the kitchen sink. I have put a bucket under it for now.",
        meta: "Olivier · 11 Oct 19:12",
      },
      {
        from: "manager",
        text: "Thank you, Olivier. A plumber from Kigali Plumbing Co. will come on Tuesday at 10:00. Is it fine to enter if you are at work?",
        meta: "Solange · 11 Oct 19:40",
      },
      { from: "resident", text: "Yes, that is fine. Ines will be home after 12.", meta: "Olivier · 11 Oct 20:02" },
      {
        from: "note",
        text: "Check whether the cabinet base is water-damaged. Likely a landlord repair, not a resident charge.",
        meta: "Internal note · Solange · 11 Oct 20:05",
      },
    ],
  },
  {
    id: "WO-343",
    unit: "C-01",
    title: "Balcony door lock stiff",
    who: "Fidèle Ntawukuriryayo · Wed",
    status: "assigned",
    category: "Doors and locks",
    resident: "Yvonne Murekatete",
    reported: "Reported by Yvonne Murekatete · 10 Oct 08:30",
    entry: "Only when home",
    assignee: "Fidèle Ntawukuriryayo · caretaker",
    visit: "Wed 14 Oct, after 17:00",
    cost: "Landlord",
    photos: [{ key: "balconyDoorLock", alt: "Balcony door lock" }],
    thread: [
      { from: "resident", text: "The balcony door lock is very hard to turn.", meta: "Yvonne · 10 Oct 08:30" },
      {
        from: "manager",
        text: "Fidèle will come on Wednesday after 17:00 when you are home.",
        meta: "Solange · 10 Oct 09:15",
      },
    ],
  },
  {
    id: "WO-344",
    unit: "A-05",
    title: "Repaint before letting",
    who: "Kigali Paint Works · 14 Oct",
    status: "assigned",
    category: "Decoration · vacant unit",
    resident: "no one (vacant)",
    reported: "Created by Solange Uwimana after the move-out inspection · 25 Sep",
    entry: "Vacant unit · caretaker opens",
    assignee: "Kigali Paint Works · contractor",
    visit: "Wed 14 Oct, 08:00",
    cost: "Landlord · part recovered from caution if approved",
    photos: [{ key: "wallNailHoles", alt: "Living-room wall holes" }],
    thread: [],
  },
  {
    id: "WO-341",
    unit: "A-06",
    title: "Water heater not heating",
    who: "Fidèle · part ordered",
    status: "progress",
    category: "Plumbing · hot water",
    resident: "Samuel Ndayisaba",
    reported: "Reported by Samuel Ndayisaba · 9 Oct 07:10",
    entry: "Yes, if nobody is home",
    assignee: "Fidèle Ntawukuriryayo · caretaker",
    visit: "Heating element arrives 13 Oct",
    cost: "Landlord",
    photos: [{ key: "waterHeater", alt: "Water heater panel" }],
    thread: [
      { from: "resident", text: "No hot water since this morning.", meta: "Samuel · 9 Oct 07:10" },
      {
        from: "manager",
        text: "The heating element has failed. A new one arrives Tuesday; Fidèle will fit it the same day.",
        meta: "Solange · 10 Oct 16:00",
      },
    ],
  },
  {
    id: "WO-338",
    unit: "B-02",
    title: "Bathroom extractor fan",
    who: "Resident confirmed fixed",
    status: "done",
    category: "Electrical",
    resident: "David Mwiseneza",
    reported: "Reported by David Mwiseneza · 6 Oct",
    entry: "Yes",
    assignee: "Fidèle Ntawukuriryayo · caretaker",
    visit: "Done 9 Oct",
    cost: "Landlord · RWF 28,000 part",
    photos: [{ key: "extractorFan", alt: "New extractor fan" }],
    thread: [
      {
        from: "manager",
        text: "The fan has been replaced. Please confirm it works.",
        meta: "Solange · 9 Oct 15:20",
      },
      { from: "resident", text: "Working well, thank you.", meta: "David · 9 Oct 18:02" },
    ],
  },
];

const accessRequests: AccessRequest[] = [
  {
    id: "amina",
    icon: "Moon",
    title: "C-04 · Hassan Abdallah asks for an overnight visitor",
    desc: "Amina Abdallah (sister) · 14 nights, 15–29 Oct · ID to be shown at the gate on arrival",
    approveLabel: "Approve overnight visit",
    status: "open",
  },
  {
    id: "dhl",
    icon: "Box",
    title: "Gate · courier for C-02 without a code",
    desc: "DHL courier at 10:22 · Jean-Claude Habiyaremye not answering · guard Fidèle asks what to do",
    approveLabel: "Leave parcel at the gate office",
    status: "open",
  },
];

const visitors: PreregisteredVisitor[] = [
  {
    id: "4821",
    initials: "JU",
    name: "Jean Uwizeye",
    unit: "B-07",
    window: "Today 14:00–20:00",
    by: "Olivier Habineza",
    code: "4821",
    state: "Expected",
    tone: "info",
  },
  {
    id: "7730",
    initials: "KP",
    name: "Kigali Plumbing Co.",
    unit: "B-07",
    window: "Tue 13 Oct 09:30–12:30 · contractor",
    by: "Solange Uwimana",
    code: "7730",
    state: "Approved",
    tone: "success",
  },
  {
    id: "5114",
    initials: "KW",
    name: "Kigali Paint Works, 2 people",
    unit: "A-05",
    window: "Wed 14 Oct 07:30–17:00 · contractor",
    by: "Solange Uwimana",
    code: "5114",
    state: "Approved",
    tone: "success",
  },
  {
    id: "1956",
    initials: "CU",
    name: "Claudette Umuhoza",
    unit: "A-01",
    window: "Sat 10 Oct 12:00–18:00",
    by: "Claude Nsengimana",
    code: "1956",
    state: "Expired",
    tone: "default",
  },
];

const visitorLog: VisitorLogEntry[] = [
  {
    id: "log-1",
    name: "Delphine Mukeshimana",
    phone: "+250 78• ••• 207",
    unit: "B-05 · Alain Mutabazi",
    how: "Code 3302 · pre-registered",
    arrived: "Today 09:12",
    left: "10:40",
    by: "Fidèle · gate tablet",
  },
  {
    id: "log-2",
    name: "Kigali Paint Works surveyor",
    phone: "+250 73• ••• 918",
    unit: "A-05 · vacant unit",
    how: "Approved by Solange",
    arrived: "Today 08:30",
    left: "09:05",
    by: "Fidèle · gate tablet",
  },
  {
    id: "log-3",
    name: "Ivan Nkusi",
    phone: "+250 72• ••• 554",
    unit: "C-06 · Liliane Gasana",
    how: "Resident came to the gate",
    arrived: "11 Oct 18:05",
    left: "22:30",
    by: "Night guard · gate tablet",
  },
  {
    id: "log-4",
    name: "Claudette Umuhoza",
    phone: "+250 78• ••• 661",
    unit: "A-01 · Claude Nsengimana",
    how: "Code 1956 · pre-registered",
    arrived: "10 Oct 12:20",
    left: "17:45",
    by: "Fidèle · gate tablet",
  },
  {
    id: "log-5",
    name: "MTN technician",
    phone: "+250 78• ••• 100",
    unit: "Block C · roof",
    how: "Approved by Solange",
    arrived: "9 Oct 10:00",
    left: "11:30",
    by: "Fidèle · gate tablet",
  },
];

export const fixtures = {
  "residence.blocks": blocks,
  "residence.units": units,
  "residence.homeKpis": homeKpis,
  "residence.rentBuckets": rentBuckets,
  "residence.arrearsAging": arrearsAging,
  "residence.vacancies": vacancies,
  "residence.renewals": renewals,
  "residence.homeTickets": homeTickets,
  "residence.filings": filings,
  "residence.applicants": applicants,
  "residence.screeningChecks": screeningChecks,
  "residence.invitations": invitations,
  "residence.leases": leases,
  "residence.leaseClauses": leaseClauses,
  "residence.acceptedRenewals": acceptedRenewals,
  "residence.rentKpis": rentKpis,
  "residence.rentRoll": rentRoll,
  "residence.rentLedgers": rentLedgers,
  "residence.payouts": payouts,
  "residence.depositKpis": depositKpis,
  "residence.moveOuts": moveOuts,
  "residence.tickets": tickets,
  "residence.accessRequests": accessRequests,
  "residence.visitors": visitors,
  "residence.visitorLog": visitorLog,
} satisfies FixtureSet;
