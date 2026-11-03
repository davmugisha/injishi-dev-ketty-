"use client";

import { Chip, Description, Input, Label, TextField, toast } from "@heroui/react";
import {
  type AdminAccountStatus,
  type AdminCustomRole,
  type AdminUserListResponse,
  type AdminUserRow,
  ORG_ROLE_LABEL,
  STAFF_ROLE_LABEL,
  StaffRole,
} from "@injishi/contracts";
import {
  ActionButton,
  DateText,
  EmailInput,
  EmptyBlock,
  type GridSort,
  PageContent,
  PageHeader,
  SelectField,
  ServerDataGrid,
  SidePanel,
} from "@injishi/ui";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { useStepUp } from "../step-up/step-up-dialog";
import { createAccount } from "./actions";

export interface PeopleFilters {
  q: string;
  kind: string;
  status: string;
  role: string;
  sort: string;
  dir: string;
  page: number;
}

const ANY = "all";
const KIND_OPTIONS = [
  { id: ANY, label: "Any kind" },
  { id: "staff", label: "Injishi staff" },
  { id: "official", label: "Leaders and officers" },
  { id: "business", label: "Works in a business" },
  { id: "guest", label: "Guests and others" },
];
const STATUS_OPTIONS = [
  { id: ANY, label: "Any status" },
  { id: "active", label: "Active" },
  { id: "invited", label: "Invited, not signed in" },
  { id: "suspended", label: "Suspended" },
];
export const STATUS_LABEL: Record<AdminAccountStatus, string> = {
  active: "Active",
  invited: "Invited",
  suspended: "Suspended",
};
const STATUS_COLOR: Record<AdminAccountStatus, "success" | "default" | "danger"> = {
  active: "success",
  invited: "default",
  suspended: "danger",
};
/** The grid's columns that the server can sort by, by the API's names. */
const SORTABLE: Record<string, string> = { person: "name", lastSignIn: "lastSignInAt", since: "createdAt" };

/**
 * People (2026-10-29, grid and filters 2026-11-02): every account on Injishi, searchable by name or email and
 * filtered by role, status and kind, one page at a time from the server. A row opens the person. "Add person"
 * makes an account by email, optionally with a staff role, and mails them how to sign in.
 */
export function PeopleView({
  list,
  filters,
  customRoles,
  canCreate,
}: {
  list: AdminUserListResponse;
  filters: PeopleFilters;
  customRoles: readonly AdminCustomRole[];
  canCreate: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState(filters.q);
  const [creating, setCreating] = useState(false);
  const [loading, startLoading] = useTransition();

  const go = (next: Partial<PeopleFilters>) => {
    const merged = { ...filters, page: 1, ...next };
    const params = new URLSearchParams();
    if (merged.q.trim()) params.set("q", merged.q.trim());
    for (const key of ["kind", "status", "role", "sort", "dir"] as const) {
      if (merged[key] && merged[key] !== ANY) params.set(key, merged[key]);
    }
    if (merged.page > 1) params.set("page", String(merged.page));
    const qs = params.toString();
    startLoading(() => router.push(qs ? `/admin/people?${qs}` : "/admin/people"));
  };

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    go({ q: search });
  };

  const roleOptions = [
    { id: ANY, label: "Any role" },
    ...StaffRole.options.map((r) => ({ id: r, label: STAFF_ROLE_LABEL[r] })),
    ...customRoles.filter((r) => !r.archivedAt).map((r) => ({ id: r.id, label: r.name })),
  ];
  const sortColumn = Object.entries(SORTABLE).find(([, api]) => api === filters.sort)?.[0];
  const sort: GridSort | null = sortColumn
    ? { column: sortColumn, direction: filters.dir === "asc" ? "ascending" : "descending" }
    : null;
  const filtered = Boolean(filters.q || filters.kind || filters.status || filters.role);

  return (
    <PageContent>
      <PageHeader
        title="People"
        description="Every account on Injishi. Open a person to see what they can do, change their roles, or suspend them."
        actions={
          canCreate ? (
            <ActionButton icon="Plus" intent="primary" onPress={() => setCreating(true)}>
              Add person
            </ActionButton>
          ) : null
        }
      />
      <div className="flex flex-wrap items-end gap-3">
        <form onSubmit={onSearch} className="flex min-w-[min(320px,100%)] flex-[2_1_320px] items-end gap-2">
          <TextField value={search} onChange={setSearch} className="flex flex-1 flex-col gap-1">
            <Label>Search</Label>
            <Input placeholder="Name or email" />
          </TextField>
          <ActionButton type="submit" icon="Magnifier">
            Search
          </ActionButton>
        </form>
        <SelectField
          label="Role"
          options={roleOptions}
          value={filters.role || ANY}
          onChange={(v) => go({ role: v === ANY ? "" : v })}
          className="w-[200px]"
        />
        <SelectField
          label="Status"
          options={STATUS_OPTIONS}
          value={filters.status || ANY}
          onChange={(v) => go({ status: v === ANY ? "" : v })}
          className="w-[200px]"
        />
        <SelectField
          label="Kind"
          options={KIND_OPTIONS}
          value={filters.kind || ANY}
          onChange={(v) => go({ kind: v === ANY ? "" : v })}
          className="w-[200px]"
        />
        {filtered ? (
          <ActionButton
            intent="ghost"
            onPress={() => {
              setSearch("");
              go({ q: "", kind: "", status: "", role: "" });
            }}
          >
            Clear filters
          </ActionButton>
        ) : null}
      </div>
      <ServerDataGrid<AdminUserRow>
        label="People"
        rows={list.items}
        rowKey={(p) => p.id}
        isLoading={loading}
        onRowAction={(p) => router.push(`/admin/people/${p.id}`)}
        sort={sort}
        onSortChange={(s) => go({ sort: SORTABLE[s.column] ?? "", dir: s.direction === "ascending" ? "asc" : "desc" })}
        paging={{
          page: list.meta.page,
          pageSize: list.meta.pageSize,
          total: list.meta.total,
          onPageChange: (page) => go({ page }),
        }}
        empty={
          <EmptyBlock
            size="sm"
            icon="Persons"
            title={filtered ? "Nobody matches" : "No accounts yet"}
            description={
              filtered
                ? "Try part of a name or an email address, or clear the filters."
                : "Accounts appear when people sign in or are added here."
            }
          />
        }
        mobile={{
          title: (p) => p.name?.trim() || p.email,
          description: (p) => p.email,
          trailing: (p) => <StatusChip status={p.status} />,
        }}
        columns={[
          {
            id: "person",
            header: "Person",
            isRowHeader: true,
            sortable: true,
            minWidth: 220,
            cell: (p) => (
              <NextLink href={`/admin/people/${p.id}`} className="flex min-w-0 flex-col text-sm hover:underline">
                <span className="truncate font-medium">{p.name?.trim() || p.email}</span>
                <span className="truncate text-xs text-muted">{p.email}</span>
              </NextLink>
            ),
          },
          { id: "status", header: "Status", cell: (p) => <StatusChip status={p.status} /> },
          {
            id: "roles",
            header: "Staff roles",
            cell: (p) =>
              p.staffRoles.length || p.customRoles.length ? (
                <span className="flex flex-wrap gap-1">
                  {p.staffRoles.map((r) => (
                    <Chip key={r} size="sm" variant="soft" color="accent">
                      {STAFF_ROLE_LABEL[r]}
                    </Chip>
                  ))}
                  {p.customRoles.map((r) => (
                    <Chip key={r.id} size="sm" variant="soft">
                      {r.name}
                    </Chip>
                  ))}
                </span>
              ) : (
                <span className="text-xs text-muted">—</span>
              ),
          },
          {
            id: "businesses",
            header: "Businesses",
            cell: (p) =>
              p.memberships.length ? (
                <span className="flex min-w-0 flex-col text-xs">
                  {p.memberships.slice(0, 2).map((m) => (
                    <span key={m.orgId} className="truncate">
                      {m.orgName} · {ORG_ROLE_LABEL[m.orgRole]}
                    </span>
                  ))}
                  {p.memberships.length > 2 ? (
                    <span className="text-muted">+{p.memberships.length - 2} more</span>
                  ) : null}
                </span>
              ) : (
                <span className="text-xs text-muted">—</span>
              ),
          },
          {
            id: "post",
            header: "Post",
            cell: (p) =>
              p.oversight ? (
                <span className="text-xs">
                  {p.oversight.governmentTitle ?? p.oversight.oversightRole.replace(/_/g, " ")}
                </span>
              ) : (
                <span className="text-xs text-muted">—</span>
              ),
          },
          {
            id: "lastSignIn",
            header: "Last sign in",
            sortable: true,
            cell: (p) =>
              p.lastSignInAt ? <DateText value={p.lastSignInAt} /> : <span className="text-xs text-muted">—</span>,
          },
          { id: "since", header: "Since", sortable: true, cell: (p) => <DateText value={p.createdAt} /> },
        ]}
      />
      {creating ? <AddPersonPanel customRoles={customRoles} onClose={() => setCreating(false)} /> : null}
    </PageContent>
  );
}

export function StatusChip({ status }: { status: AdminAccountStatus }) {
  return (
    <Chip size="sm" variant="soft" color={STATUS_COLOR[status]}>
      {STATUS_LABEL[status]}
    </Chip>
  );
}

const POST = "post";
const NOTHING = "nothing";

function AddPersonPanel({ customRoles, onClose }: { customRoles: readonly AdminCustomRole[]; onClose: () => void }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [gives, setGives] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { guard, dialog, pending } = useStepUp();

  const giveOptions = [
    { id: NOTHING, label: "No role for now", description: "They can sign in; give a role later." },
    ...StaffRole.options.map((r) => ({
      id: `staff:${r}`,
      label: STAFF_ROLE_LABEL[r],
      description: "Built-in staff role",
    })),
    ...customRoles
      .filter((r) => !r.archivedAt)
      .map((r) => ({ id: `custom:${r.id}`, label: r.name, description: r.description || "Custom staff role" })),
    { id: POST, label: "A government or PSF post", description: "Next, choose the post and the area." },
  ];

  const grant = (() => {
    if (!gives || gives === NOTHING || gives === POST) return undefined;
    const [kind, value] = gives.split(":");
    return kind === "staff"
      ? { kind: "staff_role" as const, role: value }
      : { kind: "custom_role" as const, roleId: value };
  })();

  const submit = () => {
    setError(null);
    if (!gives) {
      setError("Choose what they get, or No role for now.");
      return;
    }
    guard(
      () => createAccount({ email, name, phone: phone.trim() || undefined, grant, reason }),
      (result) => {
        if (!result.ok) {
          setError(result.error);
          return;
        }
        if (!result.value.created) {
          toast.warning("That email already has an account. Opening it: change their roles there.");
          onClose();
          router.push(`/admin/people/${result.value.userId}`);
          return;
        }
        toast.success("Added. They were emailed how to sign in.");
        onClose();
        router.push(
          gives === POST
            ? `/admin/leaders?appoint=business_field_verifier&aEmail=${encodeURIComponent(email.trim().toLowerCase())}`
            : `/admin/people/${result.value.userId}`,
        );
      },
    );
  };

  return (
    <>
      <SidePanel
        isOpen
        onOpenChange={(open) => (open ? null : onClose())}
        title="Add a person"
        description="They sign in with a code we email them. There is no password."
        submitLabel="Add person"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        isPending={pending}
        formError={error ?? undefined}
      >
        <EmailInput label="Email" value={email} onChange={setEmail} isRequired />
        <TextField value={name} onChange={setName} isRequired className="flex flex-col gap-1">
          <Label>Full name</Label>
          <Input placeholder="As on their ID" />
        </TextField>
        <TextField value={phone} onChange={setPhone} className="flex flex-col gap-1">
          <Label>Phone</Label>
          <Input placeholder="0788 123 456" inputMode="tel" />
          <Description>Optional. Shown on their profile; it does not sign them in.</Description>
        </TextField>
        <SelectField label="What they get" options={giveOptions} value={gives} onChange={setGives} isRequired />
        <TextField value={reason} onChange={setReason} isRequired className="flex flex-col gap-1">
          <Label>Reason</Label>
          <Input placeholder="Why, for the audit log" />
        </TextField>
      </SidePanel>
      {dialog}
    </>
  );
}
