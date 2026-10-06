/**
 * Checking a guest out — the one irreversible action on this surface.
 *
 * F-B17 is explicit that there is **no undo in v1** and that the confirm dialog
 * is therefore the guard. That is why this is the only decision on the Host
 * desk with a confirm step: approve and decline both get an undo bar instead,
 * because both can be taken back.
 *
 * What follows one tap is printed above the button rather than discovered
 * after it, and it is only what a checkout on this phone actually does:
 *
 *   - the stay closes;
 *   - the room goes to housekeeping as a pending `checkout_clean` (F-P04), so
 *     an attendant's queue changes because a receptionist tapped something.
 *
 * F-B17 also has the server issue the one tax invoice, settle the folio and
 * start the payout clock. This sheet used to promise all three and its toast
 * printed an invented `EBM-2026-…` number, for a write that never leaves the
 * phone (mobile audit 2026-10-05, HO-04). It now says no invoice is issued
 * here, and that an open balance is not collected.
 *
 * Two cases the sheet has to say out loud:
 *
 *   - **Money still on the folio.** Checking out here does not collect it,
 *     which a desk should know before the guest walks out.
 *   - **Leaving early.** F-B17 asks for an alert before the confirm when the
 *     guest is going before `plannedExitAt`, because the nights billed are the
 *     nights actually stayed and that changes the bill.
 *
 * And one it refuses: checkout is the closing sale, so it is never queued
 * offline. The confirm is disabled with its reason beside it (HO-10).
 */
import { useState } from 'react';
import { View } from 'react-native';
import {
  Button,
  formatMoney,
  Icon,
  ModalSheet,
  MoneyAmount,
  Text,
  useToast,
  WriteError,
} from '@/components';
import { todayIso } from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import type { HostBooking } from './host-fixtures';
import { useHostActions } from './host-store';
import { AdapterNote, Rule } from './host-chrome';

export function CheckOutSheet({
  booking,
  onClose,
}: {
  booking: HostBooking | null;
  onClose: () => void;
}) {
  const { c, space } = useTheme();
  const t = useT();
  const toast = useToast();
  const { checkOut, offline } = useHostActions();
  const [working, setWorking] = useState(false);
  /** The last confirm did not save. Set from its RESULT (HO-06). */
  const [failed, setFailed] = useState(false);

  if (!booking) {
    return <ModalSheet visible={false} title="" onClose={onClose}>{null}</ModalSheet>;
  }

  const today = todayIso();
  // Nights they will actually have stayed, which is what gets invoiced. The
  // difference from `nights` is what makes this an early departure.
  const early = booking.checkOutDay > today;
  const nightsShort = early
    ? Math.max(
        1,
        Math.round(
          (Date.parse(`${booking.checkOutDay}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) /
            86_400_000,
        ),
      )
    : 0;

  const close = () => {
    setFailed(false);
    onClose();
  };

  const commit = async () => {
    setWorking(true);
    setFailed(false);
    const outcome = await checkOut(booking.id);
    setWorking(false);

    // Branch on how THIS checkout ended (mobile audit 2026-10-05, HO-06). The
    // sheet used to close and toast success whatever happened. A failure keeps
    // the sheet open with a retry; offline is refused (the confirm is already
    // disabled, so this is the connection dropping mid tap); `cancelled`
    // changed nothing.
    if (outcome === 'error') {
      setFailed(true);
      return;
    }
    if (outcome === 'offline') {
      toast.show(t('host.needsConnectionCheckOut'), 'warning');
      return;
    }
    if (outcome !== 'done') return;

    close();
    toast.show(
      booking.room
        ? t('host.checkedOutToast', { guest: booking.guest.name, room: booking.room })
        : t('host.checkedOutNoRoom', { guest: booking.guest.name }),
      'success',
    );
  };

  return (
    <ModalSheet
      visible
      title={t('host.checkOutTitle', { guest: booking.guest.name })}
      onClose={close}
      footer={
        <View style={{ gap: space[2] }}>
          {offline ? (
            <View
              accessible
              accessibilityRole="alert"
              accessibilityLabel={t('host.needsConnectionCheckOut')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
              <Icon name="wifiOff" size={15} color={c.warning600} />
              <Text size="xs" color="textBody" style={{ flex: 1, lineHeight: 18 }}>
                {t('host.needsConnectionCheckOut')}
              </Text>
            </View>
          ) : null}
          <Button
            variant="primary"
            size="lg"
            block
            leadingIcon="checkCircle"
            disabled={working || offline}
            onPress={() => void commit()}
          >
            {working ? t('host.checkOutWorking') : t('host.checkOutConfirm')}
          </Button>
          <Button variant="ghost" size="lg" block disabled={working} onPress={close}>
            {t('host.checkOutCancel')}
          </Button>
        </View>
      }
    >
      {failed ? (
        <WriteError
          title="host.checkOutFailedTitle"
          body="host.checkOutFailedBody"
          onRetry={() => void commit()}
        />
      ) : null}

      <Text size="sm" color="textBody" style={{ lineHeight: 22 }}>
        {t('host.checkOutBody', { room: booking.room ?? '—' })}
      </Text>

      {early ? (
        <Warning icon="alertTriangle">
          {t('host.checkOutEarly', { count: nightsShort })}
        </Warning>
      ) : null}

      {booking.balanceRwf > 0 ? (
        <>
          <Rule />
          <View style={{ gap: space[2] }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <Text weight="semibold" size="sm" color="textStrong">
                {t('host.balance')}
              </Text>
              {/* `negative` is `MoneyAmount`'s tone for money owed. There is no
                  `warning` tone on it, and a balance is not a loss — it is what
                  the guest still has to pay, which is the same reading. */}
              <MoneyAmount value={booking.balanceRwf} strong tone="negative" size="md" />
            </View>
            <Text size="sm" color="textMuted" style={{ lineHeight: 19 }}>
              {t('host.checkOutBalance', { amount: formatMoney(booking.balanceRwf) })}
            </Text>
          </View>
        </>
      ) : null}

      <Rule />
      <AdapterNote />
    </ModalSheet>
  );
}

function Warning({ icon, children }: { icon: 'alertTriangle'; children: string }) {
  const { c, space, radius } = useTheme();
  return (
    <View
      accessible
      accessibilityRole="alert"
      accessibilityLabel={children}
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        padding: space[3],
        borderRadius: radius.sm,
        backgroundColor: c.warning100,
      }}
    >
      <Icon name={icon} size={16} color={c.warning600} />
      <Text size="sm" color="textBody" style={{ flex: 1, lineHeight: 19 }}>
        {children}
      </Text>
    </View>
  );
}

