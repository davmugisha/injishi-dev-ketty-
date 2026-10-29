import { type RnTextSize, rnFontSize, rnLineHeight } from "@injishi/design-tokens";
import { Text as NativeText, type TextProps as NativeTextProps } from "react-native";

/**
 * The type table (mobile spec 0002, D-i to D-k): nine roles at the tokens package's
 * React Native sizes and leadings, in Figtree 400, 500, 600 or 700. Weight is always the
 * Figtree family (the `font-*` classes `global.css` maps to the registered faces), never
 * `fontWeight`. Every role grows with the phone's font size, up to `maxScale`.
 */
export const textRoles = {
  display: { step: "3xl", weight: "bold", tracking: -0.72, maxScale: 2 },
  title1: { step: "2xl", weight: "bold", tracking: -0.56, maxScale: 2 },
  title2: { step: "xl", weight: "bold", tracking: -0.44, maxScale: 2 },
  title3: { step: "lg", weight: "semibold", tracking: 0, maxScale: 2 },
  headline: { step: "md", weight: "semibold", tracking: 0, maxScale: 2 },
  body: { step: "md", weight: "normal", tracking: 0, maxScale: 2 },
  callout: { step: "sm", weight: "normal", tracking: 0, maxScale: 2 },
  caption: { step: "xs", weight: "medium", tracking: 0, maxScale: 2 },
  micro: { step: "2xs", weight: "semibold", tracking: 0, maxScale: 1.5 },
} as const satisfies Record<
  string,
  { step: RnTextSize; weight: "normal" | "medium" | "semibold" | "bold"; tracking: number; maxScale: number }
>;

export type TextRole = keyof typeof textRoles;

/**
 * The eight tones (D-l), each a palette role from `@injishi/design-tokens/native.css`.
 * A status tone is that colour's TEXT role, which clears 4.5:1 on every ground.
 */
export const textTones = {
  default: "text-foreground",
  muted: "text-muted",
  accent: "text-accent-text",
  success: "text-success-text",
  warning: "text-warning-text",
  danger: "text-danger-text",
  info: "text-info",
  onAccent: "text-accent-foreground",
} as const;

export type TextTone = keyof typeof textTones;

const weightClass = {
  normal: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold",
  bold: "font-bold",
} as const;

/** Capitals open up by 8% of the size: the `micro` eyebrow's +0.88 at 11. */
const CAPS_TRACKING = 0.08;

/** Titles are headings to a screen reader; the other roles are plain text. */
const HEADER_ROLES: ReadonlySet<TextRole> = new Set(["title1", "title2", "title3"]);

// React Native's own `role` (the ARIA role) gives way to the type role; `accessibilityRole`
// still sets the ARIA one.
export type TextProps = Omit<NativeTextProps, "maxFontSizeMultiplier" | "role"> & {
  role: TextRole;
  tone?: TextTone;
  /** Upper case, with the tracking capitals need. */
  caps?: boolean;
  /** Lower the role's growth cap, e.g. 1.5 for chrome such as a chip label (D-k). */
  maxScale?: number;
  className?: string;
};

export function Text({ role, tone = "default", caps = false, maxScale, className, style, ...rest }: TextProps) {
  const spec = textRoles[role];
  const fontSize = rnFontSize[spec.step];
  return (
    <NativeText
      accessibilityRole={HEADER_ROLES.has(role) ? "header" : undefined}
      {...rest}
      maxFontSizeMultiplier={maxScale ?? spec.maxScale}
      className={[weightClass[spec.weight], textTones[tone], className].filter(Boolean).join(" ")}
      style={[
        {
          fontSize,
          lineHeight: rnLineHeight[spec.step],
          letterSpacing: spec.tracking + (caps ? fontSize * CAPS_TRACKING : 0),
          textTransform: caps ? "uppercase" : undefined,
        },
        style,
      ]}
    />
  );
}
