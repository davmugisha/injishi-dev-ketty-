"use client";

import { type DataColumn, DataTable, DateText, EmptyBlock, PageContent, StatusChip } from "@injishi/ui";

import { AreaHeader } from "@/components/shell/WorkspaceNav";
import { useTranslations } from "next-intl";

export interface OfficerDecisionRow {
  id: string;
  orgId: string;
  business: string;
  /** "Field verification" or "Approval". */
  gate: string;
  passed: boolean;
  reason: string | null;
  notes: string | null;
  decidedAt: string;
}

/** The decisions this officer made or that were routed to them, newest first, in one table. */
export function OfficerDecisionsView({ rows }: { rows: OfficerDecisionRow[] }) {
  const t = useTranslations("officialDecisions");
  const columns: DataColumn<OfficerDecisionRow>[] = [
    {
      id: "when",
      header: t("decided"),
      sortValue: (r) => r.decidedAt,
      cell: (r) => <DateText value={r.decidedAt.slice(0, 10)} />,
    },
    { id: "business", header: t("business"), isRowHeader: true, sortValue: (r) => r.business, cell: (r) => r.business },
    { id: "gate", header: t("stage"), sortValue: (r) => r.gate, cell: (r) => r.gate },
    {
      id: "outcome",
      header: t("outcome"),
      sortValue: (r) => (r.passed ? 1 : 0),
      cell: (r) => <StatusChip tone={r.passed ? "success" : "danger"}>{r.passed ? t("passed") : t("rejected")}</StatusChip>,
    },
    {
      id: "note",
      header: t("reasonOrNote"),
      hideBelow: "lg",
      cell: (r) => <span className="line-clamp-2 text-sm text-muted">{r.reason ?? r.notes ?? "-"}</span>,
    },
  ];
  return (
    <PageContent>
      <AreaHeader />
      <DataTable
        label={t("decisions")}
        noun={{ one: t("decision"), many: t("decisionsLower") }}
        rows={rows}
        rowKey={(r) => r.id}
        columns={columns}
        defaultSort={{ column: "when", direction: "descending" }}
        search={{ placeholder: t("business"), text: (r) => r.business }}
        filters={[
          {
            id: "outcome",
            name: t("outcome"),
            options: [
              { id: "all", label: t("all") },
              { id: "passed", label: t("passed") },
              { id: "rejected", label: t("rejected") },
            ],
            match: (r, v) => (v === "passed") === r.passed,
          },
        ]}
        mobile={{
          title: (r) => r.business,
          description: (r) => `${r.gate} · ${r.decidedAt.slice(0, 10)}`,
          trailing: (r) => (
            <StatusChip tone={r.passed ? "success" : "danger"}>{r.passed ? t("passed") : t("rejected")}</StatusChip>
          ),
        }}
        empty={<EmptyBlock icon="FileCheck" title={t("empty")} />}
      />
    </PageContent>
  );
}
