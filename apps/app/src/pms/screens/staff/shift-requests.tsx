"use client";

/**
 * Staff · Shift requests (ADR-058, 058-time AC-TM5).
 *
 * A request for a different shift on a day or a range, or a swap with a
 * colleague at the same branch. Staff raise their own through self service;
 * this lens files one for somebody, and decides. A swap waits for the
 * colleague to say yes; for a colleague with no account, whoever manages the
 * roster says it for them. Nobody decides a request they are part of.
 *
 * Approving replaces the person's shifts on those days with the asked one (or
 * exchanges the two people's shifts), in one go, published where the week was.
 *
 * The queue is the shared `DataView` over `SHIFT_REQUEST_LIST`, routed to you
 * first, with a bulk approve or refuse that decides each request on its own.
 */

import { SHIFT_REQUEST_LIST, type ShiftRequest, type ShiftRequestStatus } from "@injishi/contracts";
import { DataView, Input, type DataColumn } from "@injishi/ui";
import { useState } from "react";

import { ActionButton, Badge, SectionHeading, SelectField } from "../../components/ui";
import { useWorkspaceId } from "../../data/capability";
import { readListIds, runBulkAction, useListUrl, useSavedViewsFor } from "../../data/lists";
import { useEmployees, useShiftTemplates } from "../../data/people";
import { useCreateShiftRequest, useShiftRequestAction, useShiftRequestPage, type ShiftRequestAction } from "../../data/time";
import { dshortIso, todayIso } from "../../lib/format";
import { usePms } from "../../store";
import { currentGrant } from "../../store/helpers";
import { Avatar, FACE, WITH_FACE } from "./staff-look";
import { Field, FormError, inputClass } from "./staff-ui";

const STATUS: Record<ShiftRequestStatus, { label: string; intent: "ok" | "warn" | "bad" | "neutral" | "info" }> = {
  requested: { label: "Waiting", intent: "warn" },
  awaiting_colleague: { label: "Waiting for the colleague", intent: "info" },
  approved: { label: "Approved", intent: "ok" },
  rejected: { label: "Refused", intent: "bad" },
  cancelled: { label: "Cancelled", intent: "neutral" },
};

function range(r: Pick<ShiftRequest, "fromDate" | "toDate">): string {
  return r.fromDate === r.toDate ? dshortIso(r.fromDate) : `${dshortIso(r.fromDate)} to ${dshortIso(r.toDate)}`;
}

export function ShiftRequests() {
  const { state, toast } = usePms();
  const workspaceId = useWorkspaceId();
  const act = useShiftRequestAction(workspaceId);
  const [filing, setFiling] = useState(false);
  const branches = currentGrant(state)?.branches ?? [];
  const { defaultView, savedViews } = useSavedViewsFor(workspaceId, SHIFT_REQUEST_LIST.key);
  const list = useListUrl(SHIFT_REQUEST_LIST, "basic", defaultView);
  const page = useShiftRequestPage(workspaceId, list.state.query);

  const run = (r: ShiftRequest, action: ShiftRequestAction) =>
    act.mutate(
      { id: r.id, action },
      {
        onSuccess: (out) =>
          toast(
            action === "approve"
              ? `Approved: ${out.employee.displayName}'s shifts on ${range(out)} are changed`
              : action === "reject"
                ? `Refused ${out.employee.displayName}'s request`
                : action === "cancel"
                  ? `Withdrawn ${out.employee.displayName}'s request`
                  : `Accepted for ${out.swapWith?.displayName ?? "the colleague"}; it can be decided now`,
            "ok",
          ),
      },
    );

  const columns: DataColumn<ShiftRequest>[] = [
    {
      key: "employee",
      header: "Person",
      cell: (r) => (
        <span className={`${WITH_FACE}`} data-shift-request={r.id}>
          <Avatar name={r.employee.displayName} className={FACE} />
          <span className="font-semibold whitespace-nowrap text-foreground">{r.employee.displayName}</span>
          <span className="text-2xs text-muted-foreground">{r.reason}</span>
        </span>
      ),
    },
    {
      key: "kind",
      header: "Asks for",
      cell: (r) =>
        r.kind === "swap" ? (
          <span>Swap with {r.swapWith?.displayName ?? "a colleague"}</span>
        ) : (
          <span>{r.shiftTemplate?.name ?? "Another shift"} instead</span>
        ),
    },
    { key: "fromDate", header: "Days", cell: (r) => <span className="pms-num">{range(r)}</span> },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <span className="flex flex-wrap gap-1.5">
          <Badge intent={STATUS[r.status].intent}>{STATUS[r.status].label}</Badge>
          {r.routedToMe && (r.status === "requested" || r.status === "awaiting_colleague") && <Badge intent="info">Routed to you</Badge>}
          {r.kind === "swap" && r.colleagueAcceptedAt && r.status === "requested" && <Badge intent="ok">Colleague agreed</Badge>}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "end",
      cell: (r) => {
        const busy = (a: ShiftRequestAction) => act.isPending && act.variables?.id === r.id && act.variables?.action === a;
        if (r.status === "awaiting_colleague") {
          return (
            <span className="flex justify-end gap-2">
              <ActionButton pending={busy("cancel")} onClick={() => run(r, "cancel")}>
                Withdraw
              </ActionButton>
              <ActionButton pending={busy("accept-for-colleague")} onClick={() => run(r, "accept-for-colleague")}>
                Accept for them
              </ActionButton>
            </span>
          );
        }
        if (r.status === "requested") {
          return (
            <span className="flex justify-end gap-2">
              <ActionButton pending={busy("reject")} onClick={() => run(r, "reject")}>
                Refuse
              </ActionButton>
              <ActionButton variant="primary" pending={busy("approve")} onClick={() => run(r, "approve")}>
                Approve
              </ActionButton>
            </span>
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
          Approving replaces the shifts on those days, and a swap exchanges them, published where the week is.
          A swap waits for the colleague first.
        </span>
        {!filing && (
          <ActionButton variant="primary" onClick={() => setFiling(true)}>
            Ask for someone
          </ActionButton>
        )}
      </div>
      {filing && <FileShiftRequest onDone={() => setFiling(false)} />}
      <section className="flex flex-col gap-3">
        <SectionHeading n={page.data?.total}>Requests</SectionHeading>
        <DataView
          spec={SHIFT_REQUEST_LIST}
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
          groupKeyOf={(r, field) => (field === "kind" ? r.kind : field === "status" ? r.status : field === "branch" ? r.branchId : null)}
          caption="Shift requests"
          searchPlaceholder="Search a name"
          refOptions={{ branch: branches.map((b) => ({ value: b.id, label: b.name })) }}
          bulk={
            workspaceId
              ? {
                  actions: [
                    { key: "approve", label: "Approve" },
                    { key: "reject", label: "Refuse", danger: true },
                  ],
                  onSelectAll: () => readListIds(workspaceId, "/ops/shift-requests", list.state.query),
                  onAction: async (key, ids) => {
                    const answer = await runBulkAction(workspaceId, "/ops/shift-requests", key, ids);
                    void page.refetch();
                    return answer;
                  },
                }
              : undefined
          }
          savedViews={savedViews}
          empty={{ title: "No shift requests", body: "Requests staff raise in self service, and those filed here, appear here." }}
        />
        <FormError error={act.error} />
      </section>
    </div>
  );
}

function FileShiftRequest({ onDone }: { onDone: () => void }) {
  const { toast } = usePms();
  const workspaceId = useWorkspaceId();
  const employees = useEmployees(workspaceId, "active");
  const templates = useShiftTemplates(workspaceId);
  const create = useCreateShiftRequest(workspaceId);
  const [draft, setDraft] = useState({
    kind: "change" as "change" | "swap",
    employeeId: "",
    other: "",
    from: todayIso(),
    to: todayIso(),
    reason: "",
  });
  const people = employees.data ?? [];
  const person = people.find((e) => e.id === draft.employeeId);
  const shifts = (templates.data?.templates ?? []).filter((t) => t.status === "active" && t.propertyId === person?.workPropertyId);
  const colleagues = people.filter((e) => e.id !== draft.employeeId && e.workPropertyId === person?.workPropertyId);
  const ready = draft.employeeId !== "" && draft.other !== "" && draft.reason.trim().length >= 3;

  return (
    <form
      className="flex flex-col gap-4 rounded-card border border-card-bd bg-card p-5"
      onSubmit={(ev) => {
        ev.preventDefault();
        if (!ready) return;
        const base = { employeeId: draft.employeeId, from: draft.from, to: draft.to, reason: draft.reason.trim() };
        create.mutate(
          draft.kind === "change" ? { ...base, kind: "change", shiftTemplateId: draft.other } : { ...base, kind: "swap", swapEmployeeId: draft.other },
          {
            onSuccess: (r) => {
              toast(
                r.status === "awaiting_colleague"
                  ? `Asked. It waits for ${r.swapWith?.displayName ?? "the colleague"} to agree`
                  : `Filed for ${r.employee.displayName}`,
                "ok",
              );
              onDone();
            },
          },
        );
      }}
    >
      <SectionHeading>Ask for someone</SectionHeading>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="What">
          <SelectField
            label="What"
            value={draft.kind}
            onChange={(v) => setDraft({ ...draft, kind: v === "swap" ? "swap" : "change", other: "" })}
            options={[
              { value: "change", label: "A different shift" },
              { value: "swap", label: "A swap with a colleague" },
            ]}
          />
        </Field>
        <Field label="Person">
          <SelectField
            label="Person"
            value={draft.employeeId}
            onChange={(v) => setDraft({ ...draft, employeeId: v, other: "" })}
            placeholder="Choose someone"
            options={people.map((e) => ({ value: e.id, label: e.displayName }))}
          />
        </Field>
        {draft.kind === "change" ? (
          <Field label="Shift wanted">
            <SelectField
              label="Shift wanted"
              value={draft.other}
              onChange={(v) => setDraft({ ...draft, other: v })}
              placeholder={person ? "A shift of their branch" : "Choose the person first"}
              disabled={!person}
              options={shifts.map((t) => ({ value: t.id, label: `${t.name} ${t.startsAt}–${t.endsAt}` }))}
            />
          </Field>
        ) : (
          <Field label="Swap with">
            <SelectField
              label="Swap with"
              value={draft.other}
              onChange={(v) => setDraft({ ...draft, other: v })}
              placeholder={person ? "A colleague at the same branch" : "Choose the person first"}
              disabled={!person}
              options={colleagues.map((e) => ({ value: e.id, label: e.displayName }))}
            />
          </Field>
        )}
        <Field label="Reason" htmlFor="sr-reason">
          <Input id="sr-reason" required value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} className={inputClass} />
        </Field>
        <Field label="From" htmlFor="sr-from">
          <Input id="sr-from" required type="date" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value, to: draft.to < e.target.value ? e.target.value : draft.to })} className={inputClass} />
        </Field>
        <Field label="To" hint="At most a month." htmlFor="sr-to">
          <Input id="sr-to" required type="date" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} className={inputClass} />
        </Field>
      </div>
      <FormError error={create.error} />
      <div className="flex justify-end gap-2">
        <ActionButton type="button" onClick={onDone}>
          Cancel
        </ActionButton>
        <ActionButton variant="primary" type="submit" pending={create.isPending} deniedReason={ready ? undefined : "Choose who, what and why"}>
          {create.isPending ? "Filing" : "File the request"}
        </ActionButton>
      </div>
    </form>
  );
}
