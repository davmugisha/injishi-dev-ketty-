"use client";

import {
  ArrowsRotateRight,
  CircleCheckFill,
  CircleInfoFill,
  CircleXmarkFill,
  ListTimeline,
  Lock,
  Plus,
  TriangleExclamationFill,
} from "@gravity-ui/icons";
import { Avatar, Button, Card, Chip, Toast, toast } from "@heroui/react";
import { Segment } from "@heroui-pro/react";
import { screenHref } from "@injishi/data";
import type { IntegrationsConnection, IntegrationsStage, IntegrationsTest } from "@injishi/data/fixtures/owner";
import {
  GateChip,
  Icon,
  KeyValueList,
  LinkButton,
  PageContent,
  PageHeader,
  StatusDot,
  type Tone,
  toneColor,
} from "@injishi/ui";
import { type ReactNode, useState } from "react";
import { SettingsNav } from "./SettingsNav";

const TEST_KIND = {
  ok: { Icon: CircleCheckFill, className: "text-success", tone: "success" },
  warn: { Icon: TriangleExclamationFill, className: "text-warning", tone: "warning" },
  block: { Icon: CircleXmarkFill, className: "text-danger", tone: "danger" },
  info: { Icon: CircleInfoFill, className: "text-muted", tone: "default" },
} satisfies Record<IntegrationsTest["kind"], { Icon: unknown; className: string; tone: Tone }>;

const SUMMARY: { stage: IntegrationsStage; label: string; dot: Tone }[] = [
  { stage: "working", label: "working", dot: "success" },
  { stage: "certification", label: "connected, certification pending", dot: "warning" },
  { stage: "testing", label: "in sandbox or testing", dot: "warning" },
  { stage: "none", label: "not connected", dot: "info" },
];

/**
 * What this screen cannot do yet, said plainly. The connections are sample data (`owner.integrationsConnections`
 * is deferred) and no route runs a connection test, takes an integration request or reviews a credential
 * change, so these controls change nothing: the test results shown are the last ones on record.
 */
const unavailable = (what: string) =>
  toast.warning(`${what} is not available yet. These connections are sample data; nothing was run or sent.`);

function SubTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-[15px] leading-[22px] font-semibold">{children}</h3>;
}

export function IntegrationsView({ connections }: { connections: IntegrationsConnection[] }) {
  const [openId, setOpenId] = useState("gtbank");

  const open = connections.find((c) => c.id === openId) ?? connections[0];
  const others = connections.filter((c) => c.id !== open?.id);
  const configure = (id: string) => {
    setOpenId(id);
    document.getElementById("open-h")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <PageContent>
      <Toast.Provider placement="bottom" />
      <PageHeader
        eyebrow="Settings · Amahoro Hospitality Group"
        title="Integrations"
        description="Each connection shows what has actually been verified. Sandbox is not production, and connected is not certified."
        actions={
          <>
            <LinkButton href={screenHref("AuditLog")} variant="ghost">
              <ListTimeline className="size-4" />
              Connection history
            </LinkButton>
            <Button variant="secondary" onPress={() => unavailable("Requesting an integration")}>
              <Plus className="size-4" />
              Request an integration
            </Button>
          </>
        }
      />

      <SettingsNav current="Integrations" />

      <section aria-label="Summary" className="flex flex-wrap gap-2">
        {SUMMARY.map((s) => (
          <Chip key={s.stage} variant="soft">
            <StatusDot tone={s.dot} />
            <Chip.Label>
              {connections.filter((c) => c.stage === s.stage).length} {s.label}
            </Chip.Label>
          </Chip>
        ))}
      </section>

      {open ? (
        <Card aria-labelledby="open-h" className="gap-4 p-5">
          <div className="flex flex-wrap items-start gap-3.5">
            <Avatar variant="soft" color="accent" className="shrink-0">
              <Avatar.Fallback>
                <Icon name={open.icon} />
              </Avatar.Fallback>
            </Avatar>
            <div className="flex min-w-[min(240px,100%)] flex-1 flex-col gap-1">
              <span className="text-xs text-muted">{open.provider}</span>
              <h2 id="open-h" className="text-lg leading-[26px] font-semibold">
                {open.name}
              </h2>
              <div className="flex flex-wrap items-center gap-1.5">
                <Chip variant="soft" color={toneColor(open.statusTone)}>
                  {open.status}
                </Chip>
                {open.gate ? (
                  <GateChip icon={<Lock className="size-3" aria-hidden="true" />}>{open.gate}</GateChip>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {open.canTest ? (
                <Button variant="secondary" onPress={() => unavailable("Running the connection tests")}>
                  <ArrowsRotateRight className="size-4" />
                  Run tests again
                </Button>
              ) : null}
              {open.links.map((l) => (
                <LinkButton key={l.label} href={screenHref(l.board)} variant="ghost">
                  {l.label}
                </LinkButton>
              ))}
            </div>
          </div>

          <div className="grid items-start gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr))]">
            <div className="flex flex-col gap-2.5">
              <SubTitle>Configuration</SubTitle>
              {open.hasEnvironment ? (
                <>
                  <Segment aria-label="Environment" selectedKey="sandbox" className="self-start">
                    <Segment.Item id="sandbox">Sandbox</Segment.Item>
                    <Segment.Item id="production" isDisabled aria-describedby="env-why">
                      <Lock className="size-3.5" aria-hidden="true" />
                      Production
                    </Segment.Item>
                  </Segment>
                  <span id="env-why" className="text-xs text-muted">
                    Production unlocks only after every item in the checklist has evidence.
                  </span>
                </>
              ) : null}
              <KeyValueList
                className="grid-cols-[110px_minmax(0,1fr)]! text-xs! leading-[18px]!"
                items={open.config.map((c) => ({
                  label: c.label,
                  value: <span className="font-normal">{c.value}</span>,
                }))}
              />
            </div>

            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2">
                <SubTitle>Test Results</SubTitle>
                <span className="text-xs text-muted">{open.lastRun}</span>
              </div>
              <ul className="flex flex-col gap-2.5">
                {open.tests.map((t) => {
                  const k = TEST_KIND[t.kind];
                  return (
                    <li key={t.name} className="flex items-start gap-2.5">
                      <k.Icon aria-hidden="true" className={`mt-0.5 size-4 shrink-0 ${k.className}`} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-[13px] font-medium">{t.name}</span>
                        <span className="text-xs leading-4 text-muted">{t.detail}</span>
                      </span>
                      <Chip size="sm" variant="soft" color={toneColor(k.tone)} className="shrink-0">
                        {t.result}
                      </Chip>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="flex flex-col gap-2.5">
              <SubTitle>{open.listTitle}</SubTitle>
              <ul className="flex flex-col gap-2">
                {open.list.map((l) => (
                  <li key={l.label} className="flex items-start justify-between gap-2">
                    <span className="flex flex-col">
                      <span className="text-[13px]">{l.label}</span>
                      <span className="text-xs text-muted">{l.sub}</span>
                    </span>
                    <Chip size="sm" variant="soft" color={toneColor(l.tone)} className="shrink-0">
                      {l.status}
                    </Chip>
                  </li>
                ))}
              </ul>
              {open.action ? (
                <>
                  <Button
                    size="sm"
                    isDisabled={open.actionBlocked}
                    className="self-start"
                    onPress={() => unavailable(`“${open.action}”`)}
                  >
                    {open.action}
                  </Button>
                  {open.actionNote ? <span className="text-xs leading-4 text-muted">{open.actionNote}</span> : null}
                </>
              ) : null}
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid items-stretch gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(250px,100%),1fr))]">
        {others.map((c) => (
          <Card key={c.id} aria-label={c.name} className="gap-2.5 p-4">
            <div className="flex items-start gap-2.5">
              <Avatar size="sm" variant="soft" color={toneColor(c.tone)} className="shrink-0">
                <Avatar.Fallback>
                  <Icon name={c.icon} />
                </Avatar.Fallback>
              </Avatar>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-semibold">{c.name}</span>
                <span className="text-xs text-muted">{c.provider}</span>
              </span>
            </div>
            <Chip size="sm" variant="soft" color={toneColor(c.statusTone)} className="self-start">
              {c.status}
            </Chip>
            <ul className="flex flex-1 flex-col gap-1">
              {c.facts.map((f) => (
                <li key={f} className="text-xs leading-[17px]">
                  {f}
                </li>
              ))}
            </ul>
            <Button
              size="sm"
              variant="secondary"
              aria-controls="open-h"
              className="self-start"
              onPress={() => configure(c.id)}
            >
              Configure and test
            </Button>
          </Card>
        ))}
      </div>
    </PageContent>
  );
}
