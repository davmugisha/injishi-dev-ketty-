/**
 * `toIdentity` — the null handling between `GET /api/v1/me/profile` and the
 * screens, which is where the whole of the risk in this module sits.
 *
 * Every field on `MyProfile` is nullable, because a brand new account has
 * answered none of Step 1. So the interesting cases are not "a profile came
 * back" but the three shapes of not-quite:
 *
 *   - nothing came back yet,
 *   - something came back with no name on it,
 *   - a name came back with no phone beside it.
 *
 * Each has to resolve to something a screen can print without lying. The rule
 * being asserted is that the placeholder is all-or-nothing: a real name is
 * never shown next to a placeholder phone number, because that is a fabricated
 * fact about a real person, and it is exactly the kind that reads as true.
 */
import type { MyProfile } from '@injishi/contracts';

import {
  PLACEHOLDER_IDENTITY,
  formatPhone,
  initialsOf,
  toIdentity,
} from './profile';

/** A profile with everything answered, as a returning registrant would have. */
function profile(over: Partial<MyProfile> = {}): MyProfile {
  return {
    fullName: 'Aline Uwase',
    gender: null,
    dateOfBirth: null,
    phoneE164: '+250788431209',
    document: null,
    address: null,
    complete: true,
    ...over,
  };
}

describe('toIdentity', () => {
  it('takes the name and the phone from the server', () => {
    const me = toIdentity(profile());

    expect(me.name).toBe('Aline Uwase');
    expect(me.phone).toBe('+250 788 431 209');
    expect(me.initials).toBe('AU');
    expect(me.fromServer).toBe(true);
  });

  it('stands the placeholder in while nothing has come back', () => {
    // `undefined` is the query's own "not asked, or still asking". A screen
    // rendering an empty name for the second or two that takes would flash a
    // blank line where a person's name goes.
    expect(toIdentity(undefined)).toEqual(PLACEHOLDER_IDENTITY);
    expect(toIdentity(undefined).fromServer).toBe(false);
  });

  it('stands the placeholder in for an account that has not answered Step 1', () => {
    // A real answer, with a null name in it. NOT a server-sourced identity:
    // there is nothing to source. `fromServer` staying false is what stops
    // `personal-details.tsx` seeding its store from an empty profile.
    const me = toIdentity(profile({ fullName: null }));

    expect(me).toEqual(PLACEHOLDER_IDENTITY);
    expect(me.fromServer).toBe(false);
  });

  it('treats a whitespace-only name as no name at all', () => {
    expect(toIdentity(profile({ fullName: '   ' }))).toEqual(PLACEHOLDER_IDENTITY);
  });

  it('shows a real name with an empty phone rather than a borrowed one', () => {
    const me = toIdentity(profile({ phoneE164: null }));

    expect(me.name).toBe('Aline Uwase');
    // No number of anyone else's may follow a real name onto the screen.
    expect(me.phone).toBe('');
    expect(me.fromServer).toBe(true);
  });

  it('never names anybody in the placeholder', () => {
    // It used to be the fixture persona, so every account the server had no
    // name for was shown as "Samuel Kayitare, +250 788 431 209" (mobile audit
    // 2026-10-05, SA-01). A placeholder that names a real-looking person is a
    // fabricated fact about whoever holds the phone.
    expect(PLACEHOLDER_IDENTITY.name).toBe('');
    expect(PLACEHOLDER_IDENTITY.initials).toBe('');
    expect(PLACEHOLDER_IDENTITY.phone).toBe('');
    expect(toIdentity(profile({ fullName: null })).name).toBe('');
  });

  it('marks a read still in flight as pending, and an unnamed answer as not', () => {
    expect(toIdentity(undefined, true).pending).toBe(true);
    expect(toIdentity(undefined, true).fromServer).toBe(false);
    // Answered, with no name on file: not pending, so a screen says "Name not
    // added yet" rather than drawing a skeleton forever.
    expect(toIdentity(profile({ fullName: null }), false).pending).toBe(false);
    expect(toIdentity(profile()).pending).toBe(false);
  });
});

describe('formatPhone', () => {
  it('groups a Rwandan number the way the country writes it', () => {
    expect(formatPhone('+250788431209')).toBe('+250 788 431 209');
  });

  it('leaves anything else exactly as it arrived', () => {
    // Grouping a number in threes because Rwanda groups in threes is how a
    // French or Kenyan number ends up printed in a shape its own country does
    // not use. Better untouched than confidently wrong.
    expect(formatPhone('+33612345678')).toBe('+33612345678');
    expect(formatPhone('+254712345678')).toBe('+254712345678');
  });
});

describe('initialsOf', () => {
  it('takes the first and the last', () => {
    expect(initialsOf('Samuel Kayitare')).toBe('SK');
    expect(initialsOf('Marie Claire Uwimana')).toBe('MU');
  });

  it('gives a mononym one letter rather than doubling it', () => {
    // Mononyms are ordinary here, so this is a case and not an edge case.
    expect(initialsOf('Eric')).toBe('E');
  });

  it('answers for a name that is not one', () => {
    expect(initialsOf('   ')).toBe('?');
  });
});
