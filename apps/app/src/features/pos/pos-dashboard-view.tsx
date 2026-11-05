import { LinkButton } from "@injishi/ui";
import type { PosDashboard, PosOutlet } from "@/server/pos";
import { Bars, Kpi, METHOD_NAME, ORDER_STATUS_NAME, OutletSwitch, Panel, TABLE_STATUS_NAME } from "./back-office";
import { longDay, rwf, rwfSigned, shortDay } from "./format";
import { PosNav } from "./pos-nav";
import { PosHeader, SimulationNotice } from "./shared";

const PAYMENT_TILES = ["cash", "mtn_momo", "airtel_money", "card", "bank_transfer", "voucher"] as const;

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
  can,
}: {
  outlets: PosOutlet[];
  selected: PosOutlet | null;
  dashboard: PosDashboard;
  can: string[];
}) {
  const { today, week, live } = dashboard;
  const anchor = selected?.id ?? outlets[0]?.id ?? "";
  const byMethod = (r: PosDashboard["today"], m: string) => r.payments.byMethod.find((x) => x.method === m);
  const drinks = today.topDrinks.length > 0 ? today.topDrinks : week.topDrinks;
  const drinksNote = today.topDrinks.length > 0 ? "Today" : "Last 7 days (nothing sold yet today)";
  const profit = today.profit.estimatedProfitRwf;
  const alerts = live.alerts.low + live.alerts.out;

  return (
    <div className="relative flex h-full flex-col bg-background">
      <PosHeader title="Dashboard" outlet={selected ?? { name: "All outlets", branchName: null }}>
        <OutletSwitch outlets={outlets} current={selected?.id ?? null} href="/pos/dashboard" all />
        <PosNav current="PosDashboard" outletId={anchor} can={can} />
      </PosHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <p className="text-[12px] text-muted">
          Today, {longDay(today.period.to)} · Kigali time. Figures update as bills are settled.
        </p>

        <section aria-label="Today" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Kpi
            label="Today's sales"
            value={rwf(today.sales.totalRwf)}
            sub={`${today.sales.completedOrders} bill${today.sales.completedOrders === 1 ? "" : "s"} settled · average ${rwf(today.sales.averageOrderRwf)}`}
          />
          <Kpi
            label="Active orders"
            value={live.activeOrderCount}
            sub={
              live.activeOrders.length > 0
                ? live.activeOrders.map((a) => `${a.count} ${(ORDER_STATUS_NAME[a.status] ?? a.status).toLowerCase()}`).join(" · ")
                : "Nothing open"
            }
          />
          <Kpi label="Expenses today" value={rwf(today.expenses.totalRwf)} sub={`${today.expenses.recent.length} recorded`} />
          <Kpi
            label="Estimated profit today"
            value={rwfSigned(profit)}
            tone={profit < 0 ? "bad" : profit > 0 ? "good" : undefined}
            sub="Estimate: sales before tax, less cost of goods and expenses"
          />
          <Kpi
            label="Stock alerts"
            value={alerts}
            tone={live.alerts.out > 0 ? "bad" : live.alerts.low > 0 ? "warn" : "good"}
            sub={`${live.alerts.low} low · ${live.alerts.out} out of stock`}
          />
        </section>

        <section aria-label="How today was paid" className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {PAYMENT_TILES.map((m) => {
            const row = byMethod(today, m);
            return (
              <Kpi
                key={m}
                label={METHOD_NAME[m]}
                value={rwf(row?.amountRwf ?? 0)}
                sub={row ? `${row.count} payment${row.count === 1 ? "" : "s"}` : "None yet"}
              />
            );
          })}
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <Panel title="Top-selling drinks" note={drinksNote}>
            <Bars
              rows={drinks.map((d) => ({
                label: d.name,
                value: d.quantity,
                display: `${d.quantity} sold`,
                hint: rwf(d.revenueRwf),
              }))}
              empty="No drinks sold yet."
            />
          </Panel>

          <Panel title="Sales, last 7 days" note={`${shortDay(week.period.from)} to ${shortDay(week.period.to)} · ${rwf(week.sales.totalRwf)} in total`}>
            <Bars
              rows={week.daily.map((d) => ({
                label: longDay(d.day),
                value: d.totalRwf,
                display: rwf(d.totalRwf),
                hint: `${d.orders} bill${d.orders === 1 ? "" : "s"}`,
              }))}
              empty="No settled bills in the last 7 days."
            />
          </Panel>

          <Panel
            title="On the floor now"
            action={
              <LinkButton href={`/pos/floor?outlet=${anchor}`} variant="ghost" size="sm">
                Open floor
              </LinkButton>
            }
          >
            <ul className="flex flex-col gap-2 text-[13px]">
              {live.tables.map((t) => (
                <li key={t.status} className="flex items-center justify-between">
                  <span>{TABLE_STATUS_NAME[t.status] ?? t.status} tables</span>
                  <span className="font-semibold tabular">{t.count}</span>
                </li>
              ))}
              <li className="flex items-center justify-between border-t border-separator pt-2">
                <span>Cashier shifts open</span>
                <span className="font-semibold tabular">{live.openShifts}</span>
              </li>
            </ul>
          </Panel>
        </section>

        <section aria-label="Last 7 days" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Sales, 7 days" value={rwf(week.sales.totalRwf)} sub={`${week.sales.completedOrders} bills`} />
          <Kpi label="Tax collected, 7 days" value={rwf(week.sales.taxRwf)} sub="Illustrative demo rate" />
          <Kpi label="Expenses, 7 days" value={rwf(week.expenses.totalRwf)} />
          <Kpi
            label="Estimated profit, 7 days"
            value={rwfSigned(week.profit.estimatedProfitRwf)}
            tone={week.profit.estimatedProfitRwf < 0 ? "bad" : "good"}
            sub={`Cost of goods taken as ${Math.round(week.profit.costRatio * 100)}% of sales before tax`}
          />
        </section>

        <div className="flex flex-wrap items-center gap-2">
          <LinkButton href={`/pos/reports?outlet=${selected?.id ?? ""}`} variant="secondary" size="sm">
            Open reports
          </LinkButton>
          <LinkButton href={`/pos/stock?outlet=${anchor}`} variant="ghost" size="sm">
            Open stock
          </LinkButton>
        </div>
        <SimulationNotice />
      </div>
    </div>
  );
}
