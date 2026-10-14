import { type Persona, personas } from "@injishi/data/personas";
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { currentPersonaId, signOutStore } from "./store";

interface SessionValue {
  persona: Persona | null;
  /** Re-read the signed-in persona from the device database (after verifying a code). */
  refresh: () => void;
  signOut: () => void;
}

const SessionContext = createContext<SessionValue>({ persona: null, refresh: () => {}, signOut: () => {} });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [personaId, setPersonaId] = useState(() => currentPersonaId());
  const refresh = useCallback(() => setPersonaId(currentPersonaId()), []);
  const signOut = useCallback(() => {
    signOutStore();
    setPersonaId(null);
  }, []);
  const value = useMemo(
    () => ({ persona: personaId ? personas[personaId] : null, refresh, signOut }),
    [personaId, refresh, signOut],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  return useContext(SessionContext);
}
