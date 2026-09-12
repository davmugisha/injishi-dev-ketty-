/**
 * Portfolio — the Residence home for a Landlord: rent-roll KPIs, a compliance
 * summary, and a preview of leases needing attention.
 *
 * A P1 surface. The MVP Residence tab set is the tenant one, so this is parked
 * behind `/portfolio` with `href: null` (see `app/(tabs)/_layout.tsx`) rather
 * than deleted — it keeps its three list states for the same reason the
 * Directory does.
 */
import { View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Screen,
  SectionLabel,
  StatCard,
  Card,
  Avatar,
  MoneyAmount,
  StatusBadge,
  TaxBadge,
  Text,
  WorkspaceChip,
  EmptyState,
  ErrorState,
  SkeletonList,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { useFixture } from '@/data/use-fixture';
import { LEASES, WORKSPACE } from '@/data/rentals';

export function Portfolio() {
  const { c } = useTheme();
  const router = useRouter();
  const t = useT();

  const read = useFixture('rent-roll', () =>
    LEASES.filter((l) => l.rentStatus !== 'paid' || l.leaseState !== 'active').slice(0, 3),
  );
  const attention = read.data ?? [];

  return (
    <Screen
      greeting={t('portfolio.greeting', { name: WORKSPACE.user.split(' ')[0] })}
      title={t('portfolio.title')}
      action={<WorkspaceChip name={WORKSPACE.name} role={WORKSPACE.role} onPress={() => router.push('/switch')} />}
    >
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <StatCard
          label={t('portfolio.rentCollected')}
          unit="RWF"
          value="1.14M"
          delta="+4%"
          caption={t('portfolio.july')}
          icon="wallet"
        />
        <StatCard
          label={t('portfolio.outstanding')}
          unit="RWF"
          value="1.00M"
          deltaDirection="down"
          caption={t('portfolio.twoLeases')}
          icon="receipt"
        />
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <StatCard label={t('portfolio.activeLeases')} value="4" caption={t('portfolio.oneEnding')} icon="key" />
        <StatCard
          label={t('portfolio.cautionHeld')}
          unit="RWF"
          value="2.16M"
          caption={t('portfolio.escrow')}
          icon="shield"
        />
      </View>

      <SectionLabel>{t('portfolio.compliance')}</SectionLabel>
      <Card variant="tint">
        <View style={{ gap: 11 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text size="sm" color="brand900">
              {t('portfolio.contractsFiled')}
            </Text>
            <StatusBadge domain="filing" state="filed" />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text size="sm" color="brand900">
              {t('portfolio.rentalIncome')}
            </Text>
            <TaxBadge status="compliant" />
          </View>
          <Text size="xs" color="brand900" style={{ opacity: 0.75, lineHeight: 18 }}>
            {t('portfolio.complianceNote')}
          </Text>
        </View>
      </Card>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
        <SectionLabel>{t('portfolio.needsAttention')}</SectionLabel>
        <Text
          weight="semibold"
          size="sm"
          color="brand700"
          accessibilityRole="link"
          onPress={() => router.push('/leases')}
        >
          {t('portfolio.viewAll')}
        </Text>
      </View>

      {read.status === 'loading' ? (
        <SkeletonList rows={3} label={t('state.loadingList', { label: t('portfolio.listLabel') })} />
      ) : read.status === 'error' ? (
        <ErrorState
          title={t('state.errorTitle')}
          body={t('state.errorBody', { label: t('portfolio.listLabel') })}
          detail={read.error?.message}
          onRetry={read.retry}
        />
      ) : attention.length === 0 ? (
        <EmptyState icon="check" title={t('portfolio.emptyTitle')} body={t('portfolio.emptyBody')} />
      ) : (
        <Card>
          <View>
            {attention.map((l, i) => (
              <Pressable
                key={l.id}
                accessibilityRole="button"
                accessibilityLabel={t('portfolio.openLease', { tenant: l.tenant })}
                onPress={() => router.push({ pathname: '/lease/[id]', params: { id: l.id } })}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 11,
                  paddingVertical: 13,
                  borderBottomWidth: i < attention.length - 1 ? 1 : 0,
                  borderBottomColor: c.borderSubtle,
                }}
              >
                <Avatar name={l.tenant} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text weight="semibold" size="sm" color="textStrong" numberOfLines={1}>
                    {l.tenant}
                  </Text>
                  <Text size="xs" color="textMuted" numberOfLines={1}>
                    {l.property}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <MoneyAmount value={l.rent} strong size="sm" />
                  <StatusBadge domain="rent" state={l.rentStatus} />
                </View>
              </Pressable>
            ))}
          </View>
        </Card>
      )}
    </Screen>
  );
}
