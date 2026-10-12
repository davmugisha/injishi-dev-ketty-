"use client";

/**
 * Payroll · Adjustments (058-payroll AC-PY16; index contract 17).
 *
 * A confirmed payslip never changes, so a correction to a month already paid
 * is an adjustment: money paid or taken back on the person's next month whose
 * pay is still open, naming the month it corrects. Most write themselves: leave
 * decided into a confirmed month, a payslip held to next month, a claim raised
 * late. The office adds the rest by hand, and may waive one not yet paid, with
 * a reason the trail keeps.
 */

import {
  PAY_ADJUSTMENT_LIST,
  type PayAdjustment,
  type PayAdjustmentSide,
  type PayAdjustmentSource,
  type PayAdjustmentStatus,
} from "@injishi/contracts";
import { Checkbox, DataView, Input, type DataColumn } from "@injishi/ui";
import { useState } from "react";

import { ActionButton, Badge, SectionHeading, SelectField } from "../../components/ui";
import { useWorkspaceId } from "../../data/capability";
import { useListUrl, useSavedViewsFor } from "../../data/lists";
import { useCreatePayAdjustment, usePayAdjustmentPage, useWaivePayAdjustment } from "../../data/payroll";
import { useEmployees } from "../../data/people";
import { fmt, todayIso } from "../../lib/format";
import { usePms } from "../../store";
import { currentGrant } from "../../store/helpers";
import { ReasonForm, monthName } from "./payroll-ui";
import { Avatar, FACE, WITH_FACE } from "./staff-look";
import { Field, FormError, inputClass } from "./staff-ui";

const SOURCE: Record<PayAdjustmentSource, string> = {
  manual: "By hand",
  leave: "Leave",
  asset_fine: "Asset fine",
  held_payslip: "Held payslip",
  late_claim: "Late claim",
};
const STATUS: Record<PayAdjustmentStatus, { label: string; intent: "ok" | "warn" | "neutral" }> = {
  open: { label: "To pay", intent: "warn" },
  waived: { label: "Waived", intent: "neutral" },
  paid: { label: "Paid", intent: "ok" },
};

export function PayAdjustments() {
  const { state, toast } = usePms();
  const workspaceId = useWorkspaceId();
  const branches = currentGrant(state)?.branches ?? [];
  const waive = useWaivePayAdjustment(workspaceId);
  const [adding, setAdding] = useState(false);
  const [waiving, setWaiving] = useState<PayAdjustment | null>(null);
  const { defaultView, savedViews } = useSavedViewsFor(workspaceId, PAY_ADJUSTMENT_LIST.key);
  const list = useListUrl(PAY_ADJUSTMENT_LIST, "full", defaultView);
  const page = usePayAdjustmentPage(workspaceId, list.state.query);

  const columns: DataColumn<PayAdjustment>[] = [
    {
      key: "employee",
      header: "Person",
      cell: (r) => (
        <span className={`${WITH_FACE}`} data-adjustment={r.id}>
          <Avatar name={r.employee.displayName} className={FACE} />
          <span className="font-semibold whitespace-nowrap text-foreground">{r.employee.displayName}</span>
          <span className="text-2xs text-muted-foreground">{r.reason}</span>
        </span>
      ),
    },
    {
      key: "side",
      header: "Amount",
      align: "end",
      cell: (r) => (
        <span className="flex flex-col items-end gap-0.5">
          <span className="pms-num font-semibold">{r.side === "earning" ? `+${fmt(r.amountRwf)}` : `−${fmt(r.amountRwf)}`}</span>
          {r.side === "earning" && (
            <span className="text-2xs text-muted-foreground">
              {r.taxable ? "taxed" : "not taxed"}, {r.contributable ? "contributes" : "no contributions"}
            </span>
          )}
        </span>
      ),
    },
    { key: "correctsPeriod", header: "Corrects", cell: (r) => monthName(r.correctsPeriod) },
    { key: "source", header: "From", cell: (r) => SOURCE[r.source] },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <span className="flex flex-col gap-0.5">
          <Badge intent={STATUS[r.status].intent}>{STATUS[r.status].label}</Badge>
          {r.paidInPeriod && <span className="text-2xs text-muted-foreground">In {monthName(r.paidInPeriod)}</span>}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "end",
      cell: (r) => (r.status === "open" ? <ActionButton onClick={() => setWaiving(r)}>Waive</ActionButton> : null),
    },
  ];

  return (
    <div className="pms-enter flex max-w-page flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex-1 text-sm text-muted-foreground">
          A month already paid is never edited. A correction is paid or taken back on the next open month, and says
          which month it corrects.
        </span>
        {!adding && (
          <ActionButton variant="primary" onClick={() => setAdding(true)}>
            Add an adjustment
          </ActionButton>
        )}
      </div>
      {adding && <AdjustmentForm onDone={() => setAdding(false)} />}
      {waiving && (
        <ReasonForm
          title={`Waive ${fmt(waiving.amountRwf)} for ${waiving.employee.displayName}: it will never be paid or taken`}
          action="Waive"
          pending={waive.isPending}
          error={waive.error}
          onCancel={() => setWaiving(null)}
          onSubmit={(reason) =>
            waive.mutate(
              { id: waiving.id, reason },
              {
                onSuccess: (out) => {
                  toast(`Waived for ${out.employee.displayName}`, "ok");
                  setWaiving(null);
                },
              },
            )
          }
        />
      )}
      <section className="flex flex-col gap-3">
        <SectionHeading n={page.data?.total}>Adjustments</SectionHeading>
        <DataView
          spec={PAY_ADJUSTMENT_LIST}
          reader="full"
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
          groupKeyOf={(r, field) => (field === "side" ? r.side : field === "source" ? r.source : field === "branch" ? r.branchId : null)}
          caption="Pay adjustments"
          searchPlaceholder="Search a name"
          refOptions={{ branch: branches.map((b) => ({ value: b.id, label: b.name })) }}
          savedViews={savedViews}
          empty={{ title: "No adjustment yet", body: "Corrections to months already paid appear here." }}
        />
      </section>
    </div>
  );
}

function AdjustmentForm({ onDone }: { onDone: () => void }) {
  const { toast } = usePms();
  const workspaceId = useWorkspaceId();
  const employees = useEmployees(workspaceId, "active");
  const create = useCreatePayAdjustment(workspaceId);
  const [draft, setDraft] = useState({
    employeeId: "",
    side: "earning" as PayAdjustmentSide,
    amountRwf: "",
    taxable: true,
    contributable: true,
    correctsPeriod: todayIso().slice(0, 7),
    reason: "",
  });

  return (
    <form
      className="flex flex-col gap-4 rounded-card border border-card-bd bg-card p-5"
      onSubmit={(ev) => {
        ev.preventDefault();
        if (!draft.employeeId) return;
        create.mutate(
          {
            employeeId: draft.employeeId,
            side: draft.side,
            amountRwf: Number(draft.amountRwf),
            taxable: draft.side === "earning" ? draft.taxable : false,
            contributable: draft.side === "earning" ? draft.contributable : false,
            correctsPeriod: draft.correctsPeriod,
            reason: draft.reason.trim(),
          },
          {
            onSuccess: (a) => {
              toast(`Adjustment added for ${a.employee.displayName}`, "ok");
              onDone();
            },
          },
        );
      }}
    >
      <SectionHeading>Add an adjustment</SectionHeading>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Person">
          <SelectField
            label="Person"
            value={draft.employeeId}
            onChange={(v) => setDraft({ ...draft, employeeId: v })}
            placeholder="Choose someone"
            options={(employees.data ?? []).map((e) => ({ value: e.id, label: e.displayName }))}
          />
        </Field>
        <Field label="Pay or take back">
          <SelectField
            label="Pay or take back"
            value={draft.side}
            onChange={(v) => setDraft({ ...draft, side: v === "deduction" ? "deduction" : "earning" })}
            options={[
              { value: "earning", label: "Pay them more" },
              { value: "deduction", label: "Take back" },
            ]}
          />
        </Field>
        <Field label="Amount in RWF" htmlFor="adj-amount">
          <Input id="adj-amount" type="number" min={1} step={1} required value={draft.amountRwf} onChange={(e) => setDraft({ ...draft, amountRwf: e.target.value })} className={inputClass} />
        </Field>
        <Field label="Corrects" hint="The month this puts right." htmlFor="adj-period">
          <Input id="adj-period" type="month" required value={draft.correctsPeriod} onChange={(e) => e.target.value && setDraft({ ...draft, correctsPeriod: e.target.value })} className={inputClass} />
        </Field>
        <Field label="Reason" htmlFor="adj-reason">
          <Input id="adj-reason" required minLength={3} maxLength={300} value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} className={inputClass} />
        </Field>
        {draft.side === "earning" && (
          <div className="flex flex-col gap-2 pt-5">
            <Checkbox isSelected={draft.taxable} onChange={(on) => setDraft({ ...draft, taxable: on })} className="flex w-full items-center gap-2.5 text-sm font-normal text-ink">
              Taxed, like the pay it corrects
            </Checkbox>
            <Checkbox isSelected={draft.contributable} onChange={(on) => setDraft({ ...draft, contributable: on })} className="flex w-full items-center gap-2.5 text-sm font-normal text-ink">
              Counts for RSSB contributions
            </Checkbox>
          </div>
        )}
      </div>
      <FormError error={create.error} />
      <div className="flex justify-end gap-2">
        <ActionButton type="button" onClick={onDone}>
          Cancel
        </ActionButton>
        <ActionButton variant="primary" type="submit" pending={create.isPending}>
          {create.isPending ? "Adding" : "Add"}
        </ActionButton>
      </div>
    </form>
  );
}
