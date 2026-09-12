/**
 * Phone redaction on read (ADR-032, AC-18).
 *
 * One pure function, called from `presentMessage()` so that both the guest and
 * the operator surface redact through a single call site.
 *
 * **The stored body is never altered.** `architecture-schema.md` §6.7 makes
 * `messages` append only and says a message is never rewritten; F-S06 says a
 * phone number is never exposed. Scrubbing on write would satisfy the second by
 * breaking the first, and it would destroy the evidence the
 * `off_platform_leakage` escalation type exists to act on. Redacting on the way
 * out satisfies both: the row is what the person typed, and no reader sees the
 * number.
 *
 * This is a heuristic and it will have false positives. A run of digits that is
 * really a flight code, an invoice number or a long room number reads the same
 * as a phone number once the separators are stripped. That is the correct
 * direction to fail in — a redacted invoice number is an annoyance, an exposed
 * phone number is the leak the rule exists to stop.
 *
 * The forms it has to cover are the ones people actually type in Rwanda:
 *
 *   0788 123 456      local, spaced
 *   078-812-3456      local, hyphenated
 *   078.812.3456      local, dotted
 *   +250 788 123 456  international, spaced
 *   +250788123456     international, run together
 *   788123456         the subscriber part alone
 *
 * ADR-032 carries a follow-up asking for a pinned fixture of real examples
 * before this pattern is trusted. Until that exists, treat the bounds below as
 * a first cut rather than as a settled rule.
 */

/**
 * A run that could be a written phone number: an optional `+`, then digits with
 * spaces, dots or hyphens between them, ending on a digit.
 *
 * The character class deliberately excludes letters, so a sentence never joins
 * two unrelated numbers into one candidate. Length is bounded so a malicious
 * body cannot hand the engine a pathological run to chew on.
 */
const PHONE_LIKE = /\+?\d[\d\s.-]{6,24}\d/g;

/**
 * How many digits a candidate must hold to be treated as a number.
 *
 * Nine is the Rwandan subscriber part on its own (`788123456`); fifteen is the
 * E.164 ceiling, so anything longer is not a phone number in any country. Below
 * nine sits every ordinary quantity a message contains — a price, a date, a
 * room number — and redacting those would make the surface unreadable.
 */
const MIN_DIGITS = 9;
const MAX_DIGITS = 15;

/** What the reader sees in place of the number. */
export const REDACTED = '[number hidden]';

/**
 * Redact anything that reads as a phone number.
 *
 * Null in, null out: a voice or image message carries no body, and this must
 * not invent one.
 */
export function scrubPhoneNumbers(body: string | null): string | null {
  if (body === null || body === '') {
    return body;
  }

  return body.replace(PHONE_LIKE, (match) => {
    const digits = match.replace(/\D/g, '').length;
    return digits >= MIN_DIGITS && digits <= MAX_DIGITS ? REDACTED : match;
  });
}
