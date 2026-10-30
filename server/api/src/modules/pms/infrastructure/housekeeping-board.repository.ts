import type {
  HousekeepingAllocationRole,
  HousekeepingEscalationKind,
  HousekeepingEscalationLevel,
  HousekeepingRuleCode,
  HousekeepingStatus,
  HousekeepingTaskStatus,
  HousekeepingTaskType,
  RoomEventKind,
  RoomServiceFlag,
  RoomStatus,
} from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import type { Db } from './room-events';

export type BoardRoomRow = {
  id: string;
  label: string | null;
  floor: number | null;
  room_type_name: string;
  status: RoomStatus;
  housekeeping_status: HousekeepingStatus;
  housekeeping_updated_at: Date | null;
  service_flag: RoomServiceFlag | null;
  stay_id: string | null;
  stay_guest_name: string | null;
  planned_exit_at: Date | null;
  arrival_guest_name: string | null;
  arrival_reference: string | null;
  arrival_booking_id: string | null;
  check_in_time: string | null;
  block_id: string | null;
  block_status: 'requested' | 'active' | null;
  block_starts_at: Date | null;
  block_ends_at: Date | null;
  block_ticket_id: string | null;
  block_ticket_reference: string | null;
}

export type BoardTaskRow = {
  id: string;
  workspace_id: string;
  property_id: string;
  room_id: string;
  room_label: string | null;
  task_type: HousekeepingTaskType;
  status: HousekeepingTaskStatus;
  reopened_from_task_id: string | null;
  assigned_to_user_id: string | null;
  assigned_to_name: string | null;
  priority: number;
  note: string | null;
  due_at: Date | null;
  estimated_minutes: number | null;
  rule_id: string | null;
  rule_name: string | null;
  started_at: Date | null;
  completed_at: Date | null;
  inspected_at: Date | null;
  inspected_by_name: string | null;
  created_at: Date;
  department_id: string | null;
  guest_stay_id: string | null;
}

export type BoardStaffRow = {
  id: string;
  user_id: string;
  name: string;
  role: HousekeepingAllocationRole;
  section: string;
  floors: number[];
  shift_starts_at: Date;
  shift_ends_at: Date;
}

export type BoardEscalationRow = {
  id: string;
  workspace_id: string;
  property_id: string;
  task_id: string;
  kind: HousekeepingEscalationKind;
  level: HousekeepingEscalationLevel;
  escalated_to_user_id: string | null;
  escalated_to_name: string | null;
  raised_at: Date;
  reminded_at: Date | null;
  reminded_by_name: string | null;
  resolved_at: Date | null;
}

export type BoardRuleRow = {
  id: string;
  code: HousekeepingRuleCode;
  name: string;
  description: string;
  estimated_minutes: number | null;
  active: boolean;
}

export type RoomEventRow = {
  id: string;
  room_id: string;
  kind: RoomEventKind;
  from_value: string | null;
  to_value: string | null;
  summary: string;
  actor_name: string | null;
  detail: string | null;
  occurred_at: Date;
}

/** The housekeeping board's reads (one property at a time) and the rows its commands touch. */
@Injectable()
export class HousekeepingBoardRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  get database(): Database {
    return this.db;
  }

  /** The property a board opens on: the one named, else the head office, else the first in scope. */
  async pickProperty(
    workspaceId: string,
    candidates: readonly string[],
  ): Promise<{ id: string; name: string } | null> {
    if (candidates.length === 0) return null;
    const found = await this.db.execute<{ id: string; name: string }>(sql`
      select id, name from properties
       where workspace_id = ${workspaceId}
         and id in (${sql.join(
           candidates.map((c) => sql`${c}::uuid`),
           sql`, `,
         )})
         and archived_at is null
       order by is_head_office desc, created_at asc
       limit 1
    `);
    return found.rows[0] ?? null;
  }

  async rooms(propertyId: string, today: string): Promise<BoardRoomRow[]> {
    const found = await this.db.execute<BoardRoomRow>(sql`
      select r.id, r.label, r.floor, rt.name as room_type_name, r.status, r.housekeeping_status,
             r.housekeeping_updated_at, r.service_flag,
             st.id as stay_id, coalesce(gu.name, st.guest_name) as stay_guest_name, st.planned_exit_at,
             arr.guest_name as arrival_guest_name, arr.reference as arrival_reference,
             arr.booking_id as arrival_booking_id, to_char(p.check_in_time, 'HH24:MI') as check_in_time,
             blk.id as block_id, blk.status as block_status, blk.starts_at as block_starts_at,
             blk.ends_at as block_ends_at, blk.maintenance_ticket_id as block_ticket_id,
             mt.reference as block_ticket_reference
        from rooms r
        join room_types rt on rt.id = r.room_type_id
        join properties p on p.id = r.property_id
        left join lateral (
          select gs.id, gs.guest_name, gs.guest_user_id, gs.planned_exit_at
            from guest_stays gs
           where gs.room_id = r.id and gs.lifecycle = 'open'
           order by gs.entry_at desc limit 1
        ) st on true
        left join users gu on gu.id = st.guest_user_id
        left join lateral (
          select b.id as booking_id, b.reference, bu.name as guest_name
            from room_assignments ra
            join bookings b on b.id = ra.booking_id
            left join users bu on bu.id = b.guest_user_id
           where ra.room_id = r.id and ra.status = 'assigned'
             and b.status = 'confirmed' and b.check_in = ${today}::date
             and not exists (select 1 from guest_stays g2 where g2.booking_id = b.id)
           order by b.created_at limit 1
        ) arr on true
        left join lateral (
          select rb.* from room_blocks rb
           where rb.room_id = r.id and rb.status in ('requested', 'active')
           limit 1
        ) blk on true
        left join maintenance_tickets mt on mt.id = blk.maintenance_ticket_id
       where r.property_id = ${propertyId}
       order by r.floor nulls last, r.label
    `);
    return found.rows;
  }

  private taskSelect = sql`
      select t.id, t.workspace_id, t.property_id, t.room_id, r.label as room_label, t.task_type, t.status,
             t.reopened_from_task_id, t.assigned_to_user_id, au.name as assigned_to_name, t.priority, t.note,
             t.due_at, t.estimated_minutes, t.rule_id, hr.name as rule_name, t.started_at, t.completed_at,
             t.inspected_at, iu.name as inspected_by_name, t.created_at, t.department_id, t.guest_stay_id
        from housekeeping_tasks t
        join rooms r on r.id = t.room_id
        left join users au on au.id = t.assigned_to_user_id
        left join users iu on iu.id = t.inspected_by_user_id
        left join housekeeping_rules hr on hr.id = t.rule_id
  `;

  /**
   * Today's board: every open task, and the tasks finished, inspected or failed since the start of
   * today in Kigali (a board shows the day's work, not the property's whole history).
   */
  async tasks(propertyId: string, today: string): Promise<BoardTaskRow[]> {
    const found = await this.db.execute<BoardTaskRow>(sql`
      ${this.taskSelect}
       where t.property_id = ${propertyId}
         and (t.status in ('pending', 'in_progress', 'blocked')
              or coalesce(t.inspected_at, t.completed_at, t.updated_at)
                 >= (${today}::date::timestamp at time zone 'Africa/Kigali'))
       order by t.priority desc, t.due_at nulls last, r.label
    `);
    return found.rows;
  }

  async task(db: Db, id: string, lock = false): Promise<BoardTaskRow | null> {
    const found = await db.execute<BoardTaskRow>(sql`
      ${this.taskSelect} where t.id = ${id} ${lock ? sql`for update of t` : sql``}
    `);
    return found.rows[0] ?? null;
  }

  async staff(propertyId: string, today: string): Promise<BoardStaffRow[]> {
    const found = await this.db.execute<BoardStaffRow>(sql`
      select a.id, a.user_id, coalesce(u.name, u.email) as name, a.role, a.section,
             a.floors::int[] as floors, a.shift_starts_at, a.shift_ends_at
        from housekeeping_allocations a
        join users u on u.id = a.user_id
       where a.property_id = ${propertyId} and a.work_date = ${today}::date
       order by a.role desc, a.section, u.name
    `);
    return found.rows;
  }

  private escalationSelect = sql`
      select e.id, e.workspace_id, e.property_id, e.task_id, e.kind, e.level, e.escalated_to_user_id,
             eu.name as escalated_to_name, e.raised_at, e.reminded_at, ru.name as reminded_by_name, e.resolved_at
        from housekeeping_escalations e
        left join users eu on eu.id = e.escalated_to_user_id
        left join users ru on ru.id = e.reminded_by_user_id
  `;

  async openEscalations(propertyId: string): Promise<BoardEscalationRow[]> {
    const found = await this.db.execute<BoardEscalationRow>(sql`
      ${this.escalationSelect}
       where e.property_id = ${propertyId} and e.resolved_at is null
       order by e.raised_at
    `);
    return found.rows;
  }

  async escalation(id: string): Promise<BoardEscalationRow | null> {
    const found = await this.db.execute<BoardEscalationRow>(sql`${this.escalationSelect} where e.id = ${id}`);
    return found.rows[0] ?? null;
  }

  async rules(propertyId: string): Promise<BoardRuleRow[]> {
    const found = await this.db.execute<BoardRuleRow>(sql`
      select id, code, name, description, estimated_minutes, active
        from housekeeping_rules
       where property_id = ${propertyId} and active
       order by sort_order, name
    `);
    return found.rows;
  }

  /** The last ten recorded changes of each room, newest first. */
  async history(propertyId: string): Promise<RoomEventRow[]> {
    const found = await this.db.execute<RoomEventRow>(sql`
      select id, room_id, kind, from_value, to_value, summary, actor_name, detail, occurred_at from (
        select e.id, e.room_id, e.kind, e.from_value, e.to_value, e.summary,
               coalesce(u.name, e.actor_label) as actor_name, e.detail, e.occurred_at,
               row_number() over (partition by e.room_id order by e.occurred_at desc, e.id) as n
          from room_status_events e
          left join users u on u.id = e.actor_user_id
         where e.property_id = ${propertyId}
      ) h
       where n <= 10
       order by room_id, occurred_at desc
    `);
    return found.rows;
  }

  /** Resolve a task's open escalations of one kind (a started task, an inspected room). */
  async resolveEscalations(
    db: Db,
    taskId: string,
    kind: HousekeepingEscalationKind,
    resolution: string,
  ): Promise<void> {
    await db.execute(sql`
      update housekeeping_escalations
         set resolved_at = now(), resolution = ${resolution}, updated_at = now()
       where task_id = ${taskId} and kind = ${kind} and resolved_at is null
    `);
  }
}
