"use client";

/**
 * Roles (ADR-055, ADR-069): what each of the six roles may do AT THIS BUSINESS.
 *
 * **This is the one screen where the app EDITS the permission model instead of
 * reading a refusal from it**, and everything about how it is built follows from
 * that one sentence.
 *
 * The six roles are the platform's defaults: what Injishi means by "front
 * desk" or "finance", the same in every hotel in the country. Two real
 * properties never agree with them (one lets the front desk read the month's
 * takings, another will not let a manager withdraw a signed receipt), so an
 * owner grants or withdraws any permission on any of their own staff roles here,
 * and the platform's set becomes the starting point rather than the ceiling.
 *
 * **THE SIX ROLES FIRST, ONE ROLE OPEN BELOW.** The Roles board compares the
 * roles side by side: who each one is for, what they do every day, what they
 * hold. That comparison is the top of this screen, one card per role with its
 * working day, how many permissions it holds here, how many people hold it and
 * whether this business changed it. Choosing a card opens that role's
 * permissions below. It used to be six cards of 35 switches each, one under the
 * other, so an owner comparing Finance with HR scrolled past two hundred rows.
 *
 * **NOTHING IS RESOLVED IN THE BROWSER.** The server sends `basePermissions`
 * (the platform's answer) and `permissions` (this business's) for every role;
 * this renders the difference between two arrays it was handed. It never asks
 * what a role means: `can` and `permissionsForRole` are not importable here,
 * and `injishi/no-client-authz` fails the build on either. The switches are an
 * editor for a policy the API owns, not a second copy of it. The door is the
 * grant too: `team.manage` from `useCapability()`, never a role name.
 *
 * **THE OWNER'S ROLE IS SHOWN AND NOT EDITABLE**, rather than hidden. An owner
 * asking "why can nobody else confirm the pay run" needs to see the owner's own
 * set to answer it. It cannot be edited because this screen is behind
 * `team.manage`, which only an owner holds: an owner who could withdraw it from
 * `owner` would have shut the only door back in.
 *
 * **`team.manage` ITSELF IS LOCKED** on every role, and its row says why rather
 * than being quietly absent. Granting it would hand the recipient this screen,
 * from which they could grant themselves the rest and re-role the owner out of
 * their own business. The server refuses it too, and the table CHECKs it.
 *
 * **PAYROLL IS TWO ROWS** (ADR-069 D-e): "draft the pay run" and "confirm the
 * pay run", side by side in People, so an owner can give HR the first and keep
 * the second.
 *
 * A draft is local until Save, because a permission set is a policy rather
 * than a series of switches: an owner moving three things wants to review all
 * three, worded, before any of them reaches the front desk. While a role has
 * unsaved changes the other cards wait, so a switch is never lost by a click on
 * the wrong card.
 */

import { OrgRole, Permission, type OperatorRolePermissions } from "@injishi/contracts";
import { useState } from "react";
import { cn } from "@/lib/utils";

import { departures } from "../components/roles/permission-rows";
import { ROLE_COPY } from "../components/roles/role-copy";
import { RolePermissions } from "../components/roles/role-permissions";
import { Badge, EmptyState, LoadFailed, SectionHeading, Skeleton } from "../components/ui";
import { useCapability, useWorkspaceId } from "../data/capability";
import { useRoles, useSetRolePermissions } from "../data/ops";
import { usePms } from "../store";

const ORDER = Permission.options;

function people(n: number): string {
  if (n === 0) return "nobody yet";
  return n === 1 ? "1 person" : `${n} people`;
}

export function Roles() {
  const { toast, toastError } = usePms();
  const workspaceId = useWorkspaceId();
  const { can, reasonFor } = useCapability();
  const query = useRoles(workspaceId);
  const save = useSetRolePermissions(workspaceId);

  /** The role shown below the cards. Null until chosen: the first editable role. */
  const [chosen, setChosen] = useState<OrgRole | null>(null);
  /** The role being edited, and the set that has been switched into. */
  const [editing, setEditing] = useState<OrgRole | null>(null);
  const [draft, setDraft] = useState<Set<Permission>>(new Set());

  if (!can("team.manage")) {
    return <EmptyState className="p-6 text-sm">{reasonFor("team.manage")}</EmptyState>;
  }

  if (query.isPending) {
    return (
      <div className="pms-enter flex max-w-page flex-col gap-4">
        <Skeleton height={40} />
        <Skeleton height={180} delay={60} />
        <Skeleton height={320} delay={120} />
      </div>
    );
  }

  if (query.isError) {
    /* An unreachable API is not a business whose roles hold nothing. Told that,
       an owner would think every colleague had just lost their access. */
    return (
      <LoadFailed onRetry={() => void query.refetch()} retrying={query.isFetching}>
        We couldn&apos;t load your roles. Everybody still holds the access they had: this is on our
        side, not a business with nothing granted.
      </LoadFailed>
    );
  }

  /* The server lists the roles in the contract's order; sort by it anyway, so
     the cards read owner first and housekeeper last whatever order arrives. */
  const roles = [...(query.data?.roles ?? [])].sort(
    (a, b) => OrgRole.options.indexOf(a.orgRole) - OrgRole.options.indexOf(b.orgRole),
  );
  const shown =
    roles.find((r) => r.orgRole === chosen) ?? roles.find((r) => r.customisable) ?? roles[0] ?? null;

  const editingRole = roles.find((r) => r.orgRole === editing) ?? null;
  const unsaved = editingRole
    ? (() => {
        const d = departures(ORDER, editingRole.permissions, draft);
        return d.granted.length + d.withdrawn.length > 0;
      })()
    : false;

  function choose(role: OperatorRolePermissions) {
    if (unsaved && role.orgRole !== editing) return;
    if (role.orgRole !== editing) setEditing(null);
    setChosen(role.orgRole);
    /* On a phone the six cards fill the screen and the role just chosen opens
       below them, out of sight. Bring it up only when it is out of view, so a
       desktop owner comparing roles side by side is never scrolled away. */
    requestAnimationFrame(() => {
      const editor = document.getElementById("role-editor");
      if (editor && editor.getBoundingClientRect().top > window.innerHeight * 0.75) {
        editor.scrollIntoView({ block: "start" });
      }
    });
  }

  function startEdit(role: OperatorRolePermissions) {
    setEditing(role.orgRole);
    setDraft(new Set(role.permissions));
  }

  function toggle(permission: Permission, on: boolean) {
    setDraft((current) => {
      const next = new Set(current);
      if (on) next.add(permission);
      else next.delete(permission);
      return next;
    });
  }

  function commit(role: OperatorRolePermissions, permissions: Permission[], said: string) {
    save.mutate(
      { orgRole: role.orgRole, permissions },
      {
        onSuccess: () => {
          setEditing(null);
          toast(said, "ok");
        },
        onError: toastError,
      },
    );
  }

  const card = (role: OperatorRolePermissions) => {
    const copy = ROLE_COPY[role.orgRole];
    const on = shown?.orgRole === role.orgRole;
    const waits = unsaved && role.orgRole !== editing;
    const fromDefault = departures(ORDER, role.basePermissions, role.permissions);
    const changed = fromDefault.granted.length + fromDefault.withdrawn.length;
    return (
      <button
        key={role.orgRole}
        type="button"
        aria-pressed={on}
        aria-disabled={waits || undefined}
        aria-controls="role-editor"
        data-role-card={role.orgRole}
        title={waits && editingRole ? `Save or cancel the changes to ${editingRole.label} first` : undefined}
        onClick={() => choose(role)}
        className={cn(
          "flex min-w-0 flex-col gap-1.5 rounded border px-4 py-3 text-left",
          on ? "border-accent-text bg-accent-soft" : "border-card-bd bg-card hover:bg-hover",
          waits && "cursor-not-allowed opacity-60",
        )}
      >
        <span className="flex flex-wrap items-center gap-2">
          <span className={cn("text-sm font-semibold", on ? "text-accent-soft-foreground" : "text-ink")}>
            {role.label}
          </span>
          {!role.customisable && <Badge intent="neutral">Not editable</Badge>}
          {changed > 0 && (
            <Badge intent="info">{changed === 1 ? "1 change here" : `${changed} changes here`}</Badge>
          )}
        </span>
        <span className={cn("text-2xs", on ? "text-accent-soft-foreground" : "text-muted-foreground")}>
          {copy.everyDay}
        </span>
        <span
          className={cn(
            "pms-num mt-auto text-2xs font-semibold",
            on ? "text-accent-soft-foreground" : "text-ink2",
          )}
        >
          {role.permissions.length} of {ORDER.length} permissions · {people(role.memberCount)}
        </span>
      </button>
    );
  };

  return (
    <div className="pms-enter flex max-w-page flex-col gap-5" data-screen="roles">
      <p className="max-w-read text-xs text-muted-foreground">
        Grant or withdraw any permission on a staff role, to fit how this business runs. Every role starts
        with the access Injishi gives it; what you change here is what the API allows, not just what the
        app shows, and it reaches each person on their next screen.
      </p>

      {roles.length === 0 || !shown ? (
        <EmptyState className="p-5">This workspace has no staff roles to set.</EmptyState>
      ) : (
        <>
          <section className="flex flex-col gap-2.5" aria-labelledby="roles-heading">
            <SectionHeading id="roles-heading" n={roles.length}>
              Roles
            </SectionHeading>
            <div role="group" aria-label="Choose a role" className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {roles.map(card)}
            </div>
            {unsaved && editingRole && (
              <p role="status" className="text-2xs text-muted-foreground">
                Save or cancel the changes to {editingRole.label} to open another role.
              </p>
            )}
          </section>

          <div id="role-editor" className="scroll-mt-24">
            <RolePermissions
              key={shown.orgRole}
              role={shown}
              copy={ROLE_COPY[shown.orgRole]}
              open={editing === shown.orgRole}
              draft={draft}
              busy={save.isPending && save.variables?.orgRole === shown.orgRole}
              onEdit={() => startEdit(shown)}
              onCancel={() => setEditing(null)}
              onToggle={toggle}
              onSave={() =>
                commit(
                  shown,
                  [...draft].filter((p) => !shown.lockedPermissions.includes(p)),
                  draft.size === 0
                    ? `${shown.label} can no longer do anything here`
                    : `${shown.label} saved. It takes effect on their next screen`,
                )
              }
              onReset={() =>
                commit(
                  shown,
                  shown.basePermissions.filter((p) => !shown.lockedPermissions.includes(p)),
                  `${shown.label} is back to the standard access`,
                )
              }
            />
          </div>
        </>
      )}

      <p className="max-w-read text-2xs text-muted-foreground">
        Managing the team stays with the owner and cannot be granted to another role: it would let that
        role change roles, including yours. Everything else is yours to decide.
      </p>
    </div>
  );
}
