"use client";

import {
  Calendar,
  Check,
  CircleCheck,
  CircleXmark,
  Hourglass,
  ShieldExclamation,
  TriangleExclamation,
  Xmark,
} from "@gravity-ui/icons";
import { Alert, Avatar, Button, Card, Chip, FieldError, Label, Table, Tabs, TextArea, TextField } from "@heroui/react";
import { EmptyState, Segment, Stepper, Widget } from "@heroui-pro/react";
import { type Persona, screenHref } from "@injishi/data";
import type {
  LeaveBalance,
  LeaveCalendarEntry,
  LeaveRequest,
  LeaveStep,
  LeaveType,
} from "@injishi/data/fixtures/people";
import {
  formatNumber,
  GateChip,
  KeyValueList,
  LinkButton,
  PageContent,
  PageHeader,
  StatusDot,
  type Tone,
  toneColor,
} from "@injishi/ui";
import { type CSSProperties, useOptimistic, useState, useTransition } from "react";
import { decideLeave } from "./actions";
import { firstName, initials } from "./parts";

export interface LeaveData {
  requests: LeaveRequest[];
  balances: LeaveBalance[];
  types: LeaveType[];
  calendar: LeaveCalendarEntry[];
}

type Group = "mine" | "lm" | "done";

const TABS: { id: Group; label: string }[] = [
  { id: "mine", label: "With you" },
  { id: "lm", label: "With line managers" },
  { id: "done", label: "Decided" },
];

/** Approval-step chip and the two progress dots (line manager, then HR). */
const STEP: Record<LeaveStep, { label: string; tone: Tone; dots: [Tone | null, Tone | null] }> = {
  hr: { label: "Manager ✓ · with you", tone: "accent", dots: ["success", "accent"] },
  lm: { label: "With line manager", tone: "default", dots: ["accent", null] },
  approved: { label: "Approved", tone: "success", dots: ["success", "success"] },
  declined: { label: "Declined by HR", tone: "danger", dots: ["success", "danger"] },
  lmdeclined: { label: "Declined by manager", tone: "danger", dots: ["danger", null] },
};

/** Calendar: 12 October → 1 November, weeks start Monday. */
const CAL_DAYS = [
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
  "21",
  "22",
  "23",
  "24",
  "25",
  "26",
  "27",
  "28",
  "29",
  "30",
  "31",
  "1",
];
const CAL_DOW = ["M", "T", "W", "T", "F", "S", "S"];
const CAL_GRID: CSSProperties = { gridTemplateColumns: "150px repeat(21, minmax(min(24px, 100%), 1fr))" };

type Decision = { id: string; decision: "approved" | "declined"; reason: string | null };

const stepOf = (r: LeaveRequest): LeaveStep => r.hrDecision ?? r.step;
const groupOf = (step: LeaveStep): Group => (step === "hr" ? "mine" : step === "lm" ? "lm" : "done");
const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

export function LeaveView({
  persona,
  data,
  initial,
}: {
  persona: Persona;
  data: LeaveData;
  initial: { request: string; tab: Group; show: "bal" | "rules" };
}) {
  const [tab, setTab] = useState<Group>(initial.tab);
  const [sel, setSel] = useState(initial.request);
  const [declining, setDeclining] = useState(false);
  const [why, setWhy] = useState("");
  const [whyErr, setWhyErr] = useState(false);
  const [reminded, setReminded] = useState<Record<string, boolean>>({});
  const [lower, setLower] = useState<"bal" | "rules">(initial.show);
  const [pending, startTransition] = useTransition();
  const [requests, decideOptimistic] = useOptimistic(data.requests, (state, d: Decision) =>
    state.map((r) => (r.id === d.id ? { ...r, hrDecision: d.decision, hrReason: d.reason } : r)),
  );

  const rows = requests.filter((r) => groupOf(stepOf(r)) === tab);
  const count = (g: Group) => requests.filter((r) => groupOf(stepOf(r)) === g).length;

  const cur = requests.find((r) => r.id === sel) ?? requests[0];
  const first = firstName(cur.name);
  const lmFirst = firstName(cur.lm);
  const st = stepOf(cur);
  const hrDone = st === "approved" || st === "declined";

  const pick = (id: string) => {
    setSel(id);
    setDeclining(false);
    setWhyErr(false);
    setWhy("");
  };
  const decide = (decision: "approved" | "declined", reason: string | null) =>
    startTransition(async () => {
      decideOptimistic({ id: cur.id, decision, reason });
      setDeclining(false);
      await decideLeave(cur.id, decision, reason ?? undefined);
    });
  const decline = () => {
    if (!declining) {
      setDeclining(true);
      return;
    }
    if (!why.trim()) {
      setWhyErr(true);
      return;
    }
    decide("declined", why.trim());
  };

  // Approval steps: requested → line manager → HR.
  const currentStep = st === "lm" ? 1 : st === "hr" || st === "lmdeclined" ? 2 : 3;
  const steps = [
    { title: `Requested by ${first}`, desc: cur.sub, cross: false, unreached: false },
    {
      title:
        st === "lm"
          ? `Line manager · ${cur.lm}`
          : st === "lmdeclined"
            ? `Declined by ${cur.lm}`
            : `Approved by ${cur.lm}`,
      desc: st === "lm" ? `Waiting since ${cur.sub.split(" ·")[0]}` : cur.lmNote,
      cross: st === "lmdeclined",
      unreached: false,
    },
    {
      title: st === "approved" ? "Approved by HR" : st === "declined" ? "Declined by HR" : "HR decision · you",
      desc: hrDone
        ? (cur.by ?? `${persona.name} · just now`)
        : st === "hr"
          ? "Balance and roster checked below"
          : "Not reached",
      cross: st === "declined",
      unreached: st === "lmdeclined",
    },
  ];

  const outcome =
    st === "approved"
      ? {
          status: "success" as const,
          icon: <CircleCheck />,
          title: `Approved · ${first} notified`,
          text:
            cur.by ??
            `Balance updated to ${cur.balance.split("→ ")[1] ?? cur.balance}. The shifts are released on the roster for re-assignment.`,
        }
      : st === "declined"
        ? {
            status: "default" as const,
            icon: <CircleXmark />,
            title: `Declined · ${first} notified`,
            text: `Reason sent: “${cur.hrReason || "See note"}”. The balance is unchanged.`,
          }
        : st === "lmdeclined"
          ? {
              status: "default" as const,
              icon: <CircleXmark />,
              title: "Declined by the line manager",
              text: cur.by ?? "",
            }
          : null;

  // Calendar bars: requests with dates in range (not declined by HR) plus approved leave outside this list.
  const calRows = [
    ...requests
      .filter((r) => r.cal && stepOf(r) !== "declined")
      .map((r) => ({ id: r.id, name: r.name, type: r.type, step: stepOf(r), cal: r.cal as [number, number] })),
    ...data.calendar.map((c) => ({ id: c.id, name: c.name, type: c.type, step: c.step as LeaveStep, cal: c.cal })),
  ]
    .sort((a, b) => a.cal[0] - b.cal[0])
    .map((r) => ({
      ...r,
      label: `${r.type.split(" ·")[0]}${r.step === "approved" ? "" : " · pending"}`,
      approved: r.step === "approved",
    }));
  const calAria = `Leave from 12 October to 1 November: ${calRows.map((c) => `${c.name} ${c.label}`).join("; ")}`;

  // Balances move pending days into taken when HR approves; a decline releases them.
  const balances = data.balances.map((b) => {
    const req = requests.find((r) => r.id === b.request);
    const approved = req?.hrDecision === "approved";
    const declined = req?.hrDecision === "declined";
    const taken = approved ? b.taken + b.pending : b.taken;
    return { ...b, taken, pending: approved || declined ? 0 : b.pending, available: b.carried + b.accrued - taken };
  });

  const requestsTable = (
    <Table>
      <Table.ScrollContainer>
        <Table.Content
          aria-label={`Leave requests: ${TABS.find((t) => t.id === tab)?.label ?? ""}`}
          selectionMode="single"
          selectionBehavior="replace"
          selectedKeys={new Set([sel])}
          onSelectionChange={(keys) => {
            if (keys === "all") return;
            const [k] = [...keys];
            if (k) pick(String(k));
          }}
        >
          <Table.Header>
            <Table.Column isRowHeader>Employee</Table.Column>
            <Table.Column>Leave</Table.Column>
            <Table.Column className="text-right">Days</Table.Column>
            <Table.Column>Approval step</Table.Column>
          </Table.Header>
          <Table.Body
            renderEmptyState={() => (
              <EmptyState size="sm">
                <EmptyState.Header>
                  <EmptyState.Media variant="icon">
                    <CircleCheck />
                  </EmptyState.Media>
                  <EmptyState.Title>Nothing waiting for you</EmptyState.Title>
                  <EmptyState.Description>
                    New requests arrive here after the line manager approves them.
                  </EmptyState.Description>
                </EmptyState.Header>
              </EmptyState>
            )}
          >
            {rows.map((r) => {
              const s = STEP[stepOf(r)];
              return (
                <Table.Row key={r.id} id={r.id} className="cursor-pointer">
                  <Table.Cell>
                    <span className="flex items-center gap-2.5">
                      <Avatar size="sm" variant="soft" color="accent">
                        <Avatar.Fallback>{initials(r.name)}</Avatar.Fallback>
                      </Avatar>
                      <span className="flex min-w-0 flex-col">
                        <span className="font-medium">{r.name}</span>
                        <span className="text-xs text-muted">{r.dept}</span>
                      </span>
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="flex flex-col">
                      <span>{r.type}</span>
                      <span className="text-xs text-muted">{r.dates}</span>
                    </span>
                  </Table.Cell>
                  <Table.Cell className="text-right tabular">{r.days}</Table.Cell>
                  <Table.Cell>
                    <span className="flex items-center gap-1.5">
                      <StatusDot tone={s.dots[0]} />
                      <StatusDot tone={s.dots[1]} />
                      <Chip size="sm" variant="soft" color={toneColor(s.tone)} className="whitespace-nowrap">
                        {s.label}
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
        eyebrow="People › Leave · 2026 leave year"
        title="Leave"
        description="The line manager decides first, then HR. Approving updates balances and releases the shifts on the roster."
        actions={
          <LinkButton href={screenHref("Roster")} variant="secondary">
            <Calendar className="size-4" />
            Check roster
          </LinkButton>
        }
      />

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-3">
          <Tabs variant="secondary" selectedKey={tab} onSelectionChange={(k) => setTab(String(k) as Group)}>
            <Tabs.ListContainer>
              <Tabs.List aria-label="Requests" className="justify-start gap-1">
                {TABS.map((t) => (
                  <Tabs.Tab key={t.id} id={t.id} className="w-auto flex-none gap-1.5 px-3">
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
              <Tabs.Panel key={t.id} id={t.id} className="pt-3">
                {requestsTable}
              </Tabs.Panel>
            ))}
          </Tabs>

          <Widget aria-labelledby="cal-h">
            <Widget.Header>
              <Widget.Title id="cal-h">Leave Calendar · 12 October – 1 November</Widget.Title>
              <Widget.Legend>
                <Widget.LegendItem color="var(--chart-3)">Approved</Widget.LegendItem>
                <Widget.LegendItem
                  color="transparent"
                  className="[&>*:first-child]:shadow-[inset_0_0_0_1.5px_var(--chart-3)]"
                >
                  Pending
                </Widget.LegendItem>
              </Widget.Legend>
            </Widget.Header>
            <Widget.Content className="flex flex-col gap-1.5 overflow-x-auto">
              <div role="img" aria-label={calAria} className="flex min-w-[690px] flex-col gap-1.5">
                <div className="grid gap-0.5 text-[11px] leading-[13px] text-muted" style={CAL_GRID}>
                  <span className="self-end">Weeks start Monday</span>
                  {CAL_DAYS.map((d, i) => (
                    <span
                      key={d}
                      className={`rounded-md py-0.5 text-center ${i % 7 >= 5 ? "bg-surface-secondary" : ""}`}
                    >
                      <span className="block">{CAL_DOW[i % 7]}</span>
                      <span className="block font-semibold tabular">{d}</span>
                    </span>
                  ))}
                </div>
                {calRows.map((c) => (
                  <div key={c.id} className="grid items-center gap-0.5" style={CAL_GRID}>
                    <span className="truncate text-xs font-medium">{c.name}</span>
                    <span
                      className={`flex h-[22px] items-center overflow-hidden rounded-[7px] px-2 text-[11px] font-medium whitespace-nowrap ${
                        c.approved
                          ? "bg-[var(--chart-3)] text-accent-foreground"
                          : "text-foreground shadow-[inset_0_0_0_1.5px_var(--chart-3)]"
                      }`}
                      style={{ gridColumn: `${c.cal[0] + 1} / span ${c.cal[1]}` }}
                      title={`${c.name} · ${c.label}`}
                    >
                      {c.label}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted">
                Next: Felix Munyaneza, circumstantial leave 2–5 Nov, with his line manager.
              </p>
            </Widget.Content>
          </Widget>
        </div>

        <Card
          aria-labelledby="dec-h"
          className="min-w-0 flex-[1_1_360px] gap-3.5 p-[18px]"
          render={(props) => <section {...(props as object)} />}
        >
          <div className="flex items-start gap-3">
            <Avatar variant="soft" color="accent">
              <Avatar.Fallback>{initials(cur.name)}</Avatar.Fallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <h2 id="dec-h" className="text-base leading-[22px] font-semibold">
                {cur.name}
              </h2>
              <span className="text-[13px] text-muted">
                {cur.type} · {cur.dates} · {days(cur.days)}
              </span>
            </div>
          </div>

          <Stepper orientation="vertical" size="sm" currentStep={currentStep} aria-label="Approval steps">
            {steps.map((s) => (
              <Stepper.Step key={s.title}>
                {s.unreached ? (
                  <Stepper.Indicator className="border-border bg-transparent text-muted">3</Stepper.Indicator>
                ) : s.cross ? (
                  <Stepper.Indicator>
                    <Xmark className="size-3" />
                  </Stepper.Indicator>
                ) : (
                  <Stepper.Indicator />
                )}
                <Stepper.Content>
                  <Stepper.Title className={`text-sm ${s.unreached ? "text-muted" : ""}`}>{s.title}</Stepper.Title>
                  <Stepper.Description className={s.unreached ? "opacity-60" : ""}>{s.desc}</Stepper.Description>
                </Stepper.Content>
                <Stepper.Separator />
              </Stepper.Step>
            ))}
          </Stepper>

          <KeyValueList
            items={[
              { label: "Balance", value: <span className="tabular">{cur.balance}</span> },
              { label: "Roster", value: cur.roster },
              { label: "Evidence", value: cur.attach },
            ]}
          />

          {cur.warn && st === "hr" ? (
            <Alert status="warning">
              <Alert.Indicator>
                <TriangleExclamation />
              </Alert.Indicator>
              <Alert.Content>
                <Alert.Title>{cur.warn}</Alert.Title>
                <Alert.Description>
                  {lmFirst} approved it knowing this. You can approve and fill the gap on the roster, or decline with a
                  reason.
                </Alert.Description>
              </Alert.Content>
            </Alert>
          ) : null}

          {st === "hr" ? (
            <>
              {declining ? (
                <TextField
                  value={why}
                  onChange={(v) => {
                    setWhy(v);
                    setWhyErr(false);
                  }}
                  isInvalid={whyErr}
                  className="flex flex-col gap-1"
                >
                  <Label>Reason for declining</Label>
                  <TextArea rows={2} placeholder={`Sent to ${first} and the line manager`} />
                  <FieldError>Add a reason before declining.</FieldError>
                </TextField>
              ) : null}
              <div className="flex items-center gap-2">
                <Button className="flex-1" onPress={() => decide("approved", null)} isDisabled={pending}>
                  <Check className="size-4" />
                  Approve as HR
                </Button>
                <Button variant="secondary" onPress={decline} isDisabled={pending}>
                  {declining ? "Confirm decline" : "Decline"}
                </Button>
              </div>
            </>
          ) : null}

          {st === "lm" ? (
            <>
              <Alert>
                <Alert.Indicator>
                  <Hourglass />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>Waiting for {cur.lm}</Alert.Title>
                  <Alert.Description>HR decides after the line manager. You can send a reminder.</Alert.Description>
                </Alert.Content>
              </Alert>
              <Button
                variant="secondary"
                className="self-start"
                isDisabled={!!reminded[cur.id]}
                onPress={() => setReminded((m) => ({ ...m, [cur.id]: true }))}
              >
                {reminded[cur.id] ? `Reminder sent to ${lmFirst}` : `Remind ${lmFirst}`}
              </Button>
            </>
          ) : null}

          {outcome ? (
            <Alert status={outcome.status}>
              <Alert.Indicator>{outcome.icon}</Alert.Indicator>
              <Alert.Content>
                <Alert.Title>{outcome.title}</Alert.Title>
                <Alert.Description>{outcome.text}</Alert.Description>
              </Alert.Content>
            </Alert>
          ) : null}
        </Card>
      </div>

      <Card aria-labelledby="bt-h" className="gap-3 p-[18px]" render={(props) => <section {...(props as object)} />}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="bt-h" className="text-[15px] leading-[22px] font-semibold">
            Balances and Rules
          </h2>
          <Segment
            aria-label="Show"
            selectedKey={lower}
            onSelectionChange={(k) => setLower(k === "rules" ? "rules" : "bal")}
          >
            <Segment.Item id="bal">Balances</Segment.Item>
            <Segment.Item id="rules">Leave types and rules</Segment.Item>
          </Segment>
        </div>
        {lower === "bal" ? (
          <>
            <Table variant="secondary">
              <Table.ScrollContainer>
                <Table.Content aria-label="Annual leave balances">
                  <Table.Header>
                    <Table.Column isRowHeader>Employee</Table.Column>
                    <Table.Column className="text-right">Carried from 2025</Table.Column>
                    <Table.Column className="text-right">Accrued 2026</Table.Column>
                    <Table.Column className="text-right">Taken</Table.Column>
                    <Table.Column className="text-right">Pending</Table.Column>
                    <Table.Column className="text-right">Available</Table.Column>
                    <Table.Column className="text-right">Sick days used</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {balances.map((b) => (
                      <Table.Row key={b.id} id={b.id}>
                        <Table.Cell className="font-medium">{b.name}</Table.Cell>
                        <Table.Cell className="text-right tabular">{formatNumber(b.carried)}</Table.Cell>
                        <Table.Cell className="text-right tabular">{formatNumber(b.accrued)}</Table.Cell>
                        <Table.Cell className="text-right tabular">{formatNumber(b.taken)}</Table.Cell>
                        <Table.Cell className="text-right tabular">{formatNumber(b.pending)}</Table.Cell>
                        <Table.Cell className="text-right font-semibold tabular">
                          {formatNumber(b.available)}
                        </Table.Cell>
                        <Table.Cell className="text-right tabular">{formatNumber(b.sick)}</Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
            <p className="text-xs text-muted">
              Annual leave in days. Carried days must be used by 31 March 2027 under the current carry-forward rule.
            </p>
          </>
        ) : (
          <>
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
            <p className="text-xs text-muted">
              Every value is configurable. Changes are versioned with an effective date and need the owner’s approval;
              statutory minimums also need payroll expert sign-off.
            </p>
          </>
        )}
      </Card>
    </PageContent>
  );
}
