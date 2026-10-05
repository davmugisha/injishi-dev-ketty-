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
 */

import type { LeaveRequest, LeaveRequestStatus } from "@injishi/contracts";
import { Input } from "@injishi/ui";
import { useState } from "react";

import {
  ActionButton,
  Badge,
  Chip,
  EmptyState,
  LoadFailed,
  SectionHeading,
  SelectField,
  Skeleton,
} from "../../components/ui";
import { useCapability, useWorkspaceId } from "../../data/capability";
import {
  useDecideLeave,
  useEmployees,
  useLeaveBalances,
  useLeaveRequests,
  useRequestLeave,
  type LeaveDecision,
} from "../../data/people";
import { dshortIso, todayIso } from "../../lib/format";
import { usePms } from "../../store";
import { Field, FormError, RowList, daysText, inputClass, rowClass } from "./staff-ui";

const STATUS: Record<LeaveRequestStatus, { label: string; intent: "ok" | "warn" | "bad" | "neutral" }> = {
  requested: { label: "Waiting", intent: "warn" },
  approved: { label: "Approved", intent: "ok" },
  rejected: { label: "Refused", intent: "bad" },
  cancelled: { label: "Cancelled", intent: "neutral" },
};

export function Leave() {
  const { toast } = usePms();
  const workspaceId = useWorkspaceId();
  const { can } = useCapability();
  const [filter, setFilter] = useState<LeaveRequestStatus | "all">("requested");
  const queue = useLeaveRequests(workspaceId);
  const decide = useDecideLeave(workspaceId);
  const [filing, setFiling] = useState(false);

  if (queue.isPending) {
    return (
      <div className="pms-enter flex max-w-wide flex-col gap-4">
        <Skeleton height={40} />
        <Skeleton height={200} delay={60} />
      </div>
    );
  }
  if (queue.isError) {
    return (
      <LoadFailed onRetry={() => void queue.refetch()} retrying={queue.isFetching}>
        We couldn&apos;t load leave requests. Nothing has been decided or changed — this is on our side.
      </LoadFailed>
    );
  }

  const all = queue.data.requests;
  const shown = filter === "all" ? all : all.filter((r) => r.status === filter);
  const count = (s: LeaveRequestStatus) => all.filter((r) => r.status === s).length;

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

  return (
    <div className="pms-enter flex max-w-wide flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex-1 text-sm text-muted-foreground">
          Days are counted on the days a person is rostered, or Monday to Friday where they are not;
          public holidays never count.
        </span>
        {(can("leave.approve") || can("people.manage")) && !filing && (
          <ActionButton variant="primary" onClick={() => setFiling(true)}>
            File leave for someone
          </ActionButton>
        )}
      </div>

      {filing && <FileLeave onDone={() => setFiling(false)} />}

      <div className="flex flex-wrap gap-2">
        <Chip active={filter === "requested"} onClick={() => setFilter("requested")} n={count("requested")} label="Waiting" />
        <Chip active={filter === "approved"} onClick={() => setFilter("approved")} n={count("approved")} label="Approved" />
        <Chip active={filter === "all"} onClick={() => setFilter("all")} n={all.length} label="All" />
      </div>

      <section>
        <SectionHeading n={shown.length}>Requests</SectionHeading>
        {shown.length === 0 ? (
          <EmptyState className="mt-2.5 p-6">
            {filter === "requested" ? "Nothing is waiting for a decision." : "No leave here yet."}
          </EmptyState>
        ) : (
          <RowList>
            {shown.map((r, i) => {
              const busy = decide.isPending && decide.variables?.id === r.id;
              return (
                <div key={r.id} data-leave={r.id} className={`${rowClass(i)} flex flex-wrap items-center gap-3`}>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-semibold text-ink">{r.employee.displayName}</span>
                    <span className="pms-num truncate text-2xs text-muted-foreground">
                      {r.leaveType.name} · {dshortIso(r.startsOn)}
                      {r.endsOn !== r.startsOn ? ` to ${dshortIso(r.endsOn)}` : ""} · {daysText(r.days)}
                      {r.status === "requested" ? " (estimated)" : ""}
                      {r.reason ? ` · ${r.reason}` : ""}
                    </span>
                  </span>
                  {r.routedToMe && r.status === "requested" && <Badge intent="info">Routed to you</Badge>}
                  <Badge intent={STATUS[r.status].intent}>{STATUS[r.status].label}</Badge>
                  {r.status === "requested" && can("leave.approve") && (
                    <>
                      <ActionButton pending={busy && decide.variables?.decision === "reject"} onClick={() => act(r, "reject")}>
                        Refuse
                      </ActionButton>
                      <ActionButton
                        variant="primary"
                        pending={busy && decide.variables?.decision === "approve"}
                        onClick={() => act(r, "approve")}
                      >
                        Approve
                      </ActionButton>
                    </>
                  )}
                  {r.status === "approved" && can("leave.approve") && (
                    <ActionButton pending={busy} onClick={() => act(r, "cancel")}>
                      Cancel leave
                    </ActionButton>
                  )}
                </div>
              );
            })}
          </RowList>
        )}
        <FormError error={decide.error} />
      </section>
    </div>
  );
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
