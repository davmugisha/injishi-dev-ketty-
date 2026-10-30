"use client";

import { ArrowsRotateRight, Check, CircleCheck, Link, Lock, PersonsLock, Vault } from "@gravity-ui/icons";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  CheckboxGroup,
  Label,
  Modal,
  NumberField,
  Separator,
  Table,
  Tabs,
  TextArea,
  TextField,
} from "@heroui/react";
import { ItemCard, ListView, Widget } from "@heroui-pro/react";
import { BarChart } from "@heroui-pro/react/bar-chart";
import { screenHref } from "@injishi/data";
import type {
  MatchSummaryItem,
  ReconInvoice,
  ReconMatch,
  ReconSource,
  SettlementBatch,
  Tone,
} from "@injishi/data/fixtures/finance";
import { GateChip, Icon, LinkButton, PageContent, PageHeader, StatusDot } from "@injishi/ui";
import { type Key, useState } from "react";
import { CheckIcon, lineTab, money, selectableRow, TabCount, ToneChip } from "./pay-parts";

interface ReconciliationData {
  sources: ReconSource[];
  summary: MatchSummaryItem[];
  matches: ReconMatch[];
  invoices: ReconInvoice[];
  batches: SettlementBatch[];
}

const TABS: { id: ReconMatch["tab"]; label: string }[] = [
  { id: "suggested", label: "Suggested" },
  { id: "bank", label: "Unmatched bank lines" },
  { id: "ledger", label: "Unmatched ledger" },
];

/** Chart colour per match state (artifact: Match Summary legend and bar). */
const SUMMARY_COLOR: Record<MatchSummaryItem["id"], string> = {
  auto: "var(--chart-3)",
  suggested: "var(--chart-2)",
  bank: "var(--chart-5)",
  ledger: "var(--chart-4)",
  fiscal: "var(--chart-1)",
};

/** The bank credit being allocated to Umurage Consulting's receivables (statement line 187). */
const CREDIT = 1200000;
/** Open on city-ledger account CL-014 before this allocation. */
const CL014_OPEN = 2100400;

function firstKey(keys: "all" | Set<Key>): string | null {
  if (keys === "all") return null;
  const [k] = [...keys];
  return k === undefined ? null : String(k);
}

const amountOrDash = (n: number | null, empty: string) => (n === null ? empty : money(n));

export function ReconciliationView({ data }: { data: ReconciliationData }) {
  const [tab, setTab] = useState<ReconMatch["tab"]>("suggested");
  const [sel, setSel] = useState("s1");
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [waiting, setWaiting] = useState<Record<string, boolean>>({});
  const [manualOpen, setManualOpen] = useState(false);
  const [cand, setCand] = useState<Record<string, string[]>>({});
  const [alloc, setAlloc] = useState<Record<string, number>>({});
  const [proposed, setProposed] = useState(false);
  const [rerun, setRerun] = useState(false);

  const statusOf = (m: ReconMatch): { label: string; tone: Tone } => {
    if (done[m.id]) return { label: "Matched", tone: "success" };
    if (waiting[m.id]) return { label: "Waiting approval", tone: "accent" };
    if (m.tab === "suggested")
      return { label: `Suggested · ${m.confidence}`, tone: m.confidence === "High" ? "info" : "warning" };
    if (m.tab === "bank") return { label: "Unmatched", tone: "danger" };
    return { label: "Not settled", tone: "default" };
  };

  const tabs = TABS.map((t) => ({ ...t, count: data.matches.filter((m) => m.tab === t.id && !done[m.id]).length }));
  const rows = data.matches.filter((m) => m.tab === tab);
  const m = data.matches.find((x) => x.id === sel) ?? data.matches[0];
  const st = statusOf(m);
  const isDone = !!done[m.id];
  const isWaiting = !!waiting[m.id];

  // Manual match: the ledger record plus any fee postings, each selected unless unticked.
  const candidates =
    m.ledger === null
      ? []
      : [
          { key: `${m.id}-0`, label: `Ledger · ${m.ledgerText}`, amount: m.ledger },
          ...m.postings
            .filter((p) => p.side === "Dr" && /fees/i.test(p.account))
            .map((p, i) => ({ key: `${m.id}-${i + 1}`, label: p.account, amount: -p.amount })),
        ];
  const picked = cand[m.id] ?? candidates.map((c) => c.key);
  const candSum = candidates.filter((c) => picked.includes(c.key)).reduce((a, c) => a + c.amount, 0);
  const gap = (m.bank ?? 0) - candSum;
  const manualSummary =
    m.bank === null
      ? `Selected ${money(candSum)} · no statement line yet`
      : `Selected ${money(candSum)} · ${gap === 0 ? "balances to the bank line" : `gap ${money(gap)}`}`;

  // Allocation of the Umurage credit, oldest invoices first by default.
  const appliedTo = (v: ReconInvoice) => alloc[v.id] ?? v.suggested;
  const allocSum = data.invoices.reduce((a, v) => a + appliedTo(v), 0);
  const badInv = data.invoices.find((v) => appliedTo(v) > v.max);
  const rem = CREDIT - allocSum;
  const over = rem < 0;
  const partial = data.invoices
    .filter((v) => appliedTo(v) > 0 && appliedTo(v) < v.open)
    .map((v) => `${v.id} keeps ${money(v.open - appliedTo(v))} open`);
  const canPropose = !proposed && !over && !badInv && allocSum > 0;
  const blockWhy = badInv
    ? badInv.note
      ? `${badInv.id} has a disputed part. Apply at most ${money(badInv.max)}.`
      : `${badInv.id} has only ${money(badInv.open)} open.`
    : over
      ? "An allocation cannot exceed the bank credit of RWF 1,200,000."
      : "Enter an amount for at least one invoice.";
  const remText = over
    ? `Over by ${money(-rem)}`
    : rem === 0
      ? "Fully allocated"
      : `${money(rem)} left as credit on account`;
  const remTone: Tone = over ? "danger" : rem === 0 ? "success" : "warning";
  const proposedText = `Proposed by you at 10:19: ${data.invoices
    .filter((v) => appliedTo(v) > 0)
    .map((v) => `${v.id} ${money(appliedTo(v))}`)
    .join(
      ", ",
    )}. After approval Umurage owes ${money(CL014_OPEN - allocSum)}${partial.length ? `; ${partial.join(", ")}` : ""}. Until then every invoice stays open.`;

  const doneN = Object.keys(done).length;
  const summary = data.summary.map((s) => ({
    ...s,
    count:
      s.id === "auto"
        ? s.count + doneN
        : s.id === "suggested"
          ? data.matches.filter((x) => x.tab === "suggested" && !done[x.id]).length
          : s.count,
  }));
  const barLabel = `Statement lines by match state: ${summary.map((s) => `${s.label} ${s.count}`).join(", ")}`;
  const bar = [Object.fromEntries([["name", "Statement lines"], ...summary.map((s) => [s.id, s.count])])] as Record<
    string,
    number | string
  >[];

  return (
    <PageContent className="text-sm">
      <PageHeader
        eyebrow="Reconcile & comply · Run RR-1012-01 · started 06:05"
        title="Reconciliation · 11 Oct Statement"
        description="GT Bank statement and settlement files against the payment ledger, folios and fiscal receipts."
        actions={
          <>
            <span className="text-xs text-muted tabular">
              {rerun ? "Re-run 10:16 · 0 new matches" : "Last run 06:05"}
            </span>
            <Button variant="secondary" onPress={() => setRerun(true)}>
              <ArrowsRotateRight className="size-4" />
              Re-run matching
            </Button>
          </>
        }
      />

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr))]">
        {data.sources.map((s) => (
          <Card key={s.id} variant="secondary" className="gap-1 px-[14px] py-3">
            <span className="flex items-center gap-2">
              <Icon name={s.icon} className="size-4 shrink-0 text-muted" />
              <span className="flex-1 text-[13px] font-semibold">{s.title}</span>
              <StatusDot tone={s.tone} />
            </span>
            <span className="text-base leading-6 font-semibold tabular">{s.value}</span>
            <span className="text-xs leading-4 text-muted tabular">{s.meta}</span>
          </Card>
        ))}
      </div>

      <Widget aria-labelledby="sum-h" render={(p) => <section {...p} />}>
        <Widget.Header className="flex-wrap gap-2">
          <Widget.Title id="sum-h" role="heading" aria-level={2}>
            Match Summary · 214 statement lines
          </Widget.Title>
          <Widget.Legend className="flex-wrap">
            {summary.map((s) => (
              <Widget.LegendItem key={s.id} color={SUMMARY_COLOR[s.id]}>
                {s.label} <strong className="tabular">{s.count}</strong>
              </Widget.LegendItem>
            ))}
          </Widget.Legend>
        </Widget.Header>
        <Widget.Content className="flex flex-col gap-2">
          <div role="img" aria-label={barLabel}>
            <BarChart data={bar} height={14} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <BarChart.XAxis type="number" hide domain={[0, "dataMax"]} />
              <BarChart.YAxis type="category" dataKey="name" hide />
              {summary.map((s, i) => (
                <BarChart.Bar
                  key={s.id}
                  dataKey={s.id}
                  name={s.label}
                  stackId="lines"
                  fill={SUMMARY_COLOR[s.id]}
                  barSize={14}
                  stroke="var(--surface)"
                  strokeWidth={2}
                  isAnimationActive={false}
                  radius={i === 0 ? [999, 0, 0, 999] : i === summary.length - 1 ? [0, 999, 999, 0] : 0}
                />
              ))}
            </BarChart>
          </div>
          <p className="text-xs text-muted">
            Auto-matched lines agree on amount, reference and date with a verified payment or invoice. Suggested and
            manual matches need a person; manual matches need a second approver.
          </p>
        </Widget.Content>
      </Widget>

      <div className="flex flex-wrap items-start gap-4">
        <section className="flex min-w-0 flex-[999_1_600px] flex-col gap-2.5" aria-labelledby="mt-h">
          <h2 id="mt-h" className="text-[15px] leading-[22px] font-semibold">
            Matching
          </h2>
          <Tabs
            variant="secondary"
            selectedKey={tab}
            onSelectionChange={(k) => {
              const next = String(k) as ReconMatch["tab"];
              setTab(next);
              const first = data.matches.find((x) => x.tab === next);
              if (first) setSel(first.id);
            }}
          >
            <Tabs.ListContainer>
              <Tabs.List aria-label="Match status">
                {tabs.map((t) => (
                  <Tabs.Tab key={t.id} id={t.id} className={lineTab}>
                    {t.label}
                    <TabCount count={t.count} />
                    <Tabs.Indicator />
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>
            {TABS.map((t) => (
              <Tabs.Panel key={t.id} id={t.id} className="pt-2.5">
                <Table>
                  <Table.ScrollContainer>
                    <Table.Content
                      aria-label="Statement lines and ledger records"
                      selectionMode="single"
                      selectionBehavior="replace"
                      disallowEmptySelection
                      selectedKeys={new Set([sel])}
                      onSelectionChange={(keys) => {
                        const id = firstKey(keys as "all" | Set<Key>);
                        if (id) setSel(id);
                      }}
                    >
                      <Table.Header>
                        <Table.Column isRowHeader>GT Bank statement</Table.Column>
                        <Table.Column>Payment ledger</Table.Column>
                        <Table.Column>Folio or invoice</Table.Column>
                        <Table.Column>Fiscal</Table.Column>
                        <Table.Column className="text-right">Difference</Table.Column>
                        <Table.Column>Match</Table.Column>
                      </Table.Header>
                      <Table.Body>
                        {rows.map((r) => {
                          const s = statusOf(r);
                          return (
                            <Table.Row key={r.id} id={r.id} className={selectableRow}>
                              <Table.Cell>
                                <span className="flex flex-col">
                                  <span className="text-[13px] font-semibold tabular">{amountOrDash(r.bank, "—")}</span>
                                  <span className="text-xs text-muted tabular">{r.bankText}</span>
                                </span>
                              </Table.Cell>
                              <Table.Cell>
                                <span className="flex flex-col">
                                  <span className="text-[13px] font-medium tabular">
                                    {amountOrDash(r.ledger, "No match")}
                                  </span>
                                  <span className="text-xs text-muted tabular">{r.ledgerText}</span>
                                </span>
                              </Table.Cell>
                              <Table.Cell className="text-xs tabular">{r.record}</Table.Cell>
                              <Table.Cell className="text-xs tabular">{r.fiscal}</Table.Cell>
                              <Table.Cell className="text-right text-[13px] whitespace-nowrap tabular">
                                {r.diff === null ? "—" : money(r.diff)}
                              </Table.Cell>
                              <Table.Cell>
                                <ToneChip tone={s.tone} className="whitespace-nowrap">
                                  {s.label}
                                </ToneChip>
                              </Table.Cell>
                            </Table.Row>
                          );
                        })}
                      </Table.Body>
                    </Table.Content>
                  </Table.ScrollContainer>
                </Table>
              </Tabs.Panel>
            ))}
          </Tabs>
        </section>

        <Card
          className="min-w-0 flex-[1_1_360px] gap-3 p-[18px]"
          aria-labelledby="md-h"
          render={(p) => <section {...p} />}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-xs text-muted">{m.kind}</span>
              <h2 id="md-h" className="text-[15px] leading-[22px] font-semibold">
                {m.title}
              </h2>
            </div>
            <ToneChip tone={st.tone} size="md" className="shrink-0">
              {st.label}
            </ToneChip>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Card variant="secondary" className="gap-0.5 px-3 py-2.5">
              <span className="text-xs text-muted">Bank says</span>
              <span className="font-semibold tabular">{amountOrDash(m.bank, "—")}</span>
              <span className="text-xs leading-4 text-muted tabular">{m.bankText}</span>
            </Card>
            <Card variant="secondary" className="gap-0.5 px-3 py-2.5">
              <span className="text-xs text-muted">Injishi says</span>
              <span className="font-semibold tabular">{amountOrDash(m.ledger, "No match")}</span>
              <span className="text-xs leading-4 text-muted tabular">{m.ledgerText}</span>
            </Card>
          </div>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {m.reasons.map((r) => (
              <li key={r.text} className="flex items-start gap-2 text-[13px] leading-[18px]">
                <CheckIcon tone={r.tone} />
                <span>{r.text}</span>
              </li>
            ))}
          </ul>
          {m.postings.length ? (
            <div className="flex flex-col gap-1.5">
              <h3 className="text-xs font-semibold text-muted">Ledger postings on match · append-only, balanced</h3>
              {m.postings.map((p) => (
                <div key={`${p.side}-${p.account}`} className="flex justify-between gap-3 text-xs tabular">
                  <span>
                    {p.side} · {p.account}
                  </span>
                  <span className="font-medium">{money(p.amount)}</span>
                </div>
              ))}
            </div>
          ) : null}
          {isDone ? (
            <Alert status="success" role="status">
              <Alert.Indicator>
                <CircleCheck />
              </Alert.Indicator>
              <Alert.Content>
                <Alert.Title>Matched by Grace Uwera at 10:17</Alert.Title>
                <Alert.Description>
                  Postings written once. The statement line and the payments now share one reconciliation ID.
                </Alert.Description>
              </Alert.Content>
            </Alert>
          ) : null}
          {isWaiting ? (
            <Alert status="accent" role="status">
              <Alert.Indicator>
                <PersonsLock />
              </Alert.Indicator>
              <Alert.Content>
                <Alert.Title>Manual match waiting for a second approver</Alert.Title>
                <Alert.Description>
                  Sent to Aline Uwase at 10:18 with your reason. You prepared it, so you cannot approve it. Nothing
                  posts until then.
                </Alert.Description>
              </Alert.Content>
            </Alert>
          ) : null}
          {!isDone && !isWaiting ? (
            <div className="flex flex-col gap-2">
              {m.canAccept ? (
                <Button className="self-start" onPress={() => setDone((d) => ({ ...d, [m.id]: true }))}>
                  <Check className="size-4" />
                  Accept suggested match
                </Button>
              ) : (
                <>
                  <Button isDisabled aria-describedby="acc-why" className="self-start">
                    <Lock className="size-4" />
                    Accept suggested match
                  </Button>
                  <span id="acc-why" className="text-xs leading-4 text-muted">
                    {m.why}
                  </span>
                </>
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onPress={() => setManualOpen(true)}>
                  <Link className="size-4" />
                  Match manually
                </Button>
                {m.board ? (
                  <LinkButton href={screenHref(m.board)} size="sm" variant="ghost">
                    {m.cta}
                  </LinkButton>
                ) : null}
              </div>
            </div>
          ) : null}
        </Card>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <Card
          className="min-w-0 flex-[999_1_560px] gap-3 p-[18px]"
          aria-labelledby="al-h"
          render={(p) => <section {...p} />}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <Card.Header>
              <Card.Title id="al-h" className="text-[15px] font-semibold">
                Allocate Bank Transfer · Umurage Consulting Ltd
              </Card.Title>
              <Card.Description className="tabular">
                Statement line 187 · FT26285QW7L2 · RWF 1,200,000 · value date 11 Oct · city ledger CL-014
              </Card.Description>
            </Card.Header>
            <ToneChip tone={proposed ? "accent" : "warning"} size="md">
              {proposed ? "Proposed · awaiting approval" : "Unmatched credit"}
            </ToneChip>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted">
              Open invoices on CL-014 · RWF 2,100,400 · type the amount to apply to each
            </span>
            <Button size="sm" variant="ghost" isDisabled={proposed} onPress={() => setAlloc({})}>
              Oldest first
            </Button>
          </div>
          <div className="flex flex-col">
            {data.invoices.map((v) => {
              const value = appliedTo(v);
              return (
                <div key={v.id} className="flex flex-wrap items-center gap-3 border-t border-separator px-1 py-2.5">
                  <span className="flex min-w-0 flex-[1_1_240px] flex-col">
                    <span className="font-medium tabular">
                      {v.id} · {v.src}
                    </span>
                    <span className="text-xs text-muted tabular">
                      Due {v.due} · open {money(v.open)} · fiscal {v.ebm}
                    </span>
                    {v.note ? <span className="text-xs text-warning-soft-foreground">{v.note}</span> : null}
                  </span>
                  <ToneChip tone={v.bucketTone}>{v.bucket}</ToneChip>
                  <NumberField
                    value={value}
                    minValue={0}
                    isReadOnly={proposed}
                    isInvalid={value > v.max}
                    onChange={(n) => setAlloc((a) => ({ ...a, [v.id]: Number.isFinite(n) ? (n ?? 0) : 0 }))}
                    className="w-[150px]"
                  >
                    <Label className="sr-only">Amount to apply to {v.id}</Label>
                    <NumberField.Group>
                      <NumberField.Input className="text-right tabular" />
                    </NumberField.Group>
                  </NumberField>
                </div>
              );
            })}
          </div>
          <Separator />
          <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] tabular">
            <span>
              Allocated <strong>{money(allocSum)}</strong> of RWF 1,200,000
            </span>
            <ToneChip tone={remTone} size="md">
              {remText}
            </ToneChip>
          </div>
          {canPropose ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onPress={() => setProposed(true)}>
                Propose allocation for approval
              </Button>
              <span className="text-xs text-muted">
                Aline Uwase or Didier Mugenzi approves · oldest invoices first is the default
              </span>
            </div>
          ) : null}
          {!proposed && !canPropose ? (
            <span className="text-xs text-muted" role="status">
              {blockWhy}
            </span>
          ) : null}
          {proposed ? (
            <Alert status="accent" role="status">
              <Alert.Indicator>
                <PersonsLock />
              </Alert.Indicator>
              <Alert.Content>
                <Alert.Title>Waiting for second approver</Alert.Title>
                <Alert.Description>{proposedText}</Alert.Description>
              </Alert.Content>
            </Alert>
          ) : null}
        </Card>

        <Card
          className="min-w-0 flex-[1_1_360px] gap-3 p-[18px]"
          aria-labelledby="st-h"
          render={(p) => <section {...p} />}
        >
          <Card.Header>
            <Card.Title id="st-h" className="text-[15px] font-semibold">
              Settlement
            </Card.Title>
            <Card.Description>Where the money lands, and what is still in transit</Card.Description>
          </Card.Header>
          <ItemCard variant="secondary">
            <ItemCard.Icon>
              <Vault />
            </ItemCard.Icon>
            <ItemCard.Content>
              <ItemCard.Title>Direct merchant settlement</ItemCard.Title>
              <ItemCard.Description className="whitespace-normal">
                To Amahoro Hospitality Ltd’s GT Bank account ••• 4471. Injishi never holds guest money.
              </ItemCard.Description>
            </ItemCard.Content>
            <ItemCard.Action>
              <ToneChip tone="success">Active</ToneChip>
            </ItemCard.Action>
          </ItemCard>
          <ItemCard variant="secondary">
            <ItemCard.Icon>
              <Lock />
            </ItemCard.Icon>
            <ItemCard.Content>
              <ItemCard.Title>Escrow and safeguarding</ItemCard.Title>
              <ItemCard.Description className="whitespace-normal">
                Not enabled. Needs a legal and bank design first; deposits stay liabilities on folios.
              </ItemCard.Description>
            </ItemCard.Content>
            <ItemCard.Action>
              <GateChip icon={<Lock className="size-3" />}>External gate</GateChip>
            </ItemCard.Action>
          </ItemCard>
          <ListView aria-label="Settlement batches" variant="secondary" items={data.batches}>
            {(b) => (
              <ListView.Item id={b.id} textValue={b.name}>
                <ListView.ItemContent>
                  <StatusDot tone={b.tone} />
                  <div className="flex min-w-0 flex-col">
                    <ListView.Title>{b.name}</ListView.Title>
                    <ListView.Description className="tabular">{b.meta}</ListView.Description>
                  </div>
                </ListView.ItemContent>
                <ListView.ItemAction>
                  <span className="text-[13px] font-medium tabular">{amountOrDash(b.amount, "—")}</span>
                </ListView.ItemAction>
              </ListView.Item>
            )}
          </ListView>
        </Card>
      </div>

      <Modal.Backdrop isOpen={manualOpen} onOpenChange={setManualOpen}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-[720px]">
            <Modal.Header className="flex-col items-start gap-1">
              <Modal.Heading>Match Manually · {m.title}</Modal.Heading>
              <p className="text-[13px] leading-[18px] text-muted tabular">
                Bank line {amountOrDash(m.bank, "—")}. Pick the ledger records it settles and explain any difference. A
                second person approves before anything posts.
              </p>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4">
              {candidates.length ? (
                <CheckboxGroup
                  aria-label="Ledger records this bank line settles"
                  value={picked}
                  onChange={(v) => setCand((c) => ({ ...c, [m.id]: v }))}
                  className="flex flex-col gap-0.5"
                >
                  {candidates.map((c) => (
                    <Checkbox key={c.key} value={c.key} className="rounded-xl px-2 py-1.5">
                      <Checkbox.Content className="flex w-full items-center gap-2">
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                        <span className="flex-1 tabular">{c.label}</span>
                        <span className="font-medium tabular">{money(c.amount)}</span>
                      </Checkbox.Content>
                    </Checkbox>
                  ))}
                </CheckboxGroup>
              ) : (
                <p className="text-[13px] text-muted">
                  No ledger record carries this amount or reference. Search the ledger by amount, date or payer before
                  matching.
                </p>
              )}
              <TextField fullWidth defaultValue={m.manualReason ?? ""}>
                <Label>Reason for the difference</Label>
                <TextArea rows={2} placeholder="Explain why these records belong together" />
              </TextField>
            </Modal.Body>
            <Modal.Footer className="flex flex-wrap items-center gap-2">
              <span className="mr-auto text-[13px] text-muted tabular">{manualSummary}</span>
              <span className="ml-auto flex gap-2">
                <Button variant="ghost" slot="close">
                  Cancel
                </Button>
                <Button
                  onPress={() => {
                    setWaiting((w) => ({ ...w, [m.id]: true }));
                    setManualOpen(false);
                  }}
                >
                  Send to second approver
                </Button>
              </span>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </PageContent>
  );
}
