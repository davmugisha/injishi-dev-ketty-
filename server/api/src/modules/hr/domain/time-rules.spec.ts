import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ATTENDANCE_RULES,
  boundariesPassed,
  closeFigures,
  dayKindOf,
  distanceMeters,
  isOrgHoliday,
  isWeeklyOff,
  linkEntry,
  phonePunchVerdict,
  rotationStepOn,
  weeklyOffsFor,
} from './time-rules';

// Kigali is UTC+2 all year: 08:00 Kigali is 06:00Z.
const at = (iso: string): Date => new Date(iso);
const morning = {
  startsAt: at('2026-10-05T06:00:00Z'),
  endsAt: at('2026-10-05T14:00:00Z'),
  breakMinutes: 60,
  minWorkMinutes: null,
};

describe('the link rule (058-time AC-TM15)', () => {
  const night = { id: 'night', startsAt: at('2026-10-05T20:00:00Z'), endsAt: at('2026-10-06T04:00:00Z') };
  const early = { id: 'early', startsAt: at('2026-10-05T06:00:00Z'), endsAt: at('2026-10-05T14:00:00Z') };

  it('links a clock in inside the window before the start', () => {
    expect(linkEntry(at('2026-10-05T03:30:00Z'), [early], 180)?.id).toBe('early');
  });

  it('leaves a clock in before the window unlinked', () => {
    expect(linkEntry(at('2026-10-05T02:59:00Z'), [early], 180)).toBeNull();
  });

  it('links one after the start, until the end', () => {
    expect(linkEntry(at('2026-10-05T13:59:00Z'), [early], 180)?.id).toBe('early');
    expect(linkEntry(at('2026-10-05T14:01:00Z'), [early], 180)).toBeNull();
  });

  it('prefers the nearest start when two windows hold the instant', () => {
    const split = { id: 'split', startsAt: at('2026-10-05T15:00:00Z'), endsAt: at('2026-10-05T19:00:00Z') };
    expect(linkEntry(at('2026-10-05T13:50:00Z'), [early, split], 180)?.id).toBe('split');
    // 12:00Z sits in both windows and is nearer the second start (3 hours) than the first (6).
    expect(linkEntry(at('2026-10-05T12:00:00Z'), [early, split], 180)?.id).toBe('split');
    // Before the second window opens, only the first holds it.
    expect(linkEntry(at('2026-10-05T09:00:00Z'), [early, split], 180)?.id).toBe('early');
  });

  it('keeps a night shift on the day it started', () => {
    expect(linkEntry(at('2026-10-05T19:30:00Z'), [night], 180)?.id).toBe('night');
  });
});

describe('close time figures (AC-TM7)', () => {
  const rules = { ...DEFAULT_ATTENDANCE_RULES, graceInMinutes: 5, graceOutMinutes: 5 };

  it('counts late from the start once past the grace, and nothing inside it', () => {
    const inGrace = closeFigures({ clockInAt: at('2026-10-05T06:04:00Z'), clockOutAt: at('2026-10-05T14:00:00Z'), shift: morning, rules });
    expect(inGrace.lateMinutes).toBe(0);
    const late = closeFigures({ clockInAt: at('2026-10-05T06:12:30Z'), clockOutAt: at('2026-10-05T14:00:00Z'), shift: morning, rules });
    expect(late.lateMinutes).toBe(12);
  });

  it('counts early leaving past the grace', () => {
    const early = closeFigures({ clockInAt: at('2026-10-05T06:00:00Z'), clockOutAt: at('2026-10-05T13:40:00Z'), shift: morning, rules });
    expect(early.earlyMinutes).toBe(20);
    expect(early.workedMinutes).toBe(400);
  });

  it('never counts arriving early as overtime, and counts staying late past the shift', () => {
    const f = closeFigures({ clockInAt: at('2026-10-05T05:30:00Z'), clockOutAt: at('2026-10-05T15:00:00Z'), shift: morning, rules });
    // From 08:00 to 17:00 less the hour's break is 480; the shift is 420 of work.
    expect(f.overtimeMinutes).toBe(60);
    expect(f.workedMinutes).toBe(510);
    expect(f.approvedOvertimeMinutes).toBeNull();
  });

  it('caps overtime at the cutoff and approves it when the policy says so', () => {
    const f = closeFigures({
      clockInAt: at('2026-10-05T06:00:00Z'),
      clockOutAt: at('2026-10-05T17:00:00Z'),
      shift: morning,
      rules: { ...rules, overtimeCutoffMinutes: 120, overtimeAutoApprove: true, overtimeMinMinutes: 30 },
    });
    expect(f.overtimeMinutes).toBe(120);
    expect(f.approvedOvertimeMinutes).toBe(120);
  });

  it('leaves overtime under the policy minimum for a person to decide', () => {
    const f = closeFigures({
      clockInAt: at('2026-10-05T06:00:00Z'),
      clockOutAt: at('2026-10-05T14:20:00Z'),
      shift: morning,
      rules: { ...rules, overtimeAutoApprove: true, overtimeMinMinutes: 30 },
    });
    expect(f.overtimeMinutes).toBe(20);
    expect(f.approvedOvertimeMinutes).toBeNull();
  });

  it('measures overtime against the template minimum when it has one', () => {
    const f = closeFigures({
      clockInAt: at('2026-10-05T06:00:00Z'),
      clockOutAt: at('2026-10-05T13:00:00Z'),
      shift: { ...morning, minWorkMinutes: 300 },
      rules,
    });
    // Seven hours less the break is 360, past a 300 minute minimum.
    expect(f.overtimeMinutes).toBe(60);
  });

  it('gives a record with no shift worked minutes only', () => {
    const f = closeFigures({ clockInAt: at('2026-10-05T06:00:00Z'), clockOutAt: at('2026-10-05T10:30:00Z'), shift: null, rules });
    expect(f).toEqual({ lateMinutes: null, earlyMinutes: null, workedMinutes: 270, overtimeMinutes: null, approvedOvertimeMinutes: null });
  });

  it('gives a record the sweep closed no overtime (AC-TM4)', () => {
    const f = closeFigures({
      clockInAt: at('2026-10-05T06:00:00Z'),
      clockOutAt: at('2026-10-05T16:00:00Z'),
      shift: morning,
      rules,
      autoClosed: true,
    });
    expect(f.overtimeMinutes).toBe(0);
    expect(f.approvedOvertimeMinutes).toBe(0);
  });
});

describe('holidays, weekly days off and the kind of a day (AC-TM12)', () => {
  it('matches a holiday for its branch or every branch, once or every year', () => {
    const rows = [
      { propertyId: null, fromDate: '2026-12-31', toDate: '2027-01-01', recurringYearly: true },
      { propertyId: 'musanze', fromDate: '2026-10-10', toDate: '2026-10-10', recurringYearly: false },
    ];
    expect(isOrgHoliday('2030-12-31', 'kigali', rows)).toBe(true);
    expect(isOrgHoliday('2030-01-01', 'kigali', rows)).toBe(true);
    expect(isOrgHoliday('2026-10-10', 'musanze', rows)).toBe(true);
    expect(isOrgHoliday('2026-10-10', 'kigali', rows)).toBe(false);
    expect(isOrgHoliday('2027-10-10', 'musanze', rows)).toBe(false);
  });

  it('takes the branch rows, else the business rows, else the weekend', () => {
    const rows = [
      { propertyId: null, weekday: 0, weeks: [] },
      { propertyId: 'musanze', weekday: 1, weeks: [] },
    ];
    expect(weeklyOffsFor('musanze', rows).map((r) => r.weekday)).toEqual([1]);
    expect(weeklyOffsFor('kigali', rows).map((r) => r.weekday)).toEqual([0]);
    expect(weeklyOffsFor('kigali', []).map((r) => r.weekday).sort()).toEqual([0, 6]);
  });

  it('honours chosen weeks of the month', () => {
    // Saturday 3 October 2026 is in week 1; Saturday 10 in week 2.
    const firstSaturday = [{ propertyId: null, weekday: 6, weeks: [1] }];
    expect(isWeeklyOff('2026-10-03', firstSaturday)).toBe(true);
    expect(isWeeklyOff('2026-10-10', firstSaturday)).toBe(false);
  });

  it('names a day: holiday first, then a weekly day off', () => {
    const context = {
      propertyId: 'kigali',
      nationalHolidays: new Set(['2026-10-04']),
      orgHolidays: [],
      weeklyOffs: [],
    };
    expect(dayKindOf('2026-10-04', context)).toBe('public_holiday');
    expect(dayKindOf('2026-10-03', context)).toBe('weekly_off');
    expect(dayKindOf('2026-10-05', context)).toBe('weekday');
  });
});

describe('rotations (AC-TM3)', () => {
  it('advances every N days', () => {
    expect(boundariesPassed('2026-10-01', '2026-10-01', { rule: 'every_n_days', ruleValue: 2 })).toBe(0);
    expect(boundariesPassed('2026-10-01', '2026-10-02', { rule: 'every_n_days', ruleValue: 2 })).toBe(0);
    expect(boundariesPassed('2026-10-01', '2026-10-03', { rule: 'every_n_days', ruleValue: 2 })).toBe(1);
  });

  it('advances each time a weekday arrives, and each time a day of the month arrives', () => {
    // From Thursday 1 October 2026: Mondays 5 and 12 pass by the 12th.
    expect(boundariesPassed('2026-10-01', '2026-10-12', { rule: 'weekly', ruleValue: 1 })).toBe(2);
    expect(boundariesPassed('2026-10-01', '2026-12-15', { rule: 'monthly', ruleValue: 15 })).toBe(3);
  });

  it('wraps round the steps from the starting step', () => {
    const pattern = { rule: 'every_n_days' as const, ruleValue: 2, stepCount: 3 };
    const assignment = { startsOn: '2026-10-01', startStep: 1 };
    expect(rotationStepOn('2026-10-01', assignment, pattern)).toBe(1);
    expect(rotationStepOn('2026-10-03', assignment, pattern)).toBe(2);
    expect(rotationStepOn('2026-10-05', assignment, pattern)).toBe(0);
    expect(rotationStepOn('2026-10-07', assignment, pattern)).toBe(1);
  });
});

describe('the phone punch (AC-TM9)', () => {
  const branch = { lat: -1.9441, lng: 30.0619 };

  it('measures metres between two points', () => {
    expect(distanceMeters(branch, branch)).toBe(0);
    // About 111 m per thousandth of a degree of latitude.
    expect(distanceMeters(branch, { lat: -1.9451, lng: 30.0619 })).toBe(111);
  });

  it('validates a close, accurate punch and records the rest for a person', () => {
    expect(phonePunchVerdict({ point: { ...branch, accuracyM: 20 }, branch, radiusM: 150 }).validated).toBe(true);
    const far = phonePunchVerdict({ point: { lat: -1.9477, lng: 30.0619, accuracyM: 20 }, branch, radiusM: 150 });
    expect(far.validated).toBe(false);
    expect(far.distanceM).toBe(400);
    expect(phonePunchVerdict({ point: { ...branch, accuracyM: 500 }, branch, radiusM: 150 }).validated).toBe(false);
    expect(phonePunchVerdict({ point: null, branch, radiusM: 150 }).reason).toBe('No location was sent.');
    expect(phonePunchVerdict({ point: { ...branch, accuracyM: 5 }, branch: null, radiusM: 150 }).distanceM).toBeNull();
  });
});
