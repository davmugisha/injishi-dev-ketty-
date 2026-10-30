"use client";

import { Checkbox, Chip, Input, Label, TextField, toast } from "@heroui/react";
import {
  type AdminOrgRow,
  type AdminPersonDetail,
  ORG_ROLE_LABEL,
  OrgRole,
  OVERSIGHT_ROLE_LABEL,
  STAFF_ROLE_LABEL,
  StaffRole,
} from "@injishi/contracts";
import { ActionButton, ConfirmDialog, DateText, LinkButton, PageContent, PageHeader, SectionCard, SelectField } from "@injishi/ui";
import { useRouter } from "next/navigation";
import { type ReactNode, useState, useTransition } from "react";
import {
  addToBusiness,
  changeBusinessRole,
  endSeat,
  findBusinesses,
  type PeopleActionResult,
  removeFromBusiness,
  setStaffRoles,
} from "./actions";

const ORG_ROLE_OPTIONS = OrgRole.options.map((r) => ({ id: r, label: ORG_ROLE_LABEL[r] }));

/** A one-line reason box, the audit log's "why", under every write on this page. */
function Reason({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <TextField value={value} onChange={onChange} className="flex min-w-[min(260px,100%)] flex-1 flex-col gap-1">
      <Label>Reason</Label>
      <Input placeholder="For the audit log, a few words" />
    </TextField>
  );
}

/**
 * One person (2026-10-29), with every authority they hold, and the controls to change each: platform staff
 * roles, the businesses they work in and their role there, and their government and PSF posts. Each change
 * asks for a reason and lands in the audit log.
 */
export function PersonView({
  person,
  can,
  isSelf,
}: {
  person: AdminPersonDetail;
  can: { staff: boolean; members: boolean; seats: boolean };
  isSelf: boolean;
}) {
  return (
    <PageContent>
      <PageHeader
        eyebrow="People"
        title={person.name?.trim() || person.email}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>{person.email}</span>
            <Chip size="sm" variant="soft" color={person.emailVerified ? "success" : "default"}>
              {person.emailVerified ? "Has signed in" : "Not signed in yet"}
            </Chip>
            <Chip size="sm" variant="soft" color={person.kyc === "verified" ? "success" : "default"}>
              {person.kyc === "verified" ? "ID verified" : person.kyc === "pending" ? "ID pending" : "ID not verified"}
            </Chip>
            <span className="text-muted">
              Since <DateText value={person.createdAt} />
            </span>
          </span>
        }
        actions={
          <LinkButton href="/admin/people" variant="secondary">
            All people
          </LinkButton>
        }
      />
      <div className="flex max-w-[960px] flex-col gap-5">
        <StaffRoles person={person} canEdit={can.staff && !isSelf} isSelf={isSelf} />
        <Businesses person={person} canEdit={can.members} />
        <Seats person={person} canEdit={can.seats} />
      </div>
    </PageContent>
  );
}

function useWrite() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = <T,>(write: () => Promise<PeopleActionResult<T>>, ok: string, after?: () => void) =>
    start(async () => {
      const result = await write();
      if (!result.ok) {
        toast.danger(result.error);
        return;
      }
      toast.success(ok);
      after?.();
      router.refresh();
    });
  return { pending, run };
}

function StaffRoles({ person, canEdit, isSelf }: { person: AdminPersonDetail; canEdit: boolean; isSelf: boolean }) {
  const [roles, setRoles] = useState<StaffRole[]>(person.staffRoles);
  const [reason, setReason] = useState("");
  const { pending, run } = useWrite();
  const changed = [...roles].sort().join() !== [...person.staffRoles].sort().join();
  return (
    <SectionCard
      title="Platform staff roles"
      description={
        isSelf
          ? "Your own staff roles are changed by another super admin."
          : "What this person may do in the Injishi admin console. None means they are not staff."
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {StaffRole.options.map((r) => (
            <Checkbox
              key={r}
              isSelected={roles.includes(r)}
              isDisabled={!canEdit}
              onChange={(on) => setRoles((cur) => (on ? [...cur, r] : cur.filter((x) => x !== r)))}
            >
              <Checkbox.Content className="flex items-center gap-2">
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                <span className="text-sm">{STAFF_ROLE_LABEL[r]}</span>
              </Checkbox.Content>
            </Checkbox>
          ))}
        </div>
        {canEdit ? (
          <div className="flex flex-wrap items-end gap-3">
            <Reason value={reason} onChange={setReason} />
            <ActionButton
              intent="primary"
              isDisabled={!changed}
              isPending={pending}
              onPress={() =>
                run(() => setStaffRoles(person.id, { roles, reason }), roles.length ? "Staff roles saved." : "Staff access ended.", () =>
                  setReason(""),
                )
              }
            >
              Save staff roles
            </ActionButton>
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}

function Businesses({ person, canEdit }: { person: AdminPersonDetail; canEdit: boolean }) {
  const [adding, setAdding] = useState(false);
  return (
    <SectionCard
      title="Businesses"
      description="The businesses this person works in, and their role in each. A business's owner and managers can also set this from their own Team screen."
      actions={
        canEdit ? (
          <ActionButton icon="Plus" onPress={() => setAdding((v) => !v)}>
            {adding ? "Close" : "Add to a business"}
          </ActionButton>
        ) : null
      }
    >
      <div className="flex flex-col gap-4">
        {adding ? <AddToBusiness person={person} onDone={() => setAdding(false)} /> : null}
        {person.memberships.length === 0 ? (
          <p className="m-0 text-sm text-muted">Not a member of any business.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {person.memberships.map((m) => (
              <MembershipRow key={m.orgId} userId={person.id} membership={m} canEdit={canEdit} />
            ))}
          </ul>
        )}
      </div>
    </SectionCard>
  );
}

function MembershipRow({
  userId,
  membership: m,
  canEdit,
}: {
  userId: string;
  membership: AdminPersonDetail["memberships"][number];
  canEdit: boolean;
}) {
  const [role, setRole] = useState<string>(m.orgRole);
  const [reason, setReason] = useState("");
  const [removing, setRemoving] = useState(false);
  const { pending, run } = useWrite();
  const toOwner = role === "owner" && m.orgRole !== "owner";
  return (
    <li className="flex flex-col gap-2 border-t border-separator py-3 first:border-t-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{m.orgName}</span>
        <Chip size="sm" variant="soft">
          {ORG_ROLE_LABEL[m.orgRole]}
        </Chip>
        <span className="text-xs text-muted">{m.domain}</span>
      </div>
      {canEdit ? (
        <div className="flex flex-wrap items-end gap-3">
          <SelectField label="Role" options={ORG_ROLE_OPTIONS} value={role} onChange={setRole} className="w-[200px]" />
          <Reason value={reason} onChange={setReason} />
          <ActionButton
            isDisabled={role === m.orgRole}
            isPending={pending}
            onPress={() =>
              run(
                () => changeBusinessRole(m.orgId, userId, { orgRole: role, reason }),
                toOwner ? "Now the owner. The previous owner is a manager." : "Role changed.",
                () => setReason(""),
              )
            }
          >
            Change role
          </ActionButton>
          <ActionButton intent="ghost" onPress={() => setRemoving(true)}>
            Remove
          </ActionButton>
        </div>
      ) : null}
      {toOwner ? (
        <p className="m-0 text-xs text-muted">Making them the owner turns the current owner into a manager.</p>
      ) : null}
      <ConfirmDialog
        isOpen={removing}
        onOpenChange={setRemoving}
        title={`Remove them from ${m.orgName}?`}
        confirmLabel="Remove"
        intent="danger"
        isPending={pending}
        onConfirm={() =>
          run(() => removeFromBusiness(m.orgId, userId, reason), "Removed from the business.", () => setRemoving(false))
        }
      >
        <p className="m-0 text-sm">They lose access to this business at once. The reason you typed is recorded.</p>
        {reason.trim().length < 4 ? <p className="m-0 text-sm text-danger">Type a reason above first.</p> : null}
      </ConfirmDialog>
    </li>
  );
}

function AddToBusiness({ person, onDone }: { person: AdminPersonDetail; onDone: () => void }) {
  const [q, setQ] = useState("");
  const [found, setFound] = useState<AdminOrgRow[] | null>(null);
  const [org, setOrg] = useState<AdminOrgRow | null>(null);
  const [role, setRole] = useState<string>("manager");
  const [reason, setReason] = useState("");
  const [searching, startSearch] = useTransition();
  const { pending, run } = useWrite();
  const search = () => startSearch(async () => setFound(await findBusinesses(q)));
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-separator p-4">
      <div className="flex flex-wrap items-end gap-2">
        <TextField value={q} onChange={setQ} className="flex min-w-[min(260px,100%)] flex-1 flex-col gap-1">
          <Label>Business</Label>
          <Input placeholder="Name, TIN or UPI" onKeyDown={(e) => (e.key === "Enter" ? search() : null)} />
        </TextField>
        <ActionButton icon="Magnifier" isPending={searching} onPress={search}>
          Find
        </ActionButton>
      </div>
      {found !== null && !org ? (
        found.length === 0 ? (
          <p className="m-0 text-sm text-muted">No business matches.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {found.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => setOrg(o)}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-secondary"
                >
                  <span className="font-medium">{o.legalName}</span>{" "}
                  <span className="text-xs text-muted">
                    {o.domain}
                    {o.tin ? ` · TIN ${o.tin}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}
      {org ? (
        <>
          <p className="m-0 text-sm">
            Adding {person.name?.trim() || person.email} to <span className="font-medium">{org.legalName}</span>{" "}
            <button type="button" className="text-xs text-accent underline" onClick={() => setOrg(null)}>
              change
            </button>
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <SelectField label="Role" options={ORG_ROLE_OPTIONS} value={role} onChange={setRole} className="w-[200px]" />
            <Reason value={reason} onChange={setReason} />
            <ActionButton
              intent="primary"
              isPending={pending}
              onPress={() =>
                run(
                  () => addToBusiness(org.id, { email: person.email, orgRole: role, reason }),
                  `Added to ${org.legalName}. They were emailed.`,
                  onDone,
                )
              }
            >
              Add
            </ActionButton>
          </div>
          {role === "owner" ? (
            <p className="m-0 text-xs text-muted">Making them the owner turns the current owner into a manager.</p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function Seats({ person, canEdit }: { person: AdminPersonDetail; canEdit: boolean }) {
  const appointHref = (role: string) => `/admin/leaders?appoint=${role}&aEmail=${encodeURIComponent(person.email)}`;
  return (
    <SectionCard
      title="Government and PSF posts"
      description="Local leaders, DASSO, DGIE officers, document reviewers and approvers, and PSF managers: what this person sees in the officer console."
      actions={
        canEdit ? (
          <span className="flex flex-wrap gap-2">
            <LinkButton href={appointHref("psf_membership_officer")} variant="secondary">
              Appoint to PSF
            </LinkButton>
            <LinkButton href={appointHref("business_field_verifier")} variant="secondary">
              Appoint to government
            </LinkButton>
          </span>
        ) : null
      }
    >
      {person.oversightGrants.length === 0 ? (
        <p className="m-0 text-sm text-muted">No government or PSF post.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {person.oversightGrants.map((g) => (
            <SeatRow key={g.id} userId={person.id} grant={g} canEdit={canEdit}>
              <span className="font-medium">{g.governmentTitle ?? OVERSIGHT_ROLE_LABEL[g.oversightRole]}</span>{" "}
              <span className="text-xs text-muted">
                {OVERSIGHT_ROLE_LABEL[g.oversightRole]} · {g.governmentBodyName ?? g.governmentBodyCode} ·{" "}
                {g.scopeLabel ?? g.scopeLevel}
              </span>
            </SeatRow>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function SeatRow({
  userId,
  grant,
  canEdit,
  children,
}: {
  userId: string;
  grant: AdminPersonDetail["oversightGrants"][number];
  canEdit: boolean;
  children: ReactNode;
}) {
  const [reason, setReason] = useState("");
  const [ending, setEnding] = useState(false);
  const { pending, run } = useWrite();
  return (
    <li className="flex flex-col gap-2 border-t border-separator py-3 first:border-t-0">
      <div>{children}</div>
      {canEdit ? (
        ending ? (
          <div className="flex flex-wrap items-end gap-3">
            <Reason value={reason} onChange={setReason} />
            <ActionButton
              intent="danger"
              isPending={pending}
              onPress={() => run(() => endSeat(userId, grant.id, reason), "Post ended.", () => setEnding(false))}
            >
              End post
            </ActionButton>
            <ActionButton intent="ghost" onPress={() => setEnding(false)}>
              Cancel
            </ActionButton>
          </div>
        ) : (
          <ActionButton intent="ghost" className="self-start" onPress={() => setEnding(true)}>
            End this post
          </ActionButton>
        )
      ) : null}
    </li>
  );
}
