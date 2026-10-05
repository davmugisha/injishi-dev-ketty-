"use client";

/**
 * Employees (HR module, Phase 1 — first pass, no ADR yet).
 *
 * "Employee" is a department_members row (see server/api's hr.ts header).
 * Adding somebody here is two existing acts chained together: assigning an
 * existing org member to a department (assignMember, already used elsewhere
 * for staffing), then recording a 'hired' fact about that assignment. A
 * BRAND NEW person — nobody with an account yet — still goes through Invites
 * first; this never creates a login, matching how staffing works everywhere
 * else in this app.
 *
 * No national ID field here on purpose: this app already carries that as a
 * verified identity document with its own retention rules, and duplicating
 * it here would create a second, unverified copy of the same sensitive fact.
 * "Employee ID" is a plain internal reference number instead.
 */

import { useState } from "react";

import {
  ActionButton,
  EmptyState,
  LoadFailed,
  SectionHeading,
  Skeleton,
} from "../components/ui";
import { useCapability, useWorkspaceId } from "../data/capability";
import {
  useAssignDepartmentMember,
  useDepartments,
  useEmployees,
  useRecordEmploymentEvent,
  useTeam,
} from "../data/ops";

export function Employees() {
  const workspaceId = useWorkspaceId();
  const { can, reasonFor } = useCapability();
  const query = useEmployees(workspaceId);
  const team = useTeam(workspaceId);
  const departments = useDepartments(workspaceId);
  const assignMember = useAssignDepartmentMember(workspaceId);
  const recordEvent = useRecordEmploymentEvent(workspaceId);

  const [titleDraft, setTitleDraft] = useState<Record<string, string>>({});
  const [idDraft, setIdDraft] = useState<Record<string, string>>({});

  const [newUserId, setNewUserId] = useState("");
  const [newDepartmentId, setNewDepartmentId] = useState("");
  const [newJobTitle, setNewJobTitle] = useState("");
  const [newEmployeeId, setNewEmployeeId] = useState("");

  if (!can("employee.manage")) {
    return (
      <EmptyState style={{ padding: 26, fontSize: 13.5 }}>{reasonFor("employee.manage")}</EmptyState>
    );
  }

  if (query.isPending) {
    return (
      <div className="pms-enter flex max-w-wide flex-col gap-4">
        <Skeleton height={40} />
        <Skeleton height={200} delay={60} />
      </div>
    );
  }

  if (query.isError) {
    return (
      <LoadFailed onRetry={() => void query.refetch()} retrying={query.isFetching}>
        We couldn&apos;t load employees. This is on our side.
      </LoadFailed>
    );
  }

  const employees = query.data?.employees ?? [];
  const teamMembers = team.data?.members ?? [];
  const departmentList = departments.data?.departments ?? [];

  const addEmployee = () => {
    if (!newUserId || !newDepartmentId) return;
    assignMember.mutate(
      { departmentId: newDepartmentId, userId: newUserId },
      {
        onSuccess: (member) => {
          recordEvent.mutate({
            departmentMemberId: member.id,
            eventType: "hired",
            jobTitle: newJobTitle || undefined,
            note: newEmployeeId ? `Employee ID: ${newEmployeeId}` : undefined,
          });
          setNewUserId("");
          setNewDepartmentId("");
          setNewJobTitle("");
          setNewEmployeeId("");
        },
      },
    );
  };

  const inputStyle = {
    padding: "6px 10px",
    fontSize: 12.5,
    color: "var(--ink)",
    background: "var(--card)",
    border: "1px solid var(--card-bd)",
    borderRadius: 6,
  } as const;

  return (
    <div className="pms-enter flex max-w-wide flex-col gap-6">
      {/* --- Add employee --- */}
      <section>
        <SectionHeading n={0}>Add employee</SectionHeading>
        <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
          For somebody new with no account yet, send an invitation from the
          Invites tab first — they show up here once they accept.
        </p>
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
          <select
            value={newUserId}
            onChange={(e) => setNewUserId(e.target.value)}
            style={{ ...inputStyle, minWidth: 180 }}
          >
            <option value="">Select a colleague…</option>
            {teamMembers.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name ?? m.email ?? m.userId}
              </option>
            ))}
          </select>
          <select
            value={newDepartmentId}
            onChange={(e) => setNewDepartmentId(e.target.value)}
            style={{ ...inputStyle, minWidth: 140 }}
          >
            <option value="">Select department…</option>
            {departmentList.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Job title"
            value={newJobTitle}
            onChange={(e) => setNewJobTitle(e.target.value)}
            style={{ ...inputStyle, width: 140 }}
          />
          <input
            type="text"
            placeholder="Employee ID"
            value={newEmployeeId}
            onChange={(e) => setNewEmployeeId(e.target.value)}
            style={{ ...inputStyle, width: 120 }}
          />
          <ActionButton
            disabled={!newUserId || !newDepartmentId || assignMember.isPending}
            onClick={addEmployee}
          >
            Add employee
          </ActionButton>
        </div>
      </section>

      {/* --- Roster --- */}
      <section>
        <SectionHeading n={employees.length}>Employees</SectionHeading>
        <div
          style={{
            marginTop: 10,
            background: "var(--card)",
            border: "1px solid var(--card-bd)",
            borderRadius: "var(--radius-surface)",
            overflow: "hidden",
          }}
        >
          {employees.length === 0 ? (
            <EmptyState className="p-6">No employees yet.</EmptyState>
          ) : (
            employees.map((e, i) => (
              <div
                key={e.departmentMemberId}
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
                  {e.name ?? "Not signed in yet"}
                </span>
                <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
                  {e.departmentName ?? "No department"}
                </span>
                <span style={{ fontSize: 12.5, color: "var(--ink)" }}>
                  {e.jobTitle ?? "No title set"}
                </span>
                <input
                  type="text"
                  placeholder="New job title"
                  value={titleDraft[e.departmentMemberId] ?? ""}
                  onChange={(ev) =>
                    setTitleDraft((prev) => ({ ...prev, [e.departmentMemberId]: ev.target.value }))
                  }
                  style={{ ...inputStyle, width: 140 }}
                />
                <ActionButton
                  disabled={!titleDraft[e.departmentMemberId] || recordEvent.isPending}
                  onClick={() => {
                    const title = titleDraft[e.departmentMemberId];
                    if (!title) return;
                    recordEvent.mutate(
                      {
                        departmentMemberId: e.departmentMemberId,
                        eventType: "title_change",
                        jobTitle: title,
                      },
                      {
                        onSuccess: () =>
                          setTitleDraft((prev) => ({ ...prev, [e.departmentMemberId]: "" })),
                      },
                    );
                  }}
                >
                  Set title
                </ActionButton>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}