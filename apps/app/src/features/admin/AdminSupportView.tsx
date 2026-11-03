"use client";

import { CircleCheck, Eye, FaceRobot, Lock, PaperPlane } from "@gravity-ui/icons";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Chip,
  FieldError,
  Input,
  Label,
  Switch,
  Tabs,
  TextArea,
  TextField,
} from "@heroui/react";
import { ChatMessage, ListView, Segment } from "@heroui-pro/react";
import { type Persona, screenHref } from "@injishi/data";
import type {
  Announcement,
  Dispute,
  ModerationReport,
  SupportTicket,
  TicketMessage,
  Tone,
  TranscriptMessage,
} from "@injishi/data/fixtures/admin";
import { Icon, LinkButton, PageContent, PageHeader } from "@injishi/ui";
import { useState } from "react";
import { firstKey, initials, lineTab, OptionSelect, TabCount, ToneChip } from "./shared";

interface AdminSupportData {
  tickets: SupportTicket[];
  messages: TicketMessage[];
  transcripts: TranscriptMessage[];
  reports: ModerationReport[];
  disputes: Dispute[];
  announcements: Announcement[];
}

const PRIO: Record<SupportTicket["priority"], Tone> = { High: "danger", Normal: "default", Low: "default" };

const MOD_TABS = [
  { id: "threads", label: "Threads" },
  { id: "reviews", label: "Reviews" },
  { id: "listings", label: "Listings" },
] as const;

type ModKind = (typeof MOD_TABS)[number]["id"];
type Decision = "keep" | "hide" | "esc";
type Kind = "reply" | "note";

const DECISION: Record<Decision, { label: string; tone: Tone }> = {
  keep: { label: "Kept · no breach · 09:43", tone: "default" },
  hide: { label: "Actioned · owner notified · 09:43", tone: "success" },
  esc: { label: "Escalated to Nadine Kayitesi", tone: "warning" },
};

const FALLBACK: Record<Kind, string> = {
  note: "Watching PI-77142 in the poll; will update the tenant at 11:00.",
  reply:
    "Yes. The payment receipt for the verified attempt is on folio F-5531. The fiscal receipt may still be pending at VSDC; it will appear on the folio once issued.",
};

const BUBBLE: Record<TicketMessage["kind"], string> = {
  staff: "bg-accent-soft",
  note: "bg-warning-soft",
  tenant: "bg-surface-secondary",
};

function queueOwner(owner: string | null, me: string): string {
  if (!owner) return "Unassigned";
  return owner === me ? "You" : owner;
}

export function AdminSupportView({ persona, data }: { persona: Persona; data: AdminSupportData }) {
  const announcement = data.announcements[0];
  const [sel, setSel] = useState(data.tickets[0]?.id ?? "");
  const [showTranscript, setShowTranscript] = useState(true);
  const [kind, setKind] = useState<Kind>("reply");
  const [draft, setDraft] = useState("");
  const [sent, setSent] = useState<{ ticketId: string; kind: Kind; text: string }[]>([]);
  const [resolved, setResolved] = useState<Record<string, boolean>>({});
  const [modTab, setModTab] = useState<ModKind>("threads");
  const [mod, setMod] = useState<Record<string, Decision>>({});
  const [channels, setChannels] = useState(announcement?.channels ?? { banner: true, email: true, sms: false });
  const [lang, setLang] = useState<"en" | "rw">("en");
  const [title, setTitle] = useState(announcement?.title ?? "");
  const [audience, setAudience] = useState(announcement?.audience ?? "");
  const [english, setEnglish] = useState(announcement?.english ?? "");
  const [kinyarwanda, setKinyarwanda] = useState(announcement?.kinyarwanda ?? "");

  const me = persona.name;
  const ticket = data.tickets.find((t) => t.id === sel) ?? data.tickets[0];
  const isResolved = !!resolved[ticket.id];
  const state = isResolved ? "Resolved" : ticket.state;
  const stateTone: Tone = isResolved ? "success" : ticket.tone;
  const thread = [
    ...data.messages.filter((m) => m.ticketId === ticket.id),
    ...sent
      .filter((s) => s.ticketId === ticket.id)
      .map((s) => ({
        id: `${s.ticketId}-${s.text}`,
        ticketId: s.ticketId,
        author: me,
        role: "Injishi support",
        when: "09:43",
        text: s.text,
        kind: (s.kind === "note" ? "note" : "staff") as TicketMessage["kind"],
      })),
  ];
  const transcript = data.transcripts.filter((m) => m.ticketId === ticket.id);
  const fromName = ticket.from.split(",")[0];
  const mods = data.reports.filter((r) => r.kind === modTab);
  const ready = kinyarwanda.trim().length > 0;

  return (
    <PageContent>
      <PageHeader
        eyebrow="Tenants › Support and moderation · 12 open tickets · 6 reports · 4 disputes"
        title="Support and Moderation"
        actions={
          <LinkButton href={screenHref("AdminBusinesses")} variant="secondary">
            <Eye className="size-4" />
            Start view-as
          </LinkButton>
        }
      />

      <div className="flex flex-wrap items-start gap-4">
        <Card className="min-w-0 flex-[1_1_320px] gap-1.5 p-3" aria-labelledby="q-h" render={(p) => <section {...p} />}>
          <div className="flex items-center justify-between px-1.5 py-1">
            <h2 id="q-h" className="text-[15px] leading-[22px] font-semibold">
              Ticket Queue
            </h2>
            <span className="text-xs text-muted">7 of 12 · oldest first</span>
          </div>
          <ListView
            aria-label="Ticket queue"
            selectionMode="single"
            selectionBehavior="replace"
            disallowEmptySelection
            selectedKeys={new Set([ticket.id])}
            onSelectionChange={(keys) => {
              const k = firstKey(keys);
              if (k) setSel(k);
            }}
          >
            {data.tickets.map((t) => {
              const closed = !!resolved[t.id];
              return (
                <ListView.Item key={t.id} id={t.id} textValue={t.subject} className="items-start px-2.5 py-2.5">
                  <ListView.ItemContent className="items-start">
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs text-muted tabular">{t.id}</span>
                        <ToneChip tone={PRIO[t.priority]}>{t.priority}</ToneChip>
                        {t.handoff ? <ToneChip tone="info">From assistant</ToneChip> : null}
                      </span>
                      <span className="text-[13px] leading-[18px] font-medium">{t.subject}</span>
                      <span className="text-xs leading-4 text-muted">
                        {t.tenant} · {queueOwner(t.owner, me)} · {t.age}
                      </span>
                    </div>
                  </ListView.ItemContent>
                  <ListView.ItemAction>
                    <ToneChip tone={closed ? "success" : t.tone}>{closed ? "Resolved" : t.state}</ToneChip>
                  </ListView.ItemAction>
                </ListView.Item>
              );
            })}
          </ListView>
        </Card>

        <Card
          className="min-w-0 flex-[999_1_560px] gap-[14px] p-[18px]"
          aria-labelledby="th-h"
          render={(p) => <section {...p} />}
        >
          <div className="flex flex-wrap items-start gap-2">
            <div className="flex min-w-[min(240px,100%)] flex-1 flex-col gap-0.5">
              <span className="text-xs text-muted tabular">
                {ticket.id} · {ticket.tenant}
              </span>
              <h2 id="th-h" className="text-[17px] leading-6 font-semibold">
                {ticket.subject}
              </h2>
              <span className="text-xs text-muted">
                From {ticket.from} · owner {ticket.owner ?? "Unassigned"} · opened {ticket.age} ago
              </span>
            </div>
            <ToneChip tone={stateTone}>{state}</ToneChip>
          </div>

          {ticket.handoff ? (
            <Card variant="secondary" className="gap-2 px-3.5 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-[13px] font-semibold">
                  <FaceRobot className="size-4" />
                  Handed off from the assistant · 07:37
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-expanded={showTranscript}
                  onPress={() => setShowTranscript((v) => !v)}
                >
                  {showTranscript ? "Hide transcript" : "Show transcript"}
                </Button>
              </div>
              <span className="text-xs text-muted">
                Shared with the tenant’s consent: this conversation and the status of PI-77142. No guest phone number or
                wallet data.
              </span>
              {showTranscript ? (
                <div className="flex flex-col gap-1">
                  {transcript.map((m) =>
                    m.from === "assistant" ? (
                      <ChatMessage.Assistant key={m.id} className="gap-2 p-0">
                        <Avatar size="sm" variant="soft" color="accent">
                          <Avatar.Fallback>
                            <FaceRobot className="size-3.5" />
                          </Avatar.Fallback>
                        </Avatar>
                        <ChatMessage.Body className="pe-0">
                          <ChatMessage.Content className="text-[13px]">{m.text}</ChatMessage.Content>
                        </ChatMessage.Body>
                      </ChatMessage.Assistant>
                    ) : (
                      <ChatMessage.User key={m.id}>
                        <ChatMessage.Bubble>
                          <ChatMessage.Content className="text-[13px]">{m.text}</ChatMessage.Content>
                        </ChatMessage.Bubble>
                      </ChatMessage.User>
                    ),
                  )}
                </div>
              ) : null}
            </Card>
          ) : null}

          <div className="flex flex-col gap-2.5">
            {thread.map((p) => (
              <div key={p.id} className="flex items-start gap-2.5">
                <Avatar size="sm" variant="soft" color={p.kind === "tenant" ? "default" : "accent"}>
                  <Avatar.Fallback>{initials(p.author)}</Avatar.Fallback>
                </Avatar>
                <div className={`flex flex-1 flex-col gap-1 rounded-[14px] px-3 py-2.5 ${BUBBLE[p.kind]}`}>
                  <span className="flex flex-wrap items-center gap-1.5 text-xs">
                    <strong>{p.author}</strong>
                    <span className="text-muted">
                      {p.role} · {p.when}
                    </span>
                    {p.kind === "note" ? (
                      <Chip size="sm" variant="soft" color="warning">
                        <Lock className="size-3" />
                        <Chip.Label>Internal note</Chip.Label>
                      </Chip>
                    ) : null}
                  </span>
                  <span className="text-[13px] leading-[19px]">{p.text}</span>
                </div>
              </div>
            ))}
          </div>

          {isResolved ? (
            <Alert status="success">
              <Alert.Indicator>
                <CircleCheck />
              </Alert.Indicator>
              <Alert.Content>
                <Alert.Title>Resolved by you at 09:43</Alert.Title>
                <Alert.Description>
                  The tenant can reopen within 7 days. A satisfaction survey was sent in English and Kinyarwanda.
                </Alert.Description>
              </Alert.Content>
              <Button size="sm" variant="secondary" onPress={() => setResolved((r) => ({ ...r, [ticket.id]: false }))}>
                Reopen
              </Button>
            </Alert>
          ) : (
            <div className="flex flex-col gap-2">
              <Segment
                aria-label="Message type"
                className="self-start"
                selectedKey={kind}
                onSelectionChange={(k) => setKind(String(k) as Kind)}
              >
                <Segment.Item id="reply">Reply to tenant</Segment.Item>
                <Segment.Item id="note">Internal note</Segment.Item>
              </Segment>
              <TextField fullWidth value={draft} onChange={setDraft}>
                <Label className="sr-only">Message</Label>
                <TextArea
                  rows={3}
                  placeholder={kind === "note" ? "Only Injishi staff see internal notes" : `Reply to ${fromName}`}
                />
              </TextField>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-muted">
                  {kind === "note"
                    ? "Internal notes are never shown to the tenant."
                    : "The tenant sees this in Help › My tickets and by email."}
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onPress={() => setResolved((r) => ({ ...r, [ticket.id]: true }))}
                  >
                    <CircleCheck className="size-4" />
                    Resolve
                  </Button>
                  <Button
                    size="sm"
                    onPress={() => {
                      const text = draft.trim() || FALLBACK[kind];
                      setSent((items) => [...items, { ticketId: ticket.id, kind, text }]);
                      setDraft("");
                    }}
                  >
                    <PaperPlane className="size-4" />
                    {kind === "note" ? "Add note" : "Send reply"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(330px,100%),1fr))]">
        <Card className="gap-3 p-[18px]" aria-labelledby="mod-h" render={(p) => <section {...p} />}>
          <div className="flex flex-col gap-0.5">
            <h2 id="mod-h" className="text-[15px] leading-[22px] font-semibold">
              Moderation Queue
            </h2>
            <p className="text-[13px] leading-[18px] text-muted">
              Decisions cite a policy and are logged. Personal data is masked for moderators.
            </p>
          </div>
          <Segment
            aria-label="Content type"
            className="self-start"
            selectedKey={modTab}
            onSelectionChange={(k) => setModTab(String(k) as ModKind)}
          >
            {MOD_TABS.map((t) => (
              <Segment.Item key={t.id} id={t.id}>
                {t.label} {data.reports.filter((r) => r.kind === t.id && !mod[r.id]).length}
              </Segment.Item>
            ))}
          </Segment>
          {mods.map((r) => {
            const decision = mod[r.id];
            return (
              <Card key={r.id} variant="secondary" className="gap-2 px-3.5 py-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[13px] leading-[18px] font-medium">{r.title}</span>
                  <span className="text-xs whitespace-nowrap text-muted tabular">{r.age}</span>
                </div>
                <span className="text-xs leading-[17px] text-muted">“{r.excerpt}”</span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <Chip size="sm" variant="soft" color="danger">
                    <Chip.Label>{r.policy}</Chip.Label>
                  </Chip>
                  <span className="text-xs text-muted">{r.by}</span>
                </span>
                {decision ? (
                  <ToneChip tone={DECISION[decision].tone} className="self-start">
                    {DECISION[decision].label}
                  </ToneChip>
                ) : (
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="secondary" onPress={() => setMod((m) => ({ ...m, [r.id]: "keep" }))}>
                      Keep
                    </Button>
                    <Button size="sm" variant="danger-soft" onPress={() => setMod((m) => ({ ...m, [r.id]: "hide" }))}>
                      {r.action}
                    </Button>
                    <Button size="sm" variant="ghost" onPress={() => setMod((m) => ({ ...m, [r.id]: "esc" }))}>
                      Escalate
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </Card>

        <Card className="gap-3 p-[18px]" aria-labelledby="esc-h" render={(p) => <section {...p} />}>
          <div className="flex flex-col gap-0.5">
            <h2 id="esc-h" className="text-[15px] leading-[22px] font-semibold">
              Escalations and Disputes
            </h2>
            <p className="text-[13px] leading-[18px] text-muted">
              Money in a dispute stays where it is until the owning domain decides
            </p>
          </div>
          <ListView aria-label="Escalations and disputes" variant="secondary">
            {data.disputes.map((d) => (
              <ListView.Item key={d.id} id={d.id} textValue={d.title} className="items-start">
                <ListView.ItemContent className="items-start">
                  <Icon name={d.icon} className="mt-0.5 size-4" />
                  <div className="flex min-w-0 flex-col">
                    <ListView.Title className="whitespace-normal">{d.title}</ListView.Title>
                    <ListView.Description className="whitespace-normal">{d.meta}</ListView.Description>
                  </div>
                </ListView.ItemContent>
                <ListView.ItemAction>
                  <ToneChip tone={d.tone}>{d.state}</ToneChip>
                </ListView.ItemAction>
              </ListView.Item>
            ))}
          </ListView>
        </Card>

        <Card className="gap-3 p-[18px]" aria-labelledby="ann-h" render={(p) => <section {...p} />}>
          <div className="flex flex-col gap-0.5">
            <h2 id="ann-h" className="text-[15px] leading-[22px] font-semibold">
              Platform Announcement
            </h2>
            <p className="text-[13px] leading-[18px] text-muted">
              Shown to tenant staff in-app and by the channels you pick
            </p>
          </div>
          {announcement ? (
            <>
              <TextField fullWidth value={title} onChange={setTitle}>
                <Label>Title</Label>
                <Input />
              </TextField>
              <OptionSelect label="Audience" options={announcement.audiences} value={audience} onChange={setAudience} />
              <div className="flex flex-wrap gap-3.5">
                {(
                  [
                    ["banner", "In-app banner"],
                    ["email", "Email"],
                    ["sms", "SMS"],
                  ] as const
                ).map(([id, label]) => (
                  <Switch
                    key={id}
                    size="sm"
                    isSelected={channels[id]}
                    onChange={(on) => setChannels((c) => ({ ...c, [id]: on }))}
                    aria-label={label}
                  >
                    <Switch.Content className="gap-2 text-[13px] font-normal">
                      <Switch.Control>
                        <Switch.Thumb />
                      </Switch.Control>
                      {label}
                    </Switch.Content>
                  </Switch>
                ))}
              </div>
              <Tabs variant="secondary" selectedKey={lang} onSelectionChange={(k) => setLang(String(k) as "en" | "rw")}>
                <Tabs.ListContainer>
                  <Tabs.List aria-label="Language">
                    <Tabs.Tab id="en" className={lineTab}>
                      English
                      <TabCount tone="success">Ready</TabCount>
                      <Tabs.Indicator />
                    </Tabs.Tab>
                    <Tabs.Tab id="rw" className={lineTab}>
                      Kinyarwanda
                      <TabCount tone={ready ? "success" : "danger"}>{ready ? "Ready" : "Missing"}</TabCount>
                      <Tabs.Indicator />
                    </Tabs.Tab>
                  </Tabs.List>
                </Tabs.ListContainer>
                <Tabs.Panel id="en" className="pt-2">
                  <TextField fullWidth value={english} onChange={setEnglish}>
                    <Label>Message in English</Label>
                    <TextArea rows={3} />
                  </TextField>
                </Tabs.Panel>
                <Tabs.Panel id="rw" className="pt-2">
                  <TextField fullWidth value={kinyarwanda} onChange={setKinyarwanda} isInvalid={!ready}>
                    <Label>Message in Kinyarwanda</Label>
                    <TextArea rows={3} placeholder="Add the Kinyarwanda text" />
                    <FieldError>Required. Announcements go out in both languages.</FieldError>
                  </TextField>
                </Tabs.Panel>
              </Tabs>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" isDisabled={!ready}>
                  Send for second review
                </Button>
                <Button size="sm" variant="ghost" onPress={() => setLang("rw")}>
                  Add Kinyarwanda
                </Button>
              </div>
              <span className="text-xs leading-4 text-muted">
                {ready
                  ? "A second staff member reviews every announcement before it sends."
                  : "Disabled until the Kinyarwanda text is added. A second staff member reviews every announcement before it sends."}
              </span>
            </>
          ) : null}
        </Card>
      </div>
    </PageContent>
  );
}
