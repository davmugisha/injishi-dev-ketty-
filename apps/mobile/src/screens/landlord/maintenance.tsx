/**
 * Maintenance — frame R4, the Repairs tab (F-R11).
 *
 * The tab is labelled "Repairs" and the route is `maintenance`; the frame does
 * the same thing, and the domain word is the one on the record.
 *
 * **The ticket states are the interactive twin's, not the frame's.** R4 draws
 * its chips as Open · In progress · Resolved, while `TICKET_STATE` in
 * `interactive-state-machine.js` — and `StatusBadge`'s `ticket` domain, which
 * Session 0 transcribed from it — has `open · assigned · resolved`. They are
 * the same three moments; "assigned" is the more honest of the two words,
 * because what actually happened is that a named technician took it, and the
 * card prints their name. Inventing a fourth state so both drawings survive
 * would put a state on the screen that nothing can ever set.
 *
 * ## The photographs
 *
 * F-R11 is explicit that a tenant logs an issue WITH PHOTOS, and R4 draws two
 * thumbnails on the leaking-tap ticket. A ticket filed on this device through
 * frame R20 (session 7) carries real `file://` uris and this screen draws them.
 * A SEEDED ticket cannot: its photographs are on a tenant's phone that does not
 * exist.
 *
 * The tempting fix is to borrow one of the app's 23 bundled photographs. That
 * would be a false statement on the screen — a Lake Kivu shoreline captioned as
 * evidence of a leaking tap — and ADR-015's visible-credit rule does not make a
 * caption true, it only makes the attribution correct. So a seeded ticket draws
 * evidence TILES instead, carrying the count and one line saying where the
 * pictures are. An honest placeholder beats a dishonest photograph.
 */
import { useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import type { IconName } from '@/components';
import {
  Badge,
  Button,
  ChipGroup,
  EmptyState,
  ErrorState,
  Icon,
  OfflineNote,
  Screen,
  StatusBadge,
  Text,
  useOffline,
  useToast,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useDomain } from '@/domain';
import { useT, type MessageKey, type Translate } from '@/i18n/i18n';
import { useFixtureMutation } from '@/data/use-fixture-mutation';
import {
  applyAssign,
  LANDLORD_TOWN,
  REPAIRS_KEY,
  seedRepairs,
  TECHNICIAN,
  useLandlordRead,
  type RepairSeverity,
  type RepairState,
  type RepairTicket,
} from '@/data/landlord';

type Filter = 'all' | RepairState;

/** Open first — this is a worklist, and a resolved ticket is an archive row. */
const RANK: Record<RepairState, number> = { open: 0, assigned: 1, resolved: 2 };

const SEVERITY: Record<RepairSeverity, { tone: 'danger' | 'brand' | 'neutral'; key: MessageKey }> = {
  // `urgent` is the only one that takes danger. A palette where two of three
  // severities read as an alarm is a palette nobody reads.
  urgent: { tone: 'danger', key: 'landlord.repairs.urgent' },
  normal: { tone: 'brand', key: 'landlord.repairs.normal' },
  low: { tone: 'neutral', key: 'landlord.repairs.low' },
};

const TILE = 62;

/** What a seeded ticket's photographs look like when the prototype has none. */
function EvidenceTiles({ ticket, t }: { ticket: RepairTicket; t: Translate }) {
  const { c, radius } = useTheme();
  const real = ticket.photos ?? [];
  const placeholders = real.length > 0 ? 0 : (ticket.photoCount ?? 0);
  const total = real.length + placeholders;
  if (total === 0) return null;

  const caption =
    total === 1
      ? t('landlord.repairs.onePhoto', { reporter: ticket.reporter })
      : t('landlord.repairs.photoCount', { count: total, reporter: ticket.reporter });

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {real.map((uri, i) => (
          <Image
            key={uri}
            source={{ uri }}
            accessibilityLabel={t('landlord.repairs.photoTile', { index: i + 1, total })}
            contentFit="cover"
            style={{
              width: TILE,
              height: TILE,
              borderRadius: radius.md,
              backgroundColor: c.surface3,
            }}
          />
        ))}
        {Array.from({ length: placeholders }, (_, i) => (
          <View
            key={`tile-${i}`}
            accessible
            accessibilityLabel={t('landlord.repairs.photoTile', { index: i + 1, total })}
            style={{
              width: TILE,
              height: TILE,
              borderRadius: radius.md,
              backgroundColor: c.surface2,
              borderWidth: 1,
              borderColor: c.borderDefault,
              // A dashed edge says "placeholder" before the caption does.
              borderStyle: 'dashed',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="image" size={19} color={c.textSubtle} />
          </View>
        ))}
      </View>
      <Text size="xs" color="textSubtle" style={{ lineHeight: 16 }}>
        {caption}
        {placeholders > 0 ? ` · ${t('landlord.repairs.photoOnPhone')}` : ''}
      </Text>
    </View>
  );
}

function TicketCard({
  ticket,
  t,
  busy,
  onAssign,
}: {
  ticket: RepairTicket;
  t: Translate;
  busy: boolean;
  onAssign: () => void;
}) {
  const { c, radius, shadow } = useTheme();
  const severity = SEVERITY[ticket.severity];
  const urgent = ticket.severity === 'urgent' && ticket.state === 'open';

  return (
    <View
      style={{
        borderRadius: radius.lg,
        backgroundColor: c.surface1,
        borderWidth: urgent ? 1.5 : 1,
        borderColor: urgent ? c.danger500 : c.borderSubtle,
        ...shadow.xs,
      }}
    >
      <View style={{ gap: 10, paddingHorizontal: 14, paddingVertical: 13 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <Text family="mono" weight="semibold" size="xs" color="textMuted">
            {ticket.ref}
          </Text>
          <StatusBadge domain="ticket" state={ticket.state} />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Text
            family="display"
            weight="semibold"
            size="lg"
            color="textStrong"
            style={{ flexShrink: 1 }}
          >
            {ticket.title}
          </Text>
          <Badge tone={severity.tone}>{t(severity.key)}</Badge>
        </View>

        <Text size="xs" color="textMuted" style={{ lineHeight: 18 }}>
          {t('landlord.repairs.meta', {
            unit: ticket.unit,
            reporter: ticket.reporter,
            raised: ticket.raised,
          })}
        </Text>

        <EvidenceTiles ticket={ticket} t={t} />

        {ticket.state !== 'open' && ticket.assignee ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <Icon name="tool" size={14} color={c.textMuted} />
            <Text size="xs" color="textMuted" numberOfLines={2} style={{ flex: 1 }}>
              {t('landlord.repairs.assignedTo', { name: ticket.assignee })}
              {ticket.note ? ` · ${ticket.note}` : ''}
            </Text>
          </View>
        ) : null}
      </View>

      {ticket.state === 'open' ? (
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
            variant="primary"
            size="sm"
            leadingIcon="wrench"
            disabled={busy}
            accessibilityLabel={t('landlord.repairs.assignA11y', {
              ref: ticket.ref,
              title: ticket.title,
            })}
            onPress={onAssign}
          >
            {busy ? t('landlord.saving') : t('landlord.repairs.assign')}
          </Button>
        </View>
      ) : null}
    </View>
  );
}

export function Maintenance() {
  const { space } = useTheme();
  const t = useT();
  const toast = useToast();
  const { workspace } = useDomain();
  const [filter, setFilter] = useState<Filter>('open');
  const [pending, setPending] = useState<string | null>(null);

  const read = useLandlordRead(REPAIRS_KEY, seedRepairs);
  const offline = useOffline();
  const all = read.data ?? [];

  const assign = useFixtureMutation(REPAIRS_KEY, applyAssign, seedRepairs);

  const shown = all
    .filter((k) => filter === 'all' || k.state === filter)
    .slice()
    .sort((a, b) => RANK[a.state] - RANK[b.state]);

  const count = (s: RepairState) => all.filter((k) => k.state === s).length;

  const onAssign = async (ticket: RepairTicket) => {
    setPending(ticket.ref);
    await assign.mutate({ ref: ticket.ref, assignee: TECHNICIAN });
    setPending(null);
    toast.show(
      t('landlord.repairs.assignedToast', { ref: ticket.ref, name: TECHNICIAN }),
      'success',
    );
  };

  const empty: { icon: IconName; title: MessageKey; body: MessageKey } =
    filter === 'open'
      ? { icon: 'checkCircle' as const, title: 'landlord.repairs.emptyOpenTitle', body: 'landlord.repairs.emptyOpenBody' }
      : filter === 'assigned'
        ? { icon: 'wrench' as const, title: 'landlord.repairs.emptyAssignedTitle', body: 'landlord.repairs.emptyAssignedBody' }
        : filter === 'resolved'
          ? { icon: 'check' as const, title: 'landlord.repairs.emptyResolvedTitle', body: 'landlord.repairs.emptyResolvedBody' }
          : { icon: 'wrench' as const, title: 'landlord.repairs.emptyAllTitle', body: 'landlord.repairs.emptyAllBody' };

  return (
    <Screen.List<RepairTicket>
      greeting={t('landlord.seat', { org: workspace.name, town: LANDLORD_TOWN })}
      title={t('landlord.repairs.title')}
      header={
        <>
          {/* The fourth list state, in the list rather than over it. The
              app-wide banner says the phone is offline; this says what that
              means for the rows under it — they are the last that loaded, and
              a rent ledger that is quietly stale is one somebody acts on.
              Session 11's audit found all three landlord lists without it. */}
          {offline ? <OfflineNote /> : null}
          <Text size="sm" color="textMuted" style={{ lineHeight: 19 }}>
            {t('landlord.repairs.summary', {
              open: count('open'),
              assigned: count('assigned'),
              org: workspace.name,
            })}
          </Text>

          <ChipGroup
            value={filter}
            onChange={(v) => setFilter(v as Filter)}
            items={[
              { value: 'open', label: t('landlord.repairs.filterOpen'), count: count('open') },
              {
                value: 'assigned',
                label: t('landlord.repairs.filterAssigned'),
                count: count('assigned'),
              },
              {
                value: 'resolved',
                label: t('landlord.repairs.filterResolved'),
                count: count('resolved'),
              },
              { value: 'all', label: t('landlord.repairs.filterAll'), count: all.length },
            ]}
          />

          <Text size="xs" color="textSubtle" style={{ lineHeight: 17 }}>
            {t('landlord.repairs.footnote')}
          </Text>
        </>
      }
      data={shown}
      keyExtractor={(k) => k.ref}
      renderItem={({ item }) => (
        <TicketCard
          ticket={item}
          t={t}
          busy={pending === item.ref}
          onAssign={() => void onAssign(item)}
        />
      )}
      loading={read.status === 'loading'}
      loadingLabel={t('state.loadingList', { label: t('landlord.repairs.listLabel') })}
      loadingRows={3}
      empty={
        read.status === 'error' ? (
          <ErrorState
            title={t('state.errorTitle')}
            body={t('state.errorBody', { label: t('landlord.repairs.listLabel') })}
            detail={read.error?.message}
            onRetry={read.retry}
          />
        ) : (
          <View style={{ gap: space[4] }}>
            <EmptyState
              icon={empty.icon}
              title={t(empty.title)}
              body={t(empty.body)}
              action={
                filter === 'all' || all.length === 0 ? null : (
                  <Button variant="outline" size="sm" onPress={() => setFilter('all')}>
                    {t('landlord.repairs.filterAll')}
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
