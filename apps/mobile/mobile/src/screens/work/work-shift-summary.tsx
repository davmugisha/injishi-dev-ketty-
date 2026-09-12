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
 * and their supervisor only — and it is why this is drawn as three quiet
 * `StatRow`s in one card rather than as three `StatCard` tiles. Tiles compete
 * for attention and invite comparison; a ledger read top to bottom does not.
 *
 * For the same reason there is no target, no percentage against an average, and
 * no colour on the numbers. "Average per room 22 min" is a fact about the
 * shift, not a score to beat.
 */
import { View } from 'react-native';
import { Card, StatRow, Tag, Text } from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { ME } from '@/data/personas';
import { WORK_PROFILE } from './work-fixtures';
import { shiftSummary } from './work-format';
import { useWorkTasks } from './work-store';

export function WorkShiftSummary() {
  const t = useT();
  const { space } = useTheme();
  const tasks = useWorkTasks();
  const summary = shiftSummary(tasks.rows);

  return (
    <View style={{ gap: space[3] }}>
      <Text
        weight="bold"
        size="xs"
        color="textMuted"
        style={{ letterSpacing: 1.1, textTransform: 'uppercase' }}
      >
        {t('work.shift.eyebrow', {
          name: ME.name,
          start: WORK_PROFILE.shiftStart,
          end: WORK_PROFILE.shiftEnd,
        }).toUpperCase()}
      </Text>

      <Card title={t('work.shift.title')}>
        <View>
          <StatRow
            icon="bed"
            label={t('work.shift.cleaned')}
            value={summary.cleaned}
            divider
          />
          <StatRow
            icon="clock"
            label={t('work.shift.average')}
            value={summary.averageMinutes}
            unit={t('work.shift.minutes')}
            divider
          />
          <StatRow icon="sparkles" label={t('work.shift.left')} value={summary.left} />
        </View>
      </Card>

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
            // One node, one sentence: a reader should hear "rooms you finished,
            // 101, 102, 105…" rather than tab through eleven inert chips.
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

      <Text size="xs" color="textSubtle" style={{ lineHeight: 18 }}>
        {t('work.shift.footnote')}
      </Text>
    </View>
  );
}
