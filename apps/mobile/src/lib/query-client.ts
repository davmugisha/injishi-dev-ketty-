// The phone's read cache (mobile spec 0003, D-o, D-i, D-v, D-ae): TanStack Query, with the last good
// copy of each read kept on the phone for its account, so a housekeeper in a basement still sees their
// shift. Writes never go through here; they go through the outbox.

import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { focusManager, onlineManager, QueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import * as Network from "expo-network";
import { SQLiteStorage } from "expo-sqlite/kv-store";
import { AppState } from "react-native";
import { ApiError } from "@/data/fetch";

/**
 * Bump by hand whenever a persisted read's contract changes shape (`me-work`, `today`, `my-day`), so an
 * old copy is dropped rather than misread.
 */
export const CACHE_VERSION = 1;

/** How long a kept copy may be restored. `gcTime` must be at least this, or restored data is dropped. */
export const CACHE_MAX_AGE_MS = 24 * 3_600_000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Today refetches on focus without hammering a weak link.
      staleTime: 30_000,
      gcTime: CACHE_MAX_AGE_MS,
      // Only "no answer" is tried again, at most twice: a refusal or a sign out is an answer.
      retry: (failures, error) => error instanceof ApiError && error.kind === "failed" && !error.parse && failures < 2,
      retryDelay: (attempt) => (attempt === 0 ? 1_000 : 3_000),
      refetchOnWindowFocus: true,
      // A read tries once even when the phone says it is offline: the radio often lies.
      networkMode: "offlineFirst",
    },
  },
});

// "On return to the app" (D-v): TanStack's focus is the app coming to the foreground.
focusManager.setEventListener((handleFocus) => {
  const subscription = AppState.addEventListener("change", (state) => handleFocus(state === "active"));
  return () => subscription.remove();
});

// Online state from expo-network (D-ae): only an explicit `false` counts as offline.
onlineManager.setEventListener((setOnline) => {
  const subscription = Network.addNetworkStateListener((state) => setOnline(state.isConnected !== false));
  return () => subscription.remove();
});

/** The kept copies live in their own SQLite file, apart from the fixture store and the outbox. */
const cacheStorage = new SQLiteStorage("injishi-cache.db");

function cacheKey(userId: string): string {
  return `rq:${userId}`;
}

/** One account's persister: its copy is kept under its own key, never read by another account. */
export function persisterFor(userId: string) {
  return createAsyncStoragePersister({ storage: cacheStorage, key: cacheKey(userId), throttleTime: 1_000 });
}

/** The persister's buster: the app version and `CACHE_VERSION`. */
export const CACHE_BUSTER = `${Constants.expoConfig?.version ?? "0"}:${CACHE_VERSION}`;

/** Only successful reads marked `meta.persist` are kept (`me-work`, `today`, `my-day`). */
export function keepsQuery(query: { state: { status: string }; meta?: Record<string, unknown> }): boolean {
  return query.state.status === "success" && query.meta?.persist === true;
}

/** Delete an account's kept copy. */
export async function forgetCache(userId: string): Promise<void> {
  await cacheStorage.removeItem(cacheKey(userId)).catch(() => {});
}
