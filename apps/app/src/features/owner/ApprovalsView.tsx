"use client";

import { CircleCheck, ShieldCheck, ShieldKeyhole, Sliders } from "@gravity-ui/icons";
import { Avatar, Card, Chip, Table, Tabs, Toast, toast } from "@heroui/react";
import { EmptyState, ListView, Segment } from "@heroui-pro/react";
import { type Persona, screenHref } from "@injishi/data";
import type { ApprovalArea, ApprovalHistoryEntry, ApprovalRequest } from "@injishi/data/fixtures/owner";
import { Icon, LinkButton, PageContent, PageHeader, StatusDot, toneColor } from "@injishi/ui";
import { useOptimistic, useState, useTransition } from "react";
import { decideApproval } from "./ApprovalsActions";
import { ApprovalDetail, type Decision } from "./ApprovalsDetail";

const FILTERS: { id: "all" | ApprovalArea; label: string }[] = [
  { id: "all", label: "All" },
  { id: "money", label: "Money" },
  { id: "people", label: "People" },
  { id: "fiscal", label: "Fiscal" },
  { id: "rates", label: "Rates" },
];

/** A decision taken on this screen, until the page reads it back from the API. */
const NOW = "Just now";

function statusOf(r: ApprovalRequest) {
  if (r.decision === "approved") return { label: "Approved", tone: "success" as const };
  if (r.decision === "declined") return { label: "Declined", tone: "default" as const };
  return { label: r.due, tone: r.dueTone };
}

export function ApprovalsView({
  persona,
  requests,
  history,
  todayLabel,
}: {
  persona: Persona;
  requests: ApprovalRequest[];
  history: ApprovalHistoryEntry[];
  /** "Monday 26 October 2026". */
  todayLabel: string;
}) {
  const [tab, setTab] = useState("waiting");
  const [filter, setFilter] = useState<"all" | ApprovalArea>("all");
  const [sel, setSel] = useState(requests[0]?.id ?? "");
  const [, startTransition] = useTransition();
  const [items, applyDecision] = useOptimistic(requests, (state, d: Decision & { id: string }) =>
    state.map((r) => (r.id === d.id ? { ...r, decision: d.decision, decisionReason: d.reason } : r)),
  );

  const openCount = items.filter((r) => !r.decision).length;
  const newCount = items.filter((r) => r.isNew).length;
  const list = items.filter((r) => filter === "all" || r.area === filter);
  const cur = items.find((r) => r.id === sel) ?? items[0];

  const decide = (id: string, d: Decision) =>
    startTransition(async () => {
      applyDecision({ id, ...d });
      const r = await decideApproval(id, d.decision, d.reason);
      if (!r.ok) toast.danger(r.error);
    });

  const decidedRows: ApprovalHistoryEntry[] = items
    .filter((r) => r.decision)
    .map((r) => ({
      id: `now-${r.id}`,
      when: NOW,
      title: r.title,
      ref: r.type,
      by: r.who,
      decision: r.decision === "approved" ? "Approved" : "Declined",
      decisionTone: r.decision === "approved" ? "success" : "default",
      decider: persona.name,
      note: r.decision === "approved" ? r.okDesc : r.decisionReason,
    }));
  const rows = [...decidedRows, ...history];

  return (
    <PageContent>
      <PageHeader
        eyebrow={
          <>
            {todayLabel} · {persona.role}
          </>
        }
        title="Approvals"
        description={openCount ? `${openCount} waiting for you, ${newCount} new today.` : "Nothing is waiting for you."}
        actions={
          <>
            <LinkButton href={screenHref("SettingsPolicies")} variant="ghost">
              <Sliders className="size-4" />
              Approval limits
            </LinkButton>
            <LinkButton href={screenHref("AuditLog")} variant="secondary">
              <ShieldCheck className="size-4" />
              Audit log
            </LinkButton>
          </>
        }
      />

      <Tabs variant="secondary" selectedKey={tab} onSelectionChange={(k) => setTab(String(k))} className="w-full gap-5">
        <Tabs.ListContainer>
          <Tabs.List aria-label="Approvals views" className="justify-start">
            <Tabs.Tab id="waiting" className="w-auto gap-2 px-3">
              Waiting for you
              <Chip size="sm">{openCount}</Chip>
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="history" className="w-auto px-3">
              History
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="waiting">
          <div className="flex flex-wrap items-start gap-4">
            <Card aria-labelledby="inbox-h" className="max-w-[420px] min-w-0 flex-[1_1_320px] gap-2.5 p-3">
              <div className="flex items-center justify-between gap-2 px-1 pt-1">
                <h2 id="inbox-h" className="text-[15px] leading-[22px] font-semibold">
                  Requests
                </h2>
                <span className="text-xs text-muted">Most urgent first</span>
              </div>
              <div className="-mx-1 overflow-x-auto px-1 pb-0.5">
                <Segment
                  aria-label="Filter by area"
                  selectedKey={filter}
                  onSelectionChange={(k) => setFilter(String(k) as "all" | ApprovalArea)}
                >
                  {FILTERS.map((f) => (
                    <Segment.Item key={f.id} id={f.id}>
                      {f.label} {f.id === "all" ? items.length : items.filter((r) => r.area === f.id).length}
                    </Segment.Item>
                  ))}
                </Segment>
              </div>
              <ListView
                aria-label="Requests"
                variant="secondary"
                items={list}
                selectionMode="single"
                selectionBehavior="replace"
                disallowEmptySelection
                selectedKeys={new Set([cur?.id ?? ""])}
                onSelectionChange={(keys) => {
                  if (keys === "all") return;
                  const [k] = [...keys];
                  if (k !== undefined) setSel(String(k));
                }}
                renderEmptyState={() => (
                  <EmptyState size="sm">
                    <EmptyState.Header>
                      <EmptyState.Media variant="icon">
                        <CircleCheck />
                      </EmptyState.Media>
                      <EmptyState.Title>Nothing waiting here</EmptyState.Title>
                      <EmptyState.Description>
                        Requests in this area will appear when your team raises them.
                      </EmptyState.Description>
                    </EmptyState.Header>
                  </EmptyState>
                )}
              >
                {(r) => {
                  const status = statusOf(r);
                  return (
                    <ListView.Item id={r.id} textValue={r.title} className="items-start">
                      <ListView.ItemContent className="items-start gap-3">
                        <Avatar size="sm" variant="soft" color={toneColor(r.tone)} className="shrink-0">
                          <Avatar.Fallback>
                            <Icon name={r.icon} />
                          </Avatar.Fallback>
                        </Avatar>
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <ListView.Title className="whitespace-normal">{r.title}</ListView.Title>
                          <ListView.Description className="whitespace-normal">
                            {r.who} · {r.when}
                          </ListView.Description>
                          <span className="mt-1 flex flex-wrap items-center gap-1.5">
                            <Chip size="sm" variant="soft" color={toneColor(status.tone)}>
                              {status.label}
                            </Chip>
                            {r.stepUp && !r.decision ? (
                              <Chip size="sm" variant="soft">
                                <ShieldKeyhole className="size-3" aria-hidden="true" />
                                <Chip.Label>Step-up</Chip.Label>
                              </Chip>
                            ) : null}
                          </span>
                        </span>
                        {r.isNew && !r.decision ? (
                          <span className="mt-1.5 flex shrink-0">
                            <StatusDot tone="accent" />
                            <span className="sr-only">New</span>
                          </span>
                        ) : null}
                      </ListView.ItemContent>
                    </ListView.Item>
                  );
                }}
              </ListView>
            </Card>

            {cur ? (
              <ApprovalDetail
                key={cur.id}
                request={cur}
                onDecide={(d) => decide(cur.id, d)}
                auditHref={screenHref("AuditLog")}
              />
            ) : null}
          </div>
        </Tabs.Panel>

        <Tabs.Panel id="history">
          <section className="flex flex-col gap-2.5" aria-labelledby="hist-h">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 id="hist-h" className="text-[15px] leading-[22px] font-semibold">
                Decided in the Last 60 Days
              </h2>
              <span className="text-xs text-muted">
                Read-only. The full trail, with before and after values, is in the audit log.
              </span>
            </div>
            <Table>
              <Table.ScrollContainer>
                <Table.Content aria-label="Decided in the last 60 days">
                  <Table.Header>
                    <Table.Column isRowHeader>Decided</Table.Column>
                    <Table.Column>Request</Table.Column>
                    <Table.Column>Requested by</Table.Column>
                    <Table.Column>Decision</Table.Column>
                    <Table.Column>Decided by</Table.Column>
                    <Table.Column>Reason and outcome</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {rows.map((h) => (
                      <Table.Row key={h.id} id={h.id}>
                        <Table.Cell className="whitespace-nowrap tabular">{h.when}</Table.Cell>
                        <Table.Cell>
                          <span className="flex flex-col">
                            <span className="font-medium">{h.title}</span>
                            <span className="text-xs text-muted">{h.ref}</span>
                          </span>
                        </Table.Cell>
                        <Table.Cell className="whitespace-nowrap">{h.by}</Table.Cell>
                        <Table.Cell>
                          <Chip size="sm" variant="soft" color={toneColor(h.decisionTone)}>
                            {h.decision}
                          </Chip>
                        </Table.Cell>
                        <Table.Cell>{h.decider}</Table.Cell>
                        <Table.Cell className="max-w-[360px] text-[13px] whitespace-normal">{h.note}</Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          </section>
        </Tabs.Panel>
      </Tabs>
      <Toast.Provider placement="bottom" />
    </PageContent>
  );
}
