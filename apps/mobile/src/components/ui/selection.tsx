import type { ReactNode } from "react";
import { View } from "react-native";
import { haptic } from "@/lib/haptics";
import { OnGround } from "./ground";
import { Glyph, Icon, type IconName } from "./icon";
import { metrics } from "./metrics";
import { PressArea } from "./press-area";
import { Text } from "./text";
import { softGround } from "./tone";

export type RadioProps = {
  selected: boolean;
  /** Makes it a control of its own (a 48 press area). Absent, it only draws, inside a pressable row. */
  onPress?: () => void;
  /** Read aloud when it is a control of its own. */
  label?: string;
  isDisabled?: boolean;
};

/** `.radio`: a 22 ring, accent with a 10 dot when selected. */
export function Radio({ selected, onPress, label, isDisabled }: RadioProps) {
  const mark = (
    <View
      className={`items-center justify-center rounded-full border-2 ${selected ? "border-accent" : "border-border"}`}
      style={{ width: metrics.radio, height: metrics.radio }}
    >
      {selected ? (
        <View className="rounded-full bg-accent" style={{ width: metrics.radioDot, height: metrics.radioDot }} />
      ) : null}
    </View>
  );
  if (!onPress) return <View importantForAccessibility="no-hide-descendants">{mark}</View>;
  return (
    <PressArea
      feedback="none"
      onPress={() => {
        haptic.selection();
        onPress();
      }}
      isDisabled={isDisabled}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      className="items-center justify-center"
    >
      {mark}
    </PressArea>
  );
}

export type CheckboxProps = {
  checked: boolean;
  /** Makes it a control of its own (a 48 press area). Absent, it only draws, inside a pressable row. */
  onChange?: (next: boolean) => void;
  /** Read aloud when it is a control of its own. */
  label?: string;
  /** `danger` is `.check.bad`: a failed inspection item. */
  tone?: "accent" | "danger";
  isDisabled?: boolean;
};

const CHECKED = {
  accent: { root: "border-accent bg-accent", role: "accent-foreground" },
  danger: { root: "border-danger bg-danger", role: "danger-foreground" },
} as const;

/** `.check`: a 24 box with 8 corners; checked, a filled box with a tick (a cross for `danger`). */
export function Checkbox({ checked, onChange, label, tone = "accent", isDisabled }: CheckboxProps) {
  const mark = (
    <View
      className={`items-center justify-center rounded-lg border-2 ${checked ? CHECKED[tone].root : "border-border"}`}
      style={{ width: metrics.checkbox, height: metrics.checkbox }}
    >
      {checked ? <Glyph name={tone === "danger" ? "Xmark" : "Check"} size={16} role={CHECKED[tone].role} /> : null}
    </View>
  );
  if (!onChange) return <View importantForAccessibility="no-hide-descendants">{mark}</View>;
  return (
    <PressArea
      feedback="none"
      onPress={() => {
        haptic.selection();
        onChange(!checked);
      }}
      isDisabled={isDisabled}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      className="items-center justify-center"
    >
      {mark}
    </PressArea>
  );
}

export type ChoiceProps = {
  title: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
  /** The mark at the start: `radio` (one of many, default), `checkbox` (any of many) or `none`. */
  indicator?: "radio" | "checkbox" | "none";
  /** After the mark: an `IconTile`, an `Avatar`, a `Photo` thumbnail. */
  leading?: ReactNode;
  /** At the end: a price, a `Radio` drawn on the right, a chip. */
  trailing?: ReactNode;
  isDisabled?: boolean;
};

/**
 * `.choice`: one option as a card, 16 corners and a 2 line; selected, the accent line on the
 * accent tint, its words in the tint's measured label. The whole card is one press area that a
 * screen reader hears as a radio button or a checkbox with its state.
 */
export function Choice({
  title,
  subtitle,
  selected,
  onPress,
  indicator = "radio",
  leading,
  trailing,
  isDisabled,
}: ChoiceProps) {
  return (
    <PressArea
      onPress={() => {
        haptic.selection();
        onPress();
      }}
      isDisabled={isDisabled}
      accessibilityRole={indicator === "checkbox" ? "checkbox" : "radio"}
      accessibilityState={{ checked: selected }}
      className="overflow-hidden rounded-2xl"
    >
      <OnGround ground={selected ? softGround("accent") : null}>
        <View
          className={`flex-row items-center gap-3 rounded-2xl border-2 p-3.5 ${selected ? "border-accent bg-accent-soft" : "border-border bg-surface"}`}
        >
          {indicator === "radio" ? <Radio selected={selected} /> : null}
          {indicator === "checkbox" ? <Checkbox checked={selected} /> : null}
          {leading}
          <View className="flex-1 gap-0.5">
            <Text role="callout" strong>
              {title}
            </Text>
            {subtitle ? (
              <Text role="caption" tone="muted">
                {subtitle}
              </Text>
            ) : null}
          </View>
          {trailing}
        </View>
      </OnGround>
    </PressArea>
  );
}

export type OptionTileProps = {
  icon: IconName;
  label: string;
  selected: boolean;
  onPress: () => void;
  /** `true` when several can be chosen: read as a checkbox instead of a radio button. */
  multiple?: boolean;
  isDisabled?: boolean;
};

/**
 * A square choice of an icon over a word (Report a problem's Plumbing, Electrical, AC): the
 * surface with a hairline, selected the accent line on the accent tint. Lay several out with
 * `TileGrid columns={3}`.
 */
export function OptionTile({ icon, label, selected, onPress, multiple = false, isDisabled }: OptionTileProps) {
  return (
    <PressArea
      onPress={() => {
        haptic.selection();
        onPress();
      }}
      isDisabled={isDisabled}
      accessibilityRole={multiple ? "checkbox" : "radio"}
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      className="overflow-hidden rounded-2xl"
    >
      <OnGround ground={selected ? softGround("accent") : null}>
        <View
          className={`items-center justify-center gap-1.5 rounded-2xl border-2 px-2 py-3.5 ${selected ? "border-accent bg-accent-soft" : "border-separator bg-surface"}`}
        >
          <Icon name={icon} size={24} />
          <Text role="caption" strong className="text-center">
            {label}
          </Text>
        </View>
      </OnGround>
    </PressArea>
  );
}
