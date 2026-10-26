"use client";

import { Calendar, CircleCheck, PaperPlane, Pencil, Persons, Plus, TriangleExclamation } from "@gravity-ui/icons";
import { Alert, Button, Card, Chip, Table } from "@heroui/react";
import { EmptyState, ItemCard, Kanban, ListView, Segment, Stepper } from "@heroui-pro/react";
import { type Persona, screenHref } from "@injishi/data";
import type {
  SalesEventsBeoFigure,
  SalesEventsBeoNote,
  SalesEventsDeposit,
  SalesEventsHandoffStep,
  SalesEventsLead,
  SalesEventsQuoteLine,
  SalesEventsSeller,
  SalesEventsSpace,
  SalesEventsSpaceBooking,
  SalesEventsStage,
  SalesEventsTiming,
  Tone,
} from "@injishi/data/fixtures/commercial";
import {
  formatNumber,
  formatRwf,
  Icon,
  KeyValueList,
  LinkButton,
  PageContent,
  PageHeader,
  toneBg,
  toneColor,
} from "@injishi/ui";
import { type ReactNode, useState } from "react";
import { SalesEventsEditQuoteDialog, SalesEventsNewLeadDialog } from "./SalesEventsDialogs";
import { SalesEventsSpaceLegend, SalesEventsSpaceTimeline } from "./SalesEventsSpaceTimeline";

interface SalesEventsData {
  stages: SalesEventsStage[];
  leads: SalesEventsLead[];
  spaces: SalesEventsSpace[];
  bookings: SalesEventsSpaceBooking[];
  timings: SalesEventsTiming[];
  beoFigures: SalesEventsBeoFigure[];
  beoNotes: SalesEventsBeoNote[];
  quoteLines: SalesEventsQuoteLine[];
  sellers: SalesEventsSeller[];
  deposits: SalesEventsDeposit[];
  handoffSteps: SalesEventsHandoffStep[];
}

type Owner = "all" | "mine";

/** The prototype's "today" (Monday 12 October 2026). */
const TODAY = "12 Oct";

const rwfCompact = (n: number) => formatRwf(n, true);

/** Column indicator colour; "info" is a lighter accent so Qualified reads apart from Contract. */
const indicatorClass = (tone: Tone) => (tone === "info" ? "bg-accent/45" : toneBg(tone));

const SPACE_ARIA = {
  collision:
    "Sunday 25 October. Kivu Hall: EAC Health Forum contracted 08:00 to 17:00; wedding set-up held from 14:00, overlapping for 3 hours; wedding dinner held 18:00 to 23:30. Garden Terrace: EAC lunch 12:30 to 14:00; wedding cocktails held 17:30 to 19:30.",
  resolved:
    "Sunday 25 October. Kivu Hall: EAC Health Forum contracted 08:00 to 17:00; turnaround to 17:30; wedding set-up 17:30 to 19:00; wedding dinner held 19:00 to 23:30. Garden Terrace: EAC lunch 12:30 to 14:00; wedding cocktails held 17:30 to 19:30. No overlaps.",
};

/** Card heading (artifact: card__header with an h2 title and a description), with an optional trailing chip. */
function CardHead({
  id,
  title,
  description,
  trailing,
}: {
  id: string;
  title: string;
  description: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <Card.Header className="min-w-0 gap-0.5">
        <Card.Title id={id} className="text-[15px] font-semibold" render={(props) => <h2 {...props} />}>
          {title}
        </Card.Title>
        <Card.Description>{description}</Card.Description>
      </Card.Header>
      {trailing}
    </div>
  );
}

export function SalesEventsView({ persona, data }: { persona: Persona; data: SalesEventsData }) {
  const planLeadId = data.leads.find((l) => l.hasEventPlan)?.id;
  const [sel, setSel] = useState<string>(planLeadId ?? data.leads[0]?.id ?? "");
  const [resolved, setResolved] = useState(false);
  const [sent, setSent] = useState(false);
  const [owner, setOwner] = useState<Owner>("all");
  const [added, setAdded] = useState<SalesEventsLead[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [newLeadKey, setNewLeadKey] = useState(0);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteKey, setQuoteKey] = useState(0);

  // Leads with the event plan's state applied (collision resolved → hold chip; contract sent → Contract column).
  const leads = [...data.leads, ...added].map((l) => {
    if (sent && l.whenSent) return { ...l, stage: l.whenSent.stage, chip: l.whenSent.chip, tone: l.whenSent.tone };
    if (resolved && l.whenResolved)
      return { ...l, chip: l.whenResolved.chip, tone: l.whenResolved.tone, next: l.whenResolved.next };
    return l;
  });
  const shown = leads.filter((l) => owner === "all" || l.owner === persona.firstName);
  const open = leads.filter((l) => l.stage !== "closed");
  const openValue = open.reduce((sum, l) => sum + l.value, 0);
  const weighted = open.reduce((sum, l) => sum + (l.value * l.prob) / 100, 0);

  const lead = leads.find((l) => l.id === sel) ?? leads[0];
  const stage = data.stages.find((s) => s.id === lead?.stage);
  const stageLabel =
    sent && lead?.whenSent ? lead.whenSent.stageLabel : lead?.lost ? (stage?.lostLabel ?? stage?.label) : stage?.label;
  const stageTone = lead?.lost ? (stage?.lostTone ?? "default") : (stage?.labelTone ?? "default");
  const hasPlan = Boolean(lead?.hasEventPlan);
  const collision = hasPlan && !resolved;
  const scenarioOk = (s: "always" | "collision" | "resolved") =>
    s === "always" || s === (resolved ? "resolved" : "collision");

  // Event plan of the selected lead.
  const planSpaces = data.spaces.filter((s) => s.lead === lead?.id);
  const holderId = data.bookings.find(
    (b) => b.kind === "contracted" && b.holder && planSpaces.some((s) => s.id === b.space && s.clash),
  )?.holder;
  const timings = data.timings.filter((t) => t.lead === lead?.id && scenarioOk(t.scenario));
  const figures = data.beoFigures.filter((f) => f.lead === lead?.id);
  const notes = data.beoNotes.filter((n) => n.lead === lead?.id);
  const lines = data.quoteLines
    .filter((l) => l.lead === lead?.id && scenarioOk(l.scenario))
    .map((l) => ({ ...l, qty: quantities[l.id] ?? l.qty }));
  const quoteTotal = lines.reduce((sum, l) => sum + l.qty * l.price, 0);
  const sellerTotal = (id: string) => lines.filter((l) => l.seller === id).reduce((sum, l) => sum + l.qty * l.price, 0);
  const hotel = data.sellers[0];
  const hotelTotal = hotel ? sellerTotal(hotel.id) : 0;
  const leadDeposits = data.deposits.filter((d) => d.lead === lead?.id);
  const shareSum = leadDeposits.reduce((sum, d) => sum + (d.share ? Math.round(hotelTotal * d.share) : 0), 0);
  const deposits = leadDeposits.map((d) => {
    const s = sent && d.whenSent ? d.whenSent : d;
    return {
      id: d.id,
      label: d.label,
      amount: d.share ? Math.round(hotelTotal * d.share) : hotelTotal - shareSum,
      due: s.due,
      status: s.status,
      tone: s.tone,
    };
  });
  const steps = data.handoffSteps.filter((st) => st.lead === lead?.id);
  const currentStep = Math.max(
    0,
    steps.findIndex((st) => st.status === "active"),
  );
  const sellerOf = (id: string) => data.sellers.find((s) => s.id === id);

  const facts = lead
    ? [
        { k: "Organiser", v: lead.org },
        { k: "Event", v: lead.type },
        { k: "Date", v: lead.date },
        { k: "Guests", v: formatNumber(lead.pax) },
        { k: "Space", v: lead.space },
        { k: "Quote value", v: formatRwf(hasPlan ? quoteTotal : lead.value) },
        { k: "Probability", v: `${lead.prob}%` },
        { k: "Source", v: lead.source },
      ]
    : [];

  const sendLabel = sent ? "Contract sent" : resolved ? "Send contract" : "Send contract · resolve collision first";
  const holdNote = sent
    ? "Contract sent 12 Oct. Both spaces stay on a tentative hold until it is signed or the hold expires on 14 Oct at 18:00."
    : "Tentative hold until 14 Oct at 18:00. Kivu Hall and Garden Terrace are reserved only when the contract is accepted.";

  const nextLeadId = `L-${String(Math.max(0, ...leads.map((l) => Number(l.id.replace(/\D/g, "")) || 0)) + 1).padStart(
    4,
    "0",
  )}`;

  return (
    <PageContent>
      <PageHeader
        eyebrow="Isangano Lakeside Hotel · Commercial"
        title="Sales & Events"
        description={`${open.length} open leads worth ${rwfCompact(openValue)} · weighted ${rwfCompact(weighted)}. Event space is held while a proposal is live and reserved only when a contract is accepted.`}
        actions={
          <>
            <Segment aria-label="Lead owner" selectedKey={owner} onSelectionChange={(k) => setOwner(k as Owner)}>
              <Segment.Item id="all">All leads</Segment.Item>
              <Segment.Item id="mine">Mine</Segment.Item>
            </Segment>
            <LinkButton href={screenHref("Groups")} variant="secondary">
              <Persons className="size-4" />
              Group blocks
            </LinkButton>
            <Button
              onPress={() => {
                setNewLeadKey((k) => k + 1);
                setNewLeadOpen(true);
              }}
            >
              <Plus className="size-4" />
              New lead
            </Button>
          </>
        }
      />

      <section aria-label="Leads pipeline">
        <Kanban size="sm" className="[--kanban-column-min-width:196px] pb-1">
          {data.stages.map((col) => {
            const items = shown.filter((l) => l.stage === col.id);
            const total = items.filter((l) => !l.lost).reduce((sum, l) => sum + l.value, 0);
            return (
              <Kanban.Column key={col.id}>
                <Kanban.ColumnHeader className="px-1.5">
                  <Kanban.ColumnIndicator className={indicatorClass(col.tone)} />
                  <h2 className="text-sm leading-5 font-semibold">{col.title}</h2>
                  <Kanban.ColumnCount>{items.length}</Kanban.ColumnCount>
                  <span className="ml-auto text-[12px] text-muted tabular">{total ? rwfCompact(total) : "—"}</span>
                </Kanban.ColumnHeader>
                <Kanban.ColumnBody>
                  <Kanban.CardList
                    aria-label={`${col.title} leads`}
                    items={items}
                    selectionMode="single"
                    disallowEmptySelection
                    selectedKeys={items.some((l) => l.id === sel) ? [sel] : []}
                    onSelectionChange={(keys) => {
                      if (keys === "all") return;
                      const [key] = [...keys];
                      if (key !== undefined) setSel(String(key));
                    }}
                    renderEmptyState={() => "No leads"}
                  >
                    {(l) => (
                      <Kanban.Card
                        id={l.id}
                        textValue={l.name}
                        className="[&_[data-slot=kanban-card-content]]:gap-[4px] [&_[data-slot=kanban-card-content]]:px-[12px] [&_[data-slot=kanban-card-content]]:py-[10px] [&_[data-slot=kanban-card-content]]:shadow-xs data-[selected=true]:[&_[data-slot=kanban-card-content]]:bg-accent-soft"
                      >
                        <span className="text-[13px] leading-[18px] font-semibold">{l.name}</span>
                        <span className="text-[12px] leading-4 text-muted">
                          {l.type} · {l.date} · {l.pax} guests
                        </span>
                        <span className="mt-0.5 flex items-center justify-between gap-2">
                          <span className="text-[13px] font-semibold tabular">{rwfCompact(l.value)}</span>
                          <span className="text-[12px] text-muted">{l.owner}</span>
                        </span>
                        {l.chip ? (
                          <Chip size="sm" variant="soft" color={toneColor(l.tone)} className="self-start">
                            {l.chip}
                          </Chip>
                        ) : null}
                      </Kanban.Card>
                    )}
                  </Kanban.CardList>
                </Kanban.ColumnBody>
              </Kanban.Column>
            );
          })}
        </Kanban>
      </section>

      {lead ? (
        <Card className="gap-4 p-[18px]" aria-labelledby="lead-h" render={(props) => <section {...props} />}>
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1">
              <p className="flex flex-wrap items-center gap-2 text-[13px] leading-[18px] font-medium text-muted">
                <span className="tabular">{lead.id}</span>
                <Chip size="sm" variant="soft" color={toneColor(stageTone)}>
                  {stageLabel}
                </Chip>
              </p>
              <h2 id="lead-h" className="text-[18px] leading-[26px] font-semibold">
                {lead.name}
              </h2>
              <p className="text-[13px] text-muted">Next: {lead.next}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                isDisabled={!hasPlan}
                onPress={() => {
                  setQuoteKey((k) => k + 1);
                  setQuoteOpen(true);
                }}
              >
                <Pencil className="size-4" />
                Edit quote
              </Button>
              {hasPlan ? (
                <Button isDisabled={!resolved || sent} onPress={() => setSent(true)}>
                  <PaperPlane className="size-4" />
                  {sendLabel}
                </Button>
              ) : null}
            </div>
          </div>

          <dl className="grid gap-x-4 gap-y-3 [grid-template-columns:repeat(auto-fit,minmax(min(150px,100%),1fr))]">
            {facts.map((f) => (
              <div key={f.k} className="flex flex-col gap-0.5">
                <dt className="text-[12px] text-muted">{f.k}</dt>
                <dd className="text-[13px] font-medium">{f.v}</dd>
              </div>
            ))}
          </dl>

          {hasPlan ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-[15px] leading-[22px] font-semibold">Space Availability · {lead.date}</h3>
                <SalesEventsSpaceLegend />
              </div>
              <SalesEventsSpaceTimeline
                spaces={planSpaces}
                bookings={data.bookings}
                collision={collision}
                label={collision ? SPACE_ARIA.collision : SPACE_ARIA.resolved}
              />
              {collision ? (
                <Alert status="danger" role="alert">
                  <Alert.Indicator>
                    <TriangleExclamation />
                  </Alert.Indicator>
                  <Alert.Content className="flex-1">
                    <Alert.Title>Kivu Hall is double-booked from 14:00 to 17:00</Alert.Title>
                    <Alert.Description>
                      EAC Health Forum holds the hall under a signed contract until 17:00. The wedding set-up cannot
                      start before the 30-minute turnaround ends at 17:30.
                    </Alert.Description>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <Button size="sm" onPress={() => setResolved(true)}>
                        Move set-up to 17:30 with an extra crew
                      </Button>
                      {holderId ? (
                        <Button size="sm" variant="secondary" onPress={() => setSel(holderId)}>
                          Open EAC Health Forum
                        </Button>
                      ) : null}
                    </div>
                  </Alert.Content>
                </Alert>
              ) : (
                <Alert status="default" role="status">
                  <Alert.Indicator>
                    <CircleCheck />
                  </Alert.Indicator>
                  <Alert.Content className="flex-1">
                    <Alert.Title>No collisions on {lead.date}</Alert.Title>
                    <Alert.Description>{holdNote}</Alert.Description>
                  </Alert.Content>
                  {sent ? null : (
                    <Button size="sm" variant="ghost" onPress={() => setResolved(false)}>
                      Undo
                    </Button>
                  )}
                </Alert>
              )}
            </div>
          ) : (
            <Card variant="secondary" className="p-2">
              <EmptyState size="sm">
                <EmptyState.Header>
                  <EmptyState.Media variant="icon">
                    <Calendar />
                  </EmptyState.Media>
                  <EmptyState.Title>{lead.planTitle}</EmptyState.Title>
                  <EmptyState.Description>{lead.planNote}</EmptyState.Description>
                </EmptyState.Header>
              </EmptyState>
            </Card>
          )}
        </Card>
      ) : null}

      {hasPlan && lead ? (
        <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(440px,100%),1fr))]">
          <div className="flex min-w-0 flex-col gap-4">
            <Card className="gap-[14px] p-[18px]" aria-labelledby="beo-h" render={(props) => <section {...props} />}>
              <CardHead
                id="beo-h"
                title="Banquet Event Order"
                description="BEO-0412 · version 2 · draft · kitchen Isangano Terrace, bar Lake Bar"
              />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {figures.map((f) => (
                  <Card key={f.id} variant="secondary" className="gap-0.5 px-3 py-2.5">
                    <span className="text-[12px] text-muted">{f.label}</span>
                    <span className="text-base leading-6 font-semibold tabular">
                      {resolved && f.resolvedValue ? f.resolvedValue : f.value}
                    </span>
                  </Card>
                ))}
              </div>
              <KeyValueList items={notes.map((n) => ({ label: n.label, value: n.value }))} />
              <ol aria-label="Event timings" className="flex flex-col">
                {timings.map((t) => (
                  <li
                    key={t.id}
                    className="grid grid-cols-[48px_minmax(0,1fr)] gap-2.5 border-t border-separator py-[5px] text-[13px] leading-[18px]"
                  >
                    <span className={`font-semibold tabular ${t.collides ? "text-danger" : ""}`}>{t.time}</span>
                    <span>
                      {t.what} <span className="text-muted">· {t.where}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </Card>

            <Card className="gap-3 p-[18px]" aria-labelledby="dep-h" render={(props) => <section {...props} />}>
              <CardHead
                id="dep-h"
                title="Deposit Schedule"
                description="Hotel portion only. Deposits are held as advance deposits, not revenue, until the event."
              />
              <ListView aria-label="Deposit schedule" variant="secondary" items={deposits}>
                {(d) => (
                  <ListView.Item id={d.id} textValue={d.label}>
                    <ListView.ItemContent>
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <ListView.Title>{d.label}</ListView.Title>
                        <ListView.Description className="whitespace-normal">{d.due}</ListView.Description>
                      </div>
                    </ListView.ItemContent>
                    <ListView.ItemAction className="flex items-center gap-2.5">
                      <span className="font-semibold tabular">{formatRwf(d.amount)}</span>
                      <Chip size="sm" variant="soft" color={toneColor(d.tone)}>
                        {d.status}
                      </Chip>
                    </ListView.ItemAction>
                  </ListView.Item>
                )}
              </ListView>
              <p className="text-[12px] leading-4 text-muted">
                Accepted rails: MTN MoMo and Airtel Money with provider reference, or bank transfer matched by Finance.
                Only a provider-verified payment marks a deposit as received.
              </p>
            </Card>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <Card className="gap-3 p-[18px]" aria-labelledby="quote-h" render={(props) => <section {...props} />}>
              <CardHead
                id="quote-h"
                title="Catering Menu and Quote"
                description="Q-26-0318 · proforma, not a tax invoice · valid to 16 Oct"
                trailing={
                  <Chip size="sm" variant="soft">
                    Menu B · three courses
                  </Chip>
                }
              />
              <Table variant="secondary">
                <Table.ScrollContainer>
                  <Table.Content aria-label="Catering quote lines">
                    <Table.Header>
                      <Table.Column isRowHeader>Line</Table.Column>
                      <Table.Column>Seller</Table.Column>
                      <Table.Column className="text-right">Qty × price</Table.Column>
                      <Table.Column className="text-right">Amount</Table.Column>
                    </Table.Header>
                    <Table.Body items={lines}>
                      {(l) => {
                        const s = sellerOf(l.seller);
                        return (
                          <Table.Row id={l.id}>
                            <Table.Cell className="text-[13px] font-medium">
                              <span title={l.note}>{l.item}</span>
                            </Table.Cell>
                            <Table.Cell>
                              <Chip size="sm" variant="soft" color={toneColor(s?.tone)}>
                                {s?.short ?? l.seller}
                              </Chip>
                            </Table.Cell>
                            <Table.Cell className="text-right text-[12px] text-muted tabular">
                              {formatNumber(l.qty)} × {formatNumber(l.price)}
                            </Table.Cell>
                            <Table.Cell className="text-right tabular">{formatRwf(l.qty * l.price)}</Table.Cell>
                          </Table.Row>
                        );
                      }}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] text-muted">Quote total before tax</span>
                <span className="text-base font-semibold tabular">{formatRwf(quoteTotal)}</span>
              </div>
              <p className="text-[12px] leading-4 text-muted">
                Tax is applied on the commercial invoice from each line’s tax class (rates configured · unverified).
                Fiscal receipts are issued only at settlement.
              </p>
            </Card>

            <Card className="gap-3 p-[18px]" aria-labelledby="hand-h" render={(props) => <section {...props} />}>
              <CardHead
                id="hand-h"
                title="Financial Handoff"
                description="Each line is billed and fiscalised by its legally correct seller"
                trailing={
                  <Chip size="sm" variant="soft" color={sent ? "warning" : "default"}>
                    {sent ? "Waiting for signature" : "Not handed off"}
                  </Chip>
                }
              />
              {data.sellers.map((s) => (
                <ItemCard key={s.id} variant="secondary" className="items-start">
                  <ItemCard.Icon>
                    <Icon name={s.icon} />
                  </ItemCard.Icon>
                  <ItemCard.Content>
                    <ItemCard.Title className="whitespace-normal">
                      {s.name} <span className="font-normal text-muted tabular">· {s.tin}</span>
                    </ItemCard.Title>
                    <ItemCard.Description className="whitespace-normal">
                      {resolved && s.whatResolved ? s.whatResolved : s.what}
                    </ItemCard.Description>
                    <ItemCard.Description className="whitespace-normal">{s.how}</ItemCard.Description>
                  </ItemCard.Content>
                  <ItemCard.Action className="font-semibold tabular">{formatRwf(sellerTotal(s.id))}</ItemCard.Action>
                </ItemCard>
              ))}
              <Stepper size="sm" currentStep={currentStep} aria-label="Handoff progress">
                {steps.map((st) => (
                  <Stepper.Step key={st.id}>
                    <Stepper.Indicator />
                    <Stepper.Content>
                      <Stepper.Title>{sent && st.sentLabel ? st.sentLabel : st.label}</Stepper.Title>
                    </Stepper.Content>
                    <Stepper.Separator />
                  </Stepper.Step>
                ))}
              </Stepper>
              <p className="text-[12px] leading-4 text-muted">
                Accepting the contract reserves both spaces, opens one event master bill for the hotel lines and sends
                Ikawa Corner its own order. Nothing posts to Finance before then.
              </p>
            </Card>
          </div>
        </div>
      ) : null}

      <SalesEventsNewLeadDialog
        key={`new-${newLeadKey}`}
        isOpen={newLeadOpen}
        onOpenChange={setNewLeadOpen}
        owner={persona.firstName}
        nextId={nextLeadId}
        today={TODAY}
        onCreate={(l) => {
          setAdded((a) => [...a, l]);
          setSel(l.id);
          setNewLeadOpen(false);
        }}
      />
      {hasPlan ? (
        <SalesEventsEditQuoteDialog
          key={`quote-${quoteKey}`}
          isOpen={quoteOpen}
          onOpenChange={setQuoteOpen}
          quoteRef="Q-26-0318"
          lines={lines}
          sellers={data.sellers}
          onSave={(q) => setQuantities((prev) => ({ ...prev, ...q }))}
        />
      ) : null}
    </PageContent>
  );
}
