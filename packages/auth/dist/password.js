import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "./options.js";
/**
 * What every password form says (2026-10-22). Passwords are for tenants only
 * since 2026-10-23 (`password-gate.ts`).
 *
 * Runtime neutral: no DOM, no fetch, no auth client, so the sign-in page, the
 * lease invitation and the tenant account screen all read the same rule and
 * the same sentences, and a Better Auth refusal is never shown in Better
 * Auth's own words.
 */
export const PASSWORD_MESSAGES = {
    tooShort: `Use at least ${PASSWORD_MIN_LENGTH} characters.`,
    tooLong: `Use at most ${PASSWORD_MAX_LENGTH} characters.`,
    mismatch: "The two passwords don't match.",
    missingCurrent: "Enter your current password.",
    missing: "Enter your password.",
    wrong: "That email and password don't match. Try again, or use an email code.",
    wrongCurrent: "Your current password isn't right.",
    noPassword: "You don't have a password yet. Sign in with an email code.",
    notOffered: "Passwords are only for tenants. Sign in with an email code.",
    alreadySet: "You already have a password. Change it from your account.",
    codeWrong: "That code doesn't match. Check the latest email from us.",
    codeExpired: "That code has expired. Send a new one.",
    codeSpent: "That code had too many tries. Send a new one.",
    codeIncomplete: "Enter the 6 digit code from the email.",
    throttled: "That's a lot of tries in a short time. Wait a minute, then try again.",
    sendPaused: "We've sent several codes to this address, so sending is paused for an hour.",
    failed: "Something went wrong on our side. Try again in a moment.",
};
export const PASSWORD_STRENGTH_LABEL = {
    "too-short": `At least ${PASSWORD_MIN_LENGTH} characters`,
    weak: "Weak",
    fair: "Fair",
    strong: "Strong",
};
/**
 * A rough read of how guessable a password is: length first, then variety.
 * It only colours a hint; the server's rule is the length.
 */
export function passwordStrength(password) {
    if (password.length < PASSWORD_MIN_LENGTH)
        return "too-short";
    const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
    const unique = new Set(password).size;
    if (unique < 4)
        return "weak";
    if (password.length >= 14 || (password.length >= 10 && kinds >= 3))
        return "strong";
    if (password.length >= 10 || kinds >= 3)
        return "fair";
    return "weak";
}
/** Why a new password cannot be saved yet, or null when it can. */
export function newPasswordProblem(password, confirm) {
    if (password.length < PASSWORD_MIN_LENGTH)
        return PASSWORD_MESSAGES.tooShort;
    if (password.length > PASSWORD_MAX_LENGTH)
        return PASSWORD_MESSAGES.tooLong;
    if (password !== confirm)
        return PASSWORD_MESSAGES.mismatch;
    return null;
}
/**
 * One sentence for a refused password or reset call, from Better Auth's error
 * code (`BASE_ERROR_CODES`, the email-OTP plugin's codes, our send cap's
 * `RATE_LIMITED`) or the status.
 */
export function passwordFailure(error) {
    const code = typeof error?.code === "string" ? error.code.toUpperCase() : "";
    const status = typeof error?.status === "number" ? error.status : 0;
    switch (code) {
        case "INVALID_EMAIL_OR_PASSWORD":
            return PASSWORD_MESSAGES.wrong;
        case "INVALID_PASSWORD":
            return PASSWORD_MESSAGES.wrongCurrent;
        case "CREDENTIAL_ACCOUNT_NOT_FOUND":
            return PASSWORD_MESSAGES.noPassword;
        case "PASSWORD_NOT_OFFERED":
            return PASSWORD_MESSAGES.notOffered;
        case "PASSWORD_ALREADY_SET":
            return PASSWORD_MESSAGES.alreadySet;
        case "PASSWORD_TOO_SHORT":
            return PASSWORD_MESSAGES.tooShort;
        case "PASSWORD_TOO_LONG":
            return PASSWORD_MESSAGES.tooLong;
        case "INVALID_OTP":
            return PASSWORD_MESSAGES.codeWrong;
        case "OTP_EXPIRED":
            return PASSWORD_MESSAGES.codeExpired;
        case "TOO_MANY_ATTEMPTS":
            return PASSWORD_MESSAGES.codeSpent;
        case "RATE_LIMITED":
            return PASSWORD_MESSAGES.sendPaused;
    }
    if (status === 429)
        return PASSWORD_MESSAGES.throttled;
    return PASSWORD_MESSAGES.failed;
}
//# sourceMappingURL=password.js.map