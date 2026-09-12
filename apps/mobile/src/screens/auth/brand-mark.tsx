/**
 * The Injishi bird, as frames X1 and X3 draw it.
 *
 * **Two files, never one tinted file.** Design brief 10 is explicit: the bird's
 * green is not a role and does not follow the theme, and the correct mark on a
 * dark ground is the `-white` variant rather than a recoloured copy of the
 * colour one. So the scheme picks a FILE and nothing here picks a colour, which
 * is also why this component is the one place in `src/` that renders an image
 * without going through the palette.
 *
 * The two SVGs are `injishi-short.svg` and `injishi-short-white.svg` from
 * `apps/web/public/shared/img/`, copied verbatim except that the `fill` moved
 * from a `<style>` block onto the path and the empty bounding `<rect>` was
 * dropped. Both are rendering-safety edits for `androidsvg`, which is what
 * `expo-image` decodes SVG with on Android; the geometry and the two colours
 * are untouched.
 *
 * `expo-image` rather than `react-native-svg`: the SVG decoder ships inside
 * `expo-image` on both platforms (`SVGDecoder` on Android, SDWebImage's SVG
 * coder on iOS) and is already a dependency, so the mark costs no new package.
 *
 * Decorative, and hidden from assistive tech. On both screens the display title
 * immediately under it says what the product is, and a reader that stops on an
 * untranslated brand string before reaching the heading is worse off.
 */
import { View } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '@/theme/theme';

const COLOUR = require('../../../assets/brand/injishi-short.svg');
const WHITE = require('../../../assets/brand/injishi-short-white.svg');

/** The mark's own aspect, from its `viewBox` (431 x 384). */
const RATIO = 384 / 431;

export function BrandMark({ width = 44 }: { width?: number }) {
  const { scheme } = useTheme();

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width, height: Math.round(width * RATIO) }}
    >
      <Image
        source={scheme === 'dark' ? WHITE : COLOUR}
        contentFit="contain"
        // No transition: a mark that fades in reads as a loading state on a
        // screen whose whole job is to look settled.
        style={{ width: '100%', height: '100%' }}
      />
    </View>
  );
}
