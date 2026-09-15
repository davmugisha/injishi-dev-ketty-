/**
 * `useOfflineSubmit` — the one way a screen performs a write that must survive
 * having no signal.
 *
 * Eight screens across five surfaces need the same three-branch behaviour, and
 * writing it eight times is how they come to disagree about the one thing that
 * matters: what the app is allowed to CLAIM. This owns that.
 *
 * ```
 *   online   → run it now        → done   | error (with a retry)
 *   offline  → put it in the queue → queued ("submitted when you reconnect")
 * ```
 *
 * ## The claim, which is the whole design
 *
 * `data-seam.md` §5 is precise about the words: a queued fault report is
 * confirmed as *"submitted when you reconnect"*, **never** as *"received"*.
 * Nobody has seen it. A screen that says "received" about something sitting in
 * a keychain on the reporter's own phone has told them the lift is being fixed.
 *
 * ## Idempotency is the caller's to decide
 *
 * The token is minted here per submit and reused across every retry of THAT
 * submit — one press, one intent — which is the same rule ADR-020 D-c sets for
 * the payment attempt token, applied to the other eight writes. A caller with
 * its own notion of identity (a message already has a client id) passes `idFor`
 * and the queue dedupes on that instead.
 *
 * ## Why the handler is registered rather than closed over
 *
 * A queued item outlives the screen that queued it — that is the point — so
 * `drain()` cannot call a closure from an unmounted component. Each kind
 * registers its handler once, at module level in `write-handlers.ts`, and the
 * handler takes only the serialised payload. That constraint is load-bearing: it forces the payload to be
 * something that survives a process kill, which is exactly what a queued
 * intent has to be.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MessageKey } from '@/i18n/i18n';
import { useOffline } from '@/components/offline-banner';
import {
  drain,
  enqueue,
  hasHandler,
  mintWriteId,
  registerHandler,
  useQueuedWrite,
  type WriteHandler,
  type WriteKind,
  type WriteOutcome,
} from './write-queue';

export type SubmitState = 'idle' | 'saving' | 'queued' | 'done' | 'error';

/**
 * Run a handler online without letting it throw.
 *
 * A handler that throws is a bug in that handler rather than an answer from the
 * server, so it is reported as a reachability failure: the intent is then
 * queued and kept, which is the safe side to be wrong on.
 */
async function runOnline(
  run: () => Promise<WriteOutcome> | WriteOutcome,
): Promise<WriteOutcome> {
  try {
    return await run();
  } catch {
    return { status: 'failed' };
  }
}

export interface OfflineSubmit<T> {
  submit: (payload: T) => Promise<void>;
  state: SubmitState;
  /** Never a raw string. `ui-rules.md` bans one and a failed write is where they hide. */
  error: MessageKey | null;
  /**
   * The server's own message, when it refused (AC-S8).
   *
   * The one exception to the rule above, and it is the same exception `api.ts`
   * makes: a refusal the app has no words for has to reach the person who made
   * the write, or they are told "that did not send" about a decision.
   */
  refusal: string | null;
  /** The queued intent's id, so a screen can show and cancel its own row. */
  queuedId: string | null;
  reset: () => void;
  /** True while the app has no reachable network. Screens word themselves by it. */
  offline: boolean;
}

export interface OfflineSubmitArgs<T> {
  kind: WriteKind;
  /**
   * What the write actually does. Registered once; called by `drain` too.
   *
   * It answers with a `WriteOutcome` rather than throwing, because a refusal
   * and a reachability failure need different treatment and a `catch` cannot
   * tell them apart (ADR-038 child 0, AC-S17).
   */
  handler: WriteHandler<T>;
  /** What the person reads in the queue. Resolved now, not at send. */
  label: (payload: T) => string;
  /** A caller-owned identity, when the payload already has one. */
  idFor?: (payload: T) => string;
  /**
   * Local file URIs to send with this write (AC-S16).
   *
   * Persisted with the queued intent and uploaded at flush time, so a fault
   * report queued in a corridor and killed by memory pressure comes back with
   * its photographs rather than without them.
   */
  attachmentsFor?: (payload: T) => string[];
  /** The reason shown when an online attempt cannot reach the server. */
  errorKey?: MessageKey;
}

export function useOfflineSubmit<T>({
  kind,
  handler,
  label,
  idFor,
  attachmentsFor,
  errorKey = 'queue.sendFailed',
}: OfflineSubmitArgs<T>): OfflineSubmit<T> {
  const offline = useOffline();
  const [state, setState] = useState<SubmitState>('idle');
  const [error, setError] = useState<MessageKey | null>(null);
  /** The server's own words for a refusal. Never a key: the words are not ours. */
  const [refusal, setRefusal] = useState<string | null>(null);
  const [queuedId, setQueuedId] = useState<string | null>(null);

  // Written inline at every call site and therefore new every render. Refs keep
  // `submit` stable so a screen may put it in a dependency array.
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  const labelRef = useRef(label);
  labelRef.current = label;
  const idRef = useRef(idFor);
  idRef.current = idFor;
  const attachmentsRef = useRef(attachmentsFor);
  attachmentsRef.current = attachmentsFor;

  // A FALLBACK only. Every kind is registered at module level by
  // `write-handlers.ts`, imported from the root layout, because a drain after a
  // cold start runs before any screen mounts. This covers a render that never
  // imported that module (a screen test), and never replaces a handler that is
  // already there. It reads the ref so an unmounted screen's closure still
  // points at current code.
  useEffect(() => {
    if (hasHandler(kind)) return;
    registerHandler<T>(kind, (payload, context) => handlerRef.current(payload, context));
  }, [kind]);

  // Coming back online is what empties the queue. It is deliberately not a
  // timer: retrying on a schedule while offline burns battery to fail.
  useEffect(() => {
    if (!offline) void drain();
  }, [offline]);

  const queued = useQueuedWrite(queuedId);

  // A queued item that later sends moves this screen's own state with it, so a
  // person still on the screen when the signal returns sees it land.
  useEffect(() => {
    if (!queued) return;
    if (queued.state === 'sent') {
      setState('done');
      setRefusal(null);
    } else if (
      queued.state === 'failed-retryable' ||
      queued.state === 'failed-refused'
    ) {
      setState('error');
      setError(queued.error ?? errorKey);
      // A refusal carries the server's own sentence and is what the person
      // actually needs to read; a retryable failure carries none.
      setRefusal(queued.serverMessage);
    }
  }, [queued, errorKey]);

  const submit = useCallback(
    async (payload: T) => {
      setError(null);
      setRefusal(null);
      const id = idRef.current?.(payload) ?? mintWriteId(kind);
      const attachments = attachmentsRef.current?.(payload);

      if (offline) {
        enqueue({ id, kind, payload, label: labelRef.current(payload), attachments });
        setQueuedId(id);
        setState('queued');
        return;
      }

      setState('saving');
      // The SAME token the queued form would carry, so a write that fails
      // online and is then queued and replayed is ONE intent throughout
      // (AC-S15). The token is minted at the moment of the intent, never per
      // attempt.
      const outcome = await runOnline(() =>
        handlerRef.current(payload, { id, objectKeys: [] }),
      );

      if (outcome.status === 'ok') {
        setState('done');
        return;
      }

      if (outcome.status === 'refused') {
        // A refusal is NOT queued. The server answered, and the answer will not
        // change by waiting; queueing it would hide a decision the person needs
        // to read behind a spinner that never resolves.
        setState('error');
        setError('queue.refused');
        setRefusal(outcome.message);
        return;
      }

      // A failed ONLINE write is queued, not lost. The person tried; the
      // network is what failed, and an intent dropped because a request timed
      // out is the same data loss as one dropped because the radio was off.
      enqueue({ id, kind, payload, label: labelRef.current(payload), attachments });
      setQueuedId(id);
      setState('error');
      setError(errorKey);
    },
    [kind, offline, errorKey],
  );

  const reset = useCallback(() => {
    setState('idle');
    setError(null);
    setRefusal(null);
    setQueuedId(null);
  }, []);

  return { submit, state, error, refusal, queuedId, reset, offline };
}
