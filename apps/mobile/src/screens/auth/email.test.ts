/**
 * The address, as a shape.
 *
 * These assertions are what let `sign-in.tsx` enable Continue without asking
 * the server, and they are deliberately written from both ends: the addresses
 * this must accept because refusing them would lock somebody out of their own
 * account, and the typos it must catch because catching them saves a round
 * trip and an unreadable refusal.
 */
import { isPlausibleEmail, normaliseEmail, trimEmail } from './email';

describe('isPlausibleEmail', () => {
  it('accepts the ordinary case', () => {
    expect(isPlausibleEmail('samuel@kayitare.rw')).toBe(true);
    expect(isPlausibleEmail('josephine@demo.injishi.rw')).toBe(true);
  });

  it('accepts the unusual-but-valid addresses a stricter pattern would refuse', () => {
    // Every one of these is a real address somebody signs in with. Refusing any
    // of them locks a person out of their own account, which is the failure
    // this predicate is loose to avoid.
    expect(isPlausibleEmail('rayan+injishi@example.co.rw')).toBe(true);
    expect(isPlausibleEmail("o'brien@example.com")).toBe(true);
    expect(isPlausibleEmail('a@b.io')).toBe(true);
    expect(isPlausibleEmail('first.last@sub.domain.example.rw')).toBe(true);
    expect(isPlausibleEmail('user_name-1@example-host.rw')).toBe(true);
  });

  it('refuses an address that is still being typed', () => {
    // The whole reason the error state waits for blur: an address is invalid
    // for almost all of the time it takes to type one.
    expect(isPlausibleEmail('')).toBe(false);
    expect(isPlausibleEmail('r')).toBe(false);
    expect(isPlausibleEmail('rayan')).toBe(false);
    expect(isPlausibleEmail('rayan@')).toBe(false);
    expect(isPlausibleEmail('rayan@example')).toBe(false);
  });

  it('refuses the typos worth catching before a round trip', () => {
    expect(isPlausibleEmail('rayan@@example.rw')).toBe(false);
    expect(isPlausibleEmail('@example.rw')).toBe(false);
    expect(isPlausibleEmail('rayan@.rw')).toBe(false);
    expect(isPlausibleEmail('rayan@example.')).toBe(false);
    expect(isPlausibleEmail('rayan@example..rw')).toBe(false);
  });

  it('refuses whitespace anywhere inside the address', () => {
    // Surrounding space is trimmed and fine; a space in the middle is a typo
    // and stays one.
    expect(isPlausibleEmail('rayan @example.rw')).toBe(false);
    expect(isPlausibleEmail('rayan@exa mple.rw')).toBe(false);
  });

  it('tolerates the space a paste brings with it', () => {
    expect(isPlausibleEmail('  samuel@kayitare.rw ')).toBe(true);
  });

  it('refuses a bare host with no dot, which is real on a network and never here', () => {
    expect(isPlausibleEmail('rayan@localhost')).toBe(false);
  });
});

describe('normaliseEmail', () => {
  it('folds case and trims, so two spellings reach one account', () => {
    // The database is what actually guarantees this — `users_email_lower_uk`
    // is UNIQUE on `lower(email)` — and the client folds to match rather than
    // to decide.
    expect(normaliseEmail(' Rayan@Demo.Injishi.RW ')).toBe('rayan@demo.injishi.rw');
    expect(normaliseEmail('rayan@demo.injishi.rw')).toBe('rayan@demo.injishi.rw');
  });
});

describe('trimEmail', () => {
  it('trims without folding, which is what verify prints back', () => {
    // Verify shows what the person actually typed, so the mistake is visible.
    expect(trimEmail('  Rayan@Demo.Injishi.RW ')).toBe('Rayan@Demo.Injishi.RW');
  });
});
