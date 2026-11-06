import { auditEvents } from '../../database/drizzle/schema';
import { currentAccessContext } from '../auth/access-context';
import type { Database } from '../database/database.module';
import { redactPersonal } from './personal-fields';

/** Anything that can insert: the database itself or a transaction. */
type Writer = Pick<Database, 'insert'>;

/** What a caller says about an audited act. The access columns are never the caller's to set. */
export interface AuditRow {
  /** Defaults to the actor of the request this runs in. */
  actorUserId?: string | null;
  impersonatedUserId?: string | null;
  subjectType?: (typeof auditEvents.$inferInsert)['subjectType'];
  subjectId?: string | null;
  eventType: string;
  payloadDiff?: unknown;
  reason?: string | null;
  districtId?: number | null;
  /** When the act happened, when that is not now (the row's own moment, such as a revocation's). */
  occurredAt?: Date;
}

/**
 * The one writer of `audit_events` (ADR-076 contract section 8, AC-U4, G16).
 *
 * A caller writes its row in the SAME transaction as the change it records,
 * passing that transaction, so there is never a change without its row or a
 * row without its change. This adds what the caller must never set by hand:
 * the access the act was done under, from the request's access context
 * (`actor_membership_id`, `grant_family`, `role_keys`, `permissions`, `scope`
 * and, from slice D, the device), so every row says who acted, under which of
 * the three grant families, holding which roles and granted on which
 * permissions, and where. A write with no request behind it (a job, a script)
 * has no context and records none of them, which is the truth about it.
 *
 * Personal values in the diff are written as `"changed"`, at any depth, as
 * HR's audit always did (`personal-fields.ts`).
 *
 * A test fails on any other `insert(auditEvents)` in the server.
 */
export const AuditWriter = {
  async write(tx: Writer, row: AuditRow): Promise<{ id: string }> {
    const context = currentAccessContext();
    const [written] = await tx
      .insert(auditEvents)
      .values({
        actorUserId: row.actorUserId !== undefined ? row.actorUserId : (context?.actorUserId ?? null),
        impersonatedUserId: row.impersonatedUserId ?? null,
        subjectType: row.subjectType ?? null,
        subjectId: row.subjectId ?? null,
        eventType: row.eventType,
        payloadDiff: (row.payloadDiff === undefined ? null : redactPersonal(row.payloadDiff)) as never,
        reason: row.reason ?? null,
        districtId: row.districtId ?? null,
        ...(row.occurredAt ? { occurredAt: row.occurredAt } : {}),
        actorMembershipId: context?.actorMembershipId ?? null,
        grantFamily: context?.grantFamily ?? null,
        roleKeys: context ? [...context.roleKeys] : null,
        permissions: context ? [...context.permissions] : null,
        scope: (context ? [...context.scope] : null) as never,
        deviceId: context?.deviceId ?? null,
        deviceUserSessionId: context?.deviceUserSessionId ?? null,
        overrideByMembershipId: context?.overrideByMembershipId ?? null,
      })
      .returning({ id: auditEvents.id });
    if (!written) throw new Error('The audit row was not written.');
    return written;
  },
};
