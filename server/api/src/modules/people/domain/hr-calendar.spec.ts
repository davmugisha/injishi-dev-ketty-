import {
  addDays,
  crossesMidnight,
  eachMonth,
  isWeekday,
  kigaliDateOf,
  lastOfMonth,
  monthShares,
  mondayOf,
  roundHalfUp,
  shiftInstants,
} from './hr-calendar';

describe('hr calendar (ADR-058 index contract 9)', () => {
  describe('the share of a month a contract pays (058-payroll AC-PY1)', () => {
    const one = (startsOn: string, endsOn: string | null, period: string): number =>
      monthShares([{ id: 'c', startsOn, endsOn }], period).get('c') ?? 0;

    it('is a full 30 for a covered month, whatever its length', () => {
      expect(one('2025-01-01', null, '2026-02')).toBe(3000);
      expect(one('2025-01-01', null, '2026-07')).toBe(3000);
    });

    it('is 30 × d ÷ N for a start or an end inside the month, to two decimals', () => {
      // Hired on the 16th of a 30 day month: 15 days, 15.00.
      expect(one('2026-09-16', null, '2026-09')).toBe(1500);
      // Ending on the 15th of a 31 day month: 30 × 15 ÷ 31 = 14.516, so 14.52.
      expect(one('2025-01-01', '2026-10-15', '2026-10')).toBe(1452);
      // One day of a 28 day February is 1.07; one day of October 0.97, never 0.
      expect(one('2026-02-28', null, '2026-02')).toBe(107);
      expect(one('2025-01-01', '2026-10-01', '2026-10')).toBe(97);
    });

    it('gives a fully covered split month exactly 30, the last contract taking the rest', () => {
      // A raise on the 16th of a 31 day month: 14.52 and 15.48.
      const s = monthShares(
        [
          { id: 'old', startsOn: '2025-01-01', endsOn: '2026-10-15' },
          { id: 'new', startsOn: '2026-10-16', endsOn: null },
        ],
        '2026-10',
      );
      expect([s.get('old'), s.get('new')]).toEqual([1452, 1548]);
    });

    it('leaves a month with a gap short of 30', () => {
      const s = monthShares(
        [
          { id: 'a', startsOn: '2025-01-01', endsOn: '2026-10-10' },
          { id: 'b', startsOn: '2026-10-21', endsOn: null },
        ],
        '2026-10',
      );
      // 30 × 10 ÷ 31 = 9.68 and 30 × 11 ÷ 31 = 10.65.
      expect([s.get('a'), s.get('b')]).toEqual([968, 1065]);
    });

    it('ends a contract by a planned last day', () => {
      expect(monthShares([{ id: 'c', startsOn: '2025-01-01', endsOn: null }], '2026-09', '2026-09-15').get('c')).toBe(1500);
    });

    it('is 0 for a contract that does not touch the month', () => {
      expect(one('2026-11-01', null, '2026-10')).toBe(0);
      expect(one('2025-01-01', '2026-09-30', '2026-10')).toBe(0);
    });
  });

  describe('shift instants in Kigali (AC-T1)', () => {
    it('places a day shift on the work date at UTC+2', () => {
      const s = shiftInstants('2026-09-30', '07:00:00', '15:00:00');
      expect(s.startsAt.toISOString()).toBe('2026-09-30T05:00:00.000Z');
      expect(s.endsAt.toISOString()).toBe('2026-09-30T13:00:00.000Z');
    });

    it('runs a shift ending before its start past midnight', () => {
      expect(crossesMidnight('22:00', '06:00')).toBe(true);
      const s = shiftInstants('2026-09-30', '22:00', '06:00');
      expect(s.startsAt.toISOString()).toBe('2026-09-30T20:00:00.000Z');
      expect(s.endsAt.toISOString()).toBe('2026-10-01T04:00:00.000Z');
    });
  });

  it('dates an instant in Kigali, not in UTC', () => {
    // 23:30 UTC on the 30th is 01:30 on the 1st in Kigali.
    expect(kigaliDateOf(new Date('2026-09-30T23:30:00Z'))).toBe('2026-10-01');
  });

  it('does date arithmetic across months and years', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(lastOfMonth('2028-02')).toBe('2028-02-29');
    expect(eachMonth('2026-11', '2027-02')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
    expect(isWeekday('2026-10-03')).toBe(false); // a Saturday
    expect(isWeekday('2026-10-05')).toBe(true); // a Monday
  });

  it('finds the Monday of a week that runs Monday to Sunday', () => {
    expect(mondayOf('2026-10-05')).toBe('2026-10-05'); // a Monday is its own
    expect(mondayOf('2026-10-11')).toBe('2026-10-05'); // a Sunday ends the week before it
    expect(mondayOf('2027-01-01')).toBe('2026-12-28'); // across a year
  });

  it('rounds half up, symmetric around zero', () => {
    expect(roundHalfUp(2.5)).toBe(3);
    expect(roundHalfUp(-2.5)).toBe(-3);
    expect(roundHalfUp(2.49)).toBe(2);
  });
});
