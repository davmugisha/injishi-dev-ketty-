/**
 * Frame R16 · e-Sign lease — the tenant's half of FL21 Path A, step 3.
 *
 * **Nothing on this screen is a field.** The contract splits in two and the
 * split is the point: the term facts (parties, unit, rent, Caution, dates) are
 * locked and rendered as a summary, and the clause body opens in its own
 * viewer. A lease whose rent changes is a new lease, not an edit (FL21 §5).
 *
 * **The primary needs both the ink and the tick, and neither is politeness.**
 * FL21 §7 records the signer, the device and the timestamp as an e-signature
 * audit; a consent nobody affirmed is not a consent, and a signature nobody
 * drew is not a signature. So the button is disabled and — more usefully — the
 * bar above it says which of the two is still missing, rather than leaving a
 * reader to guess why a button will not press.
 *
 * The checkbox names **Law 058/2021** because that is the instrument that gives
 * an electronic signature the same force as one on paper in Rwanda, and a
 * consent that does not name what is being consented to is decoration.
 *
 * Signing writes through `useFixtureMutation`: the lease flips to `active`, the
 * rent schedule starts (FL21 step 4 — see `applySignature`), and My leases and
 * Rent both re-render from the same store. The screen says plainly that the
 * signature never leaves the device in this build.
 */
import { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BackHeader,
  Button,
  Card,
  Icon,
  ListRow,
  MoneyAmount,
  PressableScale,
  SectionLabel,
  SignaturePad,
  StatusBadge,
  StickyBar,
  Text,
  todayIso,
  useToast,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT, type Translate } from '@/i18n/i18n';
import { useSignLease, useTenancy } from '@/data/tenancy-store';
import { type Tenancy } from '@/data/rentals';
import { formatFullDay, monthsBetween } from './dates';
import { LeaseError, LeaseLoading, LeaseMissing } from './lease-gate';

/** Frame R16's three columns: what it costs, what is held, how long it runs. */
function TermColumns({ lease, t }: { lease: Tenancy; t: Translate }) {
  const { c, space } = useTheme();
  const months = monthsBetween(lease.startOn, lease.endOn);

  const cell = (label: string, body: React.ReactNode) => (
    <View style={{ flex: 1, gap: 4 }}>
      <Text
        weight="bold"
        size="2xs"
        color="textSubtle"
        style={{ letterSpacing: 1, textTransform: 'uppercase' }}
      >
        {label}
      </Text>
      {body}
    </View>
  );

  return (
    <View style={{ gap: space[3] }}>
      <Text weight="semibold" size="md" color="textStrong">
        {t('sign.summaryOf', { unit: lease.unit, org: lease.landlordOrg })}
      </Text>
      <View style={{ height: 1, backgroundColor: c.borderSubtle }} />
      <View style={{ flexDirection: 'row', gap: space[3] }}>
        {cell(t('sign.rent'), <MoneyAmount value={lease.rent} strong size="md" />)}
        {cell(t('sign.cautionCol'), <MoneyAmount value={lease.caution} strong size="md" />)}
        {cell(
          t('sign.termCol'),
          <Text weight="semibold" size="md" color="textStrong">
            {t('sign.termMonths', { count: months })}
          </Text>,
        )}
      </View>
    </View>
  );
}

export function LeaseSign() {
  const { c, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const t = useT();
  const toast = useToast();
  const { leaseId } = useLocalSearchParams<{ leaseId?: string }>();

  const read = useTenancy(leaseId);
  const lease = read.data;
  const sign = useSignLease();

  const [hasSignature, setHasSignature] = useState(false);
  const [consented, setConsented] = useState(false);

  const signing = sign.status === 'saving';

  if (read.status === 'loading') return <LeaseLoading rows={4} />;
  if (read.status === 'error') return <LeaseError error={read.error} onRetry={read.retry} />;
  if (!lease) return <LeaseMissing />;

  const signed = lease.leaseState !== 'pending_signature';

  const activate = () => {
    void sign.mutate({ leaseId: lease.id, signedOn: todayIso() }).then(() => {
      toast.show(t('sign.toast', { date: formatFullDay(lease.startOn, t) }), 'success');
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <BackHeader />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 56,
          paddingBottom: insets.bottom + 150,
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
            {signed ? t('sign.signedTitle') : t('sign.title')}
          </Text>
          <Text size="sm" color="textMuted" style={{ lineHeight: 20 }}>
            {lease.ref} · {lease.landlordOrg}
          </Text>
        </View>

        <Card>
          <TermColumns lease={lease} t={t} />
        </Card>

        {/* The clauses are a document, so they open as one rather than being
            crammed into a 260pt scroll box on the screen that asks you to
            agree to them. */}
        <Card bodyStyle={{ paddingVertical: 4 }}>
          <ListRow
            icon="fileText"
            title={t('sign.readContract')}
            subtitle={t('sign.readContractMeta')}
            onPress={() =>
              router.push({
                pathname: '/lease/[leaseId]/contract',
                params: { leaseId: lease.id },
              })
            }
          />
        </Card>

        {signed ? (
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
                <Text weight="semibold" size="md" color="brand900" style={{ flexShrink: 1 }}>
                  {lease.signedOn
                    ? t('sign.alreadyActiveTitle')
                    : t('sign.signedTitle')}
                </Text>
                <StatusBadge domain="lease" state={lease.leaseState} />
              </View>
              <Text size="sm" color="brand900" style={{ opacity: 0.82, lineHeight: 19 }}>
                {lease.signedOn
                  ? t('sign.alreadyActiveBody', { date: formatFullDay(lease.signedOn, t) })
                  : t('sign.signedBody', { date: formatFullDay(lease.startOn, t) })}
              </Text>
              <Text size="xs" color="brand900" style={{ opacity: 0.6, lineHeight: 18 }}>
                {t('sign.notWired')}
              </Text>
            </View>
          </Card>
        ) : (
          <>
            <SectionLabel>{t('sign.yourSignature')}</SectionLabel>
            <SignaturePad onChange={setHasSignature} />

            <PressableScale
              accessibilityRole="checkbox"
              accessibilityLabel={t('sign.consentLabel')}
              accessibilityHint={t('sign.consentHint')}
              accessibilityState={{ checked: consented }}
              disabled={signing}
              onPress={() => setConsented((v) => !v)}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: space[3],
                minHeight: 44,
                padding: space[3],
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: consented ? c.borderBrand : c.borderDefault,
                backgroundColor: consented ? c.bgTint : c.surface1,
              }}
            >
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={{
                  width: 22,
                  height: 22,
                  marginTop: 1,
                  borderRadius: radius.xs,
                  borderWidth: 1.5,
                  borderColor: consented ? c.action : c.borderStrong,
                  backgroundColor: consented ? c.action : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {consented ? <Icon name="check" size={14} color={c.bgApp} /> : null}
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text size="sm" color="textBody" style={{ lineHeight: 19 }}>
                  {t('sign.consent')}
                </Text>
                <Text size="xs" color="textMuted" style={{ lineHeight: 17 }}>
                  {t('sign.consentHint')}
                </Text>
              </View>
            </PressableScale>
          </>
        )}
      </ScrollView>

      <StickyBar>
        {signed ? (
          <>
            <View style={{ flex: 1, paddingRight: space[3] }}>
              <Text size="xs" color="textMuted">
                {t('sign.signedTitle')}
              </Text>
              <Text weight="semibold" size="md" color="textStrong" numberOfLines={1}>
                {lease.unit}
              </Text>
            </View>
            <Button
              variant="primary"
              onPress={() =>
                router.replace({ pathname: '/lease/[id]', params: { id: lease.id } })
              }
            >
              {t('sign.openLease')}
            </Button>
          </>
        ) : (
          <>
            {/* Which of the two conditions is still missing, rather than a
                disabled button and no reason for it. */}
            <View style={{ flex: 1, paddingRight: space[3] }}>
              <Text size="xs" color="textMuted">
                {!hasSignature
                  ? t('sign.needSignature')
                  : !consented
                    ? t('sign.needConsent')
                    : t('sign.ready')}
              </Text>
              <MoneyAmount value={lease.rent} strong tone="brand" size="lg" />
            </View>
            <Button
              variant="primary"
              leadingIcon="check"
              disabled={!hasSignature || !consented || signing}
              onPress={activate}
            >
              {signing ? t('sign.signing') : t('sign.action')}
            </Button>
          </>
        )}
      </StickyBar>
    </View>
  );
}
