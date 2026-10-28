import Svg, { Path } from "react-native-svg";
import { useCSSVariable } from "uniwind";
import { type IconName, iconGlyphs } from "./icon-glyphs";
import type { IconSize } from "./metrics";
import { type TextTone, toneRoles } from "./text";

export type { IconName } from "./icon-glyphs";

/**
 * Draws a glyph in one palette role, read live from the theme. The kit's own parts call this with
 * the role HeroUI gives their label (a button's, a chip's); screens use `Icon` and a tone.
 */
export function Glyph({ name, size, role, label }: { name: IconName; size: number; role: string; label?: string }) {
  const color = useCSSVariable(`--color-${role}`);
  const glyph = iconGlyphs[name];
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${glyph.size} ${glyph.size}`}
      accessible={Boolean(label)}
      accessibilityLabel={label}
      accessibilityRole={label ? "image" : undefined}
      importantForAccessibility={label ? "yes" : "no-hide-descendants"}
    >
      {glyph.paths.map((p) => (
        <Path key={p.d} d={p.d} fill={String(color)} fillRule={"evenodd" in p ? "evenodd" : "nonzero"} />
      ))}
    </Svg>
  );
}

export type IconProps = {
  /** One of `icons.json`; any other name fails typecheck (AC-10). */
  name: IconName;
  size?: IconSize;
  tone?: TextTone;
  /** Read aloud when set; without it the icon is decoration and a screen reader skips it. */
  label?: string;
};

/** A Gravity UI icon at one of six sizes, in one of the eight text tones (mobile spec 0002, AC-10). */
export function Icon({ name, size = 20, tone = "default", label }: IconProps) {
  return <Glyph name={name} size={size} role={toneRoles[tone]} label={label} />;
}
