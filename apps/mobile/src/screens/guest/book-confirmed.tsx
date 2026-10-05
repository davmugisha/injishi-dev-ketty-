/**
 * Booking confirmed — Guest canvas artboard 8, `bookingConfirmed` in
 * `screens-b.mjs`, FL07 §8.
 *
 * **It reads the Trip back out of the store rather than being handed one.** The
 * stepper writes through `useFixtureMutation` and then routes here with an id.
 * Reading by that id is what makes this screen a real destination: it survives
 * a reload, it deep-links, and "View trip" opens the same record the Trips tab
 * lists. A screen handed its content in route params would be a receipt printed
 * from the request rather than from what was actually written.
 *
 * **The status is `StatusBadge`, not a word this file chose.** The canvas draws
 * a brand badge reading "Confirmed", which is only right for `instant_book`;
 * a `request_to_book` room lands in `pending_approval` (F-B03, FL07 §4 step 6)
 * and the guest must be told that the host has not answered yet. Both the badge
 * and the whole page's copy follow the Trip's own state.
 *
 * **The money is `trip.breakdown`, never recomputed.** Design brief §8.6: a
 * price is locked at booking time and never recomputed on a screen. The escrow
 * line prints what was captured, and its LABEL changes with the state — money
 * against a request is held, not paid to anyone.
 *
 * **The success motion is a scale and a fade, and reduced motion keeps the
 * fade.** §7.6's rule is that reduced motion removes the travel and never the
 * feedback, so the mark still arrives — it simply stops springing.
 *
 * ## Mobile audit 2026-10-05 (GK-16, GK-15)
 *
 * **A failed read is an error, not "not on this device".** It used to fall
 * through to the not-found state; it now says the read failed and offers a
 * retry, and not-found is kept for a booking that really is not here.
 *
 * **The booking reference can be selected and copied** from the system's own
 * text menu. A Copy button needs `expo-clipboard`, which this app does not
 * ship, and React Native's own clipboard is deprecated and absent on some
 * builds; selectable text works everywhere and claims nothing it cannot do.
 *
 * **"Room type" names the room.** The row printed the PROPERTY's name; a
 * booking made in the app now carries the room's, and the property sits on its
 * own "Stay" row.
 */
import { useEffect } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  MoneyAmount,
  Skeleton,
  StatusBadge,
  Text,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { useReducedMotion, MOTION_MS } from '@/motion';
import { useTrip } from '@/data/trips';
import type { Trip } from '@/data/trips';
import { formatDay } from '@/data/search';
import { nightsLabel } from './listing-format';
import { AdapterChip, FactRow } from './book-parts';

export function BookConfirmedScreen({ bookingId }: { bookingId: string | undefined }) {
  const { trip, status, retry } = useTrip(bookingId);

  if (status === 'loading') return <ConfirmedSkeleton />;
  if (status === 'error') return <ReadFailed onRetry={retry} />;
  if (!trip) return <NotFound />;
  return <Confirmed trip={trip} />;
}

function Confirmed({ trip }: { trip: Trip }) {
  const { c, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const router = useRouter();
  const reduced = useReducedMotion();

  const pending = trip.state === 'pending_approval';

  /* ------------------------------------------------------------ the motion */

  const mark = useSharedValue(reduced ? 1 : 0.6);
  const fade = useSharedValue(0);

  useEffect(() => {
    fade.set(withTiming(1, { duration: reduced ? 1 : MOTION_MS }));
    if (reduced) {
      // Travel removed, feedback kept: the mark is simply there, at full size,
      // and the fade above is what announces it.
      mark.set(1);
      return;
    }
    // A short overshoot and settle. Scale and opacity only, so the whole
    // arrival costs no layout and no paint.
    mark.set(
      withSequence(
        withTiming(1.08, { duration: MOTION_MS * 0.55 }),
        withTiming(1, { duration: MOTION_MS * 0.45 }),
      ),
    );
  }, [fade, mark, reduced]);

  const markStyle = useAnimatedStyle(() => ({
    transform: [{ scale: mark.get() }],
    opacity: fade.get(),
  }));

  const bodyFade = useSharedValue(0);
  useEffect(() => {
    bodyFade.set(
      withDelay(reduced ? 0 : 90, withTiming(1, { duration: reduced ? 1 : MOTION_MS })),
    );
  }, [bodyFade, reduced]);
  const bodyStyle = useAnimatedStyle(() => ({ opacity: bodyFade.get() }));

  /* -------------------------------------------------------------- the page */

  const dates = `${formatDay(trip.checkInDay, t)} → ${formatDay(trip.checkOutDay, t)}`;

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 40,
          paddingHorizontal: space[4],
          paddingBottom: insets.bottom + space[4],
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ------------------------------------------------------- the mark */}
        <Animated.View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            {
              alignSelf: 'center',
              width: 72,
              height: 72,
              borderRadius: radius.pill,
              alignItems: 'center',
              justifyContent: 'center',
              // A request is not a success yet, and a green tick would say it
              // was. Warning tint plus a clock is the honest pair, and it
              // matches the badge below rather than arguing with it.
              backgroundColor: pending ? c.warning100 : c.action,
            },
            markStyle,
          ]}
        >
          <Icon
            name={pending ? 'clock' : 'check'}
            size={34}
            color={pending ? c.warning600 : c.bgApp}
          />
        </Animated.View>

        <Animated.View style={[{ flexGrow: 1 }, bodyStyle]}>
          <View style={{ height: 20 }} />

          <Text
            family="display"
            weight="semibold"
            size="2xl"
            color="textStrong"
            center
            style={{ alignSelf: 'center' }}
          >
            {pending ? t('book.requestedTitle') : t('book.confirmedTitle')}
          </Text>

          <View style={{ height: 10 }} />

          <Text size="sm" color="textMuted" center style={{ lineHeight: 22 }}>
            {pending
              ? t('book.requestedBody', { property: trip.property })
              : t('book.confirmedBody', { property: trip.property })}
          </Text>

          <View style={{ height: 18 }} />

          {/* ------------------------------------------ reference and status */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <View
              accessible
              accessibilityLabel={t('book.a11yReference', { reference: trip.id })}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                minHeight: 32,
                paddingHorizontal: 12,
                borderRadius: radius.sm,
                backgroundColor: c.surface2,
                borderWidth: 1,
                borderColor: c.borderSubtle,
              }}
            >
              <Text size="xs" color="textMuted">
                {t('book.reference')}
              </Text>
              {/* Selectable, so it can be copied from the system menu and read
                  to an agent. See the header for why there is no Copy button. */}
              <Text
                family="mono"
                weight="semibold"
                size="sm"
                color="textStrong"
                selectable
                testID="book-reference"
                style={{ letterSpacing: 0.3 }}
              >
                {trip.id}
              </Text>
            </View>

            <StatusBadge domain="booking" state={trip.state} />
          </View>

          <View style={{ height: 24 }} />

          {/* --------------------------------------------------- the facts */}
          <Card variant="flat">
            <View style={{ gap: 11 }}>
              <FactRow label={t('book.factStay')} value={trip.property} />
              {trip.roomName ? (
                <FactRow label={t('book.factRoom')} value={trip.roomName} />
              ) : null}
              <FactRow label={t('book.factDates')} value={dates} />
              <FactRow
                label={t('book.factGuests')}
                value={t('book.factParty', {
                  guests:
                    trip.guests === 1
                      ? t('search.oneGuest')
                      : t('search.guestCount', { count: trip.guests }),
                  nights: nightsLabel(trip.nights, t),
                })}
              />

              <View style={{ height: 1, backgroundColor: c.borderSubtle }} />

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                }}
              >
                <Text weight="semibold" size="sm" color="textStrong">
                  {pending ? t('book.heldInEscrow') : t('book.paidIntoEscrow')}
                </Text>
                <MoneyAmount value={trip.breakdown.grossRwf} strong tone="brand" size="md" />
              </View>
            </View>
          </Card>

          <View style={{ height: 14 }} />

          {/* ------------------------------------------------- the e-invoice */}
          <Card variant="tint">
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <Icon name="fileText" size={16} color={c.action} />
                <Text size="sm" color="textBody" style={{ flex: 1, lineHeight: 20 }}>
                  {/* F-B13, FL07 §4 step 7: the e-invoice is emitted on
                      `confirmed`. A request has not been accepted, so nothing
                      has been invoiced and the copy says when it will be. */}
                  {pending ? t('book.invoicePending') : t('book.invoiceNote')}
                </Text>
              </View>
              <AdapterChip />
            </View>
          </Card>

          <View style={{ flexGrow: 1, minHeight: space[6] }} />

          {/* --------------------------------------------------- the escapes */}
          <View style={{ gap: 10 }}>
            <Button
              variant="primary"
              size="lg"
              block
              onPress={() => router.replace({ pathname: '/trip/[id]', params: { id: trip.id } })}
            >
              {t('book.viewTrip')}
            </Button>
            <Button variant="ghost" size="lg" block onPress={() => router.replace('/')}>
              {t('book.backToExplore')}
            </Button>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

/* ------------------------------------------------------------ the states */

/**
 * The read failed. Distinct from not-found on purpose: a booking we could not
 * read is not a booking that is missing, and saying "not on this device" about
 * a failed read sends the guest looking in the wrong place (GK-16).
 */
function ReadFailed({ onRetry }: { onRetry: () => void }) {
  const { c, space } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: c.bgApp,
        paddingTop: insets.top + 56,
        paddingHorizontal: space[4],
      }}
    >
      <ErrorState
        title={t('state.errorTitle')}
        body={t('state.errorBody', { label: t('book.bookingLabel') })}
        onRetry={onRetry}
      />
    </View>
  );
}

/**
 * A confirmation whose booking is not on this device.
 *
 * Reachable: the fixture store is not persisted, so a relaunch on this route
 * finds nothing. It says so and opens Trips rather than showing an empty
 * receipt.
 */
function NotFound() {
  const { c, space } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const router = useRouter();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: c.bgApp,
        paddingTop: insets.top + 56,
        paddingHorizontal: space[4],
      }}
    >
      <EmptyState
        icon="calendar"
        title={t('book.confirmedNotFoundTitle')}
        body={t('book.confirmedNotFoundBody')}
        action={
          <Button variant="primary" onPress={() => router.replace('/trips')}>
            {t('book.confirmedNotFoundAction')}
          </Button>
        }
      />
    </View>
  );
}

function ConfirmedSkeleton() {
  const { c, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('state.loading')}
      style={{
        flex: 1,
        backgroundColor: c.bgApp,
        paddingTop: insets.top + 40,
        paddingHorizontal: space[4],
        gap: space[4],
      }}
    >
      <View style={{ alignItems: 'center', gap: space[4] }}>
        <Skeleton width={72} height={72} radius={radius.pill} />
        <Skeleton width="64%" height={28} />
        <Skeleton width="86%" height={18} />
      </View>
      <Skeleton width="100%" height={168} radius={radius.lg} />
      <Skeleton width="100%" height={96} radius={radius.lg} />
    </View>
  );
}
