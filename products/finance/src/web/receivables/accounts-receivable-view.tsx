"use client";

import { ArrowDownToLine, ArrowRightArrowLeft, Briefcase } from "@gravity-ui/icons";
import { Avatar, Button, Card, Chip, ProgressBar, Table, Tabs } from "@heroui/react";
import { EmptyState, ListView, Segment, Widget } from "@heroui-pro/react";
import { BarChart } from "@heroui-pro/react/bar-chart";
import { LinkButton, PageContent, PageHeader, toneColor } from "@injishi/ui";
import { useState } from "react";
import { Cell, LabelList } from "recharts";
import type { AccountingKpi, AgingBucket, ArAccount, BankTransfer, LogEntry } from "../../model/accounting.ts";
import type { Persona, Tone } from "../../model/shared.ts";
import {
  firstKey,
  type KpiItem,
  KpiStrip,
  LINE_LIST,
  LINE_PANEL,
  LINE_TAB,
  Note,
  rwf,
  Stack,
} from "../accounting-parts.tsx";
import { useBoardHref } from "../mount.tsx";
import { ArAccountCard, ArCollectionsCard, ArInvoicesCard, type DisputeState } from "./ar-account-cards.tsx";
import { ArAllocationDialog } from "./ar-allocation-dialog.tsx";

interface AccountsReceivableData {
  kpis: AccountingKpi[];
  accounts: ArAccount[];
  aging: AgingBucket[];
  transfers: BankTransfer[];
}

const ENTITIES = [
  { id: "ahl", label: "Amahoro Hospitality Ltd" },
  { id: "res", label: "Amahoro Residences Ltd" },
] as const;

const KINDS = [
  { id: "all", label: "All accounts" },
  { id: "company", label: "Companies" },
  { id: "agent", label: "Travel agents" },
] as const;
type KindId = (typeof KINDS)[number]["id"];

const AGING_COLOR: Record<AgingBucket["severity"], string> = {
  none: "var(--chart-3)",
  low: "var(--chart-2)",
  medium: "var(--warning)",
  high: "var(--danger)",
};

const TRANSFER_STATE: Record<BankTransfer["status"], { label: string; tone: Tone }> = {
  unmatched: { label: "Unmatched", tone: "warning" },
  pending: { label: "Pending approval", tone: "default" },
  verified: { label: "Verified", tone: "success" },
};

const avatarColor = (sev: Tone) => (sev === "danger" ? "danger" : sev === "warning" ? "warning" : "default");

function AccountsTable({
  accounts,
  selectedId,
  onSelect,
  label,
}: {
  accounts: ArAccount[];
  selectedId: string;
  onSelect: (id: string) => void;
  label: string;
}) {
  return (
    <Table>
      <Table.ScrollContainer>
        <Table.Content
          className="min-w-[680px]"
          aria-label={label}
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={new Set([selectedId])}
          onSelectionChange={(keys) => {
            const id = firstKey(keys);
            if (id) onSelect(id);
          }}
        >
          <Table.Header>
            <Table.Column isRowHeader>Account</Table.Column>
            <Table.Column>Terms</Table.Column>
            <Table.Column>Credit used</Table.Column>
            <Table.Column className="text-right">Balance</Table.Column>
            <Table.Column>Oldest item</Table.Column>
          </Table.Header>
          <Table.Body>
            {accounts.map((a) => {
              const pct = a.limit ? Math.round((a.balance / a.limit) * 100) : 0;
              return (
                <Table.Row key={a.id} id={a.id} className="cursor-pointer">
                  <Table.Cell>
                    <span className="flex items-center gap-2.5">
                      <Avatar size="sm" variant="soft" color={avatarColor(a.severity)}>
                        <Avatar.Fallback>{a.initials}</Avatar.Fallback>
                      </Avatar>
                      <Stack primary={a.name} primaryClassName="font-medium" secondary={a.type} />
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <Stack primary={a.terms} secondary={a.termsDetail} />
                  </Table.Cell>
                  <Table.Cell className="min-w-40">
                    <ProgressBar
                      value={pct}
                      size="sm"
                      color={pct >= 80 ? "warning" : "accent"}
                      aria-label={`${a.name} credit used`}
                      className="gap-1.5"
                    >
                      <span className="text-xs tabular">
                        {a.limit ? `${pct}% of ${rwf(a.limit)}` : a.noCreditLine?.usage}
                      </span>
                      <ProgressBar.Track>
                        <ProgressBar.Fill />
                      </ProgressBar.Track>
                    </ProgressBar>
                  </Table.Cell>
                  <Table.Cell className="text-right font-medium tabular">{rwf(a.balance)}</Table.Cell>
                  <Table.Cell>
                    <Chip size="sm" variant="soft" color={toneColor(a.severity)}>
                      {a.oldest}
                    </Chip>
                  </Table.Cell>
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}

function AgingWidget({ aging }: { aging: AgingBucket[] }) {
  const total = aging.reduce((t, g) => t + g.amount, 0);
  const data = aging.map((g) => ({
    label: g.label,
    amount: g.amount,
    short: g.amount ? `${(g.amount / 1e6).toFixed(2)}M` : "0",
  }));
  return (
    <Widget role="region" aria-labelledby="age-h" className="min-w-0 flex-[1_1_340px]">
      <Widget.Header>
        <Widget.Title id="age-h" role="heading" aria-level={2}>
          Aging
        </Widget.Title>
        <span className="text-xs text-muted tabular">{rwf(total)} open</span>
      </Widget.Header>
      <Widget.Content className="flex flex-col gap-2">
        <div
          role="img"
          aria-label={`Receivables aging in RWF: ${aging.map((g) => `${g.label} ${rwf(g.amount)}`).join(", ")}`}
        >
          <BarChart data={data} height={200} margin={{ top: 20, right: 0, bottom: 0, left: 0 }}>
            <BarChart.XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} />
            <BarChart.Bar dataKey="amount" name="Open" radius={[6, 6, 2, 2]} minPointSize={2} isAnimationActive={false}>
              {aging.map((g) => (
                <Cell key={g.id} fill={AGING_COLOR[g.severity]} />
              ))}
              <LabelList dataKey="short" position="top" fill="var(--muted)" fontSize={11} />
            </BarChart.Bar>
          </BarChart>
        </div>
        <ListView aria-label="Aging buckets" variant="secondary" items={aging}>
          {(g) => (
            <ListView.Item id={g.id} textValue={g.name}>
              <ListView.ItemContent>
                <span
                  aria-hidden="true"
                  className="inline-block size-2 shrink-0 rounded-full"
                  style={{ background: AGING_COLOR[g.severity] }}
                />
                <ListView.Title className="whitespace-normal">{g.name}</ListView.Title>
              </ListView.ItemContent>
              <ListView.ItemAction>
                <span className="text-[13px] tabular">{rwf(g.amount)}</span>
              </ListView.ItemAction>
            </ListView.Item>
          )}
        </ListView>
        <Note>
          Days past due date, RWF, from issued credit invoices. Deposits are liabilities and are not aged. Disputed
          amounts stay in their bucket and are flagged.
        </Note>
      </Widget.Content>
    </Widget>
  );
}

export function AccountsReceivableView({
  persona,
  initialEntity,
  data,
}: {
  persona: Persona;
  initialEntity: "ahl" | "res";
  data: AccountsReceivableData;
}) {
  const screenHref = useBoardHref();
  const [entity, setEntity] = useState<"ahl" | "res">(initialEntity);
  const [kind, setKind] = useState<KindId>("all");
  const [sel, setSel] = useState(data.accounts[0]?.id ?? "");
  const [reminded, setReminded] = useState<Record<string, boolean>>({});
  const [held, setHeld] = useState<Record<string, boolean>>({});
  const [promised, setPromised] = useState<Record<string, string>>({});
  const [promiseOpen, setPromiseOpen] = useState(false);
  const [disputes, setDisputes] = useState<Record<string, DisputeState>>({});
  const [allocFor, setAllocFor] = useState<string | null>(null);
  const [matched, setMatched] = useState<Record<string, boolean>>({});

  const isAhl = entity === "ahl";
  const entName = ENTITIES.find((e) => e.id === entity)?.label ?? "";
  const list = data.accounts.filter((a) => kind === "all" || a.kind === kind);
  const cur = list.find((a) => a.id === sel) ?? list[0];

  const transfers = data.transfers.map((t) => {
    const status: BankTransfer["status"] = matched[t.id] ? "pending" : t.status;
    return { ...t, status, note: matched[t.id] && t.proposedNote ? t.proposedNote : t.note };
  });
  const unmatched = transfers.filter((t) => t.status === "unmatched");
  const matchable = transfers.find((t) => t.status === "unmatched" && t.allocation);
  const allocTransfer = transfers.find((t) => t.id === allocFor && t.allocation);

  const kpis: KpiItem[] = data.kpis.map((k) =>
    k.id === "ar-unmatched"
      ? {
          ...k,
          value: unmatched.reduce((t, b) => t + b.amount, 0),
          foot: `${unmatched.length} ${unmatched.length === 1 ? "statement line" : "statement lines"} not yet linked`,
          status: unmatched.length ? "warning" : "default",
        }
      : k,
  );

  const collections: LogEntry[] = cur ? [...cur.collections] : [];
  if (cur && promised[cur.id])
    collections.push({
      status: "warning",
      title: "12 Oct · Promise to pay",
      detail: `${promised[cur.id]} · recorded by ${persona.name}`,
    });
  if (cur && reminded[cur.id])
    collections.push({
      status: "current",
      title: `12 Oct · Reminder ${collections.filter((c) => c.title.includes("Reminder")).length + 1} queued`,
      detail: "Sends at 11:00 with statement · disputed lines excluded",
    });
  if (cur && held[cur.id])
    collections.push({
      status: "current",
      title: "12 Oct · Credit hold proposed",
      detail: "Waiting for Didier Mugenzi · bookings on account continue until he decides",
    });

  return (
    <PageContent>
      <PageHeader
        eyebrow={`City ledger · Monday 12 October 2026 · Receivable owner: ${entName}`}
        title="Accounts Receivable"
        description="Companies and travel agents billed on credit. Balances move only on issued credit invoices and verified allocations."
        actions={
          <>
            <Segment
              aria-label="Legal entity"
              selectedKey={entity}
              onSelectionChange={(k) => setEntity(String(k) === "res" ? "res" : "ahl")}
            >
              {ENTITIES.map((e) => (
                <Segment.Item key={e.id} id={e.id}>
                  {e.label}
                </Segment.Item>
              ))}
            </Segment>
            <Button variant="secondary">
              <ArrowDownToLine className="size-4" aria-hidden="true" />
              Export aging
            </Button>
            <Button
              isDisabled={!matchable}
              onPress={() => {
                if (!matchable) return;
                setEntity("ahl");
                setAllocFor(matchable.id);
              }}
            >
              <ArrowRightArrowLeft className="size-4" aria-hidden="true" />
              Match bank transfer
            </Button>
          </>
        }
      />

      {!isAhl ? (
        <Card className="p-6">
          <EmptyState>
            <EmptyState.Header>
              <EmptyState.Media variant="icon">
                <Briefcase />
              </EmptyState.Media>
              <EmptyState.Title>No company accounts on credit</EmptyState.Title>
              <EmptyState.Description>
                Amahoro Residences Ltd (TIN 102 345 990) bills tenants per lease. Its receivables sit in its own ledger
                and never mix with the hotel city ledger.
              </EmptyState.Description>
            </EmptyState.Header>
            <EmptyState.Content>
              <Button size="sm" variant="secondary" onPress={() => setEntity("ahl")}>
                Show Amahoro Hospitality Ltd
              </Button>
            </EmptyState.Content>
          </EmptyState>
        </Card>
      ) : (
        <>
          <KpiStrip items={kpis} label="Receivables summary" />

          <div className="flex flex-wrap items-start gap-4">
            <section aria-labelledby="acc-h" className="flex min-w-0 flex-[999_1_640px] flex-col gap-2.5">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h2 id="acc-h" className="text-[15px] leading-[22px] font-semibold">
                  Accounts on Credit
                </h2>
                <span className="text-xs text-muted tabular">Owned by Amahoro Hospitality Ltd · TIN 102 345 678</span>
              </div>
              <Tabs variant="secondary" selectedKey={kind} onSelectionChange={(k) => setKind(String(k) as KindId)}>
                <Tabs.ListContainer>
                  <Tabs.List aria-label="Account type" className={LINE_LIST}>
                    {KINDS.map((t) => (
                      <Tabs.Tab key={t.id} id={t.id} className={LINE_TAB}>
                        {t.label}
                        <Chip size="sm">{data.accounts.filter((a) => t.id === "all" || a.kind === t.id).length}</Chip>
                        <Tabs.Indicator />
                      </Tabs.Tab>
                    ))}
                  </Tabs.List>
                </Tabs.ListContainer>
                {KINDS.map((t) => (
                  <Tabs.Panel key={t.id} id={t.id} className={LINE_PANEL}>
                    {cur ? (
                      <AccountsTable
                        accounts={list}
                        selectedId={cur.id}
                        onSelect={(id) => {
                          setSel(id);
                          setPromiseOpen(false);
                        }}
                        label={`${t.label} on credit`}
                      />
                    ) : null}
                  </Tabs.Panel>
                ))}
              </Tabs>
            </section>

            <AgingWidget aging={data.aging} />
          </div>

          {cur ? (
            <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(340px,100%),1fr))]">
              <ArAccountCard account={cur} />
              <ArInvoicesCard account={cur} />
              <ArCollectionsCard
                account={cur}
                collections={collections}
                isHeld={Boolean(held[cur.id])}
                promiseOpen={promiseOpen}
                dispute={disputes[cur.id] ?? "open"}
                onRemind={() => setReminded((o) => ({ ...o, [cur.id]: true }))}
                onTogglePromise={() => setPromiseOpen((v) => !v)}
                onSavePromise={(amount, date) => {
                  setPromised((o) => ({ ...o, [cur.id]: `RWF ${amount} by ${date}` }));
                  setPromiseOpen(false);
                }}
                onProposeHold={() => setHeld((o) => ({ ...o, [cur.id]: true }))}
                onDispute={(state) => setDisputes((o) => ({ ...o, [cur.id]: state }))}
              />
            </div>
          ) : null}

          <section aria-labelledby="bt-h" className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 id="bt-h" className="text-[15px] leading-[22px] font-semibold">
                Bank Transfers to Allocate
              </h2>
              <span className="text-xs text-muted tabular">
                Source: GT Bank statement files · latest GTB-STMT-20261011, imported 12 Oct 06:02, checksum matched
              </span>
            </div>
            <Table>
              <Table.ScrollContainer>
                <Table.Content className="min-w-[900px]" aria-label="Bank transfers to allocate">
                  <Table.Header>
                    <Table.Column isRowHeader>Statement line</Table.Column>
                    <Table.Column>Reference and sender</Table.Column>
                    <Table.Column className="text-right">Amount</Table.Column>
                    <Table.Column>Allocation</Table.Column>
                    <Table.Column>Detail</Table.Column>
                    <Table.Column>
                      <span className="sr-only">Action</span>
                    </Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {transfers.map((b) => {
                      const st = TRANSFER_STATE[b.status];
                      return (
                        <Table.Row key={b.id} id={b.id}>
                          <Table.Cell>
                            <Stack
                              primary={b.line}
                              primaryClassName="font-medium tabular"
                              secondary={b.at}
                              secondaryClassName="tabular"
                            />
                          </Table.Cell>
                          <Table.Cell>
                            <Stack primary={`“${b.reference}”`} primaryClassName="tabular" secondary={b.sender} />
                          </Table.Cell>
                          <Table.Cell className="text-right tabular">{rwf(b.amount)}</Table.Cell>
                          <Table.Cell>
                            <Chip size="sm" variant="soft" color={toneColor(st.tone)}>
                              {st.label}
                            </Chip>
                          </Table.Cell>
                          <Table.Cell className="max-w-[360px] text-xs whitespace-normal text-muted">
                            {b.note}
                          </Table.Cell>
                          <Table.Cell className="text-right">
                            {b.status === "unmatched" && b.toReconciliation ? (
                              <LinkButton href={screenHref("Reconciliation")} size="sm" variant="ghost">
                                Allocate in reconciliation
                              </LinkButton>
                            ) : null}
                            {b.status === "unmatched" && !b.toReconciliation ? (
                              <Button size="sm" aria-label={`Match ${b.line}`} onPress={() => setAllocFor(b.id)}>
                                Match
                              </Button>
                            ) : null}
                            {b.status === "pending" ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                isDisabled
                                aria-label={`Approve ${b.line}: you made this match, so another person approves it`}
                              >
                                Approve
                              </Button>
                            ) : null}
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
            <Note>
              Unmatched means seen on the statement but not linked to an invoice. Pending means matched and waiting for
              a second approver. Only Verified allocations reduce a balance.
            </Note>
          </section>
        </>
      )}

      {allocTransfer?.allocation ? (
        <ArAllocationDialog
          transfer={allocTransfer}
          allocation={allocTransfer.allocation}
          isOpen={isAhl && Boolean(allocTransfer)}
          onClose={() => setAllocFor(null)}
          onPropose={() => {
            setMatched((o) => ({ ...o, [allocTransfer.id]: true }));
            setAllocFor(null);
          }}
        />
      ) : null}
    </PageContent>
  );
}
