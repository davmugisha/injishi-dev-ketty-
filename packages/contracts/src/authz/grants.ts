import { z } from "zod";
import { Uuid } from "../primitives";
import { ProductId } from "./products";
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
export const ScopeKind = z.enum(["branch", "outlet", "department", "section"]);
export type ScopeKind = z.infer<typeof ScopeKind>;
export const RoleScope = z.object({
    kind: ScopeKind,
    ids: z.array(Uuid).min(1),
});
export type RoleScope = z.infer<typeof RoleScope>;
export const HeldRole = z.object({
    /** Null until slice R creates `org_roles` rows; until then the key names the role. */
    roleId: Uuid.nullable(),
    key: z.string(),
    name: z.string(),
    kind: z.enum(["default", "custom"]),
    /** Empty means the whole business. */
    scopes: z.array(RoleScope),
});
export type HeldRole = z.infer<typeof HeldRole>;
export const HeldPermission = z.object({
    /** The new, namespaced name (`LEGACY_PERMISSION_KEY`), for example `pms.stay.checkin`. */
    key: z.string(),
    /** The union over the roles that grant it (ADR-076 A-1). Empty means the whole business. */
    scopes: z.array(RoleScope),
});
export type HeldPermission = z.infer<typeof HeldPermission>;
export const EnabledProduct = z.object({
    id: ProductId,
    /**
     * Where it is on, already narrowed to the branches the member covers:
     * `all` for every branch they cover, else the covered branches where it is
     * on. A product on nowhere they cover is left out rather than listed empty.
     */
    branches: z.union([z.literal("all"), z.array(Uuid)]),
});
export type EnabledProduct = z.infer<typeof EnabledProduct>;
export const WorkspaceGrants = z.object({
    family: z.literal("business"),
    products: z.array(EnabledProduct),
    roles: z.array(HeldRole),
    permissions: z.array(HeldPermission),
});
export type WorkspaceGrants = z.infer<typeof WorkspaceGrants>;
/**
 * Is this product on in the answer, at this branch or (with none named)
 * anywhere the member covers? A lookup, not a resolution.
 */
export function grantsProductOn(grants: Pick<WorkspaceGrants, "products"> | null | undefined, product: ProductId, branchId?: string | null): boolean {
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
export function grantsPermissionHeld(grants: Pick<WorkspaceGrants, "permissions"> | null | undefined, key: string, branchId?: string | null): boolean {
    const held = grants?.permissions.find((p) => p.key === key);
    if (!held)
        return false;
    if (!branchId || held.scopes.length === 0)
        return true;
    return held.scopes.some((s) => s.kind === "branch" && s.ids.includes(branchId));
}
