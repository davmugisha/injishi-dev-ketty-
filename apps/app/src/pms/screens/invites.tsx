"use client";

/**
 * People · Invites: put staff on the business (2026-09-13).
 *
 * Was a `Placeholder`. The owner names an email address and a role; the API
 * mails a single use link, and the membership is written only when that
 * address signs in and accepts on web's join page. The role is the whole of
 * what the invitation grants — what a receptionist may do is still
 * `permissionsForWorkspace`, the same table every refusal is worded from.
 *
 * Behind `team.manage`, the owner's. Owner is not offered as a role: ownership
 * changes hands through the owner claim, which checks an identity document.
 */

import {
  InvitableOrgRole,
  ORG_ROLE_LABEL,
  type OperatorStaffInvitation,
} from "@injishi/contracts";
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
import { humanError } from "../data/api";
import { useCapability, useWorkspaceId } from "../data/capability";
import { useInviteStaff, useRevokeStaffInvitation, useStaffInvitations } from "../data/setup";
import { dshortIso } from "../lib/format";
import { usePms } from "../store";

/** What each invitable role can do, in the owner's words. */
const ROLE_NOTE: Record<InvitableOrgRole, string> = {
  manager: "Runs the property day to day: bookings, rooms, rates, departments and money. Cannot change the team.",
  receptionist: "Front office: reservations, check-in and check-out, bills and payments, guest messages.",
  housekeeper: "Room status and cleaning tasks, on their phone.",
};

const STATUS: Record<OperatorStaffInvitation["status"], { text: string; intent: "ok" | "info" | "neutral" | "warn" }> = {
  sent: { text: "Waiting to accept", intent: "info" },
  accepted: { text: "Accepted", intent: "ok" },
  revoked: { text: "Withdrawn", intent: "neutral" },
  expired: { text: "Expired", intent: "warn" },
};

const inputClass = "h-10 w-full rounded border border-line2 bg-field px-3 text-sm text-foreground";

export function Invites({ landlord }: { landlord: boolean }) {
  const workspaceId = useWorkspaceId();
  const { toast, toastError } = usePms();
  const { can, reasonFor } = useCapability();
  const query = useStaffInvitations(can("team.manage") ? workspaceId : null);
  const invite = useInviteStaff(workspaceId);
  const revoke = useRevokeStaffInvitation(workspaceId);
  const roles = InvitableOrgRole.options.filter((r) => !landlord || r === "manager");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InvitableOrgRole>(landlord ? "manager" : "receptionist");
  const [error, setError] = useState<string | null>(null);

  if (!can("team.manage")) {
    return <EmptyState className="p-6 text-sm">{reasonFor("team.manage")}</EmptyState>;
  }

  const submit = () => {
    setError(null);
    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return setError("Use an email address like name@example.com.");
    invite.mutate(
      { email: address, orgRole: role },
      {
        onSuccess: () => {
          setEmail("");
          toast(`Invitation sent to ${address}`, "ok");
        },
        onError: (err) => setError(humanError(err)),
      },
    );
  };

  const invitations = query.data?.invitations ?? [];
  const pending = invitations.filter((i) => i.status === "sent");
  const past = invitations.filter((i) => i.status !== "sent");

  const row = (inv: OperatorStaffInvitation, i: number) => {
    const s = STATUS[inv.status];
    const busy = revoke.isPending && revoke.variables === inv.id;
    return (
      <li
        key={inv.id}
        data-invitation={inv.email}
        className={cn("flex flex-wrap items-center gap-3 px-4 py-3", i > 0 && "border-t border-line")}
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold text-ink">{inv.email}</span>
          <span className="text-2xs text-muted-foreground">
            {ORG_ROLE_LABEL[inv.orgRole]} · sent {dshortIso(inv.createdAt)}
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
    <div className="pms-enter flex flex-col gap-5" data-screen="invites">
      <form
        className={cn(surfaceClass, "flex flex-col gap-3 p-4")}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <span className="text-sm font-semibold text-ink">Invite a staff member</span>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-ink">Email</span>
            <input
              aria-label="Staff email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-ink">Role</span>
            <select
              aria-label="Role"
              value={role}
              onChange={(e) => setRole(e.target.value as InvitableOrgRole)}
              className={inputClass}
            >
              {roles.map((r) => (
                <option key={r} value={r}>
                  {ORG_ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="text-xs text-muted-foreground">{ROLE_NOTE[role]}</p>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end">
          <ActionButton variant="primary" type="submit" pending={invite.isPending}>
            {invite.isPending ? "Sending" : "Send invitation"}
          </ActionButton>
        </div>
      </form>

      {query.isPending && <Skeleton height={140} />}
      {query.isError && (
        <LoadFailed onRetry={() => void query.refetch()} retrying={query.isFetching}>
          We couldn&apos;t load your invitations. Any you sent still stand — this is on our side.
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
