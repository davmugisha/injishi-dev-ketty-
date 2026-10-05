"use client";

/**
 * Onboarding / offboarding checklists (HR module, Phase 3). Templates are
 * set up once, with each task carrying an assignee role and a day offset
 * from hire/terminate date; applying a template copies its items onto an
 * employee's own checklist and computes each task's due date.
 */

import { useState } from "react";

import { ActionButton, EmptyState, LoadFailed, SectionHeading, Skeleton } from "../components/ui";
import { useCapability, useWorkspaceId } from "../data/capability";
import {
  useAddTemplateItem,
  useChecklistTemplateItems,
  useChecklistTemplates,
  useCreateChecklistTemplate,
  useEmployeeChecklist,
  useEmployees,
  useToggleChecklistItem,
} from "../data/ops";

const inputStyle = {
  padding: "6px 10px",
  fontSize: 12.5,
  color: "var(--ink)",
  background: "var(--card)",
  border: "1px solid var(--card-bd)",
  borderRadius: 6,
} as const;

export function Checklists() {
  const workspaceId = useWorkspaceId();
  const { can, reasonFor } = useCapability();

  const templates = useChecklistTemplates(workspaceId);
  const createTemplate = useCreateChecklistTemplate(workspaceId);
  const addTemplateItem = useAddTemplateItem(workspaceId);
  const employees = useEmployees(workspaceId);
  const toggleItem = useToggleChecklistItem(workspaceId);

  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateKind, setNewTemplateKind] = useState<"onboarding" | "offboarding">("onboarding");
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);
  const [newItemLabel, setNewItemLabel] = useState("");
  const [newItemAssignee, setNewItemAssignee] = useState("");
  const [newItemDays, setNewItemDays] = useState("0");

  const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(null);
  const employeeChecklist = useEmployeeChecklist(workspaceId, expandedEmployeeId);

  const templateItems = useChecklistTemplateItems(expandedTemplateId);

  if (!can("employee.manage")) {
    return <EmptyState style={{ padding: 26, fontSize: 13.5 }}>{reasonFor("employee.manage")}</EmptyState>;
  }

  if (templates.isPending || employees.isPending) {
    return (
      <div className="pms-enter flex max-w-wide flex-col gap-4">
        <Skeleton height={40} />
        <Skeleton height={200} delay={60} />
      </div>
    );
  }

  if (templates.isError || employees.isError) {
    return (
      <LoadFailed
        onRetry={() => {
          void templates.refetch();
          void employees.refetch();
        }}
        retrying={templates.isFetching || employees.isFetching}
      >
        We couldn&apos;t load checklists. This is on our side.
      </LoadFailed>
    );
  }

  const templateList = templates.data ?? [];
  const employeeList = employees.data?.employees ?? [];

  return (
    <div className="pms-enter flex max-w-wide flex-col gap-6">
      <section>
        <SectionHeading n={templateList.length}>Checklist templates</SectionHeading>
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
            value={newTemplateKind}
            onChange={(e) => setNewTemplateKind(e.target.value as "onboarding" | "offboarding")}
            style={inputStyle}
          >
            <option value="onboarding">Onboarding</option>
            <option value="offboarding">Offboarding</option>
          </select>
          <input
            type="text"
            placeholder="Template name"
            value={newTemplateName}
            onChange={(e) => setNewTemplateName(e.target.value)}
            style={{ ...inputStyle, width: 180 }}
          />
          <ActionButton
            disabled={!newTemplateName || createTemplate.isPending}
            onClick={() => {
              createTemplate.mutate(
                { kind: newTemplateKind, name: newTemplateName, isDefault: true },
                { onSuccess: () => setNewTemplateName("") },
              );
            }}
          >
            Create template
          </ActionButton>
        </div>

        <div
          style={{
            marginTop: 10,
            background: "var(--card)",
            border: "1px solid var(--card-bd)",
            borderRadius: "var(--radius-surface)",
            overflow: "hidden",
          }}
        >
          {templateList.length === 0 ? (
            <EmptyState className="p-6">No templates yet.</EmptyState>
          ) : (
            templateList.map((t, i) => (
              <div key={t.id}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 18px",
                    borderTop: i === 0 ? "1px solid transparent" : "1px solid var(--line)",
                    cursor: "pointer",
                  }}
                  onClick={() => setExpandedTemplateId(t.id === expandedTemplateId ? null : t.id)}
                >
                  <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>
                    {t.name}
                  </span>
                  <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{t.kind}</span>
                  {t.isDefault && <span style={{ fontSize: 11, color: "var(--muted)" }}>default</span>}
                </div>
                {expandedTemplateId === t.id && (
                  <div style={{ padding: "10px 18px 16px 18px", background: "var(--card)" }}>
                    {(templateItems.data ?? [])
                      .slice()
                      .sort((a, b) => a.sortOrder - b.sortOrder)
                      .map((item) => (
                        <div
                          key={item.id}
                          style={{ fontSize: 12.5, color: "var(--ink)", padding: "4px 0" }}
                        >
                          • {item.label}{" "}
                          <span style={{ color: "var(--muted)" }}>
                            ({item.assigneeRole ?? "unassigned"}, day {item.beginOnDays})
                          </span>
                        </div>
                      ))}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                      <input
                        type="text"
                        placeholder="Task"
                        value={newItemLabel}
                        onChange={(e) => setNewItemLabel(e.target.value)}
                        style={{ ...inputStyle, width: 160 }}
                      />
                      <input
                        type="text"
                        placeholder="Assignee (e.g. HR, IT)"
                        value={newItemAssignee}
                        onChange={(e) => setNewItemAssignee(e.target.value)}
                        style={{ ...inputStyle, width: 140 }}
                      />
                      <input
                        type="number"
                        placeholder="Day"
                        value={newItemDays}
                        onChange={(e) => setNewItemDays(e.target.value)}
                        style={{ ...inputStyle, width: 70 }}
                      />
                      <ActionButton
                        disabled={!newItemLabel || addTemplateItem.isPending}
                        onClick={() => {
                          addTemplateItem.mutate(
                            {
                              templateId: t.id,
                              label: newItemLabel,
                              assigneeRole: newItemAssignee || undefined,
                              beginOnDays: Number(newItemDays) || 0,
                            },
                            {
                              onSuccess: () => {
                                setNewItemLabel("");
                                setNewItemAssignee("");
                                setNewItemDays("0");
                              },
                            },
                          );
                        }}
                      >
                        Add task
                      </ActionButton>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      <section>
        <SectionHeading n={employeeList.length}>Employee checklists</SectionHeading>
        <div
          style={{
            marginTop: 10,
            background: "var(--card)",
            border: "1px solid var(--card-bd)",
            borderRadius: "var(--radius-surface)",
            overflow: "hidden",
          }}
        >
          {employeeList.map((e, i) => (
            <div key={e.departmentMemberId}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 18px",
                  borderTop: i === 0 ? "1px solid transparent" : "1px solid var(--line)",
                  cursor: "pointer",
                }}
                onClick={() =>
                  setExpandedEmployeeId(
                    e.departmentMemberId === expandedEmployeeId ? null : e.departmentMemberId,
                  )
                }
              >
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>
                  {e.name ?? "Unknown"}
                </span>
              </div>
              {expandedEmployeeId === e.departmentMemberId && (
                <div style={{ padding: "10px 18px 16px 18px", background: "var(--card)" }}>
                  {(employeeChecklist.data ?? []).length === 0 ? (
                    <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
                      No checklist yet for this person.
                    </span>
                  ) : (
                    (employeeChecklist.data ?? [])
                      .slice()
                      .sort((a, b) => a.sortOrder - b.sortOrder)
                      .map((item) => (
                        <label
                          key={item.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            fontSize: 12.5,
                            color: "var(--ink)",
                            padding: "4px 0",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={item.done}
                            onChange={(ev) =>
                              toggleItem.mutate({
                                itemId: item.id,
                                done: ev.target.checked,
                                departmentMemberId: expandedEmployeeId as string,
                              })
                            }
                          />
                          {item.label}{" "}
                          <span style={{ color: "var(--muted)" }}>
                            ({item.kind}
                            {item.assigneeRole ? `, ${item.assigneeRole}` : ""}
                            {item.dueDate ? `, due ${item.dueDate}` : ""})
                          </span>
                        </label>
                      ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
