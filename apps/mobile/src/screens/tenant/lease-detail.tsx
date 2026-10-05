/**
 * Frame R15 · Lease detail, tenant seat — one tenancy, as the person living in
 * it reads it (FL25 step 2).
 *
 * The seat is the whole difference from frame R7, the landlord's view of the
 * same aggregate: the counterparty here is the landlord, the money is owed
 * rather than owing, and the compliance block is read-only reassurance instead
 * of an operator's worklist. `app/lease/[id].tsx` is where the two seats
 * branch; Session 8 adds the landlord arm.
 *
 * **FL25 step 3 locks every non-signing action until the lease is `active`.**
 * An unsigned lease therefore shows one control and one control only, and the
 * rows that would normally open a contract or a visitor log say why they are
 * shut rather than going quiet. A locked row that looks pressable and does
 * nothing is the "orphaned control" the quality bar rules out.
 *
 * An `ended` lease is the mirror of that: the record stays readable and the
 * write actions go, because a tenancy that has closed is history rather than a
 * thing you can file a notice against.
 *
 * What the mobile audit of 2026-10-05 took off this screen, and why:
 *
 *   - **Request renewal and the renewal-pending note** (TN-13). Renewal is P2
 *     in the owner's v1.0 cut and its route is hidden, so the button bounced
 *     the reader home. The visitor log stays linked; its place in the cut is
 *     undecided.
 *   - **The documents list** (TN-14). Every row offered a download that only
 *     showed a toast saying the download was mocked, over file sizes nobody
 *     measured. The contract is still one tap away, in its own viewer.
 *   - **Pay rent outside the demo** (TN-07). The sticky bar's button exists
 *     only where the pay sheet does, which is the demo stack. It opens THIS
 *     lease's sheet now; it used to open Rent, which showed whichever lease
 *     came first (TN-16). Rent history opens this lease's ledger for the same
 *     reason.
 */
import { View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Avatar,
  Button,
  Card,
  Icon,
  ImageHeader,
  ListRow,
  MoneyAmount,
  PressableScale,
  SectionLabel,
  StatusBadge,
  StickyBar,
  TaxBadge,
  Text,
  todayIso,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT, type Translate } from '@/i18n/i18n';
import { useTenancy } from '@/data/tenancy-store';
import { useTickets, openTicketsForLease } from '@/data/tickets';
import { nextDuePeriod, paidToDate, type Tenancy } from '@/data/rentals';
import { usePlatform } from '@/queries/platform';
import { HeroCard, HeroLabel, HeroMoney, useHeroTones } from './hero-card';
import { TenureBadge } from './leases';
import { dueCaption, formatFullDay, formatMonthYear } from './dates';
import { LeaseError, LeaseLoading, LeaseMissing } from './lease-gate';

/**
 * "File move-out" as frame R15 draws it: a danger OUTLINE, not a danger fill.
 * The kit's `danger` variant is a solid red, which is right for the button that
 * actually files the notice (frame R17) and wrong here — this one only opens a
 * screen, and painting a navigation the colour of a destruction teaches a
 * reader to ignore the colour.
 */
function DangerOutlineButton({
  children,
  onPress,
}: {
  children: string;
  onPress: () => void;
}) {
  const { c, space, radius } = useTheme();
  return (
    <PressableScale
      accessibilityLabel={children}
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: space[2],
        paddingHorizontal: space[4],
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: c.danger500,
        backgroundColor: c.surface1,
      }}
    >
      <Icon name="logOut" size={16} color={c.danger600} />
      <Text weight="semibold" size="sm" color="danger600">
        {children}
      </Text>
    </PressableScale>
  );
}

/** The banner that says what has already been asked for on this lease. */
function StatusNote({ tenancy, t }: { tenancy: Tenancy; t: Translate }) {
  const { c, space } = useTheme();

  const note =
    tenancy.leaseState === 'pending_signature'
      ? { icon: 'edit' as const, title: null, body: t('lease.unsignedNote') }
      : tenancy.leaseState === 'ended'
        ? { icon: 'check' as const, title: t('lease.endedTitle'), body: t('lease.endedBody') }
        : tenancy.notice
          ? {
              icon: 'clock' as const,
              title: t('lease.noticeFiledTitle'),
              body: t('lease.noticeFiledBody', {
                landlord: tenancy.landlord,
                date: formatFullDay(tenancy.notice.moveOutOn, t),
              }),
            }
          : null;

  if (!note) return null;

  return (
    <Card variant="tint">
      <View style={{ flexDirection: 'row', gap: space[3] }}>
        <Icon name={note.icon} size={18} color={c.brand700} />
        <View style={{ flex: 1, gap: 3 }}>
          {note.title ? (
            <Text weight="semibold" size="sm" color="brand900">
              {note.title}
            </Text>
          ) : null}
          <Text size="sm" color="brand900" style={{ opacity: 0.82, lineHeight: 19 }}>
            {note.body}
          </Text>
        </View>
      </View>
    </Card>
  );
}

export function LeaseDetail({ id }: { id: string | undefined }) {
  const { c, space, onPhoto, onPhotoMuted } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const t = useT();
  const tones = useHeroTones();
  const { isDemo } = usePlatform();
  const today = todayIso();

  const read = useTenancy(id);
  const tickets = useTickets();
  const lease = read.data;

  if (read.status === 'loading') return <LeaseLoading rows={4} />;
  if (read.status === 'error') return <LeaseError error={read.error} onRetry={read.retry} />;
  if (!lease) return <LeaseMissing />;

  const unsigned = lease.leaseState === 'pending_signature';
  const closed = lease.leaseState === 'ended';
  const live = !unsigned && !closed;
  const due = nextDuePeriod(lease);
  const collected = paidToDate(lease);
  const open = openTicketsForLease(tickets.data ?? [], lease.id);
  // A count is said only once the tickets have been read. Before that, "Report
  // something broken" was drawn as if there were none and then flipped to
  // "1 open" (mobile audit 2026-10-05, TN-25).
  const ticketLine =
    tickets.status === 'loading'
      ? t('lease.ticketsChecking')
      : open.length > 0
        ? t('lease.openTicketCount', { count: open.length })
        : t('lease.noTickets');

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 130 }}
        showsVerticalScrollIndicator={false}
      >
        <ImageHeader
          stem={lease.photos.cover}
          height={280}
          caption={
            // A caption sits on a scrimmed photograph, which does not invert,
            // so its foreground is the theme's FIXED pair rather than a
            // palette key or the hero plate's scheme-aware tones (design brief
            // §6, §8.7).
            <View style={{ gap: 6 }}>
              <Text
                weight="bold"
                size="2xs"
                color={onPhotoMuted}
                style={{ letterSpacing: 1.2, textTransform: 'uppercase' }}
              >
                {lease.ref}
              </Text>
              <Text
                family="display"
                weight="semibold"
                size="xl"
                color={onPhoto}
                style={{ letterSpacing: -0.3 }}
              >
                {lease.landlordOrg}
              </Text>
              <Text size="sm" color={onPhotoMuted}>
                {lease.unit} · {lease.address}
              </Text>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], marginTop: 2 }}
              >
                <StatusBadge domain="lease" state={lease.leaseState} />
                <TenureBadge tenancy={lease} t={t} />
              </View>
            </View>
          }
        />

        <View style={{ paddingHorizontal: space[4], paddingTop: space[4], gap: space[4] }}>
          <StatusNote tenancy={lease} t={t} />

          {/* The two numbers frame R15 puts on its dark card. */}
          <HeroCard>
            <View style={{ flexDirection: 'row', gap: space[4] }}>
              <View style={{ flex: 1, gap: 4 }}>
                <HeroLabel>{t('lease.rent')}</HeroLabel>
                <HeroMoney value={lease.rent} size="xl" />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <HeroLabel>{t('lease.ends')}</HeroLabel>
                <Text family="display" weight="semibold" size="xl" color={tones.fg}>
                  {formatMonthYear(lease.endOn, t)}
                </Text>
              </View>
            </View>
            {due?.dueOn ? (
              <Text size="xs" color={tones.fgMuted}>
                {t('rent.due', { date: formatFullDay(due.dueOn, t) })} ·{' '}
                {dueCaption(due.dueOn, today, t)}
              </Text>
            ) : null}
          </HeroCard>

          {/* Who the counterparty is. On the landlord's seat this slot holds
              the tenant; getting it wrong is the one mistake a shared screen
              makes, which is why the two seats are two files. */}
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
              <Avatar name={lease.landlord} size="md" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text size="xs" color="textSubtle">
                  {t('lease.landlord')}
                </Text>
                <Text weight="semibold" size="md" color="textStrong" numberOfLines={1}>
                  {lease.landlord}
                </Text>
                <Text size="sm" color="textMuted" numberOfLines={1}>
                  {lease.landlordOrg}
                </Text>
              </View>
            </View>
          </Card>

          {/* Frame R15's three rows, plus the ledger. */}
          <Card bodyStyle={{ paddingVertical: 4 }}>
            <View>
              <ListRow
                icon="fileText"
                title={t('lease.contract')}
                subtitle={unsigned ? t('lease.contractLocked') : t('lease.contractMeta')}
                divider
                chevron={!unsigned}
                trailing={
                  unsigned ? <Icon name="lock" size={17} color={c.textSubtle} /> : undefined
                }
                onPress={
                  unsigned
                    ? undefined
                    : () =>
                        router.push({
                          pathname: '/lease/[leaseId]/contract',
                          params: { leaseId: lease.id },
                        })
                }
              />
              <ListRow
                icon="users"
                title={t('lease.visitors')}
                subtitle={
                  lease.visitors.length > 0
                    ? t('lease.visitorsCount', { count: lease.visitors.length })
                    : t('lease.visitorsNone')
                }
                divider
                chevron={!unsigned}
                trailing={
                  unsigned ? <Icon name="lock" size={17} color={c.textSubtle} /> : undefined
                }
                onPress={
                  unsigned
                    ? undefined
                    : () =>
                        router.push({
                          pathname: '/lease/[leaseId]/visitors',
                          params: { leaseId: lease.id },
                        })
                }
              />
              <ListRow
                icon="wrench"
                title={t('lease.logMaintenance')}
                subtitle={ticketLine}
                divider
                chevron={live}
                trailing={live ? undefined : <Icon name="lock" size={17} color={c.textSubtle} />}
                onPress={
                  live
                    ? () =>
                        router.push({
                          pathname: '/lease/[leaseId]/maintenance/new',
                          params: { leaseId: lease.id },
                        })
                    : undefined
                }
              />
              <ListRow
                icon="receipt"
                title={t('lease.rentHistory')}
                subtitle={t('lease.paidToDate')}
                chevron={!unsigned}
                trailing={
                  unsigned ? (
                    <Icon name="lock" size={17} color={c.textSubtle} />
                  ) : (
                    <MoneyAmount value={collected} strong size="sm" />
                  )
                }
                onPress={
                  unsigned
                    ? undefined
                    : () => router.push({ pathname: '/rent', params: { leaseId: lease.id } })
                }
              />
            </View>
          </Card>

          {/* Frame R15 drew two outline buttons here. Renewal is hidden in
              v1.0 (see the header), so move-out stands alone, and it is gone
              on a lease that has not started and on one that has closed:
              neither can be moved out of. */}
          {live ? (
            <View style={{ flexDirection: 'row' }}>
              <DangerOutlineButton
                onPress={() =>
                  router.push({
                    pathname: '/lease/[leaseId]/move-out',
                    params: { leaseId: lease.id },
                  })
                }
              >
                {t('lease.fileMoveOut')}
              </DangerOutlineButton>
            </View>
          ) : null}

          <SectionLabel>{t('lease.compliance')}</SectionLabel>
          <Card variant="tint">
            <View style={{ gap: space[3] }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: space[2],
                }}
              >
                <Text size="sm" color="brand900" style={{ flexShrink: 1 }}>
                  {t('lease.contractFiled')}
                </Text>
                <StatusBadge domain="filing" state={lease.filing} />
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: space[2],
                }}
              >
                <Text size="sm" color="brand900" style={{ flexShrink: 1 }}>
                  {t('lease.rentalIncome')}
                </Text>
                <TaxBadge status={lease.tax} />
              </View>
              <Text size="xs" color="brand900" style={{ opacity: 0.75, lineHeight: 18 }}>
                {t('lease.complianceNote')}
              </Text>
            </View>
          </Card>
        </View>
      </ScrollView>

      {unsigned ? (
        <StickyBar>
          <View style={{ flex: 1, paddingRight: space[3] }}>
            <Text size="xs" color="textMuted">
              {t('lease.awaitingSignature')}
            </Text>
            <MoneyAmount value={lease.rent} strong tone="brand" size="lg" />
          </View>
          <Button
            variant="primary"
            leadingIcon="edit"
            onPress={() =>
              router.push({ pathname: '/lease/[leaseId]/sign', params: { leaseId: lease.id } })
            }
          >
            {t('leases.reviewAndSign')}
          </Button>
        </StickyBar>
      ) : due && isDemo ? (
        <StickyBar>
          <View style={{ flex: 1, paddingRight: space[3] }}>
            <Text size="xs" color="textMuted">
              {due.status === 'overdue'
                ? t('lease.overdueMonth', { month: due.month })
                : t('lease.dueMonth', { month: due.month })}
            </Text>
            <MoneyAmount value={due.amount} strong tone="brand" size="lg" />
          </View>
          <Button
            variant="primary"
            leadingIcon="wallet"
            onPress={() =>
              router.push({
                pathname: '/pay-rent',
                params: { leaseId: lease.id, month: due.month },
              })
            }
          >
            {t('lease.payRent')}
          </Button>
        </StickyBar>
      ) : null}
    </View>
  );
}
