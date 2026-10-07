/**
 * The Property detail page's formatting decisions, asserted without rendering.
 *
 * `blockedReasonKey` is the one that earns a test of its own: it is the whole
 * of the page's "why can I not press this" logic, four inputs deep, and the
 * order it resolves them in is the order the guest can act on. A page that told
 * someone to add dates when the property is not taking bookings at all would be
 * sending them to do work that changes nothing.
 */
import { en, rw } from '@/i18n/messages';
import type { MessageKey } from '@/i18n/i18n';
import {
  blockedReasonKey,
  guestsLabel,
  modeKey,
  moneyText,
  nightsLabel,
  rateLine,
  remainingLabel,
  roomSpokenLabel,
  tierBodyKey,
  tierKey,
} from './listing-format';
import { getRoomType } from '@/data/property-detail';

/** `t` as the provider builds it, without mounting one. */
const t =
  (catalogue: Record<MessageKey, string>) =>
  (key: MessageKey, values?: Record<string, string | number>) =>
    (catalogue[key] ?? key).replace(/\{(\w+)\}/g, (whole, name: string) =>
      values && name in values ? String(values[name]) : whole,
    );

const tEn = t(en);

describe('money', () => {
  it('prints the canonical RWF form: prefix, comma groups, no decimals', () => {
    expect(moneyText(145000)).toBe('RWF 145,000');
    expect(moneyText(38000)).toBe('RWF 38,000');
    expect(moneyText(0)).toBe('RWF 0');
  });

  it('rounds rather than showing a fraction of a franc', () => {
    expect(moneyText(145000.4)).toBe('RWF 145,000');
  });
});

describe('availability', () => {
  it('says what is left in words, not as a bare count', () => {
    expect(remainingLabel(0, tEn)).toBe(en['listing.remainingNone']);
    expect(remainingLabel(1, tEn)).toBe(en['listing.remainingLast']);
    expect(remainingLabel(3, tEn)).toBe('Only 3 left');
    expect(remainingLabel(9, tEn)).toBe('9 rooms left');
  });

  it('treats a negative the way it treats zero, rather than printing it', () => {
    expect(remainingLabel(-1, tEn)).toBe(en['listing.remainingNone']);
  });
});

describe('nights', () => {
  it('does not print "1 nights"', () => {
    expect(nightsLabel(1, tEn)).toBe(en['calendar.oneNight']);
    expect(nightsLabel(3, tEn)).toBe('3 nights');
  });
});

/**
 * The rate is per guest per night (owner decision 2026-09-15), so the line
 * under an accommodation total names both multipliers (mobile audit
 * 2026-10-05, GB-08 and GK-14).
 */
describe('the rate line', () => {
  it('names the guests and the nights it multiplied by', () => {
    expect(rateLine(145000, 2, 3, tEn)).toBe('RWF 145,000 × 2 guests × 3 nights');
  });

  it('does not print "1 guests"', () => {
    expect(guestsLabel(1, tEn)).toBe(en['search.oneGuest']);
    expect(rateLine(145000, 1, 1, tEn)).toBe(`RWF 145,000 × 1 guest × ${en['calendar.oneNight']}`);
  });

  it('labels a rate per guest per night wherever it is printed', () => {
    expect(en['listing.perNight']).toBe('per guest / night');
    expect(en['explore.perNight']).toBe('per guest / night');
    expect(en['book.perNight']).toBe('per guest / night');
  });
});

describe('booking mode and cancellation tier', () => {
  it('labels the two modes F-B03 names', () => {
    expect(tEn(modeKey('instant_book'))).toBe('Book now');
    expect(tEn(modeKey('request_to_book'))).toBe('Request to book');
  });

  it('falls back to request-to-book when a room carries no mode', () => {
    // The contract allows null. Asking is the safe fallback: it never books
    // something the host has not agreed to.
    expect(tEn(modeKey(null))).toBe('Request to book');
  });

  it('has a name and a sentence for every tier, in both catalogues', () => {
    const tiers = ['flexible', 'moderate', 'limited', 'firm', 'strict_extended_stay'] as const;
    for (const tier of tiers) {
      expect(en[tierKey(tier)]).toBeTruthy();
      expect(en[tierBodyKey(tier)]).toBeTruthy();
      expect(rw[tierKey(tier)]).toBeTruthy();
      expect(rw[tierBodyKey(tier)]).toBeTruthy();
    }
  });

  it('says the tier belongs to the room when no room is chosen', () => {
    expect(tEn(tierKey(null))).toBe(en['listing.tier.none']);
    expect(tEn(tierBodyKey(null))).toBe(en['listing.tierBody.none']);
  });
});

describe('what a screen reader hears for a room card', () => {
  it('carries the price, which the card would otherwise swallow', () => {
    // A `Pressable` with an `accessibilityLabel` collapses its children, so a
    // label without the money is a card whose price is never read out.
    const room = getRoomType('kivu-lake-suite')!;
    const spoken = roomSpokenLabel(room, tEn);
    expect(spoken).toContain('Lake Suite');
    expect(spoken).toContain('RWF 145,000 per guest per night');
    expect(spoken).toContain('Sleeps 2');
    expect(spoken).toContain(en['listing.beds.oneKing']);
  });

  it('says a sold-out room is sold out', () => {
    const room = getRoomType('akagera-deck-tent')!;
    expect(roomSpokenLabel(room, tEn)).toContain(en['listing.remainingNone']);
  });
});

describe('why the CTA is disabled', () => {
  const open = { active: true, soldOut: false, hasDates: true, hasRoom: true };

  it('is silent when nothing is in the way', () => {
    expect(blockedReasonKey(open)).toBeNull();
  });

  it('names the missing dates, the missing room, or both', () => {
    expect(blockedReasonKey({ ...open, hasDates: false })).toBe('listing.blockedDates');
    expect(blockedReasonKey({ ...open, hasRoom: false })).toBe('listing.blockedRoom');
    expect(blockedReasonKey({ ...open, hasDates: false, hasRoom: false })).toBe(
      'listing.blockedBoth',
    );
  });

  it('puts the reasons the guest cannot fix first', () => {
    // Telling someone to add dates to a property that takes no bookings is
    // sending them to do work that changes nothing.
    expect(blockedReasonKey({ active: false, soldOut: false, hasDates: false, hasRoom: false })).toBe(
      'listing.blockedInactive',
    );
    expect(blockedReasonKey({ active: true, soldOut: true, hasDates: false, hasRoom: false })).toBe(
      'listing.blockedSoldOut',
    );
  });

  it('has Kinyarwanda for every reason it can give', () => {
    const keys: MessageKey[] = [
      'listing.blockedDates',
      'listing.blockedRoom',
      'listing.blockedBoth',
      'listing.blockedSoldOut',
      'listing.blockedInactive',
    ];
    for (const key of keys) expect(rw[key]).toBeTruthy();
  });
});
