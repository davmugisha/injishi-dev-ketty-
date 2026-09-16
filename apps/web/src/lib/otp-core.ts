import { DEMO_OTP_CODE, OTP_LENGTH } from "@injishi/auth/client";

/**
 * Everything the two OTP transports share (ADR-017, AC-13).
 *
 * There are two of them now. `lib/otp.ts` sends and verifies from the browser;
 * `lib/otp.server.ts` sends from a Server Action so the sign-in form works
 * before hydration. Verification cannot move: the Better Auth session cookie
 * belongs to the API origin, and a Server Action runs on the web origin, so it
 * could never set that cookie.
 *
 * Two transports is exactly the shape that used to go wrong here. Three
 * surfaces each had their own copy of this logic, each with its own error
 * wording and its own idea of what to do when the API was unreachable, and one
 * of them had the demo code retyped as a literal. That was closed by making
 * `lib/otp.ts` the one owner; splitting the transports would reopen it. So the
 * ceiling, the email test, the digit handling and every sentence a visitor can
 * read live HERE, once, and each transport adds nothing but its own network
 * call. An addition made to one transport instead of to this file is the bug.
 *
 * This module is runtime-neutral on purpose: no window, no fetch, no auth
 * client. Both runtimes import it, so anything browser-only put here breaks
 * the server at request time rather than at build time.
 */

/** Re-exported so no app file ever restates the code length or the demo code. */
export { DEMO_OTP_CODE, OTP_LENGTH };

/**
 * Ceiling on one auth round trip.
 *
 * Both calls sit under a button somebody is watching, and neither Better Auth
 * nor the server guarantees a prompt answer — sending a code awaits an
 * outbound mail call server-side, so a stalled provider used to leave the
 * button spinning forever with nothing to retry. A request that has not
 * answered by now is treated as one that will not.
 *
 * IT MUST STAY ABOVE THE API'S OWN WORST CASE FOR THE SAME REQUEST, and at
 * 12 s it was not. That number was calibrated against a HUNG port — ADR-017's
 * check blocks 8000 and watches the button come back — and never against how
 * long a HEALTHY send can take, so nothing tied it to what the API is allowed
 * to spend. A slow-but-working API therefore read as a dead one:
 * `/email-otp/send-verification-otp` answered 200 with the code delivered
 * while the browser had already given up and said the service was not
 * responding, stranding the visitor on /sign-in holding a live code with no
 * screen to type it into.
 *
 * The budget this has to clear, measured against the dev stack:
 *
 *   serverless database wake   ~16 s  Neon suspends its compute after ~5 min
 *                                     idle and drops the connections it was
 *                                     holding, so the next query pays the full
 *                                     wake — and sign-in is normally the first
 *                                     query anyone makes.
 *   Better Auth's own queries   ~2 s  a few remote round trips, ~0.4 s each.
 *   mail delivery               ≤8 s  `OtpMailer.SEND_TIMEOUT_MS` on the API,
 *                                     its own hard ceiling on the Resend call,
 *                                     which Better Auth awaits in-request.
 *
 * That is ~26 s of legitimate work, and one cold send measured 17.7 s end to
 * end against 2.2 s warm. This ceiling sits above the whole budget on purpose,
 * so that tripping it means the API really is not answering — which is what
 * the sentence it produces claims. Lower it back under that sum and the
 * sentence becomes a lie again.
 */
export const AUTH_TIMEOUT_MS = 30_000;

export const TIMED_OUT = Symbol("otp-timeout");

/** Race a promise against the ceiling. Resolves to TIMED_OUT rather than throwing. */
export async function withTimeout<T>(work: Promise<T>): Promise<T | typeof TIMED_OUT> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<typeof TIMED_OUT>((resolve) => {
        timer = setTimeout(() => resolve(TIMED_OUT), AUTH_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** The one email test. Both transports refuse on the same input. */
export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

/** Strip anything that is not a digit and clamp to the code length. */
export function sanitizeOtp(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, OTP_LENGTH);
}

export function isCompleteOtp(code: string): boolean {
  return code.trim().length === OTP_LENGTH;
}

/**
 * Every sentence a visitor can read from either transport.
 *
 * One definition per failure. A transport that words its own refusal has
 * started the drift this file exists to prevent.
 */
export const OTP_MESSAGES = {
  emailMissing: "Enter your email address.",
  emailInvalid: "That email address doesn't look right. Check it and try again.",
  timedOut:
    "Our sign-in service is taking longer than it should. Give it a moment, then try again.",
  sendFailed:
    "We couldn't send your code just now — that's on our side. Try again in a moment.",
  sendRateLimited:
    "We've sent a lot of codes to this address recently, so we've paused for a while. Try again in an hour — the last code we sent still works until it expires.",
  sendThrottled:
    "That's a lot of codes asked for in a short time. Wait a minute, then try again.",
  verifyFailed:
    "We couldn't sign you in with that code. Try again, or send yourself a new one.",
  verifyExpired: "That code has expired. We can send you a new one.",
  verifyMismatch:
    "That code doesn't match. Check the latest email from us and try again.",
  verifyAttempts:
    "That code has had too many tries, so it stopped working. We can send you a new one.",
  verifyRateLimited:
    "That's a lot of tries in a short time. Wait a minute, then try again.",
  verifyUnreachable:
    "We couldn't check your code — our sign-in service didn't answer. Your code still works for a few minutes; try again.",
  incomplete: `Enter all ${OTP_LENGTH} digits.`,
  offlineMismatch: `Sign-in is offline right now, so this is a practice run: use ${DEMO_OTP_CODE}. It won't sign you in.`,
  offlineNotice: `Sign-in is offline right now, so this is a practice run: the code is ${DEMO_OTP_CODE}, and it won't sign you in.`,
} as const;

/**
 * WHY THE SERVER'S OWN SENTENCE IS NEVER SHOWN.
 *
 * Both transports used to fall back to `res.error.message`, which is Better
 * Auth's wording, not ours: a person who mistyped one digit read "Invalid OTP",
 * and somebody whose code had aged out read "OTP expired" — the same flat
 * refusal for two situations with two different next steps. Worse, it is
 * library text that can change under us and be read by a guest.
 *
 * So a failure is CLASSIFIED here, from the error code Better Auth's email-OTP
 * plugin sets (`OTP_EXPIRED`, `INVALID_OTP`, `TOO_MANY_ATTEMPTS` — see
 * `node_modules/better-auth/dist/plugins/email-otp/error-codes.mjs`) and from
 * our own `otpSendCap` plugin's `RATE_LIMITED`, and the reason decides both the
 * sentence and what the screen does next.
 */
export type OtpFailure =
  /** The code aged out. A new one is the only way forward. */
  | "expired"
  /** Wrong digits, or a code superseded by a newer one. Retypeable. */
  | "mismatch"
  /** Too many wrong guesses; the code has been invalidated server-side. */
  | "attempts"
  /** Sending or checking has been throttled. Waiting is the next step. */
  | "rate-limited"
  /** The address itself was refused. */
  | "invalid-email"
  /** Ours to own: unreachable, timed out, or a refusal we cannot read. */
  | "system"
  /** The person has not finished typing. */
  | "incomplete";

/** The shape both transports see on a refusal, whatever made it. */
export interface OtpError {
  code?: unknown;
  status?: unknown;
}

function codeOf(error: OtpError): string {
  return typeof error.code === "string" ? error.code.toUpperCase() : "";
}

function statusOf(error: OtpError): number {
  return typeof error.status === "number" ? error.status : 0;
}

/** Classify a refused SEND. Used by both transports, browser and Server Action. */
export function sendFailure(error: OtpError): {
  reason: OtpFailure;
  message: string;
} {
  const code = codeOf(error);
  const status = statusOf(error);
  if (code === "INVALID_EMAIL") {
    return { reason: "invalid-email", message: OTP_MESSAGES.emailInvalid };
  }
  // Two different refusals share a 429, and they have different waits. Only our
  // own send cap (`otpSendCap`) sets `RATE_LIMITED`, and it pauses for an hour.
  // A bare 429 is Better Auth's per-IP limiter, whose window is sixty seconds:
  // telling that person "an hour" sends them away for nothing.
  if (code === "RATE_LIMITED") {
    return { reason: "rate-limited", message: OTP_MESSAGES.sendRateLimited };
  }
  if (status === 429) {
    return { reason: "rate-limited", message: OTP_MESSAGES.sendThrottled };
  }
  return { reason: "system", message: OTP_MESSAGES.sendFailed };
}

/** Classify a refused VERIFY, which has three outcomes a person can act on. */
export function verifyFailure(error: OtpError): {
  reason: OtpFailure;
  message: string;
} {
  const code = codeOf(error);
  const status = statusOf(error);
  if (code === "OTP_EXPIRED") {
    return { reason: "expired", message: OTP_MESSAGES.verifyExpired };
  }
  if (code === "TOO_MANY_ATTEMPTS") {
    return { reason: "attempts", message: OTP_MESSAGES.verifyAttempts };
  }
  if (code === "INVALID_OTP") {
    return { reason: "mismatch", message: OTP_MESSAGES.verifyMismatch };
  }
  if (code === "RATE_LIMITED" || status === 429) {
    return { reason: "rate-limited", message: OTP_MESSAGES.verifyRateLimited };
  }
  // A refusal we cannot name is ours to own, not theirs to decode.
  return { reason: "system", message: OTP_MESSAGES.verifyFailed };
}

/**
 * How the code was issued, which decides how it must be verified.
 *
 * `offline` is the no API fallback: the send could not reach the API at all,
 * so the pages stay walkable with the fixed code and sign nobody in. It was
 * called `demo` until ADR-043 (AC-24), which read as the demo ENVIRONMENT, a
 * real deployment that does sign people in. The two have nothing in common.
 */
export type OtpMode = "live" | "offline";

export type SendOtpResult =
  | { ok: true; mode: OtpMode }
  | { ok: false; message: string; reason: OtpFailure };

/**
 * `reason` is not decoration: the screen reads it. An expired or burnt code
 * has to send the person to Resend, and a mistyped one has to leave the digits
 * where they are and put the caret back — the same red line under both is what
 * made this screen feel like a wall.
 */
export type VerifyOtpResult =
  | { ok: true; mode: OtpMode }
  | { ok: false; message: string; reason: OtpFailure };

/** True when the only way forward is a fresh code. */
export function needsNewCode(reason: OtpFailure): boolean {
  return reason === "expired" || reason === "attempts";
}
