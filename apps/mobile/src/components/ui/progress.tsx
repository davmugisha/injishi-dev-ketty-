import { easingCurves, motionMs } from "@injishi/design-tokens";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { useCSSVariable } from "uniwind";
import { useReduceMotion } from "@/lib/use-reduce-motion";
import { useGround } from "./ground";
import { metrics } from "./metrics";

export type ProgressTone = "accent" | "success" | "warning" | "danger";

const FILL = {
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
} as const satisfies Record<ProgressTone, string>;

/** Percent (0 to 100), clamped: the prototype writes `width: 60%`. */
function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

export type ProgressBarProps = {
  /** How far, in percent (0 to 100). */
  value: number;
  tone?: ProgressTone;
  /** `md` is `.bar` (8), `thin` is `.bar.thin` (4). */
  size?: "md" | "thin";
  /** What is measured, read aloud with the percentage ("Checks done"). */
  label: string;
  /** Layout only, e.g. `w-16` for a bar in a row's trailing slot. */
  className?: string;
};

/**
 * `.bar`: a rounded track on the third surface with a fill in `tone`. On a solid ground (an accent
 * card) the track and fill take the ground's ink. A screen reader hears a progress bar and its
 * percentage. The fill glides to a new value; under Reduce Motion it jumps.
 */
export function ProgressBar({ value, tone = "accent", size = "md", label, className }: ProgressBarProps) {
  const pct = clampPercent(value);
  const reduceMotion = useReduceMotion();
  const ground = useGround();
  const width = useSharedValue(pct);
  useEffect(() => {
    width.set(
      reduceMotion
        ? pct
        : withTiming(pct, { duration: motionMs.settle, easing: Easing.bezier(...easingCurves.settle) }),
    );
  }, [pct, reduceMotion, width]);
  const fill = useAnimatedStyle(() => ({ width: `${width.get()}%` }));
  const solid = ground?.solid ? ground : null;
  const ink = String(useCSSVariable(`--color-${solid ? solid.role : "accent"}`));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
      className={["overflow-hidden rounded-full", solid ? "" : "bg-surface-tertiary", className]
        .filter(Boolean)
        .join(" ")}
      style={{ height: size === "thin" ? metrics.progress.thin : metrics.progress.md }}
    >
      {/* On a fill (an accent card) the bar is the ground's ink, its track that ink faint. */}
      {solid ? (
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: ink, opacity: TRACK_ON_FILL, pointerEvents: "none" }]}
        />
      ) : null}
      <Animated.View
        className={`h-full rounded-full ${solid ? "" : FILL[tone]}`}
        style={[fill, solid ? { backgroundColor: ink } : undefined]}
      />
    </View>
  );
}

/** `oklch(100% 0 0 / .22)`: a bar's track on a solid fill. */
const TRACK_ON_FILL = 0.22;

export type StepBarProps = {
  /** How many steps. */
  total: number;
  /** The current step, from 1. Steps before it are done. */
  step: number;
  /** Layout only. */
  className?: string;
};

/**
 * `.steps`: one short bar per step, 6 apart: done steps in the accent at half strength, the
 * current one in the accent, the rest on the third surface. Read aloud as "Step 1 of 2".
 */
export function StepBar({ total, step, className }: StepBarProps) {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${step} of ${total}`}
      accessibilityValue={{ min: 1, max: total, now: step }}
      className={["flex-row gap-1.5", className].filter(Boolean).join(" ")}
    >
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        return (
          <View
            // biome-ignore lint/suspicious/noArrayIndexKey: a step is a position
            key={i}
            className={`flex-1 rounded-full ${n <= step ? "bg-accent" : "bg-surface-tertiary"}`}
            style={{ height: metrics.stepBar, opacity: n < step ? DONE : 1 }}
          />
        );
      })}
    </View>
  );
}

/** `.steps i.done`: a finished step at half the accent. */
const DONE = 0.5;

export type SpinnerProps = {
  /** `sm` 20 inline, `md` 32, `lg` 64 (`.spinner`, a waiting screen). */
  size?: keyof typeof metrics.spinner;
  /** What is happening, read aloud ("Waiting for MTN"). */
  label?: string;
};

/**
 * `.spinner`: a soft accent ring with an accent quarter turning round it. Under Reduce Motion the
 * quarter holds still; the screen reader still hears a busy progress indicator.
 */
export function Spinner({ size = "md", label = "Loading" }: SpinnerProps) {
  const side = metrics.spinner[size];
  const stroke = Math.max(2, Math.round(side / SPINNER_STROKE));
  const r = (side - stroke) / 2;
  const c = 2 * Math.PI * r;
  const reduceMotion = useReduceMotion();
  const [accent, soft] = useCSSVariable(["--color-accent", "--color-accent-soft"]);
  const turn = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(turn);
      turn.set(0);
      return;
    }
    turn.set(0);
    turn.set(
      withRepeat(withTiming(360, { duration: motionMs.arrive * 2, easing: Easing.bezier(...easingCurves.move) }), -1),
    );
    return () => cancelAnimation(turn);
  }, [reduceMotion, turn]);
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.get()}deg` }] }));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      style={{ width: side, height: side }}
    >
      <Animated.View style={[{ width: side, height: side }, spin]}>
        <Svg width={side} height={side}>
          <Circle cx={side / 2} cy={side / 2} r={r} stroke={String(soft)} strokeWidth={stroke} fill="none" />
          <Circle
            cx={side / 2}
            cy={side / 2}
            r={r}
            stroke={String(accent)}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${c / 4} ${c}`}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

/** The ring's stroke against its side: `.spinner`'s 5 on 64. */
const SPINNER_STROKE = 12;
