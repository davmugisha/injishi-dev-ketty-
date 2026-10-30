"use client";

import type { MoveOutRow, RentalsMoney } from "@injishi/contracts";
import {
  ActionLink,
  AgendaCalendar,
  formatMoney,
  PageContent,
  type ScheduleEvent,
  type ScheduleKind,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { AreaHeader } from "@/components/shell/WorkspaceNav";
import { leaseHref } from "@/features/leases/shared";

const KINDS: ScheduleKind[] = [
  { id: "due", label: "Rent due", color: "var(--accent)", tentative: true },
  { id: "overdue", label: "Overdue", color: "var(--danger)" },
  { id: "paid", label: "Paid", color: "var(--success)" },
  { id: "moveout", label: "Moving out", color: "var(--warning)" },
];

const short = (n: number) => formatMoney(n, { compact: true });

/**
 * The landlord's calendar (2026-10-30): rent as it falls due, what is overdue, what was paid, and who
 * moves out when, in a day, week or month. Rent days follow each lease, so nothing here is dragged; a day
 * chosen in the day or week view starts a new lease on it.
 */
export function RentalsCalendarView({
  today,
  money,
  moveOuts,
}: {
  today: string;
  money: RentalsMoney | null;
  moveOuts: MoveOutRow[];
}) {
  const router = useRouter();
  const events = useMemo<ScheduleEvent[]>(() => {
    const open = (leaseId: string) => (
      <ActionLink href={leaseHref(leaseId)} size="sm" icon="FileText">
        Open lease
      </ActionLink>
    );
    return [
      ...(money?.charges ?? [])
        .filter((c) => c.status !== "paid")
        .map((c) => ({
          id: `c-${c.id}`,
          kind: c.status === "overdue" ? "overdue" : "due",
          title: `${c.unitLabel} · ${short(c.amountRwf - c.paidRwf)}`,
          heading: `${c.kind === "deposit" ? "Deposit" : "Rent"} from ${c.tenantName}`,
          start: c.dueOn,
          details: [
            { label: "Unit", value: c.unitLabel },
            { label: "Due", value: formatMoney(c.amountRwf) },
            ...(c.paidRwf > 0 ? [{ label: "Paid", value: formatMoney(c.paidRwf) }] : []),
            { label: "Left", value: formatMoney(c.amountRwf - c.paidRwf) },
          ],
          actions: open(c.leaseId),
        })),
      ...(money?.payments ?? []).map((p) => ({
        id: `p-${p.id}`,
        kind: "paid",
        title: `${p.unitLabel} · ${short(p.amountRwf)}`,
        heading: `${p.tenantName} paid`,
        start: p.day,
        details: [
          { label: "Unit", value: p.unitLabel },
          { label: "Amount", value: formatMoney(p.amountRwf) },
        ],
        actions: open(p.leaseId),
      })),
      ...moveOuts.map((m) => ({
        id: `m-${m.leaseId}`,
        kind: "moveout",
        title: `${m.unitLabel} moves out`,
        heading: `${m.tenantName} moves out`,
        start: m.movingOutOn,
        details: [
          { label: "Unit", value: m.unitLabel },
          { label: "Lease", value: m.reference },
        ],
        actions: open(m.leaseId),
      })),
    ];
  }, [money, moveOuts]);

  return (
    <PageContent>
      <AreaHeader />
      <AgendaCalendar
        label="Rent and move-out calendar"
        events={events}
        kinds={KINDS}
        today={today}
        onCreate={(day) => {
          if (day >= today) router.push(`/leases/new?start=${day}`);
        }}
        hint="Choose a day in the day or week view to start a new lease then"
      />
    </PageContent>
  );
}
