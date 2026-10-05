/**
 * One booking, as a desk reads it.
 *
 * The operator app draws a table row: avatar, name, a two-line middle cell, a
 * badge, then the actions. A phone has no columns, so the same five facts
 * stack — but the ORDER is kept, because a receptionist moving between the web
 * desk and the phone should find the same things in the same sequence.
 *
 * **The body and the actions are separate press targets.** Nesting a button
 * inside a pressable row is how a tap on Approve opens the detail instead, and
 * it also collapses the row into one accessibility node so a screen reader can
 * never reach the actions. So the card is a plain `View`, the body is one
 * `PressableScale` that opens the booking, and each action is its own control
 * under a hairline.
 *
 * **What the middle cell says depends on the bucket**, and that is the whole
 * point of the bucket: an arrival needs a time and a room, a stay in progress
 * needs which night it is on, a departure needs what is still owed. One row
 * that printed all four would be a row nobody can scan.
 */
import { type ReactNode } from 'react';
import { View } from 'react-native';
import {
  Avatar,
  Badge,
  formatMoney,
  Icon,
  MoneyAmount,
  PressableScale,
  StatusBadge,
  Text,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT, type Translate } from '@/i18n/i18n';
import type { HostBooking } from './host-fixtures';
import { nightOf } from './host-store';
import {
  badgeStateOf,
  expiryNote,
  guestsLabel,
  isUrgent,
  nightsLabel,
  roomLine,
  rowSpokenLabel,
  stayRange,
} from './host-format';

export interface HostBookingRowProps {
  booking: HostBooking;
  today: string;
  now: number;
  /** Which of the four readings the middle cell takes. */
  cell: 'request' | 'arrival' | 'departure' | 'in_house' | 'plain';
  onOpen: () => void;
  /** The buttons under the hairline. None means no hairline either. */
  actions?: ReactNode;
}

export function HostBookingRow({
  booking,
  today,
  now,
  cell,
  onOpen,
  actions,
}: HostBookingRowProps) {
  const { c, space, radius, shadow } = useTheme();
  const t = useT();

  const urgent = cell === 'request' && isUrgent(booking.approvalExpiresAt, now);

  return (
    <View
      style={{
        borderRadius: radius.md,
        borderWidth: 1,
        // A request about to expire is the one row on the page that has to
        // catch an eye crossing it. Colour is never the only signal (§7.5), so
        // the countdown line below says the same thing in words.
        borderColor: urgent ? c.warning500 : c.borderSubtle,
        backgroundColor: c.surface1,
        overflow: 'hidden',
        ...shadow.sm,
      }}
    >
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={rowSpokenLabel(booking, today, t)}
        accessibilityHint={t('host.openBooking', { guest: booking.guest.name })}
        onPress={onOpen}
        style={{ padding: space[4], gap: space[3] }}
      >
        {/* ------------------------------------------------- who, and the state */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[3] }}>
          <Avatar name={booking.guest.name} size={38} />

          <View style={{ flex: 1, gap: 2 }}>
            <Text weight="semibold" size="md" color="textStrong" numberOfLines={1}>
              {booking.guest.name}
            </Text>
            <Text family="mono" size="xs" color="textMuted" numberOfLines={1}>
              {booking.id}
            </Text>
            <Text size="xs" color="textSubtle" numberOfLines={1}>
              {booking.guest.priorStays > 0
                ? t('host.returning', { count: booking.guest.priorStays })
                : t('host.firstStay')}
            </Text>
          </View>

          <StatusBadge domain="booking" state={badgeStateOf(booking, today)} />
        </View>

        {/* ----------------------------------------------------- the middle cell */}
        <View style={{ gap: 4, paddingLeft: 38 + space[3] }}>
          <Cell booking={booking} today={today} now={now} cell={cell} t={t} />
        </View>
      </PressableScale>

      {actions ? (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: c.borderSubtle,
            paddingHorizontal: space[4],
            paddingVertical: space[3],
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: space[2],
          }}
        >
          {actions}
        </View>
      ) : null}
    </View>
  );
}

/* -------------------------------------------------------------- the readings */

function Cell({
  booking,
  today,
  now,
  cell,
  t,
}: {
  booking: HostBooking;
  today: string;
  now: number;
  cell: HostBookingRowProps['cell'];
  t: Translate;
}) {
  const { c } = useTheme();

  const stay = `${stayRange(booking, t)} · ${nightsLabel(booking.nights, t)}`;

  if (cell === 'request') {
    const note = expiryNote(booking.approvalExpiresAt, now, t);
    const urgent = isUrgent(booking.approvalExpiresAt, now);
    return (
      <>
        <Line>{stay}</Line>
        <Line>{`${booking.roomType} · ${guestsLabel(booking.guests, t)}`}</Line>
        {note ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <Icon name="clock" size={13} color={urgent ? c.warning600 : c.textSubtle} />
            <Text
              weight={urgent ? 'semibold' : 'regular'}
              size="xs"
              color={urgent ? 'warning600' : 'textSubtle'}
            >
              {note}
            </Text>
          </View>
        ) : null}
      </>
    );
  }

  if (cell === 'arrival') {
    return (
      <>
        <Line>{roomLine(booking, t)}</Line>
        <Line>{stay}</Line>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <Icon name="clock" size={13} color={c.textSubtle} />
          <Text size="xs" color="textSubtle">
            {booking.arrivalTime
              ? t('host.arrivesAt', { time: booking.arrivalTime })
              : t('host.arrivesUnknown')}
          </Text>
        </View>
        {booking.room ? null : (
          <Text size="xs" color="action" weight="medium" style={{ marginTop: 2 }}>
            {t('host.assignAtCheckIn')}
          </Text>
        )}
      </>
    );
  }

  if (cell === 'departure') {
    // The stay, not a checkout deadline. "Checkout by 11:00" was a constant
    // printed as this property's policy, which the phone never reads (mobile
    // audit 2026-10-05, HO-16); the group heading already says today.
    return (
      <>
        <Line>{roomLine(booking, t)}</Line>
        <Line>{stay}</Line>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
          {booking.balanceRwf > 0 ? (
            <Badge tone="warning">
              {t('host.balanceDue', { amount: formatMoney(booking.balanceRwf) })}
            </Badge>
          ) : (
            <Badge tone="success">{t('host.settled')}</Badge>
          )}
        </View>
      </>
    );
  }

  if (cell === 'in_house') {
    return (
      <>
        <Line>{roomLine(booking, t)}</Line>
        <Line>
          {`${t('host.nightOf', {
            night: nightOf(booking, today),
            nights: booking.nights,
          })} · ${guestsLabel(booking.guests, t)}`}
        </Line>
        {booking.checkInMode === 'self' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <Icon name="smartphone" size={13} color={c.textSubtle} />
            <Text size="xs" color="textSubtle">
              {t('host.selfCheckedIn')}
            </Text>
          </View>
        ) : null}
      </>
    );
  }

  // `plain` — the Bookings tab, where a row can be in any state at all and the
  // one thing every state shares is the stay itself.
  return (
    <>
      <Line>{roomLine(booking, t)}</Line>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Text size="sm" color="textMuted" numberOfLines={1} style={{ flexShrink: 1 }}>
          {stay}
        </Text>
        <MoneyAmount value={booking.breakdown.grossRwf} size="sm" />
      </View>
    </>
  );
}

function Line({ children }: { children: string }) {
  return (
    <Text size="sm" color="textMuted" numberOfLines={1}>
      {children}
    </Text>
  );
}

