"use client";

import { Button, Checkbox, Label, NumberField, TextArea, TextField, toast } from "@heroui/react";
import { Segment } from "@heroui-pro/react";
import { LinkButton } from "@injishi/ui";
import { useState, useTransition } from "react";
import { useHrActions } from "../mount.tsx";

type Fix = null | "amount" | "hold";

/**
 * What can be done about one person's pay from the pay run: add or take off an amount (whoever confirms
 * pay), pay them next month instead, or open their file for the wage, the start date or where pay goes.
 * Every change computes the month again, so the figures above are the new ones.
 */
export function FixPay({
  employeeId,
  name,
  period,
  runId,
  canAddAmounts,
  editable,
  fileHref,
}: {
  employeeId: string;
  name: string;
  /** "2026-11", the month an amount is paid with. */
  period: string;
  runId: string | null;
  /** Adding or taking off an amount is for whoever confirms pay (`payroll.run`). */
  canAddAmounts: boolean;
  /** Only a draft month changes; a submitted one is withdrawn first. */
  editable: boolean;
  fileHref: string;
}) {
  const { addPayAmount, holdPayslip } = useHrActions();
  const [pending, start] = useTransition();
  const [fix, setFix] = useState<Fix>(null);
  const [side, setSide] = useState<"earning" | "deduction">("earning");
  const [amount, setAmount] = useState(0);
  const [taxed, setTaxed] = useState(true);
  const [reason, setReason] = useState("");
  // One key per form, so a second press of Save records the amount once.
  const [key, setKey] = useState(() => crypto.randomUUID());

  const first = name.split(" ")[0] ?? name;
  const open = (next: Fix) => {
    setFix(fix === next ? null : next);
    setReason("");
    setAmount(0);
    setKey(crypto.randomUUID());
  };

  const saveAmount = () =>
    start(async () => {
      const result = await addPayAmount(
        { employeeId, side, amountRwf: amount, taxed: side === "earning" && taxed, reason: reason.trim(), period },
        key,
        runId,
      );
      if (result.ok) {
        toast.success(side === "earning" ? `Added to ${first}'s pay.` : `Taken off ${first}'s pay.`);
        setFix(null);
      } else toast.danger(result.error);
    });

  const hold = () =>
    start(async () => {
      if (!runId) return;
      const result = await holdPayslip(runId, employeeId, reason.trim());
      if (result.ok) {
        toast.success(`${first} is paid next month.`);
        setFix(null);
      } else toast.danger(result.error);
    });

  return (
    <section aria-labelledby="fix-pay-h" className="flex flex-col gap-3 rounded-xl border border-separator p-3">
      <h3 id="fix-pay-h" className="text-sm font-semibold">
        Something wrong?
      </h3>
      {!editable ? (
        <p className="text-sm text-muted">Withdraw the month to change it.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {canAddAmounts ? (
            <Button size="sm" variant={fix === "amount" ? "primary" : "secondary"} onPress={() => open("amount")}>
              Add or take off an amount
            </Button>
          ) : null}
          {runId ? (
            <Button size="sm" variant={fix === "hold" ? "primary" : "secondary"} onPress={() => open("hold")}>
              Pay next month
            </Button>
          ) : null}
        </div>
      )}
      <LinkButton href={fileHref} size="sm" variant="ghost" className="self-start">
        Wage, start date or pay account
      </LinkButton>
      {editable && !canAddAmounts ? (
        <p className="text-xs text-muted">Only the owner can add or take off an amount.</p>
      ) : null}

      {editable && fix === "amount" ? (
        <div className="flex flex-col gap-3">
          <Segment
            aria-label="Add or take off"
            selectedKey={side}
            onSelectionChange={(k) => setSide(String(k) === "deduction" ? "deduction" : "earning")}
            className="w-full"
          >
            <Segment.Item id="earning" className="flex-1">
              Add to pay
            </Segment.Item>
            <Segment.Item id="deduction" className="flex-1">
              <Segment.Separator />
              Take off pay
            </Segment.Item>
          </Segment>
          <NumberField
            variant="secondary"
            minValue={0}
            step={1000}
            value={amount}
            onChange={(v) => setAmount(Math.max(0, Math.round(Number.isFinite(v) ? v : 0)))}
            formatOptions={{ style: "currency", currency: "RWF", maximumFractionDigits: 0 }}
            className="flex flex-col gap-1"
          >
            <Label>Amount</Label>
            <NumberField.Group>
              <NumberField.DecrementButton />
              <NumberField.Input className="tabular" />
              <NumberField.IncrementButton />
            </NumberField.Group>
          </NumberField>
          <TextField value={reason} onChange={setReason} className="flex flex-col gap-1">
            <Label>Why</Label>
            <TextArea rows={2} placeholder={side === "earning" ? "Overtime not counted on 2 Nov" : "Broken glass"} />
          </TextField>
          {side === "earning" ? (
            <Checkbox isSelected={taxed} onChange={setTaxed}>
              <Checkbox.Content className="flex items-center gap-2 text-sm">
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                PAYE and RSSB apply
              </Checkbox.Content>
            </Checkbox>
          ) : null}
          <Button
            size="sm"
            isPending={pending}
            isDisabled={amount <= 0 || reason.trim().length < 3}
            onPress={saveAmount}
            className="self-end"
          >
            Save and compute again
          </Button>
        </div>
      ) : null}

      {editable && fix === "hold" ? (
        <div className="flex flex-col gap-3">
          <TextField value={reason} onChange={setReason} className="flex flex-col gap-1">
            <Label>Why</Label>
            <TextArea rows={2} placeholder="Their bank account is being checked" />
          </TextField>
          <Button
            size="sm"
            isPending={pending}
            isDisabled={reason.trim().length < 3}
            onPress={hold}
            className="self-end"
          >
            Pay {first} next month
          </Button>
        </div>
      ) : null}
    </section>
  );
}
