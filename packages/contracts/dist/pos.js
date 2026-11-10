"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MergeSessionsRequest = exports.MoveSessionRequest = exports.SetTableStatusRequest = exports.OpenTableSessionRequest = exports.PosAuditEvent = exports.PosShift = exports.PosCashMovement = exports.PosRegister = exports.PosTicket = exports.PosTicketItem = exports.PosOrderSummary = exports.PosOrder = exports.PosOrderCustomer = exports.PosSettlement = exports.PosPayment = exports.PosDiscount = exports.PosOrderLine = exports.PosFloor = exports.PosTable = exports.PosMenu = exports.PosMenuItem = exports.PosStation = exports.PosOutlet = exports.UpdatePosOutletSettingsRequest = exports.PosOutletSettings = exports.PosPaymentState = exports.POS_PAYMENT_SIMULATION_NOTICE = exports.ApprovalStatus = exports.CashMovementKind = exports.ShiftStatus = exports.SimulatedOutcome = exports.PAYMENT_TRANSITIONS = exports.PosPaymentStatus = exports.ASYNC_PAYMENT_METHODS = exports.POS_PAYMENT_METHOD_LABEL = exports.PosPaymentMethod = exports.POS_ORDER_STATUS_LABEL = exports.PosOrderStatus = exports.PosLineStatus = exports.TICKET_LATE_MINUTES = exports.TICKET_TRANSITIONS = exports.TICKET_STATUS_LABEL = exports.TicketStatus = exports.PrepStationKind = exports.TABLE_STATUS_MOVES = exports.TABLE_STATUS_LABEL = exports.TableStatus = exports.PosTaxMode = exports.POS_ORDER_TYPE_LABEL = exports.PosOrderType = void 0;
exports.PosSetup = exports.PosSetupStep = exports.PosSetupStepKey = exports.POS_SETUP_STEPS = exports.SetItemRouteRequest = exports.UpdateRegisterRequest = exports.CreateRegisterRequest = exports.UpdateStationRequest = exports.CreateStationRequest = exports.UpdateTableRequest = exports.CreateTableRequest = exports.UpdateAreaRequest = exports.CreateAreaRequest = exports.PosVenue = exports.PosVenueRoute = exports.PosVenueRegister = exports.PosVenueStation = exports.PosVenueTable = exports.PosVenueArea = exports.PosListQuery = exports.ReviewShiftRequest = exports.DecideCashMovementRequest = exports.CashMovementRequest = exports.CloseShiftRequest = exports.OpenShiftRequest = exports.AdvancePosTicketRequest = exports.RefundPosPaymentRequest = exports.ResolvePosPaymentRequest = exports.TakePosPaymentRequest = exports.SplitPosOrderRequest = exports.TransferPosOrderRequest = exports.DecidePosDiscountRequest = exports.ApplyPosDiscountRequest = exports.CancelPosOrderRequest = exports.VoidPosLineRequest = exports.UpdatePosLineRequest = exports.AddPosLinesRequest = exports.CreatePosOrderRequest = exports.PosLineRequest = void 0;
exports.canMoveTicket = canMoveTicket;
exports.canMovePayment = canMovePayment;
exports.divRoundHalfUp = divRoundHalfUp;
exports.rateToBps = rateToBps;
exports.lineAmounts = lineAmounts;
exports.allocate = allocate;
exports.orderAmounts = orderAmounts;
exports.discountNeedsApproval = discountNeedsApproval;
exports.settlementOf = settlementOf;
exports.checkPayment = checkPayment;
exports.expectedCash = expectedCash;
exports.cashVariance = cashVariance;
exports.demoPaymentReference = demoPaymentReference;
const zod_1 = require("zod");
const ops_1 = require("./ops");
const primitives_1 = require("./primitives");
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
exports.PosOrderType = zod_1.z.enum(["dine_in", "takeaway", "delivery", "room_service", "event"]);
exports.POS_ORDER_TYPE_LABEL = {
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
exports.PosTaxMode = zod_1.z.enum(["exclusive", "inclusive"]);
exports.TableStatus = zod_1.z.enum(["available", "occupied", "reserved", "bill_requested", "cleaning"]);
exports.TABLE_STATUS_LABEL = {
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
exports.TABLE_STATUS_MOVES = {
    available: ["reserved", "cleaning"],
    reserved: ["available"],
    occupied: ["bill_requested"],
    bill_requested: ["occupied"],
    cleaning: ["available"],
};
exports.PrepStationKind = zod_1.z.enum(["kitchen", "bar"]);
exports.TicketStatus = zod_1.z.enum(["queued", "preparing", "ready", "served", "cancelled"]);
exports.TICKET_STATUS_LABEL = {
    queued: "Queued",
    preparing: "Preparing",
    ready: "Ready",
    served: "Served",
    cancelled: "Cancelled",
};
/** A bottle of water may go straight from the queue to the pass, so `queued -> ready` is allowed. */
exports.TICKET_TRANSITIONS = {
    queued: ["preparing", "ready", "cancelled"],
    preparing: ["ready", "cancelled"],
    ready: ["served"],
    served: [],
    cancelled: [],
};
function canMoveTicket(from, to) {
    return exports.TICKET_TRANSITIONS[from].includes(to);
}
/** Minutes after which a waiting ticket is drawn as late. */
exports.TICKET_LATE_MINUTES = 15;
/** A line on an order: drafted, sent to its station, or voided after the fact. */
exports.PosLineStatus = zod_1.z.enum(["draft", "sent", "voided"]);
/** The order's own progress. Payment is NOT in here: see `settlementOf`. */
exports.PosOrderStatus = zod_1.z.enum(["draft", "submitted", "in_progress", "ready", "delivered", "completed", "cancelled"]);
exports.POS_ORDER_STATUS_LABEL = {
    draft: "Draft",
    submitted: "Sent",
    in_progress: "Preparing",
    ready: "Ready",
    delivered: "Served",
    completed: "Completed",
    cancelled: "Cancelled",
};
exports.PosPaymentMethod = zod_1.z.enum([
    "cash",
    "mtn_momo",
    "airtel_money",
    "card",
    "bank_transfer",
    "voucher",
    "customer_credit",
]);
/** Every non cash method is SIMULATED, and the label says so wherever it shows. */
exports.POS_PAYMENT_METHOD_LABEL = {
    cash: "Cash",
    mtn_momo: "MTN MoMo (simulated)",
    airtel_money: "Airtel Money (simulated)",
    card: "Card (simulated)",
    bank_transfer: "Bank transfer (simulated)",
    voucher: "Voucher",
    customer_credit: "Customer credit",
};
/** The methods a provider would answer for asynchronously, so a payment can wait in `pending`. */
exports.ASYNC_PAYMENT_METHODS = ["mtn_momo", "airtel_money", "bank_transfer"];
exports.PosPaymentStatus = zod_1.z.enum([
    "initiated",
    "pending",
    "successful",
    "failed",
    "cancelled",
    "expired",
    "refunded",
]);
exports.PAYMENT_TRANSITIONS = {
    initiated: ["pending", "successful", "failed", "cancelled"],
    pending: ["successful", "failed", "expired", "cancelled"],
    successful: ["refunded"],
    failed: [],
    cancelled: [],
    expired: [],
    refunded: [],
};
function canMovePayment(from, to) {
    return exports.PAYMENT_TRANSITIONS[from].includes(to);
}
/** What the demo provider is told to answer. Never a real provider call. */
exports.SimulatedOutcome = zod_1.z.enum(["success", "pending", "failure", "timeout"]);
exports.ShiftStatus = zod_1.z.enum(["open", "closed", "reviewed"]);
exports.CashMovementKind = zod_1.z.enum(["paid_in", "paid_out"]);
exports.ApprovalStatus = zod_1.z.enum(["approved", "pending_approval", "rejected"]);
/** The stamp every simulated payment carries, on screen and on paper. */
exports.POS_PAYMENT_SIMULATION_NOTICE = "SIMULATED PAYMENT. No money moved and no provider was contacted.";
// ---------------------------------------------------------------------------
// Money: integer RWF, half up per line
// ---------------------------------------------------------------------------
function assertAmount(n, what) {
    if (!Number.isSafeInteger(n))
        throw new RangeError(`${what} must be a whole number of RWF.`);
}
/** `n / d` rounded half up, for `n >= 0` and `d > 0`, with no fraction in between. */
function divRoundHalfUp(n, d) {
    assertAmount(n, "The amount");
    if (!Number.isSafeInteger(d) || d <= 0)
        throw new RangeError("The divisor must be a positive whole number.");
    if (n < 0)
        return -divRoundHalfUp(-n, d);
    return Math.floor((2 * n + d) / (2 * d));
}
/**
 * A tax rate as basis points: `0.18` is `1800`. The rates in config are
 * decimals, so this is where a fraction stops: rounded once, to a whole basis
 * point, and every later step is integers.
 */
function rateToBps(rate) {
    if (!Number.isFinite(rate) || rate < 0 || rate > 1)
        throw new RangeError("A tax rate is between 0 and 1.");
    return Math.round(rate * 10000);
}
/**
 * One line's amounts.
 *
 * EXCLUSIVE: the tax is added, `round(net x rate)`, the same per line rule the
 * service orders already price by. INCLUSIVE: the tax is inside the price,
 * `round(net x rate / (1 + rate))`, so RWF 11,800 at 18% carries RWF 1,800 tax
 * on RWF 10,000 of revenue.
 */
function lineAmounts(line, mode) {
    assertAmount(line.unitPriceRwf, "A unit price");
    assertAmount(line.discountRwf, "A discount");
    if (!Number.isSafeInteger(line.quantity) || line.quantity < 1)
        throw new RangeError("A quantity is a whole number from 1.");
    if (line.unitPriceRwf < 0)
        throw new RangeError("A unit price cannot be negative.");
    if (!Number.isSafeInteger(line.taxRateBps) || line.taxRateBps < 0 || line.taxRateBps > 10000) {
        throw new RangeError("A tax rate is 0 to 10,000 basis points.");
    }
    const grossRwf = line.unitPriceRwf * line.quantity;
    assertAmount(grossRwf, "A line total");
    if (line.discountRwf < 0 || line.discountRwf > grossRwf)
        throw new RangeError("A discount runs from nothing to the whole line.");
    const netRwf = grossRwf - line.discountRwf;
    if (mode === "exclusive") {
        const taxRwf = divRoundHalfUp(netRwf * line.taxRateBps, 10000);
        return { grossRwf, discountRwf: line.discountRwf, netRwf, taxRwf, totalRwf: netRwf + taxRwf };
    }
    const taxRwf = divRoundHalfUp(netRwf * line.taxRateBps, 10000 + line.taxRateBps);
    return { grossRwf, discountRwf: line.discountRwf, netRwf, taxRwf, totalRwf: netRwf };
}
/**
 * Share `amount` across `weights` in proportion, in whole RWF, so the shares
 * add up to exactly `amount` (largest remainder; ties go to the earlier line).
 */
function allocate(amount, weights) {
    assertAmount(amount, "The amount to share");
    if (amount < 0)
        throw new RangeError("Only a positive amount is shared.");
    for (const w of weights)
        assertAmount(w, "A weight");
    const total = weights.reduce((a, b) => a + b, 0);
    if (total === 0) {
        if (amount === 0)
            return weights.map(() => 0);
        throw new RangeError("Nothing to share the amount across.");
    }
    if (amount > total)
        throw new RangeError("The amount is larger than what it is shared across.");
    const shares = weights.map((w) => Math.floor((amount * w) / total));
    let left = amount - shares.reduce((a, b) => a + b, 0);
    const order = weights
        .map((w, i) => ({ i, rest: (amount * w) % total }))
        .sort((a, b) => b.rest - a.rest || a.i - b.i);
    for (const { i } of order) {
        if (left === 0)
            break;
        shares[i] = (shares[i] ?? 0) + 1;
        left -= 1;
    }
    return shares;
}
/**
 * The bill. The order level discount is shared across the lines by what each
 * still sells for, BEFORE tax, so the tax is charged on what was actually
 * charged. Voided lines are not passed in.
 */
function orderAmounts(lines, orderDiscountRwf, mode) {
    const remaining = lines.map((l) => l.unitPriceRwf * l.quantity - l.lineDiscountRwf);
    if (remaining.some((r) => r < 0))
        throw new RangeError("A line discount is larger than its line.");
    const shares = allocate(orderDiscountRwf, remaining);
    const priced = lines.map((l, i) => {
        const share = shares[i] ?? 0;
        return {
            ...lineAmounts({ unitPriceRwf: l.unitPriceRwf, quantity: l.quantity, discountRwf: l.lineDiscountRwf + share, taxRateBps: l.taxRateBps }, mode),
            orderDiscountShareRwf: share,
        };
    });
    const sum = (k) => priced.reduce((a, l) => a + l[k], 0);
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
function discountNeedsApproval(discountRwf, grossRwf, limitBps) {
    assertAmount(discountRwf, "A discount");
    assertAmount(grossRwf, "A gross amount");
    if (discountRwf <= 0)
        return false;
    return discountRwf * 10000 > grossRwf * limitBps;
}
exports.PosPaymentState = zod_1.z.enum(["unpaid", "partially_paid", "paid", "overpaid"]);
/** How much of a bill is collected. The ONE place a payment state is derived. */
function settlementOf(totalRwf, payments) {
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
        else if (p.status === "initiated" || p.status === "pending")
            pendingRwf += p.amountRwf;
    }
    const outstandingRwf = Math.max(0, totalRwf - collectedRwf);
    const payableRwf = Math.max(0, outstandingRwf - pendingRwf);
    const state = collectedRwf <= 0 ? (totalRwf === 0 ? "paid" : "unpaid") : collectedRwf < totalRwf ? "partially_paid" : collectedRwf === totalRwf ? "paid" : "overpaid";
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
/**
 * Whether a new payment may be taken. Cash may be handed over in excess and
 * the change is given back; every other method takes exactly what it pays.
 * Nothing may pay more than is payable, so two payments in flight cannot
 * together collect a bill twice.
 */
function checkPayment(settlement, method, amountRwf, tenderedRwf) {
    assertAmount(amountRwf, "A payment");
    if (amountRwf <= 0)
        return { ok: false, problem: "A payment is more than nothing." };
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
        if (tendered < amountRwf)
            return { ok: false, problem: "The cash handed over is less than the amount paid." };
        return { ok: true, changeRwf: tendered - amountRwf };
    }
    if (tenderedRwf !== null && tenderedRwf !== amountRwf) {
        return { ok: false, problem: "Only cash gives change." };
    }
    return { ok: true, changeRwf: 0 };
}
/** What the drawer should hold at close. */
function expectedCash(f) {
    for (const v of Object.values(f))
        assertAmount(v, "A cash figure");
    return f.openingFloatRwf + f.cashSalesRwf - f.cashRefundsRwf + f.paidInRwf - f.paidOutRwf;
}
/** Counted less expected: positive is over, negative is short. */
function cashVariance(countedRwf, expectedRwf) {
    assertAmount(countedRwf, "The counted cash");
    assertAmount(expectedRwf, "The expected cash");
    return countedRwf - expectedRwf;
}
/** `DEMO-MOMO-7F3K2Q`: a reference no one could mistake for a provider's. */
function demoPaymentReference(method, token) {
    const code = {
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
exports.PosOutletSettings = zod_1.z.object({
    outletId: primitives_1.Uuid,
    taxMode: exports.PosTaxMode,
    /** The largest discount a `pos.discount` holder may give alone, as basis points of the gross. */
    discountLimitBps: zod_1.z.number().int().min(0).max(10000),
    enabledMethods: zod_1.z.array(exports.PosPaymentMethod).min(1),
    receiptHeader: zod_1.z.string().max(200),
    receiptFooter: zod_1.z.string().max(200),
});
exports.UpdatePosOutletSettingsRequest = exports.PosOutletSettings.omit({ outletId: true }).partial();
// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------
exports.PosOutlet = zod_1.z.object({
    id: primitives_1.Uuid,
    name: zod_1.z.string(),
    outletKind: zod_1.z.string(),
    /** The branch, or null for a standalone outlet. */
    propertyId: primitives_1.Uuid.nullable(),
    branchName: zod_1.z.string().nullable(),
    settings: exports.PosOutletSettings,
});
exports.PosStation = zod_1.z.object({
    id: primitives_1.Uuid,
    outletId: primitives_1.Uuid,
    name: zod_1.z.string(),
    kind: exports.PrepStationKind,
    printerName: zod_1.z.string().nullable(),
});
exports.PosMenuItem = zod_1.z.object({
    id: primitives_1.Uuid,
    categoryId: primitives_1.Uuid,
    name: zod_1.z.string(),
    description: zod_1.z.string().nullable(),
    sku: zod_1.z.string().nullable(),
    priceRwf: zod_1.z.number().int(),
    taxCode: ops_1.TaxCode,
    taxRateBps: zod_1.z.number().int(),
    options: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        required: zod_1.z.boolean(),
        maxChoices: zod_1.z.number().int(),
        choices: zod_1.z.array(zod_1.z.object({ label: zod_1.z.string(), priceDeltaRwf: zod_1.z.number().int() })),
    })),
    stationId: primitives_1.Uuid.nullable(),
    available: zod_1.z.boolean(),
    /** Why it cannot be sold, when it cannot. */
    unavailableReason: zod_1.z.string().nullable(),
});
exports.PosMenu = zod_1.z.object({
    outletId: primitives_1.Uuid,
    taxMode: exports.PosTaxMode,
    categories: zod_1.z.array(zod_1.z.object({ id: primitives_1.Uuid, name: zod_1.z.string(), sortOrder: zod_1.z.number().int() })),
    items: zod_1.z.array(exports.PosMenuItem),
});
exports.PosTable = zod_1.z.object({
    id: primitives_1.Uuid,
    areaId: primitives_1.Uuid,
    label: zod_1.z.string(),
    seats: zod_1.z.number().int(),
    status: exports.TableStatus,
    sessionId: primitives_1.Uuid.nullable(),
    guestCount: zod_1.z.number().int().nullable(),
    waiterName: zod_1.z.string().nullable(),
    openedAt: zod_1.z.string().nullable(),
    openOrders: zod_1.z.number().int(),
    /** What the open session's orders still owe, collected payments taken off. */
    outstandingRwf: zod_1.z.number().int(),
});
exports.PosFloor = zod_1.z.object({
    outletId: primitives_1.Uuid,
    areas: zod_1.z.array(zod_1.z.object({ id: primitives_1.Uuid, name: zod_1.z.string(), sortOrder: zod_1.z.number().int() })),
    tables: zod_1.z.array(exports.PosTable),
});
exports.PosOrderLine = zod_1.z.object({
    id: primitives_1.Uuid,
    serviceItemId: primitives_1.Uuid.nullable(),
    name: zod_1.z.string(),
    sku: zod_1.z.string().nullable(),
    quantity: zod_1.z.number().int(),
    unitPriceRwf: zod_1.z.number().int(),
    selectedOptions: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        choices: zod_1.z.array(zod_1.z.object({ label: zod_1.z.string(), priceDeltaRwf: zod_1.z.number().int() })),
    })),
    note: zod_1.z.string().nullable(),
    status: exports.PosLineStatus,
    taxCode: ops_1.TaxCode.nullable(),
    taxRateBps: zod_1.z.number().int(),
    grossRwf: zod_1.z.number().int(),
    discountRwf: zod_1.z.number().int(),
    taxRwf: zod_1.z.number().int(),
    totalRwf: zod_1.z.number().int(),
    voidReason: zod_1.z.string().nullable(),
    stationId: primitives_1.Uuid.nullable(),
});
exports.PosDiscount = zod_1.z.object({
    id: primitives_1.Uuid,
    orderItemId: primitives_1.Uuid.nullable(),
    amountRwf: zod_1.z.number().int(),
    reason: zod_1.z.string(),
    status: exports.ApprovalStatus,
    requestedByName: zod_1.z.string().nullable(),
    decidedByName: zod_1.z.string().nullable(),
    createdAt: zod_1.z.string(),
});
exports.PosPayment = zod_1.z.object({
    id: primitives_1.Uuid,
    orderId: primitives_1.Uuid,
    method: exports.PosPaymentMethod,
    amountRwf: zod_1.z.number().int(),
    tenderedRwf: zod_1.z.number().int().nullable(),
    changeRwf: zod_1.z.number().int(),
    tipRwf: zod_1.z.number().int(),
    refundedRwf: zod_1.z.number().int(),
    status: exports.PosPaymentStatus,
    demoReference: zod_1.z.string(),
    simulated: zod_1.z.boolean(),
    failureReason: zod_1.z.string().nullable(),
    shiftId: primitives_1.Uuid.nullable(),
    createdByName: zod_1.z.string().nullable(),
    createdAt: zod_1.z.string(),
    settledAt: zod_1.z.string().nullable(),
});
exports.PosSettlement = zod_1.z.object({
    totalRwf: zod_1.z.number().int(),
    collectedRwf: zod_1.z.number().int(),
    refundedRwf: zod_1.z.number().int(),
    pendingRwf: zod_1.z.number().int(),
    outstandingRwf: zod_1.z.number().int(),
    payableRwf: zod_1.z.number().int(),
    state: exports.PosPaymentState,
    settled: zod_1.z.boolean(),
});
/**
 * The customer on an order (CRM, phase 1), small enough to ride on every order read. The phone is masked
 * here whatever the reader's role: the order screen needs a name to greet, never a number to copy.
 * Defined here, not in `customers.ts`, because that file imports this one.
 */
exports.PosOrderCustomer = zod_1.z.object({
    id: primitives_1.Uuid,
    fullName: zod_1.z.string(),
    phoneMasked: zod_1.z.string(),
});
exports.PosOrder = zod_1.z.object({
    id: primitives_1.Uuid,
    orderNumber: zod_1.z.string(),
    outletId: primitives_1.Uuid,
    orderType: exports.PosOrderType,
    status: exports.PosOrderStatus,
    tableSessionId: primitives_1.Uuid.nullable(),
    tableLabel: zod_1.z.string().nullable(),
    waiterName: zod_1.z.string().nullable(),
    guestNote: zod_1.z.string().nullable(),
    /** Who the bill is for, when the staff attached a customer. Absent on orders read before CRM existed. */
    customer: exports.PosOrderCustomer.nullable().optional(),
    taxMode: exports.PosTaxMode,
    grossRwf: zod_1.z.number().int(),
    discountRwf: zod_1.z.number().int(),
    taxRwf: zod_1.z.number().int(),
    totalRwf: zod_1.z.number().int(),
    settlement: exports.PosSettlement,
    lines: zod_1.z.array(exports.PosOrderLine),
    discounts: zod_1.z.array(exports.PosDiscount),
    payments: zod_1.z.array(exports.PosPayment),
    cancelReason: zod_1.z.string().nullable(),
    createdAt: zod_1.z.string(),
    settledAt: zod_1.z.string().nullable(),
});
exports.PosOrderSummary = exports.PosOrder.omit({ lines: true, discounts: true, payments: true }).extend({
    lineCount: zod_1.z.number().int(),
});
exports.PosTicketItem = zod_1.z.object({
    id: primitives_1.Uuid,
    orderItemId: primitives_1.Uuid,
    name: zod_1.z.string(),
    quantity: zod_1.z.number().int(),
    options: zod_1.z.array(zod_1.z.string()),
    note: zod_1.z.string().nullable(),
    status: exports.TicketStatus,
});
exports.PosTicket = zod_1.z.object({
    id: primitives_1.Uuid,
    ticketNumber: zod_1.z.string(),
    orderId: primitives_1.Uuid,
    orderNumber: zod_1.z.string(),
    stationId: primitives_1.Uuid,
    stationName: zod_1.z.string(),
    stationKind: exports.PrepStationKind,
    status: exports.TicketStatus,
    tableLabel: zod_1.z.string().nullable(),
    waiterName: zod_1.z.string().nullable(),
    orderType: exports.PosOrderType,
    /** The order's guest note (a name, an allergy), or null. An order has no customer-name field of its own. */
    guestNote: zod_1.z.string().nullable(),
    /** The table's party size, or null for an order without a table. */
    guestCount: zod_1.z.number().int().nullable(),
    items: zod_1.z.array(exports.PosTicketItem),
    createdAt: zod_1.z.string(),
    startedAt: zod_1.z.string().nullable(),
    readyAt: zod_1.z.string().nullable(),
    servedAt: zod_1.z.string().nullable(),
    /** Whole minutes since the ticket was sent, at read time. */
    elapsedMinutes: zod_1.z.number().int(),
    late: zod_1.z.boolean(),
    printCount: zod_1.z.number().int(),
});
exports.PosRegister = zod_1.z.object({
    id: primitives_1.Uuid,
    outletId: primitives_1.Uuid,
    name: zod_1.z.string(),
    deviceLabel: zod_1.z.string().nullable(),
    openShiftId: primitives_1.Uuid.nullable(),
    openShiftCashierName: zod_1.z.string().nullable(),
});
exports.PosCashMovement = zod_1.z.object({
    id: primitives_1.Uuid,
    kind: exports.CashMovementKind,
    amountRwf: zod_1.z.number().int(),
    reason: zod_1.z.string(),
    status: exports.ApprovalStatus,
    requestedByName: zod_1.z.string().nullable(),
    decidedByName: zod_1.z.string().nullable(),
    createdAt: zod_1.z.string(),
});
exports.PosShift = zod_1.z.object({
    id: primitives_1.Uuid,
    registerId: primitives_1.Uuid,
    registerName: zod_1.z.string(),
    cashierUserId: primitives_1.Uuid,
    cashierName: zod_1.z.string().nullable(),
    status: exports.ShiftStatus,
    openingFloatRwf: zod_1.z.number().int(),
    openedAt: zod_1.z.string(),
    closedAt: zod_1.z.string().nullable(),
    cashSalesRwf: zod_1.z.number().int(),
    cashRefundsRwf: zod_1.z.number().int(),
    paidInRwf: zod_1.z.number().int(),
    paidOutRwf: zod_1.z.number().int(),
    /** Computed now for an open shift, frozen at close. */
    expectedCashRwf: zod_1.z.number().int(),
    countedCashRwf: zod_1.z.number().int().nullable(),
    varianceRwf: zod_1.z.number().int().nullable(),
    takingsByMethod: zod_1.z.array(zod_1.z.object({ method: exports.PosPaymentMethod, amountRwf: zod_1.z.number().int(), count: zod_1.z.number().int() })),
    tipsRwf: zod_1.z.number().int(),
    closeNote: zod_1.z.string().nullable(),
    handoverNote: zod_1.z.string().nullable(),
    reviewedByName: zod_1.z.string().nullable(),
    reviewNote: zod_1.z.string().nullable(),
    movements: zod_1.z.array(exports.PosCashMovement),
});
exports.PosAuditEvent = zod_1.z.object({
    id: primitives_1.Uuid,
    occurredAt: zod_1.z.string(),
    actorName: zod_1.z.string().nullable(),
    outletId: primitives_1.Uuid.nullable(),
    action: zod_1.z.string(),
    entityType: zod_1.z.string(),
    entityId: primitives_1.Uuid.nullable(),
    before: zod_1.z.unknown().nullable(),
    after: zod_1.z.unknown().nullable(),
    reason: zod_1.z.string().nullable(),
});
// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------
const reason = zod_1.z.string().trim().min(3, "Say why, in a few words.").max(500);
const note = zod_1.z.string().trim().max(500);
exports.OpenTableSessionRequest = zod_1.z.object({
    guestCount: zod_1.z.number().int().min(1).max(200),
    /** Defaults to the person opening it. */
    waiterUserId: primitives_1.Uuid.optional(),
});
exports.SetTableStatusRequest = zod_1.z.object({ status: exports.TableStatus });
exports.MoveSessionRequest = zod_1.z.object({ toTableId: primitives_1.Uuid });
exports.MergeSessionsRequest = zod_1.z.object({ fromSessionId: primitives_1.Uuid });
exports.PosLineRequest = zod_1.z.object({
    serviceItemId: primitives_1.Uuid,
    quantity: zod_1.z.number().int().min(1).max(500),
    selectedOptions: zod_1.z.array(ops_1.SelectedOption).max(20).optional(),
    note: note.optional(),
});
exports.CreatePosOrderRequest = zod_1.z
    .object({
    outletId: primitives_1.Uuid,
    orderType: exports.PosOrderType,
    tableSessionId: primitives_1.Uuid.optional(),
    guestNote: note.optional(),
    lines: zod_1.z.array(exports.PosLineRequest).max(100).default([]),
})
    .superRefine((v, ctx) => {
    if (v.orderType === "dine_in" && !v.tableSessionId) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["tableSessionId"], message: "A dine in order is opened at a table." });
    }
    if (v.orderType !== "dine_in" && v.tableSessionId) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["tableSessionId"], message: "Only a dine in order sits at a table." });
    }
});
exports.AddPosLinesRequest = zod_1.z.object({ lines: zod_1.z.array(exports.PosLineRequest).min(1).max(100) });
/** Only a draft line can be changed; a sent one is voided and re-added. */
exports.UpdatePosLineRequest = zod_1.z.object({
    quantity: zod_1.z.number().int().min(1).max(500).optional(),
    note: note.nullable().optional(),
});
exports.VoidPosLineRequest = zod_1.z.object({ reason });
exports.CancelPosOrderRequest = zod_1.z.object({ reason });
exports.ApplyPosDiscountRequest = zod_1.z
    .object({
    /** A line, or the whole order when absent. */
    orderItemId: primitives_1.Uuid.optional(),
    kind: zod_1.z.enum(["amount", "percent"]),
    /** RWF for `amount`, basis points for `percent` (1000 is 10%). */
    value: zod_1.z.number().int().min(1),
    reason,
})
    .superRefine((v, ctx) => {
    if (v.kind === "percent" && v.value > 10000) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["value"], message: "A percentage runs to 100%." });
    }
});
exports.DecidePosDiscountRequest = zod_1.z.object({ approve: zod_1.z.boolean(), note: note.optional() });
exports.TransferPosOrderRequest = zod_1.z.object({ toTableSessionId: primitives_1.Uuid, reason });
/** Move whole lines to a new order on the same session: the split bill. */
exports.SplitPosOrderRequest = zod_1.z.object({ orderItemIds: zod_1.z.array(primitives_1.Uuid).min(1).max(100) });
exports.TakePosPaymentRequest = zod_1.z.object({
    method: exports.PosPaymentMethod,
    amountRwf: zod_1.z.number().int().min(1),
    /** Cash handed over, when more than the amount. */
    tenderedRwf: zod_1.z.number().int().min(1).optional(),
    tipRwf: zod_1.z.number().int().min(0).default(0),
    /** What the demo provider answers. Ignored for cash and vouchers, which settle at once. */
    simulate: exports.SimulatedOutcome.default("success"),
    /** A fictional payer number for the simulated mobile money prompt. */
    payerPhone: zod_1.z.string().trim().regex(/^\+?\d{9,15}$/, "A phone number, digits only.").optional(),
    voucherCode: zod_1.z.string().trim().min(3).max(40).optional(),
    /** One per press of "Take payment": a retried request returns the first payment. */
    idempotencyKey: zod_1.z.string().trim().min(8).max(100),
});
/** The simulated provider callback for a pending payment. */
exports.ResolvePosPaymentRequest = zod_1.z.object({ outcome: zod_1.z.enum(["success", "failure", "timeout"]) });
exports.RefundPosPaymentRequest = zod_1.z.object({
    amountRwf: zod_1.z.number().int().min(1),
    reason,
    idempotencyKey: zod_1.z.string().trim().min(8).max(100),
});
exports.AdvancePosTicketRequest = zod_1.z.object({ to: exports.TicketStatus });
exports.OpenShiftRequest = zod_1.z.object({
    registerId: primitives_1.Uuid,
    openingFloatRwf: zod_1.z.number().int().min(0).max(50000000),
});
exports.CloseShiftRequest = zod_1.z.object({
    countedCashRwf: zod_1.z.number().int().min(0).max(500000000),
    closeNote: note.optional(),
    handoverNote: note.optional(),
});
exports.CashMovementRequest = zod_1.z.object({
    kind: exports.CashMovementKind,
    amountRwf: zod_1.z.number().int().min(1).max(50000000),
    reason,
});
exports.DecideCashMovementRequest = zod_1.z.object({ approve: zod_1.z.boolean() });
exports.ReviewShiftRequest = zod_1.z.object({ note: note.optional() });
exports.PosListQuery = zod_1.z.object({
    outletId: primitives_1.Uuid.optional(),
    status: zod_1.z.string().trim().max(40).optional(),
    from: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    limit: zod_1.z.coerce.number().int().min(1).max(200).default(50),
});
// ---------------------------------------------------------------------------
// Venue setup: the dining areas, tables, stations, registers and item routing
// an owner configures. Nothing here is money. Names are unique per outlet, and
// a table, station or register that is in use is never deleted: it is archived
// once nothing depends on it (the API refuses, with the reason, until then).
// ---------------------------------------------------------------------------
const venueName = zod_1.z.string().trim().min(1, "Give it a name.").max(60, "Keep the name to 60 characters.");
const venueSort = zod_1.z.number().int().min(0).max(9999);
exports.PosVenueArea = zod_1.z.object({
    id: primitives_1.Uuid,
    name: zod_1.z.string(),
    sortOrder: zod_1.z.number().int(),
    /** Tables in this area that are not archived. */
    tableCount: zod_1.z.number().int(),
});
exports.PosVenueTable = zod_1.z.object({
    id: primitives_1.Uuid,
    areaId: primitives_1.Uuid,
    label: zod_1.z.string(),
    seats: zod_1.z.number().int(),
    status: exports.TableStatus,
    sortOrder: zod_1.z.number().int(),
    /** A party is seated here now, so the table cannot be archived. */
    hasOpenSession: zod_1.z.boolean(),
});
exports.PosVenueStation = zod_1.z.object({
    id: primitives_1.Uuid,
    name: zod_1.z.string(),
    kind: exports.PrepStationKind,
    printerName: zod_1.z.string().nullable(),
    sortOrder: zod_1.z.number().int(),
    /** Menu items whose tickets go to this station. */
    routedItems: zod_1.z.number().int(),
    /** Tickets still queued, being prepared or ready. */
    openTickets: zod_1.z.number().int(),
});
exports.PosVenueRegister = zod_1.z.object({
    id: primitives_1.Uuid,
    name: zod_1.z.string(),
    deviceLabel: zod_1.z.string().nullable(),
    /** A cashier has a shift open on it now, so it cannot be archived. */
    hasOpenShift: zod_1.z.boolean(),
});
exports.PosVenueRoute = zod_1.z.object({
    serviceItemId: primitives_1.Uuid,
    name: zod_1.z.string(),
    categoryName: zod_1.z.string().nullable(),
    /** The station that prepares it, or null when it sends no ticket (a bottle handed over the counter). */
    stationId: primitives_1.Uuid.nullable(),
});
exports.PosVenue = zod_1.z.object({
    outletId: primitives_1.Uuid,
    areas: zod_1.z.array(exports.PosVenueArea),
    tables: zod_1.z.array(exports.PosVenueTable),
    stations: zod_1.z.array(exports.PosVenueStation),
    registers: zod_1.z.array(exports.PosVenueRegister),
    routing: zod_1.z.array(exports.PosVenueRoute),
});
exports.CreateAreaRequest = zod_1.z.object({ name: venueName, sortOrder: venueSort.optional() });
exports.UpdateAreaRequest = exports.CreateAreaRequest.partial().refine((v) => Object.keys(v).length > 0, { message: "Say what to change." });
exports.CreateTableRequest = zod_1.z.object({
    areaId: primitives_1.Uuid,
    label: zod_1.z.string().trim().min(1, "Give the table a label.").max(30, "Keep the label to 30 characters."),
    seats: zod_1.z.number().int().min(1, "A table seats at least 1.").max(100, "A table seats at most 100."),
    sortOrder: venueSort.optional(),
});
exports.UpdateTableRequest = exports.CreateTableRequest.partial().refine((v) => Object.keys(v).length > 0, { message: "Say what to change." });
exports.CreateStationRequest = zod_1.z.object({
    name: venueName,
    kind: exports.PrepStationKind,
    /** The name a SIMULATED print job is addressed to. No device is contacted. */
    printerName: zod_1.z.string().trim().max(60).nullable().optional(),
    sortOrder: venueSort.optional(),
});
exports.UpdateStationRequest = exports.CreateStationRequest.partial().refine((v) => Object.keys(v).length > 0, { message: "Say what to change." });
exports.CreateRegisterRequest = zod_1.z.object({
    name: venueName,
    deviceLabel: zod_1.z.string().trim().max(60).nullable().optional(),
});
exports.UpdateRegisterRequest = exports.CreateRegisterRequest.partial().refine((v) => Object.keys(v).length > 0, { message: "Say what to change." });
exports.SetItemRouteRequest = zod_1.z.object({
    serviceItemId: primitives_1.Uuid,
    /** null clears the route: the item then sends no ticket. */
    stationId: primitives_1.Uuid.nullable(),
});
// ---------------------------------------------------------------------------
// Setup progress: what an owner has configured so far, computed from the
// records themselves. Never stored, so it cannot drift from the truth, and
// never a gate: every screen stays open whatever is left.
// ---------------------------------------------------------------------------
exports.POS_SETUP_STEPS = [
    "areas",
    "tables",
    "stations",
    "registers",
    "categories",
    "products",
    "routing",
    "receipts",
    "team",
];
exports.PosSetupStepKey = zod_1.z.enum(exports.POS_SETUP_STEPS);
exports.PosSetupStep = zod_1.z.object({
    key: exports.PosSetupStepKey,
    done: zod_1.z.boolean(),
    /** How many of the thing exist (areas, tables, products...). */
    count: zod_1.z.number().int(),
});
exports.PosSetup = zod_1.z.object({
    outletId: primitives_1.Uuid,
    steps: zod_1.z.array(exports.PosSetupStep),
    doneCount: zod_1.z.number().int(),
    total: zod_1.z.number().int(),
});
//# sourceMappingURL=pos.js.map