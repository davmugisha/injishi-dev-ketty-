"use client";

import { ArrowRight, Check, Clock, FileText, ShieldCheck } from "@gravity-ui/icons";
import { Avatar, Card, Chip } from "@heroui/react";
import { EmptyState, KPIGroup, Timeline } from "@heroui-pro/react";
import { KPI } from "@heroui-pro/react/kpi";
import { screenHref } from "@injishi/data";
import type { OfficerDecision, QueueCase, QueueKpi } from "@injishi/data/fixtures/oversight";
import { Icon, LinkButton, PageContent, PageHeader } from "@injishi/ui";
import NextLink from "next/link";
import { Fragment } from "react";
import { TopbarStatus } from "@/components/shell/TopbarStatus";
import { CardHeading } from "./shared";

/** The three numbers a PSF District Manager acts on, of the desk's figures. */
const SHOWN: readonly string[] = ["yours", "oldest", "unread"];

const STEPS = [
  { icon: FileText, title: "Open the business", text: "Its RDB certificate and what the owner declared." },
  { icon: Check, title: "Read each document", text: "Tick it once read. The registry records your name and time." },
  {
    icon: ShieldCheck,
    title: "Mark it reviewed",
    text: "That approves the business and emails the owner. Or reject it with a reason.",
  },
] as const;

/** "1 uploaded · none read" → how many of how many are read, for the case card. */
function documents(c: QueueCase): string {
  return c.facts.find((f) => f.label === "Documents")?.value ?? "No documents";
}

/** One business waiting on the manager: who, where, how long, and the one thing to do. */
function CaseCard({ c, first }: { c: QueueCase; first: boolean }) {
  const href = c.href ?? screenHref("OfficerCase");
  return (
    <li>
      <Card className="flex-row flex-wrap items-center gap-4 p-4">
        <Avatar variant="soft" color="accent" className="shrink-0">
          <Avatar.Fallback>{c.initials}</Avatar.Fallback>
        </Avatar>
        <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-[15px] font-semibold">{c.business}</span>
            <span className="text-[12px] text-muted tabular">{c.ref ?? c.id}</span>
          </div>
          <span className="text-[13px] text-muted">
            {c.typeDetail} · {c.place}
          </span>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Chip size="sm" variant="soft" color={first ? "warning" : "default"}>
              <Clock className="size-3" aria-hidden="true" />
              <Chip.Label>Waiting {c.age === "Today" ? "since today" : c.age}</Chip.Label>
            </Chip>
            <Chip size="sm" variant="soft">
              <FileText className="size-3" aria-hidden="true" />
              <Chip.Label>{documents(c)}</Chip.Label>
            </Chip>
            {c.type !== "New business registration" ? (
              <Chip size="sm" variant="soft">
                <Chip.Label>{c.type}</Chip.Label>
              </Chip>
            ) : null}
          </div>
        </div>
        <LinkButton href={href} variant={first ? "primary" : "secondary"} className="shrink-0">
          Review
          <ArrowRight className="size-4" />
        </LinkButton>
      </Card>
    </li>
  );
}

/**
 * A PSF District Manager's registrations (2026-10-30): the businesses waiting on their one-step review,
 * a short guide to it, and what they decided lately. The two-officer desk (`OfficerHomeView`) stays
 * for document reviewers and approvers.
 */
export function PsfRegistrationsView({
  scope,
  title,
  cases,
  kpis,
  decisions,
}: {
  /** "Gasabo". */
  scope: string;
  /** "PSF District Manager". */
  title: string;
  cases: QueueCase[];
  kpis: QueueKpi[];
  decisions: OfficerDecision[];
}) {
  const waiting = cases.filter((c) => c.action === "open");
  const shown = SHOWN.map((id) => kpis.find((k) => k.id === id)).filter((k): k is QueueKpi => !!k);

  return (
    <PageContent className="text-[14px] leading-5">
      <TopbarStatus kind="chip" tone="success" dot="success" label={`Active mandate · ${scope}`} />
      <PageHeader
        eyebrow={`${title} · ${scope}`}
        title="Business approvals"
        description="Businesses registering on Injishi in your district wait here for your review. Marking one reviewed approves it, and the owner can then open it to guests."
        actions={
          waiting[0]?.href ? (
            <LinkButton href={waiting[0].href}>
              Review next
              <ArrowRight className="size-4" />
            </LinkButton>
          ) : null
        }
      />

      <section aria-label="Your figures">
        <KPIGroup className="flex-wrap">
          {shown.map((k, i) => (
            <Fragment key={k.id}>
              {i > 0 ? <KPIGroup.Separator /> : null}
              <KPI className="min-w-[180px] flex-[1_1_180px]">
                <KPI.Header>
                  {k.dueSoon ? (
                    <KPI.Icon status="warning">
                      <Clock />
                    </KPI.Icon>
                  ) : null}
                  <KPI.Title>{k.id === "yours" ? "Waiting for your review" : k.label}</KPI.Title>
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

      <div className="flex flex-wrap items-start gap-4">
        <section aria-labelledby="waiting-h" className="flex min-w-0 flex-[999_1_560px] flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="waiting-h" className="text-[15px] leading-[22px] font-semibold">
              Waiting for your review
            </h2>
            {waiting.length > 1 ? <span className="text-[12px] text-muted">Oldest first</span> : null}
          </div>
          {waiting.length ? (
            <ul className="flex flex-col gap-2.5">
              {waiting.map((c, i) => (
                <CaseCard key={c.id} c={c} first={i === 0} />
              ))}
            </ul>
          ) : (
            <Card variant="secondary" className="p-8">
              <EmptyState>
                <EmptyState.Header>
                  <EmptyState.Media variant="icon">
                    <Check />
                  </EmptyState.Media>
                  <EmptyState.Title>Nothing is waiting on you</EmptyState.Title>
                  <EmptyState.Description>
                    A business in {scope} shows here once its owner has paid the registration fee. We email you too.
                  </EmptyState.Description>
                </EmptyState.Header>
                <EmptyState.Content>
                  <LinkButton href={screenHref("PsfReport")} size="sm" variant="secondary">
                    See the overview
                  </LinkButton>
                </EmptyState.Content>
              </EmptyState>
            </Card>
          )}
        </section>

        <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
          <Card render={(p) => <section {...p} />} aria-labelledby="how-h" className="gap-3 p-[18px]">
            <Card.Header>
              <CardHeading id="how-h">How a review works</CardHeading>
            </Card.Header>
            <ol className="flex flex-col gap-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex items-start gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[12px] font-semibold text-accent-soft-foreground">
                    {i + 1}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium">{s.title}</span>
                    <span className="text-[12px] leading-4 text-muted">{s.text}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="flex items-center gap-1.5 text-[12px] leading-4 text-muted">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              Every record you open is logged.
            </p>
          </Card>

          <Card render={(p) => <section {...p} />} aria-labelledby="dec-h" className="gap-3 p-[18px]">
            <Card.Header>
              <CardHeading id="dec-h">Your recent decisions</CardHeading>
              <Card.Description>Open one to see the business, its listing and its documents</Card.Description>
            </Card.Header>
            {decisions.length ? (
              <Timeline size="sm" density="compact">
                {decisions.map((e) => (
                  <Timeline.Item key={e.id} status={e.status}>
                    <Timeline.Rail>
                      <Timeline.Marker>
                        <Icon name={e.icon} className="size-3" />
                      </Timeline.Marker>
                      <Timeline.Connector />
                    </Timeline.Rail>
                    <Timeline.Content className="flex flex-col pb-0.5">
                      {e.href ? (
                        <NextLink href={e.href} className="font-medium text-foreground hover:underline">
                          {e.title}
                        </NextLink>
                      ) : (
                        <span className="font-medium">{e.title}</span>
                      )}
                      <span className="text-[12px] leading-4 text-muted">{e.detail}</span>
                    </Timeline.Content>
                  </Timeline.Item>
                ))}
              </Timeline>
            ) : (
              <p className="text-[13px] text-muted">The businesses you review show here, newest first.</p>
            )}
            <LinkButton href="/psf/report/approvals" size="sm" variant="ghost" className="self-start">
              Every business decided
              <ArrowRight className="size-4" />
            </LinkButton>
          </Card>
        </aside>
      </div>
    </PageContent>
  );
}
