import type {
  HousekeepingTaskStatus,
  HousekeepingTaskType,
} from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, sql, type SQL } from 'drizzle-orm';

import {
  departments,
  housekeepingTasks,
  rooms,
  users,
} from '../../../database/drizzle/schema';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';
import {
  inBranchScope,
  type BranchScope,
} from '../../../shared/auth/branch-scope';
import { writeOutboxTx } from '../../../shared/outbox/outbox';
import { PROPERTY_ZONE, recordRoomEvent, setRoomReadinessTx } from './room-events';

export interface HousekeepingTaskRow {
  id: string;
  workspaceId: string;
  /** The branch the task is on (ADR-054). */
  propertyId: string;
  roomId: string;
  roomLabel: string | null;
  taskType: HousekeepingTaskType;
  status: HousekeepingTaskStatus;
  assignedToUserId: string | null;
  assignedToName: string | null;
  priority: number;
  note: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

/** The transaction handle Drizzle hands a `db.transaction` callback. */
type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

/**
 * Enqueue the clean a checkout owes, inside the checkout's own transaction
 * (§14.4).
 *
 * Exported as a plain function rather than a repository method because
 * `FrontDeskRepository` calls it from inside its checkout transaction, and two
 * separate calls mean a dropped connection between them loses the second.
 * Housekeeping then walks past a room that needs them, which is the exact
 * failure the "same transaction" rule exists to prevent.
 *
 * `onConflictDoNothing` rides the partial unique index on the stay, so a double
 * clicked checkout puts the room on the board once.
 */
export async function enqueueCheckoutClean(
  tx: Tx,
  input: {
    roomId: string;
    propertyId: string;
    workspaceId: string;
    guestStayId: string;
  },
): Promise<void> {
  const [queued] = await tx
    .insert(housekeepingTasks)
    .values({
      roomId: input.roomId,
      propertyId: input.propertyId,
      workspaceId: input.workspaceId,
      guestStayId: input.guestStayId,
      taskType: 'checkout_clean',
      // A departure room is the one a housekeeper should take next: it is the
      // one that blocks an arrival.
      priority: 10,
      departmentId: sql`(
        SELECT d."id" FROM "departments" d
        WHERE d."property_id" = ${input.propertyId}
          AND d."department_category" = 'rooms'
        LIMIT 1
      )`,
      // The property's checkout rule, and its usual duration (real-data 1.2.3).
      ruleId: sql`(
        SELECT hr."id" FROM "housekeeping_rules" hr
        WHERE hr."property_id" = ${input.propertyId} AND hr."code" = 'checkout' AND hr."active"
        LIMIT 1
      )`,
      estimatedMinutes: sql`(
        SELECT hr."estimated_minutes" FROM "housekeeping_rules" hr
        WHERE hr."property_id" = ${input.propertyId} AND hr."code" = 'checkout' AND hr."active"
        LIMIT 1
      )`,
      // Whoever covers the room's floor on today's allocation sheet takes it.
      assignedToUserId: sql`(
        SELECT a."user_id" FROM "housekeeping_allocations" a
          JOIN "rooms" r ON r."id" = ${input.roomId}
        WHERE a."property_id" = ${input.propertyId}
          AND a."work_date" = (now() AT TIME ZONE ${PROPERTY_ZONE})::date
          AND a."role" = 'attendant' AND r."floor" = ANY(a."floors")
        ORDER BY a."created_at" LIMIT 1
      )`,
    })
    .onConflictDoNothing()
    .returning({ id: housekeepingTasks.id, assignedToUserId: housekeepingTasks.assignedToUserId });

  // The room's history, in the checkout's own transaction: why it is dirty, and who has it.
  await recordRoomEvent(tx, {
    workspaceId: input.workspaceId,
    propertyId: input.propertyId,
    roomId: input.roomId,
    kind: 'occupancy',
    fromValue: 'occupied',
    toValue: 'dirty',
    summary: 'Occupied → Dirty',
    actorLabel: 'Front desk',
    detail: 'checked the guest out',
    housekeepingTaskId: queued?.id ?? null,
  });
  // A departing guest's sign comes off the door with them.
  await tx.execute(sql`
    UPDATE "rooms" SET "service_flag" = NULL, "service_flag_set_at" = NULL
    WHERE "id" = ${input.roomId} AND "service_flag" IS NOT NULL
  `);
  if (queued?.assignedToUserId) {
    const section = await tx.execute<{ section: string; name: string | null }>(sql`
      SELECT a."section", u."name" FROM "housekeeping_allocations" a
        JOIN "users" u ON u."id" = a."user_id"
      WHERE a."property_id" = ${input.propertyId} AND a."user_id" = ${queued.assignedToUserId}
        AND a."work_date" = (now() AT TIME ZONE ${PROPERTY_ZONE})::date
      LIMIT 1
    `);
    const row = section.rows[0];
    await recordRoomEvent(tx, {
      workspaceId: input.workspaceId,
      propertyId: input.propertyId,
      roomId: input.roomId,
      kind: 'task_assigned',
      toValue: queued.assignedToUserId,
      summary: `Checkout task assigned to ${row?.name ?? 'the floor attendant'}`,
      actorLabel: row ? `Rule “${row.section}”` : 'System',
      housekeepingTaskId: queued.id,
    });
  }
}

/** The only place that touches Drizzle for the cleaning queue. */
@Injectable()
export class HousekeepingRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  get database(): Database {
    return this.db;
  }

  async list(workspaceId: string, scope: BranchScope): Promise<HousekeepingTaskRow[]> {
    return this.select(
      and(
        eq(housekeepingTasks.workspaceId, workspaceId),
        inBranchScope(housekeepingTasks.propertyId, scope),
      ) as SQL,
    );
  }

  async find(id: string): Promise<HousekeepingTaskRow | null> {
    const [row] = await this.select(eq(housekeepingTasks.id, id));
    return row ?? null;
  }

  async findByIdempotencyKey(key: string): Promise<HousekeepingTaskRow | null> {
    const [row] = await this.select(eq(housekeepingTasks.idempotencyKey, key));
    return row ?? null;
  }

  async findRoom(roomId: string): Promise<{
    id: string;
    workspaceId: string;
    propertyId: string;
    label: string | null;
  } | null> {
    const [row] = await this.db
      .select({
        id: rooms.id,
        workspaceId: rooms.workspaceId,
        propertyId: rooms.propertyId,
        label: rooms.label,
      })
      .from(rooms)
      .where(eq(rooms.id, roomId))
      .limit(1);
    return row ?? null;
  }

  async create(input: {
    roomId: string;
    propertyId: string;
    workspaceId: string;
    taskType: HousekeepingTaskType;
    assignedToUserId: string | null;
    priority: number;
    note: string | null;
    idempotencyKey: string | null;
    dueAt?: Date | null;
    estimatedMinutes?: number | null;
  }): Promise<string | null> {
    const [row] = await this.db
      .insert(housekeepingTasks)
      .values({
        roomId: input.roomId,
        propertyId: input.propertyId,
        workspaceId: input.workspaceId,
        taskType: input.taskType,
        assignedToUserId: input.assignedToUserId,
        priority: input.priority,
        note: input.note,
        idempotencyKey: input.idempotencyKey,
        dueAt: input.dueAt ?? null,
        estimatedMinutes: input.estimatedMinutes ?? null,
        departmentId: sql`(
          SELECT d."id" FROM "departments" d
          WHERE d."property_id" = ${input.propertyId}
            AND d."department_category" = 'rooms'
          LIMIT 1
        )`,
      })
      .returning({ id: housekeepingTasks.id });
    return row?.id ?? null;
  }

  /**
   * Move a task, guarded on the state it was read in.
   *
   * The guard is what makes two housekeepers tapping the same task safe: the
   * second update matches nothing and the service reports where the task
   * actually landed rather than overwriting the first one's answer.
   */
  async advance(input: {
    id: string;
    from: HousekeepingTaskStatus;
    to: HousekeepingTaskStatus;
    note: string | null;
    actorUserId: string | null;
  }): Promise<boolean> {
    const patch: Record<string, unknown> = {
      status: input.to,
      updatedAt: new Date(),
    };
    if (input.to === 'in_progress') patch.startedAt = new Date();
    // `completed_at` is when the CLEAN finished; an inspection stamps its own time and person and
    // leaves it alone (it used to overwrite it, which lost when the room was actually cleaned).
    if (input.to === 'done') patch.completedAt = new Date();
    if (input.to === 'inspected') {
      patch.inspectedAt = new Date();
      patch.inspectedByUserId = input.actorUserId;
    }
    if (input.note) patch.note = input.note;

    return this.db.transaction(async (tx) => {
      const rows = await tx
        .update(housekeepingTasks)
        .set(patch)
        .where(
          and(
            eq(housekeepingTasks.id, input.id),
            eq(housekeepingTasks.status, input.from),
          ),
        )
        .returning({
          id: housekeepingTasks.id,
          roomId: housekeepingTasks.roomId,
          propertyId: housekeepingTasks.propertyId,
          workspaceId: housekeepingTasks.workspaceId,
          taskType: housekeepingTasks.taskType,
          assignedToUserId: housekeepingTasks.assignedToUserId,
        });
      const moved = rows[0];
      if (!moved) return false;

      // The room follows its task, in the same transaction (real-data 1.2.3): a finished clean makes
      // it Clean (waiting for inspection), a passed inspection makes it Inspected, and the history
      // says who and when. Escalations the move answers are resolved.
      if (input.to === 'in_progress') {
        await tx.execute(sql`
          UPDATE "housekeeping_escalations" SET "resolved_at" = now(), "resolution" = 'started', "updated_at" = now()
          WHERE "task_id" = ${moved.id} AND "kind" = 'not_started' AND "resolved_at" IS NULL
        `);
      }
      if (input.to === 'done') {
        if (moved.taskType === 'checkout_clean' || moved.taskType === 'deep_clean') {
          await setRoomReadinessTx(tx, {
            roomId: moved.roomId,
            to: 'clean',
            actorUserId: input.actorUserId,
            housekeepingTaskId: moved.id,
          });
        } else if (moved.taskType === 'inspection') {
          await setRoomReadinessTx(tx, {
            roomId: moved.roomId,
            to: 'inspected',
            actorUserId: input.actorUserId,
            housekeepingTaskId: moved.id,
          });
        } else {
          await recordRoomEvent(tx, {
            workspaceId: moved.workspaceId,
            propertyId: moved.propertyId,
            roomId: moved.roomId,
            kind: 'housekeeping',
            summary: moved.taskType === 'turndown' ? 'Turndown done' : 'Stayover service done',
            actorUserId: input.actorUserId,
            housekeepingTaskId: moved.id,
          });
        }
      }
      if (input.to === 'inspected') {
        await setRoomReadinessTx(tx, {
          roomId: moved.roomId,
          to: 'inspected',
          actorUserId: input.actorUserId,
          housekeepingTaskId: moved.id,
        });
        await tx.execute(sql`
          UPDATE "housekeeping_escalations" SET "resolved_at" = now(), "resolution" = 'inspected', "updated_at" = now()
          WHERE "task_id" = ${moved.id} AND "kind" = 'awaiting_inspection' AND "resolved_at" IS NULL
        `);
      }
      await writeOutboxTx(tx, {
        eventType: 'housekeeping.task',
        aggregateType: 'housekeeping_task',
        aggregateId: moved.id,
        change: input.to,
        workspaceId: moved.workspaceId,
        payload: {
          propertyId: moved.propertyId,
          roomId: moved.roomId,
          userId: moved.assignedToUserId,
          status: input.to,
        },
      });
      return true;
    });
  }

  private select(where: SQL): Promise<HousekeepingTaskRow[]> {
    return this.db
      .select({
        id: housekeepingTasks.id,
        workspaceId: housekeepingTasks.workspaceId,
        propertyId: housekeepingTasks.propertyId,
        roomId: housekeepingTasks.roomId,
        roomLabel: rooms.label,
        taskType: housekeepingTasks.taskType,
        status: housekeepingTasks.status,
        assignedToUserId: housekeepingTasks.assignedToUserId,
        assignedToName: users.name,
        priority: housekeepingTasks.priority,
        note: housekeepingTasks.note,
        startedAt: housekeepingTasks.startedAt,
        completedAt: housekeepingTasks.completedAt,
        createdAt: housekeepingTasks.createdAt,
      })
      .from(housekeepingTasks)
      .innerJoin(rooms, eq(rooms.id, housekeepingTasks.roomId))
      .leftJoin(users, eq(users.id, housekeepingTasks.assignedToUserId))
      .leftJoin(departments, eq(departments.id, housekeepingTasks.departmentId))
      .where(where)
      .orderBy(
        asc(housekeepingTasks.status),
        desc(housekeepingTasks.priority),
        asc(housekeepingTasks.createdAt),
      );
  }
}
