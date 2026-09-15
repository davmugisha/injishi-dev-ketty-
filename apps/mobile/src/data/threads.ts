/**
 * Threads and messages — the fixture behind `/me/threads` (ADR-032 child
 * "the guest messaging surface").
 *
 * **Shaped as the endpoint, deliberately.** Every field below is one the ADR's
 * table says the route returns: `unreadCount` and `propertyName` on the list,
 * `fromUs` and a verbatim `body` on a message, `status` carrying the archive.
 * Decision D9 asks a fixture to be typed to its contract where one exists and
 * shaped like the owning ADR where none does; `@injishi/contracts` has no
 * `Thread` yet — the umbrella's step 1 renames `OperatorThread` into one — so
 * this is the second case, and the swap is a hook change rather than a rewrite
 * of the two screens.
 *
 * ## Where a thread comes from
 *
 * Not written down anywhere. A thread has exactly one subject, guaranteed on
 * the server by `threads_scope_exactly_one`, and the fixtures honour that by
 * DERIVING every thread from its subject:
 *
 *   - a guest thread hangs off a booking in `./trips`, one per booking, created
 *     with it, at any status including `pending_approval`;
 *   - a tenant thread hangs off a lease in `./rentals`, one per tenancy.
 *
 * So there is no thread whose counterparty disagrees with the trip screen, and
 * no booking that reaches the host row and finds nothing behind it. `TRIPS`
 * already computes `host.threadId` as `TH-<booking>`; that is the id used here
 * rather than a second scheme.
 *
 * ## Archived is derived too
 *
 * `active -> archived` on a terminal booking (`completed`, `cancelled`,
 * `declined`, `no_show`) or a lease reaching `ended`, per the ADR's state
 * table. It is computed from the subject rather than stored, because a stored
 * copy is a second answer to a question the booking already answers, and the
 * day a booking is cancelled the copy is wrong.
 *
 * ## Unread
 *
 * `thread_reads` is `(thread_id, user_id, last_read_at)` and **no row means
 * everything is unread**, which is the correct reading for a thread you have
 * never opened. The store here keeps the same shape minus the user column,
 * since the prototype has one signed-in person: a map of thread id to the
 * instant it was last opened, absent until it is. The count is computed at read
 * time and never stored — a stored counter has to be correct on every write
 * path and goes stale the first time one is missed.
 */
import { useCallback, useMemo, useState } from 'react';
import { useFixture, type FixtureResult } from './use-fixture';
import {
  readFixture,
  useFixtureMutation,
  useFixtureValue,
  writeFixture,
  type MutationStatus,
} from './use-fixture-mutation';
import { useOfflineSubmit } from './offline-submit';
import { cancel as cancelWrite, type WriteOutcome } from './write-queue';
import { TRIPS, type Trip } from './trips';
import { TENANCIES, type Surface, type Tenancy } from './rentals';

/* ------------------------------------------------------------- the shape --- */

/** Which of the three subject columns is set. `guest_stay` has no fixture. */
export type ThreadScope = 'booking' | 'lease';

export type ThreadStatus = 'active' | 'archived';

/** The two tab sets that carry an Inbox and a person behind it. */
export type InboxSurface = Extract<Surface, 'guest' | 'tenant'>;

/** A row of `GET /api/v1/me/threads`. */
export interface Thread {
  id: string;
  scope: ThreadScope;
  /** The booking id or the tenancy id. What ownership is proved from. */
  subjectId: string;
  /** The ADR's `propertyName`: the place, not the person. */
  propertyName: string;
  /** Who the reader is talking TO. The property's desk, or the landlord. */
  counterpartyName: string;
  counterpartyInitials: string;
  /** Which tab set this thread belongs to. Guest sees one set, Tenant another. */
  surface: InboxSurface;
  status: ThreadStatus;
  /** One line under the name. Verbatim: the screen redacts on the way out. */
  lastMessageBody: string;
  lastMessageAt: number;
  lastMessageFromUs: boolean;
  unreadCount: number;
}

/** A row of `GET /api/v1/me/threads/:id/messages`. */
export interface Message {
  id: string;
  threadId: string;
  /**
   * **Exactly what the sender typed.** Never scrubbed here; `./scrub.ts` runs
   * on the way to the screen. See that file for why the order matters.
   */
  body: string;
  /** `sender_user_id` compared to the caller, as `presentMessage()` does. */
  fromUs: boolean;
  createdAt: number;
  /**
   * Set on a message this device has written and the store has not settled.
   * The bubble draws it dimmed with a clock; a real `useMutation` writes the
   * same flag in `onMutate`.
   */
  pending?: boolean;
  /**
   * Where the message actually is (gaps.md B4).
   *
   * `pending` was one boolean doing two jobs, and the second one it could not
   * do: a send that FAILED looked identical to a send in flight, so a message
   * lost on a bad connection sat there with a clock beside it forever.
   * `benchmarks.md` §5 is explicit that this is *"the worst outcome in the
   * app"* and asks for the three states by name — queued, sent, then
   * failed-with-retry.
   *
   * `queued` is not a failure: it is a message waiting for signal, and the
   * offline queue will send it. `failed` is the one that needs a person.
   */
  delivery?: 'sending' | 'queued' | 'failed';
}

/* ------------------------------------------------------------- the seeds --- */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * A message, written against a clock rather than a calendar.
 *
 * `agoMs` keeps a fixture honest across every day someone opens the prototype:
 * a hardcoded `2026-07-14T09:12` is "2h ago" for one afternoon and "four months
 * ago" after that, and the day separators the thread screen draws would
 * collapse into one. `./trips` makes the same call with `offsetDays`.
 */
interface MessageSeed {
  agoMs: number;
  fromUs: boolean;
  body: string;
}

interface ThreadSeed {
  /** How many of the trailing messages have not been read. */
  unread: number;
  messages: MessageSeed[];
}

/**
 * Guest threads, keyed by booking id. Every booking in `./trips` appears, in
 * its order there, because the ADR creates a thread with the booking and a tab
 * that silently skips one is a tab that lies about what you can ask about.
 */
const GUEST_SEEDS: Record<string, ThreadSeed> = {
  // The hero trip: arriving today, and the only conversation with something
  // waiting in it. Two unread, so the row's dot and the tab badge have a
  // reason to exist on first launch.
  'BK-4821': {
    unread: 2,
    messages: [
      {
        agoMs: 2 * DAY + 5 * HOUR,
        fromUs: true,
        body: 'Hello — we arrive Friday afternoon. Is a late check-in after 20:00 all right?',
      },
      {
        agoMs: 2 * DAY + 3 * HOUR,
        fromUs: false,
        body: 'Muraho! Yes, reception is staffed overnight, so any arrival time is fine.',
      },
      {
        agoMs: 2 * DAY + 2 * HOUR,
        fromUs: true,
        body: 'Perfect, thank you. One more thing — is there parking inside the gate?',
      },
      {
        agoMs: 26 * HOUR,
        fromUs: false,
        body: 'There is, behind block B, and the path to the suites is lit. Ask the guard for the lakeside gate.',
      },
      {
        agoMs: 3 * HOUR,
        fromUs: false,
        body: 'Your suite is ready early if you would like it. The keypad code is in your arrival guide.',
      },
      {
        agoMs: 2 * HOUR + 10 * MINUTE,
        fromUs: false,
        body: 'The boat to Napoleon Island leaves at 09:00 — we can hold two seats for you.',
      },
    ],
  },
  'BK-4703': {
    unread: 0,
    messages: [
      {
        agoMs: 4 * DAY,
        fromUs: true,
        body: 'Is the game drive on the morning of arrival, or the day after?',
      },
      {
        agoMs: 4 * DAY - 40 * MINUTE,
        fromUs: false,
        body: 'The morning after, at 05:30. The gate briefing on arrival day is short, and there is tea afterwards.',
      },
      { agoMs: 3 * DAY, fromUs: true, body: 'Understood, thank you.' },
    ],
  },
  'BK-4790': {
    unread: 1,
    messages: [
      {
        agoMs: 9 * HOUR,
        fromUs: true,
        body: 'Does the apartment have a desk? I will be working two of the three days.',
      },
      {
        agoMs: 7 * HOUR,
        fromUs: false,
        body: 'It does, by the window, and the fibre is 100 Mbps. There is a co-working floor in tower A as well.',
      },
    ],
  },
  // Still with the host. F-B06 keeps the booking waiting; the ADR deliberately
  // opens the thread anyway, because a question is most urgent in this window.
  'BK-4655': {
    unread: 0,
    messages: [
      {
        agoMs: 20 * HOUR,
        fromUs: true,
        body: 'We are four, with one child. Is the second cabin bedroom made up for two?',
      },
      {
        agoMs: 18 * HOUR,
        fromUs: false,
        body: 'It is, and there is a cot if you would rather. We will answer the request this evening.',
      },
    ],
  },
  // Completed, so archived, read only, permanently. There is no path back.
  'BK-4402': {
    unread: 0,
    messages: [
      {
        agoMs: 13 * DAY,
        fromUs: true,
        body: 'The canopy walk was extraordinary. Thank you for arranging the early slot.',
      },
      {
        agoMs: 12 * DAY,
        fromUs: false,
        body: 'We are glad. Safe travels, and do come back in the dry season.',
      },
    ],
  },
  'BK-4310': {
    unread: 0,
    messages: [
      { agoMs: 141 * DAY, fromUs: false, body: 'Your room is on the beach side, as you asked.' },
      { agoMs: 139 * DAY, fromUs: true, body: 'Thank you — it was exactly right.' },
    ],
  },
  'BK-4266': {
    unread: 0,
    messages: [
      {
        agoMs: 162 * DAY,
        fromUs: true,
        body: 'I am afraid I have to cancel — my flight was moved.',
      },
      {
        agoMs: 162 * DAY - 2 * HOUR,
        fromUs: false,
        body: 'Understood, and no charge. The refund is with your payment provider.',
      },
    ],
  },
};

/**
 * Tenant threads, keyed by tenancy id.
 *
 * The Ingoro conversation is frame R13's own row, down to the preview line
 * ("The electrician is booked for Friday morn…"), and it carries the phone
 * number that proves the redaction: the body is stored exactly as the landlord
 * typed it, and `./scrub.ts` hides it on the way to the bubble.
 */
const TENANT_SEEDS: Record<string, ThreadSeed> = {
  'ingoro-apartments-a2': {
    unread: 1,
    messages: [
      {
        agoMs: 3 * DAY,
        fromUs: true,
        body: 'The socket by the kitchen window has stopped working. I have logged a ticket.',
      },
      {
        agoMs: 3 * DAY - 90 * MINUTE,
        fromUs: false,
        body: 'Thank you for logging it. I will get an electrician out this week.',
      },
      {
        agoMs: 28 * HOUR,
        fromUs: false,
        // Verbatim, phone number and all. This is the AC-18 fixture: stored as
        // typed, redacted on every read path.
        body: 'He may call ahead — his number is +250 788 512 004 if you need to reach him.',
      },
      {
        agoMs: 2 * HOUR,
        fromUs: false,
        body: 'The electrician is booked for Friday morning, between 08:00 and 10:00. Will someone be in?',
      },
    ],
  },
  'nyamirambo-flat-1': {
    unread: 0,
    messages: [
      {
        agoMs: 6 * DAY,
        fromUs: true,
        body: 'July rent is sent — the reference is on the receipt.',
      },
      {
        agoMs: 6 * DAY - 3 * HOUR,
        fromUs: false,
        body: 'Received, thank you. The receipt is in your documents.',
      },
    ],
  },
  'kimironko-flat-3': {
    unread: 0,
    messages: [
      {
        agoMs: 2 * DAY,
        fromUs: false,
        body: 'The lease is ready for your signature. Read clause 5 on notice before you sign.',
      },
    ],
  },
  // Both leases have ended, so both threads are archived.
  'gikondo-garden-flat': {
    unread: 0,
    messages: [
      {
        agoMs: 200 * DAY,
        fromUs: true,
        body: 'The final inspection is done and the keys are with the caretaker.',
      },
      { agoMs: 199 * DAY, fromUs: false, body: 'Confirmed. Your caution is refunded in full.' },
    ],
  },
  'kivu-breeze-studios-4': {
    unread: 0,
    messages: [
      {
        agoMs: 420 * DAY,
        fromUs: false,
        body: 'Thank you for the two years. The studio is yours again any time.',
      },
    ],
  },
};

/* -------------------------------------------------------- the derivation --- */

/** A booking whose thread is read only, per the ADR's state table. */
const TERMINAL_BOOKING_STATES = new Set(['completed', 'cancelled', 'declined', 'no_show']);

const THREAD_PREFIX = 'TH-';

/** The id `./trips` already computes for `host.threadId`. One scheme, not two. */
export function guestThreadId(bookingId: string): string {
  return `${THREAD_PREFIX}${bookingId.replace('BK-', '')}`;
}

/** The tenant equivalent, off the lease reference a tenant reads down a phone. */
export function tenantThreadId(tenancy: Tenancy): string {
  return `${THREAD_PREFIX}${tenancy.ref.replace('L-', 'L')}`;
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

function messagesFor(threadId: string, seed: ThreadSeed, now: number): Message[] {
  return seed.messages
    .map((m, i) => ({
      id: `${threadId}-m${i + 1}`,
      threadId,
      body: m.body,
      fromUs: m.fromUs,
      createdAt: now - m.agoMs,
    }))
    .sort((a, b) => a.createdAt - b.createdAt);
}

interface Built {
  thread: Thread;
  messages: Message[];
  /**
   * The seeded read mark: the instant just before the first unread message, or
   * `undefined` for a thread with nothing unread, which reads as "opened, all
   * caught up". A thread with no mark at all is every-message-unread, the
   * no-row case the ADR describes.
   */
  seededReadAt: number | undefined;
}

interface BuildArgs {
  id: string;
  scope: ThreadScope;
  subjectId: string;
  propertyName: string;
  counterpartyName: string;
  surface: InboxSurface;
  status: ThreadStatus;
  seed: ThreadSeed;
  now: number;
}

function build({
  id,
  scope,
  subjectId,
  propertyName,
  counterpartyName,
  surface,
  status,
  seed,
  now,
}: BuildArgs): Built {
  const messages = messagesFor(id, seed, now);
  const last = messages[messages.length - 1];
  // An archived thread cannot be unread: it is read only, and there is nothing
  // to go and do about it. The guard lives here rather than in each seed, where
  // the archive is decided.
  const unread = status === 'archived' ? 0 : Math.min(seed.unread, messages.length);
  const firstUnread = unread > 0 ? messages[messages.length - unread] : undefined;

  return {
    thread: {
      id,
      scope,
      subjectId,
      propertyName,
      counterpartyName,
      counterpartyInitials: initialsOf(counterpartyName),
      surface,
      status,
      lastMessageBody: last?.body ?? '',
      lastMessageAt: last?.createdAt ?? now,
      lastMessageFromUs: last?.fromUs ?? false,
      unreadCount: unread,
    },
    messages,
    seededReadAt: firstUnread ? firstUnread.createdAt - 1 : undefined,
  };
}

function buildGuest(trip: Trip, now: number): Built | undefined {
  const seed = GUEST_SEEDS[trip.id];
  if (!seed) return undefined;
  return build({
    id: guestThreadId(trip.id),
    scope: 'booking',
    subjectId: trip.id,
    propertyName: trip.property,
    counterpartyName: trip.host.name,
    surface: 'guest',
    status: TERMINAL_BOOKING_STATES.has(trip.state) ? 'archived' : 'active',
    seed,
    now,
  });
}

function buildTenant(tenancy: Tenancy, now: number): Built | undefined {
  const seed = TENANT_SEEDS[tenancy.id];
  if (!seed) return undefined;
  return build({
    id: tenantThreadId(tenancy),
    scope: 'lease',
    subjectId: tenancy.id,
    propertyName: tenancy.landlordOrg,
    counterpartyName: tenancy.landlord,
    surface: 'tenant',
    status: tenancy.leaseState === 'ended' ? 'archived' : 'active',
    seed,
    now,
  });
}

/**
 * Every thread and every message, built once against ONE clock.
 *
 * One `now` for the whole set rather than `Date.now()` per seed: two seeds read
 * a millisecond apart can put two messages of the same conversation on either
 * side of a day boundary, and the thread screen would draw a day separator
 * between them for no reason a reader could see.
 */
export function buildAll(now: number = Date.now()): Built[] {
  return [
    ...TRIPS.map((trip) => buildGuest(trip, now)),
    ...TENANCIES.map((tenancy) => buildTenant(tenancy, now)),
  ].filter((b): b is Built => b !== undefined);
}

/* ------------------------------------------------------------- the store --- */

export const THREADS_KEY = 'inbox.sent';
export const READS_KEY = 'inbox.reads';

/** `thread_reads` minus the user column: thread id to `last_read_at`. */
export type ThreadReads = Record<string, number>;

/** Sent messages, appended per thread. Absent until this device writes one. */
export type SentMessages = Record<string, Message[]>;

const BUILT = buildAll();

/** Every seeded thread, newest activity first. The ADR's list ordering. */
export const THREADS: Thread[] = BUILT.map((b) => b.thread).sort(
  (a, b) => b.lastMessageAt - a.lastMessageAt,
);

const SEEDED_MESSAGES: Record<string, Message[]> = Object.fromEntries(
  BUILT.map((b) => [b.thread.id, b.messages]),
);

/** The read marks a fresh install starts with. See `Built.seededReadAt`. */
export const SEEDED_READS: ThreadReads = Object.fromEntries(
  BUILT.flatMap((b) => (b.seededReadAt === undefined ? [] : [[b.thread.id, b.seededReadAt]])),
);

export function getThread(id: string | undefined): Thread | undefined {
  return id ? THREADS.find((t) => t.id === id) : undefined;
}

/** A thread's seeded messages plus anything this device has sent. */
export function messagesOf(threadId: string, sent: SentMessages): Message[] {
  const seeded = SEEDED_MESSAGES[threadId] ?? [];
  return [...seeded, ...(sent[threadId] ?? [])].sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * Unread count for one thread, computed the way the server computes it:
 * messages newer than this person's `last_read_at`, and every message when
 * there is no mark. Our own messages never count — you have read what you
 * wrote, and a badge that lights up when you send is a badge nobody trusts.
 */
export function unreadIn(thread: Thread, messages: Message[], reads: ThreadReads): number {
  if (thread.status === 'archived') return 0;
  const mark = reads[thread.id];
  return messages.filter(
    (m) => !m.fromUs && !m.pending && (mark === undefined || m.createdAt > mark),
  ).length;
}

/* -------------------------------------------------------------- the hooks -- */

/** The list read, with the sent messages and the read marks folded in. */
function withLiveState(
  threads: readonly Thread[],
  sent: SentMessages,
  reads: ThreadReads,
): Thread[] {
  return threads
    .map((thread) => {
      const messages = messagesOf(thread.id, sent);
      const last = messages[messages.length - 1];
      return {
        ...thread,
        lastMessageBody: last?.body ?? thread.lastMessageBody,
        lastMessageAt: last?.createdAt ?? thread.lastMessageAt,
        lastMessageFromUs: last?.fromUs ?? thread.lastMessageFromUs,
        unreadCount: unreadIn(thread, messages, reads),
      };
    })
    .sort((a, b) => b.lastMessageAt - a.lastMessageAt);
}

/**
 * The thread list for one surface, with live unread counts.
 *
 * `useFixture` supplies the `{ status, data, error, retry }` the screen waits
 * on, so the loading and error branches are real code and not a comment; the
 * read marks and the sent messages come from the mutation store on top, which
 * is why sending or opening a thread updates this list without a refetch.
 */
export function useThreads(surface: InboxSurface | undefined): FixtureResult<Thread[]> {
  const reads = useFixtureValue<ThreadReads>(READS_KEY, () => SEEDED_READS);
  const sent = useFixtureValue<SentMessages>(THREADS_KEY, () => ({}));
  // `undefined` is a surface with an Inbox tab and no fixtures behind it —
  // Host today. It reads an empty list rather than falling back to another
  // surface's threads, which would show a host somebody else's conversations.
  const base = useFixture<Thread[]>(`inbox.threads.${surface ?? 'none'}`, () =>
    surface ? THREADS.filter((t) => t.surface === surface) : [],
  );

  const data = useMemo(
    () => (base.data ? withLiveState(base.data, sent, reads) : undefined),
    [base.data, reads, sent],
  );

  return { status: base.status, error: base.error, retry: base.retry, data };
}

/** One conversation: the thread, its messages, and the read it waits on. */
export function useThread(threadId: string | undefined): {
  status: FixtureResult<Message[]>['status'];
  thread: Thread | undefined;
  messages: Message[];
  error: Error | undefined;
  retry: () => void;
} {
  const sent = useFixtureValue<SentMessages>(THREADS_KEY, () => ({}));
  const read = useFixture<Message[]>(`inbox.thread.${threadId ?? 'none'}`, () => {
    if (!threadId) return [];
    if (!getThread(threadId)) throw new Error(`no thread ${threadId}`);
    return SEEDED_MESSAGES[threadId] ?? [];
  });

  const messages = useMemo(
    () => (threadId && read.status === 'ready' ? messagesOf(threadId, sent) : []),
    [threadId, read.status, sent],
  );

  return {
    status: read.status,
    thread: getThread(threadId),
    messages,
    error: read.error,
    retry: read.retry,
  };
}

interface SendInput {
  threadId: string;
  body: string;
  /** Minted before the write so the optimistic bubble and the stored row match. */
  id: string;
  createdAt: number;
}

function appendMessage(current: SentMessages, input: SendInput): SentMessages {
  const next: Message = {
    id: input.id,
    threadId: input.threadId,
    body: input.body,
    fromUs: true,
    createdAt: input.createdAt,
  };
  return { ...current, [input.threadId]: [...(current[input.threadId] ?? []), next] };
}

/**
 * The `message` write. Module level so `write-handlers.ts` can register it
 * before any screen mounts, which is what a drain after a cold start needs.
 *
 * A missing or archived thread THROWS, which the queue treats as retryable
 * rather than refused: it is a fixture inconsistency, not an answer.
 */
export function sendMessageHandler(input: SendInput): WriteOutcome {
  const thread = getThread(input.threadId);
  if (!thread) throw new Error(`no thread ${input.threadId}`);
  if (thread.status === 'archived') throw new Error('thread archived');
  writeFixture<SentMessages>(THREADS_KEY, appendMessage(readFixture<SentMessages>(THREADS_KEY, {}), input));
  // The fixture store cannot refuse and cannot be unreachable, so this
  // is always `ok`. The surface child that puts a real mutation here
  // (ADR-038 children 1 to 7) is where `refused` and `failed` start
  // being answered for real.
  return { status: 'ok' };
}

export interface SendMessage {
  /** Resolves when the store holds the message. Rejects on an archived thread. */
  send: (threadId: string, body: string) => Promise<void>;
  status: MutationStatus;
  error: Error | undefined;
  /** The bubble to draw while the write is in flight, or `undefined`. */
  pending: Message | undefined;
  /** Send it again. The same client id, so a retry cannot duplicate it. */
  retry: () => void;
  /** Abandon a message that will not send. */
  discard: () => void;
}

/**
 * Send, optimistically.
 *
 * The ADR asks for a bubble that appears immediately in a pending state and
 * settles on the server's answer. `useFixtureMutation` waits 300ms before it
 * writes, so this holds the message locally for that window and drops it once
 * the store agrees — which is exactly what `onMutate` and `onSettled` will do
 * when it becomes `useMutation`. `./saved.ts` uses the same two-step for the
 * same reason.
 *
 * **An archived thread is refused HERE, not only hidden by the screen.** The
 * ADR is explicit that the rule has to hold with a stale client, and in the
 * prototype this module is the only server there is. AC-19.
 */
export function useSendMessage(): SendMessage {
  const { mutate, status, error } = useFixtureMutation<SentMessages, SendInput>(
    THREADS_KEY,
    appendMessage,
    () => ({}),
  );
  const sent = useFixtureValue<SentMessages>(THREADS_KEY, () => ({}));
  const [inFlight, setInFlight] = useState<Message | undefined>(undefined);

  /**
   * The queue half (gaps.md B4, benchmarks.md §5).
   *
   * A message that silently fails to send on a bad connection is *"the worst
   * outcome in the app"*, and it is the one this module used to produce: the
   * screen caught the rejection, showed a toast, and the bubble vanished. The
   * person had typed something, watched it appear, and then watched it go.
   *
   * The message's own id is the idempotency key — it already had one, minted
   * before the write — so a retry cannot duplicate it and the queue dedupes on
   * the same value the store does.
   */
  const queued = useOfflineSubmit<SendInput>({
    kind: 'message',
    handler: sendMessageHandler,
    label: (input) => input.body.slice(0, 40),
    idFor: (input) => input.id,
  });

  // The store is the truth the moment it holds the row, so the local copy is
  // dropped as soon as it appears there. Keeping both would draw the bubble
  // twice for one message.
  const settled = inFlight ? (sent[inFlight.threadId] ?? []).some((m) => m.id === inFlight.id) : false;

  // The three states, from the queue rather than from one boolean. `queued` is
  // not a failure — it is a message waiting for signal — and drawing it the
  // same as `failed` would train someone to ignore the one that needs them.
  const delivery: Message['delivery'] =
    queued.state === 'error' ? 'failed' : queued.state === 'queued' ? 'queued' : 'sending';

  const pending = settled ? undefined : inFlight && { ...inFlight, delivery };

  const send = useCallback(
    async (threadId: string, body: string) => {
      const thread = getThread(threadId);
      if (!thread) throw new Error(`no thread ${threadId}`);
      if (thread.status === 'archived') throw new Error('thread archived');

      const input: SendInput = {
        threadId,
        body: body.trim(),
        id: `${threadId}-sent-${Date.now()}`,
        createdAt: Date.now(),
      };
      setInFlight({ ...input, fromUs: true, pending: true });
      if (queued.offline) {
        await queued.submit(input);
        return;
      }
      await mutate(input);
    },
    [mutate, queued],
  );

  const retry = useCallback(() => {
    if (!inFlight) return;
    void queued.submit({
      threadId: inFlight.threadId,
      body: inFlight.body,
      id: inFlight.id,
      createdAt: inFlight.createdAt,
    });
  }, [inFlight, queued]);

  const discard = useCallback(() => {
    if (inFlight && queued.queuedId) cancelWrite(queued.queuedId);
    setInFlight(undefined);
    queued.reset();
  }, [inFlight, queued]);

  return { send, status, error, pending, retry, discard };
}

/**
 * Mark a thread read.
 *
 * `last_read_at` is the CLIENT clock here only because the prototype has no
 * server. The ADR is explicit that the real value is the server's: a wrong
 * device clock could mark future messages as already read, and they would never
 * show as unread again. Named here rather than fudged, because that is the one
 * line the swap to the API has to cross.
 */
export function useMarkThreadRead(): (threadId: string) => void {
  const { mutate } = useFixtureMutation<ThreadReads, string>(
    READS_KEY,
    (current, threadId) => ({ ...current, [threadId]: Date.now() }),
    () => SEEDED_READS,
  );

  return useCallback(
    (threadId: string) => {
      void mutate(threadId);
    },
    [mutate],
  );
}
