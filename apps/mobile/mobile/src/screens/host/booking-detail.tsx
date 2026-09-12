/**
 * One booking, from the desk's side.
 *
 * The operator app splits this into five lenses — overview, guests, payment,
 * messages, history — behind route segments. A phone has no room for a lens
 * switcher over a page this short, so the five become five sections down one
 * scroller, in the same order, and the two that are genuinely elsewhere (the
 * folio and the thread) say where they are instead of pretending to be here.
 *
 * ## The action bar is the whole point of the screen
 *
 * The web app puts every action on the LIST row and leaves the detail page
 * read-only. That works with a mouse and a table. On a phone the detail page is
 * where a desk lands after tapping a row it was unsure about, so the action it
 * came to take has to be here too — one primary in a sticky bar, chosen from
 * the same state the row used, so the two can never offer different things.
 *
 * ## Money is read, never recomputed
 *
 * Design brief §8.6: a price is not recomputed on a screen. `breakdown` was
 * locked at booking time by `computeBreakdown` and is printed as it stands. The
 * host's own share is `accommodationRwf` — the guest service fee is Injishi's
 * and the accommodation is the host's, with no commission between them (F-B12),
 * which is why the two lines sit under one another rather than being netted.
 */
import { type ReactNode, useState } from 'react';
import { Linking, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Avatar,
  BackHeader,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  formatMoney,
  Icon,
  ListRow,
  MoneyBreakdown,
  SkeletonList,
  StatusBadge,
  StickyBar,
  Text,
  Timeline,
  todayIso,
  type TimelineEntry,
  type UndoState,
  UndoBar,
  useToast,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT, type Translate } from '@/i18n/i18n';
import { useNow } from '@/screens/guest/trip-clock';
import type { HostBooking } from './host-fixtures';
import {
  clockOf,
  decisionBlocked,
  rowStateOf,
  useCaptures,
  useHostActions,
  useHostBooking,
} from './host-store';
import {
  badgeStateOf,
  expiryNote,
  guestsLabel,
  nightsLabel,
  roomLine,
  stayRange,
} from './host-format';
import { AdapterNote, FactRow, Rule, WebDeskNote } from './host-chrome';
import { DeclineSheet } from './decline-sheet';
import { CheckOutSheet } from './check-out-sheet';

export function HostBookingDetail({ id }: { id: string | undefined }) {
  const t = useT();
  const { booking, status, error, retry } = useHostBooking(id);

  if (status === 'loading') {
    return (
      <Framed>
        <SkeletonList rows={4} label={t('state.loadingList', { label: t('host.bookingTitle') })} />
      </Framed>
    );
  }

  if (status === 'error') {
    return (
      <Framed>
        <ErrorState
          title={t('host.errorTitle')}
          body={t('host.errorBody')}
          detail={error?.message}
          onRetry={retry}
        />
      </Framed>
    );
  }

  if (!booking) return <NotFound />;

  return <Loaded booking={booking} />;
}

/* -------------------------------------------------------------------- body */

function Loaded({ booking }: { booking: HostBooking }) {
  const { c, space } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const actions = useHostActions();
  const captures = useCaptures();
  const now = useNow();
  const today = todayIso();

  const [declining, setDeclining] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [undo, setUndo] = useState<UndoState | null>(null);

  const state = rowStateOf(booking, today);
  const capture = captures[booking.id];

  const decide = async (kind: 'approve' | 'decline', note = '') => {
    const blocked = decisionBlocked(booking, Date.now());
    if (blocked) {
      toast.show(blocked === 'expired' ? t('host.staleBody') : t('host.staleResolved'), 'warning');
      return;
    }
    const before = booking;
    if (kind === 'approve') await actions.approve(booking.id);
    else await actions.decline(booking.id, note);
    setUndo({
      text:
        kind === 'approve'
          ? t('host.approvedToast', { guest: booking.guest.name })
          : t('host.declinedToast', { guest: booking.guest.name }),
      onUndo: () => void actions.restore(before),
    });
  };

  const call = () => {
    const url = `tel:${booking.guest.phone.replace(/\s/g, '')}`;
    void Linking.openURL(url).catch(() => toast.show(t('host.callFailed'), 'warning'));
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <View
        style={{
          flex: 1,
          paddingTop: insets.top + 52,
        }}
      >
        <ScrollBody bottomInset={insets.bottom}>
          {/* ------------------------------------------------------- the header */}
          <View style={{ gap: space[3] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
              <Avatar name={booking.guest.name} size={48} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text
                  family="display"
                  weight="semibold"
                  size="xl"
                  color="textStrong"
                  style={{ letterSpacing: -0.4 }}
                >
                  {booking.guest.name}
                </Text>
                <Text family="mono" size="sm" color="textMuted">
                  {booking.id}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], flexWrap: 'wrap' }}>
              <StatusBadge domain="booking" state={badgeStateOf(booking, today)} size="lg" />
              {booking.guest.priorStays > 0 ? (
                <Badge tone="neutral">
                  {t('host.returning', { count: booking.guest.priorStays })}
                </Badge>
              ) : (
                <Badge tone="neutral">{t('host.firstStay')}</Badge>
              )}
              {booking.checkInMode === 'self' ? (
                <Badge tone="brand">{t('host.selfCheckedIn')}</Badge>
              ) : null}
            </View>

            {state === 'awaiting' ? (
              <ExpiryLine booking={booking} now={now} />
            ) : null}
          </View>

          {/* --------------------------------------------------------- the stay */}
          <Card title={t('host.stay')}>
            <View style={{ gap: 11 }}>
              <FactRow label={t('host.factRoom')} value={roomLine(booking, t)} />
              <FactRow label={t('host.factDates')} value={stayRange(booking, t)} />
              <FactRow label={t('host.factNights')} value={nightsLabel(booking.nights, t)} />
              <FactRow label={t('host.factGuests')} value={guestsLabel(booking.guests, t)} />
              <FactRow
                label={t('host.factArrival')}
                value={
                  booking.arrivalTime
                    ? t('host.arrivesAt', { time: booking.arrivalTime })
                    : t('host.arrivesUnknown')
                }
              />
              <FactRow
                label={t('host.factSource')}
                value={t(
                  booking.source === 'walk_in' ? 'host.sourceWalkIn' : 'host.sourceBooked',
                )}
              />
              {booking.checkedInAt ? (
                <FactRow
                  label={t('host.factCheckIn')}
                  value={t(
                    booking.checkInMode === 'self' ? 'host.checkInSelf' : 'host.checkInStaffed',
                    { time: clockOf(booking.checkedInAt) },
                  )}
                />
              ) : null}
              {booking.checkedOutAt ? (
                <FactRow
                  label={t('host.factCheckOut')}
                  value={clockOf(booking.checkedOutAt)}
                  strong
                />
              ) : null}
            </View>
          </Card>

          {/* -------------------------------------------------------- the money */}
          <Card title={t('host.money')}>
            <View style={{ gap: space[3] }}>
              <MoneyBreakdown
                items={[
                  { label: t('host.lineAccommodation'), value: booking.breakdown.accommodationRwf },
                  { label: t('host.lineFee'), value: booking.breakdown.serviceFeeRwf, muted: true },
                ]}
                total={{ label: t('host.lineTotal'), value: booking.breakdown.grossRwf }}
              />

              <Rule />

              <MoneyBreakdown
                items={[]}
                total={{ label: t('host.yourShare'), value: booking.breakdown.accommodationRwf }}
              />
              <Text size="xs" color="textMuted" style={{ lineHeight: 18 }}>
                {t('host.noCommission')}
              </Text>

              <Rule />

              <FactRow
                label={t('host.balance')}
                value={
                  booking.balanceRwf > 0
                    ? formatMoney(booking.balanceRwf)
                    : t('host.balanceNone')
                }
                strong={booking.balanceRwf > 0}
              />
              <FactRow
                label={t('host.invoice')}
                value={booking.invoice ?? t('host.invoiceAtCheckout')}
              />

              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 9 }}>
                <Icon name="shield" size={15} color={c.textMuted} />
                <Text size="xs" color="textMuted" style={{ flex: 1, lineHeight: 18 }}>
                  {t(escrowKey(booking))}
                </Text>
              </View>

              <AdapterNote />
            </View>
          </Card>

          {/* -------------------------------------------------------- the guest */}
          <Card title={t('host.guestSection')}>
            <View>
              <ListRow
                icon="phone"
                title={booking.guest.phone}
                subtitle={t('host.callGuest', { guest: booking.guest.name })}
                onPress={call}
                divider
              />
              <ListRow
                icon="message"
                title={t('host.messageGuest')}
                subtitle={t('host.messageHint')}
                onPress={() => router.push('/inbox')}
              />
            </View>
          </Card>

          {capture ? (
            <Card title={t('host.stepIdentity')}>
              <View style={{ gap: 11 }}>
                <FactRow label={t('host.nameLabel')} value={capture.fullName} />
                {/* The two document types are Session 5's keys, not this
                    surface's: a national ID is a national ID at the desk too,
                    and a second spelling would be a second vocabulary. */}
                <FactRow
                  label={t(
                    capture.documentType === 'passport'
                      ? 'checkin.docPassport'
                      : 'checkin.docNationalId',
                  )}
                  value={capture.documentNumber}
                />
                <Text size="xs" color="textMuted" style={{ lineHeight: 18 }}>
                  {t('host.checkInVerified')}
                </Text>
              </View>
            </Card>
          ) : null}

          {/* ------------------------------------------------------ the history */}
          <Card title={t('host.history')}>
            <Timeline entries={historyOf(booking, t)} />
          </Card>

          {/* ------------------------------------- what a phone does not carry */}
          <WebDeskNote icon="receipt" title={t('host.folioTitle')} body={t('host.folioBody')} />
        </ScrollBody>
      </View>

      <ActionBar
        booking={booking}
        state={state}
        saving={actions.saving}
        onApprove={() => void decide('approve')}
        onDecline={() => setDeclining(true)}
        onCheckIn={() =>
          router.push({ pathname: '/reservation/[id]/check-in', params: { id: booking.id } })
        }
        onCheckOut={() => setCheckingOut(true)}
      />

      <BackHeader />
      <UndoBar
        state={undo}
        onDismiss={() => setUndo(null)}
        actionLabel={t('host.undo')}
      />

      <DeclineSheet
        booking={declining ? booking : null}
        onClose={() => setDeclining(false)}
        onDeclined={(_booking, note) => {
          setDeclining(false);
          void decide('decline', note);
        }}
      />
      <CheckOutSheet
        booking={checkingOut ? booking : null}
        onClose={() => setCheckingOut(false)}
      />
    </View>
  );
}

/* ------------------------------------------------------------- the action bar */

/**
 * One primary, chosen from the same state the list row reads.
 *
 * A booking with nothing to decide gets no bar at all rather than a disabled
 * one: a permanently grey button is the orphaned control the quality bar rules
 * out, and there is nothing here a desk could do to make it live.
 */
function ActionBar({
  booking,
  state,
  saving,
  onApprove,
  onDecline,
  onCheckIn,
  onCheckOut,
}: {
  booking: HostBooking;
  state: ReturnType<typeof rowStateOf>;
  saving: boolean;
  onApprove: () => void;
  onDecline: () => void;
  onCheckIn: () => void;
  onCheckOut: () => void;
}) {
  const t = useT();
  const { space } = useTheme();

  if (state === 'awaiting') {
    return (
      <StickyBar>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
          <Button variant="ghost" size="lg" disabled={saving} onPress={onDecline}>
            {t('host.decline')}
          </Button>
          <View style={{ flex: 1 }} />
          <Button variant="primary" size="lg" disabled={saving} onPress={onApprove}>
            {t('host.approve')}
          </Button>
        </View>
      </StickyBar>
    );
  }

  if (state === 'arriving') {
    return (
      <StickyBar>
        <View style={{ flex: 1 }}>
          <Button
            variant="primary"
            size="lg"
            block
            leadingIcon="key"
            disabled={saving}
            onPress={onCheckIn}
          >
            {t('host.checkIn')}
          </Button>
        </View>
      </StickyBar>
    );
  }

  if (state === 'departing' || state === 'in_house') {
    return (
      <StickyBar>
        <View style={{ flex: 1 }}>
          <Button variant="primary" size="lg" block disabled={saving} onPress={onCheckOut}>
            {t('host.checkOut')}
          </Button>
        </View>
      </StickyBar>
    );
  }

  return null;
}

/* ----------------------------------------------------------------- the parts */

function ExpiryLine({ booking, now }: { booking: HostBooking; now: number }) {
  const { c, space, radius } = useTheme();
  const t = useT();
  const note = expiryNote(booking.approvalExpiresAt, now, t);
  if (!note) return null;

  return (
    <View
      accessible
      accessibilityLabel={`${note}. ${t('host.expiryRule')}`}
      style={{
        gap: 5,
        padding: space[3],
        borderRadius: radius.sm,
        backgroundColor: c.warning100,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name="clock" size={15} color={c.warning600} />
        <Text weight="semibold" size="sm" color="warning600" style={{ flex: 1 }}>
          {note}
        </Text>
      </View>
      <Text size="xs" color="textBody" style={{ lineHeight: 18 }}>
        {t('host.expiryRule')}
      </Text>
    </View>
  );
}

/** Which sentence the escrow line takes. One per state, never a bare word. */
function escrowKey(booking: HostBooking) {
  if (booking.escrowStatus === 'refunded_full') return 'host.escrowRefunded' as const;
  if (booking.escrowStatus === 'released') return 'host.escrowReleased' as const;
  return 'host.escrowHeld' as const;
}

/**
 * The lifecycle, as the operator app's `history` lens would show it.
 *
 * Built from the booking's own timestamps rather than from an event log,
 * because there is no event log in the fixtures and inventing one would be
 * inventing rows the API does not send. Every entry below is a field on the
 * booking, which is also why the list is short and honest.
 */
function historyOf(booking: HostBooking, t: Translate): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    { key: 'requested', title: t('host.eventRequested'), state: 'done' },
  ];

  if (booking.status === 'declined') {
    entries.push({
      key: 'declined',
      title: t('host.eventDeclined'),
      // What the host wrote, shown back to them. The decline sheet requires a
      // line; this is where it goes, so the field is not a form that asks for
      // something and then throws it away.
      body: booking.declineNote ?? undefined,
      state: 'done',
    });
    return entries;
  }

  entries.push({
    key: 'confirmed',
    title: t('host.eventConfirmed'),
    state: booking.status === 'confirmed' ? 'done' : 'pending',
  });

  entries.push({
    key: 'checked-in',
    title: t('host.eventCheckedIn'),
    meta: booking.checkedInAt ? clockOf(booking.checkedInAt) : undefined,
    state: booking.checkedInAt ? 'done' : booking.status === 'confirmed' ? 'current' : 'pending',
  });

  entries.push({
    key: 'checked-out',
    title: t('host.eventCheckedOut'),
    meta: booking.checkedOutAt ? clockOf(booking.checkedOutAt) : undefined,
    body: booking.invoice ?? undefined,
    state: booking.checkedOutAt ? 'done' : booking.checkedInAt ? 'current' : 'pending',
  });

  return entries;
}

/* --------------------------------------------------------------- the frames */

/**
 * The scroller under the floating back control.
 *
 * The bottom padding clears the sticky action bar as well as the home
 * indicator — a last card half-hidden behind the primary is the classic way a
 * detail screen loses its final row.
 */
function ScrollBody({ children, bottomInset }: { children: ReactNode; bottomInset: number }) {
  const { space } = useTheme();
  return (
    <ScrollView
      contentContainerStyle={{
        paddingHorizontal: space[4],
        paddingBottom: bottomInset + 140,
        gap: space[4],
      }}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

function Framed({ children }: { children: ReactNode }) {
  const { c, space } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <View style={{ paddingTop: insets.top + 52, paddingHorizontal: space[4] }}>{children}</View>
      <BackHeader />
    </View>
  );
}

function NotFound() {
  const t = useT();
  const router = useRouter();
  return (
    <Framed>
      <EmptyState
        icon="search"
        title={t('host.notFoundTitle')}
        body={t('host.notFoundBody')}
        action={
          <Button variant="outline" size="md" onPress={() => router.replace('/reservations')}>
            {t('host.notFoundAction')}
          </Button>
        }
      />
    </Framed>
  );
}

