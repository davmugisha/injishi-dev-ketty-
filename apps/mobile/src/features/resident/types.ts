// The view models the resident screens read (prototype `d-resident.mjs`). Screens get them only through
// `data.ts`; the sample values live in `mock-data.ts`. Pictures are image sources, so an api read can
// hand a URI where the mock hands a bundled photo.

import type { ImageProps } from "expo-image";
import type { IconName, TimelineStep, Tone } from "@/components/ui";

/** A photo: a bundled sample in mock mode, a URI from the API later. */
export type Picture = ImageProps["source"];

/** A short status word on a chip; the word carries the state, the tone only repeats it. */
export type StatusChip = { label: string; tone: Tone; icon?: IconName };

/** One label and value line (`.kv`). */
export type Fact = { label: string; value: string };

// ── Rent and payments ───────────────────────────────────────────────────────

export type RentState = "due" | "part" | "paid";

/** Home's rent card (`.rx-rent`). */
export type RentCard = {
  state: RentState;
  /** "November rent". */
  eyebrow: string;
  chip: StatusChip;
  /** The figure in the card: what is still due, or what was paid. */
  amount: number;
  /** "Due Sun 1 Nov" / "Paid Mon 26 Oct". */
  left: string;
  /** "Nothing paid yet" / "RWF 400,000 paid". */
  right: string;
  /** How far the month has run toward the due date (or 100 once paid), and its tone. */
  meter: { value: number; tone: "warning" | "success"; label: string };
  /** The receipt of the payment that cleared it, once paid. */
  receiptId: string | null;
  /** "October paid 30 Sep · MTN MoMo", with that receipt. */
  last: { line: string; receiptId: string } | null;
};

export type PayMethodId = "mtn" | "airtel";

export type PayMethod = {
  id: PayMethodId;
  name: string;
  /** "0788 ••• 412", or null when no number is saved for it yet. */
  number: string | null;
};

/** What the resident chose on Pay rent, kept until the payment is sent. */
export type PayDraft = {
  kind: "full" | "part";
  /** The amount to send, in francs. */
  amount: number;
  method: PayMethodId;
  /** A number typed for a network with none saved. */
  newNumber: string | null;
};

export type PayView = {
  state: RentState;
  /** The calendar block: "Nov" over "1". */
  month: string;
  day: string;
  /** "November rent · B-07". */
  title: string;
  /** "To Amahoro Residences". */
  payee: string;
  /** Still due this month. */
  balance: number;
  /** "Clears November". */
  clears: string;
  /** "Sun 1 Nov": when what is left stays due. */
  due: string;
  methods: PayMethod[];
  draft: PayDraft;
  /** Once the month is paid: what the Pay tab says instead of the form. */
  paid: { title: string; body: string; receiptId: string } | null;
};

/** Confirm payment: everything about the money before it is asked for. */
export type ConfirmView = {
  amount: number;
  /** "November rent · unit B-07". */
  forLabel: string;
  rows: Fact[];
  /** "MTN": who sends the prompt. */
  provider: string;
};

/** The request waiting for the resident's approval on the phone. */
export type PendingView = {
  id: string;
  amount: number;
  provider: string;
  number: string;
  sentAt: string;
  expiresAt: string;
};

export type Receipt = {
  id: string;
  amount: number;
  /** "November rent · B-07". */
  forLabel: string;
  payee: string;
  providerRef: string;
  /** "MTN confirmed your payment at 09:43". */
  confirmed: string;
};

export type HistoryRow = {
  id: string;
  /** When it was paid: "Sep" over "30". */
  month: string;
  day: string;
  title: string;
  subtitle: string;
  amount: number;
};

export type PaymentsView = {
  leaseId: string;
  paidThisYear: { value: string; caption: string };
  deposit: { value: string; caption: string };
  statement: { title: string; detail: string };
  stampRequested: boolean;
  history: HistoryRow[];
};

// ── Repairs ─────────────────────────────────────────────────────────────────

export type RepairCategoryId = "plumbing" | "electrical" | "doors" | "appliances" | "other";

export type RepairCategory = { value: RepairCategoryId; label: string; icon?: IconName };

/** A photo attached to a repair request. */
export type RepairPhoto = { id: string; source: Picture };

export type RepairSummary = {
  id: string;
  title: string;
  subtitle: string;
  photo: Picture | null;
  status: StatusChip;
  unread: number;
};

export type RequestsView = { open: RepairSummary[]; done: RepairSummary[] };

export type RepairForm = {
  categories: RepairCategory[];
  category: RepairCategoryId;
  description: string;
  photos: RepairPhoto[];
  staffMayEnter: boolean;
};

export type RepairInput = {
  category: RepairCategoryId;
  description: string;
  photoIds: string[];
  staffMayEnter: boolean;
  urgent: boolean;
};

export type Message = {
  id: string;
  from: "me" | "them";
  text: string | null;
  photo: Picture | null;
  /** "You · Thu 19:12", "Solange Uwimana · Thu 19:40". */
  time: string;
};

export type RepairThread = {
  id: string;
  title: string;
  /** "WO-345 · with Kacyiru Court". */
  subtitle: string;
  steps: TimelineStep[];
  messages: Message[];
  /** "Solange": who answers. */
  contact: string;
  unread: number;
};

export type EmergencyKind = { value: string; label: string; icon: IconName; category: RepairCategoryId };

export type EmergencyView = {
  caretaker: { name: string; note: string; phone: string };
  management: { name: string; hours: string; phone: string };
  kinds: EmergencyKind[];
  /** "Called Célestin at 18:21 · logged", once a call was made from here. */
  lastCall: string | null;
};

// ── Building, visitors, household ───────────────────────────────────────────

export type Notice = {
  id: string;
  icon: IconName;
  tone: Tone;
  title: string;
  subtitle: string;
  body: string;
  /** "Solange Uwimana · Mon 26 Oct". */
  postedBy: string;
  isNew: boolean;
};

export type VisitorRow = {
  id: string;
  icon: IconName;
  tone: Tone;
  name: string;
  subtitle: string;
  status: StatusChip;
  /** A trade's pass, made for a repair: opens that repair. */
  repairId: string | null;
};

export type BuildingView = {
  name: string;
  photo: Picture;
  /** "24 homes · Block A and B". */
  homes: string;
  notices: Notice[];
  visitors: VisitorRow[];
  household: { people: { initials: string; tone: Tone; name: string }[]; summary: string };
};

export type VisitWindow = { value: string; label: string; detail: string };

export type VisitorCode = {
  id: string;
  /** The four digits for the guard. */
  code: string;
  seed: string;
  name: string;
  firstName: string;
  /** "her", "his": for "The guard checks her name too". */
  possessive: string;
  /** "Sat 31 Oct · 10:00–16:00 · B-07". */
  when: string;
  /** "Works once · expires at 16:00". */
  rule: string;
  status: "active" | "cancelled";
  /** "Sent by WhatsApp at 09:12", once shared. */
  sent: string | null;
  windows: VisitWindow[];
  window: string;
};

export type HouseholdMember = {
  id: string;
  name: string;
  initials: string;
  tone: Tone;
  subtitle: string;
  role: StatusChip;
};

export type StandingPass = { name: string; on: boolean; rows: Fact[]; note: string };

export type HouseholdView = { unit: string; members: HouseholdMember[]; pass: StandingPass | null };

export type NewMember = { name: string; kind: "lease" | "help" };

// ── Me, lease, renewal, moving ──────────────────────────────────────────────

export type MeView = {
  name: string;
  line: string;
  lease: { subtitle: string; chip: StatusChip | null };
  household: string;
  moveIn: string;
  reminders: string;
};

export type LeaseDocument = {
  id: string;
  icon: IconName;
  tone: Tone;
  title: string;
  subtitle: string;
  /** What opening it shows: the move-in record, or the document itself. */
  opens: "movein" | "file";
};

export type LeaseView = {
  id: string;
  unitLine: string;
  status: StatusChip;
  term: string;
  progress: number;
  day: string;
  left: string;
  renewal: { state: "offered" | "signed"; title: string; detail: string } | null;
  terms: Fact[];
  documents: LeaseDocument[];
};

export type RenewalView = {
  deadline: string;
  title: string;
  intro: string;
  now: number;
  next: number;
  from: string;
  change: string;
  rows: Fact[];
  amendment: { title: string; body: string };
  phone: string;
  manager: string;
  state: "offered" | "signed";
  signedLine: string | null;
};

export type MoveInRoom = {
  id: string;
  name: string;
  photo: Picture | null;
  photos: number;
  state: "done" | "now" | "todo";
};

export type MoveInView = {
  unit: string;
  step: number;
  total: number;
  steps: TimelineStep[];
  rooms: MoveInRoom[];
  done: number;
  next: MoveInRoom | null;
};

export type DeductionStatus = "pending" | "accepted" | "disputed";

export type Deduction = {
  id: string;
  title: string;
  amount: number;
  evidence: { kind: "photos"; before: Picture; after: Picture } | { kind: "meter"; photo: Picture; reading: string };
  status: DeductionStatus;
};

export type MoveOutStage = { label: string; state: "done" | "now" | "todo" };

export type MoveOutView = {
  stages: MoveOutStage[];
  step: number;
  held: number;
  deductions: Deduction[];
  deducted: number;
  refund: number;
  refundTo: string;
  submitted: boolean;
};

/** Home: rent first, then the renewal, the four quick actions and what management says. */
export type HomeView = {
  place: { name: string; unit: string; photo: Picture };
  greeting: string;
  firstName: string;
  rent: RentCard;
  renewal: { title: string; detail: string } | null;
  /** The newest notice from management, as a banner. */
  notice: { icon: IconName; title: string; body: string } | null;
  /** The newest open repair, with when someone comes. */
  openRepair: { id: string; title: string; subtitle: string; status: StatusChip } | null;
  unread: number;
  hasNews: boolean;
};

/** The tab bar's counts: unread repair messages, and a dot for a new notice. */
export type TabCounts = { requests: number; building: boolean };
