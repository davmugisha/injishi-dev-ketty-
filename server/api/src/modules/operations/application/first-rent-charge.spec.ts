import { firstRentCharge, kigaliToday } from './first-rent-charge';

describe('firstRentCharge', () => {
  type LeaseTerms = { monthlyRentRwf: number | null; startDate: string | null };
  const lease = (over: Partial<LeaseTerms> = {}): LeaseTerms => ({
    monthlyRentRwf: 350_000,
    startDate: '2026-09-01',
    ...over,
  });

  it('charges this month, due on the 5th, when activated before the 5th', () => {
    expect(firstRentCharge(lease(), '2026-09-02')).toEqual({
      periodMonth: '2026-09-01',
      dueDate: '2026-09-05',
      amountRwf: 350_000,
    });
  });

  it('gives five days of grace when the 5th has already passed', () => {
    expect(firstRentCharge(lease(), '2026-09-20')?.dueDate).toBe('2026-09-25');
  });

  it('charges the start month for a tenancy that begins next month', () => {
    expect(firstRentCharge(lease({ startDate: '2026-10-01' }), '2026-09-20')).toEqual({
      periodMonth: '2026-10-01',
      dueDate: '2026-10-05',
      amountRwf: 350_000,
    });
  });

  it('never raises back months for a tenancy that started long ago', () => {
    expect(firstRentCharge(lease({ startDate: '2026-03-01' }), '2026-09-02')?.periodMonth).toBe('2026-09-01');
  });

  it('raises nothing on a lease with no agreed rent', () => {
    expect(firstRentCharge(lease({ monthlyRentRwf: null }), '2026-09-02')).toBeNull();
    expect(firstRentCharge(lease({ monthlyRentRwf: 0 }), '2026-09-02')).toBeNull();
  });

  it('reads the calendar day in Kigali, not in UTC', () => {
    // 23:30 UTC on the 30th is already 01:30 on the 1st in Kigali (UTC+2).
    expect(kigaliToday(new Date('2026-09-30T23:30:00Z'))).toBe('2026-10-01');
  });
});
