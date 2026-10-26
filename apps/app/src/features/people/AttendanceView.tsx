"use client";

import {
  ArrowRight,
  Calendar,
  CircleCheck,
  Display,
  FloppyDisk,
  Paperclip,
  PencilToSquare,
  Person,
  Smartphone,
} from "@gravity-ui/icons";
import {
  Alert,
  Button,
  Card,
  Chip,
  Description,
  FieldError,
  Input,
  Label,
  Table,
  Tabs,
  TextArea,
  TextField,
  Toast,
  toast,
} from "@heroui/react";
import { ItemCard, ItemCardGroup, KPIGroup, NativeSelect, Segment } from "@heroui-pro/react";
import { KPI } from "@heroui-pro/react/kpi";
import { type Persona, screenHref } from "@injishi/data";
import type {
  AttendanceException,
  AttendanceSummary,
  ClockCorrection,
  ClockRecord,
  ClockSource,
  DeskEmployee,
} from "@injishi/data/fixtures/people";
import { Icon, LinkButton, PageContent, PageHeader, toneColor } from "@injishi/ui";
import { Fragment, type ReactNode, useOptimistic, useState, useTransition } from "react";
import { decideCorrection, saveDeskEntry } from "./actions";
import { dayMonthYear, fullDay } from "./days";
import { PanelCard } from "./parts";

interface AttendanceData {
  records: ClockRecord[];
  corrections: ClockCorrection[];
  exceptions: AttendanceException[];
  deskEmployees: DeskEmployee[];
  summary: AttendanceSummary;
}

type Day = "today" | "yesterday";
type View = "records" | "exceptions";

const SOURCE: Record<ClockSource, { label: string; icon: ReactNode }> = {
  kiosk: { label: "Kiosk", icon: <Display className="size-3" /> },
  phone: { label: "Phone", icon: <Smartphone className="size-3" /> },
  desk: { label: "Desk", icon: <PencilToSquare className="size-3" /> },
};

const DESK_REASONS = ["Kiosk or phone unavailable", "Forgot to clock", "Working off-site", "New joiner without a PIN"];

type CorrectionUpdate = { id: string; state: "approved" | "declined"; outcome: string };

export function AttendanceView({
  persona,
  data,
  initial,
  today,
  now,
}: {
  persona: Persona;
  data: AttendanceData;
  initial: { day: Day; tab: View };
  /** Today in Kigali ("2026-10-15") and the time the page was drawn ("09:40"). */
  today: string;
  now: string;
}) {
  const { summary } = data;
  const [day, setDay] = useState<Day>(initial.day);
  const [tab, setTab] = useState<View>(initial.tab);
  const [declining, setDeclining] = useState<Record<string, boolean>>({});
  const [declineNotes, setDeclineNotes] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const [corrections, updateCorrection] = useOptimistic(data.corrections, (state, u: CorrectionUpdate) =>
    state.map((c) => (c.id === u.id ? { ...c, state: u.state, outcome: u.outcome } : c)),
  );
  const [records, addRecord] = useOptimistic(data.records, (state, r: ClockRecord) => [...state, r]);

  // Desk entry form.
  const [emp, setEmp] = useState(data.deskEmployees[0]?.id ?? "");
  const [date, setDate] = useState(() => dayMonthYear(today));
  const [clockIn, setClockIn] = useState("06:00");
  const [clockOut, setClockOut] = useState("");
  const [reason, setReason] = useState(DESK_REASONS[0]);
  const [justification, setJustification] = useState("");
  const [showError, setShowError] = useState(false);
  const [savedName, setSavedName] = useState<string | null>(null);
  const employee = data.deskEmployees.find((e) => e.id === emp) ?? data.deskEmployees[0];

  // Desk entries added here show first, newest on top (they are appended to the collection).
  const added = records.filter((r) => r.addedAt).sort((a, b) => (b.addedAt ?? "").localeCompare(a.addedAt ?? ""));
  const all = [...added, ...records.filter((r) => !r.addedAt)];
  const shown = all.filter((r) => r.day === day);

  const corrState = (id: string | null) => corrections.find((c) => c.id === id)?.state;
  const exceptions = data.exceptions.map((x) => {
    const resolved = corrState(x.correction) === "approved";
    return {
      ...x,
      resolved,
      detail: resolved && x.resolvedDetail ? x.resolvedDetail : x.detail,
      state: resolved ? "Resolved" : x.state,
      tone: resolved ? ("success" as const) : x.tone,
    };
  });
  const openExceptions = exceptions.filter((x) => !x.resolved).length;
  const pendingCorrections = corrections.filter((c) => c.state === "pending").length;
  const lateCount = exceptions.filter((x) => x.kind === "late").length;
  const missedCount = exceptions.filter((x) => x.kind === "missed" && !x.resolved).length;

  const kpis = [
    {
      id: "in",
      label: "Clocked in",
      value: summary.clockedIn + added.length,
      foot: `of ${summary.rostered} rostered this morning`,
      icon: "PersonWorker",
      status: "success" as const,
    },
    { id: "late", label: "Late", value: lateCount, foot: summary.lateNote, icon: "Clock", status: "warning" as const },
    {
      id: "missed",
      label: "Missed clock-out",
      value: missedCount,
      foot: summary.missedDay,
      icon: "ArrowRightFromSquare",
      status: missedCount ? ("warning" as const) : ("success" as const),
    },
    {
      id: "corrections",
      label: "Corrections waiting",
      value: pendingCorrections,
      // Nothing in the product asks a line manager to confirm a correction yet: the office decides alone.
      foot: "Decided here · no line manager step yet",
      icon: "PencilToSquare",
      status: pendingCorrections ? ("warning" as const) : ("success" as const),
    },
  ];

  const decide = (c: ClockCorrection, state: "approved" | "declined") =>
    startTransition(async () => {
      updateCorrection({
        id: c.id,
        state,
        outcome:
          state === "approved"
            ? `Correction entry added by ${persona.name}. The original clock record is kept.`
            : `Declined by ${persona.name}. The reason is kept with the request; no message is sent.`,
      });
      const result = await decideCorrection(c.id, state, declineNotes[c.id]);
      if (!result.ok) toast.danger(result.error);
    });

  const save = () => {
    if (!justification.trim()) {
      setShowError(true);
      return;
    }
    const entry = { employee: emp, date, clockIn, clockOut, reason, justification };
    startTransition(async () => {
      addRecord({
        id: `desk-pending-${emp}`,
        day: "today",
        name: employee.name,
        dept: employee.dept,
        property: employee.property,
        shift: employee.shift,
        clockIn: clockIn.trim() || "06:00",
        source: "desk",
        sourceNote: `By ${persona.name} · justification on file`,
        clockOut: clockOut.trim() || "—",
        status: "Saving",
        tone: "info",
        addedAt: new Date().toISOString(),
      });
      const res = await saveDeskEntry(entry);
      if (res.ok) {
        setSavedName(employee.name);
        setJustification("");
        setShowError(false);
      } else {
        setSavedName(null);
        toast.danger(res.error);
      }
    });
    setDay("today");
    setTab("records");
  };

  const recNote =
    day === "today"
      ? `Showing ${shown.length} of ${summary.rostered} rostered this morning · ${summary.grace}`
      : summary.yesterdayNote;

  return (
    <PageContent>
      <PageHeader
        eyebrow={`${fullDay(today)} · all properties · ${now}`}
        title="Attendance"
        description="Clock records keep their source. Corrections add a new entry with a reason; the original is never edited."
        actions={
          <>
            <Segment
              aria-label="Day"
              selectedKey={day}
              onSelectionChange={(k) => setDay(k === "yesterday" ? "yesterday" : "today")}
            >
              <Segment.Item id="today">Today</Segment.Item>
              <Segment.Item id="yesterday">Yesterday</Segment.Item>
            </Segment>
            <LinkButton href={screenHref("Roster")} variant="secondary">
              <Calendar className="size-4" />
              Roster
            </LinkButton>
          </>
        }
      />

      <section aria-label="Attendance today">
        <KPIGroup className="flex-wrap">
          {kpis.map((k, i) => (
            <Fragment key={k.id}>
              {i > 0 ? <KPIGroup.Separator /> : null}
              <KPI className="min-w-[min(180px,100%)] flex-[1_1_180px]">
                <KPI.Header>
                  <KPI.Icon status={k.status}>
                    <Icon name={k.icon} />
                  </KPI.Icon>
                  <KPI.Title>{k.label}</KPI.Title>
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
          <KPIGroup.Separator />
          <KPI className="min-w-[min(180px,100%)] flex-[1_1_180px]">
            <KPI.Header>
              <KPI.Icon status="success">
                <Display />
              </KPI.Icon>
              <KPI.Title>Sources today</KPI.Title>
            </KPI.Header>
            <KPI.Content>
              <KPI.Value value={summary.kiosk} className="tabular">
                {(kiosk) => `${kiosk} · ${summary.phone} · ${summary.desk + added.length}`}
              </KPI.Value>
            </KPI.Content>
            <KPI.Footer>
              <p className="text-xs leading-4 text-muted">Kiosk · phone · desk</p>
            </KPI.Footer>
          </KPI>
        </KPIGroup>
      </section>

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-3">
          <Tabs
            variant="secondary"
            selectedKey={tab}
            onSelectionChange={(k) => setTab(k === "exceptions" ? "exceptions" : "records")}
          >
            <Tabs.ListContainer>
              <Tabs.List aria-label="Attendance view" className="justify-start gap-1">
                <Tabs.Tab id="records" className="w-auto flex-none gap-1.5 px-3">
                  Clock records
                  <Chip size="sm" variant="soft">
                    {shown.length}
                  </Chip>
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab id="exceptions" className="w-auto flex-none gap-1.5 px-3">
                  Exceptions
                  <Chip size="sm" variant="soft">
                    {openExceptions}
                  </Chip>
                  <Tabs.Indicator />
                </Tabs.Tab>
              </Tabs.List>
            </Tabs.ListContainer>

            <Tabs.Panel id="records" className="flex flex-col gap-3 pt-3">
              <Table>
                <Table.ScrollContainer>
                  <Table.Content aria-label={day === "today" ? "Clock records today" : "Clock records yesterday"}>
                    <Table.Header>
                      <Table.Column isRowHeader>Employee</Table.Column>
                      <Table.Column>Shift</Table.Column>
                      <Table.Column>Clock in</Table.Column>
                      <Table.Column>Clock out</Table.Column>
                      <Table.Column>Status</Table.Column>
                    </Table.Header>
                    <Table.Body>
                      {shown.map((r) => (
                        <Table.Row key={r.id} id={r.id}>
                          <Table.Cell>
                            <span className="flex flex-col">
                              <span className="font-medium">{r.name}</span>
                              <span className="text-xs text-muted">
                                {r.dept} · {r.property}
                              </span>
                            </span>
                          </Table.Cell>
                          <Table.Cell className="whitespace-nowrap tabular">{r.shift}</Table.Cell>
                          <Table.Cell>
                            <span className="flex flex-col gap-0.5">
                              <span className="font-medium tabular">{r.clockIn}</span>
                              {r.source ? (
                                <span className="flex flex-wrap items-center gap-1.5">
                                  <Chip size="sm" variant="soft">
                                    {SOURCE[r.source].icon}
                                    <Chip.Label>{SOURCE[r.source].label}</Chip.Label>
                                  </Chip>
                                  <span className="text-[11px] leading-[14px] text-muted">{r.sourceNote}</span>
                                </span>
                              ) : null}
                            </span>
                          </Table.Cell>
                          <Table.Cell>
                            <span className="flex flex-col">
                              <span className="tabular">{r.clockOut}</span>
                              {r.clockOut === "—" ? (
                                <span className="text-[11px] whitespace-nowrap text-muted">Still on shift</span>
                              ) : null}
                            </span>
                          </Table.Cell>
                          <Table.Cell>
                            <Chip size="sm" variant="soft" color={toneColor(r.tone)} className="whitespace-nowrap">
                              {r.status}
                            </Chip>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>
              <p className="text-xs text-muted">{recNote}</p>
            </Tabs.Panel>

            <Tabs.Panel id="exceptions" className="pt-3">
              <ItemCardGroup layout="list" aria-label="Attendance exceptions">
                {exceptions.map((x) => (
                  <ItemCard key={x.id}>
                    <ItemCard.Icon>
                      <Icon name={x.icon} />
                    </ItemCard.Icon>
                    <ItemCard.Content>
                      <ItemCard.Title className="whitespace-normal">{x.title}</ItemCard.Title>
                      <ItemCard.Description className="whitespace-normal">{x.detail}</ItemCard.Description>
                    </ItemCard.Content>
                    <ItemCard.Action className="flex items-center gap-2">
                      <Chip size="sm" variant="soft" color={toneColor(x.tone)}>
                        {x.state}
                      </Chip>
                      {x.deskEmployee ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          aria-label={`Desk entry for ${x.title.split(" · ")[0]}`}
                          onPress={() => {
                            setEmp(x.deskEmployee ?? emp);
                            setShowError(false);
                            document.getElementById("de-emp")?.focus();
                          }}
                        >
                          Desk entry
                        </Button>
                      ) : null}
                    </ItemCard.Action>
                  </ItemCard>
                ))}
              </ItemCardGroup>
            </Tabs.Panel>
          </Tabs>
        </div>

        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-4">
          <PanelCard
            dense
            id="cr-h"
            title="Correction Requests"
            description="Employee asks, you decide. Line managers have no step here yet"
          >
            {corrections.map((c) => {
              const isDeclining = !!declining[c.id];
              return (
                <Card key={c.id} variant="secondary" className="gap-2 p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-col">
                      <span className="font-semibold">{c.name}</span>
                      <span className="text-xs text-muted">{c.when}</span>
                    </div>
                    <Chip
                      size="sm"
                      variant="soft"
                      color={c.state === "pending" ? "accent" : c.state === "approved" ? "success" : "default"}
                      className="shrink-0"
                    >
                      {c.state === "pending" ? "With you" : c.state === "approved" ? "Approved" : "Declined"}
                    </Chip>
                  </div>
                  <div className="flex items-center gap-2 text-[13px]">
                    <span className="text-muted tabular line-through">{c.from}</span>
                    <ArrowRight className="size-4 text-muted" aria-label="changed to" />
                    <span className="font-semibold tabular">{c.to}</span>
                  </div>
                  <p className="text-[13px] leading-[18px]">“{c.reason}”</p>
                  <span className="flex items-start gap-1 text-xs leading-4 text-muted">
                    <Paperclip className="mt-px size-3 shrink-0" aria-hidden="true" />
                    {c.evidence}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-muted">
                    <Person className="size-3 shrink-0" aria-hidden="true" />
                    {c.manager}
                  </span>
                  {c.state === "pending" ? (
                    <>
                      {isDeclining ? (
                        <TextField
                          value={declineNotes[c.id] ?? ""}
                          onChange={(v) => setDeclineNotes((n) => ({ ...n, [c.id]: v }))}
                          className="flex flex-col gap-1"
                        >
                          <Label>Reason for declining</Label>
                          <TextArea rows={2} placeholder="Recorded on the request. No message is sent." />
                        </TextField>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Button size="sm" isDisabled={pending} onPress={() => decide(c, "approved")}>
                          Approve correction
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          isDisabled={pending}
                          onPress={() =>
                            isDeclining ? decide(c, "declined") : setDeclining((d) => ({ ...d, [c.id]: true }))
                          }
                        >
                          {isDeclining ? "Confirm decline" : "Decline"}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <span className="text-xs text-muted">{c.outcome}</span>
                  )}
                </Card>
              );
            })}
          </PanelCard>

          <PanelCard
            dense
            id="de-h"
            title="Desk Entry"
            description="For when the kiosk or phone could not record a clock"
          >
            <NativeSelect fullWidth className="flex flex-col gap-1">
              <Label htmlFor="de-emp">Employee</Label>
              <NativeSelect.Trigger id="de-emp" value={emp} onChange={(e) => setEmp(e.target.value)}>
                {data.deskEmployees.map((e) => (
                  <NativeSelect.Option key={e.id} value={e.id}>
                    {e.label}
                  </NativeSelect.Option>
                ))}
                <NativeSelect.Indicator />
              </NativeSelect.Trigger>
            </NativeSelect>
            <div className="grid grid-cols-3 gap-2">
              <TextField value={date} onChange={setDate} className="flex min-w-0 flex-col gap-1">
                <Label>Date</Label>
                <Input fullWidth />
              </TextField>
              <TextField value={clockIn} onChange={setClockIn} className="flex min-w-0 flex-col gap-1">
                <Label>In</Label>
                <Input fullWidth className="tabular" />
              </TextField>
              <TextField value={clockOut} onChange={setClockOut} className="flex min-w-0 flex-col gap-1">
                <Label>Out</Label>
                <Input fullWidth className="tabular" placeholder="Optional" />
              </TextField>
            </div>
            <NativeSelect fullWidth className="flex flex-col gap-1">
              <Label htmlFor="de-why">Reason</Label>
              <NativeSelect.Trigger id="de-why" value={reason} onChange={(e) => setReason(e.target.value)}>
                {DESK_REASONS.map((r) => (
                  <NativeSelect.Option key={r} value={r}>
                    {r}
                  </NativeSelect.Option>
                ))}
                <NativeSelect.Indicator />
              </NativeSelect.Trigger>
            </NativeSelect>
            <TextField
              value={justification}
              onChange={(v) => {
                setJustification(v);
                setShowError(false);
              }}
              isInvalid={showError}
              className="flex flex-col gap-1"
            >
              <Label>Justification</Label>
              <TextArea rows={3} placeholder="Who confirmed the time, and how" />
              <FieldError>A justification is required for every desk entry.</FieldError>
              <Description>Recorded as Desk · {persona.name}. No message is sent.</Description>
            </TextField>
            <Button fullWidth onPress={save} isDisabled={pending}>
              <FloppyDisk className="size-4" />
              Save desk entry
            </Button>
            {savedName ? (
              <Alert status="success" role="status">
                <Alert.Indicator>
                  <CircleCheck />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>Desk entry saved for {savedName}</Alert.Title>
                  <Alert.Description>
                    Added to the records with source Desk, validated as you saved it. The reason and the justification
                    stay on the record.
                  </Alert.Description>
                </Alert.Content>
              </Alert>
            ) : null}
          </PanelCard>
        </div>
      </div>
      <Toast.Provider placement="bottom" />
    </PageContent>
  );
}
