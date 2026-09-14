/**
 * The stay catalogue's two derivations.
 *
 * Both exist because the fixture was stating one fact twice and the two copies
 * had already drifted: Lake Kivu carried 4.9 out of 5 here and 8.5 out of 10 on
 * the Guest canvas, which is a whole band apart, and nobody would have caught it
 * by eye.
 */
import { EXPLORABLE_STAYS, STAYS, ratingFromScore } from './stays';

describe('ratingFromScore', () => {
  it('is the score halved, to one decimal', () => {
    expect(ratingFromScore(9)).toBe(4.5);
    expect(ratingFromScore(8.5)).toBe(4.3);
    expect(ratingFromScore(7)).toBe(3.5);
  });

  it('is what every stay actually carries, so the two scales cannot disagree', () => {
    for (const stay of STAYS) expect(stay.rating).toBe(ratingFromScore(stay.score));
  });
});

describe('the catalogue', () => {
  it('gives every stay a cover and four gallery photographs', () => {
    // Session 3's gallery pages exactly four, and a short array would be a
    // blank page rather than a type error.
    for (const stay of STAYS) {
      expect(stay.photos.cover).toBeTruthy();
      expect(stay.photos.gallery).toHaveLength(4);
      expect(stay.photos.thumbnail).toBeTruthy();
    }
  });

  it('keeps every id a trip is booked against', () => {
    // The trip seeds in `./trips` join on these for the photograph, the
    // coordinates and the property's own check-in time.
    for (const id of [
      'kivu-sunbird-suite',
      'lavender-hill-apartment',
      'nyungwe-forest-lodge',
      'musanze-volcano-cabin',
      'akagera-tented-camp',
      'gisenyi-beach-motel',
      'rusizi-river-lodge',
    ]) {
      expect(STAYS.some((s) => s.id === id)).toBe(true);
    }
  });

  it('places every stay inside Rwanda', () => {
    // A pin outside the bounding box lands on the frame of the map rather than
    // in the country, and the failure is silent.
    for (const stay of EXPLORABLE_STAYS) {
      expect(stay.coords.lat).toBeGreaterThan(-2.9);
      expect(stay.coords.lat).toBeLessThan(-1);
      expect(stay.coords.lng).toBeGreaterThan(28.8);
      expect(stay.coords.lng).toBeLessThan(31);
    }
  });
});
