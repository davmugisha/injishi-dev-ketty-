"use client";

import {
  ArrowUpRightFromSquare,
  CircleCheck,
  CircleCheckFill,
  CircleInfoFill,
  CircleXmark,
  ShieldExclamation,
  ShieldKeyhole,
  TriangleExclamationFill,
} from "@gravity-ui/icons";
import { Alert, Avatar, Button, Card, Chip, Separator } from "@heroui/react";
import { Timeline } from "@heroui-pro/react";
import { screenHref } from "@injishi/data";
import type { ApprovalCheck, ApprovalRequest } from "@injishi/data/fixtures/owner";
import { GateChip, Icon, KeyValueList, LinkButton, TextLink, toneColor } from "@injishi/ui";
import type { ReactNode } from "react";

const CHECK_ICON = {
  ok: { Icon: CircleCheckFill, className: "text-success", sr: "Passed" },
  warn: { Icon: TriangleExclamationFill, className: "text-warning", sr: "Attention" },
  info: { Icon: CircleInfoFill, className: "text-muted", sr: "Note" },
} satisfies Record<ApprovalCheck["kind"], unknown>;

function SubTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-[15px] leading-[22px] font-semibold">{children}</h3>;
}

/**
 * The selected request: who asked and why, key figures, evidence, checks, rules, next steps and the decision.
 *
 * Deciding is not available yet. These requests are sample data (`owner.approvalRequests` waits on an
 * /architect decision about an approvals record that runs each subject's own command), so Approve and
 * Decline say so and change nothing: no decision is stored, nobody is told and no step-up code is asked for.
 */
export function ApprovalDetail({
  request: cur,
  onUnavailable,
  auditHref,
}: {
  request: ApprovalRequest;
  /** Tell the person that deciding this request is not available yet. */
  onUnavailable: (action: string) => void;
  auditHref: string;
}) {
  const status = cur.decision
    ? cur.decision === "approved"
      ? { label: "Approved by you", color: "success" as const }
      : { label: "Declined by you", color: "default" as const }
    : { label: "Waiting for you", color: "warning" as const };

  return (
    <Card aria-labelledby="ins-h" className="min-w-0 flex-[999_1_520px] gap-[18px] p-5">
      <div className="flex items-start gap-3.5">
        <Avatar variant="soft" color={toneColor(cur.tone)} className="shrink-0">
          <Avatar.Fallback>
            <Icon name={cur.icon} />
          </Avatar.Fallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-xs leading-4 font-medium text-muted">{cur.type}</span>
          <h2 id="ins-h" className="text-lg leading-[26px] font-semibold">
            {cur.title}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <Avatar size="sm">
              <Avatar.Fallback>{cur.initials}</Avatar.Fallback>
            </Avatar>
            <span className="text-[13px]">
              Requested by <strong className="font-semibold">{cur.who}</strong> · {cur.whoRole} · {cur.when}
            </span>
            {cur.whoProposed ? (
              <Chip size="sm" variant="soft" color="warning">
                Proposed role
              </Chip>
            ) : null}
          </div>
        </div>
        <Chip variant="soft" color={status.color} className="shrink-0">
          {status.label}
        </Chip>
      </div>

      <Card variant="secondary" className="gap-1 px-3.5 py-3">
        <span className="text-xs font-medium text-muted">Reason given</span>
        <p className="text-sm leading-5">“{cur.reason}”</p>
      </Card>

      {cur.decision === "approved" ? (
        <Alert status="success" role="status">
          <Alert.Indicator>
            <CircleCheck />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>{cur.okTitle}</Alert.Title>
            <Alert.Description>{cur.okDesc}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}
      {cur.decision === "declined" ? (
        <Alert status="default" role="status">
          <Alert.Indicator>
            <CircleXmark />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>Declined</Alert.Title>
            <Alert.Description>Reason given: “{cur.decisionReason}”. Nothing else changed.</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}

      <section
        aria-label="Key figures"
        className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(150px,100%),1fr))]"
      >
        {cur.figures.map((f) => (
          <Card key={f.label} variant="secondary" className="gap-0.5 px-3.5 py-3">
            <span className="text-xs leading-4 text-muted">{f.label}</span>
            <span className="text-base leading-6 font-semibold tabular">{f.value}</span>
          </Card>
        ))}
      </section>

      <div className="grid items-start gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr))]">
        <div className="flex flex-col gap-2.5">
          <SubTitle>Evidence</SubTitle>
          <KeyValueList
            items={cur.facts.map((f) => ({ label: f.label, value: <span className="font-normal">{f.value}</span> }))}
          />
        </div>
        <div className="flex flex-col gap-2.5">
          <SubTitle>Checks</SubTitle>
          <ul className="flex flex-col gap-2.5">
            {cur.checks.map((c) => {
              const k = CHECK_ICON[c.kind];
              return (
                <li key={c.text} className="flex items-start gap-2.5">
                  <k.Icon aria-hidden="true" className={`mt-0.5 size-4 shrink-0 ${k.className}`} />
                  <span className="text-[13px] leading-[19px]">
                    <span className="sr-only">{k.sr}: </span>
                    {c.text}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="grid items-start gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr))]">
        {cur.rules.length ? (
          <div className="flex flex-col gap-2.5">
            <SubTitle>Rules Used and Exceptions</SubTitle>
            {cur.rules.map((r) => (
              <div key={r.name} className="flex flex-col items-start gap-1.5">
                <span className="flex flex-col">
                  <span className="text-[13px] font-medium">{r.name}</span>
                  <span className="text-xs text-muted">{r.version}</span>
                </span>
                <GateChip icon={<ShieldExclamation className="size-3" aria-hidden="true" />}>
                  Configured · awaiting sign-off
                </GateChip>
              </div>
            ))}
            <Separator />
            {cur.exceptions.map((e) => (
              <div key={e.tag} className="flex flex-wrap items-start gap-2.5">
                <Chip size="sm" variant="soft" color="warning" className="shrink-0">
                  {e.tag}
                </Chip>
                <span className="text-[13px] leading-[19px]">{e.text}</span>
              </div>
            ))}
          </div>
        ) : null}
        <div className="flex flex-col gap-2.5">
          <SubTitle>What Happens Next</SubTitle>
          <Timeline size="sm" density="compact">
            {cur.after.map((a) => (
              <Timeline.Item key={a.title} status={a.status}>
                <Timeline.Rail>
                  <Timeline.Marker />
                  <Timeline.Connector />
                </Timeline.Rail>
                <Timeline.Content className="flex flex-col pb-0.5">
                  <span className="text-[13px] font-medium">{a.title}</span>
                  {a.detail ? <span className="text-xs leading-4 text-muted">{a.detail}</span> : null}
                </Timeline.Content>
              </Timeline.Item>
            ))}
          </Timeline>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted">Open the source:</span>
        {cur.links.map((l) => (
          <LinkButton key={l.label} href={screenHref(l.board)} size="sm" variant="ghost">
            <ArrowUpRightFromSquare className="size-4" />
            {l.label}
          </LinkButton>
        ))}
      </div>

      <Separator />

      {cur.decision ? (
        <p className="text-xs text-muted">
          Decisions are final and recorded in the <TextLink href={auditHref}>audit log</TextLink>. To change course,
          raise a new request.
        </p>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <span className="max-w-[420px] text-xs leading-4 text-muted">{cur.footNote}</span>
          <div className="flex items-center gap-2">
            <Button variant="danger-soft" onPress={() => onUnavailable("Declining a request")}>
              Decline
            </Button>
            <Button onPress={() => onUnavailable(`“${cur.approveLabel}”`)}>
              {cur.stepUp ? <ShieldKeyhole className="size-4" aria-hidden="true" /> : null}
              {cur.approveLabel}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
