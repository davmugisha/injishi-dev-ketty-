/**
 * Earnings — frame B24. The placement-fee ledger, and the year behind it.
 *
 * **Every figure on this screen is derived from the placements array.** The
 * hero total, the count, the average, the six bars and the fee rows are five
 * readings of one list rather than five numbers somebody typed, so a placement
 * that signs moves all of them at once and none of them can drift. F-R08 is why
 * that matters: the fee is recorded against the Lease and the Broker, and a
 * ledger that kept its own copy would be a second answer to a question the
 * lease already settles.
 *
 * **The mock chip is not decoration.** No payout adapter is wired — F-S08 is
 * the seam and it is external — so the chip and the line under it say the
 * figures are fixtures. A money screen that looks live and is not is the one
 * screen in the prototype that could actually mislead somebody.
 *
 * The frame draws this one dark. That is the scheme, not a design: the canvas's
 * ink ramp is retired (decision D1) and this renders in whichever scheme the
 * device is in, with the hero as a `tint` card so it still leads the page.
 */
import { useMemo } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  MoneyAmount,
  Screen,
  SectionLabel,
  Text,
  useOffline,
  WorkspaceChip,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useDomain } from '@/domain';
import { useT } from '@/i18n/i18n';
import { useFixture } from '@/data/use-fixture';
import { formatDay } from '@/data/search';
import {
  SEED_PLACEMENTS,
  monthlyFees,
  placementState,
  recentFees,
  summariseEarnings,
  useBrokerState,
  type Placement,
} from '@/data/broker';
import { moneyText } from './broker-format';
import { EarningsChart } from './earnings-chart';

export function Earnings() {
  const { c, space } = useTheme();
  const router = useRouter();
  const t = useT();
  const { workspace } = useDomain();

  const read = useFixture('broker.earnings', () => SEED_PLACEMENTS);
  const { placements } = useBrokerState();
  const all = read.status === 'ready' ? placements : [];

  const summary = useMemo(() => summariseEarnings(all), [all]);
  const bars = useMemo(() => monthlyFees(all), [all]);
  const rows = useMemo(() => recentFees(all), [all]);

  const offline = useOffline();

  return (
    <Screen.List<Placement>
      greeting={t('earnings.greeting')}
      title={t('earnings.title')}
      action={
        <WorkspaceChip
          name={workspace.name}
          role={workspace.role}
          onPress={() => router.push('/switch')}
        />
      }
      header={
        <>
          {offline ? (
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
          ) : null}

          {/* The provenance chip. It sits above the money rather than beside
              the title, because it qualifies the figures and not the page. */}
          <View
            accessible
            accessibilityRole="summary"
            accessibilityLabel={`${t('earnings.mock')}. ${t('earnings.mockHint')}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}
          >
            <Badge tone="warning" dot>
              {t('earnings.mock')}
            </Badge>
            <Text size="xs" color="textMuted" style={{ flex: 1, lineHeight: 17 }}>
              {t('earnings.mockHint')}
            </Text>
          </View>

          {read.status === 'loading' || read.status === 'error' ? null : (
            <>
              <Hero summary={summary} />

              <View style={{ gap: space[3] }}>
                <SectionLabel>{t('earnings.chartTitle')}</SectionLabel>
                <Card bodyStyle={{ padding: 16 }}>
                  <EarningsChart bars={bars} />
                </Card>
              </View>

              <View
                accessible
                accessibilityRole="summary"
                accessibilityLabel={t('earnings.noCut')}
                style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[2] }}
              >
                <Icon name="shield" size={14} color={c.textSubtle} />
                <Text size="xs" color="textMuted" style={{ flex: 1, lineHeight: 17 }}>
                  {t('earnings.noCut')}
                </Text>
              </View>

              <SectionLabel>{t('earnings.sectionRecent')}</SectionLabel>
            </>
          )}
        </>
      }
      data={rows}
      keyExtractor={(p) => p.id}
      renderItem={({ item }) => <FeeRow placement={item} />}
      loading={read.status === 'loading'}
      loadingLabel={t('state.loadingList', { label: t('earnings.listLabel') })}
      loadingRows={4}
      empty={
        read.status === 'error' ? (
          <ErrorState
            title={t('state.errorTitle')}
            body={t('state.errorBody', { label: t('earnings.listLabel') })}
            detail={read.error?.message}
            onRetry={read.retry}
          />
        ) : (
          <EmptyState
            icon="coins"
            title={t('earnings.emptyTitle')}
            body={t('earnings.emptyBody')}
            action={
              <Button
                variant="outline"
                size="md"
                leadingIcon="grid"
                onPress={() => router.push('/directory')}
              >
                {t('earnings.emptyAction')}
              </Button>
            }
          />
        )
      }
    />
  );
}

/** The year-to-date card: the total, what it is made of, and what is still owed. */
function Hero({ summary }: { summary: ReturnType<typeof summariseEarnings> }) {
  const { c, space } = useTheme();
  const t = useT();

  const meta =
    summary.signed === 1 ? t('earnings.heroMetaOne') : t('earnings.heroMeta', { count: summary.signed });

  return (
    <Card variant="tint" bodyStyle={{ padding: 18, gap: 14 }}>
      <View
        accessible
        accessibilityLabel={`${t('earnings.heroLabel', { year: summary.year })}, ${moneyText(
          summary.total,
        )}. ${meta}.`}
        style={{ gap: 6 }}
      >
        <Text
          weight="bold"
          size="xs"
          color="textMuted"
          style={{ letterSpacing: 1, textTransform: 'uppercase' }}
        >
          {t('earnings.heroLabel', { year: summary.year })}
        </Text>
        <MoneyAmount value={summary.total} strong tone="brand" size="2xl" />
        <Text size="sm" color="textBody">
          {meta}
        </Text>
      </View>

      <View style={{ height: 1, backgroundColor: c.borderSubtle }} />

      <View style={{ gap: 10 }}>
        <HeroRow label={t('earnings.heroAverage')} value={summary.average} />
        {/* Pending is its own row rather than a footnote: it is the number a
            broker chases, and F-R08 makes it conditional on an activation that
            has not happened yet. */}
        <HeroRow label={t('earnings.heroPending')} value={summary.pending} muted />
      </View>

      <View style={{ height: space[1] }} />
    </Card>
  );
}

/**
 * A label and a figure. One accessibility node, so a reader hears "Average fee,
 * RWF 135,000" rather than the label and the amount as two unrelated stops.
 */
function HeroRow({ label, value, muted = false }: { label: string; value: number; muted?: boolean }) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}, ${moneyText(value)}`}
      style={{
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 12,
        minHeight: 20,
      }}
    >
      <Text size="sm" color="textMuted" style={{ flex: 1 }}>
        {label}
      </Text>
      <MoneyAmount value={value} strong={!muted} size="sm" />
    </View>
  );
}

/**
 * One fee row: who was placed where, what state the money is in, and how much.
 *
 * The tone split is the only status that matters here and it is F-R08's:
 * disbursed against a lease that activated, pending against one that has not.
 */
function FeeRow({ placement }: { placement: Placement }) {
  const { c, space } = useTheme();
  const t = useT();

  const paid = placement.feeState === 'paid';
  const state = paid
    ? t('earnings.paidOn', { day: formatDay(placement.paidAt ?? placement.revealedAt, t) })
    : placementState(placement) === 'signing'
      ? t('earnings.pendingSignature')
      : t('earnings.pendingIntent');

  return (
    <View
      accessible
      accessibilityLabel={t('earnings.rowSummary', {
        client: placement.client ?? t('placements.noClient'),
        unit: placement.unitLabel,
        amount: moneyText(placement.fee),
        state,
      })}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        minHeight: 44,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: c.surface1,
        borderWidth: 1,
        borderColor: c.borderSubtle,
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: paid ? c.success100 : c.warning100,
        }}
      >
        <Icon
          name={paid ? 'checkCircle' : 'clock'}
          size={16}
          color={paid ? c.success600 : c.warning600}
        />
      </View>

      <View style={{ flex: 1, gap: 3 }}>
        <Text weight="medium" size="sm" color="textStrong" numberOfLines={1}>
          {t('placements.toUnit', {
            client: placement.client ?? t('placements.noClient'),
            unit: placement.unitLabel,
          })}
        </Text>
        <Text size="xs" color={paid ? 'textMuted' : 'warning600'}>
          {state}
        </Text>
      </View>

      <MoneyAmount
        value={placement.fee}
        strong={paid}
        tone={paid ? 'positive' : undefined}
        size="sm"
      />
    </View>
  );
}
