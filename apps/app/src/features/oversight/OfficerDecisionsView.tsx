"use client";

import { type DataColumn, DataTable, DateText, EmptyBlock, PageContent, StatusChip } from "@injishi/ui";

import { AreaHeader } from "@/components/shell/WorkspaceNav";

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
  const columns: DataColumn<OfficerDecisionRow>[] = [
    {
      id: "when",
      header: "Decided",
      sortValue: (r) => r.decidedAt,
      cell: (r) => <DateText value={r.decidedAt.slice(0, 10)} />,
    },
    { id: "business", header: "Business", isRowHeader: true, sortValue: (r) => r.business, cell: (r) => r.business },
    { id: "gate", header: "Stage", sortValue: (r) => r.gate, cell: (r) => r.gate },
    {
      id: "outcome",
      header: "Outcome",
      sortValue: (r) => (r.passed ? 1 : 0),
      cell: (r) => <StatusChip tone={r.passed ? "success" : "danger"}>{r.passed ? "Passed" : "Rejected"}</StatusChip>,
    },
    {
      id: "note",
      header: "Reason or note",
      hideBelow: "lg",
      cell: (r) => <span className="line-clamp-2 text-sm text-muted">{r.reason ?? r.notes ?? "-"}</span>,
    },
  ];
  return (
    <PageContent>
      <AreaHeader />
      <DataTable
        label="Decisions"
        noun={{ one: "decision", many: "decisions" }}
        rows={rows}
        rowKey={(r) => r.id}
        columns={columns}
        defaultSort={{ column: "when", direction: "descending" }}
        search={{ placeholder: "Business", text: (r) => r.business }}
        filters={[
          {
            id: "outcome",
            name: "Outcome",
            options: [
              { id: "all", label: "All" },
              { id: "passed", label: "Passed" },
              { id: "rejected", label: "Rejected" },
            ],
            match: (r, v) => (v === "passed") === r.passed,
          },
        ]}
        mobile={{
          title: (r) => r.business,
          description: (r) => `${r.gate} · ${r.decidedAt.slice(0, 10)}`,
          trailing: (r) => (
            <StatusChip tone={r.passed ? "success" : "danger"}>{r.passed ? "Passed" : "Rejected"}</StatusChip>
          ),
        }}
        empty={<EmptyBlock icon="FileCheck" title="No decisions yet" />}
      />
    </PageContent>
  );
}
