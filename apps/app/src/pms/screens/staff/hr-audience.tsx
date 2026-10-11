"use client";

/**
 * Who a policy or a staff announcement is for (058-people-file AC-PF7, AC-PF9):
 * everyone, or chosen departments, job positions and people. A department and
 * positions together narrow it (both must match); a person named is always in.
 *
 * Staff with no account are reached on paper, which the form says: what they
 * cannot open on a phone, somebody prints.
 */

import type { Employee, HrTargets } from "@injishi/contracts";
import { Checkbox } from "@injishi/ui";

import { SelectField } from "../../components/ui";
import { useWorkspaceId } from "../../data/capability";
import { useDepartments } from "../../data/ops";
import { useEmployees } from "../../data/people";
import { useHrCatalog } from "../../data/people-file";
import { Field, PeoplePicker } from "./staff-ui";

export const NO_TARGETS: HrTargets = { departmentIds: [], jobPositionIds: [], employeeIds: [] };

/** A person as a picker offers them: name, then number, position and branch. */
export function personOption(e: Employee): { id: string; label: string; detail: string } {
  return {
    id: e.id,
    label: e.displayName,
    detail: [e.employeeNumber, e.jobPositionTitle, e.workPropertyName].filter(Boolean).join(" · "),
  };
}

export function AudienceFields({
  audience,
  targets,
  onChange,
}: {
  audience: "all" | "targeted";
  targets: HrTargets;
  onChange: (audience: "all" | "targeted", targets: HrTargets) => void;
}) {
  const workspaceId = useWorkspaceId();
  const departments = useDepartments(workspaceId);
  const positions = useHrCatalog(workspaceId, "job-positions");
  const people = useEmployees(workspaceId, "active");
  const toggle = (key: keyof HrTargets, id: string, on: boolean) =>
    onChange(audience, { ...targets, [key]: on ? [...targets[key], id] : targets[key].filter((x) => x !== id) });

  return (
    <div className="flex flex-col gap-3">
      <Field label="Who it is for" hint="Staff with no account are reached on paper: print it for them.">
        <SelectField
          label="Who it is for"
          value={audience}
          onChange={(v) => onChange(v as "all" | "targeted", v === "all" ? NO_TARGETS : targets)}
          options={[
            { value: "all", label: "Everyone who works here" },
            { value: "targeted", label: "Chosen departments, positions or people" },
          ]}
        />
      </Field>
      {audience === "targeted" && (
        <div className="grid gap-4 md:grid-cols-2">
          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-2xs font-bold tracking-[0.08em] uppercase text-[var(--muted2)]">Departments</legend>
            {(departments.data?.departments ?? []).length === 0 ? (
              <span className="text-2xs text-muted-foreground">No departments to choose from.</span>
            ) : (
              (departments.data?.departments ?? []).map((d) => (
                <Checkbox
                  key={d.id}
                  isSelected={targets.departmentIds.includes(d.id)}
                  onChange={(on) => toggle("departmentIds", d.id, on)}
                  className="flex items-center gap-2 text-sm font-normal text-ink"
                >
                  {d.name}
                </Checkbox>
              ))
            )}
          </fieldset>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-2xs font-bold tracking-[0.08em] uppercase text-[var(--muted2)]">
              Job positions
            </legend>
            {(positions.data?.items ?? []).filter((p) => p.status === "active").length === 0 ? (
              <span className="text-2xs text-muted-foreground">No positions yet; add them under Configuration.</span>
            ) : (
              (positions.data?.items ?? [])
                .filter((p) => p.status === "active" || targets.jobPositionIds.includes(p.id))
                .map((p) => (
                  <Checkbox
                    key={p.id}
                    isSelected={targets.jobPositionIds.includes(p.id)}
                    onChange={(on) => toggle("jobPositionIds", p.id, on)}
                    className="flex items-center gap-2 text-sm font-normal text-ink"
                  >
                    {p.title}
                  </Checkbox>
                ))
            )}
            {targets.departmentIds.length > 0 && targets.jobPositionIds.length > 0 && (
              <span className="text-2xs text-muted-foreground">
                With both chosen, it is for those positions inside those departments.
              </span>
            )}
          </fieldset>
          <div className="md:col-span-2">
            <Field label="People">
              <PeoplePicker
                label="People it is for"
                people={(people.data ?? []).map(personOption)}
                selected={targets.employeeIds}
                onChange={(ids) => onChange(audience, { ...targets, employeeIds: ids })}
              />
            </Field>
          </div>
        </div>
      )}
    </div>
  );
}

/** The audience in words, for a row: "Everyone", or what was chosen. */
export function audienceText(audience: "all" | "targeted", targets: HrTargets): string {
  if (audience === "all") return "Everyone";
  const parts = [
    targets.departmentIds.length > 0 ? `${targets.departmentIds.length} department${targets.departmentIds.length === 1 ? "" : "s"}` : null,
    targets.jobPositionIds.length > 0 ? `${targets.jobPositionIds.length} position${targets.jobPositionIds.length === 1 ? "" : "s"}` : null,
    targets.employeeIds.length > 0 ? `${targets.employeeIds.length} ${targets.employeeIds.length === 1 ? "person" : "people"}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Nobody chosen";
}
