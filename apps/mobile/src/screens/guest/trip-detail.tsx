/**
 * Trip detail — one booking. Guest canvas artboard 10 (`TripDetail.dc.html`,
 * `tripDetail` in `screens-b.mjs`).
 *
 * The artboard's order is kept exactly: photograph, name and district, the
 * facts card, Price, then Arrival guide. Three blocks are added between the
 * price and the guide, and each is here because the prompt asks for it and the
 * artboard drew a stand-in instead:
 *
 *   - **Your host**, which opens the booking's thread. ADR-032 writes exactly
 *     one thread per booking in the same transaction as the booking, so the row
 *     is never dead — and it goes read-only when the booking reaches a terminal
 *     status, which is that ADR's own rule rather than a UI choice.
 *   - **Getting there**, with the address and a button into the platform maps
 *     app. The coordinates lead and the property name is the pin's label; a
 *     search by name finds whatever the map provider thinks that name is.
 *   - **The arrival-guide gate**, which is the artboard's card generalised.
 *     The artboard draws one locked state; `checkInGate` has six answers and
 *     this draws whichever applies, so a staffed property says the desk will
 *     check you in rather than offering a button that would fail.
 *
 * **The screen never reads `trip.arrival`.** It calls `arrivalGuideFor`, which
 * returns `undefined` until the stay is open (F-B18). That is the difference
 * between a gate and a hidden field.
 */
import { View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Badge,
  BackHeader,
  Button,
  Card,
  DomainBadge,
  EmptyState,
  ErrorState,
  Icon,
  ImageHeader,
  ListRow,
  MoneyBreakdown,
  PressableScale,
  SectionLabel,
  SkeletonList,
  StatusBadge,
  Text,
  useToast,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT, type Translate } from '@/i18n/i18n';
import { arrivalGuideFor, checkInGate, reviewWindowOpen, useTrip, type Trip } from '@/data/trips';
import { useTripReviews } from '@/data/trip-reviews';
import { checkInText, checkOutText, gateCopy, tripDateLine } from './trip-format';
import { openDirections } from './trip-platform';
import { useNow } from './trip-clock';

export function TripDetail({ id }: { id: string | undefined }) {
  const { c, space } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const router = useRouter();
  const toast = useToast();

  const { trip, status, error, retry } = useTrip(id);
  const { reviewFor } = useTripReviews();
  const now = useNow();

  if (status === 'loading') return <Loading />;
  if (status === 'error') {
    return (
      <Shell>
        <ErrorState
          title={t('state.errorTitle')}
          body={t('state.errorBody', { label: t('trips.listLabel') })}
          detail={error?.message}
          onRetry={retry}
        />
      </Shell>
    );
  }
  if (!trip) {
    return (
      <Shell>
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
      </Shell>
    );
  }

  const gate = checkInGate(trip, now);
  const copy = gateCopy(gate);
  const guide = arrivalGuideFor(trip, now);
  // ADR-032: a thread goes archived, permanently, on a terminal booking.
  const archived = trip.state === 'completed' || trip.state === 'cancelled';

  const directions = async () => {
    const opened = await openDirections({
      lat: trip.coords.lat,
      lng: trip.coords.lng,
      label: trip.property,
    });
    if (!opened) toast.show(t('trip.directionsFailed'), 'warning');
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + space[8] }}
        showsVerticalScrollIndicator={false}
      >
        <ImageHeader
          stem={trip.photo}
          height={220}
          right={<DomainBadge domain="hospitality" solid />}
        />

        <View style={{ padding: space[4], gap: space[4] }}>
          <View style={{ gap: 8 }}>
            <Text family="display" weight="semibold" size="xl" color="textStrong">
              {trip.property}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="mapPin" size={15} color={c.textMuted} />
              <Text size="sm" color="textMuted" style={{ flex: 1 }}>
                {trip.location}
              </Text>
              <StatusBadge domain="booking" state={trip.state} />
            </View>
          </View>

          <SectionLabel>{t('trip.stay')}</SectionLabel>
          <Card>
            <View style={{ gap: 11 }}>
              <Row label={t('trip.checkIn')} value={checkInText(trip, t)} />
              <Row label={t('trip.checkOut')} value={checkOutText(trip, t)} />
              <Row
                label={t('trip.guests')}
                value={
                  trip.guests === 1
                    ? t('trip.oneGuest')
                    : t('trip.guestsCount', { count: trip.guests })
                }
              />
              <Row label={t('trip.confirmation')} value={trip.confirmation} mono />
            </View>
          </Card>

          <SectionLabel>{t('trip.price')}</SectionLabel>
          <Card>
            <View style={{ gap: space[3] }}>
              <MoneyBreakdown
                items={[
                  {
                    label: t('trip.nightlyRate'),
                    sub: tripDateLine(trip, t),
                    value: trip.breakdown.accommodationRwf,
                  },
                  { label: t('trip.serviceAndTaxes'), value: trip.fees, muted: true },
                ]}
                total={{ label: t('trip.totalPaid'), value: trip.total }}
              />
              {/* The adapter mode is rendered inline wherever money is, per the
                  canvas rule (§4.3): the guest is told the payment was mocked
                  here rather than discovering it at the desk. */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                <Badge tone="warning" dot>
                  {t('trip.mockAdapter')}
                </Badge>
                <Text size="xs" color="textMuted" style={{ flex: 1, lineHeight: 17 }}>
                  {t('trip.mockAdapterNote')}
                </Text>
              </View>
            </View>
          </Card>

          <SectionLabel>{t('trip.host')}</SectionLabel>
          <Card variant="flat" bodyStyle={{ paddingVertical: 6 }}>
            <ListRow
              title={trip.host.name}
              subtitle={archived ? t('trip.threadArchived') : t('trip.threadActive')}
              avatar={trip.host.initials}
              accessibilityLabel={t('trip.messageHost', { host: trip.host.name })}
              accessibilityHint={t('trip.messageHostHint')}
              onPress={() =>
                router.push({
                  pathname: '/thread/[threadId]',
                  params: { threadId: trip.host.threadId },
                })
              }
            />
          </Card>

          {/* ADR-050 slice 1. Offered only while the guest is checked in, which is
              when a room can be charged; the server decides the rest, and an
              outlet that is closed or sold out is simply not on the next screen. */}
          {trip.state === 'checked_in' ? (
            <>
              <SectionLabel>{t('order.title')}</SectionLabel>
              <Card variant="flat" bodyStyle={{ paddingVertical: 6 }}>
                <ListRow
                  title={t('order.title')}
                  subtitle={t('order.subtitle', { property: trip.property })}
                  icon="bell"
                  chevron
                  onPress={() => router.push('/order')}
                />
              </Card>
            </>
          ) : null}

          <SectionLabel>{t('trip.gettingThere')}</SectionLabel>
          <Card>
            <View style={{ gap: space[3] }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[3] }}>
                <Icon name="mapPin" size={17} color={c.textMuted} />
                <Text size="sm" color="textBody" style={{ flex: 1, lineHeight: 20 }}>
                  {trip.address}
                </Text>
              </View>
              <Button
                variant="outline"
                size="md"
                block
                leadingIcon="navigation"
                accessibilityLabel={t('trip.getDirections')}
                onPress={() => void directions()}
              >
                {t('trip.getDirections')}
              </Button>
              <Text size="xs" color="textMuted" style={{ lineHeight: 17 }}>
                {t('trip.directionsHint', { property: trip.property })}
              </Text>
            </View>
          </Card>

          <SectionLabel>{t('trip.arrival')}</SectionLabel>
          <Card variant="tint">
            <View style={{ gap: space[3] }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <Icon name={guide ? 'unlock' : 'lock'} size={17} color={c.brand700} />
                <Text size="sm" color="brand900" style={{ flex: 1, lineHeight: 20 }}>
                  {t(copy.bodyKey)}
                </Text>
              </View>

              {copy.ctaKey ? (
                <Button
                  variant="primary"
                  size="lg"
                  block
                  leadingIcon={gate.kind === 'open' ? 'key' : 'check'}
                  onPress={() =>
                    gate.kind === 'open'
                      ? router.push({
                          pathname: '/trip/[id]/arrival-guide',
                          params: { id: trip.id },
                        })
                      : // On the BOOKING id, not a stay id: a stay does not
                        // exist until someone arrives, which is the rule
                        // `ops/stays/:id/checkin` already follows.
                        router.push(`/self-check-in/${trip.id}`)
                  }
                >
                  {t(copy.ctaKey)}
                </Button>
              ) : null}

              {/* The link appears only where the sheet would actually open:
                  inside F-B14's 14-day window and with no review already in.
                  A row that led to a refusal is the orphaned control again. */}
              {reviewWindowOpen(trip, now) && !reviewFor(trip.id) ? (
                <ReviewLink trip={trip} t={t} />
              ) : null}
            </View>
          </Card>
        </View>
      </ScrollView>

      <BackHeader overlay />
    </View>
  );

  function Shell({ children }: { children: React.ReactNode }) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bgApp }}>
        <View style={{ paddingTop: insets.top + 44, paddingHorizontal: space[4] }}>{children}</View>
        <BackHeader overlay />
      </View>
    );
  }

  function Loading() {
    return (
      <View style={{ flex: 1, backgroundColor: c.bgApp }}>
        <View style={{ paddingTop: insets.top + 44, paddingHorizontal: space[4] }}>
          <SkeletonList rows={3} label={t('state.loadingList', { label: t('trips.listLabel') })} />
        </View>
        <BackHeader overlay />
      </View>
    );
  }
}

/** The way into the review sheet from the detail screen, once a stay is over. */
function ReviewLink({ trip, t }: { trip: Trip; t: Translate }) {
  const { c, space, radius } = useTheme();
  const router = useRouter();

  return (
    <PressableScale
      accessibilityLabel={t('trips.leaveReview')}
      accessibilityHint={t('trips.reviewPrompt', { property: trip.property })}
      haptic
      onPress={() => router.push({ pathname: '/trip/[id]/review', params: { id: trip.id } })}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[2],
        minHeight: 44,
        paddingHorizontal: space[3],
        borderRadius: radius.md,
        backgroundColor: c.surface1,
        borderWidth: 1,
        borderColor: c.borderDefault,
      }}
    >
      <Icon name="star" size={16} color={c.brand700} />
      <Text weight="semibold" size="sm" color="textStrong" style={{ flex: 1 }}>
        {t('trips.leaveReview')}
      </Text>
      <Icon name="chevronRight" size={17} color={c.textSubtle} />
    </PressableScale>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 16,
      }}
    >
      <Text size="sm" color="textMuted">
        {label}
      </Text>
      <Text
        family={mono ? 'mono' : 'body'}
        weight="medium"
        size="sm"
        color="textStrong"
        style={{ flexShrink: 1, textAlign: 'right' }}
      >
        {value}
      </Text>
    </View>
  );
}
