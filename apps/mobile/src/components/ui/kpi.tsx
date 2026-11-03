import { View } from "react-native";
import { OnGround } from "./ground";
import { metrics } from "./metrics";
import { PressArea } from "./press-area";
import { Text } from "./text";

export type SparklineProps = {
  /** One bar per value; any scale, drawn against the largest. */
  values: readonly number[];
  /** Which bar is strong: the last (today) by default, the rest at 30%. */
  highlight?: number;
  /** What the bars show, read aloud ("Occupancy, last 7 days"). Without it the bars are decoration. */
  label?: string;
};

/** `.spark i`: the bars that are not today, at 30% of the accent. */
const FAINT = 0.3;

/**
 * `.spark`: a 28 high row of rounded accent bars, 4 apart, today's at full strength. A glance, not
 * a chart: the figure beside it carries the number.
 */
export function Sparkline({ values, highlight, label }: SparklineProps) {
  const max = Math.max(...values, 0) || 1;
  const strong = highlight ?? values.length - 1;
  return (
    <View
      accessible={Boolean(label)}
      accessibilityRole={label ? "image" : undefined}
      accessibilityLabel={label}
      importantForAccessibility={label ? "yes" : "no-hide-descendants"}
      className="flex-row items-end gap-1"
      style={{ height: metrics.sparkline }}
    >
      {values.map((value, i) => (
        <View
          // biome-ignore lint/suspicious/noArrayIndexKey: a bar is a position in the series
          key={i}
          className="flex-1 rounded-sm bg-accent"
          style={{ height: `${Math.max(MIN_BAR, (value / max) * 100)}%`, opacity: i === strong ? 1 : FAINT }}
        />
      ))}
    </View>
  );
}

/** A zero still shows a sliver, so the series reads as a series. */
const MIN_BAR = 8;

export type KpiProps = {
  /** `.kpi > span`: what is counted ("Occupancy tonight"). */
  label: string;
  /** `.kpi > b`: the figure ("82%", "4.8", "9"). */
  value: string;
  /** `.kpi > b small`: a quieter unit after the figure ("M", "/ 14"). */
  unit?: string;
  /** `.kpi > small`: one quiet line under it ("+6 pts vs last Tue"). */
  caption?: string;
  /** A `Sparkline` under the figure. */
  trend?: readonly number[];
  /** Opens the detail. */
  onPress?: () => void;
};

/**
 * `.kpi`: one figure on the surface with a hairline, 20 cornered: a small label, the figure in
 * `title2 tabular` with an optional unit, a caption, and an optional sparkline. A screen reader
 * reads it as one line ("Occupancy tonight, 82%, +6 pts vs last Tue").
 */
export function Kpi({ label, value, unit, caption, trend, onPress }: KpiProps) {
  const spoken = [label, `${value}${unit ? ` ${unit}` : ""}`, caption].filter(Boolean).join(", ");
  const body = (
    <OnGround ground={null}>
      <View
        accessible={!onPress}
        accessibilityLabel={spoken}
        className="grow rounded-3xl border border-separator bg-surface px-3.5 py-3"
      >
        <Text role="caption" tone="muted" strong>
          {label}
        </Text>
        <View className="mt-0.5 flex-row items-baseline gap-0.5">
          <Text role="title2" tabular>
            {value}
          </Text>
          {unit ? (
            <Text role="callout" tone="muted" strong>
              {unit}
            </Text>
          ) : null}
        </View>
        {caption ? (
          <Text role="caption" tone="muted">
            {caption}
          </Text>
        ) : null}
        {trend && trend.length > 0 ? (
          <View className="mt-2">
            <Sparkline values={trend} />
          </View>
        ) : null}
      </View>
    </OnGround>
  );
  if (!onPress) return body;
  return (
    <PressArea onPress={onPress} accessibilityLabel={spoken} className="grow">
      {body}
    </PressArea>
  );
}
