/**
 * `useFixtureMutation` — the write, and the twin of `useFixture`.
 *
 * **Every local write in the prototype goes through this, and that is the whole
 * point.** `useFixture` already returns the `{ status, data, error, retry }`
 * shape TanStack Query will return in Phase 3, so a screen's READ is already
 * written for the API. This gives the WRITE the same treatment: a screen calls
 * `mutate(input)`, gets a `status` back, and never touches a module-level array.
 * When the API lands, both halves swap for `useQuery` and `useMutation` and no
 * markup changes — which is exactly what ADR-030's data-layer decision asks for.
 *
 * Three things it does that a bare `useState` in a screen does not:
 *
 *   - **It writes to the store `useFixture` reads**, and emits a change, so a
 *     list on another tab re-renders. Local state in one screen is a write the
 *     rest of the app never sees, and half the prototype's toasts claim the
 *     opposite ("the front desk sees it live").
 *   - **It simulates 300ms of latency**, so the pending state is real and a
 *     screen that forgot to disable its button while saving is visibly wrong
 *     here rather than on the day the network arrives.
 *   - **It survives navigation**, because the override lives in a module-level
 *     store rather than in a component that unmounts.
 *
 * The store is deliberately NOT persisted. A relaunch puts the fixtures back
 * the way the files have them, which is the honest behaviour for a write that
 * never left the device, and it means a demo always starts from a known state.
 *
 * **Delete `MUTATION_LATENCY_MS` when the API lands**, the same way
 * `FIXTURE_LATENCY_MS` goes: two sources of delay is one too many.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export const MUTATION_LATENCY_MS = 300;

export type MutationStatus = 'idle' | 'saving' | 'error' | 'done';

/* ------------------------------------------------------------ the store --- */

/**
 * Overrides applied on top of the file fixtures, keyed the same way
 * `useFixture` keys its reads. A key that has never been written is absent,
 * so a read falls through to the file and there is no copy to keep in sync.
 */
const store = new Map<string, unknown>();
const listeners = new Set<(key: string) => void>();

/**
 * Bumped by every `resetFixtures()`.
 *
 * A mutation sleeps `MUTATION_LATENCY_MS` before it writes, and it writes even if
 * its screen unmounted meanwhile — which is correct for navigation and wrong
 * across a test boundary. Without this counter a toggle fired near the end of
 * one test lands a few hundred milliseconds later, AFTER that test's
 * `afterEach` reset, and seeds the next test with a store the next test never
 * wrote. It reads as an ordering bug in whichever suite happens to run second
 * and it moves around with machine load, because the only variable is whether
 * the timer beat the reset.
 *
 * So a write captures the epoch before it sleeps and drops itself if the number
 * moved. Reset means reset: nothing older than it may land after it.
 */
let epoch = 0;

function emit(key: string): void {
  for (const listener of listeners) listener(key);
}

/** Subscribe to writes. Returns the unsubscribe. */
export function onFixtureChange(listener: (key: string) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The current value for a key, or `fallback` if nothing has been written. */
export function readFixture<T>(key: string, fallback: T): T {
  return store.has(key) ? (store.get(key) as T) : fallback;
}

/**
 * Has anything been written for this key?
 *
 * The distinction `readFixture` cannot make: a stored value that happens to
 * equal the seed and a key nobody has touched read the same through it. A
 * caller that wants to REPLACE the seed — `personal-details.tsx` seeds the
 * local store from `GET /api/v1/me/profile` once the server answers — needs to
 * know whether the person has edited it since, because overwriting a live edit
 * with a server value the moment a refetch lands is the thing that makes a form
 * feel haunted.
 */
export function hasFixture(key: string): boolean {
  return store.has(key);
}

/** Write directly. For a seeder or a test; screens use the hook. */
export function writeFixture<T>(key: string, value: T): void {
  store.set(key, value);
  emit(key);
}

/**
 * Drop every override, and cancel every write still in flight. Used by tests so
 * one does not leak into the next — including a write whose latency has not
 * elapsed yet. See `epoch`.
 */
export function resetFixtures(): void {
  epoch += 1;
  const keys = [...store.keys()];
  store.clear();
  for (const key of keys) emit(key);
}

/* ------------------------------------------------------------- the hook --- */

export interface FixtureMutation<TInput> {
  mutate: (input: TInput) => Promise<void>;
  status: MutationStatus;
  error: Error | undefined;
  /** Back to `idle`, so a screen can dismiss a "done" without remounting. */
  reset: () => void;
}

/**
 * `key` is the fixture the write lands on — the same key the matching
 * `useFixture` read uses. `apply` takes the current value and the input and
 * returns the next value; it must be pure, because it is the only description
 * of the change and a later `useMutation` will call it to build its optimistic
 * update.
 */
export function useFixtureMutation<TValue, TInput = void>(
  key: string,
  apply: (current: TValue, input: TInput) => TValue,
  seed: () => TValue,
): FixtureMutation<TInput> {
  const [status, setStatus] = useState<MutationStatus>('idle');
  const [error, setError] = useState<Error>();

  // Both are written inline at every call site and are therefore new on every
  // render. Holding them on refs keeps `mutate` stable, so a screen can put it
  // in a dependency array without re-running an effect every render.
  const applyRef = useRef(apply);
  applyRef.current = apply;
  const seedRef = useRef(seed);
  seedRef.current = seed;

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const mutate = useCallback(
    async (input: TInput) => {
      setStatus('saving');
      setError(undefined);
      const started = epoch;
      await new Promise((resolve) => setTimeout(resolve, MUTATION_LATENCY_MS));
      // The store was reset while this was in flight. See `epoch`.
      if (epoch !== started) {
        if (alive.current) setStatus('idle');
        return;
      }
      try {
        const current = readFixture<TValue>(key, seedRef.current());
        writeFixture(key, applyRef.current(current, input));
        // The write landed and the listeners have already fired. A screen that
        // unmounted mid-flight still gets its data written — only its own
        // status is dropped, because there is nobody left to show it to.
        if (alive.current) setStatus('done');
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        if (alive.current) {
          setError(err);
          setStatus('error');
        }
      }
    },
    [key],
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setError(undefined);
  }, []);

  return { mutate, status, error, reset };
}

/**
 * The read half, for a value this store owns. It is `useFixture`'s shape minus
 * the loading state, because an override is already in memory: a screen that
 * has just written should not skeleton its own write back.
 */
export function useFixtureValue<T>(key: string, seed: () => T): T {
  const seedRef = useRef(seed);
  seedRef.current = seed;
  const [value, setValue] = useState<T>(() => readFixture(key, seed()));

  useEffect(() => {
    setValue(readFixture(key, seedRef.current()));
    return onFixtureChange((changed) => {
      if (changed === key) setValue(readFixture(key, seedRef.current()));
    });
  }, [key]);

  return value;
}
