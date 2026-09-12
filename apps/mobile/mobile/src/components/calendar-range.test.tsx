/**
 * CalendarRange — the selection state machine, and the timezone trap.
 *
 * `nextRange` is the whole behaviour of the control, so it is tested without
 * rendering: a two-tap machine whose third tap has to start over, whose tap
 * before the start has to restart rather than refuse, and whose tap on the
 * start has to clear rather than make a zero-night stay.
 *
 * `nightsBetween` is tested across a month boundary and a DST-style gap because
 * that is where a naive `Date` difference goes wrong. The dates here are plain
 * `YYYY-MM-DD` strings on purpose — `new Date('2026-08-14')` parses as UTC
 * midnight and prints as the 13th anywhere west of Greenwich, which is how a
 * booking arrives a day early.
 */
import { screen } from '@testing-library/react-native';
import {
  CalendarRange,
  isoDay,
  nextRange,
  nightsBetween,
  todayIso,
  type DateRange,
} from './calendar-range';
import { SCHEMES, renderInScheme } from '@/test-utils';
import { en } from '@/i18n/messages';

const EMPTY: DateRange = { start: null, end: null };

describe('nextRange', () => {
  it('takes the first tap as a start', () => {
    expect(nextRange(EMPTY, '2026-08-14')).toEqual({ start: '2026-08-14', end: null });
  });

  it('takes the second tap as an end', () => {
    expect(nextRange({ start: '2026-08-14', end: null }, '2026-08-17')).toEqual({
      start: '2026-08-14',
      end: '2026-08-17',
    });
  });

  it('starts over on a tap once a range is complete', () => {
    // Someone changing their mind, not adding a third endpoint.
    expect(nextRange({ start: '2026-08-14', end: '2026-08-17' }, '2026-09-01')).toEqual({
      start: '2026-09-01',
      end: null,
    });
  });

  it('restarts from a tap that lands before the start', () => {
    // Refusing would mean the user has to find the clear control; restarting
    // is what they meant.
    expect(nextRange({ start: '2026-08-14', end: null }, '2026-08-10')).toEqual({
      start: '2026-08-10',
      end: null,
    });
  });

  it('clears rather than making a zero-night stay', () => {
    expect(nextRange({ start: '2026-08-14', end: null }, '2026-08-14')).toEqual(EMPTY);
  });
});

describe('nightsBetween', () => {
  it('counts nights, not days', () => {
    expect(nightsBetween('2026-08-14', '2026-08-17')).toBe(3);
  });

  it('crosses a month boundary', () => {
    expect(nightsBetween('2026-08-30', '2026-09-02')).toBe(3);
  });

  it('crosses a leap day', () => {
    expect(nightsBetween('2028-02-27', '2028-03-01')).toBe(3);
  });

  it('is zero for the same day, never negative for a reversed pair', () => {
    expect(nightsBetween('2026-08-14', '2026-08-14')).toBe(0);
    expect(nightsBetween('2026-08-17', '2026-08-14')).toBe(0);
  });
});

describe('isoDay and todayIso', () => {
  it('pads a single-digit month and day', () => {
    expect(isoDay(2026, 0, 5)).toBe('2026-01-05');
    expect(isoDay(2026, 11, 25)).toBe('2026-12-25');
  });

  it('reads the local calendar day, not the UTC one', () => {
    // 23:30 on the 14th, local. A UTC-based reader would say the 15th east of
    // Greenwich and the 14th west of it; the local reader always says the 14th.
    const lateOnThe14th = new Date(2026, 7, 14, 23, 30);
    expect(todayIso(lateOnThe14th)).toBe('2026-08-14');
  });
});

describe.each(SCHEMES)('CalendarRange in the %s scheme', (scheme) => {
  it('prompts for an arrival before anything is chosen', () => {
    renderInScheme(
      <CalendarRange value={EMPTY} onChange={() => {}} min="2026-08-01" />,
      scheme,
    );
    expect(screen.getByText(en['calendar.pickStart'])).toBeTruthy();
  });

  it('prompts for a departure once a start is chosen', () => {
    renderInScheme(
      <CalendarRange
        value={{ start: '2026-08-14', end: null }}
        onChange={() => {}}
        min="2026-08-01"
      />,
      scheme,
    );
    expect(screen.getByText(en['calendar.pickEnd'])).toBeTruthy();
  });

  it('counts the nights once both ends are chosen', () => {
    renderInScheme(
      <CalendarRange
        value={{ start: '2026-08-14', end: '2026-08-17' }}
        onChange={() => {}}
        min="2026-08-01"
      />,
      scheme,
    );
    expect(screen.getByText('3 nights')).toBeTruthy();
  });

  it('says "1 night" rather than "1 nights"', () => {
    renderInScheme(
      <CalendarRange
        value={{ start: '2026-08-14', end: '2026-08-15' }}
        onChange={() => {}}
        min="2026-08-01"
      />,
      scheme,
    );
    expect(screen.getByText(en['calendar.oneNight'])).toBeTruthy();
  });

  it('marks a day before the floor as unavailable rather than hiding it', () => {
    // Hiding it would leave a hole in the grid that reads as a rendering bug.
    renderInScheme(
      <CalendarRange value={EMPTY} onChange={() => {}} min="2026-08-10" />,
      scheme,
    );
    const blocked = screen.getByLabelText(
      en['calendar.dayUnavailable'].replace('{day}', '5 August'),
    );
    expect(blocked.props.accessibilityState.disabled).toBe(true);
  });
});
