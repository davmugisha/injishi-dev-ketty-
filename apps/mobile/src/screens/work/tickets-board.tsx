/**
 * Tickets — the Engineering board, from the reporter's side.
 *
 * F-P05 gives Maintenance a kanban; this is the other end of it. A housekeeper
 * does not assign, prioritise or resolve, so none of those controls are here —
 * what they need is the answer to one question, which is whether the fault they
 * reported went anywhere and what it did to their room.
 *
 * **The empty state is the normal state, and it is a good one.** "Nothing
 * broken" is the honest reading of an empty board on a shift where nothing has
 * gone wrong, so it is drawn as a result rather than as an absence — with the
 * explanation of what filing does above it, and the action that fills it
 * attached. That is what keeps the tab from being a blank page on the day it is
 * most likely to be opened.
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
  Screen,
  SkeletonList,
  StatusBadge,
  Text,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { WorkFilterTabs, WorkOfflineBar, WorkPageHead } from './work-chrome';
import { FAULT_KEY, SEVERITY_KEY, ticketAge } from './work-format';
import type { TicketStatus, WorkTicket } from './work-fixtures';
import { useConnection, useWorkTickets } from './work-store';

type TicketFilter = 'all' | TicketStatus;

const FILTERS: TicketFilter[] = ['all', 'open', 'assigned', 'resolved'];

export function TicketsBoard() {
  const router = useRouter();
  const t = useT();
  const { c, space } = useTheme();
  const [filter, setFilter] = useState<TicketFilter>('all');
  const tickets = useWorkTickets();
  const connection = useConnection();

  // One clock for the whole render, so eight cards cannot disagree about how
  // long ago "just now" was.
  const now = useMemo(() => Date.now(), [tickets.rows]);

  const rows = tickets.rows;
  const shown = filter === 'all' ? rows : rows.filter((ticket) => ticket.status === filter);

  const report = (
    <Button variant="primary" size="md" leadingIcon="camera" onPress={() => router.push('/report-fault')}>
      {t('work.tickets.report')}
    </Button>
  );

  return (
    <Screen>
      <WorkPageHead title={t('work.tickets.title')} action={rows.length > 0 ? report : undefined}>
        <Text size="sm" color="textMuted">
          {t('work.tickets.subtitle')}
        </Text>
      </WorkPageHead>

      {!connection.online ? (
        <>
          <WorkOfflineBar
            title={t('work.offline.bannerTitle')}
            detail={t('work.offline.realOffline')}
          />
          <Text size="xs" color="textMuted" style={{ lineHeight: 18 }}>
            {t('state.offlineLastList')}
          </Text>
        </>
      ) : null}

      {rows.length > 0 ? (
        <WorkFilterTabs
          label={t('work.tickets.listLabel')}
          value={filter}
          onChange={(next) => setFilter(next as TicketFilter)}
          items={FILTERS.map((value) => ({
            value,
            label:
              value === 'all'
                ? t('work.rooms.filterAll')
                : t(`status.ticket.${value}` as 'status.ticket.open'),
            count: value === 'all' ? rows.length : rows.filter((x) => x.status === value).length,
          }))}
        />
      ) : null}

      <Card variant="tint" title={t('work.tickets.explainTitle')}>
        <View style={{ flexDirection: 'row', gap: space[3] }}>
          <Icon name="wrench" size={18} color={c.textLink} />
          <Text size="sm" color="textBody" style={{ flex: 1, lineHeight: 20 }}>
            {t('work.tickets.explainBody')}
          </Text>
        </View>
      </Card>

      {tickets.status === 'loading' ? (
        <SkeletonList
          rows={2}
          label={t('state.loadingList', { label: t('work.tickets.listLabel') })}
        />
      ) : tickets.status === 'error' ? (
        <ErrorState
          title={t('state.errorTitle')}
          body={t('state.errorBody', { label: t('work.tickets.listLabel') })}
          detail={tickets.error?.message}
          onRetry={tickets.retry}
        />
      ) : shown.length === 0 ? (
        <EmptyState
          icon="checkCircle"
          title={t('work.tickets.emptyTitle')}
          body={t('work.tickets.emptyBody')}
          action={report}
        />
      ) : (
        shown.map((ticket) => <TicketCard key={ticket.ref} ticket={ticket} now={now} />)
      )}
    </Screen>
  );
}

function TicketCard({ ticket, now }: { ticket: WorkTicket; now: number }) {
  const t = useT();
  const { c, space } = useTheme();
  const age = ticketAge(ticket, now);

  const photos =
    ticket.photos === 0
      ? t('work.tickets.noPhoto')
      : ticket.photos === 1
        ? t('work.tickets.photosOne')
        : t('work.tickets.photos', { count: ticket.photos });

  return (
    <Card>
      <View
        accessible
        accessibilityLabel={t('work.tickets.card', {
          ref: ticket.ref,
          room: ticket.room,
          status: t(`status.ticket.${ticket.status}` as 'status.ticket.open'),
        })}
        style={{ gap: space[3] }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
          <Text family="mono" weight="semibold" size="md" color="textStrong">
            {ticket.ref}
          </Text>
          <Text size="sm" color="textMuted" style={{ flex: 1 }}>
            {t('work.tickets.room', { room: ticket.room })}
          </Text>
          <StatusBadge domain="ticket" state={ticket.status} />
        </View>

        {ticket.line ? (
          <Text size="sm" color="textBody" style={{ lineHeight: 21 }}>
            {ticket.line}
          </Text>
        ) : null}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[2] }}>
          <Badge tone="neutral">{t(FAULT_KEY[ticket.category])}</Badge>
          <Badge tone={ticket.severity === 'urgent' ? 'danger' : ticket.severity === 'high' ? 'warning' : 'neutral'}>
            {t(SEVERITY_KEY[ticket.severity])}
          </Badge>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Icon name="camera" size={13} color={c.textSubtle} />
            <Text size="xs" color="textSubtle">
              {photos}
            </Text>
          </View>
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: space[2],
            paddingTop: space[3],
            borderTopWidth: 1,
            borderTopColor: c.borderSubtle,
          }}
        >
          <Text size="xs" color="textSubtle">
            {t('work.tickets.filed', { age: t(age.key, age.values) })}
          </Text>
          {ticket.status !== 'resolved' ? (
            <Text size="xs" weight="medium" color="danger600">
              {t('work.tickets.blocks')}
            </Text>
          ) : null}
        </View>
      </View>
    </Card>
  );
}
