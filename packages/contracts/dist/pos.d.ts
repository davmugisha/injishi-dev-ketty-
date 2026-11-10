import { z } from "zod";
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
export declare const PosOrderType: z.ZodEnum<["dine_in", "takeaway", "delivery", "room_service", "event"]>;
export type PosOrderType = z.infer<typeof PosOrderType>;
export declare const POS_ORDER_TYPE_LABEL: Readonly<Record<PosOrderType, string>>;
/**
 * Whether an outlet's menu prices already include tax. `exclusive` is what
 * every other channel reads a `service_items.price_rwf` as, so it is the
 * default; `inclusive` is the usual way a Rwandan bar prints its menu.
 */
export declare const PosTaxMode: z.ZodEnum<["exclusive", "inclusive"]>;
export type PosTaxMode = z.infer<typeof PosTaxMode>;
export declare const TableStatus: z.ZodEnum<["available", "occupied", "reserved", "bill_requested", "cleaning"]>;
export type TableStatus = z.infer<typeof TableStatus>;
export declare const TABLE_STATUS_LABEL: Readonly<Record<TableStatus, string>>;
/**
 * The moves a table may make by hand. Opening a session makes a table
 * `occupied` and closing one makes it `cleaning`; those two are the service's
 * and are not offered here.
 */
export declare const TABLE_STATUS_MOVES: Readonly<Record<TableStatus, readonly TableStatus[]>>;
export declare const PrepStationKind: z.ZodEnum<["kitchen", "bar"]>;
export type PrepStationKind = z.infer<typeof PrepStationKind>;
export declare const TicketStatus: z.ZodEnum<["queued", "preparing", "ready", "served", "cancelled"]>;
export type TicketStatus = z.infer<typeof TicketStatus>;
export declare const TICKET_STATUS_LABEL: Readonly<Record<TicketStatus, string>>;
/** A bottle of water may go straight from the queue to the pass, so `queued -> ready` is allowed. */
export declare const TICKET_TRANSITIONS: Readonly<Record<TicketStatus, readonly TicketStatus[]>>;
export declare function canMoveTicket(from: TicketStatus, to: TicketStatus): boolean;
/** Minutes after which a waiting ticket is drawn as late. */
export declare const TICKET_LATE_MINUTES = 15;
/** A line on an order: drafted, sent to its station, or voided after the fact. */
export declare const PosLineStatus: z.ZodEnum<["draft", "sent", "voided"]>;
export type PosLineStatus = z.infer<typeof PosLineStatus>;
/** The order's own progress. Payment is NOT in here: see `settlementOf`. */
export declare const PosOrderStatus: z.ZodEnum<["draft", "submitted", "in_progress", "ready", "delivered", "completed", "cancelled"]>;
export type PosOrderStatus = z.infer<typeof PosOrderStatus>;
export declare const POS_ORDER_STATUS_LABEL: Readonly<Record<PosOrderStatus, string>>;
export declare const PosPaymentMethod: z.ZodEnum<["cash", "mtn_momo", "airtel_money", "card", "bank_transfer", "voucher", "customer_credit"]>;
export type PosPaymentMethod = z.infer<typeof PosPaymentMethod>;
/** Every non cash method is SIMULATED, and the label says so wherever it shows. */
export declare const POS_PAYMENT_METHOD_LABEL: Readonly<Record<PosPaymentMethod, string>>;
/** The methods a provider would answer for asynchronously, so a payment can wait in `pending`. */
export declare const ASYNC_PAYMENT_METHODS: readonly PosPaymentMethod[];
export declare const PosPaymentStatus: z.ZodEnum<["initiated", "pending", "successful", "failed", "cancelled", "expired", "refunded"]>;
export type PosPaymentStatus = z.infer<typeof PosPaymentStatus>;
export declare const PAYMENT_TRANSITIONS: Readonly<Record<PosPaymentStatus, readonly PosPaymentStatus[]>>;
export declare function canMovePayment(from: PosPaymentStatus, to: PosPaymentStatus): boolean;
/** What the demo provider is told to answer. Never a real provider call. */
export declare const SimulatedOutcome: z.ZodEnum<["success", "pending", "failure", "timeout"]>;
export type SimulatedOutcome = z.infer<typeof SimulatedOutcome>;
export declare const ShiftStatus: z.ZodEnum<["open", "closed", "reviewed"]>;
export type ShiftStatus = z.infer<typeof ShiftStatus>;
export declare const CashMovementKind: z.ZodEnum<["paid_in", "paid_out"]>;
export type CashMovementKind = z.infer<typeof CashMovementKind>;
export declare const ApprovalStatus: z.ZodEnum<["approved", "pending_approval", "rejected"]>;
export type ApprovalStatus = z.infer<typeof ApprovalStatus>;
/** The stamp every simulated payment carries, on screen and on paper. */
export declare const POS_PAYMENT_SIMULATION_NOTICE = "SIMULATED PAYMENT. No money moved and no provider was contacted.";
/** `n / d` rounded half up, for `n >= 0` and `d > 0`, with no fraction in between. */
export declare function divRoundHalfUp(n: number, d: number): number;
/**
 * A tax rate as basis points: `0.18` is `1800`. The rates in config are
 * decimals, so this is where a fraction stops: rounded once, to a whole basis
 * point, and every later step is integers.
 */
export declare function rateToBps(rate: number): number;
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
export declare function lineAmounts(line: PosLineInput, mode: PosTaxMode): PosLineAmounts;
/**
 * Share `amount` across `weights` in proportion, in whole RWF, so the shares
 * add up to exactly `amount` (largest remainder; ties go to the earlier line).
 */
export declare function allocate(amount: number, weights: readonly number[]): number[];
export interface PosOrderLineInput {
    unitPriceRwf: number;
    quantity: number;
    /** A discount given on this line alone. */
    lineDiscountRwf: number;
    taxRateBps: number;
}
export interface PosOrderAmounts {
    lines: (PosLineAmounts & {
        orderDiscountShareRwf: number;
    })[];
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
export declare function orderAmounts(lines: readonly PosOrderLineInput[], orderDiscountRwf: number, mode: PosTaxMode): PosOrderAmounts;
/** Does a discount of `discountRwf` on `grossRwf` exceed the outlet's limit and wait for `pos.override`? */
export declare function discountNeedsApproval(discountRwf: number, grossRwf: number, limitBps: number): boolean;
export interface PaymentForSettlement {
    amountRwf: number;
    refundedRwf: number;
    status: PosPaymentStatus;
}
export declare const PosPaymentState: z.ZodEnum<["unpaid", "partially_paid", "paid", "overpaid"]>;
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
export declare function settlementOf(totalRwf: number, payments: readonly PaymentForSettlement[]): Settlement;
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
export declare function checkPayment(settlement: Settlement, method: PosPaymentMethod, amountRwf: number, tenderedRwf: number | null): PaymentCheck;
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
export declare function expectedCash(f: ShiftCashFacts): number;
/** Counted less expected: positive is over, negative is short. */
export declare function cashVariance(countedRwf: number, expectedRwf: number): number;
/** `DEMO-MOMO-7F3K2Q`: a reference no one could mistake for a provider's. */
export declare function demoPaymentReference(method: PosPaymentMethod, token: string): string;
export declare const PosOutletSettings: z.ZodObject<{
    outletId: z.ZodString;
    taxMode: z.ZodEnum<["exclusive", "inclusive"]>;
    /** The largest discount a `pos.discount` holder may give alone, as basis points of the gross. */
    discountLimitBps: z.ZodNumber;
    enabledMethods: z.ZodArray<z.ZodEnum<["cash", "mtn_momo", "airtel_money", "card", "bank_transfer", "voucher", "customer_credit"]>, "many">;
    receiptHeader: z.ZodString;
    receiptFooter: z.ZodString;
}, "strip", z.ZodTypeAny, {
    outletId: string;
    taxMode: "inclusive" | "exclusive";
    discountLimitBps: number;
    enabledMethods: ("mtn_momo" | "airtel_money" | "card" | "cash" | "bank_transfer" | "voucher" | "customer_credit")[];
    receiptHeader: string;
    receiptFooter: string;
}, {
    outletId: string;
    taxMode: "inclusive" | "exclusive";
    discountLimitBps: number;
    enabledMethods: ("mtn_momo" | "airtel_money" | "card" | "cash" | "bank_transfer" | "voucher" | "customer_credit")[];
    receiptHeader: string;
    receiptFooter: string;
}>;
export type PosOutletSettings = z.infer<typeof PosOutletSettings>;
export declare const UpdatePosOutletSettingsRequest: z.ZodObject<{
    taxMode: z.ZodOptional<z.ZodEnum<["exclusive", "inclusive"]>>;
    discountLimitBps: z.ZodOptional<z.ZodNumber>;
    enabledMethods: z.ZodOptional<z.ZodArray<z.ZodEnum<["cash", "mtn_momo", "airtel_money", "card", "bank_transfer", "voucher", "customer_credit"]>, "many">>;
    receiptHeader: z.ZodOptional<z.ZodString>;
    receiptFooter: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    taxMode?: "inclusive" | "exclusive" | undefined;
    discountLimitBps?: number | undefined;
    enabledMethods?: ("mtn_momo" | "airtel_money" | "card" | "cash" | "bank_transfer" | "voucher" | "customer_credit")[] | undefined;
    receiptHeader?: string | undefined;
    receiptFooter?: string | undefined;
}, {
    taxMode?: "inclusive" | "exclusive" | undefined;
    discountLimitBps?: number | undefined;
    enabledMethods?: ("mtn_momo" | "airtel_money" | "card" | "cash" | "bank_transfer" | "voucher" | "customer_credit")[] | undefined;
    receiptHeader?: string | undefined;
    receiptFooter?: string | undefined;
}>;
export type UpdatePosOutletSettingsRequest = z.infer<typeof UpdatePosOutletSettingsRequest>;
export declare const PosOutlet: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    outletKind: z.ZodString;
    /** The branch, or null for a standalone outlet. */
    propertyId: z.ZodNullable<z.ZodString>;
    branchName: z.ZodNullable<z.ZodString>;
    settings: z.ZodObject<{
        outletId: z.ZodString;
        taxMode: z.ZodEnum<["exclusive", "inclusive"]>;
        /** The largest discount a `pos.discount` holder may give alone, as basis points of the gross. */
        discountLimitBps: z.ZodNumber;
        enabledMethods: z.ZodArray<z.ZodEnum<["cash", "mtn_momo", "airtel_money", "card", "bank_transfer", "voucher", "customer_credit"]>, "many">;
        receiptHeader: z.ZodString;
        receiptFooter: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        outletId: string;
        taxMode: "inclusive" | "exclusive";
        discountLimitBps: number;
        enabledMethods: ("mtn_momo" | "airtel_money" | "card" | "cash" | "bank_transfer" | "voucher" | "customer_credit")[];
        receiptHeader: string;
        receiptFooter: string;
    }, {
        outletId: string;
        taxMode: "inclusive" | "exclusive";
        discountLimitBps: number;
        enabledMethods: ("mtn_momo" | "airtel_money" | "card" | "cash" | "bank_transfer" | "voucher" | "customer_credit")[];
        receiptHeader: string;
        receiptFooter: string;
    }>;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: string;
    propertyId: string | null;
    outletKind: string;
    branchName: string | null;
    settings: {
        outletId: string;
        taxMode: "inclusive" | "exclusive";
        discountLimitBps: number;
        enabledMethods: ("mtn_momo" | "airtel_money" | "card" | "cash" | "bank_transfer" | "voucher" | "customer_credit")[];
        receiptHeader: string;
        receiptFooter: string;
    };
}, {
    name: string;
    id: string;
    propertyId: string | null;
    outletKind: string;
    branchName: string | null;
    settings: {
        outletId: string;
        taxMode: "inclusive" | "exclusive";
        discountLimitBps: number;
        enabledMethods: ("mtn_momo" | "airtel_money" | "card" | "cash" | "bank_transfer" | "voucher" | "customer_credit")[];
        receiptHeader: string;
        receiptFooter: string;
    };
}>;
export type PosOutlet = z.infer<typeof PosOutlet>;
export declare const PosStation: z.ZodObject<{
    id: z.ZodString;
    outletId: z.ZodString;
    name: z.ZodString;
    kind: z.ZodEnum<["kitchen", "bar"]>;
    printerName: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: string;
    kind: "kitchen" | "bar";
    outletId: string;
    printerName: string | null;
}, {
    name: string;
    id: string;
    kind: "kitchen" | "bar";
    outletId: string;
    printerName: string | null;
}>;
export type PosStation = z.infer<typeof PosStation>;
export declare const PosMenuItem: z.ZodObject<{
    id: z.ZodString;
    categoryId: z.ZodString;
    name: z.ZodString;
    description: z.ZodNullable<z.ZodString>;
    sku: z.ZodNullable<z.ZodString>;
    priceRwf: z.ZodNumber;
    taxCode: z.ZodEnum<["TAX_A", "TAX_B", "TAX_C", "TAX_D"]>;
    taxRateBps: z.ZodNumber;
    options: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        required: z.ZodBoolean;
        maxChoices: z.ZodNumber;
        choices: z.ZodArray<z.ZodObject<{
            label: z.ZodString;
            priceDeltaRwf: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            label: string;
            priceDeltaRwf: number;
        }, {
            label: string;
            priceDeltaRwf: number;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        name: string;
        required: boolean;
        maxChoices: number;
        choices: {
            label: string;
            priceDeltaRwf: number;
        }[];
    }, {
        name: string;
        required: boolean;
        maxChoices: number;
        choices: {
            label: string;
            priceDeltaRwf: number;
        }[];
    }>, "many">;
    stationId: z.ZodNullable<z.ZodString>;
    available: z.ZodBoolean;
    /** Why it cannot be sold, when it cannot. */
    unavailableReason: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    options: {
        name: string;
        required: boolean;
        maxChoices: number;
        choices: {
            label: string;
            priceDeltaRwf: number;
        }[];
    }[];
    name: string;
    id: string;
    description: string | null;
    priceRwf: number;
    available: boolean;
    taxCode: "TAX_A" | "TAX_B" | "TAX_C" | "TAX_D";
    categoryId: string;
    sku: string | null;
    taxRateBps: number;
    stationId: string | null;
    unavailableReason: string | null;
}, {
    options: {
        name: string;
        required: boolean;
        maxChoices: number;
        choices: {
            label: string;
            priceDeltaRwf: number;
        }[];
    }[];
    name: string;
    id: string;
    description: string | null;
    priceRwf: number;
    available: boolean;
    taxCode: "TAX_A" | "TAX_B" | "TAX_C" | "TAX_D";
    categoryId: string;
    sku: string | null;
    taxRateBps: number;
    stationId: string | null;
    unavailableReason: string | null;
}>;
export type PosMenuItem = z.infer<typeof PosMenuItem>;
export declare const PosMenu: z.ZodObject<{
    outletId: z.ZodString;
    taxMode: z.ZodEnum<["exclusive", "inclusive"]>;
    categories: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        sortOrder: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
        sortOrder: number;
    }, {
        name: string;
        id: string;
        sortOrder: number;
    }>, "many">;
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        categoryId: z.ZodString;
        name: z.ZodString;
        description: z.ZodNullable<z.ZodString>;
        sku: z.ZodNullable<z.ZodString>;
        priceRwf: z.ZodNumber;
        taxCode: z.ZodEnum<["TAX_A", "TAX_B", "TAX_C", "TAX_D"]>;
        taxRateBps: z.ZodNumber;
        options: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            required: z.ZodBoolean;
            maxChoices: z.ZodNumber;
            choices: z.ZodArray<z.ZodObject<{
                label: z.ZodString;
                priceDeltaRwf: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                label: string;
                priceDeltaRwf: number;
            }, {
                label: string;
                priceDeltaRwf: number;
            }>, "many">;
        }, "strip", z.ZodTypeAny, {
            name: string;
            required: boolean;
            maxChoices: number;
            choices: {
                label: string;
                priceDeltaRwf: number;
            }[];
        }, {
            name: string;
            required: boolean;
            maxChoices: number;
            choices: {
                label: string;
                priceDeltaRwf: number;
            }[];
        }>, "many">;
        stationId: z.ZodNullable<z.ZodString>;
        available: z.ZodBoolean;
        /** Why it cannot be sold, when it cannot. */
        unavailableReason: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        options: {
            name: string;
            required: boolean;
            maxChoices: number;
            choices: {
                label: string;
                priceDeltaRwf: number;
            }[];
        }[];
        name: string;
        id: string;
        description: string | null;
        priceRwf: number;
        available: boolean;
        taxCode: "TAX_A" | "TAX_B" | "TAX_C" | "TAX_D";
        categoryId: string;
        sku: string | null;
        taxRateBps: number;
        stationId: string | null;
        unavailableReason: string | null;
    }, {
        options: {
            name: string;
            required: boolean;
            maxChoices: number;
            choices: {
                label: string;
                priceDeltaRwf: number;
            }[];
        }[];
        name: string;
        id: string;
        description: string | null;
        priceRwf: number;
        available: boolean;
        taxCode: "TAX_A" | "TAX_B" | "TAX_C" | "TAX_D";
        categoryId: string;
        sku: string | null;
        taxRateBps: number;
        stationId: string | null;
        unavailableReason: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    items: {
        options: {
            name: string;
            required: boolean;
            maxChoices: number;
            choices: {
                label: string;
                priceDeltaRwf: number;
            }[];
        }[];
        name: string;
        id: string;
        description: string | null;
        priceRwf: number;
        available: boolean;
        taxCode: "TAX_A" | "TAX_B" | "TAX_C" | "TAX_D";
        categoryId: string;
        sku: string | null;
        taxRateBps: number;
        stationId: string | null;
        unavailableReason: string | null;
    }[];
    outletId: string;
    categories: {
        name: string;
        id: string;
        sortOrder: number;
    }[];
    taxMode: "inclusive" | "exclusive";
}, {
    items: {
        options: {
            name: string;
            required: boolean;
            maxChoices: number;
            choices: {
                label: string;
                priceDeltaRwf: number;
            }[];
        }[];
        name: string;
        id: string;
        description: string | null;
        priceRwf: number;
        available: boolean;
        taxCode: "TAX_A" | "TAX_B" | "TAX_C" | "TAX_D";
        categoryId: string;
        sku: string | null;
        taxRateBps: number;
        stationId: string | null;
        unavailableReason: string | null;
    }[];
    outletId: string;
    categories: {
        name: string;
        id: string;
        sortOrder: number;
    }[];
    taxMode: "inclusive" | "exclusive";
}>;
export type PosMenu = z.infer<typeof PosMenu>;
export declare const PosTable: z.ZodObject<{
    id: z.ZodString;
    areaId: z.ZodString;
    label: z.ZodString;
    seats: z.ZodNumber;
    status: z.ZodEnum<["available", "occupied", "reserved", "bill_requested", "cleaning"]>;
    sessionId: z.ZodNullable<z.ZodString>;
    guestCount: z.ZodNullable<z.ZodNumber>;
    waiterName: z.ZodNullable<z.ZodString>;
    openedAt: z.ZodNullable<z.ZodString>;
    openOrders: z.ZodNumber;
    /** What the open session's orders still owe, collected payments taken off. */
    outstandingRwf: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    status: "available" | "occupied" | "reserved" | "bill_requested" | "cleaning";
    id: string;
    label: string;
    sessionId: string | null;
    guestCount: number | null;
    openedAt: string | null;
    areaId: string;
    seats: number;
    waiterName: string | null;
    openOrders: number;
    outstandingRwf: number;
}, {
    status: "available" | "occupied" | "reserved" | "bill_requested" | "cleaning";
    id: string;
    label: string;
    sessionId: string | null;
    guestCount: number | null;
    openedAt: string | null;
    areaId: string;
    seats: number;
    waiterName: string | null;
    openOrders: number;
    outstandingRwf: number;
}>;
export type PosTable = z.infer<typeof PosTable>;
export declare const PosFloor: z.ZodObject<{
    outletId: z.ZodString;
    areas: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        sortOrder: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
        sortOrder: number;
    }, {
        name: string;
        id: string;
        sortOrder: number;
    }>, "many">;
    tables: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        areaId: z.ZodString;
        label: z.ZodString;
        seats: z.ZodNumber;
        status: z.ZodEnum<["available", "occupied", "reserved", "bill_requested", "cleaning"]>;
        sessionId: z.ZodNullable<z.ZodString>;
        guestCount: z.ZodNullable<z.ZodNumber>;
        waiterName: z.ZodNullable<z.ZodString>;
        openedAt: z.ZodNullable<z.ZodString>;
        openOrders: z.ZodNumber;
        /** What the open session's orders still owe, collected payments taken off. */
        outstandingRwf: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        status: "available" | "occupied" | "reserved" | "bill_requested" | "cleaning";
        id: string;
        label: string;
        sessionId: string | null;
        guestCount: number | null;
        openedAt: string | null;
        areaId: string;
        seats: number;
        waiterName: string | null;
        openOrders: number;
        outstandingRwf: number;
    }, {
        status: "available" | "occupied" | "reserved" | "bill_requested" | "cleaning";
        id: string;
        label: string;
        sessionId: string | null;
        guestCount: number | null;
        openedAt: string | null;
        areaId: string;
        seats: number;
        waiterName: string | null;
        openOrders: number;
        outstandingRwf: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    outletId: string;
    areas: {
        name: string;
        id: string;
        sortOrder: number;
    }[];
    tables: {
        status: "available" | "occupied" | "reserved" | "bill_requested" | "cleaning";
        id: string;
        label: string;
        sessionId: string | null;
        guestCount: number | null;
        openedAt: string | null;
        areaId: string;
        seats: number;
        waiterName: string | null;
        openOrders: number;
        outstandingRwf: number;
    }[];
}, {
    outletId: string;
    areas: {
        name: string;
        id: string;
        sortOrder: number;
    }[];
    tables: {
        status: "available" | "occupied" | "reserved" | "bill_requested" | "cleaning";
        id: string;
        label: string;
        sessionId: string | null;
        guestCount: number | null;
        openedAt: string | null;
        areaId: string;
        seats: number;
        waiterName: string | null;
        openOrders: number;
        outstandingRwf: number;
    }[];
}>;
export type PosFloor = z.infer<typeof PosFloor>;
export declare const PosOrderLine: z.ZodObject<{
    id: z.ZodString;
    serviceItemId: z.ZodNullable<z.ZodString>;
    name: z.ZodString;
    sku: z.ZodNullable<z.ZodString>;
    quantity: z.ZodNumber;
    unitPriceRwf: z.ZodNumber;
    selectedOptions: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        choices: z.ZodArray<z.ZodObject<{
            label: z.ZodString;
            priceDeltaRwf: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            label: string;
            priceDeltaRwf: number;
        }, {
            label: string;
            priceDeltaRwf: number;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        name: string;
        choices: {
            label: string;
            priceDeltaRwf: number;
        }[];
    }, {
        name: string;
        choices: {
            label: string;
            priceDeltaRwf: number;
        }[];
    }>, "many">;
    note: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<["draft", "sent", "voided"]>;
    taxCode: z.ZodNullable<z.ZodEnum<["TAX_A", "TAX_B", "TAX_C", "TAX_D"]>>;
    taxRateBps: z.ZodNumber;
    grossRwf: z.ZodNumber;
    discountRwf: z.ZodNumber;
    taxRwf: z.ZodNumber;
    totalRwf: z.ZodNumber;
    voidReason: z.ZodNullable<z.ZodString>;
    stationId: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "sent" | "draft" | "voided";
    name: string;
    id: string;
    grossRwf: number;
    note: string | null;
    totalRwf: number;
    quantity: number;
    unitPriceRwf: number;
    taxCode: "TAX_A" | "TAX_B" | "TAX_C" | "TAX_D" | null;
    serviceItemId: string | null;
    selectedOptions: {
        name: string;
        choices: {
            label: string;
            priceDeltaRwf: number;
        }[];
    }[];
    taxRwf: number;
    discountRwf: number;
    sku: string | null;
    taxRateBps: number;
    stationId: string | null;
    voidReason: string | null;
}, {
    status: "sent" | "draft" | "voided";
    name: string;
    id: string;
    grossRwf: number;
    note: string | null;
    totalRwf: number;
    quantity: number;
    unitPriceRwf: number;
    taxCode: "TAX_A" | "TAX_B" | "TAX_C" | "TAX_D" | null;
    serviceItemId: string | null;
    selectedOptions: {
        name: string;
        choices: {
            label: string;
            priceDeltaRwf: number;
        }[];
    }[];
    taxRwf: number;
    discountRwf: number;
    sku: string | null;
    taxRateBps: number;
    stationId: string | null;
    voidReason: string | null;
}>;
export type PosOrderLine = z.infer<typeof PosOrderLine>;
export declare const PosDiscount: z.ZodObject<{
    id: z.ZodString;
    orderItemId: z.ZodNullable<z.ZodString>;
    amountRwf: z.ZodNumber;
    reason: z.ZodString;
    status: z.ZodEnum<["approved", "pending_approval", "rejected"]>;
    requestedByName: z.ZodNullable<z.ZodString>;
    decidedByName: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "approved" | "rejected" | "pending_approval";
    id: string;
    amountRwf: number;
    reason: string;
    decidedByName: string | null;
    createdAt: string;
    orderItemId: string | null;
    requestedByName: string | null;
}, {
    status: "approved" | "rejected" | "pending_approval";
    id: string;
    amountRwf: number;
    reason: string;
    decidedByName: string | null;
    createdAt: string;
    orderItemId: string | null;
    requestedByName: string | null;
}>;
export type PosDiscount = z.infer<typeof PosDiscount>;
export declare const PosPayment: z.ZodObject<{
    id: z.ZodString;
    orderId: z.ZodString;
    method: z.ZodEnum<["cash", "mtn_momo", "airtel_money", "card", "bank_transfer", "voucher", "customer_credit"]>;
    amountRwf: z.ZodNumber;
    tenderedRwf: z.ZodNullable<z.ZodNumber>;
    changeRwf: z.ZodNumber;
    tipRwf: z.ZodNumber;
    refundedRwf: z.ZodNumber;
    status: z.ZodEnum<["initiated", "pending", "successful", "failed", "cancelled", "expired", "refunded"]>;
    demoReference: z.ZodString;
    simulated: z.ZodBoolean;
    failureReason: z.ZodNullable<z.ZodString>;
    shiftId: z.ZodNullable<z.ZodString>;
    createdByName: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    settledAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "pending" | "cancelled" | "expired" | "failed" | "initiated" | "refunded" | "successful";
    id: string;
    amountRwf: number;
    failureReason: string | null;
    createdAt: string;
    settledAt: string | null;
    method: "mtn_momo" | "airtel_money" | "card" | "cash" | "bank_transfer" | "voucher" | "customer_credit";
    refundedRwf: number;
    changeRwf: number;
    orderId: string;
    tenderedRwf: number | null;
    tipRwf: number;
    demoReference: string;
    simulated: boolean;
    shiftId: string | null;
    createdByName: string | null;
}, {
    status: "pending" | "cancelled" | "expired" | "failed" | "initiated" | "refunded" | "successful";
    id: string;
    amountRwf: number;
    failureReason: string | null;
    createdAt: string;
    settledAt: string | null;
    method: "mtn_momo" | "airtel_money" | "card" | "cash" | "bank_transfer" | "voucher" | "customer_credit";
    refundedRwf: number;
    changeRwf: number;
    orderId: string;
    tenderedRwf: number | null;
    tipRwf: number;
    demoReference: string;
    simulated: boolean;
    shiftId: string | null;
    createdByName: string | null;
}>;
export type PosPayment = z.infer<typeof PosPayment>;
export declare const PosSettlement: z.ZodObject<{
    totalRwf: z.ZodNumber;
    collectedRwf: z.ZodNumber;
    refundedRwf: z.ZodNumber;
    pendingRwf: z.ZodNumber;
    outstandingRwf: z.ZodNumber;
    payableRwf: z.ZodNumber;
    state: z.ZodEnum<["unpaid", "partially_paid", "paid", "overpaid"]>;
    settled: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    state: "paid" | "unpaid" | "partially_paid" | "overpaid";
    settled: boolean;
    pendingRwf: number;
    totalRwf: number;
    refundedRwf: number;
    collectedRwf: number;
    outstandingRwf: number;
    payableRwf: number;
}, {
    state: "paid" | "unpaid" | "partially_paid" | "overpaid";
    settled: boolean;
    pendingRwf: number;
    totalRwf: number;
    refundedRwf: number;
    collectedRwf: number;
    outstandingRwf: number;
    payableRwf: number;
}>;
/**
 * The customer on an order (CRM, phase 1), small enough to ride on every order read. The phone is masked
 * here whatever the reader's role: the order screen needs a name to greet, never a number to copy.
 * Defined here, not in `customers.ts`, because that file imports this one.
 */
export declare const PosOrderCustomer: z.ZodObject<{
    id: z.ZodString;
    fullName: z.ZodString;
    phoneMasked: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    fullName: string;
    phoneMasked: string;
}, {
    id: string;
    fullName: string;
    phoneMasked: string;
}>;
export type PosOrderCustomer = z.infer<typeof PosOrderCustomer>;
export declare const PosOrder: z.ZodObject<{
    id: z.ZodString;
    orderNumber: z.ZodString;
    outletId: z.ZodString;
    orderType: z.ZodEnum<["dine_in", "takeaway", "delivery", "room_service", "event"]>;
    status: z.ZodEnum<["draft", "submitted", "in_progress", "ready", "delivered", "completed", "cancelled"]>;
    tableSessionId: z.ZodNullable<z.ZodString>;
    tableLabel: z.ZodNullable<z.ZodString>;
    waiterName: z.ZodNullable<z.ZodString>;
    guestNote: z.ZodNullable<z.ZodString>;
    /** Who the bill is for, when the staff attached a customer. Absent on orders read before CRM existed. */
    customer: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        fullName: z.ZodString;
        phoneMasked: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        fullName: string;
        phoneMasked: string;
    }, {
        id: string;
        fullName: string;
        phoneMasked: string;
    }>>>;
    taxMode: z.ZodEnum<["exclusive", "inclusive"]>;
    grossRwf: z.ZodNumber;
    discountRwf: z.ZodNumber;
    taxRwf: z.ZodNumber;
    totalRwf: z.ZodNumber;
    settlement: z.ZodObject<{
        totalRwf: z.ZodNumber;
        collectedRwf: z.ZodNumber;
        refundedRwf: z.ZodNumber;
        pendingRwf: z.ZodNumber;
        outstandingRwf: z.ZodNumber;
        payableRwf: z.ZodNumber;
        state: z.ZodEnum<["unpaid", "partially_paid", "paid", "overpaid"]>;
        settled: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        state: "paid" | "unpaid" | "partially_paid" | "overpaid";
        settled: boolean;
        pendingRwf: number;
        totalRwf: number;
        refundedRwf: number;
        collectedRwf: number;
        outstandingRwf: number;
        payableRwf: number;
    }, {
        state: "paid" | "unpaid" | "partially_paid" | "overpaid";
        settled: boolean;
        pendingRwf: number;
        totalRwf: number;
        refundedRwf: number;
        collectedRwf: number;
        outstandingRwf: number;
        payableRwf: number;
    }>;
    lines: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        serviceItemId: z.ZodNullable<z.ZodString>;
        name: z.ZodString;
        sku: z.ZodNullable<z.ZodString>;
        quantity: z.ZodNumber;
        unitPriceRwf: z.ZodNumber;
        selectedOptions: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            choices: z.ZodArray<z.ZodObject<{
                label: z.ZodString;
                priceDeltaRwf: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                label: string;
                priceDeltaRwf: number;
            }, {
                label: string;
                priceDeltaRwf: number;
            }>, "many">;
        }, "strip", z.ZodTypeAny, {
            name: string;
            choices: {
                label: string;
                priceDeltaRwf: number;
            }[];
        }, {
            name: string;
            choices: {
                label: string;
                priceDeltaRwf: number;
            }[];
        }>, "many">;
        note: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<["draft", "sent", "voided"]>;
        taxCode: z.ZodNullable<z.ZodEnum<["TAX_A", "TAX_B", "TAX_C", "TAX_D"]>>;
        taxRateBps: z.ZodNumber;
        grossRwf: z.ZodNumber;
        discountRwf: z.ZodNumber;
        taxRwf: z.ZodNumber;
        totalRwf: z.ZodNumber;
        voidReason: z.ZodNullable<z.ZodString>;
        stationId: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "sent" | "draft" | "voided";
        name: string;
        id: string;
        grossRwf: number;
        note: string | null;
        totalRwf: number;
        quantity: number;
        unitPriceRwf: number;
        taxCode: "TAX_A" | "TAX_B" | "TAX_C" | "TAX_D" | null;
        serviceItemId: string | null;
        selectedOptions: {
            name: string;
            choices: {
                label: string;
                priceDeltaRwf: number;
            }[];
        }[];
        taxRwf: number;
        discountRwf: number;
        sku: string | null;
        taxRateBps: number;
        stationId: string | null;
        voidReason: string | null;
    }, {
        status: "sent" | "draft" | "voided";
        name: string;
        id: string;
        grossRwf: number;
        note: string | null;
        totalRwf: number;
        quantity: number;
        unitPriceRwf: number;
        taxCode: "TAX_A" | "TAX_B" | "TAX_C" | "TAX_D" | null;
        serviceItemId: string | null;
        selectedOptions: {
            name: string;
            choices: {
                label: string;
                priceDeltaRwf: number;
            }[];
        }[];
        taxRwf: number;
        discountRwf: number;
        sku: string | null;
        taxRateBps: number;
        stationId: string | null;
        voidReason: string | null;
    }>, "many">;
    discounts: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        orderItemId: z.ZodNullable<z.ZodString>;
        amountRwf: z.ZodNumber;
        reason: z.ZodString;
        status: z.ZodEnum<["approved", "pending_approval", "rejected"]>;
        requestedByName: z.ZodNullable<z.ZodString>;
        decidedByName: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "approved" | "rejected" | "pending_approval";
        id: string;
        amountRwf: number;
        reason: string;
        decidedByName: string | null;
        createdAt: string;
        orderItemId: string | null;
        requestedByName: string | null;
    }, {
        status: "approved" | "rejected" | "pending_approval";
        id: string;
        amountRwf: number;
        reason: string;
        decidedByName: string | null;
        createdAt: string;
        orderItemId: string | null;
        requestedByName: string | null;
    }>, "many">;
    payments: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        orderId: z.ZodString;
        method: z.ZodEnum<["cash", "mtn_momo", "airtel_money", "card", "bank_transfer", "voucher", "customer_credit"]>;
        amountRwf: z.ZodNumber;
        tenderedRwf: z.ZodNullable<z.ZodNumber>;
        changeRwf: z.ZodNumber;
        tipRwf: z.ZodNumber;
        refundedRwf: z.ZodNumber;
        status: z.ZodEnum<["initiated", "pending", "successful", "failed", "cancelled", "expired", "refunded"]>;
        demoReference: z.ZodString;
        simulated: z.ZodBoolean;
        failureReason: z.ZodNullable<z.ZodString>;
        shiftId: z.ZodNullable<z.ZodString>;
        createdByName: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        settledAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "pending" | "cancelled" | "expired" | "failed" | "initiated" | "refunded" | "successful";
        id: string;
        amountRwf: number;
        failureReason: string | null;
        createdAt: string;
        settledAt: string | null;
        method: "mtn_momo" | "airtel_money" | "card" | "cash" | "bank_transfer" | "voucher" | "customer_credit";
        refundedRwf: number;
        changeRwf: number;
        orderId: string;
        tenderedRwf: number | null;
        tipRwf: number;
        demoReference: string;
        simulated: boolean;
        shiftId: string | null;
        createdByName: string | null;
    }, {
        status: "pending" | "cancelled" | "expired" | "failed" | "initiated" | "refunded" | "successful";
        id: string;
        amountRwf: number;
        failureReason: string | null;
        createdAt: string;
        settledAt: string | null;
        method: "mtn_momo" | "airtel_money" | "card" | "cash" | "bank_transfer" | "voucher" | "customer_credit";
        refundedRwf: number;
        changeRwf: number;
        orderId: string;
        tenderedRwf: number | null;
        tipRwf: number;
        demoReference: string;
        simulated: boolean;
        shiftId: string | null;
        createdByName: string | null;
    }>, "many">;
    cancelReason: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    settledAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "submitted" | "cancelled" | "draft" | "in_progress" | "ready" | "delivered" | "completed";
    id: string;
    grossRwf: number;
    createdAt: string;
    settledAt: string | null;
    payments: {
        status: "pending" | "cancelled" | "expired" | "failed" | "initiated" | "refunded" | "successful";
        id: string;
        amountRwf: number;
        failureReason: string | null;
        createdAt: string;
        settledAt: string | null;
        method: "mtn_momo" | "airtel_money" | "card" | "cash" | "bank_transfer" | "voucher" | "customer_credit";
        refundedRwf: number;
        changeRwf: number;
        orderId: string;
        tenderedRwf: number | null;
        tipRwf: number;
        demoReference: string;
        simulated: boolean;
        shiftId: string | null;
        createdByName: string | null;
    }[];
    totalRwf: number;
    settlement: {
        state: "paid" | "unpaid" | "partially_paid" | "overpaid";
        settled: boolean;
        pendingRwf: number;
        totalRwf: number;
        refundedRwf: number;
        collectedRwf: number;
        outstandingRwf: number;
        payableRwf: number;
    };
    outletId: string;
    orderNumber: string;
    taxRwf: number;
    guestNote: string | null;
    cancelReason: string | null;
    discountRwf: number;
    taxMode: "inclusive" | "exclusive";
    waiterName: string | null;
    orderType: "dine_in" | "takeaway" | "delivery" | "room_service" | "event";
    tableSessionId: string | null;
    tableLabel: string | null;
    lines: {
        status: "sent" | "draft" | "voided";
        name: string;
        id: string;
        grossRwf: number;
        note: string | null;
        totalRwf: number;
        quantity: number;
        unitPriceRwf: number;
        taxCode: "TAX_A" | "TAX_B" | "TAX_C" | "TAX_D" | null;
        serviceItemId: string | null;
        selectedOptions: {
            name: string;
            choices: {
                label: string;
                priceDeltaRwf: number;
            }[];
        }[];
        taxRwf: number;
        discountRwf: number;
        sku: string | null;
        taxRateBps: number;
        stationId: string | null;
        voidReason: string | null;
    }[];
    discounts: {
        status: "approved" | "rejected" | "pending_approval";
        id: string;
        amountRwf: number;
        reason: string;
        decidedByName: string | null;
        createdAt: string;
        orderItemId: string | null;
        requestedByName: string | null;
    }[];
    customer?: {
        id: string;
        fullName: string;
        phoneMasked: string;
    } | null | undefined;
}, {
    status: "submitted" | "cancelled" | "draft" | "in_progress" | "ready" | "delivered" | "completed";
    id: string;
    grossRwf: number;
    createdAt: string;
    settledAt: string | null;
    payments: {
        status: "pending" | "cancelled" | "expired" | "failed" | "initiated" | "refunded" | "successful";
        id: string;
        amountRwf: number;
        failureReason: string | null;
        createdAt: string;
        settledAt: string | null;
        method: "mtn_momo" | "airtel_money" | "card" | "cash" | "bank_transfer" | "voucher" | "customer_credit";
        refundedRwf: number;
        changeRwf: number;
        orderId: string;
        tenderedRwf: number | null;
        tipRwf: number;
        demoReference: string;
        simulated: boolean;
        shiftId: string | null;
        createdByName: string | null;
    }[];
    totalRwf: number;
    settlement: {
        state: "paid" | "unpaid" | "partially_paid" | "overpaid";
        settled: boolean;
        pendingRwf: number;
        totalRwf: number;
        refundedRwf: number;
        collectedRwf: number;
        outstandingRwf: number;
        payableRwf: number;
    };
    outletId: string;
    orderNumber: string;
    taxRwf: number;
    guestNote: string | null;
    cancelReason: string | null;
    discountRwf: number;
    taxMode: "inclusive" | "exclusive";
    waiterName: string | null;
    orderType: "dine_in" | "takeaway" | "delivery" | "room_service" | "event";
    tableSessionId: string | null;
    tableLabel: string | null;
    lines: {
        status: "sent" | "draft" | "voided";
        name: string;
        id: string;
        grossRwf: number;
        note: string | null;
        totalRwf: number;
        quantity: number;
        unitPriceRwf: number;
        taxCode: "TAX_A" | "TAX_B" | "TAX_C" | "TAX_D" | null;
        serviceItemId: string | null;
        selectedOptions: {
            name: string;
            choices: {
                label: string;
                priceDeltaRwf: number;
            }[];
        }[];
        taxRwf: number;
        discountRwf: number;
        sku: string | null;
        taxRateBps: number;
        stationId: string | null;
        voidReason: string | null;
    }[];
    discounts: {
        status: "approved" | "rejected" | "pending_approval";
        id: string;
        amountRwf: number;
        reason: string;
        decidedByName: string | null;
        createdAt: string;
        orderItemId: string | null;
        requestedByName: string | null;
    }[];
    customer?: {
        id: string;
        fullName: string;
        phoneMasked: string;
    } | null | undefined;
}>;
export type PosOrder = z.infer<typeof PosOrder>;
export declare const PosOrderSummary: z.ZodObject<Omit<{
    id: z.ZodString;
    orderNumber: z.ZodString;
    outletId: z.ZodString;
    orderType: z.ZodEnum<["dine_in", "takeaway", "delivery", "room_service", "event"]>;
    status: z.ZodEnum<["draft", "submitted", "in_progress", "ready", "delivered", "completed", "cancelled"]>;
    tableSessionId: z.ZodNullable<z.ZodString>;
    tableLabel: z.ZodNullable<z.ZodString>;
    waiterName: z.ZodNullable<z.ZodString>;
    guestNote: z.ZodNullable<z.ZodString>;
    /** Who the bill is for, when the staff attached a customer. Absent on orders read before CRM existed. */
    customer: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        fullName: z.ZodString;
        phoneMasked: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        fullName: string;
        phoneMasked: string;
    }, {
        id: string;
        fullName: string;
        phoneMasked: string;
    }>>>;
    taxMode: z.ZodEnum<["exclusive", "inclusive"]>;
    grossRwf: z.ZodNumber;
    discountRwf: z.ZodNumber;
    taxRwf: z.ZodNumber;
    totalRwf: z.ZodNumber;
    settlement: z.ZodObject<{
        totalRwf: z.ZodNumber;
        collectedRwf: z.ZodNumber;
        refundedRwf: z.ZodNumber;
        pendingRwf: z.ZodNumber;
        outstandingRwf: z.ZodNumber;
        payableRwf: z.ZodNumber;
        state: z.ZodEnum<["unpaid", "partially_paid", "paid", "overpaid"]>;
        settled: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        state: "paid" | "unpaid" | "partially_paid" | "overpaid";
        settled: boolean;
        pendingRwf: number;
        totalRwf: number;
        refundedRwf: number;
        collectedRwf: number;
        outstandingRwf: number;
        payableRwf: number;
    }, {
        state: "paid" | "unpaid" | "partially_paid" | "overpaid";
        settled: boolean;
        pendingRwf: number;
        totalRwf: number;
        refundedRwf: number;
        collectedRwf: number;
        outstandingRwf: number;
        payableRwf: number;
    }>;
    lines: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        serviceItemId: z.ZodNullable<z.ZodString>;
        name: z.ZodString;
        sku: z.ZodNullable<z.ZodString>;
        quantity: z.ZodNumber;
        unitPriceRwf: z.ZodNumber;
        selectedOptions: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            choices: z.ZodArray<z.ZodObject<{
                label: z.ZodString;
                priceDeltaRwf: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                label: string;
                priceDeltaRwf: number;
            }, {
                label: string;
                priceDeltaRwf: number;
            }>, "many">;
        }, "strip", z.ZodTypeAny, {
            name: string;
            choices: {
                label: string;
                priceDeltaRwf: number;
            }[];
        }, {
            name: string;
            choices: {
                label: string;
                priceDeltaRwf: number;
            }[];
        }>, "many">;
        note: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<["draft", "sent", "voided"]>;
        taxCode: z.ZodNullable<z.ZodEnum<["TAX_A", "TAX_B", "TAX_C", "TAX_D"]>>;
        taxRateBps: z.ZodNumber;
        grossRwf: z.ZodNumber;
        discountRwf: z.ZodNumber;
        taxRwf: z.ZodNumber;
        totalRwf: z.ZodNumber;
        voidReason: z.ZodNullable<z.ZodString>;
        stationId: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "sent" | "draft" | "voided";
        name: string;
        id: string;
        grossRwf: number;
        note: string | null;
        totalRwf: number;
        quantity: number;
        unitPriceRwf: number;
        taxCode: "TAX_A" | "TAX_B" | "TAX_C" | "TAX_D" | null;
        serviceItemId: string | null;
        selectedOptions: {
            name: string;
            choices: {
                label: string;
                priceDeltaRwf: number;
            }[];
        }[];
        taxRwf: number;
        discountRwf: number;
        sku: string | null;
        taxRateBps: number;
        stationId: string | null;
        voidReason: string | null;
    }, {
        status: "sent" | "draft" | "voided";
        name: string;
        id: string;
        grossRwf: number;
        note: string | null;
        totalRwf: number;
        quantity: number;
        unitPriceRwf: number;
        taxCode: "TAX_A" | "TAX_B" | "TAX_C" | "TAX_D" | null;
        serviceItemId: string | null;
        selectedOptions: {
            name: string;
            choices: {
                label: string;
                priceDeltaRwf: number;
            }[];
        }[];
        taxRwf: number;
        discountRwf: number;
        sku: string | null;
        taxRateBps: number;
        stationId: string | null;
        voidReason: string | null;
    }>, "many">;
    discounts: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        orderItemId: z.ZodNullable<z.ZodString>;
        amountRwf: z.ZodNumber;
        reason: z.ZodString;
        status: z.ZodEnum<["approved", "pending_approval", "rejected"]>;
        requestedByName: z.ZodNullable<z.ZodString>;
        decidedByName: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "approved" | "rejected" | "pending_approval";
        id: string;
        amountRwf: number;
        reason: string;
        decidedByName: string | null;
        createdAt: string;
        orderItemId: string | null;
        requestedByName: string | null;
    }, {
        status: "approved" | "rejected" | "pending_approval";
        id: string;
        amountRwf: number;
        reason: string;
        decidedByName: string | null;
        createdAt: string;
        orderItemId: string | null;
        requestedByName: string | null;
    }>, "many">;
    payments: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        orderId: z.ZodString;
        method: z.ZodEnum<["cash", "mtn_momo", "airtel_money", "card", "bank_transfer", "voucher", "customer_credit"]>;
        amountRwf: z.ZodNumber;
        tenderedRwf: z.ZodNullable<z.ZodNumber>;
        changeRwf: z.ZodNumber;
        tipRwf: z.ZodNumber;
        refundedRwf: z.ZodNumber;
        status: z.ZodEnum<["initiated", "pending", "successful", "failed", "cancelled", "expired", "refunded"]>;
        demoReference: z.ZodString;
        simulated: z.ZodBoolean;
        failureReason: z.ZodNullable<z.ZodString>;
        shiftId: z.ZodNullable<z.ZodString>;
        createdByName: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        settledAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "pending" | "cancelled" | "expired" | "failed" | "initiated" | "refunded" | "successful";
        id: string;
        amountRwf: number;
        failureReason: string | null;
        createdAt: string;
        settledAt: string | null;
        method: "mtn_momo" | "airtel_money" | "card" | "cash" | "bank_transfer" | "voucher" | "customer_credit";
        refundedRwf: number;
        changeRwf: number;
        orderId: string;
        tenderedRwf: number | null;
        tipRwf: number;
        demoReference: string;
        simulated: boolean;
        shiftId: string | null;
        createdByName: string | null;
    }, {
        status: "pending" | "cancelled" | "expired" | "failed" | "initiated" | "refunded" | "successful";
        id: string;
        amountRwf: number;
        failureReason: string | null;
        createdAt: string;
        settledAt: string | null;
        method: "mtn_momo" | "airtel_money" | "card" | "cash" | "bank_transfer" | "voucher" | "customer_credit";
        refundedRwf: number;
        changeRwf: number;
        orderId: string;
        tenderedRwf: number | null;
        tipRwf: number;
        demoReference: string;
        simulated: boolean;
        shiftId: string | null;
        createdByName: string | null;
    }>, "many">;
    cancelReason: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    settledAt: z.ZodNullable<z.ZodString>;
}, "payments" | "lines" | "discounts"> & {
    lineCount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    status: "submitted" | "cancelled" | "draft" | "in_progress" | "ready" | "delivered" | "completed";
    id: string;
    grossRwf: number;
    createdAt: string;
    settledAt: string | null;
    totalRwf: number;
    settlement: {
        state: "paid" | "unpaid" | "partially_paid" | "overpaid";
        settled: boolean;
        pendingRwf: number;
        totalRwf: number;
        refundedRwf: number;
        collectedRwf: number;
        outstandingRwf: number;
        payableRwf: number;
    };
    outletId: string;
    orderNumber: string;
    taxRwf: number;
    guestNote: string | null;
    cancelReason: string | null;
    discountRwf: number;
    taxMode: "inclusive" | "exclusive";
    waiterName: string | null;
    orderType: "dine_in" | "takeaway" | "delivery" | "room_service" | "event";
    tableSessionId: string | null;
    tableLabel: string | null;
    lineCount: number;
    customer?: {
        id: string;
        fullName: string;
        phoneMasked: string;
    } | null | undefined;
}, {
    status: "submitted" | "cancelled" | "draft" | "in_progress" | "ready" | "delivered" | "completed";
    id: string;
    grossRwf: number;
    createdAt: string;
    settledAt: string | null;
    totalRwf: number;
    settlement: {
        state: "paid" | "unpaid" | "partially_paid" | "overpaid";
        settled: boolean;
        pendingRwf: number;
        totalRwf: number;
        refundedRwf: number;
        collectedRwf: number;
        outstandingRwf: number;
        payableRwf: number;
    };
    outletId: string;
    orderNumber: string;
    taxRwf: number;
    guestNote: string | null;
    cancelReason: string | null;
    discountRwf: number;
    taxMode: "inclusive" | "exclusive";
    waiterName: string | null;
    orderType: "dine_in" | "takeaway" | "delivery" | "room_service" | "event";
    tableSessionId: string | null;
    tableLabel: string | null;
    lineCount: number;
    customer?: {
        id: string;
        fullName: string;
        phoneMasked: string;
    } | null | undefined;
}>;
export type PosOrderSummary = z.infer<typeof PosOrderSummary>;
export declare const PosTicketItem: z.ZodObject<{
    id: z.ZodString;
    orderItemId: z.ZodString;
    name: z.ZodString;
    quantity: z.ZodNumber;
    options: z.ZodArray<z.ZodString, "many">;
    note: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<["queued", "preparing", "ready", "served", "cancelled"]>;
}, "strip", z.ZodTypeAny, {
    options: string[];
    status: "cancelled" | "queued" | "ready" | "preparing" | "served";
    name: string;
    id: string;
    note: string | null;
    quantity: number;
    orderItemId: string;
}, {
    options: string[];
    status: "cancelled" | "queued" | "ready" | "preparing" | "served";
    name: string;
    id: string;
    note: string | null;
    quantity: number;
    orderItemId: string;
}>;
export declare const PosTicket: z.ZodObject<{
    id: z.ZodString;
    ticketNumber: z.ZodString;
    orderId: z.ZodString;
    orderNumber: z.ZodString;
    stationId: z.ZodString;
    stationName: z.ZodString;
    stationKind: z.ZodEnum<["kitchen", "bar"]>;
    status: z.ZodEnum<["queued", "preparing", "ready", "served", "cancelled"]>;
    tableLabel: z.ZodNullable<z.ZodString>;
    waiterName: z.ZodNullable<z.ZodString>;
    orderType: z.ZodEnum<["dine_in", "takeaway", "delivery", "room_service", "event"]>;
    /** The order's guest note (a name, an allergy), or null. An order has no customer-name field of its own. */
    guestNote: z.ZodNullable<z.ZodString>;
    /** The table's party size, or null for an order without a table. */
    guestCount: z.ZodNullable<z.ZodNumber>;
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        orderItemId: z.ZodString;
        name: z.ZodString;
        quantity: z.ZodNumber;
        options: z.ZodArray<z.ZodString, "many">;
        note: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<["queued", "preparing", "ready", "served", "cancelled"]>;
    }, "strip", z.ZodTypeAny, {
        options: string[];
        status: "cancelled" | "queued" | "ready" | "preparing" | "served";
        name: string;
        id: string;
        note: string | null;
        quantity: number;
        orderItemId: string;
    }, {
        options: string[];
        status: "cancelled" | "queued" | "ready" | "preparing" | "served";
        name: string;
        id: string;
        note: string | null;
        quantity: number;
        orderItemId: string;
    }>, "many">;
    createdAt: z.ZodString;
    startedAt: z.ZodNullable<z.ZodString>;
    readyAt: z.ZodNullable<z.ZodString>;
    servedAt: z.ZodNullable<z.ZodString>;
    /** Whole minutes since the ticket was sent, at read time. */
    elapsedMinutes: z.ZodNumber;
    late: z.ZodBoolean;
    printCount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    status: "cancelled" | "queued" | "ready" | "preparing" | "served";
    id: string;
    items: {
        options: string[];
        status: "cancelled" | "queued" | "ready" | "preparing" | "served";
        name: string;
        id: string;
        note: string | null;
        quantity: number;
        orderItemId: string;
    }[];
    createdAt: string;
    guestCount: number | null;
    startedAt: string | null;
    orderNumber: string;
    guestNote: string | null;
    stationId: string;
    waiterName: string | null;
    orderId: string;
    orderType: "dine_in" | "takeaway" | "delivery" | "room_service" | "event";
    tableLabel: string | null;
    ticketNumber: string;
    stationName: string;
    stationKind: "kitchen" | "bar";
    readyAt: string | null;
    servedAt: string | null;
    elapsedMinutes: number;
    late: boolean;
    printCount: number;
}, {
    status: "cancelled" | "queued" | "ready" | "preparing" | "served";
    id: string;
    items: {
        options: string[];
        status: "cancelled" | "queued" | "ready" | "preparing" | "served";
        name: string;
        id: string;
        note: string | null;
        quantity: number;
        orderItemId: string;
    }[];
    createdAt: string;
    guestCount: number | null;
    startedAt: string | null;
    orderNumber: string;
    guestNote: string | null;
    stationId: string;
    waiterName: string | null;
    orderId: string;
    orderType: "dine_in" | "takeaway" | "delivery" | "room_service" | "event";
    tableLabel: string | null;
    ticketNumber: string;
    stationName: string;
    stationKind: "kitchen" | "bar";
    readyAt: string | null;
    servedAt: string | null;
    elapsedMinutes: number;
    late: boolean;
    printCount: number;
}>;
export type PosTicket = z.infer<typeof PosTicket>;
export declare const PosRegister: z.ZodObject<{
    id: z.ZodString;
    outletId: z.ZodString;
    name: z.ZodString;
    deviceLabel: z.ZodNullable<z.ZodString>;
    openShiftId: z.ZodNullable<z.ZodString>;
    openShiftCashierName: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: string;
    outletId: string;
    deviceLabel: string | null;
    openShiftId: string | null;
    openShiftCashierName: string | null;
}, {
    name: string;
    id: string;
    outletId: string;
    deviceLabel: string | null;
    openShiftId: string | null;
    openShiftCashierName: string | null;
}>;
export type PosRegister = z.infer<typeof PosRegister>;
export declare const PosCashMovement: z.ZodObject<{
    id: z.ZodString;
    kind: z.ZodEnum<["paid_in", "paid_out"]>;
    amountRwf: z.ZodNumber;
    reason: z.ZodString;
    status: z.ZodEnum<["approved", "pending_approval", "rejected"]>;
    requestedByName: z.ZodNullable<z.ZodString>;
    decidedByName: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "approved" | "rejected" | "pending_approval";
    id: string;
    kind: "paid_out" | "paid_in";
    amountRwf: number;
    reason: string;
    decidedByName: string | null;
    createdAt: string;
    requestedByName: string | null;
}, {
    status: "approved" | "rejected" | "pending_approval";
    id: string;
    kind: "paid_out" | "paid_in";
    amountRwf: number;
    reason: string;
    decidedByName: string | null;
    createdAt: string;
    requestedByName: string | null;
}>;
export type PosCashMovement = z.infer<typeof PosCashMovement>;
export declare const PosShift: z.ZodObject<{
    id: z.ZodString;
    registerId: z.ZodString;
    registerName: z.ZodString;
    cashierUserId: z.ZodString;
    cashierName: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<["open", "closed", "reviewed"]>;
    openingFloatRwf: z.ZodNumber;
    openedAt: z.ZodString;
    closedAt: z.ZodNullable<z.ZodString>;
    cashSalesRwf: z.ZodNumber;
    cashRefundsRwf: z.ZodNumber;
    paidInRwf: z.ZodNumber;
    paidOutRwf: z.ZodNumber;
    /** Computed now for an open shift, frozen at close. */
    expectedCashRwf: z.ZodNumber;
    countedCashRwf: z.ZodNullable<z.ZodNumber>;
    varianceRwf: z.ZodNullable<z.ZodNumber>;
    takingsByMethod: z.ZodArray<z.ZodObject<{
        method: z.ZodEnum<["cash", "mtn_momo", "airtel_money", "card", "bank_transfer", "voucher", "customer_credit"]>;
        amountRwf: z.ZodNumber;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        count: number;
        amountRwf: number;
        method: "mtn_momo" | "airtel_money" | "card" | "cash" | "bank_transfer" | "voucher" | "customer_credit";
    }, {
        count: number;
        amountRwf: number;
        method: "mtn_momo" | "airtel_money" | "card" | "cash" | "bank_transfer" | "voucher" | "customer_credit";
    }>, "many">;
    tipsRwf: z.ZodNumber;
    closeNote: z.ZodNullable<z.ZodString>;
    handoverNote: z.ZodNullable<z.ZodString>;
    reviewedByName: z.ZodNullable<z.ZodString>;
    reviewNote: z.ZodNullable<z.ZodString>;
    movements: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodEnum<["paid_in", "paid_out"]>;
        amountRwf: z.ZodNumber;
        reason: z.ZodString;
        status: z.ZodEnum<["approved", "pending_approval", "rejected"]>;
        requestedByName: z.ZodNullable<z.ZodString>;
        decidedByName: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "approved" | "rejected" | "pending_approval";
        id: string;
        kind: "paid_out" | "paid_in";
        amountRwf: number;
        reason: string;
        decidedByName: string | null;
        createdAt: string;
        requestedByName: string | null;
    }, {
        status: "approved" | "rejected" | "pending_approval";
        id: string;
        kind: "paid_out" | "paid_in";
        amountRwf: number;
        reason: string;
        decidedByName: string | null;
        createdAt: string;
        requestedByName: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    status: "open" | "closed" | "reviewed";
    id: string;
    openedAt: string;
    closedAt: string | null;
    closeNote: string | null;
    openingFloatRwf: number;
    cashSalesRwf: number;
    cashRefundsRwf: number;
    paidInRwf: number;
    paidOutRwf: number;
    registerId: string;
    registerName: string;
    cashierUserId: string;
    cashierName: string | null;
    expectedCashRwf: number;
    countedCashRwf: number | null;
    varianceRwf: number | null;
    takingsByMethod: {
        count: number;
        amountRwf: number;
        method: "mtn_momo" | "airtel_money" | "card" | "cash" | "bank_transfer" | "voucher" | "customer_credit";
    }[];
    tipsRwf: number;
    handoverNote: string | null;
    reviewedByName: string | null;
    reviewNote: string | null;
    movements: {
        status: "approved" | "rejected" | "pending_approval";
        id: string;
        kind: "paid_out" | "paid_in";
        amountRwf: number;
        reason: string;
        decidedByName: string | null;
        createdAt: string;
        requestedByName: string | null;
    }[];
}, {
    status: "open" | "closed" | "reviewed";
    id: string;
    openedAt: string;
    closedAt: string | null;
    closeNote: string | null;
    openingFloatRwf: number;
    cashSalesRwf: number;
    cashRefundsRwf: number;
    paidInRwf: number;
    paidOutRwf: number;
    registerId: string;
    registerName: string;
    cashierUserId: string;
    cashierName: string | null;
    expectedCashRwf: number;
    countedCashRwf: number | null;
    varianceRwf: number | null;
    takingsByMethod: {
        count: number;
        amountRwf: number;
        method: "mtn_momo" | "airtel_money" | "card" | "cash" | "bank_transfer" | "voucher" | "customer_credit";
    }[];
    tipsRwf: number;
    handoverNote: string | null;
    reviewedByName: string | null;
    reviewNote: string | null;
    movements: {
        status: "approved" | "rejected" | "pending_approval";
        id: string;
        kind: "paid_out" | "paid_in";
        amountRwf: number;
        reason: string;
        decidedByName: string | null;
        createdAt: string;
        requestedByName: string | null;
    }[];
}>;
export type PosShift = z.infer<typeof PosShift>;
export declare const PosAuditEvent: z.ZodObject<{
    id: z.ZodString;
    occurredAt: z.ZodString;
    actorName: z.ZodNullable<z.ZodString>;
    outletId: z.ZodNullable<z.ZodString>;
    action: z.ZodString;
    entityType: z.ZodString;
    entityId: z.ZodNullable<z.ZodString>;
    before: z.ZodNullable<z.ZodUnknown>;
    after: z.ZodNullable<z.ZodUnknown>;
    reason: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    reason: string | null;
    occurredAt: string;
    actorName: string | null;
    outletId: string | null;
    action: string;
    entityType: string;
    entityId: string | null;
    before?: unknown;
    after?: unknown;
}, {
    id: string;
    reason: string | null;
    occurredAt: string;
    actorName: string | null;
    outletId: string | null;
    action: string;
    entityType: string;
    entityId: string | null;
    before?: unknown;
    after?: unknown;
}>;
export type PosAuditEvent = z.infer<typeof PosAuditEvent>;
export declare const OpenTableSessionRequest: z.ZodObject<{
    guestCount: z.ZodNumber;
    /** Defaults to the person opening it. */
    waiterUserId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    guestCount: number;
    waiterUserId?: string | undefined;
}, {
    guestCount: number;
    waiterUserId?: string | undefined;
}>;
export type OpenTableSessionRequest = z.infer<typeof OpenTableSessionRequest>;
export declare const SetTableStatusRequest: z.ZodObject<{
    status: z.ZodEnum<["available", "occupied", "reserved", "bill_requested", "cleaning"]>;
}, "strip", z.ZodTypeAny, {
    status: "available" | "occupied" | "reserved" | "bill_requested" | "cleaning";
}, {
    status: "available" | "occupied" | "reserved" | "bill_requested" | "cleaning";
}>;
export type SetTableStatusRequest = z.infer<typeof SetTableStatusRequest>;
export declare const MoveSessionRequest: z.ZodObject<{
    toTableId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    toTableId: string;
}, {
    toTableId: string;
}>;
export type MoveSessionRequest = z.infer<typeof MoveSessionRequest>;
export declare const MergeSessionsRequest: z.ZodObject<{
    fromSessionId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    fromSessionId: string;
}, {
    fromSessionId: string;
}>;
export type MergeSessionsRequest = z.infer<typeof MergeSessionsRequest>;
export declare const PosLineRequest: z.ZodObject<{
    serviceItemId: z.ZodString;
    quantity: z.ZodNumber;
    selectedOptions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        choices: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        name: string;
        choices: string[];
    }, {
        name: string;
        choices: string[];
    }>, "many">>;
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    quantity: number;
    serviceItemId: string;
    note?: string | undefined;
    selectedOptions?: {
        name: string;
        choices: string[];
    }[] | undefined;
}, {
    quantity: number;
    serviceItemId: string;
    note?: string | undefined;
    selectedOptions?: {
        name: string;
        choices: string[];
    }[] | undefined;
}>;
export type PosLineRequest = z.infer<typeof PosLineRequest>;
export declare const CreatePosOrderRequest: z.ZodEffects<z.ZodObject<{
    outletId: z.ZodString;
    orderType: z.ZodEnum<["dine_in", "takeaway", "delivery", "room_service", "event"]>;
    tableSessionId: z.ZodOptional<z.ZodString>;
    guestNote: z.ZodOptional<z.ZodString>;
    lines: z.ZodDefault<z.ZodArray<z.ZodObject<{
        serviceItemId: z.ZodString;
        quantity: z.ZodNumber;
        selectedOptions: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            choices: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            name: string;
            choices: string[];
        }, {
            name: string;
            choices: string[];
        }>, "many">>;
        note: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        quantity: number;
        serviceItemId: string;
        note?: string | undefined;
        selectedOptions?: {
            name: string;
            choices: string[];
        }[] | undefined;
    }, {
        quantity: number;
        serviceItemId: string;
        note?: string | undefined;
        selectedOptions?: {
            name: string;
            choices: string[];
        }[] | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    outletId: string;
    orderType: "dine_in" | "takeaway" | "delivery" | "room_service" | "event";
    lines: {
        quantity: number;
        serviceItemId: string;
        note?: string | undefined;
        selectedOptions?: {
            name: string;
            choices: string[];
        }[] | undefined;
    }[];
    guestNote?: string | undefined;
    tableSessionId?: string | undefined;
}, {
    outletId: string;
    orderType: "dine_in" | "takeaway" | "delivery" | "room_service" | "event";
    guestNote?: string | undefined;
    tableSessionId?: string | undefined;
    lines?: {
        quantity: number;
        serviceItemId: string;
        note?: string | undefined;
        selectedOptions?: {
            name: string;
            choices: string[];
        }[] | undefined;
    }[] | undefined;
}>, {
    outletId: string;
    orderType: "dine_in" | "takeaway" | "delivery" | "room_service" | "event";
    lines: {
        quantity: number;
        serviceItemId: string;
        note?: string | undefined;
        selectedOptions?: {
            name: string;
            choices: string[];
        }[] | undefined;
    }[];
    guestNote?: string | undefined;
    tableSessionId?: string | undefined;
}, {
    outletId: string;
    orderType: "dine_in" | "takeaway" | "delivery" | "room_service" | "event";
    guestNote?: string | undefined;
    tableSessionId?: string | undefined;
    lines?: {
        quantity: number;
        serviceItemId: string;
        note?: string | undefined;
        selectedOptions?: {
            name: string;
            choices: string[];
        }[] | undefined;
    }[] | undefined;
}>;
export type CreatePosOrderRequest = z.infer<typeof CreatePosOrderRequest>;
export declare const AddPosLinesRequest: z.ZodObject<{
    lines: z.ZodArray<z.ZodObject<{
        serviceItemId: z.ZodString;
        quantity: z.ZodNumber;
        selectedOptions: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            choices: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            name: string;
            choices: string[];
        }, {
            name: string;
            choices: string[];
        }>, "many">>;
        note: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        quantity: number;
        serviceItemId: string;
        note?: string | undefined;
        selectedOptions?: {
            name: string;
            choices: string[];
        }[] | undefined;
    }, {
        quantity: number;
        serviceItemId: string;
        note?: string | undefined;
        selectedOptions?: {
            name: string;
            choices: string[];
        }[] | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    lines: {
        quantity: number;
        serviceItemId: string;
        note?: string | undefined;
        selectedOptions?: {
            name: string;
            choices: string[];
        }[] | undefined;
    }[];
}, {
    lines: {
        quantity: number;
        serviceItemId: string;
        note?: string | undefined;
        selectedOptions?: {
            name: string;
            choices: string[];
        }[] | undefined;
    }[];
}>;
export type AddPosLinesRequest = z.infer<typeof AddPosLinesRequest>;
/** Only a draft line can be changed; a sent one is voided and re-added. */
export declare const UpdatePosLineRequest: z.ZodObject<{
    quantity: z.ZodOptional<z.ZodNumber>;
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    note?: string | null | undefined;
    quantity?: number | undefined;
}, {
    note?: string | null | undefined;
    quantity?: number | undefined;
}>;
export type UpdatePosLineRequest = z.infer<typeof UpdatePosLineRequest>;
export declare const VoidPosLineRequest: z.ZodObject<{
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
}, {
    reason: string;
}>;
export type VoidPosLineRequest = z.infer<typeof VoidPosLineRequest>;
export declare const CancelPosOrderRequest: z.ZodObject<{
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
}, {
    reason: string;
}>;
export type CancelPosOrderRequest = z.infer<typeof CancelPosOrderRequest>;
export declare const ApplyPosDiscountRequest: z.ZodEffects<z.ZodObject<{
    /** A line, or the whole order when absent. */
    orderItemId: z.ZodOptional<z.ZodString>;
    kind: z.ZodEnum<["amount", "percent"]>;
    /** RWF for `amount`, basis points for `percent` (1000 is 10%). */
    value: z.ZodNumber;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    value: number;
    kind: "percent" | "amount";
    reason: string;
    orderItemId?: string | undefined;
}, {
    value: number;
    kind: "percent" | "amount";
    reason: string;
    orderItemId?: string | undefined;
}>, {
    value: number;
    kind: "percent" | "amount";
    reason: string;
    orderItemId?: string | undefined;
}, {
    value: number;
    kind: "percent" | "amount";
    reason: string;
    orderItemId?: string | undefined;
}>;
export type ApplyPosDiscountRequest = z.infer<typeof ApplyPosDiscountRequest>;
export declare const DecidePosDiscountRequest: z.ZodObject<{
    approve: z.ZodBoolean;
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    approve: boolean;
    note?: string | undefined;
}, {
    approve: boolean;
    note?: string | undefined;
}>;
export type DecidePosDiscountRequest = z.infer<typeof DecidePosDiscountRequest>;
export declare const TransferPosOrderRequest: z.ZodObject<{
    toTableSessionId: z.ZodString;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
    toTableSessionId: string;
}, {
    reason: string;
    toTableSessionId: string;
}>;
export type TransferPosOrderRequest = z.infer<typeof TransferPosOrderRequest>;
/** Move whole lines to a new order on the same session: the split bill. */
export declare const SplitPosOrderRequest: z.ZodObject<{
    orderItemIds: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    orderItemIds: string[];
}, {
    orderItemIds: string[];
}>;
export type SplitPosOrderRequest = z.infer<typeof SplitPosOrderRequest>;
export declare const TakePosPaymentRequest: z.ZodObject<{
    method: z.ZodEnum<["cash", "mtn_momo", "airtel_money", "card", "bank_transfer", "voucher", "customer_credit"]>;
    amountRwf: z.ZodNumber;
    /** Cash handed over, when more than the amount. */
    tenderedRwf: z.ZodOptional<z.ZodNumber>;
    tipRwf: z.ZodDefault<z.ZodNumber>;
    /** What the demo provider answers. Ignored for cash and vouchers, which settle at once. */
    simulate: z.ZodDefault<z.ZodEnum<["success", "pending", "failure", "timeout"]>>;
    /** A fictional payer number for the simulated mobile money prompt. */
    payerPhone: z.ZodOptional<z.ZodString>;
    voucherCode: z.ZodOptional<z.ZodString>;
    /** One per press of "Take payment": a retried request returns the first payment. */
    idempotencyKey: z.ZodString;
}, "strip", z.ZodTypeAny, {
    amountRwf: number;
    method: "mtn_momo" | "airtel_money" | "card" | "cash" | "bank_transfer" | "voucher" | "customer_credit";
    tipRwf: number;
    simulate: "pending" | "success" | "failure" | "timeout";
    idempotencyKey: string;
    tenderedRwf?: number | undefined;
    payerPhone?: string | undefined;
    voucherCode?: string | undefined;
}, {
    amountRwf: number;
    method: "mtn_momo" | "airtel_money" | "card" | "cash" | "bank_transfer" | "voucher" | "customer_credit";
    idempotencyKey: string;
    tenderedRwf?: number | undefined;
    tipRwf?: number | undefined;
    simulate?: "pending" | "success" | "failure" | "timeout" | undefined;
    payerPhone?: string | undefined;
    voucherCode?: string | undefined;
}>;
export type TakePosPaymentRequest = z.infer<typeof TakePosPaymentRequest>;
/** The simulated provider callback for a pending payment. */
export declare const ResolvePosPaymentRequest: z.ZodObject<{
    outcome: z.ZodEnum<["success", "failure", "timeout"]>;
}, "strip", z.ZodTypeAny, {
    outcome: "success" | "failure" | "timeout";
}, {
    outcome: "success" | "failure" | "timeout";
}>;
export type ResolvePosPaymentRequest = z.infer<typeof ResolvePosPaymentRequest>;
export declare const RefundPosPaymentRequest: z.ZodObject<{
    amountRwf: z.ZodNumber;
    reason: z.ZodString;
    idempotencyKey: z.ZodString;
}, "strip", z.ZodTypeAny, {
    amountRwf: number;
    reason: string;
    idempotencyKey: string;
}, {
    amountRwf: number;
    reason: string;
    idempotencyKey: string;
}>;
export type RefundPosPaymentRequest = z.infer<typeof RefundPosPaymentRequest>;
export declare const AdvancePosTicketRequest: z.ZodObject<{
    to: z.ZodEnum<["queued", "preparing", "ready", "served", "cancelled"]>;
}, "strip", z.ZodTypeAny, {
    to: "cancelled" | "queued" | "ready" | "preparing" | "served";
}, {
    to: "cancelled" | "queued" | "ready" | "preparing" | "served";
}>;
export type AdvancePosTicketRequest = z.infer<typeof AdvancePosTicketRequest>;
export declare const OpenShiftRequest: z.ZodObject<{
    registerId: z.ZodString;
    openingFloatRwf: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    openingFloatRwf: number;
    registerId: string;
}, {
    openingFloatRwf: number;
    registerId: string;
}>;
export type OpenShiftRequest = z.infer<typeof OpenShiftRequest>;
export declare const CloseShiftRequest: z.ZodObject<{
    countedCashRwf: z.ZodNumber;
    closeNote: z.ZodOptional<z.ZodString>;
    handoverNote: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    countedCashRwf: number;
    closeNote?: string | undefined;
    handoverNote?: string | undefined;
}, {
    countedCashRwf: number;
    closeNote?: string | undefined;
    handoverNote?: string | undefined;
}>;
export type CloseShiftRequest = z.infer<typeof CloseShiftRequest>;
export declare const CashMovementRequest: z.ZodObject<{
    kind: z.ZodEnum<["paid_in", "paid_out"]>;
    amountRwf: z.ZodNumber;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    kind: "paid_out" | "paid_in";
    amountRwf: number;
    reason: string;
}, {
    kind: "paid_out" | "paid_in";
    amountRwf: number;
    reason: string;
}>;
export type CashMovementRequest = z.infer<typeof CashMovementRequest>;
export declare const DecideCashMovementRequest: z.ZodObject<{
    approve: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    approve: boolean;
}, {
    approve: boolean;
}>;
export type DecideCashMovementRequest = z.infer<typeof DecideCashMovementRequest>;
export declare const ReviewShiftRequest: z.ZodObject<{
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    note?: string | undefined;
}, {
    note?: string | undefined;
}>;
export type ReviewShiftRequest = z.infer<typeof ReviewShiftRequest>;
export declare const PosListQuery: z.ZodObject<{
    outletId: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodString>;
    from: z.ZodOptional<z.ZodString>;
    to: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    status?: string | undefined;
    from?: string | undefined;
    to?: string | undefined;
    outletId?: string | undefined;
}, {
    status?: string | undefined;
    from?: string | undefined;
    to?: string | undefined;
    outletId?: string | undefined;
    limit?: number | undefined;
}>;
export type PosListQuery = z.infer<typeof PosListQuery>;
export declare const PosVenueArea: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    sortOrder: z.ZodNumber;
    /** Tables in this area that are not archived. */
    tableCount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: string;
    sortOrder: number;
    tableCount: number;
}, {
    name: string;
    id: string;
    sortOrder: number;
    tableCount: number;
}>;
export type PosVenueArea = z.infer<typeof PosVenueArea>;
export declare const PosVenueTable: z.ZodObject<{
    id: z.ZodString;
    areaId: z.ZodString;
    label: z.ZodString;
    seats: z.ZodNumber;
    status: z.ZodEnum<["available", "occupied", "reserved", "bill_requested", "cleaning"]>;
    sortOrder: z.ZodNumber;
    /** A party is seated here now, so the table cannot be archived. */
    hasOpenSession: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    status: "available" | "occupied" | "reserved" | "bill_requested" | "cleaning";
    id: string;
    sortOrder: number;
    label: string;
    areaId: string;
    seats: number;
    hasOpenSession: boolean;
}, {
    status: "available" | "occupied" | "reserved" | "bill_requested" | "cleaning";
    id: string;
    sortOrder: number;
    label: string;
    areaId: string;
    seats: number;
    hasOpenSession: boolean;
}>;
export type PosVenueTable = z.infer<typeof PosVenueTable>;
export declare const PosVenueStation: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    kind: z.ZodEnum<["kitchen", "bar"]>;
    printerName: z.ZodNullable<z.ZodString>;
    sortOrder: z.ZodNumber;
    /** Menu items whose tickets go to this station. */
    routedItems: z.ZodNumber;
    /** Tickets still queued, being prepared or ready. */
    openTickets: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: string;
    kind: "kitchen" | "bar";
    sortOrder: number;
    printerName: string | null;
    routedItems: number;
    openTickets: number;
}, {
    name: string;
    id: string;
    kind: "kitchen" | "bar";
    sortOrder: number;
    printerName: string | null;
    routedItems: number;
    openTickets: number;
}>;
export type PosVenueStation = z.infer<typeof PosVenueStation>;
export declare const PosVenueRegister: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    deviceLabel: z.ZodNullable<z.ZodString>;
    /** A cashier has a shift open on it now, so it cannot be archived. */
    hasOpenShift: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: string;
    deviceLabel: string | null;
    hasOpenShift: boolean;
}, {
    name: string;
    id: string;
    deviceLabel: string | null;
    hasOpenShift: boolean;
}>;
export type PosVenueRegister = z.infer<typeof PosVenueRegister>;
export declare const PosVenueRoute: z.ZodObject<{
    serviceItemId: z.ZodString;
    name: z.ZodString;
    categoryName: z.ZodNullable<z.ZodString>;
    /** The station that prepares it, or null when it sends no ticket (a bottle handed over the counter). */
    stationId: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    serviceItemId: string;
    stationId: string | null;
    categoryName: string | null;
}, {
    name: string;
    serviceItemId: string;
    stationId: string | null;
    categoryName: string | null;
}>;
export type PosVenueRoute = z.infer<typeof PosVenueRoute>;
export declare const PosVenue: z.ZodObject<{
    outletId: z.ZodString;
    areas: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        sortOrder: z.ZodNumber;
        /** Tables in this area that are not archived. */
        tableCount: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
        sortOrder: number;
        tableCount: number;
    }, {
        name: string;
        id: string;
        sortOrder: number;
        tableCount: number;
    }>, "many">;
    tables: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        areaId: z.ZodString;
        label: z.ZodString;
        seats: z.ZodNumber;
        status: z.ZodEnum<["available", "occupied", "reserved", "bill_requested", "cleaning"]>;
        sortOrder: z.ZodNumber;
        /** A party is seated here now, so the table cannot be archived. */
        hasOpenSession: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        status: "available" | "occupied" | "reserved" | "bill_requested" | "cleaning";
        id: string;
        sortOrder: number;
        label: string;
        areaId: string;
        seats: number;
        hasOpenSession: boolean;
    }, {
        status: "available" | "occupied" | "reserved" | "bill_requested" | "cleaning";
        id: string;
        sortOrder: number;
        label: string;
        areaId: string;
        seats: number;
        hasOpenSession: boolean;
    }>, "many">;
    stations: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        kind: z.ZodEnum<["kitchen", "bar"]>;
        printerName: z.ZodNullable<z.ZodString>;
        sortOrder: z.ZodNumber;
        /** Menu items whose tickets go to this station. */
        routedItems: z.ZodNumber;
        /** Tickets still queued, being prepared or ready. */
        openTickets: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
        kind: "kitchen" | "bar";
        sortOrder: number;
        printerName: string | null;
        routedItems: number;
        openTickets: number;
    }, {
        name: string;
        id: string;
        kind: "kitchen" | "bar";
        sortOrder: number;
        printerName: string | null;
        routedItems: number;
        openTickets: number;
    }>, "many">;
    registers: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        deviceLabel: z.ZodNullable<z.ZodString>;
        /** A cashier has a shift open on it now, so it cannot be archived. */
        hasOpenShift: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
        deviceLabel: string | null;
        hasOpenShift: boolean;
    }, {
        name: string;
        id: string;
        deviceLabel: string | null;
        hasOpenShift: boolean;
    }>, "many">;
    routing: z.ZodArray<z.ZodObject<{
        serviceItemId: z.ZodString;
        name: z.ZodString;
        categoryName: z.ZodNullable<z.ZodString>;
        /** The station that prepares it, or null when it sends no ticket (a bottle handed over the counter). */
        stationId: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        serviceItemId: string;
        stationId: string | null;
        categoryName: string | null;
    }, {
        name: string;
        serviceItemId: string;
        stationId: string | null;
        categoryName: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    outletId: string;
    areas: {
        name: string;
        id: string;
        sortOrder: number;
        tableCount: number;
    }[];
    tables: {
        status: "available" | "occupied" | "reserved" | "bill_requested" | "cleaning";
        id: string;
        sortOrder: number;
        label: string;
        areaId: string;
        seats: number;
        hasOpenSession: boolean;
    }[];
    stations: {
        name: string;
        id: string;
        kind: "kitchen" | "bar";
        sortOrder: number;
        printerName: string | null;
        routedItems: number;
        openTickets: number;
    }[];
    registers: {
        name: string;
        id: string;
        deviceLabel: string | null;
        hasOpenShift: boolean;
    }[];
    routing: {
        name: string;
        serviceItemId: string;
        stationId: string | null;
        categoryName: string | null;
    }[];
}, {
    outletId: string;
    areas: {
        name: string;
        id: string;
        sortOrder: number;
        tableCount: number;
    }[];
    tables: {
        status: "available" | "occupied" | "reserved" | "bill_requested" | "cleaning";
        id: string;
        sortOrder: number;
        label: string;
        areaId: string;
        seats: number;
        hasOpenSession: boolean;
    }[];
    stations: {
        name: string;
        id: string;
        kind: "kitchen" | "bar";
        sortOrder: number;
        printerName: string | null;
        routedItems: number;
        openTickets: number;
    }[];
    registers: {
        name: string;
        id: string;
        deviceLabel: string | null;
        hasOpenShift: boolean;
    }[];
    routing: {
        name: string;
        serviceItemId: string;
        stationId: string | null;
        categoryName: string | null;
    }[];
}>;
export type PosVenue = z.infer<typeof PosVenue>;
export declare const CreateAreaRequest: z.ZodObject<{
    name: z.ZodString;
    sortOrder: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name: string;
    sortOrder?: number | undefined;
}, {
    name: string;
    sortOrder?: number | undefined;
}>;
export type CreateAreaRequest = z.infer<typeof CreateAreaRequest>;
export declare const UpdateAreaRequest: z.ZodEffects<z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    sortOrder: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    sortOrder?: number | undefined;
}, {
    name?: string | undefined;
    sortOrder?: number | undefined;
}>, {
    name?: string | undefined;
    sortOrder?: number | undefined;
}, {
    name?: string | undefined;
    sortOrder?: number | undefined;
}>;
export type UpdateAreaRequest = z.infer<typeof UpdateAreaRequest>;
export declare const CreateTableRequest: z.ZodObject<{
    areaId: z.ZodString;
    label: z.ZodString;
    seats: z.ZodNumber;
    sortOrder: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    label: string;
    areaId: string;
    seats: number;
    sortOrder?: number | undefined;
}, {
    label: string;
    areaId: string;
    seats: number;
    sortOrder?: number | undefined;
}>;
export type CreateTableRequest = z.infer<typeof CreateTableRequest>;
export declare const UpdateTableRequest: z.ZodEffects<z.ZodObject<{
    areaId: z.ZodOptional<z.ZodString>;
    label: z.ZodOptional<z.ZodString>;
    seats: z.ZodOptional<z.ZodNumber>;
    sortOrder: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    sortOrder?: number | undefined;
    label?: string | undefined;
    areaId?: string | undefined;
    seats?: number | undefined;
}, {
    sortOrder?: number | undefined;
    label?: string | undefined;
    areaId?: string | undefined;
    seats?: number | undefined;
}>, {
    sortOrder?: number | undefined;
    label?: string | undefined;
    areaId?: string | undefined;
    seats?: number | undefined;
}, {
    sortOrder?: number | undefined;
    label?: string | undefined;
    areaId?: string | undefined;
    seats?: number | undefined;
}>;
export type UpdateTableRequest = z.infer<typeof UpdateTableRequest>;
export declare const CreateStationRequest: z.ZodObject<{
    name: z.ZodString;
    kind: z.ZodEnum<["kitchen", "bar"]>;
    /** The name a SIMULATED print job is addressed to. No device is contacted. */
    printerName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    sortOrder: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name: string;
    kind: "kitchen" | "bar";
    sortOrder?: number | undefined;
    printerName?: string | null | undefined;
}, {
    name: string;
    kind: "kitchen" | "bar";
    sortOrder?: number | undefined;
    printerName?: string | null | undefined;
}>;
export type CreateStationRequest = z.infer<typeof CreateStationRequest>;
export declare const UpdateStationRequest: z.ZodEffects<z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    kind: z.ZodOptional<z.ZodEnum<["kitchen", "bar"]>>;
    printerName: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    sortOrder: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    kind?: "kitchen" | "bar" | undefined;
    sortOrder?: number | undefined;
    printerName?: string | null | undefined;
}, {
    name?: string | undefined;
    kind?: "kitchen" | "bar" | undefined;
    sortOrder?: number | undefined;
    printerName?: string | null | undefined;
}>, {
    name?: string | undefined;
    kind?: "kitchen" | "bar" | undefined;
    sortOrder?: number | undefined;
    printerName?: string | null | undefined;
}, {
    name?: string | undefined;
    kind?: "kitchen" | "bar" | undefined;
    sortOrder?: number | undefined;
    printerName?: string | null | undefined;
}>;
export type UpdateStationRequest = z.infer<typeof UpdateStationRequest>;
export declare const CreateRegisterRequest: z.ZodObject<{
    name: z.ZodString;
    deviceLabel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    deviceLabel?: string | null | undefined;
}, {
    name: string;
    deviceLabel?: string | null | undefined;
}>;
export type CreateRegisterRequest = z.infer<typeof CreateRegisterRequest>;
export declare const UpdateRegisterRequest: z.ZodEffects<z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    deviceLabel: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    deviceLabel?: string | null | undefined;
}, {
    name?: string | undefined;
    deviceLabel?: string | null | undefined;
}>, {
    name?: string | undefined;
    deviceLabel?: string | null | undefined;
}, {
    name?: string | undefined;
    deviceLabel?: string | null | undefined;
}>;
export type UpdateRegisterRequest = z.infer<typeof UpdateRegisterRequest>;
export declare const SetItemRouteRequest: z.ZodObject<{
    serviceItemId: z.ZodString;
    /** null clears the route: the item then sends no ticket. */
    stationId: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    serviceItemId: string;
    stationId: string | null;
}, {
    serviceItemId: string;
    stationId: string | null;
}>;
export type SetItemRouteRequest = z.infer<typeof SetItemRouteRequest>;
export declare const POS_SETUP_STEPS: readonly ["areas", "tables", "stations", "registers", "categories", "products", "routing", "receipts", "team"];
export declare const PosSetupStepKey: z.ZodEnum<["areas", "tables", "stations", "registers", "categories", "products", "routing", "receipts", "team"]>;
export type PosSetupStepKey = z.infer<typeof PosSetupStepKey>;
export declare const PosSetupStep: z.ZodObject<{
    key: z.ZodEnum<["areas", "tables", "stations", "registers", "categories", "products", "routing", "receipts", "team"]>;
    done: z.ZodBoolean;
    /** How many of the thing exist (areas, tables, products...). */
    count: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    count: number;
    key: "products" | "categories" | "areas" | "tables" | "stations" | "registers" | "routing" | "receipts" | "team";
    done: boolean;
}, {
    count: number;
    key: "products" | "categories" | "areas" | "tables" | "stations" | "registers" | "routing" | "receipts" | "team";
    done: boolean;
}>;
export type PosSetupStep = z.infer<typeof PosSetupStep>;
export declare const PosSetup: z.ZodObject<{
    outletId: z.ZodString;
    steps: z.ZodArray<z.ZodObject<{
        key: z.ZodEnum<["areas", "tables", "stations", "registers", "categories", "products", "routing", "receipts", "team"]>;
        done: z.ZodBoolean;
        /** How many of the thing exist (areas, tables, products...). */
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        count: number;
        key: "products" | "categories" | "areas" | "tables" | "stations" | "registers" | "routing" | "receipts" | "team";
        done: boolean;
    }, {
        count: number;
        key: "products" | "categories" | "areas" | "tables" | "stations" | "registers" | "routing" | "receipts" | "team";
        done: boolean;
    }>, "many">;
    doneCount: z.ZodNumber;
    total: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    total: number;
    outletId: string;
    doneCount: number;
    steps: {
        count: number;
        key: "products" | "categories" | "areas" | "tables" | "stations" | "registers" | "routing" | "receipts" | "team";
        done: boolean;
    }[];
}, {
    total: number;
    outletId: string;
    doneCount: number;
    steps: {
        count: number;
        key: "products" | "categories" | "areas" | "tables" | "stations" | "registers" | "routing" | "receipts" | "team";
        done: boolean;
    }[];
}>;
export type PosSetup = z.infer<typeof PosSetup>;
//# sourceMappingURL=pos.d.ts.map