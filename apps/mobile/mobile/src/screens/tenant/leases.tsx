/**
 * Frame R11 · My leases — the tenant's own tenancies (FL25 step 1).
 *
 * The seat is the whole difference from `landlord`'s Leases: the rows are units
 * *I* rent, the counterparty is the landlord, and the money is an obligation
 * rather than a receivable.
 *
 * **The frame draws sections, not tabs, and that is the right shape here.** An
 * earlier build put Active and Past behind a `SegmentedTabs`, which costs a tap
 * to see a lease that ended and hides the one thing this screen exists to show
 * — the tenancy you are living in — behind a control. A person holds one or two
 * live leases and a handful of dead ones; that is a page, not a filter.
 *
 * A lease awaiting my signature is lifted out of the list into its own callout:
 * FL25 step 3 locks every other action until it is signed, so the card
 * underneath it would be a set of dead controls.
 *
 * Two lists on one screen and only one of them virtualizes (ADR-031). The
 * callouts, the live cards and the PAST label go in the header slot; the past
 * rows are the list. That split is deliberate: live leases are bounded by how
 * many units a person can rent at once, past ones grow with a lifetime.
 */
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
  OfflineNote,
  PaymentStatus,
  PressableScale,
  Screen,
  SectionLabel,
  StatusBadge,
  Text,
  useOffline,
  WorkspaceChip,
} from '@/components';
import { Image } from 'expo-image';
import { useTheme } from '@/theme/theme';
import { useDomain } from '@/domain';
import { useT, type Translate } from '@/i18n/i18n';
import { useTenancies } from '@/data/tenancy-store';
import { isLiveTenancy, nextDuePeriod, type Tenancy } from '@/data/rentals';
import { photo as photoAsset } from '@/data/photos';
import { PhotoTile } from './photo-tile';
import { formatFullDay, formatMonthYear } from './dates';

/** The chip beside the state on both R11 and R15. */
export function TenureBadge({ tenancy, t }: { tenancy: Tenancy; t: Translate }) {
  return (
    <Badge tone="neutral">
      {t(tenancy.tenure === 'long_term' ? 'leases.tenureLong' : 'leases.tenureShort')}
    </Badge>
  );
}

/**
 * The live lease, drawn the way frame R11 draws it: the photograph first, the
 * state on the photograph, and the two numbers that answer "am I fine?" side by
 * side under it — what it costs, and when the next one lands.
 */
function LiveLeaseCard({ tenancy, t }: { tenancy: Tenancy; t: Translate }) {
  const { c, space, radius } = useTheme();
  const router = useRouter();
  const due = nextDuePeriod(tenancy);

  return (
    <PressableScale
      accessibilityLabel={t('leases.open', { unit: tenancy.unit })}
      onPress={() => router.push({ pathname: '/lease/[id]', params: { id: tenancy.id } })}
      style={{
        borderRadius: radius.lg,
        overflow: 'hidden',
        backgroundColor: c.surface1,
        borderWidth: 1,
        borderColor: c.borderSubtle,
      }}
    >
      <PhotoTile
        stem={tenancy.photos.cover}
        chip={<StatusBadge domain="lease" state={tenancy.leaseState} />}
      />

      <View style={{ padding: space[4], gap: space[3] }}>
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            <Text
              family="display"
              weight="semibold"
              size="lg"
              color="textStrong"
              numberOfLines={1}
              style={{ flexShrink: 1, letterSpacing: -0.2 }}
            >
              {tenancy.landlordOrg}
            </Text>
            <TenureBadge tenancy={tenancy} t={t} />
          </View>
          <Text size="sm" color="textMuted" numberOfLines={1}>
            {tenancy.unit} · {tenancy.address}
          </Text>
        </View>

        <View style={{ height: 1, backgroundColor: c.borderSubtle }} />

        <View style={{ flexDirection: 'row', gap: space[4] }}>
          <View style={{ flex: 1, gap: 3 }}>
            <Text
              weight="bold"
              size="2xs"
              color="textSubtle"
              style={{ letterSpacing: 1, textTransform: 'uppercase' }}
            >
              {t('leases.rent')}
            </Text>
            <MoneyAmount value={tenancy.rent} strong size="lg" />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text
              weight="bold"
              size="2xs"
              color="textSubtle"
              style={{ letterSpacing: 1, textTransform: 'uppercase' }}
            >
              {t('leases.nextDue')}
            </Text>
            {due ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                <Text weight="semibold" size="md" color="textStrong">
                  {due.dueOn ? formatFullDay(due.dueOn, t) : due.month}
                </Text>
                <PaymentStatus status={due.status} />
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                <Icon name="check" size={15} color={c.success600} />
                <Text weight="semibold" size="md" color="textStrong">
                  {t('leases.upToDate')}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* What has been asked for on this lease and not yet answered. Both
            are outstanding requests rather than states of the tenancy, so they
            sit under the numbers rather than replacing the status chip. */}
        {tenancy.notice ? (
          <NoteRow
            icon="clock"
            tone="warning600"
            text={t('leases.noticeFiled', { date: formatFullDay(tenancy.notice.moveOutOn, t) })}
          />
        ) : null}
        {tenancy.renewal?.state === 'pending' ? (
          <NoteRow icon="repeat" tone="textMuted" text={t('leases.renewalPending')} />
        ) : null}
      </View>
    </PressableScale>
  );
}

function NoteRow({
  icon,
  tone,
  text,
}: {
  icon: 'clock' | 'repeat';
  tone: 'warning600' | 'textMuted';
  text: string;
}) {
  const { c, space } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
      <Icon name={icon} size={15} color={c[tone]} />
      <Text size="xs" color={tone} style={{ flex: 1 }}>
        {text}
      </Text>
    </View>
  );
}

/** The PAST row: a thumbnail, what it was, and when it stopped. */
function PastLeaseRow({ tenancy, t }: { tenancy: Tenancy; t: Translate }) {
  const { c, space, radius } = useTheme();
  const router = useRouter();
  const asset = photoAsset(tenancy.photos.thumbnail);

  return (
    <PressableScale
      accessibilityLabel={t('leases.open', { unit: tenancy.unit })}
      onPress={() => router.push({ pathname: '/lease/[id]', params: { id: tenancy.id } })}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        minHeight: 44,
        padding: space[3],
        borderRadius: radius.lg,
        backgroundColor: c.surface1,
        borderWidth: 1,
        borderColor: c.borderSubtle,
      }}
    >
      <Image
        source={asset?.source}
        placeholder={asset?.placeholder}
        contentFit="cover"
        style={{ width: 44, height: 44, borderRadius: radius.sm }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text weight="semibold" size="md" color="textStrong" numberOfLines={1}>
          {tenancy.landlordOrg}
        </Text>
        <Text size="xs" color="textMuted" numberOfLines={1}>
          {tenancy.unit} · {t('leases.endedOn', { date: formatMonthYear(tenancy.endOn, t) })}
        </Text>
      </View>
      <StatusBadge domain="lease" state={tenancy.leaseState} />
    </PressableScale>
  );
}

export function Leases() {
  const { c, space } = useTheme();
  const router = useRouter();
  const t = useT();
  const { workspace } = useDomain();
  const offline = useOffline();

  const leases = useTenancies();
  const all = leases.data ?? [];
  const live = all.filter(isLiveTenancy);
  const past = all.filter((x) => !isLiveTenancy(x));
  const unsigned = live.filter((x) => x.leaseState === 'pending_signature');
  const running = live.filter((x) => x.leaseState !== 'pending_signature');

  return (
    <Screen.List<Tenancy>
      greeting={`${workspace.name} · ${workspace.role}`}
      title={t('leases.title')}
      action={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          {/* Frame R11 draws a bell here; every other list screen in the app
              draws the workspace chip. Both, because the chip is how a reader
              leaves the Tenant seat and the bell is how they reach what has
              happened on it. */}
          <PressableScale
            accessibilityLabel={t('leases.openInbox')}
            onPress={() => router.push('/inbox')}
            hitSlop={6}
            style={{
              width: 34,
              height: 34,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: c.surface2,
            }}
          >
            <Icon name="bell" size={17} color={c.textBody} />
          </PressableScale>
          <WorkspaceChip
            name={workspace.name}
            role={workspace.role}
            onPress={() => router.push('/switch')}
          />
        </View>
      }
      header={
        <>
          {offline ? <OfflineNote /> : null}

          {unsigned.map((x) => (
            <Card key={x.id} variant="tint">
              <View style={{ gap: space[3] }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: space[3],
                  }}
                >
                  <Text
                    family="display"
                    weight="semibold"
                    size="lg"
                    color="brand900"
                    style={{ flexShrink: 1 }}
                  >
                    {x.landlordOrg} · {x.unit}
                  </Text>
                  <StatusBadge domain="lease" state={x.leaseState} />
                </View>
                <Text size="sm" color="brand900" style={{ opacity: 0.8, lineHeight: 19 }}>
                  {t('leases.unsignedBody', {
                    org: x.landlordOrg,
                    start: x.startDate,
                    end: x.endDate,
                  })}
                </Text>
                <View style={{ flexDirection: 'row', gap: space[2] }}>
                  <Button
                    variant="primary"
                    size="md"
                    leadingIcon="edit"
                    onPress={() =>
                      router.push({ pathname: '/lease/[leaseId]/sign', params: { leaseId: x.id } })
                    }
                  >
                    {t('leases.reviewAndSign')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="md"
                    accessibilityLabel={t('leases.open', { unit: x.unit })}
                    onPress={() => router.push({ pathname: '/lease/[id]', params: { id: x.id } })}
                  >
                    {t('leases.details')}
                  </Button>
                </View>
              </View>
            </Card>
          ))}

          {running.map((x) => (
            <LiveLeaseCard key={x.id} tenancy={x} t={t} />
          ))}

          {/* The one empty case that is not "no leases at all": every tenancy
              has ended. Saying "no leases" there would be a lie about a
              history the reader can see underneath it. */}
          {leases.status === 'ready' && live.length === 0 && past.length > 0 ? (
            <EmptyState
              icon="key"
              title={t('leases.emptyActiveTitle')}
              body={t('leases.emptyActiveBody')}
              action={
                <Button
                  variant="outline"
                  size="sm"
                  leadingIcon="inbox"
                  onPress={() => router.push('/inbox')}
                >
                  {t('state.emptyGoTo', { tab: t('nav.inbox') })}
                </Button>
              }
            />
          ) : null}

          {past.length > 0 ? <SectionLabel>{t('leases.past')}</SectionLabel> : null}
        </>
      }
      data={past}
      keyExtractor={(x) => x.id}
      renderItem={({ item }) => <PastLeaseRow tenancy={item} t={t} />}
      loading={leases.status === 'loading'}
      loadingLabel={t('state.loadingList', { label: t('leases.listLabel') })}
      loadingRows={2}
      empty={
        leases.status === 'error' ? (
          <ErrorState
            title={t('state.errorTitle')}
            body={t('state.errorBody', { label: t('leases.listLabel') })}
            detail={leases.error?.message}
            onRetry={leases.retry}
          />
        ) : all.length === 0 ? (
          <EmptyState
            icon="key"
            title={t('leases.emptyTitle')}
            body={t('leases.emptyBody')}
          // A tenancy arrives with an invitation, and an invitation arrives in
          // Inbox. That is the way somewhere from here — not a way to conjure a
          // lease, which nothing on this screen could do.
          action={
            <Button
              variant="outline"
              size="sm"
              leadingIcon="inbox"
              onPress={() => router.push('/inbox')}
            >
              {t('state.emptyGoTo', { tab: t('nav.inbox') })}
            </Button>
          }
          />
        ) : null
      }
    />
  );
}
