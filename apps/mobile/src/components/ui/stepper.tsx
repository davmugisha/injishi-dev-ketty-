import { View } from "react-native";
import { haptic } from "@/lib/haptics";
import { Icon } from "./icon";
import { metrics } from "./metrics";
import { PressArea } from "./press-area";
import { Text } from "./text";

export type StepperProps = {
  value: number;
  onChange: (next: number) => void;
  /** What is counted, read aloud with the value ("Adults"). */
  label: string;
  min?: number;
  max?: number;
  step?: number;
  /** How the value reads on screen and aloud ("2 nights", "2 adults"). Default the number. */
  format?: (value: number) => string;
};

/**
 * `.stepper`: a round minus, the value, a round plus, 14 apart. Each button is a 36 ring in a 48
 * press area, dimmed at its limit. A screen reader hears one adjustable control: swipe up or down
 * to change it, as on any native stepper.
 */
export function Stepper({
  value,
  onChange,
  label,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  step = 1,
  format,
}: StepperProps) {
  const shown = format ? format(value) : String(value);
  const canLess = value - step >= min;
  const canMore = value + step <= max;
  const set = (next: number) => {
    haptic.selection();
    onChange(next);
  };
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: shown }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "increment" && canMore) set(value + step);
        if (event.nativeEvent.actionName === "decrement" && canLess) set(value - step);
      }}
      className="flex-row items-center gap-1.5"
    >
      <StepButton icon="Minus" isDisabled={!canLess} onPress={() => set(value - step)} />
      <Text role="callout" strong tabular className="text-center">
        {shown}
      </Text>
      <StepButton icon="Plus" isDisabled={!canMore} onPress={() => set(value + step)} />
    </View>
  );
}

function StepButton({
  icon,
  isDisabled,
  onPress,
}: {
  icon: "Minus" | "Plus";
  isDisabled: boolean;
  onPress: () => void;
}) {
  return (
    // The pair is one adjustable control to a screen reader; the buttons are for fingers.
    <PressArea
      onPress={onPress}
      isDisabled={isDisabled}
      accessibilityLabel={icon === "Plus" ? "More" : "Fewer"}
      className="items-center justify-center"
    >
      <View
        importantForAccessibility="no-hide-descendants"
        className={`items-center justify-center rounded-full border border-border ${isDisabled ? "opacity-40" : ""}`}
        style={{ width: metrics.stepperButton, height: metrics.stepperButton }}
      >
        <Icon name={icon} size={16} />
      </View>
    </PressArea>
  );
}
