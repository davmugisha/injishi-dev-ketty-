import { z } from "zod";
/**
 * Phone sign in (ADR-039). One shared vocabulary for a Rwandan mobile number,
 * the five endpoint shapes, and the error codes a client switches on.
 *
 * A number is an authentication key of equal standing to an email address, so
 * everything here is consumed by the API guard path and by every client. Fork
 * any of it and the two sides start disagreeing about who a person is.
 */
/**
 * The MNO prefixes a Rwandan mobile number may carry, after `+250` (AC-2).
 *
 * Landlines and short codes are deliberately absent: an SMS to one is money
 * spent on a code nobody can read. A number outside this set is refused with a
 * message that names Rwanda and points at the email route, never a message that
 * implies the number is unknown to us — that would be enumeration.
 */
export declare const RW_MOBILE_PREFIXES: readonly ["72", "73", "78", "79"];
/**
 * Bring a typed number to the one stored form, `+250788123456`, or say it is
 * not a Rwandan mobile number.
 *
 * Accepts the four ways a person in Rwanda actually writes their own number —
 * `0788123456`, `788123456`, `250788123456`, `+250788123456` — with spaces,
 * dashes and brackets anywhere, because a field that rejects the spacing on a
 * business card is a field people give up on. Everything else returns null.
 *
 * `null` rather than a throw, because both callers (the schema below and the
 * `send-code` route) want to branch, not to catch.
 */
export declare function normalizeRwPhone(raw: string): string | null;
/**
 * Whether this is a Rwandan mobile number.
 *
 * The return type is spelled out rather than inferred: a bare arrow forwarding
 * to a guard is inferred as a type predicate by current TypeScript, and a
 * predicate here would narrow every consumer to a string literal union.
 */
export declare function isRwMobile(raw: string): boolean;
/**
 * A Rwandan mobile number, normalized to E.164 on the way in.
 *
 * The schema normalizes rather than merely validating, so a route can never
 * hold the un-normalized spelling: `users.phone_number` is unique, and two
 * spellings of one number that both reached the table would be two accounts for
 * one human, which is the exact failure this feature exists to prevent.
 */
export declare const RwPhoneNumber: z.ZodPipeline<z.ZodEffects<z.ZodString, string | null, string>, z.ZodString>;
export type RwPhoneNumber = z.infer<typeof RwPhoneNumber>;
/**
 * The named failures a phone sign in can return.
 *
 * A code rather than prose, because two of the acceptance criteria need the
 * client to tell failures apart and act differently: AC-14 offers the email
 * route when the SMS adapter is down, and AC-17 must word an expired code
 * differently from a wrong one. Prose cannot carry that, and matching on prose
 * breaks the first time the copy is edited.
 *
 * `PHONE_NOT_RW` is the only one that names the input. None of the others say
 * whether an identifier is known, because `send-code` never looks one up.
 */
export declare const PhoneErrorCode: z.ZodEnum<["PHONE_NOT_RW", "CODE_INVALID", "CODE_EXPIRED", "CODE_ATTEMPTS_EXHAUSTED", "RATE_LIMITED", "SMS_UNAVAILABLE", "EMAIL_UNAVAILABLE", "LINK_TOKEN_INVALID"]>;
export type PhoneErrorCode = z.infer<typeof PhoneErrorCode>;
/** The body every phone endpoint returns on a failure. */
export declare const PhoneErrorResponse: z.ZodObject<{
    code: z.ZodEnum<["PHONE_NOT_RW", "CODE_INVALID", "CODE_EXPIRED", "CODE_ATTEMPTS_EXHAUSTED", "RATE_LIMITED", "SMS_UNAVAILABLE", "EMAIL_UNAVAILABLE", "LINK_TOKEN_INVALID"]>;
    /** Human wording for the same failure. Never matched on. */
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: "PHONE_NOT_RW" | "CODE_INVALID" | "CODE_EXPIRED" | "CODE_ATTEMPTS_EXHAUSTED" | "RATE_LIMITED" | "SMS_UNAVAILABLE" | "EMAIL_UNAVAILABLE" | "LINK_TOKEN_INVALID";
    message: string;
}, {
    code: "PHONE_NOT_RW" | "CODE_INVALID" | "CODE_EXPIRED" | "CODE_ATTEMPTS_EXHAUSTED" | "RATE_LIMITED" | "SMS_UNAVAILABLE" | "EMAIL_UNAVAILABLE" | "LINK_TOKEN_INVALID";
    message: string;
}>;
export type PhoneErrorResponse = z.infer<typeof PhoneErrorResponse>;
/** `POST /api/auth/injishi-phone/send-code`. */
export declare const SendPhoneCodeRequest: z.ZodObject<{
    phone: z.ZodPipeline<z.ZodEffects<z.ZodString, string | null, string>, z.ZodString>;
}, "strip", z.ZodTypeAny, {
    phone: string;
}, {
    phone: string;
}>;
export type SendPhoneCodeRequest = z.infer<typeof SendPhoneCodeRequest>;
/**
 * The one answer `send-code` and `claim-email` ever give (AC-3).
 *
 * Identical for a registered and an unregistered identifier, in body and in
 * status code. It carries no field that could differ, which is what makes the
 * promise cheap to hold rather than delicate.
 */
export declare const CodeSentResponse: z.ZodObject<{
    sent: z.ZodLiteral<true>;
}, "strip", z.ZodTypeAny, {
    sent: true;
}, {
    sent: true;
}>;
export type CodeSentResponse = z.infer<typeof CodeSentResponse>;
/** `POST /api/auth/injishi-phone/verify`. */
export declare const VerifyPhoneCodeRequest: z.ZodObject<{
    phone: z.ZodPipeline<z.ZodEffects<z.ZodString, string | null, string>, z.ZodString>;
    code: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
    phone: string;
}, {
    code: string;
    phone: string;
}>;
export type VerifyPhoneCodeRequest = z.infer<typeof VerifyPhoneCodeRequest>;
/**
 * What verifying an SMS code led to.
 *
 * `signed-in` also sets the session cookie. `email-required` means the number
 * is proved and held by nobody, so the join has to run before an account can
 * exist; the link token is the handle to that half-finished journey.
 */
export declare const VerifyPhoneCodeResponse: z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
    status: z.ZodLiteral<"signed-in">;
}, "strip", z.ZodTypeAny, {
    status: "signed-in";
}, {
    status: "signed-in";
}>, z.ZodObject<{
    status: z.ZodLiteral<"email-required">;
    linkToken: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "email-required";
    linkToken: string;
}, {
    status: "email-required";
    linkToken: string;
}>]>;
export type VerifyPhoneCodeResponse = z.infer<typeof VerifyPhoneCodeResponse>;
/** `POST /api/auth/injishi-phone/claim-email`. */
export declare const ClaimEmailRequest: z.ZodObject<{
    linkToken: z.ZodString;
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    linkToken: string;
}, {
    email: string;
    linkToken: string;
}>;
export type ClaimEmailRequest = z.infer<typeof ClaimEmailRequest>;
/** `POST /api/auth/injishi-phone/claim-verify`. */
export declare const ClaimVerifyRequest: z.ZodObject<{
    linkToken: z.ZodString;
    code: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
    linkToken: string;
}, {
    code: string;
    linkToken: string;
}>;
export type ClaimVerifyRequest = z.infer<typeof ClaimVerifyRequest>;
/** Completing the join signs the person in; there is no other outcome. */
export declare const ClaimVerifyResponse: z.ZodObject<{
    status: z.ZodLiteral<"signed-in">;
}, "strip", z.ZodTypeAny, {
    status: "signed-in";
}, {
    status: "signed-in";
}>;
export type ClaimVerifyResponse = z.infer<typeof ClaimVerifyResponse>;
/**
 * `POST /api/auth/injishi-phone/attach`, for a person who is already signed in.
 *
 * The number is read from the body and the ACCOUNT is read from the session,
 * never from the body, so this can only ever attach a phone to the caller.
 */
export declare const AttachPhoneRequest: z.ZodObject<{
    phone: z.ZodPipeline<z.ZodEffects<z.ZodString, string | null, string>, z.ZodString>;
    code: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
    phone: string;
}, {
    code: string;
    phone: string;
}>;
export type AttachPhoneRequest = z.infer<typeof AttachPhoneRequest>;
/**
 * Whether the number was free or taken off another account (AC-9).
 *
 * `moved` is not an error. A signed in person who also proves the phone holds
 * strictly more proof than the anonymous join path, so refusing here while
 * allowing it there would be incoherent. The losing account is emailed either
 * way, and an audit row records it.
 */
export declare const AttachPhoneResponse: z.ZodObject<{
    status: z.ZodEnum<["attached", "moved"]>;
}, "strip", z.ZodTypeAny, {
    status: "attached" | "moved";
}, {
    status: "attached" | "moved";
}>;
export type AttachPhoneResponse = z.infer<typeof AttachPhoneResponse>;
//# sourceMappingURL=phone.d.ts.map