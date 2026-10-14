"use client";

import {
  Ban,
  Bell,
  Box,
  Boxes3,
  Bulb,
  Camera,
  Check,
  CheckDouble,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleInfo,
  CirclePause,
  CirclePlay,
  Clock,
  Key,
  LockOpen,
  Picture,
  Plus,
  Stopwatch,
} from "@gravity-ui/icons";
import { Avatar, Button, Card, Chip, Description, Input, Label, Switch, TextArea, TextField } from "@heroui/react";
import { ItemCard, ListView, Timeline } from "@heroui-pro/react";
import type { Persona } from "@injishi/data";
import type { StaffProfile, StorePart, WorkOrder, WorkOrderPart } from "@injishi/data/fixtures/staff";
import { Icon, KeyValueList, PhoneBody, PhoneTop, toneColor } from "@injishi/ui";
import { type ReactNode, useState } from "react";
import { PhoneActionBar, PhoneSheet, PhoneTitle, PhotoTile, renderAsButton, renderSection } from "./parts";

export interface TechWorkOrdersData {
  profile: StaffProfile;
  orders: WorkOrder[];
  store: StorePart[];
}

type Status = WorkOrder["status"] | "resolved";

const STATUS: Record<Status, { label: string; color: "accent" | "warning" | "default" | "success" }> = {
  new: { label: "New", color: "accent" },
  progress: { label: "In progress", color: "accent" },
  parts: { label: "Waiting for parts", color: "warning" },
  planned: { label: "Planned", color: "default" },
  resolved: { label: "Resolved", color: "success" },
};

const PRIORITY: Record<WorkOrder["priority"], "danger" | "warning" | "default"> = {
  Urgent: "danger",
  High: "warning",
  Normal: "default",
  Planned: "default",
};

/** The time a job started today on the demo clock, and the time it is "now". */
const STARTED_AT = "11:12";
const STOPPED_AT = "11:13";

type KeyedPart = WorkOrderPart & { key: string };
type KeyedNote = WorkOrder["notes"][number] & { key: string };

interface Step {
  status: "success" | "current" | "default";
  icon: ReactNode;
  title: string;
  detail: string;
}

/** Technician's work orders: queue, and one job with photos, block, parts, time and notes (artifact: TechWorkOrders). */
export function TechWorkOrdersView({ persona, data }: { persona: Persona; data: TechWorkOrdersData }) {
  const { profile, orders, store } = data;
  const [view, setView] = useState<"queue" | "detail">("detail");
  const [woId, setWoId] = useState(orders.find((o) => o.status === "progress")?.id ?? orders[0]?.id ?? "");
  const [status, setStatus] = useState<Record<string, WorkOrder["status"]>>({});
  const [added, setAdded] = useState<Record<string, KeyedPart[]>>({});
  /** Photos taken on this phone, per work order (ids are capture times). */
  const [extraPhotos, setExtraPhotos] = useState<Record<string, number[]>>({});
  const [timing, setTiming] = useState(true);
  const [notes, setNotes] = useState<Record<string, KeyedNote[]>>({});
  const [draft, setDraft] = useState("");
  const [sheet, setSheet] = useState<"" | "parts" | "resolve">("");
  const [askRelease, setAskRelease] = useState(true);
  const [resolved, setResolved] = useState<Record<string, boolean>>({});

  const statusOf = (o: WorkOrder): Status => (resolved[o.id] ? "resolved" : (status[o.id] ?? o.status));
  const openCount = orders.filter((o) => statusOf(o) !== "resolved").length;
  const until = profile.shift.split("–")[1]?.trim() ?? "";

  const w = orders.find((o) => o.id === woId) ?? orders[0];
  const s = statusOf(w);
  const isResolved = s === "resolved";
  const photos = [
    ...w.photos.map((p) => ({ ...p, key: p.caption })),
    ...(extraPhotos[w.id] ?? []).map((id) => ({ caption: "Just now", image: null, key: `new-${id}` })),
  ];
  const parts: KeyedPart[] = [...w.parts.map((p) => ({ ...p, key: p.name })), ...(added[w.id] ?? [])];
  const running = w.repair ? timing && !isResolved : s === "progress" && timing && !isResolved;
  const log = w.log.map((l) => ({ ...l, live: false }));
  if (w.repair)
    log.push({
      what: "Repair",
      when: running ? `Today · ${w.repair.start} – now` : `Today · ${w.repair.start} – ${w.repair.stopped}`,
      dur: w.repair.dur,
      live: running,
    });
  else if (s === "progress")
    log.push({
      what: "Repair",
      when: running ? `Today · ${STARTED_AT} – now` : `Today · ${STARTED_AT} – ${STOPPED_AT}`,
      dur: "1 min",
      live: running,
    });
  const timeTotal = w.timeTotal ?? (log.length ? "" : "Nothing logged yet");
  const canTime = !isResolved && (!!w.repair || s === "progress");
  const woNotes: KeyedNote[] = [...w.notes.map((n) => ({ ...n, key: `${n.who}-${n.when}` })), ...(notes[w.id] ?? [])];
  const block = w.block;

  const fixed: Step = {
    status: "success",
    icon: <Check />,
    title: "Fixed by you",
    detail: `Today 11:20 · ${parts.length} part${parts.length === 1 ? "" : "s"} · time logged`,
  };
  const release: Step[] = !block
    ? [fixed, { status: "default", icon: <Bell />, title: "Reporter gets a message", detail: w.from }]
    : askRelease
      ? [
          fixed,
          {
            status: "current",
            icon: <CheckDouble />,
            title: "Room check by Beatrice",
            detail: "Housekeeping inspects before guests",
          },
          {
            status: "default",
            icon: <LockOpen />,
            title: "Aline releases the block",
            detail: "Only the manager can put the room back on sale",
          },
          { status: "default", icon: <Key />, title: "Back on sale", detail: "Front desk sees it as available" },
        ]
      : [fixed, { status: "default", icon: <Ban />, title: "Block stays as approved", detail: block.keep }];

  const openOrder = (id: string) => {
    setWoId(id);
    setView("detail");
    setSheet("");
    setDraft("");
  };

  const addNote = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    setNotes((n) => ({
      ...n,
      [w.id]: [
        ...(n[w.id] ?? []),
        { key: `note-${Date.now()}`, initials: persona.initials, who: "You", when: "now", text },
      ],
    }));
  };

  return (
    <>
      {view === "queue" ? (
        <PhoneTop>
          <Avatar size="sm" variant="soft" color="warning">
            <Avatar.Fallback>{persona.initials}</Avatar.Fallback>
          </Avatar>
          <PhoneTitle title="My work orders" sub={`${persona.name} · ${profile.department} · until ${until}`} />
        </PhoneTop>
      ) : (
        <PhoneTop>
          <Button
            variant="ghost"
            isIconOnly
            aria-label="Back to my work orders"
            className="size-11"
            onPress={() => {
              setView("queue");
              setSheet("");
            }}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <PhoneTitle title={<span className="tabular">{w.ref}</span>} sub={`${w.where} · ${w.what}`} />
          <Chip size="sm" variant="soft" color={STATUS[s].color} className="shrink-0">
            {STATUS[s].label}
          </Chip>
        </PhoneTop>
      )}

      <PhoneBody key={`${view}-${w.id}`}>
        {view === "queue" ? (
          <>
            <p className="text-[13px] leading-[18px] text-muted">
              {openCount} open · most urgent first. Only jobs assigned to you or the maintenance team.
            </p>
            {orders.map((o) => (
              <ItemCard<"button">
                key={o.id}
                render={renderAsButton}
                onClick={() => openOrder(o.id)}
                aria-label={`${o.ref}: ${o.where} · ${o.what}`}
                className="min-h-[72px] w-full shrink-0 cursor-pointer items-start text-left"
              >
                <ItemCard.Icon>
                  <Icon name={o.icon} />
                </ItemCard.Icon>
                <ItemCard.Content className="gap-[2px]">
                  <span className="flex items-center gap-[6px]">
                    <span className="text-xs text-muted tabular">{o.ref}</span>
                    <Chip size="sm" variant="soft" color={PRIORITY[o.priority]}>
                      {o.priority}
                    </Chip>
                  </span>
                  <ItemCard.Title className="whitespace-normal">
                    {o.where} · {o.what}
                  </ItemCard.Title>
                  <ItemCard.Description>
                    {STATUS[statusOf(o)].label} · {o.age}
                  </ItemCard.Description>
                </ItemCard.Content>
                <ItemCard.Action className="self-center">
                  <ChevronRight className="size-4 text-muted" />
                </ItemCard.Action>
              </ItemCard>
            ))}
          </>
        ) : (
          <>
            <Card render={renderSection} aria-label="Summary" className="gap-[8px] p-[16px]">
              <div className="flex flex-wrap items-center gap-[6px]">
                <Chip variant="soft" color={PRIORITY[w.priority]}>
                  {w.priority} priority
                </Chip>
                <Chip variant="soft">
                  <Clock className="size-3" />
                  <Chip.Label>{w.age} old</Chip.Label>
                </Chip>
              </div>
              <span className="text-[13px] leading-[18px] text-muted">
                {w.opened} · from {w.from}
              </span>
            </Card>

            {isResolved ? (
              <Card render={renderSection} role="status" aria-labelledby="rs-h" className="gap-[12px] p-[16px]">
                <div className="flex items-start justify-between gap-[8px]">
                  <h2 id="rs-h" className="text-[15px] leading-[22px] font-semibold">
                    {!block ? "Resolved" : askRelease ? "Resolved · release requested" : "Resolved · block kept"}
                  </h2>
                  {block ? (
                    <Chip size="sm" variant="soft" color={block.tone}>
                      {block.chip}
                    </Chip>
                  ) : null}
                </div>
                <Timeline size="sm" density="compact">
                  {release.map((g) => (
                    <Timeline.Item key={g.title} status={g.status}>
                      <Timeline.Rail>
                        <Timeline.Marker>{g.icon}</Timeline.Marker>
                        <Timeline.Connector />
                      </Timeline.Rail>
                      <Timeline.Content>
                        <span className="font-medium">{g.title}</span>
                        <span className="text-xs leading-4 text-muted">{g.detail}</span>
                      </Timeline.Content>
                    </Timeline.Item>
                  ))}
                </Timeline>
                <Button
                  variant="ghost"
                  className="min-h-11 self-start"
                  onPress={() => setResolved((r) => ({ ...r, [w.id]: false }))}
                >
                  Reopen
                </Button>
              </Card>
            ) : null}

            <section className="flex flex-col gap-[8px]" aria-labelledby="ph-h">
              <h2 id="ph-h" className="text-[15px] leading-[22px] font-semibold">
                Photos
              </h2>
              <div className="grid grid-cols-3 gap-[8px]">
                {photos.map((p) =>
                  p.image ? (
                    <PhotoTile
                      priority
                      key={p.key}
                      image={p.image}
                      caption={p.caption}
                      sizes="120px"
                      className="h-[84px] rounded-[14px]"
                    />
                  ) : (
                    <figure
                      key={p.key}
                      className="m-0 flex h-[84px] flex-col items-center justify-center gap-[4px] rounded-[14px] bg-surface-secondary p-[4px] text-center text-muted"
                    >
                      <Picture className="size-5" aria-hidden="true" />
                      <figcaption className="text-[11px] leading-[13px]">{p.caption}</figcaption>
                    </figure>
                  ),
                )}
                <Button
                  variant="secondary"
                  fullWidth
                  className="h-[84px] flex-col gap-[4px] rounded-[14px]"
                  onPress={() => setExtraPhotos((x) => ({ ...x, [w.id]: [...(x[w.id] ?? []), Date.now()] }))}
                >
                  <Camera className="size-5" />
                  Add
                </Button>
              </div>
            </section>

            {block ? (
              <Card
                render={renderSection}
                aria-labelledby="bk-h"
                className={`gap-[6px] p-[16px] ${
                  block.tone === "danger"
                    ? "shadow-[inset_3px_0_0_var(--danger),var(--surface-shadow)]"
                    : "shadow-[inset_3px_0_0_var(--warning),var(--surface-shadow)]"
                }`}
              >
                <div className="flex items-start justify-between gap-[8px]">
                  <h2 id="bk-h" className="flex items-center gap-[8px] text-[15px] leading-[22px] font-semibold">
                    <Ban
                      className={`size-4 shrink-0 ${block.tone === "danger" ? "text-danger" : "text-warning"}`}
                      aria-hidden="true"
                    />
                    {block.title}
                  </h2>
                  <Chip size="sm" variant="soft" color={block.tone} className="shrink-0">
                    {block.chip}
                  </Chip>
                </div>
                <p className="text-[13px] leading-[18px] text-muted">{block.text}</p>
              </Card>
            ) : null}

            {w.recommendation ? (
              <Card render={renderSection} variant="secondary" aria-labelledby="rc-h" className="gap-[8px] p-[16px]">
                <div className="flex items-center justify-between gap-[8px]">
                  <h2 id="rc-h" className="flex items-center gap-[8px] text-[15px] leading-[22px] font-semibold">
                    <Bulb className="size-4 shrink-0" aria-hidden="true" />
                    Recommendation
                  </h2>
                  <Chip size="sm" variant="soft" color="accent">
                    Reviewed by manager
                  </Chip>
                </div>
                <p className="font-medium">{w.recommendation.title}</p>
                <p className="text-[13px] leading-[18px] text-muted">{w.recommendation.why}</p>
                <div className="[&>dl]:grid-cols-[max-content_minmax(0,1fr)]">
                  <KeyValueList
                    items={[
                      { label: "Confidence", value: w.recommendation.confidence },
                      { label: "Reviewed", value: w.recommendation.reviewed },
                    ]}
                  />
                </div>
                <p className="text-xs leading-4 text-muted">{w.recommendation.note}</p>
              </Card>
            ) : null}

            <Card render={renderSection} aria-labelledby="pt-h" className="gap-[8px] p-[16px]">
              <h2 id="pt-h" className="text-[15px] leading-[22px] font-semibold">
                Parts used
              </h2>
              {parts.length ? (
                parts.map((p) => (
                  <div key={p.key} className="flex min-h-12 items-center gap-[10px] border-t border-separator pt-[8px]">
                    <Boxes3 className="size-4 shrink-0 text-muted" aria-hidden="true" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-medium">
                        {p.name} <span className="text-muted tabular">{p.qty}</span>
                      </span>
                      <span className="text-xs leading-4 text-muted">{p.meta}</span>
                    </span>
                    <Chip size="sm" variant="soft" color={toneColor(p.tone)} className="shrink-0">
                      {p.chip}
                    </Chip>
                  </div>
                ))
              ) : (
                <p className="text-[13px] text-muted">No parts used yet.</p>
              )}
              <Button variant="secondary" size="lg" fullWidth className="min-h-12" onPress={() => setSheet("parts")}>
                <Plus className="size-4" />
                Add part from store
              </Button>
            </Card>

            <Card render={renderSection} aria-labelledby="tl-h" className="gap-[8px] p-[16px]">
              <div className="flex items-center justify-between gap-[8px]">
                <h2 id="tl-h" className="text-[15px] leading-[22px] font-semibold">
                  Time log
                </h2>
                <span className="text-xs text-muted tabular">{timeTotal}</span>
              </div>
              {log.map((l) => (
                <div
                  key={`${l.what}-${l.when}`}
                  className="flex items-center gap-[10px] border-t border-separator pt-[8px]"
                >
                  {l.live ? (
                    <Stopwatch className="size-4 shrink-0 text-accent" aria-hidden="true" />
                  ) : (
                    <Clock className="size-4 shrink-0 text-muted" aria-hidden="true" />
                  )}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium">{l.what}</span>
                    <span className="text-xs leading-4 text-muted tabular">{l.when}</span>
                  </span>
                  <span className="font-semibold tabular">{l.dur}</span>
                </div>
              ))}
              {canTime ? (
                <Button
                  variant="secondary"
                  size="lg"
                  fullWidth
                  className="min-h-12"
                  onPress={() => setTiming((t) => !t)}
                >
                  {running ? <CirclePause className="size-4" /> : <CirclePlay className="size-4" />}
                  {running ? "Stop timer" : "Start timer"}
                </Button>
              ) : null}
            </Card>

            <Card render={renderSection} aria-labelledby="nt-h" className="gap-[10px] p-[16px]">
              <h2 id="nt-h" className="text-[15px] leading-[22px] font-semibold">
                Notes
              </h2>
              {woNotes.map((n) => (
                <div key={n.key} className="flex items-start gap-[10px]">
                  <Avatar size="sm" variant="soft">
                    <Avatar.Fallback>{n.initials}</Avatar.Fallback>
                  </Avatar>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-xs leading-4">
                      <span className="font-semibold">{n.who}</span> <span className="text-muted">{n.when}</span>
                    </span>
                    <span className="text-[13px] leading-[18px]">{n.text}</span>
                  </span>
                </div>
              ))}
              <div className="flex items-end gap-[8px]">
                <TextField value={draft} onChange={setDraft} className="flex-1">
                  <Label className="sr-only">Add a note</Label>
                  <Input
                    placeholder="Add a note"
                    className="min-h-11"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addNote();
                    }}
                  />
                </TextField>
                <Button variant="secondary" className="min-h-11" onPress={addNote}>
                  Add
                </Button>
              </div>
            </Card>
          </>
        )}
      </PhoneBody>

      {view === "detail" && s === "new" ? (
        <PhoneActionBar>
          <Button
            size="lg"
            className="min-h-14 flex-1"
            onPress={() => {
              setStatus((st) => ({ ...st, [w.id]: "progress" }));
              setTiming(true);
            }}
          >
            <CirclePlay className="size-4" />
            Start work
          </Button>
        </PhoneActionBar>
      ) : null}
      {view === "detail" && !isResolved && s !== "new" ? (
        <PhoneActionBar>
          <Button size="lg" className="min-h-14 flex-1" onPress={() => setSheet("resolve")}>
            <CircleCheck className="size-4" />
            Resolve
          </Button>
        </PhoneActionBar>
      ) : null}

      <PhoneSheet
        isOpen={sheet === "parts"}
        onOpenChange={(o) => !o && setSheet("")}
        heading="Add part from store"
        description="Patrick issues it from the store. It counts as used once he confirms."
      >
        <ListView
          aria-label="Parts in store"
          items={store}
          disabledKeys={store.filter((p) => !p.available).map((p) => p.id)}
          onAction={(key) => {
            const part = store.find((p) => p.id === key);
            if (!part?.available) return;
            setSheet("");
            setAdded((a) => ({
              ...a,
              [w.id]: [
                ...(a[w.id] ?? []),
                {
                  key: `req-${Date.now()}`,
                  name: part.name,
                  qty: "× 1",
                  meta: "Requested just now · Patrick confirms the issue",
                  chip: "Requested",
                  tone: "warning",
                },
              ],
            }));
          }}
          className="shrink-0"
        >
          {(p) => (
            <ListView.Item id={p.id} textValue={p.name} className="min-h-14">
              <ListView.ItemContent>
                <Box className="size-4 shrink-0" aria-hidden="true" />
                <div className="flex min-w-0 flex-col">
                  <ListView.Title>{p.name}</ListView.Title>
                  <ListView.Description>{p.stock}</ListView.Description>
                </div>
              </ListView.ItemContent>
              <ListView.ItemAction>
                {p.available ? (
                  <Plus className="size-4 text-muted" aria-hidden="true" />
                ) : (
                  <Ban className="size-4 text-muted" aria-hidden="true" />
                )}
              </ListView.ItemAction>
            </ListView.Item>
          )}
        </ListView>
        <Button variant="secondary" size="lg" fullWidth className="min-h-14" onPress={() => setSheet("")}>
          Close
        </Button>
      </PhoneSheet>

      <PhoneSheet
        isOpen={sheet === "resolve"}
        onOpenChange={(o) => !o && setSheet("")}
        heading={`Resolve ${w.ref}`}
        description={`${w.where} · ${w.what}`}
      >
        <TextField key={w.id} defaultValue={w.fix} fullWidth className="flex flex-col gap-1">
          <Label>What did you do?</Label>
          <TextArea rows={3} />
        </TextField>
        {block ? (
          <>
            <Switch
              size="lg"
              isSelected={askRelease}
              onChange={setAskRelease}
              className="min-h-[52px] w-full flex-row items-center gap-[12px]"
            >
              <Switch.Content className="flex flex-1 flex-col items-start text-left">
                <Label className="font-semibold">Ask to release the block</Label>
                <Description className="text-xs leading-4">Room goes back on sale after checks</Description>
              </Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch>
            <p className="flex items-start gap-[8px] text-xs leading-4 text-muted">
              <CircleInfo className="mt-[1px] size-4 shrink-0" aria-hidden="true" />
              <span>
                {askRelease
                  ? "The room stays blocked until Beatrice checks it and Aline releases it. You cannot put it back on sale yourself."
                  : block.keep}
              </span>
            </p>
          </>
        ) : null}
        <div className="grid grid-cols-[1fr_2fr] gap-[8px]">
          <Button variant="secondary" size="lg" fullWidth className="min-h-14" onPress={() => setSheet("")}>
            Cancel
          </Button>
          <Button
            size="lg"
            fullWidth
            className="min-h-14"
            onPress={() => {
              setSheet("");
              setTiming(false);
              setResolved((r) => ({ ...r, [w.id]: true }));
            }}
          >
            Mark resolved
          </Button>
        </div>
      </PhoneSheet>
    </>
  );
}
