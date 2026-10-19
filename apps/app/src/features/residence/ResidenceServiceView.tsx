"use client";

import { ArrowDownToLine, CircleCheck, Comment, Lock, PaperPlane, PersonPlus, Plus } from "@gravity-ui/icons";
import {
  Avatar,
  Button,
  Card,
  Input,
  Kbd,
  Label,
  Separator,
  Table,
  Tabs,
  TextField,
  Toast,
  toast,
} from "@heroui/react";
import { ChatMessage, ItemCard, ItemCardGroup, Kanban, ListView, PromptInput, Segment } from "@heroui-pro/react";
import type { Persona } from "@injishi/data";
import type {
  AccessRequest,
  PreregisteredVisitor,
  ResidenceUnit,
  ServiceTicket,
  TicketStatus,
  Tone,
  VisitorLogEntry,
} from "@injishi/data/fixtures/residence";
import { stock } from "@injishi/data/media";
import { Icon, KeyValueList, PageContent, PageHeader, Photo } from "@injishi/ui";
import { type CSSProperties, Fragment, useState } from "react";
import {
  createTicketAction,
  decideAccessAction,
  moveTicketAction,
  preregisterVisitorAction,
  writeOnTicketAction,
} from "./actions";
import { downloadCsv, FormDialog, firstKey, lineTab, SelectField, SubHeading, TabCount, ToneChip } from "./shared";

export interface ResidenceServiceData {
  tickets: ServiceTicket[];
  requests: AccessRequest[];
  visitors: PreregisteredVisitor[];
  log: VisitorLogEntry[];
  units: ResidenceUnit[];
}

type Tab = "maint" | "visit";
type Message = ServiceTicket["thread"][number];

const COLUMNS: { id: TicketStatus; title: string; indicator: string }[] = [
  { id: "new", title: "New", indicator: "bg-warning" },
  { id: "assigned", title: "Assigned", indicator: "bg-accent" },
  { id: "progress", title: "In progress", indicator: "bg-[var(--chart-4)]" },
  { id: "done", title: "Fulfilled this week", indicator: "bg-success" },
];
const STATUS: Record<TicketStatus, { label: string; tone: Tone }> = {
  new: { label: "New", tone: "warning" },
  assigned: { label: "Assigned", tone: "info" },
  progress: { label: "In progress", tone: "info" },
  done: { label: "Fulfilled", tone: "success" },
};
const MOVES: TicketStatus[] = ["assigned", "progress", "done"];
const REQUEST: Record<AccessRequest["status"], { label: string; tone: Tone }> = {
  open: { label: "Needs decision", tone: "warning" },
  approved: { label: "Approved", tone: "success" },
  declined: { label: "Declined", tone: "default" },
};
const CATEGORIES = ["Plumbing", "Electrical", "Doors and locks", "Appliances", "Decoration", "Other"];
/** A second shot of the same stock photo shows another part of it. */
const CROPS = ["object-center", "object-bottom", "object-top"];
const ENTRY = ["Yes, if nobody is home", "Only when home", "Not needed · common area"];

export function ResidenceServiceView({ persona, data }: { persona: Persona; data: ResidenceServiceData }) {
  const [tab, setTab] = useState<Tab>("maint");
  // Every write goes to the API and the screen redraws from what it answers: no local copies of records.
  const tickets = data.tickets;
  const [sel, setSel] = useState(data.tickets[0]?.id ?? "");
  const [moved, setMoved] = useState<Record<string, TicketStatus>>({});
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState(false);
  const [busy, setBusy] = useState(false);
  const [requests, setRequests] = useState<Record<string, AccessRequest["status"]>>({});
  const visitors: PreregisteredVisitor[] = data.visitors;

  const unitOptions = [
    ...data.units.map((u) => ({ id: u.id, label: u.resident ? `${u.id} · ${u.resident}` : `${u.id} · vacant` })),
    ...["A", "B", "C"].map((b) => ({ id: `Block ${b}`, label: `Block ${b} · common area` })),
  ];
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticket, setTicket] = useState({ unit: "Block B", title: "", category: CATEGORIES[1], entry: ENTRY[2] });
  const [visitorOpen, setVisitorOpen] = useState(false);
  const leased = data.units.filter((u) => u.resident);
  const [visitor, setVisitor] = useState({ name: "", unit: leased[0]?.id ?? "", window: "Today 14:00–20:00" });

  const statusOf = (t: ServiceTicket) => moved[t.id] ?? t.status;
  const t = tickets.find((x) => x.id === sel) ?? tickets[0];
  const current = statusOf(t);
  const status = STATUS[current];
  const thread: Message[] = t.thread;
  // Vacant units and common areas have no resident to write to: the thread holds internal notes only.
  const noResident = t.resident.startsWith("no one");
  const isNote = note || noResident;
  const threadTitle = noResident
    ? `Internal notes · ${t.resident.includes("vacant") ? "vacant unit" : "common area"}, no resident`
    : `Conversation with ${t.resident}`;
  const openCount = tickets.filter((x) => statusOf(x) !== "done").length;
  const requestState = (r: AccessRequest) => requests[r.id] ?? r.status;
  const toApprove = data.requests.filter((r) => requestState(r) === "open").length;

  /** Reply to the resident or leave an internal note (`POST /ops/residence/repairs/:id/messages`). */
  const send = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    const result = await writeOnTicketAction(t.id, text, isNote);
    setBusy(false);
    if (!result.ok) {
      toast.danger(result.error);
      return;
    }
    setDraft("");
  };

  /** New ticket (`POST /ops/residence/repairs`): the API gives it the next WO number. */
  const createTicket = async () => {
    const title = ticket.title.trim();
    if (!title || busy) return;
    setBusy(true);
    const result = await createTicketAction({ ...ticket, title });
    setBusy(false);
    if (!result.ok) {
      toast.danger(result.error);
      return;
    }
    setSel(result.value);
    setDraft("");
    setTab("maint");
    setTicketOpen(false);
    toast.success(`${result.value} created · ${title}`, { indicator: <CircleCheck className="size-4" /> });
  };

  /** Pre-register a visitor (`POST /ops/residence/visitor-passes`): the gate code comes from the API. */
  const preregister = async () => {
    const name = visitor.name.trim();
    const unit = data.units.find((u) => u.id === visitor.unit);
    if (!name || !unit || busy) return;
    setBusy(true);
    const result = await preregisterVisitorAction({ unit: unit.id, name, window: visitor.window });
    setBusy(false);
    if (!result.ok) {
      toast.danger(result.error);
      return;
    }
    setTab("visit");
    setVisitorOpen(false);
    toast.success(
      `Pass issued for ${name} · code ${result.value.code}. Give the code to the visitor; it is not sent.`,
      {
        indicator: <CircleCheck className="size-4" />,
      },
    );
  };

  const move = async (to: TicketStatus) => {
    if (to === "new") return;
    const result = await moveTicketAction(t.id, to);
    if (!result.ok) {
      toast.danger(result.error);
      return;
    }
    setMoved((m) => ({ ...m, [t.id]: to }));
  };

  const decide = async (r: AccessRequest, decision: "approved" | "declined") => {
    const result = await decideAccessAction(r.id, decision);
    if (!result.ok) {
      toast.danger(result.error);
      return;
    }
    setRequests((m) => ({ ...m, [r.id]: decision }));
  };

  return (
    <PageContent>
      <PageHeader
        eyebrow="Service · Kacyiru Court Residences"
        title="Maintenance and Visitors"
        description="Repairs linked to units and residents, and who may enter the compound. Hotel guests, bookings and rooms are not shown here."
        actions={
          <>
            <Button
              variant="secondary"
              onPress={() => {
                setVisitor({ name: "", unit: leased[0]?.id ?? "", window: "Today 14:00–20:00" });
                setVisitorOpen(true);
              }}
            >
              <PersonPlus className="size-4" />
              Pre-register a visitor
            </Button>
            <Button
              onPress={() => {
                setTicket({ unit: "Block B", title: "", category: CATEGORIES[1], entry: ENTRY[2] });
                setTicketOpen(true);
              }}
            >
              <Plus className="size-4" />
              New ticket
            </Button>
          </>
        }
      />

      <Tabs variant="secondary" selectedKey={tab} onSelectionChange={(k) => setTab(String(k) as Tab)}>
        <Tabs.ListContainer>
          <Tabs.List aria-label="Service views">
            <Tabs.Tab id="maint" className={lineTab}>
              Maintenance
              <TabCount>{openCount} open</TabCount>
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="visit" className={lineTab}>
              Visitors and access
              <TabCount tone="warning">{toApprove} to approve</TabCount>
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="maint" className="pt-5">
          <div className="grid items-start gap-[16px] xl:grid-cols-[minmax(0,1fr)_400px]">
            <section aria-label="Maintenance board" className="min-w-0">
              <Kanban
                size="sm"
                style={{ "--kanban-column-min-width": "172px", "--kanban-column-gap": "12px" } as CSSProperties}
              >
                {COLUMNS.map((col) => {
                  const cards = tickets.filter((x) => statusOf(x) === col.id);
                  return (
                    <Kanban.Column key={col.id} className="max-w-[172px] min-w-[172px]">
                      <Kanban.ColumnHeader>
                        <Kanban.ColumnIndicator className={col.indicator} />
                        <Kanban.ColumnTitle>{col.title}</Kanban.ColumnTitle>
                        <Kanban.ColumnCount>{cards.length}</Kanban.ColumnCount>
                      </Kanban.ColumnHeader>
                      <Kanban.ColumnBody>
                        <Kanban.CardList
                          aria-label={col.title}
                          items={cards}
                          selectionMode="single"
                          selectedKeys={new Set([t.id])}
                          onSelectionChange={(keys) => {
                            const k = firstKey(keys);
                            if (k) {
                              setSel(k);
                              setDraft("");
                            }
                          }}
                          renderEmptyState={() => <span className="text-[12px] text-muted">No tickets</span>}
                        >
                          {(k) => (
                            <Kanban.Card
                              id={k.id}
                              textValue={`${k.unit}, ${k.id}, ${k.title}, ${k.who}`}
                              className="[&[data-selected=true]_[data-slot=kanban-card-content]]:ring-2 [&[data-selected=true]_[data-slot=kanban-card-content]]:ring-accent"
                            >
                              <span className="flex w-full items-center justify-between gap-2">
                                <span className="text-[13px] font-semibold tabular">{k.unit}</span>
                                <span className="text-[11px] text-muted tabular">{k.id}</span>
                              </span>
                              <span className="text-[13px] leading-[18px] font-medium">{k.title}</span>
                              <span className="text-[12px] leading-4 text-muted">{k.who}</span>
                            </Kanban.Card>
                          )}
                        </Kanban.CardList>
                      </Kanban.ColumnBody>
                    </Kanban.Column>
                  );
                })}
              </Kanban>
            </section>

            <Card className="min-w-0 gap-[14px] p-[18px]" aria-labelledby="tk-h" render={(p) => <aside {...p} />}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-[12px] text-muted tabular">
                    {t.id} · {t.unit} · {t.category}
                  </span>
                  <h2 id="tk-h" className="text-[17px] leading-6 font-semibold">
                    {t.title}
                  </h2>
                  <span className="text-[12px] text-muted tabular">{t.reported}</span>
                </div>
                <ToneChip tone={status.tone} size="md" className="shrink-0">
                  {status.label}
                </ToneChip>
              </div>
              {t.photos.length ? (
                <div className="flex gap-2">
                  {t.photos.map((ph, i) => (
                    <div
                      key={ph.alt}
                      className="relative h-[72px] min-w-0 flex-1 overflow-hidden rounded-[14px] bg-surface-tertiary"
                    >
                      <Photo
                        image={stock[ph.key]}
                        alt={ph.alt}
                        fill
                        sizes="180px"
                        className={t.photos.findIndex((p) => p.key === ph.key) === i ? "" : CROPS[i % CROPS.length]}
                      />
                    </div>
                  ))}
                </div>
              ) : null}
              <KeyValueList
                items={[
                  { label: "Entry permission", value: t.entry },
                  { label: "Assigned to", value: t.assignee },
                  { label: "Visit", value: <span className="tabular">{t.visit}</span> },
                  { label: "Cost", value: <span className="tabular">{t.cost}</span> },
                ]}
              />
              <Segment
                // A new ticket has no status chosen yet; remounting per ticket and status keeps that empty.
                key={`${t.id}-${current}`}
                aria-label="Ticket status"
                selectedKey={current === "new" ? undefined : current}
                onSelectionChange={(k) => void move(k as TicketStatus)}
                className="self-start"
              >
                {MOVES.map((s) => (
                  <Segment.Item key={s} id={s}>
                    {STATUS[s].label}
                  </Segment.Item>
                ))}
              </Segment>

              <div className="flex flex-col gap-2.5">
                <SubHeading className="text-sm leading-5">{threadTitle}</SubHeading>
                {thread.map((m) =>
                  m.from === "resident" ? (
                    <ChatMessage.Assistant key={`${m.meta}-${m.text}`} className="py-0">
                      <ChatMessage.Body className="max-w-[85%] gap-0.5">
                        <ChatMessage.Bubble className="self-start bg-surface-secondary">
                          <ChatMessage.Content className="text-[13px] leading-[19px]">{m.text}</ChatMessage.Content>
                        </ChatMessage.Bubble>
                        <span className="text-[11px] text-muted tabular">{m.meta}</span>
                      </ChatMessage.Body>
                    </ChatMessage.Assistant>
                  ) : (
                    <ChatMessage.User key={`${m.meta}-${m.text}`} className="gap-0.5">
                      <ChatMessage.Bubble
                        className={`max-w-[85%] ${m.from === "note" ? "bg-warning-soft text-warning-soft-foreground" : "bg-accent-soft"}`}
                      >
                        <ChatMessage.Content className="text-[13px] leading-[19px]">{m.text}</ChatMessage.Content>
                      </ChatMessage.Bubble>
                      <span className="text-[11px] text-muted tabular">{m.meta}</span>
                    </ChatMessage.User>
                  ),
                )}
                <PromptInput value={draft} onValueChange={setDraft} onSubmit={send}>
                  <PromptInput.Shell>
                    <Label htmlFor="reply" className="sr-only">
                      {isNote ? "Internal note for staff" : `Reply to ${t.resident}`}
                    </Label>
                    <PromptInput.Content>
                      <PromptInput.TextArea
                        id="reply"
                        rows={2}
                        placeholder={isNote ? "Internal note for staff only" : `Reply to ${t.resident}`}
                      />
                    </PromptInput.Content>
                    <PromptInput.Toolbar>
                      <PromptInput.ToolbarStart>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-pressed={isNote}
                          isDisabled={noResident}
                          onPress={() => setNote((n) => !n)}
                        >
                          {isNote ? <Lock className="size-4" /> : <Comment className="size-4" />}
                          {isNote ? "Internal note" : "Reply to resident"}
                        </Button>
                      </PromptInput.ToolbarStart>
                      <PromptInput.ToolbarEnd>
                        <Button
                          size="sm"
                          isIconOnly
                          aria-label="Send"
                          isDisabled={!draft.trim() || busy}
                          onPress={send}
                        >
                          <PaperPlane className="size-4" />
                        </Button>
                      </PromptInput.ToolbarEnd>
                    </PromptInput.Toolbar>
                  </PromptInput.Shell>
                </PromptInput>
                <span className="text-[12px] text-muted">
                  Delivered in the resident app. Internal notes are never shown to residents.
                </span>
              </div>
            </Card>
          </div>
        </Tabs.Panel>

        <Tabs.Panel id="visit" className="pt-5">
          <div className="grid items-start gap-[16px] [grid-template-columns:repeat(auto-fit,minmax(min(380px,100%),1fr))]">
            <section aria-labelledby="req-h">
              <ItemCardGroup layout="list">
                <ItemCardGroup.Header>
                  <ItemCardGroup.Title id="req-h" aria-level={2}>
                    Access Requests
                  </ItemCardGroup.Title>
                  <ItemCardGroup.Description>
                    House rule: overnight visits over 7 nights need management approval · configured 1 Jan 2026
                  </ItemCardGroup.Description>
                </ItemCardGroup.Header>
                {data.requests.map((r) => {
                  const st = requestState(r);
                  return (
                    <Fragment key={r.id}>
                      <Separator />
                      <ItemCard className="items-start">
                        <ItemCard.Icon>
                          <Icon name={r.icon} />
                        </ItemCard.Icon>
                        <ItemCard.Content className="gap-1">
                          <ItemCard.Title className="whitespace-normal">{r.title}</ItemCard.Title>
                          <ItemCard.Description className="whitespace-normal tabular">{r.desc}</ItemCard.Description>
                          {st === "open" ? (
                            <div className="mt-1.5 flex flex-wrap gap-2">
                              <Button size="sm" onPress={() => decide(r, "approved")}>
                                {r.approveLabel}
                              </Button>
                              <Button size="sm" variant="ghost" onPress={() => decide(r, "declined")}>
                                Decline
                              </Button>
                            </div>
                          ) : null}
                        </ItemCard.Content>
                        <ItemCard.Action>
                          <ToneChip tone={REQUEST[st].tone} className="whitespace-nowrap">
                            {REQUEST[st].label}
                          </ToneChip>
                        </ItemCard.Action>
                      </ItemCard>
                    </Fragment>
                  );
                })}
              </ItemCardGroup>
            </section>

            <Card className="gap-3 p-[18px]" aria-labelledby="pre-h" render={(p) => <section {...p} />}>
              <Card.Header>
                <Card.Title
                  id="pre-h"
                  render={(p) => <h2 {...p} />}
                  className="text-[15px] leading-[22px] font-semibold"
                >
                  Pre-registered Visitors
                </Card.Title>
                <Card.Description>
                  Each pass holds its code and time window; give the code to the visitor
                </Card.Description>
              </Card.Header>
              <ListView aria-label="Pre-registered visitors" variant="secondary" items={visitors}>
                {(v) => (
                  <ListView.Item id={v.id} textValue={v.name}>
                    <ListView.ItemContent>
                      <Avatar size="sm" variant="soft" className="shrink-0">
                        <Avatar.Fallback>{v.initials}</Avatar.Fallback>
                      </Avatar>
                      <div className="flex min-w-0 flex-col">
                        <ListView.Title>
                          {v.name} → {v.unit}
                        </ListView.Title>
                        <ListView.Description className="tabular">
                          {v.window} · by {v.by}
                        </ListView.Description>
                      </div>
                    </ListView.ItemContent>
                    <ListView.ItemAction className="flex items-center gap-2">
                      <Kbd className="tabular">{v.code}</Kbd>
                      <ToneChip tone={v.tone}>{v.state}</ToneChip>
                    </ListView.ItemAction>
                  </ListView.Item>
                )}
              </ListView>
            </Card>

            <Card
              className="gap-3 p-[18px] [grid-column:1/-1]"
              aria-labelledby="log-h"
              render={(p) => <section {...p} />}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 flex-col gap-1">
                  <h2 id="log-h" className="text-[15px] leading-[22px] font-semibold">
                    Visitor Log
                  </h2>
                  <span className="text-[12px] text-muted">
                    Arrivals and departures recorded at the gate · kept 90 days · phone numbers masked
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onPress={() =>
                    downloadCsv("kacyiru-court-visitor-log.csv", [
                      ["Visitor", "Phone", "Visiting", "How admitted", "Arrived", "Left", "Recorded by"],
                      ...data.log.map((g) => [g.name, g.phone, g.unit, g.how, g.arrived, g.left, g.by]),
                    ])
                  }
                >
                  <ArrowDownToLine className="size-4" />
                  Export
                </Button>
              </div>
              <Table>
                <Table.ScrollContainer>
                  <Table.Content aria-label="Visitor log">
                    <Table.Header>
                      <Table.Column isRowHeader>Visitor</Table.Column>
                      <Table.Column>Visiting</Table.Column>
                      <Table.Column>How admitted</Table.Column>
                      <Table.Column>Arrived</Table.Column>
                      <Table.Column>Left</Table.Column>
                      <Table.Column>Recorded by</Table.Column>
                    </Table.Header>
                    <Table.Body>
                      {data.log.map((g) => (
                        <Table.Row key={g.id} id={g.id}>
                          <Table.Cell>
                            <span className="flex flex-col">
                              <span className="font-medium">{g.name}</span>
                              <span className="text-[12px] text-muted tabular">{g.phone}</span>
                            </span>
                          </Table.Cell>
                          <Table.Cell>{g.unit}</Table.Cell>
                          <Table.Cell>{g.how}</Table.Cell>
                          <Table.Cell className="whitespace-nowrap tabular">{g.arrived}</Table.Cell>
                          <Table.Cell className="tabular">{g.left}</Table.Cell>
                          <Table.Cell>{g.by}</Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>
            </Card>
          </div>
        </Tabs.Panel>
      </Tabs>

      <FormDialog
        isOpen={ticketOpen}
        onOpenChange={setTicketOpen}
        title="New maintenance ticket"
        description="Linked to a unit or a common area. The resident follows it in the resident app."
        footer={
          <>
            <Button variant="secondary" onPress={() => setTicketOpen(false)}>
              Cancel
            </Button>
            <Button onPress={createTicket} isDisabled={!ticket.title.trim() || busy}>
              Create ticket
            </Button>
          </>
        }
      >
        <SelectField
          label="Unit or area"
          value={ticket.unit}
          options={unitOptions}
          onChange={(unit) =>
            setTicket((s) => ({
              ...s,
              unit,
              entry: unit.startsWith("Block") ? ENTRY[2] : s.entry === ENTRY[2] ? ENTRY[1] : s.entry,
            }))
          }
        />
        <TextField
          fullWidth
          isRequired
          value={ticket.title}
          onChange={(v) => setTicket((s) => ({ ...s, title: v }))}
          className="gap-1"
        >
          <Label>What needs fixing</Label>
          <Input placeholder="For example: Bathroom tap dripping" />
        </TextField>
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField
            label="Category"
            value={ticket.category}
            options={CATEGORIES}
            onChange={(category) => setTicket((s) => ({ ...s, category }))}
          />
          <SelectField
            label="Entry permission"
            value={ticket.entry}
            options={ENTRY}
            onChange={(entry) => setTicket((s) => ({ ...s, entry }))}
          />
        </div>
      </FormDialog>

      <FormDialog
        isOpen={visitorOpen}
        onOpenChange={setVisitorOpen}
        title="Pre-register a visitor"
        description="Issues a pass with a gate code for the window. Give the code to the visitor yourself: it is not sent to them."
        footer={
          <>
            <Button variant="secondary" onPress={() => setVisitorOpen(false)}>
              Cancel
            </Button>
            <Button onPress={preregister} isDisabled={!visitor.name.trim() || !visitor.unit || busy}>
              Issue gate code
            </Button>
          </>
        }
      >
        <TextField
          fullWidth
          isRequired
          value={visitor.name}
          onChange={(v) => setVisitor((s) => ({ ...s, name: v }))}
          className="gap-1"
        >
          <Label>Visitor name</Label>
          <Input placeholder="As on their ID" />
        </TextField>
        <SelectField
          label="Visiting"
          value={visitor.unit}
          options={leased.map((u) => ({ id: u.id, label: `${u.id} · ${u.resident}` }))}
          onChange={(unit) => setVisitor((s) => ({ ...s, unit }))}
        />
        <TextField
          fullWidth
          value={visitor.window}
          onChange={(v) => setVisitor((s) => ({ ...s, window: v }))}
          className="gap-1"
        >
          <Label>Window</Label>
          <Input className="tabular" />
        </TextField>
      </FormDialog>
      <Toast.Provider placement="bottom" />
    </PageContent>
  );
}
