/**
 * Badge — compact status pill. Port of the DS Badge (tone + solid + dot).
 */
import { View } from 'react-native';
import { Text } from './text';
import { useTheme } from '@/theme/theme';
import type { Palette } from '@/theme/tokens';

export type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';

export interface BadgeProps {
  tone?: Tone;
  solid?: boolean;
  dot?: boolean;
  size?: 'md' | 'lg';
  children: string;
}

const FILL: Record<Tone, keyof Palette> = {
  neutral: 'neutral100',
  brand: 'brand100',
  success: 'success100',
  warning: 'warning100',
  danger: 'danger100',
};
const INK: Record<Tone, keyof Palette> = {
  neutral: 'neutral600',
  brand: 'brand700',
  success: 'success600',
  warning: 'warning600',
  danger: 'danger600',
};
const SOLID: Record<Tone, keyof Palette> = {
  neutral: 'neutral600',
  brand: 'brand700',
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
 * danger 4.66:1 (light). `neutral` and `brand` fill with a near-ink role, so
 * they take `bgApp`, the role that inverts with them (ADR-028).
 */
const SOLID_INK: Record<Tone, keyof Palette> = {
  neutral: 'bgApp',
  brand: 'bgApp',
  success: 'textOnSuccess',
  warning: 'textOnWarning',
  danger: 'textOnDanger',
};

export function Badge({ tone = 'neutral', solid = false, dot = false, size = 'md', children }: BadgeProps) {
  const { c, radius } = useTheme();
  const bg = solid ? c[SOLID[tone]] : c[FILL[tone]];
  const fg = solid ? c[SOLID_INK[tone]] : c[INK[tone]];
  const lg = size === 'lg';

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        alignSelf: 'flex-start',
        height: lg ? 26 : 22,
        paddingHorizontal: lg ? 12 : 9,
        borderRadius: radius.pill,
        backgroundColor: bg,
      }}
    >
      {dot ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: fg }} /> : null}
      <Text weight="semibold" size={lg ? 'sm' : 'xs'} color={fg}>
        {children}
      </Text>
    </View>
  );
}
