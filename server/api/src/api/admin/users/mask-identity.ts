import {
  maskOptionalIdentifier,
} from '../../../shared/identity/mask';

/**
 * Masking for the admin console's identity fields.
 *
 * THE RULE ITSELF LIVES IN `shared/identity/mask.ts` and is imported, not
 * restated. This file used to carry its own copy, because the original was a
 * module-private function in `modules/user/application/profile.service.ts` that
 * could not be imported. Two copies of a disclosure rule is one copy waiting to
 * be loosened, so the rule was extracted and both callers now read from it.
 *
 * What remains here is naming, not policy: a document number and a phone number
 * are different fields with different reasons for being masked, and a reader of
 * `admin-users.service.ts` should see which one is being handled.
 *
 * NOTHING HERE IS A SECURITY BOUNDARY BY ITSELF. Masking limits what a staffer
 * can copy out of a list; `StaffGuard` limits who reaches the list at all.
 */

/**
 * A government document number as the console may see it.
 *
 * Null in, null out — "this person has no document on file" and "this person
 * has one we will not show you" are different facts, and collapsing them into
 * a row of dots would make the first unreadable.
 */
export function maskNationalId(value: string | null): string | null {
  return maskOptionalIdentifier(value);
}

/**
 * A phone number as the console may see it.
 *
 * Same rule as the document number, deliberately: a staffer confirming a number
 * a caller just read out needs the tail and nothing else, and a second, looser
 * rule for phones would make the phone column the way to harvest a directory.
 * The country prefix is NOT preserved — it narrows the number and the console
 * has no use for it.
 */
export function maskPhone(value: string | null): string | null {
  return maskOptionalIdentifier(value);
}
