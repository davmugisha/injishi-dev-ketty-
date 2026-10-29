import { View } from "react-native";
import { Icon, type IconName } from "./icon";
import { metrics } from "./metrics";
import { PressArea } from "./press-area";
import type { TextTone } from "./text";

export type IconButtonProps = {
  icon: IconName;
  /** What the button does, read aloud; there are no words on screen. */
  label: string;
  tone?: TextTone;
  onPress: () => void;
  isDisabled?: boolean;
};

/**
 * An icon alone as a button (mobile spec 0002, AC-11): a 40 circle on the `default` fill, drawn
 * inside a 48 box that takes the press, so the target is never smaller than the floor.
 */
export function IconButton({ icon, label, tone = "default", onPress, isDisabled }: IconButtonProps) {
  return (
    <PressArea
      onPress={onPress}
      accessibilityLabel={label}
      isDisabled={isDisabled}
      className="items-center justify-center"
    >
      <View
        className="items-center justify-center overflow-hidden rounded-full bg-default"
        style={{ width: metrics.iconButton, height: metrics.iconButton }}
      >
        <Icon name={icon} size={20} tone={tone} />
      </View>
    </PressArea>
  );
}
