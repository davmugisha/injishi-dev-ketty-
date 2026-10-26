"use client";

import {
  ArrowsRotateRight,
  Check,
  CircleCheck,
  Clock,
  Lock,
  Moon,
  OctagonXmark,
  ShieldExclamation,
  TriangleExclamation,
  Xmark,
} from "@gravity-ui/icons";
import { Alert, Button, Card, Label, Modal, ProgressBar, Table } from "@heroui/react";
import { ItemCard, ItemCardGroup, Timeline } from "@heroui-pro/react";
import { screenHref } from "@injishi/data";
import type { AuditIssue, AuditRun, AuditStep, AuditStepState, AuditTone, Tone } from "@injishi/data/fixtures/finance";
import { GateChip, Icon, LinkButton, PageContent, PageHeader } from "@injishi/ui";
import { type Key, useState } from "react";
import { TopbarStatus } from "@/components/shell/TopbarStatus";
import { selectableRow, ToneChip } from "./shared";

interface NightAuditData {
  steps: AuditStep[];
  issues: AuditIssue[];
  runs: AuditRun[];
}

const MARK: Record<
  AuditTone,
  { status: "success" | "warning" | "danger" | "default"; tone: Tone; Icon: typeof Check }
> = {
  done: { status: "success", tone: "success", Icon: Check },
  warn: { status: "warning", tone: "warning", Icon: TriangleExclamation },
  block: { status: "danger", tone: "danger", Icon: Xmark },
  idle: { status: "default", tone: "default", Icon: Clock },
};

const LOG_COLOR = { warning: "text-warning-soft-foreground", danger: "text-danger-soft-foreground" } as const;

function firstKey(keys: "all" | Set<Key>): string | null {
  if (keys === "all") return null;
  const [k] = [...keys];
  return k === undefined ? null : String(k);
}

export function NightAuditView({ data }: { data: NightAuditData }) {
  const [res, setRes] = useState<Record<string, boolean>>({});
  const [rolled, setRolled] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [run, setRun] = useState("r11");
  const [checked, setChecked] = useState(false);

  const openN = data.issues.filter((i) => !res[i.id]).length;
  const rollStep: AuditStepState & { id: string; title: string } = rolled
    ? {
        id: "roll",
        title: "Business date roll",
        tone: "done",
        state: "Done",
        time: "23:48",
        detail: "Rolled to Tuesday 13 Oct by Grace Uwera.",
        notes: [],
      }
    : openN
      ? {
          id: "roll",
          title: "Business date roll",
          tone: "block",
          state: "Waiting",
          time: "",
          detail: `${openN} blocking issue${openN === 1 ? "" : "s"} left. All tills must be closed and all outlet charges posted.`,
          notes: [],
        }
      : {
          id: "roll",
          title: "Business date roll",
          tone: "idle",
          state: "Ready",
          time: "",
          detail: "All blocking issues resolved. Warnings carry over as tracked exceptions.",
          notes: [],
        };
  const steps = [
    ...data.steps.map((s) => (s.resolvedBy && res[s.resolvedBy] && s.resolved ? { ...s, ...s.resolved } : s)),
    rollStep,
  ];
  const doneN = rolled ? steps.length : steps.filter((s) => s.tone === "done" || s.tone === "warn").length;
  const pct = Math.round((doneN / steps.length) * 100);

  const runs = rolled ? data.runs : data.runs.filter((r) => !r.tonight);
  const cur = runs.find((r) => r.id === run) ?? runs[0];
  const canRoll = !rolled && openN === 0;
  const rollLocked = !rolled && openN > 0;
  const openText = rolled || !openN ? "All resolved" : `${openN} open`;

  return (
    <PageContent className="text-sm">
      <TopbarStatus
        kind="chip"
        tone={rolled ? "success" : "default"}
        icon="Calendar"
        label={rolled ? "Business date 13 Oct" : "Business date 12 Oct"}
      />
      <PageHeader
        eyebrow="Cashiering · Isangano + Ishyamba · run NA-20261012 · started 23:30 (scheduled)"
        title="Night Audit · 12 Oct"
        description="Posts the day’s room and tax charges, applies the no-show policy and checks every balance before the business date rolls to 13 Oct."
        actions={
          <>
            <span className="text-xs text-muted tabular">
              {checked ? "Checks re-run 23:44 · no new issues" : "Last checked 23:35"}
            </span>
            <Button variant="secondary" onPress={() => setChecked(true)}>
              <ArrowsRotateRight className="size-4" />
              Re-run checks
            </Button>
            {canRoll ? (
              <Button onPress={() => setDialog(true)}>
                <Moon className="size-4" />
                Roll to 13 Oct
              </Button>
            ) : null}
            {rollLocked ? (
              <Button isDisabled aria-describedby="roll-why">
                <Lock className="size-4" />
                Roll to 13 Oct
              </Button>
            ) : null}
          </>
        }
      />

      {rolled ? (
        <Alert status="success" role="status">
          <Alert.Indicator>
            <CircleCheck />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>Business date rolled to Tuesday 13 Oct at 23:48</Alert.Title>
            <Alert.Description>
              Postings for 12 Oct are locked. A late 12 Oct charge now needs a correction with a reason code.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}
      {rollLocked ? (
        <Alert status="danger" role="alert" id="roll-why">
          <Alert.Indicator>
            <OctagonXmark />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>
              {openN} issue{openN === 1 ? "" : "s"} block the business date roll
            </Alert.Title>
            <Alert.Description>
              Resolve them below. Everything else either passed or carries over as a tracked exception.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}

      <ProgressBar
        aria-label="Night audit progress"
        value={pct}
        valueLabel={`${doneN} of ${steps.length} steps done`}
        className="gap-1.5"
      >
        <Label>Audit steps</Label>
        <ProgressBar.Output className="tabular" />
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[999_1_600px] flex-col gap-4">
          <Card className="gap-3 p-[18px]" aria-labelledby="ck-h" render={(p) => <section {...p} />}>
            <Card.Header>
              <Card.Title id="ck-h" className="text-[15px] font-semibold">
                Checklist
              </Card.Title>
              <Card.Description>Each step is idempotent: re-running never posts a charge twice.</Card.Description>
            </Card.Header>
            <Timeline size="sm">
              {steps.map((s) => {
                const mark = MARK[s.tone];
                return (
                  <Timeline.Item key={s.id} status={mark.status}>
                    <Timeline.Rail>
                      <Timeline.Marker>
                        <mark.Icon className="size-3" aria-hidden="true" />
                      </Timeline.Marker>
                      <Timeline.Connector />
                    </Timeline.Rail>
                    <Timeline.Content className="flex flex-col gap-1 pb-1.5">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">{s.title}</span>
                        <ToneChip tone={mark.tone}>{s.state}</ToneChip>
                        {s.time ? <span className="text-xs text-muted tabular">{s.time}</span> : null}
                      </span>
                      <span className="text-[13px] leading-[18px]">{s.detail}</span>
                      {s.notes.map((n) => (
                        <span key={n} className="text-xs leading-4 text-muted tabular">
                          · {n}
                        </span>
                      ))}
                      {"gate" in s && s.gate ? (
                        <GateChip icon={<ShieldExclamation className="size-3" />} className="self-start">
                          Tax rule v3 · configured, awaiting sign-off
                        </GateChip>
                      ) : null}
                    </Timeline.Content>
                  </Timeline.Item>
                );
              })}
            </Timeline>
          </Card>

          <section aria-labelledby="iq-h">
            <ItemCardGroup layout="list">
              <ItemCardGroup.Header className="flex items-center gap-2">
                <div className="flex-1">
                  <ItemCardGroup.Title id="iq-h" aria-level={2}>
                    Blocking the Roll
                  </ItemCardGroup.Title>
                  <ItemCardGroup.Description>
                    Unresolved issues that would leave 12 Oct incomplete if the date rolled now
                  </ItemCardGroup.Description>
                </div>
                <ToneChip tone={openN && !rolled ? "danger" : "success"} size="md">
                  {openText}
                </ToneChip>
              </ItemCardGroup.Header>
              {data.issues.map((issue) => {
                const done = !!res[issue.id];
                const s = done ? issue.resolved : issue.open;
                return (
                  <ItemCard key={issue.id} className="items-start">
                    <ItemCard.Icon>
                      <Icon name={s.icon} />
                    </ItemCard.Icon>
                    <ItemCard.Content className="gap-1">
                      <ItemCard.Title className="whitespace-normal">{s.title}</ItemCard.Title>
                      <ItemCard.Description className="whitespace-normal tabular">{s.detail}</ItemCard.Description>
                      <span className="text-xs whitespace-normal text-muted">{s.owner}</span>
                    </ItemCard.Content>
                    <ItemCard.Action className="flex flex-col items-end gap-2">
                      <ToneChip tone={done ? "success" : "danger"} size="md">
                        {done ? "Resolved" : "Blocking"}
                      </ToneChip>
                      {!done ? (
                        <span className="flex gap-1.5">
                          <LinkButton href={screenHref(issue.open.board)} size="sm" variant="ghost">
                            {issue.open.linkLabel}
                          </LinkButton>
                          <Button
                            size="sm"
                            variant="secondary"
                            onPress={() => setRes((r) => ({ ...r, [issue.id]: true }))}
                          >
                            <ArrowsRotateRight className="size-4" />
                            {issue.open.actLabel}
                          </Button>
                        </span>
                      ) : null}
                    </ItemCard.Action>
                  </ItemCard>
                );
              })}
            </ItemCardGroup>
          </section>
        </div>

        <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-4">
          <Card className="gap-2.5 p-[18px]" aria-labelledby="rh-h" render={(p) => <section {...p} />}>
            <h2 id="rh-h" className="text-[15px] leading-[22px] font-semibold">
              Run History
            </h2>
            <Table variant="secondary">
              <Table.ScrollContainer>
                <Table.Content
                  aria-labelledby="rh-h"
                  selectionMode="single"
                  selectionBehavior="replace"
                  disallowEmptySelection
                  selectedKeys={new Set([cur.id])}
                  onSelectionChange={(keys) => {
                    const id = firstKey(keys as "all" | Set<Key>);
                    if (id) setRun(id);
                  }}
                >
                  <Table.Header>
                    <Table.Column isRowHeader>Business date</Table.Column>
                    <Table.Column>Finished</Table.Column>
                    <Table.Column>Result</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {runs.map((r) => (
                      <Table.Row key={r.id} id={r.id} className={selectableRow}>
                        <Table.Cell>
                          <span className="flex flex-col">
                            <span className="font-medium tabular">{r.date}</span>
                            <span className="text-xs text-muted">{r.by}</span>
                          </span>
                        </Table.Cell>
                        <Table.Cell className="text-[13px] tabular">{r.end}</Table.Cell>
                        <Table.Cell>
                          <ToneChip tone={r.tone} className="whitespace-nowrap">
                            {r.result}
                          </ToneChip>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          </Card>

          <Card variant="secondary" className="gap-2.5 p-4" aria-labelledby="log-h" render={(p) => <section {...p} />}>
            <div className="flex items-center justify-between gap-2">
              <h2 id="log-h" className="text-sm leading-5 font-semibold">
                Run Log · {cur.date}
              </h2>
              <LinkButton href={screenHref("GeneralLedger")} size="sm" variant="ghost">
                Postings
              </LinkButton>
            </div>
            <ol className="m-0 flex list-none flex-col gap-1.5 p-0 font-mono text-xs leading-[17px]">
              {cur.log.map((l) => (
                <li key={`${l.t}-${l.m}`} className="flex items-start gap-2.5">
                  <span className="shrink-0 text-muted">{l.t}</span>
                  <span className={l.tone ? LOG_COLOR[l.tone] : "text-foreground"}>{l.m}</span>
                </li>
              ))}
            </ol>
          </Card>
          <p className="text-xs leading-4 text-muted">
            Night audit runs as a scheduled job at 23:30. Cashier shift closes happen per till during the day and are
            checked here, not replaced.
          </p>
        </div>
      </div>

      <Modal.Backdrop isOpen={dialog} onOpenChange={setDialog}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-[520px]">
            <Modal.Header className="flex-col items-start gap-1">
              <Modal.Heading>Roll Business Date to Tuesday 13 Oct?</Modal.Heading>
              <p className="text-[13px] leading-[18px] text-muted">This cannot be undone from here.</p>
            </Modal.Header>
            <Modal.Body>
              <ul className="m-0 flex list-disc flex-col gap-1.5 pl-[18px] text-[13px] leading-[18px]">
                <li>12 Oct room, tax and outlet postings lock. Later changes need a correction with a reason code.</li>
                <li>3 Pending fiscal receipts carry over with the same request IDs.</li>
                <li>2 checked-out folios with balances stay in the Finance exception queue.</li>
                <li>Rate exception for room 402 stays with Aline Uwase.</li>
              </ul>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" slot="close">
                Cancel
              </Button>
              <Button
                onPress={() => {
                  setRolled(true);
                  setRun("r12");
                  setDialog(false);
                }}
              >
                Roll to 13 Oct
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </PageContent>
  );
}
