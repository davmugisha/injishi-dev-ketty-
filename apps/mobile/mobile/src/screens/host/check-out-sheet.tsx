/**
 * Checking a guest out — the one irreversible action on this surface.
 *
 * F-B17 is explicit that there is **no undo in v1** and that the confirm dialog
 * is therefore the guard. That is why this is the only decision on the Host
 * desk with a confirm step: approve and decline both get an undo bar instead,
 * because both can be taken back.
 *
 * Three consequences follow one tap, and all three are printed above the button
 * rather than discovered after it:
 *
 *   - the stay closes and exactly one tax invoice is issued (F-B17);
 *   - the room goes to housekeeping as a pending `checkout_clean` (F-P04), so
 *     an attendant's queue changes because a receptionist tapped something;
 *   - the payout clock starts, and the dispute buffer runs from here (F-B12).
 *
 * Two cases the sheet has to say out loud:
 *
 *   - **Money still on the folio.** Checkout settles it, on the mock adapter,
 *     which is a thing a desk should know it is doing rather than discover in
 *     a toast.
 *   - **Leaving early.** F-B17 asks for an alert before the confirm when the
 *     guest is going before `plannedExitAt`, because the nights invoiced are
 *     the nights actually stayed and that changes the bill.
 */
import { useState } from 'react';
import { View } from 'react-native';
import { Button, formatMoney, Icon, ModalSheet, MoneyAmount, Text, useToast } from '@/components';
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
  const { checkOut } = useHostActions();
  const [working, setWorking] = useState(false);

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

  const commit = async () => {
    setWorking(true);
    const { invoice, room } = await checkOut(booking.id);
    setWorking(false);
    onClose();
    toast.show(
      room
        ? t('host.checkedOutToast', { guest: booking.guest.name, invoice, room })
        : t('host.checkedOutNoRoom', { guest: booking.guest.name, invoice }),
      'success',
    );
  };

  return (
    <ModalSheet
      visible
      title={t('host.checkOutTitle', { guest: booking.guest.name })}
      onClose={onClose}
      footer={
        <View style={{ gap: space[2] }}>
          <Button
            variant="primary"
            size="lg"
            block
            leadingIcon="checkCircle"
            disabled={working}
            onPress={() => void commit()}
          >
            {working ? t('host.checkOutWorking') : t('host.checkOutConfirm')}
          </Button>
          <Button variant="ghost" size="lg" block disabled={working} onPress={onClose}>
            {t('host.checkOutCancel')}
          </Button>
        </View>
      }
    >
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

