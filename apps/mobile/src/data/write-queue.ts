/**
 * The offline write queue — where an action goes when there is no signal.
 *
 * The app already degrades its READS honestly: `OfflineBanner` is mounted once
 * app-wide and reports reachability rather than radio state, and `OfflineNote`
 * tells thirteen list screens that what they are showing may be stale.
 * `benchmarks.md` §6 says so and then names the gap: *"The gap is writes, not
 * reads. Reads degrade honestly; writes have nowhere to go."*
 *
 * Seven actions across five surfaces reach this queue, and they are not a
 * coincidental list — every one of them happens in a place with no signal:
 *
 *   | Action              | Where it happens                                  |
 *   |---------------------|---------------------------------------------------|
 *   | Send a message      | anywhere; silent loss is the worst failure we have |
 *   | Report a fault      | a stairwell, a basement — twice, tenant and Work   |
 *   | Save a listing      | ADR-032 already specifies optimistic-with-rollback |
 *   | Self check-in       | a doorway on poor 4G, with photos                 |
 *   | Reveal a contact    | it spends credit, so it must not fire twice        |
 *   | Record a payment    | a landlord standing in front of the tenant         |
 *
 * `gaps.md` §7 counts nine and includes the two Work status writes. Those have
 * their own buffer already and the reasoning is at `WriteKind` below — it is a
 * finding rather than an omission, and it carries the one real deficiency that
 * unification would fix.
 *
 * **Rent payment is deliberately NOT on that list**, and the exclusion is the
 * most important line in this file. `data-seam.md` §5: *"A queued payment is a
 * payment nobody consciously authorised at the moment it fires."* Refuse it
 * while offline, say why, and leave the obligation visible. `pay-rent` renders
 * that refusal; it never calls `enqueue`.
 *
 * ## The two rules the queue itself has to obey
 *
 * **Every item is idempotent, keyed by a client-generated token.** A queue that
 * retries without one produces duplicates, and the cost is not uniform:
 * duplicate fault reports are noise, a duplicate reveal is money, and a
 * duplicate payment is an incident. `enqueue` is a no-op on an id it already
 * holds, which is what makes "press send twice on a bad connection" safe.
 *
 * **An item is visible and cancellable.** A user must be able to see that
 * something is waiting and abandon it. *"An invisible queue that fires three
 * hours later is worse than a refusal."* `QueueBanner` is the visible half and
 * `cancel()` is the other.
 *
 * ## Why it persists
 *
 * ADR-030 says no persisted cache, and it is right: a rent balance rendered
 * from disk as if it were current is worse than an honest failure. This is not
 * a cache. `data-seam.md` §3 separates the four kinds of state and puts a
 * queued write in the fourth — **outbound intent**, the user's own unsent
 * action, where *"dropping it is data loss."* A cache that goes stale misleads;
 * an unsent message that vanishes is gone.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { api } from '@/lib/api';
import { ENDPOINTS } from '@/lib/endpoints';
import * as SecureStore from 'expo-secure-store';
import type { MessageKey } from '@/i18n/i18n';

/* -------------------------------------------------------------- the shape */

/**
 * The kinds this queue owns, as a closed set.
 *
 * A string would let a screen invent a seventh without a handler, and an item
 * with no handler is an item that waits forever looking like it is about to
 * send.
 *
 * TWO ABSENCES, BOTH DELIBERATE, and they are different kinds of absence.
 *
 * **`payment` is excluded on principle** — see the file header. A queued
 * payment is a payment nobody consciously authorised at the moment it fires.
 * That one is never coming back.
 *
 * **`taskStatus` and `roomStatus` are excluded on FINDING.** `gaps.md` §7
 * counts nine actions across the surfaces and puts those two here, but the Work
 * surface already has its own buffer and it is a good one:
 * `screens/work/work-store.ts`'s `useConnection` commits locally and
 * immediately, appends a marker to a buffer, and replays it on reconnect
 * through a reconnect card that names what is waiting. Adding a second
 * mechanism beside it would be the exact defect the corpus rules against —
 * ADR-028: *"this project's rule is that a second mechanism is the bug."*
 *
 * That buffer has ONE real deficiency against this queue and it is worth
 * writing down rather than papering over: **it lives in the fixture store,
 * which is not persisted, so it does not survive a process kill.** A
 * housekeeper whose phone dies mid-shift loses it. Unifying the two — making
 * this queue the persistence under the Work surface's own UI, rather than
 * replacing that UI — is owed, and it is a design change to a working surface
 * with six call sites and its own tests, so it is its own piece of work rather
 * than a side effect of this one.
 */
export type WriteKind =
  | 'message'
  | 'fault'
  | 'save'
  | 'checkIn'
  | 'reveal'
  | 'recordPayment';

/**
 * Where an intent can end up (ADR-038 child 0 task 16, AC-S17).
 *
 * There used to be one failure. There are two, and telling them apart is the
 * whole point:
 *
 *   queued           waiting for a connection
 *   sending          in flight right now
 *   sent             it landed
 *   failed-retryable we could not reach Injishi. Trying again may work
 *   failed-refused   the server said no, and said why. Trying again will not
 *
 * A refusal that is retried is the app asking the same question repeatedly and
 * being told no repeatedly, while the person watches a spinner. A reachability
 * failure that is NOT retried is a fault report abandoned because a lift went
 * through a tunnel. One state for both got one of those wrong whichever way it
 * was set.
 */
export type WriteState =
  | 'queued'
  | 'sending'
  | 'sent'
  | 'failed-retryable'
  | 'failed-refused';

export interface QueuedWrite<T = unknown> {
  /** The idempotency token. Client-generated, and the identity of the intent. */
  id: string;
  kind: WriteKind;
  payload: T;
  state: WriteState;
  /** What the user reads in the queue. Resolved at enqueue, not at send. */
  label: string;
  queuedAt: number;
  attempts: number;
  /** Never a raw string: `ui-rules.md` bans one, and a queue is where they hide. */
  error: MessageKey | null;
  /**
   * The server's own words for a refusal (AC-S8, AC-S17).
   *
   * The one place a raw string is allowed in this file, and it is allowed for
   * the same reason `api.ts` returns one: a refusal the app has no words for
   * has to reach the person who made the write, or they are left with "it
   * failed" and no way to act. It is only ever set alongside `failed-refused`.
   */
  serverMessage: string | null;
  /**
   * Local file URIs captured with the intent (task 17, AC-S16).
   *
   * **Persisted with the item, which is what closes the gap this file's own
   * comment used to record.** A fault report queued in a corridor and killed by
   * memory pressure used to come back without its photographs — the queue
   * survived and the images did not, because they lived in component state. The
   * URIs point at `expo-image-picker`'s cache directory, which outlives the
   * process, so persisting the URI is enough to persist the attachment.
   *
   * They are uploaded at FLUSH time, not at enqueue time: there is no network
   * when the item is queued, which is why it is queued.
   */
  attachments?: string[];
  /**
   * What `POST /api/v1/uploads` answered for those attachments.
   *
   * Kept on the item so a retry after a partial failure does not re-upload what
   * already landed. Bytes are the expensive part of a flush on a bad
   * connection, and uploading them twice is how a queue drains slower than it
   * fills.
   */
  objectKeys?: string[];
}

/**
 * What a kind does when it finally reaches the network.
 *
 * It answers with an OUTCOME rather than throwing, because the two failures
 * have to be told apart and a `catch` block is a bad place to work out which
 * one you are in. `objectKeys` carries whatever the flush uploaded, in the
 * order the attachments were captured.
 */
export type WriteHandler<T = unknown> = (
  payload: T,
  context: { id: string; objectKeys: string[] },
) => Promise<WriteOutcome> | WriteOutcome;

/**
 * The three answers a handler can give.
 *
 * The same vocabulary as `ApiResult`, minus `unauthenticated` — a signed-out
 * session is handled once by `api.ts` and the whole queue is moot until
 * somebody signs in again.
 */
export type WriteOutcome =
  | { status: 'ok' }
  | { status: 'refused'; message: string }
  | { status: 'failed' };

/* ------------------------------------------------------------- the store */

const STORE_KEY = 'injishi.write-queue';

// The same guard `domain.tsx` and `session.tsx` carry: SecureStore is a native
// keychain binding with no web implementation.
const persistable = Platform.OS !== 'web';

let queue: QueuedWrite[] = [];
let hydrated = false;
const listeners = new Set<() => void>();
const handlers = new Map<WriteKind, WriteHandler>();

function emit(): void {
  for (const listener of listeners) listener();
}

async function persist(): Promise<void> {
  if (!persistable) return;
  try {
    // A `sent` item is history, not intent, and does not need to outlive the
    // process. Persisting only what is still owed keeps the journal small and
    // means a restore cannot re-send something that already landed.
    const owed = queue.filter((item) => item.state !== 'sent');
    await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(owed));
  } catch {
    // A device that refuses the keychain still queues in memory. It loses the
    // ability to survive a kill, which is worth saying but is not worth
    // refusing the write over.
  }
}

/** Read the queue back on cold start. */
export async function hydrate(): Promise<QueuedWrite[]> {
  if (!persistable) {
    hydrated = true;
    return queue;
  }
  try {
    const raw = await SecureStore.getItemAsync(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as QueuedWrite[];
      // Anything caught mid-send by a kill is owed again, not lost and not
      // assumed delivered. `sending` is a state only this process can be in.
      queue = parsed.map((item) =>
        item.state === 'sending' ? { ...item, state: 'queued' as const } : item,
      );
    }
  } catch {
    queue = [];
  }
  hydrated = true;
  emit();
  return queue;
}

/**
 * Register what a kind actually does.
 *
 * The handler lives with the feature that owns the write rather than here, so
 * this file never learns what a fault report is. Today they wrap the fixture
 * store; when the API lands they wrap `api.ts` and nothing else moves.
 */
export function registerHandler<T>(kind: WriteKind, handler: WriteHandler<T>): void {
  handlers.set(kind, handler as WriteHandler);
}

/**
 * Add an intent to the queue.
 *
 * **Idempotent by `id`.** A second call with an id already held is a no-op and
 * returns the item that is already there. That is what makes a double press on
 * a bad connection safe, and it is the reason `id` is minted by the caller —
 * the caller is the only one who knows whether two presses are one intent.
 */
export function enqueue<T>(item: {
  id: string;
  kind: WriteKind;
  payload: T;
  label: string;
  /** Local file URIs. Persisted with the intent and uploaded at flush time. */
  attachments?: string[];
}): QueuedWrite<T> {
  const existing = queue.find((q) => q.id === item.id);
  if (existing) return existing as QueuedWrite<T>;

  const queued: QueuedWrite<T> = {
    ...item,
    state: 'queued',
    queuedAt: Date.now(),
    attempts: 0,
    error: null,
    serverMessage: null,
  };
  queue = [...queue, queued as QueuedWrite];
  emit();
  void persist();
  return queued;
}

/** Abandon an intent. The other half of "visible and cancellable". */
export function cancel(id: string): void {
  queue = queue.filter((item) => item.id !== id);
  emit();
  void persist();
}

/** Drop a `sent` item once its screen has shown it landed. */
export function clearSettled(): void {
  queue = queue.filter((item) => item.state !== 'sent');
  emit();
  void persist();
}

function patch(id: string, next: Partial<QueuedWrite>): void {
  queue = queue.map((item) => (item.id === id ? { ...item, ...next } : item));
  emit();
  void persist();
}

/**
 * Try everything that is waiting.
 *
 * Called when the connection comes back, and by a screen's retry. Serial rather
 * than parallel on purpose: these are a person's actions in the order they took
 * them, and a message that arrives before the one that preceded it reads as a
 * different conversation.
 *
 * A failure leaves the item IN the queue. It does not drop it and it does not
 * retry forever — the item goes `failed` with a reason, becomes visible in the
 * banner, and waits for the person to retry or abandon it. Silent infinite
 * retry is how an invisible queue fires three hours later.
 */
/**
 * Send the attachments this item still owes, and return their keys (task 17).
 *
 * Resumes rather than restarts: anything already uploaded is on the item, so a
 * flush interrupted halfway through three photographs sends the third one only.
 * Bytes are the slow part of a drain on the connection this app is built for.
 *
 * Sequential, not parallel. Three photographs racing on a shared 3G uplink take
 * longer in total than three sent in turn, and a partial failure in the middle
 * of a parallel batch leaves an order nobody can reconstruct.
 */
async function uploadPending(
  item: QueuedWrite,
): Promise<
  | { status: 'ok'; objectKeys: string[] }
  | { status: 'refused'; message: string; objectKeys: string[] }
  | { status: 'failed'; objectKeys: string[] }
> {
  const uris = item.attachments ?? [];
  const done = [...(item.objectKeys ?? [])];

  for (const uri of uris.slice(done.length)) {
    const result = await uploadAttachment(uri, item.id);
    if (result.status === 'refused') {
      return { status: 'refused', message: result.message, objectKeys: done };
    }
    if (result.status !== 'ok') {
      return { status: 'failed', objectKeys: done };
    }
    done.push(result.objectKey);
  }

  return { status: 'ok', objectKeys: done };
}

/**
 * One file to `POST /api/v1/uploads`, which the seam's task 2b built.
 *
 * Multipart, because that is what the route parses and because a base64 body
 * has to be fully received before its size can be measured, which turns the
 * server's 8 MB ceiling into a suggestion.
 *
 * `kind` is `property_photo`: the fixed four-entry list on the server is what
 * keeps this from being a general file host, and a fault report's photograph of
 * a broken lift is a photograph of a property. `attemptToken` carries the
 * item's idempotency token so the same photograph replayed after a kill is
 * recognised rather than stored twice.
 */
async function uploadAttachment(
  uri: string,
  attemptToken: string,
): Promise<{ status: 'ok'; objectKey: string } | { status: 'refused'; message: string } | { status: 'failed' }> {
  const form = new FormData();
  const filename = uri.split('/').pop() || 'attachment.jpg';
  // React Native's FormData takes this shape for a file, which is not the web
  // one: a plain object with uri, name and type rather than a Blob.
  form.append('file', { uri, name: filename, type: guessMime(filename) } as unknown as Blob);
  form.append('kind', 'property_photo');
  form.append('attemptToken', attemptToken);

  const answer = await api<{ objectKey: string }>(ENDPOINTS.uploads, {
    method: 'POST',
    formData: form,
  });

  if (answer.status === 'ok' && answer.data?.objectKey) {
    return { status: 'ok', objectKey: answer.data.objectKey };
  }
  if (answer.status === 'refused') return { status: 'refused', message: answer.message };
  // `unauthenticated` lands here too: `api.ts` has already ended the session,
  // and the item stays owed rather than being marked permanently refused.
  return { status: 'failed' };
}

/** Enough of a MIME type for the server to accept the part. */
function guessMime(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop() ?? '';
  if (ext === 'png') return 'image/png';
  if (ext === 'heic') return 'image/heic';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'pdf') return 'application/pdf';
  return 'image/jpeg';
}

export async function drain(): Promise<void> {
  // A REFUSED item is deliberately not picked up here. The server answered, and
  // asking again gets the same answer; it waits for the person to read the
  // message and either fix the intent or abandon it (AC-S17).
  const owed = queue.filter(
    (q) => q.state === 'queued' || q.state === 'failed-retryable',
  );

  for (const item of owed) {
    const handler = handlers.get(item.kind);
    if (!handler) {
      // Nothing can ever send this. Retryable, because the handler is
      // registered by a screen and the screen may simply not be mounted yet.
      patch(item.id, { state: 'failed-retryable', error: 'queue.noHandler' });
      continue;
    }

    patch(item.id, { state: 'sending', attempts: item.attempts + 1, error: null });

    // The attachments go up FIRST, and their keys are kept on the item, so the
    // write that references them cannot be sent before the bytes it points at
    // exist (task 17). A retry after a partial upload resumes rather than
    // starting the bytes again.
    let objectKeys = item.objectKeys ?? [];
    if ((item.attachments?.length ?? 0) > objectKeys.length) {
      const upload = await uploadPending(item);
      if (upload.status !== 'ok') {
        patch(item.id, {
          state: upload.status === 'refused' ? 'failed-refused' : 'failed-retryable',
          error: 'queue.sendFailed',
          serverMessage: upload.status === 'refused' ? upload.message : null,
          // Whatever did land is kept, so the next attempt sends fewer bytes.
          objectKeys: upload.objectKeys,
        });
        continue;
      }
      objectKeys = upload.objectKeys;
      patch(item.id, { objectKeys });
    }

    const outcome = await runHandler(handler, item, objectKeys);

    if (outcome.status === 'ok') {
      patch(item.id, { state: 'sent', error: null, serverMessage: null });
    } else if (outcome.status === 'refused') {
      // Kept, with the server's own words, and never retried. Dropping it here
      // is how a person's action disappears with no explanation.
      patch(item.id, {
        state: 'failed-refused',
        error: 'queue.refused',
        serverMessage: outcome.message,
      });
    } else {
      patch(item.id, {
        state: 'failed-retryable',
        error: 'queue.sendFailed',
        serverMessage: null,
      });
    }
  }
}

/**
 * Call a handler and never let it throw.
 *
 * A handler that throws is a bug in that handler, not an answer from the
 * server, so it is treated as retryable: the alternative is one bad handler
 * marking a person's intent permanently refused on the strength of a
 * `TypeError`.
 */
async function runHandler(
  handler: WriteHandler,
  item: QueuedWrite,
  objectKeys: string[],
): Promise<WriteOutcome> {
  try {
    return await handler(item.payload, { id: item.id, objectKeys });
  } catch {
    return { status: 'failed' };
  }
}

export function readQueue(): QueuedWrite[] {
  return queue;
}

export function isHydrated(): boolean {
  return hydrated;
}

/** Tests only. */
export function resetQueue(): void {
  queue = [];
  hydrated = false;
  handlers.clear();
  emit();
  void persist();
}

/* --------------------------------------------------------------- the hooks */

function useQueueSnapshot(): QueuedWrite[] {
  const [, force] = useState(0);
  useEffect(() => {
    const listener = () => force((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return queue;
}

export interface QueueHandle {
  items: QueuedWrite[];
  /** Still owed: queued, sending, or failed either way. What the banner counts. */
  pending: QueuedWrite[];
  /** Both failures, for a screen that just wants to know something went wrong. */
  failed: QueuedWrite[];
  /**
   * Refused by the server, with its message, and never retried (AC-S17).
   *
   * Separated because the ACTION differs: a retryable failure wants a retry
   * button, and a refusal wants the server's sentence and a way to abandon or
   * amend. Offering "try again" on a refusal is offering a button that cannot
   * work.
   */
  refused: QueuedWrite[];
  cancel: (id: string) => void;
  retry: () => Promise<void>;
}

export function useWriteQueue(): QueueHandle {
  const items = useQueueSnapshot();
  const pending = useMemo(() => items.filter((i) => i.state !== 'sent'), [items]);
  const failed = useMemo(
    () => items.filter((i) => i.state === 'failed-retryable' || i.state === 'failed-refused'),
    [items],
  );
  const refused = useMemo(
    () => items.filter((i) => i.state === 'failed-refused'),
    [items],
  );
  return useMemo(
    () => ({ items, pending, failed, refused, cancel, retry: drain }),
    [items, pending, failed, refused],
  );
}

/** One intent's state, for the row that represents it on screen. */
export function useQueuedWrite(id: string | null): QueuedWrite | null {
  const items = useQueueSnapshot();
  return id ? (items.find((i) => i.id === id) ?? null) : null;
}

/**
 * A client-generated idempotency token.
 *
 * Deliberately not a UUID: an id a person may have to read out to support is
 * more useful than one they cannot. Kind, then time, then entropy, so two
 * presses in the same millisecond still differ.
 */
export function mintWriteId(kind: WriteKind): string {
  const stamp = Date.now().toString(36);
  const noise = Math.random().toString(36).slice(2, 8);
  return `${kind}-${stamp}-${noise}`;
}
