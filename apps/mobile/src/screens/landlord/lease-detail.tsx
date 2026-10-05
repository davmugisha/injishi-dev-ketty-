/**
 * Lease detail, landlord seat — frame R7.
 *
 * `app/lease/[id].tsx` is one path with two bodies, the same way
 * `app/(tabs)/leases.tsx` is one path with two lists: which record you get is a
 * question about the seat you are in, not about the address. The tenant body
 * (FL25 step 2) stays where it is; this is the landlord's half.
 *
 * The difference is not cosmetic. The tenant's screen is a record of an
 * obligation — what I owe, what I have paid, how I get out. This one is an
 * index into four sub-records the landlord is accountable for: the contract,
 * the caution held in escrow, the RRA filing and the rent ledger. R7 draws it
 * as four rows and two outline buttons, and that is exactly right: a detail
 * screen whose job is to route should route, not restate.
 *
 * **"NEXT DUE" is not drawn as the frame draws it.** R7 prints "NEXT DUE Aug
 * 01" beside a lease whose August rent the rent roll shows as already paid on
 * Aug 01 — the frame is quoting a date, not deriving one. Rather than invent a
 * next-due the fixtures cannot support, the card prints the lease's LATEST
 * charge off the roll, named by that charge's own month: "August 2026 · Paid
 * Aug 01", or Due, or Overdue. It was headed "This month" over a fixed "August
 * 2026" whatever the date (mobile audit 2026-10-05, LL-01).
 *
 * Visitors belongs to another session (7). This routes into it and passes
 * `seat=landlord`, because R7 says that log is READ ONLY from here — it is the
 * tenant's record, and a landlord reading it must not be able to add a row to
 * it. R7's second button, "Message", is gone: it opened a thread by the
 * LEASE's id, which is not a thread id, and the thread screen is not open to a
 * landlord at all (mobile audit 2026-10-05, LL-16).
 */
import { View, ScrollView } from 'react-native';
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
  Icon,
  ListRow,
  MoneyAmount,
  SectionLabel,
  StatusBadge,
  Text,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useDomain } from '@/domain';
import { useT, type Translate } from '@/i18n/i18n';
import {
  findLease,
  LEASES_KEY,
  newestPerLease,
  periodLabel,
  RENT_ROLL_KEY,
  seedLeases,
  seedRentRoll,
  useLandlordRead,
  type RentRow,
} from '@/data/landlord';

/** The lease's latest charge on the roll, as one sentence, named by its month. */
function latestRentLine(row: RentRow | undefined, t: Translate): string {
  if (!row) return t('landlord.lease.notBilled');
  const standing =
    row.state === 'paid'
      ? row.mock
        ? t('landlord.rent.chipPaidMock')
        : t('landlord.rent.chipPaid', { date: row.on ?? '' })
      : row.state === 'due'
        ? t('landlord.rent.chipDue', { date: row.on ?? '' })
        : t('landlord.rent.chipOverdue', { days: row.days ?? 0 });
  const month = periodLabel(row.periodMonth, t);
  return month ? `${month} · ${standing}` : standing;
}

export function LandlordLeaseDetail({ id }: { id: string }) {
  const { c, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const t = useT();
  const { workspace } = useDomain();

  const leases = useLandlordRead(LEASES_KEY, seedLeases);
  const roll = useLandlordRead(RENT_ROLL_KEY, seedRentRoll);

  const lease = findLease(leases.data ?? [], id);
  const row = newestPerLease(roll.data ?? []).find((r) => r.leaseId === lease?.id);

  // Loading is a real state here: `useLandlordRead` skeletons the cold read,
  // and rendering "not found" underneath it would accuse the reader of
  // following a dead link every time they open a lease from a cold start.
  if (leases.status === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: c.bgApp }}>
        <BackHeader />
        <View style={{ paddingTop: insets.top + 80, paddingHorizontal: space[4] }}>
          <Text
            accessibilityRole="progressbar"
            accessibilityLabel={t('state.loading')}
            size="sm"
            color="textMuted"
          >
            {t('state.loading')}
          </Text>
        </View>
      </View>
    );
  }

  // A read that failed is not a lease that is missing. It used to fall through
  // to "That lease is not here", which tells the reader the record is gone when
  // all that happened is a failed read (mobile audit 2026-10-05, LL-21).
  if (leases.status === 'error') {
    return (
      <View style={{ flex: 1, backgroundColor: c.bgApp }}>
        <BackHeader />
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: space[4] }}>
          <ErrorState
            title={t('state.errorTitle')}
            body={t('state.errorBody', { label: t('landlord.leaseLabel') })}
            detail={leases.error?.message}
            onRetry={leases.retry}
          />
        </View>
      </View>
    );
  }

  if (!lease) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bgApp }}>
        <BackHeader />
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            paddingHorizontal: space[4],
            paddingBottom: insets.bottom + 40,
          }}
        >
          <EmptyState
            icon="fileText"
            title={t('landlord.notFoundTitle')}
            body={t('landlord.notFoundBody')}
            action={
              <Button variant="outline" size="sm" onPress={() => router.replace('/leases')}>
                {t('landlord.backToLeases')}
              </Button>
            }
          />
        </View>
      </View>
    );
  }

  const contractMeta =
    lease.landlordSignedOn && lease.tenantSignedOn
      ? t('landlord.lease.contractSigned', { date: lease.tenantSignedOn })
      : lease.landlordSignedOn
        ? t('landlord.lease.contractAwaitingTenant', { date: lease.landlordSignedOn })
        : t('landlord.lease.contractAwaitingYou');

  const go = (pathname: '/lease/[leaseId]/contract' | '/lease/[leaseId]/caution' | '/lease/[leaseId]/filing') =>
    router.push({ pathname, params: { leaseId: lease.id } });

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <BackHeader />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 56,
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: space[4],
          gap: space[4],
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header — the tenant, because this is the landlord's record of them */}
        <View style={{ gap: 12 }}>
          <Text
            family="mono"
            weight="semibold"
            size="xs"
            color="textMuted"
            style={{ letterSpacing: 1 }}
          >
            {lease.ref}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
            <Avatar name={lease.tenant} size={52} />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text
                accessibilityRole="header"
                family="display"
                weight="semibold"
                size="xl"
                color="textStrong"
                numberOfLines={1}
                style={{ letterSpacing: -0.3 }}
              >
                {lease.tenant}
              </Text>
              <Text size="sm" color="textMuted" numberOfLines={1}>
                {lease.unit} · {workspace.name}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <StatusBadge domain="lease" state={lease.state} />
            <Badge tone="neutral">
              {t(lease.tenure === 'long_term' ? 'landlord.tenureLong' : 'landlord.tenureShort')}
            </Badge>
            <StatusBadge domain="filing" state={lease.filing.state} />
          </View>
          <Text size="xs" color="textSubtle">
            {t('landlord.lease.term', { start: lease.startDate, end: lease.endDate })}
          </Text>
        </View>

        {lease.moveOutNotice ? (
          <Card variant="tint">
            <View style={{ flexDirection: 'row', gap: 11 }}>
              <Icon name="clock" size={18} color={c.warning600} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text weight="semibold" size="sm" color="brand900">
                  {t('landlord.lease.noticeTitle')}
                </Text>
                <Text size="xs" color="brand900" style={{ opacity: 0.8, lineHeight: 18 }}>
                  {t('landlord.lease.noticeBody', { date: lease.moveOutNotice })}
                </Text>
              </View>
            </View>
          </Card>
        ) : null}

        {/* R7's dark card. In the teal palette a "dark card" is the RAISED tint
            surface (ADR-019 §3.4): `surfaceInverse` would flip to near-white in
            the dark scheme, and the brief forbids a white card on a mobile dark
            screen. Layout and hierarchy from the frame, colour from the
            palette — decision D1. */}
        <Card variant="tint">
          <View style={{ flexDirection: 'row', gap: space[4] }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text
                weight="bold"
                size="2xs"
                color="brand900"
                style={{ letterSpacing: 0.9, textTransform: 'uppercase', opacity: 0.7 }}
              >
                {t('landlord.lease.monthlyRent')}
              </Text>
              <MoneyAmount value={lease.rent} strong size="xl" />
            </View>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{ width: 1, backgroundColor: c.borderDefault }}
            />
            <View style={{ flex: 1.2, gap: 4 }}>
              <Text
                weight="bold"
                size="2xs"
                color="brand900"
                style={{ letterSpacing: 0.9, textTransform: 'uppercase', opacity: 0.7 }}
              >
                {t('landlord.lease.latestRent')}
              </Text>
              <Text weight="semibold" size="sm" color="brand900" style={{ lineHeight: 19 }}>
                {latestRentLine(row, t)}
              </Text>
            </View>
          </View>
        </Card>

        {lease.placement ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <Icon name="key" size={14} color={c.textSubtle} />
            <Text size="xs" color="textSubtle" style={{ flex: 1 }}>
              {t('landlord.lease.placement', {
                broker: lease.placement.broker,
                fee: `RWF ${lease.placement.fee.toLocaleString('en-US')}`,
              })}
            </Text>
          </View>
        ) : null}

        <SectionLabel>{t('landlord.lease.records')}</SectionLabel>
        <Card bodyStyle={{ paddingVertical: 4 }}>
          <View>
            <ListRow
              icon="fileText"
              title={t('landlord.lease.rowContract')}
              subtitle={contractMeta}
              divider
              onPress={() => go('/lease/[leaseId]/contract')}
            />
            <ListRow
              icon="shield"
              title={t('landlord.lease.rowCaution')}
              subtitle={t(`status.caution.${lease.caution.state}` as const)}
              trailing={<MoneyAmount value={lease.caution.amount} size="sm" />}
              divider
              onPress={() => go('/lease/[leaseId]/caution')}
            />
            <ListRow
              icon="receipt"
              title={t('landlord.lease.rowFiling')}
              subtitle={lease.filing.reference ?? t(`status.filing.${lease.filing.state}` as const)}
              divider
              onPress={() => go('/lease/[leaseId]/filing')}
            />
            <ListRow
              icon="wallet"
              title={t('landlord.lease.rowRent')}
              subtitle={
                lease.periodsPaid === 0
                  ? t('landlord.lease.rentNone')
                  : t('landlord.lease.rentPeriods', { count: lease.periodsPaid })
              }
              // The roll is the only ledger there is, and it is the whole
              // workspace rather than this lease. Saying where the row goes
              // beats a chevron that lands somewhere wider than expected.
              accessibilityHint={t('landlord.lease.rentHint')}
              onPress={() => router.push('/')}
            />
          </View>
        </Card>

        {/* R7's outline button. It leaves this surface for a record another
            session owns, so it does not pretend to do the work here. */}
        <Button
          variant="outline"
          block
          leadingIcon="users"
          accessibilityLabel={t('landlord.lease.visitorsA11y', { name: lease.tenant })}
          onPress={() =>
            router.push({
              pathname: '/lease/[leaseId]/visitors',
              // R7: the landlord reads this log, never writes to it. The
              // tenant's own screen (session 7) owns the route; this is the
              // contract between the two seats.
              params: { leaseId: lease.id, seat: 'landlord' },
            })
          }
        >
          {t('landlord.lease.visitors')}
        </Button>

        {/* The two rules a landlord must not get wrong. The "Payments · mock
            adapter" chip that sat on this card is gone: nothing on this
            screen moves money, so there was no payment for it to describe
            (mobile audit 2026-10-05, LL-13). */}
        <View
          style={{
            gap: 10,
            padding: space[3],
            borderRadius: radius.md,
            backgroundColor: c.surface2,
          }}
        >
          <Text size="xs" color="textMuted" style={{ lineHeight: 17 }}>
            {t('landlord.filing.note')}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
