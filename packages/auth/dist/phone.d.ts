import type { BetterAuthPlugin } from "better-auth";
import type { SendOtp } from "./server.js";
/**
 * Hands one sign-in code to the SMS seam.
 *
 * The same shape as `SendOtp` beside it, and for the same reason: this package
 * knows that a code must reach a person and knows nothing about how. The API
 * plugs its `SMS_PORT` in here, which is a mock today and a provider the day one
 * is chosen, and nothing in this file changes when that happens.
 */
export type SendSms = (args: {
    phone: string;
    code: string;
}) => Promise<void>;
/**
 * Tells the person who just lost a number that it left their account (AC-8).
 *
 * NOT an OTP, which is why it is its own callback rather than another `OtpType`.
 * It carries no code and it is not a step in any flow: if it fails the move
 * still stands, and the failure is logged rather than rolled back. A recycled
 * Rwandan number is a real and common event, and this notice is the only thing
 * that makes a silent takeover impossible.
 */
export type SendPhoneRemovedNotice = (args: {
    email: string;
}) => Promise<void>;
export interface InjishiPhoneOptions {
    /** How a code reaches a handset. Required: without it the plugin is not mounted. */
    sendSms: SendSms;
    /**
     * How the JOIN step's code reaches a mailbox.
     *
     * The same sender the ordinary email sign in uses, handed in rather than
     * reached for, so there is one place that knows how a code reaches a person
     * and one debug-log rule covering both.
     */
    sendEmailOtp: SendOtp;
    /** How the losing account is told its number left (AC-8). */
    sendPhoneRemovedNotice: SendPhoneRemovedNotice;
}
/**
 * The send cap, as a plugin of its own so it applies to EMAIL codes too.
 *
 * It is separate from `injishiPhone` because the two have different lifetimes:
 * a deployment with no SMS adapter still sends email codes and still has a
 * budget to protect, and F-S01 §9 asked for this on email long before phone sign
 * in existed. The ledger model is declared here, once, and `injishiPhone` reads
 * the same rows through the merged schema.
 *
 * It hooks the SEND paths rather than wrapping `sendVerificationOTP`, because
 * Better Auth may run that callback in the background, where a throw would never
 * reach the person and they would be told a code was sent that never was.
 *
 * `enforce: false` is for the DEMO instance, and only because its code is fixed.
 * Its personas are public, shared addresses, so a budget keyed on one of them is
 * spent by every visitor at once and locks the persona for all of them — while
 * guarding nothing, because the code is published and a deployed demo mails
 * none. The plugin stays installed either way: the ledger model is declared
 * here and `injishiPhone` reads it through the merged schema.
 */
export declare function otpSendCap({ enforce }?: {
    enforce?: boolean;
}): BetterAuthPlugin;
/**
 * The phone sign in plugin. Mounted under `AUTH_BASE_PATH`, so its endpoints are
 * `/api/auth/injishi-phone/*`.
 */
export declare function injishiPhone(options: InjishiPhoneOptions): BetterAuthPlugin;
//# sourceMappingURL=phone.d.ts.map