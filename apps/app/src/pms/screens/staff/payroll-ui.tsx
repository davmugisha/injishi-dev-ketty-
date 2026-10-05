"use client";

/**
 * What the Payroll screens share (058-payroll): the sections of the lens, the
 * month's name, how a payslip line reads, and the inline form that asks for a
 * reason before an act the trail must explain. Nothing here reads data or
 * decides a permission.
 */

import type { PaidMethod, Permission, PayslipLine } from "@injishi/contracts";
import { Input } from "@injishi/ui";
import Link from "next/link";
import { useState } from "react";

import { cn } from "@/lib/utils";

import { ActionButton } from "../../components/ui";
import { fmt } from "../../lib/format";
import { FormError, inputClass } from "./staff-ui";

/** The sections of the Payroll lens, each a route segment under `/staff/payroll` (058-payroll AC-PY15). */
export const PAYROLL_SECTIONS: readonly {
  key: "overview" | "payslips" | "contracts" | "loans" | "claims" | "adjustments" | "components" | "rules" | "settings";
  label: string;
  segment: string;
  anyPermission: readonly Permission[];
}[] = [
  { key: "overview", label: "Overview", segment: "", anyPermission: ["payroll.run"] },
  { key: "payslips", label: "Payslips", segment: "payslips", anyPermission: ["payroll.run"] },
  // A contract is written on a person's file, so whoever writes them reads the list too.
  { key: "contracts", label: "Contracts", segment: "contracts", anyPermission: ["people.manage", "payroll.run"] },
  { key: "loans", label: "Loans and advances", segment: "loans", anyPermission: ["payroll.run"] },
  { key: "claims", label: "Claims", segment: "claims", anyPermission: ["payroll.run"] },
  { key: "adjustments", label: "Adjustments", segment: "adjustments", anyPermission: ["payroll.run"] },
  { key: "components", label: "Allowances and deductions", segment: "components", anyPermission: ["payroll.run"] },
  { key: "rules", label: "Rules in force", segment: "rules", anyPermission: ["payroll.run"] },
  { key: "settings", label: "Settings", segment: "settings", anyPermission: ["payroll.run"] },
];

export type PayrollSection = (typeof PAYROLL_SECTIONS)[number]["key"];

/** The row of sections under the Staff rail. */
export function PayrollNav({
  base,
  active,
  sections,
}: {
  base: string;
  active: PayrollSection;
  sections: readonly (typeof PAYROLL_SECTIONS)[number][];
}) {
  return (
    <nav aria-label="Payroll sections" className="flex flex-wrap items-center gap-2">
      {sections.map((s) => {
        const on = s.key === active;
        return (
          <Link
            key={s.key}
            href={s.segment ? `${base}/payroll/${s.segment}` : `${base}/payroll`}
            aria-current={on ? "page" : undefined}
            className={cn(
              "rounded-full border px-3 py-1 text-sm font-semibold no-underline",
              on ? "border-accent-text bg-accent-soft text-accent-text" : "border-card-bd bg-card text-ink2 hover:bg-hover",
            )}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** `September 2026` from `2026-09`. */
export function monthName(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
}

/** The month after `2026-09`. */
export function nextPeriodOf(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

export const PAID_METHOD_LABEL: Record<PaidMethod, string> = { bank: "Bank", momo: "MoMo", cash: "Cash" };

/** A payslip line's amount as the payslip prints it: what is paid, what is taken, what the business adds. */
export function lineAmount(l: Pick<PayslipLine, "side" | "amountRwf">): string {
  if (l.side === "earning") return l.amountRwf < 0 ? `${fmt(Math.abs(l.amountRwf))} off` : fmt(l.amountRwf);
  if (l.side === "passthrough") return `+${fmt(l.amountRwf)}`;
  if (l.side === "employer") return `(employer) ${fmt(l.amountRwf)}`;
  return `−${fmt(Math.abs(l.amountRwf))}`;
}

/** Which part of the payslip a line sits in. */
export const SIDE_GROUP: Record<PayslipLine["side"], string> = {
  earning: "Earnings",
  employee: "Withheld",
  deduction: "Deductions",
  passthrough: "Paid with the net, not income",
  employer: "The business adds",
};

/**
 * Ask for a reason, then act. The trail keeps the reason beside the act, so
 * the button stays shut until three letters are typed, as the server asks.
 */
export function ReasonForm({
  title,
  action,
  pending,
  error,
  onSubmit,
  onCancel,
  placeholder,
}: {
  title: string;
  action: string;
  pending: boolean;
  error: unknown;
  onSubmit: (reason: string) => void;
  onCancel: () => void;
  placeholder?: string;
}) {
  const [reason, setReason] = useState("");
  const id = `reason-${action.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <form
      className="flex flex-col gap-3 rounded-card border border-card-bd bg-card p-4"
      onSubmit={(ev) => {
        ev.preventDefault();
        if (reason.trim().length >= 3) onSubmit(reason.trim());
      }}
    >
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {title}
      </label>
      <Input
        id={id}
        required
        minLength={3}
        maxLength={300}
        value={reason}
        placeholder={placeholder ?? "Why, in a few words"}
        onChange={(e) => setReason(e.target.value)}
        className={inputClass}
      />
      <FormError error={error} />
      <div className="flex justify-end gap-2">
        <ActionButton type="button" onClick={onCancel}>
          Cancel
        </ActionButton>
        <ActionButton
          variant="primary"
          type="submit"
          pending={pending}
          deniedReason={reason.trim().length < 3 ? "Say why first" : undefined}
        >
          {action}
        </ActionButton>
      </div>
    </form>
  );
}
