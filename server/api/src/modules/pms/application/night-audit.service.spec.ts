import { describe, expect, it, vi } from 'vitest';

import type { DepartmentsService } from '../../operations/application/departments.service';
import type { FolioRepository } from '../infrastructure/folio.repository';
import { NightAuditService } from './night-audit.service';

type Basis = NonNullable<Awaited<ReturnType<FolioRepository['roomChargeBasisForStay']>>>;

function build(basis: Basis | null): { service: NightAuditService; postCharges: ReturnType<typeof vi.fn> } {
  const postCharges = vi.fn().mockResolvedValue(undefined);
  const folios = {
    roomChargeBasisForStay: vi.fn().mockResolvedValue(basis),
    postCharges,
  } as unknown as FolioRepository;
  const departments = {
    roomsDepartmentFor: vi.fn().mockResolvedValue({ id: 'dept-rooms', departmentCategory: 'rooms' }),
  } as unknown as DepartmentsService;
  return { service: new NightAuditService(folios, departments), postCharges };
}

const basis = (over: Partial<Basis> = {}): Basis => ({
  folioId: 'folio-1',
  workspaceId: 'ws-1',
  propertyId: 'prop-1',
  nightlyRateRwf: 85_000,
  // 10:00 in Kigali on 30 October.
  entryAt: new Date('2026-10-30T08:00:00Z'),
  chargedNights: [] as string[],
  ...over,
});

const nightsPosted = (postCharges: ReturnType<typeof vi.fn>): string[] =>
  postCharges.mock.calls.map((c) => (c[0] as { drafts: { businessDate: string }[] }).drafts[0].businessDate);

describe('NightAuditService.chargeOnDeparture', () => {
  it('charges one night for a guest who arrives and leaves the same day', async () => {
    const { service, postCharges } = build(basis());
    const posted = await service.chargeOnDeparture('stay-1', new Date('2026-10-30T15:00:00Z'));
    expect(posted).toBe(1);
    expect(nightsPosted(postCharges)).toEqual(['2026-10-30']);
  });

  it('charges every night up to the one before departure, skipping nights already billed', async () => {
    const { service, postCharges } = build(basis({ chargedNights: ['2026-10-30'] }));
    await service.chargeOnDeparture('stay-1', new Date('2026-11-02T07:00:00Z'));
    expect(nightsPosted(postCharges)).toEqual(['2026-10-31', '2026-11-01']);
  });

  it('uses the Kigali date, not UTC, for a departure just after midnight', async () => {
    // 00:30 in Kigali on 1 November is still 31 October in UTC.
    const { service, postCharges } = build(basis());
    await service.chargeOnDeparture('stay-1', new Date('2026-10-31T22:30:00Z'));
    expect(nightsPosted(postCharges)).toEqual(['2026-10-30', '2026-10-31']);
  });

  it('posts nothing when there is no rate to charge from, and never throws', async () => {
    const { service, postCharges } = build(basis({ nightlyRateRwf: null }));
    await expect(service.chargeOnDeparture('stay-1')).resolves.toBe(0);
    expect(postCharges).not.toHaveBeenCalled();
  });
});
