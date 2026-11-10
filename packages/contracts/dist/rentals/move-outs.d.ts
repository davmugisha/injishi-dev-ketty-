import { z } from "zod";
import { type NoticeLease } from "./dates";
import { DepositRefundMethod, LeaseStatus, MoveOutNoticeChannel, MoveOutNoticeStatus } from "./vocab";
/** A notice still to be acknowledged nudges the landlord once after this many days. */
export declare const NOTICE_NUDGE_AFTER_DAYS = 3;
/** RRA asks the landlord to tell the district within 30 days when a lease ends. */
export declare const TERMINATION_FILING_DAYS = 30;
/** The day the district should hear that a lease ended on `endedOn`. */
export declare function terminationFilingDueOn(endedOn: string): string;
/** The reasons a tenant picks from. The landlord's own reasons are for notices they give. */
export declare const TENANT_MOVE_OUT_REASONS: readonly ["moving_in_kigali", "leaving_kigali", "own_home", "cost", "terms", "other"];
/** How a notice the landlord records reached them. A notice on Injishi is the tenant's own. */
export declare const RecordedNoticeChannel: z.ZodEnum<["letter", "email", "in_person"]>;
export type RecordedNoticeChannel = z.infer<typeof RecordedNoticeChannel>;
export declare const NOTICE_CHANNEL_LABEL: Readonly<Record<MoveOutNoticeChannel, string>>;
/** `POST /me/tenancies/:leaseId/notice`: the tenant gives notice. The day is checked against the lease. */
export declare const TenantNoticeRequest: z.ZodObject<{
    moveOutOn: z.ZodEffects<z.ZodString, string, string>;
    reasonCode: z.ZodEnum<["moving_in_kigali", "leaving_kigali", "own_home", "cost", "terms", "other"]>;
    message: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
}, "strip", z.ZodTypeAny, {
    reasonCode: "other" | "moving_in_kigali" | "leaving_kigali" | "own_home" | "cost" | "terms";
    moveOutOn: string;
    message?: string | undefined;
}, {
    reasonCode: "other" | "moving_in_kigali" | "leaving_kigali" | "own_home" | "cost" | "terms";
    moveOutOn: string;
    message?: string | undefined;
}>;
export type TenantNoticeRequest = z.infer<typeof TenantNoticeRequest>;
/**
 * `POST /ops/leases/:id/notice`: a notice that reached the landlord outside
 * Injishi (a letter, an email, in person), or one the landlord gives. The day
 * it was given is from the lease's start to today; the move out day after it
 * and no later than the lease's last day. Less than the lease's notice days
 * is kept, marked short.
 */
export declare const RecordedNoticeRequest: z.ZodObject<{
    givenBy: z.ZodDefault<z.ZodEnum<["landlord", "tenant"]>>;
    channel: z.ZodEnum<["letter", "email", "in_person"]>;
    filedOn: z.ZodEffects<z.ZodString, string, string>;
    moveOutOn: z.ZodEffects<z.ZodString, string, string>;
    reasonCode: z.ZodEnum<["moving_in_kigali", "leaving_kigali", "own_home", "cost", "terms", "landlord_use", "tenant_breach", "other"]>;
    message: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
}, "strip", z.ZodTypeAny, {
    reasonCode: "other" | "moving_in_kigali" | "leaving_kigali" | "own_home" | "cost" | "terms" | "landlord_use" | "tenant_breach";
    channel: "email" | "letter" | "in_person";
    moveOutOn: string;
    givenBy: "landlord" | "tenant";
    filedOn: string;
    message?: string | undefined;
}, {
    reasonCode: "other" | "moving_in_kigali" | "leaving_kigali" | "own_home" | "cost" | "terms" | "landlord_use" | "tenant_breach";
    channel: "email" | "letter" | "in_person";
    moveOutOn: string;
    filedOn: string;
    message?: string | undefined;
    givenBy?: "landlord" | "tenant" | undefined;
}>;
export type RecordedNoticeRequest = z.input<typeof RecordedNoticeRequest>;
/** `POST /ops/leases/:id/move-out`: the day the tenant actually left. Today or earlier, never before the start. */
export declare const RecordMoveOutRequest: z.ZodObject<{
    movedOutOn: z.ZodEffects<z.ZodString, string, string>;
    note: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
}, "strip", z.ZodTypeAny, {
    movedOutOn: string;
    note?: string | undefined;
}, {
    movedOutOn: string;
    note?: string | undefined;
}>;
export type RecordMoveOutRequest = z.infer<typeof RecordMoveOutRequest>;
/** One thing the landlord keeps part of the deposit for. */
export declare const DepositDeduction: z.ZodObject<{
    label: z.ZodString;
    amountRwf: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    amountRwf: number;
    label: string;
}, {
    amountRwf: number;
    label: string;
}>;
export type DepositDeduction = z.infer<typeof DepositDeduction>;
/** How the refund goes back. */
export declare const DepositRefund: z.ZodDiscriminatedUnion<"method", [z.ZodObject<{
    method: z.ZodLiteral<"gateway">;
    tenantPhone: z.ZodPipeline<z.ZodEffects<z.ZodString, string | null, string>, z.ZodString>;
    payerPhone: z.ZodPipeline<z.ZodEffects<z.ZodString, string | null, string>, z.ZodString>;
}, "strip", z.ZodTypeAny, {
    method: "gateway";
    tenantPhone: string;
    payerPhone: string;
}, {
    method: "gateway";
    tenantPhone: string;
    payerPhone: string;
}>, z.ZodObject<{
    method: z.ZodLiteral<"recorded">;
    paidOn: z.ZodEffects<z.ZodString, string, string>;
    reference: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
}, "strip", z.ZodTypeAny, {
    method: "recorded";
    paidOn: string;
    reference?: string | undefined;
}, {
    method: "recorded";
    paidOn: string;
    reference?: string | undefined;
}>, z.ZodObject<{
    method: z.ZodLiteral<"none">;
}, "strip", z.ZodTypeAny, {
    method: "none";
}, {
    method: "none";
}>]>;
export type DepositRefund = z.infer<typeof DepositRefund>;
/**
 * `POST /ops/deposits/:id/settle`, with an `Idempotency-Key`. What is kept is
 * the sum of the deductions; kept plus refunded must equal what the tenant
 * paid on the deposit (`settlementProblem`).
 */
export declare const SettleDepositRequest: z.ZodObject<{
    deductions: z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        amountRwf: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        amountRwf: number;
        label: string;
    }, {
        amountRwf: number;
        label: string;
    }>, "many">;
    refundedRwf: z.ZodNumber;
    refund: z.ZodDiscriminatedUnion<"method", [z.ZodObject<{
        method: z.ZodLiteral<"gateway">;
        tenantPhone: z.ZodPipeline<z.ZodEffects<z.ZodString, string | null, string>, z.ZodString>;
        payerPhone: z.ZodPipeline<z.ZodEffects<z.ZodString, string | null, string>, z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        method: "gateway";
        tenantPhone: string;
        payerPhone: string;
    }, {
        method: "gateway";
        tenantPhone: string;
        payerPhone: string;
    }>, z.ZodObject<{
        method: z.ZodLiteral<"recorded">;
        paidOn: z.ZodEffects<z.ZodString, string, string>;
        reference: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
    }, "strip", z.ZodTypeAny, {
        method: "recorded";
        paidOn: string;
        reference?: string | undefined;
    }, {
        method: "recorded";
        paidOn: string;
        reference?: string | undefined;
    }>, z.ZodObject<{
        method: z.ZodLiteral<"none">;
    }, "strip", z.ZodTypeAny, {
        method: "none";
    }, {
        method: "none";
    }>]>;
    note: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
}, "strip", z.ZodTypeAny, {
    refund: {
        method: "gateway";
        tenantPhone: string;
        payerPhone: string;
    } | {
        method: "recorded";
        paidOn: string;
        reference?: string | undefined;
    } | {
        method: "none";
    };
    refundedRwf: number;
    deductions: {
        amountRwf: number;
        label: string;
    }[];
    note?: string | undefined;
}, {
    refund: {
        method: "gateway";
        tenantPhone: string;
        payerPhone: string;
    } | {
        method: "recorded";
        paidOn: string;
        reference?: string | undefined;
    } | {
        method: "none";
    };
    refundedRwf: number;
    deductions: {
        amountRwf: number;
        label: string;
    }[];
    note?: string | undefined;
}>;
export type SettleDepositRequest = z.infer<typeof SettleDepositRequest>;
/** `POST /me/tenancies/:leaseId/deposit/dispute`: the tenant does not agree with the settlement. */
export declare const DisputeDepositRequest: z.ZodObject<{
    note: z.ZodString;
}, "strip", z.ZodTypeAny, {
    note: string;
}, {
    note: string;
}>;
export type DisputeDepositRequest = z.infer<typeof DisputeDepositRequest>;
/** What the deductions add up to. */
export declare function keptOf(deductions: readonly {
    amountRwf: number;
}[]): number;
/**
 * Why a settlement does not balance, or null: kept (the deductions) plus
 * refunded is what the tenant paid; a refund needs a way back, and "no
 * refund" refunds nothing.
 */
export declare function settlementProblem(input: {
    paidRwf: number;
    deductions: readonly {
        amountRwf: number;
    }[];
    refundedRwf: number;
    method: DepositRefundMethod;
}): string | null;
/** What is wrong with the days of a notice the landlord records, or null. */
export declare function recordedNoticeProblem(input: {
    filedOn: string;
    moveOutOn: string;
}, lease: NoticeLease, today?: string): {
    path: "filedOn" | "moveOutOn";
    message: string;
} | null;
/** Was a notice given `filedOn` for `moveOutOn` shorter than the lease asks? */
export declare function isShortNotice(filedOn: string, moveOutOn: string, lease: Pick<NoticeLease, "noticeDays">): boolean;
/** The leases a notice can be given on: running, or ending on their own. */
export declare function canTakeNotice(status: LeaseStatus): boolean;
/** The steps of moving out, in order, as the tenant's stepper shows them. */
export declare const MoveOutStage: z.ZodEnum<["submitted", "acknowledged", "moved_out", "settled"]>;
export type MoveOutStage = z.infer<typeof MoveOutStage>;
export declare const MOVE_OUT_STAGE_LABEL: Readonly<Record<MoveOutStage, string>>;
/** How far moving out has gone, or null before any notice and before the lease ended. */
export declare function moveOutStage(input: {
    leaseStatus: LeaseStatus;
    noticeStatus: MoveOutNoticeStatus | null;
    depositSettled: boolean;
}): MoveOutStage | null;
/** The tabs of `/move-outs`. */
export declare const MoveOutTab: z.ZodEnum<["to_acknowledge", "moving_soon", "moved_out", "settled"]>;
export type MoveOutTab = z.infer<typeof MoveOutTab>;
export declare const MOVE_OUT_TAB_LABEL: Readonly<Record<MoveOutTab, string>>;
/**
 * The tab a lease shows under, or null when it is not moving out: a notice
 * waiting for the landlord; ending (acknowledged, or its end is near); ended
 * with a deposit still held; ended with the deposit settled or none.
 */
export declare function moveOutTabOf(input: {
    leaseStatus: LeaseStatus;
    noticeStatus: MoveOutNoticeStatus | null;
    depositOpen: boolean;
}): MoveOutTab | null;
/** The list's filter: one tab, or every move-out ("all", the default: nothing is chosen for the landlord). */
export declare const MoveOutListTab: z.ZodEnum<["all", "to_acknowledge", "moving_soon", "moved_out", "settled"]>;
export type MoveOutListTab = z.infer<typeof MoveOutListTab>;
export declare const MoveOutListQuery: z.ZodObject<{
    tab: z.ZodDefault<z.ZodEnum<["all", "to_acknowledge", "moving_soon", "moved_out", "settled"]>>;
    q: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    tab: "settled" | "all" | "moved_out" | "to_acknowledge" | "moving_soon";
    q?: string | undefined;
}, {
    q?: string | undefined;
    tab?: "settled" | "all" | "moved_out" | "to_acknowledge" | "moving_soon" | undefined;
}>;
export type MoveOutListQuery = z.input<typeof MoveOutListQuery>;
export declare const MoveOutNoticeView: z.ZodObject<{
    id: z.ZodString;
    givenBy: z.ZodEnum<["landlord", "tenant"]>;
    channel: z.ZodEnum<["app", "letter", "email", "in_person"]>;
    filedOn: z.ZodEffects<z.ZodString, string, string>;
    moveOutOn: z.ZodEffects<z.ZodString, string, string>;
    reasonCode: z.ZodEnum<["moving_in_kigali", "leaving_kigali", "own_home", "cost", "terms", "landlord_use", "tenant_breach", "other"]>;
    message: z.ZodNullable<z.ZodString>;
    noticeDays: z.ZodNumber;
    isShortNotice: z.ZodBoolean;
    status: z.ZodEnum<["submitted", "acknowledged", "withdrawn"]>;
    acknowledgedAt: z.ZodNullable<z.ZodString>;
    withdrawnAt: z.ZodNullable<z.ZodString>;
    filedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string | null;
    status: "submitted" | "withdrawn" | "acknowledged";
    id: string;
    reasonCode: "other" | "moving_in_kigali" | "leaving_kigali" | "own_home" | "cost" | "terms" | "landlord_use" | "tenant_breach";
    withdrawnAt: string | null;
    channel: "email" | "app" | "letter" | "in_person";
    noticeDays: number;
    filedAt: string;
    isShortNotice: boolean;
    moveOutOn: string;
    givenBy: "landlord" | "tenant";
    filedOn: string;
    acknowledgedAt: string | null;
}, {
    message: string | null;
    status: "submitted" | "withdrawn" | "acknowledged";
    id: string;
    reasonCode: "other" | "moving_in_kigali" | "leaving_kigali" | "own_home" | "cost" | "terms" | "landlord_use" | "tenant_breach";
    withdrawnAt: string | null;
    channel: "email" | "app" | "letter" | "in_person";
    noticeDays: number;
    filedAt: string;
    isShortNotice: boolean;
    moveOutOn: string;
    givenBy: "landlord" | "tenant";
    filedOn: string;
    acknowledgedAt: string | null;
}>;
export type MoveOutNoticeView = z.infer<typeof MoveOutNoticeView>;
/** Where a refund through Injishi stands: on the landlord's phone, with the tenant, or refused. */
export declare const DepositRefundStatus: z.ZodEnum<["waiting", "paid", "failed"]>;
export type DepositRefundStatus = z.infer<typeof DepositRefundStatus>;
export declare const DepositView: z.ZodObject<{
    id: z.ZodString;
    leaseId: z.ZodString;
    agreedRwf: z.ZodNumber;
    /** What the tenant paid on the deposit charge: what a settlement splits. */
    paidRwf: z.ZodNumber;
    status: z.ZodEnum<["awaiting", "held", "settled"]>;
    keptRwf: z.ZodNullable<z.ZodNumber>;
    refundedRwf: z.ZodNullable<z.ZodNumber>;
    deductions: z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        amountRwf: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        amountRwf: number;
        label: string;
    }, {
        amountRwf: number;
        label: string;
    }>, "many">;
    refundMethod: z.ZodNullable<z.ZodEnum<["gateway", "recorded", "none"]>>;
    /** A refund through Injishi: waiting on the landlord's phone, paid, or failed (then it can be settled again). */
    refundStatus: z.ZodNullable<z.ZodEnum<["waiting", "paid", "failed"]>>;
    refundDestination: z.ZodNullable<z.ZodString>;
    refundFailureReason: z.ZodNullable<z.ZodString>;
    refundReference: z.ZodNullable<z.ZodString>;
    settledAt: z.ZodNullable<z.ZodString>;
    tenantDisputedAt: z.ZodNullable<z.ZodString>;
    disputeNote: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "held" | "settled" | "awaiting";
    id: string;
    paidRwf: number;
    settledAt: string | null;
    leaseId: string;
    refundedRwf: number | null;
    keptRwf: number | null;
    agreedRwf: number;
    deductions: {
        amountRwf: number;
        label: string;
    }[];
    refundMethod: "none" | "gateway" | "recorded" | null;
    refundStatus: "failed" | "waiting" | "paid" | null;
    refundDestination: string | null;
    refundFailureReason: string | null;
    refundReference: string | null;
    tenantDisputedAt: string | null;
    disputeNote: string | null;
}, {
    status: "held" | "settled" | "awaiting";
    id: string;
    paidRwf: number;
    settledAt: string | null;
    leaseId: string;
    refundedRwf: number | null;
    keptRwf: number | null;
    agreedRwf: number;
    deductions: {
        amountRwf: number;
        label: string;
    }[];
    refundMethod: "none" | "gateway" | "recorded" | null;
    refundStatus: "failed" | "waiting" | "paid" | null;
    refundDestination: string | null;
    refundFailureReason: string | null;
    refundReference: string | null;
    tenantDisputedAt: string | null;
    disputeNote: string | null;
}>;
export type DepositView = z.infer<typeof DepositView>;
/** Can this deposit be settled now: held (or never paid) on a lease that ended, and no refund on its way. */
export declare function canSettleDeposit(deposit: Pick<DepositView, "status" | "refundStatus">, leaseStatus: LeaseStatus): boolean;
/** One row of `GET /ops/move-outs`. */
export declare const MoveOutRow: z.ZodObject<{
    leaseId: z.ZodString;
    reference: z.ZodString;
    tenantName: z.ZodString;
    unitLabel: z.ZodString;
    propertyName: z.ZodString;
    leaseStatus: z.ZodEnum<["draft", "pending_signature", "signed", "active", "ending", "ended", "cancelled"]>;
    startDate: z.ZodEffects<z.ZodString, string, string>;
    endDate: z.ZodEffects<z.ZodString, string, string>;
    noticeDays: z.ZodNumber;
    notice: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        givenBy: z.ZodEnum<["landlord", "tenant"]>;
        channel: z.ZodEnum<["app", "letter", "email", "in_person"]>;
        filedOn: z.ZodEffects<z.ZodString, string, string>;
        moveOutOn: z.ZodEffects<z.ZodString, string, string>;
        reasonCode: z.ZodEnum<["moving_in_kigali", "leaving_kigali", "own_home", "cost", "terms", "landlord_use", "tenant_breach", "other"]>;
        message: z.ZodNullable<z.ZodString>;
        noticeDays: z.ZodNumber;
        isShortNotice: z.ZodBoolean;
        status: z.ZodEnum<["submitted", "acknowledged", "withdrawn"]>;
        acknowledgedAt: z.ZodNullable<z.ZodString>;
        withdrawnAt: z.ZodNullable<z.ZodString>;
        filedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        message: string | null;
        status: "submitted" | "withdrawn" | "acknowledged";
        id: string;
        reasonCode: "other" | "moving_in_kigali" | "leaving_kigali" | "own_home" | "cost" | "terms" | "landlord_use" | "tenant_breach";
        withdrawnAt: string | null;
        channel: "email" | "app" | "letter" | "in_person";
        noticeDays: number;
        filedAt: string;
        isShortNotice: boolean;
        moveOutOn: string;
        givenBy: "landlord" | "tenant";
        filedOn: string;
        acknowledgedAt: string | null;
    }, {
        message: string | null;
        status: "submitted" | "withdrawn" | "acknowledged";
        id: string;
        reasonCode: "other" | "moving_in_kigali" | "leaving_kigali" | "own_home" | "cost" | "terms" | "landlord_use" | "tenant_breach";
        withdrawnAt: string | null;
        channel: "email" | "app" | "letter" | "in_person";
        noticeDays: number;
        filedAt: string;
        isShortNotice: boolean;
        moveOutOn: string;
        givenBy: "landlord" | "tenant";
        filedOn: string;
        acknowledgedAt: string | null;
    }>>;
    /** The notice's day, else the lease's last day. */
    movingOutOn: z.ZodEffects<z.ZodString, string, string>;
    /** Days from today to `movingOutOn` (negative once past); null once moved out. */
    daysLeft: z.ZodNullable<z.ZodNumber>;
    endedOn: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
    deposit: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        leaseId: z.ZodString;
        agreedRwf: z.ZodNumber;
        /** What the tenant paid on the deposit charge: what a settlement splits. */
        paidRwf: z.ZodNumber;
        status: z.ZodEnum<["awaiting", "held", "settled"]>;
        keptRwf: z.ZodNullable<z.ZodNumber>;
        refundedRwf: z.ZodNullable<z.ZodNumber>;
        deductions: z.ZodArray<z.ZodObject<{
            label: z.ZodString;
            amountRwf: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            amountRwf: number;
            label: string;
        }, {
            amountRwf: number;
            label: string;
        }>, "many">;
        refundMethod: z.ZodNullable<z.ZodEnum<["gateway", "recorded", "none"]>>;
        /** A refund through Injishi: waiting on the landlord's phone, paid, or failed (then it can be settled again). */
        refundStatus: z.ZodNullable<z.ZodEnum<["waiting", "paid", "failed"]>>;
        refundDestination: z.ZodNullable<z.ZodString>;
        refundFailureReason: z.ZodNullable<z.ZodString>;
        refundReference: z.ZodNullable<z.ZodString>;
        settledAt: z.ZodNullable<z.ZodString>;
        tenantDisputedAt: z.ZodNullable<z.ZodString>;
        disputeNote: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "held" | "settled" | "awaiting";
        id: string;
        paidRwf: number;
        settledAt: string | null;
        leaseId: string;
        refundedRwf: number | null;
        keptRwf: number | null;
        agreedRwf: number;
        deductions: {
            amountRwf: number;
            label: string;
        }[];
        refundMethod: "none" | "gateway" | "recorded" | null;
        refundStatus: "failed" | "waiting" | "paid" | null;
        refundDestination: string | null;
        refundFailureReason: string | null;
        refundReference: string | null;
        tenantDisputedAt: string | null;
        disputeNote: string | null;
    }, {
        status: "held" | "settled" | "awaiting";
        id: string;
        paidRwf: number;
        settledAt: string | null;
        leaseId: string;
        refundedRwf: number | null;
        keptRwf: number | null;
        agreedRwf: number;
        deductions: {
            amountRwf: number;
            label: string;
        }[];
        refundMethod: "none" | "gateway" | "recorded" | null;
        refundStatus: "failed" | "waiting" | "paid" | null;
        refundDestination: string | null;
        refundFailureReason: string | null;
        refundReference: string | null;
        tenantDisputedAt: string | null;
        disputeNote: string | null;
    }>>;
    tab: z.ZodEnum<["to_acknowledge", "moving_soon", "moved_out", "settled"]>;
}, "strip", z.ZodTypeAny, {
    reference: string;
    deposit: {
        status: "held" | "settled" | "awaiting";
        id: string;
        paidRwf: number;
        settledAt: string | null;
        leaseId: string;
        refundedRwf: number | null;
        keptRwf: number | null;
        agreedRwf: number;
        deductions: {
            amountRwf: number;
            label: string;
        }[];
        refundMethod: "none" | "gateway" | "recorded" | null;
        refundStatus: "failed" | "waiting" | "paid" | null;
        refundDestination: string | null;
        refundFailureReason: string | null;
        refundReference: string | null;
        tenantDisputedAt: string | null;
        disputeNote: string | null;
    } | null;
    propertyName: string;
    leaseId: string;
    unitLabel: string;
    tenantName: string;
    startDate: string;
    endDate: string;
    leaseStatus: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
    noticeDays: number;
    tab: "settled" | "moved_out" | "to_acknowledge" | "moving_soon";
    notice: {
        message: string | null;
        status: "submitted" | "withdrawn" | "acknowledged";
        id: string;
        reasonCode: "other" | "moving_in_kigali" | "leaving_kigali" | "own_home" | "cost" | "terms" | "landlord_use" | "tenant_breach";
        withdrawnAt: string | null;
        channel: "email" | "app" | "letter" | "in_person";
        noticeDays: number;
        filedAt: string;
        isShortNotice: boolean;
        moveOutOn: string;
        givenBy: "landlord" | "tenant";
        filedOn: string;
        acknowledgedAt: string | null;
    } | null;
    movingOutOn: string;
    daysLeft: number | null;
    endedOn: string | null;
}, {
    reference: string;
    deposit: {
        status: "held" | "settled" | "awaiting";
        id: string;
        paidRwf: number;
        settledAt: string | null;
        leaseId: string;
        refundedRwf: number | null;
        keptRwf: number | null;
        agreedRwf: number;
        deductions: {
            amountRwf: number;
            label: string;
        }[];
        refundMethod: "none" | "gateway" | "recorded" | null;
        refundStatus: "failed" | "waiting" | "paid" | null;
        refundDestination: string | null;
        refundFailureReason: string | null;
        refundReference: string | null;
        tenantDisputedAt: string | null;
        disputeNote: string | null;
    } | null;
    propertyName: string;
    leaseId: string;
    unitLabel: string;
    tenantName: string;
    startDate: string;
    endDate: string;
    leaseStatus: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
    noticeDays: number;
    tab: "settled" | "moved_out" | "to_acknowledge" | "moving_soon";
    notice: {
        message: string | null;
        status: "submitted" | "withdrawn" | "acknowledged";
        id: string;
        reasonCode: "other" | "moving_in_kigali" | "leaving_kigali" | "own_home" | "cost" | "terms" | "landlord_use" | "tenant_breach";
        withdrawnAt: string | null;
        channel: "email" | "app" | "letter" | "in_person";
        noticeDays: number;
        filedAt: string;
        isShortNotice: boolean;
        moveOutOn: string;
        givenBy: "landlord" | "tenant";
        filedOn: string;
        acknowledgedAt: string | null;
    } | null;
    movingOutOn: string;
    daysLeft: number | null;
    endedOn: string | null;
}>;
export type MoveOutRow = z.infer<typeof MoveOutRow>;
export declare const MoveOutList: z.ZodObject<{
    tab: z.ZodEnum<["all", "to_acknowledge", "moving_soon", "moved_out", "settled"]>;
    items: z.ZodArray<z.ZodObject<{
        leaseId: z.ZodString;
        reference: z.ZodString;
        tenantName: z.ZodString;
        unitLabel: z.ZodString;
        propertyName: z.ZodString;
        leaseStatus: z.ZodEnum<["draft", "pending_signature", "signed", "active", "ending", "ended", "cancelled"]>;
        startDate: z.ZodEffects<z.ZodString, string, string>;
        endDate: z.ZodEffects<z.ZodString, string, string>;
        noticeDays: z.ZodNumber;
        notice: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            givenBy: z.ZodEnum<["landlord", "tenant"]>;
            channel: z.ZodEnum<["app", "letter", "email", "in_person"]>;
            filedOn: z.ZodEffects<z.ZodString, string, string>;
            moveOutOn: z.ZodEffects<z.ZodString, string, string>;
            reasonCode: z.ZodEnum<["moving_in_kigali", "leaving_kigali", "own_home", "cost", "terms", "landlord_use", "tenant_breach", "other"]>;
            message: z.ZodNullable<z.ZodString>;
            noticeDays: z.ZodNumber;
            isShortNotice: z.ZodBoolean;
            status: z.ZodEnum<["submitted", "acknowledged", "withdrawn"]>;
            acknowledgedAt: z.ZodNullable<z.ZodString>;
            withdrawnAt: z.ZodNullable<z.ZodString>;
            filedAt: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            message: string | null;
            status: "submitted" | "withdrawn" | "acknowledged";
            id: string;
            reasonCode: "other" | "moving_in_kigali" | "leaving_kigali" | "own_home" | "cost" | "terms" | "landlord_use" | "tenant_breach";
            withdrawnAt: string | null;
            channel: "email" | "app" | "letter" | "in_person";
            noticeDays: number;
            filedAt: string;
            isShortNotice: boolean;
            moveOutOn: string;
            givenBy: "landlord" | "tenant";
            filedOn: string;
            acknowledgedAt: string | null;
        }, {
            message: string | null;
            status: "submitted" | "withdrawn" | "acknowledged";
            id: string;
            reasonCode: "other" | "moving_in_kigali" | "leaving_kigali" | "own_home" | "cost" | "terms" | "landlord_use" | "tenant_breach";
            withdrawnAt: string | null;
            channel: "email" | "app" | "letter" | "in_person";
            noticeDays: number;
            filedAt: string;
            isShortNotice: boolean;
            moveOutOn: string;
            givenBy: "landlord" | "tenant";
            filedOn: string;
            acknowledgedAt: string | null;
        }>>;
        /** The notice's day, else the lease's last day. */
        movingOutOn: z.ZodEffects<z.ZodString, string, string>;
        /** Days from today to `movingOutOn` (negative once past); null once moved out. */
        daysLeft: z.ZodNullable<z.ZodNumber>;
        endedOn: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
        deposit: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            leaseId: z.ZodString;
            agreedRwf: z.ZodNumber;
            /** What the tenant paid on the deposit charge: what a settlement splits. */
            paidRwf: z.ZodNumber;
            status: z.ZodEnum<["awaiting", "held", "settled"]>;
            keptRwf: z.ZodNullable<z.ZodNumber>;
            refundedRwf: z.ZodNullable<z.ZodNumber>;
            deductions: z.ZodArray<z.ZodObject<{
                label: z.ZodString;
                amountRwf: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                amountRwf: number;
                label: string;
            }, {
                amountRwf: number;
                label: string;
            }>, "many">;
            refundMethod: z.ZodNullable<z.ZodEnum<["gateway", "recorded", "none"]>>;
            /** A refund through Injishi: waiting on the landlord's phone, paid, or failed (then it can be settled again). */
            refundStatus: z.ZodNullable<z.ZodEnum<["waiting", "paid", "failed"]>>;
            refundDestination: z.ZodNullable<z.ZodString>;
            refundFailureReason: z.ZodNullable<z.ZodString>;
            refundReference: z.ZodNullable<z.ZodString>;
            settledAt: z.ZodNullable<z.ZodString>;
            tenantDisputedAt: z.ZodNullable<z.ZodString>;
            disputeNote: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            status: "held" | "settled" | "awaiting";
            id: string;
            paidRwf: number;
            settledAt: string | null;
            leaseId: string;
            refundedRwf: number | null;
            keptRwf: number | null;
            agreedRwf: number;
            deductions: {
                amountRwf: number;
                label: string;
            }[];
            refundMethod: "none" | "gateway" | "recorded" | null;
            refundStatus: "failed" | "waiting" | "paid" | null;
            refundDestination: string | null;
            refundFailureReason: string | null;
            refundReference: string | null;
            tenantDisputedAt: string | null;
            disputeNote: string | null;
        }, {
            status: "held" | "settled" | "awaiting";
            id: string;
            paidRwf: number;
            settledAt: string | null;
            leaseId: string;
            refundedRwf: number | null;
            keptRwf: number | null;
            agreedRwf: number;
            deductions: {
                amountRwf: number;
                label: string;
            }[];
            refundMethod: "none" | "gateway" | "recorded" | null;
            refundStatus: "failed" | "waiting" | "paid" | null;
            refundDestination: string | null;
            refundFailureReason: string | null;
            refundReference: string | null;
            tenantDisputedAt: string | null;
            disputeNote: string | null;
        }>>;
        tab: z.ZodEnum<["to_acknowledge", "moving_soon", "moved_out", "settled"]>;
    }, "strip", z.ZodTypeAny, {
        reference: string;
        deposit: {
            status: "held" | "settled" | "awaiting";
            id: string;
            paidRwf: number;
            settledAt: string | null;
            leaseId: string;
            refundedRwf: number | null;
            keptRwf: number | null;
            agreedRwf: number;
            deductions: {
                amountRwf: number;
                label: string;
            }[];
            refundMethod: "none" | "gateway" | "recorded" | null;
            refundStatus: "failed" | "waiting" | "paid" | null;
            refundDestination: string | null;
            refundFailureReason: string | null;
            refundReference: string | null;
            tenantDisputedAt: string | null;
            disputeNote: string | null;
        } | null;
        propertyName: string;
        leaseId: string;
        unitLabel: string;
        tenantName: string;
        startDate: string;
        endDate: string;
        leaseStatus: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
        noticeDays: number;
        tab: "settled" | "moved_out" | "to_acknowledge" | "moving_soon";
        notice: {
            message: string | null;
            status: "submitted" | "withdrawn" | "acknowledged";
            id: string;
            reasonCode: "other" | "moving_in_kigali" | "leaving_kigali" | "own_home" | "cost" | "terms" | "landlord_use" | "tenant_breach";
            withdrawnAt: string | null;
            channel: "email" | "app" | "letter" | "in_person";
            noticeDays: number;
            filedAt: string;
            isShortNotice: boolean;
            moveOutOn: string;
            givenBy: "landlord" | "tenant";
            filedOn: string;
            acknowledgedAt: string | null;
        } | null;
        movingOutOn: string;
        daysLeft: number | null;
        endedOn: string | null;
    }, {
        reference: string;
        deposit: {
            status: "held" | "settled" | "awaiting";
            id: string;
            paidRwf: number;
            settledAt: string | null;
            leaseId: string;
            refundedRwf: number | null;
            keptRwf: number | null;
            agreedRwf: number;
            deductions: {
                amountRwf: number;
                label: string;
            }[];
            refundMethod: "none" | "gateway" | "recorded" | null;
            refundStatus: "failed" | "waiting" | "paid" | null;
            refundDestination: string | null;
            refundFailureReason: string | null;
            refundReference: string | null;
            tenantDisputedAt: string | null;
            disputeNote: string | null;
        } | null;
        propertyName: string;
        leaseId: string;
        unitLabel: string;
        tenantName: string;
        startDate: string;
        endDate: string;
        leaseStatus: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
        noticeDays: number;
        tab: "settled" | "moved_out" | "to_acknowledge" | "moving_soon";
        notice: {
            message: string | null;
            status: "submitted" | "withdrawn" | "acknowledged";
            id: string;
            reasonCode: "other" | "moving_in_kigali" | "leaving_kigali" | "own_home" | "cost" | "terms" | "landlord_use" | "tenant_breach";
            withdrawnAt: string | null;
            channel: "email" | "app" | "letter" | "in_person";
            noticeDays: number;
            filedAt: string;
            isShortNotice: boolean;
            moveOutOn: string;
            givenBy: "landlord" | "tenant";
            filedOn: string;
            acknowledgedAt: string | null;
        } | null;
        movingOutOn: string;
        daysLeft: number | null;
        endedOn: string | null;
    }>, "many">;
    counts: z.ZodRecord<z.ZodEnum<["to_acknowledge", "moving_soon", "moved_out", "settled"]>, z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    items: {
        reference: string;
        deposit: {
            status: "held" | "settled" | "awaiting";
            id: string;
            paidRwf: number;
            settledAt: string | null;
            leaseId: string;
            refundedRwf: number | null;
            keptRwf: number | null;
            agreedRwf: number;
            deductions: {
                amountRwf: number;
                label: string;
            }[];
            refundMethod: "none" | "gateway" | "recorded" | null;
            refundStatus: "failed" | "waiting" | "paid" | null;
            refundDestination: string | null;
            refundFailureReason: string | null;
            refundReference: string | null;
            tenantDisputedAt: string | null;
            disputeNote: string | null;
        } | null;
        propertyName: string;
        leaseId: string;
        unitLabel: string;
        tenantName: string;
        startDate: string;
        endDate: string;
        leaseStatus: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
        noticeDays: number;
        tab: "settled" | "moved_out" | "to_acknowledge" | "moving_soon";
        notice: {
            message: string | null;
            status: "submitted" | "withdrawn" | "acknowledged";
            id: string;
            reasonCode: "other" | "moving_in_kigali" | "leaving_kigali" | "own_home" | "cost" | "terms" | "landlord_use" | "tenant_breach";
            withdrawnAt: string | null;
            channel: "email" | "app" | "letter" | "in_person";
            noticeDays: number;
            filedAt: string;
            isShortNotice: boolean;
            moveOutOn: string;
            givenBy: "landlord" | "tenant";
            filedOn: string;
            acknowledgedAt: string | null;
        } | null;
        movingOutOn: string;
        daysLeft: number | null;
        endedOn: string | null;
    }[];
    counts: Partial<Record<"settled" | "moved_out" | "to_acknowledge" | "moving_soon", number>>;
    tab: "settled" | "all" | "moved_out" | "to_acknowledge" | "moving_soon";
}, {
    items: {
        reference: string;
        deposit: {
            status: "held" | "settled" | "awaiting";
            id: string;
            paidRwf: number;
            settledAt: string | null;
            leaseId: string;
            refundedRwf: number | null;
            keptRwf: number | null;
            agreedRwf: number;
            deductions: {
                amountRwf: number;
                label: string;
            }[];
            refundMethod: "none" | "gateway" | "recorded" | null;
            refundStatus: "failed" | "waiting" | "paid" | null;
            refundDestination: string | null;
            refundFailureReason: string | null;
            refundReference: string | null;
            tenantDisputedAt: string | null;
            disputeNote: string | null;
        } | null;
        propertyName: string;
        leaseId: string;
        unitLabel: string;
        tenantName: string;
        startDate: string;
        endDate: string;
        leaseStatus: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
        noticeDays: number;
        tab: "settled" | "moved_out" | "to_acknowledge" | "moving_soon";
        notice: {
            message: string | null;
            status: "submitted" | "withdrawn" | "acknowledged";
            id: string;
            reasonCode: "other" | "moving_in_kigali" | "leaving_kigali" | "own_home" | "cost" | "terms" | "landlord_use" | "tenant_breach";
            withdrawnAt: string | null;
            channel: "email" | "app" | "letter" | "in_person";
            noticeDays: number;
            filedAt: string;
            isShortNotice: boolean;
            moveOutOn: string;
            givenBy: "landlord" | "tenant";
            filedOn: string;
            acknowledgedAt: string | null;
        } | null;
        movingOutOn: string;
        daysLeft: number | null;
        endedOn: string | null;
    }[];
    counts: Partial<Record<"settled" | "moved_out" | "to_acknowledge" | "moving_soon", number>>;
    tab: "settled" | "all" | "moved_out" | "to_acknowledge" | "moving_soon";
}>;
export type MoveOutList = z.infer<typeof MoveOutList>;
/** `GET /ops/deposits`: every deposit with its lease. */
export declare const DepositListItem: z.ZodObject<{
    id: z.ZodString;
    leaseId: z.ZodString;
    agreedRwf: z.ZodNumber;
    /** What the tenant paid on the deposit charge: what a settlement splits. */
    paidRwf: z.ZodNumber;
    status: z.ZodEnum<["awaiting", "held", "settled"]>;
    keptRwf: z.ZodNullable<z.ZodNumber>;
    refundedRwf: z.ZodNullable<z.ZodNumber>;
    deductions: z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        amountRwf: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        amountRwf: number;
        label: string;
    }, {
        amountRwf: number;
        label: string;
    }>, "many">;
    refundMethod: z.ZodNullable<z.ZodEnum<["gateway", "recorded", "none"]>>;
    /** A refund through Injishi: waiting on the landlord's phone, paid, or failed (then it can be settled again). */
    refundStatus: z.ZodNullable<z.ZodEnum<["waiting", "paid", "failed"]>>;
    refundDestination: z.ZodNullable<z.ZodString>;
    refundFailureReason: z.ZodNullable<z.ZodString>;
    refundReference: z.ZodNullable<z.ZodString>;
    settledAt: z.ZodNullable<z.ZodString>;
    tenantDisputedAt: z.ZodNullable<z.ZodString>;
    disputeNote: z.ZodNullable<z.ZodString>;
} & {
    reference: z.ZodString;
    tenantName: z.ZodString;
    unitLabel: z.ZodString;
    propertyName: z.ZodString;
    leaseStatus: z.ZodEnum<["draft", "pending_signature", "signed", "active", "ending", "ended", "cancelled"]>;
    endedOn: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
}, "strip", z.ZodTypeAny, {
    status: "held" | "settled" | "awaiting";
    id: string;
    reference: string;
    paidRwf: number;
    settledAt: string | null;
    propertyName: string;
    leaseId: string;
    unitLabel: string;
    tenantName: string;
    leaseStatus: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
    refundedRwf: number | null;
    keptRwf: number | null;
    agreedRwf: number;
    deductions: {
        amountRwf: number;
        label: string;
    }[];
    refundMethod: "none" | "gateway" | "recorded" | null;
    refundStatus: "failed" | "waiting" | "paid" | null;
    refundDestination: string | null;
    refundFailureReason: string | null;
    refundReference: string | null;
    tenantDisputedAt: string | null;
    disputeNote: string | null;
    endedOn: string | null;
}, {
    status: "held" | "settled" | "awaiting";
    id: string;
    reference: string;
    paidRwf: number;
    settledAt: string | null;
    propertyName: string;
    leaseId: string;
    unitLabel: string;
    tenantName: string;
    leaseStatus: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
    refundedRwf: number | null;
    keptRwf: number | null;
    agreedRwf: number;
    deductions: {
        amountRwf: number;
        label: string;
    }[];
    refundMethod: "none" | "gateway" | "recorded" | null;
    refundStatus: "failed" | "waiting" | "paid" | null;
    refundDestination: string | null;
    refundFailureReason: string | null;
    refundReference: string | null;
    tenantDisputedAt: string | null;
    disputeNote: string | null;
    endedOn: string | null;
}>;
export type DepositListItem = z.infer<typeof DepositListItem>;
export declare const DepositList: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        leaseId: z.ZodString;
        agreedRwf: z.ZodNumber;
        /** What the tenant paid on the deposit charge: what a settlement splits. */
        paidRwf: z.ZodNumber;
        status: z.ZodEnum<["awaiting", "held", "settled"]>;
        keptRwf: z.ZodNullable<z.ZodNumber>;
        refundedRwf: z.ZodNullable<z.ZodNumber>;
        deductions: z.ZodArray<z.ZodObject<{
            label: z.ZodString;
            amountRwf: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            amountRwf: number;
            label: string;
        }, {
            amountRwf: number;
            label: string;
        }>, "many">;
        refundMethod: z.ZodNullable<z.ZodEnum<["gateway", "recorded", "none"]>>;
        /** A refund through Injishi: waiting on the landlord's phone, paid, or failed (then it can be settled again). */
        refundStatus: z.ZodNullable<z.ZodEnum<["waiting", "paid", "failed"]>>;
        refundDestination: z.ZodNullable<z.ZodString>;
        refundFailureReason: z.ZodNullable<z.ZodString>;
        refundReference: z.ZodNullable<z.ZodString>;
        settledAt: z.ZodNullable<z.ZodString>;
        tenantDisputedAt: z.ZodNullable<z.ZodString>;
        disputeNote: z.ZodNullable<z.ZodString>;
    } & {
        reference: z.ZodString;
        tenantName: z.ZodString;
        unitLabel: z.ZodString;
        propertyName: z.ZodString;
        leaseStatus: z.ZodEnum<["draft", "pending_signature", "signed", "active", "ending", "ended", "cancelled"]>;
        endedOn: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
    }, "strip", z.ZodTypeAny, {
        status: "held" | "settled" | "awaiting";
        id: string;
        reference: string;
        paidRwf: number;
        settledAt: string | null;
        propertyName: string;
        leaseId: string;
        unitLabel: string;
        tenantName: string;
        leaseStatus: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
        refundedRwf: number | null;
        keptRwf: number | null;
        agreedRwf: number;
        deductions: {
            amountRwf: number;
            label: string;
        }[];
        refundMethod: "none" | "gateway" | "recorded" | null;
        refundStatus: "failed" | "waiting" | "paid" | null;
        refundDestination: string | null;
        refundFailureReason: string | null;
        refundReference: string | null;
        tenantDisputedAt: string | null;
        disputeNote: string | null;
        endedOn: string | null;
    }, {
        status: "held" | "settled" | "awaiting";
        id: string;
        reference: string;
        paidRwf: number;
        settledAt: string | null;
        propertyName: string;
        leaseId: string;
        unitLabel: string;
        tenantName: string;
        leaseStatus: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
        refundedRwf: number | null;
        keptRwf: number | null;
        agreedRwf: number;
        deductions: {
            amountRwf: number;
            label: string;
        }[];
        refundMethod: "none" | "gateway" | "recorded" | null;
        refundStatus: "failed" | "waiting" | "paid" | null;
        refundDestination: string | null;
        refundFailureReason: string | null;
        refundReference: string | null;
        tenantDisputedAt: string | null;
        disputeNote: string | null;
        endedOn: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    items: {
        status: "held" | "settled" | "awaiting";
        id: string;
        reference: string;
        paidRwf: number;
        settledAt: string | null;
        propertyName: string;
        leaseId: string;
        unitLabel: string;
        tenantName: string;
        leaseStatus: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
        refundedRwf: number | null;
        keptRwf: number | null;
        agreedRwf: number;
        deductions: {
            amountRwf: number;
            label: string;
        }[];
        refundMethod: "none" | "gateway" | "recorded" | null;
        refundStatus: "failed" | "waiting" | "paid" | null;
        refundDestination: string | null;
        refundFailureReason: string | null;
        refundReference: string | null;
        tenantDisputedAt: string | null;
        disputeNote: string | null;
        endedOn: string | null;
    }[];
}, {
    items: {
        status: "held" | "settled" | "awaiting";
        id: string;
        reference: string;
        paidRwf: number;
        settledAt: string | null;
        propertyName: string;
        leaseId: string;
        unitLabel: string;
        tenantName: string;
        leaseStatus: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
        refundedRwf: number | null;
        keptRwf: number | null;
        agreedRwf: number;
        deductions: {
            amountRwf: number;
            label: string;
        }[];
        refundMethod: "none" | "gateway" | "recorded" | null;
        refundStatus: "failed" | "waiting" | "paid" | null;
        refundDestination: string | null;
        refundFailureReason: string | null;
        refundReference: string | null;
        tenantDisputedAt: string | null;
        disputeNote: string | null;
        endedOn: string | null;
    }[];
}>;
export type DepositList = z.infer<typeof DepositList>;
/** `GET /me/tenancies/:leaseId/move-out`: what the tenant's Moving out page shows. */
export declare const TenancyMoveOut: z.ZodObject<{
    leaseId: z.ZodString;
    leaseStatus: z.ZodEnum<["draft", "pending_signature", "signed", "active", "ending", "ended", "cancelled"]>;
    startDate: z.ZodEffects<z.ZodString, string, string>;
    endDate: z.ZodEffects<z.ZodString, string, string>;
    noticeDays: z.ZodNumber;
    /** The days a notice may name today; null when no notice can be given. */
    window: z.ZodNullable<z.ZodObject<{
        min: z.ZodEffects<z.ZodString, string, string>;
        max: z.ZodEffects<z.ZodString, string, string>;
    }, "strip", z.ZodTypeAny, {
        min: string;
        max: string;
    }, {
        min: string;
        max: string;
    }>>;
    /** The lease ends within its notice period: it simply ends on its last day. */
    noticeNotNeeded: z.ZodBoolean;
    canGiveNotice: z.ZodBoolean;
    canWithdraw: z.ZodBoolean;
    notice: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        givenBy: z.ZodEnum<["landlord", "tenant"]>;
        channel: z.ZodEnum<["app", "letter", "email", "in_person"]>;
        filedOn: z.ZodEffects<z.ZodString, string, string>;
        moveOutOn: z.ZodEffects<z.ZodString, string, string>;
        reasonCode: z.ZodEnum<["moving_in_kigali", "leaving_kigali", "own_home", "cost", "terms", "landlord_use", "tenant_breach", "other"]>;
        message: z.ZodNullable<z.ZodString>;
        noticeDays: z.ZodNumber;
        isShortNotice: z.ZodBoolean;
        status: z.ZodEnum<["submitted", "acknowledged", "withdrawn"]>;
        acknowledgedAt: z.ZodNullable<z.ZodString>;
        withdrawnAt: z.ZodNullable<z.ZodString>;
        filedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        message: string | null;
        status: "submitted" | "withdrawn" | "acknowledged";
        id: string;
        reasonCode: "other" | "moving_in_kigali" | "leaving_kigali" | "own_home" | "cost" | "terms" | "landlord_use" | "tenant_breach";
        withdrawnAt: string | null;
        channel: "email" | "app" | "letter" | "in_person";
        noticeDays: number;
        filedAt: string;
        isShortNotice: boolean;
        moveOutOn: string;
        givenBy: "landlord" | "tenant";
        filedOn: string;
        acknowledgedAt: string | null;
    }, {
        message: string | null;
        status: "submitted" | "withdrawn" | "acknowledged";
        id: string;
        reasonCode: "other" | "moving_in_kigali" | "leaving_kigali" | "own_home" | "cost" | "terms" | "landlord_use" | "tenant_breach";
        withdrawnAt: string | null;
        channel: "email" | "app" | "letter" | "in_person";
        noticeDays: number;
        filedAt: string;
        isShortNotice: boolean;
        moveOutOn: string;
        givenBy: "landlord" | "tenant";
        filedOn: string;
        acknowledgedAt: string | null;
    }>>;
    stage: z.ZodNullable<z.ZodEnum<["submitted", "acknowledged", "moved_out", "settled"]>>;
    endedOn: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
    deposit: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        leaseId: z.ZodString;
        agreedRwf: z.ZodNumber;
        /** What the tenant paid on the deposit charge: what a settlement splits. */
        paidRwf: z.ZodNumber;
        status: z.ZodEnum<["awaiting", "held", "settled"]>;
        keptRwf: z.ZodNullable<z.ZodNumber>;
        refundedRwf: z.ZodNullable<z.ZodNumber>;
        deductions: z.ZodArray<z.ZodObject<{
            label: z.ZodString;
            amountRwf: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            amountRwf: number;
            label: string;
        }, {
            amountRwf: number;
            label: string;
        }>, "many">;
        refundMethod: z.ZodNullable<z.ZodEnum<["gateway", "recorded", "none"]>>;
        /** A refund through Injishi: waiting on the landlord's phone, paid, or failed (then it can be settled again). */
        refundStatus: z.ZodNullable<z.ZodEnum<["waiting", "paid", "failed"]>>;
        refundDestination: z.ZodNullable<z.ZodString>;
        refundFailureReason: z.ZodNullable<z.ZodString>;
        refundReference: z.ZodNullable<z.ZodString>;
        settledAt: z.ZodNullable<z.ZodString>;
        tenantDisputedAt: z.ZodNullable<z.ZodString>;
        disputeNote: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "held" | "settled" | "awaiting";
        id: string;
        paidRwf: number;
        settledAt: string | null;
        leaseId: string;
        refundedRwf: number | null;
        keptRwf: number | null;
        agreedRwf: number;
        deductions: {
            amountRwf: number;
            label: string;
        }[];
        refundMethod: "none" | "gateway" | "recorded" | null;
        refundStatus: "failed" | "waiting" | "paid" | null;
        refundDestination: string | null;
        refundFailureReason: string | null;
        refundReference: string | null;
        tenantDisputedAt: string | null;
        disputeNote: string | null;
    }, {
        status: "held" | "settled" | "awaiting";
        id: string;
        paidRwf: number;
        settledAt: string | null;
        leaseId: string;
        refundedRwf: number | null;
        keptRwf: number | null;
        agreedRwf: number;
        deductions: {
            amountRwf: number;
            label: string;
        }[];
        refundMethod: "none" | "gateway" | "recorded" | null;
        refundStatus: "failed" | "waiting" | "paid" | null;
        refundDestination: string | null;
        refundFailureReason: string | null;
        refundReference: string | null;
        tenantDisputedAt: string | null;
        disputeNote: string | null;
    }>>;
    canDispute: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    stage: "submitted" | "settled" | "acknowledged" | "moved_out" | null;
    deposit: {
        status: "held" | "settled" | "awaiting";
        id: string;
        paidRwf: number;
        settledAt: string | null;
        leaseId: string;
        refundedRwf: number | null;
        keptRwf: number | null;
        agreedRwf: number;
        deductions: {
            amountRwf: number;
            label: string;
        }[];
        refundMethod: "none" | "gateway" | "recorded" | null;
        refundStatus: "failed" | "waiting" | "paid" | null;
        refundDestination: string | null;
        refundFailureReason: string | null;
        refundReference: string | null;
        tenantDisputedAt: string | null;
        disputeNote: string | null;
    } | null;
    leaseId: string;
    startDate: string;
    endDate: string;
    leaseStatus: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
    noticeDays: number;
    window: {
        min: string;
        max: string;
    } | null;
    notice: {
        message: string | null;
        status: "submitted" | "withdrawn" | "acknowledged";
        id: string;
        reasonCode: "other" | "moving_in_kigali" | "leaving_kigali" | "own_home" | "cost" | "terms" | "landlord_use" | "tenant_breach";
        withdrawnAt: string | null;
        channel: "email" | "app" | "letter" | "in_person";
        noticeDays: number;
        filedAt: string;
        isShortNotice: boolean;
        moveOutOn: string;
        givenBy: "landlord" | "tenant";
        filedOn: string;
        acknowledgedAt: string | null;
    } | null;
    endedOn: string | null;
    noticeNotNeeded: boolean;
    canGiveNotice: boolean;
    canWithdraw: boolean;
    canDispute: boolean;
}, {
    stage: "submitted" | "settled" | "acknowledged" | "moved_out" | null;
    deposit: {
        status: "held" | "settled" | "awaiting";
        id: string;
        paidRwf: number;
        settledAt: string | null;
        leaseId: string;
        refundedRwf: number | null;
        keptRwf: number | null;
        agreedRwf: number;
        deductions: {
            amountRwf: number;
            label: string;
        }[];
        refundMethod: "none" | "gateway" | "recorded" | null;
        refundStatus: "failed" | "waiting" | "paid" | null;
        refundDestination: string | null;
        refundFailureReason: string | null;
        refundReference: string | null;
        tenantDisputedAt: string | null;
        disputeNote: string | null;
    } | null;
    leaseId: string;
    startDate: string;
    endDate: string;
    leaseStatus: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
    noticeDays: number;
    window: {
        min: string;
        max: string;
    } | null;
    notice: {
        message: string | null;
        status: "submitted" | "withdrawn" | "acknowledged";
        id: string;
        reasonCode: "other" | "moving_in_kigali" | "leaving_kigali" | "own_home" | "cost" | "terms" | "landlord_use" | "tenant_breach";
        withdrawnAt: string | null;
        channel: "email" | "app" | "letter" | "in_person";
        noticeDays: number;
        filedAt: string;
        isShortNotice: boolean;
        moveOutOn: string;
        givenBy: "landlord" | "tenant";
        filedOn: string;
        acknowledgedAt: string | null;
    } | null;
    endedOn: string | null;
    noticeNotNeeded: boolean;
    canGiveNotice: boolean;
    canWithdraw: boolean;
    canDispute: boolean;
}>;
export type TenancyMoveOut = z.infer<typeof TenancyMoveOut>;
/** The days a tenant may name today, or null when the lease takes no notice or ends too soon. */
export declare function tenantNoticeWindow(lease: NoticeLease & {
    status: LeaseStatus;
}, today?: string): {
    min: string;
    max: string;
} | null;
/** The app's pages a moving out email opens. */
export declare const MOVE_OUT_APP_PATHS: {
    readonly tenantMoveOut: (leaseId: string) => string;
    readonly landlordMoveOuts: (tab?: MoveOutTab) => string;
};
//# sourceMappingURL=move-outs.d.ts.map