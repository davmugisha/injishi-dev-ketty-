import { z } from "zod";
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
export declare const OrderingAccess: z.ZodEnum<["in_house_only", "walk_in_only", "both"]>;
export type OrderingAccess = z.infer<typeof OrderingAccess>;
export declare const OutletKind: z.ZodEnum<["restaurant", "bar", "lounge", "banquet", "room_service", "spa", "gym", "pool", "gift_shop", "parking", "laundry", "business_center", "other"]>;
export type OutletKind = z.infer<typeof OutletKind>;
/**
 * One thing a guest may order right now. Stock COUNTS are never sent: an item
 * that is out simply is not listed, and a count tells a competitor how much a
 * kitchen sells. An item without its RRA codes is not listed either (D-m).
 */
export declare const OrderableItem: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    description: z.ZodNullable<z.ZodString>;
    /** Tax exclusive, as on the menu. The order adds tax at the effective rate. */
    priceRwf: z.ZodNumber;
    prepTimeMinutes: z.ZodNullable<z.ZodNumber>;
    /** The modifiers a guest may pick, each with its price delta. */
    options: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        required: z.ZodDefault<z.ZodBoolean>;
        maxChoices: z.ZodDefault<z.ZodNumber>;
        choices: z.ZodArray<z.ZodObject<{
            label: z.ZodString;
            priceDeltaRwf: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            label: string;
            priceDeltaRwf: number;
        }, {
            label: string;
            priceDeltaRwf?: number | undefined;
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
        choices: {
            label: string;
            priceDeltaRwf?: number | undefined;
        }[];
        required?: boolean | undefined;
        maxChoices?: number | undefined;
    }>, "many">;
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
    prepTimeMinutes: number | null;
}, {
    options: {
        name: string;
        choices: {
            label: string;
            priceDeltaRwf?: number | undefined;
        }[];
        required?: boolean | undefined;
        maxChoices?: number | undefined;
    }[];
    name: string;
    id: string;
    description: string | null;
    priceRwf: number;
    prepTimeMinutes: number | null;
}>;
export type OrderableItem = z.infer<typeof OrderableItem>;
export declare const OrderableCategory: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        description: z.ZodNullable<z.ZodString>;
        /** Tax exclusive, as on the menu. The order adds tax at the effective rate. */
        priceRwf: z.ZodNumber;
        prepTimeMinutes: z.ZodNullable<z.ZodNumber>;
        /** The modifiers a guest may pick, each with its price delta. */
        options: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            required: z.ZodDefault<z.ZodBoolean>;
            maxChoices: z.ZodDefault<z.ZodNumber>;
            choices: z.ZodArray<z.ZodObject<{
                label: z.ZodString;
                priceDeltaRwf: z.ZodDefault<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                label: string;
                priceDeltaRwf: number;
            }, {
                label: string;
                priceDeltaRwf?: number | undefined;
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
            choices: {
                label: string;
                priceDeltaRwf?: number | undefined;
            }[];
            required?: boolean | undefined;
            maxChoices?: number | undefined;
        }>, "many">;
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
        prepTimeMinutes: number | null;
    }, {
        options: {
            name: string;
            choices: {
                label: string;
                priceDeltaRwf?: number | undefined;
            }[];
            required?: boolean | undefined;
            maxChoices?: number | undefined;
        }[];
        name: string;
        id: string;
        description: string | null;
        priceRwf: number;
        prepTimeMinutes: number | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: string;
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
        prepTimeMinutes: number | null;
    }[];
}, {
    name: string;
    id: string;
    items: {
        options: {
            name: string;
            choices: {
                label: string;
                priceDeltaRwf?: number | undefined;
            }[];
            required?: boolean | undefined;
            maxChoices?: number | undefined;
        }[];
        name: string;
        id: string;
        description: string | null;
        priceRwf: number;
        prepTimeMinutes: number | null;
    }[];
}>;
export type OrderableCategory = z.infer<typeof OrderableCategory>;
/** Service windows as `outlets.hours` stores them, e.g. `{"mon": ["07:00", "22:00"]}`. Null means always open. */
export declare const OutletHours: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
export type OutletHours = z.infer<typeof OutletHours>;
export declare const OrderableOutlet: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    outletKind: z.ZodEnum<["restaurant", "bar", "lounge", "banquet", "room_service", "spa", "gym", "pool", "gift_shop", "parking", "laundry", "business_center", "other"]>;
    propertyId: z.ZodString;
    propertyName: z.ZodString;
    orderingAccess: z.ZodEnum<["in_house_only", "walk_in_only", "both"]>;
    hours: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    /**
     * The caller is in house at this outlet's property, the outlet serves in
     * house guests, and their bill is still open.
     */
    chargeToRoom: z.ZodBoolean;
    /** The outlet takes walk in orders, so the caller may pay now. */
    payNow: z.ZodBoolean;
    /** How far away, when the caller gave coordinates. Null otherwise. */
    distanceKm: z.ZodNullable<z.ZodNumber>;
    /** A quiet operator label, set only when someone other than the hotel runs it. Null until slice 4. */
    operatorLabel: z.ZodNullable<z.ZodString>;
    categories: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        items: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            description: z.ZodNullable<z.ZodString>;
            /** Tax exclusive, as on the menu. The order adds tax at the effective rate. */
            priceRwf: z.ZodNumber;
            prepTimeMinutes: z.ZodNullable<z.ZodNumber>;
            /** The modifiers a guest may pick, each with its price delta. */
            options: z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                required: z.ZodDefault<z.ZodBoolean>;
                maxChoices: z.ZodDefault<z.ZodNumber>;
                choices: z.ZodArray<z.ZodObject<{
                    label: z.ZodString;
                    priceDeltaRwf: z.ZodDefault<z.ZodNumber>;
                }, "strip", z.ZodTypeAny, {
                    label: string;
                    priceDeltaRwf: number;
                }, {
                    label: string;
                    priceDeltaRwf?: number | undefined;
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
                choices: {
                    label: string;
                    priceDeltaRwf?: number | undefined;
                }[];
                required?: boolean | undefined;
                maxChoices?: number | undefined;
            }>, "many">;
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
            prepTimeMinutes: number | null;
        }, {
            options: {
                name: string;
                choices: {
                    label: string;
                    priceDeltaRwf?: number | undefined;
                }[];
                required?: boolean | undefined;
                maxChoices?: number | undefined;
            }[];
            name: string;
            id: string;
            description: string | null;
            priceRwf: number;
            prepTimeMinutes: number | null;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
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
            prepTimeMinutes: number | null;
        }[];
    }, {
        name: string;
        id: string;
        items: {
            options: {
                name: string;
                choices: {
                    label: string;
                    priceDeltaRwf?: number | undefined;
                }[];
                required?: boolean | undefined;
                maxChoices?: number | undefined;
            }[];
            name: string;
            id: string;
            description: string | null;
            priceRwf: number;
            prepTimeMinutes: number | null;
        }[];
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: string;
    propertyName: string;
    propertyId: string;
    categories: {
        name: string;
        id: string;
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
            prepTimeMinutes: number | null;
        }[];
    }[];
    outletKind: "other" | "restaurant" | "bar" | "lounge" | "banquet" | "room_service" | "spa" | "gym" | "pool" | "gift_shop" | "parking" | "laundry" | "business_center";
    orderingAccess: "both" | "in_house_only" | "walk_in_only";
    hours: Record<string, unknown> | null;
    chargeToRoom: boolean;
    payNow: boolean;
    distanceKm: number | null;
    operatorLabel: string | null;
}, {
    name: string;
    id: string;
    propertyName: string;
    propertyId: string;
    categories: {
        name: string;
        id: string;
        items: {
            options: {
                name: string;
                choices: {
                    label: string;
                    priceDeltaRwf?: number | undefined;
                }[];
                required?: boolean | undefined;
                maxChoices?: number | undefined;
            }[];
            name: string;
            id: string;
            description: string | null;
            priceRwf: number;
            prepTimeMinutes: number | null;
        }[];
    }[];
    outletKind: "other" | "restaurant" | "bar" | "lounge" | "banquet" | "room_service" | "spa" | "gym" | "pool" | "gift_shop" | "parking" | "laundry" | "business_center";
    orderingAccess: "both" | "in_house_only" | "walk_in_only";
    hours: Record<string, unknown> | null;
    chargeToRoom: boolean;
    payNow: boolean;
    distanceKm: number | null;
    operatorLabel: string | null;
}>;
export type OrderableOutlet = z.infer<typeof OrderableOutlet>;
export declare const OrderableList: z.ZodObject<{
    outlets: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        outletKind: z.ZodEnum<["restaurant", "bar", "lounge", "banquet", "room_service", "spa", "gym", "pool", "gift_shop", "parking", "laundry", "business_center", "other"]>;
        propertyId: z.ZodString;
        propertyName: z.ZodString;
        orderingAccess: z.ZodEnum<["in_house_only", "walk_in_only", "both"]>;
        hours: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        /**
         * The caller is in house at this outlet's property, the outlet serves in
         * house guests, and their bill is still open.
         */
        chargeToRoom: z.ZodBoolean;
        /** The outlet takes walk in orders, so the caller may pay now. */
        payNow: z.ZodBoolean;
        /** How far away, when the caller gave coordinates. Null otherwise. */
        distanceKm: z.ZodNullable<z.ZodNumber>;
        /** A quiet operator label, set only when someone other than the hotel runs it. Null until slice 4. */
        operatorLabel: z.ZodNullable<z.ZodString>;
        categories: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            items: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                name: z.ZodString;
                description: z.ZodNullable<z.ZodString>;
                /** Tax exclusive, as on the menu. The order adds tax at the effective rate. */
                priceRwf: z.ZodNumber;
                prepTimeMinutes: z.ZodNullable<z.ZodNumber>;
                /** The modifiers a guest may pick, each with its price delta. */
                options: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    required: z.ZodDefault<z.ZodBoolean>;
                    maxChoices: z.ZodDefault<z.ZodNumber>;
                    choices: z.ZodArray<z.ZodObject<{
                        label: z.ZodString;
                        priceDeltaRwf: z.ZodDefault<z.ZodNumber>;
                    }, "strip", z.ZodTypeAny, {
                        label: string;
                        priceDeltaRwf: number;
                    }, {
                        label: string;
                        priceDeltaRwf?: number | undefined;
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
                    choices: {
                        label: string;
                        priceDeltaRwf?: number | undefined;
                    }[];
                    required?: boolean | undefined;
                    maxChoices?: number | undefined;
                }>, "many">;
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
                prepTimeMinutes: number | null;
            }, {
                options: {
                    name: string;
                    choices: {
                        label: string;
                        priceDeltaRwf?: number | undefined;
                    }[];
                    required?: boolean | undefined;
                    maxChoices?: number | undefined;
                }[];
                name: string;
                id: string;
                description: string | null;
                priceRwf: number;
                prepTimeMinutes: number | null;
            }>, "many">;
        }, "strip", z.ZodTypeAny, {
            name: string;
            id: string;
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
                prepTimeMinutes: number | null;
            }[];
        }, {
            name: string;
            id: string;
            items: {
                options: {
                    name: string;
                    choices: {
                        label: string;
                        priceDeltaRwf?: number | undefined;
                    }[];
                    required?: boolean | undefined;
                    maxChoices?: number | undefined;
                }[];
                name: string;
                id: string;
                description: string | null;
                priceRwf: number;
                prepTimeMinutes: number | null;
            }[];
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
        propertyName: string;
        propertyId: string;
        categories: {
            name: string;
            id: string;
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
                prepTimeMinutes: number | null;
            }[];
        }[];
        outletKind: "other" | "restaurant" | "bar" | "lounge" | "banquet" | "room_service" | "spa" | "gym" | "pool" | "gift_shop" | "parking" | "laundry" | "business_center";
        orderingAccess: "both" | "in_house_only" | "walk_in_only";
        hours: Record<string, unknown> | null;
        chargeToRoom: boolean;
        payNow: boolean;
        distanceKm: number | null;
        operatorLabel: string | null;
    }, {
        name: string;
        id: string;
        propertyName: string;
        propertyId: string;
        categories: {
            name: string;
            id: string;
            items: {
                options: {
                    name: string;
                    choices: {
                        label: string;
                        priceDeltaRwf?: number | undefined;
                    }[];
                    required?: boolean | undefined;
                    maxChoices?: number | undefined;
                }[];
                name: string;
                id: string;
                description: string | null;
                priceRwf: number;
                prepTimeMinutes: number | null;
            }[];
        }[];
        outletKind: "other" | "restaurant" | "bar" | "lounge" | "banquet" | "room_service" | "spa" | "gym" | "pool" | "gift_shop" | "parking" | "laundry" | "business_center";
        orderingAccess: "both" | "in_house_only" | "walk_in_only";
        hours: Record<string, unknown> | null;
        chargeToRoom: boolean;
        payNow: boolean;
        distanceKm: number | null;
        operatorLabel: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    outlets: {
        name: string;
        id: string;
        propertyName: string;
        propertyId: string;
        categories: {
            name: string;
            id: string;
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
                prepTimeMinutes: number | null;
            }[];
        }[];
        outletKind: "other" | "restaurant" | "bar" | "lounge" | "banquet" | "room_service" | "spa" | "gym" | "pool" | "gift_shop" | "parking" | "laundry" | "business_center";
        orderingAccess: "both" | "in_house_only" | "walk_in_only";
        hours: Record<string, unknown> | null;
        chargeToRoom: boolean;
        payNow: boolean;
        distanceKm: number | null;
        operatorLabel: string | null;
    }[];
}, {
    outlets: {
        name: string;
        id: string;
        propertyName: string;
        propertyId: string;
        categories: {
            name: string;
            id: string;
            items: {
                options: {
                    name: string;
                    choices: {
                        label: string;
                        priceDeltaRwf?: number | undefined;
                    }[];
                    required?: boolean | undefined;
                    maxChoices?: number | undefined;
                }[];
                name: string;
                id: string;
                description: string | null;
                priceRwf: number;
                prepTimeMinutes: number | null;
            }[];
        }[];
        outletKind: "other" | "restaurant" | "bar" | "lounge" | "banquet" | "room_service" | "spa" | "gym" | "pool" | "gift_shop" | "parking" | "laundry" | "business_center";
        orderingAccess: "both" | "in_house_only" | "walk_in_only";
        hours: Record<string, unknown> | null;
        chargeToRoom: boolean;
        payNow: boolean;
        distanceKm: number | null;
        operatorLabel: string | null;
    }[];
}>;
export type OrderableList = z.infer<typeof OrderableList>;
/**
 * Where to look (D-o).
 *
 * With `lat` and `lng`, walk in outlets within 5 km are added, nearest first.
 * Without them the answer is only what the caller is in house at, plus the
 * property named, because a list of every outlet in Rwanda is not an answer.
 */
export declare const OrderableQuery: z.ZodEffects<z.ZodObject<{
    propertyId: z.ZodOptional<z.ZodString>;
    lat: z.ZodOptional<z.ZodNumber>;
    lng: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    propertyId?: string | undefined;
    lat?: number | undefined;
    lng?: number | undefined;
}, {
    propertyId?: string | undefined;
    lat?: number | undefined;
    lng?: number | undefined;
}>, {
    propertyId?: string | undefined;
    lat?: number | undefined;
    lng?: number | undefined;
}, {
    propertyId?: string | undefined;
    lat?: number | undefined;
    lng?: number | undefined;
}>;
export type OrderableQuery = z.infer<typeof OrderableQuery>;
export declare const PlaceOrderRequest: z.ZodEffects<z.ZodObject<{
    outletId: z.ZodString;
    /**
     * `in_house_folio` posts to the guest's bill when delivered. `pay_now`
     * settles before the kitchen sees it and never touches a bill.
     */
    context: z.ZodDefault<z.ZodEnum<["in_house_folio", "pay_now"]>>;
    items: z.ZodArray<z.ZodObject<{
        serviceItemId: z.ZodString;
        quantity: z.ZodNumber;
        note: z.ZodOptional<z.ZodString>;
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
    requestedForAt: z.ZodOptional<z.ZodString>;
    /**
     * Pay now only. Mobile money prompts the handset and the answer is polled
     * like a booking's; left out, the order waits for cash at the counter.
     * Card is refused until a hosted field exists (D-p).
     */
    instrument: z.ZodOptional<z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
        kind: z.ZodLiteral<"mobile_money">;
        network: z.ZodEnum<["mtn_momo", "airtel_money"]>;
        msisdn: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        network: "mtn_momo" | "airtel_money";
        kind: "mobile_money";
        msisdn: string;
    }, {
        network: "mtn_momo" | "airtel_money";
        kind: "mobile_money";
        msisdn: string;
    }>, z.ZodObject<{
        kind: z.ZodLiteral<"card">;
        token: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        kind: "card";
        token: string;
    }, {
        kind: "card";
        token: string;
    }>]>>;
    /**
     * The conversation this order is placed from (ADR-050 D-s). The order stays
     * one record; the thread gets a card and a line for every status change.
     * It must be the caller's own active thread at the outlet's property.
     */
    threadId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    items: {
        quantity: number;
        serviceItemId: string;
        note?: string | undefined;
        selectedOptions?: {
            name: string;
            choices: string[];
        }[] | undefined;
    }[];
    outletId: string;
    context: "in_house_folio" | "pay_now";
    instrument?: {
        network: "mtn_momo" | "airtel_money";
        kind: "mobile_money";
        msisdn: string;
    } | {
        kind: "card";
        token: string;
    } | undefined;
    threadId?: string | undefined;
    guestNote?: string | undefined;
    requestedForAt?: string | undefined;
}, {
    items: {
        quantity: number;
        serviceItemId: string;
        note?: string | undefined;
        selectedOptions?: {
            name: string;
            choices: string[];
        }[] | undefined;
    }[];
    outletId: string;
    instrument?: {
        network: "mtn_momo" | "airtel_money";
        kind: "mobile_money";
        msisdn: string;
    } | {
        kind: "card";
        token: string;
    } | undefined;
    threadId?: string | undefined;
    guestNote?: string | undefined;
    context?: "in_house_folio" | "pay_now" | undefined;
    requestedForAt?: string | undefined;
}>, {
    items: {
        quantity: number;
        serviceItemId: string;
        note?: string | undefined;
        selectedOptions?: {
            name: string;
            choices: string[];
        }[] | undefined;
    }[];
    outletId: string;
    context: "in_house_folio" | "pay_now";
    instrument?: {
        network: "mtn_momo" | "airtel_money";
        kind: "mobile_money";
        msisdn: string;
    } | {
        kind: "card";
        token: string;
    } | undefined;
    threadId?: string | undefined;
    guestNote?: string | undefined;
    requestedForAt?: string | undefined;
}, {
    items: {
        quantity: number;
        serviceItemId: string;
        note?: string | undefined;
        selectedOptions?: {
            name: string;
            choices: string[];
        }[] | undefined;
    }[];
    outletId: string;
    instrument?: {
        network: "mtn_momo" | "airtel_money";
        kind: "mobile_money";
        msisdn: string;
    } | {
        kind: "card";
        token: string;
    } | undefined;
    threadId?: string | undefined;
    guestNote?: string | undefined;
    context?: "in_house_folio" | "pay_now" | undefined;
    requestedForAt?: string | undefined;
}>;
export type PlaceOrderRequest = z.infer<typeof PlaceOrderRequest>;
export declare const GuestOrderLine: z.ZodObject<{
    name: z.ZodString;
    quantity: z.ZodNumber;
    unitPriceRwf: z.ZodNumber;
    lineTotalRwf: z.ZodNumber;
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
}, "strip", z.ZodTypeAny, {
    name: string;
    quantity: number;
    unitPriceRwf: number;
    lineTotalRwf: number;
    selectedOptions: {
        name: string;
        choices: {
            label: string;
            priceDeltaRwf: number;
        }[];
    }[];
}, {
    name: string;
    quantity: number;
    unitPriceRwf: number;
    lineTotalRwf: number;
    selectedOptions: {
        name: string;
        choices: {
            label: string;
            priceDeltaRwf: number;
        }[];
    }[];
}>;
export type GuestOrderLine = z.infer<typeof GuestOrderLine>;
/**
 * A placed order, as its guest reads it. Prices are the snapshots locked when
 * it was placed, so editing the menu never changes it (AC-23).
 */
export declare const GuestOrder: z.ZodObject<{
    id: z.ZodString;
    orderNumber: z.ZodString;
    status: z.ZodEnum<["submitted", "acknowledged", "in_progress", "ready", "delivered", "completed", "cancelled", "rejected", "pending_payment", "payment_failed"]>;
    outletId: z.ZodString;
    outletName: z.ZodString;
    propertyName: z.ZodString;
    context: z.ZodEnum<["in_house_folio", "pay_now"]>;
    lines: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        quantity: z.ZodNumber;
        unitPriceRwf: z.ZodNumber;
        lineTotalRwf: z.ZodNumber;
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
    }, "strip", z.ZodTypeAny, {
        name: string;
        quantity: number;
        unitPriceRwf: number;
        lineTotalRwf: number;
        selectedOptions: {
            name: string;
            choices: {
                label: string;
                priceDeltaRwf: number;
            }[];
        }[];
    }, {
        name: string;
        quantity: number;
        unitPriceRwf: number;
        lineTotalRwf: number;
        selectedOptions: {
            name: string;
            choices: {
                label: string;
                priceDeltaRwf: number;
            }[];
        }[];
    }>, "many">;
    subtotalRwf: z.ZodNumber;
    taxRwf: z.ZodNumber;
    totalRwf: z.ZodNumber;
    /** Pay now only: when the money settled, and the RRA means of payment (`01` cash, `06` mobile money). */
    paidAt: z.ZodNullable<z.ZodString>;
    paymentMethod: z.ZodNullable<z.ZodString>;
    /**
     * Whether the guest may still cancel it themselves. A paid order never,
     * because cancelling it is a refund, and that is staff only (D-n).
     */
    cancellable: z.ZodBoolean;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "pending_payment" | "submitted" | "rejected" | "cancelled" | "acknowledged" | "in_progress" | "ready" | "delivered" | "completed" | "payment_failed";
    id: string;
    cancellable: boolean;
    paidAt: string | null;
    createdAt: string;
    propertyName: string;
    totalRwf: number;
    outletId: string;
    orderNumber: string;
    subtotalRwf: number;
    taxRwf: number;
    paymentMethod: string | null;
    context: "in_house_folio" | "pay_now";
    lines: {
        name: string;
        quantity: number;
        unitPriceRwf: number;
        lineTotalRwf: number;
        selectedOptions: {
            name: string;
            choices: {
                label: string;
                priceDeltaRwf: number;
            }[];
        }[];
    }[];
    outletName: string;
}, {
    status: "pending_payment" | "submitted" | "rejected" | "cancelled" | "acknowledged" | "in_progress" | "ready" | "delivered" | "completed" | "payment_failed";
    id: string;
    cancellable: boolean;
    paidAt: string | null;
    createdAt: string;
    propertyName: string;
    totalRwf: number;
    outletId: string;
    orderNumber: string;
    subtotalRwf: number;
    taxRwf: number;
    paymentMethod: string | null;
    context: "in_house_folio" | "pay_now";
    lines: {
        name: string;
        quantity: number;
        unitPriceRwf: number;
        lineTotalRwf: number;
        selectedOptions: {
            name: string;
            choices: {
                label: string;
                priceDeltaRwf: number;
            }[];
        }[];
    }[];
    outletName: string;
}>;
export type GuestOrder = z.infer<typeof GuestOrder>;
/**
 * Where a pay now order's mobile money prompt got to. The booking poll's shape,
 * with the order in place of the booking (ADR-047 D-j).
 */
export declare const OrderPaymentAttemptStatus: z.ZodObject<{
    attemptToken: z.ZodString;
    state: z.ZodEnum<["prompting", "confirmed", "refused", "expired"]>;
    network: z.ZodNullable<z.ZodEnum<["mtn_momo", "airtel_money"]>>;
    payerMasked: z.ZodNullable<z.ZodString>;
    amountRwf: z.ZodNullable<z.ZodNumber>;
    expiresAt: z.ZodString;
    /** The order as it stands now: `submitted` once the money settled. */
    order: z.ZodObject<{
        id: z.ZodString;
        orderNumber: z.ZodString;
        status: z.ZodEnum<["submitted", "acknowledged", "in_progress", "ready", "delivered", "completed", "cancelled", "rejected", "pending_payment", "payment_failed"]>;
        outletId: z.ZodString;
        outletName: z.ZodString;
        propertyName: z.ZodString;
        context: z.ZodEnum<["in_house_folio", "pay_now"]>;
        lines: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            quantity: z.ZodNumber;
            unitPriceRwf: z.ZodNumber;
            lineTotalRwf: z.ZodNumber;
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
        }, "strip", z.ZodTypeAny, {
            name: string;
            quantity: number;
            unitPriceRwf: number;
            lineTotalRwf: number;
            selectedOptions: {
                name: string;
                choices: {
                    label: string;
                    priceDeltaRwf: number;
                }[];
            }[];
        }, {
            name: string;
            quantity: number;
            unitPriceRwf: number;
            lineTotalRwf: number;
            selectedOptions: {
                name: string;
                choices: {
                    label: string;
                    priceDeltaRwf: number;
                }[];
            }[];
        }>, "many">;
        subtotalRwf: z.ZodNumber;
        taxRwf: z.ZodNumber;
        totalRwf: z.ZodNumber;
        /** Pay now only: when the money settled, and the RRA means of payment (`01` cash, `06` mobile money). */
        paidAt: z.ZodNullable<z.ZodString>;
        paymentMethod: z.ZodNullable<z.ZodString>;
        /**
         * Whether the guest may still cancel it themselves. A paid order never,
         * because cancelling it is a refund, and that is staff only (D-n).
         */
        cancellable: z.ZodBoolean;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "pending_payment" | "submitted" | "rejected" | "cancelled" | "acknowledged" | "in_progress" | "ready" | "delivered" | "completed" | "payment_failed";
        id: string;
        cancellable: boolean;
        paidAt: string | null;
        createdAt: string;
        propertyName: string;
        totalRwf: number;
        outletId: string;
        orderNumber: string;
        subtotalRwf: number;
        taxRwf: number;
        paymentMethod: string | null;
        context: "in_house_folio" | "pay_now";
        lines: {
            name: string;
            quantity: number;
            unitPriceRwf: number;
            lineTotalRwf: number;
            selectedOptions: {
                name: string;
                choices: {
                    label: string;
                    priceDeltaRwf: number;
                }[];
            }[];
        }[];
        outletName: string;
    }, {
        status: "pending_payment" | "submitted" | "rejected" | "cancelled" | "acknowledged" | "in_progress" | "ready" | "delivered" | "completed" | "payment_failed";
        id: string;
        cancellable: boolean;
        paidAt: string | null;
        createdAt: string;
        propertyName: string;
        totalRwf: number;
        outletId: string;
        orderNumber: string;
        subtotalRwf: number;
        taxRwf: number;
        paymentMethod: string | null;
        context: "in_house_folio" | "pay_now";
        lines: {
            name: string;
            quantity: number;
            unitPriceRwf: number;
            lineTotalRwf: number;
            selectedOptions: {
                name: string;
                choices: {
                    label: string;
                    priceDeltaRwf: number;
                }[];
            }[];
        }[];
        outletName: string;
    }>;
    failureReason: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    network: "mtn_momo" | "airtel_money" | null;
    attemptToken: string;
    state: "confirmed" | "expired" | "prompting" | "refused";
    payerMasked: string | null;
    amountRwf: number | null;
    expiresAt: string;
    failureReason: string | null;
    order: {
        status: "pending_payment" | "submitted" | "rejected" | "cancelled" | "acknowledged" | "in_progress" | "ready" | "delivered" | "completed" | "payment_failed";
        id: string;
        cancellable: boolean;
        paidAt: string | null;
        createdAt: string;
        propertyName: string;
        totalRwf: number;
        outletId: string;
        orderNumber: string;
        subtotalRwf: number;
        taxRwf: number;
        paymentMethod: string | null;
        context: "in_house_folio" | "pay_now";
        lines: {
            name: string;
            quantity: number;
            unitPriceRwf: number;
            lineTotalRwf: number;
            selectedOptions: {
                name: string;
                choices: {
                    label: string;
                    priceDeltaRwf: number;
                }[];
            }[];
        }[];
        outletName: string;
    };
}, {
    network: "mtn_momo" | "airtel_money" | null;
    attemptToken: string;
    state: "confirmed" | "expired" | "prompting" | "refused";
    payerMasked: string | null;
    amountRwf: number | null;
    expiresAt: string;
    failureReason: string | null;
    order: {
        status: "pending_payment" | "submitted" | "rejected" | "cancelled" | "acknowledged" | "in_progress" | "ready" | "delivered" | "completed" | "payment_failed";
        id: string;
        cancellable: boolean;
        paidAt: string | null;
        createdAt: string;
        propertyName: string;
        totalRwf: number;
        outletId: string;
        orderNumber: string;
        subtotalRwf: number;
        taxRwf: number;
        paymentMethod: string | null;
        context: "in_house_folio" | "pay_now";
        lines: {
            name: string;
            quantity: number;
            unitPriceRwf: number;
            lineTotalRwf: number;
            selectedOptions: {
                name: string;
                choices: {
                    label: string;
                    priceDeltaRwf: number;
                }[];
            }[];
        }[];
        outletName: string;
    };
}>;
export type OrderPaymentAttemptStatus = z.infer<typeof OrderPaymentAttemptStatus>;
/**
 * What `POST /me/orders` answers: the order, and for a pay now order on mobile
 * money the attempt to wait on. `attempt` is null for every other order,
 * including one waiting for cash.
 */
export declare const PlaceOrderResult: z.ZodObject<{
    id: z.ZodString;
    orderNumber: z.ZodString;
    status: z.ZodEnum<["submitted", "acknowledged", "in_progress", "ready", "delivered", "completed", "cancelled", "rejected", "pending_payment", "payment_failed"]>;
    outletId: z.ZodString;
    outletName: z.ZodString;
    propertyName: z.ZodString;
    context: z.ZodEnum<["in_house_folio", "pay_now"]>;
    lines: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        quantity: z.ZodNumber;
        unitPriceRwf: z.ZodNumber;
        lineTotalRwf: z.ZodNumber;
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
    }, "strip", z.ZodTypeAny, {
        name: string;
        quantity: number;
        unitPriceRwf: number;
        lineTotalRwf: number;
        selectedOptions: {
            name: string;
            choices: {
                label: string;
                priceDeltaRwf: number;
            }[];
        }[];
    }, {
        name: string;
        quantity: number;
        unitPriceRwf: number;
        lineTotalRwf: number;
        selectedOptions: {
            name: string;
            choices: {
                label: string;
                priceDeltaRwf: number;
            }[];
        }[];
    }>, "many">;
    subtotalRwf: z.ZodNumber;
    taxRwf: z.ZodNumber;
    totalRwf: z.ZodNumber;
    /** Pay now only: when the money settled, and the RRA means of payment (`01` cash, `06` mobile money). */
    paidAt: z.ZodNullable<z.ZodString>;
    paymentMethod: z.ZodNullable<z.ZodString>;
    /**
     * Whether the guest may still cancel it themselves. A paid order never,
     * because cancelling it is a refund, and that is staff only (D-n).
     */
    cancellable: z.ZodBoolean;
    createdAt: z.ZodString;
} & {
    attempt: z.ZodNullable<z.ZodObject<Omit<{
        attemptToken: z.ZodString;
        state: z.ZodEnum<["prompting", "confirmed", "refused", "expired"]>;
        network: z.ZodNullable<z.ZodEnum<["mtn_momo", "airtel_money"]>>;
        payerMasked: z.ZodNullable<z.ZodString>;
        amountRwf: z.ZodNullable<z.ZodNumber>;
        expiresAt: z.ZodString;
        /** The order as it stands now: `submitted` once the money settled. */
        order: z.ZodObject<{
            id: z.ZodString;
            orderNumber: z.ZodString;
            status: z.ZodEnum<["submitted", "acknowledged", "in_progress", "ready", "delivered", "completed", "cancelled", "rejected", "pending_payment", "payment_failed"]>;
            outletId: z.ZodString;
            outletName: z.ZodString;
            propertyName: z.ZodString;
            context: z.ZodEnum<["in_house_folio", "pay_now"]>;
            lines: z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                quantity: z.ZodNumber;
                unitPriceRwf: z.ZodNumber;
                lineTotalRwf: z.ZodNumber;
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
            }, "strip", z.ZodTypeAny, {
                name: string;
                quantity: number;
                unitPriceRwf: number;
                lineTotalRwf: number;
                selectedOptions: {
                    name: string;
                    choices: {
                        label: string;
                        priceDeltaRwf: number;
                    }[];
                }[];
            }, {
                name: string;
                quantity: number;
                unitPriceRwf: number;
                lineTotalRwf: number;
                selectedOptions: {
                    name: string;
                    choices: {
                        label: string;
                        priceDeltaRwf: number;
                    }[];
                }[];
            }>, "many">;
            subtotalRwf: z.ZodNumber;
            taxRwf: z.ZodNumber;
            totalRwf: z.ZodNumber;
            /** Pay now only: when the money settled, and the RRA means of payment (`01` cash, `06` mobile money). */
            paidAt: z.ZodNullable<z.ZodString>;
            paymentMethod: z.ZodNullable<z.ZodString>;
            /**
             * Whether the guest may still cancel it themselves. A paid order never,
             * because cancelling it is a refund, and that is staff only (D-n).
             */
            cancellable: z.ZodBoolean;
            createdAt: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            status: "pending_payment" | "submitted" | "rejected" | "cancelled" | "acknowledged" | "in_progress" | "ready" | "delivered" | "completed" | "payment_failed";
            id: string;
            cancellable: boolean;
            paidAt: string | null;
            createdAt: string;
            propertyName: string;
            totalRwf: number;
            outletId: string;
            orderNumber: string;
            subtotalRwf: number;
            taxRwf: number;
            paymentMethod: string | null;
            context: "in_house_folio" | "pay_now";
            lines: {
                name: string;
                quantity: number;
                unitPriceRwf: number;
                lineTotalRwf: number;
                selectedOptions: {
                    name: string;
                    choices: {
                        label: string;
                        priceDeltaRwf: number;
                    }[];
                }[];
            }[];
            outletName: string;
        }, {
            status: "pending_payment" | "submitted" | "rejected" | "cancelled" | "acknowledged" | "in_progress" | "ready" | "delivered" | "completed" | "payment_failed";
            id: string;
            cancellable: boolean;
            paidAt: string | null;
            createdAt: string;
            propertyName: string;
            totalRwf: number;
            outletId: string;
            orderNumber: string;
            subtotalRwf: number;
            taxRwf: number;
            paymentMethod: string | null;
            context: "in_house_folio" | "pay_now";
            lines: {
                name: string;
                quantity: number;
                unitPriceRwf: number;
                lineTotalRwf: number;
                selectedOptions: {
                    name: string;
                    choices: {
                        label: string;
                        priceDeltaRwf: number;
                    }[];
                }[];
            }[];
            outletName: string;
        }>;
        failureReason: z.ZodNullable<z.ZodString>;
    }, "order">, "strip", z.ZodTypeAny, {
        network: "mtn_momo" | "airtel_money" | null;
        attemptToken: string;
        state: "confirmed" | "expired" | "prompting" | "refused";
        payerMasked: string | null;
        amountRwf: number | null;
        expiresAt: string;
        failureReason: string | null;
    }, {
        network: "mtn_momo" | "airtel_money" | null;
        attemptToken: string;
        state: "confirmed" | "expired" | "prompting" | "refused";
        payerMasked: string | null;
        amountRwf: number | null;
        expiresAt: string;
        failureReason: string | null;
    }>>;
}, "strip", z.ZodTypeAny, {
    status: "pending_payment" | "submitted" | "rejected" | "cancelled" | "acknowledged" | "in_progress" | "ready" | "delivered" | "completed" | "payment_failed";
    id: string;
    attempt: {
        network: "mtn_momo" | "airtel_money" | null;
        attemptToken: string;
        state: "confirmed" | "expired" | "prompting" | "refused";
        payerMasked: string | null;
        amountRwf: number | null;
        expiresAt: string;
        failureReason: string | null;
    } | null;
    cancellable: boolean;
    paidAt: string | null;
    createdAt: string;
    propertyName: string;
    totalRwf: number;
    outletId: string;
    orderNumber: string;
    subtotalRwf: number;
    taxRwf: number;
    paymentMethod: string | null;
    context: "in_house_folio" | "pay_now";
    lines: {
        name: string;
        quantity: number;
        unitPriceRwf: number;
        lineTotalRwf: number;
        selectedOptions: {
            name: string;
            choices: {
                label: string;
                priceDeltaRwf: number;
            }[];
        }[];
    }[];
    outletName: string;
}, {
    status: "pending_payment" | "submitted" | "rejected" | "cancelled" | "acknowledged" | "in_progress" | "ready" | "delivered" | "completed" | "payment_failed";
    id: string;
    attempt: {
        network: "mtn_momo" | "airtel_money" | null;
        attemptToken: string;
        state: "confirmed" | "expired" | "prompting" | "refused";
        payerMasked: string | null;
        amountRwf: number | null;
        expiresAt: string;
        failureReason: string | null;
    } | null;
    cancellable: boolean;
    paidAt: string | null;
    createdAt: string;
    propertyName: string;
    totalRwf: number;
    outletId: string;
    orderNumber: string;
    subtotalRwf: number;
    taxRwf: number;
    paymentMethod: string | null;
    context: "in_house_folio" | "pay_now";
    lines: {
        name: string;
        quantity: number;
        unitPriceRwf: number;
        lineTotalRwf: number;
        selectedOptions: {
            name: string;
            choices: {
                label: string;
                priceDeltaRwf: number;
            }[];
        }[];
    }[];
    outletName: string;
}>;
export type PlaceOrderResult = z.infer<typeof PlaceOrderResult>;
export declare const GuestOrderList: z.ZodObject<{
    orders: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        orderNumber: z.ZodString;
        status: z.ZodEnum<["submitted", "acknowledged", "in_progress", "ready", "delivered", "completed", "cancelled", "rejected", "pending_payment", "payment_failed"]>;
        outletId: z.ZodString;
        outletName: z.ZodString;
        propertyName: z.ZodString;
        context: z.ZodEnum<["in_house_folio", "pay_now"]>;
        lines: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            quantity: z.ZodNumber;
            unitPriceRwf: z.ZodNumber;
            lineTotalRwf: z.ZodNumber;
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
        }, "strip", z.ZodTypeAny, {
            name: string;
            quantity: number;
            unitPriceRwf: number;
            lineTotalRwf: number;
            selectedOptions: {
                name: string;
                choices: {
                    label: string;
                    priceDeltaRwf: number;
                }[];
            }[];
        }, {
            name: string;
            quantity: number;
            unitPriceRwf: number;
            lineTotalRwf: number;
            selectedOptions: {
                name: string;
                choices: {
                    label: string;
                    priceDeltaRwf: number;
                }[];
            }[];
        }>, "many">;
        subtotalRwf: z.ZodNumber;
        taxRwf: z.ZodNumber;
        totalRwf: z.ZodNumber;
        /** Pay now only: when the money settled, and the RRA means of payment (`01` cash, `06` mobile money). */
        paidAt: z.ZodNullable<z.ZodString>;
        paymentMethod: z.ZodNullable<z.ZodString>;
        /**
         * Whether the guest may still cancel it themselves. A paid order never,
         * because cancelling it is a refund, and that is staff only (D-n).
         */
        cancellable: z.ZodBoolean;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "pending_payment" | "submitted" | "rejected" | "cancelled" | "acknowledged" | "in_progress" | "ready" | "delivered" | "completed" | "payment_failed";
        id: string;
        cancellable: boolean;
        paidAt: string | null;
        createdAt: string;
        propertyName: string;
        totalRwf: number;
        outletId: string;
        orderNumber: string;
        subtotalRwf: number;
        taxRwf: number;
        paymentMethod: string | null;
        context: "in_house_folio" | "pay_now";
        lines: {
            name: string;
            quantity: number;
            unitPriceRwf: number;
            lineTotalRwf: number;
            selectedOptions: {
                name: string;
                choices: {
                    label: string;
                    priceDeltaRwf: number;
                }[];
            }[];
        }[];
        outletName: string;
    }, {
        status: "pending_payment" | "submitted" | "rejected" | "cancelled" | "acknowledged" | "in_progress" | "ready" | "delivered" | "completed" | "payment_failed";
        id: string;
        cancellable: boolean;
        paidAt: string | null;
        createdAt: string;
        propertyName: string;
        totalRwf: number;
        outletId: string;
        orderNumber: string;
        subtotalRwf: number;
        taxRwf: number;
        paymentMethod: string | null;
        context: "in_house_folio" | "pay_now";
        lines: {
            name: string;
            quantity: number;
            unitPriceRwf: number;
            lineTotalRwf: number;
            selectedOptions: {
                name: string;
                choices: {
                    label: string;
                    priceDeltaRwf: number;
                }[];
            }[];
        }[];
        outletName: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    orders: {
        status: "pending_payment" | "submitted" | "rejected" | "cancelled" | "acknowledged" | "in_progress" | "ready" | "delivered" | "completed" | "payment_failed";
        id: string;
        cancellable: boolean;
        paidAt: string | null;
        createdAt: string;
        propertyName: string;
        totalRwf: number;
        outletId: string;
        orderNumber: string;
        subtotalRwf: number;
        taxRwf: number;
        paymentMethod: string | null;
        context: "in_house_folio" | "pay_now";
        lines: {
            name: string;
            quantity: number;
            unitPriceRwf: number;
            lineTotalRwf: number;
            selectedOptions: {
                name: string;
                choices: {
                    label: string;
                    priceDeltaRwf: number;
                }[];
            }[];
        }[];
        outletName: string;
    }[];
}, {
    orders: {
        status: "pending_payment" | "submitted" | "rejected" | "cancelled" | "acknowledged" | "in_progress" | "ready" | "delivered" | "completed" | "payment_failed";
        id: string;
        cancellable: boolean;
        paidAt: string | null;
        createdAt: string;
        propertyName: string;
        totalRwf: number;
        outletId: string;
        orderNumber: string;
        subtotalRwf: number;
        taxRwf: number;
        paymentMethod: string | null;
        context: "in_house_folio" | "pay_now";
        lines: {
            name: string;
            quantity: number;
            unitPriceRwf: number;
            lineTotalRwf: number;
            selectedOptions: {
                name: string;
                choices: {
                    label: string;
                    priceDeltaRwf: number;
                }[];
            }[];
        }[];
        outletName: string;
    }[];
}>;
export type GuestOrderList = z.infer<typeof GuestOrderList>;
export declare const GuestOrderEvent: z.ZodObject<{
    status: z.ZodEnum<["submitted", "acknowledged", "in_progress", "ready", "delivered", "completed", "cancelled", "rejected", "pending_payment", "payment_failed"]>;
    occurredAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "pending_payment" | "submitted" | "rejected" | "cancelled" | "acknowledged" | "in_progress" | "ready" | "delivered" | "completed" | "payment_failed";
    occurredAt: string;
}, {
    status: "pending_payment" | "submitted" | "rejected" | "cancelled" | "acknowledged" | "in_progress" | "ready" | "delivered" | "completed" | "payment_failed";
    occurredAt: string;
}>;
export type GuestOrderEvent = z.infer<typeof GuestOrderEvent>;
/** One order with its trail, as `GET /me/orders/:id` answers it. */
export declare const GuestOrderDetail: z.ZodObject<{
    id: z.ZodString;
    orderNumber: z.ZodString;
    status: z.ZodEnum<["submitted", "acknowledged", "in_progress", "ready", "delivered", "completed", "cancelled", "rejected", "pending_payment", "payment_failed"]>;
    outletId: z.ZodString;
    outletName: z.ZodString;
    propertyName: z.ZodString;
    context: z.ZodEnum<["in_house_folio", "pay_now"]>;
    lines: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        quantity: z.ZodNumber;
        unitPriceRwf: z.ZodNumber;
        lineTotalRwf: z.ZodNumber;
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
    }, "strip", z.ZodTypeAny, {
        name: string;
        quantity: number;
        unitPriceRwf: number;
        lineTotalRwf: number;
        selectedOptions: {
            name: string;
            choices: {
                label: string;
                priceDeltaRwf: number;
            }[];
        }[];
    }, {
        name: string;
        quantity: number;
        unitPriceRwf: number;
        lineTotalRwf: number;
        selectedOptions: {
            name: string;
            choices: {
                label: string;
                priceDeltaRwf: number;
            }[];
        }[];
    }>, "many">;
    subtotalRwf: z.ZodNumber;
    taxRwf: z.ZodNumber;
    totalRwf: z.ZodNumber;
    /** Pay now only: when the money settled, and the RRA means of payment (`01` cash, `06` mobile money). */
    paidAt: z.ZodNullable<z.ZodString>;
    paymentMethod: z.ZodNullable<z.ZodString>;
    /**
     * Whether the guest may still cancel it themselves. A paid order never,
     * because cancelling it is a refund, and that is staff only (D-n).
     */
    cancellable: z.ZodBoolean;
    createdAt: z.ZodString;
} & {
    events: z.ZodArray<z.ZodObject<{
        status: z.ZodEnum<["submitted", "acknowledged", "in_progress", "ready", "delivered", "completed", "cancelled", "rejected", "pending_payment", "payment_failed"]>;
        occurredAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "pending_payment" | "submitted" | "rejected" | "cancelled" | "acknowledged" | "in_progress" | "ready" | "delivered" | "completed" | "payment_failed";
        occurredAt: string;
    }, {
        status: "pending_payment" | "submitted" | "rejected" | "cancelled" | "acknowledged" | "in_progress" | "ready" | "delivered" | "completed" | "payment_failed";
        occurredAt: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    status: "pending_payment" | "submitted" | "rejected" | "cancelled" | "acknowledged" | "in_progress" | "ready" | "delivered" | "completed" | "payment_failed";
    id: string;
    cancellable: boolean;
    paidAt: string | null;
    createdAt: string;
    events: {
        status: "pending_payment" | "submitted" | "rejected" | "cancelled" | "acknowledged" | "in_progress" | "ready" | "delivered" | "completed" | "payment_failed";
        occurredAt: string;
    }[];
    propertyName: string;
    totalRwf: number;
    outletId: string;
    orderNumber: string;
    subtotalRwf: number;
    taxRwf: number;
    paymentMethod: string | null;
    context: "in_house_folio" | "pay_now";
    lines: {
        name: string;
        quantity: number;
        unitPriceRwf: number;
        lineTotalRwf: number;
        selectedOptions: {
            name: string;
            choices: {
                label: string;
                priceDeltaRwf: number;
            }[];
        }[];
    }[];
    outletName: string;
}, {
    status: "pending_payment" | "submitted" | "rejected" | "cancelled" | "acknowledged" | "in_progress" | "ready" | "delivered" | "completed" | "payment_failed";
    id: string;
    cancellable: boolean;
    paidAt: string | null;
    createdAt: string;
    events: {
        status: "pending_payment" | "submitted" | "rejected" | "cancelled" | "acknowledged" | "in_progress" | "ready" | "delivered" | "completed" | "payment_failed";
        occurredAt: string;
    }[];
    propertyName: string;
    totalRwf: number;
    outletId: string;
    orderNumber: string;
    subtotalRwf: number;
    taxRwf: number;
    paymentMethod: string | null;
    context: "in_house_folio" | "pay_now";
    lines: {
        name: string;
        quantity: number;
        unitPriceRwf: number;
        lineTotalRwf: number;
        selectedOptions: {
            name: string;
            choices: {
                label: string;
                priceDeltaRwf: number;
            }[];
        }[];
    }[];
    outletName: string;
}>;
export type GuestOrderDetail = z.infer<typeof GuestOrderDetail>;
//# sourceMappingURL=ordering.d.ts.map