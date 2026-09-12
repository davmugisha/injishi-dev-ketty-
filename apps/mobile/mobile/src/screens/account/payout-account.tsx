/**
 * Payout account — frame R5's "Payout account · MoMo · mock ›" and B25's.
 *
 * A sheet rather than a screen: it is one destination, one balance and one
 * escape, and pushing a card for that leaves the reader further from the money
 * screen they were checking than they were before.
 *
 * **The adapter chip is the point of the sheet, not decoration on it.**
 * `ui-rules.md` § Adapter Awareness: a mocked success must never look like a
 * real one, and a payout destination is the strongest case for that rule in the
 * whole app — this is the row somebody checks before believing rent arrived.
 * So the chip is above the fold with its consequence printed beside it, and the
 * pending amount says out loud that nothing has moved.
 *
 * "Change destination" is deliberately not wired to a form. Changing where money
 * goes is the single most abusable control in a rental product: F-B12's own
 * dispute buffer exists because of it, and a prototype that let a tap rewrite
 * the destination with no verification would be teaching the wrong shape. The
 * button says what really has to happen instead, which is a decision the reader
 * can see rather than a dead control.
 */
import { View } from 'react-native';
import {
  AdapterNote,
  Button,
  EmptyState,
  ErrorState,
  Icon,
  MoneyAmount,
  Sheet,
  SkeletonList,
  StatRow,
  Text,
  useToast,
} from '@/components';
import { useFixture } from '@/data/use-fixture';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { PAYOUT_ACCOUNT } from './account-fixtures';
import { formatLongDay } from './account-format';

export function PayoutAccountSheet() {
  const { c, space, radius } = useTheme();
  const t = useT();
  const toast = useToast();

  /**
   * Read through `useFixture` rather than off the module (gaps.md §6, P1).
   *
   * The screen used to take `PAYOUT_ACCOUNT` directly, which is synchronous and
   * therefore has no loading branch, no error branch and no empty branch — the
   * exact failure `use-fixture.ts` exists to prevent, since *"a branch that
   * never renders is a branch that rots."*
   *
   * On THIS screen the missing error branch was the dangerous one. It is the
   * row somebody checks before believing rent arrived, and a read that failed
   * while still painting the last-known destination would tell them their money
   * is going somewhere it may no longer be going. So the error branch shows
   * nothing rather than something stale, and says why.
   */
  const read = useFixture('account.payout', () => PAYOUT_ACCOUNT);
  const account = read.data;
  const live = account?.adapter === 'live';

  if (read.status === 'loading') {
    return (
      <Sheet grabber title={t('payout.title')} subtitle={t('payout.subtitle')}>
        <SkeletonList rows={3} label={t('payout.loading')} />
      </Sheet>
    );
  }

  if (read.status === 'error') {
    return (
      <Sheet grabber title={t('payout.title')}>
        <ErrorState
          title={t('payout.errorTitle')}
          body={t('payout.errorBody')}
          onRetry={read.retry}
        />
      </Sheet>
    );
  }

  if (!account) {
    return (
      <Sheet grabber title={t('payout.title')}>
        <EmptyState
          icon="wallet"
          title={t('payout.noneTitle')}
          body={t('payout.noneBody')}
          action={
            <Button
              variant="primary"
              size="md"
              leadingIcon="externalLink"
              onPress={() => toast.show(t('payout.changeToast'), 'neutral')}
            >
              {t('payout.change')}
            </Button>
          }
        />
      </Sheet>
    );
  }

  return (
    <Sheet
      grabber
      title={t('payout.title')}
      subtitle={t('payout.subtitle')}
      footer={
        <Button
          variant="outline"
          size="lg"
          block
          leadingIcon="externalLink"
          onPress={() => toast.show(t('payout.changeToast'), 'neutral')}
          accessibilityHint={t('payout.changeHint')}
        >
          {t('payout.change')}
        </Button>
      }
    >
      <AdapterNote
        label={t(live ? 'payout.adapterLive' : 'payout.adapterMock')}
        body={t(live ? 'payout.adapterLiveBody' : 'payout.adapterMockBody')}
        live={live}
      />

      <View
        accessible
        accessibilityLabel={`${t('payout.destination')}: ${t('payout.momo')}, ${t(
          'payout.tail',
          { tail: account.tail },
        )}, ${account.holder}`}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[3],
          padding: space[4],
          borderRadius: radius.lg,
          backgroundColor: c.surface2,
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.md,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: c.brand100,
          }}
        >
          <Icon name="smartphone" size={19} color={c.brand700} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text weight="semibold" size="md" color="textStrong">
            {t('payout.momo')}
          </Text>
          <Text family="mono" size="sm" color="textMuted">
            {t('payout.tail', { tail: account.tail })}
          </Text>
        </View>
        <Text size="xs" color="textMuted" style={{ maxWidth: 120, textAlign: 'right' }}>
          {account.holder}
        </Text>
      </View>

      <View>
        <StatRow
          icon="clock"
          label={t('payout.pending')}
          value={t('payout.pendingValue')}
          divider
        />
        <StatRow icon="calendar" label={t('payout.releases')} value={formatLongDay(account.releasesOn, t)} divider />
        <StatRow
          icon="shield"
          label={t('payout.buffer')}
          value={account.bufferDays}
          unit={t('payout.days')}
          divider
        />
        <StatRow icon="check" label={t('payout.verified')} value={formatLongDay(account.verifiedOn, t)} />
      </View>

      {/* The amount itself, drawn rather than described, because a figure a
          reader has to reconstruct from a row label is a figure they will
          reconstruct wrongly. */}
      <View
        style={{
          gap: 4,
          padding: space[4],
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: c.borderSubtle,
        }}
      >
        <Text
          weight="bold"
          size="2xs"
          color="textMuted"
          style={{ letterSpacing: 1, textTransform: 'uppercase' }}
        >
          {t('payout.pending')}
        </Text>
        <MoneyAmount value={account.pendingRwf} size="2xl" strong />
        <Text size="xs" color="textMuted" style={{ lineHeight: 18, marginTop: 2 }}>
          {t('payout.bufferBody', { days: account.bufferDays })}
        </Text>
      </View>
    </Sheet>
  );
}
