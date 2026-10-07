"use client";

/**
 * Staff · Discipline (058-people-file AC-PF8).
 *
 * Warnings, suspensions and dismissals, recorded against people from the types
 * this business defines. Naming several people writes one record each, so
 * nobody's file shows who else was named. A dismissal offboards nobody by
 * itself; the screen offers to start it, on that person's file.
 *
 * `people.manage` alone, reads included: a warning on someone's file is not a
 * work field. The person reads their own through self service.
 */

import Link from "next/link";
import { useState } from "react";

import { ActionButton, Badge, EmptyState, LoadFailed, SectionHeading, Skeleton } from "../../components/ui";
import { useWorkspaceId } from "../../data/capability";
import { useEmployees } from "../../data/people";
import { useDiscipline } from "../../data/people-file";
import { dshortIso } from "../../lib/format";
import { workspaceBase } from "../../lib/nav";
import { DISCIPLINE_KIND, RecordDiscipline } from "./employee-records";
import { personOption } from "./hr-audience";
import { Field, PeoplePicker, RowList, rowClass } from "./staff-ui";

export function Discipline() {
  const workspaceId = useWorkspaceId();
  const records = useDiscipline(workspaceId, null);
  const people = useEmployees(workspaceId, "active");
  const [recording, setRecording] = useState(false);
  const [employeeIds, setEmployeeIds] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const base = `${workspaceBase(workspaceId)}/staff`;
  const names = new Map((people.data ?? []).map((p) => [p.id, p.displayName]));

  return (
    <div className="pms-enter flex max-w-page flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex-1 text-sm text-muted-foreground">
          Recorded against each person on their own file. The types are your business&apos;s own, under Configuration.
        </span>
        {!recording && (
          <ActionButton variant="primary" onClick={() => setRecording(true)}>
            Record an action
          </ActionButton>
        )}
      </div>

      {dismissed.length > 0 && (
        <div role="status" className="rounded-card border border-card-bd bg-warn-bg px-5 py-4 text-sm text-ink">
          A dismissal is recorded, and nobody is offboarded by it. Start offboarding from{" "}
          {dismissed.map((id, i) => (
            <span key={id}>
              {i > 0 ? ", " : ""}
              <Link href={`${base}/${id}/work#leaving`} className="font-semibold text-foreground underline">
                {names.get(id) ?? "their file"}
              </Link>
            </span>
          ))}{" "}
          when the last day is known.
        </div>
      )}

      {recording && (
        <RecordDiscipline
          employeeIds={employeeIds}
          onDone={(dismissal) => {
            setRecording(false);
            setDismissed(dismissal ? employeeIds : []);
            setEmployeeIds([]);
          }}
        >
          <Field label="Who it is for" hint="Several people get one record each.">
            <PeoplePicker
              label="People it is for"
              people={(people.data ?? []).map(personOption)}
              selected={employeeIds}
              onChange={setEmployeeIds}
            />
          </Field>
        </RecordDiscipline>
      )}

      <section>
        <SectionHeading n={records.data?.actions.length}>Records</SectionHeading>
        {records.isPending ? (
          <Skeleton height={120} />
        ) : records.isError ? (
          <LoadFailed onRetry={() => void records.refetch()} retrying={records.isFetching}>
            We couldn&apos;t load the records. Nothing on them has changed — this is on our side.
          </LoadFailed>
        ) : records.data.actions.length === 0 ? (
          <EmptyState className="mt-2.5 p-5">Nothing recorded. That is the usual state of a good team.</EmptyState>
        ) : (
          <RowList>
            {records.data.actions.map((a, i) => (
              <div key={a.id} className={`${rowClass(i)} flex flex-wrap items-center gap-3`}>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <Link href={`${base}/${a.employee.employeeId}/discipline`} className="text-sm font-semibold text-foreground no-underline hover:underline">
                    {a.employee.displayName}
                  </Link>
                  <span className="text-2xs text-muted-foreground">
                    {a.type.title} · from {dshortIso(a.startsOn)} {a.startsOn.slice(0, 4)}
                    {a.length && a.unit ? ` · ${a.length} ${a.unit}` : ""}
                  </span>
                </span>
                <Badge intent={DISCIPLINE_KIND[a.type.kind].intent}>{DISCIPLINE_KIND[a.type.kind].label}</Badge>
              </div>
            ))}
          </RowList>
        )}
      </section>
    </div>
  );
}
