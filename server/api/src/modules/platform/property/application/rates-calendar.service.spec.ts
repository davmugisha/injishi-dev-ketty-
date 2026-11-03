import { describe, expect, it, vi } from 'vitest';

import { BadRequestException } from '@nestjs/common';

import type { ScopedWorkspace } from '../../../../shared/auth/branch-scope';
import type { RatesCalendarRepository, RatesRoomTypeRow } from '../infrastructure/rates-calendar.repository';
import { RatesCalendarService } from './rates-calendar.service';

/**
 * Prices (2026-10-30): a room priced per room may have a lower price for one guest, and the prices page
 * lists every run of special days from today on.
 */
const WORKSPACE = '11111111-1111-4111-8111-111111111111';
const PROPERTY = '22222222-2222-4222-8222-222222222222';
const DOUBLE = '33333333-3333-4333-8333-333333333333';
const DORM = '44444444-4444-4444-8444-444444444444';

const ws = {
  workspaceId: WORKSPACE,
  permissions: ['listing.manage'],
  branchScope: { coverage: 'all', selectedPropertyId: null, propertyIds: [PROPERTY], includesUnbranched: true },
} as unknown as ScopedWorkspace;

const type = (id: string, name: string, priceBasis: string): RatesRoomTypeRow => ({
  id,
  name,
  propertyName: 'Lodge',
  ratePlanId: 'rp',
  rooms: 4,
  basePriceRwf: 60_000,
  priceBasis,
  singleGuestPriceRwf: null,
  minStay: null,
  maxStay: null,
  weeklyDiscountPct: null,
  monthlyDiscountPct: null,
});

function service(): { svc: RatesCalendarService; writeTerms: ReturnType<typeof vi.fn> } {
  const writeTerms = vi.fn(async () => undefined);
  const repo = {
    roomTypes: vi.fn(async () => [type(DOUBLE, 'Double', 'per_unit'), type(DORM, 'Dorm bed', 'per_person')]),
    overrides: vi.fn(async () => []),
    sold: vi.fn(async () => []),
    specialDays: vi.fn(async () => [
      { roomTypeId: DOUBLE, day: '2026-12-24', rateRwf: 90_000, blocked: false, minNights: null },
      { roomTypeId: DOUBLE, day: '2026-12-25', rateRwf: 90_000, blocked: false, minNights: null },
      { roomTypeId: DORM, day: '2026-12-25', rateRwf: null, blocked: true, minNights: null },
    ]),
    writeTerms,
  } as unknown as RatesCalendarRepository;
  return { svc: new RatesCalendarService(repo), writeTerms };
}

describe('RatesCalendarService', () => {
  it('saves a one guest price below the room price', async () => {
    const { svc, writeTerms } = service();
    await svc.writeTerms(ws, { roomTypeId: DOUBLE, singleGuestPriceRwf: 45_000 });
    expect(writeTerms).toHaveBeenCalledWith(expect.objectContaining({ singleGuestPriceRwf: 45_000 }));
  });

  it('refuses a one guest price at or above the room price, or on a room priced per guest', async () => {
    const { svc, writeTerms } = service();
    await expect(svc.writeTerms(ws, { roomTypeId: DOUBLE, singleGuestPriceRwf: 60_000 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(svc.writeTerms(ws, { roomTypeId: DORM, singleGuestPriceRwf: 10_000 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(writeTerms).not.toHaveBeenCalled();
  });

  it('lists special days as runs, earliest first', async () => {
    const { svc } = service();
    const out = await svc.specialDates(ws, new Date('2026-10-30T10:00:00Z'));
    expect(out.today).toBe('2026-10-30');
    expect(out.ranges).toEqual([
      expect.objectContaining({ roomTypeName: 'Double', from: '2026-12-24', to: '2026-12-25', priceRwf: 90_000 }),
      expect.objectContaining({ roomTypeName: 'Dorm bed', from: '2026-12-25', to: '2026-12-25', closed: true }),
    ]);
  });
});
