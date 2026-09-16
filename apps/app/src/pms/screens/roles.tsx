"use client";

/**
 * Roles (ADR-055) — what each staff role may do AT THIS BUSINESS.
 *
 * **This is the one screen where the app EDITS the permission model instead of
 * reading a refusal from it**, and everything about how it is built follows from
 * that one sentence.
 *
 * The four roles were the platform's: what Injishi means by "receptionist", the
 * same in every hotel in the country. Two real properties never agree — one lets
 * the front desk read the month's takings, another will not let a manager
 * withdraw a signed receipt — so an owner moves a permission on or off any of
 * their own staff roles here, and the platform's set becomes the starting point
 * rather than the ceiling.
 *
 * **NOTHING IS RESOLVED IN THE BROWSER.** The server sends `basePermissions`
 * (the platform's answer) and `permissions` (this business's) for every role;
 * this renders the difference between two arrays it was handed. It never asks
 * what a role means — `can` and `permissionsForRole` are not importable here,
 * and `injishi/no-client-authz` fails the build on either. The toggles are an
 * editor for a policy the API owns, not a second copy of it.
 *
 * **THE OWNER'S ROW IS SHOWN AND NOT EDITABLE**, rather than hidden. An owner
 * asking "why can nobody else close the month" needs to see the owner's own set
 * to answer it. It cannot be edited because this screen is behind `team.manage`,
 * which only an owner holds: an owner who could withdraw it from `owner` would
 * have shut the only door back in.
 *
 * **`team.manage` ITSELF IS LOCKED** on every role, and the switch says why
 * rather than being quietly absent. Granting it would hand the recipient this
 * screen, from which they could grant themselves the rest and re-role the owner
 * out of their own business. The server refuses it too, and the table CHECKs it.
 *
 * A draft is per role and local until Save, because a permission set is a policy
 * rather than a series of switches: an owner moving three things wants to review
 * all three before any of them reaches the front desk.
 */

import {
  LOCKED_PERMISSION_REASON,
  PERMISSION_AREA_LABEL,
  PERMISSION_AREA_OF,
  PERMISSION_LABEL,
  type OperatorRolePermissions,
  type PermissionArea,
  type Permission,
} from "@injishi/contracts";
import { Checkbox } from "@injishi/ui";
import { cn } from "@/lib/utils";
import { useState } from "react";

import { ConfirmAction } from "../components/confirm-action";
import {
  ActionButton,
  Badge,
  EmptyState,
  LoadFailed,
  SectionHeading,
  Skeleton,
  surfaceClass,
} from "../components/ui";
import { useCapability, useWorkspaceId } from "../data/capability";
import { useRoles, useSetRolePermissions } from "../data/ops";
import { usePms } from "../store";

/**
 * The order the areas read in, which is the order a shift runs in rather than
 * alphabetical: the desk, the rooms, the outlets, the money, the property, the
 * people. An area with no permission in it renders nothing at all.
 */
const AREA_ORDER: readonly PermissionArea[] = [
  "front_desk",
  "rooms",
  "services",
  "money",
  "property",
  "people",
];

/** What a role is FOR, under its name. The label alone says nothing new. */
const ROLE_NOTE: Record<string, string> = {
  owner: "Owns the business. Holds everything, including the roster.",
  manager: "Runs the property day to day.",
  receptionist: "Works the front desk and takes service orders.",
  housekeeper: "Works from a phone: room status and maintenance.",
};

export function Roles() {
  const { toast, toastError } = usePms();
  const workspaceId = useWorkspaceId();
  const { can, reasonFor } = useCapability();
  const query = useRoles(workspaceId);
  const save = useSetRolePermissions(workspaceId);

  /** The role being edited, and the set that has been switched into. */
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Set<Permission>>(new Set());

  if (!can("team.manage")) {
    return (
      <EmptyState style={{ padding: 26, fontSize: 13.5 }}>
        {reasonFor("team.manage")}
      </EmptyState>
    );
  }

  if (query.isPending) {
    return (
      <div className="pms-enter flex max-w-wide flex-col gap-4">
        <Skeleton height={40} />
        <Skeleton height={220} delay={60} />
        <Skeleton height={220} delay={120} />
      </div>
    );
  }

  if (query.isError) {
    /* An unreachable API is not a business whose roles hold nothing. Told that,
       an owner would think every colleague had just lost their access. */
    return (
      <LoadFailed onRetry={() => void query.refetch()} retrying={query.isFetching}>
        We couldn&apos;t load your roles. Everybody still holds the access they had —
        this is on our side, not a business with nothing granted.
      </LoadFailed>
    );
  }

  const roles = query.data?.roles ?? [];

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
    const open = editing === role.orgRole;
    // This role, not the whole list: two cards must not both shimmer.
    const busy = save.isPending && save.variables?.orgRole === role.orgRole;
    const locked = new Set<Permission>(role.lockedPermissions);
    const base = new Set<Permission>(role.basePermissions);
    const held = open ? draft : new Set<Permission>(role.permissions);

    /* What this business CHANGED, measured against the platform's own answer
       rather than remembered from the edit that made it. It is the number an
       owner reviewing their policy is actually looking for. */
    const changed = [...new Set([...base, ...held])].filter(
      (p) => base.has(p) !== held.has(p),
    );

    const areas = AREA_ORDER.map((area) => ({
      area,
      permissions: (Object.keys(PERMISSION_AREA_OF) as Permission[])
        .filter((p) => PERMISSION_AREA_OF[p] === area)
        .sort((a, b) => PERMISSION_LABEL[a].localeCompare(PERMISSION_LABEL[b])),
    })).filter((group) => group.permissions.length > 0);

    return (
      <section key={role.orgRole} className={cn(surfaceClass, "flex flex-col")}>
        <header className="flex flex-wrap items-center gap-2.5 border-b border-line px-[18px] py-3">
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex items-center gap-2">
              <span className="text-sm font-semibold text-ink">{role.label}</span>
              {changed.length > 0 && (
                <Badge intent="info">
                  {changed.length === 1 ? "1 change" : `${changed.length} changes`}
                </Badge>
              )}
              {!role.customisable && <Badge intent="neutral">Not editable</Badge>}
            </span>
            <span className="text-2xs text-muted-foreground">
              {ROLE_NOTE[role.orgRole] ?? `${role.permissions.length} permissions`}
              {" · "}
              {role.memberCount === 0
                ? "nobody holds it yet"
                : role.memberCount === 1
                  ? "1 person holds it"
                  : `${role.memberCount} people hold it`}
            </span>
          </span>

          <span className="flex gap-2">
            {role.customisable && !open && (
              <>
                <ActionButton onClick={() => startEdit(role)}>Change</ActionButton>
                {/* Reset throws away EVERY decision this business made about
                    this role, in one press, for however many people hold it —
                    so it arms first, like every other undo-by-hand action in
                    this app. The armed label names the count rather than
                    saying "are you sure". */}
                {changed.length > 0 && (
                  <ConfirmAction
                    pending={busy}
                    confirmLabel={
                      changed.length === 1
                        ? "Undo that change"
                        : `Undo all ${changed.length} changes`
                    }
                    onConfirm={() =>
                      commit(
                        role,
                        role.basePermissions.filter((p) => !locked.has(p)),
                        `${role.label} is back to the standard access`,
                      )
                    }
                  >
                    Reset
                  </ConfirmAction>
                )}
              </>
            )}
            {open && (
              <>
                <ActionButton onClick={() => setEditing(null)}>Cancel</ActionButton>
                <ActionButton
                  variant="primary"
                  pending={busy}
                  onClick={() =>
                    commit(
                      role,
                      [...draft].filter((p) => !locked.has(p)),
                      draft.size === 0
                        ? `${role.label} can no longer do anything here`
                        : `${role.label} saved — it takes effect on their next screen`,
                    )
                  }
                >
                  {busy ? "Saving" : "Save"}
                </ActionButton>
              </>
            )}
          </span>
        </header>

        <div className="flex flex-col gap-3.5 px-[18px] py-3.5">
          {areas.map((group) => (
            <div key={group.area} className="flex flex-col gap-1.5">
              <span className="text-2xs font-bold uppercase tracking-[0.05em] text-[var(--muted2)]">
                {PERMISSION_AREA_LABEL[group.area]}
              </span>
              <div className="grid gap-1.5 md:grid-cols-2">
                {group.permissions.map((permission) => {
                  const on = held.has(permission);
                  const isLocked = locked.has(permission);
                  const moved = base.has(permission) !== on;
                  const reason = isLocked
                    ? LOCKED_PERMISSION_REASON[permission]
                    : undefined;

                  /* Read only: the owner's card, a locked permission, and any
                     card that is not the one being edited. All three render the
                     same disabled row, so a person never presses a control that
                     silently does nothing. */
                  const editable = open && role.customisable && !isLocked;

                  return (
                    <Checkbox
                      key={permission}
                      isSelected={on}
                      isDisabled={!editable}
                      onChange={(next: boolean) => toggle(permission, next)}
                      className="flex w-full items-start gap-2.5 py-0.5 text-sm font-normal text-ink"
                      controlClassName="mt-0.5"
                    >
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className={cn(!on && "text-muted-foreground")}>
                            {PERMISSION_LABEL[permission]}
                          </span>
                          {moved && (
                            <Badge intent={on ? "ok" : "warn"}>
                              {on ? "Granted here" : "Withdrawn here"}
                            </Badge>
                          )}
                        </span>
                        {reason && (
                          <span className="text-2xs text-muted-foreground">{reason}</span>
                        )}
                      </span>
                    </Checkbox>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  };

  return (
    <div className="pms-enter flex max-w-wide flex-col gap-4">
      <p className="text-xs text-muted-foreground">
        Every role starts with the access Injishi gives it. Change any of them to suit how
        this business actually runs — what you switch here is what the API allows, not just
        what the app shows. A change reaches the person on their next screen.
      </p>

      <section className="flex flex-col gap-3">
        <SectionHeading n={roles.length}>Roles</SectionHeading>
        {roles.length === 0 ? (
          <EmptyState className="p-5">
            This workspace has no staff roles to set.
          </EmptyState>
        ) : (
          roles.map(card)
        )}
      </section>

      <p className="text-2xs text-muted-foreground">
        Managing the team stays with the owner and cannot be granted to another role: it
        would let that role change roles, including yours. Everything else is yours to
        decide.
      </p>
    </div>
  );
}
