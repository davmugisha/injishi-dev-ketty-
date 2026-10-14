import { screenHref } from "@injishi/data";
import type { ProblemCategory, ProblemReport, ReportPlace, UrgencyLevel } from "@injishi/data/fixtures/staff";
import { Link, useLocalSearchParams } from "expo-router";
import { Button, Card, Chip, Description, Label, Radio, RadioGroup, Switch, TextArea, TextField } from "heroui-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Icon } from "@/components/icon";
import { PhoneBody, PhoneTop } from "@/components/phone";
import { getCollection, getDocument } from "@/lib/store";
import {
  KeyValue,
  PhoneActionBar,
  PhoneTitle,
  PhotoTile,
  param,
  SectionTitle,
  StatusAlert,
  StatusDot,
  ToneTile,
} from "./ui";

const photoLabel = (n: number) => (n ? `${n} ${n === 1 ? "photo" : "photos"}` : "None");

/** Housekeeper reports a problem to maintenance (artifact: StaffReport). */
export default function StaffReportScreen() {
  const offline = param(useLocalSearchParams<{ offline?: string }>().offline) === "1";
  const places = getCollection<ReportPlace>("staff.reportPlaces");
  const categories = getCollection<ProblemCategory>("staff.problemCategories");
  const urgencies = getCollection<UrgencyLevel>("staff.urgencyLevels");
  const report = getDocument<ProblemReport>("staff.problemReports", "WO-318");

  const [place, setPlace] = useState(report?.place ?? "");
  const [category, setCategory] = useState(report?.category ?? "");
  const [urgency, setUrgency] = useState(report?.urgency ?? "");
  const [photos, setPhotos] = useState(report?.photos ?? 0);
  const [block, setBlock] = useState(report?.askBlock ?? false);
  const [seen, setSeen] = useState(report?.description ?? "");
  const [sent, setSent] = useState(false);
  const [retried, setRetried] = useState(false);

  if (!report || !places.length || !categories.length || !urgencies.length) return null;

  const placeDoc = places.find((p) => p.id === place) ?? places[0];
  const isRoom = placeDoc.isRoom;
  const blockOn = block && isRoom;
  const where = isRoom ? `Room ${placeDoc.label}` : "Floor 2 corridor";
  const cat = categories.find((c) => c.id === category) ?? categories[0];
  const sev = urgencies.find((u) => u.id === urgency) ?? urgencies[0];
  const backLabel = `Back to room ${report.place}`;

  const steps = offline
    ? [
        {
          icon: "FloppyDisk",
          tone: "warning" as const,
          title: "Saved on this phone",
          detail: `${report.sentAt} · waiting for signal`,
        },
        {
          icon: "PaperPlane",
          tone: "muted" as const,
          title: "Sends to maintenance",
          detail: "Automatically, as soon as there is signal",
        },
        {
          icon: "Wrench",
          tone: "muted" as const,
          title: `${report.assigneeFirst} gets the job`,
          detail: "Ticket number is given when it arrives",
        },
      ]
    : [
        {
          icon: "Check",
          tone: "success" as const,
          title: "Sent to maintenance",
          detail: `${report.sentAt} · ${photos ? `with ${photoLabel(photos)}` : "no photo"}`,
        },
        {
          icon: "Wrench",
          tone: "accent" as const,
          title: `${report.assignee} notified`,
          detail: "It is in his queue · Beatrice gets a copy",
        },
        ...(blockOn
          ? [
              {
                icon: "Ban",
                tone: "warning" as const,
                title: `Out-of-order request with ${report.manager}`,
                detail: `Room ${placeDoc.label} stays on sale until she approves`,
              },
            ]
          : []),
        {
          icon: "Bell",
          tone: "muted" as const,
          title: "You get a message when it is fixed",
          detail: "Check it in Today",
        },
      ];

  const blockNote = !isRoom
    ? "Corridors are not sold, so there is nothing to block."
    : blockOn
      ? `This asks ${report.managerFirst} (manager) to take room ${placeDoc.label} out of order. Front desk keeps selling it until she approves.`
      : "Leave this off if guests can still use the room.";

  const reset = () => {
    setSent(false);
    setPhotos(0);
    setUrgency(report.urgency);
    setCategory(report.category);
    setRetried(false);
  };

  return (
    <View className="flex-1">
      <PhoneTop>
        <Link href={screenHref("StaffTask") as never} asChild>
          <Button variant="ghost" isIconOnly accessibilityLabel={backLabel} className="size-11">
            <Icon name="ChevronLeft" />
          </Button>
        </Link>
        <PhoneTitle title="Report a problem" sub={`Goes to maintenance · ${report.assigneeFirst} is on shift`} />
      </PhoneTop>

      <PhoneBody>
        {offline && !sent ? (
          <StatusAlert
            status="warning"
            icon="CloudSlash"
            title="No connection"
            description="You can still report. It is saved on this phone and sends when signal is back."
          />
        ) : null}

        {!sent ? (
          <>
            <View className="gap-2">
              <SectionTitle>Where</SectionTitle>
              <View accessibilityLabel="Where" className="flex-row flex-wrap gap-1.5">
                {places.map((p) => {
                  const on = place === p.id;
                  return (
                    <Pressable
                      key={p.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      onPress={() => setPlace(p.id)}
                      className={`h-11 items-center justify-center rounded-3xl px-4 ${on ? "bg-accent-soft" : "bg-default"}`}
                    >
                      <Text
                        className={`text-base font-medium ${on ? "text-accent-soft-foreground" : "text-foreground"}`}
                      >
                        {p.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text className="text-xs leading-4 text-muted">Your rooms today and the floor 2 corridor.</Text>
            </View>

            <View className="gap-2">
              <SectionTitle>What is wrong?</SectionTitle>
              <View accessibilityLabel="What is wrong?" className="flex-row flex-wrap gap-2">
                {categories.map((c) => {
                  const on = category === c.id;
                  return (
                    <Pressable
                      key={c.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      onPress={() => setCategory(c.id)}
                      className={`h-16 min-w-[30%] flex-1 items-center justify-center rounded-2xl ${on ? "bg-accent-soft" : "bg-default"}`}
                    >
                      <View className="items-center gap-1">
                        <Icon name={c.icon} size={20} tone={on ? "accent-soft-foreground" : "foreground"} />
                        <Text
                          className={`text-sm font-medium ${on ? "text-accent-soft-foreground" : "text-foreground"}`}
                        >
                          {c.label}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View className="gap-2">
              <SectionTitle>How urgent?</SectionTitle>
              <RadioGroup accessibilityLabel="How urgent?" value={urgency} onValueChange={setUrgency} className="gap-2">
                {urgencies.map((u) => (
                  <RadioGroup.Item
                    key={u.id}
                    value={u.id}
                    className={`min-h-14 w-full flex-row items-center gap-3 rounded-2xl border bg-surface px-3.5 py-3 ${urgency === u.id ? "border-accent" : "border-separator"}`}
                  >
                    <StatusDot tone={u.tone} />
                    <View className="flex-1">
                      <Text className="font-semibold text-foreground">{u.label}</Text>
                      <Text className="text-xs leading-4 text-muted">{u.hint}</Text>
                    </View>
                    <Radio />
                  </RadioGroup.Item>
                ))}
              </RadioGroup>
            </View>

            <View className="gap-2">
              <SectionTitle>Photo</SectionTitle>
              {photos > 0 ? (
                <>
                  <PhotoTile image={report.photo} caption={report.photoCaption} className="h-[168px] w-full">
                    {photos > 1 ? (
                      <View className="absolute top-2.5 right-2.5">
                        <Chip size="sm" variant="soft">
                          <Chip.Label>{photoLabel(photos)}</Chip.Label>
                        </Chip>
                      </View>
                    ) : null}
                  </PhotoTile>
                  <View className="flex-row gap-2">
                    <Button variant="secondary" size="lg" className="min-h-12 flex-1" onPress={() => setPhotos(0)}>
                      <Icon name="Camera" />
                      <Button.Label>Retake</Button.Label>
                    </Button>
                    <Button
                      variant="ghost"
                      size="lg"
                      className="min-h-12 flex-1"
                      isDisabled={photos >= 3}
                      onPress={() => setPhotos((n) => Math.min(3, n + 1))}
                    >
                      <Icon name="Plus" />
                      <Button.Label>Add another</Button.Label>
                    </Button>
                  </View>
                </>
              ) : (
                <Button
                  variant="secondary"
                  size="lg"
                  className="min-h-24 w-full flex-col gap-1.5"
                  onPress={() => setPhotos(1)}
                >
                  <Icon name="Camera" size={24} />
                  <Button.Label>Take a photo</Button.Label>
                </Button>
              )}
              <Text className="text-xs leading-4 text-muted">Photos are made smaller so they send on weak signal.</Text>
            </View>

            <TextField>
              <Label>What did you see?</Label>
              <TextArea value={seen} onChangeText={setSeen} numberOfLines={3} />
              <Description>A few words is enough.</Description>
            </TextField>

            <Card accessibilityLabel="Room can't be sold" className="gap-1.5 px-4 pt-2 pb-3.5">
              <View className="min-h-[52px] flex-row items-center gap-3">
                <View className="flex-1">
                  <Text className="font-semibold text-foreground">Room can't be sold</Text>
                  <Text className="text-xs leading-4 text-muted">Ask to take it out of order</Text>
                </View>
                <Switch
                  isSelected={blockOn}
                  isDisabled={!isRoom}
                  onSelectedChange={setBlock}
                  accessibilityLabel="Room can't be sold"
                />
              </View>
              <View className="flex-row items-start gap-2">
                <Icon name={blockOn ? "CircleInfo" : "CircleCheck"} tone="muted" />
                <Text className="flex-1 text-xs leading-4 text-muted">{blockNote}</Text>
              </View>
            </Card>
          </>
        ) : (
          <Card accessibilityLabel="Report sent" className="gap-3.5 p-5">
            <ToneTile tone={offline ? "warning" : "success"} icon={offline ? "CloudSlash" : "CircleCheck"} />
            <View className="gap-1">
              <Text accessibilityRole="header" className="text-xl leading-[26px] font-semibold text-foreground">
                {offline ? "Saved on phone · will send" : "Report sent"}
              </Text>
              {!offline ? (
                <Text className="text-[28px] leading-9 font-semibold text-foreground">{report.ticket}</Text>
              ) : null}
              <Text className="text-muted">
                {offline
                  ? "No signal right now. Your report is safe on this phone. It gets a ticket number when it reaches maintenance."
                  : "Maintenance has your report. Keep this number if anyone asks."}
              </Text>
            </View>
            <KeyValue
              items={[
                { label: "Where", value: where },
                { label: "Problem", value: cat.label },
                { label: "Urgency", value: sev.label },
                { label: "Photo", value: photoLabel(photos) },
              ]}
            />
            <View className="gap-3">
              {steps.map((s) => (
                <View key={s.title} className="flex-row gap-2.5">
                  <Icon name={s.icon} tone={s.tone} />
                  <View className="flex-1">
                    <Text className="font-medium text-foreground">{s.title}</Text>
                    <Text className="text-xs leading-4 text-muted">{s.detail}</Text>
                  </View>
                </View>
              ))}
            </View>
            {offline ? (
              <>
                <Button variant="secondary" size="lg" className="min-h-14 w-full" onPress={() => setRetried(true)}>
                  <Icon name="ArrowsRotateRight" />
                  <Button.Label>Try sending now</Button.Label>
                </Button>
                {retried ? (
                  <Text className="text-xs leading-4 text-muted">
                    Still no signal at 10:53. The phone keeps trying on its own.
                  </Text>
                ) : null}
              </>
            ) : null}
            <Link href={screenHref("StaffTask") as never} asChild>
              <Button size="lg" className="min-h-14 w-full">
                <Button.Label>{backLabel}</Button.Label>
              </Button>
            </Link>
            <Button variant="ghost" size="lg" className="min-h-12 w-full" onPress={reset}>
              <Button.Label>Report another problem</Button.Label>
            </Button>
          </Card>
        )}
      </PhoneBody>

      {!sent ? (
        <PhoneActionBar stacked>
          <Button
            size="lg"
            className="min-h-14 w-full"
            onPress={() => {
              setSent(true);
              setRetried(false);
            }}
          >
            <Icon name={offline ? "FloppyDisk" : "PaperPlane"} tone="accent-foreground" />
            <Button.Label>{offline ? "Save report on phone" : "Send report"}</Button.Label>
          </Button>
        </PhoneActionBar>
      ) : null}
    </View>
  );
}
