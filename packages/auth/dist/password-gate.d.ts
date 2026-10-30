import type { BetterAuthPlugin } from "better-auth";
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
export declare const PASSWORD_NOT_OFFERED = "PASSWORD_NOT_OFFERED";
/** The email-OTP routes that send a password code. */
export declare const PASSWORD_CODE_SEND_PATHS: ReadonlySet<string>;
/** The email-OTP route that spends that code on a password. */
export declare const PASSWORD_CODE_RESET_PATH = "/email-otp/reset-password";
export declare function passwordGate(may: MayHoldPassword | undefined): BetterAuthPlugin;
/**
 * The `accounts.create.before` database hook: a password row only for a yes.
 * Any other way in (Google, phone) is left alone.
 */
export declare function credentialGuard(may: MayHoldPassword | undefined): <T extends {
    providerId: string;
    userId: string;
}>(account: T) => Promise<{
    data: T;
}>;
//# sourceMappingURL=password-gate.d.ts.map