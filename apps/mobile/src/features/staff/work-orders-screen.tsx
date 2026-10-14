import type { StaffProfile, StorePart, WorkOrder, WorkOrderPart } from "@injishi/data/fixtures/staff";
import { Avatar, Button, Card, Chip, Input, Label, Switch, TextArea, TextField } from "heroui-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Icon } from "@/components/icon";
import { PhoneBody, PhoneTop } from "@/components/phone";
import { useSession } from "@/lib/session";
import { getCollection, getDocument } from "@/lib/store";
import { toneColor } from "@/lib/tone";
import { KeyValue, PhoneActionBar, PhoneSheet, PhoneTitle, PhotoTile, SectionTitle } from "./ui";

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

const STARTED_AT = "11:12";
const STOPPED_AT = "11:13";

type KeyedPart = WorkOrderPart & { key: string };
type KeyedNote = WorkOrder["notes"][number] & { key: string };

/** Technician's work orders: queue and one job (artifact: TechWorkOrders). */
export default function TechWorkOrdersScreen() {
  const { persona } = useSession();
  const profile =
    (persona ? getDocument<StaffProfile>("staff.profiles", persona.id) : undefined) ??
    getDocument<StaffProfile>("staff.profiles", "technician");
  const orders = getCollection<WorkOrder>("staff.workOrders");
  const store = getCollection<StorePart>("staff.storeParts");

  const [view, setView] = useState<"queue" | "detail">("detail");
  const [woId, setWoId] = useState(orders.find((o) => o.status === "progress")?.id ?? orders[0]?.id ?? "");
  const [status, setStatus] = useState<Record<string, WorkOrder["status"]>>({});
  const [added, setAdded] = useState<Record<string, KeyedPart[]>>({});
  const [extraPhotos, setExtraPhotos] = useState<Record<string, number[]>>({});
  const [timing, setTiming] = useState(true);
  const [notes, setNotes] = useState<Record<string, KeyedNote[]>>({});
  const [draft, setDraft] = useState("");
  const [fixes, setFixes] = useState<Record<string, string>>(() =>
    Object.fromEntries(orders.map((o) => [o.id, o.fix])),
  );
  const [sheet, setSheet] = useState<"" | "parts" | "resolve">("");
  const [askRelease, setAskRelease] = useState(true);
  const [resolved, setResolved] = useState<Record<string, boolean>>({});

  if (!persona || !profile || !orders.length) return null;

  const statusOf = (o: WorkOrder): Status => (resolved[o.id] ? "resolved" : (status[o.id] ?? o.status));
  const openCount = orders.filter((o) => statusOf(o) !== "resolved").length;
  const until = profile.shift.split(/\s*[–—-]\s*/)[1]?.trim() ?? "";

  const w = orders.find((o) => o.id === woId) ?? orders[0];
  const s = statusOf(w);
  const isResolved = s === "resolved";
  const photos = [
    ...w.photos.map((p) => ({ caption: p.caption, image: p.image, key: p.caption })),
    ...(extraPhotos[w.id] ?? []).map((id) => ({ caption: "Just now", image: null as null, key: `new-${id}` })),
  ];
  const parts: KeyedPart[] = [...w.parts.map((p) => ({ ...p, key: p.name })), ...(added[w.id] ?? [])];
  const running = w.repair ? timing && !isResolved : s === "progress" && timing && !isResolved;
  const log: { what: string; when: string; dur: string; live: boolean }[] = w.log.map((l) => ({ ...l, live: false }));
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

  const fixed = {
    icon: "Check",
    tone: "success" as const,
    title: "Fixed by you",
    detail: `Today 11:20 · ${parts.length} part${parts.length === 1 ? "" : "s"} · time logged`,
  };
  const release = !block
    ? [fixed, { icon: "Bell", tone: "muted" as const, title: "Reporter gets a message", detail: w.from }]
    : askRelease
      ? [
          fixed,
          {
            icon: "CheckDouble",
            tone: "accent" as const,
            title: "Room check by Beatrice",
            detail: "Housekeeping inspects before guests",
          },
          {
            icon: "LockOpen",
            tone: "muted" as const,
            title: "Aline releases the block",
            detail: "Only the manager can put the room back on sale",
          },
          { icon: "Key", tone: "muted" as const, title: "Back on sale", detail: "Front desk sees it as available" },
        ]
      : [fixed, { icon: "Ban", tone: "muted" as const, title: "Block stays as approved", detail: block.keep }];

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
    <View className="flex-1">
      {view === "queue" ? (
        <PhoneTop>
          <Avatar size="sm" variant="soft" color="warning" alt={persona.name}>
            <Avatar.Fallback>{persona.initials}</Avatar.Fallback>
          </Avatar>
          <PhoneTitle title="My work orders" sub={`${persona.name} · ${profile.department} · until ${until}`} />
        </PhoneTop>
      ) : (
        <PhoneTop>
          <Button
            variant="ghost"
            isIconOnly
            accessibilityLabel="Back to my work orders"
            className="size-11"
            onPress={() => {
              setView("queue");
              setSheet("");
            }}
          >
            <Icon name="ChevronLeft" />
          </Button>
          <PhoneTitle title={w.ref} sub={`${w.where} · ${w.what}`} />
          <Chip size="sm" variant="soft" color={STATUS[s].color}>
            <Chip.Label>{STATUS[s].label}</Chip.Label>
          </Chip>
        </PhoneTop>
      )}

      <PhoneBody>
        {view === "queue" ? (
          <>
            <Text className="text-[13px] leading-[18px] text-muted">
              {openCount} open · most urgent first. Only jobs assigned to you or the maintenance team.
            </Text>
            {orders.map((o) => (
              <Pressable
                key={o.id}
                accessibilityRole="button"
                accessibilityLabel={`${o.ref}: ${o.where} · ${o.what}`}
                onPress={() => openOrder(o.id)}
              >
                <Card className="min-h-[72px] flex-row items-start gap-3 p-4">
                  <Icon name={o.icon} />
                  <View className="min-w-0 flex-1 gap-0.5">
                    <View className="flex-row items-center gap-1.5">
                      <Text className="text-xs text-muted">{o.ref}</Text>
                      <Chip size="sm" variant="soft" color={PRIORITY[o.priority]}>
                        <Chip.Label>{o.priority}</Chip.Label>
                      </Chip>
                    </View>
                    <Text className="font-medium text-foreground">
                      {o.where} · {o.what}
                    </Text>
                    <Text className="text-[13px] leading-[18px] text-muted">
                      {STATUS[statusOf(o)].label} · {o.age}
                    </Text>
                  </View>
                  <Icon name="ChevronRight" tone="muted" />
                </Card>
              </Pressable>
            ))}
          </>
        ) : (
          <>
            <Card accessibilityLabel="Summary" className="gap-2 p-4">
              <View className="flex-row flex-wrap items-center gap-1.5">
                <Chip variant="soft" color={PRIORITY[w.priority]}>
                  <Chip.Label>{w.priority} priority</Chip.Label>
                </Chip>
                <Chip variant="soft">
                  <Icon name="Clock" size={12} tone="muted" />
                  <Chip.Label>{w.age} old</Chip.Label>
                </Chip>
              </View>
              <Text className="text-[13px] leading-[18px] text-muted">
                {w.opened} · from {w.from}
              </Text>
            </Card>

            {isResolved ? (
              <Card className="gap-3 p-4">
                <View className="flex-row items-start justify-between gap-2">
                  <Text
                    accessibilityRole="header"
                    className="flex-1 text-[15px] leading-[22px] font-semibold text-foreground"
                  >
                    {!block ? "Resolved" : askRelease ? "Resolved · release requested" : "Resolved · block kept"}
                  </Text>
                  {block ? (
                    <Chip size="sm" variant="soft" color={block.tone}>
                      <Chip.Label>{block.chip}</Chip.Label>
                    </Chip>
                  ) : null}
                </View>
                <View className="gap-3">
                  {release.map((g) => (
                    <View key={g.title} className="flex-row gap-2.5">
                      <Icon name={g.icon} tone={g.tone} />
                      <View className="flex-1">
                        <Text className="font-medium text-foreground">{g.title}</Text>
                        <Text className="text-xs leading-4 text-muted">{g.detail}</Text>
                      </View>
                    </View>
                  ))}
                </View>
                <Button
                  variant="ghost"
                  className="min-h-11 self-start"
                  onPress={() => setResolved((r) => ({ ...r, [w.id]: false }))}
                >
                  <Button.Label>Reopen</Button.Label>
                </Button>
              </Card>
            ) : null}

            <View className="gap-2">
              <SectionTitle>Photos</SectionTitle>
              <View className="flex-row flex-wrap gap-2">
                {photos.map((p) =>
                  p.image ? (
                    <PhotoTile
                      key={p.key}
                      image={p.image}
                      caption={p.caption}
                      className="h-[84px] w-[31%] rounded-[14px]"
                    />
                  ) : (
                    <View
                      key={p.key}
                      className="h-[84px] w-[31%] items-center justify-center gap-1 rounded-[14px] bg-surface-secondary p-1"
                    >
                      <Icon name="Picture" size={20} tone="muted" />
                      <Text className="text-center text-[11px] leading-[13px] text-muted">{p.caption}</Text>
                    </View>
                  ),
                )}
                <Button
                  variant="secondary"
                  className="h-[84px] w-[31%] flex-col gap-1 rounded-[14px]"
                  onPress={() => setExtraPhotos((x) => ({ ...x, [w.id]: [...(x[w.id] ?? []), Date.now()] }))}
                >
                  <Icon name="Camera" size={20} />
                  <Button.Label>Add</Button.Label>
                </Button>
              </View>
            </View>

            {block ? (
              <Card
                className={`gap-1.5 border-l-[3px] p-4 ${block.tone === "danger" ? "border-l-danger" : "border-l-warning"}`}
              >
                <View className="flex-row items-start justify-between gap-2">
                  <View className="min-w-0 flex-1 flex-row items-center gap-2">
                    <Icon name="Ban" tone={block.tone} />
                    <Text
                      accessibilityRole="header"
                      className="flex-1 text-[15px] leading-[22px] font-semibold text-foreground"
                    >
                      {block.title}
                    </Text>
                  </View>
                  <Chip size="sm" variant="soft" color={block.tone}>
                    <Chip.Label>{block.chip}</Chip.Label>
                  </Chip>
                </View>
                <Text className="text-[13px] leading-[18px] text-muted">{block.text}</Text>
              </Card>
            ) : null}

            {w.recommendation ? (
              <Card variant="secondary" className="gap-2 p-4">
                <View className="flex-row items-center justify-between gap-2">
                  <View className="min-w-0 flex-1 flex-row items-center gap-2">
                    <Icon name="Bulb" />
                    <Text
                      accessibilityRole="header"
                      className="text-[15px] leading-[22px] font-semibold text-foreground"
                    >
                      Recommendation
                    </Text>
                  </View>
                  <Chip size="sm" variant="soft" color="accent">
                    <Chip.Label>Reviewed by manager</Chip.Label>
                  </Chip>
                </View>
                <Text className="font-medium text-foreground">{w.recommendation.title}</Text>
                <Text className="text-[13px] leading-[18px] text-muted">{w.recommendation.why}</Text>
                <KeyValue
                  items={[
                    { label: "Confidence", value: w.recommendation.confidence },
                    { label: "Reviewed", value: w.recommendation.reviewed },
                  ]}
                />
                <Text className="text-xs leading-4 text-muted">{w.recommendation.note}</Text>
              </Card>
            ) : null}

            <Card className="gap-2 p-4">
              <SectionTitle>Parts used</SectionTitle>
              {parts.length ? (
                parts.map((p) => (
                  <View key={p.key} className="min-h-12 flex-row items-center gap-2.5 border-t border-separator pt-2">
                    <Icon name="Boxes3" tone="muted" />
                    <View className="min-w-0 flex-1">
                      <Text className="font-medium text-foreground">
                        {p.name} <Text className="text-muted">{p.qty}</Text>
                      </Text>
                      <Text className="text-xs leading-4 text-muted">{p.meta}</Text>
                    </View>
                    <Chip size="sm" variant="soft" color={toneColor(p.tone)}>
                      <Chip.Label>{p.chip}</Chip.Label>
                    </Chip>
                  </View>
                ))
              ) : (
                <Text className="text-[13px] text-muted">No parts used yet.</Text>
              )}
              <Button variant="secondary" size="lg" className="min-h-12 w-full" onPress={() => setSheet("parts")}>
                <Icon name="Plus" />
                <Button.Label>Add part from store</Button.Label>
              </Button>
            </Card>

            <Card className="gap-2 p-4">
              <View className="flex-row items-center justify-between gap-2">
                <SectionTitle>Time log</SectionTitle>
                <Text className="text-xs text-muted">{timeTotal}</Text>
              </View>
              {log.map((l) => (
                <View
                  key={`${l.what}-${l.when}`}
                  className="flex-row items-center gap-2.5 border-t border-separator pt-2"
                >
                  <Icon name={l.live ? "Stopwatch" : "Clock"} tone={l.live ? "accent" : "muted"} />
                  <View className="min-w-0 flex-1">
                    <Text className="font-medium text-foreground">{l.what}</Text>
                    <Text className="text-xs leading-4 text-muted">{l.when}</Text>
                  </View>
                  <Text className="font-semibold text-foreground">{l.dur}</Text>
                </View>
              ))}
              {canTime ? (
                <Button variant="secondary" size="lg" className="min-h-12 w-full" onPress={() => setTiming((t) => !t)}>
                  <Icon name={running ? "CirclePause" : "CirclePlay"} />
                  <Button.Label>{running ? "Stop timer" : "Start timer"}</Button.Label>
                </Button>
              ) : null}
            </Card>

            <Card className="gap-2.5 p-4">
              <SectionTitle>Notes</SectionTitle>
              {woNotes.map((n) => (
                <View key={n.key} className="flex-row items-start gap-2.5">
                  <Avatar size="sm" variant="soft" alt={n.who}>
                    <Avatar.Fallback>{n.initials}</Avatar.Fallback>
                  </Avatar>
                  <View className="min-w-0 flex-1">
                    <Text className="text-xs leading-4">
                      <Text className="font-semibold text-foreground">{n.who}</Text>{" "}
                      <Text className="text-muted">{n.when}</Text>
                    </Text>
                    <Text className="text-[13px] leading-[18px] text-foreground">{n.text}</Text>
                  </View>
                </View>
              ))}
              <View className="flex-row items-end gap-2">
                <TextField className="flex-1">
                  <Label>Add a note</Label>
                  <Input
                    value={draft}
                    onChangeText={setDraft}
                    placeholder="Add a note"
                    accessibilityLabel="Add a note"
                    onSubmitEditing={addNote}
                  />
                </TextField>
                <Button variant="secondary" className="min-h-11" onPress={addNote}>
                  <Button.Label>Add</Button.Label>
                </Button>
              </View>
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
            <Icon name="CirclePlay" tone="accent-foreground" />
            <Button.Label>Start work</Button.Label>
          </Button>
        </PhoneActionBar>
      ) : null}
      {view === "detail" && !isResolved && s !== "new" ? (
        <PhoneActionBar>
          <Button size="lg" className="min-h-14 flex-1" onPress={() => setSheet("resolve")}>
            <Icon name="CircleCheck" tone="accent-foreground" />
            <Button.Label>Resolve</Button.Label>
          </Button>
        </PhoneActionBar>
      ) : null}

      <PhoneSheet
        isOpen={sheet === "parts"}
        onOpenChange={(open) => !open && setSheet("")}
        heading="Add part from store"
        description="Patrick issues it from the store. It counts as used once he confirms."
      >
        <View accessibilityLabel="Parts in store" className="gap-2">
          {store.map((p) => (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              accessibilityLabel={p.name}
              disabled={!p.available}
              onPress={() => {
                if (!p.available) return;
                setSheet("");
                setAdded((a) => ({
                  ...a,
                  [w.id]: [
                    ...(a[w.id] ?? []),
                    {
                      key: `req-${Date.now()}`,
                      name: p.name,
                      qty: "× 1",
                      meta: "Requested just now · Patrick confirms the issue",
                      chip: "Requested",
                      tone: "warning",
                    },
                  ],
                }));
              }}
            >
              <Card className="min-h-14 flex-row items-center gap-3 px-3 py-2">
                <Icon name="Box" tone="muted" />
                <View className="min-w-0 flex-1">
                  <Text className="font-medium text-foreground">{p.name}</Text>
                  <Text className="text-[13px] leading-[18px] text-muted">{p.stock}</Text>
                </View>
                <Icon name={p.available ? "Plus" : "Ban"} tone="muted" />
              </Card>
            </Pressable>
          ))}
        </View>
        <Button variant="secondary" size="lg" className="min-h-14 w-full" onPress={() => setSheet("")}>
          <Button.Label>Close</Button.Label>
        </Button>
      </PhoneSheet>

      <PhoneSheet
        isOpen={sheet === "resolve"}
        onOpenChange={(open) => !open && setSheet("")}
        heading={`Resolve ${w.ref}`}
        description={`${w.where} · ${w.what}`}
      >
        <TextField>
          <Label>What did you do?</Label>
          <TextArea
            value={fixes[w.id] ?? ""}
            onChangeText={(text) => setFixes((f) => ({ ...f, [w.id]: text }))}
            numberOfLines={3}
          />
        </TextField>
        {block ? (
          <>
            <View className="min-h-[52px] flex-row items-center gap-3">
              <View className="flex-1">
                <Text className="font-semibold text-foreground">Ask to release the block</Text>
                <Text className="text-xs leading-4 text-muted">Room goes back on sale after checks</Text>
              </View>
              <Switch
                isSelected={askRelease}
                onSelectedChange={setAskRelease}
                accessibilityLabel="Ask to release the block"
              />
            </View>
            <View className="flex-row items-start gap-2">
              <Icon name="CircleInfo" tone="muted" />
              <Text className="flex-1 text-xs leading-4 text-muted">
                {askRelease
                  ? "The room stays blocked until Beatrice checks it and Aline releases it. You cannot put it back on sale yourself."
                  : block.keep}
              </Text>
            </View>
          </>
        ) : null}
        <View className="flex-row gap-2">
          <Button variant="secondary" size="lg" className="min-h-14 flex-1" onPress={() => setSheet("")}>
            <Button.Label>Cancel</Button.Label>
          </Button>
          <Button
            size="lg"
            className="min-h-14 flex-[2]"
            onPress={() => {
              setSheet("");
              setTiming(false);
              setResolved((r) => ({ ...r, [w.id]: true }));
            }}
          >
            <Button.Label>Mark resolved</Button.Label>
          </Button>
        </View>
      </PhoneSheet>
    </View>
  );
}
