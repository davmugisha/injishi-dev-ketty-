/**
 * Record a payment — frame R1's sheet (F-R05, FL28 step 2).
 *
 * **It writes to the API now, because the rent roll it sits on reads the API.**
 * The roll moved to `GET /ops/rent-roll` in ADR-038 child 0, and this sheet was
 * left writing through `useFixtureMutation` into a fixture store nothing reads,
 * so a recorded payment never appeared anywhere. Worse, it looked the row up in
 * that same fixture store, where a real lease id is never found. It now reads
 * the row from the SAME query the roll holds and records through
 * `POST /ops/leases/:id/rent`, then invalidates the roll so the row moves.
 *
 * What the landlord is doing is recording a fact: cash already handed over. It
 * moves no money, and the disclosure on the sheet still says so. It no longer
 * says "mock", because the row it writes is a real ledger row that every other
 * seat in the workspace will read.
 *
 * The server needs three things this sheet has to get right:
 *
 *   - **the month**, named, never "the oldest unpaid one" (`RecordRentRequest`);
 *   - **the amount outstanding**, not the amount billed, since a part-paid
 *     month refuses an overpayment;
 *   - **a UUID `Idempotency-Key`**, minted once per sheet and reused on every
 *     retry, online or replayed from the queue. "A rent payment recorded twice
 *     tells a tenant they owe nothing when they do."
 */
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  EmptyState,
  ErrorState,
  Icon,
  MoneyAmount,
  Sheet,
  Text,
  useToast,
  WriteError,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { useOfflineSubmit } from '@/data/offline-submit';
import { RENT_PERIOD } from '@/data/landlord';
import {
  fetchRentRoll,
  recordPaymentHandler,
  type RecordRentIntent,
} from '@/queries/landlord';
import { landlordKeys } from '@/lib/query-keys';
import { useWorkspace } from '@/workspace';
import { uuidV4 } from '@/screens/guest/book-format';

/** `2026-08-01` → `August 2026`. Falls back to the fixtures' period. */
function periodLabel(periodMonth: string | undefined): string {
  if (!periodMonth) return RENT_PERIOD;
  const date = new Date(`${periodMonth}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return RENT_PERIOD;
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function RecordPayment({
  leaseId,
  periodMonth,
}: {
  leaseId: string;
  /** The month the row that opened this sheet is for, when it said. */
  periodMonth?: string;
}) {
  const { c, space, radius } = useTheme();
  const router = useRouter();
  const t = useT();
  const toast = useToast();
  const queryClient = useQueryClient();

  // The rent roll's own query and key, so this sheet reads what the row that
  // opened it was drawn from, usually straight out of the cache.
  const { activeWorkspaceId } = useWorkspace();
  const query = useQuery({
    queryKey: landlordKeys.rentRoll(activeWorkspaceId ?? 'unresolved'),
    queryFn: ({ signal }) => fetchRentRoll(signal),
    enabled: !!activeWorkspaceId,
  });
  const status =
    !activeWorkspaceId || query.isPending ? 'loading' : query.isError ? 'error' : 'ready';

  const row = (query.data ?? []).find(
    (r) =>
      r.leaseId === leaseId &&
      r.state !== 'paid' &&
      (!periodMonth || r.periodMonth === periodMonth),
  );
  const outstanding = row ? Math.max(0, row.amount - (row.paidAmount ?? 0)) : 0;

  /** One intent per sheet: the queue id AND the server's Idempotency-Key. */
  const [intentKey] = useState(uuidV4);

  /**
   * The offline half (gaps.md §7's queued record-payment).
   *
   * This is the one queued action that looks like the EXCLUDED one and is not.
   * A tenant pressing "pay rent" is authorising money to move, and a queued
   * authorisation is one nobody gave at the moment it fired. A landlord
   * standing in front of a tenant who has just handed over cash is recording a
   * fact that has already happened, and a fact survives a delay.
   *
   * The handler is registered at module level (`data/write-handlers.ts`), so a
   * payment queued here still sends after the app is killed and reopened.
   */
  const write = useOfflineSubmit<RecordRentIntent>({
    kind: 'recordPayment',
    handler: recordPaymentHandler,
    label: () => t('landlord.record.title'),
    idFor: () => intentKey,
  });

  const busy = write.state === 'saving';

  /**
   * Where the write ended up, read from its state rather than straight after
   * `await submit()`, which returns before React has the new state and used to
   * toast success over a failure.
   */
  useEffect(() => {
    if (write.state === 'done') {
      if (activeWorkspaceId) {
        void queryClient.invalidateQueries({
          queryKey: landlordKeys.rentRoll(activeWorkspaceId),
        });
      }
      toast.show(t('landlord.record.done'), 'success');
      router.back();
    } else if (write.state === 'queued') {
      toast.show(t('queue.submittedWhenOnline'), 'warning');
      router.back();
    }
    // The state is the trigger. `toast`, `t` and `router` are deliberately not
    // in the list: a new `t` after a locale change must not toast twice.
  }, [write.state]);

  /**
   * Recording money received (gaps.md §5.1, P1).
   *
   * The landlord is standing in front of the tenant who has just handed over
   * cash. A write that fails silently and then reports success is a receipt
   * for a payment the ledger does not have.
   */
  const confirm = async () => {
    if (!row || busy || !activeWorkspaceId || !row.periodMonth || outstanding <= 0) return;
    await write.submit({
      workspaceId: activeWorkspaceId,
      leaseId: row.leaseId,
      periodMonth: row.periodMonth,
      amountRwf: outstanding,
    });
  };

  if (status === 'error') {
    return (
      <Sheet title={t('landlord.record.title')} grabber>
        <ErrorState
          title={t('state.errorTitle')}
          body={t('state.errorBody', { label: t('landlord.rent.listLabel') })}
          detail={query.error?.message}
          onRetry={() => void query.refetch()}
        />
      </Sheet>
    );
  }

  // A row can vanish under this sheet — another seat settles it, or the month
  // rolls. Saying so beats a confirm button that writes to nothing.
  if (status === 'ready' && !row) {
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
          {write.state === 'error' && write.refusal ? (
            // The server answered and said why: already settled, more than is
            // owed, not your lease. Retrying will not change that answer.
            <View
              accessible
              accessibilityRole="alert"
              accessibilityLiveRegion="assertive"
              style={{
                gap: 4,
                padding: space[3],
                borderRadius: radius.lg,
                backgroundColor: c.danger100,
                borderWidth: 1,
                borderColor: c.danger500,
              }}
            >
              <Text weight="semibold" size="sm" color="textStrong">
                {t('queue.refused')}
              </Text>
              <Text size="sm" color="textBody">
                {write.refusal}
              </Text>
            </View>
          ) : write.state === 'error' ? (
            // Unreachable: the intent is already in the queue with this key, so
            // a retry here and a later drain are the same one payment.
            <WriteError body="queue.willSend" onRetry={() => void confirm()} />
          ) : null}
          <Button
            variant="primary"
            size="lg"
            block
            leadingIcon="check"
            disabled={!row || busy || outstanding <= 0}
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
          {t('landlord.record.amount', { month: periodLabel(row?.periodMonth) })}
        </Text>
        <MoneyAmount value={outstanding} strong size="lg" />
      </View>

      {/* The disclosure. A warning ground rather than a muted note, because the
          one thing this sheet must not do is look routine: it writes a ledger
          row every seat reads, and it moves no money. */}
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
          <Icon name="coins" size={16} color={c.warning600} />
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
