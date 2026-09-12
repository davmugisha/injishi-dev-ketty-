/**
 * The arrival guide — F-B18, gated behind check-in.
 *
 * Wifi, the door code, the directions and the house rules, on their own route
 * rather than expanded inside the trip detail. A route because it is what a
 * guest opens standing at a gate in the dark: it is the one screen they want
 * with no scrolling past a price breakdown, and a route can be deep-linked
 * straight from a notification when F-B18's "arrival guide reveal" lands.
 *
 * **It asks the gate again rather than trusting the caller.** The trip detail
 * only routes here when the guide is unlocked, but a deep link, a back-stack
 * restore or a booking that changed under a stale screen can all land here
 * without that being true — so this reads `arrivalGuideFor` itself and draws
 * the locked state when it returns nothing. A screen that assumed its caller
 * checked is a screen whose gate is only as good as its least careful link.
 *
 * **The copyable values are `Copy` controls, not selectable text.** Frame-level
 * rule from the design brief: a control that does something has a button. The
 * code is also large and monospaced, because the other half of using it is
 * reading it off the screen while typing it into a keypad.
 */
import { View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BackHeader,
  Button,
  Card,
  EmptyState,
  Icon,
  PressableScale,
  SectionLabel,
  SkeletonList,
  Text,
  useToast,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT, type Translate } from '@/i18n/i18n';
import { arrivalGuideFor, useTrip } from '@/data/trips';
import { getStayDetail, houseRuleLines } from '@/data/property-detail';
import { formatDay } from '@/data/search';
import { tripDates } from './trip-format';
import { copyText, openDirections } from './trip-platform';
import { useNow } from './trip-clock';

export function TripArrivalGuide({ id }: { id: string | undefined }) {
  const { c, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const router = useRouter();
  const toast = useToast();

  const { trip, status } = useTrip(id);
  const now = useNow();
  const guide = trip ? arrivalGuideFor(trip, now) : undefined;
  const detail = trip ? getStayDetail(trip.stayId) : undefined;
  const rules = detail ? houseRuleLines(detail.property) : [];

  const copy = async (label: string, value: string) => {
    const ok = await copyText(value);
    toast.show(ok ? t('checkin.guideCopied', { label }) : t('checkin.guideCopyFailed'), ok ? 'success' : 'warning');
  };

  const body = () => {
    if (status === 'loading') {
      return <SkeletonList rows={3} label={t('state.loadingList', { label: t('trip.arrival') })} />;
    }
    if (!trip) {
      return (
        <EmptyState
          icon="calendar"
          title={t('trip.notFound')}
          body={t('trip.notFoundBody')}
          action={
            <Button variant="outline" size="md" onPress={() => router.replace('/trips')}>
              {t('trip.backToTrips')}
            </Button>
          }
        />
      );
    }
    if (!guide) {
      // The gate, asked here and not assumed. See the header.
      return (
        <EmptyState
          icon="lock"
          title={t('checkin.guideLockedTitle')}
          body={t('checkin.guideLockedBody')}
          action={
            <Button
              variant="outline"
              size="md"
              onPress={() => router.replace({ pathname: '/trip/[id]', params: { id: trip.id } })}
            >
              {t('trip.backToTrips')}
            </Button>
          }
        />
      );
    }

    return (
      <View style={{ gap: space[4] }}>
        <View style={{ gap: 4 }}>
          <Text family="display" weight="semibold" size="2xl" color="textStrong" style={{ letterSpacing: -0.4 }}>
            {t('checkin.guideTitle')}
          </Text>
          <Text size="sm" color="textMuted">
            {t('checkin.guideSubtitle', { property: trip.property, dates: tripDates(trip, t) })}
          </Text>
        </View>

        <SectionLabel>{t('checkin.guideWifi')}</SectionLabel>
        <Card>
          <View style={{ gap: space[3] }}>
            <CopyRow
              label={t('checkin.guideNetwork')}
              value={guide.wifiNetwork}
              onCopy={copy}
              t={t}
            />
            <CopyRow
              label={t('checkin.guidePassword')}
              value={guide.wifiPassword}
              onCopy={copy}
              t={t}
            />
          </View>
        </Card>

        <SectionLabel>{t('checkin.guideAccess')}</SectionLabel>
        <Card variant="tint">
          <View style={{ gap: space[3] }}>
            <Text
              weight="bold"
              size="2xs"
              color="brand900"
              style={{ letterSpacing: 1, textTransform: 'uppercase' }}
            >
              {t('checkin.guideCode')}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
              <Text
                family="mono"
                weight="semibold"
                size="3xl"
                color="brand900"
                style={{ flex: 1, letterSpacing: 2 }}
              >
                {guide.accessCode}
              </Text>
              <PressableScale
                accessibilityLabel={t('checkin.guideCopy', { label: t('checkin.guideCode') })}
                haptic
                onPress={() => void copy(t('checkin.guideCode'), guide.accessCode)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  height: 44,
                  paddingHorizontal: space[4],
                  borderRadius: radius.md,
                  backgroundColor: c.surface1,
                  borderWidth: 1,
                  borderColor: c.borderDefault,
                }}
              >
                <Icon name="copy" size={15} color={c.textBody} />
                <Text weight="semibold" size="sm" color="textBody">
                  {t('checkin.guideCode')}
                </Text>
              </PressableScale>
            </View>
            <Text size="sm" color="brand900" style={{ lineHeight: 19 }}>
              {guide.accessNote}
            </Text>
          </View>
        </Card>

        <SectionLabel>{t('checkin.guideDirections')}</SectionLabel>
        <Card>
          <View style={{ gap: space[3] }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[3] }}>
              <Icon name="mapPin" size={17} color={c.textMuted} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text weight="medium" size="sm" color="textStrong" style={{ lineHeight: 20 }}>
                  {trip.address}
                </Text>
                <Text size="sm" color="textBody" style={{ lineHeight: 20 }}>
                  {guide.directions}
                </Text>
              </View>
            </View>
            <Button
              variant="outline"
              size="md"
              block
              leadingIcon="navigation"
              onPress={() => {
                void openDirections({
                  lat: trip.coords.lat,
                  lng: trip.coords.lng,
                  label: trip.property,
                }).then((ok) => {
                  if (!ok) toast.show(t('trip.directionsFailed'), 'warning');
                });
              }}
            >
              {t('trip.getDirections')}
            </Button>
          </View>
        </Card>

        <SectionLabel>{t('checkin.guideRules')}</SectionLabel>
        <Card>
          <View style={{ gap: space[3] }}>
            {rules.map((rule) => (
              <View key={rule} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <Icon name="check" size={15} color={c.success600} />
                <Text size="sm" color="textBody" style={{ flex: 1, lineHeight: 20 }}>
                  {rule}
                </Text>
              </View>
            ))}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 10,
                paddingTop: space[3],
                borderTopWidth: 1,
                borderTopColor: c.borderSubtle,
              }}
            >
              <Icon name="clock" size={15} color={c.textMuted} />
              <Text size="sm" color="textBody" style={{ flex: 1, lineHeight: 20 }}>
                {t('checkin.guideCheckOut', {
                  time: trip.checkOutTime,
                  day: formatDay(trip.checkOutDay, t),
                })}
              </Text>
            </View>
          </View>
        </Card>

        <Text size="xs" color="textMuted" style={{ lineHeight: 18 }}>
          {t('checkin.guideHelp')}
        </Text>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 52,
          paddingHorizontal: space[4],
          paddingBottom: insets.bottom + space[8],
        }}
        showsVerticalScrollIndicator={false}
      >
        {body()}
      </ScrollView>
      <BackHeader />
    </View>
  );
}

/** A label, a value and a Copy control, at the 44pt floor. */
function CopyRow({
  label,
  value,
  onCopy,
  t,
}: {
  label: string;
  value: string;
  onCopy: (label: string, value: string) => Promise<void>;
  t: Translate;
}) {
  const { c, space, radius } = useTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 44 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text size="xs" color="textMuted">
          {label}
        </Text>
        <Text family="mono" weight="medium" size="md" color="textStrong">
          {value}
        </Text>
      </View>
      <PressableScale
        accessibilityLabel={t('checkin.guideCopy', { label })}
        haptic
        onPress={() => void onCopy(label, value)}
        hitSlop={6}
        style={{
          width: 40,
          height: 40,
          borderRadius: radius.md,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: c.surface2,
          borderWidth: 1,
          borderColor: c.borderSubtle,
        }}
      >
        <Icon name="copy" size={16} color={c.textBody} />
      </PressableScale>
    </View>
  );
}
