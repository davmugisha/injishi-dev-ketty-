"use client";

import { ArrowsRotateRight, BellDot, Clock, LayoutCells, ListCheck, Plus, Wrench } from "@gravity-ui/icons";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Chip,
  Input,
  Label,
  NumberField,
  ProgressBar,
  TextField,
  Toast,
  ToggleButton,
} from "@heroui/react";
import { Kanban, ListView, Segment, Stepper } from "@heroui-pro/react";
import { type Persona, screenHref } from "@injishi/data";
import type {
  CleaningTask,
  HousekeepingEscalation,
  HousekeepingRoom,
  HousekeepingRule,
  HousekeepingStaff,
  RoomHistory,
  RoomStatus,
  RoomStatusHistory,
  TaskColumn,
  Tone,
} from "@injishi/data/fixtures/operations";
import { GateChip, Icon, LinkButton, PageContent, PageHeader, SectionHeader, toneColor } from "@injishi/ui";
import { type CSSProperties, useState, useTransition } from "react";
import {
  addCleaningTaskAction,
  assignCleaningTaskAction,
  inspectCleaningTaskAction,
  remindEscalationAction,
} from "./actions";
import {
  FieldLabel,
  FooterHint,
  FormDialog,
  firstKey,
  HistoryTimeline,
  kigaliClock,
  kigaliLongDate,
  pressKey,
  reported,
  SelectField,
  useKigaliNow,
} from "./shared";

export interface HousekeepingData {
  rooms: HousekeepingRoom[];
  roomHistory: RoomHistory[];
  statusHistory: RoomStatusHistory[];
  tasks: CleaningTask[];
  staff: HousekeepingStaff[];
  escalations: HousekeepingEscalation[];
  rules: HousekeepingRule[];
}

type View = "tasks" | "rooms";

const STATUS: Record<RoomStatus, { label: string; hint: string; tone: Tone; context: string }> = {
  inspected: {
    label: "Inspected",
    hint: "Ready to assign",
    tone: "success",
    context: "Vacant and inspected. The front desk can assign it now.",
  },
  clean: {
    label: "Clean",
    hint: "Awaiting inspection",
    tone: "accent",
    context: "Cleaned and waiting for a supervisor. Not yet offered to arrivals.",
  },
  dirty: { label: "Dirty", hint: "Needs cleaning", tone: "warning", context: "Needs cleaning before inspection." },
  occupied: {
    label: "Occupied",
    hint: "Guest in house",
    tone: "default",
    context: "Guest in house. Stayover service follows the guest’s do-not-disturb setting.",
  },
  ooo: {
    label: "Out of order",
    hint: "Blocked by maintenance",
    tone: "danger",
    context: "Removed from sale on every channel until the work order is closed and the room is inspected.",
  },
};
const STATUS_ORDER: RoomStatus[] = ["inspected", "clean", "dirty", "occupied", "ooo"];

/** Room tile surface per status (artifact .ij-room[data-status]): background colour + ring/pattern. */
const TILE_BG: Record<RoomStatus, string> = {
  inspected: "color-mix(in oklab, var(--success) 10%, var(--surface))",
  clean: "var(--surface)",
  dirty: "var(--surface)",
  occupied: "var(--surface-secondary)",
  ooo: "var(--surface-secondary)",
};
const TILE_DECOR: Record<RoomStatus, string> = {
  inspected: "shadow-surface",
  clean: "shadow-[inset_0_0_0_1.5px_color-mix(in_oklab,var(--success)_60%,transparent),var(--surface-shadow)]",
  dirty: "shadow-[inset_0_0_0_1.5px_color-mix(in_oklab,var(--warning)_75%,transparent),var(--surface-shadow)]",
  occupied: "shadow-none",
  ooo: "bg-[repeating-linear-gradient(135deg,var(--surface-secondary)_0_6px,var(--surface-tertiary)_6px_12px)] shadow-none",
};
/** ToggleButton colour tokens so a room keeps its status colour when hovered or selected. */
const tileVars = (s: RoomStatus): CSSProperties => {
  const bg = TILE_BG[s];
  const hover = `color-mix(in oklab, ${bg}, var(--foreground) 5%)`;
  return {
    "--toggle-button-bg": bg,
    "--toggle-button-bg-hover": hover,
    "--toggle-button-bg-pressed": hover,
    "--toggle-button-bg-selected": bg,
    "--toggle-button-bg-selected-hover": hover,
    "--toggle-button-bg-selected-pressed": hover,
    "--toggle-button-fg": "var(--foreground)",
    "--toggle-button-fg-selected": "var(--foreground)",
  } as CSSProperties;
};
const TYPE_SHORT: Record<HousekeepingRoom["type"], string> = {
  "Standard Queen": "Queen",
  Twin: "Twin",
  "Deluxe Lake View": "Deluxe",
  "Family Suite": "Suite",
};
const KIND_TONE: Record<CleaningTask["kind"], Tone> = {
  Checkout: "accent",
  Stayover: "default",
  "Deep clean": "info",
  Turndown: "default",
  "Re-clean": "warning",
};
const COLUMNS: { id: TaskColumn; title: string; indicator: string }[] = [
  { id: "todo", title: "To do", indicator: "bg-warning" },
  { id: "doing", title: "In progress", indicator: "bg-accent" },
  { id: "clean", title: "Clean · awaiting inspection", indicator: "bg-success/55" },
  { id: "insp", title: "Inspected", indicator: "bg-success" },
];
const GATE = ["Dirty", "Clean", "Inspected", "Ready to assign"];
/** Task types a manager can add by hand, with their usual duration in minutes. */
const NEW_TASK_KINDS: { kind: CleaningTask["kind"]; minutes: number }[] = [
  { kind: "Checkout", minutes: 45 },
  { kind: "Stayover", minutes: 20 },
  { kind: "Deep clean", minutes: 90 },
  { kind: "Turndown", minutes: 15 },
];

const shortName = (name: string) => {
  const [first, last] = name.split(" ");
  return last ? `${first} ${last[0]}.` : first;
};

export function HousekeepingBoardView({
  // The board acts as the signed-in person through the API, which stamps who did what.
  persona: _persona,
  initialView,
  data,
}: {
  persona: Persona;
  initialView: View;
  data: HousekeepingData;
}) {
  const housekeepers = data.staff.filter((p) => p.role === "housekeeper");
  const supervisor = data.staff.find((p) => p.role === "supervisor");
  const nameOf = (id: string | null) => data.staff.find((p) => p.id === id)?.name ?? "";
  const reassignEsc = data.escalations.find((e) => e.action === "reassign");
  const remindEsc = data.escalations.find((e) => e.action === "remind");

  const [view, setViewState] = useState<View>(initialView);
  const [roomId, setRoomId] = useState(
    reassignEsc ? (data.tasks.find((t) => t.id === reassignEsc.task)?.room ?? "") : "",
  );
  const [taskId, setTaskId] = useState(reassignEsc?.task ?? data.tasks[0]?.id ?? "");
  // A reminder already sent reads as done (the API keeps it; the button stays disabled).
  const [reminded, setReminded] = useState(Boolean(remindEsc?.doneCta && remindEsc.cta === remindEsc.doneCta));
  const [pending, startTransition] = useTransition();
  const [addOpen, setAddOpen] = useState(false);
  const [newRoom, setNewRoom] = useState("");
  const [newKind, setNewKind] = useState<CleaningTask["kind"]>("Checkout");
  const [newAssignee, setNewAssignee] = useState("none");
  const [newDue, setNewDue] = useState("By 15:00");
  const [newMinutes, setNewMinutes] = useState(45);
  // Failing an inspection asks what was not right: the re-clean carries the reason.
  const [failTask, setFailTask] = useState<CleaningTask | null>(null);
  const [failReason, setFailReason] = useState("");
  const now = useKigaliNow();

  const setView = (v: View) => {
    setViewState(v);
    const url = new URL(window.location.href);
    url.searchParams.set("view", v);
    window.history.replaceState(null, "", url);
  };

  // Tasks and rooms are the business's record (GET /ops/housekeeping/board): every decision on this
  // screen is a command to the API, and the board re-reads afterwards.
  const tasks: CleaningTask[] = data.tasks;
  const rooms = data.rooms;
  const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, rooms.filter((r) => r.status === s).length])) as Record<
    RoomStatus,
    number
  >;
  const floors = [...new Set(rooms.map((r) => r.floor))].map((floor) => {
    const list = rooms.filter((r) => r.floor === floor);
    const c = (s: RoomStatus) => list.filter((r) => r.status === s).length;
    return {
      floor,
      rooms: list,
      summary: `${c("inspected")} ready · ${c("clean")} clean · ${c("dirty")} dirty · ${c("occupied")} occupied${c("ooo") ? ` · ${c("ooo")} out of order` : ""}`,
    };
  });

  const task = tasks.find((t) => t.id === taskId) ?? tasks[0];
  const room = rooms.find((r) => r.id === roomId) ?? rooms[0];
  const roomTask = room ? tasks.find((t) => t.room === room.id && t.column !== "insp") : undefined;
  const roomEvents = room
    ? data.roomHistory.find((h) => h.id === room.id)?.events ||
      data.statusHistory.find((h) => h.id === room.status)?.events ||
      []
    : [];

  const workload = housekeepers.map((p) => {
    const mine = tasks.filter((t) => t.assignee === p.id && (t.column === "todo" || t.column === "doing"));
    const load = mine.reduce((a, t) => a + (t.minutes ?? 0), 0);
    // A shift that has ended leaves no minutes: any open work is over by all of it.
    const pct = p.minutesLeft > 0 ? Math.min(100, Math.round((load / p.minutesLeft) * 100)) : load > 0 ? 100 : 0;
    const over = load - p.minutesLeft;
    return {
      ...p,
      open: mine.length,
      load,
      pct,
      fit: over > 0 ? `Over by ${over} min` : `${p.minutesLeft - load} min free`,
      color: (over > 0 ? "danger" : pct > 80 ? "warning" : "accent") as "danger" | "warning" | "accent",
      isCurrent: task?.assignee === p.id,
    };
  });
  const waiting = tasks.filter((t) => t.column === "clean");
  const oldest = waiting.find((t) => t.priority === "Overdue");
  const oldestWait = oldest?.due.split("waiting ")[1];
  const inspQueue = `${waiting.length} inspections waiting${oldest && oldestWait ? ` · oldest ${oldestWait} min (${oldest.room})` : ""}${reminded ? ` · reminded${now ? ` ${kigaliClock(now)}` : ""}` : ""}`;

  const act = (run: () => Promise<{ ok: true } | { ok: false; error: string }>, then?: () => void) =>
    startTransition(async () => {
      if (reported(await run())) then?.();
    });

  const escalations = [
    reassignEsc && tasks.some((t) => t.id === reassignEsc.task && t.column === "todo")
      ? {
          ...reassignEsc,
          label: reassignEsc.cta,
          disabled: false,
          act: () => {
            const target = tasks.find((t) => t.id === reassignEsc.task);
            setView("tasks");
            setTaskId(reassignEsc.task);
            if (target) setRoomId(target.room);
          },
        }
      : null,
    remindEsc
      ? {
          ...remindEsc,
          label: reminded ? (remindEsc.doneCta ?? remindEsc.cta) : remindEsc.cta,
          disabled: reminded || pending,
          act: () =>
            act(
              () => remindEscalationAction(remindEsc.id),
              () => setReminded(true),
            ),
        }
      : null,
  ].filter((e) => e !== null);

  const selectTask = (id: string) => {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    setTaskId(t.id);
    setRoomId(t.room);
  };

  const openAdd = () => {
    const r = room ?? rooms[0];
    const kind: CleaningTask["kind"] =
      r?.status === "occupied" ? "Stayover" : r?.status === "dirty" ? "Checkout" : "Deep clean";
    setNewRoom(r?.id ?? "");
    setNewKind(kind);
    setNewMinutes(NEW_TASK_KINDS.find((k) => k.kind === kind)?.minutes ?? 30);
    setNewAssignee(housekeepers.find((p) => r && p.area.includes(`Floor ${r.floor}`))?.id ?? "none");
    setNewDue("By 15:00");
    setAddOpen(true);
  };
  const addTask = () => {
    if (!newRoom || !newDue.trim() || newKind === "Re-clean") return;
    const key = pressKey();
    const kind = newKind;
    startTransition(async () => {
      const result = await addCleaningTaskAction(
        {
          room: newRoom,
          kind,
          assignee: newAssignee === "none" ? null : newAssignee,
          due: newDue.trim(),
          minutes: Number.isFinite(newMinutes) ? newMinutes : undefined,
        },
        key,
      );
      if (!reported(result)) return;
      setAddOpen(false);
      setView("tasks");
      if (result.ok) setTaskId(result.value);
      setRoomId(newRoom);
    });
  };
  const failInspection = () => {
    const t = failTask;
    const reason = failReason.trim();
    if (!t || !reason) return;
    act(
      () => inspectCleaningTaskAction(t.id, "fail", reason),
      () => {
        setFailTask(null);
        setFailReason("");
        setRoomId(t.room);
      },
    );
  };
  const newLoad = workload.find((p) => p.id === newAssignee);

  return (
    <PageContent>
      <PageHeader
        eyebrow={
          now ? `${kigaliLongDate(now)} · ${kigaliClock(now)} · Isangano Lakeside Hotel` : "Isangano Lakeside Hotel"
        }
        title="Housekeeping"
        description="Room status and cleaning tasks. A room is offered to arrivals only after it passes inspection."
        actions={
          <>
            <Segment aria-label="View" selectedKey={view} onSelectionChange={(k) => setView(k as View)}>
              <Segment.Item id="rooms">
                <LayoutCells className="size-4" />
                Rooms
              </Segment.Item>
              <Segment.Item id="tasks">
                <ListCheck className="size-4" />
                Tasks
              </Segment.Item>
            </Segment>
            <LinkButton href={screenHref("RoomRack")} variant="secondary">
              <LayoutCells className="size-4" />
              Room rack
            </LinkButton>
            <Button onPress={openAdd}>
              <Plus className="size-4" />
              Add task
            </Button>
          </>
        }
      />

      {escalations.length ? (
        <Alert status="danger" role="alert">
          <Alert.Indicator>
            <BellDot />
          </Alert.Indicator>
          <Alert.Content className="flex-1">
            <Alert.Title>
              {escalations.length === 1 ? "1 task escalated to you" : `${escalations.length} tasks escalated to you`}
            </Alert.Title>
            {escalations.map((e) => (
              <Alert.Description key={e.id}>{e.text}</Alert.Description>
            ))}
            <div className="mt-2.5 flex flex-wrap gap-2">
              {escalations.map((e) => (
                <Button key={e.id} size="sm" variant="secondary" isDisabled={e.disabled} onPress={e.act}>
                  {e.label}
                </Button>
              ))}
            </div>
          </Alert.Content>
          <span className="hidden text-[12px] text-muted md:block">Overdue 15 min → supervisor · 30 min → manager</span>
        </Alert>
      ) : null}

      <section
        aria-label="Room status counts"
        className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(170px,100%),1fr))]"
      >
        {STATUS_ORDER.map((s) => (
          <Card key={s} variant="secondary" className="flex-row items-center gap-2 px-3 py-2.5">
            <span
              aria-hidden="true"
              className={`size-[22px] shrink-0 rounded-[7px] ${TILE_DECOR[s]}`}
              style={{ backgroundColor: TILE_BG[s] }}
            />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[13px] font-medium">{STATUS[s].label}</span>
              <span className="text-[11px] leading-[14px] text-muted">{STATUS[s].hint}</span>
            </span>
            <span className="text-xl font-semibold tabular">{counts[s]}</span>
          </Card>
        ))}
      </section>

      {view === "rooms" ? (
        <div className="grid grid-cols-1 items-start gap-[16px] lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-w-0 flex-col gap-[16px]">
            {floors.map((f) => (
              <section key={f.floor} className="flex flex-col gap-2" aria-label={`Floor ${f.floor}`}>
                <SectionHeader
                  title={`Floor ${f.floor}`}
                  action={<span className="text-[12px] text-muted">{f.summary}</span>}
                  className="items-center"
                />
                <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(min(76px,100%),1fr))]">
                  {f.rooms.map((r) => (
                    <ToggleButton
                      key={r.id}
                      aria-label={`Room ${r.id}, ${STATUS[r.status].label}, ${r.note}`}
                      isSelected={room?.id === r.id}
                      onChange={() => setRoomId(r.id)}
                      style={tileVars(r.status)}
                      className={`h-auto w-full min-w-0 flex-col items-start justify-start gap-0.5 rounded-[14px] px-3 py-2.5 text-left font-normal whitespace-normal data-[selected=true]:outline-2 data-[selected=true]:outline-offset-2 data-[selected=true]:outline-solid data-[selected=true]:outline-accent ${TILE_DECOR[r.status]}`}
                    >
                      <span className="text-[15px] font-semibold tabular">{r.id}</span>
                      <span className="text-[11px] leading-[14px] text-muted">{TYPE_SHORT[r.type]}</span>
                      <span className="text-[11px] leading-[14px] font-medium">{r.note}</span>
                    </ToggleButton>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {room ? (
            <Card aria-labelledby="room-h" className="gap-3.5 p-[18px] lg:sticky lg:top-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <h2 id="room-h" className="text-xl leading-[26px] font-semibold tabular">
                    Room {room.id}
                  </h2>
                  <span className="text-[13px] text-muted">
                    {room.type} · Floor {room.floor}
                  </span>
                </div>
                <Chip size="sm" variant="soft" color={toneColor(STATUS[room.status].tone)}>
                  {STATUS[room.status].label}
                  {room.note ? ` · ${room.note}` : ""}
                </Chip>
              </div>
              <p className="text-[13px] leading-[18px]">
                {room.hold && room.status === "dirty" ? `${room.hold} ` : ""}
                {STATUS[room.status].context}
              </p>
              <div className="flex flex-col gap-2">
                <FieldLabel>Status history</FieldLabel>
                <HistoryTimeline events={roomEvents} label={`Room ${room.id} status history`} />
              </div>
              {roomTask ? (
                <Button
                  variant="secondary"
                  onPress={() => {
                    setTaskId(roomTask.id);
                    setView("tasks");
                  }}
                >
                  <ListCheck className="size-4" />
                  Open task and assignment
                </Button>
              ) : null}
              {room.status === "ooo" ? (
                <LinkButton href={screenHref("Maintenance")} variant="secondary">
                  <Wrench className="size-4" />
                  Open work order
                </LinkButton>
              ) : null}
              <p className="text-[12px] leading-4 text-muted">
                Housekeeping staff see room status and tasks only, never guest payments.
              </p>
            </Card>
          ) : null}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 items-start gap-[16px] lg:grid-cols-[minmax(0,1fr)_300px]">
            <section aria-label="Task board" className="min-w-0">
              <Kanban
                size="sm"
                className="gap-2.5"
                style={{ "--kanban-column-min-width": "188px", "--kanban-column-gap": "10px" } as CSSProperties}
              >
                {COLUMNS.map((col) => {
                  const cards = tasks.filter((t) => t.column === col.id);
                  return (
                    <Kanban.Column key={col.id}>
                      <Kanban.ColumnHeader>
                        <Kanban.ColumnIndicator className={col.indicator} />
                        <Kanban.ColumnTitle>{col.title}</Kanban.ColumnTitle>
                        <Kanban.ColumnCount>{cards.length}</Kanban.ColumnCount>
                      </Kanban.ColumnHeader>
                      <Kanban.ColumnBody>
                        <Kanban.CardList
                          aria-label={col.title}
                          items={cards}
                          selectionMode="single"
                          selectedKeys={new Set([taskId])}
                          onSelectionChange={(keys) => {
                            const k = firstKey(keys);
                            if (k) selectTask(k);
                          }}
                          renderEmptyState={() => "No tasks"}
                        >
                          {(t) => (
                            <Kanban.Card
                              className="[&[data-selected=true]_[data-slot=kanban-card-content]]:ring-2 [&[data-selected=true]_[data-slot=kanban-card-content]]:ring-accent"
                              id={t.id}
                              textValue={`Room ${t.room}, ${t.kind}, ${t.assignee ? nameOf(t.assignee) : "unassigned"}, ${t.due}${t.auto ? ", created by a rule" : ""}`}
                            >
                              <span className="flex w-full items-center gap-1.5">
                                <span className="text-[14px] font-semibold tabular">{t.room}</span>
                                <Chip size="sm" variant="soft" color={toneColor(KIND_TONE[t.kind])}>
                                  {t.kind}
                                </Chip>
                                <span className="flex-1" />
                                {t.priority ? (
                                  <Chip size="sm" variant="soft" color={toneColor(t.priorityTone ?? "default")}>
                                    {t.priority}
                                  </Chip>
                                ) : null}
                              </span>
                              <span className="flex w-full items-start gap-1 text-[11px] leading-[14px]">
                                <span className="min-w-0 flex-1">
                                  {t.assignee ? (
                                    <span className="font-medium">{shortName(nameOf(t.assignee))}</span>
                                  ) : (
                                    <Chip size="sm" variant="soft" color="warning" className="font-medium">
                                      Unassigned
                                    </Chip>
                                  )}
                                  <span className="text-muted"> · {t.due}</span>
                                </span>
                                {t.auto ? (
                                  <ArrowsRotateRight
                                    className="size-3 shrink-0 text-muted"
                                    aria-label="Created by a rule"
                                  />
                                ) : null}
                              </span>
                              {col.id === "clean" ? (
                                <span className="mt-0.5 flex gap-1.5">
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    className="flex-1"
                                    aria-label={`Pass inspection of room ${t.room}`}
                                    isDisabled={pending}
                                    onPress={() => act(() => inspectCleaningTaskAction(t.id, "pass"))}
                                  >
                                    Pass
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    aria-label={`Fail inspection of room ${t.room}`}
                                    isDisabled={pending}
                                    onPress={() => {
                                      selectTask(t.id);
                                      setFailReason("");
                                      setFailTask(t);
                                    }}
                                  >
                                    Fail
                                  </Button>
                                </span>
                              ) : null}
                            </Kanban.Card>
                          )}
                        </Kanban.CardList>
                      </Kanban.ColumnBody>
                    </Kanban.Column>
                  );
                })}
              </Kanban>
            </section>

            {task ? (
              <Card aria-labelledby="as-h" className="gap-3 p-4">
                <div className="flex flex-col gap-0.5">
                  <h2 id="as-h" className="text-[15px] leading-[22px] font-semibold">
                    Assign Room {task.room}
                  </h2>
                  <span className="text-[12px] text-muted">
                    {task.kind} · {task.due}
                  </span>
                </div>
                {!task.assignee ? (
                  <span className="self-start">
                    <GateChip icon={<Clock className="size-3" />}>Unassigned</GateChip>
                  </span>
                ) : null}
                {workload.map((p) => (
                  <Card key={p.id} variant="secondary" className="gap-2 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Avatar size="sm" variant="soft" color={toneColor(p.tone)}>
                        <Avatar.Fallback>{p.initials}</Avatar.Fallback>
                      </Avatar>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-[13px] font-medium">{p.name}</span>
                        <span className="text-[11px] leading-[14px] text-muted">
                          {p.area} · until {p.shiftEnd}
                        </span>
                      </span>
                      {p.isCurrent ? (
                        <Chip size="sm" variant="soft">
                          Assigned
                        </Chip>
                      ) : task.column !== "insp" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          aria-label={`Assign room ${task.room} to ${p.name}`}
                          isDisabled={pending}
                          onPress={() => act(() => assignCleaningTaskAction(task.id, p.id))}
                        >
                          Assign
                        </Button>
                      ) : null}
                    </div>
                    <ProgressBar
                      value={p.pct}
                      size="sm"
                      color={p.color}
                      aria-label={`${p.name} workload`}
                      valueLabel={p.fit}
                      className="gap-1"
                    >
                      <span className="text-[11px] font-medium">
                        {p.open} open · {p.load} min
                      </span>
                      <ProgressBar.Output className="text-[11px]" />
                      <ProgressBar.Track>
                        <ProgressBar.Fill />
                      </ProgressBar.Track>
                    </ProgressBar>
                  </Card>
                ))}
                {supervisor ? (
                  <div className="flex items-center gap-2 text-[12px]">
                    <Avatar size="sm" variant="soft" color="accent">
                      <Avatar.Fallback>{supervisor.initials}</Avatar.Fallback>
                    </Avatar>
                    <span className="flex flex-col">
                      <span className="font-medium">{supervisor.name} · supervisor</span>
                      <span className="text-muted" role="status">
                        {inspQueue}
                      </span>
                    </span>
                  </div>
                ) : null}
              </Card>
            ) : null}
          </div>

          <div className="grid items-start gap-[16px] [grid-template-columns:repeat(auto-fit,minmax(min(380px,100%),1fr))]">
            <Card aria-labelledby="auto-h" className="gap-3 p-[18px]">
              <Card.Header>
                <Card.Title id="auto-h" className="text-[15px] font-semibold">
                  How Tasks Are Created
                </Card.Title>
                <Card.Description>Cards marked with the rule icon were created automatically</Card.Description>
              </Card.Header>
              <Card.Content className="flex flex-col gap-3">
                <ListView variant="secondary" aria-label="Task rules" items={data.rules}>
                  {(r) => (
                    <ListView.Item id={r.id} textValue={r.kind}>
                      <ListView.ItemContent>
                        <Icon name={r.icon} className="size-4 shrink-0 text-muted" />
                        <div className="flex min-w-0 flex-col">
                          <ListView.Title className="text-[13px]">{r.kind}</ListView.Title>
                          <ListView.Description>{r.when}</ListView.Description>
                        </div>
                      </ListView.ItemContent>
                    </ListView.Item>
                  )}
                </ListView>
                <LinkButton href={screenHref("SettingsPolicies")} size="sm" variant="ghost" className="self-start">
                  Edit rules in Policies &amp; settings
                </LinkButton>
              </Card.Content>
            </Card>

            <Card aria-labelledby="gate-h" className="gap-3 p-[18px]">
              <Card.Header>
                <Card.Title id="gate-h" className="text-[15px] font-semibold">
                  Inspection Gate
                </Card.Title>
                <Card.Description>Required for every checkout at Isangano Lakeside Hotel</Card.Description>
              </Card.Header>
              <Card.Content className="flex flex-col gap-3">
                <Stepper size="sm" currentStep={2} aria-label="Room readiness">
                  {GATE.map((label, i) => (
                    <Stepper.Step key={label}>
                      <Stepper.Indicator>{i + 1}</Stepper.Indicator>
                      <Stepper.Content>
                        <Stepper.Title>{label}</Stepper.Title>
                      </Stepper.Content>
                      <Stepper.Separator />
                    </Stepper.Step>
                  ))}
                </Stepper>
                <p className="text-[13px] leading-[18px]">
                  Marking a room clean does not make it ready. It waits as Clean until a supervisor passes inspection;
                  only then can the front desk assign it to an arriving guest. A failed inspection sends the task back
                  to To do with the reason.
                </p>
                <p className="text-[12px] leading-4 text-muted">
                  Assigning a room before inspection needs a manager override with a reason, and is logged. Every status
                  change records who, when and why.
                </p>
              </Card.Content>
            </Card>
          </div>
        </>
      )}
      <FormDialog
        isOpen={addOpen}
        onOpenChange={setAddOpen}
        title="Add a cleaning task"
        description="For work the rules do not create on their own. The card is marked as added by hand."
        footer={
          <>
            <FooterHint>
              {newLoad
                ? `${newLoad.name}: ${newLoad.open} open · ${newLoad.load} min · ${newLoad.fit}`
                : "Unassigned tasks show on the board until a supervisor assigns them."}
            </FooterHint>
            <Button variant="secondary" onPress={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button isDisabled={!newRoom || !newDue.trim() || pending} onPress={addTask}>
              Add task
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SelectField
            label="Room"
            value={newRoom}
            options={rooms.map((r) => ({
              id: r.id,
              label: `${r.id} · ${TYPE_SHORT[r.type]} · ${STATUS[r.status].label}`,
            }))}
            onChange={setNewRoom}
          />
          <SelectField
            label="Task"
            value={newKind}
            options={NEW_TASK_KINDS.map((k) => k.kind)}
            onChange={(v) => {
              const k = NEW_TASK_KINDS.find((x) => x.kind === v);
              if (!k) return;
              setNewKind(k.kind);
              setNewMinutes(k.minutes);
            }}
          />
        </div>
        <SelectField
          label="Assign to"
          value={newAssignee}
          options={[
            ...workload.map((p) => ({ id: p.id, label: `${p.name} · ${p.area} · ${p.fit}` })),
            { id: "none", label: "Leave unassigned" },
          ]}
          onChange={setNewAssignee}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField fullWidth value={newDue} onChange={setNewDue} isRequired className="gap-1">
            <Label>Due</Label>
            <Input placeholder="By 15:00" />
          </TextField>
          <NumberField fullWidth value={newMinutes} onChange={setNewMinutes} minValue={5} className="gap-1">
            <Label>Minutes</Label>
            <NumberField.Group>
              <NumberField.DecrementButton />
              <NumberField.Input className="tabular" />
              <NumberField.IncrementButton />
            </NumberField.Group>
          </NumberField>
        </div>
      </FormDialog>
      <FormDialog
        isOpen={failTask !== null}
        onOpenChange={(open) => {
          if (!open) setFailTask(null);
        }}
        title={failTask ? `Fail inspection of room ${failTask.room}` : "Fail inspection"}
        description="The room goes back to To do as a re-clean for the same person, with your reason."
        footer={
          <>
            <Button variant="secondary" onPress={() => setFailTask(null)}>
              Cancel
            </Button>
            <Button isDisabled={!failReason.trim() || pending} onPress={failInspection}>
              Fail inspection
            </Button>
          </>
        }
      >
        <TextField fullWidth value={failReason} onChange={setFailReason} isRequired className="gap-1">
          <Label>What was not right</Label>
          <Input placeholder="Bathroom not finished" />
        </TextField>
      </FormDialog>
      <Toast.Provider placement="bottom" />
    </PageContent>
  );
}
