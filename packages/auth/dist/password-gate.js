import { APIError, createAuthMiddleware } from "better-auth/api";
/** The refusal when a first password is not offered to this account. */
export const PASSWORD_NOT_OFFERED = "PASSWORD_NOT_OFFERED";
/** The email-OTP routes that send a password code. */
export const PASSWORD_CODE_SEND_PATHS = new Set([
    "/email-otp/request-password-reset",
    "/forget-password/email-otp",
]);
/** The email-OTP route that spends that code on a password. */
export const PASSWORD_CODE_RESET_PATH = "/email-otp/reset-password";
/** A password only for a yes; no callback means nobody. */
async function allowed(may, userId) {
    if (!may)
        return false;
    try {
        return await may(userId);
    }
    catch {
        // A failed lookup is a no, never a password for somebody who should not have one.
        return false;
    }
}
/**
 * True when this address may use a password code: somebody who already has a
 * password, or a tenant setting their first. An unknown address is left to
 * Better Auth, which answers it the same way.
 */
async function mayUsePasswordCode(ctx, may) {
    const body = (ctx.body ?? {});
    if (typeof body.email !== "string" || body.email.trim() === "")
        return true;
    const found = await ctx.context.internalAdapter.findUserByEmail(body.email.trim().toLowerCase(), {
        includeAccounts: true,
    });
    if (!found)
        return true;
    if (found.accounts?.some((a) => a.providerId === "credential"))
        return true;
    return allowed(may, found.user.id);
}
export function passwordGate(may) {
    return {
        id: "injishi-password-gate",
        hooks: {
            before: [
                {
                    matcher: (ctx) => typeof ctx.path === "string" && PASSWORD_CODE_SEND_PATHS.has(ctx.path),
                    handler: createAuthMiddleware(async (ctx) => {
                        const gate = ctx;
                        if (await mayUsePasswordCode(gate, may))
                            return;
                        // The answer an unknown address gets, with nothing mailed.
                        return gate.json({ success: true });
                    }),
                },
                {
                    matcher: (ctx) => ctx.path === PASSWORD_CODE_RESET_PATH,
                    handler: createAuthMiddleware(async (ctx) => {
                        if (await mayUsePasswordCode(ctx, may))
                            return;
                        // No code was ever mailed for this address, so the one typed is wrong.
                        throw new APIError("BAD_REQUEST", { code: "INVALID_OTP", message: "Invalid OTP" });
                    }),
                },
            ],
        },
    };
}
/**
 * The `accounts.create.before` database hook: a password row only for a yes.
 * Any other way in (Google, phone) is left alone.
 */
export function credentialGuard(may) {
    return async (account) => {
        if (account.providerId !== "credential")
            return { data: account };
        const userId = account.userId;
        if (!userId || !(await allowed(may, userId))) {
            throw new APIError("FORBIDDEN", {
                code: PASSWORD_NOT_OFFERED,
                message: "Passwords are only for tenants. Sign in with an email code.",
            });
        }
        return { data: account };
    };
}
//# sourceMappingURL=password-gate.js.map