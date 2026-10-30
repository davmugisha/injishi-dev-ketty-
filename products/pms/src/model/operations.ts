/**
 * What the operations screens draw: housekeeping, maintenance, lost and found and loyalty.
 *
 * Declared here since ADR-074 stage 4: the product owns the shapes its views draw, copied verbatim from
 * `@injishi/data/fixtures/operations.ts` with every type they reference. The demo fixtures keep matching
 * declarations for their rows until stage 9, and every page that passes those rows into a view is where the
 * compiler checks the two still agree.
 */
import type { IconName, StockKey, Tone } from "./shared.ts";

/** One dated line of a history (timeline marker tone + what happened + who/when). */
export interface HistoryEvent {
  what: string;
  who: string;
  tone: Tone | "current";
}

/** Programme-level figures (one document). `pointValue` is null until Finance sets one. */
export interface LoyaltyProgramme {
  id: string;
  name: string;
  operator: string;
  earnsAt: string;
  members: number;
  consented: number;
  activeTwelveMonths: number;
  pointsOutstanding: number;
  month: string;
  earnedThisMonth: number;
  redeemedThisMonth: number;
  redemptionsThisMonth: number;
  approvedAboveLimit: number;
  pointValue: number | null;
  transactionsToday: number;
}

export interface LoyaltyTier {
  id: string;
  name: string;
  /** Chart colour index (1–5) of the tier medal. */
  chart: number;
  multiplier: number;
  members: number;
  qualify: string;
  benefits: string;
}

export type LoyaltyTierName = "Gold" | "Silver" | "Circle" | "Pending";

export interface LoyaltyMember {
  id: string;
  name: string;
  initials: string;
  /** Account number, or "Not enrolled". */
  account: string;
  tier: LoyaltyTierName;
  points: number;
  lastActivity: string;
  programmeConsent: boolean;
  marketing: boolean;
  consent: string;
  marketingDetail: string;
  stay: string;
  /** Already booked in the top room category (no upgrade possible). */
  topCategory?: boolean;
}

/** A guest the desk can enrol now (shown in the enrol dialog). */
export interface LoyaltyCandidate {
  id: string;
  name: string;
  initials: string;
  booking: string;
  arrival: string;
  phone: string;
  newAccount: string;
  stay: string;
}

export type LoyaltyTxType = "Earn" | "Redeem" | "Reverse" | "Adjust";

export interface LoyaltyTransaction {
  id: string;
  when: string;
  member: string;
  type: LoyaltyTxType;
  source: string;
  /** Signed points (negative for redemptions and reversals). */
  points: number;
  by: string;
  note: string;
}

export interface LoyaltyLiability {
  id: string;
  title: string;
  description: string;
  rows: { label: string; points: number }[];
  footLabel: string;
  /** null → "Not configured". */
  footPoints: number | null;
}

export type RoomStatus = "inspected" | "clean" | "dirty" | "occupied" | "ooo";

export interface HousekeepingRoom {
  id: string;
  floor: number;
  type: "Standard Queen" | "Twin" | "Deluxe Lake View" | "Family Suite";
  status: RoomStatus;
  note: string;
  /** Front-desk hold shown with the room context. */
  hold?: string;
}

/** Recorded status history of one room (id = room number). */
export interface RoomHistory {
  id: string;
  events: HistoryEvent[];
}

export type TaskColumn = "todo" | "doing" | "clean" | "insp";

export interface CleaningTask {
  id: string;
  room: string;
  kind: "Checkout" | "Stayover" | "Deep clean" | "Turndown" | "Re-clean";
  column: TaskColumn;
  assignee: string | null;
  due: string;
  minutes?: number;
  priority?: string;
  priorityTone?: Tone;
  /** Created by a rule (not by hand). */
  auto: boolean;
}

export interface HousekeepingStaff {
  id: string;
  /** Housekeepers take cleaning tasks; the supervisor runs inspections. */
  role: "housekeeper" | "supervisor";
  name: string;
  initials: string;
  area: string;
  shiftEnd: string;
  minutesLeft: number;
  tone: Tone;
}

export interface HousekeepingEscalation {
  id: string;
  task: string;
  action: "reassign" | "remind";
  text: string;
  cta: string;
  doneCta?: string;
}

export interface HousekeepingRule {
  id: string;
  icon: IconName;
  kind: string;
  when: string;
}

export type Severity = "Critical" | "High" | "Normal" | "Low";

export type BlockState = "active" | "requested" | "declined" | "na" | "none";

export interface WorkOrderPart {
  name: string;
  qty: string;
  source: string;
  state: string;
  tone: Tone;
}

export interface WorkOrderPhoto {
  caption: string;
  image: StockKey;
}

export interface BlockOutcome {
  blockText: string;
  blockEffect: string;
  event: HistoryEvent;
}

export interface WorkOrder {
  id: string;
  asset: string;
  area: string;
  title: string;
  issue: string;
  severity: Severity;
  owner: string | null;
  /** Who "Assign to …" proposes when nobody owns it yet. */
  suggestedOwner?: string;
  status: string;
  block: BlockState;
  blockText: string;
  blockEffect: string;
  reported: string;
  photos: WorkOrderPhoto[];
  parts: WorkOrderPart[];
  timeline: HistoryEvent[];
  /** Last timeline line while a decision or assignment is pending. */
  pending?: HistoryEvent;
  /** Outcomes of the manager's decision on a requested block. */
  decision?: { approved: BlockOutcome; declined: BlockOutcome };
  releaseNote: string;
}

export interface ConditionSignal {
  id: string;
  rule: string;
  asset: string;
  headline: string;
  confidence: "High" | "Medium" | "Low";
  tone: Tone;
  evidence: string[];
  dataQuality: string;
  recommendation: string;
  ruleText: string;
  /** Work order drafted when the manager acts on the signal. */
  draft?: WorkOrder;
}

export interface SignalReview {
  id: string;
  outcome: string;
  tone: Tone;
  what: string;
  note: string;
}

export type FoundItemStatus = "claim" | "stored" | "returned" | "disposal" | "disposed";

export interface FoundItem {
  id: string;
  item: string;
  category: string;
  valuable: boolean;
  where: string;
  when: string;
  foundBy: string;
  custodian: string;
  storage: string;
  status: FoundItemStatus;
  custody: HistoryEvent[];
  retention?: string;
  closedNote?: string;
  claim?: {
    claimant: string;
    booking: string;
    /** The claimant's booking matches the room and dates where the item was found. */
    matched: boolean;
    match: string;
    statement: string;
  };
  disposal?: { note: string; rule: string };
}

export interface RegisterAccess {
  id: string;
  name: string;
  role: string;
}
