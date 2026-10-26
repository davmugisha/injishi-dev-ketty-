/** Semantic tones used in fixtures, mapped onto HeroUI color props. */
export type Tone = "accent" | "success" | "warning" | "danger" | "default" | "info";

export type HeroColor = "default" | "accent" | "success" | "warning" | "danger";

/** HeroUI has no "info" color; the artifact's info chips render as accent. */
export function toneColor(tone: Tone | null | undefined): HeroColor {
  if (!tone) return "default";
  return tone === "info" ? "accent" : tone;
}

/** Timeline marker status for a tone. */
export function toneStatus(
  tone: Tone | "current" | "muted" | null | undefined,
): "default" | "current" | "success" | "warning" | "danger" | "muted" {
  if (!tone) return "default";
  if (tone === "accent" || tone === "info") return "current";
  return tone;
}

/** Tailwind text class for a tone (status dots, inline icons). */
export function toneText(tone: Tone | null | undefined): string {
  switch (tone) {
    case "success":
      return "text-success";
    case "warning":
      return "text-warning";
    case "danger":
      return "text-danger";
    case "accent":
    case "info":
      return "text-accent";
    default:
      return "text-muted";
  }
}

/** Tailwind background class for a tone (status dots). */
export function toneBg(tone: Tone | null | undefined): string {
  switch (tone) {
    case "success":
      return "bg-success";
    case "warning":
      return "bg-warning";
    case "danger":
      return "bg-danger";
    case "accent":
    case "info":
      return "bg-accent";
    default:
      return "bg-muted";
  }
}
