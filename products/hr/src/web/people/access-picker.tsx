"use client";

import { CircleCheckFill, Clock, ShieldCheck } from "@gravity-ui/icons";
import { Alert, Checkbox, Chip, Description, FieldError, Input, Label, TextArea, TextField } from "@heroui/react";
import { RadioButtonGroup, Segment } from "@heroui-pro/react";
import type { AccessOptionsView, AccessRoleId } from "../../model/people.ts";

/** A login as the form holds it, before it is given. */
export interface AccessDraft {
  email: string;
  role: AccessRoleId;
  allBranches: boolean;
  branchIds: string[];
  note: string;
}

export function emptyAccess(options: AccessOptionsView, email = ""): AccessDraft {
  // The first role that goes out at once, so the default never waits for anybody.
  const first = options.roles.find((r) => !r.needsOwner) ?? options.roles[0];
  return { email, role: first?.id ?? "receptionist", allBranches: true, branchIds: [], note: "" };
}

/** The draft's own mistakes, by field, in the order a person meets them. */
export function accessErrors(draft: AccessDraft): Partial<Record<"email" | "branches", string>> {
  const out: Partial<Record<"email" | "branches", string>> = {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) out.email = "Enter their sign-in email.";
  if (!draft.allBranches && draft.branchIds.length === 0) out.branches = "Choose at least one branch.";
  return out;
}

/**
 * Choose a login: the address the invitation goes to, the access level (a role, with what it may do
 * at this business) and the branches it covers. A role that reaches money, staff files or payroll is
 * marked: with HR's rights it is asked of the owner, who approves it before the invitation is sent.
 */
export function AccessPicker({
  options,
  value,
  onChange,
  errors = {},
  idPrefix,
}: {
  options: AccessOptionsView;
  value: AccessDraft;
  onChange: (next: AccessDraft) => void;
  errors?: Partial<Record<"email" | "branches", string>>;
  idPrefix: string;
}) {
  const set = (patch: Partial<AccessDraft>) => onChange({ ...value, ...patch });
  const role = options.roles.find((r) => r.id === value.role) ?? options.roles[0];
  const ownerDecides = !!role?.needsOwner && !options.grantsEveryRole;
  const singleBranch = options.branches.length <= 1;

  return (
    <div className="flex flex-col gap-5">
      <TextField
        value={value.email}
        onChange={(email) => set({ email })}
        isInvalid={!!errors.email}
        isRequired
        className="flex max-w-[420px] flex-col gap-1"
      >
        <Label>Sign-in email</Label>
        <Input type="email" autoComplete="off" placeholder="name@example.com" />
        <Description>The invitation goes here.</Description>
        <FieldError>{errors.email}</FieldError>
      </TextField>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Access level</legend>
        <RadioButtonGroup
          aria-label="Access level"
          value={value.role}
          onChange={(v) => v && set({ role: v as AccessRoleId })}
          layout="grid"
          className="grid gap-2.5 sm:grid-cols-2"
        >
          {options.roles.map((r) => (
            <RadioButtonGroup.Item key={r.id} value={r.id} className="px-3.5 py-3">
              <RadioButtonGroup.Indicator>
                <CircleCheckFill />
              </RadioButtonGroup.Indicator>
              <RadioButtonGroup.ItemContent className="flex flex-col gap-1 pr-6">
                <Label className="flex flex-wrap items-center gap-2 font-semibold">
                  {r.label}
                  {r.needsOwner && !options.grantsEveryRole ? (
                    <Chip size="sm" variant="soft" color="warning" className="shrink-0">
                      Owner approves
                    </Chip>
                  ) : null}
                </Label>
                <Description className="text-xs leading-[18px]">{r.summary}</Description>
              </RadioButtonGroup.ItemContent>
            </RadioButtonGroup.Item>
          ))}
        </RadioButtonGroup>
      </fieldset>

      {role ? (
        <section aria-labelledby={`${idPrefix}-can-h`} className="flex flex-col gap-2.5 rounded-xl bg-default/60 p-3.5">
          <h4 id={`${idPrefix}-can-h`} className="flex items-center gap-1.5 text-[13px] font-semibold">
            <ShieldCheck className="size-4 text-muted" aria-hidden="true" />
            What a {role.label} login can do here
          </h4>
          {role.areas.length === 0 ? (
            <p className="text-xs text-muted">No permissions: the owner withdrew them.</p>
          ) : (
            <dl className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
              {role.areas.map((a) => (
                <div key={a.label} className="flex min-w-0 flex-col gap-1">
                  <dt className="text-xs font-medium text-muted">{a.label}</dt>
                  <dd className="flex flex-wrap gap-1">
                    {a.permissions.map((p) => (
                      <Chip key={p} size="sm" variant="soft">
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </Chip>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      ) : null}

      {singleBranch ? null : (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Branches</legend>
          <Segment
            aria-label="Branches"
            selectedKey={value.allBranches ? "all" : "some"}
            onSelectionChange={(k) => set({ allBranches: k === "all" })}
            className="self-start"
          >
            <Segment.Item id="all">Every branch</Segment.Item>
            <Segment.Item id="some">
              <Segment.Separator />
              Selected branches
            </Segment.Item>
          </Segment>
          {value.allBranches ? (
            <p className="text-xs text-muted">Includes branches opened later.</p>
          ) : (
            <div className="flex flex-col gap-2 pt-1">
              {options.branches.map((b) => (
                <Checkbox
                  key={b.id}
                  isSelected={value.branchIds.includes(b.id)}
                  onChange={(on) =>
                    set({
                      branchIds: on ? [...value.branchIds, b.id] : value.branchIds.filter((x) => x !== b.id),
                    })
                  }
                >
                  <Checkbox.Content>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <Label className="text-sm font-normal">{b.name}</Label>
                  </Checkbox.Content>
                </Checkbox>
              ))}
              {errors.branches ? <p className="text-xs text-danger">{errors.branches}</p> : null}
            </div>
          )}
        </fieldset>
      )}

      {ownerDecides ? (
        <div className="flex flex-col gap-3">
          <Alert status="warning">
            <Alert.Indicator>
              <Clock />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>The owner approves this login</Alert.Title>
            </Alert.Content>
          </Alert>
          <TextField value={value.note} onChange={(note) => set({ note })} className="flex flex-col gap-1">
            <Label>Note for the owner (optional)</Label>
            <TextArea rows={2} placeholder="Starts Monday; takes over supplier payments" />
          </TextField>
        </div>
      ) : null}
    </div>
  );
}
