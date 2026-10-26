"use client";

import { Check, CircleInfo, Eye, PersonPlus, PersonXmark, Pulse, Tray, TriangleExclamation } from "@gravity-ui/icons";
import { Alert, Avatar, Button, Card, Chip, Separator, Table, Tabs } from "@heroui/react";
import { EmptyState, ItemCard, KPIGroup, ListView, Segment, Timeline } from "@heroui-pro/react";
import { KPI } from "@heroui-pro/react/kpi";
import { type Persona, screenHref } from "@injishi/data";
import type {
  AdminKpi,
  Deploy,
  OnCallShift,
  Tone,
  TriageCategory,
  TriageItem,
  ViewAsSession,
} from "@injishi/data/fixtures/admin";
import { GateChip, Icon, LinkButton, PageContent, PageHeader, SectionHeader, StatusDot } from "@injishi/ui";
import NextLink from "next/link";
import { Fragment, type Key, useState } from "react";
import {
  CardHead,
  EventTimeline,
  FactRows,
  initials,
  lineTab,
  SubHeading,
  selectableRow,
  TabCount,
  ToneChip,
} from "./shared";

interface AdminHomeData {
  kpis: AdminKpi[];
  items: TriageItem[];
  deploys: Deploy[];
  onCall: OnCallShift[];
  sessions: ViewAsSession[];
}

const CATEGORY: Record<TriageCategory, { label: string; tone: Tone }> = {
  incident: { label: "Incident", tone: "danger" },
  kyb: { label: "KYB", tone: "accent" },
  fiscal: { label: "Fiscal queue", tone: "warning" },
  jobs: { label: "Jobs", tone: "default" },
  support: { label: "Support", tone: "info" },
  recon: { label: "Reconciliation", tone: "warning" },
  deploy: { label: "Deploy", tone: "default" },
};

const TABS: { id: "all" | TriageCategory; label: string }[] = [
  { id: "all", label: "All" },
  { id: "incident", label: "Incidents" },
  { id: "kyb", label: "KYB" },
  { id: "fiscal", label: "Fiscal" },
  { id: "jobs", label: "Jobs" },
  { id: "support", label: "Support" },
  { id: "recon", label: "Reconciliation" },
  { id: "deploy", label: "Deploys" },
];

type Scope = "all" | "mine" | "none";

const SCOPES: { id: Scope; label: string }[] = [
  { id: "all", label: "Everyone" },
  { id: "mine", label: "Mine" },
  { id: "none", label: "Unassigned" },
];

function firstKey(keys: "all" | Set<Key>): string | null {
  if (keys === "all") return null;
  const [k] = [...keys];
  return k === undefined ? null : String(k);
}

export function AdminHomeView({ persona, data }: { persona: Persona; data: AdminHomeData }) {
  const me = persona.name;
  const [tab, setTab] = useState<string>("all");
  const [scope, setScope] = useState<Scope>("all");
  const [sel, setSel] = useState(data.items[0]?.id ?? "");
  const [owners, setOwners] = useState<Record<string, string>>({});
  const [acks, setAcks] = useState<Record<string, boolean>>({});

  const items = data.items.map((it) => ({ ...it, owner: owners[it.id] ?? it.owner, acked: !!acks[it.id] }));
  const inScope = (it: TriageItem) => scope === "all" || (scope === "mine" ? it.owner === me : !it.owner);
  const count = (id: string) => items.filter((it) => (id === "all" || it.category === id) && inScope(it)).length;
  const visible = items.filter((it) => (tab === "all" || it.category === tab) && inScope(it));

  const s = items.find((it) => it.id === sel) ?? items[0];
  const isMine = s.owner === me;
  const ownerLabel = s.owner ? (isMine ? `You · ${me}` : s.owner) : "Unassigned";
  const openSessions = data.sessions.filter((v) => v.status === "open");

  return (
    <PageContent>
      <PageHeader
        size="hello"
        eyebrow="Monday 12 October 2026 · 09:42 CAT · Production"
        title="Control tower"
        description={`${items.length} items need an owner or a decision. Two provider incidents are slowing payment confirmation and fiscal receipts.`}
        actions={
          <>
            <Segment aria-label="Whose items" selectedKey={scope} onSelectionChange={(k) => setScope(k as Scope)}>
              {SCOPES.map((p) => (
                <Segment.Item key={p.id} id={p.id}>
                  {p.label}
                </Segment.Item>
              ))}
            </Segment>
            <LinkButton href={screenHref("AdminHealth")} variant="secondary">
              <Pulse className="size-4" />
              Open health
            </LinkButton>
          </>
        }
      />

      <Alert status="warning" role="status">
        <Alert.Indicator>
          <TriangleExclamation />
        </Alert.Indicator>
        <Alert.Content>
          <Alert.Title>Payment confirmations are delayed for 23 tenants</Alert.Title>
          <Alert.Description>
            GT Bank callbacks are arriving 9–14 minutes late (INC-0192). Affected payments show Pending or Unknown —
            checking with provider; none is shown as paid until the provider confirms. Deploys to payment services are
            frozen.
          </Alert.Description>
        </Alert.Content>
      </Alert>

      <section aria-label="Platform figures right now">
        <KPIGroup className="flex-wrap">
          {data.kpis.map((k, i) => (
            <Fragment key={k.id}>
              {i > 0 ? <KPIGroup.Separator /> : null}
              <KPI className="relative min-w-[160px] flex-[1_1_160px]">
                <KPI.Header>
                  <KPI.Icon status={k.status === "default" ? undefined : k.status}>
                    <Icon name={k.icon} />
                  </KPI.Icon>
                  <KPI.Title>
                    <NextLink
                      href={screenHref(k.board)}
                      className="text-inherit no-underline after:absolute after:inset-0"
                    >
                      {k.label}
                    </NextLink>
                  </KPI.Title>
                </KPI.Header>
                <KPI.Content className="flex-none">
                  <KPI.Value value={k.value} formatOptions={k.format} className="tabular" />
                </KPI.Content>
                <KPI.Footer className="mt-1.5">
                  <p className="text-xs leading-4 text-muted">{k.foot}</p>
                </KPI.Footer>
              </KPI>
            </Fragment>
          ))}
        </KPIGroup>
      </section>

      <div className="flex flex-wrap items-start gap-4">
        <section className="flex min-w-0 flex-[999_1_560px] flex-col gap-2.5" aria-labelledby="tri-h">
          <SectionHeader
            id="tri-h"
            title="Triage"
            description="Oldest and most severe first. Every item has an owner or is flagged unassigned."
            action={<span className="text-xs text-muted tabular">Refreshed 09:42:05</span>}
          />
          <Tabs variant="secondary" selectedKey={tab} onSelectionChange={(k) => setTab(String(k))}>
            <Tabs.ListContainer>
              <Tabs.List aria-label="Item type">
                {TABS.map((t) => (
                  <Tabs.Tab key={t.id} id={t.id} className={lineTab}>
                    {t.label}
                    <TabCount>{count(t.id)}</TabCount>
                    <Tabs.Indicator />
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>
            {TABS.map((t) => (
              <Tabs.Panel key={t.id} id={t.id} className="pt-2.5">
                {visible.length > 0 ? (
                  <Table>
                    <Table.ScrollContainer>
                      <Table.Content
                        aria-label="Triage items"
                        selectionMode="single"
                        selectionBehavior="replace"
                        disallowEmptySelection
                        selectedKeys={new Set([sel])}
                        onSelectionChange={(keys) => {
                          const k = firstKey(keys as "all" | Set<Key>);
                          if (k) setSel(k);
                        }}
                      >
                        <Table.Header>
                          <Table.Column isRowHeader>Item</Table.Column>
                          <Table.Column>Owner</Table.Column>
                          <Table.Column>Age</Table.Column>
                          <Table.Column>State</Table.Column>
                        </Table.Header>
                        <Table.Body>
                          {visible.map((r) => (
                            <Table.Row key={r.id} id={r.id} className={selectableRow}>
                              <Table.Cell>
                                <span className="flex items-start gap-2.5">
                                  <StatusDot tone={r.severity === "default" ? "info" : r.severity} className="mt-1.5" />
                                  <span className="flex min-w-0 flex-col gap-0.5">
                                    <span className="font-medium">{r.title}</span>
                                    <span className="text-xs leading-4 text-muted">
                                      {CATEGORY[r.category].label} · {r.id} · {r.scope}
                                    </span>
                                  </span>
                                </span>
                              </Table.Cell>
                              <Table.Cell className="whitespace-nowrap">
                                {r.owner ? (
                                  <span className="flex items-center gap-2">
                                    <Avatar size="sm" variant="soft" color="accent">
                                      <Avatar.Fallback>{initials(r.owner)}</Avatar.Fallback>
                                    </Avatar>
                                    <span>{r.owner}</span>
                                  </span>
                                ) : (
                                  <GateChip icon={<PersonXmark className="size-3" />}>Unassigned</GateChip>
                                )}
                              </Table.Cell>
                              <Table.Cell className="whitespace-nowrap tabular">{r.age}</Table.Cell>
                              <Table.Cell>
                                <ToneChip tone={r.stateTone}>{r.state}</ToneChip>
                              </Table.Cell>
                            </Table.Row>
                          ))}
                        </Table.Body>
                      </Table.Content>
                    </Table.ScrollContainer>
                  </Table>
                ) : (
                  <Card variant="secondary">
                    <EmptyState size="sm">
                      <EmptyState.Header>
                        <EmptyState.Media variant="icon">
                          <Tray />
                        </EmptyState.Media>
                        <EmptyState.Title>Nothing here for this filter</EmptyState.Title>
                        <EmptyState.Description>
                          Switch to Everyone to see items owned by other staff.
                        </EmptyState.Description>
                      </EmptyState.Header>
                    </EmptyState>
                  </Card>
                )}
              </Tabs.Panel>
            ))}
          </Tabs>
        </section>

        <Card
          className="min-w-0 flex-[1_1_340px] gap-[14px] p-[18px]"
          aria-labelledby="sel-h"
          render={(p) => <section {...p} />}
        >
          <div className="flex flex-wrap items-center gap-2">
            <ToneChip tone={CATEGORY[s.category].tone}>{CATEGORY[s.category].label}</ToneChip>
            <span className="text-xs text-muted tabular">{s.id}</span>
            <span className="flex-1" />
            <ToneChip tone={s.stateTone}>{s.state}</ToneChip>
          </div>
          <div className="flex flex-col gap-0.5">
            <h2 id="sel-h" className="text-[17px] leading-6 font-semibold">
              {s.title}
            </h2>
            <p className="text-[13px] leading-[18px] text-muted">
              {s.scope} · open {s.age}
            </p>
          </div>
          <p className="text-sm leading-5">{s.detail}</p>
          <Alert>
            <Alert.Indicator>
              <CircleInfo />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>Impact</Alert.Title>
              <Alert.Description>{s.impact}</Alert.Description>
            </Alert.Content>
          </Alert>
          <FactRows facts={s.facts} />
          <Separator />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted">Owner</span>
              <span className="font-medium">{ownerLabel}</span>
            </div>
            {s.acked ? (
              <Chip size="sm" variant="soft" color="success">
                <Check className="size-3" />
                <Chip.Label>Acknowledged by you · 09:42</Chip.Label>
              </Chip>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              isDisabled={isMine}
              onPress={() => setOwners((o) => ({ ...o, [s.id]: me }))}
            >
              <PersonPlus className="size-4" />
              {isMine ? "Assigned to you" : "Assign to me"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              aria-pressed={s.acked}
              onPress={() => setAcks((a) => ({ ...a, [s.id]: !s.acked }))}
            >
              <Check className="size-4" />
              {s.acked ? "Undo acknowledge" : "Acknowledge"}
            </Button>
            <LinkButton href={screenHref(s.board)} size="sm">
              {s.cta}
            </LinkButton>
          </div>
          <div className="flex flex-col gap-2">
            <SubHeading>Activity</SubHeading>
            <EventTimeline
              events={s.log.map((l) => ({
                key: `${l.when}-${l.text}`,
                title: l.text,
                meta: `${l.when} · ${l.who}`,
                status: l.status,
              }))}
            />
          </div>
        </Card>
      </div>

      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr))]">
        <Card className="gap-3 p-[18px]" aria-labelledby="dep-h" render={(p) => <section {...p} />}>
          <CardHead id="dep-h" title="Recent Deploys" description="Payment services are frozen until INC-0192 closes" />
          <Timeline size="sm" density="compact">
            {data.deploys.map((d) => (
              <Timeline.Item key={d.id} status={d.status}>
                <Timeline.Rail>
                  <Timeline.Marker>
                    <Icon name={d.icon} className="size-3" />
                  </Timeline.Marker>
                  <Timeline.Connector />
                </Timeline.Rail>
                <Timeline.Content className="flex flex-col pb-0.5 text-sm">
                  <span className="font-medium">{d.title}</span>
                  <span className="text-xs leading-4 text-muted">{d.detail}</span>
                </Timeline.Content>
              </Timeline.Item>
            ))}
          </Timeline>
          <LinkButton href={screenHref("AdminHealth")} size="sm" variant="ghost" className="self-start">
            Pipeline and canaries
          </LinkButton>
        </Card>

        <Card className="gap-3 p-[18px]" aria-labelledby="acc-h" render={(p) => <section {...p} />}>
          <CardHead
            id="acc-h"
            title="Live Tenant Access"
            description="Staff inside a tenant workspace right now. Each session is justified, time-limited and logged."
          />
          {openSessions.map((v) => (
            <ItemCard key={v.id} variant="secondary">
              <ItemCard.Icon>
                <Eye />
              </ItemCard.Icon>
              <ItemCard.Content>
                <ItemCard.Title className="whitespace-normal">
                  {v.staff} · {v.business}
                </ItemCard.Title>
                <ItemCard.Description className="whitespace-normal">
                  {v.id} · {v.mode} · {v.ticket} · ends {v.ends} · owner notified
                </ItemCard.Description>
              </ItemCard.Content>
              <ItemCard.Action>
                <ToneChip tone="warning">{v.minutesLeft} min left</ToneChip>
              </ItemCard.Action>
            </ItemCard>
          ))}
          <p className="text-xs leading-4 text-muted">
            No other sessions are open. 4 sessions ended in the last 24 hours, all read-only, 61 logged events.
          </p>
          <div className="flex flex-wrap gap-2">
            <LinkButton href={screenHref("AdminAudit")} size="sm" variant="secondary">
              Session log
            </LinkButton>
            <LinkButton href={screenHref("AdminBusinesses")} size="sm" variant="ghost">
              Start view-as
            </LinkButton>
          </div>
        </Card>

        <Card className="gap-3 p-[18px]" aria-labelledby="oc-h" render={(p) => <section {...p} />}>
          <CardHead id="oc-h" title="On Call This Week" description="6 to 12 October · hand-over Monday 08:00" />
          <ListView aria-label="On call this week" variant="secondary" items={data.onCall}>
            {(o) => (
              <ListView.Item id={o.id} textValue={o.name}>
                <ListView.ItemContent>
                  <Avatar size="sm" variant="soft">
                    <Avatar.Fallback>{initials(o.name)}</Avatar.Fallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-col">
                    <ListView.Title>{o.name}</ListView.Title>
                    <ListView.Description>{o.role}</ListView.Description>
                  </div>
                </ListView.ItemContent>
                <ListView.ItemAction>
                  <ToneChip tone={o.tone}>{o.load}</ToneChip>
                </ListView.ItemAction>
              </ListView.Item>
            )}
          </ListView>
          <LinkButton href={screenHref("AdminPeople")} size="sm" variant="ghost" className="self-start">
            Staff and rotas
          </LinkButton>
        </Card>
      </div>
    </PageContent>
  );
}
