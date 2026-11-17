import { z } from "zod";
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
export declare const TableQrCode: z.ZodObject<{
    tableId: z.ZodString;
    code: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
    tableId: string;
}, {
    code: string;
    tableId: string;
}>;
export type TableQrCode = z.infer<typeof TableQrCode>;
export declare const TableOrderMenuItem: z.ZodObject<{
    id: z.ZodString;
    categoryId: z.ZodString;
    name: z.ZodString;
    description: z.ZodNullable<z.ZodString>;
    /** As the menu prices it: tax exclusive or inclusive by the outlet's `taxMode`. */
    priceRwf: z.ZodNumber;
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
    /** A library photo id (`beer`), `upload:<itemId>.<version>` for an uploaded one, or null (the app suggests one). */
    photo: z.ZodNullable<z.ZodString>;
    /** How many are left when only a few are, else null. */
    left: z.ZodNullable<z.ZodNumber>;
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
    photo: string | null;
    description: string | null;
    priceRwf: number;
    left: number | null;
    categoryId: string;
    taxRateBps: number;
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
    photo: string | null;
    description: string | null;
    priceRwf: number;
    left: number | null;
    categoryId: string;
    taxRateBps: number;
}>;
export type TableOrderMenuItem = z.infer<typeof TableOrderMenuItem>;
export declare const TableOrderMenu: z.ZodObject<{
    outletName: z.ZodString;
    tableLabel: z.ZodString;
    areaName: z.ZodString;
    taxMode: z.ZodEnum<["exclusive", "inclusive"]>;
    currency: z.ZodLiteral<"RWF">;
    /** False while the table is being cleaned: the menu shows, ordering waits for the staff. */
    acceptingOrders: z.ZodBoolean;
    notice: z.ZodNullable<z.ZodString>;
    categories: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
    }, {
        name: string;
        id: string;
    }>, "many">;
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        categoryId: z.ZodString;
        name: z.ZodString;
        description: z.ZodNullable<z.ZodString>;
        /** As the menu prices it: tax exclusive or inclusive by the outlet's `taxMode`. */
        priceRwf: z.ZodNumber;
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
        /** A library photo id (`beer`), `upload:<itemId>.<version>` for an uploaded one, or null (the app suggests one). */
        photo: z.ZodNullable<z.ZodString>;
        /** How many are left when only a few are, else null. */
        left: z.ZodNullable<z.ZodNumber>;
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
        photo: string | null;
        description: string | null;
        priceRwf: number;
        left: number | null;
        categoryId: string;
        taxRateBps: number;
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
        photo: string | null;
        description: string | null;
        priceRwf: number;
        left: number | null;
        categoryId: string;
        taxRateBps: number;
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
        photo: string | null;
        description: string | null;
        priceRwf: number;
        left: number | null;
        categoryId: string;
        taxRateBps: number;
    }[];
    currency: "RWF";
    categories: {
        name: string;
        id: string;
    }[];
    taxMode: "inclusive" | "exclusive";
    tableLabel: string;
    areaName: string;
    outletName: string;
    notice: string | null;
    acceptingOrders: boolean;
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
        photo: string | null;
        description: string | null;
        priceRwf: number;
        left: number | null;
        categoryId: string;
        taxRateBps: number;
    }[];
    currency: "RWF";
    categories: {
        name: string;
        id: string;
    }[];
    taxMode: "inclusive" | "exclusive";
    tableLabel: string;
    areaName: string;
    outletName: string;
    notice: string | null;
    acceptingOrders: boolean;
}>;
export type TableOrderMenu = z.infer<typeof TableOrderMenu>;
export declare const TableOrderLine: z.ZodObject<{
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
export type TableOrderLine = z.infer<typeof TableOrderLine>;
export declare const PlaceTableOrderRequest: z.ZodObject<{
    /** Made once per cart by the phone (a random uuid). */
    clientKey: z.ZodString;
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
    guestNote: z.ZodOptional<z.ZodString>;
    /** How many are at the table, when the order seats it. */
    guestCount: z.ZodOptional<z.ZodNumber>;
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
    clientKey: string;
    guestCount?: number | undefined;
    guestNote?: string | undefined;
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
    clientKey: string;
    guestCount?: number | undefined;
    guestNote?: string | undefined;
}>;
export type PlaceTableOrderRequest = z.infer<typeof PlaceTableOrderRequest>;
/** The guest's own order, read back by their phone: what was sent, the bill so far for it, and how far it has got. */
export declare const TableOrderStatus: z.ZodObject<{
    orderNumber: z.ZodString;
    tableLabel: z.ZodString;
    stage: z.ZodEnum<["received", "preparing", "ready", "served", "cancelled"]>;
    taxMode: z.ZodEnum<["exclusive", "inclusive"]>;
    taxRwf: z.ZodNumber;
    totalRwf: z.ZodNumber;
    placedAt: z.ZodString;
    lines: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        quantity: z.ZodNumber;
        totalRwf: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        name: string;
        totalRwf: number;
        quantity: number;
    }, {
        name: string;
        totalRwf: number;
        quantity: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    stage: "received" | "cancelled" | "ready" | "preparing" | "served";
    totalRwf: number;
    orderNumber: string;
    taxRwf: number;
    taxMode: "inclusive" | "exclusive";
    tableLabel: string;
    lines: {
        name: string;
        totalRwf: number;
        quantity: number;
    }[];
    placedAt: string;
}, {
    stage: "received" | "cancelled" | "ready" | "preparing" | "served";
    totalRwf: number;
    orderNumber: string;
    taxRwf: number;
    taxMode: "inclusive" | "exclusive";
    tableLabel: string;
    lines: {
        name: string;
        totalRwf: number;
        quantity: number;
    }[];
    placedAt: string;
}>;
export type TableOrderStatus = z.infer<typeof TableOrderStatus>;
//# sourceMappingURL=table-order.d.ts.map