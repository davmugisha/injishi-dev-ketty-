import { screenHref } from "@injishi/data";
import type {
  ChecklistSection,
  CleaningRoom,
  FinishedRoom,
  FoundItem,
  FoundItemSpot,
  MinibarItem,
  StaffProfile,
} from "@injishi/data/fixtures/staff";
import { Link, useLocalSearchParams } from "expo-router";
import { Button, Card, Checkbox, Chip, Input, Label, TextField } from "heroui-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Icon } from "@/components/icon";
import { PhoneBody, PhoneTop } from "@/components/phone";
import { useSession } from "@/lib/session";
import { getCollection, getDocument } from "@/lib/store";
import { toneColor } from "@/lib/tone";
import {
  CountStepper,
  MeterBar,
  PhoneActionBar,
  PhoneSheet,
  PhoneTitle,
  PhotoTile,
  param,
  SectionTitle,
  Segmented,
  StatusAlert,
  ToneTile,
} from "./ui";

type RoomStatus = CleaningRoom["status"];

/** Housekeeper's room task: checklist, minibar, found items and mark clean (artifact: StaffTask). */
export default function StaffTaskScreen() {
  const { persona } = useSession();
  const offline = param(useLocalSearchParams<{ offline?: string }>().offline) === "1";
  const rooms = getCollection<CleaningRoom>("staff.rooms");
  const finished = getCollection<FinishedRoom>("staff.finishedRooms");
  const sections = getCollection<ChecklistSection>("staff.checklistSections");
  const minibar = getCollection<MinibarItem>("staff.minibarItems");
  const spots = getCollection<FoundItemSpot>("staff.foundSpots");
  const found = getCollection<FoundItem>("staff.foundItems")[0];
  const profile =
    (persona ? getDocument<StaffProfile>("staff.profiles", persona.id) : undefined) ??
    getDocument<StaffProfile>("staff.profiles", "housekeeper");

  const [view, setView] = useState<"task" | "rooms">("task");
  const [roomNo, setRoomNo] = useState(() => (rooms.find((r) => r.status === "cleaning") ?? rooms[0])?.no ?? "");
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
  const [spot, setSpot] = useState(found?.spot ?? "");
  const [what, setWhat] = useState(found?.description ?? "");
  const [foundPhoto, setFoundPhoto] = useState(true);
  const [foundLogged, setFoundLogged] = useState(false);

  if (!persona || !profile || !found || !rooms.length) return null;

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
    <View className="flex-1">
      <PhoneTop>
        <Link href={screenHref("StaffToday") as never} asChild>
          <Button variant="ghost" isIconOnly accessibilityLabel="Back to today" className="size-11">
            <Icon name="ChevronLeft" />
          </Button>
        </Link>
        <PhoneTitle
          title={isTask ? `Room ${r.no}` : "My rooms"}
          sub={isTask ? `${r.kind} · ${r.type} · ${r.floor}` : `${persona.name} · ${profile.area} · ${profile.site}`}
        />
        <Link href={screenHref("StaffReport") as never} asChild>
          <Button variant="ghost" isIconOnly accessibilityLabel="Report a problem" className="size-11">
            <Icon name="TriangleExclamation" />
          </Button>
        </Link>
      </PhoneTop>

      <View className="px-4 pb-2">
        <Segmented
          label="Show"
          value={view}
          onChange={(k) => {
            setView(k === "rooms" ? "rooms" : "task");
            setSheet("");
          }}
          items={[
            { id: "task", label: `Room ${r.no}` },
            { id: "rooms", label: `My rooms · ${rooms.length + finished.length}` },
          ]}
        />
      </View>

      <PhoneBody>
        {offline ? (
          <StatusAlert
            status="warning"
            icon="CloudSlash"
            title="No connection"
            description="Keep working. Ticks and reports are saved on this phone and send when signal is back."
          />
        ) : null}

        {isTask && roomStatus !== "done" ? (
          <>
            <Card className="gap-3 p-4" accessibilityLabel="Room summary">
              <View className="flex-row flex-wrap items-center gap-1.5">
                <Chip color="accent" variant="soft">
                  <Chip.Label>{r.kind}</Chip.Label>
                </Chip>
                <Chip color="warning" variant="soft">
                  <Icon name="Clock" size={12} tone="warning" />
                  <Chip.Label>{r.due}</Chip.Label>
                </Chip>
                <Chip color={statusChip.color} variant="soft">
                  <Chip.Label>{statusChip.label}</Chip.Label>
                </Chip>
              </View>
              <View className="flex-row items-start gap-2.5">
                <Icon name="ArrowRightToSquare" tone="muted" />
                <View className="min-w-0 flex-1">
                  <Text className="font-semibold text-foreground">{r.arrival}</Text>
                  <Text className="text-xs leading-4 text-muted">{r.arrivalNote}</Text>
                </View>
              </View>
              <MeterBar
                label="Checks done"
                valueLabel={`${doneN} of ${totalN}`}
                pct={pct}
                accessibilityLabel="Checks done"
              />
              <Text className="text-xs leading-4 text-muted">{r.history}</Text>
            </Card>

            {sectionRows.map((s) => (
              <Card key={s.id} className="gap-0 p-2" accessibilityLabel={`${s.title} checks`}>
                <View className="flex-row items-center gap-2 px-2 pt-2 pb-1.5">
                  <Icon name={s.icon} tone="muted" />
                  <Text
                    accessibilityRole="header"
                    className="flex-1 text-[15px] leading-[22px] font-semibold text-foreground"
                  >
                    {s.title}
                  </Text>
                  <Chip size="sm" variant="soft" color={s.n === s.items.length ? "success" : "default"}>
                    <Chip.Label>
                      {s.n} of {s.items.length}
                    </Chip.Label>
                  </Chip>
                </View>
                {s.items.map((it) => (
                  <Pressable
                    key={it.key}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: it.on }}
                    onPress={() => toggleCheck(it.key, !it.on)}
                    className="min-h-12 w-full flex-row items-center gap-3 rounded-xl px-2 py-1.5"
                  >
                    <View pointerEvents="none">
                      <Checkbox isSelected={it.on} />
                    </View>
                    <Text className={`flex-1 text-sm ${it.on ? "text-muted" : "text-foreground"}`}>{it.label}</Text>
                  </Pressable>
                ))}
              </Card>
            ))}

            <Card className="gap-2.5 p-4">
              <View className="flex-row items-start justify-between gap-2">
                <View className="min-w-0 flex-1 gap-0.5">
                  <Text accessibilityRole="header" className="text-[15px] leading-[22px] font-semibold text-foreground">
                    Minibar count
                  </Text>
                  <Text className="text-xs leading-4 text-muted">
                    Count what was used. Front desk checks it and decides any charge.
                  </Text>
                </View>
                <Chip size="sm" variant="soft">
                  <Chip.Label>Report only</Chip.Label>
                </Chip>
              </View>
              {minibar.map((m) => (
                <View key={m.id} className="min-h-[52px] flex-row items-center justify-between gap-2">
                  <View>
                    <Text className="font-medium text-foreground">{m.label}</Text>
                    <Text className="text-xs leading-4 text-muted">Stocked: {m.stocked}</Text>
                  </View>
                  <CountStepper
                    label={m.label}
                    value={used[m.id] ?? 0}
                    disabled={miniSent}
                    onChange={(v) => setUsed((u) => ({ ...u, [m.id]: v }))}
                  />
                </View>
              ))}
              {miniSent ? (
                <>
                  <StatusAlert
                    status={offline ? "warning" : "success"}
                    icon={offline ? "CloudSlash" : "CircleCheck"}
                    title={
                      offline
                        ? "Saved on phone · will send"
                        : usedTotal
                          ? "Sent to front desk at 10:58"
                          : "Nothing used · sent at 10:58"
                    }
                    description={
                      offline
                        ? "Front desk gets the count when you are back online."
                        : usedTotal
                          ? `${usedTotal} items reported. Eric checks the folio; you do not take any money.`
                          : "Front desk will not add minibar charges for this stay."
                    }
                  />
                  <Button variant="ghost" className="min-h-11 self-start" onPress={() => setMiniSent(false)}>
                    <Button.Label>Change the count</Button.Label>
                  </Button>
                </>
              ) : (
                <Button variant="secondary" size="lg" className="min-h-14 w-full" onPress={() => setMiniSent(true)}>
                  <Icon name="PaperPlane" tone="foreground" />
                  <Button.Label>Send count to front desk</Button.Label>
                </Button>
              )}
            </Card>

            <Card className="gap-2.5 p-4">
              <Text accessibilityRole="header" className="text-[15px] leading-[22px] font-semibold text-foreground">
                Something else in this room?
              </Text>
              <View className="flex-row gap-2">
                <Button variant="secondary" size="lg" className="min-h-14 flex-1" onPress={() => setSheet("found")}>
                  <Icon name="Box" />
                  <Button.Label>Found an item</Button.Label>
                </Button>
                <Link href={screenHref("StaffReport") as never} asChild>
                  <Button variant="secondary" size="lg" className="min-h-14 flex-1">
                    <Icon name="Wrench" />
                    <Button.Label>Report a problem</Button.Label>
                  </Button>
                </Link>
              </View>
              {foundLogged ? (
                <Card variant="secondary" className="flex-row items-center gap-3 p-3">
                  <Icon name="Box" />
                  <View className="min-w-0 flex-1">
                    <Text className="font-medium text-foreground">
                      {found.name} · {found.ref}
                    </Text>
                    <Text className="text-[13px] leading-[18px] text-muted">
                      Found in the {spotPhrase} · with you until you hand it to {found.holder}
                    </Text>
                  </View>
                  <Chip size="sm" variant="soft" color={offline ? "warning" : "default"}>
                    <Chip.Label>{offline ? "Not sent yet" : "Logged"}</Chip.Label>
                  </Chip>
                </Card>
              ) : null}
            </Card>
          </>
        ) : null}

        {isTask && roomStatus === "done" ? (
          <Card className="gap-3.5 p-5">
            <ToneTile tone={offline ? "warning" : "success"} icon={offline ? "CloudSlash" : "CircleCheck"} />
            <View className="gap-1">
              <Text accessibilityRole="header" className="text-xl leading-[26px] font-semibold text-foreground">
                Room {r.no} marked clean
              </Text>
              <Text className="text-muted">
                {offline
                  ? "Saved on this phone at 11:06. Front desk still sees the room as dirty until it sends."
                  : "Sent at 11:06. Front desk sees it as Clean, not Ready. It becomes Ready after Beatrice inspects it."}
              </Text>
            </View>
            <View className="gap-3">
              <View className="flex-row gap-2.5">
                <Icon name={offline ? "CloudSlash" : "Check"} tone={offline ? "warning" : "success"} />
                <View className="flex-1">
                  <Text className="font-medium text-foreground">Cleaned by you</Text>
                  <Text className="text-xs leading-4 text-muted">
                    {offline ? "11:06 · waiting for signal" : `11:06 · ${doneN} of ${totalN} checks ticked`}
                  </Text>
                </View>
              </View>
              <View className="flex-row gap-2.5">
                <Icon name="CheckDouble" tone="accent" />
                <View className="flex-1">
                  <Text className="font-medium text-foreground">Inspection by Beatrice</Text>
                  <Text className="text-xs leading-4 text-muted">Required before the room can be sold</Text>
                </View>
              </View>
              <View className="flex-row gap-2.5">
                <Icon name="Key" tone="muted" />
                <View className="flex-1">
                  <Text className="font-medium text-foreground">Ready for front desk</Text>
                  <Text className="text-xs leading-4 text-muted">{r.arrival}</Text>
                </View>
              </View>
            </View>
            {nextRoom ? (
              <Button size="lg" className="min-h-14 w-full" onPress={() => openRoom(nextRoom.no)}>
                <Button.Label>
                  Next: Room {nextRoom.no} · {nextRoom.kind}
                </Button.Label>
                <Icon name="ArrowRight" tone="accent-foreground" />
              </Button>
            ) : null}
            <Link href={screenHref("StaffToday") as never} asChild>
              <Button variant="secondary" size="lg" className="min-h-14 w-full">
                <Button.Label>Back to today</Button.Label>
              </Button>
            </Link>
          </Card>
        ) : null}

        {!isTask ? (
          <>
            <Text className="text-[13px] leading-[18px] text-muted">
              Only rooms Beatrice assigned to you today. If a room is missing, ask her to add it.
            </Text>
            <View className="gap-2">
              <SectionTitle>{`To do · ${todo.length}`}</SectionTitle>
              {todo.map((t) => (
                <Pressable
                  key={t.no}
                  accessibilityRole="button"
                  accessibilityLabel={`Room ${t.no}`}
                  onPress={() => openRoom(t.no)}
                >
                  <Card className="min-h-[60px] flex-row items-center gap-2 px-3 py-2">
                    <Text className="w-10 text-lg leading-6 font-semibold text-foreground">{t.no}</Text>
                    <View className="min-w-0 flex-1">
                      <Text className="font-medium text-foreground">
                        {t.kind} · {t.due}
                      </Text>
                      <Text className="text-[13px] leading-[18px] text-muted">{t.type}</Text>
                    </View>
                    <Chip size="sm" variant="soft" color={status[t.no] === "cleaning" ? "accent" : "default"}>
                      <Chip.Label>{status[t.no] === "cleaning" ? "In progress" : "Waiting"}</Chip.Label>
                    </Chip>
                    <Icon name="ChevronRight" tone="muted" />
                  </Card>
                </Pressable>
              ))}
            </View>
            <View className="gap-2">
              <SectionTitle>{`Finished · ${fin.length}`}</SectionTitle>
              {fin.map((f) => (
                <Card key={f.id} className="min-h-14 flex-row items-center gap-2 px-3 py-2">
                  <Text className="w-10 text-lg leading-6 font-semibold text-foreground">{f.no}</Text>
                  <View className="min-w-0 flex-1">
                    <Text className="font-medium text-foreground">{f.kind}</Text>
                    <Text className="text-[13px] leading-[18px] text-muted">{f.when}</Text>
                  </View>
                  <Chip size="sm" variant="soft" color={toneColor(f.stateTone)}>
                    <Chip.Label>{f.state}</Chip.Label>
                  </Chip>
                </Card>
              ))}
            </View>
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
            accessibilityLabel={paused ? "Resume timer" : "Pause timer"}
            onPress={() => setPaused((p) => !p)}
          >
            <Icon name={paused ? "CirclePlay" : "CirclePause"} size={20} />
          </Button>
          <View accessibilityLabel="Time in room" className="min-w-[72px]">
            <Text className="text-[17px] leading-[22px] font-semibold text-foreground">{r.timer}</Text>
            <Text className="text-[11px] leading-[14px] text-muted">{paused ? "Paused" : r.started}</Text>
          </View>
          <Button size="lg" className="min-h-14 flex-1" onPress={() => (left.length ? setSheet("confirm") : finish())}>
            <Icon name="Check" tone="accent-foreground" />
            <Button.Label>Mark clean</Button.Label>
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
            <Icon name="CirclePlay" tone="accent-foreground" />
            <Button.Label>Start cleaning room {r.no}</Button.Label>
          </Button>
        </PhoneActionBar>
      ) : null}

      <PhoneSheet
        isOpen={sheet === "confirm"}
        onOpenChange={(open) => !open && setSheet("")}
        heading={`${left.length} checks not ticked`}
        description="Beatrice sees anything you skip when she inspects the room."
      >
        <View className="gap-2">
          {left.map((label) => (
            <View key={label} className="flex-row items-center gap-2.5">
              <Icon name="CircleDashed" tone="muted" />
              <Text className="flex-1 text-foreground">{label}</Text>
            </View>
          ))}
        </View>
        <Button size="lg" className="min-h-14 w-full" onPress={() => setSheet("")}>
          <Button.Label>Keep cleaning</Button.Label>
        </Button>
        <Button variant="secondary" size="lg" className="min-h-14 w-full" onPress={finish}>
          <Button.Label>Mark clean anyway</Button.Label>
        </Button>
      </PhoneSheet>

      <PhoneSheet
        isOpen={sheet === "found"}
        onOpenChange={(open) => !open && setSheet("")}
        heading={`Found an item in room ${r.no}`}
        description="It goes to Lost and found with you as the first person holding it."
      >
        {foundPhoto ? (
          <View className="flex-row items-center gap-3">
            <PhotoTile image={found.photo} className="h-[72px] w-[96px] rounded-[14px]" />
            <View className="flex-1">
              <Text className="font-medium text-foreground">Photo taken</Text>
              <Text className="text-xs text-muted">Small file · sends on weak signal</Text>
            </View>
            <Button variant="ghost" className="min-h-11" onPress={() => setFoundPhoto(false)}>
              <Icon name="Camera" />
              <Button.Label>Retake</Button.Label>
            </Button>
          </View>
        ) : (
          <Button variant="secondary" size="lg" className="min-h-14 w-full" onPress={() => setFoundPhoto(true)}>
            <Icon name="Camera" />
            <Button.Label>Take a photo of the item</Button.Label>
          </Button>
        )}
        <TextField>
          <Label>What is it?</Label>
          <Input value={what} onChangeText={setWhat} />
        </TextField>
        <View className="gap-1.5">
          <Text className="text-sm font-medium text-foreground">Where was it?</Text>
          <View className="flex-row flex-wrap gap-1.5">
            {spots.map((s) => (
              <Button
                key={s.id}
                variant={spot === s.id ? "primary" : "secondary"}
                className="h-11"
                onPress={() => setSpot(s.id)}
              >
                <Button.Label>{s.label}</Button.Label>
              </Button>
            ))}
          </View>
        </View>
        <View className="flex-row items-start gap-2">
          <Icon name="ShieldExclamation" tone="muted" />
          <Text className="flex-1 text-xs leading-4 text-muted">
            Cash, passports or jewellery: do not move them. Call Beatrice to the room.
          </Text>
        </View>
        <View className="flex-row gap-2">
          <Button variant="secondary" size="lg" className="min-h-14 flex-1" onPress={() => setSheet("")}>
            <Button.Label>Cancel</Button.Label>
          </Button>
          <Button
            size="lg"
            className="min-h-14 flex-2"
            onPress={() => {
              setSheet("");
              setFoundLogged(true);
            }}
          >
            <Button.Label>Log the item</Button.Label>
          </Button>
        </View>
      </PhoneSheet>
    </View>
  );
}
