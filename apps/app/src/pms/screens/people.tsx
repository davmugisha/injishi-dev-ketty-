"use client";

/**
 * Team & Departments: who works here, what each role may do, and which
 * departments the property runs (ADR-018 AC-12/AC-13, ADR-055).
 *
 * Was `team`, which named the group rather than the people in it, and carried
 * the department axis inside one screen.
 *
 * **DEPARTMENTS CAME BACK FROM SERVICES** (ADR-055). It had a second home under
 * Services, beside the menu and live orders, which read as "the restaurant's
 * settings" — while a department is the bucket ALL departmental revenue reports
 * in and the queue every order routes to, Rooms and Engineering included. A
 * hotel with no service department got no Services section at all, so it had
 * nowhere to see its own departments. One home now, here, and the old Services
 * address redirects into it.
 *
 * **ROLES IS NEW** and sits between the two on purpose: the middle question
 * between "who works here" and "which departments do we run" is "what may each
 * of them do". It is the one screen where a business edits the permission model
 * rather than reading a refusal from it.
 *
 * **NOT EVERY LENS IS FOR EVERYONE WHO REACHES THIS SCREEN**, and that is the
 * cost of the move rather than an oversight. Under Services, Departments opened
 * to anyone who could work an order; here the leaf admits either `team.manage`
 * or `department.manage` (`navFor`), so a manager arrives holding the second and
 * not the first. The roster and Roles are disclosures about people and stay with
 * the owner: they are not offered to a manager rather than being offered and
 * then refusing, because a tab that always says no is a worse answer than no
 * tab. Both screens refuse inside as well — the rail is an affordance, and
 * `WorkspaceGuard` is the control.
 *
 * NOTE: the Employees screen (job titles, HR facts) moved out of this tab and
 * into its own HR section (screens/hr.tsx), alongside Checklists, Leave and
 * Payroll — one place for HR work rather than split across two sections. This
 * tab is back to being the plain staff roster it was before that experiment.
 */

import { LensPage, type LensLink } from "../components/lens-page";
import { Departments } from "./departments";
import { Invites } from "./invites";
import { Roles } from "./roles";
import { Team } from "./team";
import { useCapability, useWorkspaceId } from "../data/capability";
import { workspaceBase } from "../lib/nav";
import { usePms } from "../store";

export function People({ lens }: { lens: string }) {
  const { state } = usePms();
  const workspaceId = useWorkspaceId();
  const { can } = useCapability();
  const base = `${workspaceBase(workspaceId)}/people`;
  const landlord = state.ws === "landlord";

  const showsDepartments = !landlord;
  const managesTeam = can("team.manage");

  const lenses: LensLink[] = [
    ...(managesTeam ? [{ key: "team", label: "Team", href: base }] : []),
    ...(showsDepartments
      ? [{ key: "departments", label: "Departments", href: `${base}/departments` }]
      : []),
    ...(managesTeam
      ? [
          { key: "roles", label: "Roles", href: `${base}/roles` },
          { key: "invites", label: "Invites", href: `${base}/invites` },
        ]
      : []),
  ];

  const active = lens === "team" && !managesTeam && showsDepartments ? "departments" : lens;

  return (
    <LensPage lenses={lenses} active={active}>
      {active === "departments" ? (
        <Departments />
      ) : active === "roles" ? (
        <Roles />
      ) : active === "invites" ? (
        <Invites landlord={landlord} />
      ) : (
        <Team landlord={landlord} />
      )}
    </LensPage>
  );
}
