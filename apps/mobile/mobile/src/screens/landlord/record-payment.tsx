/**
 * Record a payment — frame R1's sheet (F-R05, FL28 step 2).
 *
 * FL28 is explicit that v1 is mocked and the landlord marks the charge paid.
 * The whole design of this sheet is about making that honest. The card in the
 * middle is not a disclaimer nobody reads — it is three sentences the frame
 * wrote itself, and every one of them is load-bearing:
 *
 *   "This is the mock payments adapter. Recording here marks the month
 *    collected in the prototype and stamps the row mock. It moves no money and
 *    it is not a settled payment."
 *
 * The row it writes carries `mock: true` forever after, so the chip reads
 * "Paid · mock" rather than "Paid Aug 04", and the toast says the same thing a
 * third time. Three places, on purpose: `ui-rules.md` § Adapter Awareness is
 * that a mocked success must never look like a real one, and a landlord who
 * later reconciles against a bank statement has to be able to tell which rows
 * were real.
 *
 * When the API lands, the one thing this screen owes the server is an
 * `Idempotency-Key`. The operator app's rent roll already sends one and says
 * why in a sentence worth repeating: "a rent payment recorded twice tells a
 * tenant they owe nothing when they do, and nothing on the screen would show
 * it." `useFixtureMutation` is the seam that becomes `useMutation`.
 */
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Button,
  EmptyState,
  Icon,
  MoneyAmount,
  Sheet,
  Text,
  useToast,
  WriteError,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { readFixture, useFixtureMutation, writeFixture } from '@/data/use-fixture-mutation';
import { useOfflineSubmit } from '@/data/offline-submit';
import {
  applyRecordPayment,
  RENT_PERIOD,
  RENT_ROLL_KEY,
  seedRentRoll,
  useLandlordRead,
} from '@/data/landlord';

/** The date the mocked settlement stamps. The fixtures' own "today". */
const TODAY = 'Aug 04';

export function RecordPayment({ leaseId }: { leaseId: string }) {
  const { c, space, radius } = useTheme();
  const router = useRouter();
  const t = useT();
  const toast = useToast();

  const read = useLandlordRead(RENT_ROLL_KEY, seedRentRoll);
  const row = (read.data ?? []).find((r) => r.leaseId === leaseId);
  const record = useFixtureMutation(RENT_ROLL_KEY, applyRecordPayment, seedRentRoll);

  /**
   * The offline half (gaps.md §7's queued record-payment).
   *
   * This is the one queued action that looks like the EXCLUDED one and is not.
   * A tenant pressing "pay rent" is authorising money to move, and a queued
   * authorisation is one nobody gave at the moment it fired. A landlord
   * standing in front of a tenant who has just handed over cash is recording a
   * fact that has already happened, and a fact survives a delay. The lease and
   * the day are the idempotency key, so recording the same month twice is one
   * intent.
   */
  const queued = useOfflineSubmit<{ leaseId: string; on: string }>({
    kind: 'recordPayment',
    handler: (input) => {
      writeFixture(RENT_ROLL_KEY, applyRecordPayment(readFixture(RENT_ROLL_KEY, seedRentRoll()), input));
      // The fixture store cannot refuse and cannot be unreachable, so this
      // is always `ok`. The surface child that puts a real mutation here
      // (ADR-038 children 1 to 7) is where `refused` and `failed` start
      // being answered for real.
      return { status: 'ok' as const };
    },
    label: () => t('landlord.record.title'),
    idFor: (input) => `recordPayment-${input.leaseId}-${input.on}`,
  });

  const busy = record.status === 'saving';

  /**
   * Recording money received (gaps.md §5.1, P1 — `err=0` AND `a11y=0`, which
   * the document calls the worst pairing in the app).
   *
   * The landlord is standing in front of the tenant who has just handed over
   * cash. A write that fails silently and then reports success is a receipt
   * for a payment the ledger does not have, and the tenant leaves believing
   * they are paid up.
   */
  const confirm = async () => {
    if (!row || busy) return;
    if (queued.offline) {
      await queued.submit({ leaseId, on: TODAY });
      toast.show(t('queue.submittedWhenOnline'), 'warning');
      router.back();
      return;
    }
    await record.mutate({ leaseId, on: TODAY });
    if (record.status === 'error') return;
    toast.show(t('landlord.record.done'), 'warning');
    router.back();
  };

  // A row can vanish under this sheet — another surface settles it, or the
  // month rolls. Saying so beats a confirm button that writes to nothing.
  if (read.status === 'ready' && !row) {
    return (
      <Sheet title={t('landlord.record.title')} grabber>
        <EmptyState
          icon="alertCircle"
          title={t('landlord.record.goneTitle')}
          body={t('landlord.record.goneBody')}
          action={
            <Button variant="outline" size="sm" onPress={() => router.back()}>
              {t('landlord.record.cancel')}
            </Button>
          }
        />
      </Sheet>
    );
  }

  return (
    <Sheet
      title={t('landlord.record.title')}
      subtitle={
        row ? t('landlord.record.who', { name: row.name, unit: row.unit }) : t('state.loading')
      }
      grabber
      footer={
        <>
          {record.status === 'error' ? (
            <WriteError body="write.failedMoneyBody" onRetry={() => void confirm()} />
          ) : null}
          <Button
            variant="primary"
            size="lg"
            block
            leadingIcon="check"
            disabled={!row || busy}
            accessibilityLabel={
              row
                ? t('landlord.record.a11yConfirm', { name: row.name, unit: row.unit })
                : t('landlord.record.confirm')
            }
            accessibilityHint={t('landlord.record.a11yHint')}
            onPress={() => void confirm()}
          >
            {busy ? t('landlord.record.working') : t('landlord.record.confirm')}
          </Button>
          <Button variant="ghost" size="lg" block onPress={() => router.back()}>
            {t('landlord.record.cancel')}
          </Button>
        </>
      }
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: space[3],
          borderRadius: radius.md,
          backgroundColor: c.surface2,
        }}
      >
        <Text size="sm" color="textBody" style={{ flexShrink: 1 }}>
          {t('landlord.record.amount', { month: RENT_PERIOD })}
        </Text>
        <MoneyAmount value={row?.amount ?? 0} strong size="lg" />
      </View>

      {/* The disclosure. A warning ground rather than a muted note, because the
          one thing this sheet must not do is look routine. */}
      <View
        style={{
          gap: 8,
          padding: 14,
          borderRadius: radius.lg,
          backgroundColor: c.warning100,
          borderWidth: 1,
          borderColor: c.warning600,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="sparkles" size={16} color={c.warning600} />
          <Text weight="semibold" size="sm" color={c.warning600} style={{ flex: 1 }}>
            {t('landlord.record.warnTitle')}
          </Text>
        </View>
        <Text size="xs" color={c.warning600} style={{ lineHeight: 18 }}>
          {t('landlord.record.warnBody')}
        </Text>
      </View>
    </Sheet>
  );
}
