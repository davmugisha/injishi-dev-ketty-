import { rnSpace } from "@injishi/design-tokens";
import { Button as HeroButton } from "heroui-native";
import { type ReactNode, useState } from "react";
import { Text as NativeText, View } from "react-native";
import { useReduceMotion } from "@/lib/use-reduce-motion";
import { FixedLight } from "./ground";
import { Glyph, type IconName } from "./icon";
import { metrics } from "./metrics";
import { PressArea, PressedLayer, pressScaleAnimation } from "./press-area";
import { roleText } from "./text";
import { useButtonSize } from "./ui-surface";

export const buttonVariants = [
  "primary",
  "secondary",
  "outline",
  "ghost",
  "danger",
  "dangerSoft",
  "deep",
  "onPhoto",
] as const;
export type ButtonVariant = (typeof buttonVariants)[number];

/**
 * HeroUI's variant for each kit variant. `deep` is the prototype's `.btn.deep`, the dark accent
 * fill of a staff action; the palette's accent already is that deep teal (PLAN.md: `--accent-deep`
 * fills are `accent`), so it draws as `primary` today and keeps its own name so a re-tune can part
 * them. `onPhoto` is `.btn.white`: a white pill with dark words on a photograph, drawn in the
 * light theme's `segment` pair so it stays white in both themes.
 */
const HERO_VARIANT = {
  primary: "primary",
  secondary: "secondary",
  outline: "outline",
  ghost: "ghost",
  danger: "danger",
  dangerSoft: "danger-soft",
  deep: "primary",
  onPhoto: "ghost",
} as const satisfies Record<ButtonVariant, string>;

/** The palette role HeroUI gives each variant's label, so an icon matches its words. */
const LABEL_ROLE = {
  primary: "accent-foreground",
  secondary: "accent-soft-foreground",
  outline: "default-foreground",
  ghost: "default-foreground",
  danger: "danger-foreground",
  dangerSoft: "danger-soft-foreground",
  deep: "accent-foreground",
  onPhoto: "segment-foreground",
} as const satisfies Record<ButtonVariant, string>;

/**
 * The `sm` pill (`.btn.sm`) is drawn by the kit, not HeroUI: HeroUI's button is its own press
 * target, and a 36 high target is under the floor, so `sm` is a 36 pill inside a 48 `PressArea`.
 * Each ground with its measured label; `secondary`'s label is the accent text role, the same ink
 * HeroUI mixes for the `md` secondary.
 */
const SMALL = {
  primary: { root: "bg-accent", label: "text-accent-foreground" },
  secondary: { root: "bg-default", label: "text-accent-text" },
  outline: { root: "border border-border", label: "text-default-foreground" },
  ghost: { root: "", label: "text-default-foreground" },
  danger: { root: "bg-danger", label: "text-danger-foreground" },
  dangerSoft: { root: "bg-danger-soft", label: "text-danger-soft-foreground" },
  deep: { root: "bg-accent", label: "text-accent-foreground" },
  onPhoto: { root: "bg-segment", label: "text-segment-foreground" },
} as const satisfies Record<ButtonVariant, { root: string; label: string }>;

/** `md` labels are `headline`, `lg` labels `title3`, `sm` labels a strong `callout`: the type table's button roles. */
const SIZE = {
  sm: { role: "callout", icon: 16 },
  md: { role: "headline", icon: 20 },
  lg: { role: "title3", icon: 24 },
} as const;

export type ButtonProps = {
  /** The label. It wraps to more lines as the font grows and is never cut off (AC-9). */
  children: string;
  onPress: () => void;
  variant?: ButtonVariant;
  /**
   * Defaults to the surface's: `lg` (56) for staff and desk, `md` (48) elsewhere (D-o). `sm` is the
   * prototype's 36 pill (`.btn.sm`) for an inline action in a card or a row; its press area is
   * still 48 high.
   */
  size?: "sm" | "md" | "lg";
  icon?: IconName;
  isDisabled?: boolean;
  accessibilityLabel?: string;
  /** Layout only, e.g. `self-stretch`, `flex-1`. */
  className?: string;
};

/**
 * HeroUI's button at the kit's sizes (mobile spec 0002, AC-11). HeroUI fixes its height; this
 * turns it into a minimum and pads the label, so a label that wraps makes the button taller
 * instead of spilling out. It shrinks to 0.97 when pressed; under Reduce Motion it shows the
 * `pressed` colour instead (AC-13). HeroUI's `sm` and `tertiary` are not offered.
 */
export function Button(props: ButtonProps) {
  const surfaceSize = useButtonSize();
  const resolved = props.size ?? surfaceSize;
  const variant = props.variant ?? "primary";
  const button =
    resolved === "sm" ? (
      <SmallButton {...props} variant={variant} />
    ) : (
      <HeroSized {...props} variant={variant} size={resolved} />
    );
  return variant === "onPhoto" ? <FixedLight>{button}</FixedLight> : button;
}

function HeroSized({
  children,
  onPress,
  variant,
  size,
  icon,
  isDisabled = false,
  accessibilityLabel,
  className,
}: ButtonProps & { variant: ButtonVariant; size: "md" | "lg" }) {
  const reduceMotion = useReduceMotion();
  const [pressed, setPressed] = useState(false);
  const label = roleText(SIZE[size].role);
  return (
    <HeroButton
      variant={HERO_VARIANT[variant]}
      size={size}
      feedbackVariant="scale"
      animation={pressScaleAnimation}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      isDisabled={isDisabled}
      accessibilityLabel={accessibilityLabel}
      className={[variant === "onPhoto" ? SMALL.onPhoto.root : "", className].filter(Boolean).join(" ")}
      // The padding only shows once a label wraps; a one line button is its minimum height, the
      // outline's border included.
      style={{ height: "auto", minHeight: metrics.buttonHeight[size], paddingVertical: rnSpace[2] }}
      background={
        reduceMotion && pressed ? (
          <HeroButton.Background>
            <PressedLayer />
          </HeroButton.Background>
        ) : undefined
      }
    >
      {icon ? <Glyph name={icon} size={SIZE[size].icon} role={LABEL_ROLE[variant]} /> : null}
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

function SmallButton({
  children,
  onPress,
  variant,
  icon,
  isDisabled = false,
  accessibilityLabel,
  className,
}: ButtonProps & { variant: ButtonVariant }) {
  const label = roleText(SIZE.sm.role, false, { strong: true });
  const look = SMALL[variant];
  return (
    <PressArea
      onPress={onPress}
      isDisabled={isDisabled}
      accessibilityLabel={accessibilityLabel ?? children}
      className={["items-center justify-center", className].filter(Boolean).join(" ")}
    >
      <SmallPill root={look.root} disabled={isDisabled}>
        {icon ? <Glyph name={icon} size={SIZE.sm.icon} role={LABEL_ROLE[variant]} /> : null}
        <NativeText
          className={`${label.className} ${look.label}`}
          maxFontSizeMultiplier={label.maxFontSizeMultiplier}
          style={[label.style, { flexShrink: 1, textAlign: "center" }]}
        >
          {children}
        </NativeText>
      </SmallPill>
    </PressArea>
  );
}

/** The 36 pill itself; it grows with its label, as the large sizes do. */
function SmallPill({ root, disabled, children }: { root: string; disabled: boolean; children: ReactNode }) {
  return (
    <View
      className={`flex-row items-center justify-center gap-1.5 overflow-hidden rounded-full px-3.5 ${root}`}
      style={{ minHeight: metrics.buttonHeight.sm, opacity: disabled ? DISABLED : 1 }}
    >
      {children}
    </View>
  );
}

/** HeroUI's disabled opacity, for the pill the kit draws itself. */
const DISABLED = 0.5;
