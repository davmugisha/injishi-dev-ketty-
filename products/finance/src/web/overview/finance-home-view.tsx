"use client";

import {
  ArrowsRotateRight,
  CircleCheck,
  CircleCheckFill,
  CircleXmark,
  Lock,
  Magnifier,
  ScalesBalanced,
  TriangleExclamation,
} from "@gravity-ui/icons";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Chip,
  Kbd,
  Label,
  ListBox,
  Modal,
  Select,
  Separator,
  Table,
  Tabs,
  TextArea,
  TextField,
} from "@heroui/react";
import { EmptyState, KPIGroup, ListView, Segment } from "@heroui-pro/react";
import { KPI } from "@heroui-pro/react/kpi";
import { Icon, KeyValueList, LinkButton, PageContent, PageHeader, StatusDot } from "@injishi/ui";
import NextLink from "next/link";
import { Fragment, type Key, useEffect, useState } from "react";
import type {
  Check,
  ExceptionCategory,
  ExceptionGroup,
  FinanceEvent,
  FinanceException,
  FinanceKpi,
  ResolvedException,
} from "../../model/finance.ts";
import type { Tone } from "../../model/shared.ts";
import { useBoardHref } from "../mount.tsx";
import {
  CheckList,
  EventTimeline,
  groupCell,
  lineTab,
  money,
  SubHeading,
  selectableRow,
  TabCount,
  ToneChip,
} from "../parts.tsx";

export type QueryOutcome = "successful" | "failed" | "no-answer";
type Outcome = "verified" | "failed" | "investigating";

interface FinanceHomeData {
  groups: ExceptionGroup[];
  exceptions: FinanceException[];
  kpis: FinanceKpi[];
  resolved: ResolvedException[];
}

const SEVERITY: Record<FinanceException["severity"], { label: string; tone: Tone; dot: Tone }> = {
  high: { label: "High", tone: "danger", dot: "danger" },
  medium: { label: "Medium", tone: "warning", dot: "warning" },
  low: { label: "Low", tone: "default", dot: "info" },
};

const SCOPES = [
  { id: "all", label: "Both" },
  { id: "isangano", label: "Isangano" },
  { id: "ishyamba", label: "Ishyamba" },
];

const TABS: { id: "all" | ExceptionCategory; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pay", label: "Payments" },
  { id: "fiscal", label: "Fiscal" },
  { id: "folio", label: "Folios & deposits" },
  { id: "cash", label: "Cash" },
];

const RECORD_STATE: Partial<Record<FinanceException["type"], { label: string; tone: Tone }>> = {
  folio: { label: "Checked out · balance due", tone: "danger" },
  bank: { label: "Unmatched", tone: "warning" },
  deposit: { label: "Held as liability", tone: "info" },
  refund: { label: "Approved · not executed", tone: "warning" },
  shift: { label: "Awaiting Finance review", tone: "warning" },
};

const INVESTIGATION_REASONS = [
  { id: "mismatch", label: "Provider status does not match customer claim" },
  { id: "no-answer", label: "Provider does not answer status queries" },
  { id: "duplicate", label: "Possible duplicate debit" },
];

function firstKey(keys: "all" | Set<Key>): string | null {
  if (keys === "all") return null;
  const [k] = [...keys];
  return k === undefined ? null : String(k);
}

export function FinanceHomeView({ data, queryOutcome }: { data: FinanceHomeData; queryOutcome: QueryOutcome }) {
  const screenHref = useBoardHref();
  const [scope, setScope] = useState("all");
  const [tab, setTab] = useState<string>("all");
  const [sel, setSel] = useState("ex1");
  const [queried, setQueried] = useState<Record<string, boolean>>({});
  const [outcome, setOutcome] = useState<Record<string, Outcome>>({});
  const [fiscalRetry, setFiscalRetry] = useState<Record<string, boolean>>({});
  const [invOpen, setInvOpen] = useState(false);

  const groupOf = (x: FinanceException) => data.groups.find((g) => g.id === x.type) ?? data.groups[0];
  const live = data.exceptions.filter((x) => outcome[x.id] !== "verified" && outcome[x.id] !== "failed");
  const inScope = live.filter(
    (x) => scope === "all" || (scope === "isangano" ? x.property !== "Ishyamba" : x.property === "Ishyamba"),
  );
  const tabs = TABS.map((t) => ({
    ...t,
    count: inScope.filter((x) => t.id === "all" || groupOf(x).category === t.id).length,
  }));
  const shown = inScope.filter((x) => tab === "all" || groupOf(x).category === tab);
  const grouped = data.groups
    .map((g) => ({ group: g, items: shown.filter((x) => x.type === g.id) }))
    .filter((g) => g.items.length > 0);
  const ordered = grouped.flatMap((g) => g.items);

  // J / K move through the queue, as the queue header advertises.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (invOpen || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable='true']")) return;
      const k = e.key.toLowerCase();
      if (k !== "j" && k !== "k") return;
      if (!ordered.length) return;
      const at = ordered.findIndex((x) => x.id === sel);
      const next = k === "j" ? Math.min(ordered.length - 1, at + 1) : Math.max(0, at < 0 ? 0 : at - 1);
      setSel(ordered[next].id);
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ordered, sel, invOpen]);

  const x = data.exceptions.find((e) => e.id === sel) ?? data.exceptions[0];
  const g = groupOf(x);
  const isUnknown = x.type === "unknown";
  const q = !!queried[x.id];
  const res = outcome[x.id] ?? null;

  let checks: Check[] = x.checks;
  const events: FinanceEvent[] = [...x.events];
  let state: { label: string; tone: Tone } = RECORD_STATE[x.type] ?? { label: "Open", tone: "warning" };
  let pollText = "";
  if (isUnknown) {
    let provider: Check = {
      tone: "warning",
      label: "Provider status query",
      detail: "PENDING at provider · last asked 10:02",
    };
    let poll: Check = { tone: "idle", label: "Polling", detail: x.pollNote ?? "" };
    let alloc: Check = {
      tone: "idle",
      label: "Folio allocation",
      detail: `Not allocated · ${x.folio} balance unchanged`,
    };
    if (q && queryOutcome === "successful") {
      provider = { tone: "success", label: "Provider status query", detail: `SUCCESSFUL · ${x.providerRef} · 10:06` };
      poll = { tone: "success", label: "Polling", detail: "Stopped · provider returned a final status" };
      alloc = { tone: "warning", label: "Folio allocation", detail: `Ready to allocate to ${x.folio}` };
    }
    if (q && queryOutcome === "failed") {
      provider = {
        tone: "danger",
        label: "Provider status query",
        detail: "FAILED · customer did not approve the prompt · 10:06",
      };
      poll = { tone: "success", label: "Polling", detail: "Stopped · provider returned a final status" };
    }
    if (q && queryOutcome === "no-answer") {
      provider = {
        tone: "danger",
        label: "Provider status query",
        detail: "No response from GT Bank in 20 s · 10:06 · still Unknown",
      };
    }
    checks = [
      provider,
      {
        tone: "danger",
        label: "Webhook from GT Bank",
        detail: "Not received · a late callback will be deduplicated by event ID",
      },
      poll,
      {
        tone: "idle",
        label: "Guest’s SMS",
        detail: "Shown at the desk · noted, not accepted as proof on its own",
      },
      alloc,
    ];
    if (q)
      events.push({
        title: "Manual provider query by Grace Uwera",
        meta: `10:06 · result: ${queryOutcome === "successful" ? "SUCCESSFUL" : queryOutcome === "failed" ? "FAILED" : "no response"}`,
        status: queryOutcome === "successful" ? "success" : queryOutcome === "failed" ? "danger" : "warning",
      });
    if (res === "verified")
      events.push({
        title: `Verified and allocated to ${x.folio}`,
        meta: "10:07 · Grace Uwera · ledger LE-90412 posted once",
        status: "success",
      });
    if (res === "failed")
      events.push({ title: "Marked failed", meta: "10:07 · front desk notified", status: "danger" });
    if (res === "investigating")
      events.push({
        title: "Investigation PX-2207 opened",
        meta: "10:08 · Grace Uwera · GT Bank support asked",
        status: "current",
      });
    state =
      res === "verified"
        ? { label: "Verified", tone: "success" }
        : res === "failed"
          ? { label: "Failed", tone: "danger" }
          : { label: "Unknown — checking with provider", tone: "warning" };
    pollText = q ? "Last query 10:06" : "Last poll 10:02";
  } else if (x.type === "fiscal") {
    const retried = !!fiscalRetry[x.id];
    checks = [
      { tone: "success", label: "Payments on the folio", detail: "All verified with provider references" },
      {
        tone: "warning",
        label: "VSDC response",
        detail: retried
          ? "Retry sent 10:08 · still Pending · no receipt number yet"
          : "Pending · no acknowledgement or receipt number yet",
      },
      { tone: "success", label: "Duplicate guard", detail: `Every retry reuses ${x.requestId}` },
    ];
    if (retried)
      events.push({
        title: "Manual retry by Grace Uwera",
        meta: "10:08 · same request ID · Pending",
        status: "current",
      });
    state = { label: "Pending at VSDC", tone: "warning" };
  }

  const providerOk = q && queryOutcome === "successful";
  const providerFail = q && queryOutcome === "failed";
  const unresolved = isUnknown && res !== "verified" && res !== "failed";

  const verifiedNow = data.exceptions.filter((e) => outcome[e.id] === "verified");
  const verifiedAmt = verifiedNow.reduce((s, e) => s + e.amount, 0);
  const unknownLive = live.filter((e) => e.type === "unknown");
  const kpiValue = (k: FinanceKpi) =>
    k.id === "verified"
      ? k.value + verifiedAmt
      : k.id === "unknown"
        ? unknownLive.reduce((s, e) => s + e.amount, 0)
        : k.value;
  const kpiFoot = (k: FinanceKpi) =>
    k.id === "verified"
      ? `${(k.count ?? 0) + verifiedNow.length} tenders · provider-confirmed only`
      : k.id === "unknown"
        ? `${unknownLive.length} timed out · checking with provider`
        : k.foot;

  const resolved = [
    ...verifiedNow.map((e) => ({
      id: e.ref ?? e.id,
      title: `${e.ref} · ${money(e.amount)} · ${e.title.split(" · ").pop()}`,
      evidence: `Provider status SUCCESSFUL · ${e.providerRef}`,
      when: "10:07",
    })),
    ...data.resolved,
  ];

  const openCount = live.length;
  const actionCount = live.filter((e) => e.severity !== "low").length;
  const invNote = `Guest shows a ${x.network === "Airtel" ? "Airtel" : "MTN"} SMS for ${money(x.amount)}. No GT Bank callback and the status query says PENDING. Asking GT Bank support for the final status.`;
  const sev = SEVERITY[x.severity];

  return (
    <PageContent className="text-sm">
      <PageHeader
        eyebrow="Monday 12 October 2026 · 10:05 · Business date 12 Oct"
        title="Reconciliation Exceptions"
        description={`${openCount} open, ${actionCount} need action today. Nothing here is marked paid or matched without the provider’s or bank’s evidence.`}
        actions={
          <>
            <Segment aria-label="Property" selectedKey={scope} onSelectionChange={(k) => setScope(String(k))}>
              {SCOPES.map((s) => (
                <Segment.Item key={s.id} id={s.id}>
                  {s.label}
                </Segment.Item>
              ))}
            </Segment>
            <LinkButton href={screenHref("Reconciliation")} variant="secondary">
              <ScalesBalanced className="size-4" />
              Bank statement · 11 Oct
            </LinkButton>
          </>
        }
      />

      <Alert status="warning" role="status">
        <Alert.Indicator>
          <TriangleExclamation />
        </Alert.Indicator>
        <Alert.Content>
          <Alert.Title>Airtel Money callbacks delayed since 05:40</Alert.Title>
          <Alert.Description>
            GT Bank is accepting Airtel requests but webhooks arrive late. Injishi polls every 2 minutes; affected
            payments stay Unknown until the provider answers.
          </Alert.Description>
        </Alert.Content>
        <LinkButton href={screenHref("Integrations")} size="sm" variant="ghost" className="self-start">
          Integration status
        </LinkButton>
      </Alert>

      <section aria-label="Today’s reconciliation figures">
        <KPIGroup className="flex-wrap">
          {data.kpis.map((kpi, i) => (
            <Fragment key={kpi.id}>
              {i > 0 ? <KPIGroup.Separator /> : null}
              <KPI className="relative min-w-[min(190px,100%)] flex-[1_1_190px]">
                <KPI.Header>
                  <KPI.Icon status={kpi.status}>
                    <Icon name={kpi.icon} />
                  </KPI.Icon>
                  <KPI.Title>
                    <NextLink
                      href={screenHref(kpi.board)}
                      className="text-inherit no-underline after:absolute after:inset-0"
                    >
                      {kpi.label}
                    </NextLink>
                  </KPI.Title>
                </KPI.Header>
                <KPI.Content className="flex-none">
                  <KPI.Value
                    value={kpiValue(kpi)}
                    formatOptions={{ style: "currency", currency: "RWF", maximumFractionDigits: 0 }}
                    className="tabular"
                  />
                </KPI.Content>
                <KPI.Footer className="mt-1.5">
                  <p className="text-xs leading-4 text-muted tabular">{kpiFoot(kpi)}</p>
                </KPI.Footer>
              </KPI>
            </Fragment>
          ))}
        </KPIGroup>
      </section>

      <div className="flex flex-wrap items-start gap-4">
        <section className="flex min-w-0 flex-[999_1_560px] flex-col gap-2.5" aria-labelledby="q-h">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="q-h" className="text-[15px] leading-[22px] font-semibold">
              Exception Queue
            </h2>
            <span className="flex items-center gap-1 text-xs text-muted">
              Oldest first within each type · <Kbd>J</Kbd> <Kbd>K</Kbd> to move
            </span>
          </div>
          <Tabs variant="secondary" selectedKey={tab} onSelectionChange={(k) => setTab(String(k))}>
            <Tabs.ListContainer>
              <Tabs.List aria-label="Exception type">
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
              <Tabs.Panel key={t.id} id={t.id} className="flex flex-col gap-2.5 pt-2.5">
                <Table>
                  <Table.ScrollContainer>
                    <Table.Content
                      aria-label="Exception queue"
                      selectionMode="single"
                      selectionBehavior="replace"
                      disallowEmptySelection
                      disabledBehavior="selection"
                      disabledKeys={grouped.map((gr) => `head-${gr.group.id}`)}
                      selectedKeys={new Set([sel])}
                      onSelectionChange={(keys) => {
                        const k = firstKey(keys as "all" | Set<Key>);
                        if (k && !k.startsWith("head-")) setSel(k);
                      }}
                    >
                      <Table.Header>
                        <Table.Column isRowHeader>Exception</Table.Column>
                        <Table.Column>Severity</Table.Column>
                        <Table.Column className="text-right">Amount</Table.Column>
                        <Table.Column>Age</Table.Column>
                      </Table.Header>
                      <Table.Body>
                        {grouped.flatMap(({ group, items }) => [
                          <Table.Row key={`head-${group.id}`} id={`head-${group.id}`} className="cursor-default">
                            <Table.Cell colSpan={4} className={groupCell}>
                              <span className="flex items-center gap-2">
                                <Icon name={group.icon} className="size-4 text-muted" />
                                <span className="text-[13px] font-semibold">{group.label}</span>
                                <Chip size="sm" variant="soft">
                                  {items.length}
                                </Chip>
                              </span>
                            </Table.Cell>
                          </Table.Row>,
                          ...items.map((r) => (
                            <Table.Row key={r.id} id={r.id} className={selectableRow}>
                              <Table.Cell className="py-2">
                                <span className="flex items-start gap-2.5">
                                  <StatusDot tone={SEVERITY[r.severity].dot} className="mt-[7px]" />
                                  <span className="flex min-w-0 flex-col gap-0.5">
                                    <span className="font-medium">{r.title}</span>
                                    <span className="text-xs leading-4 text-muted">{r.sub}</span>
                                  </span>
                                </span>
                              </Table.Cell>
                              <Table.Cell>
                                <ToneChip tone={SEVERITY[r.severity].tone}>{SEVERITY[r.severity].label}</ToneChip>
                              </Table.Cell>
                              <Table.Cell className="text-right font-medium whitespace-nowrap tabular">
                                {money(r.amount)}
                              </Table.Cell>
                              <Table.Cell className="text-[13px] whitespace-nowrap text-muted tabular">
                                {r.age}
                              </Table.Cell>
                            </Table.Row>
                          )),
                        ])}
                      </Table.Body>
                    </Table.Content>
                  </Table.ScrollContainer>
                </Table>
                {shown.length === 0 ? (
                  <Card variant="secondary">
                    <EmptyState size="sm">
                      <EmptyState.Header>
                        <EmptyState.Media variant="icon">
                          <CircleCheck />
                        </EmptyState.Media>
                        <EmptyState.Title>Nothing open of this type</EmptyState.Title>
                        <EmptyState.Description>
                          New exceptions appear here as soon as a record and its evidence disagree.
                        </EmptyState.Description>
                      </EmptyState.Header>
                    </EmptyState>
                  </Card>
                ) : null}
              </Tabs.Panel>
            ))}
          </Tabs>
        </section>

        <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-4">
          <Card className="gap-[14px] p-[18px]" aria-labelledby="insp-h" render={(p) => <section {...p} />}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-xs text-muted">
                  {g.label} · {x.property}
                </span>
                <h2 id="insp-h" className="text-[15px] leading-[22px] font-semibold">
                  {x.title}
                </h2>
                <span className="text-[13px] leading-[18px] text-muted">{x.sub}</span>
              </div>
              <ToneChip tone={sev.tone} className="shrink-0">
                {sev.label}
              </ToneChip>
            </div>
            <div className="flex flex-wrap items-start gap-5">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted">Amount</span>
                <span className="text-[22px] leading-7 font-semibold tabular">{money(x.amount)}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted">Record state</span>
                <ToneChip tone={state.tone} size="md" className="self-start">
                  {state.label}
                </ToneChip>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted">Open for</span>
                <span className="font-medium tabular">{x.age}</span>
              </div>
            </div>
            <KeyValueList items={x.facts.map((f) => ({ label: f.k, value: <span className="tabular">{f.v}</span> }))} />
            <Separator />
            <div className="flex flex-col gap-2">
              <SubHeading>Evidence</SubHeading>
              <CheckList items={checks} />
            </div>

            {isUnknown && res === "verified" ? (
              <Alert status="success" role="status">
                <Alert.Indicator>
                  <CircleCheck />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>Verified on provider evidence</Alert.Title>
                  <Alert.Description>
                    {x.ref} · {x.providerRef} · allocated to {x.folio} at 10:07 by Grace Uwera. One ledger posting; a
                    late webhook will be ignored as a duplicate.
                  </Alert.Description>
                </Alert.Content>
              </Alert>
            ) : null}
            {isUnknown && res === "investigating" ? (
              <Alert status="accent" role="status">
                <Alert.Indicator>
                  <Magnifier />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>Investigation PX-2207 open · assigned to you</Alert.Title>
                  <Alert.Description>
                    The payment stays Unknown and the folio balance stays open. Polling continues and any late callback
                    is deduplicated.
                  </Alert.Description>
                </Alert.Content>
              </Alert>
            ) : null}
            {isUnknown && res === "failed" ? (
              <Alert status="danger" role="status">
                <Alert.Indicator>
                  <CircleXmark />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>Marked failed on provider evidence</Alert.Title>
                  <Alert.Description>
                    Front desk is asked to collect again. Nothing was allocated to the folio.
                  </Alert.Description>
                </Alert.Content>
              </Alert>
            ) : null}

            {unresolved ? (
              <Card variant="secondary" className="gap-2.5 p-[14px]">
                <div className="flex items-center justify-between gap-2">
                  <SubHeading>Resolve here</SubHeading>
                  <span className="text-xs text-muted tabular">{pollText}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onPress={() => setQueried((m) => ({ ...m, [x.id]: true }))}>
                    <ArrowsRotateRight className="size-4" />
                    Query provider now
                  </Button>
                  <Button size="sm" variant="ghost" onPress={() => setInvOpen(true)}>
                    <Magnifier className="size-4" />
                    Open investigation
                  </Button>
                </div>
                {providerOk ? (
                  <Button className="self-start" onPress={() => setOutcome((m) => ({ ...m, [x.id]: "verified" }))}>
                    <CircleCheck className="size-4" />
                    Mark verified and allocate to {x.folio}
                  </Button>
                ) : null}
                {providerFail ? (
                  <Button
                    variant="danger-soft"
                    className="self-start"
                    onPress={() => setOutcome((m) => ({ ...m, [x.id]: "failed" }))}
                  >
                    <CircleXmark className="size-4" />
                    Mark failed and tell front desk
                  </Button>
                ) : null}
                {!providerOk ? (
                  <div className="flex flex-col gap-1.5">
                    <Button isDisabled aria-describedby="why-locked" className="self-start">
                      <Lock className="size-4" />
                      Mark verified
                    </Button>
                    <span id="why-locked" className="text-xs leading-4 text-muted">
                      Unlocks only when GT Bank returns a final provider status. A guest’s SMS or screenshot is not
                      evidence on its own.
                    </span>
                  </div>
                ) : null}
              </Card>
            ) : null}

            {!isUnknown ? (
              <Card variant="secondary" className="gap-2.5 p-[14px]">
                <SubHeading>Next step</SubHeading>
                <p className="text-xs leading-4 text-muted">{x.next}</p>
                <div className="flex flex-wrap gap-2">
                  {x.board ? (
                    <LinkButton href={screenHref(x.board)} size="sm">
                      {x.cta}
                    </LinkButton>
                  ) : null}
                  {x.hasRetry ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onPress={() => setFiscalRetry((m) => ({ ...m, [x.id]: true }))}
                    >
                      <ArrowsRotateRight className="size-4" />
                      Retry with same request ID
                    </Button>
                  ) : null}
                  {x.blocked ? (
                    <Button size="sm" variant="ghost" isDisabled aria-describedby="why-blocked">
                      {x.blocked}
                    </Button>
                  ) : null}
                </div>
                {x.blocked ? (
                  <span id="why-blocked" className="text-xs leading-4 text-muted">
                    {x.blockedWhy}
                  </span>
                ) : null}
              </Card>
            ) : null}

            <div className="flex flex-col gap-2">
              <SubHeading>History</SubHeading>
              <EventTimeline events={events} />
            </div>
          </Card>

          <Card variant="secondary" className="gap-2.5 p-4" aria-labelledby="done-h" render={(p) => <section {...p} />}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="done-h" className="text-[15px] leading-[22px] font-semibold">
                Resolved Today
              </h2>
              <span className="text-xs text-muted">With the evidence that closed each</span>
            </div>
            <ListView aria-label="Resolved today" variant="secondary" items={resolved}>
              {(d) => (
                <ListView.Item id={d.id} textValue={d.title}>
                  <ListView.ItemContent>
                    <CircleCheckFill className="size-4 shrink-0 text-success" aria-hidden="true" />
                    <div className="flex min-w-0 flex-col">
                      <ListView.Title>{d.title}</ListView.Title>
                      <ListView.Description className="tabular">{d.evidence}</ListView.Description>
                    </div>
                  </ListView.ItemContent>
                  <ListView.ItemAction>
                    <span className="text-xs text-muted tabular">{d.when}</span>
                  </ListView.ItemAction>
                </ListView.Item>
              )}
            </ListView>
          </Card>
        </div>
      </div>

      <Modal.Backdrop isOpen={invOpen} onOpenChange={setInvOpen}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-[520px]">
            <Modal.Header className="flex-col items-start gap-1">
              <Modal.Heading>Open Investigation for {x.ref}</Modal.Heading>
              <p className="text-[13px] leading-[18px] text-muted">
                The payment stays Unknown. Investigations are logged with your name and reason.
              </p>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4">
              <Select fullWidth defaultValue="mismatch">
                <Label>Reason</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {INVESTIGATION_REASONS.map((r) => (
                      <ListBox.Item key={r.id} id={r.id} textValue={r.label}>
                        {r.label}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
              <TextField fullWidth defaultValue={invNote}>
                <Label>Note for the case</Label>
                <TextArea rows={3} />
              </TextField>
              <Checkbox defaultSelected>
                <Checkbox.Content>
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  Send a status request to GT Bank support with the idempotency key
                </Checkbox.Content>
              </Checkbox>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" slot="close">
                Cancel
              </Button>
              <Button
                onPress={() => {
                  setOutcome((m) => ({ ...m, [x.id]: "investigating" }));
                  setInvOpen(false);
                }}
              >
                Open investigation
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </PageContent>
  );
}
