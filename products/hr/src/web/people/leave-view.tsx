"use client";

import { Calendar, CalendarXmark, Check, CircleCheck, Persons, ShieldExclamation, Suitcase } from "@gravity-ui/icons";
import { Card, Chip, Table, Tabs, Toast, toast } from "@heroui/react";
import { EmptyState, KPIGroup, Segment, Widget } from "@heroui-pro/react";
import { KPI } from "@heroui-pro/react/kpi";
import {
  formatNumber,
  GateChip,
  LinkButton,
  PageContent,
  PageHeader,
  StatusDot,
  type Tone,
  toneColor,
} from "@injishi/ui";
import { useMemo, useOptimistic, useState, useTransition } from "react";
import type {
  ExtraDaysAsk,
  LeaveBalance,
  LeaveCalendarEntry,
  LeaveMonth,
  LeaveRequest,
  LeaveStep,
  LeaveStretch,
  LeaveType,
} from "../../model/people.ts";
import type { Persona } from "../../model/shared.ts";
import { useBoardHref, useHrActions } from "../mount.tsx";
import { LeaveByMonth } from "./leave-by-month";
import { type CalendarBar, LEAVE_KINDS, LeaveCalendar, leaveColor } from "./leave-calendar";
import { LeaveDecisionDrawer } from "./leave-decision-drawer";
import { LeaveExtraDays } from "./leave-extra-days";
import { Hint, Pager, Person, pageOf, Ring, TAB_CLASS } from "./parts";

export interface LeaveData {
  requests: LeaveRequest[];
  balances: LeaveBalance[];
  types: LeaveType[];
  calendar: LeaveCalendarEntry[];
  byMonth: LeaveMonth[];
  stretches: LeaveStretch[];
  /** Days people asked for on top of what a kind of leave gives. */
  extraDays: ExtraDaysAsk[];
}

type Group = "mine" | "lm" | "done";

const TABS: { id: Group; label: string }[] = [
  { id: "mine", label: "With you" },
  { id: "lm", label: "With managers" },
  { id: "done", label: "Decided" },
];

/** Approval-step chip and the two progress dots (line manager, then HR). */
const STEP: Record<LeaveStep, { label: string; tone: Tone; dots: [Tone | null, Tone | null] }> = {
  hr: { label: "With you", tone: "accent", dots: ["success", "accent"] },
  lm: { label: "With manager", tone: "default", dots: ["accent", null] },
  approved: { label: "Approved", tone: "success", dots: ["success", "success"] },
  declined: { label: "Declined", tone: "danger", dots: ["success", "danger"] },
  lmdeclined: { label: "Manager declined", tone: "danger", dots: ["danger", null] },
};

const KPI_CLASS = "min-w-[min(140px,100%)] flex-[1_1_140px]";

type Decision = { id: string; decision: "approved" | "declined" | "cancelled"; reason: string | null };

const stepOf = (r: LeaveRequest): LeaveStep => r.hrDecision ?? r.step;
const groupOf = (step: LeaveStep): Group => (step === "hr" ? "mine" : step === "lm" ? "lm" : "done");

export function LeaveView({
  persona,
  data,
  initial,
  today,
}: {
  persona: Persona;
  data: LeaveData;
  /** `open`: the address named a request (`?request=`), so it opens at once. */
  initial: { request: string; tab: Group; show: "bal" | "rules"; open?: boolean };
  /** Today in Kigali ("2026-10-15"): the calendar's first day. */
  today: string;
}) {
  const { cancelLeave, decideLeave } = useHrActions();
  const screenHref = useBoardHref();
  const [tab, setTab] = useState<Group>(() => {
    const named = initial.open ? data.requests.find((r) => r.id === initial.request) : undefined;
    return named ? groupOf(stepOf(named)) : initial.tab;
  });
  const [sel, setSel] = useState(initial.request);
  const [drawerOpen, setDrawerOpen] = useState(Boolean(initial.open));
  const [page, setPage] = useState(1);
  const [balancePage, setBalancePage] = useState(1);
  const [lower, setLower] = useState<"bal" | "rules">(initial.show);
  const [pending, startTransition] = useTransition();
  // The queue, and approved leave too old for it that is not over yet: it can still be opened and cancelled.
  const queue = useMemo(() => {
    const listed = new Set(data.requests.map((r) => r.id));
    return [...data.requests, ...data.stretches.flatMap((s) => (s.request && !listed.has(s.id) ? [s.request] : []))];
  }, [data.requests, data.stretches]);
  const [requests, decideOptimistic] = useOptimistic(queue, (state, d: Decision) => {
    if (d.decision === "cancelled") return state.filter((r) => r.id !== d.id);
    const decision = d.decision;
    return state.map((r) => {
      if (r.id !== d.id) return r;
      // Approving the first step moves it on to the next; only the last step settles it.
      if (r.step === "lm" && decision === "approved") return { ...r, step: "hr" as const };
      return { ...r, hrDecision: decision, hrReason: d.reason };
    });
  });

  const year = Number(today.slice(0, 4));
  const rows = requests.filter((r) => groupOf(stepOf(r)) === tab);
  const count = (g: Group) => requests.filter((r) => groupOf(stepOf(r)) === g).length;
  const cur = requests.find((r) => r.id === sel) ?? null;

  const pick = (id: string) => {
    setSel(id);
    setDrawerOpen(true);
  };
  const decide = (decision: "approved" | "declined", reason: string | null) => {
    if (!cur) return;
    const { id } = cur;
    setDrawerOpen(false);
    startTransition(async () => {
      decideOptimistic({ id, decision, reason });
      const result = await decideLeave(id, decision, reason ?? undefined);
      if (!result.ok) toast.danger(result.error);
      else toast.success(decision === "approved" ? "Approved" : "Declined");
    });
  };
  const cancel = (reason: string) => {
    if (!cur) return;
    const { id } = cur;
    setDrawerOpen(false);
    startTransition(async () => {
      decideOptimistic({ id, decision: "cancelled", reason });
      const result = await cancelLeave(id, reason);
      if (!result.ok) toast.danger(result.error);
      else toast.success("Leave cancelled. The days are back on the balance.");
    });
  };

  // Calendar bars: requests with dates in range (not declined) plus approved leave outside this list.
  const calBars: CalendarBar[] = [
    ...requests
      .filter((r) => r.cal && stepOf(r) !== "declined" && stepOf(r) !== "lmdeclined")
      .map((r) => ({
        id: r.id,
        name: r.name,
        type: r.type,
        approved: stepOf(r) === "approved",
        cal: r.cal as [number, number],
        isRequest: true,
      })),
    ...data.calendar
      .filter((c) => !requests.some((r) => r.id === c.id))
      .map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        approved: true,
        cal: c.cal,
        isRequest: false,
      })),
  ];
  const awayOn = (i: number) =>
    new Set(calBars.filter((b) => b.approved && i >= b.cal[0] && i < b.cal[0] + b.cal[1]).map((b) => b.name));
  const awayToday = awayOn(0).size;
  const awayWeek = new Set(Array.from({ length: 7 }, (_, i) => [...awayOn(i)]).flat()).size;
  /** A bar or a row opens its request, on the tab it belongs to. */
  const open = (id: string) => {
    const r = requests.find((x) => x.id === id);
    if (!r) return;
    setTab(groupOf(stepOf(r)));
    setPage(1);
    pick(id);
  };
  const switchTab = (g: Group) => {
    setTab(g);
    setPage(1);
  };
  // Requests further out than the calendar's days that still wait on somebody.
  const later = requests
    .filter((r) => !r.cal && (stepOf(r) === "lm" || stepOf(r) === "hr") && !r.roster.startsWith("Past dates"))
    .map((r) => ({ id: r.id, name: r.name, type: r.type, dates: r.dates, days: r.days }));

  // Balances move pending days into taken when HR approves; a decline releases them.
  const balances = data.balances.map((b) => {
    const req = requests.find((r) => r.id === b.request);
    const approved = req?.hrDecision === "approved";
    const declined = req?.hrDecision === "declined";
    const taken = approved ? b.taken + b.pending : b.taken;
    // "Left" is the API's balance, which has expired days taken off; adding up the year here would not.
    const left = b.left ?? b.carried + b.accrued - b.taken;
    return {
      ...b,
      taken,
      pending: approved || declined ? 0 : b.pending,
      available: approved ? left - b.pending : left,
    };
  });

  const requestsTable = (
    <Table>
      <Table.ScrollContainer>
        <Table.Content
          aria-label={`Leave requests: ${TABS.find((t) => t.id === tab)?.label ?? ""}`}
          className="min-w-[560px]"
          onRowAction={(key) => pick(String(key))}
        >
          <Table.Header>
            <Table.Column isRowHeader>Employee</Table.Column>
            <Table.Column>Leave</Table.Column>
            <Table.Column className="text-right">Days</Table.Column>
            <Table.Column>Step</Table.Column>
          </Table.Header>
          <Table.Body
            renderEmptyState={() => (
              <EmptyState size="sm">
                <EmptyState.Header>
                  <EmptyState.Media variant="icon">
                    <CircleCheck />
                  </EmptyState.Media>
                  <EmptyState.Title>Nothing here</EmptyState.Title>
                </EmptyState.Header>
              </EmptyState>
            )}
          >
            {pageOf(rows, page).map((r) => {
              const step = stepOf(r);
              const s = STEP[step];
              return (
                <Table.Row
                  key={r.id}
                  id={r.id}
                  className={`cursor-pointer ${drawerOpen && r.id === sel ? "bg-accent-soft" : ""}`}
                >
                  <Table.Cell>
                    <Person name={r.name} sub={r.dept} />
                  </Table.Cell>
                  <Table.Cell>
                    <span className="flex items-start gap-2">
                      <span
                        aria-hidden="true"
                        className="mt-1.5 size-2 shrink-0 rounded-full"
                        style={{ background: leaveColor(r.type) }}
                      />
                      <span className="flex flex-col">
                        <span>{r.type.split(" ·")[0]}</span>
                        <span className="text-xs text-muted">{r.dates}</span>
                      </span>
                    </span>
                  </Table.Cell>
                  <Table.Cell className="text-right tabular">{r.days}</Table.Cell>
                  <Table.Cell>
                    <span className="flex items-center gap-1.5">
                      <StatusDot tone={s.dots[0]} />
                      <StatusDot tone={s.dots[1]} />
                      <Chip size="sm" variant="soft" color={toneColor(s.tone)} className="whitespace-nowrap">
                        {r.blockedWhy && (step === "hr" || step === "lm") ? "Someone else decides" : s.label}
                      </Chip>
                    </span>
                  </Table.Cell>
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );

  return (
    <PageContent>
      <PageHeader
        eyebrow={`${year} leave year`}
        title="Leave"
        actions={
          <LinkButton href={screenHref("Roster")} variant="secondary">
            <Calendar className="size-4" />
            Roster
          </LinkButton>
        }
      />

      <section aria-label="Leave at a glance">
        <KPIGroup className="flex-wrap">
          <KPI className={KPI_CLASS}>
            <KPI.Header>
              <KPI.Icon status={count("mine") ? "warning" : "success"}>
                <Suitcase />
              </KPI.Icon>
              <KPI.Title>To decide</KPI.Title>
            </KPI.Header>
            <KPI.Content>
              <KPI.Value value={count("mine")} className="tabular" />
            </KPI.Content>
            <KPI.Footer>
              <p className="text-xs leading-4 text-muted">{count("lm")} with managers</p>
            </KPI.Footer>
          </KPI>
          <KPIGroup.Separator />
          <KPI className={KPI_CLASS}>
            <KPI.Header>
              <KPI.Icon status="success">
                <CalendarXmark />
              </KPI.Icon>
              <KPI.Title>Away today</KPI.Title>
            </KPI.Header>
            <KPI.Content>
              <KPI.Value value={awayToday} className="tabular" />
            </KPI.Content>
            <KPI.Footer>
              <p className="text-xs leading-4 text-muted">{awayWeek} this week</p>
            </KPI.Footer>
          </KPI>
          <KPIGroup.Separator />
          <KPI className={KPI_CLASS}>
            <KPI.Header>
              <KPI.Icon status="success">
                <Persons />
              </KPI.Icon>
              <KPI.Title>Decided</KPI.Title>
            </KPI.Header>
            <KPI.Content>
              <KPI.Value value={count("done")} className="tabular" />
            </KPI.Content>
            <KPI.Footer>
              <p className="text-xs leading-4 text-muted">
                {requests.filter((r) => stepOf(r) === "approved").length} approved
              </p>
            </KPI.Footer>
          </KPI>
        </KPIGroup>
      </section>

      <Tabs variant="secondary" selectedKey={tab} onSelectionChange={(k) => switchTab(String(k) as Group)}>
        <Tabs.ListContainer>
          <Tabs.List aria-label="Requests" className="justify-start gap-1">
            {TABS.map((t) => (
              <Tabs.Tab key={t.id} id={t.id} className={TAB_CLASS}>
                {t.label}
                <Chip size="sm" variant="soft">
                  {count(t.id)}
                </Chip>
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
        {TABS.map((t) => (
          <Tabs.Panel key={t.id} id={t.id} className="flex flex-col gap-3 pt-3">
            {requestsTable}
            <Pager page={page} total={rows.length} onPage={setPage} />
          </Tabs.Panel>
        ))}
      </Tabs>

      <LeaveDecisionDrawer
        request={cur}
        step={cur ? stepOf(cur) : "hr"}
        isOpen={drawerOpen}
        pending={pending}
        persona={persona}
        onOpenChange={setDrawerOpen}
        onDecide={decide}
        onCancel={cancel}
      />

      <LeaveExtraDays asks={data.extraDays} />

      <LeaveByMonth months={data.byMonth} />

      <Widget aria-labelledby="cal-h">
        <Widget.Header className="flex-wrap gap-2">
          <Widget.Title id="cal-h">Who is away</Widget.Title>
          <Widget.Legend className="flex-wrap">
            {LEAVE_KINDS.map((k) => (
              <Widget.LegendItem key={k.label} color={k.color}>
                {k.label}
              </Widget.LegendItem>
            ))}
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <span aria-hidden="true" className="h-3 w-5 rounded-[4px] border-[1.5px] border-dashed border-muted" />
              Pending
            </span>
          </Widget.Legend>
        </Widget.Header>
        <Widget.Content className="flex flex-col gap-2">
          <LeaveCalendar
            today={today}
            bars={calBars}
            later={later}
            leave={data.stretches}
            selected={drawerOpen ? sel : ""}
            onPick={open}
          />
        </Widget.Content>
      </Widget>

      <Card aria-labelledby="bt-h" className="gap-3 p-[18px]" render={(props) => <section {...(props as object)} />}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="bt-h" className="flex items-center gap-1 text-[15px] leading-[22px] font-semibold">
            Balances and rules
            <Hint label="About balances and rules">
              Annual leave, in days. Rule changes need the owner’s approval; statutory minimums also need payroll expert
              sign-off.
            </Hint>
          </h2>
          <Segment
            aria-label="Show"
            selectedKey={lower}
            onSelectionChange={(k) => setLower(k === "rules" ? "rules" : "bal")}
          >
            <Segment.Item id="bal">Balances</Segment.Item>
            <Segment.Item id="rules">Rules</Segment.Item>
          </Segment>
        </div>
        {lower === "bal" ? (
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(260px,100%),1fr))]">
            {pageOf(balances, balancePage).map((b) => {
              const total = b.carried + b.accrued;
              const pct = (n: number) => `${total > 0 ? Math.max(0, Math.min(100, (n / total) * 100)) : 0}%`;
              const low = b.available <= 3;
              return (
                <Card key={b.id} variant="secondary" className="gap-3 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Person
                      name={b.name}
                      sub={
                        <span className="flex items-center gap-1">
                          {formatNumber(total)} days this year
                          <Hint label="Where the days come from">
                            {formatNumber(b.carried)} carried from {year - 1} · {formatNumber(b.accrued)} accrued in{" "}
                            {year}
                          </Hint>
                        </span>
                      }
                    />
                    <Ring
                      value={Math.max(b.available, 0)}
                      max={total}
                      label={`${formatNumber(Math.floor(b.available))} of ${formatNumber(Math.round(total))} days left`}
                      color={low ? "warning" : "success"}
                      size="size-12"
                    >
                      <span className="text-[12px]">{formatNumber(Math.floor(b.available))}</span>
                    </Ring>
                  </div>
                  <div
                    role="img"
                    aria-label={`${formatNumber(b.taken)} taken, ${formatNumber(b.pending)} pending`}
                    className="flex h-2 overflow-hidden rounded-full bg-default"
                  >
                    <span className="h-full bg-accent" style={{ width: pct(b.taken) }} />
                    <span className="h-full bg-warning" style={{ width: pct(b.pending) }} />
                  </div>
                  <dl className="grid grid-cols-4 gap-1 text-center">
                    {[
                      { label: "Taken", value: b.taken, dot: "bg-accent" },
                      { label: "Pending", value: b.pending, dot: "bg-warning" },
                      { label: "Left", value: b.available, dot: "bg-default" },
                      { label: "Sick", value: b.sick, dot: "bg-[var(--chart-4)]" },
                    ].map((x) => (
                      <div key={x.label} className="flex flex-col items-center gap-0.5">
                        <dt className="flex items-center gap-1 text-xs font-medium text-muted">
                          <span aria-hidden="true" className={`size-1.5 rounded-full ${x.dot}`} />
                          {x.label}
                        </dt>
                        <dd className="text-[14px] font-semibold tabular">{formatNumber(x.value)}</dd>
                      </div>
                    ))}
                  </dl>
                </Card>
              );
            })}
          </div>
        ) : (
          <Table variant="secondary">
            <Table.ScrollContainer>
              <Table.Content aria-label="Leave types and rules">
                <Table.Header>
                  <Table.Column isRowHeader>Leave type</Table.Column>
                  <Table.Column>Paid</Table.Column>
                  <Table.Column>Accrual</Table.Column>
                  <Table.Column>Carry forward</Table.Column>
                  <Table.Column>Approval</Table.Column>
                  <Table.Column>Status</Table.Column>
                </Table.Header>
                <Table.Body>
                  {data.types.map((t) => (
                    <Table.Row key={t.id} id={t.id}>
                      <Table.Cell className="font-medium">{t.name}</Table.Cell>
                      <Table.Cell>{t.paid}</Table.Cell>
                      <Table.Cell>{t.accrual}</Table.Cell>
                      <Table.Cell>{t.carry}</Table.Cell>
                      <Table.Cell>{t.flow}</Table.Cell>
                      <Table.Cell>
                        {t.verified ? (
                          <Chip size="sm" variant="soft" color="success" className="whitespace-nowrap">
                            <Check className="size-3" />
                            <Chip.Label>{t.status}</Chip.Label>
                          </Chip>
                        ) : (
                          <GateChip icon={<ShieldExclamation className="size-3" />} className="whitespace-nowrap">
                            {t.status}
                          </GateChip>
                        )}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        )}
        {lower === "bal" ? <Pager page={balancePage} total={balances.length} onPage={setBalancePage} /> : null}
      </Card>
      <Toast.Provider placement="bottom" />
    </PageContent>
  );
}
