"use client";

import {
  ArrowRight,
  ArrowRightToSquare,
  Box,
  Camera,
  Check,
  CheckDouble,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleDashed,
  CirclePause,
  CirclePlay,
  Clock,
  CloudSlash,
  Key,
  PaperPlane,
  ShieldExclamation,
  TriangleExclamation,
  Wrench,
} from "@gravity-ui/icons";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Chip,
  Input,
  Label,
  ProgressBar,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@heroui/react";
import { ItemCard, ListView, Segment, Timeline } from "@heroui-pro/react";
import { NumberStepper } from "@heroui-pro/react/number-stepper";
import { type Persona, screenHref } from "@injishi/data";
import type {
  ChecklistSection,
  CleaningRoom,
  FinishedRoom,
  FoundItem,
  FoundItemSpot,
  MinibarItem,
  StaffProfile,
} from "@injishi/data/fixtures/staff";
import { stock } from "@injishi/data/media";
import { Icon, LinkButton, PhoneBody, PhoneTop, Photo, toneColor } from "@injishi/ui";
import { useState } from "react";
import { PhoneActionBar, PhoneSheet, PhoneTitle, renderSection, ToneTile } from "./parts";

export interface StaffTaskData {
  rooms: CleaningRoom[];
  finished: FinishedRoom[];
  sections: ChecklistSection[];
  minibar: MinibarItem[];
  spots: FoundItemSpot[];
  found: FoundItem;
  profile: StaffProfile;
}

type RoomStatus = CleaningRoom["status"];

/** Housekeeper's room task: checklist, minibar count, found items and "mark clean" (artifact: StaffTask). */
export function StaffTaskView({
  persona,
  data,
  offline = false,
}: {
  persona: Persona;
  data: StaffTaskData;
  offline?: boolean;
}) {
  const { rooms, finished, sections, minibar, spots, found, profile } = data;
  const [view, setView] = useState<"task" | "rooms">("task");
  const [roomNo, setRoomNo] = useState(() => (rooms.find((r) => r.status === "cleaning") ?? rooms[0]).no);
  const [status, setStatus] = useState<Record<string, RoomStatus>>(() =>
    Object.fromEntries(rooms.map((r) => [r.no, r.status])),
  );
  const [checks, setChecks] = useState<Set<string>>(
    () => new Set(rooms.flatMap((r) => r.ticked.map((id) => `${r.no}:${id}`))),
  );
  const [paused, setPaused] = useState(false);
  const [used, setUsed] = useState<Record<string, number>>(() =>
    Object.fromEntries(minibar.map((m) => [m.id, m.used])),
  );
  const [miniSent, setMiniSent] = useState(false);
  const [sheet, setSheet] = useState<"" | "confirm" | "found">("");
  const [spot, setSpot] = useState(found.spot);
  const [foundPhoto, setFoundPhoto] = useState(true);
  const [foundLogged, setFoundLogged] = useState(false);

  const r = rooms.find((x) => x.no === roomNo) ?? rooms[0];
  const roomStatus = status[r.no];
  const isTask = view === "task";

  let doneN = 0;
  let totalN = 0;
  const left: string[] = [];
  const sectionRows = sections.map((s) => {
    const items = s.items.map((it) => {
      const key = `${r.no}:${it.id}`;
      const on = checks.has(key);
      if (!on) left.push(it.label);
      return { ...it, key, on };
    });
    const n = items.filter((i) => i.on).length;
    doneN += n;
    totalN += items.length;
    return { ...s, items, n };
  });
  const pct = totalN ? Math.round((doneN / totalN) * 100) : 0;
  const usedTotal = minibar.reduce((a, m) => a + (used[m.id] ?? 0), 0);

  const toggleCheck = (key: string, on: boolean) =>
    setChecks((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });

  const finish = () => {
    setSheet("");
    setPaused(false);
    setStatus((s) => ({ ...s, [r.no]: "done" }));
  };
  const markClean = () => (left.length ? setSheet("confirm") : finish());

  const statusChip =
    roomStatus === "cleaning"
      ? paused
        ? { label: "Paused", color: "default" as const }
        : { label: "Cleaning", color: "accent" as const }
      : roomStatus === "waiting"
        ? { label: "Waiting", color: "default" as const }
        : offline
          ? { label: "Not sent yet", color: "warning" as const }
          : { label: "Clean", color: "success" as const };

  const nextRoom = rooms.find((x) => x.no !== r.no && status[x.no] !== "done");
  const todo = rooms.filter((x) => status[x.no] !== "done");
  const finishedNow = rooms
    .filter((x) => status[x.no] === "done")
    .map((x) => ({
      id: x.id,
      no: x.no,
      kind: x.kind,
      when: offline ? "Just now · saved on phone" : "Just now · waiting for inspection",
      state: offline ? "Not sent yet" : "Clean",
      stateTone: offline ? ("warning" as const) : ("success" as const),
    }));
  const fin = [...finishedNow, ...finished];
  const spotPhrase = spots.find((s) => s.id === spot)?.phrase ?? spot;

  const openRoom = (no: string) => {
    setRoomNo(no);
    setView("task");
    setSheet("");
  };

  return (
    <>
      <PhoneTop>
        <LinkButton
          href={screenHref("StaffToday")}
          variant="ghost"
          isIconOnly
          aria-label="Back to today"
          title="Back to today"
          className="size-11"
        >
          <ChevronLeft className="size-4" />
        </LinkButton>
        <PhoneTitle
          title={isTask ? `Room ${r.no}` : "My rooms"}
          sub={isTask ? `${r.kind} · ${r.type} · ${r.floor}` : `${persona.name} · ${profile.area} · ${profile.site}`}
        />
        <LinkButton
          href={screenHref("StaffReport")}
          variant="ghost"
          isIconOnly
          aria-label="Report a problem"
          title="Report a problem"
          className="size-11"
        >
          <TriangleExclamation className="size-4" />
        </LinkButton>
      </PhoneTop>

      <div className="shrink-0 px-[16px] pb-[8px]">
        <Segment
          aria-label="Show"
          size="lg"
          selectedKey={view}
          onSelectionChange={(k) => {
            setView(k === "rooms" ? "rooms" : "task");
            setSheet("");
          }}
          className="w-full"
        >
          <Segment.Item id="task" className="h-11 flex-1">
            Room {r.no}
          </Segment.Item>
          <Segment.Item id="rooms" className="h-11 flex-1">
            My rooms · {rooms.length + finished.length}
          </Segment.Item>
        </Segment>
      </div>

      <PhoneBody key={isTask ? r.no : "rooms"}>
        {offline ? (
          <Alert status="warning" role="status">
            <Alert.Indicator>
              <CloudSlash />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>No connection</Alert.Title>
              <Alert.Description>
                Keep working. Ticks and reports are saved on this phone and send when signal is back.
              </Alert.Description>
            </Alert.Content>
          </Alert>
        ) : null}

        {isTask && roomStatus !== "done" ? (
          <>
            <Card render={renderSection} className="gap-[12px] p-[16px]" aria-label="Room summary">
              <div className="flex flex-wrap items-center gap-[6px]">
                <Chip color="accent" variant="soft">
                  {r.kind}
                </Chip>
                <Chip color="warning" variant="soft">
                  <Clock className="size-3" />
                  <Chip.Label>{r.due}</Chip.Label>
                </Chip>
                <Chip color={statusChip.color} variant="soft">
                  {statusChip.label}
                </Chip>
              </div>
              <div className="flex items-start gap-[10px]">
                <ArrowRightToSquare className="mt-[2px] size-4 shrink-0 text-muted" aria-hidden="true" />
                <div className="flex min-w-0 flex-col">
                  <span className="font-semibold">{r.arrival}</span>
                  <span className="text-xs leading-4 text-muted">{r.arrivalNote}</span>
                </div>
              </div>
              <ProgressBar
                value={pct}
                aria-label="Checks done"
                valueLabel={`${doneN} of ${totalN}`}
                className="flex flex-col gap-[6px]"
              >
                <div className="flex items-center justify-between">
                  <Label>Checks done</Label>
                  <ProgressBar.Output className="tabular" />
                </div>
                <ProgressBar.Track>
                  <ProgressBar.Fill />
                </ProgressBar.Track>
              </ProgressBar>
              <p className="text-xs leading-4 text-muted">{r.history}</p>
            </Card>

            {sectionRows.map((s) => (
              <Card key={s.id} render={renderSection} className="gap-0 p-[8px]" aria-label={`${s.title} checks`}>
                <div className="flex items-center gap-[8px] px-[8px] pt-[8px] pb-[6px]">
                  <Icon name={s.icon} className="size-4 text-muted" />
                  <h2 className="flex-1 text-[15px] leading-[22px] font-semibold">{s.title}</h2>
                  <Chip size="sm" variant="soft" color={s.n === s.items.length ? "success" : "default"}>
                    {s.n} of {s.items.length}
                  </Chip>
                </div>
                {s.items.map((it) => (
                  <Checkbox
                    key={it.key}
                    isSelected={it.on}
                    onChange={(on) => toggleCheck(it.key, on)}
                    className="w-full"
                  >
                    <Checkbox.Content className="flex min-h-12 w-full items-center gap-[12px] rounded-[12px] px-[8px] py-[6px] hover:bg-surface-secondary">
                      <Checkbox.Control className="size-[22px] rounded-[7px]">
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                      <span className={`flex-1 ${it.on ? "text-muted" : ""}`}>{it.label}</span>
                    </Checkbox.Content>
                  </Checkbox>
                ))}
              </Card>
            ))}

            <Card render={renderSection} className="gap-[10px] p-[16px]" aria-labelledby="mb-h">
              <div className="flex items-start justify-between gap-[8px]">
                <div className="flex flex-col gap-[2px]">
                  <h2 id="mb-h" className="text-[15px] leading-[22px] font-semibold">
                    Minibar count
                  </h2>
                  <span className="text-xs leading-4 text-muted">
                    Count what was used. Front desk checks it and decides any charge.
                  </span>
                </div>
                <Chip size="sm" variant="soft">
                  Report only
                </Chip>
              </div>
              {minibar.map((m) => (
                <div key={m.id} className="flex min-h-[52px] items-center justify-between gap-[8px]">
                  <div className="flex flex-col">
                    <span className="font-medium">{m.label}</span>
                    <span className="text-xs leading-4 text-muted">Stocked: {m.stocked}</span>
                  </div>
                  <NumberStepper
                    size="lg"
                    aria-label={`${m.label} used`}
                    value={used[m.id] ?? 0}
                    minValue={0}
                    maxValue={9}
                    onChange={(v) => setUsed((u) => ({ ...u, [m.id]: Number.isNaN(v) ? 0 : v }))}
                    isDisabled={miniSent}
                  >
                    <NumberStepper.Group>
                      <NumberStepper.DecrementButton aria-label={`One less ${m.label}`} className="size-11" />
                      <NumberStepper.Value className="min-w-9 tabular" />
                      <NumberStepper.IncrementButton aria-label={`One more ${m.label}`} className="size-11" />
                    </NumberStepper.Group>
                  </NumberStepper>
                </div>
              ))}
              {miniSent ? (
                <>
                  <Alert status={offline ? "warning" : "success"} role="status">
                    <Alert.Indicator>{offline ? <CloudSlash /> : <CircleCheck />}</Alert.Indicator>
                    <Alert.Content>
                      <Alert.Title>
                        {offline
                          ? "Saved on phone · will send"
                          : usedTotal
                            ? "Sent to front desk at 10:58"
                            : "Nothing used · sent at 10:58"}
                      </Alert.Title>
                      <Alert.Description>
                        {offline
                          ? "Front desk gets the count when you are back online."
                          : usedTotal
                            ? `${usedTotal} items reported. Eric checks the folio; you do not take any money.`
                            : "Front desk will not add minibar charges for this stay."}
                      </Alert.Description>
                    </Alert.Content>
                  </Alert>
                  <Button variant="ghost" className="min-h-11 self-start" onPress={() => setMiniSent(false)}>
                    Change the count
                  </Button>
                </>
              ) : (
                <Button variant="secondary" size="lg" fullWidth className="min-h-14" onPress={() => setMiniSent(true)}>
                  <PaperPlane className="size-4" />
                  Send count to front desk
                </Button>
              )}
            </Card>

            <Card render={renderSection} className="gap-[10px] p-[16px]" aria-labelledby="else-h">
              <h2 id="else-h" className="text-[15px] leading-[22px] font-semibold">
                Something else in this room?
              </h2>
              <div className="grid grid-cols-2 gap-[8px]">
                <Button variant="secondary" size="lg" fullWidth className="min-h-14" onPress={() => setSheet("found")}>
                  <Box className="size-4" />
                  Found an item
                </Button>
                <LinkButton
                  href={screenHref("StaffReport")}
                  variant="secondary"
                  size="lg"
                  fullWidth
                  className="min-h-14"
                >
                  <Wrench className="size-4" />
                  Report a problem
                </LinkButton>
              </div>
              {foundLogged ? (
                <ItemCard variant="secondary">
                  <ItemCard.Icon>
                    <Box />
                  </ItemCard.Icon>
                  <ItemCard.Content>
                    <ItemCard.Title>
                      {found.name} · {found.ref}
                    </ItemCard.Title>
                    <ItemCard.Description className="whitespace-normal">
                      Found in the {spotPhrase} · with you until you hand it to {found.holder}
                    </ItemCard.Description>
                  </ItemCard.Content>
                  <ItemCard.Action>
                    <Chip size="sm" variant="soft" color={offline ? "warning" : "default"}>
                      {offline ? "Not sent yet" : "Logged"}
                    </Chip>
                  </ItemCard.Action>
                </ItemCard>
              ) : null}
            </Card>
          </>
        ) : null}

        {isTask && roomStatus === "done" ? (
          <Card render={renderSection} className="gap-[14px] p-[20px]" aria-labelledby="done-h">
            <ToneTile tone={offline ? "warning" : "success"}>{offline ? <CloudSlash /> : <CircleCheck />}</ToneTile>
            <div className="flex flex-col gap-1">
              <h2 id="done-h" className="text-xl leading-[26px] font-semibold">
                Room {r.no} marked clean
              </h2>
              <p className="text-muted">
                {offline
                  ? "Saved on this phone at 11:06. Front desk still sees the room as dirty until it sends."
                  : "Sent at 11:06. Front desk sees it as Clean, not Ready. It becomes Ready after Beatrice inspects it."}
              </p>
            </div>
            <Timeline size="sm" density="compact">
              <Timeline.Item status={offline ? "warning" : "success"}>
                <Timeline.Rail>
                  <Timeline.Marker>{offline ? <CloudSlash /> : <Check />}</Timeline.Marker>
                  <Timeline.Connector />
                </Timeline.Rail>
                <Timeline.Content>
                  <span className="font-medium">Cleaned by you</span>
                  <span className="text-xs leading-4 text-muted">
                    {offline ? "11:06 · waiting for signal" : `11:06 · ${doneN} of ${totalN} checks ticked`}
                  </span>
                </Timeline.Content>
              </Timeline.Item>
              <Timeline.Item status={offline ? "default" : "current"}>
                <Timeline.Rail>
                  <Timeline.Marker>
                    <CheckDouble />
                  </Timeline.Marker>
                  <Timeline.Connector />
                </Timeline.Rail>
                <Timeline.Content>
                  <span className="font-medium">Inspection by Beatrice</span>
                  <span className="text-xs leading-4 text-muted">Required before the room can be sold</span>
                </Timeline.Content>
              </Timeline.Item>
              <Timeline.Item status="default">
                <Timeline.Rail>
                  <Timeline.Marker>
                    <Key />
                  </Timeline.Marker>
                  <Timeline.Connector />
                </Timeline.Rail>
                <Timeline.Content>
                  <span className="font-medium">Ready for front desk</span>
                  <span className="text-xs leading-4 text-muted">{r.arrival}</span>
                </Timeline.Content>
              </Timeline.Item>
            </Timeline>
            {nextRoom ? (
              <Button size="lg" fullWidth className="min-h-14" onPress={() => openRoom(nextRoom.no)}>
                Next: Room {nextRoom.no} · {nextRoom.kind}
                <ArrowRight className="size-4" />
              </Button>
            ) : null}
            <LinkButton href={screenHref("StaffToday")} variant="secondary" size="lg" fullWidth className="min-h-14">
              Back to today
            </LinkButton>
          </Card>
        ) : null}

        {!isTask ? (
          <>
            <p className="text-[13px] leading-[18px] text-muted">
              Only rooms Beatrice assigned to you today. If a room is missing, ask her to add it.
            </p>
            <section className="flex flex-col gap-[8px]" aria-labelledby="todo-h">
              <h2 id="todo-h" className="text-[15px] leading-[22px] font-semibold">
                To do · {todo.length}
              </h2>
              <ListView aria-label="To do" items={todo} onAction={(key) => openRoom(String(key))} className="shrink-0">
                {(t) => (
                  <ListView.Item id={t.no} textValue={`Room ${t.no}`} className="min-h-[60px]">
                    <ListView.ItemContent>
                      <span className="w-10 shrink-0 text-lg leading-6 font-semibold tabular">{t.no}</span>
                      <div className="flex min-w-0 flex-col">
                        <ListView.Title>
                          {t.kind} · {t.due}
                        </ListView.Title>
                        <ListView.Description>{t.type}</ListView.Description>
                      </div>
                    </ListView.ItemContent>
                    <ListView.ItemAction className="flex items-center gap-[6px]">
                      <Chip size="sm" variant="soft" color={status[t.no] === "cleaning" ? "accent" : "default"}>
                        {status[t.no] === "cleaning" ? "In progress" : "Waiting"}
                      </Chip>
                      <ChevronRight className="size-4 text-muted" aria-hidden="true" />
                    </ListView.ItemAction>
                  </ListView.Item>
                )}
              </ListView>
            </section>
            <section className="flex flex-col gap-[8px]" aria-labelledby="fin-h">
              <h2 id="fin-h" className="text-[15px] leading-[22px] font-semibold">
                Finished · {fin.length}
              </h2>
              <ListView aria-label="Finished" items={fin} className="shrink-0">
                {(f) => (
                  <ListView.Item id={f.id} textValue={`Room ${f.no}`} className="min-h-14">
                    <ListView.ItemContent>
                      <span className="w-10 shrink-0 text-lg leading-6 font-semibold tabular">{f.no}</span>
                      <div className="flex min-w-0 flex-col">
                        <ListView.Title>{f.kind}</ListView.Title>
                        <ListView.Description>{f.when}</ListView.Description>
                      </div>
                    </ListView.ItemContent>
                    <ListView.ItemAction>
                      <Chip size="sm" variant="soft" color={toneColor(f.stateTone)}>
                        {f.state}
                      </Chip>
                    </ListView.ItemAction>
                  </ListView.Item>
                )}
              </ListView>
            </section>
          </>
        ) : null}
      </PhoneBody>

      {isTask && roomStatus === "cleaning" ? (
        <PhoneActionBar>
          <Button
            variant="secondary"
            size="lg"
            isIconOnly
            className="h-14 w-14"
            aria-label={paused ? "Resume timer" : "Pause timer"}
            onPress={() => setPaused((p) => !p)}
          >
            {paused ? <CirclePlay className="size-5" /> : <CirclePause className="size-5" />}
          </Button>
          <span className="flex min-w-[72px] flex-col" role="timer" aria-label="Time in room">
            <span className="text-[17px] leading-[22px] font-semibold tabular">{r.timer}</span>
            <span className="text-[11px] leading-[14px] text-muted">{paused ? "Paused" : r.started}</span>
          </span>
          <Button size="lg" className="min-h-14 flex-1" onPress={markClean}>
            <Check className="size-4" />
            Mark clean
          </Button>
        </PhoneActionBar>
      ) : null}
      {isTask && roomStatus === "waiting" ? (
        <PhoneActionBar>
          <Button
            size="lg"
            className="min-h-14 flex-1"
            onPress={() => setStatus((s) => ({ ...s, [r.no]: "cleaning" }))}
          >
            <CirclePlay className="size-4" />
            Start cleaning room {r.no}
          </Button>
        </PhoneActionBar>
      ) : null}

      <PhoneSheet
        isOpen={sheet === "confirm"}
        onOpenChange={(open) => !open && setSheet("")}
        heading={`${left.length} checks not ticked`}
        description="Beatrice sees anything you skip when she inspects the room."
      >
        <ul className="flex flex-col gap-[8px]">
          {left.map((label) => (
            <li key={label} className="flex items-center gap-[10px]">
              <CircleDashed className="size-4 shrink-0 text-muted" aria-hidden="true" />
              <span>{label}</span>
            </li>
          ))}
        </ul>
        <Button size="lg" fullWidth className="min-h-14" onPress={() => setSheet("")}>
          Keep cleaning
        </Button>
        <Button variant="secondary" size="lg" fullWidth className="min-h-14" onPress={finish}>
          Mark clean anyway
        </Button>
      </PhoneSheet>

      <PhoneSheet
        isOpen={sheet === "found"}
        onOpenChange={(open) => !open && setSheet("")}
        heading={`Found an item in room ${r.no}`}
        description="It goes to Lost and found with you as the first person holding it."
      >
        {foundPhoto ? (
          <div className="flex items-center gap-[12px]">
            <Photo image={stock[found.photo]} className="h-[72px] w-[96px] shrink-0 rounded-[14px]" sizes="96px" />
            <div className="flex flex-1 flex-col gap-[2px]">
              <span className="font-medium">Photo taken</span>
              <span className="text-xs text-muted">Small file · sends on weak signal</span>
            </div>
            <Button variant="ghost" className="min-h-11" onPress={() => setFoundPhoto(false)}>
              <Camera className="size-4" />
              Retake
            </Button>
          </div>
        ) : (
          <Button variant="secondary" size="lg" fullWidth className="min-h-14" onPress={() => setFoundPhoto(true)}>
            <Camera className="size-4" />
            Take a photo of the item
          </Button>
        )}
        <TextField defaultValue={found.description} fullWidth className="flex flex-col gap-1">
          <Label>What is it?</Label>
          <Input className="min-h-11" />
        </TextField>
        <div className="flex flex-col gap-[6px]">
          <span className="text-sm font-medium" id="fd-where">
            Where was it?
          </span>
          <ToggleButtonGroup
            aria-labelledby="fd-where"
            selectionMode="single"
            disallowEmptySelection
            isDetached
            selectedKeys={[spot]}
            onSelectionChange={(keys) => {
              const k = [...keys][0];
              if (k) setSpot(String(k));
            }}
            className="flex-wrap justify-start gap-[6px]"
          >
            {spots.map((s) => (
              <ToggleButton key={s.id} id={s.id} className="h-11">
                {s.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </div>
        <p className="flex items-start gap-[8px] text-xs leading-4 text-muted">
          <ShieldExclamation className="mt-[1px] size-4 shrink-0" aria-hidden="true" />
          <span>Cash, passports or jewellery: do not move them. Call Beatrice to the room.</span>
        </p>
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
              setFoundLogged(true);
            }}
          >
            Log the item
          </Button>
        </div>
      </PhoneSheet>
    </>
  );
}
