import { formatNumber, formatRwf } from "./format.tsx";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** The largest amount any rentals figure may hold (contracts `RWF_MAX`): ten billion francs. */
export const RWF_MAX = 10_000_000_000;

/** A true minus sign, so "−RWF 1,200" does not read as a hyphen. */
const MINUS = "−";

export interface MoneyFormat {
  /** "RWF 1.2M" instead of "RWF 1,234,567". For figures and axis labels; exact amounts go in a tooltip. */
  compact?: boolean;
  /** "+RWF 12,000" for money in and "−RWF 12,000" for money out. Without it only negatives carry a sign. */
  signed?: boolean;
  /** Leave the currency off ("1,234,567", "1.2M"), for columns whose header already says RWF. */
  bare?: boolean;
}

/** Whole francs, the one way amounts are written: "RWF 1,234,567", "RWF 1.2M", "+RWF 12,000". */
export function formatMoney(
  value: number,
  { compact = false, signed = false, bare = false }: MoneyFormat = {},
): string {
  const whole = Math.round(value);
  const abs = Math.abs(whole);
  const digits = bare
    ? formatNumber(abs, compact ? { notation: "compact", maximumFractionDigits: 1 } : undefined)
    : formatRwf(abs, compact);
  if (whole < 0) return `${MINUS}${digits}`;
  if (signed && whole > 0) return `+${digits}`;
  return digits;
}

/** Axis labels and tight figures: "1.2M", "450K", "0". */
export function formatMoneyAxis(value: number): string {
  return formatMoney(value, { compact: true, bare: true });
}

/**
 * An amount in whole francs with tabular figures. Compact amounts keep the exact one for screen readers
 * and on hover, so "RWF 1.2M" never hides what was actually paid. Right-align it in tables
 * (`<Table.Cell className="text-right">`).
 */
export function Money({
  value,
  compact,
  signed,
  bare,
  className,
}: { value: number; className?: string } & MoneyFormat) {
  const shown = formatMoney(value, { compact, signed, bare });
  if (!compact) return <span className={cx("whitespace-nowrap tabular", className)}>{shown}</span>;
  const exact = formatMoney(value, { signed, bare });
  return (
    <span className={cx("whitespace-nowrap tabular", className)} title={exact}>
      <span aria-hidden="true">{shown}</span>
      <span className="sr-only">{exact}</span>
    </span>
  );
}
