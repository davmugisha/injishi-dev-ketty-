// The seam's decisions (proto-ui, PLAN.md "Data seam"), pure so `node --test` locks them: which data a
// screen's read answers with in each mode, the forced states a prototype URL asks for, the cache keys,
// and what an action invalidates. `source.ts` turns these into TanStack Query calls.
// No React Native import, and relative `.ts` imports only.

import type { DataMode } from "../lib/data-mode.ts";

/** `?proto=loading|empty|error` on the current URL, in mock mode: the screen shows that state. */
export type ForcedState = "loading" | "empty" | "error";

const FORCED: readonly ForcedState[] = ["loading", "empty", "error"];

/** The forced state a URL asks for. Api mode never forces one: a real screen is never faked. */
export function forcedState(mode: DataMode, proto: unknown): ForcedState | null {
  if (mode !== "mock") return null;
  const value = Array.isArray(proto) ? proto[0] : proto;
  return typeof value === "string" && (FORCED as readonly string[]).includes(value) ? (value as ForcedState) : null;
}

/** A read: the sample data, the real call where one exists today, and an optional empty answer. */
export type SourceImpl<T> = { mock: () => T; api?: () => Promise<T>; empty?: () => T };

/** A write: the sample data's own change, the real call where one exists, and which reads it refreshes. */
export type ActionImpl<I, O> = {
  mock: (input: I) => O;
  api?: (input: I) => Promise<O>;
  /** Key prefixes as the screens' `useSource` calls write them (`["housekeeper", "today"]`). */
  invalidates?: readonly (readonly unknown[])[];
};

/** How a read is answered. */
export type ReadPlan<T> =
  /** At once, from the sample data (or its empty answer). */
  | { kind: "now"; read: () => T }
  /** Forced loading: never answers. */
  | { kind: "never" }
  /** Forced error: fails the way no signal does ("Can't connect"). */
  | { kind: "fail" }
  /** The real API. */
  | { kind: "api"; read: () => Promise<T> }
  /** Api mode, and this read has no real call yet ("Not connected yet"). */
  | { kind: "not-wired" };

export function readPlan<T>(mode: DataMode, forced: ForcedState | null, impl: SourceImpl<T>): ReadPlan<T> {
  if (mode === "api") return impl.api ? { kind: "api", read: impl.api } : { kind: "not-wired" };
  if (forced === "loading") return { kind: "never" };
  if (forced === "error") return { kind: "fail" };
  if (forced === "empty") return { kind: "now", read: impl.empty ?? impl.mock };
  return { kind: "now", read: impl.mock };
}

/** How a write is carried out. */
export type ActionPlan<I, O> =
  | { kind: "mock"; run: (input: I) => O }
  | { kind: "api"; run: (input: I) => Promise<O> }
  | { kind: "not-wired" };

export function actionPlan<I, O>(mode: DataMode, impl: ActionImpl<I, O>): ActionPlan<I, O> {
  if (mode === "mock") return { kind: "mock", run: impl.mock };
  return impl.api ? { kind: "api", run: impl.api } : { kind: "not-wired" };
}

/**
 * The cache key: `["source", ...key, mode, forced]`. It starts with the screen's own key, so
 * `["source", ...prefix]` invalidates every read under a prefix, in every mode and state.
 */
export function sourceKey(key: readonly unknown[], mode: DataMode, forced: ForcedState | null): readonly unknown[] {
  return ["source", ...key, mode, forced];
}

/** What an action refreshes once it succeeds: each prefix under the seam's own root. */
export function invalidationKeys(
  prefixes: readonly (readonly unknown[])[] | undefined,
): readonly (readonly unknown[])[] {
  return (prefixes ?? []).map((prefix) => ["source", ...prefix]);
}

/**
 * The sample data never goes stale, a forced error is not tried again (it would only fail again,
 * slower), and nothing waits for signal, since nothing goes over the network. Api mode keeps the query
 * client's own defaults (`lib/query-client.ts`).
 */
export function queryDefaults(mode: DataMode): { staleTime?: number; retry?: false; networkMode?: "always" } {
  return mode === "mock" ? { staleTime: Number.POSITIVE_INFINITY, retry: false, networkMode: "always" } : {};
}

/** The same for writes: a sample data write never queues for signal. */
export function actionDefaults(mode: DataMode): { networkMode?: "always" } {
  return mode === "mock" ? { networkMode: "always" } : {};
}
