import { z } from "zod";
import { SelectedOption, TaxCode } from "./ops";
import { Uuid } from "./primitives";
/**
 * The bar and restaurant point of sale (POS spec, phase 1).
 *
 * Tables and their sessions, orders taken at the table or the counter, the
 * kitchen and bar tickets an order sends, payments (several per order, every
 * provider SIMULATED), and the cashier's register and shift.
 *
 * THREE STATUSES, NEVER ONE. An order's status (where the food is), its
 * payment status (how much of the bill is collected) and, in a later phase,
 * its fiscal status are separate facts. `settlementOf` derives the second from
 * the payments; nothing stores "paid" on an order except the instant it was.
 *
 * MONEY IS WHOLE RWF, IN INTEGERS. Every function here takes and returns safe
 * integers, and the one division a tax needs rounds half up, explicitly, per
 * line. No binary fraction ever touches an amount.
 */
// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------
export const PosOrderType = z.enum(["dine_in", "takeaway", "delivery", "room_service", "event"]);
export type PosOrderType = z.infer<typeof PosOrderType>;
export const POS_ORDER_TYPE_LABEL: Readonly<Record<PosOrderType, string>> = {
    dine_in: "Dine in",
    takeaway: "Takeaway",
    delivery: "Delivery",
    room_service: "Room service",
    event: "Event catering",
};
/**
 * Whether an outlet's menu prices already include tax. `exclusive` is what
 * every other channel reads a `service_items.price_rwf` as, so it is the
 * default; `inclusive` is the usual way a Rwandan bar prints its menu.
 */
export const PosTaxMode = z.enum(["exclusive", "inclusive"]);
export type PosTaxMode = z.infer<typeof PosTaxMode>;
export const TableStatus = z.enum(["available", "occupied", "reserved", "bill_requested", "cleaning"]);
export type TableStatus = z.infer<typeof TableStatus>;
export const TABLE_STATUS_LABEL: Readonly<Record<TableStatus, string>> = {
    available: "Available",
    occupied: "Occupied",
    reserved: "Reserved",
    bill_requested: "Bill requested",
    cleaning: "Cleaning",
};
/**
 * The moves a table may make by hand. Opening a session makes a table
 * `occupied` and closing one makes it `cleaning`; those two are the service's
 * and are not offered here.
 */
export const TABLE_STATUS_MOVES: Readonly<Record<TableStatus, readonly TableStatus[]>> = {
    available: ["reserved", "cleaning"],
    reserved: ["available"],
    occupied: ["bill_requested"],
    bill_requested: ["occupied"],
    cleaning: ["available"],
};
export const PrepStationKind = z.enum(["kitchen", "bar"]);
export type PrepStationKind = z.infer<typeof PrepStationKind>;
export const TicketStatus = z.enum(["queued", "preparing", "ready", "served", "cancelled"]);
export type TicketStatus = z.infer<typeof TicketStatus>;
export const TICKET_STATUS_LABEL: Readonly<Record<TicketStatus, string>> = {
    queued: "Queued",
    preparing: "Preparing",
    ready: "Ready",
    served: "Served",
    cancelled: "Cancelled",
};
/** A bottle of water may go straight from the queue to the pass, so `queued -> ready` is allowed. */
export const TICKET_TRANSITIONS: Readonly<Record<TicketStatus, readonly TicketStatus[]>> = {
    queued: ["preparing", "ready", "cancelled"],
    preparing: ["ready", "cancelled"],
    ready: ["served"],
    served: [],
    cancelled: [],
};
export function canMoveTicket(from: TicketStatus, to: TicketStatus): boolean {
    return TICKET_TRANSITIONS[from].includes(to);
}
/** Minutes after which a waiting ticket is drawn as late. */
export const TICKET_LATE_MINUTES = 15;
/** A line on an order: drafted, sent to its station, or voided after the fact. */
export const PosLineStatus = z.enum(["draft", "sent", "voided"]);
export type PosLineStatus = z.infer<typeof PosLineStatus>;
/** The order's own progress. Payment is NOT in here: see `settlementOf`. */
export const PosOrderStatus = z.enum(["draft", "submitted", "in_progress", "ready", "delivered", "completed", "cancelled"]);
export type PosOrderStatus = z.infer<typeof PosOrderStatus>;
export const POS_ORDER_STATUS_LABEL: Readonly<Record<PosOrderStatus, string>> = {
    draft: "Draft",
    submitted: "Sent",
    in_progress: "Preparing",
    ready: "Ready",
    delivered: "Served",
    completed: "Completed",
    cancelled: "Cancelled",
};
export const PosPaymentMethod = z.enum([
    "cash",
    "mtn_momo",
    "airtel_money",
    "card",
    "bank_transfer",
    "voucher",
    "customer_credit",
]);
export type PosPaymentMethod = z.infer<typeof PosPaymentMethod>;
/** Every non cash method is SIMULATED, and the label says so wherever it shows. */
export const POS_PAYMENT_METHOD_LABEL: Readonly<Record<PosPaymentMethod, string>> = {
    cash: "Cash",
    mtn_momo: "MTN MoMo (simulated)",
    airtel_money: "Airtel Money (simulated)",
    card: "Card (simulated)",
    bank_transfer: "Bank transfer (simulated)",
    voucher: "Voucher",
    customer_credit: "Customer credit",
};
/** The methods a provider would answer for asynchronously, so a payment can wait in `pending`. */
export const ASYNC_PAYMENT_METHODS: readonly PosPaymentMethod[] = ["mtn_momo", "airtel_money", "bank_transfer"];
export const PosPaymentStatus = z.enum([
    "initiated",
    "pending",
    "successful",
    "failed",
    "cancelled",
    "expired",
    "refunded",
]);
export type PosPaymentStatus = z.infer<typeof PosPaymentStatus>;
export const PAYMENT_TRANSITIONS: Readonly<Record<PosPaymentStatus, readonly PosPaymentStatus[]>> = {
    initiated: ["pending", "successful", "failed", "cancelled"],
    pending: ["successful", "failed", "expired", "cancelled"],
    successful: ["refunded"],
    failed: [],
    cancelled: [],
    expired: [],
    refunded: [],
};
export function canMovePayment(from: PosPaymentStatus, to: PosPaymentStatus): boolean {
    return PAYMENT_TRANSITIONS[from].includes(to);
}
/** What the demo provider is told to answer. Never a real provider call. */
export const SimulatedOutcome = z.enum(["success", "pending", "failure", "timeout"]);
export type SimulatedOutcome = z.infer<typeof SimulatedOutcome>;
export const ShiftStatus = z.enum(["open", "closed", "reviewed"]);
export type ShiftStatus = z.infer<typeof ShiftStatus>;
export const CashMovementKind = z.enum(["paid_in", "paid_out"]);
export type CashMovementKind = z.infer<typeof CashMovementKind>;
export const ApprovalStatus = z.enum(["approved", "pending_approval", "rejected"]);
export type ApprovalStatus = z.infer<typeof ApprovalStatus>;
/** The stamp every simulated payment carries, on screen and on paper. */
export const POS_PAYMENT_SIMULATION_NOTICE = "SIMULATED PAYMENT. No money moved and no provider was contacted.";
// ---------------------------------------------------------------------------
// Money: integer RWF, half up per line
// ---------------------------------------------------------------------------
function assertAmount(n: number, what: string): void {
    if (!Number.isSafeInteger(n)) throw new RangeError(`${what} must be a whole number of RWF.`);
}
/** `n / d` rounded half up, for `n >= 0` and `d > 0`, with no fraction in between. */
export function divRoundHalfUp(n: number, d: number): number {
    assertAmount(n, "The amount");
    if (!Number.isSafeInteger(d) || d <= 0) throw new RangeError("The divisor must be a positive whole number.");
    if (n < 0) return -divRoundHalfUp(-n, d);
    return Math.floor((2 * n + d) / (2 * d));
}
/**
 * A tax rate as basis points: `0.18` is `1800`. The rates in config are
 * decimals, so this is where a fraction stops: rounded once, to a whole basis
 * point, and every later step is integers.
 */
export function rateToBps(rate: number): number {
    if (!Number.isFinite(rate) || rate < 0 || rate > 1) throw new RangeError("A tax rate is between 0 and 1.");
    return Math.round(rate * 10_000);
}
export interface PosLineInput {
    unitPriceRwf: number;
    quantity: number;
    /** The discount on this line, in RWF, already including its share of an order discount. */
    discountRwf: number;
    taxRateBps: number;
}
export interface PosLineAmounts {
    /** Unit price times quantity, before any discount. */
    grossRwf: number;
    discountRwf: number;
    /** Gross less discount: what the line sells for, in the outlet's tax mode. */
    netRwf: number;
    taxRwf: number;
    /** What the customer pays for the line. */
    totalRwf: number;
}
/**
 * One line's amounts.
 *
 * EXCLUSIVE: the tax is added, `round(net x rate)`, the same per line rule the
 * service orders already price by. INCLUSIVE: the tax is inside the price,
 * `round(net x rate / (1 + rate))`, so RWF 11,800 at 18% carries RWF 1,800 tax
 * on RWF 10,000 of revenue.
 */
export function lineAmounts(line: PosLineInput, mode: PosTaxMode): PosLineAmounts {
    assertAmount(line.unitPriceRwf, "A unit price");
    assertAmount(line.discountRwf, "A discount");
    if (!Number.isSafeInteger(line.quantity) || line.quantity < 1) throw new RangeError("A quantity is a whole number from 1.");
    if (line.unitPriceRwf < 0) throw new RangeError("A unit price cannot be negative.");
    if (!Number.isSafeInteger(line.taxRateBps) || line.taxRateBps < 0 || line.taxRateBps > 10_000) {
        throw new RangeError("A tax rate is 0 to 10,000 basis points.");
    }
    const grossRwf = line.unitPriceRwf * line.quantity;
    assertAmount(grossRwf, "A line total");
    if (line.discountRwf < 0 || line.discountRwf > grossRwf) throw new RangeError("A discount runs from nothing to the whole line.");
    const netRwf = grossRwf - line.discountRwf;
    if (mode === "exclusive") {
        const taxRwf = divRoundHalfUp(netRwf * line.taxRateBps, 10_000);
        return { grossRwf, discountRwf: line.discountRwf, netRwf, taxRwf, totalRwf: netRwf + taxRwf };
    }
    const taxRwf = divRoundHalfUp(netRwf * line.taxRateBps, 10_000 + line.taxRateBps);
    return { grossRwf, discountRwf: line.discountRwf, netRwf, taxRwf, totalRwf: netRwf };
}
/**
 * Share `amount` across `weights` in proportion, in whole RWF, so the shares
 * add up to exactly `amount` (largest remainder; ties go to the earlier line).
 */
export function allocate(amount: number, weights: readonly number[]): number[] {
    assertAmount(amount, "The amount to share");
    if (amount < 0) throw new RangeError("Only a positive amount is shared.");
    for (const w of weights) assertAmount(w, "A weight");
    const total = weights.reduce((a, b) => a + b, 0);
    if (total === 0) {
        if (amount === 0) return weights.map(() => 0);
        throw new RangeError("Nothing to share the amount across.");
    }
    if (amount > total) throw new RangeError("The amount is larger than what it is shared across.");
    const shares = weights.map((w) => Math.floor((amount * w) / total));
    let left = amount - shares.reduce((a, b) => a + b, 0);
    const order = weights
        .map((w, i) => ({ i, rest: (amount * w) % total }))
        .sort((a, b) => b.rest - a.rest || a.i - b.i);
    for (const { i } of order) {
        if (left === 0) break;
        shares[i] = (shares[i] ?? 0) + 1;
        left -= 1;
    }
    return shares;
}
export interface PosOrderLineInput {
    unitPriceRwf: number;
    quantity: number;
    /** A discount given on this line alone. */
    lineDiscountRwf: number;
    taxRateBps: number;
}
export interface PosOrderAmounts {
    lines: (PosLineAmounts & { orderDiscountShareRwf: number })[];
    grossRwf: number;
    discountRwf: number;
    netRwf: number;
    taxRwf: number;
    totalRwf: number;
}
/**
 * The bill. The order level discount is shared across the lines by what each
 * still sells for, BEFORE tax, so the tax is charged on what was actually
 * charged. Voided lines are not passed in.
 */
export function orderAmounts(lines: readonly PosOrderLineInput[], orderDiscountRwf: number, mode: PosTaxMode): PosOrderAmounts {
    const remaining = lines.map((l) => l.unitPriceRwf * l.quantity - l.lineDiscountRwf);
    if (remaining.some((r) => r < 0)) throw new RangeError("A line discount is larger than its line.");
    const shares = allocate(orderDiscountRwf, remaining);
    const priced = lines.map((l, i) => {
        const share = shares[i] ?? 0;
        return {
            ...lineAmounts({ unitPriceRwf: l.unitPriceRwf, quantity: l.quantity, discountRwf: l.lineDiscountRwf + share, taxRateBps: l.taxRateBps }, mode),
            orderDiscountShareRwf: share,
        };
    });
    const sum = (k: keyof PosLineAmounts) => priced.reduce((a, l) => a + l[k], 0);
    return {
        lines: priced,
        grossRwf: sum("grossRwf"),
        discountRwf: sum("discountRwf"),
        netRwf: sum("netRwf"),
        taxRwf: sum("taxRwf"),
        totalRwf: sum("totalRwf"),
    };
}
/** Does a discount of `discountRwf` on `grossRwf` exceed the outlet's limit and wait for `pos.override`? */
export function discountNeedsApproval(discountRwf: number, grossRwf: number, limitBps: number): boolean {
    assertAmount(discountRwf, "A discount");
    assertAmount(grossRwf, "A gross amount");
    if (discountRwf <= 0) return false;
    return discountRwf * 10_000 > grossRwf * limitBps;
}
export interface PaymentForSettlement {
    amountRwf: number;
    refundedRwf: number;
    status: PosPaymentStatus;
}
export const PosPaymentState = z.enum(["unpaid", "partially_paid", "paid", "overpaid"]);
export type PosPaymentState = z.infer<typeof PosPaymentState>;
export interface Settlement {
    totalRwf: number;
    /** What successful payments paid toward the bill, refunds NOT taken off. */
    collectedRwf: number;
    /**
     * Given back after the bill settled. A refund is a correction of a settled
     * sale: it lowers net sales and the drawer, and never makes the customer
     * owe the bill again.
     */
    refundedRwf: number;
    /** Initiated and pending payments: in flight, not collected, but not payable twice. */
    pendingRwf: number;
    outstandingRwf: number;
    /** What may be asked of a new payment now: the outstanding less what is in flight. */
    payableRwf: number;
    state: PosPaymentState;
    /** The settlement rule: everything due collected, nothing in flight. */
    settled: boolean;
}
/** How much of a bill is collected. The ONE place a payment state is derived. */
export function settlementOf(totalRwf: number, payments: readonly PaymentForSettlement[]): Settlement {
    assertAmount(totalRwf, "A total");
    let collectedRwf = 0;
    let refundedRwf = 0;
    let pendingRwf = 0;
    for (const p of payments) {
        assertAmount(p.amountRwf, "A payment");
        assertAmount(p.refundedRwf, "A refund");
        if (p.status === "successful" || p.status === "refunded") {
            collectedRwf += p.amountRwf;
            refundedRwf += p.refundedRwf;
        }
        else if (p.status === "initiated" || p.status === "pending") pendingRwf += p.amountRwf;
    }
    const outstandingRwf = Math.max(0, totalRwf - collectedRwf);
    const payableRwf = Math.max(0, outstandingRwf - pendingRwf);
    const state: PosPaymentState = collectedRwf <= 0 ? (totalRwf === 0 ? "paid" : "unpaid") : collectedRwf < totalRwf ? "partially_paid" : collectedRwf === totalRwf ? "paid" : "overpaid";
    return {
        totalRwf,
        collectedRwf,
        refundedRwf,
        pendingRwf,
        outstandingRwf,
        payableRwf,
        state,
        settled: outstandingRwf === 0 && pendingRwf === 0,
    };
}
export type PaymentCheck = {
    ok: true;
    changeRwf: number;
} | {
    ok: false;
    problem: string;
};
/**
 * Whether a new payment may be taken. Cash may be handed over in excess and
 * the change is given back; every other method takes exactly what it pays.
 * Nothing may pay more than is payable, so two payments in flight cannot
 * together collect a bill twice.
 */
export function checkPayment(settlement: Settlement, method: PosPaymentMethod, amountRwf: number, tenderedRwf: number | null): PaymentCheck {
    assertAmount(amountRwf, "A payment");
    if (amountRwf <= 0) return { ok: false, problem: "A payment is more than nothing." };
    if (settlement.payableRwf === 0) {
        return {
            ok: false,
            problem: settlement.pendingRwf > 0 ? "A payment is still waiting for its answer. Resolve it before taking another." : "Nothing is left to pay on this bill.",
        };
    }
    if (amountRwf > settlement.payableRwf) {
        return { ok: false, problem: `At most RWF ${settlement.payableRwf.toLocaleString("en-US")} is left to pay.` };
    }
    if (method === "cash") {
        const tendered = tenderedRwf ?? amountRwf;
        assertAmount(tendered, "The cash handed over");
        if (tendered < amountRwf) return { ok: false, problem: "The cash handed over is less than the amount paid." };
        return { ok: true, changeRwf: tendered - amountRwf };
    }
    if (tenderedRwf !== null && tenderedRwf !== amountRwf) {
        return { ok: false, problem: "Only cash gives change." };
    }
    return { ok: true, changeRwf: 0 };
}
export interface ShiftCashFacts {
    openingFloatRwf: number;
    /** Successful cash payments, as applied to bills (change already given back). */
    cashSalesRwf: number;
    cashRefundsRwf: number;
    paidInRwf: number;
    /** Approved paid outs only: one waiting for approval has not left the drawer. */
    paidOutRwf: number;
}
/** What the drawer should hold at close. */
export function expectedCash(f: ShiftCashFacts): number {
    for (const v of Object.values(f)) assertAmount(v, "A cash figure");
    return f.openingFloatRwf + f.cashSalesRwf - f.cashRefundsRwf + f.paidInRwf - f.paidOutRwf;
}
/** Counted less expected: positive is over, negative is short. */
export function cashVariance(countedRwf: number, expectedRwf: number): number {
    assertAmount(countedRwf, "The counted cash");
    assertAmount(expectedRwf, "The expected cash");
    return countedRwf - expectedRwf;
}
/** `DEMO-MOMO-7F3K2Q`: a reference no one could mistake for a provider's. */
export function demoPaymentReference(method: PosPaymentMethod, token: string): string {
    const code: Record<PosPaymentMethod, string> = {
        cash: "CASH",
        mtn_momo: "MOMO",
        airtel_money: "AIRTEL",
        card: "CARD",
        bank_transfer: "BANK",
        voucher: "VCHR",
        customer_credit: "CRDT",
    };
    const clean = token.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 8).padEnd(6, "0");
    return `DEMO-${code[method]}-${clean}`;
}
// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
export const PosOutletSettings = z.object({
    outletId: Uuid,
    taxMode: PosTaxMode,
    /** The largest discount a `pos.discount` holder may give alone, as basis points of the gross. */
    discountLimitBps: z.number().int().min(0).max(10_000),
    enabledMethods: z.array(PosPaymentMethod).min(1),
    receiptHeader: z.string().max(200),
    receiptFooter: z.string().max(200),
});
export type PosOutletSettings = z.infer<typeof PosOutletSettings>;
export const UpdatePosOutletSettingsRequest = PosOutletSettings.omit({ outletId: true }).partial();
export type UpdatePosOutletSettingsRequest = z.infer<typeof UpdatePosOutletSettingsRequest>;
// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------
export const PosOutlet = z.object({
    id: Uuid,
    name: z.string(),
    outletKind: z.string(),
    /** The branch, or null for a standalone outlet. */
    propertyId: Uuid.nullable(),
    branchName: z.string().nullable(),
    settings: PosOutletSettings,
});
export type PosOutlet = z.infer<typeof PosOutlet>;
export const PosStation = z.object({
    id: Uuid,
    outletId: Uuid,
    name: z.string(),
    kind: PrepStationKind,
    printerName: z.string().nullable(),
});
export type PosStation = z.infer<typeof PosStation>;
export const PosMenuItem = z.object({
    id: Uuid,
    categoryId: Uuid,
    name: z.string(),
    description: z.string().nullable(),
    sku: z.string().nullable(),
    priceRwf: z.number().int(),
    taxCode: TaxCode,
    taxRateBps: z.number().int(),
    options: z.array(z.object({
        name: z.string(),
        required: z.boolean(),
        maxChoices: z.number().int(),
        choices: z.array(z.object({ label: z.string(), priceDeltaRwf: z.number().int() })),
    })),
    stationId: Uuid.nullable(),
    available: z.boolean(),
    /** Why it cannot be sold, when it cannot. */
    unavailableReason: z.string().nullable(),
});
export type PosMenuItem = z.infer<typeof PosMenuItem>;
export const PosMenu = z.object({
    outletId: Uuid,
    taxMode: PosTaxMode,
    categories: z.array(z.object({ id: Uuid, name: z.string(), sortOrder: z.number().int() })),
    items: z.array(PosMenuItem),
});
export type PosMenu = z.infer<typeof PosMenu>;
export const PosTable = z.object({
    id: Uuid,
    areaId: Uuid,
    label: z.string(),
    seats: z.number().int(),
    status: TableStatus,
    sessionId: Uuid.nullable(),
    guestCount: z.number().int().nullable(),
    waiterName: z.string().nullable(),
    openedAt: z.string().nullable(),
    openOrders: z.number().int(),
    /** What the open session's orders still owe, collected payments taken off. */
    outstandingRwf: z.number().int(),
});
export type PosTable = z.infer<typeof PosTable>;
export const PosFloor = z.object({
    outletId: Uuid,
    areas: z.array(z.object({ id: Uuid, name: z.string(), sortOrder: z.number().int() })),
    tables: z.array(PosTable),
});
export type PosFloor = z.infer<typeof PosFloor>;
export const PosOrderLine = z.object({
    id: Uuid,
    serviceItemId: Uuid.nullable(),
    name: z.string(),
    sku: z.string().nullable(),
    quantity: z.number().int(),
    unitPriceRwf: z.number().int(),
    selectedOptions: z.array(z.object({
        name: z.string(),
        choices: z.array(z.object({ label: z.string(), priceDeltaRwf: z.number().int() })),
    })),
    note: z.string().nullable(),
    status: PosLineStatus,
    taxCode: TaxCode.nullable(),
    taxRateBps: z.number().int(),
    grossRwf: z.number().int(),
    discountRwf: z.number().int(),
    taxRwf: z.number().int(),
    totalRwf: z.number().int(),
    voidReason: z.string().nullable(),
    stationId: Uuid.nullable(),
});
export type PosOrderLine = z.infer<typeof PosOrderLine>;
export const PosDiscount = z.object({
    id: Uuid,
    orderItemId: Uuid.nullable(),
    amountRwf: z.number().int(),
    reason: z.string(),
    status: ApprovalStatus,
    requestedByName: z.string().nullable(),
    decidedByName: z.string().nullable(),
    createdAt: z.string(),
});
export type PosDiscount = z.infer<typeof PosDiscount>;
export const PosPayment = z.object({
    id: Uuid,
    orderId: Uuid,
    method: PosPaymentMethod,
    amountRwf: z.number().int(),
    tenderedRwf: z.number().int().nullable(),
    changeRwf: z.number().int(),
    tipRwf: z.number().int(),
    refundedRwf: z.number().int(),
    status: PosPaymentStatus,
    demoReference: z.string(),
    simulated: z.boolean(),
    failureReason: z.string().nullable(),
    shiftId: Uuid.nullable(),
    createdByName: z.string().nullable(),
    createdAt: z.string(),
    settledAt: z.string().nullable(),
});
export type PosPayment = z.infer<typeof PosPayment>;
export const PosSettlement = z.object({
    totalRwf: z.number().int(),
    collectedRwf: z.number().int(),
    refundedRwf: z.number().int(),
    pendingRwf: z.number().int(),
    outstandingRwf: z.number().int(),
    payableRwf: z.number().int(),
    state: PosPaymentState,
    settled: z.boolean(),
});
/**
 * The customer on an order (CRM, phase 1), small enough to ride on every order read. The phone is masked
 * here whatever the reader's role: the order screen needs a name to greet, never a number to copy.
 * Defined here, not in `customers.ts`, because that file imports this one.
 */
export const PosOrderCustomer = z.object({
    id: Uuid,
    fullName: z.string(),
    phoneMasked: z.string(),
});
export type PosOrderCustomer = z.infer<typeof PosOrderCustomer>;
export const PosOrder = z.object({
    id: Uuid,
    orderNumber: z.string(),
    outletId: Uuid,
    orderType: PosOrderType,
    status: PosOrderStatus,
    tableSessionId: Uuid.nullable(),
    tableLabel: z.string().nullable(),
    waiterName: z.string().nullable(),
    guestNote: z.string().nullable(),
    /** Who the bill is for, when the staff attached a customer. Absent on orders read before CRM existed. */
    customer: PosOrderCustomer.nullable().optional(),
    taxMode: PosTaxMode,
    grossRwf: z.number().int(),
    discountRwf: z.number().int(),
    taxRwf: z.number().int(),
    totalRwf: z.number().int(),
    settlement: PosSettlement,
    lines: z.array(PosOrderLine),
    discounts: z.array(PosDiscount),
    payments: z.array(PosPayment),
    cancelReason: z.string().nullable(),
    createdAt: z.string(),
    settledAt: z.string().nullable(),
});
export type PosOrder = z.infer<typeof PosOrder>;
export const PosOrderSummary = PosOrder.omit({ lines: true, discounts: true, payments: true }).extend({
    lineCount: z.number().int(),
});
export type PosOrderSummary = z.infer<typeof PosOrderSummary>;
export const PosTicketItem = z.object({
    id: Uuid,
    orderItemId: Uuid,
    name: z.string(),
    quantity: z.number().int(),
    options: z.array(z.string()),
    note: z.string().nullable(),
    status: TicketStatus,
});
export const PosTicket = z.object({
    id: Uuid,
    ticketNumber: z.string(),
    orderId: Uuid,
    orderNumber: z.string(),
    stationId: Uuid,
    stationName: z.string(),
    stationKind: PrepStationKind,
    status: TicketStatus,
    tableLabel: z.string().nullable(),
    waiterName: z.string().nullable(),
    orderType: PosOrderType,
    /** The order's guest note (a name, an allergy), or null. An order has no customer-name field of its own. */
    guestNote: z.string().nullable(),
    /** The table's party size, or null for an order without a table. */
    guestCount: z.number().int().nullable(),
    items: z.array(PosTicketItem),
    createdAt: z.string(),
    startedAt: z.string().nullable(),
    readyAt: z.string().nullable(),
    servedAt: z.string().nullable(),
    /** Whole minutes since the ticket was sent, at read time. */
    elapsedMinutes: z.number().int(),
    late: z.boolean(),
    printCount: z.number().int(),
});
export type PosTicket = z.infer<typeof PosTicket>;
export const PosRegister = z.object({
    id: Uuid,
    outletId: Uuid,
    name: z.string(),
    deviceLabel: z.string().nullable(),
    openShiftId: Uuid.nullable(),
    openShiftCashierName: z.string().nullable(),
});
export type PosRegister = z.infer<typeof PosRegister>;
export const PosCashMovement = z.object({
    id: Uuid,
    kind: CashMovementKind,
    amountRwf: z.number().int(),
    reason: z.string(),
    status: ApprovalStatus,
    requestedByName: z.string().nullable(),
    decidedByName: z.string().nullable(),
    createdAt: z.string(),
});
export type PosCashMovement = z.infer<typeof PosCashMovement>;
export const PosShift = z.object({
    id: Uuid,
    registerId: Uuid,
    registerName: z.string(),
    cashierUserId: Uuid,
    cashierName: z.string().nullable(),
    status: ShiftStatus,
    openingFloatRwf: z.number().int(),
    openedAt: z.string(),
    closedAt: z.string().nullable(),
    cashSalesRwf: z.number().int(),
    cashRefundsRwf: z.number().int(),
    paidInRwf: z.number().int(),
    paidOutRwf: z.number().int(),
    /** Computed now for an open shift, frozen at close. */
    expectedCashRwf: z.number().int(),
    countedCashRwf: z.number().int().nullable(),
    varianceRwf: z.number().int().nullable(),
    takingsByMethod: z.array(z.object({ method: PosPaymentMethod, amountRwf: z.number().int(), count: z.number().int() })),
    tipsRwf: z.number().int(),
    closeNote: z.string().nullable(),
    handoverNote: z.string().nullable(),
    reviewedByName: z.string().nullable(),
    reviewNote: z.string().nullable(),
    movements: z.array(PosCashMovement),
});
export type PosShift = z.infer<typeof PosShift>;
export const PosAuditEvent = z.object({
    id: Uuid,
    occurredAt: z.string(),
    actorName: z.string().nullable(),
    outletId: Uuid.nullable(),
    action: z.string(),
    entityType: z.string(),
    entityId: Uuid.nullable(),
    before: z.unknown().nullable(),
    after: z.unknown().nullable(),
    reason: z.string().nullable(),
});
export type PosAuditEvent = z.infer<typeof PosAuditEvent>;
// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------
const reason = z.string().trim().min(3, "Say why, in a few words.").max(500);
const note = z.string().trim().max(500);
export const OpenTableSessionRequest = z.object({
    guestCount: z.number().int().min(1).max(200),
    /** Defaults to the person opening it. */
    waiterUserId: Uuid.optional(),
});
export type OpenTableSessionRequest = z.infer<typeof OpenTableSessionRequest>;
export const SetTableStatusRequest = z.object({ status: TableStatus });
export type SetTableStatusRequest = z.infer<typeof SetTableStatusRequest>;
export const MoveSessionRequest = z.object({ toTableId: Uuid });
export type MoveSessionRequest = z.infer<typeof MoveSessionRequest>;
export const MergeSessionsRequest = z.object({ fromSessionId: Uuid });
export type MergeSessionsRequest = z.infer<typeof MergeSessionsRequest>;
export const PosLineRequest = z.object({
    serviceItemId: Uuid,
    quantity: z.number().int().min(1).max(500),
    selectedOptions: z.array(SelectedOption).max(20).optional(),
    note: note.optional(),
});
export type PosLineRequest = z.infer<typeof PosLineRequest>;
export const CreatePosOrderRequest = z
    .object({
    outletId: Uuid,
    orderType: PosOrderType,
    tableSessionId: Uuid.optional(),
    guestNote: note.optional(),
    lines: z.array(PosLineRequest).max(100).default([]),
})
    .superRefine((v, ctx) => {
    if (v.orderType === "dine_in" && !v.tableSessionId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["tableSessionId"], message: "A dine in order is opened at a table." });
    }
    if (v.orderType !== "dine_in" && v.tableSessionId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["tableSessionId"], message: "Only a dine in order sits at a table." });
    }
});
export type CreatePosOrderRequest = z.infer<typeof CreatePosOrderRequest>;
export const AddPosLinesRequest = z.object({ lines: z.array(PosLineRequest).min(1).max(100) });
export type AddPosLinesRequest = z.infer<typeof AddPosLinesRequest>;
/** Only a draft line can be changed; a sent one is voided and re-added. */
export const UpdatePosLineRequest = z.object({
    quantity: z.number().int().min(1).max(500).optional(),
    note: note.nullable().optional(),
});
export type UpdatePosLineRequest = z.infer<typeof UpdatePosLineRequest>;
export const VoidPosLineRequest = z.object({ reason });
export type VoidPosLineRequest = z.infer<typeof VoidPosLineRequest>;
export const CancelPosOrderRequest = z.object({ reason });
export type CancelPosOrderRequest = z.infer<typeof CancelPosOrderRequest>;
export const ApplyPosDiscountRequest = z
    .object({
    /** A line, or the whole order when absent. */
    orderItemId: Uuid.optional(),
    kind: z.enum(["amount", "percent"]),
    /** RWF for `amount`, basis points for `percent` (1000 is 10%). */
    value: z.number().int().min(1),
    reason,
})
    .superRefine((v, ctx) => {
    if (v.kind === "percent" && v.value > 10_000) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: "A percentage runs to 100%." });
    }
});
export type ApplyPosDiscountRequest = z.infer<typeof ApplyPosDiscountRequest>;
export const DecidePosDiscountRequest = z.object({ approve: z.boolean(), note: note.optional() });
export type DecidePosDiscountRequest = z.infer<typeof DecidePosDiscountRequest>;
export const TransferPosOrderRequest = z.object({ toTableSessionId: Uuid, reason });
export type TransferPosOrderRequest = z.infer<typeof TransferPosOrderRequest>;
/** Move whole lines to a new order on the same session: the split bill. */
export const SplitPosOrderRequest = z.object({ orderItemIds: z.array(Uuid).min(1).max(100) });
export type SplitPosOrderRequest = z.infer<typeof SplitPosOrderRequest>;
export const TakePosPaymentRequest = z.object({
    method: PosPaymentMethod,
    amountRwf: z.number().int().min(1),
    /** Cash handed over, when more than the amount. */
    tenderedRwf: z.number().int().min(1).optional(),
    tipRwf: z.number().int().min(0).default(0),
    /** What the demo provider answers. Ignored for cash and vouchers, which settle at once. */
    simulate: SimulatedOutcome.default("success"),
    /** A fictional payer number for the simulated mobile money prompt. */
    payerPhone: z.string().trim().regex(/^\+?\d{9,15}$/, "A phone number, digits only.").optional(),
    voucherCode: z.string().trim().min(3).max(40).optional(),
    /** One per press of "Take payment": a retried request returns the first payment. */
    idempotencyKey: z.string().trim().min(8).max(100),
});
export type TakePosPaymentRequest = z.infer<typeof TakePosPaymentRequest>;
/** The simulated provider callback for a pending payment. */
export const ResolvePosPaymentRequest = z.object({ outcome: z.enum(["success", "failure", "timeout"]) });
export type ResolvePosPaymentRequest = z.infer<typeof ResolvePosPaymentRequest>;
export const RefundPosPaymentRequest = z.object({
    amountRwf: z.number().int().min(1),
    reason,
    idempotencyKey: z.string().trim().min(8).max(100),
});
export type RefundPosPaymentRequest = z.infer<typeof RefundPosPaymentRequest>;
export const AdvancePosTicketRequest = z.object({ to: TicketStatus });
export type AdvancePosTicketRequest = z.infer<typeof AdvancePosTicketRequest>;
export const OpenShiftRequest = z.object({
    registerId: Uuid,
    openingFloatRwf: z.number().int().min(0).max(50_000_000),
});
export type OpenShiftRequest = z.infer<typeof OpenShiftRequest>;
export const CloseShiftRequest = z.object({
    countedCashRwf: z.number().int().min(0).max(500_000_000),
    closeNote: note.optional(),
    handoverNote: note.optional(),
});
export type CloseShiftRequest = z.infer<typeof CloseShiftRequest>;
export const CashMovementRequest = z.object({
    kind: CashMovementKind,
    amountRwf: z.number().int().min(1).max(50_000_000),
    reason,
});
export type CashMovementRequest = z.infer<typeof CashMovementRequest>;
export const DecideCashMovementRequest = z.object({ approve: z.boolean() });
export type DecideCashMovementRequest = z.infer<typeof DecideCashMovementRequest>;
export const ReviewShiftRequest = z.object({ note: note.optional() });
export type ReviewShiftRequest = z.infer<typeof ReviewShiftRequest>;
export const PosListQuery = z.object({
    outletId: Uuid.optional(),
    status: z.string().trim().max(40).optional(),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type PosListQuery = z.infer<typeof PosListQuery>;

// ---------------------------------------------------------------------------
// Venue setup: the dining areas, tables, stations, registers and item routing
// an owner configures. Nothing here is money. Names are unique per outlet, and
// a table, station or register that is in use is never deleted: it is archived
// once nothing depends on it (the API refuses, with the reason, until then).
// ---------------------------------------------------------------------------
const venueName = z.string().trim().min(1, "Give it a name.").max(60, "Keep the name to 60 characters.");
const venueSort = z.number().int().min(0).max(9999);
export const PosVenueArea = z.object({
    id: Uuid,
    name: z.string(),
    sortOrder: z.number().int(),
    /** Tables in this area that are not archived. */
    tableCount: z.number().int(),
});
export type PosVenueArea = z.infer<typeof PosVenueArea>;
export const PosVenueTable = z.object({
    id: Uuid,
    areaId: Uuid,
    label: z.string(),
    seats: z.number().int(),
    status: TableStatus,
    sortOrder: z.number().int(),
    /** A party is seated here now, so the table cannot be archived. */
    hasOpenSession: z.boolean(),
});
export type PosVenueTable = z.infer<typeof PosVenueTable>;
export const PosVenueStation = z.object({
    id: Uuid,
    name: z.string(),
    kind: PrepStationKind,
    printerName: z.string().nullable(),
    sortOrder: z.number().int(),
    /** Menu items whose tickets go to this station. */
    routedItems: z.number().int(),
    /** Tickets still queued, being prepared or ready. */
    openTickets: z.number().int(),
});
export type PosVenueStation = z.infer<typeof PosVenueStation>;
export const PosVenueRegister = z.object({
    id: Uuid,
    name: z.string(),
    deviceLabel: z.string().nullable(),
    /** A cashier has a shift open on it now, so it cannot be archived. */
    hasOpenShift: z.boolean(),
});
export type PosVenueRegister = z.infer<typeof PosVenueRegister>;
export const PosVenueRoute = z.object({
    serviceItemId: Uuid,
    name: z.string(),
    categoryName: z.string().nullable(),
    /** The station that prepares it, or null when it sends no ticket (a bottle handed over the counter). */
    stationId: Uuid.nullable(),
});
export type PosVenueRoute = z.infer<typeof PosVenueRoute>;
export const PosVenue = z.object({
    outletId: Uuid,
    areas: z.array(PosVenueArea),
    tables: z.array(PosVenueTable),
    stations: z.array(PosVenueStation),
    registers: z.array(PosVenueRegister),
    routing: z.array(PosVenueRoute),
});
export type PosVenue = z.infer<typeof PosVenue>;
export const CreateAreaRequest = z.object({ name: venueName, sortOrder: venueSort.optional() });
export type CreateAreaRequest = z.infer<typeof CreateAreaRequest>;
export const UpdateAreaRequest = CreateAreaRequest.partial().refine((v) => Object.keys(v).length > 0, { message: "Say what to change." });
export type UpdateAreaRequest = z.infer<typeof UpdateAreaRequest>;
export const CreateTableRequest = z.object({
    areaId: Uuid,
    label: z.string().trim().min(1, "Give the table a label.").max(30, "Keep the label to 30 characters."),
    seats: z.number().int().min(1, "A table seats at least 1.").max(100, "A table seats at most 100."),
    sortOrder: venueSort.optional(),
});
export type CreateTableRequest = z.infer<typeof CreateTableRequest>;
export const UpdateTableRequest = CreateTableRequest.partial().refine((v) => Object.keys(v).length > 0, { message: "Say what to change." });
export type UpdateTableRequest = z.infer<typeof UpdateTableRequest>;
export const CreateStationRequest = z.object({
    name: venueName,
    kind: PrepStationKind,
    /** The name a SIMULATED print job is addressed to. No device is contacted. */
    printerName: z.string().trim().max(60).nullable().optional(),
    sortOrder: venueSort.optional(),
});
export type CreateStationRequest = z.infer<typeof CreateStationRequest>;
export const UpdateStationRequest = CreateStationRequest.partial().refine((v) => Object.keys(v).length > 0, { message: "Say what to change." });
export type UpdateStationRequest = z.infer<typeof UpdateStationRequest>;
export const CreateRegisterRequest = z.object({
    name: venueName,
    deviceLabel: z.string().trim().max(60).nullable().optional(),
});
export type CreateRegisterRequest = z.infer<typeof CreateRegisterRequest>;
export const UpdateRegisterRequest = CreateRegisterRequest.partial().refine((v) => Object.keys(v).length > 0, { message: "Say what to change." });
export type UpdateRegisterRequest = z.infer<typeof UpdateRegisterRequest>;
export const SetItemRouteRequest = z.object({
    serviceItemId: Uuid,
    /** null clears the route: the item then sends no ticket. */
    stationId: Uuid.nullable(),
});
export type SetItemRouteRequest = z.infer<typeof SetItemRouteRequest>;

// ---------------------------------------------------------------------------
// Setup progress: what an owner has configured so far, computed from the
// records themselves. Never stored, so it cannot drift from the truth, and
// never a gate: every screen stays open whatever is left.
// ---------------------------------------------------------------------------
export const POS_SETUP_STEPS = [
    "areas",
    "tables",
    "stations",
    "registers",
    "categories",
    "products",
    "routing",
    "receipts",
    "team",
] as const;
export const PosSetupStepKey = z.enum(POS_SETUP_STEPS);
export type PosSetupStepKey = z.infer<typeof PosSetupStepKey>;
export const PosSetupStep = z.object({
    key: PosSetupStepKey,
    done: z.boolean(),
    /** How many of the thing exist (areas, tables, products...). */
    count: z.number().int(),
});
export type PosSetupStep = z.infer<typeof PosSetupStep>;
export const PosSetup = z.object({
    outletId: Uuid,
    steps: z.array(PosSetupStep),
    doneCount: z.number().int(),
    total: z.number().int(),
});
export type PosSetup = z.infer<typeof PosSetup>;
