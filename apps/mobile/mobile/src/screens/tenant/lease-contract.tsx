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
 * Download is mocked and says so, because storage is not wired (F-S09) and
 * ui-rules.md's adapter rule is that a mocked success must never look real.
 */
import { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BackHeader,
  Button,
  Card,
  EmptyState,
  MoneyAmount,
  SectionLabel,
  SegmentedTabs,
  Text,
  useToast,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { useTenancy } from '@/data/tenancy-store';
import { TENANT } from '@/data/rentals';
import { formatFullDay } from './dates';
import { LeaseError, LeaseLoading, LeaseMissing } from './lease-gate';

type DocLocale = 'en' | 'rw';

export function LeaseContract() {
  const { c, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const toast = useToast();
  const { leaseId } = useLocalSearchParams<{ leaseId?: string }>();

  const read = useTenancy(leaseId);
  const lease = read.data;
  const [locale, setLocale] = useState<DocLocale>('en');

  if (read.status === 'loading') return <LeaseLoading rows={5} />;
  if (read.status === 'error') return <LeaseError error={read.error} onRetry={read.retry} />;
  if (!lease) return <LeaseMissing />;

  const clauses = locale === 'en' ? lease.terms : lease.termsRw;

  const rows: { label: string; value: string }[] = [
    { label: t('contract.landlord'), value: `${lease.landlord} · ${lease.landlordOrg}` },
    { label: t('contract.tenant'), value: TENANT.user },
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
              <View
                key={row.label}
                accessible
                accessibilityLabel={`${row.label}: ${row.value}`}
                style={{ flexDirection: 'row', gap: space[3] }}
              >
                <Text size="sm" color="textSubtle" style={{ width: 82 }}>
                  {row.label}
                </Text>
                <Text size="sm" color="textBody" style={{ flex: 1, lineHeight: 19 }}>
                  {row.value}
                </Text>
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

        <Button
          variant="outline"
          size="lg"
          block
          leadingIcon="download"
          onPress={() => toast.show(t('contract.downloadToast'), 'neutral')}
        >
          {t('contract.download')}
        </Button>
      </ScrollView>
    </View>
  );
}
