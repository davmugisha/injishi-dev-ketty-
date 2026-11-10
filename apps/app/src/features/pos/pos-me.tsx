"use client";

import { createContext, type ReactNode, useContext } from "react";

/** Who is signed in on this POS screen: shown in the sidebar's user card (presentation only; the API decides). */
export interface PosMe {
  name: string;
  role: string;
}

const PosMeContext = createContext<PosMe | null>(null);

export function PosMeProvider({ me, children }: { me: PosMe | null; children: ReactNode }) {
  return <PosMeContext.Provider value={me}>{children}</PosMeContext.Provider>;
}

export function usePosMe(): PosMe | null {
  return useContext(PosMeContext);
}

/** "CU" for Claudine Uwase. */
export function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  const two = (parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "");
  return two.toUpperCase() || "?";
}
