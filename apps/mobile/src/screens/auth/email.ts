/**
 * The email address the app signs in with, as a shape rather than as a screen.
 *
 * ADR-038 child 1b. The prototype collected a Rwandan phone number, and nothing
 * behind it ever could: the login has been an email since F-S01,
 * `users_email_lower_uk` enforces one account per address, and `packages/auth`
 * registers exactly one plugin, `emailOTP`. `phone.ts` survives beside this
 * file because `pay-rent` and Account genuinely use a phone number; the auth
 * path no longer does.
 *
 * ## Why this predicate is loose on purpose
 *
 * It exists to enable Continue and to say "Looks right". It does NOT decide
 * whether an address is real, which only sending to it can settle. A stricter
 * pattern here would refuse addresses the server would have accepted, and that
 * is the worse of the two failures by a distance: a person with an unusual but
 * valid address cannot sign in at all, while a typo costs one round trip and a
 * readable refusal.
 *
 * So: a non-empty local part, one `@`, a domain carrying a dot, and no
 * whitespace anywhere. Everything else is the server's to judge.
 */

/**
 * Whitespace is stripped where the value is read rather than as the person
 * types, so a paste of `  rayan@example.rw ` lands and a space typed
 * mid-address still reads as implausible while it is there.
 */
export function trimEmail(input: string): string {
  return input.trim();
}

/**
 * Could this be an address? Enables Continue and the "Looks right" line.
 *
 * Deliberately not a full RFC 5322 grammar. That grammar admits quoted local
 * parts and bracketed IP domains that no person types into a phone, and every
 * shortened version of it in the wild rejects something valid.
 */
export function isPlausibleEmail(input: string): boolean {
  const value = trimEmail(input);
  if (!value || /\s/.test(value)) return false;

  const at = value.indexOf('@');
  // Exactly one `@`, with something on each side of it.
  if (at <= 0 || at !== value.lastIndexOf('@') || at === value.length - 1) return false;

  const domain = value.slice(at + 1);
  // A dot with a label on each side. `rayan@localhost` is a real address on a
  // real network and is not one anybody signs in to Injishi with.
  const dot = domain.indexOf('.');
  if (dot <= 0 || dot === domain.length - 1) return false;

  // A trailing dot, or two dots together, is a typo rather than a domain.
  return !domain.endsWith('.') && !domain.includes('..');
}

/**
 * The address as it goes to the server: trimmed and lowercased.
 *
 * `requestSignInCode()` in `src/lib/auth.ts` already does exactly this, and it
 * stays the one that does it on the wire. This is here for the one caller that
 * needs the same answer without making a call — a test asserting that two
 * spellings reach one account.
 *
 * The database is what actually guarantees that: `users_email_lower_uk` is a
 * UNIQUE index on `lower(email)`, so case cannot split one person into two
 * accounts even if a client forgets to fold it.
 */
export function normaliseEmail(input: string): string {
  return trimEmail(input).toLowerCase();
}
