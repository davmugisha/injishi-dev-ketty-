"use client";

/**
 * Payroll · Claims (058-payroll AC-PY9).
 *
 * Two kinds. A reimbursement pays back money a person spent for the business,
 * with its receipt: it is paid with the net and is not income, so nothing is
 * taxed or contributed on it. A leave payout pays days of an encashable type at
 * the day rate, taxed as pay; its days leave the balance the moment it is
 * approved, so they cannot be taken as leave as well. A person raises their
 * own through self service, or the office raises one for them. An approved
 * claim is paid in the person's next month whose pay is not yet confirmed.
 */

import {
  PAY_CLAIM_LIST,
  type PayClaim,
  type PayClaimKind,
  type PayClaimStatus,
} from "@injishi/contracts";
import { DataView, Input, type DataColumn } from "@injishi/ui";
import { useState } from "react";

import { ActionButton, Badge, SectionHeading, SelectField } from "../../components/ui";
import { useWorkspaceId } from "../../data/capability";
import { useLeaveTypes } from "../../data/leave";
import { readListIds, runBulkAction, useListUrl, useSavedViewsFor } from "../../data/lists";
import { useCreatePayClaim, useDecidePayClaim, usePayClaimPage } from "../../data/payroll";
import { openFileLink } from "../../data/people-file";
import { useEmployees } from "../../data/people";
import { dshortIso, fmt, kigaliDateOf } from "../../lib/format";
import { usePms } from "../../store";
import { currentGrant } from "../../store/helpers";
import { HrFileInput } from "./hr-file-input";
import { monthName } from "./payroll-ui";
import { Avatar, FACE, WITH_FACE } from "./staff-look";
import { Field, FormError, daysText, inputClass } from "./staff-ui";

const STATUS: Record<PayClaimStatus, { label: string; intent: "ok" | "warn" | "bad" | "neutral" }> = {
  requested: { label: "Waiting", intent: "warn" },
  approved: { label: "Approved", intent: "ok" },
  rejected: { label: "Refused", intent: "bad" },
  cancelled: { label: "Withdrawn", intent: "neutral" },
};
const KIND: Record<PayClaimKind, string> = { reimbursement: "Reimbursement", leave_encashment: "Leave paid out" };

export function PayClaims() {
  const { state, toast } = usePms();
  const workspaceId = useWorkspaceId();
  const branches = currentGrant(state)?.branches ?? [];
  const decide = useDecidePayClaim(workspaceId);
  const [adding, setAdding] = useState(false);
  const [linkError, setLinkError] = useState<unknown>(null);
  const { defaultView, savedViews } = useSavedViewsFor(workspaceId, PAY_CLAIM_LIST.key);
  const list = useListUrl(PAY_CLAIM_LIST, "full", defaultView);
  const page = usePayClaimPage(workspaceId, list.state.query);

  const act = (r: PayClaim, decision: "approve" | "reject") =>
    decide.mutate(
      { id: r.id, decision },
      {
        onSuccess: (out) =>
          toast(
            decision === "approve"
              ? `${out.employee.displayName}'s claim approved, paid in ${monthName(out.period)}`
              : `${out.employee.displayName}'s claim refused`,
            "ok",
          ),
      },
    );

  const columns: DataColumn<PayClaim>[] = [
    {
      key: "employee",
      header: "Person",
      cell: (r) => (
        <span className={`${WITH_FACE}`} data-claim={r.id}>
          <Avatar name={r.employee.displayName} className={FACE} />
          <span className="font-semibold whitespace-nowrap text-foreground">{r.employee.displayName}</span>
          <span className="text-2xs text-muted-foreground">{r.reason}</span>
        </span>
      ),
    },
    {
      key: "kind",
      header: "Kind",
      cell: (r) => (r.kind === "leave_encashment" && r.leaveType ? `${r.leaveType.name}: ${daysText(r.days ?? 0)}` : KIND[r.kind]),
    },
    { key: "amountRwf", header: "Amount", align: "end", cell: (r) => (r.amountRwf === null ? "At the day rate" : fmt(r.amountRwf)) },
    { key: "period", header: "Paid in", cell: (r) => monthName(r.period) },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <span className="flex flex-col gap-1">
          <span className="flex flex-wrap gap-1.5">
            <Badge intent={STATUS[r.status].intent}>{STATUS[r.status].label}</Badge>
            {r.paid && <Badge intent="ok">Paid</Badge>}
          </span>
          {r.decidedByName && (
            <span className="text-2xs text-muted-foreground">
              By {r.decidedByName}
              {r.decidedAt ? `, ${dshortIso(kigaliDateOf(r.decidedAt))}` : ""}
              {r.decisionNote ? `: ${r.decisionNote}` : ""}
            </span>
          )}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "end",
      cell: (r) => {
        const busy = decide.isPending && decide.variables?.id === r.id;
        return (
          <span className="flex justify-end gap-2">
            {r.hasReceipt && workspaceId && (
              <ActionButton
                onClick={() => {
                  setLinkError(null);
                  void openFileLink(workspaceId, `/ops/pay-claims/${r.id}/receipt`).catch(setLinkError);
                }}
              >
                Receipt
              </ActionButton>
            )}
            {r.status === "requested" && (
              <>
                <ActionButton pending={busy && decide.variables?.decision === "reject"} onClick={() => act(r, "reject")}>
                  Refuse
                </ActionButton>
                <ActionButton variant="primary" pending={busy && decide.variables?.decision === "approve"} onClick={() => act(r, "approve")}>
                  Approve
                </ActionButton>
              </>
            )}
          </span>
        );
      },
    },
  ];

  return (
    <div className="pms-enter flex max-w-page flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex-1 text-sm text-muted-foreground">
          Staff raise their own claims from their phones; the office can raise one for them. Approved claims are paid on
          the next payslip not yet confirmed.
        </span>
        {!adding && (
          <ActionButton variant="primary" onClick={() => setAdding(true)}>
            Raise a claim
          </ActionButton>
        )}
      </div>
      {adding && <ClaimForm onDone={() => setAdding(false)} />}
      <section className="flex flex-col gap-3">
        <SectionHeading n={page.data?.total}>Claims</SectionHeading>
        <DataView
          spec={PAY_CLAIM_LIST}
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
          groupKeyOf={(r, field) => (field === "kind" ? r.kind : field === "status" ? r.status : field === "branch" ? r.branchId : null)}
          caption="Claims"
          searchPlaceholder="Search a name"
          refOptions={{ branch: branches.map((b) => ({ value: b.id, label: b.name })) }}
          bulk={
            workspaceId
              ? {
                  actions: [
                    { key: "approve", label: "Approve" },
                    { key: "reject", label: "Refuse", danger: true },
                  ],
                  onSelectAll: () => readListIds(workspaceId, "/ops/pay-claims", list.state.query),
                  onAction: async (key, ids) => {
                    const answer = await runBulkAction(workspaceId, "/ops/pay-claims", key, ids);
                    void page.refetch();
                    return answer;
                  },
                }
              : undefined
          }
          savedViews={savedViews}
          empty={{ title: "No claim yet", body: "Reimbursements and leave paid out appear here." }}
        />
        <FormError error={decide.error ?? linkError} />
      </section>
    </div>
  );
}

function ClaimForm({ onDone }: { onDone: () => void }) {
  const { toast } = usePms();
  const workspaceId = useWorkspaceId();
  const employees = useEmployees(workspaceId, "active");
  const types = useLeaveTypes(workspaceId);
  const create = useCreatePayClaim(workspaceId);
  const [kind, setKind] = useState<PayClaimKind>("reimbursement");
  const [draft, setDraft] = useState({ employeeId: "", amountRwf: "", leaveTypeId: "", days: "1", reason: "" });
  const [receipt, setReceipt] = useState<{ key: string; name: string } | null>(null);
  const encashable = (types.data ?? []).filter((t) => t.status === "active" && t.encashable);

  return (
    <form
      className="flex flex-col gap-4 rounded-card border border-card-bd bg-card p-5"
      onSubmit={(ev) => {
        ev.preventDefault();
        if (!draft.employeeId) return;
        const reason = draft.reason.trim();
        create.mutate(
          kind === "reimbursement"
            ? { kind, employeeId: draft.employeeId, amountRwf: Number(draft.amountRwf), receiptKey: receipt?.key ?? null, reason }
            : { kind, employeeId: draft.employeeId, leaveTypeId: draft.leaveTypeId, days: Number(draft.days), reason },
          {
            onSuccess: (c) => {
              toast(`Claim raised for ${c.employee.displayName}, waiting for approval`, "ok");
              onDone();
            },
          },
        );
      }}
    >
      <SectionHeading>Raise a claim</SectionHeading>
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
        <Field label="Kind">
          <SelectField
            label="Kind"
            value={kind}
            onChange={(v) => setKind(v === "leave_encashment" ? "leave_encashment" : "reimbursement")}
            options={[
              { value: "reimbursement", label: "A reimbursement, with its receipt" },
              { value: "leave_encashment", label: "Leave paid out" },
            ]}
          />
        </Field>
        {kind === "reimbursement" ? (
          <>
            <Field label="Amount in RWF" htmlFor="claim-amount">
              <Input id="claim-amount" type="number" min={1} step={1} required value={draft.amountRwf} onChange={(e) => setDraft({ ...draft, amountRwf: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Receipt" hint={receipt ? receipt.name : "A photo or a PDF of the receipt."}>
              <HrFileInput workspaceId={workspaceId} purpose="attachment" label={receipt ? "Replace the receipt" : "Add the receipt"} onUploaded={(up, name) => setReceipt({ key: up.objectKey, name })} />
            </Field>
          </>
        ) : (
          <>
            <Field label="Leave type" hint={encashable.length === 0 ? "No leave type here may be paid out." : undefined}>
              <SelectField
                label="Leave type"
                value={draft.leaveTypeId}
                onChange={(v) => setDraft({ ...draft, leaveTypeId: v })}
                placeholder="Choose a type"
                options={encashable.map((t) => ({ value: t.id, label: t.name }))}
              />
            </Field>
            <Field label="Days" hint="Whole or half days, no more than they have." htmlFor="claim-days">
              <Input id="claim-days" type="number" min={0.5} step={0.5} max={366} required value={draft.days} onChange={(e) => setDraft({ ...draft, days: e.target.value })} className={inputClass} />
            </Field>
          </>
        )}
        <Field label="Reason" htmlFor="claim-reason">
          <Input id="claim-reason" required minLength={3} maxLength={300} value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} className={inputClass} />
        </Field>
      </div>
      <FormError error={create.error} />
      <div className="flex justify-end gap-2">
        <ActionButton type="button" onClick={onDone}>
          Cancel
        </ActionButton>
        <ActionButton variant="primary" type="submit" pending={create.isPending}>
          {create.isPending ? "Raising" : "Raise"}
        </ActionButton>
      </div>
    </form>
  );
}
