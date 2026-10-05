"use client";

/**
 * Leave · Restricted periods (058-leave AC-LV9): the days a business cannot
 * spare people, such as the high season or a stocktake.
 *
 * A period may be narrowed to one department and some job positions, which
 * narrow together (both must match), and to the types it covers or leaves
 * out. A request overlapping a period it falls under is refused at request and
 * again at the decision, naming the period. A statutory type, such as sick or
 * maternity leave, is never restricted. Whoever decides leave reads them, so a
 * refusal can be explained; `people.manage` declares them.
 */

import type { RestrictedLeavePeriod, RestrictedTypeMode } from "@injishi/contracts";
import { Checkbox, Input } from "@injishi/ui";
import { useState } from "react";

import { ConfirmAction } from "../../components/confirm-action";
import { ActionButton, Badge, EmptyState, LoadFailed, SectionHeading, SelectField, Skeleton } from "../../components/ui";
import { useCapability, useWorkspaceId } from "../../data/capability";
import { useLeaveTypes, useRemoveRestrictedPeriod, useRestrictedPeriods, useSaveRestrictedPeriod } from "../../data/leave";
import { useDepartments } from "../../data/ops";
import { useHrCatalog } from "../../data/people-file";
import { addDaysIso, dshortIso, todayIso } from "../../lib/format";
import { usePms } from "../../store";
import { Field, FormError, RowList, inputClass, rowClass } from "./staff-ui";

const MODE_LABEL: Record<RestrictedTypeMode, string> = {
  all: "Every type",
  only: "Only these types",
  except: "Every type but these",
};

export function RestrictedPeriods() {
  const { toast } = usePms();
  const workspaceId = useWorkspaceId();
  const { can } = useCapability();
  const periods = useRestrictedPeriods(workspaceId);
  const types = useLeaveTypes(workspaceId);
  const positions = useHrCatalog(workspaceId, "job-positions");
  const remove = useRemoveRestrictedPeriod(workspaceId);
  const [editing, setEditing] = useState<RestrictedLeavePeriod | "new" | null>(null);
  const mayManage = can("people.manage");
  const typeName = (id: string) => types.data?.find((t) => t.id === id)?.name ?? "a type";
  const positionName = (id: string) => positions.data?.items.find((p) => p.id === id)?.title ?? "a position";
  const today = todayIso();

  return (
    <div className="pms-enter flex max-w-page flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex-1 text-sm text-muted-foreground">
          Leave that overlaps a period it falls under is refused, when it is asked for and again when it is decided.
          Sick, maternity and the other statutory types are never restricted.
        </span>
        {mayManage && editing === null && (
          <ActionButton variant="primary" onClick={() => setEditing("new")}>
            Add a period
          </ActionButton>
        )}
      </div>

      {editing !== null && <PeriodForm period={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}

      <section className="flex flex-col gap-2">
        <SectionHeading n={periods.data?.length}>Restricted periods</SectionHeading>
        {periods.isPending ? (
          <Skeleton height={80} />
        ) : periods.isError ? (
          <LoadFailed onRetry={() => void periods.refetch()} retrying={periods.isFetching}>
            We couldn&apos;t load the restricted periods.
          </LoadFailed>
        ) : periods.data.length === 0 ? (
          <EmptyState style={{ padding: 22, fontSize: 13.5 }}>No period is restricted. Leave can be asked for any day.</EmptyState>
        ) : (
          <RowList>
            {periods.data.map((p, i) => (
              <div key={p.id} className={`${rowClass(i)} flex flex-wrap items-start justify-between gap-3`} data-period={p.id}>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-ink">{p.title}</span>
                    {p.toDate < today ? <Badge intent="neutral">Past</Badge> : p.fromDate <= today ? <Badge intent="warn">Now</Badge> : null}
                  </span>
                  <span className="pms-num text-2xs text-ink2">
                    {dshortIso(p.fromDate)}
                    {p.toDate !== p.fromDate ? ` to ${dshortIso(p.toDate)}` : ""}
                  </span>
                  <span className="text-2xs text-muted-foreground">
                    {[
                      p.departmentName ?? "Every department",
                      p.jobPositionIds.length > 0 ? p.jobPositionIds.map(positionName).join(", ") : "every position",
                      p.typeMode === "all" ? "every type" : `${MODE_LABEL[p.typeMode].toLowerCase()}: ${p.leaveTypeIds.map(typeName).join(", ")}`,
                    ].join(" · ")}
                  </span>
                  {p.description ? <span className="text-2xs text-muted-foreground">{p.description}</span> : null}
                </span>
                {mayManage && (
                  <span className="flex gap-2">
                    <ActionButton onClick={() => setEditing(p)}>Edit</ActionButton>
                    <ConfirmAction
                      confirmLabel="Yes, lift it"
                      pending={remove.isPending && remove.variables === p.id}
                      onConfirm={() => remove.mutate(p.id, { onSuccess: () => toast(`${p.title} lifted`, "ok") })}
                    >
                      Remove
                    </ConfirmAction>
                  </span>
                )}
              </div>
            ))}
          </RowList>
        )}
        <FormError error={remove.error} />
      </section>
    </div>
  );
}

function PeriodForm({ period, onDone }: { period: RestrictedLeavePeriod | null; onDone: () => void }) {
  const { toast } = usePms();
  const workspaceId = useWorkspaceId();
  const save = useSaveRestrictedPeriod(workspaceId);
  const departments = useDepartments(workspaceId);
  const types = useLeaveTypes(workspaceId);
  const positions = useHrCatalog(workspaceId, "job-positions");
  const [draft, setDraft] = useState({
    title: period?.title ?? "",
    fromDate: period?.fromDate ?? addDaysIso(todayIso(), 14),
    toDate: period?.toDate ?? addDaysIso(todayIso(), 20),
    departmentId: period?.departmentId ?? "",
    typeMode: period?.typeMode ?? ("all" as RestrictedTypeMode),
    leaveTypeIds: period?.leaveTypeIds ?? [],
    jobPositionIds: period?.jobPositionIds ?? [],
    description: period?.description ?? "",
  });
  const toggle = (list: string[], id: string, on: boolean) => (on ? [...list, id] : list.filter((x) => x !== id));
  const activeTypes = (types.data ?? []).filter((t) => t.status === "active");
  const activePositions = (positions.data?.items ?? []).filter((p) => p.status === "active");

  return (
    <form
      className="flex flex-col gap-4 rounded-card border border-card-bd bg-card p-5"
      onSubmit={(ev) => {
        ev.preventDefault();
        const body = {
          title: draft.title.trim(),
          fromDate: draft.fromDate,
          toDate: draft.toDate,
          departmentId: draft.departmentId || null,
          jobPositionIds: draft.jobPositionIds,
          typeMode: draft.typeMode,
          leaveTypeIds: draft.typeMode === "all" ? [] : draft.leaveTypeIds,
          description: draft.description.trim() || null,
        };
        save.mutate(period ? { id: period.id, body } : { id: null, body }, {
          onSuccess: (p) => {
            toast(`${p.title} ${period ? "saved" : "restricted"}`, "ok");
            onDone();
          },
        });
      }}
    >
      <SectionHeading>{period ? `Edit ${period.title}` : "Add a restricted period"}</SectionHeading>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name" htmlFor="rp-title">
          <Input id="rp-title" required minLength={2} maxLength={80} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className={inputClass} />
        </Field>
        <Field label="Department" hint="Leave it on every department to restrict everyone.">
          <SelectField
            label="Department"
            value={draft.departmentId}
            onChange={(v) => setDraft({ ...draft, departmentId: v })}
            options={[{ value: "", label: "Every department" }, ...(departments.data?.departments ?? []).map((d) => ({ value: d.id, label: d.name }))]}
          />
        </Field>
        <Field label="From" htmlFor="rp-from">
          <Input
            id="rp-from"
            required
            type="date"
            value={draft.fromDate}
            onChange={(e) => setDraft({ ...draft, fromDate: e.target.value, toDate: draft.toDate < e.target.value ? e.target.value : draft.toDate })}
            className={inputClass}
          />
        </Field>
        <Field label="To" htmlFor="rp-to">
          <Input id="rp-to" required type="date" value={draft.toDate} onChange={(e) => setDraft({ ...draft, toDate: e.target.value })} className={inputClass} />
        </Field>
        <Field label="Types">
          <SelectField
            label="Types it covers"
            value={draft.typeMode}
            onChange={(v) => setDraft({ ...draft, typeMode: v as RestrictedTypeMode })}
            options={(Object.keys(MODE_LABEL) as RestrictedTypeMode[]).map((m) => ({ value: m, label: MODE_LABEL[m] }))}
          />
        </Field>
        <Field label="Description" hint="Optional: why these days." htmlFor="rp-desc">
          <Input id="rp-desc" maxLength={500} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className={inputClass} />
        </Field>
      </div>
      {draft.typeMode !== "all" && (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-semibold text-ink">{draft.typeMode === "only" ? "The types it covers" : "The types it leaves out"}</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {activeTypes.map((t) => (
              <Checkbox
                key={t.id}
                isSelected={draft.leaveTypeIds.includes(t.id)}
                onChange={(on: boolean) => setDraft({ ...draft, leaveTypeIds: toggle(draft.leaveTypeIds, t.id, on) })}
                className="flex items-center gap-2 text-sm font-normal text-ink"
              >
                {t.name}
                {t.statutory ? " (never restricted)" : ""}
              </Checkbox>
            ))}
          </div>
        </fieldset>
      )}
      {activePositions.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-semibold text-ink">Job positions (none ticked: every position)</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {activePositions.map((p) => (
              <Checkbox
                key={p.id}
                isSelected={draft.jobPositionIds.includes(p.id)}
                onChange={(on: boolean) => setDraft({ ...draft, jobPositionIds: toggle(draft.jobPositionIds, p.id, on) })}
                className="flex items-center gap-2 text-sm font-normal text-ink"
              >
                {p.title}
              </Checkbox>
            ))}
          </div>
        </fieldset>
      )}
      <FormError error={save.error} />
      <div className="flex justify-end gap-2">
        <ActionButton type="button" onClick={onDone}>
          Cancel
        </ActionButton>
        <ActionButton variant="primary" type="submit" pending={save.isPending}>
          {save.isPending ? "Saving" : period ? "Save" : "Restrict these days"}
        </ActionButton>
      </div>
    </form>
  );
}
