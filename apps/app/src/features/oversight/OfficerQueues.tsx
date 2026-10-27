"use client";

import { Flag, Lock, PersonsLock } from "@gravity-ui/icons";
import { Alert, Avatar, Button, Card, Table, Tabs, ToggleButton } from "@heroui/react";
import { EmptyState } from "@heroui-pro/react";
import { screenHref } from "@injishi/data";
import type { QueueCase, QueueId } from "@injishi/data/fixtures/oversight";
import { KeyValueList, LinkButton, SectionHeader, toneColor } from "@injishi/ui";
import { type Key, useState } from "react";
import { CardHeading, firstKey, HBar, LINE_LIST, LINE_TAB, TabCount, ToneChip } from "./shared";

type TabId = QueueId | "membership";

const TABS: { id: TabId; label: string; note: string; whoHead: string; locked?: boolean }[] = [
  {
    id: "verification",
    label: "Verification",
    note: "A verified case still needs a second officer to approve.",
    whoHead: "Assigned to",
  },
  {
    id: "approval",
    label: "Approval",
    note: "Cases another officer verified. Never one you verified yourself.",
    whoHead: "Verified by",
  },
  {
    id: "tax",
    label: "Tax",
    note: "Delegated to you as view and flag. Decisions stay with the district tax office.",
    whoHead: "Decided by",
  },
  { id: "membership", label: "Membership", note: "Not delegated under this mandate.", whoHead: "", locked: true },
];

const QUEUE_NAME: Record<QueueId, string> = {
  verification: "Verification queue",
  approval: "Approval queue",
  tax: "Tax queue",
};

/** What an empty queue says: nothing waiting when the officer holds the grant, otherwise that it is not theirs. */
function emptyTitle(id: TabId, held: QueueId[]): string {
  if (id !== "membership" && held.includes(id)) return "Nothing is waiting in this queue";
  return id === "membership" ? "Membership queue is not delegated to you" : `The ${id} queue is not delegated to you`;
}

function emptyNote(id: TabId, held: QueueId[]): string {
  if (id !== "membership" && held.includes(id)) return "New registrations show here when they reach this stage.";
  return id === "membership"
    ? "PSF and the Chamber of Tourism decide memberships in their own console."
    : "Your assignment does not include this function.";
}

/** The officer's queues (tabs and table) beside the inspector of the selected case. */
export function OfficerQueues({ cases, held }: { cases: QueueCase[]; held: QueueId[] }) {
  const [tab, setTab] = useState<TabId>("verification");
  const [sel, setSel] = useState<Record<QueueId, string>>(() => ({
    verification: cases.find((c) => c.queue === "verification")?.id ?? "",
    approval: cases.find((c) => c.queue === "approval")?.id ?? "",
    tax: cases.find((c) => c.queue === "tax")?.id ?? "",
  }));
  const [flagged, setFlagged] = useState(false);

  const rowsOf = (id: TabId) => (id === "membership" ? [] : cases.filter((c) => c.queue === id));
  // The membership queue is not delegated: the inspector then shows the first verification case.
  const selected =
    (tab !== "membership" && cases.find((c) => c.queue === tab && c.id === sel[tab])) ||
    cases.find((c) => c.queue === "verification") ||
    cases[0];

  return (
    <div className="flex flex-wrap items-start gap-4">
      <section className="flex min-w-0 flex-[999_1_600px] flex-col gap-3" aria-labelledby="q-h">
        <SectionHeader
          id="q-h"
          title="Your queues"
          className="items-center"
          action={<span className="text-[12px] text-muted">Oldest due first</span>}
        />
        <Tabs variant="secondary" selectedKey={tab} onSelectionChange={(k) => setTab(String(k) as TabId)}>
          <Tabs.ListContainer>
            <Tabs.List aria-label="Queues" className={LINE_LIST}>
              {TABS.map((t) => (
                <Tabs.Tab key={t.id} id={t.id} className={LINE_TAB}>
                  {t.locked ? <Lock className="size-4" aria-hidden="true" /> : null}
                  {t.label}
                  <TabCount>{t.locked ? "–" : rowsOf(t.id).length}</TabCount>
                  <Tabs.Indicator />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
          {TABS.map((t) => {
            const rows = rowsOf(t.id);
            return (
              <Tabs.Panel key={t.id} id={t.id} className="flex flex-col gap-3 pt-3">
                <p className="text-[13px] leading-[18px] text-muted">{t.note}</p>
                {rows.length ? (
                  <Table>
                    <Table.ScrollContainer>
                      <Table.Content
                        aria-label={`${t.label} queue`}
                        selectionMode="single"
                        selectionBehavior="replace"
                        disallowEmptySelection
                        selectedKeys={new Set([sel[t.id as QueueId]])}
                        onSelectionChange={(keys) => {
                          const id = firstKey(keys as "all" | Set<Key>);
                          if (id) setSel((s) => ({ ...s, [t.id]: id }));
                        }}
                      >
                        <Table.Header>
                          <Table.Column isRowHeader>Case</Table.Column>
                          <Table.Column>Type</Table.Column>
                          <Table.Column>Age and SLA</Table.Column>
                          <Table.Column>Status</Table.Column>
                          <Table.Column>{t.whoHead}</Table.Column>
                        </Table.Header>
                        <Table.Body>
                          {rows.map((r) => (
                            <Table.Row
                              key={r.id}
                              id={r.id}
                              textValue={r.business}
                              className="cursor-pointer data-[selected=true]:*:bg-default"
                            >
                              <Table.Cell>
                                <span className="flex items-center gap-2.5">
                                  <Avatar size="sm" variant="soft" color="accent" className="shrink-0">
                                    <Avatar.Fallback>{r.initials}</Avatar.Fallback>
                                  </Avatar>
                                  <span className="flex min-w-0 flex-col">
                                    <span className="font-medium">{r.business}</span>
                                    <span className="text-[12px] leading-4 text-muted tabular">
                                      {r.ref ?? r.id} · {r.place}
                                    </span>
                                  </span>
                                </span>
                              </Table.Cell>
                              <Table.Cell>
                                <span className="flex flex-col">
                                  <span>{r.type}</span>
                                  <span className="text-[12px] leading-4 text-muted">{r.typeDetail}</span>
                                </span>
                              </Table.Cell>
                              <Table.Cell className="min-w-40">
                                <span className="flex flex-col gap-1.5">
                                  <span className="text-[13px] tabular">
                                    {r.age} · <span className="text-muted">{r.sla}</span>
                                  </span>
                                  <HBar value={r.slaUsed} label={r.slaLabel} />
                                </span>
                              </Table.Cell>
                              <Table.Cell>
                                <ToneChip tone={r.statusTone}>{r.status}</ToneChip>
                              </Table.Cell>
                              <Table.Cell>
                                <span className="text-[13px]">{r.who}</span>
                              </Table.Cell>
                            </Table.Row>
                          ))}
                        </Table.Body>
                      </Table.Content>
                    </Table.ScrollContainer>
                  </Table>
                ) : (
                  <Card variant="secondary" className="p-6">
                    <EmptyState size="sm">
                      <EmptyState.Header>
                        <EmptyState.Media variant="icon">
                          <Lock />
                        </EmptyState.Media>
                        <EmptyState.Title>{emptyTitle(t.id, held)}</EmptyState.Title>
                        <EmptyState.Description>{emptyNote(t.id, held)}</EmptyState.Description>
                      </EmptyState.Header>
                    </EmptyState>
                  </Card>
                )}
              </Tabs.Panel>
            );
          })}
        </Tabs>
      </section>

      {selected ? (
        <Card
          render={(p) => <aside {...p} />}
          aria-labelledby="insp-h"
          className="min-w-0 flex-[1_1_360px] gap-3.5 p-[18px]"
        >
          <Card.Header className="gap-1">
            <p className="text-[13px] leading-[18px] font-medium text-muted tabular">
              {selected.ref ?? selected.id} · {QUEUE_NAME[selected.queue]}
            </p>
            <CardHeading id="insp-h">{selected.business}</CardHeading>
            <Card.Description>
              {selected.type} · {selected.place}
            </Card.Description>
          </Card.Header>
          <KeyValueList items={selected.facts.map((f) => ({ label: f.label, value: f.value }))} />
          <Alert status={toneColor(selected.duty.tone)}>
            <Alert.Indicator>
              <PersonsLock />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>{selected.duty.title}</Alert.Title>
              <Alert.Description>{selected.duty.description}</Alert.Description>
            </Alert.Content>
          </Alert>
          {selected.action === "open" && selected.cta ? (
            <LinkButton href={selected.href ?? screenHref(selected.board)} fullWidth>
              {selected.cta}
            </LinkButton>
          ) : null}
          {selected.action === "blocked" ? (
            <Button variant="secondary" fullWidth isDisabled>
              Approve
            </Button>
          ) : null}
          {selected.action === "flag" ? (
            <ToggleButton isSelected={flagged} onChange={setFlagged} className="w-full">
              <Flag className="size-4" />
              {flagged ? "Flagged for tax office · undo" : "Flag for district tax office"}
            </ToggleButton>
          ) : null}
          <p className="text-[12px] leading-4 text-muted">{selected.foot}</p>
        </Card>
      ) : null}
    </div>
  );
}
