import { z } from "zod";
import { RwPhoneNumber } from "../phone";
import { Uuid } from "../primitives";
import {
  CalendarDay,
  addDays,
  daysBetween,
  isIsoDate,
  kigaliToday,
  noticeDaysOf,
  noticeNotNeeded,
  noticeWindow,
  type NoticeLease,
} from "./dates";
import { LEASE_CHANGE_FILING_DAYS } from "./money";
import {
  DepositRefundMethod,
  LeaseDepositStatus,
  LeaseSignerRole,
  LeaseStatus,
  MoveOutNoticeChannel,
  MoveOutNoticeStatus,
  MoveOutReasonCode,
  PositiveRwf,
  Rwf,
  formatRwf,
} from "./vocab";

// ===========================================================================
// Moving out (WP 1.7): the notice, its acknowledgement, the moved-out day,
// and settling the deposit the landlord holds.
// ===========================================================================
//
// A tenant gives notice on Injishi (at least the lease's notice days away,
// never after the lease's last day), or the landlord records one that came by
// letter, email or in person. The landlord acknowledges it (the lease is then
// `ending`), records the day the tenant moved out (the lease is `ended`, rent
// after that day is waived), and settles the deposit: what is kept, item by
// item, and what goes back, by a MoMo transfer through Injishi from the
// landlord's phone, recorded as paid outside, or nothing. The tenant may
// dispute a settlement with a note.

const IsoMoment = z.string();

const OptionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep it under ${max} characters.`)
    .optional()
    .transform((v) => (v ? v : undefined));

/** A notice still to be acknowledged nudges the landlord once after this many days. */
export const NOTICE_NUDGE_AFTER_DAYS = 3;

/** RRA asks the landlord to tell the district within 30 days when a lease ends. */
export const TERMINATION_FILING_DAYS = LEASE_CHANGE_FILING_DAYS;

/** The day the district should hear that a lease ended on `endedOn`. */
export function terminationFilingDueOn(endedOn: string): string {
  return addDays(endedOn, TERMINATION_FILING_DAYS);
}

/** The reasons a tenant picks from. The landlord's own reasons are for notices they give. */
export const TENANT_MOVE_OUT_REASONS = [
  "moving_in_kigali",
  "leaving_kigali",
  "own_home",
  "cost",
  "terms",
  "other",
] as const satisfies readonly MoveOutReasonCode[];

/** How a notice the landlord records reached them. A notice on Injishi is the tenant's own. */
export const RecordedNoticeChannel = z.enum(["letter", "email", "in_person"], {
  errorMap: () => ({ message: "Pick how the notice reached you." }),
});
export type RecordedNoticeChannel = z.infer<typeof RecordedNoticeChannel>;
export const NOTICE_CHANNEL_LABEL: Readonly<Record<MoveOutNoticeChannel, string>> = {
  app: "On Injishi",
  letter: "By letter",
  email: "By email",
  in_person: "In person",
};

const Message = OptionalText(1000);

// --- Requests ---------------------------------------------------------------------

/** `POST /me/tenancies/:leaseId/notice`: the tenant gives notice. The day is checked against the lease. */
export const TenantNoticeRequest = z.object({
  moveOutOn: CalendarDay,
  reasonCode: z.enum(TENANT_MOVE_OUT_REASONS, { errorMap: () => ({ message: "Pick a reason." }) }),
  message: Message,
});
export type TenantNoticeRequest = z.infer<typeof TenantNoticeRequest>;

/**
 * `POST /ops/leases/:id/notice`: a notice that reached the landlord outside
 * Injishi (a letter, an email, in person), or one the landlord gives. The day
 * it was given is from the lease's start to today; the move out day after it
 * and no later than the lease's last day. Less than the lease's notice days
 * is kept, marked short.
 */
export const RecordedNoticeRequest = z.object({
  givenBy: LeaseSignerRole.default("tenant"),
  channel: RecordedNoticeChannel,
  filedOn: CalendarDay,
  moveOutOn: CalendarDay,
  reasonCode: MoveOutReasonCode,
  message: Message,
});
export type RecordedNoticeRequest = z.input<typeof RecordedNoticeRequest>;

/** `POST /ops/leases/:id/move-out`: the day the tenant actually left. Today or earlier, never before the start. */
export const RecordMoveOutRequest = z.object({
  movedOutOn: CalendarDay,
  note: OptionalText(500),
});
export type RecordMoveOutRequest = z.infer<typeof RecordMoveOutRequest>;

/** One thing the landlord keeps part of the deposit for. */
export const DepositDeduction = z.object({
  label: z
    .string({ required_error: "Say what it is for." })
    .trim()
    .min(2, "Say what it is for.")
    .max(80, "Keep it under 80 characters."),
  amountRwf: PositiveRwf,
});
export type DepositDeduction = z.infer<typeof DepositDeduction>;

/** How the refund goes back. */
export const DepositRefund = z.discriminatedUnion("method", [
  /** A MoMo transfer through Injishi: a prompt on the landlord's phone, then the money to the tenant's number. */
  z.object({ method: z.literal("gateway"), tenantPhone: RwPhoneNumber, payerPhone: RwPhoneNumber }),
  /** Paid outside Injishi (cash, a transfer), written down with the day and a reference if there is one. */
  z.object({ method: z.literal("recorded"), paidOn: CalendarDay, reference: OptionalText(80) }),
  /** Nothing goes back. */
  z.object({ method: z.literal("none") }),
]);
export type DepositRefund = z.infer<typeof DepositRefund>;

/**
 * `POST /ops/deposits/:id/settle`, with an `Idempotency-Key`. What is kept is
 * the sum of the deductions; kept plus refunded must equal what the tenant
 * paid on the deposit (`settlementProblem`).
 */
export const SettleDepositRequest = z.object({
  deductions: z.array(DepositDeduction).max(20, "Keep it to 20 lines."),
  refundedRwf: Rwf,
  refund: DepositRefund,
  note: OptionalText(500),
});
export type SettleDepositRequest = z.infer<typeof SettleDepositRequest>;

/** `POST /me/tenancies/:leaseId/deposit/dispute`: the tenant does not agree with the settlement. */
export const DisputeDepositRequest = z.object({
  note: z
    .string({ required_error: "Say what you don't agree with." })
    .trim()
    .min(5, "Say what you don't agree with.")
    .max(1000, "Keep it under 1000 characters."),
});
export type DisputeDepositRequest = z.infer<typeof DisputeDepositRequest>;

// --- Rules ------------------------------------------------------------------------

/** What the deductions add up to. */
export function keptOf(deductions: readonly { amountRwf: number }[]): number {
  return deductions.reduce((s, d) => s + d.amountRwf, 0);
}

/**
 * Why a settlement does not balance, or null: kept (the deductions) plus
 * refunded is what the tenant paid; a refund needs a way back, and "no
 * refund" refunds nothing.
 */
export function settlementProblem(input: {
  paidRwf: number;
  deductions: readonly { amountRwf: number }[];
  refundedRwf: number;
  method: DepositRefundMethod;
}): string | null {
  const kept = keptOf(input.deductions);
  if (kept > input.paidRwf) return `You can keep at most the ${formatRwf(input.paidRwf)} paid.`;
  if (kept + input.refundedRwf !== input.paidRwf) {
    return `What you keep and what you refund must add up to ${formatRwf(input.paidRwf)}.`;
  }
  if (input.method === "none" && input.refundedRwf > 0) return "Pick how the refund goes back.";
  if (input.method !== "none" && input.refundedRwf === 0) return "There is nothing to refund. Pick No refund.";
  return null;
}

/** What is wrong with the days of a notice the landlord records, or null. */
export function recordedNoticeProblem(
  input: { filedOn: string; moveOutOn: string },
  lease: NoticeLease,
  today: string = kigaliToday(),
): { path: "filedOn" | "moveOutOn"; message: string } | null {
  if (!isIsoDate(input.filedOn)) return { path: "filedOn", message: "Pick a date." };
  if (input.filedOn > today) return { path: "filedOn", message: "Pick today or an earlier day." };
  if (input.filedOn < lease.startDate) return { path: "filedOn", message: "Pick a day on or after the lease started." };
  if (!isIsoDate(input.moveOutOn)) return { path: "moveOutOn", message: "Pick a date." };
  if (input.moveOutOn <= input.filedOn) return { path: "moveOutOn", message: "Pick a day after the notice was given." };
  if (input.moveOutOn > lease.endDate) return { path: "moveOutOn", message: "Pick the lease's last day or earlier." };
  return null;
}

/** Was a notice given `filedOn` for `moveOutOn` shorter than the lease asks? */
export function isShortNotice(filedOn: string, moveOutOn: string, lease: Pick<NoticeLease, "noticeDays">): boolean {
  return daysBetween(filedOn, moveOutOn) < noticeDaysOf(lease);
}

/** The leases a notice can be given on: running, or ending on their own. */
export function canTakeNotice(status: LeaseStatus): boolean {
  return status === "active" || status === "ending";
}

/** The steps of moving out, in order, as the tenant's stepper shows them. */
export const MoveOutStage = z.enum(["submitted", "acknowledged", "moved_out", "settled"]);
export type MoveOutStage = z.infer<typeof MoveOutStage>;
export const MOVE_OUT_STAGE_LABEL: Readonly<Record<MoveOutStage, string>> = {
  submitted: "Submitted",
  acknowledged: "Acknowledged",
  moved_out: "Moved out",
  settled: "Deposit settled",
};

/** How far moving out has gone, or null before any notice and before the lease ended. */
export function moveOutStage(input: {
  leaseStatus: LeaseStatus;
  noticeStatus: MoveOutNoticeStatus | null;
  depositSettled: boolean;
}): MoveOutStage | null {
  if (input.leaseStatus === "ended") return input.depositSettled ? "settled" : "moved_out";
  if (input.noticeStatus === "acknowledged") return "acknowledged";
  if (input.noticeStatus === "submitted") return "submitted";
  return null;
}

// --- The landlord's list -----------------------------------------------------------

/** The tabs of `/move-outs`. */
export const MoveOutTab = z.enum(["to_acknowledge", "moving_soon", "moved_out", "settled"]);
export type MoveOutTab = z.infer<typeof MoveOutTab>;
export const MOVE_OUT_TAB_LABEL: Readonly<Record<MoveOutTab, string>> = {
  to_acknowledge: "To acknowledge",
  moving_soon: "Moving soon",
  moved_out: "Moved out",
  settled: "Settled",
};

/**
 * The tab a lease shows under, or null when it is not moving out: a notice
 * waiting for the landlord; ending (acknowledged, or its end is near); ended
 * with a deposit still held; ended with the deposit settled or none.
 */
export function moveOutTabOf(input: {
  leaseStatus: LeaseStatus;
  noticeStatus: MoveOutNoticeStatus | null;
  depositOpen: boolean;
}): MoveOutTab | null {
  if (input.leaseStatus === "ended") return input.depositOpen ? "moved_out" : "settled";
  if (!canTakeNotice(input.leaseStatus)) return null;
  if (input.noticeStatus === "submitted") return "to_acknowledge";
  if (input.leaseStatus === "ending") return "moving_soon";
  return null;
}

export const MoveOutListQuery = z.object({
  tab: MoveOutTab.default("to_acknowledge"),
  q: z.string().trim().max(120).optional(),
});
export type MoveOutListQuery = z.input<typeof MoveOutListQuery>;

// --- Views ------------------------------------------------------------------------

export const MoveOutNoticeView = z.object({
  id: Uuid,
  givenBy: LeaseSignerRole,
  channel: MoveOutNoticeChannel,
  filedOn: CalendarDay,
  moveOutOn: CalendarDay,
  reasonCode: MoveOutReasonCode,
  message: z.string().nullable(),
  noticeDays: z.number().int(),
  isShortNotice: z.boolean(),
  status: MoveOutNoticeStatus,
  acknowledgedAt: IsoMoment.nullable(),
  withdrawnAt: IsoMoment.nullable(),
  filedAt: IsoMoment,
});
export type MoveOutNoticeView = z.infer<typeof MoveOutNoticeView>;

/** Where a refund through Injishi stands: on the landlord's phone, with the tenant, or refused. */
export const DepositRefundStatus = z.enum(["waiting", "paid", "failed"]);
export type DepositRefundStatus = z.infer<typeof DepositRefundStatus>;

export const DepositView = z.object({
  id: Uuid,
  leaseId: Uuid,
  agreedRwf: z.number().int(),
  /** What the tenant paid on the deposit charge: what a settlement splits. */
  paidRwf: z.number().int(),
  status: LeaseDepositStatus,
  keptRwf: z.number().int().nullable(),
  refundedRwf: z.number().int().nullable(),
  deductions: z.array(z.object({ label: z.string(), amountRwf: z.number().int() })),
  refundMethod: DepositRefundMethod.nullable(),
  /** A refund through Injishi: waiting on the landlord's phone, paid, or failed (then it can be settled again). */
  refundStatus: DepositRefundStatus.nullable(),
  refundDestination: z.string().nullable(),
  refundFailureReason: z.string().nullable(),
  refundReference: z.string().nullable(),
  settledAt: IsoMoment.nullable(),
  tenantDisputedAt: IsoMoment.nullable(),
  disputeNote: z.string().nullable(),
});
export type DepositView = z.infer<typeof DepositView>;

/** Can this deposit be settled now: held (or never paid) on a lease that ended, and no refund on its way. */
export function canSettleDeposit(deposit: Pick<DepositView, "status" | "refundStatus">, leaseStatus: LeaseStatus): boolean {
  return leaseStatus === "ended" && deposit.status !== "settled" && deposit.refundStatus !== "waiting";
}

/** One row of `GET /ops/move-outs`. */
export const MoveOutRow = z.object({
  leaseId: Uuid,
  reference: z.string(),
  tenantName: z.string(),
  unitLabel: z.string(),
  propertyName: z.string(),
  leaseStatus: LeaseStatus,
  startDate: CalendarDay,
  endDate: CalendarDay,
  noticeDays: z.number().int(),
  notice: MoveOutNoticeView.nullable(),
  /** The notice's day, else the lease's last day. */
  movingOutOn: CalendarDay,
  /** Days from today to `movingOutOn` (negative once past); null once moved out. */
  daysLeft: z.number().int().nullable(),
  endedOn: CalendarDay.nullable(),
  deposit: DepositView.nullable(),
  tab: MoveOutTab,
});
export type MoveOutRow = z.infer<typeof MoveOutRow>;

export const MoveOutList = z.object({
  tab: MoveOutTab,
  items: z.array(MoveOutRow),
  counts: z.record(MoveOutTab, z.number().int()),
});
export type MoveOutList = z.infer<typeof MoveOutList>;

/** `GET /ops/deposits`: every deposit with its lease. */
export const DepositListItem = DepositView.extend({
  reference: z.string(),
  tenantName: z.string(),
  unitLabel: z.string(),
  propertyName: z.string(),
  leaseStatus: LeaseStatus,
  endedOn: CalendarDay.nullable(),
});
export type DepositListItem = z.infer<typeof DepositListItem>;
export const DepositList = z.object({ items: z.array(DepositListItem) });
export type DepositList = z.infer<typeof DepositList>;

/** `GET /me/tenancies/:leaseId/move-out`: what the tenant's Moving out page shows. */
export const TenancyMoveOut = z.object({
  leaseId: Uuid,
  leaseStatus: LeaseStatus,
  startDate: CalendarDay,
  endDate: CalendarDay,
  noticeDays: z.number().int(),
  /** The days a notice may name today; null when no notice can be given. */
  window: z.object({ min: CalendarDay, max: CalendarDay }).nullable(),
  /** The lease ends within its notice period: it simply ends on its last day. */
  noticeNotNeeded: z.boolean(),
  canGiveNotice: z.boolean(),
  canWithdraw: z.boolean(),
  notice: MoveOutNoticeView.nullable(),
  stage: MoveOutStage.nullable(),
  endedOn: CalendarDay.nullable(),
  deposit: DepositView.nullable(),
  canDispute: z.boolean(),
});
export type TenancyMoveOut = z.infer<typeof TenancyMoveOut>;

/** The days a tenant may name today, or null when the lease takes no notice or ends too soon. */
export function tenantNoticeWindow(
  lease: NoticeLease & { status: LeaseStatus },
  today: string = kigaliToday(),
): { min: string; max: string } | null {
  if (!canTakeNotice(lease.status) || noticeNotNeeded(lease, today)) return null;
  return noticeWindow(lease, today);
}

/** The app's pages a moving out email opens. */
export const MOVE_OUT_APP_PATHS = {
  tenantMoveOut: (leaseId: string): string => `/home/${encodeURIComponent(leaseId)}/move-out`,
  landlordMoveOuts: (tab?: MoveOutTab): string => (tab ? `/move-outs?tab=${tab}` : "/move-outs"),
} as const;
