"use client";

import type { Key, ReactNode } from "react";

/*
 * The form helpers Outlet menus draws. They were `./form-parts`, which Channels (Marketplace's) keeps until it
 * moves in stage 7; Outlet menus moves with Outlets in ADR-074 stage 5.
 */

/** Field label used above groups inside cards (artifact: .label). */
export function FieldLabel({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <span id={id} className="text-[13px] leading-[18px] font-medium">
      {children}
    </span>
  );
}

/** First selected key of a single-selection collection (tables, lists). */
export function firstKey(keys: "all" | Set<Key>): string | null {
  if (keys === "all") return null;
  const [k] = [...keys];
  return k == null ? null : String(k);
}
