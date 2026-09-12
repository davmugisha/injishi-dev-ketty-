"use client";

/**
 * A labelled list of facts about one record.
 *
 * Every object lens is, underneath, "here is what we know". Writing that layout
 * once means a folio and a lease contract read as the same product, which is the
 * whole reason the object page shell exists at all.
 */

import type { ReactNode } from "react";

import { surfaceClass } from "./ui";
import { cn } from "@/lib/utils";

export interface Fact {
  label: string;
  value: ReactNode;
  /** Numbers, dates and money set in the tabular face so columns line up. */
  numeric?: boolean;
}

export function Facts({ items, className }: { items: Fact[]; className?: string }) {
  return (
    <dl
      className={cn(surfaceClass, "grid gap-x-6 gap-y-4 px-5 py-4", className)}
      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}
    >
      {items.map((item) => (
        <div key={item.label}>
          <dt className="text-2xs font-bold tracking-[0.08em] uppercase text-[var(--muted2)]">
            {item.label}
          </dt>
          <dd
            className={cn(
              "mt-1 text-sm text-ink",
              item.numeric && "pms-num",
            )}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
