import {
  componentApplies,
  conditionHolds,
  deferredSchedule,
  fullYears,
  installmentSchedule,
  maskAccount,
  nextPeriod,
  type ApplicableComponent,
  type ConditionSubject,
} from './pay-items';

const subject: ConditionSubject = {
  sex: 'female',
  maritalStatus: 'married',
  childrenCount: 2,
  yearsOfService: 3,
  priorExperienceYears: 5,
  employeeTypeId: 'type-1',
  jobPositionId: 'cook',
  departmentIds: ['kitchen', 'events'],
  branchId: 'boutique',
  wageBasis: 'monthly',
};

const component = (c: Partial<ApplicableComponent> = {}): ApplicableComponent => ({
  id: 'transport',
  appliesAllActive: true,
  oneOffPeriod: null,
  conditionField: null,
  conditionOp: null,
  conditionValue: null,
  ...c,
});

const person = (p: Partial<Parameters<typeof componentApplies>[1]> = {}): Parameters<typeof componentApplies>[1] => ({
  subject,
  structureComponentIds: new Set(),
  target: null,
  ...p,
});

describe('which components apply (058-payroll AC-PY5)', () => {
  it('reaches everyone when it targets all active staff, unless it excludes them', () => {
    expect(componentApplies(component(), person(), '2026-10')).toBe(true);
    expect(componentApplies(component(), person({ target: 'exclude' }), '2026-10')).toBe(false);
  });

  it('reaches a person through their structure or an include, and nobody else', () => {
    const narrow = component({ appliesAllActive: false });
    expect(componentApplies(narrow, person(), '2026-10')).toBe(false);
    expect(componentApplies(narrow, person({ structureComponentIds: new Set(['transport']) }), '2026-10')).toBe(true);
    expect(componentApplies(narrow, person({ target: 'include' }), '2026-10')).toBe(true);
  });

  it('applies a one off only in its month', () => {
    const once = component({ oneOffPeriod: '2026-12' });
    expect(componentApplies(once, person(), '2026-11')).toBe(false);
    expect(componentApplies(once, person(), '2026-12')).toBe(true);
  });

  it('holds a condition on one field from the closed list', () => {
    expect(conditionHolds('children', 'gte', '1', subject)).toBe(true);
    expect(conditionHolds('children', 'gt', '2', subject)).toBe(false);
    expect(conditionHolds('years_of_service', 'gte', '3', subject)).toBe(true);
    expect(conditionHolds('sex', 'eq', 'female', subject)).toBe(true);
    expect(conditionHolds('marital_status', 'in', 'single, married', subject)).toBe(true);
    expect(conditionHolds('department', 'eq', 'events', subject)).toBe(true);
    expect(conditionHolds('department', 'ne', 'kitchen', subject)).toBe(false);
    expect(conditionHolds('wage_basis', 'ne', 'daily', subject)).toBe(true);
    // An ordering on a field without one matches nobody.
    expect(conditionHolds('job_position', 'gt', 'cook', subject)).toBe(false);
    expect(componentApplies(component({ conditionField: 'children', conditionOp: 'gte', conditionValue: '3' }), person(), '2026-10')).toBe(false);
  });
});

describe("a loan's schedule (AC-PY8)", () => {
  it('rounds each installment down and gives the last the remainder', () => {
    const s = installmentSchedule(100_000, 3, '2026-11');
    expect(s).toEqual([
      { period: '2026-11', amountRwf: 33_333 },
      { period: '2026-12', amountRwf: 33_333 },
      { period: '2027-01', amountRwf: 33_334 },
    ]);
    expect(s.reduce((a, i) => a + i.amountRwf, 0)).toBe(100_000);
  });

  it('defers an installment by moving it and every later one a month, later ones first', () => {
    const moved = deferredSchedule(
      [
        { id: 'a', period: '2026-11' },
        { id: 'b', period: '2026-12' },
        { id: 'c', period: '2027-01' },
      ],
      '2026-12',
    );
    expect(moved).toEqual([
      { id: 'c', from: '2027-01', to: '2027-02' },
      { id: 'b', from: '2026-12', to: '2027-01' },
    ]);
  });

  it('counts months and full years across a year end', () => {
    expect(nextPeriod('2026-12')).toBe('2027-01');
    expect(fullYears('2023-10-06', '2026-10-05')).toBe(2);
    expect(fullYears('2023-10-05', '2026-10-05')).toBe(3);
  });
});

describe('a pay account on a payslip (AC-PY11)', () => {
  it('shows the last four digits only', () => {
    expect(maskAccount({ kind: 'bank', bankName: 'Bank of Kigali', accountNumber: '00040-0123456-78', momoPhone: null })).toBe('Bank of Kigali •••• 5678');
    expect(maskAccount({ kind: 'momo', bankName: null, accountNumber: null, momoPhone: '+250788123456' })).toBe('MoMo •••• 3456');
    expect(maskAccount(null)).toBeNull();
  });
});
