import { randomUUID } from 'node:crypto';

import {
  discountNeedsApproval,
  divRoundHalfUp,
  type AddPosLinesRequest,
  type ApplyPosDiscountRequest,
  type CancelPosOrderRequest,
  type CreatePosOrderRequest,
  type DecidePosDiscountRequest,
  type PosLineRequest,
  type PosOrder,
  type SplitPosOrderRequest,
  type TransferPosOrderRequest,
  type UpdatePosLineRequest,
  type VoidPosLineRequest,
} from '@injishi/contracts';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { and, asc, eq, inArray, max, ne, notInArray, sql } from 'drizzle-orm';

import {
  kitchenTicketEvents,
  kitchenTicketItems,
  kitchenTickets,
  posItemRoutes,
  posOrderDiscounts,
  posOrderLines,
  posOrders,
  posPayments,
  posPrintJobs,
  preparationStations,
  restaurantTables,
  serviceCategories,
  serviceItems,
  tableSessions,
} from '../../../database/drizzle/schema';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { isSellable, priceLine, unclassifiedSentence } from '../../outlets/domain/sellable-item';
import { presentOrder } from '../infrastructure/pos-present';
import { consumeStock, lineIdsNeverServed, restoreStock } from '../infrastructure/pos-stock';
import {
  audit,
  kigaliPeriod,
  nextNumber,
  itemInOutlet,
  orderEvent,
  orderInScope,
  orderNumberOf,
  outletInScope,
  recomputeOrder,
  refreshOrderStatus,
  settingsFor,
  settlementFor,
  taxRatesBps,
  type OrderRow,
  type Tx,
} from '../infrastructure/pos-support';

const OPEN_PAYMENT = ['initiated', 'pending'] as const;

/**
 * Orders at the till and the table (POS spec §5): drafting, sending rounds
 * to the kitchen and bar, voids and cancellations with a reason, discounts
 * under the outlet's limit and the override above it, transfers and splits.
 *
 * Every command runs in ONE transaction that locks the order row, recomputes
 * its totals from its lines (`recomputeOrder`), refreshes its status
 * (`refreshOrderStatus`) and writes its audit row, then answers with the
 * order as the database now holds it.
 */
@Injectable()
export class PosOrderService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  private has(ws: ScopedWorkspace, permission: string): boolean {
    return (ws.permissions as readonly string[]).includes(permission);
  }

  private async answer(ws: ScopedWorkspace, orderId: string): Promise<PosOrder> {
    return presentOrder(this.db, await orderInScope(this.db, ws, orderId));
  }

  private assertEditable(order: OrderRow): void {
    if (order.status === 'cancelled') throw new ConflictException(`${order.orderNumber} was cancelled.`);
    if (order.status === 'completed') throw new ConflictException(`${order.orderNumber} is completed. Start a new order.`);
  }

  /** Price requested lines against the outlet's menu as it is now, ready to insert. */
  private async priceLines(
    tx: Tx,
    order: Pick<OrderRow, 'id' | 'outletId' | 'workspaceId'>,
    lines: PosLineRequest[],
    userId: string,
  ): Promise<(typeof posOrderLines.$inferInsert)[]> {
    if (lines.length === 0) return [];
    const ids = [...new Set(lines.map((l) => l.serviceItemId))];
    const items = (
      await tx
        .select({ item: serviceItems })
        .from(serviceItems)
        .innerJoin(serviceCategories, eq(serviceCategories.id, serviceItems.serviceCategoryId))
        .where(and(inArray(serviceItems.id, ids), itemInOutlet(order.outletId), eq(serviceItems.workspaceId, order.workspaceId)))
    ).map((r) => r.item);
    const rates = await taxRatesBps(tx, new Date());
    return lines.map((requested) => {
      const item = items.find((i) => i.id === requested.serviceItemId);
      if (!item) throw new NotFoundException('That item is not on this outlet’s menu.');
      if (item.status === 'out_of_stock' || item.stockQty === 0) {
        throw new ConflictException(`${item.name} is sold out.`);
      }
      if (item.stockQty !== null && item.stockQty < requested.quantity) {
        throw new ConflictException(`Only ${item.stockQty} ${item.name} left.`);
      }
      if (item.status !== 'active') throw new ConflictException(`${item.name} is not on sale right now.`);
      if (!isSellable(item)) throw new UnprocessableEntityException(unclassifiedSentence(item.name));
      const rate = rates[item.taxCode];
      if (rate === undefined) throw new UnprocessableEntityException(`The effective tax rates do not cover ${item.taxCode}.`);
      const priced = priceLine(item, requested.quantity, requested.selectedOptions);
      if (!priced.ok) throw new UnprocessableEntityException(priced.problem);
      return {
        workspaceId: order.workspaceId,
        orderId: order.id,
        serviceItemId: item.id,
        // Locked now. The menu may change tomorrow; this line may not (spec §5).
        nameSnapshot: item.name,
        skuSnapshot: item.rraItemCd,
        quantity: requested.quantity,
        unitPriceRwf: priced.unitPriceRwf,
        selectedOptions: priced.selectedOptions,
        note: requested.note?.trim() || null,
        taxCode: item.taxCode,
        taxRateBps: rate,
        grossRwf: priced.lineTotalRwf,
        taxRwf: 0,
        totalRwf: priced.lineTotalRwf,
        createdByUserId: userId,
      };
    });
  }

  /** After a change: the total may never fall below what has been collected, or a refund is owed first. */
  private async assertCovers(tx: Tx, order: OrderRow, totalRwf: number): Promise<void> {
    const s = await settlementFor(tx, { id: order.id, totalRwf });
    const kept = s.collectedRwf - s.refundedRwf;
    if (kept > totalRwf) {
      throw new ConflictException(
        `That would bring the bill below the RWF ${kept.toLocaleString('en-US')} already collected. Refund first.`,
      );
    }
  }

  async create(ws: ScopedWorkspace, body: CreatePosOrderRequest, userId: string, clientKey: string | null): Promise<PosOrder> {
    const key = clientKey ? `${ws.workspaceId}:${clientKey}` : null;
    if (key) {
      const [replay] = await this.db.select({ id: posOrders.id }).from(posOrders).where(eq(posOrders.idempotencyKey, key)).limit(1);
      if (replay) return this.answer(ws, replay.id);
    }
    const outlet = await outletInScope(this.db, ws, body.outletId);
    const id = await this.db.transaction(async (tx) => {
      let waiterUserId: string | null = null;
      if (body.tableSessionId) {
        const [session] = await tx
          .select()
          .from(tableSessions)
          .where(and(eq(tableSessions.id, body.tableSessionId), eq(tableSessions.workspaceId, ws.workspaceId)))
          .limit(1);
        if (!session || session.outletId !== outlet.id) throw new NotFoundException('That table session is not available to you.');
        if (session.status !== 'open') throw new ConflictException('That table has already been released.');
        waiterUserId = session.waiterUserId;
      }
      const settings = await settingsFor(tx, outlet);
      const now = new Date();
      const n = await nextNumber(tx, ws.workspaceId, 'order', now);
      const [row] = await tx
        .insert(posOrders)
        .values({
          workspaceId: ws.workspaceId,
          outletId: outlet.id,
          propertyId: outlet.propertyId,
          taxEntityOrgId: outlet.taxEntityOrgId,
          orderNumber: orderNumberOf(kigaliPeriod(now), n),
          orderType: body.orderType,
          tableSessionId: body.tableSessionId ?? null,
          waiterUserId: waiterUserId ?? userId,
          createdByUserId: userId,
          guestNote: body.guestNote?.trim() || null,
          taxMode: settings.taxMode,
          idempotencyKey: key,
        })
        .returning();
      if (!row) throw new Error('The order did not save.');
      const lines = await this.priceLines(tx, row, body.lines, userId);
      if (lines.length) await tx.insert(posOrderLines).values(lines);
      await recomputeOrder(tx, row);
      await orderEvent(tx, { orderId: row.id, kind: 'created', actorUserId: userId, toStatus: 'draft', data: { lines: lines.length } });
      return row.id;
    });
    return this.answer(ws, id);
  }

  async addLines(ws: ScopedWorkspace, orderId: string, body: AddPosLinesRequest, userId: string): Promise<PosOrder> {
    await this.db.transaction(async (tx) => {
      const order = await orderInScope(tx, ws, orderId, true);
      this.assertEditable(order);
      const lines = await this.priceLines(tx, order, body.lines, userId);
      await tx.insert(posOrderLines).values(lines);
      await recomputeOrder(tx, order);
      await orderEvent(tx, { orderId: order.id, kind: 'lines_added', actorUserId: userId, data: { lines: lines.length } });
      await refreshOrderStatus(tx, order.id, userId);
    });
    return this.answer(ws, orderId);
  }

  private async line(tx: Tx, order: OrderRow, lineId: string): Promise<typeof posOrderLines.$inferSelect> {
    const [line] = await tx
      .select()
      .from(posOrderLines)
      .where(and(eq(posOrderLines.id, lineId), eq(posOrderLines.orderId, order.id)))
      .limit(1)
      .for('update');
    if (!line) throw new NotFoundException('That line is not on this order.');
    return line;
  }

  async updateLine(ws: ScopedWorkspace, orderId: string, lineId: string, body: UpdatePosLineRequest, userId: string): Promise<PosOrder> {
    await this.db.transaction(async (tx) => {
      const order = await orderInScope(tx, ws, orderId, true);
      this.assertEditable(order);
      const line = await this.line(tx, order, lineId);
      if (line.status !== 'draft') {
        throw new ConflictException(`${line.nameSnapshot} has gone to the kitchen. Void it and add it again instead.`);
      }
      const quantity = body.quantity ?? line.quantity;
      if (line.lineDiscountRwf > line.unitPriceRwf * quantity) {
        throw new ConflictException(`${line.nameSnapshot} carries a discount larger than that.`);
      }
      await tx
        .update(posOrderLines)
        .set({
          quantity,
          note: body.note === undefined ? line.note : body.note?.trim() || null,
          grossRwf: line.unitPriceRwf * quantity,
          updatedAt: new Date(),
        })
        .where(eq(posOrderLines.id, line.id));
      const { totalRwf } = await recomputeOrder(tx, order);
      await this.assertCovers(tx, order, totalRwf);
      await orderEvent(tx, { orderId: order.id, kind: 'line_updated', actorUserId: userId, data: { name: line.nameSnapshot, quantity } });
    });
    return this.answer(ws, orderId);
  }

  /** A draft line was never sent, so removing it is no void: it simply goes. */
  async removeDraftLine(ws: ScopedWorkspace, orderId: string, lineId: string, userId: string): Promise<PosOrder> {
    await this.db.transaction(async (tx) => {
      const order = await orderInScope(tx, ws, orderId, true);
      this.assertEditable(order);
      const line = await this.line(tx, order, lineId);
      if (line.status !== 'draft') {
        throw new ConflictException(`${line.nameSnapshot} has gone to the kitchen. Void it with a reason instead.`);
      }
      await tx.delete(posOrderLines).where(eq(posOrderLines.id, line.id));
      const { totalRwf } = await recomputeOrder(tx, order);
      await this.assertCovers(tx, order, totalRwf);
      await orderEvent(tx, { orderId: order.id, kind: 'line_removed', actorUserId: userId, data: { name: line.nameSnapshot } });
      await refreshOrderStatus(tx, order.id, userId);
    });
    return this.answer(ws, orderId);
  }

  /**
   * Send every draft line to its station: one ticket per station per round,
   * one simulated print per ticket. A line with no route (a bottle handed
   * over the bar) is sent without a ticket. Sending again with no draft lines
   * changes nothing, and a line can only ever sit on one ticket.
   */
  async send(ws: ScopedWorkspace, orderId: string, userId: string): Promise<PosOrder> {
    await this.db.transaction(async (tx) => {
      const order = await orderInScope(tx, ws, orderId, true);
      this.assertEditable(order);
      const drafts = await tx
        .select({ line: posOrderLines, stationId: posItemRoutes.stationId })
        .from(posOrderLines)
        .leftJoin(posItemRoutes, eq(posItemRoutes.serviceItemId, posOrderLines.serviceItemId))
        .where(and(eq(posOrderLines.orderId, order.id), eq(posOrderLines.status, 'draft')))
        .orderBy(asc(posOrderLines.createdAt), asc(posOrderLines.id));
      if (drafts.length === 0) return;

      const now = new Date();
      const [{ last } = { last: 0 }] = await tx
        .select({ last: max(kitchenTickets.round) })
        .from(kitchenTickets)
        .where(eq(kitchenTickets.orderId, order.id));
      const round = (last ?? 0) + 1;

      const byStation = new Map<string, typeof drafts>();
      for (const d of drafts) {
        if (!d.stationId) continue;
        byStation.set(d.stationId, [...(byStation.get(d.stationId) ?? []), d]);
      }
      const stations = byStation.size
        ? await tx.select().from(preparationStations).where(inArray(preparationStations.id, [...byStation.keys()]))
        : [];
      const label = order.tableSessionId
        ? (
            await tx
              .select({ label: restaurantTables.label })
              .from(tableSessions)
              .innerJoin(restaurantTables, eq(restaurantTables.id, tableSessions.tableId))
              .where(eq(tableSessions.id, order.tableSessionId))
              .limit(1)
          )[0]?.label ?? null
        : null;

      for (const [stationId, lines] of byStation) {
        const station = stations.find((s) => s.id === stationId);
        if (!station) continue;
        const n = await nextNumber(tx, ws.workspaceId, `ticket_${station.kind}`, now);
        const ticketNumber = `${station.kind === 'bar' ? 'B' : 'K'}-${kigaliPeriod(now)}-${String(n).padStart(4, '0')}`;
        const [ticket] = await tx
          .insert(kitchenTickets)
          .values({
            workspaceId: ws.workspaceId,
            outletId: order.outletId,
            orderId: order.id,
            stationId,
            ticketNumber,
            round,
          })
          .returning({ id: kitchenTickets.id });
        if (!ticket) throw new Error('The ticket did not save.');
        const items = lines.map(({ line }) => ({
          ticketId: ticket.id,
          orderLineId: line.id,
          quantity: line.quantity,
          name: line.nameSnapshot,
          options: (Array.isArray(line.selectedOptions) ? (line.selectedOptions as { name: string; choices: { label: string }[] }[]) : []).map(
            (o) => `${o.name}: ${o.choices.map((c) => c.label).join(', ')}`,
          ),
          note: line.note,
        }));
        await tx.insert(kitchenTicketItems).values(items);
        await tx.insert(kitchenTicketEvents).values({ ticketId: ticket.id, toStatus: 'queued', actorUserId: userId });
        await tx.insert(posPrintJobs).values({
          workspaceId: ws.workspaceId,
          outletId: order.outletId,
          stationId,
          kind: 'kitchen_ticket',
          sourceId: ticket.id,
          copyNumber: 1,
          printerName: station.printerName,
          requestedByUserId: userId,
          payload: {
            simulated: true,
            ticketNumber,
            station: station.name,
            orderNumber: order.orderNumber,
            table: label,
            round,
            items: items.map((i) => ({ quantity: i.quantity, name: i.name, options: i.options, note: i.note })),
          },
        });
      }
      for (const { line, stationId } of drafts) {
        await tx
          .update(posOrderLines)
          .set({ status: 'sent', sentAt: now, stationId: stationId ?? null, updatedAt: now })
          .where(eq(posOrderLines.id, line.id));
      }
      // Stock leaves the shelf when the order is SENT, once: a line is sent a single time, so a retry
      // cannot take it again, and nothing is taken at payment as well.
      await consumeStock(
        tx,
        { workspaceId: ws.workspaceId, outletId: order.outletId, actorUserId: userId, orderNumber: order.orderNumber },
        drafts.map(({ line }) => ({ id: line.id, serviceItemId: line.serviceItemId, quantity: line.quantity, nameSnapshot: line.nameSnapshot })),
      );
      if (!order.submittedAt) {
        await tx.update(posOrders).set({ submittedAt: now, updatedAt: now }).where(eq(posOrders.id, order.id));
      }
      await orderEvent(tx, { orderId: order.id, kind: 'sent', actorUserId: userId, data: { round, lines: drafts.length, tickets: byStation.size } });
      await refreshOrderStatus(tx, order.id, userId);
    });
    return this.answer(ws, orderId);
  }

  /**
   * Void a SENT line: the manager's override, with a reason. Its ticket item
   * is cancelled unless already served, and its ticket with it once nothing
   * on it is left to make. The stock the line consumed when it was sent goes
   * back on the shelf unless the item was already served.
   */
  async voidLine(ws: ScopedWorkspace, orderId: string, lineId: string, body: VoidPosLineRequest, userId: string): Promise<PosOrder> {
    if (!this.has(ws, 'pos.override')) throw new ForbiddenException('Voiding a line that went to the kitchen needs a manager.');
    await this.db.transaction(async (tx) => {
      const order = await orderInScope(tx, ws, orderId, true);
      this.assertEditable(order);
      const line = await this.line(tx, order, lineId);
      if (line.status === 'voided') return;
      if (line.status === 'draft') throw new ConflictException('A draft line is removed, not voided.');
      const now = new Date();
      await tx
        .update(posOrderLines)
        .set({ status: 'voided', voidedAt: now, voidedByUserId: userId, voidReason: body.reason, updatedAt: now })
        .where(eq(posOrderLines.id, line.id));
      await this.cancelTicketItems(tx, [line.id], userId, now);
      // What was never served goes back on the shelf; something already on the table was consumed.
      const back = await lineIdsNeverServed(tx, [line.id]);
      if (back.length > 0) {
        await restoreStock(
          tx,
          { workspaceId: ws.workspaceId, outletId: order.outletId, actorUserId: userId, orderNumber: order.orderNumber, reason: `Line voided: ${body.reason}` },
          [{ id: line.id, serviceItemId: line.serviceItemId, quantity: line.quantity, nameSnapshot: line.nameSnapshot }],
        );
      }
      const { totalRwf } = await recomputeOrder(tx, order);
      await this.assertCovers(tx, order, totalRwf);
      await orderEvent(tx, { orderId: order.id, kind: 'line_voided', actorUserId: userId, data: { name: line.nameSnapshot, reason: body.reason } });
      await audit(tx, {
        workspaceId: ws.workspaceId,
        outletId: order.outletId,
        actorUserId: userId,
        action: 'line.voided',
        entityType: 'pos_order_line',
        entityId: line.id,
        before: { name: line.nameSnapshot, quantity: line.quantity, totalRwf: line.totalRwf, status: line.status },
        after: { status: 'voided' },
        reason: body.reason,
      });
      await refreshOrderStatus(tx, order.id, userId);
    });
    return this.answer(ws, orderId);
  }

  /** Cancel the not yet served ticket items of these lines, and any ticket left with nothing to make. */
  private async cancelTicketItems(tx: Tx, lineIds: string[], userId: string, now: Date): Promise<void> {
    if (lineIds.length === 0) return;
    const items = await tx
      .select()
      .from(kitchenTicketItems)
      .where(and(inArray(kitchenTicketItems.orderLineId, lineIds), notInArray(kitchenTicketItems.status, ['served', 'cancelled'])));
    for (const item of items) {
      await tx.update(kitchenTicketItems).set({ status: 'cancelled' }).where(eq(kitchenTicketItems.id, item.id));
      await tx.insert(kitchenTicketEvents).values({
        ticketId: item.ticketId,
        ticketItemId: item.id,
        fromStatus: item.status,
        toStatus: 'cancelled',
        actorUserId: userId,
      });
    }
    for (const ticketId of new Set(items.map((i) => i.ticketId))) {
      const [left] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(kitchenTicketItems)
        .where(and(eq(kitchenTicketItems.ticketId, ticketId), ne(kitchenTicketItems.status, 'cancelled')));
      if ((left?.n ?? 0) === 0) {
        const [t] = await tx.select({ status: kitchenTickets.status }).from(kitchenTickets).where(eq(kitchenTickets.id, ticketId));
        if (t && t.status !== 'served' && t.status !== 'cancelled') {
          await tx.update(kitchenTickets).set({ status: 'cancelled', cancelledAt: now }).where(eq(kitchenTickets.id, ticketId));
          await tx.insert(kitchenTicketEvents).values({ ticketId, fromStatus: t.status, toStatus: 'cancelled', actorUserId: userId });
        }
      }
    }
  }

  /**
   * Cancel an order, with a reason. A draft anyone selling may cancel; once
   * anything went to the kitchen it is the manager's override. Refused while
   * money is collected or in flight: refund or resolve first.
   */
  async cancel(ws: ScopedWorkspace, orderId: string, body: CancelPosOrderRequest, userId: string): Promise<PosOrder> {
    await this.db.transaction(async (tx) => {
      const order = await orderInScope(tx, ws, orderId, true);
      this.assertEditable(order);
      const sent = await tx
        .select({
          id: posOrderLines.id,
          serviceItemId: posOrderLines.serviceItemId,
          quantity: posOrderLines.quantity,
          nameSnapshot: posOrderLines.nameSnapshot,
        })
        .from(posOrderLines)
        .where(and(eq(posOrderLines.orderId, order.id), eq(posOrderLines.status, 'sent')));
      if (sent.length > 0 && !this.has(ws, 'pos.override')) {
        throw new ForbiddenException('This order has gone to the kitchen, so cancelling it needs a manager.');
      }
      const s = await settlementFor(tx, order);
      if (s.collectedRwf - s.refundedRwf > 0) {
        throw new ConflictException('Money has been collected on this order. Refund it before cancelling.');
      }
      if (s.pendingRwf > 0) throw new ConflictException('A payment is still waiting for its answer. Resolve it first.');
      const now = new Date();
      await this.cancelTicketItems(tx, sent.map((l) => l.id), userId, now);
      const never = new Set(await lineIdsNeverServed(tx, sent.map((l) => l.id)));
      await restoreStock(
        tx,
        { workspaceId: ws.workspaceId, outletId: order.outletId, actorUserId: userId, orderNumber: order.orderNumber, reason: `Order cancelled: ${body.reason}` },
        sent.filter((l) => never.has(l.id)),
      );
      await tx
        .update(posOrders)
        .set({ status: 'cancelled', cancelledAt: now, cancelledByUserId: userId, cancelReason: body.reason, updatedAt: now })
        .where(eq(posOrders.id, order.id));
      await orderEvent(tx, { orderId: order.id, kind: 'cancelled', actorUserId: userId, fromStatus: order.status, toStatus: 'cancelled', data: { reason: body.reason } });
      await audit(tx, {
        workspaceId: ws.workspaceId,
        outletId: order.outletId,
        actorUserId: userId,
        action: 'order.cancelled',
        entityType: 'pos_order',
        entityId: order.id,
        before: { status: order.status, totalRwf: order.totalRwf },
        after: { status: 'cancelled' },
        reason: body.reason,
      });
    });
    return this.answer(ws, orderId);
  }

  /**
   * Ask for a discount. Within the outlet's limit a `pos.discount` holder's
   * discount applies at once; above it, it waits for `pos.override`, and a
   * `pos.override` holder's own discount applies at once at any size. The
   * limit is read against everything already discounted on the same target.
   */
  async applyDiscount(ws: ScopedWorkspace, orderId: string, body: ApplyPosDiscountRequest, userId: string): Promise<PosOrder> {
    await this.db.transaction(async (tx) => {
      const order = await orderInScope(tx, ws, orderId, true);
      this.assertEditable(order);
      const settings = await settingsFor(tx, { id: order.outletId, workspaceId: order.workspaceId });
      const discounts = await tx
        .select()
        .from(posOrderDiscounts)
        .where(and(eq(posOrderDiscounts.orderId, order.id), ne(posOrderDiscounts.status, 'rejected')));

      let grossRwf: number;
      let alreadyRwf: number;
      if (body.orderItemId) {
        const line = await this.line(tx, order, body.orderItemId);
        if (line.status === 'voided') throw new ConflictException(`${line.nameSnapshot} was voided.`);
        grossRwf = line.unitPriceRwf * line.quantity;
        alreadyRwf = discounts.filter((d) => d.orderLineId === line.id).reduce((a, d) => a + d.amountRwf, 0);
      } else {
        grossRwf = order.grossRwf;
        alreadyRwf = discounts.reduce((a, d) => a + d.amountRwf, 0);
      }
      const room = grossRwf - alreadyRwf;
      const amountRwf = body.kind === 'amount' ? body.value : divRoundHalfUp(room * body.value, 10_000);
      if (amountRwf <= 0) throw new UnprocessableEntityException('That discount takes nothing off.');
      if (amountRwf > room) {
        throw new UnprocessableEntityException(`At most RWF ${Math.max(0, room).toLocaleString('en-US')} is left to discount.`);
      }
      const override = this.has(ws, 'pos.override');
      const needs = discountNeedsApproval(alreadyRwf + amountRwf, grossRwf, settings.discountLimitBps);
      const status = override || !needs ? 'approved' : 'pending_approval';
      const now = new Date();
      const [row] = await tx
        .insert(posOrderDiscounts)
        .values({
          workspaceId: ws.workspaceId,
          orderId: order.id,
          orderLineId: body.orderItemId ?? null,
          kind: body.kind,
          value: body.value,
          amountRwf,
          reason: body.reason,
          status,
          requestedByUserId: userId,
          decidedByUserId: status === 'approved' ? userId : null,
          decidedAt: status === 'approved' ? now : null,
        })
        .returning({ id: posOrderDiscounts.id });
      if (status === 'approved') {
        const { totalRwf } = await recomputeOrder(tx, order);
        await this.assertCovers(tx, order, totalRwf);
      }
      await audit(tx, {
        workspaceId: ws.workspaceId,
        outletId: order.outletId,
        actorUserId: userId,
        action: status === 'approved' ? 'discount.applied' : 'discount.requested',
        entityType: 'pos_order_discount',
        entityId: row?.id ?? null,
        after: { orderNumber: order.orderNumber, amountRwf, kind: body.kind, value: body.value, status },
        reason: body.reason,
      });
      await refreshOrderStatus(tx, order.id, userId);
    });
    return this.answer(ws, orderId);
  }

  async decideDiscount(
    ws: ScopedWorkspace,
    orderId: string,
    discountId: string,
    body: DecidePosDiscountRequest,
    userId: string,
  ): Promise<PosOrder> {
    await this.db.transaction(async (tx) => {
      const order = await orderInScope(tx, ws, orderId, true);
      this.assertEditable(order);
      const [d] = await tx
        .select()
        .from(posOrderDiscounts)
        .where(and(eq(posOrderDiscounts.id, discountId), eq(posOrderDiscounts.orderId, order.id)))
        .limit(1)
        .for('update');
      if (!d) throw new NotFoundException('That discount is not on this order.');
      if (d.status !== 'pending_approval') throw new ConflictException('That discount has already been decided.');
      const status = body.approve ? 'approved' : 'rejected';
      await tx
        .update(posOrderDiscounts)
        .set({ status, decidedByUserId: userId, decidedAt: new Date(), decisionNote: body.note?.trim() || null })
        .where(eq(posOrderDiscounts.id, d.id));
      if (status === 'approved') {
        const { totalRwf } = await recomputeOrder(tx, order);
        await this.assertCovers(tx, order, totalRwf);
      }
      await audit(tx, {
        workspaceId: ws.workspaceId,
        outletId: order.outletId,
        actorUserId: userId,
        action: `discount.${status}`,
        entityType: 'pos_order_discount',
        entityId: d.id,
        before: { status: d.status, amountRwf: d.amountRwf },
        after: { status },
        reason: body.note ?? null,
      });
      await refreshOrderStatus(tx, order.id, userId);
    });
    return this.answer(ws, orderId);
  }

  /** Move a dine in order to another seated party of the same outlet. */
  async transfer(ws: ScopedWorkspace, orderId: string, body: TransferPosOrderRequest, userId: string): Promise<PosOrder> {
    await this.db.transaction(async (tx) => {
      const order = await orderInScope(tx, ws, orderId, true);
      this.assertEditable(order);
      if (order.orderType !== 'dine_in' || !order.tableSessionId) {
        throw new UnprocessableEntityException('Only a dine in order moves between tables.');
      }
      if (order.tableSessionId === body.toTableSessionId) return;
      const [to] = await tx
        .select()
        .from(tableSessions)
        .where(and(eq(tableSessions.id, body.toTableSessionId), eq(tableSessions.workspaceId, ws.workspaceId)))
        .limit(1);
      if (!to || to.outletId !== order.outletId) throw new NotFoundException('That table session is not available to you.');
      if (to.status !== 'open') throw new ConflictException('That table has already been released.');
      await tx.update(posOrders).set({ tableSessionId: to.id, updatedAt: new Date() }).where(eq(posOrders.id, order.id));
      await orderEvent(tx, { orderId: order.id, kind: 'transferred', actorUserId: userId, data: { from: order.tableSessionId, to: to.id, reason: body.reason } });
      await audit(tx, {
        workspaceId: ws.workspaceId,
        outletId: order.outletId,
        actorUserId: userId,
        action: 'order.transferred',
        entityType: 'pos_order',
        entityId: order.id,
        before: { tableSessionId: order.tableSessionId },
        after: { tableSessionId: to.id },
        reason: body.reason,
      });
    });
    return this.answer(ws, orderId);
  }

  /**
   * Split the bill: move whole lines to a new order on the same table, which
   * is then paid on its own. Only before any money is taken on the order, so
   * no payment ever has to be divided after the fact. Discounts on a moved
   * line go with it; an order wide discount stays where it was given.
   */
  async split(ws: ScopedWorkspace, orderId: string, body: SplitPosOrderRequest, userId: string): Promise<PosOrder> {
    const newId = await this.db.transaction(async (tx) => {
      const order = await orderInScope(tx, ws, orderId, true);
      this.assertEditable(order);
      const payments = await tx
        .select({ id: posPayments.id })
        .from(posPayments)
        .where(and(eq(posPayments.orderId, order.id), inArray(posPayments.status, ['successful', 'refunded', ...OPEN_PAYMENT])));
      if (payments.length > 0) throw new ConflictException('Money has been taken on this order. Split before the first payment.');
      const lines = await tx
        .select()
        .from(posOrderLines)
        .where(and(eq(posOrderLines.orderId, order.id), ne(posOrderLines.status, 'voided')));
      const moving = lines.filter((l) => body.orderItemIds.includes(l.id));
      if (moving.length !== new Set(body.orderItemIds).size) throw new NotFoundException('A line to split is not on this order.');
      if (moving.length === lines.length) throw new UnprocessableEntityException('Leave at least one line on the original bill.');

      const now = new Date();
      const n = await nextNumber(tx, ws.workspaceId, 'order', now);
      const [created] = await tx
        .insert(posOrders)
        .values({
          workspaceId: order.workspaceId,
          outletId: order.outletId,
          propertyId: order.propertyId,
          taxEntityOrgId: order.taxEntityOrgId,
          orderNumber: orderNumberOf(kigaliPeriod(now), n),
          orderType: order.orderType,
          status: moving.some((l) => l.status === 'sent') ? 'submitted' : 'draft',
          tableSessionId: order.tableSessionId,
          waiterUserId: order.waiterUserId,
          createdByUserId: userId,
          taxMode: order.taxMode,
          splitFromOrderId: order.id,
          submittedAt: moving.some((l) => l.status === 'sent') ? (order.submittedAt ?? now) : null,
        })
        .returning();
      if (!created) throw new Error('The split order did not save.');
      const ids = moving.map((l) => l.id);
      await tx.update(posOrderLines).set({ orderId: created.id, updatedAt: now }).where(inArray(posOrderLines.id, ids));
      await tx.update(posOrderDiscounts).set({ orderId: created.id }).where(inArray(posOrderDiscounts.orderLineId, ids));
      await recomputeOrder(tx, order);
      await recomputeOrder(tx, created);
      await orderEvent(tx, { orderId: order.id, kind: 'split', actorUserId: userId, data: { into: created.orderNumber, lines: ids.length } });
      await orderEvent(tx, { orderId: created.id, kind: 'created', actorUserId: userId, toStatus: created.status, data: { splitFrom: order.orderNumber } });
      await audit(tx, {
        workspaceId: ws.workspaceId,
        outletId: order.outletId,
        actorUserId: userId,
        action: 'order.split',
        entityType: 'pos_order',
        entityId: order.id,
        after: { newOrder: created.orderNumber, lines: moving.map((l) => l.nameSnapshot) },
      });
      await refreshOrderStatus(tx, order.id, userId);
      await refreshOrderStatus(tx, created.id, userId);
      return created.id;
    });
    return this.answer(ws, newId);
  }

  /**
   * Print the bill (SIMULATED). Each press is the next copy of the same
   * document; it never changes the order, its payments or its stock.
   */
  async printBill(ws: ScopedWorkspace, orderId: string, userId: string): Promise<{ copyNumber: number; payload: unknown }> {
    return this.db.transaction(async (tx) => {
      const order = await orderInScope(tx, ws, orderId, true);
      const view = await presentOrder(tx, order);
      const settings = await settingsFor(tx, { id: order.outletId, workspaceId: order.workspaceId });
      const [{ last } = { last: 0 }] = await tx
        .select({ last: max(posPrintJobs.copyNumber) })
        .from(posPrintJobs)
        .where(and(eq(posPrintJobs.kind, 'bill'), eq(posPrintJobs.sourceId, order.id)));
      const copyNumber = (last ?? 0) + 1;
      const payload = {
        simulated: true,
        stamp: 'DEMO ONLY — NOT A VALID RRA/EBM TAX INVOICE',
        header: settings.receiptHeader,
        footer: settings.receiptFooter,
        orderNumber: order.orderNumber,
        table: view.tableLabel,
        taxMode: order.taxMode,
        lines: view.lines
          .filter((l) => l.status !== 'voided')
          .map((l) => ({ quantity: l.quantity, name: l.name, totalRwf: l.totalRwf, taxCode: l.taxCode })),
        grossRwf: order.grossRwf,
        discountRwf: order.discountRwf,
        taxRwf: order.taxRwf,
        totalRwf: order.totalRwf,
        collectedRwf: view.settlement.collectedRwf,
        outstandingRwf: view.settlement.outstandingRwf,
        copy: copyNumber === 1 ? 'ORIGINAL' : `COPY ${copyNumber}`,
        printId: randomUUID(),
      };
      await tx.insert(posPrintJobs).values({
        workspaceId: order.workspaceId,
        outletId: order.outletId,
        kind: 'bill',
        sourceId: order.id,
        copyNumber,
        payload,
        requestedByUserId: userId,
      });
      return { copyNumber, payload };
    });
  }
}
