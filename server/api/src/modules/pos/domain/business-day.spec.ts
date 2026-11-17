import { describe, expect, it } from 'vitest';

import {
  addDays,
  businessDayOf,
  businessDayWindow,
  commonBusinessDayStart,
  dayStart,
  formatDayStart,
  kigaliDay,
} from './business-day';

describe('business day', () => {
  it('with a 00:00 start is exactly the calendar day the reports used before', () => {
    // The old window: dayStart(from) to dayStart(addDays(to, 1)).
    for (const [from, to] of [
      ['2026-11-12', '2026-11-12'],
      ['2026-11-06', '2026-11-12'],
      ['2026-12-31', '2027-01-01'],
      ['2028-02-28', '2028-03-01'],
    ] as const) {
      const w = businessDayWindow(from, to, 0);
      expect(w.start.toISOString()).toBe(dayStart(from).toISOString());
      expect(w.end.toISOString()).toBe(dayStart(addDays(to, 1)).toISOString());
    }
    const at = new Date('2026-11-12T23:30:00Z'); // 01:30 on the 13th in Kigali
    expect(businessDayOf(at, 0)).toBe(kigaliDay(at));
    expect(businessDayOf(at, 0)).toBe('2026-11-13');
  });

  it('counts a sale after midnight in the evening before when the day starts at 04:00', () => {
    expect(businessDayOf(new Date('2026-11-12T23:30:00Z'), 240)).toBe('2026-11-12'); // 01:30 Kigali on the 13th
    expect(businessDayOf(new Date('2026-11-13T01:59:59Z'), 240)).toBe('2026-11-12'); // 03:59:59
    expect(businessDayOf(new Date('2026-11-13T02:00:00Z'), 240)).toBe('2026-11-13'); // 04:00 exactly
  });

  it('runs a window from the start to the same time the next day', () => {
    const w = businessDayWindow('2026-11-12', '2026-11-12', 240);
    expect(w.start.toISOString()).toBe('2026-11-12T02:00:00.000Z'); // 04:00 Kigali
    expect(w.end.toISOString()).toBe('2026-11-13T02:00:00.000Z');
    expect(w.end.getTime() - w.start.getTime()).toBe(86_400_000);
    const week = businessDayWindow('2026-11-06', '2026-11-12', 330);
    expect(week.end.getTime() - week.start.getTime()).toBe(7 * 86_400_000);
    expect(week.start.toISOString()).toBe('2026-11-06T03:30:00.000Z'); // 05:30 Kigali
  });

  it('crosses month and year ends', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-03-01', -1)).toBe('2027-02-28');
    expect(businessDayOf(new Date('2026-12-31T23:00:00Z'), 180)).toBe('2026-12-31'); // 01:00 on 1 Jan
  });

  it('refuses a start outside 00:00 to 11:59', () => {
    expect(() => businessDayOf(new Date(), -1)).toThrow(RangeError);
    expect(() => businessDayOf(new Date(), 720)).toThrow(RangeError);
    expect(() => businessDayWindow('2026-11-12', '2026-11-12', 1.5)).toThrow(RangeError);
    expect(businessDayOf(new Date('2026-11-12T12:00:00Z'), 719)).toBe('2026-11-12');
  });

  it('uses one start for outlets that agree and the calendar day, flagged, for outlets that do not', () => {
    expect(commonBusinessDayStart([])).toEqual({ startMinutes: 0, mixed: false });
    expect(commonBusinessDayStart([240])).toEqual({ startMinutes: 240, mixed: false });
    expect(commonBusinessDayStart([240, 240])).toEqual({ startMinutes: 240, mixed: false });
    expect(commonBusinessDayStart([240, 0])).toEqual({ startMinutes: 0, mixed: true });
  });

  it('formats a start as a clock time', () => {
    expect(formatDayStart(0)).toBe('00:00');
    expect(formatDayStart(240)).toBe('04:00');
    expect(formatDayStart(330)).toBe('05:30');
    expect(formatDayStart(719)).toBe('11:59');
  });
});
