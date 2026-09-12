/**
 * Countdown and Elapsed — the arithmetic, which is the part that breaks.
 *
 * Both derive their reading from a timestamp rather than from a counter they
 * increment. `elapsedSeconds` is tested directly because that is the whole
 * reason: a timer that adds one per second drifts, and stops entirely when the
 * app is backgrounded — an attendant who locks their phone mid-clean comes back
 * to a timer that lost four minutes. Anchoring to a start time means
 * backgrounding costs nothing, and this test is what says so.
 */
import { screen } from '@testing-library/react-native';
import { Countdown, Elapsed, elapsedSeconds, formatDuration } from './countdown';
import { SCHEMES, renderInScheme } from '@/test-utils';

describe('formatDuration', () => {
  it.each([
    [0, '0:00'],
    [9, '0:09'],
    [59, '0:59'],
    [60, '1:00'],
    [724, '12:04'],
    [3599, '59:59'],
    // Past an hour it keeps counting in minutes rather than growing an hours
    // field: a housekeeping task that ran 62 minutes is a task that overran,
    // and "1:02:15" reads as an hour and two minutes at a glance.
    [3725, '62:05'],
  ])('renders %i seconds as %s', (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });

  it('clamps a negative to zero rather than printing a minus', () => {
    expect(formatDuration(-30)).toBe('0:00');
  });

  it('floors a fraction rather than rounding it up', () => {
    // Rounding up would show 1:00 for 59.6 seconds, so the clock would reach a
    // minute before a minute had passed.
    expect(formatDuration(59.6)).toBe('0:59');
  });
});

describe('elapsedSeconds', () => {
  const start = 1_700_000_000_000;

  it('counts from the start time while running', () => {
    expect(elapsedSeconds({ startedAt: start, accrued: 0, now: start + 90_000 })).toBe(90);
  });

  it('holds at what had accrued while paused', () => {
    expect(elapsedSeconds({ startedAt: null, accrued: 724, now: start + 900_000 })).toBe(724);
  });

  it('adds the current run to what was banked before the pause', () => {
    expect(elapsedSeconds({ startedAt: start, accrued: 724, now: start + 60_000 })).toBe(784);
  });

  it('survives a clock that moved backwards', () => {
    // NTP corrections and manual clock changes both do this. A negative run
    // would make the timer count down, which reads as a bug on the device.
    expect(elapsedSeconds({ startedAt: start, accrued: 100, now: start - 5_000 })).toBe(100);
  });
});

describe.each(SCHEMES)('Elapsed in the %s scheme', (scheme) => {
  it('shows the banked reading while paused', () => {
    renderInScheme(<Elapsed startedAt={null} accrued={724} label="Elapsed" />, scheme);
    expect(screen.getByText('12:04')).toBeTruthy();
  });

  it('offers pause while running and resume while paused', () => {
    renderInScheme(
      <Elapsed startedAt={Date.now()} label="Elapsed" onTogglePause={() => {}} />,
      scheme,
    );
    expect(screen.getByLabelText('Pause the timer')).toBeTruthy();

    renderInScheme(
      <Elapsed startedAt={null} accrued={10} label="Elapsed" onTogglePause={() => {}} />,
      scheme,
    );
    expect(screen.getByLabelText('Resume the timer')).toBeTruthy();
  });

  it('draws no control at all when there is nothing to toggle', () => {
    // An orphaned pause button on a read-only timer is a control that lies.
    renderInScheme(<Elapsed startedAt={null} accrued={0} label="Elapsed" />, scheme);
    expect(screen.queryByLabelText('Pause the timer')).toBeNull();
  });
});

describe.each(SCHEMES)('Countdown in the %s scheme', (scheme) => {
  it('renders the remaining time through the caller sentence', () => {
    renderInScheme(
      <Countdown
        endsAt={Date.now() + 42_000}
        render={(reading) => `Resend code in ${reading}`}
      />,
      scheme,
    );
    expect(screen.getByText(/Resend code in 0:4[12]/)).toBeTruthy();
  });

  it('reads zero once the end has passed', () => {
    renderInScheme(<Countdown endsAt={Date.now() - 5_000} />, scheme);
    expect(screen.getByText('0:00')).toBeTruthy();
  });
});
