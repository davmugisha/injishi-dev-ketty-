/**
 * Phone redaction, on the READ path only.
 *
 * The mobile twin of `server/api/src/modules/operations/application/scrub.ts`
 * (ADR-032 child "the guest messaging surface"). It exists here because the
 * prototype has no API: the fixture stores a body verbatim, exactly as the ADR
 * requires, and this is what stands between that body and the screen.
 *
 * **The stored body is never altered, and that is the decision, not an
 * implementation detail.** `architecture-schema.md` §6.7 says messages are
 * append only and never rewritten; F-S06 says a phone number is never exposed.
 * Scrubbing on WRITE satisfies the second by breaking the first, and it
 * destroys the evidence the `off_platform_leakage` escalation type exists to
 * act on. Redacting on read satisfies both, so the fixture in
 * `./threads.ts` holds the number the sender typed and this hides it.
 *
 * The pattern covers Rwandan numbers in the forms people actually type:
 * local `07x xxx xxxx`, international `+250 7xx xxx xxx`, separated by spaces,
 * dots or hyphens, plus any run of digits long enough to be a number whatever
 * the formatting. It is a heuristic and it WILL have false positives — a room
 * number, a flight code, a long reference. The ADR names that as the correct
 * direction to fail in.
 *
 * **What the ADR does not settle, and this file therefore decides:** the
 * replacement. `scrub.ts` is specified as "one pure function" called from
 * `presentMessage()`, and nothing in the ADR says what a redacted run looks
 * like once it reaches a reader. Returning SEGMENTS rather than a rewritten
 * string is that decision: the screen draws the redaction as its own inline
 * mark with its own translated label, so the placeholder is UI copy in the
 * message catalogue rather than a magic string baked into a shared function
 * that the API would then have to match character for character. When the real
 * `scrub.ts` lands it only has to agree about WHICH RUNS are numbers.
 */

/** A run of the body, either shown as typed or hidden. */
export interface ScrubSegment {
  kind: 'text' | 'redacted';
  value: string;
}

/**
 * The one pattern, in three alternatives, most specific first.
 *
 *   1. `+250` (or `00250`) followed by nine digits, separators anywhere.
 *   2. A local mobile number: `07` and eight more digits, separators anywhere.
 *   3. Any bare run of seven or more digits — the catch-all the ADR asks for,
 *      "long enough to be a number regardless of formatting".
 *
 * `[\s.-]*` between digits rather than `?` because people type
 * `+250 78 84 31 209` as readily as `+250788431209`.
 */
const PHONE =
  /(?:\+|00)\s*250(?:[\s.-]*\d){9}|\b0(?:[\s.-]*\d){9}\b|\b(?:\d[\s.-]*){6}\d\b/g;

/**
 * Split a message body into shown and hidden runs.
 *
 * Pure, and total: every character of `body` appears in exactly one segment, in
 * order, so a caller that concatenates the values gets the input back. That is
 * what makes it safe to render — a screen cannot drop text by mishandling the
 * result, only reveal or hide it.
 */
export function scrubPhones(body: string): ScrubSegment[] {
  const segments: ScrubSegment[] = [];
  let cursor = 0;

  // `matchAll` needs the global flag and a fresh lastIndex; the literal above
  // is module level, so iterate a copy rather than mutating shared state.
  for (const match of body.matchAll(new RegExp(PHONE.source, 'g'))) {
    const at = match.index ?? 0;
    if (at > cursor) segments.push({ kind: 'text', value: body.slice(cursor, at) });
    segments.push({ kind: 'redacted', value: match[0] });
    cursor = at + match[0].length;
  }

  if (cursor < body.length) segments.push({ kind: 'text', value: body.slice(cursor) });
  return segments;
}

/** Whether a body holds anything this would hide. Cheaper than splitting. */
export function hasPhone(body: string): boolean {
  return new RegExp(PHONE.source, 'g').test(body);
}

/**
 * The body as one string, with each hidden run replaced by `placeholder`.
 *
 * For the places that cannot draw segments — a thread row's one-line preview, a
 * screen reader label, a notification body. The screen supplies the translated
 * placeholder, for the reason in the file header.
 */
export function scrubbedText(body: string, placeholder: string): string {
  return scrubPhones(body)
    .map((s) => (s.kind === 'redacted' ? placeholder : s.value))
    .join('');
}
