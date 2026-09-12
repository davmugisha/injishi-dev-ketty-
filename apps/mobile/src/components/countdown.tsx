/**
 * Countdown and Elapsed — mm:ss driven by a start time, pausable.
 *
 * Motivated by frames W3 ("ELAPSED 12:04" with a pause control, "Started 15:12
 * · your average is 22 min") and X2 ("Resend code in 0:42", which becomes a
 * Resend link at zero).
 *
 * **Both derive their reading from a timestamp, never from a counter they
 * increment.** A `setInterval` that adds one every second drifts, and worse, it
 * stops when the app is backgrounded — an attendant who locks their phone
 * mid-clean comes back to a timer that lost four minutes. Anchoring to a start
 * time means the tick is only what repaints; the value is always
 * `now - startedAt`, so backgrounding costs nothing.
 *
 * The tick is 1s and it is the one place in this kit that sets state on a
 * timer. That is defensible here and nowhere else: the value genuinely changes
 * every second, and one re-render per second of one small subtree is not the
 * per-frame `setState` the animation rules forbid.
 *
 * `tabular-nums` via `family="mono"`, because a clock whose digits change width
 * shifts the layout beside it once a second.
 */
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Text } from './text';
import { Icon } from './icon';
import { PressableScale } from './pressable-scale';
import { useTheme } from '@/theme/theme';
import type { Palette } from '@/theme/tokens';
import { useT } from '@/i18n/i18n';

/** `754` -> `12:34`. Negative clamps to zero rather than printing a minus. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${String(ss).padStart(2, '0')}`;
}

/**
 * Seconds since `startedAt`, plus whatever had already accrued before the last
 * pause. Pure, so a test can assert the arithmetic without a clock.
 */
export function elapsedSeconds(args: {
  startedAt: number | null;
  accrued: number;
  now: number;
}): number {
  const { startedAt, accrued, now } = args;
  return startedAt === null ? accrued : accrued + Math.max(0, (now - startedAt) / 1000);
}

/** One shared 1s heartbeat for anything on screen that shows a clock. */
function useTick(running: boolean): number {
  const [, force] = useState(0);
  const now = useRef(Date.now());
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      now.current = Date.now();
      force((n) => n + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [running]);
  now.current = Date.now();
  return now.current;
}

export interface ElapsedProps {
  /** Epoch ms the current run started, or null while paused. */
  startedAt: number | null;
  /** Seconds banked before the current run. */
  accrued?: number;
  label: string;
  /** Show the pause / resume control (frame W3). */
  onTogglePause?: () => void;
  tone?: keyof Palette;
}

/** Counts up. Frame W3's task timer. */
export function Elapsed({ startedAt, accrued = 0, label, onTogglePause, tone = 'textStrong' }: ElapsedProps) {
  const { c, space } = useTheme();
  const t = useT();
  const now = useTick(startedAt !== null);
  const seconds = elapsedSeconds({ startedAt, accrued, now });
  const reading = formatDuration(seconds);
  const paused = startedAt === null;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          weight="bold"
          size="2xs"
          color="textMuted"
          style={{ letterSpacing: 1, textTransform: 'uppercase' }}
        >
          {label}
        </Text>
        <Text
          accessible
          accessibilityLabel={t('a11y.timer', { label, time: reading })}
          // A live region so the reading is announced as it changes, but
          // `polite`: a clock that interrupts every second is unusable.
          accessibilityLiveRegion="polite"
          family="mono"
          weight="semibold"
          size="2xl"
          color={tone}
          style={{ letterSpacing: -0.5 }}
        >
          {reading}
        </Text>
      </View>
      {onTogglePause ? (
        <PressableScale
          accessibilityLabel={paused ? t('a11y.resumeTimer') : t('a11y.pauseTimer')}
          onPress={onTogglePause}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: c.surface2,
            borderWidth: 1,
            borderColor: c.borderSubtle,
          }}
        >
          <Icon name={paused ? 'play' : 'pause'} size={18} color={c.textBody} />
        </PressableScale>
      ) : null}
    </View>
  );
}

export interface CountdownProps {
  /** Epoch ms the countdown ends. */
  endsAt: number;
  /** Rendered instead of the clock once it reaches zero. Frame X2's Resend. */
  onDone?: () => void;
  label?: string;
  /** Formats the remaining time into the caller's sentence. */
  render?: (reading: string) => string;
}

/** Counts down. Frame X2's "Resend code in 0:42". */
export function Countdown({ endsAt, onDone, label, render }: CountdownProps) {
  const t = useT();
  const now = useTick(true);
  const remaining = Math.max(0, (endsAt - now) / 1000);
  const reading = formatDuration(remaining);
  const done = remaining <= 0;
  const fired = useRef(false);

  useEffect(() => {
    if (done && !fired.current) {
      fired.current = true;
      onDone?.();
    }
  }, [done, onDone]);

  const text = render ? render(reading) : reading;

  return (
    <Text
      accessible
      accessibilityLabel={label ? t('a11y.timer', { label, time: reading }) : text}
      accessibilityLiveRegion="polite"
      family="mono"
      size="sm"
      color="textMuted"
    >
      {text}
    </Text>
  );
}
