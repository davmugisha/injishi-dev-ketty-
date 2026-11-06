import { z } from "zod";
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
export declare const ScopeKind: z.ZodEnum<["branch", "outlet", "department", "section"]>;
export type ScopeKind = z.infer<typeof ScopeKind>;
export declare const RoleScope: z.ZodObject<{
    kind: z.ZodEnum<["branch", "outlet", "department", "section"]>;
    ids: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    kind: "branch" | "outlet" | "department" | "section";
    ids: string[];
}, {
    kind: "branch" | "outlet" | "department" | "section";
    ids: string[];
}>;
export type RoleScope = z.infer<typeof RoleScope>;
export declare const HeldRole: z.ZodObject<{
    /** Null until slice R creates `org_roles` rows; until then the key names the role. */
    roleId: z.ZodNullable<z.ZodString>;
    key: z.ZodString;
    name: z.ZodString;
    kind: z.ZodEnum<["default", "custom"]>;
    /** Empty means the whole business. */
    scopes: z.ZodArray<z.ZodObject<{
        kind: z.ZodEnum<["branch", "outlet", "department", "section"]>;
        ids: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        kind: "branch" | "outlet" | "department" | "section";
        ids: string[];
    }, {
        kind: "branch" | "outlet" | "department" | "section";
        ids: string[];
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    name: string;
    kind: "custom" | "default";
    key: string;
    roleId: string | null;
    scopes: {
        kind: "branch" | "outlet" | "department" | "section";
        ids: string[];
    }[];
}, {
    name: string;
    kind: "custom" | "default";
    key: string;
    roleId: string | null;
    scopes: {
        kind: "branch" | "outlet" | "department" | "section";
        ids: string[];
    }[];
}>;
export type HeldRole = z.infer<typeof HeldRole>;
export declare const HeldPermission: z.ZodObject<{
    /** The new, namespaced name (`LEGACY_PERMISSION_KEY`), for example `pms.stay.checkin`. */
    key: z.ZodString;
    /** The union over the roles that grant it (ADR-076 A-1). Empty means the whole business. */
    scopes: z.ZodArray<z.ZodObject<{
        kind: z.ZodEnum<["branch", "outlet", "department", "section"]>;
        ids: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        kind: "branch" | "outlet" | "department" | "section";
        ids: string[];
    }, {
        kind: "branch" | "outlet" | "department" | "section";
        ids: string[];
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    key: string;
    scopes: {
        kind: "branch" | "outlet" | "department" | "section";
        ids: string[];
    }[];
}, {
    key: string;
    scopes: {
        kind: "branch" | "outlet" | "department" | "section";
        ids: string[];
    }[];
}>;
export type HeldPermission = z.infer<typeof HeldPermission>;
export declare const EnabledProduct: z.ZodObject<{
    id: z.ZodEnum<["account", "admin", "membership", "marketplace", "finance", "pay", "pms", "outlets", "pos", "hr", "residence"]>;
    /**
     * Where it is on, already narrowed to the branches the member covers:
     * `all` for every branch they cover, else the covered branches where it is
     * on. A product on nowhere they cover is left out rather than listed empty.
     */
    branches: z.ZodUnion<[z.ZodLiteral<"all">, z.ZodArray<z.ZodString, "many">]>;
}, "strip", z.ZodTypeAny, {
    id: "residence" | "finance" | "hr" | "admin" | "membership" | "account" | "marketplace" | "pay" | "pms" | "outlets" | "pos";
    branches: string[] | "all";
}, {
    id: "residence" | "finance" | "hr" | "admin" | "membership" | "account" | "marketplace" | "pay" | "pms" | "outlets" | "pos";
    branches: string[] | "all";
}>;
export type EnabledProduct = z.infer<typeof EnabledProduct>;
export declare const WorkspaceGrants: z.ZodObject<{
    family: z.ZodLiteral<"business">;
    products: z.ZodArray<z.ZodObject<{
        id: z.ZodEnum<["account", "admin", "membership", "marketplace", "finance", "pay", "pms", "outlets", "pos", "hr", "residence"]>;
        /**
         * Where it is on, already narrowed to the branches the member covers:
         * `all` for every branch they cover, else the covered branches where it is
         * on. A product on nowhere they cover is left out rather than listed empty.
         */
        branches: z.ZodUnion<[z.ZodLiteral<"all">, z.ZodArray<z.ZodString, "many">]>;
    }, "strip", z.ZodTypeAny, {
        id: "residence" | "finance" | "hr" | "admin" | "membership" | "account" | "marketplace" | "pay" | "pms" | "outlets" | "pos";
        branches: string[] | "all";
    }, {
        id: "residence" | "finance" | "hr" | "admin" | "membership" | "account" | "marketplace" | "pay" | "pms" | "outlets" | "pos";
        branches: string[] | "all";
    }>, "many">;
    roles: z.ZodArray<z.ZodObject<{
        /** Null until slice R creates `org_roles` rows; until then the key names the role. */
        roleId: z.ZodNullable<z.ZodString>;
        key: z.ZodString;
        name: z.ZodString;
        kind: z.ZodEnum<["default", "custom"]>;
        /** Empty means the whole business. */
        scopes: z.ZodArray<z.ZodObject<{
            kind: z.ZodEnum<["branch", "outlet", "department", "section"]>;
            ids: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            kind: "branch" | "outlet" | "department" | "section";
            ids: string[];
        }, {
            kind: "branch" | "outlet" | "department" | "section";
            ids: string[];
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        name: string;
        kind: "custom" | "default";
        key: string;
        roleId: string | null;
        scopes: {
            kind: "branch" | "outlet" | "department" | "section";
            ids: string[];
        }[];
    }, {
        name: string;
        kind: "custom" | "default";
        key: string;
        roleId: string | null;
        scopes: {
            kind: "branch" | "outlet" | "department" | "section";
            ids: string[];
        }[];
    }>, "many">;
    permissions: z.ZodArray<z.ZodObject<{
        /** The new, namespaced name (`LEGACY_PERMISSION_KEY`), for example `pms.stay.checkin`. */
        key: z.ZodString;
        /** The union over the roles that grant it (ADR-076 A-1). Empty means the whole business. */
        scopes: z.ZodArray<z.ZodObject<{
            kind: z.ZodEnum<["branch", "outlet", "department", "section"]>;
            ids: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            kind: "branch" | "outlet" | "department" | "section";
            ids: string[];
        }, {
            kind: "branch" | "outlet" | "department" | "section";
            ids: string[];
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        key: string;
        scopes: {
            kind: "branch" | "outlet" | "department" | "section";
            ids: string[];
        }[];
    }, {
        key: string;
        scopes: {
            kind: "branch" | "outlet" | "department" | "section";
            ids: string[];
        }[];
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    family: "business";
    roles: {
        name: string;
        kind: "custom" | "default";
        key: string;
        roleId: string | null;
        scopes: {
            kind: "branch" | "outlet" | "department" | "section";
            ids: string[];
        }[];
    }[];
    permissions: {
        key: string;
        scopes: {
            kind: "branch" | "outlet" | "department" | "section";
            ids: string[];
        }[];
    }[];
    products: {
        id: "residence" | "finance" | "hr" | "admin" | "membership" | "account" | "marketplace" | "pay" | "pms" | "outlets" | "pos";
        branches: string[] | "all";
    }[];
}, {
    family: "business";
    roles: {
        name: string;
        kind: "custom" | "default";
        key: string;
        roleId: string | null;
        scopes: {
            kind: "branch" | "outlet" | "department" | "section";
            ids: string[];
        }[];
    }[];
    permissions: {
        key: string;
        scopes: {
            kind: "branch" | "outlet" | "department" | "section";
            ids: string[];
        }[];
    }[];
    products: {
        id: "residence" | "finance" | "hr" | "admin" | "membership" | "account" | "marketplace" | "pay" | "pms" | "outlets" | "pos";
        branches: string[] | "all";
    }[];
}>;
export type WorkspaceGrants = z.infer<typeof WorkspaceGrants>;
/**
 * Is this product on in the answer, at this branch or (with none named)
 * anywhere the member covers? A lookup, not a resolution.
 */
export declare function grantsProductOn(grants: Pick<WorkspaceGrants, "products"> | null | undefined, product: ProductId, branchId?: string | null): boolean;
/**
 * Does the answer hold this permission, at this branch or (with none named)
 * anywhere? Takes the NEW key. A permission whose scopes are empty holds across
 * the whole business; otherwise the branch must sit in one of its scopes.
 */
export declare function grantsPermissionHeld(grants: Pick<WorkspaceGrants, "permissions"> | null | undefined, key: string, branchId?: string | null): boolean;
//# sourceMappingURL=grants.d.ts.map