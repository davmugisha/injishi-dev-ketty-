import { ChartColumn, ChartLine, Receipt, Wallet } from "@gravity-ui/icons";
import { LinkButton } from "@injishi/ui";
import type { PosOutlet, PosReport } from "@/server/pos";
import { Bars, DataTable, EXPENSE_CATEGORY_NAME, Kpi, METHOD_NAME, Panel } from "./back-office";
import { longDay, rwf, rwfSigned, shortDay } from "./format";
import { PosExpensePanel } from "./pos-expense-panel";
import { PosShell } from "./pos-shell";

export const PERIODS = [
  ["today", "Today"],
  ["yesterday", "Yesterday"],
  ["week", "Weekly (7 days)"],
  ["month", "Monthly (this month)"],
  ["lastmonth", "Last month"],
] as const;

export type PeriodKey = (typeof PERIODS)[number][0];

/**
 * Sales, money and stock reports (POS spec section 15) for one period and one outlet or all. Daily, weekly and
 * monthly are the same report over a longer window. Every figure is computed by the API from the settled
 * bills, payments, expenses and stock of that window.
 */
export function PosReportsView({
  outlets,
  selected,
  period,
  report,
  can,
}: {
  outlets: PosOutlet[];
  selected: PosOutlet | null;
  period: PeriodKey;
  report: PosReport;
  can: string[];
}) {
  const anchor = selected?.id ?? outlets[0]?.id ?? "";
  const q = (p: string) => `/pos/reports?period=${p}${selected ? `&outlet=${selected.id}` : ""}`;
  const days =
    report.period.from === report.period.to
      ? longDay(report.period.from)
      : `${shortDay(report.period.from)} to ${shortDay(report.period.to)}`;
  const p = report.profit;
  const grossProfit = p.netSalesRwf - p.costOfGoodsRwf;

  return (
    <PosShell
      board="PosReports"
      title="Reports"
      subtitle="Sales, payments, tax and estimated profit"
      outlet={selected ?? { name: "All outlets", branchName: null }}
      outlets={outlets}
      outletId={selected?.id ?? ""}
      switchHref={`/pos/reports?period=${period}`}
      allOutlets
      can={can}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-6 md:px-6">
        <nav aria-label="Period" className="flex flex-wrap items-center gap-1">
          {PERIODS.map(([key, label]) => (
            <LinkButton key={key} href={q(key)} variant={key === period ? "primary" : "ghost"} size="sm">
              {label}
            </LinkButton>
          ))}
          <span className="ml-2 text-[12px] text-muted">{days} · Kigali time</span>
        </nav>

        <section aria-label="Summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi
            label="Sales (with tax)"
            icon={ChartColumn}
            value={rwf(report.sales.totalRwf)}
            sub={`${report.sales.completedOrders} bills settled · average ${rwf(report.sales.averageOrderRwf)}`}
          />
          <Kpi
            label="Tax in sales"
            icon={Receipt}
            tint="default"
            value={rwf(report.sales.taxRwf)}
            sub={`Discounts given ${rwf(report.sales.discountRwf)}`}
          />
          <Kpi
            label="Collected"
            icon={Wallet}
            tint="success"
            value={rwf(report.payments.collectedRwf)}
            sub={`Refunds ${rwf(report.payments.refundsRwf)} · tips ${rwf(report.payments.tipsRwf)}`}
          />
          <Kpi
            label="Estimated profit"
            icon={ChartLine}
            tint={p.estimatedProfitRwf < 0 ? "danger" : "success"}
            value={rwfSigned(p.estimatedProfitRwf)}
            tone={p.estimatedProfitRwf < 0 ? "bad" : "good"}
            sub={`Expenses ${rwf(p.expensesRwf)}`}
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Panel title="Sales by day" note="Settled bills, by the day they were settled.">
            <DataTable
              columns={[{ label: "Day" }, { label: "Bills", align: "right" }, { label: "Sales", align: "right" }]}
              empty="No settled bills in this period."
              rows={report.daily.map((d) => [longDay(d.day), d.orders, rwf(d.totalRwf)])}
              foot={
                report.daily.length > 1
                  ? ["Total", report.sales.completedOrders, rwf(report.sales.totalRwf)]
                  : undefined
              }
            />
          </Panel>
          <Panel
            title="Payment methods"
            note="Mock providers only: no real money moved. Includes part-payments on bills not yet closed."
          >
            <DataTable
              columns={[
                { label: "Method" },
                { label: "Payments", align: "right" },
                { label: "Amount", align: "right" },
                { label: "Tips", align: "right" },
              ]}
              empty="No payments in this period."
              rows={report.payments.byMethod.map((m) => [
                METHOD_NAME[m.method] ?? m.method,
                m.count,
                rwf(m.amountRwf),
                rwf(m.tipRwf),
              ])}
              foot={
                report.payments.byMethod.length > 1
                  ? ["Total", "", rwf(report.payments.collectedRwf), rwf(report.payments.tipsRwf)]
                  : undefined
              }
            />
          </Panel>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Panel title="Best-selling products" note="By units sold.">
            <DataTable
              columns={[
                { label: "Product" },
                { label: "Category" },
                { label: "Sold", align: "right" },
                { label: "Sales", align: "right" },
              ]}
              empty="Nothing sold in this period."
              rows={report.bestSellers.map((b) => [b.name, b.category, b.quantity, rwf(b.revenueRwf)])}
            />
          </Panel>
          <Panel title="Sales by category">
            <Bars
              rows={report.byCategory.map((c) => ({
                label: c.category,
                value: c.revenueRwf,
                display: rwf(c.revenueRwf),
                hint: `${c.quantity} sold`,
              }))}
              empty="Nothing sold in this period."
            />
          </Panel>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Panel title="Waiter performance" note="Bills settled, by the waiter who served them.">
            <DataTable
              columns={[
                { label: "Waiter" },
                { label: "Bills", align: "right" },
                { label: "Sales", align: "right" },
                { label: "Average", align: "right" },
              ]}
              empty="No settled bills in this period."
              rows={report.waiters.map((w) => [w.name, w.orders, rwf(w.totalRwf), rwf(w.averageRwf)])}
            />
          </Panel>
          <Panel title="Profit and loss" note={p.note}>
            <DataTable
              columns={[{ label: "" }, { label: "RWF", align: "right" }]}
              rows={[
                ["Sales, with tax", rwf(report.sales.totalRwf)],
                ["Less tax collected", `-${rwf(report.sales.taxRwf)}`],
                [<strong key="n">Net sales</strong>, <strong key="nv">{rwf(p.netSalesRwf)}</strong>],
                [`Less cost of goods (estimate, ${Math.round(p.costRatio * 100)}%)`, `-${rwf(p.costOfGoodsRwf)}`],
                [<strong key="g">Gross profit</strong>, <strong key="gv">{rwfSigned(grossProfit)}</strong>],
                ...report.expenses.byCategory.map((e) => [
                  `Less ${(EXPENSE_CATEGORY_NAME[e.category] ?? e.category).toLowerCase()}`,
                  `-${rwf(e.totalRwf)}`,
                ]),
                [
                  <strong key="e">Estimated profit</strong>,
                  <strong key="ev">{rwfSigned(p.estimatedProfitRwf)}</strong>,
                ],
              ]}
            />
          </Panel>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Panel
            title="Tax report"
            note="From the tax rate on every settled line. The 18% VAT is the demo's illustrative rate, not an RRA filing."
          >
            <DataTable
              columns={[
                { label: "Tax code" },
                { label: "Rate", align: "right" },
                { label: "Taxable amount", align: "right" },
                { label: "Tax", align: "right" },
              ]}
              empty="No settled bills in this period."
              rows={report.tax.map((t) => [t.code, `${t.ratePercent}%`, rwf(t.taxableRwf), rwf(t.taxRwf)])}
              foot={
                report.tax.length > 1
                  ? ["Total", "", rwf(report.tax.reduce((s, t) => s + t.taxableRwf, 0)), rwf(report.sales.taxRwf)]
                  : undefined
              }
            />
          </Panel>
          <Panel
            title="Stock valuation"
            note={`Now, not for the period. Valued at an estimated ${Math.round(p.costRatio * 100)}% of the selling price.`}
            action={
              <LinkButton href={`/pos/stock?outlet=${anchor}`} variant="ghost" size="sm">
                Open stock
              </LinkButton>
            }
          >
            <dl className="grid grid-cols-2 gap-3 text-[13px] tabular">
              <div>
                <dt className="text-muted">Stock on hand, valued</dt>
                <dd className="text-[20px] font-semibold">{rwf(report.stock.valuationRwf)}</dd>
              </div>
              <div>
                <dt className="text-muted">Items tracked</dt>
                <dd className="text-[20px] font-semibold">{report.stock.tracked}</dd>
              </div>
              <div>
                <dt className="text-muted">Low stock</dt>
                <dd className="text-[20px] font-semibold text-warning">{report.stock.low}</dd>
              </div>
              <div>
                <dt className="text-muted">Out of stock</dt>
                <dd className="text-[20px] font-semibold text-danger">{report.stock.out}</dd>
              </div>
            </dl>
            <p className="text-[12px] text-muted">
              Cashier shifts opened in this period: {report.shifts.count} · total cash variance{" "}
              {rwfSigned(report.shifts.varianceRwf)}.
            </p>
          </Panel>
        </section>

        <PosExpensePanel
          rows={report.expenses.recent}
          outletId={selected?.id ?? null}
          canManage={can.includes("expense.manage")}
        />
      </div>
    </PosShell>
  );
}
