import { screenHref } from "@injishi/data";
import type {
  GuestMessage,
  GuestStayRecord,
  NotifyChannel,
  RequestType,
  ServiceRequest,
  UpdateDelivery,
} from "@injishi/data/fixtures/guest";
import { Link } from "expo-router";
import { Button, Card, Chip, Description, Input, Label, Switch, TextArea, TextField } from "heroui-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Icon } from "@/components/icon";
import { PhoneBody } from "@/components/phone";
import { getCollection } from "@/lib/store";
import { toneColor } from "@/lib/tone";
import {
  ChevronLink,
  CountStepper,
  GuestTop,
  IconTile,
  InitialsAvatar,
  LineTabs,
  ScreenHeading,
  SectionTitle,
  SoftChip,
  StatusDot,
  useGuestLang,
} from "./ui";

const TITLES = {
  en: "How can we help?",
  rw: "Twagufasha iki?",
  fr: "Comment pouvons-nous vous aider ?",
} as const;

const STEPS = ["sent", "ack", "progress", "done"] as const;

const STATUS = {
  sent: { label: "Sent", tone: "default" as const },
  ack: { label: "Acknowledged", tone: "info" as const },
  progress: { label: "In progress", tone: "accent" as const },
  done: { label: "Done", tone: "success" as const },
};

interface AddedRequest {
  id: string;
  icon: string;
  title: string;
  team: string;
  status: "sent";
  detail: string;
}

/** Guest · requests, the front-desk conversation, and how stay updates are delivered. */
export default function GuestRequestsScreen() {
  const stays = getCollection<GuestStayRecord>("guest.stays");
  const types = getCollection<RequestType>("guest.requestTypes");
  const requests = getCollection<ServiceRequest>("guest.serviceRequests");
  const messages = getCollection<GuestMessage>("guest.messages").filter((m) => m.thread === "stay");
  const channels = getCollection<NotifyChannel>("guest.notifyChannels");
  const deliveries = getCollection<UpdateDelivery>("guest.updateDeliveries");
  const stay = stays[0];

  const [lang, setLang] = useGuestLang();
  const [tab, setTab] = useState("requests");
  const [typeId, setTypeId] = useState(types[0]?.id ?? "towels");
  const [qty, setQty] = useState(2);
  const [when, setWhen] = useState<Record<string, string>>({});
  const [urgent, setUrgent] = useState(false);
  const [note, setNote] = useState("");
  const [taxiTo, setTaxiTo] = useState("Gisenyi market, Rubavu");
  const [added, setAdded] = useState<AddedRequest[]>([]);
  const [draft, setDraft] = useState("");
  const [attach, setAttach] = useState(false);
  const [sent, setSent] = useState<{ id: string; text: string; meta: string; photo: boolean }[]>([]);
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(channels.map((c) => [c.id, c.on])));

  if (!stay || !types.length) return null;

  const form = types.find((item) => item.id === typeId) ?? types[0];
  const chosen = when[form.id] || form.whens[0] || "";
  const urgentRepair = form.id === "repair" && urgent;
  const routeText = urgentRepair
    ? "Urgent: goes to the duty manager now, who calls maintenance on standby. Usually within 15 min."
    : form.route;
  const openCount = 2 + added.length;

  const mine = [...added, ...requests].map((item) => {
    const at = STEPS.indexOf(item.status);
    const meta = STATUS[item.status];
    return { ...item, at, label: meta.label, tone: meta.tone };
  });

  const thread = [
    ...messages.map((m) => ({
      id: m.id,
      isDay: m.kind === "day",
      mine: m.kind === "guest",
      text: m.text,
      meta: m.meta,
      initials: m.initials,
      photo: m.photo,
      request: m.request,
    })),
    ...sent.map((m) => ({
      id: m.id,
      isDay: false,
      mine: true,
      text: m.text,
      meta: m.meta,
      initials: null as string | null,
      photo: m.photo,
      request: null as string | null,
    })),
  ];

  const submit = () => {
    const title = form.id === "towels" ? `Fresh towels × ${qty}` : chosen ? `${form.label} · ${chosen}` : form.label;
    const team = urgentRepair ? "Duty manager (urgent)" : form.team;
    const expect = urgentRepair ? "usually within 15 min" : form.expect;
    setAdded((current) => [
      {
        id: `added-${current.length + 1}`,
        icon: form.icon,
        title,
        team,
        status: "sent",
        detail: `Sent 19:40 · ${expect}`,
      },
      ...current,
    ]);
    setUrgent(false);
    setNote("");
  };

  const send = () => {
    const text = draft.trim() || "Photo";
    if (!draft.trim() && !attach) return;
    setSent((current) => [
      ...current,
      { id: `sent-${current.length + 1}`, text, meta: "You · 19:40 · Sent", photo: attach },
    ]);
    setDraft("");
    setAttach(false);
  };

  return (
    <>
      <GuestTop
        lead={<InitialsAvatar initials={stay.initials} label={stay.property} />}
        title={stay.property}
        sub={`Room ${stay.room} · stay ${stay.id}`}
        lang={lang}
        onLang={setLang}
      />
      <PhoneBody>
        <View className="gap-[14px]">
          <ScreenHeading title={TITLES[lang]} sub="Requests go straight to the team that handles them." />
          <LineTabs
            label="Requests and messages"
            value={tab}
            onChange={setTab}
            items={[
              { id: "requests", label: "Requests", badge: String(openCount) },
              {
                id: "messages",
                label: "Messages",
                badge: tab === "messages" ? undefined : "1 new",
                badgeColor: "accent",
              },
              { id: "updates", label: "Updates" },
            ]}
          />

          {tab === "requests" ? (
            <>
              <View className="flex-row flex-wrap gap-2">
                {types.map((item) => {
                  const selected = item.id === form.id;
                  return (
                    <Pressable
                      key={item.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => {
                        setTypeId(item.id);
                        setUrgent(false);
                      }}
                      className="w-[48%]"
                    >
                      <Card className={`gap-2 px-3 py-2.5 ${selected ? "border-2 border-accent" : ""}`}>
                        <IconTile name={item.icon} />
                        <Text className="font-semibold text-foreground">{item.label}</Text>
                        <Text className="text-xs text-muted">{item.team}</Text>
                      </Card>
                    </Pressable>
                  );
                })}
                <Link href={screenHref("QROrder") as never} asChild>
                  <Pressable accessibilityRole="link" className="w-[48%]">
                    <Card variant="secondary" className="gap-2 px-3 py-2.5">
                      <IconTile name="Cup" />
                      <Text className="font-semibold text-foreground">Order food</Text>
                      <Text className="text-xs text-muted">Opens the menu</Text>
                    </Card>
                  </Pressable>
                </Link>
              </View>

              <Card className="gap-3 p-4">
                <View className="gap-0.5">
                  <SectionTitle>{form.label}</SectionTitle>
                  <View className="flex-row items-start gap-1.5">
                    <View className="mt-1">
                      <StatusDot tone={form.open || urgentRepair ? "success" : "warning"} />
                    </View>
                    <Text className="flex-1 text-xs leading-4 text-muted">{routeText}</Text>
                  </View>
                </View>
                {form.id === "towels" ? (
                  <View className="flex-row items-center justify-between gap-3">
                    <Text className="font-medium text-foreground">Bath towels</Text>
                    <CountStepper
                      label="Bath towels"
                      value={qty}
                      min={1}
                      max={4}
                      onChange={setQty}
                      lessLabel="Fewer towels"
                      moreLabel="More towels"
                    />
                  </View>
                ) : null}
                {form.whens.length > 0 && form.whenLabel ? (
                  <View className="gap-1.5">
                    <Text className="text-sm font-medium text-foreground">{form.whenLabel}</Text>
                    <View className="flex-row flex-wrap gap-1.5">
                      {form.whens.map((option) => (
                        <Button
                          key={option}
                          size="sm"
                          variant={chosen === option ? "primary" : "secondary"}
                          onPress={() => setWhen((current) => ({ ...current, [form.id]: option }))}
                        >
                          <Button.Label>{option}</Button.Label>
                        </Button>
                      ))}
                    </View>
                  </View>
                ) : null}
                {form.id === "taxi" ? (
                  <TextField>
                    <Label>Where to?</Label>
                    <Input value={taxiTo} onChangeText={setTaxiTo} />
                    <Description>The desk confirms the fare before booking. You pay the driver directly.</Description>
                  </TextField>
                ) : null}
                {form.id === "repair" ? (
                  <View className="min-h-[52px] flex-row items-center gap-3">
                    <Text className="flex-1 text-sm font-medium text-foreground">
                      Urgent: water, power, lock or safety
                    </Text>
                    <Switch
                      isSelected={urgent}
                      onSelectedChange={setUrgent}
                      accessibilityLabel="Urgent: water, power, lock or safety"
                    />
                  </View>
                ) : null}
                <TextField>
                  <Label>{form.noteLabel}</Label>
                  <TextArea value={note} onChangeText={setNote} numberOfLines={2} placeholder={form.placeholder} />
                </TextField>
                <Button size="lg" onPress={submit}>
                  <Icon name="PaperPlane" tone="accent-foreground" />
                  <Button.Label>Send to {form.team}</Button.Label>
                </Button>
              </Card>

              <View className="gap-2">
                <View className="flex-row items-center justify-between gap-3">
                  <SectionTitle>My Requests</SectionTitle>
                  <Text className="text-xs text-muted">This stay</Text>
                </View>
                {mine.map((item) => (
                  <Card key={item.id} className="gap-2.5 px-4 py-3.5">
                    <View className="flex-row items-start gap-3">
                      <IconTile name={item.icon} />
                      <View className="min-w-0 flex-1">
                        <Text className="text-sm leading-5 font-semibold text-foreground">{item.title}</Text>
                        <Text className="text-xs leading-4 text-muted">{item.team}</Text>
                      </View>
                      <Chip size="sm" variant="soft" color={toneColor(item.tone)}>
                        <Chip.Label>{item.label}</Chip.Label>
                      </Chip>
                    </View>
                    <View
                      accessibilityRole="image"
                      accessibilityLabel={`Progress: ${item.label}`}
                      className="flex-row gap-1"
                    >
                      {STEPS.map((step, index) => (
                        <View
                          key={step}
                          className={`h-1 flex-1 rounded-sm ${index <= item.at ? (item.status === "done" ? "bg-success" : "bg-accent") : "bg-surface-tertiary"}`}
                        />
                      ))}
                    </View>
                    <Text className="text-xs leading-4 text-muted">{item.detail}</Text>
                  </Card>
                ))}
              </View>
            </>
          ) : null}

          {tab === "messages" ? (
            <>
              <Card variant="secondary" className="flex-row items-center gap-3 p-3.5">
                <InitialsAvatar initials="FD" label="Front desk" />
                <View className="min-w-0 flex-1">
                  <Text className="font-semibold text-foreground">Front desk</Text>
                  <Text className="text-xs leading-4 text-muted">
                    Linked to stay {stay.id} · usually replies in 10 min
                  </Text>
                </View>
                <Chip size="sm" variant="soft" color="success">
                  <StatusDot tone="success" />
                  <Chip.Label>Open 24 h</Chip.Label>
                </Chip>
              </Card>
              <View accessibilityLabel="Conversation with the front desk" className="gap-3">
                {thread.map((message) =>
                  message.isDay ? (
                    <Text key={message.id} className="text-center text-[11px] leading-[14px] font-medium text-muted">
                      {message.text}
                    </Text>
                  ) : message.mine ? (
                    <View key={message.id} className="items-end gap-[3px]">
                      <View className="max-w-[84%] rounded-2xl bg-accent-soft px-3 py-2">
                        <Text className="text-sm text-foreground">{message.text}</Text>
                      </View>
                      {message.photo ? <SoftChip label="Photo attached" icon="Picture" /> : null}
                      <Text className="text-[11px] leading-[14px] text-muted">{message.meta}</Text>
                    </View>
                  ) : (
                    <View key={message.id} className="flex-row items-start gap-2">
                      <InitialsAvatar initials={message.initials ?? ""} label={message.meta.split(" · ")[0]} />
                      <View className="min-w-0 flex-1 gap-1">
                        <View className="self-start rounded-2xl bg-surface-secondary px-3 py-2">
                          <Text className="text-sm text-foreground">{message.text}</Text>
                        </View>
                        {message.request ? (
                          <Button
                            size="sm"
                            variant="tertiary"
                            className="self-start"
                            onPress={() => setTab("requests")}
                          >
                            <Icon name="Wrench" size={14} />
                            <Button.Label>{message.request}</Button.Label>
                          </Button>
                        ) : null}
                        <Text className="text-[11px] leading-[14px] text-muted">{message.meta}</Text>
                      </View>
                    </View>
                  ),
                )}
              </View>
              <TextField>
                <TextArea
                  value={draft}
                  onChangeText={setDraft}
                  numberOfLines={2}
                  placeholder="Message the front desk"
                  accessibilityLabel="Message the front desk"
                />
              </TextField>
              <View className="flex-row items-center justify-between gap-2">
                <View className="flex-1 flex-row items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    isIconOnly
                    accessibilityLabel={attach ? "Remove photo" : "Attach a photo"}
                    accessibilityState={{ selected: attach }}
                    onPress={() => setAttach((value) => !value)}
                  >
                    <Icon name={attach ? "Xmark" : "Paperclip"} />
                  </Button>
                  {attach ? <SoftChip label="photo.jpg · 1.4 MB" /> : null}
                </View>
                <Button
                  isIconOnly
                  accessibilityLabel="Send message"
                  isDisabled={!draft.trim() && !attach}
                  onPress={send}
                >
                  <Icon name="PaperPlane" tone="accent-foreground" />
                </Button>
              </View>
              <Text className="text-center text-xs leading-4 text-muted">
                Only the Isangano team can read this conversation. Replies come from staff, not automated.
              </Text>
            </>
          ) : null}

          {tab === "updates" ? (
            <>
              <Card className="gap-3.5 p-4">
                <View className="gap-0.5">
                  <SectionTitle>How We Update You</SectionTitle>
                  <Text className="text-[13px] leading-[18px] text-muted">
                    Stay updates only: requests, your key and your bill.
                  </Text>
                </View>
                {channels.map((channel) => {
                  const selected = on[channel.id] ?? channel.on;
                  return (
                    <View key={channel.id} className="gap-1.5 border-t border-separator pt-3">
                      <View className="min-h-[52px] flex-row items-center gap-3">
                        <Icon name={channel.icon} tone="muted" />
                        <Text className="flex-1 text-sm font-medium text-foreground">{channel.label}</Text>
                        <Switch
                          isSelected={selected}
                          isDisabled={channel.locked}
                          onSelectedChange={(next) => {
                            if (channel.locked) return;
                            setOn((current) => ({ ...current, [channel.id]: next }));
                          }}
                          accessibilityLabel={channel.label}
                        />
                      </View>
                      <Text className="text-xs leading-[17px] text-muted">{channel.text}</Text>
                      {selected && channel.consent ? <SoftChip label={channel.consent} icon="FileCheck" /> : null}
                    </View>
                  );
                })}
                <ChevronLink href={screenHref("GuestAccount")}>
                  Offers and marketing are a separate choice in your account
                </ChevronLink>
              </Card>
              <View className="gap-2">
                <SectionTitle>Recent Updates</SectionTitle>
                <View className="overflow-hidden rounded-2xl border border-separator">
                  {deliveries.map((delivery) => (
                    <View key={delivery.id} className="gap-1.5 border-b border-separator px-3 py-3">
                      <View className="flex-row items-start justify-between gap-3">
                        <Text className="flex-1 text-sm leading-5 font-medium text-foreground">{delivery.title}</Text>
                        <Text className="text-xs text-muted">{delivery.when}</Text>
                      </View>
                      <View className="flex-row flex-wrap gap-1">
                        {delivery.channels.map((channel) => (
                          <Chip key={channel.label} size="sm" variant="soft" color={toneColor(channel.tone)}>
                            <Chip.Label>{channel.label}</Chip.Label>
                          </Chip>
                        ))}
                      </View>
                      {delivery.note ? <Text className="text-xs leading-4 text-muted">{delivery.note}</Text> : null}
                    </View>
                  ))}
                </View>
              </View>
            </>
          ) : null}
        </View>
      </PhoneBody>
    </>
  );
}
