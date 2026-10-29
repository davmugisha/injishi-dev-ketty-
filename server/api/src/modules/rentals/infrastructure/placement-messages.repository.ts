import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import { threads } from '../../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import type { DbOrTx } from './rentals-writers';

/** A placement with the two sides of its conversation: the broker's account and the landlord's business. */
export interface PlacementThreadContext {
  placementId: string;
  status: string;
  brokerId: string;
  brokerUserId: string;
  brokerStatus: string;
  brokerName: string;
  brokerEmail: string | null;
  workspaceId: string;
  orgId: string;
  /** The building the unit is in, for a reader whose branch scope is a few buildings. */
  propertyId: string | null;
  unitLabel: string | null;
  propertyName: string | null;
  tenantName: string | null;
  landlordName: string;
  threadId: string | null;
}

/** A side of a broker conversation whose reader has left lines unread long enough to be emailed. */
export interface PlacementDigestRow {
  threadId: string;
  side: 'landlord' | 'broker';
  placementId: string;
  workspaceId: string;
  orgId: string;
  unitLabel: string | null;
  propertyName: string | null;
  landlordName: string;
  brokerName: string;
  brokerEmail: string | null;
  unread: number;
  newestAtExact: string;
  newestBody: string | null;
  newestBodyType: string;
  newestVoiceS: number | null;
}

type Raw<T> = { [K in keyof T]: unknown };

/**
 * The SQL of the broker conversations (2026-10-26). A placement thread is a
 * `threads` row with `placement_id` set, unique per placement. The broker is
 * `brokers.user_id`; every other sender is the landlord's side. The lines
 * themselves are read and written through `LeaseMessagesRepository`, the one
 * message store every rentals conversation shares.
 */
@Injectable()
export class PlacementMessagesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  private readonly contextSelect = sql`
    select tp.id as "placementId", tp.status::text as status,
           b.id as "brokerId", b.user_id as "brokerUserId", b.status::text as "brokerStatus",
           coalesce(nullif(b.name, ''), nullif(bu.name, ''), 'Broker') as "brokerName",
           coalesce(nullif(b.email, ''), bu.email) as "brokerEmail",
           tp.workspace_id as "workspaceId", w.org_id as "orgId",
           u.property_id as "propertyId", u.label as "unitLabel", p.name as "propertyName", tp.tenant_name as "tenantName",
           o.legal_name as "landlordName",
           th.id as "threadId"
      from tenant_placements tp
      join brokers b on b.id = tp.broker_id
      join users bu on bu.id = b.user_id
      join workspaces w on w.id = tp.workspace_id
      join orgs o on o.id = w.org_id
      left join rental_units u on u.id = tp.unit_id
      left join properties p on p.id = u.property_id
      left join threads th on th.placement_id = tp.id`;

  async context(placementId: string, db: DbOrTx = this.db): Promise<PlacementThreadContext | null> {
    const { rows } = await db.execute<Raw<PlacementThreadContext>>(sql`${this.contextSelect} where tp.id = ${placementId} limit 1`);
    return (rows[0] as unknown as PlacementThreadContext | undefined) ?? null;
  }

  /** The broker behind a broker workspace (the workspace is its person's own). */
  async brokerOfWorkspace(workspaceId: string): Promise<{ brokerId: string; userId: string; status: string } | null> {
    const { rows } = await this.db.execute<{ broker_id: string; user_id: string; status: string }>(sql`
      select b.id as broker_id, b.user_id, b.status::text as status
        from workspaces w join brokers b on b.user_id = w.user_id
       where w.id = ${workspaceId} and w.kind = 'broker' limit 1`);
    const r = rows[0];
    return r ? { brokerId: r.broker_id, userId: r.user_id, status: r.status } : null;
  }

  /** Every placement of this broker, newest first. */
  async forBroker(brokerId: string): Promise<PlacementThreadContext[]> {
    const { rows } = await this.db.execute<Raw<PlacementThreadContext>>(sql`
      ${this.contextSelect} where tp.broker_id = ${brokerId} order by tp.initiated_at desc limit 500`);
    return rows as unknown as PlacementThreadContext[];
  }

  /** Every placement on this landlord business's units, newest first. */
  async forWorkspace(workspaceId: string): Promise<PlacementThreadContext[]> {
    const { rows } = await this.db.execute<Raw<PlacementThreadContext>>(sql`
      ${this.contextSelect} where tp.workspace_id = ${workspaceId} order by tp.initiated_at desc limit 500`);
    return rows as unknown as PlacementThreadContext[];
  }

  /** The placement's conversation, made if it is not there yet; two racing first opens keep one. */
  async ensureThread(tx: DbOrTx, ctx: { placementId: string; workspaceId: string }): Promise<string> {
    await tx
      .insert(threads)
      .values({ workspaceId: ctx.workspaceId, placementId: ctx.placementId, threadKind: 'placement', subject: null })
      .onConflictDoNothing({ target: threads.placementId, where: sql`${threads.placementId} is not null` });
    const { rows } = await tx.execute<{ id: string }>(sql`select id from threads where placement_id = ${ctx.placementId} limit 1`);
    const id = rows[0]?.id;
    if (!id) throw new Error(`placement ${ctx.placementId} has no thread after insert`);
    return id;
  }

  /**
   * Broker conversations to email about: the same rule as the lease ones
   * (`LeaseMessagesRepository.digestCandidates`). The broker's side waits on
   * the landlord team's lines; the landlord's side on the broker's, and it
   * has read a line once anyone on the team has.
   */
  async digestCandidates(now: Date, delayMin: number, cooldownMin: number): Promise<PlacementDigestRow[]> {
    const cutoff = new Date(now.getTime() - delayMin * 60_000).toISOString();
    const quiet = new Date(now.getTime() - cooldownMin * 60_000).toISOString();
    const { rows } = await this.db.execute<Raw<PlacementDigestRow>>(sql`
      with pt as (
        select th.id as thread_id, tp.id as placement_id, tp.workspace_id, w.org_id, u.label as unit_label,
               p.name as property_name, o.legal_name as landlord_name,
               coalesce(nullif(b.name, ''), nullif(bu.name, ''), 'Broker') as broker_name,
               coalesce(nullif(b.email, ''), bu.email) as broker_email, b.user_id as broker_user_id
          from threads th
          join tenant_placements tp on tp.id = th.placement_id
          join brokers b on b.id = tp.broker_id
          join users bu on bu.id = b.user_id
          join workspaces w on w.id = tp.workspace_id
          join orgs o on o.id = w.org_id
          left join rental_units u on u.id = tp.unit_id
          left join properties p on p.id = u.property_id
         where th.placement_id is not null
      ),
      sides as (
        select pt.*, 'broker'::text as side,
               (select tr.last_read_at from thread_reads tr where tr.thread_id = pt.thread_id and tr.user_id = pt.broker_user_id) as read_at
          from pt
        union all
        select pt.*, 'landlord'::text as side,
               (select max(tr.last_read_at) from thread_reads tr
                 where tr.thread_id = pt.thread_id and tr.user_id <> pt.broker_user_id) as read_at
          from pt
      ),
      waiting as (
        select s.*, m.created_at, m.body, m.body_type, m.voice_duration_s
          from sides s
          left join thread_digests d on d.thread_id = s.thread_id and d.side = s.side
          join messages m on m.thread_id = s.thread_id
         where m.body_type <> 'system' and m.sender_user_id is not null
           and (case when s.side = 'broker' then m.sender_user_id <> s.broker_user_id
                     else m.sender_user_id = s.broker_user_id end)
           and m.created_at > coalesce(s.read_at, '-infinity')
           and m.created_at > coalesce(d.notified_through, '-infinity')
           and (d.sent_at is null or d.sent_at <= ${quiet}::timestamptz)
      )
      select w.thread_id as "threadId", w.side, w.placement_id as "placementId", w.workspace_id as "workspaceId",
             w.org_id as "orgId", w.unit_label as "unitLabel", w.property_name as "propertyName",
             w.landlord_name as "landlordName", w.broker_name as "brokerName", w.broker_email as "brokerEmail",
             count(*)::int as unread,
             max(w.created_at)::text as "newestAtExact",
             (array_agg(w.body order by w.created_at desc))[1] as "newestBody",
             (array_agg(w.body_type::text order by w.created_at desc))[1] as "newestBodyType",
             (array_agg(w.voice_duration_s order by w.created_at desc))[1] as "newestVoiceS"
        from waiting w
       group by w.thread_id, w.side, w.placement_id, w.workspace_id, w.org_id, w.unit_label, w.property_name,
                w.landlord_name, w.broker_name, w.broker_email
      having min(w.created_at) <= ${cutoff}::timestamptz
       order by max(w.created_at)`);
    return (rows as unknown as PlacementDigestRow[]).map((r) => ({ ...r, unread: Number(r.unread) }));
  }
}
