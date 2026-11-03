import { easingCurves, motionMs } from "@injishi/design-tokens";
import { PressableFeedback } from "heroui-native";
import { type ReactNode, useState } from "react";
import {
  type AccessibilityRole,
  type AccessibilityState,
  type AccessibilityValue,
  Platform,
  type StyleProp,
  View,
  type ViewStyle,
} from "react-native";
import { Easing } from "react-native-reanimated";
import { useCSSVariable } from "uniwind";
import { useReduceMotion } from "@/lib/use-reduce-motion";
import { metrics } from "./metrics";

/**
 * How a press answers (mobile spec 0002, D-q): buttons, pressable cards and tiles shrink to 0.97
 * over `motionMs.quick` on the `settle` curve; rows show the `pressed` colour, as a highlight on iOS
 * and a ripple on Android.
 */
export const pressMotion = {
  scale: 0.97,
  timing: { duration: motionMs.quick, easing: Easing.bezier(...easingCurves.settle) },
} as const;

/** HeroUI's scale animation at the kit's values, for `Button` and `PressArea`. */
export const pressScaleAnimation = {
  scale: { value: pressMotion.scale, ignoreScaleCoefficient: true, timingConfig: pressMotion.timing },
} as const;

export type PressAreaProps = {
  onPress: () => void;
  onLongPress?: () => void;
  /**
   * `scale` for buttons, cards and tiles; `native` for rows; `none` for a control that shows its
   * own state change (a switch, a segment, a key), which still shows the pressed colour under
   * Reduce Motion.
   */
  feedback?: "scale" | "native" | "none";
  children: ReactNode;
  isDisabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  accessibilityValue?: AccessibilityValue;
  testID?: string;
  className?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Anything pressable that is not a `Button`. It is at least 48 × 48 (D-p), by its minimum size,
 * never by `hitSlop`. Under Reduce Motion HeroUI's provider turns every animation off, so this
 * draws the `pressed` colour itself while a finger is down, and nothing moves (AC-13).
 *
 * A caller that rounds its corners should also clip (`overflow-hidden`), so the highlight, the
 * ripple and the pressed colour keep to its shape.
 */
export function PressArea({
  onPress,
  onLongPress,
  feedback = "scale",
  children,
  isDisabled = false,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = "button",
  accessibilityState,
  accessibilityValue,
  testID,
  className,
  style,
}: PressAreaProps) {
  const reduceMotion = useReduceMotion();
  const [pressed, setPressed] = useState(false);
  const pressedColor = String(useCSSVariable("--color-pressed"));
  return (
    <PressableFeedback
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      isDisabled={isDisabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ disabled: isDisabled, ...accessibilityState }}
      accessibilityValue={accessibilityValue}
      testID={testID}
      animation={feedback === "scale" ? pressScaleAnimation : false}
      className={className}
      style={[{ minHeight: metrics.touch, minWidth: metrics.touch }, style]}
    >
      {feedback === "native" && Platform.OS !== "android" ? (
        <PressableFeedback.Highlight
          animation={{ backgroundColor: { value: pressedColor }, opacity: { value: [0, 1] } }}
        />
      ) : null}
      {children}
      {feedback === "native" && Platform.OS === "android" ? (
        // After the content, on top: the ripple starts from its own layer's touch, which a sibling
        // drawn over it would take. The `pressed` role carries its own 8% alpha, so it runs at full
        // opacity: HeroUI's default peak of 0.1 would multiply it down to an invisible 1%.
        <PressableFeedback.Ripple
          animation={{ backgroundColor: { value: pressedColor }, opacity: { value: [0, 1, 0] } }}
        />
      ) : null}
      {reduceMotion && pressed ? <PressedLayer /> : null}
    </PressableFeedback>
  );
}

/** The `pressed` colour over the whole element, for Reduce Motion (D-q). Kit parts reuse it. */
export function PressedLayer() {
  return <View className="absolute inset-0 bg-pressed" style={{ pointerEvents: "none" }} />;
}
