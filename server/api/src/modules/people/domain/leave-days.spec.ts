import { countLeaveDays, isContradictoryHalfDay, yearsTouched } from './leave-days';

const none = new Set<string>();

describe('leave days (ADR-058 AC-L3)', () => {
  it('counts Monday to Friday when nothing is rostered', () => {
    // Monday 5 to Sunday 11 October 2026.
    const c = countLeaveDays(
      { startsOn: '2026-10-05', endsOn: '2026-10-11', startHalf: 'full', endHalf: 'full' },
      { rosteredDates: none, holidays: none },
    );
    expect(c.days).toBe(5);
  });

  it('counts a rostered weekend day, and never a public holiday', () => {
    const c = countLeaveDays(
      { startsOn: '2026-10-05', endsOn: '2026-10-11', startHalf: 'full', endHalf: 'full' },
      {
        rosteredDates: new Set(['2026-10-10', '2026-10-11']),
        holidays: new Set(['2026-10-07']),
      },
    );
    // Mon, Tue, Thu, Fri, and the rostered Sat and Sun; Wednesday is a holiday.
    expect(c.days).toBe(6);
  });

  it('allows a half day at either end', () => {
    const c = countLeaveDays(
      { startsOn: '2026-10-05', endsOn: '2026-10-06', startHalf: 'second_half', endHalf: 'first_half' },
      { rosteredDates: none, holidays: none },
    );
    expect(c.days).toBe(1);
  });

  it('refuses a single day that is both halves at once', () => {
    expect(
      isContradictoryHalfDay({ startsOn: '2026-10-05', endsOn: '2026-10-05', startHalf: 'second_half', endHalf: 'first_half' }),
    ).toBe(true);
  });

  it('splits a leave over New Year into two months, each dated on its first leave day', () => {
    const range = { startsOn: '2026-12-30', endsOn: '2027-01-05', startHalf: 'full' as const, endHalf: 'full' as const };
    expect(yearsTouched(range)).toEqual([2026, 2027]);
    const c = countLeaveDays(range, { rosteredDates: none, holidays: new Set(['2027-01-01']) });
    // Wed 30, Thu 31; then Mon 4, Tue 5 (Fri 1 is a holiday, the weekend is off).
    expect(c.byMonth).toEqual([
      { period: '2026-12', days: 2, effectiveOn: '2026-12-30' },
      { period: '2027-01', days: 2, effectiveOn: '2027-01-04' },
    ]);
    expect(c.days).toBe(4);
  });
});
