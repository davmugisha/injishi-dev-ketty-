import { rnSpace } from "@injishi/design-tokens";
import { Button as HeroButton } from "heroui-native";
import { useState } from "react";
import { useReduceMotion } from "@/lib/use-reduce-motion";
import { Glyph, type IconName } from "./icon";
import { metrics } from "./metrics";
import { PressedLayer, pressScaleAnimation } from "./press-area";
import { roleText } from "./text";
import { useButtonSize } from "./ui-surface";

export const buttonVariants = ["primary", "secondary", "outline", "ghost", "danger", "dangerSoft"] as const;
export type ButtonVariant = (typeof buttonVariants)[number];

const HERO_VARIANT = {
  primary: "primary",
  secondary: "secondary",
  outline: "outline",
  ghost: "ghost",
  danger: "danger",
  dangerSoft: "danger-soft",
} as const satisfies Record<ButtonVariant, string>;

/** The palette role HeroUI gives each variant's label, so an icon matches its words. */
const LABEL_ROLE = {
  primary: "accent-foreground",
  secondary: "accent-soft-foreground",
  outline: "default-foreground",
  ghost: "default-foreground",
  danger: "danger-foreground",
  dangerSoft: "danger-soft-foreground",
} as const satisfies Record<ButtonVariant, string>;

/** `md` labels are `headline`, `lg` labels `title3`, the type table's button roles. */
const SIZE = {
  md: { role: "headline", icon: 20 },
  lg: { role: "title3", icon: 24 },
} as const;

export type ButtonProps = {
  /** The label. It wraps to more lines as the font grows and is never cut off (AC-9). */
  children: string;
  onPress: () => void;
  variant?: ButtonVariant;
  /** Defaults to the surface's: `lg` (56) for staff and desk, `md` (48) elsewhere (D-o). */
  size?: "md" | "lg";
  icon?: IconName;
  isDisabled?: boolean;
  accessibilityLabel?: string;
  /** Layout only, e.g. `self-stretch`. */
  className?: string;
};

/**
 * HeroUI's button at the kit's sizes (mobile spec 0002, AC-11). HeroUI fixes its height; this
 * turns it into a minimum and pads the label, so a label that wraps makes the button taller
 * instead of spilling out. It shrinks to 0.97 when pressed; under Reduce Motion it shows the
 * `pressed` colour instead (AC-13). HeroUI's `sm` and `tertiary` are not offered.
 */
export function Button({
  children,
  onPress,
  variant = "primary",
  size,
  icon,
  isDisabled = false,
  accessibilityLabel,
  className,
}: ButtonProps) {
  const surfaceSize = useButtonSize();
  const reduceMotion = useReduceMotion();
  const [pressed, setPressed] = useState(false);
  const resolved = size ?? surfaceSize;
  const label = roleText(SIZE[resolved].role);
  return (
    <HeroButton
      variant={HERO_VARIANT[variant]}
      size={resolved}
      feedbackVariant="scale"
      animation={pressScaleAnimation}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      isDisabled={isDisabled}
      accessibilityLabel={accessibilityLabel}
      className={className}
      // The padding only shows once a label wraps; a one line button is its minimum height, the
      // outline's border included.
      style={{ height: "auto", minHeight: metrics.buttonHeight[resolved], paddingVertical: rnSpace[2] }}
      background={
        reduceMotion && pressed ? (
          <HeroButton.Background>
            <PressedLayer />
          </HeroButton.Background>
        ) : undefined
      }
    >
      {icon ? <Glyph name={icon} size={SIZE[resolved].icon} role={LABEL_ROLE[variant]} /> : null}
      <HeroButton.Label
        className={label.className}
        maxFontSizeMultiplier={label.maxFontSizeMultiplier}
        style={[label.style, { flexShrink: 1, textAlign: "center" }]}
      >
        {children}
      </HeroButton.Label>
    </HeroButton>
  );
}
