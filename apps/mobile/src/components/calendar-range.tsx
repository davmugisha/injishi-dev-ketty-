/**
 * CalendarRange — a month grid with a start and an end selection.
 *
 * Motivated by the Guest canvas BookDates artboard, and by frame R17's
 * move-out date field. **No library**, per Session 0's prompt: a date grid is
 * arithmetic and a flex wrap, and every calendar package on npm brings its own
 * theming system that would then have to be talked out of its colours.
 *
 * The decisions worth knowing:
 *
 *   - **Dates are plain `YYYY-MM-DD` strings, not `Date` objects.** A `Date` is
 *     an instant, and an instant is in a timezone; a check-in is a calendar
 *     day. `new Date('2026-08-14')` parses as UTC midnight and prints as the
 *     13th anywhere west of Greenwich, which is exactly the class of bug that
 *     makes a booking arrive a day early. Every comparison here is string
 *     comparison on that format, which sorts correctly by construction.
 *   - **Selection is a two-tap state machine**, and the third tap starts over
 *     rather than extending: tapping a date when a complete range exists is
 *     someone changing their mind, not someone adding a third endpoint.
 *   - **A tap before the start date restarts from there** instead of refusing.
 *     Refusing means the user has to find the clear control; restarting is what
 *     they meant.
 *   - **Past and disabled days are not pressable and say so**, rather than
 *     being pressable and silently doing nothing.
 *
 * Each day is a 44pt target, so the grid clears the touch floor without
 * `hitSlop` — on a 393pt viewport seven columns leave ~47pt each.
 */
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Text } from './text';
import { Icon } from './icon';
import { PressableScale } from './pressable-scale';
import { useTheme } from '@/theme/theme';
import { useT, type MessageKey, type Translate } from '@/i18n/i18n';

/** `YYYY-MM-DD`. Compared as a string; the format sorts correctly. */
export type IsoDay = string;

export interface DateRange {
  start: IsoDay | null;
  end: IsoDay | null;
}

const MONTH_KEYS: MessageKey[] = [
  'calendar.m1', 'calendar.m2', 'calendar.m3', 'calendar.m4', 'calendar.m5', 'calendar.m6',
  'calendar.m7', 'calendar.m8', 'calendar.m9', 'calendar.m10', 'calendar.m11', 'calendar.m12',
];

const WEEKDAY_KEYS: MessageKey[] = [
  'calendar.d0', 'calendar.d1', 'calendar.d2', 'calendar.d3',
  'calendar.d4', 'calendar.d5', 'calendar.d6',
];

/** Today as `YYYY-MM-DD` in the device's own calendar day, not in UTC. */
export function todayIso(now = new Date()): IsoDay {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isoDay(year: number, monthIndex: number, day: number): IsoDay {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Nights between two days. The booking unit is nights, never days. */
export function nightsBetween(start: IsoDay, end: IsoDay): number {
  const a = Date.UTC(+start.slice(0, 4), +start.slice(5, 7) - 1, +start.slice(8, 10));
  const b = Date.UTC(+end.slice(0, 4), +end.slice(5, 7) - 1, +end.slice(8, 10));
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/**
 * The next range for a tap on `day`. Pure, and exported, because this is the
 * whole behaviour of the control and it deserves a test that does not render.
 */
export function nextRange(current: DateRange, day: IsoDay): DateRange {
  const { start, end } = current;
  // Nothing chosen, or a complete range: this tap is a new start.
  if (!start || end) return { start: day, end: null };
  // Tapping the start again clears it rather than making a zero-night stay.
  if (day === start) return { start: null, end: null };
  // Before the start: they meant to start here, not to refuse.
  if (day < start) return { start: day, end: null };
  return { start, end: day };
}

interface MonthProps {
  year: number;
  month: number;
  range: DateRange;
  min: IsoDay;
  max?: IsoDay;
  unavailable: ReadonlySet<IsoDay>;
  onPick: (day: IsoDay) => void;
  t: Translate;
}

function Month({ year, month, range, min, max, unavailable, onPick, t }: MonthProps) {
  const { c, space, radius } = useTheme();

  const cells = useMemo(() => {
    const first = new Date(year, month, 1).getDay();
    const days = new Date(year, month + 1, 0).getDate();
    // Leading blanks so the 1st lands under its weekday.
    return [
      ...Array.from({ length: first }, () => null),
      ...Array.from({ length: days }, (_, i) => i + 1),
    ];
  }, [year, month]);

  return (
    <View style={{ gap: space[2] }}>
      <Text weight="semibold" size="md" color="textStrong" style={{ paddingHorizontal: space[1] }}>
        {`${t(MONTH_KEYS[month])} ${year}`}
      </Text>

      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ flexDirection: 'row' }}
      >
        {WEEKDAY_KEYS.map((key) => (
          <View key={key} style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}>
            <Text size="2xs" color="textMuted" weight="medium">
              {t(key)}
            </Text>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((day, i) => {
          if (day === null) {
            return <View key={`blank-${i}`} style={{ width: `${100 / 7}%`, height: 44 }} />;
          }
          const iso = isoDay(year, month, day);
          const disabled = iso < min || (max ? iso > max : false) || unavailable.has(iso);
          const isStart = iso === range.start;
          const isEnd = iso === range.end;
          const inRange =
            !!range.start && !!range.end && iso > range.start && iso < range.end;
          const selected = isStart || isEnd;

          const label = `${day} ${t(MONTH_KEYS[month])}`;
          const spoken = disabled
            ? t('calendar.dayUnavailable', { day: label })
            : selected
              ? t('calendar.daySelected', { day: label })
              : t('calendar.dayAvailable', { day: label });

          return (
            <View
              key={iso}
              style={{
                width: `${100 / 7}%`,
                height: 44,
                alignItems: 'center',
                justifyContent: 'center',
                // The connecting band under a range, drawn behind the day so
                // the two endpoints read as one selection rather than two taps.
                backgroundColor: inRange ? c.actionSubtle : 'transparent',
              }}
            >
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={spoken}
                accessibilityState={{ selected, disabled }}
                disabled={disabled}
                onPress={() => onPick(iso)}
                // The circle is 38pt and `PressableScale` makes the drawn size
                // the hit area, so the slop is what reaches the 44pt floor
                // (mobile audit 2026-10-05, XC-10).
                hitSlop={3}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: radius.pill,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: selected ? c.action : 'transparent',
                }}
              >
                <Text
                  family="mono"
                  weight={selected ? 'semibold' : 'regular'}
                  size="sm"
                  // On the `action` fill the foreground is `bgApp`, the role
                  // that inverts with it (ADR-028).
                  color={selected ? 'bgApp' : disabled ? 'textSubtle' : 'textBody'}
                  style={disabled ? { textDecorationLine: 'line-through' } : undefined}
                >
                  {String(day)}
                </Text>
              </PressableScale>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export interface CalendarRangeProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  /** Earliest selectable day. Defaults to today — the past is never bookable. */
  min?: IsoDay;
  max?: IsoDay;
  /** Days that exist but cannot be taken. Drawn struck through, not hidden. */
  unavailable?: readonly IsoDay[];
  /** How many months to page through from `min`. */
  months?: number;
}

export function CalendarRange({
  value,
  onChange,
  min,
  max,
  unavailable = [],
  months = 12,
}: CalendarRangeProps) {
  const { c, space, radius } = useTheme();
  const t = useT();
  const floor = min ?? todayIso();
  const blocked = useMemo(() => new Set(unavailable), [unavailable]);

  const [offset, setOffset] = useState(0);
  const base = useMemo(() => new Date(+floor.slice(0, 4), +floor.slice(5, 7) - 1, 1), [floor]);
  const shown = useMemo(
    () => new Date(base.getFullYear(), base.getMonth() + offset, 1),
    [base, offset],
  );

  const nights = value.start && value.end ? nightsBetween(value.start, value.end) : 0;

  return (
    <View style={{ gap: space[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        <PressableScale
          accessibilityLabel={t('calendar.prevMonth')}
          disabled={offset === 0}
          onPress={() => setOffset((n) => Math.max(0, n - 1))}
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: c.surface2,
          }}
        >
          <Icon name="chevronLeft" size={18} color={c.textBody} />
        </PressableScale>

        <Text size="sm" color="textMuted" center style={{ flex: 1 }}>
          {value.start && value.end
            ? nights === 1
              ? t('calendar.oneNight')
              : t('calendar.nights', { count: nights })
            : value.start
              ? t('calendar.pickEnd')
              : t('calendar.pickStart')}
        </Text>

        <PressableScale
          accessibilityLabel={t('calendar.nextMonth')}
          disabled={offset >= months - 1}
          onPress={() => setOffset((n) => Math.min(months - 1, n + 1))}
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: c.surface2,
          }}
        >
          <Icon name="chevronRight" size={18} color={c.textBody} />
        </PressableScale>
      </View>

      <Month
        year={shown.getFullYear()}
        month={shown.getMonth()}
        range={value}
        min={floor}
        max={max}
        unavailable={blocked}
        onPick={(day) => onChange(nextRange(value, day))}
        t={t}
      />

      {value.start ? (
        <PressableScale
          accessibilityLabel={t('calendar.clear')}
          onPress={() => onChange({ start: null, end: null })}
          style={{ alignSelf: 'center', minHeight: 44, justifyContent: 'center' }}
        >
          <Text weight="medium" size="sm" color="textLink">
            {t('calendar.clear')}
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );
}
