import type { ReactNode } from "react";
import { View } from "react-native";
import { type Ground, OnGround } from "./ground";
import { PressArea } from "./press-area";
import { softGround, solidGround } from "./tone";

export const cardTones = ["default", "flat", "accent", "accentSoft", "success", "warning", "danger", "info"] as const;
/**
 * `default` is `.card` (the surface with a hairline), `flat` `.card.flat` (the second surface, no
 * line), `accent` `.card.accent` (the accent fill with light words), and the rest the tints
 * `.card.tint-acc`, `tint-ok`, `tint-warn`, `tint-bad`, `tint-info`.
 */
export type CardTone = (typeof cardTones)[number];

const LOOK = {
  default: { root: "border border-separator bg-surface", ground: null },
  flat: { root: "bg-surface-secondary", ground: null },
  accent: { root: "bg-accent", ground: solidGround("accent") },
  accentSoft: { root: "bg-accent-soft", ground: softGround("accent") },
  success: { root: "bg-success-soft", ground: softGround("success") },
  warning: { root: "bg-warning-soft", ground: softGround("warning") },
  danger: { root: "bg-danger-soft", ground: softGround("danger") },
  info: { root: "bg-info-soft", ground: softGround("info") },
} as const satisfies Record<CardTone, { root: string; ground: Ground | null }>;

/** `.card.p12` (`sm`), `.card.p` (`md`), `.card.p20` (`lg`), or no padding (a card holding a list). */
const PADDING = { none: "", sm: "px-3.5 py-3", md: "p-4", lg: "p-5" } as const;

export type CardProps = {
  children: ReactNode;
  tone?: CardTone;
  padding?: keyof typeof PADDING;
  /** `.card.raise`: lifted off the page by the overlay shadow (light theme only, as HeroUI's). */
  raised?: boolean;
  /** Makes the whole card a button: it shrinks when pressed and reads its label. */
  onPress?: () => void;
  /** What pressing the card does, read aloud. Without it a screen reader reads the card's words. */
  accessibilityLabel?: string;
  /** Layout only: `mx-4`, `mt-3`, `flex-1`, `gap-3`. */
  className?: string;
};

/**
 * `.card`: a 24 cornered surface in eight tones. Words and icons inside that keep the default tone
 * take the card's ground: the accent card's light words, a tint's measured label. Put a `ListGroup`
 * or `KeyValue` inside with `padding="none"` or the default.
 */
export function Card({
  children,
  tone = "default",
  padding = "md",
  raised = false,
  onPress,
  accessibilityLabel,
  className,
}: CardProps) {
  const look = LOOK[tone];
  // The shadow sits on an outer box: a box that clips its corners would clip its own shadow on iOS.
  const outer = ["rounded-3xl", raised ? "shadow-overlay" : "", className].filter(Boolean).join(" ");
  const inner = (
    <View className={["grow overflow-hidden rounded-3xl", look.root, PADDING[padding]].filter(Boolean).join(" ")}>
      {children}
    </View>
  );
  return (
    <OnGround ground={look.ground}>
      {onPress ? (
        <PressArea onPress={onPress} accessibilityLabel={accessibilityLabel} className={outer}>
          {inner}
        </PressArea>
      ) : (
        <View className={outer}>{inner}</View>
      )}
    </OnGround>
  );
}
