"use client";

/**
 * What the Payroll screens share (058-payroll): the sections of the lens, the
 * month's name, how a payslip line reads, and the inline form that asks for a
 * reason before an act the trail must explain. Nothing here reads data or
 * decides a permission.
 */

import type { PaidMethod, Permission, PayslipLine } from "@injishi/contracts";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Input } from "@injishi/ui";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { cn } from "@/lib/utils";

import { ActionButton } from "../../components/ui";
import { fmt } from "../../lib/format";
import { FormError, Reveal, inputClass } from "./staff-ui";

/**
 * The sections of the Payroll lens, each a route segment under `/staff/payroll` (058-payroll AC-PY15).
 *
 * Each section's `anyPermission` is the declaration of the reads it makes, so a
 * grant is offered exactly the sections whose reads the API answers. The
 * Overview and the Rules in force admit `payroll.draft` beside `payroll.run`
 * (ADR-069 D-e): the dashboard, the runs and the national rules are what a
 * draft is built from, and the HR officer who drafts the month holds the first
 * and not the second. Everything a CONFIRMED run produces stays `payroll.run`'s.
 */
export const PAYROLL_SECTIONS: readonly {
  key: "overview" | "payslips" | "contracts" | "loans" | "claims" | "adjustments" | "components" | "rules" | "settings";
  label: string;
  segment: string;
  anyPermission: readonly Permission[];
}[] = [
  { key: "overview", label: "Overview", segment: "", anyPermission: ["payroll.draft", "payroll.run"] },
  { key: "payslips", label: "Payslips", segment: "payslips", anyPermission: ["payroll.run"] },
  // A contract is written on a person's file, so whoever writes them reads the list too.
  { key: "contracts", label: "Contracts", segment: "contracts", anyPermission: ["people.manage", "payroll.run"] },
  { key: "loans", label: "Loans and advances", segment: "loans", anyPermission: ["payroll.run"] },
  { key: "claims", label: "Claims", segment: "claims", anyPermission: ["payroll.run"] },
  { key: "adjustments", label: "Adjustments", segment: "adjustments", anyPermission: ["payroll.run"] },
  { key: "components", label: "Allowances and deductions", segment: "components", anyPermission: ["payroll.run"] },
  { key: "rules", label: "Rules in force", segment: "rules", anyPermission: ["payroll.draft", "payroll.run"] },
  { key: "settings", label: "Settings", segment: "settings", anyPermission: ["payroll.run"] },
];

export type PayrollSection = (typeof PAYROLL_SECTIONS)[number]["key"];

/**
 * The sections a month's pay is run from, in the row. The others (loans,
 * claims, adjustments, the national rules, settings) are opened now and then,
 * and nine pills in two lines buried the four that are opened every month.
 * They are one press away under More, and More takes the name of the section
 * that is open, so the row always says where one is.
 */
const IN_THE_ROW: readonly PayrollSection[] = ["overview", "payslips", "contracts", "components"];

const PILL = "rounded-full border px-3 py-1 text-sm font-semibold no-underline";
const PILL_ON = "border-accent-text bg-accent-soft text-accent-text";
const PILL_OFF = "border-card-bd bg-card text-ink2 hover:bg-hover";

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
  const hrefOf = (s: (typeof PAYROLL_SECTIONS)[number]) => (s.segment ? `${base}/payroll/${s.segment}` : `${base}/payroll`);
  // Somebody who reaches five sections or fewer has nothing to fold away.
  const fold = sections.length > 5;
  const row = fold ? sections.filter((s) => IN_THE_ROW.includes(s.key)) : sections;
  const more = fold ? sections.filter((s) => !IN_THE_ROW.includes(s.key)) : [];
  const open = more.find((s) => s.key === active);
  return (
    <nav aria-label="Payroll sections" className="flex flex-wrap items-center gap-2">
      {row.map((s) => {
        const on = s.key === active;
        return (
          <Link key={s.key} href={hrefOf(s)} aria-current={on ? "page" : undefined} className={cn(PILL, on ? PILL_ON : PILL_OFF)}>
            {s.label}
          </Link>
        );
      })}
      {more.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={open ? `${open.label}. More payroll sections` : "More payroll sections"}
              aria-current={open ? "page" : undefined}
              className={cn(PILL, "inline-flex cursor-pointer items-center gap-1", open ? PILL_ON : PILL_OFF)}
              data-payroll-more
            >
              {open ? open.label : "More"}
              <ChevronDown aria-hidden className="size-4" strokeWidth={2} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-56">
            {more.map((s) => (
              <DropdownMenuItem key={s.key} asChild>
                <Link href={hrefOf(s)} className={cn("no-underline", s.key === active ? "font-semibold text-accent-text" : "text-ink")}>
                  {s.label}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
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

/** `2026-09` as a table column says it: `Sep 2026`. */
export function monthShort(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }).format(
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
 * It is opened from a row and drawn above the list, so it comes into view.
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
    <Reveal when={title}>
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
    </Reveal>
  );
}
