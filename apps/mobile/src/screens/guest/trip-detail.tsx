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
 *
 * ## Mobile audit 2026-10-05
 *
 *   - **No review link** (GK-11): reviews are hidden in v1 and the route is
 *     closed, so the link bounced the guest home.
 *   - **No reply-time promise under the host** (GK-26): "Usually answers within
 *     an hour" was the same sentence on every trip, from no data.
 *   - **The price lines say what they are** (GK-15): the accommodation total
 *     was labelled "Nightly rate", the guest service fee "Service and taxes",
 *     and a non-refundable discount was left out, so the lines did not add up
 *     to "Total paid". They now read from `trip.breakdown`, line for line.
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
  SectionLabel,
  SkeletonList,
  StatusBadge,
  Text,
  useToast,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { arrivalGuideFor, checkInGate, useTrip } from '@/data/trips';
import { checkInText, checkOutText, gateCopy, tripDateLine } from './trip-format';
import { openDirections } from './trip-platform';
import { useNow } from './trip-clock';

export function TripDetail({ id }: { id: string | undefined }) {
  const { c, space } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const router = useRouter();
  const toast = useToast();

  const { trip, status, retry } = useTrip(id);
  const now = useNow();

  if (status === 'loading') return <Loading />;
  if (status === 'error') {
    return (
      <Shell>
        {/* No raw server text as the detail (GB-27). */}
        <ErrorState
          title={t('state.errorTitle')}
          body={t('state.errorBody', { label: t('trips.listLabel') })}
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
              {/* The booking's own lines, in the booking stepper's words, so
                  they add up to the total on every booking (GK-15). */}
              <MoneyBreakdown
                items={[
                  {
                    label: t('book.accommodation'),
                    sub: tripDateLine(trip, t),
                    value: trip.breakdown.accommodationRwf,
                  },
                  ...(trip.breakdown.nonRefundableDiscountRwf > 0
                    ? [
                        {
                          label: t('book.discount'),
                          value: -trip.breakdown.nonRefundableDiscountRwf,
                        },
                      ]
                    : []),
                  { label: t('book.fee'), value: trip.breakdown.serviceFeeRwf, muted: true },
                ]}
                total={{ label: t('trip.totalPaid'), value: trip.breakdown.grossRwf }}
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
            {/* No reply-time line under an open thread: nothing measures it
                (GK-26). An ended booking still says its thread is read-only. */}
            <ListRow
              title={trip.host.name}
              subtitle={archived ? t('trip.threadArchived') : undefined}
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
