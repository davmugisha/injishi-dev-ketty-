/**
 * One conversation, as a row. Frame R13's first row:
 * "IN · Ingoro Apartments · The electrician is booked for Friday morn… · 2h"
 * with an unread dot.
 *
 * ADR-032 lists what a row owes its reader and this draws exactly that: the
 * counterparty in display type, the last message on ONE line, a relative
 * timestamp, and a filled dot in the brand tint when `unreadCount > 0`.
 *
 * Three details that are decisions rather than styling:
 *
 *   - **The preview is scrubbed.** It is a read path like any other, and a
 *     phone number leaking into a list because the redaction only ran inside
 *     the thread would satisfy AC-18 in the bubble and break it on the row.
 *   - **Unread is dot plus weight, never colour alone.** The canvas rule is
 *     that status is colour plus label plus a glyph where it matters; here the
 *     unread row also carries its name and preview at a heavier weight, so it
 *     reads as unread in greyscale and to a colour blind reader. The dot has an
 *     accessibility label of its own so it is not silent.
 *   - **An archived row says so.** A closed conversation is still a row you can
 *     open and read; it is not a row you can act on, and finding that out only
 *     after tapping is the thing this avoids.
 */
import { View } from 'react-native';
import { Avatar, Badge, Icon, PressableScale, Text } from '@/components';
import { useTheme } from '@/theme/theme';
import { useLocale, useT } from '@/i18n/i18n';
import { scrubbedText } from '@/data/scrub';
import type { Thread } from '@/data/threads';
import { timeText } from './time-text';

export function ThreadRow({
  thread,
  now,
  onPress,
}: {
  thread: Thread;
  now: number;
  onPress: () => void;
}) {
  const { c, space, radius } = useTheme();
  const t = useT();
  const { locale } = useLocale();

  const unread = thread.unreadCount > 0;
  const time = timeText(thread.lastMessageAt, now, t, locale);
  const preview =
    (thread.lastMessageFromUs ? t('inbox.youPrefix') : '') +
    scrubbedText(thread.lastMessageBody, t('inbox.redacted'));

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={t(unread ? 'inbox.rowLabelUnread' : 'inbox.rowLabel', {
        name: thread.counterpartyName,
        preview,
        time,
      })}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        padding: space[3],
        // The 44pt floor, with room for two lines of preview above it.
        minHeight: 72,
        borderRadius: radius.lg,
        backgroundColor: unread ? c.bgTint : c.surface1,
        borderWidth: 1,
        borderColor: unread ? c.borderBrand : c.borderSubtle,
      }}
    >
      <Avatar name={thread.counterpartyName} size="md" square />

      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <Text
            family="display"
            weight={unread ? 'semibold' : 'medium'}
            size="md"
            color="textStrong"
            numberOfLines={1}
            style={{ flex: 1 }}
          >
            {thread.counterpartyName}
          </Text>
          <Text size="xs" color={unread ? 'textBody' : 'textMuted'} weight={unread ? 'semibold' : 'regular'}>
            {time}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <Text
            size="sm"
            color={unread ? 'textBody' : 'textMuted'}
            weight={unread ? 'medium' : 'regular'}
            numberOfLines={1}
            style={{ flex: 1, lineHeight: 18 }}
          >
            {preview}
          </Text>
          {unread ? (
            <View
              accessible
              accessibilityRole="image"
              accessibilityLabel={t('inbox.unreadDot')}
              style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: c.brand500 }}
            />
          ) : null}
        </View>

        {/* The property under the person, because a tenant with two leases and
            one landlord would otherwise see the same name twice. Archived
            replaces it, since "closed" is the more useful fact once it is. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 }}>
          {thread.status === 'archived' ? (
            <Badge tone="neutral">{t('inbox.archivedTag')}</Badge>
          ) : (
            <>
              <Icon
                name={thread.scope === 'lease' ? 'fileText' : 'calendar'}
                size={11}
                color={c.textSubtle}
              />
              <Text size="xs" color="textSubtle" numberOfLines={1} style={{ flex: 1 }}>
                {thread.propertyName}
              </Text>
            </>
          )}
        </View>
      </View>
    </PressableScale>
  );
}
