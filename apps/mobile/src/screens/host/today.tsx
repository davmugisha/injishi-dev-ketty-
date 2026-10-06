/**
 * Today — the Host home, and the compact phone view of the front desk.
 *
 * Optional Session A. The canvas draws no Host frame (decision D5), so the
 * shape is the operator app's `today.tsx` reduced to what a phone can hold: the
 * four groups a desk works in the morning, the counts that are also the filter,
 * and one decision per row.
 *
 * ## What this screen is for, and what it deliberately is not
 *
 * It is the list of things that need a person TODAY. It is not the book — that
 * is the Bookings tab, which has search and every state. So a booking confirmed
 * for next week appears on neither of the four groups here, and the empty state
 * says where it went rather than leaving the reader to wonder.
 *
 * ## The two decisions worth reading
 *
 * **Approve and decline are one tap and an undo, not a confirm.** F-B06 asks
 * for a decision in under two seconds and a desk answers requests in batches.
 * A confirm dialog on each would double every tap for a decision that is
 * reversible for as long as the toast is up. Decline is the exception and does
 * get a sheet — not to confirm it, but because a decline needs a REASON, and
 * asking for it afterwards would be asking after the guest has been told.
 *
 * **Expiry is checked when the tap lands, not when the row is drawn.** FL08
 * path C: a request that auto-declined a second ago has already been refunded,
 * so approving it would confirm a booking whose money has gone back. The guard
 * lives in `decisionBlocked`, which the row and the detail screen both call, so
 * the two can never disagree about whether a decision is still open.
 */
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  MoneyAmount,
  OfflineNote,
  PressableScale,
  Screen,
  SkeletonList,
  Text,
  type UndoState,
  UndoBar,
  useToast,
} from '@/components';
import { todayIso } from '@/components';
import { useTheme } from '@/theme/theme';
import { useDomain } from '@/domain';
import { useT, type Translate } from '@/i18n/i18n';
import { useNow } from '@/screens/guest/trip-clock';
import { formatDay } from '@/data/search';
import type { HostBooking, HostPayout } from './host-fixtures';
import {
  decisionBlocked,
  useHostActions,
  useHostBookings,
  useHostPayouts,
} from './host-store';
import {
  GROUP_EMPTY,
  GROUP_LABEL,
  TODAY_GROUPS,
  bufferNote,
  groupForToday,
  todayCount,
  type TodayGroup,
} from './host-format';
import { AdapterNote, CountChips, HostSection, WebDeskNote } from './host-chrome';
import { HostBookingRow } from './host-booking-row';
import { DeclineSheet } from './decline-sheet';
import { CheckOutSheet } from './check-out-sheet';
import { PayoutsSheet } from './payouts-sheet';

/** Which reading the middle cell of a row takes, per group. */
const CELL: Record<TodayGroup, 'request' | 'arrival' | 'departure' | 'in_house'> = {
  awaiting: 'request',
  arriving: 'arrival',
  departing: 'departure',
  in_house: 'in_house',
};

export function HostToday() {
  const t = useT();
  const { space } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { workspace } = useDomain();

  const { rows, status, error, retry } = useHostBookings();
  const payouts = useHostPayouts();
  const actions = useHostActions();
  const now = useNow();
  const today = todayIso();

  const [filter, setFilter] = useState<'all' | TodayGroup>('all');
  const [declining, setDeclining] = useState<HostBooking | null>(null);
  const [checkingOut, setCheckingOut] = useState<HostBooking | null>(null);
  const [payoutsOpen, setPayoutsOpen] = useState(false);
  const [undo, setUndo] = useState<UndoState | null>(null);
  const clearUndo = useCallback(() => setUndo(null), []);

  const groups = useMemo(() => groupForToday(rows, today), [rows, today]);
  const total = todayCount(groups);

  /* ------------------------------------------------------------ the decisions */

  /**
   * The toast that follows an approve or a decline carries the row as it was,
   * so Undo is a restore rather than a second guess at the inverse transition.
   * An inverse would have to know that declining set two money fields; the row
   * itself simply knows.
   */
  const decide = useCallback(
    async (booking: HostBooking, kind: 'approve' | 'decline', note = '') => {
      const blocked = decisionBlocked(booking, Date.now());
      if (blocked) {
        toast.show(blocked === 'expired' ? t('host.staleBody') : t('host.staleResolved'), 'warning');
        return;
      }

      const before = booking;
      const outcome =
        kind === 'approve'
          ? await actions.approve(booking.id)
          : await actions.decline(booking.id, note);

      // Branch on how THIS write ended, never on a flag from the render that
      // pressed the button: the toast and its undo used to follow every tap,
      // saved or not (mobile audit 2026-10-05, HO-06). `cancelled` changed
      // nothing and says nothing.
      if (outcome === 'offline') {
        toast.show(t('host.needsConnectionDecision'), 'warning');
        return;
      }
      if (outcome === 'error') {
        toast.show(
          t(kind === 'approve' ? 'host.approveFailed' : 'host.declineFailed', {
            guest: booking.guest.name,
          }),
          'danger',
        );
        return;
      }
      if (outcome !== 'done') return;

      setUndo({
        text:
          kind === 'approve'
            ? t('host.approvedToast', { guest: booking.guest.name })
            : t('host.declinedToast', { guest: booking.guest.name }),
        onUndo: () => {
          void actions.restore(before).then((undone) => {
            if (undone === 'done') {
              toast.show(t('host.undoneToast', { guest: before.guest.name }), 'neutral');
            } else if (undone === 'error') {
              toast.show(t('host.undoFailed'), 'danger');
            }
          });
        },
      });
    },
    [actions, t, toast],
  );

  /* --------------------------------------------------------------- the states */

  if (status === 'loading') {
    return (
      <Screen title={t('host.today')} greeting={t('host.todayGreeting')}>
        <SkeletonList rows={4} label={t('state.loadingList', { label: t('host.today') })} />
      </Screen>
    );
  }

  if (status === 'error') {
    return (
      <Screen title={t('host.today')} greeting={t('host.todayGreeting')}>
        <ErrorState
          title={t('host.errorTitle')}
          body={t('host.errorBody')}
          detail={error?.message}
          onRetry={retry}
        />
      </Screen>
    );
  }

  const shown = filter === 'all' ? TODAY_GROUPS : ([filter] as readonly TodayGroup[]);

  return (
    <>
      <Screen title={t('host.today')} greeting={t('host.todayGreeting')}>
        {/* ------------------------------------------------------- the date line */}
        {/* The date alone. A time-zone id under it ("Africa/Kigali") is a
            developer's label, not something a desk reads (mobile audit HO-16). */}
        <View style={{ gap: space[2] }}>
          <Text size="sm" color="textMuted">
            {formatDay(today, t)}
          </Text>
          <Text size="sm" color="textSubtle">
            {t('host.desk', { property: workspace.name })}
          </Text>
        </View>

        {/* The shell mounts `OfflineBanner` once in `app/_layout.tsx`, so this
            screen owes only the sentence that says what offline means HERE:
            a check-in is kept and sent on, and the three decisions that move
            money are refused until the connection is back (mobile audit
            HO-10). Above the rows, because it is the reason their Approve,
            Decline and Check out are disabled, and only while offline: it
            used to say "showing the last list" on a working connection. */}
        {actions.offline ? <OfflineNote label={t('host.offlineNote')} /> : null}

        <CountChips
          value={filter}
          onChange={(id) => setFilter(id as 'all' | TodayGroup)}
          items={[
            { id: 'all', label: t('host.countAll'), count: total },
            { id: 'awaiting', label: t('host.countRequests'), count: groups.awaiting.length },
            { id: 'arriving', label: t('host.countArriving'), count: groups.arriving.length },
            { id: 'departing', label: t('host.countDeparting'), count: groups.departing.length },
            { id: 'in_house', label: t('host.countInHouse'), count: groups.in_house.length },
          ]}
        />

        {/* ------------------------------------------------------- nothing at all */}
        {total === 0 ? (
          <EmptyState
            icon="sun"
            title={t('host.emptyToday')}
            body={t('host.emptyTodayBody')}
            action={
              <Button variant="outline" size="md" onPress={() => router.push('/reservations')}>
                {t('host.emptyTodayAction')}
              </Button>
            }
          />
        ) : null}

        {/* ---------------------------------------------------------- the groups */}
        {shown.map((group) => (
          <HostSection
            key={group}
            title={t(GROUP_LABEL[group])}
            count={groups[group].length}
            empty={t(GROUP_EMPTY[group])}
          >
            {groups[group].map((booking) => (
              <HostBookingRow
                key={booking.id}
                booking={booking}
                today={today}
                now={now}
                cell={CELL[group]}
                onOpen={() =>
                  router.push({ pathname: '/reservation/[id]', params: { id: booking.id } })
                }
                actions={rowActions({
                  booking,
                  group,
                  t,
                  saving: actions.saving,
                  offline: actions.offline,
                  onApprove: () => void decide(booking, 'approve'),
                  onDecline: () => setDeclining(booking),
                  onCheckIn: () =>
                    router.push({
                      pathname: '/reservation/[id]/check-in',
                      params: { id: booking.id },
                    }),
                  onCheckOut: () => setCheckingOut(booking),
                  onBill: () =>
                    router.push({ pathname: '/reservation/[id]', params: { id: booking.id } }),
                })}
              />
            ))}
          </HostSection>
        ))}

        {/* --------------------------------------------------------- the payouts */}
        <PayoutRow onOpen={() => setPayoutsOpen(true)} now={now} payouts={payouts.rows} />

        {/* ------------------------------------------- what a phone does not carry */}
        <WebDeskNote
          icon="grid"
          title={t('host.tapeChartTitle')}
          body={t('host.tapeChartBody')}
        />
        <WebDeskNote icon="fileText" title={t('host.walkInTitle')} body={t('host.walkInBody')} />

        <AdapterNote />
      </Screen>

      <UndoBar state={undo} onDismiss={clearUndo} actionLabel={t('host.undo')} />

      <DeclineSheet
        booking={declining}
        onClose={() => setDeclining(null)}
        onDeclined={(booking, note) => {
          setDeclining(null);
          void decide(booking, 'decline', note);
        }}
      />

      <CheckOutSheet booking={checkingOut} onClose={() => setCheckingOut(null)} />

      <PayoutsSheet
        open={payoutsOpen}
        payouts={payouts.rows}
        now={now}
        onClose={() => setPayoutsOpen(false)}
      />
    </>
  );
}

/* ------------------------------------------------------------- the row actions */

/**
 * Which buttons a row carries, by group.
 *
 * One primary per row and the escape beside it, which is the canvas's
 * cross-cutting rule for every surface in the pack. A departure is the one row
 * with two, and even there only one of them changes anything.
 *
 * `offline` disables the three that move money (approve, decline, check out)
 * and leaves check-in alone, which is the one write that queues. The reason is
 * the offline note above the groups (mobile audit 2026-10-05, HO-10).
 */
function rowActions({
  booking,
  group,
  t,
  saving,
  offline,
  onApprove,
  onDecline,
  onCheckIn,
  onCheckOut,
  onBill,
}: {
  booking: HostBooking;
  group: TodayGroup;
  t: Translate;
  saving: boolean;
  offline: boolean;
  onApprove: () => void;
  onDecline: () => void;
  onCheckIn: () => void;
  onCheckOut: () => void;
  onBill: () => void;
}) {
  if (group === 'awaiting') {
    return (
      <>
        <Button variant="ghost" size="md" disabled={saving || offline} onPress={onDecline}>
          {t('host.decline')}
        </Button>
        <Button variant="primary" size="md" disabled={saving || offline} onPress={onApprove}>
          {t('host.approve')}
        </Button>
      </>
    );
  }

  if (group === 'arriving') {
    return (
      <Button variant="primary" size="md" leadingIcon="key" disabled={saving} onPress={onCheckIn}>
        {t('host.checkIn')}
      </Button>
    );
  }

  if (group === 'departing') {
    return (
      <>
        <Button variant="ghost" size="md" onPress={onBill}>
          {t('host.viewBill')}
        </Button>
        <Button variant="primary" size="md" disabled={saving || offline} onPress={onCheckOut}>
          {t('host.checkOut')}
        </Button>
      </>
    );
  }

  // In house: nothing to decide tonight, so the only control is the one that
  // opens the booking — and the row body already is that. A button that just
  // repeated the row's own tap would be the orphaned control the quality bar
  // rules out.
  return booking.balanceRwf > 0 ? (
    <Button variant="ghost" size="md" onPress={onBill}>
      {t('host.viewBill')}
    </Button>
  ) : undefined;
}

/* ----------------------------------------------------------------- the payouts */

/**
 * The next payout and its dispute buffer, as one row on Today.
 *
 * It is here rather than on Account because it is the one piece of money a host
 * checks daily, and because checkout is what starts its clock on the server.
 * A checkout made on this phone creates no payout here: the rows are the
 * fixture's, and the phone used to add an invented one (mobile audit HO-04).
 */
function PayoutRow({
  payouts,
  now,
  onOpen,
}: {
  payouts: readonly HostPayout[];
  now: number;
  onOpen: () => void;
}) {
  const t = useT();
  const { c, space } = useTheme();

  const next = payouts.find((p) => p.status === 'scheduled') ?? payouts[0];

  return (
    <Card>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={
          next
            ? `${t('host.payouts')}. ${next.guest}. ${bufferNote(next, now, t)}`
            : `${t('host.payouts')}. ${t('host.payoutsEmpty')}`
        }
        accessibilityHint={t('host.payoutsOpen')}
        onPress={onOpen}
        style={{ gap: space[3] }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <Icon name="coins" size={16} color={c.textBody} />
          <Text weight="semibold" size="md" color="textStrong" style={{ flex: 1 }}>
            {t('host.payouts')}
          </Text>
          <Icon name="chevronRight" size={16} color={c.textSubtle} />
        </View>

        {next ? (
          <View style={{ gap: 4 }}>
            <View
              style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}
            >
              <Text size="sm" color="textMuted" numberOfLines={1} style={{ flexShrink: 1 }}>
                {t('host.payoutFor', { guest: next.guest, reference: next.bookingId })}
              </Text>
              <MoneyAmount value={next.amountRwf} strong tone="brand" size="md" />
            </View>
            <Text size="xs" color="textSubtle">
              {bufferNote(next, now, t)}
            </Text>
          </View>
        ) : (
          <Text size="sm" color="textSubtle" style={{ lineHeight: 19 }}>
            {t('host.payoutsEmptyBody')}
          </Text>
        )}

        <Text size="xs" color="textSubtle" style={{ lineHeight: 17 }}>
          {t('host.payoutsSubtitle')}
        </Text>
      </PressableScale>
    </Card>
  );
}
