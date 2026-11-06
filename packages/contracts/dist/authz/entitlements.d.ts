import { z } from "zod";
/**
 * Which products a business has switched on, as Injishi staff read and change
 * it (ADR-074 data model, ADR-076 G6 to G8).
 *
 * One OPEN row per org, product and branch (`propertyId` null means every
 * branch). Switching a product off closes a row (`disabledAt`); switching it on
 * opens one. Nothing is deleted, so the closed rows plus one audit row per real
 * change are the history.
 */
export declare const EntitlementSource: z.ZodEnum<["backfill", "registration", "plan", "admin"]>;
export type EntitlementSource = z.infer<typeof EntitlementSource>;
export declare const OrgProductEntitlement: z.ZodObject<{
    id: z.ZodString;
    productId: z.ZodEnum<["account", "admin", "membership", "marketplace", "finance", "pay", "pms", "outlets", "pos", "hr", "residence"]>;
    /** Null means every branch of the business. */
    propertyId: z.ZodNullable<z.ZodString>;
    source: z.ZodEnum<["backfill", "registration", "plan", "admin"]>;
    enabledAt: z.ZodString;
    /** Null while the row is open. */
    disabledAt: z.ZodNullable<z.ZodString>;
    setByUserId: z.ZodNullable<z.ZodString>;
    reason: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    reason: string | null;
    source: "admin" | "registration" | "plan" | "backfill";
    propertyId: string | null;
    productId: "residence" | "finance" | "hr" | "admin" | "membership" | "account" | "marketplace" | "pay" | "pms" | "outlets" | "pos";
    enabledAt: string;
    disabledAt: string | null;
    setByUserId: string | null;
}, {
    id: string;
    reason: string | null;
    source: "admin" | "registration" | "plan" | "backfill";
    propertyId: string | null;
    productId: "residence" | "finance" | "hr" | "admin" | "membership" | "account" | "marketplace" | "pay" | "pms" | "outlets" | "pos";
    enabledAt: string;
    disabledAt: string | null;
    setByUserId: string | null;
}>;
export type OrgProductEntitlement = z.infer<typeof OrgProductEntitlement>;
/** One branch of the business, and whether the product is on there. */
export declare const ProductBranchState: z.ZodObject<{
    propertyId: z.ZodString;
    name: z.ZodString;
    on: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    name: string;
    propertyId: string;
    on: boolean;
}, {
    name: string;
    propertyId: string;
    on: boolean;
}>;
export type ProductBranchState = z.infer<typeof ProductBranchState>;
/** One product, resolved: where it is on, by the same rule the guard uses (ADR-076 G5). */
export declare const ResolvedProductState: z.ZodObject<{
    productId: z.ZodEnum<["account", "admin", "membership", "marketplace", "finance", "pay", "pms", "outlets", "pos", "hr", "residence"]>;
    label: z.ZodString;
    level: z.ZodEnum<["branch", "business", "locked", "none"]>;
    /** True when an open every branch row exists. */
    everyBranch: z.ZodBoolean;
    /** Every active branch of the business, each with its own answer. */
    branches: z.ZodArray<z.ZodObject<{
        propertyId: z.ZodString;
        name: z.ZodString;
        on: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        name: string;
        propertyId: string;
        on: boolean;
    }, {
        name: string;
        propertyId: string;
        on: boolean;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    branches: {
        name: string;
        propertyId: string;
        on: boolean;
    }[];
    label: string;
    level: "business" | "none" | "branch" | "locked";
    productId: "residence" | "finance" | "hr" | "admin" | "membership" | "account" | "marketplace" | "pay" | "pms" | "outlets" | "pos";
    everyBranch: boolean;
}, {
    branches: {
        name: string;
        propertyId: string;
        on: boolean;
    }[];
    label: string;
    level: "business" | "none" | "branch" | "locked";
    productId: "residence" | "finance" | "hr" | "admin" | "membership" | "account" | "marketplace" | "pay" | "pms" | "outlets" | "pos";
    everyBranch: boolean;
}>;
export type ResolvedProductState = z.infer<typeof ResolvedProductState>;
export declare const OrgProductsView: z.ZodObject<{
    orgId: z.ZodString;
    /** Open and closed rows, newest first. */
    rows: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        productId: z.ZodEnum<["account", "admin", "membership", "marketplace", "finance", "pay", "pms", "outlets", "pos", "hr", "residence"]>;
        /** Null means every branch of the business. */
        propertyId: z.ZodNullable<z.ZodString>;
        source: z.ZodEnum<["backfill", "registration", "plan", "admin"]>;
        enabledAt: z.ZodString;
        /** Null while the row is open. */
        disabledAt: z.ZodNullable<z.ZodString>;
        setByUserId: z.ZodNullable<z.ZodString>;
        reason: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        reason: string | null;
        source: "admin" | "registration" | "plan" | "backfill";
        propertyId: string | null;
        productId: "residence" | "finance" | "hr" | "admin" | "membership" | "account" | "marketplace" | "pay" | "pms" | "outlets" | "pos";
        enabledAt: string;
        disabledAt: string | null;
        setByUserId: string | null;
    }, {
        id: string;
        reason: string | null;
        source: "admin" | "registration" | "plan" | "backfill";
        propertyId: string | null;
        productId: "residence" | "finance" | "hr" | "admin" | "membership" | "account" | "marketplace" | "pay" | "pms" | "outlets" | "pos";
        enabledAt: string;
        disabledAt: string | null;
        setByUserId: string | null;
    }>, "many">;
    /** Every product a business can hold, in `ProductId` order. */
    resolved: z.ZodArray<z.ZodObject<{
        productId: z.ZodEnum<["account", "admin", "membership", "marketplace", "finance", "pay", "pms", "outlets", "pos", "hr", "residence"]>;
        label: z.ZodString;
        level: z.ZodEnum<["branch", "business", "locked", "none"]>;
        /** True when an open every branch row exists. */
        everyBranch: z.ZodBoolean;
        /** Every active branch of the business, each with its own answer. */
        branches: z.ZodArray<z.ZodObject<{
            propertyId: z.ZodString;
            name: z.ZodString;
            on: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            name: string;
            propertyId: string;
            on: boolean;
        }, {
            name: string;
            propertyId: string;
            on: boolean;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        branches: {
            name: string;
            propertyId: string;
            on: boolean;
        }[];
        label: string;
        level: "business" | "none" | "branch" | "locked";
        productId: "residence" | "finance" | "hr" | "admin" | "membership" | "account" | "marketplace" | "pay" | "pms" | "outlets" | "pos";
        everyBranch: boolean;
    }, {
        branches: {
            name: string;
            propertyId: string;
            on: boolean;
        }[];
        label: string;
        level: "business" | "none" | "branch" | "locked";
        productId: "residence" | "finance" | "hr" | "admin" | "membership" | "account" | "marketplace" | "pay" | "pms" | "outlets" | "pos";
        everyBranch: boolean;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    orgId: string;
    rows: {
        id: string;
        reason: string | null;
        source: "admin" | "registration" | "plan" | "backfill";
        propertyId: string | null;
        productId: "residence" | "finance" | "hr" | "admin" | "membership" | "account" | "marketplace" | "pay" | "pms" | "outlets" | "pos";
        enabledAt: string;
        disabledAt: string | null;
        setByUserId: string | null;
    }[];
    resolved: {
        branches: {
            name: string;
            propertyId: string;
            on: boolean;
        }[];
        label: string;
        level: "business" | "none" | "branch" | "locked";
        productId: "residence" | "finance" | "hr" | "admin" | "membership" | "account" | "marketplace" | "pay" | "pms" | "outlets" | "pos";
        everyBranch: boolean;
    }[];
}, {
    orgId: string;
    rows: {
        id: string;
        reason: string | null;
        source: "admin" | "registration" | "plan" | "backfill";
        propertyId: string | null;
        productId: "residence" | "finance" | "hr" | "admin" | "membership" | "account" | "marketplace" | "pay" | "pms" | "outlets" | "pos";
        enabledAt: string;
        disabledAt: string | null;
        setByUserId: string | null;
    }[];
    resolved: {
        branches: {
            name: string;
            propertyId: string;
            on: boolean;
        }[];
        label: string;
        level: "business" | "none" | "branch" | "locked";
        productId: "residence" | "finance" | "hr" | "admin" | "membership" | "account" | "marketplace" | "pay" | "pms" | "outlets" | "pos";
        everyBranch: boolean;
    }[];
}>;
export type OrgProductsView = z.infer<typeof OrgProductsView>;
/** A reason must say something a person can act on later. */
export declare const ENTITLEMENT_REASON_MIN_LENGTH = 10;
/**
 * Set where a product is on (`PUT /api/v1/admin/orgs/:orgId/products/:productId`).
 *
 * `branchIds: null` means every branch. `state: "off"` with a branch list
 * switches it off at those branches only; with `null` it switches it off for
 * the whole business. A business level product refuses a branch list, and
 * `account` refuses `off`. Those refusals, and a reason shorter than
 * `ENTITLEMENT_REASON_MIN_LENGTH`, come from the server with the codes below
 * (422 `reason_required` for the reason), so this schema checks only the shape.
 */
export declare const SetOrgProductRequest: z.ZodObject<{
    branchIds: z.ZodNullable<z.ZodArray<z.ZodString, "many">>;
    state: z.ZodEnum<["on", "off"]>;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    state: "on" | "off";
    reason: string;
    branchIds: string[] | null;
}, {
    state: "on" | "off";
    reason: string;
    branchIds: string[] | null;
}>;
export type SetOrgProductRequest = z.infer<typeof SetOrgProductRequest>;
export declare const SetOrgProductResult: z.ZodObject<{
    /** False when the request asked for what was already true: nothing was written. */
    changed: z.ZodBoolean;
    /** The product's open rows after the change. */
    open: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        productId: z.ZodEnum<["account", "admin", "membership", "marketplace", "finance", "pay", "pms", "outlets", "pos", "hr", "residence"]>;
        /** Null means every branch of the business. */
        propertyId: z.ZodNullable<z.ZodString>;
        source: z.ZodEnum<["backfill", "registration", "plan", "admin"]>;
        enabledAt: z.ZodString;
        /** Null while the row is open. */
        disabledAt: z.ZodNullable<z.ZodString>;
        setByUserId: z.ZodNullable<z.ZodString>;
        reason: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        reason: string | null;
        source: "admin" | "registration" | "plan" | "backfill";
        propertyId: string | null;
        productId: "residence" | "finance" | "hr" | "admin" | "membership" | "account" | "marketplace" | "pay" | "pms" | "outlets" | "pos";
        enabledAt: string;
        disabledAt: string | null;
        setByUserId: string | null;
    }, {
        id: string;
        reason: string | null;
        source: "admin" | "registration" | "plan" | "backfill";
        propertyId: string | null;
        productId: "residence" | "finance" | "hr" | "admin" | "membership" | "account" | "marketplace" | "pay" | "pms" | "outlets" | "pos";
        enabledAt: string;
        disabledAt: string | null;
        setByUserId: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    open: {
        id: string;
        reason: string | null;
        source: "admin" | "registration" | "plan" | "backfill";
        propertyId: string | null;
        productId: "residence" | "finance" | "hr" | "admin" | "membership" | "account" | "marketplace" | "pay" | "pms" | "outlets" | "pos";
        enabledAt: string;
        disabledAt: string | null;
        setByUserId: string | null;
    }[];
    changed: boolean;
}, {
    open: {
        id: string;
        reason: string | null;
        source: "admin" | "registration" | "plan" | "backfill";
        propertyId: string | null;
        productId: "residence" | "finance" | "hr" | "admin" | "membership" | "account" | "marketplace" | "pay" | "pms" | "outlets" | "pos";
        enabledAt: string;
        disabledAt: string | null;
        setByUserId: string | null;
    }[];
    changed: boolean;
}>;
export type SetOrgProductResult = z.infer<typeof SetOrgProductResult>;
/** Why a change was refused (ADR-076 G6, G7). */
export declare const EntitlementRefusalCode: z.ZodEnum<["entitlement_level", "entitlement_locked", "branch_invalid", "reason_required", "product_in_use"]>;
export type EntitlementRefusalCode = z.infer<typeof EntitlementRefusalCode>;
/**
 * One piece of open work that keeps a product on (ADR-076 G7), following
 * ADR-054's archive refusal: a guest in house, a booking still to arrive, an
 * open bill, an order not finished, a table still seated, a till shift still
 * open, a draft pay run, a lease that holds a unit, a payout still to go out,
 * a broker's placement still open or a broker's fee still owed.
 */
export declare const ProductInUseKind: z.ZodEnum<["guest_in_house", "booking_upcoming", "folio_open", "order_open", "pos_order_open", "table_session_open", "cashier_shift_open", "pay_run_draft", "lease_holds_unit", "payout_pending", "placement_open", "placement_fee_pending"]>;
export type ProductInUseKind = z.infer<typeof ProductInUseKind>;
export declare const ProductInUseReason: z.ZodObject<{
    kind: z.ZodEnum<["guest_in_house", "booking_upcoming", "folio_open", "order_open", "pos_order_open", "table_session_open", "cashier_shift_open", "pay_run_draft", "lease_holds_unit", "payout_pending", "placement_open", "placement_fee_pending"]>;
    /** The branch it sits at, or null for business wide work (a pay run). */
    propertyId: z.ZodNullable<z.ZodString>;
    count: z.ZodNumber;
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
    count: number;
    kind: "guest_in_house" | "booking_upcoming" | "folio_open" | "order_open" | "pos_order_open" | "table_session_open" | "cashier_shift_open" | "pay_run_draft" | "lease_holds_unit" | "payout_pending" | "placement_open" | "placement_fee_pending";
    propertyId: string | null;
}, {
    message: string;
    count: number;
    kind: "guest_in_house" | "booking_upcoming" | "folio_open" | "order_open" | "pos_order_open" | "table_session_open" | "cashier_shift_open" | "pay_run_draft" | "lease_holds_unit" | "payout_pending" | "placement_open" | "placement_fee_pending";
    propertyId: string | null;
}>;
export type ProductInUseReason = z.infer<typeof ProductInUseReason>;
//# sourceMappingURL=entitlements.d.ts.map