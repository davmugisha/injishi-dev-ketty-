import { describe, expect, it } from 'vitest';

import { allocate, kigaliDay, nightsStayed, percentCommission } from './broker-commission';

describe('broker commission arithmetic', () => {
  it('counts the nights actually stayed, at least one and at most the nights booked', () => {
    expect(nightsStayed('2026-11-10', '2026-11-13', '2026-11-13')).toBe(3);
    expect(nightsStayed('2026-11-10', '2026-11-13', '2026-11-11')).toBe(1);
    expect(nightsStayed('2026-11-10', '2026-11-13', '2026-11-12')).toBe(2);
    expect(nightsStayed('2026-11-10', '2026-11-13', '2026-11-10')).toBe(1);
    expect(nightsStayed('2026-11-10', '2026-11-13', '2026-11-15')).toBe(3);
  });

  it('takes a percent in basis points, rounded to the franc', () => {
    expect(percentCommission(180_000, 1000)).toBe(18_000);
    expect(percentCommission(99_999, 750)).toBe(7_500);
    expect(percentCommission(0, 1000)).toBe(0);
  });

  it('takes what is owed oldest first, in part when the money runs out', () => {
    expect(allocate(100_000, [{ id: 'a', owedRwf: 30_000 }, { id: 'b', owedRwf: 50_000 }])).toEqual({
      deductions: [
        { id: 'a', amountRwf: 30_000 },
        { id: 'b', amountRwf: 50_000 },
      ],
      remainingRwf: 20_000,
    });
    expect(allocate(40_000, [{ id: 'a', owedRwf: 30_000 }, { id: 'b', owedRwf: 50_000 }])).toEqual({
      deductions: [
        { id: 'a', amountRwf: 30_000 },
        { id: 'b', amountRwf: 10_000 },
      ],
      remainingRwf: 0,
    });
    expect(allocate(0, [{ id: 'a', owedRwf: 30_000 }])).toEqual({ deductions: [], remainingRwf: 0 });
    expect(allocate(5_000, [])).toEqual({ deductions: [], remainingRwf: 5_000 });
  });

  it('reads the Kigali day of an instant', () => {
    expect(kigaliDay(new Date('2026-11-02T21:59:00Z'))).toBe('2026-11-02');
    expect(kigaliDay(new Date('2026-11-02T22:01:00Z'))).toBe('2026-11-03');
  });
});
