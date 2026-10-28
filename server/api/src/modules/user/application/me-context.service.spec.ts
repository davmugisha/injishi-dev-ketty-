import type { StaffAccess, WorkspaceAccess } from '@injishi/contracts';

import type { MeContextRepository } from '../infrastructure/me-context.repository';
import { MeContextService } from './me-context.service';

const USER = { id: '77777777-7777-4777-8777-777777777777', name: 'Amani Uwase', email: 'amani@example.rw' };
const RES = '11111111-1111-4111-8111-111111111111';
const HOTEL = '22222222-2222-4222-8222-222222222222';
const NOBODY: StaffAccess = { isStaff: false, roles: [], permissions: [] };

const business = (workspaceId: string, domain: 'residence' | 'hospitality', registrationStatus = 'active'): WorkspaceAccess =>
  ({
    workspaceId,
    kind: 'business',
    orgId: workspaceId.replace(/^1|^2/, '3'),
    orgName: domain === 'residence' ? 'Amani Residences' : 'Lake Hotel',
    domain,
    orgRole: 'owner',
    registrationStatus,
    permissions: registrationStatus === 'active' ? ['unit.manage'] : [],
    departments: [],
    propertyName: null,
    branches: [],
    branchCoverage: 'all',
    psfMembership: null,
  }) as unknown as WorkspaceAccess;

const tenancy = {
  leaseId: '55555555-5555-4555-8555-555555555555',
  reference: 'L-0001',
  status: 'active' as const,
  landlordName: 'Amani Residences',
  propertyName: 'Amani Residences',
  unitLabel: 'A-01',
  monthlyRentRwf: 250_000,
  startDate: '2026-10-01',
  endDate: '2027-09-30',
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function harness(opts: { tenancies?: (typeof tenancy)[]; broker?: { id: string; name: string | null; status: string } | null } = {}) {
  const reads = {
    tenancies: jest.fn(async () => opts.tenancies ?? []),
    broker: jest.fn(async () => opts.broker ?? null),
    signatories: jest.fn(async () => new Map<string, string>()),
  };
  return new MeContextService(reads as unknown as MeContextRepository);
}

describe('MeContextService: where a person lands', () => {
  it('a member of a running residence business lands on the landlord home of it', async () => {
    const context = await harness().build({
      user: USER,
      workspaces: [{ workspaceId: 'p', kind: 'personal' } as WorkspaceAccess, business(RES, 'residence')],
      activeWorkspaceId: null,
      oversight: [],
      staff: NOBODY,
    });
    expect(context.businesses).toHaveLength(1);
    expect(context.businesses[0]).toMatchObject({ domain: 'residence', role: 'owner', operational: true });
    expect(context.landing).toEqual({ surface: 'landlord', workspaceId: RES });
  });

  it("the session's choice wins over the residence business", async () => {
    const context = await harness().build({
      user: USER,
      workspaces: [business(RES, 'residence'), business(HOTEL, 'hospitality')],
      activeWorkspaceId: HOTEL,
      oversight: [],
      staff: NOBODY,
    });
    expect(context.landing).toEqual({ surface: 'business', workspaceId: HOTEL });
  });

  it('a business still in review is not a landlord surface; a tenancy then is', async () => {
    const context = await harness({ tenancies: [tenancy] }).build({
      user: USER,
      workspaces: [business(RES, 'residence', 'tin_verified')],
      activeWorkspaceId: RES,
      oversight: [],
      staff: NOBODY,
    });
    expect(context.businesses[0]?.operational).toBe(false);
    expect(context.landing).toEqual({ surface: 'tenant', workspaceId: null });
  });

  it('nobody in particular is a guest', async () => {
    const context = await harness({ broker: { id: 'b', name: null, status: 'suspended' } }).build({
      user: USER,
      workspaces: [],
      activeWorkspaceId: null,
      oversight: [],
      staff: NOBODY,
    });
    expect(context.landing.surface).toBe('guest');
  });
});
