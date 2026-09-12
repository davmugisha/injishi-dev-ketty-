"use server";

import { redirect } from "next/navigation";

import { AUTH_BASE_PATH } from "@injishi/auth/client";

import { API_URL } from "@/lib/api";
import {
  OTP_MESSAGES,
  TIMED_OUT,
  isValidEmail,
  sendFailure,
  withTimeout,
  type OtpMode,
} from "@/lib/otp-core";

/**
 * Sending a sign-in code from the SERVER (ADR-017, AC-3).
 *
 * This exists so the sign-in form works with JavaScript disabled. The capture
 * this replaced shipped its Continue button `disabled` and enabled it from a
 * DOM script after hydration, so the button did nothing at all until the
 * client bundle arrived. A form that posts needs no bundle.
 *
 * IT SENDS AND IT NEVER VERIFIES. That is not a step somebody left unfinished.
 * Sending a code sets no cookie, so this half moves to the server for free.
 * Verifying sets the Better Auth session cookie, which belongs to the API
 * origin — a Server Action runs on the web origin and cannot set it. Moving
 * verification here would mean proxying Set-Cookie and making this app a
 * second handler of session identity, which needs its own decision record.
 *
 * THREE DETAILS THAT LOOK OPTIONAL AND ARE NOT:
 *
 * 1. The redirect target arrives as a BOUND argument, not from the form and
 *    not from the query string. The page resolves `?redirect=` through
 *    `safeRedirect` and binds the result, so the exact-origin allowlist has
 *    already run by the time this function can see the value. Reading it here
 *    instead would put an attacker-controlled string inside the action, and a
 *    hidden input would put it inside markup anyone can edit.
 *
 * 2. The transport is a plain fetch, never `authClient`. That client is built
 *    by `createAuthClient` from better-auth/react and assumes browser cookie
 *    and storage APIs that do not exist here.
 *
 *    The path is `<base>/email-otp/send-verification-otp`, and the base comes
 *    from `AUTH_BASE_PATH` in `@injishi/auth/client` rather than being typed
 *    out. ADR-017 wrote this endpoint as `/sign-in/email-otp/...`, which is
 *    what the CLIENT METHOD is called, not where Better Auth mounts it: the
 *    email-OTP plugin registers `/email-otp/send-verification-otp`. The wrong
 *    path answers 404, which reads as a refused send rather than a missing
 *    route, so it would have looked like a server problem forever. The ADR's
 *    Value sourcing table is corrected to match.
 *
 * 3. `redirect()` sits OUTSIDE the try/catch. Next implements it by throwing a
 *    NEXT_REDIRECT control error, so a catch wrapped around both the fetch and
 *    the redirect swallows it and the navigation silently never happens.
 */

/**
 * `attempt` counts refusals so the form can re-announce and re-animate a
 * repeated one: an identical string in the same DOM node is a silent screen
 * reader and a line that never moves, which reads as a press that did nothing.
 *
 * `fixEmail` says the ADDRESS was the problem, so the form knows to hand focus
 * back to the field rather than leaving it on the button — and knows not to,
 * when the fault was ours and pressing again is the right next move.
 */
export type SendCodeState = {
  error?: string;
  email?: string;
  attempt?: number;
  fixEmail?: boolean;
};

export async function sendCodeAction(
  redirectTo: string,
  prev: SendCodeState,
  formData: FormData,
): Promise<SendCodeState> {
  const email = String(formData.get("email") ?? "").trim();
  const attempt = (prev.attempt ?? 0) + 1;

  if (!email) {
    return { error: OTP_MESSAGES.emailMissing, email, attempt, fixEmail: true };
  }
  if (!isValidEmail(email)) {
    return { error: OTP_MESSAGES.emailInvalid, email, attempt, fixEmail: true };
  }

  let mode: OtpMode;

  try {
    const res = await withTimeout(
      fetch(`${API_URL}${AUTH_BASE_PATH}/email-otp/send-verification-otp`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ email, type: "sign-in" }),
      }),
    );

    // Answered too slowly to be useful, and we cannot tell whether a code went
    // out — so we must not claim one did, and must not send them to a screen
    // that will ask for a code nobody issued.
    if (res === TIMED_OUT) return { error: OTP_MESSAGES.timedOut, email, attempt };

    if (!res.ok) {
      // The body carries Better Auth's own wording, and a guest must never read
      // it. Only the CODE is taken from it; the sentence is ours (`sendFailure`
      // in `lib/otp-core.ts`, which the browser transport shares).
      const body: unknown = await res.json().catch(() => null);
      const code =
        body && typeof body === "object" && "code" in body
          ? (body as { code?: unknown }).code
          : undefined;
      const failure = sendFailure({ code, status: res.status });
      return {
        error: failure.message,
        email,
        attempt,
        fixEmail: failure.reason === "invalid-email",
      };
    }

    mode = "live";
  } catch {
    // Transport failed outright: the API is not running. The pages stay
    // walkable with no backend (offline mode), exactly as the browser
    // transport does. No session is created and no server trusts the outcome.
    mode = "offline";
  }

  const target = new URLSearchParams({ email, redirect: redirectTo, mode });
  redirect(`/verify-otp?${target.toString()}`);
}
