import type {
  ConditionSignalConfidence,
  ConditionSignalStatus,
  MaintenanceCategory,
  MaintenancePriority,
  MaintenanceStatus,
  RoomBlockStatus,
  WorkOrderEventKind,
  WorkOrderPartState,
} from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { sql, type SQL } from 'drizzle-orm';

import { type BranchScope } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import type { Db } from './room-events';

export type WorkOrderRow = {
  id: string;
  workspace_id: string;
  org_id: string | null;
  property_id: string | null;
  reference: string | null;
  room_id: string | null;
  room_label: string | null;
  room_type_name: string | null;
  floor: number | null;
  space_id: string | null;
  space_name: string | null;
  asset_id: string | null;
  asset_name: string | null;
  title: string;
  description: string | null;
  category: MaintenanceCategory | null;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  assigned_to_user_id: string | null;
  assigned_to_name: string | null;
  assigned_contractor: string | null;
  scheduled_for: string | null;
  raised_by_name: string | null;
  raised_via: string | null;
  created_at: Date;
  impact_note: string | null;
  release_note: string | null;
  photo_object_keys: unknown;
  resolved_at: Date | null;
  verified_at: Date | null;
}

export type PartRow = {
  id: string;
  ticket_id: string;
  name: string;
  quantity: string | number;
  unit: string | null;
  source: string;
  state: WorkOrderPartState;
}

export type EventRow = {
  id: string;
  ticket_id: string;
  kind: WorkOrderEventKind;
  note: string | null;
  actor_name: string | null;
  created_at: Date;
}

export type PhotoRow = {
  ticket_id: string;
  object_key: string;
  caption: string | null;
}

export type BlockRow = {
  id: string;
  workspace_id: string;
  property_id: string;
  room_id: string;
  maintenance_ticket_id: string | null;
  status: RoomBlockStatus;
  starts_at: Date;
  ends_at: Date | null;
  reason: string;
  requested_by_name: string | null;
  requested_at: Date;
  decided_by_name: string | null;
  decided_at: Date | null;
  decision_note: string | null;
  released_by_name: string | null;
  released_at: Date | null;
  affected: number;
}

export type SignalRow = {
  id: string;
  workspace_id: string;
  property_id: string;
  asset_id: string | null;
  asset_label: string;
  rule_code: string;
  rule_text: string;
  headline: string;
  confidence: ConditionSignalConfidence;
  evidence: unknown;
  data_quality: string;
  recommendation: string;
  draft: unknown;
  status: ConditionSignalStatus;
  work_order_id: string | null;
  work_order_reference: string | null;
  raised_at: Date;
  reviewed_by_name: string | null;
  reviewed_at: Date | null;
  review_note: string | null;
}

/** A place a work order can be about: a room, a space or a piece of equipment of a property. */
export interface LocationMatch {
  propertyId: string;
  roomId: string | null;
  spaceId: string | null;
  assetId: string | null;
  label: string;
}

function inScope(column: SQL, scope: BranchScope): SQL {
  const ids = [...scope.propertyIds];
  if (ids.length === 0) return scope.includesUnbranched ? sql`${column} is null` : sql`false`;
  const listed = sql`${column} in (${sql.join(
    ids.map((id) => sql`${id}::uuid`),
    sql`, `,
  )})`;
  return scope.includesUnbranched ? sql`(${listed} or ${column} is null)` : listed;
}

/** The hotel's maintenance board: work orders (maintenance tickets with no lease), parts, blocks, signals. */
@Injectable()
export class WorkOrdersRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  get database(): Database {
    return this.db;
  }

  private select = sql`
      select t.id, t.workspace_id, t.org_id, coalesce(t.property_id, r.property_id, s.property_id) as property_id,
             t.reference, t.room_id, r.label as room_label, rt.name as room_type_name, r.floor,
             t.space_id, s.name as space_name, t.asset_id, a.name as asset_name, t.title, t.description,
             t.category, t.priority, t.status, t.assigned_to_user_id, au.name as assigned_to_name,
             t.assigned_contractor, to_char(t.scheduled_for, 'YYYY-MM-DD') as scheduled_for,
             ru.name as raised_by_name, t.raised_via, t.created_at, t.impact_note, t.release_note,
             t.photo_object_keys, t.resolved_at, t.verified_at
        from maintenance_tickets t
        left join rooms r on r.id = t.room_id
        left join room_types rt on rt.id = r.room_type_id
        left join spaces s on s.id = t.space_id
        left join assets a on a.id = t.asset_id
        left join users au on au.id = t.assigned_to_user_id
        left join users ru on ru.id = t.raised_by_user_id
  `;

  async list(workspaceId: string, scope: BranchScope): Promise<WorkOrderRow[]> {
    const found = await this.db.execute<WorkOrderRow>(sql`
      ${this.select}
       where t.workspace_id = ${workspaceId} and t.lease_id is null and t.unit_id is null
         and ${inScope(sql`coalesce(t.property_id, r.property_id, s.property_id)`, scope)}
       order by (t.status in ('resolved', 'closed', 'wont_fix', 'cancelled')),
                case t.priority when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end,
                t.created_at desc
    `);
    return found.rows;
  }

  async find(db: Db, id: string, lock = false): Promise<WorkOrderRow | null> {
    const found = await db.execute<WorkOrderRow>(sql`
      ${this.select} where t.id = ${id} ${lock ? sql`for update of t` : sql``}
    `);
    return found.rows[0] ?? null;
  }

  async parts(ticketIds: string[]): Promise<PartRow[]> {
    if (ticketIds.length === 0) return [];
    const found = await this.db.execute<PartRow>(sql`
      select id, ticket_id, name, quantity, unit, source, state
        from maintenance_parts
       where ticket_id in (${sql.join(
         ticketIds.map((id) => sql`${id}::uuid`),
         sql`, `,
       )})
       order by sort_order, created_at
    `);
    return found.rows;
  }

  async events(ticketIds: string[]): Promise<EventRow[]> {
    if (ticketIds.length === 0) return [];
    const found = await this.db.execute<EventRow>(sql`
      select e.id, e.ticket_id, e.kind, e.note, u.name as actor_name, e.created_at
        from maintenance_events e
        left join users u on u.id = e.author_user_id
       where e.ticket_id in (${sql.join(
         ticketIds.map((id) => sql`${id}::uuid`),
         sql`, `,
       )})
       order by e.created_at, e.id
    `);
    return found.rows;
  }

  /** The photos of each ticket (`maintenance_photos`, WP 4.1), by phase and position. */
  async photos(ticketIds: string[]): Promise<PhotoRow[]> {
    if (ticketIds.length === 0) return [];
    const found = await this.db.execute<PhotoRow>(sql`
      select p.ticket_id, so.object_key, p.caption
        from maintenance_photos p
        join stored_objects so on so.id = p.stored_object_id
       where p.ticket_id in (${sql.join(
         ticketIds.map((id) => sql`${id}::uuid`),
         sql`, `,
       )})
       order by p.phase, p.position, p.created_at
    `);
    return found.rows;
  }

  /** The latest block of each ticket (any status), with how many reservations hold the room inside it. */
  async blocks(db: Db, ticketIds: string[]): Promise<BlockRow[]> {
    if (ticketIds.length === 0) return [];
    const found = await db.execute<BlockRow>(sql`
      select distinct on (b.maintenance_ticket_id)
             b.id, b.workspace_id, b.property_id, b.room_id, b.maintenance_ticket_id, b.status, b.starts_at,
             b.ends_at, b.reason, rq.name as requested_by_name, b.requested_at, dc.name as decided_by_name,
             b.decided_at, b.decision_note, rl.name as released_by_name, b.released_at,
             (select count(*) from room_assignments ra
               where ra.room_id = b.room_id and ra.status = 'assigned'
                 and ra.occupies && daterange((b.starts_at at time zone 'Africa/Kigali')::date,
                                              coalesce((b.ends_at at time zone 'Africa/Kigali')::date + 1,
                                                       'infinity'::date), '[)'))::int as affected
        from room_blocks b
        left join users rq on rq.id = b.requested_by_user_id
        left join users dc on dc.id = b.decided_by_user_id
        left join users rl on rl.id = b.released_by_user_id
       where b.maintenance_ticket_id in (${sql.join(
         ticketIds.map((id) => sql`${id}::uuid`),
         sql`, `,
       )})
       order by b.maintenance_ticket_id, b.requested_at desc
    `);
    return found.rows;
  }

  async openBlockForTicket(db: Db, ticketId: string): Promise<BlockRow | null> {
    const rows = await this.blocks(db, [ticketId]);
    const row = rows[0];
    return row && (row.status === 'requested' || row.status === 'active') ? row : null;
  }

  /** Resolve "Room 302", "Lake Bar" or "Generator" to a room, space or asset in the given properties. */
  async locate(workspaceId: string, propertyIds: readonly string[], text: string): Promise<LocationMatch[]> {
    if (propertyIds.length === 0) return [];
    const props = sql`(${sql.join(
      propertyIds.map((id) => sql`${id}::uuid`),
      sql`, `,
    )})`;
    const roomLabel = text.match(/^room\s+(.+)$/i)?.[1]?.trim();
    if (roomLabel) {
      const rooms = await this.db.execute<{ id: string; property_id: string; label: string }>(sql`
        select id, property_id, label from rooms
         where workspace_id = ${workspaceId} and property_id in ${props}
           and lower(label) = lower(${roomLabel})
      `);
      return rooms.rows.map((r) => ({
        propertyId: r.property_id,
        roomId: r.id,
        spaceId: null,
        assetId: null,
        label: `Room ${r.label}`,
      }));
    }
    const spaces = await this.db.execute<{ id: string; property_id: string; name: string }>(sql`
      select id, property_id, name from spaces
       where property_id in ${props} and lower(name) = lower(${text})
    `);
    if (spaces.rows.length > 0) {
      return spaces.rows.map((s) => ({
        propertyId: s.property_id,
        roomId: null,
        spaceId: s.id,
        assetId: null,
        label: s.name,
      }));
    }
    const assets = await this.db.execute<{
      id: string;
      property_id: string;
      name: string;
      room_id: string | null;
      space_id: string | null;
    }>(sql`
      select id, property_id, name, room_id, space_id from assets
       where workspace_id = ${workspaceId} and property_id in ${props} and lower(name) = lower(${text})
    `);
    return assets.rows.map((a) => ({
      propertyId: a.property_id,
      roomId: a.room_id,
      spaceId: a.space_id,
      assetId: a.id,
      label: a.name,
    }));
  }

  async engineeringDepartment(db: Db, propertyId: string): Promise<string | null> {
    const found = await db.execute<{ id: string }>(sql`
      select id from departments where property_id = ${propertyId} and department_category = 'engineering' limit 1
    `);
    return found.rows[0]?.id ?? null;
  }

  /** The next "WO-n" of the workspace, under a transaction-scoped lock so two creates never share one. */
  async nextReference(tx: Db, workspaceId: string): Promise<string> {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`work-order:${workspaceId}`}))`);
    const found = await tx.execute<{ next: number }>(sql`
      select coalesce(max((substring(reference from '^WO-([0-9]+)$'))::int), 0) + 1 as next
        from maintenance_tickets where workspace_id = ${workspaceId} and reference ~ '^WO-[0-9]+$'
    `);
    return `WO-${Number(found.rows[0]?.next ?? 1)}`;
  }

  async addEvent(
    db: Db,
    input: { ticketId: string; kind: WorkOrderEventKind; note: string | null; actorUserId: string | null },
  ): Promise<void> {
    // The wall clock, not the transaction's start: a report and its assignment written in one
    // transaction keep their order on the timeline.
    await db.execute(sql`
      insert into maintenance_events (ticket_id, author_user_id, author_role, kind, note, created_at)
      values (${input.ticketId}, ${input.actorUserId}, ${input.actorUserId ? 'staff' : null}::maintenance_raised_by_role,
              ${input.kind}, ${input.note}, clock_timestamp())
    `);
  }

  /** Who usually takes the work: the staff member assigned the most orders in the last 30 days. */
  async usualAssignee(workspaceId: string): Promise<{ userId: string; name: string } | null> {
    const found = await this.db.execute<{ user_id: string; name: string }>(sql`
      select t.assigned_to_user_id as user_id, coalesce(u.name, u.email) as name
        from maintenance_tickets t join users u on u.id = t.assigned_to_user_id
       where t.workspace_id = ${workspaceId} and t.lease_id is null and t.unit_id is null
         and t.created_at > now() - interval '30 days'
       group by t.assigned_to_user_id, u.name, u.email
       order by count(*) desc, u.name
       limit 1
    `);
    const row = found.rows[0];
    return row ? { userId: row.user_id, name: row.name } : null;
  }

  async medianHoursToClose(workspaceId: string): Promise<number | null> {
    const found = await this.db.execute<{ median: string | null }>(sql`
      select percentile_cont(0.5) within group (
               order by extract(epoch from (resolved_at - created_at)) / 3600.0) as median
        from maintenance_tickets
       where workspace_id = ${workspaceId} and lease_id is null and unit_id is null and resolved_at is not null
         and resolved_at > now() - interval '30 days'
    `);
    const m = found.rows[0]?.median;
    return m === null || m === undefined ? null : Math.round(Number(m));
  }

  // --- condition signals ---

  private signalSelect = sql`
      select c.id, c.workspace_id, c.property_id, c.asset_id, c.asset_label, c.rule_code, c.rule_text, c.headline,
             c.confidence, c.evidence, c.data_quality, c.recommendation, c.draft, c.status, c.work_order_id,
             mt.reference as work_order_reference, c.raised_at, u.name as reviewed_by_name, c.reviewed_at,
             c.review_note
        from condition_signals c
        left join maintenance_tickets mt on mt.id = c.work_order_id
        left join users u on u.id = c.reviewed_by_user_id
  `;

  async signals(workspaceId: string, scope: BranchScope): Promise<SignalRow[]> {
    const found = await this.db.execute<SignalRow>(sql`
      ${this.signalSelect}
       where c.workspace_id = ${workspaceId} and ${inScope(sql`c.property_id`, scope)}
       order by (c.status <> 'open'), c.raised_at desc
    `);
    return found.rows;
  }

  async signal(db: Db, id: string, lock = false): Promise<SignalRow | null> {
    const found = await db.execute<SignalRow>(sql`
      ${this.signalSelect} where c.id = ${id} ${lock ? sql`for update of c` : sql``}
    `);
    return found.rows[0] ?? null;
  }
}
