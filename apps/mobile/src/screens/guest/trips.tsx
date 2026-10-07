/**
 * Trips — the Guest's bookings and stays. Guest canvas artboard 9 (`Trips.dc.html`,
 * `TripsDark.dc.html`, `trips` in `screens-b.mjs`), with the hero the artboard
 * does not draw and this session's prompt asks for.
 *
 * ## The four states, and why each is real code
 *
 * `useTrips` returns the shape the API read will return, so none of these is a
 * branch added at the end:
 *
 *   - **loading** is the cold-read skeleton `Screen.List` draws in the empty
 *     slot. Warm reads skip it, exactly as a query cache does.
 *   - **empty** is per segment. "No trips booked" and "no past trips" are
 *     different facts and one message covering both is the misleading zero
 *     `ui-screens.md` §6 rules out. The upcoming one carries a way out —
 *     Explore — because an empty upcoming list is a person with nothing booked,
 *     not a person who filtered too hard.
 *   - **error** is `ErrorState` with `retry` wired to the read. It is reachable
 *     only by the read throwing, which fixtures do not do; it is written as
 *     live code rather than as a comment so that the day `useTrips` becomes
 *     `useQuery` the branch is already correct. `explore.tsx` made the same
 *     call for the same reason.
 *   - **offline** is a state, not an error (frames.md). The shell's banner says
 *     the connection is gone; this adds the note that the list is the last one
 *     that loaded, and neither blocks anything.
 *
 * ## One clock, on the hero
 *
 * Only the hero ticks, through its own `useNow`. The rows used to read the
 * time too, to count down the review window; that row is gone (below), so the
 * list no longer runs a clock of its own.
 *
 * ## No way into reviews
 *
 * Reviews are hidden in the v1.0 cut and `trip/[id]/review` is closed for
 * everyone, so pushing it bounces the guest home. The row that opened it is
 * gone from the cards (mobile audit 2026-10-05, GK-11).
 */
import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Button,
  EmptyState,
  ErrorState,
  Icon,
  Screen,
  SectionLabel,
  SegmentedTabs,
  Text,
  useOffline,
  WorkspaceChip,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useDomain } from '@/domain';
import { useT } from '@/i18n/i18n';
import { pastTrips, upcomingTrips, useTrips, type Trip } from '@/data/trips';
import { TripCard } from './trip-card';
import { TripHeroCard } from './trip-hero-card';

type Segment = 'upcoming' | 'past';

export function Trips() {
  const { c, space } = useTheme();
  const router = useRouter();
  const t = useT();
  const { workspace } = useDomain();

  const [segment, setSegment] = useState<Segment>('upcoming');
  const trips = useTrips();

  const all = trips.data ?? [];
  const upcoming = upcomingTrips(all);
  const past = pastTrips(all);

  // The hero is the soonest stay still ahead, and it is lifted OUT of the rows
  // rather than repeated in them: a card that appears twice on one screen is a
  // card a reader taps twice looking for the difference.
  const hero = segment === 'upcoming' ? upcoming[0] : undefined;
  const rows = segment === 'upcoming' ? upcoming.slice(hero ? 1 : 0) : past;

  const offline = useOffline();

  const openTrip = (trip: Trip) =>
    router.push({ pathname: '/trip/[id]', params: { id: trip.id } });

  return (
    <Screen.List<Trip>
      greeting={t('trips.greeting')}
      title={t('trips.title')}
      action={
        <WorkspaceChip
          name={workspace.name}
          role={workspace.role}
          onPress={() => router.push('/switch')}
        />
      }
      header={
        <>
          {offline ? <OfflineNote /> : null}

          {/* The pair is what carries the "one of these two" meaning;
              `SegmentedTabs` reports each tab and cannot name the group. */}
          <View accessibilityRole="tablist" accessibilityLabel={t('trips.title')}>
            {/* No counts until the list has loaded: "Upcoming 0" while the
                read is in flight is a misleading zero (mobile audit
                2026-10-05, GK-23). */}
            <SegmentedTabs
              items={[
                {
                  value: 'upcoming',
                  label: t('trips.tabUpcoming'),
                  count: trips.data ? upcoming.length : undefined,
                },
                {
                  value: 'past',
                  label: t('trips.tabPast'),
                  count: trips.data ? past.length : undefined,
                },
              ]}
              value={segment}
              onChange={(next) => setSegment(next as Segment)}
            />
          </View>

          {hero ? (
            <TripHeroCard
              trip={hero}
              onOpen={() => openTrip(hero)}
              onCheckIn={() => router.push(`/self-check-in/${hero.id}`)}
              onArrivalGuide={() =>
                router.push({ pathname: '/trip/[id]/arrival-guide', params: { id: hero.id } })
              }
            />
          ) : null}

          {/* The label only appears when there is something under it. A section
              heading over an empty slot is a heading that lies. */}
          {rows.length > 0 ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: space[2],
              }}
            >
              <SectionLabel>
                {segment === 'upcoming' ? t('trips.sectionUpcoming') : t('trips.sectionPast')}
              </SectionLabel>
              {segment === 'upcoming' ? (
                <Text size="xs" color="textMuted">
                  {rows.length === 1
                    ? t('trips.onePlanned')
                    : t('trips.morePlanned', { count: rows.length })}
                </Text>
              ) : null}
            </View>
          ) : null}
        </>
      }
      data={rows}
      keyExtractor={(trip) => trip.id}
      renderItem={({ item }) => (
        <TripCard trip={item} onPress={() => openTrip(item)} />
      )}
      loading={trips.status === 'loading'}
      loadingLabel={t('state.loadingList', { label: t('trips.listLabel') })}
      loadingRows={2}
      empty={emptySlot()}
    />
  );

  /**
   * What sits where the rows would be. `null` on the upcoming segment when the
   * hero is drawn and nothing else is booked — the screen is not empty then,
   * and an empty state under a hero would be a contradiction on one page.
   */
  function emptySlot() {
    if (trips.status === 'error') {
      return (
        // No raw server text as the detail (GB-27).
        <ErrorState
          title={t('state.errorTitle')}
          body={t('state.errorBody', { label: t('trips.listLabel') })}
          onRetry={trips.retry}
        />
      );
    }
    if (trips.status === 'loading') return null;
    if (segment === 'upcoming') {
      if (hero) return null;
      return (
        <EmptyState
          icon="calendar"
          title={t('trips.emptyUpcomingTitle')}
          body={t('trips.emptyUpcomingBody')}
          action={
            <Button variant="outline" size="md" onPress={() => router.push('/')}>
              {t('trips.emptyUpcomingAction')}
            </Button>
          }
        />
      );
    }
    return (
      <EmptyState
        icon="calendar"
        title={t('trips.emptyPastTitle')}
        body={t('trips.emptyPastBody')}
        // The action an empty state owes is a way SOMEWHERE, not a way to
        // conjure a row. Nothing fills a history of past stays except taking
        // one, so this points at where a stay is found.
        action={
          <Button
            variant="outline"
            size="sm"
            onPress={() => router.push('/')}
            accessibilityLabel={t('state.emptyGoTo', { tab: t('nav.explore') })}
          >
            {t('state.emptyGoTo', { tab: t('nav.explore') })}
          </Button>
        }
      />
    );
  }

  function OfflineNote() {
    return (
      <View
        accessible
        accessibilityRole="summary"
        accessibilityLabel={t('state.offlineLastList')}
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: space[2],
          padding: space[3],
          borderRadius: 10,
          backgroundColor: c.warning100,
        }}
      >
        <Icon name="wifiOff" size={16} color={c.warning600} />
        <Text size="xs" color="textBody" style={{ flex: 1, lineHeight: 18 }}>
          {t('state.offlineLastList')}
        </Text>
      </View>
    );
  }
}
