import { describe, expect, it, type Mock, vi } from 'vitest';

import { BadRequestException } from '@nestjs/common';

import type { ScopedWorkspace } from '../../../../shared/auth/branch-scope';
import type { PropertyPhotosService } from './property-photos.service';
import { InventoryService } from './inventory.service';

/**
 * A property's village must lie in its sector: it is what files a check-in
 * with that village's leader (the guest register, 0114), so a village from
 * another sector would report guests to the wrong people.
 */
const WORKSPACE = '11111111-1111-4111-8111-111111111111';
const PROPERTY = '22222222-2222-4222-8222-222222222222';
const SECTOR = 10201;

function workspace(): ScopedWorkspace {
  return {
    workspaceId: WORKSPACE,
    permissions: ['listing.manage'],
    branchScope: { coverage: 'all', selectedPropertyId: null, propertyIds: [PROPERTY], includesUnbranched: true },
  } as unknown as ScopedWorkspace;
}

function service(villageSector: number | null): { svc: InventoryService; repo: Record<string, Mock> } {
  const repo = {
    findProperty: vi.fn(async () => ({ id: PROPERTY, workspaceId: WORKSPACE, orgId: 'org', sectorId: SECTOR })),
    sectorForVillage: vi.fn(async () => villageSector),
    updateProperty: vi.fn(async () => 'done'),
  };
  const svc = new InventoryService(repo as never, {} as never, {} as PropertyPhotosService);
  // The read back after the write is not what these tests are about.
  vi.spyOn(svc, 'getProperty').mockResolvedValue({} as never);
  return { svc, repo };
}

describe('InventoryService.updateProperty · village', () => {
  it('saves a village that lies in the property sector', async () => {
    const { svc, repo } = service(SECTOR);
    await svc.updateProperty(workspace(), PROPERTY, { workspaceId: WORKSPACE, villageId: 102010101 }, 'user');
    expect(repo.updateProperty).toHaveBeenCalledOnce();
  });

  it('refuses a village from another sector, and writes nothing', async () => {
    const { svc, repo } = service(99999);
    await expect(
      svc.updateProperty(workspace(), PROPERTY, { workspaceId: WORKSPACE, villageId: 102010101 }, 'user'),
    ).rejects.toThrow(/not in the sector/);
    expect(repo.updateProperty).not.toHaveBeenCalled();
  });

  it('refuses a village that does not exist', async () => {
    const { svc } = service(null);
    await expect(
      svc.updateProperty(workspace(), PROPERTY, { workspaceId: WORKSPACE, villageId: 1 }, 'user'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lets a village be cleared without a lookup', async () => {
    const { svc, repo } = service(null);
    await svc.updateProperty(workspace(), PROPERTY, { workspaceId: WORKSPACE, villageId: null }, 'user');
    expect(repo.sectorForVillage).not.toHaveBeenCalled();
    expect(repo.updateProperty).toHaveBeenCalledOnce();
  });
});
