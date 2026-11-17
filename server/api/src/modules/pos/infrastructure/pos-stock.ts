import { ConflictException } from '@nestjs/common';
import { and, eq, inArray, notInArray } from 'drizzle-orm';

import { kitchenTicketItems, serviceItems } from '../../../database/drizzle/schema';
import { audit, type Tx } from './pos-support';

/**
 * Stock for the point of sale (POS spec section 8, the first step).
 *
 * The balance of an item is `service_items.stock_qty`; `null` means the item is not stock tracked (a
 * dish made to order) and nothing here touches it. Every change to a balance writes one
 * `pos_audit_events` row, in the SAME transaction, so the audit trail is the movement history: what
 * moved, by whom, from what balance to what, and why.
 *
 * The business event that consumes stock is SENDING an order (the kitchen or the bar fires it). Stock is
 * never taken at payment as well, and a line is sent once, so a retried request cannot take it twice.
 * A void or a cancellation returns the stock of what was never served.
 */

/** An item at or below this many units is "low". A fixed demo default: no reorder level is stored yet. */
export const LOW_STOCK_AT = 10;

/**
 * Cost of goods as a share of the selling price, for the stock valuation and the estimated profit.
 * A DEMO ASSUMPTION: no cost price is stored per item yet, so every figure that uses it says so.
 */
export const COST_OF_GOODS_RATIO = 0.35;

export type StockLevel = 'untracked' | 'ok' | 'low' | 'out';

export function stockLevel(stockQty: number | null, status: string): StockLevel {
  if (stockQty === null) return status === 'out_of_stock' ? 'out' : 'untracked';
  if (stockQty <= 0 || status === 'out_of_stock') return 'out';
  return stockQty <= LOW_STOCK_AT ? 'low' : 'ok';
}

/** The estimated unit cost of an item, in whole RWF, from its price (see COST_OF_GOODS_RATIO). */
export function assumedUnitCost(priceRwf: number): number {
  return Math.round(priceRwf * COST_OF_GOODS_RATIO);
}

interface SentLine {
  id: string;
  serviceItemId: string | null;
  quantity: number;
  nameSnapshot: string;
}

/**
 * Take the stock of lines that were just sent. A line whose item is stock tracked and short refuses the
 * whole send with a sentence naming the item, so a balance can never go below zero.
 */
export async function consumeStock(
  tx: Tx,
  ctx: { workspaceId: string; outletId: string; actorUserId: string | null; orderNumber: string },
  lines: SentLine[],
): Promise<void> {
  const wanted = new Map<string, { qty: number; name: string }>();
  for (const l of lines) {
    if (!l.serviceItemId) continue;
    const prior = wanted.get(l.serviceItemId);
    wanted.set(l.serviceItemId, { qty: (prior?.qty ?? 0) + l.quantity, name: l.nameSnapshot });
  }
  if (wanted.size === 0) return;
  const items = await tx
    .select({ id: serviceItems.id, stockQty: serviceItems.stockQty, status: serviceItems.status })
    .from(serviceItems)
    .where(and(inArray(serviceItems.id, [...wanted.keys()]), eq(serviceItems.workspaceId, ctx.workspaceId)))
    .for('update');
  for (const item of items) {
    if (item.stockQty === null) continue;
    const { qty, name } = wanted.get(item.id) as { qty: number; name: string };
    if (item.stockQty < qty) {
      throw new ConflictException(
        item.stockQty === 0 ? `${name} is sold out.` : `Only ${item.stockQty} ${name} left; this order needs ${qty}.`,
      );
    }
    const left = item.stockQty - qty;
    await tx
      .update(serviceItems)
      .set({ stockQty: left, ...(left === 0 ? { status: 'out_of_stock' as const } : {}), updatedAt: new Date() })
      .where(eq(serviceItems.id, item.id));
    await audit(tx, {
      workspaceId: ctx.workspaceId,
      outletId: ctx.outletId,
      actorUserId: ctx.actorUserId,
      action: 'stock.consumed',
      entityType: 'service_item',
      entityId: item.id,
      before: { stockQty: item.stockQty },
      after: { stockQty: left, delta: -qty, item: name, order: ctx.orderNumber },
    });
  }
}

/** Of these lines, the ones whose item was never served (so its stock can go back on the shelf). */
export async function lineIdsNeverServed(tx: Tx, lineIds: string[]): Promise<string[]> {
  if (lineIds.length === 0) return [];
  const served = await tx
    .select({ lineId: kitchenTicketItems.orderLineId })
    .from(kitchenTicketItems)
    .where(and(inArray(kitchenTicketItems.orderLineId, lineIds), notInArray(kitchenTicketItems.status, ['queued', 'preparing', 'ready', 'cancelled'])));
  const gone = new Set(served.map((s) => s.lineId));
  return lineIds.filter((id) => !gone.has(id));
}

/** Put the stock of lines back (a void or a cancellation), with the reason on the audit row. */
export async function restoreStock(
  tx: Tx,
  ctx: { workspaceId: string; outletId: string; actorUserId: string; orderNumber: string; reason: string },
  lines: SentLine[],
): Promise<void> {
  const back = new Map<string, { qty: number; name: string }>();
  for (const l of lines) {
    if (!l.serviceItemId) continue;
    const prior = back.get(l.serviceItemId);
    back.set(l.serviceItemId, { qty: (prior?.qty ?? 0) + l.quantity, name: l.nameSnapshot });
  }
  if (back.size === 0) return;
  const items = await tx
    .select({ id: serviceItems.id, stockQty: serviceItems.stockQty, status: serviceItems.status })
    .from(serviceItems)
    .where(and(inArray(serviceItems.id, [...back.keys()]), eq(serviceItems.workspaceId, ctx.workspaceId)))
    .for('update');
  for (const item of items) {
    if (item.stockQty === null) continue;
    const { qty, name } = back.get(item.id) as { qty: number; name: string };
    const now = item.stockQty + qty;
    await tx
      .update(serviceItems)
      .set({ stockQty: now, ...(item.stockQty === 0 && item.status === 'out_of_stock' ? { status: 'active' as const } : {}), updatedAt: new Date() })
      .where(eq(serviceItems.id, item.id));
    await audit(tx, {
      workspaceId: ctx.workspaceId,
      outletId: ctx.outletId,
      actorUserId: ctx.actorUserId,
      action: 'stock.restored',
      entityType: 'service_item',
      entityId: item.id,
      before: { stockQty: item.stockQty },
      after: { stockQty: now, delta: qty, item: name, order: ctx.orderNumber },
      reason: ctx.reason,
    });
  }
}
