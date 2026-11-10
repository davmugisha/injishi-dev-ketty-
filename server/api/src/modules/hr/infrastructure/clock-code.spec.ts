import { describe, expect, it } from 'vitest';

import { CODE_WINDOW_MS, clockCodeKey, readClockCode, signClockCode, windowOf } from './clock-code';

describe('the entrance code (clock-code)', () => {
  const key = clockCodeKey('pepper');
  const kioskId = '1e000000-aaaa-4bbb-8ccc-123456789abc';
  const now = Date.parse('2026-11-05T05:00:10Z');
  const code = signClockCode(key, kioskId, windowOf(now));

  it('reads back the tablet it names', () => {
    expect(readClockCode(key, code, now)).toEqual({ kioskId });
  });

  it('is good for 90 seconds, then runs out', () => {
    expect(readClockCode(key, code, now + 2 * CODE_WINDOW_MS)).toEqual({ kioskId });
    expect(readClockCode(key, code, now + 3 * CODE_WINDOW_MS)).toBe('expired');
  });

  it('refuses a code signed with another key, or changed by hand', () => {
    expect(readClockCode(clockCodeKey('other'), code, now)).toBe('wrong');
    const [id, w, sig] = code.split('.');
    expect(readClockCode(key, `${id}.${(parseInt(w, 36) + 5).toString(36)}.${sig}`, now)).toBe('wrong');
    expect(readClockCode(key, 'not a code', now)).toBe('wrong');
  });
});
