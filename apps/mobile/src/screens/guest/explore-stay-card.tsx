/**
 * ExploreStayCard — the photo-first tile the Guest canvas draws on Explore
 * (artboard 3, `listingCard` in `screens-a.mjs`).
 *
 * ## Why this is not `ListingCard`
 *
 * It is the same anatomy with one deliberate difference and one refusal.
 *
 * The difference: the canvas rates a stay with the **score chip and its band
 * word** — "8.5 Excellent" — where `ListingCard` prints stars out of five. That
 * is not decoration. ADR-022 derives the word from the score precisely so a
 * reader does not have to hold a scale in their head, and the artboard puts it
 * in the price row where the stars are. Passing a `variant` into the shared
 * card to swap one for the other would be a prop that changes what the card
 * MEANS, which is how a shared component starts collecting flags.
 *
 * The refusal: the session prompt says to build this on `ImageHeader`.
 * `ImageHeader` mounts a floating `BackHeader` on every frame it draws, because
 * it is the top of a detail screen; on a list it would put a back chevron on
 * twelve tiles. Its inner `PhotoFrame` — the part that is wanted — is not
 * exported. So the §6.3 scrim anatomy is drawn here directly: the plate is a
 * box behind the caption that grows with it, with `captionFade` hung off its
 * top edge, which is the same construction `ListingCard` and `ImageHeader` both
 * use and the same reason all three use it.
 *
 * **Session 11 should look at merging this back into `ListingCard`.** The two
 * differ by the rating atom and nothing else, and by then Saved and the
 * Directory will have said whether they want the score or the stars.
 *
 * Everything else is the kit's: `PhotoCredit` renders itself from the stem and
 * cannot be opted out of (ADR-015 call 5), and `HeartButton` is controlled by
 * the saved store so a tile and the Saved tab cannot disagree.
 */
import { useCallback, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  DomainBadge,
  HeartButton,
  Icon,
  MoneyAmount,
  PhotoCredit,
  PressableScale,
  ScoreChip,
  Text,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { photo as photoAsset } from '@/data/photos';
import { creditFor } from '@/data/photo-credits';
import type { Stay } from '@/data/stays';

export interface ExploreStayCardProps {
  stay: Stay;
  saved: boolean;
  onToggleSave: (next: boolean) => void;
  onPress: () => void;
}

export function ExploreStayCard({ stay, saved, onToggleSave, onPress }: ExploreStayCardProps) {
  const { c, space, radius, shadow, scrim, onPhoto } = useTheme();
  const t = useT();
  const asset = photoAsset(stay.photos.cover);
  const credit = creditFor(stay.photos.cover);

  const [captionHeight, setCaptionHeight] = useState(0);
  const onCaptionLayout = useCallback((e: LayoutChangeEvent) => {
    setCaptionHeight(e.nativeEvent.layout.height);
  }, []);

  return (
    <PressableScale
      accessibilityLabel={t('explore.openStay', { title: stay.title })}
      accessibilityHint={stay.location}
      onPress={onPress}
      style={{
        backgroundColor: c.surface1,
        borderWidth: 1,
        borderColor: c.borderSubtle,
        borderRadius: radius.lg,
        overflow: 'hidden',
        ...shadow.sm,
      }}
    >
      <View style={{ aspectRatio: 16 / 10, backgroundColor: c.surface2 }}>
        {asset ? (
          <Image
            source={asset.source}
            // The photograph's own average colour, sampled at import, so the
            // tile fills with its tone rather than flashing the surface.
            placeholder={asset.placeholder}
            contentFit="cover"
            transition={180}
            style={{ width: '100%', height: '100%' }}
            // The caption already names the property and the credit names the
            // subject. A third announcement of the same facts is noise.
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        ) : null}

        {captionHeight > 0 ? (
          <>
            <LinearGradient
              colors={scrim.captionFade}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: captionHeight,
                height: Math.max(20, Math.round(captionHeight * 0.6)),
              }}
            />
            <LinearGradient
              colors={scrim.caption}
              pointerEvents="none"
              style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: captionHeight }}
            />
          </>
        ) : null}

        <View style={{ position: 'absolute', top: 12, left: 12 }}>
          <DomainBadge domain="hospitality" solid />
        </View>

        <View style={{ position: 'absolute', top: 8, right: 8 }}>
          <HeartButton saved={saved} onToggle={onToggleSave} />
        </View>

        <View
          onLayout={onCaptionLayout}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: space[3],
            paddingBottom: space[2],
            paddingTop: space[2],
            gap: 4,
          }}
        >
          {/* Fixed white with the §6 text-shadow floor, never a palette key: a
              photograph does not invert with the scheme, so neither may what
              sits on it (design brief §8.7). */}
          <Text
            family="display"
            weight="semibold"
            size="lg"
            color={onPhoto}
            numberOfLines={2}
            style={{
              lineHeight: 21,
              textShadowColor: scrim.textShadow.color,
              textShadowOffset: scrim.textShadow.offset,
              textShadowRadius: scrim.textShadow.radius,
            }}
          >
            {stay.title}
          </Text>
          {credit ? <PhotoCredit stem={credit.stem} placement="over" /> : null}
        </View>
      </View>

      <View style={{ padding: space[4], gap: space[2] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Icon name="mapPin" size={14} color={c.textMuted} />
          <Text size="sm" color="textMuted" style={{ flex: 1 }} numberOfLines={1}>
            {stay.location}
          </Text>
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 2,
            gap: space[2],
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
            <MoneyAmount value={stay.price} strong tone="brand" size="md" />
            <Text size="xs" color="textMuted">
              {`/ ${t('explore.perNight')}`}
            </Text>
          </View>
          {/* The word is derived from the score inside the chip; the fixture
              never stores the two side by side. */}
          <ScoreChip score={stay.score} size="sm" />
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingTop: 10,
            borderTopWidth: 1,
            borderTopColor: c.borderSubtle,
            marginTop: 2,
          }}
        >
          {/* Colour, glyph and label together (design brief §7.5): the same
              fact has to survive greyscale and a colour-blind reader. */}
          {stay.bookingMode === 'instant_book' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon name="zap" size={12} color={c.brand700} />
              <Text weight="medium" size="xs" color="brand700">
                {t('explore.instantBook')}
              </Text>
            </View>
          ) : null}
          {stay.meta.slice(0, stay.bookingMode === 'instant_book' ? 2 : 3).map((m) => (
            <Text key={m} size="xs" color="textMuted">
              {m}
            </Text>
          ))}
        </View>
      </View>
    </PressableScale>
  );
}
