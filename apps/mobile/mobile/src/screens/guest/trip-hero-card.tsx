/**
 * The hero card at the top of Trips: the next stay, and how long until it.
 *
 * Guest canvas artboard 9 draws Trips as an undifferentiated list of three
 * equal cards. This session's prompt asks for the hero instead, and the reason
 * is the one thing the artboard's list cannot do: on the morning of an arrival
 * the only question a guest has is "can I check in yet", and a list makes them
 * find the answer among three cards that all look the same. So the soonest
 * stay is lifted out, given the photograph, the countdown and the one button
 * that matters, and the rest stay as rows underneath.
 *
 * ## Three rules it keeps
 *
 * **The countdown is the headline, and it is a sentence.** "Arriving in 5 days"
 * rather than "5" with a label, because the label and the number are one fact
 * and splitting them is what makes a reader assemble it.
 *
 * **There is one primary action, and when there is none the card says why.**
 * `checkInGate` has six answers and only two of them carry a button; the other
 * four print their sentence where the button would be, which is the canvas rule
 * that consequences go under the control rather than being discovered later.
 *
 * **The photograph is drawn here rather than through `ImageHeader`.**
 * `ImageHeader` mounts a floating `BackHeader` on every frame — it is the top
 * of a detail screen — and on a tab it would put a back chevron over the hero.
 * Its inner `PhotoFrame` is not exported, so the §6.3 scrim anatomy is built
 * here the same way `explore-stay-card.tsx` builds it: a plate behind the
 * caption that grows with it, with `captionFade` hung off its top edge.
 * `PhotoCredit` renders itself from the stem and cannot be opted out of
 * (ADR-015 call 5).
 */
import { useCallback, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Button,
  DomainBadge,
  Icon,
  PhotoCredit,
  PressableScale,
  StatusBadge,
  Text,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { photo as photoAsset } from '@/data/photos';
import { arrivalAt, type Trip } from '@/data/trips';
import { countdownText, heroState, tripDateLine } from './trip-format';
import { useNow } from './trip-clock';

export interface TripHeroCardProps {
  trip: Trip;
  onOpen: () => void;
  /** Start self check-in. Only ever called while the gate says `ready`. */
  onCheckIn: () => void;
  /** Open the unlocked arrival guide. Only while the gate says `open`. */
  onArrivalGuide: () => void;
}

export function TripHeroCard({ trip, onOpen, onCheckIn, onArrivalGuide }: TripHeroCardProps) {
  const { c, space, radius, shadow, scrim, onPhoto } = useTheme();
  const t = useT();
  const asset = photoAsset(trip.photo);

  const [captionHeight, setCaptionHeight] = useState(0);
  const onCaptionLayout = useCallback((e: LayoutChangeEvent) => {
    setCaptionHeight(e.nativeEvent.layout.height);
  }, []);

  // The tick rate follows how far off arrival is, and arrival does not depend
  // on the clock — so the hook can be called before the state is derived.
  const now = useNow(arrivalAt(trip));
  const hero = heroState(trip, now);
  const when = hero.inHouse ? t('trips.heroCheckedIn') : countdownText(hero.target, now, t);

  const cta = hero.copy.ctaKey;
  const pressCta = hero.gate.kind === 'open' ? onArrivalGuide : onCheckIn;

  return (
    <View
      style={{
        backgroundColor: c.surface1,
        borderWidth: 1,
        borderColor: c.borderBrand,
        borderRadius: radius.lg,
        overflow: 'hidden',
        ...shadow.md,
      }}
    >
      <PressableScale
        accessibilityLabel={t('trips.a11yHero', { property: trip.property, when })}
        accessibilityHint={tripDateLine(trip, t)}
        onPress={onOpen}
      >
        <View style={{ height: 168, backgroundColor: c.surface2 }}>
          {asset ? (
            <Image
              source={asset.source}
              // The photograph's own average colour, sampled at import, so the
              // card fills with its tone rather than flashing the surface.
              placeholder={asset.placeholder}
              contentFit="cover"
              transition={180}
              style={{ width: '100%', height: '100%' }}
              // The caption names the property and the credit names the
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
          <View style={{ position: 'absolute', top: 12, right: 12 }}>
            <StatusBadge domain="booking" state={trip.state} />
          </View>

          <View
            onLayout={onCaptionLayout}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              paddingHorizontal: space[4],
              paddingBottom: space[2],
              paddingTop: space[3],
              gap: 4,
            }}
          >
            <Text
              // Fixed white with the §6 text-shadow floor, never a palette key:
              // a photograph does not invert with the scheme, so neither may
              // what sits on it (design brief §8.7).
              weight="bold"
              size="2xs"
              color={onPhoto}
              style={{
                letterSpacing: 1,
                textTransform: 'uppercase',
                opacity: 0.9,
                textShadowColor: scrim.textShadow.color,
                textShadowOffset: scrim.textShadow.offset,
                textShadowRadius: scrim.textShadow.radius,
              }}
            >
              {t(hero.inHouse ? 'trips.heroInHouseLabel' : 'trips.heroLabel')}
            </Text>
            <Text
              family="display"
              weight="semibold"
              size="xl"
              color={onPhoto}
              numberOfLines={2}
              style={{
                lineHeight: 26,
                textShadowColor: scrim.textShadow.color,
                textShadowOffset: scrim.textShadow.offset,
                textShadowRadius: scrim.textShadow.radius,
              }}
            >
              {trip.property}
            </Text>
            <PhotoCredit stem={trip.photo} placement="over" />
          </View>
        </View>
      </PressableScale>

      <View style={{ padding: space[4], gap: space[3] }}>
        {/* The countdown, and the arrival time it counts to. `accessible` on
            the pair so a reader hears one sentence, not two fragments. */}
        <View
          accessible
          accessibilityLabel={`${when}. ${t('trips.heroFrom', { time: trip.checkInTime })}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: radius.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: hero.inHouse ? c.success100 : c.brand100,
            }}
          >
            <Icon
              name={hero.inHouse ? 'checkCircle' : 'clock'}
              size={19}
              color={hero.inHouse ? c.success600 : c.brand700}
            />
          </View>
          <View style={{ flex: 1, gap: 1 }}>
            <Text family="display" weight="semibold" size="lg" color="textStrong">
              {when}
            </Text>
            <Text size="xs" color="textMuted">
              {t('trips.heroFrom', { time: trip.checkInTime })}
            </Text>
          </View>
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingTop: space[3],
            borderTopWidth: 1,
            borderTopColor: c.borderSubtle,
          }}
        >
          <Icon name="calendar" size={14} color={c.textMuted} />
          <Text size="sm" color="textBody" style={{ flex: 1 }} numberOfLines={1}>
            {tripDateLine(trip, t)}
          </Text>
          <Icon name="users" size={14} color={c.textMuted} />
          <Text size="sm" color="textBody">
            {trip.guests === 1
              ? t('trip.oneGuest')
              : t('trip.guestsCount', { count: trip.guests })}
          </Text>
        </View>

        {cta ? (
          <Button
            variant="primary"
            size="lg"
            block
            leadingIcon={hero.gate.kind === 'open' ? 'key' : 'check'}
            onPress={pressCta}
          >
            {t(cta)}
          </Button>
        ) : (
          // No button, so the card says what is standing in the way. A hero
          // with a dead zone where its action should be is worse than one that
          // explains itself.
          <View
            accessible
            accessibilityRole="summary"
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: space[2],
              padding: space[3],
              borderRadius: radius.md,
              backgroundColor: c.bgTint,
            }}
          >
            <Icon name="info" size={15} color={c.brand700} />
            <Text size="xs" color="textBody" style={{ flex: 1, lineHeight: 18 }}>
              {t(hero.copy.bodyKey)}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
