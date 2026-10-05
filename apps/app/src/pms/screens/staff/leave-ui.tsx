"use client";

/**
 * What the Leave screens share (058-leave): the sections of the lens, how a
 * type's rules read in a sentence, and a balance shown with the lots and the
 * ledger rows behind it. Nothing here reads data or decides a permission.
 */

import type { LeaveBalance, LeaveEntryKind, LeaveType, Permission } from "@injishi/contracts";
import Link from "next/link";

import { cn } from "@/lib/utils";

import { Badge } from "../../components/ui";
import { dshortIso } from "../../lib/format";
import { daysText } from "./staff-ui";

/** The sections of the Leave lens, each a route segment under `/staff/leave` (D-c). */
export const LEAVE_SECTIONS: readonly {
  key: "requests" | "allocations" | "balances" | "restricted" | "types";
  label: string;
  segment: string;
  anyPermission: readonly Permission[];
}[] = [
  { key: "requests", label: "Requests", segment: "", anyPermission: ["leave.approve"] },
  { key: "allocations", label: "Extra days", segment: "allocations", anyPermission: ["leave.approve"] },
  { key: "balances", label: "Balances", segment: "balances", anyPermission: ["leave.approve", "people.manage"] },
  { key: "restricted", label: "Restricted periods", segment: "restricted", anyPermission: ["leave.approve", "people.manage"] },
  { key: "types", label: "Leave types", segment: "types", anyPermission: ["leave.approve", "people.manage"] },
];

export type LeaveSection = (typeof LEAVE_SECTIONS)[number]["key"];

/** The row of sections under the Staff rail. Holidays live with time, so they are a link out. */
export function LeaveNav({
  base,
  active,
  sections,
}: {
  base: string;
  active: LeaveSection;
  sections: readonly (typeof LEAVE_SECTIONS)[number][];
}) {
  return (
    <nav aria-label="Leave sections" className="flex flex-wrap items-center gap-2">
      {sections.map((s) => {
        const on = s.key === active;
        return (
          <Link
            key={s.key}
            href={s.segment ? `${base}/leave/${s.segment}` : `${base}/leave`}
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
      <Link href={`${base}/time-settings`} className="px-2 text-sm text-muted-foreground underline-offset-2 hover:underline">
        Holidays and weekly days off
      </Link>
    </nav>
  );
}

/** How a type is paid, in a few words. */
export function paymentText(t: Pick<LeaveType, "payment" | "paymentPercent">): string {
  if (t.payment === "unpaid") return "Unpaid";
  if (t.payment === "partial") return `Paid at ${t.paymentPercent ?? 0}%`;
  return "Paid";
}

/** A type's rules as one line: pay, entitlement, steps and what it asks for. */
export function typeTermsText(t: LeaveType): string {
  const parts = [paymentText(t)];
  if (t.yearlyEntitlementDays !== null && t.accrual !== "none") {
    parts.push(`${daysText(t.yearlyEntitlementDays)} a year${t.accrual === "monthly" ? ", earned monthly" : ""}`);
  } else if (t.yearlyEntitlementDays === null) {
    parts.push("no balance kept");
  }
  if (t.carry !== "none") parts.push(`carries ${daysText(t.carryMaxDays)}${t.carryExpiresMonths ? ` for ${t.carryExpiresMonths} months` : ""}`);
  if (t.compensatory) parts.push(`days in lieu${t.carryExpiresMonths ? `, each kept ${t.carryExpiresMonths} months` : ""}`);
  parts.push(t.approvalSteps === 0 ? "no approval" : t.approvalSteps === 2 ? "two approvals" : "one approval");
  if (t.needsAttachment) parts.push("needs a note");
  if (t.eligibleSex) parts.push(t.eligibleSex === "female" ? "women" : "men");
  if (t.minServiceMonths > 0) parts.push(`after ${t.minServiceMonths} months`);
  if (t.oncePerEmployment) parts.push("once");
  return parts.join(" · ");
}

const KIND_LABEL: Record<LeaveEntryKind, string> = {
  accrual: "Earned",
  carry_forward: "Carried over",
  adjustment: "Added",
  taken: "Taken",
  encashed: "Paid out",
  expiry: "Expired",
  reversal: "Given back",
};

/**
 * One type's balance with what stands behind it (058-leave AC-LV2): the lots
 * still holding days, soonest to end first, and every ledger row, newest
 * first. Why a person has 4 days and not 6 is read here, not explained.
 */
export function BalanceDetail({ balance }: { balance: LeaveBalance }) {
  const t = balance.leaveType;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-ink">{t.name}</span>
          <span className="text-2xs text-muted-foreground">{typeTermsText(t)}</span>
        </span>
        <span className="pms-num text-sm font-semibold text-ink">
          {balance.balanceDays === null ? "No balance kept" : `${daysText(balance.balanceDays)} left`}
        </span>
      </div>
      {balance.lots.length > 0 && (
        <ul aria-label={`${t.name}: days by where they came from`} className="flex flex-wrap gap-2">
          {balance.lots.map((lot) => (
            <li key={lot.id} className="rounded border border-line bg-card px-2.5 py-1.5 text-2xs text-ink2">
              <span className="pms-num font-semibold text-ink">{daysText(lot.remainingDays)}</span>{" "}
              {lot.kind === "carry_forward" ? "carried" : lot.kind === "adjustment" ? "added" : "earned"}{" "}
              {dshortIso(lot.effectiveOn)}
              {lot.usableUntil ? `, usable to ${dshortIso(lot.usableUntil)}` : ""}
            </li>
          ))}
        </ul>
      )}
      {balance.entries.length > 0 && (
        <details>
          <summary className="cursor-pointer text-2xs font-semibold text-muted-foreground">
            The ledger ({balance.entries.length} rows)
          </summary>
          <table className="mt-2 w-full text-2xs">
            <caption className="sr-only">{t.name} ledger</caption>
            <thead>
              <tr className="text-left text-muted-foreground">
                <th scope="col" className="py-1 pr-3 font-semibold">Date</th>
                <th scope="col" className="py-1 pr-3 font-semibold">What</th>
                <th scope="col" className="py-1 pr-3 text-right font-semibold">Days</th>
                <th scope="col" className="py-1 font-semibold">Note</th>
              </tr>
            </thead>
            <tbody>
              {balance.entries.map((e) => (
                <tr key={e.id} className="border-t border-line">
                  <td className="pms-num py-1 pr-3">{dshortIso(e.effectiveOn)}</td>
                  <td className="py-1 pr-3">
                    {KIND_LABEL[e.kind]}
                    {e.expiresOn ? <span className="text-muted-foreground">, ends {dshortIso(e.expiresOn)}</span> : null}
                  </td>
                  <td className={cn("pms-num py-1 pr-3 text-right", e.days < 0 ? "text-ink2" : "text-ink")}>
                    {e.days > 0 ? `+${e.days}` : e.days}
                  </td>
                  <td className="py-1 text-muted-foreground">
                    {e.reason && e.reason.toLowerCase() !== KIND_LABEL[e.kind].toLowerCase() ? e.reason : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}

/** A request's pay terms and step, as badges beside its status. */
export function TermsBadges({ payment, paymentPercent, approvalSteps, currentStep, waiting }: {
  payment: LeaveType["payment"];
  paymentPercent: number | null;
  approvalSteps: number;
  currentStep: number;
  waiting: boolean;
}) {
  return (
    <>
      {payment !== "paid" && <Badge intent="neutral">{paymentText({ payment, paymentPercent })}</Badge>}
      {waiting && approvalSteps === 2 && <Badge intent="info">Step {currentStep} of 2</Badge>}
    </>
  );
}
