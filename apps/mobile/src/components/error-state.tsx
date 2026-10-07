/**
 * ErrorState — a read that failed, with the retry attached.
 *
 * Distinct from `EmptyState` on purpose: an empty list and an unreachable one
 * are different facts, and rendering "nothing yet" over a failed read is the
 * misleading zero `ui-screens.md` §6 forbids. Empty says the data is not there;
 * this says we could not tell.
 *
 * The detail line is shown only when there is one, and is never the whole
 * message — an error the reader can act on says what failed in their words
 * first, and leaves the exception underneath for whoever is debugging.
 *
 * **The alert is the text, not the card.** The card used to be `accessible`
 * with role `alert`, and on iOS an accessible view is ONE element: the Retry
 * button inside it could not be focused with VoiceOver at all, on every error
 * state in the app (mobile audit 2026-10-05, XC-02; `UndoBar` documents the
 * same trap). The icon, title, body and detail now form the alert, and Retry is
 * its sibling. iOS also ignores role `alert`, so the message is announced
 * there by hand, as `Toast` does.
 */
import { useEffect } from 'react';
import { AccessibilityInfo, Platform, View } from 'react-native';
import { Text } from './text';
import { Icon } from './icon';
import { Button } from './button';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';

export function ErrorState({
  title,
  body,
  detail,
  onRetry,
}: {
  title: string;
  body: string;
  detail?: string;
  onRetry?: () => void;
}) {
  const { c, radius } = useTheme();
  const t = useT();
  const announcement = `${title}. ${body}`;

  useEffect(() => {
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(announcement);
  }, [announcement]);

  return (
    <View
      style={{
        alignItems: 'center',
        gap: 10,
        paddingVertical: 30,
        paddingHorizontal: 24,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: c.borderSubtle,
        backgroundColor: c.surface1,
      }}
    >
      <View
        accessible
        accessibilityRole="alert"
        accessibilityLabel={announcement}
        style={{ alignItems: 'center', gap: 10 }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: c.danger100,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="alert" size={20} color={c.danger600} />
        </View>
        <Text family="display" weight="semibold" size="lg" color="textStrong" center>
          {title}
        </Text>
        <Text size="sm" color="textMuted" center style={{ lineHeight: 20, maxWidth: 280 }}>
          {body}
        </Text>
        {detail ? (
          <Text family="mono" size="xs" color="textSubtle" center numberOfLines={3} style={{ maxWidth: 280 }}>
            {detail}
          </Text>
        ) : null}
      </View>
      {onRetry ? (
        <View style={{ marginTop: 4 }}>
          <Button variant="outline" size="md" leadingIcon="rotateCcw" onPress={onRetry}>
            {t('state.retry')}
          </Button>
        </View>
      ) : null}
    </View>
  );
}
