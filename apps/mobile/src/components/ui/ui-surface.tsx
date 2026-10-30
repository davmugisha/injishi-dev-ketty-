import { createContext, type ReactNode, useContext } from "react";

export type UiSurfaceKind = "staff" | "desk" | "guest" | "resident" | "manager";

const UiSurfaceContext = createContext<UiSurfaceKind | null>(null);

/**
 * Which app a screen belongs to (mobile spec 0002, D-o). Staff and desk work fast, often one
 * handed and in gloves, so their buttons default to 56 high; every other surface, and a screen
 * outside any surface, defaults to 48. A button's own `size` always wins.
 */
export function UiSurface({ kind, children }: { kind: UiSurfaceKind; children: ReactNode }) {
  return <UiSurfaceContext.Provider value={kind}>{children}</UiSurfaceContext.Provider>;
}

export function useButtonSize(): "md" | "lg" {
  const kind = useContext(UiSurfaceContext);
  return kind === "staff" || kind === "desk" ? "lg" : "md";
}
