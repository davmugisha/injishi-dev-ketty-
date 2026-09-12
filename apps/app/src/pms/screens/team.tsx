"use client";

/**
 * Team (F-P08) — who works here.
 *
 * **On real data** (ADR-035, wave 2 follow-up). Reads `GET /api/v1/ops/team`,
 * an endpoint that did not exist until this wave found it missing.
 *
 * **THE GAP THIS CLOSES.** `org_memberships` is the row that says somebody works
 * at a business, and no controller read it for anybody but the caller —
 * `WorkspaceService` used it to resolve your own grant and stopped. So the
 * operator app had no way to list its own staff, and this screen used to show
 * four departments of invented people above an "Invite someone" button that
 * raised a toast. An owner would have believed those were their staff.
 *
 * **THE ROLE IS THE POINT, NOT DECORATION.** `orgRole` is the same field
 * `permissionsForWorkspace` resolves every refusal from, so this list is the one
 * place an owner can see WHY their receptionist cannot open Finance. A roster
 * without it would be an address book. The badge names what the role can do
 * rather than repeating the enum.
 *
 * **THE READ IS GATED ON `team.manage`**, unusually for this app. Most `/ops`
 * reads need only the workspace, because a receptionist has to see rooms and
 * threads to work. This one enumerates every colleague and their email: a
 * disclosure rather than operational data, and it belongs to the two roles that
 * may change the team.
 *
 * **STILL NO INVITE**, and the button that pretended otherwise is gone. Adding
 * somebody is its own flow with its own decisions — who may send one, how it is
 * delivered, what happens when an account that already holds a different role
 * accepts it. A bare "add member" writing an `org_memberships` row would skip
 * all of them.
 *
 * A REMOVED member is shown, dimmed, rather than filtered out. The membership
 * is never deleted, because the rows they posted and charged still name them.
 */

import type { OperatorTeamMember, OrgRole } from "@injishi/contracts";
import Link from "next/link";

import {
  ActionButton,
  Badge,
  EmptyState,
  Initials,
  LoadFailed,
  SectionHeading,
  Skeleton,
} from "../components/ui";
import { useCapability, useWorkspaceId } from "../data/capability";
import { useTeam } from "../data/ops";
import { dshortIso, initials } from "../lib/format";
import { workspaceBase } from "../lib/nav";
import { usePms } from "../store";

/**
 * What a role MEANS, not what it is called.
 *
 * The enum value is already on screen as the heading; repeating it in the badge
 * would tell an owner nothing they did not just read. What they actually need to
 * know is the surface it opens, which is what every refusal is decided from.
 */
const ROLE: Record<OrgRole, { label: string; note: string; intent: "accent" | "info" | "neutral" }> = {
  owner: { label: "Owner", note: "Everything, including Settings", intent: "accent" },
  manager: { label: "Manager", note: "Everything except Settings", intent: "accent" },
  receptionist: {
    label: "Receptionist",
    note: "Front desk and service orders only",
    intent: "info",
  },
  housekeeper: {
    label: "Housekeeper",
    note: "Room status and maintenance only",
    intent: "neutral",
  },
};

/** Owner first, then down. The order the refusals stack in. */
const ORDER: OrgRole[] = ["owner", "manager", "receptionist", "housekeeper"];

export function Team({ landlord = false }: { landlord?: boolean }) {
  const { state } = usePms();
  const workspaceId = useWorkspaceId();
  const { can, reasonFor } = useCapability();
  const query = useTeam(workspaceId);

  const base = workspaceBase(workspaceId);
  const showsDepartments = !landlord && state.ws !== "landlord";

  if (!can("team.manage")) {
    return (
      <EmptyState style={{ padding: 26, fontSize: 13.5 }}>{reasonFor("team.manage")}</EmptyState>
    );
  }

  if (query.isPending) {
    return (
      <div className="pms-enter flex max-w-wide flex-col gap-4">
        <Skeleton height={40} />
        <Skeleton height={200} delay={60} />
      </div>
    );
  }

  if (query.isError) {
    /* An unreachable API is not a business with no staff. Told that, an owner
       would think everyone had been removed. */
    return (
      <LoadFailed onRetry={() => void query.refetch()} retrying={query.isFetching}>
        We couldn&apos;t load your team. Everybody still holds the access they had — this
        is on our side, not an empty business.
      </LoadFailed>
    );
  }

  const members = query.data?.members ?? [];
  const active = members.filter((m) => m.status === "active");
  const removed = members.filter((m) => m.status !== "active");

  const row = (m: OperatorTeamMember, i: number, live: boolean) => {
    const role = ROLE[m.orgRole];
    return (
      <div
        key={m.userId}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 18px",
          borderTop: i === 0 ? "1px solid transparent" : "1px solid var(--line)",
          opacity: live ? 1 : 0.55,
        }}
      >
        <Initials size={34}>{initials(m.name ?? m.email ?? "?")}</Initials>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>
            {/* A membership can exist before its person has a profile. An
                invited account that never signed in is a real row, and hiding
                it would hide the invitation. */}
            {m.name ?? "Not signed in yet"}
          </span>
          <span style={{ display: "block", fontSize: 11.5, color: "var(--muted)" }}>
            {[m.email, `joined ${dshortIso(m.joinedAt)}`].filter(Boolean).join(" · ")}
          </span>
        </span>
        <span style={{ textAlign: "right", minWidth: 0 }}>
          <Badge intent={role.intent}>{role.label}</Badge>
          <span style={{ display: "block", marginTop: 3, fontSize: 11, color: "var(--faint)" }}>
            {live ? role.note : "Removed"}
          </span>
        </span>
      </div>
    );
  };

  return (
    <div className="pms-enter flex max-w-wide flex-col gap-4">
      <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
        A person&apos;s role is what every refusal in this app is decided from. A
        department is separate: it sets what they see day to day.
      </span>

      <section>
        <SectionHeading n={active.length}>Working here</SectionHeading>
        {active.length === 0 ? (
          <EmptyState className="mt-2.5 p-6">
            Nobody holds a role in this business yet.
          </EmptyState>
        ) : (
          <div
            style={{
              marginTop: 10,
              background: "var(--card)",
              border: "1px solid var(--card-bd)",
              borderRadius: "var(--radius-surface)",
              overflow: "hidden",
            }}
          >
            {[...active]
              .sort((a, b) => ORDER.indexOf(a.orgRole) - ORDER.indexOf(b.orgRole))
              .map((m, i) => row(m, i, true))}
          </div>
        )}
      </section>

      {removed.length > 0 && (
        <section>
          <SectionHeading n={removed.length}>No longer here</SectionHeading>
          <div
            style={{
              marginTop: 10,
              background: "var(--card)",
              border: "1px solid var(--card-bd)",
              borderRadius: "var(--radius-surface)",
              overflow: "hidden",
            }}
          >
            {removed.map((m, i) => row(m, i, false))}
          </div>
        </section>
      )}

      <p className="text-2xs text-muted-foreground">
        Inviting somebody is not built yet — it is its own flow, and a button that
        wrote a membership row would skip every decision in it.
        {showsDepartments && (
          <>
            {" "}
            <Link href={`${base}/people/departments`} className="underline">
              Departments
            </Link>{" "}
            is live on the lens beside this one.
          </>
        )}
      </p>
    </div>
  );
}
