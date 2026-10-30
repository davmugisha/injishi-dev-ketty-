import { navigation, tabbars } from "./navigation.ts";
import { type Persona, personas } from "./personas.ts";
import { BOARDS, screens } from "./screens.ts";
import type { BoardId, NavGroup, PersonaId, PhoneTab, ScreenEntry, WorkspacePersonaId } from "./types.ts";

export * from "./navigation.ts";
export * from "./personas.ts";
export * from "./screens.ts";
export type * from "./types.ts";

/** Link target of a board, e.g. screenHref("CheckIn") → "/check-in". */
export function screenHref(board: BoardId): string {
  return screens[board].href;
}

const patterns = BOARDS.map((board) => {
  const route = screens[board].route;
  const source = `^${route.replace(/\[[^\]]+\]/g, "[^/]+")}$`;
  return { board, re: new RegExp(source), dynamic: route.includes("[") };
}).sort((a, b) => Number(a.dynamic) - Number(b.dynamic));

/** The registry entry for a pathname (static routes win over dynamic ones). */
export function screenByPath(pathname: string): ScreenEntry | undefined {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const hit = patterns.find((p) => p.re.test(clean));
  return hit ? screens[hit.board] : undefined;
}

/** The `[name]` parameters of the screen at `pathname`, by name: `/home/abc/lease` gives `{ leaseId: "abc" }`. */
export function routeParams(pathname: string): Record<string, string> {
  const screen = screenByPath(pathname);
  if (!screen?.route.includes("[")) return {};
  const names = [...screen.route.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]);
  const re = new RegExp(`^${screen.route.replace(/\[[^\]]+\]/g, "([^/]+)")}$`);
  const match = re.exec(pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname);
  if (!match) return {};
  return Object.fromEntries(names.map((name, i) => [name, decodeURIComponent(match[i + 1] ?? "")]));
}

/**
 * Where a sidebar item links, from where the person is: a board whose route names a parameter
 * (`/home/[leaseId]/lease`) takes it from the current pathname when the screen there has the same one;
 * a parameter nothing fills cuts the link short (`/home`), where the page picks for them.
 */
export function navHref(board: BoardId, pathname: string): string {
  const route = screens[board].route;
  if (!route.includes("[")) return screens[board].href;
  const params = routeParams(pathname);
  const parts = route.split("/");
  const out: string[] = [];
  for (const part of parts) {
    const m = /^\[([^\]]+)\]$/.exec(part);
    if (!m) {
      out.push(part);
      continue;
    }
    const value = params[m[1]];
    if (!value) break;
    out.push(encodeURIComponent(value));
  }
  return out.join("/") || "/";
}

/** Screens any signed-in person may open. */
export const SHARED_BOARDS: readonly BoardId[] = [
  "Account",
  "Notifications",
  "GlobalSearch",
  "Assistant",
  "AccessDenied",
  "PublicHelp",
  "Training",
];

const BUSINESS_STAFF: readonly PersonaId[] = [
  "manager",
  "frontdesk",
  "finance",
  "hr",
  "store",
  "landlord",
  "outlet",
  "waiter",
  "housekeeper",
  "supervisor",
  "technician",
];
const MANAGER_SEES: readonly PersonaId[] = ["frontdesk", "outlet", "waiter", "housekeeper", "supervisor", "technician"];

export function navigationFor(persona: PersonaId): NavGroup[] {
  return (navigation as Record<string, NavGroup[]>)[persona] ?? [];
}

export function tabsFor(persona: Persona): PhoneTab[] {
  return persona.app.kind === "phone" ? tabbars[persona.app.app] : [];
}

export function isWorkspacePersona(id: PersonaId): id is WorkspacePersonaId {
  return id in navigation;
}

/** Whether a persona may open a screen. Public screens are open to everyone. */
export function canAccess(personaId: PersonaId | null | undefined, board: BoardId): boolean {
  const screen = screens[board];
  if (screen.persona === null) return true;
  if (!personaId) return false;
  const persona = personas[personaId];
  if (SHARED_BOARDS.includes(board)) return true;
  if (screen.persona === personaId || persona.home === board) return true;
  if (persona.access?.includes(board)) return true;
  if (persona.tryItems.some((t) => t.board === board)) return true;
  if (navigationFor(personaId).some((g) => g.items.some((i) => i.board === board))) return true;
  if (tabsFor(persona).some((t) => t.board === board)) return true;
  if (personaId === "owner" && BUSINESS_STAFF.includes(screen.persona)) return true;
  if (personaId === "manager" && MANAGER_SEES.includes(screen.persona)) return true;
  return false;
}

/** Where a persona lands after sign-in. */
export function homeHref(personaId: PersonaId): string {
  return screens[personas[personaId].home].href;
}
