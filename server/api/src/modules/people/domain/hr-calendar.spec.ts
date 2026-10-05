import {
  addDays,
  crossesMidnight,
  eachMonth,
  isWeekday,
  kigaliDateOf,
  lastOfMonth,
  mondayOf,
  payableThirtieths,
  roundHalfUp,
  shiftInstants,
} from './hr-calendar';

describe('hr calendar (ADR-058 index contract 9)', () => {
  describe('payable thirtieths', () => {
    it('pays a full month as 30, whatever its length', () => {
      expect(payableThirtieths({ startsOn: '2025-01-01', endsOn: null }, '2026-02')).toBe(30);
      expect(payableThirtieths({ startsOn: '2025-01-01', endsOn: null }, '2026-07')).toBe(30);
    });

    it('takes off the days before a start inside the month', () => {
      // 30 less the 15 days of September before the 16th.
      expect(payableThirtieths({ startsOn: '2026-09-16', endsOn: null }, '2026-09')).toBe(15);
    });

    it('takes off the days after an end inside the month', () => {
      // A 31 day month ending on the 15th: 30 less 16 days after it.
      expect(payableThirtieths({ startsOn: '2025-01-01', endsOn: '2026-10-15' }, '2026-10')).toBe(14);
    });

    it('keeps the figure between 0 and 30', () => {
      // February: hired on the 28th, 27 days before it, so 3.
      expect(payableThirtieths({ startsOn: '2026-02-28', endsOn: null }, '2026-02')).toBe(3);
      // Ending on the 1st of a 31 day month: 30 less 30 is 0, never negative.
      expect(payableThirtieths({ startsOn: '2025-01-01', endsOn: '2026-10-01' }, '2026-10')).toBe(0);
    });

    it('pays nothing for a contract that does not touch the month', () => {
      expect(payableThirtieths({ startsOn: '2026-11-01', endsOn: null }, '2026-10')).toBe(0);
      expect(payableThirtieths({ startsOn: '2025-01-01', endsOn: '2026-09-30' }, '2026-10')).toBe(0);
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
