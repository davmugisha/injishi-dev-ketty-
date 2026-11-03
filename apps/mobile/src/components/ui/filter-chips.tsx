import { ScrollView, View } from "react-native";
import { haptic } from "@/lib/haptics";
import { CountBadge } from "./badge";
import { Inverse } from "./ground";
import { Icon, type IconName } from "./icon";
import { metrics } from "./metrics";
import { PressArea } from "./press-area";
import { Text } from "./text";

export type FilterOption<T extends string> = {
  value: T;
  /** The words ("All stays", "To do · 7"). */
  label: string;
  icon?: IconName;
  /** A red count after the words (`Alerts ③`), read aloud as "3 new". */
  count?: number;
};

export type FilterChipsProps<T extends string> = {
  options: readonly FilterOption<T>[];
  /** The chosen value; an array when `multiple`. */
  value: T | readonly T[];
  onChange: (value: T) => void;
  /** Several may be on at once; `onChange` then reports the one pressed, to toggle. */
  multiple?: boolean;
  /** What is being filtered, read aloud ("Room status"). */
  label: string;
  /** `scroll` (default) is the prototype's `.filters` row that runs off the edge; `wrap` lays them in lines. */
  layout?: "scroll" | "wrap";
  /** Layout only. A scrolling row pads itself 16 in from the edges. */
  className?: string;
};

/**
 * `.fchip` in `.filters`: 36 high pills on the surface with a line, the chosen ones inverted (the
 * page's ink as the fill, `.fchip.on`). Each pill sits in a 48 press area, ticks when it changes
 * (D-r), and is read as a toggle with its state.
 */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  multiple = false,
  label,
  layout = "scroll",
  className,
}: FilterChipsProps<T>) {
  const chosen = new Set<string>(typeof value === "string" ? [value] : value);
  const chips = options.map((option) => {
    const on = chosen.has(option.value);
    const pill = <FilterPill option={option} on={on} />;
    return (
      <PressArea
        key={option.value}
        onPress={() => {
          haptic.selection();
          onChange(option.value);
        }}
        accessibilityRole={multiple ? "checkbox" : "radio"}
        accessibilityLabel={option.count ? `${option.label}, ${option.count} new` : option.label}
        accessibilityState={multiple ? { checked: on } : { selected: on }}
        className="justify-center"
      >
        {on ? <Inverse>{pill}</Inverse> : pill}
      </PressArea>
    );
  });
  if (layout === "wrap") {
    return (
      <View
        accessibilityRole={multiple ? undefined : "radiogroup"}
        accessibilityLabel={label}
        className={["flex-row flex-wrap gap-x-2", className].filter(Boolean).join(" ")}
      >
        {chips}
      </View>
    );
  }
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole={multiple ? undefined : "radiogroup"}
      accessibilityLabel={label}
      className={className}
      contentContainerClassName="gap-2 px-4"
    >
      {chips}
    </ScrollView>
  );
}

function FilterPill<T extends string>({ option, on }: { option: FilterOption<T>; on: boolean }) {
  return (
    <View
      className={`flex-row items-center gap-1.5 rounded-full border px-3.5 ${on ? "border-surface bg-surface" : "border-border bg-surface"}`}
      style={{ minHeight: metrics.filterChip }}
    >
      {option.icon ? <Icon name={option.icon} size={16} /> : null}
      <Text role="callout" strong maxScale={1.5}>
        {option.label}
      </Text>
      {option.count ? <CountBadge count={option.count} /> : null}
    </View>
  );
}
