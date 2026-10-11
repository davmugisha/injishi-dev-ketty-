"use client";

/**
 * HR: the people who work here as EMPLOYEES — their records, the shifts they
 * work and when they clocked, onboarding checklists, leave and pay (HR module,
 * Phase 1 — first pass, no ADR yet).
 *
 * It opens on an OVERVIEW — what needs somebody today, each line a link to the
 * tab where it is done — because the tabs under it are each one job, and
 * "is there anything I need to do?" was answered by none of them.
 *
 * Roster and Attendance sit together, straight after Employees: one says who
 * is meant to be here and the other who is, and HR reads them as a pair.
 *
 * Four leaves used to sit in the nav for this — Payroll, Checklists, Leave, and
 * Employees as a tab inside Team & Departments — and "set this person up" crossed
 * all four. One route, four lenses, the same merge Finance and Inventory made
 * (ADR-018, move 5). The screens behind the lenses are unchanged; this only
 * gives them one home.
 *
 * **PAYROLL IS NOT FOR EVERYONE WHO REACHES THIS SCREEN.** The leaf opens on
 * `employee.manage`, which a manager holds; pay sits behind `team.manage`, which
 * is the owner's alone. So the Payroll lens is not offered to a manager rather
 * than being offered and then refusing, as `People` does with its roster. The
 * screen refuses inside as well for anyone who arrives by URL — the rail is an
 * affordance, and `WorkspaceGuard` is the control.
 */

import { LensPage, type LensLink } from "../components/lens-page";
import { Attendance } from "./attendance";
import { Checklists } from "./checklists";
import { Employees } from "./employees";
import { HrOverview } from "./hr-overview";
import { Leave } from "./leave";
import { Payroll } from "./payroll";
import { Roster } from "./roster";
import { useCapability, useWorkspaceId } from "../data/capability";
import { workspaceBase } from "../lib/nav";

export function Hr({ lens }: { lens: string }) {
  const workspaceId = useWorkspaceId();
  const { can } = useCapability();
  const base = `${workspaceBase(workspaceId)}/hr`;

  const lenses: LensLink[] = [
    { key: "overview", label: "Overview", href: base },
    { key: "employees", label: "Employees", href: `${base}/employees` },
    { key: "roster", label: "Roster", href: `${base}/roster` },
    { key: "attendance", label: "Attendance", href: `${base}/attendance` },
    { key: "checklists", label: "Checklists", href: `${base}/checklists` },
    { key: "leave", label: "Leave", href: `${base}/leave` },
    ...(can("team.manage")
      ? [{ key: "payroll", label: "Payroll", href: `${base}/payroll` }]
      : []),
  ];

  return (
    <LensPage lenses={lenses} active={lens}>
      {lens === "roster" ? (
        <Roster />
      ) : lens === "attendance" ? (
        <Attendance />
      ) : lens === "checklists" ? (
        <Checklists />
      ) : lens === "leave" ? (
        <Leave />
      ) : lens === "payroll" ? (
        <Payroll />
      ) : lens === "employees" ? (
        <Employees />
      ) : (
        <HrOverview />
      )}
    </LensPage>
  );
}
