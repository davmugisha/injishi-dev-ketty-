/**
 * Bookings — the whole book, with search and the state chips.
 *
 * Today answers "what needs me now"; this answers "where is that one". They are
 * different questions and the difference is why this screen has a search field
 * and Today does not: a desk searching is looking for a booking whose state it
 * does not know, which is exactly when a bucketed view is no help.
 *
 * ## Two things the operator app does that this deliberately does not
 *
 * **It drops declined rows.** `reservations.tsx` filters `declined` out of
 * every bucket, which is right for a desk whose database it can query when it
 * needs one. A phone prototype has only the array in `host-fixtures.ts`, and a
 * decline that erased its own evidence would make the decline path
 * untestable — the guest would simply vanish, which is also the one behaviour
 * that reads as data loss rather than as a filter. So there is a `Declined`
 * chip and the rows survive under it.
 *
 * **It has no search box at all.** The web desk has columns and a screenful of
 * rows; a phone showing four rows at a time needs one, so this adds it. It
 * looks at the guest, the reference and the room and nothing else — the three
 * things a person at a desk actually has to hand.
 *
 * ## The states
 *
 * `Screen.List` over `FlashList`, because this list grows with real inventory
 * and is the case the scaffold's own note names. Loading is its skeleton, the
 * error branch has a retry, and every empty state names the chip that emptied
 * it — with a separate one for a search that matched nothing, because "no
 * bookings" and "nothing matches Uwase" are different facts.
 */
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Button,
  EmptyState,
  ErrorState,
  Icon,
  InputField,
  OfflineNote,
  PressableScale,
  Screen,
  Text,
  useOffline,
} from '@/components';
import { todayIso } from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { useNow } from '@/screens/guest/trip-clock';
import { useHostBookings } from './host-store';
import {
  BOOKING_FILTERS,
  FILTER_EMPTY,
  FILTER_LABEL,
  filterBookings,
  filterCounts,
  type BookingFilter,
} from './host-format';
import { CountChips } from './host-chrome';
import { HostBookingRow } from './host-booking-row';

export function HostBookingsScreen() {
  const t = useT();
  const { c, space } = useTheme();
  const router = useRouter();

  const { rows, status, error, retry } = useHostBookings();
  const now = useNow();
  const today = todayIso();
  const offline = useOffline();

  const [filter, setFilter] = useState<BookingFilter>('all');
  const [query, setQuery] = useState('');

  const shown = useMemo(
    () => filterBookings(rows, filter, query, today),
    [rows, filter, query, today],
  );
  const counts = useMemo(() => filterCounts(rows, query, today), [rows, query, today]);

  if (status === 'error') {
    return (
      <Screen title={t('host.bookings')} greeting={t('host.bookingsGreeting')}>
        <ErrorState
          title={t('host.errorTitle')}
          body={t('host.errorBody')}
          detail={error?.message}
          onRetry={retry}
        />
      </Screen>
    );
  }

  const searching = query.trim().length > 0;

  return (
    <Screen.List
      title={t('host.bookings')}
      greeting={t('host.bookingsGreeting')}
      data={shown}
      keyExtractor={(booking) => booking.id}
      loading={status === 'loading'}
      loadingLabel={t('state.loadingList', { label: t('host.listLabel') })}
      loadingRows={5}
      header={
        <View style={{ gap: space[3] }}>
          <InputField
            label={t('host.searchLabel')}
            value={query}
            onChangeText={setQuery}
            placeholder={t('host.searchPlaceholder')}
            autoCapitalize="none"
            testID="host-search"
            suffix={
              searching ? (
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={t('host.clearSearch')}
                  onPress={() => setQuery('')}
                  hitSlop={10}
                  style={{ padding: 4 }}
                >
                  <Icon name="xCircle" size={17} color={c.textMuted} />
                </PressableScale>
              ) : undefined
            }
          />

          <CountChips
            value={filter}
            onChange={(id) => setFilter(id as BookingFilter)}
            items={BOOKING_FILTERS.map((id) => ({
              id,
              label: t(FILTER_LABEL[id]),
              count: counts[id],
            }))}
          />

          {shown.length > 0 ? (
            <Text size="xs" color="textSubtle">
              {shown.length === 1
                ? t('host.resultOne')
                : t('host.resultCount', { count: shown.length })}
            </Text>
          ) : null}

          {/* The shell mounts `OfflineBanner` once in `app/_layout.tsx`; what
              this screen owes is the sentence saying what offline means for
              the bookings under it, and Today carries the same line. Only
              while offline: it used to sit here on a working connection, and
              it promised that every decision was kept and sent on, when only
              a check-in is (mobile audit 2026-10-05, HO-10). */}
          {offline ? <OfflineNote label={t('host.offlineNote')} /> : null}
        </View>
      }
      empty={
        searching ? (
          <EmptyState
            icon="search"
            title={t('host.emptySearch', { query: query.trim() })}
            body={t('host.emptySearchBody')}
            action={
              <Button variant="outline" size="md" onPress={() => setQuery('')}>
                {t('host.clearSearch')}
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon="calendar"
            title={t(FILTER_LABEL[filter])}
            body={t(FILTER_EMPTY[filter])}
            action={
              filter === 'all' ? undefined : (
                <Button variant="outline" size="md" onPress={() => setFilter('all')}>
                  {t('host.filterAll')}
                </Button>
              )
            }
          />
        )
      }
      renderItem={({ item }) => (
        <HostBookingRow
          booking={item}
          today={today}
          now={now}
          cell="plain"
          onOpen={() => router.push({ pathname: '/reservation/[id]', params: { id: item.id } })}
        />
      )}
    />
  );
}
