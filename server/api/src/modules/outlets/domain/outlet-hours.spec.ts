import { describe, expect, it } from 'vitest';

import { isOutletOpen } from './outlet-hours';

/**
 * The three rules ADR-050 names for "is this outlet open now": null is always
 * open, an end before the start spans midnight, and the clock is the
 * property's. Kigali is UTC+2 with no daylight saving, so the instants below are
 * written in UTC and read two hours later.
 */
describe('isOutletOpen', () => {
  const KIGALI = 'Africa/Kigali';
  // Friday 2026-09-11.
  const at = (utc: string): Date => new Date(`2026-09-11T${utc}:00Z`);

  it('treats null hours as always open', () => {
    expect(isOutletOpen(null, at('03:00'), KIGALI)).toBe(true);
  });

  it('opens inside a window and closes outside it, on the property clock', () => {
    const hours = { fri: ['07:00', '22:00'] };
    expect(isOutletOpen(hours, at('05:30'), KIGALI)).toBe(true); // 07:30 local
    expect(isOutletOpen(hours, at('04:30'), KIGALI)).toBe(false); // 06:30 local
    expect(isOutletOpen(hours, at('20:00'), KIGALI)).toBe(false); // 22:00 local, end is exclusive
  });

  it('keeps a window that spans midnight open into the next morning', () => {
    const hours = { thu: ['18:00', '02:00'] };
    expect(isOutletOpen(hours, at('23:30'), KIGALI)).toBe(false); // Sat 01:30 local: Thursday's window is over
    expect(isOutletOpen({ fri: ['18:00', '02:00'] }, at('23:30'), KIGALI)).toBe(true); // Sat 01:30, Friday's bar
    expect(isOutletOpen(hours, at('22:30'), KIGALI)).toBe(false); // Sat 00:30, not Thursday's
    expect(isOutletOpen(hours, new Date('2026-09-10T23:30:00Z'), KIGALI)).toBe(true); // Fri 01:30 local
  });

  it('is closed on a day with no key', () => {
    expect(isOutletOpen({ mon: ['07:00', '22:00'] }, at('10:00'), KIGALI)).toBe(false);
  });

  it('accepts a list of windows for a kitchen that closes between services', () => {
    const hours = { fri: [['11:00', '14:00'], ['18:00', '22:00']] };
    expect(isOutletOpen(hours, at('10:00'), KIGALI)).toBe(true); // 12:00
    expect(isOutletOpen(hours, at('14:00'), KIGALI)).toBe(false); // 16:00
    expect(isOutletOpen(hours, at('17:00'), KIGALI)).toBe(true); // 19:00
  });

  it('fails closed on hours it cannot read', () => {
    expect(isOutletOpen({ fri: ['7am', '10pm'] }, at('10:00'), KIGALI)).toBe(false);
    expect(isOutletOpen('always', at('10:00'), KIGALI)).toBe(false);
  });
});
