/**
 * One conversation — `app/thread/[threadId]`.
 *
 * ADR-032's shape: a header carrying the counterparty, an **inverted** list of
 * bubbles sided by `fromUs`, and a composer pinned to the bottom.
 *
 * ## Inverted, and why that is not a styling choice
 *
 * The ADR pages backwards from the newest message on a cursor, because that is
 * what a chat wants and what `useInfiniteQuery` is shaped for. An inverted
 * `FlatList` is the half of that decision the client owes: the newest message
 * is at the bottom and is what the screen opens on, without measuring anything
 * or scrolling after mount. Rendering it upright and calling `scrollToEnd` is
 * the version that flickers on a cold read and fights the keyboard on every
 * open.
 *
 * Inverting means the DATA is reversed and the SEPARATORS invert with it: a day
 * separator belongs above the first message of its day, which in an inverted
 * list means it is drawn after that message in source order. That is the one
 * confusing thing in this file and it is why the row model is built explicitly
 * rather than computed inside `renderItem`.
 *
 * ## Marking read
 *
 * Fired once when the screen mounts, which is the ADR's own rule. It clears the
 * row's dot and the tab badge together, because both read the same store — AC-16
 * is "without a manual refresh", and the two counts having one source is what
 * makes that true rather than a race.
 *
 * ## Archived
 *
 * The composer is replaced, not disabled, and the send is refused in
 * `useSendMessage` as well, so the rule holds with a stale client (AC-19). The
 * archived toast exists for the case the screen is wrong and the store is
 * right, which in the prototype is the closest thing there is to a stale
 * client.
 */
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Icon,
  SkeletonList,
  StickyBar,
  Text,
  useToast,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useLocale, useT } from '@/i18n/i18n';
import {
  useMarkThreadRead,
  useSendMessage,
  useThread,
  type Message,
  type Thread as ThreadRecord,
} from '@/data/threads';
import { hasPhone } from '@/data/scrub';
import { DaySeparator, MessageBubble } from './message-bubble';
import { Composer, ClosedNote } from './composer';
import { dayText } from './time-text';
import { sameDay } from './relative-time';
import { useMinuteClock } from './minute-clock';

/** A drawn row: a bubble, or the day line that goes above one. */
type Row = { kind: 'message'; message: Message } | { kind: 'day'; at: number; key: string };

/**
 * The rows an inverted list draws, newest first.
 *
 * Walk the messages newest to oldest. After emitting a message, if the NEXT
 * older one falls on a different day (or there is none), emit that message's
 * day line — which, inverted, lands visually above it. Writing it this way
 * keeps the whole inversion in one function instead of spreading it across
 * `renderItem` and a separator component.
 */
export function invertedRows(messages: readonly Message[]): Row[] {
  const newestFirst = [...messages].sort((a, b) => b.createdAt - a.createdAt);
  const rows: Row[] = [];

  newestFirst.forEach((message, i) => {
    rows.push({ kind: 'message', message });
    const older = newestFirst[i + 1];
    if (!older || !sameDay(older.createdAt, message.createdAt)) {
      rows.push({ kind: 'day', at: message.createdAt, key: `day-${message.id}` });
    }
  });

  return rows;
}

export function Thread() {
  const { c, space } = useTheme();
  const router = useRouter();
  const t = useT();
  const { locale } = useLocale();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  const { status, thread, messages, error, retry } = useThread(threadId);
  const markRead = useMarkThreadRead();
  const { send, status: sendStatus, pending, retry: retrySend, discard } = useSendMessage();

  const archived = thread?.status === 'archived';
  // The Inbox's own minute clock, not `Date.now()` read once per render. A
  // thread left open past midnight kept calling yesterday's messages "Today"
  // until something else happened to re-render it (mobile audit 2026-10-05,
  // IN-13).
  const now = useMinuteClock();

  // Once per thread, on mount. `markRead` is stable, so the effect keys on the
  // id alone and does not re-fire when the list re-renders under it.
  const marked = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!threadId || status !== 'ready' || archived) return;
    if (marked.current === threadId) return;
    marked.current = threadId;
    markRead(threadId);
  }, [threadId, status, archived, markRead]);

  // Every pending message in THIS thread, each its own bubble. Two sent
  // offline are two bubbles now, not one (mobile audit IN-07).
  const rows = useMemo(
    () => invertedRows([...messages, ...pending.filter((m) => m.threadId === threadId)]),
    [messages, pending, threadId],
  );

  const goBack = useCallback(
    () => (router.canGoBack() ? router.back() : router.replace('/inbox')),
    [router],
  );

  const onSend = useCallback(
    (body: string) => {
      if (!threadId) return;
      void send(threadId, body).then((outcome) => {
        // Only a refusal of the thread itself is "closed" — the stale-client
        // case AC-19 is about. A send that failed stays on screen as its own
        // bubble, marked Not sent with Try again and Discard, and a queued one
        // says it is waiting for signal. Every failure used to be worded as a
        // closed conversation (mobile audit 2026-10-05, IN-12).
        if (outcome === 'closed') toast.show(t('inbox.archivedRefused'), 'warning');
      });
    },
    [send, t, threadId, toast],
  );

  /* ---- The three states before there is a conversation to draw ---------- */

  if (status === 'loading') {
    return (
      <ThreadFrame thread={thread} onBack={goBack}>
        <View style={{ paddingHorizontal: space[4], paddingTop: space[4] }}>
          <SkeletonList rows={4} label={t('state.loadingList', { label: t('inbox.threadLabel') })} />
        </View>
      </ThreadFrame>
    );
  }

  if (status === 'error' || !thread) {
    return (
      <ThreadFrame thread={thread} onBack={goBack}>
        <View style={{ paddingHorizontal: space[4], paddingTop: space[4] }}>
          {thread ? (
            <ErrorState
              title={t('state.errorTitle')}
              body={t('state.errorBody', { label: t('inbox.threadLabel') })}
              detail={error?.message}
              onRetry={retry}
            />
          ) : (
            // A thread that is not yours answers `404`, never `403`, so the
            // surface never confirms that an id exists (AC-14). The copy has to
            // match: it says the conversation is not yours without saying
            // whether it is anybody's.
            <EmptyState
              icon="messageCircle"
              title={t('inbox.notFoundTitle')}
              body={t('inbox.notFoundBody')}
              action={
                <Button variant="outline" size="md" onPress={() => router.replace('/inbox')}>
                  {t('inbox.notFoundAction')}
                </Button>
              }
            />
          )}
        </View>
      </ThreadFrame>
    );
  }

  /* ---- The conversation ------------------------------------------------- */

  const anyRedacted = messages.some((m) => hasPhone(m.body));

  return (
    <ThreadFrame thread={thread} onBack={goBack}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          data={rows}
          inverted
          // The day lines read the clock, so a tick has to reach the rows even
          // when the messages have not changed.
          extraData={now}
          keyExtractor={(row) => (row.kind === 'message' ? row.message.id : row.key)}
          renderItem={({ item }) =>
            item.kind === 'message' ? (
              <MessageBubble
                message={item.message}
                counterpartyName={thread.counterpartyName}
                // Offered on a failed message only. `benchmarks.md` §5's third
                // state: a message that will not send must be something the
                // person can act on, not a bubble with a permanent clock. Both
                // act on THIS message's id (IN-07).
                onRetry={
                  item.message.delivery === 'failed'
                    ? () => retrySend(item.message.id)
                    : undefined
                }
                onDiscard={
                  item.message.delivery === 'failed' ? () => discard(item.message.id) : undefined
                }
              />
            ) : (
              <DaySeparator label={dayText(item.at, now, t, locale)} />
            )
          }
          ItemSeparatorComponent={() => <View style={{ height: space[2] }} />}
          contentContainerStyle={{
            paddingHorizontal: space[4],
            // Inverted, so the two paddings swap: the visual TOP of the
            // conversation is the end of the list.
            paddingTop: space[4],
            paddingBottom: space[3],
            flexGrow: 1,
          }}
          // Inverted lists render bottom-up, so the empty slot needs flipping
          // back or the copy stands on its head.
          ListEmptyComponent={
            <View style={{ transform: [{ scaleY: -1 }], paddingTop: space[8] }}>
              <EmptyState
                icon="messageCircle"
                title={t('inbox.threadStartTitle')}
                body={t(
                  thread.scope === 'lease'
                    ? 'inbox.threadStartBodyLease'
                    : 'inbox.threadStartBody',
                )}
              />
            </View>
          }
          ListFooterComponent={
            // Footer of an inverted list is the visual TOP: the note belongs
            // above the oldest message, where it reads as context for the whole
            // conversation rather than as a reply to the last line.
            anyRedacted ? (
              <View
                style={{
                  transform: [{ scaleY: -1 }],
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: space[2],
                  padding: space[3],
                  marginBottom: space[3],
                  borderRadius: 10,
                  backgroundColor: c.surface2,
                }}
              >
                <Icon name="shield" size={15} color={c.textMuted} />
                <Text size="xs" color="textMuted" style={{ flex: 1, lineHeight: 17 }}>
                  {t('inbox.redactedNote')}
                </Text>
              </View>
            ) : null
          }
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        />

        <StickyBar>
          {archived ? (
            <ClosedNote
              reason={t(thread.scope === 'lease' ? 'inbox.archivedLease' : 'inbox.archivedStay')}
            />
          ) : (
            <Composer onSend={onSend} sending={sendStatus === 'saving'} />
          )}
        </StickyBar>
      </KeyboardAvoidingView>
    </ThreadFrame>
  );
}

/**
 * The page chrome, shared by all four states.
 *
 * **Module level, not nested in `Thread`.** A component declared inside a
 * render is a NEW type on every render, so React unmounts and remounts its
 * whole subtree each time — which here is a `FlatList` and a `TextInput`. The
 * list would lose its scroll position and the composer its focus every time the
 * send status changed. This is the one place in the session where the nested
 * form the other screens use would have been a real bug rather than a style
 * note.
 *
 * `BackHeader` is not reused: it is an absolute overlay meant to float on a
 * photo hero, and there is no photograph here — a conversation is text — so the
 * header is a real row in the layout with the counterparty in it.
 */
function ThreadFrame({
  thread,
  onBack,
  children,
}: {
  thread: ThreadRecord | undefined;
  onBack: () => void;
  children: ReactNode;
}) {
  const { c, space } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <View
        style={{
          paddingTop: insets.top + space[2],
          paddingBottom: space[3],
          paddingHorizontal: space[3],
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[3],
          backgroundColor: c.surface1,
          borderBottomWidth: 1,
          borderBottomColor: c.borderSubtle,
        }}
      >
        {/* A 44pt control, not `Button size="sm"`, which is drawn at 32 and
            would sit under the design brief's 7.2 floor. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('a11y.back')}
          onPress={onBack}
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            marginLeft: -6,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: pressed ? c.actionSubtle : 'transparent',
          })}
        >
          <Icon name="chevronLeft" size={22} color={c.textStrong} />
        </Pressable>

        {thread ? (
          <>
            <Avatar name={thread.counterpartyName} size="sm" square />
            <View style={{ flex: 1 }}>
              {/* The page's heading, so a screen reader can land on it and
                  hear whose conversation this is (mobile audit IN-14). */}
              <Text
                family="display"
                weight="semibold"
                size="md"
                color="textStrong"
                numberOfLines={1}
                accessibilityRole="header"
              >
                {thread.counterpartyName}
              </Text>
              <Text size="xs" color="textMuted" numberOfLines={1}>
                {thread.propertyName}
                {' · '}
                {t(
                  thread.scope === 'lease'
                    ? 'inbox.threadSubtitleLease'
                    : 'inbox.threadSubtitleBooking',
                )}
              </Text>
            </View>
            {thread.status === 'archived' ? (
              <Badge tone="neutral">{t('inbox.archivedTag')}</Badge>
            ) : null}
          </>
        ) : (
          <Text
            family="display"
            weight="semibold"
            size="md"
            color="textStrong"
            accessibilityRole="header"
          >
            {t('inbox.title')}
          </Text>
        )}
      </View>

      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}
