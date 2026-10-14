import { BOARDS, type BoardId, canAccess, homeHref, screens } from "@injishi/data";
import type { HubGroup, HubRole } from "@injishi/data/fixtures/platform";
import { getCollection } from "@injishi/db";
import type { Metadata } from "next";
import { HubView } from "@/features/platform/HubView";
import { requireScreen } from "@/lib/session";

export const metadata: Metadata = { title: screens.Main.pageTitle };

/** Prototype hub: every role of the artifact, opening its workspace (sign-in first when needed). */
export default async function HubPage() {
  const persona = await requireScreen("Main");
  const [groups, roles] = await Promise.all([
    getCollection<HubGroup>("platform.hubGroups"),
    getCollection<HubRole>("platform.hubRoles"),
  ]);
  const target = (board: BoardId) => {
    const s = screens[board];
    if (s.persona === null || (persona && canAccess(persona.id, board))) return s.href;
    // Sign in as the persona the screen was designed for, then land on it.
    return `/sign-in?as=${s.persona}&next=${encodeURIComponent(s.href)}`;
  };
  const hrefs = Object.fromEntries(BOARDS.map((b) => [b, target(b)])) as Record<BoardId, string>;
  return (
    <HubView
      data={{
        groups: [...groups].sort((a, b) => a.order - b.order),
        roles,
        hrefs,
        screenCount: BOARDS.length - 1,
        signedInAs: persona ? { name: persona.name, home: homeHref(persona.id) } : null,
      }}
    />
  );
}
