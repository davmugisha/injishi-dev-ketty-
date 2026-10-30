import type { HousekeepingCheckResult, HousekeepingChecklistKind, InspectionCheckVerdict } from '@injishi/contracts';
import { Inject, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { type SQL, sql } from 'drizzle-orm';

import { type BranchScope } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import type { Db } from './room-events';

export type ChecklistItemRow = {
  id: string;
  property_id: string;
  kind: HousekeepingChecklistKind;
  section_code: string;
  section_title: string;
  code: string;
  label: string;
  requires_photo: boolean;
  sort_order: number;
};

export type TaskCheckRow = {
  task_id: string;
  item_id: string;
  result: HousekeepingCheckResult;
  photo_object_key: string | null;
  checked_by_name: string | null;
  checked_at: Date;
};

export type MinibarItemRow = {
  id: string;
  code: string;
  label: string;
  par_level: number;
  sort_order: number;
};

export type MinibarCountRow = {
  task_id: string;
  item_id: string;
  par_level: number;
  used: number;
  counted_by_name: string | null;
  counted_at: Date;
};

export type PhoneFoundRow = {
  id: string;
  reference: string;
  description: string;
  room_label: string | null;
  found_location: string;
  found_spot: string | null;
  found_at: Date;
  category: string;
  photo_count: number;
  custodian_name: string | null;
  status: string;
};

export type TimeLogRow = {
  id: string;
  ticket_id: string;
  user_id: string;
  user_name: string | null;
  kind: 'diagnosis' | 'repair';
  started_at: Date;
  ended_at: Date | null;
};

const uuidList = (ids: readonly string[]): SQL =>
  sql.join(
    ids.map((id) => sql`${id}::uuid`),
    sql`, `,
  );

/** Start of a Kigali day, as an instant. */
const dayStart = (day: string): SQL => sql`(${day}::date::timestamp at time zone 'Africa/Kigali')`;

/**
 * The staff phone's rows (real-data 1.3.3): checklists and their results, minibar stock and counts,
 * the caller's floors and the places on them, items they found, and time on work orders.
 */
@Injectable()
export class StaffPhoneRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  get database(): Database {
    return this.db;
  }

  async checklist(propertyId: string): Promise<ChecklistItemRow[]> {
    const found = await this.db.execute<ChecklistItemRow>(sql`
      select id, property_id, kind, section_code, section_title, code, label, requires_photo, sort_order
        from housekeeping_checklist_items
       where property_id = ${propertyId} and status = 'active'
       order by kind, sort_order, code
    `);
    return found.rows;
  }

  /** Results on the property's open tasks and on the tasks finished or inspected today. */
  async checks(propertyId: string, today: string): Promise<TaskCheckRow[]> {
    const found = await this.db.execute<TaskCheckRow>(sql`
      select c.task_id, c.item_id, c.result, c.photo_object_key, u.name as checked_by_name, c.checked_at
        from housekeeping_task_checks c
        join housekeeping_tasks t on t.id = c.task_id
        left join users u on u.id = c.checked_by_user_id
       where t.property_id = ${propertyId}
         and (t.status in ('pending', 'in_progress', 'blocked', 'done')
              or coalesce(t.inspected_at, t.completed_at, t.updated_at) >= ${dayStart(today)})
       order by c.checked_at
    `);
    return found.rows;
  }

  async minibarItems(propertyId: string): Promise<MinibarItemRow[]> {
    const found = await this.db.execute<MinibarItemRow>(sql`
      select id, code, label, par_level, sort_order from minibar_items
       where property_id = ${propertyId} and status = 'active'
       order by sort_order, code
    `);
    return found.rows;
  }

  async minibarCounts(propertyId: string, today: string): Promise<MinibarCountRow[]> {
    const found = await this.db.execute<MinibarCountRow>(sql`
      select m.task_id, m.item_id, m.par_level, m.used, u.name as counted_by_name, m.counted_at
        from minibar_counts m
        join housekeeping_tasks t on t.id = m.task_id
        left join users u on u.id = m.counted_by_user_id
       where m.property_id = ${propertyId}
         and (t.status in ('pending', 'in_progress', 'blocked') or m.counted_at >= ${dayStart(today)})
    `);
    return found.rows;
  }

  /** Today's arrivals into the property's rooms, with how many guests each booking brings. */
  async arrivals(propertyId: string, today: string): Promise<{ room_id: string; guests: number }[]> {
    const found = await this.db.execute<{ room_id: string; guests: number }>(sql`
      select distinct on (ra.room_id) ra.room_id, b.guest_count::int as guests
        from room_assignments ra
        join bookings b on b.id = ra.booking_id
        join rooms r on r.id = ra.room_id
       where r.property_id = ${propertyId} and ra.status = 'assigned'
         and b.status = 'confirmed' and b.check_in = ${today}::date
         and not exists (select 1 from guest_stays g where g.booking_id = b.id)
       order by ra.room_id, b.created_at
    `);
    return found.rows;
  }

  /** The floors today's allocation sheet gives this person at the property. */
  async floorsOf(propertyId: string, userId: string, today: string): Promise<number[]> {
    const found = await this.db.execute<{ floors: number[] | null }>(sql`
      select floors::int[] as floors from housekeeping_allocations
       where property_id = ${propertyId} and user_id = ${userId} and work_date = ${today}::date
       limit 1
    `);
    return (found.rows[0]?.floors ?? []).map(Number);
  }

  async spacesOn(propertyId: string, floors: readonly number[]): Promise<{ id: string; name: string; floor: number | null }[]> {
    if (floors.length === 0) return [];
    const found = await this.db.execute<{ id: string; name: string; floor: number | null }>(sql`
      select id, name, floor from spaces
       where property_id = ${propertyId} and floor in (${sql.join(
         floors.map((f) => sql`${f}::int`),
         sql`, `,
       )})
       order by floor, sort_order, name
    `);
    return found.rows;
  }

  async nameOf(userId: string): Promise<string | null> {
    const found = await this.db.execute<{ name: string }>(sql`
      select coalesce(name, email) as name from users where id = ${userId}
    `);
    return found.rows[0]?.name ?? null;
  }

  /** Today's housekeeping supervisor at the property, from the allocation sheet. */
  async supervisor(propertyId: string, today: string): Promise<{ user_id: string; name: string } | null> {
    const found = await this.db.execute<{ user_id: string; name: string }>(sql`
      select a.user_id, coalesce(u.name, u.email) as name
        from housekeeping_allocations a
        join users u on u.id = a.user_id
       where a.property_id = ${propertyId} and a.work_date = ${today}::date and a.role = 'supervisor'
       order by a.shift_starts_at
       limit 1
    `);
    return found.rows[0] ?? null;
  }

  /** What this person found and logged in the last thirty days, newest first. */
  async foundBy(workspaceId: string, userId: string, scope: BranchScope): Promise<PhoneFoundRow[]> {
    if (scope.propertyIds.length === 0) return [];
    const found = await this.db.execute<PhoneFoundRow>(sql`
      select f.id, f.reference, f.description, r.label as room_label, f.found_location, f.found_spot, f.found_at,
             f.category::text as category, f.photo_count::int as photo_count, cu.name as custodian_name,
             f.status::text as status
        from found_items f
        left join rooms r on r.id = f.room_id
        left join users cu on cu.id = f.custodian_user_id
       where f.workspace_id = ${workspaceId} and f.found_by_user_id = ${userId}
         and f.property_id in (${uuidList(scope.propertyIds)})
         and f.found_at >= now() - interval '30 days'
       order by f.found_at desc, f.reference desc
    `);
    return found.rows;
  }

  // --- checklist results -------------------------------------------------------------------------

  async item(db: Db, id: string): Promise<ChecklistItemRow | null> {
    const found = await db.execute<ChecklistItemRow>(sql`
      select id, property_id, kind, section_code, section_title, code, label, requires_photo, sort_order
        from housekeeping_checklist_items where id = ${id} and status = 'active'
    `);
    return found.rows[0] ?? null;
  }

  async tick(db: Db, input: { workspaceId: string; taskId: string; itemId: string; userId: string }): Promise<void> {
    await db.execute(sql`
      insert into housekeeping_task_checks (workspace_id, task_id, item_id, result, checked_by_user_id, checked_at)
      values (${input.workspaceId}, ${input.taskId}, ${input.itemId}, 'done', ${input.userId}, now())
      on conflict (task_id, item_id) do nothing
    `);
  }

  async untick(db: Db, taskId: string, itemId: string): Promise<void> {
    await db.execute(sql`
      delete from housekeeping_task_checks where task_id = ${taskId} and item_id = ${itemId} and result = 'done'
    `);
  }

  async checksOfTask(db: Db, taskId: string): Promise<TaskCheckRow[]> {
    const found = await db.execute<TaskCheckRow>(sql`
      select c.task_id, c.item_id, c.result, c.photo_object_key, u.name as checked_by_name, c.checked_at
        from housekeeping_task_checks c
        left join users u on u.id = c.checked_by_user_id
       where c.task_id = ${taskId}
       order by c.checked_at
    `);
    return found.rows;
  }

  /**
   * Write an inspection's per-check verdicts on the inspected task, in the caller's transaction (the
   * inspection decision's). Every item must be an active inspection check of the task's property.
   */
  async writeInspectionChecks(
    tx: Db,
    input: { workspaceId: string; taskId: string; propertyId: string; userId: string; checks: InspectionCheckVerdict[] },
  ): Promise<void> {
    if (input.checks.length === 0) return;
    const ids = [...new Set(input.checks.map((c) => c.itemId))];
    if (ids.length !== input.checks.length) throw new UnprocessableEntityException('Each check is judged once.');
    const items = await tx.execute<{ id: string }>(sql`
      select id from housekeeping_checklist_items
       where property_id = ${input.propertyId} and kind = 'inspection' and status = 'active'
         and id in (${uuidList(ids)})
    `);
    if (items.rows.length !== ids.length) {
      throw new UnprocessableEntityException('Judge the checks of this property’s inspection checklist only.');
    }
    for (const c of input.checks) {
      await tx.execute(sql`
        insert into housekeeping_task_checks
          (workspace_id, task_id, item_id, result, photo_object_key, checked_by_user_id, checked_at)
        values (${input.workspaceId}, ${input.taskId}, ${c.itemId}, ${c.result}, ${c.photoObjectKey ?? null},
                ${input.userId}, now())
        on conflict (task_id, item_id) do update
          set result = excluded.result, photo_object_key = excluded.photo_object_key,
              checked_by_user_id = excluded.checked_by_user_id, checked_at = excluded.checked_at
      `);
    }
  }

  // --- minibar ---------------------------------------------------------------------------------------

  async minibarItemsByIds(db: Db, propertyId: string, ids: readonly string[]): Promise<MinibarItemRow[]> {
    if (ids.length === 0) return [];
    const found = await db.execute<MinibarItemRow>(sql`
      select id, code, label, par_level, sort_order from minibar_items
       where property_id = ${propertyId} and status = 'active' and id in (${uuidList(ids)})
    `);
    return found.rows;
  }

  async upsertMinibarCount(
    db: Db,
    input: {
      workspaceId: string;
      propertyId: string;
      taskId: string;
      roomId: string;
      itemId: string;
      parLevel: number;
      used: number;
      userId: string;
    },
  ): Promise<void> {
    await db.execute(sql`
      insert into minibar_counts
        (workspace_id, property_id, task_id, room_id, item_id, par_level, used, counted_by_user_id, counted_at)
      values (${input.workspaceId}, ${input.propertyId}, ${input.taskId}, ${input.roomId}, ${input.itemId},
              ${input.parLevel}, ${input.used}, ${input.userId}, now())
      on conflict (task_id, item_id) do update
        set par_level = excluded.par_level, used = excluded.used,
            counted_by_user_id = excluded.counted_by_user_id, counted_at = excluded.counted_at
    `);
  }

  async minibarCountsOfTask(db: Db, taskId: string): Promise<MinibarCountRow[]> {
    const found = await db.execute<MinibarCountRow>(sql`
      select m.task_id, m.item_id, m.par_level, m.used, u.name as counted_by_name, m.counted_at
        from minibar_counts m
        left join users u on u.id = m.counted_by_user_id
       where m.task_id = ${taskId}
    `);
    return found.rows;
  }

  // --- time on work orders ---------------------------------------------------------------------------

  /** Sessions on the workspace's open orders, and on orders closed in the last seven days. */
  async timeLogs(workspaceId: string, scope: BranchScope): Promise<TimeLogRow[]> {
    if (scope.propertyIds.length === 0) return [];
    const found = await this.db.execute<TimeLogRow>(sql`
      select l.id, l.ticket_id, l.user_id, u.name as user_name, l.kind, l.started_at, l.ended_at
        from maintenance_time_logs l
        join maintenance_tickets t on t.id = l.ticket_id
        left join rooms r on r.id = t.room_id
        left join spaces s on s.id = t.space_id
        left join users u on u.id = l.user_id
       where l.workspace_id = ${workspaceId}
         and coalesce(t.property_id, r.property_id, s.property_id) in (${uuidList(scope.propertyIds)})
         and (t.status not in ('resolved', 'closed', 'cancelled') or l.started_at >= now() - interval '7 days')
       order by l.ticket_id, l.started_at
    `);
    return found.rows;
  }

  async runningLog(db: Db, ticketId: string, userId: string): Promise<TimeLogRow | null> {
    const found = await db.execute<TimeLogRow>(sql`
      select l.id, l.ticket_id, l.user_id, null::text as user_name, l.kind, l.started_at, l.ended_at
        from maintenance_time_logs l
       where l.ticket_id = ${ticketId} and l.user_id = ${userId} and l.ended_at is null
       for update
    `);
    return found.rows[0] ?? null;
  }

  async startLog(
    db: Db,
    input: { workspaceId: string; ticketId: string; userId: string; kind: 'diagnosis' | 'repair' },
  ): Promise<void> {
    await db.execute(sql`
      insert into maintenance_time_logs (workspace_id, ticket_id, user_id, kind, started_at)
      values (${input.workspaceId}, ${input.ticketId}, ${input.userId}, ${input.kind}, now())
      on conflict do nothing
    `);
  }

  /** Close every running session on the order (the caller's, or everyone's when the order closes). */
  async stopLogs(db: Db, ticketId: string, userId: string | null): Promise<number> {
    const done = await db.execute(sql`
      update maintenance_time_logs set ended_at = greatest(now(), started_at)
       where ticket_id = ${ticketId} and ended_at is null ${userId ? sql`and user_id = ${userId}` : sql``}
    `);
    return done.rowCount ?? 0;
  }
}
