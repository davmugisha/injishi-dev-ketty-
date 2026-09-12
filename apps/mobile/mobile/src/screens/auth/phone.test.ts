/**
 * The Rwandan number, as arithmetic.
 *
 * These are the assertions that let `sign-in.tsx` hold nine bare digits and
 * nothing else. The paste cases are the ones worth having: a number arrives
 * from a contact card as `+250 788 123 456`, from a keypad as `0788123456` and
 * from a colleague as `788123456`, and all three are the same number.
 */
import {
  MOBILE_PREFIXES,
  PHONE_DIGITS,
  digitsOf,
  displayPhone,
  formatPhone,
  isComplete,
  isPlausible,
} from './phone';

describe('digitsOf', () => {
  it('keeps digits and drops everything else', () => {
    expect(digitsOf('788 123 456')).toBe('788123456');
    expect(digitsOf('788-123-456')).toBe('788123456');
  });

  it('sheds a pasted country code', () => {
    expect(digitsOf('+250 788 123 456')).toBe('788123456');
    expect(digitsOf('250788123456')).toBe('788123456');
  });

  it('sheds a leading trunk zero', () => {
    expect(digitsOf('0788123456')).toBe('788123456');
  });

  it('sheds both, in the order a real paste carries them', () => {
    expect(digitsOf('+250 (0)788 123 456')).toBe('788123456');
  });

  it('caps at nine, so a tenth keypress cannot land', () => {
    expect(digitsOf('7881234567')).toHaveLength(PHONE_DIGITS);
  });

  it('answers empty for a string with no digits at all', () => {
    expect(digitsOf('')).toBe('');
    expect(digitsOf('   ')).toBe('');
  });
});

describe('formatPhone', () => {
  it('groups in threes as the number is typed', () => {
    expect(formatPhone('')).toBe('');
    expect(formatPhone('7')).toBe('7');
    expect(formatPhone('788')).toBe('788');
    // No trailing space after a complete group: a cursor sitting past one is
    // what makes a field feel like it ate a keypress.
    expect(formatPhone('7881')).toBe('788 1');
    expect(formatPhone('788123456')).toBe('788 123 456');
  });
});

describe('displayPhone', () => {
  it('reads back the way the frame prints it', () => {
    expect(displayPhone('788123456')).toBe('+250 788 123 456');
  });

  it('does not leave a dangling space when there is no number yet', () => {
    expect(displayPhone('')).toBe('+250');
  });
});

describe('isComplete', () => {
  it('is what enables Continue: nine digits, nothing about the network', () => {
    expect(isComplete('78812345')).toBe(false);
    expect(isComplete('788123456')).toBe(true);
  });
});

describe('isPlausible', () => {
  it.each(MOBILE_PREFIXES)('accepts the %s range', (prefix) => {
    expect(isPlausible(`${prefix}8123456`)).toBe(true);
  });

  it('refuses nine digits on no Rwandan network', () => {
    // The field's error state, and the reason it can exist with no network
    // behind the screen.
    expect(isPlausible('688123456')).toBe(false);
    expect(isPlausible('123456789')).toBe(false);
  });

  it('refuses a right-looking prefix that is still too short', () => {
    expect(isPlausible('78812345')).toBe(false);
  });
});
