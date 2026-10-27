import {
  addMonth,
  districtChangeFrom,
  effectiveScope,
  graceUntil,
  periodProblem,
  upgradeCharge,
  type LivePlan,
} from './broker-plan-rules';
import { kigaliToday } from '@injishi/contracts';

const province = (over: Partial<LivePlan> = {}): LivePlan => ({
  plan: 'province',
  status: 'active',
  provinceId: 1,
  periodEnd: '2026-11-23',
  cancelAtPeriodEnd: false,
  ...over,
});

describe('broker plan rules', () => {
  describe('effectiveScope', () => {
    it('is the home district with no paid plan', () => {
      expect(effectiveScope(null, 102, '2026-10-23')).toEqual({ plan: 'district', districtId: 102 });
    });

    it('shows nothing on District until a district is chosen', () => {
      expect(effectiveScope(null, null, '2026-10-23')).toEqual({ plan: 'district', districtId: null });
    });

    it('is the chosen province on Province, and everywhere on Country', () => {
      expect(effectiveScope(province(), 102, '2026-10-30')).toEqual({ plan: 'province', provinceId: 1 });
      expect(effectiveScope(province({ plan: 'country', provinceId: null }), 102, '2026-10-30')).toEqual({ plan: 'country' });
    });

    it('keeps a past-due plan for three days of grace, then drops to District', () => {
      const due = province({ status: 'past_due' });
      expect(effectiveScope(due, 102, '2026-11-23').plan).toBe('province');
      expect(effectiveScope(due, 102, '2026-11-25').plan).toBe('province');
      expect(effectiveScope(due, 102, '2026-11-26')).toEqual({ plan: 'district', districtId: 102 });
      expect(graceUntil('2026-11-23')).toBe('2026-11-25');
    });

    it('ends a cancelled plan on its last day', () => {
      const ending = province({ cancelAtPeriodEnd: true });
      expect(effectiveScope(ending, 102, '2026-11-22').plan).toBe('province');
      expect(effectiveScope(ending, 102, '2026-11-23').plan).toBe('district');
    });
  });

  describe('upgradeCharge', () => {
    it('is the full price from District', () => {
      expect(upgradeCharge(25_000, null, '2026-10-23')).toBe(25_000);
    });

    it('credits what is left of a paid month', () => {
      // 31 days, 21 left: 10,000 × 21 / 31 = 6,774 credit.
      const current = { priceRwf: 10_000, periodStart: '2026-10-13', periodEnd: '2026-11-13', status: 'active' as const };
      expect(upgradeCharge(25_000, current, '2026-10-23')).toBe(25_000 - 6_774);
    });

    it('credits nothing for an unpaid month, and never charges below RWF 100', () => {
      const due = { priceRwf: 10_000, periodStart: '2026-09-23', periodEnd: '2026-10-23', status: 'past_due' as const };
      expect(upgradeCharge(25_000, due, '2026-10-23')).toBe(25_000);
      const fresh = { priceRwf: 10_000, periodStart: '2026-10-23', periodEnd: '2026-11-23', status: 'active' as const };
      expect(upgradeCharge(10_000, fresh, '2026-10-23')).toBe(100);
    });
  });

  describe('periods', () => {
    it('adds a month, clamped to its length', () => {
      expect(addMonth('2026-10-23')).toBe('2026-11-23');
      expect(addMonth('2026-01-31')).toBe('2026-02-28');
      expect(addMonth('2026-12-15')).toBe('2027-01-15');
    });

    it('refuses a month that starts in the past or ends before it starts', () => {
      expect(periodProblem('2026-10-23', '2026-11-23', '2026-10-23')).toBeNull();
      expect(periodProblem('2026-10-22', '2026-11-22', '2026-10-23')).toMatch(/past/);
      expect(periodProblem('2026-10-23', '2026-10-23', '2026-10-23')).toMatch(/after it starts/);
    });
  });

  describe('districtChangeFrom', () => {
    const now = new Date('2026-10-23T08:00:00Z');
    it('allows a first choice, and one move per 30 days', () => {
      expect(districtChangeFrom(null, now, kigaliToday)).toBeNull();
      expect(districtChangeFrom(new Date('2026-10-10T08:00:00Z'), now, kigaliToday)).toBe('2026-11-09');
      expect(districtChangeFrom(new Date('2026-09-20T08:00:00Z'), now, kigaliToday)).toBeNull();
    });
  });
});
