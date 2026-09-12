/**
 * The floor board — frame W4. "Status is not sellability."
 *
 * The teaching point of this screen is a distinction, not a grid: housekeeping
 * status is its own axis (F-P04 §6), so a room can be spotless and out of
 * service at the same time, and the two facts are owned by different people.
 * The info card says so in words; the board proves it by having `out_of_order`
 * as a state of its own rather than as a flag on `clean`.
 *
 * **Colour is never the only signal.** Every tile carries the state as a fill,
 * a word AND a glyph, which is the canvas rule stated on most frames: readable
 * in sunlight, in greyscale, and to a colour-blind reader. Calm states (clean,
 * inspected) keep the surface fill and a hairline; exceptions take the tone
 * fill and a heavier border, so a floor with nothing wrong reads as quiet and a
 * floor with three problems reads as three problems from arm's length.
 *
 * A wrapping grid on `<Screen>` rather than `<Screen.List>`: a board is bounded
 * by the floor it draws, the same reason Portfolio and Rent stay on the scroll
 * variant (see `src/components/screen.tsx`).
 */
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  PressableScale,
  Screen,
  SkeletonList,
  Text,
  type IconName,
} from '@/components';
import { statusTone } from '@/components';
import { useTheme } from '@/theme/theme';
import type { Palette } from '@/theme/tokens';
import { useT, type MessageKey } from '@/i18n/i18n';
import { WorkFilterTabs, WorkOfflineBar, WorkPageHead } from './work-chrome';
import { filterRooms, isCalm, roomFilters, type RoomFilter } from './work-format';
import type { HkStatus, WorkRoom } from './work-fixtures';
import { useConnection, useWorkRooms, useWorkTasks } from './work-store';

/** The second signal on every tile, so the state survives greyscale. */
const GLYPH: Record<HkStatus, IconName> = {
  clean: 'check',
  dirty: 'alertTriangle',
  in_progress: 'play',
  inspected: 'checkCircle',
  out_of_order: 'xCircle',
};

/** The shared housekeeping vocabulary, so the board and a badge never differ. */
export const STATUS_KEY: Record<HkStatus, MessageKey> = {
  clean: 'status.housekeeping.clean',
  dirty: 'status.housekeeping.dirty',
  in_progress: 'status.housekeeping.in_progress',
  inspected: 'status.housekeeping.inspected',
  out_of_order: 'status.housekeeping.out_of_order',
};

/** The tone table `statusTone` resolves to, as the two palette keys a fill needs. */
const TONE_FILL: Record<string, { bg: keyof Palette; fg: keyof Palette }> = {
  success: { bg: 'success100', fg: 'success600' },
  warning: { bg: 'warning100', fg: 'warning600' },
  brand: { bg: 'brand100', fg: 'brand700' },
  neutral: { bg: 'neutral100', fg: 'neutral600' },
  danger: { bg: 'danger100', fg: 'danger600' },
};

export function RoomsBoard() {
  const router = useRouter();
  const t = useT();
  const { c, space } = useTheme();

  const [filter, setFilter] = useState<RoomFilter>('all');
  const rooms = useWorkRooms();
  const tasks = useWorkTasks();
  const connection = useConnection();

  const shown = filterRooms(rooms.rows, filter);
  const filters = roomFilters(rooms.rows);

  /**
   * Frame W4's "In progress · you": the tile says whether the room being
   * cleaned is the one YOU are standing in. It is read off the task queue
   * rather than stored on the room, because the room does not know who has it.
   */
  const mine = useMemo(
    () =>
      new Set(
        tasks.rows.filter((task) => task.status === 'in_progress').map((task) => task.id),
      ),
    [tasks.rows],
  );

  const statusWord = (status: HkStatus) => t(STATUS_KEY[status]);

  return (
    <Screen>
      {/* Frame W4's eyebrow swaps the town for the room count: on this screen
          the useful second fact is how much building there is. */}
      <WorkPageHead
        title={t('work.rooms.title')}
        eyebrowSuffix={t('work.rooms.eyebrow', { count: rooms.rows.length })}
      />

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

      <WorkFilterTabs
        label={t('work.rooms.listLabel')}
        value={String(filter)}
        onChange={(next) => setFilter(next as RoomFilter)}
        items={filters.map((row) => ({
          value: String(row.value),
          label: row.value === 'all' ? t('work.rooms.filterAll') : statusWord(row.value),
          count: row.count,
        }))}
      />

      {rooms.status === 'loading' ? (
        <SkeletonList
          rows={3}
          label={t('state.loadingList', { label: t('work.rooms.listLabel') })}
        />
      ) : rooms.status === 'error' ? (
        <ErrorState
          title={t('state.errorTitle')}
          body={t('state.errorBody', { label: t('work.rooms.listLabel') })}
          detail={rooms.error?.message}
          onRetry={rooms.retry}
        />
      ) : shown.length === 0 ? (
        <EmptyState
          icon="bed"
          title={t('work.rooms.emptyTitle')}
          body={t('work.rooms.emptyBody', {
            status: filter === 'all' ? t('work.rooms.filterAll') : statusWord(filter),
          })}
          // Filtered to nothing is the case that HAS an action: widen it. An
          // unfiltered board with no rooms on it has none, and offers none
          // rather than inventing one.
          action={
            filter === 'all' ? undefined : (
              <Button variant="outline" size="sm" onPress={() => setFilter('all')}>
                {t('work.rooms.filterAll')}
              </Button>
            )
          }
        />
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
          {shown.map((room) => (
            <RoomTile
              key={room.id}
              room={room}
              statusWord={statusWord(room.status)}
              // Frame W4's "In progress · you", or the ticket holding it, or
              // the room type — in that order of usefulness to the reader.
              footnote={
                mine.has(room.id)
                  ? t('work.rooms.tileYou')
                  : (room.ticket ?? room.type)
              }
              hint={t('work.rooms.openHint')}
              label={t('work.rooms.open', {
                room: room.id,
                type: room.type,
                status: statusWord(room.status),
              })}
              onPress={() =>
                router.push({ pathname: '/room-status', params: { roomId: room.id } })
              }
            />
          ))}
        </View>
      )}

      <Card variant="tint" title={t('work.rooms.infoTitle')}>
        <View style={{ flexDirection: 'row', gap: space[3] }}>
          <Icon name="info" size={18} color={c.textLink} />
          <Text size="sm" color="textBody" style={{ flex: 1, lineHeight: 20 }}>
            {t('work.rooms.infoBody')}
          </Text>
        </View>
      </Card>
    </Screen>
  );
}

function RoomTile({
  room,
  statusWord,
  footnote,
  label,
  hint,
  onPress,
}: {
  room: WorkRoom;
  statusWord: string;
  footnote: string;
  /** Room, type and state as ONE sentence: a reader crossing thirty-six tiles
   *  should hear one node per tile, not three. */
  label: string;
  hint: string;
  onPress: () => void;
}) {
  const { c, radius, space } = useTheme();
  const tone = statusTone('housekeeping', room.status);
  const fill = TONE_FILL[tone] ?? TONE_FILL.neutral;
  const calm = isCalm(room.status);
  const ink = c[fill.fg];

  return (
    <PressableScale
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={onPress}
      style={{
        // Three to a row at 393pt with the screen's 16pt gutters and an 8pt gap.
        width: '31.5%',
        minHeight: 92,
        gap: 6,
        padding: space[3],
        borderRadius: radius.lg,
        backgroundColor: calm ? c.surface1 : c[fill.bg],
        borderWidth: calm ? 1 : 1.5,
        borderColor: calm ? c.borderSubtle : ink,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text family="mono" weight="semibold" size="xl" color="textStrong">
          {room.id}
        </Text>
        <Icon name={GLYPH[room.status]} size={15} color={ink} />
      </View>
      <Text weight="semibold" size="xs" color={fill.fg}>
        {statusWord}
      </Text>
      <Text size="2xs" color="textSubtle">
        {footnote}
      </Text>
    </PressableScale>
  );
}
