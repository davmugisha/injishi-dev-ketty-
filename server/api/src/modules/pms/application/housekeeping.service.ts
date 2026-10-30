import type {
  AdvanceHousekeepingTaskRequest,
  CreateHousekeepingTaskRequest,
  HousekeepingTaskStatus,
  OperatorHousekeepingTask,
} from '@injishi/contracts';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnprocessableEntityException,
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
import { memberHoldsAt } from '../infrastructure/room-events';

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
    // Reached only by failing an inspection (the board's inspect command), never by a move.
    failed: [],
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
    // A task given to someone who cannot mark it done sits on the board forever, and an id from
    // another business must not land on that person's phone (real-data 1.2.3).
    if (body.assignedToUserId) {
      const holder = ws.orgId
        ? await memberHoldsAt(this.tasks.database, {
            orgId: ws.orgId,
            userId: body.assignedToUserId,
            propertyId: room.propertyId,
            permission: 'housekeeping.set',
          })
        : null;
      if (!holder) {
        throw new UnprocessableEntityException(
          'That person cannot take housekeeping work here: they are not on this property’s staff with room status rights.',
        );
      }
    }
    const id = await this.tasks.create({
      roomId: room.id,
      propertyId: room.propertyId,
      workspaceId: ws.workspaceId,
      taskType: body.taskType,
      assignedToUserId: body.assignedToUserId ?? null,
      priority: body.priority ?? 0,
      note: body.note ?? null,
      idempotencyKey: key,
      dueAt: body.dueAt ? new Date(body.dueAt) : null,
      estimatedMinutes: body.estimatedMinutes ?? null,
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
    actorUserId: string,
  ): Promise<OperatorHousekeepingTask> {
    const task = assertOwned(await this.tasks.find(id), ws);
    assertInBranchScope(ws, task.propertyId);
    if (task.status === body.to) return this.present(task);

    if (!ALLOWED[task.status].includes(body.to)) {
      throw new ConflictException(
        `A ${task.status.replace('_', ' ')} task cannot go straight to ${body.to.replace('_', ' ')}.`,
      );
    }
    // The Inspection Gate: a room's readiness is somebody else's word than the cleaner's.
    if (body.to === 'inspected' && task.assignedToUserId === actorUserId) {
      throw new ForbiddenException('You cleaned this room, so someone else has to inspect it.');
    }

    const moved = await this.tasks.advance({
      id: task.id,
      from: task.status,
      to: body.to,
      note: body.note ?? null,
      actorUserId,
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
