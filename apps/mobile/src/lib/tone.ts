/** Semantic tones used in fixtures, mapped onto HeroUI Native color props (same mapping as @injishi/ui on the web). */
export type Tone = "accent" | "success" | "warning" | "danger" | "default" | "info";

export function toneColor(tone: Tone | null | undefined): "default" | "accent" | "success" | "warning" | "danger" {
  if (!tone) return "default";
  return tone === "info" ? "accent" : tone;
}
