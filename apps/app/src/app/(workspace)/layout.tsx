import { navigationFor } from "@injishi/data";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { WorkspaceShell } from "@/components/shell/WorkspaceShell";
import { currentPersona } from "@/lib/session";
import { landlordNav } from "@/server/rentals/nav";

/** Desktop workspace: sidebar navigation of the signed-in persona around every operator screen. */
export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const persona = await currentPersona();
  if (!persona) redirect("/sign-in");
  // A landlord's sidebar follows their permissions and the business's counts (server/rentals/nav.ts).
  let nav = persona.id === "landlord" ? await landlordNav() : navigationFor(persona.id);
  if (nav.length === 0) {
    // Phone/tablet personas visiting a desktop screen they may open: home plus "what to try".
    nav = [
      {
        label: null,
        items: [
          { id: "home", label: "My app", icon: "House", board: persona.home },
          ...persona.tryItems.map((t) => ({ id: t.board, label: t.label, icon: "ArrowRight", board: t.board })),
        ],
      },
    ];
  }
  return (
    <WorkspaceShell persona={persona} nav={nav}>
      {children}
    </WorkspaceShell>
  );
}

export const dynamic = "force-dynamic";
