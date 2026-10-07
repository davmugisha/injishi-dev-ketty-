/**
 * WorkShiftSummary — frame W7. **Not a leaderboard.**
 *
 * Session 11 owns the Account screen; this is the block it mounts under the
 * Work section, built here because the numbers are this surface's and the
 * arithmetic lives beside the queue that produces them.
 *
 * The frame's footnote is a product rule, not a caption: *"Only you and your
 * supervisor see this. It is not ranked against anyone."* The canvas says the
 * same thing across every surface — a person's numbers are shown to that person
 * and their supervisor only — and it is why this is drawn as quiet `StatRow`s
 * in one card rather than as `StatCard` tiles. Tiles compete for attention and
 * invite comparison; a ledger read top to bottom does not.
 *
 * **It says less than the frame does, on purpose.** Frame W7 draws rooms
 * cleaned, an average per room and the shift's hours, and nothing on the server
 * supplies any of them yet (`GET /ops/shift-summary` does not exist, mobile
 * audit 2026-10-05 WK-19). They used to be fixture values printed under the
 * viewer's name: eleven rooms nobody cleaned, a 22 minute average and a
 * 06:00 to 14:00 shift (WK-02). What is left is what the queue itself knows,
 * shown only once its read has landed (WK-24).
 */
import { View } from 'react-native';
import { Card, ErrorState, SkeletonList, StatRow, Tag, Text } from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { useMyIdentity } from '@/queries/profile';
import { shiftSummary } from './work-format';
import { useWorkTasks } from './work-store';

export function WorkShiftSummary() {
  const t = useT();
  const { space } = useTheme();
  const me = useMyIdentity();
  const tasks = useWorkTasks();
  const summary = shiftSummary(tasks.rows);

  // The person holding the phone, as the server knows them, and nobody else.
  // Nothing while the profile read is out: a placeholder that flips to a name
  // reads as the name changing.
  const name = me.fromServer ? me.name : me.pending ? '' : t('identity.unnamed');

  return (
    <View style={{ gap: space[3] }}>
      {name ? (
        <Text
          weight="bold"
          size="xs"
          color="textMuted"
          // Caps by `textTransform`, never by upper-casing the string: a screen
          // reader given "SAMUEL" may spell it letter by letter (WK-31).
          style={{ letterSpacing: 1.1, textTransform: 'uppercase' }}
        >
          {name}
        </Text>
      ) : null}

      <Card title={t('work.shift.title')}>
        {tasks.ready ? (
          <StatRow icon="sparkles" label={t('work.shift.left')} value={summary.left} />
        ) : tasks.status === 'error' ? (
          <ErrorState
            title={t('state.errorTitle')}
            body={t('state.errorBody', { label: t('work.queue.listLabel') })}
            onRetry={tasks.retry}
          />
        ) : (
          <SkeletonList
            rows={1}
            label={t('state.loadingList', { label: t('work.queue.listLabel') })}
          />
        )}
      </Card>

      {tasks.ready ? (
        <View style={{ gap: space[2] }}>
          <Text
            weight="bold"
            size="xs"
            color="textMuted"
            style={{ letterSpacing: 1, textTransform: 'uppercase' }}
          >
            {t('work.shift.finishedTitle')}
          </Text>
          {summary.rooms.length > 0 ? (
            <View
              // One node, one sentence: a reader should hear "rooms you
              // finished, 104, 205" rather than tab through inert chips.
              accessible
              accessibilityLabel={`${t('work.shift.finishedTitle')}: ${summary.rooms.join(', ')}`}
              style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}
            >
              {summary.rooms.map((room) => (
                <Tag key={room}>{room}</Tag>
              ))}
            </View>
          ) : (
            <Text size="sm" color="textMuted">
              {t('work.shift.noneYet')}
            </Text>
          )}
        </View>
      ) : null}

      <Text size="xs" color="textSubtle" style={{ lineHeight: 18 }}>
        {t('work.shift.footnote')}
      </Text>
    </View>
  );
}
