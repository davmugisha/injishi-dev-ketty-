"use client";

/**
 * Payroll · Rules in force (058-payroll AC-PY15): the national rows a run
 * reads, PAYE, RSSB, overtime, a leaver's settlement, the leave defaults, the
 * public holidays and the declaration formats, each with the version in force
 * today and the versions before it.
 *
 * Read only, and on purpose. A rule is Rwanda's, not the business's: it
 * changes by a new version written from the accountant's sheet, never from
 * this screen, and a run records which version it computed with. On a sample
 * database every row is an invented placeholder marked DEMO SAMPLE DATA.
 */

import type { PayrollRule } from "@injishi/contracts";

import { Badge, EmptyState, LoadFailed, Skeleton } from "../../components/ui";
import { useWorkspaceId } from "../../data/capability";
import { usePayrollRules } from "../../data/payroll";
import { dshortIso, kigaliDateOf } from "../../lib/format";
import { RowList, rowClass } from "./staff-ui";

export function PayRules() {
  const workspaceId = useWorkspaceId();
  const rules = usePayrollRules(workspaceId);
  if (rules.isPending) return <Skeleton height={240} />;
  if (rules.isError) {
    return (
      <LoadFailed onRetry={() => void rules.refetch()} retrying={rules.isFetching}>
        We couldn&apos;t read the rules in force. Nothing has changed.
      </LoadFailed>
    );
  }
  return (
    <div className="pms-enter flex max-w-page flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        The national rules each pay run reads. They are not set here: each changes by a new version from the
        accountant&apos;s sheet, and every run says which versions it used.
      </p>
      <RowList>
        {rules.data.rules.map((r, i) => (
          <RuleRow key={r.configType} rule={r} index={i} />
        ))}
      </RowList>
    </div>
  );
}

function RuleRow({ rule, index }: { rule: PayrollRule; index: number }) {
  const value = rule.inForce?.value as Record<string, unknown> | undefined;
  const sample = typeof value?.note === "string" && value.note.startsWith("DEMO SAMPLE DATA");
  return (
    <div className={rowClass(index)} data-rule={rule.configType}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm font-semibold text-ink">{rule.label[0].toUpperCase() + rule.label.slice(1)}</span>
          <span className="pms-num text-2xs text-muted-foreground">{rule.configType}</span>
        </span>
        {rule.inForce ? (
          <>
            {sample && <Badge intent="warn">Sample values</Badge>}
            <Badge intent="ok">
              Version {rule.inForce.version}
              {rule.inForce.effectiveFrom ? `, from ${dshortIso(kigaliDateOf(rule.inForce.effectiveFrom))}` : ""}
            </Badge>
          </>
        ) : (
          <Badge intent="bad">None in force</Badge>
        )}
      </div>
      {rule.inForce ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-2xs font-semibold text-muted-foreground">
            What it says{rule.history.length > 1 ? `, and ${rule.history.length - 1} earlier version${rule.history.length === 2 ? "" : "s"}` : ""}
          </summary>
          <pre className="mt-2 rounded border border-line bg-panel p-3 text-2xs break-words whitespace-pre-wrap text-ink2">{JSON.stringify(rule.inForce.value, null, 2)}</pre>
          {rule.history.length > 1 && (
            <ul className="mt-2 flex flex-col gap-1 text-2xs text-muted-foreground">
              {rule.history.map((h) => (
                <li key={h.configEntryId}>
                  Version {h.version}: {h.effectiveFrom ? dshortIso(kigaliDateOf(h.effectiveFrom)) : "always"} to {h.effectiveTo ? dshortIso(kigaliDateOf(h.effectiveTo)) : "now"}
                </li>
              ))}
            </ul>
          )}
        </details>
      ) : (
        <EmptyState className="mt-2 p-3 text-2xs">
          A run that needs this rule is refused, naming it, until a row is written from the accountant&apos;s sheet.
        </EmptyState>
      )}
    </div>
  );
}
