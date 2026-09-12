"use client";

import { authClient } from "@/lib/auth-client";
import {
  DEMO_OTP_CODE,
  OTP_LENGTH,
  OTP_MESSAGES,
  TIMED_OUT,
  isCompleteOtp,
  isValidEmail,
  needsNewCode,
  sanitizeOtp,
  sendFailure,
  verifyFailure,
  withTimeout,
  type OtpFailure,
  type OtpMode,
  type SendOtpResult,
  type VerifyOtpResult,
} from "@/lib/otp-core";

/**
 * Email one-time-code sign-in from the BROWSER (F-S01).
 *
 * This file is now one of two transports. It keeps the whole public surface it
 * had, because `BookingConfirm`, `/verify-otp` and `/activate` all call it and
 * ADR-017's rollback story depends on slice 1 not moving what slices 2 and 3
 * still use. What changed is where the shared parts live: the ceiling, the
 * email test, the digit handling and every visitor-facing sentence moved to
 * `lib/otp-core.ts`, which the Server Action transport imports too. Nothing
 * here restates any of them.
 *
 * VERIFICATION STAYS HERE AND CANNOT MOVE. The Better Auth session cookie
 * belongs to the API origin and the web app runs on its own, so only a browser
 * call carrying credentials can end up signed in. A Server Action that
 * verified would have to proxy the cookie, which makes this app a second
 * handler of session identity — see ADR-017.
 *
 * The offline branch matters and is deliberate: these pages are walkable with
 * no backend running, so when the transport fails outright we fall back to the
 * fixed code locally (`mode: "offline"`). That is an affordance, never an auth
 * decision — it produces no session cookie and no server trusts it. Anything
 * that needs an identity must check the session (see lib/session.ts), never
 * this module's return value alone. It is NOT the demo environment, which is a
 * real API that signs people in (ADR-043).
 */
export {
  DEMO_OTP_CODE,
  OTP_LENGTH,
  OTP_MESSAGES,
  TIMED_OUT,
  isValidEmail,
  needsNewCode,
  sanitizeOtp,
  withTimeout,
};
export type { OtpFailure, OtpMode, SendOtpResult, VerifyOtpResult };

/** Ask the server to email a code. Falls back to offline mode when it can't. */
export async function sendOtp(email: string): Promise<SendOtpResult> {
  const address = email.trim();
  if (!address) {
    return { ok: false, message: OTP_MESSAGES.emailMissing, reason: "invalid-email" };
  }

  try {
    const res = await withTimeout(
      authClient.emailOtp.sendVerificationOtp({
        email: address,
        type: "sign-in",
      }),
    );
    // Answered too slowly to be useful, and we cannot tell whether a code went
    // out — so we must not claim one did, and must not offer the offline code
    // either, which would tell them to type the wrong thing.
    if (res === TIMED_OUT) {
      return { ok: false, message: OTP_MESSAGES.timedOut, reason: "system" };
    }
    if (res.error) {
      // Never `res.error.message`: that is Better Auth talking to a guest.
      return { ok: false, ...sendFailure(res.error) };
    }
    return { ok: true, mode: "live" };
  } catch {
    // Transport failed outright: the API is not running. Offline mode, no session.
    return { ok: true, mode: "offline" };
  }
}

/**
 * Verify a code. In `live` mode a success sets a real session cookie; in
 * `offline` mode it only unlocks the local flow.
 */
export async function verifyOtp(
  email: string,
  code: string,
  mode: OtpMode,
): Promise<VerifyOtpResult> {
  const otp = sanitizeOtp(code);
  if (!isCompleteOtp(otp)) {
    return { ok: false, message: OTP_MESSAGES.incomplete, reason: "incomplete" };
  }

  if (mode === "offline") {
    return otp === DEMO_OTP_CODE
      ? { ok: true, mode: "offline" }
      : { ok: false, message: OTP_MESSAGES.offlineMismatch, reason: "mismatch" };
  }

  try {
    const res = await withTimeout(
      authClient.signIn.emailOtp({ email: email.trim(), otp }),
    );
    if (res === TIMED_OUT) {
      return { ok: false, message: OTP_MESSAGES.timedOut, reason: "system" };
    }
    if (res.error) {
      // An expired code, a mistyped one and a burnt one are three different
      // situations with three different next steps (see `verifyFailure`).
      return { ok: false, ...verifyFailure(res.error) };
    }
    return { ok: true, mode: "live" };
  } catch {
    return {
      ok: false,
      message: OTP_MESSAGES.verifyUnreachable,
      reason: "system",
    };
  }
}
