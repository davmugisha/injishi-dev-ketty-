"use client";

import { Check, ChevronRight, CircleQuestion, Hourglass, Paperclip, ShieldExclamation } from "@gravity-ui/icons";
import { Alert, Button, Card, Chip, Popover, Switch, Table, Toast } from "@heroui/react";
import { ItemCard, ItemCardGroup, ListView, Timeline } from "@heroui-pro/react";
import { GateChip, Icon, KeyValueList, PageContent, PageHeader } from "@injishi/ui";
import { useState } from "react";
import type { RuleGovernanceStep, RuleSet } from "../../model/payroll.ts";
import { useBoardHref } from "../mount.tsx";
import { ContributionsPanel } from "./contributions-panel";
import { EmployerNumberCard } from "./employer-number";
import { PressableItemCard } from "./parts";

function StatusChip({ set }: { set: RuleSet }) {
  if (set.status === "approved") {
    return (
      <Chip size="sm" variant="soft" color="success">
        <Check className="size-3" aria-hidden="true" />
        <Chip.Label>{set.statusLabel}</Chip.Label>
      </Chip>
    );
  }
  return (
    <GateChip
      icon={
        set.status === "draft" ? (
          <Hourglass className="size-3" aria-hidden="true" />
        ) : (
          <ShieldExclamation className="size-3" aria-hidden="true" />
        )
      }
      className="h-auto max-w-full whitespace-normal py-0.5 text-left"
    >
      {set.statusLabel}
    </GateChip>
  );
}

/**
 * Payroll rules: the national rules each pay run computes with (PAYE, RSSB, holidays, leave,
 * overtime, final pay, returns), read from the API with their versions and the runs that used them,
 * and the business's own insurance choices above them. The national rules are read only here.
 */
export function PayrollRulesView({ sets, governance }: { sets: RuleSet[]; governance: RuleGovernanceStep[] }) {
  const screenHref = useBoardHref();
  const [selectedId, setSelectedId] = useState(() => sets.find((s) => s.status !== "approved")?.id ?? "");
  const [compare, setCompare] = useState(false);

  const cur = sets.find((s) => s.id === selectedId) ?? sets[0];
  const unconfirmed = sets.filter((s) => s.status !== "approved");
  const canCompare = !!cur && cur.diff.length > 0;

  return (
    <PageContent>
      <PageHeader
        eyebrow="Rwanda · versioned"
        title="Payroll rules"
        actions={
          <Popover>
            <Button variant="secondary">
              <CircleQuestion className="size-4" aria-hidden="true" />
              How it works
            </Button>
            <Popover.Content placement="bottom end" className="w-[300px]">
              <Popover.Dialog aria-labelledby="gov-h" className="flex flex-col gap-3 p-4">
                <Popover.Heading id="gov-h" className="text-[15px] font-semibold">
                  How a version takes effect
                </Popover.Heading>
                <Timeline size="sm" density="compact">
                  {governance.map((g) => (
                    <Timeline.Item key={g.id}>
                      <Timeline.Rail>
                        <Timeline.Marker>
                          <Icon name={g.icon} className="size-3" />
                        </Timeline.Marker>
                        <Timeline.Connector />
                      </Timeline.Rail>
                      <Timeline.Content className="flex flex-col pb-0.5 text-sm">
                        <span className="font-medium">{g.title}</span>
                        <span className="text-xs leading-4 text-muted">{g.detail}</span>
                      </Timeline.Content>
                    </Timeline.Item>
                  ))}
                </Timeline>
              </Popover.Dialog>
            </Popover.Content>
          </Popover>
        }
      />

      {unconfirmed.length ? (
        <Alert status="warning" role="status">
          <Alert.Indicator>
            <ShieldExclamation aria-hidden="true" />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>
              {unconfirmed.length} of {sets.length} rules are not confirmed by an accountant yet
            </Alert.Title>
            <Alert.Description>{unconfirmed.map((x) => x.name).join(", ")}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}

      <EmployerNumberCard />

      <ContributionsPanel />

      {!cur ? (
        <Card className="p-6 text-sm text-muted">Only for people who prepare or confirm pay.</Card>
      ) : (
        <div className="flex flex-wrap items-start gap-[16px]">
          <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-[16px]">
            <ItemCardGroup layout="list" aria-labelledby="sets-h" className="overflow-hidden">
              <ItemCardGroup.Header>
                <ItemCardGroup.Title id="sets-h">Rule sets</ItemCardGroup.Title>
              </ItemCardGroup.Header>
              {sets.map((s) => (
                <PressableItemCard key={s.id} isSelected={s.id === cur.id} onPress={() => setSelectedId(s.id)}>
                  <ItemCard.Icon className="self-center">
                    <Icon name={s.icon} />
                  </ItemCard.Icon>
                  <ItemCard.Content className="items-start">
                    <ItemCard.Title>{s.name}</ItemCard.Title>
                    <ItemCard.Description>
                      {s.version} · from {s.eff}
                    </ItemCard.Description>
                    <span className="mt-1 flex max-w-full">
                      <StatusChip set={s} />
                    </span>
                  </ItemCard.Content>
                </PressableItemCard>
              ))}
            </ItemCardGroup>
          </div>

          <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-[16px]">
            <Card aria-labelledby="det-h" className="gap-[14px] p-[18px]">
              <div className="flex flex-wrap items-start gap-[12px]">
                <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-1">
                  <h2 id="det-h" className="text-[18px] leading-6 font-semibold">
                    {cur.name} · {cur.version}
                  </h2>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <StatusChip set={cur} />
                    <Chip size="sm" variant="soft">
                      {cur.kind}
                    </Chip>
                  </span>
                </div>
                {canCompare ? (
                  <Switch isSelected={compare} onChange={setCompare}>
                    <Switch.Content>
                      <Switch.Control>
                        <Switch.Thumb />
                      </Switch.Control>
                      Compare with {cur.prev}
                    </Switch.Content>
                  </Switch>
                ) : null}
              </div>

              <KeyValueList
                items={[
                  { label: "Effective", value: cur.effRange },
                  {
                    label: "Source",
                    value: (
                      <span className="flex items-start gap-1.5">
                        <Paperclip className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                        {cur.source}
                      </span>
                    ),
                  },
                  { label: "Recorded by", value: cur.by },
                  { label: "Accountant check", value: cur.expert },
                ]}
              />

              {canCompare && compare ? (
                <Table variant="secondary">
                  <Table.ScrollContainer>
                    <Table.Content aria-label={`${cur.name} ${cur.version} compared with ${cur.prev}`}>
                      <Table.Header>
                        <Table.Column isRowHeader>Line</Table.Column>
                        <Table.Column>{cur.prev}</Table.Column>
                        <Table.Column>{cur.version}</Table.Column>
                        <Table.Column>Change</Table.Column>
                      </Table.Header>
                      <Table.Body>
                        {cur.diff.map((x) => (
                          <Table.Row
                            key={x.line}
                            id={x.line}
                            className={x.change === "unchanged" ? undefined : "bg-accent-soft"}
                          >
                            <Table.Cell className="font-medium">{x.line}</Table.Cell>
                            <Table.Cell
                              className={
                                x.change === "changed"
                                  ? "text-muted line-through tabular"
                                  : x.change === "added"
                                    ? "text-muted tabular"
                                    : "tabular"
                              }
                            >
                              {x.old}
                            </Table.Cell>
                            <Table.Cell className="tabular">{x.now}</Table.Cell>
                            <Table.Cell>
                              <Chip
                                size="sm"
                                variant="soft"
                                color={x.change === "changed" ? "warning" : x.change === "added" ? "accent" : "default"}
                              >
                                {x.change === "changed" ? "Changed" : x.change === "added" ? "Added" : "Unchanged"}
                              </Chip>
                            </Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Content>
                  </Table.ScrollContainer>
                </Table>
              ) : (
                <Table variant="secondary">
                  <Table.ScrollContainer>
                    <Table.Content aria-label={`${cur.name} ${cur.version} values`}>
                      <Table.Header>
                        {cur.cols.map((c, i) => (
                          <Table.Column key={c} isRowHeader={i === 0}>
                            {c}
                          </Table.Column>
                        ))}
                      </Table.Header>
                      <Table.Body>
                        {cur.rows.map((row) => (
                          <Table.Row key={row.join("|")} id={row.join("|")}>
                            {cur.cols.map((col, ci) => (
                              <Table.Cell key={col} className="tabular">
                                {row[ci]}
                              </Table.Cell>
                            ))}
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Content>
                  </Table.ScrollContainer>
                </Table>
              )}
              <p className="text-xs leading-4 text-muted">{cur.note}</p>
            </Card>

            <div className="grid items-start gap-[16px] [grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr))]">
              <Card aria-labelledby="hist-h" className="gap-[10px] p-[16px]">
                <Card.Header>
                  <Card.Title id="hist-h" className="text-[15px] font-semibold">
                    Version history
                  </Card.Title>
                </Card.Header>
                <Card.Content>
                  <Timeline size="sm" density="compact">
                    {cur.history.map((h) => (
                      <Timeline.Item key={h.title} status={h.status}>
                        <Timeline.Rail>
                          <Timeline.Marker />
                          <Timeline.Connector />
                        </Timeline.Rail>
                        <Timeline.Content className="flex flex-col pb-0.5 text-sm">
                          <span className="font-medium">{h.title}</span>
                          <span className="text-xs leading-4 text-muted">{h.detail}</span>
                        </Timeline.Content>
                      </Timeline.Item>
                    ))}
                  </Timeline>
                </Card.Content>
              </Card>

              <Card aria-labelledby="used-h" className="gap-[10px] p-[16px]">
                <Card.Header>
                  <Card.Title id="used-h" className="text-[15px] font-semibold">
                    Used by
                  </Card.Title>
                </Card.Header>
                <Card.Content>
                  {cur.used.length ? (
                    <ListView
                      aria-label="Pay runs using this version"
                      variant="secondary"
                      items={cur.used.map((u) => ({ ...u, id: u.title }))}
                    >
                      {(u) => (
                        <ListView.Item id={u.id} textValue={u.title} href={screenHref(u.board)}>
                          <ListView.ItemContent>
                            <Icon name="Sack" className="size-4 shrink-0 text-muted" />
                            <div className="flex min-w-0 flex-col">
                              <ListView.Title>{u.title}</ListView.Title>
                              <ListView.Description>{u.detail}</ListView.Description>
                            </div>
                          </ListView.ItemContent>
                          <ListView.ItemAction>
                            <ChevronRight className="size-4 text-muted" aria-hidden="true" />
                          </ListView.ItemAction>
                        </ListView.Item>
                      )}
                    </ListView>
                  ) : (
                    <p className="text-[13px] text-muted">Not used yet.</p>
                  )}
                </Card.Content>
              </Card>
            </div>
          </div>
        </div>
      )}

      <Toast.Provider placement="bottom" />
    </PageContent>
  );
}
