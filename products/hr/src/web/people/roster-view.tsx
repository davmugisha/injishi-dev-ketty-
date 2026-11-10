"use client";

import {
  ArrowRightArrowLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  Clock,
  Flag,
  Moon,
  PaperPlane,
  Pencil,
  PersonPlus,
  Persons,
  Plus,
  ShieldExclamation,
  Suitcase,
  Sun,
  TriangleExclamation,
} from "@gravity-ui/icons";
import {
  Avatar,
  Button,
  Card,
  Chip,
  Label,
  Modal,
  Popover,
  ProgressBar,
  Table,
  Tabs,
  Toast,
  toast,
} from "@heroui/react";
import { EmptyState, KPIGroup, NativeSelect, Segment } from "@heroui-pro/react";
import { KPI } from "@heroui-pro/react/kpi";
import { GateChip, LinkButton, PageContent, PageHeader } from "@injishi/ui";
import { Fragment, type ReactNode, type SVGProps, useState, useTransition } from "react";
import type {
  PublicHoliday,
  RosterGroup,
  RosterStaff,
  RosterWeek,
  Rotation,
  ShiftCode,
  ShiftSwap,
  WeekId,
} from "../../model/people.ts";
import { useBoardHref, useHrActions, useHrShell } from "../mount.tsx";
import { CoverDrawer } from "./cover-drawer";
import { addDays, dayOfMonth, longDay, shortDay, weekdayIndex, weekdayShort } from "./days";
import { NewRotationDrawer } from "./new-rotation-drawer";
import { avatarColor, firstName, Hint, initials, PanelCard, Person, Ring, TAB_CLASS, Tip } from "./parts";
import { RosterCover } from "./roster-cover";
import { RotationDrawer } from "./rotation-drawer";

export interface RosterData {
  groups: RosterGroup[];
  staff: RosterStaff[];
  weeks: RosterWeek[];
  swaps: ShiftSwap[];
  rotations: Rotation[];
  holidays: PublicHoliday[];
}

type Grid = Record<string, ShiftCode[]>;

/** A sun half under the horizon: the evening shift. */
function Sunset(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M4.5 10.5a3.5 3.5 0 0 1 7 0" />
      <path d="M1.5 10.5h13M4.5 13h7" />
      <path d="M8 3v2M3.4 5l1.2 1.2M12.6 5l-1.2 1.2" />
    </svg>
  );
}

/**
 * Each shift's look: a solid pill in the theme colours with light text on it, strong enough to read
 * for everyone, so a week's pattern shows at a glance. A day off is left empty.
 */
const SHIFT: Record<ShiftCode, { time: string; name: string; icon: (cls: string) => ReactNode; pill: string }> = {
  M: {
    time: "Morning",
    name: "Morning",
    icon: (c) => <Sun className={c} aria-hidden="true" />,
    pill: "bg-accent! text-accent-foreground!",
  },
  E: {
    time: "Evening",
    name: "Evening",
    icon: (c) => <Sunset className={c} />,
    pill: "bg-[var(--chart-4)]! text-[var(--eclipse)]!",
  },
  N: {
    time: "Night",
    name: "Night",
    icon: (c) => <Moon className={c} aria-hidden="true" />,
    pill: "bg-foreground! text-background!",
  },
  O: {
    time: "Off",
    name: "Day off",
    icon: () => null,
    pill: "",
  },
  L: {
    time: "Leave",
    name: "On leave",
    icon: (c) => <Suitcase className={c} aria-hidden="true" />,
    pill: "bg-warning! text-warning-foreground!",
  },
};
const LEGEND: { code: ShiftCode; label: string }[] = [
  { code: "M", label: "Morning" },
  { code: "E", label: "Evening" },
  { code: "N", label: "Night" },
  { code: "O", label: "Off" },
  { code: "L", label: "Leave" },
];
const MAX_WEEK_HOURS = 45;
const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);
const KPI_CLASS = "min-w-[min(170px,100%)] flex-[1_1_170px]";

/**
 * A gap's Assign button: choose the shift, then who takes it. It opens on the counted shift with the
 * fewest people that day. A shift the rule does not count can still be given, and says the gap stays open.
 */
function GapAssign({
  group,
  dayLabel,
  free,
  hoursOf,
  onShift,
  onAssign,
}: {
  group: RosterGroup;
  dayLabel: string;
  free: { id: string; name: string; after: number }[];
  /** A shift's real hours at this branch. */
  hoursOf: (shift: ShiftCode) => string;
  /** How many of the department are on a shift that day. */
  onShift: (shift: ShiftCode) => number;
  onAssign: (employeeId: string, shift: ShiftCode) => void;
}) {
  const fewest = () => [...group.shifts].sort((a, b) => onShift(a) - onShift(b))[0] ?? "M";
  const [open, setOpen] = useState(false);
  const [shift, setShift] = useState<ShiftCode>(fewest);
  return (
    <Popover
      isOpen={open}
      onOpenChange={(o) => {
        if (o) setShift(fewest());
        setOpen(o);
      }}
    >
      <Button size="sm" variant="secondary" aria-label={`Assign someone to ${dayLabel}, ${group.name}`}>
        <PersonPlus className="size-4" />
        Assign
        <ChevronDown className="size-3.5" aria-hidden="true" />
      </Button>
      <Popover.Content placement="bottom end" className="w-[290px] p-0">
        <Popover.Dialog aria-label={`Assign someone to ${dayLabel}, ${group.name}`} className="flex flex-col gap-3 p-3">
          <fieldset className="m-0 grid grid-cols-3 gap-1.5 border-0 p-0">
            <legend className="sr-only">Shift</legend>
            {(["M", "E", "N"] as ShiftCode[]).map((k) => (
              <Button
                key={k}
                size="sm"
                variant={shift === k ? "primary" : "secondary"}
                aria-pressed={shift === k}
                fullWidth
                className="h-auto flex-col gap-0.5 px-1 py-2"
                onPress={() => setShift(k)}
              >
                <span className="flex items-center gap-1">
                  {SHIFT[k].icon("size-3.5")}
                  {SHIFT[k].name}
                </span>
                <span className="text-[11px] font-normal opacity-80 tabular">
                  {hoursOf(k)} · {onShift(k)} on
                </span>
              </Button>
            ))}
          </fieldset>
          {group.shifts.includes(shift) ? null : (
            <p className="flex items-start gap-1.5 text-xs text-warning">
              <TriangleExclamation className="mt-px size-3.5 shrink-0" aria-hidden="true" />
              Not counted in {group.rule.toLowerCase()}, so this gap stays open.
            </p>
          )}
          <ul className="m-0 flex list-none flex-col p-0" aria-label={`Who can take ${SHIFT[shift].name}`}>
            {free.map((f) => (
              <li key={f.id}>
                <Button
                  variant="ghost"
                  fullWidth
                  className="h-auto justify-start px-2 py-1.5 text-left"
                  aria-label={`Assign ${f.name} to ${SHIFT[shift].name}`}
                  onPress={() => {
                    onAssign(f.id, shift);
                    setOpen(false);
                  }}
                >
                  <Person name={f.name} sub={`${f.after} h if assigned`} className="flex-1 text-[13px]" />
                  {f.after > MAX_WEEK_HOURS ? (
                    <TriangleExclamation
                      className="size-4 shrink-0 text-warning"
                      aria-label={`${f.after - MAX_WEEK_HOURS} h overtime`}
                    />
                  ) : null}
                </Button>
              </li>
            ))}
          </ul>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

export function RosterView({
  data,
  initialWeek,
  today,
  branchName,
  otherBranchName,
  branches = [],
  branchId = "",
}: {
  data: RosterData;
  initialWeek: WeekId;
  /** Today in Kigali ("2026-10-15"): "this week" is the seven days from today, "next week" the seven after. */
  today: string;
  /** The branch this roster is for, and the one a shift can be lent to. */
  branchName: string;
  otherBranchName: string;
  /** Every branch of the business, to work on another one's roster. */
  branches?: { id: string; name: string }[];
  branchId?: string;
}) {
  const {
    acceptSwapForColleague,
    decideShiftSwap,
    pickRosterBranch,
    publishRosterWeek,
    setRosterLent,
    setRosterShift,
  } = useHrActions();
  const screenHref = useBoardHref();
  const { TopbarStatus } = useHrShell();
  const { groups, staff, rotations, holidays } = data;
  const weekOf = (w: WeekId) => data.weeks.find((x) => x.id === w) ?? data.weeks[0];

  const [wk, setWk] = useState<WeekId>(initialWeek);
  const [grids, setGrids] = useState<Partial<Record<WeekId, Grid | null>>>({});
  // The cell whose editor is open, "<staffId>-<day>".
  const [editing, setEditing] = useState<string | null>(null);
  // The rotation whose drawer is open.
  const [rotationOpen, setRotationOpen] = useState<string | null>(null);
  const [newRotation, setNewRotation] = useState(false);
  // The team whose minimum cover is being set.
  const [coverFor, setCoverFor] = useState<string | null>(null);
  const [dept, setDept] = useState("all");
  const [lent, setLent] = useState<Record<WeekId, Record<string, boolean>>>(() => ({
    this: Object.fromEntries((weekOf("this")?.lent ?? []).map((k) => [k, true])),
    next: Object.fromEntries((weekOf("next")?.lent ?? []).map((k) => [k, true])),
  }));
  const [swapState, setSwapState] = useState<Partial<Record<string, "approved" | "declined">>>({});
  const [pub, setPub] = useState<Record<WeekId, "published" | "draft">>(() => ({
    this: weekOf("this")?.status ?? "draft",
    next: weekOf("next")?.status ?? "draft",
  }));
  const [edits, setEdits] = useState<Record<WeekId, number>>(() => ({
    this: weekOf("this")?.pendingChanges ?? 0,
    next: weekOf("next")?.pendingChanges ?? 0,
  }));
  const [, startTransition] = useTransition();
  const [pubAt, setPubAt] = useState<Record<WeekId, string>>(() => ({
    this: weekOf("this")?.publishedAt ?? "",
    next: weekOf("next")?.publishedAt ?? "",
  }));
  const [dialog, setDialog] = useState(false);

  // A server refresh brings the truth (a rotation's drafts, someone new, a decided swap), so local edits
  // give way to it. This render stops here: the old grid has no row for someone new.
  const [seen, setSeen] = useState(data);
  if (seen !== data) {
    setSeen(data);
    setGrids({});
    setSwapState({});
    setLent({
      this: Object.fromEntries((weekOf("this")?.lent ?? []).map((k) => [k, true])),
      next: Object.fromEntries((weekOf("next")?.lent ?? []).map((k) => [k, true])),
    });
    setPub({ this: weekOf("this")?.status ?? "draft", next: weekOf("next")?.status ?? "draft" });
    setEdits({ this: weekOf("this")?.pendingChanges ?? 0, next: weekOf("next")?.pendingChanges ?? 0 });
    setPubAt({ this: weekOf("this")?.publishedAt ?? "", next: weekOf("next")?.publishedAt ?? "" });
    return null;
  }

  // A branch with nobody active on any of its teams has no one to roster yet.
  if (staff.length === 0 || groups.length === 0 || data.weeks.length === 0) {
    return (
      <PageContent>
        <PageHeader
          eyebrow={`${branchName} · ${longDay(today)}`}
          title="Roster"
          actions={
            branches.length > 1 ? (
              <NativeSelect aria-label="Branch">
                <NativeSelect.Trigger
                  aria-label="Branch"
                  value={branchId}
                  onChange={(e) => {
                    const id = e.target.value;
                    startTransition(async () => {
                      const result = await pickRosterBranch(id);
                      if (!result.ok) toast.danger(result.error);
                    });
                  }}
                >
                  {branches.map((b) => (
                    <NativeSelect.Option key={b.id} value={b.id}>
                      {b.name}
                    </NativeSelect.Option>
                  ))}
                  <NativeSelect.Indicator />
                </NativeSelect.Trigger>
              </NativeSelect>
            ) : null
          }
        />
        <EmptyState size="sm" className="py-12">
          <EmptyState.Header>
            <EmptyState.Media variant="icon">
              <ShieldExclamation />
            </EmptyState.Media>
            <EmptyState.Title>Nobody on staff at this branch yet</EmptyState.Title>
          </EmptyState.Header>
        </EmptyState>
      </PageContent>
    );
  }

  const W = weekOf(wk);
  const weekStart = addDays(today, wk === "next" ? 7 : 0);
  const dates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const days = dates.map(shortDay);
  const longDays = dates.map(longDay);

  const initialGrid = (w: WeekId): Grid =>
    Object.fromEntries(staff.map((p) => [p.id, p.shifts[w].split("") as ShiftCode[]]));
  const gridOf = (w: WeekId): Grid => grids[w] ?? initialGrid(w);
  const grid = gridOf(wk);
  const lentNow = lent[wk];
  const copy = (g: Grid): Grid => Object.fromEntries(Object.entries(g).map(([k, v]) => [k, [...v]]));
  // A change to a published week reaches the person at once (the API publishes it and tells them),
  // so nothing waits to be sent: only a draft week's changes wait for Publish.
  const setCell = (rid: string, d: number, v: ShiftCode) => {
    const before = grid[rid][d];
    if (before === v) return;
    const week = wk;
    const next = copy(grid);
    next[rid][d] = v;
    setGrids({ ...grids, [wk]: next });
    if (v === "L") return;
    startTransition(async () => {
      const result = await setRosterShift(week, rid, d, v);
      if (!result.ok) {
        setGrids((g) => {
          const back = copy(g[week] ?? initialGrid(week));
          back[rid][d] = before;
          return { ...g, [week]: back };
        });
        toast.danger(result.error);
      }
    });
  };
  const setLentCell = (rid: string, d: number, isLent: boolean) => {
    const week = wk;
    setLent({ ...lent, [week]: { ...lentNow, [`${rid}-${d}`]: isLent } });
    startTransition(async () => {
      const result = await setRosterLent(week, rid, d, isLent);
      if (!result.ok) {
        setLent((l) => ({ ...l, [week]: { ...l[week], [`${rid}-${d}`]: !isLent } }));
        toast.danger(result.error);
      }
    });
  };

  /** A shift's real hours at this branch, or its name where the branch has no such shift. */
  const hoursLabel = (v: ShiftCode) =>
    (v === "M" || v === "E" || v === "N" ? W.shiftTimes?.[v] : undefined) ?? SHIFT[v].time;
  /** A cell's label: the hours of the shift it holds, or the branch's hours for one changed just now. */
  const cellHours = (p: RosterStaff, d: number) => {
    const v = grid[p.id][d];
    return p.shifts[wk].charAt(d) === v ? (p.times?.[wk]?.[d] ?? hoursLabel(v)) : hoursLabel(v);
  };
  /** How long a shift letter is here; 8 h where the branch has no such shift yet. */
  const lengthOf = (v: ShiftCode) => (v === "M" || v === "E" || v === "N" ? (W.shiftLengths?.[v] ?? 8) : 0);
  /** A person's hours in the week shown, each day at its own shift's real length. */
  const hoursOf = (rid: string, g: Grid = grid) => {
    const p = staff.find((x) => x.id === rid);
    return g[rid].reduce((sum, v, d) => {
      if (v === "O" || v === "L") return sum;
      const own = p?.shifts[wk].charAt(d) === v ? p?.lengths?.[wk]?.[d] : undefined;
      return sum + (own || lengthOf(v));
    }, 0);
  };
  const coverOf = (G: RosterGroup, d: number, g: Grid, ln: Record<string, boolean> = lentNow) =>
    staff.filter((p) => p.group === G.id && G.shifts.includes(g[p.id][d]) && !ln[`${p.id}-${d}`]).length;

  // Below-minimum shifts across every department, each with the people off that day who could take it.
  const gaps = groups.flatMap((G) =>
    G.min.flatMap((mn, d) => {
      const n = coverOf(G, d, grid);
      if (n >= mn) return [];
      const free = staff
        .filter((p) => p.group === G.id && grid[p.id][d] === "O")
        .map((p) => ({ ...p, after: hoursOf(p.id) + (lengthOf(G.shifts[0] ?? "M") || 8) }))
        .sort((a, b) => a.after - b.after)
        .slice(0, 3);
      return [{ id: `${G.id}-${d}`, G, d, n, mn, free }];
    }),
  );
  const gapsBy = (gid: string) => gaps.filter((g) => g.G.id === gid).length;

  const shownGroups = groups.filter((G) => dept === "all" || dept === G.id);
  const tabs = [
    { id: "all", label: "All", n: staff.length },
    ...groups.map((G) => ({ id: G.id, label: G.name, n: staff.filter((p) => p.group === G.id).length })),
  ];

  // A swap's effect is read on the week it falls in. Someone from another branch is not on this grid,
  // so the swap still shows, without a figure for cover.
  const swaps = data.swaps.map((w) => {
    const st = swapState[w.id] ?? "pending";
    const week: WeekId = w.week ?? "this";
    const before = gridOf(week);
    const G = groups.find((x) => x.id === staff.find((p) => p.id === w.a)?.group) ?? groups[0];
    const swapped = copy(before);
    const onGrid = (w.kind ?? "swap") === "swap" && w.day >= 0 && Boolean(swapped[w.a] && swapped[w.b]);
    if (onGrid) {
      const t = swapped[w.a][w.day];
      swapped[w.a][w.day] = swapped[w.b][w.day];
      swapped[w.b][w.day] = t;
    }
    const delta = onGrid ? coverOf(G, w.day, swapped, lent[week]) - coverOf(G, w.day, before, lent[week]) : 0;
    return {
      ...w,
      week,
      st,
      swapped,
      impact:
        st === "pending"
          ? w.overdue
            ? "Date passed"
            : w.waiting
              ? `Waiting for ${w.colleague || "the colleague"}`
              : (w.kind ?? "swap") !== "swap"
                ? w.kind === "rotation"
                  ? "Rotation"
                  : "Different shift"
                : delta === 0
                  ? "Cover unchanged"
                  : `Cover ${delta > 0 ? "+" : ""}${delta}`
          : st === "approved"
            ? "Approved"
            : "Declined",
      tone:
        st === "declined" || w.waiting
          ? ("default" as const)
          : w.overdue || delta < 0
            ? ("warning" as const)
            : ("success" as const),
    };
  });
  const pendingSwaps = swaps.filter((s) => s.st === "pending").length;

  const isPub = pub[wk] === "published";
  const ed = edits[wk];
  const wkNo = W.number;
  const shiftCount = staff.reduce(
    (n, p) => n + grid[p.id].filter((v) => v === "M" || v === "E" || v === "N").length,
    0,
  );
  const overtime = staff.filter((p) => hoursOf(p.id) > MAX_WEEK_HOURS);
  const pubLabel = `Week ${wkNo} · ${isPub ? (ed ? `published, ${ed} unsent` : "published") : "draft"}`;
  const showPublish = !isPub || ed > 0;
  const publishLabel = isPub ? `Publish ${ed} ${plural(ed, "shift")}` : "Publish roster";
  const dlgTitle = isPub ? `Send ${ed} ${plural(ed, "shift")} for week ${wkNo}?` : `Publish week ${W.range}?`;
  const dlgText = isPub
    ? "Only people whose shifts changed see it in the app."
    : `${staff.length} staff see their shifts in the app.`;
  const confirmLabel = `${isPub ? "Send" : "Publish"}${gaps.length ? ` with ${gaps.length} ${plural(gaps.length, "gap")}` : ""}`;

  const publish = () => {
    const week = wk;
    const was = { pub: pub[week], edits: edits[week], at: pubAt[week] };
    setDialog(false);
    setPub({ ...pub, [week]: "published" });
    setEdits({ ...edits, [week]: 0 });
    setPubAt({ ...pubAt, [week]: pubAt[week] || "today" });
    startTransition(async () => {
      const result = await publishRosterWeek(week);
      if (!result.ok) {
        setPub((p) => ({ ...p, [week]: was.pub }));
        setEdits((e) => ({ ...e, [week]: was.edits }));
        setPubAt((p) => ({ ...p, [week]: was.at }));
        toast.danger(result.error);
      }
    });
  };
  const decideSwap = (w: (typeof swaps)[number], decision: "approved" | "declined") => {
    const before = grids[w.week] ?? null;
    if (decision === "approved" && w.day >= 0) setGrids({ ...grids, [w.week]: w.swapped });
    setSwapState({ ...swapState, [w.id]: decision });
    startTransition(async () => {
      const result = await decideShiftSwap(w.id, decision);
      if (!result.ok) {
        if (decision === "approved" && w.day >= 0) setGrids((g) => ({ ...g, [w.week]: before }));
        setSwapState((s) => ({ ...s, [w.id]: undefined }));
        toast.danger(result.error);
      }
    });
  };

  const acceptFor = (w: (typeof swaps)[number]) =>
    startTransition(async () => {
      const result = await acceptSwapForColleague(w.id);
      if (!result.ok) toast.danger(result.error);
    });

  const colBg = (d: number) =>
    dates[d] === today ? "bg-accent-soft/50" : weekdayIndex(dates[d]) >= 5 ? "bg-surface-secondary/70" : "";

  /** One day of one person: the shift as a coloured block, its editor in a popover beside it. */
  const cell = (p: RosterStaff, d: number) => {
    const v = grid[p.id][d];
    const key = `${p.id}-${d}`;
    const isLent = !!lentNow[key];
    const isOpen = editing === key;
    const s = SHIFT[v];
    const label = cellHours(p, d);
    const hrs = hoursOf(p.id);
    const home = groups.find((G) => G.id === p.group)?.name ?? "";
    return (
      <Popover isOpen={isOpen} onOpenChange={(o) => setEditing(o ? key : null)}>
        <Button
          size="sm"
          variant="ghost"
          aria-label={`${p.name}, ${longDays[d]}: ${s.name}${v === "O" || v === "L" ? "" : ` ${label}`}${isLent ? `, lent to ${otherBranchName}` : ""}. Edit shift`}
          className={`group relative h-8 w-full min-w-0 gap-1 rounded-full px-2 text-[12px] font-semibold tabular transition ${
            v === "O"
              ? "bg-transparent! text-muted hover:bg-default!"
              : `${s.pill} shadow-[0_1px_2px_rgb(0_0_0/0.12)] hover:brightness-110`
          } ${isOpen ? "ring-2 ring-[var(--focus)] ring-offset-2" : ""}`}
        >
          {v === "O" ? (
            <>
              <span aria-hidden="true" className="size-1 rounded-full bg-separator group-hover:hidden" />
              <Plus className="hidden size-4 group-hover:block" aria-hidden="true" />
            </>
          ) : (
            <>
              {v === "L" ? s.icon("size-3.5 shrink-0") : null}
              <span className="truncate">{label}</span>
            </>
          )}
          {isLent ? (
            <span
              aria-hidden="true"
              className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-surface text-foreground shadow-sm"
            >
              <ArrowUpRight className="size-2.5" />
            </span>
          ) : null}
        </Button>
        <Popover.Content placement="bottom" className="w-[300px] p-0">
          <Popover.Dialog aria-label={`Edit ${p.name}, ${longDays[d]}`} className="flex flex-col gap-3 p-4">
            <Person name={p.name} sub={longDays[d]} />
            {v === "L" ? (
              <span className="flex items-center gap-2 rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning-soft-foreground">
                <Suitcase className="size-4" aria-hidden="true" />
                On approved leave
              </span>
            ) : (
              <>
                <fieldset className="m-0 grid grid-cols-2 gap-1.5 border-0 p-0">
                  <legend className="sr-only">Shift</legend>
                  {(["M", "E", "N", "O"] as ShiftCode[]).map((k) => (
                    <Button
                      key={k}
                      size="sm"
                      variant={v === k ? "primary" : "secondary"}
                      aria-pressed={v === k}
                      fullWidth
                      className="h-auto flex-col gap-0.5 py-2"
                      onPress={() => {
                        setCell(p.id, d, k);
                        setEditing(null);
                      }}
                    >
                      <span className="flex items-center gap-1.5">
                        {SHIFT[k].icon("size-3.5")}
                        {k === "O" ? "Day off" : SHIFT[k].name}
                      </span>
                      {k === "O" ? null : (
                        <span className="text-[11px] font-normal opacity-80 tabular">{hoursLabel(k)}</span>
                      )}
                    </Button>
                  ))}
                </fieldset>
                {v !== "O" ? (
                  <NativeSelect fullWidth className="flex flex-col gap-1">
                    <Label htmlFor={`wi-${key}`}>Work in</Label>
                    <NativeSelect.Trigger
                      id={`wi-${key}`}
                      value={isLent ? "lent" : "home"}
                      onChange={(ev) => setLentCell(p.id, d, ev.target.value === "lent")}
                    >
                      <NativeSelect.Option value="home">{home}</NativeSelect.Option>
                      <NativeSelect.Option value="lent">Lent to {otherBranchName}</NativeSelect.Option>
                      <NativeSelect.Indicator />
                    </NativeSelect.Trigger>
                  </NativeSelect>
                ) : null}
              </>
            )}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">Week · rotation {p.rotation}</span>
                <span className="font-semibold tabular">
                  {hrs} / {MAX_WEEK_HOURS} h
                </span>
              </div>
              <ProgressBar
                aria-label={`${hrs} of ${MAX_WEEK_HOURS} hours`}
                value={Math.min(100, (hrs / MAX_WEEK_HOURS) * 100)}
                size="sm"
                color={hrs > MAX_WEEK_HOURS ? "warning" : "accent"}
              >
                <ProgressBar.Track>
                  <ProgressBar.Fill />
                </ProgressBar.Track>
              </ProgressBar>
            </div>
          </Popover.Dialog>
        </Popover.Content>
      </Popover>
    );
  };

  return (
    <PageContent>
      <TopbarStatus
        kind="chip"
        tone={isPub ? "success" : "default"}
        dot={isPub && !ed ? "success" : "warning"}
        label={pubLabel}
      />
      <PageHeader
        eyebrow={`${W.label} · ${branchName}`}
        title="Roster"
        actions={
          <>
            {branches.length > 1 ? (
              <NativeSelect aria-label="Branch">
                <NativeSelect.Trigger
                  aria-label="Branch"
                  value={branchId}
                  onChange={(e) => {
                    const id = e.target.value;
                    startTransition(async () => {
                      const result = await pickRosterBranch(id);
                      if (!result.ok) toast.danger(result.error);
                    });
                  }}
                >
                  {branches.map((b) => (
                    <NativeSelect.Option key={b.id} value={b.id}>
                      {b.name}
                    </NativeSelect.Option>
                  ))}
                  <NativeSelect.Indicator />
                </NativeSelect.Trigger>
              </NativeSelect>
            ) : null}
            <Segment
              aria-label="Week"
              selectedKey={wk}
              onSelectionChange={(k) => {
                setWk(k === "next" ? "next" : "this");
                setEditing(null);
              }}
            >
              {data.weeks.map((w) => (
                <Segment.Item key={w.id} id={w.id}>
                  {w.segment}
                  {pub[w.id] === "published" ? "" : " · draft"}
                </Segment.Item>
              ))}
            </Segment>
            {showPublish ? (
              <Button onPress={() => setDialog(true)}>
                <PaperPlane className="size-4" />
                {publishLabel}
              </Button>
            ) : null}
          </>
        }
      />

      <section aria-label="This week at a glance">
        <KPIGroup className="flex-wrap">
          <KPI className={KPI_CLASS}>
            <KPI.Header>
              <KPI.Icon status={isPub ? "success" : "warning"}>{isPub ? <CircleCheck /> : <PaperPlane />}</KPI.Icon>
              <KPI.Title>Week {wkNo}</KPI.Title>
            </KPI.Header>
            <KPI.Content>
              <span className="text-[20px] leading-7 font-semibold">{isPub ? "Published" : "Draft"}</span>
            </KPI.Content>
            <KPI.Footer>
              <p className="truncate text-xs leading-4 text-muted">
                {isPub ? `${pubAt[wk] || "Today"}${ed ? ` · ${ed} unsent` : ""}` : "Not sent to staff"}
              </p>
            </KPI.Footer>
          </KPI>
          <KPIGroup.Separator />
          <KPI className={KPI_CLASS}>
            <KPI.Header>
              <KPI.Icon status="success">
                <Persons />
              </KPI.Icon>
              <KPI.Title>Shifts</KPI.Title>
            </KPI.Header>
            <KPI.Content>
              <KPI.Value value={shiftCount} className="tabular" />
            </KPI.Content>
            <KPI.Footer>
              <p className="text-xs leading-4 text-muted">{staff.length} staff</p>
            </KPI.Footer>
          </KPI>
          <KPIGroup.Separator />
          <KPI className={KPI_CLASS}>
            <KPI.Header>
              <KPI.Icon status={gaps.length ? "warning" : "success"}>
                <TriangleExclamation />
              </KPI.Icon>
              <KPI.Title>Below cover</KPI.Title>
            </KPI.Header>
            <KPI.Content>
              <KPI.Value value={gaps.length} className="tabular" />
            </KPI.Content>
            <KPI.Footer>
              <p className="truncate text-xs leading-4 text-muted">
                {gaps.length
                  ? gaps
                      .map((g) => days[g.d])
                      .filter((x, i, a) => a.indexOf(x) === i)
                      .join(", ")
                  : "All covered"}
              </p>
            </KPI.Footer>
          </KPI>
          <KPIGroup.Separator />
          <KPI className={KPI_CLASS}>
            <KPI.Header>
              <KPI.Icon status={overtime.length ? "warning" : "success"}>
                <Clock />
              </KPI.Icon>
              <KPI.Title className="flex items-center gap-1">
                Overtime
                <Hint label="Overtime">Over {MAX_WEEK_HOURS} h in the week</Hint>
              </KPI.Title>
            </KPI.Header>
            <KPI.Content>
              <KPI.Value value={overtime.length} className="tabular" />
            </KPI.Content>
            <KPI.Footer>
              <p className="truncate text-xs leading-4 text-muted">
                {overtime.length ? overtime.map((p) => firstName(p.name)).join(", ") : "Nobody"}
              </p>
            </KPI.Footer>
          </KPI>
          <KPIGroup.Separator />
          <KPI className={KPI_CLASS}>
            <KPI.Header>
              <KPI.Icon status={pendingSwaps ? "warning" : "success"}>
                <ArrowRightArrowLeft />
              </KPI.Icon>
              <KPI.Title>Requests</KPI.Title>
            </KPI.Header>
            <KPI.Content>
              <KPI.Value value={pendingSwaps} className="tabular" />
            </KPI.Content>
            <KPI.Footer>
              <p className="text-xs leading-4 text-muted">{pendingSwaps ? "To decide" : "None waiting"}</p>
            </KPI.Footer>
          </KPI>
        </KPIGroup>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs variant="secondary" selectedKey={dept} onSelectionChange={(k) => setDept(String(k))} className="min-w-0">
          <Tabs.ListContainer>
            <Tabs.List aria-label="Department" className="justify-start gap-1">
              {tabs.map((t) => (
                <Tabs.Tab key={t.id} id={t.id} className={TAB_CLASS}>
                  {t.label}
                  <Chip size="sm" variant="soft" color={t.id !== "all" && gapsBy(t.id) ? "warning" : "default"}>
                    {t.n}
                  </Chip>
                  <Tabs.Indicator />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
        <ul aria-label="Legend" className="flex flex-wrap items-center gap-1.5">
          {LEGEND.map(({ code, label }) => (
            <li
              key={code}
              className={`flex h-6 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold ${
                code === "O" ? "border border-dashed border-separator text-muted" : SHIFT[code].pill
              }`}
            >
              {SHIFT[code].icon("size-3")}
              {label}
            </li>
          ))}
          <li className="flex h-7 items-center gap-1 px-1.5 text-xs text-muted">
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
            Lent
          </li>
        </ul>
      </div>

      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label={`Roster, ${W.label}`} className="min-w-[820px] table-fixed">
            <Table.Header>
              <Table.Column isRowHeader className="w-[220px]">
                Staff
              </Table.Column>
              {dates.map((iso) => {
                const isToday = iso === today;
                const weekend = weekdayIndex(iso) >= 5;
                return (
                  <Table.Column key={iso} className={`px-1 text-center ${isToday ? "bg-accent-soft/50" : ""}`}>
                    <span className="flex flex-col items-center gap-0.5 leading-none">
                      <span className={`text-[11px] font-medium ${weekend ? "text-accent" : ""}`}>
                        {weekdayShort(iso)}
                      </span>
                      <span
                        className={`flex size-7 items-center justify-center rounded-full text-[14px] font-semibold tabular ${
                          isToday ? "bg-accent text-accent-foreground" : "text-foreground"
                        }`}
                      >
                        {dayOfMonth(iso)}
                      </span>
                      {isToday ? <span className="sr-only">today</span> : null}
                    </span>
                  </Table.Column>
                );
              })}
              <Table.Column className="w-[84px] text-right">Hours</Table.Column>
            </Table.Header>
            <Table.Body>
              {shownGroups.map((G) => {
                const rows = staff.filter((p) => p.group === G.id);
                const short = gapsBy(G.id);
                return (
                  <Fragment key={G.id}>
                    <Table.Row id={`${G.id}-head`}>
                      <Table.Cell colSpan={9} className="bg-surface-secondary px-3 py-2">
                        <span className="flex items-center gap-2">
                          <span className="font-semibold">{G.name}</span>
                          <Chip size="sm" variant="soft">
                            {rows.length}
                          </Chip>
                          {G.note ? <Hint label={`About ${G.name}`}>{G.note}</Hint> : null}
                          {short ? (
                            <Chip size="sm" variant="soft" color="warning" className="ml-auto">
                              <TriangleExclamation className="size-3" />
                              <Chip.Label>
                                {short} {plural(short, "gap")}
                              </Chip.Label>
                            </Chip>
                          ) : (
                            <Chip size="sm" variant="soft" color="success" className="ml-auto">
                              <Check className="size-3" />
                              <Chip.Label>Covered</Chip.Label>
                            </Chip>
                          )}
                        </span>
                      </Table.Cell>
                    </Table.Row>
                    {rows.map((p) => {
                      const h = hoursOf(p.id);
                      return (
                        <Table.Row key={p.id} id={p.id}>
                          <Table.Cell className="px-3 py-1.5">
                            <Person name={p.name} sub={`${p.role} · ${p.rotation}`} className="text-[13px]" />
                          </Table.Cell>
                          {dates.map((iso, d) => (
                            <Table.Cell key={iso} className={`px-1 py-1.5 ${colBg(d)}`}>
                              {cell(p, d)}
                            </Table.Cell>
                          ))}
                          <Table.Cell className="px-3 py-1.5 text-right text-[13px] tabular">
                            <Tip
                              tip={
                                h > MAX_WEEK_HOURS ? `${h - MAX_WEEK_HOURS} h overtime` : `${h} of ${MAX_WEEK_HOURS} h`
                              }
                              className="w-full"
                            >
                              <span className="flex w-full flex-col items-end gap-1">
                                <span className={`font-semibold ${h > MAX_WEEK_HOURS ? "text-warning" : ""}`}>
                                  {h} h
                                </span>
                                <span className="h-1 w-full max-w-[52px] overflow-hidden rounded-full bg-default">
                                  <span
                                    className={`block h-full rounded-full ${h > MAX_WEEK_HOURS ? "bg-warning" : "bg-accent"}`}
                                    style={{ width: `${Math.min(100, (h / MAX_WEEK_HOURS) * 100)}%` }}
                                  />
                                </span>
                              </span>
                            </Tip>
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                    <Table.Row id={`${G.id}-cover`}>
                      <Table.Cell className="px-3 py-2">
                        {G.id === "no-team" ? (
                          <span className="text-xs font-medium text-muted">{G.rule}</span>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 gap-1.5 px-2 text-xs font-medium"
                            aria-label={`Set minimum cover for ${G.name}`}
                            onPress={() => setCoverFor(G.id)}
                          >
                            <Pencil className="size-3.5" aria-hidden="true" />
                            {G.rule}
                          </Button>
                        )}
                      </Table.Cell>
                      {G.min.map((mn, d) => {
                        const n = coverOf(G, d, grid);
                        const low = n < mn;
                        return (
                          <Table.Cell key={`${G.id}-${dates[d]}`} className={`px-2 py-2 ${colBg(d)}`}>
                            <Tip
                              tip={
                                low
                                  ? `${mn - n} more ${plural(mn - n, "person", "people")} needed on ${days[d]}`
                                  : `${n} of ${mn} needed`
                              }
                              className="w-full"
                            >
                              <span className="flex w-full flex-col items-center gap-1">
                                <span
                                  className={`text-[11px] font-semibold tabular ${low ? "text-warning" : "text-muted"}`}
                                >
                                  {n}/{mn}
                                </span>
                                <span className="h-1 w-full max-w-[56px] overflow-hidden rounded-full bg-default">
                                  <span
                                    className={`block h-full rounded-full ${low ? "bg-warning" : "bg-accent"}`}
                                    style={{ width: `${Math.min(100, mn ? (n / mn) * 100 : 100)}%` }}
                                  />
                                </span>
                              </span>
                            </Tip>
                          </Table.Cell>
                        );
                      })}
                      <Table.Cell>{""}</Table.Cell>
                    </Table.Row>
                  </Fragment>
                );
              })}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>

      <RosterCover
        days={days.map((label, d) => ({
          label,
          onShift: shownGroups.reduce((n, G) => n + coverOf(G, d, grid), 0),
          needed: shownGroups.reduce((n, G) => n + (G.min[d] ?? 0), 0),
        }))}
      />

      <PanelCard
        dense
        id="gap-h"
        title="Gaps to fill"
        action={
          gaps.length ? (
            <Chip size="sm" variant="soft" color="warning">
              {gaps.length}
            </Chip>
          ) : null
        }
        className="gap-2.5"
      >
        {gaps.length === 0 ? (
          <EmptyState size="sm">
            <EmptyState.Header>
              <EmptyState.Media variant="icon">
                <CircleCheck />
              </EmptyState.Media>
              <EmptyState.Title>Every shift covered</EmptyState.Title>
            </EmptyState.Header>
          </EmptyState>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {gaps.map((g) => (
              <div key={g.id} className="flex items-center gap-3 rounded-xl bg-surface-secondary p-2.5">
                <Ring
                  value={g.n}
                  max={g.mn}
                  label={`${g.n} of ${g.mn} covered`}
                  color={g.n ? "warning" : "danger"}
                  size="size-10"
                >
                  <span className="text-[10px]">
                    {g.n}/{g.mn}
                  </span>
                </Ring>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-semibold">
                    {days[g.d]} · {g.G.name}
                  </span>
                  <span className="text-xs text-muted">
                    {g.G.shifts.length === 1 ? SHIFT[g.G.shifts[0]].name : "Any shift"} · {g.mn - g.n} more needed
                  </span>
                </div>
                {g.free.length === 0 ? (
                  <Tip tip={`Nobody in ${g.G.name.toLowerCase()} is off that day`}>
                    <Chip size="sm" variant="soft">
                      No one free
                    </Chip>
                  </Tip>
                ) : (
                  <GapAssign
                    group={g.G}
                    dayLabel={longDays[g.d]}
                    free={g.free}
                    hoursOf={hoursLabel}
                    onShift={(k) => staff.filter((p) => p.group === g.G.id && grid[p.id][g.d] === k).length}
                    onAssign={(id, k) => setCell(id, g.d, k)}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </PanelCard>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-4">
          <PanelCard
            dense
            id="sw-h"
            title="Shift requests"
            action={
              pendingSwaps ? (
                <Chip size="sm" variant="soft" color="warning">
                  {pendingSwaps}
                </Chip>
              ) : null
            }
            className="gap-2.5"
          >
            {swaps.length === 0 ? (
              <EmptyState size="sm">
                <EmptyState.Header>
                  <EmptyState.Media variant="icon">
                    <ArrowRightArrowLeft />
                  </EmptyState.Media>
                  <EmptyState.Title>No requests</EmptyState.Title>
                </EmptyState.Header>
              </EmptyState>
            ) : null}
            {swaps.map((w) => (
              <Card key={w.id} variant="secondary" className="gap-2 p-3">
                <span className="flex items-center gap-1 text-[13px] font-medium">
                  {w.title}
                  {w.detail ? <Hint label="Why they asked">{w.detail}</Hint> : null}
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Chip size="sm" variant="soft" color={w.tone}>
                    {w.impact}
                  </Chip>
                  {w.st === "pending" ? (
                    <span className="ml-auto flex items-center gap-1.5">
                      {w.waiting || w.overdue ? null : (
                        <Button size="sm" onPress={() => decideSwap(w, "approved")}>
                          <Check className="size-4" />
                          Approve
                        </Button>
                      )}
                      {w.canAcceptFor && !w.overdue ? (
                        <Button size="sm" variant="secondary" onPress={() => acceptFor(w)}>
                          Yes for {w.colleague}
                        </Button>
                      ) : null}
                      <Button size="sm" variant="ghost" onPress={() => decideSwap(w, "declined")}>
                        Decline
                      </Button>
                    </span>
                  ) : null}
                </div>
              </Card>
            ))}
          </PanelCard>

          <PanelCard
            dense
            id="hol-h"
            title="Public holidays"
            action={
              <span className="flex items-center gap-1.5">
                <GateChip icon={<ShieldExclamation className="size-3" />}>Unverified</GateChip>
                <LinkButton href={screenHref("PayrollRules")} size="sm" variant="ghost">
                  Pay rule
                </LinkButton>
              </span>
            }
            className="gap-2"
          >
            {holidays.map((h) => {
              const [weekday, day, month] = h.date.split(" ");
              const pending = /not/i.test(h.rostered);
              return (
                <div key={h.id} className="flex items-center gap-3 rounded-xl bg-surface-secondary p-2.5">
                  <span className="flex w-12 shrink-0 flex-col items-center rounded-lg bg-surface py-1 leading-tight">
                    <span className="text-[10px] font-semibold text-muted">{weekday?.slice(0, 3)}</span>
                    <span className="text-[17px] font-semibold tabular">{day}</span>
                    <span className="text-[10px] text-muted">{month?.slice(0, 3)}</span>
                  </span>
                  <span className="flex min-w-0 flex-1 items-center gap-2 text-[13px] font-semibold">
                    <Flag className="size-3.5 shrink-0 text-accent" aria-hidden="true" />
                    <span className="truncate">{h.name}</span>
                  </span>
                  <Chip size="sm" variant="soft" color={pending ? "warning" : "success"} className="shrink-0">
                    {h.rostered}
                  </Chip>
                </div>
              );
            })}
          </PanelCard>
        </div>

        <PanelCard
          dense
          id="rot-h"
          title="Rotations"
          action={
            <span className="flex items-center gap-1.5">
              <Chip size="sm" variant="soft">
                {rotations.length}
              </Chip>
              <Button size="sm" variant="secondary" onPress={() => setNewRotation(true)}>
                <Plus className="size-4" />
                New rotation
              </Button>
            </span>
          }
          className="gap-2"
        >
          {rotations.length === 0 ? (
            <EmptyState size="sm">
              <EmptyState.Header>
                <EmptyState.Media variant="icon">
                  <ArrowRightArrowLeft />
                </EmptyState.Media>
                <EmptyState.Title>No rotations yet</EmptyState.Title>
              </EmptyState.Header>
            </EmptyState>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2">
            {rotations.map((r) => {
              const names = (r.people ?? []).map((p) => p.name);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRotationOpen(r.id)}
                  aria-label={`Open rotation ${r.code}`}
                  className="flex cursor-pointer flex-col gap-2 rounded-xl bg-surface-secondary p-3 text-left outline-none transition-colors hover:bg-surface-tertiary focus-visible:ring-2 focus-visible:ring-focus"
                >
                  <span className="flex items-start gap-2.5">
                    <span className="flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg bg-accent px-1.5 text-xs font-bold text-accent-foreground">
                      {r.code}
                    </span>
                    <span className="min-w-0 flex-1 text-[13px] leading-[18px] font-semibold">{r.name}</span>
                    <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                  </span>
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1" title={r.who}>
                      {names.slice(0, 4).map((n) => (
                        <Avatar key={n} size="sm" color={avatarColor(n)} className="size-7 text-[11px]">
                          <Avatar.Fallback>{initials(n)}</Avatar.Fallback>
                        </Avatar>
                      ))}
                      {names.length > 4 ? <span className="text-xs text-muted">+{names.length - 4}</span> : null}
                      {names.length === 0 ? <span className="text-xs text-muted">Nobody yet</span> : null}
                    </span>
                    <span className="text-xs text-muted tabular">
                      {r.staff} {plural(r.staff, "person", "people")}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </PanelCard>
      </div>

      <RotationDrawer
        rotation={rotations.find((r) => r.id === rotationOpen) ?? null}
        rotations={rotations}
        staff={staff}
        today={today}
        onOpenChange={(open) => {
          if (!open) setRotationOpen(null);
        }}
      />

      <NewRotationDrawer isOpen={newRotation} onOpenChange={setNewRotation} />
      <CoverDrawer
        group={groups.find((G) => G.id === coverFor) ?? null}
        shiftTimes={W.shiftTimes}
        onOpenChange={(open) => {
          if (!open) setCoverFor(null);
        }}
      />

      <Modal.Backdrop isOpen={dialog} onOpenChange={setDialog}>
        <Modal.Container>
          <Modal.Dialog aria-labelledby="pub-h" className="sm:max-w-[440px]">
            <Modal.Header className="flex flex-col items-start gap-1">
              <Modal.Heading id="pub-h" className="text-lg leading-6 font-semibold">
                {dlgTitle}
              </Modal.Heading>
              <p className="text-sm text-muted">{dlgText}</p>
            </Modal.Header>
            {gaps.length ? (
              <Modal.Body>
                <span className="flex items-center gap-2 rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning-soft-foreground">
                  <TriangleExclamation className="size-4 shrink-0" aria-hidden="true" />
                  {gaps.length} {plural(gaps.length, "shift is", "shifts are")} below minimum cover
                </span>
              </Modal.Body>
            ) : null}
            <Modal.Footer>
              <Button slot="close" variant="ghost">
                Keep editing
              </Button>
              <Button onPress={publish}>
                <PaperPlane className="size-4" />
                {confirmLabel}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
      <Toast.Provider placement="bottom" />
    </PageContent>
  );
}
