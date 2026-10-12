"use client";

/**
 * Payroll · Payslips (058-payroll AC-PY10, AC-PY11): every payslip across
 * runs, with whether and how it was paid.
 *
 * Paid status is the only thing that ever changes on a confirmed payslip. It
 * is marked with a date, a way (bank, MoMo, cash) and the reference the bank
 * or the cash book gave, one at a time or in bulk; the reference is what makes
 * a retry safe, so the same reference again changes nothing and another is
 * refused until the first is unmarked with a reason. A draft payslip is a
 * preview: it neither prints nor is paid. A PDF is drawn on request from what
 * the confirm froze, for a person without an account to be handed.
 */

import { PAYSLIP_LIST, type PaidMethod, type PayslipRow } from "@injishi/contracts";
import { DataView, Input, type DataColumn } from "@injishi/ui";
import { useState } from "react";

import { ActionButton, Badge, SectionHeading, SelectField } from "../../components/ui";
import { useWorkspaceId } from "../../data/capability";
import { readListIds, runBulkAction, useListUrl, useSavedViewsFor } from "../../data/lists";
import { downloadPayPdf, useMarkPaid, usePayslipPage, useUnmarkPaid } from "../../data/payroll";
import { dshortIso, fmt, kigaliDateOf, todayIso } from "../../lib/format";
import { usePms } from "../../store";
import { currentGrant } from "../../store/helpers";
import { PAID_METHOD_LABEL, ReasonForm, monthName, monthShort } from "./payroll-ui";
import { Field, FormError, Reveal, inputClass } from "./staff-ui";

interface PaidDraft {
  paidOn: string;
  method: PaidMethod;
  reference: string;
}

export function Payslips() {
  const { state, toast } = usePms();
  const workspaceId = useWorkspaceId();
  const branches = currentGrant(state)?.branches ?? [];
  const markPaid = useMarkPaid(workspaceId);
  const unmark = useUnmarkPaid(workspaceId);
  const [paid, setPaid] = useState<PaidDraft>({ paidOn: todayIso(), method: "bank", reference: "" });
  const [marking, setMarking] = useState<PayslipRow | null>(null);
  const [unmarking, setUnmarking] = useState<PayslipRow | null>(null);
  const [printError, setPrintError] = useState<unknown>(null);

  const { defaultView, savedViews } = useSavedViewsFor(workspaceId, PAYSLIP_LIST.key);
  const list = useListUrl(PAYSLIP_LIST, "full", defaultView);
  const page = usePayslipPage(workspaceId, list.state.query);

  const print = (r: PayslipRow) => {
    if (!workspaceId) return;
    setPrintError(null);
    void downloadPayPdf(workspaceId, `/ops/payslips/${r.id}/pdf`).catch(setPrintError);
  };

  const columns: DataColumn<PayslipRow>[] = [
    { key: "period", header: "Month", cell: (r) => monthShort(r.period) },
    {
      key: "employee",
      header: "Person",
      cell: (r) => (
        <span className="flex flex-col gap-0.5" data-payslip-row={r.id}>
          <span className="whitespace-nowrap font-semibold text-foreground">{r.employee.displayName}</span>
          <span className="pms-num text-2xs text-muted-foreground">{r.employeeNumber}</span>
        </span>
      ),
    },
    { key: "grossRwf", header: "Gross", align: "end", cell: (r) => fmt(r.grossRwf) },
    { key: "netRwf", header: "Net", align: "end", cell: (r) => <span className="font-semibold">{fmt(r.netRwf)}</span> },
    {
      key: "paid",
      header: "Paid",
      wrap: true,
      // What became of the payslip, in one cell: paid how and when, and whether
      // the person has downloaded it. That was a column of its own, empty on most rows.
      cell: (r) => (
        <span className="flex flex-col items-start gap-0.5">
          {r.status === "draft" ? (
            <Badge intent="neutral">Draft</Badge>
          ) : r.paidAt ? (
            <>
              <Badge intent="ok">
                {PAID_METHOD_LABEL[r.paidMethod ?? "bank"]} · {dshortIso(kigaliDateOf(r.paidAt))}
              </Badge>
              <span className="pms-num text-2xs text-muted-foreground">{r.paidReference}</span>
            </>
          ) : (
            <Badge intent="warn">To pay</Badge>
          )}
          {r.sentAt ? <span className="text-2xs text-muted-foreground">Downloaded by them, {dshortIso(kigaliDateOf(r.sentAt))}</span> : null}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "end",
      // On a narrow page the two buttons stack before the table scrolls.
      wrap: true,
      cell: (r) =>
        r.status !== "confirmed" ? null : (
          <span className="flex justify-end gap-2 @max-4xl:flex-wrap">
            <ActionButton onClick={() => print(r)}>PDF</ActionButton>
            {r.paidAt ? (
              <ActionButton onClick={() => setUnmarking(r)}>Unmark</ActionButton>
            ) : (
              <ActionButton variant="primary" onClick={() => setMarking(r)}>
                Mark paid
              </ActionButton>
            )}
          </span>
        ),
    },
  ];

  const paidLine = `${PAID_METHOD_LABEL[paid.method]} on ${dshortIso(paid.paidOn)}${paid.reference.trim() ? `, reference ${paid.reference.trim()}` : ""}`;

  return (
    <div className="pms-enter @container flex max-w-page flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Mark payslips paid once the money has left: one at a time, or select several and mark them in one go with the
        same way and reference. A wrong reference is unmarked with a reason, then marked again.
      </p>

      <PaidHow value={paid} onChange={setPaid} />

      {marking && (
        <Reveal when={marking.id}>
          <div className="flex flex-col gap-2 rounded-card border border-card-bd bg-card p-4">
            <span className="text-sm text-ink">
              Mark {marking.employee.displayName}&apos;s {monthName(marking.period)} payslip, {fmt(marking.netRwf)}, paid by {paidLine}?
            </span>
            <FormError error={markPaid.error} />
            <div className="flex justify-end gap-2">
              <ActionButton onClick={() => setMarking(null)}>Cancel</ActionButton>
              <ActionButton
                variant="primary"
                pending={markPaid.isPending}
                deniedReason={paid.reference.trim() ? undefined : "Type the reference above first"}
                onClick={() =>
                  markPaid.mutate(
                    { id: marking.id, paidOn: paid.paidOn, method: paid.method, reference: paid.reference.trim() },
                    {
                      onSuccess: (out) => {
                        toast(`${out.employee.displayName}: marked paid`, "ok");
                        setMarking(null);
                      },
                    },
                  )
                }
              >
                Mark paid
              </ActionButton>
            </div>
          </div>
        </Reveal>
      )}

      {unmarking && (
        <ReasonForm
          title={`Unmark ${unmarking.employee.displayName}'s ${monthName(unmarking.period)} payslip (${unmarking.paidReference})`}
          action="Unmark"
          pending={unmark.isPending}
          error={unmark.error}
          placeholder="What was wrong, for the trail"
          onCancel={() => setUnmarking(null)}
          onSubmit={(reason) =>
            unmark.mutate(
              { id: unmarking.id, reason },
              {
                onSuccess: (out) => {
                  toast(`${out.employee.displayName}: no longer marked paid`, "ok");
                  setUnmarking(null);
                },
              },
            )
          }
        />
      )}

      <section className="flex flex-col gap-3">
        <SectionHeading n={page.data?.total}>Payslips</SectionHeading>
        <DataView
          spec={PAYSLIP_LIST}
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
          labelOf={(r) => `${r.employee.displayName}, ${monthName(r.period)}`}
          groupKeyOf={payslipGroupKey}
          caption="Payslips across pay runs"
          searchPlaceholder="Search a name"
          refOptions={{ branch: branches.map((b) => ({ value: b.id, label: b.name })) }}
          bulk={
            workspaceId
              ? {
                  actions: [{ key: "mark_paid", label: `Mark paid: ${paidLine}` }],
                  onSelectAll: () => readListIds(workspaceId, "/ops/payslips", list.state.query),
                  onAction: async (key, ids) => {
                    if (!paid.reference.trim()) throw new Error("Type the reference in the box above the list first.");
                    const answer = await runBulkAction(workspaceId, "/ops/payslips", key, ids, {
                      paidOn: paid.paidOn,
                      method: paid.method,
                      reference: paid.reference.trim(),
                    });
                    void page.refetch();
                    return answer;
                  },
                }
              : undefined
          }
          savedViews={savedViews}
          empty={{ title: "No payslip yet", body: "Payslips appear here when a month's pay run is drafted." }}
        />
        <FormError error={printError} />
      </section>
    </div>
  );
}

/** How the money left: the one set of facts a single or a bulk mark paid sends. */
function PaidHow({ value, onChange }: { value: PaidDraft; onChange: (v: PaidDraft) => void }) {
  return (
    <fieldset className="grid gap-3 rounded-card border border-card-bd bg-card p-4 md:grid-cols-3">
      <legend className="sr-only">How the payslips were paid</legend>
      <Field label="Paid on" htmlFor="paid-on">
        <Input id="paid-on" type="date" value={value.paidOn} max={todayIso()} onChange={(e) => e.target.value && onChange({ ...value, paidOn: e.target.value })} className={inputClass} />
      </Field>
      <Field label="Paid by">
        <SelectField
          label="Paid by"
          value={value.method}
          onChange={(v) => onChange({ ...value, method: v === "momo" ? "momo" : v === "cash" ? "cash" : "bank" })}
          options={(["bank", "momo", "cash"] as const).map((m) => ({ value: m, label: PAID_METHOD_LABEL[m] }))}
        />
      </Field>
      <Field label="Reference" hint="The bank's transfer reference, or the cash book's page." htmlFor="paid-ref">
        <Input id="paid-ref" maxLength={120} value={value.reference} onChange={(e) => onChange({ ...value, reference: e.target.value })} className={inputClass} />
      </Field>
    </fieldset>
  );
}

function payslipGroupKey(r: PayslipRow, field: string): string | null {
  switch (field) {
    case "period":
      return r.period;
    case "branch":
      return r.branchId;
    case "paid":
      return r.paidAt ? "true" : "false";
    case "paidMethod":
      return r.paidMethod;
    default:
      return null;
  }
}
