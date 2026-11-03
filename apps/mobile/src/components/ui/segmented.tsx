import { View } from "react-native";
import { haptic } from "@/lib/haptics";
import { Icon, type IconName } from "./icon";
import { metrics } from "./metrics";
import { PressArea } from "./press-area";
import { Text } from "./text";

export type SegmentedOption<T extends string> = { value: T; label: string; icon?: IconName };

export type SegmentedProps<T extends string> = {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** What the choice is about, read aloud ("Floor", "How urgent?"). */
  label: string;
  /** Layout only. */
  className?: string;
};

/**
 * `.seg`: two to four equal segments on the neutral fill; the chosen one is a raised surface pill
 * in the page's ink, the others muted. Each segment is a 48 high press area whose 40 pill sits 4
 * inside it, so the control is 48 high, the prototype's 46 plus the floor. It ticks on a change (D-r).
 */
export function Segmented<T extends string>({ options, value, onChange, label, className }: SegmentedProps<T>) {
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={label}
      className={["flex-row rounded-2xl bg-default", className].filter(Boolean).join(" ")}
    >
      {options.map((option) => {
        const on = option.value === value;
        return (
          <PressArea
            key={option.value}
            feedback="none"
            onPress={() => {
              if (on) return;
              haptic.selection();
              onChange(option.value);
            }}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: on }}
            className="flex-1 justify-center p-1"
          >
            <View
              className={`flex-row items-center justify-center gap-1.5 rounded-xl px-2 ${on ? "bg-surface shadow-surface" : ""}`}
              style={{ minHeight: metrics.segment }}
            >
              {option.icon ? <Icon name={option.icon} size={16} tone={on ? "default" : "muted"} /> : null}
              <Text role="callout" strong tone={on ? "default" : "muted"} className="text-center" maxScale={1.5}>
                {option.label}
              </Text>
            </View>
          </PressArea>
        );
      })}
    </View>
  );
}
