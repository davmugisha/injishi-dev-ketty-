"use client";

import { Checkbox, Chip, Input, Label, Tabs, TextField, toast } from "@heroui/react";
import {
  type AdminActivityResponse,
  type AdminCustomRole,
  type AdminOrgRow,
  type AdminPersonDetail,
  type AdminSignInsResponse,
  ORG_ROLE_LABEL,
  OrgRole,
  OVERSIGHT_ROLE_LABEL,
  STAFF_ROLE_LABEL,
  StaffRole,
} from "@injishi/contracts";
import {
  ActionButton,
  ConfirmDialog,
  DataTable,
  DateText,
  EmptyBlock,
  FormDialog,
  LinkButton,
  PageContent,
  PageHeader,
  SectionCard,
  SelectField,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { type ReactNode, useState, useTransition } from "react";
import { useStepUp } from "../step-up/step-up-dialog";
import {
  addToBusiness,
  assignCustomRole,
  changeBusinessRole,
  endDeviceSession,
  endSeat,
  findBusinesses,
  type PeopleActionResult,
  removeFromBusiness,
  resendInvitation,
  revokeCustomRole,
  setStaffRoles,
  setSuspended,
} from "./actions";
import { StatusChip } from "./PeopleView";

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

export interface PersonCan {
  /** Built-in and custom staff roles, government posts, resending the invitation. */
  grant: boolean;
  members: boolean;
  suspend: boolean;
  sessions: boolean;
}

/**
 * One person (2026-10-29, tabs 2026-11-02): who they are and where their account stands, then what they can
 * do (staff roles, businesses, government and PSF posts), when and from where they signed in, and what was
 * done about them. Every change asks for a reason and lands in the audit log; giving authority also asks
 * for a fresh emailed code.
 */
export function PersonView({
  person,
  can,
  isSelf,
  customRoles,
  signIns,
  activity,
}: {
  person: AdminPersonDetail;
  can: PersonCan;
  isSelf: boolean;
  customRoles: readonly AdminCustomRole[];
  signIns: AdminSignInsResponse | null;
  activity: AdminActivityResponse | null;
}) {
  const [asking, setAsking] = useState<"suspend" | "reactivate" | "resend" | null>(null);
  const suspended = person.status === "suspended";
  return (
    <PageContent>
      <PageHeader
        eyebrow="People"
        title={person.name?.trim() || person.email}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>{person.email}</span>
            {person.phoneMasked ? <span className="text-muted">{person.phoneMasked}</span> : null}
            <StatusChip status={person.status} />
            <Chip size="sm" variant="soft" color={person.kyc === "verified" ? "success" : "default"}>
              {person.kyc === "verified" ? "ID verified" : person.kyc === "pending" ? "ID pending" : "ID not verified"}
            </Chip>
            <span className="text-muted">
              Since <DateText value={person.createdAt} />
            </span>
            {person.lastSignInAt ? (
              <span className="text-muted">
                · Last signed in <DateText value={person.lastSignInAt} />
              </span>
            ) : null}
          </span>
        }
        actions={
          <span className="flex flex-wrap gap-2">
            {can.grant && person.status === "invited" ? (
              <ActionButton icon="Envelope" onPress={() => setAsking("resend")}>
                Resend invitation
              </ActionButton>
            ) : null}
            {can.suspend && !isSelf ? (
              <ActionButton
                intent={suspended ? "secondary" : "danger"}
                onPress={() => setAsking(suspended ? "reactivate" : "suspend")}
              >
                {suspended ? "Reactivate" : "Suspend"}
              </ActionButton>
            ) : null}
            <LinkButton href="/admin/people" variant="secondary">
              All people
            </LinkButton>
          </span>
        }
      />
      <Tabs variant="secondary" defaultSelectedKey="access">
        <Tabs.ListContainer>
          <Tabs.List aria-label="About this person">
            <Tabs.Tab id="access">
              Roles and access
              <Tabs.Indicator />
            </Tabs.Tab>
            {signIns ? (
              <Tabs.Tab id="signins">
                Sign-ins and devices
                <Tabs.Indicator />
              </Tabs.Tab>
            ) : null}
            {activity ? (
              <Tabs.Tab id="activity">
                Activity
                <Tabs.Indicator />
              </Tabs.Tab>
            ) : null}
          </Tabs.List>
        </Tabs.ListContainer>
        <Tabs.Panel id="access" className="pt-5">
          <div className="flex max-w-[960px] flex-col gap-5">
            <StaffRoles person={person} canEdit={can.grant && !isSelf} isSelf={isSelf} customRoles={customRoles} />
            <Businesses person={person} canEdit={can.members} />
            <Seats person={person} canEdit={can.grant} />
          </div>
        </Tabs.Panel>
        {signIns ? (
          <Tabs.Panel id="signins" className="pt-5">
            <SignIns userId={person.id} data={signIns} canEnd={can.sessions} />
          </Tabs.Panel>
        ) : null}
        {activity ? (
          <Tabs.Panel id="activity" className="pt-5">
            <Activity data={activity} />
          </Tabs.Panel>
        ) : null}
      </Tabs>
      <AccountDialog person={person} asking={asking} onClose={() => setAsking(null)} />
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

/** A write that gives authority: asks for a fresh code when the last one is old, then retries. */
function useGrant() {
  const router = useRouter();
  const { guard, dialog, pending } = useStepUp();
  const run = <T,>(write: () => Promise<PeopleActionResult<T>>, ok: string, after?: () => void) =>
    guard(write, (result) => {
      if (!result.ok) {
        toast.danger(result.error);
        return;
      }
      toast.success(ok);
      after?.();
      router.refresh();
    });
  return { pending, run, dialog };
}

/** Suspend, reactivate and resend: each asks why first. */
function AccountDialog({
  person,
  asking,
  onClose,
}: {
  person: AdminPersonDetail;
  asking: "suspend" | "reactivate" | "resend" | null;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const [pending, start] = useTransition();
  const who = person.name?.trim() || person.email;
  const copy = {
    suspend: {
      title: `Suspend ${who}?`,
      body: "They are signed out everywhere at once and cannot sign in until the account is reactivated.",
      label: "Suspend",
      ok: "Suspended. They were signed out everywhere.",
    },
    reactivate: {
      title: `Reactivate ${who}?`,
      body: "They can sign in again.",
      label: "Reactivate",
      ok: "Reactivated.",
    },
    resend: {
      title: "Resend the invitation?",
      body: `We email ${person.email} again with how to sign in.`,
      label: "Resend",
      ok: "Invitation sent again.",
    },
  } as const;
  const c = asking ? copy[asking] : null;
  const submit = () =>
    start(async () => {
      if (!asking) return;
      setError(null);
      const result =
        asking === "resend"
          ? await resendInvitation(person.id, reason)
          : await setSuspended(person.id, asking === "suspend", reason);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(copy[asking].ok);
      setReason("");
      onClose();
      router.refresh();
    });
  return (
    <FormDialog
      isOpen={asking !== null}
      onOpenChange={(open) => (open ? null : onClose())}
      title={c?.title ?? ""}
      description={c?.body}
      submitLabel={c?.label ?? "Confirm"}
      isPending={pending}
      formError={error ?? undefined}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <TextField value={reason} onChange={setReason} isRequired autoFocus className="flex flex-col gap-1">
        <Label>Reason</Label>
        <Input placeholder="For the audit log, a few words" />
      </TextField>
    </FormDialog>
  );
}

function StaffRoles({
  person,
  canEdit,
  isSelf,
  customRoles,
}: {
  person: AdminPersonDetail;
  canEdit: boolean;
  isSelf: boolean;
  customRoles: readonly AdminCustomRole[];
}) {
  const [roles, setRoles] = useState<StaffRole[]>(person.staffRoles);
  const [reason, setReason] = useState("");
  const [giving, setGiving] = useState<string | null>(null);
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);
  const grant = useGrant();
  const plain = useWrite();
  const changed = [...roles].sort().join() !== [...person.staffRoles].sort().join();
  const held = new Set(person.customRoles.map((r) => r.id));
  const offer = customRoles
    .filter((r) => !r.archivedAt && !held.has(r.id))
    .map((r) => ({ id: r.id, label: r.name, description: r.description }));
  const removesOnly = roles.every((r) => person.staffRoles.includes(r));
  const save = () => {
    const write = () => setStaffRoles(person.id, { roles, reason });
    const ok = roles.length || person.customRoles.length ? "Staff roles saved." : "Staff access ended.";
    // Taking roles away needs no fresh code; adding one does, and the API asks.
    (removesOnly ? plain.run : grant.run)(write, ok, () => setReason(""));
  };
  return (
    <SectionCard
      title="Staff roles"
      description={
        isSelf
          ? "Your own staff roles are changed by another super admin."
          : "What this person may do in the Injishi admin console. None means they are not staff."
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Built-in roles</span>
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
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Custom roles</span>
          {person.customRoles.length === 0 ? (
            <p className="m-0 text-sm text-muted">None.</p>
          ) : (
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {person.customRoles.map((r) => (
                <li key={r.id} className="flex items-center gap-1">
                  <Chip size="sm" variant="soft">
                    {r.name}
                  </Chip>
                  {canEdit ? (
                    <button
                      type="button"
                      className="text-xs text-muted underline hover:text-foreground"
                      onClick={() => setRemoving(r)}
                    >
                      remove
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
        {canEdit ? (
          <div className="flex flex-wrap items-end gap-3">
            {offer.length ? (
              <SelectField
                label="Give a custom role"
                options={offer}
                value={giving}
                onChange={setGiving}
                className="w-[240px]"
              />
            ) : null}
            <Reason value={reason} onChange={setReason} />
            {giving ? (
              <ActionButton
                intent="primary"
                isPending={grant.pending}
                onPress={() =>
                  grant.run(
                    () => assignCustomRole(person.id, { roleId: giving, reason }),
                    "Role given.",
                    () => {
                      setGiving(null);
                      setReason("");
                    },
                  )
                }
              >
                Give role
              </ActionButton>
            ) : null}
            <ActionButton
              intent={giving ? "secondary" : "primary"}
              isDisabled={!changed}
              isPending={grant.pending || plain.pending}
              onPress={save}
            >
              Save built-in roles
            </ActionButton>
          </div>
        ) : null}
      </div>
      <ConfirmDialog
        isOpen={removing !== null}
        onOpenChange={(open) => (open ? null : setRemoving(null))}
        title={`Take ${removing?.name ?? "this role"} away?`}
        confirmLabel="Take it away"
        intent="danger"
        isPending={plain.pending}
        onConfirm={() =>
          removing
            ? plain.run(
                () => revokeCustomRole(person.id, removing.id, reason),
                "Role taken away.",
                () => {
                  setRemoving(null);
                  setReason("");
                },
              )
            : undefined
        }
      >
        <p className="m-0 text-sm">They lose what this role allows at once. The reason you typed is recorded.</p>
        {reason.trim().length < 4 ? <p className="m-0 text-sm text-danger">Type a reason first.</p> : null}
      </ConfirmDialog>
      {grant.dialog}
    </SectionCard>
  );
}

/** "Chrome on macOS" from a user agent, or the raw string when it is not one we know. */
function deviceName(ua: string | null): string {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua)
          ? "Safari"
          : /okhttp|Expo|Dalvik|CFNetwork/i.test(ua)
            ? "Injishi app"
            : null;
  const os = /iPhone|iPad/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : null;
  if (!browser && !os) return ua.slice(0, 60);
  return [browser, os].filter(Boolean).join(" on ");
}

function SignIns({ userId, data, canEnd }: { userId: string; data: AdminSignInsResponse; canEnd: boolean }) {
  const [ending, setEnding] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const { pending, run } = useWrite();
  return (
    <div className="flex max-w-[960px] flex-col gap-5">
      <SectionCard
        title="Signed in now"
        description="Each device with a live session. Ending one signs that device out."
      >
        {data.devices.length === 0 ? (
          <p className="m-0 text-sm text-muted">Not signed in anywhere.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {data.devices.map((d) => (
              <li
                key={d.sessionId}
                className="flex flex-wrap items-center gap-3 border-t border-separator py-3 first:border-t-0"
              >
                <span className="flex min-w-0 flex-1 flex-col text-sm">
                  <span className="font-medium">{deviceName(d.userAgent)}</span>
                  <span className="text-xs text-muted">
                    {d.ipAddress ?? "No address"} · signed in <DateText value={d.signedInAt} /> · last active{" "}
                    <DateText value={d.lastActiveAt} />
                  </span>
                </span>
                {canEnd ? (
                  <ActionButton intent="ghost" onPress={() => setEnding(d.sessionId)}>
                    Sign out
                  </ActionButton>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
      <SectionCard title="Sign-in history" description="The most recent 50 sign-ins.">
        {data.signIns.length === 0 ? (
          <EmptyBlock
            size="sm"
            icon="Clock"
            title="No sign-ins recorded"
            description="Sign-ins are recorded from now on."
          />
        ) : (
          <DataTable
            label="Sign-in history"
            rows={data.signIns}
            rowKey={(s) => `${s.occurredAt}-${s.ipAddress ?? ""}`}
            columns={[
              { id: "when", header: "When", cell: (s) => <DateText value={s.occurredAt} /> },
              { id: "how", header: "How", cell: (s) => s.method },
              { id: "device", header: "Device", cell: (s) => deviceName(s.userAgent) },
              { id: "ip", header: "Address", cell: (s) => s.ipAddress ?? "—" },
            ]}
          />
        )}
      </SectionCard>
      <FormDialog
        isOpen={ending !== null}
        onOpenChange={(open) => (open ? null : setEnding(null))}
        title="Sign this device out?"
        description="They can sign in again with a new code, unless the account is suspended."
        submitLabel="Sign out"
        isPending={pending}
        onSubmit={(event) => {
          event.preventDefault();
          if (ending)
            run(
              () => endDeviceSession(userId, ending, reason),
              "Signed out.",
              () => {
                setEnding(null);
                setReason("");
              },
            );
        }}
      >
        <TextField value={reason} onChange={setReason} isRequired autoFocus className="flex flex-col gap-1">
          <Label>Reason</Label>
          <Input placeholder="For the audit log, a few words" />
        </TextField>
      </FormDialog>
    </div>
  );
}

/** `admin.user.staff_roles_set` -> "Staff roles set". */
function eventWords(type: string): string {
  const last = type.split(".").slice(1).join(" ").replace(/_/g, " ");
  return last ? last.charAt(0).toUpperCase() + last.slice(1) : type;
}

function Activity({ data }: { data: AdminActivityResponse }) {
  return (
    <div className="flex max-w-[960px] flex-col gap-5">
      <SectionCard
        title="Activity"
        description="What staff did about this person, and what this person did, newest first."
      >
        {data.items.length === 0 ? (
          <EmptyBlock size="sm" icon="Clock" title="Nothing recorded yet" />
        ) : (
          <DataTable
            label="Activity"
            rows={data.items}
            rowKey={(i) => i.id}
            columns={[
              { id: "when", header: "When", cell: (i) => <DateText value={i.occurredAt} /> },
              {
                id: "what",
                header: "What",
                cell: (i) => (
                  <span className="flex flex-col text-sm">
                    <span>{eventWords(i.eventType)}</span>
                    <span className="text-xs text-muted">
                      {i.direction === "by" ? "By this person" : `By ${i.actorName ?? "the system"}`}
                    </span>
                  </span>
                ),
              },
              { id: "why", header: "Reason", cell: (i) => i.reason ?? <span className="text-muted">—</span> },
            ]}
          />
        )}
      </SectionCard>
    </div>
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
          run(
            () => removeFromBusiness(m.orgId, userId, reason),
            "Removed from the business.",
            () => setRemoving(false),
          )
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
            <SelectField
              label="Role"
              options={ORG_ROLE_OPTIONS}
              value={role}
              onChange={setRole}
              className="w-[200px]"
            />
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
              onPress={() =>
                run(
                  () => endSeat(userId, grant.id, reason),
                  "Post ended.",
                  () => setEnding(false),
                )
              }
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
