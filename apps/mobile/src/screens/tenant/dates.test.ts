/**
 * The tenant surface's calendar arithmetic.
 *
 * Every case here is one a screen actually renders, and most of them are the
 * ones a `Date`-based implementation gets wrong: a month end that would roll
 * over, a term that is a day short of a round year, a due date in the past.
 * `today` is a parameter everywhere, so these assert on exact strings rather
 * than on whatever day the suite happens to run.
 */
import { translate, type MessageKey, type Translate } from '@/i18n/i18n';
import {
  addDays,
  addMonths,
  daysBetween,
  dueCaption,
  formatFullDay,
  formatMonthYear,
  monthsBetween,
  noticeCaption,
} from './dates';

/** The provider-free half of the catalogue, so these need no render. */
const t: Translate = (key, params) => translate(key, params);

/** `translate` typed for the literal keys these assertions name. */
const say = (key: string, params?: Record<string, string | number>) =>
  translate(key as MessageKey, params);

describe('addDays', () => {
  it('crosses a month boundary', () => {
    expect(addDays('2026-09-06', 30)).toBe('2026-10-06');
  });

  it('crosses a year boundary', () => {
    expect(addDays('2026-12-20', 20)).toBe('2027-01-09');
  });

  it('handles a leap day', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('goes backwards', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('addMonths', () => {
  it('keeps the day of the month where it exists', () => {
    expect(addMonths('2026-09-01', 12)).toBe('2027-09-01');
  });

  /**
   * The one `Date` gets wrong. `new Date(2026, 0, 31); setMonth(1)` lands on
   * 3 March, which on a lease end date is a term a month longer than anyone
   * agreed to.
   */
  it('clamps to the end of a shorter target month rather than rolling over', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-08-31', 6)).toBe('2027-02-28');
  });

  it('finds 29 February in a leap year', () => {
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
  });
});

describe('monthsBetween', () => {
  /** Frame R16 prints "TERM 12 months" for exactly this pair. */
  it('reads a day-short year as twelve months, not eleven', () => {
    expect(monthsBetween('2026-09-01', '2027-08-31')).toBe(12);
  });

  it('reads a round two-year term as 24 months', () => {
    expect(monthsBetween('2025-02-01', '2027-02-01')).toBe(24);
  });

  it('reads a six-month term', () => {
    expect(monthsBetween('2027-01-01', '2027-06-30')).toBe(6);
  });
});

describe('daysBetween', () => {
  it('is positive forwards and negative backwards', () => {
    expect(daysBetween('2026-09-06', '2026-09-20')).toBe(14);
    expect(daysBetween('2026-09-20', '2026-09-06')).toBe(-14);
  });
});

describe('formatting', () => {
  it('prints a day as day, full month, year', () => {
    expect(formatFullDay('2026-09-04', t)).toBe('4 September 2026');
  });

  /**
   * The reason the month is not abbreviated: the Kinyarwanda names for
   * October, November and December all cut to `Uk`/`Ug` at three letters.
   */
  it('does not abbreviate in Kinyarwanda, where three letters are confusable', () => {
    const rw: Translate = (key, params) => translate(key, params, 'rw');
    expect(formatFullDay('2026-10-04', rw)).toBe('4 Ukwakira 2026');
    expect(formatFullDay('2026-11-04', rw)).toBe('4 Ugushyingo 2026');
    expect(formatFullDay('2026-12-04', rw)).toBe('4 Ukuboza 2026');
  });

  it('prints a month and year in full', () => {
    expect(formatMonthYear('2026-12-31', t)).toBe('December 2026');
  });
});

describe('dueCaption', () => {
  const today = '2026-09-06';

  it('says today when it is today', () => {
    expect(dueCaption(today, today, t)).toBe(say('tenant.dueToday'));
  });

  it('counts days inside a fortnight', () => {
    expect(dueCaption('2026-09-11', today, t)).toBe(
      say('tenant.dueInDays', { count: 5 }),
    );
  });

  it('switches to weeks past a fortnight, which is what frame R12 prints', () => {
    expect(dueCaption('2026-10-04', today, t)).toBe(
      say('tenant.dueInWeeks', { count: 4 }),
    );
  });

  /**
   * The case the frame does not draw and the screen has to get right: "4 weeks"
   * on a charge that is already late is how rent gets stamped late.
   */
  it('says overdue rather than counting forwards when the date has passed', () => {
    expect(dueCaption('2026-08-01', today, t)).toBe(
      say('tenant.overdueDays', { count: 36 }),
    );
  });

  it('uses the singular key for exactly one day', () => {
    expect(dueCaption('2026-09-07', today, t)).toBe(say('tenant.dueInDay', { count: 1 }));
    expect(dueCaption('2026-09-05', today, t)).toBe(
      say('tenant.overdueDay', { count: 1 }),
    );
  });
});

describe('noticeCaption', () => {
  const today = '2026-09-06';

  it('says the notice is met when it clears the contract', () => {
    expect(noticeCaption('2026-10-31', today, 30, t)).toBe(
      say('tenant.noticeMet', { given: say('tenant.noticeDays', { count: 55 }) }),
    );
  });

  /** FL23 Path A: flagged, not blocked, and the shortfall is legible. */
  it('names both numbers when the notice falls short', () => {
    expect(noticeCaption('2026-09-20', today, 30, t)).toBe(
      say('tenant.noticeShort', {
        given: say('tenant.noticeDays', { count: 14 }),
        required: 30,
      }),
    );
  });
});
