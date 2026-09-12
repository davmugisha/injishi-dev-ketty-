/**
 * One message bubble, sided by `fromUs` (ADR-032's own word for it).
 *
 * ## Redaction is drawn, not substituted
 *
 * F-S06 says a phone number is never exposed and AC-18 says the stored row is
 * verbatim while every read path hides it. `@/data/scrub.ts` splits a body into
 * shown and hidden runs, and this renders the hidden ones as a visible mark
 * rather than silently deleting them.
 *
 * That is the decision worth defending. A number quietly replaced by nothing
 * reads as a sentence the sender wrote badly — "his number is if you need to
 * reach him" — and the reader blames the app or the sender rather than
 * understanding the rule. A visible mark says a number was there and is hidden
 * on purpose, which is the difference between a policy and a bug. The mark
 * carries its own accessibility label, so a screen reader hears the same fact
 * rather than skipping a gap.
 *
 * ## Sided, but not by colour alone
 *
 * Our own bubble is the brand fill on the right; theirs is a surface with a
 * hairline on the left. Side and shape carry the meaning, which is what makes
 * it legible in greyscale; the time under each bubble names the sender for a
 * screen reader, which never sees a side at all.
 */
import { View } from 'react-native';
import { Icon, PressableScale, Text } from '@/components';
import { useTheme } from '@/theme/theme';
import { useLocale, useT } from '@/i18n/i18n';
import { scrubPhones } from '@/data/scrub';
import type { Message } from '@/data/threads';
import { shortDate } from './time-text';

/** `14:32` — a bubble's own stamp. The day comes from the separator above it. */
function clockTime(at: number, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(
      new Date(at),
    );
  } catch {
    return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(
      new Date(at),
    );
  }
}

export function MessageBubble({
  message,
  counterpartyName,
  onRetry,
  onDiscard,
}: {
  message: Message;
  counterpartyName: string;
  /** Offered only on a `failed` message. See the delivery block below. */
  onRetry?: () => void;
  onDiscard?: () => void;
}) {
  const { c, space, radius } = useTheme();
  const t = useT();
  const { locale } = useLocale();

  const mine = message.fromUs;
  const segments = scrubPhones(message.body);
  const time = clockTime(message.createdAt, locale === 'rw' ? 'rw-RW' : 'en-GB');
  const who = mine ? t('inbox.sentByYou') : counterpartyName;

  // One node, one sentence. A reader should hear who said what and when, not
  // three fragments they have to reassemble — and never a bare gap where a
  // number was hidden.
  const spoken = `${who}: ${segments
    .map((s) => (s.kind === 'redacted' ? t('inbox.redactedA11y') : s.value))
    .join('')}, ${time}`;

  return (
    <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', gap: 3 }}>
      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel={spoken}
        style={{
          maxWidth: '86%',
          paddingVertical: 10,
          paddingHorizontal: 13,
          borderRadius: radius.lg,
          // The corner nearest the sender is squared off, which is what makes
          // the side readable without colour.
          borderBottomRightRadius: mine ? radius.xs : radius.lg,
          borderBottomLeftRadius: mine ? radius.lg : radius.xs,
          backgroundColor: mine ? c.brand500 : c.surface1,
          borderWidth: mine ? 0 : 1,
          borderColor: c.borderSubtle,
          opacity: message.pending ? 0.6 : 1,
        }}
      >
        {/* **Session 11's dark audit fixed this pair.** The bubble drew
            `textOnBrand` on `brand500`, which measures **3.18:1 in the light
            scheme** — under the 4.5 floor, on the one thing on this screen
            somebody is actually reading. `textOnBrand` is the ACCENT fill's ink
            (design brief §7.3: "the accent fill takes ink text, never white")
            and `brand500` is HeroUI's `muted`, not the accent. `bgApp` is the
            foreground `muted` owes: 5.12:1 light, 7.79:1 dark. */}
        <Text size="sm" color={mine ? 'bgApp' : 'textBody'} style={{ lineHeight: 20 }}>
          {segments.map((segment, i) =>
            segment.kind === 'text' ? (
              segment.value
            ) : (
              <Text
                key={`r${i}`}
                size="sm"
                weight="medium"
                color={mine ? 'bgApp' : 'textMuted'}
                style={{
                  // Not a pill: an inline `View` inside `Text` breaks line
                  // wrapping on Android. Brackets and a lighter weight do the
                  // same job and wrap like the words around them.
                  textDecorationLine: 'underline',
                }}
              >
                {`[${t('inbox.redacted')}]`}
              </Text>
            ),
          )}
        </Text>
      </View>

      {/* The delivery state, and the actions the failed one owes.
          `pending` used to be one boolean doing two jobs and it could not do
          the second: a send that FAILED looked exactly like a send in flight,
          so a message lost on a bad connection kept a clock beside it forever.
          Three states now, and only one of them asks anything of the reader. */}
      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space[1] }}
      >
        {message.delivery === 'failed' ? (
          <Icon name="alertCircle" size={11} color={c.danger600} />
        ) : message.pending ? (
          <Icon name={message.delivery === 'queued' ? 'wifiOff' : 'clock'} size={11} color={c.textSubtle} />
        ) : null}
        <Text size="2xs" color={message.delivery === 'failed' ? 'danger600' : 'textSubtle'}>
          {message.delivery === 'failed'
            ? t('inbox.failed')
            : message.delivery === 'queued'
              ? t('inbox.queued')
              : message.pending
                ? t('inbox.sending')
                : time}
        </Text>
      </View>

      {message.delivery === 'failed' && (onRetry || onDiscard) ? (
        <View
          accessible
          accessibilityLabel={t('inbox.failedA11y')}
          style={{ flexDirection: 'row', gap: space[2], paddingHorizontal: space[1] }}
        >
          {onRetry ? (
            <BubbleAction label={t('inbox.retrySend')} tone="textLink" onPress={onRetry} />
          ) : null}
          {onDiscard ? (
            <BubbleAction label={t('inbox.discardSend')} tone="textMuted" onPress={onDiscard} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * The line between two calendar days. "Today", "Yesterday", or the date.
 *
 * Drawn as a centred label on a hairline rather than as a floating chip,
 * because it is a divider first: its job is to say the conversation stopped and
 * started again, and a chip with no rule through it reads as another message.
 */
export function DaySeparator({ label }: { label: string }) {
  const { c, space } = useTheme();

  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        paddingVertical: space[1],
      }}
    >
      <View style={{ flex: 1, height: 1, backgroundColor: c.borderSubtle }} />
      <Text size="xs" weight="semibold" color="textSubtle">
        {label}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: c.borderSubtle }} />
    </View>
  );
}

/** Re-exported so the thread screen has one import for the date formatter. */
export { shortDate };

/**
 * A text action under a failed bubble.
 *
 * A 44px target, because a control on a message is still a control and this one
 * is pressed by someone who has just had a message not send — the worst moment
 * to hand them a 20px tap area.
 */
function BubbleAction({
  label,
  tone,
  onPress,
}: {
  label: string;
  tone: 'textLink' | 'textMuted';
  onPress: () => void;
}) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={12}
      style={{ minHeight: 44, justifyContent: 'center' }}
    >
      <Text size="2xs" weight="semibold" color={tone}>
        {label}
      </Text>
    </PressableScale>
  );
}
