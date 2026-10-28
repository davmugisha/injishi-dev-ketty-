import { describe, expect, it } from 'vitest';

import { dueAccruals } from './leave-accrual';

describe('leave accrual (ADR-058 AC-L2)', () => {
  it('earns a twelfth a month, and twelve months add to the entitlement exactly', () => {
    const rows = dueAccruals({
      type: { accrual: 'monthly', yearlyEntitlementDays: 21 },
      hiredOn: '2026-01-01',
      through: '2026-12-31',
    });
    expect(rows).toHaveLength(12);
    const total = rows.reduce((s, r) => s + r.days, 0);
    expect(Math.round(total * 10) / 10).toBe(21);
    expect(rows[0]).toEqual({ periodKey: '2026-01', days: 1.8, effectiveOn: '2026-01-01' });
  });

  it('scales the first month by payable thirtieths from the hire date', () => {
    const [first] = dueAccruals({
      type: { accrual: 'monthly', yearlyEntitlementDays: 18 },
      hiredOn: '2026-09-16',
      through: '2026-09-30',
    });
    // 18/12 = 1.5 a month, and 15/30 of it.
    expect(first).toEqual({ periodKey: '2026-09', days: 0.8, effectiveOn: '2026-09-16' });
  });

  it('earns a yearly type once a year, from the hire date', () => {
    const rows = dueAccruals({
      type: { accrual: 'yearly_upfront', yearlyEntitlementDays: 18 },
      hiredOn: '2026-03-10',
      through: '2027-02-01',
    });
    expect(rows).toEqual([
      { periodKey: '2026', days: 18, effectiveOn: '2026-03-10' },
      { periodKey: '2027', days: 18, effectiveOn: '2027-01-01' },
    ]);
  });

  it('owes nothing for a type that keeps no balance, or before the hire date', () => {
    expect(dueAccruals({ type: { accrual: 'none', yearlyEntitlementDays: null }, hiredOn: '2026-01-01', through: '2026-12-31' })).toEqual([]);
    expect(dueAccruals({ type: { accrual: 'monthly', yearlyEntitlementDays: 18 }, hiredOn: '2026-10-01', through: '2026-09-30' })).toEqual([]);
  });

  it('starts each year afresh at the entitlement of that year, seniority included (058-leave AC-LV5)', () => {
    const rows = dueAccruals({
      type: { accrual: 'monthly', yearlyEntitlementDays: 18, seniorityEveryYears: 1, seniorityExtraDays: 1.2, seniorityCapDays: null },
      hiredOn: '2025-01-01',
      through: '2026-12-31',
    });
    const sum = (y: string): number => Math.round(rows.filter((r) => r.periodKey.startsWith(y)).reduce((s, r) => s + r.days, 0) * 10) / 10;
    expect(sum('2025')).toBe(18);
    expect(sum('2026')).toBe(19.2);
    expect(rows.find((r) => r.periodKey === '2026-01')?.days).toBe(1.6);
  });

  it('returns the same periods whenever it runs, so a rerun writes nothing new', () => {
    const early = dueAccruals({ type: { accrual: 'monthly', yearlyEntitlementDays: 18 }, hiredOn: '2026-01-01', through: '2026-03-02' });
    const late = dueAccruals({ type: { accrual: 'monthly', yearlyEntitlementDays: 18 }, hiredOn: '2026-01-01', through: '2026-05-20' });
    expect(late.slice(0, early.length)).toEqual(early);
  });
});
