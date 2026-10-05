"use client";

/**
 * Staff · Leave (ADR-058, AC-L1, AC-L4, AC-L5, AC-T3).
 *
 * The queue of leave requests at the branches you cover, the ones routed to
 * you first. Approving counts the days again (the roster may have moved since
 * the request) and refuses anything beyond the balance; the balance is the sum
 * of the ledger and nothing else. Approving also takes the person off their
 * shifts in the range.
 *
 * Nobody decides their own leave. The server refuses it (403), and this screen
 * says so on the row rather than offering a button that will fail.
 *
 * The queue is the shared `DataView` over `LEAVE_REQUEST_LIST`
 * (058-list-framework), with the status chips, filters and saved views, and a
 * bulk approve or refuse that runs the single decision once per request: one
 * refusal (a request already decided) is that row's result and undoes nothing.
 */

import { LEAVE_REQUEST_LIST, type LeaveRequest, type LeaveRequestStatus } from "@injishi/contracts";
import { DataView, Input, type DataColumn } from "@injishi/ui";
import { useState } from "react";

import { ActionButton, Badge, SectionHeading, SelectField } from "../../components/ui";
import { useCapability, useWorkspaceId } from "../../data/capability";
import { readListIds, runBulkAction, useListUrl, useSavedViewsFor } from "../../data/lists";
import {
  useDecideLeave,
  useEmployees,
  useLeaveBalances,
  useLeavePage,
  useRequestLeave,
  type LeaveDecision,
} from "../../data/people";
import { dshortIso, todayIso } from "../../lib/format";
import { usePms } from "../../store";
import { currentGrant } from "../../store/helpers";
import { Field, FormError, daysText, inputClass } from "./staff-ui";

const STATUS: Record<LeaveRequestStatus, { label: string; intent: "ok" | "warn" | "bad" | "neutral" }> = {
  requested: { label: "Waiting", intent: "warn" },
  approved: { label: "Approved", intent: "ok" },
  rejected: { label: "Refused", intent: "bad" },
  cancelled: { label: "Cancelled", intent: "neutral" },
};

export function Leave() {
  const { state, toast } = usePms();
  const workspaceId = useWorkspaceId();
  const { can } = useCapability();
  const decide = useDecideLeave(workspaceId);
  const [filing, setFiling] = useState(false);
  const branches = currentGrant(state)?.branches ?? [];
  const mayDecide = can("leave.approve");

  const { defaultView, savedViews } = useSavedViewsFor(workspaceId, LEAVE_REQUEST_LIST.key);
  const list = useListUrl(LEAVE_REQUEST_LIST, "basic", defaultView);
  const page = useLeavePage(workspaceId, list.state.query);

  const act = (r: LeaveRequest, decision: LeaveDecision) =>
    decide.mutate(
      { id: r.id, decision },
      {
        onSuccess: (out) =>
          toast(
            decision === "approve"
              ? `${daysText(out.days)} of ${out.leaveType.name.toLowerCase()} approved for ${out.employee.displayName}`
              : decision === "reject"
                ? `Refused ${out.employee.displayName}'s request`
                : `Cancelled ${out.employee.displayName}'s leave`,
            "ok",
          ),
      },
    );

  // Built each render: every cell reads the decision state of its own row.
  const columns: DataColumn<LeaveRequest>[] = [
      {
        key: "employee",
        header: "Person",
        cell: (r) => (
          <span className="flex flex-col gap-0.5" data-leave={r.id}>
            <span className="font-semibold text-foreground">{r.employee.displayName}</span>
            {r.reason ? <span className="text-2xs text-muted-foreground">{r.reason}</span> : null}
          </span>
        ),
      },
      { key: "leaveType", header: "Type", cell: (r) => r.leaveType.name },
      {
        key: "startsOn",
        header: "From",
        cell: (r) => (
          <span className="pms-num">
            {dshortIso(r.startsOn)}
            {r.endsOn !== r.startsOn ? ` to ${dshortIso(r.endsOn)}` : ""}
          </span>
        ),
      },
      {
        key: "days",
        header: "Days",
        align: "end",
        cell: (r) => `${daysText(r.days)}${r.status === "requested" ? " (estimated)" : ""}`,
      },
      {
        key: "status",
        header: "Status",
        cell: (r) => (
          <span className="flex flex-wrap gap-1.5">
            <Badge intent={STATUS[r.status].intent}>{STATUS[r.status].label}</Badge>
            {r.routedToMe && r.status === "requested" && <Badge intent="info">Routed to you</Badge>}
          </span>
        ),
      },
      {
        key: "actions",
        header: "",
        align: "end",
        cell: (r) => {
          const busy = decide.isPending && decide.variables?.id === r.id;
          if (!mayDecide) return null;
          if (r.status === "requested") {
            return (
              <span className="flex justify-end gap-2">
                <ActionButton pending={busy && decide.variables?.decision === "reject"} onClick={() => act(r, "reject")}>
                  Refuse
                </ActionButton>
                <ActionButton variant="primary" pending={busy && decide.variables?.decision === "approve"} onClick={() => act(r, "approve")}>
                  Approve
                </ActionButton>
              </span>
            );
          }
          if (r.status === "approved") {
            return (
              <ActionButton pending={busy} onClick={() => act(r, "cancel")}>
                Cancel leave
              </ActionButton>
            );
          }
          return null;
        },
      },
  ];

  return (
    <div className="pms-enter flex max-w-page flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex-1 text-sm text-muted-foreground">
          Days are counted on the days a person is rostered, or, where they are not, on the days that are not
          the branch&apos;s weekly days off (Monday to Friday when none are set). Public holidays and the
          business&apos;s own never count.
        </span>
        {(can("leave.approve") || can("people.manage")) && !filing && (
          <ActionButton variant="primary" onClick={() => setFiling(true)}>
            File leave for someone
          </ActionButton>
        )}
      </div>

      {filing && <FileLeave onDone={() => setFiling(false)} />}

      <section className="flex flex-col gap-3">
        <SectionHeading n={page.data?.total}>Requests</SectionHeading>
        <DataView
          spec={LEAVE_REQUEST_LIST}
          reader="basic"
          state={list.state}
          onStateChange={list.setState}
          dropped={list.dropped}
          onDismissDropped={list.dismissDropped}
          page={page.data}
          status={page.isError ? "error" : page.isPending ? "loading" : "ready"}
          onRetry={() => void page.refetch()}
          columns={columns}
          getRowId={(r) => r.id}
          labelOf={(r) => r.employee.displayName}
          groupKeyOf={leaveGroupKey}
          caption="Leave requests"
          searchPlaceholder="Search a name"
          refOptions={{ branch: branches.map((b) => ({ value: b.id, label: b.name })) }}
          bulk={
            mayDecide && workspaceId
              ? {
                  actions: [
                    { key: "approve", label: "Approve" },
                    { key: "reject", label: "Refuse", danger: true },
                  ],
                  onSelectAll: () => readListIds(workspaceId, "/ops/leave/requests", list.state.query),
                  onAction: async (key, ids) => {
                    const answer = await runBulkAction(workspaceId, "/ops/leave/requests", key, ids);
                    void page.refetch();
                    return answer;
                  },
                }
              : undefined
          }
          savedViews={savedViews}
          empty={{ title: "No leave here yet", body: "Requests filed for anyone at your branches appear here." }}
        />
        <FormError error={decide.error} />
      </section>
    </div>
  );
}

/** How the server keys each groupable field of a request. */
function leaveGroupKey(r: LeaveRequest, field: string): string | null {
  switch (field) {
    case "status":
      return r.status;
    case "leaveType":
      return r.leaveType.id;
    case "branch":
      return r.branchId;
    default:
      return null;
  }
}

function FileLeave({ onDone }: { onDone: () => void }) {
  const { toast } = usePms();
  const workspaceId = useWorkspaceId();
  const employees = useEmployees(workspaceId, "active");
  const request = useRequestLeave(workspaceId);
  const [draft, setDraft] = useState({
    employeeId: "",
    leaveTypeId: "",
    startsOn: todayIso(),
    endsOn: todayIso(),
    startHalf: "full",
    endHalf: "full",
    reason: "",
  });
  const balances = useLeaveBalances(workspaceId, draft.employeeId || null);
  const chosen = balances.data?.balances.find((b) => b.leaveType.id === draft.leaveTypeId);

  return (
    <form
      className="flex flex-col gap-4 rounded-card border border-card-bd bg-card p-5"
      onSubmit={(ev) => {
        ev.preventDefault();
        if (!draft.employeeId || !draft.leaveTypeId) return;
        request.mutate(
          {
            employeeId: draft.employeeId,
            leaveTypeId: draft.leaveTypeId,
            startsOn: draft.startsOn,
            endsOn: draft.endsOn,
            startHalf: draft.startHalf as "full" | "second_half",
            endHalf: draft.endHalf as "full" | "first_half",
            reason: draft.reason.trim() || null,
          },
          {
            onSuccess: (r) => {
              toast(`${daysText(r.days)} of leave requested for ${r.employee.displayName}`, "ok");
              onDone();
            },
          },
        );
      }}
    >
      <SectionHeading>File leave</SectionHeading>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Person">
          <SelectField
            label="Person"
            value={draft.employeeId}
            onChange={(v) => setDraft({ ...draft, employeeId: v, leaveTypeId: "" })}
            placeholder="Choose someone"
            options={(employees.data ?? []).map((e) => ({ value: e.id, label: e.displayName }))}
          />
        </Field>
        <Field
          label="Type"
          hint={
            chosen
              ? chosen.balanceDays === null
                ? "No balance is kept for this type."
                : `${daysText(chosen.balanceDays)} left.`
              : balances.isError
                ? "Leave cannot be counted until the leave rules are set up."
                : undefined
          }
        >
          <SelectField
            label="Leave type"
            value={draft.leaveTypeId}
            onChange={(v) => setDraft({ ...draft, leaveTypeId: v })}
            placeholder={draft.employeeId ? "Choose a type" : "Choose a person first"}
            disabled={!draft.employeeId}
            options={(balances.data?.balances ?? []).map((b) => ({ value: b.leaveType.id, label: b.leaveType.name }))}
          />
        </Field>
        <Field label="From" htmlFor="leave-from">
          <Input id="leave-from" required type="date" value={draft.startsOn} onChange={(e) => setDraft({ ...draft, startsOn: e.target.value, endsOn: draft.endsOn < e.target.value ? e.target.value : draft.endsOn })} className={inputClass} />
        </Field>
        <Field label="To" htmlFor="leave-to">
          <Input id="leave-to" required type="date" value={draft.endsOn} onChange={(e) => setDraft({ ...draft, endsOn: e.target.value })} className={inputClass} />
        </Field>
        <Field label="First day">
          <SelectField
            label="First day"
            value={draft.startHalf}
            onChange={(v) => setDraft({ ...draft, startHalf: v })}
            options={[
              { value: "full", label: "Whole day" },
              { value: "second_half", label: "Afternoon only" },
            ]}
          />
        </Field>
        <Field label="Last day">
          <SelectField
            label="Last day"
            value={draft.endHalf}
            onChange={(v) => setDraft({ ...draft, endHalf: v })}
            options={[
              { value: "full", label: "Whole day" },
              { value: "first_half", label: "Morning only" },
            ]}
          />
        </Field>
        <Field label="Reason" hint="Optional." htmlFor="leave-reason">
          <Input id="leave-reason" value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} className={inputClass} />
        </Field>
      </div>
      <FormError error={request.error} />
      <div className="flex justify-end gap-2">
        <ActionButton type="button" onClick={onDone}>
          Cancel
        </ActionButton>
        <ActionButton variant="primary" type="submit" pending={request.isPending}>
          {request.isPending ? "Filing" : "File leave"}
        </ActionButton>
      </div>
    </form>
  );
}
