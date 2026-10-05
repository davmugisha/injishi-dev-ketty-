"use client";

/**
 * Leave · Extra days (058-leave AC-LV8).
 *
 * Asks for more days, in a queue like the leave requests: extra days on a type
 * with a reason, or the days in lieu a worked weekly day off or holiday earns.
 * The server counts those (a whole day from the branch's compensation
 * threshold, half from half of it), so the form names the day worked and
 * nothing more. Approving writes one lot of days; a day in lieu lands in the
 * type marked compensatory, lives that type's months, and its overtime stops
 * counting, so the day is paid once. Nobody decides their own.
 */

import {
  LEAVE_ALLOCATION_LIST,
  type LeaveAllocationRequest,
  type LeaveAllocationStatus,
} from "@injishi/contracts";
import { DataView, Input, type DataColumn } from "@injishi/ui";
import { useState } from "react";

import { ActionButton, Badge, SectionHeading, SelectField } from "../../components/ui";
import { useCapability, useWorkspaceId } from "../../data/capability";
import { useDecideAllocation, useLeaveAllocationPage, useLeaveTypes, useRequestAllocation } from "../../data/leave";
import { readListIds, runBulkAction, useListUrl, useSavedViewsFor } from "../../data/lists";
import { useAttendancePage, useEmployees } from "../../data/people";
import { addDaysIso, dshortIso, todayIso } from "../../lib/format";
import { usePms } from "../../store";
import { currentGrant } from "../../store/helpers";
import { Field, FormError, daysText, hoursText, inputClass } from "./staff-ui";

const STATUS: Record<LeaveAllocationStatus, { label: string; intent: "ok" | "warn" | "bad" | "neutral" }> = {
  requested: { label: "Waiting", intent: "warn" },
  approved: { label: "Approved", intent: "ok" },
  rejected: { label: "Refused", intent: "bad" },
  cancelled: { label: "Withdrawn", intent: "neutral" },
};

export function LeaveAllocations() {
  const { state, toast } = usePms();
  const workspaceId = useWorkspaceId();
  const { can } = useCapability();
  const decide = useDecideAllocation(workspaceId);
  const [asking, setAsking] = useState(false);
  const branches = currentGrant(state)?.branches ?? [];
  const types = useLeaveTypes(workspaceId);
  const mayDecide = can("leave.approve");

  const { defaultView, savedViews } = useSavedViewsFor(workspaceId, LEAVE_ALLOCATION_LIST.key);
  const list = useListUrl(LEAVE_ALLOCATION_LIST, "basic", defaultView);
  const page = useLeaveAllocationPage(workspaceId, list.state.query);

  const act = (r: LeaveAllocationRequest, decision: "approve" | "reject") =>
    decide.mutate(
      { id: r.id, decision },
      {
        onSuccess: (out) =>
          toast(
            decision === "approve"
              ? `${daysText(out.days)} of ${out.leaveType.name.toLowerCase()} added for ${out.employee.displayName}`
              : `Refused ${out.employee.displayName}'s ask`,
            "ok",
          ),
      },
    );

  const columns: DataColumn<LeaveAllocationRequest>[] = [
    {
      key: "employee",
      header: "Person",
      cell: (r) => (
        <span className="flex flex-col gap-0.5" data-allocation={r.id}>
          <span className="font-semibold text-foreground">{r.employee.displayName}</span>
          <span className="text-2xs text-muted-foreground">{r.reason}</span>
        </span>
      ),
    },
    {
      key: "kind",
      header: "For",
      cell: (r) => (r.kind === "compensatory" && r.workDate ? `Worked ${dshortIso(r.workDate)}` : "Extra days"),
    },
    { key: "leaveType", header: "Type", cell: (r) => r.leaveType.name },
    { key: "days", header: "Days", align: "end", cell: (r) => daysText(r.days) },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <span className="flex flex-col gap-1">
          <span className="flex flex-wrap gap-1.5">
            <Badge intent={STATUS[r.status].intent}>{STATUS[r.status].label}</Badge>
            {r.routedToMe && r.status === "requested" && <Badge intent="info">Routed to you</Badge>}
          </span>
          {r.decidedByName && <span className="text-2xs text-muted-foreground">By {r.decidedByName}</span>}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "end",
      cell: (r) => {
        if (!mayDecide || r.status !== "requested") return null;
        const busy = decide.isPending && decide.variables?.id === r.id;
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
      },
    },
  ];

  return (
    <div className="pms-enter flex max-w-page flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex-1 text-sm text-muted-foreground">
          Extra days add to a type&apos;s balance. A weekly day off or a holiday worked earns days in lieu: a whole day
          from the branch&apos;s threshold in Time settings, half a day from half of it. Each date is compensated once.
        </span>
        {(can("leave.approve") || can("people.manage")) && !asking && (
          <ActionButton variant="primary" onClick={() => setAsking(true)}>
            Ask for days
          </ActionButton>
        )}
      </div>

      {asking && <AskForDays onDone={() => setAsking(false)} />}

      <section className="flex flex-col gap-3">
        <SectionHeading n={page.data?.total}>Asks for days</SectionHeading>
        <DataView
          spec={LEAVE_ALLOCATION_LIST}
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
          groupKeyOf={allocationGroupKey}
          caption="Asks for extra and compensatory days"
          searchPlaceholder="Search a name"
          refOptions={{
            branch: branches.map((b) => ({ value: b.id, label: b.name })),
            leaveType: (types.data ?? []).map((t) => ({ value: t.id, label: t.name })),
          }}
          bulk={
            mayDecide && workspaceId
              ? {
                  actions: [
                    { key: "approve", label: "Approve" },
                    { key: "reject", label: "Refuse", danger: true },
                  ],
                  onSelectAll: () => readListIds(workspaceId, "/ops/leave/allocation-requests", list.state.query),
                  onAction: async (key, ids) => {
                    const answer = await runBulkAction(workspaceId, "/ops/leave/allocation-requests", key, ids);
                    void page.refetch();
                    return answer;
                  },
                }
              : undefined
          }
          savedViews={savedViews}
          empty={{ title: "No asks yet", body: "Asks for extra days or days in lieu appear here." }}
        />
        <FormError error={decide.error} />
      </section>
    </div>
  );
}

function allocationGroupKey(r: LeaveAllocationRequest, field: string): string | null {
  switch (field) {
    case "status":
      return r.status;
    case "kind":
      return r.kind;
    case "leaveType":
      return r.leaveType.id;
    case "branch":
      return r.branchId;
    default:
      return null;
  }
}

function AskForDays({ onDone }: { onDone: () => void }) {
  const { toast } = usePms();
  const workspaceId = useWorkspaceId();
  const employees = useEmployees(workspaceId, "active");
  const types = useLeaveTypes(workspaceId);
  const ask = useRequestAllocation(workspaceId);
  const [kind, setKind] = useState<"extra" | "compensatory">("extra");
  const [draft, setDraft] = useState({ employeeId: "", leaveTypeId: "", days: "1", reason: "", attendanceRecordId: "" });
  const person = (employees.data ?? []).find((e) => e.id === draft.employeeId);
  // The person's closed, validated records of the last 90 days; the server
  // says which earn days, the list only offers the ones on a day off or a holiday.
  const records = useAttendancePage(workspaceId, {
    q: person?.displayName ?? "",
    filters: [
      { field: "status", op: "eq", value: "closed" },
      { field: "validated", op: "eq", value: true },
      { field: "workDate", op: "gte", value: addDaysIso(todayIso(), -90) },
    ],
    sort: [{ field: "clockInAt", dir: "desc" }],
    page: 1,
    pageSize: 100,
  });
  const worked = (records.data?.items ?? []).filter(
    (r) => r.employee.employeeId === draft.employeeId && (r.figures?.dayKind === "weekly_off" || r.figures?.dayKind === "public_holiday"),
  );
  const balanceTypes = (types.data ?? []).filter((t) => t.status === "active" && t.yearlyEntitlementDays !== null);

  return (
    <form
      className="flex flex-col gap-4 rounded-card border border-card-bd bg-card p-5"
      onSubmit={(ev) => {
        ev.preventDefault();
        if (!draft.employeeId) return;
        const reason = draft.reason.trim();
        ask.mutate(
          kind === "extra"
            ? { kind, employeeId: draft.employeeId, leaveTypeId: draft.leaveTypeId, days: Number(draft.days), reason }
            : { kind, employeeId: draft.employeeId, attendanceRecordId: draft.attendanceRecordId, reason },
          {
            onSuccess: (r) => {
              toast(`${daysText(r.days)} asked for ${r.employee.displayName}`, "ok");
              onDone();
            },
          },
        );
      }}
    >
      <SectionHeading>Ask for days</SectionHeading>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Person">
          <SelectField
            label="Person"
            value={draft.employeeId}
            onChange={(v) => setDraft({ ...draft, employeeId: v, attendanceRecordId: "" })}
            placeholder="Choose someone"
            options={(employees.data ?? []).map((e) => ({ value: e.id, label: e.displayName }))}
          />
        </Field>
        <Field label="For">
          <SelectField
            label="What the days are for"
            value={kind}
            onChange={(v) => setKind(v === "compensatory" ? "compensatory" : "extra")}
            options={[
              { value: "extra", label: "Extra days on a type" },
              { value: "compensatory", label: "A day off or holiday worked" },
            ]}
          />
        </Field>
        {kind === "extra" ? (
          <>
            <Field label="Type">
              <SelectField
                label="Leave type"
                value={draft.leaveTypeId}
                onChange={(v) => setDraft({ ...draft, leaveTypeId: v })}
                placeholder="Choose a type"
                options={balanceTypes.map((t) => ({ value: t.id, label: t.name }))}
              />
            </Field>
            <Field label="Days" hint="Whole or half days." htmlFor="alloc-days">
              <Input
                id="alloc-days"
                type="number"
                min={0.5}
                step={0.5}
                max={366}
                required
                value={draft.days}
                onChange={(e) => setDraft({ ...draft, days: e.target.value })}
                className={inputClass}
              />
            </Field>
          </>
        ) : (
          <Field
            label="Day worked"
            hint={
              draft.employeeId && !records.isPending && worked.length === 0
                ? "No closed, validated record on a day off or a holiday in the last 90 days."
                : "The server counts the days from the minutes worked."
            }
          >
            <SelectField
              label="Day worked"
              value={draft.attendanceRecordId}
              onChange={(v) => setDraft({ ...draft, attendanceRecordId: v })}
              placeholder={draft.employeeId ? (records.isPlaceholderData || records.isPending ? "Reading their days" : "Choose the day") : "Choose a person first"}
              disabled={!draft.employeeId || records.isPending || records.isPlaceholderData}
              options={worked.map((r) => ({
                value: r.id,
                label: `${dshortIso(r.workDate)} · ${r.figures?.dayKind === "public_holiday" ? "holiday" : "day off"} · ${hoursText(r.figures?.workedMinutes ?? 0)}`,
              }))}
            />
          </Field>
        )}
        <Field label="Reason" htmlFor="alloc-reason">
          <Input
            id="alloc-reason"
            required
            minLength={3}
            value={draft.reason}
            onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
            className={inputClass}
          />
        </Field>
      </div>
      <FormError error={ask.error} />
      <div className="flex justify-end gap-2">
        <ActionButton type="button" onClick={onDone}>
          Cancel
        </ActionButton>
        <ActionButton variant="primary" type="submit" pending={ask.isPending}>
          {ask.isPending ? "Asking" : "Ask"}
        </ActionButton>
      </div>
    </form>
  );
}
