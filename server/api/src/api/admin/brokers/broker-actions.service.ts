import { AdminBrokerStatusChange } from '@injishi/contracts';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import { auditEvents } from '../../../database/drizzle/governance';
import { brokers } from '../../../database/drizzle/residence';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';

/**
 * The one broker write the console has: suspension.
 *
 * Kept out of `AdminBrokersService`, which reads and must stay a reader, so
 * the audit obligation for this area sits in one short file.
 *
 * WHAT A SUSPENSION CHANGES TODAY, stated plainly: `brokers.status`. Nothing
 * in the API reads that column yet, because no broker-facing write exists to
 * refuse — there is no reveal or placement route. The flag is the record the
 * first such route must check, and the audit row is the explanation of why it
 * was set. It is not, on its own, a lock on anything.
 */
@Injectable()
export class AdminBrokerActionsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Suspend an active broker, and record it, in ONE transaction.
   *
   * The status change and the audit row commit together or not at all, so a
   * suspended broker always has a written reason on file and a reason is never
   * on file for a suspension that did not happen.
   *
   * THE AUDIT SUBJECT IS THE BROKER'S ACCOUNT. `audit_subject_type` has no
   * `broker` value and adding one is a migration; a broker is exactly one
   * `users` row (`brokers_user_uk`), so the row is filed against that person,
   * where a search of their history finds it, and carries the broker id in its
   * payload.
   */
  async suspend(
    brokerId: string,
    actorUserId: string,
    reason: string,
  ): Promise<AdminBrokerStatusChange> {
    return this.db.transaction(async (tx) => {
      // Conditional on `active`: the legality check and the concurrency
      // control in one statement. A second click, or a second staffer, moves
      // nothing and gets the 409 below instead of a duplicate audit row.
      const [moved] = await tx
        .update(brokers)
        .set({ status: 'suspended', updatedAt: new Date() })
        .where(and(eq(brokers.id, brokerId), eq(brokers.status, 'active')))
        .returning({ userId: brokers.userId });

      if (!moved) {
        const [current] = await tx
          .select({ status: brokers.status })
          .from(brokers)
          .where(eq(brokers.id, brokerId))
          .limit(1);
        if (!current) throw new NotFoundException('No broker has that id.');
        throw new ConflictException({
          code: 'illegal_transition',
          current: current.status,
          message: `Only an active broker can be suspended; this one is ${current.status}.`,
        });
      }

      const [audit] = await tx
        .insert(auditEvents)
        .values({
          actorUserId,
          // The BROKER is the subject (migration 0029 added the value). This
          // was filed as `user` with the broker's user id while the enum had
          // no `broker`, so "every audit row about this broker" could only be
          // answered by reading payloads. The user id stays in the payload so
          // the person behind the broker is still one query away.
          subjectType: 'broker',
          subjectId: brokerId,
          eventType: 'admin.broker.suspended',
          payloadDiff: {
            brokerUserId: moved.userId,
            status: { from: 'active', to: 'suspended' },
          } as never,
          reason,
        })
        .returning({ id: auditEvents.id });

      return AdminBrokerStatusChange.parse({
        brokerId,
        from: 'active',
        status: 'suspended',
        auditEventId: audit?.id,
      });
    });
  }
}
