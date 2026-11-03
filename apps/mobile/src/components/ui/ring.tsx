import type { ReactNode } from "react";
import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useCSSVariable } from "uniwind";
import { useGround } from "./ground";
import { metrics } from "./metrics";
import type { ProgressTone } from "./progress";

const STROKE = {
  accent: { fill: "accent", track: "surface-tertiary" },
  success: { fill: "success", track: "success-soft" },
  warning: { fill: "warning", track: "warning-soft" },
  danger: { fill: "danger", track: "danger-soft" },
} as const satisfies Record<ProgressTone, { fill: string; track: string }>;

/** `oklch(100% 0 0 / .22)`: the track of a ring drawn on a solid fill. */
const TRACK_ON_FILL = 0.22;

export type RingProps = {
  /** How far round, in percent (0 to 100), as `ring(pct)`. */
  value: number;
  /** The side. Default 76. */
  size?: number;
  /** The line. Default 7. */
  stroke?: number;
  /**
   * `accent` (default) on the third surface; `success` (a paid rent) and the others on their own
   * soft track. On a solid ground (an accent card) the ring takes the ground's ink.
   */
  tone?: ProgressTone;
  /** In the middle: a figure ("5/12" over "rooms"), an icon. */
  children?: ReactNode;
  /** What is measured, read aloud with the percentage ("Rooms done"). */
  label: string;
};

/**
 * `ring()`: a progress circle drawn with react-native-svg, starting at twelve o'clock, round caps,
 * with content in the middle. A screen reader hears a progress bar and its percentage, then the
 * words in the middle are part of its label only if the caller puts them there.
 */
export function Ring({
  value,
  size = metrics.ring.size,
  stroke = metrics.ring.stroke,
  tone = "accent",
  children,
  label,
}: RingProps) {
  const pct = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const ground = useGround();
  const solid = ground?.solid ? ground : null;
  const roles = solid ? { fill: solid.role, track: solid.role } : STROKE[tone];
  const [fill, track] = useCSSVariable([`--color-${roles.fill}`, `--color-${roles.track}`]);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
      className="items-center justify-center"
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={String(track)}
          strokeOpacity={solid ? TRACK_ON_FILL : 1}
          strokeWidth={stroke}
        />
        {pct > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={String(fill)}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={c * (1 - pct / 100)}
          />
        ) : null}
      </Svg>
      <View className="items-center justify-center" importantForAccessibility="no-hide-descendants">
        {children}
      </View>
    </View>
  );
}
