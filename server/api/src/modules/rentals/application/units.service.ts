import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  UnitTab,
  type BlockList,
  type BlockView,
  type BulkUnitsRequest,
  type BulkUnitsResult,
  type CreateBlockRequest,
  type CreateUnitRequest,
  type RentalUnitList,
  type RentalUnitView,
  type UnitListQuery,
  type UpdateBlockRequest,
  type UpdateUnitRequest,
} from '@injishi/contracts';

import { propertyBlocks, rentalUnits } from '../../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { assertBuildingInScope, assertResidence, buildingFilter, coversBuilding, type ResidenceWorkspace } from '../domain/residence';
import { comparableLabel, unitTabsOf } from '../domain/units';
import { RentalsContextRepository } from '../infrastructure/rentals-context.repository';
import { RentalsAuditWriter } from '../infrastructure/rentals-writers';
import { UnitsRepository, type BlockRow, type UnitListRow } from '../infrastructure/units.repository';
import { LeaseContractService } from './lease-contract.service';
import { presentUnit } from './rentals-presenters';

/**
 * Units and blocks (blueprint 2.3, WP 1.5a). A unit is a `rental_units` row and
 * stands alone: adding one makes no hotel room, room type or rate plan. Its
 * asking rent is optional, but the database refuses to list a unit without
 * one. Occupied or vacant is worked out from its leases.
 *
 * A unit stands in a building (`properties`). A residence registration makes
 * none, so the first unit or block a landlord adds makes the business's first
 * building from its registered name and address; with several buildings the
 * request names one.
 */
@Injectable()
export class UnitsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly units: UnitsRepository,
    private readonly context: RentalsContextRepository,
    private readonly contracts: LeaseContractService,
    private readonly audit: RentalsAuditWriter,
  ) {}

  async list(ws: ScopedWorkspace, query: UnitListQuery): Promise<RentalUnitList> {
    const r = assertResidence(ws);
    const rows = await this.units.list(r.workspaceId, buildingFilter(rentalUnits.propertyId, ws.branchScope));
    const facts = await this.units.leaseFacts(rows.map((u) => u.id));
    const views = rows.map((row) => presentUnit(row, facts.get(row.id) ?? []));
    const counts = Object.fromEntries(UnitTab.options.map((t) => [t, 0])) as RentalUnitList['counts'];
    for (const v of views) for (const tab of unitTabsOf(v.state, v.occupancy)) counts[tab] = (counts[tab] ?? 0) + 1;
    const tab = query.tab ?? 'all';
    const q = query.q ? comparableLabel(query.q) : null;
    const units = views.filter(
      (v) =>
        unitTabsOf(v.state, v.occupancy).includes(tab) &&
        (!query.blockId || v.blockId === query.blockId) &&
        (!q ||
          comparableLabel(v.label).includes(q) ||
          (v.currentLease?.tenantName.toLowerCase().includes(q) ?? false) ||
          (v.blockName?.toLowerCase().includes(q) ?? false)),
    );
    return { units, counts };
  }

  async get(ws: ScopedWorkspace, id: string): Promise<RentalUnitView> {
    const row = await this.owned(ws, id);
    return this.view(row);
  }

  async create(ws: ScopedWorkspace, userId: string, body: CreateUnitRequest): Promise<RentalUnitView> {
    const [id] = await this.insert(ws, userId, body, [body.label]);
    return this.get(ws, id as string);
  }

  /** Several units with the same facts, named one by one. All or none. */
  async bulk(ws: ScopedWorkspace, userId: string, body: BulkUnitsRequest): Promise<BulkUnitsResult> {
    const ids = await this.insert(ws, userId, body, body.labels);
    const r = assertResidence(ws);
    const rows = await this.units.findMany(ids);
    const facts = await this.units.leaseFacts(ids);
    const byId = new Map(rows.filter((u) => u.workspaceId === r.workspaceId).map((u) => [u.id, u]));
    return {
      created: ids
        .map((id) => byId.get(id))
        .filter((u): u is UnitListRow => u !== undefined)
        .map((u) => presentUnit(u, facts.get(u.id) ?? [])),
    };
  }

  async update(ws: ScopedWorkspace, userId: string, id: string, body: UpdateUnitRequest): Promise<RentalUnitView> {
    const row = await this.owned(ws, id);
    if (row.state === 'retired') {
      throw new ConflictException({ code: 'unit_retired', current: 'retired', message: `Unit ${row.label} is retired, so it can't change.` });
    }
    if (body.blockId) await this.blockOf(ws, body.blockId, row.propertyId);
    if (body.label !== undefined && comparableLabel(body.label) !== comparableLabel(row.label)) {
      await this.assertLabelsFree(row.propertyId, row.propertyName, [body.label], row.id);
    }
    assertBrokerOffer(
      {
        brokerOffer: body.brokerOffer ?? (body.state === 'off_market' ? false : row.brokerOffer),
        askingRentRwf: body.askingRentRwf !== undefined ? body.askingRentRwf : row.askingRentRwf,
        brokerFeeKind: body.brokerFee !== undefined ? (body.brokerFee?.kind ?? null) : row.brokerFeeKind,
        state: body.state ?? row.state,
      },
      row.label,
    );
    if (body.askingRentRwf === null && row.listed) {
      throw new ConflictException({
        code: 'unit_listed',
        message: `Unit ${row.label} is listed. Take it off the listing before clearing its asking rent.`,
      });
    }
    await this.units
      .update(this.db, id, {
        ...(body.label !== undefined ? { label: body.label.trim() } : {}),
        ...(body.blockId !== undefined ? { blockId: body.blockId } : {}),
        ...(body.bedrooms !== undefined ? { bedrooms: body.bedrooms } : {}),
        ...(body.bathrooms !== undefined ? { bathrooms: body.bathrooms } : {}),
        ...(body.kitchen !== undefined ? { kitchen: body.kitchen } : {}),
        ...(body.furnished !== undefined ? { furnished: body.furnished } : {}),
        ...(body.floor !== undefined ? { floor: body.floor } : {}),
        ...(body.sizeSqm !== undefined ? { sizeSqm: body.sizeSqm } : {}),
        ...(body.askingRentRwf !== undefined ? { askingRentRwf: body.askingRentRwf } : {}),
        ...(body.askingDepositRwf !== undefined ? { askingDepositRwf: body.askingDepositRwf } : {}),
        ...(body.availableFrom !== undefined ? { availableFrom: body.availableFrom } : {}),
        ...(body.note !== undefined ? { note: body.note?.trim() || null } : {}),
        ...(body.state !== undefined
          ? { state: body.state, ...(body.state === 'off_market' ? { listed: false, brokerOffer: false } : {}) }
          : {}),
        ...brokerColumns(body),
      })
      .catch((cause: unknown) => {
        throw mapUnitConstraint(cause, row.label, row.propertyName);
      });
    // The contract of a draft names the unit and its block.
    if (body.label !== undefined || body.blockId !== undefined) {
      await this.contracts.refreshDrafts(await this.units.draftLeaseIds(id), userId);
    }
    return this.get(ws, id);
  }

  /**
   * Retire a unit for good: it stays on file for the leases it had, and can no
   * longer be let or listed. Refused while a lease holds it or a draft names it.
   */
  async retire(ws: ScopedWorkspace, userId: string, id: string): Promise<RentalUnitView> {
    const row = await this.owned(ws, id);
    if (row.state === 'retired') return this.view(row);
    const open = await this.units.openLeases(id);
    if (open.length > 0) {
      const lease = open[0] as { reference: string; status: string };
      throw new ConflictException({
        code: 'unit_has_lease',
        message:
          lease.status === 'draft'
            ? `Unit ${row.label} has a draft lease, ${lease.reference}. Cancel it first.`
            : `Unit ${row.label} has lease ${lease.reference}. A unit with a lease can't be retired until the tenancy ends.`,
      });
    }
    await this.db.transaction(async (tx) => {
      await this.units.update(tx, id, { state: 'retired', retiredAt: new Date(), listed: false, brokerOffer: false });
      await this.audit.write(tx, {
        actorUserId: userId,
        subjectType: 'rental_unit',
        subjectId: id,
        eventType: 'rental_unit.retired',
        diff: { label: row.label, from: row.state },
      });
    });
    return this.get(ws, id);
  }

  // --- Blocks ----------------------------------------------------------------------

  async blocks(ws: ScopedWorkspace): Promise<BlockList> {
    const r = assertResidence(ws);
    const rows = await this.units.blocks(r.workspaceId, buildingFilter(propertyBlocks.propertyId, ws.branchScope));
    return { blocks: rows.map(presentBlock) };
  }

  async createBlock(ws: ScopedWorkspace, body: CreateBlockRequest): Promise<BlockView> {
    const r = assertResidence(ws);
    const building = await this.building(ws, r, body.propertyId);
    if (await this.units.blockCodeTaken(building.id, body.code)) {
      throw new ConflictException({ code: 'block_code_taken', message: `There is already a block ${body.code.trim()} in ${building.name}.` });
    }
    const id = await this.units
      .insertBlock({
        workspaceId: r.workspaceId,
        propertyId: building.id,
        code: body.code.trim(),
        name: body.name.trim(),
        kind: body.kind?.trim() || null,
        sortOrder: body.sortOrder ?? 0,
      })
      .catch((cause: unknown) => {
        throw mapBlockConstraint(cause, body.code, building.name);
      });
    return this.blockView(ws, id);
  }

  async updateBlock(ws: ScopedWorkspace, userId: string, id: string, body: UpdateBlockRequest): Promise<BlockView> {
    const r = assertResidence(ws);
    const block = await this.units.findBlock(id);
    if (!block || block.workspaceId !== r.workspaceId) throw new NotFoundException('Block not found.');
    assertBuildingInScope(ws, block.propertyId, 'Block');
    if (body.code !== undefined && (await this.units.blockCodeTaken(block.propertyId, body.code, id))) {
      throw new ConflictException({ code: 'block_code_taken', message: `There is already a block ${body.code.trim()} in this building.` });
    }
    await this.units
      .updateBlock(id, {
        ...(body.code !== undefined ? { code: body.code.trim() } : {}),
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.kind !== undefined ? { kind: body.kind?.trim() || null } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
      })
      .catch((cause: unknown) => {
        throw mapBlockConstraint(cause, body.code ?? block.code, 'this building');
      });
    // A draft's contract names the unit's block by its code.
    if (body.code !== undefined) await this.contracts.refreshDrafts(await this.units.draftLeaseIdsInBlock(id), userId);
    return this.blockView(ws, id);
  }

  // --- Helpers ---------------------------------------------------------------------

  private async insert(
    ws: ScopedWorkspace,
    userId: string,
    body: Omit<CreateUnitRequest, 'label'>,
    labels: readonly string[],
  ): Promise<string[]> {
    const r = assertResidence(ws);
    const building = await this.building(ws, r, body.propertyId);
    if (body.blockId) await this.blockOf(ws, body.blockId, building.id);
    await this.assertLabelsFree(building.id, building.name, labels);
    const values = labels.map((label) => ({
      workspaceId: r.workspaceId,
      propertyId: building.id,
      blockId: body.blockId ?? null,
      label: label.trim(),
      bedrooms: body.bedrooms ?? null,
      bathrooms: body.bathrooms ?? null,
      kitchen: body.kitchen ?? null,
      furnished: body.furnished ?? false,
      floor: body.floor ?? null,
      sizeSqm: body.sizeSqm ?? null,
      askingRentRwf: body.askingRentRwf ?? null,
      askingDepositRwf: body.askingDepositRwf ?? null,
      availableFrom: body.availableFrom ?? null,
      note: body.note?.trim() || null,
      state: body.state ?? ('active' as const),
      ...brokerColumns(body),
    }));
    assertBrokerOffer(values[0] ?? {}, labels[0] ?? '');
    return this.db
      .transaction(async (tx) => {
        const ids = await this.units.insertMany(tx, values);
        for (const [i, id] of ids.entries()) {
          await this.audit.write(tx, {
            actorUserId: userId,
            subjectType: 'rental_unit',
            subjectId: id,
            eventType: 'rental_unit.added',
            diff: { label: values[i]?.label, propertyId: building.id, bulk: labels.length > 1 },
          });
        }
        return ids;
      })
      .catch((cause: unknown) => {
        throw mapUnitConstraint(cause, labels.length === 1 ? (labels[0] as string) : 'one of these units', building.name);
      });
  }

  /** The building a write is for: named, the one in view, or the only one (made from the business's address if none). */
  private async building(ws: ScopedWorkspace, r: ResidenceWorkspace, propertyId: string | undefined): Promise<{ id: string; name: string }> {
    const buildings = await this.context.buildings(r.workspaceId);
    if (propertyId) {
      const named = buildings.find((b) => b.id === propertyId);
      if (!named || !coversBuilding(ws.branchScope, named.id)) throw new NotFoundException('Building not found.');
      return named;
    }
    const inScope = buildings.filter((b) => coversBuilding(ws.branchScope, b.id));
    if (buildings.length === 0) return this.context.ensureBuilding(r);
    if (inScope.length === 1) return inScope[0] as { id: string; name: string };
    if (inScope.length === 0) throw new NotFoundException('Building not found.');
    throw new BadRequestException({
      message: 'Validation failed',
      issues: [{ code: 'custom', path: ['propertyId'], message: 'Pick the building the unit is in.' }],
    });
  }

  private async blockOf(ws: ScopedWorkspace, blockId: string, propertyId: string): Promise<BlockRow> {
    const block = await this.units.findBlock(blockId);
    if (!block || block.workspaceId !== ws.workspaceId) throw new NotFoundException('Block not found.');
    if (block.propertyId !== propertyId) {
      throw new BadRequestException({
        message: 'Validation failed',
        issues: [{ code: 'custom', path: ['blockId'], message: 'That block is in another building.' }],
      });
    }
    return block;
  }

  private async assertLabelsFree(propertyId: string, buildingName: string, labels: readonly string[], exceptUnitId?: string): Promise<void> {
    const taken = await this.units.labelsTaken(propertyId, labels, exceptUnitId);
    if (taken.length === 1) {
      throw new ConflictException({ code: 'unit_label_taken', message: `There is already a unit ${taken[0]} in ${buildingName}.` });
    }
    if (taken.length > 1) {
      throw new ConflictException({
        code: 'unit_label_taken',
        message: `${buildingName} already has units ${taken.slice(0, 5).join(', ')}${taken.length > 5 ? ' and more' : ''}. Pick other names.`,
      });
    }
  }

  private async owned(ws: ScopedWorkspace, id: string): Promise<UnitListRow> {
    const r = assertResidence(ws);
    const row = await this.units.find(id);
    if (!row || row.workspaceId !== r.workspaceId) throw new NotFoundException('Unit not found.');
    assertBuildingInScope(ws, row.propertyId, 'Unit');
    return row;
  }

  private async view(row: UnitListRow): Promise<RentalUnitView> {
    const facts = await this.units.leaseFacts([row.id]);
    return presentUnit(row, facts.get(row.id) ?? []);
  }

  private async blockView(ws: ScopedWorkspace, id: string): Promise<BlockView> {
    const all = await this.units.blocks(ws.workspaceId, null);
    const row = all.find((b) => b.id === id);
    if (!row) throw new NotFoundException('Block not found.');
    return presentBlock(row);
  }
}

function presentBlock(row: BlockRow & { unitCount: number }): BlockView {
  return {
    id: row.id,
    propertyId: row.propertyId,
    code: row.code,
    name: row.name,
    kind: row.kind,
    sortOrder: row.sortOrder,
    unitCount: Number(row.unitCount),
  };
}

function constraintOf(cause: unknown): { code?: string; constraint?: string } | null {
  let e = cause as { code?: string; constraint?: string; cause?: unknown } | null;
  while (e && typeof e === 'object' && !e.code && e.cause) e = e.cause as typeof e;
  return e && typeof e === 'object' ? e : null;
}

/** The database's refusals of a unit write, in words. */
function mapUnitConstraint(cause: unknown, label: string, buildingName: string): unknown {
  const e = constraintOf(cause);
  if (e?.code === '23505' && e.constraint === 'rental_units_property_label_uk') {
    return new ConflictException({ code: 'unit_label_taken', message: `There is already a unit ${label} in ${buildingName}.` });
  }
  if (e?.code === '23514' && e.constraint === 'rental_units_listed_shape') {
    return new ConflictException({ code: 'unit_listed', message: `Unit ${label} is listed. A listed unit needs an asking rent and must be available to let.` });
  }
  return cause;
}

function mapBlockConstraint(cause: unknown, code: string, where: string): unknown {
  const e = constraintOf(cause);
  if (e?.code === '23505' && e.constraint === 'property_blocks_property_code_uk') {
    return new ConflictException({ code: 'block_code_taken', message: `There is already a block ${code.trim()} in ${where}.` });
  }
  return cause;
}


/** The broker opt-in and fee columns a unit form sends; nothing when it sends neither. */
function brokerColumns(body: Pick<CreateUnitRequest, 'brokerOffer' | 'brokerFee'>): Partial<typeof rentalUnits.$inferInsert> {
  return {
    ...(body.brokerOffer !== undefined ? { brokerOffer: body.brokerOffer } : {}),
    ...(body.brokerFee !== undefined
      ? {
          brokerFeeKind: body.brokerFee?.kind ?? null,
          brokerFeePercent: body.brokerFee?.kind === 'percent' ? body.brokerFee.percent : null,
          brokerFeeRwf: body.brokerFee?.kind === 'fixed' ? body.brokerFee.amountRwf : null,
        }
      : {}),
  };
}

/**
 * Brokers may offer a unit only when it can be let, has an asking rent and a
 * fee (2026-10-25): what a broker sees is the rent and what they earn. Said in
 * the form's words, on the field to fix.
 */
function assertBrokerOffer(
  unit: { brokerOffer?: boolean; askingRentRwf?: number | null; brokerFeeKind?: string | null; state?: string },
  label: string,
): void {
  if (!unit.brokerOffer) return;
  const issues: { code: 'custom'; path: string[]; message: string }[] = [];
  if (unit.state && unit.state !== 'active') issues.push({ code: 'custom', path: ['brokerOffer'], message: 'A unit off the market cannot be offered by brokers.' });
  if (unit.askingRentRwf === null || unit.askingRentRwf === undefined) {
    issues.push({ code: 'custom', path: ['askingRentRwf'], message: 'Set the asking rent so brokers can offer it.' });
  }
  if (!unit.brokerFeeKind) issues.push({ code: 'custom', path: ['brokerFee'], message: 'Set the broker fee.' });
  if (issues.length > 0) {
    throw new BadRequestException({ message: `Unit ${label || 'this unit'} needs a few things before brokers can offer it.`, issues });
  }
}
