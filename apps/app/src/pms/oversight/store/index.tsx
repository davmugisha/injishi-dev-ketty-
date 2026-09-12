"use client";

/**
 * The console's own store.
 *
 * THE DATA IS LIVE NOW. Queues come from `/api/v1/oversight/*` and gate verbs
 * post to `/api/v1/registrations/:id/*`. Officer chrome (name, seal, verb) still
 * comes from the static officer table — that is presentation, not authority.
 * Authority is the assignment `OversightGuard` already checked.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { humanError, isUnconfirmed } from "../../data/api";
import { useToastExpiry } from "../../lib/toast-queue";
import { OFFICERS, REJECT_REASONS } from "../data/oversight";
import {
  fetchQueue,
  passGate,
  rejectGate,
} from "../data/queue";
import type {
  Intent,
  Officer,
  OfficerKey,
  OversightData,
  RegOrg,
  RejectReason,
} from "../data/types";
import type { RegistrationRejectionReason } from "@injishi/contracts";

export interface Toast {
  id: number;
  txt: string;
  intent: Intent;
}

interface UiState {
  officerKey: OfficerKey;
  toasts: Toast[];
  toastSeq: number;
}

type UiAction =
  | { type: "setOfficer"; officerKey: OfficerKey }
  | { type: "toast"; txt: string; intent?: Intent }
  | { type: "dismissToast"; id: number };

function withToast(s: UiState, txt: string, intent: Intent = "ok"): UiState {
  const id = s.toastSeq + 1;
  return { ...s, toastSeq: id, toasts: [...s.toasts, { id, txt, intent }] };
}

function uiReducer(s: UiState, a: UiAction): UiState {
  switch (a.type) {
    case "setOfficer":
      return a.officerKey === s.officerKey ? s : { ...s, officerKey: a.officerKey };
    case "toast":
      return withToast(s, a.txt, a.intent ?? "ok");
    case "dismissToast":
      return { ...s, toasts: s.toasts.filter((t) => t.id !== a.id) };
  }
}

function queueKey(officerKey: OfficerKey) {
  return ["oversight", "queue", officerKey] as const;
}

export interface ConsoleContextValue {
  /** Toast + which console is open. */
  state: { officerKey: OfficerKey; toasts: Toast[]; toastSeq: number };
  dispatch: Dispatch<UiAction>;
  /** The dataset the screens read. Queue rows are live; chrome is static. */
  oversight: OversightData;
  officer: Officer;
  /** True while the live queue is still loading. */
  queueLoading: boolean;
  /** True when the live queue failed to load. */
  queueError: boolean;
  refetchQueue: () => void;
  toast: (txt: string, intent?: Intent) => void;
  /**
   * Pass the gate for this org. `onDecided` runs only when the server has
   * agreed — the sheet used to close on the press, so an officer watched a
   * file disappear and then read a refusal about a business they could no
   * longer see.
   */
  actOn: (orgId: string, onDecided?: () => void) => void;
  /** Refuse with a reason code. Same contract on `onDecided`. */
  reject: (orgId: string, reason: string, note: string, onDecided?: () => void) => void;
  acting: boolean;
}

const ConsoleContext = createContext<ConsoleContextValue | null>(null);

export function ConsoleProvider({
  officerKey,
  children,
}: {
  officerKey: OfficerKey;
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(uiReducer, {
    officerKey,
    toasts: [],
    toastSeq: 0,
  });
  const client = useQueryClient();

  useEffect(() => {
    dispatch({ type: "setOfficer", officerKey });
  }, [officerKey]);

  const queue = useQuery({
    queryKey: queueKey(officerKey),
    queryFn: () => fetchQueue(officerKey),
  });

  const pass = useMutation({
    mutationFn: (orgId: string) => passGate(officerKey, orgId),
    onSuccess: (summary) => {
      void client.invalidateQueries({ queryKey: queueKey(officerKey) });
      const verifying = officerKey === "verifier";
      dispatch({
        type: "toast",
        txt: verifying
          ? `Field-verified — ${summary.legalName} moves to the approval queue`
          : `Approved — ${summary.legalName} can list inventory`,
        intent: "ok",
      });
    },
    onError: (error) => {
      // Owned wording, and a warning rather than a refusal when we never heard
      // back: the decision may have been recorded (`data/api.ts`).
      dispatch({
        type: "toast",
        txt: humanError(error),
        intent: isUnconfirmed(error) ? "warn" : "bad",
      });
    },
  });

  const refuse = useMutation({
    mutationFn: ({
      orgId,
      reason,
      note,
    }: {
      orgId: string;
      reason: string;
      note: string;
    }) =>
      rejectGate(
        officerKey,
        orgId,
        reason as RegistrationRejectionReason,
        note || undefined,
      ),
    onSuccess: (summary) => {
      void client.invalidateQueries({ queryKey: queueKey(officerKey) });
      dispatch({
        type: "toast",
        txt: `Rejected — ${summary.legalName}. The registrant sees the reason and can resubmit.`,
        intent: "info",
      });
    },
    onError: (error) => {
      // Owned wording, and a warning rather than a refusal when we never heard
      // back: the decision may have been recorded (`data/api.ts`).
      dispatch({
        type: "toast",
        txt: humanError(error),
        intent: isUnconfirmed(error) ? "warn" : "bad",
      });
    },
  });

  // Each toast leaves on its own timer, sized to how long its words take to
  // read, oldest first (`lib/toast-queue.ts`).
  const dismissToast = useCallback((id: number) => dispatch({ type: "dismissToast", id }), []);
  useToastExpiry(state.toasts, dismissToast);

  const officer = OFFICERS[state.officerKey];
  const orgs: RegOrg[] = queue.data ?? [];

  const oversight: OversightData = useMemo(
    () => ({
      officers: OFFICERS,
      orgs,
      perf: [],
      rejectReasons: REJECT_REASONS as RejectReason[],
      decisions: [],
    }),
    [orgs],
  );

  const toast = useCallback(
    (txt: string, intent?: Intent) => dispatch({ type: "toast", txt, intent }),
    [],
  );

  const actOn = useCallback(
    (orgId: string, onDecided?: () => void) => {
      const org = orgs.find((o) => o.id === orgId);
      if (!org) return;
      if (org.blockedBySeparationOfDuties || org.fieldVerifiedBy === "you") {
        dispatch({
          type: "toast",
          txt: "You field-verified this business — a different officer must approve it.",
          intent: "bad",
        });
        return;
      }
      pass.mutate(orgId, { onSuccess: () => onDecided?.() });
    },
    [orgs, pass],
  );

  const reject = useCallback(
    (orgId: string, reason: string, note: string, onDecided?: () => void) => {
      refuse.mutate({ orgId, reason, note }, { onSuccess: () => onDecided?.() });
    },
    [refuse],
  );

  const value: ConsoleContextValue = {
    state,
    dispatch,
    oversight,
    officer,
    queueLoading: queue.isPending,
    queueError: queue.isError,
    refetchQueue: () => {
      void queue.refetch();
    },
    toast,
    actOn,
    reject,
    acting: pass.isPending || refuse.isPending,
  };

  return (
    <ConsoleContext.Provider value={value}>{children}</ConsoleContext.Provider>
  );
}

export function useConsole(): ConsoleContextValue {
  const ctx = useContext(ConsoleContext);
  if (!ctx) throw new Error("useConsole must sit inside ConsoleProvider");
  return ctx;
}
