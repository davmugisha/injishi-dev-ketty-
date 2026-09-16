/**
 * One cache for the app (ADR-038 child 0 task 7).
 *
 * Built at module scope, not inside a component, so a re-render never throws
 * away every cached row and refetches the screen the person is looking at. It
 * lives in its own module rather than in `app/_layout.tsx` so the offline
 * queue's handlers (`data/write-handlers.ts`), which run with no component
 * mounted, can invalidate what a replayed write changed.
 *
 * The retry policy is the contract's, not the library's default.
 * `unauthenticated` and `refused` are ANSWERS: the server was reached and it
 * said no. Retrying either asks the same question again more slowly, and in the
 * refusal case leaves somebody watching a spinner retry something that cannot
 * succeed. Only `failed`, which means we could not reach Injishi at all, is
 * worth another attempt. `shouldRetry` in `lib/api.ts` is where that is decided.
 */
import { QueryClient } from '@tanstack/react-query';

import { shouldRetry } from './api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetry,
      // A phone is backgrounded and reopened constantly, and refetching every
      // visible query on each return is a lot of traffic on a connection this
      // app is meant to be careful with. A screen that needs fresher data than
      // this says so itself.
      staleTime: 60 * 1000,
    },
    mutations: {
      // A write is never retried automatically. The offline queue owns replay,
      // it carries the idempotency token that makes replay safe, and a second
      // path retrying underneath it is how one message gets sent twice.
      retry: false,
    },
  },
});
