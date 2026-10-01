/**
 * The payment attempt — the state machine both Rwandan rails force on us.
 *
 * [benchmarks.md §4](../../../../injishi.context/dox/mobile-v1/benchmarks.md)
 * calls this the single highest-value finding in the mobile guide, and the
 * reason is not a preference about spinners. MTN MoMo customers approve through
 * the MoMo app or USSD `*303#`; Airtel customers through their app or `*778#`.
 * In both cases the customer receives a push or USSD prompt, **leaves the app,
 * enters a PIN elsewhere, and the merchant learns the result asynchronously via
 * a callback.**
 *
 * The checkout before this collected a handset number and stopped. Everything
 * after "submit" was a 1.2-second wait and then a confirmation — which models a
 * card rail, not this one. On these rails the guest is somewhere else when the
 * answer arrives, and half the time the answer has not arrived at all.
 *
 * ## The five obligations, and where each one lives
 *
 * 1. **`prompting` survives backgrounding and app kill.** The guest leaving the
 *    app is not an edge case, it is how the rail works. So the attempt is in
 *    the keychain keyed by its token, not in `useState`, and `resume()` is what
 *    a cold start calls. This is the obligation the old code could not have met
 *    at any cost, because there was nothing to restore.
 *
 * 2. **`unknown` is the default, not an error.** A returning app that cannot
 *    yet confirm says "still confirming" and offers to check again. It never
 *    claims success and never claims failure. `expire()` moves a stale
 *    `prompting` to `unknown`, never to `refused`.
 *
 * 3. **Only a callback produces `confirmed`.** Nothing the client observes is
 *    proof, so `confirm()` is the ONLY transition that reaches that state and
 *    it takes a reference it did not invent. `settle()` — the fixture stand-in
 *    for the rail — is the only caller, and when the API lands it is replaced
 *    by the webhook read. No screen may call `confirm()`.
 *
 * 4. **The transaction reference is the deliverable.** On an async rail it is
 *    the only thing a person can act on: it is what they read to an agent, and
 *    what a support ticket is about. It is on the attempt, it is rendered large
 *    and copyable, and it is repeated in the confirmation and in Trips.
 *
 * 5. **Every terminal state names its next action.** `ui-rules.md` forbids a
 *    raw error message, and "payment failed" alone is one. Each terminal state
 *    carries a `reason` key and the screen renders the action beside it.
 *
 * ## What this deliberately does NOT do
 *
 * It does not retry by itself, and it does not queue. A queued payment is a
 * payment nobody consciously authorised at the moment it fires
 * ([data-seam.md §5](../../../../injishi.context/dox/mobile-v1/data-seam.md)),
 * which is why rent payment is the one write excluded from the offline queue.
 * Re-check is always a deliberate press.
 *
 * The **token is the client half of ADR-020 D-c**: one press of confirm mints
 * one token and every retry of that press reuses it, or a retry becomes a
 * second charge. `book-draft.ts` already mints it for the booking flow; this
 * module never mints one, it only ever receives it.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { MessageKey } from '@/i18n/i18n';

/* ------------------------------------------------------------- the states */

/**
 * ```
 *                  ┌──────────┐
 *                  │  idle    │
 *                  └────┬─────┘
 *                       │ submit(token, handset, amount)
 *                  ┌────▼─────┐
 *                  │ prompting│  "Check your phone. Enter your PIN there."
 *                  └────┬─────┘  Names the handset. Never a bare spinner.
 *         ┌─────────────┼──────────────┬───────────────┐
 *    ┌────▼────┐  ┌─────▼─────┐  ┌─────▼────┐   ┌──────▼─────┐
 *    │confirmed│  │  refused  │  │ expired  │   │  unknown   │
 *    └─────────┘  └───────────┘  └──────────┘   └──────┬─────┘
 *    reference        reason         retry              │ re-check
 *    large, copyable  + next action                     └── the commonest case
 * ```
 */
export type AttemptState = 'idle' | 'prompting' | 'confirmed' | 'refused' | 'expired' | 'unknown';

/** The four states that end an attempt. `unknown` is not one: it can still move. */
export const TERMINAL: readonly AttemptState[] = ['confirmed', 'refused', 'expired'];

export interface PaymentAttempt {
  /** ADR-020 D-c. Minted by the caller, once per press, reused on every retry. */
  token: string;
  state: AttemptState;
  /**
   * WHICH handset the prompt went to. The screen must say it: a guest with two
   * SIMs who is told only "check your phone" checks the wrong one.
   */
  handset: string;
  /** 'momo' | 'airtel' — the rail, which decides the USSD code shown. */
  rail: string;
  amountRwf: number;
  /** Only ever set by `confirm()`, and only from a value the rail returned. */
  reference: string | null;
  /** Why a terminal state happened, as a message key. Never a raw string. */
  reason: MessageKey | null;
  /** Epoch ms. `expire()` reads it; nothing else should. */
  startedAt: number;
  /** How many times the guest has asked us to check again. */
  checks: number;
}

/**
 * How long a prompt is given before a returning app calls it `unknown`.
 *
 * Both rails expire an unanswered prompt at around 60 seconds. This is
 * deliberately longer: the cost of saying "still confirming" about a payment
 * that has in fact failed is one extra tap, and the cost of saying "expired"
 * about a payment that in fact succeeded is a guest who pays twice.
 */
export const PROMPT_WINDOW_MS = 180_000;

/* ---------------------------------------------------------- the transitions */

/**
 * Every transition is a pure function of the attempt, and they are exported
 * because they are the whole of the decision. A test that presses a button
 * proves a screen; these prove the machine.
 */

export function begin(args: {
  token: string;
  handset: string;
  rail: string;
  amountRwf: number;
  now?: number;
}): PaymentAttempt {
  return {
    token: args.token,
    state: 'prompting',
    handset: args.handset,
    rail: args.rail,
    amountRwf: args.amountRwf,
    reference: null,
    reason: null,
    startedAt: args.now ?? Date.now(),
    checks: 0,
  };
}

/**
 * The ONLY way to reach `confirmed`, and it takes a reference it did not make
 * up. Obligation 3: nothing the client observes is proof.
 */
export function confirm(attempt: PaymentAttempt, reference: string): PaymentAttempt {
  return { ...attempt, state: 'confirmed', reference, reason: null };
}

export function refuse(attempt: PaymentAttempt, reason: MessageKey): PaymentAttempt {
  return { ...attempt, state: 'refused', reason };
}

/**
 * A prompt that ran out of time.
 *
 * Note what this does NOT do: it does not touch an attempt that is already
 * terminal, and it moves a stale `prompting` to `unknown` rather than to
 * `expired`. `expired` is a fact the rail tells us; running out of patience on
 * this side only ever means we do not know.
 */
export function expire(attempt: PaymentAttempt, now: number = Date.now()): PaymentAttempt {
  if (attempt.state !== 'prompting') return attempt;
  if (now - attempt.startedAt < PROMPT_WINDOW_MS) return attempt;
  return { ...attempt, state: 'unknown', reason: 'pay.stillConfirming' };
}

/** The guest asking again. Counts the ask; the answer comes from the rail. */
export function recheck(attempt: PaymentAttempt): PaymentAttempt {
  return { ...attempt, state: 'unknown', checks: attempt.checks + 1, reason: 'pay.stillConfirming' };
}

/** True when the screen may move the user on. */
export function isSettled(attempt: PaymentAttempt | null): boolean {
  return attempt?.state === 'confirmed';
}

/** True when the attempt is still out with the rail and cannot be re-submitted. */
export function isOpen(attempt: PaymentAttempt | null): boolean {
  return attempt?.state === 'prompting' || attempt?.state === 'unknown';
}

/* ------------------------------------------------------------ persistence */

const STORE_KEY = 'injishi.payment-attempts';

// The same guard `domain.tsx` and `session.tsx` carry: SecureStore is a native
// keychain binding with no web implementation, so a web build degrades to
// in-memory rather than crashing. The attempt is not a secret — it is here
// because it is the one piece of state that MUST outlive the process.
const persistable = Platform.OS !== 'web';

/** Open attempts, by token. In memory, mirrored to the keychain. */
let attempts: Record<string, PaymentAttempt> = {};
let hydrated = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

async function persist(): Promise<void> {
  if (!persistable) return;
  try {
    await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(attempts));
  } catch {
    // A device that refuses the keychain still gets a working checkout; it
    // only loses the ability to resume across a kill. Degrading is right —
    // refusing to take the payment because we cannot write a journal is not.
  }
}

/**
 * Read the journal back. Called once by the shell on cold start.
 *
 * Every `prompting` attempt that has outlived its window comes back as
 * `unknown`, which is obligation 2 doing its work at exactly the moment it
 * matters: the guest has returned from the MoMo app and we do not yet know.
 */
export async function resume(now: number = Date.now()): Promise<PaymentAttempt[]> {
  if (!persistable) {
    hydrated = true;
    return Object.values(attempts);
  }
  try {
    const raw = await SecureStore.getItemAsync(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, PaymentAttempt>;
      attempts = Object.fromEntries(
        Object.entries(parsed).map(([token, attempt]) => [token, expire(attempt, now)]),
      );
    }
  } catch {
    attempts = {};
  }
  hydrated = true;
  emit();
  return Object.values(attempts);
}

/** Write one attempt. Every transition goes through here. */
export function put(attempt: PaymentAttempt): void {
  attempts = { ...attempts, [attempt.token]: attempt };
  emit();
  void persist();
}

export function get(token: string): PaymentAttempt | null {
  return attempts[token] ?? null;
}

/**
 * Forget an attempt.
 *
 * Called when a screen has SHOWN the guest a terminal state, not when the
 * attempt reaches one. A confirmed payment the guest never saw is a payment
 * they will make again.
 */
export function forget(token: string): void {
  const { [token]: _gone, ...rest } = attempts;
  attempts = rest;
  emit();
  void persist();
}

/** Every attempt still open, for the resume banner. */
export function openAttempts(): PaymentAttempt[] {
  return Object.values(attempts).filter((a) => isOpen(a));
}

/** Tests only: drop the journal, in memory and on disk. */
export function resetAttempts(): void {
  attempts = {};
  hydrated = false;
  emit();
  void persist();
}

export function isHydrated(): boolean {
  return hydrated;
}

/* ------------------------------------------------------------- the rail */

/**
 * The fixture stand-in for the callback.
 *
 * **This is the seam.** When the API lands, this function is deleted and the
 * `confirmed` transition comes from a webhook read instead — nothing in a
 * screen changes, because no screen calls this or `confirm()`.
 *
 * The distribution is not decorative. `data-seam.md` §4 says `unknown` is
 * *"the commonest real case"*, so the fixture makes it the commonest outcome
 * too: a prototype where every payment confirms in 1.2 seconds teaches the
 * team that the happy path is the normal path, and it is not. The seed is the
 * token, so one attempt always settles the same way and a retry of the same
 * press cannot roll a different answer — which is the whole point of the token.
 */
export function settle(attempt: PaymentAttempt, reference: string): PaymentAttempt {
  const roll = [...attempt.token].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) % 100, 7);
  const bucket = (roll + attempt.checks * 37) % 100;
  if (bucket < 62) return confirm(attempt, reference);
  if (bucket < 74) return refuse(attempt, 'pay.refusedByCustomer');
  if (bucket < 82) return refuse(attempt, 'pay.insufficientFunds');
  if (bucket < 90) return { ...attempt, state: 'expired', reason: 'pay.promptExpired' };
  return recheck(attempt);
}

/**
 * How long the rail is given before it answers, in the fixture.
 *
 * 1.2 seconds — the same figure `book-draft.ts` uses and for the same reason:
 * it stands for the round trip a mobile-money push actually takes, the prompt
 * reaching the handset, rather than a spinner for its own sake. It models the
 * provider call ADR-020 D-a puts OUTSIDE the transaction, which is why it is
 * not `MUTATION_LATENCY_MS`.
 *
 * It does NOT model how long a person takes to find their phone and type a
 * PIN. Nothing here does, because nothing can: that is the whole reason
 * `prompting` is persisted rather than awaited.
 */
export const RAIL_MS = 1200;

/**
 * A transaction reference in the shape the rail issues.
 *
 * MTN and Airtel both return an alphanumeric reference the customer can read
 * back to an agent, and the prefix is how a person tells which rail a payment
 * went through when they have two. Generated here in the fixture; when the API
 * lands the reference comes from the callback and this is deleted with
 * `settle`.
 */
export function mintReferenceForRail(rail: string): string {
  const prefix = rail === 'airtel' ? 'AM' : 'MP';
  const stamp = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const noise = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${stamp}-${noise}`;
}

/**
 * Start the rail for an attempt, and let it answer in its own time.
 *
 * NOT EXPORTED. `usePaymentAttempt().submit` is the only caller, which is what
 * makes obligation 3 structural rather than a convention: a screen has no way
 * to reach `confirm`, `settle` or this, so it cannot decide its own outcome
 * even by accident.
 *
 * When the API lands this is deleted and the `confirmed` transition arrives
 * from a webhook read instead. Nothing in a screen changes, because no screen
 * knows this exists.
 */
function startRail(token: string): void {
  setTimeout(() => {
    const current = get(token);
    // Only a live prompt may be answered. A guest who pressed "try again"
    // between the submit and now has moved on to a different token, and an
    // answer arriving for the abandoned one would resurrect it.
    if (!current || current.state !== 'prompting') return;
    put(settle(current, mintReferenceForRail(current.rail)));
  }, RAIL_MS);
}

/* -------------------------------------------------------------- the hook */

export interface AttemptHandle {
  attempt: PaymentAttempt | null;
  /** Start the prompt. Refuses to start a second one on the same token. */
  submit: (args: { handset: string; rail: string; amountRwf: number }) => void;
  /** The guest asking again. Never claims a result the rail has not given. */
  checkAgain: () => void;
  /** Clear a terminal attempt once the guest has seen it. */
  dismiss: () => void;
}

/**
 * The screen's handle on one attempt.
 *
 * `token` is `null` before the first press, which is how a screen says "I have
 * nothing in flight" without inventing a token it may never use.
 */
export function usePaymentAttempt(token: string | null): AttemptHandle {
  const [, force] = useState(0);

  useEffect(() => {
    const listener = () => force((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const attempt = token ? get(token) : null;

  const submit = useCallback(
    (args: { handset: string; rail: string; amountRwf: number }) => {
      if (!token) return;
      const existing = get(token);
      // Obligation: one press, one prompt. A second submit on a live token is
      // the double-charge this whole design exists to prevent.
      if (isOpen(existing) || existing?.state === 'confirmed') return;
      put(begin({ token, ...args }));
      // The rail is started HERE, not by the screen. A screen that scheduled
      // its own settlement would be a screen that decides its own outcome,
      // which is obligation 3 with the words rearranged — and the gate that
      // caught it was right to: both money screens had imported `settle`.
      startRail(token);
    },
    [token],
  );

  const checkAgain = useCallback(() => {
    if (!token) return;
    const existing = get(token);
    if (!existing) return;
    // Ask, then wait for the answer. `recheck` moves the attempt back to
    // `unknown` and counts the ask; it does not answer it. A "check again" that
    // resolved locally would be a button that changes a label.
    put({ ...recheck(existing), state: 'prompting' });
    startRail(token);
  }, [token]);

  const dismiss = useCallback(() => {
    if (token) forget(token);
  }, [token]);

  return useMemo(() => ({ attempt, submit, checkAgain, dismiss }), [attempt, submit, checkAgain, dismiss]);
}
