import {
  addMonths,
  compensatoryDays,
  completedMonths,
  completedYears,
  drawLots,
  eligibilityRefusal,
  entitlementFor,
  lotStates,
  planLotEvents,
  restrictionFor,
  type LedgerItem,
  type PlannedRow,
} from './leave-lots';

let seq = 0;
const credit = (kind: 'accrual' | 'carry_forward' | 'adjustment', days: number, effectiveOn: string, expiresOn: string | null = null, periodKey: string | null = null): LedgerItem => ({
  id: `c${(seq += 1)}`,
  kind,
  days,
  effectiveOn,
  lotId: null,
  expiresOn,
  reversesId: null,
  periodKey,
});
const debit = (kind: 'taken' | 'encashed' | 'expiry', days: number, effectiveOn: string, lotId: string | null): LedgerItem => ({
  id: `d${(seq += 1)}`,
  kind,
  days: -days,
  effectiveOn,
  lotId,
  expiresOn: null,
  reversesId: null,
  periodKey: null,
});
/** Planned rows as the service would write them, planned lot references resolved. */
function written(rows: PlannedRow[]): LedgerItem[] {
  const ids = new Map<string, string>();
  return rows.map((r) => {
    const id = `w${(seq += 1)}`;
    ids.set(r.ref, id);
    return {
      id,
      kind: r.kind,
      days: r.days,
      effectiveOn: r.effectiveOn,
      lotId: r.lotId ?? (r.lotRef ? ids.get(r.lotRef) ?? null : null),
      expiresOn: r.expiresOn,
      reversesId: null,
      periodKey: r.periodKey,
    };
  });
}

const yearly = { reset: 'yearly' as const, carry: 'carry_with_expiry' as const, carryMaxDays: 5, carryExpiresMonths: 3 };

describe('lots (058-leave AC-LV2 to AC-LV4)', () => {
  it('the critical scenario: 10 left carries 5 for three months, February draws carried first, April expires the rest', () => {
    const lot2025 = credit('accrual', 10, '2025-01-01', null, '2025');
    const ledger: LedgerItem[] = [lot2025];

    // On 1 January: every 2025 lot expires, then 5 are carried, expiring on 1 April.
    const jan = planLotEvents(ledger, yearly, '2026-01-01');
    expect(jan.map((r) => [r.kind, r.days, r.effectiveOn, r.expiresOn])).toEqual([
      ['expiry', -10, '2026-01-01', null],
      ['carry_forward', 5, '2026-01-01', '2026-04-01'],
    ]);
    ledger.push(...written(jan));
    const carried = ledger.find((i) => i.kind === 'carry_forward') as LedgerItem;
    const accrual2026 = credit('accrual', 18, '2026-01-01', null, '2026');
    ledger.push(accrual2026);

    // A 3 day leave in February draws the carried lot first: it ends sooner.
    expect(drawLots(ledger, 'yearly', '2026-02-02', 3)).toEqual([{ lotId: carried.id, days: 3 }]);
    ledger.push(debit('taken', 3, '2026-02-02', carried.id));

    // On 1 April the 2 carried days left expire; the year's accrual is untouched.
    const april = planLotEvents(ledger, yearly, '2026-04-01');
    expect(april.map((r) => [r.kind, r.days, r.lotId])).toEqual([['expiry', -2, carried.id]]);
    ledger.push(...written(april));
    const states = lotStates(ledger, 'yearly');
    expect(states.find((l) => l.id === carried.id)?.remaining).toBe(0);
    expect(states.find((l) => l.id === accrual2026.id)?.remaining).toBe(18);
    // A rerun plans nothing.
    expect(planLotEvents(ledger, yearly, '2026-10-05')).toEqual([]);
  });

  it('carries the smaller of the sum and the maximum, and nothing when it does not carry', () => {
    const ledger = [credit('accrual', 3, '2025-03-01', null, '2025-03'), credit('accrual', 2, '2025-04-01', null, '2025-04')];
    const plan = planLotEvents(ledger, { ...yearly, carryMaxDays: 10 }, '2026-01-15');
    expect(plan.filter((r) => r.kind === 'carry_forward').map((r) => r.days)).toEqual([5]);
    expect(planLotEvents(ledger, { ...yearly, carry: 'none', carryExpiresMonths: null }, '2026-01-15').every((r) => r.kind === 'expiry')).toBe(true);
  });

  it('a catch up after downtime plans every missed year in date order', () => {
    const ledger = [credit('accrual', 12, '2024-01-01', null, '2024')];
    const plan = planLotEvents(ledger, { reset: 'yearly', carry: 'carry', carryMaxDays: 4, carryExpiresMonths: null }, '2026-06-01');
    expect(plan.map((r) => [r.kind, r.days, r.effectiveOn])).toEqual([
      ['expiry', -12, '2025-01-01'],
      ['carry_forward', 4, '2025-01-01'],
      ['expiry', -4, '2026-01-01'],
      ['carry_forward', 4, '2026-01-01'],
    ]);
    // The second expiry names the first carried lot, which was only planned.
    expect(plan[2].lotRef).toBe(plan[1].ref);
  });

  it('a monthly type expires each month\'s lots at the month end and never carries', () => {
    const ledger = [credit('accrual', 1.5, '2026-08-01', null, '2026-08'), credit('accrual', 1.5, '2026-09-01', null, '2026-09')];
    ledger.push(debit('taken', 1, '2026-08-10', ledger[0].id));
    const plan = planLotEvents(ledger, { reset: 'monthly', carry: 'none', carryMaxDays: 0, carryExpiresMonths: null }, '2026-10-05');
    expect(plan.map((r) => [r.kind, r.days, r.effectiveOn])).toEqual([
      ['expiry', -0.5, '2026-09-01'],
      ['expiry', -1.5, '2026-10-01'],
    ]);
  });

  it('an adjustment lot of a type that never resets expires on its own date', () => {
    const lot = credit('adjustment', 1, '2026-05-01', '2026-08-01');
    const plan = planLotEvents([lot], { reset: 'never', carry: 'none', carryMaxDays: 0, carryExpiresMonths: null }, '2026-10-05');
    expect(plan.map((r) => [r.kind, r.days, r.effectiveOn, r.lotId])).toEqual([['expiry', -1, '2026-08-01', lot.id]]);
  });

  it('a reversal gives the days back to the lot it names', () => {
    const lot = credit('accrual', 6, '2026-01-01', null, '2026');
    const taken = debit('taken', 2, '2026-03-02', lot.id);
    const reversal: LedgerItem = { ...debit('taken', 0, '2026-03-02', lot.id), kind: 'reversal', days: 2, reversesId: taken.id };
    expect(lotStates([lot, taken], 'yearly')[0].remaining).toBe(4);
    expect(lotStates([lot, taken, reversal], 'yearly')[0].remaining).toBe(6);
  });

  it('a debit naming no lot draws the lots valid on its own date, and never a year it is not in', () => {
    const lot2026 = credit('accrual', 2, '2026-01-01', null, '2026');
    const lot2027 = credit('accrual', 3, '2027-01-01', null, '2027');
    // Booked in 2026 for January 2027, funded by accrual not yet written.
    const future = debit('taken', 2, '2027-01-04', null);
    const states = lotStates([lot2026, lot2027, future], 'yearly');
    expect(states.find((l) => l.id === lot2026.id)?.remaining).toBe(2);
    expect(states.find((l) => l.id === lot2027.id)?.remaining).toBe(1);
  });

  it('a draw names no lot for days no written lot covers yet', () => {
    const lot = credit('accrual', 1, '2026-10-01', null, '2026-10');
    expect(drawLots([lot], 'yearly', '2026-12-14', 3)).toEqual([
      { lotId: lot.id, days: 1 },
      { lotId: null, days: 2 },
    ]);
  });
});

describe('seniority (AC-LV5)', () => {
  const type = { yearlyEntitlementDays: 18, seniorityEveryYears: 3, seniorityExtraDays: 1, seniorityCapDays: 2 };
  it('adds a day for every three completed years, capped at two', () => {
    expect(entitlementFor(type, '2020-03-01', 2022)).toBe(18);
    expect(entitlementFor(type, '2020-03-01', 2024)).toBe(19);
    expect(entitlementFor(type, '2010-03-01', 2026)).toBe(20);
    expect(entitlementFor({ ...type, seniorityEveryYears: null, seniorityExtraDays: null }, '2010-03-01', 2026)).toBe(18);
    expect(entitlementFor({ ...type, yearlyEntitlementDays: null }, '2010-03-01', 2026)).toBeNull();
  });
});

describe('eligibility (AC-LV6)', () => {
  const maternity = { name: 'Maternity leave', eligibleSex: 'female' as const, minServiceMonths: 0, oncePerEmployment: false };
  it('refuses a man maternity leave, naming the rule', () => {
    expect(eligibilityRefusal(maternity, { sex: 'male', serviceFrom: '2020-01-01' }, '2026-10-12', false)).toMatch(/for women/);
    expect(eligibilityRefusal(maternity, { sex: 'female', serviceFrom: '2020-01-01' }, '2026-10-12', false)).toBeNull();
  });
  it('counts months of service to the leave\'s first day, and once per employment', () => {
    const sabbatical = { name: 'Sabbatical', eligibleSex: null, minServiceMonths: 12, oncePerEmployment: true };
    expect(eligibilityRefusal(sabbatical, { sex: null, serviceFrom: '2026-01-15' }, '2026-10-12', false)).toMatch(/12 months/);
    expect(eligibilityRefusal(sabbatical, { sex: null, serviceFrom: '2025-01-15' }, '2026-10-12', true)).toMatch(/once per employment/);
  });
});

describe('restricted periods (AC-LV9)', () => {
  const season = { id: 'p1', title: 'High season', fromDate: '2026-12-15', toDate: '2027-01-05', departmentId: 'kitchen', jobPositionIds: ['cook'], typeMode: 'except' as const, leaveTypeIds: ['sick'] };
  const ask = { startsOn: '2026-12-20', endsOn: '2026-12-22', leaveTypeId: 'annual', statutory: false, departmentIds: ['kitchen'], jobPositionId: 'cook' };
  it('applies when dates, department, position and type all fall under it', () => {
    expect(restrictionFor([season], ask)?.id).toBe('p1');
  });
  it('does not apply to a listed exception, another position, or a statutory type', () => {
    expect(restrictionFor([season], { ...ask, leaveTypeId: 'sick' })).toBeNull();
    expect(restrictionFor([season], { ...ask, jobPositionId: 'waiter' })).toBeNull();
    expect(restrictionFor([season], { ...ask, statutory: true })).toBeNull();
    expect(restrictionFor([season], { ...ask, startsOn: '2027-01-06', endsOn: '2027-01-07' })).toBeNull();
  });
});

describe('compensatory days and dates (AC-LV8)', () => {
  it('a whole day at the threshold, half at half of it, none below', () => {
    expect(compensatoryDays(360, 360)).toBe(1);
    expect(compensatoryDays(200, 360)).toBe(0.5);
    expect(compensatoryDays(179, 360)).toBe(0);
  });
  it('counts whole months and years, and adds months clamped to the month', () => {
    expect(addMonths('2026-01-01', 3)).toBe('2026-04-01');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
    expect(completedYears('2020-03-01', '2026-02-28')).toBe(5);
    expect(completedMonths('2026-01-15', '2026-10-14')).toBe(8);
    expect(completedMonths('2026-01-15', '2026-10-15')).toBe(9);
  });
});
