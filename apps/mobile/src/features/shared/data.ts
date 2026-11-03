// The shared screens' reads and writes, on the mock/api seam (PLAN.md, "Data seam"). Only the outbox
// has a real source today: in api mode it reads the rows saved on this phone (`src/data/outbox`) and
// sends them with the real outbox; everything else is sample data, and "Not connected yet" in api mode.

import { useEffect } from "react";
import { dismiss, sendOutbox, useOutboxRows } from "@/data/outbox";
import { rowsOf } from "@/data/outbox/store";
import { useAction, useSource } from "@/data/source";
import { outboxViewOf } from "@/features/outbox/outbox-view";
import { clockOffsetMs } from "@/lib/clock";
import { isMock } from "@/lib/data-mode";
import { kigaliTime } from "@/lib/kigali";
import { useSession } from "@/lib/session";
import type { AppKey } from "@/proto/screens";
import {
  askSupport,
  choosePlace,
  confirmDelete,
  dismissOutboxItem,
  emptyNotifs,
  emptyOutbox,
  markNotifsRead,
  mockAccount,
  mockDelete,
  mockHelp,
  mockNotifs,
  mockOutbox,
  mockSwitcher,
  mockTestPayment,
  sendOutboxNow,
  sendTestPayment,
  setAccountNotifications,
  signOutDevice,
} from "./mock-data";
import type { OutboxView, Place } from "./types";

// ---------------------------------------------------------------- switcher

export function useSwitcher(app: AppKey) {
  return useSource(["shared", "switcher", app], { mock: () => mockSwitcher(app) });
}

/** Choose a place; the screen then opens its app. */
export function useChoosePlace() {
  return useAction<{ from: AppKey; placeId: string }, Place | null>({
    mock: (input) => choosePlace(input),
    invalidates: [["shared", "switcher"]],
  });
}

// ---------------------------------------------------------------- staff inbox

export function useNotifications(app: AppKey) {
  return useSource(["shared", "notifs", app], { mock: () => mockNotifs(app), empty: () => emptyNotifs(app) });
}

/** Mark one row read (it was opened), or all of them. */
export function useMarkNotifsRead() {
  return useAction<{ app: AppKey; id?: string }>({
    mock: (input) => markNotifsRead(input),
    invalidates: [["shared", "notifs"]],
  });
}

// ---------------------------------------------------------------- outbox

/**
 * What is on this phone. Sample data mode: the prototype's rows. Api mode: the signed in account's
 * real rows, read again whenever the outbox changes (a send, a refusal, a new write).
 */
export function useOutbox() {
  const { account } = useSession();
  const userId = isMock ? null : (account?.userId ?? null);
  // The outbox store's own subscription.
  const rows = useOutboxRows(userId);
  const query = useSource<OutboxView>(["shared", "outbox", userId ?? "signed-out"], {
    mock: () => mockOutbox(),
    empty: () => emptyOutbox(),
    api: async () => outboxViewOf(userId ? rowsOf(userId) : [], clockOffsetMs(), userId !== null),
  });
  const { refetch } = query;
  // A changed row list (each change is a new array) reads the view again; sample data has no rows.
  useEffect(() => {
    if (!isMock && rows) void refetch();
  }, [rows, refetch]);
  return query;
}

/** "Try sending now": the real outbox tries every waiting write at once. */
export function useSendOutboxNow() {
  return useAction<void, void>({
    mock: () => sendOutboxNow(kigaliTime(Date.now())),
    api: async () => {
      await sendOutbox("try_now");
    },
    invalidates: [["shared", "outbox"]],
  });
}

/** Dismiss a refused write: it is deleted; the writes behind it already went on. */
export function useDismissOutboxItem() {
  return useAction<string, void>({
    mock: (id) => dismissOutboxItem(id),
    api: async (id) => dismiss(id),
    invalidates: [["shared", "outbox"]],
  });
}

// ---------------------------------------------------------------- account

export function useAccount(app: AppKey) {
  return useSource(["shared", "account", app], { mock: () => mockAccount(app) });
}

export function useSetNotifications() {
  return useAction<{ push?: boolean; email?: boolean }>({
    mock: (input) => setAccountNotifications(input),
    invalidates: [["shared", "account"]],
  });
}

export function useSignOutDevice() {
  return useAction<string>({ mock: (id) => signOutDevice(id), invalidates: [["shared", "account"]] });
}

/** "Download my data": the file is put together and emailed. */
export function useRequestDataExport() {
  return useAction<void, void>({ mock: () => undefined });
}

// ---------------------------------------------------------------- delete account

export function useDeleteInfo(app: AppKey) {
  return useSource(["shared", "delete", app], { mock: () => mockDelete(app) });
}

/** Delete the account with the emailed code; false when the code is not six digits. */
export function useDeleteAccount() {
  return useAction<string, boolean>({ mock: (code) => confirmDelete(code) });
}

// ---------------------------------------------------------------- help

export function useHelp(app: AppKey) {
  return useSource(["shared", "help", app], { mock: () => mockHelp(app) });
}

export function useAskSupport() {
  return useAction({ mock: (text: string) => askSupport(text), invalidates: [["shared", "help"]] });
}

// ---------------------------------------------------------------- test money

export function useTestPayment() {
  return useSource(["shared", "test-money"], { mock: () => mockTestPayment() });
}

export function useSendTestPayment() {
  return useAction({ mock: () => sendTestPayment(), invalidates: [["shared", "test-money"]] });
}
