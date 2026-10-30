"use client";

import { Chip, Input, Label, TextField, toast } from "@heroui/react";
import { type AdminUserListResponse, type AdminUserRow, ORG_ROLE_LABEL, STAFF_ROLE_LABEL } from "@injishi/contracts";
import { ActionButton, DataTable, DateText, EmailInput, EmptyBlock, PageContent, PageHeader, SidePanel } from "@injishi/ui";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { createAccount } from "./actions";

/**
 * People (2026-10-29): every account on Injishi, searchable by name or email, with what each one is: platform
 * staff, a member of which businesses, and how many government seats. A row opens the person, where their
 * roles are set. "Create account" makes one by email; the person signs in with a code sent to it.
 */
export function PeopleView({
  list,
  q,
  canCreate,
}: {
  list: AdminUserListResponse;
  q: string;
  canCreate: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState(q);
  const [creating, setCreating] = useState(false);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const term = search.trim();
    router.push(term ? `/admin/people?q=${encodeURIComponent(term)}` : "/admin/people");
  };

  return (
    <PageContent>
      <PageHeader
        title="People"
        description="Every account on Injishi. Open a person to give them platform staff roles, put them in a business with a role, or appoint them to a government or PSF post."
        actions={
          canCreate ? (
            <ActionButton icon="Plus" intent="primary" onPress={() => setCreating(true)}>
              Create account
            </ActionButton>
          ) : null
        }
      />
      <form onSubmit={onSearch} className="flex max-w-[560px] items-end gap-2">
        <TextField value={search} onChange={setSearch} className="flex flex-1 flex-col gap-1">
          <Label>Search</Label>
          <Input placeholder="Name or email" />
        </TextField>
        <ActionButton type="submit" icon="Magnifier">
          Search
        </ActionButton>
      </form>
      <p className="m-0 text-[13px] text-muted tabular">
        {list.meta.total === 0
          ? "No accounts match."
          : `${list.items.length} of ${list.meta.total} ${list.meta.total === 1 ? "account" : "accounts"}`}
      </p>
      <DataTable<AdminUserRow>
        label="People"
        rows={list.items}
        rowKey={(p) => p.id}
        empty={
          <EmptyBlock
            size="sm"
            icon="Persons"
            title={q ? "Nobody matches that search" : "No accounts yet"}
            description={q ? "Try part of a name or an email address." : "Accounts appear when people sign in or are created here."}
          />
        }
        columns={[
          {
            id: "person",
            header: "Person",
            isRowHeader: true,
            cell: (p) => (
              <NextLink href={`/admin/people/${p.id}`} className="flex min-w-0 flex-col text-sm hover:underline">
                <span className="truncate font-medium">{p.name?.trim() || p.email}</span>
                <span className="truncate text-xs text-muted">{p.email}</span>
              </NextLink>
            ),
          },
          {
            id: "staff",
            header: "Platform staff",
            cell: (p) =>
              p.staffRoles.length ? (
                <span className="flex flex-wrap gap-1">
                  {p.staffRoles.map((r) => (
                    <Chip key={r} size="sm" variant="soft" color="accent">
                      {STAFF_ROLE_LABEL[r]}
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
                  {p.memberships.length > 2 ? <span className="text-muted">+{p.memberships.length - 2} more</span> : null}
                </span>
              ) : (
                <span className="text-xs text-muted">—</span>
              ),
          },
          {
            id: "seat",
            header: "Government / PSF",
            cell: (p) =>
              p.oversight ? (
                <span className="text-xs">{p.oversight.governmentTitle ?? p.oversight.oversightRole.replace(/_/g, " ")}</span>
              ) : (
                <span className="text-xs text-muted">—</span>
              ),
          },
          {
            id: "since",
            header: "Since",
            sortValue: (p) => p.createdAt,
            cell: (p) => <DateText value={p.createdAt} />,
          },
        ]}
      />
      {creating ? <CreateAccountPanel onClose={() => setCreating(false)} /> : null}
    </PageContent>
  );
}

function CreateAccountPanel({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      setError(null);
      const result = await createAccount({ email, name, reason });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(result.value.created ? "Account created. They were emailed how to sign in." : "That email already has an account; opening it.");
      onClose();
      router.push(`/admin/people/${result.value.userId}`);
    });

  return (
    <SidePanel
      isOpen
      onOpenChange={(open) => (open ? null : onClose())}
      title="Create an account"
      description="There is no password: they sign in with a code we email to this address."
      submitLabel="Create account"
      onSubmit={submit}
      isPending={pending}
      formError={error ?? undefined}
    >
      <EmailInput label="Email" value={email} onChange={setEmail} isRequired />
      <TextField value={name} onChange={setName} isRequired className="flex flex-col gap-1">
        <Label>Full name</Label>
        <Input placeholder="As on their ID" />
      </TextField>
      <TextField value={reason} onChange={setReason} isRequired className="flex flex-col gap-1">
        <Label>Reason</Label>
        <Input placeholder="Why this account is being made, for the audit log" />
      </TextField>
    </SidePanel>
  );
}
