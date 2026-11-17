"use client";

import { PersonPlus, ShieldKeyhole } from "@gravity-ui/icons";
import { Avatar, Button, Card, Chip, Table, Tabs, toast } from "@heroui/react";
import { Segment } from "@heroui-pro/react";
import { screenHref } from "@injishi/data";
import type {
  TeamRolesMember,
  TeamRolesMemberStatus,
  TeamRolesRole,
  TeamRolesRoleId,
} from "@injishi/data/fixtures/owner";
import { LinkButton, SectionHeader, toneColor } from "@injishi/ui";
import { type ReactNode, useMemo, useState } from "react";
import {
  cancelTeamInvite,
  changeTeamMember,
  saveTeamRolePresets,
  sendTeamInvite,
  sendTeamStepUpCode,
} from "./TeamRolesActions";
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
  type TeamRolesStepUpChannel,
} from "./TeamRolesPanel";
import { TeamRolesPresets } from "./TeamRolesPresets";
import { TeamRolesTransfer } from "./TeamRolesTransfer";
import { TeamRolesAccessRequests } from "./team-roles-access-requests";

export type TeamRolesTab = "members" | "presets";
type Tab = TeamRolesTab;
type Filter = "all" | "active" | "invited" | "revoked";
type Panel = { kind: "invite" } | { kind: "member"; id: string; editing: boolean };

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "invited", label: "Invited" },
  { id: "revoked", label: "Revoked" },
];

/** "Invited" also lists invites waiting for the owner's approval. */
const inFilter = (status: TeamRolesMemberStatus, filter: Filter) =>
  filter === "all" || status === filter || (filter === "invited" && status === "pending");

/**
 * Team and roles: the members, inviting, changing a member's role and scope, cancelling an invite, the access HR asked
 * for, role presets and permissions, and ownership. One component, drawn by Settings → Team (`TeamRolesView`, inside
 * the workspace page) and by the point of sale's Setup (inside the POS shell); every write goes through the same server
 * actions to the same team API. Where it sits decides only the header (`renderHeader` places the Invite and Transfer
 * buttons), which tab is open when the host drives it (`tab`), and which roles a business of that kind is offered
 * (`hideRoles`: a restaurant has no front desk); members holding a hidden role are still listed by their role's name.
 * `compact` drops the Last active and Sign-in columns where the page is narrower (both stay in the Manage panel).
 */
export function TeamRolesManager({
  data,
  renderHeader,
  tab: tabProp,
  onTabChange,
  hideRoles,
  compact = false,
}: {
  data: TeamRolesData;
  renderHeader: (actions: ReactNode) => ReactNode;
  tab?: Tab;
  onTabChange?: (tab: Tab) => void;
  hideRoles?: readonly TeamRolesRoleId[];
  compact?: boolean;
}) {
  const { areas, scopes, invite: draft } = data;
  const roles = useMemo(
    () => (hideRoles?.length ? data.roles.filter((r) => !hideRoles.includes(r.id)) : data.roles),
    [data.roles, hideRoles],
  );
  const all = useMemo(() => allPermissionKeys(areas), [areas]);
  const roleById = useMemo(() => new Map(data.roles.map((r) => [r.id, r])), [data.roles]);

  const [ownTab, setOwnTab] = useState<Tab>("members");
  const tab = tabProp ?? ownTab;
  const setTab = (next: Tab) => {
    setOwnTab(next);
    onTabChange?.(next);
  };
  const [filter, setFilter] = useState<Filter>("all");
  const [panel, setPanel] = useState<Panel>({ kind: "invite" });
  const [panelOpen, setPanelOpen] = useState(false);
  const [inviteState, setInviteState] = useState<TeamRolesInviteState>({
    name: draft.name,
    contact: draft.contact,
    role: "",
    // Every property of the business to begin with (2026-10-30): a business with one hotel had nothing
    // ticked, so the invite was invalid before anyone touched it. Unticking narrows the grant.
    scope: (() => {
      const live = scopes.filter((s) => s.kind === "property").map((s) => s.id);
      const kept = draft.scope.filter((id) => live.includes(id));
      return kept.length ? kept : live;
    })(),
    expiry: draft.expiry,
    endDate: "",
    twoStep: true,
    code: "",
  });
  const [busy, setBusy] = useState(false);
  const [changed, setChanged] = useState<Record<string, Partial<TeamRolesMember>>>({});
  // Where the API emailed the last step-up code (masked), once one was asked for.
  const [stepUpTo, setStepUpTo] = useState<string | null>(null);
  const [sendingCode, setSendingCode] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(areas.map((a) => [a.id, a.defaultOpen])),
  );
  const [presets, setPresets] = useState(() => presetsOf(roles));
  const [edits, setEdits] = useState<TeamRolesEdits>({});
  const [customise, setCustomise] = useState(false);
  const [saved, setSaved] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [edit, setEdit] = useState<{ role: TeamRolesRoleId; scope: string[]; code: string } | null>(null);

  const has = makeHas(presets, edits);
  const countFor = (r: TeamRolesRole) => all.filter((p) => has(r.id, p)).length + r.extraPermissions.length;
  const permissionsFor = (r: TeamRolesRole) => [...all.filter((p) => has(r.id, p)), ...r.extraPermissions];
  const changes = editCount(presets, edits);

  // Members: the business's list as the API answered it. A change made here is written there and the page
  // is read again after it, so the list never shows something that was not saved.
  const everyone = useMemo(() => data.members.map((m) => ({ ...m, ...changed[m.id] })), [data.members, changed]);
  const members = everyone;
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

  /** "Email me a code": the API emails a fresh step-up code for this session and says where it went. */
  const sendCode = async () => {
    setSendingCode(true);
    try {
      const result = await sendTeamStepUpCode();
      if (result.ok) {
        setStepUpTo(result.sentTo);
        toast.success(`Code sent to ${result.sentTo}`);
      } else toast.danger(result.message);
    } finally {
      setSendingCode(false);
    }
  };
  const stepUp: TeamRolesStepUpChannel = { sentTo: stepUpTo, sending: sendingCode, onSend: () => void sendCode() };

  const sendInvite = () => {
    const name = inviteState.name.trim() || inviteState.contact.trim();
    const role = inviteState.role;
    if (!role) {
      toast.danger("Choose a role.");
      return;
    }
    void write(
      () =>
        sendTeamInvite({
          name: inviteState.name,
          contact: inviteState.contact,
          role,
          scope: inviteState.scope,
          code: inviteState.code,
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
      // Access ends when the person's staff file is offboarded, which ends the membership with the employment
      // record. Neither this screen nor People can do that yet, so nothing changes here and the screen says so.
      toast.warning(
        `Revoking ${m.name}'s access is not available yet. It ends when their staff file is offboarded, which this interface cannot do yet.`,
      );
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
  /** Removed members stay listed: the record of who had access is the business's, and the API keeps it. */
  const remove = (m: TeamRolesMember) =>
    toast.warning(
      `Hiding ${m.name} from this list is not available yet. People whose access ended stay listed as the record of who had access.`,
    );
  const startEdit = (m: TeamRolesMember) => {
    setEdit({ role: m.role, scope: m.scopeIds, code: "" });
    setPanel({ kind: "member", id: m.id, editing: true });
  };
  const saveEdit = (m: TeamRolesMember) => {
    if (!edit) return;
    const sameScope = edit.scope.length === m.scopeIds.length && edit.scope.every((s) => m.scopeIds.includes(s));
    const next = { role: edit.role, scope: edit.scope };
    void write(
      () => changeTeamMember(m.id, { ...next, code: edit.code }),
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

  // Who may become owner is the API's answer (active, identity-verified by the platform's rule), not the list's flag.
  const candidates = (data.transferEligible ?? []).map((m) => ({
    id: m.userId,
    label: `${m.name} · ${m.roleLabel} · identity verified`,
  }));
  const afterRoles = roles
    .filter((r) => r.invitable && !r.proposed && r.id !== "staff")
    .map((r) => ({ id: r.id, label: `${r.name} · all properties` }));
  const openTransfer = () => {
    closePanel();
    setTransferOpen(true);
  };
  const waiting = data.ownershipTransfer ?? null;
  const ownText = waiting
    ? `${owner?.name ?? "The owner"} owns this business. A transfer to ${waiting.toName} is waiting for their answer until ${new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Kigali", day: "numeric", month: "short" }).format(new Date(waiting.expiresAt))}; nothing changes unless they accept.`
    : `${owner?.name ?? "The owner"} owns this business. Ownership moves only when another verified member accepts, after step-up verification${data.viewerIsOwner ? "" : ", and only the owner can ask for it"}.`;

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
          stepUp={stepUp}
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
              channel={stepUp}
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
      // Read from People (active files, matched on the sign-in's email), never assumed. Sessions are not
      // listed: no route reports a member's devices, so the panel names none.
      const email = sel.contact.trim().toLowerCase();
      const employee =
        sel.status === "invited" || sel.status === "pending"
          ? "None yet · an invitation is not a person"
          : data.employeeFiles === null
            ? "Not checked here · see People"
            : data.employeeFiles.includes(email)
              ? "On file · see People"
              : "No active file with this email in People";
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
    <>
      {renderHeader(
        <>
          {data.viewerIsOwner ? (
            <Button variant="ghost" onPress={openTransfer} data-ui="team-transfer">
              <ShieldKeyhole className="size-4" aria-hidden="true" />
              Transfer ownership
            </Button>
          ) : null}
          <Button onPress={openInvite} data-ui="team-invite">
            <PersonPlus className="size-4" aria-hidden="true" />
            Invite member
          </Button>
        </>,
      )}

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
          <TeamRolesAccessRequests requests={data.accessRequests ?? []} />
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
                    {compact ? null : <Table.Column>Last active</Table.Column>}
                    {compact ? null : <Table.Column>Sign-in</Table.Column>}
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
                          {compact ? null : (
                            <Table.Cell className="max-w-[200px] text-[13px] whitespace-normal">
                              {m.lastActive}
                            </Table.Cell>
                          )}
                          {compact ? null : (
                            <Table.Cell className="text-[13px]">{m.status === "revoked" ? "—" : m.signIn}</Table.Cell>
                          )}
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
          </section>

          <section aria-labelledby="own-h">
            <Card variant="secondary" className="flex-row flex-wrap items-center gap-2 px-[18px] py-4">
              <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-0.5">
                <h2 id="own-h" className="text-[15px] leading-[22px] font-semibold">
                  Ownership
                </h2>
                <p className="text-[13px] leading-[18px] text-muted" data-ui="ownership-text">
                  {ownText}
                </p>
              </div>
              {data.viewerIsOwner ? (
                <Button variant="secondary" onPress={openTransfer} data-ui="ownership-open">
                  <ShieldKeyhole className="size-4" aria-hidden="true" />
                  {waiting ? "View transfer" : "Transfer ownership"}
                </Button>
              ) : null}
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
        isOpen={transferOpen}
        onClose={() => setTransferOpen(false)}
        candidates={candidates}
        afterRoles={afterRoles}
        pending={waiting}
        stepUp={stepUp}
      />
    </>
  );
}
