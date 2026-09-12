/**
 * PhotoTile — a photograph inside a card, rather than at the top of a screen.
 *
 * `ImageHeader` in the kit always draws a floating `BackHeader` over the frame,
 * because it exists for the top of a detail screen. Frame R11 draws the same
 * photograph inside a list card, where a back arrow sitting on the picture
 * would be a control that goes back from a screen you are still on.
 *
 * Everything else is `ImageHeader`'s behaviour on purpose:
 *
 *   - **The credit travels with the photograph** (ADR-015 call 5). `PhotoCredit`
 *     is rendered here, not by the caller, so a tile cannot ship without one.
 *     Twenty-two of the twenty-five photographs in this build stand in for a
 *     property whose own pictures the project does not hold, and every screen
 *     that draws one owes that line on the screen.
 *   - **The scrim is the design brief's** `caption` plate, anchored to the
 *     bottom of the frame where the credit and the chip sit.
 *   - **The photograph is decorative.** The card names the unit in text
 *     directly under it, so a second announcement of the same fact from the
 *     image is noise; the credit carries its own label.
 */
import { type ReactNode } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { PhotoCredit } from '@/components';
import { useTheme } from '@/theme/theme';
import { photo as photoAsset } from '@/data/photos';

export interface PhotoTileProps {
  stem: string;
  height?: number;
  /** Floats top-left on the photograph. Frame R11's "active" chip. */
  chip?: ReactNode;
}

export function PhotoTile({ stem, height = 148, chip }: PhotoTileProps) {
  const { scrim, space } = useTheme();
  const asset = photoAsset(stem);

  return (
    <View style={{ width: '100%', height }}>
      <Image
        source={asset?.source}
        placeholder={asset?.placeholder}
        contentFit="cover"
        transition={200}
        style={{ width: '100%', height }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />

      <LinearGradient
        colors={scrim.captionFade}
        pointerEvents="none"
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: Math.round(height / 2) }}
      />

      {chip ? (
        <View style={{ position: 'absolute', top: space[3], left: space[3] }}>{chip}</View>
      ) : null}

      <View style={{ position: 'absolute', left: space[3], right: space[3], bottom: space[3] }}>
        <PhotoCredit stem={stem} placement="over" />
      </View>
    </View>
  );
}
