import { Switch } from "heroui-native";
import { View } from "react-native";
import { haptic } from "@/lib/haptics";
import { metrics } from "./metrics";
import { PressArea } from "./press-area";

export type ToggleProps = {
  value: boolean;
  onValueChange: (next: boolean) => void;
  /** What it turns on, read aloud ("Staff may enter if I am not home"). Usually the row's title. */
  label: string;
  isDisabled?: boolean;
};

/**
 * `.toggle`: HeroUI's switch at the prototype's 48 by 28 with a 22 thumb, neutral off and accent
 * on, its thumb travelling on HeroUI's own spring (still under Reduce Motion). The switch draws
 * only; a 48 press area around it takes the press, reads as a switch with its state, and ticks (D-r).
 * Put it in a `ListItem`'s `trailing`.
 */
export function Toggle({ value, onValueChange, label, isDisabled = false }: ToggleProps) {
  return (
    <PressArea
      feedback="none"
      onPress={() => {
        haptic.selection();
        onValueChange(!value);
      }}
      isDisabled={isDisabled}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      className="items-center justify-center"
    >
      <View style={{ pointerEvents: "none" }} importantForAccessibility="no-hide-descendants" accessible={false}>
        <Switch
          isSelected={value}
          isDisabled={isDisabled}
          accessible={false}
          style={{ width: metrics.toggle.width, height: metrics.toggle.height }}
          animation={{ scale: { value: [1, 1] } }}
        >
          <Switch.Thumb
            className="rounded-full"
            style={{ width: metrics.toggle.thumb, height: metrics.toggle.thumb }}
            animation={{ left: { value: metrics.toggle.inset } }}
          />
        </Switch>
      </View>
    </PressArea>
  );
}
