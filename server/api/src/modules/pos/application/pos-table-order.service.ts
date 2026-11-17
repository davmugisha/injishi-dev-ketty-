import { randomBytes } from 'node:crypto';

import type { PlaceTableOrderRequest, TableOrderMenu, TableOrderStatus, TableQrCode } from '@injishi/contracts';
import { Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { and, asc, eq, inArray, isNull, ne, notInArray } from 'drizzle-orm';

import {
  diningAreas,
  kitchenTickets,
  outlets,
  posOrderLines,
  posOrders,
  restaurantTables,
  serviceCategories,
  serviceItems,
  tableQrCodes,
  tableSessions,
} from '../../../database/drizzle/schema';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { itemPhoto, uploadedKey } from '../../outlets/domain/menu-photo';
import { isSellable, readOptions } from '../../outlets/domain/sellable-item';
import { MenuPhotoStorage } from '../../storage/application/menu-photo-storage';
import { audit, itemInOutlet, outletInScope, settingsFor, taxRatesBps } from '../infrastructure/pos-support';
import { PosOrderService } from './pos-order.service';

/** The shape of a table's code: 24 to 64 url-safe characters. Anything else is answered exactly like an unknown code. */
export const TABLE_CODE = /^[A-Za-z0-9_-]{24,64}$/;
/** The client key a guest's phone makes once per cart: the order's idempotency key, and their only handle on it. */
export const CLIENT_KEY = /^[A-Za-z0-9-]{16,64}$/;

const NOT_FOUND = 'This QR code is not linked to a table. Please ask a member of staff.';

/** 144 random bits, url-safe: 24 characters. */
const newCode = (): string => randomBytes(18).toString('base64url');

interface ResolvedTable {
  tableId: string;
  workspaceId: string;
  outletId: string;
  outletName: string;
  label: string;
  areaName: string;
  status: string;
}

/**
 * Table QR self-service ordering (migration 0156).
 *
 * A table's QR holds one permanent, unguessable code (`table_qr_codes`). The code is the guest's whole key, and it
 * opens exactly one table: the menu of that table's outlet (only what can be sold right now), and sending an order
 * that lands on THAT table. Nothing a guest sends names a table, an outlet or a price; a code that is not a live
 * table's is the same 404 as a malformed one, so codes cannot be probed. A guest reads back only the order their own
 * phone sent (by the random key it made for the cart), never the table's other orders or the bill.
 *
 * The staff side lists the codes for the floor's QR cards (creating a table's code the first time it is asked for),
 * and an owner or manager can replace one table's code when a card is lost or copied.
 */
@Injectable()
export class PosTableOrderService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly orders: PosOrderService,
    private readonly photos: MenuPhotoStorage,
  ) {}

  // --- Staff --------------------------------------------------------------------------------------------------------

  /** Every live table's code in this outlet, for the QR cards. A table without one gets one now, once. */
  async codes(ws: ScopedWorkspace, outletId: string): Promise<TableQrCode[]> {
    const outlet = await outletInScope(this.db, ws, outletId);
    const tables = await this.db
      .select({ id: restaurantTables.id })
      .from(restaurantTables)
      .where(and(eq(restaurantTables.outletId, outlet.id), isNull(restaurantTables.archivedAt)));
    if (tables.length) {
      await this.db
        .insert(tableQrCodes)
        .values(tables.map((t) => ({ tableId: t.id, workspaceId: outlet.workspaceId, outletId: outlet.id, code: newCode() })))
        .onConflictDoNothing({ target: tableQrCodes.tableId });
    }
    return this.db
      .select({ tableId: tableQrCodes.tableId, code: tableQrCodes.code })
      .from(tableQrCodes)
      .innerJoin(restaurantTables, eq(restaurantTables.id, tableQrCodes.tableId))
      .where(and(eq(tableQrCodes.outletId, outlet.id), isNull(restaurantTables.archivedAt)));
  }

  /** A new code for one table: its old printed QR stops working at once. Audited. */
  async rotate(ws: ScopedWorkspace, tableId: string, userId: string): Promise<TableQrCode> {
    const [table] = await this.db
      .select()
      .from(restaurantTables)
      .where(and(eq(restaurantTables.id, tableId), eq(restaurantTables.workspaceId, ws.workspaceId), isNull(restaurantTables.archivedAt)))
      .limit(1);
    if (!table) throw new NotFoundException('That table is not available to you.');
    await outletInScope(this.db, ws, table.outletId);
    const code = newCode();
    await this.db.transaction(async (tx) => {
      await tx
        .insert(tableQrCodes)
        .values({ tableId: table.id, workspaceId: table.workspaceId, outletId: table.outletId, code })
        .onConflictDoUpdate({ target: tableQrCodes.tableId, set: { code, updatedAt: new Date() } });
      await audit(tx, {
        workspaceId: table.workspaceId,
        outletId: table.outletId,
        actorUserId: userId,
        action: 'table.qr_replaced',
        entityType: 'restaurant_table',
        entityId: table.id,
        after: { table: table.label },
      });
    });
    return { tableId: table.id, code };
  }

  // --- Guests -------------------------------------------------------------------------------------------------------

  /** The live table a code names, or the one 404 every unknown, malformed, archived or closed one gets. */
  private async resolve(code: string): Promise<ResolvedTable> {
    if (!TABLE_CODE.test(code)) throw new NotFoundException(NOT_FOUND);
    const [row] = await this.db
      .select({
        tableId: restaurantTables.id,
        workspaceId: restaurantTables.workspaceId,
        outletId: outlets.id,
        outletName: outlets.name,
        label: restaurantTables.label,
        areaName: diningAreas.name,
        status: restaurantTables.status,
      })
      .from(tableQrCodes)
      .innerJoin(restaurantTables, eq(restaurantTables.id, tableQrCodes.tableId))
      .innerJoin(diningAreas, eq(diningAreas.id, restaurantTables.areaId))
      .innerJoin(outlets, eq(outlets.id, restaurantTables.outletId))
      .where(and(eq(tableQrCodes.code, code), isNull(restaurantTables.archivedAt), eq(outlets.status, 'active')))
      .limit(1);
    if (!row) throw new NotFoundException(NOT_FOUND);
    return row;
  }

  /** What a guest may order at this table now: active sections, and only items that can be sold this minute. */
  async menu(code: string): Promise<TableOrderMenu> {
    const t = await this.resolve(code);
    const settings = await settingsFor(this.db, { id: t.outletId, workspaceId: t.workspaceId });
    const [categories, items, rates] = await Promise.all([
      this.db
        .select({ id: serviceCategories.id, name: serviceCategories.name })
        .from(serviceCategories)
        .where(and(eq(serviceCategories.outletId, t.outletId), eq(serviceCategories.status, 'active')))
        .orderBy(asc(serviceCategories.sortOrder), asc(serviceCategories.name)),
      this.db
        .select({ item: serviceItems })
        .from(serviceItems)
        .innerJoin(serviceCategories, eq(serviceCategories.id, serviceItems.serviceCategoryId))
        .where(
          and(
            itemInOutlet(t.outletId),
            eq(serviceItems.workspaceId, t.workspaceId),
            eq(serviceItems.status, 'active'),
            eq(serviceCategories.status, 'active'),
          ),
        )
        .orderBy(asc(serviceItems.name)),
      taxRatesBps(this.db, new Date()),
    ]);
    const sellable = items
      .map((r) => r.item)
      .filter((i) => i.stockQty !== 0 && isSellable(i) && rates[i.taxCode] !== undefined);
    const accepting = t.status !== 'cleaning';
    return {
      outletName: t.outletName,
      tableLabel: t.label,
      areaName: t.areaName,
      taxMode: settings.taxMode,
      currency: 'RWF',
      acceptingOrders: accepting,
      notice: accepting ? null : 'This table is being prepared. Please ask a member of staff to help you order.',
      categories: categories.filter((c) => sellable.some((i) => i.serviceCategoryId === c.id)),
      items: sellable.map((i) => ({
        id: i.id,
        categoryId: i.serviceCategoryId,
        name: i.name,
        description: i.description,
        priceRwf: i.priceRwf,
        taxRateBps: rates[i.taxCode] ?? 0,
        options: readOptions(i.options),
        photo: itemPhoto(i.id, i.photoObjectKeys),
        // Shown as "only N left"; the order is checked against the shelf again when it is sent.
        left: i.stockQty !== null && i.stockQty <= 10 ? i.stockQty : null,
      })),
    };
  }

  /** The uploaded photo of an item on THIS table's menu, or 404. A library photo is the app's own picture. */
  async photo(code: string, itemId: string): Promise<Buffer> {
    const t = await this.resolve(code);
    const [item] = await this.db
      .select({ photoObjectKeys: serviceItems.photoObjectKeys })
      .from(serviceItems)
      .innerJoin(serviceCategories, eq(serviceCategories.id, serviceItems.serviceCategoryId))
      .where(and(eq(serviceItems.id, itemId), eq(serviceItems.workspaceId, t.workspaceId), itemInOutlet(t.outletId), ne(serviceItems.status, 'archived')))
      .limit(1);
    const key = item ? uploadedKey(item.photoObjectKeys) : null;
    if (!key) throw new NotFoundException('No photo.');
    try {
      return await this.photos.read(key);
    } catch {
      throw new NotFoundException('No photo.');
    }
  }

  /**
   * Send a guest's cart. Every item must be on this table's menu now (the same rules as `menu`); prices, tax,
   * stock and options are then checked again inside the order's own transaction (`placeFromTable`).
   */
  async place(code: string, body: PlaceTableOrderRequest): Promise<TableOrderStatus> {
    const t = await this.resolve(code);
    const key = `${t.workspaceId}:qr:${t.tableId}:${body.clientKey}`;
    const ids = [...new Set(body.lines.map((l) => l.serviceItemId))];
    const onMenu = await this.db
      .select({ id: serviceItems.id, name: serviceItems.name, status: serviceItems.status, stockQty: serviceItems.stockQty })
      .from(serviceItems)
      .innerJoin(serviceCategories, eq(serviceCategories.id, serviceItems.serviceCategoryId))
      .where(
        and(
          inArray(serviceItems.id, ids),
          eq(serviceItems.workspaceId, t.workspaceId),
          itemInOutlet(t.outletId),
          eq(serviceCategories.status, 'active'),
        ),
      );
    for (const id of ids) {
      const item = onMenu.find((i) => i.id === id);
      if (!item) throw new UnprocessableEntityException('Something in your cart is no longer on the menu. Refresh the menu and try again.');
    }
    const placed = await this.orders.placeFromTable(
      t.tableId,
      { lines: body.lines, guestNote: body.guestNote ?? null, guestCount: body.guestCount ?? null },
      key,
    );
    return this.statusOf(t, placed.orderId);
  }

  /** The order this phone sent from this table, by the key it made; anything else is a 404. */
  async status(code: string, clientKey: string): Promise<TableOrderStatus> {
    const t = await this.resolve(code);
    if (!CLIENT_KEY.test(clientKey)) throw new NotFoundException('That order was not found.');
    const [row] = await this.db
      .select({ id: posOrders.id })
      .from(posOrders)
      .where(and(eq(posOrders.idempotencyKey, `${t.workspaceId}:qr:${t.tableId}:${clientKey}`), eq(posOrders.source, 'table_qr')))
      .limit(1);
    if (!row) throw new NotFoundException('That order was not found.');
    return this.statusOf(t, row.id);
  }

  private async statusOf(t: ResolvedTable, orderId: string): Promise<TableOrderStatus> {
    const [order] = await this.db
      .select({
        id: posOrders.id,
        orderNumber: posOrders.orderNumber,
        status: posOrders.status,
        taxMode: posOrders.taxMode,
        taxRwf: posOrders.taxRwf,
        totalRwf: posOrders.totalRwf,
        createdAt: posOrders.createdAt,
        tableId: tableSessions.tableId,
      })
      .from(posOrders)
      .innerJoin(tableSessions, eq(tableSessions.id, posOrders.tableSessionId))
      .where(eq(posOrders.id, orderId))
      .limit(1);
    // The key names the table the code opened, so another table's code never finds it. If the staff moved the party,
    // the guest sees the table it went to.
    if (!order) throw new NotFoundException('That order was not found.');
    const [lines, tickets, moved] = await Promise.all([
      this.db
        .select({ name: posOrderLines.nameSnapshot, quantity: posOrderLines.quantity, totalRwf: posOrderLines.totalRwf, status: posOrderLines.status })
        .from(posOrderLines)
        .where(eq(posOrderLines.orderId, order.id))
        .orderBy(asc(posOrderLines.createdAt), asc(posOrderLines.id)),
      this.db
        .select({ status: kitchenTickets.status })
        .from(kitchenTickets)
        .where(and(eq(kitchenTickets.orderId, order.id), notInArray(kitchenTickets.status, ['cancelled']))),
      order.tableId === t.tableId
        ? Promise.resolve(null)
        : this.db
            .select({ label: restaurantTables.label })
            .from(restaurantTables)
            .where(eq(restaurantTables.id, order.tableId))
            .limit(1)
            .then((r) => r[0]?.label ?? null),
    ]);
    const states = tickets.map((k) => k.status);
    const stage: TableOrderStatus['stage'] =
      order.status === 'cancelled'
        ? 'cancelled'
        : states.length === 0
          ? 'received'
          : states.every((s) => s === 'served')
            ? 'served'
            : states.every((s) => s === 'served' || s === 'ready')
              ? 'ready'
              : states.some((s) => s === 'preparing' || s === 'ready' || s === 'served')
                ? 'preparing'
                : 'received';
    const live = lines.filter((l) => l.status !== 'voided');
    return {
      orderNumber: order.orderNumber,
      tableLabel: moved ?? t.label,
      stage,
      taxMode: order.taxMode,
      taxRwf: order.taxRwf,
      totalRwf: order.totalRwf,
      placedAt: order.createdAt.toISOString(),
      lines: live.map((l) => ({ name: l.name, quantity: l.quantity, totalRwf: l.totalRwf })),
    };
  }
}

