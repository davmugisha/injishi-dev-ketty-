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
import {
  Alert,
  Avatar,
  Button,
  Card,
  Chip,
  FieldError,
  Label,
  Table,
  Tabs,
  TextArea,
  TextField,
  Toast,
  toast,
} from "@heroui/react";
import { EmptyState, Segment, Stepper, Widget } from "@heroui-pro/react";
import type {
  LeaveBalance,
  LeaveCalendarEntry,
  LeaveRequest,
  LeaveStep,
  LeaveType,
  Persona,
} from "@injishi/product-hr";
import { useBoardHref, useHrActions } from "@injishi/product-hr/web";
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
import { addDays, dayOfMonth, rangeLong, weekdayIndex } from "./days";
import { firstName, initials } from "./parts";

interface LeaveData {
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

/**
 * A request of a one-step leave type (no line manager named, `lm` empty) never had a manager step:
 * its chip says only where it is, and the first dot stays empty.
 */
function stepChip(r: LeaveRequest, step: LeaveStep) {
  const s = STEP[step];
  if (r.lm) return s;
  return { ...s, label: step === "hr" ? "With you" : s.label, dots: [null, s.dots[1]] as [Tone | null, Tone | null] };
}

/** Calendar: the 21 days from today (a request's `cal` counts its first day from today). */
const CAL_LENGTH = 21;
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
  today,
}: {
  persona: Persona;
  data: LeaveData;
  initial: { request: string; tab: Group; show: "bal" | "rules" };
  /** Today in Kigali ("2026-10-15"): the calendar's first day. */
  today: string;
}) {
  const screenHref = useBoardHref();
  const { decideLeave } = useHrActions();
  const [tab, setTab] = useState<Group>(initial.tab);
  const [sel, setSel] = useState(initial.request);
  const [declining, setDeclining] = useState(false);
  const [why, setWhy] = useState("");
  const [whyErr, setWhyErr] = useState(false);
  const [lower, setLower] = useState<"bal" | "rules">(initial.show);
  const [pending, startTransition] = useTransition();
  const [requests, decideOptimistic] = useOptimistic(data.requests, (state, d: Decision) =>
    state.map((r) => (r.id === d.id ? { ...r, hrDecision: d.decision, hrReason: d.reason } : r)),
  );

  const calDays = Array.from({ length: CAL_LENGTH }, (_, i) => addDays(today, i));
  const year = Number(today.slice(0, 4));
  const rows = requests.filter((r) => groupOf(stepOf(r)) === tab);
  const count = (g: Group) => requests.filter((r) => groupOf(stepOf(r)) === g).length;

  const found = requests.find((r) => r.id === sel) ?? requests[0];
  // Live data can hold no request at all: the queue then shows its empty state and nothing to decide.
  if (!found) {
    return (
      <PageContent>
        <PageHeader eyebrow={`People › Leave · ${year} leave year`} title="Leave" description="Nothing to decide." />
        <EmptyState size="sm">
          <EmptyState.Header>
            <EmptyState.Media variant="icon">
              <CircleCheck />
            </EmptyState.Media>
            <EmptyState.Title>No leave requests</EmptyState.Title>
            <EmptyState.Description>Requests arrive here when they wait for HR.</EmptyState.Description>
          </EmptyState.Header>
        </EmptyState>
      </PageContent>
    );
  }
  const cur = found;
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
      const result = await decideLeave(cur.id, decision, reason ?? undefined);
      if (!result.ok) toast.danger(result.error);
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

  // Approval steps: requested → line manager → HR. A one-step leave type has no line manager step
  // (`lm` is empty): it goes from the request straight to HR, and nobody is named as having approved it.
  const lmStep = Boolean(cur.lm);
  const currentStep = lmStep ? (st === "lm" ? 1 : st === "hr" || st === "lmdeclined" ? 2 : 3) : st === "hr" ? 1 : 2;
  const steps = [
    { title: `Requested by ${first}`, desc: cur.sub, cross: false, unreached: false },
    ...(lmStep
      ? [
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
        ]
      : []),
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
          title: `Approved · ${first} sees it in the staff app`,
          text:
            cur.by ??
            `Balance updated to ${cur.balance.split("→ ")[1] ?? cur.balance}. The shifts are released on the roster for re-assignment.`,
        }
      : st === "declined"
        ? {
            status: "default" as const,
            icon: <CircleXmark />,
            title: `Declined · ${first} sees it in the staff app`,
            text: `Reason recorded: “${cur.hrReason || "See note"}”. The balance is unchanged. No message is sent.`,
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
  const calRange = rangeLong(calDays[0], calDays[CAL_LENGTH - 1]);
  const calAria = `Leave ${calRange}: ${calRows.map((c) => `${c.name} ${c.label}`).join("; ")}`;
  // The next request beyond the calendar that still waits on somebody.
  const next = requests.find(
    (r) => !r.cal && (stepOf(r) === "lm" || stepOf(r) === "hr") && !r.roster.startsWith("Past dates"),
  );

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
                  <EmptyState.Description>Requests arrive here when they wait for HR.</EmptyState.Description>
                </EmptyState.Header>
              </EmptyState>
            )}
          >
            {rows.map((r) => {
              const s = stepChip(r, stepOf(r));
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
        eyebrow={`People › Leave · ${year} leave year`}
        title="Leave"
        description="Two-step leave types go to the line manager first; the others come straight to HR. Approving updates balances and releases the shifts on the roster."
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
              <Widget.Title id="cal-h">Leave Calendar · {calRange}</Widget.Title>
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
                  {calDays.map((d) => (
                    <span
                      key={d}
                      className={`rounded-md py-0.5 text-center ${weekdayIndex(d) >= 5 ? "bg-surface-secondary" : ""}`}
                    >
                      <span className="block">{CAL_DOW[weekdayIndex(d)]}</span>
                      <span className="block font-semibold tabular">{dayOfMonth(d)}</span>
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
              {next ? (
                <p className="text-xs text-muted">
                  Next: {next.name}, {next.homeType.toLowerCase()} {next.dates},{" "}
                  {stepOf(next) === "lm" ? `with ${next.lm}` : "with you"}.
                </p>
              ) : null}
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
                  {lmStep ? `${lmFirst} approved the first step. ` : ""}You can approve and fill the gap on the roster,
                  or decline with a reason.
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
                  <TextArea rows={2} placeholder="Recorded on the request. No message is sent." />
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
                  <Alert.Description>HR decides after the line manager.</Alert.Description>
                </Alert.Content>
              </Alert>
              <Button
                variant="secondary"
                className="self-start"
                onPress={() =>
                  toast.warning("Leave reminders are not available yet. Contact the line manager directly.")
                }
              >
                {`Remind ${lmFirst}`}
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
                    <Table.Column className="text-right">Carried from {year - 1}</Table.Column>
                    <Table.Column className="text-right">Accrued {year}</Table.Column>
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
              Annual leave in days. Carried days must be used within the window the annual leave type sets, or they
              expire.
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
      <Toast.Provider placement="bottom" />
    </PageContent>
  );
}
