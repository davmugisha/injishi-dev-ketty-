import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { and, asc, desc, eq, like } from 'drizzle-orm';

import { posAuditEvents, serviceCategories, serviceItems, users } from '../../../database/drizzle/schema';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { itemPhoto } from '../../outlets/domain/menu-photo';
import type { PosStockItem, PosStockMovement, PosStockView, StockAdjustRequest } from '../domain/pos-ops';
import { assumedUnitCost, COST_OF_GOODS_RATIO, LOW_STOCK_AT, stockLevel } from '../infrastructure/pos-stock';
import { audit, itemInOutlet, itemOutlet, outletInScope } from '../infrastructure/pos-support';

/**
 * The stock of a bar or restaurant (POS spec section 8): what is on hand, what is low or out, what it is
 * worth, and a record of every damaged, broken, expired, received or counted quantity.
 *
 * Selling takes stock out by itself (`consumeStock`, on send). Everything a person does by hand goes
 * through `adjust`, which needs `stock.manage` and a reason, and writes an audit row in the same
 * transaction as the new balance.
 */
@Injectable()
export class PosStockService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async view(ws: ScopedWorkspace, outletId: string): Promise<PosStockView> {
    const outlet = await outletInScope(this.db, ws, outletId);
    const rows = await this.db
      .select({
        id: serviceItems.id,
        name: serviceItems.name,
        price: serviceItems.priceRwf,
        stockQty: serviceItems.stockQty,
        status: serviceItems.status,
        category: serviceCategories.name,
        photoObjectKeys: serviceItems.photoObjectKeys,
      })
      .from(serviceItems)
      .leftJoin(serviceCategories, eq(serviceCategories.id, serviceItems.serviceCategoryId))
      .where(and(itemInOutlet(outlet.id), eq(serviceItems.workspaceId, ws.workspaceId)))
      .orderBy(asc(serviceCategories.sortOrder), asc(serviceCategories.name), asc(serviceItems.name));

    const items: PosStockItem[] = rows.map((r) => {
      const price = Number(r.price);
      const unitCost = assumedUnitCost(price);
      return {
        id: r.id,
        name: r.name,
        category: r.category ?? 'Other',
        priceRwf: price,
        stockQty: r.stockQty,
        level: stockLevel(r.stockQty, r.status),
        unitCostRwf: unitCost,
        valueRwf: r.stockQty === null ? 0 : Math.max(0, r.stockQty) * unitCost,
        photo: itemPhoto(r.id, r.photoObjectKeys),
      };
    });
    const summary = {
      tracked: items.filter((i) => i.stockQty !== null).length,
      low: items.filter((i) => i.level === 'low').length,
      out: items.filter((i) => i.level === 'out').length,
      valuationRwf: items.reduce((t, i) => t + i.valueRwf, 0),
    };
    return {
      outletId: outlet.id,
      lowAt: LOW_STOCK_AT,
      costRatio: COST_OF_GOODS_RATIO,
      items,
      summary,
      movements: await this.movements(ws, outlet.id),
    };
  }

  /** The latest stock records of an outlet: the audit trail filtered to `stock.*`. */
  async movements(ws: ScopedWorkspace, outletId: string, limit = 30): Promise<PosStockMovement[]> {
    const rows = await this.db
      .select({
        id: posAuditEvents.id,
        at: posAuditEvents.occurredAt,
        action: posAuditEvents.action,
        before: posAuditEvents.before,
        after: posAuditEvents.after,
        reason: posAuditEvents.reason,
        by: users.name,
        byEmail: users.email,
      })
      .from(posAuditEvents)
      .leftJoin(users, eq(users.id, posAuditEvents.actorUserId))
      .where(and(eq(posAuditEvents.workspaceId, ws.workspaceId), eq(posAuditEvents.outletId, outletId), like(posAuditEvents.action, 'stock.%')))
      .orderBy(desc(posAuditEvents.occurredAt))
      .limit(limit);
    return rows.map((r) => {
      const before = (r.before ?? {}) as { stockQty?: number | null };
      const after = (r.after ?? {}) as { stockQty?: number | null; delta?: number; item?: string; order?: string };
      return {
        id: r.id,
        at: r.at.toISOString(),
        action: r.action,
        item: after.item ?? '',
        delta: typeof after.delta === 'number' ? after.delta : null,
        stockBefore: before.stockQty ?? null,
        stockAfter: after.stockQty ?? null,
        by: r.by ?? r.byEmail ?? null,
        reason: r.reason,
        order: after.order ?? null,
      };
    });
  }

  /** Record damaged, broken, expired, received or counted stock. Returns the item as it now stands. */
  async adjust(ws: ScopedWorkspace, body: StockAdjustRequest, userId: string): Promise<PosStockItem> {
    return this.db.transaction(async (tx) => {
      const [item] = await tx
        .select({
          id: serviceItems.id,
          name: serviceItems.name,
          outletId: itemOutlet,
          price: serviceItems.priceRwf,
          stockQty: serviceItems.stockQty,
          status: serviceItems.status,
        })
        .from(serviceItems)
        .leftJoin(serviceCategories, eq(serviceCategories.id, serviceItems.serviceCategoryId))
        .where(and(eq(serviceItems.id, body.serviceItemId), eq(serviceItems.workspaceId, ws.workspaceId)))
        .limit(1)
        .for('update', { of: serviceItems });
      if (!item || !item.outletId) throw new NotFoundException('That item is not on a menu you can reach.');
      const outlet = await outletInScope(tx, ws, item.outletId);

      const before = item.stockQty;
      let next: number;
      if (body.kind === 'count') {
        next = body.quantity;
      } else if (body.quantity < 1) {
        throw new UnprocessableEntityException('Enter how many.');
      } else if (body.kind === 'received') {
        next = (before ?? 0) + body.quantity;
      } else {
        if (before === null) {
          throw new ConflictException(`${item.name} is not stock tracked yet. Count it first.`);
        }
        if (body.quantity > before) {
          throw new UnprocessableEntityException(`Only ${before} ${item.name} in stock.`);
        }
        next = before - body.quantity;
      }

      await tx
        .update(serviceItems)
        .set({
          stockQty: next,
          status: next === 0 ? 'out_of_stock' : item.status === 'out_of_stock' ? 'active' : item.status,
          updatedAt: new Date(),
        })
        .where(eq(serviceItems.id, item.id));
      await audit(tx, {
        workspaceId: ws.workspaceId,
        outletId: outlet.id,
        actorUserId: userId,
        action: `stock.${body.kind}`,
        entityType: 'service_item',
        entityId: item.id,
        before: { stockQty: before },
        after: { stockQty: next, delta: before === null ? next : next - before, item: item.name, kind: body.kind },
        reason: body.reason,
      });

      const price = Number(item.price);
      const unitCost = assumedUnitCost(price);
      const status = next === 0 ? 'out_of_stock' : item.status === 'out_of_stock' ? 'active' : item.status;
      return {
        id: item.id,
        name: item.name,
        category: '',
        priceRwf: price,
        stockQty: next,
        level: stockLevel(next, status),
        unitCostRwf: unitCost,
        valueRwf: next * unitCost,
      };
    });
  }
}
