import type { Persona } from "@injishi/data/personas";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { loadSession, signOut as signOutOfApi } from "./auth";

type Status = "loading" | "signed-in" | "signed-out" | "unreachable";

interface SessionValue {
  /** `loading` until the stored session has been checked; screens render nothing until then. */
  status: Status;
  persona: Persona | null;
  /** Ask again who is signed in (after a code or Google sign-in). */
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionValue>({
  status: "loading",
  persona: null,
  refresh: async () => {},
  signOut: async () => {},
});

/**
 * Who is signed in on this phone, resolved by the API (`lib/auth.ts`). An unreachable API is not a
 * sign-out: the person keeps the shell they last had, so a housekeeper in a basement keeps their list.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [persona, setPersona] = useState<Persona | null>(null);

  const refresh = useCallback(async () => {
    const state = await loadSession();
    setStatus(state.status);
    setPersona(state.status === "signed-out" ? null : state.persona);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await signOutOfApi();
    setStatus("signed-out");
    setPersona(null);
  }, []);

  const value = useMemo(() => ({ status, persona, refresh, signOut }), [status, persona, refresh, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  return useContext(SessionContext);
}
