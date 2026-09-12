/**
 * The invitation frame X3 opens on.
 *
 * A landlord registered a lease against an email address and the person holding
 * that address is on this screen (FL03 entry point 2, F-B10's claim shape). Only
 * three facts are the INVITE's own — which lease it points at, how long the
 * term runs, and who was invited. Everything a person reads on the card, the
 * unit, the org, the rent and the photograph, is read back out of the lease
 * itself, so the screen and the contract behind it cannot drift apart.
 *
 * The invited person is the signed-in person (decision D7). Frame X3 prefills
 * "Eric Tuyishime" because the canvas names a different person per surface;
 * `frames.md` is explicit that in the app one identity holds every seat and the
 * frames' other names stay as counterparties. So the name is `ME`, the address
 * is `ME`'s, and Eric survives elsewhere in the fixtures as a tenant a landlord
 * collects rent from.
 *
 * ## The invited party is named by EMAIL (ADR-038 child 1b, AC-E8)
 *
 * It used to be a phone number, against a table that has no phone column at
 * all: `lease_invitations.email` is the invitation key and always was. Display
 * only for now — the invitation is still this fixture until the tenant child
 * (ADR-038 child 4) wires it to the API.
 */
import { ME } from '@/data/personas';
import { getTenancy, type Tenancy } from '@/data/rentals';

export interface Invite {
  /** The lease this invite is for. Resolves against `TENANCIES`. */
  leaseId: string;
  /** The term, in months. Frame X3 prints it beside the rent. */
  termMonths: number;
  /** Prefilled and editable: the name that goes on the lease. */
  invitedName: string;
  /** Read-only: the address the landlord registered, and how the invite arrived. */
  invitedEmail: string;
}

export const INVITE: Invite = {
  // Repointed by Session 7. It was `ingoro-apartments-a2`, and the note above
  // this file's `Invite` type flagged why that was wrong: decision D7 makes the
  // signed-in person a landlord AT Ingoro Apartments, so the invite had them
  // being offered a tenancy by their own business. This file already reads
  // every displayed fact off the lease, so the change is one id.
  leaseId: 'kimironko-flat-3',
  termMonths: 24,
  invitedName: ME.name,
  invitedEmail: ME.email,
};

/**
 * The lease the invite points at.
 *
 * `undefined` is a real outcome and the screen renders it as one: an invite
 * whose lease has been withdrawn is a thing that happens, and a card drawn from
 * `lease!` would render "undefined · undefined" instead of saying so.
 */
export function invitedLease(invite: Invite = INVITE): Tenancy | undefined {
  return getTenancy(invite.leaseId);
}
