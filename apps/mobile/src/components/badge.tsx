/**
 * Badge — compact status pill. Port of the DS Badge (tone + solid + dot).
 *
 * **HeroUI's chip (ADR-064 AC-10).** A pill with no border and weight medium
 * text: md is 20 tall, lg 28, both minimums so large text grows it rather than
 * cutting it. HeroUI clamps a chip to one line; this does not, because frame W8
 * promises nothing on Work truncates (`work-rw.test.tsx` enforces it), and the
 * ADR lets a rule our tests enforce win over HeroUI's look. A label too long
 * for its row wraps inside the pill instead. The tones keep our contrast fixes
 * rather than HeroUI's mixes:
 *
 *   - a soft status tone is its 14% tint with its PINNED text step
 *     (`success600` on `success100`), because HeroUI's mixed text measured
 *     3.10:1 to 4.2:1 in the ADR-040 pilot;
 *   - `neutral` is `textBody` on `surface3`, `brand` is `textLink` on
 *     `surface2`;
 *   - a solid tone is its fill with that fill's own `textOn` key. For `brand`
 *     that is the teal accent with `textOnBrand`, the one selection colour the
 *     ADR allows. `neutral` has no accent, so it keeps the muted fill it had,
 *     read through the role rather than the retiring `neutral600`.
 */
import { View } from 'react-native';
import { Text } from './text';
import { useTheme } from '@/theme/theme';
import { kitMetrics, type Palette } from '@/theme/tokens';

const { badge } = kitMetrics;

export type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';

export interface BadgeProps {
  tone?: Tone;
  solid?: boolean;
  dot?: boolean;
  size?: 'md' | 'lg';
  children: string;
}

const FILL: Record<Tone, keyof Palette> = {
  neutral: 'surface3',
  brand: 'surface2',
  success: 'success100',
  warning: 'warning100',
  danger: 'danger100',
};
const INK: Record<Tone, keyof Palette> = {
  neutral: 'textBody',
  brand: 'textLink',
  success: 'success600',
  warning: 'warning600',
  danger: 'danger600',
};
const SOLID: Record<Tone, keyof Palette> = {
  neutral: 'textMuted',
  brand: 'domainHospitality',
  success: 'success500',
  warning: 'warning500',
  danger: 'danger500',
};

/**
 * What is READ on each solid fill.
 *
 * This was one `'#FFFFFF'` for all five tones. White is right on exactly one of
 * them. The success fill is `oklch(73.29% …)` — a LIGHT green — and white on it
 * measures about 2:1, so a solid success badge shipped text nobody with low
 * vision could read, and nothing measured it because a hex literal is outside
 * the generated palette.
 *
 * Each entry is now HeroUI's own foreground for its own fill, derived by
 * `scripts/derive-palette.mjs`, which asserts 4.5:1 for every pair here and
 * fails the build if one drops. Measured: success 8:1, warning 8.6:1,
 * danger 4.66:1 (light). `neutral` fills with the muted role, so it takes
 * `bgApp`, the role that inverts with it (ADR-028). `brand` fills with the
 * accent, so it takes `textOnBrand`, the near-ink made for it (5.7:1).
 */
const SOLID_INK: Record<Tone, keyof Palette> = {
  neutral: 'bgApp',
  brand: 'textOnBrand',
  success: 'textOnSuccess',
  warning: 'textOnWarning',
  danger: 'textOnDanger',
};

export function Badge({ tone = 'neutral', solid = false, dot = false, size = 'md', children }: BadgeProps) {
  const { c, radius } = useTheme();
  const bg = solid ? c[SOLID[tone]] : c[FILL[tone]];
  const fg = solid ? c[SOLID_INK[tone]] : c[INK[tone]];
  const lg = size === 'lg';
  const box = badge[size];

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: badge.gap,
        alignSelf: 'flex-start',
        maxWidth: '100%',
        minHeight: box.height,
        paddingHorizontal: box.insetX,
        borderRadius: radius.pill,
        backgroundColor: bg,
      }}
    >
      {dot ? (
        <View style={{ width: badge.dot, height: badge.dot, borderRadius: radius.pill, backgroundColor: fg }} />
      ) : null}
      <Text weight="medium" size={lg ? 'sm' : 'xs'} color={fg} style={{ flexShrink: 1 }}>
        {children}
      </Text>
    </View>
  );
}
