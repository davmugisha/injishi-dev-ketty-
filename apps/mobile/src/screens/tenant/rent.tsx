/**
 * Frame R12 · Rent — the tenant half of FL28: what is owed, what has been paid,
 * and the Caution sitting in escrow behind it.
 *
 * **One loud plate, then quiet rows.** The frame draws the next payment on an
 * ink card and everything else on white, and that hierarchy is the screen's
 * whole argument: a tenant opens Rent to answer one question, and the answer is
 * an amount and a date. `HeroCard` resolves that plate for both schemes — see
 * its header for why it cannot be one fill in both.
 *
 * **The Caution is deliberately a separate card from the ledger.** It is not
 * rent, it cannot be set off against rent, and it settles at the close of the
 * lease (FL24). Showing it inside the ledger is exactly the confusion the
 * separate card exists to prevent.
 *
 * Settlement is mocked (FL28 §6, "mocked settlements labelled"). Paying opens
 * `app/pay-rent.tsx`, which writes through `useFixtureMutation` and stamps the
 * period `mock`. The stamp rides on the ledger row rather than on this screen,
 * so the row still says so on the lease detail page and anywhere else it is
 * drawn — ui-rules.md's adapter rule is that a mocked success must never look
 * like a real one, wherever it is read.
 *
 * **Paying in the app is the demo's alone** (ADR-066 AC-4; mobile audit
 * 2026-10-05, TN-07). The rail is a client timer, so the Pay rent button and
 * the line about how it settles are drawn only when `usePlatform().isDemo`
 * says so, which is false in every production build and until the API has
 * answered. Everywhere else the plate says one neutral thing: pay the landlord
 * directly. No "coming soon": nothing here promises a date.
 *
 * `leaseId`, when a lease's own "Rent history" row opened this tab, chooses
 * which lease is shown. It used to open whichever lease came first, so the
 * second of two running leases showed the first one's ledger (TN-16).
 */
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  formatMoney,
  Icon,
  MoneyAmount,
  OfflineNote,
  PaymentStatus,
  PressableScale,
  Screen,
  SectionLabel,
  SegmentedTabs,
  StatusBadge,
  Text,
  todayIso,
  useOffline,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT, type Translate } from '@/i18n/i18n';
import { useTenancies } from '@/data/tenancy-store';
import {
  isLiveTenancy,
  nextDuePeriod,
  paidToDate,
  type RentPeriod,
  type Tenancy,
} from '@/data/rentals';
import { usePlatform } from '@/queries/platform';
import { HeroCard, HeroLabel, HeroMoney, useHeroTones } from './hero-card';
import { dueCaption, formatFullDay, rentStatusWord } from './dates';

/** One ledger row: the period, what it cost, and how it stands. */
function HistoryRow({ period, t }: { period: RentPeriod; t: Translate }) {
  const { c, space, radius } = useTheme();
  const settled = period.status === 'paid';

  return (
    <View
      accessible
      // The amount and the status are in the label as well as on the row: a
      // label replaces what it wraps, and "September 2026" alone never said
      // how much or whether it was paid (mobile audit 2026-10-05, TN-17).
      accessibilityLabel={[
        period.month,
        formatMoney(period.amount),
        rentStatusWord(period.status, t),
        settled && period.paidOn
          ? t('rent.paidOn', { date: formatFullDay(period.paidOn, t) })
          : period.dueOn
            ? t('rent.due', { date: formatFullDay(period.dueOn, t) })
            : '',
        period.mock ? t('rent.mockSettled') : '',
      ]
        .filter(Boolean)
        .join(', ')}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        minHeight: 44,
        padding: space[3],
        borderRadius: radius.lg,
        backgroundColor: c.surface1,
        borderWidth: 1,
        borderColor: c.borderSubtle,
      }}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          width: 34,
          height: 34,
          borderRadius: radius.md,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: settled ? c.success100 : c.surface2,
        }}
      >
        <Icon
          name={settled ? 'check' : 'clock'}
          size={17}
          color={settled ? c.success600 : c.textMuted}
        />
      </View>

      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <Text weight="medium" size="sm" color="textStrong" numberOfLines={1}>
          {period.month}
        </Text>
        <Text size="xs" color="textMuted" numberOfLines={1}>
          {settled && period.paidOn
            ? t('rent.paidOn', { date: formatFullDay(period.paidOn, t) })
            : period.dueOn
              ? t('rent.due', { date: formatFullDay(period.dueOn, t) })
              : ''}
        </Text>
        {/* The adapter stamp lives on the row, not on the screen. */}
        {period.mock ? (
          <Text size="xs" color="warning600" numberOfLines={2}>
            {t('rent.mockSettled')}
          </Text>
        ) : null}
      </View>

      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <MoneyAmount value={period.amount} strong size="sm" />
        <PaymentStatus status={period.status} />
      </View>
    </View>
  );
}

export function Rent() {
  const { space } = useTheme();
  const router = useRouter();
  const t = useT();
  const tones = useHeroTones();
  const offline = useOffline();
  const { isDemo } = usePlatform();
  const { leaseId } = useLocalSearchParams<{ leaseId?: string }>();
  const today = todayIso();

  const read = useTenancies();

  // Tenancies that actually carry a rent obligation. A lease awaiting signature
  // has no schedule yet — FL21 step 4 starts it at signature — so it is not
  // here, and neither is one that has ended.
  const paying = (read.data ?? []).filter(
    (x) => isLiveTenancy(x) && x.leaseState !== 'pending_signature',
  );

  const [activeId, setActiveId] = useState(leaseId ?? '');
  // A tab stays mounted, so a second lease's "Rent history" arrives as a new
  // param on the same screen rather than as a new screen (TN-16).
  useEffect(() => {
    if (leaseId) setActiveId(leaseId);
  }, [leaseId]);
  const tenancy: Tenancy | undefined = paying.find((x) => x.id === activeId) ?? paying[0];

  const due = tenancy ? nextDuePeriod(tenancy) : undefined;
  const collected = tenancy ? paidToDate(tenancy) : 0;

  return (
    <Screen.List<RentPeriod>
      greeting={tenancy ? `${tenancy.landlordOrg} · ${tenancy.unit}` : undefined}
      title={t('rent.title')}
      header={
        <>
          {offline ? <OfflineNote /> : null}

          {/* Only when there is a choice to make. A one-tab switcher is a
              control that answers a question nobody asked. */}
          {paying.length > 1 ? (
            <View style={{ gap: space[2] }}>
              <SectionLabel>{t('rent.switchLease')}</SectionLabel>
              <SegmentedTabs
                value={tenancy?.id ?? ''}
                onChange={setActiveId}
                items={paying.map((x) => ({ value: x.id, label: x.unit }))}
              />
            </View>
          ) : null}

          {tenancy ? (
            <>
              <HeroCard>
                {due ? (
                  <>
                    <HeroLabel>{t('rent.nextPayment')}</HeroLabel>
                    <HeroMoney value={due.amount} size="2xl" />
                    <Text size="sm" color={tones.fgMuted}>
                      {due.dueOn
                        ? `${t('rent.due', { date: formatFullDay(due.dueOn, t) })} · ${dueCaption(
                            due.dueOn,
                            today,
                            t,
                          )}`
                        : due.month}
                    </Text>
                    {isDemo ? (
                      <>
                        <Button
                          variant={tones.button}
                          size="lg"
                          block
                          leadingIcon="wallet"
                          onPress={() =>
                            router.push({
                              pathname: '/pay-rent',
                              params: { leaseId: tenancy.id, month: due.month },
                            })
                          }
                        >
                          {t('rent.payRent')}
                        </Button>
                        {/* The consequence printed under the button, not
                            discovered after it (the canvas's cross-cutting
                            rule). On the demo the mock adapter is the truth. */}
                        <Text size="xs" color={tones.fgDim} style={{ lineHeight: 17 }}>
                          {t('rent.settledVia', { adapter: t('tenant.mockAdapter') })}
                        </Text>
                      </>
                    ) : (
                      <Text size="sm" color={tones.fgMuted} style={{ lineHeight: 19 }}>
                        {t('rent.payDirectly')}
                      </Text>
                    )}
                  </>
                ) : (
                  <>
                    <HeroLabel>{t('rent.nextPayment')}</HeroLabel>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                      <Icon name="checkCircle" size={20} color={tones.fg} />
                      <Text family="display" weight="semibold" size="xl" color={tones.fg}>
                        {t('rent.upToDate')}
                      </Text>
                    </View>
                    <Text size="sm" color={tones.fgMuted} style={{ lineHeight: 19 }}>
                      {t('rent.upToDateBody')}
                    </Text>
                  </>
                )}
              </HeroCard>

              <Card variant="tint">
                <View style={{ gap: space[3] }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: space[2],
                    }}
                  >
                    <Text size="sm" color="brand900">
                      {t('rent.cautionHeld')}
                    </Text>
                    <StatusBadge domain="caution" state={tenancy.cautionState} />
                  </View>
                  <MoneyAmount value={tenancy.caution} strong size="xl" />
                  <Text size="xs" color="brand900" style={{ opacity: 0.75, lineHeight: 18 }}>
                    {t('rent.cautionNote')}
                  </Text>
                </View>
              </Card>

              <View style={{ gap: space[2] }}>
                <Text size="xs" color="textSubtle" style={{ lineHeight: 17 }}>
                  {t('rent.commissionNote')}
                </Text>
                {/* A link is still a target: 44pt tall, which the bare text
                    line was not (mobile audit 2026-10-05, TN-26). */}
                <PressableScale
                  accessibilityRole="link"
                  accessibilityLabel={t('rent.openLease')}
                  onPress={() =>
                    router.push({ pathname: '/lease/[id]', params: { id: tenancy.id } })
                  }
                  style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}
                >
                  <Text weight="semibold" size="sm" color="brand700">
                    {t('rent.openLease')}
                  </Text>
                </PressableScale>
              </View>

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: space[3],
                }}
              >
                <SectionLabel>{t('rent.history')}</SectionLabel>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                  <Text size="xs" color="textSubtle">
                    {t('rent.paidToDate')}
                  </Text>
                  <MoneyAmount value={collected} strong size="sm" />
                </View>
              </View>
            </>
          ) : null}
        </>
      }
      data={tenancy ? tenancy.history : []}
      keyExtractor={(p) => p.month}
      renderItem={({ item }) => <HistoryRow period={item} t={t} />}
      loading={read.status === 'loading'}
      loadingLabel={t('state.loadingList', { label: t('rent.listLabel') })}
      loadingRows={3}
      empty={
        read.status === 'error' ? (
          <ErrorState
            title={t('state.errorTitle')}
            body={t('state.errorBody', { label: t('rent.listLabel') })}
            detail={read.error?.message}
            onRetry={read.retry}
          />
        ) : !tenancy ? (
          <EmptyState
            icon="wallet"
            title={t('rent.noneTitle')}
            body={t('rent.noneBody')}
          // A tenancy arrives with an invitation, and an invitation arrives in
          // Inbox. That is the way somewhere from here — not a way to conjure a
          // lease, which nothing on this screen could do.
          action={
            <Button
              variant="outline"
              size="sm"
              leadingIcon="inbox"
              onPress={() => router.push('/inbox')}
            >
              {t('state.emptyGoTo', { tab: t('nav.inbox') })}
            </Button>
          }
          />
        ) : (
          <EmptyState
            icon="receipt"
            title={t('rent.emptyHistoryTitle')}
            body={t('rent.emptyHistoryBody')}
            // A history with nothing in it is not a dead end: the lease it
            // belongs to is one tap away and has everything else on it.
            action={
              <Button
                variant="outline"
                size="sm"
                leadingIcon="fileText"
                onPress={() => router.push('/leases')}
              >
                {t('state.emptyGoTo', { tab: t('nav.leases') })}
              </Button>
            }
          />
        )
      }
    />
  );
}
