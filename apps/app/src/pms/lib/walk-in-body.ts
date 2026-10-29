/**
 * The registration card the check-in drawer sends, built from what the desk
 * typed (§6.8, `StayRegistrationDetails`).
 *
 * Pure, and separate from the drawer, for two reasons. It is the one place
 * that decides WHETHER a card goes on the wire at all: a bare check in stays a
 * bare check in, because `guest: {}` would be a registration that registered
 * nothing and, being `.strict()`, one the contract may one day refuse. And it
 * is testable without React — `walk-in-body.test.mjs` runs it the way
 * `legacy-redirect.test.mjs` runs its function.
 *
 * The drawer used to collect a phone and an ID number and send NEITHER, while
 * telling the desk the ID was "not kept yet". The API has kept both since the
 * registration card landed: the phone and email go on the stay, the ID number
 * on `stay_identities`, and an email is what the claim invitation is mailed to.
 * A walk-in has no account, so without that mail they never reach the app.
 */

import type { StayRegistrationDetails } from "@injishi/contracts";

export interface RegistrationFields {
  /** National ID or passport number, as typed. Optional on purpose. */
  nid: string;
  phone: string;
  email: string;
}

export interface RegistrationProblems {
  nid?: string;
  phone?: string;
  email?: string;
}

/** Loose on purpose: the server validates; this only stops an obvious typo at the field. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * What the contract would refuse, said at the field before the command.
 *
 * The limits mirror `StayRegistrationDetails`: a phone is 6 to 32 characters,
 * an ID number at most 64, an email at most 254 and shaped like one. Refusing
 * here beats a 400 after the guest has watched the desk press the button.
 */
export function registrationProblems(fields: RegistrationFields): RegistrationProblems {
  const problems: RegistrationProblems = {};
  const nid = fields.nid.trim();
  const phone = fields.phone.trim();
  const email = fields.email.trim();

  if (nid.length > 64) problems.nid = "That number is longer than any ID or passport carries.";
  if (phone && phone.length < 6) problems.phone = "A phone number needs at least 6 digits.";
  if (phone.length > 32) problems.phone = "That phone number is too long.";
  if (email && (email.length > 254 || !EMAIL_SHAPE.test(email))) {
    problems.email = "That email address does not look complete.";
  }
  return problems;
}

/**
 * The card to send, or `undefined` when the desk typed nothing — so the
 * command carries no `guest` at all rather than an empty one.
 *
 * The email is lower-cased here as well as on the server, so the address the
 * desk sees echoed back is the one the invitation went to. `invite` is left
 * unset: the contract defaults it to true exactly when an email was given,
 * which is the behaviour the desk expects from typing one.
 */
export function registrationCardFrom(fields: RegistrationFields): StayRegistrationDetails | undefined {
  const card: StayRegistrationDetails = {};
  const nid = fields.nid.trim();
  const phone = fields.phone.trim();
  const email = fields.email.trim();

  if (nid) card.idNumber = nid;
  if (phone) card.phone = phone;
  if (email) card.email = email.toLowerCase();

  return Object.keys(card).length > 0 ? card : undefined;
}
