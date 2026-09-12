/**
 * `useFixture` — the read a list screen waits on.
 *
 * Fixtures are synchronous, so a screen written directly against them can never
 * show a loading or an error state, and a branch that never renders is a branch
 * that rots. This returns the same `{ status, data, error, retry }` shape
 * TanStack Query will return in Phase 3, so the screens are already written for
 * the API and switching over is a change of hook, not a change of markup.
 *
 * The delay is deliberate and cold-cache only: the first read of a key in a
 * session shows a skeleton, every read after it is instant, which is exactly
 * how a query cache behaves. `resolved` is module-level so navigating back to a
 * screen does not re-skeleton it.
 *
 * **Delete `FIXTURE_LATENCY_MS` when the API lands.** Real latency will replace
 * it; two sources of delay is one too many.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export const FIXTURE_LATENCY_MS = 220;

export type FixtureStatus = 'loading' | 'error' | 'ready';

export interface FixtureResult<T> {
  status: FixtureStatus;
  data: T | undefined;
  error: Error | undefined;
  retry: () => void;
}

/** Keys already read in this session — the warm half of the cache. */
const resolved = new Set<string>();

export function useFixture<T>(key: string, read: () => T): FixtureResult<T> {
  // `read` is written inline at every call site, so it is a new function each
  // render. Holding it on a ref keeps the effect keyed on `key` alone.
  const readRef = useRef(read);
  readRef.current = read;

  const [attempt, setAttempt] = useState(0);
  const warm = resolved.has(key);
  const [state, setState] = useState<Omit<FixtureResult<T>, 'retry'>>(() =>
    warm
      ? { status: 'ready', data: read(), error: undefined }
      : { status: 'loading', data: undefined, error: undefined },
  );

  useEffect(() => {
    let cancelled = false;

    const settle = () => {
      if (cancelled) return;
      try {
        const data = readRef.current();
        resolved.add(key);
        setState({ status: 'ready', data, error: undefined });
      } catch (e) {
        setState({
          status: 'error',
          data: undefined,
          error: e instanceof Error ? e : new Error(String(e)),
        });
      }
    };

    if (resolved.has(key) && attempt === 0) {
      settle();
      return () => {
        cancelled = true;
      };
    }

    setState({ status: 'loading', data: undefined, error: undefined });
    const timer = setTimeout(settle, FIXTURE_LATENCY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { ...state, retry };
}
