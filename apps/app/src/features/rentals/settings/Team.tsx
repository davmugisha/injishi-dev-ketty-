"use client";

import { Avatar, Chip, Description, Label, toast } from "@heroui/react";
import { ListView, RadioButtonGroup } from "@heroui-pro/react";
import type { OperatorStaffInvitation, OperatorTeamMember, OrgRole } from "@injishi/contracts";
import {
  ActionButton,
  ConfirmDialog,
  FormDialog,
  formatDay,
  Icon,
  IconAction,
  RowActions,
  SectionCard,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { changeTeamRole, inviteTeamMember, revokeTeamInvitation } from "../actions";
import { fieldErrorsOnly, TextInput } from "../fields";

/**
 * The roles a landlord gives, in a landlord's words. The API's roles are the platform's; only those that
 * mean something in a rentals business are offered (a receptionist or HR role has nothing to do here).
 * The API decides what each may do.
 */
const ROLES = [
  { id: "manager", label: "Manager", detail: "Units, leases, rent, faults and money. Not the team." },
  { id: "finance", label: "Money", detail: "Rent, expenses and taxes." },
  { id: "housekeeper", label: "Caretaker", detail: "Faults only." },
] as const satisfies readonly { id: OrgRole; label: string; detail: string }[];
type LandlordRole = (typeof ROLES)[number]["id"];

const ROLE_LABEL: Partial<Record<OrgRole, string>> = {
  owner: "Owner",
  ...Object.fromEntries(ROLES.map((r) => [r.id, r.label])),
};
const roleLabel = (role: OrgRole): string => ROLE_LABEL[role] ?? role.charAt(0).toUpperCase() + role.slice(1);

const initials = (name: string | null, email: string | null): string => {
  const words = (name ?? email ?? "?")
    .replace(/@.*/, "")
    .split(/[\s._-]+/)
    .filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words[1][0]}` : (words[0] ?? "?").slice(0, 2)).toUpperCase();
};

function RolePicker({ value, onChange }: { value: LandlordRole; onChange: (role: LandlordRole) => void }) {
  return (
    <RadioButtonGroup aria-label="Role" layout="grid" value={value} onChange={(v) => onChange(v as LandlordRole)}>
      {ROLES.map((r) => (
        <RadioButtonGroup.Item key={r.id} value={r.id} className="gap-1 px-3.5 py-3">
          <RadioButtonGroup.Indicator>
            <Icon name="CircleCheckFill" />
          </RadioButtonGroup.Indicator>
          <RadioButtonGroup.ItemContent>
            <Label className="font-semibold">{r.label}</Label>
            <Description className="text-xs">{r.detail}</Description>
          </RadioButtonGroup.ItemContent>
        </RadioButtonGroup.Item>
      ))}
    </RadioButtonGroup>
  );
}

function InviteDialog({ isOpen, onOpenChange }: { isOpen: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<LandlordRole>("manager");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const reset = () => {
    setName("");
    setEmail("");
    setRole("manager");
    setErrors({});
    setFormError(null);
  };
  return (
    <FormDialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) reset();
        onOpenChange(open);
      }}
      title="Invite to the team"
      description="They get an email link that works for 7 days."
      submitLabel="Send invitation"
      submitIcon="PaperPlane"
      isPending={pending}
      validationErrors={errors}
      formError={formError}
      onSubmit={(event) => {
        event.preventDefault();
        start(async () => {
          const result = await inviteTeamMember({ name: name.trim() || undefined, email, orgRole: role });
          if (!result.ok) {
            setErrors(fieldErrorsOnly(result.fieldErrors));
            setFormError(result.fieldErrors ? null : result.error);
            return;
          }
          toast.success(`Invitation sent to ${result.value.email}`);
          reset();
          onOpenChange(false);
          router.refresh();
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput label="Name" name="name" value={name} onChange={setName} autoFocus />
        <TextInput label="Email" name="email" value={email} onChange={setEmail} inputMode="email" isRequired />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Role</span>
        <RolePicker value={role} onChange={setRole} />
      </div>
    </FormDialog>
  );
}

function RoleDialog({ member, onClose }: { member: OperatorTeamMember | null; onClose: () => void }) {
  const router = useRouter();
  const current = ROLES.find((r) => r.id === member?.orgRole)?.id ?? "manager";
  const [role, setRole] = useState<LandlordRole>(current);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <FormDialog
      isOpen={member !== null}
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={`Role of ${member?.name ?? member?.email ?? "this person"}`}
      submitLabel="Save role"
      isPending={pending}
      formError={formError}
      isSubmitDisabled={role === member?.orgRole}
      onSubmit={(event) => {
        event.preventDefault();
        if (!member) return;
        start(async () => {
          const result = await changeTeamRole(member.userId, { orgRole: role });
          if (!result.ok) {
            setFormError(result.error);
            return;
          }
          toast.success("Role changed");
          onClose();
          router.refresh();
        });
      }}
    >
      <RolePicker value={role} onChange={setRole} />
    </FormDialog>
  );
}

interface Row {
  id: string;
  name: string | null;
  email: string | null;
  role: OrgRole;
  /** What the second line says: when they joined or were invited. */
  meta: string;
  member: OperatorTeamMember | null;
  invitation: OperatorStaffInvitation | null;
}

/** Settings > Team: who can sign in to the business, in which role; invite, change a role, cancel an invitation. */
export function Team({
  members,
  invitations,
}: {
  members: OperatorTeamMember[];
  invitations: OperatorStaffInvitation[];
}) {
  const router = useRouter();
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<OperatorTeamMember | null>(null);
  const [revoking, setRevoking] = useState<OperatorStaffInvitation | null>(null);
  const [pending, start] = useTransition();
  const rows: Row[] = [
    ...members
      .filter((m) => m.status === "active")
      .map((m) => ({
        id: m.userId,
        name: m.name,
        email: m.email,
        role: m.orgRole,
        meta: `Joined ${formatDay(m.joinedAt.slice(0, 10))}`,
        member: m,
        invitation: null,
      })),
    ...invitations
      .filter((i) => i.status === "sent")
      .map((i) => ({
        id: i.id,
        name: i.name,
        email: i.email,
        role: i.orgRole,
        meta: `Invited, link works until ${formatDay(i.expiresAt.slice(0, 10))}`,
        member: null,
        invitation: i,
      })),
  ];
  return (
    <SectionCard
      title="Team"
      actions={
        <ActionButton icon="PersonPlus" onPress={() => setInviting(true)}>
          Invite
        </ActionButton>
      }
      contentClassName="gap-0"
    >
      <ListView aria-label="Team" variant="secondary" items={rows}>
        {(row) => (
          <ListView.Item id={row.id} textValue={row.name ?? row.email ?? row.id}>
            <ListView.ItemContent className="gap-3">
              <Avatar size="sm" variant="soft" color={row.invitation ? "default" : "accent"} className="shrink-0">
                <Avatar.Fallback>{initials(row.name, row.email)}</Avatar.Fallback>
              </Avatar>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <ListView.Title className="flex items-center gap-2">
                  <span className="truncate">{row.name ?? row.email}</span>
                  <Chip size="sm" variant="soft" color={row.invitation ? "warning" : "default"}>
                    {row.invitation ? `${roleLabel(row.role)}, invited` : roleLabel(row.role)}
                  </Chip>
                </ListView.Title>
                <ListView.Description className="truncate">
                  {row.name && row.email ? `${row.email} · ${row.meta}` : row.meta}
                </ListView.Description>
              </span>
            </ListView.ItemContent>
            <ListView.ItemAction>
              <RowActions>
                {row.member && row.role !== "owner" ? (
                  <IconAction icon="Pencil" label="Change role" onPress={() => setEditing(row.member)} />
                ) : null}
                {row.invitation ? (
                  <IconAction
                    icon="Xmark"
                    label="Cancel invitation"
                    intent="danger"
                    onPress={() => setRevoking(row.invitation)}
                  />
                ) : null}
              </RowActions>
            </ListView.ItemAction>
          </ListView.Item>
        )}
      </ListView>
      {rows.length <= 1 ? (
        <p className="pt-3 text-sm text-muted">Invite a manager, someone for the money or a caretaker for faults.</p>
      ) : null}
      <InviteDialog isOpen={inviting} onOpenChange={setInviting} />
      <RoleDialog key={editing?.userId ?? "none"} member={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        isOpen={revoking !== null}
        onOpenChange={(open) => (open ? undefined : setRevoking(null))}
        title="Cancel this invitation?"
        confirmLabel="Cancel invitation"
        intent="danger"
        isPending={pending}
        onConfirm={() =>
          start(async () => {
            if (!revoking) return;
            const result = await revokeTeamInvitation(revoking.id);
            if (!result.ok) {
              toast.danger(result.error);
              return;
            }
            toast.success("Invitation cancelled");
            setRevoking(null);
            router.refresh();
          })
        }
      >
        {revoking ? `The link sent to ${revoking.email} stops working.` : null}
      </ConfirmDialog>
    </SectionCard>
  );
}
