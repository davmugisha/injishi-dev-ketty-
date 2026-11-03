// View models the manager app reads (prototype `e-mgrdesk.mjs`, MANAGER): the day at a glance, the
// approvals waiting on Aline and their evidence, the inbox and alerts, yesterday's flash report, and
// her settings.

import type { IconName, Tone } from "@/components/ui";

export type ApprovalGroup = "rooms" | "money" | "people";
export type ApprovalState = "waiting" | "approved" | "declined" | "owner";

/** One request in the approvals list. */
export interface Approval {
  id: string;
  group: ApprovalGroup;
  state: ApprovalState;
  icon: IconName;
  tone: Tone;
  title: string;
  /** "BK-20417 · cancelled 3 days out · 1 h". */
  detail: string;
  /** A word at the end ("Sellable", "Owner"). */
  tag?: { label: string; tone: Tone };
  /** When it was decided, "11:24", once it is. */
  decidedAt?: string;
  /** Why it was declined. */
  reason?: string;
}

export interface EvidenceRow {
  label: string;
  value: string;
}

export interface AfterStep {
  title: string;
  detail: string;
  icon: IconName;
}

/** Everything the decision screen shows about one request, evidence before the button. */
export interface ApprovalDetail extends Approval {
  /** The nav bar: "Refund request" and "Asked by Eric · 09:50". */
  heading: string;
  askedBy: string;
  /** The figure card: "Refund to guest", "RWF 60,000", "Back to MTN MoMo +250 78• ••• 214". */
  kicker: string;
  figure: string;
  figureNote: string;
  checks: { label: string; icon?: IconName }[];
  evidence: EvidenceRow[];
  after: AfterStep[];
  /** What approving is called on the button and in the confirmation ("Approve", "Release"). */
  approveLabel: string;
  declineLabel: string;
  /** How it reads once approved ("Approved", "Released"). */
  approvedWord: string;
}

export interface ApprovalsView {
  place: string;
  limit: string;
  waiting: Approval[];
  owner: Approval[];
  done: Approval[];
}

export interface TodayView {
  date: string;
  place: string;
  occupancy: { value: string; caption: string; trend: number[] };
  revenue: { value: string; unit: string; caption: string; trend: number[] };
  arrivals: { value: string; unit: string; caption: string };
  ready: { value: string; unit: string; caption: string };
  /** The decision drawn as a card with its evidence trail (room 305), while it waits. */
  feature: {
    id: string;
    kicker: string;
    title: string;
    trail: { label: string; at: string }[];
    approveLabel: string;
    declineLabel: string;
    /** What the toast says once it is decided here. */
    approvedNote: string;
    declinedNote: string;
  } | null;
  /** The next waiting requests, under the card. */
  next: Approval[];
  waitingCount: number;
  housekeeping: { done: number; total: number };
  workOrders: number;
  guestMessages: number;
  /** Unread alerts: the bell's dot. */
  unreadAlerts: number;
}

export type InboxTag = "alerts" | "guests" | "team";

export interface InboxItem {
  id: string;
  section: "action" | "earlier";
  tags: InboxTag[];
  icon: IconName;
  tone: Tone;
  title: string;
  detail: string;
  /** The whole message, when opened. */
  body: string;
  unread: boolean;
  live?: "danger" | "warning";
  /** The one thing to do about it, from the inbox. */
  action?: { label: string; doneTitle: string; doneDetail: string };
}

export interface InboxView {
  items: InboxItem[];
}

export interface FlashView {
  day: string;
  revenue: string;
  sold: string;
  week: { day: string; value: number }[];
  properties: { name: string; value: string; caption: string }[];
  revpar: { value: string; unit: string; caption: string };
  fnb: { value: string; unit: string; caption: string };
  methods: { name: string; share: number }[];
  /** A property whose audit is still open, said plainly. */
  openAudit: { title: string; body: string } | null;
}

export type ConfirmWith = "fingerprint" | "pin";

export interface ManagerMe {
  name: string;
  initials: string;
  role: string;
  places: string;
  limits: EvidenceRow[];
  limitsSummary: string;
  confirmWith: ConfirmWith;
  alerts: { urgent: boolean; flash: boolean };
}
