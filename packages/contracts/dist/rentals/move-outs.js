"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MOVE_OUT_APP_PATHS = exports.TenancyMoveOut = exports.DepositList = exports.DepositListItem = exports.MoveOutList = exports.MoveOutRow = exports.DepositView = exports.DepositRefundStatus = exports.MoveOutNoticeView = exports.MoveOutListQuery = exports.MOVE_OUT_TAB_LABEL = exports.MoveOutTab = exports.MOVE_OUT_STAGE_LABEL = exports.MoveOutStage = exports.DisputeDepositRequest = exports.SettleDepositRequest = exports.DepositRefund = exports.DepositDeduction = exports.RecordMoveOutRequest = exports.RecordedNoticeRequest = exports.TenantNoticeRequest = exports.NOTICE_CHANNEL_LABEL = exports.RecordedNoticeChannel = exports.TENANT_MOVE_OUT_REASONS = exports.TERMINATION_FILING_DAYS = exports.NOTICE_NUDGE_AFTER_DAYS = void 0;
exports.terminationFilingDueOn = terminationFilingDueOn;
exports.keptOf = keptOf;
exports.settlementProblem = settlementProblem;
exports.recordedNoticeProblem = recordedNoticeProblem;
exports.isShortNotice = isShortNotice;
exports.canTakeNotice = canTakeNotice;
exports.moveOutStage = moveOutStage;
exports.moveOutTabOf = moveOutTabOf;
exports.canSettleDeposit = canSettleDeposit;
exports.tenantNoticeWindow = tenantNoticeWindow;
const zod_1 = require("zod");
const phone_1 = require("../phone");
const primitives_1 = require("../primitives");
const dates_1 = require("./dates");
const money_1 = require("./money");
const vocab_1 = require("./vocab");
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
const IsoMoment = zod_1.z.string();
const OptionalText = (max) => zod_1.z
    .string()
    .trim()
    .max(max, `Keep it under ${max} characters.`)
    .optional()
    .transform((v) => (v ? v : undefined));
/** A notice still to be acknowledged nudges the landlord once after this many days. */
exports.NOTICE_NUDGE_AFTER_DAYS = 3;
/** RRA asks the landlord to tell the district within 30 days when a lease ends. */
exports.TERMINATION_FILING_DAYS = money_1.LEASE_CHANGE_FILING_DAYS;
/** The day the district should hear that a lease ended on `endedOn`. */
function terminationFilingDueOn(endedOn) {
    return (0, dates_1.addDays)(endedOn, exports.TERMINATION_FILING_DAYS);
}
/** The reasons a tenant picks from. The landlord's own reasons are for notices they give. */
exports.TENANT_MOVE_OUT_REASONS = [
    "moving_in_kigali",
    "leaving_kigali",
    "own_home",
    "cost",
    "terms",
    "other",
];
/** How a notice the landlord records reached them. A notice on Injishi is the tenant's own. */
exports.RecordedNoticeChannel = zod_1.z.enum(["letter", "email", "in_person"], {
    errorMap: () => ({ message: "Pick how the notice reached you." }),
});
exports.NOTICE_CHANNEL_LABEL = {
    app: "On Injishi",
    letter: "By letter",
    email: "By email",
    in_person: "In person",
};
const Message = OptionalText(1000);
// --- Requests ---------------------------------------------------------------------
/** `POST /me/tenancies/:leaseId/notice`: the tenant gives notice. The day is checked against the lease. */
exports.TenantNoticeRequest = zod_1.z.object({
    moveOutOn: dates_1.CalendarDay,
    reasonCode: zod_1.z.enum(exports.TENANT_MOVE_OUT_REASONS, { errorMap: () => ({ message: "Pick a reason." }) }),
    message: Message,
});
/**
 * `POST /ops/leases/:id/notice`: a notice that reached the landlord outside
 * Injishi (a letter, an email, in person), or one the landlord gives. The day
 * it was given is from the lease's start to today; the move out day after it
 * and no later than the lease's last day. Less than the lease's notice days
 * is kept, marked short.
 */
exports.RecordedNoticeRequest = zod_1.z.object({
    givenBy: vocab_1.LeaseSignerRole.default("tenant"),
    channel: exports.RecordedNoticeChannel,
    filedOn: dates_1.CalendarDay,
    moveOutOn: dates_1.CalendarDay,
    reasonCode: vocab_1.MoveOutReasonCode,
    message: Message,
});
/** `POST /ops/leases/:id/move-out`: the day the tenant actually left. Today or earlier, never before the start. */
exports.RecordMoveOutRequest = zod_1.z.object({
    movedOutOn: dates_1.CalendarDay,
    note: OptionalText(500),
});
/** One thing the landlord keeps part of the deposit for. */
exports.DepositDeduction = zod_1.z.object({
    label: zod_1.z
        .string({ required_error: "Say what it is for." })
        .trim()
        .min(2, "Say what it is for.")
        .max(80, "Keep it under 80 characters."),
    amountRwf: vocab_1.PositiveRwf,
});
/** How the refund goes back. */
exports.DepositRefund = zod_1.z.discriminatedUnion("method", [
    /** A MoMo transfer through Injishi: a prompt on the landlord's phone, then the money to the tenant's number. */
    zod_1.z.object({ method: zod_1.z.literal("gateway"), tenantPhone: phone_1.RwPhoneNumber, payerPhone: phone_1.RwPhoneNumber }),
    /** Paid outside Injishi (cash, a transfer), written down with the day and a reference if there is one. */
    zod_1.z.object({ method: zod_1.z.literal("recorded"), paidOn: dates_1.CalendarDay, reference: OptionalText(80) }),
    /** Nothing goes back. */
    zod_1.z.object({ method: zod_1.z.literal("none") }),
]);
/**
 * `POST /ops/deposits/:id/settle`, with an `Idempotency-Key`. What is kept is
 * the sum of the deductions; kept plus refunded must equal what the tenant
 * paid on the deposit (`settlementProblem`).
 */
exports.SettleDepositRequest = zod_1.z.object({
    deductions: zod_1.z.array(exports.DepositDeduction).max(20, "Keep it to 20 lines."),
    refundedRwf: vocab_1.Rwf,
    refund: exports.DepositRefund,
    note: OptionalText(500),
});
/** `POST /me/tenancies/:leaseId/deposit/dispute`: the tenant does not agree with the settlement. */
exports.DisputeDepositRequest = zod_1.z.object({
    note: zod_1.z
        .string({ required_error: "Say what you don't agree with." })
        .trim()
        .min(5, "Say what you don't agree with.")
        .max(1000, "Keep it under 1000 characters."),
});
// --- Rules ------------------------------------------------------------------------
/** What the deductions add up to. */
function keptOf(deductions) {
    return deductions.reduce((s, d) => s + d.amountRwf, 0);
}
/**
 * Why a settlement does not balance, or null: kept (the deductions) plus
 * refunded is what the tenant paid; a refund needs a way back, and "no
 * refund" refunds nothing.
 */
function settlementProblem(input) {
    const kept = keptOf(input.deductions);
    if (kept > input.paidRwf)
        return `You can keep at most the ${(0, vocab_1.formatRwf)(input.paidRwf)} paid.`;
    if (kept + input.refundedRwf !== input.paidRwf) {
        return `What you keep and what you refund must add up to ${(0, vocab_1.formatRwf)(input.paidRwf)}.`;
    }
    if (input.method === "none" && input.refundedRwf > 0)
        return "Pick how the refund goes back.";
    if (input.method !== "none" && input.refundedRwf === 0)
        return "There is nothing to refund. Pick No refund.";
    return null;
}
/** What is wrong with the days of a notice the landlord records, or null. */
function recordedNoticeProblem(input, lease, today = (0, dates_1.kigaliToday)()) {
    if (!(0, dates_1.isIsoDate)(input.filedOn))
        return { path: "filedOn", message: "Pick a date." };
    if (input.filedOn > today)
        return { path: "filedOn", message: "Pick today or an earlier day." };
    if (input.filedOn < lease.startDate)
        return { path: "filedOn", message: "Pick a day on or after the lease started." };
    if (!(0, dates_1.isIsoDate)(input.moveOutOn))
        return { path: "moveOutOn", message: "Pick a date." };
    if (input.moveOutOn <= input.filedOn)
        return { path: "moveOutOn", message: "Pick a day after the notice was given." };
    if (input.moveOutOn > lease.endDate)
        return { path: "moveOutOn", message: "Pick the lease's last day or earlier." };
    return null;
}
/** Was a notice given `filedOn` for `moveOutOn` shorter than the lease asks? */
function isShortNotice(filedOn, moveOutOn, lease) {
    return (0, dates_1.daysBetween)(filedOn, moveOutOn) < (0, dates_1.noticeDaysOf)(lease);
}
/** The leases a notice can be given on: running, or ending on their own. */
function canTakeNotice(status) {
    return status === "active" || status === "ending";
}
/** The steps of moving out, in order, as the tenant's stepper shows them. */
exports.MoveOutStage = zod_1.z.enum(["submitted", "acknowledged", "moved_out", "settled"]);
exports.MOVE_OUT_STAGE_LABEL = {
    submitted: "Submitted",
    acknowledged: "Acknowledged",
    moved_out: "Moved out",
    settled: "Deposit settled",
};
/** How far moving out has gone, or null before any notice and before the lease ended. */
function moveOutStage(input) {
    if (input.leaseStatus === "ended")
        return input.depositSettled ? "settled" : "moved_out";
    if (input.noticeStatus === "acknowledged")
        return "acknowledged";
    if (input.noticeStatus === "submitted")
        return "submitted";
    return null;
}
// --- The landlord's list -----------------------------------------------------------
/** The tabs of `/move-outs`. */
exports.MoveOutTab = zod_1.z.enum(["to_acknowledge", "moving_soon", "moved_out", "settled"]);
exports.MOVE_OUT_TAB_LABEL = {
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
function moveOutTabOf(input) {
    if (input.leaseStatus === "ended")
        return input.depositOpen ? "moved_out" : "settled";
    if (!canTakeNotice(input.leaseStatus))
        return null;
    if (input.noticeStatus === "submitted")
        return "to_acknowledge";
    if (input.leaseStatus === "ending")
        return "moving_soon";
    return null;
}
exports.MoveOutListQuery = zod_1.z.object({
    tab: exports.MoveOutTab.default("to_acknowledge"),
    q: zod_1.z.string().trim().max(120).optional(),
});
// --- Views ------------------------------------------------------------------------
exports.MoveOutNoticeView = zod_1.z.object({
    id: primitives_1.Uuid,
    givenBy: vocab_1.LeaseSignerRole,
    channel: vocab_1.MoveOutNoticeChannel,
    filedOn: dates_1.CalendarDay,
    moveOutOn: dates_1.CalendarDay,
    reasonCode: vocab_1.MoveOutReasonCode,
    message: zod_1.z.string().nullable(),
    noticeDays: zod_1.z.number().int(),
    isShortNotice: zod_1.z.boolean(),
    status: vocab_1.MoveOutNoticeStatus,
    acknowledgedAt: IsoMoment.nullable(),
    withdrawnAt: IsoMoment.nullable(),
    filedAt: IsoMoment,
});
/** Where a refund through Injishi stands: on the landlord's phone, with the tenant, or refused. */
exports.DepositRefundStatus = zod_1.z.enum(["waiting", "paid", "failed"]);
exports.DepositView = zod_1.z.object({
    id: primitives_1.Uuid,
    leaseId: primitives_1.Uuid,
    agreedRwf: zod_1.z.number().int(),
    /** What the tenant paid on the deposit charge: what a settlement splits. */
    paidRwf: zod_1.z.number().int(),
    status: vocab_1.LeaseDepositStatus,
    keptRwf: zod_1.z.number().int().nullable(),
    refundedRwf: zod_1.z.number().int().nullable(),
    deductions: zod_1.z.array(zod_1.z.object({ label: zod_1.z.string(), amountRwf: zod_1.z.number().int() })),
    refundMethod: vocab_1.DepositRefundMethod.nullable(),
    /** A refund through Injishi: waiting on the landlord's phone, paid, or failed (then it can be settled again). */
    refundStatus: exports.DepositRefundStatus.nullable(),
    refundDestination: zod_1.z.string().nullable(),
    refundFailureReason: zod_1.z.string().nullable(),
    refundReference: zod_1.z.string().nullable(),
    settledAt: IsoMoment.nullable(),
    tenantDisputedAt: IsoMoment.nullable(),
    disputeNote: zod_1.z.string().nullable(),
});
/** Can this deposit be settled now: held (or never paid) on a lease that ended, and no refund on its way. */
function canSettleDeposit(deposit, leaseStatus) {
    return leaseStatus === "ended" && deposit.status !== "settled" && deposit.refundStatus !== "waiting";
}
/** One row of `GET /ops/move-outs`. */
exports.MoveOutRow = zod_1.z.object({
    leaseId: primitives_1.Uuid,
    reference: zod_1.z.string(),
    tenantName: zod_1.z.string(),
    unitLabel: zod_1.z.string(),
    propertyName: zod_1.z.string(),
    leaseStatus: vocab_1.LeaseStatus,
    startDate: dates_1.CalendarDay,
    endDate: dates_1.CalendarDay,
    noticeDays: zod_1.z.number().int(),
    notice: exports.MoveOutNoticeView.nullable(),
    /** The notice's day, else the lease's last day. */
    movingOutOn: dates_1.CalendarDay,
    /** Days from today to `movingOutOn` (negative once past); null once moved out. */
    daysLeft: zod_1.z.number().int().nullable(),
    endedOn: dates_1.CalendarDay.nullable(),
    deposit: exports.DepositView.nullable(),
    tab: exports.MoveOutTab,
});
exports.MoveOutList = zod_1.z.object({
    tab: exports.MoveOutTab,
    items: zod_1.z.array(exports.MoveOutRow),
    counts: zod_1.z.record(exports.MoveOutTab, zod_1.z.number().int()),
});
/** `GET /ops/deposits`: every deposit with its lease. */
exports.DepositListItem = exports.DepositView.extend({
    reference: zod_1.z.string(),
    tenantName: zod_1.z.string(),
    unitLabel: zod_1.z.string(),
    propertyName: zod_1.z.string(),
    leaseStatus: vocab_1.LeaseStatus,
    endedOn: dates_1.CalendarDay.nullable(),
});
exports.DepositList = zod_1.z.object({ items: zod_1.z.array(exports.DepositListItem) });
/** `GET /me/tenancies/:leaseId/move-out`: what the tenant's Moving out page shows. */
exports.TenancyMoveOut = zod_1.z.object({
    leaseId: primitives_1.Uuid,
    leaseStatus: vocab_1.LeaseStatus,
    startDate: dates_1.CalendarDay,
    endDate: dates_1.CalendarDay,
    noticeDays: zod_1.z.number().int(),
    /** The days a notice may name today; null when no notice can be given. */
    window: zod_1.z.object({ min: dates_1.CalendarDay, max: dates_1.CalendarDay }).nullable(),
    /** The lease ends within its notice period: it simply ends on its last day. */
    noticeNotNeeded: zod_1.z.boolean(),
    canGiveNotice: zod_1.z.boolean(),
    canWithdraw: zod_1.z.boolean(),
    notice: exports.MoveOutNoticeView.nullable(),
    stage: exports.MoveOutStage.nullable(),
    endedOn: dates_1.CalendarDay.nullable(),
    deposit: exports.DepositView.nullable(),
    canDispute: zod_1.z.boolean(),
});
/** The days a tenant may name today, or null when the lease takes no notice or ends too soon. */
function tenantNoticeWindow(lease, today = (0, dates_1.kigaliToday)()) {
    if (!canTakeNotice(lease.status) || (0, dates_1.noticeNotNeeded)(lease, today))
        return null;
    return (0, dates_1.noticeWindow)(lease, today);
}
/** The app's pages a moving out email opens. */
exports.MOVE_OUT_APP_PATHS = {
    tenantMoveOut: (leaseId) => `/home/${encodeURIComponent(leaseId)}/move-out`,
    landlordMoveOuts: (tab) => (tab ? `/move-outs?tab=${tab}` : "/move-outs"),
};
//# sourceMappingURL=move-outs.js.map