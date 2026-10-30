// Real data under the screens (mobile spec 0003, features 5 and 6): the read cache, restored for the
// signed in account only, and the outbox, sending that account's writes while the app is open.

import { onlineManager, QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { type ReactNode, useEffect, useMemo, useRef } from "react";
import { AppState } from "react-native";
import { lastAccount } from "@/lib/auth";
import { clockOffsetMs, serverNow } from "@/lib/clock";
import { kigaliDate } from "@/lib/kigali";
import { CACHE_BUSTER, CACHE_MAX_AGE_MS, keepsQuery, persisterFor, queryClient } from "@/lib/query-client";
import { useSession } from "@/lib/session";
import { resumeOutbox, sendOutbox, setOutboxAccount } from "./outbox";
import { notifyOutbox } from "./outbox/notify";
import { purgeable } from "./outbox/rules";
import { deleteRow, requeueInterrupted, rowsOf } from "./outbox/store";
import { wipeOtherAccounts } from "./wipe";

export function DataProvider({ children }: { children: ReactNode }) {
  const { account, stepUpOwed } = useSession();
  const userId = account?.userId ?? null;
  useOutbox(userId, stepUpOwed);

  const persistOptions = useMemo(
    () =>
      userId
        ? {
            persister: persisterFor(userId),
            maxAge: CACHE_MAX_AGE_MS,
            buster: CACHE_BUSTER,
            dehydrateOptions: { shouldDehydrateQuery: keepsQuery },
          }
        : null,
    [userId],
  );

  if (!persistOptions) return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  // Keyed by account: a new account restores its own copy, never the last one's.
  return (
    <PersistQueryClientProvider key={userId} client={queryClient} persistOptions={persistOptions}>
      {children}
    </PersistQueryClientProvider>
  );
}

/** Whose rows send, and when (D-j): at start, when signal returns, on return to the app. */
function useOutbox(userId: string | null, stepUpOwed: boolean): void {
  // The account this phone last had, read before the first refresh replaces it.
  const previous = useRef<string | null>(lastAccount()?.userId ?? null);

  useEffect(() => {
    if (!userId) {
      setOutboxAccount(null);
      return;
    }
    void wipeOtherAccounts(userId, previous.current);
    previous.current = userId;
    prepareOnce(userId);
    setOutboxAccount(userId);
    // A session that owes the step up sends nothing until the code is in (AC-1).
    if (!stepUpOwed) resumeOutbox();
  }, [userId, stepUpOwed]);

  useEffect(() => {
    if (!userId) return;
    const offline = onlineManager.subscribe((online) => {
      if (online) void sendOutbox("online");
    });
    const app = AppState.addEventListener("change", (state) => {
      if (state === "active") void sendOutbox("active");
    });
    return () => {
      offline();
      app.remove();
    };
  }, [userId]);
}

let prepared = false;

/**
 * Once per app start: a row a kill left `sending` goes back to `queued`, and sent rows from an earlier
 * Kigali day are deleted.
 */
function prepareOnce(userId: string): void {
  if (prepared) return;
  prepared = true;
  requeueInterrupted();
  for (const row of purgeable(rowsOf(userId), kigaliDate(serverNow()), clockOffsetMs())) deleteRow(row.id);
  notifyOutbox();
}
