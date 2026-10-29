import { type NavGroup, navigationFor } from "@injishi/data";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { WorkspaceShell } from "@/components/shell/WorkspaceShell";
import { MessagesLive } from "@/features/messages/MessagesLive";
import { sampleCollectionsByBoard } from "@/lib/coverage.generated";
import { currentAccount } from "@/lib/session";
import { brokerNav } from "@/server/broker/nav";
import { officerNav, officerPersona } from "@/server/oversight/nav";
import { landlordScope } from "@/server/rentals/client";
import { landlordNav } from "@/server/rentals/nav";
import { staysNav } from "@/server/stays/nav";
import { tenantNav } from "@/server/tenant/nav";

/**
 * Injishi staff see only the screens that read real records, without the sample counts on the items:
 * a screen still drawing on the fixture store is not offered.
 */
function realScreensOnly(groups: NavGroup[]): NavGroup[] {
  return groups
    .map((g) => ({
      ...g,
      items: g.items
        .filter((i) => (sampleCollectionsByBoard[i.board] ?? 0) === 0)
        .map(({ chip: _chip, alert: _alert, ...item }) => item),
    }))
    .filter((g) => g.items.length > 0);
}

/** Desktop workspace: sidebar navigation of the signed-in persona around every operator screen. */
export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const account = await currentAccount();
  const persona = account?.persona;
  if (!persona) redirect("/sign-in");
  // A landlord's sidebar follows their permissions and the business's counts (server/rentals/nav.ts).
  // An officer's or local leader's sidebar follows the seats they hold (server/oversight/nav.ts).
  const stays =
    persona.id === "owner" || persona.id === "manager"
      ? await staysNav(persona.id === "manager" ? "ManagerToday" : "OwnerHome")
      : null;
  let nav =
    persona.id === "landlord"
      ? await landlordNav()
      : persona.id === "officer"
        ? await officerNav()
        : persona.id === "tenant"
          ? await tenantNav()
          : persona.id === "broker"
            ? await brokerNav()
            : persona.id === "ops"
              ? realScreensOnly(navigationFor("ops"))
              : persona.id === "owner" || persona.id === "manager"
                ? // A stay business's menu follows how it is run (server/stays/nav.ts); a bar keeps its own.
                  ((await staysNav(persona.id === "manager" ? "ManagerToday" : "OwnerHome")) ??
                  navigationFor(persona.id))
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
  // A landlord who also rents a home reads it under /home with the tenant's sidebar (the switcher's "My home").
  const altNav =
    persona.id === "landlord" && (account.context?.tenancies.length ?? 0) > 0
      ? { prefix: "/home", nav: await tenantNav() }
      : null;
  // An officer's or leader's header names their own seat, not the persona's sample one.
  const shown = persona.id === "officer" ? await officerPersona(persona) : persona;
  return (
    <WorkspaceShell persona={shown} nav={nav} altNav={altNav} live={stays !== null}>
      {children}
      {/* Message counts in the sidebar follow new lines live (P3.4). */}
      {persona.id === "landlord" ? (
        <MessagesLive
          workspaceId={(await landlordScope())?.workspace.workspaceId ?? null}
          unreadPath="/api/messages/ops/rentals/messages/unread"
        />
      ) : persona.id === "tenant" ? (
        <MessagesLive workspaceId={null} unreadPath="/api/messages/me/tenancies/messages/unread" />
      ) : persona.id === "broker" ? (
        <MessagesLive workspaceId={null} unreadPath="/api/messages/ops/broker/messages/unread" />
      ) : null}
    </WorkspaceShell>
  );
}

export const dynamic = "force-dynamic";
