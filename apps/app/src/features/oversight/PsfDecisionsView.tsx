"use client";

import { Magnifier } from "@gravity-ui/icons";
import { Button, Input } from "@heroui/react";
import { DataTable, EmptyBlock, formatDay, formatNumber, PageContent, PageHeader, SectionCard, StatusChip } from "@injishi/ui";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { rwf } from "@/server/format";
import type { PsfDecisionsPage, PsfScope } from "@/server/sources/psf";
import { ExportMenu } from "@/components/ExportMenu";
import type { ExportTable } from "@/lib/table-export";
import { kigaliToday } from "./psf-csv";
import { exportPsfDecisionsAction } from "./psf-export-actions";

type Outcome = "" | "approved" | "declined";

const OUTCOMES: { id: Outcome; label: string }[] = [
  { id: "", label: "All" },
  { id: "approved", label: "Approved" },
  { id: "declined", label: "Declined" },
];

/**
 * Membership decisions (2026-11-02, rebuilt on the console's own parts): every PSF membership the
 * region approved or declined, newest first, each opening its application. The same header, search
 * and table as Businesses and Membership applications.
 */
export function PsfDecisionsView({
  scope,
  page,
  q,
  outcome,
  paged,
}: {
  scope: PsfScope;
  page: PsfDecisionsPage;
  q: string;
  outcome: Outcome;
  /** Past the first page: the counts are of this page only. */
  paged: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState(q);
  const [exportProblem, setExportProblem] = useState<string | null>(null);
  // Every decision under this search and filter, not only the page shown (2026-11-02).
  const exportRows = async (): Promise<ExportTable | string> => {
    const res = await exportPsfDecisionsAction({ q, outcome: outcome || undefined });
    if (!res.ok) return res.error;
    return {
      filename: `psf-decisions-${kigaliToday()}`,
      title: "PSF membership decisions",
      subtitle: [scope.label, outcome === "approved" ? "Approved" : outcome === "declined" ? "Declined" : "Every decision", q ? `“${q}”` : null, `exported ${kigaliToday()}`]
        .filter(Boolean)
        .join(" · "),
      sections: [
        {
          heading: ["Business", "docID", "Business code", "District", "Decision", "Now", "Membership", "Membership number", "Fee (RWF)", "Decline reason", "Days to decide", "Decided by", "Decided on"],
          rows: res.rows.map((d) => [
            d.businessName,
            d.docId,
            d.businessCode,
            d.districtName,
            d.outcome === "approved" ? "Approved" : "Declined",
            d.outcome === "approved" ? (d.paid ? "A member" : "Waiting for payment") : "",
            d.tierName,
            d.membershipNumber,
            d.feeRwf,
            d.declineReasonLabel,
            d.daysToDecide === null ? "" : Math.round(d.daysToDecide * 10) / 10,
            d.decidedByName,
            d.decidedAt.slice(0, 10),
          ]),
        },
      ],
    };
  };
  const showDistrict = scope.level !== "district";
  const approved = page.items.filter((d) => d.outcome === "approved").length;
  const declined = page.items.length - approved;

  const go = (nextQ: string, next: Outcome, cursor?: string) => {
    const params = new URLSearchParams();
    if (nextQ.trim()) params.set("q", nextQ.trim());
    if (next) params.set("outcome", next);
    if (cursor) params.set("cursor", cursor);
    const qs = params.toString();
    router.push(qs ? `/psf/decisions?${qs}` : "/psf/decisions");
  };

  return (
    <PageContent>
      <PageHeader
        eyebrow={`${scope.title} · ${scope.label}`}
        title="Membership decisions"
        description="Every PSF membership approved or declined in your region, newest first. Open one to see its application. Business approvals on Injishi are under Reports, Business approvals."
      />

      <SectionCard
        title={outcome === "approved" ? "Approved" : outcome === "declined" ? "Declined" : "Every decision"}
        description={`${formatNumber(page.items.length)} shown${paged ? " on this page" : ""} · ${formatNumber(approved)} approved · ${formatNumber(declined)} declined`}
        actions={
          <ExportMenu load={exportRows} isDisabled={page.items.length === 0} onProblem={setExportProblem} />
        }
        contentClassName="gap-3"
      >
        {exportProblem ? <p className="text-sm text-danger">{exportProblem}</p> : null}
        <form
          className="flex max-w-xl flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            go(search, outcome);
          }}
        >
          <Input
            aria-label="Search decisions"
            placeholder="Search a business, code or docID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-[16rem] flex-1"
          />
          <Button type="submit" variant="secondary">
            <Magnifier className="size-4" /> Search
          </Button>
        </form>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Decision">
          {OUTCOMES.map((o) => (
            <Button
              key={o.id || "all"}
              size="sm"
              variant={outcome === o.id ? "primary" : "ghost"}
              aria-pressed={outcome === o.id}
              onPress={() => go(search, o.id)}
            >
              {o.label}
            </Button>
          ))}
        </div>
        <DataTable
          label="Membership decisions"
          rows={page.items}
          rowKey={(d) => d.applicationId}
          onRowAction={(d) => router.push(`/psf/${d.applicationId}`)}
          empty={
            <EmptyBlock
              size="sm"
              icon="CircleCheck"
              title="No decision matches"
              description={q || outcome ? "Clear the search or pick All." : "Decisions on applications in your region appear here."}
            />
          }
          columns={[
            {
              id: "business",
              header: "Business",
              isRowHeader: true,
              sortValue: (d) => d.businessName,
              cell: (d) => (
                <span className="flex flex-col gap-0.5">
                  <NextLink href={`/psf/${d.applicationId}`} className="font-medium text-foreground hover:underline">
                    {d.businessName}
                  </NextLink>
                  <span className="text-xs text-muted">{[d.docId, d.businessCode].filter(Boolean).join(" · ") || "—"}</span>
                </span>
              ),
            },
            ...(showDistrict
              ? [
                  {
                    id: "district",
                    header: "District",
                    sortValue: (d: PsfDecisionsPage["items"][number]) => d.districtName ?? "",
                    cell: (d: PsfDecisionsPage["items"][number]) => d.districtName ?? "—",
                  },
                ]
              : []),
            {
              id: "decision",
              header: "Decision",
              sortValue: (d) => d.outcome,
              cell: (d) =>
                d.outcome === "approved" ? (
                  <span className="flex flex-col items-start gap-0.5">
                    <StatusChip tone="success">Approved</StatusChip>
                    <span className="text-xs text-muted">{d.paid ? "A member" : "Waiting for payment"}</span>
                  </span>
                ) : (
                  <span className="flex flex-col items-start gap-0.5">
                    <StatusChip tone="danger">Declined</StatusChip>
                    {d.declineReasonLabel ? <span className="text-xs text-muted">{d.declineReasonLabel}</span> : null}
                  </span>
                ),
            },
            {
              id: "membership",
              header: "Membership",
              sortValue: (d) => d.tierName,
              cell: (d) => (
                <span className="flex flex-col gap-0.5">
                  <span>{d.tierName}</span>
                  {d.outcome === "approved" ? (
                    <span className="text-xs text-muted">
                      {[d.membershipNumber, d.feeRwf !== null ? rwf(d.feeRwf) : null].filter(Boolean).join(" · ")}
                    </span>
                  ) : null}
                </span>
              ),
            },
            {
              id: "took",
              header: "Took",
              align: "end",
              sortValue: (d) => d.daysToDecide ?? -1,
              cell: (d) => (
                <span className="tabular">
                  {d.daysToDecide === null ? "—" : d.daysToDecide < 1 ? "Same day" : `${Math.round(d.daysToDecide)} d`}
                </span>
              ),
            },
            { id: "by", header: "Decided by", sortValue: (d) => d.decidedByName ?? "", cell: (d) => d.decidedByName ?? "—" },
            {
              id: "when",
              header: "When",
              align: "end",
              sortValue: (d) => d.decidedAt,
              cell: (d) => <span className="tabular">{formatDay(d.decidedAt)}</span>,
            },
          ]}
          mobile={{
            title: (d) => d.businessName,
            description: (d) => [d.tierName, formatDay(d.decidedAt)].join(" · "),
            trailing: (d) => <StatusChip tone={d.outcome === "approved" ? "success" : "danger"}>{d.outcome === "approved" ? "Approved" : "Declined"}</StatusChip>,
          }}
        />
        {page.nextCursor ? (
          <Button variant="secondary" className="self-start" onPress={() => go(q, outcome, page.nextCursor!)}>
            Older decisions
          </Button>
        ) : null}
      </SectionCard>
    </PageContent>
  );
}
