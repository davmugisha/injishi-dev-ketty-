/**
 * Crash report redaction (ADR-063, "The patterns").
 *
 * `redactText` is the one definition of what personal data looks like inside
 * free text, shared by the phone's crash reporter and the API's `beforeSend`.
 * It runs on error messages and trail entries before they leave the process,
 * so a name, an email, a phone number, an ID, a token or a sign in code that
 * reached an error string never reaches Sentry.
 *
 * Fourteen rows apply in order, each to the output of the one before. Order is
 * load bearing: a query string goes before the email row so `?email=` is cut
 * whole, a UUID becomes `:id` before the long run row could call it a token,
 * and phone numbers go before the plain digit rows so a spaced number is named
 * as a phone, not as three short numbers. The contracts tests pin the exact
 * placeholder for every row.
 *
 * Pure, synchronous and total: it never throws, and on an internal failure it
 * returns a placeholder rather than the text it could not clean.
 *
 * No regex here uses a lookbehind. The phone runs this under Hermes, and a
 * pattern the engine cannot compile would throw when the module loads, which
 * is the one place the crash reporter must never fail.
 */
/** The most characters `redactText` reads. Everything after is dropped first. */
export declare const REDACT_MAX_INPUT = 2000;
/**
 * `text` with every pattern above applied, cut to `REDACT_MAX_INPUT`
 * characters first. Anything that is not a string returns an empty string.
 */
export declare function redactText(text: string): string;
//# sourceMappingURL=redaction.d.ts.map