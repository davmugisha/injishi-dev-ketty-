import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';

import { leaseContractVersions, leaseEvents } from '../../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import type { DbOrTx } from './rentals-writers';

/** Who a signed copy goes to; each is recorded once it went. */
export type SignedCopyRecipient = 'tenant' | 'landlord' | 'landlord_contact';

/** The `signed_copy_ready` timeline row of one version, which also records who was sent the copy. */
export interface SignedCopyClaim {
  eventId: string;
  mailed: SignedCopyRecipient[];
  created: boolean;
}

/**
 * The bookkeeping of the LeaseDocuments job (WP 1.5b). The timeline row
 * `signed_copy_ready` (one per version, payload `{ versionId, version,
 * storedObjectId, mailed }`) is both what the two sides see ("the signed copy
 * is ready") and the job's claim: it is written once, under a lock on the
 * version, and each email that went is added to `mailed`, so a retried or
 * repeated job sends only what is still missing.
 */
@Injectable()
export class LeaseDocumentsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** The version's `signed_copy_ready` row, written now when there is none. Inside the caller's transaction. */
  async claim(
    tx: DbOrTx,
    input: { leaseId: string; workspaceId: string; versionId: string; version: number; storedObjectId: string },
  ): Promise<SignedCopyClaim> {
    // One writer at a time per version: the lock makes the "is there a row" check and the insert one step.
    await tx.select({ id: leaseContractVersions.id }).from(leaseContractVersions).where(eq(leaseContractVersions.id, input.versionId)).for('update');
    const [existing] = await tx
      .select({ id: leaseEvents.id, payload: leaseEvents.payload })
      .from(leaseEvents)
      .where(
        and(
          eq(leaseEvents.leaseId, input.leaseId),
          eq(leaseEvents.kind, 'signed_copy_ready'),
          sql`${leaseEvents.payload}->>'versionId' = ${input.versionId}`,
        ),
      )
      .limit(1);
    if (existing) return { eventId: existing.id, mailed: mailedOf(existing.payload), created: false };
    const [row] = await tx
      .insert(leaseEvents)
      .values({
        leaseId: input.leaseId,
        workspaceId: input.workspaceId,
        kind: 'signed_copy_ready',
        actorUserId: null,
        actorRole: 'system',
        visibleToTenant: true,
        payload: { versionId: input.versionId, version: input.version, storedObjectId: input.storedObjectId, mailed: [] },
      })
      .returning({ id: leaseEvents.id });
    if (!row) throw new Error('signed copy event insert returned nothing');
    return { eventId: row.id, mailed: [], created: true };
  }

  /** Record that one recipient was sent the copy. */
  async markMailed(eventId: string, recipient: SignedCopyRecipient): Promise<void> {
    await this.db
      .update(leaseEvents)
      .set({
        payload: sql`jsonb_set(${leaseEvents.payload}, '{mailed}', coalesce(${leaseEvents.payload}->'mailed', '[]'::jsonb) || to_jsonb(${recipient}::text))`,
      })
      .where(and(eq(leaseEvents.id, eventId), sql`not coalesce(${leaseEvents.payload}->'mailed', '[]'::jsonb) ? ${recipient}`));
  }

  /**
   * Versions both sides signed whose copy was never made: what a lost job
   * left behind (Redis down when the tenant signed). Oldest signing first.
   */
  async unsentSignedVersions(limit: number): Promise<string[]> {
    const { rows } = await this.db.execute<{ version_id: string }>(sql`
      select v.id as version_id
        from lease_contract_versions v
        join leases l on l.current_version_id = v.id
       where l.status in ('signed', 'active', 'ending', 'ended')
         and v.template_version = 3
         and exists (select 1 from lease_signatures s
                      where s.version_id = v.id and s.signer_role = 'landlord' and s.voided_at is null)
         and exists (select 1 from lease_signatures s
                      where s.version_id = v.id and s.signer_role = 'tenant' and s.voided_at is null)
         and not exists (select 1 from lease_events e
                          where e.lease_id = l.id and e.kind = 'signed_copy_ready'
                            and e.payload->>'versionId' = v.id::text)
       order by l.signed_at asc nulls last
       limit ${limit}
    `);
    return rows.map((r) => r.version_id);
  }
}

function mailedOf(payload: unknown): SignedCopyRecipient[] {
  const list = (payload as { mailed?: unknown } | null)?.mailed;
  return Array.isArray(list) ? list.filter((x): x is SignedCopyRecipient => typeof x === 'string') : [];
}
