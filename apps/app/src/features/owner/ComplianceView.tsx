"use client";

import { CirclePause, FileArrowUp, Paperclip, Plus, ShieldExclamation } from "@gravity-ui/icons";
import { Button, Card, Chip, Table, Tabs, Toast, toast } from "@heroui/react";
import { ItemCard, KPIGroup } from "@heroui-pro/react";
import { KPI } from "@heroui-pro/react/kpi";
import { screenHref } from "@injishi/data";
import type {
  ComplianceAccess,
  ComplianceDataRequest,
  ComplianceKpi,
  ComplianceLicence,
  ComplianceMembership,
  ComplianceReportingGate,
  ComplianceStage,
  ComplianceSubmission,
} from "@injishi/data/fixtures/owner";
import { GateChip, Icon, LinkButton, PageContent, PageHeader, SectionHeader, toneColor } from "@injishi/ui";
import { Fragment, useState } from "react";
import { CompliancePrivacy } from "./CompliancePrivacy";
import { ComplianceSubmissionDetail, complianceStateOf, complianceToneOf } from "./ComplianceSubmissionDetail";

export interface ComplianceData {
  kpis: ComplianceKpi[];
  submissions: ComplianceSubmission[];
  licences: ComplianceLicence[];
  memberships: ComplianceMembership[];
  gates: ComplianceReportingGate[];
  access: ComplianceAccess[];
  requests: ComplianceDataRequest[];
}

export type ComplianceTab = "licences" | "privacy";

const kpiStatus = (tone: ComplianceKpi["status"]) =>
  tone === "success" || tone === "warning" || tone === "danger" ? tone : undefined;

/**
 * What this screen cannot record yet, said plainly. Licences and memberships are live, but no route adds a
 * licence, and submissions, disclosure requests and data subject requests are sample data
 * (`owner.complianceSubmissions` and `owner.complianceDataRequests` wait on /architect decisions), so these
 * controls change nothing on screen.
 */
const unavailable = (what: string, why = "nothing was recorded or sent") =>
  toast.warning(`${what} is not available yet: ${why}.`);

export function ComplianceView({
  initialTab,
  data,
  businessName,
}: {
  initialTab: ComplianceTab;
  data: ComplianceData;
  /** The business, as the API names it (never the prototype's group). */
  businessName: string;
}) {
  const [tab, setTab] = useState<ComplianceTab>(initialTab);
  const [selectedId, setSelectedId] = useState(data.submissions[0]?.id ?? "");

  const stageOf = (s: ComplianceSubmission): ComplianceStage => s.stage;
  const selected = data.submissions.find((s) => s.id === selectedId) ?? data.submissions[0];
  const selectedStage = selected ? stageOf(selected) : 0;

  const requests = data.requests;
  const openRequests = requests.filter((r) => r.open).length;
  const kpiValue = (k: ComplianceKpi) => (k.id === "requests" ? openRequests : k.value);

  return (
    <PageContent>
      <Toast.Provider placement="bottom" />
      <PageHeader
        eyebrow={`${businessName} · Compliance`}
        title="Compliance"
        description="Licences, memberships and anything sent to an authority. Nothing is marked done without the counterpart’s evidence."
        actions={
          <>
            <Button
              variant="secondary"
              onPress={() => unavailable("Adding a licence here", "licences come from the documents on file")}
            >
              <FileArrowUp className="size-4" />
              Add licence
            </Button>
            <Button onPress={() => unavailable("Starting a submission", "submissions on this screen are sample data")}>
              <Plus className="size-4" />
              New submission
            </Button>
          </>
        }
      />

      <section aria-label="Compliance summary">
        <KPIGroup className="flex-wrap">
          {data.kpis.map((k, i) => (
            <Fragment key={k.id}>
              {i > 0 ? <KPIGroup.Separator /> : null}
              <KPI className="min-w-[min(200px,100%)] flex-[1_1_200px]">
                <KPI.Header>
                  <KPI.Icon status={kpiStatus(k.status)}>
                    <Icon name={k.icon} />
                  </KPI.Icon>
                  <KPI.Title>{k.label}</KPI.Title>
                </KPI.Header>
                <KPI.Content>
                  <KPI.Value value={kpiValue(k)} className="tabular">
                    {(formatted) => (k.unit ? `${formatted} ${k.unit}` : formatted)}
                  </KPI.Value>
                </KPI.Content>
                <KPI.Footer>
                  <p className="text-xs leading-4 text-muted">{k.foot}</p>
                </KPI.Footer>
              </KPI>
            </Fragment>
          ))}
        </KPIGroup>
      </section>

      <Tabs
        variant="secondary"
        selectedKey={tab}
        onSelectionChange={(key) => setTab(key === "privacy" ? "privacy" : "licences")}
        className="gap-5"
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label="Compliance views">
            <Tabs.Tab id="licences" className="h-10 w-auto px-3">
              Licences and submissions
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="privacy" className="h-10 w-auto gap-2 px-3">
              Guest data and privacy
              <Chip size="sm" className="tabular">
                {openRequests}
              </Chip>
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="licences" className="mt-0 p-0">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex min-w-0 flex-[2_1_620px] flex-col gap-5">
              <section className="flex flex-col gap-2.5" aria-labelledby="sub-h">
                <SectionHeader
                  id="sub-h"
                  title="Regulatory Submissions"
                  className="items-center"
                  action={
                    <span className="text-xs text-muted">
                      Draft → Internal review → Approved to send → Sent → Outcome
                    </span>
                  }
                />
                <Table>
                  <Table.ScrollContainer>
                    <Table.Content
                      aria-labelledby="sub-h"
                      selectionMode="single"
                      disallowEmptySelection
                      selectedKeys={new Set([selected?.id ?? ""])}
                      onSelectionChange={(keys) => {
                        if (keys === "all") return;
                        const [key] = keys;
                        if (key !== undefined) setSelectedId(String(key));
                      }}
                    >
                      <Table.Header>
                        <Table.Column isRowHeader>Submission</Table.Column>
                        <Table.Column>Counterparty</Table.Column>
                        <Table.Column>Channel</Table.Column>
                        <Table.Column>State</Table.Column>
                        <Table.Column>Due</Table.Column>
                      </Table.Header>
                      <Table.Body>
                        {data.submissions.map((s) => {
                          const stage = stageOf(s);
                          return (
                            <Table.Row key={s.id} id={s.id} className="cursor-pointer">
                              <Table.Cell>
                                <span className="flex flex-col">
                                  <span className="font-medium">{s.title}</span>
                                  <span className="text-xs text-muted tabular">
                                    {s.id} · {s.entity}
                                  </span>
                                </span>
                              </Table.Cell>
                              <Table.Cell>{s.party}</Table.Cell>
                              <Table.Cell className="min-w-40 text-[13px] whitespace-normal">{s.channel}</Table.Cell>
                              <Table.Cell>
                                <Chip size="sm" variant="soft" color={toneColor(complianceToneOf(s, stage))}>
                                  {complianceStateOf(s, stage)}
                                </Chip>
                              </Table.Cell>
                              <Table.Cell className="whitespace-nowrap tabular">{s.due}</Table.Cell>
                            </Table.Row>
                          );
                        })}
                      </Table.Body>
                    </Table.Content>
                  </Table.ScrollContainer>
                </Table>
              </section>

              <section className="flex flex-col gap-2.5" aria-labelledby="lic-h">
                <SectionHeader
                  id="lic-h"
                  title="Licences and Registrations"
                  className="items-center"
                  action={
                    <span className="text-xs text-muted">
                      Status comes from the document on file. Issuers do not confirm it to Injishi.
                    </span>
                  }
                />
                <Table>
                  <Table.ScrollContainer>
                    <Table.Content aria-labelledby="lic-h">
                      <Table.Header>
                        <Table.Column isRowHeader>Licence or registration</Table.Column>
                        <Table.Column>Issuer</Table.Column>
                        <Table.Column>Reference</Table.Column>
                        <Table.Column>Expiry</Table.Column>
                        <Table.Column>Evidence</Table.Column>
                        <Table.Column>Status</Table.Column>
                      </Table.Header>
                      <Table.Body>
                        {data.licences.map((l) => (
                          <Table.Row key={l.id} id={l.id}>
                            <Table.Cell>
                              <span className="flex flex-col">
                                <span className="font-medium">{l.name}</span>
                                <span className="text-xs text-muted">{l.holder}</span>
                              </span>
                            </Table.Cell>
                            <Table.Cell className="whitespace-normal">{l.issuer}</Table.Cell>
                            <Table.Cell className="text-[13px] tabular">{l.ref}</Table.Cell>
                            <Table.Cell>
                              <span className="flex flex-col">
                                <span className="whitespace-nowrap tabular">{l.expiry}</span>
                                <span className="text-xs text-muted">{l.left}</span>
                              </span>
                            </Table.Cell>
                            <Table.Cell>
                              {/* The document's name only: opening a stored certificate is not available here yet. */}
                              <span className="inline-flex items-center gap-1.5 text-[13px] whitespace-nowrap">
                                <Paperclip className="size-3.5 shrink-0" aria-hidden="true" />
                                {l.file}
                              </span>
                            </Table.Cell>
                            <Table.Cell>
                              <Chip size="sm" variant="soft" color={toneColor(l.tone)}>
                                {l.status}
                              </Chip>
                            </Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Content>
                  </Table.ScrollContainer>
                </Table>
              </section>
            </div>

            <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
              {selected ? (
                <ComplianceSubmissionDetail
                  key={selected.id}
                  submission={selected}
                  stage={selectedStage}
                  onUnavailable={(what) => unavailable(what, "this submission is sample data, so its stage stays")}
                />
              ) : null}

              <section aria-labelledby="mem-h">
                <Card className="gap-3 p-[18px]">
                  <Card.Header>
                    <h2 id="mem-h" className="text-[15px] leading-[22px] font-semibold">
                      Memberships
                    </h2>
                    <Card.Description>
                      Decisions belong to PSF and the Chamber. Injishi records what they tell you.
                    </Card.Description>
                  </Card.Header>
                  {data.memberships.map((m) => (
                    <ItemCard key={m.id} variant="secondary" className="items-start">
                      <ItemCard.Icon>
                        <Icon name={m.icon} />
                      </ItemCard.Icon>
                      <ItemCard.Content>
                        <ItemCard.Title className="whitespace-normal">{m.name}</ItemCard.Title>
                        <ItemCard.Description className="whitespace-normal">{m.detail}</ItemCard.Description>
                        <Chip size="sm" variant="soft" color={toneColor(m.tone)} className="mt-1.5 self-start">
                          {m.status}
                        </Chip>
                      </ItemCard.Content>
                      <ItemCard.Action>
                        <LinkButton
                          href={screenHref(m.board)}
                          size="sm"
                          variant="ghost"
                          aria-label={`${m.action}: ${m.name}`}
                        >
                          {m.action}
                        </LinkButton>
                      </ItemCard.Action>
                    </ItemCard>
                  ))}
                </Card>
              </section>

              <section aria-labelledby="gsr-h">
                <Card className="gap-3 p-[18px]">
                  <div className="flex items-start justify-between gap-3">
                    <h2 id="gsr-h" className="text-[15px] leading-[22px] font-semibold">
                      Government Guest-Stay Reporting
                    </h2>
                    <Chip variant="soft" className="shrink-0">
                      <CirclePause className="size-3" />
                      <Chip.Label>Not enabled</Chip.Label>
                    </Chip>
                  </div>
                  <p className="text-sm leading-5 font-medium">
                    Not enabled — legal authority, fields, frequency and secure channel not verified.
                  </p>
                  <ul className="flex flex-col gap-2">
                    {data.gates.map((g) => (
                      <li key={g.id} className="flex items-center justify-between gap-2">
                        <span className="text-[13px]">{g.label}</span>
                        <GateChip icon={<ShieldExclamation className="size-3" />} className="shrink-0">
                          Needs verification
                        </GateChip>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs leading-[17px] text-muted">
                    Injishi never sends guest data to MINALOC, DGIE or a local authority on its own. If an authority
                    makes a written request, record it as a disclosure request: a second person reviews it before
                    anything is shared, and every access is logged.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onPress={() => unavailable("Recording a disclosure request", "nothing was recorded or shared")}
                    >
                      Record a disclosure request
                    </Button>
                    <LinkButton href={screenHref("SettingsPolicies")} size="sm" variant="ghost">
                      Guest ID policy
                    </LinkButton>
                  </div>
                </Card>
              </section>
            </div>
          </div>
        </Tabs.Panel>

        <Tabs.Panel id="privacy" className="mt-0 p-0">
          <CompliancePrivacy
            access={data.access}
            requests={requests}
            onApprove={() =>
              unavailable("Approving an erasure", "these requests are sample data, so nothing was erased or decided")
            }
          />
        </Tabs.Panel>
      </Tabs>
    </PageContent>
  );
}
