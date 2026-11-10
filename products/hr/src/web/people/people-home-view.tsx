"use client";

import { ArrowRight, Calendar, Check, CircleCheck, ShieldExclamation, TriangleExclamation } from "@gravity-ui/icons";
import { Avatar, AvatarGroup, Button, Chip, Popover, Toast, toast } from "@heroui/react";
import { EmptyState, ItemCard, ItemCardGroup, KPIGroup, ListView, Segment, Stepper, Timeline } from "@heroui-pro/react";
import { KPI } from "@heroui-pro/react/kpi";
import { formatRwf, GateChip, Icon, KeyValueList, LinkButton, PageContent, PageHeader, toneColor } from "@injishi/ui";
import NextLink from "next/link";
import { Fragment, useOptimistic, useState, useTransition } from "react";
import type {
  DeptPresence,
  ExpiringItem,
  HelpdeskTicket,
  HrWaiting,
  LeaveRequest,
  PayRunSummary,
  PeopleProperty,
  PropertyId,
  RosterGap,
} from "../../model/people.ts";
import type { BoardId, Persona } from "../../model/shared.ts";
import { useBoardHref, useHrActions, useHrFeature } from "../mount.tsx";
import { addDays, dayMonthYear, dayOfMonth, fullDay, rangeShort, weekdayShort } from "./days";
import { ACCENT_WHEN_GOOD, avatarColor, firstName, initials, PanelCard, Person, Ring, Tip } from "./parts";
import { PresenceBar, PresenceLegend, type TeamPresence } from "./presence-bar";

export interface PeopleHomeData {
  properties: PeopleProperty[];
  presence: DeptPresence[];
  leave: LeaveRequest[];
  gaps: RosterGap[];
  payRun: PayRunSummary | undefined;
  expiring: ExpiringItem[];
  tickets: HelpdeskTicket[];
  /** The other requests waiting on HR, each with the screen that decides it. */
  waiting: HrWaiting[];
}

type PropertyFilter = "all" | PropertyId;

interface Issue {
  name: string;
  kind: string;
  why: string;
  tone: "warning" | "danger" | "default";
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
  const { decideLeave } = useHrActions();
  const screenHref = useBoardHref();
  // The help desk is a feature Injishi may switch off: its tickets panel goes.
  const deskOn = useHrFeature("helpDesk");
  const [property, setProperty] = useState<PropertyFilter>("all");
  const [pending, startTransition] = useTransition();
  const [leave, approveOptimistic] = useOptimistic(data.leave, (state, id: string) =>
    state.map((l) => {
      if (l.id !== id) return l;
      // Approving the first of two steps moves it on; only the last settles it.
      return l.step === "lm" ? { ...l, step: "hr" as const } : { ...l, hrDecision: "approved" as const };
    }),
  );

  const propertyName = (id: PropertyId) => data.properties.find((p) => p.id === id)?.name ?? id;
  const inScope = <T extends { property: PropertyId }>(rows: T[]) =>
    rows.filter((r) => property === "all" || r.property === property);

  // Who is in now, per department.
  const shown = inScope(data.presence);
  const depts = shown.map((d) => {
    // In now: whoever is late and has since clocked out is counted late, and not as in.
    const everyone = [...d.present, ...d.late.filter((x) => !x.gone).map((x) => x.name)];
    const finished = d.finished?.length ?? 0;
    const issues: Issue[] = [
      ...d.late.map((x) => ({
        name: x.name,
        kind: "Late",
        why: x.gone ? `${x.why} · finished` : x.why,
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
      ...(d.onLeave ?? []).map((x) => ({
        name: x.name,
        kind: "On leave",
        why: x.why,
        tone: "default" as const,
        action: "See leave",
        board: "Leave" as BoardId,
      })),
    ];
    // Rostered: in now, finished or absent. Someone on leave is not rostered, as on Attendance.
    return { ...d, everyone, issues, rostered: everyone.length + finished + d.absent.length };
  });
  // Teams with nobody rostered fold into one "Off today" line; the rest group by property.
  const onShift = depts.filter((d) => d.rostered > 0);
  const offToday = depts.filter((d) => d.rostered === 0);
  const teamGroups = [...new Set(onShift.map((d) => d.property))].map((p) => ({
    property: p,
    teams: onShift.filter((d) => d.property === p),
  }));
  const tally = (d: DeptPresence): TeamPresence => ({
    present: d.present.length,
    late: d.late.filter((x) => !x.gone).length,
    finished: d.finished?.length ?? 0,
    explained: d.absent.filter((x) => x.explained).length,
    absent: d.absent.filter((x) => !x.explained).length,
  });
  const presenceTotals = onShift.map(tally).reduce(
    (t, d) => ({
      present: t.present + d.present,
      late: t.late + d.late,
      finished: t.finished + d.finished,
      explained: t.explained + d.explained,
      absent: t.absent + d.absent,
    }),
    { present: 0, late: 0, finished: 0, explained: 0, absent: 0 },
  );
  const nIn = depts.reduce((n, d) => n + d.everyone.length, 0);
  const nRostered = depts.reduce((n, d) => n + d.rostered, 0);
  const nLate = shown.reduce((n, d) => n + d.late.length, 0);
  const nAbs = shown.reduce((n, d) => n + d.absent.length, 0);
  const lateNames = shown.flatMap((d) => d.late.map((x) => firstName(x.name))).join(", ");
  const unexplained = shown.flatMap((d) => d.absent.filter((x) => !x.explained)).length;

  // Leave to decide: requests with a line manager or with HR.
  const homeLeave = leave.filter((l) => l.step === "hr" || l.step === "lm");
  const leftToDecide = homeLeave.filter((l) => l.step === "hr" && !l.hrDecision && !l.blockedWhy).length;
  const withManagers = homeLeave.filter((l) => l.step === "lm").length;
  const approve = (id: string) =>
    startTransition(async () => {
      approveOptimistic(id);
      const result = await decideLeave(id, "approved");
      if (!result.ok) toast.danger(result.error);
    });

  // Roster gaps as a team by day grid over the next seven days.
  const gaps = inScope(data.gaps);
  const gapDays = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const gapDayOf = (g: RosterGap) =>
    /(\d{4}-\d{2}-\d{2})$/.exec(g.id)?.[1] ??
    gapDays.find((d) => g.day === `${weekdayShort(d)} ${dayMonthYear(d).slice(0, -5)}`);
  const gapTeams = [...new Set(gaps.map((g) => g.dept))];

  const kpis = [
    {
      id: "in",
      label: "In now",
      value: nIn,
      foot: `of ${nRostered} rostered`,
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
      foot: nAbs ? `${unexplained} unexplained` : "Nobody absent",
      icon: "PersonXmark",
      status: unexplained ? ("danger" as const) : ("success" as const),
      board: "Attendance" as BoardId,
    },
    {
      id: "leave",
      label: "Leave to decide",
      value: leftToDecide,
      foot: withManagers ? `+${withManagers} with managers` : "None with managers",
      icon: "Suitcase",
      status: leftToDecide ? ("warning" as const) : ("success" as const),
      board: "Leave" as BoardId,
    },
    {
      id: "gaps",
      label: "Roster gaps",
      value: gaps.length,
      foot: "Next 7 days",
      icon: "CalendarXmark",
      status: gaps.length ? ("warning" as const) : ("success" as const),
      board: "Roster" as BoardId,
    },
  ];

  const hour = Number(now.slice(0, 2));
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const segments: { id: PropertyFilter; label: string }[] = [
    { id: "all", label: "All properties" },
    ...data.properties.map((p) => ({ id: p.id, label: p.short })),
  ];

  return (
    <PageContent>
      <PageHeader
        size="hello"
        eyebrow={`${fullDay(today)} · ${now}`}
        title={`${greeting}, ${persona.firstName}`}
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
              Roster
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
                  <span className="flex items-baseline gap-1">
                    <KPI.Value value={k.value} className="tabular" />
                    {k.id === "in" ? <span className="text-sm text-muted tabular">/ {nRostered}</span> : null}
                  </span>
                </KPI.Content>
                <KPI.Footer>
                  {k.id === "in" ? (
                    <KPI.Progress
                      value={nRostered ? Math.round((nIn / nRostered) * 100) : 0}
                      status={nAbs ? "warning" : "success"}
                      className={ACCENT_WHEN_GOOD}
                    />
                  ) : (
                    <p className="truncate text-xs leading-4 text-muted">{k.foot}</p>
                  )}
                </KPI.Footer>
              </KPI>
            </Fragment>
          ))}
        </KPIGroup>
      </section>

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
          <PanelCard
            id="in-h"
            title="Who is in now"
            action={
              <LinkButton href={screenHref("Attendance")} size="sm" variant="ghost">
                Attendance
              </LinkButton>
            }
            className="gap-3"
          >
            <PresenceLegend totals={presenceTotals} />
            {/* One grid for every team, each row a subgrid, so names, bars, faces and chips line up. */}
            <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 sm:grid-cols-[minmax(110px,max-content)_minmax(120px,1fr)_auto_auto] sm:gap-x-4">
              {teamGroups.map((g) => (
                <Fragment key={g.property}>
                  {teamGroups.length > 1 ? (
                    <h3 className="col-span-full pt-3 pb-1 text-xs font-semibold text-muted">
                      {propertyName(g.property)}
                    </h3>
                  ) : null}
                  {g.teams.map((d) => (
                    <div
                      key={d.id}
                      className="col-span-full grid grid-cols-subgrid items-center gap-y-2.5 border-t border-separator py-3 text-sm"
                    >
                      <div className="col-start-1 row-start-1 flex min-w-0 flex-col">
                        <span className="truncate font-semibold">{d.name}</span>
                        <span className="text-xs text-muted tabular">
                          <span className="font-semibold text-foreground">{d.everyone.length}</span> of {d.rostered} in
                        </span>
                      </div>
                      <PresenceBar
                        team={tally(d)}
                        name={d.name}
                        className="col-span-full row-start-2 sm:col-span-1 sm:col-start-2 sm:row-start-1"
                      />
                      {d.everyone.length ? (
                        <Popover>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="col-start-2 row-start-1 h-auto justify-self-end p-1 sm:col-start-3"
                            aria-label={`${d.name}: ${d.everyone.length} on shift`}
                          >
                            <AvatarGroup
                              size="sm"
                              variant="soft"
                              overlap="clip"
                              max={4}
                              aria-hidden="true"
                              className="[--avatar-group-overlap:0.3rem]"
                            >
                              {d.everyone.map((n) => (
                                <Avatar key={n} color={avatarColor(n)}>
                                  <Avatar.Fallback>{initials(n)}</Avatar.Fallback>
                                </Avatar>
                              ))}
                            </AvatarGroup>
                          </Button>
                          <Popover.Content placement="bottom end" className="w-[260px] p-0">
                            <Popover.Dialog aria-label={`${d.name} on shift`} className="flex flex-col gap-2 p-3">
                              <Popover.Heading className="text-xs font-semibold text-muted">
                                {d.name} · on shift
                              </Popover.Heading>
                              {d.everyone.map((n) => (
                                <Person key={n} name={n} />
                              ))}
                            </Popover.Dialog>
                          </Popover.Content>
                        </Popover>
                      ) : null}
                      <span className="col-start-3 row-start-1 flex items-center justify-end gap-1.5 sm:col-start-4">
                        {d.late.length ? (
                          <Chip size="sm" variant="soft" color="warning">
                            {d.late.length} late
                          </Chip>
                        ) : null}
                        {d.absent.length ? (
                          <Chip size="sm" variant="soft" color="danger">
                            {d.absent.length} absent
                          </Chip>
                        ) : null}
                        {d.finished?.length ? (
                          <Chip size="sm" variant="soft">
                            {d.finished.length} finished
                          </Chip>
                        ) : null}
                        {!d.late.length && !d.absent.length && !d.finished?.length ? (
                          <Chip size="sm" variant="soft" color="accent">
                            <Check className="size-3" />
                            <Chip.Label>All in</Chip.Label>
                          </Chip>
                        ) : null}
                      </span>
                      {d.issues.length ? (
                        <ul
                          aria-label={`${d.name}: late and absent`}
                          className="col-span-full row-start-3 flex flex-col gap-1 sm:col-span-3 sm:col-start-2 sm:row-start-2"
                        >
                          {d.issues.map((x) => (
                            <li
                              key={x.name}
                              className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 rounded-xl bg-surface-secondary py-1.5 pr-1.5 pl-2"
                            >
                              <Avatar size="sm" variant="soft" color={avatarColor(x.name)} className="size-7 shrink-0">
                                <Avatar.Fallback className="text-xs">{initials(x.name)}</Avatar.Fallback>
                              </Avatar>
                              <span className="font-medium">{x.name}</span>
                              <Chip size="sm" variant="soft" color={x.tone}>
                                {x.kind}
                              </Chip>
                              <span className="min-w-0 flex-[1_1_140px] truncate text-xs text-muted">{x.why}</span>
                              <LinkButton
                                href={screenHref(x.board)}
                                size="sm"
                                variant="ghost"
                                className="ml-auto h-7 gap-1 px-2 text-xs"
                              >
                                {x.action}
                                <ArrowRight className="size-3.5" />
                              </LinkButton>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ))}
                </Fragment>
              ))}
              {offToday.length ? (
                <p className="col-span-full border-t border-separator pt-3 text-xs text-muted">
                  Off today ·{" "}
                  <span className="font-medium text-foreground">{offToday.map((d) => d.name).join(", ")}</span>
                </p>
              ) : null}
            </div>
          </PanelCard>

          <PanelCard
            id="gap-h"
            title="Roster gaps"
            action={
              <LinkButton href={screenHref("Roster")} size="sm" variant="ghost">
                Roster
              </LinkButton>
            }
            className="gap-2"
          >
            {gaps.length ? (
              <div className="grid grid-cols-[minmax(90px,170px)_repeat(7,minmax(32px,1fr))] items-center gap-x-1 gap-y-2">
                <span className="text-xs text-muted">{rangeShort(today, addDays(today, 6))}</span>
                {gapDays.map((d) => (
                  <span
                    key={d}
                    className={`flex flex-col items-center text-xs leading-4 ${d === today ? "font-semibold text-accent-soft-foreground" : "text-muted"}`}
                  >
                    <span>{weekdayShort(d).slice(0, 2)}</span>
                    <span className="tabular">{dayOfMonth(d)}</span>
                  </span>
                ))}
                {gapTeams.map((team) => {
                  const [name, place] = team.split(", ");
                  return (
                    <Fragment key={team}>
                      <span className="flex min-w-0 flex-col leading-4">
                        <span className="truncate text-[13px] font-medium">{name}</span>
                        {place ? <span className="truncate text-xs text-muted">{place}</span> : null}
                      </span>
                      {gapDays.map((d) => {
                        const g = gaps.find((x) => x.dept === team && gapDayOf(x) === d);
                        return g ? (
                          <Tip key={d} tip={`${g.day} · ${g.detail}`} className="justify-center">
                            <Ring
                              value={g.covered}
                              max={g.needed}
                              label={`${team}, ${g.day}: ${g.covered} of ${g.needed} covered`}
                              color={g.covered ? "warning" : "danger"}
                              size="size-8"
                            >
                              <span className={`text-xs ${g.covered ? "" : "text-danger-soft-foreground"}`}>
                                {g.covered}/{g.needed}
                              </span>
                            </Ring>
                          </Tip>
                        ) : (
                          <span key={d} className="mx-auto size-1.5 rounded-full bg-accent/50" aria-hidden="true" />
                        );
                      })}
                    </Fragment>
                  );
                })}
              </div>
            ) : null}
            {gaps.length === 0 ? (
              <EmptyState size="sm">
                <EmptyState.Header>
                  <EmptyState.Media variant="icon">
                    <CircleCheck />
                  </EmptyState.Media>
                  <EmptyState.Title>Fully covered</EmptyState.Title>
                </EmptyState.Header>
              </EmptyState>
            ) : null}
          </PanelCard>
        </div>

        <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-4">
          <PanelCard id="waiting-h" title="Also waiting on HR" className="gap-2">
            <ListView aria-label="Requests waiting on HR" variant="secondary" items={data.waiting}>
              {(w) => (
                <ListView.Item id={w.id} textValue={w.label} href={`${screenHref(w.board)}${w.query}`}>
                  <ListView.ItemContent>
                    <ListView.Title>{w.label}</ListView.Title>
                  </ListView.ItemContent>
                  <ListView.ItemAction>
                    <Chip size="sm" variant="soft" color={w.count ? "warning" : "default"} className="tabular">
                      {w.count}
                    </Chip>
                  </ListView.ItemAction>
                </ListView.Item>
              )}
            </ListView>
          </PanelCard>

          <ItemCardGroup layout="list" aria-labelledby="leave-h">
            <ItemCardGroup.Header className="flex items-center gap-2">
              <div className="flex-1">
                <ItemCardGroup.Title id="leave-h">Leave to decide</ItemCardGroup.Title>
              </div>
              <LinkButton href={screenHref("Leave")} size="sm" variant="ghost">
                All leave
              </LinkButton>
            </ItemCardGroup.Header>
            {homeLeave.slice(0, 6).map((l) => {
              // Anyone who decides leave may decide the first step too, as the API allows.
              const canDecide = (l.step === "hr" || l.step === "lm") && !l.hrDecision && !l.blockedWhy;
              return (
                <ItemCard key={l.id} className="flex-wrap items-start">
                  <Avatar size="sm" variant="soft" color={avatarColor(l.name)}>
                    <Avatar.Fallback>{initials(l.name)}</Avatar.Fallback>
                  </Avatar>
                  <ItemCard.Content className="min-w-0 flex-[1_1_220px] gap-0.5">
                    <ItemCard.Title className="whitespace-normal">
                      {l.name} · {l.homeType}
                    </ItemCard.Title>
                    <ItemCard.Description className="whitespace-normal">
                      {l.dates} · {l.days} {l.days === 1 ? "day" : "days"}
                    </ItemCard.Description>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Chip size="sm" variant="soft" color={l.step === "hr" ? "accent" : "default"}>
                        {l.homeStep}
                      </Chip>
                      <Tip tip="Balance after">
                        <Chip size="sm" variant="soft">
                          <Chip.Label className="tabular">
                            {/^\d/.test(l.balanceAfter) ? `${l.balanceAfter} left` : l.balanceAfter}
                          </Chip.Label>
                        </Chip>
                      </Tip>
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
                        <Chip.Label>Approved</Chip.Label>
                      </Chip>
                    ) : null}
                    {l.hrDecision === "declined" ? (
                      <Chip variant="soft">
                        <Chip.Label>Declined</Chip.Label>
                      </Chip>
                    ) : null}
                  </ItemCard.Action>
                </ItemCard>
              );
            })}
          </ItemCardGroup>
        </div>
      </div>

      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr))]">
        {data.payRun ? <PayRunCard run={data.payRun} /> : null}

        <PanelCard
          id="exp-h"
          title="Expiring soon"
          action={
            <Chip size="sm" variant="soft">
              45 days
            </Chip>
          }
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

        {deskOn ? (
          <PanelCard
            id="hd-h"
            title="Staff helpdesk"
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
                        {t.who} · {t.age}
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
        ) : null}
      </div>
      <Toast.Provider placement="bottom" />
    </PageContent>
  );
}

function PayRunCard({ run }: { run: PayRunSummary }) {
  const screenHref = useBoardHref();
  return (
    <PanelCard
      id="pay-h"
      title={run.title}
      description={`Pay date ${run.payDate}`}
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
      <span className="flex items-center gap-2 text-[13px] leading-5">
        <Avatar size="sm" variant="soft" color={avatarColor(run.submittedTo)}>
          <Avatar.Fallback>{initials(run.submittedTo)}</Avatar.Fallback>
        </Avatar>
        <span>
          With <strong>{run.submittedTo}</strong> · {run.submittedAt}
        </span>
      </span>
      <KeyValueList
        items={[
          {
            label: "Staff paid",
            value: (
              <span className="tabular">
                {run.staffPaid}
                {run.leavers ? ` · ${run.leavers} leaving` : ""}
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
