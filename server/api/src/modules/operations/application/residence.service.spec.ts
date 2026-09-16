import { ConflictException } from '@nestjs/common';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import type { LeaseRow, ResidenceRepository } from '../infrastructure/residence.repository';
import type { FirstRentCharge } from './first-rent-charge';
import { ResidenceService } from './residence.service';

/**
 * Unit scope: what the service decides about a lease moving. The SQL that
 * writes the move and the charge in one transaction is the repository's.
 */
describe('ResidenceService.advanceLease', () => {
  const WS = '11111111-1111-1111-1111-111111111111';
  const LEASE = '22222222-2222-2222-2222-222222222222';
  const ws = { workspaceId: WS } as unknown as ScopedWorkspace;

  const row = (over: Partial<LeaseRow> = {}): LeaseRow => ({
    id: LEASE,
    workspaceId: WS,
    roomId: '33333333-3333-3333-3333-333333333333',
    unitLabel: 'S3',
    tenantName: 'Sandrine Ingabire',
    monthlyRentRwf: 250_000,
    cautionRwf: 500_000,
    startDate: '2026-09-01',
    endDate: null,
    status: 'pending_signature',
    landlordSignedAt: new Date('2026-08-25T09:00:00Z'),
    tenantSignedAt: new Date('2026-08-26T09:00:00Z'),
    ...over,
  });

  function build(initial: LeaseRow): {
    service: ResidenceService;
    calls: { to: string; firstCharge: FirstRentCharge | null }[];
  } {
    let current = initial;
    const calls: { to: string; firstCharge: FirstRentCharge | null }[] = [];
    const repo = {
      findLease: async () => current,
      advanceLease: async (_id: string, _from: string, to: LeaseRow['status'], firstCharge: FirstRentCharge | null) => {
        calls.push({ to, firstCharge });
        current = { ...current, status: to };
        return true;
      },
    } as unknown as ResidenceRepository;
    class PinnedClock extends ResidenceService {
      protected override now(): Date {
        return new Date('2026-09-15T08:00:00Z');
      }
    }
    return { service: new PinnedClock(repo), calls };
  }

  it('raises the current month of rent when a signed lease goes active', async () => {
    const { service, calls } = build(row());
    const lease = await service.advanceLease(ws, LEASE, { to: 'active' });
    expect(lease.status).toBe('active');
    expect(calls).toEqual([
      { to: 'active', firstCharge: { periodMonth: '2026-09-01', dueDate: '2026-09-20', amountRwf: 250_000 } },
    ]);
  });

  it('raises no charge for any other move', async () => {
    const { service, calls } = build(row({ status: 'active' }));
    await service.advanceLease(ws, LEASE, { to: 'ending' });
    expect(calls).toEqual([{ to: 'ending', firstCharge: null }]);
  });

  it('refuses to activate a lease missing a signature, and writes nothing', async () => {
    const { service, calls } = build(row({ tenantSignedAt: null }));
    await expect(service.advanceLease(ws, LEASE, { to: 'active' })).rejects.toBeInstanceOf(ConflictException);
    expect(calls).toEqual([]);
  });
});
