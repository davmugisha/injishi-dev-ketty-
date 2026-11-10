import { z } from "zod";
/**
 * Why a guard refused, in words a client can branch on (ADR-074, "The order of
 * checks"; ADR-076 A-6 and slice G, "Error codes").
 *
 * Every refusal from `SessionGuard`, `WorkspaceGuard`, `StaffGuard`,
 * `OversightGuard` and `KioskGuard` carries `layer` and `code` beside the
 * message it always had, which does not change. A screen words the refusal from
 * the layer that made it, and `apps/app`'s cache can tell a lost entitlement
 * from a lost permission.
 *
 * The layers run in this order on a business route, and the first that refuses
 * ends the request: session, workspace, scope (the branch in view),
 * operational, entitlement, permission, scope (the record). Layers 2 and 3 come
 * before the entitlement on purpose, so a refusal never tells a stranger where
 * a product is off.
 */
export declare const AccessLayer: z.ZodEnum<["session", "workspace", "scope", "operational", "entitlement", "permission"]>;
export type AccessLayer = z.infer<typeof AccessLayer>;
/**
 * The codes. `two_factor_required`, `pin_locked` and `pin_mismatch` keep the
 * values clients already branch on (ADR-076 G11), as does `step_up_stale`, the
 * staff console's ten minute step-up for a grant (`STAFF_STEP_UP_STALE`), and `kiosk_unpaired` stays as
 * the kiosk routes' alias for `device_unpaired`.
 */
export declare const AccessRefusalCode: z.ZodEnum<["unauthenticated", "two_factor_required", "step_up_required", "step_up_stale", "device_unpaired", "kiosk_unpaired", "pin_locked", "pin_mismatch", "workspace_required", "workspace_not_available", "not_found", "out_of_scope", "registration_stage", "suspended", "product_off", "permission_missing", "not_staff", "not_oversight"]>;
export type AccessRefusalCode = z.infer<typeof AccessRefusalCode>;
/** The layer each code belongs to, so a code can never be thrown under the wrong one. */
export declare const ACCESS_REFUSAL_LAYER: Readonly<Record<AccessRefusalCode, AccessLayer>>;
/**
 * A refusal on the wire: Nest's own error body, plus `layer` and `code`.
 * `message` is the sentence the guard always sent.
 */
export declare const AccessRefusal: z.ZodObject<{
    statusCode: z.ZodNumber;
    error: z.ZodString;
    message: z.ZodString;
    layer: z.ZodEnum<["session", "workspace", "scope", "operational", "entitlement", "permission"]>;
    code: z.ZodEnum<["unauthenticated", "two_factor_required", "step_up_required", "step_up_stale", "device_unpaired", "kiosk_unpaired", "pin_locked", "pin_mismatch", "workspace_required", "workspace_not_available", "not_found", "out_of_scope", "registration_stage", "suspended", "product_off", "permission_missing", "not_staff", "not_oversight"]>;
}, "strip", z.ZodTypeAny, {
    code: "suspended" | "step_up_stale" | "not_found" | "unauthenticated" | "two_factor_required" | "step_up_required" | "device_unpaired" | "kiosk_unpaired" | "pin_locked" | "pin_mismatch" | "workspace_required" | "workspace_not_available" | "out_of_scope" | "registration_stage" | "product_off" | "permission_missing" | "not_staff" | "not_oversight";
    message: string;
    error: string;
    statusCode: number;
    layer: "entitlement" | "scope" | "permission" | "session" | "workspace" | "operational";
}, {
    code: "suspended" | "step_up_stale" | "not_found" | "unauthenticated" | "two_factor_required" | "step_up_required" | "device_unpaired" | "kiosk_unpaired" | "pin_locked" | "pin_mismatch" | "workspace_required" | "workspace_not_available" | "out_of_scope" | "registration_stage" | "product_off" | "permission_missing" | "not_staff" | "not_oversight";
    message: string;
    error: string;
    statusCode: number;
    layer: "entitlement" | "scope" | "permission" | "session" | "workspace" | "operational";
}>;
export type AccessRefusal = z.infer<typeof AccessRefusal>;
/** Read a refusal out of an error body, or null when the body is not one. */
export declare function parseAccessRefusal(body: unknown): AccessRefusal | null;
//# sourceMappingURL=refusals.d.ts.map