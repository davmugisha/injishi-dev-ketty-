import { Card } from "@heroui/react";
import type { ComponentType, ReactNode } from "react";

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

type Icon = ComponentType<{ className?: string; width?: number; height?: number }>;
export type Tint = "accent" | "success" | "warning" | "danger" | "default";

/** The soft square behind an icon, per tint (whole class names, so the styles are generated). */
export const TINT_CHIP: Record<Tint, string> = {
  accent: "bg-accent-soft text-accent-soft-foreground",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  default: "bg-default text-foreground",
};

/** A rounded square with an icon in it: the mark of a headline card or a list row. */
export function IconChip({ icon: ItemIcon, tint = "accent", size = 40 }: { icon: Icon; tint?: Tint; size?: number }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-xl ${TINT_CHIP[tint]}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <ItemIcon width={Math.round(size / 2)} height={Math.round(size / 2)} />
    </span>
  );
}

/** A headline number: its label and icon on top, the figure large, an optional line underneath. */
export function Kpi({
  label,
  value,
  sub,
  tone,
  icon,
  tint = "accent",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "good" | "warn" | "bad";
  icon?: Icon;
  tint?: Tint;
}) {
  const color =
    tone === "good" ? "text-success" : tone === "warn" ? "text-warning" : tone === "bad" ? "text-danger" : "";
  return (
    <Card data-ui="kpi" className="min-w-0 gap-2 rounded-[20px] p-4 shadow-none sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <span className="pt-1 text-[13px] font-medium text-muted">{label}</span>
        {icon ? <IconChip icon={icon} tint={tint} size={38} /> : null}
      </div>
      <span className={`truncate text-[20px] leading-8 font-bold tracking-tight tabular sm:text-[26px] ${color}`}>
        {value}
      </span>
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
    <Card className={`min-w-0 gap-4 rounded-[20px] p-5 shadow-none ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-[16px] leading-5 font-semibold tracking-tight">{title}</h2>
          {note ? <p className="mt-0.5 text-[12px] text-muted">{note}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

/** The brand's soft-to-full bar fill (a gradient of the accent token, never a raw colour). */
const BAR_FILL = "linear-gradient(90deg, color-mix(in oklab, var(--accent) 30%, transparent), var(--accent))";

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
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.label} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="min-w-0 truncate font-medium">
              {r.label}
              {r.hint ? <span className="ml-2 text-[11px] font-normal text-muted">{r.hint}</span> : null}
            </span>
            <span className="shrink-0 font-semibold tabular">{r.display}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-default" aria-hidden="true">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max(3, (r.value / max) * 100)}%`, background: BAR_FILL }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * A column chart: one column per row, scaled to the largest. The best column is solid and carries its figure in a
 * bubble; the others are soft and striped, so the eye lands on the peak. Each column names its value for screen readers.
 */
export function Columns({
  rows,
  empty = "Nothing yet.",
  height = 200,
}: {
  rows: { key: string; label: string; value: number; display: string; hint?: string }[];
  empty?: string;
  height?: number;
}) {
  if (rows.length === 0) return <p className="py-2 text-[13px] text-muted">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  const best = rows.reduce((a, r) => (r.value > a.value ? r : a), rows[0] as (typeof rows)[number]);
  return (
    <div data-ui="column-chart" className="flex items-end gap-2 pt-12" style={{ height: height + 72 }}>
      {rows.map((r) => {
        const top = r.key === best.key;
        return (
          <div
            key={r.key}
            data-ui="column"
            data-highlight={top}
            role="img"
            aria-label={`${r.label}: ${r.display}${r.hint ? `, ${r.hint}` : ""}`}
            className="relative flex min-w-0 flex-1 flex-col items-center justify-end gap-2"
          >
            {top ? (
              <span className="absolute -top-11 z-10 rounded-lg bg-foreground px-2.5 py-1 text-center text-[12px] leading-4 font-semibold whitespace-nowrap text-background shadow-lg">
                {r.display}
                {r.hint ? <span className="block text-[10px] font-normal opacity-70">{r.hint}</span> : null}
              </span>
            ) : null}
            <div
              className={`w-full max-w-14 rounded-xl ${top ? "bg-accent" : ""}`}
              style={{
                height: Math.max(6, (r.value / max) * height),
                ...(top
                  ? {}
                  : {
                      background:
                        "repeating-linear-gradient(135deg, color-mix(in oklab, var(--accent) 22%, transparent) 0 6px, color-mix(in oklab, var(--accent) 12%, transparent) 6px 12px)",
                    }),
              }}
            />
            <span className={`truncate text-[11px] ${top ? "font-semibold text-foreground" : "text-muted"}`}>
              {r.label}
            </span>
          </div>
        );
      })}
    </div>
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
