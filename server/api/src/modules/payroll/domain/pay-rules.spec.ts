import { applyRate, computePayslip, overtimePay, payeOn, RWANDA_PAYE, wageForDays, type PayFacts } from './pay-rules';

const month = (facts: Partial<PayFacts>): PayFacts => ({
  rosteredDays: 22,
  workedDays: 22,
  missedDays: 0,
  lateDays: 0,
  unpaidLeaveDays: 0,
  overtimeMinutes: 0,
  ...facts,
});

describe('PAYE by band', () => {
  it('taxes nothing inside the first band', () => {
    expect(payeOn(60_000, RWANDA_PAYE)).toBe(0);
  });

  it('taxes only the francs inside each band', () => {
    // 0 on the first 60,000; 10% of the next 40,000; 20% of the next 100,000; 30% of the last 200,000.
    expect(payeOn(400_000, RWANDA_PAYE)).toBe(4_000 + 20_000 + 60_000);
    expect(payeOn(100_000, RWANDA_PAYE)).toBe(4_000);
    expect(payeOn(200_000, RWANDA_PAYE)).toBe(24_000);
  });
});

describe('exact arithmetic', () => {
  it('rounds a contribution half up to the whole franc', () => {
    // 0.3% of 150,150 is 450.45; a float product can lean either way.
    expect(applyRate(150_150, 0.003)).toBe(450);
    expect(applyRate(166_500, 0.003)).toBe(500);
  });

  it('takes a thirtieth of the month for a day', () => {
    expect(wageForDays(300_000, 2)).toBe(20_000);
    expect(wageForDays(100_000, 1)).toBe(3_333);
  });

  it('pays overtime at one and a half times the hourly rate', () => {
    // 300,000 a month is 1,250 an hour; 3 h 10 at 1.5 times is 5,937.5.
    expect(overtimePay(300_000, 190)).toBe(5_938);
  });
});

describe('a payslip', () => {
  it('pays a full month with no attendance to read', () => {
    const slip = computePayslip(400_000, null);
    expect(slip.grossRwf).toBe(400_000);
    expect(slip.payeRwf).toBe(84_000);
    // Pension 24,000 and maternity 1,200 on gross; CBHI 0.5% of the 290,800 left.
    expect(slip.employeeContributionsRwf).toBe(24_000 + 1_200 + 1_454);
    // Pension 24,000, maternity 1,200 and occupational hazards 8,000.
    expect(slip.employerContributionsRwf).toBe(33_200);
    expect(slip.netRwf).toBe(289_346);
  });

  it('adds up: gross less everything withheld is the net', () => {
    const slip = computePayslip(275_000, month({ missedDays: 1, overtimeMinutes: 45 }));
    const sum = (side: string): number => slip.lines.filter((l) => l.side === side).reduce((n, l) => n + l.amountRwf, 0);
    expect(sum('earning')).toBe(slip.grossRwf);
    expect(sum('employee')).toBe(slip.payeRwf + slip.employeeContributionsRwf);
    expect(sum('employer')).toBe(slip.employerContributionsRwf);
    expect(slip.netRwf).toBe(slip.grossRwf - sum('employee'));
  });

  it('takes a thirtieth off for a missed shift and for a day of unpaid leave, and adds overtime', () => {
    const slip = computePayslip(300_000, month({ missedDays: 2, unpaidLeaveDays: 1, overtimeMinutes: 190 }));
    const amount = (code: string): number | undefined => slip.lines.find((l) => l.code === code && l.side === 'earning')?.amountRwf;
    expect(amount('absence')).toBe(-20_000);
    expect(amount('unpaid_leave')).toBe(-10_000);
    expect(amount('overtime')).toBe(5_938);
    expect(slip.grossRwf).toBe(275_938);
  });

  it('takes nothing off for being late', () => {
    expect(computePayslip(300_000, month({ lateDays: 9 })).grossRwf).toBe(300_000);
  });

  it('never takes off more than the month', () => {
    const slip = computePayslip(180_000, month({ missedDays: 25, unpaidLeaveDays: 15 }));
    expect(slip.grossRwf).toBe(0);
    expect(slip.netRwf).toBe(0);
  });
});
