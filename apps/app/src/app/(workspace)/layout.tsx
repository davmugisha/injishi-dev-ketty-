import { type NavGroup, navigationFor, personaByEmail } from "@injishi/data";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { WorkspaceShell } from "@/components/shell/WorkspaceShell";
import { MessagesLive } from "@/features/messages/MessagesLive";
import { sampleCollectionsByBoard } from "@/lib/coverage.generated";
import { openToRealPeople } from "@/lib/real-screens";
import { currentAccount } from "@/lib/session";
import { brokerNav } from "@/server/broker/nav";
import { businessNav } from "@/server/business/nav";
import { appointsPsfTeam, officerNav, officerPersona, psfWaitingByBoard, withWaitingCounts } from "@/server/oversight/nav";
import { landlordScope } from "@/server/rentals/client";
import { landlordNav } from "@/server/rentals/nav";
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

/** The shells a hotel's owner and manager wear: their sidebar is built from their own business. */
const BUSINESS_SHELLS: ReadonlySet<string> = new Set(["owner", "manager"]);

/**
 * The sidebar's counts come from the design boards ("Reservations 12"). They are the demo persona's
 * story, so a real owner, whose new hotel has no bookings, sees the items without them.
 */
function withoutSampleCounts(groups: NavGroup[]): NavGroup[] {
  return groups.map((g) => ({ ...g, items: g.items.map(({ chip: _chip, alert: _alert, ...item }) => item) }));
}

/**
 * Dual-hat owners (business + PSF/officer) keep the membership portal in the
 * sidebar after their own business goes active. `personaFor` switches the shell
 * to owner for setup/ops; without this, Membership / Fees / Subtypes vanish
 * even though `access` still allows `/psf`.
 */
function withOversightNav(nav: NavGroup[], persona: { id: string; access?: readonly string[] }): NavGroup[] {
  const access = persona.access;
  // The PSF console's own sidebar already lists these.
  if (!access?.length || persona.id === "psf" || persona.id === "psfdbo") return nav;
  const allowed = new Set(access);
  const extras: NavGroup[] = [];
  if (allowed.has("PsfConsole") || allowed.has("PsfReport")) {
    const items = navigationFor("psf")
      .flatMap((g) => g.items)
      .filter((i) => allowed.has(i.board));
    if (items.length) {
      extras.push({
        label: "PSF membership",
        items: items.map((i) => ({ ...i, id: `psf-${i.id}` })),
      });
    }
  } else if (allowed.has("OfficerHome")) {
    extras.push({
      label: "Oversight",
      items: [{ id: "officer-home", label: "Registrations", icon: "ShieldCheck", board: "OfficerHome" }],
    });
  }
  return extras.length ? [...nav, ...extras] : nav;
}

/** Desktop workspace: sidebar navigation of the signed-in persona around every operator screen. */
export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const account = await currentAccount();
  const persona = account?.persona;
  if (!persona) redirect("/sign-in");
  // A landlord's sidebar follows their permissions and the business's counts (server/rentals/nav.ts).
  // An officer's or local leader's sidebar follows the seats they hold (server/oversight/nav.ts).
  let nav =
    persona.id === "landlord"
      ? await landlordNav()
      : persona.id === "officer"
        ? await officerNav()
        : (persona.id === "psf" || persona.id === "psfdbo") && personaByEmail(account.user.email)?.id !== persona.id
          ? realScreensOnly(navigationFor(persona.id))
          : persona.id === "tenant"
            ? await tenantNav()
            : persona.id === "broker"
              ? await brokerNav()
              : persona.id === "ops"
                ? realScreensOnly(navigationFor("ops"))
                : personaByEmail(account.user.email)?.id === persona.id
                  ? navigationFor(persona.id)
                  : ((BUSINESS_SHELLS.has(persona.id) ? await businessNav(account) : null) ??
                    // A real person's sidebar lists only the screens that show their own records.
                    withoutSampleCounts(navigationFor(persona.id))
                      .map((g) => ({ ...g, items: g.items.filter((i) => openToRealPeople(i.board)) }))
                      .filter((g) => g.items.length > 0));
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
  const shown = persona.id === "officer" || persona.id === "psf" || persona.id === "psfdbo" ? await officerPersona(persona) : persona;
  nav = withOversightNav(nav, persona);
  // Team is the Province Manager's screen (2026-11-02): a District Manager or DBO does not see it.
  if ((persona.id === "psf" || persona.id === "psfdbo") && !(await appointsPsfTeam())) {
    nav = nav.map((g) => ({ ...g, items: g.items.filter((i) => i.board !== "PsfTeam") })).filter((g) => g.items.length > 0);
  }
  // What waits on a PSF officer, counted beside each queue (2026-11-02).
  if (persona.id === "psf" || persona.id === "psfdbo") nav = withWaitingCounts(nav, await psfWaitingByBoard());
  return (
    <WorkspaceShell persona={shown} nav={nav} altNav={altNav} demo={personaByEmail(account.user.email)?.id === persona.id}>
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
