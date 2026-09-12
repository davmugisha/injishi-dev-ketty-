/**
 * Text — the single typographic primitive. RN has no font cascade, so every
 * text node resolves an explicit family/weight from the brand fonts. Defaults
 * to Figtree (body) in `textBody`, matching the web base styles.
 *
 * SIZE IS A TOKEN NAME, NOT A NUMBER. This is the change `parity.md` §5.1 calls
 * the highest-leverage one in the mobile guide, and the reason is not tidiness:
 *
 *   - `size?: number` defaulting to **15** meant every `<Text>` written without
 *     an explicit size rendered at a value that is not a step on the app's own
 *     scale. The scale was in `tokens.ts` the whole time; nothing read it.
 *   - **758 call sites** typed a number. Fourteen distinct values between 10
 *     and 32, so two cards side by side disagreed by a pixel with no single
 *     line to blame.
 *   - `lineHeight` was optional, so almost all of that text shipped without
 *     one — *"a hand-typed size also ships no line height, so two of them at
 *     the same pixel value still disagree"* (ui-rules.md).
 *
 * A token name fixes all three at once, because a step is a PAIR: `size="sm"`
 * brings `fontSize.sm` and `lineHeight.sm` together and they cannot be
 * separated at a call site. It is also what lets a lint rule reach this app at
 * all — `injishi/no-arbitrary-type-scale` can refuse `size={13}` because there
 * is now a name to refuse it in favour of.
 *
 * THE ESCAPE, AND WHY IT IS A DIFFERENT PROP. A handful of sizes are genuinely
 * DERIVED from another measurement rather than chosen from a scale: the initials
 * in an `Avatar` are 38% of the avatar's diameter, and the currency prefix in a
 * `MoneyAmount` is 82% of the amount beside it. Those are correct code and a
 * scale has no name for them. They take `sizePx`.
 *
 * Making that a separate prop rather than widening `size` back to
 * `TextSize | number` is the whole point. A number accepted by `size` is
 * invisible and uncountable — which is how 758 of them accumulated. A named
 * escape is greppable, and the count of files using it is a number a reviewer
 * can watch. Seven components use it today. If that becomes twenty, the scale
 * is missing a step and this comment is the place to say so.
 */
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { useTheme } from '@/theme/theme';
import { fontSize, lineHeight as lineHeightScale, type Palette, type TextSize } from '@/theme/tokens';

type Family = 'body' | 'display' | 'mono';
type Weight = 'regular' | 'medium' | 'semibold' | 'bold';

const FAMILY: Record<Family, Partial<Record<Weight, string>>> = {
  body: {
    regular: 'Figtree_400Regular',
    medium: 'Figtree_500Medium',
    semibold: 'Figtree_600SemiBold',
    bold: 'Figtree_700Bold',
  },
  display: {
    medium: 'Spectral_500Medium',
    semibold: 'Spectral_600SemiBold',
    bold: 'Spectral_600SemiBold',
  },
  // numerics / IDs / codes render in Figtree too — no mono family
  mono: {
    regular: 'Figtree_400Regular',
    medium: 'Figtree_500Medium',
    semibold: 'Figtree_600SemiBold',
  },
};

export interface TextProps extends RNTextProps {
  family?: Family;
  weight?: Weight;
  /**
   * A step on the type scale, by name. Brings its own line height.
   *
   * Defaults to `md` (16). The old default was 15, which was not a step —
   * every unsized `<Text>` in the app grows by one pixel and gains a leading,
   * which is the correction, not a side effect.
   */
  size?: TextSize;
  /**
   * A size DERIVED from another measurement, in device pixels. Not a choice —
   * an escape for text whose size is a function of something beside it.
   *
   * Wins over `size` when both are given. Pair it with `lineHeightPx`: a
   * derived size has no step and therefore no leading of its own, and text
   * without a leading is the failure this component exists to prevent.
   */
  sizePx?: number;
  /** The leading for a `sizePx`. Ignored when `size` names a step. */
  lineHeightPx?: number;
  /** Palette color key (e.g. 'textMuted') or a literal color string. */
  color?: keyof Palette | (string & {});
  center?: boolean;
}

export function Text({
  family = 'body',
  weight = 'regular',
  size = 'md',
  sizePx,
  lineHeightPx,
  color = 'textBody',
  center,
  style,
  ...rest
}: TextProps) {
  const { c } = useTheme();
  const resolved = FAMILY[family][weight] ?? FAMILY[family].regular ?? 'Figtree_400Regular';
  const resolvedColor = (color in c ? c[color as keyof Palette] : color) as string;

  // A derived size carries the leading it was given; a step carries its own.
  // There is no third case, which is why nothing here can ship without one.
  const px = sizePx ?? fontSize[size];
  const leading = sizePx !== undefined ? lineHeightPx : lineHeightScale[size];

  return (
    <RNText
      style={[
        {
          fontFamily: resolved,
          fontSize: px,
          color: resolvedColor,
          ...(leading ? { lineHeight: leading } : null),
          ...(center ? { textAlign: 'center' as const } : null),
        },
        style,
      ]}
      {...rest}
    />
  );
}
