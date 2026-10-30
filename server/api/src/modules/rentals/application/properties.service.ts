import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { PropertyLocationRequest, RentalPropertyList, RentalPropertyView } from '@injishi/contracts';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { buildingIdsOf } from '../domain/attention';
import { assertResidence, coversBuilding } from '../domain/residence';
import { PropertiesRepository, type PropertyPlaceRow, type VillageChain } from '../infrastructure/properties.repository';
import { RentalsContextRepository } from '../infrastructure/rentals-context.repository';
import { LeaseContractService } from './lease-contract.service';

/**
 * Where the landlord's buildings are (blueprint 2.3 "Overview and settings",
 * setup's first step). A residence registration makes no building, so the
 * first read makes one from the registered name and address, as the first
 * unit does. The location is the whole chain down to the village, each level
 * checked to sit under the one above it, and a street line.
 */
@Injectable()
export class PropertiesService {
  constructor(
    private readonly properties: PropertiesRepository,
    private readonly context: RentalsContextRepository,
    private readonly contracts: LeaseContractService,
  ) {}

  async list(ws: ScopedWorkspace): Promise<RentalPropertyList> {
    const r = assertResidence(ws);
    const all = await this.context.buildings(r.workspaceId);
    if (all.length === 0 && ws.branchScope.coverage === 'all') await this.context.ensureBuilding(r);
    const rows = await this.properties.list(r.workspaceId, buildingIdsOf(ws.branchScope));
    return { properties: rows.map(present) };
  }

  async setLocation(
    ws: ScopedWorkspace,
    userId: string,
    propertyId: string,
    body: PropertyLocationRequest,
  ): Promise<RentalPropertyView> {
    const r = assertResidence(ws);
    const building = (await this.context.buildings(r.workspaceId)).find((b) => b.id === propertyId);
    if (!building || !coversBuilding(ws.branchScope, building.id)) throw new NotFoundException('Building not found.');
    const chain = await this.properties.villageChain(body.villageId);
    const problem = chainProblem(body, chain);
    if (problem) {
      throw new BadRequestException({
        message: 'Validation failed',
        issues: [{ code: 'custom', path: [problem.field], message: problem.message }],
      });
    }
    await this.properties.setLocation(propertyId, {
      villageId: body.villageId,
      sectorId: body.sectorId,
      districtId: body.districtId,
      street: body.street ?? null,
    });
    // A draft's contract says where the home is.
    await this.contracts.refreshDrafts(await this.properties.draftLeaseIds(propertyId), userId);
    const rows = await this.properties.list(r.workspaceId, [propertyId]);
    const row = rows[0];
    if (!row) throw new NotFoundException('Building not found.');
    return present(row);
  }
}

/**
 * The first level of the chain that does not sit under the one above it, in words, or null when the
 * whole chain agrees. Checked from the village up, because the village is what is stored.
 */
export function chainProblem(
  body: Pick<PropertyLocationRequest, 'provinceId' | 'districtId' | 'sectorId' | 'cellId' | 'villageId'>,
  chain: VillageChain | null,
): { field: keyof typeof body; message: string } | null {
  if (!chain) return { field: 'villageId', message: 'That village does not exist. Pick one from the list.' };
  if (chain.provinceId !== body.provinceId) return { field: 'districtId', message: 'That district is not in the province you chose.' };
  if (chain.districtId !== body.districtId) return { field: 'sectorId', message: 'That sector is not in the district you chose.' };
  if (chain.sectorId !== body.sectorId) return { field: 'cellId', message: 'That cell is not in the sector you chose.' };
  if (chain.cellId !== body.cellId) return { field: 'villageId', message: 'That village is not in the cell you chose.' };
  return null;
}

function present(row: PropertyPlaceRow): RentalPropertyView {
  return {
    id: row.id,
    name: row.name,
    street: row.street,
    place: { province: row.province, district: row.district, sector: row.sector, cell: row.cell, village: row.village },
    located: row.village !== null,
    units: row.units,
  };
}
