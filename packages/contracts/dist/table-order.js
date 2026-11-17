"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TableOrderStatus = exports.PlaceTableOrderRequest = exports.TableOrderLine = exports.TableOrderMenu = exports.TableOrderMenuItem = exports.TableQrCode = void 0;
const zod_1 = require("zod");
const ops_1 = require("./ops");
const primitives_1 = require("./primitives");
/**
 * Table QR self-service ordering (migration 0156).
 *
 * The QR on a table holds one permanent, unguessable code. A guest's phone opens `/t/<code>`, reads that table's menu
 * (`TableOrderMenu`: only what can be sold now, with photos and prices) and sends its cart
 * (`PlaceTableOrderRequest`). The order lands on that table, goes to its kitchen and bar stations at once and shows
 * on the till and the floor as a guest order; the staff do the rest (the bill, payment, releasing the table).
 *
 * Nothing the phone sends names a table, an outlet or a price: the code names the table, and the server prices every
 * line from the menu as it is. `clientKey` is made once per cart by the phone: sending the same cart twice answers
 * with the first order, and it is the guest's only handle to read that order's progress back.
 */
/** A table's code, for its QR card (staff). */
exports.TableQrCode = zod_1.z.object({ tableId: primitives_1.Uuid, code: zod_1.z.string() });
exports.TableOrderMenuItem = zod_1.z.object({
    id: primitives_1.Uuid,
    categoryId: primitives_1.Uuid,
    name: zod_1.z.string(),
    description: zod_1.z.string().nullable(),
    /** As the menu prices it: tax exclusive or inclusive by the outlet's `taxMode`. */
    priceRwf: zod_1.z.number().int(),
    taxRateBps: zod_1.z.number().int(),
    options: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        required: zod_1.z.boolean(),
        maxChoices: zod_1.z.number().int(),
        choices: zod_1.z.array(zod_1.z.object({ label: zod_1.z.string(), priceDeltaRwf: zod_1.z.number().int() })),
    })),
    /** A library photo id (`beer`), `upload:<itemId>.<version>` for an uploaded one, or null (the app suggests one). */
    photo: zod_1.z.string().nullable(),
    /** How many are left when only a few are, else null. */
    left: zod_1.z.number().int().nullable(),
});
exports.TableOrderMenu = zod_1.z.object({
    outletName: zod_1.z.string(),
    tableLabel: zod_1.z.string(),
    areaName: zod_1.z.string(),
    taxMode: zod_1.z.enum(["exclusive", "inclusive"]),
    currency: zod_1.z.literal("RWF"),
    /** False while the table is being cleaned: the menu shows, ordering waits for the staff. */
    acceptingOrders: zod_1.z.boolean(),
    notice: zod_1.z.string().nullable(),
    categories: zod_1.z.array(zod_1.z.object({ id: primitives_1.Uuid, name: zod_1.z.string() })),
    items: zod_1.z.array(exports.TableOrderMenuItem),
});
exports.TableOrderLine = zod_1.z.object({
    serviceItemId: primitives_1.Uuid,
    quantity: zod_1.z.number().int().min(1).max(30),
    selectedOptions: zod_1.z.array(ops_1.SelectedOption).max(20).optional(),
    note: zod_1.z.string().trim().max(200).optional(),
});
exports.PlaceTableOrderRequest = zod_1.z.object({
    /** Made once per cart by the phone (a random uuid). */
    clientKey: zod_1.z.string().regex(/^[A-Za-z0-9-]{16,64}$/, "A client key is 16 to 64 letters, digits or dashes."),
    lines: zod_1.z.array(exports.TableOrderLine).min(1, "Add something to your order first.").max(40),
    guestNote: zod_1.z.string().trim().max(200).optional(),
    /** How many are at the table, when the order seats it. */
    guestCount: zod_1.z.number().int().min(1).max(50).optional(),
});
/** The guest's own order, read back by their phone: what was sent, the bill so far for it, and how far it has got. */
exports.TableOrderStatus = zod_1.z.object({
    orderNumber: zod_1.z.string(),
    tableLabel: zod_1.z.string(),
    stage: zod_1.z.enum(["received", "preparing", "ready", "served", "cancelled"]),
    taxMode: zod_1.z.enum(["exclusive", "inclusive"]),
    taxRwf: zod_1.z.number().int(),
    totalRwf: zod_1.z.number().int(),
    placedAt: zod_1.z.string(),
    lines: zod_1.z.array(zod_1.z.object({ name: zod_1.z.string(), quantity: zod_1.z.number().int(), totalRwf: zod_1.z.number().int() })),
});
//# sourceMappingURL=table-order.js.map