/**
 * RRA filing — frame R10 (F-R10, FL27).
 *
 * The whole feature is a promise the landlord does nothing to keep: on the
 * second signature, Injishi generates the filing copy and files it within 15
 * days, with no landlord action. So this screen is a RECEIPT, not a worklist —
 * the acknowledgement number, the date, and the clock it met.
 *
 * **All three filing states are drawn, and the failed one is the reason.**
 * FL27 §6 and F-R10 both use the same phrase: a failure is surfaced to the
 * landlord with the ready-to-file copy as a fallback, **never silently
 * dropped**. A screen that only renders `filed` would be the silent drop. So
 * `pending` says what it is waiting for, and `failed` says what went wrong, that
 * it is retrying on its own, and offers the copy — that is the whole
 * never-silent guarantee, on one screen.
 *
 * Two sentences on this page are business rules rather than copy, and both are
 * load-bearing: Injishi files the contract but does not compute or remit the
 * tax, and **a Lease never emits an EBM invoice** (blueprint business rule 4).
 * A landlord who believes either of the opposites has a compliance problem the
 * product caused.
 */
import { View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AdapterChip,
  BackHeader,
  Button,
  Card,
  EmptyState,
  Icon,
  SectionLabel,
  StatusBadge,
  Text,
  Timeline,
  type TimelineEntry,
  useToast,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { findLease, LEASES_KEY, seedLeases, useLandlordRead } from '@/data/landlord';

export function LandlordFiling({ leaseId }: { leaseId: string }) {
  const { c, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const t = useT();
  const toast = useToast();

  const read = useLandlordRead(LEASES_KEY, seedLeases);
  const lease = findLease(read.data ?? [], leaseId);

  if (read.status === 'loading') {
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
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: space[4] }}>
          <EmptyState
            icon="receipt"
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

  const filing = lease.filing;
  const filed = filing.state === 'filed';
  const failed = filing.state === 'failed';
  const signed = !!filing.signedOn;

  const entries: TimelineEntry[] = [
    signed
      ? {
          key: 'signed',
          title: t('landlord.filing.stepSigned'),
          meta: filing.signedOn,
          body: t('landlord.filing.stepSignedBody'),
          state: 'done',
        }
      : {
          key: 'awaiting',
          title: t('landlord.filing.stepAwaiting'),
          body: t('landlord.filing.stepAwaitingBody'),
          state: 'current',
        },
    {
      key: 'queued',
      title: t('landlord.filing.stepQueued'),
      meta: filing.queuedOn,
      body: t('landlord.filing.stepQueuedBody'),
      state: filing.queuedOn ? 'done' : 'pending',
    },
    {
      key: 'filed',
      title: t('landlord.filing.stepFiled'),
      meta: filing.filedOn,
      body: filed ? filing.reference : failed ? filing.failure : undefined,
      state: filed ? 'done' : failed ? 'current' : 'pending',
    },
  ];

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
        <Text
          accessibilityRole="header"
          family="display"
          weight="semibold"
          size="2xl"
          color="textStrong"
          style={{ letterSpacing: -0.4 }}
        >
          {t('landlord.filing.title')}
        </Text>

        {filed ? (
          /* R10's tint card: the acknowledgement, which is the only thing a
             landlord ever needs off this screen. */
          <Card variant="tint">
            <View style={{ gap: 11 }}>
              <StatusBadge domain="filing" state="filed" label={t('landlord.filing.filedBadge')} />
              <View style={{ gap: 3 }}>
                <Text
                  weight="bold"
                  size="2xs"
                  color="brand900"
                  style={{ letterSpacing: 0.9, textTransform: 'uppercase', opacity: 0.7 }}
                >
                  {t('landlord.filing.ack')}
                </Text>
                <Text family="mono" weight="semibold" size="xl" color="brand900">
                  {filing.reference}
                </Text>
              </View>
              <Text size="sm" color="brand900" style={{ opacity: 0.8 }}>
                {filing.daysToFile === 1
                  ? t('landlord.filing.filedLineOneDay', { date: filing.filedOn ?? '' })
                  : t('landlord.filing.filedLine', {
                      date: filing.filedOn ?? '',
                      days: filing.daysToFile ?? 0,
                    })}
              </Text>
            </View>
          </Card>
        ) : failed ? (
          /* FL27 §6: never silently dropped. The failure, the retry and the
             fallback copy, all on the screen at once. */
          <View
            style={{
              gap: 11,
              padding: 16,
              borderRadius: radius.lg,
              backgroundColor: c.danger100,
              borderWidth: 1,
              borderColor: c.danger600,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
              <Icon name="alertCircle" size={18} color={c.danger600} />
              <Text weight="semibold" size="md" color={c.danger600}>
                {t('landlord.filing.failedTitle')}
              </Text>
            </View>
            <Text size="sm" color={c.danger600} style={{ lineHeight: 19 }}>
              {t('landlord.filing.failedBody')}
            </Text>
            <Button
              variant="outline"
              size="sm"
              leadingIcon="refreshCw"
              onPress={() => toast.show(t('landlord.filing.retried'), 'warning')}
            >
              {t('landlord.filing.retry')}
            </Button>
          </View>
        ) : (
          <Card variant="tint">
            <View style={{ gap: 9 }}>
              <StatusBadge domain="filing" state="pending" />
              <Text weight="semibold" size="md" color="brand900">
                {t('landlord.filing.pendingTitle')}
              </Text>
              <Text size="sm" color="brand900" style={{ opacity: 0.8, lineHeight: 19 }}>
                {t('landlord.filing.pendingBody')}
              </Text>
            </View>
          </Card>
        )}

        <AdapterChip
          label={
            filed
              ? t('landlord.filing.adapterMet')
              : failed
                ? t('landlord.filing.adapterFailed')
                : t('landlord.filing.adapterWaiting')
          }
        />

        <SectionLabel>{t('landlord.filing.timeline')}</SectionLabel>
        <Card>
          <Timeline entries={entries} />
        </Card>

        <Button
          variant="outline"
          size="lg"
          block
          leadingIcon="download"
          onPress={() => toast.show(t('landlord.filing.downloadMock'), 'neutral')}
        >
          {t('landlord.filing.download')}
        </Button>

        <Text size="xs" color="textSubtle" style={{ lineHeight: 17 }}>
          {t('landlord.filing.note')}
        </Text>
      </ScrollView>
    </View>
  );
}
