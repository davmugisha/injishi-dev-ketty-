import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { coversProperty } from '../../../shared/auth/branch-scope';
import type { BranchesRepository } from '../infrastructure/branches.repository';
import type { InventoryRepository } from '../infrastructure/inventory.repository';
import { InventoryService } from './inventory.service';
import type { PropertyPhotosService } from './property-photos.service';

/**
 * Adding a branch (ADR-054 AC-M1).
 *
 * The guard resolves the caller's branch scope before the handler runs, so the
 * scope's list of covered properties cannot name a branch created during the
 * same request. Reading the new branch back through that scope used to answer
 * "Property not found." to an owner who had just created it: the branch was
 * saved, the screen said it failed. Found walking the operator app end to end.
 */
describe('InventoryService.createProperty', () => {
  const EXISTING = '11111111-1111-4111-8111-111111111111';
  const CREATED = '22222222-2222-4222-8222-222222222222';

  function build(): {
    service: InventoryService;
    repo: { districtForSector: jest.Mock; createProperty: jest.Mock };
    readBack: jest.SpyInstance;
  } {
    const repo = {
      districtForSector: jest.fn().mockResolvedValue(303),
      createProperty: jest.fn().mockResolvedValue(CREATED),
    };
    const service = new InventoryService(
      repo as unknown as InventoryRepository,
      {} as BranchesRepository,
      {} as PropertyPhotosService,
    );
    const readBack = jest.spyOn(service, 'getProperty').mockResolvedValue({} as never);
    return { service, repo, readBack };
  }

  const owner = (): ScopedWorkspace =>
    ({
      workspaceId: '33333333-3333-4333-8333-333333333333',
      orgId: '44444444-4444-4444-8444-444444444444',
      branchCoverage: 'all',
      branchScope: {
        coverage: 'all',
        selectedPropertyId: null,
        propertyIds: [EXISTING],
        includesUnbranched: true,
      },
    }) as unknown as ScopedWorkspace;

  it('reads the new branch back through a scope that covers it', async () => {
    const { service, readBack } = build();

    await service.createProperty(owner(), { name: 'Kivu Shore', sectorId: 1 } as never, 'user-1');

    const [scoped, propertyId] = readBack.mock.calls[0]!;
    expect(propertyId).toBe(CREATED);
    expect(coversProperty(scoped.branchScope, CREATED)).toBe(true);
    // The branches the caller already covered are still covered.
    expect(coversProperty(scoped.branchScope, EXISTING)).toBe(true);
  });

  it('does not widen the caller’s own scope object', async () => {
    const { service } = build();
    const workspace = owner();

    await service.createProperty(workspace, { name: 'Kivu Shore', sectorId: 1 } as never, 'user-1');

    expect(workspace.branchScope.propertyIds).toEqual([EXISTING]);
  });

  it('still refuses a member limited to some branches', async () => {
    const { service, repo } = build();
    const limited = { ...owner(), branchCoverage: 'limited' } as unknown as ScopedWorkspace;

    await expect(
      service.createProperty(limited, { name: 'Kivu Shore', sectorId: 1 } as never, 'user-1'),
    ).rejects.toThrow();
    expect(repo.createProperty).not.toHaveBeenCalled();
  });
});
