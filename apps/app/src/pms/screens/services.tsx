"use client";

/**
 * Services: one department's job, in one place (ADR-018, AC-12).
 *
 * `orders` and `menu` were two leaves for the same department. They are lenses
 * now, with Outlets beside them: an outlet is where a department sells from
 * (ADR-050 slice 4).
 *
 * **DEPARTMENTS IS NOT HERE ANY MORE** (ADR-055). It sat beside these three and
 * read as "the restaurant's settings", while a department is the bucket ALL
 * departmental revenue reports in and the queue every order routes to — Rooms
 * and Engineering included. A hotel with no service department got no Services
 * section at all, and so had nowhere to see its own departments. It lives under
 * Team & Departments now. The old address still resolves: see
 * `app/w/[workspaceId]/services/departments/page.tsx`.
 *
 * The nav still shows this only where a service department exists, exactly as
 * `hostNav` already decided. A two department guesthouse gets no Services, and
 * the merge kept that conditional rather than flattening it.
 */

import { LensPage, type LensLink } from "../components/lens-page";
import { Menu } from "./menu";
import { Orders } from "./orders";
import { Outlets } from "./outlets";
import { useWorkspaceId } from "../data/capability";
import { workspaceBase } from "../lib/nav";

export function Services({ lens }: { lens: string }) {
  const workspaceId = useWorkspaceId();
  const base = `${workspaceBase(workspaceId)}/services`;

  const lenses: LensLink[] = [
    { key: "orders", label: "Live orders", href: base },
    { key: "menu", label: "Menu & pricing", href: `${base}/menu` },
    { key: "outlets", label: "Outlets", href: `${base}/outlets` },
  ];

  return (
    <LensPage lenses={lenses} active={lens}>
      {lens === "menu" ? (
        <Menu />
      ) : lens === "outlets" ? (
        <Outlets />
      ) : (
        <Orders />
      )}
    </LensPage>
  );
}
