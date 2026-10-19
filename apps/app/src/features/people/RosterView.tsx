"use client";

import {
  ArrowsRotateLeft,
  Check,
  CircleCheck,
  CircleInfo,
  Flag,
  PaperPlane,
  ShieldExclamation,
  Suitcase,
  TriangleExclamation,
} from "@gravity-ui/icons";
import {
  Alert,
  Button,
  Card,
  Chip,
  Description,
  Fieldset,
  Label,
  Modal,
  Table,
  Tabs,
  Toast,
  toast,
} from "@heroui/react";
import { ListView, NativeSelect, Segment } from "@heroui-pro/react";
import { screenHref } from "@injishi/data";
import type {
  PublicHoliday,
  RosterGroup,
  RosterStaff,
  RosterWeek,
  Rotation,
  ShiftCode,
  ShiftSwap,
  WeekId,
} from "@injishi/data/fixtures/people";
import { GateChip, KeyValueList, LinkButton, PageContent, PageHeader } from "@injishi/ui";
import { Fragment, useState, useTransition } from "react";
import { TopbarStatus } from "@/components/shell/TopbarStatus";
import { decideShiftSwap, publishRosterWeek, setRosterLent, setRosterShift } from "./actions";
import { addDays, longDay, shortDay, weekdayLong } from "./days";
import { PanelCard } from "./parts";

export interface RosterData {
  groups: RosterGroup[];
  staff: RosterStaff[];
  weeks: RosterWeek[];
  swaps: ShiftSwap[];
  rotations: Rotation[];
  holidays: PublicHoliday[];
}

type Grid = Record<string, ShiftCode[]>;

/** Cell label, long name (aria + editor) and legend label per shift code. */
const LABEL: Record<ShiftCode, string> = { M: "07–15", E: "15–23", N: "23–07", O: "Off", L: "Leave" };
const NAME: Record<ShiftCode, string> = {
  M: "Morning 07:00–15:00",
  E: "Evening 15:00–23:00",
  N: "Night 23:00–07:00",
  O: "Day off",
  L: "On leave",
};
const LEGEND: Record<ShiftCode, string> = {
  M: "Morning 07–15",
  E: "Evening 15–23",
  N: "Night 23–07",
  O: "Day off",
  L: "Leave",
};
const SWATCH: Record<ShiftCode, string> = {
  M: "bg-accent-soft text-accent-soft-foreground",
  E: "bg-default text-default-foreground",
  N: "bg-foreground text-background",
  O: "bg-transparent text-muted shadow-[inset_0_0_0_1px_var(--separator)]",
  L: "bg-warning-soft text-warning-soft-foreground",
};
const MAX_WEEK_HOURS = 45;
const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);

export function RosterView({
  data,
  initialWeek,
  today,
  branchName,
  otherBranchName,
}: {
  data: RosterData;
  initialWeek: WeekId;
  /** Today in Kigali ("2026-10-15"): "this week" is the seven days from today, "next week" the seven after. */
  today: string;
  /** The branch this roster is for, and the one a shift can be lent to. */
  branchName: string;
  otherBranchName: string;
}) {
  const { groups, staff, rotations, holidays } = data;
  const weekOf = (w: WeekId) => data.weeks.find((x) => x.id === w) ?? data.weeks[0];

  const [wk, setWk] = useState<WeekId>(initialWeek);
  const [grids, setGrids] = useState<Partial<Record<WeekId, Grid | null>>>({});
  const [sel, setSel] = useState<{ r: string; d: number }>({ r: staff[0]?.id ?? "", d: 5 });
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

  // Live data can hold no team with a minimum cover at this branch, and so no one to roster yet.
  if (staff.length === 0 || groups.length === 0 || data.weeks.length === 0) {
    return (
      <PageContent>
        <PageHeader
          eyebrow={`${branchName} · today is ${longDay(today)}`}
          title="Roster"
          description="No team at this branch has a minimum cover set yet, so there is no roster grid to draw."
        />
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
  // A change to a published week reaches the person at once (the API publishes it and tells them),
  // so nothing waits to be sent: only a draft week's changes wait for Publish.
  const bump = (_w: WeekId, _n: number) => edits;
  const copy = (g: Grid): Grid => Object.fromEntries(Object.entries(g).map(([k, v]) => [k, [...v]]));
  const setCell = (rid: string, d: number, v: ShiftCode) => {
    const before = grid[rid][d];
    const week = wk;
    const next = copy(grid);
    next[rid][d] = v;
    setGrids({ ...grids, [wk]: next });
    setEdits(bump(wk, 1));
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

  const hoursOf = (rid: string, g: Grid = grid) => g[rid].filter((v) => v !== "O" && v !== "L").length * 8;
  const coverOf = (G: RosterGroup, d: number, g: Grid, ln: Record<string, boolean> = lentNow) =>
    staff.filter((p) => p.group === G.id && G.shifts.includes(g[p.id][d]) && !ln[`${p.id}-${d}`]).length;

  // Below-minimum shifts across every department (not only the tab shown).
  const gaps: string[] = [];
  for (const G of groups) {
    G.min.forEach((mn, d) => {
      const n = coverOf(G, d, grid);
      if (n < mn) gaps.push(`${days[d]} ${G.name.toLowerCase()} ${n} of ${mn}`);
    });
  }
  const hasWarnings = gaps.length > 0;
  const warnTitle = `${gaps.length} ${plural(gaps.length, "shift is", "shifts are")} below minimum cover`;
  const warnText = `Week of ${W.range}: ${gaps.join(" · ")}. Assign someone or approve overtime before ${days[5]}.`;

  const shownGroups = groups.filter((G) => dept === "all" || dept === G.id);
  const tabs = [
    { id: "all", label: "All departments", n: staff.length },
    ...groups.map((G) => ({ id: G.id, label: G.name, n: staff.filter((p) => p.group === G.id).length })),
  ];

  // Shift editor.
  const sp = staff.find((p) => p.id === sel.r) ?? staff[0];
  const sv = grid[sp.id][sel.d];
  const selLent = !!lentNow[`${sp.id}-${sel.d}`];
  const home = groups.find((G) => G.id === sp.group)?.name ?? "";
  const pattern = rotations.find((r) => sp.rotation in r.patterns)?.patterns[sp.rotation] ?? "";
  const hrs = hoursOf(sp.id);

  // Saturday housekeeping fill.
  const hk = groups[0];
  const sat = coverOf(hk, 5, grid);
  const satMin = hk.min[5];
  const fill = staff
    .filter((p) => p.group === hk.id && grid[p.id][5] === "O")
    .map((p) => {
      const h = hoursOf(p.id) + 8;
      return {
        ...p,
        note: `Rotation ${p.rotation} day off · would be ${h} h${h > MAX_WEEK_HOURS ? `, ${h - MAX_WEEK_HOURS} h overtime` : ""}`,
      };
    });

  // Swap requests apply to this week's grid.
  const gThis = gridOf("this");
  const swaps = data.swaps.map((w) => {
    const st = swapState[w.id] ?? "pending";
    const G = groups.find((x) => x.id === staff.find((p) => p.id === w.a)?.group) ?? groups[0];
    const swapped = copy(gThis);
    const t = swapped[w.a][w.day];
    swapped[w.a][w.day] = swapped[w.b][w.day];
    swapped[w.b][w.day] = t;
    const delta = coverOf(G, w.day, swapped, lent.this) - coverOf(G, w.day, gThis, lent.this);
    return {
      ...w,
      st,
      swapped,
      impact:
        st === "pending"
          ? delta === 0
            ? "No change to cover"
            : `Cover changes by ${delta}`
          : st === "approved"
            ? "Approved · recorded"
            : "Declined · recorded",
      tone: st === "declined" ? ("default" as const) : delta < 0 ? ("warning" as const) : ("success" as const),
      outcome:
        st === "approved"
          ? `Shifts swapped in the week ${weekOf("this")?.number ?? ""} grid.`
          : "The original shifts stay.",
    };
  });

  const isPub = pub[wk] === "published";
  const ed = edits[wk];
  const wkNo = W.number;
  const otherWeek = data.weeks.find((x) => x.id !== wk);
  const pubTitle = `Week ${wkNo} published ${pubAt[wk] || "today"} to ${staff.length} staff`;
  const pubNote = ed
    ? `${ed} shift ${plural(ed, "change")} since publishing. Publish them so the people affected see them in the staff app.`
    : wk === "this" && otherWeek && pub[otherWeek.id] !== "published"
      ? `This week shows in the staff app. Week ${otherWeek.number} (${otherWeek.range}) is still a draft.`
      : "Published weeks show in the staff app.";
  const pubLabel = `Week ${wkNo} · ${isPub ? (ed ? `published, ${ed} unsent changes` : "published") : "draft, not published"}`;
  const showPublish = !isPub || ed > 0;
  const publishLabel = isPub ? `Publish ${ed} ${plural(ed, "change")}` : "Publish roster";
  const dlgTitle = isPub ? `Send ${ed} ${plural(ed, "change")} for week ${wkNo}?` : `Publish week ${W.range}?`;
  const dlgText = isPub
    ? "The changed shifts show in the staff app of the people affected. No SMS or message is sent."
    : `${staff.length} staff at ${branchName} see their shifts in the staff app. No SMS or message is sent.`;
  const confirmLabel = `${isPub ? "Send changes" : "Publish"}${hasWarnings ? ` with ${gaps.length} ${plural(gaps.length, "gap")}` : ""}`;

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
  const reset = () => {
    toast.warning("Resetting the whole roster to rotations is not available yet. Edit individual shifts to save them.");
  };
  const decideSwap = (w: (typeof swaps)[number], decision: "approved" | "declined") => {
    const before = grids.this ?? null;
    if (decision === "approved") setGrids({ ...grids, this: w.swapped });
    setSwapState({ ...swapState, [w.id]: decision });
    setEdits(bump("this", 2));
    startTransition(async () => {
      const result = await decideShiftSwap(w.id, decision);
      if (!result.ok) {
        if (decision === "approved") setGrids((g) => ({ ...g, this: before }));
        setSwapState((s) => ({ ...s, [w.id]: undefined }));
        toast.danger(result.error);
      }
    });
  };
  const approveSwap = (w: (typeof swaps)[number]) => decideSwap(w, "approved");

  return (
    <PageContent>
      <TopbarStatus
        kind="chip"
        tone={isPub ? "success" : "default"}
        dot={isPub && !ed ? "success" : "warning"}
        label={pubLabel}
      />
      <PageHeader
        eyebrow={`${W.label} · ${branchName} · today is ${longDay(today)}`}
        title="Roster"
        description="Click any shift to change it. Staff see a week in the staff app once you publish it; later changes notify only the people affected."
        actions={
          <>
            <Segment
              aria-label="Week"
              selectedKey={wk}
              onSelectionChange={(k) => setWk(k === "next" ? "next" : "this")}
            >
              {data.weeks.map((w) => (
                <Segment.Item key={w.id} id={w.id}>
                  {w.segment}
                  {pub[w.id] === "published" ? "" : " · draft"}
                </Segment.Item>
              ))}
            </Segment>
            <Button variant="ghost" onPress={reset}>
              <ArrowsRotateLeft className="size-4" />
              Reset to rotations
            </Button>
            {showPublish ? (
              <Button onPress={() => setDialog(true)}>
                <PaperPlane className="size-4" />
                {publishLabel}
              </Button>
            ) : null}
          </>
        }
      />

      {hasWarnings ? (
        <Alert status="warning" role="status">
          <Alert.Indicator>
            <TriangleExclamation />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>{warnTitle}</Alert.Title>
            <Alert.Description>{warnText}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}
      {isPub ? (
        <Alert status="success" role="status">
          <Alert.Indicator>
            <CircleCheck />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>{pubTitle}</Alert.Title>
            <Alert.Description>{pubNote}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs
          variant="secondary"
          selectedKey={dept}
          onSelectionChange={(k) => setDept(String(k))}
          className="min-w-0 flex-1"
        >
          <Tabs.ListContainer>
            <Tabs.List aria-label="Department" className="justify-start gap-1">
              {tabs.map((t) => (
                <Tabs.Tab key={t.id} id={t.id} className="w-auto flex-none gap-1.5 px-3">
                  {t.label}
                  <Chip size="sm" variant="soft">
                    {t.n}
                  </Chip>
                  <Tabs.Indicator />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
        <ul aria-label="Legend" className="flex flex-wrap items-center gap-3 text-xs text-muted">
          {(Object.keys(LEGEND) as ShiftCode[]).map((k) => (
            <li key={k} className="flex items-center gap-1.5">
              <span aria-hidden="true" className={`inline-block size-3 rounded ${SWATCH[k]}`} />
              {LEGEND[k]}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <Table className="min-w-0 flex-[999_1_640px]">
          <Table.ScrollContainer>
            <Table.Content aria-label={`Roster, ${W.label}`} className="min-w-[760px]">
              <Table.Header>
                <Table.Column isRowHeader className="w-[190px]">
                  Staff · rotation
                </Table.Column>
                {days.map((d) => (
                  <Table.Column key={d} className="px-1 text-center">
                    {d}
                  </Table.Column>
                ))}
                <Table.Column className="text-right">Hours</Table.Column>
              </Table.Header>
              <Table.Body>
                {shownGroups.map((G) => {
                  const rows = staff.filter((p) => p.group === G.id);
                  return (
                    <Fragment key={G.id}>
                      <Table.Row id={`${G.id}-head`}>
                        <Table.Cell colSpan={9} className="bg-surface-secondary px-3 py-1.5">
                          <span className="flex items-center gap-2">
                            <span className="font-semibold">{G.name}</span>
                            <span className="text-xs text-muted">
                              {rows.length} staff · {G.note}
                            </span>
                          </span>
                        </Table.Cell>
                      </Table.Row>
                      {rows.map((p) => {
                        const h = hoursOf(p.id);
                        return (
                          <Table.Row key={p.id} id={p.id}>
                            <Table.Cell className="px-3 py-1">
                              <span className="flex flex-col">
                                <span className="text-[13px] font-medium">{p.name}</span>
                                <span className="text-[11px] leading-[14px] text-muted">
                                  {p.role} · Rotation {p.rotation}
                                </span>
                              </span>
                            </Table.Cell>
                            {grid[p.id].map((v, d) => {
                              const isSel = sel.r === p.id && sel.d === d;
                              const isLent = !!lentNow[`${p.id}-${d}`];
                              return (
                                <Table.Cell key={`${p.id}-${days[d]}`} className="p-[3px]">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    aria-pressed={isSel}
                                    aria-label={`${p.name}, ${longDays[d]}: ${NAME[v]}${isLent ? `, lent to ${otherBranchName}` : ""}. Edit shift`}
                                    onPress={() => setSel({ r: p.id, d })}
                                    className={`h-auto min-h-8 w-full min-w-0 flex-col gap-0 rounded-lg px-1 py-0.5 text-xs font-semibold tabular hover:opacity-90 ${SWATCH[v]} ${isSel ? "outline-2 outline-offset-1 outline-solid outline-[var(--focus)]" : ""}`}
                                  >
                                    {LABEL[v]}
                                    {isLent ? (
                                      <span className="block text-[10px] leading-[11px] font-medium">Lodge</span>
                                    ) : null}
                                  </Button>
                                </Table.Cell>
                              );
                            })}
                            <Table.Cell className="px-3 py-1 text-right text-[13px] tabular">
                              {h > MAX_WEEK_HOURS ? (
                                <Chip size="sm" variant="soft" color="warning">
                                  {h} h
                                </Chip>
                              ) : (
                                `${h} h`
                              )}
                            </Table.Cell>
                          </Table.Row>
                        );
                      })}
                      <Table.Row id={`${G.id}-cover`}>
                        <Table.Cell className="px-3 py-1.5">
                          <span className="text-xs font-medium text-muted">{G.rule}</span>
                        </Table.Cell>
                        {G.min.map((mn, d) => {
                          const n = coverOf(G, d, grid);
                          return (
                            <Table.Cell key={`${G.id}-${days[d]}`} className="p-1 text-center">
                              <Chip size="sm" variant="soft" color={n < mn ? "warning" : "success"} className="tabular">
                                {n} of {mn}
                              </Chip>
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

        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
          <PanelCard dense id="ed-h" title="Edit Shift" description={`${sp.name} · ${longDays[sel.d]} · ${NAME[sv]}`}>
            {sv !== "L" ? (
              <>
                <Fieldset className="m-0 min-w-0 grow-0 basis-auto gap-0 border-0 p-0">
                  <Fieldset.Legend className="sr-only">Shift</Fieldset.Legend>
                  <Fieldset.Group className="grid grid-cols-2 gap-1.5 space-y-0">
                    {(["M", "E", "N", "O"] as ShiftCode[]).map((k) => (
                      <Button
                        key={k}
                        size="sm"
                        variant={sv === k ? "primary" : "secondary"}
                        fullWidth
                        aria-pressed={sv === k}
                        onPress={() => setCell(sp.id, sel.d, k)}
                      >
                        {LEGEND[k]}
                      </Button>
                    ))}
                  </Fieldset.Group>
                </Fieldset>
                <NativeSelect fullWidth className="flex flex-col gap-1">
                  <Label htmlFor="ed-dept">Work in</Label>
                  <NativeSelect.Trigger
                    id="ed-dept"
                    aria-describedby="ed-dept-help"
                    value={selLent ? "lodge" : "home"}
                    onChange={(ev) => setLentCell(sp.id, sel.d, ev.target.value === "lodge")}
                  >
                    <NativeSelect.Option value="home">{home} (home department)</NativeSelect.Option>
                    <NativeSelect.Option value="lodge">Lent to {otherBranchName}</NativeSelect.Option>
                    <NativeSelect.Indicator />
                  </NativeSelect.Trigger>
                  <Description id="ed-dept-help">
                    {selLent
                      ? `Counts toward ${otherBranchName} cover, not ${home.toLowerCase()}.`
                      : "Lend for one shift without changing the home department."}
                  </Description>
                </NativeSelect>
              </>
            ) : (
              <Alert>
                <Alert.Indicator>
                  <Suitcase />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>On approved leave</Alert.Title>
                  <Alert.Description>Leave days come from Leave and cannot be overwritten here.</Alert.Description>
                </Alert.Content>
              </Alert>
            )}
            <KeyValueList
              items={[
                {
                  label: "Hours that week",
                  value: `${hrs} h of a configured ${MAX_WEEK_HOURS} h week${hrs > MAX_WEEK_HOURS ? ` · ${hrs - MAX_WEEK_HOURS} h overtime needs approval` : ""}`,
                },
                {
                  label: "Rotation",
                  value: `Rotation ${sp.rotation} · ${pattern}. Changes apply to the week shown only.`,
                },
              ]}
            />
          </PanelCard>

          <PanelCard
            dense
            id="fill-h"
            title={`Fill ${days[5]} · ${hk.name}`}
            description={`Morning cover ${sat} of ${satMin} · off-duty room attendants`}
            className="gap-2.5"
          >
            {sat < satMin ? (
              fill.map((f) => (
                <div key={f.id} className="flex items-center gap-2">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[13px] font-medium">{f.name}</span>
                    <span className="text-xs text-muted">{f.note}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    aria-label={`Assign ${f.name} to ${longDays[5]}`}
                    onPress={() => setCell(f.id, 5, "M")}
                  >
                    Assign
                  </Button>
                </div>
              ))
            ) : (
              <Chip variant="soft" color="success" className="self-start">
                <Check className="size-3" />
                <Chip.Label>{weekdayLong(dates[5])} meets minimum cover</Chip.Label>
              </Chip>
            )}
          </PanelCard>

          <PanelCard
            dense
            id="sw-h"
            title="Shift Swap Requests"
            description="This week · both people agreed in the staff app"
            className="gap-2.5"
          >
            {swaps.map((w) => (
              <Card key={w.id} variant="secondary" className="gap-1.5 p-3">
                <span className="text-[13px] font-medium">{w.title}</span>
                <span className="text-xs leading-4 text-muted">{w.detail}</span>
                <Chip size="sm" variant="soft" color={w.tone} className="self-start">
                  {w.impact}
                </Chip>
                {w.st === "pending" ? (
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" onPress={() => approveSwap(w)}>
                      Approve swap
                    </Button>
                    <Button size="sm" variant="ghost" onPress={() => decideSwap(w, "declined")}>
                      Decline
                    </Button>
                  </div>
                ) : (
                  <span className="text-xs text-muted">{w.outcome}</span>
                )}
              </Card>
            ))}
          </PanelCard>
        </div>
      </div>

      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(340px,100%),1fr))]">
        <PanelCard
          dense
          id="rot-h"
          title="Rotations"
          description="Patterns that generate each new week before you adjust it"
          className="gap-2.5"
        >
          <ListView aria-label="Rotations" variant="secondary" items={rotations}>
            {(r) => (
              <ListView.Item id={r.id} textValue={r.name}>
                <ListView.ItemContent>
                  <Chip size="sm" variant="soft" className="shrink-0">
                    {r.code}
                  </Chip>
                  <div className="flex min-w-0 flex-col">
                    <ListView.Title className="whitespace-normal">{r.name}</ListView.Title>
                    <ListView.Description className="whitespace-normal">{r.who}</ListView.Description>
                  </div>
                </ListView.ItemContent>
                <ListView.ItemAction>
                  <span className="text-xs text-muted">{r.staff} staff</span>
                </ListView.ItemAction>
              </ListView.Item>
            )}
          </ListView>
        </PanelCard>

        <PanelCard
          dense
          id="hol-h"
          title="Public Holidays"
          description="Rwanda calendar 2026 · configured list, dates of religious holidays confirmed when announced"
          action={<GateChip icon={<ShieldExclamation className="size-3" />}>Configured · unverified</GateChip>}
          className="gap-2.5"
        >
          <div className="flex items-start gap-2">
            <CircleInfo className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
            <span className="text-[13px]">
              No public holidays from 12 to 25 October. Holiday shifts are paid at the holiday rate in Payroll rules.
            </span>
          </div>
          <ListView aria-label="Public holidays" variant="secondary" items={holidays}>
            {(h) => (
              <ListView.Item id={h.id} textValue={h.name}>
                <ListView.ItemContent>
                  <Flag className="size-4 shrink-0 text-muted" aria-hidden="true" />
                  <div className="flex min-w-0 flex-col">
                    <ListView.Title>{h.name}</ListView.Title>
                    <ListView.Description>{h.date}</ListView.Description>
                  </div>
                </ListView.ItemContent>
                <ListView.ItemAction>
                  <span className="text-xs text-muted">{h.rostered}</span>
                </ListView.ItemAction>
              </ListView.Item>
            )}
          </ListView>
          <LinkButton href={screenHref("PayrollRules")} size="sm" variant="ghost" className="self-start">
            Holiday pay rule
          </LinkButton>
        </PanelCard>
      </div>

      <Modal.Backdrop isOpen={dialog} onOpenChange={setDialog}>
        <Modal.Container>
          <Modal.Dialog aria-labelledby="pub-h" className="sm:max-w-[440px]">
            <Modal.Header className="flex flex-col items-start gap-1">
              <Modal.Heading id="pub-h" className="text-lg leading-6 font-semibold">
                {dlgTitle}
              </Modal.Heading>
              <p className="text-sm text-muted">{dlgText}</p>
            </Modal.Header>
            {hasWarnings ? (
              <Modal.Body>
                <Alert status="warning">
                  <Alert.Indicator>
                    <TriangleExclamation />
                  </Alert.Indicator>
                  <Alert.Content>
                    <Alert.Title>{warnTitle}</Alert.Title>
                    <Alert.Description>
                      Nobody is told about the gaps automatically. You can still fill them after publishing.
                    </Alert.Description>
                  </Alert.Content>
                </Alert>
              </Modal.Body>
            ) : null}
            <Modal.Footer>
              <Button slot="close" variant="ghost">
                Keep editing
              </Button>
              <Button onPress={publish}>{confirmLabel}</Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
      <Toast.Provider placement="bottom" />
    </PageContent>
  );
}
