/**
 * ListingCard — a property listing tile (either domain). A photograph with its
 * caption on the scrim, over a domain badge, a money amount and a score.
 *
 * **Session 0 replaced the media stand-in with real photography.** It used to
 * draw a flat `brand300` fill with the title's first letter at 42px, which the
 * design brief §6 notes as the thing to replace "when a real photograph lands
 * there". This is that. The values are §6's own: the caption plate anchored to
 * the caption block rather than to the frame, with `captionFade` carrying it
 * back up into the picture.
 *
 * **Every photograph here owes a credit and gets one.** 22 of the 25 the app
 * ships are stand-ins, and ADR-015 call 5 requires a visible credit where they
 * appear — a card that shows a Rwandan landscape without saying so implies the
 * guest is looking at the place they would book. `PhotoCredit` decides for
 * itself from the stem and renders nothing for the three that depict their own
 * property, so a caller cannot get it wrong or opt out.
 *
 * The heart is drawn only when a caller passes a handler. A heart that does
 * nothing is an orphaned control, which is worse than no heart.
 *
 * **`unavailable` is ADR-032's, added by Session 6.** The Saved tab keeps a row
 * for a property whose listing is no longer published rather than dropping it,
 * because a list that silently shrinks is data loss the reader only notices
 * when they go looking. That child ADR puts the treatment on this card by name:
 * reduced opacity, an `Unavailable` badge, **no price and no reserve
 * affordance**, and still tappable so the guest can open it and unsave it. It
 * is a prop rather than a second card because the alternative is two components
 * that have to be kept looking alike, and because every other caller gets the
 * default `false` and no change at all.
 */
import { View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Text } from './text';
import { Icon } from './icon';
import { MoneyAmount } from './money-amount';
import { Badge } from './badge';
import { DomainBadge, type Domain } from './domain-badge';
import { PressableScale } from './pressable-scale';
import { PhotoCredit } from './photo-credit';
import { HeartButton } from './heart-button';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { photo as photoAsset } from '@/data/photos';
import { creditFor } from '@/data/photo-credits';

export interface Listing {
  id: string;
  title: string;
  location: string;
  domain?: Domain;
  price: number;
  per?: string;
  rating?: number;
  reviews?: number;
  meta?: string[];
  /** File stems into `@/data/photos`. `PhotoSet` satisfies this structurally. */
  photos?: { cover: string };
}

export function ListingCard({
  item,
  onPress,
  accessibilityLabel,
  saved,
  onToggleSave,
  unavailable = false,
  unavailableLabel,
}: {
  item: Listing;
  onPress?: () => void;
  accessibilityLabel?: string;
  saved?: boolean;
  onToggleSave?: (next: boolean) => void;
  /** ADR-032: this property has no published listing. Dims it, drops the price. */
  unavailable?: boolean;
  /** The badge word. Required in practice when `unavailable`; the card may not
   *  read the catalogue, so the copy comes from the caller like every other
   *  string a primitive draws. */
  unavailableLabel?: string;
}) {
  const { c, space, radius, shadow, scrim, onPhoto } = useTheme();
  const t = useT();
  const domain = item.domain ?? 'residence';
  const stem = item.photos?.cover;
  const asset = stem ? photoAsset(stem) : undefined;
  const credit = stem ? creditFor(stem) : undefined;

  const [captionHeight, setCaptionHeight] = useState(0);
  const onCaptionLayout = useCallback((e: LayoutChangeEvent) => {
    setCaptionHeight(e.nativeEvent.layout.height);
  }, []);

  return (
    <PressableScale
      accessibilityLabel={accessibilityLabel ?? `${item.title}, ${item.location}`}
      onPress={onPress}
      disabled={!onPress}
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
            // The photograph's own average colour, sampled at import: the tile
            // fills with its tone instead of flashing the surface colour.
            placeholder={asset.placeholder}
            contentFit="cover"
            transition={180}
            // The dimming sits on the PHOTOGRAPH alone. A container opacity
            // would take the badge, the heart and the caption down with it, and
            // those have to stay at the ADR-025 contrast floor — the heart in
            // particular, because unsaving is the one thing an unavailable card
            // still has to let you do.
            style={{ width: '100%', height: '100%', opacity: unavailable ? 0.4 : 1 }}
            // The caption below already names the property and the place, so
            // the picture is decoration and a second announcement of the same
            // facts is noise. The subject reaches the reader through the
            // credit, which is its own node.
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        ) : null}

        {/* §6.3: the plate is a box behind the caption that GROWS with it, and
            the fade hangs off its top edge. A fixed-height gradient pinned to
            the frame has to guess where the words are, and on these tiles a
            title that wraps moves them. */}
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

        <View style={{ position: 'absolute', top: 12, left: 12, flexDirection: 'row', gap: 6 }}>
          <DomainBadge domain={domain} solid />
          {unavailable && unavailableLabel ? (
            <Badge tone="neutral" solid>
              {unavailableLabel}
            </Badge>
          ) : null}
        </View>

        {onToggleSave ? (
          <View style={{ position: 'absolute', top: 8, right: 8 }}>
            <HeartButton saved={!!saved} onToggle={onToggleSave} />
          </View>
        ) : null}

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
          {/* On the scrim the type is FIXED white with the design brief's
              text-shadow floor, never a palette key: a photograph does not
              invert with the scheme, so neither may what sits on it (§8.7). */}
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
            {item.title}
          </Text>
          {credit ? <PhotoCredit stem={credit.stem} placement="over" /> : null}
        </View>
      </View>

      <View style={{ padding: 16, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Icon name="mapPin" size={14} color={c.textMuted} />
          <Text size="sm" color="textMuted" style={{ flex: 1 }}>
            {item.location}
          </Text>
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginTop: 2,
            gap: space[2],
            // The card is drawn full width by Explore and Directory and at half
            // that in the Saved grid. At half width a long rate and a rating
            // will not share a line, and neither may shrink to fit, so the
            // rating drops under the price instead of being clipped.
            flexWrap: 'wrap',
          }}
        >
          {unavailable ? (
            // No price and no reserve affordance on a property that cannot be
            // booked (ADR-032, AC-10). An empty slot rather than the word
            // again: the badge over the photograph already says it, and a card
            // that prints "Unavailable" twice reads as a rendering bug. The
            // slot itself stays so the row keeps its shape and the rating does
            // not slide left.
            <View />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
              <MoneyAmount value={item.price} strong tone="brand" size="md" />
              {item.per ? (
                <Text size="xs" color="textMuted">
                  / {item.per}
                </Text>
              ) : null}
            </View>
          )}
          {item.rating != null ? (
            <View
              accessible
              accessibilityLabel={t('listing.ratingOf', { rating: item.rating })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
            >
              <Icon name="star" size={13} color={c.warning500} />
              <Text weight="semibold" size="sm" color="textBody">
                {String(item.rating)}
              </Text>
              {item.reviews != null ? (
                <Text size="sm" color="textSubtle">
                  ({item.reviews})
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>

        {item.meta?.length ? (
          <View
            style={{
              flexDirection: 'row',
              gap: 12,
              paddingTop: 10,
              borderTopWidth: 1,
              borderTopColor: c.borderSubtle,
              marginTop: 2,
            }}
          >
            {item.meta.map((m) => (
              <Text key={m} size="xs" color="textMuted">
                {m}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    </PressableScale>
  );
}
