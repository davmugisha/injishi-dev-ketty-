"use client";

import {
  ArrowRight,
  ArrowRightFromSquare,
  ArrowRightToSquare,
  Calendar,
  CircleCheck,
  CircleCheckFill,
  Display,
  Ellipsis,
  FloppyDisk,
  Paperclip,
  PencilToSquare,
  Sliders,
  Smartphone,
  TriangleExclamation,
  Xmark,
} from "@gravity-ui/icons";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Chip,
  Dropdown,
  FieldError,
  Input,
  Label,
  Modal,
  SearchField,
  Table,
  Tabs,
  TextArea,
  TextField,
  Toast,
  toast,
} from "@heroui/react";
import { ActionBar, EmptyState, ItemCard, ItemCardGroup, KPIGroup, NativeSelect, Segment } from "@heroui-pro/react";
import { KPI } from "@heroui-pro/react/kpi";
import { Icon, LinkButton, PageContent, PageHeader, toneColor } from "@injishi/ui";
import { type ReactNode, useOptimistic, useState, useTransition } from "react";
import type {
  AttendanceException,
  AttendanceSummary,
  ClockCorrection,
  ClockRecord,
  ClockSource,
  DeskEmployee,
} from "../../model/people.ts";
import type { Persona } from "../../model/shared.ts";
import type { ClockSetup } from "../../model/time.ts";
import { useBoardHref, useHrActions } from "../mount.tsx";
import { CheckClockInModal, ClockRulesModal, FarFromWork } from "./clock-rules";
import { addDays, dayMonthYear, fullDay } from "./days";
import { ACCENT_WHEN_GOOD, firstName, Hint, Pager, Person, pageOf, TAB_CLASS, Tip } from "./parts";

export interface AttendanceData {
  records: ClockRecord[];
  corrections: ClockCorrection[];
  exceptions: AttendanceException[];
  deskEmployees: DeskEmployee[];
  summary: AttendanceSummary;
}

type Day = "today" | "yesterday";
type View = "records" | "exceptions" | "corrections";

const SOURCE: Record<ClockSource, { label: string; icon: ReactNode }> = {
  kiosk: { label: "Kiosk", icon: <Display className="size-3" /> },
  phone: { label: "Phone", icon: <Smartphone className="size-3" /> },
  desk: { label: "Desk", icon: <PencilToSquare className="size-3" /> },
};

const DESK_REASONS = [
  "No login or phone",
  "Kiosk or phone unavailable",
  "Forgot to clock",
  "Working off-site",
  "New joiner without a PIN",
];

/** The time now in Kigali, "14:05": what a clock from the row defaults to. */
function kigaliNow(): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Africa/Kigali",
  }).format(new Date());
}

/** A clock-in recorded by HR starts at the shift start when the person is only late in being recorded. */
function clockInTime(row: ClockRecord): string {
  const now = kigaliNow();
  return row.shiftStart && row.shiftStart <= now ? row.shiftStart : now;
}

/**
 * A clock-out from the row: now for someone on shift today. For yesterday's shift "now" means nothing, so
 * it starts from the shift's end, or eight hours after the clock-in when no shift was rostered.
 */
function clockOutTime(row: ClockRecord): string {
  if (row.day === "today") return kigaliNow();
  const end = /[–-]\s*(\d{1,2}:\d{2})/.exec(row.shift)?.[1];
  if (end) return end;
  const started = minutesOf(row.clockIn);
  if (started === null) return kigaliNow();
  const out = (started + 480) % 1440;
  return `${String(Math.floor(out / 60)).padStart(2, "0")}:${String(out % 60).padStart(2, "0")}`;
}

/** "07:00" → 420; null when the text holds no time ("No clock-in", "—"). */
function minutesOf(t: string): number | null {
  const m = /(\d{1,2}):(\d{2})/.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** "4 h 05" */
const hm = (min: number) => `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;

/**
 * One day's shift as a track an hour wider than the shift, the shift itself shaded and the time
 * worked filled in: green on time, orange when it started late. Someone still on shift fills up to
 * the time the page was drawn.
 */
function ShiftBar({ r, now }: { r: ClockRecord; now: string }) {
  const [a, b] = r.shift.split(/[–-]/).map(minutesOf);
  if (a == null || b == null) return null;
  const end = b <= a ? b + 1440 : b;
  const from = a - 60;
  const span = end + 60 - from;
  const at = (m: number) => Math.max(0, Math.min(100, ((m - from) / span) * 100));
  let ci = minutesOf(r.clockIn);
  const live = r.day === "today" && r.action === "clock_out";
  let co = minutesOf(r.clockOut) ?? (live ? minutesOf(now) : null);
  if (ci != null && end > 1440 && ci < a - 360) ci += 1440;
  if (ci != null && co != null && co < ci) co += 1440;
  const late = ci != null && ci > a + 5;
  const worked = ci != null && co != null ? co - ci : null;
  return (
    <span className="flex w-full min-w-[120px] flex-col gap-1">
      <span
        role="img"
        aria-label={`Shift ${r.shift}${worked != null ? `, ${hm(worked)} worked` : ", not clocked in"}`}
        className="relative block h-2 w-full overflow-hidden rounded-full bg-default"
      >
        <span
          className="absolute inset-y-0 rounded-full bg-[color-mix(in_oklab,var(--foreground)_14%,transparent)]"
          style={{ left: `${at(a)}%`, width: `${at(end) - at(a)}%` }}
        />
        {ci != null && co != null ? (
          <span
            className={`absolute inset-y-0 rounded-full ${late ? "bg-warning" : "bg-accent"} ${live ? "animate-pulse" : ""}`}
            style={{ left: `${at(ci)}%`, width: `${Math.max(2, at(co) - at(ci))}%` }}
          />
        ) : null}
      </span>
      <span className="flex justify-between text-xs leading-4 text-muted tabular">
        <span>{r.shift}</span>
        {worked != null ? <span className="font-medium text-foreground">{hm(worked)}</span> : null}
      </span>
    </span>
  );
}

type RowState = "on" | "absent" | "done";
const rowState = (r: ClockRecord): RowState =>
  r.action === "clock_in" ? "absent" : r.action === "clock_out" ? "on" : "done";
const ROW_FILTERS: { id: "all" | RowState; label: string }[] = [
  { id: "all", label: "All" },
  { id: "on", label: "On shift" },
  { id: "absent", label: "Absent" },
  { id: "done", label: "Done" },
];

type CorrectionUpdate = { id: string; state: "approved" | "declined"; outcome: string };

const KPI_CLASS = "relative min-w-[min(128px,100%)] flex-[1_1_128px]";

/**
 * A tile's title that opens its tab. The press covers the whole tile, so the button gives up the position
 * and the transform that would hold its `after` inside itself.
 */
const KPI_LINK =
  "static h-auto min-h-0 w-auto transform-none! p-0 text-inherit will-change-auto! after:absolute after:inset-0 hover:bg-transparent! hover:underline data-[pressed=true]:bg-transparent!";

export function AttendanceView({
  persona,
  data,
  initial,
  today,
  now,
  clockSetup,
}: {
  persona: Persona;
  data: AttendanceData;
  initial: { day: Day; tab: View };
  /** Clock-in rules, entrance tablets and who clocked in far from work this month. */
  clockSetup: ClockSetup;
  /** Today in Kigali ("2026-10-15") and the time the page was drawn ("09:40"). */
  today: string;
  now: string;
}) {
  const { clockOutFromDesk, decideCorrection, saveDeskEntry } = useHrActions();
  const screenHref = useBoardHref();
  const { summary } = data;
  const [day, setDay] = useState<Day>(initial.day);
  const [tab, setTab] = useState<View>(initial.tab);
  const [query, setQuery] = useState("");
  const [rowFilter, setRowFilter] = useState<"all" | RowState>("all");
  const [page, setPage] = useState(1);
  const [declining, setDeclining] = useState<Record<string, boolean>>({});
  const [declineNotes, setDeclineNotes] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const [corrections, updateCorrection] = useOptimistic(data.corrections, (state, u: CorrectionUpdate) =>
    state.map((c) => (c.id === u.id ? { ...c, state: u.state, outcome: u.outcome } : c)),
  );
  const [records, addRecord] = useOptimistic(data.records, (state, r: ClockRecord) => [...state, r]);

  // Desk entry: a past day, or a full in and out, typed by HR.
  const [deskOpen, setDeskOpen] = useState(false);
  const [emp, setEmp] = useState(data.deskEmployees[0]?.id ?? "");
  const [date, setDate] = useState(() => dayMonthYear(today));
  const [clockIn, setClockIn] = useState("06:00");
  const [clockOut, setClockOut] = useState("");
  const [reason, setReason] = useState(DESK_REASONS[0]);
  const [justification, setJustification] = useState("");
  const [showError, setShowError] = useState(false);
  // Opened for a missed clock-out: the day and clock-in are the record's, and only the clock-out is missing.
  const [deskFix, setDeskFix] = useState(false);
  const employee = data.deskEmployees.find((e) => e.id === emp) ?? data.deskEmployees[0];
  const openDesk = (employeeId?: string, record?: { workDate: string; clockIn?: string }) => {
    if (employeeId) setEmp(employeeId);
    setDate(dayMonthYear(record?.workDate ?? today));
    setClockIn(record?.clockIn ?? "06:00");
    setClockOut("");
    setDeskFix(Boolean(record));
    setShowError(false);
    setDeskOpen(true);
  };

  // Clocking someone in or out from their row: staff who do not use the kiosk or the app.
  const [clocking, setClocking] = useState<{ row: ClockRecord; kind: "in" | "out" } | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [checking, setChecking] = useState<ClockRecord | null>(null);
  const [clockTime, setClockTime] = useState("");
  const [clockReason, setClockReason] = useState(DESK_REASONS[0]);
  const [clockNote, setClockNote] = useState("");
  const [staleOut, setStaleOut] = useState("");
  const [clockPending, startClock] = useTransition();
  const openClock = (row: ClockRecord, kind: "in" | "out") => {
    setClockTime(kind === "in" ? clockInTime(row) : clockOutTime(row));
    setClockReason(DESK_REASONS[0]);
    setClockNote("");
    setStaleOut(row.stale?.clockOut ?? "");
    setClocking({ row, kind });
  };

  /** Clocks one person in: closes a shift left open on an earlier day first, as the API refuses two. */
  const clockInRow = async (row: ClockRecord, at: string, why: string, note: string, closeAt?: string) => {
    if (row.stale) {
      const closed = await clockOutFromDesk({
        recordId: row.stale.recordId,
        date: row.stale.date,
        time: closeAt ?? row.stale.clockOut,
        clockedInAt: row.stale.clockIn,
      });
      if (!closed.ok) return closed;
    }
    return saveDeskEntry({
      employee: row.employeeId ?? "",
      date: today,
      clockIn: at,
      clockOut: "",
      reason: why,
      justification: note.trim() || `Recorded by ${persona.name}`,
    });
  };

  const submitClock = () => {
    if (!clocking) return;
    const { row, kind } = clocking;
    startClock(async () => {
      const result =
        kind === "in"
          ? await clockInRow(row, clockTime, clockReason, clockNote, staleOut)
          : await clockOutFromDesk({
              recordId: row.id,
              // The day the clock-in fell on, so a past shift is not stamped with today's date.
              date: row.clockedOn ?? (row.day === "today" ? today : addDays(today, -1)),
              time: clockTime,
              clockedInAt: row.clockIn,
            });
      if (!result.ok) {
        toast.danger(result.error);
        return;
      }
      setClocking(null);
      toast.success(`${firstName(row.name)} clocked ${kind} at ${clockTime}`);
    });
  };

  // Desk entries added here show first, newest on top (they are appended to the collection).
  const added = records.filter((r) => r.addedAt).sort((a, b) => (b.addedAt ?? "").localeCompare(a.addedAt ?? ""));
  const all = [...added, ...records.filter((r) => !r.addedAt)];
  const shown = all.filter((r) => r.day === day);
  const q = query.trim().toLowerCase();
  const listed = shown.filter(
    (r) =>
      (rowFilter === "all" || rowState(r) === rowFilter) &&
      (!q || `${r.name} ${r.dept} ${r.property}`.toLowerCase().includes(q)),
  );
  const countOf = (f: "all" | RowState) => (f === "all" ? shown.length : shown.filter((r) => rowState(r) === f).length);
  const pageRows = pageOf(listed, page);

  // Several people clocked in at once from the rows: a team that arrived together.
  const absent = shown.filter((r) => r.action === "clock_in" && r.employeeId);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const picked = absent.filter((r) => selected.has(r.id));
  const [bulkPending, startBulk] = useTransition();
  const clockInPicked = () =>
    startBulk(async () => {
      const failed: string[] = [];
      let done = 0;
      for (const row of picked) {
        const res = await clockInRow(row, clockInTime(row), DESK_REASONS[0], "");
        if (res.ok) done++;
        else failed.push(`${firstName(row.name)}: ${res.error}`);
      }
      setSelected(new Set());
      if (done) toast.success(done === 1 ? "1 person clocked in" : `${done} people clocked in`);
      if (failed.length) for (const f of failed) toast.danger(f);
    });

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
  const addedToday = added.filter((r) => r.day === "today").length;
  const clockedIn = summary.clockedIn + addedToday;
  const inPct = summary.rostered ? Math.round((Math.min(clockedIn, summary.rostered) / summary.rostered) * 100) : 0;

  const decide = (c: ClockCorrection, state: "approved" | "declined") =>
    startTransition(async () => {
      updateCorrection({
        id: c.id,
        state,
        outcome:
          state === "approved"
            ? `Corrected by ${persona.name}. Original record kept.`
            : `Declined by ${persona.name}. ${firstName(c.name)} and the line manager were told why.`,
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
    const name = employee?.name ?? "";
    // Shown at once on the day it belongs to; an older day has no list here to show it on.
    const typed = date.trim();
    const yesterday = addDays(today, -1);
    const entryDay: Day | null =
      typed === dayMonthYear(today) || typed === today
        ? "today"
        : typed === dayMonthYear(yesterday) || typed === yesterday
          ? "yesterday"
          : null;
    setDeskOpen(false);
    startTransition(async () => {
      if (entryDay) {
        addRecord({
          id: `desk-pending-${emp}`,
          day: entryDay,
          name,
          dept: employee.dept,
          property: employee.property,
          shift: employee.shift,
          clockIn: clockIn.trim() || "06:00",
          source: "desk",
          sourceNote: reason,
          clockOut: clockOut.trim() || "—",
          status: "Saving",
          tone: "info",
          addedAt: new Date().toISOString(),
        });
      }
      const res = await saveDeskEntry(entry);
      if (res.ok) {
        setJustification("");
        setShowError(false);
        toast.success(`Desk entry saved for ${firstName(name)}`);
      } else {
        toast.danger(res.error);
      }
    });
    if (entryDay) {
      setDay(entryDay);
      setTab("records");
    }
  };

  /** An exception's own action: clock the absent person in from their row, else a desk entry for that day's record. */
  const actOn = (x: AttendanceException) => {
    const employeeId = x.deskEmployee ?? emp;
    const row =
      x.kind === "absent"
        ? all.find((r) => r.day === "today" && r.employeeId === employeeId && r.action === "clock_in")
        : undefined;
    if (row) openClock(row, "in");
    else openDesk(employeeId, x.workDate ? { workDate: x.workDate, clockIn: x.clockIn } : undefined);
  };

  return (
    <PageContent>
      <PageHeader
        eyebrow={`${fullDay(today)} · ${now}`}
        title="Attendance"
        actions={
          <>
            <Segment
              aria-label="Day"
              selectedKey={day}
              onSelectionChange={(k) => {
                setDay(k === "yesterday" ? "yesterday" : "today");
                setSelected(new Set());
                setPage(1);
              }}
            >
              <Segment.Item id="today">Today</Segment.Item>
              <Segment.Item id="yesterday">Yesterday</Segment.Item>
            </Segment>
            <Button variant="secondary" onPress={() => openDesk()}>
              <PencilToSquare className="size-4" />
              Desk entry
            </Button>
            {clockSetup.branches.length ? (
              <Button variant="secondary" onPress={() => setRulesOpen(true)}>
                <Sliders className="size-4" />
                Clock-in rules
              </Button>
            ) : null}
            <LinkButton href={screenHref("Roster")} variant="secondary">
              <Calendar className="size-4" />
              Roster
            </LinkButton>
          </>
        }
      />

      <section aria-label="Attendance today">
        <KPIGroup className="flex-wrap">
          <KPI className={KPI_CLASS}>
            <KPI.Header>
              <KPI.Icon status="success">
                <Icon name="PersonWorker" />
              </KPI.Icon>
              <KPI.Title>Clocked in</KPI.Title>
            </KPI.Header>
            <KPI.Content>
              <span className="flex items-baseline gap-1">
                <KPI.Value value={clockedIn} className="tabular" />
                <span className="text-sm text-muted tabular">/ {summary.rostered}</span>
              </span>
            </KPI.Content>
            <KPI.Footer>
              <KPI.Progress value={inPct} status={inPct >= 90 ? "success" : "warning"} className={ACCENT_WHEN_GOOD} />
            </KPI.Footer>
          </KPI>
          <KPIGroup.Separator />
          <KPI className={KPI_CLASS}>
            <KPI.Header>
              <KPI.Icon status="warning">
                <Icon name="Clock" />
              </KPI.Icon>
              <KPI.Title className="flex items-center gap-1">
                Late
                <Hint label="Grace period">{summary.grace}</Hint>
              </KPI.Title>
            </KPI.Header>
            <KPI.Content>
              <KPI.Value value={lateCount} className="tabular" />
            </KPI.Content>
            <KPI.Footer>
              <p className="truncate text-xs leading-4 text-muted">{summary.lateNote}</p>
            </KPI.Footer>
          </KPI>
          <KPIGroup.Separator />
          <KPI className={KPI_CLASS}>
            <KPI.Header>
              <KPI.Icon status={missedCount ? "warning" : "success"}>
                <ArrowRightFromSquare />
              </KPI.Icon>
              <KPI.Title>
                <Button variant="ghost" size="sm" onPress={() => setTab("exceptions")} className={KPI_LINK}>
                  Missed clock-out
                </Button>
              </KPI.Title>
            </KPI.Header>
            <KPI.Content>
              <KPI.Value value={missedCount} className="tabular" />
            </KPI.Content>
            <KPI.Footer>
              <p className="truncate text-xs leading-4 text-muted">{summary.missedDay}</p>
            </KPI.Footer>
          </KPI>
          <KPIGroup.Separator />
          <KPI className={KPI_CLASS}>
            <KPI.Header>
              <KPI.Icon status={pendingCorrections ? "warning" : "success"}>
                <PencilToSquare />
              </KPI.Icon>
              <KPI.Title className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onPress={() => setTab("corrections")} className={KPI_LINK}>
                  Corrections
                </Button>
                <span className="relative z-10 inline-flex">
                  <Hint label="About corrections">Confirmed by line managers, waiting for HR.</Hint>
                </span>
              </KPI.Title>
            </KPI.Header>
            <KPI.Content>
              <KPI.Value value={pendingCorrections} className="tabular" />
            </KPI.Content>
            <KPI.Footer>
              <p className="text-xs leading-4 text-muted">{pendingCorrections ? "With you" : "All clear"}</p>
            </KPI.Footer>
          </KPI>
          <KPIGroup.Separator />
          <KPI className={KPI_CLASS}>
            <KPI.Header>
              <KPI.Icon status="success">
                <Display />
              </KPI.Icon>
              <KPI.Title>Clock-ins</KPI.Title>
            </KPI.Header>
            <KPI.Content>
              <KPI.Value value={summary.kiosk + summary.phone + summary.desk + addedToday} className="tabular" />
            </KPI.Content>
            <KPI.Footer>
              <span className="flex items-center gap-3 text-xs leading-4 text-muted tabular">
                <Tip tip="Kiosk">
                  <span className="flex items-center gap-1">
                    <Display className="size-3" aria-label="Kiosk" />
                    {summary.kiosk}
                  </span>
                </Tip>
                <Tip tip="Phone">
                  <span className="flex items-center gap-1">
                    <Smartphone className="size-3" aria-label="Phone" />
                    {summary.phone}
                  </span>
                </Tip>
                <Tip tip="Desk">
                  <span className="flex items-center gap-1">
                    <PencilToSquare className="size-3" aria-label="Desk" />
                    {summary.desk + addedToday}
                  </span>
                </Tip>
              </span>
            </KPI.Footer>
          </KPI>
        </KPIGroup>
      </section>

      <FarFromWork far={clockSetup.far} />

      <Tabs variant="secondary" selectedKey={tab} onSelectionChange={(k) => setTab(String(k) as View)}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Tabs.ListContainer>
            <Tabs.List aria-label="Attendance view" className="justify-start gap-1">
              <Tabs.Tab id="records" className={TAB_CLASS}>
                Records
                <Chip size="sm" variant="soft">
                  {shown.length}
                </Chip>
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="exceptions" className={TAB_CLASS}>
                Exceptions
                <Chip size="sm" variant="soft" color={openExceptions ? "warning" : "default"}>
                  {openExceptions}
                </Chip>
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="corrections" className={TAB_CLASS}>
                Corrections
                <Chip size="sm" variant="soft" color={pendingCorrections ? "warning" : "default"}>
                  {pendingCorrections}
                </Chip>
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
          {tab === "records" ? (
            <div className="flex min-w-0 flex-[1_1_320px] flex-wrap items-center justify-end gap-2">
              <SearchField
                aria-label="Search records"
                value={query}
                onChange={(v) => {
                  setQuery(v);
                  setPage(1);
                }}
                className="min-w-0 flex-[1_1_160px] sm:max-w-[220px]"
              >
                <SearchField.Group>
                  <SearchField.SearchIcon />
                  <SearchField.Input placeholder="Name or team" />
                  <SearchField.ClearButton />
                </SearchField.Group>
              </SearchField>
              <Segment
                aria-label="Show"
                size="sm"
                selectedKey={rowFilter}
                onSelectionChange={(k) => {
                  setRowFilter(String(k) as "all" | RowState);
                  setPage(1);
                }}
              >
                {ROW_FILTERS.map((f) => (
                  <Segment.Item key={f.id} id={f.id}>
                    {f.label}
                    <span className="ms-1 text-muted tabular">{countOf(f.id)}</span>
                  </Segment.Item>
                ))}
              </Segment>
            </div>
          ) : null}
        </div>

        <Tabs.Panel id="records" className="flex flex-col gap-3 pt-3">
          {absent.length > 1 ? (
            <Alert status="danger" className="flex-wrap items-center">
              <Alert.Indicator>
                <TriangleExclamation aria-hidden="true" />
              </Alert.Indicator>
              <Alert.Content className="min-w-0 flex-[1_1_220px]">
                <Alert.Title>{absent.length} rostered and not clocked in</Alert.Title>
              </Alert.Content>
              <div className="ms-auto shrink-0">
                <Button
                  size="sm"
                  variant="secondary"
                  onPress={() =>
                    setSelected(picked.length === absent.length ? new Set() : new Set(absent.map((r) => r.id)))
                  }
                >
                  <CircleCheck className="size-4" />
                  {picked.length === absent.length ? "Clear selection" : "Select all"}
                </Button>
              </div>
            </Alert>
          ) : null}
          {listed.length === 0 ? (
            <EmptyState size="sm" className="py-10">
              <EmptyState.Header>
                <EmptyState.Media variant="icon">
                  <Calendar />
                </EmptyState.Media>
                <EmptyState.Title>{shown.length ? "No one matches" : "No clock records"}</EmptyState.Title>
              </EmptyState.Header>
            </EmptyState>
          ) : (
            <Table>
              <Table.ScrollContainer>
                <Table.Content
                  aria-label={day === "today" ? "Clock records today" : "Clock records yesterday"}
                  className="min-w-[680px]"
                  selectionMode={absent.length ? "multiple" : "none"}
                  selectionBehavior="toggle"
                  selectedKeys={selected}
                  disabledKeys={listed.filter((r) => !absent.includes(r)).map((r) => r.id)}
                  disabledBehavior="selection"
                  onSelectionChange={(keys) =>
                    setSelected(keys === "all" ? new Set(absent.map((r) => r.id)) : new Set([...keys].map(String)))
                  }
                >
                  <Table.Header>
                    <Table.Column isRowHeader>Employee</Table.Column>
                    <Table.Column className="w-[30%]">Shift</Table.Column>
                    <Table.Column>In → out</Table.Column>
                    <Table.Column>Status</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {pageRows.map((r) => {
                      const canPick = r.action === "clock_in" && !!r.employeeId;
                      return (
                        <Table.Row
                          key={r.id}
                          id={r.id}
                          className={canPick ? "cursor-pointer" : "data-[disabled=true]:opacity-100"}
                        >
                          <Table.Cell className="py-2.5">
                            <span className="flex items-center gap-2">
                              {absent.length ? (
                                canPick ? (
                                  <Checkbox slot="selection" aria-label={`Select ${r.name}`}>
                                    <Checkbox.Control>
                                      <Checkbox.Indicator />
                                    </Checkbox.Control>
                                  </Checkbox>
                                ) : (
                                  <span className="w-4 shrink-0" aria-hidden="true" />
                                )
                              ) : null}
                              <Person name={r.name} sub={`${r.dept} · ${r.property}`} />
                            </span>
                          </Table.Cell>
                          <Table.Cell className="py-2.5">
                            <ShiftBar r={r} now={now} />
                          </Table.Cell>
                          <Table.Cell className="py-2.5">
                            <span className="flex items-center gap-2 whitespace-nowrap tabular">
                              {r.source ? (
                                <Tip tip={`${SOURCE[r.source].label}${r.sourceNote ? ` · ${r.sourceNote}` : ""}`}>
                                  <span className="flex size-7 items-center justify-center rounded-full bg-default text-muted">
                                    {SOURCE[r.source].icon}
                                  </span>
                                </Tip>
                              ) : (
                                <span className="size-7" aria-hidden="true" />
                              )}
                              <span className={r.source ? "font-semibold" : "text-muted"}>
                                {r.source ? r.clockIn : "—"}
                              </span>
                              <ArrowRight className="size-3.5 text-muted" aria-hidden="true" />
                              <span className={r.clockOut === "—" ? "text-muted" : "font-medium"}>
                                {r.clockOut.split(" · ")[0]}
                              </span>
                              {r.stale ? (
                                <Tip tip={`Still clocked in since ${r.stale.since}, ${r.stale.clockIn}`}>
                                  <TriangleExclamation
                                    className="size-4 text-warning"
                                    aria-label={`Open shift since ${r.stale.since}`}
                                  />
                                </Tip>
                              ) : null}
                            </span>
                          </Table.Cell>
                          <Table.Cell className="py-2.5">
                            <span className="flex items-center justify-between gap-2">
                              <Chip size="sm" variant="soft" color={toneColor(r.tone)} className="whitespace-nowrap">
                                {r.status}
                              </Chip>
                              {r.check || canPick || r.action === "clock_out" ? (
                                <Dropdown>
                                  <Button size="sm" variant="ghost" isIconOnly aria-label={`Actions for ${r.name}`}>
                                    <Ellipsis className="size-4" />
                                  </Button>
                                  <Dropdown.Popover placement="bottom end" className="min-w-[160px]">
                                    <Dropdown.Menu
                                      aria-label={`Actions for ${r.name}`}
                                      onAction={(key) => {
                                        if (key === "check") setChecking(r);
                                        else openClock(r, key === "in" ? "in" : "out");
                                      }}
                                    >
                                      {r.check ? (
                                        <Dropdown.Item id="check" textValue="Check">
                                          <CircleCheck className="size-4" aria-hidden="true" />
                                          <Label>Check</Label>
                                        </Dropdown.Item>
                                      ) : null}
                                      {canPick ? (
                                        <Dropdown.Item id="in" textValue="Clock in">
                                          <ArrowRightToSquare className="size-4" aria-hidden="true" />
                                          <Label>Clock in</Label>
                                        </Dropdown.Item>
                                      ) : null}
                                      {r.action === "clock_out" ? (
                                        <Dropdown.Item id="out" textValue="Clock out">
                                          <ArrowRightFromSquare className="size-4" aria-hidden="true" />
                                          <Label>Clock out</Label>
                                        </Dropdown.Item>
                                      ) : null}
                                    </Dropdown.Menu>
                                  </Dropdown.Popover>
                                </Dropdown>
                              ) : null}
                            </span>
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          )}
          <Pager page={page} total={listed.length} onPage={setPage} />
        </Tabs.Panel>

        <Tabs.Panel id="exceptions" className="pt-3">
          {exceptions.length === 0 ? (
            <EmptyState size="sm" className="py-10">
              <EmptyState.Header>
                <EmptyState.Media variant="icon">
                  <CircleCheck />
                </EmptyState.Media>
                <EmptyState.Title>No exceptions</EmptyState.Title>
              </EmptyState.Header>
            </EmptyState>
          ) : (
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
                    {x.deskEmployee && !x.resolved ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        aria-label={`Record time for ${x.title.split(" · ")[0]}`}
                        onPress={() => actOn(x)}
                      >
                        <ArrowRightToSquare className="size-4" aria-hidden="true" />
                        {x.kind === "absent" ? "Clock in" : "Desk entry"}
                      </Button>
                    ) : null}
                  </ItemCard.Action>
                </ItemCard>
              ))}
            </ItemCardGroup>
          )}
        </Tabs.Panel>

        <Tabs.Panel id="corrections" className="pt-3">
          {corrections.length === 0 ? (
            <EmptyState size="sm" className="py-10">
              <EmptyState.Header>
                <EmptyState.Media variant="icon">
                  <CircleCheckFill />
                </EmptyState.Media>
                <EmptyState.Title>No corrections</EmptyState.Title>
              </EmptyState.Header>
            </EmptyState>
          ) : (
            <div className="grid items-start gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(340px,100%),1fr))]">
              {corrections.map((c) => {
                const first = firstName(c.name);
                const isDeclining = !!declining[c.id];
                return (
                  <Card key={c.id} variant="secondary" className="gap-2.5 p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <Person name={c.name} sub={c.when} />
                      <Chip
                        size="sm"
                        variant="soft"
                        color={c.state === "pending" ? "warning" : c.state === "approved" ? "success" : "default"}
                        className="shrink-0"
                      >
                        {c.state === "pending" ? "Pending" : c.state === "approved" ? "Approved" : "Declined"}
                      </Chip>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-default px-1.5 py-0.5 text-[13px] text-muted tabular line-through">
                        {c.from}
                      </span>
                      <ArrowRight className="size-4 text-muted" aria-label="changed to" />
                      <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[13px] font-semibold text-accent-soft-foreground tabular">
                        {c.to}
                      </span>
                      <span className="ml-auto flex items-center gap-1">
                        <Tip tip={c.evidence}>
                          <Chip size="sm" variant="soft">
                            <Paperclip className="size-3" aria-hidden="true" />
                            <Chip.Label>Evidence</Chip.Label>
                          </Chip>
                        </Tip>
                        <Tip tip={c.manager}>
                          <Chip size="sm" variant="soft" color="success">
                            <CircleCheck className="size-3" aria-hidden="true" />
                            <Chip.Label>Manager</Chip.Label>
                          </Chip>
                        </Tip>
                      </span>
                    </div>
                    <p className="text-[13px] leading-[18px] text-muted">“{c.reason}”</p>
                    {c.state === "pending" ? (
                      <>
                        {isDeclining ? (
                          <TextField
                            value={declineNotes[c.id] ?? ""}
                            onChange={(v) => setDeclineNotes((n) => ({ ...n, [c.id]: v }))}
                            className="flex flex-col gap-1"
                            autoFocus
                          >
                            <Label>Why not?</Label>
                            <TextArea rows={2} placeholder={`Sent to ${first} and the line manager`} />
                          </TextField>
                        ) : null}
                        <div className="flex items-center gap-1.5">
                          <Button size="sm" isDisabled={pending} onPress={() => decide(c, "approved")}>
                            <CircleCheck className="size-4" />
                            Approve
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
                          {isDeclining ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              isIconOnly
                              aria-label="Keep it"
                              onPress={() => setDeclining((d) => ({ ...d, [c.id]: false }))}
                            >
                              <Xmark className="size-4" />
                            </Button>
                          ) : null}
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-muted">{c.outcome}</span>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </Tabs.Panel>
      </Tabs>

      <ActionBar aria-label="Clock in the selected people" isOpen={picked.length > 0}>
        <ActionBar.Prefix>
          <Chip size="sm" variant="soft" color="accent">
            {picked.length} selected
          </Chip>
        </ActionBar.Prefix>
        <ActionBar.Content>
          <Button size="sm" onPress={clockInPicked} isPending={bulkPending}>
            <ArrowRightToSquare className="size-4" />
            Clock in at shift start
          </Button>
        </ActionBar.Content>
        <ActionBar.Suffix>
          <Button
            size="sm"
            variant="ghost"
            isIconOnly
            aria-label="Clear selection"
            onPress={() => setSelected(new Set())}
          >
            <Xmark className="size-4" />
          </Button>
        </ActionBar.Suffix>
      </ActionBar>

      <ClockRulesModal isOpen={rulesOpen} onOpenChange={setRulesOpen} setup={clockSetup} />
      <CheckClockInModal row={checking} onClose={() => setChecking(null)} />

      <Modal.Backdrop isOpen={deskOpen} onOpenChange={setDeskOpen}>
        <Modal.Container size="md">
          <Modal.Dialog aria-labelledby="desk-h">
            <Modal.Header>
              <Modal.Heading id="desk-h" className="text-[18px] leading-6 font-semibold">
                Desk entry
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-3">
              <NativeSelect fullWidth className="flex flex-col gap-1">
                <Label htmlFor="de-emp">Employee</Label>
                <NativeSelect.Trigger id="de-emp" value={emp} onChange={(e) => setEmp(e.target.value)}>
                  {[
                    { label: "Needs a record", people: data.deskEmployees.filter((e) => e.due !== false) },
                    { label: "Everyone else", people: data.deskEmployees.filter((e) => e.due === false) },
                  ]
                    .filter((g) => g.people.length)
                    .map((g) => (
                      <optgroup key={g.label} label={g.label}>
                        {g.people.map((e) => (
                          <NativeSelect.Option key={e.id} value={e.id}>
                            {e.label}
                          </NativeSelect.Option>
                        ))}
                      </optgroup>
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
                  <Input fullWidth type="time" className="tabular" />
                </TextField>
                <TextField value={clockOut} onChange={setClockOut} className="flex min-w-0 flex-col gap-1">
                  <Label>Out</Label>
                  <Input fullWidth type="time" className="tabular" />
                </TextField>
              </div>
              {deskFix ? (
                <p className="text-xs leading-4 text-muted">Type the real clock-out time for this day.</p>
              ) : null}
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
                <Label className="flex items-center gap-1">
                  Justification
                  <Hint label="Who is told">
                    Recorded as Desk · {persona.name}. {firstName(employee?.name ?? "")} and their line manager are
                    notified.
                  </Hint>
                </Label>
                <TextArea rows={3} placeholder="Who confirmed the time, and how" />
                <FieldError>Required.</FieldError>
              </TextField>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" onPress={() => setDeskOpen(false)}>
                Cancel
              </Button>
              <Button onPress={save} isDisabled={pending || (deskFix && !clockOut.trim())}>
                <FloppyDisk className="size-4" />
                Save
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      <Modal.Backdrop isOpen={clocking !== null} onOpenChange={(o) => (o ? undefined : setClocking(null))}>
        <Modal.Container size="sm">
          <Modal.Dialog aria-labelledby="clock-h">
            {clocking ? (
              <>
                <Modal.Header>
                  <Person
                    size="md"
                    name={clocking.row.name}
                    sub={`${clocking.row.shift} · ${clocking.row.dept}`}
                    className="[&>span:last-child>span:first-child]:text-[16px]"
                  />
                  <Modal.Heading id="clock-h" className="sr-only">
                    Clock {clocking.kind} {clocking.row.name}
                  </Modal.Heading>
                </Modal.Header>
                <Modal.Body className="flex flex-col gap-3">
                  {clocking.kind === "in" && clocking.row.stale ? (
                    <Card variant="secondary" className="gap-2 border border-warning/40 p-3">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <TriangleExclamation className="size-4 text-warning" aria-hidden="true" />
                        Open since {clocking.row.stale.since}, {clocking.row.stale.clockIn}
                      </span>
                      <TextField value={staleOut} onChange={setStaleOut} className="flex flex-col gap-1">
                        <Label>Close it at</Label>
                        <Input type="time" />
                      </TextField>
                    </Card>
                  ) : null}
                  <TextField value={clockTime} onChange={setClockTime} className="flex flex-col gap-1">
                    <Label>
                      {clocking.kind === "in"
                        ? "Clock in at"
                        : clocking.row.day === "yesterday"
                          ? "Clock out at, yesterday"
                          : "Clock out at"}
                    </Label>
                    <Input type="time" />
                  </TextField>
                  {clocking.kind === "in" ? (
                    <>
                      <NativeSelect fullWidth className="flex flex-col gap-1">
                        <Label htmlFor="clock-why">Reason</Label>
                        <NativeSelect.Trigger
                          id="clock-why"
                          value={clockReason}
                          onChange={(e) => setClockReason(e.target.value)}
                        >
                          {DESK_REASONS.map((r) => (
                            <NativeSelect.Option key={r} value={r}>
                              {r}
                            </NativeSelect.Option>
                          ))}
                          <NativeSelect.Indicator />
                        </NativeSelect.Trigger>
                      </NativeSelect>
                      <TextField value={clockNote} onChange={setClockNote} className="flex flex-col gap-1">
                        <Label>Note</Label>
                        <Input placeholder="Optional" />
                      </TextField>
                    </>
                  ) : null}
                </Modal.Body>
                <Modal.Footer>
                  <Button variant="ghost" onPress={() => setClocking(null)}>
                    Cancel
                  </Button>
                  <Button onPress={submitClock} isPending={clockPending}>
                    {clocking.kind === "in" ? (
                      <ArrowRightToSquare className="size-4" />
                    ) : (
                      <ArrowRightFromSquare className="size-4" />
                    )}
                    {clocking.kind === "in" && clocking.row.stale ? "Close and clock in" : `Clock ${clocking.kind}`}
                  </Button>
                </Modal.Footer>
              </>
            ) : null}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
      <Toast.Provider placement="bottom" />
    </PageContent>
  );
}
