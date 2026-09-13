"use client";

/**
 * Services: one department's job, in one place (ADR-018, AC-12).
 *
 * `orders` and `menu` were two leaves for the same department. They are lenses
 * now, with Departments and Outlets beside them. Outlets (ADR-050 slice 4)
 * sits here because an outlet is where a department sells from.
 *
 * The nav still shows this only where a service department exists, exactly as
 * `hostNav` already decided. A two department guesthouse gets no Services, and
 * the merge kept that conditional rather than flattening it.
 */

import { LensPage, type LensLink } from "../components/lens-page";
import { Departments } from "./departments";
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
    { key: "departments", label: "Departments", href: `${base}/departments` },
    { key: "outlets", label: "Outlets", href: `${base}/outlets` },
  ];

  return (
    <LensPage lenses={lenses} active={lens}>
      {lens === "menu" ? (
        <Menu />
      ) : lens === "departments" ? (
        <Departments />
      ) : lens === "outlets" ? (
        <Outlets />
      ) : (
        <Orders />
      )}
    </LensPage>
  );
}
