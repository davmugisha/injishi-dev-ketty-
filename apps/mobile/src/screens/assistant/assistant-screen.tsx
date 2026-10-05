/**
 * The support assistant (ADR-061 slice G) — the same assistant as the web
 * widget and the operator panel, on the phone.
 *
 * Signed in, it answers within what this account can see, and inside the
 * active workspace with that seat's grant, because `api.ts` sends the same
 * workspace header every other screen does. Signed out, it answers from
 * Injishi's knowledge and guides, and its conversation is named by a token kept
 * in the keychain (see `data/assistant.ts`).
 *
 * It never acts. A change it prepares is a card the person approves or rejects
 * with their own press, and human support is a button the person presses.
 */
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import type {
  AssistantConversation,
  AssistantMessage,
  AssistantProposal,
  SupportTopic,
} from '@injishi/contracts';
import { ASSISTANT_MESSAGE_MAX } from '@injishi/contracts';

import { BackHeader, Button, Card, InputField, Screen, Text, TextArea } from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import type { MessageKey } from '@/i18n/messages';
import { useSession } from '@/session';
import {
  claimAssistant,
  decideAssistantProposal,
  fetchAssistant,
  sendAssistantEscalation,
  sendAssistantFeedback,
  sendAssistantMessage,
  type AssistantOutcome,
} from '@/data/assistant';

type Translate = ReturnType<typeof useT>;

/** The words for an outcome that is not `ok`. The server's own sentence wins. */
function failureText<T>(outcome: Exclude<AssistantOutcome<T>, { kind: 'ok' }>, t: Translate): string {
  if (outcome.kind === 'refused') return outcome.message;
  if (outcome.kind === 'unauthenticated') return t('assistant.sessionEnded');
  return t('assistant.unreachable');
}

export function AssistantScreen() {
  const t = useT();
  const { space } = useTheme();
  const { status } = useSession();
  const signedIn = status === 'authenticated';
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [conversation, setConversation] = useState<AssistantConversation | null>(null);
  const [claimable, setClaimable] = useState(false);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startFresh, setStartFresh] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetchAssistant(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      if (result.kind !== 'ok') {
        setEnabled(true);
        setError(failureText(result, t));
        return;
      }
      setEnabled(result.data.enabled);
      setConversation(result.data.conversation);
      setClaimable(result.data.claimable);
    });
    return () => controller.abort();
    // Read once per sign in state; `t` changing language is not a reason to refetch.
  }, [signedIn]);

  async function send() {
    const message = draft.trim();
    if (!message || pending) return;
    setPending(true);
    setError(null);
    const result = await sendAssistantMessage({ message, ...(startFresh ? { startNew: true } : {}) });
    setPending(false);
    if (result.kind === 'ok') {
      setConversation(result.data.conversation);
      setDraft('');
      setStartFresh(false);
      return;
    }
    if (result.kind === 'refused' && result.code === 'conversation_full') {
      setStartFresh(true);
      setError(t('assistant.full'));
      return;
    }
    if (result.kind === 'refused' && result.code === 'assistant_off') {
      setEnabled(false);
      return;
    }
    setError(failureText(result, t));
  }

  async function claim(discard: boolean) {
    const result = await claimAssistant(discard);
    setClaimable(false);
    if (result.kind === 'ok' && result.data.conversation) setConversation(result.data.conversation);
    else if (result.kind !== 'ok') setError(failureText(result, t));
  }

  function replaceProposal(next: AssistantProposal) {
    setConversation((c) =>
      c && {
        ...c,
        messages: c.messages.map((m) => ({
          ...m,
          proposals: m.proposals.map((p) => (p.id === next.id ? next : p)),
        })),
      },
    );
  }

  const messages = conversation?.messages ?? [];

  return (
    <>
      <BackHeader />
      <Screen title={t('assistant.title')} backInset>
        {enabled === false ? (
          <Text size="sm" color="textMuted">
            {t('assistant.off')}
          </Text>
        ) : (
          <>
            <Text size="sm" color="textMuted">
              {signedIn ? t('assistant.intro') : t('assistant.introSignedOut')}
            </Text>

            {signedIn && claimable ? (
              <Card title={t('assistant.claimTitle')} subtitle={t('assistant.claimBody')}>
                <View style={{ flexDirection: 'row', gap: space[2] }}>
                  <Button variant="primary" size="sm" onPress={() => void claim(false)}>
                    {t('assistant.claimKeep')}
                  </Button>
                  <Button variant="ghost" size="sm" onPress={() => void claim(true)}>
                    {t('assistant.claimDiscard')}
                  </Button>
                </View>
              </Card>
            ) : null}

            {messages.length === 0 ? (
              <Text size="sm" color="textMuted">
                {t('assistant.empty')}
              </Text>
            ) : (
              <View style={{ gap: space[3] }} accessibilityLiveRegion="polite">
                {messages.map((m) => (
                  <MessageBubble key={m.id} message={m} signedIn={signedIn} onDecided={replaceProposal} />
                ))}
              </View>
            )}

            {pending ? (
              <Text size="sm" color="textMuted">
                {t('assistant.checking')}
              </Text>
            ) : null}

            {error ? (
              <Text size="sm" color="danger500" accessibilityRole="alert">
                {error}
              </Text>
            ) : null}

            <TextArea
              label={t('assistant.label')}
              value={draft}
              onChangeText={setDraft}
              placeholder={t('assistant.placeholder')}
              maxLength={ASSISTANT_MESSAGE_MAX}
              rows={3}
              testID="assistant-input"
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[2] }}>
              <Button
                variant="ghost"
                size="sm"
                disabled={messages.length === 0 || pending}
                onPress={() => {
                  setConversation(null);
                  setStartFresh(true);
                  setError(null);
                }}
              >
                {t('assistant.newConversation')}
              </Button>
              <Button variant="primary" size="sm" leadingIcon="send" disabled={!draft.trim() || pending} onPress={() => void send()}>
                {pending ? t('assistant.sending') : t('assistant.send')}
              </Button>
            </View>
          </>
        )}
      </Screen>
    </>
  );
}

function MessageBubble({
  message,
  signedIn,
  onDecided,
}: {
  message: AssistantMessage;
  signedIn: boolean;
  onDecided: (next: AssistantProposal) => void;
}) {
  const t = useT();
  const { c, space, radius } = useTheme();
  const mine = message.role === 'user';
  return (
    <View style={{ gap: space[2], alignItems: mine ? 'flex-end' : 'flex-start' }}>
      <View
        accessible
        accessibilityLabel={`${mine ? t('assistant.you') : t('assistant.title')}: ${message.text}`}
        style={{
          maxWidth: '92%',
          padding: space[3],
          borderRadius: radius.lg,
          borderWidth: mine ? 0 : 1,
          borderColor: c.borderSubtle,
          backgroundColor: mine ? c.surface2 : c.surface1,
        }}
      >
        <Text size="sm" color="textStrong">
          {message.text}
        </Text>
      </View>
      {message.proposals.map((p) => (
        <ProposalCard key={p.id} proposal={p} onDecided={onDecided} />
      ))}
      {!mine && message.escalation ? <EscalationBox topic={message.escalation.topic} signedIn={signedIn} /> : null}
      {!mine ? <FeedbackRow message={message} /> : null}
      {message.sources.length > 0 ? (
        <Text size="xs" color="textMuted">
          {t('assistant.sources', { titles: message.sources.map((s) => s.title).join(', ') })}
        </Text>
      ) : null}
    </View>
  );
}

const STATE_WORDS: Record<Exclude<AssistantProposal['state'], 'proposed'>, MessageKey> = {
  approved: 'assistant.stateApproved',
  executed: 'assistant.stateExecuted',
  failed: 'assistant.stateFailed',
  rejected: 'assistant.stateRejected',
  expired: 'assistant.stateExpired',
};

/**
 * One prepared change (D-k). Everything on it comes from the stored proposal
 * the API returned, so what is approved is exactly what runs. The key is
 * minted once per press.
 */
function ProposalCard({ proposal, onDecided }: { proposal: AssistantProposal; onDecided: (next: AssistantProposal) => void }) {
  const t = useT();
  const { space } = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: 'approve' | 'reject') {
    setBusy(true);
    setError(null);
    const key = `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
    const result = await decideAssistantProposal(proposal.id, decision, uuidFrom(key));
    setBusy(false);
    if (result.kind === 'ok') onDecided(result.data.proposal);
    else setError(failureText(result, t));
  }

  return (
    <Card title={proposal.title}>
      <View style={{ gap: space[2] }}>
        <Text size="sm" color="textMuted">
          {`${t('assistant.proposalCurrent')}: ${proposal.current}`}
        </Text>
        <Text size="sm" weight="bold" color="textStrong">
          {`${t('assistant.proposalNew')}: ${proposal.proposed}`}
        </Text>
        {proposal.state === 'proposed' ? (
          <View style={{ flexDirection: 'row', gap: space[2] }}>
            <Button variant="primary" size="sm" disabled={busy} onPress={() => void decide('approve')}>
              {t('assistant.approve')}
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} onPress={() => void decide('reject')}>
              {t('assistant.reject')}
            </Button>
          </View>
        ) : (
          <Text size="xs" color="textMuted">
            {t(STATE_WORDS[proposal.state])}
          </Text>
        )}
        {error || proposal.error ? (
          <Text size="xs" color="danger500" accessibilityRole="alert">
            {error ?? proposal.error ?? ''}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

/**
 * A v4 shaped UUID for the `Idempotency-Key`, from `crypto.randomUUID` where
 * the runtime has it. Hermes does not always, so the fallback fills the same
 * shape from `Math.random`: the key has to be unique per press, not secret.
 */
function uuidFrom(seed: string): string {
  const native = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID;
  if (native) return native();
  const hex = (seed + Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2))
    .replace(/[^0-9a-f]/g, '')
    .padEnd(32, '0')
    .slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** Helpful or not, once per answer (D-m). */
function FeedbackRow({ message }: { message: AssistantMessage }) {
  const t = useT();
  const { space } = useTheme();
  const [helpful, setHelpful] = useState<boolean | null>(message.helpful);
  const [sending, setSending] = useState(false);
  if (helpful !== null) {
    return (
      <Text size="xs" color="textMuted">
        {t('assistant.thanks')}
      </Text>
    );
  }
  async function send(value: boolean) {
    setSending(true);
    const result = await sendAssistantFeedback(message.id, value);
    setSending(false);
    if (result.kind === 'ok') setHelpful(result.data.helpful);
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
      <Text size="xs" color="textMuted">
        {t('assistant.helpful')}
      </Text>
      <Button variant="ghost" size="sm" disabled={sending} onPress={() => void send(true)}>
        {t('assistant.yes')}
      </Button>
      <Button variant="ghost" size="sm" disabled={sending} onPress={() => void send(false)}>
        {t('assistant.no')}
      </Button>
    </View>
  );
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Send the conversation to Injishi support (D-l). The assistant only offered;
 * the person presses. Signed out, they type the address the reply goes to,
 * because the model never sees or supplies one.
 */
function EscalationBox({ topic, signedIn }: { topic: SupportTopic; signedIn: boolean }) {
  const t = useT();
  const { space } = useTheme();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);
  if (state === 'sent') {
    return (
      <Text size="sm" color="textStrong">
        {t('assistant.escalated')}
      </Text>
    );
  }
  async function send() {
    if (!signedIn && !EMAIL.test(email.trim())) {
      setError(t('assistant.escalateEmailInvalid'));
      return;
    }
    setState('sending');
    setError(null);
    const result = await sendAssistantEscalation(topic, signedIn ? undefined : email.trim());
    if (result.kind === 'ok') setState('sent');
    else {
      setState('idle');
      setError(failureText(result, t));
    }
  }
  return (
    <View style={{ gap: space[2], alignSelf: 'stretch' }}>
      {!signedIn ? (
        <InputField
          label={t('assistant.escalateEmail')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          error={error ?? undefined}
        />
      ) : null}
      <Button variant="primary" size="sm" disabled={state === 'sending'} onPress={() => void send()}>
        {t('assistant.escalate')}
      </Button>
      {signedIn && error ? (
        <Text size="xs" color="danger500" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
