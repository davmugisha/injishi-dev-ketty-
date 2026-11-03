// The seam every screen reads and writes through (proto-ui, PLAN.md "Data seam"). A feature's `data.ts`
// builds its hooks on these two:
//
//   export function useToday() {
//     return useSource(["housekeeper", "today"], { mock: () => mockToday(), api: () => getParsed(...) });
//   }
//   export function useFinishRoom() {
//     return useAction({ mock: (room: string) => finishRoom(room), invalidates: [["housekeeper"]] });
//   }
//
// Mock mode answers at once from the sample data, and `?proto=loading|empty|error` on the current URL
// forces that state. Api mode calls `api`, or fails with `NotWiredError` ("Not connected yet") where no
// real call exists yet. The decisions themselves are in `source-rules.ts`, under `node --test`.

import {
  type UseMutationResult,
  type UseQueryOptions,
  type UseQueryResult,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useGlobalSearchParams } from "expo-router";
import { DATA_MODE } from "@/lib/data-mode";
import { ApiError } from "./fetch";
import {
  type ActionImpl,
  actionDefaults,
  actionPlan,
  type ForcedState,
  forcedState,
  invalidationKeys,
  queryDefaults,
  type ReadPlan,
  readPlan,
  type SourceImpl,
  sourceKey,
} from "./source-rules";

export type { ActionImpl, ForcedState, SourceImpl } from "./source-rules";

/** Api mode, and this read or write has no real call yet. `QueryView` shows "Not connected yet". */
export class NotWiredError extends Error {
  /** The screen's key, to tell which read it was. */
  readonly key: readonly unknown[];

  constructor(key: readonly unknown[] = []) {
    super(`Not connected yet: ${key.map(String).join("/")}`);
    this.name = "NotWiredError";
    this.key = key;
  }
}

function useForcedFromUrl(): ForcedState | null {
  const { proto } = useGlobalSearchParams<{ proto?: string }>();
  return forcedState(DATA_MODE, proto);
}

function noForcedState(): ForcedState | null {
  return null;
}

/**
 * The state `?proto=` forces on the current screen, in mock mode; always null in api mode. The mode is
 * fixed when the app is bundled, so which hook this is never changes between renders.
 */
export const useForcedState: () => ForcedState | null = DATA_MODE === "mock" ? useForcedFromUrl : noForcedState;

function answer<T>(plan: ReadPlan<T>, key: readonly unknown[], signal: AbortSignal): Promise<T> {
  switch (plan.kind) {
    case "now":
      return Promise.resolve().then(plan.read);
    case "never":
      // Never answers, but listens for the abort, so the query is let go once the screen leaves.
      return new Promise<T>((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason)));
    case "fail":
      return Promise.reject(new ApiError("failed"));
    case "api":
      return plan.read();
    case "not-wired":
      return Promise.reject(new NotWiredError(key));
  }
}

/**
 * A read. `key` starts with the feature folder (`["housekeeper", "today"]`); the cache key is
 * `["source", ...key, mode, forced]`. In mock mode the first render already has the data.
 */
export function useSource<T>(
  key: readonly unknown[],
  impl: SourceImpl<T>,
  opts?: { enabled?: boolean },
): UseQueryResult<T> {
  const forced = useForcedState();
  const plan = readPlan(DATA_MODE, forced, impl);
  const enabled = opts?.enabled ?? true;
  const options: UseQueryOptions<T, Error, T, readonly unknown[]> = {
    queryKey: sourceKey(key, DATA_MODE, forced),
    queryFn: ({ signal }) => answer(plan, key, signal),
    // Sample data is there on the first frame: no skeleton flashes before it.
    initialData: plan.kind === "now" && enabled ? plan.read : undefined,
    enabled,
    ...queryDefaults(DATA_MODE),
  };
  return useQuery(options);
}

/**
 * A write. Mock mode runs `mock` (which changes the feature's sample data and returns new objects);
 * api mode runs `api`, or fails with `NotWiredError`. Once it succeeds, every read under each
 * `invalidates` prefix is read again, so the screens show the change.
 */
export function useAction<I = void, O = void>(impl: ActionImpl<I, O>): UseMutationResult<O, Error, I> {
  const client = useQueryClient();
  return useMutation<O, Error, I>({
    mutationFn: async (input) => {
      const plan = actionPlan(DATA_MODE, impl);
      if (plan.kind === "not-wired") throw new NotWiredError(["action"]);
      return plan.run(input);
    },
    onSuccess: () =>
      Promise.all(invalidationKeys(impl.invalidates).map((queryKey) => client.invalidateQueries({ queryKey }))),
    ...actionDefaults(DATA_MODE),
  });
}
