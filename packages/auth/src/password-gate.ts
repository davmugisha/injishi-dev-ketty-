import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";

/**
 * Who may hold a password (2026-10-23): tenants, and nobody else.
 *
 * Everyone signs in with an emailed code. A tenant is offered a password when
 * they accept a lease invitation, so the next sign in skips the code. A
 * landlord, broker, admin or local leader never gets one: their sessions keep
 * the emailed step-up.
 *
 * The rule lives on the server, in two places:
 *
 * - `credentialGuard`, a database hook on `accounts`: a `credential` row (a
 *   password) can only be created for a user `mayHoldPassword` says yes to.
 *   Every route that makes a FIRST password ends in that insert (the
 *   email-OTP reset, Better Auth's server-only `setPassword`, any route we
 *   add), so none of them can get round it.
 * - `passwordGate`, a plugin: the email-OTP password routes answer a person
 *   with no password and no tenancy exactly as they answer an unknown
 *   address. The send says "sent" and mails nothing; the reset refuses the
 *   code. So "Forgot password?" says nothing about who holds an account, and
 *   no landlord is mailed a "password code" they can never use.
 *
 * Changing or resetting a password needs one already: `/change-password`
 * asks for the current one, and a reset for somebody who has one is allowed.
 */

/** Answers whether this user is a tenant (a lease or an open invitation). */
export type MayHoldPassword = (userId: string) => Promise<boolean>;

/** The refusal when a first password is not offered to this account. */
export const PASSWORD_NOT_OFFERED = "PASSWORD_NOT_OFFERED";

/** The email-OTP routes that send a password code. */
export const PASSWORD_CODE_SEND_PATHS: ReadonlySet<string> = new Set([
  "/email-otp/request-password-reset",
  "/forget-password/email-otp",
]);
/** The email-OTP route that spends that code on a password. */
export const PASSWORD_CODE_RESET_PATH = "/email-otp/reset-password";

/** A password only for a yes; no callback means nobody. */
async function allowed(may: MayHoldPassword | undefined, userId: string): Promise<boolean> {
  if (!may) return false;
  try {
    return await may(userId);
  } catch {
    // A failed lookup is a no, never a password for somebody who should not have one.
    return false;
  }
}

interface FoundUser {
  user: { id: string };
  accounts?: Array<{ providerId: string }>;
}

interface GateContext {
  path?: string;
  body?: unknown;
  context: {
    internalAdapter: {
      findUserByEmail: (email: string, options: { includeAccounts: boolean }) => Promise<FoundUser | null>;
    };
  };
  json: (body: unknown) => unknown;
}

/**
 * True when this address may use a password code: somebody who already has a
 * password, or a tenant setting their first. An unknown address is left to
 * Better Auth, which answers it the same way.
 */
async function mayUsePasswordCode(ctx: GateContext, may: MayHoldPassword | undefined): Promise<boolean> {
  const body = (ctx.body ?? {}) as { email?: unknown };
  if (typeof body.email !== "string" || body.email.trim() === "") return true;
  const found = await ctx.context.internalAdapter.findUserByEmail(body.email.trim().toLowerCase(), {
    includeAccounts: true,
  });
  if (!found) return true;
  if (found.accounts?.some((a) => a.providerId === "credential")) return true;
  return allowed(may, found.user.id);
}

export function passwordGate(may: MayHoldPassword | undefined): BetterAuthPlugin {
  return {
    id: "injishi-password-gate",
    hooks: {
      before: [
        {
          matcher: (ctx) => typeof ctx.path === "string" && PASSWORD_CODE_SEND_PATHS.has(ctx.path),
          handler: createAuthMiddleware(async (ctx) => {
            const gate = ctx as unknown as GateContext;
            if (await mayUsePasswordCode(gate, may)) return;
            // The answer an unknown address gets, with nothing mailed.
            return gate.json({ success: true });
          }),
        },
        {
          matcher: (ctx) => ctx.path === PASSWORD_CODE_RESET_PATH,
          handler: createAuthMiddleware(async (ctx) => {
            if (await mayUsePasswordCode(ctx as unknown as GateContext, may)) return;
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
export function credentialGuard(may: MayHoldPassword | undefined) {
  return async <T extends { providerId: string; userId: string }>(account: T) => {
    if (account.providerId !== "credential") return { data: account };
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
