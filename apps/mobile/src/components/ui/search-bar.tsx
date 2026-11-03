import type { ReactNode, Ref } from "react";
import { TextInput, type TextInputInstance, View } from "react-native";
import { useCSSVariable } from "uniwind";
import { OnGround } from "./ground";
import { Icon } from "./icon";
import { IconButton } from "./icon-button";
import { metrics } from "./metrics";
import { PressArea } from "./press-area";
import { roleText, Text } from "./text";

export type SearchBarProps = {
  /** Typing mode (`.search`): the query. Give `value` and `onChangeText`. */
  value?: string;
  onChangeText?: (text: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  /**
   * Summary mode (the guest search pill, `.gx-searchbar`): a bold line and a quiet one ("Rubavu,
   * Lake Kivu" over "Wed 14 – Fri 16 Oct · 2 adults"); pressing it opens the search.
   */
  title?: string;
  subtitle?: string;
  onPress?: () => void;
  /** At the end: a filter `IconButton` (summary mode) or anything small. */
  trailing?: ReactNode;
  /** The accessible name in typing mode. Defaults to the placeholder, then "Search". */
  label?: string;
  /** Layout only, e.g. `mx-4`. */
  className?: string;
  ref?: Ref<TextInputInstance>;
};

const TYPE = roleText("body");
/** One line takes no leading: iOS sets a single line's text off centre when it has one. */
const { lineHeight: _leading, ...ONE_LINE } = TYPE.style;

/**
 * The search pill: 52 high on the surface with a hairline and a soft shadow, a magnifier at the
 * start. Typing mode is `.search` with a clear button once there is a query; summary mode is the
 * guest pill, a button that reads its two lines.
 */
export function SearchBar({
  value,
  onChangeText,
  onSubmit,
  placeholder,
  autoFocus,
  title,
  subtitle,
  onPress,
  trailing,
  label,
  className,
  ref,
}: SearchBarProps) {
  const placeholderColor = useCSSVariable("--color-field-placeholder");
  const shell = ["flex-row items-center gap-3 rounded-full border border-border bg-surface shadow-overlay", className]
    .filter(Boolean)
    .join(" ");

  if (onPress && !onChangeText) {
    return (
      <OnGround ground={null}>
        <View className={`${shell} py-1.5 pl-4 pr-1.5`} style={{ minHeight: metrics.searchBar }}>
          <PressArea
            onPress={onPress}
            feedback="none"
            accessibilityLabel={[title ?? placeholder ?? "Search", subtitle].filter(Boolean).join(", ")}
            accessibilityHint="Opens the search"
            className="flex-1 flex-row items-center gap-3"
          >
            <Icon name="Magnifier" size={20} />
            <View className="flex-1">
              {title ? (
                <Text role="callout" strong numberOfLines={1}>
                  {title}
                </Text>
              ) : (
                <Text role="body" tone="muted" numberOfLines={1}>
                  {placeholder ?? "Search"}
                </Text>
              )}
              {subtitle ? (
                <Text role="caption" tone="muted" numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
          </PressArea>
          {trailing}
        </View>
      </OnGround>
    );
  }

  return (
    <OnGround ground={null}>
      <View className={`${shell} pl-4 pr-1`} style={{ minHeight: metrics.searchBar }}>
        <Icon name="Magnifier" size={20} tone="muted" />
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmit}
          placeholder={placeholder}
          placeholderTextColor={String(placeholderColor)}
          autoFocus={autoFocus}
          returnKeyType="search"
          autoCorrect={false}
          accessibilityLabel={label ?? placeholder ?? "Search"}
          accessibilityRole="search"
          maxFontSizeMultiplier={TYPE.maxFontSizeMultiplier}
          className={`flex-1 self-stretch text-foreground ${TYPE.className}`}
          style={[ONE_LINE, { paddingVertical: 0, paddingHorizontal: 0 }]}
        />
        {value && onChangeText ? (
          <IconButton icon="Xmark" label="Clear search" variant="plain" tone="muted" onPress={() => onChangeText("")} />
        ) : (
          <View className="w-3" />
        )}
        {trailing}
      </View>
    </OnGround>
  );
}
