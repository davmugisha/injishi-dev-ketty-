"use client";

/**
 * One role's permissions at this business, grouped by area, with what the
 * business changed from the platform default marked on each row (ADR-055).
 *
 * A presentational panel: `screens/roles.tsx` owns which role is open, the
 * draft and the save. Every array here is the server's: `basePermissions` is
 * what Injishi means by the role, `permissions` what it means at this business,
 * `lockedPermissions` what no owner may move. The panel compares them and
 * resolves nothing.
 *
 * **READ ONLY IS ONE STATE, NOT THREE.** The owner's role, a locked permission
 * and a role that is not being edited all render the same disabled row, so a
 * person never presses a control that silently does nothing. The one locked
 * permission, `team.manage`, also says WHY on its row, on every role: it is
 * the owner's alone, and granting it would hand the recipient this screen.
 */

import {
  LOCKED_PERMISSION_REASON,
  PERMISSION_AREA_LABEL,
  PERMISSION_AREA_OF,
  PERMISSION_LABEL,
  Permission,
  type OperatorRolePermissions,
} from "@injishi/contracts";
import { Checkbox } from "@injishi/ui";
import { cn } from "@/lib/utils";

import { ConfirmAction } from "../confirm-action";
import { ActionButton, Badge, surfaceClass } from "../ui";
import { PERMISSION_HINT, departures, groupByArea, sayPermissions, sentenceCase } from "./permission-rows";
import type { RoleCopy } from "./role-copy";

const ORDER = Permission.options;
const AREAS = groupByArea(ORDER, PERMISSION_AREA_OF);

function holders(n: number): string {
  if (n === 0) return "nobody holds it yet";
  return n === 1 ? "1 person holds it" : `${n} people hold it`;
}

function changesText(n: number): string {
  return n === 1 ? "1 change here" : `${n} changes here`;
}


export function RolePermissions({
  role,
  copy,
  open,
  draft,
  busy,
  onEdit,
  onCancel,
  onToggle,
  onSave,
  onReset,
}: {
  role: OperatorRolePermissions;
  copy: RoleCopy;
  /** This role is being edited, and `draft` is the set switched into. */
  open: boolean;
  draft: ReadonlySet<Permission>;
  /** A save or reset of THIS role is in flight. */
  busy: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onToggle: (permission: Permission, on: boolean) => void;
  onSave: () => void;
  onReset: () => void;
}) {
  const locked = new Set<Permission>(role.lockedPermissions);
  const base = new Set<Permission>(role.basePermissions);
  const held: ReadonlySet<Permission> = open ? draft : new Set<Permission>(role.permissions);

  /* What this business CHANGED, measured against the platform's own answer
     rather than remembered from the edit that made it. It is the number an
     owner reviewing their policy is looking for. */
  const fromDefault = departures(ORDER, base, held);
  const changed = fromDefault.granted.length + fromDefault.withdrawn.length;
  const savedChanges = departures(ORDER, base, role.permissions);
  const savedChanged = savedChanges.granted.length + savedChanges.withdrawn.length;

  /* What Save would do, against what is saved now. Said before the press,
     because a permission set is a policy: it reaches every person holding the
     role on their next screen. */
  const pending = departures(ORDER, role.permissions, held);
  const dirty = pending.granted.length + pending.withdrawn.length > 0;

  const headingId = `role-${role.orgRole}`;

  return (
    <section
      aria-labelledby={headingId}
      data-role-editor={role.orgRole}
      className={cn(surfaceClass, "flex flex-col")}
    >
      <header className="flex flex-wrap items-start gap-3 border-b border-line px-[18px] py-3.5">
        <span className="flex min-w-0 flex-1 basis-64 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <h3 id={headingId} className="text-base font-semibold text-ink">
              {role.label}
            </h3>
            {changed > 0 && <Badge intent="info">{changesText(changed)}</Badge>}
            {!role.customisable && <Badge intent="neutral">Not editable</Badge>}
          </span>
          <span className="text-xs text-muted-foreground">{copy.everyDay}</span>
          <span className="text-2xs text-muted-foreground">
            {held.size} of {ORDER.length} permissions
            {changed > 0 ? ` (the standard set is ${base.size})` : ""} · {holders(role.memberCount)}
          </span>
        </span>

        <span className="flex flex-wrap gap-2">
          {role.customisable && !open && (
            <>
              <ActionButton onClick={onEdit}>Change</ActionButton>
              {/* Reset throws away EVERY decision this business made about this
                  role, in one press, for however many people hold it, so it
                  arms first like every other undo-by-hand action in this app.
                  The armed label names the count rather than "are you sure". */}
              {savedChanged > 0 && (
                <ConfirmAction
                  pending={busy}
                  confirmLabel={savedChanged === 1 ? "Undo that change" : `Undo all ${savedChanged} changes`}
                  onConfirm={onReset}
                >
                  Reset to standard
                </ConfirmAction>
              )}
            </>
          )}
          {open && (
            <>
              <ActionButton onClick={onCancel}>Cancel</ActionButton>
              <ActionButton
                variant="primary"
                pending={busy}
                deniedReason={dirty ? undefined : "Nothing has changed yet"}
                onClick={onSave}
              >
                {busy ? "Saving" : "Save"}
              </ActionButton>
            </>
          )}
        </span>
      </header>

      {!role.customisable && (
        <p className="border-b border-line px-[18px] py-2.5 text-xs text-muted-foreground">
          The owner&apos;s role cannot be changed. It is the one that opens this screen, so nothing
          changed here can lock you out of it.
        </p>
      )}

      {open && (
        <div
          role="status"
          className="flex flex-col gap-1 border-b border-line bg-hover px-[18px] py-2.5 text-xs text-ink2"
        >
          {dirty ? (
            <>
              {pending.granted.length > 0 && (
                <span>
                  {role.label} <span className="font-semibold">may now</span> {sayPermissions(pending.granted, PERMISSION_LABEL, "and")}.
                </span>
              )}
              {pending.withdrawn.length > 0 && (
                <span>
                  {role.label} <span className="font-semibold">may no longer</span>{" "}
                  {sayPermissions(pending.withdrawn, PERMISSION_LABEL, "or")}.
                </span>
              )}
              <span className="text-muted-foreground">
                {role.memberCount === 0
                  ? "Nobody holds this role yet; it applies to whoever you give it to."
                  : `It changes what ${role.memberCount === 1 ? "1 person" : `${role.memberCount} people`} can do, on their next screen.`}
              </span>
              {held.size === 0 && (
                <span className="font-semibold text-ink">
                  {role.label} will be able to do nothing here. The people holding it keep their account and
                  their place on the team.
                </span>
              )}
            </>
          ) : (
            <span>Tick or untick what {role.label} may do here, then save.</span>
          )}
        </div>
      )}

      <div className="flex flex-col gap-4 px-[18px] py-3.5">
        {AREAS.map((group) => (
          <fieldset key={group.area} className="m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0">
            <legend className="pb-1 text-2xs font-bold uppercase tracking-[0.05em] text-[var(--muted2)]">
              {PERMISSION_AREA_LABEL[group.area]}
            </legend>
            <div className="grid gap-x-4 gap-y-2 md:grid-cols-2">
              {group.permissions.map((permission) => {
                const on = held.has(permission);
                const isLocked = locked.has(permission);
                const moved = base.has(permission) !== on;
                const hint = isLocked ? LOCKED_PERMISSION_REASON[permission] : PERMISSION_HINT[permission];
                const editable = open && role.customisable && !isLocked;

                return (
                  <Checkbox
                    key={permission}
                    data-permission={permission}
                    isSelected={on}
                    isDisabled={!editable}
                    onChange={(next: boolean) => onToggle(permission, next)}
                    className="flex w-full items-start gap-2.5 py-0.5 text-sm font-normal text-ink"
                    controlClassName="mt-0.5"
                  >
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className={cn(!on && "text-muted-foreground")}>
                          {sentenceCase(PERMISSION_LABEL[permission])}
                        </span>
                        {isLocked && <Badge intent="neutral">Owner only</Badge>}
                        {moved && !isLocked && (
                          <Badge intent={on ? "ok" : "warn"}>{on ? "Granted here" : "Withdrawn here"}</Badge>
                        )}
                      </span>
                      {hint && <span className="text-2xs text-muted-foreground">{hint}</span>}
                    </span>
                  </Checkbox>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
    </section>
  );
}
