"use client";

import { ArrowRight, Lock, Magnifier, Paperclip, Plus, SealCheck } from "@gravity-ui/icons";
import { Avatar, Button, Card, Chip, Switch, Table, Toast, toast } from "@heroui/react";
import { Kanban, KPIGroup, ListView, Segment, Timeline } from "@heroui-pro/react";
import { KPI } from "@heroui-pro/react/kpi";
import { type Persona, screenHref } from "@injishi/data";
import type {
  BrokerDispute,
  BrokerEarning,
  BrokerKpi,
  BrokerLead,
  BrokerRegistration,
  Placement,
} from "@injishi/data/fixtures/public";
import { formatRwf, KeyValueList, LinkButton, PageContent, PageHeader, toneColor } from "@injishi/ui";
import { type CSSProperties, Fragment, useState } from "react";
import { Pending } from "./shared";

export interface BrokerWorkData {
  registrations: BrokerRegistration[];
  kpis: BrokerKpi[];
  placements: Placement[];
  leads: BrokerLead[];
  earnings: BrokerEarning[];
  disputes: BrokerDispute[];
}

const STAGES = [
  { title: "Introduced", color: "var(--chart-5)", next: "Viewing set" },
  { title: "Viewing", color: "var(--chart-4)", next: "Application in" },
  { title: "Application", color: "var(--chart-3)", next: "" },
  { title: "Lease signed", color: "var(--chart-1)", next: "" },
] as const;

const LEAD_TABS = [
  { id: "all", label: "All" },
  { id: "tenant", label: "Tenants" },
  { id: "landlord", label: "Landlords" },
] as const;

type LeadTab = (typeof LEAD_TABS)[number]["id"];

/**
 * The broker's work on this page is the prototype's: the broker placement lifecycle and leads, disputes and the
 * directory listing switch have no tables or routes yet (data map public.placements, brokerLeads, brokerDisputes;
 * an /architect decision is owed). So every control here says it is not available and changes nothing.
 */
const unavailable = (what: string) => () => toast.warning(`${what} is not available yet. Nothing was changed.`);

/** Broker · work (artifact: BrokerWork.dc.html) — registration, placements, leads, earnings and disputes. */
export function BrokerWorkView({
  persona,
  data,
  today,
}: {
  persona: Persona;
  data: BrokerWorkData;
  /** The real day and greeting in Kigali ("Tuesday 20 October 2026", "Good afternoon"), worked out by the page. */
  today: { label: string; greeting: string };
}) {
  const registration = data.registrations[0];
  const listed = registration?.listed ?? true;
  const [leadTab, setLeadTab] = useState<LeadTab>("all");

  const dirNote = listed
    ? "Landlords in your areas can find you and send leads"
    : "Hidden · you keep current leads and placements";
  const leads = data.leads.filter((lead) => leadTab === "all" || lead.kind === leadTab);

  return (
    <PageContent>
      <PageHeader
        size="hello"
        eyebrow={`${today.label} · ${persona.role}`}
        title={`${today.greeting}, ${persona.firstName}`}
        description="Your leads, placements and earnings. They are sample data until the broker workspace reads them from Injishi."
        actions={
          <>
            <LinkButton href={screenHref("BrokerDirectory")} variant="secondary">
              <Magnifier className="size-4" />
              Directory and credits
            </LinkButton>
            <Button onPress={unavailable("Adding a lead")}>
              <Plus className="size-4" />
              Add a lead
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-stretch gap-4">
        {registration ? (
          <Card className="min-w-0 flex-[1_1_380px] gap-3 p-[18px]" aria-labelledby="reg-h">
            <div className="flex items-center justify-between gap-2">
              <h2 id="reg-h" className="text-[15px] leading-[22px] font-semibold">
                Registration
              </h2>
              <Chip size="sm" variant="soft" color="success">
                <SealCheck className="size-3" aria-hidden="true" />
                <Chip.Label>Verified</Chip.Label>
              </Chip>
            </div>
            <KeyValueList
              items={[
                {
                  label: "Broker ID",
                  value: (
                    <span className="tabular">
                      {registration.brokerId} · renews {registration.renews}
                    </span>
                  ),
                },
                { label: "Identity", value: registration.identity },
                { label: "Areas", value: registration.areas },
                { label: "Commission terms", value: registration.terms },
                { label: "Injishi platform fee", value: <Pending /> },
              ]}
            />
            <div className="flex items-center gap-3 border-t border-separator pt-2.5">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">Listed in the broker directory</span>
                <span className="text-[12px] text-muted">{dirNote}</span>
              </div>
              <Switch
                isSelected={listed}
                onChange={unavailable("Changing your directory listing")}
                aria-label="Listed in the broker directory"
              >
                <Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch.Content>
              </Switch>
            </div>
          </Card>
        ) : null}

        <section className="min-w-0 flex-[2_1_560px]" aria-label="Key figures">
          <KPIGroup className="flex-wrap">
            {data.kpis.map((kpi, index) => (
              <Fragment key={kpi.id}>
                {index > 0 ? <KPIGroup.Separator /> : null}
                <KPI className="min-w-[160px] flex-1">
                  <KPI.Header>
                    <KPI.Title>{kpi.label}</KPI.Title>
                  </KPI.Header>
                  <KPI.Content>
                    <KPI.Value value={kpi.value} formatOptions={kpi.format} className="tabular" />
                  </KPI.Content>
                  <KPI.Footer>
                    <p className="text-[12px] leading-4 text-muted">{kpi.foot}</p>
                  </KPI.Footer>
                </KPI>
              </Fragment>
            ))}
          </KPIGroup>
        </section>
      </div>

      <section className="flex flex-col gap-2.5" aria-labelledby="pipe-h">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="pipe-h" className="text-[15px] leading-[22px] font-semibold">
            Placements
          </h2>
          <span className="text-[12px] text-muted">
            A placement reaches Lease signed only from the landlord’s signed lease, never by hand
          </span>
        </div>
        <Kanban
          size="sm"
          style={{ "--kanban-column-min-width": "240px", "--kanban-column-gap": "12px" } as CSSProperties}
        >
          {STAGES.map((stage, index) => {
            const cards = data.placements.filter((placement) => placement.stage === index);
            return (
              <Kanban.Column key={stage.title} className="min-w-[240px] flex-1">
                <Kanban.ColumnHeader>
                  <Kanban.ColumnIndicator style={{ background: stage.color }} />
                  <Kanban.ColumnTitle>{stage.title}</Kanban.ColumnTitle>
                  <Kanban.ColumnCount>{cards.length}</Kanban.ColumnCount>
                </Kanban.ColumnHeader>
                <Kanban.ColumnBody>
                  <Kanban.CardList aria-label={stage.title} items={cards}>
                    {(card: Placement) => {
                      const when = card.when[index] || "Today";
                      const note =
                        index === 2
                          ? "Landlord decides · moves when the lease is signed"
                          : index === 3
                            ? "Fee earned under the mandate"
                            : "";
                      return (
                        <Kanban.Card id={card.id} textValue={`${card.tenant}, ${card.unit}`}>
                          <span className="font-semibold">{card.tenant}</span>
                          <span className="text-[12px]">{card.unit}</span>
                          <span className="text-[12px] text-muted tabular">
                            {formatRwf(card.rent)} / month · {when}
                          </span>
                          {index < 2 ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="self-start"
                              onPress={unavailable("Moving a placement")}
                            >
                              {stage.next}
                              <ArrowRight className="size-4" />
                            </Button>
                          ) : null}
                          {note ? (
                            <Chip
                              size="sm"
                              variant="soft"
                              color={index === 3 ? "success" : "default"}
                              className="self-start"
                            >
                              <Chip.Label>{note}</Chip.Label>
                            </Chip>
                          ) : null}
                        </Kanban.Card>
                      );
                    }}
                  </Kanban.CardList>
                </Kanban.ColumnBody>
              </Kanban.Column>
            );
          })}
        </Kanban>
      </section>

      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(440px,100%),1fr))]">
        <Card className="gap-3 p-[18px]" aria-labelledby="leads-h">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="leads-h" className="text-[15px] leading-[22px] font-semibold">
              Leads
            </h2>
            <Segment
              aria-label="Lead source"
              selectedKey={leadTab}
              onSelectionChange={(key) => setLeadTab(String(key) as LeadTab)}
            >
              {LEAD_TABS.map((tab, index) => (
                <Segment.Item key={tab.id} id={tab.id}>
                  {index > 0 ? <Segment.Separator /> : null}
                  {tab.label}
                </Segment.Item>
              ))}
            </Segment>
          </div>
          <ListView aria-labelledby="leads-h" variant="secondary">
            {leads.map((lead) => {
              const status = lead.status;
              const tone = status === "New" ? "accent" : status === "Mandate active" ? "success" : "default";
              return (
                <ListView.Item key={lead.id} id={lead.id} textValue={lead.name} className="items-start">
                  <Avatar size="sm" variant="soft" color={lead.kind === "tenant" ? "accent" : "default"}>
                    <Avatar.Fallback>{lead.initials}</Avatar.Fallback>
                  </Avatar>
                  <ListView.ItemContent className="min-w-0 gap-0.5">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <ListView.Title className="font-semibold">{lead.name}</ListView.Title>
                      <Chip size="sm" variant="soft">
                        <Chip.Label>{lead.kind === "tenant" ? "Tenant" : "Landlord"}</Chip.Label>
                      </Chip>
                    </span>
                    <ListView.Description className="text-[13px] whitespace-normal">{lead.need}</ListView.Description>
                    <span className="text-[12px] text-muted">{lead.meta}</span>
                  </ListView.ItemContent>
                  <ListView.ItemAction className="flex flex-col items-end gap-1.5">
                    <Chip size="sm" variant="soft" color={toneColor(tone)}>
                      <Chip.Label>{status}</Chip.Label>
                    </Chip>
                    {lead.status === "New" ? (
                      <Button size="sm" variant="secondary" onPress={unavailable("Marking a lead contacted")}>
                        Mark contacted
                      </Button>
                    ) : null}
                  </ListView.ItemAction>
                </ListView.Item>
              );
            })}
          </ListView>
          <p className="flex gap-1.5 text-[12px] leading-[17px] text-muted">
            <Lock className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
            People shared their contact details with you for this search only. Don’t reuse them for anything else.
          </p>
        </Card>

        <Card className="gap-3 p-[18px]" aria-labelledby="earn-h">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="earn-h" className="text-[15px] leading-[22px] font-semibold">
              Earnings
            </h2>
            <span className="text-[12px] text-muted">
              Payouts through Injishi Payments · payout number not on file here yet
            </span>
          </div>
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-labelledby="earn-h">
                <Table.Header>
                  <Table.Column isRowHeader>Placement</Table.Column>
                  <Table.Column className="text-right">Fee</Table.Column>
                  <Table.Column>Status</Table.Column>
                </Table.Header>
                <Table.Body>
                  {data.earnings.map((row) => (
                    <Table.Row key={row.id} id={row.id}>
                      <Table.Cell>
                        <span className="flex flex-col">
                          <span className="font-medium">{row.who}</span>
                          <span className="text-[12px] text-muted">{row.unit}</span>
                          <span className="text-[12px] text-muted">{row.basis}</span>
                        </span>
                      </Table.Cell>
                      <Table.Cell className="text-right whitespace-nowrap tabular">{formatRwf(row.fee)}</Table.Cell>
                      <Table.Cell>
                        <span className="flex flex-col items-start gap-0.5">
                          <Chip size="sm" variant="soft" color={toneColor(row.tone)}>
                            <Chip.Label>{row.status}</Chip.Label>
                          </Chip>
                          <span className="text-[12px] text-muted tabular">{row.evidence}</span>
                        </span>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
          <p className="text-[12px] leading-[17px] text-muted">
            Fees come from each landlord’s mandate and are paid by the landlord. A payout starts only after the
            landlord’s payment is verified by the provider. No platform fee has been deducted while Injishi’s terms
            await approval.
          </p>
        </Card>
      </div>

      <Card className="gap-3 p-[18px]" aria-labelledby="disp-h">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="disp-h" className="text-[15px] leading-[22px] font-semibold">
            Disputes
          </h2>
          <span className="text-[12px] text-muted">Decided by Injishi support from the evidence on both sides</span>
        </div>
        <div className="flex flex-wrap items-start gap-4">
          {data.disputes.map((dispute) =>
            dispute.evidence.length ? (
              <Card key={dispute.id} variant="secondary" className="min-w-0 flex-[2_1_520px] gap-2.5 px-4 py-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">
                    {dispute.id} · {dispute.title}
                  </span>
                  <Chip size="sm" variant="soft" color={toneColor(dispute.tone)}>
                    <Chip.Label>{dispute.status}</Chip.Label>
                  </Chip>
                </div>
                <span className="text-[13px] leading-[19px]">{dispute.summary}</span>
                <Timeline size="sm" density="compact" aria-label={`${dispute.id} evidence`}>
                  {dispute.evidence.map((event) => (
                    <Timeline.Item key={event.id} status={event.status}>
                      <Timeline.Rail>
                        <Timeline.Marker />
                        <Timeline.Connector />
                      </Timeline.Rail>
                      <Timeline.Content className="flex flex-col pb-0.5">
                        <span className="text-[13px] font-medium">{event.title}</span>
                        <span className="text-[12px] text-muted">{event.detail}</span>
                      </Timeline.Content>
                    </Timeline.Item>
                  ))}
                </Timeline>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" onPress={unavailable("Adding evidence to a dispute")}>
                    <Paperclip className="size-4" />
                    Add evidence
                  </Button>
                  <LinkButton href={screenHref("PublicHelp")} size="sm" variant="ghost">
                    How disputes are decided
                  </LinkButton>
                </div>
              </Card>
            ) : (
              <Card key={dispute.id} variant="secondary" className="min-w-0 flex-[1_1_260px] gap-1.5 px-4 py-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">
                    {dispute.id} · {dispute.title}
                  </span>
                  <Chip size="sm" variant="soft" color={toneColor(dispute.tone)}>
                    <Chip.Label>{dispute.status}</Chip.Label>
                  </Chip>
                </div>
                <span className="text-[13px] leading-[19px]">{dispute.summary}</span>
                {dispute.outcome ? <span className="text-[12px] text-muted">{dispute.outcome}</span> : null}
              </Card>
            ),
          )}
        </div>
      </Card>
      <Toast.Provider placement="bottom" />
    </PageContent>
  );
}
