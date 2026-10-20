"use client";

import { PersonPlus, PersonsLock, ShieldKeyhole } from "@gravity-ui/icons";
import { Alert, Avatar, Button, Card, Chip, Table, Tabs, Toast, toast } from "@heroui/react";
import { Segment } from "@heroui-pro/react";
import { screenHref } from "@injishi/data";
import type {
  TeamRolesMember,
  TeamRolesMemberStatus,
  TeamRolesRole,
  TeamRolesRoleId,
} from "@injishi/data/fixtures/owner";
import { LinkButton, PageContent, PageHeader, SectionHeader, TextLink, toneColor } from "@injishi/ui";
import { type ReactNode, useMemo, useState } from "react";
import { cancelTeamInvite, changeTeamMember, saveTeamRolePresets, sendTeamInvite } from "./TeamRolesActions";
import {
  allPermissionKeys,
  applyEdits,
  editCount,
  isCode,
  makeHas,
  presetsOf,
  scopeText,
  TEAM_ROLES_HELP,
  TEAM_ROLES_STATUS,
  type TeamRolesData,
  type TeamRolesEdits,
} from "./TeamRolesModel";
import {
  TeamRolesDrawer,
  TeamRolesIdentity,
  TeamRolesInviteForm,
  type TeamRolesInviteState,
  TeamRolesMemberDetail,
  TeamRolesProposedAlert,
  TeamRolesRolePicker,
  TeamRolesScopePicker,
  TeamRolesStepUp,
} from "./TeamRolesPanel";
import { TeamRolesPresets } from "./TeamRolesPresets";
import { TeamRolesTransfer } from "./TeamRolesTransfer";

type Tab = "members" | "presets";
type Filter = "all" | "active" | "invited" | "revoked";
type Panel = { kind: "invite" } | { kind: "member"; id: string; editing: boolean };

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "invited", label: "Invited" },
  { id: "revoked", label: "Revoked" },
];

/** The demo clock of the prototype: a transfer requested now is recorded at 10:42 and expires on 19 Oct. */
const TRANSFER_AT = "10:42";
const TRANSFER_EXPIRES = "19 Oct";

/** "Invited" also lists invites waiting for the owner's approval. */
const inFilter = (status: TeamRolesMemberStatus, filter: Filter) =>
  filter === "all" || status === filter || (filter === "invited" && status === "pending");

export function TeamRolesView({ data }: { data: TeamRolesData }) {
  const { roles, areas, scopes, invite: draft } = data;
  const all = useMemo(() => allPermissionKeys(areas), [areas]);
  const roleById = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);

  const [tab, setTab] = useState<Tab>("members");
  const [filter, setFilter] = useState<Filter>("all");
  const [panel, setPanel] = useState<Panel>({ kind: "invite" });
  const [panelOpen, setPanelOpen] = useState(true);
  const [inviteState, setInviteState] = useState<TeamRolesInviteState>({
    name: draft.name,
    contact: draft.contact,
    role: draft.role,
    scope: draft.scope,
    expiry: draft.expiry,
    endDate: "",
    twoStep: true,
    code: "",
  });
  const [busy, setBusy] = useState(false);
  const [changed, setChanged] = useState<Record<string, Partial<TeamRolesMember>>>({});
  const [removed, setRemoved] = useState<string[]>([]);
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(areas.map((a) => [a.id, a.defaultOpen])),
  );
  const [presets, setPresets] = useState(() => presetsOf(roles));
  const [edits, setEdits] = useState<TeamRolesEdits>({});
  const [customise, setCustomise] = useState(false);
  const [saved, setSaved] = useState(false);
  const [transfer, setTransfer] = useState<"idle" | "open" | { to: string }>("idle");
  const [edit, setEdit] = useState<{ role: TeamRolesRoleId; scope: string[]; code: string } | null>(null);

  const has = makeHas(presets, edits);
  const countFor = (r: TeamRolesRole) => all.filter((p) => has(r.id, p)).length + r.extraPermissions.length;
  const permissionsFor = (r: TeamRolesRole) => [...all.filter((p) => has(r.id, p)), ...r.extraPermissions];
  const changes = editCount(presets, edits);

  // Members: the business's list as the API answered it. A change made here is written there and the page
  // is read again after it, so the list never shows something that was not saved.
  const everyone = useMemo(() => data.members.map((m) => ({ ...m, ...changed[m.id] })), [data.members, changed]);
  const members = everyone.filter((m) => !removed.includes(m.id));
  const shown = members.filter((m) => inFilter(m.status, filter));
  const owner = members.find((m) => m.role === "owner");

  const roleName = (id: TeamRolesRoleId) => roleById.get(id)?.name ?? id;
  // The panel keeps its content while it slides out, so look the member up in the unfiltered list.
  const selected = panel.kind === "member" ? (everyone.find((m) => m.id === panel.id) ?? null) : null;

  const closePanel = () => {
    setPanelOpen(false);
    setInviteState((s) => ({ ...s, code: "" }));
  };
  const openInvite = () => {
    setTab("members");
    setEdit(null);
    setInviteState((s) => ({ ...s, code: "" }));
    setPanel({ kind: "invite" });
    setPanelOpen(true);
  };
  const openMember = (id: string) => {
    setEdit(null);
    setPanel({ kind: "member", id, editing: false });
    setPanelOpen(true);
  };

  const inviteExpiry = draft.expiries.find((e) => e.id === inviteState.expiry) ?? draft.expiries[0];
  const canSend =
    !busy &&
    isCode(inviteState.code) &&
    inviteState.scope.length > 0 &&
    inviteState.name.trim() !== "" &&
    inviteState.contact.trim() !== "";
  /** Run one write; a refusal comes back in the API's words and stays on screen as a toast. */
  const write = async (work: () => Promise<{ ok: true } | { ok: false; message: string }>, done: () => void) => {
    setBusy(true);
    try {
      const result = await work();
      if (result.ok) done();
      else toast.danger(result.message);
    } finally {
      setBusy(false);
    }
  };

  const sendInvite = () => {
    const name = inviteState.name.trim() || inviteState.contact.trim();
    void write(
      () =>
        sendTeamInvite({
          name: inviteState.name,
          contact: inviteState.contact,
          role: inviteState.role,
          scope: inviteState.scope,
        }),
      () => {
        setFilter("all");
        closePanel();
        toast.success(`Invite sent to ${name} · expires ${inviteExpiry?.expiresOn ?? ""}`);
      },
    );
  };

  const revoke = (m: TeamRolesMember) => {
    if (m.status !== "invited") {
      // Taking somebody off the business is offboarding their staff file in People, which ends the
      // membership with the employment record; this screen does not do it on its own.
      toast.warning(`To take ${m.name} off the business, offboard them in People. Their access ends with it.`);
      return;
    }
    void write(
      () => cancelTeamInvite(m.id),
      () => {
        closePanel();
        toast.success(`${m.name}: invite cancelled`);
      },
    );
  };
  const remove = (m: TeamRolesMember) => {
    setRemoved((r) => [...r, m.id]);
    closePanel();
    toast.success(`${m.name} removed from the list · audit trail kept`);
  };
  const startEdit = (m: TeamRolesMember) => {
    setEdit({ role: m.role, scope: m.scopeIds, code: "" });
    setPanel({ kind: "member", id: m.id, editing: true });
  };
  const saveEdit = (m: TeamRolesMember) => {
    if (!edit) return;
    const sameScope = edit.scope.length === m.scopeIds.length && edit.scope.every((s) => m.scopeIds.includes(s));
    const next = { role: edit.role, scope: edit.scope };
    void write(
      () => changeTeamMember(m.id, next),
      () => {
        setChanged((c) => ({
          ...c,
          [m.id]: {
            ...c[m.id],
            role: next.role,
            scopeIds: next.scope,
            scope: sameScope ? m.scope : scopeText(scopes, next.scope),
          },
        }));
        setEdit(null);
        setPanel({ kind: "member", id: m.id, editing: false });
        toast.success(`${m.name}: role and scope updated · recorded in the audit log`);
      },
    );
  };

  const transferTo = typeof transfer === "object" ? members.find((m) => m.id === transfer.to) : undefined;
  const candidates = members
    .filter((m) => m.role !== "owner" && m.status === "active" && m.identityVerified)
    .map((m) => ({ id: m.id, label: `${m.name} · ${roleName(m.role)} · identity verified` }));
  const afterRoles = roles
    .filter((r) => r.invitable && !r.proposed && r.id !== "staff")
    .map((r) => ({ id: r.id, label: `${r.name} · all properties` }));
  const openTransfer = () => {
    closePanel();
    setTransfer("open");
  };
  const requestTransfer = (_to: string) => {
    // Ownership changes hands through the owner claim, which checks the new owner's identity document;
    // the platform has no transfer request yet, so nothing is recorded here and the screen says so.
    setTransfer("idle");
    toast.warning("Ownership transfer is not available yet. It will go through the owner claim, which checks an ID.");
  };
  const ownText = transferTo
    ? `Transfer requested to ${transferTo.name} at ${TRANSFER_AT}. You stay owner until she accepts with verified identity; the request expires ${TRANSFER_EXPIRES}.`
    : `${owner?.name ?? "The owner"} owns this business. Ownership moves only when another verified member accepts, after step-up verification.`;

  const selectTab = (next: Tab) => {
    setTab(next);
    if (next === "presets") closePanel();
  };

  // Manage Member panel facts.
  const sel = selected;
  const selRole = sel ? roleById.get(sel.role) : undefined;
  const selStatus = sel ? TEAM_ROLES_STATUS[sel.status] : undefined;
  const editRole = edit ? roleById.get(edit.role) : undefined;
  const editChanged =
    !!edit &&
    !!sel &&
    (edit.role !== sel.role ||
      edit.scope.length !== sel.scopeIds.length ||
      edit.scope.some((s) => !sel.scopeIds.includes(s)));

  let drawer: { title: string; subtitle: string; body: ReactNode; footer?: ReactNode } | null = null;
  if (panel.kind === "invite") {
    drawer = {
      title: "Invite a Member",
      subtitle: "Access starts only when they accept and sign in.",
      body: (
        <TeamRolesInviteForm
          draft={draft}
          state={inviteState}
          onChange={(patch) => setInviteState((s) => ({ ...s, ...patch }))}
          roles={roles.filter((r) => r.invitable)}
          scopes={scopes}
          countFor={countFor}
          permissionsFor={permissionsFor}
        />
      ),
      footer: (
        <>
          <Button variant="secondary" onPress={closePanel}>
            Cancel
          </Button>
          <Button isDisabled={!canSend} onPress={sendInvite}>
            Send invite
          </Button>
        </>
      ),
    };
  } else if (sel && selStatus) {
    const identity = (
      <TeamRolesIdentity
        initials={sel.initials}
        name={sel.name}
        contact={sel.contact}
        tone={sel.avatarTone}
        status={selStatus.label}
        statusTone={selStatus.tone}
      />
    );
    const isOwner = sel.role === "owner";
    const canRevoke = (sel.status === "active" || sel.status === "invited") && !isOwner;
    if (panel.kind === "member" && panel.editing && edit) {
      drawer = {
        title: "Manage Member",
        subtitle: `${roleName(sel.role)} · ${sel.scope}`,
        body: (
          <>
            {identity}
            <TeamRolesRolePicker
              roles={roles.filter((r) => r.invitable)}
              value={edit.role}
              onChange={(role) => setEdit({ ...edit, role })}
              countFor={countFor}
            />
            {editRole ? <TeamRolesProposedAlert role={editRole} /> : null}
            <TeamRolesScopePicker
              scopes={scopes}
              value={edit.scope}
              onChange={(scope) => setEdit({ ...edit, scope })}
            />
            <TeamRolesStepUp
              phone={draft.verifyPhone}
              value={edit.code}
              onChange={(code) => setEdit({ ...edit, code })}
              description="Granting access always needs step-up verification."
            />
          </>
        ),
        footer: (
          <>
            <Button variant="secondary" onPress={() => openMember(sel.id)}>
              Cancel
            </Button>
            <Button
              isDisabled={!isCode(edit.code) || edit.scope.length === 0 || !editChanged}
              onPress={() => saveEdit(sel)}
            >
              Save changes
            </Button>
          </>
        ),
      };
    } else {
      const sessions =
        sel.status === "active"
          ? sel.signIn === "Staff app PIN"
            ? "1 · Android staff app"
            : "2 · Chrome on Windows, Android app"
          : "None";
      const employee = isOwner
        ? "Not an employee"
        : sel.status === "invited" || sel.status === "pending"
          ? "Linked when they accept"
          : "Linked · see People";
      const help = TEAM_ROLES_HELP[isOwner ? "owner" : sel.status];
      const actions =
        sel.status === "pending" || canRevoke || sel.status === "revoked" ? (
          <>
            {sel.status === "pending" ? (
              <LinkButton href={screenHref("Approvals")}>Review in Approvals</LinkButton>
            ) : null}
            {canRevoke ? (
              <>
                <Button variant="secondary" onPress={() => startEdit(sel)}>
                  Change role or scope
                </Button>
                <Button variant="danger-soft" onPress={() => revoke(sel)}>
                  {sel.status === "invited" ? "Cancel invite" : "Revoke access"}
                </Button>
              </>
            ) : null}
            {sel.status === "revoked" ? (
              <Button variant="danger-soft" onPress={() => remove(sel)}>
                Remove from list
              </Button>
            ) : null}
          </>
        ) : undefined;
      drawer = {
        title: "Manage Member",
        subtitle: `${selRole?.name ?? sel.role} · ${sel.scope}`,
        body: (
          <TeamRolesMemberDetail
            identity={identity}
            facts={[
              { label: "Role", value: roleName(sel.role) },
              { label: "Scope", value: sel.scope },
              { label: "Last active", value: sel.lastActive },
              { label: "Sign-in", value: sel.status === "revoked" ? "—" : sel.signIn },
              { label: "Sessions", value: sessions },
              { label: "Employee file", value: employee },
            ]}
            help={help}
          />
        ),
        footer: actions,
      };
    }
  }

  return (
    <PageContent>
      <Toast.Provider placement="bottom" />
      <PageHeader
        eyebrow="Amahoro Hospitality Group · Business"
        title="Team and Roles"
        description="Who can sign in to your business, what each role can do, and where."
        actions={
          <>
            <Button variant="ghost" onPress={openTransfer} isDisabled={typeof transfer === "object"}>
              <ShieldKeyhole className="size-4" aria-hidden="true" />
              Transfer ownership
            </Button>
            <Button onPress={openInvite}>
              <PersonPlus className="size-4" aria-hidden="true" />
              Invite member
            </Button>
          </>
        }
      />

      <Alert>
        <Alert.Indicator>
          <PersonsLock />
        </Alert.Indicator>
        <Alert.Content>
          <Alert.Title>Injishi staff and government officers are never members of your business</Alert.Title>
          <Alert.Description>
            Injishi support can look at your records only in a time-limited session you approve, and every view is
            logged. Officers work in their own console and never see guest or money records here.{" "}
            <TextLink href={screenHref("AuditLog")}>Support access log</TextLink>
          </Alert.Description>
        </Alert.Content>
      </Alert>

      <Tabs
        variant="secondary"
        selectedKey={tab}
        onSelectionChange={(k) => selectTab(String(k) as Tab)}
        className="w-full gap-5"
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label="Team views" className="justify-start">
            <Tabs.Tab id="members" className="w-auto gap-2 px-3">
              Members
              <Chip size="sm" className="tabular">
                {members.length}
              </Chip>
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="presets" className="w-auto px-3">
              Role presets and permissions
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="members" className="flex flex-col gap-5 p-0">
          <section className="flex flex-col gap-2.5" aria-labelledby="mem-h">
            <SectionHeader
              id="mem-h"
              title="Members"
              className="items-center"
              action={
                <Segment
                  aria-label="Filter members"
                  selectedKey={filter}
                  onSelectionChange={(k) => setFilter(String(k) as Filter)}
                >
                  {FILTERS.map((f) => (
                    <Segment.Item key={f.id} id={f.id}>
                      <Segment.Separator />
                      {f.label} {members.filter((m) => inFilter(m.status, f.id)).length}
                    </Segment.Item>
                  ))}
                </Segment>
              }
            />
            <Table>
              <Table.ScrollContainer>
                <Table.Content aria-label="Members">
                  <Table.Header>
                    <Table.Column isRowHeader>Member</Table.Column>
                    <Table.Column>Role</Table.Column>
                    <Table.Column>Scope</Table.Column>
                    <Table.Column>Status</Table.Column>
                    <Table.Column>Last active</Table.Column>
                    <Table.Column>Sign-in</Table.Column>
                    <Table.Column className="text-right">
                      <span className="sr-only">Manage</span>
                    </Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {shown.map((m) => {
                      const role = roleById.get(m.role);
                      const status = TEAM_ROLES_STATUS[m.status];
                      const isSelected = panelOpen && selected?.id === m.id;
                      return (
                        <Table.Row key={m.id} id={m.id} className={isSelected ? "bg-accent-soft" : undefined}>
                          <Table.Cell>
                            <span className="flex items-center gap-2.5">
                              <Avatar size="sm" variant="soft" color={toneColor(m.avatarTone)}>
                                <Avatar.Fallback>{m.initials}</Avatar.Fallback>
                              </Avatar>
                              <span className="flex min-w-0 flex-col">
                                <span className="font-medium">{m.name}</span>
                                <span className="text-xs text-muted">{m.contact}</span>
                              </span>
                            </span>
                          </Table.Cell>
                          <Table.Cell>
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span>{role?.name ?? m.role}</span>
                              {role?.proposed ? (
                                <Chip size="sm" variant="soft" color="warning">
                                  Proposed role
                                </Chip>
                              ) : null}
                            </span>
                          </Table.Cell>
                          <Table.Cell className="max-w-[220px] text-[13px] whitespace-normal">{m.scope}</Table.Cell>
                          <Table.Cell>
                            <Chip size="sm" variant="soft" color={toneColor(status.tone)}>
                              {status.label}
                            </Chip>
                          </Table.Cell>
                          <Table.Cell className="max-w-[200px] text-[13px] whitespace-normal">
                            {m.lastActive}
                          </Table.Cell>
                          <Table.Cell className="text-[13px]">{m.status === "revoked" ? "—" : m.signIn}</Table.Cell>
                          <Table.Cell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={`Manage ${m.name}`}
                              onPress={() => openMember(m.id)}
                            >
                              Manage
                            </Button>
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
            <p className="text-xs text-muted">
              A member is a sign-in. Employee files, contracts and pay live in People; removing someone here does not
              end their employment.
            </p>
          </section>

          <section aria-labelledby="own-h">
            <Card variant="secondary" className="flex-row flex-wrap items-center gap-2 px-[18px] py-4">
              <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-0.5">
                <h2 id="own-h" className="text-[15px] leading-[22px] font-semibold">
                  Ownership
                </h2>
                <p className="text-[13px] leading-[18px] text-muted">{ownText}</p>
              </div>
              <Button variant="secondary" onPress={openTransfer} isDisabled={typeof transfer === "object"}>
                <ShieldKeyhole className="size-4" aria-hidden="true" />
                Transfer ownership
              </Button>
            </Card>
          </section>
        </Tabs.Panel>

        <Tabs.Panel id="presets" className="p-0">
          <TeamRolesPresets
            areas={areas}
            roles={roles}
            has={has}
            countFor={countFor}
            open={open}
            onToggleArea={(id) => setOpen((o) => ({ ...o, [id]: !o[id] }))}
            customise={customise}
            changes={changes}
            saved={saved}
            onStartCustomise={() => {
              setCustomise(true);
              setSaved(false);
            }}
            onDiscard={() => {
              setCustomise(false);
              setEdits({});
            }}
            onSave={() => {
              const next = applyEdits(presets, edits, all);
              const changedRoles = [...new Set(Object.keys(edits).map((k) => k.split(":")[0] as TeamRolesRoleId))];
              void write(
                () => saveTeamRolePresets(Object.fromEntries(changedRoles.map((r) => [r, next[r]]))),
                () => {
                  setPresets(next);
                  setEdits({});
                  setCustomise(false);
                  setSaved(true);
                  toast.success("Presets saved · each change is recorded in the audit log");
                },
              );
            }}
            onToggle={(role, permission, on) => {
              setSaved(false);
              setEdits((e) => ({ ...e, [`${role}:${permission}`]: on }));
            }}
          />
        </Tabs.Panel>
      </Tabs>

      <TeamRolesDrawer
        isOpen={panelOpen && !!drawer}
        onClose={closePanel}
        title={drawer?.title ?? ""}
        subtitle={drawer?.subtitle ?? ""}
        footer={drawer?.footer}
      >
        {drawer?.body}
      </TeamRolesDrawer>

      <TeamRolesTransfer
        isOpen={transfer === "open"}
        onClose={() => setTransfer((t) => (t === "open" ? "idle" : t))}
        candidates={candidates}
        afterRoles={afterRoles}
        phone={draft.verifyPhone}
        onRequest={(to) => requestTransfer(to)}
      />
    </PageContent>
  );
}
