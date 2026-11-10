"use client";

import { Plus, Wallet } from "@gravity-ui/icons";
import {
  Alert,
  Button,
  Chip,
  Drawer,
  Input,
  Label,
  Pagination,
  Skeleton,
  Table,
  TextArea,
  TextField,
  toast,
} from "@heroui/react";
import { EmptyState, NativeSelect, Segment } from "@heroui-pro/react";
import { useCallback, useEffect, useState, useTransition } from "react";
import type { PayLoansData } from "../../model/payroll.ts";
import { useHrActions } from "../mount.tsx";
import { firstName, Person } from "../people/parts";
import { pressKey } from "../reported.ts";
import { rwf } from "./pay-calc";

const PAGE = 12;

/** "November 2026" for "2026-11". */
const monthLabel = (period: string) =>
  new Date(`${period}-01T12:00:00Z`).toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
/** "2026-12" for "2026-11". */
const monthAfter = (period: string) => {
  const [y, m] = period.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
};
/** Today in Kigali, "2026-11-06". */
const kigaliToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kigali" }).format(new Date());
/** The francs typed, as a whole number; 0 for nothing readable. */
const whole = (typed: string) => Math.round(Number(typed.replace(/[^0-9]/g, "")) || 0);

interface LoanForm {
  key: string;
  employeeId: string;
  kind: "loan" | "advance";
  amount: string;
  months: string;
  givenOn: string;
  firstPeriod: string;
  paidOut: "payslip" | "outside";
  reason: string;
}

/**
 * Loans and salary advances (`/ops/loans`, `payroll.run`): the ones running, and a form to record a new one.
 * Each month's run takes an installment by itself. Staff see their own on the phone, and ask for an advance
 * through the help desk.
 */
export function LoansPanel({ period, isConfirmed }: { period: string; isConfirmed: boolean }) {
  const { loadLoans, recordLoan } = useHrActions();
  const [data, setData] = useState<PayLoansData | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<LoanForm | null>(null);
  const [pending, start] = useTransition();

  const reload = useCallback(() => {
    loadLoans()
      .then((r) => {
        if (r.ok) {
          setData(r.data);
          setFailure(null);
        } else setFailure(r.error);
      })
      .catch(() => setFailure("Try again in a moment."));
  }, [loadLoans]);
  useEffect(reload, [reload]);

  const open = () => {
    const givenOn = kigaliToday();
    const thisMonth = givenOn.slice(0, 7);
    const openPeriod = isConfirmed ? monthAfter(period) : period;
    setForm({
      key: pressKey(),
      employeeId: "",
      kind: "advance",
      amount: "",
      months: "1",
      givenOn,
      // Repayment cannot start before the money is given, nor in a month already confirmed.
      firstPeriod: openPeriod > thisMonth ? openPeriod : thisMonth,
      paidOut: "payslip",
      reason: "",
    });
  };
  const edit = (patch: Partial<LoanForm>) => setForm((f) => (f ? { ...f, ...patch } : f));

  const amount = form ? whole(form.amount) : 0;
  const months = form ? whole(form.months) : 0;
  const person = data?.people.find((p) => p.id === form?.employeeId);
  const ready = !!form && !!person && amount > 0 && months >= 1 && months <= 120 && months <= amount;
  const word = form?.kind === "loan" ? "Loan" : "Advance";

  const save = () =>
    start(async () => {
      if (!form || !person) return;
      const r = await recordLoan(
        {
          employeeId: form.employeeId,
          kind: form.kind,
          amountRwf: amount,
          givenOn: form.givenOn,
          installments: months,
          firstPeriod: form.firstPeriod,
          paidOut: form.paidOut,
          reason: form.reason.trim() || null,
        },
        form.key,
      );
      if (!r.ok) {
        toast.danger(r.error);
        return;
      }
      toast.success(`${word} of ${rwf(amount)} recorded for ${firstName(person.name)}.`);
      setForm(null);
      reload();
    });

  const loans = data?.loans ?? [];
  const pages = Math.max(1, Math.ceil(loans.length / PAGE));
  const at = Math.min(page, pages);

  return (
    <section className="flex flex-col gap-[10px]" aria-labelledby="loans-h">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="loans-h" className="flex items-center gap-2 text-[15px] leading-[22px] font-semibold">
          Loans and advances
          {loans.length ? (
            <Chip size="sm" variant="soft">
              {loans.length}
            </Chip>
          ) : null}
        </h2>
        <Button size="sm" isDisabled={!data} onPress={open}>
          <Plus className="size-4" aria-hidden="true" />
          New loan or advance
        </Button>
      </div>

      {failure ? (
        <Alert status="danger">
          <Alert.Content>
            <Alert.Title>Could not load loans</Alert.Title>
            <Alert.Description>{failure}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : !data ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
        </div>
      ) : loans.length === 0 ? (
        <EmptyState size="sm" className="py-8">
          <EmptyState.Header>
            <EmptyState.Media variant="icon">
              <Wallet />
            </EmptyState.Media>
            <EmptyState.Title>No loans or advances</EmptyState.Title>
          </EmptyState.Header>
        </EmptyState>
      ) : (
        <>
          <Table variant="secondary">
            <Table.ScrollContainer>
              <Table.Content aria-label="Loans and advances" className="min-w-[680px]">
                <Table.Header>
                  <Table.Column isRowHeader>Person</Table.Column>
                  <Table.Column>Kind</Table.Column>
                  <Table.Column className="text-right">Amount</Table.Column>
                  <Table.Column className="text-right">Left to repay</Table.Column>
                  <Table.Column>Next</Table.Column>
                </Table.Header>
                <Table.Body>
                  {loans.slice((at - 1) * PAGE, at * PAGE).map((l) => (
                    <Table.Row key={l.id} id={l.id}>
                      <Table.Cell>
                        <Person name={l.name} sub={l.title ?? "Staff"} />
                      </Table.Cell>
                      <Table.Cell className="text-[13px]">{l.kind === "loan" ? "Loan" : "Advance"}</Table.Cell>
                      <Table.Cell className="text-right tabular">{rwf(l.amountRwf)}</Table.Cell>
                      <Table.Cell className="text-right font-semibold tabular">{rwf(l.remainingRwf)}</Table.Cell>
                      <Table.Cell>
                        {l.settled || !l.nextPeriod ? (
                          <Chip size="sm" variant="soft" color="success">
                            Repaid
                          </Chip>
                        ) : (
                          <span className="text-[13px] whitespace-nowrap tabular">
                            {rwf(l.nextAmountRwf ?? 0)} in {monthLabel(l.nextPeriod)}
                          </span>
                        )}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
          {pages > 1 ? (
            <Pagination size="sm" className="flex flex-wrap items-center justify-between gap-2">
              <Pagination.Summary className="text-xs text-muted tabular">
                {(at - 1) * PAGE + 1}–{Math.min(at * PAGE, loans.length)} of {loans.length}
              </Pagination.Summary>
              <Pagination.Content>
                <Pagination.Item>
                  <Pagination.Previous aria-label="Previous page" isDisabled={at === 1} onPress={() => setPage(at - 1)}>
                    <Pagination.PreviousIcon />
                  </Pagination.Previous>
                </Pagination.Item>
                {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                  <Pagination.Item key={n}>
                    <Pagination.Link
                      isActive={n === at}
                      aria-label={`Page ${n}`}
                      aria-current={n === at ? "page" : undefined}
                      onPress={() => setPage(n)}
                    >
                      {n}
                    </Pagination.Link>
                  </Pagination.Item>
                ))}
                <Pagination.Item>
                  <Pagination.Next aria-label="Next page" isDisabled={at === pages} onPress={() => setPage(at + 1)}>
                    <Pagination.NextIcon />
                  </Pagination.Next>
                </Pagination.Item>
              </Pagination.Content>
            </Pagination>
          ) : null}
        </>
      )}

      <Drawer.Backdrop isOpen={form !== null} onOpenChange={(on) => (on ? undefined : setForm(null))}>
        <Drawer.Content placement="right">
          <Drawer.Dialog aria-labelledby="loan-h" className="w-full max-w-[460px]">
            <Drawer.CloseTrigger aria-label="Close" />
            <Drawer.Header>
              <Drawer.Heading id="loan-h" className="text-[18px] leading-6 font-semibold">
                New loan or advance
              </Drawer.Heading>
            </Drawer.Header>
            {form ? (
              <Drawer.Body className="flex flex-col gap-3">
                <NativeSelect fullWidth className="flex flex-col gap-1">
                  <Label htmlFor="loan-who">Person</Label>
                  <NativeSelect.Trigger
                    id="loan-who"
                    value={form.employeeId}
                    onChange={(e) => edit({ employeeId: e.target.value })}
                  >
                    <NativeSelect.Option value="">Choose a person</NativeSelect.Option>
                    {(data?.people ?? []).map((p) => (
                      <NativeSelect.Option key={p.id} value={p.id}>
                        {p.title ? `${p.name} · ${p.title}` : p.name}
                      </NativeSelect.Option>
                    ))}
                    <NativeSelect.Indicator />
                  </NativeSelect.Trigger>
                </NativeSelect>
                <div className="flex flex-col gap-1">
                  <Label id="loan-kind">Kind</Label>
                  <Segment
                    aria-labelledby="loan-kind"
                    size="sm"
                    selectedKey={form.kind}
                    onSelectionChange={(k) => edit({ kind: k === "loan" ? "loan" : "advance" })}
                  >
                    <Segment.Item id="advance">Advance</Segment.Item>
                    <Segment.Item id="loan">
                      <Segment.Separator />
                      Loan
                    </Segment.Item>
                  </Segment>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <TextField value={form.amount} onChange={(v) => edit({ amount: v })} className="flex flex-col gap-1">
                    <Label>Amount in RWF</Label>
                    <Input inputMode="numeric" placeholder="50000" className="tabular" />
                  </TextField>
                  <TextField value={form.months} onChange={(v) => edit({ months: v })} className="flex flex-col gap-1">
                    <Label>Months to repay</Label>
                    <Input inputMode="numeric" className="tabular" />
                  </TextField>
                  <TextField
                    value={form.givenOn}
                    onChange={(v) => edit({ givenOn: v })}
                    className="flex flex-col gap-1"
                  >
                    <Label>Given on</Label>
                    <Input type="date" />
                  </TextField>
                  <TextField
                    value={form.firstPeriod}
                    onChange={(v) => edit({ firstPeriod: v })}
                    className="flex flex-col gap-1"
                  >
                    <Label>First month repaid</Label>
                    <Input type="month" />
                  </TextField>
                </div>
                <div className="flex flex-col gap-1">
                  <Label id="loan-paid">How it is paid</Label>
                  <Segment
                    aria-labelledby="loan-paid"
                    size="sm"
                    selectedKey={form.paidOut}
                    onSelectionChange={(k) => edit({ paidOut: k === "outside" ? "outside" : "payslip" })}
                  >
                    <Segment.Item id="payslip">With the month&apos;s pay</Segment.Item>
                    <Segment.Item id="outside">
                      <Segment.Separator />
                      Already handed over
                    </Segment.Item>
                  </Segment>
                </div>
                <TextField value={form.reason} onChange={(v) => edit({ reason: v })} className="flex flex-col gap-1">
                  <Label>Why (optional)</Label>
                  <TextArea rows={2} placeholder="School fees" />
                </TextField>
                {amount > 0 && months >= 1 ? (
                  <p className="text-xs text-muted tabular">
                    About {rwf(amount / months)} a month from {monthLabel(form.firstPeriod)}.
                  </p>
                ) : null}
              </Drawer.Body>
            ) : null}
            <Drawer.Footer className="border-t border-separator">
              <Button variant="ghost" onPress={() => setForm(null)}>
                Cancel
              </Button>
              <Button isPending={pending} isDisabled={!ready} onPress={save}>
                Record {word.toLowerCase()}
              </Button>
            </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </section>
  );
}
