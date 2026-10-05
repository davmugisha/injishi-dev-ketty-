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
 * A new conversation opens with the API's greeting and the questions asked
 * most, each sent with one tap exactly as if typed; after every answer the API
 * offers the next questions. Both come from the API, which offers only what
 * this caller may ask (D-q). The layout mirrors the web widget
 * (`apps/web/src/components/assistant/assistant-widget.tsx`): the person's
 * words on the right in the action colour, the assistant's on the left in a
 * bordered card beside its avatar, and a round send button on the composer.
 *
 * It never acts. A change it prepares is a card the person approves or rejects
 * with their own press, and human support is a button the person presses.
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import type {
  AssistantConversation,
  AssistantMessage,
  AssistantProposal,
  AssistantSource,
  AssistantSuggestion,
  SupportTopic,
} from '@injishi/contracts';
import { ASSISTANT_MESSAGE_MAX } from '@injishi/contracts';

import {
  BackHeader,
  Button,
  Card,
  Icon,
  InputField,
  PressableScale,
  Screen,
  Text,
  formatMoney,
  type IconName,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { fontSize, lineHeight } from '@/theme/tokens';
import { MOTION_MS, useReducedMotion } from '@/motion';
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

/**
 * Words the redesign added, in English only for now. They mirror the web
 * widget's copy one for one. They belong in `i18n/messages/assistant.ts` (EN
 * and RW) and move there with the next change to that catalogue; this screen's
 * owner could not edit it in the same change.
 */
/** The card and chip words, from the `assistant` catalogue (EN and RW). */
function copyOf(t: Translate) {
  return {
    typing: t('assistant.typing'),
    suggested: t('assistant.suggested'),
    places: t('assistant.places'),
    fromPerNight: (price: string) => t('assistant.fromPerNight', { price }),
    priceOnRequest: t('assistant.priceOnRequest'),
    sleeps: (n: number) => t('assistant.sleeps', { count: String(n) }),
    roomTypes: (n: number) => (n === 1 ? t('assistant.roomType') : t('assistant.roomTypes', { count: String(n) })),
  };
}

/** The small avatar's diameter, and the indent everything under a bubble takes. */
const AVATAR_SMALL = 28;
const AVATAR_GAP = 8;
const INDENT = AVATAR_SMALL + AVATAR_GAP;

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
  const [greeting, setGreeting] = useState('');
  const [starters, setStarters] = useState<AssistantSuggestion[]>([]);
  const [claimable, setClaimable] = useState(false);
  const [draft, setDraft] = useState('');
  /** The message on its way, drawn as the person's bubble until the answer lands. */
  const [pending, setPending] = useState<string | null>(null);
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
      setGreeting(result.data.greeting);
      setStarters(result.data.suggestions);
      setClaimable(result.data.claimable);
    });
    return () => controller.abort();
    // Read once per sign in state; `t` changing language is not a reason to refetch.
  }, [signedIn]);

  /**
   * Send the draft, or a suggestion's message when `text` is given. A
   * suggestion is sent exactly as if typed and leaves the draft alone.
   */
  async function send(text?: string) {
    const message = (text ?? draft).trim();
    if (!message || pending !== null) return;
    setPending(message);
    setError(null);
    if (text === undefined) setDraft('');
    const result = await sendAssistantMessage({ message, ...(startFresh ? { startNew: true } : {}) });
    setPending(null);
    if (result.kind === 'ok') {
      setConversation(result.data.conversation);
      setStartFresh(false);
      return;
    }
    // Not sent: give the person their words back.
    if (text === undefined) setDraft(message);
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
  const lastIsAnswer = messages.at(-1)?.role === 'assistant';
  const followUps = lastIsAnswer && pending === null ? (conversation?.suggestions ?? []) : [];

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

            <View style={{ gap: space[4] }} accessibilityLiveRegion="polite">
              {messages.length === 0 ? (
                greeting ? (
                  <View style={{ gap: space[3] }}>
                    <AssistantBubble text={greeting} />
                    <SuggestionChips
                      suggestions={starters}
                      disabled={pending !== null}
                      onPick={(m) => void send(m)}
                    />
                  </View>
                ) : pending === null ? (
                  <Text size="sm" color="textMuted">
                    {t('assistant.empty')}
                  </Text>
                ) : null
              ) : null}

              {messages.map((m) => (
                <MessageRow key={m.id} message={m} signedIn={signedIn} onDecided={replaceProposal} />
              ))}

              {pending !== null ? (
                <>
                  <UserBubble text={pending} />
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: AVATAR_GAP }}>
                    <AssistantAvatar />
                    <TypingDots />
                  </View>
                </>
              ) : null}

              {followUps.length > 0 ? (
                <View style={{ paddingLeft: INDENT }}>
                  <SuggestionChips suggestions={followUps} disabled={pending !== null} onPick={(m) => void send(m)} />
                </View>
              ) : null}
            </View>

            {error ? (
              <Text size="sm" color="danger500" accessibilityRole="alert">
                {error}
              </Text>
            ) : null}

            <Composer
              value={draft}
              onChangeText={setDraft}
              sending={pending !== null}
              onSend={() => void send()}
            />
            <Button
              variant="ghost"
              size="sm"
              leadingIcon="rotateCcw"
              disabled={messages.length === 0 || pending !== null}
              onPress={() => {
                setConversation(null);
                setStartFresh(true);
                setError(null);
              }}
            >
              {t('assistant.newConversation')}
            </Button>
          </>
        )}
      </Screen>
    </>
  );
}

/** A small round mark in the action colour, beside every assistant bubble. Decoration. */
function AssistantAvatar() {
  const { c } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: AVATAR_SMALL,
        height: AVATAR_SMALL,
        borderRadius: AVATAR_SMALL / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: c.action,
      }}
    >
      {/* `bgApp` on `action`, the pair `Button`'s primary fill uses. */}
      <Icon name="sparkles" size={14} color={c.bgApp} />
    </View>
  );
}

/** The assistant's words: a bordered card on the left, the corner by the avatar squared. */
function AssistantBubble({ text }: { text: string }) {
  const t = useT();
  const { c, radius } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: AVATAR_GAP }}>
      <AssistantAvatar />
      <View
        accessible
        accessibilityLabel={`${t('assistant.title')}: ${text}`}
        style={{
          flexShrink: 1,
          maxWidth: '88%',
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderRadius: radius.lg,
          borderBottomLeftRadius: radius.xs,
          borderWidth: 1,
          borderColor: c.borderSubtle,
          backgroundColor: c.surface1,
        }}
      >
        <Text size="sm" color="textStrong">
          {text}
        </Text>
      </View>
    </View>
  );
}

/** The person's words: the action colour on the right, the corner nearest them squared. */
function UserBubble({ text }: { text: string }) {
  const t = useT();
  const { c, radius } = useTheme();
  return (
    <View style={{ alignItems: 'flex-end' }}>
      <View
        accessible
        accessibilityLabel={`${t('assistant.you')}: ${text}`}
        style={{
          maxWidth: '85%',
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderRadius: radius.lg,
          borderBottomRightRadius: radius.xs,
          backgroundColor: c.action,
        }}
      >
        <Text size="sm" color="bgApp">
          {text}
        </Text>
      </View>
    </View>
  );
}

/**
 * Three dots while the answer is on its way. Under reduced motion they hold
 * still: the bubble and its label are the feedback, the pulse is decoration.
 */
function TypingDots() {
  const COPY = copyOf(useT());
  const { c, radius } = useTheme();
  const reduced = useReducedMotion();
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0.35))).current;

  useEffect(() => {
    if (reduced) {
      dots.forEach((d) => d.setValue(0.6));
      return;
    }
    const loop = Animated.loop(
      Animated.stagger(
        MOTION_MS / 2,
        dots.map((d) =>
          Animated.sequence([
            Animated.timing(d, { toValue: 1, duration: MOTION_MS, useNativeDriver: true }),
            Animated.timing(d, { toValue: 0.35, duration: MOTION_MS, useNativeDriver: true }),
          ]),
        ),
      ),
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, dots]);

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={COPY.typing}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: radius.lg,
        borderBottomLeftRadius: radius.xs,
        borderWidth: 1,
        borderColor: c.borderSubtle,
        backgroundColor: c.surface1,
      }}
    >
      {dots.map((opacity, i) => (
        <Animated.View
          key={i}
          style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.textMuted, opacity }}
        />
      ))}
    </View>
  );
}

/** Questions sent with one tap, exactly as if typed. The reader hears the whole question. */
function SuggestionChips({
  suggestions,
  disabled,
  onPick,
}: {
  suggestions: AssistantSuggestion[];
  disabled: boolean;
  onPick: (message: string) => void;
}) {
  const { c, space, radius } = useTheme();
  const COPY = copyOf(useT());
  if (suggestions.length === 0) return null;
  return (
    <View accessibilityLabel={COPY.suggested} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
      {suggestions.map((s) => (
        <PressableScale
          key={s.message}
          accessibilityRole="button"
          accessibilityLabel={s.message}
          accessibilityState={{ disabled }}
          disabled={disabled}
          hitSlop={6}
          onPress={() => onPick(s.message)}
          style={{
            minHeight: 32,
            paddingHorizontal: 14,
            paddingVertical: 6,
            justifyContent: 'center',
            borderRadius: radius.pill,
            borderWidth: 1,
            borderColor: c.borderDefault,
            backgroundColor: c.bgApp,
            opacity: disabled ? 0.5 : 1,
          }}
        >
          <Text size="xs" weight="medium" color="textStrong">
            {s.label}
          </Text>
        </PressableScale>
      ))}
    </View>
  );
}

function MessageRow({
  message,
  signedIn,
  onDecided,
}: {
  message: AssistantMessage;
  signedIn: boolean;
  onDecided: (next: AssistantProposal) => void;
}) {
  const t = useT();
  const COPY = copyOf(t);
  const { space } = useTheme();
  if (message.role === 'user') return <UserBubble text={message.text} />;
  const listings = message.sources.filter((s) => s.kind === 'listing' && s.listing);
  const others = message.sources.filter((s) => !(s.kind === 'listing' && s.listing));
  return (
    <View style={{ gap: space[2] }}>
      <AssistantBubble text={message.text} />
      <View style={{ paddingLeft: INDENT, gap: space[2] }}>
        {message.proposals.map((p) => (
          <ProposalCard key={p.id} proposal={p} onDecided={onDecided} />
        ))}
        {listings.length > 0 ? (
          <View accessibilityLabel={COPY.places} style={{ gap: space[2] }}>
            {listings.map((s) => (
              <ListingSourceCard key={s.id} source={s} />
            ))}
          </View>
        ) : null}
        {others.length > 0 ? (
          <View
            accessible
            accessibilityLabel={t('assistant.sources', { titles: others.map((s) => s.title).join(', ') })}
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}
          >
            {others.map((s) => (
              <SourcePill key={s.id} source={s} />
            ))}
          </View>
        ) : null}
        {message.escalation ? <EscalationBox topic={message.escalation.topic} signedIn={signedIn} /> : null}
        <FeedbackRow message={message} />
      </View>
    </View>
  );
}

/**
 * A published place, as the search returned it: the photo, where it is, the
 * lowest base nightly rate, how many it sleeps and how many room types. The
 * rate is the base rate; the property page shows the price for the dates.
 *
 * Not pressable. The API's `href` is a web path (`/property/<slug>`), and this
 * app's property page (`/listing/[id]`) still reads the fixture catalogue, so
 * no route here opens a real property by slug. When one exists, wrap this in a
 * `PressableScale` that pushes it.
 */
function ListingSourceCard({ source }: { source: AssistantSource }) {
  const { c, space, radius } = useTheme();
  const COPY = copyOf(useT());
  const l = source.listing;
  if (!l) return null;
  const price = l.fromNightlyRateRwf !== null ? COPY.fromPerNight(formatMoney(l.fromNightlyRateRwf)) : COPY.priceOnRequest;
  const facts = [l.maxGuests ? COPY.sleeps(l.maxGuests) : null, l.roomTypes > 0 ? COPY.roomTypes(l.roomTypes) : null].filter(
    (f): f is string => f !== null,
  );
  const spoken = [source.title, l.district, price, ...facts].filter(Boolean).join(', ');

  return (
    <View
      accessible
      accessibilityLabel={spoken}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        padding: 10,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: c.borderSubtle,
        backgroundColor: c.surface1,
      }}
    >
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: radius.md,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: c.surface2,
        }}
      >
        {l.photoUrl ? (
          <Image
            source={{ uri: l.photoUrl }}
            contentFit="cover"
            transition={180}
            style={{ width: '100%', height: '100%' }}
            // The card's label already names the place; the photo is decoration.
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        ) : (
          <Icon name="building" size={24} color={c.textMuted} />
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text size="sm" weight="semibold" color="textStrong" numberOfLines={1}>
          {source.title}
        </Text>
        {l.district ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name="mapPin" size={12} color={c.textMuted} />
            <Text size="xs" color="textMuted">
              {l.district}
            </Text>
          </View>
        ) : null}
        <Text size="sm" weight={l.fromNightlyRateRwf !== null ? 'semibold' : 'regular'} color={l.fromNightlyRateRwf !== null ? 'textStrong' : 'textMuted'}>
          {price}
        </Text>
        {facts.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space[3], rowGap: 2 }}>
            {l.maxGuests ? <Fact icon="users" text={COPY.sleeps(l.maxGuests)} /> : null}
            {l.roomTypes > 0 ? <Fact icon="bed" text={COPY.roomTypes(l.roomTypes)} /> : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function Fact({ icon, text }: { icon: IconName; text: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Icon name={icon} size={12} color={c.textMuted} />
      <Text size="2xs" color="textMuted">
        {text}
      </Text>
    </View>
  );
}

const SOURCE_ICON: Record<AssistantSource['kind'], IconName> = {
  article: 'fileText',
  tutorial: 'fileText',
  task: 'list',
  listing: 'building',
  record: 'fileText',
};

/**
 * Where an answer came from, as a small label. Not a link: the API's `href` is
 * a web path, and this app has no route that opens one.
 */
function SourcePill({ source }: { source: AssistantSource }) {
  const { c, radius } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: c.borderSubtle,
        backgroundColor: c.bgApp,
      }}
    >
      <Icon name={SOURCE_ICON[source.kind]} size={12} color={c.textMuted} />
      <Text size="xs" color="textMuted">
        {source.title}
      </Text>
    </View>
  );
}

/**
 * The composer: a rounded field that grows to a few lines, and a round send
 * button beside it, disabled on an empty draft or while a turn is in flight.
 * The shape is the inbox composer's (`screens/inbox/composer.tsx`).
 */
function Composer({
  value,
  onChangeText,
  sending,
  onSend,
}: {
  value: string;
  onChangeText: (value: string) => void;
  sending: boolean;
  onSend: () => void;
}) {
  const t = useT();
  const { c, space, radius, font } = useTheme();
  const ready = value.trim().length > 0 && !sending;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space[2] }}>
      <TextInput
        accessibilityLabel={t('assistant.label')}
        value={value}
        onChangeText={onChangeText}
        placeholder={t('assistant.placeholder')}
        placeholderTextColor={c.textSubtle}
        maxLength={ASSISTANT_MESSAGE_MAX}
        multiline
        // Return is a newline; the button is send.
        blurOnSubmit={false}
        testID="assistant-input"
        style={{
          flex: 1,
          minHeight: 44,
          maxHeight: 132,
          paddingTop: Platform.OS === 'ios' ? 12 : 8,
          paddingBottom: Platform.OS === 'ios' ? 12 : 8,
          paddingHorizontal: 16,
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: c.borderDefault,
          backgroundColor: c.surface1,
          color: c.textStrong,
          fontFamily: font.body,
          fontSize: fontSize.md,
          lineHeight: lineHeight.md,
        }}
      />
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={sending ? t('assistant.sending') : t('assistant.send')}
        accessibilityState={{ disabled: !ready }}
        disabled={!ready}
        haptic
        onPress={onSend}
        testID="assistant-send"
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: ready ? c.action : c.neutral200,
        }}
      >
        <Icon name="send" size={19} color={ready ? c.bgApp : c.textSubtle} />
      </PressableScale>
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
    <Card>
      <View style={{ gap: space[2] }}>
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
    </Card>
  );
}
