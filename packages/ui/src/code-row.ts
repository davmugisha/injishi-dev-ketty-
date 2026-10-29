/**
 * The rules of a one-time code field (`CodeInput`), as plain functions so `tests/code-row.test.ts` can check
 * them without a browser. Ported from feat/rentals (a5a879d9, "a pasted code is checked once").
 *
 * A code is checked without a press only when it ARRIVES: the field becomes complete, a whole code comes
 * at once (a paste, an autofill), or the last digit is typed again, as when a code is retyped from the
 * start. Changing a digit in the middle of a full code is not an arrival: checking on every keystroke
 * spent a code's five tries in five keys. And the same code is never checked twice in a row, so an
 * autofill that writes the code twice is checked once.
 */

/** Sign-in and signing codes have six digits. */
export const CODE_LENGTH = 6;

/** Digits only, at most `max` of them: "Your code is 047 600." gives "047600". */
export function digitsOf(raw: string, max: number = CODE_LENGTH): string {
  return raw.replace(/\D/g, "").slice(0, max);
}

/**
 * A paste. A whole code fills the field from the first box, whichever box it landed in; fewer digits go
 * in at the caret (`at`), replacing what was there. Null when the clipboard held no digits.
 */
export function pasteIntoCode(
  current: string,
  clipboard: string,
  at: number,
  length: number = CODE_LENGTH,
): { next: string; whole: boolean } | null {
  const digits = digitsOf(clipboard, length);
  if (!digits) return null;
  if (digits.length >= length) return { next: digits, whole: true };
  const start = Math.min(Math.max(0, at), current.length);
  const next = (current.slice(0, start) + digits + current.slice(start + digits.length)).slice(0, length);
  return { next, whole: false };
}

/** Did the code just arrive (see the top of this file)? */
export function codeArrived(
  previous: string,
  next: string,
  how: "type" | "paste",
  length: number = CODE_LENGTH,
): boolean {
  if (next.length !== length) return false;
  if (previous.length < length) return true;
  if (how === "paste") return true;
  // Both full: only a change to the last digit (retyping from the start ends there) is an arrival.
  for (let i = 0; i < length - 1; i++) if (previous[i] !== next[i]) return false;
  return previous[length - 1] !== next[length - 1];
}

/**
 * Whether to hand `next` to `onComplete` now, and what to remember: the code last handed over, kept
 * until the field is incomplete again.
 */
export function completion(
  lastFired: string | null,
  previous: string,
  next: string,
  how: "type" | "paste",
  length: number = CODE_LENGTH,
): { fire: boolean; lastFired: string | null } {
  if (next.length !== length) return { fire: false, lastFired: null };
  if (!codeArrived(previous, next, how, length) || lastFired === next) return { fire: false, lastFired };
  return { fire: true, lastFired: next };
}

/** "0:42", "1:05": the wait before a new code can be sent. */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
