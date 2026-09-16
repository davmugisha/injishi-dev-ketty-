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
  await tx
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
    })
    .onConflictDoNothing();
}

/** The only place that touches Drizzle for the cleaning queue. */
@Injectable()
export class HousekeepingRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

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
  }): Promise<boolean> {
    const patch: Record<string, unknown> = {
      status: input.to,
      updatedAt: new Date(),
    };
    if (input.to === 'in_progress') patch.startedAt = new Date();
    if (input.to === 'done' || input.to === 'inspected') {
      patch.completedAt = new Date();
    }
    if (input.note) patch.note = input.note;

    const rows = await this.db
      .update(housekeepingTasks)
      .set(patch)
      .where(
        and(
          eq(housekeepingTasks.id, input.id),
          eq(housekeepingTasks.status, input.from),
        ),
      )
      .returning({ id: housekeepingTasks.id });
    return rows.length > 0;
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
