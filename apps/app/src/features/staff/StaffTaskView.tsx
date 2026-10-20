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
  toast,
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
import { Icon, LinkButton, PhoneBody, PhoneTop, toneColor } from "@injishi/ui";
import { useState, useTransition } from "react";
import { reported } from "../operations/shared";
import { logRoomFoundItemAction, moveRoomTaskAction, sendMinibarCountAction, setRoomCheckAction } from "./actions";
import { kigaliClock, PhoneActionBar, PhoneSheet, PhoneTitle, PhoneToasts, renderSection, ToneTile } from "./parts";

export interface StaffTaskData {
  rooms: CleaningRoom[];
  finished: FinishedRoom[];
  sections: ChecklistSection[];
  minibar: MinibarItem[];
  spots: FoundItemSpot[];
  /** Items already logged to Lost and found from the person's rooms, as the register holds them (never a form default). */
  found: FoundItem[];
  profile: StaffProfile;
  /** Today's housekeeping supervisor as the API names them, or null when it names nobody. */
  supervisor: string | null;
}

type RoomStatus = CleaningRoom["status"];

/** With no signal nothing is kept on the phone, so nothing is pretended: the person is told it was not saved. */
const NO_SIGNAL = "No signal: this was not saved and is not kept on the phone. Do it again when you have signal.";

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
  const { rooms, finished, sections, minibar, spots, profile, supervisor } = data;
  /** The supervisor's first name as the API gives it, or "your supervisor": never a name the screen made up. */
  const boss = supervisor?.split(" ")[0] || "your supervisor";
  const Boss = supervisor?.split(" ")[0] || "Your supervisor";
  const [view, setView] = useState<"task" | "rooms">("task");
  // The room in progress is the one whose minibar count the API holds (staff.minibarItems); another room starts at 0.
  const [taskRoom] = useState(() => (rooms.find((r) => r.status === "cleaning") ?? rooms[0]).no);
  const [roomNo, setRoomNo] = useState(taskRoom);
  const [status, setStatus] = useState<Record<string, RoomStatus>>(() =>
    Object.fromEntries(rooms.map((r) => [r.no, r.status])),
  );
  const [checks, setChecks] = useState<Set<string>>(
    () => new Set(rooms.flatMap((r) => r.ticked.map((id) => `${r.no}:${id}`))),
  );
  const [used, setUsed] = useState<Record<string, number>>(() =>
    Object.fromEntries(minibar.map((m) => [m.id, m.used])),
  );
  const [miniSent, setMiniSent] = useState<string | null>(null);
  const [sheet, setSheet] = useState<"" | "confirm" | "found">("");
  // The found-item form starts empty: what the person types and the spot they pick is all that is sent.
  const [spot, setSpot] = useState("");
  const [foundText, setFoundText] = useState("");
  const [foundLogged, setFoundLogged] = useState<{
    ref: string;
    name: string;
    spot: string;
    holder: string | null;
  } | null>(null);
  const [cleanedAt, setCleanedAt] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

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

  const setCheck = (key: string, on: boolean) =>
    setChecks((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  const toggleCheck = (key: string, itemId: string, on: boolean) => {
    if (offline) return toast.warning(NO_SIGNAL);
    setCheck(key, on);
    startTransition(async () => {
      if (!reported(await setRoomCheckAction(r.id, itemId, on))) setCheck(key, !on);
    });
  };

  const moveRoom = (to: "in_progress" | "done", after: () => void) => {
    if (offline) return toast.warning(NO_SIGNAL);
    startTransition(async () => {
      if (reported(await moveRoomTaskAction(r.id, to))) after();
    });
  };
  const finish = () =>
    moveRoom("done", () => {
      setSheet("");
      setCleanedAt((c) => ({ ...c, [r.no]: kigaliClock() }));
      setStatus((s) => ({ ...s, [r.no]: "done" }));
    });
  const sendMinibar = () => {
    if (offline) return toast.warning(NO_SIGNAL);
    startTransition(async () => {
      const counts = minibar.map((m) => ({ itemId: m.id, used: used[m.id] ?? 0 }));
      if (reported(await sendMinibarCountAction(r.id, counts))) setMiniSent(kigaliClock());
    });
  };
  const logFound = () => {
    const name = foundText.split(",")[0]?.trim() || foundText.trim();
    if (offline) return toast.warning(NO_SIGNAL);
    startTransition(async () => {
      const result = await logRoomFoundItemAction(r.id, { description: foundText, spot: spotPhrase });
      if (!reported(result) || !result.ok) return;
      setSheet("");
      setFoundLogged({
        ref: result.value.reference,
        name,
        spot: spotPhrase,
        holder: result.value.custodianName?.split(" ")[0] ?? null,
      });
      setFoundText("");
      setSpot("");
    });
  };
  const doneAt = cleanedAt[r.no] ?? kigaliClock();
  const markClean = () => (left.length ? setSheet("confirm") : finish());

  const statusChip =
    roomStatus === "cleaning"
      ? { label: "Cleaning", color: "accent" as const }
      : roomStatus === "waiting"
        ? { label: "Waiting", color: "default" as const }
        : { label: "Clean", color: "success" as const };

  const nextRoom = rooms.find((x) => x.no !== r.no && status[x.no] !== "done");
  const todo = rooms.filter((x) => status[x.no] !== "done");
  const finishedNow = rooms
    .filter((x) => status[x.no] === "done")
    .map((x) => ({
      id: x.id,
      no: x.no,
      kind: x.kind,
      when: "Just now · waiting for inspection",
      state: "Clean",
      stateTone: "success" as const,
    }));
  const fin = [...finishedNow, ...finished];
  const spotPhrase = spots.find((s) => s.id === spot)?.phrase ?? spot;

  const openRoom = (no: string) => {
    if (no !== roomNo) {
      // A count, a found item and their results belong to one room: another room never shows them as its own.
      setUsed(Object.fromEntries(minibar.map((m) => [m.id, no === taskRoom ? m.used : 0])));
      setMiniSent(null);
      setFoundLogged(null);
      setFoundText("");
      setSpot("");
    }
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
                Nothing is saved on this phone. Ticks, counts and found items are sent only when there is signal.
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
                    onChange={(on) => toggleCheck(it.key, it.id, on)}
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
                    Count what was used. It is recorded with this room; the phone makes no charge.
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
                    isDisabled={miniSent !== null}
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
                  <Alert status="success" role="status">
                    <Alert.Indicator>
                      <CircleCheck />
                    </Alert.Indicator>
                    <Alert.Content>
                      <Alert.Title>
                        {usedTotal ? `Count recorded at ${miniSent}` : `Nothing used · recorded at ${miniSent}`}
                      </Alert.Title>
                      <Alert.Description>
                        {usedTotal
                          ? `${usedTotal} items recorded with room ${r.no}. No charge is made from the phone; you do not take any money.`
                          : `Recorded with room ${r.no} as nothing used. No charge is made from the phone.`}
                      </Alert.Description>
                    </Alert.Content>
                  </Alert>
                  <Button variant="ghost" className="min-h-11 self-start" onPress={() => setMiniSent(null)}>
                    Change the count
                  </Button>
                </>
              ) : (
                <Button
                  variant="secondary"
                  size="lg"
                  fullWidth
                  className="min-h-14"
                  isDisabled={pending}
                  onPress={sendMinibar}
                >
                  <PaperPlane className="size-4" />
                  Send count
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
              {data.found
                .filter((f) => f.room === r.no && f.ref !== foundLogged?.ref)
                .map((f) => (
                  <ItemCard key={f.id} variant="secondary">
                    <ItemCard.Icon>
                      <Box />
                    </ItemCard.Icon>
                    <ItemCard.Content>
                      <ItemCard.Title>
                        {f.name} · {f.ref}
                      </ItemCard.Title>
                      <ItemCard.Description className="whitespace-normal">
                        Already in Lost and found from this room
                      </ItemCard.Description>
                    </ItemCard.Content>
                    <ItemCard.Action>
                      <Chip size="sm" variant="soft">
                        Logged
                      </Chip>
                    </ItemCard.Action>
                  </ItemCard>
                ))}
              {foundLogged ? (
                <ItemCard variant="secondary">
                  <ItemCard.Icon>
                    <Box />
                  </ItemCard.Icon>
                  <ItemCard.Content>
                    <ItemCard.Title>
                      {foundLogged.name} · {foundLogged.ref}
                    </ItemCard.Title>
                    <ItemCard.Description className="whitespace-normal">
                      {foundLogged.holder
                        ? `Found in the ${foundLogged.spot} · with you until you hand it to ${foundLogged.holder}`
                        : `Found in the ${foundLogged.spot} · the register names nobody to hand it to yet`}
                    </ItemCard.Description>
                  </ItemCard.Content>
                  <ItemCard.Action>
                    <Chip size="sm" variant="soft">
                      Logged
                    </Chip>
                  </ItemCard.Action>
                </ItemCard>
              ) : null}
            </Card>
          </>
        ) : null}

        {isTask && roomStatus === "done" ? (
          <Card render={renderSection} className="gap-[14px] p-[20px]" aria-labelledby="done-h">
            <ToneTile tone="success">
              <CircleCheck />
            </ToneTile>
            <div className="flex flex-col gap-1">
              <h2 id="done-h" className="text-xl leading-[26px] font-semibold">
                Room {r.no} marked clean
              </h2>
              <p className="text-muted">
                {`Sent at ${doneAt}. Front desk sees it as Clean, not Ready. It becomes Ready after a supervisor inspects it.`}
              </p>
            </div>
            <Timeline size="sm" density="compact">
              <Timeline.Item status="success">
                <Timeline.Rail>
                  <Timeline.Marker>
                    <Check />
                  </Timeline.Marker>
                  <Timeline.Connector />
                </Timeline.Rail>
                <Timeline.Content>
                  <span className="font-medium">Cleaned by you</span>
                  <span className="text-xs leading-4 text-muted">{`${doneAt} · ${doneN} of ${totalN} checks ticked`}</span>
                </Timeline.Content>
              </Timeline.Item>
              <Timeline.Item status="current">
                <Timeline.Rail>
                  <Timeline.Marker>
                    <CheckDouble />
                  </Timeline.Marker>
                  <Timeline.Connector />
                </Timeline.Rail>
                <Timeline.Content>
                  <span className="font-medium">Inspection by a supervisor</span>
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
              Only rooms assigned to you today. If a room is missing, ask {boss} to add it.
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
            aria-label="Pause timer"
            onPress={() =>
              toast.warning("Pausing the room timer is not available yet. The time runs until you mark the room clean.")
            }
          >
            <CirclePause className="size-5" />
          </Button>
          <span className="flex min-w-[72px] flex-col" role="timer" aria-label="Time in room">
            <span className="text-[17px] leading-[22px] font-semibold tabular">{r.timer}</span>
            <span className="text-[11px] leading-[14px] text-muted">{r.started}</span>
          </span>
          <Button size="lg" className="min-h-14 flex-1" isDisabled={pending} onPress={markClean}>
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
            isDisabled={pending}
            onPress={() => moveRoom("in_progress", () => setStatus((s) => ({ ...s, [r.no]: "cleaning" })))}
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
        description={`${Boss} sees anything you skip when the room is inspected.`}
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
        <Button variant="secondary" size="lg" fullWidth className="min-h-14" isDisabled={pending} onPress={finish}>
          Mark clean anyway
        </Button>
      </PhoneSheet>

      <PhoneSheet
        isOpen={sheet === "found"}
        onOpenChange={(open) => !open && setSheet("")}
        heading={`Found an item in room ${r.no}`}
        description="It goes to Lost and found with you as the first person holding it."
      >
        <div className="flex flex-col gap-[4px]">
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            className="min-h-14"
            onPress={() =>
              toast.warning("A photo cannot be logged with a found item yet. Say what it is and where it was.")
            }
          >
            <Camera className="size-4" />
            Take a photo of the item
          </Button>
          <span className="text-xs leading-4 text-muted">
            Not available yet: the register takes no photo from the phone.
          </span>
        </div>
        <TextField value={foundText} onChange={setFoundText} fullWidth className="flex flex-col gap-1">
          <Label>What is it?</Label>
          <Input className="min-h-11" placeholder="Phone charger, white" />
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
            selectedKeys={spot ? [spot] : []}
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
          <span>Cash, passports or jewellery: do not move them. Call {boss} to the room.</span>
        </p>
        <div className="grid grid-cols-[1fr_2fr] gap-[8px]">
          <Button variant="secondary" size="lg" fullWidth className="min-h-14" onPress={() => setSheet("")}>
            Cancel
          </Button>
          <Button
            size="lg"
            fullWidth
            className="min-h-14"
            isDisabled={pending || !foundText.trim() || !spot}
            onPress={logFound}
          >
            Log the item
          </Button>
        </div>
      </PhoneSheet>
      <PhoneToasts />
    </>
  );
}
