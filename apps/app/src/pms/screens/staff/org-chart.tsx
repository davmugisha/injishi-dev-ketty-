"use client";

/**
 * Staff · Org chart (058-people-file AC-PF10).
 *
 * Who reports to whom, drawn from each file's reporting manager, starting from
 * the people who report to nobody. Only the people in the caller's branches;
 * someone whose manager works elsewhere is drawn at the top rather than under a
 * person the caller cannot open. Roster card fields only, so anyone who reads
 * files may draw it.
 */

import type { OrgChartNode } from "@injishi/contracts";
import Link from "next/link";
import { useMemo } from "react";

import { EmptyState, LoadFailed, Skeleton } from "../../components/ui";
import { useWorkspaceId } from "../../data/capability";
import { useOrgChart } from "../../data/people-file";
import { workspaceBase } from "../../lib/nav";
import { Avatar } from "./staff-look";

export function OrgChart() {
  const workspaceId = useWorkspaceId();
  const chart = useOrgChart(workspaceId);
  const base = `${workspaceBase(workspaceId)}/staff`;

  const { roots, reportsOf } = useMemo(() => {
    const nodes = chart.data?.nodes ?? [];
    const byManager = new Map<string, OrgChartNode[]>();
    for (const n of nodes) {
      if (!n.reportingManagerId) continue;
      const list = byManager.get(n.reportingManagerId) ?? [];
      list.push(n);
      byManager.set(n.reportingManagerId, list);
    }
    const byName = (a: OrgChartNode, b: OrgChartNode) => a.displayName.localeCompare(b.displayName);
    for (const list of byManager.values()) list.sort(byName);
    // Most reports first among the roots, so the people who run things lead.
    const tops = nodes
      .filter((n) => !n.reportingManagerId)
      .sort((a, b) => (byManager.get(b.employeeId)?.length ?? 0) - (byManager.get(a.employeeId)?.length ?? 0) || byName(a, b));
    return { roots: tops, reportsOf: byManager };
  }, [chart.data]);

  if (chart.isPending) return <Skeleton height={240} />;
  if (chart.isError) {
    return (
      <LoadFailed onRetry={() => void chart.refetch()} retrying={chart.isFetching}>
        We couldn&apos;t load the org chart. Nobody&apos;s file has changed — this is on our side.
      </LoadFailed>
    );
  }
  if (roots.length === 0) {
    return <EmptyState className="p-5">Nobody is on file yet, so there is no chart to draw.</EmptyState>;
  }

  const withReports = roots.filter((r) => (reportsOf.get(r.employeeId)?.length ?? 0) > 0);
  const alone = roots.filter((r) => (reportsOf.get(r.employeeId)?.length ?? 0) === 0);

  return (
    <div className="pms-enter flex max-w-page flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        Set who someone reports to on the Work tab of their file. {alone.length > 0 ? `${alone.length} ${alone.length === 1 ? "person reports" : "people report"} to nobody yet.` : ""}
      </p>
      {withReports.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-3 p-0" aria-label="Who reports to whom">
          {withReports.map((root) => (
            <li key={root.employeeId} className="rounded-card border border-card-bd bg-card p-4">
              <Branch node={root} reportsOf={reportsOf} base={base} depth={0} />
            </li>
          ))}
        </ul>
      )}
      {alone.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-2xs font-bold tracking-[0.09em] uppercase text-[var(--muted2)]">Reports to nobody yet</h2>
          <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {alone.map((n) => (
              <li key={n.employeeId} className="rounded-card border border-card-bd bg-card px-3 py-2.5">
                <Person node={n} base={base} reports={0} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Person({ node, base, reports }: { node: OrgChartNode; base: string; reports: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <Avatar name={node.displayName} size={32} />
      <span className="flex min-w-0 flex-col">
        <Link href={`${base}/${node.employeeId}`} className="text-sm font-semibold text-foreground no-underline hover:underline">
          {node.displayName}
        </Link>
        <span className="text-2xs text-muted-foreground">
          {[node.jobPositionTitle ?? "No position yet", reports > 0 ? `${reports} report${reports === 1 ? "" : "s"}` : null]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
    </span>
  );
}

/** A person and everyone under them. A loop cannot be drawn twice: the server refuses one, and depth is capped anyway. */
function Branch({
  node,
  reportsOf,
  base,
  depth,
}: {
  node: OrgChartNode;
  reportsOf: Map<string, OrgChartNode[]>;
  base: string;
  depth: number;
}) {
  const reports = depth < 12 ? (reportsOf.get(node.employeeId) ?? []) : [];
  return (
    <div className="flex flex-col gap-2">
      <Person node={node} base={base} reports={reportsOf.get(node.employeeId)?.length ?? 0} />
      {reports.length > 0 && (
        <ul className="m-0 ml-4 flex list-none flex-col gap-2 border-l border-line pl-4">
          {reports.map((r) => (
            <li key={r.employeeId}>
              <Branch node={r} reportsOf={reportsOf} base={base} depth={depth + 1} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
