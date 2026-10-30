import type { Persona } from "@injishi/data/personas";
import * as SecureStore from "expo-secure-store";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { setOutboxAccount } from "@/data/outbox";
import { wipeAccount } from "@/data/wipe";
import { type Account, forgetStepUp, keepStepUp, loadSession, signOut as signOutOfApi } from "./auth";
import { isReturnPath } from "./return-path";
import { sessionEvents } from "./session-events";
import { resetWelcome } from "./welcome";

type Status = "loading" | "signed-in" | "signed-out" | "unreachable";

interface SessionValue {
  /** `loading` until the stored session has been checked; screens render nothing until then. */
  status: Status;
  persona: Persona | null;
  /** The ids every cache key and outbox row is scoped to (mobile spec 0003, D-ah); null when unknown. */
  account: Account | null;
  /** The emailed step up is owed by this session and not yet presented (D-b). */
  stepUpOwed: boolean;
  /** Ask again who is signed in (after a code or Google sign-in). */
  refresh: () => Promise<void>;
  /** The step up code was accepted: keep it for offline starts and carry on. */
  stepUpVerified: () => void;
  /** Delete everything this account left on the phone, then sign out (`useSignOut` asks first). */
  signOut: () => Promise<void>;
  /**
   * Before opening sign in from a guest screen: where to come back to (mobile spec 0005, D-av). Kept in
   * memory and in secure storage, so a Google round trip that restarts the app still finds it. Only a
   * `/guest/` path is kept (the allowlist).
   */
  setPendingReturn: (path: string) => void;
  /** The kept path, once: it is cleared as it is read. The start route reads it when the session is ready. */
  takePendingReturn: () => string | null;
}

interface State {
  status: Status;
  persona: Persona | null;
  account: Account | null;
}

const SessionContext = createContext<SessionValue>({
  status: "loading",
  persona: null,
  account: null,
  stepUpOwed: false,
  refresh: async () => {},
  stepUpVerified: () => {},
  signOut: async () => {},
  setPendingReturn: () => {},
  takePendingReturn: () => null,
});

/** Secure storage key of the pending return. Not a secret, but it is where the person was. */
const RETURN_KEY = "return.pending";

/**
 * Who is signed in on this phone, resolved by the API (`lib/auth.ts`). An unreachable API is not a
 * sign-out: the person keeps the shell and account they last had, so a housekeeper in a basement keeps
 * their shift. A 401 from any read or send asks again; `403 two_factor_required` opens the step up.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: "loading", persona: null, account: null });
  const pendingReturn = useRef<string | null>(null);

  const setPendingReturn = useCallback((path: string) => {
    if (!isReturnPath(path)) return;
    pendingReturn.current = path;
    try {
      SecureStore.setItem(RETURN_KEY, path);
    } catch {
      // The memory copy still serves a sign in that keeps the app running.
    }
  }, []);

  const takePendingReturn = useCallback((): string | null => {
    let path = pendingReturn.current;
    if (!path) {
      try {
        path = SecureStore.getItem(RETURN_KEY);
      } catch {
        path = null;
      }
    }
    pendingReturn.current = null;
    void SecureStore.deleteItemAsync(RETURN_KEY).catch(() => {});
    return isReturnPath(path) ? path : null;
  }, []);

  const refresh = useCallback(async () => {
    const next = await loadSession();
    if (next.status === "signed-out") setState({ status: "signed-out", persona: null, account: null });
    else setState({ status: next.status, persona: next.persona, account: next.account });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // The API said the session ended: ask again, which lands on sign in. The outbox keeps its rows.
  useEffect(() => sessionEvents.on("signedOut", () => void refresh()), [refresh]);

  // The API asked for the step up: forget any code this phone kept and open the screen (AC-1).
  useEffect(
    () =>
      sessionEvents.on("stepUp", () => {
        forgetStepUp();
        setState((s) =>
          s.account ? { ...s, account: { ...s.account, twoFactor: { required: true, verified: false } } } : s,
        );
      }),
    [],
  );

  const stepUpVerified = useCallback(() => {
    setState((s) => {
      if (!s.account) return s;
      keepStepUp(s.account.sessionId);
      return { ...s, account: { ...s.account, twoFactor: { ...s.account.twoFactor, verified: true } } };
    });
  }, []);

  const userId = state.account?.userId;
  const signOut = useCallback(async () => {
    setOutboxAccount(null);
    if (userId) await wipeAccount(userId);
    await signOutOfApi();
    // The welcome shows again after a sign out (mobile spec 0005, D-b), and nothing waits to return.
    resetWelcome();
    pendingReturn.current = null;
    void SecureStore.deleteItemAsync(RETURN_KEY).catch(() => {});
    setState({ status: "signed-out", persona: null, account: null });
  }, [userId]);

  const value = useMemo<SessionValue>(
    () => ({
      ...state,
      stepUpOwed: !!state.account?.twoFactor.required && !state.account.twoFactor.verified,
      refresh,
      stepUpVerified,
      signOut,
      setPendingReturn,
      takePendingReturn,
    }),
    [state, refresh, stepUpVerified, signOut, setPendingReturn, takePendingReturn],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  return useContext(SessionContext);
}
