import { type LeaseChargeKind, type LeaseChargeStatus, isRwf } from "./vocab";

// ===========================================================================
// Allocation: which charges a payment pays
// ===========================================================================
//
// A payment, through the gateway or recorded, pays open charges oldest due
// first, unless the landlord picks which charges a recorded payment covers.
// Whatever is left over is the tenant's credit, and credit is used first on
// the next charge raised. These functions only work the numbers out; the API
// writes the allocations and the matching `paid_rwf` in one transaction, with
// the charges locked.
//
// The invariants every function here keeps:
// - an allocation is a whole number of francs above 0;
// - no charge is given more than it still owes;
// - no payment (or credit) gives more than it holds.

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

export class AllocationError extends Error {
  readonly code: AllocationErrorCode;
  constructor(code: AllocationErrorCode, message: string) {
    super(message);
    this.name = "AllocationError";
    this.code = code;
  }
}

/** What a charge still owes: nothing once paid or waived. */
export function outstandingRwf(charge: Pick<AllocatableCharge, "amountRwf" | "paidRwf" | "status">): number {
  if (charge.status !== "open") return 0;
  return Math.max(0, charge.amountRwf - charge.paidRwf);
}

/** The status a charge has once `paidRwf` of its `amountRwf` is paid (a waived charge stays waived). */
export function chargeStatusAfter(charge: Pick<AllocatableCharge, "amountRwf" | "status">, paidRwf: number): LeaseChargeStatus {
  if (charge.status === "waived") return "waived";
  return paidRwf >= charge.amountRwf ? "paid" : "open";
}

function assertCharge(c: AllocatableCharge): void {
  if (!isRwf(c.amountRwf) || c.amountRwf <= 0 || !isRwf(c.paidRwf) || c.paidRwf > c.amountRwf) {
    throw new AllocationError("bad_charge", `Charge ${c.id} has impossible amounts.`);
  }
}

const KIND_ORDER: Readonly<Record<LeaseChargeKind, number>> = { deposit: 0, rent: 1 };

/** Charges in the order money pays them: oldest due first, then the deposit, then the earlier period. */
export function allocationOrder<T extends AllocatableCharge>(charges: readonly T[]): T[] {
  return [...charges].sort((a, b) => {
    if (a.dueOn !== b.dueOn) return a.dueOn < b.dueOn ? -1 : 1;
    const ka = KIND_ORDER[a.kind ?? "rent"];
    const kb = KIND_ORDER[b.kind ?? "rent"];
    if (ka !== kb) return ka - kb;
    const pa = a.periodStart ?? "";
    const pb = b.periodStart ?? "";
    if (pa !== pb) return pa < pb ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/**
 * The charges a payment may pay: every open one with something owing, or,
 * when `chargeIds` is given, exactly those, each of which must exist and be
 * open with something owing. Oldest due first either way.
 */
function payableCharges(charges: readonly AllocatableCharge[], chargeIds?: readonly string[]): AllocatableCharge[] {
  charges.forEach(assertCharge);
  if (chargeIds === undefined) return allocationOrder(charges.filter((c) => outstandingRwf(c) > 0));
  const byId = new Map(charges.map((c) => [c.id, c]));
  const chosen: AllocatableCharge[] = [];
  for (const id of new Set(chargeIds)) {
    const charge = byId.get(id);
    if (!charge) throw new AllocationError("unknown_charge", `Charge ${id} is not on this lease.`);
    if (outstandingRwf(charge) <= 0) throw new AllocationError("charge_not_open", "That charge has nothing left to pay.");
    chosen.push(charge);
  }
  return allocationOrder(chosen);
}

/**
 * Spread a payment of `amountRwf` over the charges: oldest due first, each
 * up to what it owes, the rest as credit. `chargeIds` limits it to the
 * charges the landlord picked for a recorded payment.
 */
export function allocatePayment(
  amountRwf: number,
  charges: readonly AllocatableCharge[],
  opts: { chargeIds?: readonly string[] } = {},
): AllocationResult {
  if (!isRwf(amountRwf) || amountRwf <= 0) throw new AllocationError("bad_amount", "A payment is whole francs above 0.");
  let left = amountRwf;
  const allocations: Allocation[] = [];
  for (const charge of payableCharges(charges, opts.chargeIds)) {
    if (left === 0) break;
    const take = Math.min(left, outstandingRwf(charge));
    if (take > 0) {
      allocations.push({ chargeId: charge.id, amountRwf: take });
      left -= take;
    }
  }
  return { allocations, allocatedRwf: amountRwf - left, creditRwf: left };
}

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
export function applyCredit(
  credits: readonly PaymentCredit[],
  charges: readonly AllocatableCharge[],
  opts: { chargeIds?: readonly string[] } = {},
): { allocations: CreditAllocation[]; remaining: PaymentCredit[] } {
  for (const c of credits) {
    if (!isRwf(c.amountRwf)) throw new AllocationError("bad_amount", "Credit is whole francs.");
  }
  const owing = new Map(payableCharges(charges, opts.chargeIds).map((c) => [c.id, outstandingRwf(c)]));
  const order = [...owing.keys()];
  const allocations: CreditAllocation[] = [];
  const remaining: PaymentCredit[] = [];
  for (const credit of credits) {
    let left = credit.amountRwf;
    for (const chargeId of order) {
      if (left === 0) break;
      const owes = owing.get(chargeId) ?? 0;
      const take = Math.min(left, owes);
      if (take > 0) {
        allocations.push({ paymentId: credit.paymentId, chargeId, amountRwf: take });
        owing.set(chargeId, owes - take);
        left -= take;
      }
    }
    remaining.push({ paymentId: credit.paymentId, amountRwf: left });
  }
  return { allocations, remaining };
}

/** The unallocated part of a payment: its credit. Never negative. */
export function paymentCreditRwf(paymentAmountRwf: number, allocatedRwf: readonly number[]): number {
  const used = allocatedRwf.reduce((s, v) => s + v, 0);
  if (used > paymentAmountRwf) throw new AllocationError("bad_amount", "A payment was given out more than it holds.");
  return paymentAmountRwf - used;
}

/**
 * The charges after the allocations are applied: `paidRwf` raised and the
 * status worked out again. Refuses allocations that would overpay a charge.
 */
export function applyAllocations<T extends AllocatableCharge>(charges: readonly T[], allocations: readonly Allocation[]): T[] {
  const add = new Map<string, number>();
  for (const a of allocations) {
    if (!isRwf(a.amountRwf) || a.amountRwf <= 0) throw new AllocationError("bad_amount", "An allocation is whole francs above 0.");
    add.set(a.chargeId, (add.get(a.chargeId) ?? 0) + a.amountRwf);
  }
  for (const id of add.keys()) {
    if (!charges.some((c) => c.id === id)) throw new AllocationError("unknown_charge", `Charge ${id} is not on this lease.`);
  }
  return charges.map((c) => {
    const extra = add.get(c.id) ?? 0;
    if (extra === 0) return c;
    if (extra > outstandingRwf(c)) throw new AllocationError("charge_not_open", `Charge ${c.id} would be overpaid.`);
    const paidRwf = c.paidRwf + extra;
    return { ...c, paidRwf, status: chargeStatusAfter(c, paidRwf) };
  });
}
