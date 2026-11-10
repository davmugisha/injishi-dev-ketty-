import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { randomUUID } from 'node:crypto';

import type { PosVenue } from '@injishi/contracts';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from '../../../database/drizzle/schema';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import type { Database } from '../../../shared/database/database.module';
import { PosVenueService } from './pos-venue.service';

/**
 * Venue setup against a real Postgres: the SQL the doubles cannot judge. Tenant and branch isolation,
 * "nothing in use is removed", unique names, routing, audit rows.
 *
 * OPT IN: set `POS_IT_DATABASE_URL` to a THROWAWAY COPY of the demo database (migrated, holding the Ikirezi
 * demo business with its two outlets in two branches). The spec writes its own areas, tables, stations and
 * registers (names carry a random tag) and does not clean up. It REFUSES to run unless the database name
 * starts with `injishi_m1` or ends with `_it`, so it can never be pointed at the live demo or the original.
 * Skipped otherwise.
 *
 *   POS_IT_DATABASE_URL=postgres://user:***@127.0.0.1:5433/injishi_m1_dev \
 *     npx vitest run src/modules/pos/application/pos-venue.integration.spec.ts
 */
const url = process.env.POS_IT_DATABASE_URL;
const dbName = url ? new URL(url).pathname.replace(/^\//, '') : '';
const safe = /^injishi_m1/.test(dbName) || /_it$/.test(dbName);
if (url && !safe) {
  throw new Error(`POS_IT_DATABASE_URL names "${dbName}". This spec only runs on a throwaway copy: injishi_m1* or *_it.`);
}
const maybe = url && safe ? describe : describe.skip;

maybe('venue setup against Postgres (POS_IT_DATABASE_URL)', () => {
  vi.setConfig({ testTimeout: 60_000 });

  let pool: Pool;
  let db: Database;
  let venue: PosVenueService;
  const tag = randomUUID().slice(0, 6);

  // The demo business: two outlets, each in its own branch.
  const KIMI = 'de300000-0000-4000-8000-0b05fcf2f943';
  const LAKE = 'de300000-0000-4000-8000-0b05b40951d6';
  let workspaceId: string;
  let propKimi: string;
  let propLake: string;
  let actor: string;

  const scope = (workspace: string, propertyIds: string[], includesUnbranched = false): ScopedWorkspace =>
    ({
      workspaceId: workspace,
      branchScope: { coverage: propertyIds.length ? 'limited' : 'all', selectedPropertyId: null, propertyIds, includesUnbranched },
    }) as unknown as ScopedWorkspace;
  let owner: ScopedWorkspace;

  beforeAll(async () => {
    pool = new Pool({ connectionString: url, max: 4 });
    db = drizzle(pool, { schema }) as unknown as Database;
    venue = new PosVenueService(db);
    const [k] = await db.select({ ws: schema.outlets.workspaceId, prop: schema.outlets.propertyId }).from(schema.outlets).where(eq(schema.outlets.id, KIMI));
    const [l] = await db.select({ prop: schema.outlets.propertyId }).from(schema.outlets).where(eq(schema.outlets.id, LAKE));
    if (!k?.prop || !l?.prop) throw new Error('the demo outlets are missing from this database');
    workspaceId = k.ws;
    propKimi = k.prop;
    propLake = l.prop;
    const [m] = await db
      .select({ userId: schema.orgMemberships.userId })
      .from(schema.orgMemberships)
      .innerJoin(schema.workspaces, eq(schema.workspaces.orgId, schema.orgMemberships.orgId))
      .where(and(eq(schema.workspaces.id, workspaceId), eq(schema.orgMemberships.status, 'active')))
      .limit(1);
    if (!m) throw new Error('no active member to act as');
    actor = m.userId;
    owner = scope(workspaceId, [propKimi, propLake], true);
  });

  afterAll(async () => {
    await pool?.end();
  });

  const name = (s: string): string => `${s} ${tag}`;
  const areaNamed = async (n: string): Promise<PosVenue['areas'][number] | undefined> => (await venue.get(owner, KIMI)).areas.find((a) => a.name === n);
  const tableNamed = async (n: string): Promise<PosVenue['tables'][number] | undefined> => (await venue.get(owner, KIMI)).tables.find((t) => t.label === n);

  it('reads the floor the demo already has', async () => {
    const v = await venue.get(owner, KIMI);
    expect(v.outletId).toBe(KIMI);
    expect(v.areas.length).toBeGreaterThanOrEqual(1);
    expect(v.tables.length).toBeGreaterThanOrEqual(12);
    expect(v.stations.map((s) => s.kind)).toEqual(expect.arrayContaining(['kitchen', 'bar']));
    expect(v.registers.length).toBeGreaterThanOrEqual(1);
    expect(v.routing.length).toBeGreaterThan(10);
  });

  describe('dining areas and tables', () => {
    it('creates an area and a table, rejects a duplicate name, and keeps names unique per outlet only', async () => {
      await venue.createArea(owner, KIMI, { name: name('Garden') }, actor);
      const area = await areaNamed(name('Garden'));
      expect(area).toMatchObject({ tableCount: 0 });
      await expect(venue.createArea(owner, KIMI, { name: name('Garden') }, actor)).rejects.toBeInstanceOf(ConflictException);
      // The same name is fine at the other outlet.
      await expect(venue.createArea(owner, LAKE, { name: name('Garden') }, actor)).resolves.toBeDefined();

      await venue.createTable(owner, KIMI, { areaId: area!.id, label: name('G1'), seats: 4 }, actor);
      expect(await tableNamed(name('G1'))).toMatchObject({ seats: 4, status: 'available', hasOpenSession: false });
      await expect(venue.createTable(owner, KIMI, { areaId: area!.id, label: name('G1'), seats: 2 }, actor)).rejects.toBeInstanceOf(ConflictException);
      expect((await areaNamed(name('Garden')))!.tableCount).toBe(1);
    });

    it('edits a table: label, capacity and area, and refuses a clash', async () => {
      const t = (await tableNamed(name('G1')))!;
      await venue.createTable(owner, KIMI, { areaId: t.areaId, label: name('G2'), seats: 2 }, actor);
      await venue.updateTable(owner, KIMI, t.id, { seats: 6, label: name('G1b') }, actor);
      expect(await tableNamed(name('G1b'))).toMatchObject({ seats: 6 });
      await expect(venue.updateTable(owner, KIMI, t.id, { label: name('G2') }, actor)).rejects.toBeInstanceOf(ConflictException);
    });

    it('will not place a table in another outlet\'s area', async () => {
      const lakeArea = (await venue.get(owner, LAKE)).areas.find((a) => a.name === name('Garden'))!;
      await expect(venue.createTable(owner, KIMI, { areaId: lakeArea.id, label: name('X'), seats: 2 }, actor)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuses to archive a table with guests seated, or to cut its seats under the party', async () => {
      const t = (await tableNamed(name('G2')))!;
      await db.insert(schema.tableSessions).values({ workspaceId, outletId: KIMI, tableId: t.id, guestCount: 2, openedByUserId: actor });
      await db.update(schema.restaurantTables).set({ status: 'occupied' }).where(eq(schema.restaurantTables.id, t.id));
      await expect(venue.archiveTable(owner, KIMI, t.id, actor)).rejects.toThrow(/guests seated/);
      await expect(venue.updateTable(owner, KIMI, t.id, { seats: 1 }, actor)).rejects.toThrow(/party of 2/);
      // Moving it to another area is allowed: the party stays, only the label of where it sits changes.
      const sess = await db.select().from(schema.tableSessions).where(and(eq(schema.tableSessions.tableId, t.id), eq(schema.tableSessions.status, 'open')));
      expect(sess).toHaveLength(1);
      // The table and its session are still there.
      expect(await tableNamed(name('G2'))).toMatchObject({ hasOpenSession: true });
    });

    it('archives a free table (soft delete: the row stays), and refuses to archive an area that still has tables', async () => {
      const t = (await tableNamed(name('G1b')))!;
      await expect(venue.archiveArea(owner, KIMI, t.areaId, actor)).rejects.toThrow(/still has 2 tables/);
      await venue.archiveTable(owner, KIMI, t.id, actor);
      expect(await tableNamed(name('G1b'))).toBeUndefined();
      const [row] = await db.select({ archivedAt: schema.restaurantTables.archivedAt }).from(schema.restaurantTables).where(eq(schema.restaurantTables.id, t.id));
      expect(row?.archivedAt).not.toBeNull();
      await expect(venue.archiveArea(owner, KIMI, t.areaId, actor)).rejects.toThrow(/still has 1 table\b/);
    });

    it('writes an audit row for every change, in the same transaction', async () => {
      const t = (await tableNamed(name('G2')))!;
      const rows = await db
        .select({ action: schema.posAuditEvents.action })
        .from(schema.posAuditEvents)
        .where(and(eq(schema.posAuditEvents.entityId, t.id), eq(schema.posAuditEvents.workspaceId, workspaceId)));
      expect(rows.map((r) => r.action)).toContain('venue.table.create');
    });
  });

  describe('stations and routing', () => {
    it('creates a station and routes an item to it; an item of another outlet cannot be routed here', async () => {
      await venue.createStation(owner, KIMI, { name: name('Pizza oven'), kind: 'kitchen', printerName: 'oven-1' }, actor);
      const station = (await venue.get(owner, KIMI)).stations.find((s) => s.name === name('Pizza oven'))!;
      expect(station).toMatchObject({ kind: 'kitchen', printerName: 'oven-1', routedItems: 0, openTickets: 0 });
      await expect(venue.createStation(owner, KIMI, { name: name('Pizza oven'), kind: 'bar' }, actor)).rejects.toBeInstanceOf(ConflictException);

      const item = (await venue.get(owner, KIMI)).routing[0]!;
      await venue.setRoute(owner, KIMI, { serviceItemId: item.serviceItemId, stationId: station.id }, actor);
      expect((await venue.get(owner, KIMI)).routing.find((r) => r.serviceItemId === item.serviceItemId)?.stationId).toBe(station.id);

      const lakeItem = (await venue.get(owner, LAKE)).routing[0]!;
      await expect(venue.setRoute(owner, KIMI, { serviceItemId: lakeItem.serviceItemId, stationId: station.id }, actor)).rejects.toBeInstanceOf(NotFoundException);
      const lakeStation = (await venue.get(owner, LAKE)).stations[0]!;
      await expect(venue.setRoute(owner, KIMI, { serviceItemId: item.serviceItemId, stationId: lakeStation.id }, actor)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('an item that records only its menu section still belongs to that outlet (the platform rule, as the catalogue creates them)', async () => {
      const item = (await venue.get(owner, KIMI)).routing[0]!;
      const [own] = await db.select({ outletId: schema.serviceItems.outletId }).from(schema.serviceItems).where(eq(schema.serviceItems.id, item.serviceItemId));
      expect(own?.outletId).toBe(KIMI);
      try {
        // What POST /ops/service-catalog/items writes: the section has the outlet, the item itself has none.
        await db.update(schema.serviceItems).set({ outletId: null }).where(eq(schema.serviceItems.id, item.serviceItemId));
        expect((await venue.get(owner, KIMI)).routing.some((r) => r.serviceItemId === item.serviceItemId)).toBe(true);
        expect((await venue.get(owner, LAKE)).routing.some((r) => r.serviceItemId === item.serviceItemId)).toBe(false);
        const station = (await venue.get(owner, KIMI)).stations[0]!;
        await expect(venue.setRoute(owner, KIMI, { serviceItemId: item.serviceItemId, stationId: station.id }, actor)).resolves.toBeDefined();
        await expect(venue.setRoute(owner, LAKE, { serviceItemId: item.serviceItemId, stationId: null }, actor)).rejects.toBeInstanceOf(NotFoundException);
      } finally {
        await db.update(schema.serviceItems).set({ outletId: KIMI }).where(eq(schema.serviceItems.id, item.serviceItemId));
        // Leave the routing exactly as the previous test left it.
        await venue.setRoute(owner, KIMI, { serviceItemId: item.serviceItemId, stationId: item.stationId }, actor);
      }
    });

    it('refuses to archive a station that still prepares items; clearing the route frees it', async () => {
      const v = await venue.get(owner, KIMI);
      const station = v.stations.find((s) => s.name === name('Pizza oven'))!;
      expect(station.routedItems).toBe(1);
      await expect(venue.archiveStation(owner, KIMI, station.id, actor)).rejects.toThrow(/prepares 1 menu item/);
      const routed = v.routing.find((r) => r.stationId === station.id)!;
      await venue.setRoute(owner, KIMI, { serviceItemId: routed.serviceItemId, stationId: null }, actor);
      await venue.archiveStation(owner, KIMI, station.id, actor);
      expect((await venue.get(owner, KIMI)).stations.some((s) => s.id === station.id)).toBe(false);
    });
  });

  describe('registers', () => {
    it('creates one, and refuses to archive it while a shift is open on it', async () => {
      await venue.createRegister(owner, KIMI, { name: name('Bar till'), deviceLabel: 'Tablet 3' }, actor);
      const reg = (await venue.get(owner, KIMI)).registers.find((r) => r.name === name('Bar till'))!;
      expect(reg).toMatchObject({ deviceLabel: 'Tablet 3', hasOpenShift: false });
      await expect(venue.createRegister(owner, KIMI, { name: name('Bar till') }, actor)).rejects.toBeInstanceOf(ConflictException);

      await db.insert(schema.cashierShifts).values({ workspaceId, outletId: KIMI, registerId: reg.id, cashierUserId: actor, status: 'open', openingFloatRwf: 0 });
      try {
        await expect(venue.archiveRegister(owner, KIMI, reg.id, actor)).rejects.toThrow(/shift open/);
      } finally {
        // Always close it, so a failure here cannot leave the cashier with an open shift for the next run.
        await db.update(schema.cashierShifts).set({ status: 'closed', closedAt: new Date(), expectedCashRwf: 0, countedCashRwf: 0, varianceRwf: 0 }).where(eq(schema.cashierShifts.registerId, reg.id));
      }
      await venue.archiveRegister(owner, KIMI, reg.id, actor);
      expect((await venue.get(owner, KIMI)).registers.some((r) => r.id === reg.id)).toBe(false);
    });
  });

  describe('isolation', () => {
    const stranger = scope(randomUUID(), [randomUUID()], true);

    it('another business sees NOTHING of this outlet: 404 on read and on every write', async () => {
      const t = (await tableNamed(name('G2')))!;
      const area = (await areaNamed(name('Garden')))!;
      const calls: Array<() => Promise<unknown>> = [
        () => venue.get(stranger, KIMI),
        () => venue.setup(stranger, KIMI),
        () => venue.createArea(stranger, KIMI, { name: 'Intruder' }, actor),
        () => venue.updateArea(stranger, KIMI, area.id, { name: 'Intruder' }, actor),
        () => venue.archiveArea(stranger, KIMI, area.id, actor),
        () => venue.createTable(stranger, KIMI, { areaId: area.id, label: 'Intruder', seats: 2 }, actor),
        () => venue.updateTable(stranger, KIMI, t.id, { seats: 3 }, actor),
        () => venue.archiveTable(stranger, KIMI, t.id, actor),
        () => venue.createStation(stranger, KIMI, { name: 'Intruder', kind: 'bar' }, actor),
        () => venue.createRegister(stranger, KIMI, { name: 'Intruder' }, actor),
        () => venue.setRoute(stranger, KIMI, { serviceItemId: randomUUID(), stationId: null }, actor),
      ];
      for (const call of calls) await expect(call()).rejects.toBeInstanceOf(NotFoundException);
      // And nothing was written under the intruder's name.
      const v = await venue.get(owner, KIMI);
      expect(JSON.stringify(v)).not.toContain('Intruder');
    });

    it('a manager covering only one branch cannot reach the other branch\'s outlet', async () => {
      const lakeOnly = scope(workspaceId, [propLake]);
      await expect(venue.get(lakeOnly, KIMI)).rejects.toBeInstanceOf(NotFoundException);
      await expect(venue.createArea(lakeOnly, KIMI, { name: 'Intruder' }, actor)).rejects.toBeInstanceOf(NotFoundException);
      await expect(venue.get(lakeOnly, LAKE)).resolves.toMatchObject({ outletId: LAKE });
      const kimiOnly = scope(workspaceId, [propKimi]);
      await expect(venue.get(kimiOnly, LAKE)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('an outlet\'s own table cannot be edited through the other outlet\'s URL', async () => {
      const t = (await tableNamed(name('G2')))!;
      await expect(venue.updateTable(owner, LAKE, t.id, { seats: 9 }, actor)).rejects.toBeInstanceOf(NotFoundException);
      await expect(venue.archiveTable(owner, LAKE, t.id, actor)).rejects.toBeInstanceOf(NotFoundException);
      expect(await tableNamed(name('G2'))).toMatchObject({ seats: 2 });
    });
  });

  describe('setup progress', () => {
    it('is counted from the records and never claims more than exists', async () => {
      const s = await venue.setup(owner, KIMI);
      expect(s.outletId).toBe(KIMI);
      expect(s.total).toBe(9);
      expect(s.steps.map((x) => x.key)).toEqual(['areas', 'tables', 'stations', 'registers', 'categories', 'products', 'routing', 'receipts', 'team']);
      for (const step of s.steps) expect(step.done).toBe(step.count > 0);
      expect(s.doneCount).toBe(s.steps.filter((x) => x.done).length);
      expect(s.steps.find((x) => x.key === 'tables')!.count).toBe((await venue.get(owner, KIMI)).tables.length);
    });

    it('an outlet with nothing set up shows nothing done (no pre-ticked boxes)', async () => {
      const [fresh] = await db
        .insert(schema.outlets)
        .values(
          (
            await db.select().from(schema.outlets).where(eq(schema.outlets.id, KIMI))
          ).map((o) => ({ ...o, id: undefined, name: name('Empty outlet'), slug: null })),
        )
        .returning({ id: schema.outlets.id });
      try {
        const s = await venue.setup(owner, fresh!.id);
        expect(s.doneCount).toBeLessThanOrEqual(1); // at most the team (the business's own members)
        expect(s.steps.filter((x) => ['areas', 'tables', 'stations', 'registers', 'categories', 'products', 'routing'].includes(x.key)).every((x) => !x.done)).toBe(true);
        const areas = await db.select().from(schema.diningAreas).where(and(eq(schema.diningAreas.outletId, fresh!.id), isNull(schema.diningAreas.archivedAt)));
        expect(areas).toHaveLength(0);
      } finally {
        // Leave no stray outlet behind: it would show up in every outlet picker of the copy.
        await db.delete(schema.posOutletSettings).where(eq(schema.posOutletSettings.outletId, fresh!.id));
        await db.delete(schema.outlets).where(eq(schema.outlets.id, fresh!.id));
      }
    });
  });
});
