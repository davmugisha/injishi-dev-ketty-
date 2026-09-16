"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GuestOrderDetail = exports.GuestOrderEvent = exports.GuestOrderList = exports.PlaceOrderResult = exports.OrderPaymentAttemptStatus = exports.GuestOrder = exports.GuestOrderLine = exports.PlaceOrderRequest = exports.OrderableQuery = exports.OrderableList = exports.OrderableOutlet = exports.OutletHours = exports.OrderableCategory = exports.OrderableItem = exports.OutletKind = exports.OrderingAccess = void 0;
const zod_1 = require("zod");
const booking_1 = require("./booking");
const ops_1 = require("./ops");
const primitives_1 = require("./primitives");
/**
 * GUEST ORDERING (ADR-050 D-n, D-o).
 *
 * One order surface for a guest, filtered on the SERVER from who they are and
 * where they are. The ordering policy is the host's control, not a presentation
 * choice, and a control that lives in the client is not a control.
 *
 * An IN HOUSE guest charges an order to their room. A walk in (signed in, with
 * no stay there) pays now: by mobile money, which waits on their handset like a
 * booking does, or in cash at the counter, which staff mark paid.
 */
/** Who may order from an outlet. Enforced in the order service before any write (AC-19). */
exports.OrderingAccess = zod_1.z.enum(["in_house_only", "walk_in_only", "both"]);
exports.OutletKind = zod_1.z.enum([
    "restaurant",
    "bar",
    "lounge",
    "banquet",
    "room_service",
    "spa",
    "gym",
    "pool",
    "gift_shop",
    "parking",
    "laundry",
    "business_center",
    "other",
]);
/**
 * One thing a guest may order right now. Stock COUNTS are never sent: an item
 * that is out simply is not listed, and a count tells a competitor how much a
 * kitchen sells. An item without its RRA codes is not listed either (D-m).
 */
exports.OrderableItem = zod_1.z.object({
    id: primitives_1.Uuid,
    name: zod_1.z.string(),
    description: zod_1.z.string().nullable(),
    /** Tax exclusive, as on the menu. The order adds tax at the effective rate. */
    priceRwf: zod_1.z.number().int(),
    prepTimeMinutes: zod_1.z.number().int().nullable(),
    /** The modifiers a guest may pick, each with its price delta. */
    options: ops_1.ServiceItemOptions,
});
exports.OrderableCategory = zod_1.z.object({
    id: primitives_1.Uuid,
    name: zod_1.z.string(),
    items: zod_1.z.array(exports.OrderableItem),
});
/** Service windows as `outlets.hours` stores them, e.g. `{"mon": ["07:00", "22:00"]}`. Null means always open. */
exports.OutletHours = zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).nullable();
exports.OrderableOutlet = zod_1.z.object({
    id: primitives_1.Uuid,
    name: zod_1.z.string(),
    outletKind: exports.OutletKind,
    propertyId: primitives_1.Uuid,
    propertyName: zod_1.z.string(),
    orderingAccess: exports.OrderingAccess,
    hours: exports.OutletHours,
    /**
     * The caller is in house at this outlet's property, the outlet serves in
     * house guests, and their bill is still open.
     */
    chargeToRoom: zod_1.z.boolean(),
    /** The outlet takes walk in orders, so the caller may pay now. */
    payNow: zod_1.z.boolean(),
    /** How far away, when the caller gave coordinates. Null otherwise. */
    distanceKm: zod_1.z.number().nullable(),
    /** A quiet operator label, set only when someone other than the hotel runs it. Null until slice 4. */
    operatorLabel: zod_1.z.string().nullable(),
    categories: zod_1.z.array(exports.OrderableCategory),
});
exports.OrderableList = zod_1.z.object({ outlets: zod_1.z.array(exports.OrderableOutlet) });
/**
 * Where to look (D-o).
 *
 * With `lat` and `lng`, walk in outlets within 5 km are added, nearest first.
 * Without them the answer is only what the caller is in house at, plus the
 * property named, because a list of every outlet in Rwanda is not an answer.
 */
exports.OrderableQuery = zod_1.z
    .object({
    propertyId: primitives_1.Uuid.optional(),
    lat: zod_1.z.coerce.number().min(-90).max(90).optional(),
    lng: zod_1.z.coerce.number().min(-180).max(180).optional(),
})
    .refine((v) => (v.lat === undefined) === (v.lng === undefined), {
    message: "Send both lat and lng, or neither.",
});
exports.PlaceOrderRequest = zod_1.z
    .object({
    outletId: primitives_1.Uuid,
    /**
     * `in_house_folio` posts to the guest's bill when delivered. `pay_now`
     * settles before the kitchen sees it and never touches a bill.
     */
    context: ops_1.OrderContext.default("in_house_folio"),
    items: zod_1.z
        .array(zod_1.z.object({
        serviceItemId: primitives_1.Uuid,
        quantity: zod_1.z.number().int().min(1).max(50),
        note: zod_1.z.string().trim().max(300).optional(),
        selectedOptions: zod_1.z.array(ops_1.SelectedOption).max(20).optional(),
    }))
        .min(1, "Pick at least one thing.")
        .max(30),
    guestNote: zod_1.z.string().trim().max(500).optional(),
    requestedForAt: zod_1.z.string().datetime({ offset: true }).optional(),
    /**
     * Pay now only. Mobile money prompts the handset and the answer is polled
     * like a booking's; left out, the order waits for cash at the counter.
     * Card is refused until a hosted field exists (D-p).
     */
    instrument: booking_1.PaymentInstrument.optional(),
    /**
     * The conversation this order is placed from (ADR-050 D-s). The order stays
     * one record; the thread gets a card and a line for every status change.
     * It must be the caller's own active thread at the outlet's property.
     */
    threadId: primitives_1.Uuid.optional(),
})
    .refine((v) => v.context === "pay_now" || v.instrument === undefined, {
    message: "An order charged to your room takes no payment.",
    path: ["instrument"],
});
exports.GuestOrderLine = zod_1.z.object({
    name: zod_1.z.string(),
    quantity: zod_1.z.number().int(),
    unitPriceRwf: zod_1.z.number().int(),
    lineTotalRwf: zod_1.z.number().int(),
    selectedOptions: zod_1.z.array(ops_1.SelectedOptionSnapshot),
});
/**
 * A placed order, as its guest reads it. Prices are the snapshots locked when
 * it was placed, so editing the menu never changes it (AC-23).
 */
exports.GuestOrder = zod_1.z.object({
    id: primitives_1.Uuid,
    orderNumber: zod_1.z.string(),
    status: ops_1.ServiceOrderStatus,
    outletId: primitives_1.Uuid,
    outletName: zod_1.z.string(),
    propertyName: zod_1.z.string(),
    context: ops_1.OrderContext,
    lines: zod_1.z.array(exports.GuestOrderLine),
    subtotalRwf: zod_1.z.number().int(),
    taxRwf: zod_1.z.number().int(),
    totalRwf: zod_1.z.number().int(),
    /** Pay now only: when the money settled, and the RRA means of payment (`01` cash, `06` mobile money). */
    paidAt: zod_1.z.string().nullable(),
    paymentMethod: zod_1.z.string().nullable(),
    /**
     * Whether the guest may still cancel it themselves. A paid order never,
     * because cancelling it is a refund, and that is staff only (D-n).
     */
    cancellable: zod_1.z.boolean(),
    createdAt: zod_1.z.string(),
});
/**
 * Where a pay now order's mobile money prompt got to. The booking poll's shape,
 * with the order in place of the booking (ADR-047 D-j).
 */
exports.OrderPaymentAttemptStatus = zod_1.z.object({
    attemptToken: zod_1.z.string(),
    state: booking_1.PaymentAttemptState,
    network: booking_1.MobileMoneyNetwork.nullable(),
    payerMasked: zod_1.z.string().nullable(),
    amountRwf: zod_1.z.number().int().nullable(),
    expiresAt: zod_1.z.string(),
    /** The order as it stands now: `submitted` once the money settled. */
    order: exports.GuestOrder,
    failureReason: zod_1.z.string().nullable(),
});
/**
 * What `POST /me/orders` answers: the order, and for a pay now order on mobile
 * money the attempt to wait on. `attempt` is null for every other order,
 * including one waiting for cash.
 */
exports.PlaceOrderResult = exports.GuestOrder.extend({
    attempt: exports.OrderPaymentAttemptStatus.omit({ order: true }).nullable(),
});
exports.GuestOrderList = zod_1.z.object({ orders: zod_1.z.array(exports.GuestOrder) });
exports.GuestOrderEvent = zod_1.z.object({
    status: ops_1.ServiceOrderStatus,
    occurredAt: zod_1.z.string(),
});
/** One order with its trail, as `GET /me/orders/:id` answers it. */
exports.GuestOrderDetail = exports.GuestOrder.extend({
    events: zod_1.z.array(exports.GuestOrderEvent),
});
//# sourceMappingURL=ordering.js.map