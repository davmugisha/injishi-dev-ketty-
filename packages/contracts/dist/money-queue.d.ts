import { z } from "zod";
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
export declare const MoneyQueueBucket: z.ZodEnum<["parked", "reversals", "owed", "short", "over_limit", "waiting_on_payer"]>;
export type MoneyQueueBucket = z.infer<typeof MoneyQueueBucket>;
export declare const MoneyQueueRow: z.ZodObject<{
    id: z.ZodString;
    bucket: z.ZodEnum<["parked", "reversals", "owed", "short", "over_limit", "waiting_on_payer"]>;
    /** Ours, derived from the idempotency key (`INJ…`). */
    reference: z.ZodString;
    /** The bank's, when it gave one. */
    providerReference: z.ZodNullable<z.ZodString>;
    provider: z.ZodString;
    mode: z.ZodEnum<["mock", "live"]>;
    direction: z.ZodEnum<["collection", "disbursement", "adjustment"]>;
    operation: z.ZodString;
    amountRwf: z.ZodNumber;
    status: z.ZodString;
    /** The queue reason, the failure reason or the reversal kind: why it is here. */
    reason: z.ZodNullable<z.ZodString>;
    /** The paying or receiving wallet, masked (`078••••456`). */
    party: z.ZodNullable<z.ZodString>;
    bookingReference: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    /** Seconds since the row was written. */
    ageSeconds: z.ZodNumber;
    /** A two signer request already waiting on this row, if any. */
    pendingOverride: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        action: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        action: string;
    }, {
        id: string;
        action: string;
    }>>;
}, "strip", z.ZodTypeAny, {
    status: string;
    id: string;
    reference: string;
    amountRwf: number;
    reason: string | null;
    mode: "mock" | "live";
    createdAt: string;
    direction: "adjustment" | "collection" | "disbursement";
    bookingReference: string | null;
    bucket: "owed" | "parked" | "reversals" | "short" | "over_limit" | "waiting_on_payer";
    provider: string;
    providerReference: string | null;
    operation: string;
    party: string | null;
    ageSeconds: number;
    pendingOverride: {
        id: string;
        action: string;
    } | null;
}, {
    status: string;
    id: string;
    reference: string;
    amountRwf: number;
    reason: string | null;
    mode: "mock" | "live";
    createdAt: string;
    direction: "adjustment" | "collection" | "disbursement";
    bookingReference: string | null;
    bucket: "owed" | "parked" | "reversals" | "short" | "over_limit" | "waiting_on_payer";
    provider: string;
    providerReference: string | null;
    operation: string;
    party: string | null;
    ageSeconds: number;
    pendingOverride: {
        id: string;
        action: string;
    } | null;
}>;
export type MoneyQueueRow = z.infer<typeof MoneyQueueRow>;
export declare const MoneyQueue: z.ZodObject<{
    rows: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        bucket: z.ZodEnum<["parked", "reversals", "owed", "short", "over_limit", "waiting_on_payer"]>;
        /** Ours, derived from the idempotency key (`INJ…`). */
        reference: z.ZodString;
        /** The bank's, when it gave one. */
        providerReference: z.ZodNullable<z.ZodString>;
        provider: z.ZodString;
        mode: z.ZodEnum<["mock", "live"]>;
        direction: z.ZodEnum<["collection", "disbursement", "adjustment"]>;
        operation: z.ZodString;
        amountRwf: z.ZodNumber;
        status: z.ZodString;
        /** The queue reason, the failure reason or the reversal kind: why it is here. */
        reason: z.ZodNullable<z.ZodString>;
        /** The paying or receiving wallet, masked (`078••••456`). */
        party: z.ZodNullable<z.ZodString>;
        bookingReference: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        /** Seconds since the row was written. */
        ageSeconds: z.ZodNumber;
        /** A two signer request already waiting on this row, if any. */
        pendingOverride: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            action: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
            action: string;
        }, {
            id: string;
            action: string;
        }>>;
    }, "strip", z.ZodTypeAny, {
        status: string;
        id: string;
        reference: string;
        amountRwf: number;
        reason: string | null;
        mode: "mock" | "live";
        createdAt: string;
        direction: "adjustment" | "collection" | "disbursement";
        bookingReference: string | null;
        bucket: "owed" | "parked" | "reversals" | "short" | "over_limit" | "waiting_on_payer";
        provider: string;
        providerReference: string | null;
        operation: string;
        party: string | null;
        ageSeconds: number;
        pendingOverride: {
            id: string;
            action: string;
        } | null;
    }, {
        status: string;
        id: string;
        reference: string;
        amountRwf: number;
        reason: string | null;
        mode: "mock" | "live";
        createdAt: string;
        direction: "adjustment" | "collection" | "disbursement";
        bookingReference: string | null;
        bucket: "owed" | "parked" | "reversals" | "short" | "over_limit" | "waiting_on_payer";
        provider: string;
        providerReference: string | null;
        operation: string;
        party: string | null;
        ageSeconds: number;
        pendingOverride: {
            id: string;
            action: string;
        } | null;
    }>, "many">;
    counts: z.ZodRecord<z.ZodEnum<["parked", "reversals", "owed", "short", "over_limit", "waiting_on_payer"]>, z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    counts: Partial<Record<"owed" | "parked" | "reversals" | "short" | "over_limit" | "waiting_on_payer", number>>;
    rows: {
        status: string;
        id: string;
        reference: string;
        amountRwf: number;
        reason: string | null;
        mode: "mock" | "live";
        createdAt: string;
        direction: "adjustment" | "collection" | "disbursement";
        bookingReference: string | null;
        bucket: "owed" | "parked" | "reversals" | "short" | "over_limit" | "waiting_on_payer";
        provider: string;
        providerReference: string | null;
        operation: string;
        party: string | null;
        ageSeconds: number;
        pendingOverride: {
            id: string;
            action: string;
        } | null;
    }[];
}, {
    counts: Partial<Record<"owed" | "parked" | "reversals" | "short" | "over_limit" | "waiting_on_payer", number>>;
    rows: {
        status: string;
        id: string;
        reference: string;
        amountRwf: number;
        reason: string | null;
        mode: "mock" | "live";
        createdAt: string;
        direction: "adjustment" | "collection" | "disbursement";
        bookingReference: string | null;
        bucket: "owed" | "parked" | "reversals" | "short" | "over_limit" | "waiting_on_payer";
        provider: string;
        providerReference: string | null;
        operation: string;
        party: string | null;
        ageSeconds: number;
        pendingOverride: {
            id: string;
            action: string;
        } | null;
    }[];
}>;
export type MoneyQueue = z.infer<typeof MoneyQueue>;
export declare const MoneyBalance: z.ZodObject<{
    provider: z.ZodString;
    mode: z.ZodEnum<["mock", "live"]>;
    /** What the dispatcher may spend now (AC-14). */
    availableRwf: z.ZodNumber;
    /** Disbursements sending, pending or unknown, with their fees. */
    inFlightRwf: z.ZodNumber;
    /** Disbursements still queued, for any reason. */
    queuedRwf: z.ZodNumber;
    /** Rows a machine is stuck on: unknown, or unreachable for over 30 minutes (AC-27). */
    parkedCount: z.ZodNumber;
    lastReconciliation: z.ZodNullable<z.ZodObject<{
        status: z.ZodString;
        ranAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: string;
        ranAt: string;
    }, {
        status: string;
        ranAt: string;
    }>>;
}, "strip", z.ZodTypeAny, {
    mode: "mock" | "live";
    provider: string;
    availableRwf: number;
    inFlightRwf: number;
    queuedRwf: number;
    parkedCount: number;
    lastReconciliation: {
        status: string;
        ranAt: string;
    } | null;
}, {
    mode: "mock" | "live";
    provider: string;
    availableRwf: number;
    inFlightRwf: number;
    queuedRwf: number;
    parkedCount: number;
    lastReconciliation: {
        status: string;
        ranAt: string;
    } | null;
}>;
export type MoneyBalance = z.infer<typeof MoneyBalance>;
/** `POST /admin/finance/payments/:id/resolve`. A note is required, always. */
export declare const MoneyResolveRequest: z.ZodObject<{
    outcome: z.ZodEnum<["failed", "stands"]>;
    note: z.ZodString;
}, "strip", z.ZodTypeAny, {
    note: string;
    outcome: "failed" | "stands";
}, {
    note: string;
    outcome: "failed" | "stands";
}>;
export type MoneyResolveRequest = z.infer<typeof MoneyResolveRequest>;
export declare const MoneyOverrideAction: z.ZodEnum<["resend_disbursement", "confirm_received", "cancel_service", "write_off", "treasury_adjustment"]>;
export type MoneyOverrideAction = z.infer<typeof MoneyOverrideAction>;
/** `POST /admin/finance/payments/:id/overrides`: the first signature. */
export declare const MoneyOverrideRequest: z.ZodObject<{
    action: z.ZodEnum<["resend_disbursement", "confirm_received", "cancel_service", "write_off"]>;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
    action: "resend_disbursement" | "confirm_received" | "cancel_service" | "write_off";
}, {
    reason: string;
    action: "resend_disbursement" | "confirm_received" | "cancel_service" | "write_off";
}>;
export type MoneyOverrideRequest = z.infer<typeof MoneyOverrideRequest>;
/**
 * `POST /admin/finance/treasury-adjustments` (AC-15): a deposit (positive) or a
 * bank debit the statement shows (negative), by its bank reference. Written to
 * the bank record only when a second super admin approves it.
 */
export declare const TreasuryAdjustmentRequest: z.ZodObject<{
    amountRwf: z.ZodEffects<z.ZodNumber, number, number>;
    bankReference: z.ZodString;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    amountRwf: number;
    reason: string;
    bankReference: string;
}, {
    amountRwf: number;
    reason: string;
    bankReference: string;
}>;
export type TreasuryAdjustmentRequest = z.infer<typeof TreasuryAdjustmentRequest>;
export declare const MoneyOverrideState: z.ZodEnum<["initiated", "approved", "applied", "rejected"]>;
export type MoneyOverrideState = z.infer<typeof MoneyOverrideState>;
export declare const MoneyOverrideView: z.ZodObject<{
    id: z.ZodString;
    action: z.ZodEnum<["resend_disbursement", "confirm_received", "cancel_service", "write_off", "treasury_adjustment"]>;
    state: z.ZodEnum<["initiated", "approved", "applied", "rejected"]>;
    reason: z.ZodString;
    subjectId: z.ZodNullable<z.ZodString>;
    /** The row's reference, when the subject is a payment. */
    subjectReference: z.ZodNullable<z.ZodString>;
    amountRwf: z.ZodNullable<z.ZodNumber>;
    initiatedBy: z.ZodString;
    decidedBy: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    /** Whether the caller may sign it: a super admin who did not request it. */
    canDecide: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    id: string;
    state: "approved" | "rejected" | "applied" | "initiated";
    amountRwf: number | null;
    reason: string;
    canDecide: boolean;
    createdAt: string;
    subjectId: string | null;
    action: "resend_disbursement" | "confirm_received" | "cancel_service" | "write_off" | "treasury_adjustment";
    subjectReference: string | null;
    initiatedBy: string;
    decidedBy: string | null;
}, {
    id: string;
    state: "approved" | "rejected" | "applied" | "initiated";
    amountRwf: number | null;
    reason: string;
    canDecide: boolean;
    createdAt: string;
    subjectId: string | null;
    action: "resend_disbursement" | "confirm_received" | "cancel_service" | "write_off" | "treasury_adjustment";
    subjectReference: string | null;
    initiatedBy: string;
    decidedBy: string | null;
}>;
export type MoneyOverrideView = z.infer<typeof MoneyOverrideView>;
export declare const MoneyOverrideList: z.ZodObject<{
    overrides: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        action: z.ZodEnum<["resend_disbursement", "confirm_received", "cancel_service", "write_off", "treasury_adjustment"]>;
        state: z.ZodEnum<["initiated", "approved", "applied", "rejected"]>;
        reason: z.ZodString;
        subjectId: z.ZodNullable<z.ZodString>;
        /** The row's reference, when the subject is a payment. */
        subjectReference: z.ZodNullable<z.ZodString>;
        amountRwf: z.ZodNullable<z.ZodNumber>;
        initiatedBy: z.ZodString;
        decidedBy: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        /** Whether the caller may sign it: a super admin who did not request it. */
        canDecide: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        id: string;
        state: "approved" | "rejected" | "applied" | "initiated";
        amountRwf: number | null;
        reason: string;
        canDecide: boolean;
        createdAt: string;
        subjectId: string | null;
        action: "resend_disbursement" | "confirm_received" | "cancel_service" | "write_off" | "treasury_adjustment";
        subjectReference: string | null;
        initiatedBy: string;
        decidedBy: string | null;
    }, {
        id: string;
        state: "approved" | "rejected" | "applied" | "initiated";
        amountRwf: number | null;
        reason: string;
        canDecide: boolean;
        createdAt: string;
        subjectId: string | null;
        action: "resend_disbursement" | "confirm_received" | "cancel_service" | "write_off" | "treasury_adjustment";
        subjectReference: string | null;
        initiatedBy: string;
        decidedBy: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    overrides: {
        id: string;
        state: "approved" | "rejected" | "applied" | "initiated";
        amountRwf: number | null;
        reason: string;
        canDecide: boolean;
        createdAt: string;
        subjectId: string | null;
        action: "resend_disbursement" | "confirm_received" | "cancel_service" | "write_off" | "treasury_adjustment";
        subjectReference: string | null;
        initiatedBy: string;
        decidedBy: string | null;
    }[];
}, {
    overrides: {
        id: string;
        state: "approved" | "rejected" | "applied" | "initiated";
        amountRwf: number | null;
        reason: string;
        canDecide: boolean;
        createdAt: string;
        subjectId: string | null;
        action: "resend_disbursement" | "confirm_received" | "cancel_service" | "write_off" | "treasury_adjustment";
        subjectReference: string | null;
        initiatedBy: string;
        decidedBy: string | null;
    }[];
}>;
export type MoneyOverrideList = z.infer<typeof MoneyOverrideList>;
/** What a pull found, applied once (AC-20). */
export declare const MoneyPullResult: z.ZodObject<{
    id: z.ZodString;
    before: z.ZodString;
    after: z.ZodString;
    changed: z.ZodBoolean;
    reversalFlagged: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    id: string;
    before: string;
    changed: boolean;
    after: string;
    reversalFlagged: boolean;
}, {
    id: string;
    before: string;
    changed: boolean;
    after: string;
    reversalFlagged: boolean;
}>;
export type MoneyPullResult = z.infer<typeof MoneyPullResult>;
//# sourceMappingURL=money-queue.d.ts.map