"use client";

import {
  ArrowsRotateRight,
  ArrowUp,
  Check,
  CheckDouble,
  CircleXmark,
  Clock,
  EyeSlash,
  FileText,
  Lock,
  Paperclip,
  PaperPlane,
  Tray,
} from "@gravity-ui/icons";
import { Avatar, Button, Card, Chip, Label, SearchField, Separator, Toast, Toolbar, toast } from "@heroui/react";
import {
  ChatConversation,
  ChatListView,
  ChatMessage,
  EmptyState,
  ItemCard,
  PromptInput,
  Segment,
} from "@heroui-pro/react";
import { type Persona, screenHref } from "@injishi/data";
import type { MessageChannel, MessageTemplate, MessageThread, ThreadMessage, Tone } from "@injishi/data/fixtures/stays";
import { GateChip, Icon, LinkButton, PageContent, PageHeader } from "@injishi/ui";
import { Fragment, useState, useTransition } from "react";
import type { Selection } from "react-aria-components";
import { replyToGuest } from "./actions";
import { CardHeading, IconTile, SelectField, ToneChip } from "./parts";

type Lang = "EN" | "RW" | "FR";
type Mode = "reply" | "note";

const CH_ICON: Record<MessageChannel, string> = { app: "Smartphone", sms: "Handset", email: "Envelope" };
const CH_NAME: Record<MessageChannel, string> = { app: "guest app", sms: "SMS", email: "email" };
const LANG_CODE: Record<Lang, string> = { EN: "en", RW: "rw", FR: "fr" };
const STATUS_TONE: Record<MessageThread["status"], Tone> = {
  Open: "accent",
  Escalated: "warning",
  Closed: "default",
  "Waiting on guest": "default",
};
const ROUTING = ["Front desk", "Housekeeping", "Maintenance", "Isangano Terrace", "Concierge"];
const SERVICE_TRACK = ["Created", "Assigned", "In progress", "Fulfilled", "Closed"];
const ORDER_TRACK = ["Placed", "Preparing", "Delivered", "Posted to folio"];
const FILTERS = [
  { id: "all", label: "All" },
  { id: "mine", label: "Mine" },
  { id: "unassigned", label: "Unassigned" },
];

/** A delivery report line under a staff message. */
interface Delivery {
  icon: "ok" | "fail" | "pending" | "delivered";
  text: string;
}

/** A message as the conversation shows it: stored delivery reports become delivery states. */
type ViewMessage =
  | Exclude<ThreadMessage, { t: "staff" }>
  | { t: "staff"; text: string; meta: string; lang?: string; delivery: Delivery[]; sms?: boolean };

const toView = (m: ThreadMessage): ViewMessage =>
  m.t === "staff" ? { ...m, delivery: m.delivery.map((d) => ({ icon: d.ok ? "ok" : "fail", text: d.text })) } : m;

function DeliveryLine({ d }: { d: Delivery }) {
  const Glyph = d.icon === "ok" ? CheckDouble : d.icon === "fail" ? CircleXmark : d.icon === "pending" ? Clock : Check;
  return (
    <span
      className={`flex items-center gap-1.5 text-[11px] leading-[14px] tabular ${d.icon === "fail" ? "text-danger" : "text-muted"}`}
    >
      <Glyph className="size-3 shrink-0" aria-hidden="true" />
      {d.text}
    </span>
  );
}

function TrackChips({ labels, current }: { labels: string[]; current: number }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {labels.map((label, i) =>
        i < current ? (
          <Chip key={label} size="sm" variant="soft">
            <Check className="size-3" aria-hidden="true" />
            <Chip.Label>{label}</Chip.Label>
          </Chip>
        ) : (
          <Chip
            key={label}
            size="sm"
            variant={i === current ? "soft" : "tertiary"}
            color={i === current ? "accent" : "default"}
          >
            <Chip.Label>{label}</Chip.Label>
          </Chip>
        ),
      )}
    </div>
  );
}

export function MessagesView({
  persona,
  threads,
  templates,
}: {
  persona: Persona;
  threads: MessageThread[];
  templates: MessageTemplate[];
}) {
  const [sel, setSel] = useState(threads[0]?.id ?? "");
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [read, setRead] = useState<Record<string, boolean>>({});
  const [mode, setMode] = useState<Mode>("reply");
  const [lang, setLang] = useState<Lang>("EN");
  const [chan, setChan] = useState<"app" | "sms">("app");
  const [draft, setDraft] = useState("");
  const [sending, startSending] = useTransition();
  /**
   * Conversations carry no assignee, department routing, escalation or SMS delivery yet (threads are active or
   * archived, nothing more): those controls say so and change nothing.
   */
  const unavailable = (what: string) => toast.warning(`${what} is not available yet. Nothing was changed.`);
  /** Today's date for the header, on the Kigali calendar. */
  const todayLabel = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Kigali",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  const all = threads.map((t) => ({
    ...t,
    unread: read[t.id] || sel === t.id ? 0 : t.unread,
  }));
  const unreadTotal = all.reduce((a, t) => a + t.unread, 0);
  const needle = q.trim().toLowerCase();
  const list = all.filter(
    (t) =>
      (filter === "all" || (filter === "mine" ? t.assignee === persona.initials : !t.assignee)) &&
      (!needle || `${t.name} ${t.ctx}`.toLowerCase().includes(needle)),
  );
  const cur = all.find((t) => t.id === sel) ?? all[0];
  if (!cur) {
    return (
      <PageContent className="gap-3.5">
        <PageHeader eyebrow={todayLabel} title="Guest Messages" />
        <Card className="p-6">
          <EmptyState>
            <EmptyState.Header>
              <EmptyState.Media variant="icon">
                <Tray />
              </EmptyState.Media>
              <EmptyState.Title>No guest conversations yet</EmptyState.Title>
              <EmptyState.Description>
                Conversations appear here when a guest writes to the property.
              </EmptyState.Description>
            </EmptyState.Header>
          </EmptyState>
        </Card>
      </PageContent>
    );
  }
  const escalatedText = cur.escalated;
  // The stay's own page, from the reference the conversation names ("ST-8812 · room 305").
  const stayRef = cur.facts.find((f) => f.label === "Stay")?.value.split(" · ")[0] ?? "";
  const linkHref = (board: (typeof cur.links)[number]["board"]) =>
    board === "StayFolio" && /^ST-/.test(stayRef) ? `/stays/${encodeURIComponent(stayRef)}` : screenHref(board);
  const closed = cur.closed;
  const smsOk = cur.channels.includes("sms");
  const primary: MessageChannel = cur.channels.includes("app") ? "app" : "email";
  const useSms = chan === "sms" && smsOk;
  const isNote = mode === "note";
  const draftLabel = isNote ? "Internal note" : `Reply to ${cur.name}`;

  const pick = (id: string) => {
    setSel(id);
    setRead({ ...read, [id]: true });
    setDraft("");
    setChan("app");
  };

  const send = () => {
    const text = draft.trim();
    if (!text || closed || sending) return;
    if (isNote) {
      // Internal notes have no place on a conversation yet (the message body types are text, image, voice and system).
      toast.warning("Internal notes are not saved yet. Nothing was sent to the guest.");
      return;
    }
    if (useSms) {
      toast.warning("SMS replies are not connected yet. Send it in the guest app instead.");
      return;
    }
    const threadId = cur.id;
    startSending(async () => {
      const result = await replyToGuest(threadId, text);
      if (!result.ok) {
        toast.danger(`Not sent: ${result.error}`);
        return;
      }
      // The conversation is read again from the API, the reply with it.
      setDraft("");
    });
  };

  // Replies are read back from the API with the conversation, so nothing is kept only on this screen.
  const messages: ViewMessage[] = cur.messages.map(toView);
  const preview = (t: MessageThread) =>
    [...t.messages].reverse().find((m) => m.t === "guest" || m.t === "staff") as
      | Extract<ThreadMessage, { text: string }>
      | undefined;

  return (
    <PageContent className="gap-3.5">
      <Toast.Provider placement="bottom" />
      <PageHeader
        eyebrow={`${todayLabel} · Isangano Lakeside Hotel`}
        title="Guest Messages"
        description="Booking threads before arrival, stay threads after check-in. Internal notes never reach the guest."
        actions={<ToneChip tone="default">Replies reach the guest app</ToneChip>}
      />

      <div className="flex flex-wrap items-stretch gap-3">
        <Card
          aria-labelledby="in-h"
          className="h-[760px] min-w-[min(260px,100%)] flex-[0_1_300px] gap-2.5 overflow-hidden p-3"
        >
          <CardHeading
            id="in-h"
            title="Inbox"
            className="items-center"
            action={<span className="text-[12px] text-muted tabular">{unreadTotal} unread</span>}
          />
          <Segment
            aria-label="Filter threads"
            selectedKey={filter}
            onSelectionChange={(k) => setFilter(String(k))}
            className="w-full"
          >
            {FILTERS.map((f) => (
              <Segment.Item key={f.id} id={f.id} className="flex-1">
                {f.label}
              </Segment.Item>
            ))}
          </Segment>
          <SearchField
            aria-label="Search threads by guest, room or booking"
            value={q}
            onChange={setQ}
            variant="secondary"
            fullWidth
          >
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Guest, room or booking" />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
            <ChatListView
              aria-label="Threads"
              items={list}
              className="flex flex-col gap-1 bg-transparent p-0"
              selectionMode="single"
              selectionBehavior="replace"
              disallowEmptySelection
              selectedKeys={[cur.id]}
              onSelectionChange={(keys: Selection) => {
                const k = keys === "all" ? null : [...keys][0];
                if (k) pick(String(k));
              }}
              renderEmptyState={() => (
                <EmptyState size="sm">
                  <EmptyState.Header>
                    <EmptyState.Media variant="icon">
                      <Tray />
                    </EmptyState.Media>
                    <EmptyState.Title>No threads match</EmptyState.Title>
                    <EmptyState.Description>Try another name, room or booking number.</EmptyState.Description>
                  </EmptyState.Header>
                </EmptyState>
              )}
            >
              {(t) => {
                const last = preview(t);
                return (
                  <ChatListView.Item
                    id={t.id}
                    textValue={`${t.name} ${t.ctx}`}
                    className="h-auto rounded-xl border-0 bg-transparent px-2.5 py-2 data-[selected=true]:bg-default"
                  >
                    <ChatListView.ItemContent className="items-start gap-2.5">
                      <Avatar size="sm" variant="soft" color={t.status === "Escalated" ? "warning" : "default"}>
                        <Avatar.Fallback>{t.initials}</Avatar.Fallback>
                      </Avatar>
                      <ChatListView.Text className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="flex items-center justify-between gap-1.5">
                          <ChatListView.Title
                            className={`truncate text-[13px] ${t.unread ? "font-semibold" : "font-medium"}`}
                          >
                            {t.name}
                          </ChatListView.Title>
                          <span className="shrink-0 text-[11px] text-muted tabular">{t.time}</span>
                        </span>
                        <span className="truncate text-[12px] leading-4 text-muted">{t.ctx}</span>
                        <ChatListView.Preview className="truncate text-[12px] leading-4 text-foreground">
                          {last?.text ?? ""}
                        </ChatListView.Preview>
                        <span className="mt-0.5 flex items-center gap-1.5">
                          <ToneChip
                            size="sm"
                            tone={t.status === "Escalated" ? "warning" : t.dept === "Front desk" ? "default" : "info"}
                          >
                            {t.dept}
                          </ToneChip>
                          {t.channels.map((c) => (
                            <Icon key={c} name={CH_ICON[c]} className="size-3.5 text-muted" />
                          ))}
                          <span className="sr-only">Channels: {t.channels.map((c) => CH_NAME[c]).join(", ")}</span>
                          <span className="flex-1" />
                          <span className="text-[11px] text-muted">{t.assignee || "Unassigned"}</span>
                          {t.unread ? (
                            <Chip size="sm" variant="primary" color="accent" aria-label={`${t.unread} unread`}>
                              <Chip.Label>{t.unread}</Chip.Label>
                            </Chip>
                          ) : null}
                        </span>
                      </ChatListView.Text>
                    </ChatListView.ItemContent>
                  </ChatListView.Item>
                );
              }}
            </ChatListView>
          </div>
        </Card>

        <Card aria-labelledby="cv-h" className="h-[760px] min-w-0 flex-[1_1_420px] gap-0 overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-separator px-4 py-3">
            <div className="flex min-w-0 flex-col">
              <h2 id="cv-h" className="text-[15px] leading-[22px] font-semibold">
                {cur.name}
              </h2>
              <span className="text-[12px] text-muted tabular">
                {cur.ctx} · {cur.channels.map((c) => CH_NAME[c]).join(", ")}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <ToneChip tone={STATUS_TONE[cur.status]}>{cur.status}</ToneChip>
              <ToneChip tone="default">{cur.assigneeFull}</ToneChip>
            </div>
          </div>

          <ChatConversation
            key={cur.id}
            initial="instant"
            className="min-h-0 flex-1 px-4"
            aria-label="Conversation"
            aria-live="polite"
          >
            <ChatConversation.Content className="flex flex-col gap-2.5 py-3">
              {messages.map((m, i) => {
                const key = `${cur.id}-${i}`;
                if (m.t === "day")
                  return (
                    <div key={key} className="flex items-center gap-2.5">
                      <Separator className="flex-1" />
                      <span className="text-[12px] text-muted">{m.text}</span>
                      <Separator className="flex-1" />
                    </div>
                  );
                if (m.t === "guest")
                  return (
                    <ChatMessage.Assistant key={key} className="py-0">
                      <ChatMessage.Avatar show alt={cur.name} fallback={cur.initials} />
                      <ChatMessage.Body className="gap-1">
                        <ChatMessage.Bubble className="self-start">
                          <ChatMessage.Content lang={m.lang ?? "en"}>{m.text}</ChatMessage.Content>
                        </ChatMessage.Bubble>
                        {m.file ? (
                          <ItemCard variant="outline" className="self-start px-3 py-2">
                            <ItemCard.Icon>
                              <Paperclip />
                            </ItemCard.Icon>
                            <ItemCard.Content>
                              <ItemCard.Title>{m.file}</ItemCard.Title>
                              <ItemCard.Description>{m.fileMeta}</ItemCard.Description>
                            </ItemCard.Content>
                          </ItemCard>
                        ) : null}
                        <span className="text-[11px] text-muted tabular">{m.meta}</span>
                      </ChatMessage.Body>
                    </ChatMessage.Assistant>
                  );
                if (m.t === "staff") {
                  const sms = !!m.sms;
                  const delivery = m.delivery;
                  return (
                    <ChatMessage.User key={key} className="gap-1">
                      <ChatMessage.Bubble className="max-w-[82%] bg-accent-soft">
                        <ChatMessage.Content lang={m.lang ?? "en"}>{m.text}</ChatMessage.Content>
                      </ChatMessage.Bubble>
                      <span className="text-[11px] text-muted tabular">{m.meta}</span>
                      {delivery.map((d) => (
                        <DeliveryLine key={d.text} d={d} />
                      ))}
                      {sms ? (
                        <Button size="sm" variant="secondary" onPress={() => unavailable("Retrying an SMS")}>
                          <ArrowsRotateRight className="size-4" />
                          Retry SMS
                        </Button>
                      ) : null}
                    </ChatMessage.User>
                  );
                }
                if (m.t === "note")
                  return (
                    <Card key={key} variant="tertiary" className="ml-12 gap-1 px-3 py-2.5">
                      <span className="flex items-center gap-1.5 text-[12px] font-medium">
                        <EyeSlash className="size-3.5" aria-hidden="true" />
                        Internal note · the guest cannot see this
                      </span>
                      <span className="text-[13px] leading-[18px]">{m.text}</span>
                      <span className="text-[11px] text-muted tabular">{m.meta}</span>
                    </Card>
                  );
                return (
                  <Card key={key} variant="secondary" className="mx-6 gap-2 px-3.5 py-3">
                    <div className="flex items-start gap-2.5">
                      <IconTile name={m.icon} />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="text-[12px] text-muted tabular">
                          {m.kind} {m.ref} · {m.at}
                        </span>
                        <span className="font-semibold">{m.text}</span>
                        <span className="text-[12px] leading-4 text-muted tabular">{m.sub}</span>
                      </div>
                      <ToneChip size="sm" tone={m.kind === "Order" ? "default" : "info"}>
                        {m.kind}
                      </ToneChip>
                    </div>
                    <TrackChips labels={m.kind === "Order" ? ORDER_TRACK : SERVICE_TRACK} current={m.step} />
                    <span className="text-[12px] text-muted tabular">{m.foot}</span>
                  </Card>
                );
              })}
            </ChatConversation.Content>
            <ChatConversation.ScrollAnchor />
          </ChatConversation>

          <div className="flex flex-col gap-2 border-t border-separator px-4 pt-2.5 pb-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Segment
                aria-label="Message type"
                selectedKey={mode}
                onSelectionChange={(k) => setMode(String(k) as Mode)}
              >
                <Segment.Item id="reply">Reply to guest</Segment.Item>
                <Segment.Item id="note">Internal note</Segment.Item>
              </Segment>
              <Segment
                aria-label="Template language"
                selectedKey={lang}
                onSelectionChange={(k) => setLang(String(k) as Lang)}
              >
                {(["EN", "RW", "FR"] as const).map((l) => (
                  <Segment.Item key={l} id={l}>
                    {l}
                  </Segment.Item>
                ))}
              </Segment>
            </div>
            <Toolbar aria-label="Templates" className="flex flex-wrap items-center gap-1.5">
              <span className="text-[12px] text-muted">Templates</span>
              {templates.map((tp) => (
                <Button
                  key={tp.id}
                  size="sm"
                  variant="secondary"
                  onPress={() => {
                    setDraft(tp[lang]);
                    setMode("reply");
                  }}
                >
                  <FileText className="size-4" />
                  {tp.label}
                </Button>
              ))}
            </Toolbar>
            <PromptInput value={draft} onValueChange={setDraft} onSubmit={send} isDisabled={closed}>
              <PromptInput.Shell>
                <Label htmlFor="draft" className="sr-only">
                  {draftLabel}
                </Label>
                <PromptInput.Content>
                  <PromptInput.TextArea
                    id="draft"
                    aria-label={draftLabel}
                    rows={2}
                    lang={LANG_CODE[lang]}
                    placeholder={
                      closed
                        ? "This thread is closed after checkout and is read-only."
                        : isNote
                          ? "Note for staff only. The guest never sees it."
                          : `Write to ${cur.name} or pick a template`
                    }
                  />
                </PromptInput.Content>
                <PromptInput.Toolbar>
                  <PromptInput.ToolbarStart className="gap-2">
                    <PromptInput.Action
                      aria-label="Attach a file"
                      tooltip="Attachments are not available yet"
                      onPress={() => unavailable("Attaching a file to a reply")}
                    >
                      <Paperclip className="size-4" />
                    </PromptInput.Action>
                    <Segment
                      aria-label="Send through"
                      size="sm"
                      selectedKey={chan}
                      onSelectionChange={(k) => setChan(String(k) as "app" | "sms")}
                    >
                      <Segment.Item id="app">{primary === "app" ? "App" : "Email"}</Segment.Item>
                      <Segment.Item id="sms" isDisabled={!smsOk}>
                        SMS
                      </Segment.Item>
                    </Segment>
                  </PromptInput.ToolbarStart>
                  <PromptInput.ToolbarEnd className="gap-2">
                    {isNote || !smsOk ? (
                      <span className="text-[11px] text-muted">{isNote ? "Staff only" : "No SMS consent on file"}</span>
                    ) : null}
                    <Button size="sm" isDisabled={!draft.trim() || closed || sending} onPress={send}>
                      <PaperPlane className="size-4" />
                      {isNote ? "Add note" : "Send"}
                    </Button>
                  </PromptInput.ToolbarEnd>
                </PromptInput.Toolbar>
              </PromptInput.Shell>
            </PromptInput>
          </div>
        </Card>

        <Card<"aside">
          render={(props) => <aside {...props} />}
          aria-labelledby="ctx-h"
          className="h-[760px] min-w-[min(260px,100%)] flex-[0_1_300px] gap-3.5 overflow-y-auto p-3.5"
        >
          <div className="flex items-center gap-2.5">
            <Avatar variant="soft" color={cur.status === "Escalated" ? "warning" : "default"}>
              <Avatar.Fallback>{cur.initials}</Avatar.Fallback>
            </Avatar>
            <div className="flex min-w-0 flex-col">
              <h2 id="ctx-h" className="text-[15px] leading-[22px] font-semibold">
                {cur.name}
              </h2>
              <span className="text-[12px] text-muted">{cur.who}</span>
            </div>
          </div>
          <dl className="grid grid-cols-[minmax(80px,max-content)_minmax(0,1fr)] gap-x-4 gap-y-2 text-[13px] leading-5">
            {cur.facts.map((f) => (
              <Fragment key={f.label}>
                <dt className="text-muted">{f.label}</dt>
                <dd className="font-medium tabular">{f.value}</dd>
              </Fragment>
            ))}
          </dl>
          <div className="flex flex-wrap gap-1.5">
            {cur.links.map((l) => (
              <LinkButton key={l.label} href={linkHref(l.board)} size="sm" variant="secondary">
                {l.label}
              </LinkButton>
            ))}
          </div>
          <Separator />
          <div className="flex flex-col gap-2">
            <h3 className="text-[13px] font-semibold">Routing</h3>
            <SelectField
              label="Department"
              value={cur.dept}
              onChange={() => unavailable("Routing a conversation to another department")}
              options={ROUTING}
            />
            <span className="text-[12px] text-muted">
              {cur.assigneeFull ? `Assigned to ${cur.assigneeFull}` : "Not assigned"}
              {cur.sla ? ` · ${cur.sla}` : ""}
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {!cur.assignee && !closed ? (
                <Button size="sm" variant="secondary" onPress={() => unavailable("Assigning a conversation")}>
                  Assign to me
                </Button>
              ) : null}
              {!escalatedText && !closed ? (
                <Button size="sm" variant="secondary" onPress={() => unavailable("Escalating a conversation")}>
                  <ArrowUp className="size-4" />
                  Escalate to duty manager
                </Button>
              ) : null}
              {escalatedText ? <ToneChip tone="warning">{escalatedText}</ToneChip> : null}
            </div>
          </div>
          <Separator />
          <div className="flex flex-col gap-2">
            <h3 className="text-[13px] font-semibold">Channels and Consent</h3>
            {cur.consent.map((c) => (
              <div key={c.channel} className="flex items-start gap-2">
                <Icon name={c.icon} className="mt-0.5 size-4 shrink-0 text-muted" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[13px] font-medium">{c.channel}</span>
                  <span className="text-[11px] leading-[14px] text-muted tabular">{c.detail}</span>
                </span>
                <ToneChip size="sm" tone={c.tone} emphasis={c.emphasis}>
                  {c.state}
                </ToneChip>
              </div>
            ))}
            <GateChip icon={<Lock className="size-3" />} className="self-start">
              WhatsApp adapter not approved yet
            </GateChip>
          </div>
        </Card>
      </div>
    </PageContent>
  );
}
