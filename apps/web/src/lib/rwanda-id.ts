/**
 * The Rwandan National ID rule, as one function the form and the review step
 * both ask.
 *
 * It exists as its own module rather than inside the step because three
 * different surfaces need the same answer — the field validates as you type,
 * the wizard refuses to advance, and `@injishi/contracts` validates again on
 * the way to the API — and a rule copied into three places is a rule that
 * disagrees with itself the first time one copy is edited. This one is written
 * to match `RwandanNationalId` in the contract exactly: sixteen digits, spaces
 * stripped first. Where the two ever disagree the contract wins, because it is
 * what the server enforces; this is the affordance that stops a person finding
 * out after a round trip.
 *
 * NO IMPORTS, AND NO NON-ERASABLE SYNTAX. This module is loaded directly by a
 * verification script under Node's type stripping, which erases annotations and
 * refuses to emit code — so an enum, a namespace, a decorator or a parameter
 * property here would turn that check into a crash rather than a result. Plain
 * functions and `const` only.
 */

/** How many digits a Rwandan National ID carries. */
export const NATIONAL_ID_DIGITS = 16;

/**
 * Why this value is not a National ID, or `null` when it is one.
 *
 * Internal spaces are TOLERATED rather than merely trimmed. A Rwandan NID is
 * printed in groups on the card itself, and the number people read out and type
 * is `1 1995 8 0012345 12 3`. A field that refuses the spacing on the document it
 * is asking you to copy is a field people abandon, so the spaces come out before
 * anything is judged and the caller keeps whatever the person typed.
 *
 * The reasons are separate sentences on purpose: "that is not 16 digits" and
 * "that has letters in it" are different mistakes with different fixes, and one
 * generic "invalid" message makes a person retype a correct number looking for a
 * typo that is not there.
 */
export function nationalIdError(value: string): string | null {
  const digits = stripSpaces(value);

  if (digits.length === 0) {
    return "Enter the 16 digit National ID number on your card.";
  }
  if (!/^\d+$/.test(digits)) {
    return "A National ID is digits only — check for a stray letter or dash.";
  }
  if (digits.length !== NATIONAL_ID_DIGITS) {
    // The count is named rather than implied. "Too short" makes a person count
    // sixteen characters by eye; "that is 15 digits" tells them what to look for.
    return `That is ${digits.length} digits. A Rwandan National ID is ${NATIONAL_ID_DIGITS}.`;
  }
  return null;
}

/**
 * The number grouped the way it is printed on the card, for reading back.
 *
 * `1 1995 8 0012345 12 3` — issue century, year of birth, gender, sequence,
 * origin, check digit. Anything that is not sixteen digits is returned
 * untouched, because grouping a half-typed number moves the caret and makes the
 * field feel broken while somebody is still typing into it.
 */
export function formatNationalId(value: string): string {
  const digits = stripSpaces(value);
  if (digits.length !== NATIONAL_ID_DIGITS || !/^\d+$/.test(digits)) return value;
  return [
    digits.slice(0, 1),
    digits.slice(1, 5),
    digits.slice(5, 6),
    digits.slice(6, 13),
    digits.slice(13, 15),
    digits.slice(15, 16),
  ].join(" ");
}

/** Every kind of whitespace, not just the space bar — a paste can carry a tab. */
function stripSpaces(value: string): string {
  return value.replace(/\s+/g, "");
}
