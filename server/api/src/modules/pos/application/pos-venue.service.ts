import {
  POS_SETUP_STEPS,
  type CreateAreaRequest,
  type CreateRegisterRequest,
  type CreateStationRequest,
  type CreateTableRequest,
  type PosSetup,
  type PosVenue,
  type SetItemRouteRequest,
  type UpdateAreaRequest,
  type UpdateRegisterRequest,
  type UpdateStationRequest,
  type UpdateTableRequest,
} from '@injishi/contracts';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, count, eq, inArray, isNull, ne, notInArray, sql } from 'drizzle-orm';

import {
  cashierShifts,
  diningAreas,
  kitchenTickets,
  orgMemberships,
  posItemRoutes,
  posOrders,
  posOutletSettings,
  posRegisters,
  preparationStations,
  restaurantTables,
  serviceCategories,
  serviceItems,
  tableSessions,
  workspaces,
} from '../../../database/drizzle/schema';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { audit, itemInOutlet, outletInScope, type OutletRow, type Tx } from '../infrastructure/pos-support';

/** Tickets that still need work: queued, being prepared, or ready to collect. */
const OPEN_TICKET = ['queued', 'preparing', 'ready'] as const;
/** Table states that mean guests are, or are about to be, at the table. */
const TABLE_IN_USE = ['occupied', 'reserved', 'bill_requested'] as const;

function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } } | null;
  return e?.code === '23505' || e?.cause?.code === '23505';
}

/** What the unique-name rules mean to a person: the name is taken, or was taken by something archived. */
function nameTaken(what: string, name: string): ConflictException {
  return new ConflictException(
    `A ${what} called "${name}" already exists at this outlet (it may be archived). Choose another name.`,
  );
}

const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/**
 * Venue setup: the dining areas, tables, preparation stations, registers and item routing an owner configures.
 *
 * The same rules as the rest of the POS apply here and are not repeated by callers:
 *  - Every row is read and written through `outletInScope`, so another business's outlet, or an outlet of a
 *    branch the caller does not cover, is a 404 and never a 403 that confirms it exists.
 *  - Nothing in use is removed. A table with guests, a station with open tickets or routed items, a register
 *    with an open shift is refused with the reason, and "removing" is always archiving (a soft delete), so
 *    history that points at it stays readable.
 *  - Every change writes a `venue.*` audit row in the same transaction.
 * No migration is involved: the tables already carry `archived_at`.
 */
@Injectable()
export class PosVenueService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  // ── Reading ──────────────────────────────────────────────────────────────────────────────────────

  /**
   * Both reads run on ONE connection (a transaction), not as separate pool checkouts: a screen load fires five or nine
   * queries at once, and several people loading screens together would otherwise ask the pool for far more than it has
   * (the same starvation that made the dashboard and the shift list answer 500).
   */
  async get(ws: ScopedWorkspace, outletId: string): Promise<PosVenue> {
    return this.db.transaction(async (tx) => this.read(tx, await outletInScope(tx, ws, outletId)));
  }

  private async read(db: Database | Tx, outlet: OutletRow): Promise<PosVenue> {
    const [areas, tables, stations, registers, routing] = await Promise.all([
      db
        .select({
          id: diningAreas.id,
          name: diningAreas.name,
          sortOrder: diningAreas.sortOrder,
          tableCount: sql<number>`(select count(*)::int from restaurant_tables t where t.area_id = dining_areas.id and t.archived_at is null)`,
        })
        .from(diningAreas)
        .where(and(eq(diningAreas.outletId, outlet.id), eq(diningAreas.workspaceId, outlet.workspaceId), isNull(diningAreas.archivedAt)))
        .orderBy(asc(diningAreas.sortOrder), asc(diningAreas.name)),
      db
        .select({
          id: restaurantTables.id,
          areaId: restaurantTables.areaId,
          label: restaurantTables.label,
          seats: restaurantTables.seats,
          status: restaurantTables.status,
          sortOrder: restaurantTables.sortOrder,
          hasOpenSession: sql<boolean>`exists (select 1 from table_sessions s where s.table_id = restaurant_tables.id and s.status = 'open')`,
        })
        .from(restaurantTables)
        .where(and(eq(restaurantTables.outletId, outlet.id), eq(restaurantTables.workspaceId, outlet.workspaceId), isNull(restaurantTables.archivedAt)))
        .orderBy(asc(restaurantTables.sortOrder), asc(restaurantTables.label)),
      db
        .select({
          id: preparationStations.id,
          name: preparationStations.name,
          kind: preparationStations.kind,
          printerName: preparationStations.printerName,
          sortOrder: preparationStations.sortOrder,
          routedItems: sql<number>`(select count(*)::int from pos_item_routes r where r.station_id = preparation_stations.id)`,
          openTickets: sql<number>`(select count(*)::int from kitchen_tickets k where k.station_id = preparation_stations.id and k.status in ('queued','preparing','ready'))`,
        })
        .from(preparationStations)
        .where(and(eq(preparationStations.outletId, outlet.id), eq(preparationStations.workspaceId, outlet.workspaceId), isNull(preparationStations.archivedAt)))
        .orderBy(asc(preparationStations.sortOrder), asc(preparationStations.name)),
      db
        .select({
          id: posRegisters.id,
          name: posRegisters.name,
          deviceLabel: posRegisters.deviceLabel,
          hasOpenShift: sql<boolean>`exists (select 1 from cashier_shifts c where c.register_id = pos_registers.id and c.status = 'open')`,
        })
        .from(posRegisters)
        .where(and(eq(posRegisters.outletId, outlet.id), eq(posRegisters.workspaceId, outlet.workspaceId), isNull(posRegisters.archivedAt)))
        .orderBy(asc(posRegisters.name)),
      db
        .select({
          serviceItemId: serviceItems.id,
          name: serviceItems.name,
          categoryName: serviceCategories.name,
          stationId: posItemRoutes.stationId,
        })
        .from(serviceItems)
        .leftJoin(serviceCategories, eq(serviceCategories.id, serviceItems.serviceCategoryId))
        .leftJoin(posItemRoutes, eq(posItemRoutes.serviceItemId, serviceItems.id))
        .where(and(itemInOutlet(outlet.id), ne(serviceItems.status, 'archived')))
        .orderBy(asc(serviceCategories.sortOrder), asc(serviceItems.name)),
    ]);
    return {
      outletId: outlet.id,
      areas,
      tables,
      stations: stations.map((s) => ({ ...s, printerName: s.printerName ?? null })),
      registers: registers.map((r) => ({ ...r, deviceLabel: r.deviceLabel ?? null })),
      routing: routing.map((r) => ({ ...r, categoryName: r.categoryName ?? null, stationId: r.stationId ?? null })),
    };
  }

  /** What has been set up so far, counted from the records. Never a gate: every screen stays open. */
  async setup(ws: ScopedWorkspace, outletId: string): Promise<PosSetup> {
    return this.db.transaction(async (tx) => this.countSetup(tx, ws, await outletInScope(tx, ws, outletId)));
  }

  private async countSetup(db: Tx, ws: ScopedWorkspace, outlet: OutletRow): Promise<PosSetup> {
    const n = async (q: Promise<{ n: number }[]>): Promise<number> => Number((await q)[0]?.n ?? 0);
    const [areas, tables, stations, registers, categories, products, routed, members, settings] = await Promise.all([
      n(db.select({ n: count() }).from(diningAreas).where(and(eq(diningAreas.outletId, outlet.id), eq(diningAreas.workspaceId, outlet.workspaceId), isNull(diningAreas.archivedAt)))),
      n(db.select({ n: count() }).from(restaurantTables).where(and(eq(restaurantTables.outletId, outlet.id), eq(restaurantTables.workspaceId, outlet.workspaceId), isNull(restaurantTables.archivedAt)))),
      n(db.select({ n: count() }).from(preparationStations).where(and(eq(preparationStations.outletId, outlet.id), eq(preparationStations.workspaceId, outlet.workspaceId), isNull(preparationStations.archivedAt)))),
      n(db.select({ n: count() }).from(posRegisters).where(and(eq(posRegisters.outletId, outlet.id), eq(posRegisters.workspaceId, outlet.workspaceId), isNull(posRegisters.archivedAt)))),
      n(
        db
          .select({ n: count() })
          .from(serviceCategories)
          .where(and(eq(serviceCategories.outletId, outlet.id), eq(serviceCategories.status, 'active'))),
      ),
      n(
        db
          .select({ n: count() })
          .from(serviceItems)
          .leftJoin(serviceCategories, eq(serviceCategories.id, serviceItems.serviceCategoryId))
          .where(and(itemInOutlet(outlet.id), ne(serviceItems.status, 'archived'))),
      ),
      n(
        db
          .select({ n: count() })
          .from(posItemRoutes)
          .innerJoin(serviceItems, eq(serviceItems.id, posItemRoutes.serviceItemId))
          .leftJoin(serviceCategories, eq(serviceCategories.id, serviceItems.serviceCategoryId))
          .where(and(itemInOutlet(outlet.id), ne(serviceItems.status, 'archived'))),
      ),
      n(
        db
          .select({ n: count() })
          .from(orgMemberships)
          .innerJoin(workspaces, eq(workspaces.orgId, orgMemberships.orgId))
          .where(and(eq(workspaces.id, ws.workspaceId), eq(orgMemberships.status, 'active'))),
      ),
      db
        .select({ header: posOutletSettings.receiptHeader })
        .from(posOutletSettings)
        .where(eq(posOutletSettings.outletId, outlet.id))
        .limit(1),
    ]);
    const counts: Record<(typeof POS_SETUP_STEPS)[number], number> = {
      areas,
      tables,
      stations,
      registers,
      categories,
      products,
      routing: routed,
      receipts: settings[0]?.header.trim() ? 1 : 0,
      // The owner counts as one; a team is anyone besides them.
      team: Math.max(0, members - 1),
    };
    const steps = POS_SETUP_STEPS.map((key) => ({ key, count: counts[key], done: counts[key] > 0 }));
    return { outletId: outlet.id, steps, doneCount: steps.filter((s) => s.done).length, total: steps.length };
  }

  // ── Dining areas ─────────────────────────────────────────────────────────────────────────────────

  async createArea(ws: ScopedWorkspace, outletId: string, body: CreateAreaRequest, userId: string): Promise<PosVenue> {
    return this.write(ws, outletId, async (tx, outlet) => {
      try {
        const [row] = await tx
          .insert(diningAreas)
          .values({ workspaceId: outlet.workspaceId, outletId: outlet.id, name: body.name, sortOrder: body.sortOrder ?? (await this.nextSort(tx, diningAreas, outlet)) })
          .returning({ id: diningAreas.id });
        await audit(tx, { workspaceId: outlet.workspaceId, outletId: outlet.id, actorUserId: userId, action: 'venue.area.create', entityType: 'dining_area', entityId: row?.id ?? null, after: body });
      } catch (error) {
        if (isUniqueViolation(error)) throw nameTaken('dining area', body.name);
        throw error;
      }
    });
  }

  async updateArea(ws: ScopedWorkspace, outletId: string, areaId: string, body: UpdateAreaRequest, userId: string): Promise<PosVenue> {
    return this.write(ws, outletId, async (tx, outlet) => {
      const area = await this.area(tx, outlet, areaId);
      try {
        await tx.update(diningAreas).set({ ...body, updatedAt: new Date() }).where(eq(diningAreas.id, area.id));
      } catch (error) {
        if (isUniqueViolation(error)) throw nameTaken('dining area', body.name ?? area.name);
        throw error;
      }
      await audit(tx, { workspaceId: outlet.workspaceId, outletId: outlet.id, actorUserId: userId, action: 'venue.area.update', entityType: 'dining_area', entityId: area.id, before: { name: area.name, sortOrder: area.sortOrder }, after: body });
    });
  }

  async archiveArea(ws: ScopedWorkspace, outletId: string, areaId: string, userId: string): Promise<PosVenue> {
    return this.write(ws, outletId, async (tx, outlet) => {
      const area = await this.area(tx, outlet, areaId);
      const [{ n } = { n: 0 }] = await tx
        .select({ n: count() })
        .from(restaurantTables)
        .where(and(eq(restaurantTables.areaId, area.id), isNull(restaurantTables.archivedAt)));
      if (n > 0) throw new ConflictException(`${area.name} still has ${plural(n, 'table')}. Move or archive them first.`);
      await tx.update(diningAreas).set({ archivedAt: new Date(), updatedAt: new Date() }).where(eq(diningAreas.id, area.id));
      await audit(tx, { workspaceId: outlet.workspaceId, outletId: outlet.id, actorUserId: userId, action: 'venue.area.archive', entityType: 'dining_area', entityId: area.id, before: { name: area.name } });
    });
  }

  // ── Tables ───────────────────────────────────────────────────────────────────────────────────────

  async createTable(ws: ScopedWorkspace, outletId: string, body: CreateTableRequest, userId: string): Promise<PosVenue> {
    return this.write(ws, outletId, async (tx, outlet) => {
      const area = await this.area(tx, outlet, body.areaId);
      try {
        const [row] = await tx
          .insert(restaurantTables)
          .values({ workspaceId: outlet.workspaceId, outletId: outlet.id, areaId: area.id, label: body.label, seats: body.seats, sortOrder: body.sortOrder ?? (await this.nextSort(tx, restaurantTables, outlet)) })
          .returning({ id: restaurantTables.id });
        await audit(tx, { workspaceId: outlet.workspaceId, outletId: outlet.id, actorUserId: userId, action: 'venue.table.create', entityType: 'restaurant_table', entityId: row?.id ?? null, after: body });
      } catch (error) {
        if (isUniqueViolation(error)) throw nameTaken('table', body.label);
        throw error;
      }
    });
  }

  async updateTable(ws: ScopedWorkspace, outletId: string, tableId: string, body: UpdateTableRequest, userId: string): Promise<PosVenue> {
    return this.write(ws, outletId, async (tx, outlet) => {
      const table = await this.table(tx, outlet, tableId);
      if (body.areaId && body.areaId !== table.areaId) await this.area(tx, outlet, body.areaId);
      if (body.seats !== undefined && body.seats < table.seats) {
        const [session] = await tx
          .select({ guests: tableSessions.guestCount })
          .from(tableSessions)
          .where(and(eq(tableSessions.tableId, table.id), eq(tableSessions.status, 'open')))
          .limit(1);
        if (session && session.guests > body.seats) {
          throw new ConflictException(`A party of ${session.guests} is seated at ${table.label}, so it cannot be cut to ${plural(body.seats, 'seat')} now.`);
        }
      }
      try {
        await tx.update(restaurantTables).set({ ...body, updatedAt: new Date() }).where(eq(restaurantTables.id, table.id));
      } catch (error) {
        if (isUniqueViolation(error)) throw nameTaken('table', body.label ?? table.label);
        throw error;
      }
      await audit(tx, { workspaceId: outlet.workspaceId, outletId: outlet.id, actorUserId: userId, action: 'venue.table.update', entityType: 'restaurant_table', entityId: table.id, before: { label: table.label, seats: table.seats, areaId: table.areaId }, after: body });
    });
  }

  async archiveTable(ws: ScopedWorkspace, outletId: string, tableId: string, userId: string): Promise<PosVenue> {
    return this.write(ws, outletId, async (tx, outlet) => {
      const table = await this.table(tx, outlet, tableId);
      const [session] = await tx
        .select({ id: tableSessions.id })
        .from(tableSessions)
        .where(and(eq(tableSessions.tableId, table.id), eq(tableSessions.status, 'open')))
        .limit(1);
      if (session) throw new ConflictException(`${table.label} has guests seated. Release the table before archiving it.`);
      if ((TABLE_IN_USE as readonly string[]).includes(table.status)) {
        throw new ConflictException(`${table.label} is ${table.status.replace('_', ' ')}. Free the table before archiving it.`);
      }
      const [{ n } = { n: 0 }] = await tx
        .select({ n: count() })
        .from(posOrders)
        .innerJoin(tableSessions, eq(tableSessions.id, posOrders.tableSessionId))
        .where(and(eq(tableSessions.tableId, table.id), notInArray(posOrders.status, ['completed', 'cancelled'])));
      if (n > 0) throw new ConflictException(`${table.label} still has ${plural(n, 'unfinished order')}. Settle or cancel them first.`);
      await tx.update(restaurantTables).set({ archivedAt: new Date(), updatedAt: new Date() }).where(eq(restaurantTables.id, table.id));
      await audit(tx, { workspaceId: outlet.workspaceId, outletId: outlet.id, actorUserId: userId, action: 'venue.table.archive', entityType: 'restaurant_table', entityId: table.id, before: { label: table.label, seats: table.seats } });
    });
  }

  // ── Preparation stations ─────────────────────────────────────────────────────────────────────────

  async createStation(ws: ScopedWorkspace, outletId: string, body: CreateStationRequest, userId: string): Promise<PosVenue> {
    return this.write(ws, outletId, async (tx, outlet) => {
      try {
        const [row] = await tx
          .insert(preparationStations)
          .values({ workspaceId: outlet.workspaceId, outletId: outlet.id, name: body.name, kind: body.kind, printerName: body.printerName || null, sortOrder: body.sortOrder ?? (await this.nextSort(tx, preparationStations, outlet)) })
          .returning({ id: preparationStations.id });
        await audit(tx, { workspaceId: outlet.workspaceId, outletId: outlet.id, actorUserId: userId, action: 'venue.station.create', entityType: 'preparation_station', entityId: row?.id ?? null, after: body });
      } catch (error) {
        if (isUniqueViolation(error)) throw nameTaken('station', body.name);
        throw error;
      }
    });
  }

  async updateStation(ws: ScopedWorkspace, outletId: string, stationId: string, body: UpdateStationRequest, userId: string): Promise<PosVenue> {
    return this.write(ws, outletId, async (tx, outlet) => {
      const station = await this.station(tx, outlet, stationId);
      const { printerName, ...rest } = body;
      try {
        await tx
          .update(preparationStations)
          .set({ ...rest, ...(printerName !== undefined ? { printerName: printerName || null } : {}), updatedAt: new Date() })
          .where(eq(preparationStations.id, station.id));
      } catch (error) {
        if (isUniqueViolation(error)) throw nameTaken('station', body.name ?? station.name);
        throw error;
      }
      await audit(tx, { workspaceId: outlet.workspaceId, outletId: outlet.id, actorUserId: userId, action: 'venue.station.update', entityType: 'preparation_station', entityId: station.id, before: { name: station.name, kind: station.kind, printerName: station.printerName }, after: body });
    });
  }

  async archiveStation(ws: ScopedWorkspace, outletId: string, stationId: string, userId: string): Promise<PosVenue> {
    return this.write(ws, outletId, async (tx, outlet) => {
      const station = await this.station(tx, outlet, stationId);
      const [{ routed } = { routed: 0 }] = await tx.select({ routed: count() }).from(posItemRoutes).where(eq(posItemRoutes.stationId, station.id));
      if (routed > 0) throw new ConflictException(`${station.name} prepares ${plural(routed, 'menu item')}. Send them to another station first.`);
      const [{ open } = { open: 0 }] = await tx
        .select({ open: count() })
        .from(kitchenTickets)
        .where(and(eq(kitchenTickets.stationId, station.id), inArray(kitchenTickets.status, [...OPEN_TICKET])));
      if (open > 0) throw new ConflictException(`${station.name} still has ${plural(open, 'open ticket')}. Finish or cancel them first.`);
      await tx.update(preparationStations).set({ archivedAt: new Date(), updatedAt: new Date() }).where(eq(preparationStations.id, station.id));
      await audit(tx, { workspaceId: outlet.workspaceId, outletId: outlet.id, actorUserId: userId, action: 'venue.station.archive', entityType: 'preparation_station', entityId: station.id, before: { name: station.name, kind: station.kind } });
    });
  }

  // ── Registers ────────────────────────────────────────────────────────────────────────────────────

  async createRegister(ws: ScopedWorkspace, outletId: string, body: CreateRegisterRequest, userId: string): Promise<PosVenue> {
    return this.write(ws, outletId, async (tx, outlet) => {
      try {
        const [row] = await tx
          .insert(posRegisters)
          .values({ workspaceId: outlet.workspaceId, outletId: outlet.id, name: body.name, deviceLabel: body.deviceLabel || null })
          .returning({ id: posRegisters.id });
        await audit(tx, { workspaceId: outlet.workspaceId, outletId: outlet.id, actorUserId: userId, action: 'venue.register.create', entityType: 'pos_register', entityId: row?.id ?? null, after: body });
      } catch (error) {
        if (isUniqueViolation(error)) throw nameTaken('register', body.name);
        throw error;
      }
    });
  }

  async updateRegister(ws: ScopedWorkspace, outletId: string, registerId: string, body: UpdateRegisterRequest, userId: string): Promise<PosVenue> {
    return this.write(ws, outletId, async (tx, outlet) => {
      const register = await this.register(tx, outlet, registerId);
      const { deviceLabel, ...rest } = body;
      try {
        await tx
          .update(posRegisters)
          .set({ ...rest, ...(deviceLabel !== undefined ? { deviceLabel: deviceLabel || null } : {}), updatedAt: new Date() })
          .where(eq(posRegisters.id, register.id));
      } catch (error) {
        if (isUniqueViolation(error)) throw nameTaken('register', body.name ?? register.name);
        throw error;
      }
      await audit(tx, { workspaceId: outlet.workspaceId, outletId: outlet.id, actorUserId: userId, action: 'venue.register.update', entityType: 'pos_register', entityId: register.id, before: { name: register.name, deviceLabel: register.deviceLabel }, after: body });
    });
  }

  async archiveRegister(ws: ScopedWorkspace, outletId: string, registerId: string, userId: string): Promise<PosVenue> {
    return this.write(ws, outletId, async (tx, outlet) => {
      const register = await this.register(tx, outlet, registerId);
      const [shift] = await tx
        .select({ id: cashierShifts.id })
        .from(cashierShifts)
        .where(and(eq(cashierShifts.registerId, register.id), eq(cashierShifts.status, 'open')))
        .limit(1);
      if (shift) throw new ConflictException(`${register.name} has a shift open. Close the shift before archiving the register.`);
      await tx.update(posRegisters).set({ archivedAt: new Date(), updatedAt: new Date() }).where(eq(posRegisters.id, register.id));
      await audit(tx, { workspaceId: outlet.workspaceId, outletId: outlet.id, actorUserId: userId, action: 'venue.register.archive', entityType: 'pos_register', entityId: register.id, before: { name: register.name } });
    });
  }

  // ── Item routing ─────────────────────────────────────────────────────────────────────────────────

  /** Send a menu item's tickets to a station, or (null) to none. */
  async setRoute(ws: ScopedWorkspace, outletId: string, body: SetItemRouteRequest, userId: string): Promise<PosVenue> {
    return this.write(ws, outletId, async (tx, outlet) => {
      const [item] = await tx
        .select({ id: serviceItems.id, name: serviceItems.name })
        .from(serviceItems)
        .leftJoin(serviceCategories, eq(serviceCategories.id, serviceItems.serviceCategoryId))
        .where(and(eq(serviceItems.id, body.serviceItemId), itemInOutlet(outlet.id), eq(serviceItems.workspaceId, outlet.workspaceId), ne(serviceItems.status, 'archived')))
        .limit(1);
      if (!item) throw new NotFoundException('That menu item is not available to you.');
      const [current] = await tx.select({ stationId: posItemRoutes.stationId }).from(posItemRoutes).where(eq(posItemRoutes.serviceItemId, item.id)).limit(1);
      if (body.stationId) {
        const station = await this.station(tx, outlet, body.stationId);
        await tx
          .insert(posItemRoutes)
          .values({ serviceItemId: item.id, workspaceId: outlet.workspaceId, stationId: station.id })
          .onConflictDoUpdate({ target: posItemRoutes.serviceItemId, set: { stationId: station.id } });
      } else {
        await tx.delete(posItemRoutes).where(eq(posItemRoutes.serviceItemId, item.id));
      }
      await audit(tx, { workspaceId: outlet.workspaceId, outletId: outlet.id, actorUserId: userId, action: 'venue.route.set', entityType: 'service_item', entityId: item.id, before: { stationId: current?.stationId ?? null }, after: { stationId: body.stationId } });
    });
  }

  // ── Plumbing ─────────────────────────────────────────────────────────────────────────────────────

  /** One transaction: the outlet is checked first, the change runs, and the fresh picture is read before commit. */
  private async write(ws: ScopedWorkspace, outletId: string, change: (tx: Tx, outlet: OutletRow) => Promise<void>): Promise<PosVenue> {
    return this.db.transaction(async (tx) => {
      const outlet = await outletInScope(tx, ws, outletId);
      await change(tx, outlet);
      return this.read(tx, outlet);
    });
  }

  private async nextSort(
    tx: Tx,
    table: typeof diningAreas | typeof restaurantTables | typeof preparationStations,
    outlet: OutletRow,
  ): Promise<number> {
    const [row] = await tx
      .select({ top: sql<number>`coalesce(max(${table.sortOrder}), 0)::int` })
      .from(table)
      .where(and(eq(table.outletId, outlet.id), eq(table.workspaceId, outlet.workspaceId)));
    return Math.min(9999, (row?.top ?? 0) + 10);
  }

  private async area(tx: Tx, outlet: OutletRow, id: string): Promise<typeof diningAreas.$inferSelect> {
    const [row] = await tx
      .select()
      .from(diningAreas)
      .where(and(eq(diningAreas.id, id), eq(diningAreas.outletId, outlet.id), eq(diningAreas.workspaceId, outlet.workspaceId), isNull(diningAreas.archivedAt)))
      .limit(1)
      .for('update');
    if (!row) throw new NotFoundException('That dining area is not available to you.');
    return row;
  }

  private async table(tx: Tx, outlet: OutletRow, id: string): Promise<typeof restaurantTables.$inferSelect> {
    const [row] = await tx
      .select()
      .from(restaurantTables)
      .where(and(eq(restaurantTables.id, id), eq(restaurantTables.outletId, outlet.id), eq(restaurantTables.workspaceId, outlet.workspaceId), isNull(restaurantTables.archivedAt)))
      .limit(1)
      .for('update');
    if (!row) throw new NotFoundException('That table is not available to you.');
    return row;
  }

  private async station(tx: Tx, outlet: OutletRow, id: string): Promise<typeof preparationStations.$inferSelect> {
    const [row] = await tx
      .select()
      .from(preparationStations)
      .where(and(eq(preparationStations.id, id), eq(preparationStations.outletId, outlet.id), eq(preparationStations.workspaceId, outlet.workspaceId), isNull(preparationStations.archivedAt)))
      .limit(1)
      .for('update');
    if (!row) throw new NotFoundException('That station is not available to you.');
    return row;
  }

  private async register(tx: Tx, outlet: OutletRow, id: string): Promise<typeof posRegisters.$inferSelect> {
    const [row] = await tx
      .select()
      .from(posRegisters)
      .where(and(eq(posRegisters.id, id), eq(posRegisters.outletId, outlet.id), eq(posRegisters.workspaceId, outlet.workspaceId), isNull(posRegisters.archivedAt)))
      .limit(1)
      .for('update');
    if (!row) throw new NotFoundException('That register is not available to you.');
    return row;
  }
}

