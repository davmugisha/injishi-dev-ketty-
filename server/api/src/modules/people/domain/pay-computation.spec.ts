import { applyRate, computePayslip, payeOn, wageForDays } from './pay-computation';
import type { PayeRule, RssbRule } from './hr-rules';

/**
 * INVENTED rules, for arithmetic only. They are not Rwanda's PAYE bands or RSSB
 * rates, which come from an accountant's sheet (ADR-058 index contract 8); round
 * numbers are used so each expected figure can be checked by hand.
 */
const PAYE: PayeRule = {
  bands: [
    { fromRwf: 0, toRwf: 50_000, rate: 0 },
    { fromRwf: 50_000, toRwf: 150_000, rate: 0.1 },
    { fromRwf: 150_000, toRwf: null, rate: 0.2 },
  ],
  taxableBase: 'gross',
};
const RSSB: RssbRule = {
  contributions: [
    { code: 'pension', label: 'Pension', base: 'gross', employeeRate: 0.05, employerRate: 0.05 },
    { code: 'maternity', label: 'Maternity', base: 'basic', employeeRate: 0.003, employerRate: 0.003 },
  ],
};

function slip(overrides: Partial<Parameters<typeof computePayslip>[0]> = {}): ReturnType<typeof computePayslip> {
  return computePayslip({
    period: '2026-09',
    contracts: [{ id: 'c1', startsOn: '2025-01-01', endsOn: null, wageBasis: 'monthly', wageRwf: 200_000 }],
    unpaidDaysByContract: new Map(),
    paye: PAYE,
    rssb: RSSB,
    ...overrides,
  });
}

describe('pay computation (ADR-058 AC-Y1, AC-Y2, AC-Y4)', () => {
  it('computes a full month in the fixed order', () => {
    const p = slip();
    expect(p.grossRwf).toBe(200_000);
    // Pension 5% of 200,000 and maternity 0.3% of 200,000.
    expect(p.employeeContributionsRwf).toBe(10_000 + 600);
    expect(p.employerContributionsRwf).toBe(10_000 + 600);
    // 10% of 100,000 plus 20% of 50,000.
    expect(p.payeRwf).toBe(20_000);
    expect(p.netRwf).toBe(200_000 - 20_000 - 10_600);
    expect(p.payableDays).toBe(30);
  });

  it('taxes gross less employee contributions when the rule says so', () => {
    const p = slip({ paye: { ...PAYE, taxableBase: 'gross_less_employee_contributions' } });
    // Taxable 189,400: 10,000 + 20% of 39,400.
    expect(p.payeRwf).toBe(10_000 + 7_880);
  });

  it('caps a contribution base when the row names a cap', () => {
    const p = slip({
      rssb: {
        contributions: [
          { code: 'medical', label: 'Medical', base: 'gross', employeeRate: 0.075, employerRate: 0.075, capRwf: 100_000 },
        ],
      },
    });
    expect(p.employeeContributionsRwf).toBe(7_500);
  });

  it('gives one payslip two line groups for a wage change on the 16th', () => {
    const p = slip({
      contracts: [
        { id: 'old', startsOn: '2025-01-01', endsOn: '2026-09-15', wageBasis: 'monthly', wageRwf: 150_000 },
        { id: 'new', startsOn: '2026-09-16', endsOn: null, wageBasis: 'monthly', wageRwf: 210_000 },
      ],
    });
    const wages = p.lines.filter((l) => l.code === 'wage');
    expect(wages.map((l) => l.contractId)).toEqual(['old', 'new']);
    // 15/30 of each.
    expect(wages.map((l) => l.amountRwf)).toEqual([75_000, 105_000]);
    expect(p.grossRwf).toBe(180_000);
    expect(p.contractId).toBe('new');
    expect(p.payableDays).toBe(30);
  });

  it('takes unpaid leave at a thirtieth of the wage a day, halves counted', () => {
    const p = slip({ unpaidDaysByContract: new Map([['c1', 1.5]]) });
    const unpaid = p.lines.find((l) => l.code === 'unpaid_leave');
    expect(unpaid?.amountRwf).toBe(-10_000);
    expect(p.grossRwf).toBe(190_000);
  });

  it('keeps every amount column equal to the sum of its lines', () => {
    const p = slip({
      contracts: [
        { id: 'a', startsOn: '2025-01-01', endsOn: '2026-09-10', wageBasis: 'monthly', wageRwf: 123_457 },
        { id: 'b', startsOn: '2026-09-11', endsOn: null, wageBasis: 'monthly', wageRwf: 187_654 },
      ],
      unpaidDaysByContract: new Map([['b', 2.5]]),
    });
    const sum = (f: (l: (typeof p.lines)[number]) => boolean): number =>
      p.lines.filter(f).reduce((s, l) => s + l.amountRwf, 0);
    expect(p.grossRwf).toBe(sum((l) => l.side === 'earning'));
    expect(p.payeRwf).toBe(sum((l) => l.code === 'paye'));
    expect(p.employeeContributionsRwf).toBe(sum((l) => l.side === 'employee' && l.code !== 'paye'));
    expect(p.employerContributionsRwf).toBe(sum((l) => l.side === 'employer'));
    expect(p.netRwf).toBe(p.grossRwf - p.payeRwf - p.employeeContributionsRwf - p.otherDeductionsRwf);
    for (const l of p.lines) expect(Number.isInteger(l.amountRwf)).toBe(true);
  });

  it('refuses a daily or hourly contract rather than paying it nothing', () => {
    expect(() =>
      slip({
        contracts: [{ id: 'd', startsOn: '2025-01-01', endsOn: null, wageBasis: 'daily', wageRwf: 5_000 }],
      }),
    ).toThrow();
  });

  describe('exact rounding', () => {
    it('rounds a half franc up, where a float would lean', () => {
      // 150 × 0.003 is 0.45 exactly; 250 × 0.002 is 0.5 exactly.
      expect(applyRate(150, 0.003)).toBe(0);
      expect(applyRate(250, 0.002)).toBe(1);
      expect(applyRate(250, 0.002, 'down')).toBe(0);
      expect(applyRate(1_001, 0.5, 'up')).toBe(501);
    });

    it('prorates a wage in thirtieths without drift', () => {
      expect(wageForDays(250_000, 16)).toBe(133_333);
      expect(wageForDays(100_001, 0.5)).toBe(1_667);
    });

    it('sums band slices before rounding once', () => {
      expect(payeOn(0, PAYE)).toBe(0);
      expect(payeOn(50_001, PAYE)).toBe(0); // 0.1 of one franc rounds to 0
      expect(payeOn(50_005, PAYE)).toBe(1); // 0.5 rounds half up
    });
  });
});
