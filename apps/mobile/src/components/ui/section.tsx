import type { ReactNode } from "react";
import { View } from "react-native";
import { PressArea } from "./press-area";
import { Text } from "./text";

export type SectionProps = {
  /** `.sec .h4`: the group's heading. */
  title: string;
  /** `.sec .link`: one action at the end ("See all", "Hotel guide"). */
  action?: { label: string; onPress: () => void };
  /** A quiet note at the end instead of an action (`.sx-sechead span`: "6 more", "in this order"). */
  detail?: string;
  /** What the section holds. Absent, the section is only its heading and the content follows it. */
  children?: ReactNode;
  /** Layout of the children, e.g. `gap-3 px-4`. */
  className?: string;
};

/**
 * `.sec`: a heading 20 below what came before and 8 above what it heads, with an optional link or
 * note at the end. The heading is a heading to a screen reader; the link keeps a 48 press area
 * that overlaps the padding, so the row stays as tall as its words.
 */
export function Section({ title, action, detail, children, className }: SectionProps) {
  return (
    <View>
      <View className="flex-row items-center justify-between gap-3 px-4 pb-2 pt-5">
        <Text role="headline" strong accessibilityRole="header" className="shrink">
          {title}
        </Text>
        {action ? (
          <PressArea
            onPress={action.onPress}
            accessibilityRole="link"
            accessibilityLabel={action.label}
            className="-my-3 items-end justify-center"
          >
            <Text role="callout" strong tone="accent">
              {action.label}
            </Text>
          </PressArea>
        ) : detail ? (
          <Text role="caption" tone="muted">
            {detail}
          </Text>
        ) : null}
      </View>
      {children ? <View className={className}>{children}</View> : null}
    </View>
  );
}
