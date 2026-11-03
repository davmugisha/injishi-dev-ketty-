import { View } from "react-native";
import { CountBadge } from "./badge";
import { Glass } from "./glass";
import { OnPhoto } from "./ground";
import { Icon, type IconName } from "./icon";
import { metrics } from "./metrics";
import { PressArea } from "./press-area";
import type { TextTone } from "./text";

/**
 * The circle's look. `default` is the kit's original `bg-default` disc. The prototype's
 * `.iconbtn` is `surface` (the surface with a hairline), `.iconbtn.plain` is `plain` (no disc, a
 * nav bar's close or back) and `.iconbtn.glass` is `glass`, frosted glass with a light glyph over
 * a photograph.
 */
export type IconButtonVariant = "default" | "surface" | "plain" | "glass";

const CIRCLE = {
  default: "bg-default",
  surface: "border border-separator bg-surface",
  plain: "",
  glass: "",
} as const satisfies Record<IconButtonVariant, string>;

export type IconButtonProps = {
  icon: IconName;
  /** What the button does, read aloud; there are no words on screen. */
  label: string;
  tone?: TextTone;
  onPress: () => void;
  isDisabled?: boolean;
  variant?: IconButtonVariant;
  /** `.dot`: something new behind this button. Read aloud as part of the label. */
  dot?: boolean;
  /** `.count`: how many things are new. Read aloud as part of the label. */
  count?: number;
};

/**
 * An icon alone as a button (mobile spec 0002, AC-11): a 40 circle inside a 48 box that takes the
 * press, so the target is never smaller than the floor. A dot or a count sits on the circle's
 * shoulder; a screen reader hears it with the label ("Notifications, new" / "Inbox, 3 new").
 */
export function IconButton({
  icon,
  label,
  tone,
  onPress,
  isDisabled,
  variant = "default",
  dot = false,
  count,
}: IconButtonProps) {
  const news = count ? `, ${count} new` : dot ? ", new" : "";
  const circle = (
    <View
      className={`items-center justify-center overflow-hidden rounded-full ${CIRCLE[variant]}`}
      style={{ width: metrics.iconButton, height: metrics.iconButton }}
    >
      {variant === "glass" ? <Glass tone="light" /> : null}
      <Icon name={icon} size={20} tone={tone} />
    </View>
  );
  const button = (
    <PressArea
      onPress={onPress}
      accessibilityLabel={`${label}${news}`}
      isDisabled={isDisabled}
      className="items-center justify-center"
    >
      {circle}
      {count ? (
        <View className="absolute right-0 top-0.5" style={{ pointerEvents: "none" }}>
          <CountBadge count={count} />
        </View>
      ) : dot ? (
        <View
          className="absolute right-3 top-2.5 rounded-full border-2 border-surface bg-danger"
          style={{ width: metrics.badgeDot, height: metrics.badgeDot, pointerEvents: "none" }}
        />
      ) : null}
    </PressArea>
  );
  return variant === "glass" ? <OnPhoto>{button}</OnPhoto> : button;
}
