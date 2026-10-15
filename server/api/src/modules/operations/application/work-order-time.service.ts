import type {
  ResolveWorkOrderRequest,
  WorkOrder,
  WorkOrderTimeLog,
  WorkOrderTimeLogList,
  WorkOrderTimerRequest,
} from '@injishi/contracts';
import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import { assertOwned } from '../../../shared/auth/assert-owned';
import { assertInBranchScope, type ScopedWorkspace } from '../../../shared/auth/branch-scope';
import type { Db } from '../infrastructure/room-events';
import { StaffPhoneRepository, type TimeLogRow } from '../infrastructure/staff-phone.repository';
import { type WorkOrderRow, WorkOrdersRepository } from '../infrastructure/work-orders.repository';
import { iso } from './housekeeping-board.service';
import { WorkOrdersService } from './work-orders.service';

const FINISHED = new Set(['resolved', 'closed', 'cancelled']);

/**
 * The technician's side of a work order (real-data leaf 1.3.3): the timer on their own repair, starting
 * the work, and marking it fixed. Each act is the assignee's: an order on somebody else's list, or on
 * nobody's, is taken first through the board's assign route, so who did the work is never guessed.
 *
 * Fixing never releases a room. A technician may ASK for the room to go back on sale; housekeeping
 * inspects it and a manager (`listing.manage`) releases it through `WorkOrdersService.release`.
 */
@Injectable()
export class WorkOrderTimeService {
  constructor(
    private readonly repo: WorkOrdersRepository,
    private readonly phone: StaffPhoneRepository,
    private readonly orders: WorkOrdersService,
  ) {}

  async logs(ws: ScopedWorkspace): Promise<WorkOrderTimeLogList> {
    const rows = await this.phone.timeLogs(ws.workspaceId, ws.branchScope);
    return { logs: rows.map(presentLog) };
  }

  /** Start or stop the caller's own session. Starting an assigned order puts it in progress. */
  async timer(ws: ScopedWorkspace, id: string, body: WorkOrderTimerRequest, userId: string): Promise<WorkOrder> {
    await this.repo.database.transaction(async (tx) => {
      const order = await this.mine(tx, ws, id, userId);
      if (!body.running) {
        await this.phone.stopLogs(tx, order.id, userId);
        return;
      }
      if (FINISHED.has(order.status)) throw new ConflictException('This work order is finished; reopen it before timing more work.');
      if (await this.phone.runningLog(tx, order.id, userId)) return;
      await this.startWork(tx, order, userId);
      const earlier = await tx.execute<{ n: number }>(sql`
        select count(*)::int as n from maintenance_time_logs where ticket_id = ${order.id}
      `);
      await this.phone.startLog(tx, {
        workspaceId: order.workspace_id,
        ticketId: order.id,
        userId,
        kind: Number(earlier.rows[0]?.n ?? 0) === 0 ? 'diagnosis' : 'repair',
      });
    });
    return this.orders.get(ws, id);
  }

  /** Begin the work without the timer: the order moves to in progress, once. */
  async start(ws: ScopedWorkspace, id: string, userId: string): Promise<WorkOrder> {
    await this.repo.database.transaction(async (tx) => {
      const order = await this.mine(tx, ws, id, userId);
      if (FINISHED.has(order.status)) throw new ConflictException('This work order is finished.');
      await this.startWork(tx, order, userId);
    });
    return this.orders.get(ws, id);
  }

  /** Mark the fault fixed: every running session stops and the fix is written on the order. */
  async resolve(ws: ScopedWorkspace, id: string, body: ResolveWorkOrderRequest, userId: string): Promise<WorkOrder> {
    await this.repo.database.transaction(async (tx) => {
      const order = await this.mine(tx, ws, id, userId);
      if (FINISHED.has(order.status)) throw new ConflictException('This work order is already fixed.');
      await this.phone.stopLogs(tx, order.id, null);
      await tx.execute(sql`
        update maintenance_tickets set status = 'resolved', resolved_at = now(), updated_at = now()
         where id = ${order.id}
      `);
      await this.repo.addEvent(tx, { ticketId: order.id, kind: 'fixed', note: body.fix, actorUserId: userId });
      if (body.askRelease && order.room_id) {
        const block = await this.repo.openBlockForTicket(tx, order.id);
        if (block && block.status === 'active') {
          await this.repo.addEvent(tx, {
            ticketId: order.id,
            kind: 'next_step',
            note: 'Asks for the room to go back on sale once housekeeping has inspected it.',
            actorUserId: userId,
          });
        }
      }
    });
    return this.orders.get(ws, id);
  }

  // --- helpers -----------------------------------------------------------------------------------

  /** The order, locked, in this workspace and the caller's branches, and on the caller's own list. */
  private async mine(tx: Db, ws: ScopedWorkspace, id: string, userId: string): Promise<WorkOrderRow> {
    const row = await this.repo.find(tx, id, true);
    const order = assertOwned(row ? { ...row, workspaceId: row.workspace_id } : null, ws);
    assertInBranchScope(ws, order.property_id);
    if (order.assigned_to_user_id !== userId) {
      throw new ForbiddenException('This work order is not on your list. Take it first.');
    }
    return order;
  }

  private async startWork(tx: Db, order: WorkOrderRow, userId: string): Promise<void> {
    if (order.status !== 'open' && order.status !== 'assigned') return;
    await tx.execute(sql`
      update maintenance_tickets set status = 'in_progress', updated_at = now() where id = ${order.id}
    `);
    await this.repo.addEvent(tx, { ticketId: order.id, kind: 'started', note: null, actorUserId: userId });
  }
}

function presentLog(l: TimeLogRow): WorkOrderTimeLog {
  return {
    id: l.id,
    ticketId: l.ticket_id,
    userId: l.user_id,
    userName: l.user_name,
    kind: l.kind,
    startedAt: iso(l.started_at) as string,
    endedAt: iso(l.ended_at),
  };
}
