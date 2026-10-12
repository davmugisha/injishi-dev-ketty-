"use client";

/**
 * Payroll · Contracts (058-payroll AC-PY15): every contract of the business in
 * one list, with the pay terms each carries.
 *
 * A contract is written on the person's file; a raise is a new contract that
 * shortens the last one to the day before, so the wage and the dates of a
 * contract never change. What does change here is what the contract carries:
 * the pay structure whose allowances and deductions apply to it, and its
 * notice in days. Either applies to runs not yet confirmed. Whoever writes
 * contracts or runs pay reads and sets these; only a payroll.run holder sees
 * the structures to choose from.
 *
 * CHANGE PAY IS HERE TOO. The rule above is right and was a dead end on this
 * screen: the one list of everybody's wages offered no way to change one, and
 * the way that existed was three screens off, on the person's file, under a
 * button that says "New contract". Change pay asks the two things a raise is
 * (how much, from when) and writes that new contract through the same command
 * the file uses, for whoever may write contracts (`people.manage`). Nothing
 * about how pay is kept changes: the old contract ends the day before, and
 * both stay on the file.
 */

import { CONTRACT_LIST, type ContractRow, type ContractType } from "@injishi/contracts";
import { DataView, Input, type DataColumn } from "@injishi/ui";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { ActionButton, Badge, SectionHeading, SelectField } from "../../components/ui";
import { useCapability, useWorkspaceId } from "../../data/capability";
import { useListUrl, useSavedViewsFor } from "../../data/lists";
import { useContractPage, usePayStructures, useUpdateContractPayTerms } from "../../data/payroll";
import { useCreateContract } from "../../data/people";
import { addDaysIso, dshortIso, fmt, todayIso } from "../../lib/format";
import { workspaceBase } from "../../lib/nav";
import { usePms } from "../../store";
import { currentGrant } from "../../store/helpers";
import { Field, FormError, Reveal, inputClass, useNarrowScreen } from "./staff-ui";

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
  const [raising, setRaising] = useState<ContractRow | null>(null);
  const { can } = useCapability();
  const mayWrite = can("people.manage");
  const staff = `${workspaceBase(workspaceId)}/staff`;

  const { defaultView, savedViews } = useSavedViewsFor(workspaceId, CONTRACT_LIST.key);
  const list = useListUrl(CONTRACT_LIST, "full", defaultView);
  const page = useContractPage(workspaceId, list.state.query);
  const structureName = (id: string | null) => (id ? (structures.data ?? []).find((s) => s.id === id)?.name ?? "A structure" : null);

  const narrow = useNarrowScreen(1130);

  const columns: DataColumn<ContractRow>[] = [
    {
      key: "employee",
      header: "Person",
      cell: (r) => (
        <Link href={`${staff}/${r.employee.employeeId}/contracts`} className="flex flex-col gap-0.5 no-underline hover:underline" data-contract={r.id}>
          <span className="whitespace-nowrap font-semibold text-foreground">{r.employee.displayName}</span>
          <span className="pms-num text-2xs text-muted-foreground">{r.employeeNumber}</span>
        </Link>
      ),
    },
    { key: "contractType", header: "Kind", wrap: true, cell: (r) => r.contractType.replace(/_/g, " ") },
    {
      key: "startsOn",
      header: "Dates",
      wrap: true,
      // Two dates break between them, never inside one, and only on a narrow page.
      cell: (r) => (
        <span className="flex gap-x-1 @max-4xl:flex-wrap">
          <span className="whitespace-nowrap">{dshortIso(r.startsOn)}</span>
          <span className="whitespace-nowrap">to {r.endsOn ? dshortIso(r.endsOn) : "open"}</span>
        </span>
      ),
    },
    {
      key: "wageBasis",
      header: "Wage",
      align: "end",
      cell: (r) => (
        <span className="flex flex-col items-end">
          {fmt(r.wageRwf)}
          <span className="text-2xs text-muted-foreground">{BASIS[r.wageBasis]}</span>
        </span>
      ),
    },
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
      // On a narrow page the two buttons stack before the table scrolls.
      wrap: true,
      cell: (r) =>
        r.status === "ended" ? null : (
          <span className="flex justify-end gap-2 @max-4xl:flex-wrap">
            {mayWrite && (
              <ActionButton
                onClick={() => {
                  setEditing(null);
                  setRaising(r);
                }}
              >
                Change pay
              </ActionButton>
            )}
            <ActionButton
              onClick={() => {
                setRaising(null);
                setEditing(r);
              }}
            >
              Pay terms
            </ActionButton>
          </span>
        ),
    },
  ];

  return (
    <div className="pms-enter @container flex max-w-page flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Every contract, running and ended. Change pay gives somebody a new wage from a day you choose; the structure and
        the notice a contract carries are set under Pay terms.
      </p>
      {raising && (
        <Reveal when={raising.id}>
          <ChangePayForm key={raising.id} contract={raising} onDone={() => setRaising(null)} />
        </Reveal>
      )}
      {editing && (
        <Reveal when={editing.id}>
          <PayTermsForm key={editing.id} contract={editing} onDone={() => setEditing(null)} />
        </Reveal>
      )}
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
          // A small laptop starts without the pay terms: they are behind the Pay terms button on each row.
          defaultColumns={narrow ? ["employee", "contractType", "startsOn", "wageBasis", "status", "actions"] : undefined}
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

/**
 * A raise, or a cut: how much, and from when. It writes a new contract of the
 * same kind and basis through the file's own command; the server ends the one
 * before it the day before and refuses a start that is not after it.
 */
function ChangePayForm({ contract, onDone }: { contract: ContractRow; onDone: () => void }) {
  const { toast } = usePms();
  const workspaceId = useWorkspaceId();
  const client = useQueryClient();
  const create = useCreateContract(workspaceId);
  // The earliest a new contract may start: the day after this one did.
  const earliest = addDaysIso(contract.startsOn, 1);
  const [startsOn, setStartsOn] = useState(todayIso() > earliest ? todayIso() : earliest);
  const [wage, setWage] = useState("");
  const amount = Number(wage.replace(/[^\d]/g, ""));
  const change = amount > 0 ? amount - contract.wageRwf : 0;

  return (
    <form
      className="flex flex-col gap-4 rounded-card border border-card-bd bg-card p-5"
      onSubmit={(ev) => {
        ev.preventDefault();
        create.mutate(
          {
            id: contract.employee.employeeId,
            body: {
              contractType: contract.contractType as ContractType,
              startsOn,
              // A fixed term keeps its end; an open contract stays open.
              endsOn: contract.endsOn,
              wageBasis: contract.wageBasis,
              wageRwf: amount,
            },
          },
          {
            onSuccess: () => {
              void client.invalidateQueries({ queryKey: ["ops", "contracts"] });
              void client.invalidateQueries({ queryKey: ["ops", "payroll-dashboard"] });
              toast(
                `${contract.employee.displayName} is paid ${fmt(amount)} ${BASIS[contract.wageBasis]} from ${dshortIso(startsOn)}. A draft pay run shows it once it is recomputed.`,
                "ok",
              );
              onDone();
            },
          },
        );
      }}
    >
      <SectionHeading>Change pay for {contract.employee.displayName}</SectionHeading>
      <p className="text-sm text-muted-foreground">
        Now {fmt(contract.wageRwf)} {BASIS[contract.wageBasis]}, since {dshortIso(contract.startsOn)}. The new pay starts on
        the day you choose; what was earned before it is paid at the old one.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label={`New pay, ${BASIS[contract.wageBasis]}`}
          htmlFor="change-pay-wage"
          hint={change === 0 ? "In RWF, before tax and contributions." : `${change > 0 ? "A raise" : "A cut"} of ${fmt(Math.abs(change))}.`}
        >
          <Input
            id="change-pay-wage"
            inputMode="numeric"
            placeholder={String(contract.wageRwf)}
            value={wage}
            onChange={(e) => setWage(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="From" htmlFor="change-pay-from" hint={`No earlier than ${dshortIso(earliest)}, the day after this contract began.`}>
          <Input
            id="change-pay-from"
            type="date"
            min={earliest}
            value={startsOn}
            onChange={(e) => e.target.value && setStartsOn(e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>
      <FormError error={create.error} />
      <div className="flex justify-end gap-2">
        <ActionButton type="button" onClick={onDone}>
          Cancel
        </ActionButton>
        <ActionButton
          variant="primary"
          type="submit"
          pending={create.isPending}
          deniedReason={amount <= 0 ? "Type the new pay first." : amount === contract.wageRwf ? "That is what they are paid now." : undefined}
        >
          Save the new pay
        </ActionButton>
      </div>
    </form>
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
