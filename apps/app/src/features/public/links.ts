import { type BoardId, canAccess, homeHref, type Persona, screenHref, screens } from "@injishi/data";
import type { PublicVisitor } from "./PublicChrome";

/** Link targets for demo screens, by board. */
export type DemoLinks = Partial<Record<BoardId, string>>;

/**
 * Where links from a public page to demo screens go for this visitor: straight to the
 * screen when it is public or the visitor may open it, otherwise to sign-in with the persona the screen was
 * designed for, landing on the screen afterwards.
 */
export function demoLinks(persona: Persona | null, boards: readonly BoardId[]): DemoLinks {
  const out: DemoLinks = {};
  for (const board of boards) {
    const s = screens[board];
    out[board] =
      s.persona === null || (persona && canAccess(persona.id, board))
        ? screenHref(board)
        : `${screenHref("SignIn")}?as=${s.persona}&next=${encodeURIComponent(s.href)}`;
  }
  return out;
}

/** The signed-in visitor of a public page (shown instead of "Sign in"), or null. */
export function visitorOf(persona: Persona | null): PublicVisitor | null {
  return persona ? { name: persona.name, home: homeHref(persona.id) } : null;
}
