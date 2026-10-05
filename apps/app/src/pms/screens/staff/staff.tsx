"use client";

/**
 * Staff: everyone who works here, account or not, their files, shifts,
 * attendance, leave and pay (ADR-058).
 *
 * Eleven lenses, each opened by the permission its own read needs
 * (`STAFF_LENSES` in `lib/nav.ts`, the one table). The leaf is reached by any
 * HR permission, so the rail differs by person: an owner sees all eleven, a
 * manager everything but the owner's (documents, discipline, payroll and
 * configuration), the desk Roster, Attendance, Policies and Announcements. A
 * lens the grant does not reach is not offered, and typed by URL it says so
 * rather than opening empty.
 */

import type { ComponentType } from "react";

import { LensPage, type LensLink } from "../../components/lens-page";
import { EmptyState } from "../../components/ui";
import { useWorkspaceId } from "../../data/capability";
import { staffLenses, workspaceBase, type STAFF_LENSES } from "../../lib/nav";
import { usePms } from "../../store";
import { currentGrant } from "../../store/helpers";
import { Announcements } from "./announcements";
import { Attendance } from "./attendance";
import { Configuration } from "./configuration";
import { Discipline } from "./discipline";
import { Documents } from "./documents";
import { Employees } from "./employees";
import { Leave } from "./leave";
import { OrgChart } from "./org-chart";
import { Payroll } from "./payroll";
import { Policies } from "./policies";
import { Roster } from "./roster";

export type StaffLens = (typeof STAFF_LENSES)[number]["key"];

const LENS_SCREEN: Record<StaffLens, ComponentType> = {
  employees: Employees,
  "org-chart": OrgChart,
  documents: Documents,
  discipline: Discipline,
  roster: Roster,
  attendance: Attendance,
  leave: Leave,
  payroll: Payroll,
  policies: Policies,
  announcements: Announcements,
  configuration: Configuration,
};

export function Staff({ lens }: { lens: StaffLens }) {
  const { state } = usePms();
  const workspaceId = useWorkspaceId();
  const permissions = currentGrant(state)?.permissions ?? [];
  const reachable = staffLenses(permissions);
  const base = `${workspaceBase(workspaceId)}/staff`;

  const links: LensLink[] = reachable.map((l) => ({
    key: l.key,
    label: l.label,
    href: l.segment ? `${base}/${l.segment}` : base,
  }));

  // `/staff` itself is the Employees lens. Somebody who cannot read files
  // (the desk) lands on their first lens instead of a refusal at the door.
  const active =
    lens === "employees" && !reachable.some((l) => l.key === "employees")
      ? (reachable[0]?.key ?? lens)
      : lens;
  const allowed = reachable.some((l) => l.key === active);
  const Screen = LENS_SCREEN[active];

  return (
    <LensPage lenses={links} active={active}>
      {!allowed ? (
        <EmptyState style={{ padding: 26, fontSize: 13.5 }}>
          Your role does not open this part of Staff. An owner can change what your role allows in
          Team &amp; Departments.
        </EmptyState>
      ) : (
        <Screen />
      )}
    </LensPage>
  );
}
