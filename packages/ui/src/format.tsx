/**
 * Locale for numbers and dates. East African English formats Rwandan francs as "RWF 118,400",
 * compact amounts as "RWF 7.9M" and dates as "12 October 2026", matching the design.
 */
export const LOCALE = "en-KE";

export type NumberFormat = Intl.NumberFormatOptions;

export function formatNumber(value: number, options?: NumberFormat): string {
  return new Intl.NumberFormat(LOCALE, options).format(value);
}

/** "RWF 118,400" (or compact: "RWF 7.9M"). */
export function formatRwf(value: number, compact = false): string {
  return formatNumber(value, {
    style: "currency",
    currency: "RWF",
    ...(compact ? { notation: "compact", maximumFractionDigits: 1 } : {}),
  });
}
