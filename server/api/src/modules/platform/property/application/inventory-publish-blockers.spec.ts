import { describe, expect, it, vi } from 'vitest';

import { NotFoundException } from '@nestjs/common';

import type { ScopedWorkspace } from '../../../../shared/auth/branch-scope';
import type { PropertyPhotosService } from './property-photos.service';
import { InventoryService } from './inventory.service';

const WORKSPACE = '11111111-1111-4111-8111-111111111111';
const PROPERTY = '22222222-2222-4222-8222-222222222222';
const OTHER_BRANCH = '33333333-3333-4333-8333-333333333333';

function workspace(scope: Partial<ScopedWorkspace['branchScope']> = {}): ScopedWorkspace {
  return {
    workspaceId: WORKSPACE,
    branchScope: { coverage: 'all', selectedPropertyId: null, propertyIds: [PROPERTY, OTHER_BRANCH], includesUnbranched: true, ...scope },
  } as unknown as ScopedWorkspace;
}

function service(facts: object | null, row: object | null = { id: PROPERTY, workspaceId: WORKSPACE }): InventoryService {
  const repo = {
    findProperty: vi.fn(async () => row),
    publishFactsFor: vi.fn(async () => facts),
    publish: vi.fn(() => {
      throw new Error('publishBlockers must never publish');
    }),
  };
  return new InventoryService(repo as never, {} as never, {} as PropertyPhotosService);
}

describe('InventoryService.publishBlockers (ADR-061 slice D)', () => {
  it('reports what publishing would refuse, without publishing', async () => {
    const svc = service({ sectorId: null, activeRoomTypeCount: 1, pricedRoomTypeCount: 0, photoCount: 0 });
    await expect(svc.publishBlockers(workspace(), PROPERTY)).resolves.toEqual([
      'missing_sector',
      'no_priced_room_type',
      'no_photo',
    ]);
  });

  it('returns nothing to fix when publishing would pass its checks', async () => {
    const svc = service({ sectorId: 7, activeRoomTypeCount: 1, pricedRoomTypeCount: 1, photoCount: 3 });
    await expect(svc.publishBlockers(workspace(), PROPERTY)).resolves.toEqual([]);
  });

  it("refuses another workspace's property as not found", async () => {
    const svc = service({ sectorId: 7, activeRoomTypeCount: 1, pricedRoomTypeCount: 1, photoCount: 1 }, { id: PROPERTY, workspaceId: 'someone-else' });
    await expect(svc.publishBlockers(workspace(), PROPERTY)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses a property outside the branches the member covers', async () => {
    const svc = service({ sectorId: 7, activeRoomTypeCount: 1, pricedRoomTypeCount: 1, photoCount: 1 });
    const limited = workspace({ coverage: 'limited', propertyIds: [OTHER_BRANCH], includesUnbranched: false });
    await expect(svc.publishBlockers(limited, PROPERTY)).rejects.toBeInstanceOf(NotFoundException);
  });
});
