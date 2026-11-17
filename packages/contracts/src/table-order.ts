import { z } from "zod";
import { SelectedOption } from "./ops";
import { Uuid } from "./primitives";
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
export const TableQrCode = z.object({ tableId: Uuid, code: z.string() });
export type TableQrCode = z.infer<typeof TableQrCode>;
export const TableOrderMenuItem = z.object({
    id: Uuid,
    categoryId: Uuid,
    name: z.string(),
    description: z.string().nullable(),
    /** As the menu prices it: tax exclusive or inclusive by the outlet's `taxMode`. */
    priceRwf: z.number().int(),
    taxRateBps: z.number().int(),
    options: z.array(z.object({
        name: z.string(),
        required: z.boolean(),
        maxChoices: z.number().int(),
        choices: z.array(z.object({ label: z.string(), priceDeltaRwf: z.number().int() })),
    })),
    /** A library photo id (`beer`), `upload:<itemId>.<version>` for an uploaded one, or null (the app suggests one). */
    photo: z.string().nullable(),
    /** How many are left when only a few are, else null. */
    left: z.number().int().nullable(),
});
export type TableOrderMenuItem = z.infer<typeof TableOrderMenuItem>;
export const TableOrderMenu = z.object({
    outletName: z.string(),
    tableLabel: z.string(),
    areaName: z.string(),
    taxMode: z.enum(["exclusive", "inclusive"]),
    currency: z.literal("RWF"),
    /** False while the table is being cleaned: the menu shows, ordering waits for the staff. */
    acceptingOrders: z.boolean(),
    notice: z.string().nullable(),
    categories: z.array(z.object({ id: Uuid, name: z.string() })),
    items: z.array(TableOrderMenuItem),
});
export type TableOrderMenu = z.infer<typeof TableOrderMenu>;
export const TableOrderLine = z.object({
    serviceItemId: Uuid,
    quantity: z.number().int().min(1).max(30),
    selectedOptions: z.array(SelectedOption).max(20).optional(),
    note: z.string().trim().max(200).optional(),
});
export type TableOrderLine = z.infer<typeof TableOrderLine>;
export const PlaceTableOrderRequest = z.object({
    /** Made once per cart by the phone (a random uuid). */
    clientKey: z.string().regex(/^[A-Za-z0-9-]{16,64}$/, "A client key is 16 to 64 letters, digits or dashes."),
    lines: z.array(TableOrderLine).min(1, "Add something to your order first.").max(40),
    guestNote: z.string().trim().max(200).optional(),
    /** How many are at the table, when the order seats it. */
    guestCount: z.number().int().min(1).max(50).optional(),
});
export type PlaceTableOrderRequest = z.infer<typeof PlaceTableOrderRequest>;
/** The guest's own order, read back by their phone: what was sent, the bill so far for it, and how far it has got. */
export const TableOrderStatus = z.object({
    orderNumber: z.string(),
    tableLabel: z.string(),
    stage: z.enum(["received", "preparing", "ready", "served", "cancelled"]),
    taxMode: z.enum(["exclusive", "inclusive"]),
    taxRwf: z.number().int(),
    totalRwf: z.number().int(),
    placedAt: z.string(),
    lines: z.array(z.object({ name: z.string(), quantity: z.number().int(), totalRwf: z.number().int() })),
});
export type TableOrderStatus = z.infer<typeof TableOrderStatus>;
