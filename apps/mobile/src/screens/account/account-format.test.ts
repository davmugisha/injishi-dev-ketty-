/**
 * The pure half of Account: dates, plan names, staff states, and how long ago a
 * device was last used.
 *
 * All of it asserted without rendering, which is the point of these living in
 * `account-format.ts` rather than inline in the screens — and which is what
 * lets the Kinyarwanda column be exercised by the same calls rather than by a
 * second suite that would drift from the first.
 */
import { formatLongDay, planKey, staffStateKey, staffStateTone } from './account-format';
import { daysSince, isStaleSession, sessionMeta, STALE_SESSION_DAYS } from './account-format';
import type { DeviceSession } from './account-fixtures';
import { en, rw } from '@/i18n/messages';
import type { MessageKey } from '@/i18n/i18n';

const t = (key: MessageKey, values?: Record<string, string | number>) =>
  (en[key] as string).replace(/\{(\w+)\}/g, (whole, name: string) =>
    values && name in values ? String(values[name]) : whole,
  );

const trw = (key: MessageKey, values?: Record<string, string | number>) =>
  rw[key].replace(/\{(\w+)\}/g, (whole, name: string) =>
    values && name in values ? String(values[name]) : whole,
  );

describe('the long date', () => {
  /**
   * `formatDay` gives "14 Jul", which is right for a booking, a rent due date
   * and a shift because all three are inside the current year. A TIN
   * verification and a plan renewal are not, and a date without a year is the
   * one that gets misread.
   */
  it('carries the year, which the short form drops', () => {
    expect(formatLongDay('2026-07-14', t)).toBe('14 Jul 2026');
    expect(formatLongDay('2025-11-03', t)).toBe('3 Nov 2025');
  });

  it('reads the month out of the Kinyarwanda catalogue too', () => {
    // The year is a number in either language; the month is not.
    expect(formatLongDay('2026-07-14', trw)).toContain('2026');
    expect(formatLongDay('2026-07-14', trw)).not.toBe(formatLongDay('2026-07-14', t));
  });
});

describe('the plan', () => {
  it('names each plan through its own key, so RW gets its own word', () => {
    expect(planKey('growth')).toBe('plan.growth');
    expect(t(planKey('growth'))).toBe('Growth');
    expect(trw(planKey('growth'))).not.toBe('Growth');
  });
});

describe('a staff row', () => {
  it('gives every state a word and a tone, never a tone alone', () => {
    for (const state of ['active', 'invited', 'suspended'] as const) {
      const key = staffStateKey(state);
      expect(en[key]).toBeTruthy();
      expect(rw[key]).toBeTruthy();
      expect(staffStateTone(state)).toBeTruthy();
    }
  });

  /**
   * The tones have to differ, or the badge is decoration. Revoked is neutral
   * rather than danger on purpose: a revoked seat is a record, not a problem,
   * and colouring it red would make an audit trail read as an incident list.
   */
  it('separates working from invited from revoked', () => {
    expect(staffStateTone('active')).toBe('success');
    expect(staffStateTone('invited')).toBe('warning');
    expect(staffStateTone('suspended')).toBe('neutral');
  });
});

describe('how long ago a device was used', () => {
  const on = (lastSeen: string, current = false): DeviceSession => ({
    id: 'd',
    label: 'Chrome · Windows',
    place: 'Kigali, RW',
    lastSeen,
    current,
  });

  it('counts whole days from the day passed in, not from the clock', () => {
    expect(daysSince('2026-09-07', '2026-09-07')).toBe(0);
    expect(daysSince('2026-09-06', '2026-09-07')).toBe(1);
    expect(daysSince('2026-08-22', '2026-09-07')).toBe(16);
  });

  it('never goes negative on a device seen in the future', () => {
    // A clock skew must not print "used -3 days ago".
    expect(daysSince('2026-09-09', '2026-09-07')).toBe(0);
  });

  it('reads a garbled date as today rather than throwing', () => {
    expect(daysSince('not-a-day', '2026-09-07')).toBe(0);
  });

  it('bands the sentence rather than printing a bare number', () => {
    expect(sessionMeta(on('2026-09-07'), '2026-09-07', t)).toContain(en['security.seenToday']);
    expect(sessionMeta(on('2026-09-06'), '2026-09-07', t)).toContain(en['security.seenYesterday']);
    expect(sessionMeta(on('2026-08-22'), '2026-09-07', t)).toContain('16');
  });

  it('always names the place, which is what makes recognition possible', () => {
    expect(sessionMeta(on('2026-08-22'), '2026-09-07', t)).toContain('Kigali, RW');
  });
});

describe('which device is worth a second look', () => {
  const at = (lastSeen: string, current = false): DeviceSession => ({
    id: 'd',
    label: 'Chrome · Android',
    place: 'Rubavu, RW',
    lastSeen,
    current,
  });

  it('marks one unused for a fortnight', () => {
    expect(isStaleSession(at('2026-08-22'), '2026-09-07')).toBe(true);
    expect(daysSince('2026-08-22', '2026-09-07')).toBeGreaterThanOrEqual(STALE_SESSION_DAYS);
  });

  it('leaves a recent one alone', () => {
    expect(isStaleSession(at('2026-09-05'), '2026-09-07')).toBe(false);
  });

  /**
   * The phone in your hand is never stale, however long since the app was
   * opened — it is being used right now, which is how the screen is on screen.
   */
  it('never marks the current device, whatever its last-seen day says', () => {
    expect(isStaleSession(at('2025-01-01', true), '2026-09-07')).toBe(false);
  });
});
