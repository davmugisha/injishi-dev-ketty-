import { z } from "zod";
/**
 * Customers of the bar and restaurant (CRM, phase 1).
 *
 * A customer belongs to the BUSINESS (the workspace), not to one outlet: the person who eats at the
 * lakeside outlet on Friday is the same person at the Kimihurura outlet on Saturday. Which outlets a
 * staff member may SEE of that person's history is still decided by their branch scope.
 *
 * THE PHONE IS THE KEY. A customer is found, de-duplicated and (later) verified by phone, stored in E.164:
 * a Rwandan mobile however it was typed (`0788 123 456`), or a visitor's number with its `+` code. It is
 * validated here by the very function the guest registry uses, so the POS and the hotel cannot disagree
 * about what a number is. Two spellings of one number can never be two customers: the API normalises
 * first, and the database holds a unique index on the normalised value.
 *
 * WHAT A ROLE SEES. Everyone with `customer.view` can find and read a customer. Only `customer.manage`
 * reads the full phone and email; everybody else gets them masked, and can only LOOK UP (a search of at
 * least `CUSTOMER_SEARCH_MIN` characters), never list the whole book.
 */
/** The shortest search that is allowed to a role that may look customers up but not browse them. */
export declare const CUSTOMER_SEARCH_MIN = 3;
export declare const CUSTOMER_PAGE_SIZE = 25;
export declare const CUSTOMER_PAGE_MAX = 100;
/** A customer's phone, normalised to E.164 on the way in. */
export declare const CustomerPhone: z.ZodPipeline<z.ZodEffects<z.ZodString, string | null, string>, z.ZodString>;
export type CustomerPhone = z.infer<typeof CustomerPhone>;
export declare const CustomerName: z.ZodString;
/** An email, or nothing: a blank field is "no email", not an invalid one. */
export declare const CustomerEmail: z.ZodEffects<z.ZodNullable<z.ZodString>, string | null, unknown>;
/** Where a customer first came from. Phase 1 writes `pos` and `import`; the others are reserved for later phases. */
export declare const CustomerSource: z.ZodEnum<["pos", "qr", "reservation", "import"]>;
export type CustomerSource = z.infer<typeof CustomerSource>;
export declare const CustomerStatus: z.ZodEnum<["active", "merged", "erased"]>;
export type CustomerStatus = z.infer<typeof CustomerStatus>;
/**
 * `+250788123456` -> `+250******456`: the country code and the last three digits stay, so a person can
 * tell two customers apart on the screen without the number being copyable.
 */
export declare function maskCustomerPhone(e164: string): string;
/** `jean@example.com` -> `j***@example.com`. */
export declare function maskCustomerEmail(email: string): string;
export declare const CreateCustomerRequest: z.ZodObject<{
    fullName: z.ZodString;
    phone: z.ZodPipeline<z.ZodEffects<z.ZodString, string | null, string>, z.ZodString>;
    email: z.ZodOptional<z.ZodEffects<z.ZodNullable<z.ZodString>, string | null, unknown>>;
    /** The staff member confirms the customer agreed to be contacted with offers. Never assumed. */
    marketingConsent: z.ZodDefault<z.ZodBoolean>;
    notes: z.ZodOptional<z.ZodEffects<z.ZodNullable<z.ZodString>, string | null, unknown>>;
}, "strip", z.ZodTypeAny, {
    fullName: string;
    phone: string;
    marketingConsent: boolean;
    email?: string | null | undefined;
    notes?: string | null | undefined;
}, {
    fullName: string;
    phone: string;
    email?: unknown;
    notes?: unknown;
    marketingConsent?: boolean | undefined;
}>;
export type CreateCustomerRequest = z.infer<typeof CreateCustomerRequest>;
export declare const UpdateCustomerRequest: z.ZodEffects<z.ZodObject<{
    fullName: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, string | null, string>, z.ZodString>>;
    email: z.ZodOptional<z.ZodEffects<z.ZodNullable<z.ZodString>, string | null, unknown>>;
    marketingConsent: z.ZodOptional<z.ZodBoolean>;
    notes: z.ZodOptional<z.ZodEffects<z.ZodNullable<z.ZodString>, string | null, unknown>>;
}, "strip", z.ZodTypeAny, {
    fullName?: string | undefined;
    email?: string | null | undefined;
    notes?: string | null | undefined;
    phone?: string | undefined;
    marketingConsent?: boolean | undefined;
}, {
    fullName?: string | undefined;
    email?: unknown;
    notes?: unknown;
    phone?: string | undefined;
    marketingConsent?: boolean | undefined;
}>, {
    fullName?: string | undefined;
    email?: string | null | undefined;
    notes?: string | null | undefined;
    phone?: string | undefined;
    marketingConsent?: boolean | undefined;
}, {
    fullName?: string | undefined;
    email?: unknown;
    notes?: unknown;
    phone?: string | undefined;
    marketingConsent?: boolean | undefined;
}>;
export type UpdateCustomerRequest = z.infer<typeof UpdateCustomerRequest>;
export declare const CustomerListQuery: z.ZodObject<{
    q: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    offset: number;
    limit: number;
    q?: string | undefined;
}, {
    q?: string | undefined;
    offset?: number | undefined;
    limit?: number | undefined;
}>;
export type CustomerListQuery = z.infer<typeof CustomerListQuery>;
/** Put a customer on an order, or take them off it (`customerId: null`). */
export declare const AttachCustomerRequest: z.ZodObject<{
    customerId: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    customerId: string | null;
}, {
    customerId: string | null;
}>;
export type AttachCustomerRequest = z.infer<typeof AttachCustomerRequest>;
/** Fold a duplicate (`:id`) into the customer it really is. The duplicate stops being listed; its orders move. */
export declare const MergeCustomersRequest: z.ZodObject<{
    intoCustomerId: z.ZodString;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
    intoCustomerId: string;
}, {
    reason: string;
    intoCustomerId: string;
}>;
export type MergeCustomersRequest = z.infer<typeof MergeCustomersRequest>;
/** Erase a customer's personal details (the right to be forgotten). Orders and money stay, anonymised. */
export declare const EraseCustomerRequest: z.ZodObject<{
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
}, {
    reason: string;
}>;
export type EraseCustomerRequest = z.infer<typeof EraseCustomerRequest>;
export declare const CustomerSummary: z.ZodObject<{
    id: z.ZodString;
    fullName: z.ZodString;
    /** The full number for `customer.manage`, otherwise masked. */
    phone: z.ZodString;
    email: z.ZodNullable<z.ZodString>;
    /** True when `phone` and `email` are masked for this reader. */
    contactHidden: z.ZodBoolean;
    marketingConsent: z.ZodBoolean;
    source: z.ZodEnum<["pos", "qr", "reservation", "import"]>;
    visitCount: z.ZodNumber;
    lifetimeSpendRwf: z.ZodNumber;
    lastVisitAt: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    fullName: string;
    email: string | null;
    source: "import" | "pos" | "qr" | "reservation";
    phone: string;
    createdAt: string;
    marketingConsent: boolean;
    contactHidden: boolean;
    visitCount: number;
    lifetimeSpendRwf: number;
    lastVisitAt: string | null;
}, {
    id: string;
    fullName: string;
    email: string | null;
    source: "import" | "pos" | "qr" | "reservation";
    phone: string;
    createdAt: string;
    marketingConsent: boolean;
    contactHidden: boolean;
    visitCount: number;
    lifetimeSpendRwf: number;
    lastVisitAt: string | null;
}>;
export type CustomerSummary = z.infer<typeof CustomerSummary>;
export declare const CustomerList: z.ZodObject<{
    customers: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        fullName: z.ZodString;
        /** The full number for `customer.manage`, otherwise masked. */
        phone: z.ZodString;
        email: z.ZodNullable<z.ZodString>;
        /** True when `phone` and `email` are masked for this reader. */
        contactHidden: z.ZodBoolean;
        marketingConsent: z.ZodBoolean;
        source: z.ZodEnum<["pos", "qr", "reservation", "import"]>;
        visitCount: z.ZodNumber;
        lifetimeSpendRwf: z.ZodNumber;
        lastVisitAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        fullName: string;
        email: string | null;
        source: "import" | "pos" | "qr" | "reservation";
        phone: string;
        createdAt: string;
        marketingConsent: boolean;
        contactHidden: boolean;
        visitCount: number;
        lifetimeSpendRwf: number;
        lastVisitAt: string | null;
    }, {
        id: string;
        fullName: string;
        email: string | null;
        source: "import" | "pos" | "qr" | "reservation";
        phone: string;
        createdAt: string;
        marketingConsent: boolean;
        contactHidden: boolean;
        visitCount: number;
        lifetimeSpendRwf: number;
        lastVisitAt: string | null;
    }>, "many">;
    total: z.ZodNumber;
    limit: z.ZodNumber;
    offset: z.ZodNumber;
    /** The reader may look customers up but not browse them, and has not typed enough to search. */
    searchRequired: z.ZodBoolean;
    contactHidden: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    total: number;
    offset: number;
    limit: number;
    contactHidden: boolean;
    customers: {
        id: string;
        fullName: string;
        email: string | null;
        source: "import" | "pos" | "qr" | "reservation";
        phone: string;
        createdAt: string;
        marketingConsent: boolean;
        contactHidden: boolean;
        visitCount: number;
        lifetimeSpendRwf: number;
        lastVisitAt: string | null;
    }[];
    searchRequired: boolean;
}, {
    total: number;
    offset: number;
    limit: number;
    contactHidden: boolean;
    customers: {
        id: string;
        fullName: string;
        email: string | null;
        source: "import" | "pos" | "qr" | "reservation";
        phone: string;
        createdAt: string;
        marketingConsent: boolean;
        contactHidden: boolean;
        visitCount: number;
        lifetimeSpendRwf: number;
        lastVisitAt: string | null;
    }[];
    searchRequired: boolean;
}>;
export type CustomerList = z.infer<typeof CustomerList>;
/** One of a customer's orders, as the profile lists it. */
export declare const CustomerOrderRow: z.ZodObject<{
    orderId: z.ZodString;
    orderNumber: z.ZodString;
    outletName: z.ZodString;
    orderType: z.ZodEnum<["dine_in", "takeaway", "delivery", "room_service", "event"]>;
    tableLabel: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<["draft", "submitted", "in_progress", "ready", "delivered", "completed", "cancelled"]>;
    totalRwf: z.ZodNumber;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "submitted" | "cancelled" | "draft" | "in_progress" | "ready" | "delivered" | "completed";
    createdAt: string;
    totalRwf: number;
    orderNumber: string;
    orderId: string;
    orderType: "dine_in" | "takeaway" | "delivery" | "room_service" | "event";
    tableLabel: string | null;
    outletName: string;
}, {
    status: "submitted" | "cancelled" | "draft" | "in_progress" | "ready" | "delivered" | "completed";
    createdAt: string;
    totalRwf: number;
    orderNumber: string;
    orderId: string;
    orderType: "dine_in" | "takeaway" | "delivery" | "room_service" | "event";
    tableLabel: string | null;
    outletName: string;
}>;
export type CustomerOrderRow = z.infer<typeof CustomerOrderRow>;
export declare const CustomerProfile: z.ZodObject<{
    id: z.ZodString;
    fullName: z.ZodString;
    /** The full number for `customer.manage`, otherwise masked. */
    phone: z.ZodString;
    email: z.ZodNullable<z.ZodString>;
    /** True when `phone` and `email` are masked for this reader. */
    contactHidden: z.ZodBoolean;
    marketingConsent: z.ZodBoolean;
    source: z.ZodEnum<["pos", "qr", "reservation", "import"]>;
    visitCount: z.ZodNumber;
    lifetimeSpendRwf: z.ZodNumber;
    lastVisitAt: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
} & {
    notes: z.ZodNullable<z.ZodString>;
    consentAt: z.ZodNullable<z.ZodString>;
    consentSource: z.ZodNullable<z.ZodString>;
    phoneVerifiedAt: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<["active", "merged", "erased"]>;
    /** Newest first, only at the outlets the reader's branch scope covers. */
    orders: z.ZodArray<z.ZodObject<{
        orderId: z.ZodString;
        orderNumber: z.ZodString;
        outletName: z.ZodString;
        orderType: z.ZodEnum<["dine_in", "takeaway", "delivery", "room_service", "event"]>;
        tableLabel: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<["draft", "submitted", "in_progress", "ready", "delivered", "completed", "cancelled"]>;
        totalRwf: z.ZodNumber;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "submitted" | "cancelled" | "draft" | "in_progress" | "ready" | "delivered" | "completed";
        createdAt: string;
        totalRwf: number;
        orderNumber: string;
        orderId: string;
        orderType: "dine_in" | "takeaway" | "delivery" | "room_service" | "event";
        tableLabel: string | null;
        outletName: string;
    }, {
        status: "submitted" | "cancelled" | "draft" | "in_progress" | "ready" | "delivered" | "completed";
        createdAt: string;
        totalRwf: number;
        orderNumber: string;
        orderId: string;
        orderType: "dine_in" | "takeaway" | "delivery" | "room_service" | "event";
        tableLabel: string | null;
        outletName: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    status: "active" | "merged" | "erased";
    id: string;
    fullName: string;
    email: string | null;
    notes: string | null;
    source: "import" | "pos" | "qr" | "reservation";
    phone: string;
    createdAt: string;
    orders: {
        status: "submitted" | "cancelled" | "draft" | "in_progress" | "ready" | "delivered" | "completed";
        createdAt: string;
        totalRwf: number;
        orderNumber: string;
        orderId: string;
        orderType: "dine_in" | "takeaway" | "delivery" | "room_service" | "event";
        tableLabel: string | null;
        outletName: string;
    }[];
    marketingConsent: boolean;
    contactHidden: boolean;
    visitCount: number;
    lifetimeSpendRwf: number;
    lastVisitAt: string | null;
    consentAt: string | null;
    consentSource: string | null;
    phoneVerifiedAt: string | null;
}, {
    status: "active" | "merged" | "erased";
    id: string;
    fullName: string;
    email: string | null;
    notes: string | null;
    source: "import" | "pos" | "qr" | "reservation";
    phone: string;
    createdAt: string;
    orders: {
        status: "submitted" | "cancelled" | "draft" | "in_progress" | "ready" | "delivered" | "completed";
        createdAt: string;
        totalRwf: number;
        orderNumber: string;
        orderId: string;
        orderType: "dine_in" | "takeaway" | "delivery" | "room_service" | "event";
        tableLabel: string | null;
        outletName: string;
    }[];
    marketingConsent: boolean;
    contactHidden: boolean;
    visitCount: number;
    lifetimeSpendRwf: number;
    lastVisitAt: string | null;
    consentAt: string | null;
    consentSource: string | null;
    phoneVerifiedAt: string | null;
}>;
export type CustomerProfile = z.infer<typeof CustomerProfile>;
/** Everything held about one customer, for the person who asks to see it. */
export declare const CustomerExport: z.ZodObject<{
    exportedAt: z.ZodString;
    customer: z.ZodObject<{
        id: z.ZodString;
        fullName: z.ZodString;
        /** The full number for `customer.manage`, otherwise masked. */
        phone: z.ZodString;
        email: z.ZodNullable<z.ZodString>;
        /** True when `phone` and `email` are masked for this reader. */
        contactHidden: z.ZodBoolean;
        marketingConsent: z.ZodBoolean;
        source: z.ZodEnum<["pos", "qr", "reservation", "import"]>;
        visitCount: z.ZodNumber;
        lifetimeSpendRwf: z.ZodNumber;
        lastVisitAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    } & {
        notes: z.ZodNullable<z.ZodString>;
        consentAt: z.ZodNullable<z.ZodString>;
        consentSource: z.ZodNullable<z.ZodString>;
        phoneVerifiedAt: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<["active", "merged", "erased"]>;
        /** Newest first, only at the outlets the reader's branch scope covers. */
        orders: z.ZodArray<z.ZodObject<{
            orderId: z.ZodString;
            orderNumber: z.ZodString;
            outletName: z.ZodString;
            orderType: z.ZodEnum<["dine_in", "takeaway", "delivery", "room_service", "event"]>;
            tableLabel: z.ZodNullable<z.ZodString>;
            status: z.ZodEnum<["draft", "submitted", "in_progress", "ready", "delivered", "completed", "cancelled"]>;
            totalRwf: z.ZodNumber;
            createdAt: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            status: "submitted" | "cancelled" | "draft" | "in_progress" | "ready" | "delivered" | "completed";
            createdAt: string;
            totalRwf: number;
            orderNumber: string;
            orderId: string;
            orderType: "dine_in" | "takeaway" | "delivery" | "room_service" | "event";
            tableLabel: string | null;
            outletName: string;
        }, {
            status: "submitted" | "cancelled" | "draft" | "in_progress" | "ready" | "delivered" | "completed";
            createdAt: string;
            totalRwf: number;
            orderNumber: string;
            orderId: string;
            orderType: "dine_in" | "takeaway" | "delivery" | "room_service" | "event";
            tableLabel: string | null;
            outletName: string;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "merged" | "erased";
        id: string;
        fullName: string;
        email: string | null;
        notes: string | null;
        source: "import" | "pos" | "qr" | "reservation";
        phone: string;
        createdAt: string;
        orders: {
            status: "submitted" | "cancelled" | "draft" | "in_progress" | "ready" | "delivered" | "completed";
            createdAt: string;
            totalRwf: number;
            orderNumber: string;
            orderId: string;
            orderType: "dine_in" | "takeaway" | "delivery" | "room_service" | "event";
            tableLabel: string | null;
            outletName: string;
        }[];
        marketingConsent: boolean;
        contactHidden: boolean;
        visitCount: number;
        lifetimeSpendRwf: number;
        lastVisitAt: string | null;
        consentAt: string | null;
        consentSource: string | null;
        phoneVerifiedAt: string | null;
    }, {
        status: "active" | "merged" | "erased";
        id: string;
        fullName: string;
        email: string | null;
        notes: string | null;
        source: "import" | "pos" | "qr" | "reservation";
        phone: string;
        createdAt: string;
        orders: {
            status: "submitted" | "cancelled" | "draft" | "in_progress" | "ready" | "delivered" | "completed";
            createdAt: string;
            totalRwf: number;
            orderNumber: string;
            orderId: string;
            orderType: "dine_in" | "takeaway" | "delivery" | "room_service" | "event";
            tableLabel: string | null;
            outletName: string;
        }[];
        marketingConsent: boolean;
        contactHidden: boolean;
        visitCount: number;
        lifetimeSpendRwf: number;
        lastVisitAt: string | null;
        consentAt: string | null;
        consentSource: string | null;
        phoneVerifiedAt: string | null;
    }>;
    audit: z.ZodArray<z.ZodObject<{
        action: z.ZodString;
        at: z.ZodString;
        reason: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        reason: string | null;
        at: string;
        action: string;
    }, {
        reason: string | null;
        at: string;
        action: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    customer: {
        status: "active" | "merged" | "erased";
        id: string;
        fullName: string;
        email: string | null;
        notes: string | null;
        source: "import" | "pos" | "qr" | "reservation";
        phone: string;
        createdAt: string;
        orders: {
            status: "submitted" | "cancelled" | "draft" | "in_progress" | "ready" | "delivered" | "completed";
            createdAt: string;
            totalRwf: number;
            orderNumber: string;
            orderId: string;
            orderType: "dine_in" | "takeaway" | "delivery" | "room_service" | "event";
            tableLabel: string | null;
            outletName: string;
        }[];
        marketingConsent: boolean;
        contactHidden: boolean;
        visitCount: number;
        lifetimeSpendRwf: number;
        lastVisitAt: string | null;
        consentAt: string | null;
        consentSource: string | null;
        phoneVerifiedAt: string | null;
    };
    exportedAt: string;
    audit: {
        reason: string | null;
        at: string;
        action: string;
    }[];
}, {
    customer: {
        status: "active" | "merged" | "erased";
        id: string;
        fullName: string;
        email: string | null;
        notes: string | null;
        source: "import" | "pos" | "qr" | "reservation";
        phone: string;
        createdAt: string;
        orders: {
            status: "submitted" | "cancelled" | "draft" | "in_progress" | "ready" | "delivered" | "completed";
            createdAt: string;
            totalRwf: number;
            orderNumber: string;
            orderId: string;
            orderType: "dine_in" | "takeaway" | "delivery" | "room_service" | "event";
            tableLabel: string | null;
            outletName: string;
        }[];
        marketingConsent: boolean;
        contactHidden: boolean;
        visitCount: number;
        lifetimeSpendRwf: number;
        lastVisitAt: string | null;
        consentAt: string | null;
        consentSource: string | null;
        phoneVerifiedAt: string | null;
    };
    exportedAt: string;
    audit: {
        reason: string | null;
        at: string;
        action: string;
    }[];
}>;
export type CustomerExport = z.infer<typeof CustomerExport>;
//# sourceMappingURL=customers.d.ts.map