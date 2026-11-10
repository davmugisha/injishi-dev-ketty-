"use client";

import {
  ArrowDownToLine,
  Calendar,
  CircleCheck,
  Clock,
  Persons,
  Printer,
  Sack,
  Suitcase,
  TriangleExclamation,
} from "@gravity-ui/icons";
import { Button, Card, Chip, Drawer, Table, Tabs } from "@heroui/react";
import { EmptyState, KPIGroup, NativeSelect, Segment, Widget } from "@heroui-pro/react";
import { BarChart } from "@heroui-pro/react/bar-chart";
import { KPI } from "@heroui-pro/react/kpi";
import { formatRwf, PageContent, PageHeader } from "@injishi/ui";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, type ReactNode, useState } from "react";
import type { AttendanceRow, HrReport, ReportEvent } from "../../model/report.ts";
import { useHrFeature } from "../mount.tsx";
import { Pager, PanelCard, Person, pageOf, Ring, TAB_CLASS } from "./parts";
import type { ReportTab } from "./report-tabs";

const DAY = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const SHORT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const MONTH = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const MONTH_SHORT = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });
const at = (iso: string) => new Date(`${iso.length === 7 ? `${iso}-01` : iso}T12:00:00Z`);
const dayOf = (iso: string) => DAY.format(at(iso));
const monthName = (month: string) => MONTH.format(at(month));
const hours = (m: number) =>
  m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}` : m ? `${m} min` : "—";
const days = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)} ${n === 1 ? "day" : "days"}`;
/** "RWF 12.2M": a large amount that fits a figure tile; the table below has it whole. */
const compactRwf = (n: number) => (n >= 1e6 ? `RWF ${(n / 1e6).toFixed(1)}M` : formatRwf(n));
const range = (from: string, to: string) =>
  from === to ? SHORT.format(at(from)) : `${SHORT.format(at(from))} – ${SHORT.format(at(to))}`;

const EVENT: Record<ReportEvent["kind"], { label: string; color: "danger" | "warning" | "default" }> = {
  absent: { label: "Absent", color: "danger" },
  late: { label: "Late", color: "warning" },
  left_early: { label: "Left early", color: "warning" },
  not_counted: { label: "Not counted", color: "danger" },
};

const KPI_CLASS = "min-w-[min(150px,100%)] flex-[1_1_150px] gap-1";

/** A CSV the browser saves: the header row, then one line per row, quoted where needed. */
function download(name: string, header: string[], rows: (string | number | null)[][]) {
  const cell = (v: string | number | null) => {
    const s = v === null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const text = [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([`﻿${text}`], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * The HR report: everything that took place at the business in a month. Staff who joined and
 * left, attendance per person with every late and missed day, leave by type, what pay cost, and
 * the requests people made. People come in name order; a figure never sorts them.
 */
export function HrReportView({
  report,
  month,
  months,
  initialTab,
}: {
  report: HrReport | null;
  month: string;
  /** The months to choose from, newest first. */
  months: string[];
  initialTab: ReportTab;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [tab, setTab] = useState<ReportTab>(initialTab);
  const go = (next: { month?: string; tab?: ReportTab }) => {
    const q = new URLSearchParams({ month: next.month ?? month, tab: next.tab ?? tab });
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };

  const picker = (
    <NativeSelect className="w-44">
      <NativeSelect.Trigger aria-label="Month" value={month} onChange={(e) => go({ month: e.target.value })}>
        {months.map((m) => (
          <NativeSelect.Option key={m} value={m}>
            {monthName(m)}
          </NativeSelect.Option>
        ))}
        <NativeSelect.Indicator />
      </NativeSelect.Trigger>
    </NativeSelect>
  );

  if (!report) {
    return (
      <PageContent>
        <PageHeader eyebrow="HR" title="HR report" actions={picker} />
        <Card className="p-[18px]">
          <EmptyState size="sm" className="py-10">
            <EmptyState.Header>
              <EmptyState.Media variant="icon">
                <TriangleExclamation />
              </EmptyState.Media>
              <EmptyState.Title>This report is for HR and the owner</EmptyState.Title>
            </EmptyState.Header>
          </EmptyState>
        </Card>
      </PageContent>
    );
  }

  const { totals } = report.attendance;
  const expected = totals.shifts - totals.onLeave;
  const rate = expected > 0 ? Math.round((totals.present / expected) * 100) : null;
  const approvedLeave = report.leave.byType.reduce((t, l) => t + l.days, 0);
  const sick = report.leave.byType.filter((l) => /sick/i.test(l.type)).reduce((t, l) => t + l.days, 0);
  const payThisMonth = report.pay?.find((p) => p.month === month) ?? null;
  const partial = report.to > report.today;
  const file = (part: string) => `hr-report-${month}-${part}.csv`;

  return (
    <PageContent>
      <PageHeader
        eyebrow={`${range(report.from, report.to)}${partial ? " · counted up to today" : ""}`}
        title="HR report"
        actions={
          <>
            {picker}
            <Button variant="secondary" onPress={() => window.print()}>
              <Printer className="size-4" aria-hidden="true" />
              Print
            </Button>
          </>
        }
      />

      <section aria-label={`${monthName(month)} in figures`}>
        <KPIGroup className="flex-wrap">
          <Figure icon={<Persons />} title="Staff" value={report.people.atEnd}>
            {report.people.joined.length} joined · {report.people.left.length} left
          </Figure>
          <KPIGroup.Separator />
          <Figure icon={<CircleCheck />} title="Attendance" value={rate === null ? "—" : `${rate}%`}>
            {totals.present} of {expected} shifts worked
          </Figure>
          <KPIGroup.Separator />
          <Figure icon={<TriangleExclamation />} title="Absent" value={totals.absent}>
            Shifts missed, no leave
          </Figure>
          <KPIGroup.Separator />
          <Figure icon={<Clock />} title="Late" value={totals.late}>
            {hours(totals.lateMinutes)} in all
          </Figure>
          <KPIGroup.Separator />
          <Figure icon={<Suitcase />} title="Leave taken" value={days(approvedLeave)}>
            {sick ? `${days(sick)} sick` : "No sick leave"}
          </Figure>
          {report.pay ? (
            <>
              <KPIGroup.Separator />
              <Figure
                icon={<Sack />}
                title="Payroll cost"
                value={payThisMonth?.people ? compactRwf(payThisMonth.employerCostRwf) : "—"}
              >
                {payThisMonth?.people
                  ? payThisMonth.status === "confirmed"
                    ? "Confirmed run"
                    : "Draft run"
                  : "No pay run yet"}
              </Figure>
            </>
          ) : null}
        </KPIGroup>
      </section>

      <Tabs
        variant="secondary"
        selectedKey={tab}
        onSelectionChange={(k) => {
          setTab(String(k) as ReportTab);
          go({ tab: String(k) as ReportTab });
        }}
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label="Report part" className="justify-start gap-1">
            {(
              [
                ["attendance", "Attendance", totals.absent + totals.late],
                ["leave", "Leave", report.leave.taken.length],
                ["staff", "Staff", report.people.joined.length + report.people.left.length],
                ["pay", "Pay", null],
                ["requests", "Requests", null],
              ] as const
            ).map(([id, label, n]) => (
              <Tabs.Tab key={id} id={id} className={TAB_CLASS}>
                {label}
                {n ? (
                  <Chip size="sm" variant="soft">
                    {n}
                  </Chip>
                ) : null}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="attendance" className="flex flex-col gap-4 pt-3">
          <AttendancePart report={report} file={file} />
        </Tabs.Panel>
        <Tabs.Panel id="leave" className="flex flex-col gap-4 pt-3">
          <LeavePart report={report} file={file} />
        </Tabs.Panel>
        <Tabs.Panel id="staff" className="flex flex-col gap-4 pt-3">
          <StaffPart report={report} file={file} />
        </Tabs.Panel>
        <Tabs.Panel id="pay" className="flex flex-col gap-4 pt-3">
          <PayPart report={report} file={file} />
        </Tabs.Panel>
        <Tabs.Panel id="requests" className="flex flex-col gap-4 pt-3">
          <RequestsPart report={report} />
        </Tabs.Panel>
      </Tabs>
    </PageContent>
  );
}

function Figure({
  icon,
  title,
  value,
  children,
}: {
  icon: ReactNode;
  title: string;
  value: ReactNode;
  children: ReactNode;
}) {
  return (
    <KPI className={KPI_CLASS}>
      <KPI.Header>
        <KPI.Icon>{icon}</KPI.Icon>
        <KPI.Title>{title}</KPI.Title>
      </KPI.Header>
      <KPI.Content className="flex-none">
        <span className="text-[22px] leading-7 font-semibold tabular">{value}</span>
      </KPI.Content>
      <KPI.Footer>
        <p className="truncate text-xs leading-4 text-muted">{children}</p>
      </KPI.Footer>
    </KPI>
  );
}

function DownloadButton({ onPress, children }: { onPress: () => void; children: ReactNode }) {
  return (
    <Button size="sm" variant="secondary" onPress={onPress}>
      <ArrowDownToLine className="size-4" aria-hidden="true" />
      {children}
    </Button>
  );
}

// --- Attendance ----------------------------------------------------------------------------------

type AttendanceFilter = "all" | "absent" | "late" | "left_early";

function AttendancePart({ report, file }: { report: HrReport; file: (part: string) => string }) {
  const [filter, setFilter] = useState<AttendanceFilter>("all");
  const [person, setPerson] = useState<AttendanceRow | null>(null);
  const [page, setPage] = useState(1);
  const rows = report.attendance.people.filter((r) =>
    filter === "absent"
      ? r.absent > 0
      : filter === "late"
        ? r.late > 0
        : filter === "left_early"
          ? r.leftEarly > 0
          : true,
  );
  const names = new Map(report.attendance.people.map((p) => [p.employeeId, p.name]));
  const chart = report.attendance.byWeekday;
  const personEvents = person ? report.attendance.events.filter((e) => e.employeeId === person.employeeId) : [];
  // The downloads carry what the filter shows, not the whole month.
  const shownEvents = report.attendance.events.filter((e) => filter === "all" || e.kind === filter);

  return (
    <>
      <div className="flex flex-wrap gap-4">
        <Widget role="region" aria-labelledby="wd-h" className="min-w-0 flex-[2_1_420px]">
          <Widget.Header>
            <Widget.Title id="wd-h" role="heading" aria-level={2}>
              Late and absent by day of the week
            </Widget.Title>
            <span className="flex items-center gap-3">
              <Widget.LegendItem color="var(--danger)">Absent</Widget.LegendItem>
              <Widget.LegendItem color="var(--warning)">Late</Widget.LegendItem>
            </span>
          </Widget.Header>
          <Widget.Content>
            <div role="img" aria-label={chart.map((d) => `${d.day}: ${d.absent} absent, ${d.late} late`).join("; ")}>
              <BarChart data={chart} height={190} margin={{ top: 12, right: 0, bottom: 0, left: 0 }}>
                <BarChart.Grid vertical={false} />
                <BarChart.XAxis dataKey="day" tickLine={false} axisLine={false} interval={0} />
                <BarChart.YAxis allowDecimals={false} width={28} tickLine={false} axisLine={false} />
                <BarChart.Bar
                  dataKey="absent"
                  name="Absent"
                  fill="var(--danger)"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
                <BarChart.Bar
                  dataKey="late"
                  name="Late"
                  fill="var(--warning)"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </div>
          </Widget.Content>
        </Widget>
        <PanelCard id="ot-h" title="Hours and overtime" className="min-w-0 flex-[1_1_260px] gap-3">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Stat label="Hours worked" value={hours(report.attendance.totals.workedMinutes)} />
            <Stat label="Overtime" value={hours(report.attendance.totals.overtimeMinutes)} />
            <Stat label="Overtime approved" value={hours(report.attendance.totals.approvedOvertimeMinutes)} />
            <Stat label="Left early" value={String(report.attendance.totals.leftEarly)} />
            <Stat label="On leave (shifts)" value={String(report.attendance.totals.onLeave)} />
            <Stat label="Not counted" value={String(report.attendance.totals.notCounted)} />
          </dl>
        </PanelCard>
      </div>

      <PanelCard
        id="att-h"
        title="Each person"
        description="Press a person for details."
        action={
          <span className="flex flex-wrap items-center gap-2">
            <Segment
              size="sm"
              selectedKey={filter}
              onSelectionChange={(k) => {
                setFilter(String(k) as AttendanceFilter);
                setPage(1);
              }}
            >
              <Segment.Item id="all">Everyone</Segment.Item>
              <Segment.Item id="absent">Absent</Segment.Item>
              <Segment.Item id="late">Late</Segment.Item>
              <Segment.Item id="left_early">Left early</Segment.Item>
            </Segment>
            <DownloadButton
              onPress={() =>
                download(
                  file("attendance"),
                  [
                    "Employee",
                    "Team",
                    "Branch",
                    "Shifts",
                    "Present",
                    "Absent",
                    "On leave",
                    "Late",
                    "Minutes late",
                    "Left early",
                    "Not counted",
                    "Hours worked",
                    "Overtime hours",
                    "Overtime approved",
                  ],
                  rows.map((r) => [
                    r.name,
                    r.team,
                    r.branch,
                    r.shifts,
                    r.present,
                    r.absent,
                    r.onLeave,
                    r.late,
                    r.lateMinutes,
                    r.leftEarly,
                    r.notCounted,
                    (r.workedMinutes / 60).toFixed(1),
                    (r.overtimeMinutes / 60).toFixed(1),
                    (r.approvedOvertimeMinutes / 60).toFixed(1),
                  ]),
                )
              }
            >
              People
            </DownloadButton>
            <DownloadButton
              onPress={() =>
                download(
                  file("late-and-absent-days"),
                  ["Date", "Employee", "What", "Shift", "Clocked in", "Minutes", "Note"],
                  shownEvents.map((e) => [
                    e.date,
                    names.get(e.employeeId) ?? "",
                    EVENT[e.kind].label,
                    e.shift,
                    e.clockIn,
                    e.minutes,
                    e.note,
                  ]),
                )
              }
            >
              Days
            </DownloadButton>
          </span>
        }
        className="gap-3"
      >
        <Table>
          <Table.ScrollContainer>
            <Table.Content
              aria-label="Attendance per person"
              className="min-w-[520px]"
              onRowAction={(key) => setPerson(rows.find((r) => r.employeeId === String(key)) ?? null)}
            >
              <Table.Header>
                <Table.Column isRowHeader>Employee</Table.Column>
                <Table.Column className="w-[96px]">Worked</Table.Column>
                <Table.Column className="text-end">Late</Table.Column>
                <Table.Column className="text-end">Overtime</Table.Column>
              </Table.Header>
              <Table.Body
                renderEmptyState={() => <p className="py-6 text-center text-sm text-muted">Nobody matches.</p>}
              >
                {pageOf(rows, page).map((r) => {
                  const due = r.shifts - r.onLeave;
                  return (
                    <Table.Row key={r.employeeId} id={r.employeeId} className="cursor-pointer">
                      <Table.Cell className="py-2">
                        <Person name={r.name} sub={[r.team, r.branch].filter(Boolean).join(" · ")} />
                      </Table.Cell>
                      <Table.Cell className="py-2">
                        <Ring
                          value={r.present}
                          max={due}
                          label={`${r.present} of ${due} shifts worked`}
                          color={r.absent ? "warning" : "success"}
                          size="size-10"
                        >
                          <span className="text-xs">{due > 0 ? `${r.present}/${due}` : "—"}</span>
                        </Ring>
                      </Table.Cell>
                      <Table.Cell className="py-2 text-end tabular">
                        {r.late ? (
                          <span className="font-semibold text-warning-soft-foreground">
                            {r.late} <span className="font-normal text-muted">· {hours(r.lateMinutes)}</span>
                          </span>
                        ) : (
                          <span className="text-muted">0</span>
                        )}
                      </Table.Cell>
                      <Table.Cell className="py-2 text-end tabular">{hours(r.overtimeMinutes)}</Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
        <Pager page={page} total={rows.length} onPage={setPage} />
      </PanelCard>

      <Drawer.Backdrop isOpen={person !== null} onOpenChange={(o) => (o ? undefined : setPerson(null))}>
        <Drawer.Content placement="right">
          <Drawer.Dialog aria-labelledby="pd-h" className="w-full max-w-[560px]">
            <Drawer.CloseTrigger aria-label="Close" />
            {person ? (
              <>
                <Drawer.Header className="flex flex-col items-start gap-1 pr-12">
                  <Drawer.Heading id="pd-h" className="text-[18px] leading-6 font-semibold">
                    {person.name}
                  </Drawer.Heading>
                  <span className="text-sm text-muted">
                    {person.present} of {person.shifts - person.onLeave} shifts worked
                  </span>
                </Drawer.Header>
                <Drawer.Body className="flex flex-col gap-4">
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
                    <Stat label="Shifts" value={String(person.shifts)} />
                    <Stat label="Present" value={String(person.present)} />
                    <Stat label="Absent" value={String(person.absent)} />
                    <Stat label="On leave" value={String(person.onLeave)} />
                    <Stat label="Late" value={String(person.late)} />
                    <Stat label="Left early" value={String(person.leftEarly)} />
                    <Stat label="Hours" value={hours(person.workedMinutes)} />
                    <Stat label="Overtime" value={hours(person.overtimeMinutes)} />
                  </dl>
                  {personEvents.length === 0 ? (
                    <p className="py-4 text-sm text-muted">No late, missed or not counted days.</p>
                  ) : (
                    <ul className="flex flex-col divide-y divide-separator">
                      {personEvents.map((e) => (
                        <li
                          key={`${e.date}-${e.kind}`}
                          className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm"
                        >
                          <span className="w-24 shrink-0 font-medium tabular">{dayOf(e.date)}</span>
                          <Chip size="sm" variant="soft" color={EVENT[e.kind].color}>
                            {EVENT[e.kind].label}
                          </Chip>
                          <span className="min-w-0 flex-1 text-muted">
                            {[
                              e.shift ? `Shift ${e.shift}` : null,
                              e.clockIn && e.kind !== "absent" ? `in ${e.clockIn}` : null,
                              e.minutes ? `${hours(e.minutes)} ${e.kind === "left_early" ? "early" : "late"}` : null,
                              e.note,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Drawer.Body>
              </>
            ) : null}
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-semibold tabular">{value}</dd>
    </div>
  );
}

// --- Leave ---------------------------------------------------------------------------------------

function LeavePart({ report, file }: { report: HrReport; file: (part: string) => string }) {
  const [type, setType] = useState("all");
  const types = [...new Set(report.leave.taken.map((l) => l.type))].sort();
  const rows = report.leave.taken.filter((l) => type === "all" || l.type === type);
  const { asked } = report.leave;
  return (
    <>
      <div className="flex flex-wrap gap-3">
        {report.leave.byType.length === 0 ? (
          <Card variant="secondary" className="flex-1 p-4 text-sm text-muted">
            No leave this month.
          </Card>
        ) : (
          report.leave.byType.map((t) => (
            <Card key={t.type} variant="secondary" className="min-w-[180px] flex-[1_1_180px] gap-1 p-4">
              <span className="text-sm text-muted">{t.type}</span>
              <span className="text-[22px] leading-7 font-semibold tabular">{days(t.days)}</span>
              <span className="text-xs text-muted">
                {t.people} {t.people === 1 ? "person" : "people"}
              </span>
            </Card>
          ))
        )}
      </div>
      <PanelCard
        id="lv-h"
        title="Who was away"
        description={`Asked this month: ${asked.approved} approved · ${asked.declined} declined · ${asked.pending} waiting · ${asked.cancelled} withdrawn`}
        action={
          <span className="flex flex-wrap items-center gap-2">
            {types.length > 1 ? (
              <NativeSelect className="w-44">
                <NativeSelect.Trigger aria-label="Leave type" value={type} onChange={(e) => setType(e.target.value)}>
                  <NativeSelect.Option value="all">All leave types</NativeSelect.Option>
                  {types.map((t) => (
                    <NativeSelect.Option key={t} value={t}>
                      {t}
                    </NativeSelect.Option>
                  ))}
                  <NativeSelect.Indicator />
                </NativeSelect.Trigger>
              </NativeSelect>
            ) : null}
            <DownloadButton
              onPress={() =>
                download(
                  file("leave"),
                  [
                    "Employee",
                    "Team",
                    "Leave type",
                    "From",
                    "To",
                    "Days this month",
                    "Days in all",
                    "Status",
                    "Reason",
                  ],
                  rows.map((l) => [
                    l.name,
                    l.team,
                    l.type,
                    l.startsOn,
                    l.endsOn,
                    l.daysInPeriod,
                    l.days,
                    l.status === "approved" ? "Approved" : "Pending",
                    l.reason,
                  ]),
                )
              }
            >
              Download
            </DownloadButton>
          </span>
        }
      >
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="Leave this month" className="min-w-[720px]">
              <Table.Header>
                <Table.Column isRowHeader>Employee</Table.Column>
                <Table.Column>Leave</Table.Column>
                <Table.Column>Dates</Table.Column>
                <Table.Column className="text-end">This month</Table.Column>
                <Table.Column>Status</Table.Column>
              </Table.Header>
              <Table.Body
                renderEmptyState={() => <p className="py-6 text-center text-sm text-muted">No leave this month.</p>}
              >
                {rows.map((l) => (
                  <Table.Row key={l.requestId} id={l.requestId}>
                    <Table.Cell className="py-2">
                      <Person name={l.name} sub={l.reason ?? l.team ?? undefined} />
                    </Table.Cell>
                    <Table.Cell className="py-2">{l.type}</Table.Cell>
                    <Table.Cell className="py-2 whitespace-nowrap tabular">{range(l.startsOn, l.endsOn)}</Table.Cell>
                    <Table.Cell className="py-2 text-end whitespace-nowrap tabular">
                      {days(l.daysInPeriod)}
                      {l.daysInPeriod !== l.days ? <span className="text-muted"> of {l.days}</span> : null}
                    </Table.Cell>
                    <Table.Cell className="py-2">
                      <Chip size="sm" variant="soft" color={l.status === "approved" ? "success" : "warning"}>
                        {l.status === "approved" ? "Approved" : "Pending"}
                      </Chip>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      </PanelCard>
    </>
  );
}

// --- Staff ---------------------------------------------------------------------------------------

function StaffPart({ report, file }: { report: HrReport; file: (part: string) => string }) {
  const { people } = report;
  return (
    <>
      <div className="flex flex-wrap gap-4">
        <PanelCard
          id="jn-h"
          title={`Joined · ${people.joined.length}`}
          className="min-w-0 flex-[1_1_320px] gap-2"
          action={
            <DownloadButton
              onPress={() =>
                download(
                  file("staff"),
                  ["Employee", "Job", "Team", "Branch", "Joined", "Left", "Reason"],
                  [
                    ...people.joined.map((p) => [p.name, p.job, p.team, p.branch, p.on, null, null]),
                    ...people.left.map((p) => [p.name, p.job, p.team, p.branch, null, p.on, p.reason]),
                  ],
                )
              }
            >
              Download
            </DownloadButton>
          }
        >
          <PeopleList
            rows={people.joined.map((p) => ({ ...p, sub: [p.job, p.branch].filter(Boolean).join(" · "), when: p.on }))}
            empty="Nobody joined."
          />
        </PanelCard>
        <PanelCard id="lf-h" title={`Left · ${people.left.length}`} className="min-w-0 flex-[1_1_320px] gap-2">
          <PeopleList
            rows={people.left.map((p) => ({ ...p, sub: p.reason ?? p.job ?? "", when: p.on }))}
            empty="Nobody left."
          />
        </PanelCard>
      </div>
      <div className="flex flex-wrap gap-4">
        <PanelCard
          id="tm-h"
          title="By team"
          description={`${people.atEnd} at month end, ${people.atStart} at the start`}
          className="min-w-0 flex-[1_1_320px] gap-3"
        >
          <Bars rows={people.byTeam} />
        </PanelCard>
        <PanelCard id="br-h" title="By branch" className="min-w-0 flex-[1_1_320px] gap-3">
          <Bars rows={people.byBranch} />
        </PanelCard>
      </div>
    </>
  );
}

function PeopleList({
  rows,
  empty,
}: {
  rows: { employeeId: string; name: string; sub: string; when: string }[];
  empty: string;
}) {
  if (rows.length === 0) return <p className="py-3 text-sm text-muted">{empty}</p>;
  return (
    <ul className="flex flex-col divide-y divide-separator">
      {rows.map((r) => (
        <li key={r.employeeId} className="flex items-center justify-between gap-3 py-2">
          <Person name={r.name} sub={r.sub} />
          <span className="shrink-0 text-sm text-muted tabular">{dayOf(r.when)}</span>
        </li>
      ))}
    </ul>
  );
}

function Bars({ rows }: { rows: { name: string; count: number }[] }) {
  const most = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => (
        <li key={r.name} className="grid grid-cols-[minmax(0,10rem)_1fr_2rem] items-center gap-3 text-sm">
          <span className="truncate">{r.name}</span>
          <span className="h-2 overflow-hidden rounded-full bg-default">
            <span className="block h-full rounded-full bg-accent" style={{ width: `${(r.count / most) * 100}%` }} />
          </span>
          <span className="text-end font-semibold tabular">{r.count}</span>
        </li>
      ))}
    </ul>
  );
}

// --- Pay -----------------------------------------------------------------------------------------

function PayPart({ report, file }: { report: HrReport; file: (part: string) => string }) {
  if (!report.pay) {
    return (
      <Card variant="secondary" className="p-4 text-sm text-muted">
        For people who draft or run pay.
      </Card>
    );
  }
  const months = report.pay;
  const chart = months.map((m) => ({ month: MONTH_SHORT.format(at(m.month)), cost: m.employerCostRwf, net: m.netRwf }));
  return (
    <>
      <Widget role="region" aria-labelledby="pc-h" className="min-w-0">
        <Widget.Header>
          <Widget.Title id="pc-h" role="heading" aria-level={2}>
            Payroll cost, six months
          </Widget.Title>
          <span className="flex items-center gap-3">
            <Widget.LegendItem color="var(--chart-1)">Employer cost</Widget.LegendItem>
            <Widget.LegendItem color="var(--chart-3)">Net pay</Widget.LegendItem>
          </span>
        </Widget.Header>
        <Widget.Content>
          <div
            role="img"
            aria-label={months.map((m) => `${monthName(m.month)}: cost ${formatRwf(m.employerCostRwf)}`).join("; ")}
          >
            <BarChart data={chart} height={200} margin={{ top: 12, right: 0, bottom: 0, left: 0 }}>
              <BarChart.Grid vertical={false} />
              <BarChart.XAxis dataKey="month" tickLine={false} axisLine={false} interval={0} />
              <BarChart.YAxis
                width={44}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => (v ? `${(v / 1e6).toFixed(1)}M` : "0")}
              />
              <BarChart.Bar
                dataKey="cost"
                name="Employer cost"
                fill="var(--chart-1)"
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
              <BarChart.Bar
                dataKey="net"
                name="Net pay"
                fill="var(--chart-3)"
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </div>
        </Widget.Content>
      </Widget>
      <PanelCard
        id="pt-h"
        title="Month by month"
        action={
          <DownloadButton
            onPress={() =>
              download(
                file("pay"),
                [
                  "Month",
                  "Run",
                  "People",
                  "Gross",
                  "PAYE",
                  "RSSB employee",
                  "RSSB employer",
                  "Other deductions",
                  "Net pay",
                  "Employer cost",
                ],
                months.map((m) => [
                  m.month,
                  m.status,
                  m.people,
                  m.grossRwf,
                  m.payeRwf,
                  m.employeeContributionsRwf,
                  m.employerContributionsRwf,
                  m.otherDeductionsRwf,
                  m.netRwf,
                  m.employerCostRwf,
                ]),
              )
            }
          >
            Download
          </DownloadButton>
        }
      >
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="Pay month by month" className="min-w-[820px]">
              <Table.Header>
                <Table.Column isRowHeader>Month</Table.Column>
                <Table.Column className="text-end">People</Table.Column>
                <Table.Column className="text-end">Gross</Table.Column>
                <Table.Column className="text-end">PAYE</Table.Column>
                <Table.Column className="text-end">RSSB</Table.Column>
                <Table.Column className="text-end">Net pay</Table.Column>
                <Table.Column className="text-end">Employer cost</Table.Column>
              </Table.Header>
              <Table.Body>
                {[...months].reverse().map((m) => (
                  <Table.Row key={m.month} id={m.month}>
                    <Table.Cell className="py-2">
                      <span className="flex items-center gap-2">
                        <span className="font-medium">{monthName(m.month)}</span>
                        {m.people ? (
                          <Chip size="sm" variant="soft" color={m.status === "confirmed" ? "success" : "warning"}>
                            {m.status === "confirmed" ? "Confirmed" : "Draft"}
                          </Chip>
                        ) : (
                          <span className="text-xs text-muted">No run</span>
                        )}
                      </span>
                    </Table.Cell>
                    {m.people ? (
                      <>
                        <Table.Cell className="py-2 text-end tabular">{m.people}</Table.Cell>
                        <Table.Cell className="py-2 text-end tabular">{formatRwf(m.grossRwf)}</Table.Cell>
                        <Table.Cell className="py-2 text-end tabular">{formatRwf(m.payeRwf)}</Table.Cell>
                        <Table.Cell className="py-2 text-end tabular">
                          {formatRwf(m.employeeContributionsRwf + m.employerContributionsRwf)}
                        </Table.Cell>
                        <Table.Cell className="py-2 text-end tabular">{formatRwf(m.netRwf)}</Table.Cell>
                        <Table.Cell className="py-2 text-end font-semibold tabular">
                          {formatRwf(m.employerCostRwf)}
                        </Table.Cell>
                      </>
                    ) : (
                      [0, 1, 2, 3, 4, 5].map((i) => (
                        <Table.Cell key={i} className="py-2 text-end text-muted">
                          —
                        </Table.Cell>
                      ))
                    )}
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      </PanelCard>
    </>
  );
}

// --- Requests ------------------------------------------------------------------------------------

function RequestsPart({ report }: { report: HrReport }) {
  // Claims and the help desk are features Injishi may switch off: their cards go.
  const claimsOn = useHrFeature("claims");
  const deskOn = useHrFeature("helpDesk");
  const { claims, corrections, helpDesk } = report.requests;
  const { asked } = report.leave;
  const cards: { icon: ReactNode; title: string; total: number; lines: [string, ReactNode][]; on?: boolean }[] = [
    {
      icon: <Suitcase />,
      title: "Leave requests",
      total: asked.approved + asked.declined + asked.pending + asked.cancelled,
      lines: [
        ["Approved", asked.approved],
        ["Declined", asked.declined],
        ["Waiting", asked.pending],
        ["Withdrawn", asked.cancelled],
      ],
    },
    {
      icon: <Sack />,
      title: "Expense claims",
      on: claimsOn,
      total: claims.asked,
      lines: [
        ["Approved", claims.approved],
        ["Paid out", formatRwf(claims.approvedRwf)],
        ["Waiting", claims.pending],
      ],
    },
    {
      icon: <Calendar />,
      title: "Attendance corrections",
      total: corrections.asked,
      lines: [
        ["Approved", corrections.approved],
        ["Declined", corrections.declined],
        ["Waiting", corrections.pending],
      ],
    },
    {
      icon: <Persons />,
      title: "Help desk questions",
      on: deskOn,
      total: helpDesk.opened,
      lines: [
        ["Asked", helpDesk.opened],
        ["Answered and closed", helpDesk.closed],
      ],
    },
  ];
  return (
    <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr))]">
      {cards
        .filter((c) => c.on !== false)
        .map((c) => (
          <Card key={c.title} className="gap-3 p-[18px]">
            <span className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-lg bg-accent-soft text-accent-soft-foreground [&_svg]:size-4">
                {c.icon}
              </span>
              <span className="flex flex-col">
                <span className="text-sm font-semibold">{c.title}</span>
                <span className="text-xs text-muted">{c.total} this month</span>
              </span>
            </span>
            <dl className="flex flex-col divide-y divide-separator text-sm">
              {c.lines.map(([label, value]) => (
                <Fragment key={label}>
                  <div className="flex items-center justify-between py-1.5">
                    <dt className="text-muted">{label}</dt>
                    <dd className="font-semibold tabular">{value}</dd>
                  </div>
                </Fragment>
              ))}
            </dl>
          </Card>
        ))}
    </div>
  );
}
