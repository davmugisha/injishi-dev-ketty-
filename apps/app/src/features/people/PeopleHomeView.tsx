"use client";

import {
  Calendar,
  CalendarXmark,
  Check,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  ShieldExclamation,
  TriangleExclamation,
} from "@gravity-ui/icons";
import { Avatar, AvatarGroup, Button, Chip, Toast, toast } from "@heroui/react";
import { EmptyState, ItemCard, ItemCardGroup, KPIGroup, ListView, Segment, Stepper, Timeline } from "@heroui-pro/react";
import { KPI } from "@heroui-pro/react/kpi";
import { type BoardId, type Persona, screenHref } from "@injishi/data";
import type {
  DeptPresence,
  ExpiringItem,
  HelpdeskTicket,
  LeaveRequest,
  PayRunSummary,
  PeopleProperty,
  PropertyId,
  RosterGap,
} from "@injishi/data/fixtures/people";
import {
  formatRwf,
  GateChip,
  Icon,
  KeyValueList,
  LinkButton,
  PageContent,
  PageHeader,
  StatusDot,
  toneColor,
} from "@injishi/ui";
import NextLink from "next/link";
import { Fragment, useOptimistic, useState, useTransition } from "react";
import { decideLeave } from "./actions";
import { addDays, fullDay, rangeShort } from "./days";
import { firstName, initials, PanelCard } from "./parts";

interface PeopleHomeData {
  properties: PeopleProperty[];
  presence: DeptPresence[];
  leave: LeaveRequest[];
  gaps: RosterGap[];
  payRun: PayRunSummary | undefined;
  expiring: ExpiringItem[];
  tickets: HelpdeskTicket[];
}

type PropertyFilter = "all" | PropertyId;

interface Issue {
  name: string;
  kind: string;
  why: string;
  tone: "warning" | "danger";
  action: string;
  board: BoardId;
}

export function PeopleHomeView({
  persona,
  data,
  today,
  now,
}: {
  persona: Persona;
  data: PeopleHomeData;
  /** Today in Kigali ("2026-10-15") and the time the page was drawn ("09:40"). */
  today: string;
  now: string;
}) {
  const [property, setProperty] = useState<PropertyFilter>("all");
  const [open, setOpen] = useState<Record<string, boolean>>({ hk: true });
  const [pending, startTransition] = useTransition();
  const [leave, approveOptimistic] = useOptimistic(data.leave, (state, id: string) =>
    state.map((l) => (l.id === id ? { ...l, hrDecision: "approved" as const } : l)),
  );

  const propertyName = (id: PropertyId) => data.properties.find((p) => p.id === id)?.name ?? id;
  const inScope = <T extends { property: PropertyId }>(rows: T[]) =>
    rows.filter((r) => property === "all" || r.property === property);

  // Who is in now, per department.
  const shown = inScope(data.presence);
  const depts = shown.map((d) => {
    const everyone = [...d.present, ...d.late.map((x) => x.name)];
    const issues: Issue[] = [
      ...d.late.map((x) => ({
        name: x.name,
        kind: "Late",
        why: x.why,
        tone: "warning" as const,
        action: "View record",
        board: "Attendance" as BoardId,
      })),
      ...d.absent.map((x) => ({
        name: x.name,
        kind: x.explained ? "Absent, explained" : "Absent",
        why: x.why,
        tone: x.explained ? ("warning" as const) : ("danger" as const),
        action: x.explained ? "Record sick leave" : "Message",
        board: (x.explained ? "Leave" : "Messages") as BoardId,
      })),
    ];
    return { ...d, everyone, issues, rostered: everyone.length + d.absent.length, isOpen: !!open[d.id] };
  });
  const nIn = depts.reduce((n, d) => n + d.everyone.length, 0);
  const nLate = shown.reduce((n, d) => n + d.late.length, 0);
  const nAbs = shown.reduce((n, d) => n + d.absent.length, 0);
  const lateNames = shown.flatMap((d) => d.late.map((x) => firstName(x.name))).join(", ");
  const unexplained = shown.flatMap((d) => d.absent.filter((x) => !x.explained)).length;

  // Leave to decide: requests with a line manager or with HR.
  const homeLeave = leave.filter((l) => l.step === "hr" || l.step === "lm");
  const leftToDecide = homeLeave.filter((l) => l.step === "hr" && !l.hrDecision).length;
  const withManagers = homeLeave.filter((l) => l.step === "lm").length;
  const approve = (id: string) =>
    startTransition(async () => {
      approveOptimistic(id);
      const result = await decideLeave(id, "approved");
      if (!result.ok) toast.danger(result.error);
    });

  const gaps = inScope(data.gaps);

  const kpis = [
    {
      id: "in",
      label: "In now",
      value: nIn,
      foot: `of ${nIn + nAbs} rostered this morning`,
      icon: "PersonWorker",
      status: "success" as const,
      board: "Attendance" as BoardId,
    },
    {
      id: "late",
      label: "Late",
      value: nLate,
      foot: nLate ? lateNames : "Nobody late",
      icon: "Clock",
      status: nLate ? ("warning" as const) : ("success" as const),
      board: "Attendance" as BoardId,
    },
    {
      id: "absent",
      label: "Absent",
      value: nAbs,
      foot: nAbs ? `${nAbs - unexplained} explained · ${unexplained} not explained` : "Nobody absent",
      icon: "PersonXmark",
      status: unexplained ? ("danger" as const) : ("success" as const),
      board: "Attendance" as BoardId,
    },
    {
      id: "leave",
      label: "Leave to decide",
      value: leftToDecide,
      foot: `${withManagers} more with a line manager`,
      icon: "Suitcase",
      status: leftToDecide ? ("warning" as const) : ("success" as const),
      board: "Leave" as BoardId,
    },
    {
      id: "gaps",
      label: "Roster gaps",
      value: gaps.length,
      foot: "Shifts below minimum cover, next 7 days",
      icon: "CalendarXmark",
      status: gaps.length ? ("warning" as const) : ("success" as const),
      board: "Roster" as BoardId,
    },
  ];

  const subline = `${leftToDecide}${leftToDecide === 1 ? " leave request is" : " leave requests are"} waiting for you. The October pay run is with ${data.payRun?.submittedTo ?? "the owner"} for confirmation.`;

  const segments: { id: PropertyFilter; label: string }[] = [
    { id: "all", label: "All properties" },
    ...data.properties.map((p) => ({ id: p.id, label: p.short })),
  ];

  return (
    <PageContent>
      <PageHeader
        size="hello"
        eyebrow={`${fullDay(today)} · People · ${now}`}
        title={`Good morning, ${persona.firstName}`}
        description={subline}
        actions={
          <>
            <Segment
              aria-label="Property"
              selectedKey={property}
              onSelectionChange={(k) => setProperty(String(k) as PropertyFilter)}
            >
              {segments.map((s) => (
                <Segment.Item key={s.id} id={s.id}>
                  {s.label}
                </Segment.Item>
              ))}
            </Segment>
            <LinkButton href={screenHref("Roster")} variant="secondary">
              <Calendar className="size-4" />
              Open roster
            </LinkButton>
          </>
        }
      />

      <section aria-label="Workforce right now">
        <KPIGroup className="flex-wrap">
          {kpis.map((k, i) => (
            <Fragment key={k.id}>
              {i > 0 ? <KPIGroup.Separator /> : null}
              <KPI className="relative min-w-[min(190px,100%)] flex-[1_1_190px]">
                <KPI.Header>
                  <KPI.Icon status={k.status}>
                    <Icon name={k.icon} />
                  </KPI.Icon>
                  <KPI.Title>
                    <NextLink
                      href={screenHref(k.board)}
                      className="text-inherit no-underline after:absolute after:inset-0"
                    >
                      {k.label}
                    </NextLink>
                  </KPI.Title>
                </KPI.Header>
                <KPI.Content>
                  <KPI.Value value={k.value} className="tabular" />
                </KPI.Content>
                <KPI.Footer>
                  <p className="text-xs leading-4 text-muted">{k.foot}</p>
                </KPI.Footer>
              </KPI>
            </Fragment>
          ))}
        </KPIGroup>
      </section>

      <div className="flex flex-wrap items-start gap-4">
        <PanelCard
          id="in-h"
          title="Who Is In Now"
          description={`From kiosk, phone and desk clock-ins · updated ${now}`}
          action={
            <LinkButton href={screenHref("Attendance")} size="sm" variant="ghost">
              Attendance
            </LinkButton>
          }
          className="flex-[999_1_560px] gap-1"
        >
          <div className="flex flex-col">
            {depts.map((d) => (
              <div key={d.id} className="flex flex-col gap-1.5 border-t border-separator py-2.5 text-sm">
                <div className="flex flex-wrap items-center gap-2.5">
                  <Button
                    isIconOnly
                    size="sm"
                    variant="ghost"
                    aria-expanded={d.isOpen}
                    aria-label={`Show everyone on shift in ${d.name}`}
                    onPress={() => setOpen((o) => ({ ...o, [d.id]: !d.isOpen }))}
                  >
                    {d.isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                  </Button>
                  <div className="flex min-w-[160px] flex-1 flex-col">
                    <span className="font-medium">{d.name}</span>
                    <span className="text-xs leading-4 text-muted">
                      {propertyName(d.property)} · {d.rostered} rostered
                    </span>
                  </div>
                  <AvatarGroup
                    size="sm"
                    variant="soft"
                    color="success"
                    overlap="ring"
                    aria-hidden="true"
                    className="[--avatar-group-overlap:4px]"
                  >
                    {d.everyone.slice(0, 4).map((n) => (
                      <Avatar key={n}>
                        <Avatar.Fallback>{initials(n)}</Avatar.Fallback>
                      </Avatar>
                    ))}
                  </AvatarGroup>
                  <span className="flex items-center gap-1.5">
                    <Chip size="sm" variant="soft" color="success">
                      {d.everyone.length} in
                    </Chip>
                    <Chip size="sm" variant="soft" color={d.late.length ? "warning" : "default"}>
                      {d.late.length} late
                    </Chip>
                    <Chip size="sm" variant="soft" color={d.absent.length ? "danger" : "default"}>
                      {d.absent.length} absent
                    </Chip>
                  </span>
                </div>
                {d.issues.map((x) => (
                  <div key={x.name} className="flex items-center gap-2 pl-[42px] text-[13px] leading-5">
                    <StatusDot tone={x.tone} />
                    <span className="font-medium">{x.name}</span>
                    <span className="flex-1 text-muted">
                      {x.kind} · {x.why}
                    </span>
                    <LinkButton href={screenHref(x.board)} size="sm" variant="tertiary">
                      {x.action}
                    </LinkButton>
                  </div>
                ))}
                {d.isOpen ? (
                  <p className="pl-[42px] text-xs leading-[18px] text-muted">On shift: {d.everyone.join(", ")}</p>
                ) : null}
              </div>
            ))}
          </div>
        </PanelCard>

        <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-4">
          <ItemCardGroup layout="list" aria-labelledby="leave-h">
            <ItemCardGroup.Header className="flex items-center gap-2">
              <div className="flex-1">
                <ItemCardGroup.Title id="leave-h">Leave to Decide</ItemCardGroup.Title>
                <ItemCardGroup.Description>
                  Two-step leave types reach you after the line manager; the others come straight to you. Approving
                  updates the roster and balances.
                </ItemCardGroup.Description>
              </div>
              <LinkButton href={screenHref("Leave")} size="sm" variant="ghost">
                All leave
              </LinkButton>
            </ItemCardGroup.Header>
            {homeLeave.map((l) => {
              const canDecide = l.step === "hr" && !l.hrDecision;
              return (
                <ItemCard key={l.id} className="flex-wrap items-start">
                  <Avatar size="sm" variant="soft">
                    <Avatar.Fallback>{initials(l.name)}</Avatar.Fallback>
                  </Avatar>
                  <ItemCard.Content className="min-w-0 flex-[1_1_220px] gap-0.5">
                    <ItemCard.Title className="whitespace-normal">
                      {l.name} · {l.homeType}
                    </ItemCard.Title>
                    <ItemCard.Description className="whitespace-normal">
                      {l.dates} · {l.days} {l.days === 1 ? "day" : "days"} · balance after {l.balanceAfter}
                    </ItemCard.Description>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Chip size="sm" variant="soft" color={l.step === "hr" ? "accent" : "default"}>
                        {l.homeStep}
                      </Chip>
                      {l.homeWarn && !l.hrDecision ? (
                        <Chip size="sm" variant="soft" color="warning">
                          <TriangleExclamation className="size-3" />
                          <Chip.Label>{l.homeWarn}</Chip.Label>
                        </Chip>
                      ) : null}
                    </span>
                  </ItemCard.Content>
                  <ItemCard.Action className="ml-auto flex items-center gap-1.5">
                    {canDecide ? (
                      <>
                        <LinkButton
                          href={`${screenHref("Leave")}?request=${l.id}`}
                          size="sm"
                          variant="secondary"
                          aria-label={`Review ${l.name}, ${l.homeType}`}
                        >
                          Review
                        </LinkButton>
                        <Button
                          size="sm"
                          onPress={() => approve(l.id)}
                          isDisabled={pending}
                          aria-label={`Approve ${l.name}, ${l.homeType}`}
                        >
                          Approve
                        </Button>
                      </>
                    ) : null}
                    {l.hrDecision === "approved" ? (
                      <Chip variant="soft" color="success">
                        <Check className="size-3" />
                        <Chip.Label>Approved · recorded</Chip.Label>
                      </Chip>
                    ) : null}
                    {l.hrDecision === "declined" ? (
                      <Chip variant="soft">
                        <Chip.Label>Declined · recorded</Chip.Label>
                      </Chip>
                    ) : null}
                    {l.step === "lm" ? <span className="text-xs text-muted">Not yours yet</span> : null}
                  </ItemCard.Action>
                </ItemCard>
              );
            })}
          </ItemCardGroup>

          <PanelCard
            id="gap-h"
            title="Roster Gaps · Next 7 Days"
            description="Against minimum cover set by each department head"
            action={<Chip variant="soft">{rangeShort(today, addDays(today, 6))}</Chip>}
            className="gap-2.5"
          >
            {gaps.map((g) => (
              <NextLink key={g.id} href={screenHref("Roster")} className="block text-inherit no-underline">
                <ItemCard variant="secondary">
                  <ItemCard.Icon>
                    <CalendarXmark />
                  </ItemCard.Icon>
                  <ItemCard.Content>
                    <ItemCard.Title className="whitespace-normal">
                      {g.day} · {g.dept}
                    </ItemCard.Title>
                    <ItemCard.Description className="whitespace-normal">{g.detail}</ItemCard.Description>
                  </ItemCard.Content>
                  <ItemCard.Action>
                    <Chip size="sm" variant="soft" color="warning" className="tabular">
                      {g.covered} of {g.needed}
                    </Chip>
                  </ItemCard.Action>
                </ItemCard>
              </NextLink>
            ))}
            {gaps.length === 0 ? (
              <EmptyState size="sm">
                <EmptyState.Header>
                  <EmptyState.Media variant="icon">
                    <CircleCheck />
                  </EmptyState.Media>
                  <EmptyState.Title>Fully covered</EmptyState.Title>
                  <EmptyState.Description>
                    Every shift at this property meets minimum cover for the next 7 days.
                  </EmptyState.Description>
                </EmptyState.Header>
              </EmptyState>
            ) : null}
          </PanelCard>
        </div>
      </div>

      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr))]">
        {data.payRun ? <PayRunCard run={data.payRun} /> : null}

        <PanelCard
          id="exp-h"
          title="Expiring Contracts and Documents"
          description="Ending in the next 45 days · no reminder is sent from this screen"
        >
          <Timeline size="sm" density="compact">
            {data.expiring.map((e) => (
              <Timeline.Item key={e.id} status={e.status}>
                <Timeline.Rail>
                  <Timeline.Marker>
                    <Icon name={e.icon} className="size-3" />
                  </Timeline.Marker>
                  <Timeline.Connector />
                </Timeline.Rail>
                <Timeline.Content className="flex flex-col pb-0.5 text-sm">
                  <NextLink
                    href={e.employee ? `${screenHref(e.board)}?employee=${e.employee}` : screenHref(e.board)}
                    className="font-medium text-inherit no-underline"
                  >
                    {e.title}
                  </NextLink>
                  <span className="text-xs leading-4 text-muted">{e.detail}</span>
                </Timeline.Content>
              </Timeline.Item>
            ))}
          </Timeline>
        </PanelCard>

        <PanelCard
          id="hd-h"
          title="Staff Helpdesk"
          description="Pay and health questions are visible to HR only"
          action={
            <LinkButton href={screenHref("StaffServices")} size="sm" variant="ghost">
              All tickets
            </LinkButton>
          }
          className="gap-2"
        >
          <ListView aria-label="Staff helpdesk tickets" variant="secondary" items={data.tickets}>
            {(t) => (
              <ListView.Item id={t.id} textValue={t.title} href={screenHref("StaffServices")}>
                <ListView.ItemContent>
                  <Icon name={t.icon} className="size-4 shrink-0 text-muted" />
                  <div className="flex min-w-0 flex-col">
                    <ListView.Title className="whitespace-normal">{t.title}</ListView.Title>
                    <ListView.Description className="whitespace-normal">
                      {t.id} · {t.who} · {t.age}
                    </ListView.Description>
                  </div>
                </ListView.ItemContent>
                <ListView.ItemAction>
                  <Chip size="sm" variant="soft" color={toneColor(t.tone)}>
                    {t.state}
                  </Chip>
                </ListView.ItemAction>
              </ListView.Item>
            )}
          </ListView>
        </PanelCard>
      </div>
      <Toast.Provider placement="bottom" />
    </PageContent>
  );
}

function PayRunCard({ run }: { run: PayRunSummary }) {
  return (
    <PanelCard
      id="pay-h"
      title={run.title}
      description={`${run.entities} · pay date ${run.payDate}`}
      action={
        <Chip variant="soft" color={toneColor(run.statusTone)} className="shrink-0">
          {run.status}
        </Chip>
      }
      className="gap-3.5"
    >
      <Stepper size="sm" currentStep={run.currentStep} aria-label="Pay run progress">
        {run.steps.map((s) => (
          <Stepper.Step key={s}>
            <Stepper.Indicator />
            <Stepper.Content>
              <Stepper.Title>{s}</Stepper.Title>
            </Stepper.Content>
            <Stepper.Separator />
          </Stepper.Step>
        ))}
      </Stepper>
      <p className="text-[13px] leading-5">
        Submitted to <strong>{run.submittedTo}</strong> on {run.submittedAt}. You prepared this run, so you cannot
        confirm it. Payment files stay locked until he does.
      </p>
      <KeyValueList
        items={[
          {
            label: "Staff paid",
            value: (
              <span className="tabular">
                {run.staffPaid} · {run.leavers} leaver final settlement
              </span>
            ),
          },
          { label: "Gross pay", value: <span className="tabular">{formatRwf(run.gross)}</span> },
          { label: "Net pay", value: <span className="tabular">{formatRwf(run.net)}</span> },
          {
            label: "Rule versions",
            value: (
              <GateChip icon={<ShieldExclamation className="size-3" />}>
                {run.ruleVersion} · {run.ruleStatus}
              </GateChip>
            ),
          },
        ]}
      />
      <div className="flex flex-wrap items-center gap-2">
        <LinkButton href={screenHref("PayRun")}>Open pay run</LinkButton>
        <LinkButton href={screenHref("PayrollRules")} variant="ghost">
          Payroll rules
        </LinkButton>
      </div>
    </PanelCard>
  );
}
