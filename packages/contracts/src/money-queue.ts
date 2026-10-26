import { z } from "zod";

import { Uuid } from "./primitives";

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

export const MoneyQueueBucket = z.enum(["parked", "reversals", "owed", "short", "over_limit", "waiting_on_payer"]);
export type MoneyQueueBucket = z.infer<typeof MoneyQueueBucket>;

export const MoneyQueueRow = z.object({
  id: Uuid,
  bucket: MoneyQueueBucket,
  /** Ours, derived from the idempotency key (`INJ…`). */
  reference: z.string(),
  /** The bank's, when it gave one. */
  providerReference: z.string().nullable(),
  provider: z.string(),
  mode: z.enum(["mock", "live"]),
  direction: z.enum(["collection", "disbursement", "adjustment"]),
  operation: z.string(),
  amountRwf: z.number().int(),
  status: z.string(),
  /** The queue reason, the failure reason or the reversal kind: why it is here. */
  reason: z.string().nullable(),
  /** The paying or receiving wallet, masked (`078••••456`). */
  party: z.string().nullable(),
  bookingReference: z.string().nullable(),
  createdAt: z.string(),
  /** Seconds since the row was written. */
  ageSeconds: z.number().int(),
  /** A two signer request already waiting on this row, if any. */
  pendingOverride: z
    .object({ id: Uuid, action: z.string() })
    .nullable(),
});
export type MoneyQueueRow = z.infer<typeof MoneyQueueRow>;

export const MoneyQueue = z.object({
  rows: z.array(MoneyQueueRow),
  counts: z.record(MoneyQueueBucket, z.number().int()),
});
export type MoneyQueue = z.infer<typeof MoneyQueue>;

export const MoneyBalance = z.object({
  provider: z.string(),
  mode: z.enum(["mock", "live"]),
  /** What the dispatcher may spend now (AC-14). */
  availableRwf: z.number().int(),
  /** Disbursements sending, pending or unknown, with their fees. */
  inFlightRwf: z.number().int(),
  /** Disbursements still queued, for any reason. */
  queuedRwf: z.number().int(),
  /** Rows a machine is stuck on: unknown, or unreachable for over 30 minutes (AC-27). */
  parkedCount: z.number().int(),
  lastReconciliation: z
    .object({ status: z.string(), ranAt: z.string() })
    .nullable(),
});
export type MoneyBalance = z.infer<typeof MoneyBalance>;

/** `POST /admin/finance/payments/:id/resolve`. A note is required, always. */
export const MoneyResolveRequest = z.object({
  outcome: z.enum(["failed", "stands"]),
  note: z.string().trim().min(5, "Say what you checked and why.").max(1000),
});
export type MoneyResolveRequest = z.infer<typeof MoneyResolveRequest>;

export const MoneyOverrideAction = z.enum([
  "resend_disbursement",
  "confirm_received",
  "cancel_service",
  "write_off",
  "treasury_adjustment",
]);
export type MoneyOverrideAction = z.infer<typeof MoneyOverrideAction>;

/** `POST /admin/finance/payments/:id/overrides`: the first signature. */
export const MoneyOverrideRequest = z.object({
  action: MoneyOverrideAction.exclude(["treasury_adjustment"]),
  reason: z.string().trim().min(5, "Say why this needs a second person.").max(1000),
});
export type MoneyOverrideRequest = z.infer<typeof MoneyOverrideRequest>;

/**
 * `POST /admin/finance/treasury-adjustments` (AC-15): a deposit (positive) or a
 * bank debit the statement shows (negative), by its bank reference. Written to
 * the bank record only when a second super admin approves it.
 */
export const TreasuryAdjustmentRequest = z.object({
  amountRwf: z
    .number()
    .int("Whole francs only.")
    .refine((n) => n !== 0, "An adjustment moves some money."),
  bankReference: z.string().trim().min(3, "Give the reference on the bank statement.").max(80),
  reason: z.string().trim().min(5, "Say what this is.").max(1000),
});
export type TreasuryAdjustmentRequest = z.infer<typeof TreasuryAdjustmentRequest>;

export const MoneyOverrideState = z.enum(["initiated", "approved", "applied", "rejected"]);
export type MoneyOverrideState = z.infer<typeof MoneyOverrideState>;

export const MoneyOverrideView = z.object({
  id: Uuid,
  action: MoneyOverrideAction,
  state: MoneyOverrideState,
  reason: z.string(),
  subjectId: Uuid.nullable(),
  /** The row's reference, when the subject is a payment. */
  subjectReference: z.string().nullable(),
  amountRwf: z.number().int().nullable(),
  initiatedBy: z.string(),
  decidedBy: z.string().nullable(),
  createdAt: z.string(),
  /** Whether the caller may sign it: a super admin who did not request it. */
  canDecide: z.boolean(),
});
export type MoneyOverrideView = z.infer<typeof MoneyOverrideView>;

export const MoneyOverrideList = z.object({ overrides: z.array(MoneyOverrideView) });
export type MoneyOverrideList = z.infer<typeof MoneyOverrideList>;

/** What a pull found, applied once (AC-20). */
export const MoneyPullResult = z.object({
  id: Uuid,
  before: z.string(),
  after: z.string(),
  changed: z.boolean(),
  reversalFlagged: z.boolean(),
});
export type MoneyPullResult = z.infer<typeof MoneyPullResult>;
