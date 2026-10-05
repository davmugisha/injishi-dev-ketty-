"use client";

/**
 * Payroll · Contracts (058-payroll AC-PY15): every contract of the business in
 * one list, with the pay terms each carries.
 *
 * A contract is written on the person's file; a raise is a new contract that
 * shortens the last one to the day before, so the wage and the dates never
 * change here. What does change here is what the contract carries: the pay
 * structure whose allowances and deductions apply to it, and its notice in
 * days. Either applies to runs not yet confirmed. Whoever writes contracts or
 * runs pay reads and sets these; only a payroll.run holder sees the structures
 * to choose from.
 */

import { CONTRACT_LIST, type ContractRow } from "@injishi/contracts";
import { DataView, Input, type DataColumn } from "@injishi/ui";
import Link from "next/link";
import { useState } from "react";

import { ActionButton, Badge, SectionHeading, SelectField } from "../../components/ui";
import { useCapability, useWorkspaceId } from "../../data/capability";
import { useListUrl, useSavedViewsFor } from "../../data/lists";
import { useContractPage, usePayStructures, useUpdateContractPayTerms } from "../../data/payroll";
import { dshortIso, fmt } from "../../lib/format";
import { workspaceBase } from "../../lib/nav";
import { usePms } from "../../store";
import { currentGrant } from "../../store/helpers";
import { Field, FormError, inputClass } from "./staff-ui";

const BASIS: Record<ContractRow["wageBasis"], string> = { monthly: "a month", daily: "a day", hourly: "an hour" };
const STATUS: Record<string, { label: string; intent: "ok" | "warn" | "neutral" }> = {
  draft: { label: "Starting", intent: "warn" },
  active: { label: "Running", intent: "ok" },
  ended: { label: "Ended", intent: "neutral" },
};

export function PayContracts() {
  const { state } = usePms();
  const workspaceId = useWorkspaceId();
  const branches = currentGrant(state)?.branches ?? [];
  const structures = usePayStructures(workspaceId);
  const [editing, setEditing] = useState<ContractRow | null>(null);
  const staff = `${workspaceBase(workspaceId)}/staff`;

  const { defaultView, savedViews } = useSavedViewsFor(workspaceId, CONTRACT_LIST.key);
  const list = useListUrl(CONTRACT_LIST, "full", defaultView);
  const page = useContractPage(workspaceId, list.state.query);
  const structureName = (id: string | null) => (id ? (structures.data ?? []).find((s) => s.id === id)?.name ?? "A structure" : null);

  const columns: DataColumn<ContractRow>[] = [
    {
      key: "employee",
      header: "Person",
      cell: (r) => (
        <Link href={`${staff}/${r.employee.employeeId}/contracts`} className="flex flex-col gap-0.5 no-underline hover:underline" data-contract={r.id}>
          <span className="font-semibold text-foreground">{r.employee.displayName}</span>
          <span className="pms-num text-2xs text-muted-foreground">{r.employeeNumber}</span>
        </Link>
      ),
    },
    { key: "contractType", header: "Kind", cell: (r) => r.contractType.replace(/_/g, " ") },
    {
      key: "startsOn",
      header: "Dates",
      cell: (r) => `${dshortIso(r.startsOn)} to ${r.endsOn ? dshortIso(r.endsOn) : "open"}`,
    },
    { key: "wageBasis", header: "Wage", align: "end", cell: (r) => `${fmt(r.wageRwf)} ${BASIS[r.wageBasis]}` },
    {
      key: "terms",
      header: "Pay terms",
      cell: (r) => (
        <span className="flex flex-col gap-0.5 text-2xs text-muted-foreground">
          <span>{structureName(r.payStructureId) ?? "No structure"}</span>
          <span>{r.noticeDays === null ? "Notice not set" : `${r.noticeDays} days' notice`}</span>
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => {
        const s = STATUS[r.status] ?? { label: r.status, intent: "neutral" as const };
        return <Badge intent={s.intent}>{s.label}</Badge>;
      },
    },
    {
      key: "actions",
      header: "",
      align: "end",
      cell: (r) => (r.status === "ended" ? null : <ActionButton onClick={() => setEditing(r)}>Pay terms</ActionButton>),
    },
  ];

  return (
    <div className="pms-enter flex max-w-page flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Every contract, running and ended. A wage changes by a new contract on the person&apos;s file; the structure and
        the notice a contract carries are set here.
      </p>
      {editing && <PayTermsForm contract={editing} onDone={() => setEditing(null)} />}
      <section className="flex flex-col gap-3">
        <SectionHeading n={page.data?.total}>Contracts</SectionHeading>
        <DataView
          spec={CONTRACT_LIST}
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
          groupKeyOf={(r, field) => (field === "wageBasis" ? r.wageBasis : field === "branch" ? r.branchId : null)}
          caption="Every contract of the business"
          searchPlaceholder="Search a name"
          refOptions={{ branch: branches.map((b) => ({ value: b.id, label: b.name })) }}
          savedViews={savedViews}
          empty={{ title: "No contract yet", body: "A contract is added on a person's file, under Contracts." }}
        />
      </section>
    </div>
  );
}

function PayTermsForm({ contract, onDone }: { contract: ContractRow; onDone: () => void }) {
  const { toast } = usePms();
  const workspaceId = useWorkspaceId();
  const { can } = useCapability();
  const structures = usePayStructures(workspaceId);
  const save = useUpdateContractPayTerms(workspaceId);
  const [structureId, setStructureId] = useState(contract.payStructureId ?? "");
  const [notice, setNotice] = useState(contract.noticeDays === null ? "" : String(contract.noticeDays));
  const active = (structures.data ?? []).filter((s) => s.status === "active");

  return (
    <form
      className="flex flex-col gap-4 rounded-card border border-card-bd bg-card p-5"
      onSubmit={(ev) => {
        ev.preventDefault();
        save.mutate(
          {
            id: contract.id,
            ...(can("payroll.run") ? { payStructureId: structureId || null } : {}),
            noticeDays: notice.trim() === "" ? null : Number(notice),
          },
          {
            onSuccess: (out) => {
              toast(`${out.employee.displayName}'s pay terms saved`, "ok");
              onDone();
            },
          },
        );
      }}
    >
      <SectionHeading>Pay terms for {contract.employee.displayName}</SectionHeading>
      <div className="grid gap-4 md:grid-cols-2">
        {can("payroll.run") && (
          <Field label="Pay structure" hint="Its allowances and deductions apply to this contract.">
            <SelectField
              label="Pay structure"
              value={structureId}
              onChange={setStructureId}
              options={[{ value: "", label: "No structure" }, ...active.map((s) => ({ value: s.id, label: s.name }))]}
            />
          </Field>
        )}
        <Field label="Notice in days" hint="Empty when the contract does not say." htmlFor="notice-days">
          <Input id="notice-days" type="number" min={0} max={365} step={1} value={notice} onChange={(e) => setNotice(e.target.value)} className={inputClass} />
        </Field>
      </div>
      <FormError error={save.error} />
      <div className="flex justify-end gap-2">
        <ActionButton type="button" onClick={onDone}>
          Cancel
        </ActionButton>
        <ActionButton variant="primary" type="submit" pending={save.isPending}>
          Save
        </ActionButton>
      </div>
    </form>
  );
}
