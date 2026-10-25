import { canMoveTicket, type AdvancePosTicketRequest, type PosTicket } from '@injishi/contracts';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, max, ne } from 'drizzle-orm';

import {
  kitchenTicketEvents,
  kitchenTicketItems,
  kitchenTickets,
  posPrintJobs,
  preparationStations,
} from '../../../database/drizzle/schema';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { presentTickets } from '../infrastructure/pos-present';
import { outletInScope, refreshOrderStatus, type Tx } from '../infrastructure/pos-support';

/**
 * The kitchen and bar boards (POS spec §6). A ticket moves queued ->
 * preparing -> ready -> served, its items with it, every step recorded in
 * `kitchen_ticket_events`. Moving a ticket refreshes its order's status, so
 * the floor sees "Ready" the moment the pass does.
 */
@Injectable()
export class PosKitchenService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  private async ticket(tx: Tx, ws: ScopedWorkspace, ticketId: string): Promise<typeof kitchenTickets.$inferSelect> {
    const [row] = await tx
      .select()
      .from(kitchenTickets)
      .where(and(eq(kitchenTickets.id, ticketId), eq(kitchenTickets.workspaceId, ws.workspaceId)))
      .limit(1)
      .for('update');
    if (!row) throw new NotFoundException('That ticket is not available to you.');
    await outletInScope(tx, ws, row.outletId);
    return row;
  }

  private async answer(ws: ScopedWorkspace, ticketId: string): Promise<PosTicket> {
    const [row] = await this.db.select().from(kitchenTickets).where(eq(kitchenTickets.id, ticketId)).limit(1);
    if (!row || row.workspaceId !== ws.workspaceId) throw new NotFoundException('That ticket is not available to you.');
    const [view] = await presentTickets(this.db, [row], new Date());
    if (!view) throw new NotFoundException('That ticket is not available to you.');
    return view;
  }

  async advance(ws: ScopedWorkspace, ticketId: string, body: AdvancePosTicketRequest, userId: string): Promise<PosTicket> {
    await this.db.transaction(async (tx) => {
      const ticket = await this.ticket(tx, ws, ticketId);
      if (ticket.status === body.to) return;
      if (!canMoveTicket(ticket.status, body.to)) {
        throw new ConflictException(`A ${ticket.status} ticket cannot go to ${body.to}.`);
      }
      const now = new Date();
      const stamp =
        body.to === 'preparing'
          ? { startedAt: now }
          : body.to === 'ready'
            ? { readyAt: now, startedAt: ticket.startedAt ?? now }
            : body.to === 'served'
              ? { servedAt: now }
              : { cancelledAt: now };
      await tx.update(kitchenTickets).set({ status: body.to, ...stamp }).where(eq(kitchenTickets.id, ticket.id));
      await tx.insert(kitchenTicketEvents).values({
        ticketId: ticket.id,
        fromStatus: ticket.status,
        toStatus: body.to,
        actorUserId: userId,
      });
      const items = await tx
        .select()
        .from(kitchenTicketItems)
        .where(and(eq(kitchenTicketItems.ticketId, ticket.id), ne(kitchenTicketItems.status, 'cancelled')));
      for (const item of items) {
        if (item.status === body.to) continue;
        await tx.update(kitchenTicketItems).set({ status: body.to }).where(eq(kitchenTicketItems.id, item.id));
        await tx.insert(kitchenTicketEvents).values({
          ticketId: ticket.id,
          ticketItemId: item.id,
          fromStatus: item.status,
          toStatus: body.to,
          actorUserId: userId,
        });
      }
      await refreshOrderStatus(tx, ticket.orderId, userId);
    });
    return this.answer(ws, ticketId);
  }

  /** A SIMULATED reprint: the next copy of the same ticket. No order, ticket or stock is touched. */
  async reprint(ws: ScopedWorkspace, ticketId: string, userId: string): Promise<PosTicket> {
    await this.db.transaction(async (tx) => {
      const ticket = await this.ticket(tx, ws, ticketId);
      const [original] = await tx
        .select()
        .from(posPrintJobs)
        .where(and(eq(posPrintJobs.kind, 'kitchen_ticket'), eq(posPrintJobs.sourceId, ticket.id), eq(posPrintJobs.copyNumber, 1)))
        .limit(1);
      const [{ last } = { last: 0 }] = await tx
        .select({ last: max(posPrintJobs.copyNumber) })
        .from(posPrintJobs)
        .where(and(eq(posPrintJobs.kind, 'kitchen_ticket'), eq(posPrintJobs.sourceId, ticket.id)));
      const [station] = await tx
        .select({ printerName: preparationStations.printerName })
        .from(preparationStations)
        .where(eq(preparationStations.id, ticket.stationId))
        .limit(1);
      const copyNumber = (last ?? 0) + 1;
      await tx.insert(posPrintJobs).values({
        workspaceId: ticket.workspaceId,
        outletId: ticket.outletId,
        stationId: ticket.stationId,
        kind: 'kitchen_ticket',
        sourceId: ticket.id,
        copyNumber,
        printerName: station?.printerName ?? null,
        requestedByUserId: userId,
        payload: { ...((original?.payload as Record<string, unknown> | undefined) ?? { simulated: true }), reprint: copyNumber },
      });
    });
    return this.answer(ws, ticketId);
  }
}
