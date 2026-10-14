"use client";

import { Cup, Paperclip, PaperPlane, Picture, Wrench, Xmark } from "@gravity-ui/icons";
import {
  Avatar,
  Button,
  Card,
  Chip,
  Description,
  Input,
  Label,
  Tabs,
  Tag,
  TagGroup,
  TextArea,
  TextField,
} from "@heroui/react";
import { ChatMessage, ItemCard, PromptInput } from "@heroui-pro/react";
import { NumberStepper } from "@heroui-pro/react/number-stepper";
import { screenHref } from "@injishi/data";
import type {
  GuestMessage,
  GuestStayRecord,
  NotifyChannel,
  RequestType,
  ServiceRequest,
  UpdateDelivery,
} from "@injishi/data/fixtures/guest";
import { Icon, PhoneBody, StatusDot, toneColor } from "@injishi/ui";
import { useState } from "react";
import {
  CardHeading,
  ChevronLink,
  cx,
  GuestTop,
  InitialsAvatar,
  renderAnchor,
  ScreenHeading,
  useGuestLang,
  WideSwitch,
} from "./parts";

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

export interface GuestRequestsData {
  stay: GuestStayRecord;
  types: RequestType[];
  requests: ServiceRequest[];
  messages: GuestMessage[];
  channels: NotifyChannel[];
  deliveries: UpdateDelivery[];
}

/** Guest · requests, the front-desk conversation, and how stay updates are delivered. */
export function GuestRequestsView({ data }: { data: GuestRequestsData }) {
  const { stay, types, requests, messages, channels, deliveries } = data;
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

  const pick = (id: string) => {
    setTypeId(id);
    setUrgent(false);
  };
  const form = types.find((t) => t.id === typeId) ?? types[0];
  const chosen = when[form.id] || form.whens[0] || "";
  const urgentRepair = form.id === "repair" && urgent;
  const routeText = urgentRepair
    ? "Urgent: goes to the duty manager now, who calls maintenance on standby. Usually within 15 min."
    : form.route;
  const openCount = 2 + added.length;

  const mine = [...added, ...requests.map((r) => ({ ...r, status: r.status }))].map((r) => {
    const at = STEPS.indexOf(r.status);
    const meta = STATUS[r.status];
    return { ...r, at, label: meta.label, tone: meta.tone };
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
    setAdded((cur) => [
      {
        id: `added-${cur.length + 1}`,
        icon: form.icon,
        title,
        team,
        status: "sent",
        detail: `Sent 19:40 · ${expect}`,
      },
      ...cur,
    ]);
    setUrgent(false);
    setNote("");
  };

  const send = () => {
    const text = draft.trim() || "Photo";
    if (!draft.trim() && !attach) return;
    setSent((cur) => [...cur, { id: `sent-${cur.length + 1}`, text, meta: "You · 19:40 · Sent", photo: attach }]);
    setDraft("");
    setAttach(false);
  };

  return (
    <>
      <GuestTop
        lead={<InitialsAvatar initials={stay.initials} />}
        title={stay.property}
        sub={`Room ${stay.room} · stay ${stay.id}`}
        lang={lang}
        onLang={setLang}
      />
      <PhoneBody className="gap-[14px]">
        <ScreenHeading title={TITLES[lang]} sub="Requests go straight to the team that handles them." />
        <Tabs variant="secondary" selectedKey={tab} onSelectionChange={(k) => setTab(String(k))} className="shrink-0">
          <Tabs.ListContainer>
            <Tabs.List aria-label="Requests and messages">
              <Tabs.Tab id="requests" className="w-auto whitespace-nowrap">
                Requests
                <Chip size="sm" className="ms-1.5 tabular">
                  {openCount}
                </Chip>
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="messages" className="w-auto whitespace-nowrap">
                Messages
                {tab === "messages" ? null : (
                  <Chip size="sm" variant="soft" color="accent" className="ms-1.5">
                    1 new
                  </Chip>
                )}
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="updates" className="w-auto whitespace-nowrap">
                Updates
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>

          <Tabs.Panel id="requests" className="flex flex-col gap-[14px] p-0">
            <section aria-labelledby="quick-h" className="flex flex-col gap-2">
              <h2 id="quick-h" className="sr-only">
                Quick requests
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {types.map((q) => {
                  const selected = q.id === form.id;
                  return (
                    <ItemCard<"button">
                      key={q.id}
                      className={cx("px-3 py-2.5 text-left", selected && "shadow-[inset_0_0_0_2px_var(--accent)]")}
                      // biome-ignore format: heroui-ok must stay on the button line
                      render={(props) => <button type="button" {...props} aria-pressed={selected} onClick={() => pick(q.id)} />} // heroui-ok: ItemCard pressable pattern
                    >
                      <ItemCard.Icon>
                        <Icon name={q.icon} />
                      </ItemCard.Icon>
                      <ItemCard.Content>
                        <ItemCard.Title className="whitespace-normal">{q.label}</ItemCard.Title>
                        <ItemCard.Description>{q.team}</ItemCard.Description>
                      </ItemCard.Content>
                    </ItemCard>
                  );
                })}
                <ItemCard<"a"> variant="secondary" className="px-3 py-2.5" render={renderAnchor(screenHref("QROrder"))}>
                  <ItemCard.Icon>
                    <Cup />
                  </ItemCard.Icon>
                  <ItemCard.Content>
                    <ItemCard.Title>Order food</ItemCard.Title>
                    <ItemCard.Description>Opens the menu</ItemCard.Description>
                  </ItemCard.Content>
                </ItemCard>
              </div>
            </section>

            <Card aria-labelledby="form-h" className="gap-3 p-4">
              <div className="flex flex-col gap-0.5">
                <CardHeading id="form-h">{form.label}</CardHeading>
                <span className="flex items-start gap-1.5 text-[12px] leading-4">
                  <StatusDot tone={form.open || urgentRepair ? "success" : "warning"} className="mt-1" />
                  <span className="text-muted">{routeText}</span>
                </span>
              </div>
              {form.id === "towels" ? (
                <div className="flex items-center justify-between gap-3">
                  <span id="qty-l" className="font-medium">
                    Bath towels
                  </span>
                  <NumberStepper
                    size="sm"
                    aria-labelledby="qty-l"
                    value={qty}
                    minValue={1}
                    maxValue={4}
                    onChange={(v) => setQty(Number.isNaN(v) ? 1 : v)}
                  >
                    <NumberStepper.Group>
                      <NumberStepper.DecrementButton aria-label="Fewer towels" />
                      <NumberStepper.Value className="min-w-8" />
                      <NumberStepper.IncrementButton aria-label="More towels" />
                    </NumberStepper.Group>
                  </NumberStepper>
                </div>
              ) : null}
              {form.whens.length > 0 && form.whenLabel ? (
                <TagGroup
                  selectionMode="single"
                  disallowEmptySelection
                  selectedKeys={[chosen]}
                  onSelectionChange={(keys) => {
                    const k = [...keys][0];
                    if (k) setWhen((cur) => ({ ...cur, [form.id]: String(k) }));
                  }}
                  className="flex flex-col gap-1.5"
                >
                  <Label id="when-l">{form.whenLabel}</Label>
                  <TagGroup.List aria-labelledby="when-l" className="flex flex-wrap gap-1.5">
                    {form.whens.map((w) => (
                      <Tag key={w} id={w}>
                        {w}
                      </Tag>
                    ))}
                  </TagGroup.List>
                </TagGroup>
              ) : null}
              {form.id === "taxi" ? (
                <TextField fullWidth value={taxiTo} onChange={setTaxiTo} className="gap-1">
                  <Label>Where to?</Label>
                  <Input />
                  <Description>The desk confirms the fare before booking. You pay the driver directly.</Description>
                </TextField>
              ) : null}
              {form.id === "repair" ? (
                <WideSwitch isSelected={urgent} onChange={setUrgent}>
                  Urgent: water, power, lock or safety
                </WideSwitch>
              ) : null}
              <TextField fullWidth value={note} onChange={setNote} className="gap-1">
                <Label>{form.noteLabel}</Label>
                <TextArea rows={2} placeholder={form.placeholder} />
              </TextField>
              <Button size="lg" onPress={submit}>
                <PaperPlane className="size-4" />
                Send to {form.team}
              </Button>
            </Card>

            <section aria-labelledby="mine-h" className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <h2 id="mine-h" className="text-[15px] leading-[22px] font-semibold">
                  My Requests
                </h2>
                <span className="text-[12px] text-muted">This stay</span>
              </div>
              {mine.map((r) => (
                <Card key={r.id} className="gap-2.5 px-4 py-3.5">
                  <div className="flex items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius)] bg-default">
                      <Icon name={r.icon} className="size-4" />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="text-[14px] leading-5 font-semibold">{r.title}</span>
                      <span className="text-[12px] leading-4 text-muted">{r.team}</span>
                    </div>
                    <Chip size="sm" variant="soft" color={toneColor(r.tone)}>
                      {r.label}
                    </Chip>
                  </div>
                  <div className="grid grid-cols-4 gap-1" role="img" aria-label={`Progress: ${r.label}`}>
                    {STEPS.map((s, i) => (
                      <span
                        key={s}
                        className={cx(
                          "block h-1 rounded-sm",
                          i <= r.at ? (r.status === "done" ? "bg-success" : "bg-accent") : "bg-surface-tertiary",
                        )}
                      />
                    ))}
                  </div>
                  <p className="text-[12px] leading-4 text-muted tabular">{r.detail}</p>
                </Card>
              ))}
            </section>
          </Tabs.Panel>

          <Tabs.Panel id="messages" className="flex flex-col gap-3 p-0">
            <ItemCard variant="secondary">
              <Avatar size="sm" variant="soft" color="accent">
                <Avatar.Fallback>FD</Avatar.Fallback>
              </Avatar>
              <ItemCard.Content>
                <ItemCard.Title>Front desk</ItemCard.Title>
                <ItemCard.Description>Linked to stay {stay.id} · usually replies in 10 min</ItemCard.Description>
              </ItemCard.Content>
              <ItemCard.Action>
                <Chip size="sm" variant="soft" color="success">
                  <StatusDot tone="success" />
                  <Chip.Label>Open 24 h</Chip.Label>
                </Chip>
              </ItemCard.Action>
            </ItemCard>
            <section aria-label="Conversation with the front desk" className="flex flex-col gap-3">
              {thread.map((m) =>
                m.isDay ? (
                  <p key={m.id} className="text-center text-[11px] leading-[14px] font-medium text-muted">
                    {m.text}
                  </p>
                ) : m.mine ? (
                  <ChatMessage.User key={m.id} className="gap-[3px]">
                    <ChatMessage.Bubble className="max-w-[84%] bg-accent-soft">
                      <ChatMessage.Content>{m.text}</ChatMessage.Content>
                    </ChatMessage.Bubble>
                    {m.photo ? (
                      <Chip size="sm" variant="soft" className="self-end">
                        <Picture className="size-3" />
                        <Chip.Label>Photo attached</Chip.Label>
                      </Chip>
                    ) : null}
                    <span className="text-[11px] leading-[14px] text-muted">{m.meta}</span>
                  </ChatMessage.User>
                ) : (
                  <ChatMessage.Assistant key={m.id} className="gap-2 p-0">
                    <ChatMessage.Avatar show fallback={m.initials ?? ""} alt={m.meta.split(" · ")[0]} />
                    <ChatMessage.Body className="gap-1 pe-5">
                      <ChatMessage.Bubble>
                        <ChatMessage.Content>{m.text}</ChatMessage.Content>
                      </ChatMessage.Bubble>
                      {m.request ? (
                        <Button size="sm" variant="tertiary" className="self-start" onPress={() => setTab("requests")}>
                          <Wrench className="size-3.5" />
                          {m.request}
                        </Button>
                      ) : null}
                      <span className="text-[11px] leading-[14px] text-muted">{m.meta}</span>
                    </ChatMessage.Body>
                  </ChatMessage.Assistant>
                ),
              )}
            </section>
            <PromptInput size="sm" value={draft} onValueChange={setDraft} onSubmit={send}>
              <PromptInput.Shell>
                <Label htmlFor="desk-msg" className="sr-only">
                  Message the front desk
                </Label>
                <PromptInput.Content>
                  <PromptInput.TextArea id="desk-msg" rows={2} placeholder="Message the front desk" />
                </PromptInput.Content>
                <PromptInput.Toolbar>
                  <PromptInput.ToolbarStart>
                    <Button
                      variant="ghost"
                      size="sm"
                      isIconOnly
                      aria-label={attach ? "Remove photo" : "Attach a photo"}
                      aria-pressed={attach}
                      onPress={() => setAttach((v) => !v)}
                    >
                      {attach ? <Xmark className="size-4" /> : <Paperclip className="size-4" />}
                    </Button>
                    {attach ? (
                      <Chip size="sm" variant="soft">
                        photo.jpg · 1.4 MB
                      </Chip>
                    ) : null}
                  </PromptInput.ToolbarStart>
                  <PromptInput.ToolbarEnd>
                    <PromptInput.Send aria-label="Send message" isDisabled={!draft.trim() && !attach}>
                      <PaperPlane className="size-4" />
                    </PromptInput.Send>
                  </PromptInput.ToolbarEnd>
                </PromptInput.Toolbar>
              </PromptInput.Shell>
            </PromptInput>
            <p className="text-center text-[12px] leading-4 text-muted">
              Only the Isangano team can read this conversation. Replies come from staff, not automated.
            </p>
          </Tabs.Panel>

          <Tabs.Panel id="updates" className="flex flex-col gap-[14px] p-0">
            <Card aria-labelledby="ch-h" className="gap-3.5 p-4">
              <Card.Header className="gap-0.5">
                <CardHeading id="ch-h">How We Update You</CardHeading>
                <Card.Description>Stay updates only: requests, your key and your bill.</Card.Description>
              </Card.Header>
              {channels.map((c) => {
                const selected = on[c.id] ?? c.on;
                return (
                  <div key={c.id} className="flex flex-col gap-1.5 border-t border-separator pt-3">
                    <WideSwitch
                      isSelected={selected}
                      isDisabled={c.locked}
                      onChange={(next) => {
                        if (c.locked) return;
                        setOn((cur) => ({ ...cur, [c.id]: next }));
                      }}
                    >
                      <span className="inline-flex items-center gap-2">
                        <Icon name={c.icon} className="size-4 text-muted" />
                        {c.label}
                      </span>
                    </WideSwitch>
                    <span className="text-[12px] leading-[17px] text-muted tabular">{c.text}</span>
                    {selected && c.consent ? (
                      <Chip size="sm" variant="soft" className="self-start">
                        <Icon name="FileCheck" className="size-3" />
                        <Chip.Label>{c.consent}</Chip.Label>
                      </Chip>
                    ) : null}
                  </div>
                );
              })}
              <ChevronLink href={screenHref("GuestAccount")}>
                Offers and marketing are a separate choice in your account
              </ChevronLink>
            </Card>
            <section aria-labelledby="del-h" className="flex flex-col gap-2">
              <h2 id="del-h" className="text-[15px] leading-[22px] font-semibold">
                Recent Updates
              </h2>
              <ListDeliveries deliveries={deliveries} />
            </section>
          </Tabs.Panel>
        </Tabs>
      </PhoneBody>
    </>
  );
}

function ListDeliveries({ deliveries }: { deliveries: UpdateDelivery[] }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-separator">
      {deliveries.map((d) => (
        <div key={d.id} className="flex flex-col gap-1.5 border-b border-separator px-3 py-3 last:border-b-0">
          <div className="flex items-start justify-between gap-3">
            <span className="text-[14px] leading-5 font-medium">{d.title}</span>
            <span className="shrink-0 text-[12px] text-muted tabular">{d.when}</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {d.channels.map((x) => (
              <Chip key={x.label} size="sm" variant="soft" color={toneColor(x.tone)}>
                {x.label}
              </Chip>
            ))}
          </div>
          {d.note ? <span className="text-[12px] leading-4 text-muted">{d.note}</span> : null}
        </div>
      ))}
    </div>
  );
}
