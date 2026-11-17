import {
  type PosAuditEvent,
  type PosFloor,
  type PosListQuery,
  type PosMenu,
  type PosOrder,
  type PosOrderSummary,
  type PosOutlet,
  type PosRegister,
  type PosShift,
  type PosStation,
  type PosTicket,
  type PrepStationKind,
  type UpdatePosOutletSettingsRequest,
} from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gte, inArray, isNull, lt, ne, notInArray, sql } from 'drizzle-orm';

import {
  cashierShifts,
  kitchenTickets,
  diningAreas,
  posAuditEvents,
  posItemRoutes,
  posOrders,
  posOutletSettings,
  posPayments,
  posRegisters,
  preparationStations,
  restaurantTables,
  serviceCategories,
  serviceItems,
  tableSessions,
} from '../../../database/drizzle/schema';
import { inBranchScope, type ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { itemPhoto } from '../../outlets/domain/menu-photo';
import { isSellable, readOptions } from '../../outlets/domain/sellable-item';
import { presentOrder, presentOrderSummaries, presentShift, presentTickets } from '../infrastructure/pos-present';
import {
  audit,
  itemInOutlet,
  namesOf,
  orderInScope,
  outletInScope,
  outletsInScope,
  settingsFor,
  taxRatesBps,
} from '../infrastructure/pos-support';

/** Kigali is UTC+2 all year, so a Kigali calendar day is [00:00, 24:00) at +02:00. */
function kigaliDayStart(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00+02:00`);
}

/**
 * Every POS read (POS spec phase 1): the outlets a person may sell at, a
 * menu, the floor, orders, the kitchen and bar boards, registers, shifts and
 * the audit trail. Each is filtered by workspace AND branch scope, so a
 * member limited to one branch never reads another's tables or tills.
 */
@Injectable()
export class PosReadService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async outlets(ws: ScopedWorkspace): Promise<PosOutlet[]> {
    const rows = await outletsInScope(this.db, ws);
    const out: PosOutlet[] = [];
    for (const o of rows) {
      const s = await settingsFor(this.db, o);
      out.push({
        id: o.id,
        name: o.name,
        outletKind: o.outletKind,
        propertyId: o.propertyId,
        branchName: o.branchName,
        settings: s,
      });
    }
    return out;
  }

  async updateSettings(
    ws: ScopedWorkspace,
    outletId: string,
    body: UpdatePosOutletSettingsRequest,
    userId: string,
  ): Promise<PosOutlet> {
    const outlet = await outletInScope(this.db, ws, outletId);
    await this.db.transaction(async (tx) => {
      const before = await settingsFor(tx, outlet);
      await tx
        .update(posOutletSettings)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(posOutletSettings.outletId, outlet.id));
      await audit(tx, {
        workspaceId: ws.workspaceId,
        outletId: outlet.id,
        actorUserId: userId,
        action: 'settings.updated',
        entityType: 'pos_outlet_settings',
        entityId: outlet.id,
        before,
        after: { ...before, ...body },
      });
    });
    const [updated] = (await this.outlets(ws)).filter((o) => o.id === outlet.id);
    if (!updated) throw new Error('The outlet vanished.');
    return updated;
  }

  async stations(ws: ScopedWorkspace, outletId: string): Promise<PosStation[]> {
    const outlet = await outletInScope(this.db, ws, outletId);
    const rows = await this.db
      .select()
      .from(preparationStations)
      .where(and(eq(preparationStations.outletId, outlet.id), isNull(preparationStations.archivedAt)))
      .orderBy(asc(preparationStations.sortOrder), asc(preparationStations.name));
    return rows.map((s) => ({ id: s.id, outletId: s.outletId, name: s.name, kind: s.kind, printerName: s.printerName }));
  }

  /**
   * The outlet's menu. An item that cannot sell (archived, out of stock, or
   * missing the RRA codes a later receipt needs) is listed and marked, so the
   * till shows it greyed out rather than pretending it does not exist.
   */
  async menu(ws: ScopedWorkspace, outletId: string): Promise<PosMenu> {
    const outlet = await outletInScope(this.db, ws, outletId);
    const settings = await settingsFor(this.db, outlet);
    const [categories, items, rates] = await Promise.all([
      this.db
        .select({ id: serviceCategories.id, name: serviceCategories.name, sortOrder: serviceCategories.sortOrder })
        .from(serviceCategories)
        .where(and(eq(serviceCategories.outletId, outlet.id), eq(serviceCategories.status, 'active')))
        .orderBy(asc(serviceCategories.sortOrder), asc(serviceCategories.name)),
      this.db
        .select({ item: serviceItems, stationId: posItemRoutes.stationId })
        .from(serviceItems)
        .innerJoin(serviceCategories, eq(serviceCategories.id, serviceItems.serviceCategoryId))
        .leftJoin(posItemRoutes, eq(posItemRoutes.serviceItemId, serviceItems.id))
        .where(and(itemInOutlet(outlet.id), ne(serviceItems.status, 'archived')))
        .orderBy(asc(serviceItems.name)),
      taxRatesBps(this.db, new Date()),
    ]);
    return {
      outletId: outlet.id,
      taxMode: settings.taxMode,
      categories,
      items: items.map(({ item, stationId }) => {
        const reason =
          item.status === 'out_of_stock' || item.stockQty === 0
            ? 'Sold out.'
            : item.status !== 'active'
              ? 'Not on sale right now.'
              : !isSellable(item)
                ? 'Missing the RRA codes a receipt needs.'
                : null;
        return {
          id: item.id,
          categoryId: item.serviceCategoryId,
          name: item.name,
          description: item.description,
          sku: item.rraItemCd,
          priceRwf: item.priceRwf,
          taxCode: item.taxCode,
          taxRateBps: rates[item.taxCode] ?? 0,
          options: readOptions(item.options),
          stationId: stationId ?? null,
          available: reason === null,
          unavailableReason: reason,
          photo: itemPhoto(item.id, item.photoObjectKeys),
        };
      }),
    };
  }

  async floor(ws: ScopedWorkspace, outletId: string): Promise<PosFloor> {
    const outlet = await outletInScope(this.db, ws, outletId);
    const [areas, tables, sessions] = await Promise.all([
      this.db
        .select({ id: diningAreas.id, name: diningAreas.name, sortOrder: diningAreas.sortOrder })
        .from(diningAreas)
        .where(and(eq(diningAreas.outletId, outlet.id), isNull(diningAreas.archivedAt)))
        .orderBy(asc(diningAreas.sortOrder), asc(diningAreas.name)),
      this.db
        .select()
        .from(restaurantTables)
        .where(and(eq(restaurantTables.outletId, outlet.id), isNull(restaurantTables.archivedAt)))
        .orderBy(asc(restaurantTables.sortOrder), asc(restaurantTables.label)),
      this.db
        .select()
        .from(tableSessions)
        .where(and(eq(tableSessions.outletId, outlet.id), eq(tableSessions.status, 'open'))),
    ]);
    const sessionIds = sessions.map((s) => s.id);
    const orders = sessionIds.length
      ? await this.db
          .select({
            id: posOrders.id,
            tableSessionId: posOrders.tableSessionId,
            totalRwf: posOrders.totalRwf,
            status: posOrders.status,
            source: posOrders.source,
          })
          .from(posOrders)
          .where(and(inArray(posOrders.tableSessionId, sessionIds), ne(posOrders.status, 'cancelled')))
      : [];
    const payments = orders.length
      ? await this.db
          .select({ orderId: posPayments.orderId, amountRwf: posPayments.amountRwf, refundedRwf: posPayments.refundedRwf, status: posPayments.status })
          .from(posPayments)
          .where(inArray(posPayments.orderId, orders.map((o) => o.id)))
      : [];
    const names = await namesOf(this.db, sessions.map((s) => s.waiterUserId));
    return {
      outletId: outlet.id,
      areas,
      tables: tables.map((t) => {
        const session = sessions.find((s) => s.tableId === t.id);
        const mine = session ? orders.filter((o) => o.tableSessionId === session.id) : [];
        const qrOrders = mine.filter((o) => o.source === 'table_qr' && o.status !== 'completed').length;
        const collected = payments
          .filter((p) => mine.some((o) => o.id === p.orderId) && (p.status === 'successful' || p.status === 'refunded'))
          // Refunds are corrections of settled bills and never reopen one (`settlementOf`).
          .reduce((a, p) => a + p.amountRwf, 0);
        return {
          id: t.id,
          areaId: t.areaId,
          label: t.label,
          seats: t.seats,
          status: t.status,
          sessionId: session?.id ?? null,
          guestCount: session?.guestCount ?? null,
          waiterName: session?.waiterUserId ? (names.get(session.waiterUserId) ?? null) : null,
          openedAt: session ? session.openedAt.toISOString() : null,
          openOrders: mine.filter((o) => o.status !== 'completed').length,
          outstandingRwf: Math.max(0, mine.reduce((a, o) => a + o.totalRwf, 0) - collected),
          // Only when guests ordered from the table's QR (migration 0156), so the floor reads as before otherwise.
          ...(qrOrders > 0 ? { qrOrders } : {}),
        };
      }),
    };
  }

  async orders(ws: ScopedWorkspace, query: PosListQuery): Promise<PosOrderSummary[]> {
    const conditions = [
      eq(posOrders.workspaceId, ws.workspaceId),
      inBranchScope(posOrders.propertyId, ws.branchScope),
    ];
    if (query.outletId) conditions.push(eq(posOrders.outletId, (await outletInScope(this.db, ws, query.outletId)).id));
    if (query.status === 'open') conditions.push(notInArray(posOrders.status, ['completed', 'cancelled']));
    else if (query.status) conditions.push(sql`${posOrders.status}::text = ${query.status}`);
    if (query.from) conditions.push(gte(posOrders.createdAt, kigaliDayStart(query.from)));
    if (query.to) conditions.push(lt(posOrders.createdAt, new Date(kigaliDayStart(query.to).getTime() + 86_400_000)));
    const rows = await this.db
      .select()
      .from(posOrders)
      .where(and(...conditions))
      .orderBy(desc(posOrders.createdAt))
      .limit(query.limit);
    return presentOrderSummaries(this.db, rows);
  }

  async order(ws: ScopedWorkspace, orderId: string): Promise<PosOrder> {
    return presentOrder(this.db, await orderInScope(this.db, ws, orderId));
  }

  /** A station board: open tickets, plus what was served or cancelled in the last two hours. */
  async tickets(ws: ScopedWorkspace, outletId: string, kind: PrepStationKind | undefined): Promise<PosTicket[]> {
    const outlet = await outletInScope(this.db, ws, outletId);
    const now = new Date();
    const since = new Date(now.getTime() - 2 * 3_600_000);
    const stationIds = (
      await this.db
        .select({ id: preparationStations.id })
        .from(preparationStations)
        .where(
          and(
            eq(preparationStations.outletId, outlet.id),
            kind ? eq(preparationStations.kind, kind) : undefined,
          ),
        )
    ).map((s) => s.id);
    if (stationIds.length === 0) return [];
    const rows = await this.db
      .select()
      .from(kitchenTickets)
      .where(
        and(
          inArray(kitchenTickets.stationId, stationIds),
          sql`(${kitchenTickets.status} IN ('queued', 'preparing', 'ready') OR ${kitchenTickets.createdAt} >= ${since})`,
        ),
      )
      .orderBy(asc(kitchenTickets.createdAt));
    return presentTickets(this.db, rows, now);
  }

  async registers(ws: ScopedWorkspace, outletId: string): Promise<PosRegister[]> {
    const outlet = await outletInScope(this.db, ws, outletId);
    const regs = await this.db
      .select()
      .from(posRegisters)
      .where(and(eq(posRegisters.outletId, outlet.id), isNull(posRegisters.archivedAt)))
      .orderBy(asc(posRegisters.name));
    const open = regs.length
      ? await this.db
          .select({ id: cashierShifts.id, registerId: cashierShifts.registerId, cashierUserId: cashierShifts.cashierUserId })
          .from(cashierShifts)
          .where(and(inArray(cashierShifts.registerId, regs.map((r) => r.id)), eq(cashierShifts.status, 'open')))
      : [];
    const names = await namesOf(this.db, open.map((s) => s.cashierUserId));
    return regs.map((r) => {
      const s = open.find((o) => o.registerId === r.id);
      return {
        id: r.id,
        outletId: r.outletId,
        name: r.name,
        deviceLabel: r.deviceLabel,
        openShiftId: s?.id ?? null,
        openShiftCashierName: s ? (names.get(s.cashierUserId) ?? null) : null,
      };
    });
  }

  async shifts(ws: ScopedWorkspace, query: PosListQuery): Promise<PosShift[]> {
    const conditions = [eq(cashierShifts.workspaceId, ws.workspaceId)];
    const outlets = query.outletId ? [await outletInScope(this.db, ws, query.outletId)] : await outletsInScope(this.db, ws);
    if (outlets.length === 0) return [];
    conditions.push(inArray(cashierShifts.outletId, outlets.map((o) => o.id)));
    if (query.status) conditions.push(sql`${cashierShifts.status}::text = ${query.status}`);
    if (query.from) conditions.push(gte(cashierShifts.openedAt, kigaliDayStart(query.from)));
    if (query.to) conditions.push(lt(cashierShifts.openedAt, new Date(kigaliDayStart(query.to).getTime() + 86_400_000)));
    const rows = await this.db
      .select()
      .from(cashierShifts)
      .where(and(...conditions))
      .orderBy(desc(cashierShifts.openedAt))
      .limit(query.limit);
    // One at a time: each shift already runs several queries in parallel, and presenting twenty shifts at once asked the
    // pool for sixty connections, so a long shift history (or a busy moment) answered 500 "timeout exceeded when trying to connect".
    const shifts: PosShift[] = [];
    for (const row of rows) shifts.push(await presentShift(this.db, row));
    return shifts;
  }

  /** The caller's own open shift at this outlet, or null. */
  async myShift(ws: ScopedWorkspace, outletId: string, userId: string): Promise<PosShift | null> {
    const outlet = await outletInScope(this.db, ws, outletId);
    const [row] = await this.db
      .select()
      .from(cashierShifts)
      .where(
        and(
          eq(cashierShifts.outletId, outlet.id),
          eq(cashierShifts.cashierUserId, userId),
          eq(cashierShifts.status, 'open'),
        ),
      )
      .limit(1);
    return row ? presentShift(this.db, row) : null;
  }

  async auditTrail(ws: ScopedWorkspace, query: PosListQuery): Promise<PosAuditEvent[]> {
    const outlets = query.outletId ? [await outletInScope(this.db, ws, query.outletId)] : await outletsInScope(this.db, ws);
    const conditions = [
      eq(posAuditEvents.workspaceId, ws.workspaceId),
      outlets.length ? inArray(posAuditEvents.outletId, outlets.map((o) => o.id)) : sql`false`,
    ];
    if (query.from) conditions.push(gte(posAuditEvents.occurredAt, kigaliDayStart(query.from)));
    if (query.to) conditions.push(lt(posAuditEvents.occurredAt, new Date(kigaliDayStart(query.to).getTime() + 86_400_000)));
    const rows = await this.db
      .select()
      .from(posAuditEvents)
      .where(and(...conditions))
      .orderBy(desc(posAuditEvents.occurredAt))
      .limit(query.limit);
    const names = await namesOf(this.db, rows.map((r) => r.actorUserId));
    return rows.map((r) => ({
      id: r.id,
      occurredAt: r.occurredAt.toISOString(),
      actorName: r.actorUserId ? (names.get(r.actorUserId) ?? null) : null,
      outletId: r.outletId,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      before: r.before ?? null,
      after: r.after ?? null,
      reason: r.reason,
    }));
  }
}
