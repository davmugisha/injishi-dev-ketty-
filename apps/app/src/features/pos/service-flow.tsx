import { CircleCheck, Cup, FileText, LayoutCells, PencilToSquare, Persons, Wallet } from "@gravity-ui/icons";
import Link from "next/link";
import type { ComponentType } from "react";
import { type StationKind, stationsCrew, stationsName } from "./outlet-type";

type Icon = ComponentType<{ className?: string; width?: number; height?: number }>;

/**
 * The food and beverage service, start to finish, as it runs right now: each step, who does it and how many tables
 * or orders sit at it. Every step opens the screen where that work is done, so a manager reads the floor at a glance
 * and a new member of staff sees where they fit.
 */
export function ServiceFlow({
  outletId,
  tables,
  orders,
  settledToday,
  stationKinds = null,
}: {
  outletId: string;
  tables: { status: string; count: number }[];
  orders: { status: string; count: number }[];
  settledToday: number;
  /** The outlet's station kinds; null for several outlets (the step then says "Kitchen and bar"). */
  stationKinds?: StationKind[] | null;
}) {
  const kinds = stationKinds ? new Set(stationKinds) : null;
  const t = (s: string) => tables.find((x) => x.status === s)?.count ?? 0;
  const o = (s: string) => orders.find((x) => x.status === s)?.count ?? 0;
  const q = outletId ? `?outlet=${outletId}` : "";
  const steps: { key: string; title: string; who: string; icon: Icon; count: number; unit: string; href: string }[] = [
    {
      key: "seat",
      title: "Seat or reserve",
      who: "Host, waiter",
      icon: Persons,
      count: t("occupied") + t("bill_requested") + t("reserved"),
      unit: "tables in use",
      href: `/pos/floor${q}`,
    },
    {
      key: "order",
      title: "Take the order",
      who: "Waiter",
      icon: PencilToSquare,
      count: o("draft"),
      unit: "being taken",
      href: `/pos/floor${q}`,
    },
    {
      key: "prepare",
      title: stationsName(kinds),
      who: stationsCrew(kinds),
      icon: Cup,
      count: o("submitted") + o("in_progress"),
      unit: "in preparation",
      href: `/pos/stations${q}`,
    },
    {
      key: "serve",
      title: "Serve",
      who: "Waiter",
      icon: LayoutCells,
      count: o("ready"),
      unit: "ready at the pass",
      href: `/pos/stations${q}`,
    },
    {
      key: "bill",
      title: "Bill",
      who: "Waiter, cashier",
      icon: FileText,
      count: t("bill_requested"),
      unit: "bills requested",
      href: `/pos/floor${q}`,
    },
    {
      key: "pay",
      title: "Payment",
      who: "Cashier",
      icon: Wallet,
      count: o("delivered"),
      unit: "served, to settle",
      href: `/pos/shift${q}`,
    },
    {
      key: "receipt",
      title: "EBM receipt",
      who: "Cashier",
      icon: CircleCheck,
      count: settledToday,
      unit: "settled today",
      href: `/pos/shift${q}`,
    },
  ];
  return (
    <section aria-labelledby="flow-h" data-ui="service-flow" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="flow-h" className="text-[16px] font-semibold">
            Service right now
          </h2>
          <p className="text-[12.5px] text-muted">
            From the table to the RRA receipt: each step, who does it, and how many are there.
          </p>
        </div>
      </div>
      <ol className="-mx-1 grid snap-x auto-cols-[minmax(148px,1fr)] grid-flow-col gap-2.5 overflow-x-auto px-1 pb-1">
        {steps.map((s, i) => {
          const StepIcon = s.icon;
          return (
            <li key={s.key} className="flex min-w-0 snap-start">
              <Link
                href={s.href}
                data-step={s.key}
                className="group flex w-full flex-col gap-2 rounded-[18px] border border-[var(--pos-card-border)] bg-surface p-3.5 shadow-[var(--pos-card-shadow)] transition hover:border-[#0b8442]/40 hover:shadow-[0_8px_24px_-14px_rgb(11_132_66/0.6)]"
              >
                <span className="flex items-center justify-between">
                  <span
                    className={`flex size-9 items-center justify-center rounded-[11px] ${s.count > 0 ? "bg-[#0b8442] text-white" : "bg-[var(--pos-pill)] text-[var(--pos-ink-3)]"}`}
                    aria-hidden="true"
                  >
                    <StepIcon width={18} height={18} />
                  </span>
                  <span className="text-[11px] font-semibold text-muted tabular">Step {i + 1}</span>
                </span>
                <span className="text-[14px] leading-5 font-semibold">{s.title}</span>
                <span className="flex items-baseline gap-1.5">
                  <span className="text-[22px] leading-6 font-bold tabular">{s.count}</span>
                  <span className="truncate text-[11.5px] text-muted">{s.unit}</span>
                </span>
                <span className="self-start rounded-full bg-[var(--pos-band)] px-2 py-0.5 text-[11px] font-medium text-[var(--pos-ink-2)]">
                  {s.who}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
