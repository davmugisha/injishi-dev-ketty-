import type {
  AdvanceHousekeepingTaskRequest,
  CreateHousekeepingTaskRequest,
  HousekeepingTaskStatus,
  OperatorHousekeepingTask,
} from '@injishi/contracts';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';

import { assertOwned } from '../../../shared/auth/assert-owned';
import {
  assertInBranchScope,
  type ScopedWorkspace,
} from '../../../shared/auth/branch-scope';
import {
  type HousekeepingTaskRow,
  HousekeepingRepository,
} from '../infrastructure/housekeeping.repository';

/**
 * `pending -> in_progress -> done -> inspected`, and any state to `blocked`
 * (it needs maintenance first), and `blocked` back to `pending`.
 *
 * Written out rather than checked with a comparison, because "the next one" is
 * not the whole rule: `blocked` is reachable from anywhere and returns to the
 * start, and an inspected room is finished.
 */
const ALLOWED: Readonly<Record<HousekeepingTaskStatus, HousekeepingTaskStatus[]>> =
  {
    pending: ['in_progress', 'blocked'],
    in_progress: ['done', 'blocked'],
    done: ['inspected', 'blocked'],
    inspected: [],
    blocked: ['pending'],
  };

/**
 * The cleaning queue (ADR-016 slice 5, §14.4).
 *
 * This closes the last of the five commands ADR-012 left blocked: `task.assign`
 * had nowhere to write, because `housekeeping_tasks` did not exist.
 *
 * The two routes are gated differently and the reason is the shipped role map
 * rather than the name of the permission. A housekeeper holds exactly
 * `housekeeping.set` and `ticket.advance`. So the QUEUE READ carries no
 * permission at all, because a queue a housekeeper cannot open is not a queue,
 * and MARKING A TASK DONE is gated on `housekeeping.set` rather than
 * `task.assign`, because the person doing the cleaning is not the person who
 * assigned it.
 */
@Injectable()
export class HousekeepingService {
  constructor(private readonly tasks: HousekeepingRepository) {}

  async list(ws: ScopedWorkspace): Promise<OperatorHousekeepingTask[]> {
    const rows = await this.tasks.list(ws.workspaceId, ws.branchScope);
    return rows.map((row) => this.present(row));
  }

  async create(
    ws: ScopedWorkspace,
    body: CreateHousekeepingTaskRequest,
    clientKey: string | null,
  ): Promise<OperatorHousekeepingTask> {
    const key = clientKey ? `${ws.workspaceId}:${clientKey}` : null;
    if (key) {
      const replay = await this.tasks.findByIdempotencyKey(key);
      if (replay) {
        assertInBranchScope(ws, replay.propertyId);
        return this.present(replay);
      }
    }

    const room = assertOwned(await this.tasks.findRoom(body.roomId), ws);
    assertInBranchScope(ws, room.propertyId);
    const id = await this.tasks.create({
      roomId: room.id,
      propertyId: room.propertyId,
      workspaceId: ws.workspaceId,
      taskType: body.taskType,
      assignedToUserId: body.assignedToUserId ?? null,
      priority: body.priority ?? 0,
      note: body.note ?? null,
      idempotencyKey: key,
    });
    if (!id) throw this.vanished();

    const created = await this.tasks.find(id);
    if (!created) throw this.vanished();
    return this.present(created);
  }

  /**
   * Move a task along.
   *
   * A repeat of the move that already happened answers with the task as it
   * stands rather than refusing. The phone is offline half the time and a
   * housekeeper who taps twice has not done anything wrong.
   */
  async advance(
    ws: ScopedWorkspace,
    id: string,
    body: AdvanceHousekeepingTaskRequest,
  ): Promise<OperatorHousekeepingTask> {
    const task = assertOwned(await this.tasks.find(id), ws);
    assertInBranchScope(ws, task.propertyId);
    if (task.status === body.to) return this.present(task);

    if (!ALLOWED[task.status].includes(body.to)) {
      throw new ConflictException(
        `A ${task.status.replace('_', ' ')} task cannot go straight to ${body.to.replace('_', ' ')}.`,
      );
    }

    const moved = await this.tasks.advance({
      id: task.id,
      from: task.status,
      to: body.to,
      note: body.note ?? null,
    });

    const now = await this.tasks.find(id);
    if (!now) throw this.vanished();
    // Somebody else moved it between our read and our write. Their move is as
    // valid as ours would have been, so report where it landed.
    if (!moved) return this.present(now);
    return this.present(now);
  }

  private present(row: HousekeepingTaskRow): OperatorHousekeepingTask {
    return {
      id: row.id,
      roomId: row.roomId,
      roomLabel: row.roomLabel,
      taskType: row.taskType,
      status: row.status,
      assignedToUserId: row.assignedToUserId,
      assignedToName: row.assignedToName,
      priority: row.priority,
      note: row.note,
      startedAt: row.startedAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private vanished(): BadRequestException {
    return new BadRequestException(
      'That record changed while we were writing it. Refresh and try again.',
    );
  }
}
