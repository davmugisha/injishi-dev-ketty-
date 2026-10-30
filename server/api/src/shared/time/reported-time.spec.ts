import { UnprocessableEntityException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { resolveReportedTime } from './reported-time';

const HOUR = 3_600_000;
const MINUTE = 60_000;

/** The pair a phone sends: its tap and its clock at the send, both on the phone's own (maybe wrong) clock. */
function pair(tapOnPhone: number, sendOnPhone: number): { occurredAt: string; deviceSentAt: string } {
  return { occurredAt: new Date(tapOnPhone).toISOString(), deviceSentAt: new Date(sendOnPhone).toISOString() };
}

describe('the reported time (mobile spec 0003, cross child contract 1)', () => {
  // The real moment the request arrives: 07:40 Kigali on 2026-10-29.
  const received = new Date('2026-10-29T05:40:00Z');

  it('takes the arrival time when the write carries no pair, as before', () => {
    const time = resolveReportedTime({}, received);
    expect(time.at).toEqual(received);
    expect(time.deviceAt).toBeNull();
    expect(time.lateSync).toBe(false);
  });

  it('gives the real tap time when the phone clock is three hours fast', () => {
    // Tapped at 07:02 real time, sent at 07:40 real time; the phone reads both three hours ahead.
    const fast = 3 * HOUR;
    const tap = received.getTime() - 38 * MINUTE;
    const time = resolveReportedTime(pair(tap + fast, received.getTime() + fast), received);
    expect(time.at.toISOString()).toBe('2026-10-29T05:02:00.000Z');
    // What the phone said is kept beside it, for HR.
    expect(time.deviceAt?.toISOString()).toBe(new Date(tap + fast).toISOString());
  });

  it('flags a write that arrives more than 30 minutes after its tap, and not one at 30', () => {
    const now = received.getTime();
    expect(resolveReportedTime(pair(now - 31 * MINUTE, now), received).lateSync).toBe(true);
    expect(resolveReportedTime(pair(now - 30 * MINUTE, now), received).lateSync).toBe(false);
  });

  it('refuses a write more than 7 days old with reported_time_too_old', () => {
    const now = received.getTime();
    let refusal: unknown;
    try {
      resolveReportedTime(pair(now - 8 * 24 * HOUR, now), received);
    } catch (error) {
      refusal = error;
    }
    expect(refusal).toBeInstanceOf(UnprocessableEntityException);
    expect((refusal as UnprocessableEntityException).getResponse()).toMatchObject({ code: 'reported_time_too_old' });
    expect(() => resolveReportedTime(pair(now - 6 * 24 * HOUR, now), received)).not.toThrow();
  });

  it('never puts a tap after the moment it arrived', () => {
    const now = received.getTime();
    // A phone that says it tapped after it sent.
    expect(resolveReportedTime(pair(now + 5 * MINUTE, now), received).at).toEqual(received);
  });
});
