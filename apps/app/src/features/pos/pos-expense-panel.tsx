"use client";

import { Button, Input, Label, TextField, ToggleButton } from "@heroui/react";
import { useState } from "react";
import type { PosExpenseRow } from "@/server/pos";
import { recordExpenseAction, voidExpenseAction } from "./actions";
import { DataTable, EXPENSE_CATEGORY_NAME, METHOD_NAME, Panel } from "./back-office";
import { rwf, shortDay } from "./format";
import { PosDialog, parseRwf, usePosAction } from "./shared";

const CATEGORIES = ["utilities", "cleaning", "repairs", "security", "insurance", "other"] as const;
const METHODS = [
  ["cash", "Cash"],
  ["momo", "Mobile money"],
  ["bank", "Bank"],
  ["other", "Other"],
] as const;
const METHOD_TEXT: Record<string, string> = { ...METHOD_NAME, momo: "Mobile money", bank: "Bank" };

/**
 * The business's expenses in the report's period (POS spec section 13): who was paid, what for, how, and a
 * void with a reason where one was entered by mistake. They feed the profit and loss. Recording and voiding
 * need the expense permission; everyone who can read the report sees the list.
 */
export function PosExpensePanel({
  rows,
  outletId,
  canManage,
}: {
  rows: PosExpenseRow[];
  outletId: string | null;
  canManage: boolean;
}) {
  const { run, pending } = usePosAction();
  const [form, setForm] = useState<{
    category: string;
    method: string;
    amount: string;
    payee: string;
    note: string;
  } | null>(null);
  const [voiding, setVoiding] = useState<{ row: PosExpenseRow; reason: string } | null>(null);
  const amount = form ? parseRwf(form.amount) : null;

  return (
    <Panel
      title="Expenses"
      note="Recorded costs of running the business. Voided ones are removed from the totals and kept in the audit trail."
      action={
        canManage ? (
          <Button
            size="sm"
            onPress={() => setForm({ category: "utilities", method: "cash", amount: "", payee: "", note: "" })}
          >
            Record expense
          </Button>
        ) : null
      }
    >
      <DataTable
        columns={[
          { label: "Date" },
          { label: "Category" },
          { label: "Paid to" },
          { label: "Method" },
          { label: "Amount", align: "right" },
          { label: "" },
        ]}
        empty="No expenses recorded in this period."
        rows={rows.map((r) => [
          shortDay(r.paidOn),
          EXPENSE_CATEGORY_NAME[r.category] ?? r.category,
          <span key="p" className="block max-w-[220px] truncate" title={r.note ?? undefined}>
            {r.payeeName ?? r.note ?? "-"}
          </span>,
          METHOD_TEXT[r.method] ?? r.method,
          rwf(r.amountRwf),
          canManage ? (
            <Button key="v" size="sm" variant="ghost" onPress={() => setVoiding({ row: r, reason: "" })}>
              Void
            </Button>
          ) : (
            ""
          ),
        ])}
      />

      {form ? (
        <PosDialog
          isOpen
          onOpenChange={(open) => !open && setForm(null)}
          title="Record an expense"
          subtitle="Counted in the profit and loss from the date paid. Saved with your name."
          footer={
            <>
              <Button variant="secondary" onPress={() => setForm(null)}>
                Cancel
              </Button>
              <Button
                isDisabled={pending || !amount}
                onPress={() =>
                  run(
                    () =>
                      recordExpenseAction({
                        outletId: outletId ?? undefined,
                        category: form.category,
                        amountRwf: amount ?? 0,
                        method: form.method,
                        payeeName: form.payee.trim() || undefined,
                        note: form.note.trim() || undefined,
                      }),
                    "Expense recorded",
                    () => setForm(null),
                  )
                }
              >
                Record
              </Button>
            </>
          }
        >
          <fieldset className="flex flex-wrap gap-1.5 m-0 min-w-0 border-0 p-0" aria-label="Category">
            {CATEGORIES.map((c) => (
              <ToggleButton key={c} isSelected={form.category === c} onChange={() => setForm({ ...form, category: c })}>
                {EXPENSE_CATEGORY_NAME[c]}
              </ToggleButton>
            ))}
          </fieldset>
          <TextField value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} fullWidth isRequired>
            <Label>Amount (RWF)</Label>
            <Input inputMode="numeric" className="tabular" />
          </TextField>
          <fieldset className="flex flex-wrap gap-1.5 m-0 min-w-0 border-0 p-0" aria-label="How it was paid">
            {METHODS.map(([value, label]) => (
              <ToggleButton
                key={value}
                isSelected={form.method === value}
                onChange={() => setForm({ ...form, method: value })}
              >
                {label}
              </ToggleButton>
            ))}
          </fieldset>
          <TextField value={form.payee} onChange={(v) => setForm({ ...form, payee: v })} fullWidth>
            <Label>Paid to (optional)</Label>
            <Input />
          </TextField>
          <TextField value={form.note} onChange={(v) => setForm({ ...form, note: v })} fullWidth>
            <Label>Note (optional)</Label>
            <Input />
          </TextField>
        </PosDialog>
      ) : null}

      {voiding ? (
        <PosDialog
          isOpen
          onOpenChange={(open) => !open && setVoiding(null)}
          title="Void this expense"
          subtitle={`${EXPENSE_CATEGORY_NAME[voiding.row.category] ?? voiding.row.category} · ${rwf(voiding.row.amountRwf)}`}
          footer={
            <>
              <Button variant="secondary" onPress={() => setVoiding(null)}>
                Keep it
              </Button>
              <Button
                variant="danger"
                isDisabled={pending || voiding.reason.trim().length < 3}
                onPress={() =>
                  run(
                    () => voidExpenseAction(voiding.row.id, voiding.reason.trim()),
                    "Expense voided",
                    () => setVoiding(null),
                  )
                }
              >
                Void expense
              </Button>
            </>
          }
        >
          <TextField
            value={voiding.reason}
            onChange={(v) => setVoiding({ ...voiding, reason: v })}
            fullWidth
            isRequired
          >
            <Label>Why is it being voided? (required)</Label>
            <Input />
          </TextField>
        </PosDialog>
      ) : null}
    </Panel>
  );
}
