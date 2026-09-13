import { z } from "zod";
import { MobileMoneyNetwork, PaymentAttemptState, PaymentInstrument } from "./booking";
import {
    OrderContext,
    SelectedOption,
    SelectedOptionSnapshot,
    ServiceItemOptions,
    ServiceOrderStatus,
} from "./ops";
import { Uuid } from "./primitives";
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
export const OrderingAccess = z.enum(["in_house_only", "walk_in_only", "both"]);
export type OrderingAccess = z.infer<typeof OrderingAccess>;
export const OutletKind = z.enum([
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
export type OutletKind = z.infer<typeof OutletKind>;
/**
 * One thing a guest may order right now. Stock COUNTS are never sent: an item
 * that is out simply is not listed, and a count tells a competitor how much a
 * kitchen sells. An item without its RRA codes is not listed either (D-m).
 */
export const OrderableItem = z.object({
    id: Uuid,
    name: z.string(),
    description: z.string().nullable(),
    /** Tax exclusive, as on the menu. The order adds tax at the effective rate. */
    priceRwf: z.number().int(),
    prepTimeMinutes: z.number().int().nullable(),
    /** The modifiers a guest may pick, each with its price delta. */
    options: ServiceItemOptions,
});
export type OrderableItem = z.infer<typeof OrderableItem>;
export const OrderableCategory = z.object({
    id: Uuid,
    name: z.string(),
    items: z.array(OrderableItem),
});
export type OrderableCategory = z.infer<typeof OrderableCategory>;
/** Service windows as `outlets.hours` stores them, e.g. `{"mon": ["07:00", "22:00"]}`. Null means always open. */
export const OutletHours = z.record(z.string(), z.unknown()).nullable();
export type OutletHours = z.infer<typeof OutletHours>;
export const OrderableOutlet = z.object({
    id: Uuid,
    name: z.string(),
    outletKind: OutletKind,
    propertyId: Uuid,
    propertyName: z.string(),
    orderingAccess: OrderingAccess,
    hours: OutletHours,
    /**
     * The caller is in house at this outlet's property, the outlet serves in
     * house guests, and their bill is still open.
     */
    chargeToRoom: z.boolean(),
    /** The outlet takes walk in orders, so the caller may pay now. */
    payNow: z.boolean(),
    /** How far away, when the caller gave coordinates. Null otherwise. */
    distanceKm: z.number().nullable(),
    /** A quiet operator label, set only when someone other than the hotel runs it. Null until slice 4. */
    operatorLabel: z.string().nullable(),
    categories: z.array(OrderableCategory),
});
export type OrderableOutlet = z.infer<typeof OrderableOutlet>;
export const OrderableList = z.object({ outlets: z.array(OrderableOutlet) });
export type OrderableList = z.infer<typeof OrderableList>;
/**
 * Where to look (D-o).
 *
 * With `lat` and `lng`, walk in outlets within 5 km are added, nearest first.
 * Without them the answer is only what the caller is in house at, plus the
 * property named, because a list of every outlet in Rwanda is not an answer.
 */
export const OrderableQuery = z
    .object({
    propertyId: Uuid.optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
})
    .refine((v) => (v.lat === undefined) === (v.lng === undefined), {
    message: "Send both lat and lng, or neither.",
});
export type OrderableQuery = z.infer<typeof OrderableQuery>;
export const PlaceOrderRequest = z
    .object({
    outletId: Uuid,
    /**
     * `in_house_folio` posts to the guest's bill when delivered. `pay_now`
     * settles before the kitchen sees it and never touches a bill.
     */
    context: OrderContext.default("in_house_folio"),
    items: z
        .array(z.object({
        serviceItemId: Uuid,
        quantity: z.number().int().min(1).max(50),
        note: z.string().trim().max(300).optional(),
        selectedOptions: z.array(SelectedOption).max(20).optional(),
    }))
        .min(1, "Pick at least one thing.")
        .max(30),
    guestNote: z.string().trim().max(500).optional(),
    requestedForAt: z.string().datetime({ offset: true }).optional(),
    /**
     * Pay now only. Mobile money prompts the handset and the answer is polled
     * like a booking's; left out, the order waits for cash at the counter.
     * Card is refused until a hosted field exists (D-p).
     */
    instrument: PaymentInstrument.optional(),
})
    .refine((v) => v.context === "pay_now" || v.instrument === undefined, {
    message: "An order charged to your room takes no payment.",
    path: ["instrument"],
});
export type PlaceOrderRequest = z.infer<typeof PlaceOrderRequest>;
export const GuestOrderLine = z.object({
    name: z.string(),
    quantity: z.number().int(),
    unitPriceRwf: z.number().int(),
    lineTotalRwf: z.number().int(),
    selectedOptions: z.array(SelectedOptionSnapshot),
});
export type GuestOrderLine = z.infer<typeof GuestOrderLine>;
/**
 * A placed order, as its guest reads it. Prices are the snapshots locked when
 * it was placed, so editing the menu never changes it (AC-23).
 */
export const GuestOrder = z.object({
    id: Uuid,
    orderNumber: z.string(),
    status: ServiceOrderStatus,
    outletId: Uuid,
    outletName: z.string(),
    propertyName: z.string(),
    context: OrderContext,
    lines: z.array(GuestOrderLine),
    subtotalRwf: z.number().int(),
    taxRwf: z.number().int(),
    totalRwf: z.number().int(),
    /** Pay now only: when the money settled, and the RRA means of payment (`01` cash, `06` mobile money). */
    paidAt: z.string().nullable(),
    paymentMethod: z.string().nullable(),
    /**
     * Whether the guest may still cancel it themselves. A paid order never,
     * because cancelling it is a refund, and that is staff only (D-n).
     */
    cancellable: z.boolean(),
    createdAt: z.string(),
});
export type GuestOrder = z.infer<typeof GuestOrder>;
/**
 * Where a pay now order's mobile money prompt got to. The booking poll's shape,
 * with the order in place of the booking (ADR-047 D-j).
 */
export const OrderPaymentAttemptStatus = z.object({
    attemptToken: z.string(),
    state: PaymentAttemptState,
    network: MobileMoneyNetwork.nullable(),
    payerMasked: z.string().nullable(),
    amountRwf: z.number().int().nullable(),
    expiresAt: z.string(),
    /** The order as it stands now: `submitted` once the money settled. */
    order: GuestOrder,
    failureReason: z.string().nullable(),
});
export type OrderPaymentAttemptStatus = z.infer<typeof OrderPaymentAttemptStatus>;
/**
 * What `POST /me/orders` answers: the order, and for a pay now order on mobile
 * money the attempt to wait on. `attempt` is null for every other order,
 * including one waiting for cash.
 */
export const PlaceOrderResult = GuestOrder.extend({
    attempt: OrderPaymentAttemptStatus.omit({ order: true }).nullable(),
});
export type PlaceOrderResult = z.infer<typeof PlaceOrderResult>;
export const GuestOrderList = z.object({ orders: z.array(GuestOrder) });
export type GuestOrderList = z.infer<typeof GuestOrderList>;
export const GuestOrderEvent = z.object({
    status: ServiceOrderStatus,
    occurredAt: z.string(),
});
export type GuestOrderEvent = z.infer<typeof GuestOrderEvent>;
/** One order with its trail, as `GET /me/orders/:id` answers it. */
export const GuestOrderDetail = GuestOrder.extend({
    events: z.array(GuestOrderEvent),
});
export type GuestOrderDetail = z.infer<typeof GuestOrderDetail>;
