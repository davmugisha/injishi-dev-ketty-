import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, getTableColumns, inArray, ne, notInArray, sql, type SQL } from 'drizzle-orm';

import {
  leases,
  properties,
  propertyBlocks,
  rentalUnits,
  tenants,
} from '../../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import type { UnitLeaseFacts } from '../domain/units';
import type { DbOrTx } from './rentals-writers';

export type RentalUnitRow = typeof rentalUnits.$inferSelect;
export type BlockRow = typeof propertyBlocks.$inferSelect;

/** A unit with the names it is shown with. */
export interface UnitListRow extends RentalUnitRow {
  propertyName: string;
  blockCode: string | null;
  blockName: string | null;
}

/**
 * Units (`rental_units`) and the blocks they stand in (blueprint 1.2). A unit
 * stands alone: no hotel room, room type or rate plan is made for it. Every
 * read is by workspace; the branch filter is the caller's.
 */
@Injectable()
export class UnitsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  // The columns a unit is read with; drizzle infers the selection type.
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  private unitColumns() {
    return {
      ...getTableColumns(rentalUnits),
      propertyName: properties.name,
      blockCode: propertyBlocks.code,
      blockName: propertyBlocks.name,
    };
  }

  async list(workspaceId: string, scope: SQL | null): Promise<UnitListRow[]> {
    return this.db
      .select(this.unitColumns())
      .from(rentalUnits)
      .innerJoin(properties, eq(properties.id, rentalUnits.propertyId))
      .leftJoin(propertyBlocks, eq(propertyBlocks.id, rentalUnits.blockId))
      .where(and(eq(rentalUnits.workspaceId, workspaceId), scope ?? undefined))
      .orderBy(asc(properties.name), sql`lower(${propertyBlocks.code}) nulls first`, sql`lower(${rentalUnits.label})`);
  }

  async find(id: string, db: DbOrTx = this.db): Promise<UnitListRow | null> {
    const [row] = await db
      .select(this.unitColumns())
      .from(rentalUnits)
      .innerJoin(properties, eq(properties.id, rentalUnits.propertyId))
      .leftJoin(propertyBlocks, eq(propertyBlocks.id, rentalUnits.blockId))
      .where(eq(rentalUnits.id, id))
      .limit(1);
    return row ?? null;
  }

  async findMany(ids: readonly string[]): Promise<UnitListRow[]> {
    if (ids.length === 0) return [];
    return this.db
      .select(this.unitColumns())
      .from(rentalUnits)
      .innerJoin(properties, eq(properties.id, rentalUnits.propertyId))
      .leftJoin(propertyBlocks, eq(propertyBlocks.id, rentalUnits.blockId))
      .where(inArray(rentalUnits.id, [...ids]));
  }

  /** The leases that hold or held the units: everything but drafts and cancelled ones. */
  async leaseFacts(unitIds: readonly string[]): Promise<Map<string, UnitLeaseFacts[]>> {
    const out = new Map<string, UnitLeaseFacts[]>();
    if (unitIds.length === 0) return out;
    const rows = await this.db
      .select({
        unitId: leases.unitId,
        id: leases.id,
        reference: leases.reference,
        status: leases.status,
        tenantName: tenants.fullName,
        startDate: leases.startDate,
        endDate: leases.endDate,
        endedOn: leases.endedOn,
      })
      .from(leases)
      .innerJoin(tenants, eq(tenants.id, leases.tenantId))
      .where(and(inArray(leases.unitId, [...unitIds]), notInArray(leases.status, ['draft', 'cancelled'])));
    for (const { unitId, ...facts } of rows) {
      const list = out.get(unitId) ?? [];
      list.push(facts);
      out.set(unitId, list);
    }
    return out;
  }

  /** The labels already used in a building, compared without case. */
  async labelsTaken(propertyId: string, labels: readonly string[], exceptUnitId?: string): Promise<string[]> {
    if (labels.length === 0) return [];
    const lowered = labels.map((l) => l.trim().toLowerCase());
    const rows = await this.db
      .select({ label: rentalUnits.label })
      .from(rentalUnits)
      .where(
        and(
          eq(rentalUnits.propertyId, propertyId),
          inArray(sql`lower(${rentalUnits.label})`, lowered),
          exceptUnitId ? ne(rentalUnits.id, exceptUnitId) : undefined,
        ),
      );
    return rows.map((r) => r.label);
  }

  async insertMany(tx: DbOrTx, values: (typeof rentalUnits.$inferInsert)[]): Promise<string[]> {
    if (values.length === 0) return [];
    const rows = await tx.insert(rentalUnits).values(values).returning({ id: rentalUnits.id });
    return rows.map((r) => r.id);
  }

  async update(tx: DbOrTx, id: string, values: Partial<typeof rentalUnits.$inferInsert>): Promise<void> {
    await tx.update(rentalUnits).set({ ...values, updatedAt: new Date() }).where(eq(rentalUnits.id, id));
  }

  /** Leases on a unit that still hold it or may: drafts and the live statuses. */
  async openLeases(unitId: string): Promise<{ id: string; reference: string; status: string }[]> {
    return this.db
      .select({ id: leases.id, reference: leases.reference, status: leases.status })
      .from(leases)
      .where(and(eq(leases.unitId, unitId), inArray(leases.status, ['draft', 'pending_signature', 'signed', 'active', 'ending'])));
  }

  /** Draft leases on a unit: their contract names the unit, so they are rebuilt when it changes. */
  async draftLeaseIds(unitId: string): Promise<string[]> {
    const rows = await this.db
      .select({ id: leases.id })
      .from(leases)
      .where(and(eq(leases.unitId, unitId), eq(leases.status, 'draft')));
    return rows.map((r) => r.id);
  }

  // --- Blocks -------------------------------------------------------------------

  async blocks(workspaceId: string, scope: SQL | null): Promise<(BlockRow & { unitCount: number })[]> {
    return this.db
      .select({
        ...getTableColumns(propertyBlocks),
        // Qualified by hand: inside a select drizzle renders `${propertyBlocks.id}` as a bare
        // "id", which the subquery would read as the unit's own id.
        unitCount: sql<number>`(select count(*)::int from rental_units u where u.block_id = "property_blocks"."id" and u.state <> 'retired')`,
      })
      .from(propertyBlocks)
      .where(and(eq(propertyBlocks.workspaceId, workspaceId), scope ?? undefined))
      .orderBy(asc(propertyBlocks.sortOrder), sql`lower(${propertyBlocks.code})`);
  }

  async findBlock(id: string): Promise<BlockRow | null> {
    const [row] = await this.db.select().from(propertyBlocks).where(eq(propertyBlocks.id, id)).limit(1);
    return row ?? null;
  }

  async blockCodeTaken(propertyId: string, code: string, exceptBlockId?: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: propertyBlocks.id })
      .from(propertyBlocks)
      .where(
        and(
          eq(propertyBlocks.propertyId, propertyId),
          sql`lower(${propertyBlocks.code}) = ${code.trim().toLowerCase()}`,
          exceptBlockId ? ne(propertyBlocks.id, exceptBlockId) : undefined,
        ),
      )
      .limit(1);
    return Boolean(row);
  }

  async insertBlock(values: typeof propertyBlocks.$inferInsert): Promise<string> {
    const [row] = await this.db.insert(propertyBlocks).values(values).returning({ id: propertyBlocks.id });
    if (!row) throw new Error('block insert returned nothing');
    return row.id;
  }

  async updateBlock(id: string, values: Partial<typeof propertyBlocks.$inferInsert>): Promise<void> {
    await this.db.update(propertyBlocks).set({ ...values, updatedAt: new Date() }).where(eq(propertyBlocks.id, id));
  }

  /** Draft leases on units of a block: their contract names the block. */
  async draftLeaseIdsInBlock(blockId: string): Promise<string[]> {
    const rows = await this.db
      .select({ id: leases.id })
      .from(leases)
      .innerJoin(rentalUnits, eq(rentalUnits.id, leases.unitId))
      .where(and(eq(rentalUnits.blockId, blockId), eq(leases.status, 'draft')));
    return rows.map((r) => r.id);
  }
}
