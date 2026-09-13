"use client";

/**
 * People: who works here (ADR-018, AC-12, AC-13).
 *
 * Was `team`, which named the group rather than the people in it, and carried
 * the department axis inside one screen. Three lenses now, in both workspaces.
 */

import { LensPage, type LensLink } from "../components/lens-page";
import { Departments } from "./departments";
import { Invites } from "./invites";
import { Team } from "./team";
import { useWorkspaceId } from "../data/capability";
import { workspaceBase } from "../lib/nav";
import { usePms } from "../store";

export function People({ lens }: { lens: string }) {
  const { state } = usePms();
  const workspaceId = useWorkspaceId();
  const base = `${workspaceBase(workspaceId)}/people`;
  const landlord = state.ws === "landlord";

  const lenses: LensLink[] = [
    { key: "team", label: "Team", href: base },
    // A residence portfolio has no departments to run, so the lens it would
    // open is not offered rather than opened empty.
    ...(landlord
      ? []
      : [{ key: "departments", label: "Departments", href: `${base}/departments` }]),
    { key: "invites", label: "Invites", href: `${base}/invites` },
  ];

  return (
    <LensPage lenses={lenses} active={lens}>
      {lens === "departments" ? (
        <Departments />
      ) : lens === "invites" ? (
        <Invites landlord={landlord} />
      ) : (
        <Team landlord={landlord} />
      )}
    </LensPage>
  );
}
