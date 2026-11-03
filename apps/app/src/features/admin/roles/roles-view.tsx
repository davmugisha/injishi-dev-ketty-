"use client";

import { Checkbox, Chip, Description, Input, Label, Tabs, TextArea, TextField, toast } from "@heroui/react";
import {
  type AdminCustomRole,
  type AdminRoleHolder,
  type AdminStaffRoleCatalog,
  RESERVED_STAFF_PERMISSIONS,
  STAFF_PERMISSION_AREA_LABEL,
  STAFF_PERMISSION_DESCRIPTION,
  STAFF_PERMISSION_LABEL,
  StaffPermission,
  StaffPermissionArea,
  staffPermissionsInArea,
} from "@injishi/contracts";
import {
  ActionButton,
  ConfirmDialog,
  DataTable,
  DateText,
  Icon,
  PageContent,
  PageHeader,
  SidePanel,
} from "@injishi/ui";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useStepUp } from "../step-up/step-up-dialog";
import { archiveRole, createRole, loadHolders, updateRole } from "./actions";

/** One row of the roles list: a built-in role or a custom one. */
interface RoleRow {
  /** The built-in key or the custom role's id: what `holders` takes. */
  ref: string;
  name: string;
  description: string;
  permissions: StaffPermission[];
  holderCount: number;
  custom: AdminCustomRole | null;
}

const BUILT_IN_DESCRIPTION: Record<string, string> = {
  super_admin: "Everything, including giving roles. The only role that can change other people's authority.",
  ops: "Runs registrations, brokers, moderation and translations, and can sign people out or suspend them.",
  compliance: "Reads the platform and the audit log, and acts on data requests.",
  finance: "Sees money, sets fees and releases payouts.",
  trainer: "Runs training sessions. Nothing in the rest of the console.",
};

/**
 * Roles (2026-11-02): the five built-in staff roles, which are code and read only, and the custom roles a
 * super admin makes as named bundles of those same permissions. A row opens the role with what it allows and
 * who holds it. The Permissions tab is the whole matrix: every role against every permission.
 */
export function RolesView({
  catalog,
  canManage,
  held,
}: {
  catalog: AdminStaffRoleCatalog;
  canManage: boolean;
  /** What this staffer holds: nobody puts a permission in a role that they do not hold themselves. */
  held: readonly string[];
}) {
  const [open, setOpen] = useState<RoleRow | null>(null);
  const [editing, setEditing] = useState<AdminCustomRole | "new" | null>(null);
  const live = catalog.custom.filter((r) => !r.archivedAt);
  const archived = catalog.custom.filter((r) => r.archivedAt);
  const rows: RoleRow[] = [
    ...catalog.builtIn.map((r) => ({
      ref: r.role,
      name: r.name,
      description: BUILT_IN_DESCRIPTION[r.role] ?? "",
      permissions: r.permissions,
      holderCount: r.holderCount,
      custom: null,
    })),
    ...live.map(customRow),
  ];

  return (
    <PageContent>
      <PageHeader
        eyebrow="People"
        title="Roles"
        description="What each staff role may do in the admin console. Built-in roles are fixed; a custom role bundles the same permissions under a name you choose."
        actions={
          canManage ? (
            <ActionButton icon="Plus" intent="primary" onPress={() => setEditing("new")}>
              New role
            </ActionButton>
          ) : null
        }
      />
      <Tabs variant="secondary" defaultSelectedKey="roles">
        <Tabs.ListContainer>
          <Tabs.List aria-label="Roles and permissions">
            <Tabs.Tab id="roles">
              Roles
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="matrix">
              Permissions
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
        <Tabs.Panel id="roles" className="flex flex-col gap-5 pt-5">
          <DataTable<RoleRow>
            label="Staff roles"
            rows={rows}
            rowKey={(r) => r.ref}
            onRowAction={setOpen}
            columns={[
              {
                id: "role",
                header: "Role",
                isRowHeader: true,
                sortValue: (r) => r.name,
                cell: (r) => (
                  <span className="flex min-w-0 flex-col text-sm">
                    <span className="flex items-center gap-2 font-medium">
                      {r.name}
                      <Chip size="sm" variant="soft" color={r.custom ? "default" : "accent"}>
                        {r.custom ? "Custom" : "Built-in"}
                      </Chip>
                    </span>
                    {r.description ? <span className="truncate text-xs text-muted">{r.description}</span> : null}
                  </span>
                ),
              },
              {
                id: "permissions",
                header: "Permissions",
                align: "end",
                sortValue: (r) => r.permissions.length,
                cell: (r) => r.permissions.length,
              },
              {
                id: "holders",
                header: "People",
                align: "end",
                sortValue: (r) => r.holderCount,
                cell: (r) => r.holderCount,
              },
            ]}
          />
          {archived.length ? (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted">Archived roles ({archived.length})</summary>
              <ul className="mt-2 flex list-none flex-col gap-1 p-0">
                {archived.map((r) => (
                  <li key={r.id}>
                    <button type="button" className="text-left hover:underline" onClick={() => setOpen(customRow(r))}>
                      {r.name}
                    </button>{" "}
                    <span className="text-xs text-muted">
                      archived <DateText value={r.archivedAt ?? r.updatedAt} />
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </Tabs.Panel>
        <Tabs.Panel id="matrix" className="pt-5">
          <Matrix rows={rows} />
        </Tabs.Panel>
      </Tabs>
      {open ? (
        <RolePanel
          role={open}
          canManage={canManage}
          onClose={() => setOpen(null)}
          onEdit={(r) => {
            setOpen(null);
            setEditing(r);
          }}
        />
      ) : null}
      {editing ? (
        <RoleEditor role={editing === "new" ? null : editing} held={held} onClose={() => setEditing(null)} />
      ) : null}
    </PageContent>
  );
}

function customRow(r: AdminCustomRole): RoleRow {
  return {
    ref: r.id,
    name: r.name,
    description: r.description,
    permissions: r.permissions,
    holderCount: r.holderCount,
    custom: r,
  };
}

/** Every permission (rows, grouped by area) against every live role (columns). */
function Matrix({ rows }: { rows: RoleRow[] }) {
  return (
    <div className="max-w-full overflow-x-auto rounded-xl border border-separator">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <caption className="sr-only">Which permissions each role holds</caption>
        <thead>
          <tr className="bg-surface-secondary">
            <th scope="col" className="sticky left-0 z-10 bg-surface-secondary px-3 py-2 text-left font-medium">
              Permission
            </th>
            {rows.map((r) => (
              <th key={r.ref} scope="col" className="px-2 py-2 text-center text-xs font-medium whitespace-nowrap">
                {r.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {StaffPermissionArea.options.map((area) => (
            <MatrixArea key={area} area={area} rows={rows} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MatrixArea({ area, rows }: { area: StaffPermissionArea; rows: RoleRow[] }) {
  return (
    <>
      <tr>
        <th
          scope="colgroup"
          colSpan={rows.length + 1}
          className="sticky left-0 border-t border-separator bg-surface px-3 pt-3 pb-1 text-left text-xs font-semibold tracking-wide text-muted uppercase"
        >
          {STAFF_PERMISSION_AREA_LABEL[area]}
        </th>
      </tr>
      {staffPermissionsInArea(area).map((p) => (
        <tr key={p} className="border-t border-separator">
          <th scope="row" className="sticky left-0 z-10 bg-surface px-3 py-2 text-left font-normal">
            <span className="block first-letter:uppercase">{STAFF_PERMISSION_LABEL[p]}</span>
            <span className="block text-xs text-muted">{STAFF_PERMISSION_DESCRIPTION[p]}</span>
          </th>
          {rows.map((r) => (
            <td key={r.ref} className="px-2 py-2 text-center">
              {r.permissions.includes(p) ? (
                <>
                  <Icon name="Check" className="mx-auto size-4 text-success" />
                  <span className="sr-only">Allowed</span>
                </>
              ) : (
                <>
                  <span className="text-muted" aria-hidden="true">
                    ·
                  </span>
                  <span className="sr-only">Not allowed</span>
                </>
              )}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** The permissions a role holds, by area, in words. */
function PermissionList({ permissions }: { permissions: readonly StaffPermission[] }) {
  return (
    <div className="flex flex-col gap-3">
      {StaffPermissionArea.options.map((area) => {
        const inArea = staffPermissionsInArea(area).filter((p) => permissions.includes(p));
        if (!inArea.length) return null;
        return (
          <div key={area} className="flex flex-col gap-1">
            <span className="text-xs font-semibold tracking-wide text-muted uppercase">
              {STAFF_PERMISSION_AREA_LABEL[area]}
            </span>
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
              {inArea.map((p) => (
                <li key={p}>
                  <span className="first-letter:uppercase">{STAFF_PERMISSION_DESCRIPTION[p]}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function RolePanel({
  role,
  canManage,
  onClose,
  onEdit,
}: {
  role: RoleRow;
  canManage: boolean;
  onClose: () => void;
  onEdit: (r: AdminCustomRole) => void;
}) {
  const router = useRouter();
  const [holders, setHolders] = useState<AdminRoleHolder[] | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  useEffect(() => {
    let live = true;
    loadHolders(role.ref).then((h) => (live ? setHolders(h) : undefined));
    return () => {
      live = false;
    };
  }, [role.ref]);
  const custom = role.custom;
  const isArchived = Boolean(custom?.archivedAt);
  const archive = () =>
    start(async () => {
      if (!custom) return;
      const result = await archiveRole(custom.id, reason);
      if (!result.ok) {
        toast.danger(result.error);
        return;
      }
      toast.success("Role archived.");
      setArchiving(false);
      onClose();
      router.refresh();
    });

  return (
    <SidePanel
      isOpen
      onOpenChange={(o) => (o ? null : onClose())}
      title={role.name}
      description={
        custom
          ? isArchived
            ? "Custom role, archived"
            : "Custom role"
          : "Built-in role. Fixed; it cannot be changed or archived."
      }
      footer={
        canManage && custom && !isArchived ? (
          <div className="flex w-full flex-wrap justify-end gap-2">
            <ActionButton intent="danger-soft" onPress={() => setArchiving(true)} isDisabled={role.holderCount > 0}>
              Archive
            </ActionButton>
            <ActionButton intent="primary" onPress={() => onEdit(custom)}>
              Edit role
            </ActionButton>
          </div>
        ) : undefined
      }
    >
      {role.description ? <p className="m-0 text-sm">{role.description}</p> : null}
      {canManage && custom && !isArchived && role.holderCount > 0 ? (
        <p className="m-0 text-xs text-muted">To archive this role, take it from everyone who holds it first.</p>
      ) : null}
      <section className="flex flex-col gap-2">
        <h3 className="m-0 text-sm font-semibold">What it allows</h3>
        <PermissionList permissions={role.permissions} />
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="m-0 text-sm font-semibold">Who holds it</h3>
        {holders === null ? (
          <p className="m-0 text-sm text-muted">Loading…</p>
        ) : holders.length === 0 ? (
          <p className="m-0 text-sm text-muted">Nobody.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
            {holders.map((h) => (
              <li key={h.userId}>
                <NextLink href={`/admin/people/${h.userId}`} className="hover:underline">
                  {h.name?.trim() || h.email}
                </NextLink>{" "}
                <span className="text-xs text-muted">{h.email}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <ConfirmDialog
        isOpen={archiving}
        onOpenChange={setArchiving}
        title={`Archive ${role.name}?`}
        confirmLabel="Archive"
        intent="danger"
        isPending={pending}
        onConfirm={archive}
      >
        <p className="m-0 text-sm">It can no longer be given. It stays on record.</p>
        <TextField value={reason} onChange={setReason} isRequired className="mt-2 flex flex-col gap-1">
          <Label>Reason</Label>
          <Input placeholder="For the audit log, a few words" />
        </TextField>
      </ConfirmDialog>
    </SidePanel>
  );
}

function RoleEditor({
  role,
  held,
  onClose,
}: {
  role: AdminCustomRole | null;
  held: readonly string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [chosen, setChosen] = useState<StaffPermission[]>(role?.permissions ?? []);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { guard, dialog, pending } = useStepUp();

  const toggle = (p: StaffPermission, on: boolean) =>
    setChosen((cur) => (on ? [...cur, p] : cur.filter((x) => x !== p)));
  const submit = () => {
    setError(null);
    // Canonical order, so the audit row lists permissions the way the matrix does.
    const permissions = StaffPermission.options.filter((p) => chosen.includes(p));
    const input = { name, description, permissions, reason };
    guard(
      () => (role ? updateRole(role.id, input) : createRole(input)),
      (result) => {
        if (!result.ok) {
          setError(result.error);
          return;
        }
        toast.success(role ? "Role saved." : "Role created. Give it to people from their page.");
        onClose();
        router.refresh();
      },
    );
  };

  return (
    <>
      <SidePanel
        isOpen
        size="lg"
        onOpenChange={(o) => (o ? null : onClose())}
        title={role ? `Edit ${role.name}` : "New role"}
        description={
          role && role.holderCount > 0
            ? `${role.holderCount === 1 ? "One person holds" : `${role.holderCount} people hold`} this role. Changes reach them at once.`
            : "Choose what people with this role may do. Nothing is chosen to start with."
        }
        submitLabel={role ? "Save role" : "Create role"}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        isPending={pending}
        formError={error ?? undefined}
      >
        <TextField value={name} onChange={setName} isRequired className="flex flex-col gap-1">
          <Label>Name</Label>
          <Input placeholder="Support desk" />
        </TextField>
        <TextField value={description} onChange={setDescription} className="flex flex-col gap-1">
          <Label>Description</Label>
          <TextArea rows={2} placeholder="Who this role is for" />
        </TextField>
        {StaffPermissionArea.options.map((area) => (
          <fieldset key={area} className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">
              {STAFF_PERMISSION_AREA_LABEL[area]}
            </legend>
            {staffPermissionsInArea(area).map((p) => {
              const reserved = RESERVED_STAFF_PERMISSIONS.includes(p);
              const notHeld = !held.includes(p);
              const why = reserved ? "Super admins only" : notHeld ? "You do not hold this" : null;
              return (
                <Checkbox
                  key={p}
                  isSelected={chosen.includes(p)}
                  isDisabled={Boolean(why)}
                  onChange={(on) => toggle(p, on)}
                >
                  <Checkbox.Content className="flex items-start gap-2">
                    <Checkbox.Control className="mt-0.5">
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <span className="flex flex-col">
                      <span className="text-sm first-letter:uppercase">{STAFF_PERMISSION_LABEL[p]}</span>
                      <Description className="text-xs">
                        {STAFF_PERMISSION_DESCRIPTION[p]}
                        {why ? ` · ${why}` : ""}
                      </Description>
                    </span>
                  </Checkbox.Content>
                </Checkbox>
              );
            })}
          </fieldset>
        ))}
        <TextField value={reason} onChange={setReason} isRequired className="flex flex-col gap-1">
          <Label>Reason</Label>
          <Input placeholder="Why, for the audit log" />
        </TextField>
      </SidePanel>
      {dialog}
    </>
  );
}
