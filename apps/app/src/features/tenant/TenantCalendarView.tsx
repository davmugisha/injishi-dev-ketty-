"use client";

import {
  type HostGuest,
  type LeaseChargeView,
  rentSchedule,
  type TenancyDetail,
  type TenancyMoveOut,
  type TenantPaymentView,
} from "@injishi/contracts";
import { AgendaCalendar, formatMoney, PageContent, type ScheduleEvent, type ScheduleKind } from "@injishi/ui";
import { useMemo } from "react";
import { AreaHeader } from "@/components/shell/WorkspaceNav";
import { placeWords } from "../leases/shared";

const KINDS: ScheduleKind[] = [
  { id: "due", label: "To pay", color: "var(--accent)", tentative: true },
  { id: "overdue", label: "Overdue", color: "var(--danger)" },
  { id: "paid", label: "Paid", color: "var(--success)" },
  { id: "moveout", label: "Moving out", color: "var(--warning)" },
  { id: "guest", label: "Guests", color: "var(--chart-cat-4)" },
];

const short = (n: number) => formatMoney(n, { compact: true });

/** The rent days of the lease not raised as a charge yet, from today to its end. */
function rentAhead(tenancy: TenancyDetail, charges: LeaseChargeView[], today: string) {
  const t = tenancy.terms;
  if (t.monthlyRentRwf <= 0 || t.endDate < t.startDate) return [];
  try {
    const raised = new Set(charges.filter((c) => c.kind === "rent" && c.periodStart).map((c) => c.periodStart));
    return rentSchedule({
      startDate: t.startDate,
      endDate: t.endDate,
      billingStartsOn: t.billingStartsOn,
      monthlyRentRwf: t.monthlyRentRwf,
      rentDueDay: t.rentDueDay,
    }).filter((s) => s.dueOn >= today && !raised.has(s.periodStart));
  } catch {
    return [];
  }
}

/**
 * The tenant's calendar (2026-10-30): rent to pay and paid, the rent days ahead, the move-out day and
 * guests' stays, on one month. Read only: the dates follow the lease, the notice and the registrations.
 */
export function TenantCalendarView({
  tenancy,
  charges,
  payments,
  moveOut,
  guests,
  today,
}: {
  tenancy: TenancyDetail;
  charges: LeaseChargeView[];
  payments: TenantPaymentView[];
  moveOut: TenancyMoveOut | null;
  guests: HostGuest[];
  today: string;
}) {
  const events = useMemo<ScheduleEvent[]>(() => {
    const out: ScheduleEvent[] = [];
    for (const c of charges) {
      if (c.status === "waived" || c.status === "paid") continue;
      out.push({
        id: `c-${c.id}`,
        kind: c.overdue ? "overdue" : "due",
        title: `${c.kind === "deposit" ? "Deposit" : "Rent"} ${short(c.outstandingRwf)}`,
        heading: c.label,
        start: c.dueOn,
        details: [
          { label: "Amount", value: formatMoney(c.amountRwf) },
          { label: "Left to pay", value: formatMoney(c.outstandingRwf) },
        ],
      });
    }
    for (const s of rentAhead(tenancy, charges, today)) {
      out.push({
        id: `r-${s.periodStart}`,
        kind: "due",
        title: `Rent ${short(s.amountRwf)}`,
        heading: "Rent",
        start: s.dueOn,
        details: [{ label: "Amount", value: formatMoney(s.amountRwf) }],
      });
    }
    for (const p of payments) {
      if (p.status !== "succeeded") continue;
      out.push({
        id: `p-${p.id}`,
        kind: "paid",
        title: `Paid ${short(p.amountRwf)}`,
        heading: "You paid",
        start: p.paidOn ?? p.succeededAt?.slice(0, 10) ?? p.createdAt.slice(0, 10),
        details: [
          { label: "Amount", value: formatMoney(p.amountRwf) },
          ...(p.receiptNumber ? [{ label: "Receipt", value: p.receiptNumber }] : []),
        ],
      });
    }
    const leaving = moveOut?.endedOn ?? moveOut?.notice?.moveOutOn ?? null;
    if (leaving) {
      out.push({ id: "moveout", kind: "moveout", title: "Moving out", heading: "Moving out", start: leaving });
    }
    for (const g of guests) {
      if (g.status === "cancelled") continue;
      out.push({
        id: `g-${g.id}`,
        kind: "guest",
        title: g.fullName,
        heading: `${g.fullName} stays`,
        start: g.arrivalOn,
        end: g.departureOn,
        details: [
          { label: "Nights", value: String(g.nights) },
          { label: "Who", value: g.relationshipOther ?? g.relationshipLabel },
        ],
      });
    }
    return out;
  }, [tenancy, charges, payments, moveOut, guests, today]);

  return (
    <PageContent>
      <AreaHeader eyebrow={placeWords(tenancy)} />
      <AgendaCalendar label="Your calendar" events={events} kinds={KINDS} today={today} />
    </PageContent>
  );
}
