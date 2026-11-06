import { z } from "zod";
import { Uuid } from "../primitives";
import { EntitlementLevel, ProductId } from "./products";
/**
 * Which products a business has switched on, as Injishi staff read and change
 * it (ADR-074 data model, ADR-076 G6 to G8).
 *
 * One OPEN row per org, product and branch (`propertyId` null means every
 * branch). Switching a product off closes a row (`disabledAt`); switching it on
 * opens one. Nothing is deleted, so the closed rows plus one audit row per real
 * change are the history.
 */
export const EntitlementSource = z.enum(["backfill", "registration", "plan", "admin"]);
export type EntitlementSource = z.infer<typeof EntitlementSource>;
export const OrgProductEntitlement = z.object({
    id: Uuid,
    productId: ProductId,
    /** Null means every branch of the business. */
    propertyId: Uuid.nullable(),
    source: EntitlementSource,
    enabledAt: z.string(),
    /** Null while the row is open. */
    disabledAt: z.string().nullable(),
    setByUserId: Uuid.nullable(),
    reason: z.string().nullable(),
});
export type OrgProductEntitlement = z.infer<typeof OrgProductEntitlement>;
/** One branch of the business, and whether the product is on there. */
export const ProductBranchState = z.object({
    propertyId: Uuid,
    name: z.string(),
    on: z.boolean(),
});
export type ProductBranchState = z.infer<typeof ProductBranchState>;
/** One product, resolved: where it is on, by the same rule the guard uses (ADR-076 G5). */
export const ResolvedProductState = z.object({
    productId: ProductId,
    label: z.string(),
    level: EntitlementLevel,
    /** True when an open every branch row exists. */
    everyBranch: z.boolean(),
    /** Every active branch of the business, each with its own answer. */
    branches: z.array(ProductBranchState),
});
export type ResolvedProductState = z.infer<typeof ResolvedProductState>;
export const OrgProductsView = z.object({
    orgId: Uuid,
    /** Open and closed rows, newest first. */
    rows: z.array(OrgProductEntitlement),
    /** Every product a business can hold, in `ProductId` order. */
    resolved: z.array(ResolvedProductState),
});
export type OrgProductsView = z.infer<typeof OrgProductsView>;
/** A reason must say something a person can act on later. */
export const ENTITLEMENT_REASON_MIN_LENGTH = 10;
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
export const SetOrgProductRequest = z.object({
    branchIds: z.array(Uuid).min(1).max(200).nullable(),
    state: z.enum(["on", "off"]),
    reason: z.string().trim().max(500),
});
export type SetOrgProductRequest = z.infer<typeof SetOrgProductRequest>;
export const SetOrgProductResult = z.object({
    /** False when the request asked for what was already true: nothing was written. */
    changed: z.boolean(),
    /** The product's open rows after the change. */
    open: z.array(OrgProductEntitlement),
});
export type SetOrgProductResult = z.infer<typeof SetOrgProductResult>;
/** Why a change was refused (ADR-076 G6, G7). */
export const EntitlementRefusalCode = z.enum([
    "entitlement_level",
    "entitlement_locked",
    "branch_invalid",
    "reason_required",
    "product_in_use",
]);
export type EntitlementRefusalCode = z.infer<typeof EntitlementRefusalCode>;
/**
 * One piece of open work that keeps a product on (ADR-076 G7), following
 * ADR-054's archive refusal: a guest in house, a booking still to arrive, an
 * open bill, an order not finished, a table still seated, a till shift still
 * open, a draft pay run, a lease that holds a unit, a payout still to go out,
 * a broker's placement still open or a broker's fee still owed.
 */
export const ProductInUseKind = z.enum([
    "guest_in_house",
    "booking_upcoming",
    "folio_open",
    "order_open",
    "pos_order_open",
    "table_session_open",
    "cashier_shift_open",
    "pay_run_draft",
    "lease_holds_unit",
    "payout_pending",
    "placement_open",
    "placement_fee_pending",
]);
export type ProductInUseKind = z.infer<typeof ProductInUseKind>;
export const ProductInUseReason = z.object({
    kind: ProductInUseKind,
    /** The branch it sits at, or null for business wide work (a pay run). */
    propertyId: Uuid.nullable(),
    count: z.number().int().positive(),
    message: z.string(),
});
export type ProductInUseReason = z.infer<typeof ProductInUseReason>;
