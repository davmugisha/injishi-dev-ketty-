import type { Ground } from "./ground";

/**
 * The six tones every kit part speaks (`ChipTone`), as the grounds and inks they paint. Each entry
 * pairs a ground with the label the palette measured on it (D-c), so a part never pairs them by
 * hand. Defined here once; `chip.tsx` re-exports the tone names.
 */
export const tones = ["default", "accent", "success", "warning", "danger", "info"] as const;
export type Tone = (typeof tones)[number];

/** A tone's soft fill: `.chip.ok`, `.tile-ic.warn`, `.card.tint-bad`, `.banner.info`. */
export const softTone = {
  default: { root: "bg-default", label: "text-default-foreground", role: "default-foreground" },
  accent: { root: "bg-accent-soft", label: "text-accent-soft-foreground", role: "accent-soft-foreground" },
  success: { root: "bg-success-soft", label: "text-success-soft-foreground", role: "success-soft-foreground" },
  warning: { root: "bg-warning-soft", label: "text-warning-soft-foreground", role: "warning-soft-foreground" },
  danger: { root: "bg-danger-soft", label: "text-danger-soft-foreground", role: "danger-soft-foreground" },
  info: { root: "bg-info-soft", label: "text-info-soft-foreground", role: "info-soft-foreground" },
} as const satisfies Record<Tone, { root: string; label: string; role: string }>;

/**
 * A tone's solid fill: `.chip.solid`, `.count`, `.tl .st.done .d`. The palette has no solid info
 * ground, so `info` keeps its soft fill.
 */
export const solidTone = {
  default: { root: "bg-default", label: "text-default-foreground", role: "default-foreground" },
  accent: { root: "bg-accent", label: "text-accent-foreground", role: "accent-foreground" },
  success: { root: "bg-success", label: "text-success-foreground", role: "success-foreground" },
  warning: { root: "bg-warning", label: "text-warning-foreground", role: "warning-foreground" },
  danger: { root: "bg-danger", label: "text-danger-foreground", role: "danger-foreground" },
  info: { root: "bg-info-soft", label: "text-info-soft-foreground", role: "info-soft-foreground" },
} as const satisfies Record<Tone, { root: string; label: string; role: string }>;

/** The colour a tone draws as a mark on a neutral surface (a bar's fill, a ring's stroke). */
export const markRole = {
  default: "muted",
  accent: "accent",
  success: "success",
  warning: "warning",
  danger: "danger",
  info: "info",
} as const satisfies Record<Tone, string>;

/** The kit `Text`/`Icon` tone that names a tone's colour on a neutral surface. */
export const textToneOf = {
  default: "default",
  accent: "accent",
  success: "success",
  warning: "warning",
  danger: "danger",
  info: "info",
} as const satisfies Record<Tone, string>;

/** The ground a soft fill sets for the words inside it. `default` is neutral: the page's ink. */
export function softGround(tone: Tone): Ground | null {
  if (tone === "default") return null;
  return { text: softTone[tone].label, role: softTone[tone].role, solid: false };
}

/** The ground a solid fill sets for the words inside it. */
export function solidGround(tone: Tone): Ground | null {
  if (tone === "default") return null;
  if (tone === "info") return softGround("info");
  return { text: solidTone[tone].label, role: solidTone[tone].role, solid: true };
}
