import { navigationFor } from "@injishi/data";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { WorkspaceShell } from "@/components/shell/WorkspaceShell";
import { currentPersona } from "@/lib/session";
import { officerNav, officerPersona } from "@/server/oversight/nav";
import { landlordNav } from "@/server/rentals/nav";

/** Desktop workspace: sidebar navigation of the signed-in persona around every operator screen. */
export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const persona = await currentPersona();
  if (!persona) redirect("/sign-in");
  // A landlord's sidebar follows their permissions and the business's counts (server/rentals/nav.ts).
  // An officer's or local leader's sidebar follows the seats they hold (server/oversight/nav.ts).
  let nav =
    persona.id === "landlord"
      ? await landlordNav()
      : persona.id === "officer"
        ? await officerNav()
        : navigationFor(persona.id);
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
  // An officer's or leader's header names their own seat, not the persona's sample one.
  const shown = persona.id === "officer" ? await officerPersona(persona) : persona;
  return (
    <WorkspaceShell persona={shown} nav={nav}>
      {children}
    </WorkspaceShell>
  );
}

export const dynamic = "force-dynamic";
