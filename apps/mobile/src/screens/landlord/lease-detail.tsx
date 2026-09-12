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
 * next-due the fixtures cannot support, the card prints THIS month's real
 * standing off the roll: "August 2026 · Paid Aug 01", or Due, or Overdue. A
 * number a landlord might act on has to be a number the system actually holds.
 *
 * Visitors and the message thread belong to other sessions (7 and 6). This
 * routes into them and passes `seat=landlord` on the visitor log, because R7
 * says that log is READ ONLY from here — it is the tenant's record, and a
 * landlord reading it must not be able to add a row to it.
 */
import { View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AdapterChip,
  Avatar,
  BackHeader,
  Badge,
  Button,
  Card,
  EmptyState,
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
  RENT_PERIOD,
  RENT_ROLL_KEY,
  seedLeases,
  seedRentRoll,
  useLandlordRead,
  type RentRow,
} from '@/data/landlord';

/** The lease's standing on this month's roll, as one sentence. */
function thisMonthLine(row: RentRow | undefined, t: Translate): string {
  if (!row) return t('landlord.lease.notBilled');
  if (row.state === 'paid') {
    return row.mock
      ? `${RENT_PERIOD} · ${t('landlord.rent.chipPaidMock')}`
      : `${RENT_PERIOD} · ${t('landlord.rent.chipPaid', { date: row.on ?? '' })}`;
  }
  if (row.state === 'due') {
    return `${RENT_PERIOD} · ${t('landlord.rent.chipDue', { date: row.on ?? '' })}`;
  }
  return `${RENT_PERIOD} · ${t('landlord.rent.chipOverdue', { days: row.days ?? 0 })}`;
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
  const row = (roll.data ?? []).find((r) => r.leaseId === lease?.id);

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
                {t('landlord.lease.thisMonth')}
              </Text>
              <Text weight="semibold" size="sm" color="brand900" style={{ lineHeight: 19 }}>
                {thisMonthLine(row, t)}
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
              // The roll is the only ledger this build has, and it is the
              // whole building rather than this lease. Saying where the row
              // goes beats a chevron that lands somewhere wider than expected.
              accessibilityHint={t('landlord.lease.rentHint', { month: RENT_PERIOD })}
              onPress={() => router.push('/rent-roll')}
            />
          </View>
        </Card>

        {/* R7's two outline buttons. Both leave this surface for a record
            another session owns, so neither pretends to do the work here. */}
        <View style={{ flexDirection: 'row', gap: space[2] }}>
          <View style={{ flex: 1 }}>
            <Button
              variant="outline"
              block
              leadingIcon="message"
              accessibilityLabel={t('landlord.lease.messageA11y', { name: lease.tenant })}
              onPress={() =>
                router.push({ pathname: '/thread/[threadId]', params: { threadId: lease.id } })
              }
            >
              {t('landlord.lease.message')}
            </Button>
          </View>
          <View style={{ flex: 1 }}>
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
          </View>
        </View>

        <View
          style={{
            gap: 10,
            padding: space[3],
            borderRadius: radius.md,
            backgroundColor: c.surface2,
          }}
        >
          <AdapterChip label={t('landlord.mockAdapter')} hint={t('landlord.mockAdapterHint')} />
          <Text size="xs" color="textMuted" style={{ lineHeight: 17 }}>
            {t('landlord.filing.note')}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
