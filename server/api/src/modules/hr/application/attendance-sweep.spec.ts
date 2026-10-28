import { describe, expect, it } from 'vitest';

import { sweepClose } from './attendance-sweep.service';
import { summarize } from './attendance-insights.service';
import type { AttendanceRow } from '../infrastructure/time.repository';

const rules = { staleOpenHours: 16, defaultShiftMinutes: 480 };
const at = (iso: string): Date => new Date(iso);

describe('sweepClose (058-time AC-TM4)', () => {
  it('closes a linked record at the shift end plus its automatic clock out', () => {
    const close = sweepClose(
      { clockInAt: at('2026-10-05T05:58:00Z'), entryEndsAt: at('2026-10-05T14:00:00Z'), autoClockOutMinutes: 30 },
      rules,
      at('2026-10-05T14:45:00Z'),
    );
    expect(close?.at.toISOString()).toBe('2026-10-05T14:30:00.000Z');
    expect(close?.reason).toMatch(/automatic clock out/);
  });

  it('waits until that time has come', () => {
    expect(
      sweepClose(
        { clockInAt: at('2026-10-05T05:58:00Z'), entryEndsAt: at('2026-10-05T14:00:00Z'), autoClockOutMinutes: 30 },
        rules,
        at('2026-10-05T14:20:00Z'),
      ),
    ).toBeNull();
  });

  it('closes any record open past the stale limit at clock in plus the default shift', () => {
    const close = sweepClose(
      { clockInAt: at('2026-10-04T06:00:00Z'), entryEndsAt: null, autoClockOutMinutes: null },
      rules,
      at('2026-10-04T22:00:00Z'),
    );
    expect(close?.at.toISOString()).toBe('2026-10-04T14:00:00.000Z');
    expect(close?.reason).toMatch(/open longer than 16 hours/);
  });

  it('leaves a record younger than the stale limit open', () => {
    expect(
      sweepClose({ clockInAt: at('2026-10-04T06:00:00Z'), entryEndsAt: null, autoClockOutMinutes: null }, rules, at('2026-10-04T21:59:00Z')),
    ).toBeNull();
  });

  it('never closes before the clock in', () => {
    const close = sweepClose(
      { clockInAt: at('2026-10-05T14:10:00Z'), entryEndsAt: at('2026-10-05T14:00:00Z'), autoClockOutMinutes: 0 },
      rules,
      at('2026-10-05T14:20:00Z'),
    );
    expect(close?.at.toISOString()).toBe('2026-10-05T14:11:00.000Z');
  });
});

describe('summarize (058-time AC-TM13)', () => {
  const record = (over: Partial<AttendanceRow>): AttendanceRow =>
    ({
      status: 'closed',
      workDate: '2026-10-01',
      workedMinutes: 480,
      overtimeMinutes: 0,
      approvedOvertimeMinutes: 0,
      lateMinutes: 0,
      earlyMinutes: 0,
      ...over,
    }) as AttendanceRow;

  it('adds closed records up, counting a day once however many records it has', () => {
    const out = summarize(
      [
        record({ workedMinutes: 240 }),
        record({ workedMinutes: 240, lateMinutes: 12 }),
        record({ workDate: '2026-10-02', overtimeMinutes: 45, approvedOvertimeMinutes: 30, earlyMinutes: 5 }),
        record({ status: 'open', workDate: '2026-10-03', workedMinutes: null }),
      ],
      1440,
    );
    expect(out).toEqual({
      daysWorked: 2,
      workedMinutes: 960,
      expectedMinutes: 1440,
      overtimeMinutes: 45,
      approvedOvertimeMinutes: 30,
      lateCount: 1,
      earlyCount: 1,
    });
  });
});
