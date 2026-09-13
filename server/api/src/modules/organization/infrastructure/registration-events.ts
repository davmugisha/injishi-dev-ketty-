import type { OrgRegistrationStatus } from '@injishi/contracts';
import { sql } from 'drizzle-orm';

import { orgRegistrationEvents } from '../../../database/drizzle/schema';
import type { Database } from '../../../shared/database/database.module';

/**
 * Who moved a registration, as the calling surface names it (ADR-049, AC-R6).
 *
 * A union rather than two loose arguments, so a `system` move cannot be written
 * with an actor and a person's move cannot be written without one. The table's
 * `org_registration_events_actor_shape` CHECK says the same thing; this makes the
 * compiler say it first.
 */
export type RegistrationMover =
  | { trigger: 'registrant' | 'officer' | 'staff'; actorUserId: string }
  | { trigger: 'system'; actorUserId: null };

/** The TIN adapter and its retry sweep. Nobody pressed anything. */
export const SYSTEM_MOVER: RegistrationMover = {
  trigger: 'system',
  actorUserId: null,
};

/**
 * Record one registration status change, on the caller's transaction.
 *
 * **Always on `tx`, never on the pool.** The row and the status change it
 * describes are one act: a status that moved with no event behind it is a wait
 * nobody can measure, and an event describing a move that rolled back is a
 * history that lies. Taking the transaction handle as an argument is what makes
 * the second outcome impossible to write by accident.
 *
 * A plain function rather than an injected service, for the reason
 * `seedPropertyDepartments` gives: there is nothing stateful here, and the admin
 * suspend and reinstate pair in `api/admin/orgs/org-actions.service.ts` lives
 * outside this module and still has to write the same row inside its own
 * transaction. That pair is the one ADR-049 names as easy to miss.
 */
export async function recordRegistrationEvent(
  tx: Database,
  input: {
    orgId: string;
    /** Null on the creation row, and on no other. */
    from: OrgRegistrationStatus | null;
    to: OrgRegistrationStatus;
    mover: RegistrationMover;
  },
): Promise<void> {
  await tx.insert(orgRegistrationEvents).values({
    orgId: input.orgId,
    fromStatus: input.from,
    toStatus: input.to,
    trigger: input.mover.trigger,
    actorUserId: input.mover.actorUserId,
    // `clock_timestamp()`, not the column's `now()` default. `now()` is the
    // moment the TRANSACTION began, so two moves written in one transaction —
    // an approval and the activation it carries straight on to — got the very
    // same `occurred_at`, and read back in whatever order the uuids happened to
    // sort. `clock_timestamp()` advances inside a transaction, so the log reads
    // in the order the moves were made.
    occurredAt: sql`clock_timestamp()`,
  });
}
