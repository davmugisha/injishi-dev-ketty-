import type {
  FoundItemCategory,
  FoundItemEventKind,
  FoundItemReleaseMethod,
  FoundItemStatus,
} from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { sql, type SQL } from 'drizzle-orm';

import type { BranchScope } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import type { Db } from './room-events';

export type FoundItemRow = {
  id: string;
  org_id: string;
  workspace_id: string;
  property_id: string;
  reference: string;
  description: string;
  category: FoundItemCategory;
  valuable: boolean;
  found_location: string;
  found_spot: string | null;
  room_id: string | null;
  found_at: Date;
  found_by_user_id: string | null;
  found_by_name: string;
  custodian_user_id: string | null;
  custodian_name: string | null;
  storage_location: string | null;
  photo_count: number;
  status: FoundItemStatus;
  retention_until: string;
  retention_note: string | null;
  claimant_name: string | null;
  claim_booking_reference: string | null;
  claim_statement: string | null;
  claim_matched: boolean | null;
  claim_match_note: string | null;
  claim_opened_at: Date | null;
  claim_opened_by_name: string | null;
  release_method: FoundItemReleaseMethod | null;
  released_at: Date | null;
  released_by_name: string | null;
  disposal_note: string | null;
  disposal_rule: string | null;
  disposal_proposed_by_user_id: string | null;
  disposal_proposed_by_name: string | null;
  disposal_proposed_at: Date | null;
  disposal_approved_by_name: string | null;
  disposed_at: Date | null;
  closed_note: string | null;
}

export type FoundItemEventRow = {
  id: string;
  found_item_id: string;
  kind: FoundItemEventKind;
  summary: string;
  actor_name: string | null;
  detail: string | null;
  occurred_at: Date;
}

function inScope(column: SQL, scope: BranchScope): SQL {
  const ids = [...scope.propertyIds];
  if (ids.length === 0) return sql`false`;
  return sql`${column} in (${sql.join(
    ids.map((id) => sql`${id}::uuid`),
    sql`, `,
  )})`;
}

/** The lost and found register's rows. Never deletes: a closed item keeps its custody chain. */
@Injectable()
export class LostFoundRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  get database(): Database {
    return this.db;
  }

  private select = sql`
      select f.id, f.org_id, f.workspace_id, f.property_id, f.reference, f.description, f.category, f.valuable,
             f.found_location, f.found_spot, f.room_id, f.found_at, f.found_by_user_id,
             coalesce(fu.name, f.found_by_name) as found_by_name, f.custodian_user_id, cu.name as custodian_name,
             f.storage_location, f.photo_count, f.status, to_char(f.retention_until, 'YYYY-MM-DD') as retention_until,
             f.retention_note, f.claimant_name, f.claim_booking_reference, f.claim_statement, f.claim_matched,
             f.claim_match_note, f.claim_opened_at, ou.name as claim_opened_by_name, f.release_method, f.released_at,
             ru.name as released_by_name, f.disposal_note, f.disposal_rule, f.disposal_proposed_by_user_id,
             pu.name as disposal_proposed_by_name, f.disposal_proposed_at, au.name as disposal_approved_by_name,
             f.disposed_at, f.closed_note
        from found_items f
        left join users fu on fu.id = f.found_by_user_id
        left join users cu on cu.id = f.custodian_user_id
        left join users ou on ou.id = f.claim_opened_by_user_id
        left join users ru on ru.id = f.released_by_user_id
        left join users pu on pu.id = f.disposal_proposed_by_user_id
        left join users au on au.id = f.disposal_approved_by_user_id
  `;

  async list(workspaceId: string, scope: BranchScope): Promise<FoundItemRow[]> {
    const found = await this.db.execute<FoundItemRow>(sql`
      ${this.select}
       where f.workspace_id = ${workspaceId} and ${inScope(sql`f.property_id`, scope)}
       order by f.found_at desc, f.reference desc
    `);
    return found.rows;
  }

  async find(db: Db, id: string, lock = false): Promise<FoundItemRow | null> {
    const found = await db.execute<FoundItemRow>(sql`${this.select} where f.id = ${id} ${lock ? sql`for update of f` : sql``}`);
    return found.rows[0] ?? null;
  }

  async events(itemIds: string[]): Promise<FoundItemEventRow[]> {
    if (itemIds.length === 0) return [];
    const found = await this.db.execute<FoundItemEventRow>(sql`
      select e.id, e.found_item_id, e.kind, e.summary, coalesce(u.name, e.actor_name) as actor_name, e.detail,
             e.occurred_at
        from found_item_events e
        left join users u on u.id = e.actor_user_id
       where e.found_item_id in (${sql.join(
         itemIds.map((id) => sql`${id}::uuid`),
         sql`, `,
       )})
       order by e.occurred_at, e.id
    `);
    return found.rows;
  }

  async addEvent(
    db: Db,
    input: {
      workspaceId: string;
      itemId: string;
      kind: FoundItemEventKind;
      summary: string;
      actorUserId?: string | null;
      actorName?: string | null;
      detail?: string | null;
      occurredAt?: Date;
    },
  ): Promise<void> {
    await db.execute(sql`
      insert into found_item_events (workspace_id, found_item_id, kind, summary, actor_user_id, actor_name, detail,
                                     occurred_at)
      values (${input.workspaceId}, ${input.itemId}, ${input.kind}, ${input.summary}, ${input.actorUserId ?? null},
              ${input.actorName ?? null}, ${input.detail ?? null}, ${input.occurredAt ?? new Date()})
    `);
  }

  /** The next "LF-yy-nnn" of the workspace for the year, under a transaction-scoped lock. */
  async nextReference(tx: Db, workspaceId: string, year: string): Promise<string> {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`found-item:${workspaceId}`}))`);
    const prefix = `LF-${year.slice(2)}-`;
    const found = await tx.execute<{ next: number }>(sql`
      select coalesce(max((substring(reference from ${`^${prefix}([0-9]+)$`}))::int), 0) + 1 as next
        from found_items where workspace_id = ${workspaceId} and reference like ${`${prefix}%`}
    `);
    return `${prefix}${String(Number(found.rows[0]?.next ?? 1)).padStart(3, '0')}`;
  }

  async roomByLabel(propertyId: string, label: string): Promise<{ id: string } | null> {
    const found = await this.db.execute<{ id: string }>(sql`
      select id from rooms where property_id = ${propertyId} and lower(label) = lower(${label}) limit 1
    `);
    return found.rows[0] ?? null;
  }

  async pickProperty(workspaceId: string, candidates: readonly string[]): Promise<{ id: string; orgId: string } | null> {
    if (candidates.length === 0) return null;
    const found = await this.db.execute<{ id: string; org_id: string }>(sql`
      select id, org_id from properties
       where workspace_id = ${workspaceId} and archived_at is null
         and id in (${sql.join(
           candidates.map((c) => sql`${c}::uuid`),
           sql`, `,
         )})
       order by is_head_office desc, created_at asc
       limit 1
    `);
    const row = found.rows[0];
    return row ? { id: row.id, orgId: row.org_id } : null;
  }

  /**
   * Does the claimant's booking cover the room and the day the item was found? Read from the stay the
   * booking became (its room and its dates), else the room the desk held for it.
   */
  async bookingMatch(
    workspaceId: string,
    reference: string,
    roomId: string | null,
    foundAt: Date,
  ): Promise<{ bookingId: string; roomLabel: string | null; checkIn: string; checkOut: string; covers: boolean } | null> {
    const found = await this.db.execute<{
      booking_id: string;
      room_label: string | null;
      check_in: string;
      check_out: string;
      covers: boolean;
    }>(sql`
      select b.id as booking_id, r.label as room_label,
             to_char(b.check_in, 'YYYY-MM-DD') as check_in, to_char(b.check_out, 'YYYY-MM-DD') as check_out,
             (${roomId}::uuid is not null and r.id = ${roomId}::uuid
               and (${foundAt}::timestamptz at time zone 'Africa/Kigali')::date between b.check_in and b.check_out) as covers
        from bookings b
        left join lateral (
          select coalesce(gs.room_id, ra.room_id) as room_id
            from (select 1) x
            left join guest_stays gs on gs.booking_id = b.id
            left join room_assignments ra on ra.booking_id = b.id and ra.status <> 'released'
           limit 1
        ) placed on true
        left join rooms r on r.id = placed.room_id
       where b.workspace_id = ${workspaceId} and upper(b.reference) = upper(${reference})
       limit 1
    `);
    const row = found.rows[0];
    return row
      ? { bookingId: row.booking_id, roomLabel: row.room_label, checkIn: row.check_in, checkOut: row.check_out, covers: Boolean(row.covers) }
      : null;
  }

  /** Staff who appear on the register (finders, custodians, actors), for naming one at intake. */
  async people(workspaceId: string): Promise<{ user_id: string; name: string }[]> {
    const found = await this.db.execute<{ user_id: string; name: string }>(sql`
      select distinct u.id as user_id, coalesce(u.name, u.email) as name
        from users u
       where u.id in (
         select found_by_user_id from found_items where workspace_id = ${workspaceId} and found_by_user_id is not null
         union select custodian_user_id from found_items where workspace_id = ${workspaceId} and custodian_user_id is not null
         union select actor_user_id from found_item_events where workspace_id = ${workspaceId} and actor_user_id is not null
       )
       order by name
    `);
    return found.rows;
  }
}
