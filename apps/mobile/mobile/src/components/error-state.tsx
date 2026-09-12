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
 */
import { View } from 'react-native';
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

  return (
    <View
      accessible
      accessibilityRole="alert"
      accessibilityLabel={`${title}. ${body}`}
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
