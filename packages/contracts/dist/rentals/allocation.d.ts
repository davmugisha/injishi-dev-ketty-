import { type LeaseChargeKind, type LeaseChargeStatus } from "./vocab";
/** A charge as allocation needs it. */
export interface AllocatableCharge {
    id: string;
    dueOn: string;
    amountRwf: number;
    paidRwf: number;
    status: LeaseChargeStatus;
    /** Breaks a tie between charges due the same day: the earlier period first. */
    periodStart?: string | null;
    /** On the same due day, the deposit is paid before rent. */
    kind?: LeaseChargeKind;
}
export interface Allocation {
    chargeId: string;
    amountRwf: number;
}
export interface AllocationResult {
    allocations: Allocation[];
    allocatedRwf: number;
    /** What is left over: the tenant's credit. */
    creditRwf: number;
}
/** Why an allocation was refused. */
export type AllocationErrorCode = "bad_amount" | "unknown_charge" | "charge_not_open" | "bad_charge";
export declare class AllocationError extends Error {
    readonly code: AllocationErrorCode;
    constructor(code: AllocationErrorCode, message: string);
}
/** What a charge still owes: nothing once paid or waived. */
export declare function outstandingRwf(charge: Pick<AllocatableCharge, "amountRwf" | "paidRwf" | "status">): number;
/** The status a charge has once `paidRwf` of its `amountRwf` is paid (a waived charge stays waived). */
export declare function chargeStatusAfter(charge: Pick<AllocatableCharge, "amountRwf" | "status">, paidRwf: number): LeaseChargeStatus;
/** Charges in the order money pays them: oldest due first, then the deposit, then the earlier period. */
export declare function allocationOrder<T extends AllocatableCharge>(charges: readonly T[]): T[];
/**
 * Spread a payment of `amountRwf` over the charges: oldest due first, each
 * up to what it owes, the rest as credit. `chargeIds` limits it to the
 * charges the landlord picked for a recorded payment.
 */
export declare function allocatePayment(amountRwf: number, charges: readonly AllocatableCharge[], opts?: {
    chargeIds?: readonly string[];
}): AllocationResult;
/** Credit a tenant holds: the unallocated part of one succeeded payment. */
export interface PaymentCredit {
    paymentId: string;
    amountRwf: number;
}
export interface CreditAllocation extends Allocation {
    paymentId: string;
}
/**
 * Use the tenant's credit on open charges (a charge just raised, usually):
 * the oldest credit first, onto the oldest due charge first. Returns the
 * allocations, each naming the payment the money came from, and the credit
 * left on each payment.
 */
export declare function applyCredit(credits: readonly PaymentCredit[], charges: readonly AllocatableCharge[], opts?: {
    chargeIds?: readonly string[];
}): {
    allocations: CreditAllocation[];
    remaining: PaymentCredit[];
};
/** The unallocated part of a payment: its credit. Never negative. */
export declare function paymentCreditRwf(paymentAmountRwf: number, allocatedRwf: readonly number[]): number;
/**
 * The charges after the allocations are applied: `paidRwf` raised and the
 * status worked out again. Refuses allocations that would overpay a charge.
 */
export declare function applyAllocations<T extends AllocatableCharge>(charges: readonly T[], allocations: readonly Allocation[]): T[];
//# sourceMappingURL=allocation.d.ts.map