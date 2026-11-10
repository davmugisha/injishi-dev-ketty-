import { describe, expect, it } from 'vitest';

import { kigaliEnd, kigaliStart, leaveDaysInPeriod, monthsTo, weekdayOf } from './hr-report-rules';

describe('the HR report rules (hr-report-rules)', () => {
  it('counts a leave request wholly inside the period as it was asked', () => {
    expect(leaveDaysInPeriod({ startsOn: '2026-10-05', endsOn: '2026-10-09', days: 5 }, '2026-10-01', '2026-10-31')).toBe(5);
  });

  it('counts its share by calendar days when it runs over an edge, to the half day', () => {
    // 10 days asked over 14 calendar days, 4 of them in October: 10 * 4 / 14 = 2.86, so 3.
    expect(leaveDaysInPeriod({ startsOn: '2026-10-28', endsOn: '2026-11-10', days: 10 }, '2026-10-01', '2026-10-31')).toBe(3);
    expect(leaveDaysInPeriod({ startsOn: '2026-09-25', endsOn: '2026-10-02', days: 6 }, '2026-10-01', '2026-10-31')).toBe(1.5);
  });

  it('counts nothing outside the period', () => {
    expect(leaveDaysInPeriod({ startsOn: '2026-09-01', endsOn: '2026-09-05', days: 5 }, '2026-10-01', '2026-10-31')).toBe(0);
  });

  it('numbers the week from Monday', () => {
    expect(weekdayOf('2026-11-02')).toBe(0); // a Monday
    expect(weekdayOf('2026-11-08')).toBe(6); // a Sunday
  });

  it('lists the months of a pay trend, oldest first, across a new year', () => {
    expect(monthsTo('2026-02', 4)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });

  it('starts and ends a day in Kigali', () => {
    expect(kigaliStart('2026-10-01').toISOString()).toBe('2026-09-30T22:00:00.000Z');
    expect(kigaliEnd('2026-10-31').toISOString()).toBe('2026-10-31T22:00:00.000Z');
  });
});
