"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MoneyPullResult = exports.MoneyOverrideList = exports.MoneyOverrideView = exports.MoneyOverrideState = exports.TreasuryAdjustmentRequest = exports.MoneyOverrideRequest = exports.MoneyOverrideAction = exports.MoneyResolveRequest = exports.MoneyBalance = exports.MoneyQueue = exports.MoneyQueueRow = exports.MoneyQueueBucket = void 0;
const zod_1 = require("zod");
const primitives_1 = require("./primitives");
/**
 * The money queue — `/api/v1/admin/finance/payments` (073-gtbank-payments
 * AC-15, AC-18 to AC-21).
 *
 * ONE LIST OF WHAT NEEDS A PERSON. Every payment the platform sends or takes is
 * a row of the bank record, and almost all of them settle without anybody
 * looking. These are the ones that did not: a machine could not learn the
 * outcome, the bank took money back, a refund is owed and failed, the account
 * is short, a payment is above the limit, or a payer has not given the bank
 * their name and ID yet.
 *
 * NOTHING HERE SHOWS A WHOLE NUMBER, A NAME OR AN ID. A row carries the
 * masked wallet and the references, which is what a person needs to find the
 * payment in the bank's portal, and no more.
 *
 * PULL AND RESOLVE NEVER MOVE MONEY. Moving money, or marking money received,
 * takes two people: one requests an override, a different super admin
 * approves it.
 */
exports.MoneyQueueBucket = zod_1.z.enum(["parked", "reversals", "owed", "short", "over_limit", "waiting_on_payer"]);
exports.MoneyQueueRow = zod_1.z.object({
    id: primitives_1.Uuid,
    bucket: exports.MoneyQueueBucket,
    /** Ours, derived from the idempotency key (`INJ…`). */
    reference: zod_1.z.string(),
    /** The bank's, when it gave one. */
    providerReference: zod_1.z.string().nullable(),
    provider: zod_1.z.string(),
    mode: zod_1.z.enum(["mock", "live"]),
    direction: zod_1.z.enum(["collection", "disbursement", "adjustment"]),
    operation: zod_1.z.string(),
    amountRwf: zod_1.z.number().int(),
    status: zod_1.z.string(),
    /** The queue reason, the failure reason or the reversal kind: why it is here. */
    reason: zod_1.z.string().nullable(),
    /** The paying or receiving wallet, masked (`078••••456`). */
    party: zod_1.z.string().nullable(),
    bookingReference: zod_1.z.string().nullable(),
    createdAt: zod_1.z.string(),
    /** Seconds since the row was written. */
    ageSeconds: zod_1.z.number().int(),
    /** A two signer request already waiting on this row, if any. */
    pendingOverride: zod_1.z
        .object({ id: primitives_1.Uuid, action: zod_1.z.string() })
        .nullable(),
});
exports.MoneyQueue = zod_1.z.object({
    rows: zod_1.z.array(exports.MoneyQueueRow),
    counts: zod_1.z.record(exports.MoneyQueueBucket, zod_1.z.number().int()),
});
exports.MoneyBalance = zod_1.z.object({
    provider: zod_1.z.string(),
    mode: zod_1.z.enum(["mock", "live"]),
    /** What the dispatcher may spend now (AC-14). */
    availableRwf: zod_1.z.number().int(),
    /** Disbursements sending, pending or unknown, with their fees. */
    inFlightRwf: zod_1.z.number().int(),
    /** Disbursements still queued, for any reason. */
    queuedRwf: zod_1.z.number().int(),
    /** Rows a machine is stuck on: unknown, or unreachable for over 30 minutes (AC-27). */
    parkedCount: zod_1.z.number().int(),
    lastReconciliation: zod_1.z
        .object({ status: zod_1.z.string(), ranAt: zod_1.z.string() })
        .nullable(),
});
/** `POST /admin/finance/payments/:id/resolve`. A note is required, always. */
exports.MoneyResolveRequest = zod_1.z.object({
    outcome: zod_1.z.enum(["failed", "stands"]),
    note: zod_1.z.string().trim().min(5, "Say what you checked and why.").max(1000),
});
exports.MoneyOverrideAction = zod_1.z.enum([
    "resend_disbursement",
    "confirm_received",
    "cancel_service",
    "write_off",
    "treasury_adjustment",
]);
/** `POST /admin/finance/payments/:id/overrides`: the first signature. */
exports.MoneyOverrideRequest = zod_1.z.object({
    action: exports.MoneyOverrideAction.exclude(["treasury_adjustment"]),
    reason: zod_1.z.string().trim().min(5, "Say why this needs a second person.").max(1000),
});
/**
 * `POST /admin/finance/treasury-adjustments` (AC-15): a deposit (positive) or a
 * bank debit the statement shows (negative), by its bank reference. Written to
 * the bank record only when a second super admin approves it.
 */
exports.TreasuryAdjustmentRequest = zod_1.z.object({
    amountRwf: zod_1.z
        .number()
        .int("Whole francs only.")
        .refine((n) => n !== 0, "An adjustment moves some money."),
    bankReference: zod_1.z.string().trim().min(3, "Give the reference on the bank statement.").max(80),
    reason: zod_1.z.string().trim().min(5, "Say what this is.").max(1000),
});
exports.MoneyOverrideState = zod_1.z.enum(["initiated", "approved", "applied", "rejected"]);
exports.MoneyOverrideView = zod_1.z.object({
    id: primitives_1.Uuid,
    action: exports.MoneyOverrideAction,
    state: exports.MoneyOverrideState,
    reason: zod_1.z.string(),
    subjectId: primitives_1.Uuid.nullable(),
    /** The row's reference, when the subject is a payment. */
    subjectReference: zod_1.z.string().nullable(),
    amountRwf: zod_1.z.number().int().nullable(),
    initiatedBy: zod_1.z.string(),
    decidedBy: zod_1.z.string().nullable(),
    createdAt: zod_1.z.string(),
    /** Whether the caller may sign it: a super admin who did not request it. */
    canDecide: zod_1.z.boolean(),
});
exports.MoneyOverrideList = zod_1.z.object({ overrides: zod_1.z.array(exports.MoneyOverrideView) });
/** What a pull found, applied once (AC-20). */
exports.MoneyPullResult = zod_1.z.object({
    id: primitives_1.Uuid,
    before: zod_1.z.string(),
    after: zod_1.z.string(),
    changed: zod_1.z.boolean(),
    reversalFlagged: zod_1.z.boolean(),
});
//# sourceMappingURL=money-queue.js.map