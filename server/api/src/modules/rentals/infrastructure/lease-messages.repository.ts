import { Inject, Injectable } from '@nestjs/common';
import type { LeaseStatus } from '@injishi/contracts';
import { sql, type SQL } from 'drizzle-orm';

import { messageAttachments, messages, threadReads, threads } from '../../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import type { DbOrTx } from './rentals-writers';

/** A lease with the two sides of its conversation. */
export interface LeaseThreadContext {
  leaseId: string;
  workspaceId: string;
  orgId: string;
  propertyId: string;
  status: LeaseStatus;
  reference: string;
  unitLabel: string;
  propertyName: string;
  landlordName: string;
  tenantId: string;
  tenantName: string;
  tenantEmail: string | null;
  tenantUserId: string | null;
  threadId: string | null;
}

/** One message as stored, with who wrote it and the fault it is about. */
export interface LeaseMessageRow {
  id: string;
  threadId: string;
  senderUserId: string | null;
  senderName: string | null;
  bodyType: 'text' | 'image' | 'voice' | 'system' | 'file';
  body: string | null;
  voiceDurationS: number | null;
  createdAt: Date;
  faultId: string | null;
  faultReference: string | null;
  faultTitle: string | null;
  faultStatus: string | null;
}

export interface LeaseAttachmentRow {
  id: string;
  messageId: string;
  objectKey: string;
  mime: string;
  sizeBytes: number | null;
  filename: string | null;
  position: number;
}

/** The newest line of a conversation and how much is unread, for a list row. */
export interface ThreadSummaryRow {
  threadId: string;
  lastMessageAt: Date | null;
  lastBody: string | null;
  lastBodyType: string | null;
  lastSenderUserId: string | null;
  lastVoiceS: number | null;
  lastKinds: string[];
  unread: number;
}

/** A conversation and side whose reader has left messages unread long enough to be emailed. */
export interface DigestCandidateRow {
  threadId: string;
  side: 'landlord' | 'tenant';
  leaseId: string;
  workspaceId: string;
  orgId: string;
  reference: string;
  unitLabel: string;
  propertyName: string;
  landlordName: string;
  tenantName: string;
  tenantEmail: string | null;
  unread: number;
  newestAt: Date;
  /** The newest line's time exactly as Postgres holds it (microseconds), for `recordDigest`. */
  newestAtExact: string;
  newestBody: string | null;
  newestBodyType: string;
  newestVoiceS: number | null;
}

/** Leases a conversation may be about: everything but drafts. */
const LISTED = sql`l.status <> 'draft'`;

type Raw<T> = { [K in keyof T]: unknown };

/**
 * The SQL of the lease conversations (rentals P3.4). A lease thread is a
 * `threads` row with `lease_id` set, unique per lease. Who is on which side
 * comes from the lease: the tenant is `tenants.user_id`; every other sender
 * is the landlord's side (the owner or a team member).
 */
@Injectable()
export class LeaseMessagesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  private readonly contextSelect = sql`
    select l.id as "leaseId", l.workspace_id as "workspaceId", l.org_id as "orgId", l.property_id as "propertyId",
           l.status, l.reference, u.label as "unitLabel", p.name as "propertyName",
           o.legal_name as "landlordName",
           t.id as "tenantId", t.full_name as "tenantName", t.email as "tenantEmail", t.user_id as "tenantUserId",
           th.id as "threadId"
      from leases l
      join tenants t on t.id = l.tenant_id
      join rental_units u on u.id = l.unit_id
      join properties p on p.id = l.property_id
      join orgs o on o.id = l.org_id
      left join threads th on th.lease_id = l.id`;

  async context(leaseId: string, db: DbOrTx = this.db): Promise<LeaseThreadContext | null> {
    const { rows } = await db.execute<Raw<LeaseThreadContext>>(sql`${this.contextSelect} where l.id = ${leaseId} limit 1`);
    return (rows[0] as unknown as LeaseThreadContext | undefined) ?? null;
  }

  /** The landlord's leases with a conversation to list, in the buildings the reader covers. */
  async landlordLeases(workspaceId: string, buildings: SQL | null): Promise<LeaseThreadContext[]> {
    const { rows } = await this.db.execute<Raw<LeaseThreadContext>>(sql`
      ${this.contextSelect}
      where l.workspace_id = ${workspaceId} and ${LISTED}
        and (l.status in ('pending_signature', 'signed', 'active', 'ending') or th.id is not null)
        ${buildings ? sql`and ${buildings}` : sql``}
      order by l.created_at desc`);
    return rows as unknown as LeaseThreadContext[];
  }

  /** The tenant's own leases, for their unread counts. */
  async tenantLeases(userId: string): Promise<LeaseThreadContext[]> {
    const { rows } = await this.db.execute<Raw<LeaseThreadContext>>(sql`
      ${this.contextSelect} where t.user_id = ${userId} and ${LISTED} order by l.start_date desc`);
    return rows as unknown as LeaseThreadContext[];
  }

  /**
   * The lease's conversation, made if it is not there yet. Two first messages
   * racing both insert; the unique index keeps one and both read it back.
   */
  async ensureThread(tx: DbOrTx, lease: { leaseId: string; workspaceId: string }): Promise<string> {
    await tx
      .insert(threads)
      .values({ workspaceId: lease.workspaceId, leaseId: lease.leaseId, subject: null })
      .onConflictDoNothing({ target: threads.leaseId, where: sql`${threads.leaseId} is not null` });
    const { rows } = await tx.execute<{ id: string }>(sql`select id from threads where lease_id = ${lease.leaseId} limit 1`);
    const id = rows[0]?.id;
    if (!id) throw new Error(`lease ${lease.leaseId} has no thread after insert`);
    return id;
  }

  async insertMessage(
    tx: DbOrTx,
    input: {
      threadId: string;
      senderUserId: string | null;
      bodyType: LeaseMessageRow['bodyType'];
      body: string | null;
      voiceDurationS?: number | null;
      maintenanceTicketId?: string | null;
      files?: readonly { storedObjectId: string; filename: string }[];
    },
  ): Promise<{ id: string; createdAt: Date }> {
    const [row] = await tx
      .insert(messages)
      .values({
        threadId: input.threadId,
        senderUserId: input.senderUserId,
        bodyType: input.bodyType,
        body: input.body,
        voiceDurationS: input.voiceDurationS ?? null,
        maintenanceTicketId: input.maintenanceTicketId ?? null,
      })
      .returning({ id: messages.id, createdAt: messages.createdAt });
    if (!row) throw new Error('message not written');
    const files = input.files ?? [];
    if (files.length > 0) {
      await tx.insert(messageAttachments).values(
        files.map((f, position) => ({ messageId: row.id, storedObjectId: f.storedObjectId, filename: f.filename, position })),
      );
    }
    await tx.execute(sql`update threads set updated_at = now() where id = ${input.threadId}`);
    return row;
  }

  /** A page of a conversation, newest first: `limit + 1` rows so the caller knows an older page exists. */
  async page(threadId: string, limit: number, before?: { createdAt: Date; id: string }): Promise<LeaseMessageRow[]> {
    const { rows } = await this.db.execute<Raw<LeaseMessageRow>>(sql`
      select m.id, m.thread_id as "threadId", m.sender_user_id as "senderUserId", su.name as "senderName",
             m.body_type as "bodyType", m.body, m.voice_duration_s as "voiceDurationS", m.created_at as "createdAt",
             mt.id as "faultId", mt.reference as "faultReference", mt.title as "faultTitle", mt.status as "faultStatus"
        from messages m
        left join users su on su.id = m.sender_user_id
        left join maintenance_tickets mt on mt.id = m.maintenance_ticket_id
       where m.thread_id = ${threadId}
         ${before ? sql`and (m.created_at, m.id) < (${before.createdAt.toISOString()}::timestamptz, ${before.id}::uuid)` : sql``}
       order by m.created_at desc, m.id desc
       limit ${limit + 1}`);
    return (rows as unknown as LeaseMessageRow[]).map((r) => ({ ...r, createdAt: new Date(r.createdAt) }));
  }

  async attachments(messageIds: readonly string[]): Promise<LeaseAttachmentRow[]> {
    if (messageIds.length === 0) return [];
    const { rows } = await this.db.execute<Raw<LeaseAttachmentRow>>(sql`
      select a.id, a.message_id as "messageId", so.object_key as "objectKey", so.mime, so.size_bytes as "sizeBytes",
             a.filename, a.position
        from message_attachments a join stored_objects so on so.id = a.stored_object_id
       where a.message_id in (${sql.join(messageIds.map((id) => sql`${id}::uuid`), sql`, `)})
       order by a.position, a.id`);
    return (rows as unknown as LeaseAttachmentRow[]).map((r) => ({
      ...r,
      sizeBytes: r.sizeBytes == null ? null : Number(r.sizeBytes),
      position: Number(r.position),
    }));
  }

  /** One file of a conversation, for the route that hands it to a reader. */
  async attachment(threadId: string, attachmentId: string): Promise<LeaseAttachmentRow | null> {
    const { rows } = await this.db.execute<Raw<LeaseAttachmentRow>>(sql`
      select a.id, a.message_id as "messageId", so.object_key as "objectKey", so.mime, so.size_bytes as "sizeBytes",
             a.filename, a.position
        from message_attachments a
        join messages m on m.id = a.message_id
        join stored_objects so on so.id = a.stored_object_id
       where a.id = ${attachmentId} and m.thread_id = ${threadId}
       limit 1`);
    return (rows[0] as unknown as LeaseAttachmentRow | undefined) ?? null;
  }

  /** Every reader's last-read time on a conversation. */
  async reads(threadId: string): Promise<{ userId: string; lastReadAt: Date }[]> {
    const rows = await this.db
      .select({ userId: threadReads.userId, lastReadAt: threadReads.lastReadAt })
      .from(threadReads)
      .where(sql`${threadReads.threadId} = ${threadId}`);
    return rows;
  }

  /** Read up to now, at the server's clock. */
  async markRead(threadId: string, userId: string): Promise<Date> {
    const [row] = await this.db
      .insert(threadReads)
      .values({ threadId, userId, lastReadAt: sql`now()` as unknown as Date })
      .onConflictDoUpdate({ target: [threadReads.threadId, threadReads.userId], set: { lastReadAt: sql`now()` } })
      .returning({ at: threadReads.lastReadAt });
    return row?.at ?? new Date();
  }

  /**
   * The newest line of each conversation and the reader's unread count.
   *
   * Unread is the OTHER side's lines (never a system line) after the reader's
   * last read: for a landlord's reader, the tenant's lines; for the tenant,
   * every line but their own. No read row means everything is unread. A
   * broker conversation passes the broker as `tenantUserId`: the one-person
   * side, read the same way.
   */
  async summaries(
    items: readonly { threadId: string; tenantUserId: string | null }[],
    viewer: { userId: string; side: 'landlord' | 'tenant' | 'broker' },
  ): Promise<Map<string, ThreadSummaryRow>> {
    const out = new Map<string, ThreadSummaryRow>();
    if (items.length === 0) return out;
    const values = sql.join(
      items.map((i) => sql`(${i.threadId}::uuid, ${i.tenantUserId}::uuid)`),
      sql`, `,
    );
    const theirs =
      viewer.side === 'landlord'
        ? sql`m.sender_user_id = x.tenant_user_id`
        : sql`m.sender_user_id is not null and m.sender_user_id <> ${viewer.userId}::uuid`;
    const { rows } = await this.db.execute<Raw<ThreadSummaryRow>>(sql`
      with x(thread_id, tenant_user_id) as (values ${values})
      select x.thread_id as "threadId",
             last.created_at as "lastMessageAt", last.body as "lastBody", last.body_type as "lastBodyType",
             last.sender_user_id as "lastSenderUserId", last.voice_duration_s as "lastVoiceS",
             coalesce((select array_agg(case when so.mime like 'image/%' then 'image' when so.mime like 'audio/%' then 'audio' else 'file' end)
                         from message_attachments a join stored_objects so on so.id = a.stored_object_id
                        where a.message_id = last.id), '{}') as "lastKinds",
             (select count(*)::int from messages m
               where m.thread_id = x.thread_id and m.body_type <> 'system' and ${theirs}
                 and m.created_at > coalesce((select tr.last_read_at from thread_reads tr
                                               where tr.thread_id = x.thread_id and tr.user_id = ${viewer.userId}::uuid), '-infinity')
             ) as unread
        from x
        left join lateral (select * from messages m where m.thread_id = x.thread_id order by m.created_at desc, m.id desc limit 1) last on true`);
    for (const r of rows as unknown as ThreadSummaryRow[]) {
      out.set(r.threadId, {
        ...r,
        lastMessageAt: r.lastMessageAt ? new Date(r.lastMessageAt) : null,
        unread: Number(r.unread),
        lastKinds: Array.isArray(r.lastKinds) ? r.lastKinds : [],
      });
    }
    return out;
  }

  /**
   * Conversations to email about (rentals P3.4): a side has lines from the
   * other side, older than `delayMin` and newer than both what that side last
   * read and what the last email covered, and no email went to that side of
   * that conversation in the last `cooldownMin`. The landlord's side has read
   * a line once anyone on it has (the owner or a team member). Lines about a
   * fault are left out: the fault's own emails carried them.
   */
  async digestCandidates(now: Date, delayMin: number, cooldownMin: number): Promise<DigestCandidateRow[]> {
    const cutoff = new Date(now.getTime() - delayMin * 60_000).toISOString();
    const quiet = new Date(now.getTime() - cooldownMin * 60_000).toISOString();
    const { rows } = await this.db.execute<Raw<DigestCandidateRow>>(sql`
      with lt as (
        select th.id as thread_id, l.id as lease_id, l.workspace_id, l.org_id, l.reference, u.label as unit_label,
               p.name as property_name, o.legal_name as landlord_name,
               t.full_name as tenant_name, coalesce(tu.email, t.email) as tenant_email, t.user_id as tenant_user_id
          from threads th
          join leases l on l.id = th.lease_id
          join tenants t on t.id = l.tenant_id
          left join users tu on tu.id = t.user_id
          join rental_units u on u.id = l.unit_id
          join properties p on p.id = l.property_id
          join orgs o on o.id = l.org_id
             where th.lease_id is not null and l.status not in ('draft', 'cancelled')
      ),
      sides as (
        select lt.*, 'tenant'::text as side,
               (select tr.last_read_at from thread_reads tr where tr.thread_id = lt.thread_id and tr.user_id = lt.tenant_user_id) as read_at
          from lt where lt.tenant_user_id is not null
        union all
        select lt.*, 'landlord'::text as side,
               (select max(tr.last_read_at) from thread_reads tr
                 where tr.thread_id = lt.thread_id and tr.user_id is distinct from lt.tenant_user_id) as read_at
          from lt
      ),
      waiting as (
        select s.*, d.notified_through, d.sent_at,
               m.id as message_id, m.created_at, m.body, m.body_type, m.voice_duration_s
          from sides s
          left join thread_digests d on d.thread_id = s.thread_id and d.side = s.side
          join messages m on m.thread_id = s.thread_id
         where m.body_type <> 'system' and m.maintenance_ticket_id is null and m.sender_user_id is not null
           and (case when s.side = 'tenant' then m.sender_user_id is distinct from s.tenant_user_id
                     else m.sender_user_id = s.tenant_user_id end)
           and m.created_at > coalesce(s.read_at, '-infinity')
           and m.created_at > coalesce(d.notified_through, '-infinity')
           and (d.sent_at is null or d.sent_at <= ${quiet}::timestamptz)
      )
      select w.thread_id as "threadId", w.side, w.lease_id as "leaseId", w.workspace_id as "workspaceId", w.org_id as "orgId",
             w.reference, w.unit_label as "unitLabel", w.property_name as "propertyName", w.landlord_name as "landlordName",
             w.tenant_name as "tenantName", w.tenant_email as "tenantEmail",
             count(*)::int as unread,
             max(w.created_at) as "newestAt",
             max(w.created_at)::text as "newestAtExact",
             (array_agg(w.body order by w.created_at desc))[1] as "newestBody",
             (array_agg(w.body_type::text order by w.created_at desc))[1] as "newestBodyType",
             (array_agg(w.voice_duration_s order by w.created_at desc))[1] as "newestVoiceS"
        from waiting w
       group by w.thread_id, w.side, w.lease_id, w.workspace_id, w.org_id, w.reference, w.unit_label, w.property_name,
                w.landlord_name, w.tenant_name, w.tenant_email
      having min(w.created_at) <= ${cutoff}::timestamptz
       order by max(w.created_at)`);
    return (rows as unknown as DigestCandidateRow[]).map((r) => ({
      ...r,
      unread: Number(r.unread),
      newestAt: new Date(r.newestAt),
    }));
  }

  /** The last email to a side of a conversation covered everything up to `through`. */
  async recordDigest(threadId: string, side: 'landlord' | 'tenant' | 'broker', through: string, at: Date): Promise<void> {
    await this.db.execute(sql`
      insert into thread_digests (thread_id, side, notified_through, sent_at)
      values (${threadId}, ${side}, ${through}::timestamptz, ${at.toISOString()}::timestamptz)
      on conflict (thread_id, side) do update set notified_through = excluded.notified_through, sent_at = excluded.sent_at`);
  }
}
