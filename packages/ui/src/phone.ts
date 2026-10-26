/**
 * Phone numbers as the forms take them and the API stores them: E.164 (`+250788123456`).
 *
 * The Rwandan rule is the same as contracts' `normalizeRwPhone` (`packages/contracts/src/phone.ts`), kept
 * as a copy because the kit does not import contracts (zod 3 there, zod 4 in the app);
 * `tests/phone.test.ts` checks the two agree on every spelling it tries.
 */

/** The prefixes a Rwandan mobile number carries after +250 (MTN 78/79, Airtel 72/73). */
export const RW_MOBILE_PREFIXES = ["72", "73", "78", "79"] as const;

/** Spaces, dashes, brackets and dots people put between digits. */
const SEPARATORS = /[\s\-().]/g;
const RW_E164 = /^\+250(72|73|78|79)\d{7}$/;

/**
 * A Rwandan mobile number in its stored form, or null when it is not one. Takes the ways people write
 * their own number: `0788123456`, `788123456`, `250788123456`, `+250788123456`, with spaces, dashes or
 * brackets anywhere.
 */
export function normaliseRwPhone(raw: string): string | null {
  const bare = raw.replace(SEPARATORS, "");
  if (!/^\+?\d+$/.test(bare)) return null;
  const digits = bare.replace(/^\+/, "");
  let national: string;
  if (digits.startsWith("250")) national = digits.slice(3);
  else if (digits.startsWith("0")) national = digits.slice(1);
  else national = digits;
  const candidate = `+250${national}`;
  return RW_E164.test(candidate) ? candidate : null;
}

/** Whether `raw` is a Rwandan mobile number, however it is spaced. */
export function isRwMobile(raw: string): boolean {
  return normaliseRwPhone(raw) !== null;
}

/**
 * A number from another country, written with its country code (`+256 772 123 456`), in E.164: a plus,
 * then 8 to 15 digits, the first not 0. Rwandan numbers (+250) go through the Rwandan rule.
 */
export function normaliseIntlPhone(raw: string): string | null {
  const bare = raw.trim().replace(SEPARATORS, "");
  if (bare.startsWith("+250")) return normaliseRwPhone(bare);
  if (bare.startsWith("00")) return normaliseIntlPhone(`+${bare.slice(2)}`);
  return /^\+[1-9]\d{7,14}$/.test(bare) ? bare : null;
}

export interface PhoneRules {
  /** Also take numbers from other countries, typed with their + code. @default false */
  allowInternational?: boolean;
}

/** The stored form of what was typed, or null when it is not a number the field takes. */
export function normalisePhone(raw: string, { allowInternational = false }: PhoneRules = {}): string | null {
  const text = raw.trim();
  if (allowInternational && (text.startsWith("+") || text.startsWith("00"))) return normaliseIntlPhone(text);
  return normaliseRwPhone(text);
}

export const RW_PHONE_MESSAGE = "Enter a Rwandan mobile number, like 0788 123 456.";
export const INTL_PHONE_MESSAGE = "Enter the number with its country code, like +256 772 123 456.";

/** What is wrong with a typed number, in words, or null when it is fine (or empty: required is the form's). */
export function phoneProblem(raw: string, rules: PhoneRules = {}): string | null {
  const text = raw.trim();
  if (!text) return null;
  if (normalisePhone(text, rules)) return null;
  if (
    rules.allowInternational &&
    (text.startsWith("+") || text.startsWith("00")) &&
    !text.replace(SEPARATORS, "").startsWith("+250")
  ) {
    return INTL_PHONE_MESSAGE;
  }
  return RW_PHONE_MESSAGE;
}

/** "+250 788 123 456" for a Rwandan number; other numbers as stored. */
export function formatPhone(e164: string): string {
  const m = /^\+250(\d{3})(\d{3})(\d{3})$/.exec(e164);
  return m ? `+250 ${m[1]} ${m[2]} ${m[3]}` : e164;
}

/** "0788 123 456": a Rwandan number as people write it at home; other numbers as stored. */
export function formatLocalPhone(e164: string): string {
  const m = /^\+250(\d{3})(\d{3})(\d{3})$/.exec(e164);
  return m ? `0${m[1]} ${m[2]} ${m[3]}` : e164;
}

/** What the field shows for a stored number: "788 123 456" beside its +250, or the whole number. */
export function phoneFieldText(e164: string): string {
  const m = /^\+250(\d{3})(\d{3})(\d{3})$/.exec(e164);
  return m ? `${m[1]} ${m[2]} ${m[3]}` : e164;
}
