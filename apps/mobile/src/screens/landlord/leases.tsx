/**
 * Leases, landlord seat — frame R3 (F-R03, FL20).
 *
 * The tenant's `src/screens/leases.tsx` is the same word from the other side of
 * the table: there the counterparty is the landlord and the money is an
 * obligation, here the counterparty is the tenant and it is a receivable. Two
 * screens, deliberately, for the same reason `Tenancy` and `LandlordLease` are
 * two types — a seat is not a filter.
 *
 * **The row action is the point of this screen.** The operator web app draws
 * the same pipeline as a five-column board (`pms/screens/leases.tsx`, "every
 * tenancy moves left to right and nothing skips a step"), which does not
 * survive a 393-point phone. What survives is the part a landlord actually
 * needs on a phone: which lease is waiting on ME, and the one control that
 * unblocks it. So a row with `action` grows a footer and a row without one does
 * not, and the three actions map onto the three states that can be blocked:
 *
 *   - `draft` → **Review & sign**, which opens the contract (frame R8).
 *   - `pending_signature` → **Nudge tenant to sign**, a reminder.
 *   - `ending` → **Send renewal offer**, unless a move-out notice is filed
 *     against it, in which case there is nothing to renew and the row stays
 *     plain. That last clause is why the fixtures carry two ending leases: R3
 *     drew one, and the interactive twin put a renewal offer on it that its own
 *     "Move-out notice filed" line contradicts.
 *
 * The chip set carries `pending_signature` even though R3 does not draw it,
 * because signing a draft on frame R8 moves a lease INTO that state and a
 * filter set that cannot show where a row just went is a filter set that lies.
 * A zero-count chip stays visible rather than vanishing: a control that
 * disappears when you use it is worse than one that reports nothing.
 */
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import type { IconName } from '@/components';
import {
  Avatar,
  Button,
  ChipGroup,
  EmptyState,
  ErrorState,
  Icon,
  InputField,
  MoneyAmount,
  OfflineNote,
  PressableScale,
  Screen,
  StatusBadge,
  Text,
  useOffline,
  useToast,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useDomain } from '@/domain';
import { useT, type MessageKey, type Translate } from '@/i18n/i18n';
import {
  LANDLORD_TOWN,
  LEASES_KEY,
  seedLeases,
  useLandlordRead,
  type LandlordLease,
} from '@/data/landlord';
import type { LeaseState } from '@/data/rentals';

type Filter = 'all' | 'active' | 'ending' | 'pending_signature' | 'draft';

/** Blocked first: a lease waiting on the landlord is why this screen is open. */
const RANK: Record<LeaseState, number> = {
  draft: 0,
  pending_signature: 1,
  ending: 2,
  active: 3,
  ended: 4,
};

const ACTION_LABEL = {
  sign: 'landlord.leases.actionSign',
  nudge: 'landlord.leases.actionNudge',
  renew: 'landlord.leases.actionRenew',
} as const;

function LeaseRow({
  lease,
  t,
  onOpen,
  onAct,
}: {
  lease: LandlordLease;
  t: Translate;
  onOpen: () => void;
  onAct: () => void;
}) {
  const { c, radius, shadow } = useTheme();
  const tenure = t(lease.tenure === 'long_term' ? 'landlord.tenureLong' : 'landlord.tenureShort');

  return (
    <View
      style={{
        borderRadius: radius.lg,
        backgroundColor: c.surface1,
        borderWidth: 1,
        borderColor: c.borderSubtle,
        ...shadow.xs,
      }}
    >
      <PressableScale
        accessibilityLabel={t('landlord.leases.open', { name: lease.tenant, unit: lease.unit })}
        onPress={onOpen}
      >
        <View style={{ gap: 10, paddingHorizontal: 14, paddingVertical: 13 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Avatar name={lease.tenant} size={40} />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text weight="semibold" size="sm" color="textStrong" numberOfLines={1}>
                {lease.tenant} · {lease.unit}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' }}>
                <Text size="xs" color="textMuted">
                  {t('landlord.leases.rowMeta', { tenure, ref: lease.ref })}
                  {'  '}
                </Text>
                <MoneyAmount value={lease.rent} size="xs" />
                <Text size="xs" color="textSubtle">
                  {t('landlord.perMonth')}
                </Text>
              </View>
            </View>
            <StatusBadge domain="lease" state={lease.state} />
          </View>

          <Text size="xs" color="textSubtle" style={{ lineHeight: 18 }}>
            {lease.term}
          </Text>

          {lease.placement ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="key" size={13} color={c.textSubtle} />
              <Text size="xs" color="textSubtle" numberOfLines={1}>
                {t('landlord.leases.placedBy', { broker: lease.placement.broker })}
              </Text>
            </View>
          ) : null}
        </View>
      </PressableScale>

      {lease.action ? (
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'flex-end',
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderTopWidth: 1,
            borderTopColor: c.borderSubtle,
            backgroundColor: c.surface2,
          }}
        >
          <Button
            variant={lease.action === 'sign' ? 'primary' : 'outline'}
            size="sm"
            leadingIcon={
              lease.action === 'sign' ? 'edit' : lease.action === 'nudge' ? 'bell' : 'repeat'
            }
            onPress={onAct}
          >
            {t(ACTION_LABEL[lease.action])}
          </Button>
        </View>
      ) : null}
    </View>
  );
}

export function LandlordLeases() {
  const { space } = useTheme();
  const router = useRouter();
  const t = useT();
  const toast = useToast();
  const { workspace } = useDomain();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const read = useLandlordRead(LEASES_KEY, seedLeases);
  const offline = useOffline();
  const all = read.data ?? [];

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return all
      .filter((l) => filter === 'all' || l.state === filter)
      .filter(
        (l) =>
          needle === '' ||
          l.tenant.toLowerCase().includes(needle) ||
          l.unit.toLowerCase().includes(needle) ||
          l.ref.toLowerCase().includes(needle),
      )
      .slice()
      .sort((a, b) => RANK[a.state] - RANK[b.state]);
  }, [all, filter, query]);

  const count = (s: LeaseState) => all.filter((l) => l.state === s).length;

  const act = (lease: LandlordLease) => {
    if (lease.action === 'sign') {
      router.push({ pathname: '/lease/[leaseId]/contract', params: { leaseId: lease.id } });
      return;
    }
    if (lease.action === 'nudge') {
      toast.show(t('landlord.leases.nudgeSent', { name: lease.tenant }), 'warning');
      return;
    }
    toast.show(t('landlord.leases.renewalSent', { name: lease.tenant }), 'success');
  };

  /** Why THIS list is empty. A search miss is a different fact from a state
   *  with nothing in it, and offering "clear the search" on the second would
   *  be pointing at a control that changes nothing. */
  const searching = query.trim() !== '';
  const empty: { icon: IconName; title: MessageKey; body: MessageKey } = searching
    ? { icon: 'search' as const, title: 'landlord.leases.emptySearchTitle', body: 'landlord.leases.emptySearchBody' }
    : filter === 'active'
      ? { icon: 'key' as const, title: 'landlord.leases.emptyActiveTitle', body: 'landlord.leases.emptyActiveBody' }
      : filter === 'ending'
        ? { icon: 'clock' as const, title: 'landlord.leases.emptyEndingTitle', body: 'landlord.leases.emptyEndingBody' }
        : filter === 'pending_signature'
          ? { icon: 'edit' as const, title: 'landlord.leases.emptyPendingTitle', body: 'landlord.leases.emptyPendingBody' }
          : filter === 'draft'
            ? { icon: 'fileText' as const, title: 'landlord.leases.emptyDraftTitle', body: 'landlord.leases.emptyDraftBody' }
            : { icon: 'fileText' as const, title: 'landlord.leases.emptyAllTitle', body: 'landlord.leases.emptyAllBody' };

  return (
    <Screen.List<LandlordLease>
      greeting={t('landlord.seat', { org: workspace.name, town: LANDLORD_TOWN })}
      title={t('landlord.leases.title')}
      action={
        <Button
          variant="primary"
          size="sm"
          leadingIcon="plus"
          accessibilityLabel={t('landlord.leases.newA11y')}
          onPress={() => router.push('/lease/new')}
        >
          {t('landlord.leases.new')}
        </Button>
      }
      header={
        <>
          {/* The fourth list state, in the list rather than over it. The
              app-wide banner says the phone is offline; this says what that
              means for the rows under it — they are the last that loaded, and
              a rent ledger that is quietly stale is one somebody acts on.
              Session 11's audit found all three landlord lists without it. */}
          {offline ? <OfflineNote /> : null}
          <InputField
            label={t('landlord.leases.search')}
            value={query}
            onChangeText={setQuery}
            placeholder={t('landlord.leases.search')}
            autoCapitalize="words"
            suffix={
              query === '' ? null : (
                <PressableScale
                  accessibilityLabel={t('landlord.leases.clearSearch')}
                  hitSlop={10}
                  onPress={() => setQuery('')}
                >
                  <Icon name="xCircle" size={18} />
                </PressableScale>
              )
            }
          />

          <ChipGroup
            value={filter}
            onChange={(v) => setFilter(v as Filter)}
            items={[
              { value: 'all', label: t('landlord.leases.filterAll'), count: all.length },
              { value: 'active', label: t('landlord.leases.filterActive'), count: count('active') },
              { value: 'ending', label: t('landlord.leases.filterEnding'), count: count('ending') },
              {
                value: 'pending_signature',
                label: t('landlord.leases.filterPending'),
                count: count('pending_signature'),
              },
              { value: 'draft', label: t('landlord.leases.filterDraft'), count: count('draft') },
            ]}
          />
        </>
      }
      data={shown}
      keyExtractor={(l) => l.id}
      renderItem={({ item }) => (
        <LeaseRow
          lease={item}
          t={t}
          onOpen={() => router.push({ pathname: '/lease/[id]', params: { id: item.id } })}
          onAct={() => act(item)}
        />
      )}
      loading={read.status === 'loading'}
      loadingLabel={t('state.loadingList', { label: t('landlord.leases.listLabel') })}
      loadingRows={4}
      empty={
        read.status === 'error' ? (
          <ErrorState
            title={t('state.errorTitle')}
            body={t('state.errorBody', { label: t('landlord.leases.listLabel') })}
            detail={read.error?.message}
            onRetry={read.retry}
          />
        ) : (
          <View style={{ gap: space[4] }}>
            <EmptyState
              icon={empty.icon}
              title={t(empty.title)}
              body={t(empty.body, { query: query.trim(), count: all.length })}
              action={
                searching ? (
                  <Button variant="outline" size="sm" onPress={() => setQuery('')}>
                    {t('landlord.leases.clearSearch')}
                  </Button>
                ) : all.length === 0 ? (
                  <Button
                    variant="primary"
                    size="sm"
                    leadingIcon="plus"
                    onPress={() => router.push('/lease/new')}
                  >
                    {t('landlord.leases.new')}
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onPress={() => setFilter('all')}>
                    {t('landlord.leases.filterAll')}
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
