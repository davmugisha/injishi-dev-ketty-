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
 * **NO INVITE BUTTON ON THIS LENS**, and the one that used to pretend is gone.
 * Adding somebody is its own flow with its own decisions — who may send one, how
 * it is delivered, what happens when an account that already holds a different
 * role accepts it — and that flow is the Invites lens beside this one
 * (`screens/invites.tsx`, `/ops/team/invitations`). This lens links to it rather
 * than growing a second way in.
 *
 * **BRANCHES** (ADR-054 AC-T1). In a hotel with more than one branch, each
 * member shows the branches they cover, and the owner may limit a member to some
 * of them or give every branch back. An owner always covers every branch, so
 * their row offers no change. The API enforces the limit on every ops read.
 *
 * A REMOVED member is shown, dimmed, rather than filtered out. The membership
 * is never deleted, because the rows they posted and charged still name them.
 */

import {
  MEMBER_BRANCHES_REFUSAL,
  type MemberBranchIds,
  type OperatorTeamMember,
  type OrgRole,
} from "@injishi/contracts";
import Link from "next/link";
import { useState } from "react";

import { BranchPicker, coverageText } from "../components/branch-picker";
import {
  ActionButton,
  Badge,
  EmptyState,
  Initials,
  LoadFailed,
  SectionHeading,
  Skeleton,
} from "../components/ui";
import { humanError } from "../data/api";
import { useCapability, useWorkspaceId } from "../data/capability";
import { useTeam } from "../data/ops";
import { useSetMemberBranches } from "../data/setup";
import { dshortIso, initials } from "../lib/format";
import { workspaceBase } from "../lib/nav";
import { usePms } from "../store";
import { currentGrant } from "../store/helpers";

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
  // ADR-069 D-b. Each note is the role's working day, after the Roles board,
  // cut to what its default set can actually do.
  finance: {
    label: "Finance",
    note: "Posts charges and payments, closes bills",
    intent: "info",
  },
  hr: {
    label: "HR",
    note: "Roster, leave and attendance; drafts the pay run",
    intent: "info",
  },
  housekeeper: {
    label: "Housekeeper",
    note: "Room status and maintenance only",
    intent: "neutral",
  },
};

/** Owner first, then down. The order the refusals stack in. */
const ORDER: OrgRole[] = ["owner", "manager", "receptionist", "finance", "hr", "housekeeper"];

export function Team({ landlord = false }: { landlord?: boolean }) {
  const { state, toast } = usePms();
  const workspaceId = useWorkspaceId();
  const { can, reasonFor } = useCapability();
  const query = useTeam(workspaceId);
  const setBranches = useSetMemberBranches(workspaceId);
  const [editing, setEditing] = useState<{ userId: string; branchIds: MemberBranchIds } | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const base = workspaceBase(workspaceId);
  const showsDepartments = !landlord && state.ws !== "landlord";
  const branches = currentGrant(state)?.branches ?? [];
  const showsBranches = showsDepartments && branches.length > 1;

  const saveBranches = () => {
    if (!editing) return;
    setEditError(null);
    if (editing.branchIds !== null && editing.branchIds.length === 0) {
      return setEditError(MEMBER_BRANCHES_REFUSAL.empty);
    }
    setBranches.mutate(editing, {
      onSuccess: (m) => {
        setEditing(null);
        toast(`${m.name ?? m.email ?? "Member"} now covers ${coverageText(m.branchIds, branches)}`, "ok");
      },
      onError: (err) => setEditError(humanError(err)),
    });
  };

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
    const open = editing?.userId === m.userId;
    const mayLimit = showsBranches && live && m.orgRole !== "owner";
    return (
      <div
        key={m.userId}
        data-member={m.email ?? m.userId}
        style={{
          padding: "12px 18px",
          borderTop: i === 0 ? "1px solid transparent" : "1px solid var(--line)",
          opacity: live ? 1 : 0.55,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
            {showsBranches && (
              <span data-coverage style={{ display: "block", fontSize: 11.5, color: "var(--muted)" }}>
                {coverageText(m.branchIds, branches)}
              </span>
            )}
          </span>
          <span style={{ textAlign: "right", minWidth: 0 }}>
            <Badge intent={role.intent}>{role.label}</Badge>
            <span style={{ display: "block", marginTop: 3, fontSize: 11, color: "var(--faint)" }}>
              {live ? role.note : "Removed"}
            </span>
          </span>
          {mayLimit && !open && (
            <ActionButton
              onClick={() => {
                setEditError(null);
                setEditing({ userId: m.userId, branchIds: m.branchIds });
              }}
            >
              Branches
            </ActionButton>
          )}
        </div>
        {open && editing && (
          <form
            className="mt-3 flex flex-col gap-3 border-t border-line pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              saveBranches();
            }}
          >
            <BranchPicker
              name={`branches-${m.userId}`}
              branches={branches}
              value={editing.branchIds}
              onChange={(branchIds) => setEditing({ userId: m.userId, branchIds })}
            />
            {editError && (
              <p role="alert" className="text-sm text-danger">
                {editError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <ActionButton type="button" onClick={() => setEditing(null)}>
                Cancel
              </ActionButton>
              <ActionButton variant="primary" type="submit" pending={setBranches.isPending}>
                {setBranches.isPending ? "Saving" : "Save branches"}
              </ActionButton>
            </div>
          </form>
        )}
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
        To add somebody, send them an invitation from{" "}
        <Link href={`${base}/people/invites`} className="underline" data-link="invites">
          Invites
        </Link>
        . They join with the role you choose once they accept.
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
