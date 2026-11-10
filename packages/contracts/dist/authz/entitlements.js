"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductInUseReason = exports.ProductInUseKind = exports.EntitlementRefusalCode = exports.SetOrgProductResult = exports.SetOrgProductRequest = exports.ENTITLEMENT_REASON_MIN_LENGTH = exports.OrgProductsView = exports.ResolvedProductState = exports.ProductBranchState = exports.OrgProductEntitlement = exports.EntitlementSource = void 0;
const zod_1 = require("zod");
const primitives_1 = require("../primitives");
const products_1 = require("./products");
/**
 * Which products a business has switched on, as Injishi staff read and change
 * it (ADR-074 data model, ADR-076 G6 to G8).
 *
 * One OPEN row per org, product and branch (`propertyId` null means every
 * branch). Switching a product off closes a row (`disabledAt`); switching it on
 * opens one. Nothing is deleted, so the closed rows plus one audit row per real
 * change are the history.
 */
exports.EntitlementSource = zod_1.z.enum(["backfill", "registration", "plan", "admin"]);
exports.OrgProductEntitlement = zod_1.z.object({
    id: primitives_1.Uuid,
    productId: products_1.ProductId,
    /** Null means every branch of the business. */
    propertyId: primitives_1.Uuid.nullable(),
    source: exports.EntitlementSource,
    enabledAt: zod_1.z.string(),
    /** Null while the row is open. */
    disabledAt: zod_1.z.string().nullable(),
    setByUserId: primitives_1.Uuid.nullable(),
    reason: zod_1.z.string().nullable(),
});
/** One branch of the business, and whether the product is on there. */
exports.ProductBranchState = zod_1.z.object({
    propertyId: primitives_1.Uuid,
    name: zod_1.z.string(),
    on: zod_1.z.boolean(),
});
/** One product, resolved: where it is on, by the same rule the guard uses (ADR-076 G5). */
exports.ResolvedProductState = zod_1.z.object({
    productId: products_1.ProductId,
    label: zod_1.z.string(),
    level: products_1.EntitlementLevel,
    /** True when an open every branch row exists. */
    everyBranch: zod_1.z.boolean(),
    /** Every active branch of the business, each with its own answer. */
    branches: zod_1.z.array(exports.ProductBranchState),
});
exports.OrgProductsView = zod_1.z.object({
    orgId: primitives_1.Uuid,
    /** Open and closed rows, newest first. */
    rows: zod_1.z.array(exports.OrgProductEntitlement),
    /** Every product a business can hold, in `ProductId` order. */
    resolved: zod_1.z.array(exports.ResolvedProductState),
});
/** A reason must say something a person can act on later. */
exports.ENTITLEMENT_REASON_MIN_LENGTH = 10;
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
exports.SetOrgProductRequest = zod_1.z.object({
    branchIds: zod_1.z.array(primitives_1.Uuid).min(1).max(200).nullable(),
    state: zod_1.z.enum(["on", "off"]),
    reason: zod_1.z.string().trim().max(500),
});
exports.SetOrgProductResult = zod_1.z.object({
    /** False when the request asked for what was already true: nothing was written. */
    changed: zod_1.z.boolean(),
    /** The product's open rows after the change. */
    open: zod_1.z.array(exports.OrgProductEntitlement),
});
/** Why a change was refused (ADR-076 G6, G7). */
exports.EntitlementRefusalCode = zod_1.z.enum([
    "entitlement_level",
    "entitlement_locked",
    "branch_invalid",
    "reason_required",
    "product_in_use",
]);
/**
 * One piece of open work that keeps a product on (ADR-076 G7), following
 * ADR-054's archive refusal: a guest in house, a booking still to arrive, an
 * open bill, an order not finished, a table still seated, a till shift still
 * open, a draft pay run, a lease that holds a unit, a payout still to go out,
 * a broker's placement still open or a broker's fee still owed.
 */
exports.ProductInUseKind = zod_1.z.enum([
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
exports.ProductInUseReason = zod_1.z.object({
    kind: exports.ProductInUseKind,
    /** The branch it sits at, or null for business wide work (a pay run). */
    propertyId: primitives_1.Uuid.nullable(),
    count: zod_1.z.number().int().positive(),
    message: zod_1.z.string(),
});
//# sourceMappingURL=entitlements.js.map