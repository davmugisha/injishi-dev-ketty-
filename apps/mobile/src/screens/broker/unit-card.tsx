/**
 * Frame B21's unit card: a photograph with the vacancy chip on it, then the
 * rent, the size and place, the fee line and "View unit →".
 *
 * ## Why not `ListingCard`
 *
 * The kit's tile draws a rating and a heart and puts the title on the scrim,
 * which is right for a stay a guest is choosing between and wrong for a unit a
 * broker is working. The three facts that decide whether a broker opens a unit
 * — is it free, what does it rent for, what do I earn — are none of them on
 * that tile, and the two the tile leads with (a review score, a save) are facts
 * a broker has no use for. So this is its own card. It keeps the tile's
 * photographic anatomy exactly: the same 16:10 frame, the same caption plate
 * anchored to the caption block, the same credit obligation.
 *
 * **The credit is not optional.** 22 of the 25 photographs this app ships are
 * Rwandan landscape and city photography standing in for a property whose own
 * pictures the project does not hold, and ADR-015 call 5 requires a visible
 * credit where they appear. `PhotoCredit` decides for itself from the stem and
 * draws nothing for the three that depict their own property, so this card
 * cannot ship without one and cannot opt out.
 *
 * **A let unit is drawn, not hidden.** FL18 path B makes "unavailable" a state
 * rather than an absence: the row reads muted, the chip says so, and the action
 * says "View unit" rather than pretending a placement can start.
 */
import { useCallback, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Badge, Icon, MoneyAmount, PhotoCredit, PressableScale, Text } from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { photo as photoAsset } from '@/data/photos';
import { creditFor } from '@/data/photo-credits';
import type { DirectoryUnit } from '@/data/broker';
import { feeLine, moneyText, unitFee, vacancyChip } from './broker-format';

export function UnitCard({ unit, onPress }: { unit: DirectoryUnit; onPress: () => void }) {
  const { c, space, radius, shadow, scrim, onPhoto } = useTheme();
  const t = useT();

  const stem = unit.photos.cover;
  const asset = photoAsset(stem);
  const credit = creditFor(stem);
  const vacancy = vacancyChip(unit.vacancy, t);
  const isLet = unit.vacancy.state === 'leased';

  const [captionHeight, setCaptionHeight] = useState(0);
  const onCaptionLayout = useCallback((e: LayoutChangeEvent) => {
    setCaptionHeight(e.nativeEvent.layout.height);
  }, []);

  const size = t('directory.bedCount', { count: unit.bedrooms });
  const fee = feeLine(unit, t, moneyText(unitFee(unit)));

  return (
    <PressableScale
      // One node, one sentence. A reader should hear the unit, not six
      // fragments in whatever order the layout happens to put them.
      accessibilityLabel={t('directory.cardSummary', {
        title: unit.title,
        place: unit.district,
        rent: moneyText(unit.rent),
        vacancy: vacancy.label,
      })}
      accessibilityHint={t('directory.viewUnit')}
      onPress={onPress}
      style={{
        backgroundColor: c.surface1,
        borderWidth: 1,
        borderColor: c.borderSubtle,
        borderRadius: radius.lg,
        overflow: 'hidden',
        // A let unit is still readable, just plainly second rank.
        opacity: isLet ? 0.72 : 1,
        ...shadow.sm,
      }}
    >
      <View style={{ aspectRatio: 16 / 10, backgroundColor: c.surface2 }}>
        {asset ? (
          <Image
            source={asset.source}
            placeholder={asset.placeholder}
            contentFit="cover"
            transition={180}
            // This card is a FlashList row, and a recycled row keeps its
            // native image view: without the key it shows the previous unit's
            // photograph until the new one loads (mobile audit 2026-10-05,
            // BR-08; gaps.md B8).
            recyclingKey={unit.id}
            style={{ width: '100%', height: '100%' }}
            // The caption below names the unit and the place, so the picture is
            // decoration; the subject reaches the reader through the credit,
            // which is its own node.
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        ) : null}

        {/* §6.3: the plate is a box BEHIND the caption that grows with it, and
            the fade hangs off its top edge. A fixed-height gradient pinned to
            the frame has to guess where the words are, and a title that wraps
            moves them. */}
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

        {/* The vacancy chip sits ON the photograph, which is frame B21's own
            placement and the reason it is the first thing read. */}
        <View style={{ position: 'absolute', top: 12, left: 12 }}>
          <Badge tone={vacancy.tone} solid dot>
            {vacancy.label}
          </Badge>
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
            {unit.title}
          </Text>
          {credit ? <PhotoCredit stem={credit.stem} placement="over" /> : null}
        </View>
      </View>

      <View style={{ padding: 16, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <MoneyAmount value={unit.rent} strong tone="brand" size="lg" />
          <Text size="xs" color="textMuted">
            {t('directory.perMonth')}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Icon name="mapPin" size={13} color={c.textMuted} />
          <Text size="sm" color="textMuted" style={{ flex: 1 }}>
            {t('directory.sizeAndPlace', { beds: size, district: unit.district })}
          </Text>
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space[2],
            paddingTop: 10,
            borderTopWidth: 1,
            borderTopColor: c.borderSubtle,
          }}
        >
          <Icon name="percent" size={13} color={c.textSubtle} />
          <Text size="xs" color="textBody" style={{ flex: 1 }} numberOfLines={2}>
            {fee}
          </Text>
          {/* The action is drawn, not pressable on its own: the whole card is
              the target, and a second control inside it would be one the
              reader has to aim at. */}
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
          >
            <Text weight="semibold" size="xs" color="brand700">
              {t('directory.viewUnit')}
            </Text>
            <Icon name="arrowRight" size={13} color={c.brand700} />
          </View>
        </View>
      </View>
    </PressableScale>
  );
}
