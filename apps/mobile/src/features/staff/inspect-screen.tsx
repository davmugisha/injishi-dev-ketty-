import type { CheckResult, InspectionCheck, InspectionRoom, StaffProfile } from "@injishi/data/fixtures/staff";
import { Avatar, Button, Card, Chip, Label, Radio, RadioGroup, TextArea, TextField } from "heroui-native";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Icon } from "@/components/icon";
import { PhoneBody, PhoneTop } from "@/components/phone";
import { useSession } from "@/lib/session";
import { getCollection, getDocument } from "@/lib/store";
import { PhoneTitle, PhotoTile, SectionTitle, StatusDot, ToneTile } from "./ui";

type Decision = "released" | "returned";

const NOW = "11:14";

/** Supervisor inspects cleaned rooms and releases or returns them (artifact: InspectRoom). */
export default function InspectRoomScreen() {
  const { persona } = useSession();
  const profile =
    (persona ? getDocument<StaffProfile>("staff.profiles", persona.id) : undefined) ??
    getDocument<StaffProfile>("staff.profiles", "supervisor");
  const rooms = getCollection<InspectionRoom>("staff.inspectionRooms");
  const checks = getCollection<InspectionCheck>("staff.inspectionChecks");

  const [roomNo, setRoomNo] = useState(rooms[0]?.no ?? "");
  const [results, setResults] = useState<Record<string, Record<string, CheckResult>>>(() =>
    Object.fromEntries(rooms.map((r) => [r.no, { ...r.results }])),
  );
  const [photos, setPhotos] = useState<Set<string>>(
    () => new Set(rooms.flatMap((r) => r.photos.map((id) => `${r.no}:${id}`))),
  );
  const [outcomes, setOutcomes] = useState<Record<string, "release" | "return">>(() =>
    Object.fromEntries(rooms.filter((r) => r.outcome).map((r) => [r.no, r.outcome as "release" | "return"])),
  );
  const [notes, setNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(rooms.map((r) => [r.no, r.note])),
  );
  const [decided, setDecided] = useState<Record<string, Decision>>({});

  if (!persona || !profile || !rooms.length || !checks.length) return null;

  const r = rooms.find((x) => x.no === roomNo) ?? rooms[0];
  const res = results[r.no] ?? {};
  const decision = decided[r.no];
  const waiting = rooms.filter((x) => !decided[x.no]).length;
  const checked = checks.filter((c) => res[c.id]).length;
  const failed = checks.filter((c) => res[c.id] === "fail");
  const fails = failed.length;
  const unchecked = checks.length - checked;
  const missingPhoto = failed.some((c) => !photos.has(`${r.no}:${c.id}`));
  const outcome = outcomes[r.no] ?? (fails ? "return" : "release");
  const canRelease = unchecked === 0 && fails === 0;
  const isReturn = outcome === "return";
  let block = "";
  if (!isReturn && !canRelease)
    block = unchecked
      ? `Check all ${checks.length} items first (${unchecked} left).`
      : "A failed check cannot be released.";
  if (isReturn && missingPhoto) block = "Add a photo for each failed check.";

  const nextRoom = rooms.find((x) => x.no !== r.no && !decided[x.no]);

  const setResult = (checkId: string, value: CheckResult | null) =>
    setResults((all) => {
      const room = { ...(all[r.no] ?? {}) };
      if (value) room[checkId] = value;
      else delete room[checkId];
      return { ...all, [r.no]: room };
    });
  const setPhoto = (checkId: string, on: boolean) =>
    setPhotos((p) => {
      const next = new Set(p);
      if (on) next.add(`${r.no}:${checkId}`);
      else next.delete(`${r.no}:${checkId}`);
      return next;
    });

  const arrivalTime = r.arrival.startsWith("Arrival") ? r.arrival.replace("Arrival ", "") : null;
  const done =
    decision === "returned"
      ? {
          tone: "warning" as const,
          icon: "ArrowUturnCcwLeft",
          title: `Returned to ${r.cleanedByFirst}`,
          text: "It is at the top of her list now. The room stays Clean, not Ready, until you inspect it again.",
          chip: "Returned · not sellable",
          history: `Returned by ${persona.name} at ${NOW} · ${fails} failed check${fails === 1 ? "" : "s"}, with photo`,
        }
      : {
          tone: "success" as const,
          icon: "CheckDouble",
          title: `Room ${r.no} is Inspected`,
          text: `Front desk sees it as Ready from ${NOW}. ${
            arrivalTime ? `Eric can assign it for the ${arrivalTime} arrival.` : "It can be sold tonight."
          }`,
          chip: "Inspected",
          history: `Inspected by ${persona.name} at ${NOW} · ${checked} of ${checks.length} passed`,
        };

  return (
    <View className="flex-1">
      <PhoneTop>
        <Avatar size="sm" variant="soft" color="success" alt={persona.name}>
          <Avatar.Fallback>{persona.initials}</Avatar.Fallback>
        </Avatar>
        <PhoneTitle title="Inspections" sub={`${persona.name} · Supervisor · ${profile.area}`} />
        <Chip color="warning" variant="soft">
          <Chip.Label>{waiting} waiting</Chip.Label>
        </Chip>
      </PhoneTop>

      <View className="gap-2 px-4 pb-2">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1.5">
          {rooms.map((q) => {
            const d = decided[q.no];
            const tag = d === "released" ? "Inspected" : d === "returned" ? "Returned" : q.wait;
            const tone = d === "released" ? "success" : d === "returned" ? "warning" : q.late ? "danger" : "info";
            const selected = q.no === r.no;
            return (
              <Pressable
                key={q.no}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setRoomNo(q.no)}
                className={`h-12 flex-row items-center gap-2 rounded-2xl px-3 ${selected ? "bg-accent-soft" : "bg-default"}`}
              >
                <StatusDot tone={tone} />
                <View>
                  <Text className="leading-[18px] font-semibold text-foreground">{q.no}</Text>
                  <Text className="text-[11px] leading-[14px] font-medium text-muted">{tag}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
        <View className="flex-row items-center gap-1.5">
          <Icon name="ShieldCheck" size={12} tone="muted" />
          <Text className="flex-1 text-xs leading-4 text-muted">
            Front desk can only give a room to a guest after you pass it here.
          </Text>
        </View>
      </View>

      <PhoneBody>
        <Card className="gap-2.5 p-4">
          <View className="flex-row items-start justify-between gap-2">
            <View>
              <Text accessibilityRole="header" className="text-2xl leading-[30px] font-semibold text-foreground">
                Room {r.no}
              </Text>
              <Text className="text-[13px] text-muted">{r.type} · checkout clean</Text>
            </View>
            <Chip color={r.late ? "warning" : "default"} variant="soft">
              <Icon name="Clock" size={12} tone={r.late ? "warning" : "muted"} />
              <Chip.Label>{r.arrival}</Chip.Label>
            </Chip>
          </View>
          <View className="flex-row items-center gap-2.5">
            <Avatar size="sm" variant="soft" color="accent" alt={r.cleanedBy}>
              <Avatar.Fallback>{r.initials}</Avatar.Fallback>
            </Avatar>
            <View>
              <Text className="font-medium text-foreground">{r.cleanedBy}</Text>
              <Text className="text-xs leading-4 text-muted">
                {r.cleaned} · waiting {r.wait}
              </Text>
            </View>
          </View>
          {r.skip ? (
            <View className="flex-row items-center gap-2">
              <Icon name="TriangleExclamation" tone="warning" />
              <Text className="flex-1 text-[13px] leading-[18px] text-warning">{r.skip}</Text>
            </View>
          ) : null}
        </Card>

        {!decision ? (
          <>
            <Card className="gap-0 px-4 pt-2 pb-3">
              <View className="flex-row items-center justify-between py-2">
                <SectionTitle>Checklist</SectionTitle>
                <Text className="text-xs text-muted">
                  {checked} of {checks.length} checked · {fails} fail
                </Text>
              </View>
              {checks.map((c) => {
                const v = res[c.id];
                const hasPhoto = photos.has(`${r.no}:${c.id}`);
                return (
                  <View key={c.id} className="gap-2 border-t border-separator py-2">
                    <View className="flex-row items-center gap-2">
                      <Text className="flex-1 text-sm leading-[19px] text-foreground">{c.label}</Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected: v === "pass" }}
                        accessibilityLabel={`${c.label} pass`}
                        onPress={() => setResult(c.id, v === "pass" ? null : "pass")}
                        className={`h-11 flex-row items-center gap-1.5 rounded-3xl px-3 ${v === "pass" ? "bg-success-soft" : "bg-default"}`}
                      >
                        <Icon name="Check" size={14} tone={v === "pass" ? "success-soft-foreground" : "foreground"} />
                        <Text
                          className={`text-sm font-medium ${v === "pass" ? "text-success-soft-foreground" : "text-foreground"}`}
                        >
                          Pass
                        </Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected: v === "fail" }}
                        accessibilityLabel={`${c.label} fail`}
                        onPress={() => setResult(c.id, v === "fail" ? null : "fail")}
                        className={`h-11 flex-row items-center gap-1.5 rounded-3xl px-3 ${v === "fail" ? "bg-danger-soft" : "bg-default"}`}
                      >
                        <Icon name="Xmark" size={14} tone={v === "fail" ? "danger-soft-foreground" : "foreground"} />
                        <Text
                          className={`text-sm font-medium ${v === "fail" ? "text-danger-soft-foreground" : "text-foreground"}`}
                        >
                          Fail
                        </Text>
                      </Pressable>
                    </View>
                    {v === "fail" ? (
                      hasPhoto ? (
                        <View className="flex-row items-center gap-2.5">
                          {c.photo ? (
                            <PhotoTile image={c.photo} className="h-16 w-[88px] rounded-xl" />
                          ) : (
                            <View
                              accessibilityLabel={`Photo of ${c.label.toLowerCase()}`}
                              className="h-16 w-[88px] items-center justify-center rounded-xl bg-surface-secondary"
                            >
                              <Icon name="Picture" size={20} tone="muted" />
                            </View>
                          )}
                          <View className="flex-1">
                            <Text className="text-[13px] font-medium text-foreground">Photo added</Text>
                            <Text className="text-xs text-muted">Goes to {r.cleanedByFirst} with the reason</Text>
                          </View>
                          <Button variant="ghost" className="min-h-11" onPress={() => setPhoto(c.id, false)}>
                            <Icon name="Camera" />
                            <Button.Label>Retake</Button.Label>
                          </Button>
                        </View>
                      ) : (
                        <Button variant="secondary" className="min-h-12 w-full" onPress={() => setPhoto(c.id, true)}>
                          <Icon name="Camera" tone="danger" />
                          <Button.Label>Add a photo of the problem</Button.Label>
                        </Button>
                      )
                    ) : null}
                  </View>
                );
              })}
            </Card>

            <Card className="gap-3 p-4">
              <SectionTitle>Outcome</SectionTitle>
              <RadioGroup
                accessibilityLabel="Outcome"
                value={outcome}
                onValueChange={(v) => setOutcomes((o) => ({ ...o, [r.no]: v === "release" ? "release" : "return" }))}
                className="gap-2"
              >
                <RadioGroup.Item
                  value="release"
                  isDisabled={!canRelease}
                  className="w-full flex-row items-start gap-3 rounded-2xl border border-separator bg-surface px-3.5 py-3"
                >
                  <Icon name="CheckDouble" size={20} tone="success" />
                  <View className="flex-1">
                    <Text className="font-semibold text-foreground">Release to front desk</Text>
                    <Text className="text-xs leading-4 text-muted">
                      {canRelease
                        ? "Status becomes Inspected. Front desk can give it to a guest."
                        : fails
                          ? "Not possible while a check has failed."
                          : "Check every item first."}
                    </Text>
                  </View>
                  <Radio />
                </RadioGroup.Item>
                <RadioGroup.Item
                  value="return"
                  className="w-full flex-row items-start gap-3 rounded-2xl border border-separator bg-surface px-3.5 py-3"
                >
                  <Icon name="ArrowUturnCcwLeft" size={20} tone="warning" />
                  <View className="flex-1">
                    <Text className="font-semibold text-foreground">Return to {r.cleanedByFirst}</Text>
                    <Text className="text-xs leading-4 text-muted">
                      She gets it back on her phone with your reason and photos.
                    </Text>
                  </View>
                  <Radio />
                </RadioGroup.Item>
              </RadioGroup>
              {isReturn ? (
                <View className="gap-1.5">
                  <Text className="text-sm font-medium text-foreground">Reason</Text>
                  {fails ? (
                    <View className="gap-1">
                      {failed.map((c) => (
                        <View key={c.id} className="flex-row items-center gap-2">
                          <Icon name="Xmark" size={12} tone="danger" />
                          <Text className="text-[13px] text-foreground">{c.label} — failed</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  <TextField>
                    <Label>Note for {r.cleanedByFirst}</Label>
                    <TextArea
                      value={notes[r.no] ?? ""}
                      onChangeText={(text) => setNotes((n) => ({ ...n, [r.no]: text }))}
                      placeholder="Tell her what to fix"
                      numberOfLines={2}
                      accessibilityLabel={`Note for ${r.cleanedByFirst}`}
                    />
                  </TextField>
                </View>
              ) : null}
              {block ? <Text className="text-xs leading-4 text-danger">{block}</Text> : null}
              <Button
                size="lg"
                className="min-h-14 w-full"
                isDisabled={!!block}
                onPress={() => setDecided((d) => ({ ...d, [r.no]: isReturn ? "returned" : "released" }))}
              >
                <Button.Label>{isReturn ? `Return to ${r.cleanedByFirst}` : `Release room ${r.no}`}</Button.Label>
              </Button>
              <Text className="text-xs leading-4 text-muted">
                Saved in the room history with your name and the time.
              </Text>
            </Card>
          </>
        ) : (
          <Card className="gap-3 p-5">
            <ToneTile tone={done.tone} icon={done.icon} />
            <View className="gap-1">
              <Text accessibilityRole="header" className="text-xl leading-[26px] font-semibold text-foreground">
                {done.title}
              </Text>
              <Text className="text-muted">{done.text}</Text>
            </View>
            <Chip color={done.tone} variant="soft" className="self-start">
              <Chip.Label>{done.chip}</Chip.Label>
            </Chip>
            <Text className="text-xs leading-4 text-muted">{done.history}</Text>
            {nextRoom ? (
              <Button size="lg" className="min-h-14 w-full" onPress={() => setRoomNo(nextRoom.no)}>
                <Button.Label>Next: room {nextRoom.no}</Button.Label>
                <Icon name="ArrowRight" tone="accent-foreground" />
              </Button>
            ) : null}
            <Button
              variant="ghost"
              className="min-h-11"
              onPress={() =>
                setDecided((d) => {
                  const next = { ...d };
                  delete next[r.no];
                  return next;
                })
              }
            >
              <Button.Label>Undo within 1 minute</Button.Label>
            </Button>
          </Card>
        )}
      </PhoneBody>
    </View>
  );
}
