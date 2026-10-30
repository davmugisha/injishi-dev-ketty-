import { describe, expect, it } from 'vitest';

import { applyRate, computePayslip, dayRatePay, dayUnits, overtimePay, payeOn, percentOf, wageForDays, type PayComponentInput } from './pay-computation';
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

  it('takes partly paid leave at the unpaid share of a thirtieth, exactly (058-leave AC-LV1)', () => {
    // 200,000 a month: a day is 6,666.67. Two and a half days paid at 60% leave
    // 40% unpaid: 200,000 × 2.5 × 40 / 3,000 = 6,666.67, half up 6,667.
    const p = slip({ partialLeaveByContract: new Map([['c1', new Map([[40, 2.5]])]]) });
    const partial = p.lines.find((l) => l.code === 'partly_paid_leave');
    expect(partial?.amountRwf).toBe(-6_667);
    expect(p.grossRwf).toBe(193_333);
  });

  it('never lets unpaid and partly paid leave together pass the days the contract paid', () => {
    const p = slip({
      unpaidDaysByContract: new Map([['c1', 29]]),
      partialLeaveByContract: new Map([['c1', new Map([[50, 3]])]]),
    });
    const partial = p.lines.find((l) => l.code === 'partly_paid_leave');
    expect(partial?.basis.startsWith('1 day ')).toBe(true);
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

  it('splits a 31 day month 14.52 and 15.48 on a raise on the 16th, adding to exactly 30 (058-payroll AC-PY1)', () => {
    const p = slip({
      period: '2026-10',
      contracts: [
        { id: 'old', startsOn: '2025-01-01', endsOn: '2026-10-15', wageBasis: 'monthly', wageRwf: 150_000 },
        { id: 'new', startsOn: '2026-10-16', endsOn: null, wageBasis: 'monthly', wageRwf: 210_000 },
      ],
    });
    // 150,000 × 14.52 ÷ 30 and 210,000 × 15.48 ÷ 30.
    expect(p.lines.filter((l) => l.code === 'wage').map((l) => l.amountRwf)).toEqual([72_600, 108_360]);
    expect(p.payableDays).toBe(30);
  });

  it('pays a daily wage per date worked: a whole day from the threshold, half from half of it (AC-PY2)', () => {
    const p = slip({
      contracts: [{ id: 'd', startsOn: '2025-01-01', endsOn: null, wageBasis: 'daily', wageRwf: 5_000 }],
      workDays: [
        { workDate: '2026-09-01', contractId: 'd', workedMinutes: 420 },
        { workDate: '2026-09-02', contractId: 'd', workedMinutes: 200 },
        { workDate: '2026-09-03', contractId: 'd', workedMinutes: 100 },
        // Two shifts on one date are one day.
        { workDate: '2026-09-04', contractId: 'd', workedMinutes: 200 },
        { workDate: '2026-09-04', contractId: 'd', workedMinutes: 200 },
      ],
    });
    const days = p.lines.find((l) => l.code === 'daily_wage');
    expect(days?.basis).toBe('2.5 days × 5000');
    expect(days?.amountRwf).toBe(12_500);
  });

  it('pays an hourly wage to the minute, and paid leave at the day rate (AC-PY2)', () => {
    const p = slip({
      contracts: [{ id: 'h', startsOn: '2025-01-01', endsOn: null, wageBasis: 'hourly', wageRwf: 2_000 }],
      workDays: [{ workDate: '2026-09-01', contractId: 'h', workedMinutes: 450 }],
      paidLeaveByContract: new Map([['h', new Map([[100, 1], [60, 1]])]]),
    });
    expect(p.lines.find((l) => l.code === 'hourly_wage')?.amountRwf).toBe(15_000);
    // Eight hours a day: 16,000 for the paid day, 60% of it for the other.
    expect(p.lines.filter((l) => l.code === 'paid_leave').map((l) => l.amountRwf)).toEqual([16_000, 9_600]);
  });

  it('pays approved overtime at the hourly rate times the kind of day (AC-PY4)', () => {
    const rule = { monthlyHoursDivisor: 173.33, multipliers: { weekday: 1.5, weekly_off: 2, public_holiday: 2.5 }, taxable: true, contributable: false };
    const p = slip({
      contracts: [{ id: 'c1', startsOn: '2025-01-01', endsOn: null, wageBasis: 'monthly', wageRwf: 173_330 }],
      overtime: [
        { contractId: 'c1', dayKind: 'weekday', approvedMinutes: 90 },
        { contractId: 'c1', dayKind: 'weekly_off', approvedMinutes: 60 },
      ],
      overtimeRule: rule,
    });
    // 1,000 an hour: 1.5 h × 1.5 and 1 h × 2.
    expect(p.lines.filter((l) => l.code === 'overtime').map((l) => l.amountRwf)).toEqual([2_250, 2_000]);
    expect(p.lines.find((l) => l.code === 'overtime')?.contributable).toBe(false);
    expect(overtimePay({ wageBasis: 'daily', wageRwf: 8_000 }, 60, 1.5, rule)).toBe(1_500);
  });

  it('applies allowances and deductions in order, the taxable base less what is taken before tax (AC-PY5, AC-PY6)', () => {
    const component = (c: Partial<PayComponentInput> & Pick<PayComponentInput, 'code' | 'kind' | 'amountType'>): PayComponentInput => ({
      name: c.code,
      amountRwf: null,
      rate: null,
      capRwf: null,
      taxable: true,
      contributable: false,
      beforeTax: false,
      ...c,
    });
    const p = slip({
      paye: { ...PAYE, taxableBase: 'taxable' },
      childrenCount: 2,
      components: [
        component({ code: 'transport', kind: 'allowance', amountType: 'fixed', amountRwf: 20_000 }),
        component({ code: 'children', kind: 'allowance', amountType: 'per_child', amountRwf: 5_000, taxable: false }),
        component({ code: 'housing', kind: 'allowance', amountType: 'percent_basic', rate: 10, capRwf: 15_000 }),
        component({ code: 'pension_top_up', kind: 'deduction', amountType: 'percent_basic', rate: 2, beforeTax: true }),
        component({ code: 'canteen', kind: 'deduction', amountType: 'fixed', amountRwf: 1_000 }),
      ],
      passthrough: [{ code: 'reimbursement', label: 'Taxi fare', contractId: null, basis: 'receipt', amountRwf: 7_000, side: 'passthrough' }],
    });
    expect(p.grossRwf).toBe(200_000 + 20_000 + 10_000 + 15_000);
    // Taxable: 235,000 (the per child allowance is not), less 4,000 taken before tax.
    expect(p.lines.find((l) => l.code === 'paye')?.taxBase).toBe(231_000);
    expect(p.otherDeductionsRwf).toBe(4_000 + 1_000);
    expect(p.nonIncomeRwf).toBe(7_000);
    expect(p.netRwf).toBe(p.grossRwf + 7_000 - p.payeRwf - p.employeeContributionsRwf - 5_000);
  });

  it('can net below zero, which the run blocks rather than hides (AC-PY7)', () => {
    const p = slip({ extraDeductions: [{ code: 'loan', label: 'Loan', contractId: null, basis: 'installment', amountRwf: 300_000, side: 'deduction' }] });
    expect(p.netRwf).toBeLessThan(0);
  });

  it('prices days at the day rate of each wage basis', () => {
    expect(dayRatePay({ wageBasis: 'monthly', wageRwf: 300_000 }, 2)).toBe(20_000);
    expect(dayRatePay({ wageBasis: 'daily', wageRwf: 5_000 }, 1.5)).toBe(7_500);
    expect(dayRatePay({ wageBasis: 'hourly', wageRwf: 1_000 }, 1)).toBe(8_000);
    expect(dayUnits(359, 360)).toBe(0.5);
    expect(dayUnits(179, 360)).toBe(0);
    expect(percentOf(123_457, 12.5)).toBe(15_432);
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
