/**
 * The bilingual contract viewer — what frame R15's "Contract · Download" row
 * and frame R16's "Read full contract (EN · RW)" row both open.
 *
 * **Both texts are on the lease record, and that is deliberate.** Every
 * contract in the fixtures closes with a clause saying the English and
 * Kinyarwanda texts are equally authoritative, which is only true if both
 * travel with the record. So the clause bodies live in `Tenancy.terms` and
 * `Tenancy.termsRw` as data rather than in the message catalogue: the catalogue
 * holds what the app says, this holds what the parties signed. A screen that
 * translated a contract at render time would be showing a text nobody agreed
 * to.
 *
 * The language segment therefore switches the DOCUMENT, not the interface — the
 * chrome around it stays in the reader's own locale. Those are two different
 * choices and conflating them is how a reader ends up unable to find their way
 * back out of a language they cannot read.
 *
 * **There is no download, and nothing says there is.** The button used to show
 * a toast that downloading was "mocked in this build", which is a fake control
 * carrying developer copy (mobile audit 2026-10-05, TN-14, XC-16). It returns
 * with the stored contract and its offline read (gaps.md B6).
 *
 * **The Tenant party is the person holding the phone**, from the server's
 * profile, and never the fixture persona that used to fill it (TN-03): a name
 * only when the server has one, a skeleton while it is being read, and "Name
 * not added yet" otherwise. Once the tenant API lands the party comes from the
 * lease record instead, which is where a signed contract's names belong.
 */
import { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BackHeader,
  Card,
  EmptyState,
  MoneyAmount,
  SectionLabel,
  SegmentedTabs,
  Skeleton,
  Text,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { useTenancy } from '@/data/tenancy-store';
import { useMyIdentity } from '@/queries/profile';
import { formatFullDay } from './dates';
import { LeaseError, LeaseLoading, LeaseMissing } from './lease-gate';

type DocLocale = 'en' | 'rw';

export function LeaseContract() {
  const { c, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const identity = useMyIdentity();
  const { leaseId } = useLocalSearchParams<{ leaseId?: string }>();

  const read = useTenancy(leaseId);
  const lease = read.data;
  const [locale, setLocale] = useState<DocLocale>('en');

  if (read.status === 'loading') return <LeaseLoading rows={5} />;
  if (read.status === 'error') return <LeaseError error={read.error} onRetry={read.retry} />;
  if (!lease) return <LeaseMissing />;

  const clauses = locale === 'en' ? lease.terms : lease.termsRw;

  /** `null` is a value still being read, drawn as a skeleton. */
  const rows: { label: string; value: string | null }[] = [
    { label: t('contract.landlord'), value: `${lease.landlord} · ${lease.landlordOrg}` },
    {
      label: t('contract.tenant'),
      value: identity.fromServer
        ? identity.name
        : identity.pending
          ? null
          : t('identity.unnamed'),
    },
    { label: t('contract.room'), value: `${lease.unit}, ${lease.address}` },
    {
      label: t('contract.term'),
      value: `${formatFullDay(lease.startOn, t)} — ${formatFullDay(lease.endOn, t)}`,
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <BackHeader />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 56,
          paddingBottom: insets.bottom + space[8],
          paddingHorizontal: space[4],
          gap: space[4],
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: 6 }}>
          <Text
            accessibilityRole="header"
            family="display"
            weight="semibold"
            size="xl"
            color="textStrong"
            style={{ letterSpacing: -0.3 }}
          >
            {t('contract.title')}
          </Text>
          <Text size="sm" color="textMuted" style={{ lineHeight: 20 }}>
            {lease.ref} · {lease.unit} · {lease.landlordOrg}
          </Text>
        </View>

        <View style={{ gap: space[2] }}>
          <SectionLabel>{t('contract.language')}</SectionLabel>
          <SegmentedTabs
            value={locale}
            onChange={(v) => setLocale(v as DocLocale)}
            items={[
              { value: 'en', label: t('contract.en') },
              { value: 'rw', label: t('contract.rw') },
            ]}
          />
        </View>

        {/* The locked term facts, which are the same in either language. */}
        <Card title={t('contract.parties')}>
          <View style={{ gap: space[3] }}>
            {rows.map((row) => (
              // The label column is a floor, not a width, and the value drops
              // under it when the two no longer fit side by side. A fixed 82dp
              // broke "Landlord" mid-word at large text sizes (mobile audit
              // 2026-10-05, TN-26).
              <View
                key={row.label}
                accessible
                accessibilityLabel={`${row.label}: ${row.value ?? t('state.loading')}`}
                style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space[3], rowGap: 2 }}
              >
                <Text size="sm" color="textSubtle" style={{ minWidth: 82, flexShrink: 0 }}>
                  {row.label}
                </Text>
                {row.value === null ? (
                  <View style={{ flexGrow: 1, flexBasis: 160, justifyContent: 'center' }}>
                    <Skeleton width={140} height={14} />
                  </View>
                ) : (
                  <Text
                    size="sm"
                    color="textBody"
                    style={{ flexGrow: 1, flexShrink: 1, flexBasis: 160, lineHeight: 19 }}
                  >
                    {row.value}
                  </Text>
                )}
              </View>
            ))}
            <View style={{ height: 1, backgroundColor: c.borderSubtle }} />
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: space[3],
              }}
            >
              <Text size="sm" color="textBody">
                {t('contract.rent')}
              </Text>
              <MoneyAmount value={lease.rent} strong size="md" />
            </View>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: space[3],
              }}
            >
              <Text size="sm" color="textMuted" style={{ flexShrink: 1 }}>
                {t('contract.caution')}
              </Text>
              <MoneyAmount value={lease.caution} size="md" />
            </View>
          </View>
        </Card>

        <SectionLabel>{t('contract.clauses')}</SectionLabel>

        {clauses.length === 0 ? (
          <EmptyState
            icon="fileText"
            title={t('contract.emptyTitle')}
            body={t('contract.emptyBody')}
          />
        ) : (
          <View
            style={{
              gap: space[4],
              padding: space[5],
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: c.borderSubtle,
              backgroundColor: c.surface1,
            }}
          >
            {clauses.map((clause, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: space[3] }}>
                <Text family="mono" size="xs" color="textSubtle" style={{ width: 18, lineHeight: 21 }}>
                  {i + 1}.
                </Text>
                <Text size="sm" color="textBody" style={{ flex: 1, lineHeight: 21 }}>
                  {clause}
                </Text>
              </View>
            ))}
            <Text size="xs" color="textSubtle" style={{ lineHeight: 18 }}>
              {t('contract.bilingual')}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
