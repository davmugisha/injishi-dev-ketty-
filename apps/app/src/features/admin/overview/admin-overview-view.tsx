"use client";

import type { AdminAuditRow, AdminOrgStage, PsfRegisterSummary } from "@injishi/contracts";
import { DateText, EmptyBlock, type KpiItem, LinkButton, PageContent, SectionCard } from "@injishi/ui";
import NextLink from "next/link";
import { EntityMark, type Stat, StatCards } from "../list/stat-cards";

type Counts<K extends string> = Partial<Record<K, number>>;

/** "admin.user.details_changed" → "User details changed". */
function eventWords(type: string): string {
  const words = type.split(".").slice(1).join(" ").replace(/_/g, " ").trim() || type.replace(/[._]/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * The staff overview (2026-11-09): first what is waiting on someone (each figure opens its list, already
 * filtered), then how big Injishi is, then the latest changes. A block this staffer may not read is left out.
 */
export function AdminOverviewView({
  orgs,
  accounts,
  psf,
  coverage,
  brokers,
  recent,
}: {
  orgs: { total: number; stages: Counts<AdminOrgStage> } | null;
  accounts: { total: number; statuses: Counts<"active" | "invited" | "suspended"> } | null;
  psf: PsfRegisterSummary | null;
  coverage: { gaps: number; waiting: number } | null;
  brokers: Counts<"active" | "past_due" | "pending_payment" | "cancelled" | "expired"> | null;
  recent: AdminAuditRow[] | null;
}) {
  const attention: KpiItem[] = [];
  const warn = (n: number) => (n > 0 ? ("warning" as const) : undefined);
  if (orgs) {
    attention.push(
      {
        id: "review",
        label: "To review",
        footnote: "Businesses waiting for a visit",
        value: orgs.stages.review ?? 0,
        format: "count",
        icon: "Clock",
        status: warn(orgs.stages.review ?? 0),
        href: "/admin/businesses?stage=review",
      },
      {
        id: "approval",
        label: "To approve",
        footnote: "Businesses waiting for approval",
        value: orgs.stages.approval ?? 0,
        format: "count",
        icon: "ShieldCheck",
        status: warn(orgs.stages.approval ?? 0),
        href: "/admin/businesses?stage=approval",
      },
    );
  }
  if (psf) {
    attention.push(
      {
        id: "psf-waiting",
        label: "PSF to decide",
        footnote: "Applications waiting",
        value: psf.waiting,
        format: "count",
        icon: "Persons",
        status: warn(psf.waiting),
        href: "/admin/psf?status=applied",
      },
      {
        id: "psf-renewal",
        label: "PSF renewals due",
        value: psf.renewalDue,
        format: "count",
        icon: "ArrowsRotateRight",
        status: warn(psf.renewalDue),
        footnote: "Within 60 days of their end date",
        href: "/admin/psf?status=renewal_due",
      },
    );
  }
  if (coverage) {
    attention.push({
      id: "coverage",
      label: "Posts to fill",
      value: coverage.gaps,
      format: "count",
      icon: "MapPin",
      status: coverage.waiting > 0 ? "danger" : warn(coverage.gaps),
      footnote: coverage.waiting > 0 ? `${coverage.waiting} guest registrations waiting` : "No guests waiting",
      href: "/admin/leaders/coverage",
    });
  }
  const size: KpiItem[] = [
    ...(orgs
      ? [
          {
            id: "active",
            label: "Businesses",
            value: orgs.stages.active ?? 0,
            format: "count" as const,
            icon: "Briefcase" as const,
            footnote: `active, of ${orgs.total} registered`,
            href: "/admin/businesses?stage=active",
          },
        ]
      : []),
    ...(accounts
      ? [
          {
            id: "people",
            label: "People",
            value: accounts.total,
            format: "count" as const,
            icon: "Persons" as const,
            footnote: `${accounts.statuses.invited ?? 0} not signed in yet`,
            href: "/admin/people",
          },
        ]
      : []),
    ...(psf
      ? [
          {
            id: "members",
            label: "PSF members",
            value: psf.members,
            format: "count" as const,
            icon: "CircleCheck" as const,
            href: "/admin/psf?status=member",
          },
          {
            id: "paid",
            label: "Paid to PSF this year",
            value: psf.paidThisYearRwf,
            format: "money" as const,
            icon: "Wallet" as const,
          },
        ]
      : []),
    ...(brokers
      ? [
          {
            id: "brokers",
            label: "Brokers on a plan",
            value: brokers.active ?? 0,
            format: "count" as const,
            icon: "CreditCard" as const,
            footnote: `${brokers.past_due ?? 0} in grace`,
            href: "/admin/brokers/plans?status=active",
          },
        ]
      : []),
  ];

  const toStats = (items: KpiItem[], quiet: boolean): Stat[] =>
    items.map((k) => ({
      id: k.id,
      label: k.label,
      value: k.value,
      format: k.format === "money" ? "money" : "count",
      icon: k.icon ?? "Persons",
      tone: k.status ?? (quiet ? "neutral" : "accent"),
      footnote: k.footnote,
      href: k.href,
    }));
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Africa/Kigali" }).format(new Date()),
  );
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const waiting = attention.reduce((n, a) => n + (a.status ? a.value : 0), 0);

  return (
    <PageContent>
      <header className="flex flex-col gap-1">
        <p className="m-0 text-sm font-medium text-accent">
          {new Intl.DateTimeFormat("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            timeZone: "Africa/Kigali",
          }).format(new Date())}
        </p>
        <h1 className="m-0 text-3xl font-semibold tracking-tight">{greeting}</h1>
        <p className="m-0 text-base text-muted">
          {waiting > 0
            ? `${waiting} ${waiting === 1 ? "thing is" : "things are"} waiting on someone across Injishi.`
            : "Nothing is waiting on anyone right now."}
        </p>
      </header>
      {attention.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="m-0 text-sm font-semibold tracking-wide text-muted uppercase">Needs attention</h2>
          <StatCards label="Needs attention" stats={toStats(attention, false)} />
        </section>
      ) : null}
      {size.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="m-0 text-sm font-semibold tracking-wide text-muted uppercase">Injishi today</h2>
          <StatCards label="Injishi today" stats={toStats(size, true)} />
        </section>
      ) : null}
      {recent ? (
        <SectionCard
          title="Latest changes"
          description="From the audit log, newest first."
          actions={
            <LinkButton href="/admin/audit" variant="secondary">
              Open the audit log
            </LinkButton>
          }
        >
          {recent.length === 0 ? (
            <EmptyBlock size="sm" icon="Clock" title="Nothing recorded yet" />
          ) : (
            <ul className="m-0 flex list-none flex-col p-0">
              {recent.map((r) => (
                <li
                  key={r.id}
                  className="grid grid-cols-1 gap-1 border-b border-separator py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <EntityMark name={r.actorName?.trim() || "Injishi"} />
                    <span className="flex min-w-0 flex-col text-sm">
                      <span className="truncate font-medium">{eventWords(r.eventType)}</span>
                      <span className="truncate text-xs text-muted">
                        {r.actorUserId ? (
                          <NextLink href={`/admin/people/${r.actorUserId}`} className="hover:underline">
                            {r.actorName?.trim() || "Someone"}
                          </NextLink>
                        ) : (
                          "The system"
                        )}
                        {r.reason ? ` · ${r.reason}` : ""}
                      </span>
                    </span>
                  </span>
                  <span className="text-sm text-muted">
                    <DateText value={r.occurredAt} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      ) : null}
    </PageContent>
  );
}
