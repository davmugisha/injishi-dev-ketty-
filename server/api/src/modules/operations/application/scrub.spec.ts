import { describe, expect, it } from 'vitest';

import { REDACTED, scrubPhoneNumbers } from './scrub';

/**
 * The corpus of numbers the redaction has to catch (ADR-032, AC-18).
 *
 * The ADR's own follow-up asks for exactly this before the pattern is trusted:
 * Rwandan numbers in local and international form, spaced, dotted and hyphen
 * separated. Everything here is a form a person actually types into a message.
 *
 * There is no database in this checkout, so this file is the only place AC-18
 * can be proved at all. Extend it rather than trusting the regex by eye.
 */
describe('scrubPhoneNumbers', () => {
  describe('redacts a Rwandan number however it was typed', () => {
    const cases = [
      ['local, run together', '0788123456'],
      ['local, spaced', '0788 123 456'],
      ['local, spaced in pairs', '07 88 12 34 56'],
      ['local, hyphenated', '078-812-3456'],
      ['local, dotted', '078.812.3456'],
      ['international, run together', '+250788123456'],
      ['international, spaced', '+250 788 123 456'],
      ['international, hyphenated', '+250-788-123-456'],
      ['the subscriber part alone', '788123456'],
    ] as const;

    it.each(cases)('%s: %s', (_label, number) => {
      expect(scrubPhoneNumbers(`call me on ${number} thanks`)).toBe(
        `call me on ${REDACTED} thanks`,
      );
    });
  });

  it('redacts every number in a body, not only the first', () => {
    expect(scrubPhoneNumbers('0788123456 or +250 722 000 111')).toBe(
      `${REDACTED} or ${REDACTED}`,
    );
  });

  it('leaves the ordinary numbers a message is full of alone', () => {
    const body = 'Room 412, 2 guests, 45000 RWF a night, arriving on 14/03/2026.';
    expect(scrubPhoneNumbers(body)).toBe(body);
  });

  it('leaves a run longer than any phone number alone', () => {
    // 16 digits is past the E.164 ceiling, so it is not a number anywhere.
    const body = 'reference 1234567890123456';
    expect(scrubPhoneNumbers(body)).toBe(body);
  });

  it('passes a body with no numbers through untouched', () => {
    const body = 'What time is check in?';
    expect(scrubPhoneNumbers(body)).toBe(body);
  });

  it('does not invent a body for a message that has none', () => {
    // A voice or image message carries a null body.
    expect(scrubPhoneNumbers(null)).toBeNull();
    expect(scrubPhoneNumbers('')).toBe('');
  });

  it('never mutates its input, because the stored row stays verbatim', () => {
    const body = 'call 0788123456';
    const copy = body.slice();
    scrubPhoneNumbers(body);
    expect(body).toBe(copy);
  });
});
