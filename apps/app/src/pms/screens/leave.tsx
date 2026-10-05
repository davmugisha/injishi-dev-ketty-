"use client";

/**
 * Leave requests and per-type settings (HR module, Phase 4). A type's
 * settings (unpaid, carry-forward, applicable-after-days) are workspace
 * configuration, not per-request — the server enforces applicable-after
 * on submission; carry-forward is stored for now but not yet auto-applied
 * (that needs a scheduled job, future work — see also the payroll
 * discussion for how an unpaid leave type should eventually dock pay).
 */

import { useState } from "react";

import { ActionButton, Badge, EmptyState, LoadFailed, SectionHeading, Skeleton } from "../components/ui";
import { useCapability, useWorkspaceId } from "../data/capability";
import {
  useCreateLeaveRequest,
  useDecideLeaveRequest,
  useEmployees,
  useLeaveRequests,
  useLeaveTypeSettings,
  useSetLeaveTypeSettings,
} from "../data/ops";

const inputStyle = {
  padding: "6px 10px",
  fontSize: 12.5,
  color: "var(--ink)",
  background: "var(--card)",
  border: "1px solid var(--card-bd)",
  borderRadius: 6,
} as const;

const LEAVE_TYPES = ["annual", "sick", "unpaid", "other"] as const;

export function Leave() {
  const workspaceId = useWorkspaceId();
  const { can, reasonFor } = useCapability();

  const requests = useLeaveRequests(workspaceId);
  const employees = useEmployees(workspaceId);
  const createRequest = useCreateLeaveRequest(workspaceId);
  const decide = useDecideLeaveRequest(workspaceId);
  const typeSettings = useLeaveTypeSettings(workspaceId);
  const setTypeSettings = useSetLeaveTypeSettings(workspaceId);

  const [newMemberId, setNewMemberId] = useState("");
  const [newType, setNewType] = useState<"annual" | "sick" | "unpaid" | "other">("annual");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [newReason, setNewReason] = useState("");
  const [requestError, setRequestError] = useState<string | null>(null);

  if (!can("employee.manage")) {
    return <EmptyState style={{ padding: 26, fontSize: 13.5 }}>{reasonFor("employee.manage")}</EmptyState>;
  }

  if (requests.isPending || employees.isPending) {
    return (
      <div className="pms-enter flex max-w-wide flex-col gap-4">
        <Skeleton height={40} />
        <Skeleton height={200} delay={60} />
      </div>
    );
  }

  if (requests.isError || employees.isError) {
    return (
      <LoadFailed
        onRetry={() => {
          void requests.refetch();
          void employees.refetch();
        }}
        retrying={requests.isFetching || employees.isFetching}
      >
        We couldn&apos;t load leave requests. This is on our side.
      </LoadFailed>
    );
  }

  const requestList = requests.data ?? [];
  const employeeList = employees.data?.employees ?? [];
  const settingsList = typeSettings.data ?? [];

  const settingsFor = (type: string) =>
    settingsList.find((s) => s.leaveType === type) ?? {
      leaveType: type as "annual" | "sick" | "unpaid" | "other",
      isUnpaid: type === "unpaid",
      carryForward: false,
      applicableAfterDays: 0,
      maxConsecutiveDays: null,
    };

  return (
    <div className="pms-enter flex max-w-wide flex-col gap-6">
      {/* --- Leave type settings --- */}
      <section>
        <SectionHeading n={LEAVE_TYPES.length}>Leave type settings</SectionHeading>
        <div
          style={{
            marginTop: 10,
            background: "var(--card)",
            border: "1px solid var(--card-bd)",
            borderRadius: "var(--radius-surface)",
            overflow: "hidden",
          }}
        >
          {LEAVE_TYPES.map((type, i) => {
            const s = settingsFor(type);
            return (
              <div
                key={type}
                style={{
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 12,
                  padding: "10px 18px",
                  borderTop: i === 0 ? "1px solid transparent" : "1px solid var(--line)",
                }}
              >
                <span style={{ width: 80, fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>
                  {type}
                </span>
                <label style={{ fontSize: 12, color: "var(--ink)", display: "flex", gap: 4 }}>
                  <input
                    type="checkbox"
                    defaultChecked={s.isUnpaid}
                    onChange={(e) =>
                      setTypeSettings.mutate({
                        leaveType: type,
                        isUnpaid: e.target.checked,
                        carryForward: s.carryForward,
                        applicableAfterDays: s.applicableAfterDays,
                      })
                    }
                  />
                  Unpaid
                </label>
                <label style={{ fontSize: 12, color: "var(--ink)", display: "flex", gap: 4 }}>
                  <input
                    type="checkbox"
                    defaultChecked={s.carryForward}
                    onChange={(e) =>
                      setTypeSettings.mutate({
                        leaveType: type,
                        isUnpaid: s.isUnpaid,
                        carryForward: e.target.checked,
                        applicableAfterDays: s.applicableAfterDays,
                      })
                    }
                  />
                  Carry forward
                </label>
                <label style={{ fontSize: 12, color: "var(--ink)", display: "flex", alignItems: "center", gap: 4 }}>
                  Applicable after
                  <input
                    type="number"
                    defaultValue={s.applicableAfterDays}
                    style={{ ...inputStyle, width: 60 }}
                    onBlur={(e) =>
                      setTypeSettings.mutate({
                        leaveType: type,
                        isUnpaid: s.isUnpaid,
                        carryForward: s.carryForward,
                        applicableAfterDays: Number(e.target.value) || 0,
                      })
                    }
                  />
                  days
                </label>
              </div>
            );
          })}
        </div>
      </section>

      {/* --- New request --- */}
      <section>
        <SectionHeading n={0}>New leave request</SectionHeading>
        <div
          style={{
            marginTop: 10,
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            padding: "12px 18px",
            background: "var(--card)",
            border: "1px solid var(--card-bd)",
            borderRadius: "var(--radius-surface)",
          }}
        >
          <select value={newMemberId} onChange={(e) => setNewMemberId(e.target.value)} style={inputStyle}>
            <option value="">Select employee…</option>
            {employeeList.map((e) => (
              <option key={e.departmentMemberId} value={e.departmentMemberId}>
                {e.name ?? e.departmentMemberId}
              </option>
            ))}
          </select>
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as typeof newType)}
            style={inputStyle}
          >
            <option value="annual">Annual</option>
            <option value="sick">Sick</option>
            <option value="unpaid">Unpaid</option>
            <option value="other">Other</option>
          </select>
          <input type="date" value={newStart} onChange={(e) => setNewStart(e.target.value)} style={inputStyle} />
          <input type="date" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} style={inputStyle} />
          <input
            type="text"
            placeholder="Reason (optional)"
            value={newReason}
            onChange={(e) => setNewReason(e.target.value)}
            style={{ ...inputStyle, width: 160 }}
          />
          <ActionButton
            disabled={!newMemberId || !newStart || !newEnd || createRequest.isPending}
            onClick={() => {
              setRequestError(null);
              createRequest.mutate(
                {
                  departmentMemberId: newMemberId,
                  leaveType: newType,
                  startDate: newStart,
                  endDate: newEnd,
                  reason: newReason || undefined,
                },
                {
                  onSuccess: () => {
                    setNewMemberId("");
                    setNewStart("");
                    setNewEnd("");
                    setNewReason("");
                  },
                  onError: (err) => setRequestError(err.message),
                },
              );
            }}
          >
            Submit request
          </ActionButton>
        </div>
        {requestError && (
          <p style={{ fontSize: 12, color: "var(--danger, #c0392b)", marginTop: 6 }}>{requestError}</p>
        )}
      </section>

      {/* --- Requests --- */}
      <section>
        <SectionHeading n={requestList.length}>Leave requests</SectionHeading>
        <div
          style={{
            marginTop: 10,
            background: "var(--card)",
            border: "1px solid var(--card-bd)",
            borderRadius: "var(--radius-surface)",
            overflow: "hidden",
          }}
        >
          {requestList.length === 0 ? (
            <EmptyState className="p-6">No leave requests yet.</EmptyState>
          ) : (
            requestList.map((r, i) => (
              <div
                key={r.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 18px",
                  borderTop: i === 0 ? "1px solid transparent" : "1px solid var(--line)",
                  flexWrap: "wrap",
                }}
              >
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>
                  {r.name ?? "Unknown"}
                </span>
                <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{r.leaveType}</span>
                <span style={{ fontSize: 12.5, color: "var(--ink)" }}>
                  {r.startDate} – {r.endDate}
                </span>
                <Badge intent={r.status === "approved" ? "accent" : r.status === "rejected" ? "neutral" : "info"}>
                  {r.status}
                </Badge>
                {r.status === "pending" && (
                  <>
                    <ActionButton
                      disabled={decide.isPending}
                      onClick={() => decide.mutate({ requestId: r.id, status: "approved" })}
                    >
                      Approve
                    </ActionButton>
                    <ActionButton
                      disabled={decide.isPending}
                      onClick={() => decide.mutate({ requestId: r.id, status: "rejected" })}
                    >
                      Reject
                    </ActionButton>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
