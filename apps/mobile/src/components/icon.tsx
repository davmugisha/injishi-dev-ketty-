import { useThemeColor } from "heroui-native";
import Svg, { Path } from "react-native-svg";
import { type IconName, iconGlyphs } from "./ui/icon-glyphs";

/**
 * The old screens' icon, kept as a shim over the UI kit's generated glyphs (mobile spec 0002, D-n,
 * D-y). Same props as before: any string name (an unknown one draws nothing), a HeroUI colour name
 * as the tone, or an explicit colour. New code uses `Icon` from `@/components/ui`, whose names are
 * typed. This file goes when the last old screen is rebuilt on the kit.
 */

// The array overload is listed last, so its element type is the theme colour name union.
type ThemeColor = Parameters<typeof useThemeColor>[0][number];

const isIconName = (name: string): name is IconName => Object.hasOwn(iconGlyphs, name);

export function Icon({
  name,
  size = 16,
  tone = "foreground",
  color,
  accessibilityLabel,
}: {
  name: string;
  size?: number;
  tone?: ThemeColor;
  color?: string;
  accessibilityLabel?: string;
}) {
  const themed = useThemeColor(tone);
  if (!isIconName(name)) return null;
  const glyph = iconGlyphs[name];
  const fill = color ?? themed;
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${glyph.size} ${glyph.size}`}
      fill="none"
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
    >
      {glyph.paths.map((p) => (
        <Path key={p.d} d={p.d} fill={fill} fillRule={"evenodd" in p ? "evenodd" : undefined} />
      ))}
    </Svg>
  );
}
