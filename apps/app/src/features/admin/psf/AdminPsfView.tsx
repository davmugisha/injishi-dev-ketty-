"use client";

import { Magnifier } from "@gravity-ui/icons";
import { Button, Input } from "@heroui/react";
import {
  PSF_STANDING_LABEL,
  type PsfBusinessesPage,
  type PsfRegisterSummary,
  type PsfStanding,
} from "@injishi/contracts";
import { DataTable, EmptyBlock, formatDay, formatNumber, KpiStrip, PageContent, PageHeader, SectionCard, StatusChip } from "@injishi/ui";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { rwf } from "@/server/format";

/** A standing, or "renewal due": members inside their 60-day renewal window. */
export type AdminPsfFilter = "" | PsfStanding | "renewal_due";

const FILTERS: { id: AdminPsfFilter; label: string }[] = [
  { id: "", label: "All" },
  { id: "member", label: "Members" },
  { id: "renewal_due", label: "Renewal due" },
  { id: "lapsed", label: "Lapsed" },
  { id: "applied", label: "Waiting for approval" },
  { id: "claimed", label: "Claimed" },
  { id: "declined", label: "Declined" },
];

const TONE: Record<PsfStanding, "success" | "warning" | "danger" | "default"> = {
  member: "success",
  applied: "warning",
  claimed: "warning",
  awaiting_payment: "warning",
  lapsed: "danger",
  declined: "danger",
  not_applied: "default",
};

/**
 * PSF memberships across Rwanda (2026-11-02), for Injishi staff: every business on PSF's register,
 * its membership's end date, what is due for renewal and what lapsed. Read only: PSF's District
 * Managers decide applications; a renewal is paid by the business and needs no decision.
 */
export function AdminPsfView({
  summary,
  page,
  q,
  filter,
}: {
  summary: PsfRegisterSummary;
  page: PsfBusinessesPage;
  q: string;
  filter: AdminPsfFilter;
}) {
  const router = useRouter();
  const [search, setSearch] = useState(q);
  const lapsed = summary.byStanding.find((s) => s.key === "lapsed")?.count ?? 0;

  const go = (nextQ: string, next: AdminPsfFilter) => {
    const params = new URLSearchParams();
    if (nextQ.trim()) params.set("q", nextQ.trim());
    if (next === "renewal_due") params.set("renewal", "due");
    else if (next) params.set("standing", next);
    const qs = params.toString();
    router.push(qs ? `/admin/psf?${qs}` : "/admin/psf");
  };

  return (
    <PageContent>
      <PageHeader
        eyebrow="Government · PSF"
        title="PSF memberships"
        description="Every business on PSF's register across Rwanda: who is a member, until when, what is due for renewal and what lapsed. Renewals are paid by the business on its tracking page and need no decision."
      />

      <KpiStrip
        label="Across Rwanda"
        items={[
          {
            id: "members",
            label: "Members",
            value: summary.members,
            format: "count",
            icon: "Persons",
            href: "/admin/psf?standing=member",
            isCurrent: filter === "member",
          },
          {
            id: "due",
            label: "Renewal due",
            value: summary.renewalDue,
            format: "count",
            icon: "ArrowsRotateRight",
            status: summary.renewalDue > 0 ? "warning" : undefined,
            footnote: "Within 60 days of their end date",
            href: "/admin/psf?renewal=due",
            isCurrent: filter === "renewal_due",
          },
          {
            id: "lapsed",
            label: "Lapsed",
            value: lapsed,
            format: "count",
            icon: "CircleXmark",
            status: lapsed > 0 ? "danger" : undefined,
            footnote: "Ended, not renewed",
            href: "/admin/psf?standing=lapsed",
            isCurrent: filter === "lapsed",
          },
          {
            id: "renewed",
            label: "Renewed this year",
            value: summary.renewedThisYear,
            format: "count",
            icon: "CircleCheck",
          },
          {
            id: "paid",
            label: "Paid to PSF this year",
            value: summary.paidThisYearRwf,
            format: "money",
            icon: "Wallet",
          },
        ]}
      />

      <SectionCard
        title={filter === "renewal_due" ? "Renewal due" : filter ? PSF_STANDING_LABEL[filter] : "Every business"}
        description={`${formatNumber(page.total)} ${page.total === 1 ? "business" : "businesses"}`}
        contentClassName="gap-3"
      >
        <form
          className="flex max-w-xl flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            go(search, filter);
          }}
        >
          <Input
            aria-label="Search businesses"
            placeholder="Search by name, business code or TIN"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-[16rem] flex-1"
          />
          <Button type="submit" variant="secondary">
            <Magnifier className="size-4" /> Search
          </Button>
        </form>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Membership status">
          {FILTERS.map((f) => (
            <Button
              key={f.id || "all"}
              size="sm"
              variant={filter === f.id ? "primary" : "ghost"}
              aria-pressed={filter === f.id}
              onPress={() => go(search, f.id)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <DataTable
          label="PSF memberships"
          rows={page.items}
          rowKey={(b) => b.orgId}
          onRowAction={(b) => router.push(`/admin/psf/${b.orgId}`)}
          empty={<EmptyBlock size="sm" icon="Persons" title="No business matches" description="Clear the search or pick All." />}
          columns={[
            {
              id: "name",
              header: "Business",
              isRowHeader: true,
              sortValue: (b) => b.legalName,
              cell: (b) => (
                <span className="flex flex-col gap-0.5">
                  <NextLink href={`/admin/psf/${b.orgId}`} className="font-medium text-foreground hover:underline">
                    {b.legalName}
                  </NextLink>
                  <span className="text-xs text-muted">{[b.businessCode ?? "No code yet", b.membershipNumber].filter(Boolean).join(" · ")}</span>
                </span>
              ),
            },
            { id: "district", header: "District", sortValue: (b) => b.districtName ?? "", cell: (b) => b.districtName ?? "—" },
            {
              id: "standing",
              header: "Status",
              sortValue: (b) => b.standing,
              cell: (b) => <StatusChip tone={TONE[b.standing] ?? "default"}>{PSF_STANDING_LABEL[b.standing] ?? b.standing}</StatusChip>,
            },
            { id: "tier", header: "Tier", sortValue: (b) => b.tierName ?? "", cell: (b) => b.tierName ?? "—" },
            {
              id: "ends",
              header: "Ends",
              sortValue: (b) => b.expiresOn ?? "",
              cell: (b) => <MembershipEnd expiresOn={b.standing === "member" ? b.expiresOn : null} />,
            },
            {
              id: "paid",
              header: "Paid",
              align: "end",
              sortValue: (b) => b.paidRwf,
              cell: (b) => (
                <span className="flex flex-col items-end gap-0.5">
                  <span className="tabular">{rwf(b.paidRwf)}</span>
                  {b.lastPaidAt ? <span className="text-xs text-muted">last {formatDay(b.lastPaidAt)}</span> : null}
                </span>
              ),
            },
          ]}
          mobile={{
            title: (b) => b.legalName,
            description: (b) => (b.expiresOn && b.standing === "member" ? `Ends ${formatDay(b.expiresOn)}` : (b.districtName ?? "")),
            trailing: (b) => <StatusChip tone={TONE[b.standing] ?? "default"}>{PSF_STANDING_LABEL[b.standing] ?? b.standing}</StatusChip>,
          }}
        />
        {page.nextCursor ? (
          <Button
            variant="secondary"
            className="self-start"
            onPress={() => {
              const params = new URLSearchParams(window.location.search);
              params.set("cursor", page.nextCursor!);
              router.push(`/admin/psf?${params.toString()}`);
            }}
          >
            Next page
          </Button>
        ) : null}
      </SectionCard>
    </PageContent>
  );
}

/** Days from today in Kigali to a yyyy-mm-dd date. */
function daysUntil(isoDate: string): number {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kigali" }).format(new Date());
  return Math.round((Date.parse(`${isoDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

/** A member's end date, flagged once it is inside the 60-day renewal window. */
function MembershipEnd({ expiresOn }: { expiresOn: string | null }) {
  if (!expiresOn) return <span className="text-muted">—</span>;
  const left = daysUntil(expiresOn);
  if (left > 60) return <span className="tabular">{formatDay(expiresOn)}</span>;
  return (
    <span className="flex flex-col gap-0.5">
      <span className="tabular">{formatDay(expiresOn)}</span>
      <StatusChip tone={left < 0 ? "danger" : "warning"}>{left < 0 ? "Past its end" : left === 0 ? "Ends today" : `Renew in ${left} days`}</StatusChip>
    </span>
  );
}
