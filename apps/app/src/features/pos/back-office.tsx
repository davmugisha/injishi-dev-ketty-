import { Card } from "@heroui/react";
import { LinkButton } from "@injishi/ui";
import type { ReactNode } from "react";
import type { PosOutlet } from "@/server/pos";

/**
 * The small parts the dashboard, reports, stock and menu screens share. Plain server components: they read
 * their numbers from props and use only the design tokens (never a hex value or a raw colour class).
 */

export const METHOD_NAME: Record<string, string> = {
  cash: "Cash",
  mtn_momo: "MTN MoMo",
  airtel_money: "Airtel Money",
  card: "Bank card",
  bank_transfer: "Bank transfer",
  voucher: "Voucher",
  customer_credit: "Customer credit",
};

export const EXPENSE_CATEGORY_NAME: Record<string, string> = {
  utilities: "Utilities",
  cleaning: "Cleaning",
  repairs: "Repairs",
  security: "Security",
  insurance: "Insurance",
  loan_interest: "Loan interest",
  other: "Other",
};

export const ORDER_STATUS_NAME: Record<string, string> = {
  draft: "Draft",
  submitted: "Sent",
  in_progress: "Preparing",
  ready: "Ready",
  delivered: "Served",
};

export const TABLE_STATUS_NAME: Record<string, string> = {
  available: "Available",
  occupied: "Occupied",
  reserved: "Reserved",
  bill_requested: "Bill requested",
  cleaning: "Cleaning",
};

/** A headline number with its label and an optional line underneath. */
export function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "good" | "warn" | "bad";
}) {
  const color = tone === "good" ? "text-success" : tone === "warn" ? "text-warning" : tone === "bad" ? "text-danger" : "";
  return (
    <Card className="min-w-0 gap-1 p-4">
      <span className="text-[12px] font-medium text-muted">{label}</span>
      <span className={`truncate text-[24px] leading-[30px] font-semibold tabular ${color}`}>{value}</span>
      {sub ? <span className="text-[12px] text-muted tabular">{sub}</span> : null}
    </Card>
  );
}

/** A titled block of a screen. */
export function Panel({
  title,
  note,
  action,
  children,
  className = "",
}: {
  title: string;
  note?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={`min-w-0 gap-3 p-4 ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-[15px] leading-5 font-semibold">{title}</h2>
          {note ? <p className="text-[12px] text-muted">{note}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

/** Horizontal bars: a label, a bar scaled to the largest value, and the figure. */
export function Bars({
  rows,
  empty = "Nothing yet.",
}: {
  rows: { label: string; value: number; display: ReactNode; hint?: ReactNode }[];
  empty?: string;
}) {
  if (rows.length === 0) return <p className="py-2 text-[13px] text-muted">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="flex flex-col gap-[10px]">
      {rows.map((r) => (
        <li key={r.label} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="min-w-0 truncate">
              {r.label}
              {r.hint ? <span className="ml-2 text-[11px] text-muted">{r.hint}</span> : null}
            </span>
            <span className="shrink-0 font-medium tabular">{r.display}</span>
          </div>
          <div className="h-[6px] overflow-hidden rounded-full bg-default" aria-hidden="true">
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** A plain data table for a report. Right-aligned figures; a sentence when there are no rows. */
export function DataTable({
  columns,
  rows,
  empty = "Nothing in this period.",
  foot,
}: {
  columns: { label: string; align?: "right" }[];
  rows: ReactNode[][];
  empty?: string;
  foot?: ReactNode[];
}) {
  if (rows.length === 0) return <p className="py-2 text-[13px] text-muted">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-separator text-left text-[11px] tracking-wide text-muted uppercase">
            {columns.map((c) => (
              <th key={c.label} className={`py-2 pr-3 font-medium ${c.align === "right" ? "text-right" : ""}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: report rows have no stable id of their own
            <tr key={i} className="border-b border-separator/60 last:border-0">
              {cells.map((cell, j) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: the cell position is its identity
                <td key={j} className={`py-2 pr-3 tabular ${columns[j]?.align === "right" ? "text-right" : ""}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {foot ? (
          <tfoot>
            <tr className="border-t border-separator font-semibold">
              {foot.map((cell, j) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: the cell position is its identity
                <td key={j} className={`py-2 pr-3 tabular ${columns[j]?.align === "right" ? "text-right" : ""}`}>
                  {cell}
                </td>
              ))}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}

/** "All outlets" and one link per outlet; the current one is filled. */
export function OutletSwitch({
  outlets,
  current,
  href,
  all,
}: {
  outlets: PosOutlet[];
  current: string | null;
  href: string;
  /** Offer an "All outlets" choice (the dashboard and the reports can total several). */
  all?: boolean;
}) {
  if (outlets.length < 2) return null;
  return (
    <nav aria-label="Outlet" className="flex flex-wrap gap-1">
      {all ? (
        <LinkButton href={href} variant={current === null ? "primary" : "ghost"} size="sm">
          All outlets
        </LinkButton>
      ) : null}
      {outlets.map((o) => (
        <LinkButton
          key={o.id}
          href={`${href}${href.includes("?") ? "&" : "?"}outlet=${o.id}`}
          variant={current === o.id ? "primary" : "ghost"}
          size="sm"
        >
          {o.branchName ?? o.name}
        </LinkButton>
      ))}
    </nav>
  );
}
