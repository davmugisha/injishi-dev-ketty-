/**
 * PhotoCredit — the visible credit a stand-in photograph owes.
 *
 * **This is a licence obligation, not a design flourish.** ADR-015 call 5: a
 * photograph whose `depicts_actual_property` is false carries a VISIBLE credit
 * WHERE IT APPEARS, not only on a credits page. 22 of the 25 photographs this
 * app ships are Rwandan landscape and city photography standing in for a
 * property whose own pictures the project does not hold, and a card that shows
 * one without saying so implies the guest is looking at the place they would
 * book. Most of the 25 are CC BY or CC BY-SA, which require the credit to
 * travel with the work.
 *
 * So the component decides for itself. Give it a stem; it reads
 * `./photo-credits`, and renders nothing at all for a photograph that depicts
 * its own property. A caller cannot forget the rule and cannot opt out of it.
 *
 * Two placements, because the frames use both:
 *
 *   - `over` — on the photograph, bottom-left, on the caption scrim. This is
 *     the one that satisfies "where it appears" for a hero or a tile.
 *   - `under` — a quiet line beneath the frame, for a small thumbnail where a
 *     legible overlay would cover the picture it is crediting.
 *
 * On the scrim the text is FIXED white with the design brief's text-shadow
 * floor, never a palette key: the photograph does not invert with the scheme,
 * so neither may what is drawn on it (design brief §8.7).
 */
import { View } from 'react-native';
import { Text } from './text';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { creditFor } from '@/data/photo-credits';

export interface PhotoCreditProps {
  /** The file stem, as it appears in `PHOTOS` and `PHOTO_CREDITS`. */
  stem: string;
  /** `over` sits on the scrim; `under` sits below the frame. */
  placement?: 'over' | 'under';
  /** Also print the "Not this property" tag. On by default on a hero. */
  showStandIn?: boolean;
}

export function PhotoCredit({ stem, placement = 'over', showStandIn }: PhotoCreditProps) {
  const { scrim, onPhoto, onPhotoMuted, radius } = useTheme();
  const t = useT();
  const credit = creditFor(stem);

  // A photograph that shows its own property owes nothing, and a stem with no
  // row should never have reached a screen — the importer refuses to copy one.
  if (!credit || credit.depictsActualProperty) return null;

  const line = t('photo.credit', { author: credit.author, licence: credit.licence });
  const standIn = showStandIn ?? placement === 'over';
  // One node, one sentence. A reader hearing "Honeybarger", "CC BY-SA 4.0" and
  // "Not this property" as three stops is hearing noise.
  const spoken = standIn ? `${t('photo.standIn')}. ${line}` : line;

  if (placement === 'under') {
    return (
      <View accessible accessibilityLabel={spoken} style={{ paddingTop: 6 }}>
        <Text size="2xs" color="textMuted">
          {standIn ? `${t('photo.standIn')} · ${line}` : line}
        </Text>
      </View>
    );
  }

  return (
    <View
      accessible
      accessibilityLabel={spoken}
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        maxWidth: '100%',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: radius.sm,
        // The caption plate at its darkest step. A flat fill rather than a
        // gradient here: the chip is one line tall, so the ramp has nowhere to
        // run and the plate is doing the whole job.
        backgroundColor: scrim.caption[1],
      }}
    >
      {standIn ? (
        <>
          <Text
            weight="semibold"
            size="2xs"
            color={onPhoto}
            style={{ letterSpacing: 0.3, textTransform: 'uppercase' }}
          >
            {t('photo.standIn')}
          </Text>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{ width: 1, height: 10, backgroundColor: onPhotoMuted }}
          />
        </>
      ) : null}
      <Text
        size="2xs"
        color={onPhotoMuted}
        numberOfLines={1}
        style={{
          flexShrink: 1,
          textShadowColor: scrim.textShadow.color,
          textShadowOffset: scrim.textShadow.offset,
          textShadowRadius: scrim.textShadow.radius,
        }}
      >
        {line}
      </Text>
    </View>
  );
}
