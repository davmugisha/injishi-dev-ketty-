/**
 * The six-digit code of frame X2, as data rather than as component state.
 *
 * ADR-038 child 1b task 7 retired the fixtures that used to live here. There is
 * no `verifyCode()` any more and no `VERIFY_MS` pause pretending to be a round
 * trip: `verifySignInCode()` in `src/lib/auth.ts` posts to
 * `/api/auth/sign-in/email-otp` and the server decides, which is the only thing
 * that ever could.
 *
 * `DEMO_CODE` survives, and its meaning changed. It used to BE the server. It
 * is now a value the demo environment publishes — the same constant
 * `packages/auth` hands `emailOTP` as `generateOTP` on a demo host — printed on
 * the screen only where the API reports that environment (AC-E14). The code is
 * still generated, stored hashed and verified normally there; it is
 * deterministic, not bypassed.
 */

/** Digits in a code. Six, per frame X2 and F-S01. */
export const CODE_LENGTH = 6;

/**
 * The code the demo environment publishes.
 *
 * Kept in step with `DEMO_OTP_CODE` in `packages/auth`. It is a constant here
 * rather than a literal inside the screen so the copy on the screen and the
 * code the screen prefills cannot drift apart: the footnote interpolates this
 * same value, so a reviewer is always told the code that actually works.
 *
 * **Only ever shown where the API says this is the demo host.** On any other
 * host it is not printed, not prefilled, and not relevant.
 */
export const DEMO_CODE = '123456';

/**
 * How long before the resend control unlocks.
 *
 * **A client courtesy, not the server's rule.** The send endpoint answers
 * `{ success: true }` and states no cooldown; it rate limits and answers 429
 * when you are too quick, but it never publishes how long you must wait. So
 * nothing is being read here — this is a number chosen to keep somebody from
 * hammering a button, and the server is what actually enforces the limit. Frame
 * X2 starts its countdown at 0:42 and that is where this came from.
 */
export const RESEND_SECONDS = 42;

/** How long the error shake or, under reduced motion, the colour flash runs. */
export const ERROR_FLASH_MS = 420;

/**
 * Everything typed or pasted, reduced to at most six digits.
 *
 * The paste case is the reason this exists: a code arriving as
 * `Your Injishi code is 123456` or `123 456` is the same six digits, and a
 * field that refuses either is a field people retype by hand.
 */
export function sanitizeCode(input: string): string {
  return input.replace(/\D/g, '').slice(0, CODE_LENGTH);
}

/** Six digits entered. This is what auto-submit waits for. */
export function isCodeComplete(code: string): boolean {
  return code.length === CODE_LENGTH;
}
