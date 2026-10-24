"use client";

import { Check, ChevronRight, Clock, Database, FileText, Lock, ShieldCheck } from "@gravity-ui/icons";
import { Alert, Avatar, Button, Card, Chip, Separator } from "@heroui/react";
import { EmptyState, KPIGroup, ListView, Timeline } from "@heroui-pro/react";
import { KPI } from "@heroui-pro/react/kpi";
import { type Persona, screenHref } from "@injishi/data";
import type {
  MandateExclusion,
  MandateFact,
  MandateRule,
  MandateState,
  OfficerDecision,
  QueueCase,
  QueueId,
  QueueKpi,
} from "@injishi/data/fixtures/oversight";
import { Icon, LinkButton, PageContent, PageHeader, toneColor } from "@injishi/ui";
import { Fragment } from "react";
import { TopbarStatus } from "@/components/shell/TopbarStatus";
import { OfficerQueues } from "./OfficerQueues";
import { CardHeading, FactGrid, ToneChip } from "./shared";

export interface OfficerHomeData {
  facts: MandateFact[];
  /** Labels of the permissions delegated to the signed-in officer. */
  granted: string[];
  exclusions: MandateExclusion[];
  kpis: QueueKpi[];
  cases: QueueCase[];
  decisions: OfficerDecision[];
  rules: MandateRule[];
  /** Who the officer acts for, and where ("Private Sector Federation", "Gasabo"). */
  institution: string;
  scope: string;
  /** Today in Kigali, long form. */
  today: string;
  /** The queues this officer's grants cover. */
  held: QueueId[];
  /** The oldest case waiting on this officer, or null when nothing waits. */
  firstCaseHref: string | null;
}

export function OfficerHomeView({
  persona,
  state,
  data,
}: {
  persona: Persona;
  state: MandateState;
  data: OfficerHomeData;
}) {
  const open = state.queuesOpen;
  const facts = data.facts.map((f) =>
    f.id === "valid" ? { ...f, value: state.validUntil, note: state.validNote } : f,
  );

  return (
    <PageContent className="text-[14px] leading-5">
      <TopbarStatus kind="chip" tone={state.tone} dot={state.tone} label={state.pill} />
      <PageHeader
        size="hello"
        eyebrow={
          <>
            {data.today} · {data.scope}
          </>
        }
        title={`Good morning, ${persona.firstName}`}
        description={state.summary}
        actions={
          <>
            <LinkButton href={screenHref("DelegatedReports")} variant="secondary">
              <Database className="size-4" />
              Delegated data
            </LinkButton>
            {open && data.firstCaseHref ? (
              <LinkButton href={data.firstCaseHref}>
                <FileText className="size-4" />
                Open next case
              </LinkButton>
            ) : (
              <Button isDisabled>Open next case</Button>
            )}
          </>
        }
      />

      <Card render={(p) => <section {...p} />} aria-labelledby="mandate-h" className="gap-4 px-5 py-[18px]">
        <div className="flex flex-wrap items-start gap-3">
          <Avatar variant="soft" color={toneColor(state.tone)} className="shrink-0">
            <Avatar.Fallback>
              <ShieldCheck className="size-5" aria-hidden="true" />
            </Avatar.Fallback>
          </Avatar>
          <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="mandate-h" className="text-[15px] leading-[22px] font-semibold">
                Your Mandate
              </h2>
              <ToneChip tone={state.tone}>{state.chip}</ToneChip>
            </div>
            <p className="text-[13px] leading-[18px] text-muted">
              You act for {data.institution}, not for Injishi. You only see businesses registered in {data.scope}, and
              every record you open is written to your access log.
            </p>
          </div>
          <LinkButton href={screenHref("DistrictAdmin")} size="sm" variant="ghost">
            Bodies and officers
            <ChevronRight className="size-4" />
          </LinkButton>
        </div>

        {state.alert ? (
          <Alert status={toneColor(state.tone)} role="status">
            <Alert.Indicator>
              <Icon name={state.alert.icon} />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>{state.alert.title}</Alert.Title>
              <Alert.Description>{state.alert.description}</Alert.Description>
            </Alert.Content>
          </Alert>
        ) : null}

        <FactGrid min={150} className="gap-x-4 gap-y-[14px]" items={facts} />

        <Separator />

        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-1.5">
            <span id="granted-h" className="text-[12px] leading-4 text-muted">
              Delegated to you
            </span>
            <ul aria-labelledby="granted-h" className="flex flex-wrap gap-1.5">
              {data.granted.map((g) => (
                <li key={g}>
                  <Chip size="sm" variant="soft" color="success">
                    <Check className="size-3" aria-hidden="true" />
                    <Chip.Label>{g}</Chip.Label>
                  </Chip>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1.5">
            <span id="withheld-h" className="text-[12px] leading-4 text-muted">
              Not in your mandate
            </span>
            <ul aria-labelledby="withheld-h" className="flex flex-wrap gap-1.5">
              {data.exclusions.map((w) => (
                <li key={w.id}>
                  <Chip size="sm" variant="soft">
                    <Lock className="size-3" aria-hidden="true" />
                    <Chip.Label>{w.label}</Chip.Label>
                  </Chip>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      {open ? null : (
        <Card variant="secondary" render={(p) => <section {...p} />} className="p-8">
          <EmptyState>
            <EmptyState.Header>
              <EmptyState.Media variant="icon">
                <Lock />
              </EmptyState.Media>
              <EmptyState.Title>Your queues are hidden while access is paused</EmptyState.Title>
              <EmptyState.Description>
                No case, document or dataset can be opened under this mandate until {data.institution} confirms your
                access.
              </EmptyState.Description>
            </EmptyState.Header>
            <EmptyState.Content>
              <LinkButton href={screenHref("DistrictAdmin")} size="sm" variant="secondary">
                See access review status
              </LinkButton>
            </EmptyState.Content>
          </EmptyState>
        </Card>
      )}

      {open ? (
        <>
          <section aria-label="Queue health">
            <KPIGroup className="flex-wrap">
              {data.kpis.map((k, i) => (
                <Fragment key={k.id}>
                  {i > 0 ? <KPIGroup.Separator /> : null}
                  <KPI className="min-w-[180px] flex-[1_1_180px]">
                    <KPI.Header>
                      {k.dueSoon ? (
                        <KPI.Icon status="warning">
                          <Clock />
                        </KPI.Icon>
                      ) : null}
                      <KPI.Title>{k.label}</KPI.Title>
                    </KPI.Header>
                    <KPI.Content>
                      <KPI.Value value={k.value} formatOptions={k.format} className="tabular" />
                    </KPI.Content>
                    <KPI.Footer>
                      <p className="text-[12px] leading-4 text-muted">{k.foot}</p>
                    </KPI.Footer>
                  </KPI>
                </Fragment>
              ))}
            </KPIGroup>
          </section>

          <OfficerQueues cases={data.cases} held={data.held} />

          <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(380px,100%),1fr))]">
            <Card render={(p) => <section {...p} />} aria-labelledby="act-h" className="gap-3 p-[18px]">
              <Card.Header>
                <CardHeading id="act-h">Recent Decisions</CardHeading>
                <Card.Description>
                  Yours and the ones waiting on you · each sent to the business as an event
                </Card.Description>
              </Card.Header>
              <Timeline size="sm" density="compact">
                {data.decisions.map((e) => (
                  <Timeline.Item key={e.id} status={e.status}>
                    <Timeline.Rail>
                      <Timeline.Marker>
                        <Icon name={e.icon} className="size-3" />
                      </Timeline.Marker>
                      <Timeline.Connector />
                    </Timeline.Rail>
                    <Timeline.Content className="flex flex-col pb-0.5">
                      <span className="font-medium">{e.title}</span>
                      <span className="text-[12px] leading-4 text-muted">{e.detail}</span>
                    </Timeline.Content>
                  </Timeline.Item>
                ))}
              </Timeline>
            </Card>

            <Card render={(p) => <section {...p} />} aria-labelledby="rules-h" className="gap-3 p-[18px]">
              <Card.Header>
                <CardHeading id="rules-h">How This Mandate Works</CardHeading>
                <Card.Description>Set by {data.institution}, the body that assigned you</Card.Description>
              </Card.Header>
              <ListView aria-labelledby="rules-h" variant="secondary" items={data.rules}>
                {(ru) => (
                  <ListView.Item
                    id={ru.id}
                    textValue={ru.title}
                    href={ru.board === "OfficerCase" ? (data.firstCaseHref ?? undefined) : screenHref(ru.board)}
                  >
                    <ListView.ItemContent>
                      <Icon name={ru.icon} className="size-4 shrink-0 text-muted" />
                      <div className="flex min-w-0 flex-col">
                        <ListView.Title>{ru.title}</ListView.Title>
                        <ListView.Description className="whitespace-normal">{ru.description}</ListView.Description>
                      </div>
                    </ListView.ItemContent>
                    <ListView.ItemAction>
                      <ChevronRight className="size-4 text-muted" aria-hidden="true" />
                    </ListView.ItemAction>
                  </ListView.Item>
                )}
              </ListView>
            </Card>
          </div>
        </>
      ) : null}
    </PageContent>
  );
}
