"use client";

import { Magnifier } from "@gravity-ui/icons";
import { Button, Input } from "@heroui/react";
import { DataTable, EmptyBlock, formatDay, formatNumber, PageContent, PageHeader, SectionCard, StatusChip } from "@injishi/ui";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("psfOperations.decisions");
  const router = useRouter();
  const [search, setSearch] = useState(q);
  const [exportProblem, setExportProblem] = useState<string | null>(null);
  // Every decision under this search and filter, not only the page shown (2026-11-02).
  const exportRows = async (): Promise<ExportTable | string> => {
    const res = await exportPsfDecisionsAction({ q, outcome: outcome || undefined });
    if (!res.ok) return res.error;
    return {
      filename: `psf-decisions-${kigaliToday()}`,
      title: t("title"),
      subtitle: [scope.label, outcome === "approved" ? t("approved") : outcome === "declined" ? t("declined") : t("every"), q ? `“${q}”` : null, kigaliToday()]
        .filter(Boolean)
        .join(" · "),
      sections: [
        {
          heading: [t("business"), "docID", "Business code", t("district"), t("decision"), "Now", t("membership"), "Membership number", "Fee (RWF)", "Decline reason", "Days to decide", t("decidedBy"), "Decided on"],
          rows: res.rows.map((d) => [
            d.businessName,
            d.docId,
            d.businessCode,
            d.districtName,
            d.outcome === "approved" ? t("approved") : t("declined"),
            d.outcome === "approved" ? (d.paid ? t("aMember") : t("waitingPayment")) : "",
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
        title={t("title")}
        description={t("description")}
      />

      <SectionCard
        title={outcome === "approved" ? t("approved") : outcome === "declined" ? t("declined") : t("every")}
        description={`${t("shown", { count: formatNumber(page.items.length) })}${paged ? ` ${t("page")}` : ""} · ${t("approvedCount", { count: formatNumber(approved) })} · ${t("declinedCount", { count: formatNumber(declined) })}`}
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
            aria-label={t("search")}
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-[16rem] flex-1"
          />
          <Button type="submit" variant="secondary">
            <Magnifier className="size-4" /> {t("search")}
          </Button>
        </form>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("decision")}>
          {OUTCOMES.map((o) => (
            <Button
              key={o.id || "all"}
              size="sm"
              variant={outcome === o.id ? "primary" : "ghost"}
              aria-pressed={outcome === o.id}
              onPress={() => go(search, o.id)}
            >
              {o.id === "" ? t("all") : o.id === "approved" ? t("approved") : t("declined")}
            </Button>
          ))}
        </div>
        <DataTable
          label={t("title")}
          rows={page.items}
          rowKey={(d) => d.applicationId}
          onRowAction={(d) => router.push(`/psf/${d.applicationId}`)}
          empty={
            <EmptyBlock
              size="sm"
              icon="CircleCheck"
              title={t("noMatch")}
              description={q || outcome ? t("clearSearch") : t("empty")}
            />
          }
          columns={[
            {
              id: "business",
              header: t("business"),
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
                    header: t("district"),
                    sortValue: (d: PsfDecisionsPage["items"][number]) => d.districtName ?? "",
                    cell: (d: PsfDecisionsPage["items"][number]) => d.districtName ?? "—",
                  },
                ]
              : []),
            {
              id: "decision",
              header: t("decision"),
              sortValue: (d) => d.outcome,
              cell: (d) =>
                d.outcome === "approved" ? (
                  <span className="flex flex-col items-start gap-0.5">
                    <StatusChip tone="success">{t("approved")}</StatusChip>
                    <span className="text-xs text-muted">{d.paid ? t("aMember") : t("waitingPayment")}</span>
                  </span>
                ) : (
                  <span className="flex flex-col items-start gap-0.5">
                    <StatusChip tone="danger">{t("declined")}</StatusChip>
                    {d.declineReasonLabel ? <span className="text-xs text-muted">{d.declineReasonLabel}</span> : null}
                  </span>
                ),
            },
            {
              id: "membership",
              header: t("membership"),
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
              header: t("took"),
              align: "end",
              sortValue: (d) => d.daysToDecide ?? -1,
              cell: (d) => (
                <span className="tabular">
                  {d.daysToDecide === null ? "—" : d.daysToDecide < 1 ? t("sameDay") : t("dayShort", { count: Math.round(d.daysToDecide) })}
                </span>
              ),
            },
            { id: "by", header: t("decidedBy"), sortValue: (d) => d.decidedByName ?? "", cell: (d) => d.decidedByName ?? "—" },
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
