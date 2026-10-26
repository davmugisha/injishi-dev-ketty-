"use client";

import { ArrowDownToLine, Check, Lock, Paperclip, ScalesBalanced } from "@gravity-ui/icons";
import { Alert, Button, Card, Chip, Label, Table, TextArea, TextField } from "@heroui/react";
import { ItemCard, ListView, Segment, Stepper } from "@heroui-pro/react";
import type { AccountGroup, LedgerAccount, LedgerPosting, MoneyOverride, ReconRun } from "@injishi/data/fixtures/admin";
import { Icon, PageContent, PageHeader, SectionHeader, StatusDot } from "@injishi/ui";
import { useState } from "react";
import { amount, compactRwf, firstKey, money, ToneChip } from "./shared";

interface AdminMoneyData {
  accounts: LedgerAccount[];
  postings: LedgerPosting[];
  runs: ReconRun[];
  overrides: MoneyOverride[];
}

const GROUPS: { id: "all" | AccountGroup; label: string }[] = [
  { id: "all", label: "All" },
  { id: "rev", label: "Revenue" },
  { id: "recv", label: "Receivable" },
  { id: "pay", label: "Payables" },
  { id: "def", label: "Deferred" },
  { id: "bank", label: "Bank" },
];

const NOTE = "Tenant owner confirmed on SUP-4131 that the 480,000 transfer covers the Group plan and the SMS bundle.";

function accountValue(a: LedgerAccount): string {
  return a.value == null ? (a.status ?? "") : compactRwf(a.value);
}

export function AdminMoneyView({ data }: { data: AdminMoneyData }) {
  const [group, setGroup] = useState<(typeof GROUPS)[number]["id"]>("all");
  const [runId, setRunId] = useState(data.runs[0]?.id ?? "");
  const [ovId, setOvId] = useState(data.overrides[0]?.id ?? "");
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);

  const journal = data.postings.filter((j) => group === "all" || j.groups.includes(group));
  const run = data.runs.find((r) => r.id === runId) ?? data.runs[0];
  const ov = data.overrides.find((o) => o.id === ovId) ?? data.overrides[0];
  const activeStep = ov.steps.findIndex((s) => s.status !== "complete");

  return (
    <PageContent>
      <PageHeader
        eyebrow={
          <>
            Platform › Money · Injishi ledger · October 2026
            <ToneChip tone="default">Read-only for Support</ToneChip>
          </>
        }
        title="Platform Money"
        description="Append-only, balanced postings for Injishi’s own money: subscriptions, fees, broker credits and vendor bills. Tenant money settles directly to each merchant and never passes through this ledger."
        actions={
          <>
            <span className="text-xs text-muted">Exports: Platform finance only</span>
            <Button variant="secondary" isDisabled>
              <ArrowDownToLine className="size-4" />
              Export ledger
            </Button>
          </>
        }
      />

      <section
        className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(150px,100%),1fr))]"
        aria-label="Account balances"
      >
        {data.accounts.map((a) => (
          <Card key={a.id} className="gap-1.5 px-4 py-3.5">
            <div className="flex items-center gap-2">
              <Icon name={a.icon} className="size-4 text-muted" />
              <span className="flex-1 text-xs leading-4 text-muted">{a.label}</span>
            </div>
            <span className="text-lg leading-6 font-semibold tabular">{accountValue(a)}</span>
            <span className="text-xs leading-4 text-muted">{a.foot}</span>
            {a.chip ? (
              <Chip
                size="sm"
                variant="soft"
                color={a.chipTone === "warning" ? "warning" : "default"}
                className="self-start"
              >
                {a.locked ? <Lock className="size-3" /> : null}
                <Chip.Label>{a.chip}</Chip.Label>
              </Chip>
            ) : null}
          </Card>
        ))}
      </section>

      <Alert status="success" role="status">
        <Alert.Indicator>
          <ScalesBalanced />
        </Alert.Indicator>
        <Alert.Content>
          <Alert.Title>Ledger balanced · debits RWF 58,214,000 = credits RWF 58,214,000</Alert.Title>
          <Alert.Description>
            Checked 09:40 CAT across 1,906 entries. Corrections are reversing entries, never edits. Escrow and
            platform-held caution deposits are not enabled — they require a legal and bank design first.
          </Alert.Description>
        </Alert.Content>
      </Alert>

      <section className="flex flex-col gap-2.5" aria-labelledby="jr-h">
        <SectionHeader
          id="jr-h"
          title="Ledger Postings"
          description="Newest first. Each entry is one balanced posting with its source evidence."
          action={
            <Segment
              aria-label="Account group"
              selectedKey={group}
              onSelectionChange={(k) => setGroup(String(k) as (typeof GROUPS)[number]["id"])}
            >
              {GROUPS.map((g) => (
                <Segment.Item key={g.id} id={g.id}>
                  {g.label}
                </Segment.Item>
              ))}
            </Segment>
          }
        />
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="Ledger postings">
              <Table.Header>
                <Table.Column isRowHeader>Entry</Table.Column>
                <Table.Column>Event and source</Table.Column>
                <Table.Column>Debit</Table.Column>
                <Table.Column>Credit</Table.Column>
                <Table.Column className="text-right">Amount</Table.Column>
                <Table.Column>Evidence</Table.Column>
              </Table.Header>
              <Table.Body>
                {journal.map((j) => (
                  <Table.Row key={j.id} id={j.id}>
                    <Table.Cell className="whitespace-nowrap">
                      <span className="flex flex-col">
                        <span className="text-[13px] font-medium tabular">{j.id}</span>
                        <span className="text-xs text-muted tabular">{j.at}</span>
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="flex flex-col">
                        <span className="flex items-center gap-1.5">
                          <span className="font-medium">{j.event}</span>
                          {j.reversal ? <ToneChip tone="warning">Reversal</ToneChip> : null}
                        </span>
                        <span className="text-xs text-muted">{j.source}</span>
                      </span>
                    </Table.Cell>
                    <Table.Cell className="text-[13px]">{j.debit}</Table.Cell>
                    <Table.Cell className="text-[13px]">{j.credit}</Table.Cell>
                    <Table.Cell className="text-right whitespace-nowrap tabular">{money(j.amount)}</Table.Cell>
                    <Table.Cell className="text-xs text-muted">{j.evidence}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      </section>

      <div className="flex flex-wrap items-start gap-4">
        <Card
          className="min-w-0 flex-[1_1_420px] gap-3 p-[18px]"
          aria-labelledby="rc-h"
          render={(p) => <section {...p} />}
        >
          <div className="flex flex-col gap-0.5">
            <h2 id="rc-h" className="text-[15px] leading-[22px] font-semibold">
              Provider Reconciliation
            </h2>
            <p className="text-[13px] leading-[18px] text-muted">
              Statements and provider reports against platform invoices and postings. Bank statements are imported as
              files; the GT Bank reporting API is not verified.
            </p>
          </div>
          <ListView
            aria-label="Reconciliation runs"
            variant="secondary"
            selectionMode="single"
            selectionBehavior="replace"
            disallowEmptySelection
            selectedKeys={new Set([run.id])}
            onSelectionChange={(keys) => {
              const k = firstKey(keys);
              if (k) setRunId(k);
            }}
          >
            {data.runs.map((r) => (
              <ListView.Item key={r.id} id={r.id} textValue={`${r.id} ${r.source}`} className="items-start">
                <ListView.ItemContent className="items-start">
                  <StatusDot tone={r.tone} className="mt-1.5" />
                  <div className="flex min-w-0 flex-col">
                    <ListView.Title>
                      {r.id} · {r.source}
                    </ListView.Title>
                    <ListView.Description>
                      {r.date} · {r.matched} of {r.lines} lines matched
                    </ListView.Description>
                  </div>
                </ListView.ItemContent>
                <ListView.ItemAction>
                  <ToneChip tone={r.tone}>{r.state}</ToneChip>
                </ListView.ItemAction>
              </ListView.Item>
            ))}
          </ListView>
          <h3 className="text-[13px] leading-[18px] font-semibold">Exceptions in {run.id}</h3>
          {run.exceptions.length > 0 ? (
            <div className="flex flex-col gap-2">
              {run.exceptions.map((x) => (
                <ItemCard key={x.ref} variant="secondary">
                  <ItemCard.Content>
                    <ItemCard.Title className="tabular">
                      {x.ref} · {money(x.amount)}
                    </ItemCard.Title>
                    <ItemCard.Description className="whitespace-normal">
                      “{x.memo}” · {x.note}
                    </ItemCard.Description>
                  </ItemCard.Content>
                  <ItemCard.Action>
                    <ToneChip tone={x.tone}>{x.label}</ToneChip>
                  </ItemCard.Action>
                </ItemCard>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-muted">Every line matched a posting. Nothing to resolve.</p>
          )}
        </Card>

        <Card
          className="min-w-0 flex-[1.3_1_520px] gap-3 p-[18px]"
          aria-labelledby="ov-h"
          render={(p) => <section {...p} />}
        >
          <div className="flex flex-col gap-0.5">
            <h2 id="ov-h" className="text-[15px] leading-[22px] font-semibold">
              Money Overrides
            </h2>
            <p className="text-[13px] leading-[18px] text-muted">
              Manual matches, write-offs and reversals need a requester and a different second approver from Platform
              finance.
            </p>
          </div>
          <div className="flex flex-wrap items-start gap-3.5">
            <ListView
              aria-label="Money overrides"
              variant="secondary"
              className="min-w-0 flex-[1_1_180px]"
              selectionMode="single"
              selectionBehavior="replace"
              disallowEmptySelection
              selectedKeys={new Set([ov.id])}
              onSelectionChange={(keys) => {
                const k = firstKey(keys);
                if (k) {
                  setOvId(k);
                  setNoteOpen(false);
                }
              }}
            >
              {data.overrides.map((o) => (
                <ListView.Item key={o.id} id={o.id} textValue={o.id} className="items-start">
                  <ListView.ItemContent>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="font-medium tabular">{o.id}</span>
                      <span className="text-xs leading-4 text-muted">{o.short}</span>
                      <ToneChip tone={o.tone} className="self-start">
                        {o.state}
                      </ToneChip>
                    </div>
                  </ListView.ItemContent>
                </ListView.Item>
              ))}
            </ListView>

            <div className="flex min-w-0 flex-[2_1_300px] flex-col gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-[15px] font-semibold">{ov.reason}</span>
                <span className="text-xs text-muted tabular">
                  {ov.id} · {money(ov.amount)} · {ov.source}
                </span>
              </div>
              <Stepper
                orientation="vertical"
                size="sm"
                currentStep={activeStep < 0 ? ov.steps.length : activeStep}
                aria-label="Override progress"
              >
                {ov.steps.map((s) => (
                  <Stepper.Step key={s.title}>
                    <Stepper.Indicator />
                    <Stepper.Content>
                      <Stepper.Title>{s.title}</Stepper.Title>
                      <Stepper.Description>{s.desc}</Stepper.Description>
                    </Stepper.Content>
                    <Stepper.Separator />
                  </Stepper.Step>
                ))}
              </Stepper>
              <div className="flex flex-col gap-1.5">
                <Label>Evidence</Label>
                {ov.evidence.map((e) => (
                  <span key={e} className="flex items-center gap-2 text-[13px] leading-[18px]">
                    <Paperclip className="size-4 text-muted" />
                    {e}
                  </span>
                ))}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Postings</Label>
                <Card variant="secondary" className="gap-1.5 px-3 py-2.5">
                  {ov.postings.map((p) => (
                    <div
                      key={`${p.side}-${p.account}`}
                      className="flex items-baseline justify-between gap-3 text-[13px]"
                    >
                      <span>
                        <span className="inline-block w-[26px] text-muted">{p.side}</span>
                        {p.account}
                      </span>
                      <span className="tabular">{amount(p.amount)}</span>
                    </div>
                  ))}
                  <span className="flex items-center gap-1.5 text-xs text-success">
                    <Check className="size-3" />
                    Debits equal credits
                  </span>
                </Card>
              </div>
              {ov.awaiting ? (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" isDisabled>
                      Approve and post
                    </Button>
                    <Button size="sm" variant="secondary" onPress={() => setNoteOpen((open) => !open)}>
                      Add support context
                    </Button>
                  </div>
                  <p className="text-xs leading-4 text-muted">
                    Only Clarisse Umutoni or another Platform finance approver can approve. The requester can never
                    approve their own override.
                  </p>
                  {noteOpen && !noteSaved ? (
                    <div className="flex flex-col gap-1.5">
                      <TextField fullWidth defaultValue={NOTE}>
                        <Label>Note for the approver</Label>
                        <TextArea rows={2} />
                      </TextField>
                      <Button size="sm" variant="secondary" className="self-start" onPress={() => setNoteSaved(true)}>
                        Add note
                      </Button>
                    </div>
                  ) : null}
                  {noteSaved ? (
                    <Chip size="sm" variant="soft" color="success" className="self-start">
                      <Check className="size-3" />
                      <Chip.Label>Note added · visible to approver · logged</Chip.Label>
                    </Chip>
                  ) : null}
                </div>
              ) : (
                <p className="text-xs leading-4 text-muted">{ov.outcome}</p>
              )}
            </div>
          </div>
        </Card>
      </div>
    </PageContent>
  );
}
