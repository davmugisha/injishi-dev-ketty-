/**
 * The composer, and the line that replaces it when a thread is closed.
 *
 * ADR-032: "An archived thread replaces the composer with a short line saying
 * the conversation is closed because the stay has ended." Two things about that
 * sentence are load bearing.
 *
 * **It REPLACES rather than disables.** A greyed-out field with a dead send
 * button is an orphaned control: it invites a tap and answers with nothing. The
 * closed line says what happened and, under it, that everything said is kept —
 * because the next question a reader has is whether their record went with it.
 *
 * **The refusal is not here.** `useSendMessage` rejects a write into an
 * archived thread on its own, so the rule holds even if this component is
 * stale, which is what AC-19 asks for. This is the visible half of a rule
 * enforced somewhere it cannot be bypassed.
 *
 * The field grows to four lines and then scrolls, so a long message is composed
 * in place rather than in a keyhole, and the send button is disabled on an
 * empty or whitespace-only body — the one disabled state that is right, because
 * there is a visible reason for it sitting immediately to its left.
 */
import { useState } from 'react';
import { Platform, TextInput, View } from 'react-native';
import { Icon, PressableScale, Text } from '@/components';
import { useTheme } from '@/theme/theme';
import { fontSize, lineHeight } from '@/theme/tokens';
import { useT } from '@/i18n/i18n';

export function Composer({
  onSend,
  sending,
}: {
  onSend: (body: string) => void;
  sending: boolean;
}) {
  const { c, space, radius, font } = useTheme();
  const t = useT();
  const [body, setBody] = useState('');

  const ready = body.trim().length > 0 && !sending;

  const send = () => {
    if (!ready) return;
    onSend(body.trim());
    setBody('');
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: space[2],
        flex: 1,
      }}
    >
      <TextInput
        accessibilityLabel={t('inbox.composerLabel')}
        value={body}
        onChangeText={setBody}
        placeholder={t('inbox.composerPlaceholder')}
        placeholderTextColor={c.textSubtle}
        multiline
        // Return inserts a newline rather than dismissing the keyboard. A
        // message is often two lines, and a composer that closes the keyboard
        // on Return costs a tap for every one of them. Send is the button.
        blurOnSubmit={false}
        style={{
          flex: 1,
          minHeight: 44,
          maxHeight: 112,
          paddingTop: Platform.OS === 'ios' ? 12 : 8,
          paddingBottom: Platform.OS === 'ios' ? 12 : 8,
          paddingHorizontal: 14,
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: c.borderDefault,
          backgroundColor: c.surface2,
          color: c.textBody,
          fontFamily: font.body,
          fontSize: fontSize.md,
          lineHeight: lineHeight.md,
        }}
      />

      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t('inbox.sendLabel')}
        accessibilityState={{ disabled: !ready }}
        disabled={!ready}
        haptic
        onPress={send}
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: ready ? c.action : c.neutral200,
        }}
      >
        {/* **Session 11's dark audit fixed this.** The glyph was `textOnBrand`
            on `action`, which is near-ink on near-ink in the light scheme —
            **1.00:1**, the worst pair in the app, and the send control was
            simply invisible on a light phone. `button.tsx`'s own header warns
            about this exact substitution. `bgApp` on `action` is 16.21:1. */}
        <Icon name="send" size={19} color={ready ? c.bgApp : c.textSubtle} />
      </PressableScale>
    </View>
  );
}

/**
 * What sits where the composer was, once the thread is archived.
 *
 * `reason` is the ADR's own sentence, picked by the thread's scope: a stay ends
 * for a guest, a lease ends for a tenant, and telling a tenant their stay ended
 * would be the sort of copy that makes a reader distrust everything else on the
 * screen.
 */
export function ClosedNote({ reason }: { reason: string }) {
  const { c, space } = useTheme();
  const t = useT();

  return (
    <View
      accessible
      accessibilityRole="summary"
      accessibilityLabel={`${reason} ${t('inbox.archivedKept')}`}
      style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[3], flex: 1 }}
    >
      <Icon name="lock" size={17} color={c.textMuted} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text size="sm" color="textBody" style={{ lineHeight: 19 }}>
          {reason}
        </Text>
        <Text size="xs" color="textSubtle" style={{ lineHeight: 17 }}>
          {t('inbox.archivedKept')}
        </Text>
      </View>
    </View>
  );
}
