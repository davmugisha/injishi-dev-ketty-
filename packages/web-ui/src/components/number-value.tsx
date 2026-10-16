"use client";

import type { ReactNode } from "react";
import { NumberValue, type NumberValueProps } from "@heroui-pro/react";

/**
 * NumberValue, from HeroUI Pro (`@heroui-pro/react`, a paid licence), and
 * `RwfAmount`, the one way a Rwandan franc figure is drawn with it.
 *
 * NumberValue formats a number through React Aria's `NumberFormatter`
 * (currency, percent, compact) with prefix and suffix slots, and sets digits
 * in tabular figures so a column of them lines up.
 *
 * `RwfAmount` prints exactly what `formatPrice` in `@injishi/utils` prints:
 * "RWF 175,000". Whole francs, en-US grouping, and the code "RWF" as a
 * prefix. It does NOT ask Intl for the currency, because `en-RW` and several
 * other locales render the franc's symbol as "RF", and the design and specs
 * say "RWF" (format.ts says why). Anything else NumberValue takes still
 * passes through: `notation="compact"` for a KPI ("RWF 15M"), `signDisplay`
 * for a change.
 *
 * Apps reach Pro only through this package; see `kpi.tsx` for why, and for
 * the install token every build needs.
 */
export { NumberValue };
export type { NumberValueProps };

/** Plain children only (a suffix): NumberValue's render function form could not sit beside the prefix. */
type RwfAmountProps = Omit<NumberValueProps, "style" | "currency" | "locale" | "children"> & {
  children?: ReactNode;
};

export function RwfAmount({ maximumFractionDigits = 0, children, ...props }: RwfAmountProps) {
  return (
    <NumberValue {...props} locale="en-US" maximumFractionDigits={maximumFractionDigits} style="decimal">
      <NumberValue.Prefix>RWF{" "}</NumberValue.Prefix>
      {children}
    </NumberValue>
  );
}
