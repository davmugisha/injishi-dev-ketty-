/**
 * The trip formatters, and the review arithmetic beside them.
 *
 * `countdownTo` is the one worth reading twice: it decides which unit a
 * countdown is in, and getting the boundary wrong is a hero card that reads
 * "in 0 hours" or "in 24 hours" instead of "tomorrow". Pure, so the clock is a
 * parameter and none of this is timing-dependent.
 */
import { countdownKey, countdownTo, gateCopy, shortName, unratedCount } from './trip-format';
import { directionsUrl } from './trip-platform';
import { EMPTY_SCORES, overallFromScores, reviewComplete } from '@/data/trip-reviews';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const NOW = 1_800_000_000_000;

describe('countdownTo', () => {
  const at = (offset: number) => countdownTo(NOW + offset, NOW);

  it('reads `now` at the boundary and anywhere past it', () => {
    expect(at(MINUTE)).toEqual({ unit: 'now', value: 0 });
    expect(at(0)).toEqual({ unit: 'now', value: 0 });
    expect(at(-5 * HOUR)).toEqual({ unit: 'now', value: 0 });
  });

  it('reads minutes under the hour, floored', () => {
    expect(at(90 * 1000)).toEqual({ unit: 'minutes', value: 1 });
    expect(at(59 * MINUTE + 59 * 1000)).toEqual({ unit: 'minutes', value: 59 });
  });

  it('reads hours under the day, floored', () => {
    expect(at(HOUR)).toEqual({ unit: 'hours', value: 1 });
    expect(at(23 * HOUR + 59 * MINUTE)).toEqual({ unit: 'hours', value: 23 });
  });

  it('reads days above it, ROUNDED — 1d20h is "in 2 days", as a person would say', () => {
    expect(at(DAY)).toEqual({ unit: 'days', value: 1 });
    expect(at(DAY + 20 * HOUR)).toEqual({ unit: 'days', value: 2 });
    expect(at(5 * DAY)).toEqual({ unit: 'days', value: 5 });
  });

  it('picks a singular key at one and a plural above it', () => {
    // Separate keys rather than one string with a count, because RW does not
    // inflect the way EN does and a shared string reads wrong in one of them.
    expect(countdownKey({ unit: 'now', value: 0 })).toBe('trips.countdownNow');
    expect(countdownKey({ unit: 'minutes', value: 1 })).toBe('trips.countdownMinute');
    expect(countdownKey({ unit: 'minutes', value: 2 })).toBe('trips.countdownMinutes');
    expect(countdownKey({ unit: 'hours', value: 1 })).toBe('trips.countdownHour');
    expect(countdownKey({ unit: 'hours', value: 9 })).toBe('trips.countdownHours');
    expect(countdownKey({ unit: 'days', value: 1 })).toBe('trips.countdownDay');
    expect(countdownKey({ unit: 'days', value: 5 })).toBe('trips.countdownDays');
  });
});

describe('gateCopy', () => {
  it('gives every gate a sentence, and a button only where one can be pressed', () => {
    expect(gateCopy({ kind: 'open' })).toEqual({
      bodyKey: 'trip.arrivalUnlocked',
      ctaKey: 'trip.openArrivalGuide',
    });
    expect(gateCopy({ kind: 'ready' }).ctaKey).toBe('trip.startCheckIn');
    // The four that cannot be acted on carry no button at all — a disabled CTA
    // with no way out is the orphaned control the quality bar rules out.
    expect(gateCopy({ kind: 'early', opensAt: 0 }).ctaKey).toBeNull();
    expect(gateCopy({ kind: 'staffed' }).ctaKey).toBeNull();
    expect(gateCopy({ kind: 'awaiting' }).ctaKey).toBeNull();
    expect(gateCopy({ kind: 'closed' }).ctaKey).toBeNull();
  });
});

describe('directionsUrl', () => {
  const to = { lat: -1.6829, lng: 29.2631, label: 'Lake Kivu Suite' };

  it('uses the platform scheme, with the pin leading and the name as a label', () => {
    expect(directionsUrl(to, 'ios')).toBe('maps://?daddr=-1.6829,29.2631&q=Lake%20Kivu%20Suite');
    // `geo:` is the OS-level intent, so whichever maps app the person uses
    // answers it. Hard-coding Google Maps would be choosing for them. The label
    // is percent-encoded on both platforms: a property name with an `&` in it
    // would otherwise end the query.
    expect(directionsUrl(to, 'android')).toBe(
      'geo:-1.6829,29.2631?q=-1.6829,29.2631(Lake%20Kivu%20Suite)',
    );
    expect(directionsUrl(to, 'web')).toContain('destination=-1.6829,29.2631');
  });
});

describe('the review arithmetic', () => {
  const full = { cleanliness: 4, accuracy: 4, checkIn: 5, communication: 4, location: 5, value: 5 } as const;

  it('derives the overall from the six rather than asking for a seventh tap', () => {
    expect(overallFromScores(full)).toBe(4.5);
    expect(overallFromScores(EMPTY_SCORES)).toBe(0);
  });

  it('averages only the categories that were rated', () => {
    expect(overallFromScores({ ...EMPTY_SCORES, cleanliness: 5, value: 3 })).toBe(4);
  });

  it('counts a review complete only when all six are rated', () => {
    expect(reviewComplete(full)).toBe(true);
    expect(reviewComplete({ ...full, value: 0 })).toBe(false);
    expect(unratedCount({ ...full, value: 0, location: 0 })).toBe(2);
    expect(unratedCount(EMPTY_SCORES)).toBe(6);
  });
});

describe('shortName', () => {
  it('is first name plus last initial (F-B14 §6)', () => {
    expect(shortName('Samuel Kayitare')).toBe('Samuel K.');
    expect(shortName('Marie Claire Uwase')).toBe('Marie U.');
    expect(shortName('Beatha')).toBe('Beatha');
  });
});
