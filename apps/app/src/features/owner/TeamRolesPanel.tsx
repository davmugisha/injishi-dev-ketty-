"use client";

import { CircleInfo, TriangleExclamation, Xmark } from "@gravity-ui/icons";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Checkbox,
  CheckboxGroup,
  Chip,
  Description,
  Drawer,
  FieldError,
  Input,
  Label,
  TextField,
} from "@heroui/react";
import { CellSwitch, RadioButtonGroup, Segment } from "@heroui-pro/react";
import type {
  TeamRolesInviteDraft,
  TeamRolesRole,
  TeamRolesRoleId,
  TeamRolesScope,
  Tone,
} from "@injishi/data/fixtures/owner";
import { KeyValueList, toneColor } from "@injishi/ui";
import type { ReactNode } from "react";

/** Right-hand side panel of Team and roles (artifact: .ij-panel over .ij-scrim--right). */
export function TeamRolesDrawer({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Drawer.Backdrop isOpen={isOpen} onOpenChange={(open) => (open ? null : onClose())}>
      <Drawer.Content placement="right">
        <Drawer.Dialog
          aria-labelledby="pnl-h"
          className="w-full max-w-full gap-0 overflow-hidden p-0 sm:m-2 sm:h-[calc(100%-16px)] sm:w-[460px] sm:rounded-3xl"
        >
          <Drawer.Header className="flex-row items-start gap-3 px-5 pt-5 pb-3">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <Drawer.Heading id="pnl-h" className="text-lg leading-[26px] font-semibold">
                {title}
              </Drawer.Heading>
              <p className="text-[13px] leading-[18px] text-muted">{subtitle}</p>
            </div>
            <Button variant="ghost" isIconOnly aria-label="Close" onPress={onClose}>
              <Xmark className="size-4" aria-hidden="true" />
            </Button>
          </Drawer.Header>
          <Drawer.Body className="mt-0 flex flex-col gap-4 px-5 pt-1 pb-5 text-foreground">{children}</Drawer.Body>
          {footer ? (
            <Drawer.Footer className="mt-0 flex-wrap border-t border-separator px-5 pt-3 pb-5">{footer}</Drawer.Footer>
          ) : null}
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}

/** Member identity row at the top of the Manage Member panel. */
export function TeamRolesIdentity({
  initials,
  name,
  contact,
  tone,
  status,
  statusTone,
}: {
  initials: string;
  name: string;
  contact: string;
  tone: Tone;
  status: string;
  statusTone: Tone;
}) {
  return (
    <div className="flex items-center gap-3">
      <Avatar variant="soft" color={toneColor(tone)}>
        <Avatar.Fallback>{initials}</Avatar.Fallback>
      </Avatar>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="font-semibold">{name}</span>
        <span className="text-[13px] text-muted">{contact}</span>
        <Chip size="sm" variant="soft" color={toneColor(statusTone)} className="self-start">
          {status}
        </Chip>
      </div>
    </div>
  );
}

/** Role preset picker (artifact: radio-button-group--grid "Role"). */
export function TeamRolesRolePicker({
  roles,
  value,
  onChange,
  countFor,
}: {
  roles: TeamRolesRole[];
  value: TeamRolesRoleId;
  onChange: (role: TeamRolesRoleId) => void;
  countFor: (role: TeamRolesRole) => number;
}) {
  return (
    <RadioButtonGroup
      layout="grid"
      variant="secondary"
      value={value}
      onChange={(v) => onChange(v as TeamRolesRoleId)}
      className="grid-cols-1 gap-2 sm:grid-cols-2"
    >
      <Label className="col-span-full">Role</Label>
      {roles.map((r) => (
        <RadioButtonGroup.Item key={r.id} value={r.id} className="px-3 py-2.5">
          <RadioButtonGroup.ItemContent className="gap-0.5">
            <span className="flex items-center justify-between gap-1.5">
              <span className="text-[13px] font-semibold">{r.name}</span>
              {r.proposed ? (
                <Chip size="sm" variant="soft" color="warning">
                  Proposed role
                </Chip>
              ) : null}
            </span>
            <span className="text-xs text-muted">
              {r.beingDefined ? "Permissions being defined" : `${countFor(r)} permissions`}
            </span>
          </RadioButtonGroup.ItemContent>
        </RadioButtonGroup.Item>
      ))}
    </RadioButtonGroup>
  );
}

/** Warning shown when the chosen role is still a proposal. */
export function TeamRolesProposedAlert({ role }: { role: TeamRolesRole }) {
  if (!role.proposed) return null;
  return (
    <Alert status="warning">
      <Alert.Indicator>
        <TriangleExclamation />
      </Alert.Indicator>
      <Alert.Content>
        <Alert.Title>{role.name} is a proposed role</Alert.Title>
        <Alert.Description>
          Its permission set may still change. You will be told before any change applies to this member.
        </Alert.Description>
      </Alert.Content>
    </Alert>
  );
}

/** What the chosen role can do: its permission keys and what it cannot do. */
export function TeamRolesRoleSummary({ role, permissions }: { role: TeamRolesRole; permissions: string[] }) {
  return (
    <Card variant="secondary" className="gap-1.5 px-3.5 py-3">
      <span className="text-[13px] font-semibold">What {role.name} can do</span>
      <div className="flex flex-wrap gap-1">
        {permissions.map((p) => (
          <Chip key={p} size="sm" variant="soft" className="font-mono">
            {p}
          </Chip>
        ))}
      </div>
      <span className="text-xs leading-4 text-muted">{role.cannot}</span>
    </Card>
  );
}

/** Scope tree: legal entities as headings, their properties and outlets as checkboxes. */
export function TeamRolesScopePicker({
  scopes,
  value,
  onChange,
}: {
  scopes: TeamRolesScope[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <CheckboxGroup value={value} onChange={onChange} isInvalid={value.length === 0} className="flex flex-col gap-1.5">
      <Label>Scope · legal entity, property and outlet</Label>
      <div className="flex flex-col gap-0.5">
        {scopes.map((s) =>
          s.kind === "entity" ? (
            <div key={s.id} className="flex flex-col py-1">
              <span className="text-[13px] font-semibold">{s.label}</span>
              <span className="text-xs text-muted">{s.description}</span>
            </div>
          ) : (
            <Checkbox
              key={s.id}
              value={s.id}
              variant="secondary"
              isDisabled={s.kind === "merchant"}
              className={s.level === 2 ? "pl-9" : "pl-3"}
            >
              <Checkbox.Content className="items-start gap-2 py-1">
                <Checkbox.Control className="mt-0.5">
                  <Checkbox.Indicator />
                </Checkbox.Control>
                <span className="flex flex-col">
                  <span className="text-[13px]">{s.label}</span>
                  <span className="text-xs text-muted">{s.description}</span>
                </span>
              </Checkbox.Content>
            </Checkbox>
          ),
        )}
      </div>
      <FieldError className="text-xs">Choose at least one property or outlet.</FieldError>
    </CheckboxGroup>
  );
}

/** Where the step-up code went, and the "Send code" press (the API emails it: `POST /me/two-factor/send`). */
export interface TeamRolesStepUpChannel {
  /** The masked address the API answered, or null before a code was asked for. */
  sentTo: string | null;
  sending: boolean;
  onSend: () => void;
}

/**
 * Step-up verification code (artifact: card with "Verify it’s you"). The code is emailed by the API and checked
 * by the API when the grant is sent (`POST /me/two-factor/verify`); this field never decides a code is good.
 * Without a `channel` the step-up is shown as not available: the field takes nothing.
 */
export function TeamRolesStepUp({
  channel,
  value,
  onChange,
  description,
}: {
  channel: TeamRolesStepUpChannel | null;
  value: string;
  onChange: (code: string) => void;
  description?: string;
}) {
  return (
    <Card variant="secondary" className="gap-1.5 px-3.5 py-3">
      <TextField value={value} onChange={onChange} isDisabled={!channel} className="gap-1.5">
        <Label>{channel?.sentTo ? `Verify it’s you · code emailed to ${channel.sentTo}` : "Verify it’s you"}</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="6-digit code"
            autoComplete="one-time-code"
            inputMode="numeric"
            maxLength={7}
            className="max-w-[200px] tracking-[0.2em]"
          />
          {channel ? (
            <Button size="sm" variant="secondary" isDisabled={channel.sending} onPress={channel.onSend}>
              {channel.sentTo ? "Send a new code" : "Email me a code"}
            </Button>
          ) : null}
        </div>
        {description ? <Description>{description}</Description> : null}
      </TextField>
    </Card>
  );
}

export interface TeamRolesInviteState {
  name: string;
  contact: string;
  role: TeamRolesRoleId;
  scope: string[];
  expiry: string;
  endDate: string;
  twoStep: boolean;
  code: string;
}

/** Body of the Invite a Member panel. */
export function TeamRolesInviteForm({
  draft,
  state,
  onChange,
  roles,
  scopes,
  countFor,
  permissionsFor,
  stepUp,
}: {
  draft: TeamRolesInviteDraft;
  state: TeamRolesInviteState;
  onChange: (patch: Partial<TeamRolesInviteState>) => void;
  roles: TeamRolesRole[];
  scopes: TeamRolesScope[];
  countFor: (role: TeamRolesRole) => number;
  permissionsFor: (role: TeamRolesRole) => string[];
  stepUp: TeamRolesStepUpChannel;
}) {
  const role = roles.find((r) => r.id === state.role) ?? roles[0];
  const expiry = draft.expiries.find((e) => e.id === state.expiry) ?? draft.expiries[0];
  return (
    <>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <TextField value={state.name} onChange={(name) => onChange({ name })} className="gap-1">
          <Label>Full name</Label>
          <Input variant="secondary" />
        </TextField>
        <TextField value={state.contact} onChange={(contact) => onChange({ contact })} className="gap-1">
          <Label>Email</Label>
          <Input variant="secondary" />
        </TextField>
      </div>

      <TeamRolesRolePicker
        roles={roles}
        value={state.role}
        onChange={(r) => onChange({ role: r })}
        countFor={countFor}
      />
      {role ? (
        <>
          <TeamRolesProposedAlert role={role} />
          <TeamRolesRoleSummary role={role} permissions={permissionsFor(role)} />
        </>
      ) : null}

      <TeamRolesScopePicker scopes={scopes} value={state.scope} onChange={(scope) => onChange({ scope })} />

      <div className="flex flex-col gap-1.5">
        <Label id="exp-l">Invite link expires after</Label>
        <Segment
          aria-label="Invite expiry"
          selectedKey={state.expiry}
          onSelectionChange={(k) => onChange({ expiry: String(k) })}
          className="self-start"
        >
          {draft.expiries.map((e) => (
            <Segment.Item key={e.id} id={e.id}>
              <Segment.Separator />
              {e.label}
            </Segment.Item>
          ))}
        </Segment>
        <p className="text-xs leading-4 text-muted">
          Link stops working on {expiry?.expiresOn} at {draft.expiresAt} if not accepted.
        </p>
      </div>

      {/* An invitation carries no end date on the platform, so the field takes nothing rather than drop what is typed. */}
      <TextField value={state.endDate} isDisabled className="gap-1">
        <Label>Access ends (optional)</Label>
        <Input variant="secondary" placeholder="No end date, for permanent staff" />
        <Description>
          An end date is not available yet: access does not stop on its own. Revoke it when the person leaves.
        </Description>
      </TextField>

      {/* Every sign-in to a business steps up with an emailed code (F-S02), whatever the role, so this is never off. */}
      <div className="flex flex-col gap-1.5">
        <CellSwitch variant="secondary" isSelected isDisabled className="w-full">
          <CellSwitch.Trigger>
            <CellSwitch.Label>Require two-step verification</CellSwitch.Label>
            <CellSwitch.Control />
          </CellSwitch.Trigger>
        </CellSwitch>
        <p className="text-xs leading-4 text-muted">
          Always on: everyone who works in a business confirms an emailed code when they sign in.
        </p>
      </div>

      <TeamRolesStepUp
        channel={stepUp}
        value={state.code}
        onChange={(code) => onChange({ code })}
        description="Granting access always needs step-up verification. The code is checked when you send the invite."
      />
    </>
  );
}

/** Body of the Manage Member panel. */
export function TeamRolesMemberDetail({
  identity,
  facts,
  help,
}: {
  identity: ReactNode;
  facts: { label: string; value: ReactNode }[];
  help: string;
}) {
  return (
    <>
      {identity}
      <KeyValueList items={facts} />
      <Alert>
        <Alert.Indicator>
          <CircleInfo />
        </Alert.Indicator>
        <Alert.Content>
          <Alert.Description>{help}</Alert.Description>
        </Alert.Content>
      </Alert>
    </>
  );
}
