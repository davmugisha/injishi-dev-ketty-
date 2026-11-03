import { type ChipColor, Chip as HeroChip } from "heroui-native";
import { Text as NativeText, View } from "react-native";
import { haptic } from "@/lib/haptics";
import { Glass } from "./glass";
import { OnPhoto } from "./ground";
import { Glyph, Icon, type IconName } from "./icon";
import { PressArea } from "./press-area";
import { roleText } from "./text";
import { type Tone, tones } from "./tone";

export const chipTones = tones;
export type ChipTone = Tone;

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

/**
 * The solid fills (`.chip.solid`), HeroUI's `primary` variant with its `*-foreground` label. The
 * palette has no solid info ground, so a solid `info` chip keeps its soft fill.
 */
const SOLID = {
  default: { color: "default", role: "default-foreground" },
  accent: { color: "accent", role: "accent-foreground" },
  success: { color: "success", role: "success-foreground" },
  warning: { color: "warning", role: "warning-foreground" },
  danger: { color: "danger", role: "danger-foreground" },
} as const satisfies Record<Exclude<ChipTone, "info">, { color: ChipColor; role: string }>;

/** Chrome text: `caption strong` (the prototype's 12/650), growing to 1.5x at most (D-k); `lg` chips a strong `callout`. */
const LABEL = { ...roleText("caption", false, { strong: true }), maxFontSizeMultiplier: 1.5 };
const LABEL_LG = { ...roleText("callout", false, { strong: true }), maxFontSizeMultiplier: 1.5 };

export type ChipVariant = "soft" | "solid" | "glass";

export type ChipProps = {
  /** Always a word: a status never relies on colour alone (D-ac). */
  label: string;
  tone?: ChipTone;
  icon?: IconName;
  /**
   * `soft` (default) is the tinted `.chip`; `solid` the filled `.chip.solid`; `glass` the dark
   * frosted `.chip.dark` for a chip on a photograph (its words stay light in both themes; `tone`
   * is ignored there).
   */
  variant?: ChipVariant;
  /** `md` is the 24 `.chip`; `lg` the 30 `.chip.lg` (a header's sync state, a sheet's tag). */
  size?: "md" | "lg";
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
export function Chip({
  label,
  tone = "default",
  icon,
  variant = "soft",
  size = "md",
  selected = false,
  onPress,
}: ChipProps) {
  const text = size === "lg" ? LABEL_LG : LABEL;
  const iconSize = size === "lg" ? 16 : 12;
  const chip =
    variant === "glass" ? (
      <GlassChip label={label} icon={icon} size={size} interactive={Boolean(onPress)} />
    ) : (
      <HeroUiChip
        label={label}
        tone={tone}
        icon={icon}
        solid={variant === "solid"}
        selected={selected}
        size={size}
        interactive={Boolean(onPress)}
        text={text}
        iconSize={iconSize}
      />
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

function HeroUiChip({
  label,
  tone,
  icon,
  solid,
  selected,
  size,
  interactive,
  text,
  iconSize,
}: {
  label: string;
  tone: ChipTone;
  icon?: IconName;
  solid: boolean;
  selected: boolean;
  size: "md" | "lg";
  interactive: boolean;
  text: typeof LABEL;
  iconSize: number;
}) {
  const look: { color: ChipColor; root: string; label: string; role: string; variant: "primary" | "soft" } = selected
    ? { color: "accent", root: "", label: "", role: "accent-foreground", variant: "primary" }
    : solid && tone !== "info"
      ? { ...SOLID[tone], root: "", label: "", variant: "primary" }
      : { ...TONE[tone], variant: "soft" };
  return (
    <HeroChip
      variant={look.variant}
      color={look.color}
      size={size}
      className={look.root}
      // HeroUI's chip is a pressable; it never takes a press or focus itself. A static chip reads
      // as text, a selectable one through the press area around it.
      style={{ pointerEvents: "none" }}
      focusable={false}
      accessible={!interactive}
      accessibilityRole={interactive ? undefined : "text"}
    >
      {icon ? <Glyph name={icon} size={iconSize} role={look.role} /> : null}
      <HeroChip.Label
        className={[text.className, look.label].filter(Boolean).join(" ")}
        maxFontSizeMultiplier={text.maxFontSizeMultiplier}
        style={text.style}
      >
        {label}
      </HeroChip.Label>
    </HeroChip>
  );
}

/** `.chip.dark`: frosted dark glass with light words, for a photograph. */
function GlassChip({
  label,
  icon,
  size,
  interactive,
}: {
  label: string;
  icon?: IconName;
  size: "md" | "lg";
  interactive: boolean;
}) {
  const text = size === "lg" ? LABEL_LG : LABEL;
  return (
    <OnPhoto>
      {/* Its own row, so the chip hugs its words in a column and still centres in a row. */}
      <View className="flex-row">
        <View
          accessible={!interactive}
          accessibilityRole={interactive ? undefined : "text"}
          accessibilityLabel={label}
          className={`flex-row items-center gap-1 overflow-hidden rounded-full ${size === "lg" ? "px-3 py-1.5" : "px-2.5 py-1"}`}
        >
          <Glass tone="dark" />
          {icon ? <Icon name={icon} size={size === "lg" ? 16 : 12} /> : null}
          <NativeText
            className={`${text.className} text-foreground`}
            maxFontSizeMultiplier={text.maxFontSizeMultiplier}
            style={text.style}
          >
            {label}
          </NativeText>
        </View>
      </View>
    </OnPhoto>
  );
}
