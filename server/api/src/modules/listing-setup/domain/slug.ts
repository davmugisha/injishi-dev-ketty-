import { randomBytes } from 'node:crypto';

/**
 * Minting a property's public address (ADR-053, AC-I5).
 *
 * A slug is a COLUMN rather than something a client derives, because
 * `/property/[slug]` is a page strangers and search engines read: two clients
 * deriving it differently means one of them 404s. So it is minted once, server
 * side, inside the publish transaction, and a collision is resolved here rather
 * than by a reader.
 *
 * Pure functions, no database. The repository owns the uniqueness probe; this
 * owns the shape.
 */

/**
 * The stem, before any collision suffix.
 *
 * 80 characters. Long enough for a real hotel name, short enough that the
 * address stays readable and the `-2` suffix has somewhere to go.
 */
export const SLUG_STEM_MAX = 80;

/**
 * How many numeric suffixes are tried before falling back to randomness.
 *
 * A linear search inside a held row lock is unbounded work for a property named
 * "Hotel", so it stops at ten. Past that a random suffix is one probe rather
 * than n, and nobody reading the eleventh "hotel-..." address cares that it is
 * not "hotel-11".
 */
export const SLUG_NUMERIC_SUFFIX_LIMIT = 10;

/** The combining marks NFKD separates out, so "Cafe" keeps its letters. */
const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * Fold a property name down to a URL stem.
 *
 * Returns an empty string when there is nothing left to use, which is a real
 * outcome rather than an error: a name written entirely in emoji, or in a script
 * the fold drops, folds to nothing. `slugStemFor` is what turns that into an
 * address.
 */
export function foldToSlug(name: string): string {
  return (
    name
      .normalize('NFKD')
      // Strip the marks NFKD just separated, so "Kigali Cafe" with an accent
      // folds to "kigali-cafe" rather than losing the whole word.
      .replace(COMBINING_MARKS, '')
      .toLowerCase()
      // Every run of anything that is not ASCII alphanumeric becomes ONE
      // separator. A run rather than each character, or a name with three spaces
      // around a dash would come out with a hyphen for each of them.
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, SLUG_STEM_MAX)
      // The cap can land mid separator, so trim again after it.
      .replace(/-+$/g, '')
  );
}

/**
 * The stem to publish a property under, with the id as the fallback.
 *
 * The fallback is the first 8 hex characters of the property's own uuid. It is
 * stable (a republish of the same property mints the same stem), it is already
 * unique in practice, and it means a property whose name carries no ASCII still
 * gets an address instead of a refusal the operator cannot act on.
 */
export function slugStemFor(input: { name: string; id: string }): string {
  const folded = foldToSlug(input.name);
  if (folded.length > 0) return folded;
  return input.id.replace(/-/g, '').slice(0, 8);
}

/**
 * The candidate addresses to try, in order, for one stem.
 *
 * The stem itself first, then `-2` through `-10`. A caller that exhausts these
 * asks for `randomSlugSuffix` instead of counting further.
 */
export function slugCandidates(stem: string): string[] {
  const candidates = [stem];
  for (let n = 2; n <= SLUG_NUMERIC_SUFFIX_LIMIT; n += 1) {
    candidates.push(`${stem}-${n}`);
  }
  return candidates;
}

/**
 * Six characters of Crockford-ish base 32, for the eleventh collision onward.
 *
 * `i`, `l`, `o` and `u` are left out: an address gets read aloud and typed back,
 * and those are the four that get it wrong.
 */
export function randomSlugSuffix(): string {
  const alphabet = '0123456789abcdefghjkmnpqrstvwxyz';
  const bytes = randomBytes(6);
  let out = '';
  for (const byte of bytes) out += alphabet[byte % alphabet.length];
  return out;
}
