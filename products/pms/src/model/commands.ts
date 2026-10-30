/**
 * The commands PMS's views send, and the shapes they send and get back. The app supplies every one of them
 * as a server action and hands them in through `PmsProvider` (`./web`); a view never knows how a command
 * reaches the API. The shapes are copied from the app's server writes (`server/mutations/*`) and actions,
 * which re-export them from here for their other callers.
 */
import type {
  ReservationChangeAsk,
  ReservationChangeForm,
  ReservationChangeQuote,
  ReservationChangeRequest,
  ReservationChangeResult,
} from "@injishi/contracts";
import type { CleaningTask, Severity } from "./operations.ts";

/** A command that hands back a value once it is done, or the API's refusal in words the screen can show. */
export type DoneWith<T> = { ok: true; value: T } | { ok: false; error: string };

/** What a command answers when it hands back nothing: done, or the API's refusal. */
export type Done = { ok: true } | { ok: false; error: string };

// ── Front desk ───────────────────────────────────────────────────────────────

/** The name, nationality and document, as the desk read them from the guest's ID (0115, the guest register). */
export interface GuestCard {
  /** Only for a booking that names nobody; the API's limit is 200 characters. */
  fullName?: string;
  nationality?: string;
  documentType?: "national_id" | "passport" | "other";
  idNumber?: string;
}

export interface WalkInInput {
  /** The room type's id, as the walk-in screen lists it (frontdesk.roomTypes). */
  roomTypeId: string;
  nights: number;
  guestName: string;
  phone?: string;
  /** Where the claim code goes, so the guest can carry on in the app. */
  email?: string;
  /** What the desk read from the guest's ID, for the guest register (0115). */
  guest?: GuestCard;
}

export interface WalkedIn {
  stayId: string;
  stayReference: string | null;
  room: string;
  folioNumber: string | null;
  /** True when the claim code was mailed to the address given. */
  invited: boolean;
}

export interface CheckedIn {
  stayId: string;
  stayReference: string | null;
  folioNumber: string | null;
}

export interface RefundOutcome {
  refundRwf: number;
  keptRwf: number;
  rule: string;
}

export interface ClaimInvite {
  claimCode: string | null;
  email: string | null;
  invitationSent: boolean;
}

// ── A stay ───────────────────────────────────────────────────────────────────

export interface PostChargeInput {
  stayRef: string;
  /** The revenue department, by name, as the charge drawer lists it (stays.chargeDepartments). */
  department: string;
  /** Whole francs BEFORE tax: the API posts the VAT as its own line at the rate in force. */
  amountRwf: number;
  /** What the guest reads on the bill. */
  description: string;
  /** Why the desk posted it (the drawer's reason code); kept on the line beside the description. */
  reason: string;
  idempotencyKey: string;
}

export interface Posted {
  chargeId: string | null;
  /** Set when the stay's bill was already signed and the charge went to its next bill. */
  movedToFolio: string | null;
  balanceRwf: number;
}

export interface CheckedOut {
  guest: string;
  room: string;
  /** The bill as it stands after check out: closed (and signed) when it was settled to zero. */
  folioNumber: string | null;
  folioStatus: string | null;
  balanceRwf: number;
}

// ── Housekeeping, maintenance, lost and found ────────────────────────────────

export interface NewFoundItem {
  description: string;
  /** "Electronics", as the form lists it. */
  category: string;
  valuable: boolean;
  /** "Room 309", "Lobby". */
  area: string;
  spot?: string;
  /** "15 Oct 2026, 12:20". */
  foundAt: string;
  /** The finder's name, as the person picked or typed it. */
  foundBy: string;
  /**
   * The custodian the person picked on the form: themselves, or someone already holding items on the register.
   * Never taken from sample data; a name that is not the signed-in person or on the register is refused.
   */
  custodian?: string | null;
  storage?: string;
}

// ── The staff phone ──────────────────────────────────────────────────────────

export interface LoggedFoundItem {
  reference: string;
  /** Today's supervisor when the API named one (the item is handed to them); null when nobody is named. */
  custodianName: string | null;
}

export interface NewProblemReport {
  /** The place as the phone lists it: a room label ("204") or a space ("Corridor F2"). */
  place: string;
  isRoom: boolean;
  category: string;
  urgency: string;
  description: string;
  /** Ask a manager to take the room off sale while it is fixed (a room only). */
  askBlock: boolean;
}

export interface InspectionVerdict {
  itemId: string;
  result: "pass" | "fail";
  /** The uploaded photo of a failed check (`uploadPhoto`), when one was taken. */
  photoObjectKey?: string;
}

// ── Commercial (packages and revenue) ────────────────────────────────────────

export interface PackagesDraftInput {
  name: string;
  summary: string;
  price: number;
  per: string;
}

export type PackagesDraftResult = { ok: true; id: string } | { ok: false; error: string };

export interface RevenueSendItem {
  id: string;
  /** Present when the manager overrode the recommended rate. */
  override?: { rate: number; reason: string; note: string };
}

/** Every command a PMS view may send, by the name of the server action the app supplies for it. */
export interface PmsActions {
  // Front desk
  checkInWalkIn(input: WalkInInput): Promise<DoneWith<WalkedIn>>;
  assignArrivalRoom(bookingRef: string, roomLabel: string): Promise<DoneWith<null>>;
  checkInGuest(input: {
    bookingRef: string;
    roomLabel: string;
    cash: { amountRwf: number; idempotencyKey: string } | null;
    guest?: GuestCard;
  }): Promise<DoneWith<CheckedIn>>;
  approveBookingRequest(bookingRef: string): Promise<DoneWith<null>>;
  declineBookingRequest(bookingRef: string): Promise<DoneWith<null>>;
  cancelBooking(bookingRef: string, reason: string): Promise<DoneWith<RefundOutcome>>;
  recordNoShow(bookingRef: string, reason: string): Promise<DoneWith<null>>;
  // Changing a reservation's dates, room type or guests (0121)
  loadReservationChange(bookingRef: string): Promise<DoneWith<ReservationChangeForm>>;
  previewReservationChange(bookingRef: string, ask: ReservationChangeAsk): Promise<DoneWith<ReservationChangeQuote>>;
  saveReservationChange(bookingRef: string, body: ReservationChangeRequest): Promise<DoneWith<ReservationChangeResult>>;
  checkReservationChange(bookingRef: string, attemptToken: string): Promise<DoneWith<ReservationChangeResult>>;
  // A stay
  replyToGuest(threadId: string, body: string): Promise<DoneWith<null>>;
  postCharge(input: PostChargeInput): Promise<DoneWith<Posted>>;
  voidCharge(input: {
    stayRef: string;
    chargeId: string;
    reason: string;
    idempotencyKey: string;
  }): Promise<DoneWith<{ balanceRwf: number }>>;
  recordCash(input: {
    stayRef: string;
    amountRwf: number;
    idempotencyKey: string;
  }): Promise<DoneWith<{ balanceRwf: number }>>;
  resendClaimCode(stayRef: string): Promise<DoneWith<ClaimInvite>>;
  checkOutGuest(stayRef: string, screen: "Checkout" | "StayFolio", note?: string): Promise<DoneWith<CheckedOut>>;
  // Housekeeping, maintenance, lost and found
  addCleaningTaskAction(
    input: {
      room: string;
      kind: Exclude<CleaningTask["kind"], "Re-clean">;
      assignee: string | null;
      due: string;
      minutes?: number;
    },
    idempotencyKey: string,
  ): Promise<DoneWith<string>>;
  assignCleaningTaskAction(taskId: string, assignee: string | null): Promise<DoneWith<undefined>>;
  inspectCleaningTaskAction(taskId: string, result: "pass" | "fail", reason?: string): Promise<DoneWith<undefined>>;
  remindEscalationAction(escalationId: string): Promise<DoneWith<undefined>>;
  createWorkOrderAction(input: {
    asset: string;
    title: string;
    details?: string;
    severity: Severity;
    owner: string | null;
    requestBlock: boolean;
  }): Promise<DoneWith<string>>;
  assignWorkOrderAction(reference: string, owner: string): Promise<DoneWith<undefined>>;
  addWorkOrderNoteAction(reference: string, note: string): Promise<DoneWith<undefined>>;
  decideRoomBlockAction(reference: string, decision: "approve" | "decline"): Promise<DoneWith<undefined>>;
  releaseRoomAction(reference: string): Promise<DoneWith<undefined>>;
  actOnSignalAction(signalId: string): Promise<DoneWith<string | null>>;
  dismissSignalAction(signalId: string, reason: string): Promise<DoneWith<undefined>>;
  logFoundItemAction(input: NewFoundItem): Promise<DoneWith<string>>;
  openFoundItemClaimAction(
    reference: string,
    claim: { claimant: string; booking?: string; statement: string },
  ): Promise<DoneWith<undefined>>;
  releaseFoundItemAction(reference: string, method: "person" | "agent" | "courier"): Promise<DoneWith<undefined>>;
  approveFoundItemDisposalAction(reference: string): Promise<DoneWith<undefined>>;
  keepFoundItemAction(reference: string, days: number, reason: string): Promise<DoneWith<undefined>>;
  // The staff phone
  moveRoomTaskAction(taskId: string, to: "in_progress" | "done"): Promise<DoneWith<undefined>>;
  setRoomCheckAction(taskId: string, itemId: string, on: boolean): Promise<DoneWith<undefined>>;
  sendMinibarCountAction(taskId: string, counts: { itemId: string; used: number }[]): Promise<DoneWith<undefined>>;
  logRoomFoundItemAction(
    taskId: string,
    input: { description: string; spot: string },
  ): Promise<DoneWith<LoggedFoundItem>>;
  reportProblemAction(input: NewProblemReport): Promise<DoneWith<string>>;
  uploadInspectionPhotoAction(form: FormData): Promise<DoneWith<string>>;
  inspectRoomAction(
    taskId: string,
    input: { result: "pass" | "fail"; reason?: string; checks: InspectionVerdict[] },
  ): Promise<DoneWith<undefined>>;
  startWorkOrderAction(orderId: string): Promise<DoneWith<undefined>>;
  setWorkOrderTimerAction(orderId: string, running: boolean): Promise<DoneWith<undefined>>;
  noteWorkOrderAction(orderId: string, note: string): Promise<DoneWith<undefined>>;
  resolveWorkOrderAction(orderId: string, input: { fix: string; askRelease: boolean }): Promise<DoneWith<undefined>>;
  setHousekeepingTaskStatus(id: string, status: "active" | "done"): Promise<Done>;
  // Commercial
  createPackagesDraft(input: PackagesDraftInput): Promise<PackagesDraftResult>;
  discardPackagesDraft(id: string): Promise<void>;
  scheduleRatesInventoryChange(planId: string, draft: { note: string; from: string; to: string | null }): Promise<void>;
  discardRatesInventoryChange(planId: string): Promise<void>;
  sendRevenueChanges(items: RevenueSendItem[]): Promise<void>;
}
