/**
 * The relative stamp and the day boundary.
 *
 * Both are pure and both are the kind of code that is wrong at exactly one
 * value, so the tests sit on the boundaries rather than in the middle of each
 * band: 59 seconds versus 60, the last hour of a day versus the first minute of
 * the next, and the four-week cliff where a relative stamp stops being one.
 *
 * The day tests use real `Date` construction rather than arithmetic on
 * milliseconds, because the thing being asserted is a CALENDAR day, and 23:50
 * to 00:10 is twenty minutes and two days — which is precisely the case an
 * elapsed-hours implementation gets wrong.
 */
import {
  DAY_MS,
  HOUR_MS,
  MINUTE_MS,
  RELATIVE_LIMIT_MS,
  WEEK_MS,
  dayLabel,
  relativeTime,
  sameDay,
} from './relative-time';

const NOW = new Date(2026, 8, 6, 14, 30).getTime();

describe('relativeTime', () => {
  it('says "now" for anything under a minute, including a clock skewed ahead', () => {
    expect(relativeTime(NOW, NOW)).toEqual({ key: 'inbox.timeNow' });
    expect(relativeTime(NOW - 59 * 1000, NOW)).toEqual({ key: 'inbox.timeNow' });
    // A device clock a few seconds behind the fixture must not print a future.
    expect(relativeTime(NOW + 3000, NOW)).toEqual({ key: 'inbox.timeNow' });
  });

  it('counts minutes, then hours, then days, then weeks', () => {
    expect(relativeTime(NOW - MINUTE_MS, NOW)).toEqual({
      key: 'inbox.timeMinutes',
      params: { minutes: 1 },
    });
    expect(relativeTime(NOW - 59 * MINUTE_MS, NOW)).toEqual({
      key: 'inbox.timeMinutes',
      params: { minutes: 59 },
    });
    expect(relativeTime(NOW - 2 * HOUR_MS, NOW)).toEqual({
      key: 'inbox.timeHours',
      params: { hours: 2 },
    });
    expect(relativeTime(NOW - 26 * HOUR_MS, NOW)).toEqual({
      key: 'inbox.timeDays',
      params: { days: 1 },
    });
    expect(relativeTime(NOW - 3 * WEEK_MS, NOW)).toEqual({
      key: 'inbox.timeWeeks',
      params: { weeks: 3 },
    });
  });

  it('hands back nothing past four weeks, so the caller prints a date', () => {
    expect(relativeTime(NOW - (RELATIVE_LIMIT_MS - 1), NOW)).toBeDefined();
    expect(relativeTime(NOW - RELATIVE_LIMIT_MS, NOW)).toBeUndefined();
    expect(relativeTime(NOW - 200 * DAY_MS, NOW)).toBeUndefined();
  });
});

describe('sameDay', () => {
  it('splits on the calendar, not on elapsed time', () => {
    const lateTuesday = new Date(2026, 8, 1, 23, 50).getTime();
    const earlyWednesday = new Date(2026, 8, 2, 0, 10).getTime();
    // Twenty minutes apart, and two different days to everyone who reads them.
    expect(earlyWednesday - lateTuesday).toBe(20 * MINUTE_MS);
    expect(sameDay(lateTuesday, earlyWednesday)).toBe(false);
  });

  it('keeps a whole day together however far apart the two instants are', () => {
    expect(sameDay(new Date(2026, 8, 1, 0, 1).getTime(), new Date(2026, 8, 1, 23, 59).getTime()))
      .toBe(true);
  });

  it('does not confuse the same date in two different months or years', () => {
    expect(sameDay(new Date(2026, 7, 6).getTime(), new Date(2026, 8, 6).getTime())).toBe(false);
    expect(sameDay(new Date(2025, 8, 6).getTime(), new Date(2026, 8, 6).getTime())).toBe(false);
  });
});

describe('dayLabel', () => {
  it('names today and yesterday, and falls back to the date itself', () => {
    expect(dayLabel(NOW - HOUR_MS, NOW)).toEqual({ key: 'inbox.dayToday' });
    expect(dayLabel(new Date(2026, 8, 5, 9, 0).getTime(), NOW)).toEqual({
      key: 'inbox.dayYesterday',
    });

    const older = new Date(2026, 6, 1, 9, 0).getTime();
    expect(dayLabel(older, NOW)).toEqual({ date: older });
  });

  it('calls the small hours of today "Today", not "Yesterday"', () => {
    // 00:30 today is 14 hours before `NOW` — an elapsed-hours implementation
    // would call it yesterday. It is not.
    expect(dayLabel(new Date(2026, 8, 6, 0, 30).getTime(), NOW)).toEqual({ key: 'inbox.dayToday' });
  });
});
