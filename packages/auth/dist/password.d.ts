/**
 * What every password form says (2026-10-22). Passwords are for tenants only
 * since 2026-10-23 (`password-gate.ts`).
 *
 * Runtime neutral: no DOM, no fetch, no auth client, so the sign-in page, the
 * lease invitation and the tenant account screen all read the same rule and
 * the same sentences, and a Better Auth refusal is never shown in Better
 * Auth's own words.
 */
export declare const PASSWORD_MESSAGES: {
    readonly tooShort: "Use at least 8 characters.";
    readonly tooLong: "Use at most 128 characters.";
    readonly mismatch: "The two passwords don't match.";
    readonly missingCurrent: "Enter your current password.";
    readonly missing: "Enter your password.";
    readonly wrong: "That email and password don't match. Try again, or use an email code.";
    readonly wrongCurrent: "Your current password isn't right.";
    readonly noPassword: "You don't have a password yet. Sign in with an email code.";
    readonly notOffered: "Passwords are only for tenants. Sign in with an email code.";
    readonly alreadySet: "You already have a password. Change it from your account.";
    readonly codeWrong: "That code doesn't match. Check the latest email from us.";
    readonly codeExpired: "That code has expired. Send a new one.";
    readonly codeSpent: "That code had too many tries. Send a new one.";
    readonly codeIncomplete: "Enter the 6 digit code from the email.";
    readonly throttled: "That's a lot of tries in a short time. Wait a minute, then try again.";
    readonly sendPaused: "We've sent several codes to this address, so sending is paused for an hour.";
    readonly failed: "Something went wrong on our side. Try again in a moment.";
};
/** The strength hint under a new password. Never a gate beyond the length rule. */
export type PasswordStrength = "too-short" | "weak" | "fair" | "strong";
export declare const PASSWORD_STRENGTH_LABEL: Record<PasswordStrength, string>;
/**
 * A rough read of how guessable a password is: length first, then variety.
 * It only colours a hint; the server's rule is the length.
 */
export declare function passwordStrength(password: string): PasswordStrength;
/** Why a new password cannot be saved yet, or null when it can. */
export declare function newPasswordProblem(password: string, confirm: string): string | null;
/** The refusal shape Better Auth's client resolves to. */
export interface PasswordError {
    code?: unknown;
    status?: unknown;
}
/**
 * One sentence for a refused password or reset call, from Better Auth's error
 * code (`BASE_ERROR_CODES`, the email-OTP plugin's codes, our send cap's
 * `RATE_LIMITED`) or the status.
 */
export declare function passwordFailure(error: PasswordError | null | undefined): string;
//# sourceMappingURL=password.d.ts.map