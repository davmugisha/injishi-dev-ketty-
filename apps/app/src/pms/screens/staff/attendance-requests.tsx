"use client";

/**
 * Staff · Attendance requests (ADR-058, 058-time AC-TM6).
 *
 * A missed or wrong clock in, asked to be put right: by the person in self
 * service, or by the desk on the Attendance lens. Approving writes the record
 * in the same step, validated, as a supervisor's, with a note naming the
 * request: a new one for a missed day, or a correction that supersedes the old
 * one. A day in a month whose pay is confirmed is refused; that is a pay
 * adjustment now. Nobody decides their own.
 *
 * Its own lens rather than a second list on Attendance, because a list keeps
 * its state in the address, and two lists on one page would share it.
 */

import { ATTENDANCE_REQUEST_LIST, type AttendanceRequest, type AttendanceRequestStatus } from "@injishi/contracts";
import { DataView, type DataColumn } from "@injishi/ui";

import { ActionButton, Badge, SectionHeading } from "../../components/ui";
import { useWorkspaceId } from "../../data/capability";
import { readListIds, runBulkAction, useListUrl, useSavedViewsFor } from "../../data/lists";
import { useAttendanceRequestPage, useDecideAttendanceRequest } from "../../data/time";
import { dshortIso } from "../../lib/format";
import { usePms } from "../../store";
import { currentGrant } from "../../store/helpers";
import { Avatar, FACE, WITH_FACE } from "./staff-look";
import { FormError, clock } from "./staff-ui";

const STATUS: Record<AttendanceRequestStatus, { label: string; intent: "ok" | "warn" | "bad" | "neutral" }> = {
  requested: { label: "Waiting", intent: "warn" },
  approved: { label: "Approved", intent: "ok" },
  rejected: { label: "Refused", intent: "bad" },
  cancelled: { label: "Withdrawn", intent: "neutral" },
};

export function AttendanceRequests() {
  const { state, toast } = usePms();
  const workspaceId = useWorkspaceId();
  const decide = useDecideAttendanceRequest(workspaceId);
  const branches = currentGrant(state)?.branches ?? [];
  const { defaultView, savedViews } = useSavedViewsFor(workspaceId, ATTENDANCE_REQUEST_LIST.key);
  const list = useListUrl(ATTENDANCE_REQUEST_LIST, "basic", defaultView);
  const page = useAttendanceRequestPage(workspaceId, list.state.query);

  const act = (r: AttendanceRequest, decision: "approve" | "reject") =>
    decide.mutate(
      { id: r.id, decision },
      {
        onSuccess: (out) =>
          toast(
            decision === "approve"
              ? `${out.employee.displayName}'s ${dshortIso(out.workDate)} is on record, validated`
              : `Refused ${out.employee.displayName}'s request`,
            "ok",
          ),
      },
    );

  const columns: DataColumn<AttendanceRequest>[] = [
    {
      key: "employee",
      header: "Person",
      cell: (r) => (
        <span className={`${WITH_FACE}`} data-attendance-request={r.id}>
          <Avatar name={r.employee.displayName} className={FACE} />
          <span className="font-semibold whitespace-nowrap text-foreground">{r.employee.displayName}</span>
          <span className="text-2xs text-muted-foreground">{r.reason}</span>
        </span>
      ),
    },
    { key: "workDate", header: "Day", cell: (r) => <span className="pms-num">{dshortIso(r.workDate)}</span> },
    {
      key: "times",
      header: "Asks for",
      cell: (r) => (
        <span className="flex flex-col gap-0.5">
          <span className="pms-num">
            {clock(r.clockInAt)}–{clock(r.clockOutAt)}
          </span>
          <span className="text-2xs text-muted-foreground">{r.recordId ? "in place of a record" : "a missed day"}</span>
        </span>
      ),
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
      cell: (r) =>
        r.status === "requested" ? (
          <span className="flex justify-end gap-2">
            <ActionButton pending={decide.isPending && decide.variables?.id === r.id && decide.variables?.decision === "reject"} onClick={() => act(r, "reject")}>
              Refuse
            </ActionButton>
            <ActionButton
              variant="primary"
              pending={decide.isPending && decide.variables?.id === r.id && decide.variables?.decision === "approve"}
              onClick={() => act(r, "approve")}
            >
              Approve
            </ActionButton>
          </span>
        ) : null,
    },
  ];

  return (
    <div className="pms-enter flex max-w-page flex-col gap-4">
      <span className="text-sm text-muted-foreground">
        Approving writes the record, validated. A day in a month whose pay is confirmed cannot change: that is a pay
        adjustment.
      </span>
      <section className="flex flex-col gap-3">
        <SectionHeading n={page.data?.total}>Requests</SectionHeading>
        <DataView
          spec={ATTENDANCE_REQUEST_LIST}
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
          groupKeyOf={(r, field) => (field === "status" ? r.status : field === "workDate" ? r.workDate : field === "branch" ? r.branchId : null)}
          caption="Attendance requests"
          searchPlaceholder="Search a name"
          refOptions={{ branch: branches.map((b) => ({ value: b.id, label: b.name })) }}
          bulk={
            workspaceId
              ? {
                  actions: [
                    { key: "approve", label: "Approve" },
                    { key: "reject", label: "Refuse", danger: true },
                  ],
                  onSelectAll: () => readListIds(workspaceId, "/ops/attendance-requests", list.state.query),
                  onAction: async (key, ids) => {
                    const answer = await runBulkAction(workspaceId, "/ops/attendance-requests", key, ids);
                    void page.refetch();
                    return answer;
                  },
                }
              : undefined
          }
          savedViews={savedViews}
          empty={{ title: "No attendance requests", body: "Missed or wrong clock ins asked to be put right appear here." }}
        />
        <FormError error={decide.error} />
      </section>
    </div>
  );
}
