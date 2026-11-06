"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkspaceGrants = exports.EnabledProduct = exports.HeldPermission = exports.HeldRole = exports.RoleScope = exports.ScopeKind = void 0;
exports.grantsProductOn = grantsProductOn;
exports.grantsPermissionHeld = grantsPermissionHeld;
const zod_1 = require("zod");
const primitives_1 = require("../primitives");
const products_1 = require("./products");
/**
 * What a person holds at one business, as the server resolved it (ADR-076,
 * cross child contract section 3).
 *
 * `GET /api/v1/me/workspaces` keeps every field it returned before and adds
 * this as `grants` on each `business` workspace. It is an AFFORDANCE: it tells
 * a client what it may offer. The guards are the boundary, and they resolve the
 * same answer from the same rows rather than trusting anything a client sends
 * back.
 *
 * A client reads it; it never works it out. Nothing here turns a role into
 * permissions (that stays on the server, ADR-012), which is why the helpers at
 * the bottom only look things up in an answer already given.
 */
/**
 * What a scope restricts. Only `branch` is accepted until a product ADR names
 * the record column an `outlet`, `department` or `section` scope restricts
 * (ADR-076 A-1 and Follow-up).
 */
exports.ScopeKind = zod_1.z.enum(["branch", "outlet", "department", "section"]);
exports.RoleScope = zod_1.z.object({
    kind: exports.ScopeKind,
    ids: zod_1.z.array(primitives_1.Uuid).min(1),
});
exports.HeldRole = zod_1.z.object({
    /** Null until slice R creates `org_roles` rows; until then the key names the role. */
    roleId: primitives_1.Uuid.nullable(),
    key: zod_1.z.string(),
    name: zod_1.z.string(),
    kind: zod_1.z.enum(["default", "custom"]),
    /** Empty means the whole business. */
    scopes: zod_1.z.array(exports.RoleScope),
});
exports.HeldPermission = zod_1.z.object({
    /** The new, namespaced name (`LEGACY_PERMISSION_KEY`), for example `pms.stay.checkin`. */
    key: zod_1.z.string(),
    /** The union over the roles that grant it (ADR-076 A-1). Empty means the whole business. */
    scopes: zod_1.z.array(exports.RoleScope),
});
exports.EnabledProduct = zod_1.z.object({
    id: products_1.ProductId,
    /**
     * Where it is on, already narrowed to the branches the member covers:
     * `all` for every branch they cover, else the covered branches where it is
     * on. A product on nowhere they cover is left out rather than listed empty.
     */
    branches: zod_1.z.union([zod_1.z.literal("all"), zod_1.z.array(primitives_1.Uuid)]),
});
exports.WorkspaceGrants = zod_1.z.object({
    family: zod_1.z.literal("business"),
    products: zod_1.z.array(exports.EnabledProduct),
    roles: zod_1.z.array(exports.HeldRole),
    permissions: zod_1.z.array(exports.HeldPermission),
});
/**
 * Is this product on in the answer, at this branch or (with none named)
 * anywhere the member covers? A lookup, not a resolution.
 */
function grantsProductOn(grants, product, branchId) {
    const held = grants?.products.find((p) => p.id === product);
    if (!held)
        return false;
    if (!branchId || held.branches === "all")
        return true;
    return held.branches.includes(branchId);
}
/**
 * Does the answer hold this permission, at this branch or (with none named)
 * anywhere? Takes the NEW key. A permission whose scopes are empty holds across
 * the whole business; otherwise the branch must sit in one of its scopes.
 */
function grantsPermissionHeld(grants, key, branchId) {
    const held = grants?.permissions.find((p) => p.key === key);
    if (!held)
        return false;
    if (!branchId || held.scopes.length === 0)
        return true;
    return held.scopes.some((s) => s.kind === "branch" && s.ids.includes(branchId));
}
//# sourceMappingURL=grants.js.map