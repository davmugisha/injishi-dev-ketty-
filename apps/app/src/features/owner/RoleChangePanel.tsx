"use client";

import { ArrowRight, CircleCheckFill, Minus, Plus, TriangleExclamation } from "@gravity-ui/icons";
import { Alert, Button, Checkbox, Chip, Label, Radio, RadioGroup } from "@heroui/react";
import type {
  TeamRolesMember,
  TeamRolesPermissionArea,
  TeamRolesRole,
  TeamRolesRoleId,
} from "@injishi/data/fixtures/owner";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { type AreaChange, permissionChange, roleChoices, roleKeys, sensitiveGains } from "./role-change-model";
import { changeTeamMemberRole } from "./TeamRolesActions";
import { isCode, TEAM_ROLES_STATUS, type TeamRolesPresets } from "./TeamRolesModel";
import { TeamRolesDrawer, TeamRolesIdentity, TeamRolesStepUp, type TeamRolesStepUpChannel } from "./TeamRolesPanel";

type Step = "choose" | "review" | "confirm" | "done";
const STEPS: { id: Exclude<Step, "done">; label: string }[] = [
  { id: "choose", label: "Choose" },
  { id: "review", label: "Review" },
  { id: "confirm", label: "Confirm" },
];

/**
 * Setup → Team → Manage → Change role: choose the new role, review exactly what the person gains and loses (the
 * business's own role settings), then confirm with the emailed code and a tick. Only the role is written, never the
 * branches; the API decides (only the owner may, never the owner's own role, never "owner") and audits it. Success is
 * shown only once the API answered, and the team is read again whatever the answer.
 */
export function RoleChangePanel({
  isOpen,
  member,
  roles,
  roleName,
  presets,
  areas,
  stepUp,
  onClose,
  onDone,
}: {
  isOpen: boolean;
  member: TeamRolesMember | null;
  /** The roles this kind of business offers (a restaurant has no front desk). */
  roles: TeamRolesRole[];
  roleName: (id: TeamRolesRoleId) => string;
  /** Each role's permissions as saved in this business. */
  presets: TeamRolesPresets;
  areas: TeamRolesPermissionArea[];
  stepUp: TeamRolesStepUpChannel;
  /** Back to the member, nothing changed. */
  onClose: () => void;
  /** Back to the member after a confirmed change. */
  onDone: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("choose");
  const [target, setTarget] = useState<string>("");
  const [code, setCode] = useState("");
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneAs, setDoneAs] = useState<{ name: string; from: string; to: string } | null>(null);
  const inFlight = useRef(false);
  const top = useRef<HTMLDivElement>(null);

  // A fresh start each time the panel opens for someone.
  const memberId = member?.id ?? null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: opening the panel for a member is the trigger
  useEffect(() => {
    if (!isOpen) return;
    setStep("choose");
    setTarget("");
    setCode("");
    setSure(false);
    setError(null);
    setDoneAs(null);
  }, [isOpen, memberId]);
  // Each step starts at its top.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the step is the trigger
  useEffect(() => {
    top.current?.scrollIntoView({ block: "start" });
  }, [step]);

  if (!member) return null;
  const current = member.role;
  const choices = roleChoices(roles, presets, current);
  const to = choices.find((c) => c.id === target && !c.current) ?? null;
  const change = to ? permissionChange(areas, roleKeys(presets, current), roleKeys(presets, to.id)) : null;
  const sensitive = change ? sensitiveGains(change) : [];
  const status = TEAM_ROLES_STATUS[member.status];
  const index = STEPS.findIndex((s) => s.id === step);
  const ready = !!to && isCode(code) && sure && !busy;
  const gainedCount = change?.gained.reduce((n, a) => n + a.items.length, 0) ?? 0;
  const lostCount = change?.lost.reduce((n, a) => n + a.items.length, 0) ?? 0;

  const save = async () => {
    if (!to || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const r = await changeTeamMemberRole(member.id, to.id, code);
      if (!r.ok) {
        // The API's own sentence (a wrong or old code, a role it refuses, someone no longer on the team). The team
        // was read again anyway, so the list shows what is really saved.
        setError(r.message);
        router.refresh();
        return;
      }
      setDoneAs({ name: member.name, from: roleName(current), to: to.name });
      setStep("done");
      router.refresh();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const body = (
    <div className="flex flex-col gap-4" data-ui="role-change">
      <div ref={top} />
      {step !== "done" ? (
        <ol className="flex items-center gap-1.5 text-[12.5px]" aria-label="Steps" data-ui="role-change-steps">
          {STEPS.map((s, i) => (
            <li
              key={s.id}
              aria-current={i === index ? "step" : undefined}
              className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-full px-2.5 py-1 ${
                i === index
                  ? "bg-accent-soft font-semibold text-accent-soft-foreground"
                  : i < index
                    ? "text-success"
                    : "text-muted"
              }`}
            >
              <span
                className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] ${
                  i < index ? "bg-success text-white" : i === index ? "bg-accent text-white" : "bg-default"
                }`}
              >
                {i + 1}
              </span>
              <span className="truncate">{s.label}</span>
            </li>
          ))}
        </ol>
      ) : null}

      <TeamRolesIdentity
        initials={member.initials}
        name={member.name}
        contact={member.contact}
        tone={member.avatarTone}
        status={status.label}
        statusTone={status.tone}
      />

      {step === "choose" ? (
        <div className="flex flex-col gap-3" data-ui="role-change-choose">
          <div className="flex items-center justify-between gap-2 rounded-2xl bg-surface-secondary px-3.5 py-3 text-sm">
            <span className="text-muted">Current role</span>
            <span className="flex items-center gap-2">
              <span className="font-semibold">{roleName(current)}</span>
              <span className="text-xs text-muted">{roleKeys(presets, current).length} permissions</span>
            </span>
          </div>
          <RadioGroup value={target} onChange={setTarget} className="gap-2" data-ui="role-change-options">
            <Label>New role</Label>
            {choices.map((c) => (
              <Radio
                key={c.id}
                value={c.id}
                isDisabled={c.current}
                className="rounded-2xl border border-separator px-3 py-2.5 data-selected:border-accent data-selected:bg-accent-soft/40 data-[focus-visible=true]:ring-2 data-[focus-visible=true]:ring-accent/40 data-[disabled=true]:opacity-60"
              >
                <Radio.Content className="flex w-full items-center gap-2.5">
                  <Radio.Control>
                    <Radio.Indicator />
                  </Radio.Control>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-xs text-muted">{c.count} permissions</span>
                  </span>
                  {c.current ? (
                    <Chip size="sm" variant="soft">
                      Current
                    </Chip>
                  ) : c.proposed ? (
                    <Chip size="sm" variant="soft" color="warning">
                      Proposed role
                    </Chip>
                  ) : null}
                </Radio.Content>
              </Radio>
            ))}
          </RadioGroup>
          <p className="text-[12.5px] text-muted">
            Only the role changes. {member.name} keeps their account, their history and the branches they cover (
            {member.scope}).
          </p>
        </div>
      ) : null}

      {(step === "review" || step === "confirm") && to && change ? (
        <div className="flex flex-col gap-4" data-ui="role-change-review">
          <div className="flex items-center justify-center gap-3 rounded-2xl bg-surface-secondary px-3.5 py-3 text-sm">
            <span className="font-semibold">{roleName(current)}</span>
            <ArrowRight className="size-4 text-muted" aria-hidden="true" />
            <span className="font-semibold text-accent">{to.name}</span>
          </div>
          {to.proposed ? (
            <Alert status="warning">
              <Alert.Content>
                <Alert.Title>{to.name} is a proposed role</Alert.Title>
                <Alert.Description>Its permissions may still change for everyone who holds it.</Alert.Description>
              </Alert.Content>
            </Alert>
          ) : null}
          {step === "review" ? (
            <>
              {sensitive.length ? (
                <Alert status="warning" data-ui="role-change-sensitive">
                  <Alert.Indicator>
                    <TriangleExclamation />
                  </Alert.Indicator>
                  <Alert.Content>
                    <Alert.Title>
                      {member.name} will get {sensitive.length} sensitive permission{sensitive.length === 1 ? "" : "s"}
                    </Alert.Title>
                    <Alert.Description>
                      <ul className="mt-1 flex flex-col gap-0.5">
                        {sensitive.map((s) => (
                          <li key={s.key}>
                            <span className="font-medium">{s.kind}:</span> {s.description}
                          </li>
                        ))}
                      </ul>
                    </Alert.Description>
                  </Alert.Content>
                </Alert>
              ) : null}
              <ChangeList title={`Will gain (${gainedCount})`} empty="Nothing new." areas={change.gained} sign="gain" />
              <ChangeList
                title={`Will lose (${lostCount})`}
                empty="Nothing is taken away."
                areas={change.lost}
                sign="lose"
              />
              <p className="text-[12.5px] text-muted" data-ui="role-change-kept">
                Keeps {change.kept} permission{change.kept === 1 ? "" : "s"} they already have. These are this
                business's own settings for each role (Roles and permissions).
              </p>
            </>
          ) : (
            <div className="flex flex-col gap-4" data-ui="role-change-confirm">
              <p className="text-sm">
                {member.name} gains {gainedCount} and loses {lostCount} permission{lostCount === 1 ? "" : "s"}
                {sensitive.length ? `, including ${sensitive.length} sensitive` : ""}. It applies from their next
                action; screens they have open may need a reload.
              </p>
              <TeamRolesStepUp
                channel={stepUp}
                value={code}
                onChange={setCode}
                description="Changing someone's access always needs a code from your email."
              />
              <Checkbox isSelected={sure} onChange={setSure} data-ui="role-change-sure">
                <Checkbox.Content className="flex items-start gap-2.5">
                  <Checkbox.Control className="mt-0.5">
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  <span className="text-sm">
                    I confirm that {member.name} becomes {to.name}.
                  </span>
                </Checkbox.Content>
              </Checkbox>
            </div>
          )}
        </div>
      ) : null}

      {step === "done" && doneAs ? (
        <div className="flex flex-col items-start gap-3" role="status" data-ui="role-change-done">
          <span className="flex size-11 items-center justify-center rounded-full bg-success-soft">
            <CircleCheckFill className="size-6 text-success" aria-hidden="true" />
          </span>
          <p className="text-lg leading-[26px] font-semibold">
            {doneAs.name} is now {doneAs.to}
          </p>
          <p className="text-sm text-muted">
            Changed from {doneAs.from} to {doneAs.to}. Their new permissions apply from their next action, and the
            change is recorded in the audit log.
          </p>
        </div>
      ) : null}

      {error && step !== "done" ? (
        <Alert status="danger" role="alert" data-ui="role-change-error">
          <Alert.Content>
            <Alert.Title>The role was not changed</Alert.Title>
            <Alert.Description>{error}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}
    </div>
  );

  const footer =
    step === "done" ? (
      <Button onPress={onDone} data-ui="role-change-finish">
        Done
      </Button>
    ) : (
      <div className="flex w-full flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" onPress={onClose} isDisabled={busy} data-ui="role-change-cancel">
          Cancel
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {index > 0 ? (
            <Button
              variant="secondary"
              isDisabled={busy}
              onPress={() => {
                setError(null);
                setStep(STEPS[index - 1]?.id ?? "choose");
              }}
              data-ui="role-change-back"
            >
              Back
            </Button>
          ) : null}
          {step === "choose" ? (
            <Button isDisabled={!to} onPress={() => setStep("review")} data-ui="role-change-next">
              {to ? "Review the change" : "Choose a new role"}
            </Button>
          ) : step === "review" ? (
            <Button onPress={() => setStep("confirm")} data-ui="role-change-next">
              Continue
            </Button>
          ) : (
            <Button isDisabled={!ready} onPress={() => void save()} data-ui="role-change-save">
              {busy ? "Changing role…" : `Change to ${to?.name ?? "the new role"}`}
            </Button>
          )}
        </div>
      </div>
    );

  return (
    <TeamRolesDrawer
      isOpen={isOpen}
      onClose={busy ? () => undefined : step === "done" ? onDone : onClose}
      title={step === "done" ? "Role changed" : "Change role"}
      subtitle={`${member.name} · ${roleName(current)}`}
      footer={footer}
    >
      {body}
    </TeamRolesDrawer>
  );
}

function ChangeList({
  title,
  empty,
  areas,
  sign,
}: {
  title: string;
  empty: string;
  areas: AreaChange[];
  sign: "gain" | "lose";
}) {
  const Icon = sign === "gain" ? Plus : Minus;
  return (
    <section className="flex flex-col gap-2" data-ui={sign === "gain" ? "role-change-gains" : "role-change-losses"}>
      <h3 className="text-sm font-semibold">{title}</h3>
      {areas.length === 0 ? (
        <p className="text-[13px] text-muted">{empty}</p>
      ) : (
        areas.map((a) => (
          <div key={a.areaId} className="rounded-xl border border-separator px-3 py-2.5">
            <p className="pb-1 text-[12px] font-medium tracking-wide text-muted uppercase">{a.areaLabel}</p>
            <ul className="flex flex-col gap-1">
              {a.items.map((p) => (
                <li key={p.key} className="flex items-start gap-2 text-[13px]">
                  <Icon
                    className={`mt-0.5 size-3.5 shrink-0 ${sign === "gain" ? "text-success" : "text-danger"}`}
                    aria-hidden="true"
                  />
                  <span>
                    <span className="sr-only">{sign === "gain" ? "Gains: " : "Loses: "}</span>
                    {p.description}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
