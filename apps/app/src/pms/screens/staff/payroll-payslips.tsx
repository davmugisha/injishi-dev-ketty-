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
 *
 * WHAT IS OWED FIRST. The screen opened on three boxes (paid on, paid by,
 * reference) above a list, with nothing saying what they were for until a
 * button further down used them. It opens on three figures now: how much is
 * waiting to be paid and to how many, how many are paid, how many are still
 * drafts. The three boxes appear when they are needed: beside one payslip when
 * its Mark paid is pressed, or under "Mark several paid", which says the three
 * steps. Nothing about what is sent has changed.
 */

import { ListQuery, PAYSLIP_LIST, SavedViewConfig, type PaidMethod, type PayslipRow } from "@injishi/contracts";
import { DataView, Input, type DataColumn } from "@injishi/ui";
import { useState } from "react";

import { ActionButton, Badge, SectionHeading, SelectField, StatCard } from "../../components/ui";
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

/**
 * The list opens on confirmed payslips: they are what can be paid or printed,
 * and a month's drafts would otherwise fill the first page above them. Drafts
 * and All are one press away, and a default view somebody saved wins.
 */
const CONFIRMED_FIRST = SavedViewConfig.parse({ filters: [{ field: "status", op: "eq", value: "confirmed" }] });

/** Every payslip not yet paid, drafts among them: the figures above the list are counted from these. */
const NOT_PAID = ListQuery.parse({ filters: [{ field: "paid", op: "eq", value: false }], pageSize: 100 });

export function Payslips() {
  const { state, toast } = usePms();
  const workspaceId = useWorkspaceId();
  const branches = currentGrant(state)?.branches ?? [];
  const markPaid = useMarkPaid(workspaceId);
  const unmark = useUnmarkPaid(workspaceId);
  const [paid, setPaid] = useState<PaidDraft>({ paidOn: todayIso(), method: "bank", reference: "" });
  // One payslip being marked paid, or "several": the list's ticks and its bar do the marking.
  const [marking, setMarking] = useState<PayslipRow | "several" | null>(null);
  const [unmarking, setUnmarking] = useState<PayslipRow | null>(null);
  const [printError, setPrintError] = useState<unknown>(null);

  const { defaultView, savedViews } = useSavedViewsFor(workspaceId, PAYSLIP_LIST.key);
  // Wait for the saved views before falling back, or the fallback would open first and for good.
  const list = useListUrl(PAYSLIP_LIST, "full", savedViews.views === undefined ? null : (defaultView ?? CONFIRMED_FIRST));
  const page = usePayslipPage(workspaceId, list.state.query);
  const notPaid = usePayslipPage(workspaceId, NOT_PAID);
  const owed = (notPaid.data?.items ?? []).filter((r) => r.status === "confirmed" && !r.paidAt);
  const drafts = (notPaid.data?.items ?? []).filter((r) => r.status === "draft").length;
  // Past a hundred unpaid rows the sum would be of the first hundred: say the count, not a wrong total.
  const counted = notPaid.data !== undefined && notPaid.data.total <= notPaid.data.items.length;
  const owedRwf = owed.reduce((sum, r) => sum + r.netRwf, 0);

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
      header: "Status",
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
                Paid · {PAID_METHOD_LABEL[r.paidMethod ?? "bank"]} · {dshortIso(kigaliDateOf(r.paidAt))}
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

  const one = marking !== null && marking !== "several" ? marking : null;

  return (
    <div className="pms-enter @container flex max-w-page flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 @2xl:grid-cols-3" data-payslip-figures>
        <StatCard
          n={notPaid.data === undefined ? "…" : counted ? fmt(owedRwf) : String(owed.length)}
          label={
            notPaid.data === undefined
              ? "Waiting to be paid"
              : owed.length === 0
                ? "Nothing is waiting to be paid"
                : `Waiting to be paid, to ${owed.length} ${owed.length === 1 ? "person" : "people"}`
          }
        />
        <StatCard
          n={page.data === undefined || notPaid.data === undefined ? "…" : String(Math.max(0, (page.data.statusCounts?.find((c) => c.value === "confirmed")?.count ?? 0) - owed.length))}
          label="Already paid"
        />
        <StatCard n={notPaid.data === undefined ? "…" : String(drafts)} label={drafts === 0 ? "Drafts" : "Drafts: payable once their month is confirmed"} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-64 flex-1 text-sm text-muted-foreground">
          A confirmed payslip waits here until the money has left. Mark it paid with the bank&apos;s or MoMo&apos;s
          reference, so the same payment is never recorded twice.
        </p>
        {marking === null && owed.length > 1 && (
          <ActionButton variant="primary" onClick={() => setMarking("several")}>
            Mark several paid
          </ActionButton>
        )}
      </div>

      {marking !== null && (
        <Reveal when={one ? one.id : "several"}>
          <div className="flex flex-col gap-3 rounded-card border border-card-bd bg-card p-5" data-mark-paid={one ? one.id : "several"}>
            <span className="text-sm font-bold text-ink">
              {one ? `Mark ${one.employee.displayName}'s ${monthName(one.period)} payslip paid, ${fmt(one.netRwf)}` : "Mark several payslips paid"}
            </span>
            {!one && (
              <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-ink2">
                <li>Say below how they were paid: one payment, one reference.</li>
                <li>Tick the payslips in the list.</li>
                <li>Press Mark paid in the bar that appears above the list.</li>
              </ol>
            )}
            <PaidHow value={paid} onChange={setPaid} />
            <FormError error={one ? markPaid.error : null} />
            <div className="flex flex-wrap justify-end gap-2">
              <ActionButton onClick={() => setMarking(null)}>{one ? "Cancel" : "Close"}</ActionButton>
              {one && (
                <ActionButton
                  variant="primary"
                  pending={markPaid.isPending}
                  deniedReason={paid.reference.trim() ? undefined : "Type the reference first"}
                  onClick={() =>
                    markPaid.mutate(
                      { id: one.id, paidOn: paid.paidOn, method: paid.method, reference: paid.reference.trim() },
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
              )}
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
                  actions: [{ key: "mark_paid", label: paid.reference.trim() ? `Mark paid: ${paidLine}` : "Mark paid" }],
                  onSelectAll: () => readListIds(workspaceId, "/ops/payslips", list.state.query),
                  onAction: async (key, ids) => {
                    if (!paid.reference.trim()) {
                      // The boxes are shut until they are needed; this is when.
                      setMarking("several");
                      throw new Error("Say how they were paid first: the reference is missing. The boxes are open above the list.");
                    }
                    const answer = await runBulkAction(workspaceId, "/ops/payslips", key, ids, {
                      paidOn: paid.paidOn,
                      method: paid.method,
                      reference: paid.reference.trim(),
                    });
                    void page.refetch();
                    void notPaid.refetch();
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
    <fieldset className="grid grid-cols-1 gap-3 @2xl:grid-cols-3">
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
      <Field label="Reference" hint="From the bank or MoMo, or the cash book's page." htmlFor="paid-ref">
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
