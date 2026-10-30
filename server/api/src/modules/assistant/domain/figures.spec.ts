import { describe, expect, it } from 'vitest';

import { figuresIn, unconfirmedFigures } from './figures';

/** Figure checks (ADR-061 D-v): what counts as a figure, and how it is found. */
describe('figures in an answer (ADR-061 D-v)', () => {
  it('reads money with RWF beside it, any number of four digits or more, and dates', () => {
    expect(figuresIn('The Double room is 70,000 RWF a night, RWF 500 for breakfast, and 12345 points.').map((f) => f.key)).toEqual([
      'money:70000',
      'money:500',
      'money:12345',
    ]);
    expect(figuresIn('Free on 2026-10-10, 11 October 2026 and October 12, 2026.').map((f) => f.key)).toEqual([
      'date:2026-10-10',
      'date:2026-10-11',
      'date:2026-10-12',
    ]);
  });

  it('leaves small counts, bare years and a date\x27s digits alone', () => {
    expect(figuresIn('You have 3 rooms and 2 guests. Injishi opened in 2026.')).toEqual([]);
    expect(figuresIn('Check in on 2026-10-10.').map((f) => f.key)).toEqual(['date:2026-10-10']);
    // Thousands are never joined across a plain space.
    expect(figuresIn('2 rooms 300 metres away')).toEqual([]);
  });

  it('finds a figure in a tool\x27s JSON by its digits, and a written date by its ISO form', () => {
    const evidence = ['{"roomTypes":[{"name":"Double","basePriceRwf":70000}],"date":"2026-10-10T00:00:00.000Z"}'];
    expect(unconfirmedFigures('The Double room is 70,000 RWF on 10 October 2026.', evidence)).toEqual([]);
  });

  it('flags a figure no evidence holds', () => {
    const evidence = ['{"basePriceRwf":70000}'];
    expect(unconfirmedFigures('It should be 80,000 RWF, not 70,000 RWF.', evidence).map((f) => f.text)).toEqual(['80,000 RWF']);
    expect(unconfirmedFigures('Your stay starts 2026-11-02.', ['{"checkIn":"2026-11-01"}']).map((f) => f.key)).toEqual(['date:2026-11-02']);
  });

  it('accepts the person\x27s own figure from their question', () => {
    expect(unconfirmedFigures('Moving from 70,000 to 80,000 RWF is a 14% rise.', ['should I set 80,000?', '{"basePriceRwf":70000}'])).toEqual([]);
  });
});
