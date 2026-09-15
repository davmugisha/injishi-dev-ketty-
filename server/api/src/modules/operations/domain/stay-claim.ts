import { randomInt } from 'node:crypto';

/**
 * THE CLAIM CODE: what it looks like, how one is minted, and how a collision on
 * it is recognised (§6.8).
 *
 * ## Why this file exists
 *
 * `mintClaimCode` was a function inside `AdminUserActionsService`, because for
 * a while the only thing that ever minted one was a staffer in the admin
 * console re-issuing a code for a guest who had lost their slip. Nothing minted
 * the FIRST code: a walk in was admitted with `claim_code` null, so the console
 * could replace a credential that had never been issued.
 *
 * Check in now mints one at the counter, which puts a second caller on this
 * function — and two copies of a credential generator is two places for one of
 * them to quietly become `Math.random`. One definition, in the domain, imported
 * by both.
 */

/** Fresh draws allowed when a minted code collides with a live one. */
export const CLAIM_CODE_RETRIES = 3;

/**
 * Letters for a claim code, without `I` and `O`.
 *
 * A claim code is read aloud by a staffer to a guest on the phone, and `I`/`O`
 * are the two letters that get heard as `1`/`0` — which the code also contains.
 * Dropping them costs a sliver of entropy and saves the call where a correct
 * code is typed wrong. The printed shape (`AAAA-9999`) is unchanged.
 */
const CLAIM_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * A new claim code in the printed shape, from the CSPRNG.
 *
 * `randomInt`, never `Math.random`: the code is a BEARER CREDENTIAL. Whoever
 * types it first gets the stay, the identity document captured against it, the
 * running bill and the right to ask for money back — so a predictable code is
 * an enumerable one, and an enumerable one hands a stranger somebody's passport
 * number.
 *
 * 24^4 x 10^4 is about 3.3 x 10^9 codes. That is not enough on its own against
 * an attacker who can guess without limit, which is why the claim route is rate
 * limited per session and why a code is single use: a claimed stay refuses
 * every further attempt, including its own code.
 */
export function mintClaimCode(): string {
  let letters = '';
  for (let i = 0; i < 4; i++) {
    letters += CLAIM_LETTERS[randomInt(CLAIM_LETTERS.length)];
  }
  const digits = String(randomInt(10_000)).padStart(4, '0');
  return `${letters}-${digits}`;
}

/** Was this a collision on the claim-code index, and nothing else? */
export function isClaimCodeCollision(err: unknown): boolean {
  const candidates = [err, (err as { cause?: unknown })?.cause];
  return candidates.some(
    (e) =>
      typeof e === 'object' &&
      e !== null &&
      (e as { code?: string }).code === '23505' &&
      (e as { constraint?: string }).constraint === 'guest_stays_claim_code_uk',
  );
}

/**
 * Run `write` with fresh codes until one lands, or give up.
 *
 * The retry is what makes a collision invisible to the caller rather than a
 * 500 in front of a guest at the counter. It gives up rather than looping
 * forever: three collisions in a row on a 3.3-billion space means something is
 * wrong with the generator, and spinning would hide it.
 */
export async function withFreshClaimCode<T>(
  write: (code: string) => Promise<T>,
): Promise<T> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < CLAIM_CODE_RETRIES; attempt++) {
    try {
      return await write(mintClaimCode());
    } catch (error) {
      if (!isClaimCodeCollision(error)) throw error;
      lastError = error;
    }
  }
  throw lastError ?? new Error('could not mint a free claim code');
}
