/**
 * The six-month fee chart — frame B24, drawn in plain views.
 *
 * **No chart library, and none needed.** Six bars on one linear scale is a flex
 * row with six heights in it; a charting dependency would add a bundle, a
 * gesture surface and an accessibility tree nobody asked for, and this session
 * may not add a dependency in any case.
 *
 * Three things it does that a bar chart usually gets wrong:
 *
 *   - **Every month in the window gets a bar, including the empty ones.** A
 *     chart that omits a month with no fees draws a line that is climbing when
 *     it is actually flat. An empty month gets a stub with a distinct fill, so
 *     "nothing came in" is visibly different from "a small amount came in".
 *   - **The values are readable without seeing it.** Each bar is one
 *     accessibility node carrying its month and its amount as a sentence, and
 *     the whole row is a summary. A chart that reports six unlabelled `View`s
 *     is a chart a screen-reader user cannot read at all.
 *   - **The current month is marked by more than colour.** It is the taller
 *     tone AND the only one with its figure printed under it AND the only one
 *     with a label in the reader's own words ("This month"), because colour is
 *     never the only signal (design brief §7.5).
 *
 * The scale is anchored at zero and topped by the tallest month in the window,
 * which is what makes a bar's height mean its share of the best month. A scale
 * that started somewhere else would exaggerate a difference the reader cannot
 * see the baseline for.
 */
import { View } from 'react-native';
import { MoneyAmount, Text } from '@/components';
import { useTheme } from '@/theme/theme';
import { useT, type MessageKey } from '@/i18n/i18n';
import type { MonthBar } from '@/data/broker';
import { moneyText } from './broker-format';

/** How tall the tallest bar is drawn. */
const PLOT_HEIGHT = 118;

/** What an empty month draws, so it is visible as a month rather than a gap. */
const EMPTY_STUB = 3;

export function EarningsChart({ bars }: { bars: readonly MonthBar[] }) {
  const { c, space, radius } = useTheme();
  const t = useT();

  const peak = Math.max(...bars.map((b) => b.total), 0);
  const current = bars.find((b) => b.current);
  const nothing = peak === 0;

  const monthName = (b: MonthBar) => t(`calendar.m${b.month}` as MessageKey).slice(0, 3);

  return (
    <View style={{ gap: space[3] }}>
      <View
        // The row is one summary so a reader hears "last six months" before the
        // six figures, rather than six numbers with no frame around them.
        accessibilityRole="summary"
        accessibilityLabel={t('earnings.chartTitle')}
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: space[2],
          height: PLOT_HEIGHT,
          paddingTop: space[2],
        }}
      >
        {bars.map((bar) => {
          const height = nothing
            ? EMPTY_STUB
            : Math.max(EMPTY_STUB, Math.round((bar.total / peak) * PLOT_HEIGHT));
          const empty = bar.total === 0;

          return (
            <View
              key={bar.key}
              accessible
              accessibilityLabel={
                empty
                  ? t('earnings.chartEmptyBar', { month: monthName(bar) })
                  : t('earnings.chartBar', { month: monthName(bar), amount: moneyText(bar.total) })
              }
              style={{ flex: 1, justifyContent: 'flex-end' }}
            >
              <View
                style={{
                  height,
                  borderRadius: radius.sm,
                  // Three fills, three facts: this month, a month with fees, a
                  // month with none. The current bar also prints its figure
                  // below, so the distinction never rests on colour alone.
                  backgroundColor: bar.current ? c.brand500 : empty ? c.neutral200 : c.brand200,
                  borderWidth: bar.current ? 1 : 0,
                  borderColor: c.borderBrand,
                }}
              />
            </View>
          );
        })}
      </View>

      {/* The baseline. Drawn rather than implied: without it the shortest bar
          and an empty month are the same picture. */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ height: 1, backgroundColor: c.borderDefault }}
      />

      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ flexDirection: 'row', gap: space[2] }}
      >
        {bars.map((bar) => (
          <Text
            key={bar.key}
            family="mono"
            weight={bar.current ? 'semibold' : 'regular'}
            size="2xs"
            center
            color={bar.current ? 'textStrong' : 'textSubtle'}
            style={{ flex: 1 }}
          >
            {monthName(bar)}
          </Text>
        ))}
      </View>

      {current ? (
        <View
          accessible
          accessibilityLabel={`${t('earnings.chartThisMonth')}, ${moneyText(current.total)}`}
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: space[2],
            paddingTop: 2,
          }}
        >
          <Text size="xs" color="textMuted">
            {t('earnings.chartThisMonth')}
          </Text>
          <MoneyAmount value={current.total} strong size="sm" />
        </View>
      ) : null}

      {nothing ? (
        <Text size="xs" color="textMuted" style={{ lineHeight: 17 }}>
          {t('earnings.chartNothing')}
        </Text>
      ) : null}
    </View>
  );
}
