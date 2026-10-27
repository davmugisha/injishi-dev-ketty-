import { z } from "zod";
import { LeaseChargeKind, LeasePaymentChannel, LeasePaymentStatus } from "./vocab";
/** A tenant is told this many days before rent falls due. */
export declare const RENT_REMINDER_DAYS_BEFORE = 3;
/**
 * The overdue reminders: on the first overdue day, then 7 and 14 days after
 * it. Each is one `stage` of the `overdue` kind, sent at most once per charge.
 */
export declare const OVERDUE_REMINDER_DAYS: readonly number[];
/** The hours in Kigali between which automatic reminders go out (from 08:00, before 18:00). */
export declare const REMINDER_HOURS: {
    readonly from: 8;
    readonly to: 18;
};
/** A landlord may send one manual reminder per charge per Kigali day. */
export declare const MANUAL_REMINDERS_PER_DAY = 1;
/** The hour of the day in Kigali (0 to 23) an instant falls in. */
export declare function kigaliHour(now?: Date): number;
/** May an automatic reminder go out now? Only during the day in Kigali. */
export declare function withinReminderHours(now?: Date): boolean;
/** Which automatic reminder a charge is at. `stage` counts the overdue reminders from 0. */
export interface ReminderStage {
    kind: "upcoming" | "due" | "overdue";
    stage: number;
}
/**
 * The reminder an open charge is at on `today`, or null when none applies:
 * `upcoming` in the last `RENT_REMINDER_DAYS_BEFORE` days before it falls due,
 * `due` on the day, and `overdue` once it is past its due day plus the grace
 * days, then again 7 and 14 days later. Only the latest stage applies, so a
 * charge raised on its due day gets "due today" and never a late "coming up",
 * and a job that missed a week sends the stage the tenant is at, not the ones
 * it missed.
 */
export declare function reminderStageFor(today: string, dueOn: string, graceDays: number): ReminderStage | null;
/** `Rent for November 2026`, `Deposit`: a charge in words. */
export declare function chargeWords(charge: {
    kind: LeaseChargeKind;
    periodStart?: string | null;
    dueOn: string;
}): string;
/**
 * The one sentence a reminder says about a charge, by stage. Plain words, the
 * amount in francs, no dashes.
 */
export declare function reminderSentence(input: {
    stage: ReminderStage["kind"] | "manual";
    charge: {
        kind: LeaseChargeKind;
        periodStart?: string | null;
        dueOn: string;
    };
    owedRwf: number;
    landlordName: string;
}): string;
/** A MoMo prompt the tenant has not answered stops being waited for after this long. */
export declare const GATEWAY_PROMPT_MINUTES = 10;
/** The most charges one payment names. */
export declare const MAX_PAYMENT_CHARGE_IDS = 24;
/**
 * The most a tenant may pay through the gateway: everything owed, plus up to
 * one month's rent kept as credit for the next charge. Nothing when nothing
 * is owed: there is no next charge to hold credit for until one is raised.
 */
export declare function maxGatewayPaymentRwf(outstandingRwf: number, monthlyRentRwf: number): number;
/** `+250788123456` as the nine national digits a mobile money rail takes: `788123456`. */
export declare function nationalMsisdn(e164: string): string;
/** Where a payment stands, in the tenant's words. */
export declare function paymentStatusWords(status: LeasePaymentStatus, opts?: {
    channel?: LeasePaymentChannel;
    failureReason?: string | null;
}): string;
/** `R-2026-0042`: a receipt number, per business and year. */
export declare function receiptNumber(year: number, n: number): string;
/** The number after the highest `R-<year>-<n>` in `taken`, for that year. */
export declare function nextReceiptNumber(year: number, taken: readonly string[]): string;
/** `POST /ops/rent/charges/:id/waive`: the landlord forgives an open charge. */
export declare const WaiveChargeRequest: z.ZodObject<{
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
}, {
    reason: string;
}>;
export type WaiveChargeRequest = z.infer<typeof WaiveChargeRequest>;
/** `POST /ops/rent/reminders`: remind the tenants of these open charges now, by email. */
export declare const RemindRentRequest: z.ZodObject<{
    chargeIds: z.ZodEffects<z.ZodArray<z.ZodString, "many">, string[], string[]>;
    /** A line of the landlord's own, added under the reminder. */
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    chargeIds: string[];
    note?: string | undefined;
}, {
    chargeIds: string[];
    note?: string | undefined;
}>;
export type RemindRentRequest = z.infer<typeof RemindRentRequest>;
/** `GET /ops/rent/roll?month`, `GET /ops/rent/summary?month`: a Kigali month, this one by default. */
export declare const RentMonthQuery: z.ZodObject<{
    month: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    month?: string | undefined;
}, {
    month?: string | undefined;
}>;
export type RentMonthQuery = z.infer<typeof RentMonthQuery>;
/** A charge list filter: `overdue` is open and past the grace days today. */
export declare const ChargeFilterStatus: z.ZodEnum<["open", "paid", "waived", "overdue"]>;
export type ChargeFilterStatus = z.infer<typeof ChargeFilterStatus>;
/** `GET /ops/rent/charges?leaseId|month&status`. */
export declare const RentChargesQuery: z.ZodObject<{
    leaseId: z.ZodOptional<z.ZodString>;
    month: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["open", "paid", "waived", "overdue"]>>;
}, "strip", z.ZodTypeAny, {
    status?: "open" | "paid" | "overdue" | "waived" | undefined;
    month?: string | undefined;
    leaseId?: string | undefined;
}, {
    status?: "open" | "paid" | "overdue" | "waived" | undefined;
    month?: string | undefined;
    leaseId?: string | undefined;
}>;
export type RentChargesQuery = z.infer<typeof RentChargesQuery>;
/** `GET /ops/rent/payments?leaseId|month&status`. */
export declare const RentPaymentsQuery: z.ZodObject<{
    leaseId: z.ZodOptional<z.ZodString>;
    /** The month the money arrived (received on, or succeeded at, in Kigali). */
    month: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["pending", "succeeded", "failed", "expired", "reversed"]>>;
}, "strip", z.ZodTypeAny, {
    status?: "pending" | "expired" | "failed" | "succeeded" | "reversed" | undefined;
    month?: string | undefined;
    leaseId?: string | undefined;
}, {
    status?: "pending" | "expired" | "failed" | "succeeded" | "reversed" | undefined;
    month?: string | undefined;
    leaseId?: string | undefined;
}>;
export type RentPaymentsQuery = z.infer<typeof RentPaymentsQuery>;
/** `GET /ops/rent/reminders?leaseId|month`. */
export declare const RentRemindersQuery: z.ZodObject<{
    leaseId: z.ZodOptional<z.ZodString>;
    month: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    month?: string | undefined;
    leaseId?: string | undefined;
}, {
    month?: string | undefined;
    leaseId?: string | undefined;
}>;
export type RentRemindersQuery = z.infer<typeof RentRemindersQuery>;
export declare const PayoutStatus: z.ZodEnum<["scheduled", "queued", "paid", "held", "failed"]>;
export type PayoutStatus = z.infer<typeof PayoutStatus>;
export declare const PAYOUT_STATUS_LABEL: Readonly<Record<PayoutStatus, string>>;
/** `GET /ops/payouts?month&status`: the month the payout was made (the payment's month). */
export declare const PayoutsQuery: z.ZodObject<{
    month: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["scheduled", "queued", "paid", "held", "failed"]>>;
}, "strip", z.ZodTypeAny, {
    status?: "held" | "failed" | "paid" | "scheduled" | "queued" | undefined;
    month?: string | undefined;
}, {
    status?: "held" | "failed" | "paid" | "scheduled" | "queued" | undefined;
    month?: string | undefined;
}>;
export type PayoutsQuery = z.infer<typeof PayoutsQuery>;
/** The methods a tenant pays with on Injishi today. Card follows when a gateway is chosen. */
export declare const TenantPaymentMethod: z.ZodEnum<["mtn_momo", "airtel_money"]>;
export type TenantPaymentMethod = z.infer<typeof TenantPaymentMethod>;
/**
 * `POST /me/tenancies/:leaseId/payments` (Idempotency-Key): pay by mobile
 * money. Without an amount, everything owed; a smaller amount pays the oldest
 * charges first; a larger one, up to one month's rent over, is kept as credit.
 */
export declare const TenantPayRequest: z.ZodObject<{
    method: z.ZodEnum<["mtn_momo", "airtel_money"]>;
    /** The number the prompt goes to, any way it is typed; stored masked. */
    msisdn: z.ZodPipeline<z.ZodEffects<z.ZodString, string | null, string>, z.ZodString>;
    amountRwf: z.ZodOptional<z.ZodNumber>;
    /** The charges to pay. Absent: the open ones, oldest due first. */
    chargeIds: z.ZodOptional<z.ZodEffects<z.ZodArray<z.ZodString, "many">, string[], string[]>>;
}, "strip", z.ZodTypeAny, {
    msisdn: string;
    method: "mtn_momo" | "airtel_money";
    amountRwf?: number | undefined;
    chargeIds?: string[] | undefined;
}, {
    msisdn: string;
    method: "mtn_momo" | "airtel_money";
    amountRwf?: number | undefined;
    chargeIds?: string[] | undefined;
}>;
export type TenantPayRequest = z.infer<typeof TenantPayRequest>;
/** One charge, with what it still owes and whether it is late today. */
export declare const LeaseChargeView: z.ZodObject<{
    id: z.ZodString;
    leaseId: z.ZodString;
    kind: z.ZodEnum<["rent", "deposit"]>;
    /** "Rent for November 2026", "Deposit". */
    label: z.ZodString;
    periodStart: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
    periodEnd: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
    dueOn: z.ZodEffects<z.ZodString, string, string>;
    amountRwf: z.ZodNumber;
    paidRwf: z.ZodNumber;
    outstandingRwf: z.ZodNumber;
    status: z.ZodEnum<["open", "paid", "waived"]>;
    /** Open and past the due day plus the grace days, as of today. */
    overdue: z.ZodBoolean;
    /** Days past the due day when overdue; 0 otherwise. */
    daysOverdue: z.ZodNumber;
    waivedReason: z.ZodNullable<z.ZodString>;
    paidAt: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "open" | "paid" | "waived";
    id: string;
    kind: "deposit" | "rent";
    amountRwf: number;
    label: string;
    createdAt: string;
    periodStart: string | null;
    periodEnd: string | null;
    paidRwf: number;
    overdue: boolean;
    leaseId: string;
    paidAt: string | null;
    dueOn: string;
    outstandingRwf: number;
    daysOverdue: number;
    waivedReason: string | null;
}, {
    status: "open" | "paid" | "waived";
    id: string;
    kind: "deposit" | "rent";
    amountRwf: number;
    label: string;
    createdAt: string;
    periodStart: string | null;
    periodEnd: string | null;
    paidRwf: number;
    overdue: boolean;
    leaseId: string;
    paidAt: string | null;
    dueOn: string;
    outstandingRwf: number;
    daysOverdue: number;
    waivedReason: string | null;
}>;
export type LeaseChargeView = z.infer<typeof LeaseChargeView>;
/** What part of a payment went to which charge. */
export declare const PaymentAllocationView: z.ZodObject<{
    chargeId: z.ZodString;
    kind: z.ZodEnum<["rent", "deposit"]>;
    label: z.ZodString;
    periodStart: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
    dueOn: z.ZodEffects<z.ZodString, string, string>;
    amountRwf: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    kind: "deposit" | "rent";
    amountRwf: number;
    label: string;
    periodStart: string | null;
    dueOn: string;
    chargeId: string;
}, {
    kind: "deposit" | "rent";
    amountRwf: number;
    label: string;
    periodStart: string | null;
    dueOn: string;
    chargeId: string;
}>;
export type PaymentAllocationView = z.infer<typeof PaymentAllocationView>;
/** The payout a gateway payment went on to the landlord with. */
export declare const PaymentPayoutView: z.ZodObject<{
    id: z.ZodString;
    status: z.ZodEnum<["scheduled", "queued", "paid", "held", "failed"]>;
    /** "MTN MoMo 078•••••456", or null while held with no account. */
    destination: z.ZodNullable<z.ZodString>;
    settledAt: z.ZodNullable<z.ZodString>;
    failureReason: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "held" | "failed" | "paid" | "scheduled" | "queued";
    id: string;
    failureReason: string | null;
    settledAt: string | null;
    destination: string | null;
}, {
    status: "held" | "failed" | "paid" | "scheduled" | "queued";
    id: string;
    failureReason: string | null;
    settledAt: string | null;
    destination: string | null;
}>;
export type PaymentPayoutView = z.infer<typeof PaymentPayoutView>;
/** One payment as the landlord's screens show it. */
export declare const LeasePaymentView: z.ZodObject<{
    id: z.ZodString;
    leaseId: z.ZodString;
    leaseReference: z.ZodString;
    tenant: z.ZodObject<{
        id: z.ZodString;
        fullName: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        fullName: string;
    }, {
        id: string;
        fullName: string;
    }>;
    unit: z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        propertyName: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        label: string;
        propertyName: string;
    }, {
        id: string;
        label: string;
        propertyName: string;
    }>;
    channel: z.ZodEnum<["gateway", "recorded"]>;
    method: z.ZodEnum<["mtn_momo", "airtel_money", "card", "bank_transfer", "cash", "other"]>;
    amountRwf: z.ZodNumber;
    /** What went to charges; the rest is the tenant's credit. */
    allocatedRwf: z.ZodNumber;
    creditRwf: z.ZodNumber;
    status: z.ZodEnum<["pending", "succeeded", "failed", "expired", "reversed"]>;
    statusWords: z.ZodString;
    /** The day the money arrived: received on, or the day it succeeded in Kigali. */
    paidOn: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
    succeededAt: z.ZodNullable<z.ZodString>;
    reference: z.ZodNullable<z.ZodString>;
    payerMasked: z.ZodNullable<z.ZodString>;
    receiptNumber: z.ZodNullable<z.ZodString>;
    /** The landlord attached a photo or scan of the slip. */
    hasSlip: z.ZodBoolean;
    note: z.ZodNullable<z.ZodString>;
    recordedBy: z.ZodNullable<z.ZodString>;
    reversedAt: z.ZodNullable<z.ZodString>;
    reverseReason: z.ZodNullable<z.ZodString>;
    failureReason: z.ZodNullable<z.ZodString>;
    expiresAt: z.ZodNullable<z.ZodString>;
    allocations: z.ZodArray<z.ZodObject<{
        chargeId: z.ZodString;
        kind: z.ZodEnum<["rent", "deposit"]>;
        label: z.ZodString;
        periodStart: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
        dueOn: z.ZodEffects<z.ZodString, string, string>;
        amountRwf: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        kind: "deposit" | "rent";
        amountRwf: number;
        label: string;
        periodStart: string | null;
        dueOn: string;
        chargeId: string;
    }, {
        kind: "deposit" | "rent";
        amountRwf: number;
        label: string;
        periodStart: string | null;
        dueOn: string;
        chargeId: string;
    }>, "many">;
    payout: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        status: z.ZodEnum<["scheduled", "queued", "paid", "held", "failed"]>;
        /** "MTN MoMo 078•••••456", or null while held with no account. */
        destination: z.ZodNullable<z.ZodString>;
        settledAt: z.ZodNullable<z.ZodString>;
        failureReason: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "held" | "failed" | "paid" | "scheduled" | "queued";
        id: string;
        failureReason: string | null;
        settledAt: string | null;
        destination: string | null;
    }, {
        status: "held" | "failed" | "paid" | "scheduled" | "queued";
        id: string;
        failureReason: string | null;
        settledAt: string | null;
        destination: string | null;
    }>>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "pending" | "expired" | "failed" | "succeeded" | "reversed";
    id: string;
    reference: string | null;
    payerMasked: string | null;
    amountRwf: number;
    expiresAt: string | null;
    failureReason: string | null;
    note: string | null;
    tenant: {
        id: string;
        fullName: string;
    };
    payout: {
        status: "held" | "failed" | "paid" | "scheduled" | "queued";
        id: string;
        failureReason: string | null;
        settledAt: string | null;
        destination: string | null;
    } | null;
    unit: {
        id: string;
        label: string;
        propertyName: string;
    };
    createdAt: string;
    leaseId: string;
    method: "other" | "mtn_momo" | "airtel_money" | "card" | "cash" | "bank_transfer";
    channel: "gateway" | "recorded";
    receiptNumber: string | null;
    paidOn: string | null;
    allocations: {
        kind: "deposit" | "rent";
        amountRwf: number;
        label: string;
        periodStart: string | null;
        dueOn: string;
        chargeId: string;
    }[];
    recordedBy: string | null;
    leaseReference: string;
    allocatedRwf: number;
    creditRwf: number;
    statusWords: string;
    succeededAt: string | null;
    hasSlip: boolean;
    reversedAt: string | null;
    reverseReason: string | null;
}, {
    status: "pending" | "expired" | "failed" | "succeeded" | "reversed";
    id: string;
    reference: string | null;
    payerMasked: string | null;
    amountRwf: number;
    expiresAt: string | null;
    failureReason: string | null;
    note: string | null;
    tenant: {
        id: string;
        fullName: string;
    };
    payout: {
        status: "held" | "failed" | "paid" | "scheduled" | "queued";
        id: string;
        failureReason: string | null;
        settledAt: string | null;
        destination: string | null;
    } | null;
    unit: {
        id: string;
        label: string;
        propertyName: string;
    };
    createdAt: string;
    leaseId: string;
    method: "other" | "mtn_momo" | "airtel_money" | "card" | "cash" | "bank_transfer";
    channel: "gateway" | "recorded";
    receiptNumber: string | null;
    paidOn: string | null;
    allocations: {
        kind: "deposit" | "rent";
        amountRwf: number;
        label: string;
        periodStart: string | null;
        dueOn: string;
        chargeId: string;
    }[];
    recordedBy: string | null;
    leaseReference: string;
    allocatedRwf: number;
    creditRwf: number;
    statusWords: string;
    succeededAt: string | null;
    hasSlip: boolean;
    reversedAt: string | null;
    reverseReason: string | null;
}>;
export type LeasePaymentView = z.infer<typeof LeasePaymentView>;
export declare const LeasePaymentList: z.ZodObject<{
    payments: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        leaseId: z.ZodString;
        leaseReference: z.ZodString;
        tenant: z.ZodObject<{
            id: z.ZodString;
            fullName: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
            fullName: string;
        }, {
            id: string;
            fullName: string;
        }>;
        unit: z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
            propertyName: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
            label: string;
            propertyName: string;
        }, {
            id: string;
            label: string;
            propertyName: string;
        }>;
        channel: z.ZodEnum<["gateway", "recorded"]>;
        method: z.ZodEnum<["mtn_momo", "airtel_money", "card", "bank_transfer", "cash", "other"]>;
        amountRwf: z.ZodNumber;
        /** What went to charges; the rest is the tenant's credit. */
        allocatedRwf: z.ZodNumber;
        creditRwf: z.ZodNumber;
        status: z.ZodEnum<["pending", "succeeded", "failed", "expired", "reversed"]>;
        statusWords: z.ZodString;
        /** The day the money arrived: received on, or the day it succeeded in Kigali. */
        paidOn: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
        succeededAt: z.ZodNullable<z.ZodString>;
        reference: z.ZodNullable<z.ZodString>;
        payerMasked: z.ZodNullable<z.ZodString>;
        receiptNumber: z.ZodNullable<z.ZodString>;
        /** The landlord attached a photo or scan of the slip. */
        hasSlip: z.ZodBoolean;
        note: z.ZodNullable<z.ZodString>;
        recordedBy: z.ZodNullable<z.ZodString>;
        reversedAt: z.ZodNullable<z.ZodString>;
        reverseReason: z.ZodNullable<z.ZodString>;
        failureReason: z.ZodNullable<z.ZodString>;
        expiresAt: z.ZodNullable<z.ZodString>;
        allocations: z.ZodArray<z.ZodObject<{
            chargeId: z.ZodString;
            kind: z.ZodEnum<["rent", "deposit"]>;
            label: z.ZodString;
            periodStart: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
            dueOn: z.ZodEffects<z.ZodString, string, string>;
            amountRwf: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            kind: "deposit" | "rent";
            amountRwf: number;
            label: string;
            periodStart: string | null;
            dueOn: string;
            chargeId: string;
        }, {
            kind: "deposit" | "rent";
            amountRwf: number;
            label: string;
            periodStart: string | null;
            dueOn: string;
            chargeId: string;
        }>, "many">;
        payout: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            status: z.ZodEnum<["scheduled", "queued", "paid", "held", "failed"]>;
            /** "MTN MoMo 078•••••456", or null while held with no account. */
            destination: z.ZodNullable<z.ZodString>;
            settledAt: z.ZodNullable<z.ZodString>;
            failureReason: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            status: "held" | "failed" | "paid" | "scheduled" | "queued";
            id: string;
            failureReason: string | null;
            settledAt: string | null;
            destination: string | null;
        }, {
            status: "held" | "failed" | "paid" | "scheduled" | "queued";
            id: string;
            failureReason: string | null;
            settledAt: string | null;
            destination: string | null;
        }>>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "pending" | "expired" | "failed" | "succeeded" | "reversed";
        id: string;
        reference: string | null;
        payerMasked: string | null;
        amountRwf: number;
        expiresAt: string | null;
        failureReason: string | null;
        note: string | null;
        tenant: {
            id: string;
            fullName: string;
        };
        payout: {
            status: "held" | "failed" | "paid" | "scheduled" | "queued";
            id: string;
            failureReason: string | null;
            settledAt: string | null;
            destination: string | null;
        } | null;
        unit: {
            id: string;
            label: string;
            propertyName: string;
        };
        createdAt: string;
        leaseId: string;
        method: "other" | "mtn_momo" | "airtel_money" | "card" | "cash" | "bank_transfer";
        channel: "gateway" | "recorded";
        receiptNumber: string | null;
        paidOn: string | null;
        allocations: {
            kind: "deposit" | "rent";
            amountRwf: number;
            label: string;
            periodStart: string | null;
            dueOn: string;
            chargeId: string;
        }[];
        recordedBy: string | null;
        leaseReference: string;
        allocatedRwf: number;
        creditRwf: number;
        statusWords: string;
        succeededAt: string | null;
        hasSlip: boolean;
        reversedAt: string | null;
        reverseReason: string | null;
    }, {
        status: "pending" | "expired" | "failed" | "succeeded" | "reversed";
        id: string;
        reference: string | null;
        payerMasked: string | null;
        amountRwf: number;
        expiresAt: string | null;
        failureReason: string | null;
        note: string | null;
        tenant: {
            id: string;
            fullName: string;
        };
        payout: {
            status: "held" | "failed" | "paid" | "scheduled" | "queued";
            id: string;
            failureReason: string | null;
            settledAt: string | null;
            destination: string | null;
        } | null;
        unit: {
            id: string;
            label: string;
            propertyName: string;
        };
        createdAt: string;
        leaseId: string;
        method: "other" | "mtn_momo" | "airtel_money" | "card" | "cash" | "bank_transfer";
        channel: "gateway" | "recorded";
        receiptNumber: string | null;
        paidOn: string | null;
        allocations: {
            kind: "deposit" | "rent";
            amountRwf: number;
            label: string;
            periodStart: string | null;
            dueOn: string;
            chargeId: string;
        }[];
        recordedBy: string | null;
        leaseReference: string;
        allocatedRwf: number;
        creditRwf: number;
        statusWords: string;
        succeededAt: string | null;
        hasSlip: boolean;
        reversedAt: string | null;
        reverseReason: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    payments: {
        status: "pending" | "expired" | "failed" | "succeeded" | "reversed";
        id: string;
        reference: string | null;
        payerMasked: string | null;
        amountRwf: number;
        expiresAt: string | null;
        failureReason: string | null;
        note: string | null;
        tenant: {
            id: string;
            fullName: string;
        };
        payout: {
            status: "held" | "failed" | "paid" | "scheduled" | "queued";
            id: string;
            failureReason: string | null;
            settledAt: string | null;
            destination: string | null;
        } | null;
        unit: {
            id: string;
            label: string;
            propertyName: string;
        };
        createdAt: string;
        leaseId: string;
        method: "other" | "mtn_momo" | "airtel_money" | "card" | "cash" | "bank_transfer";
        channel: "gateway" | "recorded";
        receiptNumber: string | null;
        paidOn: string | null;
        allocations: {
            kind: "deposit" | "rent";
            amountRwf: number;
            label: string;
            periodStart: string | null;
            dueOn: string;
            chargeId: string;
        }[];
        recordedBy: string | null;
        leaseReference: string;
        allocatedRwf: number;
        creditRwf: number;
        statusWords: string;
        succeededAt: string | null;
        hasSlip: boolean;
        reversedAt: string | null;
        reverseReason: string | null;
    }[];
}, {
    payments: {
        status: "pending" | "expired" | "failed" | "succeeded" | "reversed";
        id: string;
        reference: string | null;
        payerMasked: string | null;
        amountRwf: number;
        expiresAt: string | null;
        failureReason: string | null;
        note: string | null;
        tenant: {
            id: string;
            fullName: string;
        };
        payout: {
            status: "held" | "failed" | "paid" | "scheduled" | "queued";
            id: string;
            failureReason: string | null;
            settledAt: string | null;
            destination: string | null;
        } | null;
        unit: {
            id: string;
            label: string;
            propertyName: string;
        };
        createdAt: string;
        leaseId: string;
        method: "other" | "mtn_momo" | "airtel_money" | "card" | "cash" | "bank_transfer";
        channel: "gateway" | "recorded";
        receiptNumber: string | null;
        paidOn: string | null;
        allocations: {
            kind: "deposit" | "rent";
            amountRwf: number;
            label: string;
            periodStart: string | null;
            dueOn: string;
            chargeId: string;
        }[];
        recordedBy: string | null;
        leaseReference: string;
        allocatedRwf: number;
        creditRwf: number;
        statusWords: string;
        succeededAt: string | null;
        hasSlip: boolean;
        reversedAt: string | null;
        reverseReason: string | null;
    }[];
}>;
export type LeasePaymentList = z.infer<typeof LeasePaymentList>;
export declare const LeaseChargeList: z.ZodObject<{
    charges: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        leaseId: z.ZodString;
        kind: z.ZodEnum<["rent", "deposit"]>;
        /** "Rent for November 2026", "Deposit". */
        label: z.ZodString;
        periodStart: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
        periodEnd: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
        dueOn: z.ZodEffects<z.ZodString, string, string>;
        amountRwf: z.ZodNumber;
        paidRwf: z.ZodNumber;
        outstandingRwf: z.ZodNumber;
        status: z.ZodEnum<["open", "paid", "waived"]>;
        /** Open and past the due day plus the grace days, as of today. */
        overdue: z.ZodBoolean;
        /** Days past the due day when overdue; 0 otherwise. */
        daysOverdue: z.ZodNumber;
        waivedReason: z.ZodNullable<z.ZodString>;
        paidAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "open" | "paid" | "waived";
        id: string;
        kind: "deposit" | "rent";
        amountRwf: number;
        label: string;
        createdAt: string;
        periodStart: string | null;
        periodEnd: string | null;
        paidRwf: number;
        overdue: boolean;
        leaseId: string;
        paidAt: string | null;
        dueOn: string;
        outstandingRwf: number;
        daysOverdue: number;
        waivedReason: string | null;
    }, {
        status: "open" | "paid" | "waived";
        id: string;
        kind: "deposit" | "rent";
        amountRwf: number;
        label: string;
        createdAt: string;
        periodStart: string | null;
        periodEnd: string | null;
        paidRwf: number;
        overdue: boolean;
        leaseId: string;
        paidAt: string | null;
        dueOn: string;
        outstandingRwf: number;
        daysOverdue: number;
        waivedReason: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    charges: {
        status: "open" | "paid" | "waived";
        id: string;
        kind: "deposit" | "rent";
        amountRwf: number;
        label: string;
        createdAt: string;
        periodStart: string | null;
        periodEnd: string | null;
        paidRwf: number;
        overdue: boolean;
        leaseId: string;
        paidAt: string | null;
        dueOn: string;
        outstandingRwf: number;
        daysOverdue: number;
        waivedReason: string | null;
    }[];
}, {
    charges: {
        status: "open" | "paid" | "waived";
        id: string;
        kind: "deposit" | "rent";
        amountRwf: number;
        label: string;
        createdAt: string;
        periodStart: string | null;
        periodEnd: string | null;
        paidRwf: number;
        overdue: boolean;
        leaseId: string;
        paidAt: string | null;
        dueOn: string;
        outstandingRwf: number;
        daysOverdue: number;
        waivedReason: string | null;
    }[];
}>;
export type LeaseChargeList = z.infer<typeof LeaseChargeList>;
/** Where a month's rent stands on one lease. */
export declare const RentRollStatus: z.ZodEnum<["not_raised", "open", "partly_paid", "overdue", "paid", "waived"]>;
export type RentRollStatus = z.infer<typeof RentRollStatus>;
export declare const RENT_ROLL_STATUS_LABEL: Readonly<Record<RentRollStatus, string>>;
/** One lease on the rent roll of a month. */
export declare const RentRollRow: z.ZodObject<{
    lease: z.ZodObject<{
        id: z.ZodString;
        reference: z.ZodString;
        status: z.ZodEnum<["draft", "pending_signature", "signed", "active", "ending", "ended", "cancelled"]>;
        graceDays: z.ZodNumber;
        monthlyRentRwf: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
        id: string;
        reference: string;
        monthlyRentRwf: number;
        graceDays: number;
    }, {
        status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
        id: string;
        reference: string;
        monthlyRentRwf: number;
        graceDays: number;
    }>;
    tenant: z.ZodObject<{
        id: z.ZodString;
        fullName: z.ZodString;
        email: z.ZodNullable<z.ZodString>;
        phone: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        fullName: string;
        email: string | null;
        phone: string | null;
    }, {
        id: string;
        fullName: string;
        email: string | null;
        phone: string | null;
    }>;
    unit: z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        blockCode: z.ZodNullable<z.ZodString>;
        propertyName: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        label: string;
        propertyName: string;
        blockCode: string | null;
    }, {
        id: string;
        label: string;
        propertyName: string;
        blockCode: string | null;
    }>;
    /** The month's rent charge, once raised. */
    charge: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        leaseId: z.ZodString;
        kind: z.ZodEnum<["rent", "deposit"]>;
        /** "Rent for November 2026", "Deposit". */
        label: z.ZodString;
        periodStart: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
        periodEnd: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
        dueOn: z.ZodEffects<z.ZodString, string, string>;
        amountRwf: z.ZodNumber;
        paidRwf: z.ZodNumber;
        outstandingRwf: z.ZodNumber;
        status: z.ZodEnum<["open", "paid", "waived"]>;
        /** Open and past the due day plus the grace days, as of today. */
        overdue: z.ZodBoolean;
        /** Days past the due day when overdue; 0 otherwise. */
        daysOverdue: z.ZodNumber;
        waivedReason: z.ZodNullable<z.ZodString>;
        paidAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "open" | "paid" | "waived";
        id: string;
        kind: "deposit" | "rent";
        amountRwf: number;
        label: string;
        createdAt: string;
        periodStart: string | null;
        periodEnd: string | null;
        paidRwf: number;
        overdue: boolean;
        leaseId: string;
        paidAt: string | null;
        dueOn: string;
        outstandingRwf: number;
        daysOverdue: number;
        waivedReason: string | null;
    }, {
        status: "open" | "paid" | "waived";
        id: string;
        kind: "deposit" | "rent";
        amountRwf: number;
        label: string;
        createdAt: string;
        periodStart: string | null;
        periodEnd: string | null;
        paidRwf: number;
        overdue: boolean;
        leaseId: string;
        paidAt: string | null;
        dueOn: string;
        outstandingRwf: number;
        daysOverdue: number;
        waivedReason: string | null;
    }>>;
    /** What the month will charge when it is raised, or what it charged. */
    expectedRwf: z.ZodNumber;
    paidRwf: z.ZodNumber;
    outstandingRwf: z.ZodNumber;
    rollStatus: z.ZodEnum<["not_raised", "open", "partly_paid", "overdue", "paid", "waived"]>;
    daysOverdue: z.ZodNumber;
    lastPayment: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        amountRwf: z.ZodNumber;
        paidOn: z.ZodEffects<z.ZodString, string, string>;
        channel: z.ZodEnum<["gateway", "recorded"]>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        amountRwf: number;
        channel: "gateway" | "recorded";
        paidOn: string;
    }, {
        id: string;
        amountRwf: number;
        channel: "gateway" | "recorded";
        paidOn: string;
    }>>;
    lastReminder: z.ZodNullable<z.ZodObject<{
        kind: z.ZodEnum<["upcoming", "due", "overdue", "manual"]>;
        sentAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        kind: "due" | "overdue" | "upcoming" | "manual";
        sentAt: string;
    }, {
        kind: "due" | "overdue" | "upcoming" | "manual";
        sentAt: string;
    }>>;
}, "strip", z.ZodTypeAny, {
    lease: {
        status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
        id: string;
        reference: string;
        monthlyRentRwf: number;
        graceDays: number;
    };
    tenant: {
        id: string;
        fullName: string;
        email: string | null;
        phone: string | null;
    };
    unit: {
        id: string;
        label: string;
        propertyName: string;
        blockCode: string | null;
    };
    paidRwf: number;
    expectedRwf: number;
    outstandingRwf: number;
    daysOverdue: number;
    charge: {
        status: "open" | "paid" | "waived";
        id: string;
        kind: "deposit" | "rent";
        amountRwf: number;
        label: string;
        createdAt: string;
        periodStart: string | null;
        periodEnd: string | null;
        paidRwf: number;
        overdue: boolean;
        leaseId: string;
        paidAt: string | null;
        dueOn: string;
        outstandingRwf: number;
        daysOverdue: number;
        waivedReason: string | null;
    } | null;
    rollStatus: "open" | "paid" | "overdue" | "waived" | "not_raised" | "partly_paid";
    lastPayment: {
        id: string;
        amountRwf: number;
        channel: "gateway" | "recorded";
        paidOn: string;
    } | null;
    lastReminder: {
        kind: "due" | "overdue" | "upcoming" | "manual";
        sentAt: string;
    } | null;
}, {
    lease: {
        status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
        id: string;
        reference: string;
        monthlyRentRwf: number;
        graceDays: number;
    };
    tenant: {
        id: string;
        fullName: string;
        email: string | null;
        phone: string | null;
    };
    unit: {
        id: string;
        label: string;
        propertyName: string;
        blockCode: string | null;
    };
    paidRwf: number;
    expectedRwf: number;
    outstandingRwf: number;
    daysOverdue: number;
    charge: {
        status: "open" | "paid" | "waived";
        id: string;
        kind: "deposit" | "rent";
        amountRwf: number;
        label: string;
        createdAt: string;
        periodStart: string | null;
        periodEnd: string | null;
        paidRwf: number;
        overdue: boolean;
        leaseId: string;
        paidAt: string | null;
        dueOn: string;
        outstandingRwf: number;
        daysOverdue: number;
        waivedReason: string | null;
    } | null;
    rollStatus: "open" | "paid" | "overdue" | "waived" | "not_raised" | "partly_paid";
    lastPayment: {
        id: string;
        amountRwf: number;
        channel: "gateway" | "recorded";
        paidOn: string;
    } | null;
    lastReminder: {
        kind: "due" | "overdue" | "upcoming" | "manual";
        sentAt: string;
    } | null;
}>;
export type RentRollRow = z.infer<typeof RentRollRow>;
/** `GET /ops/rent/roll?month`: every live lease, with where the month's rent stands. */
export declare const RentRoll: z.ZodObject<{
    month: z.ZodString;
    today: z.ZodEffects<z.ZodString, string, string>;
    rows: z.ZodArray<z.ZodObject<{
        lease: z.ZodObject<{
            id: z.ZodString;
            reference: z.ZodString;
            status: z.ZodEnum<["draft", "pending_signature", "signed", "active", "ending", "ended", "cancelled"]>;
            graceDays: z.ZodNumber;
            monthlyRentRwf: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
            id: string;
            reference: string;
            monthlyRentRwf: number;
            graceDays: number;
        }, {
            status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
            id: string;
            reference: string;
            monthlyRentRwf: number;
            graceDays: number;
        }>;
        tenant: z.ZodObject<{
            id: z.ZodString;
            fullName: z.ZodString;
            email: z.ZodNullable<z.ZodString>;
            phone: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            fullName: string;
            email: string | null;
            phone: string | null;
        }, {
            id: string;
            fullName: string;
            email: string | null;
            phone: string | null;
        }>;
        unit: z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
            blockCode: z.ZodNullable<z.ZodString>;
            propertyName: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
            label: string;
            propertyName: string;
            blockCode: string | null;
        }, {
            id: string;
            label: string;
            propertyName: string;
            blockCode: string | null;
        }>;
        /** The month's rent charge, once raised. */
        charge: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            leaseId: z.ZodString;
            kind: z.ZodEnum<["rent", "deposit"]>;
            /** "Rent for November 2026", "Deposit". */
            label: z.ZodString;
            periodStart: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
            periodEnd: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
            dueOn: z.ZodEffects<z.ZodString, string, string>;
            amountRwf: z.ZodNumber;
            paidRwf: z.ZodNumber;
            outstandingRwf: z.ZodNumber;
            status: z.ZodEnum<["open", "paid", "waived"]>;
            /** Open and past the due day plus the grace days, as of today. */
            overdue: z.ZodBoolean;
            /** Days past the due day when overdue; 0 otherwise. */
            daysOverdue: z.ZodNumber;
            waivedReason: z.ZodNullable<z.ZodString>;
            paidAt: z.ZodNullable<z.ZodString>;
            createdAt: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            status: "open" | "paid" | "waived";
            id: string;
            kind: "deposit" | "rent";
            amountRwf: number;
            label: string;
            createdAt: string;
            periodStart: string | null;
            periodEnd: string | null;
            paidRwf: number;
            overdue: boolean;
            leaseId: string;
            paidAt: string | null;
            dueOn: string;
            outstandingRwf: number;
            daysOverdue: number;
            waivedReason: string | null;
        }, {
            status: "open" | "paid" | "waived";
            id: string;
            kind: "deposit" | "rent";
            amountRwf: number;
            label: string;
            createdAt: string;
            periodStart: string | null;
            periodEnd: string | null;
            paidRwf: number;
            overdue: boolean;
            leaseId: string;
            paidAt: string | null;
            dueOn: string;
            outstandingRwf: number;
            daysOverdue: number;
            waivedReason: string | null;
        }>>;
        /** What the month will charge when it is raised, or what it charged. */
        expectedRwf: z.ZodNumber;
        paidRwf: z.ZodNumber;
        outstandingRwf: z.ZodNumber;
        rollStatus: z.ZodEnum<["not_raised", "open", "partly_paid", "overdue", "paid", "waived"]>;
        daysOverdue: z.ZodNumber;
        lastPayment: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            amountRwf: z.ZodNumber;
            paidOn: z.ZodEffects<z.ZodString, string, string>;
            channel: z.ZodEnum<["gateway", "recorded"]>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            amountRwf: number;
            channel: "gateway" | "recorded";
            paidOn: string;
        }, {
            id: string;
            amountRwf: number;
            channel: "gateway" | "recorded";
            paidOn: string;
        }>>;
        lastReminder: z.ZodNullable<z.ZodObject<{
            kind: z.ZodEnum<["upcoming", "due", "overdue", "manual"]>;
            sentAt: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            kind: "due" | "overdue" | "upcoming" | "manual";
            sentAt: string;
        }, {
            kind: "due" | "overdue" | "upcoming" | "manual";
            sentAt: string;
        }>>;
    }, "strip", z.ZodTypeAny, {
        lease: {
            status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
            id: string;
            reference: string;
            monthlyRentRwf: number;
            graceDays: number;
        };
        tenant: {
            id: string;
            fullName: string;
            email: string | null;
            phone: string | null;
        };
        unit: {
            id: string;
            label: string;
            propertyName: string;
            blockCode: string | null;
        };
        paidRwf: number;
        expectedRwf: number;
        outstandingRwf: number;
        daysOverdue: number;
        charge: {
            status: "open" | "paid" | "waived";
            id: string;
            kind: "deposit" | "rent";
            amountRwf: number;
            label: string;
            createdAt: string;
            periodStart: string | null;
            periodEnd: string | null;
            paidRwf: number;
            overdue: boolean;
            leaseId: string;
            paidAt: string | null;
            dueOn: string;
            outstandingRwf: number;
            daysOverdue: number;
            waivedReason: string | null;
        } | null;
        rollStatus: "open" | "paid" | "overdue" | "waived" | "not_raised" | "partly_paid";
        lastPayment: {
            id: string;
            amountRwf: number;
            channel: "gateway" | "recorded";
            paidOn: string;
        } | null;
        lastReminder: {
            kind: "due" | "overdue" | "upcoming" | "manual";
            sentAt: string;
        } | null;
    }, {
        lease: {
            status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
            id: string;
            reference: string;
            monthlyRentRwf: number;
            graceDays: number;
        };
        tenant: {
            id: string;
            fullName: string;
            email: string | null;
            phone: string | null;
        };
        unit: {
            id: string;
            label: string;
            propertyName: string;
            blockCode: string | null;
        };
        paidRwf: number;
        expectedRwf: number;
        outstandingRwf: number;
        daysOverdue: number;
        charge: {
            status: "open" | "paid" | "waived";
            id: string;
            kind: "deposit" | "rent";
            amountRwf: number;
            label: string;
            createdAt: string;
            periodStart: string | null;
            periodEnd: string | null;
            paidRwf: number;
            overdue: boolean;
            leaseId: string;
            paidAt: string | null;
            dueOn: string;
            outstandingRwf: number;
            daysOverdue: number;
            waivedReason: string | null;
        } | null;
        rollStatus: "open" | "paid" | "overdue" | "waived" | "not_raised" | "partly_paid";
        lastPayment: {
            id: string;
            amountRwf: number;
            channel: "gateway" | "recorded";
            paidOn: string;
        } | null;
        lastReminder: {
            kind: "due" | "overdue" | "upcoming" | "manual";
            sentAt: string;
        } | null;
    }>, "many">;
    totals: z.ZodObject<{
        leases: z.ZodNumber;
        expectedRwf: z.ZodNumber;
        collectedRwf: z.ZodNumber;
        outstandingRwf: z.ZodNumber;
        overdueRwf: z.ZodNumber;
        overdueLeases: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        leases: number;
        overdueRwf: number;
        expectedRwf: number;
        collectedRwf: number;
        outstandingRwf: number;
        overdueLeases: number;
    }, {
        leases: number;
        overdueRwf: number;
        expectedRwf: number;
        collectedRwf: number;
        outstandingRwf: number;
        overdueLeases: number;
    }>;
}, "strip", z.ZodTypeAny, {
    totals: {
        leases: number;
        overdueRwf: number;
        expectedRwf: number;
        collectedRwf: number;
        outstandingRwf: number;
        overdueLeases: number;
    };
    month: string;
    today: string;
    rows: {
        lease: {
            status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
            id: string;
            reference: string;
            monthlyRentRwf: number;
            graceDays: number;
        };
        tenant: {
            id: string;
            fullName: string;
            email: string | null;
            phone: string | null;
        };
        unit: {
            id: string;
            label: string;
            propertyName: string;
            blockCode: string | null;
        };
        paidRwf: number;
        expectedRwf: number;
        outstandingRwf: number;
        daysOverdue: number;
        charge: {
            status: "open" | "paid" | "waived";
            id: string;
            kind: "deposit" | "rent";
            amountRwf: number;
            label: string;
            createdAt: string;
            periodStart: string | null;
            periodEnd: string | null;
            paidRwf: number;
            overdue: boolean;
            leaseId: string;
            paidAt: string | null;
            dueOn: string;
            outstandingRwf: number;
            daysOverdue: number;
            waivedReason: string | null;
        } | null;
        rollStatus: "open" | "paid" | "overdue" | "waived" | "not_raised" | "partly_paid";
        lastPayment: {
            id: string;
            amountRwf: number;
            channel: "gateway" | "recorded";
            paidOn: string;
        } | null;
        lastReminder: {
            kind: "due" | "overdue" | "upcoming" | "manual";
            sentAt: string;
        } | null;
    }[];
}, {
    totals: {
        leases: number;
        overdueRwf: number;
        expectedRwf: number;
        collectedRwf: number;
        outstandingRwf: number;
        overdueLeases: number;
    };
    month: string;
    today: string;
    rows: {
        lease: {
            status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
            id: string;
            reference: string;
            monthlyRentRwf: number;
            graceDays: number;
        };
        tenant: {
            id: string;
            fullName: string;
            email: string | null;
            phone: string | null;
        };
        unit: {
            id: string;
            label: string;
            propertyName: string;
            blockCode: string | null;
        };
        paidRwf: number;
        expectedRwf: number;
        outstandingRwf: number;
        daysOverdue: number;
        charge: {
            status: "open" | "paid" | "waived";
            id: string;
            kind: "deposit" | "rent";
            amountRwf: number;
            label: string;
            createdAt: string;
            periodStart: string | null;
            periodEnd: string | null;
            paidRwf: number;
            overdue: boolean;
            leaseId: string;
            paidAt: string | null;
            dueOn: string;
            outstandingRwf: number;
            daysOverdue: number;
            waivedReason: string | null;
        } | null;
        rollStatus: "open" | "paid" | "overdue" | "waived" | "not_raised" | "partly_paid";
        lastPayment: {
            id: string;
            amountRwf: number;
            channel: "gateway" | "recorded";
            paidOn: string;
        } | null;
        lastReminder: {
            kind: "due" | "overdue" | "upcoming" | "manual";
            sentAt: string;
        } | null;
    }[];
}>;
export type RentRoll = z.infer<typeof RentRoll>;
/** `GET /ops/rent/summary?month`: the month's figures the Rent screen and the home read. */
export declare const RentSummary: z.ZodObject<{
    month: z.ZodString;
    today: z.ZodEffects<z.ZodString, string, string>;
    /** Rent charges due in the month, not waived. */
    expectedRwf: z.ZodNumber;
    /** Rent paid in the month: allocations of payments that arrived in it. */
    collectedRwf: z.ZodNumber;
    /** What the month's rent charges still owe. */
    outstandingRwf: z.ZodNumber;
    /** Open rent (any month) past its due day plus the grace days today. */
    overdueRwf: z.ZodNumber;
    overdueCharges: z.ZodNumber;
    /** Deposits paid in the month. */
    depositsCollectedRwf: z.ZodNumber;
    /** Gateway payments waiting on a phone right now. */
    pendingRwf: z.ZodNumber;
    /** Payouts settled in the month, and those still held for want of an account. */
    paidOutRwf: z.ZodNumber;
    heldRwf: z.ZodNumber;
    /** Tenants' credit: paid and not yet applied to a charge. */
    creditHeldRwf: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    pendingRwf: number;
    month: string;
    today: string;
    overdueRwf: number;
    overdueCharges: number;
    expectedRwf: number;
    collectedRwf: number;
    outstandingRwf: number;
    depositsCollectedRwf: number;
    paidOutRwf: number;
    heldRwf: number;
    creditHeldRwf: number;
}, {
    pendingRwf: number;
    month: string;
    today: string;
    overdueRwf: number;
    overdueCharges: number;
    expectedRwf: number;
    collectedRwf: number;
    outstandingRwf: number;
    depositsCollectedRwf: number;
    paidOutRwf: number;
    heldRwf: number;
    creditHeldRwf: number;
}>;
export type RentSummary = z.infer<typeof RentSummary>;
/** One reminder, as sent. */
export declare const LeaseReminderView: z.ZodObject<{
    id: z.ZodString;
    leaseId: z.ZodString;
    leaseReference: z.ZodString;
    tenantName: z.ZodString;
    chargeId: z.ZodNullable<z.ZodString>;
    chargeLabel: z.ZodNullable<z.ZodString>;
    kind: z.ZodEnum<["upcoming", "due", "overdue", "manual"]>;
    stage: z.ZodNumber;
    channel: z.ZodEnum<["in_app", "email", "in_app_email", "sms", "call", "letter"]>;
    note: z.ZodString;
    sentBy: z.ZodNullable<z.ZodString>;
    sentAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    kind: "due" | "overdue" | "upcoming" | "manual";
    stage: number;
    note: string;
    leaseId: string;
    tenantName: string;
    channel: "email" | "sms" | "in_app" | "in_app_email" | "call" | "letter";
    sentAt: string;
    chargeId: string | null;
    leaseReference: string;
    chargeLabel: string | null;
    sentBy: string | null;
}, {
    id: string;
    kind: "due" | "overdue" | "upcoming" | "manual";
    stage: number;
    note: string;
    leaseId: string;
    tenantName: string;
    channel: "email" | "sms" | "in_app" | "in_app_email" | "call" | "letter";
    sentAt: string;
    chargeId: string | null;
    leaseReference: string;
    chargeLabel: string | null;
    sentBy: string | null;
}>;
export type LeaseReminderView = z.infer<typeof LeaseReminderView>;
export declare const LeaseReminderList: z.ZodObject<{
    reminders: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        leaseId: z.ZodString;
        leaseReference: z.ZodString;
        tenantName: z.ZodString;
        chargeId: z.ZodNullable<z.ZodString>;
        chargeLabel: z.ZodNullable<z.ZodString>;
        kind: z.ZodEnum<["upcoming", "due", "overdue", "manual"]>;
        stage: z.ZodNumber;
        channel: z.ZodEnum<["in_app", "email", "in_app_email", "sms", "call", "letter"]>;
        note: z.ZodString;
        sentBy: z.ZodNullable<z.ZodString>;
        sentAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        kind: "due" | "overdue" | "upcoming" | "manual";
        stage: number;
        note: string;
        leaseId: string;
        tenantName: string;
        channel: "email" | "sms" | "in_app" | "in_app_email" | "call" | "letter";
        sentAt: string;
        chargeId: string | null;
        leaseReference: string;
        chargeLabel: string | null;
        sentBy: string | null;
    }, {
        id: string;
        kind: "due" | "overdue" | "upcoming" | "manual";
        stage: number;
        note: string;
        leaseId: string;
        tenantName: string;
        channel: "email" | "sms" | "in_app" | "in_app_email" | "call" | "letter";
        sentAt: string;
        chargeId: string | null;
        leaseReference: string;
        chargeLabel: string | null;
        sentBy: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    reminders: {
        id: string;
        kind: "due" | "overdue" | "upcoming" | "manual";
        stage: number;
        note: string;
        leaseId: string;
        tenantName: string;
        channel: "email" | "sms" | "in_app" | "in_app_email" | "call" | "letter";
        sentAt: string;
        chargeId: string | null;
        leaseReference: string;
        chargeLabel: string | null;
        sentBy: string | null;
    }[];
}, {
    reminders: {
        id: string;
        kind: "due" | "overdue" | "upcoming" | "manual";
        stage: number;
        note: string;
        leaseId: string;
        tenantName: string;
        channel: "email" | "sms" | "in_app" | "in_app_email" | "call" | "letter";
        sentAt: string;
        chargeId: string | null;
        leaseReference: string;
        chargeLabel: string | null;
        sentBy: string | null;
    }[];
}>;
export type LeaseReminderList = z.infer<typeof LeaseReminderList>;
/** What `POST /ops/rent/reminders` did with each charge. */
export declare const RemindersSent: z.ZodObject<{
    sent: z.ZodArray<z.ZodObject<{
        chargeId: z.ZodString;
        reminderId: z.ZodString;
        emailedTo: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        chargeId: string;
        reminderId: string;
        emailedTo: string | null;
    }, {
        chargeId: string;
        reminderId: string;
        emailedTo: string | null;
    }>, "many">;
    skipped: z.ZodArray<z.ZodObject<{
        chargeId: z.ZodString;
        reason: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        reason: string;
        chargeId: string;
    }, {
        reason: string;
        chargeId: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    sent: {
        chargeId: string;
        reminderId: string;
        emailedTo: string | null;
    }[];
    skipped: {
        reason: string;
        chargeId: string;
    }[];
}, {
    sent: {
        chargeId: string;
        reminderId: string;
        emailedTo: string | null;
    }[];
    skipped: {
        reason: string;
        chargeId: string;
    }[];
}>;
export type RemindersSent = z.infer<typeof RemindersSent>;
/** One payout to the landlord. */
export declare const PayoutView: z.ZodObject<{
    id: z.ZodString;
    status: z.ZodEnum<["scheduled", "queued", "paid", "held", "failed"]>;
    statusLabel: z.ZodString;
    amountRwf: z.ZodNumber;
    /** "MTN MoMo 078•••••456"; null while held with no account. */
    destination: z.ZodNullable<z.ZodString>;
    accountKind: z.ZodNullable<z.ZodEnum<["bank", "momo", "momo_pay"]>>;
    payeeName: z.ZodNullable<z.ZodString>;
    payment: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        leaseId: z.ZodString;
        leaseReference: z.ZodString;
        tenantName: z.ZodString;
        receiptNumber: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        leaseId: string;
        tenantName: string;
        receiptNumber: string | null;
        leaseReference: string;
    }, {
        id: string;
        leaseId: string;
        tenantName: string;
        receiptNumber: string | null;
        leaseReference: string;
    }>>;
    failureReason: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    settledAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "held" | "failed" | "paid" | "scheduled" | "queued";
    id: string;
    amountRwf: number;
    failureReason: string | null;
    payment: {
        id: string;
        leaseId: string;
        tenantName: string;
        receiptNumber: string | null;
        leaseReference: string;
    } | null;
    createdAt: string;
    settledAt: string | null;
    destination: string | null;
    statusLabel: string;
    accountKind: "bank" | "momo" | "momo_pay" | null;
    payeeName: string | null;
}, {
    status: "held" | "failed" | "paid" | "scheduled" | "queued";
    id: string;
    amountRwf: number;
    failureReason: string | null;
    payment: {
        id: string;
        leaseId: string;
        tenantName: string;
        receiptNumber: string | null;
        leaseReference: string;
    } | null;
    createdAt: string;
    settledAt: string | null;
    destination: string | null;
    statusLabel: string;
    accountKind: "bank" | "momo" | "momo_pay" | null;
    payeeName: string | null;
}>;
export type PayoutView = z.infer<typeof PayoutView>;
export declare const PayoutList: z.ZodObject<{
    payouts: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        status: z.ZodEnum<["scheduled", "queued", "paid", "held", "failed"]>;
        statusLabel: z.ZodString;
        amountRwf: z.ZodNumber;
        /** "MTN MoMo 078•••••456"; null while held with no account. */
        destination: z.ZodNullable<z.ZodString>;
        accountKind: z.ZodNullable<z.ZodEnum<["bank", "momo", "momo_pay"]>>;
        payeeName: z.ZodNullable<z.ZodString>;
        payment: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            leaseId: z.ZodString;
            leaseReference: z.ZodString;
            tenantName: z.ZodString;
            receiptNumber: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            leaseId: string;
            tenantName: string;
            receiptNumber: string | null;
            leaseReference: string;
        }, {
            id: string;
            leaseId: string;
            tenantName: string;
            receiptNumber: string | null;
            leaseReference: string;
        }>>;
        failureReason: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        settledAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "held" | "failed" | "paid" | "scheduled" | "queued";
        id: string;
        amountRwf: number;
        failureReason: string | null;
        payment: {
            id: string;
            leaseId: string;
            tenantName: string;
            receiptNumber: string | null;
            leaseReference: string;
        } | null;
        createdAt: string;
        settledAt: string | null;
        destination: string | null;
        statusLabel: string;
        accountKind: "bank" | "momo" | "momo_pay" | null;
        payeeName: string | null;
    }, {
        status: "held" | "failed" | "paid" | "scheduled" | "queued";
        id: string;
        amountRwf: number;
        failureReason: string | null;
        payment: {
            id: string;
            leaseId: string;
            tenantName: string;
            receiptNumber: string | null;
            leaseReference: string;
        } | null;
        createdAt: string;
        settledAt: string | null;
        destination: string | null;
        statusLabel: string;
        accountKind: "bank" | "momo" | "momo_pay" | null;
        payeeName: string | null;
    }>, "many">;
    totals: z.ZodObject<{
        queuedRwf: z.ZodNumber;
        heldRwf: z.ZodNumber;
        paidRwf: z.ZodNumber;
        failedRwf: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        paidRwf: number;
        queuedRwf: number;
        heldRwf: number;
        failedRwf: number;
    }, {
        paidRwf: number;
        queuedRwf: number;
        heldRwf: number;
        failedRwf: number;
    }>;
}, "strip", z.ZodTypeAny, {
    payouts: {
        status: "held" | "failed" | "paid" | "scheduled" | "queued";
        id: string;
        amountRwf: number;
        failureReason: string | null;
        payment: {
            id: string;
            leaseId: string;
            tenantName: string;
            receiptNumber: string | null;
            leaseReference: string;
        } | null;
        createdAt: string;
        settledAt: string | null;
        destination: string | null;
        statusLabel: string;
        accountKind: "bank" | "momo" | "momo_pay" | null;
        payeeName: string | null;
    }[];
    totals: {
        paidRwf: number;
        queuedRwf: number;
        heldRwf: number;
        failedRwf: number;
    };
}, {
    payouts: {
        status: "held" | "failed" | "paid" | "scheduled" | "queued";
        id: string;
        amountRwf: number;
        failureReason: string | null;
        payment: {
            id: string;
            leaseId: string;
            tenantName: string;
            receiptNumber: string | null;
            leaseReference: string;
        } | null;
        createdAt: string;
        settledAt: string | null;
        destination: string | null;
        statusLabel: string;
        accountKind: "bank" | "momo" | "momo_pay" | null;
        payeeName: string | null;
    }[];
    totals: {
        paidRwf: number;
        queuedRwf: number;
        heldRwf: number;
        failedRwf: number;
    };
}>;
export type PayoutList = z.infer<typeof PayoutList>;
/** `GET /me/tenancies/:leaseId/charges`: what the tenant owes. */
export declare const TenantChargeList: z.ZodObject<{
    charges: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        leaseId: z.ZodString;
        kind: z.ZodEnum<["rent", "deposit"]>;
        /** "Rent for November 2026", "Deposit". */
        label: z.ZodString;
        periodStart: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
        periodEnd: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
        dueOn: z.ZodEffects<z.ZodString, string, string>;
        amountRwf: z.ZodNumber;
        paidRwf: z.ZodNumber;
        outstandingRwf: z.ZodNumber;
        status: z.ZodEnum<["open", "paid", "waived"]>;
        /** Open and past the due day plus the grace days, as of today. */
        overdue: z.ZodBoolean;
        /** Days past the due day when overdue; 0 otherwise. */
        daysOverdue: z.ZodNumber;
        waivedReason: z.ZodNullable<z.ZodString>;
        paidAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "open" | "paid" | "waived";
        id: string;
        kind: "deposit" | "rent";
        amountRwf: number;
        label: string;
        createdAt: string;
        periodStart: string | null;
        periodEnd: string | null;
        paidRwf: number;
        overdue: boolean;
        leaseId: string;
        paidAt: string | null;
        dueOn: string;
        outstandingRwf: number;
        daysOverdue: number;
        waivedReason: string | null;
    }, {
        status: "open" | "paid" | "waived";
        id: string;
        kind: "deposit" | "rent";
        amountRwf: number;
        label: string;
        createdAt: string;
        periodStart: string | null;
        periodEnd: string | null;
        paidRwf: number;
        overdue: boolean;
        leaseId: string;
        paidAt: string | null;
        dueOn: string;
        outstandingRwf: number;
        daysOverdue: number;
        waivedReason: string | null;
    }>, "many">;
    outstandingRwf: z.ZodNumber;
    overdueRwf: z.ZodNumber;
    /** Paid ahead and not yet used on a charge. */
    creditRwf: z.ZodNumber;
    /** A gateway payment still waiting on the phone, if any. */
    pendingPaymentId: z.ZodNullable<z.ZodString>;
    /** The most the tenant may pay now (everything owed plus one month as credit); 0 when nothing is owed. */
    maxPaymentRwf: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    charges: {
        status: "open" | "paid" | "waived";
        id: string;
        kind: "deposit" | "rent";
        amountRwf: number;
        label: string;
        createdAt: string;
        periodStart: string | null;
        periodEnd: string | null;
        paidRwf: number;
        overdue: boolean;
        leaseId: string;
        paidAt: string | null;
        dueOn: string;
        outstandingRwf: number;
        daysOverdue: number;
        waivedReason: string | null;
    }[];
    overdueRwf: number;
    outstandingRwf: number;
    creditRwf: number;
    pendingPaymentId: string | null;
    maxPaymentRwf: number;
}, {
    charges: {
        status: "open" | "paid" | "waived";
        id: string;
        kind: "deposit" | "rent";
        amountRwf: number;
        label: string;
        createdAt: string;
        periodStart: string | null;
        periodEnd: string | null;
        paidRwf: number;
        overdue: boolean;
        leaseId: string;
        paidAt: string | null;
        dueOn: string;
        outstandingRwf: number;
        daysOverdue: number;
        waivedReason: string | null;
    }[];
    overdueRwf: number;
    outstandingRwf: number;
    creditRwf: number;
    pendingPaymentId: string | null;
    maxPaymentRwf: number;
}>;
export type TenantChargeList = z.infer<typeof TenantChargeList>;
/** One payment as the tenant sees it; `POST .../payments` and the poll answer this. */
export declare const TenantPaymentView: z.ZodObject<{
    id: z.ZodString;
    leaseId: z.ZodString;
    channel: z.ZodEnum<["gateway", "recorded"]>;
    method: z.ZodEnum<["mtn_momo", "airtel_money", "card", "bank_transfer", "cash", "other"]>;
    amountRwf: z.ZodNumber;
    status: z.ZodEnum<["pending", "succeeded", "failed", "expired", "reversed"]>;
    statusWords: z.ZodString;
    payerMasked: z.ZodNullable<z.ZodString>;
    reference: z.ZodNullable<z.ZodString>;
    receiptNumber: z.ZodNullable<z.ZodString>;
    /** A receipt PDF can be downloaded. */
    receiptReady: z.ZodBoolean;
    failureReason: z.ZodNullable<z.ZodString>;
    allocations: z.ZodArray<z.ZodObject<{
        chargeId: z.ZodString;
        kind: z.ZodEnum<["rent", "deposit"]>;
        label: z.ZodString;
        periodStart: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
        dueOn: z.ZodEffects<z.ZodString, string, string>;
        amountRwf: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        kind: "deposit" | "rent";
        amountRwf: number;
        label: string;
        periodStart: string | null;
        dueOn: string;
        chargeId: string;
    }, {
        kind: "deposit" | "rent";
        amountRwf: number;
        label: string;
        periodStart: string | null;
        dueOn: string;
        chargeId: string;
    }>, "many">;
    creditRwf: z.ZodNumber;
    paidOn: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
    expiresAt: z.ZodNullable<z.ZodString>;
    succeededAt: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "pending" | "expired" | "failed" | "succeeded" | "reversed";
    id: string;
    reference: string | null;
    payerMasked: string | null;
    amountRwf: number;
    expiresAt: string | null;
    failureReason: string | null;
    createdAt: string;
    leaseId: string;
    method: "other" | "mtn_momo" | "airtel_money" | "card" | "cash" | "bank_transfer";
    channel: "gateway" | "recorded";
    receiptNumber: string | null;
    paidOn: string | null;
    allocations: {
        kind: "deposit" | "rent";
        amountRwf: number;
        label: string;
        periodStart: string | null;
        dueOn: string;
        chargeId: string;
    }[];
    creditRwf: number;
    statusWords: string;
    succeededAt: string | null;
    receiptReady: boolean;
}, {
    status: "pending" | "expired" | "failed" | "succeeded" | "reversed";
    id: string;
    reference: string | null;
    payerMasked: string | null;
    amountRwf: number;
    expiresAt: string | null;
    failureReason: string | null;
    createdAt: string;
    leaseId: string;
    method: "other" | "mtn_momo" | "airtel_money" | "card" | "cash" | "bank_transfer";
    channel: "gateway" | "recorded";
    receiptNumber: string | null;
    paidOn: string | null;
    allocations: {
        kind: "deposit" | "rent";
        amountRwf: number;
        label: string;
        periodStart: string | null;
        dueOn: string;
        chargeId: string;
    }[];
    creditRwf: number;
    statusWords: string;
    succeededAt: string | null;
    receiptReady: boolean;
}>;
export type TenantPaymentView = z.infer<typeof TenantPaymentView>;
export declare const TenantPaymentList: z.ZodObject<{
    payments: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        leaseId: z.ZodString;
        channel: z.ZodEnum<["gateway", "recorded"]>;
        method: z.ZodEnum<["mtn_momo", "airtel_money", "card", "bank_transfer", "cash", "other"]>;
        amountRwf: z.ZodNumber;
        status: z.ZodEnum<["pending", "succeeded", "failed", "expired", "reversed"]>;
        statusWords: z.ZodString;
        payerMasked: z.ZodNullable<z.ZodString>;
        reference: z.ZodNullable<z.ZodString>;
        receiptNumber: z.ZodNullable<z.ZodString>;
        /** A receipt PDF can be downloaded. */
        receiptReady: z.ZodBoolean;
        failureReason: z.ZodNullable<z.ZodString>;
        allocations: z.ZodArray<z.ZodObject<{
            chargeId: z.ZodString;
            kind: z.ZodEnum<["rent", "deposit"]>;
            label: z.ZodString;
            periodStart: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
            dueOn: z.ZodEffects<z.ZodString, string, string>;
            amountRwf: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            kind: "deposit" | "rent";
            amountRwf: number;
            label: string;
            periodStart: string | null;
            dueOn: string;
            chargeId: string;
        }, {
            kind: "deposit" | "rent";
            amountRwf: number;
            label: string;
            periodStart: string | null;
            dueOn: string;
            chargeId: string;
        }>, "many">;
        creditRwf: z.ZodNumber;
        paidOn: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
        expiresAt: z.ZodNullable<z.ZodString>;
        succeededAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "pending" | "expired" | "failed" | "succeeded" | "reversed";
        id: string;
        reference: string | null;
        payerMasked: string | null;
        amountRwf: number;
        expiresAt: string | null;
        failureReason: string | null;
        createdAt: string;
        leaseId: string;
        method: "other" | "mtn_momo" | "airtel_money" | "card" | "cash" | "bank_transfer";
        channel: "gateway" | "recorded";
        receiptNumber: string | null;
        paidOn: string | null;
        allocations: {
            kind: "deposit" | "rent";
            amountRwf: number;
            label: string;
            periodStart: string | null;
            dueOn: string;
            chargeId: string;
        }[];
        creditRwf: number;
        statusWords: string;
        succeededAt: string | null;
        receiptReady: boolean;
    }, {
        status: "pending" | "expired" | "failed" | "succeeded" | "reversed";
        id: string;
        reference: string | null;
        payerMasked: string | null;
        amountRwf: number;
        expiresAt: string | null;
        failureReason: string | null;
        createdAt: string;
        leaseId: string;
        method: "other" | "mtn_momo" | "airtel_money" | "card" | "cash" | "bank_transfer";
        channel: "gateway" | "recorded";
        receiptNumber: string | null;
        paidOn: string | null;
        allocations: {
            kind: "deposit" | "rent";
            amountRwf: number;
            label: string;
            periodStart: string | null;
            dueOn: string;
            chargeId: string;
        }[];
        creditRwf: number;
        statusWords: string;
        succeededAt: string | null;
        receiptReady: boolean;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    payments: {
        status: "pending" | "expired" | "failed" | "succeeded" | "reversed";
        id: string;
        reference: string | null;
        payerMasked: string | null;
        amountRwf: number;
        expiresAt: string | null;
        failureReason: string | null;
        createdAt: string;
        leaseId: string;
        method: "other" | "mtn_momo" | "airtel_money" | "card" | "cash" | "bank_transfer";
        channel: "gateway" | "recorded";
        receiptNumber: string | null;
        paidOn: string | null;
        allocations: {
            kind: "deposit" | "rent";
            amountRwf: number;
            label: string;
            periodStart: string | null;
            dueOn: string;
            chargeId: string;
        }[];
        creditRwf: number;
        statusWords: string;
        succeededAt: string | null;
        receiptReady: boolean;
    }[];
}, {
    payments: {
        status: "pending" | "expired" | "failed" | "succeeded" | "reversed";
        id: string;
        reference: string | null;
        payerMasked: string | null;
        amountRwf: number;
        expiresAt: string | null;
        failureReason: string | null;
        createdAt: string;
        leaseId: string;
        method: "other" | "mtn_momo" | "airtel_money" | "card" | "cash" | "bank_transfer";
        channel: "gateway" | "recorded";
        receiptNumber: string | null;
        paidOn: string | null;
        allocations: {
            kind: "deposit" | "rent";
            amountRwf: number;
            label: string;
            periodStart: string | null;
            dueOn: string;
            chargeId: string;
        }[];
        creditRwf: number;
        statusWords: string;
        succeededAt: string | null;
        receiptReady: boolean;
    }[];
}>;
export type TenantPaymentList = z.infer<typeof TenantPaymentList>;
/** The month `today` falls in, for the queries that default to it. */
export declare function currentMonthKey(today?: string): string;
//# sourceMappingURL=rent.d.ts.map