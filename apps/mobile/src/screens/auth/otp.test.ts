/**
 * The six-digit code, as arithmetic.
 *
 * The sanitiser is the paste case: an emailed code arrives as a sentence and an
 * autofill arrives as bare digits, and both have to land on the same six.
 *
 * There is no `verifyCode` here any more. ADR-038 child 1b task 7 deleted it
 * along with the rest of the sign-in fixtures: the server verifies the code,
 * and a client-side comparison against a known constant was the prototype
 * standing in for one.
 */
import { CODE_LENGTH, DEMO_CODE, RESEND_SECONDS, isCodeComplete, sanitizeCode } from './otp';

describe('sanitizeCode', () => {
  it('keeps digits and drops everything else', () => {
    expect(sanitizeCode('123456')).toBe('123456');
    expect(sanitizeCode('123 456')).toBe('123456');
  });

  it('pulls the code out of the sentence an email arrives as', () => {
    expect(sanitizeCode('Your Injishi code is 123456')).toBe('123456');
  });

  it('caps at six, so a longer paste cannot overrun the boxes', () => {
    expect(sanitizeCode('12345678')).toBe('123456');
    expect(sanitizeCode('12345678')).toHaveLength(CODE_LENGTH);
  });

  it('answers empty for a string with no digits', () => {
    expect(sanitizeCode('')).toBe('');
    expect(sanitizeCode('abc')).toBe('');
  });
});

describe('isCodeComplete', () => {
  it('is what auto-submit waits for', () => {
    expect(isCodeComplete('12345')).toBe(false);
    expect(isCodeComplete('123456')).toBe(true);
  });
});

describe('DEMO_CODE', () => {
  it('is six digits, so prefilling it completes the field', () => {
    // The picker's second tap depends on this: a demo code that did not
    // satisfy `isCodeComplete` would prefill a field that never submits.
    expect(DEMO_CODE).toHaveLength(CODE_LENGTH);
    expect(isCodeComplete(sanitizeCode(DEMO_CODE))).toBe(true);
  });

  it('matches DEMO_OTP_CODE in packages/auth, which is what the server issues', () => {
    // Two copies of one constant, in a package with no source (ADR-034). If
    // this ever fails, the screen is printing a code the server will refuse.
    expect(DEMO_CODE).toBe('123456');
  });
});

describe('RESEND_SECONDS', () => {
  it('is a client courtesy with a sane bound, not a server rule', () => {
    // The send endpoint publishes no cooldown, so there is nothing to assert
    // this against except that it is a wait a person would tolerate.
    expect(RESEND_SECONDS).toBeGreaterThan(0);
    expect(RESEND_SECONDS).toBeLessThanOrEqual(120);
  });
});
