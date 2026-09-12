/**
 * Rent roll — frames R1 and R2, the Landlord home (F-R05, FL28).
 *
 * R1 is the layout and R2 is the behaviour, exactly as `frames.md` instructs:
 * "Use R1 as the default layout and R2 as the dark reference and as the
 * segmented filter behaviour." So the page keeps R1's eyebrow, three stat tiles
 * and full-width rows, and takes R2's segmented control and its collection
 * line — the progress bar under the tiles is R2's hero card, folded into R1's
 * grid rather than drawn twice.
 *
 * Three departures from the drawing, each deliberate:
 *
 *   - **R1's bell is a `WorkspaceChip`.** The landlord tab set is Rent roll ·
 *     Leases · Repairs · Account — there is no Inbox behind a bell, so the bell
 *     would be the "orphaned control" the quality bar rules out. The
 *     interactive twin draws a workspace chip in that corner instead, and it
 *     goes somewhere: the switcher.
 *   - **R1's "Filter" link is gone.** R2's segmented control is on the same
 *     screen and does the same job; two filters for one list is one too many.
 *   - **The count line reads seven where the Leases tab reads eight.** A draft
 *     lease bills no rent (FL21 — the schedule starts at signing), so it is not
 *     on the roll. See `src/data/landlord.ts` for the full reconciliation.
 *
 * `Screen.List` rather than `Screen` (ADR-031): one row per billing lease, and
 * that grows with the building.
 */
import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  AdapterChip,
  Avatar,
  Badge,
  Button,
  ChipGroup,
  EmptyState,
  ErrorState,
  MoneyAmount,
  OfflineNote,
  PressableScale,
  Screen,
  Text,
  useOffline,
  useToast,
  WorkspaceChip,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useQuery } from '@tanstack/react-query';

import { useDomain } from '@/domain';
import { useT, type MessageKey, type Translate } from '@/i18n/i18n';
import {
  LANDLORD_TOWN,
  RENT_PERIOD,
  rentTotals,
  shortMoney,
  type RentRow,
  type RentTotals,
} from '@/data/landlord';
import { fetchRentRoll } from '@/queries/landlord';
import { landlordKeys } from '@/lib/query-keys';
import { useWorkspace } from '@/workspace';
import type { RentState } from '@/data/rentals';

type Filter = 'all' | RentState;

/**
 * Overdue first, then due, then paid. A rent roll is a worklist: the row that
 * needs chasing has to be the one under the reader's thumb, and sorting by
 * anything else buries it under four settled months.
 */
const RANK: Record<RentState, number> = { overdue: 0, due: 1, paid: 2 };

/* ── The three tiles, plus the collection bar R2 draws as its hero ──────── */

function StatTile({
  label,
  value,
  caption,
  tone,
}: {
  label: string;
  value: string;
  caption: string;
  tone: 'success' | 'neutral' | 'danger';
}) {
  const { c, radius, shadow } = useTheme();
  const ink = tone === 'success' ? c.success600 : tone === 'danger' ? c.danger600 : c.textStrong;

  return (
    <View
      accessible
      accessibilityLabel={`${label}, RWF ${value}, ${caption}`}
      style={{
        flex: 1,
        minWidth: 0,
        gap: 4,
        padding: 13,
        borderRadius: radius.lg,
        backgroundColor: c.surface1,
        borderWidth: 1,
        borderColor: c.borderSubtle,
        ...shadow.xs,
      }}
    >
      {/* Two lines, not one. A third of a 393pt screen holds about eleven
          uppercase characters at this size, and "Bugomba kwishyurwa" is
          eighteen — clipped to one line the Kinyarwanda tile would read
          "BUGOMBA KWIS…". The canvas rule is that rows grow and nothing
          truncates, so the tile is the thing that gives. */}
      <Text
        weight="bold"
        size="2xs"
        color="textMuted"
        numberOfLines={2}
        style={{ letterSpacing: 0.8, textTransform: 'uppercase' }}
      >
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
        <Text family="mono" weight="medium" size="2xs" color="textMuted">
          RWF
        </Text>
        <Text family="display" weight="semibold" size="xl" color={ink} numberOfLines={1}>
          {value}
        </Text>
      </View>
      <Text size="xs" color="textMuted" numberOfLines={2} style={{ lineHeight: 15 }}>
        {caption}
      </Text>
    </View>
  );
}

function CollectionBar({ totals, t }: { totals: RentTotals; t: Translate }) {
  const { c, radius } = useTheme();

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('landlord.rent.progressLabel', {
        month: RENT_PERIOD,
        percent: totals.percent,
      })}
      accessibilityValue={{ min: 0, max: 100, now: totals.percent }}
      style={{ gap: 8 }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        {/* The exact figures, so nothing on this screen is only ever seen
            rounded to the tiles' 1.24M. */}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', flexShrink: 1 }}>
          <MoneyAmount value={totals.collected} strong size="sm" />
          <Text size="xs" color="textMuted">
            {' / '}
          </Text>
          <MoneyAmount value={totals.billed} size="sm" showCurrency={false} />
        </View>
        <Text weight="semibold" size="xs" color="textMuted">
          {t('landlord.rent.percentCollected', { percent: totals.percent })}
        </Text>
      </View>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          height: 6,
          borderRadius: radius.pill,
          backgroundColor: c.surface3,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${Math.max(totals.percent, totals.collected > 0 ? 2 : 0)}%`,
            height: '100%',
            borderRadius: radius.pill,
            backgroundColor: c.success500,
          }}
        />
      </View>
    </View>
  );
}

/* ── One row ────────────────────────────────────────────────────────────── */

function RentRowCard({
  row,
  t,
  onOpen,
  onRemind,
  onRecord,
}: {
  row: RentRow;
  t: Translate;
  onOpen: () => void;
  onRemind: () => void;
  onRecord: () => void;
}) {
  const { c, radius, shadow } = useTheme();

  const chip =
    row.state === 'paid'
      ? {
          tone: 'success' as const,
          label: row.mock
            ? t('landlord.rent.chipPaidMock')
            : t('landlord.rent.chipPaid', { date: row.on ?? '' }),
        }
      : row.state === 'due'
        ? { tone: 'neutral' as const, label: t('landlord.rent.chipDue', { date: row.on ?? '' }) }
        : {
            tone: 'danger' as const,
            label: t('landlord.rent.chipOverdue', { days: row.days ?? 0 }),
          };

  const overdue = row.state === 'overdue';

  return (
    <View
      style={{
        borderRadius: radius.lg,
        backgroundColor: c.surface1,
        // R1 draws the overdue row with its own border. Colour is the second
        // signal here, never the only one — the chip already says "Overdue".
        borderWidth: overdue ? 1.5 : 1,
        borderColor: overdue ? c.danger500 : c.borderSubtle,
        ...shadow.xs,
      }}
    >
      <PressableScale
        accessibilityLabel={t('landlord.rent.openRow', { name: row.name, unit: row.unit })}
        onPress={onOpen}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingHorizontal: 14,
            paddingVertical: 13,
          }}
        >
          <Avatar name={row.name} size={40} />
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <Text weight="semibold" size="sm" color="textStrong" numberOfLines={1}>
              {row.name} · {row.unit}
            </Text>
            <Badge tone={chip.tone}>{chip.label}</Badge>
          </View>
          <MoneyAmount value={row.amount} strong size="md" />
        </View>
      </PressableScale>

      {/* Paid rows carry no action, so they grow no footer — R1 draws the
          action only where there is one to take. */}
      {row.state === 'paid' ? null : (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 8,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderTopWidth: 1,
            borderTopColor: c.borderSubtle,
            backgroundColor: c.surface2,
          }}
        >
          <Button
            variant="ghost"
            size="sm"
            leadingIcon="bell"
            accessibilityLabel={t('landlord.rent.remindA11y', { name: row.name })}
            onPress={onRemind}
          >
            {t('landlord.rent.remind')}
          </Button>
          <Button
            variant={overdue ? 'primary' : 'outline'}
            size="sm"
            leadingIcon="check"
            accessibilityLabel={t('landlord.rent.recordA11y', { name: row.name, unit: row.unit })}
            onPress={onRecord}
          >
            {t('landlord.rent.record')}
          </Button>
        </View>
      )}
    </View>
  );
}

/* ── The screen ─────────────────────────────────────────────────────────── */

export function RentRoll() {
  const { space } = useTheme();
  const router = useRouter();
  const t = useT();
  const toast = useToast();
  const { workspace } = useDomain();
  const [filter, setFilter] = useState<Filter>('all');

  /**
   * The tracer (ADR-038 child 0, AC-S14).
   *
   * This is the first screen in the app reading a real row from a real
   * Postgres. It replaced `useLandlordRead(RENT_ROLL_KEY, seedRentRoll)`, which
   * read a seeded module in `src/data/`.
   *
   * `enabled` is the invariant that matters: NOTHING workspace scoped fires in
   * the window before the workspace resolves. Without it this would fire once
   * with no `x-workspace-id`, be refused, and show an error on a screen that
   * was only ever a few hundred milliseconds early.
   *
   * The key begins with the workspace id, so switching workspace asks a
   * different question rather than reading the previous landlord's tenants out
   * of the cache under a new name.
   */
  const { activeWorkspaceId } = useWorkspace();
  const query = useQuery({
    queryKey: landlordKeys.rentRoll(activeWorkspaceId ?? 'unresolved'),
    queryFn: ({ signal }) => fetchRentRoll(signal),
    enabled: !!activeWorkspaceId,
  });

  /**
   * Presented in the `{ status, data, error, retry }` shape the fixture hook
   * used, so the list, the empty states and the error card below are untouched.
   * The SOURCE changed; what the screen draws did not, and a screen rewritten
   * at the same time as its data source is one nobody can review.
   *
   * A workspace that has not resolved reads as `loading`, never as `ready` with
   * nothing in it: an empty rent roll and an unresolved one look identical on
   * screen and mean completely different things.
   */
  const read = {
    data: query.data,
    status: !activeWorkspaceId || query.isPending
      ? ('loading' as const)
      : query.isError
        ? ('error' as const)
        : ('ready' as const),
    error: query.error ?? undefined,
    retry: () => void query.refetch(),
  };

  const offline = useOffline();
  const rows = read.data ?? [];
  const totals = rentTotals(rows);

  const shown = rows
    .filter((r) => filter === 'all' || r.state === filter)
    .slice()
    .sort((a, b) => RANK[a.state] - RANK[b.state]);

  const count = (s: RentState) => rows.filter((r) => r.state === s).length;
  const leases = (n: number) =>
    n === 1 ? t('landlord.rent.oneLease') : t('landlord.rent.leaseCount', { count: n });

  /** Why THIS list is empty, per filter. A reason, never a bare zero. */
  const empty: { title: MessageKey; body: MessageKey } =
    filter === 'paid'
      ? { title: 'landlord.rent.emptyPaidTitle', body: 'landlord.rent.emptyPaidBody' }
      : filter === 'due'
        ? { title: 'landlord.rent.emptyDueTitle', body: 'landlord.rent.emptyDueBody' }
        : filter === 'overdue'
          ? { title: 'landlord.rent.emptyOverdueTitle', body: 'landlord.rent.emptyOverdueBody' }
          : { title: 'landlord.rent.emptyAllTitle', body: 'landlord.rent.emptyAllBody' };

  return (
    <Screen.List<RentRow>
      greeting={t('landlord.seat', { org: workspace.name, town: LANDLORD_TOWN })}
      title={t('landlord.rent.title')}
      action={
        <WorkspaceChip
          name={workspace.name}
          role={workspace.role}
          onPress={() => router.push('/switch')}
        />
      }
      header={
        <>
          {/* The fourth list state, in the list rather than over it. The
              app-wide banner says the phone is offline; this says what that
              means for the rows under it — they are the last that loaded, and
              a rent ledger that is quietly stale is one somebody acts on.
              Session 11's audit found all three landlord lists without it. */}
          {offline ? <OfflineNote /> : null}
          {/* The chip and the sentence under it are one disclosure, so they
              sit together at the top rather than the sentence being a footnote
              under a list nobody scrolls to the bottom of. R1 prints it last;
              a mocked success is worth reading before the figures, not after. */}
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <AdapterChip
                label={t('landlord.mockAdapter')}
                hint={t('landlord.mockAdapterHint')}
              />
              <Text weight="semibold" size="sm" color="textMuted">
                {RENT_PERIOD}
              </Text>
            </View>
            <Text size="xs" color="textMuted" style={{ lineHeight: 17 }}>
              {t('landlord.rent.footnote')}
            </Text>
          </View>

          <View style={{ gap: space[3] }}>
            {/* `alignItems: stretch` so a tile whose label wrapped does not
                leave its two neighbours short. */}
            <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: space[2] }}>
              <StatTile
                label={t('landlord.rent.collected')}
                value={shortMoney(totals.collected)}
                caption={leases(totals.collectedCount)}
                tone="success"
              />
              <StatTile
                label={t('landlord.rent.due')}
                value={shortMoney(totals.due)}
                caption={leases(totals.dueCount)}
                tone="neutral"
              />
              <StatTile
                label={t('landlord.rent.overdue')}
                value={shortMoney(totals.overdue)}
                caption={
                  totals.worstDays === 0
                    ? t('landlord.rent.nothingLate')
                    : totals.worstDays === 1
                      ? t('landlord.rent.oneDay')
                      : t('landlord.rent.dayCount', { count: totals.worstDays })
                }
                tone="danger"
              />
            </View>
            <CollectionBar totals={totals} t={t} />
          </View>

          <ChipGroup
            legend={
              rows.length === 1
                ? t('landlord.rent.oneBilled', { month: RENT_PERIOD })
                : t('landlord.rent.billedCount', { count: rows.length, month: RENT_PERIOD })
            }
            value={filter}
            onChange={(v) => setFilter(v as Filter)}
            items={[
              { value: 'all', label: t('landlord.rent.filterAll'), count: rows.length },
              { value: 'paid', label: t('landlord.rent.filterPaid'), count: count('paid') },
              { value: 'due', label: t('landlord.rent.filterDue'), count: count('due') },
              {
                value: 'overdue',
                label: t('landlord.rent.filterOverdue'),
                count: count('overdue'),
              },
            ]}
          />
        </>
      }
      data={shown}
      keyExtractor={(r) => r.leaseId}
      renderItem={({ item }) => (
        <RentRowCard
          row={item}
          t={t}
          onOpen={() =>
            router.push({ pathname: '/lease/[id]', params: { id: item.leaseId } })
          }
          onRemind={() =>
            toast.show(t('landlord.rent.reminderSent', { name: item.name }), 'warning')
          }
          onRecord={() =>
            router.push({ pathname: '/record-payment', params: { leaseId: item.leaseId } })
          }
        />
      )}
      loading={read.status === 'loading'}
      loadingLabel={t('state.loadingList', { label: t('landlord.rent.listLabel') })}
      loadingRows={4}
      empty={
        read.status === 'error' ? (
          <ErrorState
            title={t('state.errorTitle')}
            body={t('state.errorBody', { label: t('landlord.rent.listLabel') })}
            detail={read.error?.message}
            onRetry={read.retry}
          />
        ) : (
          <View style={{ gap: space[4] }}>
            <EmptyState
              icon="coins"
              title={t(empty.title)}
              body={t(empty.body, { month: RENT_PERIOD })}
              action={
                filter === 'all' ? null : (
                  <Button variant="outline" size="sm" onPress={() => setFilter('all')}>
                    {t('landlord.rent.filterAll')}
                  </Button>
                )
              }
            />
          </View>
        )
      }
    />
  );
}
