import { Text as NativeText, View } from "react-native";
import { metrics } from "./metrics";
import { roleText } from "./text";

/** `.count`'s figure: `micro` at its chrome cap, centred in the pill. */
const COUNT = roleText("micro", false, { strong: true, tabular: true });

export type CountBadgeProps = {
  count: number;
  /** Above this it shows `max+` (`9+`). */
  max?: number;
  /** `danger` is the prototype's red `.count`; `accent` and `default` for a quieter number. */
  tone?: "danger" | "accent" | "default";
};

const COUNT_TONE = {
  danger: { root: "bg-danger", label: "text-danger-foreground" },
  accent: { root: "bg-accent", label: "text-accent-foreground" },
  default: { root: "bg-default", label: "text-default-foreground" },
} as const;

/**
 * `.count`: a small number on a pill, on a tab, an icon button or a filter chip. Decoration to a
 * screen reader: the control it sits on says the number in its own label.
 */
export function CountBadge({ count, max = 99, tone = "danger" }: CountBadgeProps) {
  const look = COUNT_TONE[tone];
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      className={`items-center justify-center rounded-full px-1.5 ${look.root}`}
      style={{ minWidth: metrics.countBadge, minHeight: metrics.countBadge }}
    >
      <NativeText
        className={`${COUNT.className} ${look.label}`}
        maxFontSizeMultiplier={COUNT.maxFontSizeMultiplier}
        style={COUNT.style}
      >
        {count > max ? `${max}+` : String(count)}
      </NativeText>
    </View>
  );
}

export type LiveDotProps = {
  /** `success` live and well, `warning` slow, `danger` down. */
  tone?: "success" | "warning" | "danger";
  /** Read aloud ("Live", "Signal weak"). Without it the dot is decoration beside its words. */
  label?: string;
};

const LIVE = {
  success: { halo: "bg-success-soft", dot: "bg-success" },
  warning: { halo: "bg-warning-soft", dot: "bg-warning" },
  danger: { halo: "bg-danger-soft", dot: "bg-danger" },
} as const;

/**
 * `.live`: an 8 dot in its soft halo, the prototype's "this is happening now". It never stands for
 * a state alone: a word beside it (or its `label`) says which.
 */
export function LiveDot({ tone = "success", label }: LiveDotProps) {
  return (
    <View
      accessible={Boolean(label)}
      accessibilityLabel={label}
      importantForAccessibility={label ? "yes" : "no-hide-descendants"}
      className={`items-center justify-center rounded-full ${LIVE[tone].halo}`}
      style={{ width: metrics.liveHalo, height: metrics.liveHalo }}
    >
      <View className={`rounded-full ${LIVE[tone].dot}`} style={{ width: metrics.liveDot, height: metrics.liveDot }} />
    </View>
  );
}
