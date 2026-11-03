import { View } from "react-native";
import { type Ground, Inverse, OnGround } from "./ground";
import { Icon, type IconName } from "./icon";
import { PressArea } from "./press-area";
import { Text } from "./text";
import { softGround } from "./tone";

export const bannerTones = ["default", "accent", "info", "success", "warning", "danger"] as const;
/** `default` is `.banner.gray` (the second surface); the rest the tints `.banner.info`, `.ok`, `.warn`, `.bad`. */
export type BannerTone = (typeof bannerTones)[number];

const LOOK = {
  default: { root: "bg-surface-secondary", icon: "CircleInfo", ground: null },
  accent: { root: "bg-accent-soft", icon: "CircleInfo", ground: softGround("accent") },
  info: { root: "bg-info-soft", icon: "CircleInfo", ground: softGround("info") },
  success: { root: "bg-success-soft", icon: "CircleCheck", ground: softGround("success") },
  warning: { root: "bg-warning-soft", icon: "TriangleExclamation", ground: softGround("warning") },
  danger: { root: "bg-danger-soft", icon: "CircleExclamation", ground: softGround("danger") },
} as const satisfies Record<BannerTone, { root: string; icon: IconName; ground: Ground | null }>;

export type BannerProps = {
  tone?: BannerTone;
  /** Replaces the tone's own icon (a droplet for a water notice). */
  icon?: IconName;
  /** `.banner b`: the bold first line. */
  title?: string;
  /** What it says. */
  body?: string;
  /** Makes the whole banner a button, with a chevron (a notice that opens its detail). */
  onPress?: () => void;
  /** Layout only, e.g. `mx-4 mt-3`. */
  className?: string;
};

/**
 * `.banner`: a notice on a tint, with the tone's icon, an optional bold title and a body. Its words
 * draw in the tint's measured label; a screen reader hears it as one passage. `TestMoneyBanner` is
 * the payment screens' own.
 */
export function Banner({ tone = "default", icon, title, body, onPress, className }: BannerProps) {
  const look = LOOK[tone];
  const content = (
    <OnGround ground={look.ground}>
      <View
        accessible={!onPress}
        className={["flex-row items-start gap-3 rounded-2xl px-3.5 py-3", look.root, className]
          .filter(Boolean)
          .join(" ")}
      >
        <View className="pt-0.5">
          <Icon name={icon ?? look.icon} size={20} tone={tone === "default" ? "muted" : undefined} />
        </View>
        <View className="flex-1 gap-0.5">
          {title ? (
            <Text role="callout" strong>
              {title}
            </Text>
          ) : null}
          {body ? <Text role="callout">{body}</Text> : null}
        </View>
        {onPress ? (
          <View className="self-center">
            <Icon name="ChevronRight" size={16} />
          </View>
        ) : null}
      </View>
    </OnGround>
  );
  if (!onPress) return content;
  return (
    <PressArea onPress={onPress} accessibilityLabel={[title, body].filter(Boolean).join(". ")}>
      {content}
    </PressArea>
  );
}

export type OfflineBarProps = {
  /** What still works ("No signal. Keep working, ticks are saved on this phone."). */
  message: string;
  icon?: IconName;
  /** Layout only. Default `mx-4`. */
  className?: string;
};

/**
 * `.offline`: the dark strip that says the phone is offline and what still works, on the inverted
 * ground (the other theme's surface and ink). Announced politely when it appears.
 */
export function OfflineBar({ message, icon = "CloudSlash", className = "mx-4" }: OfflineBarProps) {
  return (
    <Inverse>
      <View
        accessible
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        className={["flex-row items-center gap-2.5 rounded-xl bg-surface px-3 py-2.5", className]
          .filter(Boolean)
          .join(" ")}
      >
        <Icon name={icon} size={16} />
        <Text role="caption" strong className="flex-1">
          {message}
        </Text>
      </View>
    </Inverse>
  );
}
