"use client";

/**
 * Staff: everyone who works here, account or not, their files, shifts,
 * attendance, leave and pay (ADR-058).
 *
 * Nineteen lenses, each opened by the permission its own read needs
 * (`STAFF_LENSES` in `lib/nav.ts`, the one table). The leaf is reached by any
 * HR permission, so what is offered differs by person: an owner reaches all
 * nineteen, a manager everything but the owner's (documents, discipline,
 * payroll, the late and monthly insights and configuration), the desk Roster,
 * Rotations, Attendance, Kiosks, Policies, Announcements and Time settings. A
 * lens the grant does not reach is not offered, and typed by URL it says so
 * rather than opening empty.
 *
 * THE RAIL IS THE EIGHT GROUPS (`STAFF_GROUPS`), not the nineteen lenses: a
 * subject each, opening on the first lens of it the person reaches. The other
 * lenses of the open group are the row beneath, drawn as Leave and Payroll
 * draw their own sections, so every part of Staff is two rows deep and no
 * deeper. A group with one lens has no row.
 *
 * Overview is the first of them and the only one with no list of its own: it
 * is what the others hold that needs somebody today.
 */

import Link from "next/link";
import type { ComponentType } from "react";

import { cn } from "@/lib/utils";

import { LensPage, type LensLink } from "../../components/lens-page";
import { EmptyState } from "../../components/ui";
import { useWorkspaceId } from "../../data/capability";
import { STAFF_LENSES, staffGroups, workspaceBase } from "../../lib/nav";
import { usePms } from "../../store";
import { currentGrant } from "../../store/helpers";
import { Announcements } from "./announcements";
import { Attendance } from "./attendance";
import { AttendanceRequests } from "./attendance-requests";
import { Checklists } from "./checklists";
import { Configuration } from "./configuration";
import { Discipline } from "./discipline";
import { Documents } from "./documents";
import { Employees } from "./employees";
import { Kiosks } from "./kiosks";
import { Leave } from "./leave";
import { OrgChart } from "./org-chart";
import { Overview } from "./overview";
import { Payroll } from "./payroll";
import { Policies } from "./policies";
import { Roster } from "./roster";
import { Rotations } from "./rotations";
import { ShiftRequests } from "./shift-requests";
import { TimeInsights } from "./time-insights";
import { TimeSettings } from "./time-settings";

export type StaffLens = (typeof STAFF_LENSES)[number]["key"];

/** A lens may have sections of its own, each a route segment below it (Leave's, 058-leave). */
const LENS_SCREEN: Record<StaffLens, ComponentType<{ section?: string }>> = {
  overview: Overview,
  employees: Employees,
  "org-chart": OrgChart,
  documents: Documents,
  discipline: Discipline,
  checklists: Checklists,
  roster: Roster,
  rotations: Rotations,
  "shift-requests": ShiftRequests,
  attendance: Attendance,
  "attendance-requests": AttendanceRequests,
  kiosks: Kiosks,
  leave: Leave,
  payroll: Payroll,
  "time-insights": TimeInsights,
  policies: Policies,
  announcements: Announcements,
  "time-settings": TimeSettings,
  configuration: Configuration,
};

export function Staff({ lens, section }: { lens: StaffLens; section?: string }) {
  const { state } = usePms();
  const workspaceId = useWorkspaceId();
  const permissions = currentGrant(state)?.permissions ?? [];
  const groups = staffGroups(permissions);
  const reachable = groups.flatMap((g) => g.lenses);
  const base = `${workspaceBase(workspaceId)}/staff`;
  const hrefOf = (segment: string | undefined) => (segment ? `${base}/${segment}` : base);

  const links: LensLink[] = groups.map((g) => ({ key: g.key, label: g.label, href: hrefOf(g.lenses[0]?.segment) }));

  // `/staff` itself is the Employees lens. Somebody who cannot read files
  // (the desk) lands on their first lens instead of a refusal at the door.
  const active =
    lens === "employees" && !reachable.some((l) => l.key === "employees")
      ? (reachable[0]?.key ?? lens)
      : lens;
  const allowed = reachable.some((l) => l.key === active);
  const Screen = LENS_SCREEN[active];
  const group = STAFF_LENSES.find((l) => l.key === active)?.group;
  const beside = groups.find((g) => g.key === group)?.lenses ?? [];

  return (
    <LensPage lenses={links} active={group ?? ""}>
      {allowed && beside.length > 1 && (
        <nav aria-label="In this part of Staff" className="mb-4 flex flex-wrap items-center gap-2">
          {beside.map((l) => {
            const on = l.key === active;
            return (
              <Link
                key={l.key}
                href={hrefOf(l.segment)}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm font-semibold no-underline",
                  on ? "border-accent-text bg-accent-soft text-accent-text" : "border-card-bd bg-card text-ink2 hover:bg-hover",
                )}
              >
                {l.short ?? l.label}
              </Link>
            );
          })}
        </nav>
      )}
      {!allowed ? (
        <EmptyState style={{ padding: 26, fontSize: 13.5 }}>
          Your role does not open this part of Staff. An owner can change what your role allows in
          Team &amp; Departments.
        </EmptyState>
      ) : (
        <Screen section={section} />
      )}
    </LensPage>
  );
}
