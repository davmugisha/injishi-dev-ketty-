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
export const AccessLayer = z.enum([
    "session",
    "workspace",
    "scope",
    "operational",
    "entitlement",
    "permission",
]);
export type AccessLayer = z.infer<typeof AccessLayer>;
/**
 * The codes. `two_factor_required`, `pin_locked` and `pin_mismatch` keep the
 * values clients already branch on (ADR-076 G11), as does `step_up_stale`, the
 * staff console's ten minute step-up for a grant (`STAFF_STEP_UP_STALE`), and `kiosk_unpaired` stays as
 * the kiosk routes' alias for `device_unpaired`.
 */
export const AccessRefusalCode = z.enum([
    "unauthenticated",
    "two_factor_required",
    "step_up_required",
    "step_up_stale",
    "device_unpaired",
    "kiosk_unpaired",
    "pin_locked",
    "pin_mismatch",
    "workspace_required",
    "workspace_not_available",
    "not_found",
    "out_of_scope",
    "registration_stage",
    "suspended",
    "product_off",
    "permission_missing",
    "not_staff",
    "not_oversight",
]);
export type AccessRefusalCode = z.infer<typeof AccessRefusalCode>;
/** The layer each code belongs to, so a code can never be thrown under the wrong one. */
export const ACCESS_REFUSAL_LAYER: Readonly<Record<AccessRefusalCode, AccessLayer>> = {
    unauthenticated: "session",
    two_factor_required: "session",
    step_up_required: "session",
    step_up_stale: "session",
    device_unpaired: "session",
    kiosk_unpaired: "session",
    pin_locked: "session",
    pin_mismatch: "session",
    workspace_required: "workspace",
    workspace_not_available: "workspace",
    not_found: "scope",
    out_of_scope: "scope",
    registration_stage: "operational",
    suspended: "operational",
    product_off: "entitlement",
    permission_missing: "permission",
    not_staff: "permission",
    not_oversight: "permission",
};
/**
 * A refusal on the wire: Nest's own error body, plus `layer` and `code`.
 * `message` is the sentence the guard always sent.
 */
export const AccessRefusal = z.object({
    statusCode: z.number().int(),
    error: z.string(),
    message: z.string(),
    layer: AccessLayer,
    code: AccessRefusalCode,
});
export type AccessRefusal = z.infer<typeof AccessRefusal>;
/** Read a refusal out of an error body, or null when the body is not one. */
export function parseAccessRefusal(body: unknown): AccessRefusal | null {
    const parsed = AccessRefusal.safeParse(body);
    return parsed.success ? parsed.data : null;
}
