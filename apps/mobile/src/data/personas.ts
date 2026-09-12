/**
 * The signed-in person, and every seat they hold.
 *
 * **One identity, many hats** (MOBILE-PROTOTYPE-PROMPTS.md decision D7). The
 * 37 prototype frames name a different person on each surface — Eric T. on
 * Tenant, Jean Bosco H. on Landlord, Aline K. on Broker, Beatha M. on Work.
 * That is a drawing convention, not the product: a Workspace is the context a
 * User acts within (ui-glossary.md), so the same account wears a Guest hat, a
 * Tenant hat, a Landlord hat, a Broker hat and a Housekeeping seat, and the
 * switcher moves between them. Those other names survive in the fixtures as
 * COUNTERPARTIES — Eric T. is the tenant a landlord collects rent from — and
 * never as the viewer.
 *
 * This file is frozen after Session 0 (Part 3 of the prompt pack). A later
 * session adds a counterparty to its own fixture file; it does not add a seat
 * here.
 *
 * ## One amendment to that freeze, made by Session 8
 *
 * The Landlord seat was `Ingoro Apartments`. It is now `Kayitare Court`, and
 * that is a correction rather than a rename.
 *
 * Decision D7 gave this account five seats without checking the org names
 * against the counterparties the fixtures already held, and Ingoro was one of
 * them. By the time three surfaces were built, FOUR independent places treated
 * Ingoro Apartments as somebody else's business — `broker.ts` gives it a named
 * landlord contact (Jean Bosco Habimana, a phone number and an
 * `@ingoroapartments.rw` address) and lists two of its units as a broker's
 * client inventory; `rentals.ts` seeds frame X3's invite as a tenancy where
 * this account RENTS Ingoro's Unit A2 from that same Jean Bosco Habimana.
 * Only this file said Ingoro was ours, and three consequences followed:
 *
 *   1. Samuel rented a flat from himself.
 *   2. Samuel-as-broker earned a placement fee from Samuel-as-landlord.
 *   3. Unit A2 had two different tenants — Samuel here, Eric T. on the rent
 *      roll — at the same rent, in the same building.
 *
 * Three files agreed and one disagreed, so the one moved. Nothing else had to:
 * every landlord screen reads its org off `useDomain().workspace.name` rather
 * than off a constant, so the eyebrow followed for free.
 *
 * The frames do not settle this, because the frames contradict each other once
 * D7 collapses their four drawn people into one: frame X3 has Ingoro inviting a
 * tenant, and frames R1 to R10 have Ingoro as the rent roll. Under one identity
 * those are the same party on both sides of a lease. The canvas never had to
 * notice; the app does.
 *
 * The district is the interactive twin's own — its landlord eyebrow reads
 * "Ingoro Apartments · Kicukiro" while `broker.ts` and the X3 invite both put
 * Ingoro in Kimihurura. Two districts for one name was the same collision
 * showing through a third time, and Kicukiro belongs to the building this seat
 * actually owns.
 */
import type { WorkspaceEntry } from './rentals';

/** The person holding the phone. Every surface renders as this account. */
export const ME = {
  name: 'Samuel Kayitare',
  initials: 'SK',
  phone: '+250 788 431 209',
  email: 'samuel@kayitare.rw',
} as const;

/**
 * ## The seats are gone from this file (ADR-038 child 0, task 8)
 *
 * `WORKSPACES`, `PERSONAL_WORKSPACE`, `SWITCHABLE_WORKSPACES` and
 * `getWorkspace` used to live below this line. They are now
 * `GET /api/v1/me/workspaces`, held by `src/workspace.tsx` and reshaped for the
 * screens by `toWorkspaceEntry()` in `src/domain.tsx`.
 *
 * That is not a refactor, it is the point: a seat that has been revoked is gone
 * on the next launch, and a seat that has been granted appears without shipping
 * a build. A constant could do neither, and the five seats it named were this
 * account's, hard-coded, on a device that might be somebody else's entirely.
 *
 * The long note above about Kayitare Court and the Ingoro collision is kept
 * because it explains a decision the SEED still carries — `seed-demo.mjs` names
 * these same four organisations — and losing the reasoning would invite
 * somebody to recreate the collision there.
 *
 * ## `GET /me/profile` has landed, and `ME` is now the PLACEHOLDER
 *
 * This note used to say `ME` survives "only until ADR-038 child 4 replaces it
 * with `GET /me/profile`". That replacement is built: `src/queries/profile.ts`
 * reads the route, and the four surfaces that name the person — the Account
 * identity card, the workspace switcher's header, the sign-out confirmation
 * and Personal details — all read `useMyIdentity()` rather than this constant.
 *
 * So `ME`'s job has changed rather than ended. It is what those surfaces draw
 * while the call is in flight and on any surface with no session above it, in
 * the same way `apps/web` keeps `DEMO_PERMISSIONS`: fixture data that keeps the
 * app runnable standalone, never a second model. Where the two disagree the
 * server is right, and `MyIdentity.fromServer` is how a caller tells which one
 * it is holding.
 *
 * What still reads `ME` directly is FIXTURE CONTENT rather than identity — the
 * seeded invite in `screens/auth/invite.ts`, the landlord party on a seeded
 * contract, the reporter on a seeded ticket, the reviewer name on a seeded
 * trip. Those go when the fixtures behind them do, not before: each one is a
 * name inside a row the server does not serve, and swapping in a real person
 * would put that person's name on data they never created.
 */
