import {
  ArrowRightArrowLeft,
  Box,
  ChartColumn,
  ChartLine,
  CircleExclamation,
  CreditCard,
  Gift,
  MapPin,
  Receipt,
  Smartphone,
  TriangleExclamation,
  Wallet,
} from "@gravity-ui/icons";
import { LinkButton } from "@injishi/ui";
import Link from "next/link";
import type { ComponentType } from "react";
import type { PosAuditEvent, PosDashboard, PosOutlet, PosSetup, SetupStepKey } from "@/server/pos";
import { Bars, Columns, IconChip, Kpi, METHOD_NAME, ORDER_STATUS_NAME, Panel, TABLE_STATUS_NAME } from "./back-office";
import { addDays, longDay, rwf, rwfSigned, shortDay } from "./format";
import { PosShell } from "./pos-shell";
import { ServiceFlow } from "./service-flow";
import { clock } from "./setup-logic";
import { SimulationNotice } from "./shared";

const PAYMENT_TILES = ["cash", "mtn_momo", "airtel_money", "card", "bank_transfer", "voucher"] as const;

const METHOD_ICON: Record<(typeof PAYMENT_TILES)[number], ComponentType<{ width?: number; height?: number }>> = {
  cash: Wallet,
  mtn_momo: Smartphone,
  airtel_money: Smartphone,
  card: CreditCard,
  bank_transfer: ArrowRightArrowLeft,
  voucher: Gift,
};

/** The dot beside each table state (whole class names, so the styles are generated). */
const TABLE_DOT: Record<string, string> = {
  available: "bg-success",
  occupied: "bg-warning",
  reserved: "bg-foreground/40",
  bill_requested: "bg-danger",
  cleaning: "bg-foreground/20",
};

/**
 * The owner's and manager's dashboard (POS spec section 4): today's money at a glance, how it was paid,
 * what is being served now, and what is selling. Everything is computed by the API from the day's orders and
 * payments, so it moves the moment a bill is settled. A second row shows the last seven days, because a
 * morning with no sales yet should not look like a business with none.
 */
export function PosDashboardView({
  outlets,
  selected,
  dashboard,
  byOutlet = [],
  audit = [],
  can,
  setup,
  stationKinds = null,
}: {
  outlets: PosOutlet[];
  selected: PosOutlet | null;
  dashboard: PosDashboard;
  /** Each outlet's own dashboard, given only when the view covers several outlets. */
  byOutlet?: { outlet: PosOutlet; dashboard: PosDashboard }[];
  /** The week's audit trail; the sensitive actions in it are listed with who did them. */
  audit?: PosAuditEvent[];
  can: string[];
  /** How far the outlet is set up; only given to someone who can change the setup, and only for one outlet. */
  setup?: PosSetup | null;
  /** The station kinds of the outlet in view (null for several outlets): they name the kitchen and bar step. */
  stationKinds?: ("kitchen" | "bar")[] | null;
}) {
  const { today, week, live } = dashboard;
  const anchor = selected?.id ?? outlets[0]?.id ?? "";
  const byMethod = (r: PosDashboard["today"], m: string) => r.payments.byMethod.find((x) => x.method === m);
  const drinks = today.topDrinks.length > 0 ? today.topDrinks : week.topDrinks;
  const drinksNote = today.topDrinks.length > 0 ? "Today" : "Last 7 days (nothing sold yet today)";
  const profit = today.profit.estimatedProfitRwf;
  const alerts = live.alerts.low + live.alerts.out;
  // Food and everything else that is not a drink: the best sellers minus the drinks the API already ranks apart.
  const drinkNames = new Set([...today.topDrinks, ...week.topDrinks].map((d) => d.name));
  const foodToday = today.bestSellers.filter((d) => !drinkNames.has(d.name));
  const food = (foodToday.length > 0 ? foodToday : week.bestSellers.filter((d) => !drinkNames.has(d.name))).slice(0, 6);
  const foodNote = foodToday.length > 0 ? "Today" : "Last 7 days (nothing sold yet today)";
  const staff = today.waiters.length > 0 ? today.waiters : week.waiters;
  const staffNote = today.waiters.length > 0 ? "Today · settled bills" : "Last 7 days · settled bills";
  const sensitive = audit.map((e) => ({ e, what: sensitiveAction(e) })).filter((r) => r.what !== null);
  const outletName = new Map(outlets.map((o) => [o.id, o.branchName ?? o.name]));

  // Every day of the 7-day period, the quiet ones included, so the chart shows the week as it was.
  const days = Array.from({ length: 7 }, (_, i) => addDays(week.period.from, i)).filter((d) => d <= week.period.to);
  const daily = new Map(week.daily.map((d) => [d.day, d]));

  return (
    <PosShell
      board="PosDashboard"
      title="Dashboard"
      subtitle={`${longDay(today.period.to)} · Kigali time${
        today.businessDay?.startMinutes ? ` · business day from ${clock(today.businessDay.startMinutes)}` : ""
      } · figures update as bills are settled`}
      outlet={selected ?? { name: "All outlets", branchName: null }}
      outlets={outlets}
      outletId={selected?.id ?? ""}
      switchHref="/pos/dashboard"
      allOutlets
      can={can}
      actions={
        <>
          <LinkButton href={`/pos/floor?outlet=${anchor}`} variant="secondary" size="sm">
            Open floor
          </LinkButton>
          <LinkButton href={`/pos/reports?outlet=${selected?.id ?? ""}`} variant="primary" size="sm">
            Reports
          </LinkButton>
        </>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-6 md:px-6">
        {setup && setup.doneCount < setup.total ? (
          <SetupPrompt setup={setup} outletName={outlets.find((o) => o.id === setup.outletId)?.name ?? "this outlet"} />
        ) : null}

        <section
          aria-label="Today"
          className="grid grid-cols-2 gap-3 max-sm:[&>*:last-child]:col-span-2 lg:grid-cols-3 xl:grid-cols-5"
        >
          <Kpi
            label="Today's sales"
            icon={Wallet}
            tint="accent"
            value={rwf(today.sales.totalRwf)}
            sub={`${today.sales.completedOrders} bill${today.sales.completedOrders === 1 ? "" : "s"} settled · average ${rwf(today.sales.averageOrderRwf)}`}
          />
          <Kpi
            label="Active orders"
            icon={Receipt}
            tint="warning"
            value={live.activeOrderCount}
            sub={
              live.activeOrders.length > 0
                ? live.activeOrders
                    .map((a) => `${a.count} ${(ORDER_STATUS_NAME[a.status] ?? a.status).toLowerCase()}`)
                    .join(" · ")
                : "Nothing open"
            }
          />
          <Kpi
            label="Expenses today"
            icon={CreditCard}
            tint="danger"
            value={rwf(today.expenses.totalRwf)}
            sub={`${today.expenses.recent.length} recorded`}
          />
          <Kpi
            label="Estimated profit today"
            icon={ChartLine}
            tint="success"
            value={rwfSigned(profit)}
            tone={profit < 0 ? "bad" : profit > 0 ? "good" : undefined}
            sub="Estimate: sales before tax, less cost of goods and expenses"
          />
          <Kpi
            label="Stock alerts"
            icon={Box}
            tint={live.alerts.out > 0 ? "danger" : live.alerts.low > 0 ? "warning" : "success"}
            value={alerts}
            tone={live.alerts.out > 0 ? "bad" : live.alerts.low > 0 ? "warn" : "good"}
            sub={`${live.alerts.low} low · ${live.alerts.out} out of stock`}
          />
        </section>

        <ServiceFlow
          outletId={selected?.id ?? ""}
          tables={live.tables}
          orders={live.activeOrders}
          settledToday={today.sales.completedOrders}
          stationKinds={stationKinds}
        />

        <section className="grid gap-4 xl:grid-cols-3">
          <Panel
            className="xl:col-span-2"
            title="Sales, last 7 days"
            note={`${shortDay(week.period.from)} to ${shortDay(week.period.to)} · ${rwf(week.sales.totalRwf)} from ${week.sales.completedOrders} settled bill${week.sales.completedOrders === 1 ? "" : "s"}`}
          >
            <Columns
              height={300}
              rows={days.map((day) => {
                const d = daily.get(day);
                return {
                  key: day,
                  label: longDay(day).split(" ")[0] ?? day,
                  value: d?.totalRwf ?? 0,
                  display: rwf(d?.totalRwf ?? 0),
                  hint: `${shortDay(day)} · ${d?.orders ?? 0} bill${d?.orders === 1 ? "" : "s"}`,
                };
              })}
            />
          </Panel>

          <Panel
            title="How today was paid"
            note={`${rwf(today.payments.collectedRwf)} collected · tips ${rwf(today.payments.tipsRwf)}`}
          >
            <ul className="flex flex-col gap-2">
              {PAYMENT_TILES.map((m) => {
                const row = byMethod(today, m);
                return (
                  <li key={m} className="flex items-center gap-3 rounded-2xl bg-background/70 px-3 py-2.5">
                    <IconChip icon={METHOD_ICON[m]} tint={row ? "accent" : "default"} size={34} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{METHOD_NAME[m]}</span>
                      <span className="block text-[11px] text-muted">
                        {row ? `${row.count} payment${row.count === 1 ? "" : "s"}` : "None yet"}
                        {m === "cash" ? "" : " · simulated"}
                      </span>
                    </span>
                    <span className="text-[14px] font-semibold tabular">{rwf(row?.amountRwf ?? 0)}</span>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <Panel title="Top-selling drinks" note={drinksNote}>
            <Bars
              rows={drinks.map((d) => ({
                label: d.name,
                value: d.quantity,
                display: `${d.quantity} sold`,
                hint: rwf(d.revenueRwf),
                photo: d.name,
              }))}
              empty="No drinks sold yet."
            />
          </Panel>

          <Panel title="Top-selling food and services" note={foodNote}>
            <Bars
              rows={food.map((d) => ({
                label: d.name,
                value: d.quantity,
                display: `${d.quantity} sold`,
                hint: rwf(d.revenueRwf),
                photo: d.name,
              }))}
              empty="Nothing sold yet."
            />
          </Panel>

          {byOutlet.length > 0 ? (
            <Panel title="Revenue by outlet" note="Today, with the last 7 days beside it">
              <ul className="flex flex-col gap-2 text-[13px]">
                {byOutlet.map(({ outlet, dashboard: d }) => (
                  <li key={outlet.id}>
                    <Link
                      href={`/pos/dashboard?outlet=${outlet.id}`}
                      className="flex items-center gap-3 rounded-2xl bg-background/70 px-3 py-2.5 transition-colors hover:bg-accent-soft"
                    >
                      <IconChip icon={MapPin} tint="accent" size={34} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{outlet.name}</span>
                        <span className="block text-[11px] text-muted">
                          {d.live.activeOrderCount} open · {d.today.sales.completedOrders} settled today
                        </span>
                      </span>
                      <span className="shrink-0 text-right font-semibold tabular">
                        {rwf(d.today.sales.totalRwf)}
                        <span className="block text-[11px] font-normal text-muted">
                          7 days {rwf(d.week.sales.totalRwf)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : (
            <Panel title="Sales by category" note="Last 7 days">
              <Bars
                rows={week.byCategory.slice(0, 6).map((c) => ({
                  label: c.category,
                  value: c.revenueRwf,
                  display: rwf(c.revenueRwf),
                  hint: `${c.quantity} sold`,
                }))}
                empty="Nothing sold in the last 7 days."
              />
            </Panel>
          )}
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <Panel
            className="xl:col-span-2"
            title="Needs your attention"
            note="Voids, cancellations, refunds, discounts, cash in and out, stock write-offs and setting changes in the last 7 days: who did them, and the reason they gave."
          >
            {sensitive.length === 0 ? (
              <p className="py-1 text-[13px] text-muted">None in the last 7 days.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-[13px]">
                {sensitive.slice(0, 10).map(({ e, what }) => (
                  <li
                    key={e.id}
                    className="flex items-center gap-3 rounded-2xl bg-background/70 px-3 py-2.5"
                    data-audit={e.action}
                  >
                    <IconChip
                      icon={
                        what?.tone === "bad" ? TriangleExclamation : what?.tone === "warn" ? CircleExclamation : Receipt
                      }
                      tint={what?.tone === "bad" ? "danger" : what?.tone === "warn" ? "warning" : "default"}
                      size={34}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">
                        {what?.label}
                        {what?.detail ? <span className="font-normal text-muted"> · {what.detail}</span> : null}
                      </span>
                      <span className="block truncate text-[12px] text-muted">
                        by {e.actorName ?? "someone"}
                        {e.outletId && !selected && outletName.get(e.outletId)
                          ? ` · ${outletName.get(e.outletId)}`
                          : ""}
                        {e.reason ? ` · “${e.reason}”` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-[12px] text-muted tabular">{when(e.occurredAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <div className="flex min-w-0 flex-col gap-4">
            <Panel
              title="On the floor now"
              action={
                <LinkButton href={`/pos/floor?outlet=${anchor}`} variant="ghost" size="sm">
                  Open
                </LinkButton>
              }
            >
              <ul className="grid grid-cols-2 gap-2 text-[13px]">
                {live.tables.map((t) => (
                  <li key={t.status} className="rounded-2xl bg-background/70 px-3 py-2.5">
                    <span className="flex items-center gap-1.5 text-[12px] text-muted">
                      <span
                        className={`size-2 rounded-full ${TABLE_DOT[t.status] ?? "bg-default"}`}
                        aria-hidden="true"
                      />
                      {TABLE_STATUS_NAME[t.status] ?? t.status}
                    </span>
                    <span className="text-[20px] font-bold tabular">{t.count}</span>
                  </li>
                ))}
                <li className="rounded-2xl bg-background/70 px-3 py-2.5">
                  <span className="text-[12px] text-muted">Cashier shifts open</span>
                  <span className="block text-[20px] font-bold tabular">{live.openShifts}</span>
                </li>
              </ul>
            </Panel>

            <Panel title="Sales by staff" note={staffNote}>
              <Bars
                rows={staff.map((w) => ({
                  label: w.name,
                  value: w.totalRwf,
                  display: rwf(w.totalRwf),
                  hint: `${w.orders} bill${w.orders === 1 ? "" : "s"} · avg ${rwf(w.averageRwf)}`,
                }))}
                empty="No settled bills yet."
              />
            </Panel>
          </div>
        </section>

        <section aria-label="Last 7 days" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi
            label="Sales, 7 days"
            icon={ChartColumn}
            value={rwf(week.sales.totalRwf)}
            sub={`${week.sales.completedOrders} bills`}
          />
          <Kpi
            label="Tax collected, 7 days"
            icon={Receipt}
            tint="default"
            value={rwf(week.sales.taxRwf)}
            sub="Illustrative demo rate"
          />
          <Kpi label="Expenses, 7 days" icon={CreditCard} tint="danger" value={rwf(week.expenses.totalRwf)} />
          <Kpi
            label="Estimated profit, 7 days"
            icon={ChartLine}
            tint={week.profit.estimatedProfitRwf < 0 ? "danger" : "success"}
            value={rwfSigned(week.profit.estimatedProfitRwf)}
            tone={week.profit.estimatedProfitRwf < 0 ? "bad" : "good"}
            sub={`Cost of goods taken as ${Math.round(week.profit.costRatio * 100)}% of sales before tax`}
          />
        </section>

        <SimulationNotice />
      </div>
    </PosShell>
  );
}

/** "Tue 14:05", Kigali time. */
function when(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: "Africa/Kigali",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STOCK_KIND: Record<string, string> = {
  count: "Stock count",
  delivery: "Delivery received",
  damage: "Damaged stock written off",
  waste: "Wasted stock written off",
};

/** The audit actions an owner or manager should see, in words; null for routine ones (seating, sales, stock use). */
function sensitiveAction(e: PosAuditEvent): { label: string; detail?: string; tone?: "warn" | "bad" } | null {
  const a = e.action;
  const after = (e.after ?? {}) as Record<string, unknown>;
  const before = (e.before ?? {}) as Record<string, unknown>;
  const amount = [after.amountRwf, before.amountRwf, after.totalRwf].find((v) => typeof v === "number") as
    | number
    | undefined;
  const item = typeof after.item === "string" ? after.item : typeof after.name === "string" ? after.name : undefined;
  const detail = [item, amount !== undefined ? rwf(amount) : undefined].filter(Boolean).join(" · ") || undefined;
  if (a === "line.voided") return { label: "Item voided", detail, tone: "bad" };
  if (a === "order.cancelled") return { label: "Bill cancelled", detail, tone: "bad" };
  if (a === "payment.refunded") return { label: "Refund", detail, tone: "bad" };
  if (a === "payment.resolved") return { label: "Payment resolved by hand", detail, tone: "warn" };
  if (a === "order.transferred") return { label: "Bill transferred", detail };
  if (a.startsWith("discount.")) {
    const state = a.slice("discount.".length);
    return { label: `Discount ${state.replace(/_/g, " ")}`, detail, tone: state === "rejected" ? undefined : "warn" };
  }
  if (a.startsWith("cash.")) {
    const [, kind, status] = a.split(".");
    const words = kind === "paid_out" ? "Cash out" : kind === "paid_in" ? "Cash in" : "Cash movement";
    return {
      label: status ? `${words} ${status.replace(/_/g, " ")}` : words,
      detail,
      tone: kind === "paid_out" ? "warn" : undefined,
    };
  }
  if (a === "expense.voided") return { label: "Expense voided", detail, tone: "warn" };
  if (a === "settings.updated") return { label: "Outlet settings changed", detail };
  if (a.startsWith("stock.") && a !== "stock.consumed" && a !== "stock.restored") {
    const kind = a.slice("stock.".length);
    return {
      label: STOCK_KIND[kind] ?? "Stock adjusted",
      detail,
      tone: kind === "damage" || kind === "waste" ? "warn" : undefined,
    };
  }
  return null;
}

const STEP_NAME: Record<SetupStepKey, string> = {
  areas: "dining areas",
  tables: "tables",
  stations: "kitchen and bar stations",
  registers: "registers",
  categories: "menu sections",
  products: "menu products",
  routing: "item routing",
  receipts: "receipt text",
  team: "your team",
};

/** A quiet nudge for an owner whose venue is only partly set up. It links to the checklist and blocks nothing. */
function SetupPrompt({ setup, outletName }: { setup: PosSetup; outletName: string }) {
  const todo = setup.steps.filter((s) => !s.done).map((s) => STEP_NAME[s.key]);
  return (
    <section
      aria-label="Finish setting up"
      className="flex flex-wrap items-center gap-3 rounded-2xl border border-accent/30 bg-accent-soft p-4"
    >
      <div className="min-w-0 flex-1">
        <h2 className="text-[14px] font-semibold text-accent-soft-foreground">
          Finish setting up {outletName}: {setup.doneCount} of {setup.total} done
        </h2>
        <p className="text-[12px] text-accent-soft-foreground/80">
          Still to do: {todo.join(", ")}. Everything else already works.
        </p>
      </div>
      <LinkButton href={`/pos/setup?outlet=${setup.outletId}`} variant="primary" size="sm">
        Continue setup
      </LinkButton>
    </section>
  );
}
