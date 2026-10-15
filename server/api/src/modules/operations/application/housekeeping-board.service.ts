import type {
  AssignHousekeepingTaskRequest,
  HousekeepingBoard,
  HousekeepingBoardEscalation,
  HousekeepingBoardTask,
  InspectHousekeepingTaskRequest,
} from '@injishi/contracts';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';

import { assertOwned } from '../../../shared/auth/assert-owned';
import { assertInBranchScope, type ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { writeOutboxTx } from '../../../shared/outbox/outbox';
import {
  type BoardTaskRow,
  HousekeepingBoardRepository,
} from '../infrastructure/housekeeping-board.repository';
import { kigaliDay, memberHoldsAt, recordRoomEvent, setRoomReadinessTx } from '../infrastructure/room-events';

/** A Date or an ISO string from the driver, as an ISO string. */
export function iso(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

const TASK_LABEL: Record<string, string> = {
  checkout_clean: 'Checkout',
  stayover_clean: 'Stayover',
  deep_clean: 'Deep clean',
  inspection: 'Inspection',
  turndown: 'Turndown',
};

/**
 * The housekeeping board (real-data 1.2.3): one property's rooms, today's tasks, who works today,
 * the open escalations, the rules and the rooms' history, and the supervisor's three commands:
 * assign, inspect (pass or fail) and remind.
 *
 * Every command writes the room's history in the SAME transaction as the change it records, and a
 * `housekeeping.task` outbox row, so the staff phones re-read (ADR-050 D-v: ids only, a hint).
 */
@Injectable()
export class HousekeepingBoardService {
  constructor(private readonly board: HousekeepingBoardRepository) {}

  async read(ws: ScopedWorkspace, requestedPropertyId?: string): Promise<HousekeepingBoard> {
    const property = await this.property(ws, requestedPropertyId);
    const today = kigaliDay();
    const [rooms, tasks, staff, escalations, rules, history] = await Promise.all([
      this.board.rooms(property.id, today),
      this.board.tasks(property.id, today),
      this.board.staff(property.id, today),
      this.board.openEscalations(property.id),
      this.board.rules(property.id),
      this.board.history(property.id),
    ]);
    return {
      propertyId: property.id,
      propertyName: property.name,
      rooms: rooms.map((r) => ({
        id: r.id,
        label: r.label,
        floor: r.floor === null ? null : Number(r.floor),
        roomTypeName: r.room_type_name,
        status: r.status,
        housekeeping: r.housekeeping_status,
        housekeepingUpdatedAt: iso(r.housekeeping_updated_at),
        serviceFlag: r.service_flag,
        occupiedBy: r.stay_id
          ? { stayId: r.stay_id, guestName: r.stay_guest_name, plannedExitAt: iso(r.planned_exit_at) }
          : null,
        arrival: r.arrival_booking_id
          ? { guestName: r.arrival_guest_name, bookingReference: r.arrival_reference, checkInTime: r.check_in_time }
          : null,
        block:
          r.block_id && r.block_status && r.block_starts_at
            ? {
                id: r.block_id,
                status: r.block_status,
                workOrderId: r.block_ticket_id,
                workOrderReference: r.block_ticket_reference,
                startsAt: iso(r.block_starts_at) as string,
                endsAt: iso(r.block_ends_at),
              }
            : null,
      })),
      tasks: tasks.map((t) => this.presentTask(t)),
      staff: staff.map((s) => ({
        id: s.id,
        userId: s.user_id,
        name: s.name,
        role: s.role,
        section: s.section,
        floors: (s.floors ?? []).map(Number),
        shiftStartsAt: iso(s.shift_starts_at) as string,
        shiftEndsAt: iso(s.shift_ends_at) as string,
      })),
      escalations: escalations.map(
        (e): HousekeepingBoardEscalation => ({
          id: e.id,
          taskId: e.task_id,
          kind: e.kind,
          level: e.level,
          escalatedToUserId: e.escalated_to_user_id,
          escalatedToName: e.escalated_to_name,
          raisedAt: iso(e.raised_at) as string,
          remindedAt: iso(e.reminded_at),
          remindedByName: e.reminded_by_name,
        }),
      ),
      rules: rules.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        taskType: RULE_TASK_TYPE[r.code],
        description: r.description,
        estimatedMinutes: r.estimated_minutes === null ? null : Number(r.estimated_minutes),
        active: r.active,
      })),
      history: history.map((h) => ({
        id: h.id,
        roomId: h.room_id,
        kind: h.kind,
        fromValue: h.from_value,
        toValue: h.to_value,
        summary: h.summary,
        actorName: h.actor_name,
        detail: h.detail,
        occurredAt: iso(h.occurred_at) as string,
      })),
    };
  }

  /**
   * Give a task to someone (or take it off them). The assignee must be able to do it: an active
   * member covering the property whose role holds `housekeeping.set`. A not-started escalation on the
   * task is resolved by the reassignment, which is what it asked for.
   */
  async assign(
    ws: ScopedWorkspace,
    taskId: string,
    body: AssignHousekeepingTaskRequest,
    actorUserId: string,
  ): Promise<HousekeepingBoardTask> {
    const db = this.board.database;
    const updated = await db.transaction(async (tx) => {
      const task = assertOwned(await this.ownedTask(tx, taskId), ws);
      assertInBranchScope(ws, task.property_id);
      if (!['pending', 'in_progress', 'blocked'].includes(task.status)) {
        throw new ConflictException('A finished task cannot be given to someone else.');
      }
      if (task.assigned_to_user_id === body.assignedToUserId) return task;
      let assigneeName: string | null = null;
      if (body.assignedToUserId) {
        const holder = ws.orgId
          ? await memberHoldsAt(tx, {
              orgId: ws.orgId,
              userId: body.assignedToUserId,
              propertyId: task.property_id,
              permission: 'housekeeping.set',
            })
          : null;
        if (!holder) {
          throw new UnprocessableEntityException(
            'That person cannot take housekeeping work here: they are not on this property’s staff with room status rights.',
          );
        }
        assigneeName = holder.name;
      }
      await tx.execute(sql`
        update housekeeping_tasks
           set assigned_to_user_id = ${body.assignedToUserId}, updated_at = now()
         where id = ${task.id}
      `);
      if (task.status === 'pending' || task.status === 'blocked') {
        await this.board.resolveEscalations(tx, task.id, 'not_started', 'reassigned');
      }
      await recordRoomEvent(tx, {
        workspaceId: task.workspace_id,
        propertyId: task.property_id,
        roomId: task.room_id,
        kind: 'task_assigned',
        toValue: body.assignedToUserId,
        summary: assigneeName
          ? `${TASK_LABEL[task.task_type] ?? 'Cleaning'} task assigned to ${assigneeName}`
          : `${TASK_LABEL[task.task_type] ?? 'Cleaning'} task left unassigned`,
        actorUserId,
        housekeepingTaskId: task.id,
      });
      await writeOutboxTx(tx, {
        eventType: 'housekeeping.task',
        aggregateType: 'housekeeping_task',
        aggregateId: task.id,
        change: `assigned:${body.assignedToUserId ?? 'none'}:${Date.now()}`,
        workspaceId: task.workspace_id,
        payload: { propertyId: task.property_id, roomId: task.room_id, userId: body.assignedToUserId, status: task.status },
      });
      return this.board.task(tx, task.id);
    });
    if (!updated) throw new NotFoundException();
    return this.presentTask(updated);
  }

  /**
   * Pass or fail a cleaned room.
   *
   * Only a clean that is DONE can be inspected, and never by the person who cleaned it: a room's
   * readiness is somebody else's word (the board's Inspection Gate). Passing makes the room
   * `inspected`, the one state the desk may assign to an arrival. Failing closes the task as
   * `failed` with the reason and puts the room straight back on the board as a re-clean for the same
   * person, due in thirty minutes; the room goes back to `dirty`.
   */
  async inspect(
    ws: ScopedWorkspace,
    taskId: string,
    body: InspectHousekeepingTaskRequest,
    actorUserId: string,
  ): Promise<HousekeepingBoardTask> {
    const db = this.board.database;
    const resultId = await db.transaction(async (tx) => {
      const task = assertOwned(await this.ownedTask(tx, taskId), ws);
      assertInBranchScope(ws, task.property_id);
      if (task.status !== 'done') {
        throw new ConflictException(
          task.status === 'inspected' || task.status === 'failed'
            ? 'This room has already been inspected.'
            : 'Only a finished clean can be inspected.',
        );
      }
      if (task.assigned_to_user_id && task.assigned_to_user_id === actorUserId) {
        throw new ForbiddenException('You cleaned this room, so someone else has to inspect it.');
      }
      if (body.result === 'pass') {
        await tx.execute(sql`
          update housekeeping_tasks
             set status = 'inspected', inspected_at = now(), inspected_by_user_id = ${actorUserId}, updated_at = now()
           where id = ${task.id} and status = 'done'
        `);
        await setRoomReadinessTx(tx, {
          roomId: task.room_id,
          to: 'inspected',
          actorUserId,
          housekeepingTaskId: task.id,
        });
        await this.board.resolveEscalations(tx, task.id, 'awaiting_inspection', 'inspected');
        await this.outbox(tx, task, 'inspected');
        return task.id;
      }
      const reason = body.reason as string;
      await tx.execute(sql`
        update housekeeping_tasks
           set status = 'failed', inspected_at = now(), inspected_by_user_id = ${actorUserId},
               inspection_note = ${reason}, updated_at = now()
         where id = ${task.id} and status = 'done'
      `);
      const created = await tx.execute<{ id: string }>(sql`
        insert into housekeeping_tasks
          (room_id, property_id, department_id, workspace_id, task_type, status, assigned_to_user_id,
           priority, note, due_at, estimated_minutes, reopened_from_task_id)
        values (${task.room_id}, ${task.property_id}, ${task.department_id}, ${task.workspace_id},
                ${task.task_type}, 'pending', ${task.assigned_to_user_id}, 60, ${reason},
                now() + interval '30 minutes', 25, ${task.id})
        returning id
      `);
      await setRoomReadinessTx(tx, {
        roomId: task.room_id,
        to: 'dirty',
        actorUserId,
        kind: 'inspection_failed',
        detail: `failed inspection: ${reason}`,
        housekeepingTaskId: task.id,
      });
      await this.board.resolveEscalations(tx, task.id, 'awaiting_inspection', 'failed');
      await this.outbox(tx, task, 'failed');
      return created.rows[0]?.id ?? task.id;
    });
    const row = await this.board.task(db, resultId);
    if (!row) throw new NotFoundException();
    return this.presentTask(row);
  }

  /**
   * Remind whoever an escalation went to (the supervisor who has a room waiting for inspection).
   * Recorded on the escalation, so the board shows it was done and when; the reminder itself reaches
   * the supervisor's phone through the `housekeeping.task` outbox row.
   */
  async remind(ws: ScopedWorkspace, escalationId: string, actorUserId: string): Promise<HousekeepingBoardEscalation> {
    const found = assertOwned(
      await this.board.escalation(escalationId).then((e) => (e ? { ...e, workspaceId: e.workspace_id } : null)),
      ws,
    );
    assertInBranchScope(ws, found.property_id);
    if (found.resolved_at) throw new ConflictException('This escalation is already resolved.');
    const db = this.board.database;
    await db.transaction(async (tx) => {
      await tx.execute(sql`
        update housekeeping_escalations
           set reminded_at = now(), reminded_by_user_id = ${actorUserId}, updated_at = now()
         where id = ${found.id}
      `);
      const task = await this.board.task(tx, found.task_id);
      if (task) {
        // The person to remind: the supervisor on today's sheet, else whoever it was escalated to.
        const supervisor = await tx.execute<{ user_id: string }>(sql`
          select user_id from housekeeping_allocations
           where property_id = ${task.property_id} and work_date = ${kigaliDay()}::date and role = 'supervisor'
           limit 1
        `);
        await writeOutboxTx(tx, {
          eventType: 'housekeeping.task',
          aggregateType: 'housekeeping_task',
          aggregateId: task.id,
          change: `reminded:${Date.now()}`,
          workspaceId: task.workspace_id,
          payload: {
            propertyId: task.property_id,
            roomId: task.room_id,
            userId: supervisor.rows[0]?.user_id ?? found.escalated_to_user_id,
            status: task.status,
          },
        });
      }
    });
    const after = await this.board.escalation(escalationId);
    if (!after) throw new NotFoundException();
    return {
      id: after.id,
      taskId: after.task_id,
      kind: after.kind,
      level: after.level,
      escalatedToUserId: after.escalated_to_user_id,
      escalatedToName: after.escalated_to_name,
      raisedAt: iso(after.raised_at) as string,
      remindedAt: iso(after.reminded_at),
      remindedByName: after.reminded_by_name,
    };
  }

  private async property(ws: ScopedWorkspace, requested?: string): Promise<{ id: string; name: string }> {
    const scope = ws.branchScope;
    const candidates = requested
      ? scope.propertyIds.filter((p) => p.toLowerCase() === requested.toLowerCase())
      : scope.selectedPropertyId
        ? [scope.selectedPropertyId]
        : [...scope.propertyIds];
    const found = await this.board.pickProperty(ws.workspaceId, candidates);
    if (!found) throw new NotFoundException('That property is not available to you.');
    return found;
  }

  private async ownedTask(
    tx: Parameters<HousekeepingBoardRepository['task']>[0],
    id: string,
  ): Promise<(BoardTaskRow & { workspaceId: string }) | null> {
    const row = await this.board.task(tx, id, true);
    return row ? { ...row, workspaceId: row.workspace_id } : null;
  }

  private async outbox(
    tx: Parameters<HousekeepingBoardRepository['task']>[0],
    task: BoardTaskRow,
    status: string,
  ): Promise<void> {
    await writeOutboxTx(tx, {
      eventType: 'housekeeping.task',
      aggregateType: 'housekeeping_task',
      aggregateId: task.id,
      change: status,
      workspaceId: task.workspace_id,
      payload: { propertyId: task.property_id, roomId: task.room_id, userId: task.assigned_to_user_id, status },
    });
  }

  presentTask(t: BoardTaskRow): HousekeepingBoardTask {
    return {
      id: t.id,
      roomId: t.room_id,
      roomLabel: t.room_label,
      taskType: t.task_type,
      status: t.status,
      reopenedFromTaskId: t.reopened_from_task_id,
      assignedToUserId: t.assigned_to_user_id,
      assignedToName: t.assigned_to_name,
      priority: Number(t.priority),
      note: t.note,
      dueAt: iso(t.due_at),
      estimatedMinutes: t.estimated_minutes === null ? null : Number(t.estimated_minutes),
      ruleId: t.rule_id,
      ruleName: t.rule_name,
      startedAt: iso(t.started_at),
      completedAt: iso(t.completed_at),
      inspectedAt: iso(t.inspected_at),
      inspectedByName: t.inspected_by_name,
      createdAt: iso(t.created_at) as string,
    };
  }
}

/** A rule's code decides the task it creates. */
export const RULE_TASK_TYPE = {
  checkout: 'checkout_clean',
  stayover: 'stayover_clean',
  inspection: 'inspection',
  turndown: 'turndown',
  deep_clean: 'deep_clean',
} as const;
