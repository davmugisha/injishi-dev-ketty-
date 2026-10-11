import {
  DEFAULT_ENTITLEMENT,
  completedYears,
  entitlementFor,
  monthsOfYear,
  workOutAllowance,
  yearAllowance,
  type EntitlementRule,
} from './leave-entitlement';

const annual: EntitlementRule = { ...DEFAULT_ENTITLEMENT.annual, carryForward: false };
const carrying: EntitlementRule = { ...annual, carryForward: true };

describe('long service', () => {
  it('counts full years only', () => {
    expect(completedYears('2023-10-09', '2026-10-08')).toBe(2);
    expect(completedYears('2023-10-09', '2026-10-09')).toBe(3);
    expect(completedYears('2026-10-09', '2026-01-01')).toBe(0);
  });

  it('adds a day for every three years here, by the first day of the year', () => {
    expect(entitlementFor(annual, '2025-06-01', 2026)).toBe(18);
    expect(entitlementFor(annual, '2023-01-01', 2026)).toBe(19);
    // Three years are complete on 2 January: too late for 2026, in time for 2027.
    expect(entitlementFor(annual, '2023-01-02', 2026)).toBe(18);
    expect(entitlementFor(annual, '2023-01-02', 2027)).toBe(19);
  });

  it('stops at three extra days', () => {
    expect(entitlementFor(annual, '2010-03-01', 2026)).toBe(21);
  });

  it('adds nothing when the start date was never recorded', () => {
    expect(entitlementFor(annual, null, 2026)).toBe(18);
  });
});

describe('the first year', () => {
  it('is a whole year for anybody already here on 1 January', () => {
    expect(monthsOfYear('2024-05-01', 2026)).toBe(12);
    expect(monthsOfYear(null, 2026)).toBe(12);
  });

  it('is nothing for somebody who has not started', () => {
    expect(monthsOfYear('2027-02-01', 2026)).toBe(0);
    expect(yearAllowance(annual, '2027-02-01', 2026)).toBe(0);
  });

  it('gives a twelfth for each month worked', () => {
    // From 1 July: six months, half of eighteen.
    expect(yearAllowance(annual, '2026-07-01', 2026)).toBe(9);
    // From 16 July: half of July and five more months, 5.5 twelfths of 18 is 8.25.
    expect(yearAllowance(annual, '2026-07-16', 2026)).toBe(8);
    expect(yearAllowance(annual, '2026-01-01', 2026)).toBe(18);
    expect(yearAllowance(annual, '2026-12-31', 2026)).toBe(0);
  });
});

describe('an allowance worked out', () => {
  it('is the days a year for somebody settled in', () => {
    const out = workOutAllowance({ rule: annual, hiredOn: '2024-02-01', year: 2026, previous: null });
    expect(out).toMatchObject({ days: 18, entitlement: 18, carried: 0, basis: '18 days a year' });
  });

  it('says where the extra days came from', () => {
    const out = workOutAllowance({ rule: annual, hiredOn: '2019-02-01', year: 2026, previous: null });
    expect(out?.days).toBe(20);
    expect(out?.basis).toBe('18 days a year, plus 2 days for long service');
  });

  it('says why a first year is short', () => {
    const out = workOutAllowance({ rule: annual, hiredOn: '2026-07-01', year: 2026, previous: null });
    expect(out?.days).toBe(9);
    expect(out?.basis).toBe('18 days a year; 9 days this year, having started on 01 Jul 2026');
  });

  it('carries last year over only where the type says so', () => {
    const previous = { allowance: 18, used: 11 };
    expect(workOutAllowance({ rule: annual, hiredOn: '2024-02-01', year: 2026, previous })?.days).toBe(18);
    const out = workOutAllowance({ rule: carrying, hiredOn: '2024-02-01', year: 2026, previous });
    expect(out).toMatchObject({ days: 25, entitlement: 18, carried: 7 });
    expect(out?.basis).toBe('18 days a year; 7 days carried over from 2025');
  });

  it('carries nothing when last year was overspent', () => {
    expect(workOutAllowance({ rule: carrying, hiredOn: '2024-02-01', year: 2026, previous: { allowance: 18, used: 21 } })?.carried).toBe(0);
  });

  it('works nothing out for a type with no days a year', () => {
    expect(workOutAllowance({ rule: { ...DEFAULT_ENTITLEMENT.unpaid, carryForward: true }, hiredOn: '2024-02-01', year: 2026, previous: null })).toBeNull();
  });
});
