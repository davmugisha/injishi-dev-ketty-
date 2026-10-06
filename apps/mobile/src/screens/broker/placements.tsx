/**
 * Placements — frame B23. Every tenant this broker introduced, and where the
 * fee behind them stands.
 *
 * The invariant the whole screen is built around is F-R08's: **a fee is earned
 * when the lease ACTIVATES, not when the introduction happens.** So the footer
 * of a card says which of the two it is looking at — "Fee on signing" against a
 * hope, "Fee received" against a receipt — and never prints a bare amount that
 * could be read as either. A lapsed intent says "No fee earned" out loud rather
 * than showing the figure it did not get.
 *
 * **Expiry is derived, not stored.** An `active` intent whose thirty-day window
 * has run out reads as `expired`, and the chip, the card and the countdown all
 * ask `placementState` the same question — so a card cannot say "active" over a
 * countdown that has gone negative. `@/data/broker` owns that derivation.
 */
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  MoneyAmount,
  Screen,
  SegmentedTabs,
  Text,
  useOffline,
  WorkspaceChip,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useDomain } from '@/domain';
import { useT } from '@/i18n/i18n';
import { useFixture } from '@/data/use-fixture';
import { formatDay } from '@/data/search';
import {
  SEED_PLACEMENTS,
  bucketOf,
  countByBucket,
  intentExpiresAt,
  useBrokerState,
  type Placement,
  type PlacementBucket,
} from '@/data/broker';
import {
  INTENT_DAYS,
  eventLine,
  feeFooter,
  intentCountdown,
  placementBadge,
  placementTitle,
} from './broker-format';

const BUCKETS: PlacementBucket[] = ['active', 'signed', 'expired'];

export function Placements() {
  const { c, space } = useTheme();
  const router = useRouter();
  const t = useT();
  const { workspace } = useDomain();

  const [bucket, setBucket] = useState<PlacementBucket>('active');

  // The read is what owns the loading and error states; the store is what owns
  // the value once it has landed, so a reveal on another tab shows up here.
  const read = useFixture('broker.placements', () => SEED_PLACEMENTS);
  const { placements } = useBrokerState();
  const all = read.status === 'ready' ? placements : [];

  const counts = useMemo(() => countByBucket(all), [all]);
  const shown = useMemo(() => all.filter((p) => bucketOf(p) === bucket), [all, bucket]);

  const offline = useOffline();

  const label: Record<PlacementBucket, string> = {
    active: t('placements.bucketActive'),
    signed: t('placements.bucketSigned'),
    expired: t('placements.bucketExpired'),
  };

  return (
    <Screen.List<Placement>
      greeting={t('placements.greeting')}
      title={t('placements.title')}
      action={
        <WorkspaceChip
          name={workspace.name}
          role={workspace.role}
          onPress={() => router.push('/switch')}
        />
      }
      header={
        <>
          {offline ? (
            <View
              accessible
              accessibilityRole="summary"
              accessibilityLabel={t('state.offlineLastList')}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: space[2],
                padding: space[3],
                borderRadius: 10,
                backgroundColor: c.warning100,
              }}
            >
              <Icon name="wifiOff" size={16} color={c.warning600} />
              <Text size="xs" color="textBody" style={{ flex: 1, lineHeight: 18 }}>
                {t('state.offlineLastList')}
              </Text>
            </View>
          ) : null}

          {/* The pair is what carries the "one of these three" meaning;
              `SegmentedTabs` reports each tab and cannot name the group.
              No counts until the read has landed: this header draws while it
              is in flight, and "Active 0 · Signed 0 · Expired 0" read as an
              empty book rather than a slow one (mobile audit 2026-10-05,
              BR-06). */}
          <View accessibilityRole="tablist" accessibilityLabel={t('placements.title')}>
            <SegmentedTabs
              items={BUCKETS.map((b) => ({
                value: b,
                label: label[b],
                count: read.status === 'ready' ? counts[b] : undefined,
              }))}
              value={bucket}
              onChange={(next) => setBucket(next as PlacementBucket)}
            />
          </View>

          <View
            accessible
            accessibilityRole="summary"
            accessibilityLabel={t('placements.note')}
            style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[2] }}
          >
            <Icon name="info" size={14} color={c.textSubtle} />
            <Text size="xs" color="textMuted" style={{ flex: 1, lineHeight: 17 }}>
              {t('placements.note')}
            </Text>
          </View>
        </>
      }
      data={shown}
      keyExtractor={(p) => p.id}
      renderItem={({ item }) => <PlacementCard placement={item} />}
      loading={read.status === 'loading'}
      loadingLabel={t('state.loadingList', { label: t('placements.listLabel') })}
      loadingRows={3}
      empty={
        read.status === 'error' ? (
          <ErrorState
            title={t('state.errorTitle')}
            body={t('state.errorBody', { label: t('placements.listLabel') })}
            detail={read.error?.message}
            onRetry={read.retry}
          />
        ) : (
          <NoPlacements bucket={bucket} onOpenDirectory={() => router.push('/')} />
        )
      }
    />
  );
}

/**
 * One card: the arrow line, the state chip, the event line, and a footer that
 * says what the money on it actually is.
 *
 * Not pressable. There is no placement detail frame on the canvas and the card
 * already carries everything a placement holds; a chevron onto a screen that
 * repeats this card would be the orphaned control the quality bar rules out.
 * The unit behind a live intent is one tap away from the Directory.
 */
function PlacementCard({ placement }: { placement: Placement }) {
  const { c, space } = useTheme();
  const t = useT();

  const badge = placementBadge(placement, t);
  const event = eventLine(placement, t);
  const footer = feeFooter(placement, t);
  const countdown = intentCountdown(placement, t);
  const lapsed = badge.state === 'expired';

  return (
    <Card
      variant="default"
      bodyStyle={{ padding: 16, gap: 10 }}
      style={{ opacity: lapsed ? 0.78 : 1 }}
      footer={
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
            <Icon
              name={footer.earned ? 'checkCircle' : lapsed ? 'xCircle' : 'clock'}
              size={14}
              color={footer.earned ? c.success600 : lapsed ? c.textSubtle : c.warning600}
            />
            <Text size="xs" color="textMuted" numberOfLines={1} style={{ flexShrink: 1 }}>
              {footer.label}
            </Text>
          </View>

          {/* A live intent shows its countdown instead of the fee: the number
              that matters this week is how long the broker has left, and B23
              draws exactly that swap. */}
          {countdown ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text size="xs" color="textMuted">
                {t('placements.intentExpires')}
              </Text>
              <Text family="mono" weight="semibold" size="sm" color="textStrong">
                {countdown}
              </Text>
            </View>
          ) : (
            <MoneyAmount
              value={placement.fee}
              strong={footer.earned}
              tone={footer.earned ? 'positive' : undefined}
              size="sm"
            />
          )}
        </>
      }
    >
      <View
        accessible
        accessibilityLabel={t('placements.cardSummary', {
          client: placement.client ?? t('placements.noClient'),
          unit: placement.unitLabel,
          state: badge.label,
          event,
        })}
        style={{ gap: 10 }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: space[3],
          }}
        >
          <Text
            weight="semibold"
            size="md"
            color={placement.client ? 'textStrong' : 'textMuted'}
            style={{ flex: 1, lineHeight: 21 }}
          >
            {placementTitle(placement, t)}
          </Text>
          <Badge tone={badge.tone} dot>
            {badge.label}
          </Badge>
        </View>

        <Text size="xs" color="textMuted" style={{ lineHeight: 18 }}>
          {lapsed
            ? t('placements.intentLapsed', { day: formatDay(intentExpiresAt(placement), t) })
            : event}
        </Text>
      </View>
    </Card>
  );
}

/**
 * The empty state, per tab. Three different facts: nothing live, nothing signed
 * yet, and nothing lapsed — and the last of those is good news, which a generic
 * "no placements" would report as a shortage.
 */
function NoPlacements({
  bucket,
  onOpenDirectory,
}: {
  bucket: PlacementBucket;
  onOpenDirectory: () => void;
}) {
  const t = useT();

  if (bucket === 'signed') {
    return (
      <EmptyState
        icon="fileText"
        title={t('placements.emptySignedTitle')}
        body={t('placements.emptySignedBody')}
        // The way somewhere, not a way to conjure a row: Session 11's audit
        // found both of these with a reason and no exit. The active bucket
        // already offered one and they can share it.
        action={
          <Button variant="outline" size="md" leadingIcon="grid" onPress={onOpenDirectory}>
            {t('placements.emptyActiveAction')}
          </Button>
        }
      />
    );
  }

  if (bucket === 'expired') {
    return (
      <EmptyState
        icon="checkCircle"
        title={t('placements.emptyExpiredTitle')}
        body={t('placements.emptyExpiredBody', { days: INTENT_DAYS })}
        // The way somewhere, not a way to conjure a row: Session 11's audit
        // found both of these with a reason and no exit. The active bucket
        // already offered one and they can share it.
        action={
          <Button variant="outline" size="md" leadingIcon="grid" onPress={onOpenDirectory}>
            {t('placements.emptyActiveAction')}
          </Button>
        }
      />
    );
  }

  return (
    <EmptyState
      icon="key"
      title={t('placements.emptyActiveTitle')}
      body={t('placements.emptyActiveBody', { days: INTENT_DAYS })}
      action={
        <Button variant="outline" size="md" leadingIcon="grid" onPress={onOpenDirectory}>
          {t('placements.emptyActiveAction')}
        </Button>
      }
    />
  );
}
