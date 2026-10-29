import {
  TABLE_STATUS_MOVES,
  type MergeSessionsRequest,
  type MoveSessionRequest,
  type OpenTableSessionRequest,
  type PosFloor,
  type SetTableStatusRequest,
} from '@injishi/contracts';
import { ConflictException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { and, eq, inArray, isNull, ne, notInArray } from 'drizzle-orm';

import {
  orgMemberships,
  posOrders,
  restaurantTables,
  tableSessions,
  workspaces,
} from '../../../database/drizzle/schema';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { audit, orderEvent, outletInScope, settlementFor, type Tx } from '../infrastructure/pos-support';
import { PosReadService } from './pos-read.service';

/**
 * The floor (POS spec §5, tables and service): seating a party, the table's
 * own status, moving a party to another table and merging two parties.
 *
 * A table is never the order. Seating opens a SESSION; orders are taken on
 * the session; closing the session releases the table to `cleaning`.
 */
@Injectable()
export class PosFloorService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly read: PosReadService,
  ) {}

  private async table(tx: Tx, ws: ScopedWorkspace, tableId: string): Promise<typeof restaurantTables.$inferSelect> {
    const [row] = await tx
      .select()
      .from(restaurantTables)
      .where(and(eq(restaurantTables.id, tableId), eq(restaurantTables.workspaceId, ws.workspaceId), isNull(restaurantTables.archivedAt)))
      .limit(1)
      .for('update');
    if (!row) throw new NotFoundException('That table is not available to you.');
    await outletInScope(tx, ws, row.outletId);
    return row;
  }

  private async openSession(tx: Tx, ws: ScopedWorkspace, sessionId: string): Promise<typeof tableSessions.$inferSelect> {
    const [row] = await tx
      .select()
      .from(tableSessions)
      .where(and(eq(tableSessions.id, sessionId), eq(tableSessions.workspaceId, ws.workspaceId)))
      .limit(1)
      .for('update');
    if (!row) throw new NotFoundException('That table session is not available to you.');
    await outletInScope(tx, ws, row.outletId);
    if (row.status !== 'open') throw new ConflictException('That table has already been released.');
    return row;
  }

  /** A waiter named for a session must be an active member of this business. */
  private async assertMember(tx: Tx, ws: ScopedWorkspace, userId: string): Promise<void> {
    const [row] = await tx
      .select({ userId: orgMemberships.userId })
      .from(orgMemberships)
      .innerJoin(workspaces, eq(workspaces.orgId, orgMemberships.orgId))
      .where(
        and(
          eq(workspaces.id, ws.workspaceId),
          eq(orgMemberships.userId, userId),
          eq(orgMemberships.status, 'active'),
        ),
      )
      .limit(1);
    if (!row) throw new UnprocessableEntityException('That waiter does not work here.');
  }

  async seat(ws: ScopedWorkspace, tableId: string, body: OpenTableSessionRequest, userId: string): Promise<PosFloor> {
    const outletId = await this.db.transaction(async (tx) => {
      const table = await this.table(tx, ws, tableId);
      if (table.status !== 'available' && table.status !== 'reserved') {
        throw new ConflictException(`${table.label} is ${table.status.replace('_', ' ')}, so nobody can be seated there now.`);
      }
      if (body.guestCount > table.seats * 2) {
        throw new UnprocessableEntityException(`${table.label} seats ${table.seats}. Merge tables for a party of ${body.guestCount}.`);
      }
      const waiter = body.waiterUserId ?? userId;
      if (waiter !== userId) await this.assertMember(tx, ws, waiter);
      const [session] = await tx
        .insert(tableSessions)
        .values({
          workspaceId: ws.workspaceId,
          outletId: table.outletId,
          tableId: table.id,
          guestCount: body.guestCount,
          waiterUserId: waiter,
          openedByUserId: userId,
        })
        .returning({ id: tableSessions.id });
      await tx.update(restaurantTables).set({ status: 'occupied', updatedAt: new Date() }).where(eq(restaurantTables.id, table.id));
      await audit(tx, {
        workspaceId: ws.workspaceId,
        outletId: table.outletId,
        actorUserId: userId,
        action: 'table.seated',
        entityType: 'table_session',
        entityId: session?.id ?? null,
        after: { table: table.label, guestCount: body.guestCount },
      });
      return table.outletId;
    });
    return this.read.floor(ws, outletId);
  }

  async setStatus(ws: ScopedWorkspace, tableId: string, body: SetTableStatusRequest, userId: string): Promise<PosFloor> {
    const outletId = await this.db.transaction(async (tx) => {
      const table = await this.table(tx, ws, tableId);
      if (table.status === body.status) return table.outletId;
      if (!TABLE_STATUS_MOVES[table.status].includes(body.status)) {
        throw new ConflictException(
          `${table.label} cannot go from ${table.status.replace('_', ' ')} to ${body.status.replace('_', ' ')} by hand.`,
        );
      }
      await tx.update(restaurantTables).set({ status: body.status, updatedAt: new Date() }).where(eq(restaurantTables.id, table.id));
      await audit(tx, {
        workspaceId: ws.workspaceId,
        outletId: table.outletId,
        actorUserId: userId,
        action: 'table.status',
        entityType: 'restaurant_table',
        entityId: table.id,
        before: { status: table.status },
        after: { status: body.status },
      });
      return table.outletId;
    });
    return this.read.floor(ws, outletId);
  }

  /**
   * Release the table. Refused while any order on the session still owes
   * money or still has a draft: a table is never closed over an open bill.
   */
  async release(ws: ScopedWorkspace, sessionId: string, userId: string): Promise<PosFloor> {
    const outletId = await this.db.transaction(async (tx) => {
      const session = await this.openSession(tx, ws, sessionId);
      const orders = await tx
        .select()
        .from(posOrders)
        .where(and(eq(posOrders.tableSessionId, session.id), ne(posOrders.status, 'cancelled')));
      for (const o of orders) {
        if (o.status === 'draft') throw new ConflictException(`${o.orderNumber} is still a draft. Send it or cancel it first.`);
        const s = await settlementFor(tx, o);
        if (!s.settled) throw new ConflictException(`${o.orderNumber} still owes RWF ${s.outstandingRwf.toLocaleString('en-US')}.`);
      }
      const now = new Date();
      await tx
        .update(tableSessions)
        .set({ status: 'closed', closedAt: now, closedByUserId: userId })
        .where(eq(tableSessions.id, session.id));
      await tx.update(restaurantTables).set({ status: 'cleaning', updatedAt: now }).where(eq(restaurantTables.id, session.tableId));
      await audit(tx, {
        workspaceId: ws.workspaceId,
        outletId: session.outletId,
        actorUserId: userId,
        action: 'table.released',
        entityType: 'table_session',
        entityId: session.id,
      });
      return session.outletId;
    });
    return this.read.floor(ws, outletId);
  }

  /** Move a seated party, and everything they ordered, to another free table of the same outlet. */
  async move(ws: ScopedWorkspace, sessionId: string, body: MoveSessionRequest, userId: string): Promise<PosFloor> {
    const outletId = await this.db.transaction(async (tx) => {
      const session = await this.openSession(tx, ws, sessionId);
      const from = await this.table(tx, ws, session.tableId);
      const to = await this.table(tx, ws, body.toTableId);
      if (to.outletId !== session.outletId) throw new UnprocessableEntityException('A party moves within one outlet.');
      if (to.id === from.id) return session.outletId;
      if (to.status !== 'available' && to.status !== 'reserved') {
        throw new ConflictException(`${to.label} is ${to.status.replace('_', ' ')}. Merge the tables instead.`);
      }
      const now = new Date();
      await tx.update(tableSessions).set({ tableId: to.id }).where(eq(tableSessions.id, session.id));
      await tx.update(restaurantTables).set({ status: 'occupied', updatedAt: now }).where(eq(restaurantTables.id, to.id));
      await tx.update(restaurantTables).set({ status: 'cleaning', updatedAt: now }).where(eq(restaurantTables.id, from.id));
      await audit(tx, {
        workspaceId: ws.workspaceId,
        outletId: session.outletId,
        actorUserId: userId,
        action: 'table.moved',
        entityType: 'table_session',
        entityId: session.id,
        before: { table: from.label },
        after: { table: to.label },
      });
      return session.outletId;
    });
    return this.read.floor(ws, outletId);
  }

  /**
   * Merge: the other party's open orders move onto this session, their
   * session closes as merged and their table goes to `cleaning`. Orders keep
   * their numbers, lines and payments; only the session they sit on changes.
   */
  async merge(ws: ScopedWorkspace, sessionId: string, body: MergeSessionsRequest, userId: string): Promise<PosFloor> {
    const outletId = await this.db.transaction(async (tx) => {
      if (body.fromSessionId === sessionId) throw new UnprocessableEntityException('A table cannot merge with itself.');
      const into = await this.openSession(tx, ws, sessionId);
      const from = await this.openSession(tx, ws, body.fromSessionId);
      if (into.outletId !== from.outletId) throw new UnprocessableEntityException('Tables merge within one outlet.');
      const moved = await tx
        .update(posOrders)
        .set({ tableSessionId: into.id, updatedAt: new Date() })
        .where(and(eq(posOrders.tableSessionId, from.id), notInArray(posOrders.status, ['cancelled'])))
        .returning({ id: posOrders.id });
      for (const o of moved) {
        await orderEvent(tx, { orderId: o.id, kind: 'merged', actorUserId: userId, data: { fromSessionId: from.id, intoSessionId: into.id } });
      }
      const now = new Date();
      await tx
        .update(tableSessions)
        .set({
          status: 'closed',
          closedAt: now,
          closedByUserId: userId,
          mergedIntoSessionId: into.id,
        })
        .where(eq(tableSessions.id, from.id));
      await tx
        .update(tableSessions)
        .set({ guestCount: Math.min(200, into.guestCount + from.guestCount) })
        .where(eq(tableSessions.id, into.id));
      await tx.update(restaurantTables).set({ status: 'cleaning', updatedAt: now }).where(inArray(restaurantTables.id, [from.tableId]));
      await audit(tx, {
        workspaceId: ws.workspaceId,
        outletId: into.outletId,
        actorUserId: userId,
        action: 'table.merged',
        entityType: 'table_session',
        entityId: into.id,
        after: { mergedSessionId: from.id, ordersMoved: moved.length },
      });
      return into.outletId;
    });
    return this.read.floor(ws, outletId);
  }
}
