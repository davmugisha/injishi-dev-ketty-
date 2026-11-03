import { router } from "expo-router";
import type { ReactNode } from "react";
import { View } from "react-native";
import { OnPhoto } from "./ground";
import { Icon } from "./icon";
import { IconButton } from "./icon-button";
import { metrics } from "./metrics";
import { PressArea } from "./press-area";
import { Text } from "./text";

/** Back, as the prototype's back button does: the previous screen, or the start when there is none. */
export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}

export type ScreenHeaderProps = {
  /** The large title (`.top .h2`). */
  title: string;
  /** `.eyebrow` above the title: the date, the place, a section name. */
  eyebrow?: string;
  /** One quiet line under the title. */
  subtitle?: string;
  /** Before the title: an avatar, a back button. */
  left?: ReactNode;
  /** After the title: icon buttons, a chip. */
  right?: ReactNode;
  /**
   * Makes the title a switch (the supervisor's "Floor 2 ⌄", the manager's place): a chevron after
   * it and a 48 press area around it.
   */
  onTitlePress?: () => void;
  /** What pressing the title does, read aloud ("Switch floor"). Defaults to the title. */
  titleActionLabel?: string;
};

/**
 * `.top`: a tab root's header. An optional eyebrow, a large title, an optional subtitle, with
 * slots before and after. The title is the screen's heading for a screen reader.
 */
export function ScreenHeader({
  title,
  eyebrow,
  subtitle,
  left,
  right,
  onTitlePress,
  titleActionLabel,
}: ScreenHeaderProps) {
  const heading = (
    <View className="flex-row items-center gap-1">
      <Text role="title2" className="shrink">
        {title}
      </Text>
      {onTitlePress ? <Icon name="ChevronDown" size={16} tone="muted" /> : null}
    </View>
  );
  return (
    <View className="flex-row items-center gap-2.5 px-4 pb-2.5 pt-1.5" style={{ minHeight: metrics.header }}>
      {left}
      <View className="flex-1">
        {eyebrow ? (
          <Text role="micro" tone="muted" caps strong>
            {eyebrow}
          </Text>
        ) : null}
        {onTitlePress ? (
          <PressArea
            onPress={onTitlePress}
            accessibilityLabel={titleActionLabel ?? title}
            className="-my-2 justify-center self-start"
          >
            {heading}
          </PressArea>
        ) : (
          heading
        )}
        {subtitle ? (
          <Text role="callout" tone="muted" className="mt-1">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View className="flex-row items-center gap-1">{right}</View> : null}
    </View>
  );
}

export type NavBarProps = {
  /** Centred (`.navbar .t`). */
  title: string;
  /** `.navbar .t small`: one quiet line under the title. */
  subtitle?: string;
  /** Whether to show the back button. Default true. */
  back?: boolean;
  /** Replaces the default back (`router.back()`, or the start screen when there is no history). */
  onBack?: () => void;
  /** After the title: one or two icon buttons, a chip or a link. */
  right?: ReactNode;
  /**
   * `light` over a photograph: the title and the buttons stay light in both themes, and the back
   * button is frosted glass.
   */
  tone?: "default" | "light";
};

/**
 * `.navbar`: a pushed screen's bar. A back button, a centred title with an optional subtitle, and
 * a right slot. The sides share the width left over, so the title stays centred.
 */
export function NavBar({ title, subtitle, back = true, onBack, right, tone = "default" }: NavBarProps) {
  const bar = (
    <View className="flex-row items-center px-2 pb-2 pt-0.5" style={{ minHeight: metrics.touch }}>
      <View className="flex-1 flex-row items-center justify-start" style={{ flexBasis: 0 }}>
        {back ? (
          <IconButton
            icon="ChevronLeft"
            label="Back"
            variant={tone === "light" ? "glass" : "plain"}
            onPress={onBack ?? goBack}
          />
        ) : null}
      </View>
      <View className="shrink items-center px-1">
        <Text role="headline" strong accessibilityRole="header" className="text-center" numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text role="caption" tone="muted" className="text-center" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View className="flex-1 flex-row items-center justify-end" style={{ flexBasis: 0 }}>
        {right}
      </View>
    </View>
  );
  return tone === "light" ? <OnPhoto>{bar}</OnPhoto> : bar;
}
