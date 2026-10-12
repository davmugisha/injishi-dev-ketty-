"use client";

/**
 * Leave · Balances (058-leave AC-LV13): everybody at your branches, a figure
 * per type, each the sum of that person's ledger. "Details" on a person
 * shows what stands behind each figure: the lots still holding days, when each stops
 * being usable, and every ledger row. Read only; days change through a request,
 * an ask for days, or the daily job.
 */

import { LEAVE_BALANCE_LIST, type LeaveBalanceRow } from "@injishi/contracts";
import { DataView, type DataColumn } from "@injishi/ui";
import { useEffect, useRef, useState } from "react";

import { ActionButton, LoadFailed, SectionHeading, Skeleton } from "../../components/ui";
import { useWorkspaceId } from "../../data/capability";
import { useLeaveBalancePage, useLeaveTypes } from "../../data/leave";
import { useListUrl, useSavedViewsFor } from "../../data/lists";
import { useLeaveBalances } from "../../data/people";
import { useHrCatalog } from "../../data/people-file";
import { usePms } from "../../store";
import { currentGrant } from "../../store/helpers";
import { BalanceDetail } from "./leave-ui";
import { Avatar, FACE, WITH_FACE } from "./staff-look";
import { RowList, daysText, rowClass } from "./staff-ui";

export function LeaveBalancesSection() {
  const { state } = usePms();
  const workspaceId = useWorkspaceId();
  const branches = currentGrant(state)?.branches ?? [];
  const types = useLeaveTypes(workspaceId);
  const positions = useHrCatalog(workspaceId, "job-positions");
  const [open, setOpen] = useState<{ id: string; name: string } | null>(null);

  const { defaultView, savedViews } = useSavedViewsFor(workspaceId, LEAVE_BALANCE_LIST.key);
  const list = useListUrl(LEAVE_BALANCE_LIST, "basic", defaultView);
  const page = useLeaveBalancePage(workspaceId, list.state.query);
  // A column per active type that keeps a balance; the rest have no figure to show.
  const shown = (types.data ?? []).filter((t) => t.status === "active" && t.yearlyEntitlementDays !== null);

  const columns: DataColumn<LeaveBalanceRow>[] = [
    {
      key: "employee",
      header: "Person",
      wrap: true,
      cell: (r) => (
        <span className={`${WITH_FACE}`} data-balance-row={r.employee.employeeId}>
          <Avatar name={r.employee.displayName} className={FACE} />
          <span className="font-semibold whitespace-nowrap text-foreground">{r.employee.displayName}</span>
          {r.employee.jobPositionTitle ? <span className="text-2xs text-muted-foreground">{r.employee.jobPositionTitle}</span> : null}
        </span>
      ),
    },
    ...shown.map(
      (t): DataColumn<LeaveBalanceRow> => ({
        key: `type:${t.id}`,
        // A column a type: on a page that is all leave, "Annual" says "Annual leave" in half the width.
        header: t.name.replace(/\s+leave$/i, "") || t.name,
        align: "end",
        cell: (r) => {
          const days = r.balances.find((b) => b.leaveTypeId === t.id)?.days;
          // The number alone: six columns of "12.5 days" are wider than a small laptop.
          return (
            <span className="pms-num" title={days === null || days === undefined ? undefined : daysText(days)}>
              {days === null || days === undefined ? "" : Number.isInteger(days) ? days : days.toFixed(1)}
            </span>
          );
        },
      }),
    ),
    {
      key: "actions",
      header: "",
      align: "end",
      cell: (r) => (
        <ActionButton
          onClick={() =>
            setOpen(open?.id === r.employee.employeeId ? null : { id: r.employee.employeeId, name: r.employee.displayName })
          }
        >
          {open?.id === r.employee.employeeId ? "Hide" : "Details"}
        </ActionButton>
      ),
    },
  ];

  return (
    <div className="pms-enter flex max-w-page flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Each figure is a number of days: the sum of the person&apos;s ledger, caught up to today. What they earned,
        carried and were given, less what they took, what was paid out and what expired.
      </p>
      <section className="flex flex-col gap-3">
        <SectionHeading n={page.data?.total}>Balances</SectionHeading>
        <DataView
          spec={LEAVE_BALANCE_LIST}
          reader="basic"
          state={list.state}
          onStateChange={list.setState}
          dropped={list.dropped}
          onDismissDropped={list.dismissDropped}
          page={page.data}
          status={page.isError ? "error" : page.isPending ? "loading" : "ready"}
          onRetry={() => void page.refetch()}
          columns={columns}
          getRowId={(r) => r.employee.employeeId}
          labelOf={(r) => r.employee.displayName}
          groupKeyOf={(r, field) => (field === "branch" ? r.branchId : field === "jobPosition" ? r.jobPositionId : null)}
          caption="Leave balances"
          searchPlaceholder="Search a name"
          refOptions={{
            branch: branches.map((b) => ({ value: b.id, label: b.name })),
            jobPosition: (positions.data?.items ?? []).map((p) => ({ value: p.id, label: p.title })),
          }}
          savedViews={savedViews}
          empty={{ title: "Nobody here yet", body: "People with a file at your branches appear here." }}
        />
      </section>
      {open && <PersonLedger employeeId={open.id} name={open.name} />}
    </div>
  );
}

function PersonLedger({ employeeId, name }: { employeeId: string; name: string }) {
  const workspaceId = useWorkspaceId();
  const query = useLeaveBalances(workspaceId, employeeId);
  // It opens under the table, which on a full page is below the fold: bring it into view.
  const section = useRef<HTMLElement>(null);
  useEffect(() => {
    section.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [employeeId, query.isPending]);
  return (
    <section ref={section} aria-label={`${name}: leave`} className="flex scroll-mb-6 flex-col gap-2">
      <SectionHeading>{name}</SectionHeading>
      {query.isPending ? (
        <Skeleton height={120} />
      ) : query.isError ? (
        <LoadFailed onRetry={() => void query.refetch()} retrying={query.isFetching}>
          We couldn&apos;t load {name}&apos;s leave.
        </LoadFailed>
      ) : (
        <RowList>
          {query.data.balances.map((b, i) => (
            <div key={b.leaveType.id} className={rowClass(i)}>
              <BalanceDetail balance={b} />
            </div>
          ))}
        </RowList>
      )}
    </section>
  );
}
