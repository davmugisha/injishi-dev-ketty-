"use client";

import { Magnifier } from "@gravity-ui/icons";
import { Alert, Button, Input } from "@heroui/react";
import {
  DataTable,
  EmptyBlock,
  formatNumber,
  KpiStrip,
  PageContent,
  PageHeader,
  SectionCard,
  StatusChip,
} from "@injishi/ui";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { rwf } from "@/server/format";
import {
  PSF_STANDING_LABEL,
  type PsfBusinessesPage,
  type PsfRegisterSummary,
  type PsfScope,
  type PsfStanding,
} from "@/server/sources/psf";

const STANDINGS: { id: "" | PsfStanding; label: string }[] = [
  { id: "", label: "All" },
  { id: "member", label: "Members" },
  { id: "applied", label: "Applied" },
  { id: "awaiting_payment", label: "Approved, to pay" },
  { id: "lapsed", label: "Lapsed" },
  { id: "declined", label: "Declined" },
  { id: "not_applied", label: "Not applied" },
];

const TONE: Record<PsfStanding, "success" | "warning" | "danger" | "default"> = {
  member: "success",
  applied: "warning",
  awaiting_payment: "warning",
  lapsed: "danger",
  declined: "danger",
  not_applied: "default",
};

/**
 * Businesses (2026-10-30, was "Business register"): every business in the manager's region that PSF
 * knows, with how it stands with PSF. Each row opens the business: its documents, how its registration
 * was decided, whether guests can book it, and its membership. The work waiting on the manager is
 * elsewhere: membership applications, and business approvals.
 */
export function PsfRegisterView({
  scope,
  summary,
  page,
  q,
  standing,
}: {
  scope: PsfScope;
  summary: PsfRegisterSummary;
  page: PsfBusinessesPage;
  q: string;
  standing: PsfStanding | "";
}) {
  const router = useRouter();
  const [search, setSearch] = useState(q);
  const showDistrict = scope.level !== "district";
  const open = (orgId: string) => router.push(`/psf/register/${orgId}`);

  const go = (nextQ: string, nextStanding: PsfStanding | "") => {
    const params = new URLSearchParams();
    if (nextQ.trim()) params.set("q", nextQ.trim());
    if (nextStanding) params.set("standing", nextStanding);
    const qs = params.toString();
    router.push(qs ? `/psf/register?${qs}` : "/psf/register");
  };

  return (
    <PageContent>
      <PageHeader
        eyebrow={`${scope.title} · ${scope.label}`}
        title="Businesses"
        description={`Every business in ${summary.regionLabel} on PSF's register, and how it stands with PSF. Open one to see its documents, its approval and whether guests can book it.`}
      />

      <KpiStrip
        label="On the register"
        items={[
          { id: "total", label: "Businesses", value: summary.total, format: "count", icon: "FolderHouse" },
          {
            id: "members",
            label: "Members",
            value: summary.members,
            format: "count",
            icon: "Persons",
            href: "/psf/register?standing=member",
            isCurrent: standing === "member",
          },
          {
            id: "waiting",
            label: "Waiting on PSF",
            value: summary.waiting,
            format: "count",
            icon: "Clock",
            status: summary.waiting > 0 ? "warning" : undefined,
            footnote: summary.waiting ? "Decide them in Membership applications" : "None waiting",
            href: "/psf",
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

      {scope.level !== "district" ? (
        <Alert status="accent">
          <Alert.Content>
            <Alert.Title>For reporting</Alert.Title>
            <Alert.Description>
              Membership decisions stay with each district&apos;s PSF District Manager. You see every business in{" "}
              {scope.label}.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}

      <SectionCard
        title={standing ? PSF_STANDING_LABEL[standing] : "Every business"}
        description={`${formatNumber(page.total)} ${page.total === 1 ? "business" : "businesses"}`}
        contentClassName="gap-3"
      >
        <form
          className="flex max-w-xl flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            go(search, standing);
          }}
        >
          <Input
            aria-label="Search businesses"
            placeholder="Search by name or business code"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-[16rem] flex-1"
          />
          <Button type="submit" variant="secondary">
            <Magnifier className="size-4" /> Search
          </Button>
        </form>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Standing with PSF">
          {STANDINGS.map((s) => (
            <Button
              key={s.id || "all"}
              size="sm"
              variant={standing === s.id ? "primary" : "ghost"}
              aria-pressed={standing === s.id}
              onPress={() => go(search, s.id)}
            >
              {s.label}
            </Button>
          ))}
        </div>
        <DataTable
          label="Businesses"
          rows={page.items}
          rowKey={(b) => b.orgId}
          onRowAction={(b) => open(b.orgId)}
          empty={
            <EmptyBlock
              size="sm"
              icon="FolderHouse"
              title="No business matches"
              description={q || standing ? "Clear the search or pick All." : "None in this region yet."}
            />
          }
          columns={[
            {
              id: "name",
              header: "Business",
              isRowHeader: true,
              sortValue: (b) => b.legalName,
              cell: (b) => (
                <span className="flex flex-col gap-0.5">
                  <NextLink href={`/psf/register/${b.orgId}`} className="font-medium text-foreground hover:underline">
                    {b.legalName}
                  </NextLink>
                  <span className="text-xs text-muted">
                    {b.businessCode ?? "No code yet"}
                    {b.branchCount > 0 ? ` · ${b.branchCount} more branches` : ""}
                    {!b.headOfficeInScope ? " · a branch in your region" : ""}
                  </span>
                </span>
              ),
            },
            {
              id: "sector",
              header: "PSF sector",
              sortValue: (b) => b.clusterName ?? "",
              cell: (b) => [b.clusterName, b.subsectorName].filter(Boolean).join(" · ") || "—",
            },
            ...(showDistrict
              ? [
                  {
                    id: "district",
                    header: "District",
                    sortValue: (b: PsfBusinessesPage["items"][number]) => b.districtName ?? "",
                    cell: (b: PsfBusinessesPage["items"][number]) => b.districtName ?? "—",
                  },
                ]
              : []),
            {
              id: "standing",
              header: "With PSF",
              sortValue: (b) => b.standing,
              cell: (b) => (
                <StatusChip tone={TONE[b.standing] ?? "default"}>
                  {PSF_STANDING_LABEL[b.standing] ?? b.standing}
                </StatusChip>
              ),
            },
            { id: "tier", header: "Tier", sortValue: (b) => b.tierName ?? "", cell: (b) => b.tierName ?? "—" },
            {
              id: "paid",
              header: "Paid",
              align: "end",
              sortValue: (b) => b.paidRwf,
              cell: (b) => <span className="tabular">{rwf(b.paidRwf)}</span>,
            },
          ]}
          mobile={{
            title: (b) => b.legalName,
            description: (b) => b.businessCode ?? "No code yet",
            trailing: (b) => (
              <StatusChip tone={TONE[b.standing] ?? "default"}>
                {PSF_STANDING_LABEL[b.standing] ?? b.standing}
              </StatusChip>
            ),
          }}
        />
      </SectionCard>
    </PageContent>
  );
}
