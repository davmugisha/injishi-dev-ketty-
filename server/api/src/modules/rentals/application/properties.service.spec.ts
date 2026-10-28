import { describe, expect, it, vi } from 'vitest';

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PropertyLocationRequest } from '@injishi/contracts';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import type { PropertiesRepository, VillageChain } from '../infrastructure/properties.repository';
import type { RentalsContextRepository } from '../infrastructure/rentals-context.repository';
import type { LeaseContractService } from './lease-contract.service';
import { PropertiesService, chainProblem } from './properties.service';

const WS = '11111111-1111-4111-8111-111111111111';
const ORG = '22222222-2222-4222-8222-222222222222';
const PROPERTY = '33333333-3333-4333-8333-333333333333';
const USER = '77777777-7777-4777-8777-777777777777';

const ws = {
  workspaceId: WS,
  kind: 'business',
  orgId: ORG,
  domain: 'residence',
  orgRole: 'owner',
  registrationStatus: 'active',
  permissions: ['listing.manage'],
  branchScope: { coverage: 'all', selectedPropertyId: null, propertyIds: [], includesUnbranched: true },
} as unknown as ScopedWorkspace;

// Kigali City > Gasabo > Kimihurura > Rugando > Amahoro (ids as the reference data numbers them).
const CHAIN: VillageChain = { provinceId: 1, districtId: 102, sectorId: 10208, cellId: 1020801, villageId: 102080101 };
const body = (over: Partial<VillageChain> = {}): PropertyLocationRequest =>
  PropertyLocationRequest.parse({ ...CHAIN, ...over, street: ' KG 9 Ave ' });

// The doubles' types are what the test reads back; they are inferred.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function harness(buildings: { id: string; name: string }[] = [{ id: PROPERTY, name: 'Amani Residences' }]) {
  const row = {
    id: PROPERTY,
    name: 'Amani Residences',
    street: 'KG 9 Ave',
    province: { id: 1, name: 'Kigali City' },
    district: { id: 102, name: 'Gasabo' },
    sector: { id: 10208, name: 'Kimihurura' },
    cell: { id: 1020801, name: 'Rugando' },
    village: { id: 102080101, name: 'Amahoro' },
    units: 3,
  };
  const properties = {
    list: vi.fn(async () => [row]),
    villageChain: vi.fn(async () => CHAIN),
    setLocation: vi.fn(async () => undefined),
    draftLeaseIds: vi.fn(async () => ['lease-1']),
  };
  const context = {
    buildings: vi.fn(async () => buildings),
    ensureBuilding: vi.fn(async () => ({ id: PROPERTY, name: 'Amani Residences' })),
  };
  const contracts = { refreshDrafts: vi.fn(async () => 1) };
  const service = new PropertiesService(
    properties as unknown as PropertiesRepository,
    context as unknown as RentalsContextRepository,
    contracts as unknown as LeaseContractService,
  );
  return { service, properties, context, contracts };
}

describe('PropertiesService: where the buildings are', () => {
  it('the first read makes the building from the registration', async () => {
    const h = harness([]);
    const list = await h.service.list(ws);
    expect(h.context.ensureBuilding).toHaveBeenCalledWith({ workspaceId: WS, orgId: ORG });
    expect(list.properties[0]).toMatchObject({ id: PROPERTY, located: true, units: 3 });
  });

  it('saves the whole chain and the street, and rewrites draft contracts', async () => {
    const h = harness();
    const view = await h.service.setLocation(ws, USER, PROPERTY, body());
    expect(h.properties.setLocation).toHaveBeenCalledWith(PROPERTY, {
      villageId: CHAIN.villageId,
      sectorId: CHAIN.sectorId,
      districtId: CHAIN.districtId,
      street: 'KG 9 Ave',
    });
    expect(h.contracts.refreshDrafts).toHaveBeenCalledWith(['lease-1'], USER);
    expect(view.place.village).toEqual({ id: 102080101, name: 'Amahoro' });
  });

  it('a chain that does not hold together is refused at the level that is wrong', async () => {
    const h = harness();
    await expect(h.service.setLocation(ws, USER, PROPERTY, body({ cellId: 1020802 }))).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(h.properties.setLocation).not.toHaveBeenCalled();
  });

  it("another business's building is not found", async () => {
    const h = harness();
    await expect(
      h.service.setLocation(ws, USER, '44444444-4444-4444-8444-444444444444', body()),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('chainProblem', () => {
  it('agrees with a chain that holds together', () => {
    expect(chainProblem(CHAIN, CHAIN)).toBeNull();
  });

  it.each([
    [{ villageId: 9 }, null, 'villageId', 'That village does not exist. Pick one from the list.'],
    [{ provinceId: 2 }, CHAIN, 'districtId', 'That district is not in the province you chose.'],
    [{ districtId: 101 }, CHAIN, 'sectorId', 'That sector is not in the district you chose.'],
    [{ sectorId: 10201 }, CHAIN, 'cellId', 'That cell is not in the sector you chose.'],
    [{ cellId: 1020802 }, CHAIN, 'villageId', 'That village is not in the cell you chose.'],
  ] as const)('%j', (over, chain, field, message) => {
    expect(chainProblem({ ...CHAIN, ...over }, chain)).toEqual({ field, message });
  });
});
