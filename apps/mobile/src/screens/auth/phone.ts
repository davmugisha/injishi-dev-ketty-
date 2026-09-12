/**
 * The Rwandan mobile number, as frame X1 draws it: a fixed `RW +250` prefix
 * segment and nine digits grouped `788 123 456`.
 *
 * Pure functions, deliberately. The screen holds nine digits and nothing else;
 * the grouping, the country-code strip and the network test are arithmetic on
 * a string, and arithmetic that lives in a component is arithmetic nobody can
 * test without mounting a keyboard.
 *
 * **What is stored is always the nine bare digits.** The spaces are a rendering
 * of that value, never part of it — which is what makes a paste of
 * `+250 788 123 456`, `0788123456` and `788123456` all land on the same number.
 * A leading `250` or a leading `0` is a country code and a trunk prefix
 * respectively, and both are the same nine digits wearing a longer coat.
 *
 * The four network prefixes are the live ones: MTN holds 78 and 79, Airtel
 * holds 72 and 73. They are what turns "nine digits" into "a number that could
 * receive an SMS", and they are the reason this screen has an error state at
 * all when there is no network behind it (decision D2).
 */

/** Digits after the country code. Rwanda's mobile plan is fixed at nine. */
export const PHONE_DIGITS = 9;

/** MTN 78/79, Airtel 72/73. Every live Rwandan mobile prefix. */
export const MOBILE_PREFIXES = ['72', '73', '78', '79'] as const;

/**
 * Everything typed or pasted, reduced to the nine digits the number actually
 * is. Order matters: strip to digits, then shed a country code, then shed a
 * trunk zero, then cap — a paste of `+250 (0)788 123 456` passes all four.
 */
export function digitsOf(input: string): string {
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('250')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, PHONE_DIGITS);
}

/** `788123456` -> `788 123 456`. Groups of three, no trailing space. */
export function formatPhone(digits: string): string {
  return (digits.match(/.{1,3}/g) ?? []).join(' ');
}

/** The full number as a person reads it back: `+250 788 123 456`. */
export function displayPhone(digits: string): string {
  return `+250 ${formatPhone(digits)}`.trim();
}

/** Nine digits entered. This is what enables Continue (frame X1). */
export function isComplete(digits: string): boolean {
  return digits.length === PHONE_DIGITS;
}

/**
 * Nine digits AND a real network prefix. This is what the hint reads
 * "Looks right" for, and its inverse is the field's error state.
 */
export function isPlausible(digits: string): boolean {
  return isComplete(digits) && MOBILE_PREFIXES.some((p) => digits.startsWith(p));
}
