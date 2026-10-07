"use client";

/**
 * People · Invites: put staff on the business (2026-09-13; six roles, ADR-069).
 *
 * The owner names an email address and a role; the API mails a single use
 * link, and the membership is written only when that address signs in and
 * accepts on web's join page. The role is the whole of what the invitation
 * grants: what a finance member may do is still `permissionsForWorkspace`, the
 * same table every refusal is worded from, with this business's own changes to
 * the role applied (ADR-055).
 *
 * **THE ROLE IS CHOSEN FROM CARDS, NOT A DROPDOWN.** Each card carries the
 * role's working day (`ROLE_COPY`, after the Roles board), because "Finance"
 * and "Manager" are both somebody who handles money, and the difference is the
 * whole reason an accountant has a role of their own. Under the cards, the
 * chosen role's access AT THIS BUSINESS is read from `GET /ops/roles`, so the
 * owner sees what they are handing over, changes included, before the mail
 * goes. That read and this screen are both `team.manage`'s.
 *
 * Behind `team.manage`, the owner's. Owner is shown and not offered: ownership
 * changes hands through the owner claim, which checks an identity document.
 *
 * A hotel with more than one branch also chooses which branches the invitee
 * will cover (ADR-054 AC-T1), copied onto the membership when they accept. A
 * residence business has no branches, so the choice never shows there.
 */

import {
  InvitableOrgRole,
  MEMBER_BRANCHES_REFUSAL,
  ORG_ROLE_LABEL,
  PERMISSION_LABEL,
  Permission,
  type MemberBranchIds,
  type OperatorStaffInvitation,
} from "@injishi/contracts";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";

import {
  ActionButton,
  Badge,
  EmptyState,
  LoadFailed,
  SectionHeading,
  Skeleton,
  surfaceClass,
} from "../components/ui";
import { BranchPicker, coverageText } from "../components/branch-picker";
import { departures, sayPermissions } from "../components/roles/permission-rows";
import { OWNER_NOT_INVITABLE, ROLE_COPY } from "../components/roles/role-copy";
import { humanError } from "../data/api";
import { useCapability, useWorkspaceId } from "../data/capability";
import { useRoles } from "../data/ops";
import { useInviteStaff, useRevokeStaffInvitation, useStaffInvitations } from "../data/setup";
import { dshortIso } from "../lib/format";
import { workspaceBase } from "../lib/nav";
import { usePms } from "../store";
import { currentGrant } from "../store/helpers";

/**
 * What a residence business may invite. The desk and the housekeeping phone are
 * a hotel's; an accountant and an HR officer exist in every business domain
 * (ADR-069 D-a), so a landlord may invite them beside a manager.
 */
const LANDLORD_ROLES: readonly InvitableOrgRole[] = ["manager", "finance", "hr"];

const STATUS: Record<OperatorStaffInvitation["status"], { text: string; intent: "ok" | "info" | "neutral" | "warn" }> = {
  sent: { text: "Waiting to accept", intent: "info" },
  accepted: { text: "Accepted", intent: "ok" },
  revoked: { text: "Withdrawn", intent: "neutral" },
  expired: { text: "Expired", intent: "warn" },
};

const inputClass = "h-10 w-full rounded border border-line2 bg-field px-3 text-sm text-foreground";

/**
 * What a role may do here, in one sentence an owner reads before the mail
 * goes. Whichever list is shorter is the one named: the accountant's seven
 * permissions by name, the manager's thirty one as "everything except" the
 * four it does not hold. Thirty one verbs in a row is a wall nobody reads, and
 * the four exceptions are exactly what an owner inviting a manager needs to
 * know.
 */
function accessSentence(label: string, held: readonly Permission[]): string {
  if (held.length === 0) return `At this business, ${label} may do nothing yet.`;
  const missing = Permission.options.filter((p) => !held.includes(p));
  if (missing.length === 0) return `At this business, ${label} may do everything.`;
  if (missing.length < held.length) {
    return `At this business, ${label} may do everything except ${sayPermissions(missing, PERMISSION_LABEL)}.`;
  }
  return `At this business, ${label} may ${sayPermissions(held, PERMISSION_LABEL)}.`;
}

export function Invites({ landlord }: { landlord: boolean }) {
  const workspaceId = useWorkspaceId();
  const { state, toast, toastError } = usePms();
  const { can, reasonFor } = useCapability();
  const managesTeam = can("team.manage");
  const query = useStaffInvitations(managesTeam ? workspaceId : null);
  const access = useRoles(workspaceId);
  const invite = useInviteStaff(workspaceId);
  const revoke = useRevokeStaffInvitation(workspaceId);
  const roles = InvitableOrgRole.options.filter((r) => !landlord || LANDLORD_ROLES.includes(r));
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InvitableOrgRole>(landlord ? "manager" : "receptionist");
  const [branchIds, setBranchIds] = useState<MemberBranchIds>(null);
  const [error, setError] = useState<string | null>(null);
  const branches = currentGrant(state)?.branches ?? [];
  const choosesBranches = !landlord && branches.length > 1;

  if (!managesTeam) {
    return <EmptyState className="p-6 text-sm">{reasonFor("team.manage")}</EmptyState>;
  }

  const submit = () => {
    setError(null);
    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return setError("Use an email address like name@example.com.");
    const limit = choosesBranches ? branchIds : null;
    if (limit !== null && limit.length === 0) return setError(MEMBER_BRANCHES_REFUSAL.empty);
    invite.mutate(
      { email: address, orgRole: role, branchIds: limit },
      {
        onSuccess: () => {
          setEmail("");
          setBranchIds(null);
          toast(`Invitation sent to ${address} as ${ORG_ROLE_LABEL[role]}`, "ok");
        },
        onError: (err) => setError(humanError(err)),
      },
    );
  };

  const invitations = query.data?.invitations ?? [];
  const pending = invitations.filter((i) => i.status === "sent");
  const past = invitations.filter((i) => i.status !== "sent");

  /* The chosen role as this business has it: the server's two arrays, compared
     here and resolved nowhere. */
  const chosen = access.data?.roles.find((r) => r.orgRole === role);
  const changed = chosen
    ? (() => {
        const d = departures(Permission.options, chosen.basePermissions, chosen.permissions);
        return d.granted.length + d.withdrawn.length;
      })()
    : 0;
  const rolesHref = `${workspaceBase(workspaceId)}/people/roles`;

  const row = (inv: OperatorStaffInvitation, i: number) => {
    const s = STATUS[inv.status];
    const busy = revoke.isPending && revoke.variables === inv.id;
    return (
      <li
        key={inv.id}
        data-invitation={inv.email}
        className={cn("flex flex-wrap items-center gap-3 px-4 py-3", i > 0 && "border-t border-line")}
      >
        <span className="flex min-w-0 flex-1 basis-56 flex-col">
          <span className="truncate text-sm font-semibold text-ink">{inv.email}</span>
          <span className="text-2xs text-muted-foreground">
            {ORG_ROLE_LABEL[inv.orgRole]}
            {choosesBranches ? ` · ${coverageText(inv.branchIds, branches)}` : ""} · sent {dshortIso(inv.createdAt)}
            {inv.status === "sent" ? ` · expires ${dshortIso(inv.expiresAt)}` : ""}
          </span>
        </span>
        <Badge intent={s.intent}>{s.text}</Badge>
        {inv.status === "sent" && (
          <ActionButton
            pending={busy}
            onClick={() =>
              revoke.mutate(inv.id, {
                onSuccess: () => toast(`Invitation to ${inv.email} withdrawn`, "ok"),
                onError: toastError,
              })
            }
          >
            Withdraw
          </ActionButton>
        )}
      </li>
    );
  };

  return (
    <div className="pms-enter flex max-w-page flex-col gap-5" data-screen="invites">
      <form
        className={cn(surfaceClass, "flex flex-col gap-4 p-4")}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-ink">Invite a staff member</span>
          <span className="text-2xs text-muted-foreground">
            They get a link by email, and join with the role you choose once they sign in with that address.
            Until then the invitation sits below, under Waiting to accept.
          </span>
        </span>

        <label className="flex max-w-form flex-col gap-1.5 text-sm">
          <span className="font-semibold text-ink">Email</span>
          <input
            aria-label="Staff email"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className={inputClass}
          />
        </label>

        <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0" data-role-picker>
          <legend className="pb-1.5 text-sm font-semibold text-ink">Role</legend>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {roles.map((r) => {
              const on = role === r;
              return (
                <label
                  key={r}
                  data-role-option={r}
                  className={cn(
                    "flex cursor-pointer items-start gap-2.5 rounded border px-3 py-2.5",
                    on ? "border-accent-text bg-accent-soft" : "border-line2 bg-field hover:bg-hover",
                  )}
                >
                  <input
                    type="radio"
                    name="invite-role"
                    value={r}
                    checked={on}
                    onChange={() => setRole(r)}
                    className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className={cn("text-sm font-semibold", on ? "text-accent-soft-foreground" : "text-foreground")}>
                      {ORG_ROLE_LABEL[r]}
                    </span>
                    <span className={cn("text-2xs", on ? "text-accent-soft-foreground" : "text-muted-foreground")}>
                      {ROLE_COPY[r].everyDay}
                    </span>
                  </span>
                </label>
              );
            })}
            {/* Shown, never offered: an owner looking for "how do I add a
                co-owner" finds the answer where they looked for the button. */}
            <label
              data-role-option="owner"
              aria-disabled="true"
              className="flex cursor-not-allowed items-start gap-2.5 rounded border border-dashed border-line2 px-3 py-2.5"
            >
              <input
                type="radio"
                name="invite-role"
                value="owner"
                disabled
                checked={false}
                readOnly
                className="mt-0.5 size-4 shrink-0"
              />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-semibold text-muted-foreground">{ORG_ROLE_LABEL.owner}</span>
                <span className="text-2xs text-muted-foreground">{OWNER_NOT_INVITABLE}</span>
              </span>
            </label>
          </div>

          <p className="text-xs text-muted-foreground" aria-live="polite" data-role-access={role}>
            {chosen ? (
              <>
                {accessSentence(chosen.label, chosen.permissions)}
                {changed > 0 && ` That includes ${changed === 1 ? "1 change" : `${changed} changes`} you made to the standard access.`}{" "}
                <Link href={rolesHref} className="underline underline-offset-2">
                  Change what {chosen.label} may do
                </Link>
              </>
            ) : access.isError ? (
              <>We couldn&apos;t load what {ORG_ROLE_LABEL[role]} may do here. The invitation still works.</>
            ) : (
              <>Loading what {ORG_ROLE_LABEL[role]} may do here.</>
            )}
          </p>
        </fieldset>

        {choosesBranches && (
          <BranchPicker name="invite-branches" branches={branches} value={branchIds} onChange={setBranchIds} />
        )}
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end">
          <ActionButton variant="primary" type="submit" pending={invite.isPending}>
            {invite.isPending ? "Sending" : `Send invitation as ${ORG_ROLE_LABEL[role]}`}
          </ActionButton>
        </div>
      </form>

      {query.isPending && <Skeleton height={140} />}
      {query.isError && (
        <LoadFailed onRetry={() => void query.refetch()} retrying={query.isFetching}>
          We couldn&apos;t load your invitations. Any you sent still stand: this is on our side.
        </LoadFailed>
      )}
      {query.data && (
        <>
          <section className="flex flex-col gap-2.5">
            <SectionHeading n={pending.length}>Waiting to accept</SectionHeading>
            {pending.length === 0 ? (
              <EmptyState className="p-5">
                No invitation is waiting. Invite your team above; each person accepts by signing in with the address you
                used.
              </EmptyState>
            ) : (
              <ul className={cn(surfaceClass, "m-0 list-none p-0")}>{pending.map(row)}</ul>
            )}
          </section>
          {past.length > 0 && (
            <section className="flex flex-col gap-2.5">
              <SectionHeading n={past.length}>Earlier</SectionHeading>
              <ul className={cn(surfaceClass, "m-0 list-none p-0")}>{past.map(row)}</ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
