import { Image, type ImageSource } from "expo-image";
import { Avatar } from "heroui-native";
import type { ReactNode } from "react";
import { type ImageSourcePropType, View } from "react-native";
import type { ChipTone } from "./chip";
import { Glyph, Icon, type IconName } from "./icon";
import { metrics } from "./metrics";
import { PressArea } from "./press-area";
import { Text } from "./text";

/** A row's leading tile tints: the soft fill and its label colour per tone, as on chips. */
const TILE = {
  default: { root: "bg-default", role: "default-foreground" },
  accent: { root: "bg-accent-soft", role: "accent-soft-foreground" },
  success: { root: "bg-success-soft", role: "success-soft-foreground" },
  warning: { root: "bg-warning-soft", role: "warning-soft-foreground" },
  danger: { root: "bg-danger-soft", role: "danger-soft-foreground" },
  info: { root: "bg-info-soft", role: "info-soft-foreground" },
} as const satisfies Record<ChipTone, { root: string; role: string }>;

/** A 40 icon tile on a soft fill (mobile spec 0002, AC-12). */
export function RowIcon({ name, tone = "default" }: { name: IconName; tone?: ChipTone }) {
  return (
    <View
      className={`items-center justify-center rounded-lg ${TILE[tone].root}`}
      style={{ width: metrics.iconTile, height: metrics.iconTile }}
    >
      <Glyph name={name} size={20} role={TILE[tone].role} />
    </View>
  );
}

/** A 40 avatar (HeroUI's `sm`): the picture when there is one, else HeroUI's person glyph. */
export function RowAvatar({ source }: { source?: ImageSourcePropType }) {
  return (
    <Avatar alt="" size="sm" accessible={false}>
      {source ? <Avatar.Image source={source} /> : null}
      <Avatar.Fallback />
    </Avatar>
  );
}

/**
 * A 48 thumbnail. Decorative; the row names it. expo-image is not a React Native component, so
 * Uniwind would ignore its `className`: the view around it rounds and clips it.
 */
export function RowThumb({ source }: { source: ImageSource }) {
  return (
    <View
      className="overflow-hidden rounded-lg bg-surface-secondary"
      style={{ width: metrics.thumb, height: metrics.thumb }}
    >
      <Image source={source} contentFit="cover" accessible={false} style={{ width: "100%", height: "100%" }} />
    </View>
  );
}

export type RowProps = {
  /** A `RowIcon`, `RowAvatar` or `RowThumb`. */
  leading?: ReactNode;
  title: string;
  subtitle?: string;
  /** A short value or a chip, at the end. */
  trailing?: ReactNode;
  chevron?: boolean;
  onPress?: () => void;
};

/**
 * One line of a list (mobile spec 0002, AC-12): a leading item, a title, an optional subtitle, a
 * trailing slot and a chevron. At least 56 high, or its leading item with 12 above and below when
 * that is taller; text wraps instead of being cut. Given `onPress` it shows the `pressed` colour as
 * a highlight on iOS and a ripple on Android (AC-13).
 */
export function Row({ leading, title, subtitle, trailing, chevron = false, onPress }: RowProps) {
  const body = (
    <View
      className="flex-row items-center gap-3 px-4"
      style={{ minHeight: metrics.rowMin, paddingVertical: metrics.rowInset }}
    >
      {leading}
      <View className="flex-1">
        <Text role="headline">{title}</Text>
        {subtitle ? (
          <Text role="callout" tone="muted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {/* Its own box, so a trailing chip (HeroUI aligns a chip to the start) still centres. */}
      {trailing ? <View>{trailing}</View> : null}
      {chevron ? <Icon name="ChevronRight" size={20} tone="muted" /> : null}
    </View>
  );
  if (!onPress) return body;
  // No label of its own: a screen reader reads the title, the subtitle and the trailing value.
  return (
    <PressArea onPress={onPress} feedback="native" className="overflow-hidden">
      {body}
    </PressArea>
  );
}
