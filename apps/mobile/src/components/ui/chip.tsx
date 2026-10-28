import { type ChipColor, Chip as HeroChip } from "heroui-native";
import { haptic } from "@/lib/haptics";
import { Glyph, type IconName } from "./icon";
import { PressArea } from "./press-area";
import { roleText } from "./text";

export const chipTones = ["default", "accent", "success", "warning", "danger", "info"] as const;
export type ChipTone = (typeof chipTones)[number];

/**
 * Each tone's soft fill and label (mobile spec 0002, D-l). HeroUI draws the four it has; `default`
 * and `info` take their classes from here, `info` from the package's own soft set.
 */
const TONE = {
  default: { color: "default", root: "bg-default", label: "text-default-foreground", role: "default-foreground" },
  accent: { color: "accent", root: "", label: "", role: "accent-soft-foreground" },
  success: { color: "success", root: "", label: "", role: "success-soft-foreground" },
  warning: { color: "warning", root: "", label: "", role: "warning-soft-foreground" },
  danger: { color: "danger", root: "", label: "", role: "danger-soft-foreground" },
  info: { color: "default", root: "bg-info-soft", label: "text-info-soft-foreground", role: "info-soft-foreground" },
} as const satisfies Record<ChipTone, { color: ChipColor; root: string; label: string; role: string }>;

/** Chrome text: the `caption` role, growing to 1.5x at most (D-k). */
const LABEL = { ...roleText("caption"), maxFontSizeMultiplier: 1.5 };

export type ChipProps = {
  /** Always a word: a status never relies on colour alone (D-ac). */
  label: string;
  tone?: ChipTone;
  icon?: IconName;
  /** A selected chip is a solid accent fill. */
  selected?: boolean;
  /** Makes the chip selectable: it ticks (D-r) and takes a 48 high press area. */
  onPress?: () => void;
};

/**
 * A short label on a soft fill, in six tones (mobile spec 0002, AC-12). Given `onPress` it becomes
 * a choice: a 48 high press area around the chip, a selection tick, and its state for screen
 * readers. Side by side, each chip's press area stays its own.
 */
export function Chip({ label, tone = "default", icon, selected = false, onPress }: ChipProps) {
  const look: { color: ChipColor; root: string; label: string; role: string; variant: "primary" | "soft" } = selected
    ? { color: "accent", root: "", label: "", role: "accent-foreground", variant: "primary" }
    : { ...TONE[tone], variant: "soft" };
  const chip = (
    <HeroChip
      variant={look.variant}
      color={look.color}
      size="md"
      className={look.root}
      // HeroUI's chip is a pressable; it never takes a press or focus itself. A static chip reads
      // as text, a selectable one through the press area around it.
      style={{ pointerEvents: "none" }}
      focusable={false}
      accessible={!onPress}
      accessibilityRole={onPress ? undefined : "text"}
    >
      {icon ? <Glyph name={icon} size={16} role={look.role} /> : null}
      <HeroChip.Label
        className={[LABEL.className, look.label].filter(Boolean).join(" ")}
        maxFontSizeMultiplier={LABEL.maxFontSizeMultiplier}
        style={LABEL.style}
      >
        {label}
      </HeroChip.Label>
    </HeroChip>
  );
  if (!onPress) return chip;
  return (
    <PressArea
      onPress={() => {
        haptic.selection();
        onPress();
      }}
      accessibilityLabel={label}
      accessibilityRole="togglebutton"
      accessibilityState={{ selected }}
      className="justify-center"
    >
      {chip}
    </PressArea>
  );
}
