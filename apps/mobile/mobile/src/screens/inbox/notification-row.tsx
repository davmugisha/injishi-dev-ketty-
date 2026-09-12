/**
 * One system event, as a row. Frame R13's second and third rows:
 * "🔧 Maintenance · Your socket repair ticket is in progress · 1d" and
 * "▤ Rent receipt · July rent received — RWF 310,000 · Jul 01".
 *
 * The canvas draws a square icon tile, which is what separates a notification
 * from a message at a glance: a message has a person's initials in a rounded
 * avatar, a notification has a glyph in a tinted square. That difference is the
 * only reason the two segments can share a scroll position in a reader's head.
 *
 * **The type's own word is always printed**, as the row's title, so the glyph
 * and the tint never carry the meaning alone — the canvas rule about status
 * being readable in greyscale and to a colour blind reader applies to these
 * rows exactly as it does to a `StatusBadge`.
 *
 * **Read state is per row, and tapping is what clears it.** Opening the segment
 * does not mark the list read: a list that clears itself the moment you glance
 * at it loses the one row you meant to come back to.
 */
import { View } from 'react-native';
import { Icon, PressableScale, Text } from '@/components';
import { useTheme } from '@/theme/theme';
import type { Palette } from '@/theme/tokens';
import { useLocale, useT } from '@/i18n/i18n';
import { NOTIFICATION_STYLE, type AppNotification } from '@/data/notifications';
import { timeText } from './time-text';

/** Tone to the two palette keys that draw it. No colour is written here. */
const TINT: Record<
  (typeof NOTIFICATION_STYLE)[keyof typeof NOTIFICATION_STYLE]['tone'],
  { fill: keyof Palette; ink: keyof Palette }
> = {
  brand: { fill: 'brand100', ink: 'brand700' },
  success: { fill: 'success100', ink: 'success600' },
  warning: { fill: 'warning100', ink: 'warning600' },
  neutral: { fill: 'neutral100', ink: 'textBody' },
};

export function NotificationRow({
  notification,
  now,
  onPress,
}: {
  notification: AppNotification;
  now: number;
  onPress: () => void;
}) {
  const { c, space, radius } = useTheme();
  const t = useT();
  const { locale } = useLocale();

  const style = NOTIFICATION_STYLE[notification.type];
  const tint = TINT[style.tone];
  const unread = notification.readAt === undefined;
  const time = timeText(notification.createdAt, now, t, locale);

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={t(unread ? 'inbox.notificationLabelUnread' : 'inbox.notificationLabel', {
        title: notification.title,
        body: notification.body,
        time,
      })}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: space[3],
        padding: space[3],
        minHeight: 68,
        borderRadius: radius.lg,
        backgroundColor: unread ? c.bgTint : c.surface1,
        borderWidth: 1,
        borderColor: unread ? c.borderBrand : c.borderSubtle,
      }}
    >
      {/* The square tile the canvas draws. Square, not round, so it never reads
          as a person. */}
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: radius.md,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: c[tint.fill],
        }}
      >
        <Icon name={style.icon} size={18} color={c[tint.ink]} />
      </View>

      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <Text
            weight={unread ? 'semibold' : 'medium'}
            size="sm"
            color="textStrong"
            numberOfLines={1}
            style={{ flex: 1 }}
          >
            {notification.title}
          </Text>
          <Text size="xs" color={unread ? 'textBody' : 'textMuted'} weight={unread ? 'semibold' : 'regular'}>
            {time}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[2] }}>
          <Text
            size="sm"
            color={unread ? 'textBody' : 'textMuted'}
            numberOfLines={2}
            style={{ flex: 1, lineHeight: 18 }}
          >
            {notification.body}
          </Text>
          {unread ? (
            <View
              accessible
              accessibilityRole="image"
              accessibilityLabel={t('inbox.unreadDot')}
              style={{
                width: 9,
                height: 9,
                borderRadius: 5,
                marginTop: 5,
                backgroundColor: c.brand500,
              }}
            />
          ) : null}
        </View>
      </View>
    </PressableScale>
  );
}
