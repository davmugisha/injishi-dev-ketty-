/**
 * The payouts, and the dispute buffer each one is waiting out.
 *
 * F-B12: the host receives the FULL booking amount and Injishi takes no
 * commission, so there is no deduction line here and the sheet says why rather
 * than leaving the absence to be read as an oversight.
 *
 * The three states are three different sentences and that is the reason to
 * draw them separately:
 *
 *   - `scheduled` — the clock is running. The row counts it down.
 *   - `queued` — there is nowhere to send it. F-B12 is emphatic that a payout
 *     with no destination is NEVER dropped, so the row says it is waiting on
 *     the host rather than showing an error.
 *   - `held` — a dispute is open inside the buffer, which is exactly what the
 *     buffer is for.
 *
 * The duration itself is `DISPUTE_BUFFER_MS`, a fixture's choice: F-B12 reads
 * it from `config_entries` and F-A10 leaves the value an open question, so the
 * screen shows the countdown without ever printing the policy as a number it
 * cannot source.
 */
import { View } from 'react-native';
import { Badge, EmptyState, Icon, ModalSheet, MoneyAmount, Text } from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import type { HostPayout } from './host-fixtures';
import { PAYOUT_STATUS_LABEL, bufferNote } from './host-format';
import { AdapterNote, Rule } from './host-chrome';

const TONE: Record<HostPayout['status'], 'brand' | 'warning' | 'success' | 'neutral'> = {
  scheduled: 'brand',
  queued: 'warning',
  paid: 'success',
  held: 'warning',
};

export function PayoutsSheet({
  open,
  payouts,
  now,
  onClose,
}: {
  open: boolean;
  payouts: readonly HostPayout[];
  now: number;
  onClose: () => void;
}) {
  const { c, space } = useTheme();
  const t = useT();

  const needsAccount = payouts.some((p) => p.status === 'queued');

  return (
    <ModalSheet
      visible={open}
      title={t('host.payoutsTitle')}
      subtitle={t('host.payoutsSubtitle')}
      onClose={onClose}
    >
      {payouts.length === 0 ? (
        <EmptyState
          icon="coins"
          title={t('host.payoutsEmpty')}
          body={t('host.payoutsEmptyBody')}
        />
      ) : (
        <View style={{ gap: space[4] }}>
          {payouts.map((payout) => (
            <View key={payout.id} style={{ gap: space[2] }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: space[3],
                }}
              >
                <View style={{ flex: 1, gap: 3 }}>
                  <Text weight="semibold" size="sm" color="textStrong" numberOfLines={1}>
                    {payout.guest}
                  </Text>
                  <Text family="mono" size="xs" color="textMuted">
                    {payout.bookingId}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 5 }}>
                  <MoneyAmount value={payout.amountRwf} strong size="md" />
                  <Badge tone={TONE[payout.status]}>{t(PAYOUT_STATUS_LABEL[payout.status])}</Badge>
                </View>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <Icon
                  name={payout.status === 'held' ? 'pause' : 'clock'}
                  size={13}
                  color={c.textSubtle}
                />
                <Text size="xs" color="textSubtle" style={{ flex: 1, lineHeight: 18 }}>
                  {bufferNote(payout, now, t)}
                </Text>
              </View>

              <Text size="xs" color="textSubtle">
                {t('host.payoutTo', {
                  destination: t(
                    payout.destination === 'momo' ? 'host.destinationMomo' : 'host.destinationBank',
                  ),
                })}
              </Text>
            </View>
          ))}
        </View>
      )}

      <Rule />

      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <Icon name="shield" size={15} color={c.textMuted} />
        <Text size="sm" color="textMuted" style={{ flex: 1, lineHeight: 19 }}>
          {t('host.payoutBuffer')}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <Icon name="percent" size={15} color={c.textMuted} />
        <Text size="sm" color="textMuted" style={{ flex: 1, lineHeight: 19 }}>
          {t('host.noCommission')}
        </Text>
      </View>

      {/* Where a payout account WOULD be set up. The prompt's rule: what stays
          on the web desk is named where it would have been, never left blank. */}
      {needsAccount ? (
        <>
          <Rule />
          <View style={{ gap: 4 }}>
            <Text weight="semibold" size="sm" color="textStrong">
              {t('host.addPayoutAccount')}
            </Text>
            <Text size="sm" color="textMuted" style={{ lineHeight: 19 }}>
              {t('host.payoutAccountNote')}
            </Text>
          </View>
        </>
      ) : null}

      <AdapterNote />
    </ModalSheet>
  );
}
